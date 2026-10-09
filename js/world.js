// BTTN — the world around the Warden, DOM-free like game.js and hero.js:
//  • Loot on the ground, Path of Exile style: every drop is rolled when it
//    falls, so its label, beam and sound tell you what it is before you pick
//    it up. Tap a label to grab it; left alone, the Warden gathers it.
//  • Events that break up the flow: the Hoarder (a loot goblin), Shrines and
//    Breaches, plus each land's own rule (data.js, REALMS[].rule).
//  • Rifts: timed runs at a chosen level, the endgame and the friends ladder.
(function (G) {
  'use strict';
  const { chance, rand, randInt, emit } = G;
  const R = G.R, TUNE = G.TUNE;
  Object.assign(TUNE, {
    groundMax: 60,
    // seconds on the ground before the Warden gathers it
    lingerOrb: 1.2, lingerGear: 2.6, lingerGood: 4.5, lingerUnique: 7,
    // (3.6: orbs a tenth more, for the Lucky Spin's gems) 4.0: far fewer drops (0.12/0.55/0.0011 before): at most a few
    // rare+ labels a minute; the boss's loot moment is where items come from
    // (4.0, continuation 2: 0.02/0.2/0.0002 -> 0.014/0.14/0.00014, and a rare mob drops 1 piece in a Siege, not 1-2: rare+
    // labels were ~6 a minute with the sudden events on (kills ~2.5, rares' showers ~1.8, champions ~1, Hoarders ~0.4);
    // DESIGN §14 wants 5 at most)
    dropBrute: 0.014, dropMagic: 0.14, dropFodder: 0.00014, orbShare: 0.033,
    hoardEvery: 150, hoardFirst: 40, hoardLife: 16, hoardSiege: [2, 3], hoardUqSiege: 0.03, rareSiege: [1, 1],
    // 4.0 (DESIGN §5.8): a shrine every 110 s (the first at 60 s), charged by holding the Hand on it for shrineCharge s
    shrineEvery: 110, shrineFirst: 60, shrineLife: 12, shrineDur: 15, shrineCharge: 2,
    breachEvery: 300, breachFirst: 240, breachDur: 12, breachRate: 2.5,
    // (3.6: the invasion clock now runs on through new runs, and a due invasion comes in the next free window of the
    // pacing director, ahead of a sudden event: about one every 6-8 minutes of play)
    invEvery: 300, invFirst: 200, invTime: 90, invNeed: 90, invBoss: 30, invFocus: 20, invBossTime: 40, invSiegeFrom: 6, invSiegeP: 0.6,
    // the JACKPOT: odds per kill and per real chest, climbing by one each hour since the last; its gold in seconds of income
    jpKill: 5e-7, jpChest: 1.2e-5, jpGold: 3000,
    riftTime: 90, riftNeed: 40, riftGuard: 60,
  });
  Object.assign(R, { ground: [], gUid: 0, hoardT: null, shrine: null, shr: null, shrineT: null, breach: null, breachT: null });

  const S_ = () => G.S;
  const perk = id => (G.perk ? G.perk(id) : 0);
  const evo = id => (G.evo ? G.evo(id) : 0);
  const om = () => (G.omen ? G.omen() : { loot: 1 });
  const uq = id => (G.uqOn ? G.uqOn(id) : false);
  const shrineOn = k => !!(R.shr && R.shr.t > 0 && R.shr.k === k);

  // The land the Horde is fighting in: the campaign's, or the Rift's
  // (3.6: kept until the depth changes: it is asked on every kill)
  // 4.0: in a Siege, the route's land (G.realmIndex) with this land slot's map mod merged in (S.run.mods[slot]: an id of
  // G.MAP_MODS, whose .land fields are the same count knobs a land's rule uses: thick, loot, slow, champ, noMend...)
  // (asked on every kill: the cache is checked field by field, no strings built)
  let landD = -1, landV = null, landI = -1, landM = null, landT = null, landP = null, landC = 0;
  G.landNow = () => {
    const S = G.S, d = G.depthNow ? G.depthNow() : S.depth, run = S.run;
    const slot = Math.floor(Math.max(0, d) / G.REALM_SIZE), on = !!(run && run.on && !R.rift);
    const mod = on && run.mods ? run.mods[slot] || null : null;
    // (and the reward tag's land fields, a Pact on this land, a cursed door: every field's twist twice over)
    const tag = on && run.tags ? run.tags[slot] || null : null, pact = on && run.pact && run.pact.slot === slot ? run.pact.id : null;
    const curse = on && run.cursed ? run.cursed[slot] | 0 : 0;
    const ri = G.realmIndex(d);
    if (d !== landD || !landV || ri !== landI || mod !== landM || tag !== landT || pact !== landP || curse !== landC) {
      landD = d; landI = ri; landM = mod; landT = tag; landP = pact; landC = curse;
      const base = G.REALMS[ri], M = mod && G.MAP_MODS ? G.MAP_MODS[mod] : null, T = tag && G.REWARD_TAGS ? G.REWARD_TAGS[tag] : null, P = pact && G.PACTS ? G.PACTS[pact] : null;
      if ((M && M.land) || (T && T.land) || (P && P.land)) {
        landV = Object.assign({}, base, { mod, tag });
        // (multipliers combine: a land's own loot x1.4 and a Thick mod's x1.25 make x1.75)
        const merge = (o, k2) => { if (!o) return; for (const k in o) { let v = o[k]; if (k2 && typeof v === 'number' && k !== 'noMend') v = 1 + (v - 1) * k2; landV[k] = typeof v === 'number' && typeof landV[k] === 'number' && k !== 'noMend' ? landV[k] * v : v; } };
        merge(M && M.land, curse ? 2 : 0); merge(T && T.land, curse ? 2 : 0); merge(P && P.land, 0);
      } else landV = base;
    }
    return landV;
  };

  // Everything that raises how much the Horde drops
  function lootMult() {
    const L = G.landNow();
    return (R.hb.scroll > 0 ? 3 : 1) * (1 + 0.25 * perk('loot')) * (evo('midas') ? 1.5 : 1) * (om().loot || 1)
      * (uq('goldgrin') ? 1.4 : 1) * (shrineOn('greed') ? 3 : 1) * (L.loot || 1) * (1 + 0.15 * G.cycle(G.depthNow()));
  }
  G.lootMult = lootMult;

  // ---------- Rolling a drop ----------
  function rollOrb() {
    const ids = G.ORB_IDS, w = ids.map(k => G.ORBS[k].w);
    return ids[G.weighted(w)];
  }
  // 4.0: a Siege is 18 zones deep, so a unique's depth gate is its 3.x depth / 4.5 (the Other Cloak from depth 13), and
  // only the pool the Deeds have opened (G.uqOpen, the meta's; all of them without it)
  G.uqOpen = G.uqOpen || ((q, depth) => { const U = G.UNIQUES[q]; return !!U && U.minD / 4.5 <= depth; });
  function uniqueFor(depth, boss) {
    const ok = G.UNIQUE_IDS.filter(q => { const U = G.UNIQUES[q]; return G.uqOpen(q, depth) && (!U.boss || boss); });
    // half the time it's one you don't have yet, if there is one
    const fresh = ok.filter(q => !S_().uq[q]);
    const from = fresh.length && chance(0.5) ? fresh : ok;
    return from.length ? from[Math.floor(G.rng() * from.length)] : null;
  }
  // (4.0: the loot moment's unique cards, js/run.js)
  G.uniqueFor = uniqueFor;
  // Bad-luck protection for uniques: the 25th chance in a row without one is a sure thing
  const UQ_PITY = 25;
  function uqChance_(p, src) {
    const st = S_().st;
    if (src === 'rift') return chance(p);
    st.dryQ = (st.dryQ || 0) + 1;
    return st.dryQ >= UQ_PITY || chance(p);
  }
  // floor: the lowest rarity it can be; rolls: best of n rarity rolls
  // free: past the depth's rarity cap (the JACKPOT only)
  function rollGear(floor, rolls, free) {
    let r = 0;
    for (let i = 0; i < (rolls || 1); i++) r = Math.max(r, G.rollRarity(G.rollTier(G.DROP_WEIGHTS), 1));
    return G.pickItem(Math.max(floor || 0, r), free);
  }
  function place(e, m, spread) {
    e.a = m ? G.clamp(m.a + rand(-spread, spread), 0, 1) : rand(0, 1);
    e.p = m ? G.clamp(m.p + rand(-spread, spread) * 2, 0.05, 1.05) : rand(0.6, 0.9);
  }
  // Put one drop on the ground. kind: 'gear' | 'orb' | 'uq'
  function drop(kind, what, m, o) {
    const S = S_(), d = o && o.d != null ? o.d : G.depthNow();
    const e = { id: ++R.gUid, k: kind, t: 0, src: (o && o.src) || 'mob' };
    if (kind === 'gear') {
      // bad-luck protection: a legendary at the latest every 250 drops
      if (what.r >= 4) S.st.dryL = 0;
      // (or the best the depth allows yet)
      else if ((S.st.dryL = (S.st.dryL || 0) + 1) >= 250) { what = G.pickItem(Math.min(4, G.rarityCap())); S.st.dryL = 0; }
      // now and then a drop upgrades in mid-air (when the depth allows the next rarity)
      if (what.r < Math.min(6, G.rarityCap()) && chance(0.04)) { e.from = what.r; what = G.pickItem(what.r + 1); }
    }
    // item level is fixed where it falls: Rift loot keeps the Rift's depth
    if (kind === 'gear') { e.it = what; e.r = what.r; e.il = d + (chance(0.35) ? 1 : 0); }
    else if (kind === 'orb') { e.orb = what; e.r = what === 'grace' ? 6 : what === 'ascent' ? 4 : what === 'ruin' ? 3 : 1; }
    else { e.q = what; e.r = 7; e.il = d + 1; S.st.dryQ = 0; }
    place(e, m, (o && o.spread) || 0.025);
    if (o && o.at) { e.a = G.clamp(o.at.a + rand(-0.16, 0.16), 0, 1); e.p = G.clamp(o.at.p + rand(-0.22, 0.18), 0.2, 0.95); }
    e.life = kind === 'orb' ? TUNE.lingerOrb : kind === 'uq' ? TUNE.lingerUnique : what.r >= 3 ? TUNE.lingerGood : TUNE.lingerGear;
    e.wait = (o && o.wait) || 0;
    e.life += e.wait;
    R.ground.push(e);
    S.st.drops = (S.st.drops || 0) + 1;
    while (R.ground.length > TUNE.groundMax) pickup(R.ground[0], 'auto');
    emit('drop', e, m);
    return e;
  }
  G.dropItem = drop;
  // A shower of loot: n drops, some of them orbs, maybe a unique. They come
  // out one after another, the best one last.
  function shower(m, n, floor, uqChance, o) {
    o = o || {};
    const d = o.d != null ? o.d : G.depthNow();
    const items = [];
    // only the first floorN items are promised the floor; the rest roll on their own
    const fn = o.floorN != null ? o.floorN : n;
    for (let i = 0; i < n; i++) items.push(i >= fn && chance(TUNE.orbShare * (G.D.orbMult || 1)) ? ['orb', rollOrb()] : ['gear', rollGear(i < fn ? floor : Math.max(0, floor - 2), i < fn ? o.rolls : 1, o.free)]);
    if (uqChance && uqChance_(uqChance, o.src)) { const q = uniqueFor(d, o.boss); if (q) items.push(['uq', q]); }
    const val = ([k, w]) => k === 'uq' ? 9 : k === 'orb' ? (w === 'grace' ? 8 : 1) : w.r;
    items.sort((a, b) => val(a) - val(b));
    let first = null;
    items.forEach(([k, w], i) => {
      const last = i === items.length - 1 && items.length > 3;
      const e = drop(k, w, m, Object.assign({ spread: 0.06 }, o, { wait: (o.wait || 0) + i * 0.07 + (last ? 0.25 : 0) }));
      if (!first) first = e;
    });
    return first;
  }
  G.lootShower = shower;

  // ---------- The JACKPOT ----------
  // About one kill in two million or one chest in eighty thousand, and the odds climb with every hour of play
  // since the last one: most Wardens hit their first after about three hours.
  const jpOdds = () => { const S = S_(); return 1 + Math.max(0, ((S.st.playTime || 0) - ((S.jp && S.jp.at) || 0)) / 3600); };
  G.jackpotOdds = jpOdds;
  G.jackpotRoll = function (m, src) {
    const S = S_();
    if (!S.jp || R.rift || !S.hero || !S.hero.cls || S.tut >= 0) return false;
    // small fry count by weight, so a thicker Horde doesn't hand out more of them
    const k = src === 'chest' ? TUNE.jpChest : TUNE.jpKill * (m && G.SMALL[m.kind] ? m.w / G.MOB_KINDS[m.kind].w * (G.fodK ? G.fodK(m) : 1) * 0.7 : 3);
    if (!chance(k * jpOdds())) return false;
    G.jackpot(m);
    return true;
  };
  G.jackpot = function (m) {
    const S = S_();
    S.jp.n = (S.jp.n || 0) + 1; S.jp.at = S.st.playTime || 0;
    const at = m ? undefined : { a: 0.5, p: 0.8 };
    const gold = (G.D.incomeRef || 1) * TUNE.jpGold;
    G.addGold(gold, 'jackpot');
    // the haul: a heap of gear with a legendary floor, a unique for sure, a fistful of orbs
    shower(m || null, 24, 4, 1, { floorN: 8, spread: 0.22, at, rolls: 2, wait: 1.4, free: 1 });
    for (let i = 0; i < 8; i++) drop('orb', rollOrb(), m || null, { at, wait: 1.6 + i * 0.08, spread: 0.22 });
    G.first('jp'); G.feed('jackpot', 'the JACKPOT');
    emit('jackpot', m, gold, S.jp.n);
    // and then it rains for half a minute
    if (G.startEvent) G.startEvent('jackpot');
  };

  // Called by hero.js for every kill
  G.lootKill = function (m, src) {
    const S = S_(), h = S.hero;
    if (m.add) return null;
    const k = lootMult() * (m.br ? 2 : 1) * (m.stone ? 2 : 1);
    // the very first kill always drops something worth a look, and a rare comes early
    if (!S.st.drops) return drop('gear', G.pickItem(1), m);
    // a treasure goblin spills its sack: a real chest or two and a piece of gear
    if (m.kind === 'hoard' && m.gob) {
      S.st.goblins = (S.st.goblins || 0) + 1;
      for (let i = 0; i < randInt(1, 2); i++) { R.dropAt = m; G.spawnChest(Math.max(1, G.rollTier())); R.dropAt = null; }
      return drop('gear', rollGear(1), m);
    }
    // 4.0: inside a Siege the Hoarder and the rares spill a few pieces, not a heap (at most a few rare+ labels a minute;
    // the boss's loot moment is where items come from): a Hoarder 2-3 (a rare floor on one, a unique 3%), a rare 1-2
    const siege = !!(S.run && S.run.on);
    if (m.kind === 'hoard') { S.st.hoards++; emit('hoardDie', m); return siege ? shower(m, randInt(TUNE.hoardSiege[0], TUNE.hoardSiege[1]), 2, TUNE.hoardUqSiege, { floorN: 1, spread: 0.1 }) : shower(m, randInt(8, 12), 2, 0.04, { floorN: 2, spread: 0.1 }); }
    if (m.kind === 'guardian') return null; // the Rift or the invasion pays out on its own
    if (m.kind === 'rare') return shower(m, siege ? randInt(TUNE.rareSiege[0], TUNE.rareSiege[1]) : randInt(3, 5), 1, 0.006 * (uq('goldgrin') ? 1.5 : 1), { floorN: 1, spread: 0.05 });
    // the first champion ever always drops an epic
    if (m.kind === 'magic' && !S.st.firstMagic) { S.st.firstMagic = 1; return drop('gear', G.pickItem(3, true), m); }
    // everything else drops by its weight: a brute's worth of fodder drops about what a brute does
    // fodder: a pack drops what it did before 2.1, however many more bodies it now comes in
    // (3.6: a heavier small one, standing for m.ck of the bodies it was balanced at, drops for all of them)
    const ck = m.ck || 1;
    let p = m.kind === 'magic' ? TUNE.dropMagic : m.kind === 'fodder' ? TUNE.dropFodder * ck / ((G.TUNE.packMul || 1) * m.w / ck / G.MOB_KINDS.fodder.w) : TUNE.dropBrute * ((G.MOB_KINDS[m.kind] || {}).w || 1);
    p *= k * (G.torment ? G.torment().drop : 1);
    if (h.kills < 60 && !S.st.firstRare && chance(0.08)) { S.st.firstRare = 1; return drop('gear', G.pickItem(2, true), m); }
    let e = null;
    while (p > 0) {
      if (chance(Math.min(1, p))) e = chance(TUNE.orbShare * (G.D.orbMult || 1)) ? drop('orb', rollOrb(), m) : drop('gear', rollGear(m.kind === 'magic' ? 1 : 0), m);
      p -= 1;
    }
    return e;
  };

  // Bosses and lords burst into loot where they stood
  G.bossLoot = function (b, tier, count) {
    const S = S_();
    const at = { a: 0.5, p: 0.72 };
    const n = b.lord ? 7 + Math.floor(b.d / 6) : 3;
    // what the old boss chests promised (count items of at least the chest's tier), plus a spray of the rest
    shower(null, Math.round(n * count / (b.lord ? 2 : 1)), Math.min(5, tier), 0, { at, floorN: Math.round(count), src: 'boss' });
    for (let i = 0; i < (b.lord ? 2 : 0); i++) drop('orb', rollOrb(), null, { at, src: 'boss', wait: 0.2 + i * 0.1 });
    // the first lord always gives a unique: the Crab King's Pincer
    let q = null;
    if (b.lord && !S.st.firstLordUq) { S.st.firstLordUq = 1; q = S.uq.pincer ? uniqueFor(b.d, false) || 'goldgrin' : 'pincer'; }
    // boss-only uniques come from their own lord (the Mad Button, the First Hand), whatever slot of the route it stands in
    else if (uqChance_(b.lord ? 0.07 : 0.01, 'boss')) q = uniqueFor(b.d, G.isMadLord(b) || G.isHandLord(b));
    // (4.0, Wave 0: their first kill drops it for sure, by the land: 3.6 checked depths 39 and 64, which were no lords)
    if (G.isMadLord(b) && !S.uq.lastbutton) q = 'lastbutton';
    if (G.isHandLord(b) && !S.uq.firsthand) q = 'firsthand';
    if (q) drop('uq', q, null, { at, src: 'boss', wait: 1.2 });
  };

  // ---------- Picking up ----------
  function pickup(e, how) {
    const S = S_(), h = S.hero;
    const i = R.ground.indexOf(e);
    if (i < 0) return null;
    R.ground.splice(i, 1);
    let res = null;
    if (e.k === 'gear') res = G.lootItem(e.it, 'ground', G.makeGear(e.it.id, e.il));
    else if (e.k === 'orb') { h.orbs[e.orb] = (h.orbs[e.orb] || 0) + 1; S.st.orbs = (S.st.orbs || 0) + 1; }
    else if (e.k === 'uq') {
      const U = G.UNIQUES[e.q], it = G.ITEM_BY_ID[U.base];
      const first = !S.uq[e.q];
      S.uq[e.q] = (S.uq[e.q] || 0) + 1;
      res = G.lootItem(it, 'unique', G.makeUnique(e.q, e.il));
      res.first = first;
      if (first) G.feed('uq', U.name);
    }
    if (res && res.v) G.addGold(res.v, 'drop');
    if (e.k === 'gear' && e.it.r >= 1) G.addEssence(G.RARITIES[e.it.r].ess * 0.5 * (G.D.essMult || 1), 'drop');
    G.dirty();
    emit('pickup', e, how, res);
    return res;
  }
  G.pickup = pickup;
  G.pickupAll = () => { for (const e of R.ground.slice()) pickup(e, 'auto'); };

  // ---------- The feed: what friends see on the ladder ----------
  G.feed = function (kind, text) {
    const S = S_();
    S.feed.push([Date.now(), String(kind).slice(0, 16), String(text).slice(0, 48)]);
    if (S.feed.length > 6) S.feed.splice(0, S.feed.length - 6);
    emit('feed');
  };

  // A welcome pack: the first click after picking a class already hits a crowd
  G.on('classChosen', () => {
    const S = S_();
    // (4.0: every run opens with one, not only the first ever)
    if (S.depth || R.mobs.length || (S.hero.kills && !(S.run && S.run.on))) return;
    // (3.6: in the bodies the opening field holds: fewer, a little heavier)
    if (G.crowdUpdate) G.crowdUpdate();
    const cn = n => (G.crowdN ? G.crowdN(n) : n), n1 = cn(36), n2 = cn(24);
    for (let i = 0; i < n1; i++) G.makeMob('fodder', 0.32 + i * 0.36 / n1 + rand(-0.015, 0.015), rand(0.45, 0.68));
    for (let i = 0; i < n2; i++) G.makeMob('fodder', 0.72 + i * 0.17 / n2 + rand(-0.01, 0.01), rand(0.25, 0.45));
    G.makeMob('brute', 0.5, 0.4);
    R.hordeAcc = 1;
  });
  // ---------- Land mastery ----------
  // Three stars per land, kept forever (ascension too): slay its lord, slay
  // enough of its Horde, slay its lord fast. Each star: +2.5% damage and gold.
  // Corrupted cycles count toward the land they twist.
  const landRec = i => { const L = S_().lands || (S_().lands = {}); return L[i] || (L[i] = { k: 0, s: 0 }); };
  G.landRec = landRec;
  G.STAR_BITS = [1, 2, 4];
  G.starsOf = i => { const s = (S_().lands && S_().lands[i] && S_().lands[i].s) | 0; return (s & 1) + ((s >> 1) & 1) + ((s >> 2) & 1); };
  G.starCount = () => { let n = 0; for (let i = 0; i < G.REALMS.length; i++) n += G.starsOf(i); return n; };
  function star(i, bit) {
    const r = landRec(i);
    if (r.s & bit) return;
    r.s |= bit;
    G.recalc(); G.dirty();
    emit('landStar', i, bit, G.starCount());
  }
  G.landKill = function (m, n) {
    if (R.rift) return; // a Rift's Horde is its own
    const i = G.realmIndex(S_().depth), r = landRec(i);
    r.k += n || 1;
    if (!(r.s & 2) && r.k >= G.STAR_KILLS(i)) star(i, 2);
  };
  G.on('bossWin', (rew, b) => {
    if (!b.lord) return;
    const i = G.realmIndex(b.d);
    star(i, 1);
    // a fresh lord only, like a crown: not one worn down by earlier tries
    if (b.T - b.t <= G.STAR_SWIFT && b.scar === 1 && !b.rally) star(i, 4);
  });

  // Firsts: when this player first reached each milestone, so friends can race for them
  G.FIRSTS = [
    ['boss', 'First boss'], ['d5', 'The Crab King'], ['uq', 'First unique'], ['r4', 'First legendary'], ['d10', 'Depth 10'], ['rift5', 'Rift 5'],
    ['asc', 'First ascension'], ['evo', 'First evolution'], ['r5', 'First mythic'], ['d20', 'Depth 20'], ['rift15', 'Rift 15'], ['d30', 'Depth 30'],
    ['r6', 'First divine'], ['d40', 'The Mad Button'], ['rift30', 'Rift 30'], ['rift45', 'Rift 45'],
    ['d50', 'Depth 50'], ['d60', 'Depth 60'], ['d65', 'The First Hand'], ['d75', 'The Star Eater'], ['rift60', 'Rift 60'], ['all14', 'Every unique'], ['d80', 'Depth 80'], ['rift80', 'Rift 80'], ['jp', 'First JACKPOT'],
  ];
  G.first = function (k) {
    const S = S_();
    S.rec.firsts = S.rec.firsts || {};
    if (S.rec.firsts[k]) return;
    S.rec.firsts[k] = Date.now();
    emit('first', k);
  };
  G.on('bossWin', (rew, b) => {
    G.first('boss');
    for (const d of [5, 10, 20, 30, 40, 50, 60, 65, 75, 80]) if (b.d + 1 === d && b.lord) G.first('d' + d);
    // lord crowns: the fastest kill of a fresh lord (unwounded, no rally), and only at the edge of
    // your progress, so re-clearing old lands after ascending doesn't turn every crown into 0.1s
    const S = S_();
    if (b.lord && b.scar === 1 && !b.rally && b.d + 1 >= S.bestDepth) {
      const secs = Math.max(0.1, +(b.T - b.t + (b.enrT ? b.enrT - Math.max(0, b.enr) : 0)).toFixed(1));
      S.rec.crowns = S.rec.crowns || {};
      const was = S.rec.crowns[b.d];
      if (!(was > 0) || secs < was) { S.rec.crowns[b.d] = secs; emit('crownTime', b.d, secs, was); }
    }
  });
  G.on('pickup', e => { if (e.k === 'uq') { G.first('uq'); if (Object.keys(S_().uq).length >= G.UNIQUE_IDS.length) G.first('all14'); } });
  // every item, from the ground or from a chest, counts for the rarity firsts and the divine feed
  G.on('loot', (li, src) => {
    if (src === 'offline' || !li || !li.it) return;
    if (li.it.r >= 4) G.first('r' + li.it.r);
    if (li.it.r === 6) G.feed('divine', li.it.name);
  });
  G.on('ascend', g => { if (g) G.first('asc'); });
  G.on('evolve', () => G.first('evo'));
  G.on('riftEnd', r => { if (r.win) for (const L of [5, 15, 30, 45, 60, 80]) if (r.lvl >= L) G.first('rift' + L); });
  // what goes into the feed: records a friend would care about
  G.on('bossWin', (rew, b) => {
    const S = S_();
    if (!b.lord || b.d < (S.rec.fedLord || 0)) return;
    S.rec.fedLord = b.d + 1;
    if (G.isMadLord(b)) G.feed('mad', 'The Mad Button');
    else if (b.d >= 9) G.feed('lord', G.REALMS[G.realmIndex(b.d)].lordName);
  });
  G.on('evolve', (id, first) => { if (first) G.feed('evo', G.EVOS[id].name); });

  // ---------- Events ----------
  const busy = () => R.boss || R.rift || R.stun > 0;
  // ---------- Invasions ----------
  function startInvasion(k) {
    const v = G.INV_BY_ID[k] || G.INVASIONS[Math.floor(G.rng() * G.INVASIONS.length)];
    R.inv = { k: v.id, t: TUNE.invTime, T: TUNE.invTime, prog: 0, need: TUNE.invNeed, boss: null };
    R.surge = Math.max(R.surge || 0, 4);
    S_().st.invasions = (S_().st.invasions || 0) + 1;
    if (S_().run && S_().run.on) S_().run.inv = (S_().run.inv | 0) + 1;
    if (G.director) G.director.mark('invasion', TUNE.invTime);
    emit('invasion', R.inv, v);
  }
  G.startInvasion = startInvasion;
  function invasionBoss() {
    const r = R.inv, v = G.INV_BY_ID[r.k], d = G.depthNow();
    const m = G.makeMob('guardian', rand(0.35, 0.65), 0);
    m.w = 8; m.inv = r.k; m.lord = v.boss;
    // tough, but never more than about twenty seconds of the whole party's focus
    const hp = G.mobHp(d) * (TUNE.invBoss + 2 * d) * (G.omen ? G.omen().mobHp : 1);
    m.hp = m.max = Math.min(hp, Math.max(G.mobHp(d) * 12, (G.D.heroDps || 1) * TUNE.invFocus));
    r.boss = m.id;
    r.t = Math.max(r.t, TUNE.invBossTime);
    emit('invasionBoss', m, v);
  }
  function endInvasion(won) {
    const r = R.inv;
    if (!r) return;
    R.inv = null;
    if (G.director) G.director.end('invasion');
    // what's left of it goes home
    if (!won) for (const m of R.mobs.slice()) if (m.inv) { m.dead = true; R.mobs.splice(R.mobs.indexOf(m), 1); emit('mobFlee', m); }
    emit('invasionEnd', won, r);
  }
  G.endInvasion = endInvasion;
  G.invasionKill = function (m) {
    const r = R.inv;
    if (!r || !m.inv) return;
    if (r.boss === m.id) {
      S_().st.invWins = (S_().st.invWins || 0) + 1;
      // the herald's haul: a shower with a good floor and a real shot at a unique (4.0: a Siege's one invasion, 4-5 pieces)
      const sg = !!(S_().run && S_().run.on);
      shower(m, sg ? randInt(4, 5) : randInt(10, 14), 3, 0.2, { floorN: sg ? 2 : 3, spread: 0.12, rolls: 2 });
      for (let i = 0; i < 3; i++) drop('orb', rollOrb(), m, { wait: 0.3 + i * 0.1 });
      endInvasion(true);
      return;
    }
    if (!r.boss) { r.prog += m.w * 3; if (r.prog >= r.need) invasionBoss(); }
  };

  function spawnHoarder() {
    const m = G.makeMob('hoard', rand(0.15, 0.85), 0.55);
    m.move = 'hoard'; m.life = TUNE.hoardLife; m.dir = chance(0.5) ? 1 : -1; m.ph = rand(0, 6);
    emit('hoard', m);
  }
  // how the Hoarder runs: round the Button, just out of reach, then away
  G.moveMob = function (m, dt) {
    if (m.move === 'hoard') {
      m.life -= dt;
      m.ph += dt * 1.4;
      m.a += m.dir * dt * 0.055;
      if (m.a > 0.98 || m.a < 0.02) m.dir = -m.dir;
      m.a = G.clamp(m.a, 0, 1);
      m.p = 0.62 + 0.14 * Math.sin(m.ph);
      if (m.life <= 0) {
        m.dead = true; m.gone = true;
        const i = R.mobs.indexOf(m); if (i >= 0) R.mobs.splice(i, 1);
        emit('mobFlee', m); if (!m.gob) emit('hoardFlee', m);
      }
    }
  };
  G.SHRINES = {
    frenzy:    { col: '#ff7a2e', name: 'Shrine of Frenzy', desc: 'Attack speed ×2' },
    greed:     { col: '#ffd84a', name: 'Shrine of Greed', desc: 'Loot ×3, gold ×2' },
    storm:     { col: '#7fe9ff', name: 'Shrine of Storms', desc: '+3 bolts per click, every swing chains' },
    slaughter: { col: '#ff4f7e', name: 'Shrine of Slaughter', desc: 'Horde 2.5× thicker, XP ×2' },
  };
  // 4.0: inside a Siege a shrine is one of four kinds (G.SHRINE_KINDS: power, chance, pact, fury; G.shrineOpen(kind): the
  // Deeds' unlocks, the meta's): R.shrine = { kind, k (fury: its buff, else the kind: G.SHRINES[k] is what the stage
  // draws), a, p, t, ch (the Hand's charge, s) }. Outside a Siege, the 3.x buff shrines
  const FURY = ['frenzy', 'greed', 'storm', 'slaughter'];
  for (const k in G.SHRINE_KINDS || {}) if (k !== 'fury' && !G.SHRINES[k]) G.SHRINES[k] = G.SHRINE_KINDS[k];
  function spawnShrine(kind) {
    const siege = !!(S_().run && S_().run.on), fury = FURY[Math.floor(G.rng() * FURY.length)];
    if (siege && G.SHRINE_KINDS) {
      if (!kind) { const ks = Object.keys(G.SHRINE_KINDS).filter(k => !G.shrineOpen || G.shrineOpen(k)); kind = ks[G.weighted(ks.map(k => G.SHRINE_KINDS[k].w))]; }
      R.shrine = { kind, k: kind === 'fury' ? fury : kind, a: rand(0.2, 0.8), p: 0.5, t: TUNE.shrineLife, ch: 0 };
    } else R.shrine = { kind: 'fury', k: fury, a: rand(0.2, 0.8), p: 0.5, t: TUNE.shrineLife, ch: 0 };
    emit('shrine', R.shrine);
    return R.shrine;
  }
  G.spawnShrine = spawnShrine;
  // the Hand on the shrine (the UI calls it every frame the Hand rests there and the Button isn't held): it charges, and
  // at TUNE.shrineCharge s it's used. Returns the charge 0-1. G.shrineLeave(): the Hand moved off (the charge drains)
  G.shrineHold = function (dt) {
    const s = R.shrine;
    if (!s) return 0;
    s.ch = (s.ch || 0) + dt;
    if (s.ch >= TUNE.shrineCharge) { G.useShrine('hand'); return 1; }
    emit('shrineCharge', s, s.ch / TUNE.shrineCharge);
    return s.ch / TUNE.shrineCharge;
  };
  G.shrineLeave = () => { if (R.shrine) R.shrine.ch = 0; };
  // used: a Fury shrine's buff now; Power, Chance and Pact are the run's (js/run.js G.shrineEffect: a choice, a gamble, a
  // pact). (G.useShrine('hand') claims it at once: the 3.x tap and the bots)
  G.useShrine = function (how) {
    const s = R.shrine;
    if (!s) return false;
    R.shrine = null;
    if (s.kind && s.kind !== 'fury' && G.shrineEffect) G.shrineEffect(s.kind, s, how);
    else R.shr = { k: s.k, t: TUNE.shrineDur, T: TUNE.shrineDur };
    S_().st.shrines++;
    G.dirty(); G.recalc();
    emit('shrineUse', s, how);
    return true;
  };
  function openBreach() {
    R.breach = { a: rand(0.1, 0.9), t: TUNE.breachDur, T: TUNE.breachDur, n: 0, acc: 0 };
    S_().st.breaches++;
    emit('breach', R.breach);
  }
  function closeBreach() {
    const b = R.breach;
    R.breach = null;
    emit('breachEnd', b);
  }

  // ---------- Rifts ----------
  // (4.0: Rifts are off in the campaign: the machinery stays for the Vault and Push On)
  G.riftOpenable = () => { const S = S_(); return !!(S.hero && S.hero.cls && S.bestDepth >= 5) && !(S.run && S.run.on); };
  // The highest Rift you may open: what you've earned there, or close to your campaign depth
  G.riftMax = () => { const S = S_(); return Math.max(S.rift.open, S.bestDepth - 1); };
  G.riftStart = function (lvl) {
    if (R.town) return false;
    const S = S_(), rf = S.rift;
    lvl = Math.max(1, Math.min(G.riftMax(), lvl | 0));
    if (!G.riftOpenable() || R.boss || R.rift || R.stun > 0) return false;
    if (R.inv) endInvasion(false); // stepping into a Rift sends an invasion home
    for (const m of R.mobs) { m.dead = true; emit('mobFlee', m); }
    R.mobs.length = 0; if (R.shots) R.shots.length = 0;
    if (R.breach) closeBreach();
    R.shrine = null;
    R.dirty = true; // (Torment pays nothing in a Rift)
    R.rift = { lvl, max: G.riftMax(), d: G.riftDepth(lvl), t: TUNE.riftTime, T: TUNE.riftTime, prog: 0, need: TUNE.riftNeed, guard: null, kills: 0 };
    R.hordeAcc = 1; R.surgeT = 8; R.surge = 0;
    rf.runs++; S.st.rifts = (S.st.rifts || 0) + 1;
    G.dirty(); G.recalc();
    emit('riftStart', R.rift);
    return true;
  };
  function guardian() {
    const r = R.rift;
    const m = G.makeMob('guardian', rand(0.35, 0.65), 0);
    m.w = 10;
    m.hp = m.max = G.mobHp(r.d) * (TUNE.riftGuard + 2 * r.lvl) * (G.omen ? G.omen().mobHp : 1);
    m.lord = G.REALMS[G.realmIndex(r.d)].lord;
    r.guard = m.id;
    emit('riftGuardian', m);
  }
  G.riftKill = function (m) {
    const r = R.rift;
    if (!r) return;
    r.kills++;
    if (m.kind === 'guardian' && m.id === r.guard) { riftEnd(true); return; }
    if (!m.add && !r.guard) { r.prog += m.w; if (r.prog >= r.need) guardian(); }
  };
  function riftEnd(win, why) {
    const S = S_(), r = R.rift, rf = S.rift;
    if (!r) return;
    R.rift = null; R.dirty = true;
    const used = r.T - r.t;
    for (const m of R.mobs) { m.dead = true; if (win) { m.over = 2; emit('mobDie', m, 0, null, 'boss'); } else emit('mobFlee', m); }
    R.mobs.length = 0; if (R.shots) R.shots.length = 0;
    R.hordeAcc = 0; R.surgeT = Math.max(R.surgeT, 12);
    let up = 0;
    if (win) {
      // the faster the clear, the further the next Rift opens: +1, and +1 more for every 15s left
      up = Math.min(6, 1 + Math.floor(r.t / 15));
      const record = r.lvl > rf.best || (r.lvl === rf.best && (!rf.bestT || used < rf.bestT));
      if (record) { if (r.lvl > rf.best) G.feed('rift', 'Rift ' + r.lvl); rf.best = r.lvl; rf.bestT = used; }
      rf.open = Math.max(rf.open, r.lvl + up);
      const day = G.utcDayKey();
      if (rf.day.k !== day) rf.day = { k: day, l: 0 };
      if (r.lvl > rf.day.l || (r.lvl === rf.day.l && (!rf.day.t || used < rf.day.t))) { rf.day.l = r.lvl; rf.day.t = Math.max(1, Math.round(used)); }
      // the payout: a shower scaled by level, a unique chance, essence. Rifts far below what
      // you can open pay only the shower, so farming an easy one doesn't beat pushing
      const at = { a: 0.5, p: 0.75 }, d = r.d, k = G.clamp((r.lvl - ((r.max || r.lvl) - 10)) / 10, 0, 1);
      shower(null, Math.round((6 + Math.floor(r.lvl / 4)) * (0.4 + 0.6 * k)), Math.min(4, Math.floor(r.lvl / 10)), Math.min(0.2, 0.03 + 0.004 * r.lvl) * k, { at, d, floorN: 2, rolls: 2, boss: r.lvl >= 40, src: 'rift' });
      for (let i = 0; i < 1 + Math.floor(r.lvl / 20); i++) if (chance(k)) drop('orb', rollOrb(), null, { at, d, src: 'rift' });
      G.addEssence((3 + r.lvl * 0.5) * (0.2 + 0.8 * k) * (G.D.essMult || 1), 'rift');
    }
    G.dirty(); G.recalc();
    emit('riftEnd', { win, why: why || (win ? 'win' : 'time'), lvl: r.lvl, used, up, open: rf.open, best: rf.best, kills: r.kills });
  }
  G.riftEnd = riftEnd;

  // ---------- Tick ----------
  G.worldTick = function (dt) {
    const S = S_(), h = S.hero;
    // ground loot: the Warden gathers what's left lying around
    for (let i = R.ground.length - 1; i >= 0; i--) {
      const e = R.ground[i];
      if ((e.t += dt) >= e.life) pickup(e, 'auto');
    }
    if (!h || !h.cls) return;
    const L = G.landNow();
    // shrine buff
    if (R.shr && R.shr.t > 0 && (R.shr.t -= dt) <= 0) { R.shr = null; G.dirty(); G.recalc(); emit('shrineEnd'); }
    // the Rift
    if (R.rift) {
      const r = R.rift;
      if ((r.t -= dt) <= 0) riftEnd(false, 'time');
      return;
    }
    // an invasion runs on its own clock; a boss fight or a Rift sends it home
    if (R.inv) {
      if (R.boss) endInvasion(false);
      else if ((R.inv.t -= dt) <= 0) endInvasion(false);
    } else if (S.run && S.run.on ? S.depth >= TUNE.invSiegeFrom && (S.run.inv | 0) < 1 && S.run.invRoll < TUNE.invSiegeP : S.bestDepth >= 3) {
      // (4.0: inside a Siege at most one a run, in Acts II-III, with a 60% chance a run: S.run.invRoll is rolled at its start)
      // the clock runs through boss fights too; the invasion waits for the fight to end
      if (R.invT == null) R.invT = S.st.invasions ? rand(0.8, 1.2) * TUNE.invEvery : TUNE.invFirst;
      if (R.invT > 0) R.invT -= dt;
      if (R.invT <= 0 && !busy() && !R.march && !R.champ && !(R.bossReady && S.set.autoBoss) && !R.ev && (!G.director || G.director.can('invasion', 1))) { R.invT = rand(0.8, 1.2) * TUNE.invEvery; startInvasion(); }
    }
    // first-time timers: a Hoarder in the first minute, a shrine soon after (3.6: counted from the tutorial's end)
    const tut = !!(G.Tut && S.tut >= 0);
    if (R.hoardT == null) R.hoardT = S.st.hoards ? rand(0.6, 1.2) * TUNE.hoardEvery : TUNE.hoardFirst;
    if (R.shrineT == null) R.shrineT = S.st.shrines ? rand(0.6, 1.2) * TUNE.shrineEvery : TUNE.shrineFirst;
    if (R.breachT == null) R.breachT = S.st.breaches ? rand(0.7, 1.3) * TUNE.breachEvery : TUNE.breachFirst;
    // the first of each comes on a fixed clock; after that the land's rule speeds them up
    // (3.0: the clocks run through boss fights too, and what's due comes as soon as the fight is over)
    if (!tut) {
      R.hoardT = Math.max(0, R.hoardT - dt * (S.st.hoards ? L.hoard || 1 : 1));
      if (!R.shrine && !R.shr) R.shrineT = Math.max(0, R.shrineT - dt * (S.st.shrines ? L.shrine || 1 : 1));
      if (!R.breach && S.bestDepth >= 3) R.breachT = Math.max(0, R.breachT - dt * (L.breach || 1));
    }
    // (3.6: what's due comes when the pacing director has room for a small moment: one at a time, never on a boss's heels)
    const room = () => !busy() && !R.march && (!G.director || G.director.can('small', 0));
    const took = () => { if (G.director) G.director.mark('small'); };
    if (R.hoardT <= 0 && room()) { R.hoardT = rand(0.7, 1.3) * TUNE.hoardEvery; spawnHoarder(); took(); }
    if (!R.shrine && !R.shr && R.shrineT <= 0 && room()) { R.shrineT = rand(0.7, 1.3) * TUNE.shrineEvery; spawnShrine(); took(); }
    if (!R.breach && S.bestDepth >= 3 && R.breachT <= 0 && room()) { R.breachT = rand(0.7, 1.3) * TUNE.breachEvery; openBreach(); took(); }
    // an untouched shrine is claimed by the Warden (4.0: inside a Siege it fades: it was the Hand's to charge)
    if (R.shrine && (R.shrine.t -= dt) <= 0) { if (S.run && S.run.on) { const s0 = R.shrine; R.shrine = null; emit('shrineFade', s0); } else G.useShrine('auto'); }
    // the Breach pours mobs out of one spot
    if (R.breach) {
      const b = R.breach;
      if (R.boss) closeBreach();
      else {
        b.acc += dt * TUNE.breachRate;
        while (b.acc >= 1) { b.acc -= 1; if (R.mobs.length < 240) G.spawnPack(false, b.a); }
        if ((b.t -= dt) <= 0) closeBreach();
      }
    }
  };
  // drop the per-run world without handing its loot to anyone (a hard reset or a loaded save)
  G.worldClear = function () {
    R.ground.length = 0; R.rift = null; R.shrine = null; R.shr = null; R.breach = null; R.inv = null;
    R.hoardT = R.shrineT = R.breachT = R.invT = null;
    R.btnDown = 0; R.stun = 0;
    if (G.eventsClear) G.eventsClear();
  };
  G.worldReset = function () {
    G.pickupAll();
    R.rift = null; R.shrine = null; R.shr = null; R.breach = null;
    if (R.inv) endInvasion(false);
    // (3.6: the invasion clock runs on into the new run; it was reset with every fall, so invasions hardly ever came)
    if (G.R.ev && G.endEvent) G.endEvent(false);
  };
  // Leaving the screen for a while: the Rift collapses, the loot is gathered
  G.worldAway = function () {
    if (R.rift) riftEnd(false, 'away');
    G.pickupAll();
    R.shrine = null; R.breach = null;
    // away from the screen, the rest of a Jackpot Frenzy's rain still lands
    if (G.R.ev && G.R.ev.k === 'jackpot') for (let i = Math.floor(G.R.ev.t / 0.5); i > 0; i--) G.spawnChest(Math.min(6, G.rollTier() + 2));
    if (G.R.ev && G.endEvent) G.endEvent(false);
  };
})(globalThis.G = globalThis.G || {});
