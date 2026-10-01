// BTTN — game logic. No DOM access here: this file also runs in the Node
// balance simulator (tools/sim.js). It changes G.S and emits events.
(function (G) {
  'use strict';
  const { clamp, chance, weighted, pick, rand, emit } = G;

  const TUNE = G.TUNE = {
    chestNeed: 10,          // clicks per chest before upgrades
    autoChestFactor: 0.1,   // auto clicks give less chest progress than real ones
    depthGold: 1.08,        // gold multiplier per depth
    bossBase: 400,          // boss hp at depth 0
    bossGrowth: 2.5,        // boss hp growth per depth
    lordHp: 3,
    bossCall: 3,            // seconds of warning before a ready boss arrives on its own
    heroBossPct: 0.35,      // share of hero income dealt to bosses as dps
    comboTime: 1.25,
    maxManualCps: 25,
    wispMin: 50, wispMax: 120, wispLife: 13,
    mimicClicks: 15, mimicLife: 8, mimicIdle: 30,
    blazeLife: 6,
    // 2.2: every boss fight lasts at least this long however strong the party is (s of its damage)
    bossMin: 12, bossMinLord: 30, bossMinOld: 0.25, bossClickK: 0.5,
    smallChestK: 0.1,       // the little chests the Horde drops are worth a tenth of a real one
    smallItem: 0.05,        // and hold an item one time in twenty
    overflowK: 0.5,         // a full field: the lowest chest bursts and half of it is lost
  };

  // ---------- State ----------
  function potZero() { const o = {}; G.POTIONS.forEach(p => o[p.id] = 0); return o; }
  // Rift records: best level ever (and its time), the highest level open, today's best
  function newRift() { return { best: 0, bestT: 0, open: 1, runs: 0, day: { k: '', l: 0 } }; }
  // The season: a save from an earlier one starts the game over (only its settings and name carry on).
  // 2.3 wiped everything once, since all progress so far was made while the game was far too easy.
  const WIPE = G.WIPE = 1;
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
      set: { sound: 1, music: 1, vol: 0.6, hold: 0, shake: 1, autoBoss: 1, filter: 1 },
      seen: {}, tut: 0,
      journey: 0, scar: null, bounty: { day: '', n: 0, done: false },
      uq: {}, feed: [], rift: newRift(), lands: {}, party: [],
      // the jackpot: how many, and the play time of the last one (its odds climb with every hour since)
      jp: { n: 0, at: 0 },
    };
  }
  G.newState = () => { const s = newState(); if (G.ensureHero) G.ensureHero(s); return s; };
  G.S = newState();

  // Runtime-only state (not saved)
  const R = G.R = {
    combo: 0, comboT: 0, autoAcc: 0, golemAcc: 0, petOpenAcc: 0,
    wisp: null, wispT: 40, manualTimes: [], achT: 0, recalcT: 0, dirty: true,
    boss: null, bossReady: false,
  };

  // ---------- Derived stats ----------
  const D = G.D = {};
  function baseD() {
    return {
      clickAdd: 1, clickMult: 1, clickGpsPct: 0, gpsMult: 1, goldMult: 1, itemMult: 1,
      crit: 0.03, critMult: 3, chestProg: 1, chestNeed: TUNE.chestNeed, slots: 6, autoOpen: 0, looters: 1, luck: 0,
      comboCap: 50, comboPer: 0.005, autoCps: 0, essMult: 1, modChance: 0, mods: {}, merge: false, double: 0,
      bossMult: 1, bossTime: 30, petMult: 1, petSlots: 2, eggMult: 1, wispRate: 1, buffDur: 1,
      offCap: 14400, offEff: 0.5, scout: 0, vet: 0, legion: false, mega: false, autoBoss: false, bossNeed: 25,
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

  function recalc() {
    const S = G.S;
    const d = baseD();
    for (const u of G.UPGRADES) { const L = S.upg[u.id] || 0; if (L) u.fx(L, d); }
    for (const n of G.NODES) { const L = S.nodes[n.id] || 0; if (L) n.fx(L, d); }
    for (const l of G.LEGACY) { const L = S.legacy[l.id] || 0; if (L) l.fx(L, d); }
    if (G.heroEcon) G.heroEcon(d);

    // Collection bonuses
    const sums = {};
    for (const it of G.ITEMS) {
      const s = stars(S.coll[it.id] || 0);
      if (s) sums[it.bonus] = (sums[it.bonus] || 0) + G.BONUS[it.bonus].v * G.RARITIES[it.r].bonusMul * s;
    }
    const sm = k => sums[k] || 0;
    d.clickMult *= 1 + sm('click'); d.gpsMult *= 1 + sm('gps'); d.goldMult *= 1 + sm('gold');
    d.crit += sm('crit'); d.critMult += sm('critd'); d.luck += sm('luck'); d.essMult *= 1 + sm('ess');
    d.itemMult *= 1 + sm('item'); d.bossMult *= 1 + sm('boss'); d.chestProg += sm('chest');
    d.eggMult *= 1 + sm('egg'); d.petMult *= 1 + sm('pet'); d.comboCap += Math.floor(sm('combo'));
    d.collSums = sums;

    // Potions
    const P = S.pots, pp = d.potPow;
    d.clickMult *= 1 + 0.05 * P.att * pp; d.heroMult *= 1 + 0.05 * P.att * pp; d.hpMult *= 1 + 0.08 * P.def * pp;
    d.spdMult *= 1 + 0.05 * P.spd * pp; d.crit += 0.005 * P.dex * pp;
    d.gpsMult *= 1 + 0.05 * P.vit * pp; d.essMult *= 1 + 0.05 * P.wis * pp;
    d.goldMult *= 1 + 0.03 * P.life * pp; d.petMult *= 1 + 0.04 * P.mana * pp;

    // Achievements & fame
    d.achCount = Object.keys(S.ach).length;
    d.goldMult *= 1 + 0.01 * d.achCount;
    d.goldMult *= 1 + 0.01 * S.fameTotal;

    // Heroes
    let total = 0, classes = 0;
    for (const h of G.HEROES) { const n = S.heroes[h.id] || 0; total += n; if (n) classes++; }
    d.heroTotal = total; d.heroClasses = classes;
    if (d.legion) d.goldMult *= 1 + 0.08 * classes;
    if (d.vet) d.gpsMult *= 1 + d.vet * Math.floor(total / 10);

    // Pets (after petMult is final)
    d.petCps = 0;
    const slots = d.petSlots;
    S.active = S.active.filter(id => S.pets[id]).slice(0, slots);
    for (const id of S.active) {
      const pet = G.PET_BY_ID[id], st = S.pets[id];
      const p = petPower(st) * d.petMult;
      if (pet.fx) pet.fx(p, d);
      if (pet.cps) d.petCps += petCps(pet, st) * Math.sqrt(d.petMult);
    }
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

  function manualClick(x, y) {
    const S = G.S;
    const now = performance.now();
    const mt = R.manualTimes;
    while (mt.length && now - mt[0] > 1000) mt.shift();
    if (mt.length >= TUNE.maxManualCps) return null;
    mt.push(now);

    // a broken Button gives nothing: no gold, no lightning, until it mends
    if (R.btnDown > 0) { emit('clickDead'); return null; }
    // (the pace of clicks that land, for the boss's health)
    if (!(R.stun > 0)) R.clickN = (R.clickN || 0) + 1;
    S.clicks++; S.clicksRun++;
    R.combo = Math.min(D.comboCap, R.combo + 1);
    R.comboT = TUNE.comboTime;
    if (R.combo > S.st.maxCombo) S.st.maxCombo = R.combo;
    const crit = critRoll();
    const mega = D.mega && S.clicks % 25 === 0;
    let gain = D.click * (1 + R.combo * D.comboPer);
    if (crit) { gain *= D.critMult; S.st.crits++; questProgress('crit', 1); }
    if (mega) { gain *= 30; S.st.megas++; }
    if (G.evMul) gain *= G.evMul('click');
    addGold(gain, 'click');
    const dmg = R.boss ? D.heroHit * TUNE.clickVolley : 0;
    if (R.boss) tapBoss();
    if (G.heroVolley && !(R.stun > 0)) G.heroVolley(TUNE.clickVolley, 'click');
    S.chestMeter += D.chestProg;
    spawnFromMeter();
    questProgress('clicks', 1);
    questProgress('combo', R.combo, true);
    const ev = { gain, crit, mega, x, y, combo: R.combo, dmg };
    emit('click', ev);
    return ev;
  }
  G.manualClick = manualClick;

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
  function pickItem(r) {
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

  function spawnChest(tier, mod, fromBoss, small) {
    const S = G.S;
    if (tier === undefined || tier === null) tier = rollTier();
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
      spawnChest();
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
      const li = lootItem(pickItem(rollRarity(c.tier, rolls)), source);
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
    if (!S.chests.includes(c)) return;
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
  function realmIndex(d) { return Math.floor(Math.max(0, d) / G.REALM_SIZE) % G.REALMS.length; }
  G.realmIndex = realmIndex;
  G.cycle = d => Math.floor(Math.max(0, d) / SPAN());
  const ROMAN = ['', '', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];
  G.corrupt = (name, d) => { const c = G.cycle(d); return c ? 'Corrupted ' + name.replace(/^The /, '') + (c in ROMAN ? ROMAN[c] : ' ' + c) : name; };
  G.realmName = d => G.corrupt(G.REALMS[realmIndex(d)].name, d);
  function isLord(d) { return d % G.REALM_SIZE === G.REALM_SIZE - 1; }
  G.isLord = isLord;
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
    slam:   { col: '#ff3b3b', name: 'SLAM', wind: 1.4, need: 5 },
    summon: { col: '#b36bff', name: 'SUMMON', wind: 1.6, need: 6 },
    shield: { col: '#4fa8ff', name: 'SHIELD', wind: 3, need: 8 },
    barrage: { col: '#ffb347', name: 'BARRAGE', wind: 1.2, need: 4 },
  };
  // later phases bring the barrage, a volley at the heroes themselves
  const MOVE_ORDER = {
    lord: [['slam', 'summon', 'shield'], ['slam', 'barrage', 'summon', 'shield', 'barrage'], ['barrage', 'slam', 'barrage', 'summon', 'shield']],
    boss: [['slam', 'slam', 'summon'], ['slam', 'barrage', 'summon', 'barrage']],
  };
  function bossMoves(b, dt) {
    if (b.stagger > 0) b.stagger -= dt;
    if (!b.move) {
      if ((b.moveT -= dt) > 0) return;
      const set = MOVE_ORDER[b.lord ? 'lord' : 'boss'], order = set[Math.min(set.length, b.phase || 1) - 1];
      const k = order[(b.moveN = (b.moveN || 0) + 1) % order.length];
      b.move = { k, t: G.BOSS_MOVES[k].wind, T: G.BOSS_MOVES[k].wind, n: 0, need: G.BOSS_MOVES[k].need };
      emit('bossMove', b);
      return;
    }
    if ((b.move.t -= dt) > 0) return;
    // the move lands
    const k = b.move.k;
    b.move = null; b.moveT = (b.lord ? 5 : 7) / (1 + 0.3 * ((b.phase || 1) - 1));
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
  G.powerReady = id => !(R.pw[id] > 0) && !!(G.S.hero && G.S.hero.cls) && !(R.stun > 0) && (id !== 'smite' || smiteTarget());
  G.usePower = function (id) {
    const P = G.POWERS[id];
    if (!P || !G.powerReady(id)) return false;
    R.pw[id] = P.cd;
    const S = G.S;
    if (id === 'smite') {
      const b = R.boss;
      if (b && !b.dead) {
        if (b.move) { const mk = b.move.k; b.move = null; b.moveT = b.lord ? 5 : 7; b.stagger = 3; emit('bossStagger', b, mk); }
        hitBoss((D.heroDps || 1) * (D.bossMult || 1) * 5);
      } else if (G.dealHit) for (const m of R.mobs.slice()) if (!m.dead && m.p > 0.45 && m.kind !== 'guardian') G.dealHit(m, (D.heroHit || 1) * 8, 'smite', false);
    } else if (id === 'ward') {
      R.ward = P.dur;
    } else if (id === 'mend') {
      const h = S.hero;
      if (!(R.btnDown > 0)) h.hp = Math.min(D.heroHp, h.hp + D.heroHp * 0.35);
      if (G.mendParty) G.mendParty(0.4);
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
    if (!b || !b.move) return;
    if (++b.move.n >= b.move.need) {
      const k = b.move.k;
      b.move = null; b.moveT = b.lord ? 5 : 7; b.stagger = 3;
      emit('bossStagger', b, k);
    }
  }
  function startBoss() {
    const S = G.S;
    // an invasion is fought out first
    if (R.boss || R.rift || !R.bossReady || R.inv) return false;
    const d = S.depth;
    const lord = isLord(d);
    const max = bossMax(d);
    // a boss that got away comes back with the wounds it took
    const scar = S.scar && S.scar.d === d ? S.scar.k : 1;
    // every failed try rallies the Warden: +20% damage on a lord (+15% on a boss), up to five tries,
    // and after a long rest the first fight is fought rested (+40%)
    const rally = (S.scar && S.scar.d === d ? (lord ? 0.2 : 0.15) * Math.min(5, S.scar.n || 0) : 0) + (S.rested ? 0.4 : 0);
    const hp = max * scar;
    if (G.heroBossStart) G.heroBossStart();
    R.boss = { d, lord, hp, max, scar, rally, phase: 1, inv: 0, t: D.bossTime + (lord ? 15 : 0), T: D.bossTime + (lord ? 15 : 0), moveT: lord ? 4 : 6, stagger: 0,
      realm: realmIndex(d), sprite: lord ? G.REALMS[realmIndex(d)].lord : G.REALMS[realmIndex(d)].minion };
    // a boss that comes back wounded starts in the phase its health calls for
    R.boss.phase = phaseAt(R.boss);
    if (lord && R.boss.phase === 3) R.boss.rage = 1;
    R.bossReady = false; R.bossIn = null;
    emit('bossStart', R.boss);
    return true;
  }
  G.startBoss = startBoss;
  // How much of this depth's boss the Warden would take down in the time limit, without clicking (1 = all of it)
  // a boss's health: its depth's, but never less than a real fight's worth of the party's damage
  function bossMax(d) {
    const curve = G.bossHp(d) * (G.omen ? G.omen().bossHp : 1);
    // (the party's damage and the Hand's own: clicks at the pace you've been clicking)
    // (at the steady strength: a tome, a shrine or an event running when the boss is called doesn't make it tougher;
    // and the clicks count at half, since nobody keeps up the same pace all fight)
    const clickDps = (R.cps || 0) * TUNE.bossClickK * (D.heroHitBase || D.heroHit || 0) * TUNE.clickVolley * (1 + D.crit * (D.critMult - 1));
    // a full fight only on new ground: a depth already beaten (climbing back after an ascension) goes quicker
    const fresh = d >= (G.S.bestDepth || 0) ? 1 : TUNE.bossMinOld;
    const floor = ((D.heroDpsBase || D.heroDps || 0) + clickDps) * (D.bossMult || 1) * (isLord(d) ? TUNE.bossMinLord : TUNE.bossMin) * fresh;
    return Math.max(curve, floor);
  }
  G.bossMax = bossMax;
  function bossOdds() {
    const S = G.S, d = S.depth, lord = isLord(d);
    const scar = S.scar && S.scar.d === d ? S.scar : null;
    const hp = bossMax(d) * (scar ? scar.k : 1);
    const rally = (scar ? (lord ? 0.2 : 0.15) * Math.min(5, scar.n || 0) : 0) + (S.rested ? 0.4 : 0);
    return (D.heroDps || 0) * (D.bossMult || 1) * (1 + rally) * (D.bossTime + (lord ? 15 : 0)) / Math.max(1e-9, hp);
  }
  G.bossOdds = bossOdds;

  // Phases: a lord changes at 66% and 33% of its health, a boss at 50%. It shrugs off
  // everything for a moment, throws the Horde back, hits the whole party and fights harder.
  function phaseAt(b) { return b.lord ? (b.hp < b.max * 0.33 ? 3 : b.hp < b.max * 0.66 ? 2 : 1) : (b.hp < b.max * 0.5 ? 2 : 1); }
  function hitBoss(dmg) {
    const b = R.boss;
    if (!b || b.dead) return;
    if (b.inv > 0) return;
    // a shield soaks most of it; a staggered boss takes half again
    if (b.move && b.move.k === 'shield') dmg *= 0.3;
    else if (b.stagger > 0) dmg *= 1.5;
    if (b.rally) dmg *= 1 + b.rally;
    b.hp -= dmg;
    if (b.hp <= 0) bossWin();
    else if (phaseAt(b) > b.phase) {
      // one phase at a time: a huge hit stops at the next phase's floor
      const fl = (b.lord ? [0.66, 0.33, 0] : [0.5, 0])[b.phase] || 0;
      if (fl > 0) b.hp = Math.max(b.hp, fl * b.max + 1);
      b.phase++; b.inv = 1.6; b.move = null; b.moveT = 1.5;
      // the last phase of a lord is its rage: twice the adds, harder bites
      if (b.lord && b.phase === 3) { b.rage = 1; emit('bossRage', b); }
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
    const d = b.d;
    const first = S.st.bossKills === 0;
    if (d === 39 && S.rec && !S.rec.madTime) S.rec.madTime = S.st.playTime;
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
    if (S.depth > S.maxDepth) S.maxDepth = S.depth;
    if (S.depth > S.bestDepth) {
      S.bestDepth = S.depth;
      const slot = G.PARTY_AT ? G.PARTY_AT.indexOf(S.bestDepth) : -1;
      if (slot >= 0) emit('slotOpen', slot);
    }
    S.bossMeter = 0;
    R.boss = null;
    R.dirty = true;
    recalc();
    // the loot bursts out of it onto the ground; without js/world.js, chests open as before
    if (G.bossLoot) G.bossLoot(b, tier, count);
    else for (let i = 0; i < count; i++) rew.chests.push(openChest(makeChest(tier, null), 'boss'));
    questProgress('boss', 1);
    emit('bossWin', rew, b);
    if (realmIndex(S.depth) !== realmIndex(d)) emit('realm', realmIndex(S.depth));
  }

  function bossFail() {
    const S = G.S, b = R.boss;
    R.boss = null;
    // it keeps 70% of the damage it took, and never comes back weaker than 25%
    const left = Math.max(0, b.hp / b.max);
    // only a try that actually hurt the boss counts toward Rally
    // and it heals back less after each try, so a wall always gives way to someone who keeps at it
    const n0 = S.scar && S.scar.d === b.d ? S.scar.n || 0 : 0;
    S.scar = { d: b.d, k: Math.max(0.15, left + (1 - left) * 0.3 / (1 + n0)), n: n0 + (left < 0.95 ? 1 : 0) };
    S.rested = 0;
    b.wound = 1 - S.scar.k;
    if (G.heroBossEnd) G.heroBossEnd(false);
    S.bossMeter = Math.floor(D.bossNeed * 0.5);
    emit('bossFail', b);
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
    } else if (e.id === 'rain') {
      for (let i = 0; i < 8; i++) spawnChest();
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

  function nodeCost(nd, L) { return Math.ceil(nd.cost * Math.pow(nd.growth, L)); }
  G.nodeCost = nd => nodeCost(nd, G.S.nodes[nd.id] || 0);
  function nodeAvailable(nd) {
    if (!nd.req.length) return true;
    return nd.req.some(r => (G.S.nodes[r] || 0) > 0);
  }
  G.nodeAvailable = nodeAvailable;
  function buyNode(id) {
    const S = G.S, nd = G.NODE_BY_ID[id];
    const L = S.nodes[id] || 0;
    if (L >= nd.max || !nodeAvailable(nd)) return false;
    const c = nodeCost(nd, L);
    if (S.essence < c) return false;
    S.essence -= c; S.nodes[id] = L + 1;
    R.dirty = true; recalc();
    emit('buy', 'node', id);
    return true;
  }
  G.buyNode = buyNode;

  function legacyCost(l, L) { return Math.ceil(l.base * Math.pow(l.growth, L)); }
  G.legacyCost = l => legacyCost(l, G.S.legacy[l.id] || 0);
  function buyLegacy(id) {
    const S = G.S, l = G.LEGACY_BY_ID[id];
    const L = S.legacy[id] || 0;
    if (L >= l.max) return false;
    const c = legacyCost(l, L);
    if (S.fame < c) return false;
    S.fame -= c; S.legacy[id] = L + 1;
    R.dirty = true; recalc();
    emit('buy', 'legacy', id);
    return true;
  }
  G.buyLegacy = buyLegacy;

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
    if (roll < 0.15) { q.rw = 'eggs'; q.rn = 1 + (lv > 30 ? 1 : 0); }
    else if (roll < 0.5) { q.rw = 'ess'; q.rn = Math.round(4 + lv * 1.5); }
    else { q.rw = 'gold'; q.rn = 20; } // seconds of income, paid at claim time
    return q;
  }
  function fillQuests() {
    const S = G.S;
    while (S.quests.length < 3) S.quests.push(makeQuest(S.quests.map(q => q.k)));
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
    if (q.rw === 'gold') return D.incomeRef * q.rn * D.questMult;
    if (q.rw === 'ess') return q.rn * D.questMult * D.essMult;
    return q.rn;
  }
  G.questReward = questReward;
  function claimQuest(i) {
    const S = G.S, q = S.quests[i];
    if (!q || !q.done) return false;
    const v = questReward(q);
    if (q.rw === 'gold') addGold(v, 'quest');
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
    if (r.kind === 'gold') addGold(r.v);
    else if (r.kind === 'eggs') addEggs(r.v);
    else if (r.kind === 'ess') addEssence(r.v);
    else openChest(makeChest(r.tier, 'ghost'), 'daily');
    emit('daily', r);
    return r;
  }
  G.claimDaily = claimDaily;

  // ---------- Ascension ----------
  // Fame depends mostly on how deep this run went (bosses gate depth), with a
  // small bonus for gold, so each ascension is worth a similar, growing amount.
  function fameGain() {
    const S = G.S, d = S.maxDepth;
    if (d < 5) return 0;
    const goldBonus = 1 + 0.1 * Math.max(0, Math.log10(Math.max(1, S.goldRun / 1e9)));
    return Math.floor(0.3 * d * Math.pow(1.07, d) * goldBonus * D.fameMult);
  }
  G.fameGain = fameGain;
  function ascend() {
    const S = G.S;
    const g = fameGain();
    if (g < 1) return false;
    const keepPct = 0.25 * (S.legacy.lg_keeppot || 0);
    const keep = {};
    G.POTIONS.forEach(p => keep[p.id] = Math.floor(S.pots[p.id] * keepPct));
    S.fame += g; S.fameTotal += g; S.ascensions++;
    S.lastRunEss = S.essRun;
    const fresh = newState();
    const runKeys = ['gold', 'goldRun', 'clicksRun', 'upg', 'heroes', 'nodes', 'essence', 'essRun', 'depth', 'maxDepth',
      'pots', 'chests', 'chestMeter', 'bossMeter', 'buffs', 'quests', 'scar'];
    runKeys.forEach(k => S[k] = fresh[k]);
    S.pots = Object.assign(potZero(), keep);
    const L = S.legacy;
    if (L.lg_start) S.gold = 100 * Math.pow(10, L.lg_start);
    if (L.lg_deep) S.depth = S.maxDepth = 2 * L.lg_deep;
    if (L.lg_stars) S.essence = S.lastRunEss * 0.12 * L.lg_stars;
    R.boss = null; R.bossReady = false; R.combo = 0;
    if (G.heroReset) G.heroReset(false);
    R.dirty = true; recalc();
    fillQuests();
    emit('ascend', g);
    return g;
  }
  G.ascend = ascend;

  // ---------- Offline ----------
  function applyOffline(sec) {
    if (sec < 60) return null;
    if (G.worldAway) G.worldAway();
    recalc();
    const t = Math.min(sec, D.offCap);
    const gold = D.gpsBase * t * D.offEff;
    // back after a long rest: the next boss fight hits harder
    if (sec >= 4 * 3600) G.S.rested = 1;
    addGold(gold);
    // Scouts and the golem keep finding chests while away (opened virtually).
    const rate = D.scout + (D.autoOpen ? Math.min((D.looters || 1) / D.autoOpen, 3) * 0.25 : 0);
    const n = Math.min(400, Math.floor(t * rate * D.offEff));
    let items = 0, ess = 0, extraGold = 0;
    for (let i = 0; i < n; i++) {
      const l = openChest(makeChest(rollTier(), null), 'offline');
      items += l.items.length; ess += l.ess; extraGold += l.gold;
    }
    const warden = G.heroOffline ? G.heroOffline(t) : null;
    return { sec, t, gold: gold + extraGold, chests: n, items, ess, warden, rested: !!G.S.rested };
  }
  G.applyOffline = applyOffline;

  // ---------- Main tick ----------
  function tick(dt) {
    const S = G.S;
    if (R.dirty) recalc();
    S.st.playTime += dt;

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
        if (b.t <= 0) bossFail();
        else bossMoves(b, dt);
      }
    } else if (S.bossMeter >= D.bossNeed) {
      if (!R.bossReady) { R.bossReady = true; R.bossIn = TUNE.bossCall; emit('bossReady'); }
      // Bosses come on their own: after a short countdown when the Warden can take it, or after a
      // longer wait when it can't yet (Rally builds with each try; The Hunt shortens the wait).
      // ⚔ calls it right away.
      // (an invasion is fought out first)
      // (an invasion or a sudden event is fought out first; the Jackpot Frenzy carries on through a boss)
      if (S.set.autoBoss && !R.inv && !(R.ev && R.ev.k !== 'jackpot')) {
        R.bossIn = (R.bossIn == null ? TUNE.bossCall : R.bossIn) - dt;
        const wait = bossOdds() >= 0.6 ? 0 : D.autoBoss ? 20 : 60;
        if (R.bossIn <= -wait) startBoss();
      }
    }
    // the Looters
    lootersTick(dt);
    powersTick(dt);
    // how fast you've been clicking lately (a 10-second average)
    R.cps = (R.cps || 0) + ((R.clickN || 0) / Math.max(dt, 1e-3) - (R.cps || 0)) * Math.min(1, dt / 10); R.clickN = 0;
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
      if (R.wispT <= 0) { R.wispT = rand(TUNE.wispMin, TUNE.wispMax); spawnWisp(); }
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
      return deserialize(s);
    }
    const fresh = newState();
    const S = Object.assign(fresh, data);
    // Merge nested objects so new fields get defaults.
    S.st = Object.assign(newState().st, data.st || {});
    S.set = Object.assign(newState().set, data.set || {});
    S.pots = Object.assign(potZero(), data.pots || {});
    S.pity = Object.assign({ l: 0, d: 0 }, data.pity || {});
    S.daily = Object.assign({ last: '', streak: 0 }, data.daily || {});
    S.bounty = Object.assign({ day: '', n: 0, done: false }, data.bounty || {});
    S.rift = Object.assign(newRift(), data.rift || {});
    S.rift.day = Object.assign({ k: '', l: 0 }, S.rift.day || {});
    if (!S.uq || typeof S.uq !== 'object') S.uq = {};
    if (!S.lands || typeof S.lands !== 'object') S.lands = {};
    // saves from before 1.1: past depth 40 the lands changed, so crown times there belong to other lords now
    if (!('lands' in data) && S.rec && S.rec.crowns) for (const k in S.rec.crowns) if (+k >= 40) delete S.rec.crowns[k];
    // saves from before 2.0: depths 65-74 were corrupted lands then, the Moon and the Star Sea now
    if (!('party' in data) && S.rec && S.rec.crowns) for (const k in S.rec.crowns) if (+k >= 65) delete S.rec.crowns[k];
    // saves from before 2.1: the hall gave one slot a level (up to 16); now it steps 10, 20, 30…
    if (!('jp' in data) && S.upg && S.upg.hall > 0) S.upg.hall = S.upg.hall <= 4 ? 1 : 2;
    // a save from before the jackpot starts its clock now, not at its first minute of play
    S.jp = data.jp ? Object.assign({ n: 0, at: 0 }, data.jp) : { n: 0, at: (S.st && S.st.playTime) || 0 };
    if (!Array.isArray(S.feed)) S.feed = [];
    if (!Array.isArray(S.opened) || S.opened.length !== 7) S.opened = [0, 0, 0, 0, 0, 0, 0];
    S.chests = (S.chests || []).filter(c => c && c.tier >= 0 && c.tier <= 6);
    G.S = S;
    if (G.ensureHero) G.ensureHero(S);
    if (R.mobs) R.mobs.length = 0; if (R.shots) R.shots.length = 0;
    R.boss = null; R.bossReady = false; R.combo = 0; R.wisp = null; R.wave = null; R.btnDown = 0;
    if (G.worldClear) G.worldClear();
    // saves from before 1.0: the Journey gained 11 steps in between the old ones
    if (!('uq' in data) && G.Journey && G.Journey.fromV0) S.journey = G.Journey.fromV0(S.journey || 0);
    R.dirty = true; recalc();
    if (S.hero && S.hero.cls) {
      if (!(data.hero && 'whp' in data.hero)) S.hero.whp = D.wardenHp;
      if (S.hero.hp <= 0 && G.TUNE.btnDown) R.btnDown = G.TUNE.btnDown;
    }
    return S;
  }
  G.deserialize = deserialize;
})(globalThis.G = globalThis.G || {});
