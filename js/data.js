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
    { id: 'rogue',    name: 'Rogue',       cost: 50,     gps: 0.2,    shot: '#9aa0a8' },
    { id: 'archer',   name: 'Archer',      cost: 400,    gps: 1.2,    shot: '#9be15d' },
    { id: 'wizard',   name: 'Wizard',      cost: 4500,   gps: 8,      shot: '#5ab4ff' },
    { id: 'priest',   name: 'Priestess',   cost: 50000,  gps: 45,     shot: '#fff3a0' },
    { id: 'warrior',  name: 'Warrior',     cost: 5.5e5,  gps: 260,    shot: '#ff7a4a' },
    { id: 'knight',   name: 'Knight',      cost: 6e6,  gps: 1400,   shot: '#cfd8e0' },
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
      desc: '+1 click power. Levels 10, 25, 50, 75… double clicks',
      fx: (L, D) => { D.clickAdd += L; D.clickMult *= Math.pow(2, G.FINGER_MILESTONES.filter(m => L >= m).length); } },
    { id: 'might', icon: 'ic_rune', base: 5000, growth: 30, max: 15,
      name: 'Rune of Might',
      desc: 'Click gold ×1.5 per level',
      fx: (L, D) => { D.clickMult *= Math.pow(1.5, L); } },
    { id: 'echo', icon: 'ic_echo', base: 100000.0, growth: 15, max: 10,
      name: 'Echo Strike',
      desc: 'Each click adds +1% of garrison income per level',
      fx: (L, D) => { D.clickGpsPct += 0.01 * L; } },
    { id: 'keen', icon: 'ic_eye', base: 200, growth: 2.5, max: 20,
      name: 'Keen Eye',
      desc: '+0.5% critical click chance',
      fx: (L, D) => { D.crit += 0.005 * L; } },
    { id: 'deadly', icon: 'ic_skull', base: 1000, growth: 3.5, max: 15,
      name: 'Deadly Blow',
      desc: 'Crit multiplier +0.5',
      fx: (L, D) => { D.critMult += 0.5 * L; } },
    { id: 'sense', icon: 'ic_nose', base: 100, growth: 2.4, max: 20,
      name: 'Treasure Sense',
      desc: 'Chests appear 5% more often',
      fx: (L, D) => { D.chestProg += 0.05 * L; } },
    { id: 'hall', icon: 'ic_vault', base: 400, growth: 12, max: 6,
      name: 'Treasure Hall',
      desc: 'Room for more chests on the field: 10, 20, 30, 50, 100, then 200',
      fx: (L, D) => { D.slots += G.HALL_SLOTS[L] - G.HALL_SLOTS[0]; } },
    { id: 'golem', icon: 'ic_key', base: 600, growth: 3.2, max: 20,
      name: 'Looter',
      desc: 'A Looter runs to your chests and opens them: one every 3 s, each level 10% faster',
      fx: (L, D) => { if (L > 0) D.autoOpen = 3 * Math.pow(0.9, L - 1); } },
    { id: 'crew', icon: 'ic_crew', base: 40000, growth: 30, max: 4, req: 'golem',
      name: 'Loot Crew',
      desc: 'One more Looter running for your chests (needs the Looter)',
      fx: (L, D) => { D.looters += L; } },
    { id: 'clover', icon: 'ic_clover', base: 1000, growth: 2.8, max: 20,
      name: 'Four-Leaf Clover',
      desc: '+3% luck: better chests',
      fx: (L, D) => { D.luck += 0.03 * L; } },
    { id: 'appraiser', icon: 'ic_scale', base: 500, growth: 2.8, max: 20,
      name: 'Appraiser',
      desc: 'Items are worth 5% more',
      fx: (L, D) => { D.itemMult *= 1 + 0.05 * L; } },
    { id: 'rhythm', icon: 'ic_note', base: 1000, growth: 4, max: 10,
      name: 'Rhythm',
      desc: 'Max combo +25',
      fx: (L, D) => { D.comboCap += 25 * L; } },
    { id: 'clockwork', icon: 'ic_gear', base: 10000, growth: 2.8, max: 20,
      name: 'Clockwork Hand',
      desc: '+0.5 auto clicks per second',
      fx: (L, D) => { D.autoCps += 0.5 * L; } },
    { id: 'prince', icon: 'ic_crown', base: 1e17, growth: 1, max: 1, secret: 1e13,
      name: "The Prince's Crown",
      desc: 'All gold ×3. The Button is crowned.',
      fx: (L, D) => { if (L) D.goldMult *= 3; } },
  ];

  // ---------- Chest modifiers ----------
  G.MODIFIERS = [
    { id: 'golden',    color: '#ffd84a', name: 'Golden',    desc: 'Bursts with gold' },
    { id: 'lightning', color: '#7fe9ff', name: 'Storm',     desc: 'Lightning opens nearby chests' },
    { id: 'ghost',     color: '#d8e6ff', name: 'Ghost',     desc: 'Loot is duplicated' },
    { id: 'chromatic', color: '#ff7ae6', name: 'Chromatic', desc: 'Best of 3 rarity rolls' },
    { id: 'frozen',    color: '#9fd8ff', name: 'Frozen',    desc: 'Crack the ice (8 clicks) for 3 items' },
    { id: 'blazing',   color: '#ff7a2e', name: 'Blazing',   desc: '×5 value, burns out in 6s' },
    { id: 'mimic',     color: '#d94040', name: 'Mimic',     desc: 'It bites! Defeat it for 5 items' },
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
    C('c_prec', -1, -2, 'click', ['c_surge'], 5, 4, 1.8, 'Precision', 'Crit chance +1%',
      (L, D) => { D.crit += 0.01 * L; }),
    C('c_brut', 1, -2, 'click', ['c_surge'], 5, 4, 1.8, 'Brutality', 'Crit multiplier +1',
      (L, D) => { D.critMult += 1 * L; }),
    C('c_flow', 0, -3, 'click', ['c_prec', 'c_brut'], 3, 12, 2.2, 'Flow', 'Max combo +40',
      (L, D) => { D.comboCap += 40 * L; }),
    C('c_echo', -1, -4, 'click', ['c_flow'], 5, 30, 2, 'Resonance', 'Clicks +1% of garrison income',
      (L, D) => { D.clickGpsPct += 0.01 * L; }),
    C('c_frenzy', 1, -4, 'click', ['c_flow'], 3, 25, 2, 'Rapture', 'Wisp buffs last 25% longer',
      (L, D) => { D.buffDur += 0.25 * L; }),
    C('c_thunder', 0, -5, 'click', ['c_echo', 'c_frenzy'], 1, 200, 1, 'Thunder Palm', 'Every 25th click is a MEGA click ×30',
      (L, D) => { D.mega = L > 0; }),
    // Idle arm (right)
    C('i_guild', 1, 0, 'idle', ['spark'], 5, 2, 1.7, 'Guild Hall', 'Garrison income +15%',
      (L, D) => { D.gpsMult *= 1 + 0.15 * L; }),
    C('i_vet', 2, -1, 'idle', ['i_guild'], 3, 10, 2.5, 'Veterans', 'Heroes +0.5% per 10 heroes owned',
      (L, D) => { D.vet += 0.005 * L; }),
    C('i_scout', 2, 1, 'idle', ['i_guild'], 5, 8, 2, 'Scouts', 'Heroes find 0.1 chests/sec',
      (L, D) => { D.scout += 0.1 * L; }),
    C('i_watch', 3, 0, 'idle', ['i_vet', 'i_scout'], 5, 12, 2, 'Night Watch', 'Offline income +10% and +1h cap',
      (L, D) => { D.offEff += 0.1 * L; D.offCap += 3600 * L; }),
    C('i_banner', 4, -1, 'idle', ['i_watch'], 5, 40, 2.2, 'War Banner', 'Garrison income +25%',
      (L, D) => { D.gpsMult *= 1 + 0.25 * L; }),
    C('i_clock', 4, 1, 'idle', ['i_watch'], 5, 35, 2.2, 'Clockmaker', '+1 auto click per second',
      (L, D) => { D.autoCps += L; }),
    C('i_legion', 5, 0, 'idle', ['i_banner', 'i_clock'], 1, 200, 1, 'Legion', 'Each hired hero class: all gold +8%',
      (L, D) => { D.legion = L > 0; }),
    // Chest arm (down)
    C('h_nose', 0, 1, 'chest', ['spark'], 5, 2, 1.7, 'Keen Nose', 'Chests 10% more often',
      (L, D) => { D.chestProg += 0.1 * L; }),
    C('h_fusion', -1, 2, 'chest', ['h_nose'], 1, 6, 1, 'Fusion', 'When the room is full, 3 equal chests fuse into a better one',
      (L, D) => { D.merge = L > 0; }),
    C('h_gild', 1, 2, 'chest', ['h_nose'], 1, 5, 1, 'Gilding', 'Unlocks Golden chests. Modifier chance +2%',
      (L, D) => { if (L) { D.mods.golden = 1; D.modChance += 0.02; } }),
    C('h_double', -2, 3, 'chest', ['h_fusion'], 5, 12, 2, 'False Bottom', '+5% chance of double loot',
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
    C('a_flow', -1, 0, 'arcane', ['spark'], 5, 2, 1.7, 'Essence Flow', 'Essence +20%',
      (L, D) => { D.essMult *= 1 + 0.2 * L; }),
    C('a_hatch', -2, -1, 'arcane', ['a_flow'], 5, 10, 2, 'Nesting', 'Eggs drop 15% more often',
      (L, D) => { D.eggMult *= 1 + 0.15 * L; }),
    C('a_slayer', -2, 1, 'arcane', ['a_flow'], 5, 8, 1.9, 'Bossbane', 'Boss damage +30%',
      (L, D) => { D.bossMult *= 1 + 0.3 * L; }),
    C('a_bond', -3, -1, 'arcane', ['a_hatch'], 5, 20, 2, 'Bond', 'Pet power +15%',
      (L, D) => { D.petMult *= 1 + 0.15 * L; }),
    C('a_time', -3, 1, 'arcane', ['a_slayer'], 3, 15, 2.2, 'Time Dilation', 'Boss timer +4s',
      (L, D) => { D.bossTime += 4 * L; }),
    C('a_wisp', -4, 0, 'arcane', ['a_bond', 'a_time'], 3, 25, 2, 'Wisp Lure', 'Wisps appear 20% more often',
      (L, D) => { D.wispRate *= 1 + 0.2 * L; }),
    C('a_nest', -4, -1, 'arcane', ['a_bond'], 2, 60, 4, 'Great Nest', '+1 pet slot',
      (L, D) => { D.petSlots += L; }),
    C('a_hunt', -4, 1, 'arcane', ['a_time'], 1, 30, 1, 'The Hunt', 'A boss you can\u2019t beat yet comes back after 20s instead of 60s; the clear bar needs 20% fewer kills',
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
  G.REALM_SIZE = 5; // depths per realm; the 5th depth is the realm lord
  G.REALMS = [
    { id: 'shore',     name: 'Shoreline',  minion: 'b_crab',   lord: 'l_crab',   fodder: 'f_crab',
      minionName: 'Sand Crab', lordName: 'The Crab King',
      zones: ['Tide Pools', 'Wreck Cove', 'Salt Flats', 'Coral Maze', 'The Crab King\u2019s Throne'],
      mobs: { runner: 'Gull', spitter: 'Spitting Clam', bomber: 'Puffer', tank: 'Hermit Shell' },
      rule: 'Treasure Tides', ruleDesc: 'Hoarders come twice as often', hoard: 2 },
    { id: 'meadow',    name: 'Meadows',    minion: 'b_goblin', lord: 'l_goblin', fodder: 'f_goblin',
      minionName: 'Goblin', lordName: 'Goblin Warchief',
      zones: ['Sunny Fields', 'Goblin Camp', 'The Old Mill', 'Raider Road', 'Warchief\u2019s Hill'],
      mobs: { runner: 'Warg Pup', spitter: 'Goblin Slinger', bomber: 'Powder Goblin', tank: 'Boar Rider' },
      rule: 'Goblin Raids', ruleDesc: 'Surges come 50% bigger and last longer', surge: 1.5 },
    { id: 'forest',    name: 'Deepwood',   minion: 'b_shroom', lord: 'l_tree',   fodder: 'f_spore',
      minionName: 'Shroomling', lordName: 'Elder Treant',
      zones: ['Mossy Trail', 'Rotting Hollow', 'Spore Glade', 'Witchroot', 'Heart of the Wood'],
      mobs: { runner: 'Thornback', spitter: 'Spore Spitter', bomber: 'Puffball', tank: 'Barkhide' },
      rule: 'Sporefall', ruleDesc: 'Big mobs often burst into spores when they die', split: 0.4 },
    { id: 'highlands', name: 'Highlands',  minion: 'b_golem',  lord: 'l_titan',  fodder: 'f_pebble',
      minionName: 'Stone Golem', lordName: 'Mountain Titan',
      zones: ['Foothills', 'The Quarry', 'Windy Pass', 'Golem Graves', 'Titan\u2019s Seat'],
      mobs: { runner: 'Rockhound', spitter: 'Pebble Thrower', bomber: 'Blasting Cap', tank: 'Boulder' },
      rule: 'Stoneskin', ruleDesc: 'Brutes take half damage and drop twice the loot', stone: 1 },
    { id: 'tundra',    name: 'Frostlands', minion: 'b_yeti',   lord: 'l_wyrm',   fodder: 'f_snow',
      minionName: 'Yeti', lordName: 'Frost Wyrm',
      zones: ['Frozen Lake', 'Snowdrift', 'Ice Caves', 'Yeti Den', 'The Wyrm\u2019s Glacier'],
      mobs: { runner: 'Snow Fox', spitter: 'Frost Spitter', bomber: 'Ice Bomb', tank: 'Glacier Beetle' },
      rule: 'Blizzard', ruleDesc: 'The Horde walks 25% slower, champions come twice as often', slow: 0.75, champ: 2 },
    { id: 'godlands',  name: 'Godlands',   minion: 'b_eye',    lord: 'l_eye',    fodder: 'f_eye',
      minionName: 'Watcher', lordName: 'The All-Seeing Eye',
      zones: ['Pilgrim Steps', 'The Fallen Temple', 'Hall of Eyes', 'Starfield', 'The Watching Throne'],
      mobs: { runner: 'Seeker', spitter: 'Gazer', bomber: 'Star Spark', tank: 'Temple Guard' },
      rule: 'Watchful Eyes', ruleDesc: 'Shrines rise twice as often, rares come 60% more', shrine: 2, rare: 1.6 },
    { id: 'abyss',     name: 'Abyss',      minion: 'b_imp',    lord: 'l_demon',  fodder: 'f_bat',
      minionName: 'Fiend', lordName: 'Demon Lord',
      zones: ['Brimstone Gate', 'The Ash Fields', 'Chain Pits', 'The Burning Keep', 'The Demon\u2019s Seat'],
      mobs: { runner: 'Hellhound', spitter: 'Fire Spitter', bomber: 'Brimstone Imp', tank: 'Hellforged' },
      rule: 'Hellfire', ruleDesc: 'One mob in four explodes when it dies, and blasts chain', boom: 0.25 },
    { id: 'void',      name: 'The Void',   minion: 'b_wraith', lord: 'l_button', fodder: 'f_shade',
      minionName: 'Void Wraith', lordName: 'The Mad Button',
      zones: ['Edge of Nothing', 'Hollow Stars', 'The Broken Stair', 'The Unmaking', 'The Mad Button'],
      mobs: { runner: 'Flicker', spitter: 'Null Spitter', bomber: 'Collapsar', tank: 'Void Hulk' },
      rule: 'Unraveling', ruleDesc: 'Breaches tear open twice as often, loot +25%', breach: 2, loot: 1.25 },
    // Past the Mad Button: the lands behind the world, depths 40 to 64
    { id: 'library',   name: 'Sunken Library', minion: 'b_tome', lord: 'l_tome', fodder: 'f_page', outer: 1,
      minionName: 'Grimoire', lordName: 'The Drowned Archivist',
      zones: ['Flooded Stacks', 'The Reading Room', 'The Ink Well', 'The Forbidden Wing', 'The Archivist\u2019s Desk'],
      mobs: { runner: 'Inkling', spitter: 'Ink Spitter', bomber: 'Blotbomb', tank: 'Tome Golem' },
      rule: 'Ink Storm', ruleDesc: 'Spitters come three times as often, every kill gives 30% more XP', spit: 3, xp: 1.3 },
    { id: 'foundry',   name: 'Clockwork Foundry', minion: 'b_auto', lord: 'l_auto', fodder: 'f_cog', outer: 1,
      minionName: 'Automaton', lordName: 'The Gear Tyrant',
      zones: ['The Loading Bay', 'Conveyor Hall', 'The Smelter', 'The Piston Deep', 'The Tyrant\u2019s Engine'],
      mobs: { runner: 'Wind-up Mouse', spitter: 'Rivet Gun', bomber: 'Boiler Bot', tank: 'Iron Walker' },
      rule: 'Assembly Line', ruleDesc: 'The Horde is 40% thicker and tanks come three times as often', thick: 1.4, tanky: 3 },
    { id: 'ember',     name: 'Ember Wastes', minion: 'b_salam', lord: 'l_salam', fodder: 'f_ember', outer: 1,
      minionName: 'Salamander', lordName: 'The Ashen Colossus',
      zones: ['Cinder Road', 'The Glass Dunes', 'Magma Rivers', 'The Burnt Choir', 'The Colossus\u2019 Forge'],
      mobs: { runner: 'Cinder Hound', spitter: 'Magma Spitter', bomber: 'Ember Bomb', tank: 'Obsidian Brute' },
      rule: 'Firestorm', ruleDesc: 'Bombers come three times as often and their blasts tear through the Horde', bomb: 3, boomPow: 2 },
    { id: 'mirror',    name: 'Mirror Maze', minion: 'b_mirror', lord: 'l_mirror', fodder: 'f_glass', outer: 1,
      minionName: 'Reflection', lordName: 'The Other Warden',
      zones: ['The Silver Door', 'Hall of Doubles', 'The Cracked Path', 'The Infinite Room', 'The Last Mirror'],
      mobs: { runner: 'Glint', spitter: 'Prism Eye', bomber: 'Shatterling', tank: 'Looking Glass' },
      rule: 'Echoes', ruleDesc: 'Runners come twice as often, big mobs shatter into shards', run: 2, split: 0.5 },
    { id: 'sky',       name: 'Sky Citadel', minion: 'b_seraph', lord: 'l_hand', fodder: 'f_cherub', outer: 1,
      minionName: 'Seraph', lordName: 'The First Hand',
      zones: ['Cloud Steps', 'The Gilded Gate', 'The Choir Halls', 'The Throne Bridge', 'The Hand\u2019s Palace'],
      mobs: { runner: 'Cherub', spitter: 'Sun Lance', bomber: 'Halo Bomb', tank: 'Throne Guard' },
      rule: 'Thin Air', ruleDesc: 'Champions and rares come twice as often, loot +40%', champ: 2, rare: 2, loot: 1.4 },
    // Past the sky: the Moon and the sea of stars, depths 66 to 75
    { id: 'moon',      name: 'The Moon', minion: 'b_selenite', lord: 'l_selenite', fodder: 'f_selenite', outer: 1,
      minionName: 'Selenite Golem', lordName: 'The Selenite King',
      zones: ['The Sea of Tranquility', 'Crater Fields', 'The Dark Side', 'Moonstone Mines', 'The Lunar Throne'],
      mobs: { runner: 'Moon Hopper', spitter: 'Crater Spitter', bomber: 'Meteor Mite', tank: 'Moonstone Hulk' },
      rule: 'Low Gravity', ruleDesc: 'The Horde floats in 30% slower but twice as thick', slow: 0.7, thick: 2 },
    { id: 'cosmos',    name: 'The Star Sea', minion: 'b_voidwalker', lord: 'l_voidwalker', fodder: 'f_starling', outer: 1,
      minionName: 'Voidwalker', lordName: 'The Star Eater',
      zones: ['The Nebula Shore', 'Asteroid Drift', 'The Dead Satellite', 'The Event Horizon', 'The Star Eater\u2019s Maw'],
      mobs: { runner: 'Comet', spitter: 'Quasar Eye', bomber: 'Supernova', tank: 'Dwarf Star' },
      rule: 'Supernova', ruleDesc: 'Bombers come three times as often, loot +50%', bomb: 3, loot: 1.5 },
  ];
  // Invasions: now and then another world pours into the arena for a minute and a bit.
  // Hold it off and its herald comes; slay the herald for a big haul.
  G.INVASIONS = [
    { id: 'moon',   name: 'LUNAR INVASION',    sub: 'The Moon sends its children down', col: '#c8d6ff', tint: '#1a2a6a', tintA: 0.28, sky: 'sky_moon',
      swarm: 'v_moonling', elite: 'v_lunar', boss: 'v_moonqueen', bossName: 'The Moon Queen' },
    { id: 'cosmic', name: 'COSMIC INVASION',   sub: 'Something came from past the stars', col: '#7fff9a', tint: '#050818', tintA: 0.36, sky: 'sky_planet',
      swarm: 'v_grey', elite: 'v_saucer', boss: 'v_mothership', bossName: 'The Mothership' },
    { id: 'heaven', name: 'HEAVENLY CRUSADE',  sub: 'The sky opens and it is not friendly', col: '#ffe27a', tint: '#fff3c0', tintA: 0.22, sky: 'sky_sun',
      swarm: 'v_putto', elite: 'v_archon', boss: 'v_seraphim', bossName: 'The Seraphim' },
    { id: 'deep',   name: 'ABYSSAL TIDE',      sub: 'The ground floods with the deep', col: '#4fe0c8', tint: '#062a2a', tintA: 0.3, sky: 'sky_eye',
      swarm: 'v_squidling', elite: 'v_deepone', boss: 'v_leviathan', bossName: 'The Leviathan' },
  ];
  G.INV_BY_ID = {}; G.INVASIONS.forEach(v => G.INV_BY_ID[v.id] = v);
  // The Horde changes as you go deeper into a land: each zone brings a new kind of mob.
  // Per zone (0-4), the share of packs led by each kind; fodder swarms fill the rest.
  G.ARCHETYPES = {
    runner:  { w: 0.05, spd: 2.5, gold: 1, from: 1, name: 'Runners', desc: 'Fast. They come in streams' },
    spitter: { w: 0.6, spd: 0.9, gold: 1.3, from: 2, name: 'Spitters', desc: 'Stop at range and spit at the Button' },
    bomber:  { w: 0.4, spd: 1.5, gold: 1.2, from: 3, name: 'Bombers', desc: 'Blow up when they die, taking the Horde with them' },
    tank:    { w: 3, spd: 0.55, gold: 1.6, from: 4, name: 'Tanks', desc: 'Slow walls of armour. Big loot' },
  };
  G.ZONE_MIX = [
    { runner: 0.08, spitter: 0,    bomber: 0,    tank: 0 },
    { runner: 0.22, spitter: 0,    bomber: 0,    tank: 0 },
    { runner: 0.2,  spitter: 0.12, bomber: 0,    tank: 0 },
    { runner: 0.2,  spitter: 0.12, bomber: 0.16, tank: 0 },
    { runner: 0.2,  spitter: 0.14, bomber: 0.16, tank: 0.08 },
  ];
  G.ZONE_NAME = d => { const r = G.REALMS[G.realmIndex(d)]; return r.zones[((d % G.REALM_SIZE) + G.REALM_SIZE) % G.REALM_SIZE]; };

  // Land mastery: three stars per land, kept forever. Each one: +2.5% damage and gold
  G.STAR_BONUS = 0.025;
  G.STAR_KILLS = i => 18000 * (1 + 0.1 * i); // 2.1: the Horde comes 1.4-2x thicker
  G.STAR_SWIFT = 20;

  // ---------- Legacy: permanent upgrades bought with Fame ----------
  G.LEGACY = [
    { id: 'lg_click', base: 1, growth: 1.6, max: 25, name: 'Ancestral Might', desc: 'Clicks and Warden damage +40%',
      fx: (L, D) => { D.clickMult *= 1 + 0.4 * L; D.heroMult *= 1 + 0.4 * L; } },
    { id: 'lg_guild', base: 1, growth: 1.6, max: 25, name: 'Ancestral Guild', desc: 'Garrison income +40%',
      fx: (L, D) => { D.gpsMult *= 1 + 0.4 * L; } },
    { id: 'lg_start', base: 2, growth: 2, max: 8, name: 'Head Start', desc: 'Start each run with 1K gold, ×10 per level',
      fx: () => {} },
    { id: 'lg_luck', base: 3, growth: 1.8, max: 10, name: 'Lucky Star', desc: 'Luck +3%',
      fx: (L, D) => { D.luck += 0.03 * L; } },
    { id: 'lg_boss', base: 3, growth: 1.7, max: 15, name: 'Boss Slayer', desc: 'Boss damage +35%',
      fx: (L, D) => { D.bossMult *= 1 + 0.35 * L; } },
    { id: 'lg_pot', base: 4, growth: 2, max: 10, name: 'Potion Cellar', desc: 'Each potion cap +3',
      fx: (L, D) => { D.potCap += 3 * L; } },
    { id: 'lg_keeppot', base: 12, growth: 2.5, max: 4, name: 'Family Vault', desc: 'Keep 25% of potions on ascension',
      fx: () => {} },
    { id: 'lg_stars', base: 6, growth: 2, max: 5, name: 'Star Memory', desc: 'Start with 12% of last run\'s essence',
      fx: () => {} },
    { id: 'lg_fusion', base: 15, growth: 1, max: 1, name: 'Eternal Fusion', desc: 'Fusion and Gilding unlocked from the start',
      fx: (L, D) => { if (L) { D.merge = true; D.mods.golden = 1; } } },
    { id: 'lg_deep', base: 8, growth: 2.2, max: 10, name: 'Deep Dive', desc: 'Start 2 depths deeper',
      fx: () => {} },
    { id: 'lg_pet', base: 10, growth: 3, max: 2, name: 'Pet Carrier', desc: '+1 pet slot',
      fx: (L, D) => { D.petSlots += L; } },
    { id: 'lg_time', base: 5, growth: 2, max: 5, name: 'Time Warp', desc: 'Offline: +2h cap, +10% efficiency',
      fx: (L, D) => { D.offCap += 7200 * L; D.offEff += 0.1 * L; } },
    { id: 'lg_fame', base: 10, growth: 2, max: 10, name: 'Renown', desc: 'Fame gain +15%',
      fx: (L, D) => { D.fameMult *= 1 + 0.15 * L; } },
    { id: 'lg_quest', base: 5, growth: 2, max: 4, name: 'Quest Master', desc: 'Quest rewards +35%',
      fx: (L, D) => { D.questMult *= 1 + 0.35 * L; } },
    { id: 'lg_gold', base: 12, growth: 2.5, max: 4, name: 'Golden Touch', desc: 'Golden pet chance +2%',
      fx: (L, D) => { D.goldenChance += 0.02 * L; } },
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
  G.WISP_EFFECTS = [
    { id: 'frenzy', w: 40, name: 'Frenzy! Gold ×7', dur: 20 },
    { id: 'rain',   w: 24, name: 'Chest Rain!' },
    { id: 'lucky',  w: 24, name: 'Lucky! A sack of gold' },
    { id: 'storm',  w: 10, name: 'Click Storm! Click ×77', dur: 10 },
    { id: 'egg',    w: 2,  name: 'A pet egg!' },
  ];

  // ---------- Daily login rewards (7-day cycle) ----------
  G.DAILY = [
    { kind: 'gold', mins: 10 }, { kind: 'eggs', n: 2 }, { kind: 'gold', mins: 30 }, { kind: 'ess', n: 25 },
    { kind: 'eggs', n: 4 }, { kind: 'gold', mins: 90 }, { kind: 'chest', tier: 6 },
  ];
})(globalThis.G = globalThis.G || {});
