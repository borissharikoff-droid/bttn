// BTTN — all game content. Descriptions use {0}
// placeholders filled from val(level). Effects are applied in G.recalc().
(function (G) {
  'use strict';

  // ---------- Rarities ----------
  // secs: item value measured in "seconds of income" so chests stay relevant all game.
  G.RARITIES = [
    { id: 'common',    name: 'Common',    color: '#c7b299', dark: '#7a6650', secs: 0.4,    ess: 0.06, bonusMul: 1 },
    { id: 'uncommon',  name: 'Uncommon',  color: '#63d85b', dark: '#2d7a28', secs: 1,    ess: 0.14, bonusMul: 1.5 },
    { id: 'rare',      name: 'Rare',      color: '#4fa8ff', dark: '#1f5aa8', secs: 2.5,   ess: 0.35, bonusMul: 2 },
    { id: 'epic',      name: 'Epic',      color: '#b36bff', dark: '#5f2aa8', secs: 6,   ess: 0.9,  bonusMul: 3 },
    { id: 'legendary', name: 'Legendary', color: '#ffa033', dark: '#a8560f', secs: 16,  ess: 2.4,  bonusMul: 4 },
    { id: 'mythic',    name: 'Mythic',    color: '#ff4f7e', dark: '#9e1f44', secs: 50,  ess: 6,    bonusMul: 6 },
    { id: 'divine',    name: 'Divine',    color: '#ffffff', dark: '#9aa6c0', secs: 160, ess: 18,   bonusMul: 10 },
  ];
  // Base chest tier weights before luck.
  G.CHEST_WEIGHTS = [1000, 280, 80, 22, 6, 1.5, 0.3];
  // The Horde drops far more pieces than the Button spills chests, so each one is stingier at the top
  G.DROP_WEIGHTS = [1000, 300, 80, 18, 3.5, 0.6, 0.08];
  G.STAR_THRESHOLDS = [1, 10, 100, 1000, 10000];

  // ---------- Collection bonus types (per star, before rarity multiplier) ----------
  G.BONUS = {
    click: { v: 0.02,  name: 'Click gold',  pct: true },
    gps:   { v: 0.01,  name: 'Garrison income', pct: true },
    gold:  { v: 0.01,  name: 'All gold',    pct: true },
    crit:  { v: 0.001, name: 'Crit chance', pct: true },
    critd: { v: 0.1,   name: 'Crit power',  pct: false, x: true },
    luck:  { v: 0.005, name: 'Luck',        pct: true },
    ess:   { v: 0.015, name: 'Essence',     pct: true },
    item:  { v: 0.02,  name: 'Item value',  pct: true },
    boss:  { v: 0.03,  name: 'Boss damage', pct: true },
    chest: { v: 0.015, name: 'Chest rate',  pct: true },
    egg:   { v: 0.02,  name: 'Egg chance',  pct: true },
    pet:   { v: 0.015, name: 'Pet power',   pct: true },
    combo: { v: 2,     name: 'Max combo',   pct: false },
  };

  // ---------- Items: 7 rarities x 6. w = drop weight inside the rarity, m = value multiplier ----------
  const W = [30, 25, 20, 13, 8, 4], M = [0.7, 0.85, 1.0, 1.25, 1.6, 2.2];
  const itemRows = [
    [ // common
      ['rusty_dagger', 'Rusty Dagger', 'click'],
      ['twig_staff', 'Twig Staff', 'ess'],
      ['short_bow', 'Short Bow', 'crit'],
      ['leather_vest', 'Leather Vest', 'gps'],
      ['copper_ring', 'Copper Ring', 'luck'],
      ['old_boot', 'Old Boot', 'item'],
    ],
    [ // uncommon
      ['steel_sword', 'Steel Sword', 'click'],
      ['oak_wand', 'Oak Wand', 'ess'],
      ['hunter_bow', "Hunter's Bow", 'critd'],
      ['chainmail', 'Chainmail', 'boss'],
      ['emerald_ring', 'Emerald Ring', 'luck'],
      ['hp_potion', 'Health Potion', 'gold'],
    ],
    [ // rare
      ['sapphire_blade', 'Sapphire Blade', 'click'],
      ['frost_staff', 'Frost Staff', 'ess'],
      ['crystal_dagger', 'Crystal Dagger', 'crit'],
      ['knight_shield', "Knight's Shield", 'boss'],
      ['mana_tome', 'Mana Tome', 'pet'],
      ['sapphire_amulet', 'Sapphire Amulet', 'chest'],
    ],
    [ // epic
      ['shadow_katana', 'Shadow Katana', 'critd'],
      ['necro_skull', 'Necro Skull', 'ess'],
      ['arcane_orb', 'Arcane Orb', 'gps'],
      ['demon_helm', 'Demon Helm', 'boss'],
      ['void_cloak', 'Void Cloak', 'combo'],
      ['amethyst_tiara', 'Amethyst Tiara', 'egg'],
    ],
    [ // legendary
      ['dragon_sword', 'Dragonfire Sword', 'click'],
      ['phoenix_bow', 'Phoenix Bow', 'crit'],
      ['sun_staff', 'Sunstaff', 'gps'],
      ['golden_plate', 'Golden Plate', 'gold'],
      ['titan_ring', 'Titan Ring', 'luck'],
      ['ancient_scroll', 'Ancient Scroll', 'item'],
    ],
    [ // mythic
      ['blood_scythe', 'Blood Scythe', 'critd'],
      ['star_codex', 'Star Codex', 'ess'],
      ['chaos_wand', 'Chaos Wand', 'chest'],
      ['moon_orb', 'Bloodmoon Orb', 'pet'],
      ['realm_heart', 'Heart of the Realm', 'gold'],
      ['king_crown', 'Crown of Kings', 'boss'],
    ],
    [ // divine
      ['eternity_blade', 'Eternity Blade', 'click'],
      ['celestial_staff', 'Celestial Staff', 'gps'],
      ['halo', 'Halo', 'luck'],
      ['seraph_wing', 'Seraph Wing', 'egg'],
      ['cosmic_egg', 'Cosmic Egg', 'pet'],
      ['golden_button', 'The Golden Button', 'gold'],
    ],
  ];
  G.ITEMS = [];
  G.ITEMS_BY_RARITY = [];
  itemRows.forEach((row, r) => {
    G.ITEMS_BY_RARITY[r] = [];
    row.forEach((it, i) => {
      const item = { id: it[0], r, name: it[1], bonus: it[2], w: W[i], m: M[i], idx: G.ITEMS.length };
      G.ITEMS.push(item);
      G.ITEMS_BY_RARITY[r].push(item);
    });
  });
  G.ITEM_BY_ID = {};
  G.ITEMS.forEach(it => G.ITEM_BY_ID[it.id] = it);

  // ---------- Heroes (idle income) ----------
  G.HERO_MILESTONES = [10, 25, 50, 100, 150, 200, 250, 300, 400, 500, 600, 700, 800, 900, 1000];
  // how many chests fit on the field at each Treasure Hall level
  G.HALL_SLOTS = [6, 10, 20, 30, 50, 100, 200];
  G.HEROES = [
    { id: 'rogue',    name: 'Cutpurse',    cost: 50,     gps: 0.2,    shot: '#9aa0a8' },
    { id: 'archer',   name: 'Bowman',      cost: 400,    gps: 1.2,    shot: '#9be15d' },
    { id: 'wizard',   name: 'Hedge Mage',  cost: 4500,   gps: 8,      shot: '#5ab4ff' },
    { id: 'priest',   name: 'Priestess',   cost: 50000,  gps: 45,     shot: '#fff3a0' },
    { id: 'warrior',  name: 'Warrior',     cost: 5.5e5,  gps: 260,    shot: '#ff7a4a' },
    { id: 'knight',   name: 'Sentinel',    cost: 6e6,  gps: 1400,   shot: '#cfd8e0' },
    { id: 'paladin',  name: 'Paladin',     cost: 8.5e7,  gps: 7800,   shot: '#ffd84a' },
    { id: 'necro',    name: 'Necromancer', cost: 1.3e9,  gps: 44000,  shot: '#c06bff' },
    { id: 'mystic',   name: 'Mystic',      cost: 2e10,  gps: 2.6e5,  shot: '#ff6bd8' },
    { id: 'sorcerer', name: 'Sorcerer',    cost: 3e11, gps: 1.6e6,  shot: '#ff4040' },
    { id: 'ninja',    name: 'Ninja',       cost: 4e12,   gps: 1e7,    shot: '#ffffff' },
    { id: 'summoner', name: 'Summoner',    cost: 5.5e13, gps: 6.5e7,  shot: '#6bffb0' },
  ];
  G.HERO_GROWTH = 1.15;
  G.FINGER_MILESTONES = [10, 25, 50, 75, 100, 125, 150, 200];

  // ---------- Shop upgrades (gold) ----------
  G.UPGRADES = [
    { id: 'finger', icon: 'ic_finger', base: 15, growth: 1.5, max: 0,
      name: 'Iron Finger',
      desc: '+1 click power; ×2 at levels 10, 25, 50, 75…',
      fx: (L, D) => { D.clickAdd += L; D.clickMult *= Math.pow(2, G.FINGER_MILESTONES.filter(m => L >= m).length); } },
    // 3.0: holding the Button clicks on its own only as fast as this allows: 1 click a second per level
    { id: 'hold', icon: 'ic_clock', base: 30, growth: 2.6, max: 9,
      name: 'Steady Hand',
      desc: 'Hold the Button: +1 auto-click/s',
      fx: (L, D) => { D.holdRate = Math.min(10, 1 + L); } },
    { id: 'might', icon: 'ic_rune', base: 5000, growth: 30, max: 15,
      name: 'Rune of Might',
      desc: 'Click gold ×1.5',
      fx: (L, D) => { D.clickMult *= Math.pow(1.5, L); } },
    { id: 'echo', icon: 'ic_echo', base: 100000.0, growth: 15, max: 10,
      name: 'Echo Strike',
      desc: 'Clicks add 1% of garrison income',
      fx: (L, D) => { D.clickGpsPct += 0.01 * L; } },
    { id: 'keen', icon: 'ic_eye', base: 200, growth: 2.5, max: 20,
      name: 'Keen Eye',
      desc: '+0.5% crit chance',
      fx: (L, D) => { D.crit += 0.005 * L; } },
    { id: 'deadly', icon: 'ic_skull', base: 1000, growth: 3.5, max: 15,
      name: 'Deadly Blow',
      desc: 'Crit power +0.5',
      fx: (L, D) => { D.critMult += 0.5 * L; } },
    // 4.0: Treasure Sense, Treasure Hall, Looter and Loot Crew left the run shop (chests are few and each one is an event;
    // Treasure Sense moved to the Hall of Fame). The entries stay so old saves still read, but off (never sold, no effect)
    // and secret (the 3.x shop list hides them)
    { id: 'sense', icon: 'ic_nose', base: 100, growth: 2.4, max: 20, off: 1, secret: Infinity,
      name: 'Treasure Sense',
      desc: 'Chest rate +5%',
      fx: (L, D) => { D.chestProg += 0.05 * L; } },
    { id: 'hall', icon: 'ic_vault', base: 400, growth: 12, max: 6, off: 1, secret: Infinity,
      name: 'Treasure Hall',
      desc: 'Chest slots: 10, 20, 30, 50, 100, 200',
      fx: (L, D) => { D.slots += G.HALL_SLOTS[L] - G.HALL_SLOTS[0]; } },
    { id: 'golem', icon: 'ic_key', base: 600, growth: 3.2, max: 20, off: 1, secret: Infinity,
      name: 'Looter',
      desc: 'Opens a chest every 3 s; −10% per level',
      fx: (L, D) => { if (L > 0) D.autoOpen = 3 * Math.pow(0.9, L - 1); } },
    { id: 'crew', icon: 'ic_crew', base: 40000, growth: 30, max: 4, req: 'golem', off: 1, secret: Infinity,
      name: 'Loot Crew',
      desc: '+1 Looter (needs Looter)',
      fx: (L, D) => { D.looters += L; } },
    { id: 'clover', icon: 'ic_clover', base: 1000, growth: 2.8, max: 20,
      name: 'Four-Leaf Clover',
      desc: '+3% luck: better chests',
      fx: (L, D) => { D.luck += 0.03 * L; } },
    { id: 'appraiser', icon: 'ic_scale', base: 500, growth: 2.8, max: 20,
      name: 'Appraiser',
      desc: 'Item value +5%',
      fx: (L, D) => { D.itemMult *= 1 + 0.05 * L; } },
    { id: 'rhythm', icon: 'ic_note', base: 1000, growth: 4, max: 10,
      name: 'Rhythm',
      desc: 'Max combo +25',
      fx: (L, D) => { D.comboCap += 25 * L; } },
    { id: 'clockwork', icon: 'ic_gear', base: 10000, growth: 2.8, max: 20,
      name: 'Clockwork Hand',
      desc: '+0.5 auto clicks/s',
      fx: (L, D) => { D.autoCps += 0.5 * L; } },
    { id: 'prince', icon: 'ic_crown', base: 1e17, growth: 1, max: 1, secret: 1e13,
      name: "The Prince's Crown",
      desc: 'All gold ×3',
      fx: (L, D) => { if (L) D.goldMult *= 3; } },
  ];

  // ---------- Chest modifiers ----------
  G.MODIFIERS = [
    { id: 'golden',    color: '#ffd84a', name: 'Golden',    desc: 'Bursts with gold' },
    { id: 'lightning', color: '#7fe9ff', name: 'Storm',     desc: 'Lightning opens 3 more chests' },
    { id: 'ghost',     color: '#d8e6ff', name: 'Ghost',     desc: 'Double loot' },
    { id: 'chromatic', color: '#ff7ae6', name: 'Chromatic', desc: 'Best of 3 rarity rolls' },
    { id: 'frozen',    color: '#9fd8ff', name: 'Frozen',    desc: '8 clicks to crack; 3 items' },
    { id: 'blazing',   color: '#ff7a2e', name: 'Blazing',   desc: '×5 value, burns out in 6s' },
    { id: 'mimic',     color: '#d94040', name: 'Mimic',     desc: 'Bites! Beat it for 5 items' },
    { id: 'void',      color: '#8a4dff', name: 'Void',      desc: '×10 essence' },
  ];
  G.MOD_BY_ID = {}; G.MODIFIERS.forEach(m => G.MOD_BY_ID[m.id] = m);

  // ---------- Constellation (essence skill tree) ----------
  // x,y on a grid centred at 0,0. req: any one of these unlocks the node.
  const C = (id, x, y, br, req, max, cost, growth, name, desc, fx, val) => ({ id, x, y, br, req, max, cost, growth, name, desc, fx, val });
  G.NODES = [
    C('spark', 0, 0, 'core', [], 5, 1, 1.6, 'Spark', 'All gold +10%',
      (L, D) => { D.goldMult *= 1 + 0.1 * L; }),
    // Click arm (up)
    C('c_surge', 0, -1, 'click', ['spark'], 5, 2, 1.7, 'Power Surge', 'Click gold +20%',
      (L, D) => { D.clickMult *= 1 + 0.2 * L; }),
    // (4.0: the Star Chart is permanent now, so its power is compressed: crit +0.6% and crit power +0.1 a level)
    C('c_prec', -1, -2, 'click', ['c_surge'], 5, 4, 1.8, 'Precision', 'Crit chance +0.6%',
      (L, D) => { D.crit += 0.006 * L; }),
    C('c_brut', 1, -2, 'click', ['c_surge'], 5, 4, 1.8, 'Brutality', 'Crit power +0.1',
      (L, D) => { D.critMult += 0.1 * L; }),
    C('c_flow', 0, -3, 'click', ['c_prec', 'c_brut'], 3, 12, 2.2, 'Flow', 'Max combo +40',
      (L, D) => { D.comboCap += 40 * L; }),
    C('c_echo', -1, -4, 'click', ['c_flow'], 5, 30, 2, 'Resonance', 'Clicks +1% of garrison income',
      (L, D) => { D.clickGpsPct += 0.01 * L; }),
    C('c_frenzy', 1, -4, 'click', ['c_flow'], 3, 25, 2, 'Rapture', 'Wisp buff time +25%',
      (L, D) => { D.buffDur += 0.25 * L; }),
    C('c_thunder', 0, -5, 'click', ['c_echo', 'c_frenzy'], 1, 200, 1, 'Thunder Palm', 'Every 25th click ×30',
      (L, D) => { D.mega = L > 0; }),
    // Idle arm (right)
    C('i_guild', 1, 0, 'idle', ['spark'], 5, 2, 1.7, 'Guild Hall', 'Garrison income +15%',
      (L, D) => { D.gpsMult *= 1 + 0.15 * L; }),
    C('i_vet', 2, -1, 'idle', ['i_guild'], 3, 10, 2.5, 'Veterans', 'Income +0.5% per 10 heroes',
      (L, D) => { D.vet += 0.005 * L; }),
    C('i_scout', 2, 1, 'idle', ['i_guild'], 5, 8, 2, 'Scouts', 'Chest find +4%',
      (L, D) => { D.chestProg *= 1 + 0.04 * L; }),
    C('i_watch', 3, 0, 'idle', ['i_vet', 'i_scout'], 5, 12, 2, 'Night Watch', 'Offline +10%, +1h cap',
      (L, D) => { D.offEff += 0.1 * L; D.offCap += 3600 * L; }),
    C('i_banner', 4, -1, 'idle', ['i_watch'], 5, 40, 2.2, 'War Banner', 'Garrison income +25%',
      (L, D) => { D.gpsMult *= 1 + 0.25 * L; }),
    C('i_clock', 4, 1, 'idle', ['i_watch'], 5, 35, 2.2, 'Clockmaker', '+1 auto click per second',
      (L, D) => { D.autoCps += L; }),
    C('i_legion', 5, 0, 'idle', ['i_banner', 'i_clock'], 1, 200, 1, 'Legion', 'All gold +8% per hero class',
      (L, D) => { D.legion = L > 0; }),
    // Chest arm (down)
    C('h_nose', 0, 1, 'chest', ['spark'], 5, 2, 1.7, 'Keen Nose', 'Chest rate +10%',
      (L, D) => { D.chestProg += 0.1 * L; }),
    C('h_fusion', -1, 2, 'chest', ['h_nose'], 1, 6, 1, 'Fusion', 'When full, 3 equal chests fuse into a better one',
      (L, D) => { D.merge = L > 0; }),
    C('h_gild', 1, 2, 'chest', ['h_nose'], 1, 5, 1, 'Gilding', 'Golden chests; modifier chance +2%',
      (L, D) => { if (L) { D.mods.golden = 1; D.modChance += 0.02; } }),
    C('h_double', -2, 3, 'chest', ['h_fusion'], 5, 12, 2, 'False Bottom', '+5% double loot chance',
      (L, D) => { D.double += 0.05 * L; }),
    C('h_storm', 0, 3, 'chest', ['h_gild', 'h_fusion'], 1, 15, 1, 'Stormcall', 'Unlocks Storm chests',
      (L, D) => { if (L) D.mods.lightning = 1; }),
    C('h_ghost', 2, 3, 'chest', ['h_gild'], 1, 15, 1, 'Phantasm', 'Unlocks Ghost chests',
      (L, D) => { if (L) D.mods.ghost = 1; }),
    C('h_frost', -1, 4, 'chest', ['h_storm'], 1, 25, 1, 'Permafrost', 'Unlocks Frozen chests',
      (L, D) => { if (L) D.mods.frozen = 1; }),
    C('h_chroma', 1, 4, 'chest', ['h_storm', 'h_ghost'], 1, 30, 1, 'Prism', 'Unlocks Chromatic chests',
      (L, D) => { if (L) D.mods.chromatic = 1; }),
    C('h_rate', 2, 4, 'chest', ['h_ghost'], 5, 20, 2, 'Anomalies', 'Modifier chance +2%',
      (L, D) => { D.modChance += 0.02 * L; }),
    C('h_blaze', -2, 5, 'chest', ['h_frost'], 1, 45, 1, 'Inferno', 'Unlocks Blazing chests',
      (L, D) => { if (L) D.mods.blazing = 1; }),
    C('h_mimic', 0, 5, 'chest', ['h_frost', 'h_chroma'], 1, 50, 1, 'Toothy', 'Unlocks Mimics',
      (L, D) => { if (L) D.mods.mimic = 1; }),
    C('h_void', 2, 5, 'chest', ['h_chroma', 'h_rate'], 1, 60, 1, 'Abyssal', 'Unlocks Void chests',
      (L, D) => { if (L) D.mods.void = 1; }),
    C('h_hoard', 0, 6, 'chest', ['h_blaze', 'h_mimic', 'h_void'], 1, 250, 1, 'Hoard', 'Modifier chance +8%, +2 slots',
      (L, D) => { if (L) { D.modChance += 0.08; D.slots += 2; } }),
    // Arcane arm (left)
    C('a_flow', -1, 0, 'arcane', ['spark'], 5, 2, 1.7, 'Ember Flow', 'Boss Embers +10%',
      (L, D) => { D.bossEmbers = (D.bossEmbers || 1) * (1 + 0.1 * L); }),
    C('a_hatch', -2, -1, 'arcane', ['a_flow'], 5, 10, 2, 'Nesting', 'Egg chance +15%',
      (L, D) => { D.eggMult *= 1 + 0.15 * L; }),
    C('a_slayer', -2, 1, 'arcane', ['a_flow'], 5, 8, 1.9, 'Bossbane', 'Boss damage +3%',
      (L, D) => { D.bossMult *= 1 + 0.03 * L; }),
    C('a_bond', -3, -1, 'arcane', ['a_hatch'], 5, 20, 2, 'Bond', 'Pet power +15%',
      (L, D) => { D.petMult *= 1 + 0.15 * L; }),
    C('a_time', -3, 1, 'arcane', ['a_slayer'], 3, 15, 2.2, 'Time Dilation', 'Boss timer +4s',
      (L, D) => { D.bossTime += 4 * L; }),
    C('a_wisp', -4, 0, 'arcane', ['a_bond', 'a_time'], 3, 25, 2, 'Wisp Lure', 'Wisp rate +20%',
      (L, D) => { D.wispRate *= 1 + 0.2 * L; }),
    C('a_nest', -4, -1, 'arcane', ['a_bond'], 2, 60, 4, 'Great Nest', '+1 pet slot',
      (L, D) => { D.petSlots += L; }),
    C('a_hunt', -4, 1, 'arcane', ['a_time'], 1, 30, 1, 'The Hunt', 'Too-tough bosses return in 20s, not 60s; clear bar −20% kills',
      (L, D) => { if (L) { D.autoBoss = true; D.bossNeed *= 0.8; } }),
    C('a_astral', -5, 0, 'arcane', ['a_nest', 'a_hunt', 'a_wisp'], 1, 220, 1, 'Astral', 'Potion cap +5, potion power +50%',
      (L, D) => { if (L) { D.potCap += 5; D.potPow *= 1.5; } }),
  ];
  G.NODE_BY_ID = {}; G.NODES.forEach(n => G.NODE_BY_ID[n.id] = n);
  G.BRANCH_COLORS = { core: '#ffffff', click: '#ff6464', idle: '#63d85b', chest: '#ffd84a', arcane: '#b36bff' };

  // ---------- Stat potions (reset on ascension, like a hero's death) ----------
  G.POTIONS = [
    { id: 'att',  short: 'ATT', color: '#e04cf0', name: 'Attack',    desc: 'Warden damage and clicks +5%' },
    { id: 'def',  short: 'DEF', color: '#9a9aa6', name: 'Defense',   desc: 'Button toughness +8%' },
    { id: 'spd',  short: 'SPD', color: '#41d65b', name: 'Speed',     desc: 'Auto clicks and Looters +5%' },
    { id: 'dex',  short: 'DEX', color: '#ff9b2d', name: 'Dexterity', desc: 'Crit chance +0.5%' },
    { id: 'vit',  short: 'VIT', color: '#e0413b', name: 'Vitality',  desc: 'Garrison income +5%' },
    { id: 'wis',  short: 'WIS', color: '#3fa0ff', name: 'Wisdom',    desc: 'Essence +5%' },
    { id: 'life', short: 'LIFE', color: '#ff7aa8', name: 'Life',     desc: 'All gold +3%' },
    { id: 'mana', short: 'MANA', color: '#6a7bff', name: 'Mana',     desc: 'Pet power +4%' },
  ];

  // ---------- Pets (gacha "cuties") ----------
  // tier: 0 common, 1 rare, 2 legendary, 3 divine. cps = auto clicks/sec at level 1.
  G.PET_TIERS = [
    { name: 'Common', color: '#c7b299', rate: 0.62 },
    { name: 'Rare', color: '#4fa8ff', rate: 0.28 },
    { name: 'Legendary', color: '#ffa033', rate: 0.09 },
    { name: 'Divine', color: '#ffffff', rate: 0.01 },
  ];
  G.PETS = [
    { id: 'slime',   tier: 0, cps: 1,   name: 'Goop',        desc: 'Auto clicks' },
    { id: 'bat',     tier: 0, cps: 0,   name: 'Nibbles',     desc: 'Crit chance',                  fx: (p, D) => { D.crit += 0.004 * p; } },
    { id: 'frog',    tier: 0, cps: 0,   name: 'Croaky',      desc: 'Luck',                         fx: (p, D) => { D.luck += 0.01 * p; } },
    { id: 'beetle',  tier: 0, cps: 0,   name: 'Scarab',      desc: 'Garrison income',                  fx: (p, D) => { D.gpsMult *= 1 + 0.05 * p; } },
    { id: 'owl',     tier: 1, cps: 0,   name: 'Hoot',        desc: 'Essence',                      fx: (p, D) => { D.essMult *= 1 + 0.04 * p; } },
    { id: 'boo',     tier: 1, cps: 1.5, name: 'Boo',         desc: 'Auto clicks, modifier chance', fx: (p, D) => { D.modChance += 0.003 * p; } },
    { id: 'imp',     tier: 1, cps: 0,   name: 'Ember',       desc: 'Boss damage',                  fx: (p, D) => { D.bossMult *= 1 + 0.08 * p; } },
    { id: 'pebble',  tier: 1, cps: 0,   name: 'Pebble',      desc: 'Opens chests',                 fx: (p, D) => { D.petOpen += 0.12 * p; } },
    { id: 'phoenix', tier: 2, cps: 3,   name: 'Phoenix',     desc: 'Auto clicks, crit power',      fx: (p, D) => { D.critMult += 0.5 * p; } },
    { id: 'drake',   tier: 2, cps: 0,   name: 'Drakey',      desc: 'All gold',                     fx: (p, D) => { D.goldMult *= 1 + 0.06 * p; } },
    { id: 'starfox', tier: 2, cps: 0,   name: 'Starfox',     desc: 'Eggs and luck',                fx: (p, D) => { D.eggMult *= 1 + 0.08 * p; D.luck += 0.01 * p; } },
    { id: 'buttonling', tier: 3, cps: 4, name: 'Buttonling', desc: 'A bit of everything',          fx: (p, D) => { D.goldMult *= 1 + 0.1 * p; D.luck += 0.015 * p; } },
  ];
  G.PET_BY_ID = {}; G.PETS.forEach(p => G.PET_BY_ID[p.id] = p);
  G.PET_MAX_LEVEL = 25;
  G.GOLDEN_CHANCE = 0.05;

  // ---------- Realms & bosses ----------
  // 3.4: three zones a land (it was five), so the scenery changes twice as often; the last zone holds the land's lord
  G.REALM_SIZE = 3; // depths per realm; the last depth is the realm lord
  // each land still has five looks and names (morning ... the lord's lair): a zone takes the ones spread across them
  G.ZONE_LOOK = z => (G.REALM_SIZE <= 1 ? 4 : Math.round(z * 4 / (G.REALM_SIZE - 1)));
  G.REALMS = [
    { id: 'shore',     name: 'Shoreline',  minion: 'b_crab',   lord: 'l_crab',   fodder: 'f_crab',
      minionName: 'Sand Crab', lordName: 'The Crab King',
      zones: ['Tide Pools', 'Wreck Cove', 'Salt Flats', 'Coral Maze', 'The Crab King\u2019s Throne'],
      mobs: { runner: 'Gull', spitter: 'Spitting Clam', bomber: 'Puffer', tank: 'Hermit Shell' },
      rule: 'Treasure Tides', ruleDesc: 'Hoarders twice as often', hoard: 2 },
    { id: 'meadow',    name: 'Meadows',    minion: 'b_goblin', lord: 'l_goblin', fodder: 'f_goblin',
      minionName: 'Goblin', lordName: 'Goblin Warchief',
      zones: ['Sunny Fields', 'Goblin Camp', 'The Old Mill', 'Raider Road', 'Warchief\u2019s Hill'],
      mobs: { runner: 'Warg Pup', spitter: 'Goblin Slinger', bomber: 'Powder Goblin', tank: 'Boar Rider' },
      rule: 'Goblin Raids', ruleDesc: 'Surges 50% bigger and longer', surge: 1.5 },
    { id: 'forest',    name: 'Deepwood',   minion: 'b_shroom', lord: 'l_tree',   fodder: 'f_spore',
      minionName: 'Shroomling', lordName: 'Elder Treant',
      zones: ['Mossy Trail', 'Rotting Hollow', 'Spore Glade', 'Witchroot', 'Heart of the Wood'],
      mobs: { runner: 'Thornback', spitter: 'Spore Spitter', bomber: 'Puffball', tank: 'Barkhide' },
      rule: 'Sporefall', ruleDesc: 'Big mobs often burst into spores', split: 0.4 },
    { id: 'highlands', name: 'Highlands',  minion: 'b_golem',  lord: 'l_titan',  fodder: 'f_pebble',
      minionName: 'Stone Golem', lordName: 'Mountain Titan',
      zones: ['Foothills', 'The Quarry', 'Windy Pass', 'Golem Graves', 'Titan\u2019s Seat'],
      mobs: { runner: 'Rockhound', spitter: 'Pebble Thrower', bomber: 'Blasting Cap', tank: 'Boulder' },
      rule: 'Stoneskin', ruleDesc: 'Brutes: half damage taken, double loot', stone: 1 },
    { id: 'tundra',    name: 'Frostlands', minion: 'b_yeti',   lord: 'l_wyrm',   fodder: 'f_snow',
      minionName: 'Yeti', lordName: 'Frost Wyrm',
      zones: ['Frozen Lake', 'Snowdrift', 'Ice Caves', 'Yeti Den', 'The Wyrm\u2019s Glacier'],
      mobs: { runner: 'Snow Fox', spitter: 'Frost Spitter', bomber: 'Ice Bomb', tank: 'Glacier Beetle' },
      rule: 'Blizzard', ruleDesc: 'Horde 25% slower; champions ×2', slow: 0.75, champ: 2 },
    { id: 'godlands',  name: 'Godlands',   minion: 'b_eye',    lord: 'l_eye',    fodder: 'f_eye',
      minionName: 'Watcher', lordName: 'The All-Seeing Eye',
      zones: ['Pilgrim Steps', 'The Fallen Temple', 'Hall of Eyes', 'Starfield', 'The Watching Throne'],
      mobs: { runner: 'Seeker', spitter: 'Gazer', bomber: 'Star Spark', tank: 'Temple Guard' },
      rule: 'Watchful Eyes', ruleDesc: 'Shrines ×2, rares +60%', shrine: 2, rare: 1.6 },
    { id: 'abyss',     name: 'Abyss',      minion: 'b_imp',    lord: 'l_demon',  fodder: 'f_bat',
      minionName: 'Fiend', lordName: 'Demon Lord',
      zones: ['Brimstone Gate', 'The Ash Fields', 'Chain Pits', 'The Burning Keep', 'The Demon\u2019s Seat'],
      mobs: { runner: 'Hellhound', spitter: 'Fire Spitter', bomber: 'Brimstone Imp', tank: 'Hellforged' },
      rule: 'Hellfire', ruleDesc: '1 in 4 mobs explode on death; blasts chain', boom: 0.25 },
    { id: 'void',      name: 'The Void',   minion: 'b_wraith', lord: 'l_button', fodder: 'f_shade',
      minionName: 'Void Wraith', lordName: 'The Mad Button',
      zones: ['Edge of Nothing', 'Hollow Stars', 'The Broken Stair', 'The Unmaking', 'The Mad Button'],
      mobs: { runner: 'Flicker', spitter: 'Null Spitter', bomber: 'Collapsar', tank: 'Void Hulk' },
      rule: 'Unraveling', ruleDesc: 'Breaches ×2, loot +25%', breach: 2, loot: 1.25 },
    // Past the Mad Button: the lands behind the world, depths 40 to 64
    { id: 'library',   name: 'Sunken Library', minion: 'b_tome', lord: 'l_tome', fodder: 'f_page', outer: 1,
      minionName: 'Grimoire', lordName: 'The Drowned Archivist',
      zones: ['Flooded Stacks', 'The Reading Room', 'The Ink Well', 'The Forbidden Wing', 'The Archivist\u2019s Desk'],
      mobs: { runner: 'Inkling', spitter: 'Ink Spitter', bomber: 'Blotbomb', tank: 'Tome Golem' },
      rule: 'Ink Storm', ruleDesc: 'Spitters ×3, XP +30%', spit: 3, xp: 1.3 },
    { id: 'foundry',   name: 'Clockwork Foundry', minion: 'b_auto', lord: 'l_auto', fodder: 'f_cog', outer: 1,
      minionName: 'Automaton', lordName: 'The Gear Tyrant',
      zones: ['The Loading Bay', 'Conveyor Hall', 'The Smelter', 'The Piston Deep', 'The Tyrant\u2019s Engine'],
      mobs: { runner: 'Wind-up Mouse', spitter: 'Rivet Gun', bomber: 'Boiler Bot', tank: 'Iron Walker' },
      rule: 'Assembly Line', ruleDesc: 'Horde 40% thicker, tanks ×3', thick: 1.4, tanky: 3 },
    { id: 'ember',     name: 'Ember Wastes', minion: 'b_salam', lord: 'l_salam', fodder: 'f_ember', outer: 1,
      minionName: 'Salamander', lordName: 'The Ashen Colossus',
      zones: ['Cinder Road', 'The Glass Dunes', 'Magma Rivers', 'The Burnt Choir', 'The Colossus\u2019 Forge'],
      mobs: { runner: 'Cinder Hound', spitter: 'Magma Spitter', bomber: 'Ember Bomb', tank: 'Obsidian Brute' },
      rule: 'Firestorm', ruleDesc: 'Bombers ×3, blasts hit twice as hard', bomb: 3, boomPow: 2 },
    { id: 'mirror',    name: 'Mirror Maze', minion: 'b_mirror', lord: 'l_mirror', fodder: 'f_glass', outer: 1,
      minionName: 'Reflection', lordName: 'The Other Warden',
      zones: ['The Silver Door', 'Hall of Doubles', 'The Cracked Path', 'The Infinite Room', 'The Last Mirror'],
      mobs: { runner: 'Glint', spitter: 'Prism Eye', bomber: 'Shatterling', tank: 'Looking Glass' },
      rule: 'Echoes', ruleDesc: 'Runners ×2; big mobs shatter', run: 2, split: 0.5 },
    { id: 'sky',       name: 'Sky Citadel', minion: 'b_seraph', lord: 'l_hand', fodder: 'f_cherub', outer: 1,
      minionName: 'Seraph', lordName: 'The First Hand',
      zones: ['Cloud Steps', 'The Gilded Gate', 'The Choir Halls', 'The Throne Bridge', 'The Hand\u2019s Palace'],
      mobs: { runner: 'Cherub', spitter: 'Sun Lance', bomber: 'Halo Bomb', tank: 'Throne Guard' },
      rule: 'Thin Air', ruleDesc: 'Champions and rares ×2, loot +40%', champ: 2, rare: 2, loot: 1.4 },
    // Past the sky: the Moon and the sea of stars, depths 66 to 75
    { id: 'moon',      name: 'The Moon', minion: 'b_selenite', lord: 'l_selenite', fodder: 'f_selenite', outer: 1,
      minionName: 'Selenite Golem', lordName: 'The Selenite King',
      zones: ['The Sea of Tranquility', 'Crater Fields', 'The Dark Side', 'Moonstone Mines', 'The Lunar Throne'],
      mobs: { runner: 'Moon Hopper', spitter: 'Crater Spitter', bomber: 'Meteor Mite', tank: 'Moonstone Hulk' },
      rule: 'Low Gravity', ruleDesc: 'Horde 30% slower, twice as thick', slow: 0.7, thick: 2 },
    { id: 'cosmos',    name: 'The Star Sea', minion: 'b_voidwalker', lord: 'l_voidwalker', fodder: 'f_starling', outer: 1,
      minionName: 'Voidwalker', lordName: 'The Star Eater',
      zones: ['The Nebula Shore', 'Asteroid Drift', 'The Dead Satellite', 'The Event Horizon', 'The Star Eater\u2019s Maw'],
      mobs: { runner: 'Comet', spitter: 'Quasar Eye', bomber: 'Supernova', tank: 'Dwarf Star' },
      rule: 'Supernova', ruleDesc: 'Bombers ×3, loot +50%', bomb: 3, loot: 1.5 },
  ];
  // Invasions: now and then another world pours into the arena for a minute and a bit.
  // Hold it off and its herald comes; slay the herald for a big haul.
  G.INVASIONS = [
    { id: 'moon',   name: 'LUNAR INVASION',    sub: 'The Moon sends its children', col: '#c8d6ff', tint: '#1a2a6a', tintA: 0.28, sky: 'sky_moon',
      swarm: 'v_moonling', elite: 'v_lunar', boss: 'v_moonqueen', bossName: 'The Moon Queen' },
    { id: 'cosmic', name: 'COSMIC INVASION',   sub: 'Something from beyond the stars', col: '#7fff9a', tint: '#050818', tintA: 0.36, sky: 'sky_planet',
      swarm: 'v_grey', elite: 'v_saucer', boss: 'v_mothership', bossName: 'The Mothership' },
    { id: 'heaven', name: 'HEAVENLY CRUSADE',  sub: 'A hostile sky opens', col: '#ffe27a', tint: '#fff3c0', tintA: 0.22, sky: 'sky_sun',
      swarm: 'v_putto', elite: 'v_archon', boss: 'v_seraphim', bossName: 'The Seraphim' },
    { id: 'deep',   name: 'ABYSSAL TIDE',      sub: 'The deep floods in', col: '#4fe0c8', tint: '#062a2a', tintA: 0.3, sky: 'sky_eye',
      swarm: 'v_squidling', elite: 'v_deepone', boss: 'v_leviathan', bossName: 'The Leviathan' },
  ];
  G.INV_BY_ID = {}; G.INVASIONS.forEach(v => G.INV_BY_ID[v.id] = v);
  // The Horde changes as you go deeper into a land: each zone brings a new kind of mob.
  // Per zone (0-4), the share of packs led by each kind; fodder swarms fill the rest.
  G.ARCHETYPES = {
    runner:  { w: 0.05, spd: 2.5, gold: 1, from: 1, name: 'Runners', desc: 'Fast, in streams' },
    spitter: { w: 0.6, spd: 0.9, gold: 1.3, from: 2, name: 'Spitters', desc: 'Spit at the Button from range' },
    bomber:  { w: 0.4, spd: 1.5, gold: 1.2, from: 3, name: 'Bombers', desc: 'Explode on death, hurting the Horde' },
    tank:    { w: 3, spd: 0.55, gold: 1.6, from: 4, name: 'Tanks', desc: 'Slow, armoured, big loot' },
    // 2.5: kinds that holding the Button down doesn't answer. land: the first land (0-based) they come in
    warded:   { w: 1.2, spd: 0.8, gold: 1.5, land: 1, hp: 2.5, name: 'Warded', desc: 'Resist the Hand\u2019s lightning; your party must kill them' },
    charger:  { w: 1.5, spd: 0.7, gold: 1.4, land: 1, hp: 1.6, name: 'Chargers', desc: 'Creep in, then charge the Button hard' },
    healer:   { w: 1, spd: 0.8, gold: 1.6, land: 2, hp: 1.4, name: 'Menders', desc: 'Heal the Horde from behind. Kill first' },
    summoner: { w: 1.4, spd: 0.7, gold: 1.8, land: 3, hp: 1.8, name: 'Callers', desc: 'Summon more Horde from range' },
  };
  G.NEW_KINDS = ['warded', 'charger', 'healer', 'summoner'];
  G.ZONE_MIX = [
    { runner: 0.08, spitter: 0,    bomber: 0,    tank: 0 },
    { runner: 0.22, spitter: 0,    bomber: 0,    tank: 0 },
    { runner: 0.2,  spitter: 0.12, bomber: 0,    tank: 0 },
    { runner: 0.2,  spitter: 0.12, bomber: 0.16, tank: 0 },
    { runner: 0.2,  spitter: 0.14, bomber: 0.16, tank: 0.08 },
  ];
  G.ZONE_NAME = d => { const r = G.REALMS[G.realmIndex(d)]; return r.zones[G.ZONE_LOOK(((d % G.REALM_SIZE) + G.REALM_SIZE) % G.REALM_SIZE)]; };

  // ---------- 4.0: the Siege (js/run.js) ----------
  // Each land sits in one act's pool (1-3; the Void is the finale, act 0). start: open from the first run; the rest open
  // with Deeds. Mob health follows depth, not land, so any land of an act fits either of its slots.
  const ACT_OF = { shore: [1, 1], meadow: [1, 1], forest: [1, 1], highlands: [1, 0], tundra: [1, 0], godlands: [2, 1], abyss: [2, 1],
    library: [2, 0], foundry: [2, 0], ember: [3, 1], mirror: [3, 0], sky: [3, 1], moon: [3, 0], cosmos: [3, 0], void: [0, 1] };
  G.REALMS.forEach(r => { const a = ACT_OF[r.id] || [0, 0]; r.act = a[0]; r.start = a[1]; });
  G.REALM_BY_ID = {}; G.REALMS.forEach((r, i) => { G.REALM_BY_ID[r.id] = i; });
  // A Siege: 6 lands of 3 zones in 3 acts. Land slot k (0-5) holds depths 3k..3k+2; its lord is at 3k+2.
  // The lords of lands 2 and 4 are the act bosses; the 6th land is always the Void, whose lord is the Mad Button.
  // ROUTE: until doors exist, each act's lands in this order (the first ever run is Shoreline, then Meadows...)
  G.SIEGE = { lands: 6, zones: 18, final: 17, actOf: [1, 1, 2, 2, 3, 0], actBoss: [5, 11],
    ROUTE: { 1: ['shore', 'meadow', 'forest', 'highlands', 'tundra'], 2: ['godlands', 'abyss', 'library', 'foundry'],
      3: ['ember', 'sky', 'mirror', 'moon', 'cosmos'], 0: ['void'] } };
  // Fame (the score; buys the Hall of Fame), paid on every end: zone i cleared 4+i (225 over a Siege), a lord +10, an act
  // boss +20 on top, a win +100 (+25 under par), a Push land +30, the Daily's first attempt +50, a Button's first Heat sticker +25
  G.FAME = { zone: i => 4 + i, lord: 10, act: 20, win: 100, par: 25, push: 30, daily: 50, sticker: 25 };
  // Embers (from the Furnace): each worn or bagged item burns for EMBER_R[rarity] (a unique 20, an old relic item 60)
  // x (1 + il/20) x (1 + 0.1 enchant); shards 1 per 25; orbs by kind; Keys 10 each. The run's pouch takes boss kills and
  // the loot moment's unpicked cards. Then x the end (fall/abandon 0.5, extract 1, win 1.5) x (1 + 0.15 Heat)
  // (4.0 tuning, measured with the bots once the loot moment replaced the boss showers: DESIGN's [1,2,3,5,8,15,30], unique 20,
  // relic 60 and orbs 1/1/3/3/10 paid 1.6-2x the targets at every checkpoint (a first fall at depth 7 ~160 vs 60-100, an
  // Act II fall ~280 vs 120-200, an Act II extract ~700 vs 250-400, a Heat-0 win ~2,150 vs 1,200-1,500): the bag is full
  // by Act I and Temper raises every worn piece. Halved, they land in the bands; the kill Embers stay as designed)
  G.EMBER_R = [0.5, 1, 1.5, 2.5, 4, 7.5, 15];
  G.EMBERS = { uq: 10, relic: 30, shard: 25, orb: { whet: 0.5, flux: 0.5, ruin: 1.5, ascent: 1.5, grace: 5 }, key: 10,
    kill: { boss: 2, lord: 10, act: 25, final: 100 }, end: { fall: 0.5, abandon: 0.5, extract: 1, win: 1.5 }, heat: 0.15, card: 0.5 };
  // Heat 0-10 (chosen at setup; Heat N opens with a win at N-1). Each level: Horde and boss health x1.15, bites x1.10,
  // Fame x(1+0.2n), Embers x(1+0.15n), rarity +n/3, drops +15%. And the named rules, cumulative:
  G.HEAT_MAX = 10;
  G.HEAT_RULES = [
    { n: 1, id: 'champ', name: 'Champions', desc: 'A Land Champion in every land' },
    { n: 2, id: 'gold', name: 'Lean Purse', desc: 'Gold -25%' },
    { n: 3, id: 'lords', name: 'Hardened Lords', desc: 'Lords +1 affix; DOOM x0.8' },
    { n: 4, id: 'worn', name: 'Worn Down', desc: 'Start at 80% health; Rest heals 25%' },
    { n: 5, id: 'scarce', name: 'Scarcity', desc: '2-card offers; no Continue' },
    { n: 6, id: 'doom', name: 'Full DOOM', desc: 'DOOM at full strength' },
    { n: 7, id: 'reaper', name: 'The Reaper', desc: '2 min behind par: bites +10% for every further minute' },
    { n: 8, id: 'cursed', name: 'Cursed Doors', desc: 'One cursed door at each fork (mod x2, reward x2)' },
    { n: 9, id: 'escort', name: 'Escorts', desc: 'Act bosses bring their Land Champion' },
    { n: 10, id: 'mad', name: 'Madness', desc: 'The Mad Button at double strength; Integrity 2' },
  ];

  // ---------- 4.0: cards, schools, gear ranks (DESIGN §5.1-5.2) ----------
  // Each perk's school (a card is drawn from a school already owned 60% of the time; mythic and divine gear roll perk ranks
  // from the wearer's class schools)
  G.SCHOOLS = ['storm', 'blades', 'fire', 'frost', 'bastion', 'greed', 'party'];
  G.PERK_SCHOOL = {
    thunder: 'storm', chain: 'storm', crush: 'storm', mark: 'storm',
    blades: 'blades', cleave: 'blades', multi: 'blades', overkill: 'blades', momentum: 'blades', frenzy: 'blades', might: 'blades', glass: 'blades',
    burn: 'fire', corpse: 'fire', nova: 'fire', aura: 'fire',
    frost: 'frost', reach: 'frost', ricochet: 'frost', execute: 'frost',
    bulwark: 'bastion', aegis: 'bastion', thorns: 'bastion', secondwind: 'bastion', leech: 'bastion', fortress: 'bastion', laststand: 'bastion',
    greed: 'greed', loot: 'greed', plunder: 'greed', avarice: 'greed', souls: 'greed',
    warband: 'party',
  };
  G.CLASS_SCHOOLS = { knight: ['blades', 'bastion'], archer: ['frost', 'blades'], wizard: ['fire', 'storm'], rogue: ['blades', 'greed'], cleric: ['bastion', 'storm'] };
  // the perks the Deeds unlock (DESIGN §4.8: 22 of 33 open at the start). The meta's G.perkOpen(id) reads it; without the
  // meta every perk is open
  G.PERK_LOCKED = ['overkill', 'momentum', 'laststand', 'ricochet', 'souls', 'crush', 'mark', 'warband', 'glass', 'fortress', 'avarice'];
  // a unique's theme perk: it carries 2 ranks of it (+1 at Codex rank 2 and 4)
  G.UQ_THEME = { pincer: 'corpse', goldgrin: 'greed', windripper: 'multi', cleaver: 'cleave', sporeheart: 'leech', stormcaller: 'chain',
    nightfang: 'execute', headhunter: 'mark', frostwalk: 'frost', watcher: 'nova', hellstring: 'overkill', voidplate: 'thorns',
    reaper: 'momentum', lastbutton: 'crush', codex: 'souls', tyrant: 'might', ashbringer: 'burn', othercloak: 'aegis', firsthand: 'thunder' };

  // ---------- 4.0: companions' traits (DESIGN §5.4): a recruit is a class plus one of these ----------
  //   dmg/hp/spd/crit/heal: that companion's own; party: the whole party's damage; luck: the loot moment's luck
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

  // ---------- 4.0: doors (DESIGN §5.6): each land's map mod (the risk) and reward tag ----------
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

  // ---------- 4.0: shrines (DESIGN §5.8): charged by holding the Hand on them 2 s ----------
  G.SHRINE_KINDS = {
    power: { w: 35, col: '#ffd84a', name: 'Shrine of Power', desc: 'Pick 1 of 3 run boons' },
    chance: { w: 20, col: '#7fe9ff', name: 'Shrine of Chance', desc: 'Pay 15% of your gold: a boon, a better loot card, or nothing' },
    pact: { w: 25, col: '#b36bff', name: 'Shrine of Pacts', desc: 'A curse now, a reward at the lord' },
    fury: { w: 20, col: '#ff4f7e', name: 'Shrine of Fury', desc: '15 s of Frenzy, Greed, Storm or Slaughter' },
  };
  // the run boons a Power shrine offers (the old blessing cards' effects: they last the rest of the run)
  G.BOONS = {
    dmg: { name: '+10% damage', fx: (n, d) => { d.heroMult *= 1 + 0.1 * n; } },
    spd: { name: '+10% attack speed', fx: (n, d) => { d.spdMult *= 1 + 0.1 * n; } },
    hp: { name: '+15% health', fx: (n, d) => { d.hpMult *= 1 + 0.15 * n; } },
    crit: { name: '+3% crit', fx: (n, d) => { d.crit += 0.03 * n; } },
    gold: { name: '+20% gold', fx: (n, d) => { d.goldMult *= 1 + 0.2 * n; } },
    xp: { name: '+15% XP', fx: (n, d) => { d.xpMult = (d.xpMult || 1) * (1 + 0.15 * n); } },
    reroll: { name: '+1 card reroll', once: 1 },
  };
  // Pacts: a curse now, a reward at the lord (blood, greed, hunt: this land; glass: the rest of the run)
  G.PACTS = {
    blood: { name: 'Blood Pact', desc: 'Horde +50% health in this land; the lord’s loot +1 rarity and +1 card', land: { mobHp: 1.5 } },
    glass: { name: 'Glass Pact', desc: 'x0.6 health, x1.4 damage for the rest of the run' },
    greed: { name: 'Greed Pact', desc: 'Bites +40% in this land; gold x2.5 in this land', land: { bite: 1.4, gold: 2.5 } },
    hunt: { name: 'Hunt Pact', desc: 'A second Land Champion now: +1 Key and a 20% unique card at the lord' },
  };

  // Land mastery: three stars per land, kept forever. 4.0: cosmetic completion marks (+1 Gem each): no hidden power
  G.STAR_BONUS = 0;
  G.STAR_KILLS = i => 18000 * (1 + 0.1 * i); // 2.1: the Horde comes 1.4-2x thicker
  G.STAR_SWIFT = 20;

  // ---------- The Hall of Fame (4.0; the 3.x Legacy re-made): capped ranks bought with Fame ----------
  // Rank k costs base x k^2 (sq). At max: damage x1.2, speed x1.15, crit +5%, bosses x1.25, health x1.3; the rest are run
  // knobs read at a run's start (hf_wind, hf_reroll, hf_banish, hf_belt) or by the camp, doors and setup streams (hf_door,
  // hf_keep, hf_qm). Same G.LEGACY / S.legacy / G.buyLegacy as before, so the 3.x Temple panel shows it as it is.
  // (3.x lg_* ranks are gone with season 3: their Fame became new Fame, G.foundersGift)
  G.LEGACY = [
    { id: 'hf_might', base: 60, sq: 1, max: 5, name: 'Ancestral Might', desc: 'Party damage +4% a rank', fx: (L, D) => { D.heroMult *= 1 + 0.04 * L; } },
    { id: 'hf_iron', base: 60, sq: 1, max: 5, name: 'Iron Will', desc: 'Button and party health +6% a rank', fx: (L, D) => { D.hpMult *= 1 + 0.06 * L; } },
    { id: 'hf_swift', base: 80, sq: 1, max: 5, name: 'Swift Hands', desc: 'Attack speed +3% a rank', fx: (L, D) => { D.spdMult *= 1 + 0.03 * L; } },
    { id: 'hf_keen', base: 80, sq: 1, max: 5, name: 'Keen Eye', desc: 'Crit chance +1% a rank', fx: (L, D) => { D.crit += 0.01 * L; } },
    { id: 'hf_boss', base: 80, sq: 1, max: 5, name: 'Boss Slayer', desc: 'Boss damage +5% a rank', fx: (L, D) => { D.bossMult *= 1 + 0.05 * L; } },
    { id: 'hf_xp', base: 40, sq: 1, max: 5, name: 'Scholar', desc: 'XP +5% a rank', fx: (L, D) => { D.xpMult = (D.xpMult || 1) * (1 + 0.05 * L); } },
    { id: 'hf_gold', base: 40, sq: 1, max: 5, name: 'Greed', desc: 'Gold +8% a rank', fx: (L, D) => { D.goldMult *= 1 + 0.08 * L; } },
    { id: 'hf_chest', base: 40, sq: 1, max: 5, name: 'Treasure Sense', desc: 'Chest find +10% a rank', fx: (L, D) => { D.chestProg *= 1 + 0.1 * L; } },
    { id: 'hf_fame', base: 100, sq: 1, max: 5, name: 'Renown', desc: 'Fame +5% a rank', fx: (L, D) => { D.fameMult *= 1 + 0.05 * L; } },
    { id: 'hf_wind', base: 400, sq: 1, max: 1, name: 'Second Wind', desc: '+1 Integrity pip', fx: () => {} },
    { id: 'hf_reroll', base: 120, sq: 1, max: 3, name: 'Reroll', desc: '+1 card reroll a run', fx: () => {} },
    { id: 'hf_banish', base: 120, sq: 1, max: 3, name: 'Banish', desc: '+1 banish a run', fx: () => {} },
    { id: 'hf_door', base: 300, sq: 1, max: 1, name: 'Third Door', desc: '3 land doors at each fork', fx: () => {} },
    { id: 'hf_belt', base: 500, sq: 1, max: 2, name: 'Relic Belt', desc: '+1 belt slot', fx: () => {} },
    { id: 'hf_keep', base: 1500, sq: 1, max: 1, name: 'Heirloom Shelf', desc: '+1 keepsake slot', fx: () => {} },
    { id: 'hf_qm', base: 200, sq: 1, max: 2, name: 'Quartermaster', desc: '+1 camp market offer', fx: () => {} },
  ];
  G.LEGACY_BY_ID = {}; G.LEGACY.forEach(l => G.LEGACY_BY_ID[l.id] = l);

  // ---------- Button skins ----------
  G.SKINS = [
    { id: 'classic',  base: '#e8413c', name: 'Classic',  unlock: null },
    { id: 'emerald',  base: '#2fc46a', name: 'Emerald',  unlock: 'chests_100' },
    { id: 'sapphire', base: '#3f7bff', name: 'Sapphire', unlock: 'depth_10' },
    { id: 'amethyst', base: '#a048ff', name: 'Amethyst', unlock: 'asc_1' },
    { id: 'gold',     base: '#ffc629', name: 'Gold',     unlock: 'gold_1e9' },
    { id: 'obsidian', base: '#3a3348', name: 'Obsidian', unlock: 'madbutton' },
    { id: 'rainbow',  base: 'rainbow', name: 'Rainbow',  unlock: 'all_items' },
    { id: 'divine',   base: '#f4f6ff', name: 'Divine',   unlock: 'first_divine' },
  ];

  // ---------- Wisp buffs (golden-cookie style event) ----------
  // 4.0: the Golden Clicks (DESIGN §5.8): Frenzy (gold x7 and party damage x1.5 for 20 s), Loot Storm (+1 card at the next
  // loot moment, a rare floor), Chest Rain, Click Storm, an egg. (lucky stays for old readers, weight 0)
  G.WISP_EFFECTS = [
    { id: 'frenzy', w: 40, name: 'Frenzy! Gold ×7, damage ×1.5', dur: 20 },
    { id: 'lootstorm', w: 25, name: 'Loot Storm! +1 card at the next loot moment' },
    { id: 'rain',   w: 20, name: 'Chest Rain!' },
    { id: 'storm',  w: 14, name: 'Click Storm! Click ×77', dur: 10 },
    { id: 'egg',    w: 1,  name: 'A pet egg!' },
    { id: 'lucky',  w: 0,  name: 'Lucky! A sack of gold' },
  ];

  // ---------- Daily login rewards (7-day cycle) ----------
  G.DAILY = [
    { kind: 'gold', mins: 10 }, { kind: 'eggs', n: 2 }, { kind: 'gold', mins: 30 }, { kind: 'ess', n: 25 },
    { kind: 'eggs', n: 4 }, { kind: 'gold', mins: 90 }, { kind: 'chest', tier: 6 },
  ];
})(globalThis.G = globalThis.G || {});
