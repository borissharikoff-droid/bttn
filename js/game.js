// BTTN — game logic. No DOM access here: this file also runs in the Node
// balance simulator (tools/sim.js). It changes G.S and emits events.
(function (G) {
  'use strict';
  const { clamp, chance, weighted, pick, rand, emit } = G;

  const TUNE = G.TUNE = {
    chestNeed: 300,         // clicks per chest (4.0: 10 -> 300, about one chest every 30 s of holding: chests are few, each an event)
    autoChestFactor: 0.1,   // auto clicks give less chest progress than real ones
    depthGold: 1.08,        // gold multiplier per depth
    bossBase: 400,          // boss hp at depth 0
    bossGrowth: 2.5,        // boss hp growth per depth
    lordHp: 2.2, // 3.4: a lord every third depth now, so a little less of a wall (was 3)
    bossCall: 3,            // seconds of warning before a ready boss arrives on its own
    marchTime: 2.4,         // 3.4: after a boss, the party marches on to the next zone for this long (no Horde meanwhile)
    heroBossPct: 0.35,      // share of hero income dealt to bosses as dps
    comboTime: 1.25,
    // 2.5: the game is balanced for the Button held down (10 clicks a second); faster clicking, or an
    // autoclicker, counts no more than that
    maxManualCps: 10,
    // (4.0: Golden Clicks every 100-160 s, DESIGN §5.8)
    wispMin: 100, wispMax: 160, wispLife: 13, wispRain: 2,
    mimicClicks: 15, mimicLife: 8, mimicIdle: 30,
    blazeLife: 6,
    // 2.2: every boss fight lasts at least this long however strong the party is (s of its damage)
    // 4.0: a lord is the run's check (16 -> 20 s); an act boss 24 s and the Mad Button 30 s, each with half again the
    // health (and an act boss one more phase, the Mad Button one more affix)
    bossMin: 9, bossMinLord: 20, bossMinAct: 24, bossMinFinal: 30, bossMinOld: 0.25, bossClickK: 0.9, actHp: 1.5, finalHp: 1.5,
    // 2.3: a boss out of time enrages for this long (s); DOOM from this depth on; Rally per failed try and its cap
    enrage: 10, enrageLord: 14, doomFrom: 5, rally: 0.15, rallyMax: 4,
    // a boss the party lost to heals back this share of the damage it took (less after each try: / (1 + tries)); scarHealLord for a
    // lord, an act boss or the Mad Button inside a Siege (a lost lord fight costs a pip: the lord is the run's check)
    // (4.0: a lord heals back 80% of its wounds, not 30%: a lost lord fight costs a pip and the lord stays the run's wall;
    // Rally still grows with each try)
    scarHeal: 0.3, scarHealLord: 0.8,
    // boss affixes from this depth; a Shield cracked stays down this long; Regenerating heals this share a second
    affixFrom: 8, shieldDown: 10, bossRegen: 0.008,
    // 4.0: rarity opens with this run's depth (not the lifetime best): rare from depth 2, epic 4, legendary 7, mythic 10,
    // divine 13 (+ Heat/3). (ascFrom is gone with the voluntary ascension; kept for old readers)
    rarityAt: [0, 0, 2, 4, 7, 10, 13], ascFrom: 15,
    smallChestK: 0.1,       // the little chests the Horde drops are worth a tenth of a real one
    smallItem: 0.05,        // and hold an item one time in twenty
    overflowK: 0.5,         // a full field: the lowest chest bursts and half of it is lost
    goldBase: 1.08,         // 3.6: all gold, in place of the Lucky Spin's passive share (~8-10% of income for an idle player)
    // 3.6: the pacing director (see G.director): the least time between two big moments' starts, the breath after
    // a boss fight or a march, and the quiet after a fall (the blessing and the new run)
    dirGap: 14, dirAfterBoss: 8, dirAfterFall: 12, dirSmallGap: 6,
    // 3.6: a zone is fought for at least this long (s of field time) before its boss comes: the clear bar can't
    // fill faster (it filled in a second or two after each march for a strong party); half that on ground already won
    // (4.0: 24 -> 20, DESIGN §15's own lever for a Siege won past 20 minutes: lords are full fights again)
    zoneMin: 20, zoneMinOld: 12,
    // 4.0 attrition: a boss kill heals the Button and the party this share, a lord this share; Mend is charges (per land,
    // each heals mendHeal, mendLock s apart); DOOM takes this share of what it would (by Heat: 0-2, 3-5, 6+)
    healBoss: 0.1, healLord: 0.25, mendCharges: 2, mendHeal: 0.35, mendLock: 8, doomK: [0.64, 0.8, 1],
    // 4.0: a Siege boss's least fight length is measured by the party's damage averaged over this many s of field time
    // (0: by the steady damage only, as before)
    bossFloorAvg: 15,
    // 4.0: Heat n: the Horde's and the bosses' health x heatHp^n, bites x heatBite^n (DESIGN §6.3 said 1.15 / 1.10; measured
    // with the full meta (x2.0 damage, x2.9 on bosses, x1.3 health: over the design's x1.6 / x1.9 / x1.35) and Heat's own
    // rarity +n/3, the active bot won 48% at Heat 8: 1.18 / 1.12 puts its top Heat with 35%+ wins at 6, DESIGN §14 5-7)
    // 4.0 (cardsloot, continuation 3): 1.18 / 1.12 -> 1.24 / 1.15. The Marks, the gear rules (companions wear uniques,
    // auto-equip to the most improved hero) and gear ranks in perks2 lifted the full-meta active bot to Heat 5 86%, Heat 7
    // 75%, Heat 8 62-65% (45% with no Marks at all). Measured (bots, full meta, active, 90 min a seed; tests/cardsloot/bal
    // h1/h2/m5): 1.22 / 1.14 H6 63%, H7 47%, H8 29% (104 runs); 1.24 / 1.15 H7 45%, H8 25% (16 seeds each); 1.25 / 1.16
    // H5 78%, H7 47%, H8 17%. 1.24 / 1.15 keeps Heat 7 the top (H8 the furthest under 35% for the same H7). Heat 0: x1
    // 4.0 (meta): 1.24 / 1.15 -> DESIGN's own 1.15 / 1.10. The steeper curve paid for a full meta over the design's budget
    // (x2.0 damage / x2.9 on bosses); the permanent block is held to x1.6 / x1.9 / x1.35 now (recalc's governor), and at
    // 1.24 / 1.15 the same bot's top Heat with 35%+ wins fell to 4 (H5 30%, H7 8%). Measured on the budgeted meta (bots,
    // active, full meta, 8 seeds x 90 min, ~35 runs a cell; tests/meta/bal out/h3, h4): H5 63%, H6 47%, H7 40%, H8 9%:
    // top Heat 7 (DESIGN §14: 5-7)
    heatHp: 1.15, heatBite: 1.1,
    // 4.0: the Barracks pays this share of the best run's Embers an hour away
    barracksRate: 0.03,
    // 4.0: Auto-invest (DESIGN §5.5): every autoEvery s of field time, the run's gold into the Hand upgrades and the
    // Garrison by payback, keeping autoKeep of it back for the camp's market; autoBuys purchases a go (each one tries
    // every candidate with a recalc, ~2 ms: one at a time, often, keeps a phone's frames smooth)
    autoEvery: 0.5, autoKeep: 0.5, autoBuys: 1,
    // 4.0 (continuation 3): inside a Siege the chests that are not the Hand's own (the holding meter), a Golden Click's, a
    // Treasure door's, Plunder's or the jackpot's come out of a budget: siegeChestRate a minute of field time, up to
    // siegeChestCap banked (a run starts with the cap). DESIGN §5.3 wants 2-4 chests a field minute and holding alone gives
    // ~3; the sudden events (stampede 6-10, ambush 4-6, portals 5-8, warlord 5-7, chest rain 22), the Land Champions (1-2)
    // and the rare visitors' rains added ~4 more (measured 7-8 a minute). Past the budget a chest comes as coin
    // (siegeChestGold of its worth, 'chestCoin'): the event keeps its moment, a few chests and a shower of gold
    // (measured, 10 seeds x 90 min, Heat 0: 0.5 / 3 gave the active bot 4.1 a field minute; 0.4 / 2 keeps it under 4)
    siegeChestRate: 0.4, siegeChestCap: 2, siegeChestGold: 0.3,
  };

  // ---------- State ----------
  function potZero() { const o = {}; G.POTIONS.forEach(p => o[p.id] = 0); return o; }
  // Rift records: best level ever (and its time), the highest level open, today's best
  function newRift() { return { best: 0, bestT: 0, open: 1, runs: 0, day: { k: '', l: 0 } }; }
  // The season: a save from an earlier one starts the game over (only its settings and name carry on).
  // 2.3 wiped everything once, since all progress so far was made while the game was far too easy.
  // the season: saves from an earlier one start over (3.1: season 2, a clean start for everyone)
  // 4.0: season 3, the Siege. An older save is converted, not thrown away: G.foundersGift (js/run.js) keeps the Gems,
  // pets, achievements and collection and turns gear, town and fame into Embers and Fame (see deserialize)
  const WIPE = G.WIPE = 3;
  G.oldSeason = data => !!data && typeof data === 'object' && (data.wipe || 0) < WIPE;
  function newState() {
    return {
      v: 1, wipe: WIPE, created: Date.now(), lastSave: Date.now(),
      gold: 0, goldRun: 0, goldTotal: 0,
      clicks: 0, clicksRun: 0,
      upg: {}, heroes: {}, nodes: {}, legacy: {},
      essence: 0, essRun: 0, lastRunEss: 0,
      depth: 0, maxDepth: 0, bestDepth: 0,
      pots: potZero(),
      chests: [], chestMeter: 0, bossMeter: 0, uid: 0,
      buffs: [],
      coll: {}, opened: [0, 0, 0, 0, 0, 0, 0], modsSeen: {},
      pets: {}, active: [], eggs: 0, pity: { l: 0, d: 0 }, pulls: 0,
      fame: 0, fameTotal: 0, ascensions: 0,
      ach: {}, skin: 'classic',
      quests: [], questsDone: 0, rerollAt: 0,
      daily: { last: '', streak: 0 },
      st: { crits: 0, bossKills: 0, lordKills: 0, wisps: 0, mimics: 0, merges: 0, divine: 0, maxCombo: 0,
        playTime: 0, chests: 0, modded: 0, megas: 0, hoards: 0, shrines: 0, breaches: 0, drops: 0, orbs: 0, rifts: 0 },
      // (4.0: autoInvest: the Shop tab's toggle, on by default)
      set: { sound: 1, music: 1, vol: 0.6, hold: 1, shake: 1, autoBoss: 1, filter: 1, stats: 1, autoInvest: 1 },
      seen: {}, tut: 0,
      journey: 0, scar: null, bounty: { day: '', n: 0, done: false },
      uq: {}, feed: [], rift: newRift(), lands: {}, party: [],
      // the jackpot: how many, and the play time of the last one (its odds climb with every hour since)
      jp: { n: 0, at: 0 },
      // 2.3: the chosen Torment level (see G.torment)
      torment: 0, tormentRun: 0,
      // 3.1: the depth this run started from (fame counts what's gained beyond it)
      runFrom: 0,
      // 3.3: this run's blessing, and the three on offer when a new run starts
      bless: null, blessOffer: null,
      // 3.0: the town's building levels (kept through ascension)
      bld: {},
      // 3.6: Gems (kept for good: they continue a fallen run), the continues used this run, the lords that paid
      // theirs, and a fall waiting on the player's choice (continue here, or a new run)
      gems: 0, runConts: 0, gemLords: {}, fallen: null,
      // 4.0: the Siege. run: the one being played (js/run.js; between runs {on: 0, phase: 'summary' | 'setup'});
      // Embers (the Furnace's currency: town, Star Chart); Heat won (the highest Heat with a win, -1 for none) and each
      // Button's best (stickers); the last setup (AGAIN) and the last run's summary; the Hall of the Fallen (last 12)
      run: { on: 0, phase: 'setup' }, embers: 0, emberTotal: 0, heatWon: -1, heatStk: {}, lastSetup: null, lastRun: null, fallen12: [],
      // the Codex: every unique and relic ever collected ({q: {n: copies, rank, relic}}; ranked up by duplicates, 2 at
      // most until the Museum raises it); the founders' gift (an earlier season's save, converted: js/run.js)
      codex: {}, founders: null,
      // the Daily Siege: today's key and the attempts so far (the first is ranked)
      dailySiege: { day: '', tries: 0 },
    };
  }
  G.newState = () => { const s = newState(); if (G.ensureHero) G.ensureHero(s); return s; };
  G.S = newState();
  // 4.0: is a Siege being played (not the summary or setup between runs)?
  const inSiege = () => !!(G.S && G.S.run && G.S.run.on);
  G.inSiege = inSiege;

  // Runtime-only state (not saved)
  const R = G.R = {
    combo: 0, comboT: 0, autoAcc: 0, golemAcc: 0, petOpenAcc: 0,
    wisp: null, wispT: 40, manualTimes: [], achT: 0, recalcT: 0, dirty: true,
    boss: null, bossReady: false,
  };

  // ---------- The pacing director (3.6) ----------
  // One clock for the big moments on the field: sudden events (js/events.js), Land Champions, invasions, rare
  // visitors, land and chapter cards (the UI marks those). Never two at once, never during a boss, a march, the
  // town, a cinematic or a window, a breath after a boss or a march ends, and dirGap seconds between two starts.
  //   can(kind, prio)  prio 1 (default): all the rules; 2 ('must'): skips the gap between two starts;
  //                    0 ('small': a Hoarder, a shrine, a breach): its own shorter gap, and never while a big one runs
  //   mark(kind, secs) a big moment starts and lasts secs ('moment' event); end(kind) it ended early
  //   quiet()          a big moment or a boss fight is on: hold the low-priority toasts and cards
  //   hold(secs)       nothing big for a while (a fall, a blessing being chosen)
  // Time is play time (S.st.playTime), so it runs the same in the Node playtests.
  const ptime = () => (G.S && G.S.st && G.S.st.playTime) || 0;
  function dirSt() {
    let d = R.dir;
    if (!d || d.S !== G.S) d = R.dir = { S: G.S, last: -1e9, kind: null, act: {}, bossEnd: -1e9, hold: -1e9, small: -1e9 };
    return d;
  }
  // until when a big moment is still on: the latest end of those running (each kind ends on its own)
  function dirUntil(d) { let u = -1e9; for (const k in d.act) if (d.act[k] > u) u = d.act[k]; return u; }
  G.director = {
    can(kind, prio) {
      const S = G.S, d = dirSt(), t = ptime();
      if (prio == null) prio = 1;
      if (!S || !S.hero || !S.hero.cls || R.boss || R.march || R.town || R.rift || R.cine > 0 || (G.uiBusy && G.uiBusy())) return false;
      // nothing big while the tutorial shows the ropes (its own moments don't ask)
      if (G.Tut && S.tut >= 0) return false;
      if (t < d.hold || t < dirUntil(d)) return false;
      if (prio <= 0) return t - d.bossEnd >= TUNE.dirAfterBoss * 0.5 && t - Math.max(d.small, d.last) >= TUNE.dirSmallGap;
      if (t - d.bossEnd < TUNE.dirAfterBoss) return false;
      return prio >= 2 || t - d.last >= TUNE.dirGap;
    },
    mark(kind, secs) {
      const d = dirSt(), t = ptime();
      if (kind === 'small') { d.small = t; return; }
      d.last = t; d.kind = kind; d.act[kind] = Math.max(d.act[kind] || -1e9, t + Math.max(0, secs || 0));
      emit('moment', kind, secs || 0);
    },
    end(kind) { const d = dirSt(); if (kind) delete d.act[kind]; else d.act = {}; },
    quiet() { return !!R.boss || ptime() < dirUntil(dirSt()); },
    hold(secs) { const d = dirSt(); d.hold = Math.max(d.hold, ptime() + (secs || 0)); },
    // what it knows, for tests and the curious
    state() { const d = dirSt(), t = ptime(); return { kind: d.kind, sinceLast: t - d.last, sinceSmall: t - d.small, left: Math.max(0, dirUntil(d) - t), sinceBoss: t - d.bossEnd, held: Math.max(0, d.hold - t) }; },
  };
  const dirBossEnd = () => { dirSt().bossEnd = ptime(); };
  ['bossWin', 'bossFail', 'marchEnd', 'riftEnd'].forEach(k => G.on(k, dirBossEnd));
  ['wipe', 'runOver', 'bless', 'blessOffer'].forEach(k => G.on(k, () => G.director.hold(TUNE.dirAfterFall)));

  // ---------- Derived stats ----------
  const D = G.D = {};
  function baseD() {
    return {
      holdRate: 1, clickAdd: 1, clickMult: 1, clickGpsPct: 0, gpsMult: 1, goldMult: TUNE.goldBase || 1, itemMult: 1,
      crit: 0.03, critMult: 3, chestProg: 1, chestNeed: TUNE.chestNeed, slots: 6, autoOpen: 0, looters: 1, luck: 0,
      comboCap: 50, comboPer: 0.005, autoCps: 0, essMult: 1, modChance: 0, mods: {}, merge: false, double: 0,
      bossMult: 1, bossTime: 30, petMult: 1, petSlots: 2, eggMult: 1, wispRate: 1, buffDur: 1,
      offCap: 14400, offEff: 0.5, scout: 0, vet: 0, legion: false, mega: false, autoBoss: false, bossNeed: 8,
      potCap: 10, potPow: 1, fameMult: 1, questMult: 1, goldenChance: G.GOLDEN_CHANCE, petOpen: 0, spdMult: 1,
      heroMult: 1, hpMult: 1,
    };
  }

  function stars(n) { let s = 0; for (const t of G.STAR_THRESHOLDS) if (n >= t) s++; return s; }
  G.stars = stars;

  function heroMilestones(n) { let m = 0; for (const t of G.HERO_MILESTONES) if (n >= t) m++; return m; }
  G.heroMilestones = heroMilestones;

  function petPower(st) { return (1 + 0.15 * (st.lvl - 1)) * (st.gold ? 1.5 : 1); }
  function petCps(pet, st) { return pet.cps * (1 + 0.1 * (st.lvl - 1)) * (st.gold ? 1.5 : 1); }
  G.petPower = petPower; G.petCps = petCps;

  function hasBuff(id) { return G.S.buffs.some(b => b.id === id); }
  G.hasBuff = hasBuff;

  // ---------- 4.0: the permanent block and its power budget (DESIGN §4.1, §15 'meta creep') ----------
  // Everything a player keeps between Sieges that makes the party stronger goes into recalc's permanent block: the Star
  // Chart, the Hall of Fame, the Town, the collection (economy only: data.js G.BONUS combat kinds are off), pets (their
  // combat part capped at TUNE.petCap combined) and the Alchemist's starting potions. The block as a whole is held to the
  // budget at full completion: sustained party damage <= TUNE.metaDmg, against bosses <= metaBoss, health <= metaHp.
  // The ranks are tuned so a full meta lands at about the budget (tests/meta/meta_rules.js, BUDGET); the governor is the hard stop for
  // what tuning can't foresee (a season-2 collection, a pen of golden lvl-25 pets): when the block would pass the budget,
  // all of its combat effects are scaled back together (one exponent k on the multipliers, k x the crit and crit-power adds)
  // until it fits. D.meta = { dmg, boss, hp, raw {dmg, boss, hp}, k / kb / kh (the scale kept on damage, the boss-only
  // part, health: 1 = under the budget) } (G.metaPower(): the UI's line)
  Object.assign(TUNE, { metaDmg: 1.6, metaBoss: 1.9, metaHp: 1.35, petCap: 1.05, metaAlly: 0.8 });
  // crit's worth to damage on a few builds the bots reach (low crit with big crit power, high crit with small), the most of
  // them: crit and crit power added on top of a build are worth a different share on each, the budget takes the worst
  const CRIT_REF = [[0.03, 3], [0.05, 4.3], [0.12, 3.6], [0.2, 3.4], [0.3, 4]];
  const CR_C = CRIT_REF.map(r => r[0]), CR_M = CRIT_REF.map(r => r[1]), CR_B = CRIT_REF.map(r => 1 + r[0] * (r[1] - 1));
  function critK(dc, dcm) {
    if (!dc && !dcm) return 1;
    let m = 1;
    for (let i = 0; i < CR_C.length; i++) { let c = CR_C[i] + dc; if (c > 0.9) c = 0.9; const v = (1 + c * (CR_M[i] + dcm - 1)) / CR_B[i]; if (v > m) m = v; }
    return m;
  }
  const combatSnap = d => ({ h: d.heroMult, s: d.spdMult, c: d.crit, cm: d.critMult, b: d.bossMult, hp: d.hpMult, ad: d.allyDmgK || 1, ah: d.allyHpK || 1 });
  // the damage a set of combat changes (x: ratios and adds against a snapshot) is worth, scaled by k (0..1)
  function powDmg(x, k) {
    return Math.pow(x.h, k) * Math.pow(x.s, k) * critK(x.dc * k, x.dcm * k) * (1 + TUNE.metaAlly * (Math.pow(x.ad, k) - 1));
  }
  function diffOf(d, m0) {
    return { h: d.heroMult / m0.h, s: d.spdMult / m0.s, dc: d.crit - m0.c, dcm: d.critMult - m0.cm, b: d.bossMult / m0.b, hp: d.hpMult / m0.hp,
      ad: (d.allyDmgK || 1) / m0.ad, ah: (d.allyHpK || 1) / m0.ah };
  }
  // the k (0..1) at which f(k) meets cap (f grows with k): bisection from the log guess's bracket (14 steps: k to ~1e-4)
  function fitK(f, cap, raw) {
    if (raw <= cap) return 1;
    const g = Math.log(cap) / Math.log(raw);
    let lo = 0, hi = 1;
    if (f(g * 0.85) <= cap) lo = g * 0.85;
    if (g * 1.2 < 1 && f(g * 1.2) > cap) hi = g * 1.2;
    for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2; if (f(m) > cap) hi = m; else lo = m; }
    return lo;
  }
  // scale the combat changes made since m0 down to k (damage side) / kb (bosses) / kh (health)
  function scaleBack(d, m0, x, k, kb, kh) {
    if (k < 1) { d.heroMult = m0.h * Math.pow(x.h, k); d.spdMult = m0.s * Math.pow(x.s, k); d.crit = m0.c + x.dc * k; d.critMult = m0.cm + x.dcm * k; if (d.allyDmgK != null) d.allyDmgK = m0.ad * Math.pow(x.ad, k); }
    if (kb < 1) d.bossMult = m0.b * Math.pow(x.b, kb);
    if (kh < 1) { d.hpMult = m0.hp * Math.pow(x.hp, kh); if (d.allyHpK != null) d.allyHpK = m0.ah * Math.pow(x.ah, kh); }
  }
  // cap what a set of changes since m0 is worth: damage <= cap, bosses <= capB (with the damage), health <= capH. (cache: the
  // last answer, kept while the changes and the caps are the same: recalc runs twice a second on the same meta)
  const X_KEYS = ['h', 's', 'dc', 'dcm', 'b', 'hp', 'ad', 'ah'];
  function govern(d, m0, cap, capB, capH, cache) {
    const x = diffOf(d, m0);
    let out = cache && cache.out;
    if (!out || cache.cap !== cap || cache.capB !== capB || cache.capH !== capH || X_KEYS.some(k => cache.x[k] !== x[k])) {
      const raw = powDmg(x, 1);
      const k = fitK(kk => powDmg(x, kk), cap, raw), dmg = powDmg(x, k);
      const kb = x.b > 1 && dmg * x.b > capB ? Math.max(0, Math.log(Math.max(1, capB / dmg)) / Math.log(x.b)) : 1;
      const hpTop = Math.max(x.hp, x.ah), kh = hpTop > capH ? Math.log(capH) / Math.log(hpTop) : 1;
      out = { dmg, boss: dmg * Math.pow(Math.max(1, x.b), kb), hp: Math.pow(x.hp, kh), raw: { dmg: raw, boss: raw * Math.max(1, x.b), hp: x.hp }, k, kb, kh };
      if (cache) { cache.x = x; cache.cap = cap; cache.capB = capB; cache.capH = capH; cache.out = out; }
    }
    scaleBack(d, m0, x, out.k, out.kb, out.kh);
    return out;
  }
  const GOV_PET = {}, GOV_META = {};
  G.metaCritK = critK;
  // the stat potions: att damage and clicks, def toughness, spd attack speed, dex crit, vit Garrison, wis essence, life
  // gold, mana pet power (P: counts by kind, pp: potion power)
  function potFx(d, P, pp) {
    d.clickMult *= 1 + 0.05 * (P.att | 0) * pp; d.heroMult *= 1 + 0.05 * (P.att | 0) * pp; d.hpMult *= 1 + 0.08 * (P.def | 0) * pp;
    d.spdMult *= 1 + 0.05 * (P.spd | 0) * pp; d.crit += 0.005 * (P.dex | 0) * pp;
    d.gpsMult *= 1 + 0.05 * (P.vit | 0) * pp; d.essMult *= 1 + 0.05 * (P.wis | 0) * pp;
    d.goldMult *= 1 + 0.03 * (P.life | 0) * pp; d.petMult *= 1 + 0.04 * (P.mana | 0) * pp;
  }
  // the run's starting potions (the Alchemist's, recorded at 'runSetup' in S.run.pots0) are the meta's; the rest the run's
  function potSplit(S) {
    const r = S.run, p0 = r && r.on && r.pots0, meta = {}, run = {};
    for (const k in S.pots) { const m = p0 ? Math.min(S.pots[k] | 0, p0[k] | 0) : 0; meta[k] = m; run[k] = (S.pots[k] | 0) - m; }
    return { meta, run };
  }

  function recalc() {
    const S = G.S;
    const d = baseD();
    // (4.0: an upgrade that left the run shop does nothing, whatever an old save holds)
    for (const u of G.UPGRADES) { const L = S.upg[u.id] || 0; if (L && !u.off) u.fx(L, d); }

    // ---- the permanent block (see above): Star Chart, Hall of Fame, Town, collection, pets, starting potions ----
    const m0 = combatSnap(d);
    for (const n of G.NODES) { const L = S.nodes[n.id] || 0; if (L) n.fx(L, d); }
    for (const l of G.HALL) { const L = S.legacy[l.id] || 0; if (L) l.fx(Math.min(L, l.max), d); }
    // the town's buildings (mostly unlocks and flags now: see G.BLD)
    if (S.bld && G.BLD) for (const b of G.BLD) { const L = Math.min(G.BLD_MAX, S.bld[b.id] || 0); if (L) b.fx(L, d); }
    // Collection bonuses (4.0: the economy kinds only; G.BONUS[k].combat are off: no hidden power)
    const sums = {};
    for (const it of G.ITEMS) {
      const s = stars(S.coll[it.id] || 0), B = G.BONUS[it.bonus];
      if (s && !B.combat) sums[it.bonus] = (sums[it.bonus] || 0) + B.v * G.RARITIES[it.r].bonusMul * s;
    }
    const sm = k => sums[k] || 0;
    d.clickMult *= 1 + sm('click'); d.gpsMult *= 1 + sm('gps'); d.goldMult *= 1 + sm('gold');
    d.luck += sm('luck'); d.essMult *= 1 + sm('ess');
    d.itemMult *= 1 + sm('item'); d.chestProg += sm('chest');
    d.eggMult *= 1 + sm('egg'); d.petMult *= 1 + sm('pet'); d.comboCap += Math.floor(sm('combo'));
    d.collSums = sums;
    // the Alchemist's starting potions
    const PS = potSplit(S);
    potFx(d, PS.meta, d.potPow);
    // Pets: what each gives with its power (petMult as it stands now); their combat part (crit, crit power, boss damage)
    // at most TUNE.petCap together
    const slots = d.petSlots;
    S.active = S.active.filter(id => S.pets[id]).slice(0, slots);
    {
      const p0 = combatSnap(d);
      for (const id of S.active) { const pet = G.PET_BY_ID[id]; if (pet.fx) pet.fx(petPower(S.pets[id]) * d.petMult, d); }
      d.petPow = govern(d, p0, TUNE.petCap, TUNE.petCap, TUNE.petCap, GOV_PET);
    }
    d.meta = govern(d, m0, TUNE.metaDmg, TUNE.metaBoss, TUNE.metaHp, GOV_META);

    // ---- the run ----
    if (G.heroEcon) G.heroEcon(d);
    // 4.0: run-scoped bonuses (js/run.js: the Power shrine's boons, the Glass Pact) go in here, before the totals
    if (G.HOOKS && G.HOOKS.meta) for (const f of G.HOOKS.meta) f(d);
    // 4.0: the Button's rule (G.btnFx, js/blessings.js: the Buttons) where the run's blessing was (the blessing cards are
    // retired: their effects became Power-shrine boons and Pacts)
    if (G.btnFx) G.btnFx(d);
    // Heat: gold (its Lean Purse rule), and what the 3.x Torment paid in XP and luck (nothing now); Fame is paid in js/run.js
    { const T = torment(); d.goldMult *= T.gold; d.xpMult = (d.xpMult || 1) * T.xp; d.luck += T.luck; }
    // Potions (the run's: lords', markets', chests')
    potFx(d, PS.run, d.potPow);

    // Achievements & fame
    d.achCount = Object.keys(S.ach).length;
    d.goldMult *= 1 + 0.01 * d.achCount;
    // (4.0: no hidden power: fame no longer multiplies gold; it buys the capped Hall of Fame)

    // Heroes
    let total = 0, classes = 0;
    for (const h of G.HEROES) { const n = S.heroes[h.id] || 0; total += n; if (n) classes++; }
    d.heroTotal = total; d.heroClasses = classes;
    if (d.legion) d.goldMult *= 1 + 0.08 * classes;
    if (d.vet) d.gpsMult *= 1 + d.vet * Math.floor(total / 10);

    // Pets' auto clicks (after petMult is final)
    d.petCps = 0;
    for (const id of S.active) { const pet = G.PET_BY_ID[id]; if (pet.cps) d.petCps += petCps(pet, S.pets[id]) * Math.sqrt(d.petMult); }
    d.crit = Math.min(0.9, d.crit);
    if (G.omen) d.wispRate *= G.omen().wisp;
    d.petCps *= d.spdMult; d.autoCps *= d.spdMult; d.petOpen *= d.spdMult;
    if (d.autoOpen) d.autoOpen /= d.spdMult;
    d.comboCap = Math.floor(d.comboCap);

    d.depthMult = Math.pow(TUNE.depthGold, S.depth);
    const buffGold = hasBuff('frenzy') ? 7 : 1, buffClick = hasBuff('storm') ? 77 : 1;
    d.buffGold = buffGold; d.buffClick = buffClick;

    let heroGps = 0;
    d.heroGps = {};
    for (const h of G.HEROES) {
      const n = S.heroes[h.id] || 0;
      if (!n) continue;
      const g = n * h.gps * Math.pow(2, heroMilestones(n)) * d.gpsMult * d.goldMult * d.depthMult;
      d.heroGps[h.id] = g; heroGps += g;
    }
    d.gpsBase = heroGps;
    d.gps = heroGps * buffGold;
    const clickCore = d.clickAdd * d.clickMult * d.goldMult * d.depthMult;
    d.clickBase = clickCore + d.gpsBase * d.clickGpsPct;
    d.click = (clickCore * buffGold + d.gps * d.clickGpsPct) * buffClick;
    d.incomeRef = Math.max(1, d.gps + (clickCore * buffGold + d.gps * d.clickGpsPct) * 3);
    d.effLuck = d.luck + S.depth * 0.003;
    if (G.heroFinish) G.heroFinish(d);
    Object.keys(D).forEach(k => delete D[k]);
    Object.assign(D, d);
    R.dirty = false;
  }
  G.recalc = recalc;

  // ---------- Heat (4.0; the 2.3 Torment re-made): the Siege's difficulty ladder ----------
  // Chosen at setup only, 0..heatWon+1 (Heat N opens with a win at N-1). Each level: Horde and boss health x1.15, bites
  // x1.10 (TUNE.heatHp / heatBite), Fame x(1+0.2n), Embers x(1+0.15n), rarity +n/3, drops +15%, and the named rules
  // (data.js G.HEAT_RULES).
  // The table keeps the Torment's field names (mobHp, bite, bossHp, n, drop, rarity...): champions, events, rare
  // visitors and relics read them as G.torment().
  const TORMENT_MAX = G.TORMENT_MAX = 10;
  const T_BY_N = [];
  const heatNow = () => { const r = G.S && G.S.run; return r && r.on ? Math.max(0, Math.min(TORMENT_MAX, r.heat | 0)) : 0; };
  G.heatNow = heatNow;
  // (TUNE.heatHp / heatBite: a level's Horde and boss health and its bites; the table is kept until they change)
  let tKey = '';
  function heatRow(n) {
    const k = TUNE.heatHp + '|' + TUNE.heatBite;
    if (k !== tKey) { tKey = k; T_BY_N.length = 0; }
    return T_BY_N[n] || (T_BY_N[n] = Object.freeze({ n, mobHp: Math.pow(TUNE.heatHp, n), bite: Math.pow(TUNE.heatBite, n), bossHp: Math.pow(TUNE.heatHp, n),
      bossTime: 1 + 0.05 * n, horde: 1, affix: 0, lordAffix: n >= 3 ? 1 : 0, gold: n >= 2 ? 0.75 : 1, xp: 1, luck: 0,
      drop: 1 + 0.15 * n, fame: 1 + 0.2 * n, embers: 1 + 0.15 * n, rarity: Math.floor(n / 3),
      doom: TUNE.doomK[n <= 2 ? 0 : n <= 5 ? 1 : 2], startHp: n >= 4 ? 0.8 : 1, rest: n >= 4 ? 0.25 : 0.4, cards: n >= 5 ? 2 : 3, noCont: n >= 5, reaper: n >= 7,
      champ: n >= 1, cursed: n >= 8, escort: n >= 9, madX: n >= 10 ? 2 : 1, pips: n >= 10 ? 2 : 0 }));
  }
  function torment() { return heatRow(R.rift ? 0 : heatNow()); }
  // the highest Heat this player may choose: one above their best win (0 before the first)
  function tormentMax() { return Math.max(0, Math.min(TORMENT_MAX, (G.S.heatWon == null ? -1 : G.S.heatWon) + 1)); }
  G.torment = torment; G.tormentMax = tormentMax;
  G.heat = torment; G.heatMax = tormentMax;
  // 4.0 (cardsloot): what the setup screen's Heat dial says, read from the TUNE so its text follows a retune (x1.15 health /
  // x1.10 bites a level today): G.heatInfo(n) -> { n, row (the level's table, as G.heat()), hp, bite (x at n), perLevel
  // {hp, bite}, fame, embers, rarity, drop, cards, rules [G.HEAT_RULES in force at n], added (the rule n adds, or null),
  // open (n <= G.heatMax()) }. String heat_each: 'Each Heat: Horde health ×{0}, bites ×{1}'
  G.heatInfo = function (n) {
    n = Math.max(0, Math.min(TORMENT_MAX, n | 0));
    const T = heatRow(n), rules = (G.HEAT_RULES || []).filter(x => x.n <= n);
    return { n, row: T, hp: T.mobHp, bite: T.bite, perLevel: { hp: TUNE.heatHp, bite: TUNE.heatBite }, fame: T.fame, embers: T.embers,
      rarity: T.rarity, drop: T.drop, cards: T.cards, rules, added: rules.find(x => x.n === n) || null, open: n <= tormentMax() };
  };
  if (G.tAdd) G.tAdd({ heat_each: 'Each Heat: Horde health ×{0}, bites ×{1}' });
  // (the 3.x dial: Heat is chosen at setup only, so during a run this does nothing; between runs it sets the next one's)
  G.setTorment = function (n) {
    const S = G.S;
    n = Math.max(0, Math.min(tormentMax(), n | 0));
    if ((S.run && S.run.on) || R.boss || R.rift) return false;
    S.torment = n; S.lastSetup = Object.assign({}, S.lastSetup || {}, { heat: n });
    R.dirty = true; recalc();
    emit('torment', n);
    return true;
  };
  // Gear rarity opens with this run's depth: rare from depth 2, epic 4, legendary 7, mythic 10, divine 13, + Heat/3
  function rarityCap() {
    const S = G.S, reach = Math.max(S.maxDepth || 0, S.depth || 0);
    let c = 0;
    TUNE.rarityAt.forEach((at, r) => { if (reach >= at) c = r; });
    return Math.min(6, c + torment().rarity);
  }
  G.rarityCap = rarityCap;
  G.dirty = () => { R.dirty = true; };

  // ---------- Money ----------
  function addGold(n, src) {
    if (!(n > 0)) return;
    const S = G.S;
    S.gold += n; S.goldRun += n; S.goldTotal += n;
    if (G.goldBySrc) G.goldBySrc[src || '?'] = (G.goldBySrc[src || '?'] || 0) + n;
    questProgress('gold', n);
  }
  G.addGold = addGold;
  function addEssence(n, src) {
    if (!(n > 0)) return;
    if (G.essBySrc) G.essBySrc[src || '?'] = (G.essBySrc[src || '?'] || 0) + n;
    G.S.essence += n; G.S.essRun += n;
    emit('essence', n);
  }
  G.addEssence = addEssence;
  function addEggs(n) {
    n = Math.floor(n);
    if (n <= 0) return 0;
    G.S.eggs += n;
    emit('eggs', n);
    return n;
  }
  function rollCount(expected) { // expected value -> integer with random rounding
    const f = Math.floor(expected);
    return f + (chance(expected - f) ? 1 : 0);
  }

  // ---------- Clicking ----------
  function critRoll() { return chance(D.crit); }

  // (4.0: self: a press the Button makes on its own (the Clockwork Button's hold, js/blessings.js G.btnTick): not the Hand's,
  // so the Hand's own 10-a-second ceiling doesn't count it; the Hand's own presses count for G.btnManualK() (Clockwork x0.5))
  function manualClick(x, y, self) {
    const S = G.S;
    if (R.town || S.fallen || (G.runHeld && G.runHeld())) return null; // the field waits while the party is in town (or the Button is in pieces, or the Siege holds)
    if (!self) {
      const now = performance.now();
      const mt = R.manualTimes;
      while (mt.length && now - mt[0] > 1000) mt.shift();
      if (mt.length >= TUNE.maxManualCps) return null;
      mt.push(now);
    }
    const hk = self || !G.btnManualK ? 1 : G.btnManualK();

    // a broken Button gives nothing: no gold, no lightning, until it mends
    if (R.btnDown > 0) { emit('clickDead'); return null; }
    if (G.HOOKS) for (const f of G.HOOKS.click || []) f();
    // (the pace of clicks that land, for the boss's health)
    if (!(R.stun > 0)) R.clickN = (R.clickN || 0) + 1;
    S.clicks++; S.clicksRun++;
    R.combo = Math.min(D.comboCap, R.combo + 1);
    R.comboT = TUNE.comboTime;
    if (R.combo > S.st.maxCombo) S.st.maxCombo = R.combo;
    const crit = critRoll();
    const mega = D.mega && S.clicks % 25 === 0;
    let gain = D.click * (1 + R.combo * D.comboPer) * hk;
    if (crit) { gain *= D.critMult; S.st.crits++; questProgress('crit', 1); }
    if (mega) { gain *= 30; S.st.megas++; }
    if (G.evMul) gain *= G.evMul('click');
    addGold(gain, 'click');
    const dmg = R.boss ? D.heroHit * TUNE.clickVolley * hk : 0;
    if (G.heroVolley && !(R.stun > 0)) G.heroVolley(TUNE.clickVolley * hk, 'click');
    S.chestMeter += D.chestProg * hk;
    spawnFromMeter();
    questProgress('clicks', 1);
    questProgress('combo', R.combo, true);
    const ev = { gain, crit, mega, x, y, combo: R.combo, dmg, self: !!self };
    emit('click', ev);
    return ev;
  }
  G.manualClick = manualClick;
  G.selfClick = () => manualClick(null, null, true);

  // Auto clicks are aggregated: expected crit value, no combo.
  function autoClicks(n, dt) {
    if (n <= 0) return;
    const critEV = 1 + D.crit * (D.critMult - 1);
    const gain = D.click * critEV * n;
    addGold(gain, 'auto');
    const petN = n * D.petCps / Math.max(1e-9, D.autoCps + D.petCps);
    if (G.heroVolley && petN > 0) G.heroVolley(TUNE.petVolley * petN, 'pet');
    G.S.chestMeter += D.chestProg * TUNE.autoChestFactor * n;
    emit('autoClicks', n, gain);
  }

  // ---------- Chests ----------
  function rollTier(base) {
    const L = 1 + D.effLuck;
    const w = (base || G.CHEST_WEIGHTS).map((b, i) => b * Math.pow(L, i * 0.5));
    return weighted(w);
  }
  function rollMod() {
    const ids = Object.keys(D.mods);
    if (!ids.length) return null;
    let p = 0.06 + D.modChance;
    if (!chance(p)) return null;
    return pick(ids);
  }
  function rollRarity(tier, rolls) {
    let best = 0;
    for (let i = 0; i < rolls; i++) {
      let r = tier;
      if (r < 6 && chance(0.12)) r++;
      if (r > best) best = r;
    }
    return best;
  }
  function pickItem(r, free) {
    if (!free) r = Math.min(r, rarityCap());
    const list = G.ITEMS_BY_RARITY[r];
    return list[weighted(list.map(i => i.w))];
  }
  G.rollTier = rollTier; G.rollRarity = rollRarity; G.pickItem = pickItem;
  // One item into the collection, the purse and the Warden's bag: what every
  // chest and every drop on the ground ends in
  function lootItem(it, src, pre) {
    const S = G.S;
    const before = S.coll[it.id] || 0;
    S.coll[it.id] = before + 1;
    const v = itemValue(it);
    if (it.r === 6) S.st.divine++;
    if (stars(before + 1) > stars(before)) R.dirty = true;
    const g = G.gainGear ? G.gainGear(it, it.r, pre) : null;
    questProgress('rarity', it.r);
    const li = { it, v, g, isNew: before === 0, star: stars(before + 1) > stars(before) };
    emit('loot', li, src);
    return li;
  }
  G.lootItem = lootItem;
  function itemValue(it) {
    return D.incomeRef * G.RARITIES[it.r].secs * it.m * D.itemMult;
  }
  G.itemValue = itemValue;
  function chestValue(tier) { return D.incomeRef * G.RARITIES[tier].secs * D.itemMult; }

  function tryMerge() {
    const S = G.S;
    for (let t = 0; t < 6; t++) {
      // the Horde's little chests of coin don't fuse into real ones
      const same = S.chests.filter(c => c.tier === t && !c.mod && !c.small);
      if (same.length >= 3) {
        const parts = same.slice(0, 3);
        S.chests = S.chests.filter(c => !parts.includes(c));
        const nc = makeChest(t + 1, null);
        nc.merged = true;
        S.chests.push(nc);
        S.st.merges++;
        emit('merge', parts, nc);
        return true;
      }
    }
    return false;
  }

  function makeChest(tier, mod) {
    const S = G.S;
    const c = { id: ++S.uid, tier, mod: mod || null, age: 0 };
    if (mod === 'frozen') c.hp = 8;
    if (mod === 'blazing') c.life = TUNE.blazeLife;
    if (mod === 'mimic') { c.hp = TUNE.mimicClicks; c.awake = false; }
    return c;
  }

  // (free: a chest the Siege's budget doesn't count: the holding meter's, a Golden Click's, a Treasure door's, Plunder's;
  // the jackpot's always are)
  function spawnChest(tier, mod, fromBoss, small, free) {
    const S = G.S;
    if (tier === undefined || tier === null) tier = rollTier();
    tier = Math.min(tier, rarityCap());
    // 4.0: the Siege's chest budget (TUNE.siegeChestRate; js/run.js refills S.run.chestTok with field time)
    if (!free && inSiege() && !(R.ev && R.ev.k === 'jackpot')) {
      const r = S.run, tok = r.chestTok == null ? TUNE.siegeChestCap : r.chestTok;
      if (tok < 1) {
        const v = chestValue(tier) * TUNE.siegeChestGold * (small ? TUNE.smallChestK : 1);
        addGold(v, 'chestCoin');
        emit('chestCoin', tier, v, R.dropAt || null);
        return null;
      }
      r.chestTok = tok - 1;
    }
    if (mod === undefined) mod = rollMod();
    if (mod === 'chromatic') tier = Math.min(6, tier + 1);
    if (S.chests.length >= D.slots) {
      if (!(D.merge && tryMerge())) {
        // No room: the lowest plain chest on the field pops open to make space. A little chest only
        // pushes out another little one; a real chest pushes out the little ones first.
        const plain = S.chests.filter(c => (!c.mod || c.mod === 'golden' || c.mod === 'ghost' || c.mod === 'void' || c.mod === 'chromatic') && (!small || c.small));
        const worth = c => (c.small ? 0 : 10) + c.tier;
        const low = plain.reduce((a, b) => (!a || worth(b) < worth(a) ? b : a), null);
        if (low && (low.small && !small || low.tier <= tier)) openChest(low, 'overflow');
        else {
          const v = chestValue(tier) * 0.3 * (small ? TUNE.smallChestK : 1);
          addGold(v, 'spill');
          emit('spill', tier, v);
          return null;
        }
      }
    }
    const c = makeChest(tier, mod);
    if (small) c.small = 1;
    S.chests.push(c);
    if (mod) S.modsSeen[mod] = 1;
    emit('chestSpawn', c, fromBoss);
    return c;
  }
  G.spawnChest = spawnChest;

  function spawnFromMeter() {
    const S = G.S;
    let guard = 0;
    while (S.chestMeter >= D.chestNeed && guard++ < 40) {
      S.chestMeter -= D.chestNeed;
      spawnChest(undefined, undefined, false, false, true);
    }
    if (S.chestMeter > D.chestNeed * 40) S.chestMeter = 0;
  }

  // Opens a chest (on the field or virtual). Returns loot summary.
  function openChest(c, source, depthGuard) {
    const S = G.S;
    const idx = S.chests.indexOf(c);
    if (idx >= 0) S.chests.splice(idx, 1);
    let n = 1;
    if (c.mod === 'ghost') n = 2;
    if (c.mod === 'frozen') n = 3;
    if (c.mod === 'mimic') n = 5;
    if (D.double && chance(D.double)) n *= 2;
    const rolls = c.mod === 'chromatic' ? 3 : 1;
    const loot = { items: [], gold: 0, ess: 0, eggs: 0, pots: [], tier: c.tier, mod: c.mod, chest: c, source };
    // a chest that bursts for want of room spills half of it
    const valMult = (c.mod === 'blazing' ? 5 : 1) * (source === 'overflow' ? TUNE.overflowK : 1) * (c.small ? TUNE.smallChestK : 1);
    // a little chest from the Horde is mostly coin: an item only now and then
    if (c.small && !chance(TUNE.smallItem)) n = 0;
    for (let i = 0; i < n; i++) {
      // (a promised chest, from the Journey or the daily gift, holds what it promises whatever the depth)
      const li = lootItem(pickItem(rollRarity(c.tier, rolls), source === 'journey' || source === 'daily'), source);
      li.v *= valMult;
      loot.gold += li.v;
      loot.items.push(li);
    }
    if (c.small && !loot.items.length) loot.gold += chestValue(c.tier) * valMult;
    if (c.mod === 'golden') loot.gold += D.incomeRef * 8 * (c.tier + 1);
    addGold(loot.gold, 'chest');
    let e = c.small ? 0 : G.RARITIES[c.tier].ess * D.essMult * (c.mod === 'void' ? 10 : 1); // the little ones hold no essence
    if (c.mod === 'void') e = Math.max(e, 1 * D.essMult);
    loot.ess = e; addEssence(e, 'chest' + c.tier);
    if (!c.small && c.tier >= 4 && chance(0.02 * (c.tier - 3) * D.eggMult)) loot.eggs += addEggs(1);
    if (!c.small && c.tier >= 4 && chance(0.02 * (c.tier - 3))) { const p = givePotion(); if (p) loot.pots.push(p); }
    // the little ones from the Horde count apart, so chest goals and quests keep their meaning
    if (c.small) S.st.purses = (S.st.purses || 0) + 1;
    else { S.opened[c.tier]++; S.st.chests++; questProgress('chests', 1); }
    if (c.mod) { S.st.modded++; questProgress('mod', 1); }
    emit('chestOpen', loot);
    if (!c.small && source !== 'offline' && G.jackpotRoll) G.jackpotRoll(null, 'chest');
    if (c.mod === 'lightning' && !depthGuard) {
      const targets = S.chests.filter(o => o.mod !== 'mimic' && o.mod !== 'frozen').slice(0, 3);
      emit('lightning', c, targets);
      targets.forEach(t => openChest(t, 'chain', true));
    }
    return loot;
  }
  G.openChest = openChest;
  G.makeChest = makeChest;
  G.addEggs = n => addEggs(n);

  // Player tapped a chest on the field.
  function clickChest(c) {
    const S = G.S;
    if (R.town || !S.chests.includes(c) || (G.runHeld && G.runHeld())) return;
    if (c.mod === 'frozen') {
      c.hp -= critRoll() ? 3 : 1;
      emit('chestHit', c);
      if (c.hp <= 0) openChest(c, 'hand');
      return;
    }
    if (c.mod === 'mimic') {
      if (!c.awake) { c.awake = true; c.life = TUNE.mimicLife; emit('mimicWake', c); return; }
      c.hp -= critRoll() ? 3 : 1;
      emit('chestHit', c);
      if (c.hp <= 0) { S.st.mimics++; if (chance(0.5 * D.eggMult)) addEggs(1); openChest(c, 'hand'); }
      return;
    }
    openChest(c, 'hand');
  }
  G.clickChest = clickChest;

  // The golem does the chores: lowest chests first, and it leaves the good ones
  // (epic and better) for the Hand for 20 seconds so the player gets to open them
  function golemPick(skip) {
    const S = G.S;
    // a chest lies a moment before a Looter goes for it (and a good one waits 20 s for your own hand)
    const list = S.chests.filter(c => c.mod !== 'mimic' && (c.age || 0) > 2 && (c.tier < 3 || c.age > 20 || c.mod === 'blazing') && !(skip && skip.has(c.id)));
    if (!list.length) return null;
    return list.find(c => c.mod === 'blazing') || list.find(c => c.mod === 'frozen') ||
      list.reduce((a, b) => (b.tier < a.tier ? b : a), list[0]);
  }
  function golemAct(c, i) {
    c = c || golemPick();
    if (!c) return false;
    emit('golem', c, i);
    if (c.mod === 'frozen') { c.hp -= 2; emit('chestHit', c); if (c.hp <= 0) openChest(c, 'golem'); }
    else openChest(c, 'golem');
    return true;
  }
  // The Looters: each picks a chest, runs to it and opens it when its time is up
  function lootersTick(dt) {
    const S = G.S, n = D.autoOpen ? Math.max(1, D.looters | 0) : 0;
    R.looters = R.looters || [];
    R.looters.length = Math.min(R.looters.length, n);
    while (R.looters.length < n) R.looters.push({ acc: 0, tgt: null });
    const taken = new Set(R.looters.map(l => l.tgt).filter(x => x != null));
    R.looters.forEach((l, i) => {
      if (l.tgt != null && !S.chests.some(c => c.id === l.tgt)) { taken.delete(l.tgt); l.tgt = null; }
      if (l.tgt == null) { const c = golemPick(taken); if (c) { l.tgt = c.id; l.acc = 0; taken.add(c.id); emit('looterGo', i, c); } }
      if (l.tgt == null) return;
      l.acc += dt;
      if (l.acc >= D.autoOpen) {
        const c = S.chests.find(x => x.id === l.tgt);
        taken.delete(l.tgt); l.tgt = null; l.acc = 0;
        if (c) golemAct(c, i);
      }
    });
  }

  // ---------- Potions ----------
  // 2.4: the Town. Between fights the party can walk into town: the field holds still (the Garrison keeps
  // earning) while you gear up at the Forge, brew at the Alchemist, recruit at the Tavern.
  // 3.0: everything lives in town, so it's open at any time but a Rift (the field, boss and all, holds still)
  G.townOk = () => !!(G.S.hero && G.S.hero.cls) && !R.rift;
  G.enterTown = function () {
    if (R.town || !G.townOk()) return false;
    R.town = true;
    G.S.st.townVisits = (G.S.st.townVisits || 0) + 1;
    emit('town', true);
    return true;
  };
  // hold the game still for s seconds (see tick); the stage keeps drawing
  G.cinematic = s => { R.cine = Math.max(R.cine || 0, s); };
  G.leaveTown = function () {
    if (!R.town) return false;
    R.town = false;
    emit('town', false);
    return true;
  };
  // 3.0: the town grows. Each building can be built up five times with gold for a lasting bonus that
  // outlives ascension; a building stands as scaffolding until what it holds is open (G.bldOpen, set by the UI)
  // 4.0 (DESIGN §4.5): each level is mostly an unlock now, not a percentage (no hidden power). What each sets on D, and who
  // reads it: forge I enchantAll (G.enchantAll at camp and in the menu), II reforge (camp), III salvOrbs (an orb a 40
  // shards salvaged), IV lordCard (+1 card at a lord's loot moment), V legendPk (a run's first legendary rolls a perk
  // rank). tavern I recruitN 4 (camp candidates), II recruitArmor, III allyDmgK 1.1, IV allyHpK 1.15, V startAlly (a
  // companion from the start). enchant I gambleWare (camp market), II enchantK 0.8, III whet2 (lords' whetstones x2), IV
  // ruinSafe, V crit power +0.05. alch I-V startPots 1/1/2/2/3 (II: mendBonus +1 Mend charge a run; IV: potion caps +2).
  // barracks: offline Embers cap (offHours 4-12 h; G.barracksRate). museum I keepSlots 1, II/IV the Codex rank cap 3/4
  // (G.codexCap), III uqK 1.2 (unique chances), V itemEmb 1.1 (item Embers). quests: the run deeds board (the meta's).
  // stars (Observatory): Star Chart nodes visible 8/16/24/32/37 (G.nodeVisible). pets (Hatchery): II/IV eggMult 1.5/2,
  // III +1 pet seat, V golden chance +2%. temple: the Heat dial and the Hall of Fame; II-V Fame +5% each. rift (Rift
  // Gate): I the Daily Siege, II Push On, III vaultKinds +1, IV pushLoot 1.25.
  G.BLD = [
    { id: 'forge', v: 1, fx: (L, d) => { d.enchantAll = 1; if (L >= 2) d.reforge = 1; if (L >= 3) d.salvOrbs = 1; if (L >= 4) d.lordCard = 1; if (L >= 5) d.legendPk = 1; } },
    // (4.0 meta: Tavern III companions +15% -> +10% damage, Enchanter V crit power +0.1 -> +0.05: companions are 50-80% of
    // the party's damage, so DESIGN's +15% was worth ~+12% of it all; the permanent block's budget, tests/meta/meta_rules.js, BUDGET)
    { id: 'tavern', v: 1, fx: (L, d) => { d.recruitN = 4; if (L >= 2) d.recruitArmor = 1; if (L >= 3) d.allyDmgK = 1.1; if (L >= 4) d.allyHpK = 1.15; if (L >= 5) d.startAlly = 1; } },
    { id: 'enchant', v: 1, fx: (L, d) => { d.gambleWare = 1; if (L >= 2) d.enchantK = 0.8; if (L >= 3) d.whet2 = 1; if (L >= 4) d.ruinSafe = 1; if (L >= 5) d.critMult += 0.05; } },
    // (the Alchemist: starting potions 1/1/2/2/3, chosen from III on (G.alchPick); II a Mend charge a run; IV potion caps +2)
    { id: 'alch', v: 1, fx: (L, d) => { d.startPots = [0, 1, 1, 2, 2, 3][L]; if (L >= 2) d.mendBonus = 1; if (L >= 3) d.startPotsPick = 1; if (L >= 4) d.potCap += 2; } },
    { id: 'barracks', v: 1, fx: (L, d) => { d.offHours = [0, 4, 6, 8, 10, 12][L]; } },
    { id: 'museum', v: 1, fx: (L, d) => { d.keepSlots = 1; d.codexCap = L >= 4 ? 4 : L >= 2 ? 3 : 2; if (L >= 3) d.uqK = 1.2; if (L >= 5) d.itemEmb = 1.1; } },
    // (the Quest Board: its board of run deeds (S.quests) is 3 / 4 / 4 / 5 / 5 long; III: the day's first deed pays x2; V: a weekly
    // deed for Gems)
    { id: 'quests', v: 1, fx: (L, d) => { d.deedBoard = [3, 3, 4, 4, 5, 5][L]; if (L >= 3) d.deedDaily = 2; if (L >= 5) d.deedWeekly = 1; } },
    { id: 'stars', v: 1, fx: (L, d) => { d.nodesOpen = [0, 8, 16, 24, 32, 99][L]; } },
    { id: 'pets', v: 1, fx: (L, d) => { if (L >= 2) d.eggMult *= L >= 4 ? 2 : 1.5; if (L >= 3) d.petSlots += 1; if (L >= 5) d.goldenChance += 0.02; } },
    { id: 'temple', v: 0.05, fx: (L, d) => { d.fameMult *= 1 + 0.05 * Math.max(0, L - 1); } },
    { id: 'rift', v: 1, fx: (L, d) => { d.daily = 1; if (L >= 2) d.pushOn = 1; if (L >= 3) d.vaultKinds = 1; if (L >= 4) d.pushLoot = 1.25; } },
  ];
  G.BLD_BY_ID = {}; G.BLD.forEach(b => { G.BLD_BY_ID[b.id] = b; });
  // the I-V table in words (DESIGN §4.5, with the meta's budget numbers): what each level opens or gives. (Data: the UI keeps
  // its own strings, bld_<id>_<L>; G.bldFlags(id, L) is the same table as D flags)
  G.BLD_LEVELS = {
    forge: ['ENCHANT ALL (camp and Forge)', 'Reforge at camp: an item’s level to this depth', 'Scrapping pays orbs (1 per 40 shards)', '+1 card at lords’ loot', 'A Siege’s first legendary rolls +1 perk rank'],
    tavern: ['4 recruits to choose from at camp', 'Recruits arrive with armour', 'Companions +10% damage', 'Companions +15% health', 'Start each Siege with a companion'],
    enchant: ['Gamble ware at the camp market', 'Enchanting costs 20% less', 'Whetstones ×2 from lords', 'The Orb of Ruin never bricks', 'Crit power +0.05'],
    alch: ['A random potion at the start', '+1 Mend charge a Siege', '2 chosen potions at the start', 'Potion caps +2', '3 chosen potions at the start'],
    barracks: ['Embers while away: 3% of your best payout an hour, up to 4 h', 'Up to 6 h away', 'Up to 8 h away', 'Up to 10 h away', 'Up to 12 h away'],
    museum: ['A keepsake slot and the Codex shelf', 'Codex rank cap 3', 'Unique chance +20%', 'Codex rank cap 4', 'Item Embers +10%'],
    quests: ['3 run deeds on the board', '4 run deeds', 'The daily deed pays ×2', '5 run deeds', 'A weekly deed (Gems)'],
    stars: ['The Star Chart opens: 8 stars', '16 stars', '24 stars', '32 stars', 'All 37 stars'],
    pets: ['The egg incubator', 'Hatching ×1.5', '+1 pet seat', 'Hatching ×2', 'Golden egg chance +2%'],
    temple: ['The Heat dial and the Hall of Fame', 'Fame +5%', 'Fame +10%', 'Fame +15%', 'Fame +20%'],
    rift: ['The Daily Siege', 'Push On after a win', 'Vault doors: one more secret land', 'Push loot +25%', 'The Weekly League (4.1)'],
  };
  G.BLD_MAX = 5;
  G.bldLvl = id => ((G.S.bld || {})[id] || 0);
  G.bldLv = G.bldLvl;
  // what a building's level L sets on D (the flags its fx writes; for the UI's I-V table and the tests)
  G.bldFlags = function (id, L) {
    const b = G.BLD_BY_ID[id]; if (!b || !(L > 0)) return {};
    const d0 = baseD(), d = baseD(), out = {};
    b.fx(Math.min(G.BLD_MAX, L), d);
    for (const k in d) if (d[k] !== d0[k] && typeof d[k] !== 'object') out[k] = d[k];
    return out;
  };
  // G.bldInfo(id) -> { id, lvl, max, cost (the next level's, 0 at max), costs [5], total, spent, can (Embers enough), open
  // (G.bldOpen: the UI's own gate), flags (what this level sets), next (what the next one sets) }
  G.bldInfo = function (id) {
    const b = G.BLD_BY_ID[id]; if (!b) return null;
    const L = G.bldLvl(id), max = G.BLD_MAX, cost = L < max ? G.BLD_COST[L] : 0;
    return { id, lvl: L, max, cost, costs: G.BLD_COST.slice(), total: G.BLD_COST.reduce((a, c) => a + c, 0), spent: G.BLD_COST.slice(0, L).reduce((a, c) => a + c, 0),
      can: L < max && (G.S.embers || 0) >= cost, open: !G.bldOpen || !!G.bldOpen(id), flags: G.bldFlags(id, L), next: L < max ? G.bldFlags(id, L + 1) : null };
  };
  G.townLvl = () => G.BLD.reduce((a, b) => a + G.bldLvl(b.id), 0);
  // 4.0: the town is built with Embers (the Furnace's), not the run's gold: 50 / 150 / 400 / 1,000 / 2,500 a level
  // (so a run's gold can't turn into lasting power). What each level gives becomes mostly unlocks (the meta's, §4.5)
  G.BLD_COST = [50, 150, 400, 1000, 2500];
  G.bldCost = id => G.BLD_COST[Math.min(G.BLD_COST.length - 1, G.bldLvl(id))];
  G.buildUp = function (id) {
    const S = G.S, b = G.BLD_BY_ID[id];
    if (!b || G.bldLvl(id) >= G.BLD_MAX || (G.bldOpen && !G.bldOpen(id))) return false;
    const c = G.bldCost(id);
    if ((S.embers || 0) < c) return false;
    S.embers -= c; S.bld = S.bld || {}; S.bld[id] = G.bldLvl(id) + 1;
    R.dirty = true; recalc();
    emit('build', id, S.bld[id]);
    return true;
  };
  // the Alchemist brews the potion you ask for: dearer with every one you already drink
  G.brewCost = id => Math.round(Math.max(200, D.incomeRef * 90) * Math.pow(1.45, G.S.pots[id] || 0));
  G.brewPotion = function (id) {
    const S = G.S, c = G.brewCost(id);
    if (!(S.pots[id] < D.potCap) || S.gold < c) return null;
    S.gold -= c;
    return givePotion(id);
  };
  function givePotion(id) {
    const S = G.S;
    const avail = G.POTIONS.filter(p => S.pots[p.id] < D.potCap);
    if (!avail.length) { addEssence(10 * D.essMult, 'potion'); emit('potionFull'); return null; }
    const p = id ? G.POTIONS.find(x => x.id === id && S.pots[x.id] < D.potCap) || pick(avail) : pick(avail);
    S.pots[p.id]++;
    R.dirty = true;
    emit('potion', p);
    return p;
  }
  G.givePotion = givePotion;

  // ---------- Bosses ----------
  // Past the Mad Button the lands come round again, corrupted: cycle 1 at depth 40, 2 at 80…
  const SPAN = () => G.REALMS.length * G.REALM_SIZE;
  // 4.0: inside a Siege the land is the route's (S.run.route[land slot], chosen at doors); past it (Push On) and
  // outside a run, the 3.x order
  function realmIndex(d) {
    const k = Math.floor(Math.max(0, d) / G.REALM_SIZE), run = G.S && G.S.run;
    if (run && run.on && run.route && k < run.route.length && run.route[k] != null) return run.route[k];
    return k % G.REALMS.length;
  }
  G.realmIndex = realmIndex;
  G.cycle = d => Math.floor(Math.max(0, d) / SPAN());
  const ROMAN = ['', '', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];
  G.corrupt = (name, d) => { const c = G.cycle(d); return c ? 'Corrupted ' + name.replace(/^The /, '') + (c in ROMAN ? ROMAN[c] : ' ' + c) : name; };
  G.realmName = d => G.corrupt(G.REALMS[realmIndex(d)].name, d);
  function isLord(d) { return d % G.REALM_SIZE === G.REALM_SIZE - 1; }
  G.isLord = isLord;
  // 4.0 (Wave 0): the Mad Button and the First Hand by their land, not by a depth (3.6 checked 39 and 64, which with three
  // zones a land are no lords at all, so their sure drops and the Mad Button's record never came)
  const realmIdOf = d => (G.REALMS[realmIndex(d)] || {}).id;
  G.isMadLord = b => !!(b && b.lord && realmIdOf(b.d) === 'void');
  G.isHandLord = b => !!(b && b.lord && realmIdOf(b.d) === 'sky');
  // what a boss is in a Siege: 'final' (the Mad Button, the 6th land's lord), 'act' (lands 2 and 4), 'lord' or 'boss'
  function bossKind(d) {
    if (!isLord(d)) return 'boss';
    if (inSiege() && G.SIEGE) { if (d === G.SIEGE.final) return 'final'; if (G.SIEGE.actBoss.includes(d)) return 'act'; }
    return 'lord';
  }
  G.bossKind = bossKind;
  function bossHp(d) {
    return TUNE.bossBase * Math.pow(TUNE.bossGrowth, d) * (isLord(d) ? TUNE.lordHp : 1);
  }
  G.bossHp = bossHp;
  function bossName(d) {
    const r = G.REALMS[realmIndex(d)];
    return G.corrupt(isLord(d) ? r.lordName : r.minionName, d);
  }
  G.bossName = bossName;

  // Boss moves: a telegraphed wind-up the Hand can break by tapping. Broken,
  // the boss staggers and takes more damage; left alone, the move lands.
  G.BOSS_MOVES = {
    // (2.3: broken only by tapping the weak point that opens beside the boss, or by Smite; clicking the Button doesn't)
    slam:   { col: '#ff3b3b', name: 'SLAM', wind: 2.2, need: 3 },
    summon: { col: '#b36bff', name: 'SUMMON', wind: 2.4, need: 3 },
    shield: { col: '#4fa8ff', name: 'SHIELD', wind: 3, need: 4 },
    barrage: { col: '#ffb347', name: 'BARRAGE', wind: 2, need: 3 },
    // DOOM: lands on everyone for most of their health. Ward it, break it, or Smite it
    doom:   { col: '#ff2ad4', name: 'DOOM', wind: 3.2, need: 6 },
  };
  // later phases bring the barrage, a volley at the heroes themselves
  const MOVE_ORDER = {
    lord: [['slam', 'summon', 'shield', 'doom'], ['slam', 'barrage', 'doom', 'summon', 'shield', 'barrage'], ['barrage', 'doom', 'slam', 'barrage', 'summon', 'doom']],
    boss: [['slam', 'slam', 'summon'], ['slam', 'barrage', 'doom', 'summon', 'barrage']],
  };
  // the first land's bosses never Doom; from the second land on every boss can
  const moveOk = (b, k) => k !== 'doom' || b.d >= TUNE.doomFrom;
  function bossMoves(b, dt) {
    if (b.stagger > 0) b.stagger -= dt;
    if (!b.move) {
      if ((b.moveT -= dt) > 0) return;
      const set = MOVE_ORDER[b.lord ? 'lord' : 'boss'], order = set[Math.min(set.length, b.phase || 1) - 1];
      // (an act boss's 4th phase fights like a lord's 3rd)
      let k = order[(b.moveN = (b.moveN || 0) + 1) % order.length];
      if (!moveOk(b, k)) k = 'slam';
      const M = G.BOSS_MOVES[k], need = M.need + (b.lord ? 1 : 0);
      // wp: where round the boss its weak point opens (0-1 of a turn, kept off the top)
      const wind = M.wind * (G.bossHas(b, 'hasted') ? 0.8 : 1);
      b.move = { k, t: wind, T: wind, n: 0, need, wp: 0.1 + G.rng() * 0.8 };
      emit('bossMove', b);
      return;
    }
    // 4.0: the Ward assist: at Heat 0-2, with auto-cast on (the hero toggle), Ward goes up on a telegraphed DOOM if it's ready
    if (b.move.k === 'doom' && b.move.t <= 0.6 && !(R.ward > 0) && inSiege() && heatNow() <= 2 && G.S.hero && G.S.hero.cast && G.powerReady('ward')) {
      G.usePower('ward'); emit('wardAssist', b);
    }
    if ((b.move.t -= dt) > 0) return;
    // the move lands
    const k = b.move.k;
    b.move = null; b.moveT = (b.lord ? 5 : 7) / (1 + 0.3 * ((b.phase || 1) - 1)) * (b.enr > 0 ? 0.5 : 1);
    // 2.2: a boss's blows take a share of what they hit, so a fight is never safe; its depth's curve is the floor
    const rage = b.rage ? 1.5 : 1;
    if (k === 'barrage' && G.partyUnits) {
      const a = G.mobAtk(b.d) * rage;
      for (let i = 0; i < 3 && R.boss === b; i++) { const up = G.partyUnits().filter(u => !(u.down > 0)); const v = up.length && chance(0.75) ? up[Math.floor(G.rng() * up.length)].who : 'button'; G.blowParty(v, a * 2.2, 0.1 * rage, 'barrage'); emit('barrageHit', b, v, i); }
    }
    // a slam lands on everyone: the Button and each hero standing
    if (k === 'slam' && G.hurtButton) {
      const a = G.mobAtk(b.d) * rage;
      const up = G.partyUnits ? G.partyUnits().filter(u => !(u.down > 0)) : [];
      G.blowParty('button', a * (b.lord ? 5 : 3.5), (b.lord ? 0.2 : 0.15) * rage, 'slam');
      // (a wipe on the Button's hit ends the fight: the revived party isn't hit again)
      for (const u of up) if (R.boss === b) G.blowParty(u.who, a * (b.lord ? 3 : 2), (b.lord ? 0.18 : 0.13) * rage, 'slam');
    }
    if (k === 'summon' && G.spawnPack) { G.spawnPack(true); G.spawnPack(true); }
    // Doom: most of everyone's health at once. A Button that isn't full breaks, and the party goes down with it
    if (k === 'doom' && G.blowParty) {
      const up = G.partyUnits ? G.partyUnits().filter(u => !(u.down > 0)) : [];
      // 4.0: DOOM by Heat: x0.64 at Heat 0-2 (the Button 61%/54% for a lord/boss), x0.8 at 3-5, in full from 6
      const n = heatNow(), dk = inSiege() ? TUNE.doomK[n <= 2 ? 0 : n <= 5 ? 1 : 2] : 1;
      // (an unanswered DOOM is remembered: the run summary names it if the party falls soon after)
      if (!(R.ward > 0)) R.doomAt = ptime();
      // (never the rage on top: a Button at full health always survives it)
      G.blowParty('button', 0, (b.lord ? 0.95 : 0.85) * dk, 'doom');
      for (const u of up) if (R.boss === b) G.blowParty(u.who, 0, (b.lord ? 0.9 : 0.8) * dk, 'doom');
    }
    emit('bossMoveLand', b, k);
  }
  // ---------- The Hand's powers (2.2): three choices with cooldowns ----------
  // Smite hits the boss for five seconds of the party's damage and breaks its wind-up (or blasts the
  // crowd at the Button); Ward makes the Button and the party untouchable for a moment; Mend heals
  // everyone and lifts the fallen.
  G.POWERS = {
    smite: { cd: 18, icon: 'ic_bolt', key: 'Z' },
    ward: { cd: 26, dur: 3.5, icon: 'it_knight_shield', key: 'X' },
    mend: { cd: 40, icon: 'ic_heart', key: 'C' },
  };
  R.pw = { smite: 0, ward: 0, mend: 0 };
  // Smite needs something to hit: not a boss shrugging off a phase change, not an empty field
  const smiteTarget = () => R.boss ? !R.boss.dead && !(R.boss.inv > 0) : R.mobs.some(m => !m.dead && m.p > 0.45 && m.kind !== 'guardian');
  // 4.0: Mend is charges in a Siege (TUNE.mendCharges a land, +1 with a healer standing; refilled at each new land and at
  // camp), mendLock s apart; a land with No Mending (a map mod) has none
  G.mendOk = () => !inSiege() || ((G.S.run.mend | 0) > 0 && !(G.landNow && G.landNow().noMend));
  // (4.0: not while the Siege holds the field: a card or the loot moment is a pause, not a free heal)
  G.powerReady = id => !R.town && !(G.runHeld && G.runHeld()) && !(R.pw[id] > 0) && !!(G.S.hero && G.S.hero.cls) && !(R.stun > 0) && (id !== 'smite' || smiteTarget()) && (id !== 'mend' || G.mendOk());
  G.usePower = function (id) {
    const P = G.POWERS[id];
    if (!P || !G.powerReady(id)) return false;
    const S = G.S, charge = id === 'mend' && inSiege();
    R.pw[id] = charge ? TUNE.mendLock : P.cd;
    if (id === 'smite') {
      const b = R.boss;
      if (b && !b.dead) {
        if (b.move) { const mk = b.move.k; b.move = null; b.moveT = b.lord ? 5 : 7; b.stagger = 3; emit('bossStagger', b, mk); }
        if (G.bossHas(b, 'shielded') && !(b.sh > 0)) { b.sh = TUNE.shieldDown; emit('shieldBreak', b); }
        hitBoss((D.heroDps || 1) * (D.bossMult || 1) * 5);
      } else if (G.dealHit) for (const m of R.mobs.slice()) if (!m.dead && m.p > 0.45 && m.kind !== 'guardian') G.dealHit(m, (D.heroHit || 1) * 8, 'smite', false);
    } else if (id === 'ward') {
      R.ward = P.dur;
    } else if (id === 'mend') {
      const h = S.hero, k = charge ? TUNE.mendHeal : 0.35;
      if (!(R.btnDown > 0)) h.hp = Math.min(D.heroHp, h.hp + D.heroHp * k);
      if (G.mendParty) G.mendParty(charge ? TUNE.mendHeal : 0.4);
      if (charge) { S.run.mend = Math.max(0, (S.run.mend | 0) - 1); emit('mendCharge', S.run.mend, S.run.mendMax); }
    }
    S.st.powers = (S.st.powers || 0) + 1;
    emit('power', id);
    return true;
  };
  function powersTick(dt) {
    for (const k in R.pw) if (R.pw[k] > 0) R.pw[k] = Math.max(0, R.pw[k] - dt);
    if (R.ward > 0) R.ward = Math.max(0, R.ward - dt);
  }
  function tapBoss() {
    const b = R.boss;
    if (!b || !b.move) return false;
    emit('bossTap', b);
    if (++b.move.n >= b.move.need) {
      const k = b.move.k;
      b.move = null; b.moveT = b.lord ? 5 : 7; b.stagger = 3;
      if (G.bossHas(b, 'shielded')) { b.sh = TUNE.shieldDown; emit('shieldBreak', b); }
      emit('bossStagger', b, k);
    }
    return true;
  }
  G.tapBoss = tapBoss;
  function startBoss() {
    const S = G.S;
    // an invasion is fought out first
    // (4.0: not while the Siege holds the field: a card, the loot moment, camp...; nor during the Last Stand)
    if (R.boss || R.rift || !R.bossReady || R.inv || R.town || S.fallen || (inSiege() && G.runHeld && G.runHeld()) || R.lastStand) return false;
    const d = S.depth;
    const lord = isLord(d), kind = bossKind(d);
    const max = bossMax(d);
    // a boss that got away comes back with the wounds it took
    const scar = S.scar && S.scar.d === d ? S.scar.k : 1;
    // every failed try rallies the Warden: +20% damage on a lord (+15% on a boss), up to five tries,
    // and after a long rest the first fight is fought rested (+40%)
    const rally = (S.scar && S.scar.d === d ? TUNE.rally * Math.min(TUNE.rallyMax, S.scar.n || 0) : 0) + (S.rested ? 0.4 : 0);
    const hp = max * scar;
    if (G.heroBossStart) G.heroBossStart();
    // (4.0: an act boss and the Mad Button get as much more time as their least fight is longer than a lord's)
    const time = (D.bossTime + (lord ? 15 : 0) + (kind === 'act' ? TUNE.bossMinAct - TUNE.bossMinLord : kind === 'final' ? TUNE.bossMinFinal - TUNE.bossMinLord : 0)) * torment().bossTime;
    // (4.0: kind 'boss' | 'lord' | 'act' | 'final'; phases: a boss 2, a lord and the Mad Button 3, an act boss 4)
    R.boss = { d, lord, kind, act: kind === 'act', final: kind === 'final', phases: kind === 'act' ? 4 : lord ? 3 : 2,
      hp, max, scar, rally, phase: 1, inv: 0, t: time, T: time, moveT: lord ? 4 : 6, stagger: 0,
      realm: realmIndex(d), sprite: lord ? G.REALMS[realmIndex(d)].lord : G.REALMS[realmIndex(d)].minion };
    // 2.3: from the second land on, bosses carry affixes, the same ones at the same depth every try
    R.boss.affix = bossAffixes(d);
    if (R.boss.affix.includes('shielded')) R.boss.sh = 0;
    // a boss that comes back wounded starts in the phase its health calls for
    R.boss.phase = phaseAt(R.boss);
    if (lord && R.boss.phase === R.boss.phases) R.boss.rage = 1;
    R.bossReady = false; R.bossIn = null;
    emit('bossStart', R.boss);
    return true;
  }
  G.startBoss = startBoss;
  const AFFIXES = ['shielded', 'vampiric', 'hasted', 'regen', 'frenzied'];
  function bossAffixes(d) {
    // (4.0: Heat 3+ gives lords one more; the Mad Button one more; G.bossAffixAdd(d): more from a map mod, e.g. an Elite lord)
    const n = (d >= TUNE.affixFrom ? 1 : 0) + (d >= 30 ? 1 : 0) + (isLord(d) && d >= 14 ? 1 : 0) + (isLord(d) ? torment().lordAffix : 0)
      + (bossKind(d) === 'final' ? 1 : 0) + (G.bossAffixAdd ? G.bossAffixAdd(d) | 0 : 0);
    const rnd = G.seeded(d * 7919 + 13), pool = AFFIXES.slice(), out = [];
    for (let i = 0; i < Math.min(n, pool.length); i++) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    return out;
  }
  G.bossAffixes = bossAffixes;
  G.bossHas = (b, a) => !!(b && b.affix && b.affix.includes(a));
  // How much of this depth's boss the Warden would take down in the time limit, without clicking (1 = all of it)
  // a boss's health: its depth's, but never less than a real fight's worth of the party's damage
  function bossMax(d) {
    // 4.0: an act boss and the Mad Button have half again the health of a lord (the Mad Button twice that at Heat 10)
    const kind = bossKind(d), T = torment(), kx = kind === 'act' ? TUNE.actHp : kind === 'final' ? TUNE.finalHp : 1;
    const curve = G.bossHp(d) * (G.omen ? G.omen().bossHp : 1) * kx;
    // (the party's damage and the Hand's own: clicks at the pace you've been clicking)
    // (at the steady strength: a tome, a shrine or an event running when the boss is called doesn't make it tougher;
    // and the clicks count at half, since nobody keeps up the same pace all fight)
    const clickDps = (R.cps || 0) * TUNE.bossClickK * (D.heroHitBase || D.heroHit || 0) * TUNE.clickVolley * (1 + D.crit * (D.critMult - 1));
    // a full fight only on new ground: a depth already beaten goes quicker. 4.0: new to THIS run (S.maxDepth is the run's),
    // so every zone of a Siege is a full fight, and only one fought again after a wipe's push-back is quick
    const fresh = d >= (G.S.maxDepth || 0) ? 1 : TUNE.bossMinOld;
    // the least a fight lasts: a boss 9 s, a lord 20, an act boss 24, the Mad Button 30 (s of the party's damage)
    const secs = kind === 'final' ? TUNE.bossMinFinal : kind === 'act' ? TUNE.bossMinAct : kind === 'lord' ? TUNE.bossMinLord : TUNE.bossMin;
    // (4.0: inside a Siege, the party's damage as it has been lately (R.dpsAvg: momentum, a Headhunter's or a Reaper's
    // stacks count as often as they were up), never less than the steady one: else a strong build melted a 20-s lord in
    // two seconds and Smite one-shot it; the least fight length is the lord's check, DESIGN §14)
    const dps = Math.max(D.heroDpsBase || D.heroDps || 0, inSiege() && TUNE.bossFloorAvg > 0 ? R.dpsAvg || 0 : 0);
    const floor = (dps + clickDps) * (D.bossMult || 1) * secs * fresh * T.bossTime;
    return Math.max(curve * T.bossHp, floor) * (kind === 'final' ? T.madX : 1);
  }
  G.bossMax = bossMax;
  function bossOdds() {
    const S = G.S, d = S.depth, lord = isLord(d);
    const scar = S.scar && S.scar.d === d ? S.scar : null;
    const hp = bossMax(d) * (scar ? scar.k : 1);
    const rally = (scar ? TUNE.rally * Math.min(TUNE.rallyMax, scar.n || 0) : 0) + (S.rested ? 0.4 : 0);
    return (D.heroDps || 0) * (D.bossMult || 1) * (1 + rally) * (D.bossTime + (lord ? 15 : 0)) * torment().bossTime / Math.max(1e-9, hp);
  }
  G.bossOdds = bossOdds;

  // Phases: a lord changes at 66% and 33% of its health, a boss at 50% (4.0: an act boss, four phases, at 75/50/25%). It
  // shrugs off everything for a moment, throws the Horde back, hits the whole party and fights harder.
  const PH = { 2: [0.5], 3: [0.66, 0.33], 4: [0.75, 0.5, 0.25] };
  const phasesOf = b => b.phases || (b.lord ? 3 : 2);
  function phaseAt(b) { const th = PH[phasesOf(b)] || PH[2]; let p = 1; for (const x of th) if (b.hp < b.max * x) p++; return p; }
  function hitBoss(dmg) {
    const b = R.boss;
    if (!b || b.dead) return;
    if (b.inv > 0) return;
    // a shield soaks most of it; a staggered boss takes half again
    if (b.move && b.move.k === 'shield') dmg *= 0.3;
    // Shielded: a barrier soaks most of it until Smite or a broken wind-up cracks it (it comes back after 10 s)
    else if (G.bossHas(b, 'shielded') && !(b.sh > 0)) dmg *= 0.35;
    else if (b.stagger > 0) dmg *= 1.5;
    if (b.rally) dmg *= 1 + b.rally;
    b.hp -= dmg;
    if (b.hp <= 0) bossWin();
    else if (phaseAt(b) > b.phase) {
      // one phase at a time: a huge hit stops at the next phase's floor
      const fl = (PH[phasesOf(b)] || PH[2])[b.phase] || 0;
      if (fl > 0) b.hp = Math.max(b.hp, fl * b.max + 1);
      b.phase++; b.inv = 1.6; b.move = null; b.moveT = 1.5;
      // the last phase of a lord is its rage: twice the adds, harder bites
      if (b.lord && b.phase === phasesOf(b)) { b.rage = 1; emit('bossRage', b); }
      for (const m of R.mobs) m.p = Math.max(-0.1, m.p - 0.3);
      const a = G.mobAtk(b.d);
      emit('bossPhase', b);
      if (G.partyUnits) for (const u of G.partyUnits()) if (!(u.down > 0) && R.boss === b) G.hurtParty(u.who, a * 1.5, 'phase');
    }
  }
  G.hitBoss = hitBoss;

  function bossWin() {
    const S = G.S, b = R.boss;
    b.dead = true;
    // (4.0: the Button's health share as the killing blow lands, before a boss's heal: the Deeds read it, 'By a Thread')
    b.btnAt = S.hero && D.heroHp > 0 ? Math.max(0, S.hero.hp) / D.heroHp : 1;
    const d = b.d;
    const first = S.st.bossKills === 0;
    if (G.isMadLord(b) && S.rec && !S.rec.madTime) S.rec.madTime = S.st.playTime;
    S.st.bossKills++;
    if (b.lord) S.st.lordKills++;
    const om = G.omen ? G.omen().bossRew : 1;
    const rew = { gold: D.incomeRef * (b.lord ? 40 : 10) * om, ess: (2 + d * 0.3) * (b.lord ? 3 : 1) * D.essMult * om,
      eggs: 0, pots: [], chests: [], lord: b.lord, d };
    addGold(rew.gold, 'boss');
    addEssence(rew.ess, 'boss');
    let eggEV = (b.lord ? 1 + Math.floor(d / 15) : 0.15) * D.eggMult;
    rew.eggs = addEggs(rollCount(eggEV) + (first ? 1 : 0));
    const pots = b.lord ? 1 : (chance(0.15) ? 1 : 0);
    for (let i = 0; i < pots; i++) { const p = givePotion(); if (p) rew.pots.push(p); }
    const tier = b.lord ? Math.min(6, 1 + Math.floor(d / 8)) : Math.min(5, Math.floor(d / 8));
    const count = (b.lord ? 2 : 1) * om;
    if (G.heroBossEnd) G.heroBossEnd(true); // its swarm dies with it, still in this land
    // only this boss's wounds heal; a deeper wall the party was pushed back from keeps its scar and Rally
    if (S.scar && S.scar.d === d) S.scar = null;
    S.rested = 0;
    S.depth++;
    if (S.depth >= S.maxDepth) S.tormentRun = Math.max(S.tormentRun || 0, torment().n);
    // 4.0: a seat opens at this run's depths 3, 6 and 9 (G.PARTY_AT against the run, not the lifetime best)
    if (S.depth > S.maxDepth) {
      S.maxDepth = S.depth;
      const slot = G.PARTY_AT ? G.PARTY_AT.indexOf(S.maxDepth) : -1;
      if (slot >= 0) emit('slotOpen', slot);
    }
    if (S.depth > S.bestDepth) S.bestDepth = S.depth;
    S.bossMeter = 0;
    R.boss = null;
    R.dirty = true;
    recalc();
    // 4.0 attrition: a boss kill heals the Button and the party standing +10%, a lord's +25% (no more full heals)
    if (inSiege() && G.healParty) G.healParty(b.lord ? TUNE.healLord : TUNE.healBoss);
    // the loot bursts out of it onto the ground; without js/world.js, chests open as before. 4.0: inside a Siege the boss's
    // items are the loot moment's cards (js/run.js), banked in the save now, before anything else can happen
    if (inSiege() && G.lootMoment) G.lootMoment(b);
    else if (G.bossLoot) G.bossLoot(b, tier, count);
    else for (let i = 0; i < count; i++) rew.chests.push(openChest(makeChest(tier, null), 'boss'));
    questProgress('boss', 1);
    // 4.0: the run's books (js/run.js): Fame, the pouch, Integrity, a land's Mend charges
    if (G.runBossWin) G.runBossWin(b, rew);
    emit('bossWin', rew, b);
    // 3.4: on to the next zone: a short march, the ground rolling by. 4.0: what comes after a boss first (the loot moment,
    // the card, a relic, camp and doors: js/run.js beats) holds the field, and the march starts when they're done
    if (!R.rift && !(G.runAfterBoss && G.runAfterBoss(b))) startMarch(d);
    // 4.0 (ADDENDUM: the boss's items are banked in the save the moment it dies): with the moment open (its beat holds the
    // field, its cards in S.run.loot) the save is written now, so a reload mid-moment brings the same cards back
    if (inSiege() && G.UI && G.save && G.S.run && G.S.run.loot) { try { G.save(); } catch (e) { /* the periodic save tries again */ } }
  }
  // 4.0: the one place a march starts (bossWin, the end of the post-boss beats, a secret land's return)
  function startMarch(fromD) {
    const S = G.S;
    if (fromD == null) fromD = S.depth - 1;
    R.march = { t: TUNE.marchTime, T: TUNE.marchTime };
    const newLand = realmIndex(S.depth) !== realmIndex(fromD);
    emit('marchStart', TUNE.marchTime, newLand);
    if (newLand) emit('realm', realmIndex(S.depth));
    return R.march;
  }
  G.startMarch = startMarch;

  function bossFail() {
    const S = G.S, b = R.boss;
    R.boss = null;
    // it keeps 70% of the damage it took, and never comes back weaker than 25%
    const left = Math.max(0, b.hp / b.max);
    // only a try that actually hurt the boss counts toward Rally
    // and it heals back less after each try, so a wall always gives way to someone who keeps at it
    const n0 = S.scar && S.scar.d === b.d ? S.scar.n || 0 : 0;
    const heal = b.lord && inSiege() ? TUNE.scarHealLord : TUNE.scarHeal;
    S.scar = { d: b.d, k: Math.max(0.15, Math.min(1, left + (1 - left) * heal / (1 + n0))), n: n0 + (left < 0.95 ? 1 : 0) };
    S.rested = 0;
    b.wound = 1 - S.scar.k;
    if (G.heroBossEnd) G.heroBossEnd(false);
    S.bossMeter = Math.floor(D.bossNeed * 0.5);
    if (G.zoneSync) G.zoneSync();
    emit('bossFail', b);
    // 4.0: a lost fight against a lord, an act boss or the Mad Button cracks a pip (none in land 1, the muster; a wipe
    // that ends the fight takes its own pip, not two). A minion boss lost: a scar and a retry, as before
    if (b.lord && inSiege() && G.pipHit && !R.wiping) G.pipHit('lord', b);
  }
  G.fleeBoss = () => { if (R.boss) bossFail(); };

  // ---------- Wisps ----------
  function spawnWisp() {
    R.wisp = { t: TUNE.wispLife, life: TUNE.wispLife, seed: G.rng() };
    emit('wisp', R.wisp);
  }
  function catchWisp() {
    const S = G.S;
    if (!R.wisp) return;
    R.wisp = null;
    S.st.wisps++;
    const e = G.WISP_EFFECTS[weighted(G.WISP_EFFECTS.map(x => x.w))];
    let amount = 0;
    if (e.id === 'frenzy' || e.id === 'storm') {
      S.buffs = S.buffs.filter(b => b.id !== e.id);
      S.buffs.push({ id: e.id, t: e.dur * D.buffDur, T: e.dur * D.buffDur });
      R.dirty = true;
    } else if (e.id === 'lootstorm') {
      // (4.0: a Loot Storm: +1 card at the next loot moment, a rare floor (js/run.js); outside a Siege, a chest)
      if (inSiege()) S.run.lootStorm = (S.run.lootStorm | 0) + 1; else spawnChest();
    } else if (e.id === 'rain') {
      // (4.0: 2 chests, not 8: chests are few and each one an event)
      for (let i = 0; i < TUNE.wispRain; i++) spawnChest(undefined, undefined, false, false, true);
    } else if (e.id === 'lucky') {
      amount = Math.min(S.gold * 0.15 + D.incomeRef * 30, D.incomeRef * 600);
      addGold(amount, 'wisp');
    } else if (e.id === 'egg') {
      addEggs(1);
    }
    questProgress('wisp', 1);
    emit('wispCatch', e, amount);
  }
  G.catchWisp = catchWisp;

  // ---------- Shop ----------
  function upgCost(u, L) { return u.base * Math.pow(u.growth, L); }
  G.upgCost = u => upgCost(u, G.S.upg[u.id] || 0);
  function buyUpgrade(id) {
    const S = G.S, u = G.UPGRADES.find(x => x.id === id);
    // (4.0: Treasure Sense, Treasure Hall, Looter and Loot Crew are no longer sold)
    if (!u || u.off) return false;
    const L = S.upg[id] || 0;
    if (u.max && L >= u.max) return false;
    if (u.req && !(S.upg[u.req] > 0)) return false;
    const c = upgCost(u, L);
    if (S.gold < c) return false;
    S.gold -= c; S.upg[id] = L + 1;
    R.dirty = true; recalc();
    emit('buy', 'upg', id);
    return true;
  }
  G.buyUpgrade = buyUpgrade;

  function heroCost(h, n, amount) { return G.geoCost(h.cost, G.HERO_GROWTH, n, amount); }
  G.heroCost = (h, amount) => heroCost(h, G.S.heroes[h.id] || 0, amount);
  G.heroMax = h => G.geoMax(h.cost, G.HERO_GROWTH, G.S.heroes[h.id] || 0, G.S.gold);
  function buyHero(id, amount) {
    const S = G.S, h = G.HEROES.find(x => x.id === id);
    const n = S.heroes[id] || 0;
    if (amount === 'max') amount = G.geoMax(h.cost, G.HERO_GROWTH, n, S.gold);
    if (amount <= 0) return false;
    const c = heroCost(h, n, amount);
    if (S.gold < c) return false;
    S.gold -= c; S.heroes[id] = n + amount;
    R.dirty = true; recalc();
    emit('buy', 'hero', id, amount);
    return true;
  }
  G.buyHero = buyHero;

  // ---------- 4.0: Auto-invest (DESIGN §5.5; the playtest bots' payback rule, moved into the game) ----------
  // Which purchase adds the most income per gold: the Hand upgrades on sale and one more of each Garrison class, measured
  // by trying each (an income estimate: the Garrison, clicks at the recent pace, chests); the best is bought while it
  // leaves autoKeep of the gold for the camp. Returns the number bought. Not a decision: the camp is where gold choices are.
  function incomeEst(cps) {
    const critEV = 1 + D.crit * (D.critMult - 1), combo = 1 + Math.min(D.comboCap, 40) * D.comboPer, clickRate = cps * 0.7;
    const clicksGold = D.click * clickRate * critEV * combo + D.click * (D.autoCps + D.petCps) * critEV;
    const chestRate = (clickRate * D.chestProg + (D.autoCps + D.petCps) * D.chestProg * TUNE.autoChestFactor) / D.chestNeed + (D.scout || 0);
    return D.gps + clicksGold + chestRate * D.incomeRef * 2.5 * D.itemMult;
  }
  G.autoInvest = function (maxBuys, keep) {
    const S = G.S;
    if (!S.hero || !S.hero.cls) return 0;
    const cps = Math.max(1, R.cps || 0), reserve = (keep == null ? TUNE.autoKeep : keep);
    let n = 0;
    // (the trials measure income only: the heroes' combat numbers (G.heroFinish, most of a recalc) are left out until the end)
    const hf = G.heroFinish;
    G.heroFinish = null;
    try {
    for (let guard = 0; guard < (maxBuys || TUNE.autoBuys); guard++) {
      const spend = S.gold * (1 - reserve), base = incomeEst(cps);
      let best = null;
      const consider = (kind, id, cost, apply, undo) => {
        if (!(cost <= spend)) return;
        apply(); recalc();
        const score = (incomeEst(cps) - base) / cost;
        undo(); recalc();
        if (!best || score > best.score) best = { kind, id, score };
      };
      for (const u of G.UPGRADES) {
        const L = S.upg[u.id] || 0;
        if (u.off || (u.max && L >= u.max) || (u.req && !(S.upg[u.req] > 0))) continue;
        consider('upg', u.id, upgCost(u, L), () => { S.upg[u.id] = L + 1; }, () => { if (L) S.upg[u.id] = L; else delete S.upg[u.id]; });
      }
      for (const h of G.HEROES) {
        const c = S.heroes[h.id] || 0;
        consider('hero', h.id, heroCost(h, c, 1), () => { S.heroes[h.id] = c + 1; }, () => { if (c) S.heroes[h.id] = c; else delete S.heroes[h.id]; });
      }
      if (!best || !(best.score > 0)) break;
      if (!(best.kind === 'upg' ? buyUpgrade(best.id) : buyHero(best.id, 1))) break;
      n++;
    }
    } finally { G.heroFinish = hf; R.dirty = true; recalc(); }
    if (n) emit('autoInvest', n);
    return n;
  };

  // 4.0: the Star Chart (the Constellation) is permanent and priced in Embers: 2.5 a point of its 3.x essence cost
  G.NODE_EMBERS = 2.5;
  function nodeCost(nd, L) { return Math.ceil(G.NODE_EMBERS * Math.ceil(nd.cost * Math.pow(nd.growth, L))); }
  G.nodeCost = nd => nodeCost(nd, G.S.nodes[nd.id] || 0);
  function nodeAvailable(nd) {
    if (!nd.req.length) return true;
    return nd.req.some(r => (G.S.nodes[r] || 0) > 0);
  }
  G.nodeAvailable = nodeAvailable;
  // 4.0: the Observatory shows the Star Chart: 8 nodes at level I, 16, 24, 32, all 37 at V (in the order of G.NODES)
  G.nodeVisible = nd => G.NODES.indexOf(nd) < (D.nodesOpen || 0);
  function buyNode(id) {
    const S = G.S, nd = G.NODE_BY_ID[id];
    const L = S.nodes[id] || 0;
    if (!nd || L >= nd.max || !nodeAvailable(nd) || !G.nodeVisible(nd)) return false;
    const c = nodeCost(nd, L);
    if ((S.embers || 0) < c) return false;
    S.embers -= c; S.nodes[id] = L + 1;
    R.dirty = true; recalc();
    emit('buy', 'node', id);
    return true;
  }
  G.buyNode = buyNode;

  // ---------- 4.0: the Hall of Fame (DESIGN §4.4; data.js G.HALL): capped ranks bought with Fame, rank k costs base x k^2 ----------
  //   G.hall(id) -> the rank owned (the run knobs read it: hf_wind, hf_reroll, hf_banish, hf_door, hf_belt, hf_keep, hf_qm)
  //   G.hallCost(l | id) -> the next rank's price (0 at max); G.hallTotal(l | id) -> every rank's; G.buyHall(id) -> bool
  //   ('hall'(id, rank, cost) and the 3.x 'buy'('legacy', id)). G.legacyCost / G.buyLegacy: the same, by their 3.x names
  function legacyCost(l, L) { return l.sq ? Math.ceil(l.base * (L + 1) * (L + 1)) : Math.ceil(l.base * Math.pow(l.growth, L)); }
  const hallOf = x => (typeof x === 'string' ? G.HALL_BY_ID[x] : x);
  G.hall = id => (G.S && G.S.legacy && G.S.legacy[id]) | 0;
  G.hallCost = x => { const l = hallOf(x); if (!l) return 0; const L = G.hall(l.id); return L >= l.max ? 0 : legacyCost(l, L); };
  G.hallTotal = x => { const l = hallOf(x); let c = 0; if (l) for (let k = 0; k < l.max; k++) c += legacyCost(l, k); return c; };
  G.legacyCost = l => legacyCost(l, G.S.legacy[l.id] || 0);
  function buyLegacy(id) {
    const S = G.S, l = G.HALL_BY_ID[id];
    if (!l) return false;
    const L = S.legacy[id] || 0;
    if (L >= l.max) return false;
    const c = legacyCost(l, L);
    if (!(S.fame >= c)) return false;
    S.fame -= c; S.legacy[id] = L + 1;
    R.dirty = true; recalc();
    emit('hall', id, L + 1, c);
    emit('buy', 'legacy', id);
    return true;
  }
  G.buyHall = buyLegacy;
  G.buyLegacy = buyLegacy;

  // ---------- 4.0: the meta's own reads (DESIGN §4) ----------
  // the permanent block's power against the budget (recalc's D.meta): { dmg, boss, hp (what it gives now), raw {dmg, boss,
  // hp} (what it would give uncapped), cap {dmg, boss, hp}, capped (the budget holds it back) }
  G.metaPower = function () {
    if (R.dirty || !D.meta) recalc();
    const m = D.meta || { dmg: 1, boss: 1, hp: 1, raw: { dmg: 1, boss: 1, hp: 1 }, k: 1, kb: 1, kh: 1 };
    return { dmg: m.dmg, boss: m.boss, hp: m.hp, raw: Object.assign({}, m.raw), cap: { dmg: TUNE.metaDmg, boss: TUNE.metaBoss, hp: TUNE.metaHp },
      capped: Math.min(m.k, m.kb, m.kh) < 0.999, k: { dmg: m.k, boss: m.kb, hp: m.kh }, pets: D.petPow ? D.petPow.dmg : 1 };
  };
  // the Codex (DESIGN §4.7; S.codex {q: {n copies, rank, relic}}; js/run.js G.codexAdd records a run's uniques and relics at
  // its end): a rank is the copies collected, up to the cap (2; the Museum II 3, IV 4; relics 2)
  G.codexCap = () => D.codexCap || 2;
  const codexCapOf = c => (c && c.relic ? 2 : G.codexCap());
  // re-rank every entry against today's cap (a Museum level built after the copies came in; an older save)
  G.codexSync = function () {
    const S = G.S; let n = 0;
    for (const q in S.codex || {}) { const c = S.codex[q]; if (!c || !(c.n > 0)) continue; const rk = Math.min(codexCapOf(c), c.n | 0); if (rk !== (c.rank | 0)) { c.rank = rk; n++; } }
    return n;
  };
  G.on('build', id => { if (id === 'museum') { recalc(); G.codexSync(); } });
  // G.codexInfo(q) -> { q, name, relic, n, rank, cap, k (its fixed affixes' factor: +12% a rank past the first), theme (the
  // perk), themeRanks (2, +1 at rank 2, +1 at rank 4), rule, kept (in the keepsake loadout) } | null when not collected
  G.codexInfo = function (q) {
    const S = G.S, c = S.codex && S.codex[q], U = G.UNIQUES && G.UNIQUES[q];
    if (!c || !U) return null;
    const rk = c.rank | 0, th = G.UQ_THEME && G.UQ_THEME[q];
    return { q, name: U.name, relic: !!(c.relic || U.relic), n: c.n | 0, rank: rk, cap: codexCapOf(c), k: G.codexAffixK ? G.codexAffixK(rk) : 1,
      theme: th || null, themeRanks: th ? 2 + (rk >= 2 ? 1 : 0) + (rk >= 4 ? 1 : 0) : 0, rule: U.fx || '', kept: ((S.lastSetup && S.lastSetup.keeps) || []).includes(q) };
  };
  // the keepsake options (the Run Setup's): every Codex unique and relic, the kept ones first, then by rank
  G.keepsakes = function () {
    const S = G.S;
    return Object.keys(S.codex || {}).map(G.codexInfo).filter(Boolean).sort((a, b) => (b.kept - a.kept) || (b.rank - a.rank) || (a.name < b.name ? -1 : 1));
  };
  // set the keepsake loadout for the next Siege (S.lastSetup.keeps; js/run.js reads it at runStart): Codex ids, up to
  // G.keepSlots() (Museum I, the Hall's Heirloom Shelf). Returns the loadout kept
  G.keepSet = function (qs) {
    const S = G.S, slots = G.keepSlots ? G.keepSlots() : 0;
    const out = []; for (const q of Array.isArray(qs) ? qs : []) if (S.codex && S.codex[q] && G.UNIQUES[q] && !out.includes(q) && out.length < slots) out.push(q);
    S.lastSetup = Object.assign({ btn: 'classic', cls: (S.hero && S.hero.cls) || null, heat: 0, keeps: [], first: null }, S.lastSetup || {}, { keeps: out });
    emit('keepsakes', out);
    return out;
  };
  // the Alchemist's starting potions (DESIGN §4.5: 1 random at I, 2 chosen at III, 3 chosen at V): G.alchPick(ids) chooses
  // them for the next Sieges (from Alchemist III; S.alchPick); kinds never repeat (each a different brew). At 'runSetup' the
  // run's starters are dealt again by these rules and recorded in S.run.pots0 (recalc counts them in the permanent block)
  G.alchPick = function (ids) {
    const S = G.S, n = D.startPots | 0;
    const out = []; for (const id of Array.isArray(ids) ? ids : []) if (G.POTIONS.some(p => p.id === id) && !out.includes(id) && out.length < n) out.push(id);
    S.alchPick = out;
    return out;
  };
  // (G.rng, not the run's offer stream G.runRng: the Daily's offers stay the same for players with different Alchemists).
  // js/run.js has dealt D.startPots random ones (each a 'potion' event): kept as they are unless the player chose (III+) or
  // a kind came twice; then dealt again, and 'startPots'(ids) says what the run starts with
  G.on('runSetup', r => {
    const S = G.S, n = D.startPots | 0;
    if (!S.pots) return;
    const have = []; for (const k in S.pots) for (let i = 0; i < (S.pots[k] | 0); i++) have.push(k);
    const pick = D.startPotsPick && Array.isArray(S.alchPick) ? S.alchPick.filter(id => id in S.pots) : [];
    const ids = [];
    for (const id of pick) if (ids.length < n && !ids.includes(id)) ids.push(id);
    for (const id of have) if (ids.length < n && !ids.includes(id)) ids.push(id);
    while (ids.length < n) { const left = G.POTIONS.map(p => p.id).filter(id => !ids.includes(id)); if (!left.length) break; ids.push(left[Math.floor(G.rng() * left.length)]); }
    const same = have.length === ids.length && have.slice().sort().join() === ids.slice().sort().join();
    if (!same) {
      for (const k in S.pots) S.pots[k] = 0;
      for (const id of ids) S.pots[id] = (S.pots[id] | 0) + 1;
      R.dirty = true;
      emit('startPots', ids.slice());
    }
    r.pots0 = {}; for (const id of ids) r.pots0[id] = (r.pots0[id] | 0) + 1;
  });
  // the Barracks (DESIGN §4.5): Embers while away, TUNE.barracksRate of the best run's payout (S.rec.bestPay) an hour, up to
  // D.offHours (4/6/8/10/12 h by its level). G.barracksInfo() -> { lvl, perHour, capH, best, maxPay }
  G.barracksInfo = function () {
    const best = (G.S.rec && G.S.rec.bestPay) || 0, capH = D.offHours | 0, perHour = capH > 0 ? best * TUNE.barracksRate : 0;
    return { lvl: G.bldLvl('barracks'), perHour, capH, best, maxPay: Math.floor(perHour * capH) };
  };

  // ---------- Pets / gacha ----------
  function pullOne() {
    const S = G.S;
    S.pity.l++; S.pity.d++; S.pulls++;
    let tier = weighted(G.PET_TIERS.map(t => t.rate));
    if (S.pity.d >= 120) tier = 3;
    else if (S.pity.l >= 25 && tier < 2) tier = 2;
    if (tier >= 2) S.pity.l = 0;
    if (tier === 3) S.pity.d = 0;
    const pet = pick(G.PETS.filter(p => p.tier === tier));
    const golden = chance(D.goldenChance);
    let st = S.pets[pet.id];
    const isNew = !st;
    const newGold = golden && (!st || !st.gold);
    if (!st) st = S.pets[pet.id] = { lvl: 1, n: 1, gold: golden };
    else { st.n++; st.lvl = Math.min(G.PET_MAX_LEVEL, st.lvl + 1); if (golden) st.gold = true; }
    return { pet, golden, isNew, newGold, lvl: st.lvl };
  }
  function pull(n) {
    const S = G.S;
    const cost = n >= 10 ? 9 : n;
    if (S.eggs < cost) return null;
    S.eggs -= cost;
    const res = [];
    for (let i = 0; i < n; i++) res.push(pullOne());
    // Auto-equip into free slots
    for (const r of res) {
      if (S.active.length < D.petSlots && !S.active.includes(r.pet.id)) S.active.push(r.pet.id);
    }
    R.dirty = true; recalc();
    emit('pull', res);
    return res;
  }
  G.pull = pull;
  function togglePet(id) {
    const S = G.S;
    if (!S.pets[id]) return;
    const i = S.active.indexOf(id);
    if (i >= 0) S.active.splice(i, 1);
    else if (S.active.length < D.petSlots) S.active.push(id);
    else { S.active.shift(); S.active.push(id); }
    R.dirty = true; recalc();
    emit('pets');
  }
  G.togglePet = togglePet;

  // ---------- Quests ----------
  function progLevel() {
    const S = G.S;
    return S.maxDepth + Math.log10(S.goldRun + 10);
  }
  const QUEST_KINDS = ['clicks', 'chests', 'rarity', 'gold', 'boss', 'crit', 'combo', 'mod', 'wisp', 'kills'];
  function makeQuest(exclude) {
    const S = G.S;
    const lv = progLevel();
    let kinds = QUEST_KINDS.filter(k => !exclude.includes(k));
    if (!S.st.bossKills && S.depth === 0) kinds = kinds.filter(k => k !== 'boss');
    if (!Object.keys(D.mods).length) kinds = kinds.filter(k => k !== 'mod');
    if (S.st.wisps < 1) kinds = kinds.filter(k => k !== 'wisp' || S.st.playTime > 240);
    const k = pick(kinds);
    const q = { k, p: 0 };
    switch (k) {
      case 'clicks': q.n = Math.round((200 + lv * 40) / 10) * 10; break;
      case 'chests': q.n = Math.round(25 + lv * 4); break;
      case 'rarity': q.r = Math.min(5, 1 + Math.floor(lv / 7)); q.n = 3; break;
      case 'gold': q.n = Math.max(200, D.incomeRef * 300); break;
      case 'boss': q.n = G.randInt(1, 3); break;
      case 'crit': q.n = Math.round((30 + lv * 5) * Math.max(0.5, D.crit / 0.05)); break;
      case 'combo': q.n = Math.min(D.comboCap, Math.round(45 + lv * 8)); break;
      case 'mod': q.n = 3; break;
      case 'wisp': q.n = 1; break;
      case 'kills': q.n = Math.round((40 + lv * 6) * 30 / 100) * 100; break;
    }
    const roll = G.rng();
    // (4.0: the Quest Board's run deeds pay eggs, Embers (essence is retired) or the run's gold (20 s of income, at claim))
    if (roll < 0.15) { q.rw = 'eggs'; q.rn = 1 + (lv > 30 ? 1 : 0); }
    else if (roll < 0.5) { q.rw = 'embers'; q.rn = Math.round(6 + lv); }
    else { q.rw = 'gold'; q.rn = 20; } // seconds of income, paid at claim time
    return q;
  }
  // 4.0: the Quest Board (DESIGN §4.5): a board of D.deedBoard run deeds (3, 4 at II, 5 at IV); from III the first one
  // dealt each day is the day's deed and pays x2 (q.daily); at V one a week is the weekly deed: five times the work for 5
  // Gems (q.weekly)
  const weekKey = () => { const k = G.utcDayKey ? G.utcDayKey() : G.todayKey(); const t = Date.parse(k + 'T00:00:00Z'); return isFinite(t) ? 'w' + Math.floor((t / 864e5 + 3) / 7) : k; };
  function fillQuests() {
    const S = G.S, n = Math.max(3, D.deedBoard | 0);
    if (S.quests.length > n) S.quests.length = n;
    while (S.quests.length < n) {
      const q = makeQuest(S.quests.map(x => x.k));
      const day = G.todayKey();
      if (D.deedWeekly && S.questWeek !== weekKey() && q.k !== 'wisp' && q.k !== 'rarity') { S.questWeek = weekKey(); q.weekly = 1; q.n = Math.round(q.n * 5); q.rw = 'gems'; q.rn = 5; }
      else if (D.deedDaily && S.questDay !== day) { S.questDay = day; q.daily = 1; }
      S.quests.push(q);
    }
  }
  const QUEST_COOLDOWN = 150;
  G.fillQuests = fillQuests;
  function questProgress(kind, v, isMax) {
    const qs = G.S.quests;
    for (let i = 0; i < qs.length; i++) {
      const q = qs[i];
      if (q.done || q.wait) continue;
      if (kind === 'rarity') { if (q.k === 'rarity' && v >= q.r) q.p++; }
      else if (q.k === kind) { if (isMax) q.p = Math.max(q.p, v); else q.p += v; }
      if (q.p >= q.n) { q.p = q.n; q.done = true; emit('questDone', q); }
    }
  }
  G.questProgress = questProgress;
  function questReward(q) {
    const k = q.daily ? D.deedDaily || 2 : 1;
    if (q.rw === 'gold') return D.incomeRef * q.rn * D.questMult * k;
    if (q.rw === 'embers') return Math.round(q.rn * D.questMult * k);
    if (q.rw === 'ess') return q.rn * D.questMult * D.essMult * k;
    return q.rn * k;
  }
  G.questReward = questReward;
  function claimQuest(i) {
    const S = G.S, q = S.quests[i];
    if (!q || !q.done) return false;
    const v = questReward(q);
    if (q.rw === 'gold') addGold(v, 'quest');
    else if (q.rw === 'embers') { if (G.addEmbers) G.addEmbers(v, 'quest'); else S.embers = (S.embers || 0) + v; }
    else if (q.rw === 'gems') addGems(v, 'deed');
    else if (q.rw === 'ess') addEssence(v, 'quest');
    else addEggs(v);
    S.questsDone++;
    S.quests[i] = { wait: QUEST_COOLDOWN, k: 'wait' };
    emit('questClaim', q, v);
    return true;
  }
  G.claimQuest = claimQuest;
  function rerollQuest(i) {
    const S = G.S;
    if (Date.now() < S.rerollAt || !S.quests[i] || S.quests[i].wait) return false;
    S.quests[i] = makeQuest(S.quests.map(x => x.k));
    S.rerollAt = Date.now() + 5 * 60 * 1000;
    emit('quests');
    return true;
  }
  G.rerollQuest = rerollQuest;

  // ---------- Daily ----------
  function dailyAvailable() { return G.S.daily.last !== G.todayKey(); }
  G.dailyAvailable = dailyAvailable;
  function dailyReward(day) {
    const r = G.DAILY[day % 7];
    // (4.0: Embers, the meta's; data.js G.DAILY)
    if (r.kind === 'embers') return { kind: 'embers', v: r.n };
    if (r.kind === 'gold') return { kind: 'gold', v: Math.max(500, D.incomeRef * 60 * r.mins) };
    if (r.kind === 'eggs') return { kind: 'eggs', v: r.n };
    if (r.kind === 'ess') return { kind: 'ess', v: r.n };
    return { kind: 'chest', v: 1, tier: r.tier };
  }
  G.dailyReward = dailyReward;
  function claimDaily() {
    const S = G.S;
    if (!dailyAvailable()) return null;
    // a missed day pauses the streak instead of wiping it
    S.daily.streak = S.daily.last ? S.daily.streak + 1 : 0;
    S.daily.last = G.todayKey();
    const r = dailyReward(S.daily.streak);
    if (r.kind === 'embers') { if (G.addEmbers) G.addEmbers(r.v, 'daily'); else S.embers = (S.embers || 0) + r.v; }
    else if (r.kind === 'gold') addGold(r.v);
    else if (r.kind === 'eggs') addEggs(r.v);
    else if (r.kind === 'ess') addEssence(r.v);
    else openChest(makeChest(r.tier, 'ghost'), 'daily');
    emit('daily', r);
    return r;
  }
  G.claimDaily = claimDaily;

  // ---------- The end of a run (4.0: the Siege, js/run.js) ----------
  // The 3.x ascension (voluntary, for fame from depth 15) and its checkpoint are gone: a run ends when the Button falls,
  // when the party extracts at a camp, when the Mad Button dies, or when it's abandoned. G.runEnd (js/run.js) pays the
  // Fame, burns everything carried into Embers and starts over from nothing. What stays here: the shims the 3.x UI calls.
  // the Fame this run has earned so far: what an end now would pay (a fall never costs Fame)
  G.fameGain = () => (G.runFame ? G.runFame() : 0);
  // (no checkpoint any more: every run starts at depth 0)
  G.checkpoint = () => 0;
  // the 3.x Ascend button: inside a Siege, that is ABANDON (paid as a fall). Returns the Fame paid, false if no run
  function ascend(death) {
    if (!G.runEnd || !inSiege()) return false;
    const sum = G.runEnd(death ? 'fall' : 'abandon');
    return sum ? sum.fame.total : false;
  }
  // 3.6: the fall waits on the player: continue right here, or end the run. 4.0: one Continue a run (TUNE.contCost Gems,
  // the very first one free; none in the Daily Siege or from Heat 5), and it marks the run assisted (no Daily rank, no
  // Heat unlock, no sticker). It mends the Button, lifts everyone and leaves 1 pip. Giving up ends the run as a FALL.
  // (with no UI to ask, as in the Node playtests, the run ends at once: bots never continue)
  const runSecs = S => Math.max(0, S.st.playTime - (S.rec && S.rec.runPlay != null ? S.rec.runPlay
    : S.st.playTime - Math.min(S.st.playTime, (Date.now() - ((S.rec && S.rec.runStart) || Date.now())) / 1000)));
  G.contCost = () => { const S = G.S; return S.seen && S.seen.cont ? TUNE.contCost : 0; };
  G.canContinue = () => {
    const S = G.S, r = S.run;
    if (!S.fallen) return false;
    if (!r || !r.on) return (S.runConts || 0) < TUNE.contMax;
    return (r.conts | 0) < TUNE.contMax && !r.day && !torment().noCont;
  };
  G.runOver = function (at) {
    const S = G.S, r = S.run || {};
    const sum = { depth: S.maxDepth, from: 0, best: S.bestDepth, secs: runSecs(S), gold: S.goldRun, lvl: S.hero.lvl,
      fame: G.runFame ? G.runFame() : 0, total: S.fame, next: 0, at: at || { depth: S.depth, meter: 0 }, cause: r.cause || null, heat: r.heat | 0 };
    S.fallen = sum;
    emit('runOver', sum);
    if (!G.fallAsk) G.runGiveUp();
    return sum;
  };
  // back on your feet where you fell: the zone, the boss bar, the boss if one was up
  G.runContinue = function (how) {
    const S = G.S, f = S.fallen;
    if (!f || !G.canContinue()) return false;
    if (how !== 'ad') {
      const c = G.contCost();
      if ((S.gems || 0) < c) return false;
      S.gems -= c;
      if (!S.seen.cont) S.seen.cont = 1;
    }
    S.fallen = null; S.runConts = (S.runConts || 0) + 1;
    if (S.run && S.run.on) { S.run.conts = (S.run.conts | 0) + 1; S.run.assisted = 1; S.run.pips = Math.max(S.run.pips | 0, 1); }
    S.depth = Math.max(S.depth, f.at.depth || 0);
    S.bossMeter = Math.max(S.bossMeter || 0, f.at.meter || 0);
    R.bossReady = false; R.bossIn = null; R.bossHold = 6; R.stun = 1.5; R.btnDown = 0;
    S.st.conts = (S.st.conts || 0) + 1;
    R.dirty = true; recalc();
    if (S.hero) S.hero.hp = D.heroHp;
    if (G.mendParty) G.mendParty(1);
    emit('runContinue', how, f);
    return true;
  };
  // the run ends: a FALL (G.runEnd pays the Fame and the Embers, then a new run from nothing)
  G.runGiveUp = function () {
    const S = G.S, f = S.fallen;
    if (!f) return 0;
    S.fallen = null;
    const sum = G.runEnd ? G.runEnd('fall') : null;
    const g = sum ? sum.fame.total : 0;
    f.fame = g; f.total = S.fame; f.deaths = S.st.deaths; f.next = 0; f.embers = sum ? sum.embers.total : 0; f.sum = sum;
    emit('runEnd', f);
    return g;
  };
  // Gems come from play too (the store adds more where payments are on)
  function addGems(n, why) {
    const S = G.S;
    if (!(n > 0)) return;
    S.gems = (S.gems || 0) + n;
    emit('gems', n, why);
  }
  G.addGems = addGems;
  G.on('achievement', () => addGems(TUNE.gemAch, 'ach'));
  G.on('landStar', () => addGems(TUNE.gemStar, 'star'));
  G.on('relicDrop', () => addGems(TUNE.gemRelic, 'relic'));
  G.on('daily', () => addGems(TUNE.gemDaily * ((G.S.daily.streak || 0) % 7 === 6 ? 3 : 1), 'daily'));
  G.on('bossWin', (rew, b) => {
    const S = G.S;
    if (!b || !b.lord || R.rift) return;
    // (4.0: once for each land's lord, whichever slot of a Siege it stood in)
    const k = (G.REALMS[realmIndex(b.d)] || {}).id || b.d;
    if ((S.gemLords || (S.gemLords = {}))[k]) return;
    S.gemLords[k] = 1;
    addGems(TUNE.gemLord, 'lord');
  });
  G.ascend = ascend;

  // ---------- Offline ----------
  function applyOffline(sec) {
    if (sec < 60 || G.S.fallen) return null;
    R.bossHold = 25; // back from a break: a moment to look round before a boss comes on its own
    if (G.worldAway) G.worldAway();
    recalc();
    const t = Math.min(sec, D.offCap);
    // 4.0: time away never advances a Siege: no gold, chests, XP or levels (the run waits where it was) and nothing in the
    // run's currencies. The Barracks pays Embers for it (the meta's 'offline' hooks: f(sec, out) adds out.embers)
    const out = { sec, t, gold: 0, chests: 0, items: 0, ess: 0, warden: null, rested: false, siege: inSiege(), embers: 0 };
    // the Barracks (4.0, DESIGN §4.5): Embers while away, 3% an hour of the best run's payout, up to its level's hours
    if (D.offHours > 0 && G.S.rec && G.S.rec.bestPay > 0) out.embers += Math.floor(G.S.rec.bestPay * TUNE.barracksRate * Math.min(sec, D.offHours * 3600) / 3600);
    if (G.HOOKS && G.HOOKS.offline) for (const f of G.HOOKS.offline) f(sec, out);
    if (out.embers > 0 && G.addEmbers) G.addEmbers(out.embers, 'offline');
    emit('away', out);
    // (the 3.x welcome-back card only when there is something to show)
    return out.embers > 0 ? out : null;
  }
  G.applyOffline = applyOffline;

  // ---------- Main tick ----------
  function tick(dt) {
    const S = G.S;
    if (R.dirty) recalc();
    S.st.playTime += dt;
    // (3.6: a fallen Button waits on the player's choice: nothing runs)
    if (S.fallen) return;
    // 4.0: the Siege's hold. Outside a run (setup, the summary) and while a post-boss beat is on (the loot moment, a card,
    // a relic, camp, doors: S.run.phase) the field holds still and only the clock runs. Not uiBusy (which drops the field
    // to 8 frames a second) and not R.cine (which relic_fx re-arms every frame): the stage keeps drawing in full
    if (G.runHeld && G.runHeld()) { if (G.runHoldTick) G.runHoldTick(dt); return; }
    // in town the field holds still: only the Garrison's income and the clock run (4.0: inside a Siege, not even the
    // Garrison: a pause can't farm gold)
    if (R.town) { if (!inSiege()) addGold(D.gps * dt, 'gps'); return; }
    // (3.0: and while a window is open over it: nothing runs out behind a card you're reading)
    if (G.uiBusy && G.uiBusy()) { if (!inSiege()) addGold(D.gps * dt, 'gps'); return; }
    // the very first moment waits for the player's first press
    if (G.tutFreeze && G.tutFreeze()) return;
    // 3.0: a cinematic (a relic dropping) holds the whole game still while it plays
    if (R.cine > 0) { R.cine = Math.max(0, R.cine - dt); return; }
    if (R.march && (R.march.t -= dt) <= 0) { R.march = null; emit('marchEnd'); }

    // Buffs
    if (S.buffs.length) {
      for (const b of S.buffs) b.t -= dt;
      const before = S.buffs.length;
      S.buffs = S.buffs.filter(b => b.t > 0);
      if (S.buffs.length !== before) { R.dirty = true; recalc(); emit('buffEnd'); }
    }
    // Combo decay
    if (R.combo > 0) {
      R.comboT -= dt;
      if (R.comboT <= 0) R.combo = Math.max(0, R.combo - dt * Math.max(20, R.combo * 1.5));
    }
    // Idle income
    addGold(D.gps * dt, 'gps');
    // Auto clicks
    R.autoAcc += (D.autoCps + D.petCps) * dt;
    if (R.autoAcc >= 1) {
      const n = Math.floor(R.autoAcc);
      R.autoAcc -= n;
      autoClicks(n, dt);
    }
    // Scouts
    if (D.scout) S.chestMeter += D.scout * D.chestNeed * dt;
    spawnFromMeter();
    // 4.0: the run's own clocks (par, the Reaper, Mend's land refill...): js/run.js
    if (G.runTick) G.runTick(dt);
    // 4.0: the run's Button (js/blessings.js: the Clockwork's own hold, its evolution clocks)
    if (G.btnTick) G.btnTick(dt);
    // 4.0: Auto-invest, now and then (the Shop tab's toggle)
    if ((R.aiT = (R.aiT == null ? TUNE.autoEvery : R.aiT) - dt) <= 0) { R.aiT = TUNE.autoEvery; if (inSiege() && S.set.autoInvest !== 0) G.autoInvest(); }
    if (G.heroTick) G.heroTick(dt);
    if (G.worldTick) G.worldTick(dt);
    if (G.eventsTick) G.eventsTick(dt);
    if (G.journeyTick) G.journeyTick(dt);
    // Boss
    if (R.rift) { /* the campaign waits while a Rift is open */ }
    else if (R.boss) {
      const b = R.boss;
      if (R.boss) {
        b.t -= dt;
        if (b.inv > 0) { b.inv -= dt; b.t += dt; } // the clock holds while it changes
        // 2.3: out of time, the boss doesn't leave: it ENRAGES. A last stretch to finish it, while it hits
        // twice as often and harder by the second; then it leaves with whatever wounds it has
        if (b.t <= 0 && !b.enr) { b.t = 0; b.enr = b.lord ? TUNE.enrageLord : TUNE.enrage; b.enrT = b.enr; b.moveT = Math.min(b.moveT || 0, 1); emit('bossEnrage', b); }
        if (b.sh > 0) b.sh -= dt;
        if (G.bossHas(b, 'regen') && !(b.inv > 0)) b.hp = Math.min(b.max, b.hp + b.max * TUNE.bossRegen * dt);
        if (b.enr > 0 && !(b.inv > 0) && (b.enr -= dt) <= 0) bossFail();
        else bossMoves(b, dt);
      }
    } else if (R.lastStand) {
      // 4.0: the finale's Last Stand: no boss until its clock runs out (js/run.js)
    } else if (S.bossMeter >= D.bossNeed && G.lastStandDue && G.lastStandDue()) {
      G.lastStandStart();
    } else if (S.bossMeter >= D.bossNeed) {
      if (!R.bossReady) { R.bossReady = true; R.bossIn = TUNE.bossCall; emit('bossReady'); }
      // Bosses come on their own: after a short countdown when the Warden can take it, or after a
      // longer wait when it can't yet (Rally builds with each try; The Hunt shortens the wait).
      // ⚔ calls it right away.
      // (an invasion is fought out first)
      // (an invasion or a sudden event is fought out first; the Jackpot Frenzy carries on through a boss)
      if (S.set.autoBoss && !R.inv && !(R.ev && R.ev.k !== 'jackpot') && !(G.tutHold && G.tutHold())) {
        if (R.bossHold > 0) R.bossHold -= dt;
        else R.bossIn = (R.bossIn == null ? TUNE.bossCall : R.bossIn) - dt;
        // (lost here twice: the party farms this ground half a minute before it tries again)
        // (3.4: shorter waits: Rally grows faster with each try, so a wall gives way sooner)
        const wait = S.scar && S.scar.d === S.depth && S.scar.n >= 2 ? 30 : bossOdds() >= 0.6 ? 0 : D.autoBoss ? 12 : 25;
        if (R.bossIn <= -wait) startBoss();
      }
    }
    // the Looters
    lootersTick(dt);
    powersTick(dt);
    // how fast you've been clicking lately (a 10-second average)
    R.cps = (R.cps || 0) + ((R.clickN || 0) / Math.max(dt, 1e-3) - (R.cps || 0)) * Math.min(1, dt / 10); R.clickN = 0;
    // 4.0: the party's damage as it has been in the field lately (a bossFloorAvg-second average, buffs and stacks in it as
    // often as they were up): what a Siege boss's least fight length is measured by (bossMax)
    if (!R.boss && !R.march && TUNE.bossFloorAvg > 0) R.dpsAvg = R.dpsAvg == null ? D.heroDps || 0 : R.dpsAvg + ((D.heroDps || 0) - R.dpsAvg) * Math.min(1, dt / TUNE.bossFloorAvg);
    if (D.petOpen) {
      R.petOpenAcc += D.petOpen * dt;
      while (R.petOpenAcc >= 1) { R.petOpenAcc -= 1; if (!golemAct()) { R.petOpenAcc = 0; break; } }
    }
    // Chest timers
    for (let i = S.chests.length - 1; i >= 0; i--) {
      const c = S.chests[i];
      c.age += dt;
      if (c.mod === 'blazing') {
        c.life -= dt;
        if (c.life <= 0) {
          S.chests.splice(i, 1);
          const v = chestValue(c.tier) * 0.2; addGold(v);
          emit('burn', c, v);
        }
      } else if (c.mod === 'mimic') {
        if (c.awake) { c.life -= dt; if (c.life <= 0) { S.chests.splice(i, 1); emit('mimicFlee', c); } }
        else if (c.age > TUNE.mimicIdle) { S.chests.splice(i, 1); emit('mimicFlee', c); }
      }
    }
    // Wisps
    if (R.wisp) { R.wisp.t -= dt; if (R.wisp.t <= 0) { R.wisp = null; emit('wispGone'); } }
    else if (S.st.chests >= 8) {
      R.wispT -= dt * D.wispRate;
      // (3.6: a wisp that is due waits for a quiet field: no boss fight, no march, room in the pacing director)
      if (R.wispT <= 0 && !R.boss && !R.march && (!G.director || G.director.can('small', 0))) { R.wispT = rand(TUNE.wispMin, TUNE.wispMax); spawnWisp(); G.director.mark('small'); }
      else if (R.wispT < 0) R.wispT = 0;
    }
    // Quest refill timers
    for (let i = 0; i < S.quests.length; i++) {
      const q = S.quests[i];
      if (q.wait) { q.wait -= dt; if (q.wait <= 0) { S.quests[i] = makeQuest(S.quests.map(x => x.k)); emit('quests'); } }
    }
    // Periodic
    R.recalcT -= dt;
    if (R.recalcT <= 0) { R.recalcT = 0.5; recalc(); }
    R.achT -= dt;
    if (R.achT <= 0) { R.achT = 1; G.checkAchievements && G.checkAchievements(); }
  }
  G.tick = tick;

  // ---------- Save / load ----------
  function serialize() {
    const S = G.S;
    S.lastSave = Date.now();
    return JSON.stringify(S);
  }
  G.serialize = serialize;
  function deserialize(str) {
    const data = typeof str === 'string' ? JSON.parse(str) : str;
    if (!data || typeof data !== 'object' || !('gold' in data)) throw new Error('bad save');
    if (G.oldSeason(data)) {
      const s = newState();
      if (data.set) s.set = Object.assign(s.set, data.set);
      if (data.profile && data.profile.id) s.profile = { id: data.profile.id, name: data.profile.name || '' };
      // 4.0 (season 3): what an earlier season earned carries on, converted (js/run.js G.foundersGift: pure, written into
      // the new state before it replaces the old data): Gems, pets, achievements and the collection kept; worn gear, the
      // bag and the town burned into Embers; fame into new Fame; uniques and relics into the Codex
      if (G.foundersGift) { try { G.foundersGift(data, s); } catch (e) { if (typeof console !== 'undefined') console.error('foundersGift', e); } }
      return deserialize(s);
    }
    const fresh = newState();
    const S = Object.assign(fresh, data);
    // Merge nested objects so new fields get defaults.
    S.st = Object.assign(newState().st, data.st || {});
    S.set = Object.assign(newState().set, data.set || {});
    // 2.5: holding the Button down is how the game is played now: switch it on once for older saves
    if (!(data.seen && data.seen.hold25)) { S.set.hold = 1; S.seen = Object.assign({}, data.seen || {}, { hold25: 1 }); }
    S.pots = Object.assign(potZero(), data.pots || {});
    S.pity = Object.assign({ l: 0, d: 0 }, data.pity || {});
    S.daily = Object.assign({ last: '', streak: 0 }, data.daily || {});
    S.bounty = Object.assign({ day: '', n: 0, done: false }, data.bounty || {});
    S.rift = Object.assign(newRift(), data.rift || {});
    S.rift.day = Object.assign({ k: '', l: 0 }, S.rift.day || {});
    // 4.0: the Siege's records
    if (!S.run || typeof S.run !== 'object') S.run = newState().run;
    if (!S.heatStk || typeof S.heatStk !== 'object') S.heatStk = {};
    if (!Array.isArray(S.fallen12)) S.fallen12 = [];
    if (!(typeof S.heatWon === 'number')) S.heatWon = -1;
    if (!(S.embers >= 0)) S.embers = 0;
    if (!S.codex || typeof S.codex !== 'object') S.codex = {};
    if (!S.uq || typeof S.uq !== 'object') S.uq = {};
    if (!S.lands || typeof S.lands !== 'object') S.lands = {};
    // saves from before 1.1: past depth 40 the lands changed, so crown times there belong to other lords now
    if (!('lands' in data) && S.rec && S.rec.crowns) for (const k in S.rec.crowns) if (+k >= 40) delete S.rec.crowns[k];
    // saves from before 2.0: depths 65-74 were corrupted lands then, the Moon and the Star Sea now
    if (!('party' in data) && S.rec && S.rec.crowns) for (const k in S.rec.crowns) if (+k >= 65) delete S.rec.crowns[k];
    // 3.4: lands have three zones now, so lords stand at other depths: a crown time on what's no longer a lord goes
    if (S.rec && S.rec.crowns) for (const k in S.rec.crowns) if (!isLord(+k)) delete S.rec.crowns[k];
    // saves from before 2.1: the hall gave one slot a level (up to 16); now it steps 10, 20, 30…
    if (!('jp' in data) && S.upg && S.upg.hall > 0) S.upg.hall = S.upg.hall <= 4 ? 1 : 2;
    // a save from before the jackpot starts its clock now, not at its first minute of play
    S.jp = data.jp ? Object.assign({ n: 0, at: 0 }, data.jp) : { n: 0, at: (S.st && S.st.playTime) || 0 };
    if (!Array.isArray(S.feed)) S.feed = [];
    if (!Array.isArray(S.opened) || S.opened.length !== 7) S.opened = [0, 0, 0, 0, 0, 0, 0];
    S.chests = (S.chests || []).filter(c => c && c.tier >= 0 && c.tier <= 6);
    // 3.6: a run blessing that no longer exists (High Roller) becomes its stand-in
    if (G.blessFix) G.blessFix(S);
    G.S = S;
    if (G.ensureHero) G.ensureHero(S);
    if (R.mobs) R.mobs.length = 0; if (R.shots) R.shots.length = 0;
    R.boss = null; R.bossReady = false; R.combo = 0; R.wisp = null; R.wave = null; R.btnDown = 0;
    if (R.town) { R.town = false; emit('town', false); }
    if (G.worldClear) G.worldClear();
    // saves from before 1.0: the Journey gained 11 steps in between the old ones
    if (!('uq' in data) && G.Journey && G.Journey.fromV0) S.journey = G.Journey.fromV0(S.journey || 0);
    R.dirty = true; recalc();
    if (G.zoneSync) G.zoneSync();
    if (S.hero && S.hero.cls) {
      if (!(data.hero && 'whp' in data.hero)) S.hero.whp = D.wardenHp;
      if (S.hero.hp <= 0 && G.TUNE.btnDown) R.btnDown = G.TUNE.btnDown;
    }
    // 4.0: the meta's own fix-ups on a loaded save (js/ach.js: unlocks earned by Deeds already done, a founder's Deeds;
    // the Codex ranks against today's Museum)
    if (G.metaLoad) { try { G.metaLoad(S); } catch (e) { if (typeof console !== 'undefined') console.error('metaLoad', e); } }
    // 4.0: a Siege carries on from the start of the zone it was in (js/run.js), a beat (a card, the loot moment...) re-opens
    if (G.runResume) G.runResume();
    return S;
  }
  G.deserialize = deserialize;
})(globalThis.G = globalThis.G || {});
