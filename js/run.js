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
  // 4.0 (meta): the Hall of Fame's run knobs (Second Wind, Reroll, Banish, Third Door, Belt, Heirloom, Quartermaster ranks) by
  // their reader G.hall(id) (game.js; the ranks live in S.legacy, where a 3.x save keeps them)
  const hallRank = id => (G.hall ? G.hall(id) : (S_().legacy || {})[id]) | 0;
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
    // (continuation: the run's screens; content names (perks, traits, map mods, tags, boons, pacts, shrines) are on their
    // data objects in data.js)
    card_level: 'LEVEL {0}: choose a card', card_boss: 'ZONE CLEARED: choose a card', card_train: 'TRAINING: choose a card', card_hexed: 'HEXED LORD: a card more',
    card_bonus: 'A card', card_tier1: 'Empowered', card_tier2: 'Golden', card_ranks: '+{0} ranks', card_evo: 'EVOLUTION', card_reroll: 'Reroll ({0})',
    card_banish: 'Banish ({0})', card_auto: 'Auto-pick in {0}s', card_slots: 'Perk slots {0}/{1}',
    loot_title: 'LOOT', loot_hint: 'Tap to wear · hold to stash', loot_pick2: 'Take two', loot_burn: '+{0} Embers', loot_up: '▲ +{0}% {1}', loot_down: '▼ {0}%',
    loot_collapse: 'Nothing better: into the Furnace', loot_tag_A: 'For your weakest piece', loot_tag_W: 'A weapon for {0}', loot_tag_U: 'UNIQUE',
    loot_tag_S: 'Loot Storm', loot_tag_C: 'Chance', loot_tag_E: 'Elite\u2019s prize', loot_tag_V: 'The Vault', loot_orbs: '+{0} orbs', loot_key: '+1 Key',
    camp_title: 'CAMP {0}', camp_rest: 'Rest: +{0}% health', camp_temper: 'Temper: +2 enchant on every worn item', camp_train: 'Train: +1 card now',
    camp_market: 'Market', camp_reroll: 'New wares ({0})', camp_lock: 'Keep', camp_recruit: 'Recruit', camp_enchant: 'Enchant All', camp_reforge: 'Reforge',
    camp_extract: 'Extract: bank {0} Embers', camp_extract4: 'Extract now: {0} Embers safe, or go for x1.5', camp_go: 'On to the doors',
    ware_item: 'Gear at the cap', ware_orbs: 'Orb satchel (3)', ware_potion: 'Potion', ware_mend: 'Mend charge', ware_reroll: 'Card reroll', ware_pip: 'Integrity +1',
    ware_key: 'Key', ware_gamble: 'Gamble ({0})',
    doors_title: 'Choose the next land', door_lord: 'Lord: {0}', door_act: 'ACT BOSS', door_final: 'THE MAD BUTTON', door_vault: 'Vault first (1 Key)', door_cursed: 'CURSED: twice the twist, twice the prize',
    relic_title: 'Choose a relic', relic_belt: 'Belt {0}/{1}', relic_replace: 'Replace', relic_skip: 'Leave it',
    shrine_charge: 'Hold the Hand here', boon_title: 'Choose a boon', chance_boon: 'Fortune smiles: {0}', chance_loot: 'A better card waits at the next loot', chance_none: 'Nothing',
    pact_title: 'A pact', pact_yes: 'Accept', pact_no: 'Decline: a boon instead',
    won_title: 'THE MAD BUTTON IS BROKEN', push_on: 'PUSH ON', push_return: 'RETURN', push_tide: 'The Tide x{0}', push_land: 'Push land {0}',
    ls_title: 'LAST STAND', ls_left: 'Hold for {0}s', ls_retry: 'The Mad Button returns in {0}s',
  });

  // ---------- The run's data tables (4.0, runflow: moved here from data.js, where the core stream first put them) ----------
  // run.js is their home now: what a recruit, a door, a shrine's boon or a Pact is (G.WARES is in the camp section). No
  // module reads them while the scripts load (hero.js, world.js and run_ui.js read them in play), so defining them here,
  // after data.js, is safe. data.js may still carry an older copy until its owner deletes it: this one wins (it is
  // assigned after it); tests/runflow/runflow_rules.js 'data tables' checks the two copies stay the same meanwhile.
  // Companions' traits (DESIGN §5.4): a recruit is a class plus one of these. dmg/hp/spd/crit/heal: that companion's own;
  // party: the whole party's damage; luck: the loot moment's luck (hero.js reads them through its stat hooks)
  G.TRAITS = {
    veteran: { name: 'Veteran', desc: '+25% damage', dmg: 0.25 },
    stalwart: { name: 'Stalwart', desc: '+40% health', hp: 0.4 },
    swift: { name: 'Swift', desc: '+20% attack speed', spd: 0.2 },
    lucky: { name: 'Lucky', desc: '+5% crit', crit: 0.05 },
    medic: { name: 'Medic', desc: 'Heals +50%', heal: 0.5 },
    bannerman: { name: 'Bannerman', desc: '+5% party damage', party: 0.05 },
    scavenger: { name: 'Scavenger', desc: 'Loot moment luck +0.1', luck: 0.1 },
    zealot: { name: 'Zealot', desc: '+40% damage, -20% health', dmg: 0.4, hp: -0.2 },
  };
  G.TRAIT_IDS = Object.keys(G.TRAITS);
  // Doors (DESIGN §5.6): each land's map mod (the risk) and reward tag.
  //   land: fields merged into G.landNow() (the count knobs hero.js and world.js read: thick, loot, mobHp, speed, bite,
  //   hoard, noMend, gold); emb: this land's Embers into the pouch x(1+emb); rar: the loot moment's rarity +n; lordCards:
  //   more cards at its lord's loot moment; cards: more card offers at its lord; affix: its lord +n affix
  G.MAP_MODS = {
    calm: { w: 30, name: 'Calm', desc: 'No twist', land: null },
    thick: { w: 10, name: 'Thick', desc: '+40% density, +25% items', land: { thick: 1.4, loot: 1.25 } },
    armored: { w: 10, name: 'Armored', desc: '+30% Horde health, loot rarity +1', land: { mobHp: 1.3 }, rar: 1 },
    swift: { w: 10, name: 'Swift', desc: 'Horde +25% speed, Embers +30%', land: { speed: 1.25 }, emb: 0.3 },
    hexed: { w: 10, name: 'Hexed', desc: 'Bites +30%, +1 card at the lord', land: { bite: 1.3 }, cards: 1 },
    elite: { w: 10, name: 'Elite Lord', desc: 'Lord +1 affix, +1 lord loot card', land: null, affix: 1, lordCards: 1 },
    treasure: { w: 10, name: 'Treasure', desc: 'Hoarders x3', land: { hoard: 3 } },
    nomend: { w: 10, name: 'No Mending', desc: 'Mend off, Embers +50%', land: { noMend: 1 }, emb: 0.5 },
  };
  G.REWARD_TAGS = {
    battle: { w: 30, name: 'Battle', desc: 'Gold +25%', land: { gold: 1.25 } },
    elite: { w: 20, name: 'Elite', desc: 'A Land Champion in zone 1: its kill pays a Key and a legendary loot card' },
    treasure: { w: 15, name: 'Treasure', desc: '+1 loot card at each boss, a golden chest in zone 1', bossCards: 1 },
    shrine: { w: 15, name: 'Shrine', desc: 'A Power shrine at the start, shrines every 55 s', land: { shrine: 2 } },
    merchant: { w: 10, name: 'Merchant', desc: 'A merchant mid-land' },
    mystery: { w: 10, name: 'Mystery', desc: 'Something strange mid-land' },
  };
  // The run boons a Power shrine offers (DESIGN §5.8: the old blessing cards' effects; they last the rest of the run;
  // S.run.boons {id: n}; the Shrines section applies them in recalc). (The meta: the rest of the retired blessing cards, at a
  // boon's size: Giant Slayer, Fortune, Live Wire, Orb Seeker. data.js G.BLESS_TO says where each blessing went.)
  G.BOONS = {
    dmg: { name: '+10% damage', fx: (n, d) => { d.heroMult *= 1 + 0.1 * n; } },
    spd: { name: '+10% attack speed', fx: (n, d) => { d.spdMult *= 1 + 0.1 * n; } },
    hp: { name: '+15% health', fx: (n, d) => { d.hpMult *= 1 + 0.15 * n; } },
    crit: { name: '+3% crit', fx: (n, d) => { d.crit += 0.03 * n; } },
    gold: { name: '+20% gold', fx: (n, d) => { d.goldMult *= 1 + 0.2 * n; } },
    xp: { name: '+15% XP', fx: (n, d) => { d.xpMult = (d.xpMult || 1) * (1 + 0.15 * n); } },
    reroll: { name: '+1 card reroll', once: 1 },
    boss: { name: '+15% boss damage', fx: (n, d) => { d.bossMult *= 1 + 0.15 * n; } },
    luck: { name: 'Chest find +15%, luck +10%', fx: (n, d) => { d.chestProg *= 1 + 0.15 * n; d.luck += 0.1 * n; } },
    od: { name: 'Overdrive charges +30%', fx: (n, d) => { d.odRate = (d.odRate || 1) * (1 + 0.3 * n); } },
    orbs: { name: 'Orbs drop +50%', fx: (n, d) => { d.orbMult = (d.orbMult || 1) * (1 + 0.5 * n); } },
  };
  // (each boon's line for the UI: G.BOONS[id].desc)
  for (const k in G.BOONS) if (!G.BOONS[k].desc) G.BOONS[k].desc = G.BOONS[k].name;
  // Pacts (DESIGN §5.8): a curse now, a reward at the lord (blood, greed, hunt: this land; glass: the rest of the run)
  G.PACTS = {
    blood: { name: 'Blood Pact', desc: 'Horde +50% health in this land; the lord’s loot +1 rarity and +1 card', land: { mobHp: 1.5 } },
    glass: { name: 'Glass Pact', desc: 'x0.6 health, x1.4 damage for the rest of the run' },
    greed: { name: 'Greed Pact', desc: 'Bites +40% in this land; gold x2.5 in this land', land: { bite: 1.4, gold: 2.5 } },
    hunt: { name: 'Hunt Pact', desc: 'A second Land Champion now: +1 Key and a 20% unique card at the lord' },
  };

  // ---------- The run object ----------
  // the offers' own random stream (route, doors, cards, loot cards, market: never the combat stream, so a seeded Daily
  // gives everyone the same offers whatever happens in a fight). Resumes where it was after a reload (rngN).
  // 4.0 (runflow, DESIGN §6.5): one stream per offer site, keyed by where the offer stands in the run ('door:<slot>',
  // 'card:<n>' (the n-th deal), 'loot:<depth>', 'camp:<n>:<rolls>', 'recruit:<n>', 'shrine:<n>', 'champ:<slot>'...), each
  // seeded from the run's seed and the key. A single stream would let a shrine or a level-up card that one player met and
  // another did not shift every later door and card; keyed, the k-th card, the doors of land 3 and the loot of depth 7 draw
  // the same numbers for everyone who plays the same seed. G.runRngIn(key, fn [, all]) runs fn with that stream (all: and
  // routes G.rng() to it meanwhile, for the helpers that roll an offer's item on the combat stream: G.gearFor, the
  // merchant's wares). Draws outside a key take the run's default stream. The counts are saved (r.rngK), so a reload
  // carries on where each stream was.
  const fnv = str => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; };
  G.runRng = function () {
    const r = runOf();
    if (!r || !r.on) return G.rng();
    const key = R.rngKey;
    if (key) {
      if (!R.rngS || R.rngS.id !== r.id) R.rngS = { id: r.id, m: {} };
      const K = r.rngK || (r.rngK = {});
      let f = R.rngS.m[key];
      if (!f) { f = R.rngS.m[key] = G.seeded(fnv((r.seed >>> 0) + '|' + key) || 1); for (let i = 0; i < (K[key] | 0); i++) f(); }
      K[key] = (K[key] | 0) + 1;
      return f();
    }
    if (!R.runRng || R.runRngId !== r.id) { R.runRng = G.seeded((r.seed >>> 0) || 1); R.runRngId = r.id; for (let i = 0; i < (r.rngN | 0); i++) R.runRng(); }
    r.rngN = (r.rngN | 0) + 1;
    return R.runRng();
  };
  G.runRngIn = function (key, fn, all) {
    const r = runOf();
    if (!r || !r.on || !key) return fn();
    const k0 = R.rngKey, rng0 = G.rng;
    R.rngKey = String(key);
    // (a run that ends inside fn falls back to the combat stream: never a loop through this wrapper)
    if (all) G.rng = () => (on() ? G.runRng() : rng0());
    try { return fn(); } finally { R.rngKey = k0; if (all) G.rng = rng0; }
  };
  // the stream a key would give a seed, from its first draw (the setup's preview of the first doors: no run yet)
  G.runRngPeek = (seed, key) => G.seeded(fnv((seed >>> 0) + '|' + key) || 1);
  // the share code (streamer mode, setup's 'Enter a code'): BTTN-<seed>-<button>-H<heat>
  G.runCode = r => { r = r || runOf(); return r && r.seed != null ? 'BTTN-' + (r.seed >>> 0).toString(36).toUpperCase() + '-' + (r.btn || 'classic') + '-H' + (r.heat | 0) : ''; };
  G.runParseCode = function (code) {
    const m = /^BTTN-([0-9A-Z]+)-([a-z]+)-H(\d+)$/i.exec(String(code || '').trim());
    return m ? { seed: parseInt(m[1], 36) >>> 0, btn: m[2].toLowerCase(), heat: +m[3] } : null;
  };
  // (runflow, ADDENDUM 6) start an unranked replay of a code's seed: its Button (Classic while that one is locked here),
  // its Heat (at most the Heat open here), the class and keepsakes of setup (none: a replay starts bare, like the Daily).
  // The offers - first doors, doors, cards, loot cards, the market - are the code's run's (keyed streams, G.runRngIn);
  // r.replay = 1 (no Daily rank, ladders may leave it out). Returns the run, or null (a bad code, a run on)
  G.runFromCode = function (code, setup) {
    const p = G.runParseCode(code);
    if (!p) return null;
    const btnOk = !G.btnOpen || G.btnOpen(p.btn) || p.btn === 'classic';
    return G.runStart(Object.assign({}, setup || {}, { seed: p.seed, btn: btnOk ? p.btn : 'classic', heat: Math.max(0, Math.min(p.heat, G.tormentMax())), keeps: [], replay: 1 }));
  };

  function newRun(setup, n) {
    const S = S_();
    // (the offers' seed: the Daily's, a shared code's, or one drawn now)
    const seed = setup.seed != null ? setup.seed >>> 0 : Math.floor(G.rng() * 4294967296) >>> 0;
    return {
      on: 1, n, id: 'r' + n + '-' + seed.toString(36), seed, rngN: 0, day: setup.day || '', ranked: setup.day && !setup.replay ? 1 : 0,
      // (a seed code's run: an unranked replay of another run's offers - ladders and records may leave it out)
      replay: setup.replay ? 1 : 0,
      btn: setup.btn || 'classic', cls: setup.cls, heat: setup.heat | 0, keeps: (setup.keeps || []).slice(0, 2),
      // the lands (realm indices), the map mod and the reward tag of each land slot (the doors set them), the doors on offer
      route: [], mods: [null, null, null, null, null, null], tags: [null, null, null, null, null, null], doors: null,
      // Integrity, Mend charges, card rerolls and banishes, the relic belt (rule ids, merged into d.uq)
      pips: TUNE.pips, pipMax: TUNE.pips, mend: TUNE.mendCharges, mendMax: TUNE.mendCharges, mendBonus: 0,
      rerolls: 1, banish: 0, banished: [], belt: [], beltMax: 3,
      // the cards: the one on screen ({why, ids, add, tier, t, touch}), those owed after it, extra ones at the next boss,
      // the picks in order, and auto-pick (the Clockwork Button, Auto-Run: h.autoPerk is the player's own toggle)
      offer: null, cardQ: [], cardBonus: 0, cardLog: [], autoCards: 0,
      // shrines and pacts: the run's boons {id: n}, a choice on screen, a Pact on a land {id, slot}, the Glass Pact; the next
      // loot moment's extras (a Loot Storm's card, a Chance shrine's better card); the open loot moment (banked items)
      boons: {}, boonOffer: null, pactOffer: null, pact: null, glass: 0, lootStorm: 0, lootUp: 0, loot: null,
      // the books: lords and act bosses slain, the deepest zone cleared, the Embers pouch, Keys, the raw Fame by line
      lords: 0, acts: 0, cleared: 0, maxDepth: 0, cards: 0, camps: 0, pouch: 0, pouchLog: {}, keys: 0, fame: {},
      // the chest budget's tokens (game.js spawnChest: chests that aren't the Hand's, a Golden Click's, a Treasure door's)
      chestTok: TUNE.siegeChestCap,
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
  // (runflow: and the meta's G.unlocked('land', id) once it is the real one, not run.js's open-everything fallback)
  const landOpen = id => {
    const i = G.REALM_BY_ID[id];
    if (i == null) return false;
    if (G.landOpen) return !!G.landOpen(id);
    if (typeof G.unlocked === 'function' && !G.unlocked.fallback) return G.unlocked('land', id) !== false;
    return !!G.REALMS[i].start;
  };
  G.runLandOpen = landOpen;
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
    if (!r || !r.on || slot < 0 || (slot >= r.route.length && !r.push)) return false;
    while (r.route.length <= slot) { r.route.push(null); r.mods.push(null); r.tags.push(null); }
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
  //   a reload, selfAuto: its own tick times it out (no beatAutoNoUI), fallback: run.js's own default (any other module's
  //   beat with the same id wins, whichever registers first) }. ctx = { d, lord, kind ('boss'|'lord'|'act'|'final'), act,
  //   final, realm, slot }
  G.runBeat = function (def) {
    if (!def || !def.id || typeof def.open !== 'function') return false;
    const i = BEATS.findIndex(b => b.id === def.id);
    if (i >= 0 && def.fallback && !BEATS[i].fallback) return false;
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
      // (a sequence of some beats only: the Vault's loot moment)
      if (bt.ctx && bt.ctx.only && !bt.ctx.only.includes(B.id)) continue;
      let took = false;
      try { took = !!B.open(bt.ctx); } catch (e) { if (typeof console !== 'undefined') console.error('beat ' + B.id, e); }
      if (!r.on) return true; // a beat ended the run (e.g. an extract)
      if (took) { bt.id = B.id; bt.order = B.order; bt.t = 0; G.runPhase(B.id); emit('beat', B.id, bt.ctx); return true; }
    }
    r.beat = null;
    G.runPhase('field');
    // (a side sequence: no march of its own, unless it asks for one)
    if (bt && bt.ctx && bt.ctx.only) { if (bt.ctx.march && G.startMarch) G.startMarch(bt.ctx.d); return true; }
    // the Mad Button fell: the Siege is won, once its loot and card are taken (Push On or Return, with the Rift Gate II)
    if (bt && bt.ctx && bt.ctx.final) { if (G.pushOpen()) askPush(); else G.runEnd('win'); return true; }
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
  // run only some of the beats now (the Vault's loot moment after its secret land), holding the field meanwhile
  function runBeatsOnly(ids, ctx) {
    const r = runOf();
    if (!r || !r.on || r.beat) return false;
    r.beat = { i: 0, id: null, t: 0, ctx: Object.assign({}, ctx, { only: ids }) };
    return nextBeat();
  }
  // bossWin's hand-off: the beats, then the march (or the win). True: the run took care of what comes next
  G.runAfterBoss = function (b) {
    const r = runOf();
    if (!r || !r.on) return false;
    const kind = b.kind || G.bossKind(b.d);
    const slot = G.runSlot(b.d);
    r.beat = { i: 0, id: null, t: 0, ctx: { d: b.d, lord: !!b.lord, kind, act: kind === 'act', final: kind === 'final', realm: b.realm, slot, fresh: r.fresh !== 0,
      push: !!r.push, pushRelic: !!(r.push && b.lord && r.fresh !== 0 && (slot - SG().lands + 1) % 2 === 0) } };
    return nextBeat();
  };
  // while the field holds: the clocks, the beat's own tick, and with no UI the beat is answered for the player
  G.runHoldTick = function (dt) {
    const r = runOf();
    if (!r || !r.on) return;
    r.secs += dt;
    if (r.phase === 'camp' || r.phase === 'doors') r.parT += dt;
    // a card on screen (in any phase: a level-up's, the boss's, Train's at camp) runs its own timer; a shrine's choice too
    if (r.offer) cardTick(dt);
    if (r.boonOffer || r.pactOffer) shrineTick(dt);
    // (after a win with no run UI to ask: Return)
    if (r.pushAsk && (r.pushAsk.t += dt) >= TUNE.beatAutoNoUI && !G.runUI) G.runReturn();
    const bt = r.beat;
    // (a phase set without a beat, G.runPhase(p) by a module, holds until that module sets 'field' again)
    if (!bt || !bt.id) return;
    const B = BEAT_BY_ID[bt.id];
    if (!B) { bt.id = null; nextBeat(); return; }
    bt.t = (bt.t || 0) + dt;
    if (B.tick) { try { B.tick(dt, bt.ctx); } catch (e) { if (typeof console !== 'undefined') console.error('beat tick ' + bt.id, e); } }
    if (!G.runUI && !B.selfAuto && r.beat && r.beat.id && r.beat.t >= TUNE.beatAutoNoUI) G.beatAuto();
  };
  // 4.0 (cardsloot: the idle gate's hooks, DESIGN §6.1 / §14): the run's own auto clocks. The Buttons stream sets them on
  // S.run at 'runSetup' (Clockwork, Auto-Run); unset, nothing changes. r.autoCards + r.autoAfter (s): cards auto-pick
  // after that (G.cardAfter); r.beatAfter (s): with a run UI the camp, the doors, a relic choice and a shrine's choice
  // resolve themselves after that many s untouched (Clockwork 4) instead of TUNE.campAuto / shrineAuto; r.autoExtract (a
  // camp number): a camp left to the game there or later extracts ('autoExtract'(n); Auto-Run 2); r.autoAgain: the next
  // Siege starts by itself after the summary (S.run.autoAgain = autoAgainT s for the summary screen's countdown; with no
  // run UI at once). With no run UI every hold is answered after beatAutoNoUI s anyway.
  TUNE.autoAgainT = 5;
  G.beatAfter = dflt => { const r = runOf(); return r && r.on && r.beatAfter > 0 ? +r.beatAfter : dflt != null ? dflt : TUNE.campAuto; };
  // the field's clocks (game.js tick, field only)
  G.runTick = function (dt) {
    const r = runOf();
    if (!r || !r.on) return;
    r.secs += dt; r.field += dt; r.parT += dt;
    if (r.push) {
      r.pushT = (r.pushT || 0) + dt;
      // (runflow: the Tide rises a step every Push minute: 'tide'(factor, minutes) for the screen)
      const k = Math.floor(r.pushT / 60);
      if (k > (r.tideK | 0)) { r.tideK = k; emit('tide', G.runTide(), k); }
    }
    // the chest budget (game.js spawnChest): the events', champions' and rare visitors' chests, siegeChestRate a field minute
    r.chestTok = Math.min(TUNE.siegeChestCap, (r.chestTok == null ? TUNE.siegeChestCap : r.chestTok) + TUNE.siegeChestRate * dt / 60);
    // (runflow: the Heat 7 Reaper - 2 minutes behind par, bites +10% for every further minute - comes and goes:
    // 'reaper'(factor) when it starts biting, as it climbs a step, and 'reaper'(1) when the party is back in time)
    if (G.heat().reaper) {
      const rk = reaperK(), step = rk > 1 ? Math.floor((rk - 1) / TUNE.reaperPer + 1e-9) + 1 : 0;
      if (step !== (r.reaperStep | 0)) { r.reaperStep = step; emit('reaper', rk, step); }
    }
    // a card owed (a warm-up level during a fight that was lost) comes as soon as the field is quiet
    if (r.cardQ && r.cardQ.length && !r.offer && !R.boss) cardOpenField();
    // an Elite door's Land Champion, a few seconds into its land; a Merchant or a Mystery in the land's second zone
    if (r.eliteAt && r.field >= r.eliteAt && !R.boss && !R.march) { r.eliteAt = 0; if (G.forceChamp) G.forceChamp(); }
    // (the Mad Button, its Last Stand over, waits for nothing: no boss-call countdown, no auto-boss toggle)
    if (r.lsReady && !r.push && !R.boss && !R.lastStand && R.bossReady && S_().depth === SG().final && G.startBoss) G.startBoss();
    // (a Hunt Pact's champion waiting for the field to be free; gone with its land)
    if (r.huntQ) { if (!(r.pact && r.pact.id === 'hunt' && r.pact.slot === G.runSlot())) r.huntQ = 0; else if (!R.champ && !R.lastStand) huntChamp(); }
    const lt = r.landT, S = S_();
    if (lt && !lt.mid && lt.slot === G.runSlot() && S.depth % SIZE() === 1 && !R.boss && !R.march && r.field > 0) {
      lt.mid = 1;
      const tag = r.tags[lt.slot];
      // (runflow: the visitor and the merchant's wares from the land's own offers' stream: a Daily's are everyone's)
      if (tag === 'merchant' && G.forceRare) G.runRngIn('merchant:' + lt.slot, () => G.forceRare('merchant'), true);
      else if (tag === 'mystery' && G.forceRare) G.runRngIn('mystery:' + lt.slot, () => { const ks = ['well', 'gambler', 'king', 'land']; G.forceRare(ks[Math.floor(G.runRng() * ks.length)]); }, true);
    }
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

  // ---------- Cards (DESIGN §5.1) ----------
  // Warm-up: levels 2, 3 and 4 give a card each (hero.js gainXp -> G.cardGive('level')); then one card after every boss
  // (the 'card' beat), plus Train at camp, the Hexed lord's extra, a Golden Click's. A card holds the field (phase 'card')
  // until it is picked; it is picked for the player after cardAuto s only with auto-pick on (h.autoPerk, or the run's
  // autoCards: Clockwork, Auto-Run), or with no run UI to show it. Offers (G.runRng, so a Daily deals the same):
  //   3 cards (2 at Heat 5+), each from a school already owned cardSchool of the time; 6 perk slots: with 6 perks held,
  //   only those; rarity normal / Empowered / Golden (+1 / +2 / +3 ranks, to the perk's max); a ready evolution comes as
  //   a golden 4th card; a reroll (S.run.rerolls) deals again, a banish (S.run.banish) takes a perk out of this run.
  // The 3.x card panel works on: h.offer mirrors the ids, G.pickPerk(id) picks.
  Object.assign(TUNE, { cardN: 3, cardSlots: 6, cardSchool: 0.6, cardRar: [0.75, 0.2, 0.05], cardAdd: [1, 2, 3], cardAuto: 10, cardBoons: 1 });
  // (cardsloot: a complete build - six perks held, every one at its max, no evolution ready - would leave a boss's card
  // empty; measured, the active bot's builds were complete by zone ~12 with Empowered/Golden cards, 5 cards short of the
  // 20-21 DESIGN §5.1 counts on. With cardBoons on such a card offers the Power shrine's run boons instead (G.BOONS:
  // 'boon_<id>' cards); off: the card is skipped ('cardNone'))
  const own = k => (G.perkOwn ? G.perkOwn(k) : G.perk(k));
  // the Deeds' unlocks: G.unlocked(kind, id) is the meta stream's ('perk', 'unique', 'relic', 'land', 'class', 'button'...).
  // Until it exists everything is open (this fallback says so: .fallback; the meta's own assignment replaces it whatever
  // the load order)
  if (typeof G.unlocked !== 'function') { G.unlocked = function () { return true; }; G.unlocked.fallback = 1; }
  // may this perk be dealt now? (open with the Deeds, not banished, not at its max, Glass Cannon and Fortress apart,
  // Warband with a companion to lead)
  G.perkFit = function (k) {
    const S = S_(), r = runOf(), P = G.PERKS[k];
    if (!P || (G.perkOpen && !G.perkOpen(k)) || !G.unlocked('perk', k)) return false;
    if (r && r.banished && r.banished.includes(k)) return false;
    if ((k === 'glass' && G.perk('fortress') > 0) || (k === 'fortress' && G.perk('glass') > 0)) return false;
    if (k === 'warband' && !(S.party && S.party.length)) return false;
    return own(k) < P.max;
  };
  // the perks picked this run (the slots: evolutions and gear ranks take none)
  G.cardSlotsUsed = () => Object.keys(G.PERKS).filter(k => own(k) > 0);
  function drawCard(exclude) {
    const held = G.cardSlotsUsed();
    let pool = Object.keys(G.PERKS).filter(k => G.perkFit(k) && !exclude.includes(k));
    if (held.length >= TUNE.cardSlots) pool = pool.filter(k => own(k) > 0);
    if (!pool.length) return null;
    const schools = new Set(held.map(k => G.PERK_SCHOOL && G.PERK_SCHOOL[k]).filter(Boolean));
    let from = pool;
    if (schools.size && G.runRng() < TUNE.cardSchool) { const same = pool.filter(k => schools.has(G.PERK_SCHOOL[k])); if (same.length) from = same; }
    const id = from[Math.floor(G.runRng() * from.length)];
    const x = G.runRng(), w = TUNE.cardRar, tier = x < w[0] ? 0 : x < w[0] + w[1] ? 1 : 2;
    return { id, tier, add: TUNE.cardAdd[tier] };
  }
  // (the 3.x card panel knows perks and evolutions only: a boon offer isn't mirrored to it)
  const panelOk = ids => ids.every(id => G.PERKS[id] || (String(id).startsWith('evo_') && G.EVOS[id.slice(4)]));
  function syncHero(r) {
    const h = S_().hero;
    if (!h) return;
    h.offer = r.offer && panelOk(r.offer.ids) ? r.offer.ids : null; h.offerT = r.offer ? r.offer.t : 0;
    h.perkPts = (r.cardQ ? r.cardQ.length : 0) + (r.offer ? 1 : 0);
  }
  // deal one set (why: 'level' | 'boss' | 'train' | 'hexed' | 'bonus' | ...); null when nothing is left to deal
  // (runflow: each deal draws from its own offers' stream: 'card:<why>:<k>' - the k-th boss card (zone k's), the k-th
  // warm-up level's, Train at camp k... - so a level-up that comes earlier for one player than another, or a Golden Click's
  // extra card, doesn't move what the bosses deal; a reroll: '<its key>:r<n>')
  function deal(why, keep, key) {
    const r = runOf();
    if (!key) { const K = r.dealK || (r.dealK = {}); K[why] = (K[why] | 0) + 1; key = 'card:' + why + ':' + K[why]; }
    const k0 = dealKey;
    dealKey = key;
    try { return G.runRngIn(key, () => dealIn(why, keep)); } finally { dealKey = k0; }
  }
  let dealKey = null;
  function dealIn(why, keep) {
    const r = runOf();
    const n = G.heat().cards || TUNE.cardN, cards = keep ? keep.slice() : [];
    while (cards.filter(c => !c.evo).length < n) { const c = drawCard(cards.map(x => x.id)); if (!c) break; cards.push(c); }
    if (!cards.some(c => c.evo)) { const ev = G.evoReady ? G.evoReady() : []; if (ev.length) cards.push({ id: 'evo_' + ev[0], tier: 2, add: 1, evo: 1 }); }
    // (a complete build: the run's boons instead)
    if (!cards.length && TUNE.cardBoons && G.BOONS) {
      const ids = Object.keys(G.BOONS);
      while (cards.length < Math.min(n, ids.length)) { const k = ids[Math.floor(G.runRng() * ids.length)]; if (!cards.some(c => c.id === 'boon_' + k)) cards.push({ id: 'boon_' + k, tier: 0, add: 1, boon: 1 }); }
    }
    if (!cards.length) return null;
    const offer = { why, key: dealKey, ids: cards.map(c => c.id), add: cards.map(c => c.add), tier: cards.map(c => c.tier), t: 0, touch: 0 };
    // (the Buttons can change it: Prism's 4th card)
    emit('cardDeal', offer, r);
    r.offer = offer;
    syncHero(r);
    // (the 3.x listeners: perks2 swaps an unfit card, though none is dealt; keep the parallel lists in step)
    emit('perkOffer', offer.ids);
    while (offer.add.length > offer.ids.length) { offer.add.pop(); offer.tier.pop(); }
    while (offer.add.length < offer.ids.length) { offer.add.push(1); offer.tier.push(0); }
    if (!offer.ids.length) { r.offer = null; syncHero(r); return null; }
    if (G.director) G.director.mark('small');
    emit('cardOffer', offer, why, G.cardView());
    return offer;
  }
  G.cardOffer = () => { const r = runOf(); return r && r.offer; };
  // ---- what the card screen shows (DOM-free; the UI renders this, 'cardOffer' carries it) ----
  // G.cardView() -> null | { why, title (string key), cards: [card], rerolls, banish, slots: {used, max, ids}, auto: {on,
  //   after, left}, t }; card = { i, id, evo, perk (the perk it is or evolves from), name, desc, icon, school, tier (0 normal,
  //   1 Empowered, 2 Golden), tierName, add, own (picked ranks), gear (ranks the party's gear gives), rank (effective now),
  //   max, cap (max + gearPerkOver), to (picked ranks after), toEff (effective after), isNew (a new perk: takes a slot),
  //   maxed (at its max after), evoWith ({id, name, need, have} the evolution this perk leads to), banishable }
  const TIER_NAME = ['normal', 'empowered', 'golden'];
  // (cardsloot: the card, loot and comparison screens' words; English, i18n_ru.js adds Russian)
  if (G.tAdd) G.tAdd({
    card_none: 'Your build is complete: nothing left to learn', card_boons: 'Your build is complete: choose a boon', card_school: 'School: {0}', card_new: 'NEW', card_rankTo: 'Rank {0} → {1}', card_gear: '+{0} from gear',
    card_evoWith: 'Evolves with {0}', card_evoHave: 'You wear it: evolution ready at max', card_slotsFull: 'Slots full: only your perks now',
    // (c5: the idle hooks' words: the camp's / summary's countdown under Auto-Run, the 'autoExtract' toast)
    auto_in: 'Auto in {0}s', auto_extract: 'Auto-Run: extracted at Camp {0}', auto_again: 'Next Siege in {0}s', auto_stop: 'Stop',
    school_storm: 'Storm', school_blades: 'Blades', school_fire: 'Fire', school_frost: 'Frost', school_bastion: 'Bastion', school_greed: 'Greed', school_party: 'Party',
    loot_ultra: 'ULTRA RARE', loot_best: 'Best for {0}', loot_take: 'Take', loot_stash: 'Stash', loot_left: '{0} left to take', loot_none: 'Nothing better here',
    loot_tag_N: 'Treasure Nose', loot_mark: 'Mark', loot_ranks: '+{0} {1}', loot_rule: 'Rule: {0}', loot_keep: 'More power, but its rule/Mark would go',
    cmp_worn: 'Worn', cmp_this: 'This', cmp_power: 'Power', cmp_dps: 'Damage/s', cmp_hp: 'Health', cmp_crit: 'Crit', cmp_main: 'Main stat',
    cmp_ruleGain: 'New rule: {0}', cmp_ruleLose: 'Rule lost: {0}', cmp_ruleKept: '(still on through the party)', cmp_markGain: 'New Mark: {0}', cmp_markLose: 'Mark lost: {0}',
    cmp_rankGain: '+{0} {1}', cmp_rankLose: '−{0} {1}', cmp_for: 'For {0}',
    gear_auto: '{0}: {1} +{2}%', gear_onward: '{0} passed on to {1}', gear_fill: '{0} geared up from the bag',
    ench_all: 'Enchant All', ench_even: 'Evenly', ench_power: 'Most power', ench_bag: 'Bag items too', ench_whet: 'Use whetstones ({0})', ench_go: 'Enchant +{0}',
    ench_cost: '+{0} levels · {1} shards · {2} whetstones', ench_done: 'Enchanted: +{0} levels, power +{1}%', ench_none: 'Nothing affordable: shards come from breaking items down',
  });
  G.cardInfo = function (id, add, tier, i) {
    const S = S_(), r = runOf();
    if (String(id).startsWith('boon_')) {
      const b = id.slice(5), B = (G.BOONS && G.BOONS[b]) || {};
      return { i, id, boon: true, evo: false, perk: null, name: B.name || b, desc: B.desc || B.name || '', icon: null, school: null, tier: 0, tierName: 'normal', add: 1,
        own: (r && r.boons && r.boons[b]) | 0, isNew: false, banishable: false };
    }
    if (String(id).startsWith('evo_')) {
      const e = id.slice(4), E = G.EVOS[e] || {};
      return { i, id, evo: true, perk: E.from || null, name: E.name || e, desc: E.desc || '', icon: E.icon || null, school: (G.PERK_SCHOOL && G.PERK_SCHOOL[E.from]) || null,
        tier: 2, tierName: 'golden', add: 1, isNew: !(S.rec && S.rec.evos && S.rec.evos[e]), need: E.need || '', banishable: false };
    }
    const P = G.PERKS[id] || {}, o = own(id), gp = (G.D.gearPerk && G.D.gearPerk[id]) | 0, max = P.max || 1, over = TUNE.gearPerkOver || 0;
    const to = Math.min(max, o + (add || 1)), eff = k => Math.min(max + over, k + gp);
    const ev = Object.keys(G.EVOS).find(k => G.EVOS[k].from === id);
    let evoWith = null;
    if (ev) { const E = G.EVOS[ev], g = S.hero && S.hero.eq[E.slot]; evoWith = { id: ev, name: E.name, need: E.need, have: !!(g && E.types.includes(G.ITEM_TYPE[g.id])) }; }
    return { i, id, evo: false, perk: id, name: P.name || id, desc: P.desc || '', icon: P.icon || null, school: (G.PERK_SCHOOL && G.PERK_SCHOOL[id]) || null,
      tier: tier | 0, tierName: TIER_NAME[tier | 0] || 'normal', add: add || 1, own: o, gear: gp, rank: eff(o), max, cap: max + over, to, toEff: eff(to),
      isNew: o === 0, maxed: to >= max, evoWith, banishable: !!(r && (r.banish | 0) > 0) };
  };
  // 4.0 (cardsloot): the run's own auto clock: S.run.autoAfter s (the Clockwork Button's 4 s, DESIGN §6.1: the Buttons
  // stream sets r.autoCards = 1 and r.autoAfter = 4 at 'runSetup'); unset, TUNE.cardAuto (10 s)
  const cardAfter = r => (r && r.autoAfter > 0 ? +r.autoAfter : TUNE.cardAuto);
  G.cardAfter = () => cardAfter(runOf());
  G.cardView = function () {
    const r = runOf(), o = r && r.on && r.offer, h = S_().hero;
    if (!o) return null;
    const auto = !!((h && h.autoPerk) || r.autoCards || !G.runUI), after = cardAfter(r);
    const title = o.ids.every(id => String(id).startsWith('boon_')) ? 'card_boons' : { level: 'card_level', boss: 'card_boss', train: 'card_train', hexed: 'card_hexed' }[o.why] || 'card_bonus';
    return { why: o.why, title, lvl: h ? h.lvl : 1, cards: o.ids.map((id, i) => G.cardInfo(id, o.add[i], o.tier[i], i)), rerolls: r.rerolls | 0, banish: r.banish | 0,
      slots: { used: G.cardSlotsUsed().length, max: TUNE.cardSlots, ids: G.cardSlotsUsed() }, auto: { on: auto, after, left: auto && !o.touch ? Math.max(0, after - o.t) : null }, t: o.t, queued: (r.cardQ || []).length };
  };
  // the next card owed, if any: true when one is on screen
  function cardNext() {
    const r = runOf();
    if (!r || !r.on) return false;
    if (r.offer) return true;
    while (r.cardQ.length) {
      const why = r.cardQ.shift();
      if (deal(why)) return true;
      // (nothing left to deal: six perks held, every one at its max, no evolution ready - the build is complete;
      // 'cardNone'(why) so the screen can say so instead of a card)
      r.cardsNone = (r.cardsNone | 0) + 1;
      emit('cardNone', why);
    }
    syncHero(r);
    return false;
  }
  // a card for the player (why): it comes at once if the field allows (no boss fight), else after the fight
  G.cardGive = function (why, n) {
    const r = runOf();
    if (!r || !r.on) return false;
    for (let i = 0; i < (n || 1); i++) r.cardQ.push(why || 'bonus');
    syncHero(r);
    if (r.offer) return true;
    if (r.phase === 'field') return cardOpenField();
    // (in camp or another hold: on screen over it now)
    if (r.phase !== 'card') return cardNext();
    return true;
  };
  function cardOpenField() {
    const r = runOf();
    if (!r || r.offer || R.boss || r.phase !== 'field' || S_().fallen) return false;
    if (!cardNext()) return false;
    G.runPhase('card');
    return true;
  }
  // a card is done: the next owed one, else back to what was on (the beat after it, the field, the camp)
  function cardClose() {
    const r = runOf();
    if (!r || !r.on) return;
    if (cardNext()) return;
    if (r.beat && r.beat.id === 'card') G.beatDone('card');
    else if (r.phase === 'card') G.runPhase('field');
  }
  // pick a card on screen (its id, or its index): the rank(s) it adds, or the evolution
  G.cardPick = function (x, how) {
    const S = S_(), r = runOf(), h = S.hero, o = r && r.on && r.offer;
    if (!o || !h) return false;
    const i = typeof x === 'number' ? x : o.ids.indexOf(x);
    if (!(i >= 0 && i < o.ids.length)) return false;
    const id = o.ids[i], add = o.add[i] || 1, card = G.cardInfo(id, add, o.tier[i], i);
    h.perks = h.perks || {};
    r.offer = null;
    let rank;
    if (id.startsWith('boon_')) {
      const b = id.slice(5);
      if (G.boonApply) G.boonApply(b);
      rank = (r.boons && r.boons[b]) | 0;
    } else if (id.startsWith('evo_')) {
      h.perks[id] = rank = 1;
      const e = id.slice(4), first = !S.rec.evos[e];
      S.rec.evos[e] = 1;
      G.dirty(); G.recalc();
      emit('evolve', e, first);
    } else {
      const P = G.PERKS[id];
      h.perks[id] = rank = Math.min(P ? P.max : 1, (h.perks[id] | 0) + add);
      G.dirty(); G.recalc();
      emit('perk', id, rank, how || 'pick', add);
    }
    r.cards = (r.cards | 0) + 1; r.cardLog.push(id);
    syncHero(r);
    emit('cardPick', id, rank, o.tier[i] | 0, how || 'pick', o.why);
    // (the event bus carries 5 arguments: the card as it was on screen, with how and why, comes in its own event)
    emit('cardPicked', Object.assign(card, { rank, how: how || 'pick', why: o.why }));
    cardClose();
    return true;
  };
  // what auto-pick takes: a ready evolution, else the steadiest card (G.PERK_ORDER), a rarer one first among equals
  G.cardAutoChoice = function () {
    const r = runOf(), o = r && r.offer;
    if (!o) return -1;
    const ev = o.ids.findIndex(k => k.startsWith('evo_'));
    if (ev >= 0) return ev;
    const order = k => { const n = G.PERK_ORDER ? G.PERK_ORDER.indexOf(k) : -1; return n < 0 ? 28 : n; };
    let best = 0;
    o.ids.forEach((k, i) => { if (order(k) - 3 * o.tier[i] < order(o.ids[best]) - 3 * o.tier[best]) best = i; });
    return best;
  };
  G.cardAuto = () => { const i = G.cardAutoChoice(); return i >= 0 ? G.cardPick(i, 'auto') : false; };
  // the player is looking at the cards (a touch, a hover): the auto-pick timer stops
  G.cardTouch = () => { const r = runOf(); if (r && r.offer) r.offer.touch = 1; };
  G.cardReroll = function () {
    const r = runOf(), o = r && r.on && r.offer;
    if (!o || !((r.rerolls | 0) > 0)) return false;
    r.rerolls--;
    r.offer = null;
    // (a ready evolution stays)
    const keep = o.ids.map((id, i) => ({ id, add: o.add[i], tier: o.tier[i], evo: id.startsWith('evo_') ? 1 : 0 })).filter(c => c.evo);
    const rr = (o.rr | 0) + 1;
    deal(o.why, keep, (o.key || 'card:' + o.why) + ':r' + rr);
    if (r.offer) r.offer.rr = rr;
    emit('cardReroll', r.rerolls);
    if (!r.offer) cardClose();
    return true;
  };
  G.cardBanish = function (x) {
    const r = runOf(), o = r && r.on && r.offer;
    if (!o || !((r.banish | 0) > 0)) return false;
    const i = typeof x === 'number' ? x : o.ids.indexOf(x);
    if (!(i >= 0 && i < o.ids.length) || o.ids[i].startsWith('evo_') || o.ids[i].startsWith('boon_')) return false;
    const id = o.ids[i];
    r.banish--; r.banished.push(id);
    const c = G.runRngIn('banish:' + r.banished.length, () => drawCard(o.ids));
    if (c) { o.ids[i] = c.id; o.add[i] = c.add; o.tier[i] = c.tier; } else { o.ids.splice(i, 1); o.add.splice(i, 1); o.tier.splice(i, 1); }
    syncHero(r);
    emit('cardBanish', id, r.banish);
    if (!o.ids.length) { r.offer = null; cardClose(); }
    // (the screen shows the new card: the same 'cardOffer' as a deal)
    else emit('cardOffer', o, o.why, G.cardView());
    return true;
  };
  function cardTick(dt) {
    const r = runOf(), o = r && r.offer, h = S_().hero;
    if (!o) return;
    // (a window over the field - G.uiBusy: settings, a modal - stops the clock: nothing is picked for the player unseen)
    if (!o.touch && !(G.uiBusy && G.uiBusy())) o.t += dt;
    if (h) h.offerT = o.t;
    // auto-pick: the player's toggle, the run's (Clockwork, Auto-Run), or no run UI to show the card (the 3.x page, a bot)
    if (o.t >= cardAfter(r) && ((h && h.autoPerk) || r.autoCards || !G.runUI)) G.cardAuto();
  }
  // the card after every boss (and the extras owed: a level-up during the fight, the Hexed lord's, a Golden Click's)
  G.runBeat({ id: 'card', order: 20, fallback: 1, selfAuto: 1,
    open(ctx) {
      const r = runOf();
      if (ctx.final || !ctx.fresh) return cardNext();
      r.cardQ.push('boss');
      const mod = ctx.lord && G.MAP_MODS && G.MAP_MODS[r.mods[ctx.slot]];
      if (mod && mod.cards) for (let i = 0; i < mod.cards * (r.cursed && r.cursed[ctx.slot] ? 2 : 1); i++) r.cardQ.push('hexed');
      return cardNext();
    },
    auto() { let g = 0; while (runOf().offer && g++ < 20) G.cardAuto(); },
    resume() { const r = runOf(); if (r.offer) syncHero(r); else if (!cardNext()) G.beatDone('card'); },
  });

  // ---------- Shrines (DESIGN §5.8; world.js spawns them and the Hand charges them) ----------
  // Power: pick 1 of 3 run boons (G.BOONS: the old blessings' effects; S.run.boons) - a choice that holds the field (phase
  // 'shrine', S.run.boonOffer, G.boonPick(i)). Chance: 15% of the gold for 45% a boon, 30% a loot card a rarity above the
  // cap at the next loot moment, 25% nothing. Pact (S.run.pactOffer, G.pactAnswer(yes)): a curse now, a reward at the
  // lord (G.PACTS; S.run.pact {id, slot}; Glass is for the rest of the run: S.run.glass). Fury: world.js's 15-s buffs.
  // (4.0 runflow, continuation 3: a declined Pact leaves the shrine's own gift, a Power shrine's 1-of-3 boons
  // (pactNoBoon): the Pact shrine is a Power shrine with a wager on top, so the Deed that unlocks it ('reach Act II') adds
  // a choice instead of thinning the run's boons - measured on fresh saves' first runs (active bot, Heat 0, 24 seeds a
  // cell): Pact shrines open and every pact declined 46% against 58% with them locked; with the boons on a decline 58%;
  // Chance shrines alone cost nothing (58%); a 60-s cadence instead was worse (38%): tests/runflow/bal/out/shr2.*)
  Object.assign(TUNE, { shrineAuto: 10, chanceCost: 0.15, chanceOdds: [0.45, 0.3], pactNoBoon: 1 });
  const BOON_PREF = ['dmg', 'spd', 'crit', 'hp', 'reroll', 'xp', 'gold'];
  function boonApply(id) {
    const r = runOf(), B = G.BOONS && G.BOONS[id];
    if (!r || !B) return false;
    if (B.once) { if (id === 'reroll') r.rerolls = (r.rerolls | 0) + 1; }
    else r.boons[id] = (r.boons[id] | 0) + 1;
    G.dirty(); G.recalc();
    emit('boon', id, r.boons[id] | 0);
    return true;
  }
  G.boonApply = boonApply;
  // the run's boons and the Glass Pact, applied in recalc with the meta (before the totals)
  if (G.hook) G.hook('meta', d => {
    const r = runOf();
    if (!r || !r.on) return;
    for (const k in r.boons || {}) { const B = G.BOONS && G.BOONS[k]; if (B && B.fx && r.boons[k] > 0) B.fx(r.boons[k], d); }
    if (r.glass) { d.hpMult *= 0.6; d.heroMult *= 1.4; }
  });
  // (a shrine's choice holds the field from 'field' only; world.js G.useShrine refuses a shrine while the field is held
  // - a card, the loot moment, a camp - so the choice never opens under another hold and runs the field with it open)
  function shrineHold() { const r = runOf(); if (r && r.phase === 'field') G.runPhase('shrine'); }
  function shrineFree() { const r = runOf(); if (r && r.phase === 'shrine' && !r.boonOffer && !r.pactOffer) G.runPhase('field'); }
  // (runflow: each shrine of the run draws from its own offers' stream 'shrine:<n>')
  G.shrineEffect = function (kind, s, how) {
    const r = runOf();
    if (!r || !r.on) return false;
    r.shrineN = (r.shrineN | 0) + 1;
    return G.runRngIn('shrine:' + r.shrineN, () => shrineEffectIn(kind, s, how));
  };
  function shrineEffectIn(kind, s, how) {
    const S = S_(), r = runOf();
    // (runflow: one land Pact at a time: with Blood, Greed or Hunt on this land already, only Glass is offered; with Glass
    // taken too, the shrine is a Power shrine)
    if (kind === 'pact' && r.pact && r.pact.slot === G.runSlot() && (r.glass || !(G.PACTS && G.PACTS.glass))) kind = 'power';
    if (kind === 'power') {
      const ids = Object.keys(G.BOONS || {}), pick = [];
      while (pick.length < Math.min(3, ids.length)) { const k = ids[Math.floor(G.runRng() * ids.length)]; if (!pick.includes(k)) pick.push(k); }
      r.boonOffer = { ids: pick, t: 0, touch: 0 };
      shrineHold();
      emit('boonOffer', r.boonOffer);
    } else if (kind === 'chance') {
      const cost = Math.floor((S.gold || 0) * TUNE.chanceCost), x = G.runRng(), o = TUNE.chanceOdds;
      S.gold -= cost;
      let out = 'none', boon = null;
      if (x < o[0]) { out = 'boon'; const ids = Object.keys(G.BOONS || {}); boon = ids[Math.floor(G.runRng() * ids.length)]; boonApply(boon); }
      else if (x < o[0] + o[1]) { out = 'loot'; r.lootUp = (r.lootUp | 0) + 1; }
      emit('shrineChance', out, cost, boon);
    } else if (kind === 'pact') {
      const land = r.pact && r.pact.slot === G.runSlot();
      const ids = Object.keys(G.PACTS || {}).filter(k => (k === 'glass' ? !r.glass : !land));
      r.pactOffer = { id: ids[Math.floor(G.runRng() * ids.length)], t: 0, touch: 0 };
      shrineHold();
      emit('pactOffer', r.pactOffer);
    }
    return true;
  }
  G.boonPick = function (i) {
    const r = runOf(), o = r && r.on && r.boonOffer;
    if (!o) return false;
    const id = typeof i === 'number' ? o.ids[i] : o.ids.includes(i) ? i : null;
    if (!id) return false;
    r.boonOffer = null;
    boonApply(id);
    shrineFree();
    return true;
  };
  G.pactAnswer = function (yes) {
    const r = runOf(), o = r && r.on && r.pactOffer;
    if (!o) return false;
    r.pactOffer = null;
    if (yes) {
      const slot = G.runSlot();
      if (o.id === 'glass') r.glass = 1;
      else r.pact = { id: o.id, slot };
      if (o.id === 'hunt') huntChamp();
      G.dirty(); G.recalc();
    }
    emit('pact', o.id, !!yes);
    // declined: the boons the shrine would have offered (its own stream, 'shrine:<n>:no', so a world that says no and one
    // that says yes deal the same later offers; the 'pact' event first: a screen closes the pact before the boons open)
    if (!yes && TUNE.pactNoBoon && !r.boonOffer) G.runRngIn('shrine:' + (r.shrineN | 0) + ':no', () => shrineEffectIn('power', o, 'pact'));
    shrineFree();
    return true;
  };
  // the Hunt Pact's champion: a SECOND one in this land (runflow: champions.js's forceChamp marks the land's champion as
  // come, so the land's own would never follow; its mark is put back as it was). With a champion on the field (or the Last
  // Stand) it waits for the field to be free (S.run.huntQ, runTick; a boss fight sends it away and back as any). 'huntChamp'(champ)
  function huntChamp() {
    const S = S_(), r = runOf();
    if (!r || !r.on || !G.forceChamp) return false;
    if (R.champ || R.lastStand) { r.huntQ = 1; return false; }
    r.huntQ = 0;
    const slot = G.runSlot(), cr = S.champRun && typeof S.champRun === 'object' ? S.champRun : (S.champRun = {}), had = cr[slot];
    const c = G.forceChamp();
    if (!had) delete cr[slot];
    if (c) { c.hunt = 1; emit('huntChamp', c); }
    return !!c;
  }
  G.runHuntChamp = huntChamp;
  // ---------- Golden Clicks (DESIGN §5.8; game.js spawns and catches them: every 100-160 s, a 13-s window) ----------
  // Frenzy (40: gold x7 and party damage x1.5 for 20 s), Loot Storm (25: +1 card at the next loot moment, a rare floor:
  // S.run.lootStorm), Chest Rain (20: 2 chests), Click Storm (14), an egg (1); G.WISP_EFFECTS. The run counts them
  // (S.run.golden, the summary's golden) and names what each did for the screen: 'goldenClick'(id, effect, run)
  G.on('wispCatch', e => { const r = runOf(); if (!r || !r.on || !e) return; r.golden = (r.golden | 0) + 1; emit('goldenClick', e.id, e, r); });
  // left alone: a boon by the steady order; a pact declined
  // (a window over the field - G.uiBusy: settings, a modal - stops every hold clock, as the card's and the loot moment's:
  // nothing is decided for the player behind a window)
  const winUp = () => !!(G.uiBusy && G.uiBusy());
  function shrineTick(dt) {
    const r = runOf(), o = r.boonOffer || r.pactOffer;
    if (!o) return;
    if (!o.touch && !winUp()) o.t += dt;
    if (o.t >= (G.runUI ? G.beatAfter(TUNE.shrineAuto) : TUNE.beatAutoNoUI)) {
      if (r.boonOffer) { const ids = r.boonOffer.ids, k = BOON_PREF.find(x => ids.includes(x)) || ids[0]; G.boonPick(k); }
      else G.pactAnswer(false);
    }
  }
  G.shrineTouch = () => { const r = runOf(), o = r && (r.boonOffer || r.pactOffer); if (o) o.touch = 1; };

  // ---------- The loot moment (DESIGN §5.3; ADDENDUM: the boss's items are banked in the save the moment it dies) ----------
  // After every boss of new ground: 3 cards (a lord or an act boss 4, the Mad Button 5 with 2 picks). Card A is bad-luck
  // protection: an item for the party's weakest slot at the rarity cap (lootA) or one below; a lord's card B a class
  // weapon at the cap for whoever has the weakest weapon; the rest by rarity weights [cap, cap-1, cap-2] (lootW). A boss
  // card is a unique lootUqBoss of the time, a lord's moment holds one lootUqLord of the time (sure on the lootUqPity-th
  // dry lord), the Mad Button's always (The Last Button on its first kill), the First Hand's on its first kill. A lord
  // also gives 1-2 orbs and a Key one time in three (straight away). The player takes 1 (2 at the Mad Button): tap to
  // wear it on the hero the card shows (G.lootTake(i, who)), or stash it (G.lootTake(i, 'bag')); the rest burn into the
  // pouch at EMBERS.card of their item value (x a Mark's Ember Heart). Left alone, after lootT s (lootTSlow on runs 1-3
  // and at the Mad Button; with an ultra-rare in it the clock waits lootUltraT for its pillar; a touch stops it) the biggest
  // upgrade is taken; with no upgrade and nothing legendary or better it collapses into a burn after lootCollapse s.
  // Card bonuses: a Treasure door +1 at each boss; an Elite lord or Forge IV +1 at lords; Armored +1 rarity; a Blood Pact
  // +1 card and +1 rarity at its lord; a Loot Storm (Golden Click) +1 card with a rare floor; a Chance shrine's win one
  // card a rarity above the cap; a Treasure Nose Mark II +1 at lords (III: that one a rarity above the cap).
  // 4.0 (cardsloot): every card names the hero it is shown for (c.who: the one it suits best, G.bestWearer) and carries
  // its ▲/▼ (c.up, c.pct, c.delta); L.best is the biggest ▲ (Space/Enter's card; -1: none). Its items are rolled from the
  // offers' stream (G.runRng: a Daily deals the same), a mythic's or divine's perk ranks from the schools of the class it
  // is shown for. The timer runs in real seconds while the phase is 'loot' (the hold's tick, never the field's).
  // R.loot is the open moment: the same object as S.run.loot (the save's), read through a getter so the two never drift.
  Object.assign(TUNE, { lootT: 5, lootTSlow: 8, lootSlowRuns: 3, lootCollapse: 1.5, lootCards: { boss: 3, lord: 4, act: 4, final: 5 },
    // (fix1: lootW 20/50/30 -> 10/40/50 with game.js rarityAt mythic 13 / divine 16: the cap's rarity is the rare card again,
    // ultra-rares ~1 in 4 late cards, 6-8 a Siege at Heat 0 - see the TUNE note at game.js rarityAt)
    lootW: [10, 40, 50], lootA: 0.7, lootUqBoss: 0.02, lootUqLord: 0.2, lootUqPity: 4, lootKey: 1 / 3, lootOrbs: [1, 2], lootUltraT: 1.2 });
  const rpick = w => { let t = 0; for (const x of w) t += x; let v = G.runRng() * t; for (let i = 0; i < w.length; i++) { v -= w[i]; if (v < 0) return i; } return w.length - 1; };
  const clsOf = who => (who < 0 ? S_().hero.cls : S_().party[who] && S_().party[who].cls);
  // an item base of rarity r (or the best below it that exists for the slot), for a slot and a class's weapons
  function baseOf(r, slot, cls) {
    for (let x = Math.min(6, Math.max(0, r)); x >= 0; x--) {
      const list = G.ITEMS_BY_RARITY[x].filter(it => (!slot || G.slotOf(it.id) === slot) && (!cls || G.slotOf(it.id) !== 'weapon' || G.CLASS_BY_ID[cls].weapons.includes(G.ITEM_TYPE[it.id])));
      if (list.length) return list[rpick(list.map(i => i.w))];
    }
    return null;
  }
  // the party's weakest piece: the hero and slot a fresh item at rarity r would raise most (weapons: whose weapon only)
  function weakest(r, il, weaponOnly) {
    const S = S_();
    let best = null;
    for (const who of [-1].concat((S.party || []).map((_, i) => i))) {
      const cls = clsOf(who);
      for (const slot of weaponOnly ? ['weapon'] : G.SLOTS) {
        let ref = null;
        for (let x = Math.min(6, r); x >= 0 && !ref; x--) ref = G.ITEMS_BY_RARITY[x].find(it => G.slotOf(it.id) === slot && (slot !== 'weapon' || G.CLASS_BY_ID[cls].weapons.includes(G.ITEM_TYPE[it.id])));
        if (!ref) continue;
        const d = G.wants(who, { id: ref.id, r: ref.r, il, e: 0, a: [] });
        if (d != null && (!best || d > best.d)) best = { who, slot, cls, d };
      }
    }
    return best;
  }
  const loot = () => { const r = runOf(); return r && r.on ? r.loot : null; };
  G.lootNow = loot;
  if (!Object.getOwnPropertyDescriptor(R, 'loot')) Object.defineProperty(R, 'loot', { configurable: true, enumerable: false, get: () => loot(), set: v => { const r = runOf(); if (r && r.on) r.loot = v || null; } });
  function rollOrbId() { const ids = G.ORB_IDS; return ids[rpick(ids.map(k => G.ORBS[k].w))]; }
  // ultra-rares: mythic, divine, unique, relic (the rainbow flip, the pillar, the tier's sting)
  const ultra = g => !!(g && (g.r >= 5 || g.q));
  G.lootTier = g => (ultra(g) ? 'ultra' : 'normal');
  // which ultra-rare (the tier's sting and pillar colour): 'relic' | 'unique' | 'divine' | 'mythic' | null
  const ultraKind = g => (!g ? null : g.q ? (G.UNIQUES[g.q] && G.UNIQUES[g.q].relic ? 'relic' : 'unique') : g.r >= 6 ? 'divine' : g.r >= 5 ? 'mythic' : null);
  G.lootUltraKind = ultraKind;
  // a card's item, for the hero it would be shown to (cls: its perk ranks' schools), from the offers' stream
  // (runflow: inside a keyed offers' stream each card's item rolls its affixes, ranks and Marks on a sub-stream of its own,
  // '<key>:g<n>', so how many draws one card's item takes (its slot's Marks, its rarity's affixes) never moves the next card)
  const mk = (it, il, cls) => {
    const k = R.rngKey, mkOne = () => G.makeGear(it.id, il, { cls, rng: G.runRng });
    return k ? G.runRngIn(k + ':g' + (R.rngG = (R.rngG | 0) + 1), mkOne) : mkOne();
  };
  const card = (g, tag) => ({ g, tag: tag || '', taken: 0, burned: 0, who: -1, up: false, pct: 0, delta: 0 });
  // each open card's hero and ▲/▼ now, and the biggest ▲ (after a take the rest change: the Mad Button's second pick)
  function prep(L) {
    for (const c of L.cards) { if (c.taken || c.burned) continue; const bw = G.bestWearer(c.g); c.who = bw.who; c.up = !!bw.up; c.pct = bw.pct; c.delta = bw.delta; }
    let bi = -1, bp = 1e-6;
    L.cards.forEach((c, i) => { if (!c.taken && !c.burned && c.up && c.pct > bp) { bp = c.pct; bi = i; } });
    L.best = bi;
    // (L.ultra: how many ultra-rares it holds; each gets its pillar before the clock runs: L.wait)
    if (L.ultra == null) L.ultra = L.cards.filter(c => ultra(c.g)).length;
    return L;
  }
  G.lootMoment = function (b) {
    const S = S_(), r = runOf(), h = S.hero;
    if (!r || !r.on || !h || !h.cls) return null;
    const kind = b.kind || G.bossKind(b.d), lord = !!b.lord, slot = G.runSlot(b.d);
    // (a zone fought again after a wipe's push-back: its loot was offered already)
    if (b.d < (r.cleared | 0)) return null;
    const il = S.depth, cap0 = G.rarityCap();
    const mod = (G.MAP_MODS && G.MAP_MODS[r.mods[slot]]) || {}, tag = (G.REWARD_TAGS && G.REWARD_TAGS[r.tags[slot]]) || {};
    const blood = lord && r.pact && r.pact.id === 'blood' && r.pact.slot === slot;
    const rar = (mod.rar | 0) + (blood ? 1 : 0) + (G.D.lootRar | 0);
    const cap = Math.min(6, cap0 + rar);
    let n = (TUNE.lootCards[kind] || 3) + (tag.bossCards | 0) + (lord ? (mod.lordCards | 0) + (G.D.lordCard | 0) + (blood ? 1 : 0) : 0);
    const cards = [];
    const push = (it, tag2, cls) => { if (it) cards.push(card(mk(it, il, cls), tag2)); };
    // luck (a Scavenger companion): a card's rarity one step up now and then
    const luck = (G.D.lootLuck || 0);
    const rollR = () => { const w = TUNE.lootW, k = rpick(w); let x = Math.max(0, cap - k); if (luck > 0 && x < cap && G.runRng() < luck) x++; return x; };
    // A: the weakest slot
    const wk = weakest(cap, il);
    if (wk) push(baseOf(G.runRng() < TUNE.lootA ? cap : cap - 1, wk.slot, wk.cls), 'A', wk.cls);
    // B (lords): a class weapon at the cap for the weakest weapon
    if (lord && n >= 4) { const ww = weakest(cap, il, true); if (ww) push(baseOf(cap, 'weapon', ww.cls), 'W', ww.cls); }
    // a Loot Storm's card (a rare floor) and a Chance shrine's (one above the cap)
    if (r.lootStorm > 0) { r.lootStorm--; push(baseOf(Math.max(2, rollR()), null, null), 'S'); n++; }
    if (r.lootUp > 0) { r.lootUp--; push(baseOf(Math.min(6, cap + 1), null, null), 'C'); n++; }
    // an Elite door's champion slain: a card with a legendary floor
    if (r.lootLeg > 0) { r.lootLeg--; push(baseOf(Math.max(4, cap), null, null), 'E'); n++; }
    // a Treasure Nose Mark (js/powers.js): II +1 card at lords, III that card a rarity above the cap
    const nose = G.markOn ? G.markOn('nose') : 0;
    if (lord && nose >= 2) { push(baseOf(nose >= 3 ? Math.min(6, cap + 1) : rollR(), null, null), 'N'); n++; }
    // (the Rift Gate IV: Push loot +25%: a card more one time in four)
    if (r.push && G.D.pushLoot && G.runRng() < G.D.pushLoot - 1) n++;
    while (cards.length < n) push(baseOf(rollR(), null, null), '');
    // the uniques (drawn from the offers' stream too)
    const st = S.st, uqFor = boss => (G.uniqueFor ? G.uniqueFor(il, boss, G.runRng) : null);
    let uq = null;
    if (kind === 'final') uq = !S.uq.lastbutton ? 'lastbutton' : uqFor(true) || 'lastbutton';
    else if (G.isHandLord(b) && !S.uq.firsthand) uq = 'firsthand';
    else if (lord && !st.firstLordUq) { st.firstLordUq = 1; uq = S.uq.pincer ? uqFor(false) || 'goldgrin' : 'pincer'; }
    else if (lord) {
      st.lordDryQ = (st.lordDryQ | 0) + 1;
      // (Museum III: unique chances +20%; a Hunt Pact on this land: 20% more)
      const hunt = r.pact && r.pact.id === 'hunt' && r.pact.slot === slot ? 0.2 : 0;
      if (st.lordDryQ >= TUNE.lootUqPity || G.runRng() < TUNE.lootUqLord * (G.D.uqK || 1) + hunt) uq = uqFor(G.isMadLord(b) || G.isHandLord(b));
    }
    // (the unique takes a plain card's place: the weakest slot's card and a lord's weapon stay)
    if (uq) { st.lordDryQ = 0; let i = cards.findIndex(c => !c.tag); if (i < 0) i = cards.length - 1; cards[i] = card(G.makeUnique(uq, il), 'U'); }
    // (a boss's 2% a card: on its plain cards only - card A, a Loot Storm's, a Chance shrine's, an Elite's stay what they are)
    if (!lord) for (let i = 0; i < cards.length; i++) if (!cards[i].tag && G.runRng() < TUNE.lootUqBoss * (G.D.uqK || 1)) { const q = uqFor(false); if (q) cards[i] = card(G.makeUnique(q, il), 'U'); }
    // a mythic's or divine's perk ranks from the schools of the class it is shown for (card A and B know theirs)
    // (drawn for every such card, whoever it is shown to: the offers' stream takes the same draws for every player of a Daily)
    for (const c of cards) if (!c.g.q && c.g.r >= 5 && c.tag !== 'A' && c.tag !== 'W') { const bw = G.bestWearer(c.g), pk = G.rollPk(c.g.r, clsOf(bw.who) || h.cls, G.runRng); if (pk) c.g.pk = pk; }
    // a lord's orbs (Enchanter III: whetstones twice) and a Key one time in three, at once
    const orbs = {};
    let key = 0;
    if (lord) {
      const no = TUNE.lootOrbs[0] + Math.floor(G.runRng() * (TUNE.lootOrbs[1] - TUNE.lootOrbs[0] + 1));
      for (let i = 0; i < no; i++) { const k = rollOrbId(); const m = k === 'whet' && G.D.whet2 ? 2 : 1; orbs[k] = (orbs[k] || 0) + m; h.orbs[k] = (h.orbs[k] || 0) + m; S.st.orbs = (S.st.orbs || 0) + m; }
      if (kind !== 'final' && G.runRng() < TUNE.lootKey) { key = 1; r.keys = (r.keys | 0) + 1; emit('key', r.keys, 'lord'); }
    }
    const slow = (r.n | 0) <= TUNE.lootSlowRuns || kind === 'final';
    const L = r.loot = { d: b.d, il, kind, lord, slot, cards, pick: kind === 'final' ? 2 : 1, taken: 0, t: 0, T: slow ? TUNE.lootTSlow : TUNE.lootT, wait: 0, touch: 0, collapse: 0, orbs, key, best: -1, ultra: null };
    prep(L);
    G.dirty();
    emit('lootBank', L);
    return L;
  };
  // (runflow: each boss's moment draws from its own offers' stream 'loot:<depth>', whatever came before it)
  { const lm0 = G.lootMoment; G.lootMoment = b => (b && b.d != null ? G.runRngIn('loot:' + b.d, () => { R.rngG = 0; return lm0(b); }) : lm0(b)); }
  // (a moment banked elsewhere - the Vault's after its secret land - gets its heroes and ▲/▼ too)
  G.on('lootBank', L => { if (L && L.best === undefined && Array.isArray(L.cards)) { for (const c of L.cards) Object.assign(c, Object.assign(card(c.g, c.tag), c)); prep(L); } });
  // ---- what the moment shows (DOM-free; 'lootMoment' carries it) ----
  // G.lootCard(i) -> the card as the screen shows it: { i, g, tag, taken, burned, who (taken: who has it, -1 the Warden,
  //   'bag'), id, q, name, r, rarity (name), tier ('ultra' | 'normal'), ultraKind ('relic' | 'unique' | 'divine' | 'mythic' |
  //   null: the sting), unique, relic, slot, type, il, e, main (main stat),
  //   affixes [{k, v, name}], ranks [{id, n, name}], marks [G.markInfo], rule ({q, name, fx} | null), v (Embers if burned),
  //   delta (power), pct (fraction), up, keep, arrow ('▲' | '▼' | '='), best (this is L.best), rows (G.compareRows for the
  //   hero shown: worn | this) }
  G.lootCard = function (i) {
    const L = loot(), c = L && L.cards[i];
    if (!c) return null;
    const g = c.g, it = G.ITEM_BY_ID[g.id] || {}, U = g.q ? G.UNIQUES[g.q] : null, open = !c.taken && !c.burned;
    const bw = open ? G.bestWearer(g) : { who: c.who, delta: c.delta, pct: c.pct, up: c.up, keep: false };
    const who = open ? bw.who : c.who, hw = typeof who === 'number' ? who : -1;
    return { i, g, tag: c.tag, taken: c.taken, burned: c.burned, who, id: g.id, q: g.q || null, name: U ? U.name : it.name, r: g.r, rarity: G.RARITIES[g.r] ? G.RARITIES[g.r].name : '',
      tier: G.lootTier(g), ultraKind: ultraKind(g), unique: !!g.q, relic: !!(U && U.relic), slot: G.slotOf(g.id), type: G.ITEM_TYPE[g.id], il: g.il | 0, e: g.e | 0, main: G.mainStat(g),
      affixes: (g.a || []).map(([k, v]) => ({ k, v, name: G.AFFIXES[k] ? G.AFFIXES[k].name : k })), ranks: Object.keys(g.pk || {}).map(k => ({ id: k, n: g.pk[k] | 0, name: G.PERKS[k] ? G.PERKS[k].name : k })),
      marks: G.itemMarks ? G.itemMarks(g) : [], rule: U ? { q: g.q, name: U.name, fx: U.fx } : null, v: Math.round(G.itemEmbers(g) * G.EMBERS.card * (G.D.burnEmb || 1) * 10) / 10,
      delta: bw.delta, pct: bw.pct, up: !!bw.up, keep: !!bw.keep, arrow: bw.up ? '▲' : bw.pct < -1e-6 ? '▼' : '=', best: i === L.best, rows: G.canWear(hw, g) ? G.compareRows(hw, g) : [] };
  };
  // all of them, and the moment around them: G.lootView() -> [card] (the core's view: each card with its best wearer,
  // the upgrade and its burn value); G.lootState() -> { kind, lord, d, il, pick, taken, left (picks), t, T, wait (s before
  // the clock runs: the ultra-rares' pillars), timeLeft, touch, collapse, best, ultra (how many ultra-rares), orbs, key,
  // cards: G.lootView() }
  G.lootView = function () { const L = loot(); return L ? L.cards.map((c, i) => G.lootCard(i)) : null; };
  G.lootState = function () {
    const L = loot();
    if (!L) return null;
    return { kind: L.kind, lord: L.lord, d: L.d, il: L.il, pick: L.pick, taken: L.taken, left: Math.max(0, L.pick - L.taken), t: L.t, T: L.T, wait: L.wait || 0, timeLeft: L.touch ? null : Math.max(0, L.T - L.t),
      touch: L.touch, collapse: L.collapse, best: L.best, ultra: L.ultra, orbs: L.orbs, key: L.key, cards: G.lootView() };
  };
  G.lootTouch = () => { const L = loot(); if (L) L.touch = 1; };
  // the clock waits for the ultra-rares' reveal: lootUltraT s for each (at most 3: a Mad Button's two uniques and a divine)
  // before it runs (L.wait; the screen times each pillar as L.wait / L.ultra). A screen whose own reveal takes longer asks
  // for more: G.lootHold(s) (at most lootHoldMax s from now; a touch stops the clock anyway)
  TUNE.lootHoldMax = 8;
  const pillarT = L => (L.ultra ? TUNE.lootUltraT * Math.min(3, L.ultra | 0 || 1) : 0);
  G.lootHold = function (s) { const L = loot(); if (!L || !(s > 0)) return false; L.wait = Math.max(L.wait || 0, Math.min(TUNE.lootHoldMax, +s)); return true; };
  // take card i: worn by who (a hero index, -1 the Warden: the hero the card shows is what a tap passes), stashed (who
  // 'bag', or stash true: a hold); with no who, the hero it suits best if it is an upgrade for anyone, else the bag. A hero
  // who can't wear it (a companion and another class's weapon): the bag. Wearing it offers what that hero took off to
  // the rest of the party (G.wearOn). Emits 'lootTake'(i, card, who, info, view)
  G.lootTake = function (i, who, stash) {
    const S = S_(), L = loot(), h = S.hero;
    if (!L || !h) return false;
    const c = L.cards[i];
    if (!c || c.taken || c.burned || L.taken >= L.pick) return false;
    const g = c.g, it = G.ITEM_BY_ID[g.id];
    const view = G.lootCard(i);
    const before = S.coll[g.id] | 0;
    S.coll[g.id] = before + 1;
    if (g.r === 6) S.st.divine++;
    let first = false;
    if (g.q) { first = !S.uq[g.q]; S.uq[g.q] = (S.uq[g.q] | 0) + 1; S.st.dryQ = 0; if (first && G.feed) G.feed('uq', G.UNIQUES[g.q].name); if (G.first) G.first('uq'); }
    let w;
    if (stash || who === 'bag') w = 'bag';
    else if (who == null) { const bw = G.bestWearer(g); w = bw.up ? bw.who : 'bag'; }
    else w = G.canWear(who, g) ? who : 'bag';
    let info = null;
    if (w !== 'bag') { info = G.wearOn(g, w); if (!info) w = 'bag'; }
    if (w === 'bag') { h.bag.push(g); if (G.bagTrim) G.bagTrim(); G.dirty(); G.recalc(); }
    c.taken = 1; c.who = w; L.taken++;
    if (G.questProgress) G.questProgress('rarity', g.r);
    // (li.it: a unique's carries uq / relic, as the ground's: G.lootEventItem)
    emit('loot', { it: G.lootEventItem ? G.lootEventItem(g, it) : it, v: 0, g, isNew: before === 0, star: false, first }, 'moment');
    emit('lootTake', i, c, w, info, view);
    if (L.taken >= L.pick || L.cards.every(x => x.taken || x.burned)) lootFinish();
    else { prep(L); L.t = 0; emit('lootUpdate', L, G.lootView()); }
    return true;
  };
  // Space / Enter: the highlighted card (the biggest ▲), on the hero it shows; false when no card is ▲
  G.lootTakeBest = function () { const L = loot(); if (!L) return false; prep(L); return L.best >= 0 ? G.lootTake(L.best, L.cards[L.best].who) : false; };
  // the cards nobody took burn into the pouch (a flying '+N' each): 'lootBurn'([{i, v, id, q, r}], total)
  G.lootBurn = function () {
    const L = loot();
    if (!L) return 0;
    let tot = 0;
    const out = [], k = G.EMBERS.card * (G.D.burnEmb || 1);
    L.cards.forEach((c, i) => {
      if (c.taken || c.burned) return;
      c.burned = 1;
      const v = G.pouchAdd(G.itemEmbers(c.g) * k, 'card', L.slot);
      tot += v; out.push({ i, v, id: c.g.id, q: c.g.q || null, r: c.g.r });
    });
    if (out.length) emit('lootBurn', out, tot);
    return tot;
  };
  function lootFinish() {
    const r = runOf(), L = loot();
    if (!L) return;
    G.lootBurn();
    r.loot = null;
    emit('lootDone', L);
    if (r.beat && r.beat.id === 'loot') G.beatDone('loot');
  }
  // the moment resolved for the player: the biggest upgrade(s); with none, a legendary or better (or a unique) into the
  // bag; the rest burn
  G.lootAuto = function () {
    const L = loot();
    if (!L) return false;
    let guard = 0;
    while (loot() === L && L.taken < L.pick && guard++ < 8) {
      let bi = -1, bd = 1e-6;
      L.cards.forEach((c, i) => { if (c.taken || c.burned) return; const bw = G.bestWearer(c.g); if (bw.up && bw.pct > bd) { bd = bw.pct; bi = i; } });
      if (bi >= 0) { G.lootTake(bi, null, false); continue; }
      let ki = -1, kv = 0;
      L.cards.forEach((c, i) => { if (c.taken || c.burned || !(c.g.q || c.g.r >= 4)) return; const v = G.itemEmbers(c.g); if (v > kv) { kv = v; ki = i; } });
      if (ki >= 0) { G.lootTake(ki, 'bag', true); continue; }
      break;
    }
    if (loot() === L) lootFinish();
    return true;
  };
  // nothing worth a look: no upgrade, nothing legendary or better
  const lootDull = L => !L.cards.some(c => c.g.q || c.g.r >= 4 || G.bestWearer(c.g).up);
  G.runBeat({ id: 'loot', order: 10, fallback: 1,
    open(ctx) {
      const L = loot();
      if (!L) return false;
      if (!L.cards.length) { runOf().loot = null; return false; }
      prep(L);
      L.t = 0; L.wait = pillarT(L); L.collapse = lootDull(L) ? 1 : 0;
      emit('lootMoment', L, ctx, G.lootView());
      return true;
    },
    // (real seconds: the hold's tick runs whatever holds the field, at the frame's own time)
    tick(dt) {
      const L = loot();
      if (!L) { G.beatDone('loot'); return; }
      // (an ultra-rare's 1.2-s pillar first: the clock waits for it; and a window over the field (G.uiBusy) stops it)
      if (G.uiBusy && G.uiBusy()) { /* the moment waits under a window */ }
      else if (L.wait > 0) L.wait = Math.max(0, L.wait - dt);
      else if (!L.touch) L.t += dt;
      if (L.collapse && L.t >= TUNE.lootCollapse) { emit('lootCollapse', L); lootFinish(); }
      else if (G.runUI && L.t >= L.T) G.lootAuto();
    },
    auto() { G.lootAuto(); },
    // a reload mid-moment: the banked cards come back with the whole timer
    resume(ctx) {
      const L = loot();
      if (!L) { G.beatDone('loot'); return; }
      prep(L); L.t = 0; L.touch = 0; L.wait = pillarT(L);
      emit('lootMoment', L, ctx, G.lootView());
    },
  });

  // ---------- Camp (DESIGN §5.5): after every lord but the Mad Button, before the doors ----------
  // S.run.camp = { n (1-5), act ('rest'|'temper'|'train' once taken), wares: [{k, price, cur 'gold'|'shards', g?, slot?,
  // sold}], rolls, lock (a ware index kept through a reroll), recruits: [{cls, trait}] (camps with a free seat), hired,
  // t, touch }. One action: Rest (Button and party + G.heat().rest), Temper (+2 enchant on every worn item), Train (+1
  // card now). The market: campOffers wares (+ the Hall's Quartermaster, + D.marketPlus), priced in seconds of income;
  // a reroll costs marketRoll s, x marketRollK each time; one lock. Recruit (Camps 1-3: 3 candidates, 4 with Tavern I;
  // a Cleric among them while the party has no healer). Enchant All (Forge I: G.enchantAll), Reforge (Forge II:
  // G.campReforge(uid)), Extract (G.runExtract). G.campDone() moves on to the doors; with a run UI it does so on its own
  // after campAuto s. Left to the game (no UI, a bot): Rest under 50% health else Temper, the best recruit, what the gold
  // buys, Enchant All.
  Object.assign(TUNE, { campAuto: 30, campOffers: 4, marketRoll: 25, marketRollK: 1.5, temper: 2, reforgeSecs: 60, campMend: 1 });
  G.WARES = {
    item: { w: 20, secs: 90 }, orbs: { w: 14, secs: 60, n: 3 }, potion: { w: 14, secs: 40 }, mend: { w: 14, secs: 75 },
    reroll: { w: 10, secs: 50 }, pip: { w: 8, secs: 300, once: 1 }, key: { w: 8, secs: 150 }, gamble: { w: 12, shards: 1 },
  };
  const camp = () => { const r = runOf(); return r && r.on ? r.camp : null; };
  G.campNow = camp;
  function wareMake(k) {
    const S = S_(), W = G.WARES[k], inc = Math.max(1, G.D.incomeRef || 1);
    const w = { k, cur: W.shards ? 'shards' : 'gold', price: W.shards ? (G.gambleCost ? G.gambleCost() : 30) : Math.ceil(inc * W.secs), sold: 0 };
    if (k === 'item') { const sl = G.SLOTS[Math.floor(G.runRng() * 4)]; w.g = G.gearFor ? G.gearFor(sl, G.rarityCap(), S.hero.cls, S.depth) : null; if (!w.g) return null; }
    if (k === 'gamble') w.slot = G.SLOTS[Math.floor(G.runRng() * 4)];
    return w;
  }
  function wareRoll(c, keep) {
    const r = runOf();
    const n = TUNE.campOffers + hallRank('hf_qm') + (G.D.marketPlus | 0);
    const kinds = Object.keys(G.WARES).filter(k => !(k === 'gamble' && !G.D.gambleWare) && !(k === 'pip' && r.pipBought) && !(keep && keep.k === k));
    const out = keep ? [keep] : [];
    while (out.length < n && kinds.length) {
      const k = kinds.splice(rpick(kinds.map(x => G.WARES[x].w)), 1)[0];
      const w = wareMake(k);
      if (w) out.push(w);
    }
    c.wares = out;
  }
  function recruitsRoll(c) {
    const S = S_(), r = runOf();
    if (S.party.length >= G.partySlots()) { c.recruits = null; return; }
    const n = G.D.recruitN || 3, out = [], cls = G.CLASSES.map(x => x.id), traits = G.TRAIT_IDS.slice();
    const healer = G.ROLES[S.hero.cls] === 'heal' || S.party.some(m => G.ROLES[m.cls] === 'heal');
    // (the season-3 founders: their old companions come back as Veterans at Camp 1 of runs 1-3)
    const fc = S.founders && Array.isArray(S.founders.classes) ? S.founders.classes.filter(x => G.CLASS_BY_ID[x]) : [];
    // (not in the Daily: its candidates are everyone's)
    if (fc.length && c.n === 1 && (r.n | 0) <= 3 && !r.day) out.push({ cls: fc[Math.floor(G.runRng() * fc.length)], trait: 'veteran' });
    if (!healer && !out.some(x => G.ROLES[x.cls] === 'heal')) out.push({ cls: 'cleric', trait: traits[Math.floor(G.runRng() * traits.length)] });
    while (out.length < n) out.push({ cls: cls[Math.floor(G.runRng() * cls.length)], trait: traits[Math.floor(G.runRng() * traits.length)] });
    c.recruits = out.slice(0, n);
  }
  G.campOpen = function (ctx) {
    const r = runOf();
    if (!r || !r.on) return null;
    const c = r.camp = { n: (r.campN | 0) + 1, slot: ctx ? ctx.slot : G.runSlot(), act: null, wares: [], rolls: 0, lock: -1, recruits: null, hired: 0, t: 0, touch: 0,
      // (runflow: what the town has opened here, for the screen: Enchant All (Forge I), Reforge (Forge II), the gamble ware)
      can: { enchant: !!G.D.enchantAll, reforge: !!G.D.reforge, gamble: !!G.D.gambleWare } };
    r.campN = c.n;
    // (a Button broken in the lord's fight mends at the camp, as it would have in the field: 50%, then Rest adds to it;
    // otherwise Rest heals nothing and the camp shows a Button at 0)
    if (TUNE.campMend && R.btnDown > 0 && S_().hero) { R.btnDown = 0; S_().hero.hp = Math.max(S_().hero.hp, (G.D.heroHp || 0) * 0.5); emit('buttonFixed'); }
    // (runflow: the wares and the candidates from the camp's own offers' streams: a Daily's camps are everyone's)
    G.runRngIn('camp:' + c.n + ':0', () => wareRoll(c), true);
    G.runRngIn('recruit:' + c.n, () => recruitsRoll(c));
    G.mendRefill();
    campExtract(c);
    emit('campOpen', c);
    return c;
  };
  // the camp's Extract button (DESIGN §5.5; Camp 4: 'Extract now: N Embers safe, or go for x1.5'): c.extract = { n (the
  // camp), embers (what Extract banks now, x1), fame (what it pays), camp4 (Camp 4 or later: the extract counts toward
  // the ascensions; the 'or go for x1.5' line), win (the pile now if it were a win: x1.5, for the comparison), mul (1),
  // winMul (1.5), zonesToMad, text: [strKey, ...args] (camp_extract4 at Camp 4+, else camp_extract) }. Refreshed after
  // anything the camp does (G.campExtract() for the screen)
  function campExtract(c) {
    const r = runOf();
    if (!c || !r || !r.on) return null;
    const em = G.runEmbers('extract'), win = G.runEmbers('win'), camp4 = (c.n | 0) >= 4 && !r.push;
    c.extract = { n: c.n | 0, embers: em, fame: G.runFame(), camp4, win, mul: G.EMBERS.end.extract, winMul: G.EMBERS.end.win,
      zonesToMad: Math.max(0, SG().final + 1 - (r.cleared | 0)), text: camp4 ? ['camp_extract4', em] : ['camp_extract', em] };
    return c.extract;
  }
  G.campExtract = () => campExtract(camp());
  ['campAct', 'campBuy', 'campRecruit', 'campReforge', 'enchantAll'].forEach(k => G.on(k, () => { const c = camp(); if (c) campExtract(c); }));
  G.campAct = function (k) {
    const S = S_(), r = runOf(), c = camp();
    if (!c || c.act || !['rest', 'temper', 'train'].includes(k)) return false;
    c.act = k;
    if (k === 'rest') { const f = G.heat().rest; if (G.healParty) G.healParty(f); if (G.mendParty) for (const u of G.partyUnits()) if (u.down > 0) G.mendParty(f); }
    else if (k === 'temper') {
      for (const who of [-1].concat(S.party.map((_, i) => i))) for (const sl of G.SLOTS) { const g = G.eqOf(who)[sl]; if (g) g.e = Math.min(G.ENCHANT_MAX, (g.e | 0) + TUNE.temper); }
      G.dirty(); G.recalc();
    } else if (k === 'train') G.cardGive('train');
    emit('campAct', k, c);
    return true;
  };
  // (runflow: what a ware rolls when bought - an orb satchel's orbs, a potion - from the camp's offers' stream)
  G.campBuy = i => { const c = camp(); return c ? G.runRngIn('buy:' + c.n + ':' + c.rolls + ':' + i, () => campBuyIn(i), true) : false; };
  function campBuyIn(i) {
    const S = S_(), r = runOf(), c = camp(), h = S.hero;
    const w = c && c.wares[i];
    if (!w || w.sold) return false;
    if (w.cur === 'shards' ? (h.shards | 0) < w.price : (S.gold || 0) < w.price) return false;
    if (w.k === 'pip' && ((r.pips | 0) >= TUNE.pipCap && (r.pipMax | 0) >= TUNE.pipCap)) return false;
    if (w.k === 'gamble') { if (!G.gamble || !G.gamble(w.slot)) return false; }
    else {
      S.gold -= w.price;
      // (cardsloot: the one gear rule: on the hero it suits best, what they wore offered onward - G.wearOn)
      if (w.k === 'item') { h.bag.push(w.g); const bw = G.bestWearer(w.g); if (bw.up) G.wearOn(w.g, bw.who); else if (G.bagTrim) G.bagTrim(); S.coll[w.g.id] = (S.coll[w.g.id] | 0) + 1; }
      else if (w.k === 'orbs') for (let j = 0; j < G.WARES.orbs.n; j++) { const k = rollOrbId(); h.orbs[k] = (h.orbs[k] | 0) + 1; }
      else if (w.k === 'potion') { if (G.givePotion) G.givePotion(); }
      else if (w.k === 'mend') { r.mend = (r.mend | 0) + 1; emit('mendCharge', r.mend, r.mendMax); }
      else if (w.k === 'reroll') r.rerolls = (r.rerolls | 0) + 1;
      else if (w.k === 'pip') { r.pipBought = 1; r.pipMax = Math.min(TUNE.pipCap, (r.pipMax | 0) + 1); G.pipGain(1); }
      else if (w.k === 'key') { r.keys = (r.keys | 0) + 1; emit('key', r.keys, 'market'); }
    }
    w.sold = 1;
    G.dirty(); G.recalc();
    emit('campBuy', w, i);
    return true;
  }
  G.campRerollCost = () => { const c = camp(); return c ? Math.ceil(Math.max(1, G.D.incomeRef || 1) * TUNE.marketRoll * Math.pow(TUNE.marketRollK, c.rolls)) : 0; };
  G.campReroll = function () {
    const S = S_(), c = camp(), cost = G.campRerollCost();
    if (!c || (S.gold || 0) < cost) return false;
    S.gold -= cost; c.rolls++;
    const keep = c.lock >= 0 ? c.wares[c.lock] : null;
    G.runRngIn('camp:' + c.n + ':' + c.rolls, () => wareRoll(c, keep && !keep.sold ? keep : null), true);
    c.lock = keep && !keep.sold ? 0 : -1;
    emit('campReroll', c);
    return true;
  };
  G.campLock = i => { const c = camp(); if (!c || !c.wares[i]) return false; c.lock = c.lock === i ? -1 : i; return true; };
  G.campRecruit = function (i) {
    const c = camp(), x = c && c.recruits && c.recruits[i];
    // (runflow: the recruit's gear (G.gearFor rolls it on the combat stream) from the camp's offers' stream)
    if (!x || c.hired || !G.runRngIn('recruitGear:' + c.n, () => G.recruit(x.cls, x.trait), true)) return false;
    c.hired = 1;
    emit('campRecruit', x, i);
    return true;
  };
  // Forge II: an item's level comes up to the depth, for reforgeSecs s of income
  G.campReforge = function (u) {
    const S = S_(), c = camp();
    if (!c || !G.D.reforge) return false;
    const all = [S.hero.eq, ...S.party.map(m => m.eq)].flatMap(e => G.SLOTS.map(s => e[s])).concat(S.hero.bag);
    const g = all.find(x => x && x.u === u), cost = Math.ceil(Math.max(1, G.D.incomeRef || 1) * TUNE.reforgeSecs);
    if (!g || g.il >= S.depth || (S.gold || 0) < cost) return false;
    S.gold -= cost; g.il = S.depth;
    G.dirty(); G.recalc();
    emit('campReforge', g);
    return true;
  };
  G.campDone = function () {
    const r = runOf(), c = camp();
    if (!c) return false;
    r.camp = null;
    emit('campDone', c);
    if (r.beat && r.beat.id === 'camp') G.beatDone('camp');
    return true;
  };
  // what the game does with a camp left to it
  G.campAuto = function () {
    const S = S_(), r = runOf(), c = camp();
    if (!c) return false;
    // (4.0, cardsloot: Auto-Run - a camp left to the game at Camp r.autoExtract or later banks the pouch and ends the run)
    if (r.autoExtract > 0 && (c.n | 0) >= r.autoExtract && G.runExtract) { emit('autoExtract', c.n | 0); G.runExtract(); return true; }
    if (!c.act) G.campAct(S.hero.hp < (G.D.heroHp || 1) * 0.5 ? 'rest' : 'temper');
    if (c.recruits && !c.hired) {
      const roles = [S.hero.cls].concat(S.party.map(m => m.cls)).map(k => G.ROLES[k]);
      const want = !roles.includes('heal') ? 'heal' : !roles.includes('tank') ? 'tank' : 'dps';
      let i = c.recruits.findIndex(x => G.ROLES[x.cls] === want);
      if (i < 0) i = 0;
      G.campRecruit(i);
    }
    for (const k of ['pip', 'mend', 'item', 'reroll', 'potion', 'orbs', 'key']) c.wares.forEach((w, i) => { if (w.k === k && !w.sold && (k !== 'item' || G.bestWearer(w.g).up)) G.campBuy(i); });
    if (G.D.enchantAll && G.enchantAll) G.enchantAll();
    if (r.offer) { let g = 0; while (r.offer && g++ < 5) G.cardAuto(); }
    G.campDone();
    return true;
  };
  G.campTouch = () => { const c = camp(); if (c) c.touch = 1; };
  G.runBeat({ id: 'camp', order: 40, fallback: 1,
    open(ctx) { if (!ctx.lord || ctx.final || !ctx.fresh) return false; G.campOpen(ctx); return true; },
    tick(dt) { const c = camp(); if (!c) { G.beatDone('camp'); return; } if (!c.touch && !runOf().offer && !winUp()) c.t += dt; if (G.runUI && c.t >= G.beatAfter()) G.campAuto(); },
    auto() { G.campAuto(); },
    resume() { if (!camp()) G.beatDone('camp'); },
  });

  // ---------- Doors (DESIGN §5.6): after the camp, the next land ----------
  // S.run.doors = { slot (the land slot they open), opts: [{land (realm index), id, mod, tag, cursed, lord, act}], vault
  // (a Key held: a Vault door, a secret land as a detour first) }. 2 doors (3 with the Hall's Third Door) from the act's
  // open lands not yet visited; map mods from the second run on (a Calm mod before); at Heat 8+ one door is cursed (its
  // mod and its reward twice over). The 6th land is always the Void (one door). G.runDoor(i [, vault]) takes one.
  Object.assign(TUNE, { doorsN: 2, vaultLoot: 4 });
  // 4.0 (runflow): the doors of a land slot as data, from a given random stream (the run's 'door:<slot>' stream, or the
  // setup's preview of the next run's first doors: G.runRngPeek). ctx = { route (the lands so far), n (the run's number:
  // map mods from the second run on), cursed (Heat 8+), extra (the Hall's Third Door), first (the first-ever run:
  // Shoreline only, no twist, no prize) }. A door: { land (realm index), id, name, rule, ruleDesc, lord (name), lordSpr,
  // minionSpr, champ (its Land Champion's name), act (ACT BOSS), final (THE MAD BUTTON), mod, tag, cursed }
  function doorDeal(slot, ctx, rnd) {
    const wpick = o => { const ks = Object.keys(o), w = ks.map(k => o[k].w); let t = 0; for (const x of w) t += x; let v = rnd() * t; for (let i = 0; i < w.length; i++) { v -= w[i]; if (v < 0) return ks[i]; } return ks[ks.length - 1]; };
    // (a Push land: any land but the Void, not yet visited)
    const act = slot >= SG().lands ? -1 : SG().actOf[slot], visited = new Set((ctx.route || []).slice(0, slot));
    const voidI = G.REALM_BY_ID.void;
    const pool = act < 0 ? G.REALMS.map((x, i) => i).filter(i => G.REALMS[i].id !== 'void' && G.REALMS[i].act > 0) : (SG().ROUTE[act] || []).map(id => G.REALM_BY_ID[id]);
    let lands = ctx.first ? [G.REALM_BY_ID.shore] : act === 0 ? [voidI] : pool.filter(i => i != null && !visited.has(i) && landOpen(G.REALMS[i].id));
    // (a long Push runs out of new lands: the open ones again, corrupted deeper; never a locked one while any is open)
    if (!lands.length && act < 0) lands = pool.filter(i => landOpen(G.REALMS[i].id));
    if (!lands.length) lands = act < 0 ? pool.slice() : [ctx.route && ctx.route[slot] != null ? ctx.route[slot] : pool[0]];
    // (shuffled by the offers' stream)
    for (let i = lands.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = lands[i]; lands[i] = lands[j]; lands[j] = t; }
    const n = act === 0 || ctx.first ? 1 : TUNE.doorsN + (ctx.extra | 0);
    const plain = act === 0 || ctx.first;
    const opts = lands.slice(0, n).map(i => {
      const R_ = G.REALMS[i], d = slot * SIZE() + SIZE() - 1, C = G.CHAMPS ? G.CHAMPS[i % G.CHAMPS.length] : null;
      const mod = (ctx.n | 0) >= 2 && !plain ? wpick(G.MAP_MODS) : 'calm', tag = !plain ? wpick(G.REWARD_TAGS) : null;
      return { land: i, id: R_.id, name: R_.name, rule: R_.rule || null, ruleDesc: R_.ruleDesc || null, lord: R_.lordName, lordSpr: R_.lord, minionSpr: R_.minion,
        champ: C ? C.name : null, act: SG().actBoss.includes(d), final: d === SG().final, mod, tag, cursed: 0 };
    });
    // Heat 8: one cursed door (its twist and its reward twice over; never a Calm one)
    if (ctx.cursed && opts.length > 1) { const o = opts[opts.length - 1]; o.cursed = 1; let g = 0; while (o.mod === 'calm' && g++ < 20) o.mod = wpick(G.MAP_MODS); }
    return opts;
  }
  const doorCtx = (r, slot) => ({ route: r.route, n: r.n, cursed: !!G.heat().cursed, extra: hallRank('hf_door'),
    first: slot === 0 && (r.n | 0) <= 1 && !r.day && !r.replay });
  G.runDoorsOpen = function (slot) {
    const r = runOf();
    if (!r || !r.on || (slot >= SG().lands && !r.push)) return null;
    const act = slot >= SG().lands ? -1 : SG().actOf[slot];
    const opts = G.runRngIn('door:' + slot, () => doorDeal(slot, doorCtx(r, slot), G.runRng));
    r.doors = { slot, opts, vault: (r.keys | 0) > 0 && act !== 0 ? 1 : 0, t: 0, touch: 0 };
    emit('doorsOpen', r.doors);
    return r.doors;
  };
  // take door i; vault: spend a Key on the Vault first (a secret land, then a loot moment with a legendary floor)
  G.runDoor = function (i, vault) {
    const r = runOf(), D_ = r && r.on && r.doors;
    const o = D_ && D_.opts[i];
    if (!o) return false;
    if (vault && !(D_.vault && (r.keys | 0) > 0)) return false;
    r.doors = null;
    G.runSetLand(D_.slot, o.land, o.mod === 'calm' ? null : o.mod, o.tag);
    (r.cursed = r.cursed || [0, 0, 0, 0, 0, 0])[D_.slot] = o.cursed ? 1 : 0;
    if (vault) {
      r.keys--;
      const kinds = ['vault', 'candy', 'upside'], n = G.D.vaultKinds ? 3 : 2;
      r.vaultGo = kinds[Math.floor(G.runRngIn('vault:' + D_.slot, () => G.runRng()) * n)];
      emit('key', r.keys, 'vault');
    }
    // (a Push land: 'pushLand'(k, land) for the screen: the Tide, the land's pay)
    if (r.push && D_.slot >= SG().lands) emit('pushLand', D_.slot - SG().lands + 1, o);
    emit('door', o, D_.slot, !!vault);
    if (r.beat && r.beat.id === 'doors') G.beatDone('doors');
    return true;
  };
  G.doorsTouch = () => { const r = runOf(); if (r && r.doors) r.doors.touch = 1; };
  // an Elite lord (its land's map mod): +1 affix on that land's lord (game.js bossAffixes asks; cursed: +2)
  G.bossAffixAdd = G.bossAffixAdd || (d => {
    const r = runOf();
    if (!r || !r.on || !G.isLord(d)) return 0;
    const sl = G.runSlot(d), M = G.MAP_MODS && G.MAP_MODS[r.mods[sl]];
    return M && M.affix ? M.affix * (r.cursed && r.cursed[sl] ? 2 : 1) : 0;
  });
  G.runBeat({ id: 'doors', order: 50, fallback: 1,
    open(ctx) { if (!ctx.lord || ctx.final || !ctx.fresh || (ctx.slot + 1 >= SG().lands && !runOf().push)) return false; return !!G.runDoorsOpen(ctx.slot + 1); },
    tick(dt) { const D_ = runOf().doors; if (!D_) { G.beatDone('doors'); return; } if (!D_.touch && !winUp()) D_.t += dt; if (G.runUI && D_.t >= G.beatAfter()) G.runDoor(0); },
    auto() { if (runOf().doors) G.runDoor(0); },
    resume() { if (!runOf().doors) G.beatDone('doors'); },
  });
  // a new land: what its reward tag brings (an Elite's champion, a Treasure chest, a Power shrine; a Merchant or
  // something strange in its second zone), and the Vault's detour
  function landEnter() {
    const S = S_(), r = runOf();
    if (!r || !r.on) return;
    const slot = G.runSlot(), tag = r.tags[slot];
    r.landT = { slot, mid: 0 };
    champDecide(slot);
    if (tag === 'treasure' && G.spawnChest) G.spawnChest(Math.max(2, G.rarityCap() - 1), 'golden', false, false, true);
    if (tag === 'shrine' && G.spawnShrine && !R.shrine) G.spawnShrine('power');
    if (tag === 'elite') r.eliteAt = (r.field || 0) + 8;
  }
  G.on('realm', () => { if (on()) landEnter(); });

  // ---------- Land Champions by Heat (DESIGN §5.8; §6.3 rules 1 and 9) ----------
  // champions.js brings a Land Champion into every land it can. In a Siege at Heat 0 a land has one champLand of the time
  // (an Elite door's always: G.forceChamp at r.eliteAt); from Heat 1 every land (G.heat().champ). A land drawn without one
  // is entered in champions.js's own book of the lands whose champion came (S.champRun[slot]; S.run.noChamp[slot] for the
  // UI and the tests), by the offers' stream (a Daily's lands are the same for everyone).
  // Heat 9 (G.heat().escort): an act boss brings its Land Champion: when the act boss's bar fills, the champion comes first
  // (champions.js holds a ready boss while a champion stands) - 'champEscort'(champ)
  Object.assign(TUNE, { champLand: 0.4 });
  function champDecide(slot) {
    const S = S_(), r = runOf();
    if (!r || !r.on || G.heat().champ || r.tags[slot] === 'elite') return;
    // (runflow: from the land's own offers' stream: a Daily's lands have their champions for everyone)
    if (G.runRngIn('champ:' + slot, () => G.runRng()) < TUNE.champLand) return;
    if (!S.champRun || typeof S.champRun !== 'object') S.champRun = {};
    S.champRun[slot] = 1; (r.noChamp = r.noChamp || {})[slot] = 1;
  }
  G.runChampLand = slot => { const r = runOf(); return !!(r && r.on && !(r.noChamp && r.noChamp[slot == null ? G.runSlot() : slot])); };
  G.on('bossReady', () => {
    const S = S_(), r = runOf();
    if (!r || !r.on || !G.heat().escort || G.bossKind(S.depth) !== 'act' || R.champ || !G.forceChamp) return;
    const slot = G.runSlot();
    if ((r.escort = r.escort || {})[slot]) return;
    r.escort[slot] = 1;
    const c = G.forceChamp();
    if (c) emit('champEscort', c);
  });
  // the Vault's secret land (rare.js keeps it in the runtime R.rare only): the land object itself is marked as the Vault's
  // (land.vault), so only ITS end pays the Vault's loot moment - never a later Mystery door's or random secret land's
  // (4.0 fix1: a stale S.run.vaultOn after a reload paid a free legendary-floor moment to the next secret land)
  function vaultEnter(k) {
    const r = runOf();
    r.vaultOn = k;
    const land = G.forceRare ? G.forceRare('land', k) : null;
    if (land) land.vault = 1; else r.vaultOn = null;
    return land;
  }
  G.on('marchEnd', () => {
    const r = runOf();
    if (!r || !r.on) return;
    if (r.vaultGo && G.forceRare) { const k = r.vaultGo; r.vaultGo = null; vaultEnter(k); }
  });
  // a reload inside the Vault: the secret land lived in the runtime, so the detour the Key paid for starts over (its full
  // time; the Key is not refunded, the Vault is). 'vaultResume'(kind)
  G.on('runResume', r => {
    if (!r || !r.on || !r.vaultOn || (R.rare && R.rare.land) || !G.forceRare) return;
    const k = r.vaultOn;
    if (vaultEnter(k)) emit('vaultResume', k);
  });
  G.on('rareLandEnd', (land, why) => {
    const S = S_(), r = runOf();
    if (!r || !r.on || !r.vaultOn) return;
    if (!(land && land.vault)) return; // not the Vault's land: its flag stays for the Vault's own end
    r.vaultOn = null;
    if (why !== 'time') return;
    // the Vault's own loot moment: 4 cards, a legendary floor (runflow: from the offers' stream 'vaultLoot:<slot>', items too)
    const il = S.depth, cap = Math.max(4, G.rarityCap()), cards = [];
    G.runRngIn('vaultLoot:' + G.runSlot(), () => {
      for (let i = 0; i < TUNE.vaultLoot; i++) { const it = baseOf(Math.min(6, 4 + (G.runRng() < 0.3 ? 1 : 0)), null, null) || baseOf(cap, null, null); if (it) cards.push({ g: G.makeGear(it.id, il, { rng: G.runRng }), tag: 'V', taken: 0, burned: 0 }); }
    });
    r.loot = { d: S.depth, il, kind: 'vault', lord: false, slot: G.runSlot(), cards, pick: 1, taken: 0, t: 0, T: TUNE.lootT, touch: 0, collapse: 0, orbs: {}, key: 0 };
    emit('lootBank', r.loot);
    runBeatsOnly(['loot'], { d: S.depth, lord: false, kind: 'vault', act: false, final: false, slot: G.runSlot(), fresh: false, vault: 1 });
  });
  // the Elite door's champion, and the land's midpoint (a Merchant, a Mystery)
  G.on('champKill', () => {
    const r = runOf();
    if (!r || !r.on) return;
    const slot = G.runSlot();
    if (r.tags[slot] === 'elite' && !(r.eliteDone && r.eliteDone[slot])) {
      (r.eliteDone = r.eliteDone || {})[slot] = 1;
      const k = r.cursed && r.cursed[slot] ? 2 : 1;
      r.keys = (r.keys | 0) + k; r.lootLeg = (r.lootLeg | 0) + 1;
      emit('key', r.keys, 'elite');
    }
  });

  // ---------- Relics (DESIGN §5.7): a choice of 3 after each act boss, onto the belt ----------
  // S.run.relicOffer = { ids, t, touch }: from the 8 relic rules (weight 1; G.relicOpen(id): the Deeds', the meta's) and
  // the unique rules (weight 3; G.uqOpen), never one already on (worn or on the belt), at least one of a school owned.
  // G.relicPick(i [, replace]): onto the belt (S.run.belt, merged into d.uq: every rule works as worn); a full belt
  // needs the index of the one it replaces. Recorded in the Codex at the run's end.
  Object.assign(TUNE, { relicN: 3, relicW: 1, relicUqW: 3 });
  // (runflow: each relic choice from its own offers' stream, 'relic:<n>')
  G.relicOptions = function () {
    const r = runOf();
    if (!r || !r.on) return [];
    return G.runRngIn('relic:' + ((r.beltLog || []).length + (r.relicSkips | 0)), relicDeal);
  };
  function relicDeal() {
    const S = S_(), r = runOf(), have = new Set(Object.keys(G.D.uq || {}).concat(r.belt || []));
    const pool = [];
    // (runflow: the Deeds' unlocks: G.relicOpen, or the meta's G.unlocked('relic', id))
    for (const id of G.RELIC_IDS || []) if (!have.has(id) && (!G.relicOpen || G.relicOpen(id)) && G.unlocked('relic', id) !== false) pool.push({ id, w: TUNE.relicW, relic: 1 });
    for (const q of G.UNIQUE_IDS) if (!G.UNIQUES[q].relic && !have.has(q) && (!G.uqOpen || G.uqOpen(q, 99))) pool.push({ id: q, w: TUNE.relicUqW, relic: 0 });
    const out = [];
    while (out.length < TUNE.relicN && pool.length) out.push(pool.splice(rpick(pool.map(x => x.w)), 1)[0].id);
    // (at least one of a school the build owns)
    const schools = new Set(G.cardSlotsUsed().map(k => G.PERK_SCHOOL[k]));
    const sch = id => G.UQ_THEME && G.UQ_THEME[id] && schools.has(G.PERK_SCHOOL[G.UQ_THEME[id]]);
    if (schools.size && out.length && !out.some(sch)) { const alt = pool.filter(x => sch(x.id)); if (alt.length) out[out.length - 1] = alt[Math.floor(G.runRng() * alt.length)].id; }
    return out;
  }
  G.relicPick = function (i, replace) {
    const r = runOf(), o = r && r.on && r.relicOffer;
    if (!o) return false;
    const id = typeof i === 'number' ? o.ids[i] : o.ids.includes(i) ? i : null;
    if (!id) return false;
    if (r.belt.length >= r.beltMax) { if (!(replace >= 0 && replace < r.belt.length)) return false; r.belt.splice(replace, 1); }
    r.belt.push(id); r.relicOffer = null;
    (r.beltLog = r.beltLog || []).push(id);
    G.dirty(); G.recalc();
    emit('relicPick', id, r.belt.slice());
    if (r.beat && r.beat.id === 'relic') G.beatDone('relic');
    return true;
  };
  G.relicSkip = function () { const r = runOf(); if (!r || !r.relicOffer) return false; r.relicOffer = null; r.relicSkips = (r.relicSkips | 0) + 1; emit('relicSkip'); if (r.beat && r.beat.id === 'relic') G.beatDone('relic'); return true; };
  G.relicTouch = () => { const r = runOf(); if (r && r.relicOffer) r.relicOffer.touch = 1; };
  G.runBeat({ id: 'relic', order: 30, fallback: 1,
    open(ctx) {
      const r = runOf();
      if (!(ctx.act && ctx.fresh) && !ctx.pushRelic) return false;
      const ids = G.relicOptions();
      if (!ids.length) return false;
      r.relicOffer = { ids, t: 0, touch: 0 };
      emit('relicOffer', r.relicOffer, ctx);
      return true;
    },
    // (runflow: left untouched, the first relic goes on the belt; a full belt is kept as it is - a timeout never throws
    // away a relic the player chose)
    tick(dt) { const o = runOf().relicOffer; if (!o) { G.beatDone('relic'); return; } if (!o.touch && !winUp()) o.t += dt; if (G.runUI && o.t >= G.beatAfter() && !G.relicPick(0)) G.relicSkip(); },
    auto() { const r = runOf(); if (r.relicOffer && !G.relicPick(0, r.belt.length >= r.beltMax ? 0 : undefined)) G.relicSkip(); },
    resume() { if (!runOf().relicOffer) G.beatDone('relic'); },
  });

  // ---------- Fame and the pouch ----------
  function fameAdd(k, v) { const r = runOf(); if (!r || !r.on || !(v > 0)) return; r.fame[k] = (r.fame[k] || 0) + v; emit('runFame', k, v); }
  // other streams' Fame lines (a Push land +30, the Daily +50...)
  G.runFameAdd = fameAdd;
  // Embers into the run's pouch (a boss kill, the loot moment's unpicked cards at half their item value...)
  // (slot: the land it was earned in, default the one the party stands in: a Swift or No Mending land pays its +30%/+50%)
  G.pouchAdd = function (n, why, slot) {
    const r = runOf();
    if (!r || !r.on || !(n > 0)) return 0;
    const sl = slot != null ? slot : G.runSlot(), M = G.MAP_MODS && G.MAP_MODS[r.mods[sl]];
    if (M && M.emb) n *= 1 + M.emb * (r.cursed && r.cursed[sl] ? 2 : 1);
    n *= pushMul(sl);
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
    // (a zone fought again after a wipe's push-back pays nothing twice: no Fame, Embers, card or loot moment again)
    r.fresh = b.d >= (r.cleared | 0) ? 1 : 0;
    if (r.fresh) {
      r.cleared = b.d + 1;
      const slot = G.runSlot(b.d), pk = pushMul(slot);
      fameAdd('zones', G.FAME.zone(b.d) * pk);
      if (b.lord) { r.lords++; fameAdd('lords', G.FAME.lord * pk); }
      if (kind === 'act') { r.acts++; fameAdd('acts', G.FAME.act); }
      // a Push land: +30 Fame (x its k), and a relic choice every second one
      if (b.lord && r.push) { r.pushK = slot - SG().lands + 1; fameAdd('push', G.FAME.push * pk); }
      // a Pact on this land is settled at its lord (the Hunt: +1 Key; Blood's loot is the loot moment's)
      if (b.lord && r.pact && r.pact.slot === slot) { if (r.pact.id === 'hunt') { r.keys = (r.keys | 0) + 1; emit('key', r.keys, 'pact'); } emit('pactDone', r.pact); r.pact = null; }
      // (the Star Chart's Ember Flow: boss Embers +10% a level)
      G.pouchAdd((G.EMBERS.kill[kind] || G.EMBERS.kill.boss) * (G.D.bossEmbers || 1), kind, G.runSlot(b.d));
      // a lord gives a pip back; a new land brings its Mend charges
      if (b.lord) { G.pipGain(1); G.mendRefill(); }
      bestRun(b);
    }
    if (kind === 'final') r.won = 1;
    // a keepsake attunes: its item level is the run's depth after every boss (DESIGN §4.7)
    for (const who of [-1].concat((S.party || []).map((_, i) => i))) for (const sl of G.SLOTS) { const g = G.eqOf(who)[sl]; if (g && g.att) g.il = Math.max(g.il | 0, S.depth); }
  };
  // the record run: the deepest (at the highest Heat) a player has gone, with the party's gear there (the ladder's 'power')
  function bestRun(b) {
    const S = S_(), r = runOf(), cur = S.rec && S.rec.bestRun;
    const depth = r.cleared | 0, heat = r.heat | 0;
    if (cur && (cur.heat > heat || (cur.heat === heat && cur.depth >= depth))) return;
    let gear = null, power = 0;
    try { gear = G.gearSnapshot ? G.gearSnapshot() : null; power = gear && G.ladderPower ? G.ladderPower({ gear, cls: S.hero.cls, lvl: S.hero.lvl }) : 0; } catch (e) { gear = null; }
    S.rec.bestRun = { depth, heat, cls: S.hero.cls, btn: r.btn, lvl: S.hero.lvl, power, gear, at: Date.now(), n: r.n };
  }
  // what the run would pay in Fame if it ended now (a fall never costs Fame): for the 3.x Ascend tab and the HUD
  function fameNow(r, kind) {
    const S = S_(), lines = [];
    for (const k of ['zones', 'lords', 'acts', 'push', 'daily']) if (r.fame[k] > 0) lines.push({ k, v: r.fame[k] });
    if (kind === 'win' && !r.push) {
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
    // (Museum V: item Embers +10%)
    const add = (g, who) => { if (!g) return; const v = G.itemEmbers(g) * (G.D.itemEmb || 1); items.push({ id: g.id, q: g.q || null, r: g.r, il: g.il | 0, e: g.e | 0, who, v: Math.round(v * 10) / 10 }); };
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
    // (in a Push the win's pile is banked: only what was found since burns, with the Push's pouch)
    const base = (r.push ? Math.max(0, f.total - (r.pushFur0 || 0)) : f.total) + r.pouch;
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
    R.lastStand = null; R.doomAt = null; R.ward = 0; R.cine = 0; R.zoneT = 0; R.runRng = null; R.rngS = null; R.rngKey = null; R.dpsAvg = null;
    // (the finale's crowd cap, if the run ended inside it: the page's own mobMax back)
    finaleCrowdOff();
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
  G.codexCap = G.codexCap || (() => G.D.codexCap || 2);
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
    // (the caller's own first land (the setup screen's door) is honoured; one inherited from the last setup only when this
    // run's doors offer it)
    const firstAsked = setup && setup.first ? setup.first : null, doorAsked = setup && setup.door != null ? setup.door | 0 : null;
    setup = Object.assign({ btn: 'classic', cls: null, heat: 0, keeps: [], first: null }, last, { day: '', seed: null, replay: 0 }, setup || {});
    // (an ordinary run takes the seed the setup screen previewed its first doors with: S.nextSeed, G.setupOptions)
    const seeded = setup.seed != null;
    if (!seeded && !setup.day && S.nextSeed != null) setup.seed = S.nextSeed >>> 0;
    S.nextSeed = null;
    // (4.0 meta: a locked class (the Deeds', G.classOpen) is refused too: the setup screen offers G.setupOptions().classes, so only
    // a bot or an odd path asks for one; the Daily Siege's class is its own, open or not)
    const clsOk = c => !!G.CLASS_BY_ID[c] && (!!setup.day || !G.classOpen || G.classOpen(c));
    if (!clsOk(setup.cls)) setup.cls = (S.hero && clsOk(S.hero.cls) && S.hero.cls) || (clsOk(last.cls) && last.cls) || 'knight';
    // (the Daily Siege is fixed at its own Heat, open or not; no keepsakes)
    setup.heat = setup.day ? clamp(setup.heat | 0, 0, G.TORMENT_MAX) : clamp(setup.heat | 0, 0, G.tormentMax());
    if (setup.day) setup.keeps = [];
    resetRun(S);
    S.st.sieges = (S.st.sieges || 0) + 1;
    const r = S.run = newRun(setup, S.st.sieges);
    r.route = defaultRoute(setup.first);
    S.torment = r.heat;
    // the first land (DESIGN §2.1: 2 doors from Act I's pool, the first-ever run Shoreline): its doors from the run's
    // 'door:0' stream (the setup previewed the same ones), the land asked for (or the door index asked for), its map mod
    // and reward tag
    {
      const fd = G.runRngIn('door:0', () => doorDeal(0, doorCtx(r, 0), G.runRng));
      let o = doorAsked != null && fd[doorAsked] ? fd[doorAsked] : fd.find(x => x.id === (firstAsked || setup.first));
      if (!o && firstAsked && !seeded && G.REALM_BY_ID[firstAsked] != null && G.REALMS[G.REALM_BY_ID[firstAsked]].act === 1) o = Object.assign({}, fd[0], { land: G.REALM_BY_ID[firstAsked], id: firstAsked });
      o = o || fd[0];
      if (o) { r.route[0] = o.land; r.mods[0] = o.mod && o.mod !== 'calm' ? o.mod : null; r.tags[0] = o.tag || null; (r.cursed = [0, 0, 0, 0, 0, 0])[0] = o.cursed ? 1 : 0; r.firstDoors = fd.map(x => x.id); }
      // (the rest of the default route stays clear of the first land)
      const used = new Set([r.route[0]]);
      for (let k = 1; k < r.route.length; k++) if (used.has(r.route[k])) { const act = SG().actOf[k], alt = (SG().ROUTE[act] || []).map(id => G.REALM_BY_ID[id]).find(i => !used.has(i) && landOpen(G.REALMS[i].id)); if (alt != null) r.route[k] = alt; used.add(r.route[k]); } else used.add(r.route[k]);
    }
    // (AGAIN repeats an ordinary setup, never the Daily)
    if (!setup.day) S.lastSetup = { btn: r.btn, cls: setup.cls, heat: r.heat, keeps: r.keeps.slice(), first: G.REALMS[r.route[0]] ? G.REALMS[r.route[0]].id : setup.first || null };
    else {
      const ds = S.dailySiege && S.dailySiege.day === setup.day ? S.dailySiege : (S.dailySiege = { day: setup.day, tries: 0 });
      r.ranked = ds.tries === 0 ? 1 : 0; ds.tries++;
    }
    const T = G.heat();
    r.pipMax = T.pips || TUNE.pips; r.pips = r.pipMax;
    // the Hall of Fame's run knobs: Second Wind (+1 pip, not at Heat 10), Reroll, Banish, Relic Belt
    if (!T.pips) r.pipMax += hallRank('hf_wind');
    r.rerolls += hallRank('hf_reroll'); r.banish += hallRank('hf_banish'); r.beltMax += hallRank('hf_belt');
    // the Warden: the class's starter weapon at item level 0 (and a welcome pack of Horde on the field)
    G.chooseClass(setup.cls);
    // the town's part (DESIGN §4.5): the Alchemist's potions and its Mend charge, the Tavern V companion; the keepsakes
    G.dirty(); G.recalc();
    r.mendBonus = G.D.mendBonus | 0;
    for (let i = 0; i < (G.D.startPots | 0); i++) if (G.givePotion) G.givePotion();
    if (G.D.startAlly) G.runRngIn('ally', () => { const cl = G.CLASSES.map(c => c.id), tr = G.TRAIT_IDS || []; G.recruit(cl[Math.floor(G.runRng() * cl.length)], tr[Math.floor(G.runRng() * tr.length)]); }, true);
    keepsakes(r);
    // (land 1 is entered now: its Land Champion drawn, and its door's reward tag delivered - the Treasure door's golden
    // chest, the Shrine door's Power shrine, the Elite door's champion, the Merchant's / Mystery's mid-land visitor - as
    // every later land's is at its march. 4.0 fix1: runStart never emits 'realm', so the first door's prize was shown at
    // setup and never paid)
    landEnter();
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
  // the keepsakes (DESIGN §4.7): up to G.keepSlots() Codex entries (Museum I, the Hall's Heirloom Shelf). A unique starts
  // worn by the Warden at item level 0 and attunes (g.att: its level follows the run's depth after each boss; its rarity
  // counts at most the run's cap until legendary opens); a relic puts its rule on the belt
  G.keepSlots = () => (G.D.keepSlots | 0) + hallRank('hf_keep');
  function keepsakes(r) {
    const S = S_(), h = S.hero;
    r.keeps = (r.keeps || []).filter(q => S.codex && S.codex[q] && G.UNIQUES[q]).slice(0, G.keepSlots());
    for (const q of r.keeps) {
      if (G.UNIQUES[q].relic) { if (r.belt.length < r.beltMax && !r.belt.includes(q)) r.belt.push(q); continue; }
      const g = G.makeUnique(q, 0);
      g.att = 1; g.keep = 1;
      const sl = G.slotOf(g.id), C = G.CLASS_BY_ID[h.cls];
      h.bag.push(g);
      if (sl !== 'weapon' || C.weapons.includes(G.ITEM_TYPE[g.id])) G.equip(g, true, -1);
    }
    G.dirty(); G.recalc();
  }
  // the Run Setup screen's choices (DESIGN §2.1): Buttons (G.BUTTONS when the Buttons module has them, else Classic), Warden
  // classes (G.classOpen(id): the Deeds'; else Knight, Archer, Wizard + the founders' classes), Heat 0..heatWon+1,
  // keepsakes (the Codex) and their slots, the first land's 2 doors (Act I's open lands; the first-ever run: Shoreline only),
  // and the last setup (AGAIN)
  // (runflow: the first land's doors are the next run's own: dealt from S.nextSeed, the seed G.runStart will use, so what the
  // setup shows is what the run gets - map mod and reward tag included. firstLands: their land ids (the 3.x shape);
  // firstDoors: the doors as G.runDoorsOpen gives them. o.heat: the Heat on the dial (Heat 8 curses a door))
  // (o.seed: another seed's - the Daily's (G.dailySetup().seed) or a code's (G.runParseCode(code).seed): G.runStart with
  // that seed and setup.door / setup.first takes one of these)
  G.firstDoors = function (o) {
    const S = S_();
    if (S.run && S.run.on) return [];
    o = o || {};
    const own = o.seed == null;
    if (own && S.nextSeed == null) S.nextSeed = Math.floor(G.rng() * 4294967296) >>> 0;
    const heat = o.heat != null ? o.heat | 0 : (S.lastSetup && S.lastSetup.heat) | 0;
    const row = G.heatInfo ? G.heatInfo(Math.max(0, Math.min(G.TORMENT_MAX || 10, heat))).row : null;
    const n = (S.st.sieges | 0) + 1;
    return doorDeal(0, { route: [], n, cursed: !!(row && row.cursed), extra: hallRank('hf_door'), first: own && n <= 1 }, G.runRngPeek(own ? S.nextSeed : o.seed >>> 0, 'door:0'));
  };
  G.setupOptions = function (o) {
    const S = S_(), fc = (S.founders && S.founders.classes) || [];
    const btns = G.BUTTONS ? (Array.isArray(G.BUTTONS) ? G.BUTTONS.map(b => b.id) : Object.keys(G.BUTTONS)).filter(id => !G.btnOpen || G.btnOpen(id)) : ['classic'];
    const classes = G.CLASSES.map(c => c.id).filter(id => (G.classOpen ? G.classOpen(id) : ['knight', 'archer', 'wizard'].includes(id) || fc.includes(id)));
    const doors = G.firstDoors(o);
    return { buttons: btns, classes, heat: { max: G.tormentMax(), won: S.heatWon }, keepSlots: G.keepSlots(),
      keepsakes: Object.keys(S.codex || {}).filter(q => G.UNIQUES[q]).map(q => ({ q, rank: S.codex[q].rank | 0, relic: S.codex[q].relic ? 1 : 0 })),
      firstLands: doors.map(x => x.id), firstDoors: doors, seed: S.nextSeed, last: S.lastSetup || null, daily: !!G.D.daily };
  };
  // AGAIN: the last setup (runflow: its first land only when this run's doors offer it again - runStart's inherited
  // choice; a first land the caller names is the caller's)
  G.runAgain = setup => { const s = Object.assign({}, S_().lastSetup || {}, setup || {}); if (!(setup && setup.first)) delete s.first; return G.runStart(s); };
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
  // (o.door: which of the day's first doors, G.firstDoors({seed: G.dailySetup(day).seed, heat: 2}); default the first)
  G.runDaily = (day, o) => G.runStart(Object.assign(G.dailySetup(day), o && o.door != null ? { door: o.door | 0 } : {}));
  // the camp's Extract (the camp stream's button): bank the Embers at x1
  G.runExtract = () => (on() ? G.runEnd('extract') : null);
  G.runAbandon = () => (on() ? G.runEnd(S_().fallen ? 'fall' : 'abandon') : null);

  // ---------- End ----------
  // the run's books closed for an end kind: the summary (emitted as 'runEnding' first, so the meta can fill its unlocks),
  // then the pay (Fame, Embers) and the records (wins, Heat, stickers, the best payout for the Barracks)
  function settle(r, kind) {
    const S = S_();
    if (kind === 'win') r.won = 1;
    // the Daily's first attempt pays its Fame (and Gems below), however it ends
    if (r.day && r.ranked && !r.fame.daily) fameAdd('daily', G.DAILY_SIEGE.fame);
    const fame = fameNow(r, kind), embers = embersNow(r, kind);
    const h = S.hero, perks = Object.entries(h.perks || {}).filter(([k]) => !k.startsWith('evo_')).sort((a, b) => b[1] - a[1]);
    const codex = [];
    for (const q in S.uq || {}) if ((S.uq[q] | 0) > (r.uq0[q] | 0)) codex.push({ q, isNew: !r.uq0[q], n: S.uq[q] | 0, relic: 0 });
    const rn = (S.rec && S.rec.relicN) || {};
    for (const q in rn) if ((rn[q] | 0) > (r.relic0[q] | 0)) codex.push({ q, isNew: !r.relic0[q], n: rn[q] | 0, relic: 1 });
    // (a rule taken onto the belt counts as touched: a relic's first pick becomes a keepsake option)
    for (const q of r.beltLog || []) if (!codex.some(c => c.q === q)) { const rel = !!(G.UNIQUES[q] && G.UNIQUES[q].relic); codex.push({ q, isNew: !(S.codex && S.codex[q]), n: 1, relic: rel ? 1 : 0, belt: 1 }); }
    const sum = {
      kind, win: kind === 'win', won: r.won ? 1 : 0, push: r.push ? { lands: r.pushK | 0, bank: r.pushBank || null } : null,
      n: r.n, id: r.id, seed: r.seed, code: G.runCode(r), day: r.day, btn: r.btn, cls: h.cls, heat: r.heat,
      assisted: r.assisted, conts: r.conts, depth: S.depth, maxDepth: S.maxDepth | 0, cleared: r.cleared | 0, lords: r.lords, acts: r.acts,
      route: r.route.slice(), land: (G.runLand(S.depth) || {}).id || '', secs: Math.round(r.secs), field: Math.round(r.field), par: G.runPace(),
      lvl: h.lvl, party: (S.party || []).map(m => m.cls), cards: perks.slice(0, 3).map(([k, v]) => ({ id: k, n: v })), cardsN: r.cards | 0,
      evos: Object.keys(h.perks || {}).filter(k => k.startsWith('evo_')).map(k => k.slice(4)), belt: (r.belt || []).slice(),
      pips: r.pips, pipMax: r.pipMax, wipes: r.wipes | 0, keeps: r.keeps.slice(), golden: r.golden | 0, shrines: r.shrineN | 0, replay: r.replay ? 1 : 0,
      fame, embers, cause: kind === 'fall' ? r.cause || 'overrun' : kind === 'abandon' ? 'abandon' : null, nearMiss: nearMiss(r, kind),
      // the meta fills these at 'runEnding' (Deeds done, content unlocked, the next unlock and its progress)
      unlocked: [], next: [], deeds: r.deeds.slice(), codex, sticker: kind === 'win' && fame.lines.some(l => l.k === 'sticker'), at: Date.now(),
    };
    emit('runEnding', sum, r);
    if (r.day && !r.dailyPaid) {
      r.dailyPaid = 1;
      sum.daily = { day: r.day, zones: r.cleared | 0, secs: Math.round(r.secs), btn: r.btn, cls: h.cls, heat: r.heat, seed: r.seed, assisted: r.assisted, ranked: r.ranked, kind };
      if (r.ranked && G.addGems) G.addGems(G.DAILY_SIEGE.gems, 'dailySiege');
    }
    // pay: Fame (a fall never costs it), the Embers
    S.fame = (S.fame || 0) + fame.total; S.fameTotal = (S.fameTotal || 0) + fame.total;
    G.addEmbers(embers.total, 'run');
    S.rec.bestPay = Math.max(S.rec.bestPay || 0, embers.total);
    // records
    S.st.sieges = Math.max(S.st.sieges || 0, r.n);
    if (kind === 'fall' && !r.won) S.st.deaths = (S.st.deaths || 0) + 1;
    if (kind === 'win') S.st.siegeWins = (S.st.siegeWins || 0) + 1;
    if (kind === 'extract') S.st.extracts = (S.st.extracts || 0) + 1;
    // (asc_1/5/25 count wins and the extracts made at Camp 4 or later: a land-1 extract can't farm them)
    if (kind === 'win' || (kind === 'extract' && !r.won && (r.cleared | 0) >= 4 * SIZE())) S.ascensions = (S.ascensions || 0) + 1;
    if (kind === 'win' && !r.assisted) {
      if (r.heat > (S.heatWon == null ? -1 : S.heatWon)) {
        S.heatWon = r.heat; sum.heatOpen = Math.min(G.TORMENT_MAX, r.heat + 1);
        if (r.heat < G.TORMENT_MAX) sum.unlocked.push({ kind: 'heat', n: sum.heatOpen });
      }
      const stk = S.heatStk[r.btn];
      if (!(stk != null && stk >= r.heat)) S.heatStk[r.btn] = r.heat;
      // (runflow, DESIGN §5.9: a win under par: the 'Swift' sticker for this Button at this Heat; S.swiftStk {btn: best Heat})
      if (fame.lines.some(l => l.k === 'par')) {
        sum.swift = 1;
        const sw = (S.swiftStk = S.swiftStk && typeof S.swiftStk === 'object' ? S.swiftStk : {});
        if (!(sw[r.btn] != null && sw[r.btn] >= r.heat)) { sw[r.btn] = r.heat; sum.unlocked.push({ kind: 'swift', btn: r.btn, heat: r.heat }); }
      }
    }
    return sum;
  }
  G.runEnd = function (kind) {
    const S = S_(), r = runOf();
    if (!r || !r.on) return null;
    if (!G.EMBERS.end[kind]) kind = 'abandon';
    if (S.fallen && kind === 'abandon') kind = 'fall';
    // (a Push is never 'won' twice: its end is a fall or a return)
    if (r.push && kind === 'win') kind = 'extract';
    S.fallen = null;
    r.pushAsk = null;
    // a loot moment still open: its cards burn as if left (the pouch); a card on screen goes unpicked
    if (r.loot) { G.lootBurn(); r.loot = null; }
    // loot still on the ground goes into the bag first: it burns with the rest
    if (G.pickupAll) G.pickupAll();
    const sum = settle(r, kind), h = S.hero;
    // the Hall of the Fallen: the last 12 Wardens (wins get gold plaques)
    S.fallen12 = (S.fallen12 || []).concat([{ n: r.n, cls: h.cls, btn: r.btn, heat: r.heat, land: sum.land, depth: S.depth, cleared: r.cleared | 0,
      kind, cause: sum.cause, cards: sum.cards.map(c => c.id), keep: r.keeps[0] || null, win: r.won ? 1 : 0, at: sum.at }]).slice(-12);
    // the next goals the summary shows (after the meta's own at 'runEnding'): the cheapest Hall of Fame rank and town level
    // not yet owned, with what the player has toward them
    {
      const hn = G.LEGACY.filter(l => (S.legacy[l.id] | 0) < l.max).map(l => ({ l, c: G.legacyCost(l) })).sort((a, b) => a.c - b.c)[0];
      if (hn) sum.next.push({ kind: 'hall', id: hn.l.id, name: hn.l.name, rank: (S.legacy[hn.l.id] | 0) + 1, have: Math.floor(S.fame), need: hn.c });
      const bn = (G.BLD || []).filter(b => G.bldLvl(b.id) < G.BLD_MAX).map(b => ({ id: b.id, c: G.bldCost(b.id) })).sort((a, b) => a.c - b.c)[0];
      if (bn) sum.next.push({ kind: 'town', id: bn.id, lvl: G.bldLvl(bn.id) + 1, have: Math.floor(S.embers), need: bn.c });
    }
    // the Codex: every unique and relic touched this run, even on a fall (a duplicate ranks it up)
    for (const c of sum.codex) codexAdd(S, c.q, c.belt ? 1 : c.n - ((c.relic ? r.relic0 : r.uq0)[c.q] | 0), c.relic);
    S.lastRun = sum;
    // the full reset (party, Warden, gear, bag, shards, orbs, the run's economy, depth 0, every run modifier)
    r.on = 0; r.phase = 'ended';
    resetRun(S);
    S.run = { on: 0, phase: 'summary', n: r.n };
    // (4.0, cardsloot: Auto-Run - the summary screen counts autoAgainT s down, then G.runAgain(); with no run UI at once)
    const again = r.autoAgain ? TUNE.autoAgainT : 0;
    if (again) S.run.autoAgain = again;
    sum.autoAgain = again;
    G.fillQuests();
    // the 3.x clean-ups (blessings, champions, perks2, spells, rare visitors, mobs2, stage) listen to 'ascend'
    emit('ascend', sum.fame.total, kind === 'fall' || kind === 'abandon');
    emit('runSummary', sum);
    if (sum.daily && sum.daily.ranked && !sum.daily.assisted) emit('dailyResult', sum.daily);
    if ((TUNE.runAgainAuto || again) && !G.runUI && S.hero && S.hero.cls) G.runAgain();
    return sum;
  };

  // ---------- After a win: RETURN or PUSH ON (DESIGN §2.4; the Rift Gate II opens it) ----------
  // The Mad Button's beats done, the run asks (phase 'won', S.run.pushAsk {t, fame, embers}; 'runWon'): G.runReturn() ends
  // it as a WIN; G.runPush() banks the win now (paid in full, 'runBanked'(summary)) and the party marches on into the
  // Push: lands past the Void (doors from every pool), the Tide (mob health and bites x1.10 a minute of Push field time),
  // Push land k paying x(1 + 0.25k) Fame and Embers (+30 Fame a land), a relic choice every 2 Push lands. A fall there
  // burns only the Push's own pouch and what was found since (x0.5); a camp's Extract banks it (x1).
  Object.assign(TUNE, { tide: 1.1, pushK: 0.25 });
  G.pushOpen = () => { const r = runOf(); return !!(r && r.on && !r.push && !r.day && G.D.pushOn); };
  G.runTide = () => { const r = runOf(); return r && r.on && r.push ? Math.pow(TUNE.tide, (r.pushT || 0) / 60) : 1; };
  const pushMul = slot => { const r = runOf(); return r && r.push && slot >= SG().lands ? 1 + TUNE.pushK * (slot - SG().lands + 1) : 1; };
  G.runPushMul = pushMul;
  // (runflow: the Push's lands are the corrupted ones, DESIGN §2.4: past the Void a land's names read 'Corrupted <land>'
  // (G.corrupt), II after six Push lands, ...; and world.js's loot +15% a cycle comes with it)
  { const cyc0 = G.cycle; if (cyc0) G.cycle = d => { const r = runOf(); if (r && r.on && r.push && d >= SG().zones) return Math.max(cyc0(d), 1 + Math.floor((Math.floor(d / SIZE()) - SG().lands) / SG().lands)); return cyc0(d); }; }
  function askPush() {
    const r = runOf();
    r.pushAsk = { t: 0, fame: fameNow(r, 'win').total, embers: embersNow(r, 'win').total };
    G.runPhase('won');
    emit('runWon', r.pushAsk);
  }
  G.runReturn = () => { const r = runOf(); if (!r || !r.on || !r.pushAsk) return null; return G.runEnd('win'); };
  G.runPush = function () {
    const S = S_(), r = runOf();
    if (!r || !r.on || !r.pushAsk) return false;
    r.pushAsk = null;
    const sum = settle(r, 'win');
    S.lastRun = sum;
    r.push = 1; r.pushK = 0; r.pushT = 0; r.pushBank = { fame: sum.fame.total, embers: sum.embers.total };
    // (the Push's own books from here: its Fame lines, its pouch, and the Furnace counts only what is found from now)
    r.fame = {}; r.pouch = 0; r.pouchLog = {}; r.pushFur0 = furnace(r).total;
    emit('runBanked', sum);
    emit('pushOn', r, sum);
    G.runPhase('field');
    // the first Push land is chosen at doors too, then the march
    runBeatsOnly(['doors'], { d: SG().final, lord: true, kind: 'lord', act: false, final: false, slot: SG().lands - 1, fresh: true, push: true, march: 1 });
    return true;
  };

  // ---------- The finale (DESIGN §2.3): the Last Stand, then the Mad Button ----------
  // At the final depth, when the clear bar fills: the Last Stand (lastStand s; a retry after a lost Mad Button fight:
  // lastStandRetry s): the Horde at hordeScale 4.5 (hero.js reads R.lastStand), a pack from a random side every lsEvery s
  // (rare.js's Golden Horde loop, G.hordeLoop) up to the quality tier's crowd cap (lsCaps: high / mid / low = G.Quality
  // tiers 0 / 1-2 / 3, never over TUNE.mobMax), no clear bar: the party survives the clock. Then the Mad Button comes at
  // once, into whatever of the Horde still stands. A wipe ends the Last Stand (back a zone, the next try is a full one);
  // a lost Mad Button fight costs a pip and the retry is lastStandRetry s of Horde, then the Mad Button again.
  // R.lastStand = { t (s left), T, acc, retry, cap, every, packs }. Events: 'lastStand'(L), 'lastStandEnd'(L | null: a
  // wipe), 'madButton'(boss) when it enters after the Last Stand
  // (lsKeep: the Mad Button enters into the Horde still standing, DESIGN §2.3; 0: the field is swept as for any boss)
  Object.assign(TUNE, { lastStand: 75, lastStandRetry: 30, lsEvery: 0.45, lsCaps: [850, 600, 400], lsKeep: 1, lsCull: 1 });
  G.lastStandCap = function () {
    const Q = G.Quality, t = Q && Q.tier != null ? Q.tier | 0 : 0, k = t <= 0 ? 0 : t >= 3 ? 2 : 1;
    return Math.max(40, Math.min(TUNE.lsCaps[k] || TUNE.lsCaps[0], mobMax0() || 850));
  };
  // (runflow: the tier's cap holds the WHOLE crowd while the finale is on - the Stand, its retry and the Mad Button's fight -
  // not only the Golden Horde's packs: hero.js's own waves, the boss's adds, events and champions fill the field to its
  // crowd cap. So for that time TUNE.mobMax is the tier's cap (R.lsMobMax keeps the page's own, put back after): hero.js's
  // 3.6 crowd rule (crowdUpdate: base = min(mobMax, mobRef), crowdK = mobRef / base) then fields fewer, heavier small bodies
  // - hit points, bites, gold and XP follow the weight - so it is the same fight on every tier, with fewer bodies to draw.
  // Measured before (tests/runflow/ls_perf.js): a 600 cap let the crowd sit at p95 799 / max 850, a 400 cap p95 578)
  const mobMax0 = () => (R.lsMobMax != null ? R.lsMobMax : TUNE.mobMax);
  function finaleCrowd() {
    const r = runOf();
    if (!(r && r.on && !r.push && (R.lastStand || (R.boss && R.boss.final)))) { finaleCrowdOff(); return; }
    if (R.lsMobMax == null) R.lsMobMax = TUNE.mobMax;
    // (the page lowered its own cap meanwhile (a narrow window): that is the one to put back)
    else if (TUNE.mobMax !== R.lsMobSet) R.lsMobMax = TUNE.mobMax;
    // (the quality governor may step while it runs: the Stand's cap follows it)
    const cap = G.lastStandCap();
    if (R.lastStand) R.lastStand.cap = cap;
    TUNE.mobMax = R.lsMobSet = Math.min(R.lsMobMax, cap);
    // (runflow, continuation 4: the bodies ALREADY on the field when the cap comes are held by no spawner's guard - the last
    // zone's crowd stands at the page's own mobMax, up to 850 on a desktop stuck at a low tier - and a party at the Void
    // kills them too slowly to thin them (measured on the page: 454-492 bodies through the Stand's whole first 30 s at a
    // 400 cap). So the farthest small fry over the cap leave the field at once (lsCull; 'mobFlee', as a champion's or a
    // herd's leaving: the stage drops them, no loot): the bigger kinds and whatever stands near the Button stay, and the
    // Golden Horde's packs come to the cap from there. The same when the governor steps down mid-Stand)
    if (TUNE.lsCull && R.mobs.length > TUNE.mobMax) cullCrowd(TUNE.mobMax);
  }
  // the farthest small fry over `cap` leave the field (not boss adds, invaders, goblins, the gilded, the named):
  // 'crowdCull'(n, cap) once, then 'mobFlee'(m) for each. Returns how many left
  function cullCrowd(cap) {
    const ms = R.mobs, over = ms.length - cap;
    if (over <= 0) return 0;
    const small = [];
    for (const m of ms) if (G.SMALL && G.SMALL[m.kind] && !m.dead && !m.add && !m.gob && !m.gild && !m.inv && !m.champ && !m.name) small.push(m);
    if (!small.length) return 0;
    small.sort((a, b) => a.p - b.p);
    const out = new Set(small.slice(0, over));
    // (in place: R.mobs keeps its identity, as hero.js's own sweeps keep it)
    let w = 0; for (let i = 0; i < ms.length; i++) if (!out.has(ms[i])) ms[w++] = ms[i]; ms.length = w;
    // ('crowdCull' first, so the stage can take the 'mobFlee's that follow as one parting of the Horde, not n bursts)
    emit('crowdCull', out.size, cap);
    for (const m of out) { m.dead = true; m.gone = true; if (R.focus === m.id) R.focus = null; emit('mobFlee', m); }
    return out.size;
  }
  G.cullCrowd = cullCrowd;
  function finaleCrowdOff() {
    if (R.lsMobMax == null) return;
    if (TUNE.mobMax === R.lsMobSet) TUNE.mobMax = R.lsMobMax;
    R.lsMobMax = null; R.lsMobSet = null;
  }
  G.finaleCrowdOff = finaleCrowdOff;
  G.lastStandDue = () => { const S = S_(), r = runOf(); return !!(r && r.on && !r.push && S.depth === SG().final && !R.lastStand && !r.lsReady && !R.boss); };
  G.lastStandStart = function () {
    const r = runOf();
    if (!r || !r.on || R.lastStand) return null;
    const T = r.lsDone ? TUNE.lastStandRetry : TUNE.lastStand;
    R.lastStand = { t: T, T, acc: 0, retry: r.lsDone ? 1 : 0, cap: G.lastStandCap(), every: TUNE.lsEvery, packs: 0 };
    R.bossReady = false; R.bossIn = null;
    r.lsN = (r.lsN | 0) + 1;
    // (the tier's cap from its first moment, the field culled to it with it: not a tick later)
    finaleCrowd();
    if (G.director) G.director.mark('finale', T);
    emit('lastStand', R.lastStand);
    return R.lastStand;
  };
  if (G.hook) G.hook('tick', dt => {
    const L = R.lastStand, r = runOf();
    // (the crowd cap of the finale, L.cap with it)
    if (L || R.lsMobMax != null || (R.boss && R.boss.final)) finaleCrowd();
    if (!L) return;
    if (!r || !r.on) { R.lastStand = null; return; }
    L.t -= dt;
    if (G.hordeLoop) L.packs += G.hordeLoop(L, dt, L.cap, L.every);
    else { L.acc += dt; while (L.acc >= L.every && R.mobs.length < L.cap) { L.acc -= L.every; if (G.spawnPack) G.spawnPack(false, G.rng()); L.packs++; } if (L.acc >= L.every) L.acc = 0; }
    if (L.t <= 0) {
      R.lastStand = null; r.lsReady = 1; r.lsDone = 1;
      S_().bossMeter = Math.max(S_().bossMeter || 0, G.D.bossNeed || 8);
      if (G.director) G.director.end('finale');
      emit('lastStandEnd', L);
      // the Mad Button enters now (DESIGN §2.3), not after the boss call's countdown (when something holds the field just
      // then - a card - it comes as soon as the hold is over, the bar being full), into whatever of the Horde still stands
      R.bossReady = true; R.bossIn = 0; R.bossHold = 0;
      emit('bossReady');
      if (G.startBoss) G.startBoss();
    }
  });
  // (hero.js's heroBossStart sweeps the field for a boss: not for the Mad Button after its Last Stand)
  { const hb0 = G.heroBossStart; if (hb0) G.heroBossStart = function () {
    const r = runOf();
    if (!(TUNE.lsKeep && r && r.on && r.lsReady && !r.push && S_().depth === SG().final)) return hb0.apply(this, arguments);
    const keep = R.mobs.slice(); R.mobs.length = 0;
    try { return hb0.apply(this, arguments); } finally { for (const m of keep) if (!m.dead) R.mobs.push(m); }
  }; }
  // (a reload between the Last Stand's end and the Mad Button: the zone starts over, but the Stand is done - the Mad Button
  // comes at once, not after a new Stand or a refilled bar)
  G.on('runResume', r => { const S = S_(); if (r && r.on && r.lsReady && !r.push && S.depth === SG().final) { S.bossMeter = Math.max(S.bossMeter || 0, G.D.bossNeed || 8); R.bossReady = true; R.bossIn = 0; } });
  // 'madButton'(boss): it enters (after the Last Stand, after the retry's 30 s)
  G.on('bossStart', b => { if (b && b.final && on()) emit('madButton', b); });
  // a wipe ends it (back a zone); a lost Mad Button fight means a shorter one before the retry
  G.on('wipe', () => { if (R.lastStand) { R.lastStand = null; if (G.director) G.director.end('finale'); emit('lastStandEnd', null); } });
  // (the retry's 30 s start at once: the bar counts as full, DESIGN §2.3 'the retry skips the Last Stand: 30 s of Horde')
  G.on('bossFail', b => { const r = runOf(); if (r && r.on && b && b.kind === 'final') { r.lsReady = 0; S_().bossMeter = Math.max(S_().bossMeter || 0, G.D.bossNeed || 8); } });

  // ---------- Relic items (relic.js) ----------
  // DESIGN §5.3: the relic item drop (1/600 bosses, 1/200 lords) is off inside a Siege: relics come as belt choices.
  // (runflow: relic.js itself now gives 0 odds inside a Siege, TUNE.siegeRelicItems turns it back on; nothing here)

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
  // a saved run's fields given their defaults (4.0 fix1: a save written by an earlier 4.0 build, or a truncated one, lacking
  // run.keeps / fame / deeds / pouchLog / belt... threw at the run's end; every field of the run object newRun builds is
  // filled in when missing, and the typed ones (objects, arrays) are put back to their type when the save holds junk)
  function runDefaults(r) {
    const S = S_(), cls = (G.CLASS_BY_ID[r.cls] && r.cls) || (S.hero && G.CLASS_BY_ID[S.hero.cls] && S.hero.cls) || 'knight';
    const def = newRun({ btn: typeof r.btn === 'string' ? r.btn : 'classic', cls, heat: r.heat, keeps: Array.isArray(r.keeps) ? r.keeps : [], seed: r.seed >>> 0, day: typeof r.day === 'string' ? r.day : '', replay: r.replay }, r.n | 0 || 1);
    if (!G.CLASS_BY_ID[r.cls]) r.cls = cls;
    for (const k in def) {
      const d = def[k], v = r[k];
      if (v === undefined || v === null) { if (d != null && typeof d === 'object') r[k] = d; else if (v === undefined) r[k] = d; continue; }
      if (Array.isArray(d)) { if (!Array.isArray(v)) r[k] = d; }
      else if (d && typeof d === 'object') { if (!v || typeof v !== 'object' || Array.isArray(v)) r[k] = d; }
      else if (typeof d === 'number' && typeof v !== 'number') r[k] = typeof v === 'string' && isFinite(+v) ? +v : d;
    }
    for (const k of ['mods', 'tags']) while (r[k].length < SG().lands) r[k].push(null);
    return r;
  }
  G.runDefaults = runDefaults;
  G.runResume = function () {
    const S = S_();
    let r = S.run;
    if (!r || typeof r !== 'object') r = S.run = { on: 0, phase: 'setup' };
    if (!r.on) {
      if (r.phase === 'summary' && (TUNE.runAgainAuto || r.autoAgain) && !G.runUI && S.hero && S.hero.cls && !S.fallen) G.runAgain();
      return;
    }
    runDefaults(r);
    S.bossMeter = 0; R.zoneT = 0; R.march = null; R.boss = null; R.bossReady = false; R.bossIn = null;
    if (!Array.isArray(r.route) || r.route.length < SG().lands || r.route.some(i => !G.REALMS[i])) r.route = defaultRoute();
    if (!Array.isArray(r.cardQ)) r.cardQ = [];
    if (!Array.isArray(r.cardLog)) r.cardLog = [];
    if (typeof r.phase !== 'string') r.phase = 'field';
    if (r.phase !== 'field') {
      const bt = r.beat, B = bt && bt.id ? BEAT_BY_ID[bt.id] : null;
      // (the beats this page has may differ from the saving page's: carry on after the one on screen, by its order)
      if (bt) { const k = BEATS.findIndex(x => x.id === bt.id); bt.i = k >= 0 ? k + 1 : BEATS.findIndex(x => x.order > (bt.order != null ? bt.order : -1e9)); if (bt.i < 0) bt.i = BEATS.length; }
      if (B && B.resume) { try { B.resume(bt.ctx); } catch (e) { if (typeof console !== 'undefined') console.error('beat resume', e); } }
      else if (!B) { if (bt) bt.id = null; else r.beat = null; if (bt) nextBeat(); else G.runPhase('field'); }
    }
    // a card that was on screen comes back (holding the field again); a shrine's choice too; the win's question
    if (r.on && r.offer) { syncHero(r); if (r.phase === 'field') G.runPhase('card'); }
    if (r.on && (r.boonOffer || r.pactOffer) && r.phase === 'field') G.runPhase('shrine');
    if (r.on && r.pushAsk) G.runPhase('won');
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
    // (4.0 fix1: whole Embers, as every other Embers path pays - G.EMBERS.orb has half values)
    gift.embers.items = Math.round(gift.embers.items); gift.embers.orbs = Math.round(gift.embers.orbs);
    gift.embers.gear = Math.min(F.gear, gift.embers.items + gift.embers.shards + gift.embers.orbs);
    // ---- the town: its levels
    const bld = obj(old.bld) || {};
    for (const id in bld) gift.embers.townLvls += Math.max(0, Math.min(G.BLD_MAX || 5, bld[id] | 0));
    gift.embers.town = gift.embers.townLvls * F.town;
    gift.embers.total = Math.round(Math.min(F.cap, gift.embers.gear + gift.embers.town));
    s.embers = Math.round((s.embers || 0) + gift.embers.total); s.emberTotal = Math.round((s.emberTotal || 0) + gift.embers.total);
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
