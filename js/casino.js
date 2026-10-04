// BTTN 3.0 — casino: bonus bubbles, the crit cascade and the boosts they give.
// No DOM here: this runs in the Node playtests too (tools/bot.js). js/casino_ui.js draws it.
// (3.6: the Lucky Spin slot machine is gone; G.casinoIncome, the purse's real income, stays here.)
//
//   BUBBLES  now and then a kill lets go a bubble that floats for a few seconds; G.popBubble(id) pops it
//            for a short boost. G.bubbles is the list on the field.
//   CASCADE  crits in a quick run (each within TUNE.cascGap of the last) build a chain, x2, x3...; while it
//            lasts every hit lands a little harder.
//
// State: G.R.casino (runtime only). Saved: a few counters in G.S.st (bubbles, cascBest; old saves also
// keep spins, triples and sevens, which nothing reads now). Boosts plug in through the stats hook
// (damage) and G.evMul (gold).
(function (G) {
  'use strict';
  const R = G.R, TUNE = G.TUNE, emit = G.emit;
  const rng = () => G.rng();
  const rand = (a, b) => a + rng() * (b - a);
  Object.assign(TUNE, {
    bubMin: 20, bubMax: 40, bubLife: 6, bubMax_: 2, bubPurse: 20,
    cascGap: 0.5, cascStep: 0.03, cascCap: 10, cascHot: 10,
  });

  // ---------- Boosts ----------
  // k: the multiplier; dmg through the stats hook, gold through G.evMul
  G.BOOSTS = {
    gold2: { col: '#ffd84a', icon: 'ic_coin',  name: 'GOLD x2' },
    dmg2:  { col: '#ff6a4a', icon: 'ic_sword', name: 'DMG x2' },
  };
  // What a bubble holds: [kind, weight]
  const BUBBLE_W = [['gold2', 25], ['dmg2', 25], ['purse', 20], ['magnet', 15], ['extend', 15]];
  G.BUBBLE_INFO = {
    gold2:  { col: '#ffd84a', name: 'GOLD x2', sub: '12s' },
    dmg2:   { col: '#ff6a4a', name: 'DAMAGE x2', sub: '10s' },
    purse:  { col: '#ffd84a', name: 'PURSE', sub: '' },
    magnet: { col: '#7fe9ff', name: 'MAGNET', sub: 'loot grabbed' },
    extend: { col: '#b6ff5a', name: 'TIME +5s', sub: 'all buffs' },
  };

  function fresh() {
    return { boosts: {}, bubbles: [], bubT: null,
      bubWant: false, uid: 0, clock: 0, casc: 0, cascAt: -9, cascPeak: 0, rate: 0, gPrev: -1, own: 0 };
  }
  const C = () => R.casino || (R.casino = fresh());
  C();
  G.casino = C;
  Object.defineProperty(G, 'bubbles', { get: () => C().bubbles, configurable: true, enumerable: true });
  const st = () => G.S.st;

  // Paused: in town, in a cinematic, before a class is picked, or while the UI holds it (the tutorial)
  function on() {
    const S = G.S;
    return !!(S && S.hero && S.hero.cls) && !R.town && !(R.cine > 0) && !(G.casinoHold && G.casinoHold('all'));
  }
  G.casinoOn = on;

  function weighted(pairs) {
    let tot = 0; for (const p of pairs) tot += p[1];
    let r = rng() * tot;
    for (const p of pairs) { r -= p[1]; if (r <= 0) return p[0]; }
    return pairs[pairs.length - 1][0];
  }
  function boost(id, k, secs) {
    const c = C(), b = c.boosts[id];
    if (b && b.t > 0) { b.k = Math.max(b.k, k); b.t = Math.max(b.t, secs); b.T = Math.max(b.T, b.t); }
    else c.boosts[id] = { id, k, t: secs, T: secs };
    G.dirty(); G.recalc();
    emit('boostStart', c.boosts[id]);
  }
  G.casinoBoost = boost;
  G.casinoBoosts = () => { const c = C(), out = []; for (const id in c.boosts) { const b = c.boosts[id]; if (b.t > 0) out.push(Object.assign({}, G.BOOSTS[id], b)); } return out; };
  const bk = id => { const b = C().boosts[id]; return b && b.t > 0 ? b.k : 1; };

  // gold a second, as earned over the last half minute or so (the casino's own payouts left out)
  function income() { return Math.max(G.D.incomeRef || 1, C().rate || 0); }
  G.casinoIncome = income;

  // ---------- Bubbles ----------
  function spawnBubble(m) {
    const c = C();
    if (c.bubbles.length >= TUNE.bubMax_) return null;
    const b = { id: ++c.uid, a: m.a, p: Math.min(1, Math.max(0.05, m.p)), t: 0, life: TUNE.bubLife, ph: rng() };
    c.bubbles.push(b);
    emit('bubble', b, m);
    return b;
  }
  G.spawnBubble = m => spawnBubble(m || { a: rng(), p: rand(0.5, 0.8) });
  // what a bubble does; false when it would do nothing right now (then another is rolled)
  const BUBBLE_FX = {
    gold2: () => { boost('gold2', 2, 12); return true; },
    dmg2: () => { boost('dmg2', 2, 10); return true; },
    // 3.6 (was SPIN +50%): a purse of 20 s of income, kept out of the income estimate like any bonus
    purse: () => { const g = income() * TUNE.bubPurse; C().own += g; G.addGold(g, 'bubble'); return g; },
    magnet: () => {
      const S = G.S, small = S.chests.filter(x => x.small);
      const n = small.length + (R.ground ? R.ground.length : 0);
      if (!n) return false;
      for (const x of small) G.openChest(x, 'magnet');
      if (G.pickupAll) G.pickupAll();
      return n;
    },
    extend: () => {
      const S = G.S, c = C();
      let n = 0;
      for (const b of S.buffs) { b.t += 5; b.T = Math.max(b.T || 0, b.t); n++; }
      for (const k in R.hb) if (R.hb[k] > 0) { R.hb[k] += 5; n++; }
      for (const id in c.boosts) { const b = c.boosts[id]; if (b.t > 0) { b.t += 5; b.T = Math.max(b.T, b.t); n++; } }
      return n > 0;
    },
  };
  G.popBubble = function (id) {
    const c = C();
    const i = c.bubbles.findIndex(b => b.id === id);
    if (i < 0 || !on()) return null;
    const b = c.bubbles.splice(i, 1)[0];
    let kind = weighted(BUBBLE_W), got = BUBBLE_FX[kind]();
    for (let k = 0; !got && k < 6; k++) { kind = weighted(BUBBLE_W); got = BUBBLE_FX[kind](); }
    if (!got) { kind = 'gold2'; BUBBLE_FX.gold2(); }
    const s = st(); s.bubbles = (s.bubbles || 0) + 1;
    const res = { id: b.id, kind, a: b.a, p: b.p, n: typeof got === 'number' ? got : 0 };
    emit('bubblePop', b, res);
    return res;
  };

  // ---------- Crit cascade ----------
  G.cascade = () => { const c = C(); return { n: c.casc, mul: cascMul(), left: Math.max(0, TUNE.cascGap - (c.clock - c.cascAt)) }; };
  function cascMul() { const n = C().casc; return n >= 2 ? 1 + TUNE.cascStep * (Math.min(n, TUNE.cascCap) - 1) : 1; }
  G.cascadeMul = cascMul;
  function crit() {
    const c = C();
    if (!on()) return;
    if (c.casc > 0 && c.clock - c.cascAt <= TUNE.cascGap) c.casc++;
    else c.casc = 1;
    c.cascAt = c.clock;
    if (c.casc > c.cascPeak) c.cascPeak = c.casc;
    if (c.casc >= 2) {
      emit('cascade', c.casc, cascMul());
      const s = st(); if (c.casc > (s.cascBest || 0)) s.cascBest = c.casc;
      // a hot streak: every tenth link tops up the Overdrive (js/overdrive.js)
      if (c.casc % TUNE.cascHot === 0) { if (G.odAdd) G.odAdd(0.1); emit('hotStreak', c.casc); }
    }
  }
  // one per volley: its splash and its extra bolts are the same crit
  G.on('heroAttack', a => { if (a && a.crit && !a.boss && !a.extra) crit(); });

  // ---------- Hooks ----------
  G.hook('kill', (m) => {
    const c = C();
    if (!on()) return;
    if (c.bubWant && !m.add && m.kind !== 'guardian') { c.bubWant = false; spawnBubble(m); }
  });
  G.hook('hit', (m, dmg) => {
    const k = cascMul();
    return k > 1 ? dmg * k : undefined;
  });
  G.hook('stats', d => {
    const dm = bk('dmg2');
    if (dm === 1) return;
    d.heroHit *= dm;
    d.heroDps *= dm; if (d.wardenDps) d.wardenDps *= dm;
    for (const p of d.party || []) { p.hit *= dm; p.dps *= dm; }
  });
  // gold: kill gold and click gold through the arena's multiplier (js/events.js)
  const baseEv = G.evMul || (() => 1);
  G.evMul = k => {
    const v = baseEv(k);
    return k === 'gold' || k === 'click' ? v * bk('gold2') : v;
  };

  G.hook('tick', dt => {
    const c = C();
    if (!on()) return;
    c.clock += dt;
    const S = G.S;
    if (c.gPrev >= 0 && dt > 0) {
      const got = S.goldTotal - c.gPrev - c.own;
      if (got >= 0) c.rate += (got / dt - c.rate) * Math.min(1, dt / 30);
    }
    c.gPrev = S.goldTotal; c.own = 0;
    // boosts run out
    let changed = false;
    for (const id in c.boosts) {
      const b = c.boosts[id];
      if (b.t > 0 && (b.t -= dt) <= 0) { delete c.boosts[id]; changed = true; emit('boostEnd', id); }
    }
    if (changed) { G.dirty(); G.recalc(); }
    // bubbles
    for (let i = c.bubbles.length - 1; i >= 0; i--) {
      const b = c.bubbles[i];
      if ((b.t += dt) >= b.life) { c.bubbles.splice(i, 1); emit('bubbleGone', b); }
    }
    // (the first wait is rolled on the first tick, once the run's seed is set)
    if (c.bubT == null) c.bubT = rand(TUNE.bubMin, TUNE.bubMax) * 0.5;
    if (!c.bubWant && (c.bubT -= dt) <= 0) { c.bubWant = true; c.bubT = rand(TUNE.bubMin, TUNE.bubMax); }
    // the cascade breaks when no crit follows in time
    if (c.casc > 0 && c.clock - c.cascAt > TUNE.cascGap) { const n = c.casc; c.casc = 0; if (n >= 2) emit('cascadeEnd', n); }
  });

  // a new run starts clean: boosts and bubbles go
  G.on('ascend', () => {
    const c = C();
    c.boosts = {}; c.bubbles.length = 0; c.casc = 0;
    G.dirty();
  });
})(globalThis.G = globalThis.G || {});
