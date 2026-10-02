// BTTN 3.1 — OVERDRIVE: the Button's own ultimate. Fighting fills the meter (time in the field, clicks and
// kills); when it's full, press V (or the OVERDRIVE button) and for a few seconds the Button pulses
// lightning over the whole field, the party attacks twice as fast and gold comes in three times over.
// No DOM here: it runs in the Node playtests too. The show is in stage.js (events odStart/odPulse/odEnd).
(function (G) {
  'use strict';
  const { emit } = G;
  const R = G.R, TUNE = G.TUNE;
  Object.assign(TUNE, {
    odFill: 75,        // seconds of fighting to fill it from empty, before clicks and kills
    odClick: 0.0025,   // meter per manual click
    odKill: 0.0004,    // meter per mob killed (a few a second count, a flood doesn't fill it alone)
    odKillCap: 0.012,  // most the kills can add a second
    odTime: 8,         // how long it lasts
    odPulse: 0.4,      // a nova every this many seconds
    odHit: 6,          // each nova: this many Warden hits on every mob in sight
    odBoss: 0.6,       // and this many seconds of the party's damage on a boss
    odAuto: 20,        // full and left alone this long, it goes off by itself (for the idle)
  });
  const od = () => (R.od = R.od || { m: 0, t: 0, kAcc: 0, full: 0 });
  G.odState = od;
  G.odReady = () => od().m >= 1 && !(od().t > 0) && !R.town && !!(G.S.hero && G.S.hero.cls);
  G.odActive = () => od().t > 0;

  G.overdrive = function (how) {
    if (!G.odReady()) return false;
    const o = od();
    o.m = 0; o.t = TUNE.odTime; o.acc = 0; o.full = 0; o.n = 0;
    G.S.st.overdrives = (G.S.st.overdrives || 0) + 1;
    G.dirty(); G.recalc();
    if (G.cinematic) G.cinematic(0.45); // a beat of stillness before it goes off
    emit('odStart', how || 'tap');
    return true;
  };

  function pulse() {
    const o = od(), D = G.D, hit = (D.heroHit || 1) * TUNE.odHit;
    let n = 0;
    for (const m of R.mobs.slice()) {
      if (m.dead || m.p < 0.05) continue;
      G.dealHit(m, m.kind === 'guardian' ? hit * 0.5 : hit, 'overdrive', false);
      n++;
    }
    if (R.boss && G.hitBoss) G.hitBoss((D.heroDps || 0) * TUNE.odBoss);
    o.n++;
    emit('odPulse', n, o.n);
  }

  G.hook('tick', dt => {
    const o = od();
    if (R.town || !(G.S.hero && G.S.hero.cls)) return;
    if (o.t > 0) {
      o.t -= dt; o.acc += dt;
      while (o.acc >= TUNE.odPulse && o.t > -0.01) { o.acc -= TUNE.odPulse; pulse(); }
      if (o.t <= 0) { o.t = 0; G.dirty(); G.recalc(); emit('odEnd', o.n); }
      return;
    }
    if (o.m < 1) {
      // fighting fills it: faster against a boss
      o.m = Math.min(1, o.m + dt / TUNE.odFill * (R.boss ? 1.5 : 1) + Math.min(o.kAcc, TUNE.odKillCap * dt));
      o.kAcc = 0;
      if (o.m >= 1) emit('odReady');
    } else if ((o.full += dt) >= TUNE.odAuto && G.S.hero.autoOd !== 0) G.overdrive('auto');
  });
  G.hook('kill', () => { const o = od(); if (!(o.t > 0)) o.kAcc += TUNE.odKill; });
  G.hook('click', () => { const o = od(); if (!(o.t > 0) && o.m < 1) o.m = Math.min(1, o.m + TUNE.odClick); });
  // twice the attack speed for the party while it lasts
  G.hook('stats', d => {
    if (!(od().t > 0)) return;
    d.heroRate *= 2; d.heroDps *= 2; if (d.wardenDps) d.wardenDps *= 2;
    for (const p of d.party || []) { p.rate *= 2; p.dps *= 2; }
  });
  // three times the gold from kills and clicks
  const baseEv = G.evMul || (() => 1);
  G.evMul = k => { const v = baseEv(k); return (k === 'gold' || k === 'click') && od().t > 0 ? v * 3 : v; };
})(globalThis.G = globalThis.G || {});
