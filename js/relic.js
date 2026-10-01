// BTTN 3.0 — Relics: the tier above uniques. A handful of named items that only
// bosses drop, about one boss in six hundred (one lord in two hundred), more in
// Torment, never in a Rift: the White Bag of this game. DOM-free like hero.js;
// the cinematic that plays when one falls lives in js/relic_fx.js.
//
// A relic is a unique (it sits in G.UNIQUES with relic: 1, so equip, stats, the
// Forge, the Party tab, the ladder snapshot and its check all work unchanged),
// with far bigger fixed affixes, an item level 3 above the boss it fell from and
// one rule that changes how the game plays. Relics are kept out of G.UNIQUE_IDS,
// so they never roll as ordinary uniques and don't count for "every unique".
(function (G) {
  'use strict';
  if (!G.UNIQUES || !G.hook) return; // needs hero.js
  const { emit } = G;
  const R = G.R;

  // pure white with a shimmer (the UI's colour for the RELIC label and frames)
  G.RELIC_COL = '#ffffff';
  // what a relic's main stat would be multiplied by, against a mythic's 4.3 and a divine's 5.8,
  // if hero.js's rmul reads U.rm (see the note for the integrator); without it the item level
  // bonus below carries the main stat to a divine's and the affixes do the rest
  G.RELIC_RMUL = 7.8;
  G.RELIC_IL = 3;
  G.TUNE.relicBoss = 1 / 600;
  G.TUNE.relicLord = 1 / 200;
  G.TUNE.relicTorment = 0.1;

  // ---------- The relics ----------
  // a: fixed affixes (a top unique has about 1.1 damage; a divine's rolled affixes top out near 0.3)
  // fx: the rule, as the card shows it
  G.RELICS = {
    firstcrown:   { base: 'king_crown',      name: 'Crown of the First Button', a: [['dmg', 1.6], ['crit', 0.12], ['critd', 1.2], ['gold', 0.8]],
      fx: 'Every 15th click is the First Press: a white nova, 25 hits on every mob and 6 on the boss',
      lore: 'Before the Horde, before the Hand, someone pressed it once.' },
    lastword:     { base: 'eternity_blade',  name: 'The Last Word', a: [['dmg', 2.6], ['critd', 1.5], ['spd', 0.35]],
      fx: 'Hits execute anything below 30% health (not bosses or Rift Guardians)',
      lore: 'It has never had to say anything twice.' },
    dawnpiercer:  { base: 'phoenix_bow',     name: 'Dawnpiercer', a: [['dmg', 2.4], ['spd', 0.4], ['crit', 0.1]],
      fx: 'Every 3rd attack looses a Sunlance: 12 more mobs at full damage, bosses 3×',
      lore: 'Strung with the first light of the first morning.' },
    unpressed:    { base: 'celestial_staff', name: 'Scepter of the Unpressed', a: [['dmg', 2.4], ['spd', 0.45], ['luck', 0.4]],
      fx: 'Every attack arcs lightning to 6 more mobs at 70% damage',
      lore: 'It hums with every click that was never made.' },
    lastfeather:  { base: 'seraph_wing',     name: 'Seraph’s Last Feather', a: [['spd', 0.5], ['hp', 1.2], ['dmg', 0.8], ['xp', 0.5]],
      fx: 'Below 25% health the Button is fully mended and warded for 4s (every 40s)',
      lore: 'The angel kept one back. Just in case.' },
    worldegg:     { base: 'cosmic_egg',      name: 'The World Egg', a: [['dmg', 1.4], ['crit', 0.1], ['critd', 0.8], ['shard', 0.6]],
      fx: 'Abilities recharge 3× faster; each cast rains 10 hits on every enemy and the boss',
      lore: 'Something inside is pressing back.' },
    unbroken:     { base: 'golden_plate',    name: 'Aegis of the Unbroken', a: [['hp', 2.4], ['dmg', 0.9], ['critd', 0.6]],
      fx: 'Bites deal 50% less; every 4s the plate flares: 10 hits on every mob near the Button',
      lore: 'Every dent is a story. It has no dents.' },
    hundredkings: { base: 'halo',            name: 'Halo of the Hundred Kings', a: [['dmg', 1.5], ['critd', 0.8], ['gold', 1.0], ['luck', 0.6]],
      fx: 'Bosses take 2× damage; slaying one fully mends the party and the Button',
      lore: 'Forged from the crowns of every lord who fell to a Button.' },
  };
  G.RELIC_IDS = Object.keys(G.RELICS);
  for (const id of G.RELIC_IDS) {
    const X = G.RELICS[id];
    // (minD out of reach and not in UNIQUE_IDS: the unique rolls never see them)
    G.UNIQUES[id] = { base: X.base, minD: 1e9, relic: 1, rm: G.RELIC_RMUL, name: X.name, a: X.a, fx: X.fx, lore: X.lore };
  }
  G.isRelic = g => !!(g && g.q && G.UNIQUES[g.q] && G.UNIQUES[g.q].relic);
  if (G.STR) {
    G.STR.feedRelic = G.STR.feedRelic || 'found the RELIC {0}!';
    G.STR.relic = G.STR.relic || 'RELIC';
  }

  const S_ = () => G.S;
  const on = id => (G.uqOn ? G.uqOn(id) : false);
  const alive = m => m && !m.dead && !m.gone && m.p > -0.05;
  // n random live mobs (not in skip), cheap even with a thousand on the field
  function someMobs(n, skip) {
    const out = [], L = R.mobs || [];
    if (!L.length) return out;
    for (let tries = 0; out.length < n && tries < n * 4; tries++) {
      const m = L[Math.floor(G.rng() * L.length)];
      if (alive(m) && !out.includes(m) && !(skip && skip.has(m.id)) && m.kind !== 'guardian') out.push(m);
    }
    return out;
  }
  const mobById = id => (R.mobs || []).find(m => m.id === id);
  const busy = () => !!(R.town || R.cine > 0);

  // ---------- The rules ----------
  // Crown of the First Button: every 15th click, the First Press
  G.hook('click', () => {
    if (!on('firstcrown') || busy()) return;
    R.rlPress = (R.rlPress || 0) + 1;
    if (R.rlPress % 15) return;
    const hit = G.D.heroHit || 0;
    emit('nova', 0.95);
    emit('relicRule', 'firstcrown');
    for (const m of (R.mobs || []).slice()) if (alive(m)) G.dealHit(m, hit * 25, 'relic', false);
    if (R.boss && G.hitBoss) G.hitBoss(hit * 6 * (G.D.bossMult || 1));
  });
  // The Last Word: executes
  G.hook('hit', (m, dmg) => {
    if (!on('lastword') || m.kind === 'guardian' || m.dead) return;
    const taken = m.mod === 'stone' || m.stone ? dmg * 0.5 : dmg;
    if (m.hp - taken < m.max * 0.3) { m.exec = 1; return (m.hp + 1) * 2; }
  });
  // Dawnpiercer and the Scepter: more from every swing of the Warden's own weapon
  G.on('heroAttack', ev => {
    if (!ev || ev.src !== 'auto' || ev.extra) return;
    const D = G.D;
    if (on('dawnpiercer')) {
      if (ev.boss) {
        if ((R.rlSunB = (R.rlSunB || 0) + 1) % 3 === 0 && R.boss && G.hitBoss) G.hitBoss(ev.dmg * 2 * (D.bossMult || 1));
      } else if ((R.rlSun = (R.rlSun || 0) + 1) % 3 === 0) {
        const from = mobById(ev.ids && ev.ids[0]);
        const list = someMobs(12, new Set((ev.ids || []).concat(ev.splash || [])));
        if (from && list.length) emit('chain', from, list);
        for (const m of list) G.dealHit(m, ev.dmg, 'relic', ev.crit);
      }
    }
    if (on('unpressed') && !ev.boss) {
      const from = mobById(ev.ids && ev.ids[0]);
      if (from) {
        const list = someMobs(6, new Set((ev.ids || []).concat(ev.splash || [])));
        if (list.length) emit('chain', from, list);
        for (const m of list) G.dealHit(m, ev.dmg * 0.7, 'chain', false);
      }
    }
  });
  // Seraph's Last Feather and the Aegis's flare: on the clock
  G.hook('tick', dt => {
    const S = S_(), h = S.hero, D = G.D;
    if (R.rlFeather > 0) R.rlFeather -= dt;
    if (on('lastfeather') && !(R.rlFeather > 0) && !(R.btnDown > 0) && h.hp > 0 && h.hp < (D.heroHp || 0) * 0.25) {
      R.rlFeather = 40;
      h.hp = D.heroHp; R.ward = Math.max(R.ward || 0, 4);
      if (G.mendParty) G.mendParty(0.5);
      emit('relicRule', 'lastfeather');
    }
    if (on('unbroken') && (R.rlFlare = (R.rlFlare == null ? 4 : R.rlFlare) - dt) <= 0) {
      R.rlFlare = 4;
      const near = (R.mobs || []).filter(m => alive(m) && m.p > 0.55);
      if (near.length) {
        emit('nova', 0.5);
        for (const m of near) G.dealHit(m, (D.heroHit || 0) * 10, 'relic', false);
      }
    }
  });
  G.hook('bite', (m, who, dmg) => (on('unbroken') ? dmg * 0.5 : undefined));
  // The World Egg: faster abilities, and a rain with every cast
  G.on('ability', () => {
    if (!on('worldegg')) return;
    R.abilCd = (R.abilCd || 0) / 3;
    const hit = G.D.heroHit || 0;
    for (const m of (R.mobs || []).slice()) if (alive(m)) G.dealHit(m, hit * 10, 'relic', false);
    if (R.boss && G.hitBoss) G.hitBoss(hit * 10 * (G.D.bossMult || 1));
    emit('relicRule', 'worldegg');
  });
  // Halo of the Hundred Kings: every blow on a boss counts twice (all of them come through G.hitBoss)
  if (G.hitBoss) {
    const hitBoss = G.hitBoss;
    G.hitBoss = dmg => hitBoss(on('hundredkings') ? dmg * 2 : dmg);
  }

  // ---------- The drop ----------
  // one boss in 600, one lord in 200, 10% more per Torment level; never in a Rift
  G.relicOdds = lord => (lord ? G.TUNE.relicLord : G.TUNE.relicBoss) * (1 + G.TUNE.relicTorment * (G.torment ? G.torment().n : 0));
  const owned = () => {
    const S = S_(), h = S.hero, n = Object.assign({}, (S.rec && S.rec.relicN) || {});
    const all = [].concat(h.bag || [], G.SLOTS.map(s => h.eq[s]), ...(S.party || []).map(m => G.SLOTS.map(s => m.eq[s])));
    for (const g of all) if (G.isRelic(g)) n[g.q] = (n[g.q] || 0) + 1;
    return n;
  };
  // which one: one not yet owned if there is one (nine times in ten), weapons the Warden can't swing less often
  function pickRelic() {
    const h = S_().hero, have = owned(), cls = G.CLASS_BY_ID[h.cls];
    const fresh = G.RELIC_IDS.filter(id => !have[id]);
    const pool = fresh.length && G.rng() < 0.9 ? fresh : G.RELIC_IDS;
    const w = pool.map(id => { const b = G.RELICS[id].base; return G.slotOf(b) === 'weapon' && cls && !cls.weapons.includes(G.ITEM_TYPE[b]) ? 0.35 : 1; });
    return pool[G.weighted(w)];
  }
  // A relic falls: into the Warden's bag at once (nothing is lost if the page closes mid-cinematic),
  // the counters and the log, the ladder feed, then 'relicDrop' for the show
  function dropRelic(src, b, id) {
    const S = S_(), h = S.hero;
    if (!h || !h.cls) return null;
    const q = id && G.RELICS[id] ? id : pickRelic();
    const U = G.UNIQUES[q];
    const d = b && b.d != null ? b.d : S.depth;
    const il = Math.min(d + G.RELIC_IL, (S.bestDepth || 0) + G.RELIC_IL);
    const g = G.makeUnique(q, il);
    const first = !owned()[q];
    h.bag.push(g); h.fresh = (h.fresh || 0) + 1;
    S.coll[U.base] = (S.coll[U.base] || 0) + 1;
    // a full bag gives up its weakest piece, never a unique or a relic
    while (h.bag.length > G.TUNE.bagMax) {
      let worst = null, ws = Infinity;
      for (const x of h.bag) { if (x.q) continue; const p = G.powerWith(G.slotOf(x.id), x); if (p < ws) { ws = p; worst = x; } }
      if (!worst) break;
      G.salvage(worst, true);
    }
    S.st.relics = (S.st.relics || 0) + 1;
    S.st.relicDry = 0;
    S.rec.relicN = S.rec.relicN || {};
    S.rec.relicN[q] = (S.rec.relicN[q] || 0) + 1;
    S.rec.relics = Array.isArray(S.rec.relics) ? S.rec.relics : [];
    S.rec.relics.push({ q, d, lord: b && b.lord ? 1 : 0, tm: G.torment ? G.torment().n : 0, src, at: Date.now(), pt: Math.round(S.st.playTime || 0) });
    if (S.rec.relics.length > 50) S.rec.relics.splice(0, S.rec.relics.length - 50);
    if (G.feed && src !== 'test') G.feed('relic', U.name);
    G.dirty();
    const info = { q, U, g, d, lord: !!(b && b.lord), first, n: S.st.relics, src };
    emit('relicDrop', g, info);
    // headless (the bot, the sim): no cinematic to choose from, so the Warden wears it if it's better
    if (!G.relicFx && h.auto && h.bag.includes(g)) {
      const slot = G.slotOf(g.id), cur = h.eq[slot];
      if (!cur || G.powerWith(slot, g) > G.powerWith(slot, cur)) G.equip(g, true);
    }
    return g;
  }
  G.dropRelic = dropRelic;
  // for testing: a relic now (a given one, or rolled as a lord would)
  G.forceRelic = id => dropRelic('test', { d: S_().depth, lord: true }, id);

  G.on('bossWin', (rew, b) => {
    const S = S_();
    if (!b || R.rift || !S.hero || !S.hero.cls) return;
    S.st.relicRolls = (S.st.relicRolls || 0) + 1;
    S.st.relicDry = (S.st.relicDry || 0) + 1;
    if (G.rng() < G.relicOdds(b.lord)) dropRelic('boss', b);
  });
  // Halo of the Hundred Kings: a slain boss mends everyone
  G.on('bossWin', () => {
    if (!on('hundredkings')) return;
    const h = S_().hero;
    if (!(R.btnDown > 0)) h.hp = G.D.heroHp;
    if (G.mendParty) G.mendParty(1);
  });
})(globalThis.G = globalThis.G || {});
