// BTTN 3.4 — spells_fx: the show for the Hand Spells (js/spells.js).
// An overlay canvas of its own over the stage (under the HUD), drawn as chunky pixel art: everything is
// painted at the stage's own pixel scale on a small canvas and blown up without smoothing, so it sits on
// the field like the stage's own sprites. Two layers of show:
//  - the big spells (spellCast / spellHit / spellEnd): meteors with fire trails and craters, a ring of
//    flame, a blizzard with ice that shatters, a tornado of dust, a holy beam, ground cracks, a poison
//    cloud, seeking orbs, falling swords, chain lightning, a lava eruption, shadow claws;
//  - every click: the land's element dresses the Hand's strike (heroAttack, src 'click'): a geyser on the
//    Shoreline, petals in the Meadows, roots in Deepwood, rock spikes in the Highlands, ice in the
//    Frostlands, holy rays, hellfire, void rifts, glyphs, sparks and cogs, lava, prisms, feathers,
//    moonbeams, falling stars.
// Plus a tiny word for each spell and a few notes from its own WebAudio voice. Browser only; the stage's
// flash and shake are borrowed through G.Stage.
(function (G) {
  'use strict';
  if (typeof document === 'undefined' || !G.SPELL_DEFS) return;
  const R = G.R;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pickA = a => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const FONT = '"Press Start 2P", "BTTN Body", monospace';
  const St = () => G.Stage || null;
  const MAXP = 600;

  const st = document.createElement('style');
  st.textContent = '#spellFx { position: absolute; inset: 0; pointer-events: none; }';
  (document.head || document.documentElement).appendChild(st);

  // ================= Sound =================
  const Snd = {
    ac: null,
    on() { const s = G.S && G.S.set; return !!(s && s.sound && !(s.vol <= 0)) && !document.hidden; },
    ctx() {
      if (!this.on()) return null;
      if (!this.ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try { this.ac = new AC(); } catch (e) { return null; }
      }
      if (this.ac.state === 'suspended') { try { this.ac.resume(); } catch (e) { /* not yet allowed */ } }
      return this.ac;
    },
    vol() { return Math.min(1, G.S.set.vol == null ? 0.6 : G.S.set.vol) * 0.26; },
  };
  let noiseBuf = null;
  function tone(type, f0, f1, t, dur, v) {
    const ac = Snd.ctx(); if (!ac) return;
    const T0 = ac.currentTime + 0.02 + t, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, T0);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, T0 + dur);
    g.gain.setValueAtTime(0.0001, T0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v * Snd.vol()), T0 + Math.min(0.03, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, T0 + dur);
    o.connect(g); g.connect(ac.destination); o.start(T0); o.stop(T0 + dur + 0.05);
  }
  function noise(t, dur, v, f0, f1, type) {
    const ac = Snd.ctx(); if (!ac) return;
    if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const T0 = ac.currentTime + 0.02 + t, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; s.loop = true; f.type = type || 'lowpass'; f.frequency.setValueAtTime(f0 || 2000, T0);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, T0 + dur);
    g.gain.setValueAtTime(0.0001, T0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v * Snd.vol()), T0 + Math.min(0.05, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, T0 + dur);
    s.connect(f); f.connect(g); g.connect(ac.destination); s.start(T0); s.stop(T0 + dur + 0.05);
  }
  const boom = (t, v) => { noise(t, 0.8, 1.2 * v, 1600, 60); tone('sine', 95, 32, t, 0.7, 0.9 * v); };
  const SFX = {
    meteor(sp) { tone('sine', 1400, 260, 0, sp.ev[0].t, 0.12); noise(0, sp.ev[0].t, 0.25, 900, 3000, 'bandpass'); },
    shower() { tone('sine', 1600, 500, 0, 0.5, 0.08); },
    firestorm() { noise(0, 1.2, 0.9, 300, 2600, 'bandpass'); tone('sawtooth', 70, 140, 0, 0.9, 0.2); },
    blizzard() { noise(0, 2.6, 0.5, 600, 1800, 'bandpass'); [2093, 2637, 3136, 2349].forEach((f, i) => tone('sine', f, f, 0.3 + i * 0.35, 0.18, 0.07)); },
    tornado() { noise(0, 3, 0.7, 300, 900, 'bandpass'); noise(0.8, 1.8, 0.4, 700, 300, 'bandpass'); },
    holy() { [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.45 + i * 0.03, 1.1, 0.12)); tone('sine', 2093, 3136, 0.5, 0.6, 0.06); },
    quake() { noise(0, 1.9, 1.1, 220, 50); tone('sine', 55, 35, 0, 1.6, 0.6); },
    poison() { for (let i = 0; i < 7; i++) tone('sine', rnd(250, 520), rnd(500, 900), 0.3 + i * 0.4 + rnd(0, 0.1), 0.07, 0.1); },
    orbs(sp) { sp.ev.forEach((e, i) => tone('sine', 660 * Math.pow(1.19, i), 990 * Math.pow(1.19, i), i * 0.07, 0.25, 0.08)); },
    swords() { noise(0, 0.25, 0.2, 5000, 1500, 'highpass'); },
    chain() { noise(0, 0.12, 0.5, 6000, 1500, 'highpass'); },
    lava() { tone('sine', 140, 60, 0.4, 0.6, 0.6); noise(0.4, 0.9, 0.8, 900, 120); },
    shadow() { tone('sawtooth', 110, 55, 0, 0.9, 0.15); },
    // strikes
    impact(sp) { boom(0, sp.kind === 'meteor' ? 1 : sp.kind === 'shower' ? 0.35 : 0.7); },
    sword() { tone('square', rnd(1700, 2100), 1200, 0, 0.06, 0.06); },
    bolt() { noise(0, 0.18, 0.7, 7000, 1800, 'highpass'); tone('square', 220, 110, 0, 0.12, 0.08); },
    orb() { tone('sine', 1320, 660, 0, 0.12, 0.08); },
    slash() { noise(0, 0.16, 0.6, 6000, 700, 'bandpass'); },
    pulse() { boom(0, 0.5); },
    shatter() { for (let i = 0; i < 5; i++) tone('square', rnd(2400, 3600), rnd(1800, 2400), i * 0.03, 0.08, 0.06); noise(0, 0.3, 0.4, 7000, 3000, 'highpass'); },
  };

  // ================= Layers =================
  let cv = null, ctx = null, low = null, lx = null;
  let W = 0, H = 0, DPR = 1, u = 3, Wl = 200, Hl = 150, ox = 0, oy = 0;
  function ensure() {
    if (cv && cv.isConnected) return true;
    const stage = document.getElementById('stage');
    if (!stage) return false;
    cv = document.createElement('canvas'); cv.id = 'spellFx';
    stage.insertAdjacentElement('afterend', cv);
    ctx = cv.getContext('2d');
    low = document.createElement('canvas'); lx = low.getContext('2d');
    return true;
  }
  function layout() {
    const r = cv.getBoundingClientRect(), s = St();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (Math.round(r.width * dpr) !== cv.width || Math.round(r.height * dpr) !== cv.height || dpr !== DPR) {
      DPR = dpr; cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    }
    W = r.width; H = r.height;
    // the stage's pixel scale and where its pixels start
    if (s && s.toScreen) { const a = s.toScreen(0, 0), b = s.toScreen(1, 0); u = Math.max(1, b.x - a.x); ox = a.x - r.left; oy = a.y - r.top; }
    const sc = document.getElementById('stage'), sr = sc ? sc.getBoundingClientRect() : r;
    Wl = Math.ceil(Math.max(200, sr.width) / u); Hl = Math.ceil(Math.max(160, sr.height) / u);
    if (low.width !== Wl || low.height !== Hl) { low.width = Wl; low.height = Hl; }
  }

  // ================= Where things are (stage pixels) =================
  function btn() { const s = St(); return s && s.btnPos ? s.btnPos() : { x: Math.round(Wl / 2), y: Math.round(Hl * 0.54) }; }
  // an arena point (as G.mobXY gives it) on the ground, in stage pixels: the same mapping the stage walks mobs on
  function P(x, y) {
    const b = btn(), r = Math.hypot(x, y);
    if (r < 1e-4) return { x: b.x, y: b.y + 4 };
    const ux = x / r, uy = y / r, k = (1 - r) / 0.88;
    const sx = b.x + ux * Wl * 0.6, sy = b.y + uy * Hl * 0.56, ex = b.x + ux * 26, ey = b.y + uy * 14 + 4;
    return { x: sx + (ex - sx) * k, y: sy + (ey - sy) * k };
  }
  // a radius in arena units as a ground ellipse (the field is seen from above at a slant)
  function rad(r) { const rx = r * Math.max(40, (Wl * 0.6 - 26) / 0.88), ry = Math.min(r * Math.max(30, (Hl * 0.56 - 14) / 0.88), rx * 0.6); return { rx, ry }; }
  // a mob's feet (as the stage draws it, less the bob)
  function mobL(m) {
    const b = btn(), a = -Math.PI / 2 + 0.55 + m.a * (Math.PI * 2 - 1.1), j = ((m.id * 7919) % 97) / 97;
    const sx = b.x + Math.cos(a) * Wl * 0.6, sy = b.y + Math.sin(a) * Hl * 0.56;
    const ex = b.x + Math.cos(a) * (21 + j * 10), ey = b.y + Math.sin(a) * (11 + j * 6) + 4, k = m.p;
    return { x: sx + (ex - sx) * k, y: sy + (ey - sy) * k };
  }
  const bossBody = () => { const b = btn(); return { x: b.x, y: b.y - 22 }; };
  const realmEl = () => (G.landElement ? G.landElement() : 'spark');

  // ================= Pixel drawing (on the small canvas) =================
  function rect(x, y, w, h, col, a) { if (a != null) lx.globalAlpha = clamp(a, 0, 1); lx.fillStyle = col; lx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); if (a != null) lx.globalAlpha = 1; }
  function dot(x, y, col, s) { lx.fillStyle = col; const k = s || 1; lx.fillRect(Math.round(x - (k >> 1)), Math.round(y - (k >> 1)), k, k); }
  function fillE(cx, cy, rx, ry, col, a) {
    rx = Math.max(1, rx); ry = Math.max(1, ry);
    lx.globalAlpha = clamp(a == null ? 1 : a, 0, 1); lx.fillStyle = col;
    const y0 = Math.round(-ry), y1 = Math.round(ry), X = Math.round(cx), Y = Math.round(cy);
    for (let dy = y0; dy <= y1; dy++) { const h = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / ry) * (dy / ry)))); if (h > 0) lx.fillRect(X - h, Y + dy, h * 2, 1); }
    lx.globalAlpha = 1;
  }
  function ringE(cx, cy, rx, ry, col, a, w, dash) {
    rx = Math.max(1, rx); ry = Math.max(1, ry);
    lx.globalAlpha = clamp(a == null ? 1 : a, 0, 1); lx.fillStyle = col;
    const n = Math.max(16, Math.round((rx + ry) * 3.2)), s = w || 1;
    for (let i = 0; i < n; i++) {
      if (dash && (i % (dash * 2)) >= dash) continue;
      const t = i / n * Math.PI * 2;
      lx.fillRect(Math.round(cx + Math.cos(t) * rx - s / 2), Math.round(cy + Math.sin(t) * ry - s / 2), s, s);
    }
    lx.globalAlpha = 1;
  }
  function line(x0, y0, x1, y1, col, w, a) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)))), s = w || 1;
    if (a != null) lx.globalAlpha = clamp(a, 0, 1);
    lx.fillStyle = col;
    for (let i = 0; i <= n; i++) lx.fillRect(Math.round(x0 + (x1 - x0) * i / n - s / 2), Math.round(y0 + (y1 - y0) * i / n - s / 2), s, s);
    if (a != null) lx.globalAlpha = 1;
  }
  function tri(ax, ay, bx, by, cx2, cy2, col, a) {
    lx.globalAlpha = clamp(a == null ? 1 : a, 0, 1); lx.fillStyle = col;
    lx.beginPath(); lx.moveTo(Math.round(ax), Math.round(ay)); lx.lineTo(Math.round(bx), Math.round(by)); lx.lineTo(Math.round(cx2), Math.round(cy2)); lx.closePath(); lx.fill();
    lx.globalAlpha = 1;
  }
  // a stepped glow: a few flat ellipses, no blur
  function glowE(cx, cy, rx, ry, col, a) { fillE(cx, cy, rx, ry, col, a * 0.25); fillE(cx, cy, rx * 0.66, ry * 0.66, col, a * 0.35); fillE(cx, cy, rx * 0.36, ry * 0.36, col, a * 0.5); }
  // a jagged bolt from a to b
  function bolt(ax, ay, bx, by, cols, jag, w) {
    const n = Math.max(3, Math.round(Math.hypot(bx - ax, by - ay) / 9));
    let px0 = ax, py0 = ay;
    const nx = -(by - ay), ny = bx - ax, L = Math.hypot(nx, ny) || 1;
    for (let i = 1; i <= n; i++) {
      const k = i / n, off = i < n ? rnd(-jag, jag) : 0;
      const x = ax + (bx - ax) * k + nx / L * off, y = ay + (by - ay) * k + ny / L * off;
      line(px0, py0, x, y, cols[0], (w || 1) + 2, 0.55);
      line(px0, py0, x, y, cols[1] || '#ffffff', w || 1);
      px0 = x; py0 = y;
    }
  }

  // ================= Particles, marks =================
  const parts = [], decals = [], fxs = [], words = [], quick = [];
  function part(x, y, o) {
    if (parts.length >= MAXP) return null;
    const p = Object.assign({ x, y, vx: 0, vy: 0, life: 0.6, col: '#ffffff', sz: 1, grav: 0, drag: 0, streak: 0 }, o);
    p.max = p.life; parts.push(p); return p;
  }
  function burst(x, y, cols, n, sp, o) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = rnd(sp * 0.3, sp);
      if (!part(x, y, Object.assign({ vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7 - sp * 0.25, life: rnd(0.35, 0.8), col: pickA(cols), sz: Math.random() < 0.3 ? 2 : 1, grav: 120 }, o))) return;
    }
  }
  // debris: chunks that fly up and fall back to the ground they came from
  function debris(x, y, cols, n, sp, o) {
    for (let i = 0; i < n; i++) {
      const a = rnd(-Math.PI * 0.95, -Math.PI * 0.05), s = rnd(sp * 0.4, sp);
      if (!part(x + rnd(-3, 3), y, Object.assign({ vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(0.5, 0.95), col: pickA(cols), sz: Math.random() < 0.4 ? 2 : 1, grav: 260, floor: y + rnd(-2, 6) }, o))) return;
    }
  }
  function decal(o) { if (decals.length > 40) decals.shift(); o.max = o.life; decals.push(o); }
  function ringFx(x, y, rx0, rx1, ry0, ry1, col, life, w) { quick.push({ k: 'ring', x, y, rx0, rx1, ry0, ry1, col, life, max: life, w: w || 1 }); }
  function flashFx(x, y, rx, ry, col, life) { quick.push({ k: 'glow', x, y, rx, ry, col, life, max: life }); }
  function word(sp) {
    const d = G.SPELL_DEFS[sp.kind]; if (!d) return;
    const c = sp.onBoss ? bossBody() : sp.kind === 'firestorm' || sp.kind === 'orbs' ? { x: btn().x, y: btn().y - 40 } : sp.kind === 'tornado' ? P((sp.x0 + sp.x1) / 2 * 0.4, sp.y0) : P(sp.x, sp.y);
    // one at a time: the new one pushes the old away
    words.length = 0;
    words.push({ str: d.name, col: d.col, x: clamp(c.x, 30, Wl - 30), y: clamp(c.y - (sp.onBoss ? 26 : 30), 30, Hl - 40), life: 1.25, max: 1.25 });
  }
  const shake = v => { const s = St(); if (s && s.shake) s.shake(v); };
  const flash = (v, c) => { const s = St(); if (s && s.flash) s.flash(v, c); };

  // ================= The spells =================
  // fx: { sp, t, live } — t follows the logic's own clock while the spell lives, so what falls lands on the hit
  const FIRE = ['#ffe27a', '#ffb04a', '#ff7a2e', '#ff4a1a', '#ffffff'];
  const SMOKE = ['#3a3442', '#4a4352', '#5a5262'];
  const ICE = ['#ffffff', '#d8f6ff', '#9fe4ff', '#5ac8ff'];
  const ROCK = ['#6a5040', '#8a6a50', '#4a3a30', '#a88a68'];
  const GREEN = ['#8ae04a', '#5ab83a', '#c8ff7a', '#3a8a2a'];
  const PURP = ['#c88aff', '#9a5aff', '#ffffff', '#e4c8ff'];
  const GOLD = ['#ffe27a', '#fff3a0', '#ffffff', '#ffd84a'];

  function rock(x, y, r, hot) {
    fillE(x, y, r + 1, r + 1, '#1a0e0a', 1);
    fillE(x, y, r, r, '#6a3020', 1);
    fillE(x - r * 0.25, y + r * 0.2, r * 0.6, r * 0.6, hot ? '#ff7a2e' : '#8a4a30', 1);
    fillE(x - r * 0.35, y + r * 0.35, r * 0.3, r * 0.3, hot ? '#ffe27a' : '#a86a40', 1);
  }
  function fall(x0, y0, x1, y1, k) { const e = k * k; return { x: x0 + (x1 - x0) * e, y: y0 + (y1 - y0) * e }; }
  function meteorAt(sp, ev, t, big) {
    const c = P(ev.x, ev.y), a = rad(ev.r), T0 = ev.t, dur = big ? T0 : 0.5, t0 = T0 - dur;
    if (t < t0 || t >= T0) return;
    const k = (t - t0) / dur, sx = c.x - sp.dir * (big ? 110 : 60), sy = -24;
    const p = fall(sx, sy, c.x, c.y - 3, k);
    // the spot it will hit: a warning ring that tightens
    ringE(c.x, c.y, a.rx * (1.25 - 0.25 * k), a.ry * (1.25 - 0.25 * k), '#ff3b3b', 0.35 + 0.35 * (Math.sin(t * 30) > 0 ? 1 : 0), 1, 3);
    if (big) fillE(c.x, c.y, a.rx * k * 0.9, a.ry * k * 0.9, '#ff7a2e', 0.12 + 0.12 * k);
    // the trail: fire and smoke left behind as it falls
    const r = big ? 5 : 3, dx = c.x - sx, dy = c.y - sy, L = Math.hypot(dx, dy) || 1;
    for (let i = 0; i < (big ? 5 : 2); i++) part(p.x - dx / L * rnd(0, r * 2) + rnd(-2, 2), p.y - dy / L * rnd(0, r * 2) + rnd(-2, 2), { vx: -dx / L * rnd(10, 40) + rnd(-10, 10), vy: -dy / L * rnd(10, 40) - 10, life: rnd(0.2, 0.45), col: pickA(FIRE), sz: Math.random() < 0.5 ? 2 : 1, drag: 2 });
    if (Math.random() < (big ? 0.8 : 0.4)) part(p.x - dx / L * r * 2, p.y - dy / L * r * 2, { vx: rnd(-8, 8), vy: rnd(-14, -4), life: rnd(0.5, 0.9), col: pickA(SMOKE), sz: 2, drag: 1 });
    glowE(p.x, p.y, r * 3, r * 3, '#ff7a2e', 0.6);
    rock(p.x, p.y, r, true);
  }
  const DRAW = {
    meteor(f, t) { meteorAt(f.sp, f.sp.ev[0], t, true); },
    shower(f, t) { for (const ev of f.sp.ev) meteorAt(f.sp, ev, t, false); },
    firestorm(f, t) {
      // flame columns on a ring rolling out of the Button
      if (t < 0.05 || t > 1.2) return;
      const k = clamp((t - 0.05) / 0.95, 0, 1), r = 0.1 + 0.8 * k, a = rad(r), b = P(0, 0.02), n = Math.round(18 + 22 * k);
      const fade = 1 - Math.max(0, (t - 0.95) / 0.25);
      for (let i = 0; i < n; i++) {
        const th = i / n * Math.PI * 2 + k * 0.6, x = b.x + Math.cos(th) * a.rx, y = b.y + Math.sin(th) * a.ry;
        if (x < -6 || x > Wl + 6 || y < -6 || y > Hl + 6) continue;
        const h = 5 + 4 * Math.abs(Math.sin(t * 23 + i * 1.7)) + (1 - k) * 3;
        rect(x - 2, y - h, 4, h, '#ff4a1a', 0.85 * fade);
        rect(x - 1, y - h * 0.8, 3, h * 0.8, '#ff7a2e', 0.9 * fade);
        rect(x - 1, y - h * 0.45, 2, h * 0.45, '#ffe27a', fade);
        if (Math.random() < 0.18) part(x + rnd(-2, 2), y - h, { vx: rnd(-6, 6), vy: rnd(-40, -20), life: rnd(0.25, 0.5), col: pickA(FIRE), sz: 1, drag: 1 });
      }
      ringE(b.x, b.y, a.rx, a.ry, '#ffe27a', 0.5 * fade, 1);
    },
    blizzard(f, t) {
      const sp = f.sp, c = P(sp.x, sp.y), a = rad(sp.ev[0].r), on = clamp(t / 0.3, 0, 1) * clamp((3.0 - t) / 0.4, 0, 1);
      if (on <= 0) return;
      fillE(c.x, c.y, a.rx, a.ry, '#bfefff', 0.16 * on);
      ringE(c.x, c.y, a.rx, a.ry, '#d8f6ff', 0.5 * on, 1, 2);
      // snow driving in on the wind, and ice spears dropping
      if (t < 2.6) for (let i = 0; i < 4; i++) {
        const x = c.x + rnd(-a.rx, a.rx), y = c.y - rnd(30, 70);
        part(x - 12, y, { vx: rnd(20, 40), vy: rnd(40, 70), life: rnd(0.5, 0.9), col: pickA(ICE), sz: Math.random() < 0.3 ? 2 : 1, floor: c.y + rnd(-a.ry, a.ry) });
      }
      if (t < 2.6 && Math.random() < 0.5) {
        const x = c.x + rnd(-a.rx * 0.8, a.rx * 0.8), y = c.y + rnd(-a.ry * 0.8, a.ry * 0.8);
        quick.push({ k: 'spear', x, y, h: rnd(14, 26), life: 0.3, max: 0.3 });
      }
      // frost creeping over the ground: little crystals
      const n = Math.round(10 * on);
      for (let i = 0; i < n; i++) { const th = (i * 2.4 + sp.id) % (Math.PI * 2), rr = ((i * 0.37 + sp.id * 0.11) % 1) * 0.9; dot(c.x + Math.cos(th) * a.rx * rr, c.y + Math.sin(th) * a.ry * rr, '#ffffff', 1); }
      // the shatter at the end: a crown of ice that bursts
      const ts = sp.ev[sp.ev.length - 1].t;
      if (t > ts - 0.55 && t < ts) {
        const k = (t - (ts - 0.55)) / 0.55;
        for (let i = 0; i < 9; i++) {
          const th = i / 9 * Math.PI * 2 + sp.id, x = c.x + Math.cos(th) * a.rx * 0.6, y = c.y + Math.sin(th) * a.ry * 0.6, h = (8 + (i % 3) * 5) * k;
          tri(x - 3, y, x + 3, y, x + (i % 2 ? 1 : -1), y - h, '#9fe4ff', 0.9);
          tri(x - 1, y, x + 2, y, x, y - h * 0.8, '#ffffff', 0.9);
        }
      }
    },
    tornado(f, t) {
      const sp = f.sp, T = sp.T - 0.4;
      if (t > T + 0.3) return;
      const k = clamp(t / T, 0, 1), x = sp.x0 + (sp.x1 - sp.x0) * k, y = sp.y0 + Math.sin(k * 7 + sp.wob) * 0.05;
      const g = P(x, y), on = clamp(t / 0.25, 0, 1) * clamp((T + 0.3 - t) / 0.4, 0, 1);
      // a funnel of turning bands, narrow at the ground, wide up top
      const H0 = 64, bands = 15;
      fillE(g.x, g.y, 12, 4, '#2a2a20', 0.35 * on);
      for (let i = 0; i < bands; i++) {
        const h = i / (bands - 1), yy = g.y - h * H0, wob = Math.sin(t * 6 + h * 4) * 4 * h, rx = 3 + h * h * 18 + h * 4, ry = 1 + h * 3;
        const cols = ['#c8c8b8', '#e8e8dc', '#a8a898', '#ffffff'];
        const n = Math.round(rx * 1.6) + 4;
        lx.globalAlpha = (0.55 + 0.4 * h) * on;
        for (let j = 0; j < n; j++) {
          const th = j / n * Math.PI * 2 + t * (14 - h * 6) + i * 0.6, front = Math.sin(th) > 0;
          lx.fillStyle = front ? cols[(i + j) % 4] : '#8a8a7c';
          lx.fillRect(Math.round(g.x + wob + Math.cos(th) * rx), Math.round(yy + Math.sin(th) * ry), front ? 2 : 1, 1 + (front ? 1 : 0));
        }
      }
      lx.globalAlpha = 1;
      // what it picks up: dust, leaves, stones orbiting up the funnel
      if (Math.random() < 0.9 * on) {
        const cols = ['#8a6a50', '#a8a898', '#6ab04a', '#c8c8b8'];
        for (let i = 0; i < 2; i++) part(g.x + rnd(-8, 8), g.y - rnd(0, 6), { vx: rnd(-50, 50), vy: rnd(-70, -30), life: rnd(0.4, 0.8), col: pickA(cols), sz: Math.random() < 0.4 ? 2 : 1, swirl: g, drag: 0.5 });
      }
      if (Math.random() < 0.4 * on) debris(g.x, g.y, ['#6a5040', '#8a6a50'], 1, 50);
    },
    holy(f, t) {
      const sp = f.sp, ev = sp.ev[0], c = sp.onBoss ? Object.assign(P(0, 0), {}) : P(ev.x, ev.y), a = rad(ev.r);
      if (t < ev.t) {
        // runes gather on the ground, a thread of light comes down
        const k = t / ev.t;
        ringE(c.x, c.y, a.rx * (1.6 - 0.6 * k), a.ry * (1.6 - 0.6 * k), '#ffe27a', 0.3 + 0.5 * k, 1, 2);
        for (let i = 0; i < 6; i++) { const th = i / 6 * Math.PI * 2 + t * 3; rect(c.x + Math.cos(th) * a.rx - 1, c.y + Math.sin(th) * a.ry - 1, 2, 2, '#fff3a0', k); }
        line(c.x, 0, c.x, c.y, '#fff3a0', 1, 0.25 + 0.5 * k * (Math.sin(t * 40) > 0 ? 1 : 0.6));
        return;
      }
      const k = (t - ev.t) / 0.85;
      if (k > 1) return;
      const w = a.rx * 0.9 * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) * 0.8), fade = 1 - k * k;
      rect(c.x - w - 2, 0, w * 2 + 4, c.y, '#ffd84a', 0.35 * fade);
      rect(c.x - w, 0, w * 2, c.y, '#ffe27a', 0.6 * fade);
      rect(c.x - w * 0.45, 0, w * 0.9, c.y, '#ffffff', 0.85 * fade);
      fillE(c.x, c.y, a.rx * 1.1, a.ry * 1.1, '#fff3a0', 0.45 * fade);
      fillE(c.x, c.y, w, a.ry * 0.6, '#ffffff', 0.8 * fade);
      if (Math.random() < 0.9) for (let i = 0; i < 2; i++) part(c.x + rnd(-w, w), c.y - rnd(0, 40), { vx: rnd(-4, 4), vy: rnd(-50, -20), life: rnd(0.4, 0.8), col: pickA(GOLD), sz: 1 });
    },
    quake(f, t) {
      const sp = f.sp, c = P(sp.x, sp.y), a = rad(sp.ev[0].r);
      // cracks, grown at each pulse; rubble pops at their tips
      const fired = sp.ev.filter(e => t >= e.t).length, fade = clamp((sp.T + 0.6 - t) / 0.8, 0, 1);
      if (!f.cracks) {
        let s = sp.seed || 1; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
        f.cracks = [];
        for (let i = 0; i < 9; i++) {
          const th = i / 9 * Math.PI * 2 + r() * 0.5, pts = [[0, 0]];
          let x = 0, y = 0, an = th;
          for (let j = 0; j < 7; j++) { an += (r() - 0.5) * 0.9; x += Math.cos(an) * 0.17; y += Math.sin(an) * 0.17; pts.push([x, y]); }
          f.cracks.push(pts);
        }
      }
      const reach = fired === 0 ? clamp(t / sp.ev[0].t, 0, 1) * 0.25 : Math.min(1, 0.45 + 0.28 * (fired - 1) + clamp((t - sp.ev[fired - 1].t) * 3, 0, 0.28));
      for (const pts of f.cracks) {
        const n = Math.max(1, Math.round((pts.length - 1) * reach));
        for (let j = 0; j < n; j++) {
          const p0 = pts[j], p1 = pts[j + 1], x0 = c.x + p0[0] * a.rx, y0 = c.y + p0[1] * a.ry, x1 = c.x + p1[0] * a.rx, y1 = c.y + p1[1] * a.ry, w = j < 2 ? 2 : 1;
          line(x0, y0 + 1, x1, y1 + 1, '#c8a070', w, 0.6 * fade);
          line(x0, y0, x1, y1, '#1a100a', w, 0.95 * fade);
          if (fired && j === n - 1 && Math.random() < 0.06) debris(x1, y1, ROCK, 1, 60);
        }
      }
      // the ground heaves: spikes of rock jut up for a moment after each pulse
      for (const e of sp.ev) {
        const k = (t - e.t) / 0.45;
        if (k < 0 || k > 1) continue;
        const h = Math.sin(k * Math.PI);
        for (let i = 0; i < 7; i++) {
          const th = i * 2.1 + e.t * 7, rr = 0.25 + ((i * 0.31) % 0.7), x = c.x + Math.cos(th) * a.rx * rr, y = c.y + Math.sin(th) * a.ry * rr, hh = (7 + (i % 3) * 4) * h;
          tri(x - 3, y + 1, x + 3, y + 1, x, y - hh, '#6a5848', 1);
          tri(x - 1, y + 1, x + 3, y + 1, x + 0.5, y - hh, '#9a8670', 1);
        }
      }
    },
    poison(f, t) {
      const sp = f.sp, c = P(sp.x, sp.y), a = rad(sp.ev[0].r), on = clamp(t / 0.4, 0, 1) * clamp((sp.T - t) / 0.6, 0, 1);
      if (on <= 0) return;
      // a lumpy cloud of green puffs, rolling in place
      for (let i = 0; i < 11; i++) {
        const th = i * 2.399 + t * 0.6 * (i % 2 ? 1 : -1), rr = 0.25 + (i % 4) * 0.18, x = c.x + Math.cos(th) * a.rx * rr, y = c.y - 5 + Math.sin(th) * a.ry * rr * 0.8;
        const r = (6 + (i % 3) * 3) * (0.8 + 0.2 * Math.sin(t * 3 + i)) * on;
        fillE(x, y, r * 1.3, r, i % 3 ? '#3a8a2a' : '#5ab83a', 0.42 * on);
      }
      fillE(c.x, c.y - 4, a.rx * 0.55, a.ry * 0.55, '#8ae04a', 0.25 * on);
      // bubbles rise and pop
      if (Math.random() < 0.6 * on) part(c.x + rnd(-a.rx, a.rx) * 0.8, c.y + rnd(-a.ry, a.ry) * 0.6, { vx: rnd(-3, 3), vy: rnd(-22, -10), life: rnd(0.5, 0.9), col: pickA(['#c8ff7a', '#8ae04a', '#e8ffb0']), sz: 2, pop: 1 });
      if (Math.random() < 0.25 * on) part(c.x + rnd(-a.rx, a.rx) * 0.7, c.y - rnd(4, 12), { vx: 0, vy: 30, life: 0.4, col: '#5ab83a', sz: 1, floor: c.y + rnd(-2, 4) });
    },
    orbs(f, t) {
      const sp = f.sp, b = btn(), home = { x: b.x, y: b.y - 34 };
      for (const ev of sp.ev) {
        if (t >= ev.t) continue;
        const t0 = 0.3 + ev.i * 0.05, th = ev.i / sp.ev.length * Math.PI * 2 + t * 5;
        const ring = { x: home.x + Math.cos(th) * 14, y: home.y + Math.sin(th) * 7 };
        let p = ring;
        if (t > t0) {
          // off it goes, homing on its mob where it is now
          const to = sp.onBoss || !ev.m ? (sp.onBoss ? bossBody() : P(ev.x, ev.y)) : (ev.m.dead ? P(ev.x, ev.y) : (q => ({ x: q.x, y: q.y - 6 }))(mobL(ev.m)));
          const k = clamp((t - t0) / (ev.t - t0), 0, 1), e = k * k * (3 - 2 * k), lift = Math.sin(k * Math.PI) * 26;
          p = { x: ring.x + (to.x - ring.x) * e, y: ring.y + (to.y - ring.y) * e - lift };
        } else {
          const k = clamp(t / 0.3, 0, 1); p = { x: b.x + (ring.x - b.x) * k, y: b.y - 6 + (ring.y - b.y + 6) * k };
        }
        part(p.x + rnd(-1, 1), p.y + rnd(-1, 1), { vx: rnd(-6, 6), vy: rnd(-6, 6), life: rnd(0.2, 0.4), col: pickA(PURP), sz: 1 });
        glowE(p.x, p.y, 7, 7, '#c88aff', 0.7);
        fillE(p.x, p.y, 2.5, 2.5, '#9a5aff', 1);
        rect(p.x - 1, p.y - 1, 2, 2, '#ffffff');
      }
    },
    swords(f, t) {
      const sp = f.sp;
      for (const ev of sp.ev) {
        const c = P(ev.x, ev.y), t0 = ev.t - 0.22;
        if (t < t0) { if (t > t0 - 0.25) ringE(c.x, c.y, 3, 1.5, '#e4eaf6', 0.5, 1); continue; }
        const k = clamp((t - t0) / 0.22, 0, 1), y = (c.y - 90) + 90 * k * k;
        const stuck = t >= ev.t, fade = stuck ? clamp(1 - (t - ev.t - 0.45) / 0.3, 0, 1) : 1;
        if (fade <= 0) continue;
        sword(c.x, stuck ? c.y : y, fade, stuck);
        if (!stuck) line(c.x, y - 22, c.x, y - 12, '#ffffff', 1, 0.35);
      }
    },
    chain() { /* the bolts are drawn when they land (spellHit) */ },
    lava(f, t) {
      const sp = f.sp, ev = sp.ev[0], c = P(ev.x, ev.y), a = rad(ev.r);
      if (t < ev.t) {
        // the ground glows and cracks before it bursts
        const k = t / ev.t;
        fillE(c.x, c.y, a.rx * 0.7 * k, a.ry * 0.7 * k, '#ff4a1a', 0.35 + 0.3 * k);
        for (let i = 0; i < 5; i++) { const th = i * 1.26 + sp.id; line(c.x, c.y, c.x + Math.cos(th) * a.rx * k, c.y + Math.sin(th) * a.ry * k, '#ffb04a', 1, 0.8); }
        if (Math.random() < 0.5) part(c.x + rnd(-5, 5), c.y, { vx: rnd(-10, 10), vy: rnd(-40, -20), life: 0.4, col: pickA(FIRE), sz: 1, grav: 120 });
        return;
      }
      const k = clamp((t - ev.t) / (sp.T - ev.t), 0, 1), fade = 1 - Math.max(0, (k - 0.7) / 0.3);
      // the pool: molten, crusting over
      fillE(c.x, c.y, a.rx * 0.95, a.ry * 0.95, '#3a1408', 0.85 * fade);
      fillE(c.x, c.y, a.rx * 0.8, a.ry * 0.8, '#ff4a1a', 0.95 * fade);
      fillE(c.x, c.y, a.rx * 0.5, a.ry * 0.5, '#ffb04a', 0.9 * fade);
      for (let i = 0; i < 6; i++) { const th = i * 1.1 + sp.id, rr = 0.3 + (i % 3) * 0.18; fillE(c.x + Math.cos(th) * a.rx * rr, c.y + Math.sin(th) * a.ry * rr, 3 * k + 1, 1.5 * k + 0.5, '#5a1e0a', 0.9 * fade); }
      if (Math.random() < 0.5 * fade) { const x = c.x + rnd(-a.rx, a.rx) * 0.6, y = c.y + rnd(-a.ry, a.ry) * 0.6; quick.push({ k: 'bubble', x, y, life: 0.35, max: 0.35 }); }
      // the fountain keeps spitting for a while
      if (k < 0.4) for (let i = 0; i < 3; i++) part(c.x + rnd(-3, 3), c.y - 2, { vx: rnd(-40, 40), vy: rnd(-130, -70), life: rnd(0.6, 1), col: pickA(FIRE), sz: Math.random() < 0.5 ? 2 : 1, grav: 260, floor: c.y + rnd(-a.ry, a.ry) });
    },
    shadow(f, t) {
      const sp = f.sp;
      for (const ev of sp.ev) {
        const c = P(ev.x, ev.y), a = rad(ev.r), k = (t - ev.t + 0.18) / 0.18;
        if (k < 0) {
          // a dark eye opens over the spot before the claws come down
          if (k > -2.2) { const o = clamp((k + 2.2) / 2.2, 0, 1); fillE(c.x, c.y - 18, 5 * o, 1.5 * o, '#b36bff', 0.8); rect(c.x - 1, c.y - 19, 2, 2, '#ff4fd8', o); }
          continue;
        }
        const grow = clamp(k, 0, 1), fade = clamp(1 - (t - ev.t - 0.35) / 0.4, 0, 1);
        if (fade <= 0) continue;
        fillE(c.x, c.y, a.rx, a.ry, '#1a0a2a', 0.35 * fade);
        // three claw marks, slashing down at a slant
        for (let j = -1; j <= 1; j++) {
          const L = a.rx * 1.5, ang = 0.9 + ev.ang, dx = Math.cos(ang), dy = Math.sin(ang);
          const x0 = c.x - dx * L / 2 + j * 6, y0 = c.y - 16 - dy * L / 2 + j * 1.5;
          const n = 12, m = Math.round(n * grow);
          for (let i = 0; i < m; i++) {
            const q = i / n, bow = Math.sin(q * Math.PI) * 4, w = Math.max(1, Math.round(Math.sin(q * Math.PI) * 3));
            const x = x0 + dx * L * q - dy * bow, y = y0 + dy * L * q + dx * bow;
            rect(x - w / 2 - 1, y - 1, w + 2, w + 1, '#ff4fd8', 0.7 * fade);
            rect(x - w / 2, y - 0.5, w, w, '#120618', fade);
          }
        }
      }
    },
  };
  function sword(x, y, a, stuck) {
    // a little falling sword, point down; y is where the point is
    lx.globalAlpha = a;
    rect(x - 1, y - 12, 3, 12, '#1a1824'); rect(x, y - 12, 1, 11, '#e4eaf6'); rect(x - 0, y - 12, 1, 4, '#ffffff');
    rect(x - 3, y - 14, 7, 2, '#1a1824'); rect(x - 2, y - 14, 5, 1, '#ffd84a');
    rect(x, y - 18, 1, 4, '#8a5a30'); rect(x - 1, y - 19, 3, 1, '#ffd84a');
    lx.globalAlpha = 1;
    if (stuck) fillE(x, y + 1, 3, 1, '#2a2418', 0.5 * a);
  }

  // ================= The strikes =================
  const HIT = {
    impact(sp, ev, mobs) {
      const c = sp.onBoss && Math.hypot(ev.x, ev.y) < 0.05 ? P(0, 0) : P(ev.x, ev.y), a = rad(ev.r);
      if (sp.kind === 'meteor' || sp.kind === 'shower') {
        const big = sp.kind === 'meteor';
        flashFx(c.x, c.y - 4, a.rx * 1.3, a.ry * 1.6, '#ffe27a', big ? 0.35 : 0.2);
        ringFx(c.x, c.y, a.rx * 0.3, a.rx * (big ? 1.5 : 1.2), a.ry * 0.3, a.ry * (big ? 1.5 : 1.2), '#ffffff', big ? 0.45 : 0.3, big ? 2 : 1);
        if (big) ringFx(c.x, c.y, a.rx * 0.2, a.rx * 1.1, a.ry * 0.2, a.ry * 1.1, '#ff7a2e', 0.6, 2);
        debris(c.x, c.y, ROCK.concat(['#ff7a2e', '#ffb04a']), big ? 34 : 10, big ? 150 : 90);
        burst(c.x, c.y - 4, FIRE, big ? 30 : 8, big ? 110 : 60, { grav: -30, drag: 2 });
        for (let i = 0; i < (big ? 14 : 4); i++) part(c.x + rnd(-a.rx, a.rx) * 0.6, c.y - rnd(0, 6), { vx: rnd(-20, 20), vy: rnd(-24, -8), life: rnd(0.8, 1.5), col: pickA(SMOKE), sz: 2, drag: 1.5 });
        decal({ k: 'crater', x: c.x, y: c.y, rx: a.rx * (big ? 0.75 : 0.6), ry: a.ry * (big ? 0.75 : 0.6), life: big ? 3.5 : 2.2 });
        shake(big ? 8 : 2.5); if (big) flash(0.35, '#ff7a2e');
        SFX.impact(sp);
      } else if (sp.kind === 'holy') {
        ringFx(c.x, c.y, a.rx * 0.4, a.rx * 1.5, a.ry * 0.4, a.ry * 1.5, '#fff3a0', 0.5, 2);
        burst(c.x, c.y - 6, GOLD, 26, 100, { grav: -40, drag: 1.5 });
        decal({ k: 'glyph', x: c.x, y: c.y, rx: a.rx * 0.9, ry: a.ry * 0.9, life: 1.8, col: '#ffe27a' });
        flash(0.3, '#fff3a0'); shake(3);
        const b = btn(); for (let i = 0; i < 8; i++) part(b.x + rnd(-10, 10), b.y - rnd(0, 10), { vx: rnd(-4, 4), vy: rnd(-30, -14), life: rnd(0.6, 1), col: '#8ae07a', sz: 2, plus: 1 });
      } else if (sp.kind === 'lava') {
        flashFx(c.x, c.y - 4, a.rx * 1.2, a.ry * 1.5, '#ff7a2e', 0.3);
        ringFx(c.x, c.y, a.rx * 0.3, a.rx * 1.3, a.ry * 0.3, a.ry * 1.3, '#ffb04a', 0.45, 2);
        for (let i = 0; i < 40; i++) part(c.x + rnd(-4, 4), c.y - 2, { vx: rnd(-60, 60), vy: rnd(-190, -80), life: rnd(0.7, 1.2), col: pickA(FIRE), sz: Math.random() < 0.5 ? 2 : 1, grav: 280, floor: c.y + rnd(-a.ry, a.ry) });
        debris(c.x, c.y, ['#3a1408', '#5a1e0a', '#2a1a14'], 12, 130);
        shake(6); flash(0.25, '#ff4a1a');
        SFX.impact(sp);
      }
      for (const m of mobs.slice(0, 30)) { const q = mobL(m); burst(q.x, q.y - 6, sp.kind === 'holy' ? GOLD : FIRE, 3, 50); }
    },
    ring(sp, ev, mobs) {
      if (sp.kind === 'firestorm') {
        for (const m of mobs.slice(0, 40)) { const q = mobL(m); burst(q.x, q.y - 5, FIRE, 4, 50, { grav: -60 }); decal({ k: 'scorch', x: q.x, y: q.y, rx: 4, ry: 1.5, life: 1.6 }); }
        if (ev.boss) { flash(0.25, '#ff7a2e'); shake(3); }
      } else if (sp.kind === 'holy') {
        const c = P(ev.x, ev.y), a = rad(ev.r); ringFx(c.x, c.y, a.rx * 0.6, a.rx, a.ry * 0.6, a.ry, '#ffe27a', 0.35, 1);
      }
    },
    tick(sp, ev, mobs) {
      const n = Math.min(24, mobs.length);
      if (sp.kind === 'blizzard') {
        for (let i = 0; i < n; i++) { const q = mobL(mobs[i]); burst(q.x, q.y - 6, ICE, 2, 40); }
      } else if (sp.kind === 'poison') {
        for (let i = 0; i < n; i++) { const q = mobL(mobs[i]); part(q.x + rnd(-2, 2), q.y - 10, { vx: rnd(-5, 5), vy: rnd(-16, -6), life: 0.5, col: pickA(GREEN), sz: 2 }); }
      } else if (sp.kind === 'tornado') {
        for (let i = 0; i < n; i++) { const q = mobL(mobs[i]); burst(q.x, q.y - 6, ['#e8e8dc', '#ffffff', '#a8a898'], 3, 60); }
      } else if (sp.kind === 'lava') {
        for (let i = 0; i < n; i++) { const q = mobL(mobs[i]); burst(q.x, q.y - 4, FIRE, 2, 30, { grav: -40 }); }
      }
    },
    shatter(sp, ev, mobs) {
      const c = P(ev.x, ev.y), a = rad(ev.r);
      burst(c.x, c.y - 8, ICE, 50, 140, { grav: 200, streak: 1 });
      ringFx(c.x, c.y, a.rx * 0.4, a.rx * 1.3, a.ry * 0.4, a.ry * 1.3, '#d8f6ff', 0.4, 2);
      flashFx(c.x, c.y - 6, a.rx, a.ry * 1.4, '#ffffff', 0.25);
      for (const m of mobs.slice(0, 30)) { const q = mobL(m); burst(q.x, q.y - 8, ICE, 5, 70, { grav: 200 }); }
      decal({ k: 'frost', x: c.x, y: c.y, rx: a.rx, ry: a.ry, life: 2 });
      flash(0.2, '#bff4ff'); shake(4);
      SFX.shatter();
    },
    pulse(sp, ev) {
      const c = P(ev.x, ev.y), a = rad(ev.r);
      ringFx(c.x, c.y, a.rx * 0.2, a.rx * 1.2, a.ry * 0.2, a.ry * 1.2, '#c8a070', 0.5, 2);
      debris(c.x, c.y, ROCK, 18, 110);
      for (let i = 0; i < 8; i++) part(c.x + rnd(-a.rx, a.rx), c.y + rnd(-a.ry, a.ry), { vx: rnd(-12, 12), vy: rnd(-16, -4), life: rnd(0.6, 1.1), col: pickA(['#8a7a68', '#a89880', '#6a5a4a']), sz: 2, drag: 1.5 });
      shake(6); SFX.pulse();
    },
    orb(sp, ev, mobs) {
      const c = sp.onBoss && !mobs.length ? bossBody() : (ev.m && !mobs.length ? P(ev.x, ev.y) : (q => ({ x: q.x, y: q.y - 6 }))(mobs.length ? mobL(mobs[0]) : P(ev.x, ev.y)));
      burst(c.x, c.y, PURP, 16, 90, { grav: 0, drag: 2 });
      ringFx(c.x, c.y + 4, 2, 14, 1, 6, '#c88aff', 0.35, 1);
      flashFx(c.x, c.y, 9, 9, '#e4c8ff', 0.18);
      quick.push({ k: 'glyph', x: c.x, y: c.y + 5, life: 0.5, max: 0.5 });
      SFX.orb();
    },
    sword(sp, ev) {
      const c = P(ev.x, ev.y);
      burst(c.x, c.y - 1, ['#ffffff', '#e4eaf6', '#ffd84a'], 5, 60, { grav: 160 });
      debris(c.x, c.y, ['#6a5a4a', '#8a7a68'], 3, 50);
      decal({ k: 'scorch', x: c.x, y: c.y + 1, rx: 3, ry: 1, life: 1.2 });
      if (Math.random() < 0.6) SFX.sword();
      shake(0.8);
    },
    bolt(sp, ev, mobs) {
      const pts = (ev.path || []).map(([x, y], i) => {
        if (ev.onBoss) return bossBody();
        const m = mobs[i]; const q = m ? mobL(m) : P(x, y); return { x: q.x, y: q.y - 6 };
      });
      if (!pts.length) return;
      quick.push({ k: 'bolt', pts, life: 0.28, max: 0.28, x0: pts[0].x + rnd(-20, 20) });
      for (const p of pts) { burst(p.x, p.y, ['#ffffff', '#7fe9ff', '#bff4ff'], 6, 70, { grav: 0, drag: 3 }); decal({ k: 'scorch', x: p.x, y: p.y + 6, rx: 3, ry: 1, life: 1 }); }
      flash(0.14, '#bff4ff'); shake(2);
      SFX.bolt();
    },
    slash(sp, ev, mobs) {
      const c = P(ev.x, ev.y);
      burst(c.x, c.y - 14, ['#1a0a2a', '#b36bff', '#ff4fd8', '#3a1a5a'], 18, 90, { grav: 40, drag: 2 });
      for (const m of mobs.slice(0, 24)) { const q = mobL(m); burst(q.x, q.y - 8, ['#ff4fd8', '#b36bff'], 3, 40); }
      shake(3); flash(0.12, '#3a1a5a');
      SFX.slash();
    },
  };

  // ================= The click strike, dressed by the land =================
  let lastFlour = 0;
  const FLOUR = {
    water(x, y) {
      for (let i = 0; i < 12; i++) part(x + rnd(-2, 2), y, { vx: rnd(-14, 14), vy: rnd(-110, -60), life: rnd(0.35, 0.6), col: pickA(['#ffffff', '#9fe4ff', '#5ac8ff', '#3a8aff']), sz: Math.random() < 0.5 ? 2 : 1, grav: 300, floor: y + rnd(0, 3) });
      ringFx(x, y, 2, 10, 1, 4, '#9fe4ff', 0.3, 1);
    },
    bloom(x, y) {
      for (let i = 0; i < 8; i++) part(x + rnd(-4, 4), y - rnd(4, 12), { vx: rnd(-30, 30), vy: rnd(-40, -10), life: rnd(0.6, 1), col: pickA(['#ff9ad8', '#ffffff', '#ffe27a', '#ffb0e0']), sz: 2, grav: 40, drag: 2, flutter: 1 });
      quick.push({ k: 'vine', x, y, dir: Math.random() < 0.5 ? -1 : 1, life: 0.45, max: 0.45 });
    },
    roots(x, y) { quick.push({ k: 'roots', x, y, seed: Math.random() * 100, life: 0.4, max: 0.4 }); debris(x, y, ['#5a3a2a', '#8a6040'], 5, 50); },
    stone(x, y) { quick.push({ k: 'spikes', x, y, seed: Math.random() * 100, life: 0.35, max: 0.35, col: '#8a8a94', hi: '#c8c8d4' }); debris(x, y, ['#6a6a74', '#9a9aa4'], 5, 60); },
    frost(x, y) {
      for (let i = 0; i < 7; i++) { const a = rnd(0, Math.PI * 2); part(x, y - 6, { vx: Math.cos(a) * rnd(40, 80), vy: Math.sin(a) * rnd(30, 60) - 20, life: rnd(0.25, 0.45), col: pickA(ICE), sz: 1, grav: 150, streak: 1 }); }
      quick.push({ k: 'crystal', x, y: y - 6, life: 0.25, max: 0.25 });
    },
    holy(x, y) { quick.push({ k: 'ray', x, y, w: 3, col: '#ffe27a', core: '#ffffff', life: 0.25, max: 0.25 }); burst(x, y - 4, GOLD, 6, 40, { grav: -30 }); },
    hellfire(x, y) {
      for (let i = 0; i < 10; i++) part(x + rnd(-4, 4), y - rnd(0, 4), { vx: rnd(-14, 14), vy: rnd(-70, -30), life: rnd(0.25, 0.5), col: pickA(['#ff3b3b', '#ff7a2e', '#2a0a0a', '#ffb04a']), sz: Math.random() < 0.5 ? 2 : 1, drag: 2 });
      decal({ k: 'scorch', x, y, rx: 4, ry: 1.5, life: 0.8 });
    },
    void(x, y) { quick.push({ k: 'rift', x, y: y - 6, life: 0.4, max: 0.4 }); for (let i = 0; i < 6; i++) { const a = rnd(0, Math.PI * 2), r = rnd(8, 14); part(x + Math.cos(a) * r, y - 6 + Math.sin(a) * r * 0.6, { vx: -Math.cos(a) * r * 3, vy: -Math.sin(a) * r * 1.8, life: 0.3, col: pickA(['#b36bff', '#1a0a2a', '#ff4fd8']), sz: 1 }); } },
    arcane(x, y) { quick.push({ k: 'glyph', x, y, life: 0.45, max: 0.45 }); burst(x, y - 4, PURP, 5, 40, { grav: -20 }); },
    spark(x, y) { burst(x, y - 4, ['#ffe27a', '#ffffff', '#ffb04a'], 9, 110, { grav: 260, streak: 1, life: 0.35 }); quick.push({ k: 'gear', x, y: y - 6, vx: rnd(-30, 30), vy: -60, life: 0.5, max: 0.5 }); },
    lava(x, y) { for (let i = 0; i < 8; i++) part(x, y - 2, { vx: rnd(-35, 35), vy: rnd(-80, -40), life: rnd(0.4, 0.6), col: pickA(FIRE), sz: 2, grav: 300, floor: y + rnd(0, 3) }); decal({ k: 'pool', x, y, rx: 4, ry: 1.5, life: 0.9 }); },
    prism(x, y) { const C = ['#ff4f6a', '#ffb04a', '#ffe27a', '#8ae07a', '#5ae8ff', '#9a7aff', '#ff9ad8']; for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; part(x, y - 6, { vx: Math.cos(a) * 70, vy: Math.sin(a) * 45, life: 0.35, col: C[i % C.length], sz: 1, streak: 1, drag: 3 }); } },
    wind(x, y) { quick.push({ k: 'gust', x, y: y - 6, dir: Math.random() < 0.5 ? -1 : 1, life: 0.35, max: 0.35 }); part(x + rnd(-4, 4), y - 12, { vx: rnd(-20, 20), vy: -10, life: 0.9, col: '#ffffff', sz: 2, grav: 30, drag: 1, flutter: 1, feather: 1 }); },
    moon(x, y) { quick.push({ k: 'ray', x, y, w: 2, col: '#c8d6ff', core: '#ffffff', life: 0.3, max: 0.3 }); quick.push({ k: 'crescent', x, y: y - 14, life: 0.45, max: 0.45 }); },
    star(x, y) { quick.push({ k: 'star', x: x + rnd(-30, 30), y: -10, tx: x, ty: y - 6, life: 0.3, max: 0.3 }); burst(x, y - 6, ['#ffffff', '#ffe27a', '#9fe4ff'], 6, 50, { grav: 0, drag: 2, twinkle: 1 }); },
  };
  G.on('heroAttack', ev => {
    if (!ev || ev.src !== 'click' || ev.boss || document.hidden || R.town || !cv) return;
    const now = performance.now();
    if (now - lastFlour < (ev.extra ? 120 : 55) || parts.length > MAXP * 0.8) return;
    lastFlour = now;
    const id = ev.ids && ev.ids[0], m = id != null && R.mobs.find(q => q.id === id);
    if (!m) return;
    const q = mobL(m), f = FLOUR[realmEl()];
    if (f) f(q.x, q.y);
  });

  // ================= Listening =================
  G.on('spellCast', sp => {
    if (!ensure()) return;
    fxs.push({ sp, t: 0, live: true });
    word(sp);
    const s = SFX[sp.kind]; if (s && !document.hidden) s(sp);
    if (sp.kind === 'firestorm') { flash(0.2, '#ff7a2e'); shake(2); }
    if (sp.kind === 'quake') shake(3);
    if (sp.kind === 'shadow') flash(0.25, '#1a0a2a');
  });
  G.on('spellHit', (sp, ev, mobs) => {
    if (document.hidden || !cv) return;
    const h = HIT[ev.tag]; if (h) h(sp, ev, mobs || []);
  });
  G.on('spellEnd', sp => { const f = fxs.find(x => x.sp === sp); if (f) f.live = false; });
  G.on('ascend', () => { fxs.length = 0; parts.length = 0; decals.length = 0; quick.length = 0; words.length = 0; });

  // ================= The frame =================
  function drawDecals(dt) {
    for (let i = decals.length - 1; i >= 0; i--) {
      const d = decals[i]; d.life -= dt;
      if (d.life <= 0) { decals.splice(i, 1); continue; }
      const a = Math.min(1, d.life / d.max * 2);
      if (d.k === 'crater') {
        fillE(d.x, d.y, d.rx, d.ry, '#1a120c', 0.7 * a);
        fillE(d.x, d.y - d.ry * 0.15, d.rx * 0.7, d.ry * 0.6, '#0a0806', 0.6 * a);
        ringE(d.x, d.y, d.rx, d.ry, '#6a5040', 0.7 * a, 1);
        if (d.life > d.max - 1.2) { fillE(d.x, d.y, d.rx * 0.45, d.ry * 0.4, '#ff4a1a', 0.6 * a * (d.life - d.max + 1.2) / 1.2); if (Math.random() < 0.15) part(d.x + rnd(-d.rx, d.rx) * 0.5, d.y, { vx: rnd(-4, 4), vy: rnd(-14, -6), life: 0.9, col: pickA(SMOKE), sz: 2, drag: 1 }); }
      } else if (d.k === 'scorch') fillE(d.x, d.y, d.rx, d.ry, '#1a120c', 0.45 * a);
      else if (d.k === 'pool') { fillE(d.x, d.y, d.rx, d.ry, '#ff4a1a', 0.8 * a); fillE(d.x, d.y, d.rx * 0.5, d.ry * 0.5, '#ffe27a', 0.8 * a); }
      else if (d.k === 'frost') { fillE(d.x, d.y, d.rx, d.ry, '#d8f6ff', 0.22 * a); ringE(d.x, d.y, d.rx * 0.8, d.ry * 0.8, '#ffffff', 0.4 * a, 1, 1); }
      else if (d.k === 'glyph') { ringE(d.x, d.y, d.rx, d.ry, d.col, 0.6 * a, 1); ringE(d.x, d.y, d.rx * 0.7, d.ry * 0.7, d.col, 0.45 * a, 1, 2); for (let k = 0; k < 6; k++) { const th = k / 6 * Math.PI * 2; line(d.x + Math.cos(th) * d.rx * 0.7, d.y + Math.sin(th) * d.ry * 0.7, d.x + Math.cos(th + 2.09) * d.rx * 0.7, d.y + Math.sin(th + 2.09) * d.ry * 0.7, d.col, 1, 0.35 * a); } }
    }
  }
  function drawQuick(dt) {
    for (let i = quick.length - 1; i >= 0; i--) {
      const q = quick[i]; q.life -= dt;
      if (q.life <= 0) { quick.splice(i, 1); continue; }
      const k = 1 - q.life / q.max, a = q.life / q.max;
      switch (q.k) {
        case 'ring': ringE(q.x, q.y, q.rx0 + (q.rx1 - q.rx0) * k, q.ry0 + (q.ry1 - q.ry0) * k, q.col, a, q.w); break;
        case 'glow': glowE(q.x, q.y, q.rx * (0.6 + 0.4 * k), q.ry * (0.6 + 0.4 * k), q.col, a); break;
        case 'spear': { const y = q.y - q.h * (1 - Math.min(1, k * 3)); line(q.x, y - 7, q.x, y, '#9fe4ff', 2, a); line(q.x, y - 6, q.x, y, '#ffffff', 1, a); if (k > 0.33 && !q.hit) { q.hit = 1; burst(q.x, q.y, ICE, 3, 40, { grav: 160 }); } break; }
        case 'bubble': ringE(q.x, q.y - k * 3, 1 + k * 3, 1 + k * 2, '#ffe27a', a, 1); break;
        case 'bolt': {
          const pts = q.pts;
          bolt(q.x0, -4, pts[0].x, pts[0].y, ['#7fe9ff', '#ffffff'], 7, 1);
          for (let j = 1; j < pts.length; j++) bolt(pts[j - 1].x, pts[j - 1].y, pts[j].x, pts[j].y, ['#7fe9ff', '#ffffff'], 4, 1);
          for (const p of pts) glowE(p.x, p.y, 7, 7, '#bff4ff', a);
          break;
        }
        case 'vine': {
          const n = Math.round(10 * Math.min(1, k * 2.5));
          for (let j = 0; j < n; j++) { const s = j / 10, x = q.x + q.dir * (Math.sin(s * 5) * 4 + s * 4), y = q.y - s * 14; rect(x, y, 1, 1, '#5ab83a', a); if (j % 3 === 2) rect(x + q.dir, y, 2, 1, '#8ae04a', a); }
          break;
        }
        case 'roots': {
          for (let j = 0; j < 4; j++) {
            const th = j * 1.7 + q.seed, L = (6 + (j % 2) * 4) * Math.min(1, k * 3), dx = Math.cos(th) * L, dy = -Math.abs(Math.sin(th)) * L * 0.9 - 2;
            line(q.x, q.y, q.x + dx * 0.5 + (j % 2 ? 2 : -2), q.y + dy * 0.5, '#5a3a2a', 2, a);
            line(q.x + dx * 0.5 + (j % 2 ? 2 : -2), q.y + dy * 0.5, q.x + dx, q.y + dy, '#8a6040', 1, a);
          }
          break;
        }
        case 'spikes': {
          const h = Math.sin(Math.min(1, k * 1.4) * Math.PI);
          for (let j = -1; j <= 1; j++) { const x = q.x + j * 5, hh = (j ? 6 : 10) * h; tri(x - 2.5, q.y + 1, x + 2.5, q.y + 1, x, q.y - hh, q.col, 1); tri(x, q.y + 1, x + 2.5, q.y + 1, x, q.y - hh, q.hi, 1); }
          break;
        }
        case 'crystal': { const s = 4 * (1 + k); line(q.x, q.y - s, q.x, q.y + s, '#ffffff', 1, a); line(q.x - s, q.y, q.x + s, q.y, '#9fe4ff', 1, a); line(q.x - s * 0.7, q.y - s * 0.7, q.x + s * 0.7, q.y + s * 0.7, '#d8f6ff', 1, a); line(q.x - s * 0.7, q.y + s * 0.7, q.x + s * 0.7, q.y - s * 0.7, '#d8f6ff', 1, a); break; }
        case 'ray': { rect(q.x - q.w, 0, q.w * 2, q.y, q.col, 0.5 * a); rect(q.x - q.w / 2, 0, Math.max(1, q.w), q.y, q.core, 0.8 * a); fillE(q.x, q.y, q.w * 3, q.w, q.col, 0.6 * a); break; }
        case 'rift': { const o = Math.sin(Math.min(1, k * 1.2) * Math.PI), w = 10 * o, h = 2 + 3 * o; fillE(q.x, q.y, w + 1, h + 1, '#ff4fd8', 0.7); fillE(q.x, q.y, w, h, '#0a0414', 1); rect(q.x - 1, q.y - 1, 2, 2, '#b36bff', o); break; }
        case 'glyph': {
          const r = 7 + 2 * k, rot = k * 3;
          ringE(q.x, q.y, r, r * 0.5, '#c88aff', a, 1);
          for (let j = 0; j < 4; j++) { const th = rot + j * Math.PI / 2; rect(q.x + Math.cos(th) * r - 1, q.y + Math.sin(th) * r * 0.5 - 1, 2, 2, '#ffffff', a); }
          line(q.x + Math.cos(rot) * r * 0.6, q.y + Math.sin(rot) * r * 0.3, q.x - Math.cos(rot) * r * 0.6, q.y - Math.sin(rot) * r * 0.3, '#e4c8ff', 1, a);
          break;
        }
        case 'gear': {
          q.vy += 220 * dt; q.x += q.vx * dt; q.y += q.vy * dt;
          const rot = k * 10; fillE(q.x, q.y, 2.5, 2.5, '#c8a050', a); rect(q.x - 0.5, q.y - 0.5, 1, 1, '#2a2418', a);
          for (let j = 0; j < 6; j++) { const th = rot + j * Math.PI / 3; rect(q.x + Math.cos(th) * 3.5 - 0.5, q.y + Math.sin(th) * 3.5 - 0.5, 1, 1, '#e8c870', a); }
          break;
        }
        case 'gust': { for (let j = 0; j < 3; j++) { const y = q.y + (j - 1) * 4, L = 14 * Math.min(1, k * 2), x0 = q.x - q.dir * 10 + q.dir * k * 10; line(x0, y, x0 + q.dir * L, y - (j - 1), '#ffffff', 1, 0.7 * a); rect(x0 + q.dir * L, y - (j - 1) - 2, 1, 2, '#ffffff', 0.7 * a); } break; }
        case 'crescent': { fillE(q.x, q.y - k * 4, 4, 4, '#e8eeff', a); fillE(q.x + 2, q.y - 1 - k * 4, 3.5, 3.5, '#0a0910', 0); lx.globalCompositeOperation = 'destination-out'; fillE(q.x + 2, q.y - 1 - k * 4, 3.3, 3.3, '#000', 1); lx.globalCompositeOperation = 'source-over'; break; }
        case 'star': {
          const x = q.x + (q.tx - q.x) * Math.min(1, k * 1.5), y = q.y + (q.ty - q.y) * Math.min(1, k * 1.5);
          line(x - (q.tx - q.x) * 0.15, y - (q.ty - q.y) * 0.15, x, y, '#9fe4ff', 1, 0.5 * a);
          rect(x - 2, y, 5, 1, '#ffe27a', a); rect(x, y - 2, 1, 5, '#ffe27a', a); rect(x, y, 1, 1, '#ffffff', a);
          break;
        }
      }
    }
  }
  function drawParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life -= dt;
      if (p.life <= 0) { if (p.pop) ringFx(p.x, p.y, 1, 3, 1, 3, p.col, 0.15, 1); parts.splice(i, 1); continue; }
      if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
      if (p.swirl) { const dx = p.x - p.swirl.x; p.vx -= dx * 6 * dt; }
      if (p.flutter) p.vx += Math.sin(p.life * 12) * 60 * dt;
      p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.floor != null && p.y > p.floor && p.vy > 0) { p.y = p.floor; p.vy *= -0.25; p.vx *= 0.5; if (Math.abs(p.vy) < 8) { p.vy = 0; p.grav = 0; } }
      const a = Math.min(1, p.life / p.max * 1.8);
      if (p.twinkle && Math.sin(p.life * 40) < 0) continue;
      lx.globalAlpha = a; lx.fillStyle = p.col;
      if (p.streak) { const L = Math.min(5, Math.hypot(p.vx, p.vy) * 0.04); line(p.x, p.y, p.x - p.vx / (Math.hypot(p.vx, p.vy) || 1) * L, p.y - p.vy / (Math.hypot(p.vx, p.vy) || 1) * L, p.col, 1, a); }
      else if (p.plus) { lx.fillRect(Math.round(p.x) - 1, Math.round(p.y), 3, 1); lx.fillRect(Math.round(p.x), Math.round(p.y) - 1, 1, 3); }
      else if (p.feather) { lx.fillRect(Math.round(p.x) - 2, Math.round(p.y), 4, 1); lx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 3, 1); lx.fillStyle = '#c8d6ff'; lx.fillRect(Math.round(p.x) + 2, Math.round(p.y) + 1, 1, 1); }
      else lx.fillRect(Math.round(p.x), Math.round(p.y), p.sz, p.sz);
    }
    lx.globalAlpha = 1;
  }
  // chilled mobs wear a little frost
  function drawChill(t) {
    let n = 0;
    for (const m of R.mobs) {
      if (!(m.chill > 0) || m.dead) continue;
      if (++n > 120) break;
      const q = mobL(m), a = Math.min(1, m.chill * 2) * (m.chillK > 0.8 ? 0.9 : 0.7), col = m.chillK > 0.8 ? '#c8a070' : m.chillK < 0.3 ? '#8ae04a' : '#bff4ff';
      fillE(q.x, q.y + 1, 5, 1.5, col, 0.35 * a);
      if ((m.id + Math.floor(t * 4)) % 3 === 0) dot(q.x + ((m.id * 13) % 9) - 4, q.y - 4 - ((m.id * 7) % 8), m.chillK < 0.3 ? '#c8ff7a' : '#ffffff', 1);
    }
  }
  function drawWords(dt) {
    for (let i = words.length - 1; i >= 0; i--) {
      const w = words[i]; w.life -= dt;
      if (w.life <= 0) { words.splice(i, 1); continue; }
      const k = 1 - w.life / w.max, pop = k < 0.12 ? 0.6 + k / 0.12 * 0.4 : 1;
      const size = Math.round(clamp(u * 2.6, 8, 11) * pop), x = ox + w.x * u, y = oy + (w.y - k * 10) * u;
      ctx.globalAlpha = Math.min(1, w.life / w.max * 3);
      ctx.font = size + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.lineWidth = Math.max(3, size * 0.4); ctx.strokeStyle = '#0a0910'; ctx.lineJoin = 'round';
      ctx.strokeText(w.str, x, y); ctx.fillStyle = w.col; ctx.fillText(w.str, x, y);
      ctx.globalAlpha = 1;
    }
  }

  let last = 0, idle = true;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    if (document.hidden) return;
    const chilled = R.mobs && R.mobs.length && R.mobs.some(m => m.chill > 0);
    const busy = fxs.length || parts.length || decals.length || quick.length || words.length || chilled;
    if (!busy || R.town) {
      if (!idle && ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); }
      idle = true;
      if (R.town) { fxs.length = 0; parts.length = 0; quick.length = 0; decals.length = 0; words.length = 0; }
      return;
    }
    if (!ensure()) return;
    idle = false;
    layout();
    const t = now / 1000;
    lx.setTransform(1, 0, 0, 1, 0, 0);
    lx.clearRect(0, 0, Wl, Hl);
    lx.imageSmoothingEnabled = false;
    drawDecals(dt);
    if (chilled) drawChill(t);
    for (let i = fxs.length - 1; i >= 0; i--) {
      const f = fxs[i];
      f.t = f.live ? f.sp.t : f.t + dt;
      if (!f.live && f.t > (f.sp.T || 2) + 1.5) { fxs.splice(i, 1); continue; }
      const d = DRAW[f.sp.kind];
      if (d) d(f, f.t, dt);
    }
    drawQuick(dt);
    drawParts(dt);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(low, 0, 0, Wl, Hl, ox, oy, Wl * u, Hl * u);
    drawWords(dt);
  }

  // for testing: the current overlay pieces
  G.spellFx = { sfx: SFX, state: () => ({ fx: fxs.length, parts: parts.length, decals: decals.length, quick: quick.length, words: words.map(w => w.str) }) };
  requestAnimationFrame(frame);
})(globalThis.G = globalThis.G || {});
