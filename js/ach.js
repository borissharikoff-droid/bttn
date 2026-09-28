// BTTN — achievements. Each unlocked achievement gives +2% all gold.
(function (G) {
  'use strict';
  const A = (id, ru, en, dru, den, test, hidden) => ({ id, name: { ru, en }, desc: { ru: dru, en: den }, test, hidden });
  const allRarity = (S, r) => G.ITEMS_BY_RARITY[r].every(it => (S.coll[it.id] || 0) > 0);
  const nodesMaxed = S => G.NODES.every(n => (S.nodes[n.id] || 0) >= n.max);

  G.ACH = [
    A('clicks_100', 'Только начало!', 'Just the Beginning!', 'Кликни 100 раз', 'Click 100 times', S => S.clicks >= 100),
    A('clicks_1e3', 'Входим во вкус', 'Getting the Hang of It', 'Кликни 1 000 раз', 'Click 1,000 times', S => S.clicks >= 1e3),
    A('clicks_1e4', 'Руки горят!', 'Hands on Fire!', 'Кликни 10 000 раз', 'Click 10,000 times', S => S.clicks >= 1e4),
    A('clicks_1e5', 'Кнопкоман', 'Buttonmancer', 'Кликни 100 000 раз', 'Click 100,000 times', S => S.clicks >= 1e5),
    A('clicks_1e6', 'Легенда клика', 'Click Legend', 'Кликни 1 000 000 раз', 'Click 1,000,000 times', S => S.clicks >= 1e6),

    A('gold_1e3', 'Первая тысяча', 'First Thousand', 'Заработай 1K золота', 'Earn 1K gold', S => S.goldTotal >= 1e3),
    A('gold_1e6', 'Миллионер', 'Millionaire', 'Заработай 1M золота', 'Earn 1M gold', S => S.goldTotal >= 1e6),
    A('gold_1e9', 'Миллиардер', 'Billionaire', 'Заработай 1B золота', 'Earn 1B gold', S => S.goldTotal >= 1e9),
    A('gold_1e12', 'Капиталист', 'Capitalist', 'Заработай 1T золота', 'Earn 1T gold', S => S.goldTotal >= 1e12),
    A('gold_1e15', 'Драконья казна', 'Dragon Hoard', 'Заработай 1Qa золота', 'Earn 1Qa gold', S => S.goldTotal >= 1e15),
    A('gold_1e18', 'Экономика королевства', 'Realm Economy', 'Заработай 1Qi золота', 'Earn 1Qi gold', S => S.goldTotal >= 1e18),

    A('chests_10', 'Кладоискатель', 'Treasure Hunter', 'Открой 10 сундуков', 'Open 10 chests', S => S.st.chests >= 10),
    A('chests_100', 'Взломщик', 'Lockpicker', 'Открой 100 сундуков', 'Open 100 chests', S => S.st.chests >= 100),
    A('chests_1e3', 'Расхититель', 'Raider', 'Открой 1 000 сундуков', 'Open 1,000 chests', S => S.st.chests >= 1e3),
    A('chests_1e4', 'Гроза сокровищниц', 'Vault Breaker', 'Открой 10 000 сундуков', 'Open 10,000 chests', S => S.st.chests >= 1e4),
    A('chests_1e5', 'Ни одного замка', 'No Lock Left', 'Открой 100 000 сундуков', 'Open 100,000 chests', S => S.st.chests >= 1e5),

    A('rar_0', 'Хлам тоже ценность', 'Junk Has Value', 'Найди все обычные предметы', 'Find all Common items', S => allRarity(S, 0)),
    A('rar_1', 'Неплохо!', 'Nice!', 'Найди все необычные предметы', 'Find all Uncommon items', S => allRarity(S, 1)),
    A('rar_2', 'Редкий вкус', 'Rare Taste', 'Найди все редкие предметы', 'Find all Rare items', S => allRarity(S, 2)),
    A('rar_3', 'Эпично', 'Epic', 'Найди все эпические предметы', 'Find all Epic items', S => allRarity(S, 3)),
    A('rar_4', 'Легенды не умирают', 'Legends Never Die', 'Найди все легендарные предметы', 'Find all Legendary items', S => allRarity(S, 4)),
    A('rar_5', 'Миф стал явью', 'Myth Made Real', 'Найди все мифические предметы', 'Find all Mythic items', S => allRarity(S, 5)),
    A('rar_6', 'Божественный комплект', 'Divine Set', 'Найди все божественные предметы', 'Find all Divine items', S => allRarity(S, 6)),
    A('first_divine', 'БЕЛЫЙ МЕШОК!', 'WHITE BAG!', 'Получи божественный предмет', 'Get a Divine item', S => S.st.divine >= 1),
    A('all_items', 'Полная коллекция', 'Full Collection', 'Найди все 42 предмета', 'Find all 42 items', S => G.ITEMS.every(it => (S.coll[it.id] || 0) > 0)),
    A('born_collector', 'Прирождённый коллекционер!', 'Born Collector!', 'Собери по 1 000 каждого предмета', 'Own 1,000 of every item', S => G.ITEMS.every(it => (S.coll[it.id] || 0) >= 1000)),
    A('dungeon_master', 'Хозяин подземелья!', 'Dungeon Master!', 'Открой сундук каждого ранга 1 000 раз', 'Open every chest rank 1,000 times', S => S.opened.every(n => n >= 1000)),
    A('merge_100', 'Алхимик', 'Alchemist', 'Слей 100 сундуков', 'Fuse 100 chests', S => S.st.merges >= 100),
    A('mods_all', 'Коллекция странностей', 'Oddities', 'Встреть все 8 модификаторов', 'See all 8 chest modifiers', S => G.MODIFIERS.every(m => S.modsSeen[m.id])),
    A('mimic_10', 'Зубы не помогли', 'Toothless', 'Победи 10 мимиков', 'Defeat 10 mimics', S => S.st.mimics >= 10),

    A('depth_5', 'Вглубь', 'Delving', 'Достигни глубины 5', 'Reach depth 5', S => S.bestDepth >= 5),
    A('depth_10', 'Искатель', 'Seeker', 'Достигни глубины 10', 'Reach depth 10', S => S.bestDepth >= 10),
    A('depth_25', 'Покоритель', 'Conqueror', 'Достигни глубины 25', 'Reach depth 25', S => S.bestDepth >= 25),
    A('madbutton', 'Кнопка против кнопки', 'Button vs Button', 'Победи Безумную Кнопку (глубина 40)', 'Defeat The Mad Button (depth 40)', S => S.bestDepth >= 40),
    A('depth_60', 'За гранью', 'Beyond', 'Достигни глубины 60', 'Reach depth 60', S => S.bestDepth >= 60),
    A('depth_100', 'Бездна смотрит в тебя', 'The Abyss Stares Back', 'Достигни глубины 100', 'Reach depth 100', S => S.bestDepth >= 100),
    A('boss_1', 'Первая кровь', 'First Blood', 'Победи босса', 'Defeat a boss', S => S.st.bossKills >= 1),
    A('boss_25', 'Охотник', 'Hunter', 'Победи 25 боссов', 'Defeat 25 bosses', S => S.st.bossKills >= 25),
    A('boss_100', 'Истребитель', 'Slayer', 'Победи 100 боссов', 'Defeat 100 bosses', S => S.st.bossKills >= 100),
    A('boss_500', 'Бич королевства', 'Scourge of the Realm', 'Победи 500 боссов', 'Defeat 500 bosses', S => S.st.bossKills >= 500),

    A('pet_1', 'Друг навсегда', 'Friend Forever', 'Получи первого питомца', 'Get your first pet', S => Object.keys(S.pets).length >= 1),
    A('pets_all', 'Какие милые!', "They're So Cute!", 'Собери всех питомцев', 'Collect every pet', S => G.PETS.every(p => S.pets[p.id])),
    A('pets_gold', 'Наконец-то все', 'At Last, All of Them', 'Собери всех золотых питомцев', 'Collect every golden pet', S => G.PETS.every(p => S.pets[p.id] && S.pets[p.id].gold)),
    A('pet_max', 'Лучший друг', 'Best Buddy', 'Прокачай питомца до 25 ур.', 'Raise a pet to level 25', S => Object.values(S.pets).some(p => p.lvl >= 25)),

    A('combo_100', 'Ритм-машина', 'Rhythm Machine', 'Набери комбо 100', 'Reach a 100 combo', S => S.st.maxCombo >= 100),
    A('combo_300', 'Неудержимый', 'Unstoppable', 'Набери комбо 300', 'Reach a 300 combo', S => S.st.maxCombo >= 300),
    A('crit_100', 'Меткость', 'Sharpshooter', 'Сделай 100 критов', 'Land 100 crits', S => S.st.crits >= 100),
    A('crit_1e4', 'Критическая масса', 'Critical Mass', 'Сделай 10 000 критов', 'Land 10,000 crits', S => S.st.crits >= 1e4),
    A('wisp_1', 'Поймал!', 'Gotcha!', 'Поймай блуждающий огонёк', 'Catch a wisp', S => S.st.wisps >= 1),
    A('wisp_50', 'Ловец огоньков', 'Wisp Catcher', 'Поймай 50 огоньков', 'Catch 50 wisps', S => S.st.wisps >= 50),
    A('quest_10', 'Исполнительный', 'Dutiful', 'Выполни 10 заданий', 'Complete 10 quests', S => S.questsDone >= 10),
    A('quest_100', 'Герой по найму', 'Hero for Hire', 'Выполни 100 заданий', 'Complete 100 quests', S => S.questsDone >= 100),

    A('hero_100', 'Армия', 'An Army', 'Найми 100 героев одного класса', 'Hire 100 heroes of one class', S => G.HEROES.some(h => (S.heroes[h.id] || 0) >= 100)),
    A('heroes_all', 'Полный отряд', 'Full Party', 'Найми героя каждого класса', 'Hire a hero of every class', S => G.HEROES.every(h => (S.heroes[h.id] || 0) > 0)),
    A('maxed', 'Прокачан 8/8', 'Maxed 8/8', 'Доведи все 8 зелий до лимита', 'Max all 8 potion stats', S => G.POTIONS.every(p => S.pots[p.id] >= (G.D.potCap || 10))),
    A('constellation', 'Наше созвездие', 'Our Constellation', 'Прокачай всё созвездие', 'Max the whole constellation', nodesMaxed),

    A('asc_1', 'Покойся с миром', 'Rest in Peace', 'Вознесись впервые', 'Ascend for the first time', S => S.ascensions >= 1),
    A('asc_5', 'Вечный герой', 'Eternal Hero', 'Вознесись 5 раз', 'Ascend 5 times', S => S.ascensions >= 5),
    A('asc_25', 'Колесо сансары', 'The Wheel Turns', 'Вознесись 25 раз', 'Ascend 25 times', S => S.ascensions >= 25),
    A('prince', 'Принц и Кнопка', 'The Prince and the Button', 'Купи Корону Принца', "Buy the Prince's Crown", S => (S.upg.prince || 0) > 0, true),
    A('daily_7', 'Верность', 'Loyalty', 'Заходи 7 дней подряд', 'Log in 7 days in a row', S => S.daily.streak >= 6),
  ];
  G.ACH_BY_ID = {}; G.ACH.forEach(a => G.ACH_BY_ID[a.id] = a);

  G.checkAchievements = function () {
    const S = G.S;
    let changed = false;
    for (const a of G.ACH) {
      if (S.ach[a.id]) continue;
      let ok = false;
      try { ok = a.test(S); } catch (e) { ok = false; }
      if (ok) { S.ach[a.id] = Date.now(); changed = true; G.emit('achievement', a); }
    }
    if (changed) { G.dirty(); G.recalc(); }
  };
})(globalThis.G = globalThis.G || {});
