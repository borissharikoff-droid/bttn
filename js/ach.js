// BTTN — achievements, and (4.0) the Deeds: the unlock treadmill. DOM-free (runs in the Node playtests).
//
// 4.0 (DESIGN §4.8): about 120 Deeds = the achievements (each still +1% gold within the run and +2 Gems) plus the run
// deeds below (their reward is what they unlock). At least 45 of them unlock content: Buttons, classes, perks, lands, uniques, relics, shrines, Auto-Run and
// the cosmetic skins. A Deed can complete mid-run (a toast: 'deed'); what it unlocks applies from the next run.
//   G.ACH (achievements), G.RUN_DEEDS (run deeds), G.DEEDS (both), G.DEED_BY_ID
//   G.deedDone(id), G.deedProgress(id) -> [cur, need] | null, G.checkAchievements() (every second from game.js tick)
//   G.unlocked(kind, id) -> bool (kinds: button, class, perk, land, unique, relic, shrine, skin, system); G.unlockDeed,
//   G.unlockHint(kind, id) -> the lock's words; G.unlockName(kind, id); G.nextUnlocks(n) -> the nearest unlocks with their bars
//   G.landOpen / G.relicOpen / G.classOpen / G.btnOpen / G.shrineOpen / G.perkOpen: the same, by the names other modules ask
//   Events: 'deed'(deed, unlocks [{kind, id, key, name}]), 'unlock'(kind, id, deed), 'achievement'(a) (the Gems)
//   State: S.ach {id: time} (achievements), S.deeds {id: time} (run deeds), S.unl {'kind:id': run n (0 between runs)},
//   S.dst (the Deeds' counters; see below), S.run.mt (this run's: land clock, pips lost, Clockwork presses...)
(function (G) {
  'use strict';
  const { emit } = G;
  const A = (id, name, desc, test, hidden, unlock) => ({ id, name, desc, test, hidden, unlock: unlock || null, ach: 1 });
  const allRarity = (S, r) => G.ITEMS_BY_RARITY[r].every(it => (S.coll[it.id] || 0) > 0);
  const lordSlain = (S, land) => !!(S.gemLords && S.gemLords[land]);
  const landSeen = (S, land) => { const i = G.REALM_BY_ID ? G.REALM_BY_ID[land] : -1; return !!(dst(S).lands[land] || (i >= 0 && S.lands && S.lands[i] && (S.lands[i].k | 0) > 0)); };
  const relicsHave = S => { const n = {}; for (const q in (S.rec && S.rec.relicN) || {}) n[q] = 1; for (const q in S.codex || {}) if (S.codex[q] && S.codex[q].relic) n[q] = 1; return n; };

  // ---------- The Deeds' counters (S.dst): what the run deeds read, kept for good ----------
  function dst(S) {
    S = S || G.S;
    const d = S.dst || (S.dst = {});
    if (!d.lands) d.lands = {};
    if (!d.winBtn) d.winBtn = {};
    if (!d.winCls) d.winCls = {};
    return d;
  }
  G.deedStats = () => dst(G.S);
  const n_ = v => v | 0;

  G.ACH = [
    A('clicks_100', 'Just the Beginning!', 'Click 100 times', S => S.clicks >= 100),
    A('clicks_1e3', 'Getting the Hang of It', 'Click 1,000 times', S => S.clicks >= 1e3),
    A('clicks_1e4', 'Hands on Fire!', 'Click 10,000 times', S => S.clicks >= 1e4),
    A('clicks_1e5', 'Buttonmancer', 'Click 100,000 times', S => S.clicks >= 1e5),
    A('clicks_1e6', 'Click Legend', 'Click 1,000,000 times', S => S.clicks >= 1e6),

    A('gold_1e3', 'First Thousand', 'Earn 1K gold', S => S.goldTotal >= 1e3),
    A('gold_1e6', 'Millionaire', 'Earn 1M gold', S => S.goldTotal >= 1e6),
    A('gold_1e9', 'Billionaire', 'Earn 1B gold', S => S.goldTotal >= 1e9, 0, 'skin:gold'),
    A('gold_1e12', 'Capitalist', 'Earn 1T gold', S => S.goldTotal >= 1e12),
    A('gold_1e15', 'Dragon Hoard', 'Earn 1Qa gold', S => S.goldTotal >= 1e15),
    A('gold_1e18', 'Realm Economy', 'Earn 1Qi gold', S => S.goldTotal >= 1e18),

    A('chests_10', 'Treasure Hunter', 'Open 10 chests', S => S.st.chests >= 10),
    A('chests_100', 'Lockpicker', 'Open 100 chests', S => S.st.chests >= 100, 0, 'skin:emerald'),
    A('chests_1e3', 'Raider', 'Open 1,000 chests', S => S.st.chests >= 1e3),
    A('chests_1e4', 'Vault Breaker', 'Open 10,000 chests', S => S.st.chests >= 1e4),
    A('chests_1e5', 'No Lock Left', 'Open 100,000 chests', S => S.st.chests >= 1e5),
    // (4.0: field_200 'Wall to Wall' is retired: a Siege's field holds 6-8 chests)
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
    A('first_divine', 'WHITE BAG!', 'Get a Divine item', S => S.st.divine >= 1, 0, 'skin:divine'),
    A('all_items', 'Full Collection', 'Find all 42 items', S => G.ITEMS.every(it => (S.coll[it.id] || 0) > 0), 0, 'skin:rainbow'),
    A('born_collector', 'Born Collector!', 'Own 1,000 of every item', S => G.ITEMS.every(it => (S.coll[it.id] || 0) >= 1000)),
    A('dungeon_master', 'Dungeon Master!', 'Open every chest rank 1,000 times', S => S.opened.every(n => n >= 1000)),
    A('merge_100', 'Alchemist', 'Fuse 100 chests', S => S.st.merges >= 100),
    A('mods_all', 'Oddities', 'See all 8 chest modifiers', S => G.MODIFIERS.every(m => S.modsSeen[m.id])),
    A('mimic_10', 'Toothless', 'Defeat 10 mimics', S => S.st.mimics >= 10),

    // (4.0: a Siege is 18 zones (depths 1-18); past it, Push On. The Mad Button and the First Hand by their lands)
    A('depth_5', 'Delving', 'Reach depth 5', S => S.bestDepth >= 4),
    A('depth_10', 'Seeker', 'Reach depth 10', S => S.bestDepth >= 9, 0, 'skin:sapphire'),
    A('depth_25', 'Conqueror', 'Reach depth 25 (Push On)', S => S.bestDepth >= 24),
    A('madbutton', 'Button vs Button', 'Slay the Mad Button', S => lordSlain(S, 'void') || (S.st.siegeWins | 0) > 0, 0, ['unique:voidplate', 'skin:obsidian']),
    A('outer', 'Past the Button', 'Enter the Sunken Library', S => landSeen(S, 'library')),
    A('depth_60', 'Beyond', 'Reach depth 60 (Push On)', S => S.bestDepth >= 59),
    A('firsthand', 'Hand to Hand', 'Slay the First Hand', S => lordSlain(S, 'sky')),
    A('stars_5', 'Stargazer', 'Earn 5 land stars', S => (G.starCount ? G.starCount() : 0) >= 5),
    A('stars_20', 'Land Marks', 'Earn 20 land stars', S => (G.starCount ? G.starCount() : 0) >= 20),
    A('stars_all', 'Master of Every Land', 'Earn every land star', S => (G.starCount ? G.starCount() : 0) >= 3 * G.REALMS.length),
    A('carnage', 'Extinction Event', 'Reach a 2,000 kill streak', S => (S.st.bestStreak || 0) >= 2000),
    A('depth_100', 'The Abyss Stares Back', 'Reach depth 100 (Push On)', S => S.bestDepth >= 99),
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
    // (4.0: heroes_all 'Full Party', maxed 'Maxed 8/8' and constellation 'Our Constellation' are retired with field_200:
    // the Garrison and potions are the run's now and the Star Chart is a 23,000-Ember sink. A save that earned them keeps
    // them, and their +1% gold: S.ach still holds them)

    // (4.0: the ascensions count wins and extracts made at Camp 4 or later, js/run.js)
    A('asc_1', 'Rest in Peace', 'Win a Siege, or extract at Camp 4 or later', S => S.ascensions >= 1, 0, 'skin:amethyst'),
    A('asc_5', 'Eternal Hero', 'Win or extract late 5 times', S => S.ascensions >= 5),
    A('asc_25', 'The Wheel Turns', 'Win or extract late 25 times', S => S.ascensions >= 25),
    A('prince', 'The Prince and the Button', "Buy the Prince's Crown", S => (S.upg.prince || 0) > 0, true),
    A('daily_7', 'Loyalty', 'Log in 7 days in a row', S => S.daily.streak >= 6),
    // 3.0 (4.0: a relic on the belt counts: it goes into the Codex)
    A('relic_1', 'The White Bag', 'Find a relic', S => (S.st.relics || 0) >= 1 || Object.keys(relicsHave(S)).length > 0),
    A('relic_all', 'Hundred Kings', 'Find every relic', S => !!G.RELIC_IDS && G.RELIC_IDS.every(q => relicsHave(S)[q])),
    A('town_10', 'Hamlet', 'Reach town level 10', S => !!G.townLvl && G.townLvl() >= 10),
    A('town_max', 'Capital', 'Build up every building fully', S => !!G.townLvl && G.townLvl() >= G.BLD.length * G.BLD_MAX),
    // 3.6: the Lucky Spin's two (spin_100, spin_777) are retired; a save that earned them keeps them (and their +1%)
    A('bubble_100', 'Bubble Popper', 'Pop 100 bonus bubbles', S => (S.st.bubbles || 0) >= 100),
    A('casc_10', 'Hot Streak', 'Chain 10 crits in a row', S => (S.st.cascBest || 0) >= 10),
  ];
  // the achievements retired in 4.0 (kept in a save that earned them, never offered again)
  G.ACH_RETIRED = ['field_200', 'heroes_all', 'maxed', 'constellation', 'spin_100', 'spin_777'];
  G.ACH_BY_ID = {}; G.ACH.forEach(a => { G.ACH_BY_ID[a.id] = a; });

  // ---------- 4.0: the run deeds (DESIGN §4.8 unlock table, plus mastery goals) ----------
  // D(id, cat, name, desc, test(S, st), prog(S, st) -> [cur, need], unlock). st = S.dst. cat groups them on the board.
  const D = (id, cat, name, desc, test, prog, unlock, hidden) => ({ id, cat, name, desc, test, prog: prog || null, unlock: unlock || null, hidden: !!hidden, run: 1 });
  const P = (f, need) => (S, st) => [Math.min(need, f(S, st)), need];
  const B1 = f => (S, st) => [f(S, st) ? 1 : 0, 1];
  const falls = (S, st) => Math.max(S.st.deaths | 0, st.falls | 0);
  const lordD = (id, land, lordName, unlock, cat) => D(id, cat || 'land', lordName.replace(/^the /, 'The ') + ' Slain', 'Slay ' + lordName, S => lordSlain(S, land), B1(S => lordSlain(S, land)), unlock);
  G.RUN_DEEDS = [
    // -- the Buttons (DESIGN §6.1) --
    // (falls: S.st.deaths, which js/run.js counts after 'runEnding'; st.falls is the count this module saw at it)
    D('dd_falls3', 'button', 'Hard Lessons', 'Fall 3 times', (S, st) => falls(S, st) >= 3, P((S, st) => falls(S, st), 3), 'button:iron'),
    D('dd_act1', 'button', 'Act I Breaker', 'Slay an Act I boss', (S, st) => n_(st.act1) > 0, B1((S, st) => n_(st.act1) > 0), 'button:storm'),
    D('dd_spit', 'button', 'Spore Collector', 'Slay 2,000 Spitters', (S, st) => n_(st.spit) >= 2000, P((S, st) => n_(st.spit), 2000), 'button:spore'),
    D('dd_gold1m', 'button', 'Hoarder', 'Hold 1M gold in a Siege', (S, st) => (st.goldHeld || 0) >= 1e6, P((S, st) => Math.floor(st.goldHeld || 0), 1e6), 'button:gold'),
    D('dd_win', 'button', 'The Mad Button Falls', 'Win a Siege', (S, st) => n_(st.wins) > 0, P((S, st) => n_(st.wins), 1), ['button:glass', 'land:moon']),
    D('dd_evo5', 'button', 'Evolutionist', 'Discover 5 evolutions', S => Object.keys((S.rec && S.rec.evos) || {}).length >= 5, P(S => Object.keys((S.rec && S.rec.evos) || {}).length, 5), 'button:prism'),
    D('dd_sieges3', 'button', 'Old Hand', 'Play 3 Sieges to their end', (S, st) => n_(st.ended) >= 3, P((S, st) => n_(st.ended), 3), ['button:clockwork', 'system:autorun']),
    // -- classes --
    D('dd_champ10', 'class', 'Champion Hunter', 'Kill 10 Land Champions', S => (S.st.champs | 0) >= 10, P(S => S.st.champs | 0, 10), 'class:rogue'),
    D('dd_revive100', 'class', 'Field Medic', 'Revive companions 100 times', (S, st) => n_(st.revives) >= 100, P((S, st) => n_(st.revives), 100), 'class:cleric'),
    // -- perks (11 of 33 locked) --
    D('dd_kills1e5', 'perk', 'Hundred Thousand', 'Slay 100,000 of the Horde', S => (S.hero && S.hero.kills || 0) >= 1e5, P(S => (S.hero && S.hero.kills) || 0, 1e5), 'perk:overkill'),
    D('dd_fastland', 'perk', 'Swift Conquest', 'Clear a land in under 2:30', (S, st) => st.fastLand > 0 && st.fastLand < 150, B1((S, st) => st.fastLand > 0 && st.fastLand < 150), 'perk:momentum'),
    D('dd_thread', 'perk', 'By a Thread', 'Slay a lord with the Button under 20%', (S, st) => n_(st.lowLord) > 0, B1((S, st) => n_(st.lowLord) > 0), 'perk:laststand'),
    D('dd_archer3', 'perk', 'Far Shot', 'Reach Act III with an Archer', (S, st) => n_(st.archer3) > 0, B1((S, st) => n_(st.archer3) > 0), 'perk:ricochet'),
    D('dd_revive250', 'perk', 'Soul Keeper', 'Revive companions 250 times', (S, st) => n_(st.revives) >= 250, P((S, st) => n_(st.revives), 250), 'perk:souls'),
    D('dd_clicks5e4', 'perk', 'Iron Knuckles', 'Click 50,000 times', S => S.clicks >= 5e4, P(S => S.clicks, 5e4), 'perk:crush'),
    D('dd_champ25', 'perk', 'Marked Prey', 'Kill 25 Land Champions', S => (S.st.champs | 0) >= 25, P(S => S.st.champs | 0, 25), 'perk:mark'),
    D('dd_warband', 'perk', 'Band of Four', 'Reach a lord with 3 companions standing', (S, st) => n_(st.warband) >= 3, P((S, st) => n_(st.warband), 3), 'perk:warband'),
    D('dd_glasswin', 'perk', 'Glass Victory', 'Win with the Glass Button', (S, st) => n_(st.winBtn.glass) > 0, B1((S, st) => n_(st.winBtn.glass) > 0), 'perk:glass'),
    D('dd_ironwin', 'perk', 'Iron Victory', 'Win with the Iron Button', (S, st) => n_(st.winBtn.iron) > 0, B1((S, st) => n_(st.winBtn.iron) > 0), 'perk:fortress'),
    D('dd_gold10m', 'perk', "Dragon's Purse", 'Hold 10M gold in a Siege', (S, st) => (st.goldHeld || 0) >= 1e7, P((S, st) => Math.floor(st.goldHeld || 0), 1e7), 'perk:avarice'),
    // -- lands (7 locked) and uniques (9 locked; the Last Button and the Palm drop from their bosses only) --
    lordD('dd_lord_meadow', 'meadow', 'the Goblin Warchief', 'land:highlands'),
    lordD('dd_lord_forest', 'forest', 'the Elder Treant', 'land:tundra'),
    lordD('dd_lord_godlands', 'godlands', 'the All-Seeing Eye', ['land:library', 'unique:watcher']),
    lordD('dd_lord_abyss', 'abyss', 'the Demon Lord', ['land:foundry', 'unique:hellstring']),
    D('dd_void', 'land', 'Into the Void', 'Reach the Void', (S, st) => n_(st.voidReached) > 0, B1((S, st) => n_(st.voidReached) > 0), 'land:mirror'),
    D('dd_heat2', 'land', 'Heat Walker', 'Win at Heat 2', (S, st) => (st.winHeat == null ? -1 : st.winHeat) >= 2, P((S, st) => Math.max(0, st.winHeat == null ? 0 : st.winHeat), 2), 'land:cosmos'),
    lordD('dd_lord_tundra', 'tundra', 'the Frost Wyrm', 'unique:frostwalk', 'unique'),
    D('dd_heat1', 'unique', "Reaper's Due", 'Win at Heat 1', (S, st) => (st.winHeat == null ? -1 : st.winHeat) >= 1, P((S, st) => Math.max(0, st.winHeat == null ? 0 : st.winHeat), 1), 'unique:reaper'),
    lordD('dd_lord_library', 'library', 'the Drowned Archivist', 'unique:codex', 'unique'),
    lordD('dd_lord_foundry', 'foundry', 'the Gear Tyrant', 'unique:tyrant', 'unique'),
    lordD('dd_lord_ember', 'ember', 'the Ashen Colossus', 'unique:ashbringer', 'unique'),
    lordD('dd_lord_mirror', 'mirror', 'the Other Warden', 'unique:othercloak', 'unique'),
    // -- relics in the belt pool (5 of 8 locked) --
    D('dd_archerwin', 'relic', 'Dawn Archer', 'Win with an Archer', (S, st) => n_(st.winCls.archer) > 0, B1((S, st) => n_(st.winCls.archer) > 0), 'relic:dawnpiercer'),
    D('dd_wizardwin', 'relic', 'Unpressed', 'Win with a Wizard', (S, st) => n_(st.winCls.wizard) > 0, B1((S, st) => n_(st.winCls.wizard) > 0), 'relic:unpressed'),
    D('dd_supernova', 'relic', 'World Egg', 'Evolve Supernova', S => !!(S.rec && S.rec.evos && S.rec.evos.supernova), B1(S => !!(S.rec && S.rec.evos && S.rec.evos.supernova)), 'relic:worldegg'),
    D('dd_flawless', 'relic', 'Flawless', 'Win without losing a pip', (S, st) => n_(st.flawless) > 0, B1((S, st) => n_(st.flawless) > 0), 'relic:lastfeather'),
    D('dd_heat5', 'relic', 'First Crown', 'Win at Heat 5', (S, st) => (st.winHeat == null ? -1 : st.winHeat) >= 5, P((S, st) => Math.max(0, st.winHeat == null ? 0 : st.winHeat), 5), 'relic:firstcrown'),
    // -- shrines --
    D('dd_act2', 'shrine', 'Into Act II', 'Reach Act II', (S, st) => n_(st.act2) > 0, B1((S, st) => n_(st.act2) > 0), 'shrine:pact'),
    D('dd_gold100k', 'shrine', 'Coin Pile', 'Hold 100,000 gold in a Siege', (S, st) => (st.goldHeld || 0) >= 1e5, P((S, st) => Math.floor(st.goldHeld || 0), 1e5), 'shrine:chance'),
    // -- mastery (no unlock: the Deeds' long tail) --
    D('dd_extract4', 'mastery', 'Banked', 'Extract at Camp 4 or later', (S, st) => n_(st.extract4) > 0, B1((S, st) => n_(st.extract4) > 0)),
    D('dd_par', 'mastery', 'On Pace', 'Win under par', (S, st) => n_(st.par) > 0, B1((S, st) => n_(st.par) > 0)),
    D('dd_fullhouse', 'mastery', 'Full House', 'Win with 3 companions', (S, st) => n_(st.party3) > 0, B1((S, st) => n_(st.party3) > 0)),
    D('dd_evo2', 'mastery', 'Twin Evolutions', 'Evolve 2 perks in one Siege', (S, st) => n_(st.evoRun) >= 2, P((S, st) => n_(st.evoRun), 2)),
    D('dd_evo3', 'mastery', 'Triple Crown', 'Evolve 3 perks in one Siege', (S, st) => n_(st.evoRun) >= 3, P((S, st) => n_(st.evoRun), 3)),
    D('dd_belt3', 'mastery', 'Belt Buckle', 'Wear 3 relics on the belt at once', (S, st) => n_(st.belt) >= 3, P((S, st) => n_(st.belt), 3)),
    D('dd_keys3', 'mastery', 'Key Ring', 'Hold 3 Keys at once', (S, st) => n_(st.keys) >= 3, P((S, st) => n_(st.keys), 3)),
    D('dd_vault', 'mastery', 'Vault Breaker', 'Clear a Vault land', (S, st) => n_(st.vault) > 0, B1((S, st) => n_(st.vault) > 0)),
    D('dd_push', 'mastery', 'Push On', 'Clear a land past the Mad Button', (S, st) => n_(st.push) > 0, B1((S, st) => n_(st.push) > 0)),
    D('dd_push3', 'mastery', 'Into the Tide', 'Clear 3 lands past the Mad Button in one Siege', (S, st) => n_(st.push) >= 3, P((S, st) => n_(st.push), 3)),
    D('dd_daily', 'mastery', 'Daily Siege', 'Finish a Daily Siege', (S, st) => n_(st.daily) > 0, B1((S, st) => n_(st.daily) > 0)),
    D('dd_daily7', 'mastery', 'Daily Grind', 'Finish 7 Daily Sieges', (S, st) => n_(st.daily) >= 7, P((S, st) => n_(st.daily), 7)),
    D('dd_laststand', 'mastery', 'Hold the Line', 'Survive the Last Stand', (S, st) => n_(st.lastStand) > 0, B1((S, st) => n_(st.lastStand) > 0)),
    D('dd_heat10', 'mastery', 'White Heat', 'Win at Heat 10', (S, st) => (st.winHeat == null ? -1 : st.winHeat) >= 10, P((S, st) => Math.max(0, st.winHeat == null ? 0 : st.winHeat), 10)),
    D('dd_wins10', 'mastery', 'Siegebreaker', 'Win 10 Sieges', (S, st) => n_(st.wins) >= 10, P((S, st) => n_(st.wins), 10)),
    D('dd_btns4', 'mastery', 'Button Collector', 'Win with 4 different Buttons', (S, st) => Object.keys(st.winBtn).length >= 4, P((S, st) => Object.keys(st.winBtn).length, 4)),
    D('dd_lands12', 'mastery', 'Cartographer', 'Fight in 12 different lands', (S, st) => Object.keys(st.lands).length >= 12, P((S, st) => Object.keys(st.lands).length, 12)),
    D('dd_codex4', 'mastery', 'Curator', 'Raise a Codex entry to rank 4', S => Object.values(S.codex || {}).some(c => (c.rank | 0) >= 4), B1(S => Object.values(S.codex || {}).some(c => (c.rank | 0) >= 4))),
    D('dd_btnevo', 'mastery', 'It Changed', 'Evolve a Button', S => Object.keys((S.rec && S.rec.btnEvos) || {}).length > 0, B1(S => Object.keys((S.rec && S.rec.btnEvos) || {}).length > 0)),
  ];
  G.DEEDS = G.ACH.concat(G.RUN_DEEDS);
  G.DEED_BY_ID = {}; G.DEEDS.forEach(d => { G.DEED_BY_ID[d.id] = d; });
  // (the achievements' progress bars where a counter says how far: the Deeds board shows them)
  const ACH_PROG = { clicks_100: 100, clicks_1e3: 1e3, clicks_1e4: 1e4, clicks_1e5: 1e5, clicks_1e6: 1e6 };
  for (const id in ACH_PROG) G.ACH_BY_ID[id].prog = P(S => S.clicks, ACH_PROG[id]);
  ['10', '100', '1e3', '1e4', '1e5'].forEach(k => { const a = G.ACH_BY_ID['chests_' + k]; if (a) a.prog = P(S => S.st.chests | 0, +k); });
  ['1', '25', '100', '500'].forEach(k => { const a = G.ACH_BY_ID['boss_' + k]; if (a) a.prog = P(S => S.st.bossKills | 0, +k); });
  ['1', '5', '25'].forEach(k => { const a = G.ACH_BY_ID['asc_' + k]; if (a) a.prog = P(S => S.ascensions | 0, +k); });
  G.ACH_BY_ID.depth_10.prog = P(S => Math.min(10, (S.bestDepth | 0) + 1), 10);
  G.ACH_BY_ID.gold_1e9.prog = P(S => Math.floor(S.goldTotal || 0), 1e9);

  // ---------- Unlocks ----------
  // The lockable content and what each kind's ids are; anything not listed here is open from the start
  // (DESIGN §4.8: Buttons but the Classic; Rogue and Cleric; 11 of 33 perks (data.js G.PERK_LOCKED); 7 lands (the
  // REALMS without .start); 9 of 19 uniques; 5 of 8 relics; the Pact and Chance shrines; the skins; Auto-Run)
  const LOCKED = {
    button: ['iron', 'storm', 'spore', 'gold', 'glass', 'prism', 'clockwork', 'golden'],
    class: ['rogue', 'cleric'],
    perk: (G.PERK_LOCKED || []).slice(),
    land: G.REALMS.filter(r => !r.start && r.act).map(r => r.id),
    unique: ['frostwalk', 'watcher', 'hellstring', 'voidplate', 'reaper', 'codex', 'tyrant', 'ashbringer', 'othercloak'],
    relic: ['dawnpiercer', 'unpressed', 'worldegg', 'lastfeather', 'firstcrown'],
    shrine: ['pact', 'chance'],
    skin: ['emerald', 'sapphire', 'amethyst', 'gold', 'obsidian', 'rainbow', 'divine', 'golden', 'founder'],
    system: ['autorun'],
  };
  G.UNLOCK_LOCKED = LOCKED;
  const LOCK_SET = {}; for (const k in LOCKED) LOCK_SET[k] = new Set(LOCKED[k]);
  const keyOf = (kind, id) => kind + ':' + id;
  const unlState = S => S.unl || (S.unl = {});
  // is this content open? (kinds above; an unknown kind or id: open). What a Deed opened in the run being played opens from
  // the next run (S.unl[key] = that run's number)
  G.unlocked = function (kind, id) {
    const set = LOCK_SET[kind];
    if (!set || !set.has(id)) return true;
    const S = G.S; if (!S) return false;
    const u = S.unl && S.unl[keyOf(kind, id)];
    if (u == null) {
      // (a season-3 founder's companions: their classes are open; the Founder skin)
      if (kind === 'class' && S.founders && Array.isArray(S.founders.classes) && S.founders.classes.includes(id)) return true;
      if (kind === 'skin' && id === 'founder') return !!(S.founders && S.founders.skin === 'founder');
      return false;
    }
    const r = S.run;
    return !(r && r.on && u > 0 && (r.n | 0) === u);
  };
  // the same, by the names the other modules ask
  G.landOpen = id => G.unlocked('land', id);
  G.relicOpen = id => G.unlocked('relic', id);
  G.classOpen = id => !!G.CLASS_BY_ID[id] && G.unlocked('class', id);
  G.btnOpen = id => G.unlocked('button', id);
  G.shrineOpen = kind => G.unlocked('shrine', kind);
  G.perkOpen = id => G.unlocked('perk', id);
  G.skinOpen = id => G.unlocked('skin', id);
  // open it (a Deed's, a recipe's: js/blessings.js the Golden Button): returns true when it was locked before
  G.unlockAdd = function (key, deed) {
    const S = G.S, u = unlState(S);
    if (key in u) return false;
    const r = S.run, i = key.indexOf(':'), kind = key.slice(0, i), id = key.slice(i + 1);
    u[key] = r && r.on ? (r.n | 0) : 0;
    emit('unlock', kind, id, deed || null);
    return true;
  };
  const unlockList = u => (!u ? [] : Array.isArray(u) ? u : [u]);
  // a lockable thing's name, in words (the summary, the toasts; the UI has its own G.UI.unlockLabel)
  G.unlockName = function (kind, id) {
    if (kind === 'button') { const b = G.BUTTON_BY_ID && G.BUTTON_BY_ID[id]; return b ? b.name : id; }
    if (kind === 'class') return (G.CLASS_BY_ID[id] || {}).name || id;
    if (kind === 'perk') return (G.PERKS[id] || {}).name || id;
    if (kind === 'land') { const i = G.REALM_BY_ID[id]; return i != null ? G.REALMS[i].name : id; }
    if (kind === 'unique' || kind === 'relic') return (G.UNIQUES[id] || {}).name || id;
    if (kind === 'shrine') return ((G.SHRINE_KINDS || {})[id] || {}).name || id;
    if (kind === 'skin') return ((G.SKINS || []).find(s => s.id === id) || {}).name || id;
    if (kind === 'system') return id === 'autorun' ? 'Auto-Run' : id === 'mods' ? 'Map mods' : id;
    return id;
  };
  const unlockObj = (key, deed) => { const i = key.indexOf(':'), kind = key.slice(0, i), id = key.slice(i + 1); return { kind, id, key, name: G.unlockName(kind, id), deed: deed ? deed.id : null }; };
  // the Deed that opens a thing (null: none does, or it is open from the start)
  G.unlockDeed = function (kind, id) {
    const k = keyOf(kind, id);
    return G.DEEDS.find(d => unlockList(d.unlock).includes(k)) || null;
  };
  // the lock's words for the setup's cards: 'Fall 3 times (1/3)'; '' when open
  G.unlockHint = function (kind, id) {
    if (G.unlocked(kind, id)) return '';
    const S = G.S, u = S.unl && S.unl[keyOf(kind, id)];
    if (u != null) return 'Opens next Siege';
    if (kind === 'button' && id === 'golden') return 'A secret recipe';
    const d = G.unlockDeed(kind, id);
    if (!d) return '';
    const p = G.deedProgress(d.id);
    return d.desc + (p && p[1] > 1 ? ' (' + fmtN(p[0]) + '/' + fmtN(p[1]) + ')' : '');
  };
  const fmtN = v => (G.fmt ? G.fmt(v) : String(Math.floor(v)));

  // ---------- Done, progress, the next unlock ----------
  G.deedDone = id => { const S = G.S; return !!((S.ach && S.ach[id]) || (S.deeds && S.deeds[id])); };
  G.deedProgress = function (id) {
    const d = G.DEED_BY_ID[id], S = G.S;
    if (!d) return null;
    if (G.deedDone(id)) { const p = d.prog ? safe(() => d.prog(S, dst(S))) : null; return [p ? p[1] : 1, p ? p[1] : 1]; }
    if (!d.prog) return null;
    return safe(() => d.prog(S, dst(S)));
  };
  const safe = f => { try { return f(); } catch (e) { return null; } };
  // the open Deeds that unlock something, nearest first (the most of their bar done): [{deed, id, name, desc, unlocks
  // [{kind, id, key, name}], have, need, frac}]
  G.nextUnlocks = function (n) {
    const out = [];
    for (const d of G.DEEDS) {
      if (!d.unlock || G.deedDone(d.id) || d.hidden) continue;
      const un = unlockList(d.unlock).filter(k => !(k in unlState(G.S)));
      if (!un.length) continue;
      const p = G.deedProgress(d.id) || [0, 1];
      out.push({ deed: d, id: d.id, name: d.name, desc: d.desc, unlocks: un.map(k => unlockObj(k, d)), have: p[0], need: p[1], frac: p[1] > 0 ? Math.min(1, p[0] / p[1]) : 0 });
    }
    // (content first: a skin-only Deed is a cosmetic, listed after what changes the next run)
    const cos = x => (x.unlocks.every(u => u.kind === 'skin') ? 1 : 0);
    out.sort((a, b) => cos(a) - cos(b) || b.frac - a.frac || a.need - b.need);
    return out.slice(0, n == null ? 3 : n);
  };

  // ---------- Checking ----------
  let capture = null;
  function complete(d, S) {
    const now = Date.now();
    if (d.ach) S.ach[d.id] = now; else (S.deeds || (S.deeds = {}))[d.id] = now;
    const un = [];
    for (const k of unlockList(d.unlock)) { if (G.unlockAdd(k, d.id)) un.push(unlockObj(k, d)); }
    const r = S.run;
    if (r && r.on) { if (!Array.isArray(r.deeds)) r.deeds = []; if (!r.deeds.includes(d.id)) r.deeds.push(d.id); }
    // (an achievement pays its +2 Gems through 'achievement' (game.js) as before; a run deed pays its unlock: DESIGN §4.9 keeps
    // the Gems' sources as they were)
    if (d.ach) emit('achievement', d);
    if (capture) capture.push({ id: d.id, un });
    emit('deed', d, un);
  }
  G.checkAchievements = function () {
    const S = G.S;
    if (!S || !S.ach) return;
    const st = dst(S);
    // (the gold held in a Siege: the Deeds' 'hold N gold' count it when they look)
    if (S.run && S.run.on && S.gold > (st.goldHeld || 0)) st.goldHeld = S.gold;
    let changed = false;
    for (const d of G.DEEDS) {
      if (d.ach ? S.ach[d.id] : S.deeds && S.deeds[d.id]) continue;
      let ok = false;
      try { ok = d.test(S, st); } catch (e) { ok = false; }
      if (ok) { complete(d, S); changed = true; }
    }
    if (changed) { G.dirty(); G.recalc(); }
  };
  G.checkDeeds = G.checkAchievements;

  // ---------- The counters: what the run deeds need that the game doesn't keep ----------
  const runOf = () => { const r = G.S && G.S.run; return r && r.on ? r : null; };
  const mtOf = r => r.mt || (r.mt = { land0: 0, pipLost: 0, evos: 0, self: 0 });
  G.on('runStart', r => { mtOf(r); r.mt.land0 = r.field || 0; const L = G.runLand ? G.runLand(0) : null; if (L) dst().lands[L.id] = 1; });
  G.on('realm', ri => { if (!runOf()) return; const L = G.REALMS[ri]; if (L) dst().lands[L.id] = 1; });
  G.on('pip', (delta, pips, why, kind) => { const r = runOf(); if (r && (kind === 'lost' || kind === 'last' || kind === 'fall')) mtOf(r).pipLost = (mtOf(r).pipLost | 0) + 1; });
  G.on('mobDie', m => { if (m && m.kind === 'spitter' && runOf()) { const st = G.S.dst || dst(); st.spit = (st.spit | 0) + 1; } });
  G.on('unitRevive', who => { if (who >= 0) { const st = dst(); st.revives = (st.revives | 0) + 1; } });
  G.on('evolve', () => { const r = runOf(); if (r) { const mt = mtOf(r); mt.evos = (mt.evos | 0) + 1; const st = dst(); st.evoRun = Math.max(st.evoRun | 0, mt.evos); } });
  G.on('key', keys => { const st = dst(); st.keys = Math.max(st.keys | 0, keys | 0); });
  G.on('relicPick', () => { const r = runOf(); if (r) { const st = dst(); st.belt = Math.max(st.belt | 0, (r.belt || []).length); } });
  G.on('rareLandEnd', () => { const r = runOf(); if (r && r.vaultOn) { const st = dst(); st.vault = (st.vault | 0) + 1; } });
  G.on('lastStandEnd', L => { if (L && runOf()) { const st = dst(); st.lastStand = (st.lastStand | 0) + 1; } });
  // a lord's fight: the companions standing as it starts
  G.on('bossStart', b => {
    if (!b || !b.lord || !runOf() || !G.partyUnits) return;
    const n = G.partyUnits().filter(u => u.who >= 0 && !(u.down > 0)).length, st = dst();
    st.warband = Math.max(st.warband | 0, n);
  });
  G.on('bossWin', (rew, b) => {
    const r = runOf(); if (!r || !b) return;
    const S = G.S, st = dst(), kind = G.bossKind ? G.bossKind(b.d) : (b.lord ? 'lord' : 'boss');
    if (kind === 'act' && b.d === (G.SIEGE ? G.SIEGE.actBoss[0] : 5)) st.act1 = (st.act1 | 0) + 1;
    if (b.lord) {
      if ((b.btnAt != null ? b.btnAt : 1) < 0.2) st.lowLord = 1;
      // the land's clock: field time since the land began (a march's start)
      const mt = mtOf(r), t = (r.field || 0) - (mt.land0 || 0);
      if (t > 0 && (!(st.fastLand > 0) || t < st.fastLand)) st.fastLand = Math.round(t);
      mt.land0 = r.field || 0;
    }
    const dNow = S.depth | 0;
    if (dNow >= 6) st.act2 = 1;
    if (dNow >= 12 && S.hero && S.hero.cls === 'archer') st.archer3 = 1;
    if (dNow >= 15) st.voidReached = 1;
    G.checkAchievements();
  });
  // the run's end: the counters that need the summary, the Deeds checked once more, then the summary's Unlocked / Next
  // (DESIGN §7.1: 'Unlocked: Storm Button, Highlands. Next: Glass Button, win once')
  G.on('runEnding', (sum, r) => {
    const S = G.S, st = dst(), mt = mtOf(r);
    st.ended = (st.ended | 0) + 1;
    if (sum.kind === 'fall' && !r.won) st.falls = Math.max(st.falls | 0, S.st.deaths | 0) + 1;
    if (sum.kind === 'win') {
      st.wins = (st.wins | 0) + 1;
      st.winBtn[sum.btn] = (st.winBtn[sum.btn] | 0) + 1;
      st.winCls[sum.cls] = (st.winCls[sum.cls] | 0) + 1;
      if (!sum.assisted) st.winHeat = Math.max(st.winHeat == null ? -1 : st.winHeat, sum.heat | 0);
      if (!(mt.pipLost > 0)) st.flawless = 1;
      if (sum.par && sum.par.onPace) st.par = 1;
      if ((sum.party || []).length >= 3) st.party3 = 1;
    }
    if (sum.kind === 'extract' && (sum.cleared | 0) >= 4 * G.REALM_SIZE) st.extract4 = 1;
    if (sum.push && sum.push.lands > 0) st.push = Math.max(st.push | 0, sum.push.lands | 0);
    if (sum.day) st.daily = (st.daily | 0) + 1;
    G.checkAchievements();
    // what this run opened (its Deeds' unlocks wait for the next run), and the nearest next unlock with its bar
    const un = [];
    for (const k in unlState(S)) if (S.unl[k] === (r.n | 0) && (r.n | 0) > 0) un.push(unlockObj(k, G.DEEDS.find(d => unlockList(d.unlock).includes(k))));
    sum.unlocked = (sum.unlocked || []).concat(un);
    sum.deeds = Array.from(new Set((sum.deeds || []).concat(r.deeds || [])));
    const nx = G.nextUnlocks(2).map(x => ({ kind: 'deed', id: x.id, name: x.name + ': ' + x.unlocks.map(u => u.name).join(', '), desc: x.desc, unlocks: x.unlocks, have: x.have, need: x.need }));
    sum.next = nx.concat(sum.next || []);
  });

  // (what the books record after 'runEnding' - S.st.siegeWins, S.ascensions, S.heatWon - can complete a Deed too: checked
  // once more at 'runSummary', its unlocks (open at once: the run is over) added to the same summary before it shows)
  G.on('runSummary', sum => {
    capture = [];
    try { G.checkAchievements(); } finally {
      const got = capture; capture = null;
      if (sum && got.length) {
        sum.unlocked = (sum.unlocked || []).concat(...got.map(x => x.un));
        sum.deeds = Array.from(new Set((sum.deeds || []).concat(got.map(x => x.id))));
      }
    }
  });

  // ---------- A loaded save (game.js deserialize -> G.metaLoad) ----------
  // Deeds done before 4.0 (a founder's achievements) or before an unlock was added open their content at once (S.unl n 0);
  // the Codex ranks follow today's Museum
  G.metaLoad = function (S) {
    S = S || G.S;
    dst(S);
    const u = S.unl || (S.unl = {});
    for (const d of G.DEEDS) {
      if (!d.unlock || !((S.ach && S.ach[d.id]) || (S.deeds && S.deeds[d.id]))) continue;
      for (const k of unlockList(d.unlock)) if (!(k in u)) u[k] = 0;
    }
    if (G.codexSync) G.codexSync();
    if (G.btnLoad) G.btnLoad(S);
  };
})(globalThis.G = globalThis.G || {});
