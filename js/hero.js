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
  G.perk = perk;

  // ---------- State ----------
  function newHero() {
    return { cls: null, lvl: 1, xp: 0, eq: { weapon: null, ability: null, armor: null, ring: null }, bag: [], gu: 0,
      shards: 0, hp: TUNE.baseHp, auto: 1, salv: 1, cast: 1, kills: 0, elites: 0, fresh: 0,
      perks: {}, perkPts: 0, offer: null, offerT: 0, autoPerk: 1 };
  }
  G.newHero = newHero;
  function ensureHero(S) {
    S.hero = Object.assign(newHero(), S.hero || {});
    S.hero.eq = Object.assign({ weapon: null, ability: null, armor: null, ring: null }, S.hero.eq || {});
    if (!Array.isArray(S.hero.bag)) S.hero.bag = [];
    if (!S.profile) S.profile = { id: Math.random().toString(36).slice(2, 10), name: '' };
    S.rec = Object.assign({ maxPower: 0, maxLevel: 1, madTime: 0, runStart: Date.now() }, S.rec || {});
  }
  G.ensureHero = ensureHero;

  const R = G.R;
  ensureHero(G.S);
  Object.assign(R, { mobs: [], mobUid: 0, hordeAcc: 0, surgeT: 20, surge: 0, heroAcc: 0, abilCd: 0, hb: {}, stun: 0, bossAtkT: 2 });

  // ---------- Gear ----------
  function rollAffixes(r) {
    const keys = Object.keys(G.AFFIXES), out = [];
    const n = AFFIX_COUNT[r];
    while (out.length < n) {
      const k = pick(keys);
      if (out.some(a => a[0] === k)) continue;
      const v = G.AFFIXES[k].v;
      out.push([k, +(G.lerp(v[0], v[1], G.rng()) * (1 + 0.35 * r)).toFixed(4)]);
    }
    return out;
  }
  function makeGear(id, il) {
    const it = G.ITEM_BY_ID[id], h = G.S.hero;
    return { u: ++h.gu, id, r: it.r, il: Math.max(0, il | 0), e: 0, a: rollAffixes(it.r) };
  }
  G.makeGear = makeGear;
  const enchantMul = g => 1 + 0.12 * g.e;
  // The item's main stat: damage per hit, button HP, or % bonus
  function mainStat(g) {
    const type = G.ITEM_TYPE[g.id], slot = SLOT_OF_TYPE[type];
    const scale = G.RMUL[g.r] * Math.pow(1.16, g.il) * enchantMul(g);
    if (slot === 'weapon') return 8 * scale;
    if (slot === 'armor') return 60 * scale * ARMOR_MUL[type];
    if (slot === 'ring') return 0.04 * G.RMUL[g.r] * enchantMul(g) * (1 + g.il * 0.02);
    return 0.02 * G.RMUL[g.r] * enchantMul(g) * (1 + g.il * 0.02);
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

  function gainGear(it, srcTier) {
    const S = G.S, h = S.hero;
    if (!h) return null;
    const g = makeGear(it.id, S.depth + (chance(0.35) ? 1 : 0));
    h.fresh++;
    const slot = G.slotOf(g.id);
    let equipped = false;
    if (h.auto && h.cls) {
      const cur = h.eq[slot];
      if (!cur || powerWith(slot, g) > powerWith(slot, cur)) { equip(g, true); equipped = true; }
    }
    if (!equipped) {
      if (h.salv && g.r < h.salv) { salvage(g, true); return g; }
      h.bag.push(g);
    }
    while (h.bag.length > TUNE.bagMax) {
      {
        // Drop the weakest item in the bag into shards
        let worst = null, ws = Infinity;
        for (const b of h.bag) { const s = powerWith(G.slotOf(b.id), b); if (s < ws) { ws = s; worst = b; } }
        salvage(worst, true);
      }
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
    for (const g of h.bag.slice()) if (g.r < r) { v += salvage(g, true); n++; }
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
    d.goldMult *= 1 + (aff.gold || 0);
    d.luck += aff.luck || 0;
    d.xpMult = 1 + (aff.xp || 0);
    d.shardMult = 1 + (aff.shard || 0);
  };
  G.heroFinish = function (d) {
    const S = G.S, h = S.hero;
    if (!h) return;
    d.heroMult = (d.heroMult || 1) * (1 + 0.005 * S.fameTotal) * (1 + 0.02 * (d.heroClasses || 0));
    const c = combat(h.eq, d);
    const buffDmg = (R.hb.tome > 0 ? 1.5 : 1) * (R.hb.orb > 0 ? 1.3 : 1);
    d.hero = c;
    const might = 1 + 0.12 * perk('might'), frenzy = 1 + 0.12 * perk('frenzy');
    d.heroHit = c.hit * buffDmg * might;
    d.heroRate = c.rate * (R.hb.wing > 0 ? 2 : 1) * frenzy;
    d.heroHp = c.hp * (1 + 0.2 * perk('bulwark'));
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
    fodder: { w: 0.03, spd: 1.3, gold: 1 },
    brute:  { w: 1, spd: 1, gold: 1 },
    magic:  { w: 2, spd: 1.05, gold: 1.25 }, // blue champions, they come in pairs
    rare:   { w: 6, spd: 0.9, gold: 1.5 },   // yellow, named, one modifier, a pack of minions
  };
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
  const mightRatio = () => (G.D.heroDps || 0) / mobHp(G.S.depth);
  G.mightRatio = mightRatio;
  // The Horde answers strength: a Warden who kills faster faces a bigger, heavier
  // flow, so a stronger Warden clears lands (and earns gold and XP) faster
  const hordeScale = () => G.clamp(mightRatio() / TUNE.hordeRef, 0.4, TUNE.hordeMax);
  G.hordeScale = hordeScale;
  function makeMob(kind, a, p, add) {
    const K = G.MOB_KINDS[kind];
    const w = K.w * (add ? 1 : Math.max(1, (R.hs || 1) / 1.5));
    const hp = mobHp(G.S.depth) * w;
    const m = { id: ++R.mobUid, kind, w, hp, max: hp, p, a: clamp01(a), sp: K.spd / (TUNE.mobWalk * rand(0.85, 1.15)), atkT: 0, add: !!add };
    if (kind === 'rare') {
      m.mod = pick(Object.keys(G.RARE_MODS));
      m.name = pick(RARE_A) + ' ' + pick(RARE_B);
      if (m.mod === 'hasted') m.sp *= 1.7;
    }
    R.mobs.push(m);
    emit('mobSpawn', m);
    return m;
  }
  // One pack, all from one direction
  function spawnPack(add) {
    const d = G.S.depth, a = G.rng(), roll = G.rng();
    const fodder = (n, spread) => { for (let i = 0; i < n; i++) makeMob('fodder', a + rand(-spread, spread), -rand(0, 0.1), add); };
    if (add) { fodder(randInt(10, 16), 0.07); return; }
    if (d >= 1 && roll < 0.03) { makeMob('rare', a, 0); fodder(16, 0.07); emit('rareSpawn'); }
    else if (roll < 0.1) { makeMob('magic', a, 0); makeMob('magic', a + 0.03, -0.04); fodder(10, 0.06); }
    else if (roll < 0.35) { makeMob('brute', a, 0); fodder(8, 0.06); }
    else fodder(randInt(14, 26), 0.08);
  }

  // Frontmost mobs first (they're about to bite), the tapped one before all.
  // reach limits how far from the Button the hero can strike.
  function targets(n, reach) {
    const minP = reach ? (1 - reach) / 0.88 : -1;
    const list = R.mobs.filter(m => m.p >= minP).sort((a, b) => b.p - a.p);
    const fi = R.focus ? list.findIndex(m => m.id === R.focus) : -1;
    if (fi > 0) list.unshift(list.splice(fi, 1)[0]);
    else if (fi < 0) R.focus = null;
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

  function dealHit(m, dmg, src, crit) {
    if (m.dead) return;
    m.hp -= m.mod === 'stone' ? dmg * 0.5 : dmg;
    if (m.hp <= 0) { m.over = -m.hp / m.max; m.crit = crit; killMob(m, src); }
  }
  function killMob(m, src) {
    const S = G.S, D = G.D, h = S.hero;
    m.dead = true;
    const i = R.mobs.indexOf(m);
    if (i >= 0) R.mobs.splice(i, 1);
    const K = G.MOB_KINDS[m.kind];
    const gold = D.incomeRef * TUNE.mobGold * m.w * K.gold * (m.add ? 0.4 : 1) * (1 + 0.2 * perk('greed'));
    G.addGold(gold, 'mob');
    gainXp(2.5 * (1 + S.depth) * m.w * (m.kind === 'rare' ? 1.5 : 1) * (D.xpMult || 1));
    h.kills++;
    if (m.kind === 'magic' || m.kind === 'rare') h.elites++;
    let chest = null;
    if (!m.add) {
      S.bossMeter += m.w;
      const greed = (R.hb.scroll > 0 ? 3 : 1) * (1 + 0.25 * perk('loot'));
      const p = m.kind === 'rare' ? 1 : m.kind === 'magic' ? 0.4 * greed : TUNE.mobChest * m.w * greed;
      if (chance(p)) chest = dropBag(m);
      if (m.kind === 'rare' && chance(0.5)) dropBag(m);
    }
    if (perk('leech')) h.hp = Math.min(D.heroHp, h.hp + D.heroHp * 0.003 * perk('leech') * (m.kind === 'fodder' ? 1 : 4));
    G.questProgress('kills', 1);
    emit('mobDie', m, gold, chest, src);
    if (m.mod === 'splitter') for (let k = 0; k < 6; k++) makeMob('fodder', m.a + rand(-0.03, 0.03), m.p - rand(0, 0.06), m.add);
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
    if (!open.length || !(h.perkPts > 0)) { h.offer = null; h.perkPts = 0; return; }
    const pickN = [];
    while (pickN.length < Math.min(3, open.length)) { const k = pick(open); if (!pickN.includes(k)) pickN.push(k); }
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
    emit('perk', id, h.perks[id]);
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
    let ts, aoe = wt.aoe, sp = wt.sp;
    if (src === 'click') { const t = R.mobs.length ? smiteTarget() : null; ts = t ? [t] : []; aoe = TUNE.smiteR; sp = 0.5; }
    else if (src === 'pet') { ts = targets(1, 0.7); aoe = 0.05; sp = 1; }
    else { ts = targets(D.hero.targets + perk('multi'), Math.min(1, wt.reach * (1 + 0.2 * perk('reach')))); aoe = wt.aoe * (1 + 0.3 * perk('cleave')); }
    // nothing in reach: the hero holds the swing for when something walks in
    if (!R.boss && !ts.length) return false;
    const crit = chance(D.hero.crit);
    const dmg = D.heroHit * k * (crit ? D.hero.critMult : 1);
    if (R.boss) {
      G.hitBoss(dmg * D.bossMult);
      emit('heroAttack', { boss: true, crit, src, dmg });
    }
    if (!ts.length) return true;
    const splash = around(ts, aoe);
    emit('heroAttack', { ids: ts.map(m => m.id), splash: splash.map(m => m.id), aoe, crit, src, dmg });
    if (src === 'click') for (const m of ts.concat(splash)) m.p = Math.max(-0.05, m.p - 0.05 / Math.sqrt(m.w));
    for (const m of ts) dealHit(m, dmg, src, crit);
    for (const m of splash) dealHit(m, dmg * sp, src, crit);
    // Chain Lightning arcs from the first target to three more
    if (src === 'auto' && perk('chain') && chance(0.15 * perk('chain'))) {
      const from = ts[0], near = around([from], 0.4).filter(m => !m.dead).slice(0, 3);
      if (near.length) { emit('chain', from, near); for (const m of near) dealHit(m, dmg * 0.6, 'chain', false); }
    }
    // Heavy Hand: more bolts per click, each on a different pack
    if (src === 'click' && perk('thunder') && !attack.inThunder) {
      attack.inThunder = true;
      for (let i = 0; i < perk('thunder'); i++) {
        const hitSet = new Set(ts.concat(splash));
        const cand = targets(8, TUNE.smiteReach).filter(m => !hitSet.has(m) && !m.dead);
        if (!cand.length) break;
        const t = cand[Math.floor(G.rng() * cand.length)], sp2 = around([t], TUNE.smiteR);
        emit('heroAttack', { ids: [t.id], splash: sp2.map(m => m.id), aoe: TUNE.smiteR, crit, src, dmg, extra: true });
        dealHit(t, dmg, src, crit); for (const m of sp2) dealHit(m, dmg * 0.5, src, crit);
      }
      attack.inThunder = false;
    }
    return true;
  }
  G.heroVolley = attack;

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
    R.mobs.length = 0;
    S.bossMeter = Math.floor(S.bossMeter * 0.5);
    if (R.boss) G.fleeBoss();
    emit('buttonBreak');
  }

  function castAbility() {
    const S = G.S, D = G.D, h = S.hero;
    const g = h.eq.ability;
    if (!g || R.abilCd > 0 || !h.cls) return false;
    const type = G.ITEM_TYPE[g.id], ab = G.ABILITIES[type];
    R.abilCd = ab.cd * (1 - Math.min(0.5, 0.03 * g.e));
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
    // regen
    h.hp = Math.min(D.heroHp, h.hp + D.heroHp * 0.03 * dt);
    // the horde: a steady flow of packs, with a surge every half a minute
    if (R.stun <= 0) {
      if (R.boss) {
        R.hordeAcc = Math.min(3, R.hordeAcc + dt * TUNE.hordeRate * TUNE.addRate * (R.boss.lord ? 1.6 : 1));
        if (R.hordeAcc >= 1 && aliveWeight(true) < 2) { R.hordeAcc -= 0.5; spawnPack(true); }
      } else {
        if (R.surge > 0) R.surge -= dt;
        else if ((R.surgeT -= dt) <= 0) { R.surgeT = TUNE.surgeEvery * rand(0.8, 1.2); R.surge = TUNE.surgeLen; emit('surge'); }
        const surging = R.surge > 0;
        R.hs = hordeScale();
        R.hordeAcc = Math.min(4 * R.hs, R.hordeAcc + dt * TUNE.hordeRate * R.hs * (surging ? TUNE.surgeMul : 1));
        const cap = hordeCap(S.depth) * Math.max(1, R.hs / 1.5) * (surging ? 1.5 : 1);
        if (R.hordeAcc >= 1 && aliveWeight(false) < cap) {
          const w0 = aliveWeight(false);
          spawnPack(false);
          R.hordeAcc -= Math.max(0.5, aliveWeight(false) - w0);
        }
      }
    }
    // walk & bite
    const slow = R.hb.orb > 0 ? 0.4 : 1;
    const atk = mobAtk(S.depth);
    for (const m of R.mobs.slice()) {
      if (m.p < 1) m.p = Math.min(1, m.p + m.sp * dt * slow);
      else {
        m.atkT -= dt;
        if (m.atkT <= 0) { m.atkT = 1; hurtButton(atk * m.w * (m.mod === 'frenzied' ? 2 : 1)); emit('mobBite', m); if (R.stun > 0) break; }
      }
    }
    // the boss hits the button too
    if (R.boss) {
      R.bossAtkT -= dt;
      if (R.bossAtkT <= 0) { R.bossAtkT = 2; hurtButton(atk * (R.boss.lord ? 5 : 3)); }
    }
    // perks that work on their own
    const hit = D.heroHit;
    if (perk('blades') && (R.bladeT = (R.bladeT || 0) - dt) <= 0) {
      R.bladeT = 0.45;
      const band = R.mobs.filter(m => { const r = 1 - 0.88 * m.p; return r > 0.12 && r < 0.36; });
      for (let i = 0; i < perk('blades'); i++) {
        if (R.boss && i === 0) G.hitBoss(hit * 0.25 * D.bossMult);
        const m = band.length ? band[Math.floor(G.rng() * band.length)] : null;
        if (m && !m.dead) { emit('bladeHit', m); dealHit(m, hit * 0.6, 'blade', false); }
      }
    }
    if (perk('aura') && (R.auraT = (R.auraT || 0) - dt) <= 0) {
      R.auraT = 0.5;
      const burn = hit * 0.18 * perk('aura');
      const near = R.mobs.filter(m => 1 - 0.88 * m.p < 0.3);
      if (near.length) emit('auraTick', near);
      for (const m of near) dealHit(m, burn, 'aura', false);
    }
    if (perk('nova') && (R.novaT = (R.novaT == null ? 6 : R.novaT) - dt) <= 0) {
      R.novaT = 7.5 - perk('nova');
      const near = R.mobs.filter(m => 1 - 0.88 * m.p < 0.5);
      emit('nova');
      for (const m of near) dealHit(m, hit * 2.5, 'nova', false);
      if (R.boss) G.hitBoss(hit * 2.5 * D.bossMult);
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

  G.heroBossStart = function () {
    for (const m of R.mobs) emit('mobFlee', m);
    R.mobs.length = 0;
    R.bossAtkT = 2; R.hordeAcc = 0.5; R.surge = 0;
  };
  // A slain boss takes its adds with it; a boss that leaves takes them away
  G.heroBossEnd = function (win) {
    for (const m of R.mobs) { m.dead = true; if (win) { m.over = 2; emit('mobDie', m, 0, null, 'boss'); } else emit('mobFlee', m); }
    R.mobs.length = 0;
    R.hordeAcc = 0; R.surgeT = Math.max(R.surgeT, 12);
  };
  G.heroReset = function (keepClass) {
    const h = G.S.hero;
    h.lvl = 1; h.xp = 0;
    h.perks = {}; h.perkPts = 0; h.offer = null;
    if (!keepClass) h.cls = null;
    R.mobs.length = 0; R.hb = {}; R.abilCd = 0; R.stun = 0; R.hordeAcc = 0; R.surge = 0; R.surgeT = 20;
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
    for (const s of G.SLOTS) { const g = h.eq[s]; gear[s] = g ? { id: g.id, r: g.r, il: g.il, e: g.e, a: g.a } : null; }
    const snap = {
      v: 1, name: (S.profile.name || '').slice(0, 16), cls: h.cls, lvl: h.lvl,
      depth: S.bestDepth, asc: S.ascensions, fame: S.fameTotal, mad: Math.round(S.rec.madTime || 0), gear, ts: Date.now(),
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
    if (!int(snap.lvl, 1, 30 + 2 * (snap.depth | 0))) bad.push('level');
    if (typeof snap.name !== 'string' || snap.name.length > 16) bad.push('name');
    const gear = snap.gear || {};
    for (const s of G.SLOTS) {
      const g = gear[s];
      if (g == null) continue;
      const it = G.ITEM_BY_ID[g.id];
      if (!it || G.slotOf(g.id) !== s || g.r !== it.r) { bad.push(s + ':item'); continue; }
      if (!int(g.il, 0, (snap.depth | 0) + 3)) bad.push(s + ':ilvl');
      if (!int(g.e, 0, G.ENCHANT_MAX)) bad.push(s + ':enchant');
      if (!Array.isArray(g.a) || g.a.length > AFFIX_COUNT[g.r]) { bad.push(s + ':affixes'); continue; }
      const seen = {};
      for (const a of g.a) {
        const def = Array.isArray(a) && G.AFFIXES[a[0]];
        if (!def || seen[a[0]] || typeof a[1] !== 'number') { bad.push(s + ':affix'); break; }
        seen[a[0]] = 1;
        const k = 1 + 0.35 * g.r;
        if (a[1] < def.v[0] * k - 1e-3 || a[1] > def.v[1] * k + 1e-3) { bad.push(s + ':range'); break; }
      }
    }
    if (typeof snap.power === 'number' && !bad.length && G.ladderPower(snap) !== snap.power) bad.push('power');
    return bad;
  };
})(globalThis.G = globalThis.G || {});
