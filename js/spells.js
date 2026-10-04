// BTTN 3.4 — HAND SPELLS. While the party fights, the Hand on the other side of the glass now and then
// casts a big spell into the field: a Meteor, a Meteor Shower, a Firestorm, a Blizzard, a Tornado, a Holy
// Pillar, an Earthquake, a Poison Cloud, Arcane Orbs, Sword Rain, a Chain Storm, a Lava eruption or Shadow
// Claws. Manual clicks charge it fastest, but time in the field and kills charge it too, so the idle see
// them as well. Each one is a few Warden hits on the mobs in its area (and a modest chunk on a boss).
// Every land also has an element (G.landElement) that the show uses to dress the Hand's click strike.
//
// No DOM here: it runs in the Node playtests too, and all its randomness goes through G.rng.
// The show is js/spells_fx.js. Events:
//   spellCast(sp)            a spell starts: sp = { id, kind, x, y, T, ev: [...], el, dir, ... }
//                            (x, y and every ev's x, y are arena coordinates, as G.mobXY gives them)
//   spellHit(sp, ev, mobs)   one of its strikes lands (ev.tag says what it is: impact, ring, tick, ...)
//   spellEnd(sp)             it is over
// For testing: G.forceSpell(kind), G.SPELLS (the kinds), G.spellState().
(function (G) {
  'use strict';
  if (!G.hook || !G.dealHit || !G.mobXY) return; // needs hero.js
  const { emit } = G;
  const R = G.R, TUNE = G.TUNE;
  const rnd = () => G.rng();
  const rr = (a, b) => a + rnd() * (b - a);

  Object.assign(TUNE, {
    spellOn: 1,          // 0 turns the spells off
    // (3.6: about one every 30 s for the idle, 15-20 s for a clicker; it was every 6-10 s)
    spellIdle: 40,       // seconds in the field that fill the charge by themselves (the idle's pace)
    spellClicks: 300,    // manual clicks that fill it (an active clicker's pace, on top of the time)
    spellKill: 0.0015,   // charge per kill...
    spellKillCap: 0.008, // ...but no more than this much a second from kills
    spellGap: 10,        // never two spells closer than this many seconds
    spellMinMobs: 4,     // on the open field, wait for at least this many mobs in sight
    spellPow: 1.4,         // all spell damage (each spell's own numbers are Warden hits, in G.SPELL_DEFS)
    spellBoss: 0.8,      // on a boss: this many seconds of the Warden's damage, per spell
    spellChill: 0.55,    // a chill takes this share of a mob's walk (and its bites) away
    spellHeal: 0.02,     // the Holy Pillar mends the Button by this share of its health
    spellFav: 2.5,       // a land's own spells come this many times more often
    spellArea: 1.25,     // all spell areas (each spell's own radius is in arena units, the field is 1 across)
  });

  // ---------- The lands' elements (the click strike's look) ----------
  // in G.REALMS order: Shoreline, Meadows, Deepwood, Highlands, Frostlands, Godlands, Abyss, The Void,
  // Sunken Library, Clockwork Foundry, Ember Wastes, Mirror Maze, Sky Citadel, The Moon, The Star Sea
  const ELEMENTS = G.LAND_ELEMENTS = ['water', 'bloom', 'roots', 'stone', 'frost', 'holy', 'hellfire', 'void',
    'arcane', 'spark', 'lava', 'prism', 'wind', 'moon', 'star'];
  const depth = () => (G.depthNow ? G.depthNow() : (G.S && G.S.depth) || 0);
  const landI = () => G.realmIndex(depth());
  G.landElement = () => ELEMENTS[landI() % ELEMENTS.length] || 'spark';

  // ---------- The spells ----------
  // name: the little word over it; col: its colour; fav: the lands (by element) that cast it more often;
  // hit: its main numbers, in Warden hits per mob it touches (see the builders below for the shape)
  const DEFS = G.SPELL_DEFS = {
    meteor:    { name: 'METEOR!',      col: '#ff7a2e', w: 1,   fav: ['lava', 'hellfire', 'stone', 'star'], hit: 8,   r: 0.2 },
    shower:    { name: 'METEOR SHOWER', col: '#ffb04a', w: 1,  fav: ['star', 'lava', 'moon'],             hit: 3,   r: 0.1, n: 7 },
    firestorm: { name: 'FIRESTORM',    col: '#ff5a2e', w: 1,   fav: ['hellfire', 'lava', 'spark'],        hit: 4.5 },
    blizzard:  { name: 'BLIZZARD',     col: '#9fe4ff', w: 1,   fav: ['frost', 'water', 'moon'],           hit: 0.8, r: 0.27, shatter: 1.8 },
    tornado:   { name: 'TORNADO',      col: '#d8f0e0', w: 1,   fav: ['wind', 'water', 'bloom'],           hit: 1.1, r: 0.14, max: 3 },
    holy:      { name: 'HOLY PILLAR',  col: '#ffe27a', w: 1,   fav: ['holy', 'moon', 'prism'],            hit: 7,   r: 0.16 },
    quake:     { name: 'EARTHQUAKE',   col: '#c8a070', w: 1,   fav: ['stone', 'roots', 'spark'],          hit: 2,   r: 0.34 },
    poison:    { name: 'POISON CLOUD', col: '#8ae04a', w: 1,   fav: ['roots', 'bloom', 'void'],           hit: 0.6, r: 0.22, n: 9 },
    orbs:      { name: 'ARCANE ORBS',  col: '#c88aff', w: 1,   fav: ['arcane', 'void', 'star'],           hit: 4.5, r: 0.07, n: 5 },
    swords:    { name: 'SWORD RAIN',   col: '#e4eaf6', w: 1,   fav: ['prism', 'holy', 'wind'],            hit: 2.2, r: 0.075, n: 14 },
    chain:     { name: 'CHAIN STORM',  col: '#7fe9ff', w: 1,   fav: ['spark', 'wind', 'arcane'],          hit: 3,   n: 4, hops: 5 },
    lava:      { name: 'ERUPTION',     col: '#ff4a1a', w: 1,   fav: ['lava', 'hellfire', 'stone'],        hit: 4.5, r: 0.19, pool: 0.5 },
    shadow:    { name: 'SHADOW CLAWS', col: '#b36bff', w: 1,   fav: ['void', 'hellfire', 'arcane'],       hit: 4,   r: 0.12, n: 3 },
  };
  const KINDS = G.SPELLS = Object.keys(DEFS);

  // ---------- Where ----------
  const st = () => (R.spell = R.spell || { m: 0, gap: 0, kAcc: 0, n: 0, last: null, live: [], uid: 0 });
  G.spellState = st;
  const xy = m => G.mobXY(m);
  // on screen (the arena's edge is off it, the top is under the HUD)
  // (3.6: G.mobX / G.mobY where it runs over the whole Horde: no array per mob)
  const mx = m => (G.mobX ? G.mobX(m) : xy(m)[0]), my = m => (G.mobY ? G.mobY(m) : xy(m)[1]);
  const inSight = m => { if (m.dead || m.gone || m.p < 0.16) return false; const x = mx(m), y = my(m); return Math.abs(x) < 0.78 && y > -0.6 && y < 0.56; };
  const sight = () => R.mobs.filter(inSight);
  const d2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
  // the thickest spot of the horde: a few mobs tried, the one with the most weight around it wins
  function dense(r, list, avoid) {
    list = list || sight();
    if (!list.length) {
      if (R.boss) return { x: 0, y: 0 }; // nothing else in sight: the boss, over the Button
      const a = rr(0.2, Math.PI - 0.2); return { x: Math.cos(a) * 0.45, y: Math.sin(a) * 0.4 };
    }
    let best = null, bs = -1;
    const tries = Math.min(list.length, 14);
    for (let i = 0; i < tries; i++) {
      const m = list[Math.floor(rnd() * list.length)], [x, y] = xy(m);
      if (avoid && avoid.some(a => d2(a.x, a.y, x, y) < r * r * 2.2)) continue;
      let s = 0;
      for (const o of list) { if (d2(x, y, mx(o), my(o)) <= r * r) s += Math.sqrt(o.w || 1); }
      s *= 1 + 0.4 * m.p; // nearer the Button counts for more
      if (s > bs) { bs = s; best = { x, y }; }
    }
    return best || dense(r, list);
  }

  // ---------- The shapes ----------
  // each builder fills sp.ev with strikes: { t, x, y, r, r0, hit, tag, max, chill, chillK, push, boss, heal, m, chain, sp }
  // boss: this strike's share of the spell's chunk on a boss (they add up to 1)
  const BUILD = {
    meteor(sp, d) {
      const c = dense(d.r); Object.assign(sp, c); sp.dir = rnd() < 0.5 ? -1 : 1; sp.T = 1.7;
      sp.ev.push({ t: 0.85, x: c.x, y: c.y, r: d.r, hit: d.hit, tag: 'impact', boss: 1, push: 0.04 });
    },
    shower(sp, d) {
      const list = sight(), c = dense(0.3, list); Object.assign(sp, c); sp.dir = rnd() < 0.5 ? -1 : 1;
      const pool = list.slice();
      for (let i = 0; i < d.n; i++) {
        let x, y;
        if (pool.length) { const m = pool.splice(Math.floor(rnd() * pool.length), 1)[0];[x, y] = xy(m); x += rr(-0.03, 0.03); y += rr(-0.03, 0.03); }
        else { const a = rr(0, Math.PI * 2), k = rr(0, 0.3); x = c.x + Math.cos(a) * k; y = c.y + Math.sin(a) * k; }
        sp.ev.push({ t: 0.55 + i * 0.2 + rr(0, 0.06), x, y, r: d.r, hit: d.hit, tag: 'impact', boss: 1 / d.n, push: 0.02 });
      }
      sp.T = sp.ev[sp.ev.length - 1].t + 0.8;
    },
    firestorm(sp, d) {
      // a ring of fire rolls out of the Button over the whole field; it burns each mob once
      sp.x = 0; sp.y = 0.02; sp.T = 1.6;
      for (let i = 0; i < 6; i++) { const r = 0.21 + 0.12 * i; sp.ev.push({ t: 0.12 + 0.14 * i, x: 0, y: 0.02, r, r0: r - 0.15, hit: d.hit, tag: 'ring', max: 1, boss: i ? 0 : 1, push: 0.015 }); }
    },
    blizzard(sp, d) {
      const c = dense(d.r); Object.assign(sp, c); sp.T = 3.1;
      for (let i = 0; i < 6; i++) sp.ev.push({ t: 0.35 + 0.35 * i, x: c.x, y: c.y, r: d.r, hit: d.hit, tag: 'tick', chill: 3, chillK: TUNE.spellChill, boss: 0.1 });
      sp.ev.push({ t: 2.6, x: c.x, y: c.y, r: d.r, hit: d.shatter, tag: 'shatter', boss: 0.4 });
    },
    tornado(sp, d) {
      // across the field at the horde's height, never over the Button itself
      const c = dense(0.2); let y = c.y;
      if (Math.abs(y) < 0.3) y = y < -0.12 ? -0.36 : 0.36;
      y = Math.max(-0.6, Math.min(0.5, y));
      const dir = c.x >= 0 ? 1 : -1, x0 = -0.95 * dir, x1 = 0.95 * dir, T = 2.8;
      Object.assign(sp, { x: x0, y, x0, x1, y0: y, dir, T: T + 0.4, wob: rr(0, 6) });
      const n = 13;
      for (let i = 0; i < n; i++) {
        const t = 0.2 + i * 0.2, k = t / T;
        sp.ev.push({ t, x: x0 + (x1 - x0) * k, y: y + Math.sin(k * 7 + sp.wob) * 0.05, r: d.r, hit: d.hit, tag: 'tick', max: d.max, boss: 1 / n, push: 0.035 });
      }
    },
    holy(sp, d) {
      const c = dense(d.r); Object.assign(sp, c); sp.T = 1.7;
      sp.ev.push({ t: 0.6, x: c.x, y: c.y, r: d.r, hit: d.hit, tag: 'impact', boss: 1, heal: TUNE.spellHeal });
      sp.ev.push({ t: 0.95, x: c.x, y: c.y, r: d.r * 1.6, r0: d.r, hit: 1, tag: 'ring' });
    },
    quake(sp, d) {
      const c = dense(d.r); Object.assign(sp, c); sp.T = 2.1; sp.seed = Math.floor(rnd() * 1e6);
      sp.ev.push({ t: 0.25, x: c.x, y: c.y, r: d.r, hit: d.hit, tag: 'pulse', chill: 1.2, chillK: 0.9, boss: 0.4 });
      sp.ev.push({ t: 0.85, x: c.x, y: c.y, r: d.r, hit: d.hit, tag: 'pulse', boss: 0.35 });
      sp.ev.push({ t: 1.45, x: c.x, y: c.y, r: d.r * 0.8, hit: d.hit * 0.75, tag: 'pulse', boss: 0.25 });
    },
    poison(sp, d) {
      const c = dense(d.r); Object.assign(sp, c); sp.T = 4.7;
      for (let i = 0; i < d.n; i++) sp.ev.push({ t: 0.4 + 0.45 * i, x: c.x, y: c.y, r: d.r, hit: d.hit, tag: 'tick', chill: 0.8, chillK: 0.25, boss: 1 / d.n });
    },
    orbs(sp, d) {
      // seekers: the nearest and heaviest mobs first, each orb a different one
      const list = sight().sort((a, b) => (b.p + 0.15 * Math.sqrt(b.w || 1)) - (a.p + 0.15 * Math.sqrt(a.w || 1)));
      const c = dense(0.3, list); Object.assign(sp, { x: 0, y: -0.05, cx: c.x, cy: c.y });
      for (let i = 0; i < d.n; i++) {
        const m = list[i] || list[Math.floor(rnd() * list.length)] || null;
        const [x, y] = m ? xy(m) : [c.x + rr(-0.2, 0.2), c.y + rr(-0.2, 0.2)];
        sp.ev.push({ t: 0.75 + 0.14 * i, x, y, r: d.r, hit: d.hit, sp: 0.4, tag: 'orb', m, i, boss: 1 / d.n });
      }
      sp.T = sp.ev[sp.ev.length - 1].t + 0.6;
    },
    swords(sp, d) {
      const c = dense(0.26); Object.assign(sp, c);
      for (let i = 0; i < d.n; i++) {
        const a = rr(0, Math.PI * 2), k = Math.sqrt(rnd()) * 0.26;
        sp.ev.push({ t: 0.35 + 0.08 * i + rr(0, 0.04), x: c.x + Math.cos(a) * k, y: Math.min(0.6, c.y + Math.sin(a) * k * 0.9), r: d.r, hit: d.hit, tag: 'sword', boss: 1 / d.n });
      }
      sp.ev.sort((a, b) => a.t - b.t);
      sp.T = sp.ev[sp.ev.length - 1].t + 0.9;
    },
    chain(sp, d) {
      const c = dense(0.3); Object.assign(sp, c); sp.T = 0.25 + 0.3 * d.n + 0.6;
      for (let i = 0; i < d.n; i++) sp.ev.push({ t: 0.25 + 0.3 * i, x: c.x, y: c.y, r: 0.3, hit: d.hit, tag: 'bolt', chain: d.hops, boss: 1 / d.n });
    },
    lava(sp, d) {
      const c = dense(d.r); Object.assign(sp, c); sp.T = 3.4;
      sp.ev.push({ t: 0.5, x: c.x, y: c.y, r: d.r, hit: d.hit, tag: 'impact', boss: 0.7, push: 0.035 });
      for (let i = 0; i < 5; i++) sp.ev.push({ t: 0.95 + 0.5 * i, x: c.x, y: c.y, r: d.r * 0.8, hit: d.pool, tag: 'tick', boss: 0.06 });
    },
    shadow(sp, d) {
      const list = sight(), spots = [];
      for (let i = 0; i < d.n; i++) spots.push(dense(d.r, list, spots));
      Object.assign(sp, spots[0]);
      spots.forEach((s, i) => sp.ev.push({ t: 0.3 + 0.25 * i, x: s.x, y: s.y, r: d.r, hit: d.hit, tag: 'slash', ang: rr(-0.5, 0.5), boss: 1 / d.n }));
      sp.T = 0.3 + 0.25 * d.n + 0.8;
    },
  };

  // ---------- Casting ----------
  // with only a boss to hit, the spells that can fall on one spot
  const NO_BOSS = { tornado: 1, shower: 1 };
  const bossOnly = () => !!R.boss && sight().length < TUNE.spellMinMobs;
  function pickKind() {
    const el = G.landElement(), s = st(), ks = [], ws = [], bo = bossOnly();
    for (const k of KINDS) {
      if (k === s.last && KINDS.length > 1) continue; // never the same twice in a row
      if (bo && NO_BOSS[k]) continue;
      ks.push(k); ws.push((DEFS[k].w || 1) * (DEFS[k].fav.includes(el) ? TUNE.spellFav : 1));
    }
    let tot = 0; for (const w of ws) tot += w;
    let x = rnd() * tot;
    for (let i = 0; i < ks.length; i++) { if ((x -= ws[i]) < 0) return ks[i]; }
    return ks[ks.length - 1];
  }
  function cast(kind, how) {
    const s = st(), d = DEFS[kind];
    if (!d) return null;
    const sp = { id: ++s.uid, kind, name: d.name, col: d.col, el: G.landElement(), how: how || 'auto', t: 0, i: 0, ev: [], hits: new Map(), x: 0, y: 0, T: 1.5, onBoss: bossOnly() };
    BUILD[kind](sp, d);
    sp.ev.sort((a, b) => a.t - b.t);
    const A = TUNE.spellArea || 1;
    for (const ev of sp.ev) { if (!ev.chain) ev.r *= A; if (ev.r0) ev.r0 *= A; }
    s.live.push(sp); s.n++; s.last = kind; s.m = 0; s.gap = TUNE.spellGap;
    if (G.S && G.S.st) G.S.st.spells = (G.S.st.spells || 0) + 1;
    emit('spellCast', sp);
    return sp;
  }

  // ---------- Striking ----------
  function strike(sp, ev) {
    const D = G.D, hp = (D.heroHit || 1) * TUNE.spellPow;
    let mobs = [], lead = null;
    if (ev.m !== undefined) {
      // an orb flies to its mob; if that one is gone, to whoever is nearest where it was
      let m = ev.m && !ev.m.dead && R.mobs.includes(ev.m) ? ev.m : null;
      if (!m) { let bd = 0.16; for (const o of R.mobs) { if (o.dead || o.gone || o.p < 0) continue; const q = d2(mx(o), my(o), ev.x, ev.y); if (q < bd) { bd = q; m = o; } } }
      if (m) { [ev.x, ev.y] = xy(m); lead = m; ev.m = m; }
    }
    if (ev.chain) {
      // a bolt on the thickest spot near the storm, then hop to hop to the nearest not yet struck
      const hit = sp.chainHit || (sp.chainHit = new Set());
      const list = sight().filter(m => !hit.has(m.id));
      const pool = list.filter(m => d2(mx(m), my(m), ev.x, ev.y) <= 0.36 * 0.36);
      let cur = pool.length ? pool[Math.floor(rnd() * pool.length)] : list[0];
      ev.path = [];
      for (let k = 0; cur && k < ev.chain; k++) {
        mobs.push(cur); hit.add(cur.id);
        const [cx, cy] = xy(cur); ev.path.push([cx, cy]);
        let nx = null, bd = 0.3 * 0.3;
        for (const o of list) { if (hit.has(o.id) || o.dead) continue; const q = d2(mx(o), my(o), cx, cy); if (q < bd) { bd = q; nx = o; } }
        cur = nx;
      }
      if (ev.path.length) [ev.x, ev.y] = ev.path[0];
      else if (R.boss) { ev.path.push([0, 0]); ev.x = 0; ev.y = 0; ev.onBoss = true; }
    } else {
      const r2 = ev.r * ev.r, i2 = ev.r0 > 0 ? ev.r0 * ev.r0 : -1;
      for (const m of R.mobs) {
        if (m.dead || m.gone || m.p < 0) continue;
        const q = d2(mx(m), my(m), ev.x, ev.y);
        if (q <= r2 && q > i2) mobs.push(m);
      }
      if (lead && !mobs.includes(lead)) mobs.unshift(lead);
    }
    if (ev.max) mobs = mobs.filter(m => (sp.hits.get(m.id) || 0) < ev.max);
    for (const m of mobs) sp.hits.set(m.id, (sp.hits.get(m.id) || 0) + 1);
    let kills = 0;
    for (const m of mobs) {
      if (m.dead) continue;
      let dmg = hp * ev.hit * (lead && m !== lead && ev.sp != null ? ev.sp : 1);
      if (m.kind === 'guardian') dmg *= 0.5;
      if (ev.chill) { m.chill = Math.max(m.chill || 0, ev.chill); m.chillK = Math.max(ev.chillK || TUNE.spellChill, m.chill > 0 && m.chillK || 0); if (m._cp == null) m._cp = m.p; }
      if (ev.push && m.p > 0 && !m.move && m.kind !== 'guardian') m.p = Math.max(-0.05, m.p - ev.push / Math.sqrt(Math.max(0.03, m.w || 1)));
      G.dealHit(m, dmg, 'spell', false);
      if (m.dead) kills++;
    }
    if (ev.boss && R.boss && G.hitBoss) G.hitBoss((D.heroDps || 0) * TUNE.spellBoss * ev.boss);
    if (ev.heal && G.S.hero && !(R.btnDown > 0)) G.S.hero.hp = Math.min(D.heroHp, G.S.hero.hp + D.heroHp * ev.heal);
    ev.kills = kills;
    emit('spellHit', sp, ev, mobs);
  }

  // ---------- When ----------
  const tutOn = () => !!(G.Tut && G.S && typeof G.S.tut === 'number' && G.S.tut >= 0);
  // no charge at all: off, no Warden yet, in town, marching, a cinematic, the tutorial
  function blocked() {
    const S = G.S;
    return !TUNE.spellOn || !S || !S.hero || !S.hero.cls || R.town || R.march || R.cine > 0 || tutOn();
  }
  // the charge holds (but keeps filling) while the Button is broken or the Overdrive is going off
  // (3.6: and for the first moments of a big moment's card, so the two don't land on each other)
  const held = () => R.btnDown > 0 || (G.odActive && G.odActive()) || (G.director && G.director.state && G.director.state().sinceLast < 2.5);
  // fighting: a boss on the field, or enough of the Horde in sight
  function fighting() {
    if (R.boss) return true;
    let n = 0; for (const m of R.mobs) if (inSight(m) && ++n >= TUNE.spellMinMobs) return true;
    return false;
  }

  G.hook('tick', dt => {
    const s = st();
    if (R.town) return;
    // the spells already cast play on
    for (let i = s.live.length - 1; i >= 0; i--) {
      const sp = s.live[i];
      sp.t += dt;
      while (sp.i < sp.ev.length && sp.ev[sp.i].t <= sp.t) strike(sp, sp.ev[sp.i++]);
      if (sp.t >= sp.T && sp.i >= sp.ev.length) { s.live.splice(i, 1); emit('spellEnd', sp); }
    }
    // chills: a share of each step a chilled mob takes is taken back (and of its bites)
    for (const m of R.mobs) {
      if (!(m.chill > 0)) continue;
      const k = Math.min(0.95, m.chillK || TUNE.spellChill);
      if (m._cp != null && !m.move && !m.dead) { const d = m.p - m._cp; if (d > 0) m.p -= d * k; }
      if (m.p >= 1 || m.held) m.atkT += dt * k;
      m._cp = m.p;
      if ((m.chill -= dt) <= 0) { m.chill = 0; m._cp = null; }
    }
    // the charge
    if (s.gap > 0) s.gap -= dt;
    if (blocked()) { s.kAcc = 0; return; }
    const fight = fighting();
    if (s.m < 1) {
      if (fight || R.mobs.length) s.m = Math.min(1, s.m + dt / TUNE.spellIdle + Math.min(s.kAcc, TUNE.spellKillCap * dt));
      s.kAcc = 0;
    }
    if (s.m >= 1 && s.gap <= 0 && fight && !held()) cast(pickKind(), 'auto');
  });
  G.hook('kill', (m, src) => { if (src !== 'spell') st().kAcc += TUNE.spellKill; });
  G.hook('click', () => { const s = st(); if (s.m < 1 && !blocked()) s.m = Math.min(1, s.m + 1 / TUNE.spellClicks); });
  // a new run, an ascension: nothing carries over
  G.on('ascend', () => { const s = st(); s.live.length = 0; s.m = 0; });

  // for testing (and the curious): cast one now; kind is one of G.SPELLS, or a random one
  G.forceSpell = function (kind) {
    if (!G.S || !G.S.hero || !G.S.hero.cls || R.town) return null;
    return cast(DEFS[kind] ? kind : pickKind(), 'force');
  };
})(globalThis.G = globalThis.G || {});
