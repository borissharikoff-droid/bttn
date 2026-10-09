// BTTN 4.0 — the Siege: a run from zero (route, doors, Integrity, cards, the loot moment, camp, relics, the finale),
// its end (Fame, the Furnace into Embers) and the meta it feeds. DOM-free: runs in the Node playtests (tools/bot.js).
//
// A run is S.run (saved with the game). Between runs it is { on: 0, phase: 'summary' | 'setup' }. The run's hold:
// S.run.phase is 'field' while the Horde is fought; anything else holds the field still (game.js tick: only the clock
// runs). After every boss the post-boss beats come in order (the loot moment, the card, a relic, camp, doors: other
// modules register them with G.runBeat), then the march. G.runEnd(kind) pays the Fame, burns everything the party
// carried into Embers (the Furnace), resets the run in full and emits 'ascend' (the 3.x clean-ups) and 'runSummary'.
(function (G) {
  'use strict';
  if (!G.TUNE || !G.newState) return; // needs game.js
  const { emit } = G;
  const R = G.R, TUNE = G.TUNE;
  Object.assign(TUNE, {
    // with no run UI to show the summary and the setup (the 3.x page, the Node playtests): the next Siege starts at once
    // with the last setup (js/run_ui.js sets G.runUI and shows them instead)
    runAgainAuto: 1,
    // with no run UI, a post-boss beat nobody answers is resolved for the player after this many s (game time)
    beatAutoNoUI: 4,
    // the par clock (field and camp time): 45 s a zone, 20 s a camp (15:10 a Siege); the Heat 7 Reaper: past
    // reaperAfter s behind par, bites +reaperPer for every further minute
    parZone: 45, parCamp: 20, reaperAfter: 120, reaperPer: 0.1,
    // Integrity: pips at the start (Heat 10 and the Golden Button: 2), at most pipCap with the Hall's Second Wind
    pips: 3, pipCap: 4,
    // the boss relic item drop (relic.js, 1/600 bosses, 1/200 lords) is off inside a Siege: relics come as belt choices
    // (a flag for relic.js, which is not this module's: skip the roll when G.inSiege() && !TUNE.siegeRelicItems)
    siegeRelicItems: 0,
  });

  const S_ = () => G.S;
  const runOf = () => (G.S && G.S.run) || null;
  const on = () => { const r = runOf(); return !!(r && r.on); };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const SIZE = () => G.REALM_SIZE;
  const SG = () => G.SIEGE;
  // the run's hooks: G.hook('runMul', (kind, run) -> factor) for 'fame' and 'embers' (Renown, the Temple, Museum V...)
  function hookMul(kind, r) {
    let m = 1;
    for (const f of (G.HOOKS && G.HOOKS.runMul) || []) { const v = f(kind, r); if (typeof v === 'number' && v > 0) m *= v; }
    return m;
  }

  // ---------- Strings (English; js/i18n_ru.js adds Russian later) ----------
  if (G.tAdd) G.tAdd({
    run_fall: 'FELL', run_extract: 'EXTRACTED', run_win: 'VICTORY', run_abandon: 'ABANDONED',
    run_mulFall: 'FELL: ×0.5', run_mulExtract: 'EXTRACTED: ×1', run_mulWin: 'WON: ×1.5', run_mulAbandon: 'ABANDONED: ×0.5',
    fame_zones: 'Zones cleared', fame_lords: 'Lords slain', fame_acts: 'Act bosses slain', fame_win: 'The Mad Button falls',
    fame_par: 'Under par', fame_push: 'Push lands', fame_daily: 'Daily Siege', fame_sticker: 'First Heat sticker', fame_heat: 'Heat {0}: ×{1}',
    emb_items: 'The Furnace: {0} items', emb_shards: 'Shards', emb_orbs: 'Orbs', emb_keys: 'Keys', emb_pouch: 'The pouch',
    nm_fellBoss: 'Fell at {0}, {1}: {2} zones from the Mad Button.', nm_fellMad: 'Fell at the Mad Button itself: one more try.', nm_fellZone: 'Fell in {0}: {1} zones from the Mad Button.',
    nm_kind_boss: 'a boss', nm_kind_lord: 'a lord', nm_kind_act: 'Act {0} boss', nm_kind_final: 'the Mad Button',
    nm_cause_doom: 'Cause: DOOM not answered. Ward it.', nm_cause_boss: 'Cause: the fight was lost.', nm_cause_overrun: 'Cause: overrun by the Horde.',
    nm_cause_abandon: 'The run was abandoned.', nm_win: 'The Mad Button is broken.', nm_extract: 'Extracted at depth {0}.',
    pip_lost: 'INTEGRITY CRACKED', pip_back: 'INTEGRITY +1', pip_muster: 'Land 1 is the muster: no pip lost', pip_last: 'LAST PIP: the next hit is the fall',
  });

  // ---------- The run object ----------
  // the offers' own random stream (route, doors, cards, loot cards, market: never the combat stream, so a seeded Daily
  // gives everyone the same offers whatever happens in a fight). Resumes where it was after a reload (rngN).
  G.runRng = function () {
    const r = runOf();
    if (!r || !r.on) return G.rng();
    if (!R.runRng || R.runRngId !== r.id) { R.runRng = G.seeded((r.seed >>> 0) || 1); R.runRngId = r.id; for (let i = 0; i < (r.rngN | 0); i++) R.runRng(); }
    r.rngN = (r.rngN | 0) + 1;
    return R.runRng();
  };
  // the share code (streamer mode, setup's 'Enter a code'): BTTN-<seed>-<button>-H<heat>
  G.runCode = r => { r = r || runOf(); return r && r.seed != null ? 'BTTN-' + (r.seed >>> 0).toString(36).toUpperCase() + '-' + (r.btn || 'classic') + '-H' + (r.heat | 0) : ''; };
  G.runParseCode = function (code) {
    const m = /^BTTN-([0-9A-Z]+)-([a-z]+)-H(\d+)$/i.exec(String(code || '').trim());
    return m ? { seed: parseInt(m[1], 36) >>> 0, btn: m[2].toLowerCase(), heat: +m[3] } : null;
  };

  function newRun(setup, n) {
    const S = S_();
    // (the offers' seed: the Daily's, a shared code's, or one drawn now)
    const seed = setup.seed != null ? setup.seed >>> 0 : Math.floor(G.rng() * 4294967296) >>> 0;
    return {
      on: 1, n, id: 'r' + n + '-' + seed.toString(36), seed, rngN: 0, day: setup.day || '', ranked: setup.day ? 1 : 0,
      btn: setup.btn || 'classic', cls: setup.cls, heat: setup.heat | 0, keeps: (setup.keeps || []).slice(0, 2),
      // the lands (realm indices), the map mod and the reward tag of each land slot (the doors set them), the doors on offer
      route: [], mods: [null, null, null, null, null, null], tags: [null, null, null, null, null, null], doors: null,
      // Integrity, Mend charges, card rerolls and banishes, the relic belt (rule ids, merged into d.uq)
      pips: TUNE.pips, pipMax: TUNE.pips, mend: TUNE.mendCharges, mendMax: TUNE.mendCharges, mendBonus: 0,
      rerolls: 1, banish: 0, banished: [], belt: [], beltMax: 3,
      // the books: lords and act bosses slain, the deepest zone cleared, the Embers pouch, Keys, the raw Fame by line
      lords: 0, acts: 0, cleared: 0, maxDepth: 0, cards: 0, camps: 0, pouch: 0, pouchLog: {}, keys: 0, fame: {},
      // clocks: field time (the shelter), par time (field + camp), all of it (the summary)
      field: 0, parT: 0, secs: 0, t0: (S.st && S.st.playTime) || 0, wall0: Date.now(),
      assisted: 0, conts: 0, push: 0, won: 0, phase: 'field', beat: null, lsT: 0, deeds: [],
      cause: null, causeAt: null, hits: 0, wipes: 0, inv: 0, invRoll: G.rng(),
      // what the Codex should hear about at the end: the uniques and relics already known when the run began
      uq0: Object.assign({}, S.uq || {}), relic0: Object.assign({}, (S.rec && S.rec.relicN) || {}),
    };
  }

  // ---------- Routes (until the doors stream adds doors: each act's lands in G.SIEGE.ROUTE order) ----------
  // G.landOpen(id): the Deeds' unlocks (the meta's); without it, the lands open from the start (REALMS[].start)
  const landOpen = id => { const i = G.REALM_BY_ID[id]; if (i == null) return false; return G.landOpen ? !!G.landOpen(id) : !!G.REALMS[i].start; };
  function defaultRoute(first) {
    const used = new Set(), route = [];
    for (let k = 0; k < SG().lands; k++) {
      const act = SG().actOf[k], pool = SG().ROUTE[act] || [];
      let id = null;
      if (k === 0 && first && pool.includes(first) && landOpen(first)) id = first;
      if (!id) id = pool.find(x => !used.has(x) && landOpen(x)) || pool.find(x => !used.has(x)) || pool[0];
      used.add(id); route.push(G.REALM_BY_ID[id]);
    }
    return route;
  }
  G.runDefaultRoute = defaultRoute;
  // the doors stream sets a land slot's land (and its map mod and reward tag) before the party marches into it
  G.runSetLand = function (slot, land, mod, tag) {
    const r = runOf();
    if (!r || !r.on || slot < 0 || slot >= r.route.length) return false;
    const i = typeof land === 'number' ? land : G.REALM_BY_ID[land];
    if (i == null || !G.REALMS[i]) return false;
    r.route[slot] = i; r.mods[slot] = mod || null; r.tags[slot] = tag || null;
    G.dirty();
    emit('runRoute', slot, i, mod, tag);
    return true;
  };
  G.runSlot = d => Math.floor(Math.max(0, d == null ? S_().depth : d) / SIZE());
  G.runLand = d => G.REALMS[G.realmIndex(d == null ? S_().depth : d)];

  // ---------- The hold and the post-boss beats ----------
  G.runHeld = () => { const r = runOf(); return !r || !r.on || r.phase !== 'field'; };
  // set the run's phase: anything but 'field' holds the field (a module that sets one outside the post-boss beats owns
  // it: it sets 'field' again when done, and re-asserts it on 'runResume' after a reload, which otherwise drops it)
  G.runPhase = function (p) {
    const r = runOf();
    if (!r || r.phase === p) return;
    r.phase = p;
    if (p === 'camp') r.camps = (r.camps | 0) + 1;
    emit('runPhase', p, r.beat && r.beat.ctx);
  };
  const BEATS = [], BEAT_BY_ID = {};
  // Register a post-boss beat: { id, order, open(ctx) -> true to hold the field (then call G.beatDone(id) when done),
  //   tick(dt, ctx) while it holds (game time), auto(ctx) to resolve it for the player (a timeout, a bot), resume(ctx) after
  //   a reload }. ctx = { d, lord, kind ('boss'|'lord'|'act'|'final'), act, final, realm, slot }
  G.runBeat = function (def) {
    if (!def || !def.id || typeof def.open !== 'function') return false;
    const i = BEATS.findIndex(b => b.id === def.id);
    if (i >= 0) BEATS.splice(i, 1);
    BEATS.push(Object.assign({ order: 50 }, def));
    BEATS.sort((a, b) => a.order - b.order);
    BEAT_BY_ID[def.id] = BEATS.find(b => b.id === def.id);
    return true;
  };
  G.runBeats = () => BEATS.map(b => b.id);
  function nextBeat() {
    const S = S_(), r = runOf();
    if (!r || !r.on) return true;
    const bt = r.beat;
    while (bt && bt.i < BEATS.length) {
      const B = BEATS[bt.i++];
      let took = false;
      try { took = !!B.open(bt.ctx); } catch (e) { if (typeof console !== 'undefined') console.error('beat ' + B.id, e); }
      if (!r.on) return true; // a beat ended the run (e.g. an extract)
      if (took) { bt.id = B.id; bt.t = 0; G.runPhase(B.id); emit('beat', B.id, bt.ctx); return true; }
    }
    r.beat = null;
    G.runPhase('field');
    // the Mad Button fell: the Siege is won, once its loot and card are taken
    if (bt && bt.ctx && bt.ctx.final) { G.runEnd('win'); return true; }
    if (G.startMarch) G.startMarch(bt && bt.ctx ? bt.ctx.d : S.depth - 1);
    return true;
  }
  // a beat is over: on to the next one (and the march after the last)
  G.beatDone = function (id) {
    const r = runOf();
    if (!r || !r.on || !r.beat || r.beat.id !== id) return false;
    r.beat.id = null;
    emit('beatDone', id);
    nextBeat();
    return true;
  };
  // resolve the beat on screen for the player (its own auto(), then done in any case)
  G.beatAuto = function () {
    const r = runOf(), bt = r && r.on && r.beat;
    if (!bt || !bt.id) return false;
    const id = bt.id, B = BEAT_BY_ID[id];
    if (B && B.auto) { try { B.auto(bt.ctx); } catch (e) { if (typeof console !== 'undefined') console.error('beat auto ' + id, e); } }
    if (r.beat && r.beat.id === id) G.beatDone(id);
    return true;
  };
  // bossWin's hand-off: the beats, then the march (or the win). True: the run took care of what comes next
  G.runAfterBoss = function (b) {
    const r = runOf();
    if (!r || !r.on) return false;
    const kind = b.kind || G.bossKind(b.d);
    r.beat = { i: 0, id: null, t: 0, ctx: { d: b.d, lord: !!b.lord, kind, act: kind === 'act', final: kind === 'final', realm: b.realm, slot: G.runSlot(b.d) } };
    return nextBeat();
  };
  // while the field holds: the clocks, the beat's own tick, and with no UI the beat is answered for the player
  G.runHoldTick = function (dt) {
    const r = runOf();
    if (!r || !r.on) return;
    r.secs += dt;
    if (r.phase === 'camp' || r.phase === 'doors') r.parT += dt;
    const bt = r.beat;
    // (a phase set without a beat, G.runPhase(p) by a module, holds until that module sets 'field' again)
    if (!bt || !bt.id) return;
    const B = BEAT_BY_ID[bt.id];
    if (!B) { bt.id = null; nextBeat(); return; }
    bt.t = (bt.t || 0) + dt;
    if (B.tick) { try { B.tick(dt, bt.ctx); } catch (e) { if (typeof console !== 'undefined') console.error('beat tick ' + bt.id, e); } }
    if (!G.runUI && r.beat && r.beat.id && r.beat.t >= TUNE.beatAutoNoUI) G.beatAuto();
  };
  // the field's clocks (game.js tick, field only)
  G.runTick = function (dt) {
    const r = runOf();
    if (!r || !r.on) return;
    r.secs += dt; r.field += dt; r.parT += dt;
  };

  // ---------- Par and the Reaper ----------
  G.runPace = function () {
    const r = runOf();
    if (!r || !r.on) return null;
    const par = TUNE.parZone * ((r.cleared | 0) + 1) + TUNE.parCamp * (r.camps | 0);
    return { t: r.parT, par, behind: r.parT - par, onPace: r.parT <= par, full: TUNE.parZone * SG().zones + TUNE.parCamp * (SG().lands - 1) };
  };
  const reaperK = () => {
    const r = runOf();
    if (!r || !r.on || !G.heat().reaper) return 1;
    const p = G.runPace(), over = p.behind - TUNE.reaperAfter;
    return over > 0 ? 1 + TUNE.reaperPer * over / 60 : 1;
  };
  G.runReaper = reaperK;
  if (G.hook) G.hook('bite', (m, who, bd) => { const k = reaperK(); return k > 1 ? bd * k : null; });

  // ---------- Integrity ----------
  // why the run is losing a pip (for the summary): an unanswered DOOM shortly before, a lost fight, or the Horde
  function causeOf(why, boss) {
    const S = S_(), t = (S.st && S.st.playTime) || 0;
    if (why === 'lord') return 'boss';
    if (R.doomAt != null && t - R.doomAt < 6) return 'doom';
    return boss ? 'boss' : 'overrun';
  }
  // will a hit at this depth be the fall? (land 1 is the muster; past it, a hit at 0 pips)
  G.pipFalls = d => { const r = runOf(); return !!(r && r.on && (d == null ? S_().depth : d) >= SIZE() && (r.pips | 0) <= 0); };
  // a hit on the Integrity: a wipe ('wipe', info {depth, meter, boss: a boss fight was on}) or a lost fight against a
  // lord, an act boss or the Mad Button ('lord', info: the boss). Returns 'muster' (land 1: nothing lost), 'pip' (one
  // lost) or 'fall' (it was the last: the Button falls; G.runOver asks the player, Continue or the end)
  G.pipHit = function (why, info) {
    const S = S_(), r = runOf();
    if (!r || !r.on) return 'off';
    const d = info && info.depth != null ? info.depth : S.depth;
    const bd = why === 'lord' && info && info.d != null ? info.d : info && info.boss ? d : null;
    r.hits = (r.hits | 0) + 1;
    if (why === 'wipe') r.wipes = (r.wipes | 0) + 1;
    r.cause = causeOf(why, bd != null);
    r.causeAt = { d, why, boss: bd != null ? G.bossName(bd) : null, kind: bd != null ? G.bossKind(bd) : null, bd };
    if (d < SIZE()) { emit('pip', 0, r.pips, why, 'muster'); return 'muster'; }
    if ((r.pips | 0) > 0) {
      r.pips--;
      emit('pip', -1, r.pips, why, r.pips === 0 ? 'last' : 'lost');
      return 'pip';
    }
    emit('pip', 0, 0, why, 'fall');
    if (G.runOver) G.runOver({ depth: d, meter: info && info.meter != null ? info.meter : S.bossMeter || 0 });
    return 'fall';
  };
  G.pipGain = function (n) {
    const r = runOf();
    if (!r || !r.on) return 0;
    const was = r.pips | 0;
    r.pips = Math.min(r.pipMax | 0, was + (n == null ? 1 : n));
    if (r.pips > was) emit('pip', r.pips - was, r.pips, 'gain', 'gain');
    return r.pips - was;
  };

  // ---------- Mend charges ----------
  const healerUp = () => (G.partyUnits ? G.partyUnits().some(u => u.role === 'heal' && !(u.down > 0)) : false);
  // a land's charges (and at camp): TUNE.mendCharges, +1 with a healer standing, + the run's bonus (Alchemist II)
  G.mendRefill = function () {
    const r = runOf();
    if (!r || !r.on) return 0;
    r.mendMax = TUNE.mendCharges + (healerUp() ? 1 : 0) + (r.mendBonus | 0);
    r.mend = r.mendMax;
    emit('mendCharge', r.mend, r.mendMax);
    return r.mend;
  };

  // ---------- Fame and the pouch ----------
  function fameAdd(k, v) { const r = runOf(); if (!r || !r.on || !(v > 0)) return; r.fame[k] = (r.fame[k] || 0) + v; emit('runFame', k, v); }
  // other streams' Fame lines (a Push land +30, the Daily +50...)
  G.runFameAdd = fameAdd;
  // Embers into the run's pouch (a boss kill, the loot moment's unpicked cards at half their item value...)
  G.pouchAdd = function (n, why) {
    const r = runOf();
    if (!r || !r.on || !(n > 0)) return 0;
    r.pouch += n; r.pouchLog[why || '?'] = (r.pouchLog[why || '?'] || 0) + n;
    emit('pouch', n, r.pouch, why);
    return n;
  };
  // Embers for good (the run's end, the Barracks while away...)
  G.addEmbers = function (n, why) {
    const S = S_();
    n = Math.max(0, Math.round(n || 0));
    if (!n) return 0;
    S.embers = (S.embers || 0) + n; S.emberTotal = (S.emberTotal || 0) + n;
    emit('embers', n, why);
    return n;
  };
  // the burn value of one item (the Furnace and the loot moment's burned cards)
  G.itemEmbers = function (g) {
    if (!g) return 0;
    const relic = G.isRelic ? G.isRelic(g) : !!(g.q && G.UNIQUES[g.q] && G.UNIQUES[g.q].relic);
    const base = relic ? G.EMBERS.relic : g.q ? G.EMBERS.uq : G.EMBER_R[g.r | 0] || 1;
    return base * (1 + (g.il || 0) / 20) * (1 + 0.1 * (g.e || 0));
  };

  // the books after a boss (bossWin, before its event): Fame, the pouch, Integrity, Mend, the best run
  G.runBossWin = function (b) {
    const S = S_(), r = runOf();
    if (!r || !r.on) return;
    const kind = b.kind || G.bossKind(b.d);
    r.maxDepth = Math.max(r.maxDepth | 0, S.maxDepth | 0);
    // (a zone fought again after a wipe's push-back pays nothing twice)
    if (b.d >= (r.cleared | 0)) {
      r.cleared = b.d + 1;
      fameAdd('zones', G.FAME.zone(b.d));
      if (b.lord) { r.lords++; fameAdd('lords', G.FAME.lord); }
      if (kind === 'act') { r.acts++; fameAdd('acts', G.FAME.act); }
      // (the Star Chart's Ember Flow: boss Embers +10% a level)
      G.pouchAdd((G.EMBERS.kill[kind] || G.EMBERS.kill.boss) * (G.D.bossEmbers || 1), kind);
      // a lord gives a pip back; a new land brings its Mend charges
      if (b.lord) { G.pipGain(1); G.mendRefill(); }
      bestRun(b);
    }
    if (kind === 'final') r.won = 1;
  };
  // the record run: the deepest (at the highest Heat) a player has gone, with the party's gear there (the ladder's 'power')
  function bestRun(b) {
    const S = S_(), r = runOf(), cur = S.rec && S.rec.bestRun;
    const depth = r.cleared | 0, heat = r.heat | 0;
    if (cur && (cur.heat > heat || (cur.heat === heat && cur.depth >= depth))) return;
    let snap = null;
    try { snap = G.ladderSnapshot ? G.ladderSnapshot() : null; } catch (e) { snap = null; }
    S.rec.bestRun = { depth, heat, cls: S.hero.cls, btn: r.btn, lvl: S.hero.lvl, power: snap ? snap.power : 0, gear: snap ? snap.gear : null, at: Date.now(), n: r.n };
  }
  // what the run would pay in Fame if it ended now (a fall never costs Fame): for the 3.x Ascend tab and the HUD
  function fameNow(r, kind) {
    const S = S_(), lines = [];
    for (const k of ['zones', 'lords', 'acts', 'push', 'daily']) if (r.fame[k] > 0) lines.push({ k, v: r.fame[k] });
    if (kind === 'win') {
      lines.push({ k: 'win', v: G.FAME.win });
      const p = G.runPace();
      if (p && r.parT <= p.full) lines.push({ k: 'par', v: G.FAME.par });
      // a Button's first sticker at this Heat (not on an assisted run)
      const stk = S.heatStk && S.heatStk[r.btn];
      if (!r.assisted && !(stk != null && stk >= r.heat)) lines.push({ k: 'sticker', v: G.FAME.sticker });
    }
    for (const k in r.fame) if (!['zones', 'lords', 'acts', 'push', 'daily'].includes(k) && r.fame[k] > 0) lines.push({ k, v: r.fame[k] });
    const raw = lines.reduce((a, l) => a + l.v, 0);
    // x (1 + 0.2 Heat) x the meta's (Renown, the Temple: D.fameMult; and G.hook('runMul'))
    const heat = 1 + 0.2 * (r.heat | 0), extra = (G.D.fameMult || 1) * hookMul('fame', r);
    return { lines, raw, mul: { heat, extra }, total: Math.floor(raw * heat * extra) };
  }
  G.runFame = () => { const r = runOf(); return r && r.on ? fameNow(r, 'fall').total : 0; };

  // ---------- The Furnace ----------
  function furnace(r) {
    const S = S_(), h = S.hero, items = [];
    const add = (g, who) => { if (!g) return; const v = G.itemEmbers(g); items.push({ id: g.id, q: g.q || null, r: g.r, il: g.il | 0, e: g.e | 0, who, v: Math.round(v * 10) / 10 }); };
    for (const s of G.SLOTS) add(h.eq[s], -1);
    (S.party || []).forEach((m, i) => { for (const s of G.SLOTS) add(m.eq[s], i); });
    for (const g of h.bag) add(g, 'bag');
    items.sort((a, b) => b.v - a.v);
    const itemsV = items.reduce((a, x) => a + x.v, 0);
    const shardsN = h.shards | 0, shardsV = Math.floor(shardsN / G.EMBERS.shard);
    const orbs = [];
    let orbsV = 0;
    for (const k of G.ORB_IDS || []) { const n = (h.orbs && h.orbs[k]) | 0; if (n) { const v = n * (G.EMBERS.orb[k] || 1); orbs.push({ id: k, n, v }); orbsV += v; } }
    const keysN = r.keys | 0, keysV = keysN * G.EMBERS.key;
    return { items, itemsV, shards: { n: shardsN, v: shardsV }, orbs, orbsV, keys: { n: keysN, v: keysV }, total: itemsV + shardsV + orbsV + keysV };
  }
  function embersNow(r, kind) {
    const f = furnace(r), endK = G.EMBERS.end[kind] || 0.5, heat = 1 + G.EMBERS.heat * (r.heat | 0), extra = hookMul('embers', r);
    const base = f.total + r.pouch;
    return Object.assign(f, { furnace: Math.round(f.total), pouch: Math.round(r.pouch), pouchLog: Object.assign({}, r.pouchLog), base: Math.round(base),
      mul: { end: endK, kind, heat, extra }, total: Math.round(base * endK * heat * extra) });
  }
  // what ending now would bank (the camp's "Extract: bank N Embers", the HUD)
  G.runEmbers = kind => { const r = runOf(); return r && r.on ? embersNow(r, kind || 'extract').total : 0; };

  // ---------- The near miss: what the summary says about how far it got ----------
  function nearMiss(r, kind) {
    const S = S_(), fin = SG().final, land = G.runLand(S.depth), at = r.causeAt || {};
    const out = { kind, depth: S.depth, maxDepth: S.maxDepth | 0, cleared: r.cleared | 0, zonesToMad: Math.max(0, fin + 1 - (r.cleared | 0)),
      land: land ? land.name : '', landId: land ? land.id : '', cause: kind === 'abandon' ? 'abandon' : r.cause || null, boss: null, bossKind: null, act: 0, lines: [] };
    if (kind === 'win') { out.lines.push(['nm_win']); return out; }
    if (kind === 'extract') { out.lines.push(['nm_extract', S.depth + 1]); return out; }
    if (at.boss) { out.boss = at.boss; out.bossKind = at.kind; out.act = at.kind === 'act' ? (SG().actBoss.indexOf(at.bd) + 1) : 0; }
    if (out.bossKind === 'final') { out.zonesToMad = 0; out.lines.push(['nm_fellMad']); }
    else if (out.boss) out.lines.push(['nm_fellBoss', out.boss, out.bossKind === 'act' ? ['nm_kind_act', out.act] : ['nm_kind_' + (out.bossKind || 'lord')], out.zonesToMad]);
    else out.lines.push(['nm_fellZone', G.ZONE_NAME ? G.ZONE_NAME(S.depth) : out.land, out.zonesToMad]);
    if (out.cause) out.lines.push(['nm_cause_' + out.cause]);
    return out;
  }

  // ---------- The full reset (DESIGN §3) ----------
  // 4.0: what a run end resets: the run's economy (gold, the Hand upgrades, the Garrison, potions, field chests, meters,
  // buffs, quests, scars, the continue count); not the Constellation or essence (nodes, essence, essRun stay)
  G.RUN_KEYS = ['gold', 'goldRun', 'clicksRun', 'upg', 'heroes', 'depth', 'maxDepth', 'runFrom', 'pots', 'chests', 'chestMeter', 'bossMeter',
    'buffs', 'quests', 'scar', 'tormentRun', 'runConts', 'rested', 'bless', 'blessOffer', 'champRun', 'fallen'];
  const HERO_KEEP = ['auto', 'salv', 'cast', 'autoPerk', 'gu', 'kills', 'elites', 'cls'];
  function resetRun(S) {
    const fresh = G.newState();
    for (const k of G.RUN_KEYS) S[k] = fresh[k];
    S.torment = 0;
    // the Warden from nothing (level 1, no perks, no gear, no bag, no shards or orbs); the player's toggles stay
    const h = S.hero || {}, nh = fresh.hero;
    for (const k of HERO_KEEP) if (h[k] != null) nh[k] = h[k];
    S.hero = nh;
    S.party = [];
    G.ensureHero(S);
    // the field (runtime): nothing carried into the next run, no loot handed to anyone (and the old Horde marked dead,
    // so a tick that ended the run mid-loop, a bite that broke the last pip, swings at nothing more)
    if (R.ground) R.ground.length = 0;
    for (const m of R.mobs || []) m.dead = true;
    R.boss = null; R.bossReady = false; R.bossIn = null; R.bossHold = 0; R.march = null; R.combo = 0; R.wisp = null; R.wave = null;
    R.lastStand = null; R.doomAt = null; R.ward = 0; R.cine = 0; R.zoneT = 0; R.runRng = null;
    if (R.pw) for (const k in R.pw) R.pw[k] = 0;
    if (R.town) { R.town = false; emit('town', false); }
    if (G.worldClear) G.worldClear();
    if (G.heroReset) G.heroReset(true);
    if (G.fieldWavesClear) G.fieldWavesClear();
    // (the pacing director forgets the old run's big moments: an invasion or an event cut short never ended there)
    if (G.director) G.director.end();
    G.dirty(); G.recalc();
  }
  G.runReset = () => resetRun(S_());
  // the Codex (S.codex: {q: {n: copies collected, rank, relic}}): a duplicate ranks it up, to G.codexCap() (2; the
  // Museum raises it: the meta's)
  G.codexCap = G.codexCap || (() => 2);
  function codexAdd(S, q, n, relic) {
    if (!q || !(n > 0)) return;
    const c = (S.codex = S.codex || {})[q] || (S.codex[q] = { n: 0, rank: 0, relic: relic ? 1 : 0 });
    c.n += n; c.rank = Math.min(relic ? 2 : G.codexCap(), c.n);
  }
  G.codexAdd = (q, n, relic) => codexAdd(S_(), q, n == null ? 1 : n, relic);

  // ---------- Start ----------
  // setup: { btn, cls, heat, keeps: [codex ids], first: land id, day: 'YYYY-MM-DD' (the Daily), seed }; missing fields
  // come from the last setup (AGAIN). Returns the run, or null.
  G.runStart = function (setup) {
    const S = S_();
    if ((S.run && S.run.on) || S.fallen) return null;
    const last = S.lastSetup || {};
    setup = Object.assign({ btn: 'classic', cls: null, heat: 0, keeps: [], first: null }, last, { day: '', seed: null }, setup || {});
    if (!G.CLASS_BY_ID[setup.cls]) setup.cls = (S.hero && G.CLASS_BY_ID[S.hero.cls] && S.hero.cls) || (G.CLASS_BY_ID[last.cls] && last.cls) || 'knight';
    // (the Daily Siege is fixed at its own Heat, open or not; no keepsakes)
    setup.heat = setup.day ? clamp(setup.heat | 0, 0, G.TORMENT_MAX) : clamp(setup.heat | 0, 0, G.tormentMax());
    if (setup.day) setup.keeps = [];
    resetRun(S);
    S.st.sieges = (S.st.sieges || 0) + 1;
    const r = S.run = newRun(setup, S.st.sieges);
    r.route = defaultRoute(setup.first);
    S.torment = r.heat;
    // (AGAIN repeats an ordinary setup, never the Daily)
    if (!setup.day) S.lastSetup = { btn: r.btn, cls: setup.cls, heat: r.heat, keeps: r.keeps.slice(), first: setup.first || null };
    else {
      const ds = S.dailySiege && S.dailySiege.day === setup.day ? S.dailySiege : (S.dailySiege = { day: setup.day, tries: 0 });
      r.ranked = ds.tries === 0 ? 1 : 0; ds.tries++;
    }
    const T = G.heat(), hall = S.legacy || {};
    r.pipMax = T.pips || TUNE.pips; r.pips = r.pipMax;
    // the Hall of Fame's run knobs: Second Wind (+1 pip, not at Heat 10), Reroll, Banish, Relic Belt
    if (!T.pips) r.pipMax += hall.hf_wind | 0;
    r.rerolls += hall.hf_reroll | 0; r.banish += hall.hf_banish | 0; r.beltMax += hall.hf_belt | 0;
    // the Warden: the class's starter weapon at item level 0 (and a welcome pack of Horde on the field)
    G.chooseClass(setup.cls);
    // the meta adds its part here (the Hall's Second Wind, rerolls and banishes, keepsakes, the Alchemist's potions, the
    // Tavern V companion, the Button's rule and starting card): change r (pipMax, rerolls, banish, beltMax, mendBonus, belt)
    emit('runSetup', r, setup);
    r.pipMax = clamp(r.pipMax | 0, 1, TUNE.pipCap); r.pips = r.pipMax;
    G.dirty(); G.recalc();
    G.mendRefill();
    // Heat 4: the Button starts at 80%
    S.hero.hp = G.D.heroHp * T.startHp; S.hero.whp = G.D.wardenHp;
    G.fillQuests();
    if (G.director) G.director.hold(2);
    emit('runStart', r);
    return r;
  };
  // AGAIN: the last setup
  G.runAgain = setup => G.runStart(Object.assign({}, S_().lastSetup || {}, setup || {}));
  // ---------- The Daily Siege (DESIGN §6.5): one seed a UTC day for everyone, a fixed Button and class at Heat 2, no
  // keepsakes, no Continue; only offers are seeded (G.runRng), combat stays on G.rng. The first attempt is ranked: +50
  // Fame and +5 Gems, and its result goes out as 'dailyResult' {day, zones, secs, btn, cls, heat, seed} (js/daily.js posts it)
  const hashStr = str => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; };
  G.hashStr = G.hashStr || hashStr;
  G.DAILY_SIEGE = { heat: 2, btn: 'classic', classes: ['knight', 'archer', 'wizard'], fame: 50, gems: 5 };
  G.dailySetup = function (day) {
    day = day || (G.utcDayKey ? G.utcDayKey() : G.todayKey());
    const seed = hashStr('bttn-siege|' + day), D = G.DAILY_SIEGE;
    return { day, seed, btn: D.btn, cls: D.classes[seed % D.classes.length], heat: D.heat, keeps: [], first: null };
  };
  G.runDaily = day => G.runStart(G.dailySetup(day));
  // the camp's Extract (the camp stream's button): bank the Embers at x1
  G.runExtract = () => (on() ? G.runEnd('extract') : null);
  G.runAbandon = () => (on() ? G.runEnd(S_().fallen ? 'fall' : 'abandon') : null);

  // ---------- End ----------
  G.runEnd = function (kind) {
    const S = S_(), r = runOf();
    if (!r || !r.on) return null;
    if (!G.EMBERS.end[kind]) kind = 'abandon';
    if (S.fallen && kind === 'abandon') kind = 'fall';
    S.fallen = null;
    // loot still on the ground goes into the bag first: it burns with the rest
    if (G.pickupAll) G.pickupAll();
    if (kind === 'win') r.won = 1;
    // the Daily's first attempt pays its Fame (and Gems below), however it ends
    if (r.day && r.ranked && !r.fame.daily) fameAdd('daily', G.DAILY_SIEGE.fame);
    const fame = fameNow(r, kind), embers = embersNow(r, kind);
    const h = S.hero, perks = Object.entries(h.perks || {}).filter(([k]) => !k.startsWith('evo_')).sort((a, b) => b[1] - a[1]);
    const codex = [];
    for (const q in S.uq || {}) if ((S.uq[q] | 0) > (r.uq0[q] | 0)) codex.push({ q, isNew: !r.uq0[q], n: S.uq[q] | 0, relic: 0 });
    const rn = (S.rec && S.rec.relicN) || {};
    for (const q in rn) if ((rn[q] | 0) > (r.relic0[q] | 0)) codex.push({ q, isNew: !r.relic0[q], n: rn[q] | 0, relic: 1 });
    const sum = {
      kind, win: kind === 'win', n: r.n, id: r.id, seed: r.seed, code: G.runCode(r), day: r.day, btn: r.btn, cls: h.cls, heat: r.heat,
      assisted: r.assisted, conts: r.conts, depth: S.depth, maxDepth: S.maxDepth | 0, cleared: r.cleared | 0, lords: r.lords, acts: r.acts,
      route: r.route.slice(), land: (G.runLand(S.depth) || {}).id || '', secs: Math.round(r.secs), field: Math.round(r.field), par: G.runPace(),
      lvl: h.lvl, party: (S.party || []).map(m => m.cls), cards: perks.slice(0, 3).map(([k, v]) => ({ id: k, n: v })), cardsN: r.cards | 0,
      evos: Object.keys(h.perks || {}).filter(k => k.startsWith('evo_')).map(k => k.slice(4)),
      pips: r.pips, pipMax: r.pipMax, wipes: r.wipes | 0, keeps: r.keeps.slice(),
      fame, embers, cause: kind === 'fall' ? r.cause || 'overrun' : kind === 'abandon' ? 'abandon' : null, nearMiss: nearMiss(r, kind),
      // the meta fills these at 'runEnding' (Deeds done, content unlocked, the next unlock and its progress)
      unlocked: [], next: [], deeds: r.deeds.slice(), codex, sticker: kind === 'win' && fame.lines.some(l => l.k === 'sticker'), at: Date.now(),
    };
    emit('runEnding', sum, r);
    if (r.day) {
      sum.daily = { day: r.day, zones: r.cleared | 0, secs: Math.round(r.secs), btn: r.btn, cls: h.cls, heat: r.heat, seed: r.seed, assisted: r.assisted, ranked: r.ranked, kind };
      if (r.ranked && G.addGems) G.addGems(G.DAILY_SIEGE.gems, 'dailySiege');
    }
    // pay: Fame (a fall never costs it), the Embers
    S.fame = (S.fame || 0) + fame.total; S.fameTotal = (S.fameTotal || 0) + fame.total;
    G.addEmbers(embers.total, 'run');
    // records
    S.st.sieges = Math.max(S.st.sieges || 0, r.n);
    if (kind === 'fall') S.st.deaths = (S.st.deaths || 0) + 1;
    if (kind === 'win') S.st.siegeWins = (S.st.siegeWins || 0) + 1;
    if (kind === 'extract') S.st.extracts = (S.st.extracts || 0) + 1;
    // (asc_1/5/25 count wins and the extracts made at Camp 4 or later: a land-1 extract can't farm them)
    if (kind === 'win' || (kind === 'extract' && (r.cleared | 0) >= 4 * SIZE())) S.ascensions = (S.ascensions || 0) + 1;
    if (kind === 'win' && !r.assisted) {
      if (r.heat > (S.heatWon == null ? -1 : S.heatWon)) {
        S.heatWon = r.heat; sum.heatOpen = Math.min(G.TORMENT_MAX, r.heat + 1);
        if (r.heat < G.TORMENT_MAX) sum.unlocked.push({ kind: 'heat', n: sum.heatOpen });
      }
      const stk = S.heatStk[r.btn];
      if (!(stk != null && stk >= r.heat)) S.heatStk[r.btn] = r.heat;
    }
    // the Hall of the Fallen: the last 12 Wardens (wins get gold plaques)
    S.fallen12 = (S.fallen12 || []).concat([{ n: r.n, cls: h.cls, btn: r.btn, heat: r.heat, land: sum.land, depth: S.depth, cleared: r.cleared | 0,
      kind, cause: sum.cause, cards: sum.cards.map(c => c.id), keep: r.keeps[0] || null, win: sum.win ? 1 : 0, at: sum.at }]).slice(-12);
    // the next goals the summary shows (after the meta's own at 'runEnding'): the cheapest Hall of Fame rank and town level
    // not yet owned, with what the player has toward them
    {
      const hn = G.LEGACY.filter(l => (S.legacy[l.id] | 0) < l.max).map(l => ({ l, c: G.legacyCost(l) })).sort((a, b) => a.c - b.c)[0];
      if (hn) sum.next.push({ kind: 'hall', id: hn.l.id, name: hn.l.name, rank: (S.legacy[hn.l.id] | 0) + 1, have: Math.floor(S.fame), need: hn.c });
      const bn = (G.BLD || []).filter(b => G.bldLvl(b.id) < G.BLD_MAX).map(b => ({ id: b.id, c: G.bldCost(b.id) })).sort((a, b) => a.c - b.c)[0];
      if (bn) sum.next.push({ kind: 'town', id: bn.id, lvl: G.bldLvl(bn.id) + 1, have: Math.floor(S.embers), need: bn.c });
    }
    // the Codex: every unique and relic touched this run, even on a fall (a duplicate ranks it up)
    for (const c of codex) codexAdd(S, c.q, c.n - ((c.relic ? r.relic0 : r.uq0)[c.q] | 0), c.relic);
    S.lastRun = sum;
    // the full reset (party, Warden, gear, bag, shards, orbs, the run's economy, depth 0, every run modifier)
    r.on = 0; r.phase = 'ended';
    resetRun(S);
    S.run = { on: 0, phase: 'summary', n: r.n };
    G.fillQuests();
    // the 3.x clean-ups (blessings, champions, perks2, spells, rare visitors, mobs2, stage) listen to 'ascend'
    emit('ascend', fame.total, kind === 'fall' || kind === 'abandon');
    emit('runSummary', sum);
    if (sum.daily && sum.daily.ranked && !sum.daily.assisted) emit('dailyResult', sum.daily);
    if (TUNE.runAgainAuto && !G.runUI && S.hero && S.hero.cls) G.runAgain();
    return sum;
  };

  // ---------- 3.x leftovers inside a Siege ----------
  // the run blessings are retired (their effects become Button rules and Power-shrine boons; recalc applies none in a
  // Siege), but the 3.x page still offers the cards after a run: Reckless would start the run a land deeper. Not here.
  G.on('bless', b => {
    const S = S_(), r = runOf();
    if (!b || !r || !r.on || b.id !== 'reckless') return;
    S.depth = Math.max(0, S.depth - SIZE()); S.maxDepth = Math.max(r.maxDepth | 0, S.depth); S.bossMeter = 0;
    G.dirty();
  });

  // ---------- A reload ----------
  // a Siege carries on from the start of the zone it was in: the clear bar from zero, no boss up, no march; a beat that
  // was on screen is asked to come back (its resume), or skipped if no module claims it. A summary nobody will show
  // (no run UI) goes straight into the next run.
  G.runResume = function () {
    const S = S_();
    let r = S.run;
    if (!r || typeof r !== 'object') r = S.run = { on: 0, phase: 'setup' };
    if (!r.on) {
      if (r.phase === 'summary' && TUNE.runAgainAuto && !G.runUI && S.hero && S.hero.cls && !S.fallen) G.runAgain();
      return;
    }
    S.bossMeter = 0; R.zoneT = 0; R.march = null; R.boss = null; R.bossReady = false; R.bossIn = null;
    if (!Array.isArray(r.route) || r.route.length < SG().lands) r.route = defaultRoute();
    if (r.phase !== 'field') {
      const bt = r.beat, B = bt && bt.id ? BEAT_BY_ID[bt.id] : null;
      if (B && B.resume) { try { B.resume(bt.ctx); } catch (e) { if (typeof console !== 'undefined') console.error('beat resume', e); } }
      else if (!B) { if (bt) bt.id = null; else r.beat = null; if (bt) nextBeat(); else G.runPhase('field'); }
    }
    emit('runResume', r);
  };

  // ---------- Season 3: the founders' gift (DESIGN §11) ----------
  // G.foundersGift(old, s): an earlier season's save (old, parsed) written into the fresh season-3 state s, before s
  // replaces it (game.js deserialize). Pure: reads old, writes s only. Returns the gift's account (also s.founders,
  // for the one-time 'Season 3: The Siege' modal).
  //   kept 1:1: Gems; pets, eggs, pity, pulls, active pets; achievements (their Gems already paid); the collection
  //   (coll, opened, modsSeen, uq), rec.evos, the bestiary (seen), the daily streak, the Journey, lifetime stats,
  //   land stars (completion marks), the tutorial done, the skin
  //   archived (S.rec.s2, shown in Records): maxLevel, crowns, madTime, bestDepth, Torment, Rift records, fameTotal, firsts
  //   burned at x1 (the 4.0 Furnace, an honest extract): worn gear (Warden and companions) and the bag, shards/25 and
  //   orbs, capped at FOUNDERS.gear Embers; the town's levels at FOUNDERS.town each; the whole gift capped at FOUNDERS.cap
  //   Fame: min(FOUNDERS.fameCap, fameTotal x FOUNDERS.fameK)
  //   uniques and relics held: Codex entries (duplicates rank up, rank 2 at most), keepsake-eligible
  //   companions: their classes unlocked for the Warden, Tavern residents, Camp 1 veterans in runs 1-3 (s.founders.classes)
  //   a Founder skin when the old save played over 30 minutes
  //   dropped (run-scoped): gold, upgrades, the Garrison, the Constellation, essence, depth, potions, legacy
  G.FOUNDERS = { gear: 3000, town: 40, cap: 6000, fameK: 0.02, fameCap: 1000, rank: 2, skinSecs: 1800 };
  G.foundersGift = function (old, s) {
    if (!old || typeof old !== 'object' || !s || typeof s !== 'object') return null;
    const F = G.FOUNDERS;
    const num = v => (typeof v === 'number' && isFinite(v) && v > 0 ? v : 0);
    const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
    const oh = obj(old.hero) || {}, ost = obj(old.st) || {}, orec = obj(old.rec) || {};
    const gift = { season: G.WIPE, from: old.wipe | 0, at: Date.now(), embers: { items: 0, itemsN: 0, shards: 0, orbs: 0, gear: 0, town: 0, townLvls: 0, total: 0 },
      fame: 0, fameOld: num(old.fameTotal), gems: 0, codex: [], classes: [], residents: [], skin: null, shown: 0 };
    // ---- kept
    s.gems = Math.floor(num(old.gems)); gift.gems = s.gems;
    const pets = obj(old.pets) || {};
    s.pets = {};
    for (const id in pets) { const p = obj(pets[id]); if (p && G.PET_BY_ID && G.PET_BY_ID[id]) s.pets[id] = { lvl: Math.max(1, Math.min(G.PET_MAX_LEVEL || 25, p.lvl | 0)), n: Math.max(1, p.n | 0), gold: !!p.gold }; }
    s.active = Array.isArray(old.active) ? old.active.filter(id => s.pets[id]).slice(0, 4) : [];
    s.eggs = Math.floor(num(old.eggs)); s.pulls = Math.floor(num(old.pulls));
    const pity = obj(old.pity); if (pity) s.pity = { l: pity.l | 0, d: pity.d | 0 };
    if (obj(old.ach)) s.ach = Object.assign({}, old.ach);
    const coll = obj(old.coll) || {};
    s.coll = {}; for (const id in coll) if (G.ITEM_BY_ID[id] && num(coll[id])) s.coll[id] = Math.floor(coll[id]);
    if (Array.isArray(old.opened) && old.opened.length === 7) s.opened = old.opened.map(v => Math.floor(num(v)));
    if (obj(old.modsSeen)) s.modsSeen = Object.assign({}, old.modsSeen);
    const ouq = obj(old.uq) || {};
    s.uq = {}; for (const q in ouq) if (G.UNIQUES[q] && num(ouq[q])) s.uq[q] = Math.floor(ouq[q]);
    if (obj(old.daily)) s.daily = { last: String(old.daily.last || ''), streak: old.daily.streak | 0 };
    s.journey = old.journey | 0;
    s.questsDone = old.questsDone | 0;
    if (obj(old.jp)) s.jp = { n: old.jp.n | 0, at: num(old.jp.at) };
    s.st = s.st || {};
    for (const k in ost) if (typeof ost[k] === 'number' && isFinite(ost[k])) s.st[k] = ost[k];
    s.seen = Object.assign({}, obj(old.seen) || {});
    if (typeof old.tut === 'number') s.tut = old.tut;
    if (typeof old.skin === 'string') s.skin = old.skin;
    const lands = obj(old.lands) || {};
    s.lands = {}; for (const i in lands) { const L = obj(lands[i]); if (L) s.lands[i] = { k: Math.floor(num(L.k)), s: L.s & 7 }; }
    s.rec = s.rec || {};
    s.rec.evos = Object.assign({}, obj(orec.evos) || {});
    // ---- archived (Records)
    const orf = obj(old.rift) || {};
    s.rec.s2 = { maxLevel: orec.maxLevel | 0, crowns: Object.assign({}, obj(orec.crowns) || {}), madTime: num(orec.madTime), bestDepth: old.bestDepth | 0,
      torment: old.torment | 0, rift: { best: orf.best | 0, bestT: num(orf.bestT) }, fameTotal: num(old.fameTotal), ascensions: old.ascensions | 0,
      maxPower: num(orec.maxPower), firsts: Object.assign({}, obj(orec.firsts) || {}), stars: Object.keys(s.lands).reduce((a, i) => a + ((s.lands[i].s & 1) + ((s.lands[i].s >> 1) & 1) + ((s.lands[i].s >> 2) & 1)), 0) };
    // ---- burned: worn gear, the bag, shards and orbs (x1), capped
    const items = [];
    const eqOf = e => (obj(e) ? G.SLOTS.map(k => e[k]) : []);
    for (const g of eqOf(oh.eq)) items.push(g);
    for (const m of Array.isArray(old.party) ? old.party : []) if (obj(m)) for (const g of eqOf(m.eq)) items.push(g);
    for (const g of Array.isArray(oh.bag) ? oh.bag : []) items.push(g);
    const codexN = {};
    for (const g of items) {
      if (!obj(g) || !G.ITEM_BY_ID[g.id]) continue;
      const it = { id: g.id, r: Math.max(0, Math.min(6, g.r | 0)), il: Math.max(0, Math.min(200, g.il | 0)), e: Math.max(0, Math.min(G.ENCHANT_MAX || 20, g.e | 0)), q: g.q && G.UNIQUES[g.q] ? g.q : null };
      gift.embers.items += G.itemEmbers(it); gift.embers.itemsN++;
      if (it.q) codexN[it.q] = (codexN[it.q] || 0) + 1;
    }
    gift.embers.shards = Math.floor(num(oh.shards) / G.EMBERS.shard);
    const orbs = obj(oh.orbs) || {};
    for (const k in G.EMBERS.orb) gift.embers.orbs += Math.floor(num(orbs[k])) * G.EMBERS.orb[k];
    gift.embers.items = Math.round(gift.embers.items);
    gift.embers.gear = Math.min(F.gear, gift.embers.items + gift.embers.shards + gift.embers.orbs);
    // ---- the town: its levels
    const bld = obj(old.bld) || {};
    for (const id in bld) gift.embers.townLvls += Math.max(0, Math.min(G.BLD_MAX || 5, bld[id] | 0));
    gift.embers.town = gift.embers.townLvls * F.town;
    gift.embers.total = Math.min(F.cap, gift.embers.gear + gift.embers.town);
    s.embers = (s.embers || 0) + gift.embers.total; s.emberTotal = (s.emberTotal || 0) + gift.embers.total;
    // ---- Fame (old Hall of Fame levels are covered by this)
    gift.fame = Math.min(F.fameCap, Math.floor(num(old.fameTotal) * F.fameK));
    s.fame = (s.fame || 0) + gift.fame; s.fameTotal = (s.fameTotal || 0) + gift.fame;
    // ---- the Codex: every unique and relic held (duplicates rank up, rank 2 at most)
    s.codex = s.codex || {};
    for (const q in codexN) {
      const relic = !!(G.UNIQUES[q] && G.UNIQUES[q].relic);
      const c = s.codex[q] || (s.codex[q] = { n: 0, rank: 0, relic: relic ? 1 : 0 });
      c.n += codexN[q]; c.rank = Math.min(F.rank, c.n);
      gift.codex.push({ q, n: codexN[q], rank: c.rank, relic: relic ? 1 : 0 });
    }
    // ---- companions: their classes for the Warden, Tavern residents, Camp 1 veterans
    const cls = new Set();
    if (oh.cls && G.CLASS_BY_ID[oh.cls]) cls.add(oh.cls);
    for (const m of Array.isArray(old.party) ? old.party : []) if (obj(m) && G.CLASS_BY_ID[m.cls]) { cls.add(m.cls); gift.residents.push(m.cls); }
    gift.classes = Array.from(cls);
    // ---- the Founder skin
    if (num(ost.playTime) > F.skinSecs) gift.skin = 'founder';
    s.founders = gift;
    return gift;
  };
})(globalThis.G = globalThis.G || {});
