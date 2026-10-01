// BTTN — sudden events: every minute or so something happens to the arena for a few seconds.
// No DOM here: this runs in the Node playtests too. hero.js and game.js read G.evMul(key).
(function (G) {
  'use strict';
  const { rand, randInt, chance, emit } = G;
  const R = G.R, TUNE = G.TUNE;
  Object.assign(TUNE, {
    evFirst: 70, evMin: 45, evMax: 95,   // the first after a minute, then every 45-95 s
    metEvery: 0.38, metFall: 1.2,        // a meteor every 0.38 s, 1.2 s from the sky to the ground
  });

  // at: the best depth it needs; t: how long it lasts; mul: what it does to the arena while it lasts
  const EVENTS = G.EVENTS = [
    { id: 'stampede', at: 1, w: 3, t: 12, col: '#ff7a2e', icon: 'ev_stampede', name: 'STAMPEDE!', sub: 'Horde charges from one side; hold for chests',
      mul: { speed: 1.5 } },
    { id: 'goldrush', at: 0, w: 3, t: 15, col: '#ffd84a', icon: 'ev_goldrush', name: 'GOLD FEVER', sub: 'Kill gold ×6, click gold ×3',
      mul: { gold: 6, click: 3 } },
    { id: 'chestrain', at: 0, w: 3, t: 6, col: '#ffe27a', icon: 'ev_chestrain', name: 'CHEST RAIN', sub: 'Chests fall from the sky' },
    { id: 'goblins', at: 2, w: 2, t: 20, col: '#8ae07a', icon: 'ev_goblins', name: 'TREASURE GOBLINS', sub: 'Loot thieves: catch them before they flee' },
    { id: 'meteors', at: 3, w: 2, t: 12, col: '#ff5a2e', icon: 'ev_meteors', name: 'METEOR STORM', sub: 'Meteors crush the Horde; tap one for gold' },
    { id: 'bloodmoon', at: 5, w: 2, t: 20, col: '#ff3b5c', icon: 'ev_bloodmoon', name: 'CRIMSON MOON', sub: 'Horde HP and damage ×2; XP and chests ×3',
      mul: { mobHp: 2, bite: 2, xp: 3, chest: 3 } },
    { id: 'ambush', at: 4, w: 2, t: 14, col: '#ff4f4f', icon: 'ev_ambush', name: 'AMBUSH!', sub: 'Champions at the Button; kill them for chests' },
    { id: 'swarm', at: 2, w: 2, t: 9, col: '#b6ff5a', icon: 'ev_swarm', name: 'THE FLOOD', sub: 'Hundreds of small mobs pour in' },
    { id: 'frenzy', at: 1, w: 2, t: 10, col: '#ffe27a', icon: 'ev_frenzy', name: 'ADRENALINE', sub: 'Party attack speed ×2',
      mul: { rate: 2 } },
    // never by chance: only the JACKPOT (js/world.js) sets it off
    { id: 'jackpot', at: 0, w: 0, t: 30, col: '#ffd84a', icon: 'ic_jackpot', name: 'JACKPOT FRENZY', sub: 'Gold ×10, chests rain',
      mul: { gold: 10, click: 10, chest: 4 } },
  ];
  const EV_BY_ID = G.EV_BY_ID = {};
  EVENTS.forEach(e => EV_BY_ID[e.id] = e);

  G.evMul = k => {
    const e = R.ev && EV_BY_ID[R.ev.k];
    return e && e.mul && e.mul[k] ? e.mul[k] : 1;
  };

  // a boss about to come on its own would cut the event short; with the auto-boss off, a full bar doesn't hold events back
  const bossSoon = () => R.bossReady && G.S.set.autoBoss;
  const busy = () => R.boss || R.rift || R.inv || bossSoon() || R.stun > 0;
  const S_ = () => G.S;

  function startEvent(k) {
    const S = S_(), d = S.bestDepth || 0;
    const pool = EVENTS.filter(e => d >= e.at && e.w > 0);
    if (R.ev) endEvent(false);
    let e = k ? EV_BY_ID[k] : null;
    if (!e) { const tot = pool.reduce((a, x) => a + x.w, 0); let r = G.rng() * tot; for (const x of pool) { r -= x.w; if (r <= 0) { e = x; break; } } e = e || pool[0]; }
    // not the same one twice running
    if (!k && R.evLast === e.id && pool.length > 1) e = pool.find(x => x.id !== R.evLast) || e;
    R.evLast = e.id;
    const ev = R.ev = { k: e.id, t: e.t, T: e.t, n: 0, acc: 0, a: G.rng(), met: [], ids: [], won: false };
    S.st.events = (S.st.events || 0) + 1;
    if (e.mul && (e.mul.rate || e.mul.mobHp)) R.dirty = true;
    if (e.id === 'ambush') ambush(ev);
    if (e.id === 'goblins') goblins(ev);
    emit('evStart', ev, e);
    return ev;
  }
  G.startEvent = startEvent;

  function endEvent(ok) {
    const ev = R.ev;
    if (!ev) return;
    const e = EV_BY_ID[ev.k];
    R.ev = null;
    if (e.mul && (e.mul.rate || e.mul.mobHp)) R.dirty = true;
    // what holding out pays
    let reward = 0;
    if (ok && ev.k === 'stampede' && !(R.btnDown > 0)) reward = randInt(6, 10);
    if (ok && ev.k === 'ambush' && ev.won) reward = randInt(4, 6);
    // a real chest or better, never the lowest
    for (let i = 0; i < reward; i++) G.spawnChest(Math.max(1, G.rollTier()));
    // what's left of the thieves runs off
    if (ev.k === 'goblins') for (const m of R.mobs.slice()) if (m.gob) { m.dead = true; m.gone = true; R.mobs.splice(R.mobs.indexOf(m), 1); emit('mobFlee', m); }
    emit('evEnd', ev, e, ok, reward);
  }
  G.endEvent = endEvent;

  // ---------- The events ----------
  function ambush(ev) {
    const a = ev.a, mk = (kind, da, p) => { const m = G.makeMob(kind, a + da, p); m.amb = 1; ev.ids.push(m.id); return m; };
    mk('magic', 0, 0.6); mk('magic', 0.03, 0.56);
    mk('brute', -0.03, 0.62); mk('brute', 0.05, 0.58);
    if ((S_().bestDepth || 0) >= 10) mk('rare', 0.01, 0.5);
    for (let i = 0; i < 40 && R.mobs.length < TUNE.mobMax; i++) G.makeMob('fodder', a + rand(-0.06, 0.06), rand(0.4, 0.65));
  }
  function goblins(ev) {
    const n = randInt(5, 8), d = G.depthNow();
    for (let i = 0; i < n; i++) {
      const m = G.makeMob('hoard', rand(0.1, 0.9), 0.6);
      m.gob = 1; m.w = 0.4; m.hp = m.max = G.mobHp(d) * 3;
      m.move = 'hoard'; m.life = ev.T; m.dir = chance(0.5) ? 1 : -1; m.ph = rand(0, 6);
      ev.ids.push(m.id);
    }
  }
  // where a meteor lands, in the Horde's own terms: its angle round the Button and how close in
  function meteorHit(mt) {
    const hit = [];
    for (const m of R.mobs) {
      if (m.dead || m.kind === 'guardian' || m.kind === 'hoard') continue;
      const da = Math.abs(m.a - mt.a), dp = Math.abs(m.p - mt.p);
      if (da < 0.045 && dp < 0.14) hit.push(m);
    }
    const big = (G.D.heroHit || 1) * 12;
    for (const m of hit) G.dealHit(m, Math.max(big, m.max * 0.6), 'meteor', false);
    // one that lands right by the Button hurts
    if (mt.p > 0.86 && G.hurtParty && G.victim) G.hurtParty(G.victim(), G.mobAtk(G.depthNow()) * 5, 'meteor');
    emit('meteorHit', mt, hit.length);
  }
  G.smashMeteor = function (id) {
    const ev = R.ev;
    if (!ev || ev.k !== 'meteors') return false;
    const i = ev.met.findIndex(x => x.id === id);
    if (i < 0) return false;
    const mt = ev.met.splice(i, 1)[0];
    const g = (G.D.incomeRef || 1) * 3;
    G.addGold(g, 'event');
    S_().st.smashed = (S_().st.smashed || 0) + 1;
    emit('meteorSmash', mt, g);
    return true;
  };

  function tickEvent(dt) {
    const ev = R.ev, e = EV_BY_ID[ev.k];
    // a boss, a Rift or an invasion takes over the arena
    if ((R.boss || R.rift || R.inv) && ev.k !== 'jackpot') { endEvent(false); return; }
    ev.t -= dt;
    ev.acc += dt;
    if (ev.k === 'stampede') {
      // pack after pack from one side, and faster
      while (ev.acc >= 0.55 && R.mobs.length < TUNE.mobMax) { ev.acc -= 0.55; G.spawnPack(false, ev.a); }
    } else if (ev.k === 'chestrain' || ev.k === 'jackpot') {
      // chest rain: 22 in six seconds; the jackpot's: sixty good ones over half a minute
      const jp = ev.k === 'jackpot', every = jp ? 0.5 : e.t / 22;
      while (ev.acc >= every) { ev.acc -= every; R.rain = 1; G.spawnChest(jp ? Math.min(6, G.rollTier() + 2) : undefined); R.rain = 0; ev.n++; }
    } else if (ev.k === 'meteors') {
      while (ev.acc >= TUNE.metEvery) {
        ev.acc -= TUNE.metEvery;
        // most fall where the Horde is thickest; a few anywhere
        const near = R.mobs.filter(m => !m.dead && m.p > 0.1 && m.p < 0.95 && m.kind !== 'guardian');
        const src = near.length && chance(0.8) ? near[Math.floor(G.rng() * near.length)] : null;
        const mt = { id: ++ev.n, a: src ? src.a : G.rng(), p: src ? G.clamp(src.p + 0.08, 0.15, 0.97) : rand(0.2, 0.95), t: TUNE.metFall, T: TUNE.metFall };
        ev.met.push(mt);
        emit('meteorFall', mt);
      }
      for (let i = ev.met.length - 1; i >= 0; i--) { const mt = ev.met[i]; if ((mt.t -= dt) <= 0) { ev.met.splice(i, 1); meteorHit(mt); } }
    } else if (ev.k === 'swarm') {
      // a flood of little ones from every side over the first seconds
      while (ev.acc >= 0.05 && ev.n < 260 && R.mobs.length < TUNE.mobMax) {
        ev.acc -= 0.05; ev.n++;
        const m = G.makeMob('fodder', G.rng(), -rand(0, 0.15));
        m.hp = m.max = m.hp * 0.35; m.swarm = 1;
      }
    } else if (ev.k === 'ambush') {
      if (!ev.won && ev.ids.every(id => !R.mobs.some(m => m.id === id))) { ev.won = true; endEvent(true); return; }
    } else if (ev.k === 'goblins') {
      if (ev.ids.every(id => !R.mobs.some(m => m.id === id))) { endEvent(true); return; }
    }
    if (ev.t <= 0) endEvent(ev.k !== 'ambush');
  }

  G.eventsTick = function (dt) {
    const S = S_();
    // nothing sudden while the tutorial is still showing the ropes
    if (!S.hero || !S.hero.cls || S.tut >= 0) return;
    if (R.ev) { tickEvent(dt); return; }
    if (R.evT == null) R.evT = TUNE.evFirst;
    if (R.evT > 0) R.evT -= dt;
    if (R.evT <= 0 && !busy()) { R.evT = rand(TUNE.evMin, TUNE.evMax); startEvent(); }
  };
  G.eventsClear = function () { R.ev = null; R.evT = null; };
})(globalThis.G = globalThis.G || {});
