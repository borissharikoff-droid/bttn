// BTTN 3.4 — more kinds of Horde. Five behaviours that make the field move in new ways, each coming
// as an occasional pack from the second land on, more often the deeper it gets:
//
//   leaper      crouches, then jumps a big chunk of the way to the Button (it can't be knocked back mid-air)
//   gnat        a cloud of tiny flyers that zig-zag in (small fry: no health bar, cheap to draw)
//   shieldwall  a row of shield-bearers that advance as one; each shield stops its first few hits
//   blob        splits in two when slain, and the halves split again (blob -> 2 blob1 -> 4 blob2)
//   mole        tunnels under the field and pops out close to the Button
//
// DOM-free like hero.js and champions.js (it runs in the Node playtests); load it after champions.js.
// Mostly a tick hook working on the mobs' own fields, so the normal walk, bites and the tank's line still
// apply to them. The leaper and the shield wall set m.sp to 0 while the hook moves them.
//
// Events (for the stage): m2Pack(kind, a, n), leapCrouch(m), mobLeap(m, from, to), leapLand(m),
// wallBlock(m, left), wallShieldBreak(m), wallBreak(group), blobSplit(m, kids), moleDig(dig), molePop(m),
// moleGone(dig), plus the stock packIn(a, kind) and kindFirst(kind).
// Fields the stage can read: m.jz (0..1, a leaper's height in its jump), m.crouch (0..1), m.fly (gnats),
// m.blk (a shield-bearer's blocks left), m.pop (s since a mole came up, counting down from TUNE.molePop),
// G.mobs2.digs() -> [{ a, p, k }] tunnels in progress (k: 0..1 of the way).
(function (G) {
  'use strict';
  if (!G.hook || !G.makeMob || !G.MOB_KINDS) return; // needs hero.js
  const { rand, randInt, emit } = G;
  const chance = p => G.rng() < p;
  const R = G.R, TUNE = G.TUNE;
  const clamp01 = v => Math.max(0, Math.min(1, v));

  Object.assign(TUNE, {
    // how often a pack of the new kinds comes: every m2Every s at the second land, m2RampPer faster per
    // depth after that (at most m2RampMax times), jittered by m2Jitter; m2Charge of its weight comes off the
    // normal flow (0: they come on top of it); none while the Horde weighs over m2CapMul of its cap
    m2Every: 13, m2RampPer: 0.035, m2RampMax: 2.6, m2Jitter: 0.35, m2Charge: 0, m2CapMul: 1.3, m2FromLand: 1,
    m2Fodder: [12, 22], // the small fry that come along with each pack
    // leapers: n a pack; crouch s, then airborne for leapAir s over leapDist of the way (never past leapMaxP);
    // a leap every leapEvery s once they are on the field (from leapFrom)
    leapN: [3, 5], leapCrouch: 0.7, leapAir: 0.5, leapDist: 0.24, leapMaxP: 0.94, leapEvery: 2.6, leapFrom: 0.08,
    // gnats: n a cloud (times the packs' thickness), zig-zag amplitude (share of the ring) and speed (rad/s)
    gnatN: [26, 40], gnatAmp: 0.035, gnatHz: 9,
    // shield walls: n bearers spaced wallGap apart; each shield takes wallBlock hits (the Hand's Smite and
    // blasts go through); the line breaks up at wallBreakP
    wallN: [5, 7], wallGap: 0.016, wallBlock: 4, wallBreakP: 0.7,
    // blobs: n a pack; kids per split and how much faster the halves are
    blobN: [3, 4], blobKids: 2, blobKidSpd: 1.15,
    // moles: n tunnels a pack, digTime s under the ground, coming up between moleTo[0] and moleTo[1] of the way
    moleN: [3, 5], digTime: 3, moleTo: [0.66, 0.84], molePop: 0.45,
  });

  // ---------- The kinds ----------
  // w: weight (a brute is 1); hp: health factor; land: the first land (0-based) it comes in
  const KINDS = {
    leaper:     { w: 0.55, spd: 0.85, gold: 1.3, hp: 1.15, land: 1, name: 'Leapers', desc: 'Crouch, then leap at the Button. Hit them while they crouch' },
    gnat:       { w: 0.0045, spd: 1.7, gold: 1, hp: 0.7, land: 1, name: 'Gnat swarms', desc: 'A buzzing cloud that zig-zags in' },
    blob:       { w: 0.45, spd: 0.85, gold: 1.3, hp: 1.1, land: 2, name: 'Splitters', desc: 'Split in two when slain, and again' },
    blob1:      { w: 0.2, spd: 0.95, gold: 1.3, hp: 1.1, land: 99, name: 'Splitters', desc: '' },
    blob2:      { w: 0.09, spd: 1.1, gold: 1.3, hp: 1.1, land: 99, name: 'Splitters', desc: '' },
    mole:       { w: 0.5, spd: 0.8, gold: 1.4, hp: 1.2, land: 3, name: 'Burrowers', desc: 'Tunnel under the field and pop up by the Button' },
    shieldwall: { w: 0.6, spd: 0.6, gold: 1.5, hp: 1.4, land: 4, name: 'Shield walls', desc: 'A line of shields. Each stops its first hits' },
  };
  const PACKS = ['leaper', 'gnat', 'blob', 'mole', 'shieldwall'];
  G.ARCHETYPES = G.ARCHETYPES || {};
  for (const k in KINDS) { G.ARCHETYPES[k] = KINDS[k]; G.MOB_KINDS[k] = KINDS[k]; }
  G.SMALL.gnat = 1;
  G.M2_KINDS = PACKS.slice();

  // each land's names for them (the stage's "NEW:" card reads REALMS[i].mobs[kind])
  const NAMES = [
    ['Sand Hopper', 'Sandflies', 'Brine Blob', 'Sand Digger', 'Shellback Line'],
    ['Hopper Toad', 'Midges', 'Bog Slime', 'Mole Rat', 'Goblin Shieldline'],
    ['Bark Frog', 'Spore Gnats', 'Moss Blob', 'Root Borer', 'Rootwall'],
    ['Rock Leaper', 'Stone Flies', 'Mud Blob', 'Tunneler', 'Granite Wall'],
    ['Snow Hopper', 'Ice Motes', 'Slush Blob', 'Ice Borer', 'Frost Wall'],
    ['Zealot Leaper', 'Halo Gnats', 'Ichor Blob', 'Tomb Digger', 'Temple Phalanx'],
    ['Hell Toad', 'Cinder Flies', 'Tar Blob', 'Pit Digger', 'Brimstone Wall'],
    ['Blink Leaper', 'Null Swarm', 'Void Blob', 'Under-Thing', 'Void Bulwark'],
    ['Page Hopper', 'Paper Moths', 'Ink Blob', 'Bookworm', 'Shelf Wall'],
    ['Spring Jack', 'Rivet Flies', 'Oil Blob', 'Drill Bot', 'Iron Phalanx'],
    ['Lava Hopper', 'Ash Flies', 'Magma Blob', 'Ash Burrower', 'Obsidian Wall'],
    ['Glint Leaper', 'Shard Swarm', 'Glass Blob', 'Mirror Mole', 'Mirror Wall'],
    ['Cloud Hopper', 'Feather Swarm', 'Cloud Blob', 'Cloud Diver', 'Gilded Phalanx'],
    ['Crater Leaper', 'Dust Mites', 'Regolith Blob', 'Crater Mole', 'Moonstone Wall'],
    ['Star Jumper', 'Comet Swarm', 'Plasma Blob', 'Wormhole Worm', 'Asteroid Wall'],
  ];
  (G.REALMS || []).forEach((r, i) => {
    const n = NAMES[i]; if (!n) return;
    r.mobs = r.mobs || {};
    PACKS.forEach((k, j) => { if (!r.mobs[k]) r.mobs[k] = n[j]; });
    if (!r.mobs.blob1) r.mobs.blob1 = r.mobs.blob2 = r.mobs.blob;
  });
  if (G.STR) {
    const s = G.STR;
    const add = (k, v) => { if (!s[k]) s[k] = v; };
    add('in_leaper', 'LEAPERS'); add('in_gnat', 'SWARM'); add('in_blob', 'SPLITTERS'); add('in_mole', 'BURROWERS'); add('in_shieldwall', 'SHIELD WALL');
    add('wallBlock', 'BLOCK'); add('wallBreak', 'THE WALL BREAKS');
  }

  // ---------- State ----------
  // R.m2: { t: seconds to the next pack, digs: tunnels in progress, walls: shield walls, n: counters }
  const st = () => (R.m2 = R.m2 || { t: null, digs: [], walls: [], uid: 0, n: { spawn: {}, kill: {} } });
  const clearField = () => { const s = st(); for (const d of s.digs) emit('moleGone', d); s.digs.length = 0; s.walls.length = 0; };
  G.on('bossStart', clearField); G.on('wipe', clearField); G.on('ascend', () => { clearField(); st().t = null; });

  const busy = () => {
    const S = G.S;
    return !!(R.boss || R.bossReady || R.rift || R.inv || R.town || R.cine > 0 || R.stun > 0 || (R.ev && R.ev.k !== 'jackpot') || (G.Tut && S.tut >= 0) || !S.hero || !S.hero.cls);
  };
  function aliveW() { let w = 0; for (const m of R.mobs) if (!m.add) w += m.w; return w; }
  function capW(d) { return (TUNE.hordeCap + Math.min(10, d / 4)) * Math.max(1, (R.hs || 1) / 1.5) * TUNE.m2CapMul; }
  const room = () => R.mobs.length < TUNE.mobMax;
  const more = () => (TUNE.packMul || 1) * Math.sqrt(Math.max(1, (R.hs || 1) / 1.5));
  function firstSeen(k) {
    const S = G.S, sn = S.seen = S.seen || {};
    sn.kinds = sn.kinds || {};
    if (!sn.kinds[k]) { sn.kinds[k] = 1; emit('kindFirst', k); }
  }
  function made(m) { const s = st(); s.n.spawn[m.kind] = (s.n.spawn[m.kind] || 0) + 1; return m; }
  function tagAlong(a, spread) {
    const n = Math.round(randInt(TUNE.m2Fodder[0], TUNE.m2Fodder[1]) * more());
    for (let i = 0; i < n && room(); i++) G.makeMob('fodder', a + rand(-spread, spread), -rand(0, 0.3));
  }

  // ---------- Packs ----------
  function pack(k, a) {
    const s = st();
    if (a == null) a = rand(0.05, 0.95);
    const before = aliveW();
    let n = 0;
    if (k === 'leaper') {
      const c = randInt(TUNE.leapN[0], TUNE.leapN[1]);
      for (let i = 0; i < c && room(); i++, n++) {
        const m = made(G.makeMob('leaper', a + rand(-0.05, 0.05), -rand(0, 0.12)));
        m.lt = rand(0.4, 1.6); m.lst = 0; // timer and stage: 0 walking, 1 crouched, 2 in the air
      }
      tagAlong(a, 0.07);
    } else if (k === 'gnat') {
      const c = Math.round(randInt(TUNE.gnatN[0], TUNE.gnatN[1]) * more());
      for (let i = 0; i < c && room(); i++, n++) {
        const m = made(G.makeMob('gnat', a + rand(-0.04, 0.04), -rand(0, 0.35)));
        m.a0 = m.a; m.ph = rand(0, 6.283); m.fly = 1; m.hz = TUNE.gnatHz * rand(0.75, 1.25);
      }
    } else if (k === 'blob') {
      const c = randInt(TUNE.blobN[0], TUNE.blobN[1]);
      for (let i = 0; i < c && room(); i++, n++) made(G.makeMob('blob', a + rand(-0.05, 0.05), -rand(0, 0.15)));
      tagAlong(a, 0.07);
    } else if (k === 'mole') {
      const c = randInt(TUNE.moleN[0], TUNE.moleN[1]);
      for (let i = 0; i < c; i++, n++) {
        const d = { id: ++s.uid, a: clamp01(a + rand(-0.09, 0.09)), p0: rand(0.02, 0.1), to: rand(TUNE.moleTo[0], TUNE.moleTo[1]), T: TUNE.digTime * rand(0.8, 1.25), t: 0 };
        d.p = d.p0;
        s.digs.push(d);
        emit('moleDig', d);
      }
      tagAlong(a, 0.08);
    } else if (k === 'shieldwall') {
      const c = randInt(TUNE.wallN[0], TUNE.wallN[1]);
      const g = { id: ++s.uid, ms: [], p: -0.02, on: true };
      const a0 = clamp01(a - (c - 1) * TUNE.wallGap / 2);
      for (let i = 0; i < c && room(); i++, n++) {
        const m = made(G.makeMob('shieldwall', clamp01(a0 + i * TUNE.wallGap), g.p));
        m.wall = g.id; m.blk = TUNE.wallBlock; m.sp0 = m.sp;
        g.ms.push(m);
      }
      // the line walks at its slowest bearer's pace
      g.sp = Math.min(...g.ms.map(m => m.sp0));
      if (g.ms.length) s.walls.push(g);
      tagAlong(a, 0.06);
    }
    if (!n) return 0;
    firstSeen(k);
    emit('packIn', a, k);
    emit('m2Pack', k, a, n);
    // part of its weight comes off the normal flow
    R.hordeAcc = Math.max(-1, (R.hordeAcc || 0) - TUNE.m2Charge * Math.max(0, aliveW() - before + (k === 'mole' ? n * KINDS.mole.w : 0)));
    return n;
  }
  // the kinds this depth can bring (the land's first zone brings only the kinds of the lands before it)
  function kindsAt(d) {
    const ri = G.realmIndex(d);
    return PACKS.filter(k => ri >= KINDS[k].land);
  }
  G.m2Pack = (k, a) => pack(k, a); // for testing: G.m2Pack('leaper')

  // ---------- Each tick ----------
  G.hook('tick', dt => {
    const s = st(), S = G.S;
    if (!S || !R.mobs) return;
    const d = G.depthNow ? G.depthNow() : S.depth;
    // the field was swept (a boss, a Rift, a load): tunnels and walls go with it
    if (R.boss || R.rift || R.town) { if (s.digs.length || s.walls.length) clearField(); }
    else stepDigs(s, dt);
    stepWalls(s, dt);
    // the new kinds' own moves (the hook runs before hero.js walks the Horde)
    for (const m of R.mobs) {
      if (m.dead) continue;
      const k = m.kind;
      if (k === 'gnat') {
        m.ph += m.hz * dt;
        m.a = clamp01(m.a0 + Math.sin(m.ph) * TUNE.gnatAmp * (1 - 0.7 * Math.max(0, m.p)));
      } else if (k === 'leaper') stepLeaper(m, dt);
      else if (k === 'mole' && m.pop > 0) m.pop = Math.max(0, m.pop - dt);
    }
    // a new pack now and then
    if (busy() || G.realmIndex(d) < TUNE.m2FromLand) return;
    if (s.t == null) s.t = TUNE.m2Every * rand(0.5, 1);
    if ((s.t -= dt) > 0) return;
    const ramp = Math.min(TUNE.m2RampMax, 1 + TUNE.m2RampPer * Math.max(0, d - G.REALM_SIZE * TUNE.m2FromLand));
    s.t = TUNE.m2Every / ramp * rand(1 - TUNE.m2Jitter, 1 + TUNE.m2Jitter);
    if (!room() || aliveW() > capW(d)) return;
    const ks = kindsAt(d);
    if (!ks.length) return;
    // the land's newest kind comes a little more often
    const k = chance(0.3) ? ks[ks.length - 1] : ks[Math.floor(G.rng() * ks.length)];
    pack(k);
  });

  function stepLeaper(m, dt) {
    if (m.lst === 2) {
      // in the air: the hook carries it; nothing knocks it back
      m.jt += dt;
      const k = Math.min(1, m.jt / TUNE.leapAir);
      m.p = m.jf + (m.jto - m.jf) * k;
      m.jz = Math.sin(Math.PI * k);
      if (k >= 1) { m.lst = 0; m.jz = 0; m.sp = m.sp0; m.lt = TUNE.leapEvery * rand(0.8, 1.25); emit('leapLand', m); }
      return;
    }
    if (m.lst === 1) {
      m.lt -= dt;
      m.crouch = clamp01(1 - m.lt / TUNE.leapCrouch);
      if (m.lt <= 0) {
        m.lst = 2; m.jt = 0; m.crouch = 0; m.jf = m.p; m.jto = Math.min(TUNE.leapMaxP, m.p + TUNE.leapDist);
        emit('mobLeap', m, m.jf, m.jto);
      }
      return;
    }
    // walking: crouch when the time comes, if there is still a leap's worth of field ahead
    if (m.p < TUNE.leapFrom || m.held) return;
    if ((m.lt -= dt) <= 0 && m.p < TUNE.leapMaxP - 0.08) {
      m.lst = 1; m.lt = TUNE.leapCrouch; m.sp0 = m.sp; m.sp = 0; m.crouch = 0;
      emit('leapCrouch', m);
    }
  }
  function stepDigs(s, dt) {
    for (let i = s.digs.length - 1; i >= 0; i--) {
      const dg = s.digs[i];
      dg.t += dt;
      const k = Math.min(1, dg.t / dg.T);
      dg.p = dg.p0 + (dg.to - dg.p0) * k;
      dg.k = k;
      if (k < 1) continue;
      s.digs.splice(i, 1);
      if (!room()) { emit('moleGone', dg); continue; }
      const m = made(G.makeMob('mole', dg.a, dg.to));
      m.pop = TUNE.molePop;
      emit('molePop', m, dg);
    }
  }
  // the Horde's pace this tick, as hero.js reckons it (the frost orb, the land's rule, an event's pull)
  function slowNow() {
    const L = G.REALMS[G.realmIndex(G.depthNow ? G.depthNow() : G.S.depth)] || {};
    return (R.hb && R.hb.orb > 0 ? 0.4 : 1) * (L.slow || 1) * (G.evMul ? G.evMul('speed') : 1);
  }
  function stepWalls(s, dt) {
    for (let i = s.walls.length - 1; i >= 0; i--) {
      const g = s.walls[i];
      g.ms = g.ms.filter(m => !m.dead && R.mobs.includes(m));
      if (!g.ms.length) { s.walls.splice(i, 1); continue; }
      // the line moves as one: where it stands is where its bearers are on average (a push on one pushes it all)
      let sum = 0;
      for (const m of g.ms) sum += m.p;
      g.p = sum / g.ms.length + g.sp * dt * slowNow();
      if (g.p >= TUNE.wallBreakP || g.ms.length < 2) {
        for (const m of g.ms) { m.sp = m.sp0; m.wall = 0; }
        s.walls.splice(i, 1);
        emit('wallBreak', g);
        continue;
      }
      for (const m of g.ms) { m.p = g.p; m.sp = 0; }
    }
  }
  G.mobs2 = {
    digs: () => st().digs.map(d => ({ id: d.id, a: d.a, p: d.p, k: d.k || 0 })),
    walls: () => st().walls,
    stats: () => st().n,
    pack: (k, a) => pack(k, a),
  };

  // ---------- Damage and death ----------
  // the shields: each takes the first few hits whole (the Hand's Smite, blasts and bombs go through)
  const PIERCE = { smite: 1, bomb: 1, blast: 1, thorns: 1, overdrive: 1 };
  G.hook('hit', (m, dmg, src) => {
    if (m.kind !== 'shieldwall' || !(m.blk > 0) || PIERCE[src]) return;
    m.blk--;
    emit('wallBlock', m, m.blk);
    if (m.blk <= 0) emit('wallShieldBreak', m);
    return 0;
  });
  G.hook('kill', m => {
    const s = st();
    if (KINDS[m.kind]) s.n.kill[m.kind] = (s.n.kill[m.kind] || 0) + 1;
    if (m.kind !== 'blob' && m.kind !== 'blob1') return;
    const kid = m.kind === 'blob' ? 'blob1' : 'blob2', kids = [];
    for (let i = 0; i < TUNE.blobKids && room(); i++) {
      const k = made(G.makeMob(kid, clamp01(m.a + (i ? 1 : -1) * rand(0.01, 0.025)), Math.max(-0.05, m.p - rand(0.01, 0.04)), m.add));
      k.sp *= TUNE.blobKidSpd;
      kids.push(k);
    }
    if (kids.length) emit('blobSplit', m, kids);
  });
})(globalThis.G = globalThis.G || {});
