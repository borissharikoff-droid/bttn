// BTTN — the hero: class, level, 4 gear slots, loot rolls, enchanting,
// mobs that march on the Button, combat and the power score used by the
// ladder. DOM-free like game.js, so the simulator (and later a ladder
// server) can run the exact same code.
(function (G) {
  'use strict';
  const { chance, pick, rand, randInt, emit } = G;
  const TUNE = G.TUNE;
  Object.assign(TUNE, {
    mobBase: 10, mobGrowth: 1.6, mobAtkBase: 5, mobAtkGrowth: 1.22,
    mobWalk: 5, opFrom: 2.5, opHpPow: 0.8, kbPush: 0.045, kbEvery: 0.6, hordeRate: 0.6, hordeRef: 2.2, hordeMax: 6, hordeCap: 12, surgeEvery: 26, surgeLen: 5, surgeMul: 3,
    bossHpMobs: 400, bagMax: 30, clickVolley: 0.6, petVolley: 0.25, smiteR: 0.12, smiteReach: 0.55, addRate: 0.5,
    mobGold: 0.6, mobChest: 0.1, baseHp: 50,
    // the arena is never empty: lots of small bodies, capped for the frame rate
    mobMax: 850, packMul: 3, minCrowd: 135, spitStop: 0.68, spitEvery: 2.4, bombR: 0.16, bombPow: 1.4,
    // 3.6: the crowd. The Horde was balanced at mobRef small bodies; it now draws at most mobMax (fewer on phones and on
    // the low quality tiers), and each small one weighs (and bleeds, bites and pays) as much more as there are fewer of
    // them, so the fight is the same. The first lands start thinner and fill up: crowdFrom of the bodies at depth 0,
    // crowdPer more a depth, and in a run's first crowdRun s on those lands half again fewer (some of that weight is
    // really gone: the opening is gentler, crowdKeep of the thinning comes back as heft)
    mobRef: 1100, crowdFrom: 0.3, crowdPer: 0.08, crowdRun: 40, crowdRunFrom: 0.45, crowdRunTo: 6, crowdKeep: 0.5,
    // the party: a fallen hero gets up after reviveTime s, each tap of the Hand takes reviveTap s off;
    // a broken Button is out for btnDown s; small fry take smallHp times a normal share of health
    // (4.0: allyDmg 0.4 -> 0.55: companions are rescued at camps and should be worth one; a cleric's half of it)
    reviveTime: 24, reviveTap: 4, allyDmg: 0.55, btnDown: 12, healEvery: 1.4, healPct: 0.05, pulseEvery: 6, smallHp: 2.8,
    // chests spill out of the Horde: a chance on every kill, more from the big ones. 4.0: none (killChest 0: the Horde's
    // little chests are off; chests come from holding the Button, Hoarders, Golden Clicks...). Plunder: a rare, champion
    // or Hoarder kill drops a chest, plunder a rank
    killChest: 0, plunder: 0.2, biteFloor: 0.042,
    // 3.0: the bigger mobs (not the small fry) take this many times longer to bring down
    bigHp: 2.4,
    // 2.3: the Horde never shrinks below a full one; the first lands' extra health (see mobHp);
    // regen out of and in a boss fight (share of health a second)
    // 4.0: light attrition: regen 0.006 -> 0.002 out of boss fights, none in them
    hsMin: 1, earlyHp: 3, earlyTo: 40, regen: 0.002, regenBoss: 0,
    // 4.0: inside a Siege the Horde follows the run's schedule, not your might: hordeScale = min(hsSiegeMax, 1 +
    // hsSiegeK * depth / 17) (the Last Stand hsLast), no outgrown-depth toughening, no clear-bar boost for strength
    hsSiegeMax: 3, hsSiegeK: 2, hsLast: 4.5,
    // 4.0: the bite shelter: half bites for the first shelterSecs of each run, for the first shelterRuns runs
    shelterSecs: 60, shelterRuns: 3, levelHeal: 0.05,
    // 2.5: the new kinds: a pack's chance to be led by one (base + per depth, capped); Warded takes this share
    // of the Hand's damage; menders heal this share of health round them every few seconds; callers call
    // callN small fry every callEvery s; chargers run chargeSpd times faster for the last stretch
    // 3.0: with a companion along, the tank holds mobs at tankP within tankArc of its angle (tankHold at most,
    // fewer in a small party) and they swing at it every tankBiteEvery s; it walks tankWalk a second
    tankP: 0.68, tankArc: 0.09, tankHold: 30, tankWalk: 0.35, tankBiteEvery: 2,
    newKindBase: 0.12, newKindPer: 0.007, newKindMax: 0.38, wardedTake: 0.08, healerEvery: 2.2, healerPct: 0.12, callEvery: 3.2, callN: 7, chargeSpd: 4,
    // 3.6: level-up cards: never in a boss fight or a march; past the first perkEarly s of play, one set every perkGap s
    // at most; a set left alone is picked for you after perkAuto s (outside a Siege only: 4.0 deletes the perk bank)
    // 4.0 (DESIGN §5.1): inside a Siege only the warm-up levels (cardLevels) bring a card; the rest come one after every
    // boss (js/run.js). Gear ranks (§5.2): a perk's rank is the picked ranks plus the party's gear's, at most max +
    // gearPerkOver; an evolution needs evoOwn picked ranks besides
    perkGap: 25, perkEarly: 180, perkAuto: 12, cardLevels: [2, 3, 4], gearPerkOver: 2, evoOwn: 2,
    // 3.6: a wipe ends the run only once this run has reached this depth (the end of its first land)
    // (4.0: Integrity decides: land 1 is the muster, then a hit at 0 pips is the fall; see js/run.js G.pipHit)
    fallFrom: 3,
    // 3.6: a fallen run continued where it fell: Gems for the first (contCost; free the very first time), doubling
    // each time in a run, contMax a run. Gems from play: an achievement, a land star, a relic, a daily gift (three
    // times on a streak's 7th day), a lord's first fall
    // 4.0: one Continue a run, 30 Gems (the very first one ever free)
    contCost: 30, contMax: 1, gemAch: 2, gemStar: 1, gemRelic: 5, gemDaily: 5, gemLord: 5,
  });

  // ---------- Content ----------
  G.SLOTS = ['weapon', 'ability', 'armor', 'ring'];
  G.RMUL = [1, 1.35, 1.8, 2.4, 3.2, 4.3, 5.8];
  // Item id -> sprite template type (weapon style, ability, armour or ring)
  G.ITEM_TYPE = {
    rusty_dagger: 'dagger', twig_staff: 'wand', short_bow: 'bow', leather_vest: 'armor', copper_ring: 'ring', old_boot: 'boot',
    steel_sword: 'sword', oak_wand: 'wand', hunter_bow: 'bow', chainmail: 'armor', emerald_ring: 'ring', hp_potion: 'potion',
    sapphire_blade: 'sword', frost_staff: 'staff', crystal_dagger: 'dagger', knight_shield: 'shield', mana_tome: 'tome', sapphire_amulet: 'amulet',
    shadow_katana: 'katana', necro_skull: 'skull', arcane_orb: 'orb', demon_helm: 'helm', void_cloak: 'cloak', amethyst_tiara: 'crown',
    dragon_sword: 'sword', phoenix_bow: 'bow', sun_staff: 'staff', golden_plate: 'armor', titan_ring: 'ring', ancient_scroll: 'scroll',
    blood_scythe: 'scythe', star_codex: 'tome', chaos_wand: 'wand', moon_orb: 'orb', realm_heart: 'heart', king_crown: 'crown',
    eternity_blade: 'sword', celestial_staff: 'staff', halo: 'halo', seraph_wing: 'wing', cosmic_egg: 'egg', golden_button: 'button',
  };
  const SLOT_OF_TYPE = {
    dagger: 'weapon', sword: 'weapon', katana: 'weapon', scythe: 'weapon', bow: 'weapon', staff: 'weapon', wand: 'weapon',
    potion: 'ability', tome: 'ability', scroll: 'ability', skull: 'ability', orb: 'ability', wing: 'ability', egg: 'ability',
    armor: 'armor', boot: 'armor', shield: 'armor', helm: 'armor', cloak: 'armor',
    ring: 'ring', amulet: 'ring', crown: 'ring', heart: 'ring', halo: 'ring', button: 'ring',
  };
  G.slotOf = id => SLOT_OF_TYPE[G.ITEM_TYPE[id]];
  // rate = attacks/s, mult = damage per attack, targets = mobs hit per attack.
  // In arena units (the spawn ring is radius 1): reach = how far from the
  // Button the hero can hit, aoe/sp = splash radius around each target and
  // the share of damage it deals. They shape horde clearing, not ladder power.
  G.WEAPONS = {
    dagger: { rate: 3.2, mult: 0.42, targets: 1, reach: 0.42, aoe: 0.08, sp: 0.6, col: '#e6ebf2', name: 'Dagger' },
    sword:  { rate: 1.6, mult: 0.85, targets: 2, reach: 0.45, aoe: 0.16, sp: 1, col: '#ffffff', name: 'Sword' },
    katana: { rate: 2.2, mult: 0.65, targets: 1, reach: 0.45, aoe: 0.12, sp: 0.8, col: '#d4b0ff', name: 'Katana' },
    scythe: { rate: 1.1, mult: 1.0, targets: 4, reach: 0.5, aoe: 0.2, sp: 1, col: '#ff4f7e', name: 'Scythe' },
    bow:    { rate: 1.3, mult: 0.95, targets: 3, reach: 0.9, aoe: 0.09, sp: 0.8, col: '#9be15d', name: 'Bow' },
    staff:  { rate: 1.4, mult: 1.0, targets: 2, reach: 0.75, aoe: 0.19, sp: 0.7, col: '#5ab4ff', name: 'Staff' },
    wand:   { rate: 2.6, mult: 0.5, targets: 1, reach: 0.75, aoe: 0.12, sp: 0.7, col: '#ffe27a', name: 'Wand' },
  };
  const ARMOR_MUL = { armor: 1, boot: 0.7, shield: 1.2, helm: 0.9, cloak: 0.85 };
  G.ABILITIES = {
    potion: { cd: 18, name: 'Heal', desc: 'Repairs 60%' },
    tome:   { cd: 24, name: 'Blessing', desc: 'Repairs 30%, ×1.5 damage for 6s' },
    scroll: { cd: 40, name: 'Greed', desc: '×3 chest drops for 12s' },
    skull:  { cd: 16, name: 'Skull Blast', desc: '8 hits on every enemy' },
    orb:    { cd: 24, name: 'Stasis', desc: 'Slows mobs, +30% damage for 6s' },
    wing:   { cd: 30, name: 'Wings', desc: 'Attack speed ×2 for 8s' },
    egg:    { cd: 30, name: 'Starfall', desc: '15 hits on target, 4 on all' },
  };
  G.CLASSES = [
    { id: 'knight', spr: 'h_knight', weapons: ['sword', 'katana', 'scythe'], starter: 'steel_sword', hp: 1.3, crit: 0, extra: 0,
      name: 'Knight', desc: 'Swords, katanas, scythes. Tank: draws bites, +30% toughness.',
      descAlly: 'Swords, katanas, scythes. Tank: draws bites, takes 30% less.' },
    { id: 'archer', spr: 'h_archer', weapons: ['bow'], starter: 'short_bow', hp: 1, crit: 0, extra: 1,
      name: 'Archer', desc: 'Bows. Arrows pierce 1 more.' },
    { id: 'wizard', spr: 'h_wizard', weapons: ['staff', 'wand'], starter: 'twig_staff', hp: 1, crit: 0, extra: 0, spd: 0.15,
      name: 'Wizard', desc: 'Staves, wands. +15% attack speed.' },
    { id: 'rogue', spr: 'h_rogue', weapons: ['dagger'], starter: 'rusty_dagger', hp: 1, crit: 0.1, extra: 0,
      name: 'Rogue', desc: 'Daggers. +10% crit chance.' },
    { id: 'cleric', spr: 'h_priest', weapons: ['staff', 'wand'], starter: 'oak_wand', hp: 1.1, crit: 0, extra: 0,
      name: 'Cleric', desc: 'Staves, wands. Heals all; while alive, revives are 3× faster.',
      descAlly: 'Staves, wands. Heals all; while alive, revives are 3× faster. Weak hits.' },
  ];
  // What each class does in the party: tanks draw the bites, healers mend, the rest deal damage
  G.ROLES = { knight: 'tank', cleric: 'heal', archer: 'dps', wizard: 'dps', rogue: 'dps' };
  G.ROLE_NAMES = { tank: 'Tank', heal: 'Healer', dps: 'Damage' };
  G.CLASS_BY_ID = {}; G.CLASSES.forEach(c => G.CLASS_BY_ID[c.id] = c);
  G.AFFIXES = {
    dmg:   { v: [0.04, 0.10], name: 'Damage' },
    spd:   { v: [0.03, 0.08], name: 'Attack speed' },
    crit:  { v: [0.01, 0.03], name: 'Crit chance' },
    critd: { v: [0.10, 0.30], name: 'Crit power', x: true },
    hp:    { v: [0.05, 0.12], name: 'Button toughness' },
    gold:  { v: [0.04, 0.12], name: 'Gold' },
    luck:  { v: [0.02, 0.06], name: 'Luck' },
    xp:    { v: [0.05, 0.15], name: 'Experience' },
    shard: { v: [0.05, 0.15], name: 'Shards' },
  };
  const AFFIX_COUNT = [0, 1, 1, 2, 2, 3, 3];
  const SALVAGE = [1, 2, 4, 8, 16, 32, 64];
  G.ENCHANT_MAX = 20;

  // Currency, Path of Exile style: orbs drop from the Horde and change gear.
  // They stack and, like the gear, stay through ascension.
  G.ORBS = {
    whet:   { w: 30, col: '#b8c8e0', name: 'Whetstone',     desc: 'Free +1 enchant' },
    flux:   { w: 32, col: '#ffd84a', name: 'Orb of Flux',   desc: 'Rerolls all affixes' },
    ruin:   { w: 12, col: '#ff5a4a', name: 'Orb of Ruin',   desc: 'Corrupts: +3 item level, +1 affix or nothing. Then only Whetstones work' },
    ascent: { w: 10, col: '#ffe0a0', name: 'Orb of Ascent', desc: '+1 affix, up to usual max +1' },
    grace:  { w: 2,  col: '#ffffff', name: 'Orb of Grace',  desc: 'May raise each affix value' },
  };
  G.ORB_IDS = Object.keys(G.ORBS);

  // Uniques: named items with fixed affixes and one rule of their own. They
  // drop from rares, Hoarders, lords and Rift Guardians, the deeper ones only
  // from minD on. Their affixes count for ladder power, the rule only in fights.
  G.UNIQUE_COL = '#e8903a';
  G.UNIQUES = {
    pincer:     { base: 'emerald_ring',   minD: 0,  name: 'The Crab King\u2019s Pincer', a: [['dmg', 0.25], ['crit', 0.05]], fx: 'Crit kills explode' },
    goldgrin:   { base: 'amethyst_tiara', minD: 0,  name: 'Goldgrin',              a: [['gold', 0.6], ['luck', 0.3]], fx: '+40% loot drops' },
    windripper: { base: 'hunter_bow',     minD: 7,  name: 'Windripper',            a: [['dmg', 0.35], ['crit', 0.05]], fx: 'Arrows fork: +2 targets' },
    cleaver:    { base: 'steel_sword',    minD: 9,  name: 'Warchief\u2019s Cleaver', a: [['dmg', 0.5], ['hp', 0.25]], fx: 'Every 5th attack crits with 2× splash' },
    sporeheart: { base: 'realm_heart',    minD: 12, name: 'Sporeheart',            a: [['hp', 0.45], ['xp', 0.3]], fx: 'Kills repair the Button a little' },
    stormcaller:{ base: 'frost_staff',    minD: 14, name: 'Stormcaller',           a: [['dmg', 0.4], ['spd', 0.15]], fx: 'Attacks call a bolt on another mob' },
    nightfang:  { base: 'crystal_dagger', minD: 17, name: 'Nightfang',             a: [['dmg', 0.35], ['spd', 0.25]], fx: 'Crits deal 2× damage' },
    headhunter: { base: 'titan_ring',     minD: 19, name: 'Headhunter',            a: [['dmg', 0.3], ['luck', 0.15]], fx: 'Rare kills: +60% damage and attack speed for 20s' },
    frostwalk:  { base: 'old_boot',       minD: 22, name: 'Frostwalkers',          a: [['hp', 0.6], ['spd', 0.12]], fx: 'Horde moves 35% slower' },
    watcher:    { base: 'arcane_orb',     minD: 27, name: 'Eye of the Watcher',    a: [['crit', 0.08], ['critd', 0.8]], fx: 'Abilities recharge 2× faster' },
    hellstring: { base: 'phoenix_bow',    minD: 31, name: 'Hellstring',            a: [['dmg', 0.6], ['spd', 0.2]], fx: 'Kills explode' },
    voidplate:  { base: 'golden_plate',   minD: 34, name: 'Voidplate',             a: [['hp', 1.2], ['dmg', 0.2]], fx: 'Biting mobs take 10 hits back' },
    reaper:     { base: 'blood_scythe',   minD: 37, name: 'Reaper\u2019s Due',     a: [['dmg', 0.8], ['critd', 0.6]], fx: 'Kills: +2% attack speed for 6s, max +80%' },
    lastbutton: { base: 'golden_button',  minD: 8 * G.REALM_SIZE - 1, boss: true, name: 'The Last Button', a: [['dmg', 0.5], ['gold', 0.5], ['luck', 0.3], ['xp', 0.3]], fx: 'Clicks strike twice. Mad Button and deep Rifts only' },
    // past the Button
    codex:      { base: 'star_codex',     minD: 44, name: 'The Drowned Codex',     a: [['xp', 0.4], ['dmg', 0.45]], fx: 'Spitters and bombers die to any hit' },
    tyrant:     { base: 'king_crown',     minD: 49, name: 'Crown of the Gear Tyrant', a: [['spd', 0.3], ['dmg', 0.5]], fx: 'Tanks, brutes, champions take 2× damage' },
    ashbringer: { base: 'dragon_sword',   minD: 54, name: 'Ashbringer',            a: [['dmg', 1], ['critd', 0.6]], fx: 'Warden kills explode in flame' },
    othercloak: { base: 'void_cloak',     minD: 59, name: 'The Other Cloak',       a: [['hp', 1.1], ['crit', 0.08]], fx: '1 bite in 3 kills the biter instead' },
    firsthand:  { base: 'celestial_staff', minD: 13 * G.REALM_SIZE - 1, boss: true, name: 'Palm of the First Hand', a: [['dmg', 1.1], ['spd', 0.3], ['gold', 0.4]], fx: 'Clicks call 3 more bolts. First Hand and deep Rifts only' },
  };
  G.UNIQUE_IDS = Object.keys(G.UNIQUES);
  // Rift level -> the depth its Horde fights at: Rift N fights like depth N
  G.riftDepth = L => Math.max(0, (L | 0) - 1);

  // Level-up perks, Vampire Survivors style: each level the Warden picks one
  // of three. They build this run's Warden and reset on ascension (gear stays).
  // 3.0: hooks other files (perks, casino, relics) plug into. Each list holds plain functions:
  //   hit(m, dmg, src, crit) -> new dmg | undefined   every hit on a mob, before it lands
  //   kill(m, src)                                    after a mob dies
  //   bite(m, who, dmg) -> new dmg | undefined        a mob's bite on the Button or a party member
  //   tick(dt)                                        every game tick (not in town)
  //   stats(d)                                        end of recalc: change d.heroHit, d.heroRate, d.heroDps, d.heroHp...
  //   click()                                         a manual click that landed
  G.HOOKS = G.HOOKS || { hit: [], kill: [], bite: [], tick: [], stats: [], click: [] };
  G.hook = (name, fn) => { (G.HOOKS[name] = G.HOOKS[name] || []).push(fn); };
  // the tutorial's Horde bites at half strength, so the first boss is reached while learning. 4.0: and the first minute
  // of each of a player's first three runs (the 180 s of lifetime play it was), in the playtests too
  G.hook('bite', (m, who, bd) => {
    const S = G.S;
    if (!S) return null;
    if (G.UI && S.tut >= 0) return bd * 0.5;
    const r = S.run;
    return r && r.on && (r.n | 0) <= TUNE.shelterRuns && (r.field || 0) < TUNE.shelterSecs ? bd * 0.5 : null;
  });
  G.PERKS = {
    might:   { max: 5, icon: 'ic_sword', name: 'Might', desc: '+12% damage, bosses too' },
    frenzy:  { max: 5, icon: 'ic_clock', name: 'Frenzy', desc: '+12% attack speed' },
    plunder: { max: 3, icon: 'pk_plunder', name: 'Plunder', desc: 'Kills open a chest: 0.2% per level' },
    multi:   { max: 3, icon: 'it_short_bow', name: 'Multistrike', desc: '+1 target per attack' },
    cleave:  { max: 4, icon: 'it_blood_scythe', name: 'Cleave', desc: '+30% splash radius' },
    reach:   { max: 3, icon: 'it_hunter_bow', name: 'Long Reach', desc: '+20% attack range' },
    blades:  { max: 5, icon: 'it_steel_sword', name: 'Orbiting Blades', desc: '+1 blade circling the Button' },
    aura:    { max: 5, icon: 'ic_star', name: 'Holy Ground', desc: 'Burns nearby mobs, more per level' },
    chain:   { max: 4, icon: 'ic_bolt', name: 'Chain Lightning', desc: '+15% chance attacks arc to 3 mobs' },
    nova:    { max: 4, icon: 'it_arcane_orb', name: 'Nova', desc: 'Button blast, more often per level; hits bosses' },
    thunder: { max: 3, icon: 'ic_finger', name: 'Heavy Hand', desc: '+1 bolt per click' },
    bulwark: { max: 5, icon: 'it_knight_shield', name: 'Bulwark', desc: '+20% Button toughness' },
    leech:   { max: 3, icon: 'ic_heart', name: 'Leech', desc: 'Kills repair the Button a little' },
    greed:   { max: 5, icon: 'ic_coin', name: 'Greed', desc: '+20% Horde gold' },
    loot:    { max: 3, icon: 'ic_bag', name: 'Scavenger', desc: '+25% loot bag drops' },
  };
  // 4.0: a perk's rank = the ranks picked (h.perks) + the ranks the party's gear carries (D.gearPerk, built in heroFinish:
  // mythic and divine items, uniques' themes), at most its max + TUNE.gearPerkOver (DESIGN §5.2). G.perkOwn: the picked
  // ranks alone (what the cards' slots and the evolutions count)
  const perkOwn = id => (G.S.hero && G.S.hero.perks && G.S.hero.perks[id]) || 0;
  const perk = id => {
    const o = perkOwn(id), gp = G.D.gearPerk;
    if (!gp || !gp[id]) return o;
    const P = G.PERKS[id];
    return Math.min((P ? P.max : o) + TUNE.gearPerkOver, o + gp[id]);
  };
  G.perkOwn = perkOwn;
  // a sudden event's pull on the arena (js/events.js); neutral without it
  const evMul = k => (G.evMul ? G.evMul(k) : 1);
  // Today's omen (js/journey.js); neutral where that file isn't loaded, e.g. on the ladder server
  const NO_OMEN = { xp: 1, mobHp: 1, gold: 1, horde: 1, champ: 1, loot: 1, thunder: 0, luck: 0 };
  const om = () => (G.omen ? G.omen() : NO_OMEN);
  G.perk = perk;

  // Evolutions, Vampire Survivors style: a perk at its top rank plus the right
  // gear worn turns the next level-up into a golden card. Discoveries are kept
  // forever and fill a recipe book in the Collection.
  G.EVOS = {
    bladestorm: { from: 'blades', slot: 'weapon', types: ['sword', 'katana', 'dagger'], need: 'a blade', icon: 'it_eternity_blade', name: 'Blade Storm', desc: '2× blades, wider and deadlier' },
    sanctuary:  { from: 'aura', slot: 'ring', types: ['halo', 'crown'], need: 'a halo or crown', icon: 'it_halo', name: 'Sanctuary', desc: 'Holy Ground ×2, wider, repairs the Button' },
    supernova:  { from: 'nova', slot: 'ability', types: ['orb', 'egg'], need: 'an orb or cosmic egg', icon: 'it_moon_orb', name: 'Supernova', desc: 'Bigger, stronger Nova every 3s' },
    storm:      { from: 'chain', slot: 'weapon', types: ['wand', 'staff'], need: 'a wand or staff', icon: 'it_chaos_wand', name: 'Thunderstorm', desc: 'Attacks always chain to 5' },
    rain:       { from: 'multi', slot: 'weapon', types: ['bow'], need: 'a bow', icon: 'it_phoenix_bow', name: 'Arrow Rain', desc: '+3 targets, +50% splash' },
    wrath:      { from: 'thunder', slot: 'ability', types: ['tome', 'scroll'], need: 'a tome or scroll', icon: 'it_star_codex', name: 'Wrath of the Hand', desc: '+3 bolts per click' },
    bloodpact:  { from: 'leech', slot: 'ring', types: ['heart', 'amulet'], need: 'a heart or amulet', icon: 'it_realm_heart', name: 'Blood Pact', desc: 'Kills repair 4× more, +25% damage' },
    midas:      { from: 'greed', slot: 'ring', types: ['button', 'ring'], need: 'a ring', icon: 'it_golden_button', name: 'Midas Touch', desc: 'Horde gold ×2, +50% loot bags' },
    berserk:    { from: 'frenzy', slot: 'armor', types: ['helm'], need: 'a helm', icon: 'it_demon_helm', name: 'Berserk', desc: '+50% attack speed' },
    titan:      { from: 'might', slot: 'armor', types: ['armor'], need: 'body armour', icon: 'it_golden_plate', name: 'Titan', desc: '+50% damage' },
    bastion:    { from: 'bulwark', slot: 'armor', types: ['shield'], need: 'a shield', icon: 'it_knight_shield', name: 'Bastion', desc: 'Toughness ×2, bites deal 30% less' },
  };
  const evo = id => perk('evo_' + id);
  G.evo = evo;
  // Evolutions the Warden qualifies for right now
  function evoReady() {
    const h = G.S.hero;
    return Object.keys(G.EVOS).filter(id => {
      const e = G.EVOS[id], g = h.eq[e.slot];
      // (4.0: the rank with gear counts toward max, but at least evoOwn of it must be picked)
      return !evo(id) && perk(e.from) >= G.PERKS[e.from].max && perkOwn(e.from) >= Math.min(TUNE.evoOwn, G.PERKS[e.from].max) && g && e.types.includes(G.ITEM_TYPE[g.id]);
    });
  }
  G.evoReady = evoReady;
  G.bladeCount = () => perk('blades') * (evo('bladestorm') ? 2 : 1);

  // ---------- State ----------
  function newHero() {
    return { cls: null, lvl: 1, xp: 0, eq: { weapon: null, ability: null, armor: null, ring: null }, bag: [], gu: 0,
      // (4.0: salv 2: commons and uncommons turn into shards when they're picked up)
      shards: 0, hp: TUNE.baseHp, auto: 1, salv: 2, cast: 1, kills: 0, elites: 0, fresh: 0,
      // (4.0: auto-pick is off by default: a card waits for the player, the field paused; DESIGN §5.1)
      perks: {}, perkPts: 0, offer: null, offerT: 0, autoPerk: 0, orbs: {}, whp: TUNE.baseHp, wdown: 0 };
  }
  G.newHero = newHero;
  function ensureHero(S) {
    S.hero = Object.assign(newHero(), S.hero || {});
    S.hero.eq = Object.assign({ weapon: null, ability: null, armor: null, ring: null }, S.hero.eq || {});
    if (!Array.isArray(S.hero.bag)) S.hero.bag = [];
    S.hero.orbs = Object.assign({ whet: 0, flux: 0, ruin: 0, ascent: 0, grace: 0 }, S.hero.orbs || {});
    if (!S.profile) S.profile = { id: Math.random().toString(36).slice(2, 10), name: '' };
    S.rec = Object.assign({ maxPower: 0, maxLevel: 1, madTime: 0, runStart: Date.now() }, S.rec || {});
    S.rec.evos = S.rec.evos || {};
    // companions: up to three more heroes with their own gear
    S.party = (Array.isArray(S.party) ? S.party : []).filter(m => m && G.CLASS_BY_ID[m.cls]).slice(0, 3)
      .map(m => Object.assign({ hp: TUNE.baseHp, down: 0, acc: 0 }, m, { eq: Object.assign({ weapon: null, ability: null, armor: null, ring: null }, m.eq || {}) }));
  }
  G.ensureHero = ensureHero;

  // ---------- The party ----------
  // The Warden leads; companions join as you go deeper. 4.0: every run starts alone: a seat opens at this run's
  // depths 3, 6 and 9 (camps 1-3), read against the run (S.maxDepth), not the lifetime best
  G.PARTY_AT = [3, 6, 9];
  // (the Tavern V companion takes a seat from the start: D.startAlly)
  G.partySlots = () => Math.min(3, G.PARTY_AT.filter(d => (G.S.maxDepth || 0) >= d).length + (G.D.startAlly ? 1 : 0));
  // an item for a slot at rarity r or the best below it that exists, a weapon of the class's kinds (the recruits' gear)
  function gearFor(slot, r, cls, il) {
    const C = G.CLASS_BY_ID[cls];
    for (let x = Math.min(6, Math.max(0, r)); x >= 0; x--) {
      const list = (G.ITEMS_BY_RARITY[x] || []).filter(it => G.slotOf(it.id) === slot && (slot !== 'weapon' || !C || C.weapons.includes(G.ITEM_TYPE[it.id])));
      if (list.length) return makeGear(list[G.weighted(list.map(i => i.w))].id, il);
    }
    return null;
  }
  G.gearFor = gearFor;
  // 4.0: a companion is a class plus a trait (G.TRAITS: the camp's candidates; none from the 3.x Tavern). Inside a Siege
  // it arrives with its class weapon at the current item level and the rarity cap (Tavern II: body armour too)
  G.recruit = function (cls, trait) {
    const S = G.S, C = G.CLASS_BY_ID[cls];
    if (!C || S.party.length >= G.partySlots()) return false;
    const m = { cls, eq: { weapon: null, ability: null, armor: null, ring: null }, hp: TUNE.baseHp, down: 0, acc: 0 };
    if (trait && G.TRAITS && G.TRAITS[trait]) m.trait = trait;
    if (siegeOn()) {
      const il = Math.max(0, S.depth), cap = G.rarityCap();
      m.eq.weapon = gearFor('weapon', cap, cls, il) || makeGear(C.starter, il);
      if (G.D.recruitArmor) m.eq.armor = gearFor('armor', cap, cls, il);
    } else m.eq.weapon = makeGear(C.starter, Math.max(0, G.S.depth - 1));
    S.party.push(m);
    G.dirty(); G.recalc();
    m.hp = (G.D.party[S.party.length - 1] || {}).hp || TUNE.baseHp;
    emit('recruit', m, S.party.length - 1);
    return true;
  };
  // Everyone on the field, the Warden first: {who: -1 for the Warden or the companion's index, cls, role, hp, max, down}
  G.partyUnits = function () {
    const S = G.S, h = S.hero, D = G.D, out = [];
    if (!h || !h.cls) return out;
    out.push({ who: -1, cls: h.cls, eq: h.eq, role: G.ROLES[h.cls], hp: h.whp, max: D.wardenHp || TUNE.baseHp, down: h.wdown });
    S.party.forEach((m, i) => out.push({ who: i, cls: m.cls, eq: m.eq, role: G.ROLES[m.cls], hp: m.hp, max: (D.party && D.party[i] ? D.party[i].hp : TUNE.baseHp), down: m.down }));
    return out;
  };
  const unitGet = who => (who < 0 ? G.S.hero : G.S.party[who]);
  const unitHp = (who, v) => { const u = unitGet(who); if (!u) return 0; if (v !== undefined) { if (who < 0) u.whp = v; else u.hp = v; } return who < 0 ? u.whp : u.hp; };
  const unitDown = (who, v) => { const u = unitGet(who); if (!u) return 0; if (v !== undefined) { if (who < 0) u.wdown = v; else u.down = v; } return who < 0 ? u.wdown : u.down; };
  const unitMax = who => (who < 0 ? G.D.wardenHp : (G.D.party[who] || {}).hp) || TUNE.baseHp;
  const alive = () => G.partyUnits().filter(u => !(u.down > 0));
  G.partyAlive = () => alive().length;
  // 3.0: the tank holds the line. It walks round to where the Horde presses hardest (R.tankA, the same
  // 0-1 angle mobs use) and the mobs that meet it there stop and fight it instead of reaching the Button.
  const tankUp = () => alive().find(u => u.role === 'tank');
  G.tankInfo = () => { const t = tankUp(); return t ? { who: t.who, a: R.tankA == null ? 0.5 : R.tankA } : null; };
  function stepTank(dt) {
    if (R.tankA == null) R.tankA = 0.5;
    if ((R.tankT = (R.tankT || 0) - dt) <= 0) {
      R.tankT = 1.2;
      const B = new Array(12).fill(0);
      for (const m of R.mobs) if (!m.dead && m.p > 0.4 && !m.add) B[Math.min(11, Math.floor(m.a * 12))] += m.w * m.p;
      let bi = -1, bv = 0; for (let i = 0; i < 12; i++) if (B[i] > bv) { bv = B[i]; bi = i; }
      if (bi >= 0) R.tankGo = (bi + 0.5) / 12;
    }
    if (R.tankGo != null) { const d = R.tankGo - R.tankA; R.tankA += Math.sign(d) * Math.min(Math.abs(d), TUNE.tankWalk * dt); }
  }
  // Who a mob or a boss hits: a standing tank draws it, else the Button or anyone standing
  // who a bite lands on: a standing tank draws most of them, the Button takes most of the rest
  function victim() {
    const up = alive(), btn = !(R.btnDown > 0);
    const tank = up.find(u => u.role === 'tank');
    if (tank && chance(btn ? 0.4 : 0.85)) return tank.who;
    if (!up.length) return btn ? 'button' : null;
    if (btn && chance(0.65)) return 'button';
    return up[Math.floor(G.rng() * up.length)].who;
  }
  function hurtUnit(who, dmg, src) {
    if (unitDown(who) > 0) return;
    if (R.ward > 0) { emit('warded', who); return; }
    const role = G.ROLES[who < 0 ? G.S.hero.cls : G.S.party[who].cls];
    if (role === 'tank') dmg *= 0.7;
    const hp = unitHp(who, unitHp(who) - dmg);
    emit('unitHurt', who, dmg, src);
    if (hp <= 0) {
      unitHp(who, 0);
      unitDown(who, TUNE.reviveTime);
      emit('unitDown', who);
      checkWipe();
    }
  }
  // the fight goes to the victim: a party member or the Button
  function hitParty(v, dmg, src) {
    // the Hand's Ward: nothing gets through for a moment
    if (R.ward > 0 && v != null) { emit('warded', v); return; }
    if (v === 'button') hurtButton(dmg); else if (v != null) hurtUnit(v, dmg, src); else checkWipe();
  }
  G.hurtParty = hitParty;
  // a boss's blow: its depth's damage, or a share of what it hits, whichever is more
  G.blowParty = function (v, dmg, pct, src) {
    if (v == null) return hitParty(v, dmg, src);
    const max = v === 'button' ? G.D.heroHp : unitMax(v);
    hitParty(v, Math.max(dmg, (max || 0) * pct), src);
  };
  // 4.0: heal the Button and everyone standing by a share of their health (a boss kill +10%, a lord +25%); the fallen stay down
  G.healParty = function (frac) {
    const h = G.S.hero, D = G.D;
    if (!h || !h.cls) return;
    if (!(R.btnDown > 0)) h.hp = Math.min(D.heroHp, h.hp + D.heroHp * frac);
    for (const u of G.partyUnits()) if (!(u.down > 0)) unitHp(u.who, Math.min(unitMax(u.who), unitHp(u.who) + unitMax(u.who) * frac));
  };
  // Mend: heal everyone standing and lift the fallen
  G.mendParty = function (frac) {
    for (const u of G.partyUnits()) {
      if (u.down > 0) reviveUnit(u.who, frac);
      else unitHp(u.who, Math.min(unitMax(u.who), unitHp(u.who) + unitMax(u.who) * frac));
    }
  };
  G.victim = victim;
  // the fallen get up three times faster while a healer stands
  G.reviveRate = () => (G.partyUnits().some(u => u.role === 'heal' && !(u.down > 0)) ? 3 : 1);
  G.dealHit = (m, dmg, src, crit) => dealHit(m, dmg, src, crit);
  function reviveUnit(who, frac) {
    unitDown(who, 0); unitHp(who, unitMax(who) * (frac || 0.4));
    emit('unitRevive', who);
  }
  // The Hand can lift a fallen hero: each tap takes 4 seconds off the wait
  G.reviveTap = function (who) {
    if (!(unitDown(who) > 0)) return false;
    // four seconds off the wait as it's shown, a healer or not
    const left = unitDown(who, unitDown(who) - TUNE.reviveTap * G.reviveRate());
    emit('reviveTap', who, left);
    if (left <= 0) reviveUnit(who, 0.5);
    return true;
  };
  // Everyone down and the Button broken: the Horde breaks through
  function checkWipe() {
    if (R.btnDown > 0 && !alive().length) wipe();
  }
  function wipe() {
    const S = G.S, h = S.hero;
    S.st.wipes = (S.st.wipes || 0) + 1;
    const hadBoss = !!R.boss, meter0 = hadBoss ? G.D.bossNeed : S.bossMeter || 0;
    // 4.0: inside a Siege a wipe is a hit on the Integrity (js/run.js G.pipHit): land 1 is the muster (no pip lost),
    // then a pip; a hit at 0 pips is the FALL (decided up front, so the stage knows whether to play the BOOM)
    const siege = !R.rift && !!(G.inSiege && G.inSiege()), from = S.depth;
    const fallNow = siege && !!(G.pipFalls && G.pipFalls(from));
    // (marked dead too: the tick's loop over a copy of the Horde skips them)
    for (const m of R.mobs) { m.dead = true; emit('mobFlee', m); }
    R.mobs.length = 0; if (R.shots) R.shots.length = 0;
    // (a lord fight lost to a wipe costs the wipe's pip only)
    R.wiping = true;
    if (R.boss) G.fleeBoss();
    R.wiping = false;
    if (R.inv && G.endInvasion) G.endInvasion(false);
    if (R.ev && R.ev.k !== 'jackpot' && G.endEvent) G.endEvent(false);
    const inRift = !!R.rift;
    if (R.rift && G.riftEnd) G.riftEnd(false, 'broke');
    // pushed back: the clear bar is lost and, past the first depth, a depth with it
    // (3.6: the zone's clock runs on: a party that falls now and then still gets its boss once the bar is back)
    // (4.0, a Siege: back to the zone before, never out of this land (its lord is never fought twice), the zone's clock
    // from zero; a fall stays where it fell, for a Continue)
    if (siege) {
      S.bossMeter = 0; R.bossReady = false; R.zoneT = 0;
      if (!fallNow) S.depth = Math.max(from - (from % G.REALM_SIZE), from - 1);
    } else if (!inRift) { S.bossMeter = 0; if (hadBoss && S.depth > 0) S.depth--; R.bossReady = false; }
    if (R.ground) R.ground.length = 0;
    R.btnDown = 0;
    // (4.0: with pips left the Button comes back at half and everyone gets up at half: no free full heal)
    const back = siege ? 0.5 : 1;
    h.hp = G.D.heroHp * back;
    for (const u of G.partyUnits()) reviveUnit(u.who, back);
    R.stun = 4; // the party regroups
    R.bossHold = 25; // and no boss comes on its own for a while
    G.dirty(); G.recalc();
    if (siege) h.hp = Math.min(h.hp, G.D.heroHp * back);
    // 3.1: past the first minutes the Button's fall ends the run (fame, then a new run from the checkpoint)
    // (3.6: not in a run's first land: a party still learning to hold depth 1 is pushed back, not sent to a new run
    // every minute or two, each time with a blessing to pick)
    // (4.0: outside a Siege only; the 150 s of lifetime play gate is gone)
    const fell = siege ? fallNow : !inRift && G.runOver && !(S.tut >= 0) && (S.maxDepth || 0) >= TUNE.fallFrom;
    R.fell = fell;
    emit('wipe', from, S.depth, inRift, hadBoss);
    // (3.6: where it fell, for a continue: the zone and the boss bar as they were)
    if (siege && G.pipHit) G.pipHit('wipe', { depth: from, meter: meter0, boss: hadBoss });
    else if (fell) G.runOver({ depth: from, meter: meter0 });
    R.fell = false;
  }
  G.wipe = wipe;

  const R = G.R;
  ensureHero(G.S);
  Object.assign(R, { mobs: [], shots: [], mobUid: 0, hordeAcc: 0, surgeT: 20, surge: 0, heroAcc: 0, abilCd: 0, hb: {}, stun: 0, bossAtkT: 2, rift: null, reap: 0, reapT: 0, swing: 0, carn: 0, carnT: 0 });
  // The depth the Horde fights at: the campaign's, or the open Rift's
  const dnow = () => (R.rift ? R.rift.d : G.S.depth);
  G.depthNow = dnow;
  // Is this unique worn? (filled in by recalc)
  const uq = id => !!(G.D.uq && G.D.uq[id]);
  G.uqOn = uq;
  // Land rules for where the Horde is fighting (js/world.js); none on the server
  const NO_LAND = {};
  const land = () => (G.landNow ? G.landNow() : NO_LAND);
  // Shrine buff of this kind active? (js/world.js)
  const shrine = k => !!(R.shr && R.shr.t > 0 && R.shr.k === k);

  // ---------- Gear ----------
  const rollAffix = (k, r) => { const v = G.AFFIXES[k].v; return +(G.lerp(v[0], v[1], G.rng()) * (1 + 0.35 * r)).toFixed(4); };
  function newAffix(r, have) {
    const keys = Object.keys(G.AFFIXES).filter(k => !have.some(a => a[0] === k));
    const k = pick(keys);
    return [k, rollAffix(k, r)];
  }
  function rollAffixes(r, n) {
    const out = [];
    if (n == null) n = AFFIX_COUNT[r];
    while (out.length < n) out.push(newAffix(r, out));
    return out;
  }
  // 4.0 (DESIGN §5.2): mythic gear carries a perk rank, divine two (in two different perks), drawn from the Warden's class
  // schools (G.CLASS_SCHOOLS) among the open perks: pk = {perk id: ranks}
  function rollPk(r) {
    const n = r >= 6 ? 2 : r >= 5 ? 1 : 0;
    if (!n || !G.PERK_SCHOOL) return null;
    const h = G.S.hero, sch = (G.CLASS_SCHOOLS && G.CLASS_SCHOOLS[h && h.cls]) || G.SCHOOLS || [];
    const pool = Object.keys(G.PERKS).filter(k => sch.includes(G.PERK_SCHOOL[k]) && (!G.perkOpen || G.perkOpen(k)));
    const pk = {};
    for (let i = 0; i < n && pool.length; i++) pk[pool.splice(Math.floor(G.rng() * pool.length), 1)[0]] = 1;
    return pk;
  }
  G.rollPk = rollPk;
  function makeGear(id, il) {
    const it = G.ITEM_BY_ID[id], h = G.S.hero;
    const g = { u: ++h.gu, id, r: it.r, il: Math.max(0, il | 0), e: 0, a: rollAffixes(it.r) };
    let pk = rollPk(it.r);
    // (Forge V: the first legendary of each run rolls a perk rank too)
    const run = G.S.run;
    if (!pk && it.r === 4 && G.D.legendPk && run && run.on && !run.legendPk) { run.legendPk = 1; pk = rollPk(5); }
    if (pk) g.pk = pk;
    return g;
  }
  G.makeGear = makeGear;
  // (4.0: a unique carries 2 ranks of its theme perk (G.UQ_THEME), +1 at Codex rank 2 and +1 at rank 4)
  function makeUnique(q, il) {
    const U = G.UNIQUES[q], it = G.ITEM_BY_ID[U.base], h = G.S.hero;
    const g = { u: ++h.gu, id: U.base, r: it.r, il: Math.max(0, il | 0), e: 0, a: U.a.map(x => x.slice()), q };
    const th = G.UQ_THEME && G.UQ_THEME[q];
    if (th) { const c = G.S.codex && G.S.codex[q], rk = c ? c.rank | 0 : 0; g.pk = { [th]: 2 + (rk >= 2 ? 1 : 0) + (rk >= 4 ? 1 : 0) }; }
    return g;
  }
  G.makeUnique = makeUnique;
  const enchantMul = g => 1 + 0.12 * g.e;
  // Uniques hit like a mythic of their kind
  // (4.0: a keepsake attunes (g.att): until the run opens legendary its rarity counts at most the run's cap, DESIGN §4.7)
  const rmul = g => { const m = g.q ? (G.UNIQUES[g.q] && G.UNIQUES[g.q].rm) || G.RMUL[5] : G.RMUL[g.r]; return g.att ? Math.min(m, G.RMUL[Math.min(5, G.rarityCap ? G.rarityCap() : 5)]) : m; };
  // The item's main stat: damage per hit, button HP, or % bonus
  function mainStat(g) {
    const type = G.ITEM_TYPE[g.id], slot = SLOT_OF_TYPE[type];
    const scale = rmul(g) * Math.pow(1.16, g.il) * enchantMul(g);
    if (slot === 'weapon') return 8 * scale;
    if (slot === 'armor') return 60 * scale * ARMOR_MUL[type];
    if (slot === 'ring') return 0.04 * rmul(g) * enchantMul(g) * (1 + g.il * 0.02);
    return 0.02 * rmul(g) * enchantMul(g) * (1 + g.il * 0.02);
  }
  G.mainStat = mainStat;

  // 3.0: Warden ranks. Every few levels the whole party gains something you can see: an extra mob hit
  // per attack, faster attacks, harder crits, more damage or health (on top of +5% a level)
  G.RANKS = [
    { lv: 5, tg: 1, k: 'rk_tg' }, { lv: 10, spd: 0.1, k: 'rk_spd' }, { lv: 15, hp: 0.15, k: 'rk_hp' },
    { lv: 20, tg: 1, k: 'rk_tg' }, { lv: 25, cd: 0.4, k: 'rk_cd' }, { lv: 30, spd: 0.1, k: 'rk_spd' },
    { lv: 35, dmg: 0.2, k: 'rk_dmg' }, { lv: 40, tg: 1, k: 'rk_tg' }, { lv: 45, hp: 0.25, k: 'rk_hp' },
    { lv: 50, dmg: 0.3, k: 'rk_dmg' }, { lv: 55, spd: 0.15, k: 'rk_spd' }, { lv: 60, tg: 2, k: 'rk_tg' },
  ];
  function ranksAt(lvl) {
    const r = { tg: 0, spd: 0, hp: 0, cd: 0, dmg: 0 };
    for (const x of G.RANKS) if (lvl >= x.lv) for (const k in r) r[k] += x[k] || 0;
    return r;
  }
  G.ranksAt = ranksAt;
  G.nextRank = lvl => G.RANKS.find(x => x.lv > lvl) || null;
  // 3.0: left to itself, a level-up picks a solid card, never one with a downside
  G.PERK_ORDER = ['might', 'frenzy', 'momentum', 'nova', 'blades', 'corpse', 'multi', 'overkill', 'aura', 'chain', 'burn', 'execute', 'laststand', 'cleave', 'crush', 'thunder', 'mark', 'ricochet', 'bulwark', 'aegis', 'thorns', 'secondwind', 'warband', 'frost', 'souls', 'greed', 'reach', 'leech', 'loot', 'plunder', 'fortress', 'avarice', 'glass'];
  G.autoPerk = offer => offer.slice().sort((a, b) => { const i = x => { const k = G.PERK_ORDER.indexOf(x); return k < 0 ? 28 : k; }; return i(a) - i(b); })[0];
  // Full combat numbers for a given set of equipped items
  function combat(eq, d, who) {
    const h = who || G.S.hero;
    const cls = G.CLASS_BY_ID[h.cls] || G.CLASSES[0];
    const aff = {};
    for (const slot of G.SLOTS) {
      const g = eq[slot];
      if (g) for (const [k, v] of g.a) aff[k] = (aff[k] || 0) + v;
    }
    const w = eq.weapon;
    const wtype = w ? G.ITEM_TYPE[w.id] : 'dagger';
    const wt = G.WEAPONS[wtype];
    const lvlM = 1 + 0.05 * (h.lvl - 1), rk = ranksAt(h.lvl);
    const own = cls.weapons.includes(wtype) ? 1.5 : 1;
    const pct = 1 + (aff.dmg || 0) + (eq.ring ? mainStat(eq.ring) : 0) + (eq.ability ? mainStat(eq.ability) : 0);
    const base = (w ? mainStat(w) : 4) * own * lvlM * pct * (d.heroMult || 1) * (1 + rk.dmg);
    const hit = base * wt.mult;
    const rate = wt.rate * (1 + (aff.spd || 0) + (cls.spd || 0) + rk.spd) * (d.spdMult || 1);
    const crit = Math.min(0.9, (d.crit || 0.03) + (aff.crit || 0) + cls.crit);
    const critMult = (d.critMult || 3) + (aff.critd || 0) + rk.cd;
    const targets = wt.targets + cls.extra + rk.tg;
    const hp = (eq.armor ? mainStat(eq.armor) : TUNE.baseHp) * lvlM * cls.hp * (1 + (aff.hp || 0) + rk.hp) * (d.hpMult || 1);
    const dps = hit * rate * (1 + crit * (critMult - 1));
    const power = Math.floor(dps * (1 + 0.15 * (targets - 1)) * Math.sqrt(hp / TUNE.baseHp) * 10);
    return { aff, wtype, wt, hit, rate, crit, critMult, targets, hp, dps, power, own: own > 1 };
  }
  G.heroCombat = combat;

  function powerWith(slot, g, who) {
    const m = who != null && who >= 0 ? G.S.party[who] : null;
    const eq = Object.assign({}, m ? m.eq : G.S.hero.eq);
    eq[slot] = g;
    return combat(eq, G.D, m ? { cls: m.cls, lvl: G.S.hero.lvl } : undefined).power;
  }
  G.powerWith = powerWith;
  // 2.4: "Equip best": every member of the party in turn (the Warden first) takes the strongest piece
  // for each slot out of the bag and what they already wear. Companions keep to their own class's weapons.
  G.equipBest = function () {
    const S = G.S, h = S.hero;
    if (!h || !h.cls) return 0;
    let n = 0;
    const whos = [-1].concat((S.party || []).map((_, i) => i));
    for (const who of whos) {
      const m = who >= 0 ? S.party[who] : null, eq = eqOf(who);
      for (const slot of G.SLOTS) {
        // (a worn unique stays on unless another unique beats it. 4.0, the ring bug: companions take uniques too; the rule
        // works on anyone in the party)
        const keepUq = eq[slot] && eq[slot].q;
        const pool = h.bag.filter(g => G.slotOf(g.id) === slot && (slot !== 'weapon' || !m || G.CLASS_BY_ID[m.cls].weapons.includes(G.ITEM_TYPE[g.id])) && !(keepUq && !g.q));
        let best = eq[slot], bp = best ? powerWith(slot, best, who) : -1;
        for (const g of pool) { const p = powerWith(slot, g, who); if (p > bp) { best = g; bp = p; } }
        if (best && best !== eq[slot]) { equip(best, true, who); n++; }
      }
    }
    if (n) { G.dirty(); G.recalc(); emit('equipBest', n); }
    return n;
  };
  // Whose gear set this is: the Warden's (who < 0) or a companion's
  const eqOf = who => (who != null && who >= 0 && G.S.party[who] ? G.S.party[who].eq : G.S.hero.eq);
  G.eqOf = eqOf;

  // ---------- 4.0: comparison (ADDENDUM 2: one helper set for the loot moment, ground labels, bag, Forge, Character) ----------
  // may this hero wear it? (a companion swings only its own class's weapons; the Warden any)
  G.canWear = function (who, g) {
    if (!g) return false;
    const m = who != null && who >= 0 ? G.S.party[who] : null;
    if (who != null && who >= 0 && !m) return false;
    if (!m || G.slotOf(g.id) !== 'weapon') return true;
    return G.CLASS_BY_ID[m.cls].weapons.includes(G.ITEM_TYPE[g.id]);
  };
  // how much better this hero's power gets wearing it in place of what they wear (a fraction: 0.38 = +38%; an empty
  // slot counts as +100%); null when they can't wear it
  G.wants = function (who, g) {
    if (!G.canWear(who, g)) return null;
    const slot = G.slotOf(g.id), cur = eqOf(who)[slot];
    if (cur === g) return 0;
    const now = powerWith(slot, cur || null, who), next = powerWith(slot, g, who);
    return now > 0 ? next / now - 1 : 1;
  };
  // who in the party gains most from it: { who (-1 the Warden, else a companion's index), slot, delta (the fraction),
  // up: delta > 0 }. Ties go to the Warden.
  G.bestWearer = function (g) {
    const S = G.S;
    if (!g || !S.hero || !S.hero.cls) return { who: -1, slot: g ? G.slotOf(g.id) : null, delta: 0, up: false };
    let best = null;
    for (const who of [-1].concat((S.party || []).map((_, i) => i))) {
      const d = G.wants(who, g);
      if (d != null && (!best || d > best.delta + 1e-9)) best = { who, slot: G.slotOf(g.id), delta: d };
    }
    if (!best) best = { who: -1, slot: G.slotOf(g.id), delta: -1 };
    best.up = best.delta > 1e-6;
    return best;
  };
  // the side-by-side 'Worn | This' rows for one hero: power, the main stat, every affix, the rule (uniques), the perk
  // ranks (mythic, divine, uniques) and the Mark (g.px, js/powers.js): { k, a (worn), b (this), d (b - a) }
  G.compareRows = function (who, g) {
    const slot = G.slotOf(g.id), cur = eqOf(who)[slot] || null, rows = [];
    const row = (k, a, b) => rows.push({ k, a, b, d: (typeof a === 'number' && typeof b === 'number') ? b - a : null });
    row('power', powerWith(slot, cur, who), powerWith(slot, g, who));
    row('main', cur ? mainStat(cur) : 0, mainStat(g));
    const ka = {}, kb = {};
    for (const [k, v] of (cur && cur.a) || []) ka[k] = (ka[k] || 0) + v;
    for (const [k, v] of g.a || []) kb[k] = (kb[k] || 0) + v;
    for (const k of Object.keys(G.AFFIXES)) if (ka[k] || kb[k]) row('aff:' + k, ka[k] || 0, kb[k] || 0);
    if ((cur && cur.q) || g.q) row('rule', cur && cur.q || null, g.q || null);
    const pa = (cur && cur.pk) || {}, pb = g.pk || {};
    for (const k of new Set(Object.keys(pa).concat(Object.keys(pb)))) row('perk:' + k, pa[k] | 0, pb[k] | 0);
    if ((cur && cur.px) || g.px) row('mark', cur && cur.px || null, g.px || null);
    return rows;
  };
  // Everything anyone in the party wears
  function worn(g) { if (G.SLOTS.some(s => G.S.hero.eq[s] === g)) return true; return (G.S.party || []).some(m => G.SLOTS.some(s => m.eq[s] === g)); }
  G.isWorn = worn;

  function gainGear(it, srcTier, pre) {
    const S = G.S, h = S.hero;
    if (!h) return null;
    const g = pre || makeGear(it.id, dnow() + (chance(0.35) ? 1 : 0));
    h.fresh++;
    const slot = G.slotOf(g.id);
    let equipped = false;
    if (h.auto && h.cls) {
      const cur = h.eq[slot];
      if (!cur || powerWith(slot, g) > powerWith(slot, cur)) { equip(g, true); equipped = true; }
      // what the Warden doesn't want may suit a companion (weapons only for their own class)
      else (S.party || []).some((m, i) => {
        if (slot === 'weapon' && !G.CLASS_BY_ID[m.cls].weapons.includes(G.ITEM_TYPE[g.id])) return false;
        const c2 = m.eq[slot];
        if (!c2 || powerWith(slot, g, i) > powerWith(slot, c2, i)) { equip(g, true, i); equipped = true; return true; }
        return false;
      });
    }
    if (!equipped) {
      if (h.salv && g.r < h.salv && !g.q) { salvage(g, true); return g; }
      h.bag.push(g);
    }
    bagTrim();
    emit('gear', g, equipped);
    return g;
  }
  G.gainGear = gainGear;
  // a full bag drops its weakest item into shards, uniques last
  function bagTrim() {
    const h = G.S.hero;
    while (h.bag.length > TUNE.bagMax) {
      let worst = null, ws = Infinity;
      for (const b of h.bag) { const s = powerWith(G.slotOf(b.id), b) + (b.q ? 1e300 : 0) + (b.keep ? 1e299 : 0); if (s < ws) { ws = s; worst = b; } }
      salvage(worst, true);
    }
  }
  G.bagTrim = bagTrim;

  function equip(g, silent, who) {
    const h = G.S.hero, slot = G.slotOf(g.id), eq = eqOf(who);
    // taking it off whoever wore it before
    for (const e of [h.eq].concat((G.S.party || []).map(m => m.eq))) if (e !== eq && e[slot] === g) { e[slot] = null; }
    const old = eq[slot];
    const i = h.bag.indexOf(g);
    if (i >= 0) h.bag.splice(i, 1);
    eq[slot] = g;
    if (old && old !== g) h.bag.push(old);
    G.dirty(); G.recalc();
    if (!silent) emit('equip', g);
    return true;
  }
  G.equip = equip;
  function unequip(slot, who) {
    const h = G.S.hero, eq = eqOf(who), g = eq[slot];
    if (!g) return false;
    eq[slot] = null; h.bag.push(g);
    G.dirty(); G.recalc(); emit('equip', null);
    return true;
  }
  G.unequip = unequip;

  function salvageValue(g) { return Math.ceil(SALVAGE[g.r] * (1 + g.il * 0.05) * (1 + 0.5 * g.e) * (G.D.shardMult || 1)); }
  G.salvageValue = salvageValue;
  function salvage(g, silent) {
    const h = G.S.hero;
    const i = h.bag.indexOf(g);
    if (i >= 0) h.bag.splice(i, 1);
    if (worn(g)) return 0; // never scrap what anyone wears
    const v = salvageValue(g);
    h.shards += v;
    // (4.0, Forge III: salvage pays an orb for every 40 shards it brings)
    if (G.D.salvOrbs) { h.salvAcc = (h.salvAcc || 0) + v; while (h.salvAcc >= 40) { h.salvAcc -= 40; const k = G.ORB_IDS[G.weighted(G.ORB_IDS.map(x => G.ORBS[x].w))]; h.orbs[k] = (h.orbs[k] || 0) + 1; } }
    if (!silent) emit('salvage', g, v);
    return v;
  }
  G.salvage = salvage;
  G.salvageBelow = function (r) {
    const h = G.S.hero;
    let n = 0, v = 0;
    for (const g of h.bag.slice()) if (g.r < r && !g.q && !g.keep) { v += salvage(g, true); n++; }
    emit('salvage', null, v);
    return { n, v };
  };

  // (4.0: inside a Siege enchanting is paid in shards only, the run's crafting currency (ADDENDUM 3); Enchanter II -20%)
  function enchantCost(g) {
    const k = G.D.enchantK || 1;
    return { shards: Math.ceil(4 * Math.pow(1.5, g.e) * G.RMUL[g.r] * k), gold: siegeOn() ? 0 : Math.max(50, G.D.incomeRef * 6 * Math.pow(1.3, g.e)) };
  }
  G.enchantCost = enchantCost;
  function enchant(g) {
    const S = G.S, h = S.hero;
    if (g.e >= G.ENCHANT_MAX) return false;
    const c = enchantCost(g);
    if (h.shards < c.shards || S.gold < c.gold) return false;
    h.shards -= c.shards; S.gold -= c.gold; g.e++;
    G.dirty(); G.recalc();
    emit('enchant', g);
    return true;
  }
  G.enchant = enchant;
  // ---------- 4.0: ENCHANT ALL (ADDENDUM 3; the equip map's plan): Forge I and the camp ----------
  // G.enchantPlan(o): what one tap would do, nothing changed. o = { mode: 'even' (the lowest enchanted worn items first,
  // the whole party) | 'power' (main stat per shard), shards: the share of the shards it may spend (1), whet: use
  // whetstones after the shards (true), bag: bag items too (false), only: one item's uid }.
  // -> { steps, spent: {shards, whet}, items: [{u, who, slot, from, to}], per: [{who, levels, before, after}] }
  G.enchantPlan = function (o) {
    o = Object.assign({ mode: 'even', shards: 1, whet: true, bag: false, only: null }, o || {});
    const S = G.S, h = S.hero;
    if (!h || !h.cls) return { steps: 0, spent: { shards: 0, whet: 0 }, items: [], per: [] };
    const xs = [];
    const add = (g, who, slot) => { if (g && (o.only == null || g.u === o.only)) xs.push({ g, who, slot, e: g.e, from: g.e }); };
    for (const who of [-1].concat((S.party || []).map((_, i) => i))) for (const slot of G.SLOTS) add(eqOf(who)[slot], who, slot);
    if (o.bag) for (const g of h.bag) add(g, 'bag', G.slotOf(g.id));
    let shards = Math.floor((h.shards || 0) * o.shards), whet = o.whet ? (h.orbs.whet | 0) : 0, steps = 0, spentS = 0, spentW = 0;
    const cost = x => enchantCost(Object.assign({}, x.g, { e: x.e })).shards;
    const gain = x => rmul(x.g) * (G.slotOf(x.g.id) === 'weapon' || G.slotOf(x.g.id) === 'armor' ? Math.pow(1.16, x.g.il) : 3);
    const order = x => o.mode === 'power' ? gain(x) / Math.max(1, cost(x)) : -(x.e * 1000 + ((x.who === 'bag' ? 9 : x.who) + 1) * 10 - x.g.r);
    const pickNext = afford => { let b = null, bk = -Infinity; for (const x of xs) { if (x.e >= G.ENCHANT_MAX || (afford && cost(x) > shards)) continue; const k = order(x); if (k > bk) { bk = k; b = x; } } return b; };
    for (let guard = 0; guard < 2000; guard++) { const x = pickNext(true); if (!x) break; const c = cost(x); shards -= c; spentS += c; x.e++; steps++; }
    for (let guard = 0; guard < 2000 && whet > 0; guard++) { const x = pickNext(false); if (!x) break; whet--; spentW++; x.e++; steps++; }
    // each hero's power before and after
    const per = [];
    for (const who of [-1].concat((S.party || []).map((_, i) => i))) {
      const mine = xs.filter(x => x.who === who && x.e > x.from);
      if (!mine.length) continue;
      const m = who >= 0 ? S.party[who] : null, eq = Object.assign({}, m ? m.eq : h.eq), eq2 = {};
      for (const sl of G.SLOTS) { const x = mine.find(y => y.slot === sl); eq2[sl] = x ? Object.assign({}, eq[sl], { e: x.e }) : eq[sl]; }
      const unit = m ? { cls: m.cls, lvl: h.lvl } : undefined;
      per.push({ who, levels: mine.reduce((a, x) => a + x.e - x.from, 0), before: combat(eq, G.D, unit).power, after: combat(eq2, G.D, unit).power });
    }
    return { mode: o.mode, steps, spent: { shards: spentS, whet: spentW }, items: xs.filter(x => x.e > x.from).map(x => ({ u: x.g.u, who: x.who, slot: x.slot, from: x.from, to: x.e })), per, _xs: xs };
  };
  // do it: one recalc; emits 'enchantAll'(plan); returns the plan (steps 0: nothing affordable)
  G.enchantAll = function (o) {
    const S = G.S, h = S.hero, P = G.enchantPlan(o);
    if (!P.steps || (h.shards | 0) < P.spent.shards || (h.orbs.whet | 0) < P.spent.whet) return Object.assign(P, { _xs: undefined, steps: 0 });
    h.shards -= P.spent.shards; h.orbs.whet = (h.orbs.whet | 0) - P.spent.whet;
    for (const x of P._xs) x.g.e = x.e;
    delete P._xs;
    S.st.orbsUsed = (S.st.orbsUsed || 0) + P.spent.whet; S.st.enchants = (S.st.enchants || 0) + P.steps;
    G.dirty(); G.recalc();
    emit('enchantAll', P);
    return P;
  };

  // Why an orb can't be used on this item (null when it can)
  function orbBlock(id, g) {
    if (!g) return 'none';
    if (id === 'whet') return g.e >= G.ENCHANT_MAX ? 'max' : null;
    if (g.q) return 'unique';
    if (g.c) return 'corrupt';
    if (id === 'flux' || id === 'grace') return g.a.length ? null : 'noaff';
    if (id === 'ascent') return g.a.length >= AFFIX_COUNT[g.r] + 1 ? 'full' : null;
    return null;
  }
  G.orbBlock = orbBlock;
  G.useOrb = function (id, g) {
    const h = G.S.hero;
    if (!(h.orbs[id] > 0) || orbBlock(id, g)) return null;
    h.orbs[id]--;
    G.S.st.orbsUsed = (G.S.st.orbsUsed || 0) + 1;
    let res = id;
    if (id === 'whet') g.e++;
    else if (id === 'flux') {
      // (3.1: a sealed affix stays; the rest roll again)
      const keep = g.lk != null && g.a[g.lk] ? [g.a[g.lk]] : [];
      const out = keep.slice(); while (out.length < g.a.length) out.push(newAffix(g.r, out));
      g.a = out; if (keep.length) g.lk = 0;
    }
    else if (id === 'ascent') g.a.push(newAffix(g.r, g.a));
    else if (id === 'grace') g.a = g.a.map(([k, v]) => [k, Math.max(v, rollAffix(k, g.r))]);
    else if (id === 'ruin') {
      g.c = 1;
      // (4.0, Enchanter IV: Ruin never bricks: always the item level or the affix)
      const roll = G.D.ruinSafe ? G.rng() * 0.7 : G.rng();
      if (roll < 0.35) { g.il += 3; res = 'ruin_il'; }
      else if (roll < 0.7) { g.a.push(newAffix(g.r, g.a)); res = 'ruin_aff'; }
      else res = 'ruin_none';
    }
    G.dirty(); G.recalc();
    emit('orb', id, g, res);
    return res;
  };

  // 3.1: seal one affix for shards, so an Orb of Flux rerolls only the others (one seal an item; sealing
  // another moves it)
  G.sealCost = g => Math.round(20 * (g.r + 1) * (1 + (g.il || 0) / 12));
  G.sealAffix = function (g, i) {
    const h = G.S.hero;
    if (!g || g.q || g.c || !g.a[i] || g.lk === i) return false;
    const c = G.sealCost(g);
    if (h.shards < c) return false;
    h.shards -= c; g.lk = i;
    emit('seal', g, i);
    return true;
  };
  // 3.1: the Gambler: shards for a mystery item of the slot you choose; mostly magic to the depth's best
  // rarity, now and then a unique
  // (4.0: priced and rolled by this run's depth, not the lifetime best)
  G.gambleCost = () => Math.round(30 * Math.pow(1.07, G.S.maxDepth || 0));
  G.GAMBLE_UQ = 0.04;
  G.gamble = function (slot) {
    const S = G.S, h = S.hero, c = G.gambleCost();
    if (!h || !h.cls || h.shards < c || !G.SLOTS.includes(slot)) return null;
    h.shards -= c;
    S.st.gambles = (S.st.gambles || 0) + 1;
    const d = S.maxDepth || 0, cap = G.rarityCap();
    // a unique of this slot the depth allows
    const uqs = (G.UNIQUE_IDS || []).filter(q => { const U = G.UNIQUES[q]; return (G.uqOpen ? G.uqOpen(q, d) : U.minD <= d) && !U.boss && G.slotOf(U.base) === slot; });
    if (uqs.length && chance(G.GAMBLE_UQ)) {
      const q = uqs[Math.floor(G.rng() * uqs.length)], U = G.UNIQUES[q], it = G.ITEM_BY_ID[U.base];
      const first = !S.uq[q]; S.uq[q] = (S.uq[q] || 0) + 1;
      const res = G.lootItem(it, 'unique', makeUnique(q, d + 1));
      if (first && G.feed) G.feed('uq', U.name);
      emit('gamble', { slot, q, it, g: res && res.g, first });
      return { slot, q, it, g: res && res.g };
    }
    let r = Math.max(1, Math.min(cap, G.rollTier() + 1));
    let list = [];
    for (; r >= 0 && !list.length; r--) list = G.ITEMS.filter(it => it.r === r && G.slotOf(it.id) === slot);
    const it = list[Math.floor(G.rng() * list.length)];
    const res = G.lootItem(it, 'gamble', makeGear(it.id, d + 1));
    emit('gamble', { slot, it, g: res && res.g });
    return { slot, it, g: res && res.g };
  };

  function chooseClass(id) {
    const S = G.S, h = S.hero, cls = G.CLASS_BY_ID[id];
    if (!cls) return false;
    // 4.0: a class picked with no Siege on starts one (the 3.x class pick, and the playtest bots); the run setup's own way
    // in is G.runStart({ btn, cls, heat, ... }), which comes back here with the run already on
    if (G.runStart && !(S.run && S.run.on)) return !!G.runStart({ cls: id });
    h.cls = id;
    const hasWeapon = [h.eq.weapon].concat(h.bag).some(g => g && G.slotOf(g.id) === 'weapon' && cls.weapons.includes(G.ITEM_TYPE[g.id]));
    if (!hasWeapon) { const g = makeGear(cls.starter, 0); h.bag.push(g); }
    // Wear the best weapon for the new class
    let best = h.eq.weapon, bp = best ? powerWith('weapon', best) : -1;
    for (const g of h.bag) if (G.slotOf(g.id) === 'weapon') { const p = powerWith('weapon', g); if (p > bp) { bp = p; best = g; } }
    if (best && best !== h.eq.weapon) equip(best, true);
    G.dirty(); G.recalc();
    h.hp = G.D.heroHp; h.whp = G.D.wardenHp; h.wdown = 0;
    emit('classChosen', cls);
    return true;
  }
  G.chooseClass = chooseClass;

  // ---------- Hooks called from recalc ----------
  // Economy side of gear affixes, applied before gold multipliers are summed
  G.heroEcon = function (d) {
    const h = G.S.hero;
    if (!h) return;
    const aff = {};
    for (const slot of G.SLOTS) { const g = h.eq[slot]; if (g) for (const [k, v] of g.a) aff[k] = (aff[k] || 0) + v; }
    // (4.0: a Battle door's land, a Greed Pact: their gold)
    d.goldMult *= (1 + (aff.gold || 0)) * (1 + G.STAR_BONUS * (G.starCount ? G.starCount() : 0)) * (land().gold || 1);
    d.luck += (aff.luck || 0) + om().luck;
    // (4.0: on top of what came before: the Hall's Scholar)
    d.xpMult = (d.xpMult || 1) * (1 + (aff.xp || 0)) * om().xp;
    d.shardMult = 1 + (aff.shard || 0);
  };
  G.heroFinish = function (d) {
    const S = G.S, h = S.hero;
    if (!h) return;
    // (4.0: no hidden power: fame no longer adds damage; land stars give none (STAR_BONUS 0); the Journey's is the meta's.
    // The Garrison's +2% a class stays: the Garrison is the run's own power)
    d.heroMult = (d.heroMult || 1) * (1 + 0.02 * (d.heroClasses || 0)) * (G.Journey ? G.Journey.bonus() : 1) * (1 + G.STAR_BONUS * (G.starCount ? G.starCount() : 0));
    // 4.0 (DESIGN §5.2): the perk ranks the party's worn gear carries (set on the live D at once: perk() reads it below)
    const gp = {};
    const addPk = g => { if (g && g.pk) for (const k in g.pk) gp[k] = (gp[k] || 0) + (g.pk[k] | 0); };
    for (const s of G.SLOTS) addPk(h.eq[s]);
    for (const m of S.party || []) for (const s of G.SLOTS) addPk(m.eq[s]);
    d.gearPerk = gp; G.D.gearPerk = gp;
    // 4.0: companions' traits: a Bannerman lifts the whole party's damage, a Scavenger the loot moment's luck
    const TR = m => (m && m.trait && G.TRAITS && G.TRAITS[m.trait]) || null;
    let banner = 0, luck = 0;
    for (const m of S.party || []) { const T = TR(m); if (T) { banner += T.party || 0; luck += T.luck || 0; } }
    if (banner) d.heroMult *= 1 + banner;
    d.lootLuck = (d.lootLuck || 0) + luck;
    const c = combat(h.eq, d);
    // the uniques' rules: 4.0 (the ring bug): a unique works on whoever in the party wears it; and the run's relic belt
    // (S.run.belt: rule ids) works like a worn unique, so every uq() rule needs nothing new
    d.uq = {};
    for (const s of G.SLOTS) if (h.eq[s] && h.eq[s].q) d.uq[h.eq[s].q] = 1;
    for (const m of S.party || []) for (const s of G.SLOTS) if (m.eq[s] && m.eq[s].q) d.uq[m.eq[s].q] = 1;
    if (S.run && S.run.on && Array.isArray(S.run.belt)) for (const q of S.run.belt) if (q) d.uq[q] = 1;
    const hunt = R.hb.hh > 0 && d.uq.headhunter ? 1.6 : 1;
    // (4.0: a Golden Click's Frenzy is party damage x1.5 too, inside a Siege)
    const frenzyB = siegeOn() && G.hasBuff && G.hasBuff('frenzy') ? 1.5 : 1;
    const buffDmg = (R.hb.tome > 0 ? 1.5 : 1) * (R.hb.orb > 0 ? 1.3 : 1) * hunt * frenzyB;
    d.hero = c;
    const might = (1 + 0.12 * perk('might')) * (evo('titan') ? 1.5 : 1) * (evo('bloodpact') ? 1.25 : 1);
    const frenzy = (1 + 0.12 * perk('frenzy')) * (evo('berserk') ? 1.5 : 1) * hunt * (1 + 0.02 * (d.uq.reaper ? R.reap : 0)) * (shrine('frenzy') ? 2 : 1);
    d.heroHit = c.hit * buffDmg * might;
    d.heroRate = c.rate * (R.hb.wing > 0 ? 2 : 1) * frenzy * evMul('rate');
    d.heroHp = c.hp * (1 + 0.2 * perk('bulwark')) * (evo('bastion') ? 2 : 1);
    d.heroDps = c.dps * buffDmg * might * frenzy;
    // the same without anything that runs out in seconds (buffs, shrines, events): what a boss's health is measured by
    const steady = might * (1 + 0.12 * perk('frenzy')) * (evo('berserk') ? 1.5 : 1);
    d.heroDpsBase = c.dps * steady; d.heroHitBase = c.hit * might;
    d.power = c.power;
    // the Warden's own health, apart from the Button's
    d.wardenHp = c.hp * 0.8 * (1 + 0.2 * perk('bulwark')) * (G.ROLES[h.cls] === 'tank' ? 1.5 : 1);
    // companions fight with their own gear and the same run bonuses
    d.party = (S.party || []).map(m => {
      const pc = combat(m.eq, d, { cls: m.cls, lvl: h.lvl }), role = G.ROLES[m.cls], T = TR(m) || {};
      // (4.0: a trait's crit counts in its damage per second)
      if (T.crit) { const c0 = pc.crit; pc.crit = Math.min(0.9, c0 + T.crit); pc.dps *= (1 + pc.crit * (pc.critMult - 1)) / (1 + c0 * (pc.critMult - 1)); }
      // companions back the Warden up: their hits count for less, a cleric's least of all
      // (4.0: + the trait's damage, speed and health, and the Tavern III/IV levels)
      const soft = TUNE.allyDmg * (role === 'heal' ? 0.5 : 1) * (1 + (T.dmg || 0)) * (d.allyDmgK || 1), spd = 1 + (T.spd || 0);
      const o = { c: pc, role, trait: m.trait || null, heal: 1 + (T.heal || 0), hit: pc.hit * buffDmg * might * soft, rate: pc.rate * frenzy * evMul('rate') * spd,
        hp: pc.hp * 0.8 * (1 + 0.2 * perk('bulwark')) * (role === 'tank' ? 1.5 : 1) * Math.max(0.1, 1 + (T.hp || 0)) * (d.allyHpK || 1) };
      o.dps = pc.dps * buffDmg * might * frenzy * soft * spd;
      o.dpsBase = pc.dps * steady * soft * spd;
      if (m.hp > o.hp) m.hp = o.hp;
      return o;
    });
    d.wardenDps = d.heroDps;
    for (const p of d.party) { d.heroDps += p.dps; d.heroDpsBase += p.dpsBase; }
    for (const f of G.HOOKS.stats) f(d);
    if (h.whp > d.wardenHp) h.whp = d.wardenHp;
    if (h.hp > d.heroHp) h.hp = d.heroHp;
    if (c.power > S.rec.maxPower) S.rec.maxPower = c.power;
  };

  // ---------- The Horde ----------
  // Mobs walk from the edge of the arena (p = 0) to the Button (p = 1). Each
  // kind has a weight: its share of a standard mob's HP, bite, rewards and
  // clearing progress. A swarm of fodder is worth the same as a few brutes,
  // it just dies in a much bigger heap.
  // (2.3: the first lands are thicker, 3.5 times at depth 0, easing to nothing by depth 40, so the
  // early game is a fight too and not a stroll a fresh Warden outgrows in minutes)
  // (3.6: kept per depth, and worked out again if a TUNE number it uses changes)
  const HPC = []; let hpB, hpG, hpE, hpT;
  function mobHp(d) {
    if (hpB !== TUNE.mobBase || hpG !== TUNE.mobGrowth || hpE !== TUNE.earlyHp || hpT !== TUNE.earlyTo) { HPC.length = 0; hpB = TUNE.mobBase; hpG = TUNE.mobGrowth; hpE = TUNE.earlyHp; hpT = TUNE.earlyTo; }
    let v = HPC[d];
    if (v === undefined) { v = TUNE.mobBase * Math.pow(TUNE.mobGrowth, d) * (1 + TUNE.earlyHp * Math.max(0, 1 - d / TUNE.earlyTo)); if (d >= 0 && d < 4096 && d === (d | 0)) HPC[d] = v; }
    return v;
  }
  function mobAtk(d) { return TUNE.mobAtkBase * Math.pow(TUNE.mobAtkGrowth, d); }
  G.mobHp = mobHp; G.mobAtk = mobAtk;
  // Bosses are worth a few dozen mobs at first and grow into real walls by
  // the second land: from then on a boss needs a Warden strong for this depth.
  G.bossHp = d => mobHp(d) * Math.min(TUNE.bossHpMobs, 40 + 30 * d) * (G.isLord(d) ? TUNE.lordHp : 1);
  // (3.3: the first levels cost more, so the opening isn't a blur of level-up cards)
  const XPC = [];
  function xpNeed(l) { return XPC[l] || (XPC[l] = Math.floor(10 * Math.pow(1.21, l - 1) + 14 * l)); }
  G.xpNeed = xpNeed;

  G.MOB_KINDS = {
    fodder: { w: 0.0038, spd: 1.3, gold: 1 }, // 3.4: lighter, so the Horde comes in half again as many bodies (was 0.0057)
    brute:  { w: 1, spd: 1, gold: 1 },
    magic:  { w: 2, spd: 1.05, gold: 1.25 }, // blue champions, they come in pairs
    rare:   { w: 6, spd: 0.9, gold: 1.5 },   // yellow, named, one modifier, a pack of minions
    hoard:  { w: 1, spd: 0, gold: 40, hp: 12 }, // the Hoarder: runs around with a sack of loot, never bites
    guardian: { w: 1, spd: 0.4, gold: 30 },  // a Rift's last foe (js/world.js sets its health)
  };
  // runners, spitters, bombers and tanks: each zone of a land brings one more (data.js)
  for (const k in G.ARCHETYPES || {}) G.MOB_KINDS[k] = G.ARCHETYPES[k];
  // Kinds that count as small fry: no health bar, cheap to draw, many at once
  G.SMALL = { fodder: 1, runner: 1 };
  G.RARE_MODS = {
    hasted:   { name: 'Hasted' },    // walks 70% faster
    stone:    { name: 'Stoneskin' }, // takes half damage
    splitter: { name: 'Splitting' }, // bursts into fodder when it dies
    frenzied: { name: 'Frenzied' },  // bites twice as hard
  };
  const RARE_A = ['Gloom', 'Rot', 'Blight', 'Grim', 'Dread', 'Hollow', 'Ash', 'Bile', 'Doom', 'Rust', 'Wretch', 'Vile'];
  const RARE_B = ['Maw', 'Fang', 'Gnaw', 'Howl', 'Spawn', 'Husk', 'Claw', 'Rend', 'Brood', 'Shriek', 'Grin', 'Hunger'];

  const hordeCap = d => TUNE.hordeCap + Math.min(10, d / 4);
  const clamp01 = v => Math.max(0, Math.min(1, v));
  function aliveWeight(adds) { let w = 0; for (const m of R.mobs) if (!!m.add === adds) w += m.w; return w; }

  // Arena position, the same angle mapping the stage draws with (the top,
  // under the HUD, stays clear). The spawn ring is radius 1.
  // (3.6: the angle's cosine and sine are kept on the mob and redone only when its angle changes; G.mobX / G.mobY
  // give the position without making an array, for the loops over the whole Horde)
  const TH0 = -Math.PI / 2 + 0.55, THK = Math.PI * 2 - 1.1;
  function trig(m) { if (m._ta !== m.a) { m._ta = m.a; const th = TH0 + m.a * THK; m._tc = Math.cos(th); m._ts = Math.sin(th); } }
  function mobXY(m) {
    trig(m);
    const r = 1 - 0.88 * m.p;
    return [m._tc * r, m._ts * r];
  }
  G.mobXY = mobXY;
  G.mobX = m => { trig(m); return m._tc * (1 - 0.88 * m.p); };
  G.mobY = m => { trig(m); return m._ts * (1 - 0.88 * m.p); };

  // How hard the Warden hits this depth: standard mobs they could kill per second
  const mightRatio = () => (G.D.heroDps || 0) / mobHp(dnow());
  G.mightRatio = mightRatio;
  // The Horde answers strength: a Warden who kills faster faces a bigger, heavier
  // flow, so a stronger Warden clears lands (and earns gold and XP) faster
  // (2.3: and never less than a full Horde: a Warden too weak for the depth is overrun, not spared)
  // 4.0: inside a Siege the Horde follows the run's schedule, not the Warden's might (measured: a might-scaled Horde made
  // extra power shorten runs): min(3, 1 + 2 depth/17), the Last Stand 4.5 (R.lastStand)
  const siegeOn = () => !R.rift && !!(G.S.run && G.S.run.on);
  const hordeScale = () => siegeOn() ? (R.lastStand ? TUNE.hsLast : Math.min(TUNE.hsSiegeMax, 1 + TUNE.hsSiegeK * Math.max(0, dnow()) / ((G.SIEGE && G.SIEGE.final) || 17)))
    : G.clamp(mightRatio() / TUNE.hordeRef, TUNE.hsMin, TUNE.hordeMax);
  G.hordeScale = hordeScale;
  // 3.6: how many small bodies the field holds now, and how much each weighs against the mobRef it was balanced for
  function crowdUpdate() {
    const d = dnow(), base = Math.max(40, Math.min(TUNE.mobMax, TUNE.mobRef));
    let ramp = R.rift ? 1 : Math.min(1, TUNE.crowdFrom + TUNE.crowdPer * d);
    if (!R.rift && d < TUNE.crowdRunTo) ramp *= Math.min(1, TUNE.crowdRunFrom + (1 - TUNE.crowdRunFrom) * (R.runT || 0) / TUNE.crowdRun);
    R.crowdCap = Math.max(40, Math.round(base * ramp)); R.crowdD = d;
    R.crowdK = TUNE.mobRef / base * Math.pow(1 / ramp, TUNE.crowdKeep);
  }
  const crowdCap = () => { if (R.crowdCap == null || R.crowdD !== dnow()) crowdUpdate(); return R.crowdCap; };
  // a swarm of n small ones (as balanced at mobRef bodies) in the bodies the field holds now
  const crowdN = n => Math.max(1, Math.round(n / (R.crowdK || 1)));
  G.crowdN = crowdN; G.crowdCap = crowdCap; G.crowdUpdate = crowdUpdate;
  // 3.6: how much of the clear bar the zone's clock allows by now (R.zoneT: field time in this zone; see game.js TUNE.zoneMin)
  // (4.0: new ground means new to this run: S.maxDepth is the run's)
  const zoneMinNow = () => (G.S.depth >= (G.S.maxDepth || 0) ? TUNE.zoneMin : TUNE.zoneMinOld) || 0;
  function zoneShare() { const z = zoneMinNow(); return z > 0 ? Math.min(1, (R.zoneT || 0) / z) : 1; }
  G.zoneShare = zoneShare;
  // set the zone's clock to match a clear bar (after a load or a lost fight)
  G.zoneSync = () => { const need = G.D.bossNeed || 8; R.zoneT = zoneMinNow() * Math.min(1, Math.max(0, (G.S.bossMeter || 0) / need)); };
  function makeMob(kind, a, p, add) {
    const K = G.MOB_KINDS[kind];
    // a stronger Warden meets a heavier Horde: half of it in heft, half in numbers (spawnPack)
    const w = K.w * (add ? 1 : Math.sqrt(Math.max(1, (R.hs || 1) / 1.5))) * (G.SMALL[kind] ? R.crowdK || 1 : 1);
    // small fry take a few hits now, so the Horde piles up and every swing cuts through a crowd
    const hp = mobHp(dnow()) * w * om().mobHp * (R.rift ? 1 : G.torment().mobHp * (land().mobHp || 1) * (G.runTide ? G.runTide() : 1)) * (K.hp || 1) * (G.SMALL[kind] ? TUNE.smallHp : kind === 'guardian' ? 1 : TUNE.bigHp) * (add || kind === 'guardian' ? 1 : evMul('mobHp'));
    const m = { id: ++R.mobUid, kind, w, hp: hp * (R.rift ? 1 : R.opHp || 1), max: hp * (R.rift ? 1 : R.opHp || 1), p, a: clamp01(a), sp: K.spd / (TUNE.mobWalk * rand(0.85, 1.15)), atkT: 0, add: !!add,
      // (3.6: the fields other code sets later, declared up front so every mob shares one shape and the loops over the
      // whole Horde stay fast)
      dead: false, gone: false, mod: null, name: null, stone: 0, br: 0, inv: null, move: null, held: 0, bit: null, kbAt: -9,
      chill: 0, chillK: 0, _cp: null, over: 0, crit: false, gild: 0, gob: 0, swarm: 0, por: 0, amb: 0, spit: 0, chg: 0, champ: 0, wl: 0,
      // ck: how many of the bodies the Horde was balanced at this one stands for (see crowdUpdate)
      ck: G.SMALL[kind] ? R.crowdK || 1 : 1, _ta: -1, _tc: 0, _ts: 0, _tg: 0 };
    if (kind === 'rare') {
      m.mod = pick(Object.keys(G.RARE_MODS));
      m.name = pick(RARE_A) + ' ' + pick(RARE_B);
      if (m.mod === 'hasted') m.sp *= 1.7;
    }
    // 2.3: champions carry a rare's affix too, more often the deeper (and the more Tormented) it gets
    if (kind === 'magic' && !add && dnow() >= 6 && chance(Math.min(0.85, 0.2 + 0.015 * dnow() + 0.05 * G.torment().n))) {
      m.mod = pick(Object.keys(G.RARE_MODS));
      if (m.mod === 'hasted') m.sp *= 1.7;
    }
    if (kind === 'brute' && land().stone) m.stone = 1;
    if (R.breach && R.breach.t > 0 && !add && kind !== 'guardian' && kind !== 'hoard') m.br = 1;
    // an invasion's mobs wear its colours and count toward holding it off
    if (R.inv && !add && kind !== 'hoard') m.inv = R.inv.k;
    R.mobs.push(m);
    if (!m.add) R.bornW = (R.bornW || 0) + w;
    emit('mobSpawn', m);
    if (G.NEW_KINDS && G.NEW_KINDS.includes(kind) && !add) { const sn = G.S.seen = G.S.seen || {}; sn.kinds = sn.kinds || {}; if (!sn.kinds[kind]) { sn.kinds[kind] = 1; emit('kindFirst', kind); } }
    return m;
  }
  // One pack, all from one direction
  G.makeMob = makeMob;
  // Which zone of its land the Horde is in (0-4, the 5th is the lord's)
  const zoneOf = d => ((d % G.REALM_SIZE) + G.REALM_SIZE) % G.REALM_SIZE;
  G.zoneOf = zoneOf;
  // The share of packs each archetype leads here: the zone's mix, bent by the land's rule
  function zoneMix(d) {
    const z = G.ZONE_MIX ? G.ZONE_MIX[G.ZONE_LOOK(zoneOf(d))] : null, L = land();
    if (!z) return {};
    return { runner: z.runner * (L.run || 1), spitter: z.spitter * (L.spit || 1), bomber: z.bomber * (L.bomb || 1), tank: z.tank * (L.tanky || 1) };
  }
  G.zoneMix = zoneMix;
  // One pack, all from one direction: a leader and a long tail of small fry
  // that streams in behind it (p below 0 is still off the arena)
  function spawnPack(add, at) {
    const d = dnow(), a = at != null ? at + rand(-0.04, 0.04) : G.rng(), roll = G.rng(), L = land();
    if (R.mobs.length >= crowdCap()) return;
    const room = () => R.mobs.length < crowdCap();
    // packs are thick: 1.4 times what they were, and more again for a Warden who outclasses the depth
    const more = add ? 1 : TUNE.packMul * Math.sqrt(Math.max(1, (R.hs || 1) / 1.5));
    const swarm = (kind, n, spread, tail) => { n = G.SMALL[kind] ? crowdN(n * more) : Math.round(n); for (let i = 0; i < n && room(); i++) makeMob(kind, a + rand(-spread, spread), -rand(0, tail || 0.3), add); };
    if (add) { swarm('fodder', randInt(30, 50), 0.08, 0.25); return; }
    const rc = 0.03 * om().champ * (L.rare || 1), mc = rc + 0.07 * om().champ * (L.champ || 1);
    if (d >= 1 && roll < rc) { emit('packIn', a, 'rare'); makeMob('rare', a, 0); swarm('fodder', 60, 0.08); emit('rareSpawn'); return; }
    if (roll < mc) { emit('packIn', a, 'magic'); makeMob('magic', a, 0); makeMob('magic', a + 0.03, -0.04); swarm('fodder', 40, 0.07); return; }
    // 2.5: from the second land, packs led by kinds the Hand alone can't handle, more of them the deeper it gets
    // (4.0: inside a Siege the kinds come with the land SLOT (how deep the run is), not with which land the route put there)
    const ri = siegeOn() ? Math.floor(Math.max(0, d) / G.REALM_SIZE) : G.realmIndex(d), nk = (G.NEW_KINDS || []).filter(k => ri >= G.ARCHETYPES[k].land);
    if (nk.length && G.rng() < Math.min(TUNE.newKindMax, TUNE.newKindBase + TUNE.newKindPer * d)) {
      const k = nk[Math.floor(G.rng() * nk.length)];
      emit('packIn', a, k);
      if (k === 'warded') { const n = randInt(3, 6); for (let i = 0; i < n; i++) makeMob('warded', a + rand(-0.05, 0.05), -rand(0, 0.1)); swarm('fodder', randInt(20, 35), 0.07); }
      else if (k === 'charger') { const n = randInt(2, 4); for (let i = 0; i < n; i++) makeMob('charger', a + rand(-0.06, 0.06), -rand(0, 0.15)); swarm('fodder', randInt(25, 40), 0.08); }
      else if (k === 'healer') { makeMob('healer', a, -0.05); makeMob('healer', a + 0.04, -0.1); makeMob('brute', a + 0.02, 0); swarm('fodder', randInt(35, 55), 0.08); }
      else { makeMob('summoner', a, -0.05); swarm('fodder', randInt(25, 40), 0.07); }
      return;
    }
    // the zone's own kinds
    const mix = zoneMix(d);
    let r2 = G.rng();
    for (const k of ['tank', 'bomber', 'spitter', 'runner']) {
      if (!(mix[k] > 0)) continue;
      if (r2 < mix[k]) {
        if (k === 'runner') { swarm('runner', randInt(14, 26), 0.05, 0.6); swarm('fodder', randInt(10, 20), 0.07); }
        else if (k === 'spitter') { const n = randInt(2, 3); for (let i = 0; i < n; i++) makeMob('spitter', a + rand(-0.05, 0.05), -rand(0, 0.08)); swarm('fodder', randInt(25, 40), 0.08); }
        else if (k === 'bomber') { swarm('fodder', randInt(35, 55), 0.08); const n = randInt(3, 6); for (let i = 0; i < n; i++) makeMob('bomber', a + rand(-0.06, 0.06), -rand(0, 0.3)); }
        else { makeMob('tank', a, 0); swarm('fodder', randInt(30, 45), 0.07, 0.4); }
        return;
      }
      r2 -= mix[k];
    }
    if (roll < 0.35) { makeMob('brute', a, 0); if (chance(0.4)) makeMob('brute', a + 0.03, -0.05); swarm('fodder', randInt(25, 40), 0.07); }
    else swarm('fodder', randInt(45, 90), 0.1, 0.35);
  }
  G.spawnPack = spawnPack;

  // Frontmost mobs first (they're about to bite), the tapped one before all.
  // reach limits how far from the Button the hero can strike.
  // (3.6: one pass that keeps the best n, in place of a filter and a sort of the whole Horde on every swing)
  const TB = [], TPR = [];
  function targets(n, reach) {
    const minP = reach ? (1 - reach) / 0.88 : -1, foc = R.focus;
    let k = 0, fm = null, focAlive = false;
    if (!(n > 0)) n = 0;
    const ms = R.mobs;
    for (let i = 0; i < ms.length; i++) {
      const m = ms[i];
      if (foc != null && m.id === foc) { if (!m.dead) focAlive = true; if (m.p >= minP && !m.gone) { fm = m; continue; } }
      if (!(m.p >= minP) || m.gone) continue;
      // Hoarders first, then heralds and Rift guardians, then whoever is closest
      const pr = m.p + (m.kind === 'hoard' ? 1 : m.kind === 'guardian' ? 0.6 : 0);
      if (k === n && !(pr > TPR[k - 1])) continue;
      let j = k < n ? k++ : k - 1;
      while (j > 0 && TPR[j - 1] < pr) { TB[j] = TB[j - 1]; TPR[j] = TPR[j - 1]; j--; }
      TB[j] = m; TPR[j] = pr;
    }
    if (foc != null && !fm && !focAlive) R.focus = null;
    const out = [];
    if (fm && n) out.push(fm);
    for (let i = 0; i < k && out.length < n; i++) out.push(TB[i]);
    for (let i = 0; i < k; i++) TB[i] = null;
    return out;
  }
  // Everything within r of any of the targets, except the targets themselves
  // (3.6: no arrays per mob, a box test before the distance, and the targets marked rather than searched)
  let tgStamp = 0;
  const CX = [], CY = [];
  function around(ts, r) {
    if (!(r > 0) || !ts.length) return [];
    const out = [], r2 = r * r, n = ts.length, st = ++tgStamp;
    let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
    for (let i = 0; i < n; i++) {
      const t = ts[i]; trig(t); t._tg = st;
      const rr = 1 - 0.88 * t.p, x = t._tc * rr, y = t._ts * rr;
      CX[i] = x; CY[i] = y;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    x0 -= r; x1 += r; y0 -= r; y1 += r;
    const ms = R.mobs;
    for (let j = 0; j < ms.length; j++) {
      const m = ms[j];
      if (m._tg === st) continue;
      trig(m);
      const rr = 1 - 0.88 * m.p, x = m._tc * rr, y = m._ts * rr;
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      for (let i = 0; i < n; i++) { const dx = x - CX[i], dy = y - CY[i]; if (dx * dx + dy * dy <= r2) { out.push(m); break; } }
    }
    return out;
  }
  G.mobsAround = around;
  // 3.6: a blow that sweeps the whole field rolls out from the Button over a few frames, as a ring, instead of landing
  // on every mob in one tick (an Overdrive pulse or a Skull Blast was a thousand hits and hundreds of deaths in a frame)
  //   G.fieldWave(dmg, src, { dur, guardK, minP }) : dmg to every mob the ring passes over (guardK: share for guardians)
  const WAVES = [], WLIST = [], WALK = [];
  G.fieldWave = function (dmg, src, o) {
    o = o || {};
    WAVES.push({ t: 0, dur: o.dur || 0.2, dmg, src, gk: o.guardK == null ? 1 : o.guardK, minP: o.minP == null ? -9 : o.minP, hit: new Set() });
  };
  function stepWaves(dt) {
    for (let i = WAVES.length - 1; i >= 0; i--) {
      const w = WAVES[i];
      w.t += dt;
      const reach = w.t >= w.dur ? 9 : 1.15 * w.t / w.dur, list = WLIST; list.length = 0;
      for (let j = 0; j < R.mobs.length; j++) list.push(R.mobs[j]);
      for (let j = 0; j < list.length; j++) {
        const m = list[j];
        if (m.dead || m.p < w.minP || w.hit.has(m) || 1 - 0.88 * m.p > reach) continue;
        w.hit.add(m);
        dealHit(m, m.kind === 'guardian' ? w.dmg * w.gk : w.dmg, w.src, false);
      }
      if (reach >= 9) WAVES.splice(i, 1);
    }
  }
  G.fieldWavesClear = () => { WAVES.length = 0; };
  // The Hand guards the Button: it strikes where the horde is thickest among
  // the mobs that got close
  function smiteTarget() {
    const front = targets(6, TUNE.smiteReach);
    if (R.focus && front[0] && front[0].id === R.focus) return front[0];
    let best = front[0], bn = -1;
    for (const m of front) { const n = around([m], TUNE.smiteR).length; if (n > bn) { bn = n; best = m; } }
    return best;
  }

  function farTarget() {
    const list = targets(10, 1);
    let best = list[0], bn = -1;
    for (const m of list) { const n = around([m], TUNE.smiteR).length; if (n > bn) { bn = n; best = m; } }
    return best;
  }
  function dealHit(m, dmg, src, crit) {
    if (m.dead) return;
    for (const f of G.HOOKS.hit) { const v = f(m, dmg, src, crit); if (v != null) dmg = v; if (m.dead) return; }
    if (uq('codex') && (m.kind === 'spitter' || m.kind === 'bomber')) dmg = m.hp + 1;
    else if (uq('tyrant') && (m.kind === 'tank' || m.kind === 'brute' || m.kind === 'magic')) dmg *= 2;
    // Warded: the Hand's lightning (clicks, pets, its chains, Smite) barely scratches it
    if (m.kind === 'warded' && (src === 'click' || src === 'pet' || src === 'chain' || src === 'smite')) { dmg *= TUNE.wardedTake; if (G.rng() < 0.05) emit('wardedHit', m); }
    m.hp -= m.mod === 'stone' || m.stone ? dmg * 0.5 : dmg;
    if (m.hp <= 0) { m.over = -m.hp / m.max; m.crit = crit; killMob(m, src); }
  }
  // Carnage: the kill streak pays. Kill fast enough that it never lapses and
  // gold and XP climb, up to +40%
  const CARN = [100, 300, 800, 2000];
  const carnTier = () => { let t = 0; while (t < CARN.length && R.carn >= CARN[t]) t++; return t; };
  G.carnage = () => { const t = carnTier(); return { n: R.carn, tier: t, mul: 1 + 0.1 * t, next: CARN[t] || 0 }; };
  // (3.4: small fry got lighter and more numerous; a kill's share of chests and plunder follows its weight)
  const FODK = m => (m.kind === 'fodder' ? G.MOB_KINDS.fodder.w / 0.0057 : 1);
  G.fodK = FODK;
  function killMob(m, src) {
    const S = G.S, D = G.D, h = S.hero, L = land();
    m.dead = true;
    for (const f of G.HOOKS.kill) f(m, src);
    // (3.6: kills count in the bodies the Horde was balanced at: a heavier small one counts for the several it stands for)
    R.kAcc = (R.kAcc || 0) + (m.ck || 1);
    const kn = Math.floor(R.kAcc); R.kAcc -= kn;
    if (!m.add) { const t0 = carnTier(); R.carn += kn; R.carnT = 0; if (R.carn > (S.st.bestStreak || 0)) S.st.bestStreak = R.carn; if (carnTier() > t0) emit('carnage', carnTier()); }
    const cm = 1 + 0.1 * carnTier();
    // (3.6: out of the list in one step: the last mob takes its place; the order of R.mobs means nothing, and
    // splicing out of the middle of a thousand bodies, hundreds of times in one AoE tick, was the cost of the spikes)
    const ms = R.mobs, i = ms.lastIndexOf(m);
    if (i >= 0) { const last = ms.pop(); if (i < ms.length) ms[i] = last; }
    const K = G.MOB_KINDS[m.kind];
    const gold = D.incomeRef * TUNE.mobGold * m.w * K.gold * (m.add ? 0.4 : 1) * (1 + 0.2 * perk('greed')) * (evo('midas') ? 2 : 1) * om().gold * (shrine('greed') ? 2 : 1) * cm * evMul('gold');
    G.addGold(gold, 'mob');
    gainXp(2.5 * (1 + dnow()) * m.w * (m.kind === 'rare' ? 1.5 : 1) * (m.br ? 1.5 : 1) * (shrine('slaughter') ? 2 : 1) * (D.xpMult || 1) * (L.xp || 1) * cm * evMul('xp'));
    h.kills += kn;
    if (G.landKill && !m.add && kn) G.landKill(m, kn);
    if (m.kind === 'magic' || m.kind === 'rare') h.elites++;
    if (m.kind === 'rare') {
      S.st.rares = (S.st.rares || 0) + 1;
      if (uq('headhunter')) { R.hb.hh = Math.min(60, Math.max(0, R.hb.hh || 0) + 20); G.dirty(); emit('headhunter', m); }
    }
    // 2.4: a Warden far too strong for the depth clears it faster (up to 3 times on new ground, 6 on a depth
    // already beaten), so the easy depths go by quickly and the fight is where you are really tested
    // (3.6: but never faster than the zone's own clock: a zone is fought for TUNE.zoneMin s of field time at least)
    if (!m.add && !R.rift) {
      // (and in the lord's zone, short of full while its Land Champion is still to come: js/champions.js)
      const cap = (G.D.bossNeed || 8) * (R.chPend ? Math.min(0.9, zoneShare()) : zoneShare());
      // (4.0: inside a Siege no boost for strength: the zone's clock and the Horde's schedule set the pace)
      if (S.bossMeter < cap) S.bossMeter = Math.min(cap, S.bossMeter + m.w * (siegeOn() ? 1 : G.clamp(mightRatio() / (TUNE.hordeRef * 2), 1, S.depth >= (S.bestDepth || 0) ? 3 : 6)));
    }
    let chest = null;
    if (G.lootKill) chest = G.lootKill(m, src);
    else if (!m.add) {
      // (without js/world.js, e.g. on the ladder server: the old loot bags)
      const greed = (R.hb.scroll > 0 ? 3 : 1) * (1 + 0.25 * perk('loot')) * (evo('midas') ? 1.5 : 1) * om().loot;
      const p = m.kind === 'rare' ? 1 : m.kind === 'magic' ? 0.4 * greed : TUNE.mobChest * m.w * greed;
      if (chance(p)) chest = dropBag(m);
    }
    // a chest spills out of the body now and then, where it fell
    if (!m.add && !R.rift && m.kind !== 'guardian' && G.spawnChest) {
      // by weight, so a pack split into more, smaller bodies drops the same
      const pc = TUNE.killChest * (G.SMALL[m.kind] ? m.w / G.MOB_KINDS[m.kind].w * FODK(m) * 0.7 : 1 + 20 * Math.min(6, m.w)) * evMul('chest') * (1 + 0.25 * perk('loot'));
      if (chance(Math.min(1, pc))) { R.dropAt = m; G.spawnChest(undefined, null, false, true); R.dropAt = null; }
    }
    // about one in two million: the JACKPOT
    if (!m.add && G.jackpotRoll) G.jackpotRoll(m, 'kill');
    // Plunder (4.0): a rare, a Land Champion or a Hoarder drops a chest where it falls, 20% a rank (not the blue champions
    // that come in pairs: measured, they made Plunder III ~20 chests a minute against the 2-4 a minute the Siege wants)
    if (perk('plunder') && !m.add && (m.kind === 'rare' || m.kind === 'hoard' || m.champ) && G.spawnChest && chance(TUNE.plunder * perk('plunder'))) {
      R.dropAt = m; const c = G.spawnChest(); R.dropAt = null;
      if (c) emit('plunder', m, c);
    }
    if (perk('leech')) h.hp = Math.min(D.heroHp, h.hp + D.heroHp * 0.003 * perk('leech') * (G.SMALL[m.kind] ? 0.3 : 4) * (evo('bloodpact') ? 4 : 1));
    if (uq('sporeheart')) h.hp = Math.min(D.heroHp, h.hp + D.heroHp * 0.004 * (G.SMALL[m.kind] ? 0.3 : 4));
    if (uq('reaper')) { R.reap = Math.min(40, R.reap + 1); R.reapT = 6; }
    if (kn) { G.questProgress('kills', kn); if (G.Journey) G.Journey.bountyKill(kn); }
    emit('mobDie', m, gold, chest, src);
    if (m.mod === 'splitter') spores(m, 22);
    else if (L.split && !m.add && (m.kind === 'brute' || m.kind === 'magic' || m.kind === 'tank') && chance(L.split)) { spores(m, 18); emit('spores', m); }
    // a bomber takes the pack around it along
    if (m.kind === 'bomber' && src !== 'bite') bomb(m);
    // Blasts: Hellstring's kills, the Pincer's critical kills, the Abyss's hellfire. They can chain, a little.
    const boom = uq('hellstring') && (src === 'auto' || src === 'chain') ? 0.6 : uq('ashbringer') && src === 'auto' ? 0.5 : uq('pincer') && m.crit ? 0.5 : L.boom && !m.add && chance(L.boom) ? 0.8 : 0;
    if (boom && (R.boomD || 0) < 3) blast(m, boom);
    if (R.rift && G.riftKill) G.riftKill(m);
    if (m.inv && G.invasionKill) G.invasionKill(m);
  }
  function spores(m, n) { n = crowdN(n); for (let k = 0; k < n && R.mobs.length < TUNE.mobMax; k++) makeMob('fodder', m.a + rand(-0.04, 0.04), m.p - rand(0, 0.08), m.add); }
  function bomb(m) {
    const near = around([m], TUNE.bombR).filter(o => !o.dead);
    emit('bomb', m, TUNE.bombR);
    R.boomD = (R.boomD || 0) + 1;
    if (R.boomD < 8) for (const o of near) dealHit(o, G.D.heroHit * TUNE.bombPow * (land().boomPow || 1), 'bomb', false);
    R.boomD--;
  }
  function blast(m, k) {
    const r = 0.13, near = around([m], r).filter(o => !o.dead);
    emit('blast', m, r);
    R.boomD = (R.boomD || 0) + 1;
    for (const o of near) dealHit(o, G.D.heroHit * k, 'blast', false);
    R.boomD--;
  }
  // Mobs drop loot bags where they fall (the stage reads R.dropAt to know where)
  function dropBag(m) {
    R.dropAt = m;
    const c = G.spawnChest();
    R.dropAt = null;
    if (c) c.bag = 1;
    return c;
  }
  function gainXp(x) {
    const S = G.S, h = S.hero;
    const before = h.lvl;
    h.xp += x;
    let up = false;
    while (h.xp >= xpNeed(h.lvl)) { h.xp -= xpNeed(h.lvl); h.lvl++; up = true; }
    if (up) {
      if (h.lvl > S.rec.maxLevel) S.rec.maxLevel = h.lvl;
      // 4.0: inside a Siege only the warm-up levels (TUNE.cardLevels: 2, 3, 4) bring a card (js/run.js G.cardGive; the
      // rest come one after every boss); a level still gives +5% and the Warden's ranks. Outside one, the 3.x way
      if (siegeOn() && G.cardGive) { for (let l = before + 1; l <= h.lvl; l++) if (TUNE.cardLevels.includes(l)) G.cardGive('level'); }
      else {
        h.perkPts = (h.perkPts || 0) + (h.lvl - before);
        if (!h.offer && offerOk()) offerPerks();
      }
      G.dirty(); G.recalc();
      // (4.0: a level-up heals the Button +5% (TUNE.levelHeal), not fully: light attrition)
      h.hp = Math.min(G.D.heroHp, h.hp + G.D.heroHp * TUNE.levelHeal);
      emit('levelUp', h.lvl);
      for (const x of G.RANKS) if (x.lv > before && x.lv <= h.lvl) emit('rankUp', x);
    }
  }
  G.gainXp = gainXp;

  // 3.6: may a set of cards come up now? (not in a boss fight or a march; one set per perkGap s after the first minutes)
  function offerOk() {
    if (R.boss || R.march) return false;
    // (and not on top of a big moment's start, or a Hoarder's or a shrine's: js/game.js G.director)
    if (G.director && G.director.state) { const d = G.director.state(); if (d.sinceLast < 3 || d.sinceSmall < 2) return false; }
    const t = G.S.st.playTime || 0;
    return t < TUNE.perkEarly || R.perkAt == null || t - R.perkAt >= TUNE.perkGap || t < R.perkAt;
  }
  G.perkOfferOk = offerOk;
  // (4.0: the perk bank (bankSpend: points past perkBank picked unseen) is deleted: every card is a choice the player sees)
  // the 3.x dealer (outside a Siege; inside one, js/run.js deals: G.cardGive / G.cardOffer)
  function offerPerks() {
    const h = G.S.hero;
    const open = Object.keys(G.PERKS).filter(k => perkOwn(k) < G.PERKS[k].max);
    const evos = evoReady().map(id => 'evo_' + id);
    if ((!open.length && !evos.length) || !(h.perkPts > 0)) { h.offer = null; h.perkPts = 0; return; }
    const pickN = evos.slice(0, 1);
    const want = Math.min(3, open.length + pickN.length);
    while (pickN.length < want) { const k = pick(open); if (!pickN.includes(k)) pickN.push(k); }
    h.offer = pickN; h.offerT = 0;
    R.perkAt = G.S.st.playTime || 0;
    if (G.director) G.director.mark('small');
    emit('perkOffer', pickN);
  }
  G.pickPerk = function (id) {
    const h = G.S.hero;
    // 4.0: inside a Siege the card on screen is the run's (js/run.js: its rarity adds 1-3 ranks; then the next card)
    if (siegeOn() && G.cardPick) return G.cardPick(id);
    if (!h.offer || !h.offer.includes(id)) return false;
    h.perks = h.perks || {};
    h.perks[id] = (h.perks[id] || 0) + 1;
    h.perkPts = Math.max(0, (h.perkPts || 1) - 1);
    h.offer = null;
    G.dirty(); G.recalc();
    if (id.startsWith('evo_')) {
      const first = !G.S.rec.evos[id.slice(4)];
      G.S.rec.evos[id.slice(4)] = 1;
      emit('evolve', id.slice(4), first);
    } else emit('perk', id, h.perks[id]);
    if (h.perkPts > 0 && offerOk()) offerPerks();
    return true;
  };

  // One attack of the hero's weapon. k scales it: clicks (the Hand's smite)
  // and pets fire partial volleys. Against a boss the hit lands on the boss
  // and the same swing cuts through its adds.
  function attack(k, src) {
    const D = G.D;
    if (!G.S.hero.cls) return;
    const wt = D.hero.wt;
    const reach = Math.min(1, wt.reach * (1 + 0.2 * perk('reach')));
    let ts, aoe = wt.aoe, sp = wt.sp;
    if (src === 'click') {
      // the Hand strikes the mob you tapped wherever it is, else the thickest pack near the Button, else the thickest anywhere
      const f = R.focus ? R.mobs.find(m => m.id === R.focus && !m.dead && !m.gone) : null;
      const t = f || (R.mobs.length ? smiteTarget() || farTarget() : null);
      ts = t ? [t] : []; aoe = TUNE.smiteR; sp = 0.5;
    }
    else if (src === 'pet') { ts = targets(1, 0.7); aoe = 0.05; sp = 1; }
    else { ts = targets(D.hero.targets + perk('multi') + (evo('rain') ? 3 : 0) + (uq('windripper') ? 2 : 0), reach); aoe = wt.aoe * (1 + 0.3 * perk('cleave')) * (evo('rain') ? 1.5 : 1); }
    // nothing in reach: the hero holds the swing for when something walks in
    if (!R.boss && !ts.length) return false;
    let crit = chance(D.hero.crit);
    if (src === 'auto' && uq('cleaver') && ++R.swing % 5 === 0) { crit = true; aoe *= 2; }
    let dmg = D.heroHit * k * (crit ? D.hero.critMult : 1);
    if (crit && uq('nightfang')) dmg *= 2;
    if (R.boss) {
      G.hitBoss(dmg * D.bossMult);
      emit('heroAttack', { boss: true, crit, src, dmg });
    }
    if (!ts.length) return true;
    const splash = around(ts, aoe);
    emit('heroAttack', { ids: ts.map(m => m.id), splash: splash.map(m => m.id), aoe, crit, src, dmg });
    // the Hand's knock-back: a nudge, lighter on the heavy ones and on the splash, and once in a while per mob,
    // so fast clicking slows the Horde but can't pin it away from the Button (3.5: it was a shove of up to 29%)
    if (src === 'click') {
      const now = G.S.st.playTime || 0;
      for (const m of ts.concat(splash)) {
        if (m.p <= -0.05 || now - (m.kbAt || -9) < TUNE.kbEvery) continue;
        m.kbAt = now;
        m.p = Math.max(-0.05, m.p - TUNE.kbPush / Math.sqrt(Math.max(0.25, m.w)) * (ts.includes(m) ? 1 : 0.5));
      }
    }
    for (const m of ts) dealHit(m, dmg, src, crit);
    for (const m of splash) dealHit(m, dmg * sp, src, crit);
    // Stormcaller: a bolt on another mob with every swing
    if (src === 'auto' && uq('stormcaller')) {
      const hit = new Set(ts.concat(splash)), cand = targets(10, reach).filter(m => !hit.has(m) && !m.dead);
      const t = cand.length ? cand[Math.floor(G.rng() * cand.length)] : null;
      if (t) { emit('chain', ts[0], [t]); dealHit(t, dmg * 0.8, 'chain', false); }
    }
    // Chain Lightning arcs from the first target to three more
    if (src === 'auto' && (perk('chain') || shrine('storm')) && (evo('storm') || shrine('storm') || chance(0.15 * perk('chain')))) {
      const from = ts[0], near = around([from], 0.4).filter(m => !m.dead).slice(0, evo('storm') ? 5 : 3);
      if (near.length) { emit('chain', from, near); for (const m of near) dealHit(m, dmg * 0.6, 'chain', false); }
    }
    // Heavy Hand: more bolts per click, each on a different pack
    // a full combo overcharges the Button: one more bolt per click
    const bolts = perk('thunder') + (evo('wrath') ? 3 : 0) + (uq('firsthand') ? 3 : 0) + om().thunder + (shrine('storm') ? 3 : 0) + (R.combo >= (D.comboCap || 1e9) ? 1 : 0);
    if (src === 'click' && bolts && !attack.inThunder) {
      attack.inThunder = true;
      for (let i = 0; i < bolts; i++) {
        const hitSet = new Set(ts.concat(splash));
        const cand = targets(8, TUNE.smiteReach).filter(m => !hitSet.has(m) && !m.dead);
        if (!cand.length) break;
        const t = cand[Math.floor(G.rng() * cand.length)], sp2 = around([t], TUNE.smiteR);
        emit('heroAttack', { ids: [t.id], splash: sp2.map(m => m.id), aoe: TUNE.smiteR, crit, src, dmg, extra: true });
        dealHit(t, dmg, src, crit); for (const m of sp2) dealHit(m, dmg * 0.5, src, crit);
      }
      attack.inThunder = false;
    }
    // The Last Button: every click strikes twice
    if (src === 'click' && uq('lastbutton') && !attack.twice) { attack.twice = true; attack(k, src); attack.twice = false; }
    return true;
  }
  G.heroVolley = attack;

  G.hurtButton = d => hurtButton(d);
  // The party's clock: the fallen get up, the cleric mends, companions fight, the Button pulses
  function partyTick(dt, regen) {
    const S = G.S, D = G.D, h = S.hero;
    const units = G.partyUnits();
    const cleric = G.reviveRate() > 1;
    for (const u of units) {
      if (u.down > 0) { const left = unitDown(u.who, u.down - dt * (cleric ? 3 : 1)); if (left <= 0) reviveUnit(u.who, 0.4); }
      else unitHp(u.who, Math.min(u.max, u.hp + u.max * regen * dt));
    }
    // a broken Button mends on its own
    if (R.btnDown > 0 && (R.btnDown -= dt) <= 0) { R.btnDown = 0; h.hp = Math.max(h.hp, D.heroHp * 0.5); emit('buttonFixed'); }
    // clerics heal whoever is worst off, the Button included (a cleric Warden too)
    // (4.0: a Medic companion heals half again)
    const healFrom = src => {
      const hk = src >= 0 && D.party[src] ? D.party[src].heal || 1 : 1;
      let best = null, bk = 0.98;
      for (const u of G.partyUnits()) if (!(u.down > 0) && u.hp / u.max < bk) { bk = u.hp / u.max; best = u.who; }
      if (!(R.btnDown > 0) && h.hp / D.heroHp < bk) { bk = h.hp / D.heroHp; best = 'button'; }
      if (best === 'button') { h.hp = Math.min(D.heroHp, h.hp + D.heroHp * TUNE.healPct * 1.5 * hk); emit('heal', src, 'button'); }
      else if (best != null) { unitHp(best, Math.min(unitMax(best), unitHp(best) + unitMax(best) * TUNE.healPct * (1 + 0.1 * Math.min(10, h.lvl / 5)) * hk)); emit('heal', src, best); }
    };
    if (G.ROLES[h.cls] === 'heal' && !(h.wdown > 0) && (h.healT = (h.healT || 0) - dt) <= 0) { h.healT = TUNE.healEvery; healFrom(-1); }
    S.party.forEach((m, i) => {
      if (m.down > 0) return;
      const P = D.party[i];
      if (!P) return;
      if (P.role === 'heal' && (m.healT = (m.healT || 0) - dt) <= 0) { m.healT = TUNE.healEvery; healFrom(i); }
      // companions attack on their own
      m.acc = (m.acc || 0) + dt * P.rate;
      let guard = 0;
      while (m.acc >= 1 && guard++ < 8) { if (!allyAttack(i, P)) { m.acc = 1; break; } m.acc -= 1; }
    });
    // the Button fights back: a shockwave now and then around it
    if (!(R.btnDown > 0) && (R.pulseT = (R.pulseT == null ? TUNE.pulseEvery : R.pulseT) - dt) <= 0) {
      R.pulseT = TUNE.pulseEvery;
      const near = R.mobs.filter(m => !m.dead && 1 - 0.88 * m.p < 0.3);
      if (near.length || R.boss) {
        emit('buttonPulse');
        const dmg = (D.heroHit || 1) * 2;
        for (const m of near) dealHit(m, dmg, 'pulse', false);
        if (R.boss) G.hitBoss(dmg * 0.5);
      }
    }
  }
  // One swing of a companion's weapon
  function allyAttack(i, P) {
    const wt = P.c.wt, reach = Math.min(1, wt.reach * (1 + 0.2 * perk('reach')));
    const ts = targets(P.c.targets + perk('multi'), reach);
    if (!R.boss && !ts.length) return false;
    const crit = chance(P.c.crit);
    const dmg = P.hit * (crit ? P.c.critMult : 1);
    if (R.boss) G.hitBoss(dmg * G.D.bossMult);
    if (!ts.length) { emit('allyAttack', { i, boss: true, crit, dmg }); return true; }
    const splash = around(ts, wt.aoe * (1 + 0.3 * perk('cleave')));
    emit('allyAttack', { i, ids: ts.map(m => m.id), splash: splash.map(m => m.id), aoe: wt.aoe, crit, dmg, wt: P.c.wtype });
    for (const m of ts) dealHit(m, dmg, 'ally', crit);
    for (const m of splash) dealHit(m, dmg * wt.sp, 'ally', crit);
    return true;
  }
  function hurtButton(dmg) {
    const h = G.S.hero;
    if (R.stun > 0 || R.btnDown > 0) return;
    if (R.ward > 0) { emit('warded', 'button'); return; }
    h.hp -= dmg;
    emit('buttonHurt', dmg);
    if (h.hp <= 0) breakButton();
  }
  // A broken Button is out for a while: no gold, no lightning. The party fights on around it;
  // if they all fall before it mends, the Horde breaks through (wipe)
  function breakButton() {
    const h = G.S.hero;
    h.hp = 0;
    R.btnDown = TUNE.btnDown;
    G.S.st.breaks = (G.S.st.breaks || 0) + 1;
    emit('buttonBreak');
    checkWipe();
  }

  function castAbility() {
    const S = G.S, D = G.D, h = S.hero;
    const g = h.eq.ability;
    if (!g || R.abilCd > 0 || !h.cls || R.town || (G.runHeld && G.runHeld())) return false;
    const type = G.ITEM_TYPE[g.id], ab = G.ABILITIES[type];
    R.abilCd = ab.cd * (1 - Math.min(0.5, 0.03 * g.e)) * (uq('watcher') ? 0.5 : 1);
    const hit = D.heroHit;
    switch (type) {
      case 'potion': h.hp = Math.min(D.heroHp, h.hp + D.heroHp * 0.6); for (const u of G.partyUnits()) if (!(u.down > 0)) unitHp(u.who, Math.min(u.max, u.hp + u.max * 0.5)); break;
      case 'tome': h.hp = Math.min(D.heroHp, h.hp + D.heroHp * 0.3); for (const u of G.partyUnits()) if (!(u.down > 0)) unitHp(u.who, Math.min(u.max, u.hp + u.max * 0.3)); R.hb.tome = 6; break;
      case 'scroll': R.hb.scroll = 12; break;
      case 'orb': R.hb.orb = 6; break;
      case 'wing': R.hb.wing = 8; break;
      case 'skull':
        if (R.boss) G.hitBoss(hit * 8 * D.bossMult);
        G.fieldWave(hit * 8, 'ability', { dur: 0.25 });
        break;
      case 'egg':
        if (R.boss) G.hitBoss(hit * 15 * D.bossMult);
        else { const t = targets(1)[0]; if (t) dealHit(t, hit * 11, 'ability'); }
        G.fieldWave(hit * 4, 'ability', { dur: 0.25 });
        break;
    }
    G.dirty(); G.recalc();
    emit('ability', type);
    return true;
  }
  G.castAbility = castAbility;

  G.heroTick = function (dt) {
    const S = G.S, D = G.D, h = S.hero;
    if (!h || !h.cls) return;
    for (const f of G.HOOKS.tick) f(dt);
    if (WAVES.length) stepWaves(dt);
    // ability buffs
    let changed = false;
    for (const k in R.hb) { if (R.hb[k] > 0) { R.hb[k] -= dt; if (R.hb[k] <= 0) changed = true; } }
    if (changed) { G.dirty(); G.recalc(); }
    if (R.abilCd > 0) R.abilCd -= dt;
    if (R.stun > 0) R.stun -= dt;
    // the zone's clock: field time, not a boss fight, a march or a Rift
    if (!R.boss && !R.march && !R.rift) R.zoneT = (R.zoneT || 0) + dt;
    R.runT = (R.runT || 0) + dt;
    crowdUpdate();
    if (R.reapT > 0 && (R.reapT -= dt) <= 0) { R.reap = 0; G.dirty(); }
    if (R.carn && (R.carnT += dt) > 2.5) { R.carn = 0; emit('carnage', 0); }
    // regen: slow, slower still with a boss on the field, so a fight can be lost
    const regen = R.boss ? TUNE.regenBoss : TUNE.regen;
    if (!(R.btnDown > 0)) h.hp = Math.min(D.heroHp, h.hp + D.heroHp * regen * dt);
    partyTick(dt, regen);
    // the horde: a steady flow of packs, with a surge every half a minute (3.4: none while the party marches on)
    if (R.stun <= 0 && !R.march) {
      if (R.boss) {
        R.hordeAcc = Math.min(3, R.hordeAcc + dt * TUNE.hordeRate * TUNE.addRate * (R.boss.lord ? 1.6 : 1) * (R.boss.rage ? 2 : 1));
        if (R.hordeAcc >= 1 && aliveWeight(true) < 2) { R.hordeAcc -= 0.5; spawnPack(true); }
      } else {
        if (R.surge > 0) R.surge -= dt;
        else if ((R.surgeT -= dt) <= 0) { R.surgeT = TUNE.surgeEvery * rand(0.8, 1.2); R.surge = TUNE.surgeLen * (land().surge || 1); emit('surge'); }
        const surging = R.surge > 0;
        R.hs = hordeScale();
        // 3.5: past the Horde's biggest size, an outgrown depth's mobs get tougher with the party, so they still reach the Button
        // (4.0: not inside a Siege: 1)
        R.opHp = siegeOn() ? 1 : Math.pow(Math.max(1, mightRatio() / (TUNE.hordeRef * TUNE.opFrom)), TUNE.opHpPow);
        const thick = om().horde * (R.rift ? 1.5 : G.torment().horde) * (R.inv ? 1.8 : 1) * (shrine('slaughter') ? 2.5 : 1) * (land().thick || 1) * (surging ? TUNE.surgeMul * (land().surge || 1) : 1);
        R.hordeAcc = Math.min(4 * R.hs, R.hordeAcc + dt * TUNE.hordeRate * R.hs * thick);
        const cap = hordeCap(dnow()) * Math.max(1, R.hs / 1.5) * (surging ? 1.5 : 1) * (R.rift || shrine('slaughter') ? 1.5 : 1);
        // each zone is fought in three waves; the second and third open with champions and a rush
        if (!R.rift && G.D.bossNeed) {
          const wv = Math.min(2, Math.floor(3 * S.bossMeter / G.D.bossNeed));
          // after a load the waves already crossed stay crossed
          if (R.wave == null || wv < R.wave) R.wave = wv;
          else if (wv > (R.wave | 0)) {
            R.wave = wv;
            const at = G.rng();
            makeMob('magic', at, 0); makeMob('magic', at + 0.04, -0.05);
            spawnPack(false, (at + 0.5) % 1); spawnPack(false, (at + 0.25) % 1);
            R.surge = Math.max(R.surge, TUNE.surgeLen * 0.8);
            emit('wave', wv + 1);
          }
        }
        // the arena is never empty: fewer than minCrowd on the field brings the next pack now
        const minC = Math.min(TUNE.minCrowd, Math.round(crowdCap() * 0.6));
        if (R.hordeAcc < 1) { let vis = 0; for (const m of R.mobs) if (!m.add && m.p >= 0 && ++vis >= minC) break; if (vis < minC) R.hordeAcc = 1; }
        // (3.6: one pass for the weight on the field; what the pack brings is counted as it is born, see makeMob)
        if (R.hordeAcc >= 1 && R.mobs.length < crowdCap() && aliveWeight(false) < cap) {
          const w0 = R.bornW || 0;
          spawnPack(false);
          R.hordeAcc -= Math.max(0.5, (R.bornW || 0) - w0);
        }
      }
    }
    // walk & bite
    const slow = (R.hb.orb > 0 ? 0.4 : 1) * (uq('frostwalk') ? 0.65 : 1) * (land().slow || 1) * (land().speed || 1) * evMul('speed');
    // 2.2: a bite is never nothing: its depth's damage, or a sliver of the Button's health per unit of weight
    // (4.0: a Hexed land or a Greed Pact bites harder; the Push's Tide too)
    const atk = Math.max(mobAtk(dnow()), (D.heroHp || 0) * TUNE.biteFloor) * evMul('bite') * (R.rift ? 1 : G.torment().bite * (land().bite || 1) * (G.runTide ? G.runTide() : 1));
    // the tank's line this tick
    const tk = R.boss || !(G.S.party && G.S.party.length) ? null : tankUp(); let blocked = 0; const tkA = R.tankA == null ? 0.5 : R.tankA;
    if (tk) stepTank(dt);
    // (a copy, as mobs die and are born in the loop; 3.6: into one array kept for it, not a new one every tick)
    const walk = WALK; walk.length = 0; for (let i = 0; i < R.mobs.length; i++) walk.push(R.mobs[i]);
    for (let wi = 0; wi < walk.length; wi++) {
      const m = walk[wi];
      if (m.dead) continue;
      if (m.move && G.moveMob) { G.moveMob(m, dt); continue; }
      // 2.5: menders and callers hold at range; chargers break into a run once they're close
      if (m.kind === 'healer' || m.kind === 'summoner') {
        if ((m.atkT -= dt) <= 0 && m.p >= 0.2) {
          if (m.kind === 'healer') {
            m.atkT = TUNE.healerEvery * rand(0.85, 1.15);
            const [hx, hy] = mobXY(m); let n = 0;
            for (const o of R.mobs) { if (o === m || o.dead || o.hp >= o.max) continue; const [ox, oy] = mobXY(o); if ((ox - hx) ** 2 + (oy - hy) ** 2 < 0.07) { o.hp = Math.min(o.max, o.hp + o.max * TUNE.healerPct); n++; } }
            if (n) emit('mend', m, n);
          } else {
            m.atkT = TUNE.callEvery * rand(0.85, 1.15);
            for (let i = 0, cn = crowdN(TUNE.callN); i < cn && R.mobs.length < TUNE.mobMax; i++) makeMob('fodder', m.a + rand(-0.03, 0.03), m.p - rand(0.05, 0.15), true);
            emit('call', m);
          }
        }
        if (m.p >= (m.kind === 'healer' ? 0.5 : 0.42)) continue;
      }
      if (m.kind === 'charger' && !m.chg && m.p >= 0.38) { m.chg = 1; m.sp *= TUNE.chargeSpd; emit('charge', m); }
      // spitters lob globs at the Button as soon as they're in range, then hold there
      if (m.kind === 'spitter' && m.p >= 0.3) {
        if (!m.spit) { m.spit = 1; m.atkT = rand(0.3, 0.9); }
        if ((m.atkT -= dt) <= 0) { m.atkT = TUNE.spitEvery * rand(0.85, 1.15); R.shots.push({ m: m.id, a: m.a, p: m.p, t: 0.5, dmg: atk * m.w * (m.mod === 'frenzied' ? 2 : 1) }); emit('spit', m); }
        if (m.p >= TUNE.spitStop) continue;
      }
      // the tank's line: mobs in its arc stop there and fight it (a few dozen at most; the rest slip by)
      if (tk && blocked < TUNE.tankHold * (0.4 + 0.2 * G.S.party.length) && m.p >= TUNE.tankP && Math.abs(m.a - tkA) < TUNE.tankArc && m.kind !== 'bomber' && m.kind !== 'spitter' && m.kind !== 'hoard' && m.kind !== 'guardian' && !m.gob) {
        blocked++; m.p = TUNE.tankP; m.held = 1;
        // (a held mob swings at the tank's shield: half as often as at the Button)
        if ((m.atkT -= dt) <= 0) {
          m.atkT = TUNE.tankBiteEvery;
          let bd = atk * m.w * (m.mod === 'frenzied' ? 2 : 1) * (evo('bastion') ? 0.7 : 1);
          for (const f of G.HOOKS.bite) { const x = f(m, tk.who, bd); if (x != null) bd = x; }
          m.bit = tk.who; hitParty(tk.who, bd, 'bite'); emit('mobBite', m, tk.who);
          if (R.stun > 0) break;
        }
        continue;
      }
      m.held = 0;
      if (m.p < 1) m.p = Math.min(1, m.p + m.sp * dt * slow);
      else if (m.kind === 'bomber') {
        // a bomber that reaches the Button goes off on it
        hitParty(victim(), atk * m.w * 6 * (evo('bastion') ? 0.7 : 1), 'bomb'); emit('bomberPop', m);
        m.dead = true; const i = R.mobs.indexOf(m); if (i >= 0) R.mobs.splice(i, 1);
        emit('mobFlee', m);
        if (R.stun > 0) break;
      } else {
        m.atkT -= dt;
        if (m.atkT <= 0) {
          m.atkT = 1;
          if (uq('othercloak') && m.kind !== 'guardian' && m.kind !== 'rare' && chance(1 / 3)) { emit('thorns', m); dealHit(m, 2 * m.hp + 1, 'thorns', false); continue; }
          const v = victim(); m.bit = v;
          let bd = atk * m.w * (m.mod === 'frenzied' ? 2 : 1) * (evo('bastion') ? 0.7 : 1);
          for (const f of G.HOOKS.bite) { const x = f(m, v, bd); if (x != null) bd = x; }
          hitParty(v, bd, 'bite'); emit('mobBite', m, v);
          if (uq('voidplate') && !m.dead) { emit('thorns', m); dealHit(m, D.heroHit * 10, 'thorns', false); }
          if (R.stun > 0) break;
        }
      }
    }
    // globs in flight
    // (a glob can break the Button, which clears the list under this loop)
    for (let i = R.shots.length - 1; i >= 0; i--) {
      const sh = R.shots[i];
      if (!sh) continue;
      if ((sh.t -= dt) <= 0) { R.shots.splice(i, 1); if (R.stun <= 0) { const v = sh.v != null ? sh.v : victim(); hitParty(v, sh.dmg, 'spit'); emit('spitHit', sh, v); } if (R.stun > 0) break; }
    }
    // the boss hits the button too
    if (R.boss) {
      R.bossAtkT -= dt;
      if (R.bossAtkT <= 0) {
        const b = R.boss, v = victim();
        // enraged: twice as often, and harder with every second of it (1.5 to 3 times; no blow takes more than
        // 35% of what it hits, so it hurries the fight rather than ending it at once)
        const enr = b.enr > 0 ? 1.5 + 1.5 * (1 - b.enr / (b.enrT || 1)) : 1;
        R.bossAtkT = 2 / (1 + 0.25 * ((b.phase || 1) - 1)) / (b.enr > 0 ? 2 : 1) / (G.bossHas(b, 'hasted') ? 1.4 : 1);
        emit('bossHit', b, v);
        // (3.0: the first two lords, the walls most players meet first, hit a third softer)
        const fr = (G.bossHas(b, 'frenzied') ? 1.5 : 1) * (b.lord && b.d < 10 && !R.rift ? 0.65 : 1);
        G.blowParty(v, atk * (b.lord ? 4 : 2.5) * (b.rage ? 1.5 : 1) * enr * fr, Math.min(0.35, (b.lord ? 0.12 : 0.09) * (b.rage ? 1.5 : 1) * enr * fr), 'boss');
        // Vampiric: every blow that lands feeds it
        if (G.bossHas(b, 'vampiric') && R.boss === b && !(R.ward > 0)) { b.hp = Math.min(b.max, b.hp + b.max * (b.lord ? 0.012 : 0.02)); emit('bossLeech', b); }
      }
    }
    // perks that work on their own
    const hit = D.heroHit;
    if (perk('blades') && (R.bladeT = (R.bladeT || 0) - dt) <= 0) {
      R.bladeT = 0.45;
      const storm = evo('bladestorm'), outer = storm ? 0.46 : 0.36;
      const band = R.mobs.filter(m => { const r = 1 - 0.88 * m.p; return r > 0.1 && r < outer; });
      for (let i = 0; i < G.bladeCount(); i++) {
        if (R.boss && i === 0) G.hitBoss(hit * (storm ? 0.5 : 0.25) * D.bossMult);
        const m = band.length ? band[Math.floor(G.rng() * band.length)] : null;
        if (m && !m.dead) { emit('bladeHit', m); dealHit(m, hit * (storm ? 0.9 : 0.6), 'blade', false); }
      }
    }
    if (perk('aura') && (R.auraT = (R.auraT || 0) - dt) <= 0) {
      R.auraT = 0.5;
      const sanct = evo('sanctuary');
      const burn = hit * 0.18 * perk('aura') * (sanct ? 2 : 1);
      const near = R.mobs.filter(m => 1 - 0.88 * m.p < (sanct ? 0.4 : 0.3));
      if (sanct) h.hp = Math.min(D.heroHp, h.hp + D.heroHp * 0.01);
      if (near.length) emit('auraTick', near);
      for (const m of near) dealHit(m, burn, 'aura', false);
    }
    if (perk('nova') && (R.novaT = (R.novaT == null ? 6 : R.novaT) - dt) <= 0) {
      const sn = evo('supernova');
      R.novaT = sn ? 3 : 7.5 - perk('nova');
      const rad = sn ? 0.65 : 0.5, pow = sn ? 4 : 2.5;
      const near = R.mobs.filter(m => 1 - 0.88 * m.p < rad);
      emit('nova', rad);
      for (const m of near) dealHit(m, hit * pow, 'nova', false);
      if (R.boss) G.hitBoss(hit * pow * D.bossMult);
    }
    // a pending level-up choice is made for the player if they leave it (outside a Siege: inside one the card holds the
    // field and js/run.js runs its timer)
    // (the clock stops while a window covers the cards, so they can't be picked for you unseen)
    if (!siegeOn()) {
      if (h.offer && !(G.uiBusy && G.uiBusy()) && (h.offerT = (h.offerT || 0) + dt) > TUNE.perkAuto && h.autoPerk) G.pickPerk(G.autoPerk(h.offer));
      if (!h.offer && h.perkPts > 0 && offerOk()) offerPerks();
    }
    // hero attacks
    R.heroAcc += h.wdown > 0 ? 0 : dt * D.heroRate;
    let guard = 0;
    while (R.heroAcc >= 1 && guard++ < 30) {
      if (!attack(1, 'auto')) { R.heroAcc = 1; break; }
      R.heroAcc -= 1;
    }
    // autocast
    if (h.cast && R.abilCd <= 0 && h.eq.ability) {
      const type = G.ITEM_TYPE[h.eq.ability.id];
      const want = type === 'potion' ? h.hp < D.heroHp * 0.5
        : type === 'tome' ? (h.hp < D.heroHp * 0.7 || R.boss)
        : R.boss || aliveWeight(false) >= 3;
      if (want) castAbility();
    }
  };
  G.aliveWeight = () => aliveWeight(false);

  // Away from the screen the Warden keeps fighting at the offline pace: XP and
  // levels (the perk picks wait for the player's return) and some shards.
  G.heroOffline = function (t) {
    const S = G.S, h = S.hero, D = G.D;
    // (4.0: time away never advances a Siege)
    if (!h || !h.cls || siegeOn()) return null;
    const w = t * TUNE.hordeRate * hordeScale() * (D.offEff || 0.5);
    const lvl0 = h.lvl;
    // a quarter of the active XP rate, and no more than 5 levels per return
    let room = -h.xp;
    for (let l = h.lvl; l < h.lvl + 5; l++) room += xpNeed(l);
    gainXp(Math.min(room - 1, 2.5 * (1 + S.depth) * w * 0.25 * (D.xpMult || 1)));
    const shards = Math.floor(w * 0.4 * (D.shardMult || 1));
    const kills = Math.round(w / 0.02);
    h.shards += shards; // the report counts kills, but only real fights count toward goals
    return { kills, levels: h.lvl - lvl0, perks: h.perkPts || 0, shards };
  };

  G.heroBossStart = function () {
    WAVES.length = 0;
    // 3.6: a set of cards on screen waits out the fight (it comes back, fresh, once the march is over)
    const h = G.S.hero;
    if (h && h.offer && !siegeOn()) { h.offer = null; h.offerT = 0; emit('perkHold'); }
    for (const m of R.mobs) emit('mobFlee', m);
    R.mobs.length = 0; if (R.shots) R.shots.length = 0;
    R.bossAtkT = 2; R.hordeAcc = 0.5; R.surge = 0; R.zoneT = 0;
  };
  // A slain boss takes its adds with it; a boss that leaves takes them away
  G.heroBossEnd = function (win) {
    for (const m of R.mobs) { m.dead = true; if (win) { m.over = 2; emit('mobDie', m, 0, null, 'boss'); } else emit('mobFlee', m); }
    R.mobs.length = 0; if (R.shots) R.shots.length = 0;
    R.hordeAcc = 0; R.surgeT = Math.max(R.surgeT, 12);
  };
  G.heroReset = function (keepClass) {
    const h = G.S.hero;
    h.lvl = 1; h.xp = 0;
    h.perks = {}; h.perkPts = 0; h.offer = null;
    if (!keepClass) h.cls = null;
    if (G.worldReset) G.worldReset();
    R.mobs.length = 0; if (R.shots) R.shots.length = 0; R.hb = {}; R.abilCd = 0; R.stun = 0; R.hordeAcc = 0; R.surge = 0; R.surgeT = 20; R.reap = 0; R.rift = null; R.zoneT = 0; R.runT = 0; WAVES.length = 0;
    G.S.rec.runStart = Date.now(); G.S.rec.runPlay = G.S.st.playTime;
    R.btnDown = 0; h.wdown = 0;
    for (const m of G.S.party) { m.down = 0; m.acc = 0; }
    G.dirty(); G.recalc();
    h.hp = G.D.heroHp || TUNE.baseHp;
    h.whp = G.D.wardenHp || TUNE.baseHp;
    G.S.party.forEach((m, i) => { m.hp = (G.D.party[i] || {}).hp || TUNE.baseHp; });
  };

  // ---------- Ladder snapshot ----------
  // A compact, canonical description of the character. A future ladder server
  // recomputes power from this with the same combat() code, so a client
  // can't just send a big number.
  // the Warden's worn gear in the snapshot's canonical form
  G.gearSnapshot = function () {
    const h = G.S.hero, gear = {};
    for (const s of G.SLOTS) { const g = h.eq[s]; gear[s] = g ? Object.assign({ id: g.id, r: g.r, il: g.il, e: g.e, a: g.a }, g.c ? { c: 1 } : {}, g.q ? { q: g.q } : {}) : null; }
    return gear;
  };
  // 4.0 (DESIGN §12): the ladder sees the best run (S.rec.bestRun: its class, level and the gear worn at its deepest point,
  // js/run.js), so a run's end never lowers a row; before the first one, the live Warden
  G.ladderSnapshot = function () {
    const S = G.S, h = S.hero, br = S.rec && S.rec.bestRun && S.rec.bestRun.gear && G.CLASS_BY_ID[S.rec.bestRun.cls] ? S.rec.bestRun : null;
    const gear = br ? br.gear : G.gearSnapshot();
    const rf = S.rift || {}, today = rf.day && rf.day.k === G.utcDayKey() ? { k: rf.day.k, l: rf.day.l | 0, t: rf.day.t | 0 } : null;
    // crown times are at least 0.1s (a lord can die on the tick it appears)
    const cr = {};
    for (const k in S.rec.crowns || {}) cr[k] = Math.max(0.1, +S.rec.crowns[k] || 0.1);
    const snap = {
      // the best level reached, so ascending (which starts the level over) doesn't sink you on the ladder
      // v2: 2.0 and later, where depths 65-74 are the Moon and the Star Sea
      v: 2, ss: G.WIPE || 1, name: (S.profile.name || '').slice(0, 16), cls: br ? br.cls : h.cls, lvl: br ? br.lvl | 0 || 1 : Math.max(h.lvl, Math.min(S.rec.maxLevel || 1, 60 + 2 * Math.max(S.bestDepth, G.riftDepth(rf.best | 0)))),
      depth: S.bestDepth, asc: S.ascensions, fame: S.fameTotal, mad: Math.round(S.rec.madTime || 0), gear, ts: Date.now(),
      rift: rf.best | 0, rt: Math.round(rf.bestT || 0), rd: today, uq: Object.keys(S.uq || {}).length, kills: h.kills | 0, ls: G.starCount ? G.starCount() : 0,
      ev: (S.feed || []).slice(-6), fs: Object.assign({}, S.rec.firsts || {}), cr,
    };
    snap.power = G.ladderPower(snap);
    return snap;
  };

  // Ladder power: gear, level and class only, with neutral global bonuses,
  // so every client and the server compute the same number from a snapshot.
  const NEUTRAL = { crit: 0.03, critMult: 3, spdMult: 1, heroMult: 1, hpMult: 1 };
  G.ladderPower = function (snap) {
    const eq = {};
    for (const s of G.SLOTS) eq[s] = snap.gear && snap.gear[s] ? snap.gear[s] : null;
    return combat(eq, NEUTRAL, { cls: snap.cls, lvl: snap.lvl }).power;
  };

  // Plausibility check for a snapshot from someone else's client (or a
  // server request). Returns the list of problems; empty means it passes.
  G.verifySnapshot = function (snap) {
    const bad = [];
    const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
    if (!snap || typeof snap !== 'object') return ['shape'];
    if (!G.CLASS_BY_ID[snap.cls]) bad.push('class');
    if (!int(snap.depth, 0, 100000)) bad.push('depth');
    if (snap.rift != null && !int(snap.rift, 0, 100000)) bad.push('rift');
    // Rifts go deeper than the campaign, and their loot comes from there
    const reach = Math.max(snap.depth | 0, G.riftDepth(snap.rift | 0));
    // gear can come from a Rift above your best clear: a clear opens up to 6 levels past it
    const lootReach = Math.max(reach, (snap.rift | 0) > 0 ? G.riftDepth((snap.rift | 0) + 6) : 0);
    // levels come from kills, so a patient player can outlevel their depth by a lot; this only stops the absurd
    if (!int(snap.lvl, 1, 60 + 2 * reach)) bad.push('level');
    // depth has to go with gear: mob health grows 60% a depth, so a Warden this weak could never have got there.
    // The weakest honest player measured stays a million times above this line.
    if (reach >= 20) { const need = G.mobHp(reach); if (!isFinite(need) || !(snap.power > 0) || snap.power / need < 1e-12) bad.push('depth'); }
    if (typeof snap.name !== 'string' || snap.name.length > 16) bad.push('name');
    if (snap.uq != null && !int(snap.uq, 0, G.UNIQUE_IDS.length)) bad.push('uniques');
    if (snap.kills != null && !int(snap.kills, 0, 1e12)) bad.push('kills');
    // land stars: three per land, and only in lands this Warden has reached
    if (snap.ls != null && !(int(snap.ls, 0, 3 * G.REALMS.length) && snap.ls <= 3 * Math.min(G.REALMS.length, Math.floor(reach / G.REALM_SIZE) + 1))) bad.push('stars');
    if (snap.rd != null && (typeof snap.rd !== 'object' || typeof snap.rd.k !== 'string' || snap.rd.k.length > 12 || !int(snap.rd.l, 0, snap.rift | 0) || (snap.rd.t != null && !int(snap.rd.t, 0, 600)))) bad.push('today');
    if (snap.mad != null && snap.mad !== 0 && !(int(snap.mad, 60, 1e9) && (snap.depth | 0) >= 40)) bad.push('mad');
    const numMap = (o, n) => o == null || (typeof o === 'object' && !Array.isArray(o) && Object.keys(o).length <= n && Object.keys(o).every(k => k.length <= 8 && typeof o[k] === 'number' && o[k] > 0));
    // firsts: known milestones only, dated after the release and not in the future, and actually reached
    const FS = { boss: 0, d5: 0, d10: 0, d20: 0, d30: 0, d40: 0, d50: 0, d60: 0, d65: 0, d75: 0, d80: 0, uq: 0, r4: 0, r5: 0, r6: 0, asc: 0, evo: 0, all14: 0,
      rift5: 0, rift15: 0, rift30: 0, rift45: 0, rift60: 0, rift80: 0, jp: 0 };
    const fsOk = k => {
      const v = snap.fs[k];
      if (!(k in FS) || v < 1.75e12 || (typeof snap.ts === 'number' && v > snap.ts + 864e5)) return false;
      if (/^d\d+$/.test(k) && (snap.depth | 0) < +k.slice(1)) return false;
      if (/^rift\d+$/.test(k) && (snap.rift | 0) < +k.slice(4)) return false;
      // 'all14' was earned when there were 14 uniques; later ones don't take it away
      return k !== 'all14' || (snap.uq | 0) >= 14;
    };
    if (!numMap(snap.fs, 30) || (snap.fs && !Object.keys(snap.fs).every(fsOk))) bad.push('firsts');
    // a crown time must be a lord this Warden reached
    if (!numMap(snap.cr, 64) || (snap.cr && Object.keys(snap.cr).some(k => !G.isLord(+k) || +k > reach))) bad.push('crowns');
    if (snap.ev != null && (!Array.isArray(snap.ev) || snap.ev.length > 8 || !snap.ev.every(e => Array.isArray(e) && typeof e[0] === 'number' && typeof e[1] === 'string' && /^[a-z0-9]{1,16}$/.test(e[1]) && typeof e[2] === 'string' && e[2].length <= 48))) bad.push('feed');
    const gear = snap.gear || {};
    for (const s of G.SLOTS) {
      const g = gear[s];
      if (g == null) continue;
      const it = G.ITEM_BY_ID[g.id];
      if (!it || G.slotOf(g.id) !== s || g.r !== it.r) { bad.push(s + ':item'); continue; }
      if (!int(g.il, 0, lootReach + 3 + (g.c ? 3 : 0))) bad.push(s + ':ilvl');
      if (!int(g.e, 0, G.ENCHANT_MAX)) bad.push(s + ':enchant');
      if (g.q != null) {
        const U = G.UNIQUES[g.q];
        const same = U && U.base === g.id && !g.c && Array.isArray(g.a) && g.a.length === U.a.length && U.a.every(([k, v]) => g.a.some(a => Array.isArray(a) && a[0] === k && a[1] === v));
        if (!same) bad.push(s + ':unique');
        continue;
      }
      if (!Array.isArray(g.a) || g.a.length > AFFIX_COUNT[g.r] + 1 + (g.c ? 1 : 0)) { bad.push(s + ':affixes'); continue; }
      const seen = {};
      for (const a of g.a) {
        const def = Array.isArray(a) && G.AFFIXES[a[0]];
        if (!def || seen[a[0]] || typeof a[1] !== 'number') { bad.push(s + ':affix'); break; }
        seen[a[0]] = 1;
        const k = 1 + 0.35 * g.r;
        if (a[1] < def.v[0] * k - 1e-3 || a[1] > def.v[1] * k + 1e-3) { bad.push(s + ':range'); break; }
      }
    }
    // browsers may round Math.pow differently in the last bit, so allow a hair of slack
    if (typeof snap.power === 'number' && !bad.length && Math.abs(G.ladderPower(snap) - snap.power) > Math.max(1, snap.power * 1e-9)) bad.push('power');
    return bad;
  };
})(globalThis.G = globalThis.G || {});
