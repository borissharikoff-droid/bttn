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

  // 3.6 (perf): the overlay is a canvas at the stage's own pixel size, blown up by CSS (no full-screen canvas);
  // it sits just over the stage's pixel layer (under the vignette and the stage's text), shown only while busy
  const st = document.createElement('style');
  st.textContent = '#spellFx { position: absolute; left: 0; top: 0; max-width: none; pointer-events: none; image-rendering: pixelated; }';
  (document.head || document.documentElement).appendChild(st);
  const Qt = () => G.Quality || null;

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
      if (this.ac.state === 'suspended') { /* 4.0: resume() is a promise (WebKit may reject it) */ try { const pr = this.ac.resume(); if (pr && pr.catch) pr.catch(() => {}); } catch (e) { /* not yet allowed */ } }
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
  let cv = null, lx = null, shown = false;
  let u = 3, Wl = 200, Hl = 150, ox = 0, oy = 0;
  function ensure() {
    if (cv && cv.isConnected) return true;
    const stage = document.getElementById('stage'), px = document.getElementById('stagePx');
    if (!stage) return false;
    cv = document.createElement('canvas'); cv.id = 'spellFx'; cv.style.display = 'none'; shown = false;
    (px || stage).insertAdjacentElement('afterend', cv);
    lx = cv.getContext('2d', { willReadFrequently: true }) || cv.getContext('2d');
    Wl = 0; layout();
    return true;
  }
  // the stage's pixel scale and size (read from the stage, no layout reads)
  function layout() {
    const s = St(), z = s && s.size ? s.size() : null;
    if (!z) return;
    if (z.W !== Wl || z.H !== Hl || z.S !== u) {
      u = z.S; Wl = z.W; Hl = z.H;
      cv.width = Wl; cv.height = Hl; cv.style.width = Wl * u + 'px'; cv.style.height = Hl * u + 'px';
    }
  }
  function show(on) { if (on !== shown && cv) { shown = on; cv.style.display = on ? '' : 'none'; } }

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
  const qn = n => { const q = Qt(); return q && q.particles < 1 ? Math.max(1, Math.round(n * q.particles)) : n; };
  function burst(x, y, cols, n, sp, o) {
    n = qn(n);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = rnd(sp * 0.3, sp);
      if (!part(x, y, Object.assign({ vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7 - sp * 0.25, life: rnd(0.35, 0.8), col: pickA(cols), sz: Math.random() < 0.3 ? 2 : 1, grav: 120 }, o))) return;
    }
  }
  // debris: chunks that fly up and fall back to the ground they came from
  function debris(x, y, cols, n, sp, o) {
    n = qn(n);
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
    const str = (G.STR && G.STR['spell_' + sp.kind]) || d.name, x = clamp(c.x, 30, Wl - 30), y = clamp(c.y - (sp.onBoss ? 26 : 30), 30, Hl - 40);
    // 3.6: the word is drawn on the stage's own text layer (crisp, over the effect)
    const s = St();
    if (s && s.text) {
      if (lastWord) lastWord.life = 0;
      lastWord = s.text(x, y - 4, str, d.col, clamp(u * 2.6, 8, 11) / u, { life: 1.25, max: 1.25, vy: -12, pop: 0.15, big: true, spell: true });
      words.length = 0; words.push({ str, life: 1.25 });
      return;
    }
    words.length = 0;
    words.push({ str, col: d.col, x, y, life: 1.25, max: 1.25 });
  }
  let lastWord = null;
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
    const k = (t - t0) / dur, sx = c.x - sp.dir * (big ? 120 : 60), sy = big ? -40 : -24;
    const p = fall(sx, sy, c.x, c.y - 3, k);
    // the spot it will hit: a warning ring that tightens
    const blink = Math.sin(t * 28) > 0 ? 1 : 0.5, rk = 1.3 - 0.3 * k;
    fillE(c.x, c.y, a.rx * rk, a.ry * rk, '#ff3b3b', (big ? 0.1 : 0.06) + 0.12 * k);
    ringE(c.x, c.y, a.rx * rk, a.ry * rk, '#ff3b3b', 0.55 * blink, big ? 2 : 1, 3);
    if (big) ringE(c.x, c.y, a.rx * rk * 0.5, a.ry * rk * 0.5, '#ffb04a', 0.4 * blink, 1, 2);
    // a tail of fire behind it (bands, hottest at the head), then smoke and sparks
    const r = big ? 8 : 4, dx = c.x - sx, dy = c.y - sy, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    const tl = (big ? 34 : 16) * (0.6 + 0.4 * k);
    const bands = [['#ff4a1a', 1.0, 0.75], ['#ff7a2e', 0.75, 0.85], ['#ffe27a', 0.45, 0.95]];
    for (const [col, wk, al] of bands) {
      const w = r * wk * 1.1, len = tl * (0.5 + wk * 0.5);
      tri(p.x + nx * w, p.y + ny * w, p.x - nx * w, p.y - ny * w, p.x - ux * len + Math.sin(t * 40) * 1.5, p.y - uy * len, col, al);
    }
    for (let i = 0; i < (big ? 6 : 2); i++) part(p.x - ux * rnd(0, tl) + rnd(-2, 2), p.y - uy * rnd(0, tl) + rnd(-2, 2), { vx: -ux * rnd(10, 40) + rnd(-12, 12), vy: -uy * rnd(10, 40) - 10, life: rnd(0.2, 0.45), col: pickA(FIRE), sz: Math.random() < 0.5 ? 2 : 1, drag: 2 });
    if (Math.random() < (big ? 0.9 : 0.4)) part(p.x - ux * tl, p.y - uy * tl, { vx: rnd(-8, 8), vy: rnd(-14, -4), life: rnd(0.5, 0.9), col: pickA(SMOKE), sz: 2, drag: 1 });
    glowE(p.x, p.y, r * 3, r * 3, '#ff7a2e', 0.7);
    rock(p.x, p.y, r, true);
  }
  const DRAW = {
    meteor(f, t) { meteorAt(f.sp, f.sp.ev[0], t, true); },
    shower(f, t) { for (const ev of f.sp.ev) meteorAt(f.sp, ev, t, false); },
    firestorm(f, t) {
      // a wall of flame on a ring rolling out of the Button
      if (t < 0.05 || t > 1.25) return;
      const k = clamp((t - 0.05) / 0.95, 0, 1), r = 0.1 + 0.8 * k, a = rad(r), b = P(0, 0.02);
      const fade = 1 - Math.max(0, (t - 0.95) / 0.3), per = Math.PI * (a.rx + a.ry), n = Math.round(per / 4.5);
      // the burnt ground inside, and the band the flames stand on
      ringE(b.x, b.y, a.rx * 0.93, a.ry * 0.93, '#2a1408', 0.35 * fade, 3);
      ringE(b.x, b.y, a.rx, a.ry, '#ff4a1a', 0.75 * fade, 3);
      ringE(b.x, b.y, a.rx, a.ry, '#ffe27a', 0.8 * fade, 1);
      for (let i = 0; i < n; i++) {
        const th = i / n * Math.PI * 2, x = b.x + Math.cos(th) * a.rx, y = b.y + Math.sin(th) * a.ry;
        if (x < -6 || x > Wl + 6 || y < -6 || y > Hl + 20) continue;
        const fl = Math.abs(Math.sin(t * 19 + i * 2.3)), h = (7 + 7 * fl) * (1.2 - 0.4 * k);
        rect(x - 2, y - h, 4, h, '#ff4a1a', 0.85 * fade);
        rect(x - 1.5, y - h * 0.75, 3, h * 0.75, '#ff7a2e', 0.95 * fade);
        rect(x - 1, y - h * 0.4, 2, h * 0.4, '#ffe27a', fade);
        if (fl > 0.8) rect(x - 0.5, y - h - 2, 1, 2, '#ffb04a', 0.8 * fade);
        if (Math.random() < 0.12) part(x + rnd(-2, 2), y - h, { vx: rnd(-6, 6), vy: rnd(-45, -20), life: rnd(0.25, 0.5), col: pickA(FIRE), sz: 1, drag: 1 });
        if (Math.random() < 0.04) part(x, y - h, { vx: rnd(-5, 5), vy: rnd(-20, -10), life: rnd(0.5, 0.9), col: pickA(SMOKE), sz: 2, drag: 1 });
      }
    },
    blizzard(f, t) {
      const sp = f.sp, c = P(sp.x, sp.y), a = rad(sp.ev[0].r), on = clamp(t / 0.3, 0, 1) * clamp((3.0 - t) / 0.4, 0, 1);
      if (on <= 0) return;
      fillE(c.x, c.y, a.rx, a.ry, '#bfefff', 0.3 * on);
      fillE(c.x, c.y, a.rx * 0.7, a.ry * 0.7, '#e8faff', 0.25 * on);
      ringE(c.x, c.y, a.rx, a.ry, '#ffffff', 0.7 * on, 1, 2);
      // the storm cloud it pours out of
      const cy = c.y - 62, cw = clamp(a.rx * 0.7, 26, 48), bb = btn();
      // (never a lid over the Button: there it thins out)
      const ca = on * (Math.abs(cy - (bb.y - 14)) < 34 && Math.abs(c.x - bb.x) < cw + 26 ? 0.35 : 1);
      const PUFF = [[-0.8, 0.25, 0.42], [-0.45, -0.1, 0.55], [0, -0.3, 0.7], [0.45, -0.05, 0.58], [0.82, 0.25, 0.4], [-0.2, 0.3, 0.5], [0.3, 0.32, 0.5]];
      for (const [px, py, pr] of PUFF) fillE(c.x + px * cw + Math.sin(t * 1.3 + px * 5) * 1.5, cy + py * 14 + 3, pr * cw * 0.62 + 1, pr * 13 + 1, '#2a3450', 0.85 * ca);
      for (const [px, py, pr] of PUFF) fillE(c.x + px * cw + Math.sin(t * 1.3 + px * 5) * 1.5, cy + py * 14, pr * cw * 0.6, pr * 13, '#6a7ea4', 0.95 * ca);
      for (const [px, py, pr] of PUFF) if (py < 0.2) fillE(c.x + px * cw - 2 + Math.sin(t * 1.3 + px * 5) * 1.5, cy + py * 14 - pr * 5, pr * cw * 0.32, pr * 6, '#b8c8e4', 0.9 * ca);
      if (Math.random() < 0.05 * on) flashFx(c.x + rnd(-cw, cw) * 0.5, cy, cw * 0.4, 8, '#ffffff', 0.12);
      // snow driving in on the wind, and ice spears dropping
      if (t < 2.6) for (let i = 0; i < 4; i++) {
        const x = c.x + rnd(-a.rx, a.rx) * 0.9, y = c.y - rnd(44, 54);
        part(x - 8, y, { vx: rnd(10, 30), vy: rnd(60, 90), life: rnd(0.5, 0.8), col: pickA(ICE), sz: Math.random() < 0.5 ? 2 : 1, floor: c.y + rnd(-a.ry, a.ry) });
      }
      if (t < 2.6 && Math.random() < 0.5) {
        const x = c.x + rnd(-a.rx * 0.8, a.rx * 0.8), y = c.y + rnd(-a.ry * 0.8, a.ry * 0.8);
        quick.push({ k: 'spear', x, y, h: rnd(30, 46), life: 0.3, max: 0.3 });
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
      const H0 = 78, bands = 20;
      fillE(g.x, g.y + 1, 16, 5, '#3a3020', 0.35 * on);
      fillE(g.x, g.y, 9, 3, '#8a7a5a', 0.5 * on);
      for (let i = 0; i < bands; i++) {
        const h = i / (bands - 1), yy = g.y - 2 - h * H0, wob = Math.sin(t * 5 + h * 3.5) * 5 * h, rx = 3 + h * h * 20 + h * 5, ry = 1.2 + h * 3.2;
        fillE(g.x + wob, yy, rx, ry, i % 2 ? '#b0a07a' : '#8a7c5c', 0.55 * on);
        const n = Math.round(rx * 1.3) + 4;
        lx.globalAlpha = (0.6 + 0.4 * h) * on;
        for (let j = 0; j < n; j++) {
          const th = j / n * Math.PI * 2 + t * (13 - h * 6) + i * 0.7, front = Math.sin(th) > 0;
          if (!front && j % 2) continue;
          lx.fillStyle = front ? (j % 5 === 0 ? '#ffffff' : (i + j) % 3 ? '#e8dcc0' : '#c8b890') : '#5a4e38';
          lx.fillRect(Math.round(g.x + wob + Math.cos(th) * rx) - (front ? 1 : 0), Math.round(yy + Math.sin(th) * ry), front ? 3 : 2, 1);
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
      const w = Math.max(5, a.rx * 0.38) * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) * 0.8), fade = 1 - k * k;
      rect(c.x - w - 2, 0, w * 2 + 4, c.y, '#ffd84a', 0.35 * fade);
      rect(c.x - w, 0, w * 2, c.y, '#ffe27a', 0.6 * fade);
      rect(c.x - w * 0.45, 0, w * 0.9, c.y, '#ffffff', 0.85 * fade);
      fillE(c.x, c.y, a.rx * 0.9, a.ry * 0.9, '#fff3a0', 0.35 * fade);
      fillE(c.x, c.y, w * 1.6, a.ry * 0.5, '#ffffff', 0.8 * fade);
      // rays fanning out at the foot of the pillar
      for (let i = 0; i < 8; i++) { const th = i / 8 * Math.PI * 2 + k * 2; line(c.x, c.y, c.x + Math.cos(th) * a.rx * (0.5 + k), c.y + Math.sin(th) * a.ry * (0.5 + k), '#ffe27a', 1, 0.7 * fade); }
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
          for (let j = 0; j < 6; j++) { an += (r() - 0.5) * 0.8; x += Math.cos(an) * 0.16; y += Math.sin(an) * 0.16; pts.push([x, y]); }
          f.cracks.push(pts);
        }
      }
      const reach = fired === 0 ? clamp(t / sp.ev[0].t, 0, 1) * 0.25 : Math.min(1, 0.45 + 0.28 * (fired - 1) + clamp((t - sp.ev[fired - 1].t) * 3, 0, 0.28));
      for (const pts of f.cracks) {
        const n = Math.max(1, Math.round((pts.length - 1) * reach));
        for (let j = 0; j < n; j++) {
          const p0 = pts[j], p1 = pts[j + 1], x0 = c.x + p0[0] * a.rx, y0 = c.y + p0[1] * a.ry, x1 = c.x + p1[0] * a.rx, y1 = c.y + p1[1] * a.ry, w = j < 2 ? 3 : j < 4 ? 2 : 1;
          if (j < 3) line(x0, y0, x1, y1, '#ff7a2e', w + 2, 0.25 * fade * (fired ? 1 : 0));
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
          const th = i * 2.1 + e.t * 7, rr = 0.25 + ((i * 0.31) % 0.6), x = c.x + Math.cos(th) * a.rx * rr, y = c.y + Math.sin(th) * a.ry * rr, hh = (8 + (i % 3) * 5) * h;
          const bw = 4 + (i % 2) * 2;
          tri(x - bw - 1, y + 2, x + bw + 1, y + 2, x, y - hh * 1.4 - 1, '#2a1c14', 1);
          tri(x - bw, y + 1, x + bw, y + 1, x, y - hh * 1.4, '#6a5040', 1);
          tri(x, y + 1, x + bw, y + 1, x, y - hh * 1.4, '#a88a68', 1);
        }
      }
    },
    poison(f, t) {
      const sp = f.sp, c = P(sp.x, sp.y), a = rad(sp.ev[0].r), on = clamp(t / 0.4, 0, 1) * clamp((sp.T - t) / 0.6, 0, 1);
      if (on <= 0) return;
      // a lumpy cloud of green puffs, rolling in place
      for (let i = 0; i < 11; i++) {
        const th = i * 2.399 + t * 0.6 * (i % 2 ? 1 : -1), rr = 0.25 + (i % 4) * 0.18, x = c.x + Math.cos(th) * a.rx * rr, y = c.y - 5 + Math.sin(th) * a.ry * rr * 0.8;
        const r = (7 + (i % 3) * 4) * (0.8 + 0.2 * Math.sin(t * 3 + i)) * on;
        fillE(x, y + 2, r * 1.35, r * 1.05, '#1a4a14', 0.45 * on);
        fillE(x, y, r * 1.3, r, i % 3 ? '#4a9a2a' : '#6ac83a', 0.65 * on);
        fillE(x - r * 0.3, y - r * 0.35, r * 0.55, r * 0.35, '#b8f070', 0.55 * on);
      }
      fillE(c.x, c.y + 2, a.rx * 0.9, a.ry * 0.8, '#3a8a2a', 0.25 * on);
      // bubbles rise and pop
      if (Math.random() < 0.6 * on) part(c.x + rnd(-a.rx, a.rx) * 0.8, c.y + rnd(-a.ry, a.ry) * 0.6, { vx: rnd(-3, 3), vy: rnd(-26, -12), life: rnd(0.5, 0.9), col: pickA(['#c8ff7a', '#8ae04a', '#e8ffb0']), sz: 3, pop: 1 });
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
        for (let j = 0; j < 2; j++) part(p.x + rnd(-2, 2), p.y + rnd(-2, 2), { vx: rnd(-8, 8), vy: rnd(-8, 8), life: rnd(0.25, 0.5), col: pickA(PURP), sz: Math.random() < 0.4 ? 2 : 1 });
        glowE(p.x, p.y, 13, 13, '#c88aff', 0.8);
        fillE(p.x, p.y, 5, 5, '#3a1a6a', 1);
        fillE(p.x, p.y, 4, 4, '#9a5aff', 1);
        fillE(p.x - 1, p.y - 1, 2.5, 2.5, '#e4c8ff', 1);
        rect(p.x - 1.5, p.y - 1.5, 2, 2, '#ffffff');
        // a little ring turning round each orb
        const ra = t * 9 + ev.i; dot(p.x + Math.cos(ra) * 7, p.y + Math.sin(ra) * 3.5, '#ffffff', 2); dot(p.x - Math.cos(ra) * 7, p.y - Math.sin(ra) * 3.5, '#e4c8ff', 1);
      }
    },
    swords(f, t) {
      const sp = f.sp;
      for (const ev of sp.ev) {
        const c = P(ev.x, ev.y), t0 = ev.t - 0.22;
        if (t < t0) { if (t > t0 - 0.25) ringE(c.x, c.y, 4, 2, '#e4eaf6', 0.6, 1); continue; }
        const k = clamp((t - t0) / 0.22, 0, 1), y = (c.y - 110) + 110 * k * k;
        const stuck = t >= ev.t, fade = stuck ? clamp(1 - (t - ev.t - 0.45) / 0.3, 0, 1) : 1;
        if (fade <= 0) continue;
        sword(c.x, stuck ? c.y : y, fade, stuck);
        if (!stuck) { line(c.x, y - 50, c.x, y - 28, '#ffffff', 1, 0.4); fillE(c.x, c.y + 1, 2 + 3 * k, 1 + k, '#1a1824', 0.35); }
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
      // the pool: a ragged splash of molten rock, crusting over as it cools
      const R0 = 0.62;
      for (let i = 0; i < 6; i++) { const th = i / 6 * Math.PI * 2 + sp.id, x = c.x + Math.cos(th) * a.rx * R0 * 0.55, y = c.y + Math.sin(th) * a.ry * R0 * 0.55; fillE(x, y, a.rx * R0 * 0.5 + 1, a.ry * R0 * 0.5 + 1, '#2a0e06', 0.9 * fade); }
      for (let i = 0; i < 6; i++) { const th = i / 6 * Math.PI * 2 + sp.id, x = c.x + Math.cos(th) * a.rx * R0 * 0.55, y = c.y + Math.sin(th) * a.ry * R0 * 0.55; fillE(x, y, a.rx * R0 * 0.45, a.ry * R0 * 0.45, '#e8401a', 0.95 * fade); }
      fillE(c.x, c.y, a.rx * R0 * 0.75, a.ry * R0 * 0.75, '#ff7a2e', 0.95 * fade);
      fillE(c.x, c.y, a.rx * R0 * 0.4, a.ry * R0 * 0.4, '#ffe27a', 0.9 * fade * (1 - k * 0.6));
      for (let i = 0; i < 7; i++) { const th = i * 1.1 + sp.id, rr = 0.25 + (i % 3) * 0.2; fillE(c.x + Math.cos(th) * a.rx * R0 * rr, c.y + Math.sin(th) * a.ry * R0 * rr, 2.5 * k + 1, 1.2 * k + 0.5, '#4a1a0a', 0.9 * fade); }
      if (Math.random() < 0.5 * fade) { const x = c.x + rnd(-a.rx, a.rx) * R0 * 0.6, y = c.y + rnd(-a.ry, a.ry) * R0 * 0.6; quick.push({ k: 'bubble', x, y, life: 0.35, max: 0.35 }); }
      if (Math.random() < 0.15 * fade) part(c.x + rnd(-a.rx, a.rx) * 0.4, c.y - 2, { vx: rnd(-4, 4), vy: rnd(-18, -8), life: 0.9, col: pickA(SMOKE), sz: 2, drag: 1 });
      // the fountain keeps spitting for a while
      if (k < 0.12) { const h = 46 * (1 - k / 0.12); rect(c.x - 4, c.y - h, 8, h, '#ff4a1a', 0.9); rect(c.x - 2, c.y - h, 4, h, '#ffb04a'); rect(c.x - 1, c.y - h * 0.8, 2, h * 0.8, '#ffe27a'); }
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
        // three claw marks, slashing down at a slant: a black wound edged in magenta
        for (let j = -1; j <= 1; j++) {
          const L = Math.max(34, a.rx * 2.2), ang = 0.85 + ev.ang, dx = Math.cos(ang), dy = Math.sin(ang);
          const x0 = c.x - dx * L / 2 + j * 9, y0 = c.y - 14 - dy * L / 2 + j * 2;
          const n = 14, m = Math.round(n * grow), pts = [];
          for (let i = 0; i <= m; i++) { const q = i / n, bow = Math.sin(q * Math.PI) * 6; pts.push([x0 + dx * L * q - dy * bow, y0 + dy * L * q + dx * bow, Math.max(1, Math.round(Math.sin(q * Math.PI) * (j ? 4 : 5)))]); }
          for (const [wa, col, al] of [[4, '#b36bff', 0.45], [2, '#ff4fd8', 0.9], [0, '#0a0410', 1]])
            for (let i = 1; i < pts.length; i++) line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], col, Math.max(1, Math.min(pts[i - 1][2], pts[i][2]) + wa), al * fade);
          if (grow < 1) { const q = grow, x = x0 + dx * L * q - dy * Math.sin(q * Math.PI) * 6, y = y0 + dy * L * q + dx * Math.sin(q * Math.PI) * 6; rect(x - 1, y - 1, 3, 3, '#ffffff'); }
        }
      }
    },
  };
  function sword(x, y, a, stuck) {
    // a falling sword, point down; y is where the point is
    lx.globalAlpha = a;
    rect(x - 2, y - 17, 5, 16, '#1a1824'); rect(x - 1, y - 17, 3, 15, '#c8d0e0'); rect(x - 1, y - 17, 1, 15, '#ffffff'); rect(x, y - 2, 1, 2, '#e4eaf6');
    rect(x - 5, y - 20, 11, 4, '#1a1824'); rect(x - 4, y - 19, 9, 2, '#ffd84a'); rect(x - 4, y - 19, 9, 1, '#fff3a0');
    rect(x - 1, y - 26, 3, 6, '#1a1824'); rect(x, y - 25, 1, 5, '#8a5a30'); rect(x - 2, y - 28, 5, 3, '#1a1824'); rect(x - 1, y - 27, 3, 1, '#ffd84a');
    lx.globalAlpha = 1;
    if (stuck) fillE(x, y + 1, 4, 1.5, '#2a2418', 0.5 * a);
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
        decal({ k: 'crater', x: c.x, y: c.y, rx: a.rx * (big ? 0.5 : 0.55), ry: a.ry * (big ? 0.5 : 0.55), life: big ? 2.6 : 1.8, seed: Math.random() * 6 });
        quick.push({ k: 'flames', x: c.x, y: c.y, rx: a.rx * (big ? 0.8 : 0.5), ry: a.ry * (big ? 0.8 : 0.5), n: big ? 14 : 4, h: big ? 16 : 9, seed: Math.random() * 9, life: big ? 0.7 : 0.4, max: big ? 0.7 : 0.4 });
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
      burst(c.x, c.y, PURP, 24, 110, { grav: 0, drag: 2 });
      ringFx(c.x, c.y + 4, 3, 22, 1.5, 10, '#c88aff', 0.4, 2);
      flashFx(c.x, c.y, 16, 16, '#e4c8ff', 0.22);
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
  const RAIN = ['#ff4f6a', '#ffb04a', '#ffe27a', '#8ae07a', '#5ae8ff', '#9a7aff', '#ff9ad8'];
  const FLOUR = {
    // Shoreline: a geyser bursts out of the sand under it
    water(x, y) {
      quick.push({ k: 'geyser', x, y, life: 0.4, max: 0.4 });
      for (let i = 0; i < 14; i++) part(x + rnd(-3, 3), y - rnd(0, 6), { vx: rnd(-30, 30), vy: rnd(-150, -80), life: rnd(0.45, 0.7), col: pickA(['#ffffff', '#9fe4ff', '#5ac8ff', '#3a8aff']), sz: Math.random() < 0.6 ? 2 : 1, grav: 340, floor: y + rnd(0, 4) });
      ringFx(x, y, 3, 16, 1.5, 6, '#d8f6ff', 0.4, 1);
    },
    // Meadows: a vine curls up and petals blow off it
    bloom(x, y) {
      for (let i = 0; i < 10; i++) part(x + rnd(-5, 5), y - rnd(6, 18), { vx: rnd(-40, 40), vy: rnd(-50, -15), life: rnd(0.7, 1.1), col: pickA(['#ff9ad8', '#ffffff', '#ffe27a', '#ffb0e0']), sz: 2, grav: 40, drag: 2, flutter: 1 });
      quick.push({ k: 'vine', x: x - 4, y, dir: -1, life: 0.55, max: 0.55 }); quick.push({ k: 'vine', x: x + 4, y, dir: 1, life: 0.55, max: 0.55 });
    },
    // Deepwood: roots tear up out of the ground and grab
    roots(x, y) { quick.push({ k: 'roots', x, y, seed: Math.random() * 100, life: 0.5, max: 0.5 }); debris(x, y, ['#5a3a2a', '#8a6040', '#3a5a2a'], 8, 70); },
    // Highlands: a crown of rock spikes
    stone(x, y) { quick.push({ k: 'spikes', x, y, seed: Math.random() * 100, life: 0.45, max: 0.45, col: '#7a7a84', hi: '#c8c8d4' }); debris(x, y, ['#6a6a74', '#9a9aa4', '#4a4a54'], 8, 80); },
    // Frostlands: an ice star that shatters into shards
    frost(x, y) {
      for (let i = 0; i < 10; i++) { const a = rnd(0, Math.PI * 2); part(x, y - 8, { vx: Math.cos(a) * rnd(50, 100), vy: Math.sin(a) * rnd(40, 70) - 25, life: rnd(0.3, 0.55), col: pickA(ICE), sz: 1, grav: 150, streak: 1 }); }
      quick.push({ k: 'crystal', x, y: y - 8, life: 0.35, max: 0.35 });
    },
    // Godlands: a ray of gold out of the sky
    holy(x, y) { quick.push({ k: 'ray', x, y, w: 5, col: '#ffe27a', core: '#ffffff', life: 0.35, max: 0.35 }); burst(x, y - 6, GOLD, 10, 60, { grav: -30 }); },
    // Abyss: a gout of hellfire
    hellfire(x, y) {
      quick.push({ k: 'flames', x, y, rx: 6, ry: 2, n: 4, h: 14, seed: Math.random() * 9, life: 0.35, max: 0.35 });
      for (let i = 0; i < 12; i++) part(x + rnd(-5, 5), y - rnd(0, 6), { vx: rnd(-18, 18), vy: rnd(-90, -40), life: rnd(0.3, 0.6), col: pickA(['#ff3b3b', '#ff7a2e', '#2a0a0a', '#ffb04a']), sz: Math.random() < 0.6 ? 2 : 1, drag: 2 });
      decal({ k: 'scorch', x, y, rx: 6, ry: 2, life: 0.9 });
    },
    // The Void: a rift opens behind it and pulls the dark in
    void(x, y) { quick.push({ k: 'rift', x, y: y - 8, life: 0.5, max: 0.5 }); for (let i = 0; i < 10; i++) { const a = rnd(0, Math.PI * 2), r = rnd(12, 20); part(x + Math.cos(a) * r, y - 8 + Math.sin(a) * r * 0.6, { vx: -Math.cos(a) * r * 3, vy: -Math.sin(a) * r * 1.8, life: 0.32, col: pickA(['#b36bff', '#1a0a2a', '#ff4fd8']), sz: 2 }); } },
    // Sunken Library: a turning glyph
    arcane(x, y) { quick.push({ k: 'glyph', x, y: y - 2, s: 1.7, life: 0.55, max: 0.55 }); burst(x, y - 6, PURP, 8, 50, { grav: -20 }); },
    // Clockwork Foundry: sparks and a cog flung off
    spark(x, y) { burst(x, y - 6, ['#ffe27a', '#ffffff', '#ffb04a'], 14, 140, { grav: 260, streak: 1, life: 0.4 }); quick.push({ k: 'gear', x, y: y - 8, vx: rnd(-40, 40), vy: -80, life: 0.6, max: 0.6 }); },
    // Ember Wastes: a splash of lava
    lava(x, y) { for (let i = 0; i < 12; i++) part(x, y - 2, { vx: rnd(-45, 45), vy: rnd(-110, -50), life: rnd(0.45, 0.7), col: pickA(FIRE), sz: 2, grav: 320, floor: y + rnd(0, 4) }); decal({ k: 'pool', x, y, rx: 6, ry: 2, life: 1 }); flashFx(x, y - 4, 8, 6, '#ff7a2e', 0.15); },
    // Mirror Maze: a prism bursts into a rainbow of shards
    prism(x, y) { quick.push({ k: 'prism', x, y: y - 8, life: 0.25, max: 0.25 }); for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; part(x, y - 8, { vx: Math.cos(a) * 95, vy: Math.sin(a) * 60, life: 0.4, col: RAIN[i % RAIN.length], sz: 1, streak: 1, drag: 3 }); } },
    // Sky Citadel: a gust of wind, feathers
    wind(x, y) { quick.push({ k: 'gust', x, y: y - 8, dir: Math.random() < 0.5 ? -1 : 1, life: 0.45, max: 0.45 }); for (let i = 0; i < 2; i++) part(x + rnd(-6, 6), y - 14, { vx: rnd(-25, 25), vy: -14, life: 1, col: '#ffffff', sz: 2, grav: 30, drag: 1, flutter: 1, feather: 1 }); },
    // The Moon: a pale moonbeam and a crescent
    moon(x, y) { quick.push({ k: 'ray', x, y, w: 4, col: '#a8b8ff', core: '#ffffff', life: 0.4, max: 0.4 }); quick.push({ k: 'crescent', x, y: y - 20, life: 0.55, max: 0.55 }); burst(x, y - 4, ['#e8eeff', '#a8b8ff'], 6, 40, { grav: 0, drag: 2 }); },
    // The Star Sea: a falling star
    star(x, y) { quick.push({ k: 'star', x: x + rnd(-40, 40), y: -10, tx: x, ty: y - 8, life: 0.32, max: 0.32 }); },
  };
  G.on('heroAttack', ev => {
    if (!ev || ev.src !== 'click' || ev.boss || document.hidden || R.town || !cv) return;
    const now = performance.now();
    if (now - lastFlour < (ev.extra ? 120 : 55) || parts.length > MAXP * 0.8) return;
    lastFlour = now;
    const id = ev.ids && ev.ids[0], m = id != null && R.mobs.find(q => q.id === id);
    if (!m) return;
    if (idle) layout();
    const q = mobL(m), f = FLOUR[realmEl()];
    if (f) f(q.x, q.y);
  });

  // ================= Listening =================
  G.on('spellCast', sp => {
    if (!ensure()) return;
    layout();
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
        // a ragged hole: thrown-up dirt round it, a dark bowl, a lit lip on the near side, embers cooling
        const sd = d.seed || 0;
        for (let k = 0; k < 7; k++) { const th = k / 7 * Math.PI * 2 + sd, rr = 0.85 + ((k * 37 + sd * 10) % 5) * 0.06; fillE(d.x + Math.cos(th) * d.rx * rr, d.y + Math.sin(th) * d.ry * rr, d.rx * 0.32, d.ry * 0.4, '#7a5a40', 0.55 * a); }
        fillE(d.x, d.y, d.rx * 0.88, d.ry * 0.85, '#3a281a', 0.75 * a);
        fillE(d.x, d.y - d.ry * 0.12, d.rx * 0.7, d.ry * 0.6, '#1a1008', 0.8 * a);
        for (let k = 0; k < 9; k++) { const th = 0.25 + k / 8 * (Math.PI - 0.5); dot(d.x + Math.cos(th) * d.rx * 0.86, d.y + Math.sin(th) * d.ry * 0.82, '#c8a070', 2); }
        const hot = clamp((d.life - d.max + 1.4) / 1.4, 0, 1);
        if (hot > 0) {
          fillE(d.x, d.y - d.ry * 0.1, d.rx * 0.36, d.ry * 0.28, '#ff4a1a', 0.85 * hot);
          fillE(d.x - 1, d.y - d.ry * 0.12, d.rx * 0.16, d.ry * 0.13, '#ffe27a', 0.9 * hot);
          if (Math.random() < 0.25) part(d.x + rnd(-d.rx, d.rx) * 0.4, d.y - 2, { vx: rnd(-4, 4), vy: rnd(-16, -6), life: 1, col: pickA(SMOKE), sz: 2, drag: 1 });
        }
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
        case 'spear': { const y = q.y - q.h * (1 - Math.min(1, k * 3)); line(q.x, y - 10, q.x, y, '#5ac8ff', 3, a); line(q.x, y - 9, q.x, y, '#ffffff', 1, a); if (k > 0.33 && !q.hit) { q.hit = 1; burst(q.x, q.y, ICE, 3, 40, { grav: 160 }); } break; }
        case 'flames': {
          for (let j = 0; j < q.n; j++) {
            const th = j * 2.399 + q.seed, rr = 0.2 + ((j * 0.61) % 0.8), x = q.x + Math.cos(th) * q.rx * rr, y = q.y + Math.sin(th) * q.ry * rr;
            const h = q.h * a * (0.6 + 0.4 * Math.abs(Math.sin(j * 1.7 + k * 20)));
            rect(x - 2, y - h, 4, h, '#ff4a1a', 0.9); rect(x - 1.5, y - h * 0.75, 3, h * 0.75, '#ff7a2e'); rect(x - 1, y - h * 0.4, 2, h * 0.4, '#ffe27a');
          }
          break;
        }
        case 'bubble': ringE(q.x, q.y - k * 3, 1 + k * 3, 1 + k * 2, '#ffe27a', a, 1); break;
        case 'bolt': {
          const pts = q.pts;
          bolt(q.x0, -4, pts[0].x, pts[0].y, ['#7fe9ff', '#ffffff'], 7, 1);
          for (let j = 1; j < pts.length; j++) bolt(pts[j - 1].x, pts[j - 1].y, pts[j].x, pts[j].y, ['#7fe9ff', '#ffffff'], 4, 1);
          for (const p of pts) glowE(p.x, p.y, 7, 7, '#bff4ff', a);
          break;
        }
        case 'vine': {
          const n = Math.round(16 * Math.min(1, k * 2.5));
          for (let j = 0; j < n; j++) { const s = j / 16, x = q.x + q.dir * (Math.sin(s * 6) * 5 + s * 6), y = q.y - s * 24; rect(x, y, 2, 2, '#3a8a2a', a); rect(x, y, 1, 1, '#6ac83a', a); if (j % 4 === 3) { rect(x + q.dir * 2, y - 1, 3, 2, '#8ae04a', a); } }
          if (n >= 16) { const x = q.x + q.dir * (Math.sin(6) * 5 + 6), y = q.y - 24; rect(x - 2, y - 2, 4, 4, '#ff9ad8', a); rect(x - 1, y - 1, 2, 2, '#ffe27a', a); }
          break;
        }
        case 'roots': {
          for (let j = 0; j < 5; j++) {
            const th = j * 1.26 + q.seed, L = (10 + (j % 2) * 7) * Math.min(1, k * 3), dx = Math.cos(th) * L, dy = -Math.abs(Math.sin(th)) * L - 3, bx = q.x + dx * 0.5 + (j % 2 ? 3 : -3), by = q.y + dy * 0.5;
            line(q.x, q.y, bx, by, '#2a1a10', 4, a); line(q.x, q.y, bx, by, '#6a4a2a', 3, a);
            line(bx, by, q.x + dx, q.y + dy, '#2a1a10', 3, a); line(bx, by, q.x + dx, q.y + dy, '#8a6040', 2, a);
            rect(q.x + dx - 1, q.y + dy - 1, 2, 2, '#5ab83a', a);
          }
          fillE(q.x, q.y + 1, 7, 2.5, '#3a2818', 0.6 * a);
          break;
        }
        case 'spikes': {
          const h = Math.sin(Math.min(1, k * 1.4) * Math.PI);
          for (let j = -2; j <= 2; j++) { const x = q.x + j * 5, hh = (j === 0 ? 16 : Math.abs(j) === 1 ? 11 : 7) * h, bw = j ? 3 : 4; tri(x - bw - 1, q.y + 2, x + bw + 1, q.y + 2, x, q.y - hh - 1, '#2a2a34', 1); tri(x - bw, q.y + 1, x + bw, q.y + 1, x, q.y - hh, q.col, 1); tri(x, q.y + 1, x + bw, q.y + 1, x, q.y - hh, q.hi, 1); }
          break;
        }
        case 'crystal': {
          const s = 6 * (1 + k * 0.6);
          for (const [dx, dy, col] of [[0, 1, '#ffffff'], [1, 0, '#9fe4ff'], [0.7, 0.7, '#d8f6ff'], [0.7, -0.7, '#d8f6ff']]) { line(q.x - dx * s, q.y - dy * s, q.x + dx * s, q.y + dy * s, '#3a8aff', 3, 0.6 * a); line(q.x - dx * s, q.y - dy * s, q.x + dx * s, q.y + dy * s, col, 1, a); }
          fillE(q.x, q.y, 2.5, 2.5, '#ffffff', a);
          break;
        }
        case 'ray': { rect(q.x - q.w - 1, 0, q.w * 2 + 2, q.y, q.col, 0.35 * a); rect(q.x - q.w, 0, q.w * 2, q.y, q.col, 0.55 * a); rect(q.x - q.w / 2, 0, Math.max(1, q.w), q.y, q.core, 0.85 * a); fillE(q.x, q.y, q.w * 3, q.w * 1.1, q.col, 0.7 * a); fillE(q.x, q.y, q.w * 1.6, q.w * 0.6, q.core, 0.8 * a); break; }
        case 'rift': { const o = Math.sin(Math.min(1, k * 1.2) * Math.PI), w = 14 * o, h = 2 + 5 * o; fillE(q.x, q.y, w + 3, h + 3, '#b36bff', 0.45 * o); fillE(q.x, q.y, w + 1, h + 1, '#ff4fd8', 0.85); fillE(q.x, q.y, w, h, '#0a0414', 1); rect(q.x - 1, q.y - 1, 3, 2, '#ffffff', o); break; }
        case 'glyph': {
          const S = q.s || 1, r = (7 + 2 * k) * S, rot = k * 3;
          ringE(q.x, q.y, r, r * 0.5, '#3a1a6a', a, 3); ringE(q.x, q.y, r, r * 0.5, '#c88aff', a, 1);
          ringE(q.x, q.y, r * 0.6, r * 0.3, '#e4c8ff', a, 1, 2);
          for (let j = 0; j < 4; j++) { const th = rot + j * Math.PI / 2; rect(q.x + Math.cos(th) * r - 1.5, q.y + Math.sin(th) * r * 0.5 - 1.5, 3, 3, '#ffffff', a); }
          line(q.x + Math.cos(rot) * r * 0.6, q.y + Math.sin(rot) * r * 0.3, q.x - Math.cos(rot) * r * 0.6, q.y - Math.sin(rot) * r * 0.3, '#e4c8ff', 1, a);
          break;
        }
        case 'gear': {
          q.vy += 220 * dt; q.x += q.vx * dt; q.y += q.vy * dt;
          const rot = k * 10; fillE(q.x, q.y, 4.5, 4.5, '#2a2418', a); fillE(q.x, q.y, 3.5, 3.5, '#c8a050', a); rect(q.x - 1, q.y - 1, 2, 2, '#2a2418', a);
          for (let j = 0; j < 8; j++) { const th = rot + j * Math.PI / 4; rect(q.x + Math.cos(th) * 5 - 1, q.y + Math.sin(th) * 5 - 1, 2, 2, '#e8c870', a); }
          break;
        }
        case 'gust': { for (let j = 0; j < 3; j++) { const y = q.y + (j - 1) * 6, L = 22 * Math.min(1, k * 2), x0 = q.x - q.dir * 16 + q.dir * k * 14; line(x0, y, x0 + q.dir * L, y - (j - 1), '#ffffff', 2, 0.75 * a); for (let c = 0; c < 4; c++) { const th = c / 4 * Math.PI * 1.5; rect(x0 + q.dir * (L + Math.sin(th) * 3), y - (j - 1) - 3 + Math.cos(th) * 3, 1, 1, '#ffffff', 0.75 * a); } } break; }
        case 'crescent': { const y = q.y - k * 6; fillE(q.x, y, 6, 6, '#e8eeff', a); lx.globalCompositeOperation = 'destination-out'; fillE(q.x + 3, y - 2, 5, 5, '#000', 1); lx.globalCompositeOperation = 'source-over'; rect(q.x - 6, y - 1, 1, 2, '#ffffff', a); break; }
        case 'star': {
          const e = Math.min(1, k * 1.4), x = q.x + (q.tx - q.x) * e, y = q.y + (q.ty - q.y) * e;
          line(x - (q.tx - q.x) * 0.3, y - (q.ty - q.y) * 0.3, x, y, '#9fe4ff', 2, 0.45 * a);
          line(x - (q.tx - q.x) * 0.15, y - (q.ty - q.y) * 0.15, x, y, '#ffffff', 1, 0.7 * a);
          rect(x - 4, y - 1, 9, 3, '#ffe27a', a); rect(x - 1, y - 4, 3, 9, '#ffe27a', a); rect(x - 1, y - 1, 3, 3, '#ffffff', a);
          if (e >= 1 && !q.hit) { q.hit = 1; burst(q.tx, q.ty, ['#ffffff', '#ffe27a', '#9fe4ff'], 12, 70, { grav: 0, drag: 2, twinkle: 1 }); ringFx(q.tx, q.ty + 6, 3, 14, 1.5, 6, '#ffe27a', 0.3, 1); }
          break;
        }
        case 'geyser': {
          const h = 30 * Math.sin(Math.min(1, k * 1.6) * Math.PI);
          rect(q.x - 4, q.y - h, 8, h, '#3a8aff', 0.7 * a); rect(q.x - 3, q.y - h, 6, h, '#5ac8ff', 0.9 * a); rect(q.x - 1, q.y - h, 2, h, '#ffffff', a);
          fillE(q.x, q.y - h, 6, 3, '#d8f6ff', a); fillE(q.x, q.y, 8, 2.5, '#9fe4ff', 0.7 * a);
          break;
        }
        case 'prism': { const r = 4 + k * 4; tri(q.x, q.y - r * 1.4, q.x - r, q.y + r * 0.7, q.x + r, q.y + r * 0.7, '#e4eaf6', a); tri(q.x, q.y - r * 1.4, q.x, q.y + r * 0.7, q.x + r, q.y + r * 0.7, '#9fe4ff', a); rect(q.x - 1, q.y - 1, 2, 2, '#ffffff', a); break; }
      }
    }
  }
  function drawParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life -= dt;
      if (p.life <= 0) { if (p.pop) ringFx(p.x, p.y, 1, 3, 1, 3, p.col, 0.15, 1); const l = parts.pop(); if (i < parts.length) parts[i] = l; continue; }
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
    // (the words live on the stage's text layer; this only ages the record of the last one)
    for (let i = words.length - 1; i >= 0; i--) { const w = words[i]; w.life -= dt; if (w.life <= 0) words.splice(i, 1); }
  }

  let idle = true;
  // 3.6: one frame loop: the stage calls this after it draws (a rAF of its own only without the stage's hook)
  function step(dtIn, now) {
    const dt = Math.min(0.05, dtIn || 0);
    if (document.hidden) return;
    const chilled = R.mobs && R.mobs.length && R.mobs.some(m => m.chill > 0);
    const busy = fxs.length || parts.length || decals.length || quick.length || chilled;
    drawWords(dt);
    if (!busy || R.town) {
      if (!idle && lx) { lx.setTransform(1, 0, 0, 1, 0, 0); lx.clearRect(0, 0, cv.width, cv.height); show(false); }
      idle = true;
      if (R.town) { fxs.length = 0; parts.length = 0; quick.length = 0; decals.length = 0; words.length = 0; }
      return;
    }
    if (!ensure()) return;
    idle = false;
    layout();
    show(true);
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
  }
  let last = 0;
  function frame(now) {
    if (G.Stage && G.Stage.onFrame) { G.Stage.onFrame(step); return; }
    requestAnimationFrame(frame);
    const dt = (now - (last || now)) / 1000; last = now;
    step(dt, now);
  }

  // for testing: the current overlay pieces
  G.spellFx = { sfx: SFX, flourish: (el, x, y) => { if (!ensure()) return; layout(); idle = false; if (FLOUR[el]) FLOUR[el](x, y); }, size: () => ({ Wl, Hl, u }), at: (x, y) => { if (!ensure()) return null; layout(); const q = P(x, y), r = G.Stage && G.Stage.rect ? G.Stage.rect() : cv.getBoundingClientRect(); return { x: r.left + ox + q.x * u, y: r.top + oy + q.y * u }; }, state: () => ({ fx: fxs.length, parts: parts.length, decals: decals.length, quick: quick.length, words: words.map(w => w.str) }) };
  // (the stage is set up after this file loads: hook on once the page is ready)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(frame)); else requestAnimationFrame(frame);
})(globalThis.G = globalThis.G || {});
