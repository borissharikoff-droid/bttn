// BTTN 4.0 — powers (Marks): the special effects Mythic and Divine items carry, on whoever in the party wears them.
// DOM-free: runs in the Node playtests (tools/bot.js). Loaded after relic.js.
//
// ADDENDUM 1 (the loot map's part D): a Mythic item rolls 1 Mark (tier I 70% / II 30%), a Divine 2 different ones (tier II
// 60% / III 40%); uniques and relics keep their rule and get none; common..legendary nothing. An item carries g.px =
// [[id, tier], ...] (tiers 1-3). heroFinish (hero.js) gathers the whole party's worn gear into D.px = {id: best tier}: a
// Mark works party-wide whoever wears it, and the same Mark twice doesn't stack (the higher tier counts). Not in the ladder
// snapshot (hero.js G.gearSnapshot copies id/r/il/e/a/c/q only), so the server and verifySnapshot are untouched.
// Every effect goes through the hit / kill / bite / tick / stats / click hooks and the game's events; the per-hit and
// per-kill work is gated by token buckets (the perks2.js pattern) so a frame never does unbounded work.
//
// (G.POWERS is the Hand's Smite / Ward / Mend in game.js: the item powers are G.MARKS)
// API: G.MARKS[id] = {name, slots, v: [I, II, III], desc ('{0}' is the tier's value)}; G.MARK_IDS; G.rollMarks(slot, r,
//   rng) -> [[id, tier]] | null; G.markName(id), G.markText(id, tier), G.markInfo(id, tier) -> {id, tier, roman, name,
//   text, slots}; G.itemMarks(g) -> [markInfo]; G.markOn(id) -> the party's tier (0 = off); G.markItem(id, tier, il, slot)
//   -> a divine carrying that Mark (tests, a debug console).
// Events (for the stage; nobody has to listen): 'pwArc'(from, list) Stormlash, 'pwReap'(m) Reaper's Mark, 'pwSurge'(m, list)
//   Overcharge's splash, 'pwGold'(m, gold) Gilded Death, 'pwPhoenix'(who) Phoenix Heart, 'pwBolt'(list, boss) Thunderclap,
//   'pwSpike'(m) Spiked Bulwark, 'pwMeteor'(m, r, n) Meteor Herald, 'pwEcho'(type) Echo Cast, 'pwBreak'(b, dmg) Boss Breaker,
//   'pwNose'(m, embers) Treasure Nose, 'pwLight'(on) Last Light, 'pwEngine'(pct) Frenzy Engine (its stacks, in 5% steps).
(function (G) {
  'use strict';
  if (!G.hook || !G.TUNE) return; // needs hero.js
  const R = G.R;
  const emit = (...a) => G.emit(...a);
  const rng = () => G.rng();

  // ---------- The Marks ----------
  // slots: where it can roll ('any' = every slot). v: the tier I/II/III value its text shows
  // (names: the loot map's, except two that met an older name: Midas Touch is an evolution and Thunder Palm a Star Chart
  // node, so they are Gilded Death and Thunderclap here)
  G.MARKS = {
    stormlash:   { slots: ['weapon'], v: [3, 5, 7], name: 'Stormlash', desc: 'Every 4th attack arcs to {0} more mobs at 60%' },
    reaper:      { slots: ['weapon'], v: [8, 12, 16], name: 'Reaper’s Mark', desc: 'Hits execute mobs under {0}% health (not bosses)' },
    overcharge:  { slots: ['weapon', 'ring'], v: [40, 70, 100], name: 'Overcharge', desc: 'Crits +{0}% and splash a quarter of it' },
    giantslayer: { slots: ['any'], v: [20, 35, 50], name: 'Giantslayer', desc: '+{0}% damage to bosses, champions, rares and tanks' },
    gilded:      { slots: ['ring'], v: [1, 1.5, 2], name: 'Gilded Death', desc: 'Kills: {0}% to burst into 5× gold' },
    phoenix:     { slots: ['armor'], v: [50, 75, 100], name: 'Phoenix Heart', desc: 'Once a zone the first hero to fall rises at {0}%' },
    thunderclap: { slots: ['ability', 'ring'], v: [20, 16, 12], name: 'Thunderclap', desc: 'Every {0}th click: a 6× bolt on 5 mobs' },
    glacial:     { slots: ['armor'], v: [15, 25, 35], name: 'Glacial Aura', desc: 'Mobs near the Button walk {0}% slower' },
    spiked:      { slots: ['armor'], v: [150, 250, 400], name: 'Spiked Bulwark', desc: 'Biters take {0}% of your hit' },
    bloodsong:   { slots: ['any'], v: [0.05, 0.08, 0.12], name: 'Bloodsong', desc: 'Kills mend the Button {0}% (small fry less)' },
    engine:      { slots: ['weapon'], v: [15, 25, 40], name: 'Frenzy Engine', desc: 'Kills: +0.5% attack speed for 5s, up to +{0}%' },
    lastlight:   { slots: ['any'], v: [40, 60, 90], name: 'Last Light', desc: 'Under 35% Button health: +{0}% damage' },
    meteor:      { slots: ['ability'], v: [10, 8, 6], name: 'Meteor Herald', desc: 'Every {0}s a 12× meteor on the thickest pack' },
    echo:        { slots: ['ability'], v: [20, 30, 40], name: 'Echo Cast', desc: 'Abilities recharge {0}% faster; may cast twice' },
    breaker:     { slots: ['weapon'], v: [5, 8, 12], name: 'Boss Breaker', desc: 'Each boss phase tears off {0}% of its health' },
    nose:        { slots: ['ring'], v: [1, 2, 3], name: 'Treasure Nose', desc: 'Rares, champions, Hoarders: +2 Embers; II: +1 lord loot card; III: a rarer one' },
    ember:       { slots: ['any'], v: [25, 50, 100], name: 'Ember Heart', desc: 'Burning pays +{0}% Embers' },
  };
  G.MARK_IDS = Object.keys(G.MARKS);
  // (the screens' words for Marks; the Marks' names and texts are on G.MARKS, where i18n_ru.js patches content names)
  if (G.tAdd) G.tAdd({ mark: 'Mark', marks: 'Marks', mark_tier: 'Tier {0}', mark_party: 'Works for the whole party', mark_none: 'No Mark' });
  // the second numbers some Marks need (per tier)
  const ECHO_TWICE = [0.15, 0.25, 0.35];
  const ROMAN = ['', 'I', 'II', 'III'];
  Object.assign(G.TUNE, {
    // Mythic: 1 Mark, tier I pwMythic[0] of the time else II; Divine: 2 different Marks, tier II pwDivine[0] else III
    // (marks 0: no item rolls a Mark - a balance lever and an A/B switch for the sweeps)
    marks: 1, pwMythic: [0.7, 0.3], pwDivine: [0.6, 0.4],
    // Stormlash every pwArcEvery attacks at pwArcK of the hit; Overcharge's splash share and radius; Meteor's hit and radius
    pwArcEvery: 4, pwArcK: 0.6, pwArcR: 0.45, pwSurgeK: 0.25, pwSurgeR: 0.08, pwMeteorK: 12, pwMeteorR: 0.15,
    pwBoltK: 6, pwBoltN: 5, pwGoldK: 5, pwLight: 0.35, pwEngStep: 0.005, pwEngLapse: 5, pwNose: 2,
  });

  G.markName = id => (G.MARKS[id] ? G.MARKS[id].name : id);
  G.markText = function (id, tier) {
    const P = G.MARKS[id];
    if (!P) return '';
    const v = P.v[Math.max(0, Math.min(2, (tier | 0) - 1))];
    return String(P.desc).replace('{0}', String(v));
  };
  G.markInfo = (id, tier) => ({ id, tier: tier | 0, roman: ROMAN[tier | 0] || '', name: G.markName(id), text: G.markText(id, tier), slots: (G.MARKS[id] || {}).slots || [] });
  // (the loot map called them powers: the same functions under that name, for anyone looking for them)
  G.rollPowers = (...a) => G.rollMarks(...a);
  G.itemPowers = g => G.itemMarks(g);
  G.itemMarks = g => (g && Array.isArray(g.px) ? g.px.filter(x => Array.isArray(x) && G.MARKS[x[0]]).map(([id, t]) => G.markInfo(id, t)) : []);

  // ---------- Rolling ----------
  // the Marks an item of this slot and rarity rolls (r 5 mythic, 6 divine), from rnd (the loot moment passes the offers'
  // stream, so a Daily deals the same Marks to everyone)
  G.rollMarks = function (slot, r, rnd) {
    if (!(r >= 5) || !G.TUNE.marks) return null;
    rnd = rnd || rng;
    const pool = G.MARK_IDS.filter(id => { const s = G.MARKS[id].slots; return s.includes('any') || s.includes(slot); });
    const n = r >= 6 ? 2 : 1, out = [];
    for (let i = 0; i < n && pool.length; i++) {
      const id = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
      const tier = r >= 6 ? (rnd() < G.TUNE.pwDivine[0] ? 2 : 3) : (rnd() < G.TUNE.pwMythic[0] ? 1 : 2);
      out.push([id, tier]);
    }
    return out.length ? out : null;
  };
  // a divine carrying this Mark (tests, a debug console): of a slot it can roll in (the given one if it fits)
  G.markItem = function (id, tier, il, slot) {
    const P = G.MARKS[id];
    if (!P) return null;
    const ok = s => P.slots.includes('any') || P.slots.includes(s);
    const sl = slot && ok(slot) ? slot : P.slots[0] === 'any' ? 'ring' : P.slots[0];
    const base = (G.ITEMS_BY_RARITY[6] || []).find(it => G.slotOf(it.id) === sl) || G.ITEMS.filter(it => G.slotOf(it.id) === sl).sort((a, b) => b.r - a.r)[0];
    if (!base) return null;
    const g = G.makeGear(base.id, il == null ? G.S.depth : il);
    g.px = [[id, Math.max(1, Math.min(3, tier | 0 || 3))]];
    return g;
  };

  // ---------- The party's Marks (D.px, built in hero.js heroFinish) ----------
  let P = {}, pxN = 0, hitOn = false;
  function refresh(px) {
    P = px || {}; pxN = 0;
    for (const k in P) if (P[k] > 0) pxN++;
    hitOn = !!(P.giantslayer || P.overcharge || P.reaper);
  }
  G.markOn = id => (G.D && G.D.px && G.D.px[id]) | 0;
  const val = (id, i) => G.MARKS[id].v[Math.max(0, Math.min(2, (P[id] | 0) - 1))] * (i || 1);

  // ---------- Budgets (perks2.js): per-second token buckets, so a crowd of a thousand never costs a frame ----------
  const bucket = (rate, cap) => ({ rate, cap, v: cap });
  // (blood: Bloodsong's mending, in brute-kills a second: tier III mends at most 1.2% of the Button a second)
  const B = { arc: bucket(8, 4), surge: bucket(12, 6), reap: bucket(10, 5), gold: bucket(3, 2), spike: bucket(30, 12), nose: bucket(4, 3), blood: bucket(10, 5) };
  const take = b => (b.v >= 1 ? (b.v -= 1, true) : false);
  const SMALL = k => !!(G.SMALL && G.SMALL[k]);
  const DIRECT = { auto: 1, hero: 1, ally: 1, click: 1, pet: 1 };
  const alive = m => m && !m.dead && !m.gone && m.p > -0.05;
  // n random live mobs (not in skip), cheap with a thousand on the field
  function someMobs(n, skip) {
    const out = [], L = R.mobs || [];
    for (let tries = 0; out.length < n && tries < n * 4 && L.length; tries++) {
      const m = L[Math.floor(rng() * L.length)];
      if (alive(m) && !out.includes(m) && !(skip && skip.has(m)) && m.kind !== 'guardian') out.push(m);
    }
    return out;
  }
  const mobById = id => { const L = R.mobs || []; for (let i = 0; i < L.length; i++) if (L[i].id === id) return L[i]; return null; };
  const big = m => m.kind === 'rare' || m.kind === 'tank' || m.kind === 'guardian' || (m.champ && !m.decoy);
  let inHook = 0, T = 0;

  // ---------- On hit: Giantslayer, Overcharge, Reaper's Mark ----------
  G.hook('hit', (m, dmg, src, crit) => {
    if (!hitOn || !m || m.dead) return;
    let d = dmg;
    if (P.giantslayer && big(m)) d *= 1 + val('giantslayer') / 100;
    if (P.overcharge && crit && DIRECT[src]) {
      d *= 1 + val('overcharge') / 100;
      // a quarter of the charged crit splashes round it (one level deep)
      if (!inHook && G.mobsAround && take(B.surge)) {
        const list = G.mobsAround([m], G.TUNE.pwSurgeR).filter(o => !o.dead).slice(0, 12);
        if (list.length) {
          emit('pwSurge', m, list);
          inHook++;
          try { for (const o of list) G.dealHit(o, d * G.TUNE.pwSurgeK, 'power', false); } finally { inHook--; }
        }
      }
    }
    if (P.reaper && m.kind !== 'guardian') {
      const line = val('reaper') / 100 * (m.kind === 'rare' || m.kind === 'hoard' ? 0.5 : 1);
      const eff = m.mod === 'stone' || m.stone ? d * 0.5 : d;
      if (m.hp > eff && m.hp - eff < m.max * line) {
        d = m.hp * 20 + 1;
        if (!SMALL(m.kind) && take(B.reap)) emit('pwReap', m);
      }
    }
    return d;
  });
  // (Giantslayer against bosses: D.bossMult, in the stats hook below - every blow on a boss is multiplied by it, and the
  // least fight length (game.js bossMax) sees it, so a lord stays the run's check)

  // ---------- Stormlash: every 4th attack of the party arcs ----------
  let swings = 0;
  function arc(ev) {
    if (!P.stormlash || !ev || ev.extra) return;
    if (++swings % G.TUNE.pwArcEvery) return;
    const k = G.TUNE.pwArcK;
    // (at a boss the arc strikes it too)
    if (ev.boss && R.boss) { G.hitBoss(ev.dmg * k * (G.D.bossMult || 1)); emit('pwArc', null, []); return; }
    if (!ev.ids || !ev.ids.length || !take(B.arc)) return;
    const from = mobById(ev.ids[0]);
    if (!from) return;
    const n = val('stormlash'), skip = new Set([from]);
    let list = G.mobsAround ? G.mobsAround([from], G.TUNE.pwArcR).filter(o => !o.dead && o.kind !== 'guardian') : [];
    if (list.length > n) list = list.slice(0, n);
    for (const o of list) skip.add(o);
    if (list.length < n) list = list.concat(someMobs(n - list.length, skip));
    if (!list.length) return;
    emit('pwArc', from, list);
    inHook++;
    try { for (const o of list) G.dealHit(o, ev.dmg * k, 'chain', false); } finally { inHook--; }
  }
  G.on('heroAttack', ev => { if (ev && ev.src === 'auto') arc(ev); });
  G.on('allyAttack', ev => arc(ev));

  // ---------- On kill: Bloodsong, Frenzy Engine ----------
  let eng = 0, engLast = -9, engStep = 0;
  G.hook('kill', (m, src) => {
    if (!pxN || src === 'boss' || src === 'bite') return;
    const small = SMALL(m.kind);
    // Bloodsong: a kill mends the Button (a small one a third as much), from a budget of 10 big kills a second
    if (P.bloodsong && !(R.btnDown > 0)) {
      const w = small ? 0.3 : 1, b = B.blood;
      if (b.v >= w) { b.v -= w; const h = G.S.hero, D = G.D; if (h && D.heroHp) h.hp = Math.min(D.heroHp, h.hp + D.heroHp * val('bloodsong') / 100 * w); }
    }
    if (P.engine) {
      const cap = val('engine') / 100 / G.TUNE.pwEngStep;
      eng = Math.min(cap, eng + (small ? 0.1 * (m.ck || 1) : 1)); engLast = T;
      const st = Math.floor(eng * G.TUNE.pwEngStep * 20); // (5% steps: a recalc each, not one a kill)
      if (st !== engStep) { engStep = st; G.dirty(); emit('pwEngine', st * 5); }
    }
  });
  // Gilded Death and Treasure Nose: what a kill pays
  G.on('mobDie', (m, gold, chest, src) => {
    if (!pxN || !m || src === 'boss') return;
    if (P.gilded && gold > 0 && rng() < val('gilded') / 100 && take(B.gold)) { const g = gold * G.TUNE.pwGoldK; G.addGold(g, 'mob'); emit('pwGold', m, g); }
    if (P.nose && !m.add && (m.kind === 'rare' || m.kind === 'hoard' || (m.champ && !m.decoy)) && G.pouchAdd && take(B.nose)) {
      const v = G.pouchAdd(G.TUNE.pwNose, 'nose');
      if (v) emit('pwNose', m, v);
    }
  });

  // ---------- Bites: Spiked Bulwark ----------
  G.hook('bite', (m, who, dmg) => {
    if (P.spiked && m && !m.dead && who != null && take(B.spike)) {
      emit('pwSpike', m);
      G.dealHit(m, (G.D.heroHit || 0) * val('spiked') / 100, 'power', false);
    }
  });

  // ---------- Phoenix Heart: once a zone the first to fall rises ----------
  G.on('unitDown', who => {
    if (!P.phoenix || !G.reviveNow) return;
    const key = 'd' + G.S.depth + ':' + ((G.S.run && G.S.run.id) || '');
    if (R.pwPhoenix === key) return;
    R.pwPhoenix = key;
    G.reviveNow(who, val('phoenix') / 100);
    emit('pwPhoenix', who);
  });

  // ---------- Thunderclap: every Nth click ----------
  let clicks = 0;
  G.hook('click', () => {
    if (!P.thunderclap || R.stun > 0 || !G.S.hero || !G.S.hero.cls) return;
    if (++clicks % val('thunderclap')) return;
    const hit = (G.D.heroHit || 0) * G.TUNE.pwBoltK;
    if (R.boss) { G.hitBoss(hit * (G.D.bossMult || 1)); emit('pwBolt', [], true); return; }
    const list = someMobs(G.TUNE.pwBoltN);
    if (!list.length) return;
    emit('pwBolt', list, false);
    inHook++;
    try { for (const m of list) G.dealHit(m, hit, 'power', false); } finally { inHook--; }
  });

  // ---------- Echo Cast: faster abilities, now and then twice ----------
  let echoing = 0;
  G.on('ability', type => {
    if (!P.echo) return;
    R.abilCd = (R.abilCd || 0) * (1 - val('echo') / 100);
    if (echoing || !G.castAbility || rng() >= ECHO_TWICE[(P.echo | 0) - 1]) return;
    echoing = 1;
    const cd = R.abilCd;
    R.abilCd = 0;
    try { if (G.castAbility()) emit('pwEcho', type); } finally { R.abilCd = cd; echoing = 0; }
  });

  // ---------- Boss Breaker: a phase tears off a share of its health (once its phase shield drops) ----------
  G.on('bossPhase', b => { if (P.breaker && b) R.pwBreak = { b, k: val('breaker') / 100 }; });

  // ---------- The clock: Glacial Aura, Meteor Herald, Last Light, Frenzy Engine's lapse, Boss Breaker ----------
  let glT = 0, metT = 0, lit = false;
  G.hook('tick', dt => {
    T += dt;
    for (const k in B) { const b = B[k]; b.v = Math.min(b.cap, b.v + b.rate * dt); }
    if (!pxN) { if (lit) { lit = false; G.dirty(); } return; }
    const D = G.D, h = G.S.hero;
    // Glacial Aura: mobs past p 0.7 are slowed once (marked), checked four times a second
    if (P.glacial && (glT -= dt) <= 0) {
      glT = 0.25;
      const f = 1 - val('glacial') / 100, L = R.mobs || [];
      for (let i = 0; i < L.length; i++) { const m = L[i]; if (!m.pwG && m.p > 0.7 && !m.dead && m.sp > 0) { m.pwG = 1; m.sp *= f; } }
    }
    // Meteor Herald: on the thickest of a few packs near the front (or the boss)
    if (P.meteor && (metT -= dt) <= 0) {
      metT = val('meteor');
      const hit = (D.heroHit || 0) * G.TUNE.pwMeteorK;
      if (R.boss) { G.hitBoss(hit * 0.5 * (D.bossMult || 1)); emit('pwMeteor', null, G.TUNE.pwMeteorR, 1); }
      else {
        const cand = someMobs(8);
        let best = null, bl = null;
        for (const c of cand) { const l = G.mobsAround([c], G.TUNE.pwMeteorR); if (!bl || l.length > bl.length) { best = c; bl = l; } }
        if (best) {
          const list = [best].concat(bl.filter(o => !o.dead).slice(0, 60));
          emit('pwMeteor', best, G.TUNE.pwMeteorR, list.length);
          inHook++;
          try { for (const m of list) G.dealHit(m, hit, 'power', false); } finally { inHook--; }
        }
      }
    }
    // Last Light: the damage is in the stats hook; recalc only when it turns on or off
    const now = !!(P.lastlight && h && !(R.btnDown > 0) && D.heroHp > 0 && h.hp > 0 && h.hp < D.heroHp * G.TUNE.pwLight);
    if (now !== lit) { lit = now; G.dirty(); emit('pwLight', now); }
    // Frenzy Engine lapses
    if (eng > 0 && T - engLast > G.TUNE.pwEngLapse) { eng = 0; engStep = 0; G.dirty(); emit('pwEngine', 0); }
    // Boss Breaker: once the phase's shield is down
    const bk = R.pwBreak;
    if (bk) {
      if (R.boss !== bk.b || bk.b.dead) R.pwBreak = null;
      else if (!(bk.b.inv > 0)) { R.pwBreak = null; const amt = bk.b.max * bk.k; G.hitBoss(amt); emit('pwBreak', bk.b, amt); }
    }
  });

  // ---------- Stats: Frenzy Engine's speed, Last Light's damage, Ember Heart's Embers ----------
  // (they run out in seconds: kept out of the steady numbers a boss's health is measured by)
  G.hook('stats', d => {
    refresh(d.px);
    if (!pxN) return;
    if (P.ember) { const k = 1 + val('ember') / 100; d.itemEmb = (d.itemEmb || 1) * k; d.burnEmb = (d.burnEmb || 1) * k; }
    if (P.giantslayer) d.bossMult = (d.bossMult || 1) * (1 + val('giantslayer') / 100);
    const rm = P.engine && eng > 0 ? 1 + engStep * 0.05 : 1, dm = P.lastlight && lit ? 1 + val('lastlight') / 100 : 1;
    if (rm === 1 && dm === 1) return;
    let nd = 0;
    for (const p of d.party || []) { p.hit *= dm; p.rate *= rm; p.dps *= dm * rm; nd += p.dps; }
    d.heroHit *= dm; d.heroRate *= rm;
    const w = (d.wardenDps != null ? d.wardenDps : d.heroDps) * dm * rm;
    d.wardenDps = w; d.heroDps = w + nd;
  });

  // ---------- A new run, a boss's start: nothing carries over ----------
  const clear = () => { eng = 0; engStep = 0; swings = 0; clicks = 0; R.pwBreak = null; };
  G.on('ascend', () => { clear(); R.pwPhoenix = null; lit = false; });
  G.on('runStart', () => { clear(); R.pwPhoenix = null; });
  G.on('bossStart', () => { R.pwBreak = null; });
})(globalThis.G = globalThis.G || {});
