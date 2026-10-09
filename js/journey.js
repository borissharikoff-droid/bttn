// BTTN — long-term goals and the daily rhythm, DOM-free.
//  • The Journey: an ordered road of goals, always one on screen, each with a
//    reward (4.0: the meta's: eggs, Embers, Fame, Gems; no more +2% damage a step). It never runs out.
//  • The Omen of the day: a daily twist to the Horde, the same for everyone.
//  • The daily Bounty: slay enough of today's Horde for eggs and a chest.
(function (G) {
  'use strict';
  const J = G.Journey = {};

  // ---------- The Journey ----------
  // 4.0 (DESIGN §4.1 'no hidden power'): a finished step no longer makes the Warden stronger (J.bonus is 1), and its rewards
  // are the meta's (eggs, Embers, Fame, Gems), never the run's power: the 3.x chests opened at any rarity mid-run and the
  // shards and essence went into the Siege. The road is the Siege's now: lands, lords, the Void, wins, Heat, the Codex, the
  // town (the Ascend steps became wins; the enchant +15/+20 steps, out of reach in a Siege, became Temper and Codex goals)
  const maxWorn = (S, f) => G.SLOTS.reduce((m, s) => { const g = S.hero.eq[s]; return g ? Math.max(m, f(g)) : m; }, 0);
  const bestRarity = S => { let r = -1; for (const id in S.coll) if (S.coll[id] > 0) r = Math.max(r, G.ITEM_BY_ID[id] ? G.ITEM_BY_ID[id].r : -1); return r; };
  const perkRanks = S => Object.keys(S.hero.perks || {}).filter(k => !k.startsWith('evo_')).reduce((a, k) => a + S.hero.perks[k], 0);
  const maxedPerk = S => Object.keys(G.PERKS).some(k => (S.hero.perks[k] || 0) >= G.PERKS[k].max) ? 1 : 0;
  const evos = S => Object.keys(S.rec.evos || {}).length;
  const depth = n => ({ text: 'Reach depth ' + n, cur: S => Math.min(n, (S.bestDepth | 0) + 1), need: n });
  const uniques = S => Object.keys(S.uq || {}).length;
  const codexN = S => Object.keys(S.codex || {}).length;
  const wins = S => S.st.siegeWins | 0;
  const heatWon = S => Math.max(0, (S.heatWon == null ? -1 : S.heatWon) + 1);
  const lords = S => S.st.lordKills | 0;
  const deeds = S => Object.keys(S.ach || {}).length + Object.keys(S.deeds || {}).length;
  const town = S => (G.townLvl ? G.townLvl() : 0);
  const hall = S => Object.values(S.legacy || {}).reduce((a, v) => a + (v | 0), 0);
  const STEPS = [
    { text: 'Slay 300 of the Horde', cur: S => S.hero.kills, need: 300, rew: { eggs: 1 } },
    { text: 'Catch a Hoarder', cur: S => S.st.hoards || 0, need: 1, rew: { eggs: 1 }, hint: 'Tap it so the Warden gives chase' },
    { text: 'Defeat a boss', cur: S => S.st.bossKills, need: 1, rew: { embers: 10 } },
    { text: 'Pick 5 cards', cur: perkRanks, need: 5, rew: { embers: 10 } },
    { text: 'Wear a rare item', cur: S => maxWorn(S, g => g.r >= 2 ? 1 : 0), need: 1, rew: { embers: 15 } },
    { text: 'Slay a land’s lord', cur: lords, need: 1, rew: { eggs: 2 } },
    Object.assign(depth(5), { rew: { embers: 20 } }),
    { text: 'Find a unique', cur: uniques, need: 1, rew: { embers: 25 }, hint: 'Lords, Hoarders and champions drop them' },
    { text: 'Build in the town', cur: town, need: 1, rew: { fame: 10 }, hint: 'Embers from the Furnace build it' },
    { text: 'Hatch 3 different pets', cur: S => Object.keys(S.pets).length, need: 3, rew: { eggs: 2 } },
    { text: 'Buy a Hall of Fame rank', cur: hall, need: 1, rew: { embers: 25 }, hint: 'Fame buys it, in the Temple' },
    Object.assign(depth(7), { text: 'Reach Act II (depth 7)', rew: { eggs: 3 } }),
    { text: 'Temper an item to +5', cur: S => maxWorn(S, g => g.e), need: 5, rew: { embers: 30 }, hint: 'Temper at camp: +2 on everything worn' },
    { text: 'Find a legendary', cur: S => bestRarity(S) >= 4 ? 1 : 0, need: 1, rew: { embers: 30 } },
    { text: 'Max a perk', cur: maxedPerk, need: 1, rew: { eggs: 2 } },
    { text: 'Evolve a perk', cur: evos, need: 1, rew: { embers: 40 }, hint: 'Max a perk while wearing its evolution gear' },
    { text: 'Slay 10 lords', cur: lords, need: 10, rew: { fame: 25 } },
    { text: 'Complete 10 Deeds', cur: deeds, need: 10, rew: { gems: 5 } },
    Object.assign(depth(13), { text: 'Reach Act III (depth 13)', rew: { eggs: 4 } }),
    { text: 'Slay 10 rares', cur: S => S.st.rares || 0, need: 10, rew: { eggs: 3 } },
    { text: 'Collect 4 Codex entries', cur: codexN, need: 4, rew: { embers: 60 } },
    Object.assign(depth(16), { text: 'Reach the Void (depth 16)', rew: { fame: 40 } }),
    { text: 'Win a Siege', cur: wins, need: 1, rew: { gems: 10, embers: 100 } },
    { text: 'Discover 3 evolutions', cur: evos, need: 3, rew: { embers: 80 } },
    { text: 'Reach town level 10', cur: town, need: 10, rew: { eggs: 5 } },
    { text: 'Win at Heat 1', cur: heatWon, need: 2, rew: { fame: 60 } },
    { text: 'Find a mythic', cur: S => bestRarity(S) >= 5 ? 1 : 0, need: 1, rew: { eggs: 5 } },
    { text: 'Slay 40,000 of the Horde', cur: S => S.hero.kills, need: 40000, rew: { embers: 120 } },
    { text: 'Complete 30 Deeds', cur: deeds, need: 30, rew: { gems: 10 } },
    { text: 'Win 3 Sieges', cur: wins, need: 3, rew: { embers: 150 } },
    { text: 'Hatch every pet', cur: S => Object.keys(S.pets).length, need: 12, rew: { eggs: 10 } },
    { text: 'Discover 6 evolutions', cur: evos, need: 6, rew: { embers: 200 } },
    { text: 'Find a divine', cur: S => bestRarity(S) >= 6 ? 1 : 0, need: 1, rew: { eggs: 8 } },
    { text: 'Win at Heat 3', cur: heatWon, need: 4, rew: { fame: 100 } },
    { text: 'Collect 8 Codex entries', cur: codexN, need: 8, rew: { embers: 250 } },
    { text: 'Reach town level 25', cur: town, need: 25, rew: { gems: 15 } },
    { text: 'Slay 100 lords', cur: lords, need: 100, rew: { eggs: 10 } },
    Object.assign(depth(20), { text: 'Push On to depth 20', rew: { embers: 300 } }),
    { text: 'Win 10 Sieges', cur: wins, need: 10, rew: { fame: 150 } },
    { text: 'Complete 60 Deeds', cur: deeds, need: 60, rew: { gems: 20 } },
    { text: 'Win at Heat 5', cur: heatWon, need: 6, rew: { fame: 200 } },
    { text: 'Slay 400,000 of the Horde', cur: S => S.hero.kills, need: 400000, rew: { eggs: 10 } },
    { text: 'Collect 14 Codex entries', cur: codexN, need: 14, rew: { embers: 500 } },
    { text: 'Discover 9 evolutions', cur: evos, need: 9, rew: { fame: 250 } },
    { text: 'Reach town level 40', cur: town, need: 40, rew: { gems: 25 } },
    { text: 'Find every unique', cur: uniques, need: G.UNIQUE_IDS ? G.UNIQUE_IDS.length : 19, rew: { fame: 300 } },
    { text: 'Win at Heat 7', cur: heatWon, need: 8, rew: { fame: 300 } },
    { text: 'Win 25 Sieges', cur: wins, need: 25, rew: { embers: 1000 } },
    { text: 'Complete 100 Deeds', cur: deeds, need: 100, rew: { gems: 30 } },
    { text: 'Discover every evolution', cur: evos, need: 15, rew: { fame: 400 } },
    { text: 'Win at Heat 10', cur: heatWon, need: 11, rew: { fame: 500, gems: 50 } },
  ];
  // Past the written road it keeps going: 50 more lords at a time
  J.step = function (i) {
    if (i < STEPS.length) return STEPS[i];
    const k = i - STEPS.length + 1, n = 100 + 50 * k;
    return { text: 'Slay ' + n + ' lords', cur: lords, need: n, rew: { eggs: 5, embers: 200 + 50 * k } };
  };
  J.count = STEPS.length;
  // where each step of the pre-1.0 road (44 steps) sat (an old save's index; 4.0 keeps the count, the road is new)
  const V0 = [0, 2, 3, 4, 5, 8, 9, 10, 12, 13, 14, 15, 16, 17, 20, 21, 22, 23, 24, 25, 26, 28, 29, 30, 31, 32, 33, 36, 37, 38, 39, 40, 41, 42, 43, 46, 47, 48, 49, 50, 51, 52, 53, 54];
  J.fromV0 = k => (k = Math.max(0, k | 0)) < V0.length ? V0[k] : k + (STEPS.length - V0.length);
  J.current = () => J.step(G.S.journey || 0);
  J.progress = function () {
    const st = J.current(), S = G.S;
    return { st, cur: Math.min(st.need, st.cur(S) || 0), need: st.need };
  };
  // 4.0: no hidden power: the Journey's steps no longer add damage (DESIGN §4.1)
  J.bonus = () => 1;

  function give(rew) {
    const S = G.S, got = [];
    if (rew.eggs) { G.addEggs(rew.eggs); got.push(['ic_egg', rew.eggs]); }
    if (rew.embers) { if (G.addEmbers) G.addEmbers(rew.embers, 'journey'); else S.embers = (S.embers || 0) + rew.embers; got.push(['ic_ember', rew.embers]); }
    if (rew.fame) { S.fame += rew.fame; S.fameTotal += rew.fame; got.push(['ic_fame', rew.fame]); }
    if (rew.gems && G.addGems) { G.addGems(rew.gems, 'journey'); got.push(['ic_gem', rew.gems]); }
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
  // (3.6: the day is looked up once per tick of play, not on every kill)
  G.omen = function () {
    const pt = G.S && G.S.st ? G.S.st.playTime : -1;
    if (G.omen._v && G.omen._pt === pt) return G.omen._v;
    G.omen._pt = pt;
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
  J.bountyKill = function (n) {
    const S = G.S;
    if (!S.bounty || S.bounty.day !== G.todayKey()) bounty();
    if (S.bounty.done) return;
    if ((S.bounty.n += n || 1) >= J.BOUNTY) {
      S.bounty.done = true;
      // (4.0: eggs and Embers: a chest opened mid-Siege ignored the run's rarity cap)
      const got = give({ eggs: 3, embers: 20 + 5 * Math.min(17, S.bestDepth | 0) });
      G.emit('bounty', got);
    }
  };
})(globalThis.G = globalThis.G || {});
