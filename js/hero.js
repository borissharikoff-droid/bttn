// BTTN — the hero: class, level, 4 gear slots, loot rolls, enchanting,
// mobs that march on the Button, combat and the power score used by the
// ladder. DOM-free like game.js, so the simulator (and later a ladder
// server) can run the exact same code.
(function (G) {
  'use strict';
  const { chance, pick, rand, randInt, emit } = G;
  const TUNE = G.TUNE;
  Object.assign(TUNE, {
    mobBase: 10, mobGrowth: 1.6, mobAtkBase: 4, mobAtkGrowth: 1.2,
    mobWalk: 9, hordeRate: 0.6, hordeRef: 3, hordeMax: 6, hordeCap: 12, surgeEvery: 26, surgeLen: 5, surgeMul: 3,
    bossHpMobs: 400, bagMax: 30, clickVolley: 0.6, petVolley: 0.25, smiteR: 0.12, smiteReach: 0.55, addRate: 0.5,
    mobGold: 0.6, mobChest: 0.1, baseHp: 50,
    // the arena is never empty: lots of small bodies, capped for the frame rate
    mobMax: 600, spitStop: 0.68, spitEvery: 2.4, bombR: 0.16, bombPow: 1.4,
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
    potion: { cd: 18, name: 'Heal', desc: 'Repairs the Button by 60%' },
    tome:   { cd: 24, name: 'Blessing', desc: 'Repairs 30%, damage ×1.5 for 6s' },
    scroll: { cd: 40, name: 'Greed', desc: 'Mobs drop chests 3× as often for 12s' },
    skull:  { cd: 16, name: 'Skull Blast', desc: 'Hits every enemy for 8 attacks' },
    orb:    { cd: 24, name: 'Stasis', desc: 'Slows mobs, +30% damage for 6s' },
    wing:   { cd: 30, name: 'Wings', desc: 'Attack speed ×2 for 8s' },
    egg:    { cd: 30, name: 'Starfall', desc: '15 hits on the target, 4 on everyone' },
  };
  G.CLASSES = [
    { id: 'knight', spr: 'h_knight', weapons: ['sword', 'katana', 'scythe'], starter: 'steel_sword', hp: 1.3, crit: 0, extra: 0,
      name: 'Knight', desc: 'Swords, katanas and scythes. The Button is 30% tougher.' },
    { id: 'archer', spr: 'h_archer', weapons: ['bow'], starter: 'short_bow', hp: 1, crit: 0, extra: 1,
      name: 'Archer', desc: 'Bows. Arrows pierce one more enemy.' },
    { id: 'wizard', spr: 'h_wizard', weapons: ['staff', 'wand'], starter: 'twig_staff', hp: 1, crit: 0, extra: 0, spd: 0.15,
      name: 'Wizard', desc: 'Staves and wands. Attacks 15% faster.' },
    { id: 'rogue', spr: 'h_rogue', weapons: ['dagger'], starter: 'rusty_dagger', hp: 1, crit: 0.1, extra: 0,
      name: 'Rogue', desc: 'Daggers. +10% crit chance.' },
  ];
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
    whet:   { w: 30, col: '#b8c8e0', name: 'Whetstone',     desc: 'Enchants an item +1 for free' },
    flux:   { w: 32, col: '#ffd84a', name: 'Orb of Flux',   desc: 'Rerolls every affix on an item' },
    ruin:   { w: 12, col: '#ff5a4a', name: 'Orb of Ruin',   desc: 'Corrupts an item: +3 item level, one more affix, or nothing. Corrupted items can\u2019t be changed again' },
    ascent: { w: 10, col: '#ffe0a0', name: 'Orb of Ascent', desc: 'Adds an affix, one past the usual count' },
    grace:  { w: 2,  col: '#ffffff', name: 'Orb of Grace',  desc: 'Rerolls affix values and keeps only the ones that go up' },
  };
  G.ORB_IDS = Object.keys(G.ORBS);

  // Uniques: named items with fixed affixes and one rule of their own. They
  // drop from rares, Hoarders, lords and Rift Guardians, the deeper ones only
  // from minD on. Their affixes count for ladder power, the rule only in fights.
  G.UNIQUE_COL = '#e8903a';
  G.UNIQUES = {
    pincer:     { base: 'emerald_ring',   minD: 0,  name: 'The Crab King\u2019s Pincer', a: [['dmg', 0.25], ['crit', 0.05]], fx: 'Critical kills burst, hitting everything around them' },
    goldgrin:   { base: 'amethyst_tiara', minD: 0,  name: 'Goldgrin',              a: [['gold', 0.6], ['luck', 0.3]], fx: '40% more loot drops' },
    windripper: { base: 'hunter_bow',     minD: 7,  name: 'Windripper',            a: [['dmg', 0.35], ['crit', 0.05]], fx: 'Arrows fork: two more targets' },
    cleaver:    { base: 'steel_sword',    minD: 9,  name: 'Warchief\u2019s Cleaver', a: [['dmg', 0.5], ['hp', 0.25]], fx: 'Every 5th attack is a critical hit with double splash' },
    sporeheart: { base: 'realm_heart',    minD: 12, name: 'Sporeheart',            a: [['hp', 0.45], ['xp', 0.3]], fx: 'Every kill repairs the Button a little' },
    stormcaller:{ base: 'frost_staff',    minD: 14, name: 'Stormcaller',           a: [['dmg', 0.4], ['spd', 0.15]], fx: 'Every attack calls a bolt on another mob' },
    nightfang:  { base: 'crystal_dagger', minD: 17, name: 'Nightfang',             a: [['dmg', 0.35], ['spd', 0.25]], fx: 'Critical hits strike twice' },
    headhunter: { base: 'titan_ring',     minD: 19, name: 'Headhunter',            a: [['dmg', 0.3], ['luck', 0.15]], fx: 'Slaying a rare: +60% damage and attack speed for 20s' },
    frostwalk:  { base: 'old_boot',       minD: 22, name: 'Frostwalkers',          a: [['hp', 0.6], ['spd', 0.12]], fx: 'The Horde walks 35% slower' },
    watcher:    { base: 'arcane_orb',     minD: 27, name: 'Eye of the Watcher',    a: [['crit', 0.08], ['critd', 0.8]], fx: 'Abilities recharge twice as fast' },
    hellstring: { base: 'phoenix_bow',    minD: 31, name: 'Hellstring',            a: [['dmg', 0.6], ['spd', 0.2]], fx: 'Kills explode, hitting the mobs around them' },
    voidplate:  { base: 'golden_plate',   minD: 34, name: 'Voidplate',             a: [['hp', 1.2], ['dmg', 0.2]], fx: 'Mobs that bite the Button take ten hits back' },
    reaper:     { base: 'blood_scythe',   minD: 37, name: 'Reaper\u2019s Due',     a: [['dmg', 0.8], ['critd', 0.6]], fx: 'Each kill: +2% attack speed for 6s, up to +80%' },
    lastbutton: { base: 'golden_button',  minD: 39, boss: true, name: 'The Last Button', a: [['dmg', 0.5], ['gold', 0.5], ['luck', 0.3], ['xp', 0.3]], fx: 'Every click strikes twice. Only the Mad Button and deep Rifts drop it' },
    // past the Button
    codex:      { base: 'star_codex',     minD: 44, name: 'The Drowned Codex',     a: [['xp', 0.4], ['dmg', 0.45]], fx: 'Spitters and bombers die to any hit' },
    tyrant:     { base: 'king_crown',     minD: 49, name: 'Crown of the Gear Tyrant', a: [['spd', 0.3], ['dmg', 0.5]], fx: 'Tanks, brutes and champions take double damage' },
    ashbringer: { base: 'dragon_sword',   minD: 54, name: 'Ashbringer',            a: [['dmg', 1], ['critd', 0.6]], fx: 'The Warden\u2019s kills burst into flame, burning the mobs around them' },
    othercloak: { base: 'void_cloak',     minD: 59, name: 'The Other Cloak',       a: [['hp', 1.1], ['crit', 0.08]], fx: 'One bite in three is turned back: the mob dies instead' },
    firsthand:  { base: 'celestial_staff', minD: 64, boss: true, name: 'Palm of the First Hand', a: [['dmg', 1.1], ['spd', 0.3], ['gold', 0.4]], fx: 'Every click calls three more bolts. Only the First Hand and deep Rifts drop it' },
  };
  G.UNIQUE_IDS = Object.keys(G.UNIQUES);
  // Rift level -> the depth its Horde fights at: Rift N fights like depth N
  G.riftDepth = L => Math.max(0, (L | 0) - 1);

  // Level-up perks, Vampire Survivors style: each level the Warden picks one
  // of three. They build this run's Warden and reset on ascension (gear stays).
  G.PERKS = {
    might:   { max: 5, icon: 'ic_sword', name: 'Might', desc: '+12% damage, bosses included' },
    frenzy:  { max: 5, icon: 'ic_clock', name: 'Frenzy', desc: '+12% attack speed' },
    multi:   { max: 3, icon: 'it_short_bow', name: 'Multistrike', desc: 'Each attack hits one more target' },
    cleave:  { max: 4, icon: 'it_blood_scythe', name: 'Cleave', desc: '+30% splash radius' },
    reach:   { max: 3, icon: 'it_hunter_bow', name: 'Long Reach', desc: '+20% attack range' },
    blades:  { max: 5, icon: 'it_steel_sword', name: 'Orbiting Blades', desc: 'One more blade circles the Button, cutting what it touches' },
    aura:    { max: 5, icon: 'ic_star', name: 'Holy Ground', desc: 'Burns everything close to the Button, harder each level' },
    chain:   { max: 4, icon: 'ic_bolt', name: 'Chain Lightning', desc: '+15% chance a hit arcs to 3 more mobs' },
    nova:    { max: 4, icon: 'it_arcane_orb', name: 'Nova', desc: 'A blast around the Button, sooner each level; hurts bosses' },
    thunder: { max: 3, icon: 'ic_finger', name: 'Heavy Hand', desc: 'Each click calls one more bolt' },
    bulwark: { max: 5, icon: 'it_knight_shield', name: 'Bulwark', desc: '+20% Button toughness' },
    leech:   { max: 3, icon: 'ic_heart', name: 'Leech', desc: 'Every kill repairs the Button a little' },
    greed:   { max: 5, icon: 'ic_coin', name: 'Greed', desc: '+20% gold from the Horde' },
    loot:    { max: 3, icon: 'ic_bag', name: 'Scavenger', desc: '+25% loot bag drops' },
  };
  const perk = id => (G.S.hero && G.S.hero.perks && G.S.hero.perks[id]) || 0;
  // Today's omen (js/journey.js); neutral where that file isn't loaded, e.g. on the ladder server
  const NO_OMEN = { xp: 1, mobHp: 1, gold: 1, horde: 1, champ: 1, loot: 1, thunder: 0, luck: 0 };
  const om = () => (G.omen ? G.omen() : NO_OMEN);
  G.perk = perk;

  // Evolutions, Vampire Survivors style: a perk at its top rank plus the right
  // gear worn turns the next level-up into a golden card. Discoveries are kept
  // forever and fill a recipe book in the Collection.
  G.EVOS = {
    bladestorm: { from: 'blades', slot: 'weapon', types: ['sword', 'katana', 'dagger'], need: 'a blade', icon: 'it_eternity_blade', name: 'Blade Storm', desc: 'Twice the blades, wider and deadlier' },
    sanctuary:  { from: 'aura', slot: 'ring', types: ['halo', 'crown'], need: 'a halo or crown', icon: 'it_halo', name: 'Sanctuary', desc: 'Holy Ground doubles, reaches further and repairs the Button' },
    supernova:  { from: 'nova', slot: 'ability', types: ['orb', 'egg'], need: 'an orb or cosmic egg', icon: 'it_moon_orb', name: 'Supernova', desc: 'A bigger, stronger Nova every 3 seconds' },
    storm:      { from: 'chain', slot: 'weapon', types: ['wand', 'staff'], need: 'a wand or staff', icon: 'it_chaos_wand', name: 'Thunderstorm', desc: 'Every hit chains to 5 mobs' },
    rain:       { from: 'multi', slot: 'weapon', types: ['bow'], need: 'a bow', icon: 'it_phoenix_bow', name: 'Arrow Rain', desc: '3 more targets and 50% wider splash' },
    wrath:      { from: 'thunder', slot: 'ability', types: ['tome', 'scroll'], need: 'a tome or scroll', icon: 'it_star_codex', name: 'Wrath of the Hand', desc: 'Each click calls 3 more bolts' },
    bloodpact:  { from: 'leech', slot: 'ring', types: ['heart', 'amulet'], need: 'a heart or amulet', icon: 'it_realm_heart', name: 'Blood Pact', desc: 'Kills repair 4× as much, +25% damage' },
    midas:      { from: 'greed', slot: 'ring', types: ['button', 'ring'], need: 'a ring', icon: 'it_golden_button', name: 'Midas Touch', desc: 'Horde gold ×2, loot bags +50%' },
    berserk:    { from: 'frenzy', slot: 'armor', types: ['helm'], need: 'a helm', icon: 'it_demon_helm', name: 'Berserk', desc: '+50% attack speed' },
    titan:      { from: 'might', slot: 'armor', types: ['armor'], need: 'body armour', icon: 'it_golden_plate', name: 'Titan', desc: '+50% damage' },
    bastion:    { from: 'bulwark', slot: 'armor', types: ['shield'], need: 'a shield', icon: 'it_knight_shield', name: 'Bastion', desc: 'Button toughness ×2, bites hurt 30% less' },
  };
  const evo = id => perk('evo_' + id);
  G.evo = evo;
  // Evolutions the Warden qualifies for right now
  function evoReady() {
    const h = G.S.hero;
    return Object.keys(G.EVOS).filter(id => {
      const e = G.EVOS[id], g = h.eq[e.slot];
      return !evo(id) && perk(e.from) >= G.PERKS[e.from].max && g && e.types.includes(G.ITEM_TYPE[g.id]);
    });
  }
  G.evoReady = evoReady;
  G.bladeCount = () => perk('blades') * (evo('bladestorm') ? 2 : 1);

  // ---------- State ----------
  function newHero() {
    return { cls: null, lvl: 1, xp: 0, eq: { weapon: null, ability: null, armor: null, ring: null }, bag: [], gu: 0,
      shards: 0, hp: TUNE.baseHp, auto: 1, salv: 1, cast: 1, kills: 0, elites: 0, fresh: 0,
      perks: {}, perkPts: 0, offer: null, offerT: 0, autoPerk: 1, orbs: {} };
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
  }
  G.ensureHero = ensureHero;

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
  function makeGear(id, il) {
    const it = G.ITEM_BY_ID[id], h = G.S.hero;
    return { u: ++h.gu, id, r: it.r, il: Math.max(0, il | 0), e: 0, a: rollAffixes(it.r) };
  }
  G.makeGear = makeGear;
  function makeUnique(q, il) {
    const U = G.UNIQUES[q], it = G.ITEM_BY_ID[U.base], h = G.S.hero;
    return { u: ++h.gu, id: U.base, r: it.r, il: Math.max(0, il | 0), e: 0, a: U.a.map(x => x.slice()), q };
  }
  G.makeUnique = makeUnique;
  const enchantMul = g => 1 + 0.12 * g.e;
  // Uniques hit like a mythic of their kind
  const rmul = g => G.RMUL[g.q ? 5 : g.r];
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
    const lvlM = 1 + 0.05 * (h.lvl - 1);
    const own = cls.weapons.includes(wtype) ? 1.5 : 1;
    const pct = 1 + (aff.dmg || 0) + (eq.ring ? mainStat(eq.ring) : 0) + (eq.ability ? mainStat(eq.ability) : 0);
    const base = (w ? mainStat(w) : 4) * own * lvlM * pct * (d.heroMult || 1);
    const hit = base * wt.mult;
    const rate = wt.rate * (1 + (aff.spd || 0) + (cls.spd || 0)) * (d.spdMult || 1);
    const crit = Math.min(0.9, (d.crit || 0.03) + (aff.crit || 0) + cls.crit);
    const critMult = (d.critMult || 3) + (aff.critd || 0);
    const targets = wt.targets + cls.extra;
    const hp = (eq.armor ? mainStat(eq.armor) : TUNE.baseHp) * lvlM * cls.hp * (1 + (aff.hp || 0)) * (d.hpMult || 1);
    const dps = hit * rate * (1 + crit * (critMult - 1));
    const power = Math.floor(dps * (1 + 0.15 * (targets - 1)) * Math.sqrt(hp / TUNE.baseHp) * 10);
    return { aff, wtype, wt, hit, rate, crit, critMult, targets, hp, dps, power, own: own > 1 };
  }
  G.heroCombat = combat;

  function powerWith(slot, g) {
    const eq = Object.assign({}, G.S.hero.eq);
    eq[slot] = g;
    return combat(eq, G.D).power;
  }
  G.powerWith = powerWith;

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
    }
    if (!equipped) {
      if (h.salv && g.r < h.salv && !g.q) { salvage(g, true); return g; }
      h.bag.push(g);
    }
    while (h.bag.length > TUNE.bagMax) {
      // Drop the weakest item in the bag into shards, uniques last
      let worst = null, ws = Infinity;
      for (const b of h.bag) { const s = powerWith(G.slotOf(b.id), b) + (b.q ? 1e300 : 0); if (s < ws) { ws = s; worst = b; } }
      salvage(worst, true);
    }
    emit('gear', g, equipped);
    return g;
  }
  G.gainGear = gainGear;

  function equip(g, silent) {
    const h = G.S.hero, slot = G.slotOf(g.id);
    const old = h.eq[slot];
    const i = h.bag.indexOf(g);
    if (i >= 0) h.bag.splice(i, 1);
    h.eq[slot] = g;
    if (old) h.bag.push(old);
    G.dirty(); G.recalc();
    if (!silent) emit('equip', g);
    return true;
  }
  G.equip = equip;
  function unequip(slot) {
    const h = G.S.hero, g = h.eq[slot];
    if (!g) return false;
    h.eq[slot] = null; h.bag.push(g);
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
    for (const s of G.SLOTS) if (h.eq[s] === g) return 0; // never scrap what you wear
    const v = salvageValue(g);
    h.shards += v;
    if (!silent) emit('salvage', g, v);
    return v;
  }
  G.salvage = salvage;
  G.salvageBelow = function (r) {
    const h = G.S.hero;
    let n = 0, v = 0;
    for (const g of h.bag.slice()) if (g.r < r && !g.q) { v += salvage(g, true); n++; }
    emit('salvage', null, v);
    return { n, v };
  };

  function enchantCost(g) {
    return { shards: Math.ceil(4 * Math.pow(1.5, g.e) * G.RMUL[g.r]), gold: Math.max(50, G.D.incomeRef * 6 * Math.pow(1.3, g.e)) };
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
    else if (id === 'flux') g.a = rollAffixes(g.r, g.a.length);
    else if (id === 'ascent') g.a.push(newAffix(g.r, g.a));
    else if (id === 'grace') g.a = g.a.map(([k, v]) => [k, Math.max(v, rollAffix(k, g.r))]);
    else if (id === 'ruin') {
      g.c = 1;
      const roll = G.rng();
      if (roll < 0.35) { g.il += 3; res = 'ruin_il'; }
      else if (roll < 0.7) { g.a.push(newAffix(g.r, g.a)); res = 'ruin_aff'; }
      else res = 'ruin_none';
    }
    G.dirty(); G.recalc();
    emit('orb', id, g, res);
    return res;
  };

  function chooseClass(id) {
    const S = G.S, h = S.hero, cls = G.CLASS_BY_ID[id];
    if (!cls) return false;
    h.cls = id;
    const hasWeapon = [h.eq.weapon].concat(h.bag).some(g => g && G.slotOf(g.id) === 'weapon' && cls.weapons.includes(G.ITEM_TYPE[g.id]));
    if (!hasWeapon) { const g = makeGear(cls.starter, 0); h.bag.push(g); }
    // Wear the best weapon for the new class
    let best = h.eq.weapon, bp = best ? powerWith('weapon', best) : -1;
    for (const g of h.bag) if (G.slotOf(g.id) === 'weapon') { const p = powerWith('weapon', g); if (p > bp) { bp = p; best = g; } }
    if (best && best !== h.eq.weapon) equip(best, true);
    G.dirty(); G.recalc();
    h.hp = G.D.heroHp;
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
    d.goldMult *= (1 + (aff.gold || 0)) * (1 + G.STAR_BONUS * (G.starCount ? G.starCount() : 0));
    d.luck += (aff.luck || 0) + om().luck;
    d.xpMult = (1 + (aff.xp || 0)) * om().xp;
    d.shardMult = 1 + (aff.shard || 0);
  };
  G.heroFinish = function (d) {
    const S = G.S, h = S.hero;
    if (!h) return;
    d.heroMult = (d.heroMult || 1) * (1 + 0.005 * S.fameTotal) * (1 + 0.02 * (d.heroClasses || 0)) * (G.Journey ? G.Journey.bonus() : 1) * (1 + G.STAR_BONUS * (G.starCount ? G.starCount() : 0));
    const c = combat(h.eq, d);
    d.uq = {};
    for (const s of G.SLOTS) if (h.eq[s] && h.eq[s].q) d.uq[h.eq[s].q] = 1;
    const hunt = R.hb.hh > 0 && d.uq.headhunter ? 1.6 : 1;
    const buffDmg = (R.hb.tome > 0 ? 1.5 : 1) * (R.hb.orb > 0 ? 1.3 : 1) * hunt;
    d.hero = c;
    const might = (1 + 0.12 * perk('might')) * (evo('titan') ? 1.5 : 1) * (evo('bloodpact') ? 1.25 : 1);
    const frenzy = (1 + 0.12 * perk('frenzy')) * (evo('berserk') ? 1.5 : 1) * hunt * (1 + 0.02 * (d.uq.reaper ? R.reap : 0)) * (shrine('frenzy') ? 2 : 1);
    d.heroHit = c.hit * buffDmg * might;
    d.heroRate = c.rate * (R.hb.wing > 0 ? 2 : 1) * frenzy;
    d.heroHp = c.hp * (1 + 0.2 * perk('bulwark')) * (evo('bastion') ? 2 : 1);
    d.heroDps = c.dps * buffDmg * might * frenzy;
    d.power = c.power;
    if (h.hp > d.heroHp) h.hp = d.heroHp;
    if (c.power > S.rec.maxPower) S.rec.maxPower = c.power;
  };

  // ---------- The Horde ----------
  // Mobs walk from the edge of the arena (p = 0) to the Button (p = 1). Each
  // kind has a weight: its share of a standard mob's HP, bite, rewards and
  // clearing progress. A swarm of fodder is worth the same as a few brutes,
  // it just dies in a much bigger heap.
  function mobHp(d) { return TUNE.mobBase * Math.pow(TUNE.mobGrowth, d); }
  function mobAtk(d) { return TUNE.mobAtkBase * Math.pow(TUNE.mobAtkGrowth, d); }
  G.mobHp = mobHp; G.mobAtk = mobAtk;
  // Bosses are worth a few dozen mobs at first and grow into real walls by
  // the second land: from then on a boss needs a Warden strong for this depth.
  G.bossHp = d => mobHp(d) * Math.min(TUNE.bossHpMobs, 40 + 30 * d) * (G.isLord(d) ? TUNE.lordHp : 1);
  function xpNeed(l) { return Math.floor(10 * Math.pow(1.2, l - 1) + 6 * l); }
  G.xpNeed = xpNeed;

  G.MOB_KINDS = {
    fodder: { w: 0.008, spd: 1.3, gold: 1 },
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
  function mobXY(m) {
    const th = -Math.PI / 2 + 0.55 + m.a * (Math.PI * 2 - 1.1);
    const r = 1 - 0.88 * m.p;
    return [Math.cos(th) * r, Math.sin(th) * r];
  }
  G.mobXY = mobXY;

  // How hard the Warden hits this depth: standard mobs they could kill per second
  const mightRatio = () => (G.D.heroDps || 0) / mobHp(dnow());
  G.mightRatio = mightRatio;
  // The Horde answers strength: a Warden who kills faster faces a bigger, heavier
  // flow, so a stronger Warden clears lands (and earns gold and XP) faster
  const hordeScale = () => G.clamp(mightRatio() / TUNE.hordeRef, 0.4, TUNE.hordeMax);
  G.hordeScale = hordeScale;
  function makeMob(kind, a, p, add) {
    const K = G.MOB_KINDS[kind];
    const w = K.w * (add ? 1 : Math.max(1, (R.hs || 1) / 1.5));
    const hp = mobHp(dnow()) * w * om().mobHp * (K.hp || 1);
    const m = { id: ++R.mobUid, kind, w, hp, max: hp, p, a: clamp01(a), sp: K.spd / (TUNE.mobWalk * rand(0.85, 1.15)), atkT: 0, add: !!add };
    if (kind === 'rare') {
      m.mod = pick(Object.keys(G.RARE_MODS));
      m.name = pick(RARE_A) + ' ' + pick(RARE_B);
      if (m.mod === 'hasted') m.sp *= 1.7;
    }
    if (kind === 'brute' && land().stone) m.stone = 1;
    if (R.breach && R.breach.t > 0 && !add && kind !== 'guardian' && kind !== 'hoard') m.br = 1;
    R.mobs.push(m);
    emit('mobSpawn', m);
    return m;
  }
  // One pack, all from one direction
  G.makeMob = makeMob;
  // Which zone of its land the Horde is in (0-4, the 5th is the lord's)
  const zoneOf = d => ((d % G.REALM_SIZE) + G.REALM_SIZE) % G.REALM_SIZE;
  G.zoneOf = zoneOf;
  // The share of packs each archetype leads here: the zone's mix, bent by the land's rule
  function zoneMix(d) {
    const z = G.ZONE_MIX ? G.ZONE_MIX[zoneOf(d)] : null, L = land();
    if (!z) return {};
    return { runner: z.runner * (L.run || 1), spitter: z.spitter * (L.spit || 1), bomber: z.bomber * (L.bomb || 1), tank: z.tank * (L.tanky || 1) };
  }
  G.zoneMix = zoneMix;
  // One pack, all from one direction: a leader and a long tail of small fry
  // that streams in behind it (p below 0 is still off the arena)
  function spawnPack(add, at) {
    const d = dnow(), a = at != null ? at + rand(-0.04, 0.04) : G.rng(), roll = G.rng(), L = land();
    if (R.mobs.length >= TUNE.mobMax) return;
    const room = () => R.mobs.length < TUNE.mobMax;
    const swarm = (kind, n, spread, tail) => { for (let i = 0; i < n && room(); i++) makeMob(kind, a + rand(-spread, spread), -rand(0, tail || 0.3), add); };
    if (add) { swarm('fodder', randInt(30, 50), 0.08, 0.25); return; }
    const rc = 0.03 * om().champ * (L.rare || 1), mc = rc + 0.07 * om().champ * (L.champ || 1);
    if (d >= 1 && roll < rc) { makeMob('rare', a, 0); swarm('fodder', 60, 0.08); emit('rareSpawn'); return; }
    if (roll < mc) { makeMob('magic', a, 0); makeMob('magic', a + 0.03, -0.04); swarm('fodder', 40, 0.07); return; }
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
  function targets(n, reach) {
    const minP = reach ? (1 - reach) / 0.88 : -1;
    const list = R.mobs.filter(m => m.p >= minP && !m.gone).sort((a, b) => b.p + (b.kind === 'hoard' ? 1 : 0) - a.p - (a.kind === 'hoard' ? 1 : 0));
    const fi = R.focus ? list.findIndex(m => m.id === R.focus) : -1;
    if (fi > 0) list.unshift(list.splice(fi, 1)[0]);
    else if (fi < 0 && !R.mobs.some(m => m.id === R.focus && !m.dead)) R.focus = null;
    return list.slice(0, n);
  }
  // Everything within r of any of the targets, except the targets themselves
  function around(ts, r) {
    if (!(r > 0) || !ts.length) return [];
    const cs = ts.map(mobXY), out = [], r2 = r * r;
    for (const m of R.mobs) {
      if (ts.includes(m)) continue;
      const [x, y] = mobXY(m);
      for (const c of cs) { const dx = x - c[0], dy = y - c[1]; if (dx * dx + dy * dy <= r2) { out.push(m); break; } }
    }
    return out;
  }
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
    if (uq('codex') && (m.kind === 'spitter' || m.kind === 'bomber')) dmg = m.hp + 1;
    else if (uq('tyrant') && (m.kind === 'tank' || m.kind === 'brute' || m.kind === 'magic')) dmg *= 2;
    m.hp -= m.mod === 'stone' || m.stone ? dmg * 0.5 : dmg;
    if (m.hp <= 0) { m.over = -m.hp / m.max; m.crit = crit; killMob(m, src); }
  }
  // Carnage: the kill streak pays. Kill fast enough that it never lapses and
  // gold and XP climb, up to +40%
  const CARN = [100, 300, 800, 2000];
  const carnTier = () => { let t = 0; while (t < CARN.length && R.carn >= CARN[t]) t++; return t; };
  G.carnage = () => { const t = carnTier(); return { n: R.carn, tier: t, mul: 1 + 0.1 * t, next: CARN[t] || 0 }; };
  function killMob(m, src) {
    const S = G.S, D = G.D, h = S.hero, L = land();
    m.dead = true;
    if (!m.add) { const t0 = carnTier(); R.carn++; R.carnT = 0; if (R.carn > (S.st.bestStreak || 0)) S.st.bestStreak = R.carn; if (carnTier() > t0) emit('carnage', carnTier()); }
    const cm = 1 + 0.1 * carnTier();
    const i = R.mobs.indexOf(m);
    if (i >= 0) R.mobs.splice(i, 1);
    const K = G.MOB_KINDS[m.kind];
    const gold = D.incomeRef * TUNE.mobGold * m.w * K.gold * (m.add ? 0.4 : 1) * (1 + 0.2 * perk('greed')) * (evo('midas') ? 2 : 1) * om().gold * (shrine('greed') ? 2 : 1) * cm;
    G.addGold(gold, 'mob');
    gainXp(2.5 * (1 + dnow()) * m.w * (m.kind === 'rare' ? 1.5 : 1) * (m.br ? 1.5 : 1) * (shrine('slaughter') ? 2 : 1) * (D.xpMult || 1) * (L.xp || 1) * cm);
    h.kills++;
    if (G.landKill && !m.add) G.landKill(m);
    if (m.kind === 'magic' || m.kind === 'rare') h.elites++;
    if (m.kind === 'rare') {
      S.st.rares = (S.st.rares || 0) + 1;
      if (uq('headhunter')) { R.hb.hh = Math.min(60, Math.max(0, R.hb.hh || 0) + 20); G.dirty(); emit('headhunter', m); }
    }
    if (!m.add && !R.rift) S.bossMeter += m.w;
    let chest = null;
    if (G.lootKill) chest = G.lootKill(m, src);
    else if (!m.add) {
      const greed = (R.hb.scroll > 0 ? 3 : 1) * (1 + 0.25 * perk('loot')) * (evo('midas') ? 1.5 : 1) * om().loot;
      const p = m.kind === 'rare' ? 1 : m.kind === 'magic' ? 0.4 * greed : TUNE.mobChest * m.w * greed;
      if (chance(p)) chest = dropBag(m);
    }
    if (perk('leech')) h.hp = Math.min(D.heroHp, h.hp + D.heroHp * 0.003 * perk('leech') * (G.SMALL[m.kind] ? 0.3 : 4) * (evo('bloodpact') ? 4 : 1));
    if (uq('sporeheart')) h.hp = Math.min(D.heroHp, h.hp + D.heroHp * 0.004 * (G.SMALL[m.kind] ? 0.3 : 4));
    if (uq('reaper')) { R.reap = Math.min(40, R.reap + 1); R.reapT = 6; }
    G.questProgress('kills', 1);
    if (G.Journey) G.Journey.bountyKill();
    emit('mobDie', m, gold, chest, src);
    if (m.mod === 'splitter') spores(m, 22);
    else if (L.split && !m.add && (m.kind === 'brute' || m.kind === 'magic' || m.kind === 'tank') && chance(L.split)) { spores(m, 18); emit('spores', m); }
    // a bomber takes the pack around it along
    if (m.kind === 'bomber' && src !== 'bite') bomb(m);
    // Blasts: Hellstring's kills, the Pincer's critical kills, the Abyss's hellfire. They can chain, a little.
    const boom = uq('hellstring') && (src === 'auto' || src === 'chain') ? 0.6 : uq('ashbringer') && src === 'auto' ? 0.5 : uq('pincer') && m.crit ? 0.5 : L.boom && !m.add && chance(L.boom) ? 0.8 : 0;
    if (boom && (R.boomD || 0) < 3) blast(m, boom);
    if (R.rift && G.riftKill) G.riftKill(m);
  }
  function spores(m, n) { for (let k = 0; k < n && R.mobs.length < TUNE.mobMax; k++) makeMob('fodder', m.a + rand(-0.04, 0.04), m.p - rand(0, 0.08), m.add); }
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
      h.perkPts = (h.perkPts || 0) + (h.lvl - before);
      if (!h.offer) offerPerks();
      G.dirty(); G.recalc();
      h.hp = G.D.heroHp;
      emit('levelUp', h.lvl);
    }
  }
  G.gainXp = gainXp;

  function offerPerks() {
    const h = G.S.hero;
    const open = Object.keys(G.PERKS).filter(k => perk(k) < G.PERKS[k].max);
    const evos = evoReady().map(id => 'evo_' + id);
    if ((!open.length && !evos.length) || !(h.perkPts > 0)) { h.offer = null; h.perkPts = 0; return; }
    const pickN = evos.slice(0, 1);
    const want = Math.min(3, open.length + pickN.length);
    while (pickN.length < want) { const k = pick(open); if (!pickN.includes(k)) pickN.push(k); }
    h.offer = pickN; h.offerT = 0;
    emit('perkOffer', pickN);
  }
  G.pickPerk = function (id) {
    const h = G.S.hero;
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
    if (h.perkPts > 0) offerPerks();
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
    if (src === 'click') for (const m of ts.concat(splash)) if (m.p > -0.05) m.p = Math.max(-0.05, m.p - 0.05 / Math.sqrt(Math.max(0.03, m.w)));
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
  function hurtButton(dmg) {
    const h = G.S.hero;
    if (R.stun > 0) return;
    h.hp -= dmg;
    emit('buttonHurt', dmg);
    if (h.hp <= 0) breakButton();
  }
  function breakButton() {
    const S = G.S, h = S.hero;
    R.stun = 4;
    h.hp = G.D.heroHp;
    for (const m of R.mobs) emit('mobFlee', m);
    R.mobs.length = 0; if (R.shots) R.shots.length = 0;
    S.bossMeter = Math.floor(S.bossMeter * 0.5);
    if (R.boss) G.fleeBoss();
    if (R.rift && G.riftEnd) G.riftEnd(false, 'broke');
    emit('buttonBreak');
  }

  function castAbility() {
    const S = G.S, D = G.D, h = S.hero;
    const g = h.eq.ability;
    if (!g || R.abilCd > 0 || !h.cls) return false;
    const type = G.ITEM_TYPE[g.id], ab = G.ABILITIES[type];
    R.abilCd = ab.cd * (1 - Math.min(0.5, 0.03 * g.e)) * (uq('watcher') ? 0.5 : 1);
    const hit = D.heroHit;
    switch (type) {
      case 'potion': h.hp = Math.min(D.heroHp, h.hp + D.heroHp * 0.6); break;
      case 'tome': h.hp = Math.min(D.heroHp, h.hp + D.heroHp * 0.3); R.hb.tome = 6; break;
      case 'scroll': R.hb.scroll = 12; break;
      case 'orb': R.hb.orb = 6; break;
      case 'wing': R.hb.wing = 8; break;
      case 'skull':
        if (R.boss) G.hitBoss(hit * 8 * D.bossMult);
        for (const m of R.mobs.slice()) dealHit(m, hit * 8, 'ability');
        break;
      case 'egg':
        if (R.boss) G.hitBoss(hit * 15 * D.bossMult);
        else { const t = targets(1)[0]; if (t) dealHit(t, hit * 11, 'ability'); }
        for (const m of R.mobs.slice()) dealHit(m, hit * 4, 'ability');
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
    // ability buffs
    let changed = false;
    for (const k in R.hb) { if (R.hb[k] > 0) { R.hb[k] -= dt; if (R.hb[k] <= 0) changed = true; } }
    if (changed) { G.dirty(); G.recalc(); }
    if (R.abilCd > 0) R.abilCd -= dt;
    if (R.stun > 0) R.stun -= dt;
    if (R.reapT > 0 && (R.reapT -= dt) <= 0) { R.reap = 0; G.dirty(); }
    if (R.carn && (R.carnT += dt) > 2.5) { R.carn = 0; emit('carnage', 0); }
    // regen
    h.hp = Math.min(D.heroHp, h.hp + D.heroHp * 0.03 * dt);
    // the horde: a steady flow of packs, with a surge every half a minute
    if (R.stun <= 0) {
      if (R.boss) {
        R.hordeAcc = Math.min(3, R.hordeAcc + dt * TUNE.hordeRate * TUNE.addRate * (R.boss.lord ? 1.6 : 1) * (R.boss.rage ? 2 : 1));
        if (R.hordeAcc >= 1 && aliveWeight(true) < 2) { R.hordeAcc -= 0.5; spawnPack(true); }
      } else {
        if (R.surge > 0) R.surge -= dt;
        else if ((R.surgeT -= dt) <= 0) { R.surgeT = TUNE.surgeEvery * rand(0.8, 1.2); R.surge = TUNE.surgeLen * (land().surge || 1); emit('surge'); }
        const surging = R.surge > 0;
        R.hs = hordeScale();
        const thick = om().horde * (R.rift ? 1.5 : 1) * (shrine('slaughter') ? 2.5 : 1) * (land().thick || 1) * (surging ? TUNE.surgeMul * (land().surge || 1) : 1);
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
        if (R.hordeAcc >= 1 && aliveWeight(false) < cap && R.mobs.length < TUNE.mobMax) {
          const w0 = aliveWeight(false);
          spawnPack(false);
          R.hordeAcc -= Math.max(0.5, aliveWeight(false) - w0);
        }
      }
    }
    // walk & bite
    const slow = (R.hb.orb > 0 ? 0.4 : 1) * (uq('frostwalk') ? 0.65 : 1) * (land().slow || 1);
    const atk = mobAtk(dnow());
    for (const m of R.mobs.slice()) {
      if (m.dead) continue;
      if (m.move && G.moveMob) { G.moveMob(m, dt); continue; }
      // spitters hold at range and lob globs at the Button
      if (m.kind === 'spitter' && m.p >= TUNE.spitStop) {
        if ((m.atkT -= dt) <= 0) { m.atkT = TUNE.spitEvery * rand(0.85, 1.15); R.shots.push({ m: m.id, a: m.a, p: m.p, t: 0.5, dmg: atk * m.w * (m.mod === 'frenzied' ? 2 : 1) }); emit('spit', m); }
        continue;
      }
      if (m.p < 1) m.p = Math.min(1, m.p + m.sp * dt * slow);
      else if (m.kind === 'bomber') {
        // a bomber that reaches the Button goes off on it
        hurtButton(atk * m.w * 6 * (evo('bastion') ? 0.7 : 1)); emit('bomberPop', m);
        m.dead = true; const i = R.mobs.indexOf(m); if (i >= 0) R.mobs.splice(i, 1);
        emit('mobFlee', m);
        if (R.stun > 0) break;
      } else {
        m.atkT -= dt;
        if (m.atkT <= 0) {
          m.atkT = 1;
          if (uq('othercloak') && m.kind !== 'guardian' && m.kind !== 'rare' && chance(1 / 3)) { emit('thorns', m); dealHit(m, 2 * m.hp + 1, 'thorns', false); continue; }
          hurtButton(atk * m.w * (m.mod === 'frenzied' ? 2 : 1) * (evo('bastion') ? 0.7 : 1)); emit('mobBite', m);
          if (uq('voidplate') && !m.dead) { emit('thorns', m); dealHit(m, D.heroHit * 10, 'thorns', false); }
          if (R.stun > 0) break;
        }
      }
    }
    // globs in flight
    for (let i = R.shots.length - 1; i >= 0; i--) {
      const sh = R.shots[i];
      if ((sh.t -= dt) <= 0) { R.shots.splice(i, 1); if (R.stun <= 0) { hurtButton(sh.dmg); emit('spitHit', sh); } }
    }
    // the boss hits the button too
    if (R.boss) {
      R.bossAtkT -= dt;
      if (R.bossAtkT <= 0) { R.bossAtkT = 2; hurtButton(atk * (R.boss.lord ? 5 : 3) * (R.boss.rage ? 1.5 : 1)); }
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
    // a pending level-up choice is made for the player if they leave it
    if (h.offer && (h.offerT = (h.offerT || 0) + dt) > 12 && h.autoPerk) G.pickPerk(h.offer[0]);
    // hero attacks
    R.heroAcc += dt * D.heroRate;
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
    if (!h || !h.cls) return null;
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
    for (const m of R.mobs) emit('mobFlee', m);
    R.mobs.length = 0; if (R.shots) R.shots.length = 0;
    R.bossAtkT = 2; R.hordeAcc = 0.5; R.surge = 0;
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
    R.mobs.length = 0; if (R.shots) R.shots.length = 0; R.hb = {}; R.abilCd = 0; R.stun = 0; R.hordeAcc = 0; R.surge = 0; R.surgeT = 20; R.reap = 0; R.rift = null;
    G.S.rec.runStart = Date.now();
    G.dirty(); G.recalc();
    h.hp = G.D.heroHp || TUNE.baseHp;
  };

  // ---------- Ladder snapshot ----------
  // A compact, canonical description of the character. A future ladder server
  // recomputes power from this with the same combat() code, so a client
  // can't just send a big number.
  G.ladderSnapshot = function () {
    const S = G.S, h = S.hero;
    const gear = {};
    for (const s of G.SLOTS) { const g = h.eq[s]; gear[s] = g ? Object.assign({ id: g.id, r: g.r, il: g.il, e: g.e, a: g.a }, g.c ? { c: 1 } : {}, g.q ? { q: g.q } : {}) : null; }
    const rf = S.rift || {}, today = rf.day && rf.day.k === G.utcDayKey() ? { k: rf.day.k, l: rf.day.l | 0, t: rf.day.t | 0 } : null;
    // crown times are at least 0.1s (a lord can die on the tick it appears)
    const cr = {};
    for (const k in S.rec.crowns || {}) cr[k] = Math.max(0.1, +S.rec.crowns[k] || 0.1);
    const snap = {
      // the best level reached, so ascending (which starts the level over) doesn't sink you on the ladder
      v: 1, name: (S.profile.name || '').slice(0, 16), cls: h.cls, lvl: Math.max(h.lvl, Math.min(S.rec.maxLevel || 1, 60 + 2 * Math.max(S.bestDepth, G.riftDepth(rf.best | 0)))),
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
    if (typeof snap.name !== 'string' || snap.name.length > 16) bad.push('name');
    if (snap.uq != null && !int(snap.uq, 0, G.UNIQUE_IDS.length)) bad.push('uniques');
    if (snap.kills != null && !int(snap.kills, 0, 1e12)) bad.push('kills');
    // land stars: three per land, and only in lands this Warden has reached
    if (snap.ls != null && !(int(snap.ls, 0, 3 * G.REALMS.length) && snap.ls <= 3 * Math.min(G.REALMS.length, Math.floor(reach / G.REALM_SIZE) + 1))) bad.push('stars');
    if (snap.rd != null && (typeof snap.rd !== 'object' || typeof snap.rd.k !== 'string' || snap.rd.k.length > 12 || !int(snap.rd.l, 0, snap.rift | 0) || (snap.rd.t != null && !int(snap.rd.t, 0, 600)))) bad.push('today');
    if (snap.mad != null && snap.mad !== 0 && !(int(snap.mad, 60, 1e9) && (snap.depth | 0) >= 40)) bad.push('mad');
    const numMap = (o, n) => o == null || (typeof o === 'object' && !Array.isArray(o) && Object.keys(o).length <= n && Object.keys(o).every(k => k.length <= 8 && typeof o[k] === 'number' && o[k] > 0));
    // firsts: known milestones only, dated after the release and not in the future, and actually reached
    const FS = { boss: 0, d5: 0, d10: 0, d20: 0, d30: 0, d40: 0, d50: 0, d60: 0, d65: 0, d80: 0, uq: 0, r4: 0, r5: 0, r6: 0, asc: 0, evo: 0, all14: 0,
      rift5: 0, rift15: 0, rift30: 0, rift45: 0, rift60: 0, rift80: 0 };
    const fsOk = k => {
      const v = snap.fs[k];
      if (!(k in FS) || v < 1.75e12 || (typeof snap.ts === 'number' && v > snap.ts + 864e5)) return false;
      if (/^d\d+$/.test(k) && (snap.depth | 0) < +k.slice(1)) return false;
      if (/^rift\d+$/.test(k) && (snap.rift | 0) < +k.slice(4)) return false;
      // 'all14' was earned when there were 14 uniques; later ones don't take it away
      return k !== 'all14' || (snap.uq | 0) >= 14;
    };
    if (!numMap(snap.fs, 24) || (snap.fs && !Object.keys(snap.fs).every(fsOk))) bad.push('firsts');
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
