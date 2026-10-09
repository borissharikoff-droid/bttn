// BTTN 4.0 — the Buttons (DESIGN §6.1-6.2). The run blessings of 3.3 are retired: their effects became the Power shrine's
// boons (data.js G.BOONS) and Pacts (G.PACTS; G.BLESS_TO says where each went), and the Button you press is now the
// character you play. Each Button has a rule (G.btnFx, in recalc where the blessing was), a starting card, an unlock (the
// Deeds, js/ach.js G.unlocked('button', id)), a Heat sticker per level won (S.heatStk, js/run.js) and an evolution by a
// secret recipe, met mid-run (the run's Button turns into it for the rest of the Siege; its skin is kept for good).
// THE GOLDEN BUTTON opens with the Gold Button's recipe. No DOM here (the UI listens to the events).
//   G.BUTTONS [{id, name, skin, base, rule, card, cardRanks, unlockText, evo, secret}], G.BUTTON_BY_ID, G.btnOpen(id)
//   (js/ach.js), G.btnFx(d), G.btnRun() -> the run's Button id | null, G.btnSkin() -> the skin to draw (its evolution's
//   once evolved), G.btnManualK() (Clockwork: the Hand's own presses x0.5), G.btnTick(dt) (game.js tick: the Clockwork's
//   own hold, the recipes' clocks)
//   G.BUTTON_EVOS {evo: {base, name, rule, hint, skin, base}}, G.btnEvoKnown(base, evo), G.btnEvoHint(base),
//   G.btnHintBuy(base) (a hint costs a Daily Siege completion: S.hintTok), G.btnEvoCheck() -> the evolution met now | null
//   Events: 'btnEvolve'(base, evo, first) (the mid-run cinematic: the UI's), 'btnHint'(base), 'unlock'('button',
//   'golden') (js/ach.js G.unlockAdd), 'perk'(id, rank, 'button', n) for a Button's starting card
(function (G) {
  'use strict';
  const { emit } = G;
  const S_ = () => G.S;
  const runOf = () => { const r = G.S && G.S.run; return r && r.on ? r : null; };

  // ---------- The 3.3 blessings (retired; the data stays for old saves and old readers) ----------
  const B = G.BLESSINGS = [
    { id: 'gilded', icon: 'ic_coin', name: 'Gilded Run', desc: 'Gold ×1.6', fx: d => { d.goldMult *= 1.6; } },
    { id: 'warpath', icon: 'ic_sword', name: 'Warpath', desc: 'Party damage +35%', fx: d => { d.heroMult *= 1.35; } },
    { id: 'iron', icon: 'pot_def', name: 'Iron Button', desc: 'Button and party health +60%', fx: d => { d.hpMult *= 1.6; } },
    { id: 'quick', icon: 'ev_frenzy', name: 'Quick Hands', desc: 'Party attack speed +25%', fx: d => { d.spdMult *= 1.25; } },
    { id: 'fortune', icon: 'ic_chest', name: 'Fortune', desc: 'Better chests, chest bar +30%', fx: d => { d.luck += 0.3; d.chestProg *= 1.3; } },
    { id: 'livewire', icon: 'ic_bolt', name: 'Live Wire', desc: 'Overdrive charges twice as fast', fx: d => { d.odRate = (d.odRate || 1) * 2; } },
    { id: 'seeker', icon: 'orb_ascent', name: 'Orb Seeker', desc: 'Orbs drop three times as often', fx: d => { d.orbMult = (d.orbMult || 1) * 3; } },
    { id: 'scholar', icon: 'ic_scroll', name: 'Scholar', desc: 'XP +60%: levels and perks come sooner', fx: d => { d.xpMult = (d.xpMult || 1) * 1.6; } },
    { id: 'slayer', icon: 'ic_skull', name: 'Giant Slayer', desc: 'Damage to bosses +50%', fx: d => { d.bossMult *= 1.5; } },
    { id: 'glass', icon: 'it_crystal_dagger', twist: 1, name: 'Glass Run', desc: 'Party damage ×1.8, but Button and party health ×0.6', fx: d => { d.heroMult *= 1.8; d.hpMult *= 0.6; } },
    { id: 'greed', icon: 'ic_vault', twist: 1, name: 'Greed', desc: 'Gold ×2.5, but the Horde bites 40% harder', fx: d => { d.goldMult *= 2.5; d.biteMult = (d.biteMult || 1) * 1.4; } },
    { id: 'reckless', icon: 'ev_bloodmoon', twist: 1, retired: 1, name: 'Reckless', desc: 'Retired in 4.0', fx: () => {} },
  ];
  const BY = G.BLESS_BY_ID = {};
  B.forEach(b => { BY[b.id] = b; b.to = (G.BLESS_TO || {})[b.id] || null; });
  G.BLESS_GONE = { roller: 'seeker' };
  // (an old save's blessing and offer are dropped: 4.0 runs have no blessing)
  G.blessFix = S => { if (S) { S.bless = null; S.blessOffer = null; } };
  // SHIMS for the 3.x readers: no blessing is ever applied, offered or chosen
  G.blessFx = () => {};
  G.blessOffer = () => null;
  G.chooseBlessing = () => false;
  // the Horde's bites (D.biteMult: a Button's or a boon's)
  G.hook('bite', (m, who, bd) => (G.D.biteMult && G.D.biteMult !== 1 ? bd * G.D.biteMult : null));

  // ---------- The Buttons ----------
  //   fx(d): its rule in recalc (the run's part, after the meta's budget: a Button is a sideways choice, not power);
  //   land: fields merged into G.landNow() for the whole run (Spore: Sporefall in every land; Golden: Horde health +50%);
  //   card / cardRanks: its starting card (ranks of a perk at the start; Golden: Greed at its max, Midas evo-ready);
  //   bolts: bolts per click (G.omen's thunder); hold: clicks a second it makes on its own (Clockwork); manual: the Hand's
  //   own presses count this much; pips: Integrity at the start (Golden 2); fame / embers: the run's pay (G.hook('runMul'))
  const BTN = (o) => Object.assign({ card: null, cardRanks: 1, evo: null, secret: 0, fx: null, land: null }, o);
  G.BUTTONS = [
    BTN({ id: 'classic', name: 'Classic', skin: 'classic', base: '#e8413c', rule: 'No rule', unlockText: 'Open from the start', evo: 'crimson' }),
    BTN({ id: 'iron', name: 'Iron Button', skin: 'sapphire', base: '#3f7bff', rule: 'Health +60%, damage −15%', card: 'bulwark', unlockText: 'Fall 3 times', evo: 'adamant',
      fx: d => { d.hpMult *= 1.6; d.heroMult *= 0.85; } }),
    BTN({ id: 'storm', name: 'Storm Button', skin: 'amethyst', base: '#a048ff', rule: '+1 bolt per click, companions −20%', card: 'thunder', unlockText: 'Slay an Act I boss', evo: 'tempest', bolts: 1,
      fx: d => { d.allyDmgK = (d.allyDmgK || 1) * 0.8; } }),
    BTN({ id: 'spore', name: 'Spore Button', skin: 'emerald', base: '#2fc46a', rule: 'Sporefall in every land, XP +30%', card: 'corpse', unlockText: 'Slay 2,000 Spitters', evo: 'bloom',
      land: { split: 0.4 }, fx: d => { d.xpMult = (d.xpMult || 1) * 1.3; } }),
    BTN({ id: 'gold', name: 'Gold Button', skin: 'gold', base: '#ffc629', rule: 'Gold ×1.6, +1 camp market offer', card: 'greed', unlockText: 'Hold 1M gold in a Siege', evo: 'golden',
      fx: d => { d.goldMult *= 1.6; d.marketPlus = (d.marketPlus | 0) + 1; } }),
    BTN({ id: 'glass', name: 'Glass Button', skin: 'obsidian', base: '#3a3348', rule: 'Damage ×1.8, health ×0.55', unlockText: 'Win a Siege', evo: 'diamond',
      fx: d => { d.heroMult *= 1.8; d.hpMult *= 0.55; } }),
    BTN({ id: 'prism', name: 'Prism Button', skin: 'rainbow', base: 'rainbow', rule: 'A 4th card when an evolution is ready; mythic+ gear rolls +1 perk rank; health −20%', unlockText: 'Discover 5 evolutions', evo: 'spectrum',
      fx: d => { d.pkPlus = (d.pkPlus | 0) + 1; d.hpMult *= 0.8; } }),
    BTN({ id: 'clockwork', name: 'Clockwork Button', skin: 'divine', base: '#f4f6ff', rule: 'Holds itself at 8 clicks/s (your presses ×0.5); cards, camps and doors choose themselves after 4 s; Fame and Embers −20%', unlockText: 'Play 3 Sieges', evo: 'perpetual',
      hold: 8, manual: 0.5, fame: 0.8, embers: 0.8, auto: 4 }),
    BTN({ id: 'golden', name: 'THE GOLDEN BUTTON', skin: 'golden', base: '#ffd84a', secret: 1, rule: 'Loot moment rarity +1, Embers ×2, Horde health +50%, Integrity 2', card: 'greed', cardRanks: 99, unlockText: 'A secret recipe',
      land: { mobHp: 1.5 }, pips: 2, embers: 2, fx: d => { d.lootRar = (d.lootRar | 0) + 1; } }),
  ];
  G.BUTTON_BY_ID = {}; G.BUTTONS.forEach(b => { G.BUTTON_BY_ID[b.id] = b; });
  G.BUTTONS_BY_ID = G.BUTTON_BY_ID;
  // (G.btnOpen(id) is js/ach.js's: G.unlocked('button', id))
  G.btnRun = () => { const r = runOf(); return r ? (G.BUTTON_BY_ID[r.btn] ? r.btn : 'classic') : null; };
  const btnOf = () => { const r = runOf(); return r ? G.BUTTON_BY_ID[r.btn] || G.BUTTON_BY_ID.classic : null; };
  const evoOf = () => { const r = runOf(); return r && r.btnEvo ? G.BUTTON_EVOS[r.btnEvo] || null : null; };

  // ---------- The evolutions (DESIGN §6.2): a secret recipe met mid-run turns the run's Button into its evolved form ----------
  //   test(S, r, mt, ctx): the recipe (ctx: {why: 'evolve'|'perk'|'bossWin'|'relic'|'tick'|'legend', b}); fx / land / bolts /
  //   hold / reflect / chain / cards: what it adds for the rest of the run; unlock: what the recipe opens for good instead
  const own = k => (G.perkOwn ? G.perkOwn(k) : G.perk(k));
  const evoN = h => Object.keys((h && h.perks) || {}).filter(k => k.startsWith('evo_') && h.perks[k] > 0).length;
  const schoolsAt = (n) => { const s = {}; for (const k in G.PERKS) if (G.perk(k) >= n && G.PERK_SCHOOL && G.PERK_SCHOOL[k]) s[G.PERK_SCHOOL[k]] = 1; return Object.keys(s).length; };
  const onBelt = q => { const r = runOf(); return !!((r && (r.belt || []).includes(q)) || (G.D.uq && G.D.uq[q])); };
  G.BUTTON_EVOS = {
    adamant: { base: 'iron', name: 'Adamant', skin: 'adamant', col: '#9fd8ff', rule: 'Bites reflect: every biter takes your hit back',
      hint: 'Iron grows hard on a Bastion, and a relic that was never broken', reflect: 1,
      test: () => !!G.evo('bastion') && onBelt('unbroken') },
    tempest: { base: 'storm', name: 'Tempest', skin: 'tempest', col: '#d27bff', rule: 'Every click chains to 3 more of the Horde',
      hint: 'Two storms in one hand: the Wrath, and the Thunderstorm', chain: 3,
      test: () => !!G.evo('wrath') && !!G.evo('storm') },
    crimson: { base: 'classic', name: 'Crimson', skin: 'crimson', col: '#ff2a3a', rule: 'Party damage +20%',
      hint: 'Three evolutions in a single Siege', fx: d => { d.heroMult *= 1.2; },
      test: () => evoN(G.S.hero) >= 3 },
    diamond: { base: 'glass', name: 'Diamond', skin: 'diamond', col: '#e8fbff', rule: 'Crit chance +10%',
      hint: 'Clear Act II without the Button ever dropping under half', fx: d => { d.crit += 0.1; },
      test: (S, r, mt, ctx) => ctx.why === 'bossWin' && ctx.b && ctx.b.d === (G.SIEGE ? G.SIEGE.actBoss[1] : 11) && !mt.under50 },
    spectrum: { base: 'prism', name: 'Spectrum', skin: 'spectrum', col: '#ffffff', rule: '+1 card at every lord',
      hint: 'Five schools, each at rank 2 or more', cards: 1,
      test: () => schoolsAt(2) >= 5 },
    bloom: { base: 'spore', name: 'Bloom', skin: 'bloom', col: '#7dff9a', rule: 'Spores explode: the Horde bursts when it dies',
      hint: 'Kindling and Corpse Blast, both at their max', land: { boom: 0.3, split: 0.6 },
      test: () => G.PERKS.burn && G.PERKS.corpse && G.perk('burn') >= G.PERKS.burn.max && G.perk('corpse') >= G.PERKS.corpse.max },
    perpetual: { base: 'clockwork', name: 'Perpetual', skin: 'perpetual', col: '#fff6c8', rule: 'Holds itself at 12 clicks/s',
      hint: 'Ten thousand presses it made itself, in one Siege', hold: 12,
      test: (S, r, mt) => (mt.self | 0) >= 10000 },
    golden: { base: 'gold', name: 'THE GOLDEN BUTTON', skin: 'golden', col: '#ffd84a', rule: 'Opens THE GOLDEN BUTTON for good',
      hint: 'Midas Touch, Dragon’s Hoard and a million gold in hand when the Mad Button dies... or a legend pressed', unlock: ['button:golden', 'skin:golden'],
      test: (S, r, mt, ctx) => ctx.why === 'legend' || (ctx.why === 'bossWin' && ctx.b && G.isMadLord && G.isMadLord(ctx.b) && !!G.evo('midas') && !!G.evo('hoard') && (S.gold || 0) >= 1e6) },
  };
  for (const id in G.BUTTON_EVOS) G.BUTTON_EVOS[id].id = id;
  // (English strings for the Codex's recipe book and the Buttons page; the UI reads bevo_<evo>_n/_r/_h, btn_<id>_n/_r/_u)
  if (G.tAdd) {
    const o = {};
    for (const b of G.BUTTONS) { o['btn_' + b.id + '_n'] = b.name; o['btn_' + b.id + '_r'] = b.rule; o['btn_' + b.id + '_u'] = b.unlockText; if (b.card) o['btn_' + b.id + '_c'] = (G.PERKS[b.card] || {}).name || b.card; }
    for (const e in G.BUTTON_EVOS) { const E = G.BUTTON_EVOS[e]; o['bevo_' + e + '_n'] = E.name; o['bevo_' + e + '_r'] = E.rule; o['bevo_' + e + '_h'] = E.hint; }
    Object.assign(o, { btn_evolved: '{0} EVOLVES: {1}', btn_hintTok: 'Recipe hints: {0} (a Daily Siege finished gives one)', btn_golden: 'THE GOLDEN BUTTON is yours' });
    G.tAdd(o);
  }
  const btnRec = S => { S.rec = S.rec || {}; return S.rec.btnEvos || (S.rec.btnEvos = {}); };
  // discovered (named in the Codex) once ever met
  G.btnEvoKnown = (base, evo) => { const S = S_(); evo = evo || (G.BUTTON_BY_ID[base] || {}).evo; return !!(evo && S.rec && S.rec.btnEvos && S.rec.btnEvos[evo]); };
  G.btnEvoHint = base => { const S = S_(); return !!(S.rec && S.rec.btnHints && S.rec.btnHints[base]); };
  // a hint costs one Daily Siege finished (its first, ranked attempt: S.hintTok)
  G.btnHintBuy = function (base) {
    const S = S_(), b = G.BUTTON_BY_ID[base];
    if (!b || !b.evo || G.btnEvoHint(base) || G.btnEvoKnown(base) || (S.hintTok | 0) < 1) return false;
    S.hintTok--; S.rec = S.rec || {}; (S.rec.btnHints || (S.rec.btnHints = {}))[base] = 1;
    emit('btnHint', base);
    return true;
  };
  G.btnSkin = () => { const r = runOf(); if (!r) return null; const E = evoOf(); return E && E.skin ? E.skin : (btnOf() || {}).skin || 'classic'; };

  // the run's evolution: check the recipe of the run's Button (ctx.why says what just happened); met -> it evolves now
  function evolve(r, E, why) {
    const S = S_(), rec = btnRec(S), first = !rec[E.id];
    rec[E.id] = (rec[E.id] | 0) + 1;
    if (E.unlock) {
      // (a recipe that opens a Button for good: the run itself doesn't change)
      r.btnRecipe = E.id;
      for (const k of E.unlock) if (G.unlockAdd) G.unlockAdd(k, 'recipe:' + E.id);
    } else r.btnEvo = E.id;
    G.dirty(); G.recalc();
    emit('btnEvolve', E.base, E.id, first, why);
    return E.id;
  }
  G.btnEvoCheck = function (ctx) {
    const r = runOf(), b = btnOf();
    if (!r || !b || !b.evo || r.btnEvo || r.btnRecipe) return null;
    const E = G.BUTTON_EVOS[b.evo];
    if (!E || r.day) return null;
    ctx = ctx || { why: 'check' };
    let ok = false;
    try { ok = !!E.test(S_(), r, mtOf(r), ctx); } catch (e) { ok = false; }
    return ok ? evolve(r, E, ctx.why) : null;
  };
  const mtOf = r => r.mt || (r.mt = { land0: 0, pipLost: 0, evos: 0, self: 0 });

  // ---------- The rule in recalc (game.js: where blessFx was) ----------
  G.btnFx = function (d) {
    const b = btnOf(); if (!b) return;
    if (b.fx) b.fx(d);
    const E = evoOf(); if (E && E.fx) E.fx(d);
  };
  // the Hand's own presses (game.js manualClick): the Clockwork counts them half
  G.btnManualK = () => { const b = btnOf(); return b && b.manual ? b.manual : 1; };
  // the Clockwork's own hold (8 a second; Perpetual 12), counted for its recipe; the recipes that watch the clock
  let holdAcc = 0;
  G.btnTick = function (dt) {
    const r = runOf(), b = btnOf();
    if (!r || !b) return;
    const E = evoOf(), rate = (E && E.hold) || b.hold || 0;
    if (rate > 0 && !(G.R.btnDown > 0)) {
      holdAcc += rate * dt;
      let g = 0;
      while (holdAcc >= 1 && g++ < 60) { holdAcc -= 1; if (G.selfClick()) mtOf(r).self = (mtOf(r).self | 0) + 1; }
      if (holdAcc > 4) holdAcc = 0;
    }
    if (b.evo === 'perpetual' && !r.btnEvo && (mtOf(r).self | 0) >= 10000) G.btnEvoCheck({ why: 'tick' });
  };

  // ---------- The run's start: the Button's setup (js/run.js emits 'runSetup' before the run's Integrity is set) ----------
  G.on('runSetup', (r, setup) => {
    const S = S_();
    // (a Button still locked (an old setup, a typed code) plays as the Classic; the Daily's own is fixed)
    if (!G.BUTTON_BY_ID[r.btn] || (!r.day && G.btnOpen && !G.btnOpen(r.btn))) r.btn = 'classic';
    const b = G.BUTTON_BY_ID[r.btn];
    r.btnEvo = null; r.btnRecipe = null; holdAcc = 0;
    mtOf(r);
    // the starting card: ranks of its perk from the start (Golden: Greed at its max: Midas is a ring away)
    if (b.card && G.PERKS[b.card] && S.hero) {
      const P = G.PERKS[b.card], n = Math.min(P.max, b.cardRanks || 1);
      S.hero.perks[b.card] = Math.max(S.hero.perks[b.card] | 0, n);
      emit('perk', b.card, S.hero.perks[b.card], 'button', n);
    }
    if (b.pips) r.pipMax = Math.min(r.pipMax, b.pips);
    // Clockwork: cards, camps and doors choose themselves after b.auto s (js/run.js reads the run's flags); Auto-Run (opened
    // with it, S.set.autoRun) adds the summary's own AGAIN and an extract at Camp S.set.autoRunCamp (2)
    if (b.auto) {
      r.autoCards = 1; r.autoAfter = b.auto; r.beatAfter = b.auto;
      if (S.set && S.set.autoRun && G.unlocked('system', 'autorun')) { r.autoAgain = 1; r.autoExtract = Math.max(1, (S.set.autoRunCamp | 0) || 2); r.autoRun = 1; }
    }
    G.dirty();
  });
  // Auto-Run's switch (Settings; only with the Clockwork Button: it opens with it): on/off, the camp it extracts at
  G.autoRun = function (on, camp) {
    const S = S_(); S.set = S.set || {};
    if (on != null) S.set.autoRun = on && G.unlocked('system', 'autorun') ? 1 : 0;
    if (camp != null) S.set.autoRunCamp = Math.max(1, Math.min(5, camp | 0));
    return { on: !!S.set.autoRun, camp: (S.set.autoRunCamp | 0) || 2, open: G.unlocked('system', 'autorun') };
  };
  // the run's pay: Clockwork Fame and Embers x0.8, Golden Embers x2
  G.hook('runMul', (kind, r) => { const b = r && G.BUTTON_BY_ID[r.btn]; if (!b) return 1; return kind === 'fame' ? b.fame || 1 : kind === 'embers' ? b.embers || 1 : 1; });

  // ---------- The rules that live outside recalc ----------
  // the land (G.landNow, world.js): Spore's Sporefall everywhere, Golden's Horde health, Bloom's bursting Horde. Kept as long
  // as the land object and the Button's form stay the same (asked on every kill)
  if (G.landNow) {
    const land0 = G.landNow;
    let lastL = null, lastKey = '', lastOut = null;
    G.landNow = function () {
      const L = land0();
      const b = btnOf(); if (!b) return L;
      const E = evoOf();
      if (!b.land && !(E && E.land)) return L;
      const key = b.id + '|' + (E ? E.id : '');
      if (L === lastL && key === lastKey && lastOut) return lastOut;
      const out = Object.assign({}, L);
      for (const o of [b.land, E && E.land]) if (o) for (const k in o) {
        const v = o[k];
        out[k] = k === 'split' || k === 'boom' ? Math.max(out[k] || 0, v) : (typeof out[k] === 'number' ? out[k] : 1) * v;
      }
      lastL = L; lastKey = key; lastOut = out;
      return out;
    };
  }
  // the bolts a click calls (hero.js reads G.omen().thunder): the Storm Button's +1
  if (G.omen) {
    const omen0 = G.omen;
    let lastV = null, lastOut = null;
    G.omen = function () {
      const v = omen0(), b = btnOf();
      if (!b || !b.bolts) return v;
      if (v !== lastV || !lastOut) { lastV = v; lastOut = Object.assign({}, v, { thunder: (v.thunder || 0) + b.bolts }); }
      return lastOut;
    };
  }
  // Adamant: every bite comes back as the Warden's hit
  G.hook('bite', (m, who, bd) => { const E = evoOf(); if (E && E.reflect && m && !m.dead && G.dealHit) G.dealHit(m, (G.D.heroHit || 0) * E.reflect, 'thorns', false); return null; });
  // Tempest: every click's hit chains to the nearest of the Horde
  let chaining = false;
  G.hook('hit', (m, dmg, src) => {
    if (src !== 'click' || chaining) return null;
    const E = evoOf(); if (!E || !E.chain || !G.R.mobs) return null;
    chaining = true;
    try {
      const near = [];
      for (const x of G.R.mobs) {
        if (x === m || x.dead || x.gone) continue;
        const dd = Math.abs((x.a || 0) - (m.a || 0)) + Math.abs((x.p || 0) - (m.p || 0)) * 2;
        if (near.length < E.chain) { near.push([dd, x]); near.sort((a, b) => a[0] - b[0]); } else if (dd < near[near.length - 1][0]) { near[near.length - 1] = [dd, x]; near.sort((a, b) => a[0] - b[0]); }
      }
      if (near.length) { emit('chain', m, near.map(n => n[1])); for (const n of near) G.dealHit(n[1], dmg * 0.6, 'chain', false); }
    } finally { chaining = false; }
    return null;
  });
  // Prism: a 4th card (a perk) when an evolution is ready, and every evolution that is ready (not only the first)
  G.on('cardDeal', (offer, r) => {
    const b = btnOf(); if (!b || b.id !== 'prism' || !offer || !G.evoReady) return;
    const ready = G.evoReady(); if (!ready.length) return;
    for (const e of ready) if (!offer.ids.includes('evo_' + e)) { offer.ids.push('evo_' + e); offer.add.push(1); offer.tier.push(2); }
    const held = G.cardSlotsUsed ? G.cardSlotsUsed() : [];
    let pool = Object.keys(G.PERKS).filter(k => (!G.perkFit || G.perkFit(k)) && !offer.ids.includes(k));
    if (held.length >= ((G.TUNE && G.TUNE.cardSlots) || 6)) pool = pool.filter(k => held.includes(k));
    if (pool.length) { const rnd = G.runRng || G.rng; offer.ids.push(pool[Math.floor(rnd() * pool.length)]); offer.add.push(1); offer.tier.push(0); }
  });
  // Spectrum: +1 card at every lord (queued before the lord's card beat deals)
  G.on('bossWin', (rew, b) => {
    const r = runOf(); if (!r || !b) return;
    const E = evoOf();
    if (E && E.cards && b.lord && !(G.isMadLord && G.isMadLord(b)) && Array.isArray(r.cardQ)) for (let i = 0; i < E.cards; i++) r.cardQ.push('spectrum');
    G.btnEvoCheck({ why: 'bossWin', b });
  });
  G.on('evolve', () => G.btnEvoCheck({ why: 'evolve' }));
  G.on('perk', (id, rank, how) => { if (how !== 'button') G.btnEvoCheck({ why: 'perk' }); });
  G.on('relicPick', () => G.btnEvoCheck({ why: 'relic' }));
  G.on('equip', () => { const b = btnOf(); if (b && b.evo === 'adamant') G.btnEvoCheck({ why: 'equip' }); });
  // Diamond's watch: the Button under half during Act II (depths 6-11: 'clear Act II without dropping under 50%')
  G.on('buttonHurt', () => { const r = runOf(), S = S_(); if (r && S.hero && (S.depth | 0) >= 6 && (S.depth | 0) <= 11 && G.D.heroHp > 0 && S.hero.hp < G.D.heroHp * 0.5) mtOf(r).under50 = 1; });
  // the Button of Legends (js/rare.js), pressed while playing the Gold Button
  G.on('rare', kind => { if (kind === 'legend') G.btnEvoCheck({ why: 'legend' }); });
  // a hint for a Button's recipe: one for each Daily Siege finished (the first, ranked attempt)
  G.on('runEnding', (sum, r) => { if (r && r.day && r.ranked) { const S = S_(); S.hintTok = (S.hintTok | 0) + 1; } });
  // a loaded save (js/ach.js G.metaLoad)
  G.btnLoad = S => { if (S.bless || S.blessOffer) G.blessFix(S); btnRec(S); };
})(globalThis.G = globalThis.G || {});
