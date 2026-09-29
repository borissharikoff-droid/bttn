// BTTN — all game content. Names are bilingual {ru, en}; descriptions use {0}
// placeholders filled from val(level). Effects are applied in G.recalc().
(function (G) {
  'use strict';

  // ---------- Rarities ----------
  // secs: item value measured in "seconds of income" so chests stay relevant all game.
  G.RARITIES = [
    { id: 'common',    name: { ru: 'Обычный',       en: 'Common' },    color: '#c7b299', dark: '#7a6650', secs: 0.4,    ess: 0.06, bonusMul: 1 },
    { id: 'uncommon',  name: { ru: 'Необычный',     en: 'Uncommon' },  color: '#63d85b', dark: '#2d7a28', secs: 1,    ess: 0.14, bonusMul: 1.5 },
    { id: 'rare',      name: { ru: 'Редкий',        en: 'Rare' },      color: '#4fa8ff', dark: '#1f5aa8', secs: 2.5,   ess: 0.35, bonusMul: 2 },
    { id: 'epic',      name: { ru: 'Эпический',     en: 'Epic' },      color: '#b36bff', dark: '#5f2aa8', secs: 6,   ess: 0.9,  bonusMul: 3 },
    { id: 'legendary', name: { ru: 'Легендарный',   en: 'Legendary' }, color: '#ffa033', dark: '#a8560f', secs: 16,  ess: 2.4,  bonusMul: 4 },
    { id: 'mythic',    name: { ru: 'Мифический',    en: 'Mythic' },    color: '#ff4f7e', dark: '#9e1f44', secs: 50,  ess: 6,    bonusMul: 6 },
    { id: 'divine',    name: { ru: 'Божественный',  en: 'Divine' },    color: '#ffffff', dark: '#9aa6c0', secs: 160, ess: 18,   bonusMul: 10 },
  ];
  // Base chest tier weights before luck.
  G.CHEST_WEIGHTS = [1000, 280, 80, 22, 6, 1.5, 0.3];
  G.STAR_THRESHOLDS = [1, 10, 100, 1000, 10000];

  // ---------- Collection bonus types (per star, before rarity multiplier) ----------
  G.BONUS = {
    click: { v: 0.02,  name: { ru: 'Сила клика', en: 'Click gold' },       pct: true },
    gps:   { v: 0.01,  name: { ru: 'Доход героев', en: 'Hero income' },     pct: true },
    gold:  { v: 0.01,  name: { ru: 'Всё золото', en: 'All gold' },          pct: true },
    crit:  { v: 0.001, name: { ru: 'Шанс крита', en: 'Crit chance' },       pct: true },
    critd: { v: 0.1,   name: { ru: 'Сила крита', en: 'Crit power' },        pct: false, x: true },
    luck:  { v: 0.005, name: { ru: 'Удача', en: 'Luck' },                   pct: true },
    ess:   { v: 0.015, name: { ru: 'Эссенция', en: 'Essence' },             pct: true },
    item:  { v: 0.02,  name: { ru: 'Цена предметов', en: 'Item value' },    pct: true },
    boss:  { v: 0.03,  name: { ru: 'Урон по боссам', en: 'Boss damage' },   pct: true },
    chest: { v: 0.015, name: { ru: 'Частота сундуков', en: 'Chest rate' },  pct: true },
    egg:   { v: 0.02,  name: { ru: 'Шанс яиц', en: 'Egg chance' },          pct: true },
    pet:   { v: 0.015, name: { ru: 'Сила питомцев', en: 'Pet power' },      pct: true },
    combo: { v: 2,     name: { ru: 'Макс. комбо', en: 'Max combo' },        pct: false },
  };

  // ---------- Items: 7 rarities x 6. w = drop weight inside the rarity, m = value multiplier ----------
  const W = [30, 25, 20, 13, 8, 4], M = [0.7, 0.85, 1.0, 1.25, 1.6, 2.2];
  const itemRows = [
    [ // common
      ['rusty_dagger', 'Ржавый кинжал', 'Rusty Dagger', 'click'],
      ['twig_staff', 'Посох-ветка', 'Twig Staff', 'ess'],
      ['short_bow', 'Короткий лук', 'Short Bow', 'crit'],
      ['leather_vest', 'Кожаная куртка', 'Leather Vest', 'gps'],
      ['copper_ring', 'Медное кольцо', 'Copper Ring', 'luck'],
      ['old_boot', 'Старый сапог', 'Old Boot', 'item'],
    ],
    [ // uncommon
      ['steel_sword', 'Стальной меч', 'Steel Sword', 'click'],
      ['oak_wand', 'Дубовая палочка', 'Oak Wand', 'ess'],
      ['hunter_bow', 'Охотничий лук', "Hunter's Bow", 'critd'],
      ['chainmail', 'Кольчуга', 'Chainmail', 'boss'],
      ['emerald_ring', 'Изумрудное кольцо', 'Emerald Ring', 'luck'],
      ['hp_potion', 'Зелье здоровья', 'Health Potion', 'gold'],
    ],
    [ // rare
      ['sapphire_blade', 'Сапфировый клинок', 'Sapphire Blade', 'click'],
      ['frost_staff', 'Ледяной посох', 'Frost Staff', 'ess'],
      ['crystal_dagger', 'Хрустальный кинжал', 'Crystal Dagger', 'crit'],
      ['knight_shield', 'Рыцарский щит', "Knight's Shield", 'boss'],
      ['mana_tome', 'Том маны', 'Mana Tome', 'pet'],
      ['sapphire_amulet', 'Сапфировый амулет', 'Sapphire Amulet', 'chest'],
    ],
    [ // epic
      ['shadow_katana', 'Теневая катана', 'Shadow Katana', 'critd'],
      ['necro_skull', 'Череп некроманта', 'Necro Skull', 'ess'],
      ['arcane_orb', 'Чародейская сфера', 'Arcane Orb', 'gps'],
      ['demon_helm', 'Шлем демона', 'Demon Helm', 'boss'],
      ['void_cloak', 'Плащ пустоты', 'Void Cloak', 'combo'],
      ['amethyst_tiara', 'Аметистовая тиара', 'Amethyst Tiara', 'egg'],
    ],
    [ // legendary
      ['dragon_sword', 'Меч дракона', 'Dragonfire Sword', 'click'],
      ['phoenix_bow', 'Лук феникса', 'Phoenix Bow', 'crit'],
      ['sun_staff', 'Солнечный посох', 'Sunstaff', 'gps'],
      ['golden_plate', 'Золотые латы', 'Golden Plate', 'gold'],
      ['titan_ring', 'Кольцо титана', 'Titan Ring', 'luck'],
      ['ancient_scroll', 'Древний свиток', 'Ancient Scroll', 'item'],
    ],
    [ // mythic
      ['blood_scythe', 'Кровавая коса', 'Blood Scythe', 'critd'],
      ['star_codex', 'Звёздный фолиант', 'Star Codex', 'ess'],
      ['chaos_wand', 'Жезл хаоса', 'Chaos Wand', 'chest'],
      ['moon_orb', 'Лунная сфера', 'Bloodmoon Orb', 'pet'],
      ['realm_heart', 'Сердце Королевства', 'Heart of the Realm', 'gold'],
      ['king_crown', 'Корона королей', 'Crown of Kings', 'boss'],
    ],
    [ // divine
      ['eternity_blade', 'Клинок вечности', 'Eternity Blade', 'click'],
      ['celestial_staff', 'Небесный посох', 'Celestial Staff', 'gps'],
      ['halo', 'Нимб', 'Halo', 'luck'],
      ['seraph_wing', 'Крыло серафима', 'Seraph Wing', 'egg'],
      ['cosmic_egg', 'Космическое яйцо', 'Cosmic Egg', 'pet'],
      ['golden_button', 'Золотая кнопка', 'The Golden Button', 'gold'],
    ],
  ];
  G.ITEMS = [];
  G.ITEMS_BY_RARITY = [];
  itemRows.forEach((row, r) => {
    G.ITEMS_BY_RARITY[r] = [];
    row.forEach((it, i) => {
      const item = { id: it[0], r, name: { ru: it[1], en: it[2] }, bonus: it[3], w: W[i], m: M[i], idx: G.ITEMS.length };
      G.ITEMS.push(item);
      G.ITEMS_BY_RARITY[r].push(item);
    });
  });
  G.ITEM_BY_ID = {};
  G.ITEMS.forEach(it => G.ITEM_BY_ID[it.id] = it);

  // ---------- Heroes (idle income) ----------
  G.HERO_MILESTONES = [10, 25, 50, 100, 150, 200, 250, 300, 400, 500, 600, 700, 800, 900, 1000];
  G.HEROES = [
    { id: 'rogue',    name: { ru: 'Разбойник', en: 'Rogue' },       cost: 50,     gps: 0.2,    shot: '#9aa0a8' },
    { id: 'archer',   name: { ru: 'Лучник', en: 'Archer' },         cost: 400,    gps: 1.2,    shot: '#9be15d' },
    { id: 'wizard',   name: { ru: 'Маг', en: 'Wizard' },            cost: 4500,   gps: 8,      shot: '#5ab4ff' },
    { id: 'priest',   name: { ru: 'Жрица', en: 'Priestess' },       cost: 50000,  gps: 45,     shot: '#fff3a0' },
    { id: 'warrior',  name: { ru: 'Воин', en: 'Warrior' },          cost: 5.5e5,  gps: 260,    shot: '#ff7a4a' },
    { id: 'knight',   name: { ru: 'Рыцарь', en: 'Knight' },         cost: 6e6,  gps: 1400,   shot: '#cfd8e0' },
    { id: 'paladin',  name: { ru: 'Паладин', en: 'Paladin' },       cost: 8.5e7,  gps: 7800,   shot: '#ffd84a' },
    { id: 'necro',    name: { ru: 'Некромант', en: 'Necromancer' }, cost: 1.3e9,  gps: 44000,  shot: '#c06bff' },
    { id: 'mystic',   name: { ru: 'Мистик', en: 'Mystic' },         cost: 2e10,  gps: 2.6e5,  shot: '#ff6bd8' },
    { id: 'sorcerer', name: { ru: 'Чародей', en: 'Sorcerer' },      cost: 3e11, gps: 1.6e6,  shot: '#ff4040' },
    { id: 'ninja',    name: { ru: 'Ниндзя', en: 'Ninja' },          cost: 4e12,   gps: 1e7,    shot: '#ffffff' },
    { id: 'summoner', name: { ru: 'Призыватель', en: 'Summoner' },  cost: 5.5e13, gps: 6.5e7,  shot: '#6bffb0' },
  ];
  G.HERO_GROWTH = 1.15;
  G.FINGER_MILESTONES = [10, 25, 50, 75, 100, 125, 150, 200];

  // ---------- Shop upgrades (gold) ----------
  G.UPGRADES = [
    { id: 'finger', icon: 'ic_finger', base: 15, growth: 1.5, max: 0,
      name: { ru: 'Крепкий палец', en: 'Iron Finger' },
      desc: { ru: '+1 к силе клика. На 10, 25, 50, 75… ур. — клик ×2', en: '+1 click power. Levels 10, 25, 50, 75… double clicks' },
      fx: (L, D) => { D.clickAdd += L; D.clickMult *= Math.pow(2, G.FINGER_MILESTONES.filter(m => L >= m).length); } },
    { id: 'might', icon: 'ic_rune', base: 5000, growth: 30, max: 15,
      name: { ru: 'Руна силы', en: 'Rune of Might' },
      desc: { ru: 'Сила клика ×1.5 за уровень', en: 'Click gold ×1.5 per level' },
      fx: (L, D) => { D.clickMult *= Math.pow(1.5, L); } },
    { id: 'echo', icon: 'ic_echo', base: 100000.0, growth: 15, max: 10,
      name: { ru: 'Эхо-удар', en: 'Echo Strike' },
      desc: { ru: 'Клик даёт +1% дохода героев в сек. за уровень', en: 'Each click adds +1% of hero income per level' },
      fx: (L, D) => { D.clickGpsPct += 0.01 * L; } },
    { id: 'keen', icon: 'ic_eye', base: 200, growth: 2.5, max: 20,
      name: { ru: 'Зоркий глаз', en: 'Keen Eye' },
      desc: { ru: '+0.5% шанс критического клика', en: '+0.5% critical click chance' },
      fx: (L, D) => { D.crit += 0.005 * L; } },
    { id: 'deadly', icon: 'ic_skull', base: 1000, growth: 3.5, max: 15,
      name: { ru: 'Смертельный удар', en: 'Deadly Blow' },
      desc: { ru: 'Множитель крита +0.5', en: 'Crit multiplier +0.5' },
      fx: (L, D) => { D.critMult += 0.5 * L; } },
    { id: 'sense', icon: 'ic_nose', base: 100, growth: 2.4, max: 20,
      name: { ru: 'Чутьё кладоискателя', en: 'Treasure Sense' },
      desc: { ru: 'Сундуки появляются на 5% чаще', en: 'Chests appear 5% more often' },
      fx: (L, D) => { D.chestProg += 0.05 * L; } },
    { id: 'hall', icon: 'ic_hall', base: 300, growth: 3.5, max: 10,
      name: { ru: 'Просторный зал', en: 'Spacious Hall' },
      desc: { ru: '+1 место для сундуков', en: '+1 chest slot' },
      fx: (L, D) => { D.slots += L; } },
    { id: 'golem', icon: 'ic_key', base: 2500, growth: 3, max: 20,
      name: { ru: 'Ключ-голем', en: 'Key Golem' },
      desc: { ru: 'Сам открывает сундуки. Каждый ур. на 12% быстрее', en: 'Opens chests for you. Each level is 12% faster' },
      fx: (L, D) => { if (L > 0) D.autoOpen = 8 * Math.pow(0.88, L - 1); } },
    { id: 'clover', icon: 'ic_clover', base: 1000, growth: 2.8, max: 20,
      name: { ru: 'Четырёхлистник', en: 'Four-Leaf Clover' },
      desc: { ru: '+3% удачи: сундуки лучше', en: '+3% luck: better chests' },
      fx: (L, D) => { D.luck += 0.03 * L; } },
    { id: 'appraiser', icon: 'ic_scale', base: 500, growth: 2.8, max: 20,
      name: { ru: 'Оценщик', en: 'Appraiser' },
      desc: { ru: 'Предметы стоят на 5% дороже', en: 'Items are worth 5% more' },
      fx: (L, D) => { D.itemMult *= 1 + 0.05 * L; } },
    { id: 'rhythm', icon: 'ic_note', base: 1000, growth: 4, max: 10,
      name: { ru: 'Ритм', en: 'Rhythm' },
      desc: { ru: 'Максимальное комбо +25', en: 'Max combo +25' },
      fx: (L, D) => { D.comboCap += 25 * L; } },
    { id: 'clockwork', icon: 'ic_gear', base: 10000, growth: 2.8, max: 20,
      name: { ru: 'Заводная рука', en: 'Clockwork Hand' },
      desc: { ru: '+0.5 автоклика в секунду', en: '+0.5 auto clicks per second' },
      fx: (L, D) => { D.autoCps += 0.5 * L; } },
    { id: 'prince', icon: 'ic_crown', base: 1e17, growth: 1, max: 1, secret: 1e13,
      name: { ru: 'Корона Принца', en: "The Prince's Crown" },
      desc: { ru: 'Всё золото ×3. Кнопка коронована.', en: 'All gold ×3. The Button is crowned.' },
      fx: (L, D) => { if (L) D.goldMult *= 3; } },
  ];

  // ---------- Chest modifiers ----------
  G.MODIFIERS = [
    { id: 'golden',    color: '#ffd84a', name: { ru: 'Золотой', en: 'Golden' },          desc: { ru: 'Взрыв золота при открытии', en: 'Bursts with gold' } },
    { id: 'lightning', color: '#7fe9ff', name: { ru: 'Грозовой', en: 'Storm' },          desc: { ru: 'Молния открывает соседние сундуки', en: 'Lightning opens nearby chests' } },
    { id: 'ghost',     color: '#d8e6ff', name: { ru: 'Призрачный', en: 'Ghost' },        desc: { ru: 'Содержимое удваивается', en: 'Loot is duplicated' } },
    { id: 'chromatic', color: '#ff7ae6', name: { ru: 'Хроматический', en: 'Chromatic' }, desc: { ru: 'Лучший из 3 бросков редкости', en: 'Best of 3 rarity rolls' } },
    { id: 'frozen',    color: '#9fd8ff', name: { ru: 'Ледяной', en: 'Frozen' },          desc: { ru: 'Разбей лёд (8 кликов) — 3 предмета', en: 'Crack the ice (8 clicks) for 3 items' } },
    { id: 'blazing',   color: '#ff7a2e', name: { ru: 'Пылающий', en: 'Blazing' },        desc: { ru: 'Цена ×5, но сгорает за 6 сек', en: '×5 value, burns out in 6s' } },
    { id: 'mimic',     color: '#d94040', name: { ru: 'Мимик', en: 'Mimic' },             desc: { ru: 'Кусается! Победи — 5 предметов', en: 'It bites! Defeat it for 5 items' } },
    { id: 'void',      color: '#8a4dff', name: { ru: 'Бездонный', en: 'Void' },          desc: { ru: 'Эссенция ×10', en: '×10 essence' } },
  ];
  G.MOD_BY_ID = {}; G.MODIFIERS.forEach(m => G.MOD_BY_ID[m.id] = m);

  // ---------- Constellation (essence skill tree) ----------
  // x,y on a grid centred at 0,0. req: any one of these unlocks the node.
  const C = (id, x, y, br, req, max, cost, growth, name, desc, fx, val) => ({ id, x, y, br, req, max, cost, growth, name, desc, fx, val });
  G.NODES = [
    C('spark', 0, 0, 'core', [], 5, 1, 1.6, { ru: 'Искра', en: 'Spark' }, { ru: 'Всё золото +10%', en: 'All gold +10%' },
      (L, D) => { D.goldMult *= 1 + 0.1 * L; }),
    // Click arm (up)
    C('c_surge', 0, -1, 'click', ['spark'], 5, 2, 1.7, { ru: 'Прилив силы', en: 'Power Surge' }, { ru: 'Клик +20%', en: 'Click gold +20%' },
      (L, D) => { D.clickMult *= 1 + 0.2 * L; }),
    C('c_prec', -1, -2, 'click', ['c_surge'], 5, 4, 1.8, { ru: 'Точность', en: 'Precision' }, { ru: 'Шанс крита +1%', en: 'Crit chance +1%' },
      (L, D) => { D.crit += 0.01 * L; }),
    C('c_brut', 1, -2, 'click', ['c_surge'], 5, 4, 1.8, { ru: 'Жестокость', en: 'Brutality' }, { ru: 'Множитель крита +1', en: 'Crit multiplier +1' },
      (L, D) => { D.critMult += 1 * L; }),
    C('c_flow', 0, -3, 'click', ['c_prec', 'c_brut'], 3, 12, 2.2, { ru: 'Поток', en: 'Flow' }, { ru: 'Макс. комбо +40', en: 'Max combo +40' },
      (L, D) => { D.comboCap += 40 * L; }),
    C('c_echo', -1, -4, 'click', ['c_flow'], 5, 30, 2, { ru: 'Отголосок', en: 'Resonance' }, { ru: 'Клик +1% дохода героев', en: 'Clicks +1% of hero income' },
      (L, D) => { D.clickGpsPct += 0.01 * L; }),
    C('c_frenzy', 1, -4, 'click', ['c_flow'], 3, 25, 2, { ru: 'Упоение', en: 'Rapture' }, { ru: 'Бафы огоньков длятся на 25% дольше', en: 'Wisp buffs last 25% longer' },
      (L, D) => { D.buffDur += 0.25 * L; }),
    C('c_thunder', 0, -5, 'click', ['c_echo', 'c_frenzy'], 1, 200, 1, { ru: 'Громовая длань', en: 'Thunder Palm' }, { ru: 'Каждый 25-й клик — МЕГА-клик ×30', en: 'Every 25th click is a MEGA click ×30' },
      (L, D) => { D.mega = L > 0; }),
    // Idle arm (right)
    C('i_guild', 1, 0, 'idle', ['spark'], 5, 2, 1.7, { ru: 'Гильдия', en: 'Guild Hall' }, { ru: 'Доход героев +15%', en: 'Hero income +15%' },
      (L, D) => { D.gpsMult *= 1 + 0.15 * L; }),
    C('i_vet', 2, -1, 'idle', ['i_guild'], 3, 10, 2.5, { ru: 'Ветераны', en: 'Veterans' }, { ru: 'Герои +0.5% за каждые 10 героев', en: 'Heroes +0.5% per 10 heroes owned' },
      (L, D) => { D.vet += 0.005 * L; }),
    C('i_scout', 2, 1, 'idle', ['i_guild'], 5, 8, 2, { ru: 'Разведчики', en: 'Scouts' }, { ru: 'Герои находят 0.1 сундука/сек', en: 'Heroes find 0.1 chests/sec' },
      (L, D) => { D.scout += 0.1 * L; }),
    C('i_watch', 3, 0, 'idle', ['i_vet', 'i_scout'], 5, 12, 2, { ru: 'Ночной дозор', en: 'Night Watch' }, { ru: 'Офлайн-доход +10% и +1 ч лимита', en: 'Offline income +10% and +1h cap' },
      (L, D) => { D.offEff += 0.1 * L; D.offCap += 3600 * L; }),
    C('i_banner', 4, -1, 'idle', ['i_watch'], 5, 40, 2.2, { ru: 'Боевое знамя', en: 'War Banner' }, { ru: 'Доход героев +25%', en: 'Hero income +25%' },
      (L, D) => { D.gpsMult *= 1 + 0.25 * L; }),
    C('i_clock', 4, 1, 'idle', ['i_watch'], 5, 35, 2.2, { ru: 'Часовщик', en: 'Clockmaker' }, { ru: '+1 автоклик в секунду', en: '+1 auto click per second' },
      (L, D) => { D.autoCps += L; }),
    C('i_legion', 5, 0, 'idle', ['i_banner', 'i_clock'], 1, 200, 1, { ru: 'Легион', en: 'Legion' }, { ru: 'Каждый нанятый класс героев: всё золото +8%', en: 'Each hired hero class: all gold +8%' },
      (L, D) => { D.legion = L > 0; }),
    // Chest arm (down)
    C('h_nose', 0, 1, 'chest', ['spark'], 5, 2, 1.7, { ru: 'Нюх', en: 'Keen Nose' }, { ru: 'Сундуки чаще на 10%', en: 'Chests 10% more often' },
      (L, D) => { D.chestProg += 0.1 * L; }),
    C('h_fusion', -1, 2, 'chest', ['h_nose'], 1, 6, 1, { ru: 'Слияние', en: 'Fusion' }, { ru: 'Когда места нет — 3 одинаковых сундука сливаются в лучший', en: 'When the room is full, 3 equal chests fuse into a better one' },
      (L, D) => { D.merge = L > 0; }),
    C('h_gild', 1, 2, 'chest', ['h_nose'], 1, 5, 1, { ru: 'Позолота', en: 'Gilding' }, { ru: 'Открывает Золотые сундуки. Шанс модификатора +2%', en: 'Unlocks Golden chests. Modifier chance +2%' },
      (L, D) => { if (L) { D.mods.golden = 1; D.modChance += 0.02; } }),
    C('h_double', -2, 3, 'chest', ['h_fusion'], 5, 12, 2, { ru: 'Двойное дно', en: 'False Bottom' }, { ru: '+5% шанс двойной добычи', en: '+5% chance of double loot' },
      (L, D) => { D.double += 0.05 * L; }),
    C('h_storm', 0, 3, 'chest', ['h_gild', 'h_fusion'], 1, 15, 1, { ru: 'Зов бури', en: 'Stormcall' }, { ru: 'Открывает Грозовые сундуки', en: 'Unlocks Storm chests' },
      (L, D) => { if (L) D.mods.lightning = 1; }),
    C('h_ghost', 2, 3, 'chest', ['h_gild'], 1, 15, 1, { ru: 'Фантазм', en: 'Phantasm' }, { ru: 'Открывает Призрачные сундуки', en: 'Unlocks Ghost chests' },
      (L, D) => { if (L) D.mods.ghost = 1; }),
    C('h_frost', -1, 4, 'chest', ['h_storm'], 1, 25, 1, { ru: 'Вечный лёд', en: 'Permafrost' }, { ru: 'Открывает Ледяные сундуки', en: 'Unlocks Frozen chests' },
      (L, D) => { if (L) D.mods.frozen = 1; }),
    C('h_chroma', 1, 4, 'chest', ['h_storm', 'h_ghost'], 1, 30, 1, { ru: 'Призма', en: 'Prism' }, { ru: 'Открывает Хроматические сундуки', en: 'Unlocks Chromatic chests' },
      (L, D) => { if (L) D.mods.chromatic = 1; }),
    C('h_rate', 2, 4, 'chest', ['h_ghost'], 5, 20, 2, { ru: 'Аномалии', en: 'Anomalies' }, { ru: 'Шанс модификатора +2%', en: 'Modifier chance +2%' },
      (L, D) => { D.modChance += 0.02 * L; }),
    C('h_blaze', -2, 5, 'chest', ['h_frost'], 1, 45, 1, { ru: 'Пекло', en: 'Inferno' }, { ru: 'Открывает Пылающие сундуки', en: 'Unlocks Blazing chests' },
      (L, D) => { if (L) D.mods.blazing = 1; }),
    C('h_mimic', 0, 5, 'chest', ['h_frost', 'h_chroma'], 1, 50, 1, { ru: 'Зубастый', en: 'Toothy' }, { ru: 'Открывает Мимиков', en: 'Unlocks Mimics' },
      (L, D) => { if (L) D.mods.mimic = 1; }),
    C('h_void', 2, 5, 'chest', ['h_chroma', 'h_rate'], 1, 60, 1, { ru: 'Бездна', en: 'Abyssal' }, { ru: 'Открывает Бездонные сундуки', en: 'Unlocks Void chests' },
      (L, D) => { if (L) D.mods.void = 1; }),
    C('h_hoard', 0, 6, 'chest', ['h_blaze', 'h_mimic', 'h_void'], 1, 250, 1, { ru: 'Сокровищница', en: 'Hoard' }, { ru: 'Шанс модификатора +8%, +2 места', en: 'Modifier chance +8%, +2 slots' },
      (L, D) => { if (L) { D.modChance += 0.08; D.slots += 2; } }),
    // Arcane arm (left)
    C('a_flow', -1, 0, 'arcane', ['spark'], 5, 2, 1.7, { ru: 'Ток эссенции', en: 'Essence Flow' }, { ru: 'Эссенция +20%', en: 'Essence +20%' },
      (L, D) => { D.essMult *= 1 + 0.2 * L; }),
    C('a_hatch', -2, -1, 'arcane', ['a_flow'], 5, 10, 2, { ru: 'Гнездо', en: 'Nesting' }, { ru: 'Яйца выпадают на 15% чаще', en: 'Eggs drop 15% more often' },
      (L, D) => { D.eggMult *= 1 + 0.15 * L; }),
    C('a_slayer', -2, 1, 'arcane', ['a_flow'], 5, 8, 1.9, { ru: 'Убийца боссов', en: 'Bossbane' }, { ru: 'Урон по боссам +30%', en: 'Boss damage +30%' },
      (L, D) => { D.bossMult *= 1 + 0.3 * L; }),
    C('a_bond', -3, -1, 'arcane', ['a_hatch'], 5, 20, 2, { ru: 'Узы', en: 'Bond' }, { ru: 'Сила питомцев +15%', en: 'Pet power +15%' },
      (L, D) => { D.petMult *= 1 + 0.15 * L; }),
    C('a_time', -3, 1, 'arcane', ['a_slayer'], 3, 15, 2.2, { ru: 'Замедление', en: 'Time Dilation' }, { ru: 'Таймер босса +4 сек', en: 'Boss timer +4s' },
      (L, D) => { D.bossTime += 4 * L; }),
    C('a_wisp', -4, 0, 'arcane', ['a_bond', 'a_time'], 3, 25, 2, { ru: 'Манок', en: 'Wisp Lure' }, { ru: 'Огоньки прилетают на 20% чаще', en: 'Wisps appear 20% more often' },
      (L, D) => { D.wispRate *= 1 + 0.2 * L; }),
    C('a_nest', -4, -1, 'arcane', ['a_bond'], 2, 60, 4, { ru: 'Большое гнездо', en: 'Great Nest' }, { ru: '+1 слот питомца', en: '+1 pet slot' },
      (L, D) => { D.petSlots += L; }),
    C('a_hunt', -4, 1, 'arcane', ['a_time'], 1, 30, 1, { ru: 'Охота', en: 'The Hunt' }, { ru: 'Боссы вызываются сами, шкала босса -20%', en: 'Bosses auto-challenge, boss meter -20%' },
      (L, D) => { if (L) { D.autoBoss = true; D.bossNeed *= 0.8; } }),
    C('a_astral', -5, 0, 'arcane', ['a_nest', 'a_hunt', 'a_wisp'], 1, 220, 1, { ru: 'Астрал', en: 'Astral' }, { ru: 'Лимит зелий +5, сила зелий +50%', en: 'Potion cap +5, potion power +50%' },
      (L, D) => { if (L) { D.potCap += 5; D.potPow *= 1.5; } }),
  ];
  G.NODE_BY_ID = {}; G.NODES.forEach(n => G.NODE_BY_ID[n.id] = n);
  G.BRANCH_COLORS = { core: '#ffffff', click: '#ff6464', idle: '#63d85b', chest: '#ffd84a', arcane: '#b36bff' };

  // ---------- Stat potions (reset on ascension, like a hero's death) ----------
  G.POTIONS = [
    { id: 'att',  short: 'ATT', color: '#e04cf0', name: { ru: 'Атака', en: 'Attack' },     desc: { ru: 'Урон героя и клик +5%', en: 'Hero damage and clicks +5%' } },
    { id: 'def',  short: 'DEF', color: '#9a9aa6', name: { ru: 'Защита', en: 'Defense' },   desc: { ru: 'Прочность кнопки +8%', en: 'Button toughness +8%' } },
    { id: 'spd',  short: 'SPD', color: '#41d65b', name: { ru: 'Скорость', en: 'Speed' },   desc: { ru: 'Автоклики и голем +5%', en: 'Auto clicks and golem +5%' } },
    { id: 'dex',  short: 'DEX', color: '#ff9b2d', name: { ru: 'Ловкость', en: 'Dexterity' }, desc: { ru: 'Шанс крита +0.5%', en: 'Crit chance +0.5%' } },
    { id: 'vit',  short: 'VIT', color: '#e0413b', name: { ru: 'Живучесть', en: 'Vitality' }, desc: { ru: 'Доход героев +5%', en: 'Hero income +5%' } },
    { id: 'wis',  short: 'WIS', color: '#3fa0ff', name: { ru: 'Мудрость', en: 'Wisdom' },  desc: { ru: 'Эссенция +5%', en: 'Essence +5%' } },
    { id: 'life', short: 'LIFE', color: '#ff7aa8', name: { ru: 'Жизнь', en: 'Life' },      desc: { ru: 'Всё золото +3%', en: 'All gold +3%' } },
    { id: 'mana', short: 'MANA', color: '#6a7bff', name: { ru: 'Мана', en: 'Mana' },       desc: { ru: 'Сила питомцев +4%', en: 'Pet power +4%' } },
  ];

  // ---------- Pets (gacha "cuties") ----------
  // tier: 0 common, 1 rare, 2 legendary, 3 divine. cps = auto clicks/sec at level 1.
  G.PET_TIERS = [
    { name: { ru: 'Обычный', en: 'Common' }, color: '#c7b299', rate: 0.62 },
    { name: { ru: 'Редкий', en: 'Rare' }, color: '#4fa8ff', rate: 0.28 },
    { name: { ru: 'Легендарный', en: 'Legendary' }, color: '#ffa033', rate: 0.09 },
    { name: { ru: 'Божественный', en: 'Divine' }, color: '#ffffff', rate: 0.01 },
  ];
  G.PETS = [
    { id: 'slime',   tier: 0, cps: 1,   name: { ru: 'Слизик', en: 'Goop' },         desc: { ru: 'Автоклики', en: 'Auto clicks' } },
    { id: 'bat',     tier: 0, cps: 0,   name: { ru: 'Кусь', en: 'Nibbles' },        desc: { ru: 'Шанс крита', en: 'Crit chance' },   fx: (p, D) => { D.crit += 0.004 * p; } },
    { id: 'frog',    tier: 0, cps: 0,   name: { ru: 'Квакша', en: 'Croaky' },       desc: { ru: 'Удача', en: 'Luck' },                fx: (p, D) => { D.luck += 0.01 * p; } },
    { id: 'beetle',  tier: 0, cps: 0,   name: { ru: 'Скарабей', en: 'Scarab' },     desc: { ru: 'Доход героев', en: 'Hero income' },  fx: (p, D) => { D.gpsMult *= 1 + 0.05 * p; } },
    { id: 'owl',     tier: 1, cps: 0,   name: { ru: 'Совушка', en: 'Hoot' },        desc: { ru: 'Эссенция', en: 'Essence' },          fx: (p, D) => { D.essMult *= 1 + 0.04 * p; } },
    { id: 'boo',     tier: 1, cps: 1.5, name: { ru: 'Бу', en: 'Boo' },              desc: { ru: 'Автоклики, шанс модификатора', en: 'Auto clicks, modifier chance' }, fx: (p, D) => { D.modChance += 0.003 * p; } },
    { id: 'imp',     tier: 1, cps: 0,   name: { ru: 'Уголёк', en: 'Ember' },        desc: { ru: 'Урон по боссам', en: 'Boss damage' }, fx: (p, D) => { D.bossMult *= 1 + 0.08 * p; } },
    { id: 'pebble',  tier: 1, cps: 0,   name: { ru: 'Камушек', en: 'Pebble' },      desc: { ru: 'Открывает сундуки', en: 'Opens chests' }, fx: (p, D) => { D.petOpen += 0.12 * p; } },
    { id: 'phoenix', tier: 2, cps: 3,   name: { ru: 'Феникс', en: 'Phoenix' },      desc: { ru: 'Автоклики, сила крита', en: 'Auto clicks, crit power' }, fx: (p, D) => { D.critMult += 0.5 * p; } },
    { id: 'drake',   tier: 2, cps: 0,   name: { ru: 'Дракоша', en: 'Drakey' },      desc: { ru: 'Всё золото', en: 'All gold' },       fx: (p, D) => { D.goldMult *= 1 + 0.06 * p; } },
    { id: 'starfox', tier: 2, cps: 0,   name: { ru: 'Звёздный лис', en: 'Starfox' }, desc: { ru: 'Яйца и удача', en: 'Eggs and luck' }, fx: (p, D) => { D.eggMult *= 1 + 0.08 * p; D.luck += 0.01 * p; } },
    { id: 'buttonling', tier: 3, cps: 4, name: { ru: 'Кнопыш', en: 'Buttonling' },  desc: { ru: 'Всё понемногу', en: 'A bit of everything' }, fx: (p, D) => { D.goldMult *= 1 + 0.1 * p; D.luck += 0.015 * p; } },
  ];
  G.PET_BY_ID = {}; G.PETS.forEach(p => G.PET_BY_ID[p.id] = p);
  G.PET_MAX_LEVEL = 25;
  G.GOLDEN_CHANCE = 0.05;

  // ---------- Realms & bosses ----------
  G.REALM_SIZE = 5; // depths per realm; the 5th depth is the realm lord
  G.REALMS = [
    { id: 'shore',     name: { ru: 'Берег', en: 'Shoreline' },       minion: 'b_crab',   lord: 'l_crab',
      minionName: { ru: 'Песчаный краб', en: 'Sand Crab' },     lordName: { ru: 'Король-краб', en: 'The Crab King' } },
    { id: 'meadow',    name: { ru: 'Луга', en: 'Meadows' },          minion: 'b_goblin', lord: 'l_goblin',
      minionName: { ru: 'Гоблин', en: 'Goblin' },               lordName: { ru: 'Вождь гоблинов', en: 'Goblin Warchief' } },
    { id: 'forest',    name: { ru: 'Чаща', en: 'Deepwood' },         minion: 'b_shroom', lord: 'l_tree',
      minionName: { ru: 'Грибняк', en: 'Shroomling' },          lordName: { ru: 'Древний Ент', en: 'Elder Treant' } },
    { id: 'highlands', name: { ru: 'Нагорье', en: 'Highlands' },     minion: 'b_golem',  lord: 'l_titan',
      minionName: { ru: 'Каменный голем', en: 'Stone Golem' },  lordName: { ru: 'Горный титан', en: 'Mountain Titan' } },
    { id: 'tundra',    name: { ru: 'Снега', en: 'Frostlands' },      minion: 'b_yeti',   lord: 'l_wyrm',
      minionName: { ru: 'Йети', en: 'Yeti' },                   lordName: { ru: 'Ледяной змей', en: 'Frost Wyrm' } },
    { id: 'godlands',  name: { ru: 'Земли богов', en: 'Godlands' },  minion: 'b_eye',    lord: 'l_eye',
      minionName: { ru: 'Глазун', en: 'Watcher' },              lordName: { ru: 'Всевидящее Око', en: 'The All-Seeing Eye' } },
    { id: 'abyss',     name: { ru: 'Бездна', en: 'Abyss' },          minion: 'b_imp',    lord: 'l_demon',
      minionName: { ru: 'Бес', en: 'Fiend' },                   lordName: { ru: 'Владыка демонов', en: 'Demon Lord' } },
    { id: 'void',      name: { ru: 'Пустота', en: 'The Void' },      minion: 'b_wraith', lord: 'l_button',
      minionName: { ru: 'Призрак пустоты', en: 'Void Wraith' },  lordName: { ru: 'Безумная Кнопка', en: 'The Mad Button' } },
  ];

  // ---------- Legacy: permanent upgrades bought with Fame ----------
  G.LEGACY = [
    { id: 'lg_click', base: 1, growth: 1.6, max: 25, name: { ru: 'Наследие силы', en: 'Ancestral Might' }, desc: { ru: 'Клик и урон героя +40%', en: 'Clicks and hero damage +40%' },
      fx: (L, D) => { D.clickMult *= 1 + 0.4 * L; D.heroMult *= 1 + 0.4 * L; } },
    { id: 'lg_guild', base: 1, growth: 1.6, max: 25, name: { ru: 'Наследие гильдии', en: 'Ancestral Guild' }, desc: { ru: 'Доход героев +40%', en: 'Hero income +40%' },
      fx: (L, D) => { D.gpsMult *= 1 + 0.4 * L; } },
    { id: 'lg_start', base: 2, growth: 2, max: 8, name: { ru: 'Фора', en: 'Head Start' }, desc: { ru: 'Старт с золотом: 100 × 10^ур.', en: 'Start with 100 × 10^lvl gold' },
      fx: () => {} },
    { id: 'lg_luck', base: 3, growth: 1.8, max: 10, name: { ru: 'Счастливая звезда', en: 'Lucky Star' }, desc: { ru: 'Удача +3%', en: 'Luck +3%' },
      fx: (L, D) => { D.luck += 0.03 * L; } },
    { id: 'lg_boss', base: 3, growth: 1.7, max: 15, name: { ru: 'Гроза боссов', en: 'Boss Slayer' }, desc: { ru: 'Урон по боссам +35%', en: 'Boss damage +35%' },
      fx: (L, D) => { D.bossMult *= 1 + 0.35 * L; } },
    { id: 'lg_pot', base: 4, growth: 2, max: 10, name: { ru: 'Погреб зелий', en: 'Potion Cellar' }, desc: { ru: 'Лимит каждого зелья +3', en: 'Each potion cap +3' },
      fx: (L, D) => { D.potCap += 3 * L; } },
    { id: 'lg_keeppot', base: 12, growth: 2.5, max: 4, name: { ru: 'Семейный сундук', en: 'Family Vault' }, desc: { ru: 'Сохранять 25% зелий при вознесении', en: 'Keep 25% of potions on ascension' },
      fx: () => {} },
    { id: 'lg_stars', base: 6, growth: 2, max: 5, name: { ru: 'Память звёзд', en: 'Star Memory' }, desc: { ru: 'Старт с 12% эссенции прошлого забега', en: 'Start with 12% of last run\'s essence' },
      fx: () => {} },
    { id: 'lg_fusion', base: 15, growth: 1, max: 1, name: { ru: 'Вечное слияние', en: 'Eternal Fusion' }, desc: { ru: 'Слияние и Позолота открыты с начала', en: 'Fusion and Gilding unlocked from the start' },
      fx: (L, D) => { if (L) { D.merge = true; D.mods.golden = 1; } } },
    { id: 'lg_deep', base: 8, growth: 2.2, max: 10, name: { ru: 'Глубокое погружение', en: 'Deep Dive' }, desc: { ru: 'Начинать на 2 глубины ниже', en: 'Start 2 depths deeper' },
      fx: () => {} },
    { id: 'lg_pet', base: 10, growth: 3, max: 2, name: { ru: 'Переноска', en: 'Pet Carrier' }, desc: { ru: '+1 слот питомца', en: '+1 pet slot' },
      fx: (L, D) => { D.petSlots += L; } },
    { id: 'lg_time', base: 5, growth: 2, max: 5, name: { ru: 'Искривление времени', en: 'Time Warp' }, desc: { ru: 'Офлайн: +2 ч лимита, +10% эффективности', en: 'Offline: +2h cap, +10% efficiency' },
      fx: (L, D) => { D.offCap += 7200 * L; D.offEff += 0.1 * L; } },
    { id: 'lg_fame', base: 10, growth: 2, max: 10, name: { ru: 'Громкое имя', en: 'Renown' }, desc: { ru: 'Слава +15%', en: 'Fame gain +15%' },
      fx: (L, D) => { D.fameMult *= 1 + 0.15 * L; } },
    { id: 'lg_quest', base: 5, growth: 2, max: 4, name: { ru: 'Мастер заданий', en: 'Quest Master' }, desc: { ru: 'Награды заданий +35%', en: 'Quest rewards +35%' },
      fx: (L, D) => { D.questMult *= 1 + 0.35 * L; } },
    { id: 'lg_gold', base: 12, growth: 2.5, max: 4, name: { ru: 'Золотое касание', en: 'Golden Touch' }, desc: { ru: 'Шанс золотого питомца +2%', en: 'Golden pet chance +2%' },
      fx: (L, D) => { D.goldenChance += 0.02 * L; } },
  ];
  G.LEGACY_BY_ID = {}; G.LEGACY.forEach(l => G.LEGACY_BY_ID[l.id] = l);

  // ---------- Button skins ----------
  G.SKINS = [
    { id: 'classic',  base: '#e8413c', name: { ru: 'Классика', en: 'Classic' },   unlock: null },
    { id: 'emerald',  base: '#2fc46a', name: { ru: 'Изумруд', en: 'Emerald' },    unlock: 'chests_100' },
    { id: 'sapphire', base: '#3f7bff', name: { ru: 'Сапфир', en: 'Sapphire' },    unlock: 'depth_10' },
    { id: 'amethyst', base: '#a048ff', name: { ru: 'Аметист', en: 'Amethyst' },   unlock: 'asc_1' },
    { id: 'gold',     base: '#ffc629', name: { ru: 'Золото', en: 'Gold' },        unlock: 'gold_1e9' },
    { id: 'obsidian', base: '#3a3348', name: { ru: 'Обсидиан', en: 'Obsidian' },  unlock: 'madbutton' },
    { id: 'rainbow',  base: 'rainbow', name: { ru: 'Радуга', en: 'Rainbow' },     unlock: 'all_items' },
    { id: 'divine',   base: '#f4f6ff', name: { ru: 'Божественная', en: 'Divine' }, unlock: 'first_divine' },
  ];

  // ---------- Wisp buffs (golden-cookie style event) ----------
  G.WISP_EFFECTS = [
    { id: 'frenzy', w: 40, name: { ru: 'Неистовство! Золото ×7', en: 'Frenzy! Gold ×7' }, dur: 20 },
    { id: 'rain',   w: 24, name: { ru: 'Дождь сундуков!', en: 'Chest Rain!' } },
    { id: 'lucky',  w: 24, name: { ru: 'Удача! Мешок золота', en: 'Lucky! A sack of gold' } },
    { id: 'storm',  w: 10, name: { ru: 'Буря кликов! Клик ×77', en: 'Click Storm! Click ×77' }, dur: 10 },
    { id: 'egg',    w: 2,  name: { ru: 'Яйцо питомца!', en: 'A pet egg!' } },
  ];

  // ---------- Daily login rewards (7-day cycle) ----------
  G.DAILY = [
    { kind: 'gold', mins: 10 }, { kind: 'eggs', n: 2 }, { kind: 'gold', mins: 30 }, { kind: 'ess', n: 25 },
    { kind: 'eggs', n: 4 }, { kind: 'gold', mins: 90 }, { kind: 'chest', tier: 6 },
  ];
})(globalThis.G = globalThis.G || {});
