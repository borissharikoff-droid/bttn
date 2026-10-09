// BTTN 3.3 — Land Champions: once per land per run a named mini-boss walks into the field
// with a rule of its own (it splits, burrows, steals, shields itself, rages, hides among
// decoys, carries a bomb or calls the Horde). It is not a boss fight: the Horde keeps
// coming and the clear bar keeps filling. Kill it inside a minute for guaranteed good loot;
// otherwise it gets away (or, the bomb-carrier, goes off on the Button).
//
// DOM-free like hero.js (it runs in the Node playtests). The show is js/champions_fx.js.
// Events: champSpawn(c), champKill(c, rew), champEscape(c, why), champGone(c) and the
// mechanic ones: champSlam, champSplit, champDive, champSurface, champSteal, champFlee,
// champShieldHit, champShieldBreak, champShieldUp, champRage, champSummon, champDecoys,
// champDecoyPop, champBoom.
(function (G) {
  'use strict';
  if (!G.hook || !G.makeMob) return; // needs hero.js
  const { rand, chance, emit, clamp } = G;
  const R = G.R, TUNE = G.TUNE;
  const S_ = () => G.S;

  Object.assign(TUNE, {
    champLife: 60,            // seconds to kill it before it gets away
    champSecs: 20,            // its health: about this many seconds of the party's damage and the Hand's clicks...
    champMobsMin: 40, champMobsMax: 200, // ...but never under 40 or over 200 standard mobs of its depth
    champDelayMin: 20, champDelayMax: 45, // seconds into the land before it comes (3.4: lands are shorter now)
    champW: 5,                // its weight: clear bar, gold and XP of five brutes
    champUqSiege: 0.05,       // 4.0 (DESIGN §5.3 'unique sources per run'): inside a Siege a slain champion drops a unique 5% of the time
  });

  // ---------- The mechanics ----------
  // hp: health factor; hold: where it stops (p); kb: share of the Hand's knock-back it takes
  const MECH = G.CHAMP_MECH = {
    splitter:  { name: 'Splitter',      hint: 'Splits in three when slain',            col: '#5ae8ff', hp: 0.75, hold: 0.8, kb: 0.3 },
    thief:     { name: 'Thief',         hint: 'Steals your gold. Slay it: twice back', col: '#ffd84a', hp: 0.7, hold: 0.74, kb: 0.3 },
    burrower:  { name: 'Burrower',      hint: 'Dives underground: hit it when it is up', col: '#c8a070', hp: 0.8, hold: 0.8, kb: 0.3 },
    shield:    { name: 'Shield-bearer', hint: 'Click! Only the Hand cracks its shield', col: '#8fc8ff', hp: 0.75, hold: 0.8, kb: 0.2 },
    berserker: { name: 'Berserker',     hint: 'Faster and deadlier as it bleeds',      col: '#ff4f4f', hp: 0.9, hold: 0.78, kb: 0.3 },
    phantom:   { name: 'Phantom',       hint: 'Decoys! Only the real one bleeds',      col: '#c88aff', hp: 0.8, hold: 0.79, kb: 0.3 },
    bomb:      { name: 'Bomb-carrier',  hint: 'Stop it before it reaches the Button',  col: '#ff7a2e', hp: 0.65, hold: 1, kb: 0.45 },
    summoner:  { name: 'Summoner',      hint: 'Calls the Horde until slain',           col: '#7fff9a', hp: 0.8, hold: 0.72, kb: 0.3 },
  };
  // ---------- One per land ----------
  const CHAMPS = G.CHAMPS = [
    { mech: 'splitter',  name: 'The Tide-King’s Herald', col: '#5ae8ff' },  // Shoreline: a crab that cracks into three
    { mech: 'thief',     name: 'Grabsack the Goblin',          col: '#8ae07a' },  // Meadows
    { mech: 'burrower',  name: 'Old Rootgnaw',                 col: '#9be15d' },  // Deepwood: a treant root that tunnels
    { mech: 'shield',    name: 'The Granite Warden',           col: '#c8c8d4' },  // Highlands
    { mech: 'berserker', name: 'Rimefang the Mad',             col: '#7fc8ff' },  // Frostlands
    { mech: 'phantom',   name: 'The False Prophet',            col: '#ffe27a' },  // Godlands
    { mech: 'bomb',      name: 'Brimstone Bellows',            col: '#ff7a2e' },  // Abyss
    { mech: 'summoner',  name: 'The Hollow Choir',             col: '#b36bff' },  // The Void
    { mech: 'splitter',  name: 'The Unbound Index',            col: '#4fe0c8' },  // Sunken Library: its pages scatter
    { mech: 'bomb',      name: 'Mainspring the Boiler',        col: '#ffb04a' },  // Clockwork Foundry
    { mech: 'burrower',  name: 'The Magma Wyrmling',           col: '#ff5a2e' },  // Ember Wastes
    { mech: 'phantom',   name: 'The Many-Faced',               col: '#e4eaf6' },  // Mirror Maze
    { mech: 'shield',    name: 'The Gilded Paladin',           col: '#ffd84a' },  // Sky Citadel
    { mech: 'thief',     name: 'The Moon-Thief',               col: '#c8d6ff' },  // The Moon
    { mech: 'berserker', name: 'The Red Giant',                col: '#ff3b3b' },  // The Star Sea
  ];
  if (G.STR) {
    const s = G.STR;
    s.champTag = s.champTag || 'LAND CHAMPION';
    s.champSlain = s.champSlain || 'CHAMPION SLAIN';
    s.champEscaped = s.champEscaped || 'ESCAPED';
    s.champBoom = s.champBoom || 'KABOOM!';
    s.champStolen = s.champStolen || 'got away with {0} gold';
    s.champReturned = s.champReturned || '+{0} returned';
    s.champShieldBroken = s.champShieldBroken || 'SHIELD BROKEN';
    s.champRage = s.champRage || 'ENRAGED!';
  }

  // ---------- State ----------
  // S.champRun: the lands whose champion came this run (by land number, so corrupted cycles get theirs too)
  // R.champ: the live one; R.chL: the clock in the current land
  R.champ = null; R.chL = null;
  const landKey = d => Math.floor(Math.max(0, d) / G.REALM_SIZE);
  const run = () => { const S = S_(); if (!S.champRun || typeof S.champRun !== 'object') S.champRun = {}; return S.champRun; };
  G.on('ascend', () => { const S = S_(); S.champRun = {}; if (R.champ) clearChamp('run'); R.chL = null; });
  // (3.6: its end frees the pacing director for the next big moment)
  ['champKill', 'champEscape', 'champGone'].forEach(k => G.on(k, () => { if (G.director) G.director.end('champ'); }));

  // what the party and the Hand put into one marked target each second: the party's steady damage, and the
  // clicks (held or tapped, whichever is faster lately) each loosing a partial volley
  function effDps() {
    const D = G.D, H = D.hero || {}, clicks = Math.min(10, Math.max(R.cps || 0, D.holdRate || 1));
    const crit = 1 + (H.crit || 0) * Math.max(0, (H.critMult || 1) - 1);
    return Math.max(1, (D.heroDpsBase || D.heroDps || 1) * crit + clicks * (TUNE.clickVolley || 0.6) * (D.heroHitBase || D.heroHit || 1) * crit);
  }
  G.champEffDps = effDps;
  function champHp(d, mech) {
    const tor = G.torment ? G.torment().mobHp : 1, mh = G.mobHp(d) * tor;
    return clamp(effDps() * TUNE.champSecs, mh * TUNE.champMobsMin, mh * TUNE.champMobsMax) * MECH[mech].hp;
  }
  // its blows: three bites of its depth, through the bite hooks like any mob's
  function blow(m, k) {
    const D = G.D, d = G.depthNow();
    const atk = Math.max(G.mobAtk(d), (D.heroHp || 0) * (TUNE.biteFloor || 0.03)) * (G.evMul ? G.evMul('bite') : 1) * (G.torment ? G.torment().bite : 1);
    const v = G.victim();
    if (v == null) return;
    let bd = atk * 2.2 * (k || 1);
    for (const f of G.HOOKS.bite) { const x = f(m, v, bd); if (x != null) bd = x; }
    m.bit = v;
    emit('champSlam', R.champ, v);
    emit('mobBite', m, v);
    G.hurtParty(v, bd, 'bite');
  }

  // ---------- Coming in ----------
  function busy() {
    const S = S_();
    return !!(R.boss || R.bossReady || R.rift || R.inv || R.march || R.town || R.cine > 0 || R.stun > 0 || (R.ev && R.ev.k !== 'jackpot') || (G.Tut && !(S.tut < 0)) || !S.hero || !S.hero.cls);
  }
  function spawn(ri, mech, key) {
    const S = S_(), d = G.depthNow();
    ri = ri != null ? ri : G.realmIndex(S.depth);
    const def = CHAMPS[ri % CHAMPS.length], M = mech || def.mech, X = MECH[M];
    const a = rand(0.12, 0.88);
    const m = G.makeMob('brute', a, -0.02);
    // its own creature: none of a brute's land quirks or an invasion's colours
    m.stone = 0; m.inv = null; m.mod = null;
    m.champ = 1 + (key != null ? key : landKey(S.depth)); m.wl = 1; m.move = 'champ';
    m.w = TUNE.champW; m.hp = m.max = champHp(d, M); m.cp = m.p;
    const c = R.champ = {
      key: m.champ - 1, ri, mech: M, name: def.name, col: def.col || X.col, title: X.name, hint: X.hint,
      m, t: TUNE.champLife, T: TUNE.champLife, sp: M === 'bomb' ? 1 / 40 : 1 / 9, hold: X.hold, dir: chance(0.5) ? 1 : -1,
      atkT: 2, max: m.max, S, kids: [], decoys: [], stolen: 0, stealT: 1, cycle: 0,
      sh: 0, shMax: 0, exp: 0, hid: 0, rage: 0, sumT: 2.5, decT: 0, split: false, d,
    };
    if (M === 'shield') c.sh = c.shMax = 12 + Math.floor(ri / 3) * 2;
    if (M === 'burrower') c.cycle = 5;
    // the party marks it: everyone (and the Hand) strikes it first, until you tap something else
    if (!R.focus) R.focus = m.id;
    S.st.champSeen = (S.st.champSeen || 0) + 1;
    if (G.director) G.director.mark('champ', TUNE.champLife);
    emit('champSpawn', c);
    return c;
  }

  // ---------- How it moves and fights (hero.js hands every m.move mob to G.moveMob) ----------
  const prevMove = G.moveMob;
  G.moveMob = function (m, dt) {
    if (m.move !== 'champ') return prevMove ? prevMove(m, dt) : undefined;
    const c = R.champ;
    if (!c) { m.move = null; return; }
    // the Hand's clicks knock it back, but only a little: it is heavy
    if (m.cp != null && m.p < m.cp) m.p = m.cp - (m.cp - m.p) * MECH[c.mech].kb;
    if (m.decoy) { walk(c, m, dt, c.hold); m.cp = m.p; return; }
    if (m !== c.m) { m.cp = m.p; return; }
    const M = c.mech;
    let hold = c.hold, rage = 1;
    if (M === 'berserker') { const k = clamp(m.hp / m.max, 0, 1); rage = 1 + (1 - k); hold = c.hold + 0.17 * (1 - k); }
    if (M === 'thief' && c.flee) hold = -0.1;
    walk(c, m, dt * (M === 'berserker' ? rage : 1), hold);
    m.cp = m.p;
    const there = Math.abs(m.p - hold) < 0.04;
    // the thief: a fistful of gold every second, then it runs for the edge
    if (M === 'thief') {
      if (!c.flee && m.p >= 0.3 && (c.stealT -= dt) <= 0) {
        c.stealT = 1;
        const S = S_(), amt = Math.floor(Math.min(S.gold * 0.008, (G.D.incomeRef || 1) * 6));
        if (amt > 0) { S.gold -= amt; c.stolen += amt; emit('champSteal', c, amt); }
      }
      if (!c.flee && c.t <= 14) { c.flee = true; c.sp = 1 / 14; emit('champFlee', c); }
      if (c.flee && m.p <= -0.06) escape(c, 'fled');
      return;
    }
    if (M === 'bomb') {
      if (m.p >= 0.995) boom(c);
      return;
    }
    if (M === 'summoner') {
      if (m.p >= 0.3 && (c.sumT -= dt) <= 0) { c.sumT = 3.2; summon(c); }
      return;
    }
    if (M === 'phantom' && there && (c.decT -= dt) <= 0) { c.decT = 11; decoys(c); }
    if (M === 'burrower' && there && (c.cycle -= dt) <= 0) { dive(c); return; }
    if (M === 'berserker' && !c.rage && m.hp < m.max * 0.5) { c.rage = 1; emit('champRage', c); }
    if (there && m.p >= 0.6 && (c.atkT -= dt * rage) <= 0) { c.atkT = 2.4; blow(m, rage); }
  };
  function walk(c, m, dt, hold) {
    const d = hold - m.p, step = c.sp * dt;
    m.p += Math.sign(d) * Math.min(Math.abs(d), step);
    // and it paces round the Button while it fights
    if (c.mech !== 'bomb') {
      m.a += (m.dir || c.dir) * dt * 0.012;
      if (m.a > 0.95 || m.a < 0.05) { if (m.decoy) m.dir = -(m.dir || c.dir); else c.dir = -c.dir; m.a = clamp(m.a, 0.05, 0.95); }
    }
  }

  // Splitter: three smaller copies, each walking in on its own like a brute
  function split(c, m) {
    c.split = true;
    const n = 3, hp = c.max * 0.24;
    for (let i = 0; i < n; i++) {
      const k = G.makeMob('brute', clamp(m.a + (i - 1) * 0.035, 0, 1), Math.max(0.2, m.p - 0.06 - 0.03 * i));
      delete k.stone; delete k.inv; delete k.mod;
      k.champKid = c.key + 1; k.amb = 1; k.w = 1.5; k.hp = k.max = hp; k.sp *= 0.6;
      c.kids.push(k);
    }
    // the copies have a little longer
    c.t = Math.max(c.t, 22);
    if (R.focus === m.id) R.focus = c.kids[0].id;
    emit('champSplit', c, m, c.kids.slice());
  }
  // Burrower: under the ground for two seconds, out of reach, then up somewhere else
  function dive(c) {
    const m = c.m, i = R.mobs.indexOf(m);
    if (i < 0) return;
    R.mobs.splice(i, 1);
    c.from = { a: m.a, p: m.p };
    c.to = { a: clamp(m.a + (chance(0.5) ? 1 : -1) * rand(0.12, 0.3), 0.06, 0.94), p: rand(0.66, 0.86) };
    if (c.to.a === c.from.a) c.to.a = 1 - c.from.a;
    c.hid = 2.2; c.focused = R.focus === m.id;
    emit('champDive', c, c.from, c.to);
  }
  function surface(c) {
    const m = c.m, old = m.id;
    m.id = ++R.mobUid; // a fresh body for the stage: it comes up where it is, not sliding across
    m.a = c.to.a; m.p = m.cp = c.to.p;
    R.mobs.push(m);
    c.hid = 0; c.cycle = rand(4, 5.5); c.atkT = Math.min(c.atkT, 0.8);
    if (c.focused || R.focus === old) R.focus = m.id;
    emit('champSurface', c, c.to);
  }
  // Phantom: three copies that look just like it; a hit pops one, only the real one bleeds
  function decoys(c) {
    const m = c.m;
    c.decoys = c.decoys.filter(x => !x.dead && R.mobs.includes(x));
    const want = 3 - c.decoys.length;
    for (let i = 0; i < want; i++) {
      const x = G.makeMob('brute', clamp(m.a + (i % 2 ? 1 : -1) * rand(0.07, 0.18) * (1 + i * 0.4), 0.05, 0.95), m.p, true);
      delete x.stone; delete x.inv; delete x.mod;
      x.decoy = c.key + 1; x.champ = c.key + 1; x.wl = 1; x.move = 'champ'; x.w = 0.5; x.hp = x.max = c.max * 0.04; x.cp = x.p; x.dir = chance(0.5) ? 1 : -1;
      c.decoys.push(x);
    }
    // and it trades places with one of them, so the party loses track
    if (c.decoys.length) {
      const o = c.decoys[Math.floor(G.rng() * c.decoys.length)];
      const a = m.a, p = m.p; m.a = o.a; m.p = m.cp = o.p; o.a = a; o.p = o.cp = p;
      if (R.focus === m.id) R.focus = o.id;
    }
    emit('champDecoys', c, c.decoys.slice());
  }
  // Summoner: a ring of the Horde round it every few seconds
  function summon(c) {
    const m = c.m;
    let n = 0;
    for (let i = 0, k = G.crowdN ? G.crowdN(8) : 8; i < k && R.mobs.length < TUNE.mobMax; i++, n++) G.makeMob('fodder', clamp(m.a + rand(-0.04, 0.04), 0, 1), m.p - rand(0.02, 0.1), true);
    if (R.mobs.length < TUNE.mobMax) { G.makeMob(chance(0.3) ? 'magic' : 'brute', m.a + rand(-0.03, 0.03), m.p - 0.05); n++; }
    emit('champSummon', c, n);
  }
  // Bomb-carrier: it made it to the Button
  function boom(c) {
    const m = c.m, D = G.D, d = G.depthNow();
    const atk = Math.max(G.mobAtk(d), (D.heroHp || 0) * (TUNE.biteFloor || 0.03)) * (G.torment ? G.torment().bite : 1);
    emit('champBoom', c);
    const lose = () => R.champ !== c;
    // the Button and everyone by it: a quarter to a third of the Button, a fifth to a quarter of each hero
    // (the Hand's Ward stops all of it)
    if (!(R.btnDown > 0)) G.hurtParty('button', clamp(atk * 8, D.heroHp * 0.25, D.heroHp * 0.34), 'bomb');
    if (!lose() && G.partyUnits) for (const u of G.partyUnits()) { if (lose()) break; if (u.who >= 0 && !(u.down > 0)) G.hurtParty(u.who, clamp(atk * 4, u.max * 0.2, u.max * 0.25), 'bomb'); }
    if (!lose()) escape(c, 'boom');
  }

  // ---------- Damage ----------
  G.hook('hit', (m, dmg, src) => {
    if (!m.champ || m.decoy) return;
    const c = R.champ;
    if (!c || m !== c.m) return;
    if (c.mech === 'shield') {
      if (c.sh > 0) {
        if (src === 'click' || src === 'smite') {
          c.sh = Math.max(0, c.sh - (src === 'smite' ? 4 : 1));
          emit('champShieldHit', c, src);
          if (c.sh <= 0) { c.exp = 7; emit('champShieldBreak', c); }
          return dmg;
        }
        return dmg * 0.2;
      }
      return dmg * 1.5;
    }
    return;
  });
  G.hook('kill', (m, src) => {
    if (!m.champ && !m.champKid) return;
    const c = R.champ;
    if (!c) return;
    if (m.decoy) {
      c.decoys = c.decoys.filter(x => x !== m);
      emit('champDecoyPop', c, m);
      return;
    }
    if (m.champKid) {
      c.kids = c.kids.filter(x => x !== m);
      if (c.split && !c.kids.length) win(c, m);
      return;
    }
    if (m !== c.m) return;
    if (c.mech === 'splitter' && !c.split) { split(c, m); return; }
    win(c, m);
  });

  // ---------- The clock ----------
  G.hook('tick', dt => {
    const S = S_();
    const c = R.champ;
    if (c) { champTick(c, dt); return; }
    if (R.chRetry > 0) R.chRetry -= dt;
    R.chPend = false;
    // where the party is: the clock restarts in every new land
    if (R.rift || !S.hero || !S.hero.cls) return;
    const key = landKey(S.depth), zone = G.zoneOf ? G.zoneOf(S.depth) : S.depth % G.REALM_SIZE;
    let L = R.chL;
    if (!L || L.key !== key) L = R.chL = { key, t: 0, zone, zt: 0, delay: rand(TUNE.champDelayMin, TUNE.champDelayMax) };
    if (L.zone !== zone) { L.zone = zone; L.zt = 0; }
    if (R.town || R.cine > 0) return;
    L.t += dt; L.zt += dt;
    if (run()[key] || R.chRetry > 0 || (S.st.playTime || 0) < 150) return;
    // past the land's first zone, 20-45 s in; in the lord's zone it comes for sure
    // (and only with the clear bar well short of full, so the fight isn't cut off by the boss)
    const must = zone >= G.REALM_SIZE - 1;
    const ok = (zone >= 1 && L.t >= L.delay) || (must && L.zt >= 8);
    // 3.6: in the lord's zone a champion still to come holds the clear bar short of the boss (see hero.js) until
    // the field is free for it; and it comes through the pacing director like every big moment
    R.chPend = must && L.zt < 90 && !(G.Tut && !(S.tut < 0));
    if (!ok || busy() || S.bossMeter > (G.D.bossNeed || 1) * (must ? 0.95 : 0.6)) return;
    if (G.director && !G.director.can('champ', must ? 2 : 1)) return;
    run()[key] = 1;
    spawn(G.realmIndex(S.depth), null, key);
  });
  function champTick(c, dt) {
    // a load, a Rift or a wipe swept it away: it never happened (it may come back later in this land)
    if (G.S !== c.S) { clearChamp('load'); return; }
    // a boss fight or a Rift clears the field: it steps back and comes again after
    if (c.sus) { if (!(R.boss || R.rift || R.town)) resume(c); return; }
    if (R.boss || R.rift) { suspend(c); return; }
    if (c.split) {
      c.kids = c.kids.filter(k => !k.dead);
      if (!c.kids.some(k => R.mobs.includes(k))) { vanish(c); return; }
    } else if (!c.hid && !R.mobs.includes(c.m)) { vanish(c); return; }
    // the Horde's sudden events and its boss wait while a champion is on the field
    if (R.evT != null && R.evT < 3) R.evT = 3;
    if (R.bossReady && !R.boss) R.bossHold = Math.max(R.bossHold || 0, 0.5);
    c.t -= dt;
    if (c.hid > 0 && (c.hid -= dt) <= 0) surface(c);
    if (c.exp > 0 && (c.exp -= dt) <= 0) { c.exp = 0; c.sh = c.shMax; emit('champShieldUp', c); }
    if (R.champ !== c) return;
    if (c.t <= 0) {
      if (c.mech === 'bomb' && !c.split) boom(c);
      else escape(c, 'time');
    }
  }
  function suspend(c) {
    for (const x of c.decoys) removeMob(x);
    c.decoys = [];
    for (const k of c.kids) removeMob(k);
    if (!c.hid) removeMob(c.m);
    c.hid = 0; c.sus = true;
    emit('champAway', c);
  }
  function resume(c) {
    c.sus = false;
    // the party moved on to another land meanwhile: it follows (that land's own champion still comes later)
    const back = m => { m.id = ++R.mobUid; m.dead = false; m.gone = false; m.p = m.cp = -0.02; R.mobs.push(m); };
    if (c.split) { c.kids = c.kids.filter(k => k.hp > 0); c.kids.forEach(back); if (!c.kids.length) { escape(c, 'left'); return; } }
    else { back(c.m); if (!R.focus) R.focus = c.m.id; }
    c.t = Math.max(c.t, 20); c.decT = 4;
    emit('champReturn', c);
  }
  function removeMob(m) {
    if (!m) return;
    const i = R.mobs.indexOf(m);
    if (i >= 0) { R.mobs.splice(i, 1); m.dead = true; m.gone = true; emit('mobFlee', m); }
    if (R.focus === m.id) R.focus = null;
  }
  function clearChamp() {
    const c = R.champ;
    if (!c) return;
    for (const x of c.decoys) removeMob(x);
    for (const k of c.kids) removeMob(k);
    if (!c.split) removeMob(c.m);
    R.champ = null;
    emit('champGone', c);
  }
  function vanish(c) {
    clearChamp();
    // it may try again in this land in a little while
    const r = run();
    if (c.S === S_()) { delete r[c.key]; R.chRetry = 25; }
  }
  function escape(c, why) {
    for (const k of c.kids) removeMob(k);
    for (const x of c.decoys) removeMob(x);
    c.decoys = [];
    const m = c.m;
    // (where it was, for the show)
    c.at = { a: m.a, p: m.p };
    if (!c.hid) removeMob(m);
    R.champ = null;
    c.why = why;
    const S = S_();
    S.st.champEsc = (S.st.champEsc || 0) + 1;
    emit('champEscape', c, why);
  }

  // ---------- The reward ----------
  function uniqueFor(d) {
    // (4.0, runflow: inside a Siege the run's pool - world.js G.uniqueFor: the Deeds' unlocks, the Siege's depth gates)
    if (G.inSiege && G.inSiege() && G.uniqueFor) return G.uniqueFor(d, false);
    const S = S_(), ok = (G.UNIQUE_IDS || []).filter(q => { const U = G.UNIQUES[q]; return U && U.minD <= d && !U.boss; });
    if (!ok.length) return null;
    const fresh = ok.filter(q => !S.uq[q]), from = fresh.length && chance(0.5) ? fresh : ok;
    return from[Math.floor(G.rng() * from.length)];
  }
  function win(c, m) {
    const S = S_(), d = G.depthNow(), cap = G.rarityCap();
    for (const x of c.decoys) removeMob(x);
    c.decoys = [];
    R.champ = null;
    S.st.champs = (S.st.champs || 0) + 1;
    S.st.champBest = Math.max(S.st.champBest || 0, c.key);
    const rew = { gear: [], orbs: [], chests: 0, gold: 0, uq: null };
    // gear: one at the land's promise (rare in the first land, a step every two lands), one or two a step below
    const top = Math.min(cap, 2 + Math.floor(c.key / 2) + (chance(0.25) ? 1 : 0));
    const o = { src: 'champion', spread: 0.06 };
    if (G.dropItem) {
      const n = 1 + (chance(0.5) ? 2 : 1);
      for (let i = 0; i < n; i++) {
        const it = G.pickItem(i === n - 1 ? top : Math.max(1, top - 1));
        rew.gear.push(it.r);
        G.dropItem('gear', it, m, Object.assign({ wait: i * 0.12 }, o));
      }
      const orbs = ['ascent', chance(0.15) ? 'grace' : chance(0.5) ? 'flux' : G.ORB_IDS && G.ORB_IDS[Math.floor(G.rng() * G.ORB_IDS.length)] || 'flux'];
      for (const [i, k] of orbs.entries()) if (!G.ORBS || G.ORBS[k]) { rew.orbs.push(k); G.dropItem('orb', k, m, Object.assign({ wait: 0.3 + i * 0.1 }, o)); }
      // now and then a unique (the first champion of a fresh save never; the tenth for sure, if none came)
      const p = 0.06 + 0.01 * Math.min(10, c.key), siege = !!(G.inSiege && G.inSiege());
      if (siege ? chance(TUNE.champUqSiege) : (S.st.champs >= 2 && chance(p)) || (S.st.champs >= 10 && !S.st.champUq)) {
        const q = uniqueFor(d);
        if (q) { rew.uq = q; S.st.champUq = (S.st.champUq || 0) + 1; G.dropItem('uq', q, m, Object.assign({ wait: 0.6 }, o)); }
      }
    }
    // a chest or two, never the lowest
    const nc = chance(0.5) ? 2 : 1;
    for (let i = 0; i < nc; i++) { R.dropAt = m; const ch = G.spawnChest(Math.max(2, Math.min(cap, G.rollTier() + 1))); R.dropAt = null; if (ch) rew.chests++; }
    // the thief's sack: all of it, twice
    if (c.stolen > 0) { rew.gold = c.stolen * 2; G.addGold(rew.gold, 'champion'); }
    c.at = { a: m.a, p: m.p };
    c.rew = rew;
    emit('champKill', c, rew);
  }

  // ---------- For the UI and for testing ----------
  G.champ = () => R.champ;
  G.champFor = d => CHAMPS[G.realmIndex(d == null ? S_().depth : d)];
  // spawn one now, whatever is going on: G.forceChamp() (this land's), G.forceChamp('thief'), G.forceChamp(7)
  G.forceChamp = function (x) {
    const S = S_();
    if (!S.hero || !S.hero.cls) return null;
    if (R.champ) clearChamp('force');
    let ri = G.realmIndex(S.depth), mech = null;
    if (typeof x === 'number') ri = ((x % CHAMPS.length) + CHAMPS.length) % CHAMPS.length;
    else if (typeof x === 'string' && MECH[x]) mech = x;
    run()[landKey(S.depth)] = 1;
    return spawn(ri, mech, landKey(S.depth));
  };
  G.champClear = () => clearChamp('debug');
  // how long it has left, 0..1, and its health as one bar (the Splitter's copies added up)
  G.champHpK = function (c) {
    c = c || R.champ;
    if (!c) return 0;
    if (c.split) { let h = 0; for (const k of c.kids) if (!k.dead) h += Math.max(0, k.hp); return clamp(h / c.max, 0, 1); }
    return clamp(c.m.hp / c.m.max, 0, 1);
  };
})(globalThis.G = globalThis.G || {});
