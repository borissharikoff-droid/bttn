// BTTN 3.0 — casino: the Horde pays like a slot machine.
// No DOM here: this runs in the Node playtests too (tools/bot.js). js/casino_ui.js draws it.
//
//   SPIN     kills fill a meter (by weight, about every 45 s with the Button held); full, a slot machine
//            pops up. G.spin() pulls it (it pulls itself after TUNE.spinAuto seconds); the reels stop one
//            by one and the payout lands when the last one does ('spinStart' now, 'spinResult' then).
//   BUBBLES  now and then a kill lets go a bubble that floats for a few seconds; G.popBubble(id) pops it
//            for a short boost. G.bubbles is the list on the field.
//   CASCADE  crits in a quick run (each within TUNE.cascGap of the last) build a chain, x2, x3...; while it
//            lasts every hit lands a little harder.
//
// State: G.R.casino (runtime only). Saved: a few counters in G.S.st (spins, triples, sevens, bubbles,
// cascBest). Boosts plug in through the stats hook (damage, attack speed) and G.evMul (gold).
(function (G) {
  'use strict';
  const R = G.R, TUNE = G.TUNE, emit = G.emit;
  const rng = () => G.rng();
  const rand = (a, b) => a + rng() * (b - a);
  Object.assign(TUNE, {
    spinNeed: 55,        // kill weight to fill the spin meter (the Horde dies at about 1.2 a second held)
    spinAuto: 6,         // a ready spin pulls itself after this long
    spinStops: [1.05, 1.6, 2.15], spinTease: 0.9, // when each reel stops; the last one waits longer on two alike
    bubMin: 20, bubMax: 40, bubLife: 6, bubMax_: 2,
    cascGap: 0.5, cascStep: 0.03, cascCap: 10, cascHot: 10,
  });

  // ---------- The machine ----------
  G.SLOT_SYMS = ['coin', 'chest', 'bolt', 'skull', 'gem', 'seven'];
  G.SLOT_INFO = {
    coin:  { col: '#ffd84a', name: 'Coin' },
    chest: { col: '#e0a060', name: 'Chest' },
    bolt:  { col: '#7fe9ff', name: 'Frenzy' },
    skull: { col: '#ff6a6a', name: 'Carnage' },
    gem:   { col: '#c78bff', name: 'Gem' },
    seven: { col: '#ff3b5c', name: 'Seven' },
  };
  // What a pull lands on: [symbol, how many alike, chance]. The rest (about 39%) is three different.
  // Picked first and the reels drawn to fit, as real machines do.
  const ODDS = G.SLOT_ODDS = [
    ['seven', 3, 0.004],
    ['coin', 3, 0.05], ['chest', 3, 0.035], ['bolt', 3, 0.035], ['skull', 3, 0.035], ['gem', 3, 0.02],
    ['seven', 2, 0.02],
    ['coin', 2, 0.12], ['chest', 2, 0.08], ['bolt', 2, 0.08], ['skull', 2, 0.08], ['gem', 2, 0.05],
  ];
  // how often each symbol shows up on a miss (sevens tease now and then)
  const MISS_W = { coin: 5, chest: 4, bolt: 4, skull: 4, gem: 3, seven: 2 };
  // Payouts. Gold in seconds of the reference income (G.D.incomeRef).
  const PAY = G.SLOT_PAY = {
    coin:  { 2: { gold: 15 }, 3: { gold: 60 } },
    chest: { 2: { chests: 1 }, 3: { chests: 3, small: 6 } },
    bolt:  { 2: { boost: ['rush', 1.5, 6] }, 3: { boost: ['rush', 2, 10] } },
    skull: { 2: { xp: 0.15 }, 3: { xp: 0.6, carnage: 1 } },
    gem:   { 2: { orbs: 1 }, 3: { orbs: 3, good: 1 } },
    seven: { 2: { gold: 30 }, 3: { gold: 600, chests: 4, small: 8, boost: ['rush', 2, 15], boost2: ['gold2', 2, 15] } },
  };

  // ---------- Boosts ----------
  // k: the multiplier; dmg/rate through the stats hook, gold through G.evMul
  G.BOOSTS = {
    gold2: { col: '#ffd84a', icon: 'ic_coin',  name: 'GOLD x2' },
    dmg2:  { col: '#ff6a4a', icon: 'ic_sword', name: 'DMG x2' },
    rush:  { col: '#7fe9ff', icon: 'ic_bolt',  name: 'FRENZY' },
  };
  // What a bubble holds: [kind, weight]
  const BUBBLE_W = [['gold2', 25], ['dmg2', 25], ['meter', 20], ['magnet', 15], ['extend', 15]];
  G.BUBBLE_INFO = {
    gold2:  { col: '#ffd84a', name: 'GOLD x2', sub: '12s' },
    dmg2:   { col: '#ff6a4a', name: 'DAMAGE x2', sub: '10s' },
    meter:  { col: '#ff7ae6', name: 'SPIN +50%', sub: '' },
    magnet: { col: '#7fe9ff', name: 'MAGNET', sub: 'loot grabbed' },
    extend: { col: '#b6ff5a', name: 'TIME +5s', sub: 'all buffs' },
  };

  function fresh() {
    return { meter: 0, ready: false, readyT: 0, spin: null, last: null, boosts: {}, bubbles: [], bubT: rand(TUNE.bubMin, TUNE.bubMax) * 0.5,
      bubWant: false, uid: 0, clock: 0, casc: 0, cascAt: -9, cascPeak: 0 };
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

  G.spinMeter = () => (C().ready || C().spin ? 1 : Math.min(1, C().meter / TUNE.spinNeed));
  G.spinReady = () => !!C().ready && !C().spin && on();
  G.addSpinMeter = function (f) {
    const c = C();
    if (c.ready || c.spin) return;
    c.meter += TUNE.spinNeed * f;
    if (c.meter >= TUNE.spinNeed) ready();
  };
  function ready() {
    const c = C();
    c.meter = TUNE.spinNeed; c.ready = true; c.readyT = 0;
    emit('spinReady');
  }

  function weighted(pairs) {
    let tot = 0; for (const p of pairs) tot += p[1];
    let r = rng() * tot;
    for (const p of pairs) { r -= p[1]; if (r <= 0) return p[0]; }
    return pairs[pairs.length - 1][0];
  }
  function missSym(not) {
    return weighted(G.SLOT_SYMS.filter(s => !not.includes(s)).map(s => [s, MISS_W[s]]));
  }
  // Roll an outcome and lay the reels out to show it
  function roll() {
    let r = rng(), sym = null, n = 0;
    for (const [s, k, p] of ODDS) { if (r < p) { sym = s; n = k; break; } r -= p; }
    let reels;
    if (n === 3) reels = [sym, sym, sym];
    else if (n === 2) {
      const o = missSym([sym]), w = rng();
      // the pair mostly sits on the first two reels, so the last one keeps you guessing
      reels = w < 0.7 ? [sym, sym, o] : w < 0.85 ? [sym, o, sym] : [o, sym, sym];
    } else {
      const a = missSym([]), b = missSym([a]), c3 = missSym([a, b]);
      reels = [a, b, c3];
    }
    return { reels, sym, n };
  }

  // Pull the lever. how: 'tap' | 'key' | 'auto'. o.instant pays at once (tests)
  G.spin = function (how, o) {
    const c = C();
    if (!G.spinReady()) return null;
    o = o || {};
    const { reels, sym, n } = roll();
    const tease = reels[0] === reels[1];
    const stops = TUNE.spinStops.slice();
    if (tease) stops[2] += TUNE.spinTease;
    const res = { id: ++c.uid, reels, sym, n, triple: n === 3, jackpot: n === 3 && sym === 'seven', tease, stops, how: how || 'tap',
      t: 0, done: false, paid: null };
    c.ready = false; c.readyT = 0; c.meter = 0;
    c.spin = res;
    const s = st(); s.spins = (s.spins || 0) + 1;
    emit('spinStart', res);
    if (o.instant) payout(res);
    return res;
  };

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

  function orbRoll(good) {
    const ids = G.ORB_IDS || ['whet'];
    if (good) return rng() < 0.2 ? 'grace' : 'ascent';
    return weighted(ids.map(k => [k, (G.ORBS[k] || { w: 1 }).w]));
  }
  // the slot machine stands below the Button: loot spills out from there
  const SLOT_AT = { id: 7, a: 0.5, p: 0.8 };
  function chests(n, small, rain) {
    let got = 0;
    for (let i = 0; i < n; i++) {
      if (rain) R.rain = 1; else R.dropAt = SLOT_AT;
      const ch = G.spawnChest(small ? 0 : Math.max(1, G.rollTier()), small ? null : undefined, false, !!small);
      R.rain = 0; R.dropAt = null;
      if (ch) got++;
    }
    return got;
  }

  function payout(res) {
    const c = C(), S = G.S, D = G.D, s = st();
    if (res.done) return;
    res.done = true;
    if (c.spin === res) c.spin = null;
    c.last = res;
    const P = res.n ? PAY[res.sym][res.n] : null, paid = {};
    if (P) {
      if (P.gold) { paid.gold = (D.incomeRef || 1) * P.gold; G.addGold(paid.gold, 'casino'); }
      if (P.chests) paid.chests = chests(P.chests, false, res.n === 3);
      if (P.small) paid.small = chests(P.small, true, true);
      if (P.xp && G.gainXp && G.xpNeed) { paid.xp = G.xpNeed(S.hero.lvl) * P.xp; G.gainXp(paid.xp); }
      if (P.carnage) {
        const t0 = G.carnage ? G.carnage().tier : 0;
        R.carn = Math.max(R.carn || 0, 2000); R.carnT = 0;
        if (G.carnage && G.carnage().tier > t0) emit('carnage', G.carnage().tier);
      }
      if (P.orbs && G.dropItem) {
        paid.orbs = [];
        for (let i = 0; i < P.orbs; i++) { const k = orbRoll(P.good && i === P.orbs - 1); paid.orbs.push(k); G.dropItem('orb', k, null, { at: SLOT_AT, src: 'casino', wait: 0.2 + i * 0.12 }); }
      }
      if (P.boost) { boost(P.boost[0], P.boost[1], P.boost[2]); paid.boost = P.boost[0]; }
      if (P.boost2) boost(P.boost2[0], P.boost2[1], P.boost2[2]);
      if (res.n === 3) s.triples = (s.triples || 0) + 1;
      if (res.jackpot) s.sevens = (s.sevens || 0) + 1;
    }
    res.paid = paid;
    emit('spinResult', res);
  }
  G.spinPayout = () => { const c = C(); if (c.spin) payout(c.spin); };

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
    meter: () => { if (C().ready || C().spin) return false; G.addSpinMeter(0.5); return true; },
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
      // a hot streak: every tenth link tops up the spin meter
      if (c.casc % TUNE.cascHot === 0) { G.addSpinMeter(0.1); emit('hotStreak', c.casc); }
    }
  }
  // one per volley: its splash and its extra bolts are the same crit
  G.on('heroAttack', a => { if (a && a.crit && !a.boss && !a.extra) crit(); });

  // ---------- Hooks ----------
  G.hook('kill', (m) => {
    const c = C();
    if (!on()) return;
    if (!c.ready && !c.spin) {
      c.meter += (m.w || 0) * (m.add ? 0.4 : 1);
      if (c.meter >= TUNE.spinNeed) ready();
    }
    if (c.bubWant && !m.add && m.kind !== 'guardian') { c.bubWant = false; spawnBubble(m); }
  });
  G.hook('hit', (m, dmg) => {
    const k = cascMul();
    return k > 1 ? dmg * k : undefined;
  });
  G.hook('stats', d => {
    const dm = bk('dmg2'), rt = bk('rush');
    if (dm === 1 && rt === 1) return;
    d.heroHit *= dm; d.heroRate *= rt;
    d.heroDps *= dm * rt; if (d.wardenDps) d.wardenDps *= dm * rt;
    for (const p of d.party || []) { p.hit *= dm; p.rate *= rt; p.dps *= dm * rt; }
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
    // boosts run out
    let changed = false;
    for (const id in c.boosts) {
      const b = c.boosts[id];
      if (b.t > 0 && (b.t -= dt) <= 0) { delete c.boosts[id]; changed = true; emit('boostEnd', id); }
    }
    if (changed) { G.dirty(); G.recalc(); }
    // the reels turn; the payout lands with the last one
    if (c.spin) { c.spin.t += dt; if (c.spin.t >= c.spin.stops[2] + 0.15) payout(c.spin); }
    // a ready spin pulls itself if left alone (not while a window covers the field)
    else if (c.ready && !(G.casinoHold && G.casinoHold('auto')) && (c.readyT += dt) >= TUNE.spinAuto) G.spin('auto');
    // bubbles
    for (let i = c.bubbles.length - 1; i >= 0; i--) {
      const b = c.bubbles[i];
      if ((b.t += dt) >= b.life) { c.bubbles.splice(i, 1); emit('bubbleGone', b); }
    }
    if (!c.bubWant && (c.bubT -= dt) <= 0) { c.bubWant = true; c.bubT = rand(TUNE.bubMin, TUNE.bubMax); }
    // the cascade breaks when no crit follows in time
    if (c.casc > 0 && c.clock - c.cascAt > TUNE.cascGap) { const n = c.casc; c.casc = 0; if (n >= 2) emit('cascadeEnd', n); }
  });

  // a new run starts clean: boosts and bubbles go, the meter and a spin in hand stay
  G.on('ascend', () => {
    const c = C();
    c.boosts = {}; c.bubbles.length = 0; c.casc = 0;
    G.dirty();
  });
})(globalThis.G = globalThis.G || {});
