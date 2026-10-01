// BTTN — long-term goals and the daily rhythm, DOM-free.
//  • The Journey: an ordered road of goals, always one on screen, each with a
//    reward and a permanent +2% Warden damage. It never runs out.
//  • The Omen of the day: a daily twist to the Horde, the same for everyone.
//  • The daily Bounty: slay enough of today's Horde for eggs and a chest.
(function (G) {
  'use strict';
  const J = G.Journey = {};

  // ---------- The Journey ----------
  const maxWorn = (S, f) => G.SLOTS.reduce((m, s) => { const g = S.hero.eq[s]; return g ? Math.max(m, f(g)) : m; }, 0);
  const bestRarity = S => { let r = -1; for (const id in S.coll) if (S.coll[id] > 0) r = Math.max(r, G.ITEM_BY_ID[id] ? G.ITEM_BY_ID[id].r : -1); return r; };
  const perkRanks = S => Object.keys(S.hero.perks || {}).filter(k => !k.startsWith('evo_')).reduce((a, k) => a + S.hero.perks[k], 0);
  const maxedPerk = S => Object.keys(G.PERKS).some(k => (S.hero.perks[k] || 0) >= G.PERKS[k].max) ? 1 : 0;
  const evos = S => Object.keys(S.rec.evos || {}).length;
  const starsTotal = S => G.ITEMS.reduce((a, it) => a + G.stars(S.coll[it.id] || 0), 0);
  const depth = n => ({ text: 'Clear depth ' + n, cur: S => S.bestDepth, need: n });
  const uniques = S => Object.keys(S.uq || {}).length;
  const rift = S => (S.rift && S.rift.best) || 0;
  const STEPS = [
    { text: 'Slay 300 mobs', cur: S => S.hero.kills, need: 300, rew: { eggs: 1 } },
    { text: 'Catch a Hoarder', cur: S => S.st.hoards || 0, need: 1, rew: { eggs: 1 }, hint: 'Tap it so the Warden gives chase' },
    { text: 'Defeat a boss', cur: S => S.st.bossKills, need: 1, rew: { chest: 2 } },
    { text: 'Pick 5 perks', cur: perkRanks, need: 5, rew: { ess: 5 } },
    { text: 'Wear a rare item', cur: S => maxWorn(S, g => g.r >= 2 ? 1 : 0), need: 1, rew: { shards: 30 } },
    Object.assign(depth(5), { text: 'Slay the depth 5 lord', rew: { eggs: 2 } }),
    { text: 'Find a unique', cur: uniques, need: 1, rew: { chest: 3 }, hint: 'From lords, rares, Hoarders, Rift Guardians' },
    { text: 'Collect 5 orbs', cur: S => S.st.orbs || 0, need: 5, rew: { ess: 8 }, hint: 'Party tab: pick an item, then an orb' },
    { text: 'Hatch 3 different pets', cur: S => Object.keys(S.pets).length, need: 3, rew: { eggs: 2 } },
    { text: 'Enchant to +5', cur: S => maxWorn(S, g => g.e), need: 5, rew: { ess: 10 } },
    Object.assign(depth(10), { rew: { eggs: 3 } }),
    { text: 'Clear a Rift', cur: rift, need: 1, rew: { chest: 3 } },
    { text: 'Ascend once', cur: S => S.ascensions, need: 1, rew: { fame: 5 } },
    { text: 'Find a legendary', cur: S => bestRarity(S) >= 4 ? 1 : 0, need: 1, rew: { chest: 3 } },
    { text: 'Max a perk', cur: maxedPerk, need: 1, rew: { eggs: 2 } },
    { text: 'Evolve a perk', cur: evos, need: 1, rew: { chest: 4 }, hint: 'Max a perk in its evolution gear (see Collection)' },
    { text: 'Slay 10 rares', cur: S => S.st.rares || 0, need: 10, rew: { eggs: 3 } },
    Object.assign(depth(15), { rew: { ess: 40 } }),
    { text: 'Clear Rift 15', cur: rift, need: 15, rew: { chest: 4 } },
    { text: 'Find 4 kinds of unique', cur: uniques, need: 4, rew: { eggs: 4 } },
    { text: 'Slay 40,000 mobs', cur: S => S.hero.kills, need: 40000, rew: { chest: 4 } },
    Object.assign(depth(20), { rew: { eggs: 5 } }),
    { text: 'Discover 3 evolutions', cur: evos, need: 3, rew: { chest: 5 } },
    { text: 'Ascend 5 times', cur: S => S.ascensions, need: 5, rew: { fame: 25 } },
    { text: 'Enchant to +10', cur: S => maxWorn(S, g => g.e), need: 10, rew: { shards: 300 } },
    { text: 'Find a mythic', cur: S => bestRarity(S) >= 5 ? 1 : 0, need: 1, rew: { eggs: 5 } },
    Object.assign(depth(25), { rew: { chest: 5 } }),
    { text: 'Clear Rift 25', cur: rift, need: 25, rew: { chest: 5 } },
    { text: 'Hatch every pet', cur: S => Object.keys(S.pets).length, need: 12, rew: { eggs: 10 } },
    Object.assign(depth(30), { rew: { ess: 200 } }),
    { text: 'Discover 6 evolutions', cur: evos, need: 6, rew: { chest: 6 } },
    { text: 'Find a divine', cur: S => bestRarity(S) >= 6 ? 1 : 0, need: 1, rew: { eggs: 8 } },
    { text: 'Earn 60 collection stars', cur: starsTotal, need: 60, rew: { ess: 300 }, hint: 'Item stars at 1, 10, 100, 1K, 10K copies' },
    Object.assign(depth(35), { rew: { chest: 6 } }),
    { text: 'Find 8 kinds of unique', cur: uniques, need: 8, rew: { chest: 6 } },
    { text: 'Clear Rift 35', cur: rift, need: 35, rew: { fame: 80 } },
    { text: 'Ascend 10 times', cur: S => S.ascensions, need: 10, rew: { fame: 60 } },
    { text: 'Beat the Mad Button (depth 40)', cur: S => S.bestDepth, need: 40, rew: { fame: 100, chest: 6 } },
    { text: 'Slay 400,000 mobs', cur: S => S.hero.kills, need: 400000, rew: { eggs: 10 } },
    Object.assign(depth(45), { rew: { eggs: 10 } }),
    { text: 'Enchant to +15', cur: S => maxWorn(S, g => g.e), need: 15, rew: { shards: 1500 } },
    { text: 'Earn 110 collection stars', cur: starsTotal, need: 110, rew: { ess: 1000 } },
    { text: 'Slay 100 rares', cur: S => S.st.rares || 0, need: 100, rew: { chest: 6 } },
    Object.assign(depth(50), { rew: { chest: 6, eggs: 10 } }),
    { text: 'Clear Rift 50', cur: rift, need: 50, rew: { chest: 6, fame: 150 } },
    { text: 'Find every unique', cur: uniques, need: G.UNIQUE_IDS ? G.UNIQUE_IDS.length : 19, rew: { fame: 250 } },
    { text: 'Discover 9 evolutions', cur: evos, need: 9, rew: { fame: 150 } },
    { text: 'Ascend 25 times', cur: S => S.ascensions, need: 25, rew: { fame: 200 } },
    { text: 'Enchant to +20', cur: S => maxWorn(S, g => g.e), need: 20, rew: { shards: 3000 } },
    Object.assign(depth(55), { rew: { eggs: 15 } }),
    { text: 'Slay 4,000,000 mobs', cur: S => S.hero.kills, need: 4e6, rew: { chest: 6, eggs: 15 } },
    { text: 'Discover every evolution', cur: evos, need: 11, rew: { fame: 250 } },
    { text: 'Earn 160 collection stars', cur: starsTotal, need: 160, rew: { fame: 300 } },
    Object.assign(depth(60), { rew: { chest: 6, eggs: 20 } }),
    { text: 'Earn 10,000 total fame', cur: S => S.fameTotal, need: 10000, rew: { eggs: 25 } },
  ];
  // Past the written road it keeps going: ten depths at a time
  J.step = function (i) {
    if (i < STEPS.length) return STEPS[i];
    const n = 60 + 10 * (i - STEPS.length + 1);
    return Object.assign(depth(n), { rew: { chest: 6, eggs: 5 + Math.floor(n / 20), fame: n } });
  };
  J.count = STEPS.length;
  // where each step of the pre-1.0 road (44 steps) sits on this one
  const V0 = [0, 2, 3, 4, 5, 8, 9, 10, 12, 13, 14, 15, 16, 17, 20, 21, 22, 23, 24, 25, 26, 28, 29, 30, 31, 32, 33, 36, 37, 38, 39, 40, 41, 42, 43, 46, 47, 48, 49, 50, 51, 52, 53, 54];
  J.fromV0 = k => (k = Math.max(0, k | 0)) < V0.length ? V0[k] : k + (STEPS.length - V0.length);
  J.current = () => J.step(G.S.journey || 0);
  J.progress = function () {
    const st = J.current(), S = G.S;
    return { st, cur: Math.min(st.need, st.cur(S) || 0), need: st.need };
  };
  // Each finished step makes the Warden 2% stronger, for good
  J.bonus = () => 1 + 0.02 * (G.S.journey || 0);

  function give(rew) {
    const S = G.S, D = G.D, got = [];
    if (rew.eggs) { G.addEggs(rew.eggs); got.push(['ic_egg', rew.eggs]); }
    if (rew.ess) { G.addEssence(rew.ess * (D.essMult || 1)); got.push(['ic_ess', Math.round(rew.ess * (D.essMult || 1))]); }
    if (rew.shards) { S.hero.shards += rew.shards; got.push(['ic_shard', rew.shards]); }
    if (rew.fame) { S.fame += rew.fame; S.fameTotal += rew.fame; got.push(['ic_fame', rew.fame]); }
    if (rew.chest != null) { const tier = Math.min(6, rew.chest); G.openChest(G.makeChest(tier, 'ghost'), 'journey'); got.push(['chest_' + tier, 1]); }
    return got;
  }
  let checkT = 0;
  G.journeyTick = function (dt) {
    if ((checkT -= dt) > 0) return;
    checkT = 0.5;
    const S = G.S;
    if (!S.hero || !S.hero.cls) return;
    bounty();
    for (let guard = 0; guard < 3; guard++) {
      const p = J.progress();
      if (p.cur < p.need) break;
      S.journey = (S.journey || 0) + 1;
      const got = give(p.st.rew || {});
      G.dirty(); G.recalc();
      G.emit('journey', p.st, got);
    }
  };

  // ---------- The Omen of the day ----------
  G.OMENS = [
    { id: 'bloodmoon', name: 'Blood Moon', desc: '+50% XP, mobs 25% tougher', xp: 1.5, mobHp: 1.25 },
    { id: 'goldrush', name: 'Gold Rush', desc: '+60% Horde gold', gold: 1.6 },
    { id: 'swarm', name: 'The Swarm', desc: 'Horde 60% thicker, +30% XP', horde: 1.6, xp: 1.3 },
    { id: 'champions', name: 'Champions’ Day', desc: '3× champions and rares, +50% loot', champ: 3, loot: 1.5 },
    { id: 'storm', name: 'Storm Day', desc: '+1 bolt per click', thunder: 1 },
    { id: 'giants', name: 'Night of Giants', desc: 'Bosses 30% tougher, 2× rewards', bossHp: 1.3, bossRew: 2 },
    { id: 'fortune', name: 'Fortune', desc: '+25% luck, 2× wisps', luck: 0.25, wisp: 2 },
  ];
  const DEF = { xp: 1, mobHp: 1, gold: 1, horde: 1, champ: 1, loot: 1, thunder: 0, bossHp: 1, bossRew: 1, luck: 0, wisp: 1 };
  function hashDay(k) { let h = 7; for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0; return h; }
  G.omen = function () {
    const k = G.utcDayKey ? G.utcDayKey() : G.todayKey();
    if (G.omen._k !== k) { G.omen._k = k; G.omen._v = Object.assign({}, DEF, G.OMENS[hashDay(k) % G.OMENS.length]); }
    return G.omen._v;
  };

  // ---------- The daily Bounty ----------
  J.BOUNTY = 18000;
  function bounty() {
    const S = G.S, k = G.todayKey();
    if (S.bounty.day !== k) { S.bounty = { day: k, n: 0, done: false }; }
  }
  J.bountyKill = function () {
    const S = G.S;
    if (!S.bounty || S.bounty.day !== G.todayKey()) bounty();
    if (S.bounty.done) return;
    if (++S.bounty.n >= J.BOUNTY) {
      S.bounty.done = true;
      const got = give({ eggs: 3, chest: Math.min(6, 1 + Math.floor(S.bestDepth / 8)) });
      G.emit('bounty', got);
    }
  };
})(globalThis.G = globalThis.G || {});
