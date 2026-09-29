// BTTN — the hero: class, level, 4 gear slots, loot rolls, enchanting,
// mobs that march on the Button, combat and the power score used by the
// ladder. DOM-free like game.js, so the simulator (and later a ladder
// server) can run the exact same code.
(function (G) {
  'use strict';
  const { chance, pick, rand, randInt, emit } = G;
  const TUNE = G.TUNE;
  Object.assign(TUNE, {
    mobBase: 10, mobGrowth: 1.24, mobAtkBase: 4, mobAtkGrowth: 1.2,
    mobWalk: 9, spawnEvery: 1.3, eliteChance: 0.06,
    bossHpMobs: 25, bagMax: 30, clickVolley: 0.6, petVolley: 0.25,
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
  // rate = attacks/s, mult = damage per attack, targets = mobs hit per attack
  G.WEAPONS = {
    dagger: { rate: 3.2, mult: 0.42, targets: 1, col: '#e6ebf2', name: { ru: 'Кинжал', en: 'Dagger' } },
    sword:  { rate: 1.6, mult: 0.85, targets: 2, col: '#ffffff', name: { ru: 'Меч', en: 'Sword' } },
    katana: { rate: 2.2, mult: 0.65, targets: 1, col: '#d4b0ff', name: { ru: 'Катана', en: 'Katana' } },
    scythe: { rate: 1.1, mult: 1.0, targets: 4, col: '#ff4f7e', name: { ru: 'Коса', en: 'Scythe' } },
    bow:    { rate: 1.3, mult: 0.95, targets: 3, col: '#9be15d', name: { ru: 'Лук', en: 'Bow' } },
    staff:  { rate: 1.4, mult: 1.0, targets: 2, col: '#5ab4ff', name: { ru: 'Посох', en: 'Staff' } },
    wand:   { rate: 2.6, mult: 0.5, targets: 1, col: '#ffe27a', name: { ru: 'Палочка', en: 'Wand' } },
  };
  const ARMOR_MUL = { armor: 1, boot: 0.7, shield: 1.2, helm: 0.9, cloak: 0.85 };
  G.ABILITIES = {
    potion: { cd: 18, name: { ru: 'Лечение', en: 'Heal' }, desc: { ru: 'Чинит кнопку на 60%', en: 'Repairs the Button by 60%' } },
    tome:   { cd: 24, name: { ru: 'Благословение', en: 'Blessing' }, desc: { ru: 'Чинит 30% и урон ×1.5 на 6 сек', en: 'Repairs 30%, damage ×1.5 for 6s' } },
    scroll: { cd: 40, name: { ru: 'Жадность', en: 'Greed' }, desc: { ru: 'Мобы роняют сундуки втрое чаще 12 сек', en: 'Mobs drop chests 3× as often for 12s' } },
    skull:  { cd: 16, name: { ru: 'Взрыв черепа', en: 'Skull Blast' }, desc: { ru: '8 ударов по всем врагам', en: 'Hits every enemy for 8 attacks' } },
    orb:    { cd: 24, name: { ru: 'Стазис', en: 'Stasis' }, desc: { ru: 'Замедляет мобов, урон +30% на 6 сек', en: 'Slows mobs, +30% damage for 6s' } },
    wing:   { cd: 30, name: { ru: 'Крылья', en: 'Wings' }, desc: { ru: 'Скорость атаки ×2 на 8 сек', en: 'Attack speed ×2 for 8s' } },
    egg:    { cd: 30, name: { ru: 'Звездопад', en: 'Starfall' }, desc: { ru: '15 ударов по цели и 4 по всем', en: '15 hits on the target, 4 on everyone' } },
  };
  G.CLASSES = [
    { id: 'knight', spr: 'h_knight', weapons: ['sword', 'katana', 'scythe'], starter: 'steel_sword', hp: 1.3, crit: 0, extra: 0,
      name: { ru: 'Рыцарь', en: 'Knight' }, desc: { ru: 'Мечи, катаны и косы. Кнопка крепче на 30%.', en: 'Swords, katanas and scythes. The Button is 30% tougher.' } },
    { id: 'archer', spr: 'h_archer', weapons: ['bow'], starter: 'short_bow', hp: 1, crit: 0, extra: 1,
      name: { ru: 'Лучник', en: 'Archer' }, desc: { ru: 'Луки. Стрелы пробивают ещё одного врага.', en: 'Bows. Arrows pierce one more enemy.' } },
    { id: 'wizard', spr: 'h_wizard', weapons: ['staff', 'wand'], starter: 'twig_staff', hp: 1, crit: 0, extra: 0, spd: 0.15,
      name: { ru: 'Маг', en: 'Wizard' }, desc: { ru: 'Посохи и палочки. Атакует на 15% быстрее.', en: 'Staves and wands. Attacks 15% faster.' } },
    { id: 'rogue', spr: 'h_rogue', weapons: ['dagger'], starter: 'rusty_dagger', hp: 1, crit: 0.1, extra: 0,
      name: { ru: 'Разбойник', en: 'Rogue' }, desc: { ru: 'Кинжалы. +10% шанс крита.', en: 'Daggers. +10% crit chance.' } },
  ];
  G.CLASS_BY_ID = {}; G.CLASSES.forEach(c => G.CLASS_BY_ID[c.id] = c);
  G.AFFIXES = {
    dmg:   { v: [0.04, 0.10], name: { ru: 'Урон', en: 'Damage' } },
    spd:   { v: [0.03, 0.08], name: { ru: 'Скорость атаки', en: 'Attack speed' } },
    crit:  { v: [0.01, 0.03], name: { ru: 'Шанс крита', en: 'Crit chance' } },
    critd: { v: [0.10, 0.30], name: { ru: 'Сила крита', en: 'Crit power' }, x: true },
    hp:    { v: [0.05, 0.12], name: { ru: 'Прочность кнопки', en: 'Button toughness' } },
    gold:  { v: [0.04, 0.12], name: { ru: 'Золото', en: 'Gold' } },
    luck:  { v: [0.02, 0.06], name: { ru: 'Удача', en: 'Luck' } },
    xp:    { v: [0.05, 0.15], name: { ru: 'Опыт', en: 'Experience' } },
    shard: { v: [0.05, 0.15], name: { ru: 'Осколки', en: 'Shards' } },
  };
  const AFFIX_COUNT = [0, 1, 1, 2, 2, 3, 3];
  const SALVAGE = [1, 2, 4, 8, 16, 32, 64];
  G.ENCHANT_MAX = 20;

  // ---------- State ----------
  function newHero() {
    return { cls: null, lvl: 1, xp: 0, eq: { weapon: null, ability: null, armor: null, ring: null }, bag: [], gu: 0,
      shards: 0, hp: TUNE.baseHp, auto: 1, salv: 1, cast: 1, kills: 0, elites: 0, fresh: 0 };
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
  Object.assign(R, { mobs: [], mobUid: 0, spawnT: 2, heroAcc: 0, abilCd: 0, hb: {}, stun: 0, bossAtkT: 2 });

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
  function combat(eq, d) {
    const S = G.S, h = S.hero;
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
    d.heroHit = c.hit * buffDmg;
    d.heroRate = c.rate * (R.hb.wing > 0 ? 2 : 1);
    d.heroHp = c.hp;
    d.heroDps = c.dps * buffDmg;
    d.power = c.power;
    if (h.hp > c.hp) h.hp = c.hp;
    if (c.power > S.rec.maxPower) S.rec.maxPower = c.power;
  };

  // ---------- Mobs & combat ----------
  function mobHp(d) { return TUNE.mobBase * Math.pow(TUNE.mobGrowth, d); }
  function mobAtk(d) { return TUNE.mobAtkBase * Math.pow(TUNE.mobAtkGrowth, d); }
  G.mobHp = mobHp; G.mobAtk = mobAtk;
  G.bossHp = d => mobHp(d) * TUNE.bossHpMobs * (G.isLord(d) ? TUNE.lordHp : 1);
  const maxAlive = d => 6 + Math.min(6, Math.floor(d / 5));
  function xpNeed(l) { return Math.floor(15 * Math.pow(1.2, l - 1) + 10 * l); }
  G.xpNeed = xpNeed;

  function spawnMob() {
    const S = G.S;
    const elite = chance(TUNE.eliteChance);
    const hp = mobHp(S.depth) * (elite ? 4 : 1);
    const m = { id: ++R.mobUid, hp, max: hp, p: 0, sp: 1 / (TUNE.mobWalk * rand(0.85, 1.15)), atkT: 0, elite, a: G.rng() };
    R.mobs.push(m);
    emit('mobSpawn', m);
  }
  function targets(n) {
    if (R.boss) return [];
    const list = R.mobs.slice().sort((a, b) => b.p - a.p);
    const fi = R.focus ? list.findIndex(m => m.id === R.focus) : -1;
    if (fi > 0) list.unshift(list.splice(fi, 1)[0]);
    else if (fi < 0) R.focus = null;
    return list.slice(0, n);
  }
  function dealHit(m, dmg) {
    m.hp -= dmg;
    if (m.hp <= 0 && !m.dead) killMob(m);
  }
  function killMob(m) {
    const S = G.S, D = G.D, h = S.hero;
    m.dead = true;
    R.mobs.splice(R.mobs.indexOf(m), 1);
    const k = m.elite ? 3 : 1;
    const gold = D.incomeRef * TUNE.mobGold * k;
    G.addGold(gold, 'mob');
    gainXp((1 + S.depth) * k * (D.xpMult || 1));
    h.kills++; if (m.elite) h.elites++;
    S.bossMeter++;
    let chest = null;
    const p = m.elite ? 1 : TUNE.mobChest * (R.hb.scroll > 0 ? 3 : 1);
    if (chance(p)) chest = G.spawnChest();
    G.questProgress('kills', 1);
    emit('mobDie', m, gold, chest);
  }
  function gainXp(x) {
    const S = G.S, h = S.hero;
    h.xp += x;
    let up = false;
    while (h.xp >= xpNeed(h.lvl)) { h.xp -= xpNeed(h.lvl); h.lvl++; up = true; }
    if (up) {
      if (h.lvl > S.rec.maxLevel) S.rec.maxLevel = h.lvl;
      G.dirty(); G.recalc();
      h.hp = G.D.heroHp;
      emit('levelUp', h.lvl);
    }
  }
  G.gainXp = gainXp;

  // One attack of the hero's weapon (k scales it: clicks and pets fire partial volleys)
  function attack(k, src) {
    const D = G.D;
    if (!G.S.hero.cls) return;
    const crit = chance(D.hero.crit);
    const dmg = D.heroHit * k * (crit ? D.hero.critMult : 1);
    if (R.boss) {
      G.hitBoss(dmg * D.bossMult);
      emit('heroAttack', { boss: true, crit, src, dmg });
      return;
    }
    const ts = targets(D.hero.targets);
    if (!ts.length) return;
    emit('heroAttack', { ids: ts.map(m => m.id), crit, src, dmg });
    for (const m of ts) dealHit(m, dmg);
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
        for (const m of R.mobs.slice()) dealHit(m, hit * 8);
        break;
      case 'egg':
        if (R.boss) G.hitBoss(hit * 15 * D.bossMult);
        else { const t = targets(1)[0]; if (t) dealHit(t, hit * 11); }
        for (const m of R.mobs.slice()) dealHit(m, hit * 4);
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
    // spawn
    if (!R.boss && R.stun <= 0 && R.mobs.length < maxAlive(S.depth)) {
      R.spawnT -= dt;
      if (R.spawnT <= 0) { R.spawnT = TUNE.spawnEvery * rand(0.7, 1.3); spawnMob(); }
    }
    // walk & bite
    const slow = R.hb.orb > 0 ? 0.4 : 1;
    const atk = mobAtk(S.depth);
    for (const m of R.mobs.slice()) {
      if (m.p < 1) m.p = Math.min(1, m.p + m.sp * dt * slow);
      else { m.atkT -= dt; if (m.atkT <= 0) { m.atkT = 1; hurtButton(atk * (m.elite ? 2 : 1)); emit('mobBite', m); } }
    }
    // boss hits the button too
    if (R.boss) {
      R.bossAtkT -= dt;
      if (R.bossAtkT <= 0) { R.bossAtkT = 2; hurtButton(atk * (R.boss.lord ? 5 : 3)); }
    }
    // hero attacks
    R.heroAcc += dt * D.heroRate;
    let guard = 0;
    while (R.heroAcc >= 1 && guard++ < 30) { R.heroAcc -= 1; attack(1, 'auto'); }
    if (R.heroAcc > 5) R.heroAcc = 0;
    // autocast
    if (h.cast && R.abilCd <= 0 && h.eq.ability) {
      const type = G.ITEM_TYPE[h.eq.ability.id];
      const want = type === 'potion' ? h.hp < D.heroHp * 0.5
        : type === 'tome' ? (h.hp < D.heroHp * 0.7 || R.boss)
        : R.boss || R.mobs.length >= 3;
      if (want) castAbility();
    }
  };

  G.heroBossStart = function () {
    for (const m of R.mobs) emit('mobFlee', m);
    R.mobs.length = 0;
    R.bossAtkT = 2;
  };
  G.heroReset = function (keepClass) {
    const h = G.S.hero;
    h.lvl = 1; h.xp = 0;
    if (!keepClass) h.cls = null;
    R.mobs.length = 0; R.hb = {}; R.abilCd = 0; R.stun = 0;
    G.S.rec.runStart = Date.now();
    G.dirty(); G.recalc();
    h.hp = G.D.heroHp || TUNE.baseHp;
  };

  // ---------- Ladder snapshot ----------
  // A compact, canonical description of the character. A future ladder server
  // recomputes power from this with the same combat() code, so a client
  // can't just send a big number.
  G.ladderSnapshot = function () {
    const S = G.S, h = S.hero, D = G.D;
    const gear = {};
    for (const s of G.SLOTS) { const g = h.eq[s]; gear[s] = g ? { id: g.id, r: g.r, il: g.il, e: g.e, a: g.a } : null; }
    return {
      v: 1, id: S.profile.id, name: S.profile.name || '', cls: h.cls, lvl: h.lvl,
      power: D.power || 0, bestDepth: S.bestDepth, maxPower: S.rec.maxPower, ascensions: S.ascensions,
      fame: S.fameTotal, gear, ts: Date.now(),
    };
  };
})(globalThis.G = globalThis.G || {});
