// BTTN — achievements. Each unlocked achievement gives +1% all gold.
(function (G) {
  'use strict';
  const A = (id, name, desc, test, hidden) => ({ id, name, desc, test, hidden });
  const allRarity = (S, r) => G.ITEMS_BY_RARITY[r].every(it => (S.coll[it.id] || 0) > 0);
  const nodesMaxed = S => G.NODES.every(n => (S.nodes[n.id] || 0) >= n.max);

  G.ACH = [
    A('clicks_100', 'Just the Beginning!', 'Click 100 times', S => S.clicks >= 100),
    A('clicks_1e3', 'Getting the Hang of It', 'Click 1,000 times', S => S.clicks >= 1e3),
    A('clicks_1e4', 'Hands on Fire!', 'Click 10,000 times', S => S.clicks >= 1e4),
    A('clicks_1e5', 'Buttonmancer', 'Click 100,000 times', S => S.clicks >= 1e5),
    A('clicks_1e6', 'Click Legend', 'Click 1,000,000 times', S => S.clicks >= 1e6),

    A('gold_1e3', 'First Thousand', 'Earn 1K gold', S => S.goldTotal >= 1e3),
    A('gold_1e6', 'Millionaire', 'Earn 1M gold', S => S.goldTotal >= 1e6),
    A('gold_1e9', 'Billionaire', 'Earn 1B gold', S => S.goldTotal >= 1e9),
    A('gold_1e12', 'Capitalist', 'Earn 1T gold', S => S.goldTotal >= 1e12),
    A('gold_1e15', 'Dragon Hoard', 'Earn 1Qa gold', S => S.goldTotal >= 1e15),
    A('gold_1e18', 'Realm Economy', 'Earn 1Qi gold', S => S.goldTotal >= 1e18),

    A('chests_10', 'Treasure Hunter', 'Open 10 chests', S => S.st.chests >= 10),
    A('chests_100', 'Lockpicker', 'Open 100 chests', S => S.st.chests >= 100),
    A('chests_1e3', 'Raider', 'Open 1,000 chests', S => S.st.chests >= 1e3),
    A('chests_1e4', 'Vault Breaker', 'Open 10,000 chests', S => S.st.chests >= 1e4),
    A('chests_1e5', 'No Lock Left', 'Open 100,000 chests', S => S.st.chests >= 1e5),
    A('field_200', 'Wall to Wall', '200 chests on the field at once', S => S.chests.length >= 200),
    A('events_100', 'Anything Can Happen', 'Survive 100 sudden events', S => (S.st.events || 0) >= 100),
    A('goblins_25', 'Thief Taker', 'Catch 25 treasure goblins', S => (S.st.goblins || 0) >= 25),
    A('smash_50', 'Rock Breaker', 'Smash 50 meteors midair', S => (S.st.smashed || 0) >= 50),
    A('jackpot', 'JACKPOT!', 'Hit the jackpot (~1 kill in 2 million)', S => !!(S.jp && S.jp.n > 0), true),

    A('rar_0', 'Junk Has Value', 'Find all Common items', S => allRarity(S, 0)),
    A('rar_1', 'Nice!', 'Find all Uncommon items', S => allRarity(S, 1)),
    A('rar_2', 'Rare Taste', 'Find all Rare items', S => allRarity(S, 2)),
    A('rar_3', 'Epic', 'Find all Epic items', S => allRarity(S, 3)),
    A('rar_4', 'Legends Never Die', 'Find all Legendary items', S => allRarity(S, 4)),
    A('rar_5', 'Myth Made Real', 'Find all Mythic items', S => allRarity(S, 5)),
    A('rar_6', 'Divine Set', 'Find all Divine items', S => allRarity(S, 6)),
    A('first_divine', 'WHITE BAG!', 'Get a Divine item', S => S.st.divine >= 1),
    A('all_items', 'Full Collection', 'Find all 42 items', S => G.ITEMS.every(it => (S.coll[it.id] || 0) > 0)),
    A('born_collector', 'Born Collector!', 'Own 1,000 of every item', S => G.ITEMS.every(it => (S.coll[it.id] || 0) >= 1000)),
    A('dungeon_master', 'Dungeon Master!', 'Open every chest rank 1,000 times', S => S.opened.every(n => n >= 1000)),
    A('merge_100', 'Alchemist', 'Fuse 100 chests', S => S.st.merges >= 100),
    A('mods_all', 'Oddities', 'See all 8 chest modifiers', S => G.MODIFIERS.every(m => S.modsSeen[m.id])),
    A('mimic_10', 'Toothless', 'Defeat 10 mimics', S => S.st.mimics >= 10),

    A('depth_5', 'Delving', 'Reach depth 5', S => S.bestDepth >= 4),
    A('depth_10', 'Seeker', 'Reach depth 10', S => S.bestDepth >= 9),
    A('depth_25', 'Conqueror', 'Reach depth 25', S => S.bestDepth >= 24),
    A('madbutton', 'Button vs Button', 'Beat The Mad Button (depth 40)', S => S.bestDepth >= 40),
    A('outer', 'Past the Button', 'Enter the Sunken Library (depth 41)', S => S.bestDepth >= 40),
    A('depth_60', 'Beyond', 'Reach depth 60', S => S.bestDepth >= 59),
    A('firsthand', 'Hand to Hand', 'Beat The First Hand (depth 65)', S => S.bestDepth >= 65),
    A('stars_5', 'Stargazer', 'Earn 5 land stars', S => (G.starCount ? G.starCount() : 0) >= 5),
    A('stars_20', 'Land Marks', 'Earn 20 land stars', S => (G.starCount ? G.starCount() : 0) >= 20),
    A('stars_all', 'Master of Every Land', 'Earn every land star', S => (G.starCount ? G.starCount() : 0) >= 3 * G.REALMS.length),
    A('carnage', 'Extinction Event', 'Reach a 2,000 kill streak', S => (S.st.bestStreak || 0) >= 2000),
    A('depth_100', 'The Abyss Stares Back', 'Reach depth 100', S => S.bestDepth >= 99),
    A('boss_1', 'First Blood', 'Defeat a boss', S => S.st.bossKills >= 1),
    A('boss_25', 'Hunter', 'Defeat 25 bosses', S => S.st.bossKills >= 25),
    A('boss_100', 'Slayer', 'Defeat 100 bosses', S => S.st.bossKills >= 100),
    A('boss_500', 'Scourge of the Realm', 'Defeat 500 bosses', S => S.st.bossKills >= 500),

    A('pet_1', 'Friend Forever', 'Get a pet', S => Object.keys(S.pets).length >= 1),
    A('pets_all', "They're So Cute!", 'Collect every pet', S => G.PETS.filter(p => !p.mythic).every(p => S.pets[p.id])),
    A('pets_gold', 'At Last, All of Them', 'Collect every golden pet', S => G.PETS.filter(p => !p.mythic).every(p => S.pets[p.id] && S.pets[p.id].gold)),
    // 3.5: the rare surprises (js/rare.js)
    A('rare_first', 'Once in a Blue Moon', 'See a rare surprise', S => Object.keys((S.st && S.st.rare) || {}).length > 0),
    A('rare_all', 'Seen It All', 'See every rare surprise', S => (G.RARE_LOG || []).length > 0 && G.RARE_LOG.every(e => ((S.st && S.st.rare) || {})[e.id])),
    A('mythic_pet', 'Mythical', 'Hatch a mythic pet', S => (G.MYTHIC_PETS || []).some(p => S.pets[p.id])),
    A('pet_max', 'Best Buddy', 'Get a pet to level 25', S => Object.values(S.pets).some(p => p.lvl >= 25)),

    A('combo_100', 'Rhythm Machine', 'Reach a 100 combo', S => S.st.maxCombo >= 100),
    A('combo_300', 'Unstoppable', 'Reach a 300 combo', S => S.st.maxCombo >= 300),
    A('crit_100', 'Sharpshooter', 'Land 100 crits', S => S.st.crits >= 100),
    A('crit_1e4', 'Critical Mass', 'Land 10,000 crits', S => S.st.crits >= 1e4),
    A('wisp_1', 'Gotcha!', 'Catch a wisp', S => S.st.wisps >= 1),
    A('wisp_50', 'Wisp Catcher', 'Catch 50 wisps', S => S.st.wisps >= 50),
    A('quest_10', 'Dutiful', 'Complete 10 quests', S => S.questsDone >= 10),
    A('quest_100', 'Hero for Hire', 'Complete 100 quests', S => S.questsDone >= 100),

    A('hero_100', 'An Army', 'Hire 100 heroes of one class', S => G.HEROES.some(h => (S.heroes[h.id] || 0) >= 100)),
    A('heroes_all', 'Full Party', 'Hire a hero of every class', S => G.HEROES.every(h => (S.heroes[h.id] || 0) > 0)),
    A('maxed', 'Maxed 8/8', 'Max all 8 potion stats', S => G.POTIONS.every(p => S.pots[p.id] >= (G.D.potCap || 10))),
    A('constellation', 'Our Constellation', 'Max the constellation', nodesMaxed),

    A('asc_1', 'Rest in Peace', 'Ascend once', S => S.ascensions >= 1),
    A('asc_5', 'Eternal Hero', 'Ascend 5 times', S => S.ascensions >= 5),
    A('asc_25', 'The Wheel Turns', 'Ascend 25 times', S => S.ascensions >= 25),
    A('prince', 'The Prince and the Button', "Buy the Prince's Crown", S => (S.upg.prince || 0) > 0, true),
    A('daily_7', 'Loyalty', 'Log in 7 days in a row', S => S.daily.streak >= 6),
    // 3.0
    A('relic_1', 'The White Bag', 'Find a relic', S => (S.st.relics || 0) >= 1),
    A('relic_all', 'Hundred Kings', 'Find every relic', S => !!G.RELIC_IDS && G.RELIC_IDS.every(q => ((S.rec && S.rec.relicN) || {})[q])),
    A('town_10', 'Hamlet', 'Reach town level 10', S => !!G.townLvl && G.townLvl() >= 10),
    A('town_max', 'Capital', 'Build up every building fully', S => !!G.townLvl && G.townLvl() >= G.BLD.length * G.BLD_MAX),
    // 3.6: the Lucky Spin's two (spin_100, spin_777) are retired; a save that earned them keeps them (and their +1%)
    A('bubble_100', 'Bubble Popper', 'Pop 100 bonus bubbles', S => (S.st.bubbles || 0) >= 100),
    A('casc_10', 'Hot Streak', 'Chain 10 crits in a row', S => (S.st.cascBest || 0) >= 10),
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
