// BTTN — the stage: a low-res pixel canvas scaled by an integer factor, plus a
// hi-res pass for text and bars. Listens to game events for all the juice.
(function (G) {
  'use strict';
  const { SPR, clamp, rand, pick } = G;
  const St = G.Stage = {};

  // 3.6 (perf): two layers. `low` (#stagePx) is the pixel layer itself, W x H, scaled up by CSS with
  // image-rendering: pixelated, so the compositor does the blow-up; `cv` (#stage, on top, takes the input)
  // is a transparent hi-res layer for text and bars that clears only what it drew the frame before.
  // The vignette, the red hurt edge and the flash are CSS layers between the two.
  // DPR: the screen's (capped at 2), used for the field's pixel scale; TDPR: the text layer's (by quality tier).
  let cv, ctx, low, lctx, W = 200, H = 150, S = 3, DPR = 1, TDPR = 1;
  let fxVig = null, fxRed = null, fxFlash = null, fxRedA = -1, fxFlashA = -1, fxFlashCol = '', pxShift = '', vigOn = null;
  let groundCanvas = null, groundKey = '';
  const parts = [], texts = [], shots = [], beams = [], bolts = [], bullets = [], opening = [], flyers = [];
  const gibs = [], rings = [], coins = [], gems = [], glowFx = [];
  const vis = new Map(); // chest id -> visual state
  let slots = [];
  let heroVis = [], heroKey = '';
  let shake = 0, flash = 0, flashCol = '#ffffff', btnPress = 0, time = 0;
  let bossVis = null, bossHitT = 0, bossBulletT = 0;
  let hoverChest = null, pointer = { x: -99, y: -99, over: false };
  let holdTimer = 0, holding = false;
  let hitstop = 0, slowmo = 0, kick = 0, btnFlashT = 0, fdt = 1 / 60;
  // clicks in a quick run add up into one growing number; kill gold is summed and shown at the Button
  let clickTxt = null, killGold = 0, killGoldT = 0, frameKills = 0, comboTier = 0, openHeat = 0;
  // how hard the party is being hit right now (drives the red edge), and the Button's damage not yet shown
  let hurtFx = 0, btnDmg = 0, btnDmgT = 0, beatT = 0;
  const fmtSmall = v => (v < 10 ? String(+v.toFixed(2)) : G.fmt(v));
  // 3.6: the CRIT! word at most once in 0.6 s (the orange number already says it)
  let critAt = -9;
  const critWord = () => { if (time - critAt < 0.6) return false; critAt = time; return true; };
  // The Button is a spring: every click squashes it and it bounces back
  const btnSpring = { s: 1, v: 0 };
  const MAXP = 700, MAXG = 650;
  // 3.5: blows are drawn a size up where the field's pixels are small (a phone), so they read at arm's length
  let FXK = 1;

  // ---------- 3.6: quality governor (G.Quality) ----------
  // Tiers 0 (full) .. 3 (lightest), stepped by measured frame time with hysteresis. Settings → Reduce effects
  // holds it at 2 or lighter. Other code may read it (guarded) to scale optional effects.
  const PHONE = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 820;
  const TIERS = [
    { particles: 1, maxP: 700, maxG: 650, chunks: 5, gore: 60, decals: 1, mobCap: 1100, shadows: 2, glows: 2, pfxCap: 180, pfxQ: 1, fxDpr: 2, text: 2, rings: 40 },
    { particles: 0.75, maxP: 520, maxG: 460, chunks: 4, gore: 40, decals: 1, mobCap: 800, shadows: 1, glows: 2, pfxCap: 140, pfxQ: 0.85, fxDpr: 2, text: 1.5, rings: 30 },
    { particles: 0.5, maxP: 340, maxG: 300, chunks: 2, gore: 24, decals: 0.5, mobCap: 560, shadows: 1, glows: 1, pfxCap: 100, pfxQ: 0.6, fxDpr: 1, text: 1, rings: 22 },
    { particles: 0.3, maxP: 140, maxG: 100, chunks: 1, gore: 12, decals: 0.25, mobCap: 380, shadows: 0, glows: 0, pfxCap: 70, pfxQ: 0.4, fxDpr: 1, text: 1, rings: 14 },
  ];
  // (a phone's field is a third of a desktop's: it draws fewer of the far small fry)
  if (PHONE) { const cap = [800, 600, 420, 250]; TIERS.forEach((t, i) => { t.mobCap = cap[i]; }); }
  // the share of the crowd the game may field at each tier (js/hero.js may scale its body count by it; weight is kept)
  [1, 0.9, 0.78, 0.65].forEach((k, i) => { TIERS[i].crowd = k; });
  const Q = G.Quality = Object.assign({ tier: PHONE ? 1 : 0, auto: true, phone: PHONE, fps: 60, work: 0, debug: false, textCap: PHONE ? 14 : 25, dmgCap: PHONE ? 5 : 8 }, TIERS[PHONE ? 1 : 0]);
  const qs = { d: new Float32Array(240), w: new Float32Array(240), t: new Float64Array(240), n: 0, i: 0, warm: 2.5, last: -99, good: 0, downs: [], lockUp: 0, clock: 0 };
  function applyTier(t, why) {
    const lowfx = G.S && G.S.set && G.S.set.lowfx;
    t = clamp(Math.round(t), lowfx ? 2 : 0, 3);
    const changed = t !== Q.tier;
    Q.tier = t; Object.assign(Q, TIERS[t]);
    if (lowfx) Q.particles = Math.min(Q.particles, 0.45);
    PFX.cap = Q.pfxCap;
    if (changed) { qs.warm = 2; qs.n = 0; if (cv && textDpr() !== TDPR) St.resize(); G.emit && G.emit('quality', t, why || 'auto'); }
    return t;
  }
  Q.set = (t, why) => applyTier(t, why || 'set');
  // one sample per frame: the time since the last frame and the script work in it (ms)
  Q.sample = function (dms, wms, skip) {
    const now = (qs.clock += dms / 1000);
    // Settings → Reduce effects holds the tier at 2 or lighter (and lets go of the hold when it is turned off)
    const lf = !!(G.S && G.S.set && G.S.set.lowfx);
    if (lf !== qs.lf) { const was = qs.lf; qs.lf = lf; if (was !== undefined || lf) applyTier(lf ? Math.max(2, Q.tier) : Q.tier, 'lowfx'); }
    if (skip || !Q.auto || typeof document !== 'undefined' && document.hidden) { qs.warm = Math.max(qs.warm, 0.6); return; }
    if (qs.warm > 0) { qs.warm -= dms / 1000; return; }
    qs.d[qs.i] = Math.min(dms, 250); qs.w[qs.i] = wms; qs.t[qs.i] = now; qs.i = (qs.i + 1) % 240; if (qs.n < 240) qs.n++;
    if (now - qs.last < 1) return;
    // judge the last 2 seconds once a second
    const ds = [], ws = [];
    for (let k = 0; k < qs.n; k++) if (now - qs.t[k] <= 2) { ds.push(qs.d[k]); ws.push(qs.w[k]); }
    if (ds.length < 8) return;
    qs.last = now;
    ds.sort((a, b) => a - b); ws.sort((a, b) => a - b);
    const d50 = ds[ds.length >> 1], d90 = ds[Math.floor(ds.length * 0.9)], d95 = ds[Math.floor(ds.length * 0.95)], w50 = ws[ws.length >> 1];
    let dm = 0; for (let k = 0; k < ds.length; k++) dm += ds[k]; dm /= ds.length;
    Q.fps = Math.round(1000 / Math.max(1, dm)); Q.work = Math.round(w50 * 10) / 10;
    const since = now - (Q._at || -99);
    // slow: under ~47 frames a second with real work in them (a display stuck at 30 Hz with no work is left alone)
    // (or one frame in twenty or more missing its turn: a stutter)
    const slow = (dm > 21 && w50 > 3) || w50 > 12 || (d90 > 45 && w50 > 4) || (d95 > 30 && dm > 17.4 && w50 > 2);
    const fine = dm < 17.4 && d95 < 24 && w50 < 6;
    qs.good = fine ? qs.good + 1 : 0;
    if (slow && Q.tier < 3 && since >= (dm > 30 ? 2 : 4)) {
      // a step back down soon after a step up: wait twice as long before the next step up
      if (qs.upAt != null && now - qs.upAt < 30) qs.upNeed = Math.min(300, (qs.upNeed || 15) * 2);
      Q._at = now; qs.downs = qs.downs.filter(x => now - x < 60); qs.downs.push(now);
      if (qs.downs.length >= 3) qs.lockUp = now + 120;
      applyTier(Q.tier + 1, 'slow');
    } else if (qs.good >= (qs.upNeed || 15) && Q.tier > (G.S && G.S.set && G.S.set.lowfx ? 2 : 0) && since >= 20 && now > qs.lockUp) {
      Q._at = now; qs.good = 0; qs.upAt = now; applyTier(Q.tier - 1, 'fast');
    }
  };
  // the text layer's pixel ratio: the screen's on the full tiers, 1 on the light ones
  // (tier 1 keeps it on a small screen, but a big sharp one (a retina laptop: 6 MP and more) goes to 1:
  // Press Start 2P is a pixel font, so at 1 it is the same letters a step coarser)
  function textDpr() {
    const d = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    if (Q.text >= 2) return d;
    if (Q.text > 1 && cv) { const r = cv.parentElement.getBoundingClientRect(); if (r.width * r.height * d * d <= 3e6) return d; }
    return 1;
  }
  // the fx overlays' ratio: never above 1 on a big sharp screen (their pixels are big anyway)
  Q.fxRatio = (w, h) => { const d = Math.min(Q.fxDpr || 1, (typeof window !== 'undefined' && window.devicePixelRatio) || 1); return w * h * d * d > 2.5e6 ? 1 : d; };

  // ---------- 3.6: one frame loop (main.js) and the hooks the fx files hang on it ----------
  // St.onFrame(fn): fn(dt, now) is called every frame after the stage is drawn; it returns nothing.
  const frameFns = [];
  St.onFrame = fn => { if (typeof fn === 'function' && frameFns.indexOf(fn) < 0) frameFns.push(fn); return fn; };
  St.runFrameFns = (dt, now) => { for (let i = 0; i < frameFns.length; i++) { try { frameFns[i](dt, now); } catch (e) { if ((frameFns[i]._err = (frameFns[i]._err || 0) + 1) < 3) console.error(e); } } };

  // ---------- 3.6: the stage's place on the screen, cached (no layout reads every frame) ----------
  // (read in St.readLayout at the start of a frame, before anything writes to the page, so it never forces a layout)
  let rectC = null, rectT = -1, wrapC = null, layT = -9;
  function stageRect() {
    if (!rectC) { rectC = cv.getBoundingClientRect(); rectT = time; }
    return rectC;
  }
  St.rect = () => (cv ? stageRect() : null);
  St.wrapRect = () => { if (!cv) return null; if (!wrapC) wrapC = cv.parentElement.getBoundingClientRect(); return wrapC; };
  St.invalidateRect = () => { rectC = null; wrapC = null; layT = -9; };
  St.readLayout = function () {
    if (!cv || (time - layT < 0.5 && time >= layT)) return;
    layT = time;
    rectC = cv.getBoundingClientRect(); rectT = time; wrapC = cv.parentElement.getBoundingClientRect();
    readHud();
  };

  const STAGE_CSS = `
#stagePx { position: absolute; left: 0; top: 0; max-width: none; pointer-events: none; image-rendering: pixelated; transform-origin: 0 0; }
#stage { background: transparent; }
.stFx { position: absolute; inset: 0; pointer-events: none; }
#stageHurt, #stageFlash { opacity: 0; }
#stageFlash { background: #fff; }`;
  St.init = function (canvas) {
    cv = canvas; ctx = cv.getContext('2d');
    if (P0) wrapTextCtx(ctx);
    if (typeof document !== 'undefined') {
      const st = document.createElement('style'); st.textContent = STAGE_CSS; (document.head || document.documentElement).appendChild(st);
      low = document.createElement('canvas'); low.id = 'stagePx'; low.setAttribute('aria-hidden', 'true');
      cv.parentElement.insertBefore(low, cv);
      const mk = id => { const d = document.createElement('div'); d.id = id; d.className = 'stFx'; cv.parentElement.insertBefore(d, cv); return d; };
      fxVig = mk('stageVig'); fxRed = mk('stageHurt'); fxFlash = mk('stageFlash');
      if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => St.invalidateRect()).observe(cv.parentElement);
      window.addEventListener('scroll', St.invalidateRect, true);
    } else low = SPR.makeCanvas(W, H);
    // a CPU canvas: thousands of tiny draws a frame, then the compositor scales it up
    lctx = low.getContext('2d', { willReadFrequently: true }) || low.getContext('2d');
    bindInput();
    listen();
    applyTier(Q.tier, 'boot');
    St.resize();
  };

  St.resize = function () {
    const r = cv.parentElement.getBoundingClientRect();
    DPR = Math.min(2, window.devicePixelRatio || 1);
    TDPR = textDpr();
    const cw = Math.max(200, r.width), ch = Math.max(160, r.height);
    // a wide view of the field: on sharp screens the scale may be a half step (1.5 = 3 device pixels a pixel)
    const step = DPR >= 2 ? 0.5 : 1;
    // (2.4: a wider shot: the field shows about twice the ground it did, so the Horde has room to come from far off)
    S = clamp(Math.floor(Math.min(cw / 420, ch / 310) / step) * step, DPR >= 2 ? 1.5 : 2, 6);
    W = Math.ceil(cw / S); H = Math.ceil(ch / S);
    cv.width = Math.round(cw * TDPR); cv.height = Math.round(ch * TDPR); tFontStr = ''; tState = {};
    cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
    low.width = W; low.height = H;
    if (low.style) { low.style.width = W * S + 'px'; low.style.height = H * S + 'px'; }
    // the vignette as it was drawn on the canvas: a circle from 35% of the short side to 75% of the long one
    if (fxVig) {
      fxVig.style.background = `radial-gradient(circle ${Math.round(Math.max(cw, ch) * 0.75)}px at 50% 55%, rgba(8,6,14,0) ${Math.round(Math.min(cw, ch) * 0.35)}px, rgba(8,6,14,0.62) ${Math.round(Math.max(cw, ch) * 0.75)}px)`;
      fxRed.style.background = `radial-gradient(circle ${Math.round(Math.max(cw, ch) * 0.72)}px at 50% 55%, rgba(255,30,40,0) ${Math.round(Math.min(cw, ch) * 0.3)}px, rgba(255,30,40,1) ${Math.round(Math.max(cw, ch) * 0.72)}px)`;
    }
    dirtyN = 0; wipeAll = true;
    St.invalidateRect();
    geoStamp++;
    bucketsFor(H);
    groundKey = '';
    computeSlots();
    heroKey = '';
    FXK = clamp(2.2 / S, 1, 1.4);
  };

  // ---------- 3.6: the text layer clears only what it drew last frame ----------
  // Every draw on it goes through these wrappers, which note a device-pixel box; the next frame clears
  // just those boxes (or all of it when they add up to a lot).
  let dirty = new Float32Array(1600), dirtyNext = new Float32Array(1600), dirtyN = 0, dirtyNextN = 0, dirtyAll = true, dirtyArea = 0;
  let tK = 1, tOX = 0, tOY = 0, tFont = 8, tFontStr = '', tState = {};
  function markDev(x0, y0, x1, y1) {
    if (dirtyAll) return;
    x0 = Math.floor(x0) - 2; y0 = Math.floor(y0) - 2; x1 = Math.ceil(x1) + 2; y1 = Math.ceil(y1) + 2;
    if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0; if (x1 > cv.width) x1 = cv.width; if (y1 > cv.height) y1 = cv.height;
    if (x1 <= x0 || y1 <= y0) return;
    const n = dirtyNextN;
    // the stroke and the fill of one text land on the same box
    if (n && dirtyNext[n - 4] === x0 && dirtyNext[n - 3] === y0 && dirtyNext[n - 2] === x1 && dirtyNext[n - 1] === y1) return;
    dirtyArea += (x1 - x0) * (y1 - y0);
    if (n >= dirtyNext.length || dirtyArea > cv.width * cv.height * 0.4) { dirtyAll = true; return; }
    dirtyNext[n] = x0; dirtyNext[n + 1] = y0; dirtyNext[n + 2] = x1; dirtyNext[n + 3] = y1; dirtyNextN = n + 4;
  }
  // a box in the current (logical) transform
  function mark(x0, y0, x1, y1) { markDev(x0 * tK + tOX, y0 * tK + tOY, x1 * tK + tOX, y1 * tK + tOY); }
  St._mark = mark;
  function markText(s, x, y) {
    const lw = tState.lineWidth !== undefined ? tState.lineWidth : ctx.lineWidth;
    const len = s.length, f = tFont, pad = (lw || 1) + 1;
    const w = len * f * 1.06 + pad * 2, al = tState.textAlign !== undefined ? tState.textAlign : ctx.textAlign, bl = tState.textBaseline !== undefined ? tState.textBaseline : ctx.textBaseline;
    const xa = al === 'center' ? x - w / 2 : al === 'right' || al === 'end' ? x - w : x - pad;
    const ya = bl === 'middle' ? y - f * 0.75 - pad : bl === 'top' || bl === 'hanging' ? y - pad : bl === 'bottom' || bl === 'ideographic' ? y - f * 1.3 - pad : y - f * 1.15 - pad;
    mark(xa, ya, xa + w, ya + f * 1.5 + pad * 2);
  }
  // 3.6: an outlined text (a strokeText and then the fillText of the same words at the same spot, the pattern
  // every text on this layer uses) is drawn once into a small canvas and stamped from then on: stroking glyphs
  // is the costliest thing this layer did. The wrappers hold a stroke back until they see its fill.
  const txtCache = new Map();
  let txtArea = 0, txtScratch = null, txtSeen = new Set(), txtSeenPrev = new Set();
  function wrapTextCtx(c) {
    const P = CanvasRenderingContext2D.prototype;
    const fontD = Object.getOwnPropertyDescriptor(P, 'font');
    const desc = {};
    let pend = null, xf = 0;
    const xfStack = [];
    const cur = k => (tState[k] !== undefined ? tState[k] : desc[k] ? desc[k].get.call(c) : c[k]);
    function flush() { if (!pend) return; const p = pend; pend = null; markText(p[0], p[1], p[2]); P.strokeText.call(c, p[0], p[1], p[2]); }
    c._flush = flush;
    function sprite(s, x, y) {
      const fill = cur('fillStyle');
      if (typeof fill !== 'string' || fill.charCodeAt(0) !== 35) return false;
      const k = tK, lw = cur('lineWidth'), sst = cur('strokeStyle'), al = cur('textAlign'), bl = cur('textBaseline'), lj = cur('lineJoin');
      const key = s + '\u0001' + tFontStr + '\u0001' + k + '\u0001' + lw + '\u0001' + sst + '\u0001' + fill + '\u0001' + al + bl + lj;
      let sp = txtCache.get(key);
      if (!sp) {
        // (a text is stamped from its second frame on: one that changes every frame is drawn as it is)
        txtSeen.add(key);
        if (!txtSeenPrev.has(key)) return false;
        const m = /^([\d.]+)px(.*)$/.exec(tFontStr);
        if (!m) return false;
        const fd = parseFloat(m[1]) * k, font = fd + 'px' + m[2];
        if (!txtScratch) txtScratch = document.createElement('canvas').getContext('2d');
        txtScratch.font = font;
        const pad = Math.ceil(lw * k / 2) + 2, w = Math.ceil(txtScratch.measureText(s).width) + pad * 2, h = Math.ceil(fd * 1.8) + pad * 2;
        if (txtArea + w * h > 4e6 || txtCache.size > 400) { txtCache.clear(); txtArea = 0; }
        sp = document.createElement('canvas'); sp.width = w; sp.height = h;
        sp.ax = al === 'center' ? Math.round(w / 2) : al === 'right' || al === 'end' ? w - pad : pad;
        sp.ay = bl === 'middle' ? Math.round(h / 2) : bl === 'top' || bl === 'hanging' ? pad : bl === 'bottom' || bl === 'ideographic' ? h - pad : h - pad - Math.ceil(fd * 0.4);
        const g = sp.getContext('2d');
        g.font = font; g.textAlign = al; g.textBaseline = bl; g.lineJoin = lj; g.lineWidth = lw * k; g.strokeStyle = sst;
        g.strokeText(s, sp.ax, sp.ay); g.fillStyle = fill; g.fillText(s, sp.ax, sp.ay);
        txtCache.set(key, sp); txtArea += w * h;
      }
      const dx = x - sp.ax / k, dy = y - sp.ay / k;
      mark(dx, dy, dx + sp.width / k, dy + sp.height / k);
      P.drawImage.call(c, sp, dx, dy, sp.width / k, sp.height / k);
      return true;
    }
    c.setTransform = function (a, b, cc, d, e, f) { flush(); tK = a; tOX = e; tOY = f; return P.setTransform.call(this, a, b, cc, d, e, f); };
    // (setting the same font again is skipped: it is the costliest call on this layer)
    const fs = [];
    if (fontD) Object.defineProperty(c, 'font', { configurable: true, get() { return fontD.get.call(this); }, set(v) { if (v === tFontStr) return; flush(); tFontStr = v; const n = parseFloat(v); if (n > 0) tFont = n; fontD.set.call(this, v); } });
    // the same for the other state the text pass sets over and over (forgotten on save/restore and on a resize);
    // a held-back stroke is drawn before anything it depends on changes (the fill colour is not one of them)
    const ST = ['fillStyle', 'strokeStyle', 'lineWidth', 'textAlign', 'textBaseline', 'lineJoin', 'globalAlpha'];
    for (const k of ST) {
      const d = Object.getOwnPropertyDescriptor(P, k);
      if (!d || !d.set) continue;
      desc[k] = d;
      Object.defineProperty(c, k, { configurable: true, get() { return d.get.call(this); }, set(v) { if (tState[k] === v) return; if (k !== 'fillStyle') flush(); tState[k] = v; d.set.call(this, v); } });
    }
    c.save = function () { flush(); fs.push(tFontStr, tFont); xfStack.push(xf); return P.save.call(this); };
    c.restore = function () { flush(); if (fs.length) { tFont = fs.pop(); tFontStr = fs.pop(); } xf = xfStack.length ? xfStack.pop() : 0; tState = {}; return P.restore.call(this); };
    for (const k of ['translate', 'scale', 'rotate', 'transform']) c[k] = function () { flush(); xf = 1; return P[k].apply(this, arguments); };
    c.fillText = function (s, x, y, mw) {
      s = String(s);
      if (pend && arguments.length < 4 && !xf && pend[0] === s && pend[1] === x && pend[2] === y) { pend = null; if (sprite(s, x, y)) return; markText(s, x, y); P.strokeText.call(this, s, x, y); P.fillText.call(this, s, x, y); return; }
      flush();
      markText(s, x, y); return arguments.length > 3 ? P.fillText.call(this, s, x, y, mw) : P.fillText.call(this, s, x, y);
    };
    c.strokeText = function (s, x, y, mw) {
      s = String(s);
      flush();
      if (arguments.length < 4 && !xf && typeof document !== 'undefined') { pend = [s, x, y]; return; }
      markText(s, x, y); return arguments.length > 3 ? P.strokeText.call(this, s, x, y, mw) : P.strokeText.call(this, s, x, y);
    };
    c.fillRect = function (x, y, w, h) { flush(); mark(Math.min(x, x + w), Math.min(y, y + h), Math.max(x, x + w), Math.max(y, y + h)); return P.fillRect.call(this, x, y, w, h); };
    c.strokeRect = function (x, y, w, h) { flush(); const p = (tState.lineWidth || 1); mark(x - p, y - p, x + w + p, y + h + p); return P.strokeRect.call(this, x, y, w, h); };
    c.drawImage = function (img, a, b, cc, d) {
      flush();
      if (arguments.length === 3) mark(a, b, a + (img.width || 0), b + (img.height || 0));
      else if (arguments.length === 5) mark(a, b, a + cc, b + d);
      else mark(arguments[5], arguments[6], arguments[5] + arguments[7], arguments[6] + arguments[8]);
      return P.drawImage.apply(this, arguments);
    };
    c.measureText = function (t) { return P.measureText.call(this, t); };
  }
  // a text's width in the current font, remembered
  const mwCache = new Map();
  function measureW(str) {
    const key = tFontStr + '\u0001' + str;
    let w = mwCache.get(key);
    if (w === undefined) { if (mwCache.size > 600) mwCache.clear(); w = ctx.measureText(str).width; mwCache.set(key, w); }
    return w;
  }
  // start of the text pass: wipe last frame's boxes
  let wipeAll = true;
  St._wipe = () => { wipeAll = true; };
  function clearText() {
    P0.setTransform.call(ctx, 1, 0, 0, 1, 0, 0); tK = 1; tOX = 0; tOY = 0;
    if (wipeAll) ctx.clearRect(0, 0, cv.width, cv.height);
    else for (let i = 0; i < dirtyN; i += 4) ctx.clearRect(dirty[i], dirty[i + 1], dirty[i + 2] - dirty[i], dirty[i + 3] - dirty[i + 1]);
    dirtyN = 0; dirtyNextN = 0; dirtyAll = false; dirtyArea = 0; wipeAll = false;
  }
  // end of the text pass: what this frame drew is what the next one wipes
  function endText() {
    if (ctx._flush) ctx._flush();
    { const t = txtSeenPrev; txtSeenPrev = txtSeen; txtSeen = t; txtSeen.clear(); }
    const t = dirty; dirty = dirtyNext; dirtyNext = t; dirtyN = dirtyNextN; dirtyNextN = 0;
    if (dirtyAll) wipeAll = true;
    P0.setTransform.call(ctx, 1, 0, 0, 1, 0, 0); tK = 1; tOX = 0; tOY = 0;
  }
  const P0 = typeof CanvasRenderingContext2D !== 'undefined' ? CanvasRenderingContext2D.prototype : null;

  // the CSS layers: the vignette (off in town), the red edge and the flash; written only when they change
  function setFx(red, fl) {
    if (!fxVig) return;
    const vOn = !G.R.town;
    if (vOn !== vigOn) { vigOn = vOn; fxVig.style.display = vOn ? '' : 'none'; }
    const r = red > 0.01 ? Math.round(red * 100) / 100 : 0;
    if (r !== fxRedA) { fxRedA = r; fxRed.style.opacity = r; }
    const f = fl > 0.005 ? Math.round(Math.min(0.85, fl) * 100) / 100 : 0;
    if (f !== fxFlashA) { fxFlashA = f; fxFlash.style.opacity = f; }
    if (f > 0 && flashCol !== fxFlashCol) { fxFlashCol = flashCol; fxFlash.style.background = flashCol; }
  }
  // the shake moves the pixel layer (a compositor transform); the text layer draws itself offset
  function setShift(ox, oy) {
    if (!low.style) return;
    const k = ox || oy ? 'translate(' + ox * S + 'px,' + oy * S + 'px)' : '';
    if (k !== pxShift) { pxShift = k; low.style.transform = k; }
  }

  // 3.6: where the HUD sits over the field (logical px), read at most twice a second: names and plates keep clear of it
  let hudBoxes = [], hudRead = false;
  const HUD_SEL = ['.hud.top .realm', '.hud.top .hudBtns', '.hud.bottom', '#toasts'];
  function hudBoxesNow() { if (!hudRead) readHud(); return hudBoxes; }
  function readHud() {
    hudRead = true; hudBoxes = [];
    if (typeof document === 'undefined' || !cv) return hudBoxes;
    const hb = document.querySelector('.hud.bottom'); hudBottomH = hb ? hb.offsetHeight : 90;
    const el = document.querySelector('.hud.top .hudBtns'), c = stageRect();
    townTop = el ? Math.max(0, (el.getBoundingClientRect().bottom - c.top) / S) : 20;
    for (const sel of HUD_SEL) {
      const el = document.querySelector(sel);
      if (!el || el.hidden || !el.offsetParent) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (sel === '#toasts' && !el.children.length) continue;
      hudBoxes.push({ x0: (r.left - c.left) / S, y0: (r.top - c.top) / S, x1: (r.right - c.left) / S, y1: (r.bottom - c.top) / S, sel });
    }
    return hudBoxes;
  }
  St.hudBoxes = hudBoxesNow;
  // is a box (logical) on the free field, clear of the HUD?
  function onFree(x0, y0, x1, y1) {
    const hb = hudBoxesNow();
    for (let i = 0; i < hb.length; i++) { const b = hb[i]; if (x0 < b.x1 && x1 > b.x0 && y0 < b.y1 && y1 > b.y0) return false; }
    return true;
  }
  St.onFree = onFree;

  // ---------- Layout ----------
  function btnPos() { return { x: Math.round(W / 2), y: Math.round(H * 0.54) }; }
  St.btnPos = btnPos;
  function computeSlots() {
    const b = btnPos();
    slots = [];
    const rings = [
      { n: 8, rx: Math.min(W * 0.25, 62), ry: Math.min(H * 0.27, 44), off: Math.PI / 8 },
      { n: 10, rx: Math.min(W * 0.41, 104), ry: Math.min(H * 0.39, 64), off: 0 },
    ];
    for (const ring of rings) {
      for (let i = 0; i < ring.n; i++) {
        const a = ring.off + (i / ring.n) * Math.PI * 2;
        slots.push({ x: Math.round(b.x + Math.cos(a) * ring.rx), y: Math.round(b.y + Math.sin(a) * ring.ry + 4) });
      }
    }
    // Keep slots on-screen and clear of the top HUD strip
    slots.forEach(s => { s.x = clamp(s.x, 10, W - 10); s.y = clamp(s.y, 22, H - 10); });
    // Re-seat existing chests
    // (field chests find a new spot on the new field rather than piling on its edge)
    for (const [, v] of vis) { const s = slots[v.slot]; if (s) { v.x = s.x; v.y = s.y; } else if (v.slot < 0) Object.assign(v, fieldSpot()); }
  }
  // Keep ground loot clear of the HUD strips
  function onField(x, y) { return { x: Math.round(clamp(x, 10, W - 10)), y: Math.round(clamp(y, 26, H - Math.ceil(66 / S))) }; }
  function freeSlot() {
    const used = new Set(); for (const [, v] of vis) used.add(v.slot);
    const n = Math.min(slots.length, G.D.slots || 6);
    for (let i = 0; i < n; i++) if (!used.has(i)) return i;
    return -1;
  }
  // a spot on the open field for a chest that has no slot by the Button: anywhere round it, clear of the middle
  function fieldSpot() {
    const b = btnPos();
    const a = rand(0, Math.PI * 2), k = Math.sqrt(rand(0.18, 0.9));
    return inField(b.x + Math.cos(a) * W * 0.44 * k, b.y + Math.sin(a) * H * 0.38 * k + 6);
  }
  // chests keep inside an oval round the Button, not in heaps along the edges of the screen,
  // and off the Button itself, so a tap on it is always a click
  function inField(x, y) {
    const b = btnPos(), rx = W * 0.44, ry = H * 0.38;
    let dx = x - b.x, dy = y - b.y - 6;
    if (!dx && !dy) dx = 1;
    const r = Math.hypot(dx / rx, dy / ry);
    if (r > 1) { const k = rand(0.8, 0.98) / r; dx *= k; dy *= k; }
    else if (r < 0.42) { const k = rand(0.42, 0.5) / Math.max(1e-6, r); dx *= k; dy *= k; }
    return onField(b.x + dx, b.y + 6 + dy);
  }
  function visFor(c) {
    let v = vis.get(c.id);
    if (!v) {
      const slot = freeSlot(), s = slot >= 0 ? slots[slot] : fieldSpot();
      v = { slot, x: s.x, y: s.y, t: 0, drop: 1, hit: 0 };
      vis.set(c.id, v);
    }
    return v;
  }
  // with a crowd of chests the field ones shrink to little ones
  const miniChest = (v, c) => (c && c.small) || (v.slot < 0 && G.S.chests.length > 12);
  const chestSpr = (c, v) => SPR.get((c.bag ? 'bag_' : miniChest(v, c) && SPR.defs['chestm_' + c.tier] ? 'chestm_' : 'chest_') + c.tier);
  St.chestScreen = function (c) { const v = vis.get(c.id); return v ? { x: v.x * S, y: v.y * S } : null; };
  // Logical stage point -> viewport pixels (for the tutorial pointer)
  St.toScreen = function (x, y) { const r = stageRect(); return { x: r.left + x * S, y: r.top + y * S }; };
  St.scale = () => S;
  St.size = () => ({ W, H, S, dpr: TDPR });
  St.chestPoint = function (c) { const v = vis.get(c.id); return v ? St.toScreen(v.x, v.y - 12) : null; };
  St.mobPoint = function (m) { const q = mobPos(m); return St.toScreen(q.x, q.y - 18); };
  St.wispPoint = function () { return St._wispPos ? St.toScreen(St._wispPos.x, St._wispPos.y - 10) : null; };
  St.buttonPoint = function () { const b = btnPos(); return St.toScreen(b.x, b.y - 24); };

  // ---------- Particles & text ----------
  // 3.6: particles come from a pool and leave by swapping with the last (no shift/splice on big arrays);
  // the quality tier sets how many are made and how many may live at once
  const pPool = [];
  let pOver = 0;
  function stepDrawParts(vdt) {
    let i = parts.length, lastCol = null;
    while (i-- > 0) {
      const p = parts[i]; p.life -= vdt;
      if (p.life <= 0) { const l = parts.pop(); if (i < parts.length) parts[i] = l; pPool.push(p); continue; }
      p.vy += p.grav * vdt; p.x += p.vx * vdt; p.y += p.vy * vdt;
      lctx.globalAlpha = Math.min(1, p.life / p.max * 1.6);
      if (p.col !== lastCol) { lastCol = p.col; lctx.fillStyle = lastCol; }
      if (p.plus) { const x = Math.round(p.x), y = Math.round(p.y); lctx.fillRect(x - 1, y, 3, 1); lctx.fillRect(x, y - 1, 1, 3); }
      else lctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    lctx.globalAlpha = 1;
  }
  function newPart(x, y, col) {
    // (Settings → Reduce effects and the light tiers make fewer)
    if (Q.particles < 1 && Math.random() > Q.particles) return null;
    let p;
    if (parts.length >= Q.maxP) { p = parts[pOver = (pOver + 1) % parts.length]; }
    else { p = pPool.pop() || {}; parts.push(p); }
    p.x = x; p.y = y; p.col = col; p.size = 1; p.grav = 120; p.plus = false;
    return p;
  }
  function partSet(p, o) {
    if (!o) return;
    if (o.vx !== undefined) p.vx = o.vx; if (o.vy !== undefined) p.vy = o.vy; if (o.life !== undefined) p.life = o.life;
    if (o.size !== undefined) p.size = o.size; if (o.grav !== undefined) p.grav = o.grav; if (o.plus !== undefined) p.plus = o.plus;
    if (o.col !== undefined) p.col = o.col;
  }
  function part(x, y, col, o) {
    const p = newPart(x, y, col); if (!p) return;
    p.vx = rand(-40, 40); p.vy = rand(-70, -20); p.life = rand(0.4, 0.9);
    partSet(p, o);
    p.max = p.life;
  }
  function burst(x, y, col, n, speed, o) {
    const arr = Array.isArray(col);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = rand(speed * 0.4, speed);
      const p = newPart(x, y, arr ? pick(col) : col); if (!p) continue;
      p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s - 20; p.life = rand(0.4, 0.9);
      partSet(p, o);
      p.max = p.life;
    }
  }
  // 3.6: floating texts are capped (fewer on a phone); a new one pushes out the oldest small one, and
  // small damage numbers past their own cap are dropped rather than piled up
  function text(x, y, str, col, size, o) {
    const big = !!(o && (o.big || o.card || o.callout));
    if (!big && o && o.dmg) {
      let n = 0; for (let i = 0; i < texts.length; i++) if (texts[i].dmg) n++;
      if (n >= Q.dmgCap) { const i = texts.findIndex(q => q.dmg); if (i >= 0 && texts[i].max - texts[i].life > 0.25) texts.splice(i, 1); else return null; }
    }
    if (texts.length >= Q.textCap) {
      let i = texts.findIndex(q => !q.big && !q.card);
      if (i < 0 && !big) return null;
      if (i < 0) i = texts.findIndex(q => !q.card);
      if (i < 0) return null;
      texts.splice(i, 1);
    }
    const t = Object.assign({ x, y, str, col, size: size || 5, vy: -22, life: 1.1, max: 1.1, pop: 0.12 }, o || {});
    texts.push(t);
    return t;
  }
  St.text = text;
  St.shake = v => { if (G.S.set.shake) shake = Math.max(shake, v); };
  St.flash = (v, c) => { flash = Math.max(flash, v); flashCol = c || '#ffffff'; };

  function rarityCol(r) { return G.RARITIES[r].color; }
  // Title cards sit under the HUD: lower on narrow screens, where the HUD takes more room
  const cardY = k => Math.round(H * (W * S < 600 ? k + 0.1 : k));
  // Title cards take turns: each card's lines appear together, the next card when this one is done.
  // 3.6: three priorities: 0 (a streak callout) only on a quiet screen, 1 (a land, a zone, a shrine...) waits its
  // turn, 2 (a boss's phase, an event, a wipe) cuts in. At most three wait; the low ones go first.
  const cardQ = [];
  let cardT = 0;
  let lastCard = null;
  const CARD_MAX = 3;
  const cardBlock = { y1: 0, until: -1 };
  const dirQuiet = () => { try { return !!(G.director && G.director.quiet && G.director.quiet()); } catch (e) { return false; } };
  function cardText(off, str, col, size, o) {
    o = o || {};
    let g = lastCard;
    // (a card whose first line is not at the top (a new kind, its two lines) starts its own card when the last
    // one has a line there already, rather than landing on top of it)
    const clash = g && !g.shown && !g.dropped && off !== 0 && g.items.some(it => Math.abs(it.off - off) < 7);
    if (off === 0 || !g || g.shown || clash || o.own || (g.dropped && g.at !== time)) {
      const prio = o.prio != null ? o.prio : o.now ? 2 : o.callout ? 0 : 1;
      if (prio === 0 && (cardT > 0 || cardQ.length || dirQuiet())) { lastCard = { dropped: true, at: time, items: [] }; return; }
      g = { items: [], life: 0, callout: prio === 0, prio, age: 0, tag: o.tag, at: time };
      if (prio >= 1) for (let i = cardQ.length - 1; i >= 0; i--) if (cardQ[i].prio === 0) cardQ.splice(i, 1);
      // an urgent card (a boss changing phase) cuts in front and replaces whatever is up
      if (o.now) { cardQ.unshift(g); cardT = 0; for (let i = texts.length - 1; i >= 0; i--) if (texts[i].card) texts.splice(i, 1); }
      else cardQ.push(g);
      lastCard = g;
    }
    if (g.dropped) return;
    g.items.push({ off, str, col, size, o });
    g.life = Math.max(g.life, o.life || 1.1);
    while (cardQ.length > CARD_MAX) {
      let i = cardQ.findIndex(x => x.prio === 0);
      if (i < 0) i = cardQ.findIndex(x => x.prio < 2 && x !== g);
      cardQ.splice(i >= 0 ? i : 0, 1);
    }
  }
  function stepCards(dt) {
    for (const g of cardQ) g.age += dt;
    if (cardT > 0) { cardT -= dt; return; }
    while (cardQ.length && cardQ[0].callout && (cardQ[0].age > 1 || jp || dirQuiet())) cardQ.shift();
    const g = cardQ.shift();
    if (!g) return;
    g.shown = true;
    const life = g.life * (g.prio >= 2 ? 1 : 0.85);
    // in a boss fight the card goes over the boss's head, under its bar (smaller on a phone), never on the boss
    let y0 = cardY(0.27), sc = 1;
    if (bossVis && G.R.boss) {
      sc = W * S < 600 ? 0.75 : 0.85;
      let maxOff = 0, lastSz = 4; for (const it of g.items) if (it.off >= maxOff) { maxOff = it.off; lastSz = it.size; }
      const top = (barBottom || Math.ceil(50 / S) + 14) + g.items[0].size * sc * 0.7 + 2;
      y0 = Math.round(clamp(bossTop() - 4 - maxOff * sc - lastSz * sc * 0.6, top, cardY(0.27)));
      cardBlock.y1 = y0 + maxOff * sc + lastSz * sc * 0.6; cardBlock.until = time + life;
    }
    for (const it of g.items) text(W / 2, y0 + it.off * sc, it.str, it.col, it.size * sc, Object.assign({}, it.o, { life, max: life, card: true }));
    cardT = life * 0.75;
    if (g.tag === 'land' && G.director && G.director.mark) { try { G.director.mark('card', life); } catch (e) { /* optional */ } }
  }
  St.cardBusy = () => cardT > 0;

  // ---------- Events ----------
  function listen() {
    G.on('click', ev => {
      const b = bossVis ? bossPos() : btnPos();
      btnPress = 0.09;
      btnSpring.v -= ev.crit || ev.mega ? 0.3 : 0.17; kick = 1;
      if (ev.crit || ev.mega) { hitstop = Math.max(hitstop, 0.03); btnFlashT = 0.08; }
      const x = b.x + rand(-16, 16), y = b.y - 14 - rand(0, 8);
      const combo = ev.combo;
      const col = ev.mega ? '#7fe9ff' : ev.crit ? '#ff7a2e' : combo >= 150 ? '#ff7ae6' : combo >= 60 ? '#ffe27a' : '#ffffff';
      const size = ev.mega ? 9 : ev.crit ? 7 : 5;
      const live = clickTxt && clickTxt.life > 0 && texts.includes(clickTxt) && clickTxt.max - clickTxt.life < 0.35;
      if (!ev.crit && !ev.mega && live) {
        clickTxt.sum += ev.gain; clickTxt.str = '+' + fmtSmall(clickTxt.sum); clickTxt.col = col; clickTxt.fitW = null;
        clickTxt.life = clickTxt.max = 0.8; clickTxt.pop = 0.12; clickTxt.size = Math.min(8, 5 + Math.log10(1 + clickTxt.n++));
      } else {
        const t = text(x, y, '+' + fmtSmall(ev.gain), col, size, ev.crit || ev.mega ? { life: 1.1, max: 1.1, big: true } : { life: 0.8, max: 0.8, dmg: true });
        if (!ev.crit && !ev.mega && t) { clickTxt = t; clickTxt.sum = ev.gain; clickTxt.n = 1; }
      }
      ring(b.x, b.y - 2, 22, 8, ev.crit ? '#ff7a2e' : '#ffffff', 0.16);
      // combo tiers: a quarter, half and full of the cap each announce themselves once
      const cap = G.D.comboCap || 50, tier = combo >= cap ? 3 : combo >= cap / 2 ? 2 : combo >= cap / 4 ? 1 : 0;
      if (tier > comboTier) { text(b.x, b.y - 46, tier === 3 ? G.t('overcharged') : G.t('comboUp', (1 + combo * G.D.comboPer).toFixed(2)), tier === 3 ? '#ff7ae6' : '#ffe27a', tier === 3 ? 6 : 4, { life: 1.2, max: 1.2, vy: -14, big: true }); ring(b.x, b.y - 4, 40, 20, tier === 3 ? '#ff7ae6' : '#ffe27a', 0.4); if (G.Audio && G.Audio.comboUp) G.Audio.comboUp(tier); }
      comboTier = tier;
      if (ev.crit) { if (critWord()) text(x, y - 9, G.t('crit'), '#ff4f4f', 5, { vy: -30, life: 0.8, max: 0.8, dmg: true }); St.shake(2); }
      if (ev.mega) { text(x, y - 12, 'MEGA ×30', '#7fe9ff', 7, { vy: -30, life: 1.5, max: 1.5 }); St.shake(5); St.flash(0.25, '#7fe9ff'); }
      const n = ev.crit ? 10 : 4;
      burst(b.x, b.y - 4, ['#ffd84a', '#ffe27a', '#c98f10'], n, 70, { size: rand(1, 2) | 0 || 1 });
      if (bossVis) { bossHitT = 0.07; burst(b.x + rand(-8, 8), b.y - rand(0, 12), '#ffffff', 3, 50); }
      if (pointer.over && ev.x != null) burst(ev.x, ev.y, '#ffffff', 2, 30, { life: 0.25 });
    });
    G.on('autoClicks', (n) => {
      // pets fire sparkles at the target
      const tgt = bossVis ? bossPos() : btnPos();
      const pets = G.S.active;
      for (let i = 0; i < Math.min(n, 3); i++) {
        if (!pets.length) break;
        const pp = petPos(i % pets.length);
        shots.push({ x: pp.x, y: pp.y, sx: pp.x, sy: pp.y, tx: tgt.x + rand(-4, 4), ty: tgt.y - 6, t: 0, dur: 0.25, col: '#fff3a0' });
      }
    });
    G.on('chestSpawn', (c, fromBoss) => {
      // Loot from a mob pops out of its body in an arc and lands where it fell
      const src = G.R.dropAt;
      if (G.R.rain) {
        const land = fieldSpot();
        vis.set(c.id, { slot: -1, x: land.x, y: land.y, t: 0, drop: 0, hit: 0, arc: { sx: land.x + rand(-30, 30), sy: -30, t: 0, dur: rand(0.55, 0.85) } });
        return;
      }
      if (src) {
        const q = mobPos(src);
        const land = inField(q.x + rand(-10, 10), q.y + rand(-2, 6));
        vis.set(c.id, { slot: -1, x: land.x, y: land.y, t: 0, drop: 0, hit: 0, arc: { sx: q.x, sy: q.y - 8, t: 0, dur: 0.5 } });
        return;
      }
      const v = visFor(c);
      v.drop = 1; v.t = 0;
      if (c.tier >= 3 && G.S.chests.length < 60) beams.push({ x: v.x, y: v.y, col: rarityCol(c.tier), life: 0.8, max: 0.8, w: 3 });
    });
    G.on('merge', (partsC, nc) => {
      const pts = partsC.map(c => vis.get(c.id)).filter(Boolean);
      const v = visFor(nc);
      for (const p of pts) {
        flyers.push({ x: p.x, y: p.y, tx: v.x, ty: v.y, t: 0, dur: 0.3, spr: 'chest_' + Math.max(0, nc.tier - 1) });
      }
      partsC.forEach(c => vis.delete(c.id));
      v.drop = 0; v.pop = 0.35;
      burst(v.x, v.y - 4, [rarityCol(nc.tier), '#ffffff'], 14, 60);
      text(v.x, v.y - 12, G.t('fusion'), rarityCol(nc.tier), 4);
    });
    G.on('chestOpen', loot => {
      const c = loot.chest;
      let v = vis.get(c.id);
      let x, y;
      if (v) { x = v.x; y = v.y; vis.delete(c.id); }
      else if (loot.source === 'boss' && bossVis) { const b = bossPos(); x = b.x + rand(-20, 20); y = b.y + rand(-4, 10); }
      else { const b = btnPos(); x = b.x + rand(-30, 30); y = b.y + rand(10, 25); }
      if (loot.source === 'offline') return;
      const top = loot.items.length ? loot.items.reduce((a, b) => (b.it.r > a.it.r ? b : a), loot.items[0]) : null;
      const r = top ? top.it.r : 0;
      // a little chest of coin: a pop and the gold
      if (!top) { burst(x, y - 4, ['#ffd84a', '#fff3a0', rarityCol(c.tier)], 5, 45, { life: 0.35 }); openHeat += 1; killGold += loot.gold; if (killGoldT <= 0) killGoldT = 0.3; if (coins.length < 200) coins.push({ x, y: y - 6, vx: rand(-30, 30), vy: rand(-80, -40), floor: y + rand(-2, 3), t: rand(0.35, 0.6), fly: 0 }); return; }
      // many at once (Looters, Plunder, a full field): a pop and the gold, the good ones still in full
      openHeat += 1;
      if (openHeat > 6 && r < 3 && !c.mod) {
        burst(x, y - 4, [rarityCol(c.tier), '#ffd84a'], 3, 40, { life: 0.3 });
        killGold += loot.gold; if (killGoldT <= 0) killGoldT = 0.3;
        return;
      }
      opening.push({ x, y, tier: c.tier, t: 0, dur: 0.35, bag: c.bag });
      burst(x, y - 5, [rarityCol(r), '#ffffff', rarityCol(c.tier)], 8 + r * 4, 55 + r * 10);
      if (r >= 3) beams.push({ x, y, col: rarityCol(r), life: 1.2 + r * 0.2, max: 1.2 + r * 0.2, w: r >= 5 ? 7 : 5 });
      // Item icons pop up
      loot.items.slice(0, 5).forEach((li, i) => {
        flyers.push({ x: x + (i - (Math.min(5, loot.items.length) - 1) / 2) * 9, y: y - 8, vy: -26, t: 0, dur: 1.1, spr: 'it_' + li.it.id, float: true, r: li.it.r });
      });
      killGold += loot.gold; if (killGoldT <= 0) killGoldT = 0.3;
      if (r >= 3) text(x, y - 22, G.L(top.it.name), rarityCol(r), 4, { vy: -12, life: 1.6, max: 1.6 });
      if (loot.pots.length) text(x, y - 30, G.t('potionGot'), '#ff7ae6', 4, { vy: -10, life: 1.6, max: 1.6 });
      if (r >= 5) { St.shake(4); St.flash(r === 6 ? 0.7 : 0.35, rarityCol(r)); }
      if (c.mod === 'golden') burst(x, y - 4, ['#ffd84a', '#fff3a0'], 30, 90);
      if (c.mod === 'void') burst(x, y - 4, ['#8a4dff', '#3a2266', '#e0d0ff'], 20, 50);
    });
    G.on('lightning', (c, targets) => {
      const v0 = vis.get(c.id); if (!v0) return;
      for (const t of targets) {
        const v = vis.get(t.id); if (!v) continue;
        const pts = [[v0.x, v0.y - 5]];
        for (let i = 1; i < 6; i++) pts.push([v0.x + (v.x - v0.x) * i / 6 + rand(-5, 5), v0.y - 5 + (v.y - v0.y) * i / 6 + rand(-5, 5)]);
        pts.push([v.x, v.y - 5]);
        bolts.push({ pts, life: 0.35 });
      }
      St.flash(0.15, '#7fe9ff');
    });
    G.on('chestHit', c => { const v = vis.get(c.id); if (v) { v.hit = 0.12; burst(v.x, v.y - 5, c.mod === 'frozen' ? ['#bfe8ff', '#ffffff'] : ['#ff4f4f', '#ffffff'], 5, 40); } });
    G.on('mimicWake', c => { const v = vis.get(c.id); if (v) { v.hit = 0.3; text(v.x, v.y - 14, G.t('mimic'), '#ff4f4f', 5); St.shake(3); } });
    G.on('mimicFlee', c => { const v = vis.get(c.id); if (v) { burst(v.x, v.y, '#9a9aa8', 10, 40); text(v.x, v.y - 10, G.t('fled'), '#9a9aa8', 4); } vis.delete(c.id); });
    G.on('burn', (c, g) => { const v = vis.get(c.id); if (v) { burst(v.x, v.y, ['#ff7a2e', '#ffd84a', '#3a3a44'], 16, 50); text(v.x, v.y - 10, G.t('burned'), '#ff7a2e', 4); } vis.delete(c.id); });
    G.on('spill', (tier, g) => { if (g < 1) return; const b = btnPos(); text(b.x + rand(-40, 40), b.y + 30, G.t('noRoom') + ' +' + G.fmt(g), '#c8c8d4', 3, { vy: -10 }); });
    G.on('golem', (c, i) => {
      const v = vis.get(c.id); if (!v) return;
      const L = i != null ? lootVis[i] : null;
      if (L) { L.lift = 0.25; L.x = v.x - 5 * L.face; L.y = v.y + 1; burst(v.x, v.y - 6, ['#ffd84a', '#7fe9ff'], 4, 40, { life: 0.3 }); return; }
      const b = btnPos();
      shots.push({ x: b.x, y: b.y + 14, sx: b.x, sy: b.y + 14, tx: v.x, ty: v.y - 4, t: 0, dur: 0.18, col: '#ffd84a', key: true });
    });
    G.on('plunder', (m, c) => {
      const v = vis.get(c.id); if (!v) return;
      const q = mobPos(m);
      shots.push({ x: q.x, y: q.y - 6, sx: q.x, sy: q.y - 6, tx: v.x, ty: v.y - 4, t: 0, dur: 0.22, col: '#ffd84a' });
    });
    G.on('heroAttack', onHeroAttack);
    G.on('mobDie', onMobDie);
    G.on('mobFlee', m => { const q = mobPos(m); burst(q.x, q.y - 6, '#6e6e7c', 6, 30); mobVis.delete(m.id); });
    G.on('mobBite', m => {
      btnHurtT = 0.15; mobVisOf(m).lunge = 0.12;
      const b = btnPos(); burst(b.x + rand(-14, 14), b.y - 4, ['#ff4f4f', '#ffffff'], m.kind === 'fodder' ? 1 : 3, 40);
    });
    G.on('surge', () => {
      cardText(0, G.t('surge'), '#ff4f4f', 7, { life: 2, max: 2, vy: -4, big: true });
      St.shake(3); St.flash(0.18, '#ff3b3b');
    });
    G.on('rareSpawn', () => cardText(0, G.t('rareComing'), '#ffd84a', 5, { life: 1.8, max: 1.8, vy: -4, big: true }));
    G.on('buttonBreak', () => {
      const b = btnPos();
      St.shake(6); St.flash(0.5, '#ff3b3b');
      burst(b.x, b.y - 6, ['#ff4f4f', '#ffd84a', '#3a3a44'], 40, 110);
      text(b.x, b.y - 30, G.t('btnBroken'), '#ff4f4f', 5, { life: 1.8, max: 1.8, vy: -10 });
      cardText(0, G.t('btnBrokenCard'), '#ff4f4f', 6, { life: 2.2, vy: -3, big: true });
      cardText(9, G.t('btnBrokenSub', G.TUNE.btnDown), '#ffffff', 3, { life: 2.2, vy: -3 });
    });
    partyListen();
    G.on('rankUp', x => {
      const hp = heroPos();
      text(hp.x, hp.y - 46, G.t('rankUp'), '#ffd84a', 6, { life: 2.2, max: 2.2, vy: -10, big: true });
      ring(hp.x, hp.y - 4, 44, 22, '#ffd84a', 0.8); St.flash(0.25, '#ffd84a'); St.shake(2);
    });
    G.on('levelUp', lvl => {
      const hp = heroPos();
      hitstop = Math.max(hitstop, 0.06);
      for (const g of gems) g.t = Math.min(g.t, 0); // every crystal on the field flies in
      burst(hp.x, hp.y - 12, ['#a8dcff', '#ffffff', '#4f8cff', '#ffe27a'], 34, 80);
      ring(hp.x, hp.y - 4, 26, 12, '#a8dcff', 0.5); ring(hp.x, hp.y - 4, 16, 8, '#ffffff', 0.35);
      beams.push({ x: hp.x, y: hp.y, col: '#a8dcff', life: 0.9, max: 0.9, w: 9 });
      text(hp.x, hp.y - 32, G.t('levelUp', lvl), '#a8dcff', 5, { life: 1.6, max: 1.6, vy: -14, big: true });
      St.flash(0.18, '#a8dcff');
      if (G.Audio && G.Audio.levelUp) G.Audio.levelUp();
    });
    G.on('perk', id => {
      const hp = heroPos();
      burst(hp.x, hp.y - 12, ['#ffe27a', '#ffffff'], 20, 60);
      text(hp.x, hp.y - 32, G.PERKS[id].name, '#ffe27a', 4, { life: 1.4, max: 1.4, vy: -12 });
    });
    G.on('evolve', () => {
      const hp = heroPos();
      burst(hp.x, hp.y - 12, ['#ffd84a', '#ffffff', '#ff7a2e'], 60, 110);
      ring(hp.x, hp.y - 4, 40, 20, '#ffd84a', 0.7); ring(hp.x, hp.y - 4, 26, 13, '#ffffff', 0.5);
      beams.push({ x: hp.x, y: hp.y, col: '#ffd84a', life: 1.6, max: 1.6, w: 11 });
      St.shake(5); St.flash(0.35, '#ffd84a'); slowmo = 0.5;
    });
    G.on('journey', () => { const hp = heroPos(); burst(hp.x, hp.y - 20, ['#ffd84a', '#fff3a0'], 24, 70); });
    G.on('bladeHit', m => { const q = mobPos(m); mobVisOf(m).hit = 0.08; burst(q.x, q.y - 5, ['#e6ebf2', '#ffffff'], 3, 40, { life: 0.2 }); });
    G.on('auraTick', list => { for (const m of list) mobVisOf(m).hit = Math.max(mobVisOf(m).hit, 0.04); if (list.length) { const m = list[Math.floor(Math.random() * list.length)], q = mobPos(m); part(q.x + rand(-3, 3), q.y - 4, pick(['#ffe27a', '#fff3a0']), { vx: 0, vy: -20, grav: 0, life: 0.4 }); } });
    G.on('nova', rad => {
      const b = btnPos(), r = aoePx(rad || 0.5);
      ring(b.x, b.y - 4, r.rx, r.ry, '#fff3a0', 0.45); ring(b.x, b.y - 4, r.rx * 0.7, r.ry * 0.7, '#ffffff', 0.3);
      St.shake(2); St.flash(0.12, '#fff3a0');
    });
    // 3.0 perks: fire, frost, executions, bounces and blasts
    {
      const zapTo = (a, q, cols) => { const pts = [[a.x, a.y - 6]]; for (let i = 1; i < 3; i++) pts.push([a.x + (q.x - a.x) * i / 3 + rand(-3, 3), a.y - 6 + (q.y - a.y) * i / 3 + rand(-3, 3)]); pts.push([q.x, q.y - 6]); bolts.push({ pts, life: 0.12, cols }); };
      const lim = { t: 0, n: 0 }, room = () => { if (time - lim.t > 0.1) { lim.t = time; lim.n = 0; } return ++lim.n < 14; };
      G.on('pkBurn', m => { if (!room()) return; const q = mobPos(m); part(q.x + rand(-2, 2), q.y - 6, pick(['#ff7a2e', '#ffd84a', '#ff3b3b']), { vx: rand(-6, 6), vy: -rand(10, 22), grav: -10, life: 0.4 }); });
      G.on('pkChill', m => { if (!room()) return; const q = mobPos(m); part(q.x + rand(-3, 3), q.y - 6, pick(['#bfe8ff', '#ffffff', '#7fc8ff']), { vx: rand(-8, 8), vy: -rand(4, 10), grav: 10, life: 0.4 }); });
      G.on('pkSpread', (a, b) => { if (room()) zapTo(mobPos(a), mobPos(b), ['#ff7a2e', '#ffd84a']); });
      G.on('pkBounce', (a, b) => { if (room()) zapTo(mobPos(a), mobPos(b), ['#ffffff', '#c8d0ff']); });
      G.on('pkSpill', (a, b) => { if (room()) zapTo(mobPos(a), mobPos(b), ['#ff5a4a', '#ffffff']); });
      G.on('pkExecute', m => { const q = mobPos(m); text(q.x, q.y - 16, '✕', '#ff3b3b', 5, { life: 0.6, vy: -14 }); burst(q.x, q.y - 6, ['#ff3b3b', '#ffffff'], 10, 70, { life: 0.3 }); });
      G.on('pkMark', m => { const q = mobPos(m); ring(q.x, q.y - 4, 8, 4, '#ff5a7a', 0.4); });
      G.on('pkCorpse', (m, r) => { if (!room()) return; const q = mobPos(m); ring(q.x, q.y - 4, 14 + (r || 0) * 6, 7 + (r || 0) * 3, '#b6ff5a', 0.35); burst(q.x, q.y - 6, ['#b6ff5a', '#5a8a2a', '#ffffff'], 8, 80, { life: 0.35 }); });
      G.on('pkCrush', (m, boss) => { const q = m ? mobPos(m) : { x: btnPos().x, y: btnPos().y - 30 }; text(q.x, q.y - 18, G.t('pkCrushTxt'), '#ffd84a', boss ? 6 : 5, { life: 0.8, vy: -16 }); burst(q.x, q.y - 6, ['#ffd84a', '#ffffff'], 14, 100, { life: 0.35 }); St.shake(boss ? 3 : 1.5); });
      G.on('pkThorns', m => { if (!room()) return; const q = mobPos(m); burst(q.x, q.y - 6, ['#9a6a3a', '#ffffff'], 5, 50, { life: 0.25 }); });
      G.on('pkAegis', up => { const b = btnPos(); ring(b.x, b.y - 4, up ? 34 : 26, up ? 17 : 13, up ? '#7ab8ff' : '#ffffff', up ? 0.6 : 0.3); });
      G.on('pkSecondWind', () => { const b = btnPos(); text(b.x, b.y - 40, G.t('pkWindTxt'), '#8ae07a', 6, { life: 1.6, vy: -12 }); ring(b.x, b.y - 4, 50, 25, '#8ae07a', 0.8); St.flash(0.2, '#8ae07a'); });
      G.on('pkSouls', () => { const b = btnPos(); ring(b.x, b.y - 4, 40, 20, '#c88aff', 0.5); });
      G.on('pkCoins', m => { if (!room()) return; const q = mobPos(m); burst(q.x, q.y - 6, ['#ffd84a', '#ffe27a'], 8, 70, { life: 0.4 }); });
    }
    G.on('chain', (from, list) => {
      const a = mobPos(from);
      for (const m of list) {
        const q = mobPos(m), pts = [[a.x, a.y - 6]];
        for (let i = 1; i < 4; i++) pts.push([a.x + (q.x - a.x) * i / 4 + rand(-4, 4), a.y - 6 + (q.y - a.y) * i / 4 + rand(-4, 4)]);
        pts.push([q.x, q.y - 6]);
        bolts.push({ pts, life: 0.15 });
      }
    });
    G.on('ability', type => {
      hero.cast = 0.35;
      const b = btnPos(), hp = heroPos();
      const cfg = { potion: ['#ff4f7e', '#ffc0cc'], tome: ['#56d45a', '#d8ffd0'], scroll: ['#ffd84a', '#fff3a0'], skull: ['#b36bff', '#ffffff'], orb: ['#7fe9ff', '#ffffff'], wing: ['#ffffff', '#bfe8ff'], egg: ['#ffe27a', '#ffffff'] }[type] || ['#ffffff'];
      if (type === 'skull' || type === 'egg') {
        for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; part(b.x, b.y - 6, pick(cfg), { vx: Math.cos(a) * 120, vy: Math.sin(a) * 70, grav: 0, life: 0.5 }); }
        St.shake(4); St.flash(0.2, cfg[0]);
      } else if (type === 'potion' || type === 'tome') {
        burst(b.x, b.y - 6, cfg, 24, 50, { vy: -40 });
      } else burst(hp.x, hp.y - 12, cfg, 24, 70);
      text(hp.x, hp.y - 30, G.L(G.ABILITIES[type].name), cfg[0], 4, { life: 1.2, max: 1.2, vy: -16 });
    });
    G.on('classChosen', () => { const hp = heroPos(); burst(hp.x, hp.y - 12, ['#ffffff', '#ffe27a'], 30, 80); St.flash(0.3, '#ffffff'); });
    G.on('bossStart', b => {
      bossVis = { t: 0, sprite: SPR.boss(b.sprite, b.lord), lord: b.lord, enter: 1, final: !!(b.final || b.kind === 'final') };
      St.shake(4); St.flash(0.3, b.lord ? '#ff3b3b' : '#ffffff');
      const p = btnPos();
      burst(p.x, p.y, ['#3a3a44', '#6e6e7c', '#ffffff'], 30, 90);
      ring(p.x, p.y - 4, 60, 34, '#ffffff', 0.5);
      bossBulletT = 1.2;
    });
    G.on('bossWin', (rew, b) => {
      const p = bossPos();
      if (bossVis) explodeSprite(bossVis.sprite.canvas, p.x, p.y, bossScale(), 90, 1.8);
      slowmo = 0.8;
      ring(p.x, p.y - 6, 90, 50, '#ffd84a', 0.7); ring(p.x, p.y - 6, 60, 34, '#ffffff', 0.45);
      decal(p.x, p.y, (GORE[G.REALMS[b.realm].id] || GORE.meadow).blood, 16);
      burst(p.x, p.y - 8, ['#ffd84a', '#ffffff', '#ff7a2e', '#ff4f4f'], 60, 130);
      text(p.x, p.y - 30, G.t('victory'), '#ffd84a', 8, { life: 1.8, max: 1.8, vy: -12 });
      St.shake(7); St.flash(0.5, '#ffd84a');
      bossVis = null; bullets.length = 0;
    });
    G.on('bossFail', () => {
      const p = bossPos();
      text(p.x, p.y - 30, G.t('bossFled'), '#9a9aa8', 6, { life: 1.6, max: 1.6 });
      burst(p.x, p.y, '#6e6e7c', 30, 80);
      bossVis = null; bullets.length = 0;
    });
    G.on('wispCatch', (e, amount) => {
      const w = St._wispPos || btnPos();
      burst(w.x, w.y, ['#fff3a0', '#ffd84a', '#ffffff'], 30, 90);
      text(w.x, w.y - 10, G.L(e.name), '#fff3a0', 5, { life: 1.8, max: 1.8, vy: -14 });
      if (amount) text(w.x, w.y, '+' + G.fmt(amount), '#ffd84a', 5);
      St.flash(0.25, '#fff3a0');
    });
    G.on('realm', r => {
      groundKey = ''; if (!march) St.flash(0.3, '#000000');
      // a title card for the new land and its rule (4.0: in a Siege, the route's land: LAND n · its name, the act, the door's twist)
      if (inSiege()) { landTitle(G.S.depth); return; }
      const R_ = G.REALMS[r];
      cardText(0, G.realmName(G.S.depth).toUpperCase(), '#ffffff', 7, { life: 3, max: 3, vy: -3, big: true, tag: 'land' });
      cardText(11, R_.rule + ': ' + R_.ruleDesc, '#ffe27a', 3, { life: 3, max: 3, vy: -3 });
      cardText(19, G.t('zoneCard', 1, G.ZONE_NAME(G.S.depth)), '#ffffff', 3, { life: 3, max: 3, vy: -3 });
    });
    G.on('ascend', () => { gems.length = 0; });
    // the first land introduces itself when the Warden takes the field, and again after each ascension
    G.on('classChosen', () => setTimeout(() => {
      const d = G.S.depth, R_ = G.REALMS[G.realmIndex(d)];
      cardText(0, G.realmName(d).toUpperCase(), '#ffffff', 7, { life: 3, max: 3, vy: -3, big: true });
      cardText(11, G.t('zoneCard', G.zoneOf(d) + 1, G.ZONE_NAME(d)), '#ffe27a', 3, { life: 3, max: 3, vy: -3 });
    }, 700));
    G.on('ascend', () => { pfx.length = 0; pend.clear(); late.length = 0; groundKey = ''; vis.clear(); mobVis.clear(); St.clearStain(); gibs.length = 0; heroKey = ''; streak.n = 0; St.flash(0.8, '#ffffff'); });
    G.on('buy', (kind) => { if (kind === 'hero') heroKey = ''; });
    worldListen();
  }

  function zoneCard(d) {
    const z = G.zoneOf(d), R_ = G.REALMS[G.realmIndex(d)];
    cardText(0, G.t('zoneCard', z + 1, G.ZONE_NAME(d)).toUpperCase(), '#ffffff', 5, { life: 2.6, max: 2.6, vy: -3, big: true });
    if (z === G.REALM_SIZE - 1) cardText(10, G.t('zoneLord'), '#ff4f7e', 4, { life: 2.6, max: 2.6, vy: -3 });
    // the kind of mob this zone brings for the first time
    const now = G.ZONE_MIX[G.ZONE_LOOK(z)], before = z ? G.ZONE_MIX[G.ZONE_LOOK(z - 1)] : {};
    for (const k in G.ARCHETYPES) if (now[k] > 0 && !(before[k] > 0) && z > 0) {
      const A = G.ARCHETYPES[k];
      const o = z === G.REALM_SIZE - 1 ? 19 : 10;
      cardText(o, G.t('newKind', (R_.mobs && R_.mobs[k]) || A.name), '#b6ff5a', 4, { life: 3.2, vy: -3 });
      cardText(o + 8, A.desc, '#e8f8d0', 3, { life: 3.2, vy: -3 });
    }
  }
  St.zoneCard = zoneCard;

  // ---------- Input ----------
  function toLogical(e, fresh) {
    if (fresh) { rectC = cv.getBoundingClientRect(); rectT = time; }
    const r = stageRect();
    return { x: (e.clientX - r.left) / S, y: (e.clientY - r.top) / S };
  }
  function hitChest(p) {
    let best = null, bd = 1e9;
    for (const c of G.S.chests) {
      const v = vis.get(c.id); if (!v) continue;
      const mini = miniChest(v, c), dx = p.x - v.x, dy = p.y - (v.y - (mini ? 3 : 5));
      if (Math.abs(dx) <= (mini ? 7 : 10) && Math.abs(dy) <= (mini ? 6 : 9)) { const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = c; } }
    }
    return best;
  }
  function hitWisp(p) {
    const w = St._wispPos; if (!w || !G.R.wisp) return false;
    return Math.abs(p.x - w.x) < 10 && Math.abs(p.y - w.y) < 10;
  }
  function hitButton(p) {
    const b = bossVis ? bossPos() : btnPos();
    const rx = bossVis ? bossHalf().w + 4 : 20, ry = bossVis ? bossHalf().h + 4 : 18;
    return Math.abs(p.x - b.x) <= rx && Math.abs(p.y - (b.y - 4)) <= ry;
  }
  function hitReady(p) {
    if (!G.R.bossReady || G.R.boss || G.R.rift || G.R.inv) return false;
    const b = btnPos();
    return Math.abs(p.x - b.x) < 12 && Math.abs(p.y - (b.y - 44)) < 6;
  }
  function doPress(p) {
    G.Audio && G.Audio.unlock();
    if (G.R.town) { const t = hitTown(p); if (t) { if (G.Audio && G.Audio.buy) G.Audio.buy(); if (t.id === 'portal') G.leaveTown(); else G.UI.townOpen(t.id); return 'town'; } return null; }
    if (hitWisp(p)) { G.catchWisp(); return 'wisp'; }
    if (hitWeak(p)) { G.tapBoss(); return 'weak'; }
    if (hitReady(p)) { G.startBoss(); return 'boss'; }
    const mt = hitMeteor(p);
    if (mt != null && G.smashMeteor(mt)) return 'meteor';
    const po = hitPortal(p);
    if (po != null && G.tapPortal(po)) return 'portal';
    const ge = hitLoot(p);
    if (ge) { G.pickup(ge, 'hand'); return 'loot'; }
    // 4.0: in a Siege a shrine is charged: the Hand held on it for 2 s (DESIGN §5.8; js/world.js G.shrineHold)
    if (hitShrine(p)) { if (inSiege() && G.shrineHold) { pointer.x = p.x; pointer.y = p.y; FF.charge = { on: false, k: 0 }; return 'shrine'; } G.useShrine('hand'); return 'shrine'; }
    const dn = hitDowned(p);
    if (dn != null) { G.reviveTap(dn); return 'revive'; }
    const c = hitChest(p);
    if (c) { G.clickChest(c); return 'chest'; }
    const m = hitMob(p);
    if (m) { G.R.focus = m.id; G.manualClick(p.x, p.y); return 'button'; }
    if (hitButton(p)) { G.manualClick(p.x, p.y); return 'button'; }
    return null;
  }
  function bindInput() {
    cv.addEventListener('pointerdown', e => {
      e.preventDefault();
      const p = toLogical(e, true);
      trailAt(p.x, p.y, 5);
      const what = doPress(p);
      // (holding repeats only once Steady Hand is bought, at its rate)
      if (what === 'button' && G.S.set.hold && G.D.holdRate > 0) { holding = true; holdTimer = Math.max(0.1, 1 / G.D.holdRate); }
    });
    const end = () => { holding = false; if (FF.charge) { FF.charge = null; if (G.R.shrine && G.shrineLeave) G.shrineLeave(); } };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('pointerleave', () => { end(); pointer.over = false; hoverChest = null; hoverLoot = null; });
    cv.addEventListener('pointermove', e => {
      const p = toLogical(e);
      pointer.x = p.x; pointer.y = p.y; pointer.over = true;
      if (time - FF.trailT > 0.03) { FF.trailT = time; trailAt(p.x, p.y, 1); }
      hoverChest = hitChest(p);
      hoverLoot = hitLoot(p);
      if (G.R.town) { townHover = hitTown(p); cv.style.cursor = townHover ? 'pointer' : 'default'; return; }
      cv.style.cursor = (hoverLoot || hitShrine(p) || hoverChest || hitMob(p) || hitButton(p) || hitWisp(p) || hitReady(p)) ? 'pointer' : 'default';
    });
    cv.addEventListener('contextmenu', e => e.preventDefault());
  }
  St.isHolding = () => holding;
  St.keyClick = function () { G.Audio && G.Audio.unlock(); G.manualClick(); };
  St.keyChest = function () {
    const list = G.S.chests;
    if (!list.length) return;
    const c = list.reduce((a, b) => (b.tier > a.tier ? b : a), list[0]);
    G.clickChest(c);
  };

  // ---------- Heroes & pets ----------
  function buildHeroes() {
    const key = G.HEROES.map(h => G.S.heroes[h.id] || 0).join(',') + '|' + W + 'x' + H;
    if (key === heroKey) return;
    heroKey = key;
    heroVis = [];
    const list = [];
    for (const h of G.HEROES) {
      const n = G.S.heroes[h.id] || 0;
      if (!n) continue;
      const k = Math.min(3, 1 + Math.floor(Math.log10(n)));
      for (let i = 0; i < k; i++) list.push(h);
    }
    const cap = Math.min(list.length, 28);
    const b = btnPos();
    for (let i = 0; i < cap; i++) {
      const h = list[i];
      // arc along the bottom and the sides
      const a = Math.PI * (0.08 + 0.84 * (cap === 1 ? 0.5 : i / (cap - 1)));
      const rx = W * 0.46, ry = H * 0.44;
      const x = Math.round(b.x - Math.cos(a) * rx), y = Math.round(b.y + Math.sin(a) * ry * 0.85 - 4);
      heroVis.push({ h, x: clamp(x, 6, W - 6), y: clamp(y, 30, H - 6), ph: Math.random() * 6, fire: Math.random() * 2 });
    }
  }
  function petPos(i) {
    const n = Math.max(1, G.S.active.length);
    const b = bossVis ? bossPos() : btnPos();
    const a = time * 0.8 + (i / n) * Math.PI * 2;
    const r = bossVis ? 36 : 30;
    return { x: Math.round(b.x + Math.cos(a) * r), y: Math.round(b.y - 2 + Math.sin(a) * r * 0.45 + Math.sin(time * 3 + i) * 1.5) };
  }

  // ---------- Boss ----------
  function bossScale() {
    if (!bossVis) return 1;
    const c = bossVis.sprite.canvas;
    const want = bossVis.lord ? 3 : 2;
    return Math.max(1, Math.min(want, Math.floor((H * 0.46) / c.height)));
  }
  // 2.3: where a wind-up's weak point opens: round the boss, never over its head
  function weakPos() {
    const b = G.R.boss; if (!b || !b.move || !bossVis) return null;
    // (to the sides and below, never up under the land box and the Torment dial)
    const bp = bossPos(), hh = bossHalf(), th = Math.PI / 2 + (b.move.wp * 2 - 1) * Math.PI * 0.55;
    return { x: clamp(bp.x + Math.cos(th) * (hh.w + 16), 10, W - 10), y: clamp(bp.y - hh.h + Math.sin(th) * (hh.h + 12), 24, H - 30) };
  }
  St.weakPoint = () => { const p = weakPos(); return p && { x: p.x * S, y: p.y * S }; };
  function hitWeak(p) { const w = weakPos(), r = G.R.boss && G.R.boss.move && G.R.boss.move.k === 'doom' ? 15 : 11; return !!w && Math.abs(p.x - w.x) < r && Math.abs(p.y - w.y) < r; }
  function bossHalf() { const c = bossVis.sprite.canvas, s = bossScale(); return { w: c.width * s / 2, h: c.height * s / 2 }; }
  function bossPos() { const b = btnPos(); return { x: b.x, y: b.y - 2 }; }

  // ---------- Hero & mobs ----------
  const mobVis = new Map();
  let btnHurtT = 0;
  // The Warden's animation state. 3.5: the Warden and every companion share one shape (newVis):
  // a position and a velocity (they run, speeding up and easing into place), the stride of their feet,
  // where they face, the current move, and the dash, aim and heal-run timers that pick where they go.
  const newVis = () => ({ x: null, y: null, vx: 0, vy: 0, face: 1, stride: 0, legs: 0, moving: false, atk: null, cast: 0,
    hand: null, top: null, hurt: 0, heal: 0, ph: Math.random() * 6, dashT: 0, dashTo: null, aimT: 0, aimX: 0, aimY: 0,
    ghosts: [], ghostT: 0, swings: 0, flk: 0, flkT: 0, flkP: 0.9, healT: 0, healTo: null, chargeT: 0 });
  const hero = newVis();
  // where the Warden first stands (a Warden who is the party's tank or healer takes that place)
  function heroBase() {
    const b = btnPos(), r = G.S.hero && G.S.hero.cls ? G.ROLES[G.S.hero.cls] : 'dps';
    if (r === 'tank' || r === 'heal') { const ti = G.tankInfo && G.tankInfo(); if (r === 'heal' || (ti && ti.who === -1)) return unitGoal(-1, { role: r }, hero, null); }
    return { x: b.x - 30, y: b.y + 16 };
  }
  function heroPos() {
    if (hero.x == null) { const p = heroBase(); hero.x = p.x; hero.y = p.y; }
    return { x: Math.round(hero.x), y: Math.round(hero.y) };
  }
  const ATTACK = { sword: ['swing', 0.24], katana: ['swing', 0.2], scythe: ['swing', 0.3], dagger: ['stab', 0.15], bow: ['shot', 0.3], staff: ['cast', 0.3], wand: ['cast', 0.22] };
  St.heroPos = heroPos;

  // ---------- The party on the field ----------
  const allyVis = [];
  const aVis = i => allyVis[i] || (allyVis[i] = newVis());
  // clear of the chest ring by the Button
  const SLOTS_AT = [[34, 14], [0, 36], [-34, -4]];
  // allySlot is where each companion is right now
  function allySlot(i) { const v = aVis(i); if (v.x == null) { const b = btnPos(), o = SLOTS_AT[i] || [0, 40]; v.x = b.x + o[0]; v.y = b.y + o[1]; } return { x: Math.round(v.x), y: Math.round(v.y) }; }
  // a point on the line a mob walks: angle a (0-1, as mobs use it), p from the edge (0) to the Button (1)
  function ringPos(a, p) {
    const b = btnPos(), th = -Math.PI / 2 + 0.55 + a * (Math.PI * 2 - 1.1);
    const sx = b.x + Math.cos(th) * W * 0.6, sy = b.y + Math.sin(th) * H * 0.56, ex = b.x + Math.cos(th) * 26, ey = b.y + Math.sin(th) * 14 + 4;
    return { x: sx + (ex - sx) * p, y: sy + (ey - sy) * p };
  }
  // which side of the line each hero flanks: the Warden and the companions take turns
  const SIDE = { '-1': -1, 0: 1, 1: -1, 2: 1 };
  // how fast each runs (logical px/s): a tank strides, a healer hurries, a dash is a blur
  const RUN = { tank: 56, heal: 92, dps: 80, lunge: 170, dash: 250 };
  // 3.5: where the Horde presses hardest (0-1 as mobs use it): the line the party forms on when no tank holds one
  const threat = { a: 0.5, go: 0.5, t: 0, bins: new Float32Array(12) };
  function stepThreat(dt) {
    if ((threat.t -= dt) <= 0) {
      threat.t = 0.5;
      const B = threat.bins; B.fill(0);
      for (const m of G.R.mobs || []) if (!m.dead && m.p > 0.35) B[Math.min(11, Math.max(0, Math.floor(m.a * 12)))] += (m.w || 1) * m.p;
      let bi = -1, bv = 0; for (let i = 0; i < 12; i++) if (B[i] > bv) { bv = B[i]; bi = i; }
      if (bi >= 0) threat.go = (bi + 0.5) / 12;
    }
    const d = threat.go - threat.a; threat.a += Math.sign(d) * Math.min(Math.abs(d), 0.3 * dt);
  }
  // where a member of the party wants to be: the tank on its line, the healer behind the Button or at the
  // side of whoever it's mending, damage on the flanks either side of the line; a melee hero dashes at its
  // target and back, a shooter steps out toward what it shoots and falls back to the Button
  function unitGoal(who, u, v, wt) {
    const ti = G.tankInfo && G.tankInfo(), ta = ti ? ti.a : threat.a, b = btnPos(), melee = MELEE[wt];
    if (v.dashT > 0 && v.dashTo) return v.dashTo;
    if (u.role === 'tank' && ti && ti.who === who) {
      if (bossVis) return bossSideSpot(v, who);
      return ringPos(ta, G.TUNE.tankP - 0.03);
    }
    if (u.role === 'heal') {
      if (v.healT > 0 && v.healTo != null) { const q = unitPos(v.healTo); return { x: q.x + (q.x < b.x ? 13 : -13), y: q.y + 3 }; }
      const o = ringPos(ta, 0.5), dx = b.x - o.x, dy = b.y - o.y, d = Math.hypot(dx, dy) || 1;
      return { x: b.x + dx / d * 30 + Math.sin(time * 0.7 + (who + 2)) * 5, y: b.y + dy / d * 16 + 10 };
    }
    if (v.flkT <= 0) { v.flkT = rand(2.5, 4.5); v.flk = (SIDE[who] || 1) * rand(0.08, 0.2); v.flkP = rand(0.66, 0.8); }
    if (bossVis) {
      if (melee) return bossSideSpot(v, who);
      return ringPos(clamp(ta + v.flk * 1.8, 0.03, 0.97), 0.74);
    }
    const home = ringPos(clamp(ta + v.flk, 0.03, 0.97), melee ? 0.78 : v.flkP);
    if (!melee && v.aimT > 0) {
      const dx = v.aimX - home.x, dy = v.aimY - home.y, d = Math.hypot(dx, dy) || 1, go = clamp(d - 40, 0, 34);
      return { x: home.x + dx / d * go, y: home.y + dy / d * go };
    }
    return home;
  }
  // in a boss fight melee heroes stand at its flanks: each keeps the side it came in on
  function bossSide(v) { if (v.bFor !== bossVis) { v.bFor = bossVis; v.bSide = (v.x == null ? 0 : v.x) < bossPos().x ? -1 : 1; } return v.bSide; }
  function bossSideSpot(v, who) { const bp = bossPos(), hh = bossHalf(), s = bossSide(v); return { x: bp.x + s * (hh.w + 5), y: bp.y - 1 + (who + 1) * 4 }; }
  // a little physics for a run: speed up, ease into place, and no twitching on the spot
  function moveUnit(v, gx, gy, top, dt) {
    const dx = gx - v.x, dy = gy - v.y, d = Math.hypot(dx, dy);
    const want = d < 0.75 ? 0 : top * Math.min(1, d / 12);
    const tx = d > 0 ? dx / d * want : 0, ty = d > 0 ? dy / d * want : 0;
    const ax = tx - v.vx, ay = ty - v.vy, a = Math.hypot(ax, ay), lim = (top > 120 ? 1600 : 650) * dt;
    if (a > lim) { v.vx += ax / a * lim; v.vy += ay / a * lim; } else { v.vx = tx; v.vy = ty; }
    v.x += v.vx * dt; v.y += v.vy * dt;
  }
  const DUST = ['#d8ccb2', '#b8a888', '#ece2cc'];
  function dust(v, sp) {
    if (parts.length > Q.maxP - 80) return;
    const n = sp > 140 ? 2 : 1;
    for (let i = 0; i < n; i++) part(v.x - v.face * rand(1, 4), v.y - 1, pick(DUST), { vx: -v.vx * 0.15 + rand(-6, 6), vy: -rand(5, 13), grav: 22, life: rand(0.25, 0.42), size: Math.random() < 0.6 ? 2 : 1 });
  }
  function stepUnit(u, dt) {
    const who = u.who, v = who < 0 ? hero : aVis(who);
    if (who < 0) heroPos(); else allySlot(who);
    if (v.dashT > 0) v.dashT -= dt;
    if (v.aimT > 0) v.aimT -= dt;
    if (v.healT > 0) v.healT -= dt;
    if (v.chargeT > 0) v.chargeT -= dt;
    v.flkT -= dt;
    if (v.atk && (v.atk.t += dt) >= v.atk.dur) v.atk = null;
    if (v.cast > 0) v.cast -= dt;
    if (u.down > 0) { v.vx = v.vy = 0; v.moving = false; v.legs = 0; v.dashT = 0; v.ghosts.length = 0; return; }
    const wt = u.eq.weapon ? G.ITEM_TYPE[u.eq.weapon.id] : null;
    const g = unitGoal(who, u, v, wt);
    let gx = clamp(g.x, 10, W - 10), gy = clamp(g.y, 30, H - Math.ceil(70 / S));
    // never stand on (or hide behind) the Button or the boss: a goal inside it moves out to its rim
    const o = keepOut(gx, gy, v.x < btnPos().x ? -1 : 1); gx = o.x; gy = o.y;
    const top = v.dashT > 0 ? (u.cls === 'rogue' ? RUN.dash : RUN.lunge) : RUN[u.role] || RUN.dps;
    moveUnit(v, gx, gy, top, dt);
    // and on the way, it goes round the Button (or the boss), never through it
    const ko = keepOut(v.x, v.y, v.vx < 0 ? -1 : 1);
    if (ko.x !== v.x || ko.y !== v.y) { const k = Math.min(1, dt * 10); v.x += (ko.x - v.x) * k; v.y += (ko.y - v.y) * k; }
    const sp = Math.hypot(v.vx, v.vy);
    v.moving = sp > 8;
    if (v.moving) {
      // a frame of the run every 4.5 px of ground, never faster than about 20 a second
      v.stride += Math.min(sp, 92) * dt / 4.5;
      const lg = Math.floor(v.stride) % 4;
      if (lg !== v.legs && (lg === 1 || lg === 3) && sp > 26) dust(v, sp);
      v.legs = lg;
    } else { v.legs = 0; v.stride = 0; }
    // face what it hits while it fights, else where it runs (with a dead zone, so it never flickers)
    if (v.atk || v.aimT > 0 || v.dashT > 0) { if (Math.abs(v.aimX - v.x) > 2) v.face = v.aimX > v.x ? 1 : -1; }
    else if (Math.abs(v.vx) > 12) v.face = v.vx > 0 ? 1 : -1;
    // a rogue's dash leaves afterimages
    if (v.dashT > 0 && u.cls === 'rogue' && sp > 60 && (v.ghostT -= dt) <= 0) { v.ghostT = 0.028; if (v.ghosts.length < 7) v.ghosts.push({ x: v.x, y: v.y, face: v.face, legs: v.legs, t: 0.22 }); }
  }
  // the Button's footprint (and the bit above it its top hides), or the boss's
  const KO = { x: 0, y: 0 };
  function keepOut(x, y, side) {
    const b = btnPos();
    let cx = b.x, cy = b.y - 7, rx = 27, ry = 17;
    if (bossVis) { const hh = bossHalf(); cy = b.y - 2 - hh.h * 0.7; rx = hh.w + 3; ry = hh.h * 0.75 + 4; }
    let ex = (x - cx) / rx, ey = (y - cy) / ry, e = Math.hypot(ex, ey);
    KO.x = x; KO.y = y;
    if (e >= 1) return KO;
    if (e < 0.05) { ex = side; ey = 0.3; e = Math.hypot(ex, ey); }
    // out through the nearer side or the bottom, never up behind it
    if (ey < 0 && Math.abs(ex) < 0.6) ey = -ey;
    KO.x = cx + ex / e * rx; KO.y = cy + ey / e * ry;
    return KO;
  }
  function stepParty(dt) {
    if (!G.partyUnits) return;
    stepThreat(dt);
    const us = G.partyUnits();
    for (const u of us) stepUnit(u, dt);
    // heroes standing on top of each other step apart
    for (let i = 0; i < us.length; i++) for (let j = i + 1; j < us.length; j++) {
      const a = unitVis(us[i].who), c = unitVis(us[j].who);
      if (us[i].down > 0 || us[j].down > 0 || a.dashT > 0 || c.dashT > 0 || a.x == null || c.x == null) continue;
      const dx = c.x - a.x, dy = (c.y - a.y) * 1.6, d = Math.hypot(dx, dy);
      if (d >= 12) continue;
      const k = (12 - d) / 2 * Math.min(1, dt * 5) / (d || 1), px = d ? dx * k : k, py = d ? dy * k / 1.6 : 0;
      a.x -= px; a.y -= py; c.x += px; c.y += py;
    }
  }
  St.ringPos = ringPos;
  function unitPos(who) { return who === 'button' ? { x: btnPos().x, y: btnPos().y - 6 } : who < 0 ? heroPos() : allySlot(who); }
  St.unitPoint = who => { const q = unitPos(who); return St.toScreen(q.x, q.y - 12); };
  const ROLE_COL = { tank: '#7fb8ff', heal: '#8ae07a', dps: '#ff9a5a' };
  function hpBar(x, y, k, w, col) {
    lctx.fillStyle = '#0c0b12'; lctx.fillRect(Math.round(x - w / 2) - 1, y - 1, w + 2, 4);
    lctx.fillStyle = '#3a1a1e'; lctx.fillRect(Math.round(x - w / 2), y, w, 2);
    lctx.fillStyle = k > 0.5 ? '#56d45a' : k > 0.25 ? '#ffd84a' : '#ff4f4f'; lctx.fillRect(Math.round(x - w / 2), y, Math.max(0, Math.round(w * k)), 2);
    if (col) { lctx.fillStyle = col; lctx.fillRect(Math.round(x - w / 2) - 3, y - 1, 2, 4); }
  }
  // a fallen hero lies on its side, greyed, with a ring that fills as it gets back up
  function drawDowned(u, q) {
    lctx.save(); lctx.globalAlpha = 0.55;
    lctx.translate(q.x, q.y - 3); lctx.rotate(-Math.PI / 2);
    G.Doll.draw(lctx, u, 0, 0, { face: 1, pose: 'rest', ang: 0, time: 0 });
    lctx.restore();
    const k = clamp(1 - u.down / (G.TUNE.reviveTime || 24), 0, 1);
    lctx.strokeStyle = '#0c0b12'; lctx.lineWidth = 3; lctx.beginPath(); lctx.arc(q.x, q.y - 6, 9, 0, Math.PI * 2); lctx.stroke();
    lctx.strokeStyle = '#ffd84a'; lctx.lineWidth = 1; lctx.beginPath(); lctx.arc(q.x, q.y - 6, 9, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); lctx.stroke();
    if (Math.random() < 0.08) part(q.x + rand(-4, 4), q.y - 10, '#c8c8d4', { vx: 0, vy: -8, grav: 0, life: 0.6 });
  }
  // 3.5: the Warden and the companions are drawn the same way: running feet, the move in hand, the swing's smear
  const POSE = { pose: 'rest', ang: 0, draw: 0 };
  function unitPose(v, wt) {
    let pose = 'rest', ang = G.Doll.restAngle(wt), draw = 0;
    const a = v.atk;
    if (a) {
      const k = a.t / a.dur;
      if (a.kind === 'swing') {
        if (k < 0.25) { pose = 'up'; ang = -2.4; }
        else if (k < 0.6) { pose = 'fwd'; ang = G.lerp(-2.4, 0.8, (k - 0.25) / 0.35); }
        else ang = G.lerp(0.8, ang, (k - 0.6) / 0.4);
      } else if (a.kind === 'stab') {
        if (k < 0.35) ang = -0.3; else if (k < 0.8) { pose = 'fwd'; ang = 0; }
      } else if (a.kind === 'shot') { pose = 'fwd'; draw = k < 0.5 ? k / 0.5 : 0; }
      else if (a.kind === 'cast') {
        if (k < 0.4) { pose = 'up'; ang = -1.9; } else if (k < 0.85) { pose = 'fwd'; ang = -0.55; }
      }
    }
    if (v.cast > 0) { pose = 'up'; ang = -1.7; }
    POSE.pose = pose; POSE.ang = ang; POSE.draw = draw;
    return POSE;
  }
  // a dash's afterimages: the body as a flat tinted shadow, one cached canvas per hero look
  const ghostCache = new Map();
  function ghostOf(u) {
    const key = u.cls + '|' + (u.eq.weapon ? u.eq.weapon.id : '-') + '|' + (u.eq.armor ? u.eq.armor.id : '-');
    let c = ghostCache.get(key);
    if (c) return c;
    if (ghostCache.size > 12) ghostCache.clear();
    const f = G.Doll.frame(u, 1, 'fwd', 0).canvas;
    c = SPR.makeCanvas(f.width, f.height);
    const x = c.getContext('2d');
    x.drawImage(f, 0, 0); x.globalCompositeOperation = 'source-in';
    x.fillStyle = (CFX[u.cls] || CFX.rogue)[0]; x.fillRect(0, 0, c.width, c.height);
    ghostCache.set(key, c);
    return c;
  }
  function drawGhosts(u, v) {
    if (!v.ghosts.length) return;
    const c = ghostOf(u);
    for (let i = v.ghosts.length - 1; i >= 0; i--) {
      const g = v.ghosts[i];
      if ((g.t -= fdt) <= 0) { v.ghosts.splice(i, 1); continue; }
      lctx.globalAlpha = 0.5 * g.t / 0.22;
      const ox = Math.round(g.x - 13), oy = Math.round(g.y - 23);
      if (g.face > 0) lctx.drawImage(c, ox, oy);
      else { lctx.save(); lctx.translate(ox + 26, oy); lctx.scale(-1, 1); lctx.drawImage(c, 0, 0); lctx.restore(); }
    }
    lctx.globalAlpha = 1;
  }
  // (3.6: each ring is painted once into a stamp, the same dots, and stamped)
  const ringStamps = new Map();
  function footRing(x, y, rx, col, a) {
    const key = rx + col + a;
    let c = ringStamps.get(key);
    const ry = Math.max(2, Math.round(rx * 0.38)), n = Math.round(rx * 4);
    if (!c) {
      c = SPR.makeCanvas(rx * 2 + 3, ry * 2 + 3); c.ox = rx + 1; c.oy = ry + 1;
      const g = c.getContext('2d'); g.fillStyle = col;
      for (let j = 0; j < n; j++) {
        const t = j / n * Math.PI * 2, sy = Math.sin(t);
        g.globalAlpha = a * (sy > 0 ? 1 : 0.45);
        g.fillRect(c.ox + Math.round(Math.cos(t) * rx), c.oy + Math.round(sy * ry), 1, 1);
      }
      ringStamps.set(key, c);
    }
    lctx.drawImage(c, Math.round(x) - c.ox, Math.round(y - 1) - c.oy);
  }
  function drawUnit(u, v, q) {
    const warden = u.who < 0;
    if (u.down > 0) { drawDowned(u, q); return; }
    const w = u.eq.weapon, wt = w ? G.ITEM_TYPE[w.id] : null;
    drawGhosts(u, v);
    if (v.hurt > 0) v.hurt -= fdt;
    if (v.heal > 0) { glow(q.x, q.y - 8, 9, '#8ae07a', v.heal * 2); v.heal -= fdt; }
    if (warden && w && w.r >= 3) glow(q.x, q.y - 6, 10, G.RARITIES[w.r].color, 0.16 + 0.06 * Math.sin(time * 4));
    if (warden && G.R.hb && G.R.hb.wing > 0) glow(q.x, q.y - 12, 12, '#ffffff', 0.25);
    // the tank wears a shield-glow while it is holding a line of mobs
    if (u.role === 'tank' && G.tankInfo && (G.tankInfo() || {}).who === u.who && G.R.mobs.some(m => m.held)) glow(q.x, q.y - 8, 13, '#7ab8ff', 0.16 + 0.07 * Math.sin(time * 4));
    // a staff or wand glows as a spell gathers
    if (v.chargeT > 0 && v.hand) { const c = CFX[fxKey(u.cls, wt)] || CFX.wizard; glow(v.hand.x, v.hand.y - 3, 4, c[0], 0.45 * v.chargeT / 0.2); }
    shadow(q.x, q.y - 1, warden ? 14 : 12);
    // a ring of the role's colour at its feet, to find each hero in the crowd
    footRing(q.x, q.y, warden ? 9 : 8, ROLE_COL[u.role], warden ? 0.75 : 0.55);
    const P = unitPose(v, wt), a = v.atk;
    const bob = v.moving || a ? 0 : Math.floor(time * 1.6 + v.ph) % 2;
    const lunge = a && a.kind !== 'shot' && P.pose === 'fwd' ? v.face : 0;
    const r = G.Doll.draw(lctx, u, q.x + lunge, q.y, { face: v.face, legs: v.legs, pose: P.pose, bob, ang: P.ang, draw: P.draw, time: time + (warden ? 0 : v.ph) });
    if (!v.hand) v.hand = { x: 0, y: 0 };
    v.hand.x = r.hx; v.hand.y = r.hy; v.top = r.top;
    // a smear behind the blade, and a flash ahead of a stab
    if (a && w) {
      const k = a.t / a.dur, col = G.WEAPONS[wt].col;
      if (a.kind === 'swing' && k >= 0.25 && k < 0.8) {
        const cur = k < 0.6 ? P.ang : 0.8, from = Math.max(-2.4, cur - 2.2);
        lctx.fillStyle = col;
        for (let t = from; t <= cur; t += 0.1) {
          lctx.globalAlpha = 0.25 + 0.6 * (t - from) / Math.max(0.01, cur - from);
          lctx.fillRect(Math.round(r.hx + v.face * Math.cos(t) * 9), Math.round(r.hy + Math.sin(t) * 9), 1, 1);
          lctx.fillRect(Math.round(r.hx + v.face * Math.cos(t) * 11), Math.round(r.hy + Math.sin(t) * 11), 1, 1);
        }
        lctx.globalAlpha = 1;
      } else if (a.kind === 'stab' && k >= 0.35 && k < 0.8) {
        lctx.fillStyle = '#ffffff';
        for (let j = 10; j < 15; j++) { lctx.globalAlpha = 1 - (j - 10) / 5; lctx.fillRect(Math.round(r.hx + v.face * j), Math.round(r.hy), 1, 1); }
        lctx.globalAlpha = 1;
      }
    }
    if (a && a.kind === 'cast' && !a.flash && a.t / a.dur >= 0.4 && w) {
      a.flash = true;
      const tp = G.Doll.tip(w, r.hx, r.hy, v.face, -0.55);
      burst(tp.x, tp.y, [G.WEAPONS[wt].col, '#ffffff'], 5, 40, { grav: 0, life: 0.22 });
    }
    if (v.hurt > 0) { lctx.globalAlpha = Math.min(0.6, v.hurt * 4); lctx.fillStyle = '#ff3b3b'; lctx.fillRect(q.x - 6, q.y - 20, 12, 20); lctx.globalAlpha = 1; }
    if (warden) { if (G.D.wardenHp) hpBar(q.x, q.y - 26, G.S.hero.whp / G.D.wardenHp, 16, ROLE_COL[u.role]); }
    else hpBar(q.x, q.y - 24, u.hp / u.max, 14, ROLE_COL[u.role]);
  }
  // heals, bites and boss shots between the party, the Button and the Horde
  const beamsFx = [];
  function drawBeamsFx(dt) {
    for (let i = beamsFx.length - 1; i >= 0; i--) {
      const f = beamsFx[i];
      if ((f.t += dt) >= f.dur) { beamsFx.splice(i, 1); if (f.onEnd) f.onEnd(); continue; }
      const k = f.t / f.dur, a = unitPos(f.from), b = unitPos(f.to);
      if (f.kind === 'heal') {
        lctx.globalAlpha = 0.7 * (1 - k); lctx.strokeStyle = '#8ae07a'; lctx.lineWidth = 2;
        lctx.beginPath(); lctx.moveTo(a.x, a.y - 14); lctx.lineTo(b.x, b.y - 10); lctx.stroke(); lctx.globalAlpha = 1;
      } else {
        // a bolt from the boss to its victim
        const bp = bossVis ? bossPos() : btnPos(), x = bp.x + (b.x - bp.x) * k, y = bp.y - 12 + (b.y - 10 - bp.y + 12) * k - Math.sin(k * Math.PI) * 10;
        lctx.fillStyle = '#0c0b12'; lctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 5, 5);
        lctx.fillStyle = f.col || '#ff7a2e'; lctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
        if (Math.random() < 0.5) part(x, y, f.col || '#ffb347', { vx: rand(-8, 8), vy: rand(-8, 8), grav: 0, life: 0.2 });
      }
    }
  }
  // ---------- 3.5: the party's blows ----------
  // One attack of a hero, made visible. The hit has already landed in the game; the blow is drawn landing a
  // moment later (a swing in about 0.07 s, an arrow or a spell in 0.15-0.3 s), and a mob it killed stays
  // standing until the blow reaches it (late), so the arrow, not the number, is what kills it.
  // Knobs: G.Stage.partyFx.cap (live blows), .q (0-1: trail sparkle and sparks; drops by itself on a slow frame)
  const PFX = St.partyFx = { cap: 180, q: 1, lateMax: 80 };
  // each class's look: [main, light, dark]
  const CFX = {
    knight: ['#c8d4e4', '#ffffff', '#5a8adf'],
    archer: ['#9be15d', '#f0ffd8', '#3d7f2b'],
    wizard: ['#7fa8ff', '#eef4ff', '#8a4aef'],
    fire: ['#ff7a2e', '#ffe27a', '#c8321a'],
    rogue: ['#c8a8ff', '#ffffff', '#6a3aaa'],
    cleric: ['#ffd84a', '#fffbe0', '#d89a2a'],
  };
  // the style of a blow goes by the weapon in hand (any class may carry any weapon), the colours of a spell by who casts it
  const fxKey = (cls, wt) => (wt === 'bow' ? 'archer' : wt === 'dagger' ? 'rogue' : MELEE[wt] || !wt ? 'knight' : cls === 'cleric' ? 'cleric' : cls === 'wizard' && wt === 'staff' ? 'fire' : 'wizard');
  const pfx = [];          // live blows: projectiles, swings, slashes, sparks, beams
  const pend = new Map();  // mob id -> the blow on its way to it
  const late = [];         // mobs killed by a blow still on its way: drawn where they stood until it lands
  let idMap = new Map(), idMapT = -1;
  function mobById(id) {
    if (idMapT !== time) { idMapT = time; idMap.clear(); for (const m of G.R.mobs) idMap.set(m.id, m); }
    return idMap.get(id);
  }
  function bossSpot() { const bp = bossPos(), hh = bossHalf(); return { x: bp.x + rand(-0.8, 0.8) * hh.w, y: bp.y - hh.h * rand(0.55, 1.45) }; }
  const unitVis = who => (who < 0 ? hero : aVis(who));
  function blow(o) {
    if (pfx.length >= PFX.cap) {
      if (!o.hits && !o.boss) return null;     // a spark or a mark: skip it
      o.t = o.dur; land(o); return null;       // a hit: land it now
    }
    o.t = -(o.delay || 0);
    pfx.push(o);
    if (o.hits) for (const m of o.hits) pend.set(m.id, o);
    return o;
  }
  function onMobDie(m, gold, chest, src) {
    const f = pend.get(m.id);
    if (f && !f.done && late.length < PFX.lateMax) { late.push({ m, q: mobPos(m), gold, chest, src, f, t: 0 }); return; }
    gore(m, gold, chest, src);
  }
  function flushLate(f) {
    for (let i = late.length - 1; i >= 0; i--) {
      const L = late[i];
      if (f ? L.f === f : true) { late.splice(i, 1); gore(L.m, L.gold, L.chest, L.src); }
    }
  }
  function stepLate(dt, list, realm) {
    for (let i = late.length - 1; i >= 0; i--) {
      const L = late[i];
      if ((L.t += dt) > 0.45 || L.f.done) { late.splice(i, 1); gore(L.m, L.gold, L.chest, L.src); continue; }
      list.push({ y: L.q.y, draw: () => drawMob(L.m, L.q, realm) });
    }
  }
  // where a blow is aimed right now: its mob (alive or waiting in late), else the spot it was sent to
  function aimOf(f) {
    if (f.m) { const q = mobPos(f.m); f.tx = q.x + (f.ox || 0); f.ty = q.y - 7 + (f.oy || 0); }
  }
  // the blow arrives
  function land(f) {
    if (f.done) return;
    f.done = true;
    aimOf(f);
    if (f.hits) for (const m of f.hits) { if (pend.get(m.id) === f) pend.delete(m.id); if (!m.dead) { const v = mobVisOf(m); v.hit = Math.max(v.hit, m === f.m ? 0.1 : 0.07); } }
    if (f.boss) bossHitT = Math.max(bossHitT, 0.07);
    const C = f.C, x = f.tx, y = f.ty, big = f.crit ? 1.5 : 1, q = PFX.q;
    switch (f.k) {
      case 'arrow':
        blow({ k: 'spark', x, y, C, crit: f.crit, sc: f.sc * 0.8, dur: 0.12 });
        if (f.m && !f.m.dead) blow({ k: 'stuck', m: f.m, ox: f.ox || 0, oy: (f.oy || 0) + rand(-2, 2), ux: f.ux, uy: f.uy, C, dur: 0.55 });
        else burst(x, y, [C[0], '#ffffff', '#c8a870'], 3, 50, { life: 0.22 });
        break;
      case 'missile':
        ring(x, y + 2, 6 * big, 4 * big, C[0], 0.2);
        blow({ k: 'spark', x, y, C, crit: f.crit, sc: f.sc, dur: 0.14 });
        if (q > 0.5) burst(x, y, [C[0], C[1], C[2]], f.crit ? 8 : 4, 55, { grav: 0, life: 0.25 });
        break;
      case 'fire': {
        const rx = Math.max(8, f.rx || 10) * big, ry = Math.max(5, f.ry || 6) * big;
        blow({ k: 'flash', x, y: y + 3, r: rx * 0.7, col: '#ffe27a', dur: 0.16 });
        ring(x, y + 4, rx, ry, '#ff7a2e', 0.26); ring(x, y + 4, rx * 0.6, ry * 0.6, '#ffe27a', 0.2);
        burst(x, y, ['#ffe27a', '#ff7a2e', '#ff3b1a', '#ffffff'], Math.round((f.crit ? 16 : 9) * (0.4 + 0.6 * q)), 85, { life: 0.32, grav: 60 });
        for (let i = 0; i < 3 * q; i++) part(x + rand(-4, 4), y + rand(-2, 2), pick(['#3a3440', '#5a5260']), { vx: rand(-8, 8), vy: -rand(14, 26), grav: -8, life: rand(0.4, 0.6), size: 2 });
        if (f.crit) St.shake(1.5);
        break;
      }
      case 'holy':
        blow({ k: 'cross', x, y, C, crit: f.crit, sc: f.sc, dur: 0.16 }); ring(x, y + 2, 5 * big, 3 * big, C[0], 0.18);
        if (q > 0.5) burst(x, y, [C[0], C[1]], f.crit ? 7 : 4, 40, { grav: -20, life: 0.3 });
        break;
      case 'hit': // a swing or a stab connecting
        if (f.mark === 'cut') blow({ k: 'cut', x, y, C, sc: f.sc, flip: f.flip, dur: 0.16 });
        else if (f.mark === 'x') { blow({ k: 'xcut', x, y, C, sc: f.sc, dur: 0.34 }); burst(x, y, ['#ff3b3b', '#ffffff', '#ff8a8a'], 8, 70, { life: 0.3 }); St.shake(1); }
        else blow({ k: 'spark', x, y, C, crit: f.crit, sc: f.sc, dur: 0.14 });
        break;
    }
    flushLate(f);
  }
  // the moves, by class (and, for a wizard, by staff or wand)
  function unitAttack(who, ev, wt) {
    const u = who < 0 ? G.S.hero : G.S.party[who];
    if (!u || !u.cls || !lctx) return;
    const v = unitVis(who), q = who < 0 ? heroPos() : allySlot(who);
    const key = fxKey(u.cls, wt), C = CFX[key], sc = (who < 0 ? 1.25 : 1) * FXK, crit = !!ev.crit;
    const tg = [], spl = [];
    if (ev.ids) for (const id of ev.ids) { if (tg.length >= 5) break; const m = mobById(id); if (m) tg.push(m); }
    if (ev.splash) for (const id of ev.splash) { if (spl.length >= 10) break; const m = mobById(id); if (m) spl.push(m); }
    const onBoss = !tg.length && !!ev.boss && !!bossVis;
    if (!tg.length && !onBoss) return;
    const p0 = tg.length ? mobPos(tg[0]) : bossSpot();
    v.aimX = p0.x; v.aimY = p0.y; v.aimT = 0.9;
    v.face = p0.x >= q.x ? 1 : -1;
    const at = ATTACK[wt] || ATTACK.sword;
    if (!v.atk || v.atk.t > v.atk.dur * 0.5) v.atk = { kind: at[0], t: 0, dur: at[1] };
    const hx = v.hand ? v.hand.x : q.x + v.face * 7, hy = v.hand ? v.hand.y - 1 : q.y - 11;
    const tpt = (m, i) => { if (m) { const p = mobPos(m); return { x: p.x, y: p.y - 7 }; } const s = bossSpot(); return s; };
    const n = onBoss ? 1 : tg.length;
    if (MELEE[wt]) {
      let tp = tpt(tg[0], 0);
      // on a boss, a melee hero strikes from its flank
      if (onBoss) { const sp = bossSideSpot(v, who), hh = bossHalf(); tp = { x: sp.x - bossSide(v) * 7, y: sp.y - 9 }; tp.hx = bossPos().x + bossSide(v) * hh.w * 0.55; tp.hy = bossPos().y - hh.h * rand(0.5, 1.2); }
      const dx = tp.x - q.x, dy = tp.y + 7 - q.y, d = Math.hypot(dx, dy) || 1;
      const tank = u.role === 'tank' && G.tankInfo && (G.tankInfo() || {}).who === who;
      if (key === 'rogue') {
        // a blink to the target, afterimages behind, two quick cuts (a red X on a crit)
        let reach = 0;
        if (d > 9) { v.dashT = Math.min(0.32, d / RUN.dash + 0.08); v.dashTo = { x: tp.x - v.face * 7, y: tp.y + 8 }; v.ghostT = 0; reach = Math.min(0.12, d / RUN.dash * 0.6); }
        for (let i = 0; i < n; i++) {
          const t = tg[i] ? tpt(tg[i]) : onBoss ? { x: tp.hx, y: tp.hy } : tp;
          blow({ k: 'hit', m: tg[i] || null, boss: onBoss, tx: t.x, ty: t.y, hits: tg[i] ? (i === 0 ? [tg[i]].concat(spl) : [tg[i]]) : null, C, sc, crit, dur: reach + 0.04 + i * 0.03, mark: crit && i === 0 ? 'x' : 'cut', flip: false });
          if (!crit || i > 0) blow({ k: 'cut', m: tg[i] || null, x: t.x + 3, y: t.y - 1, C, sc, flip: true, dur: 0.16, delay: reach + 0.1 + i * 0.03 });
        }
      } else {
        // a knight's (or any blade's) crescent; the tank leans into it, anyone else lunges out to meet the mob
        if (tank) { v.dashT = 0.12; v.dashTo = { x: q.x + dx / d * 5, y: q.y + dy / d * 3 }; }
        else if (d > 12) { v.dashT = 0.3; v.dashTo = { x: tp.x - v.face * 9, y: tp.y + 9 }; }
        const dir = Math.atan2((tp.y - (q.y - 9)) / 0.75, tp.x - q.x);
        blow({ k: 'arc', who, dir, face: v.face, C, col: G.WEAPONS[wt].col, sc: sc * (crit ? 1.3 : 1), crit, dur: crit ? 0.24 : 0.19, delay: tank || d <= 12 ? 0.02 : Math.min(0.14, d / RUN.lunge * 0.7) });
        const all = tg.concat(spl);
        const nn = onBoss ? 1 : Math.min(all.length, 6);
        for (let i = 0; i < nn; i++) {
          const t = all[i] ? tpt(all[i]) : onBoss ? { x: tp.hx, y: tp.hy } : tp;
          blow({ k: 'hit', m: all[i] || null, boss: onBoss && i === 0, tx: t.x, ty: t.y, hits: all[i] ? [all[i]] : null, C, sc, crit: crit && i === 0, dur: 0.07 + i * 0.025 + (tank || d <= 12 ? 0 : Math.min(0.14, d / RUN.lunge * 0.7)), mark: 'spark' });
        }
        // the shield: every fourth swing (and on a crit) a bash that rings out round the knight
        if (u.cls === 'knight' && (++v.swings % 4 === 0 || crit)) blow({ k: 'wave', who, C, sc, dur: 0.3, delay: 0.05 });
      }
      return;
    }
    // ranged: the shot leaves the bow, wand or staff a beat after the draw
    if (key !== 'archer') v.chargeT = 0.2;
    const kind = key === 'archer' ? 'arrow' : key === 'fire' ? 'fire' : key === 'cleric' ? 'holy' : 'missile';
    const speed = kind === 'arrow' ? 330 : kind === 'fire' ? 200 : kind === 'holy' ? 250 : 230;
    const lead = kind === 'arrow' ? 0.06 : 0.05;
    const area = ev.aoe ? aoePx(ev.aoe) : null;
    const per = kind === 'arrow' && crit ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const m = tg[i] || null, t = tpt(m, i);
      for (let j = 0; j < per; j++) {
        const dx = t.x - hx, dy = t.y - hy, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
        // a crit volley fans out a little either side of the mark
        const off = per > 1 ? (j - 1) * 4 : 0;
        const f = { k: kind, m: j === 0 ? m : m, boss: onBoss, sx: hx, sy: hy, tx: t.x - uy * off, ty: t.y + ux * off, ox: -uy * off, oy: ux * off, ux, uy,
          C, sc, crit, dur: clamp(d / speed, 0.1, 0.32), delay: lead + i * 0.03 + j * 0.035, arc: kind === 'arrow' ? Math.min(7, d * 0.05) : kind === 'fire' ? Math.min(12, d * 0.09) : kind === 'holy' ? Math.min(8, d * 0.06) : 0,
          wob: kind === 'missile' ? (Math.random() < 0.5 ? -1 : 1) * (crit ? 5 : 4) : 0,
          hits: m && j === 0 ? (i === 0 ? [m].concat(spl) : [m]) : null };
        if (kind === 'fire' && area) { f.rx = area.rx; f.ry = area.ry; }
        if (!m) { f.ox = f.oy = 0; }
        blow(f);
      }
    }
  }
  // a cleric's mend: a golden beam from the staff to whoever it heals, and + motes rising off them
  function healFx(i, who) {
    if (i == null || !lctx) return;
    const v = unitVis(i);
    v.cast = Math.max(v.cast, 0.25); v.chargeT = 0.25;
    blow({ k: 'beam', from: i, to: who, C: CFX.cleric, dur: 0.5 });
  }
  function unitChest(who) { if (who === 'button') { const b = btnPos(); return { x: b.x, y: b.y - 8 }; } const q = unitPos(who); return { x: q.x, y: q.y - 10 }; }
  // a few points back along a projectile's path, for its trail
  function pathAt(f, k) {
    const e = k, x = f.sx + (f.tx - f.sx) * e, y = f.sy + (f.ty - f.sy) * e - Math.sin(e * Math.PI) * f.arc;
    if (!f.wob) { PT.x = x; PT.y = y; return PT; }
    const w = Math.sin(e * Math.PI) * f.wob * Math.sin(e * Math.PI * 2), d = Math.hypot(f.tx - f.sx, f.ty - f.sy) || 1;
    PT.x = x - (f.ty - f.sy) / d * w; PT.y = y + (f.tx - f.sx) / d * w; return PT;
  }
  const PT = { x: 0, y: 0 }, ARC_COLS = ['', '', '', '', ''];
  // a round-ish pixel blob: a square with its corners off
  function blob(x, y, s) { if (s < 4) { px(x, y, s); return; } const X = Math.round(x - (s >> 1)), Y = Math.round(y - (s >> 1)); lctx.fillRect(X + 1, Y, s - 2, s); lctx.fillRect(X, Y + 1, s, s - 2); }
  function px(x, y, s) { lctx.fillRect(Math.round(x - (s >> 1)), Math.round(y - (s >> 1)), s, s); }
  function drawPfx(dt) {
    // a slow frame thins the sparkle
    // (3.6: and the quality tier caps it)
    PFX.q = clamp(PFX.q + (fdt > 0.024 ? -dt * 2 : dt * 0.5), 0.35, Math.max(0.35, Q.pfxQ));
    for (let i = pfx.length - 1; i >= 0; i--) {
      const f = pfx[i];
      f.t += dt;
      if (f.t < 0) continue;
      if (f.hits !== undefined || f.boss) {
        // a projectile or a connecting swing
        if (f.t >= f.dur) { pfx.splice(i, 1); land(f); continue; }
        if (f.k === 'hit') continue;
        aimOf(f);
        drawShot(f, f.t / f.dur);
        continue;
      }
      if (f.t >= f.dur) { pfx.splice(i, 1); continue; }
      drawMark(f, f.t / f.dur);
    }
    lctx.globalAlpha = 1;
  }
  function drawShot(f, k) {
    const C = f.C, q = PFX.q, s = f.sc * (f.crit ? 1.35 : 1);
    if (f.k === 'arrow') {
      const p = pathAt(f, k), x = p.x, y = p.y, b = pathAt(f, Math.max(0, k - 0.06)), bx = b.x, by = b.y;
      let ux = x - bx, uy = y - by; const l = Math.hypot(ux, uy) || 1; ux /= l; uy /= l;
      f.ux = ux; f.uy = uy;
      const len = Math.round(6 * s);
      // a fading streak behind it
      lctx.fillStyle = f.crit ? '#ffe27a' : C[1];
      for (let j = 1; j <= 6; j++) { lctx.globalAlpha = 0.4 * (1 - j / 7); lctx.fillRect(Math.round(x - ux * (len + j * 2)), Math.round(y - uy * (len + j * 2)), 1, 1); }
      lctx.globalAlpha = 1;
      lctx.fillStyle = '#0c0b12'; line(x - ux * len + 0.5, y - uy * len + 1, x + 0.5, y + 1);
      lctx.fillStyle = '#d8b880'; line(x - ux * len, y - uy * len, x, y);
      lctx.fillStyle = f.crit ? '#fff3a0' : C[0]; lctx.fillRect(Math.round(x - ux * len) - 1, Math.round(y - uy * len), 2, 1);
      lctx.fillStyle = '#ffffff'; px(x, y, f.crit ? 3 : 2);
      if (f.crit) glow(x, y, 3, '#ffe27a', 0.35);
      return;
    }
    if (f.k === 'missile' || f.k === 'holy' || f.k === 'fire') {
      const fire = f.k === 'fire', holy = f.k === 'holy';
      const head = fire ? 4 : 3, n = fire ? 6 : 5;
      for (let j = n; j >= 1; j--) {
        const p = pathAt(f, Math.max(0, k - j * 0.045));
        lctx.globalAlpha = 0.7 * (1 - j / (n + 1));
        lctx.fillStyle = fire ? (j < 3 ? '#ff7a2e' : j < 5 ? '#c8321a' : '#5a4a50') : j < 3 ? C[0] : C[2];
        px(p.x, p.y, Math.max(1, Math.round((head - j * 0.5) * s)));
      }
      lctx.globalAlpha = 1;
      const p = pathAt(f, k), x = p.x, y = p.y;
      glow(x, y, Math.round((fire ? 5 : 4) * s), fire ? '#ff9a3a' : C[0], 0.3);
      lctx.fillStyle = '#0c0b12'; blob(x, y + 1, Math.round(head * s) + 1);
      lctx.fillStyle = fire ? '#ff7a2e' : C[0]; blob(x, y, Math.round(head * s));
      lctx.fillStyle = fire ? '#ffe27a' : C[1]; px(x, y, Math.max(1, Math.round((head - 2) * s)));
      if (holy) { lctx.fillStyle = C[1]; lctx.fillRect(Math.round(x) - Math.round(2 * s), Math.round(y), Math.round(4 * s) + 1, 1); lctx.fillRect(Math.round(x), Math.round(y) - Math.round(2 * s), 1, Math.round(4 * s) + 1); }
      if (f.crit) { lctx.fillStyle = '#ffffff'; px(x, y, 1 + (fire ? 1 : 0)); }
      if (Math.random() < (fire ? 0.5 : 0.28) * q) part(x + rand(-1, 1), y + rand(-1, 1), fire ? pick(['#ffe27a', '#ff7a2e', '#ff3b1a']) : pick([C[0], C[1]]), { vx: rand(-10, 10), vy: rand(-14, 4), grav: fire ? -20 : 0, life: rand(0.15, 0.3) });
    }
  }
  function drawMark(f, k) {
    const C = f.C, fade = k < 0.5 ? 1 : 1 - (k - 0.5) / 0.5;
    switch (f.k) {
      case 'arc': { // a crescent of steel round the swinger
        const u = f.who < 0 ? hero : aVis(f.who); if (u.x == null) return;
        const cx = u.x + f.face * 2, cy = u.y - 9, r = (f.crit ? 17 : 14) * f.sc;
        const a0 = f.dir - 1.35 * f.face, a1 = f.dir + 1.35 * f.face;
        const hk = 1 - Math.pow(1 - Math.min(1, k / 0.45), 2), tk = Math.max(0, (k - 0.2) / 0.8);
        const ah = a0 + (a1 - a0) * hk, at = a0 + (a1 - a0) * tk, span = ah - at;
        if (Math.abs(span) < 0.02) return;
        const steps = Math.max(6, Math.round(Math.abs(span) * r));
        const rows = f.crit ? 5 : 4, cols = ARC_COLS;
        cols[0] = '#ffffff'; cols[1] = f.crit ? '#ffe27a' : C[1]; cols[2] = f.crit ? '#ffb347' : C[0]; cols[3] = f.col === '#ffffff' ? C[2] : f.col; cols[4] = C[2];
        // an ink rim outside, then row by row (one colour each), thick in the middle of the sweep and thin at its ends
        lctx.fillStyle = '#0c0b12';
        for (let j = 0; j <= steps; j += 2) { const s = j / steps, a = at + span * s; lctx.globalAlpha = fade * 0.5 * s; lctx.fillRect(Math.round(cx + Math.cos(a) * (r + 1)), Math.round(cy + Math.sin(a) * 0.75 * (r + 1)), 1, 1); }
        for (let row = 0; row < rows; row++) {
          lctx.fillStyle = cols[row];
          const rr = r - row;
          for (let j = 0; j <= steps; j++) {
            const s = j / steps;
            if (Math.sin(s * Math.PI) * rows + 0.7 <= row) continue;
            const a = at + span * s;
            lctx.globalAlpha = fade * (0.3 + 0.7 * s) * (row > 2 ? 0.7 : 1);
            lctx.fillRect(Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * 0.75 * rr), 1, 1);
          }
        }
        return;
      }
      case 'wave': { // the shield bash: a ring of force rolling out along the ground
        const u = f.who < 0 ? hero : aVis(f.who); if (u.x == null) return;
        if (!f.fx) { f.fx = u.x; f.fy = u.y; for (let i = 0; i < 6 * PFX.q; i++) dust({ x: u.x + rand(-6, 6), y: u.y, face: rand(-1, 1) < 0 ? -1 : 1, vx: rand(-60, 60) }, 100); glow(u.x + u.face * 6, u.y - 9, 6, '#ffffff', 0.6); }
        const e = 1 - Math.pow(1 - k, 2), rx = (5 + 20 * e) * f.sc, ry = rx * 0.5;
        const n = Math.max(24, Math.round(rx * 4.6));
        for (let row = 0; row < 3; row++) {
          lctx.globalAlpha = (1 - k) * (row === 0 ? 0.95 : row === 1 ? 0.7 : 0.45); lctx.fillStyle = row === 0 ? '#ffffff' : row === 1 ? C[0] : C[2];
          const rr = rx - row, ryy = ry - row * 0.5;
          for (let j = 0; j < n; j++) { const a = j / n * Math.PI * 2; lctx.fillRect(Math.round(f.fx + Math.cos(a) * rr), Math.round(f.fy - 2 + Math.sin(a) * ryy), 1, 1); }
        }
        return;
      }
      case 'spark': { // an impact star
        const l = (2 + 4 * Math.min(1, k * 2.5)) * f.sc * (f.crit ? 1.5 : 1), x = Math.round(f.x), y = Math.round(f.y);
        lctx.globalAlpha = fade;
        lctx.fillStyle = f.crit ? '#ffe27a' : C[0];
        lctx.fillRect(x - Math.round(l), y, Math.round(l * 2) + 1, 1); lctx.fillRect(x, y - Math.round(l * 0.8), 1, Math.round(l * 1.6) + 1);
        const dl = Math.round(l * 0.6);
        for (let j = 1; j <= dl; j++) { lctx.fillRect(x + j, y + j, 1, 1); lctx.fillRect(x - j, y - j, 1, 1); lctx.fillRect(x + j, y - j, 1, 1); lctx.fillRect(x - j, y + j, 1, 1); }
        lctx.fillStyle = '#ffffff'; lctx.fillRect(x - 1, y - 1, 3, 3);
        return;
      }
      case 'cross': { // a holy bolt's flash
        const l = Math.round((2 + 2.5 * Math.min(1, k * 3)) * f.sc * (f.crit ? 1.6 : 1)), x = Math.round(f.x), y = Math.round(f.y);
        lctx.globalAlpha = fade;
        lctx.fillStyle = C[0]; lctx.fillRect(x - l, y - 1, l * 2 + 1, 3); lctx.fillRect(x - 1, y - l, 3, l * 2 + 1);
        lctx.fillStyle = C[1]; lctx.fillRect(x - l + 1, y, l * 2 - 1, 1); lctx.fillRect(x, y - l + 1, 1, l * 2 - 1);
        return;
      }
      case 'cut': case 'xcut': { // a rogue's dagger cuts: two quick slashes, or a big red X
        if (f.m && !f.m.dead) { const q = mobPos(f.m); f.x = q.x + (f.flip ? 3 : 0); f.y = q.y - 8; }
        const x = f.x, y = f.y, X = f.k === 'xcut', L = (X ? 8 : 5) * f.sc, g = Math.min(1, k / 0.3);
        const lines = X ? 2 : 1;
        for (let j = 0; j < lines; j++) {
          const gj = X ? clamp((k - j * 0.15) / 0.3, 0, 1) : g; if (gj <= 0) continue;
          const sx = X ? (j ? 1 : -1) : f.flip ? -1 : 1;
          const x0 = x - sx * L, y0 = y - L, x1 = x0 + sx * 2 * L * gj, y1 = y0 + 2 * L * gj;
          lctx.globalAlpha = fade;
          lctx.fillStyle = '#0c0b12'; line(x0, y0 + 1, x1, y1 + 1);
          lctx.fillStyle = X ? '#ff3b3b' : C[0]; line(x0 + 1, y0, x1 + 1, y1); if (X) { line(x0 - 1, y0, x1 - 1, y1); }
          lctx.fillStyle = '#ffffff'; line(x0, y0, x1, y1);
        }
        return;
      }
      case 'stuck': { // an arrow left standing in its mob
        if (f.m && !f.m.dead) { const q = mobPos(f.m); f.x = q.x + f.ox; f.y = q.y - 7 + f.oy; } else if (f.x == null) return;
        const ux = f.ux || 1, uy = f.uy || 0;
        lctx.globalAlpha = fade;
        lctx.fillStyle = '#d8b880'; line(f.x - ux * 4, f.y - uy * 4, f.x - ux, f.y - uy);
        lctx.fillStyle = C[0]; lctx.fillRect(Math.round(f.x - ux * 4), Math.round(f.y - uy * 4), 1, 1);
        return;
      }
      case 'flash':
        glow(f.x, f.y, Math.max(2, Math.round(f.r * (0.6 + 0.4 * k))), f.col, 0.55 * (1 - k));
        lctx.globalAlpha = 1;
        return;
      case 'beam': { // a cleric's mend
        const a = unitPos(f.from), A = { x: a.x + (f.from < 0 ? hero : aVis(f.from)).face * 6, y: a.y - 16 }, B = unitChest(f.to);
        const hk = Math.min(1, k / 0.28), mx = (A.x + B.x) / 2, my = Math.min(A.y, B.y) - 12 - Math.hypot(B.x - A.x, B.y - A.y) * 0.12;
        const d = Math.hypot(B.x - A.x, B.y - A.y), n = Math.max(6, Math.round(d / 1.5)), al = k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45;
        for (let j = 0; j <= n * hk; j++) {
          const s = j / n, u1 = 1 - s, x = u1 * u1 * A.x + 2 * u1 * s * mx + s * s * B.x, y = u1 * u1 * A.y + 2 * u1 * s * my + s * s * B.y;
          lctx.globalAlpha = al * (0.55 + 0.45 * Math.sin(s * 12 - time * 30) * 0.5 + 0.2);
          lctx.fillStyle = C[2]; lctx.fillRect(Math.round(x) - 1, Math.round(y), 3, 1);
          lctx.fillStyle = C[0]; lctx.fillRect(Math.round(x), Math.round(y) - 1, 1, 3);
          if (j % 2 === 0) { lctx.fillStyle = C[1]; lctx.fillRect(Math.round(x), Math.round(y), 1, 1); }
        }
        if (hk >= 1 && !f.hit) {
          f.hit = true;
          ring(B.x, B.y + 6, 9, 5, C[0], 0.35);
          for (let j = 0; j < 6; j++) part(B.x + rand(-7, 7), B.y + rand(-4, 6), pick(['#8ae07a', '#ffd84a', '#ffffff']), { vx: rand(-6, 6), vy: -rand(14, 28), grav: -6, life: rand(0.5, 0.8), size: 1, plus: true });
          glow(B.x, B.y, 7, '#fff3a0', 0.5);
        }
        if (hk < 1) { const s = hk, u1 = 1 - s; lctx.globalAlpha = 1; lctx.fillStyle = '#ffffff'; px(u1 * u1 * A.x + 2 * u1 * s * mx + s * s * B.x, u1 * u1 * A.y + 2 * u1 * s * my + s * s * B.y, 3); }
        return;
      }
    }
  }
  function partyListen() {
    G.on('allyAttack', ev => {
      const m = G.S.party[ev.i];
      if (!m) return;
      unitAttack(ev.i, ev, ev.wt || (m.eq.weapon ? G.ITEM_TYPE[m.eq.weapon.id] : 'sword'));
    });
    // 3.1 OVERDRIVE: a white-out and a shockwave, then the Button lashes every mob with lightning
    G.on('odReady', () => { const b = btnPos(); ring(b.x, b.y - 4, 30, 15, '#7fe9ff', 0.6); text(b.x, b.y - 46, G.t('odReady'), '#7fe9ff', 4, { life: 1.8, vy: -8 }); if (G.Audio && G.Audio.achievement) G.Audio.achievement(); });
    G.on('odStart', () => {
      const b = btnPos();
      St.flash(0.9, '#ffffff'); St.shake(10); slowmo = Math.max(slowmo, 0.6); hitstop = Math.max(hitstop, 0.12);
      cardText(0, G.t('odGo'), '#7fe9ff', 9, { life: 2.2, vy: -3, big: true, now: true });
      for (let k = 0; k < 3; k++) ring(b.x, b.y - 4, 60 + k * 50, 30 + k * 25, k ? '#7fe9ff' : '#ffffff', 0.5 + k * 0.25);
      burst(b.x, b.y - 10, ['#ffffff', '#7fe9ff', '#4fa8ff'], 70, 160);
      beams.push({ x: b.x, y: b.y, col: '#7fe9ff', life: 1.2, max: 1.2, w: 16 });
      if (G.Audio && G.Audio.jackpot) G.Audio.jackpot(); else if (G.Audio && G.Audio.levelUp) G.Audio.levelUp();
    });
    G.on('odPulse', () => {
      const b = btnPos(), ms = G.R.mobs;
      ring(b.x, b.y - 4, 40 + Math.random() * 40, 20 + Math.random() * 20, Math.random() < 0.5 ? '#7fe9ff' : '#ffffff', 0.3);
      // a few forks of lightning from the Button out into the crowd
      for (let k = 0; k < Math.min(7, ms.length); k++) {
        const m = ms[Math.floor(Math.random() * ms.length)]; if (!m || m.p < 0.05) continue;
        const q = mobPos(m), pts = [[b.x, b.y - 14]];
        for (let j = 1; j < 5; j++) pts.push([b.x + (q.x - b.x) * j / 5 + rand(-7, 7), b.y - 14 + (q.y - 6 - b.y + 14) * j / 5 + rand(-7, 7)]);
        pts.push([q.x, q.y - 6]); bolts.push({ pts, life: 0.18, cols: ['#ffffff', '#7fe9ff'], wide: k < 2 });
      }
      St.shake(2);
      if (G.Audio && G.Audio.zap) G.Audio.zap(); else if (G.Audio && G.Audio.click) G.Audio.click(0, true);
    });
    G.on('odEnd', n => { const b = btnPos(); ring(b.x, b.y - 4, 120, 60, '#ffffff', 0.7); St.flash(0.3, '#7fe9ff'); text(b.x, b.y - 40, G.t('odEnd', n), '#7fe9ff', 5, { life: 1.6, vy: -10 }); });
    G.on('heal', (i, who) => {
      healFx(i, who);
      // the healer runs to whoever it mends (not to the Button: it mends that from where it stands)
      if (i != null && who !== 'button' && who !== i) { const hv = aVisOf(i); hv.healTo = who; hv.healT = 1.2; }
      if (who !== 'button') aVisOf(who).heal = 0.3;
    });
    G.on('unitHurt', (who, dmg, src) => {
      aVisOf(who).hurt = 0.12;
      const q = unitPos(who), max = who < 0 ? G.D.wardenHp : (G.D.party[who] || {}).hp || 1, f = dmg / Math.max(1, max);
      hurtFx = Math.min(1, hurtFx + f * 1.6);
      const big = f > 0.12 || src === 'boss' || src === 'slam' || src === 'barrage' || src === 'meteor';
      // (3.6: hits on one hero within a quarter second add up into the number already up)
      const hv = aVisOf(who), ht = hv.hurtTxt;
      if (ht && ht.life > 0 && ht.max - ht.life < 0.25 && texts.includes(ht)) { ht.sum += dmg; ht.str = '-' + G.fmt(ht.sum); ht.fitW = null; if (big) { ht.col = '#ff3b3b'; ht.size = 4; } }
      else if (big || Math.random() < 0.35) { const t = text(q.x + rand(-5, 5), q.y - 28, '-' + G.fmt(dmg), big ? '#ff3b3b' : '#ff6b6b', big ? 4 : 3, { life: 0.7, max: 0.7, vy: -18, dmg: !big }); if (t) { t.sum = dmg; hv.hurtTxt = t; } }
      if (big) { burst(q.x, q.y - 8, ['#ff3b3b', '#ffffff'], 5, 50); St.shake(2); }
    });
    // the Button: every bite shows, summed up a few times a second so a swarm reads as one big number
    G.on('buttonHurt', dmg => {
      const f = dmg / Math.max(1, G.D.heroHp);
      btnDmg += dmg; hurtFx = Math.min(1, hurtFx + f * 2.2);
      if (f > 0.06) { btnSpring.v -= Math.min(0.35, f * 2); St.shake(Math.min(5, 1 + f * 20)); }
    });
    G.on('unitDown', who => {
      const q = unitPos(who);
      burst(q.x, q.y - 8, ['#8a8a9a', '#ff4f4f', '#ffffff'], 18, 70);
      text(q.x, q.y - 30, G.t('downed'), '#ff4f4f', 4, { life: 1.4, max: 1.4, vy: -10 });
      St.shake(2);
    });
    G.on('unitRevive', who => { const q = unitPos(who); burst(q.x, q.y - 8, ['#ffd84a', '#8ae07a', '#ffffff'], 20, 60, { grav: -30 }); text(q.x, q.y - 30, G.t('backUp'), '#8ae07a', 4, { life: 1.2, max: 1.2, vy: -10 }); ring(q.x, q.y - 4, 14, 7, '#ffd84a', 0.4); });
    G.on('reviveTap', who => { const q = unitPos(who); burst(q.x, q.y - 8, ['#ffd84a', '#ffffff'], 6, 40, { life: 0.3 }); });
    G.on('bossHit', (b, v) => beamsFx.push({ kind: 'bolt', from: 'boss', to: v, t: 0, dur: 0.35, col: b.lord ? '#ff4f7e' : '#ff7a2e' }));
    G.on('barrageHit', (b, v, i) => setTimeout(() => beamsFx.push({ kind: 'bolt', from: 'boss', to: v, t: 0, dur: 0.4, col: '#ffb347' }), i * 90));
    G.on('buttonPulse', () => { const b = btnPos(); ring(b.x, b.y - 4, 30, 15, '#ffd84a', 0.35); ring(b.x, b.y - 4, 20, 10, '#ffffff', 0.25); if (G.Audio && G.Audio.pulse) G.Audio.pulse(); });
    G.on('buttonFixed', () => { const b = btnPos(); burst(b.x, b.y - 8, ['#ffd84a', '#ffffff', '#56d45a'], 24, 80); text(b.x, b.y - 32, G.t('buttonFixed'), '#56d45a', 4, { life: 1.4, max: 1.4, vy: -10 }); });
    G.on('clickDead', () => { const b = btnPos(); burst(b.x + rand(-8, 8), b.y - 6, ['#6e6e7c', '#3a3a44'], 3, 25, { life: 0.3 }); });
    G.on('recruit', (m, i) => { const q = allySlot(i); burst(q.x, q.y - 10, ['#ffd84a', '#ffffff'], 30, 90); ring(q.x, q.y - 4, 20, 10, '#ffd84a', 0.5); cardText(0, G.t('joined', G.L(G.CLASS_BY_ID[m.cls].name)).toUpperCase(), '#ffd84a', 6, { life: 2.4, vy: -3, big: true }); cardText(9, G.t('role_' + G.ROLES[m.cls]), '#ffffff', 3, { life: 2.4, vy: -3 }); });
    G.on('evStart', (ev, e) => {
      if (e.id === 'jackpot') return; // the jackpot has a show of its own
      cardText(0, e.name, e.col, 7, { life: 2.6, vy: -2, big: true, now: true });
      cardText(10, e.sub, '#ffffff', 3, { life: 2.6, vy: -2 });
      St.flash(0.3, e.col); St.shake(e.id === 'ambush' || e.id === 'stampede' || e.id === 'warlord' ? 6 : 3);
      if (G.Audio && G.Audio.event) G.Audio.event(e.id);
    });
    G.on('evEnd', (ev, e, ok, reward) => {
      if (reward && ev.k === 'stampede') cardText(0, G.t('evHeld', reward), '#ffd84a', 6, { life: 2.2, vy: -3, big: true });
      else if (reward && (ev.k === 'ambush' || ev.k === 'portals' || ev.k === 'warlord')) cardText(0, G.t('evCleared', reward), '#ffd84a', 6, { life: 2.2, vy: -3, big: true });
      else if (ok && ev.k === 'goblins' && ev.ids.every(id => !G.R.mobs.some(m => m.id === id)) && ev.t > 0) cardText(0, G.t('evCaught'), '#8ae07a', 6, { life: 2, vy: -3, big: true });
      if (reward && G.Audio && G.Audio.levelUp) G.Audio.levelUp();
    });
    G.on('jackpot', (m, gold) => {
      jp = { t: 0, gold };
      hitstop = Math.max(hitstop, 0.5); slowmo = Math.max(slowmo, 2.5);
      St.flash(1, '#fff3a0'); St.shake(10);
      if (G.Audio && G.Audio.jackpot) G.Audio.jackpot();
    });
    G.on('portalTap', po => { const q = porPos(po); burst(q.x, q.y - 16, ['#c88aff', '#ffffff'], 12, 80, { life: 0.35 }); St.shake(1); if (G.Audio && G.Audio.click) G.Audio.click(0, true); });
    G.on('portalShut', po => { const q = porPos(po); ring(q.x, q.y - 10, 30, 15, '#c88aff', 0.6); text(q.x, q.y - 40, G.t('portalShut'), '#c88aff', 5, { life: 1.2, vy: -12 }); St.flash(0.12, '#c88aff'); });
    G.on('portalSpill', po => { const q = porPos(po); ring(q.x, q.y - 6, 14, 7, '#7a3aff', 0.3); });
    G.on('meteorFall', () => { if (G.Audio && G.Audio.whoosh) G.Audio.whoosh(); });
    G.on('meteorHit', mt => {
      const q = metPos(mt);
      burst(q.x, q.y - 3, ['#ffd84a', '#ff7a2e', '#ff3b3b', '#3a2a24'], 26, 110);
      ring(q.x, q.y - 2, 22, 11, '#ff7a2e', 0.45);
      decal(q.x, q.y, ['#2a1a14', '#3a2418', '#1a0e0a'], 7);
      St.shake(3); hitstop = Math.max(hitstop, 0.03);
      if (G.Audio && G.Audio.boom) G.Audio.boom();
    });
    G.on('meteorSmash', (mt, g) => {
      const q = metPos(mt), f = 1 - mt.t / mt.T, mx = q.x + (1 - f) * 70, my = q.y - 6 - (1 - f) * 130;
      burst(mx, my, ['#ffd84a', '#ffffff', '#ff7a2e'], 18, 90);
      text(mx, my - 8, G.t('evSmashed', G.fmt(g)), '#ffd84a', 4, { life: 1.2, max: 1.2, vy: -14 });
      if (G.Audio && G.Audio.click) G.Audio.click(40, true);
    });
    // the Hand's powers
    G.on('power', id => {
      const b = btnPos();
      if (id === 'smite') {
        const tp = bossVis ? bossPos() : b;
        // three bolts from the top of the sky
        for (let i = 0; i < 3; i++) { const x0 = tp.x + rand(-30, 30), pts = [[x0, 0]]; for (let j = 1; j < 7; j++) pts.push([x0 + (tp.x - x0) * j / 7 + rand(-6, 6), (tp.y - 10) * j / 7]); pts.push([tp.x + rand(-4, 4), tp.y - 10]); bolts.push({ pts, life: 0.35 }); }
        burst(tp.x, tp.y - 10, ['#ffffff', '#7fe9ff', '#ffd84a'], 40, 140); ring(tp.x, tp.y - 6, 40, 20, '#7fe9ff', 0.6);
        St.flash(0.45, '#bff4ff'); St.shake(6); hitstop = Math.max(hitstop, 0.08);
        if (G.Audio && G.Audio.boom) G.Audio.boom();
      } else if (id === 'ward') {
        ring(b.x, b.y - 6, 46, 26, '#ffd84a', 0.6); St.flash(0.2, '#ffd84a');
        if (G.Audio && G.Audio.pulse) G.Audio.pulse();
      } else if (id === 'mend') {
        for (const u of G.partyUnits ? G.partyUnits() : []) { const q = unitPos(u.who); burst(q.x, q.y - 10, ['#8ae07a', '#ffffff'], 12, 50, { grav: -30, life: 0.7 }); }
        burst(b.x, b.y - 8, ['#8ae07a', '#ffffff'], 20, 60, { grav: -30, life: 0.8 });
        if (G.Audio && G.Audio.revive) G.Audio.revive();
      }
    });
    let blockT = 0;
    G.on('warded', who => { if (time - blockT < 0.35) return; blockT = time; const q = unitPos(who); text(q.x + rand(-6, 6), q.y - 26, G.t('blocked'), '#ffd84a', 3, { life: 0.6, max: 0.6, vy: -16 }); });
    G.on('slotOpen', () => { cardText(0, G.t('slotOpen'), '#ffd84a', 6, { life: 3, vy: -2, big: true }); cardText(9, G.t('slotOpenSub'), '#ffffff', 3, { life: 3, vy: -2 }); if (G.Audio && G.Audio.levelUp) G.Audio.levelUp(); });
    G.on('invasion', (r, V) => {
      St.flash(0.4, V.col); St.shake(4);
      cardText(0, V.name, V.col, 8, { life: 3, vy: -2, big: true });
      cardText(11, V.sub, '#ffffff', 3, { life: 3, vy: -2 });
      if (G.Audio && G.Audio.invasion) G.Audio.invasion(V.id);
    });
    G.on('invasionBoss', (m, V) => { cardText(0, V.bossName.toUpperCase(), V.col, 7, { life: 2.4, vy: -2, big: true }); cardText(10, G.t('heraldSub'), '#ffffff', 3, { life: 2.4, vy: -2 }); St.shake(5); });
    G.on('invasionEnd', (won, r) => { const V = G.INV_BY_ID[r.k]; cardText(0, won ? G.t('invWon') : G.t('invLost'), won ? '#ffd84a' : '#c8b4ff', 7, { life: 2.6, vy: -2, big: true }); if (won) { St.flash(0.4, '#ffd84a'); St.shake(6); } });
    G.on('wipe', (from, to, rift) => {
      const fell = G.R.fell;
      if (fell) { buttonBoom(); return; }
      St.flash(0.9, '#3a0000'); St.shake(9); slowmo = Math.max(slowmo, 1.2);
      cardText(0, G.t('wipeTitle'), '#ff4f4f', 8, { life: 3.4, vy: -2, big: true });
      cardText(11, rift ? G.t('wipeRift') : to < from ? G.t('wipeBack', to + 1) : G.t('wipeBar'), '#ffffff', 3, { life: 3.4, vy: -2 });
      if (G.Audio && G.Audio.wipe) G.Audio.wipe();
    });
    // 3.6: the Button falls for good: it bursts. A white flash, a held frame, the Button in pieces flying out,
    // three shockwaves, fire and sparks, BOOM! on the field, and a smoking crater where it stood until the choice
    G.on('runContinue', () => {
      const b = btnPos();
      fallT = -1;
      btnSpring.s = 0.25; btnSpring.v = 0.2;
      St.flash(0.8, '#ffd0f0'); St.shake(6); hitstop = Math.max(hitstop, 0.08);
      ring(b.x, b.y - 8, 26, 14, '#ffffff', 0.5); ring(b.x, b.y - 8, 70, 38, '#ff5ad2', 0.6); ring(b.x, b.y - 8, 120, 66, '#ffe0f6', 0.75);
      burst(b.x, b.y - 10, ['#ff5ad2', '#ffe0f6', '#ffffff', '#ffd84a'], Math.round(70 * Q.particles), 170);
      cardText(0, G.t('fellBack'), '#ff8ae0', 8, { life: 2.4, vy: -2, big: true, now: true });
      cardText(11, G.t('fellBackSub'), '#ffffff', 3, { life: 2.4, vy: -2 });
      if (G.Audio) { if (G.Audio.levelUp) G.Audio.levelUp(); if (G.Audio.gem) G.Audio.gem(); }
    });
    // a phase card still waiting when the fight ends is stale
    const dropPhase = () => { for (let i = cardQ.length - 1; i >= 0; i--) if (cardQ[i].tag === 'phase') cardQ.splice(i, 1); };
    G.on('bossWin', dropPhase); G.on('bossFail', dropPhase); G.on('wipe', dropPhase);
    G.on('bossPhase', b => {
      const bp = bossPos();
      hitstop = Math.max(hitstop, 0.25); St.shake(7); St.flash(0.35, b.lord ? '#ff4f7e' : '#ffffff');
      ring(bp.x, bp.y - 8, 70, 36, '#ffffff', 0.6); ring(bp.x, bp.y - 8, 50, 26, b.lord ? '#ff4f7e' : '#ffb347', 0.5);
      burst(bp.x, bp.y - 12, ['#ffffff', '#ffb347', '#ff4f7e'], 50, 150);
      cardText(0, G.t('phaseN', b.phase), b.phase >= 3 ? '#ff4f4f' : '#ffb347', 8, { life: 2, vy: -3, big: true, now: true, tag: 'phase' });
      cardText(11, G.t(b.phase >= 3 && b.lord ? 'phaseRage' : 'phaseSub'), '#ffffff', 3, { life: 2, vy: -3 });
      if (G.Audio && G.Audio.phase) G.Audio.phase();
    });
  }
  const aVisOf = who => (who < 0 ? hero : aVis(who));
  // a tap on a fallen hero helps them up
  function hitDowned(p) {
    for (const u of G.partyUnits ? G.partyUnits() : []) {
      if (!(u.down > 0)) continue;
      const q = unitPos(u.who);
      if (Math.abs(p.x - q.x) <= 9 && Math.abs(p.y - (q.y - 3)) <= 6) return u.who;
    }
    return null;
  }
  // 3.6: the two ends of a mob's line are kept in its vis (they only change with its angle or the screen)
  let geoStamp = 0;
  function mobGeo(m, v) {
    if (v.gs === geoStamp && v.ca === m.a) return;
    v.gs = geoStamp; v.ca = m.a;
    const bx = Math.round(W / 2), by = Math.round(H * 0.54);
    const a = -Math.PI / 2 + 0.55 + m.a * (Math.PI * 2 - 1.1), j = ((m.id * 7919) % 97) / 97, c = Math.cos(a), sn = Math.sin(a);
    v.sx = bx + c * W * 0.6; v.sy = by + sn * H * 0.56; v.ex = bx + c * (21 + j * 10); v.ey = by + sn * (11 + j * 6) + 4;
  }
  function mobPos(m) {
    const v = mobVis.get(m.id);
    if (v) {
      mobGeo(m, v);
      const k = v.vp != null ? v.vp : m.p;
      const bob = m.p < 1 ? Math.round(Math.abs(Math.sin(time * (m.kind === 'fodder' ? 14 : 9) + m.id)) * 1.5) : 0;
      return { x: Math.round(v.sx + (v.ex - v.sx) * k), y: Math.round(v.sy + (v.ey - v.sy) * k) - bob };
    }
    const b = btnPos();
    const a = -Math.PI / 2 + 0.55 + m.a * (Math.PI * 2 - 1.1);
    // the crowd at the Button spreads into a loose ring instead of one pile
    const j = ((m.id * 7919) % 97) / 97;
    const sx = b.x + Math.cos(a) * W * 0.6, sy = b.y + Math.sin(a) * H * 0.56;
    const ex = b.x + Math.cos(a) * (21 + j * 10), ey = b.y + Math.sin(a) * (11 + j * 6) + 4;
    const k = m.p;
    const bob = m.p < 1 ? Math.round(Math.abs(Math.sin(time * (m.kind === 'fodder' ? 14 : 9) + m.id)) * 1.5) : 0;
    return { x: Math.round(sx + (ex - sx) * k), y: Math.round(sy + (ey - sy) * k) - bob };
  }
  // ---------- 3.6: the draw list: integer-y buckets, drawn top to bottom ----------
  // Entries are functions (chests, heroes, the Button...) or a mob's vis (v.m is the mob).
  let BK = [], BKN = 0, frameRealm = null;
  const BK0 = -96;
  function bucketsFor(h) { BKN = Math.ceil(h) + 240; while (BK.length < BKN) BK.push([]); }
  function bpush(y, e) { let i = Math.floor(y) - BK0; if (!(i >= 0)) i = 0; else if (i >= BKN) i = BKN - 1; BK[i].push(e); }
  const DL = { push(o) { bpush(o.y, o.draw); } };
  function drawBuckets() {
    for (let i = 0; i < BKN; i++) {
      const b = BK[i];
      if (!b.length) continue;
      for (let j = 0; j < b.length; j++) {
        const e = b[j];
        if (typeof e === 'function') e();
        else if (e.plain) { const spr = mobSpriteV(e.m, e, frameRealm); lctx.drawImage(spr, Math.round(e.qx - spr.width / 2), e.qy - spr.height); }
        else drawMobV(e.m, e, e.qx, e.qy, frameRealm, false);
      }
      b.length = 0;
    }
  }
  // which mobs are on screen this frame, where, and (over the tier's cap) which far small fry to leave out;
  // then all their shadows in one go, then into the buckets
  const mobsOn = [];
  let keepK = 1;
  const keepHash = id => ((id * 2654435761) >>> 0) / 4294967296;
  const named = [];
  let focusId = null;
  function collectMobs(mobs, vdt) {
    mobsOn.length = 0; named.length = 0; focusId = G.R.focus;
    const kk = Math.min(1, vdt * 14);
    let nFod = 0, nFar = 0;
    for (let i = 0; i < mobs.length; i++) {
      const m = mobs[i];
      let v = mobVis.get(m.id);
      if (!v) { v = { hit: 0 }; mobVis.set(m.id, v); }
      v.vp = v.vp == null ? m.p : v.vp + (m.p - v.vp) * kk;
      mobGeo(m, v);
      const k = v.vp, bob = m.p < 1 ? Math.round(Math.abs(Math.sin(time * (m.kind === 'fodder' ? 14 : 9) + m.id)) * 1.5) : 0;
      const x = Math.round(v.sx + (v.ex - v.sx) * k), y = Math.round(v.sy + (v.ey - v.sy) * k) - bob;
      // still walking in from past the edge
      if (x < -12 || x > W + 12 || y < -4 || y > H + 20) continue;
      v.qx = x; v.qy = y; v.m = m;
      v.fod = !!G.SMALL[m.kind];
      // a plain small one (no glow, no hit, not in the air): drawn by the short path
      v.plain = m.kind === 'fodder' && !m.br && !m.amb && !(m.bT > 0) && !m.fz && !(m.jz > 0) && !m.fly && !(m.pop > 0) && !(v.hit > 0) && !(v.lunge > 0) && !m.wl && !m.gob && !m.inv && focusId !== m.id;
      if (v.fod) { nFod++; if (m.p < 0.7) nFar++; }
      else if (m.kind === 'hoard' || m.kind === 'guardian' || m.kind === 'rare' || (m.kind === 'magic' && m.mod)) named.push(m);
      mobsOn.push(v);
    }
    // over the cap, the far small fry thin out evenly (by a fixed pick per mob, so none of them flickers)
    const cap = Q.mobCap, over = nFod - cap;
    const want = over > 0 && nFar > 0 ? clamp((nFar - over) / nFar, 0.15, 1) : 1;
    keepK += (want - keepK) * Math.min(1, vdt * 2);
    const keep = Math.round(keepK * 16) / 16;
    const shadowsOn = Q.shadows;
    lctx.fillStyle = 'rgba(0,0,0,0.28)';
    let drawn = 0;
    for (let i = 0; i < mobsOn.length; i++) {
      const v = mobsOn[i], m = v.m;
      if (keep < 1 && v.fod && m.p < 0.7 && keepHash(m.id) >= keep) continue;
      drawn++;
      if (m.kind !== 'guardian') {
        // the shadow (3.6: drawn for all mobs here, before anything stands on the ground)
        if (shadowsOn || !v.fod) {
          const w = m.fly ? 3 : m.jz > 0 ? Math.max(4, Math.round(10 - 5 * m.jz)) : v.fod ? 6 : 10, sx = Math.round(v.qx - w / 2), sy = v.qy - 1;
          lctx.fillRect(sx, sy, w, 2);
          if (shadowsOn > 1 || !v.fod) lctx.fillRect(sx + 1, sy - 1, w - 2, 1);
        }
      }
      bpush(v.qy, v);
    }
    Q.drawn = drawn; Q.onScreen = mobsOn.length; Q.far = nFar;
  }
  function mobVisOf(m) { let v = mobVis.get(m.id); if (!v) { v = { hit: 0 }; mobVis.set(m.id, v); } return v; }
  const QP = { x: 0, y: 0 };
  function hitMob(p) {
    let best = null, bd = 1e9;
    for (const m of G.R.mobs || []) {
      const q = mobPos(m);
      const dx = p.x - q.x, dy = p.y - (q.y - 7);
      if (Math.abs(dx) <= 10 && Math.abs(dy) <= 10) { const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = m; } }
    }
    return best;
  }
  function mobSprite(m, realm) {
    if (m.gob) { const f = Math.floor(time * 8 + m.id) % 2 ? 'm_thief_1' : 'm_thief'; return SPR.defs[f] ? SPR.get(f) : SPR.get('m_hoard'); }
    // an invasion's mobs come in its own shapes
    if (m.inv && G.INV_BY_ID[m.inv]) {
      const V = G.INV_BY_ID[m.inv];
      if (m.kind === 'guardian') return SPR.boss(V.boss, true).canvas;
      const id = G.SMALL[m.kind] ? V.swarm : V.elite;
      if (SPR.defs[id]) return SPR.get(id, m.kind === 'magic' ? { oc: '#3f7fff' } : m.kind === 'rare' ? { oc: '#ffd84a' } : null);
    }
    // 3.4 (js/art6.js): each mob wears one of its land's skins, picked by its id, and steps between two frames
    const fr = id => (G.mobFrame ? G.mobFrame(id, time, m) : id);
    if (m.kind === 'fodder') return SPR.get(fr(G.mobSkin ? G.mobSkin(m, realm) : realm.fodder));
    if (G.ARCHETYPES && G.ARCHETYPES[m.kind]) {
      const aid = 'a_' + m.kind + '_' + realm.id;
      // a leaper shows its crouch while it gathers itself
      if (m.kind === 'leaper' && SPR.defs[aid + '_2']) return SPR.get(m.lst === 1 ? aid + '_2' : aid);
      return SPR.defs[aid] ? SPR.get(fr(aid)) : SPR.arch(m.kind, realm.id);
    }
    if (m.kind === 'hoard') return SPR.get('m_hoard');
    if (m.kind === 'guardian') return SPR.boss(m.lord || realm.lord, true).canvas;
    return SPR.get(fr(G.mobSkin ? G.mobSkin(m, realm) : realm.minion), m.kind === 'magic' ? { oc: '#3f7fff' } : m.kind === 'rare' ? { oc: '#ffd84a' } : null);
  }
  const MOB_BAR = { brute: '#e84a4a', magic: '#5a9cff', rare: '#ffd84a', tank: '#c8c8d4', spitter: '#b6ff5a', bomber: '#ff7a2e', leaper: '#b6ff5a', shieldwall: '#9ad8ff', blob: '#5ae8ff', blob1: '#5ae8ff', blob2: '#5ae8ff', mole: '#c8a070' };
  // 3.6: a mob's sprites are looked up once (per land and kind) and kept in its vis; the walk frame is picked by time
  const OC_MAGIC = { oc: '#3f7fff' }, OC_RARE = { oc: '#ffd84a' };
  function mobSpriteV(m, v, realm) {
    if (v.sr !== realm || v.sk !== m.kind) {
      v.sr = realm; v.sk = m.kind; v.s0 = v.s1 = null; v.fr = 0;
      if (!m.gob && !(m.inv && G.INV_BY_ID[m.inv]) && m.kind !== 'leaper' && m.kind !== 'hoard' && m.kind !== 'guardian') {
        let id = null, opt = null;
        if (m.kind === 'fodder') id = G.mobSkin ? G.mobSkin(m, realm) : realm.fodder;
        else if (G.ARCHETYPES && G.ARCHETYPES[m.kind]) { const aid = 'a_' + m.kind + '_' + realm.id; if (SPR.defs[aid]) id = aid; else v.s0 = v.s1 = SPR.arch(m.kind, realm.id); }
        else { id = G.mobSkin ? G.mobSkin(m, realm) : realm.minion; opt = m.kind === 'magic' ? OC_MAGIC : m.kind === 'rare' ? OC_RARE : null; }
        if (id) { v.s0 = SPR.get(id, opt); v.s1 = G.mobFrame && SPR.defs[id + '_2'] ? SPR.get(id + '_2', opt) : v.s0; v.fr = m.kind === 'fodder' ? 7 : 4.5; }
      }
    }
    if (!v.s0) return mobSprite(m, realm);
    if (v.s1 === v.s0 || m.p >= 1 || m.held || m.p < 0) return v.s0;
    return Math.floor(time * v.fr + m.id * 0.37) % 2 ? v.s1 : v.s0;
  }
  function drawMob(m, q, realm) { drawMobV(m, mobVisOf(m), q.x, q.y, realm, true); }
  function drawMobV(m, v, qx, qy, realm, withShadow) {
    const q = QP; QP.x = qx; QP.y = qy;
    const spr = mobSpriteV(m, v, realm);
    const fod = !!G.SMALL[m.kind];
    if (m.kind === 'guardian') { drawGuardian(m, spr, v, { x: qx, y: qy }); return; }
    if (withShadow) shadow(q.x, q.y - 1, m.fly ? 3 : m.jz > 0 ? Math.max(4, Math.round(10 - 5 * m.jz)) : fod ? 6 : 10);
    const gl = Q.glows;
    if (m.br && (gl > 1 || !fod)) glow(q.x, q.y - 5, fod ? 4 : 7, '#b36bff', 0.28);
    if (m.kind === 'hoard') {
      glow(q.x, q.y - 7, 9, '#ffd84a', 0.28 + 0.1 * Math.sin(time * 8));
      if (Math.random() < 0.35) part(q.x + rand(-4, 4), q.y - rand(2, 10), pick(['#ffd84a', '#fff3a0']), { vy: -10, vx: rand(-8, 8), grav: 60, life: 0.5 });
      if (v.hit > 0 && Math.random() < 0.5 && coins.length < 240) coins.push({ x: q.x, y: q.y - 8, vx: rand(-50, 50), vy: rand(-90, -40), floor: q.y + rand(-2, 3), t: rand(0.4, 0.7), fly: 0 });
    }
    if (m.kind === 'magic') glow(q.x, q.y - 8, 7, '#3f7fff', 0.2 + 0.07 * Math.sin(time * 5 + m.id));
    if (m.amb && (gl > 0 || !fod)) glow(q.x, q.y - 6, 9, '#ff3b3b', 0.22 + 0.1 * Math.sin(time * 9 + m.id));
    if (m.gob && Math.random() < 0.15 && coins.length < 200) coins.push({ x: q.x, y: q.y - 6, vx: rand(-20, 20), vy: rand(-50, -20), floor: q.y + rand(-2, 3), t: rand(0.4, 0.7), fly: 0 });
    // a spitter swells before it spits; a bomber's fuse fizzes, faster as it gets close
    if (m.kind === 'spitter' && m.p >= (G.TUNE.spitStop || 0.68) && m.atkT < 0.6) glow(q.x, q.y - 5, 5, '#b6ff5a', 0.25 + 0.5 * (0.6 - m.atkT));
    if (m.kind === 'bomber') {
      if (Math.random() < 0.3) part(q.x + 2, q.y - 9, pick(['#ffe27a', '#ff7a2e', '#ffffff']), { vx: rand(-10, 10), vy: rand(-30, -10), grav: 40, life: 0.25 });
      if (m.p > 0.75 && Math.sin(time * (10 + 20 * m.p)) > 0.4) glow(q.x, q.y - 5, 5, '#ff3b3b', 0.35);
    }
    if (m.kind === 'runner' && m.p > 0 && Math.random() < 0.15) part(q.x, q.y - 1, '#d8cfb8', { vx: 0, vy: -4, grav: 0, life: 0.3 });
    if (m.kind === 'rare') glow(q.x, q.y - 9, 10, '#ffd84a', 0.24 + 0.08 * Math.sin(time * 6));
    if (fod ? m.id % 3 === 0 && gl > 1 : gl > 0) {
      if (m.bT > 0) glow(q.x, q.y - 6, 6, '#ff7a2e', 0.22 + 0.08 * Math.sin(time * 12 + m.id));
      if (m.fz) glow(q.x, q.y - 6, 6, '#7fc8ff', 0.25);
    }
    let x = q.x, y = q.y;
    // 3.4 (js/mobs2.js): a leaper in the air, a gnat on the wing, a mole still half underground
    if (m.jz > 0) y -= Math.round(m.jz * 16);
    if (m.fly) y -= 7 + Math.round(Math.sin(time * 18 + m.id));
    if (m.pop > 0) y += Math.round(8 * m.pop / (G.TUNE.molePop || 0.45));
    if (m.kind === 'shieldwall' && m.blk > 0 && m.wall) glow(q.x + 1, q.y - 7, 6, '#9ad8ff', 0.12 + 0.05 * Math.sin(time * 6 + m.id));
    // a hit knocks it back from the Button for a moment, a small one further
    if (v.hit > 0) { const dx = q.x - Math.round(W / 2), dy = q.y - Math.round(H * 0.54), l = Math.hypot(dx, dy) || 1, k = v.hit * (fod ? 34 : 18); x += Math.round(dx / l * k + rand(-1, 1)); y += Math.round(dy / l * k * 0.6); }
    if (v.lunge > 0) { x += Math.sign(Math.round(W / 2) - q.x) * 2; v.lunge -= fdt; }
    // the Warlord stands twice as tall, with a red aura and its name over it
    const sc = m.wl ? 2.2 : 1;
    if (m.wl) { glow(x, y - 14, 18, '#ff3b3b', 0.25 + 0.1 * Math.sin(time * 5)); if (Math.random() < 0.2) part(x + rand(-8, 8), y - 1, '#5a3a2a', { vx: rand(-10, 10), vy: -rand(4, 10), grav: 30, life: 0.4 }); }
    blit(spr, x, y, sc);
    if (v.hit > 0) { blit(white(spr), x, y, sc, Math.min(0.85, v.hit * 10)); v.hit -= fdt; }
    if (m.wl) wlMark = { x, y: y - spr.height * sc - 6, k: m.hp / m.max };
    if (!fod && m.hp < m.max) {
      const w = m.kind === 'rare' || m.kind === 'hoard' || m.kind === 'tank' ? 16 : m.kind === 'bomber' || m.kind === 'spitter' ? 8 : 12, k = clamp(m.hp / m.max, 0, 1);
      lctx.fillStyle = '#0c0b12'; lctx.fillRect(q.x - w / 2 - 1, q.y - 21, w + 2, 3);
      lctx.fillStyle = MOB_BAR[m.kind] || '#ffd84a'; lctx.fillRect(q.x - w / 2, q.y - 20, Math.max(1, Math.round(w * k)), 1);
    }
    if (G.R.focus === m.id) {
      lctx.fillStyle = '#ffffff';
      const r = fod ? 6 : 9, y = q.y - (fod ? 4 : 8);
      lctx.fillRect(q.x - r, y - r, 3, 1); lctx.fillRect(q.x - r, y - r, 1, 3);
      lctx.fillRect(q.x + r - 2, y - r, 3, 1); lctx.fillRect(q.x + r, y - r, 1, 3);
      lctx.fillRect(q.x - r, y + r, 3, 1); lctx.fillRect(q.x - r, y + r - 2, 1, 3);
      lctx.fillRect(q.x + r - 2, y + r, 3, 1); lctx.fillRect(q.x + r, y + r - 2, 1, 3);
    }
  }
  // a burrower's mound moving under the ground, kicking up dirt
  function drawDig(q, dg) {
    const w = 5 + Math.round(2 * Math.sin(time * 9 + dg.id));
    lctx.fillStyle = '#3a2a1a'; lctx.fillRect(q.x - (w >> 1) - 1, q.y - 2, w + 2, 2);
    lctx.fillStyle = '#7a5a3a'; lctx.fillRect(q.x - (w >> 1), q.y - 3, w, 2);
    lctx.fillStyle = '#a8845a'; lctx.fillRect(q.x - 1, q.y - 4, 2, 1);
    if (Math.random() < 0.3) part(q.x + rand(-3, 3), q.y - 3, pick(['#7a5a3a', '#a8845a', '#5a3a22']), { vx: rand(-14, 14), vy: rand(-30, -10), grav: 90, life: 0.35 });
  }
  // Spitters' globs, arcing from the spitter to the Button
  function drawShotsInFlight() {
    const sh = G.R.shots;
    if (!sh || !sh.length) return;
    const b = btnPos();
    for (const x of sh) {
      const q = mobPos({ id: x.m, a: x.a, p: x.p }), k = clamp(1 - x.t / 0.5, 0, 1);
      const px = Math.round(q.x + (b.x - q.x) * k), py = Math.round(q.y - 8 + (b.y - 6 - q.y + 8) * k - Math.sin(k * Math.PI) * 16);
      lctx.fillStyle = '#0c0b12'; lctx.fillRect(px - 2, py - 2, 5, 5);
      lctx.fillStyle = '#b6ff5a'; lctx.fillRect(px - 1, py - 1, 3, 3);
      lctx.fillStyle = '#ffffff'; lctx.fillRect(px - 1, py - 1, 1, 1);
      if (Math.random() < 0.4) part(px, py, '#8ad83a', { vx: rand(-6, 6), vy: rand(-4, 4), grav: 30, life: 0.25 });
    }
  }
  function drawGuardian(m, spr, v, q) {
    const sc = 2;
    shadow(q.x, q.y - 1, Math.round(spr.width * sc * 0.7));
    glow(q.x, q.y - spr.height * sc / 2, Math.round(spr.width * sc / 2.5), '#ff3b5c', 0.18 + 0.07 * Math.sin(time * 5));
    let x = q.x;
    if (v.hit > 0) x += Math.round(rand(-1, 1));
    blit(spr, x, q.y, sc);
    if (v.hit > 0) { blit(white(spr), x, q.y, sc, Math.min(0.6, v.hit * 8)); v.hit -= fdt; }
    if (Math.random() < 0.4) part(q.x + rand(-10, 10), q.y - rand(0, spr.height * sc), pick(['#b36bff', '#ff3b5c']), { vx: 0, vy: -20, grav: 0, life: 0.5 });
  }
  const MELEE = { dagger: 1, sword: 1, katana: 1, scythe: 1 };
  // The Warden's hits on a boss add up into floating numbers a few times a second
  const bossDmg = { acc: 0, t: 0, crit: false };
  function onHeroAttack(ev) {
    const h = G.S.hero;
    if (!h || !h.cls) return;
    if (ev.boss) { bossDmg.acc += ev.dmg * (G.D.bossMult || 1); bossDmg.crit = bossDmg.crit || ev.crit; }
    const D = G.D, wt = D.hero ? D.hero.wtype : 'dagger';
    // The Hand: a click calls lightning down from above the screen
    if (ev.src === 'click' || ev.src === 'pet') {
      const find = id => { const m = mobById(id); return m ? Object.assign(mobPos(m), { m }) : null; };
      const pts = ev.boss ? [Object.assign({}, bossPos(), { y: bossPos().y - 12 })] : (ev.ids || []).map(find).filter(Boolean);
      if (!pts.length) return;
      for (const id of ev.splash || []) mobVisOf({ id }).hit = 0.07;
      if (ev.src === 'pet') {
        if (shots.length > 90) return;
        const t = pts[0], pp = petPos(Math.floor(Math.random() * Math.max(1, G.S.active.length)));
        if (G.S.active.length) shots.push({ x: pp.x, y: pp.y, sx: pp.x, sy: pp.y, tx: t.x, ty: t.y - 6, t: 0, dur: 0.22, col: '#fff3a0' });
        return;
      }
      if (ev.boss) { bossHitT = 0.07; return; }
      const t = pts[0], ty = t.y - 6;
      if (t.m) mobVisOf(t.m).hit = 0.1;
      const x0 = t.x + rand(-12, 12), path = [[x0, -4]];
      for (let i = 1; i < 6; i++) path.push([x0 + (t.x - x0) * i / 6 + rand(-4, 4), -4 + (ty + 4) * i / 6]);
      path.push([t.x, ty]);
      bolts.push({ pts: path, life: 0.16, cols: ['#ffffff', '#ffe27a'], wide: true });
      glow(t.x, ty, 5, '#ffffff', 0.5);
      if (Math.random() < 0.5) decal(t.x, t.y, '#2a2418', 2);
      const r = aoePx(G.TUNE.smiteR);
      ring(t.x, t.y - 3, r.rx, r.ry, '#ffe27a', 0.22);
      burst(t.x, ty, ['#ffffff', '#ffe27a'], 5, 60, { life: 0.3 });
      if (ev.crit && critWord()) text(t.x, ty - 8, G.t('crit'), '#ff7a2e', 3, { vy: -20, life: 0.6, max: 0.6, dmg: true });
      return;
    }
    // 3.5: the Warden's own blows are drawn like a companion's, in its class's style and a size up
    unitAttack(-1, ev, wt);
    if (ev.crit && !ev.boss && ev.ids && ev.ids.length && critWord()) { const m = mobById(ev.ids[0]); if (m) { const q = mobPos(m); text(q.x, q.y - 16, G.t('crit'), '#ff7a2e', 3, { vy: -20, life: 0.6, max: 0.6, dmg: true }); } }
  }

  // ---------- Horde FX: the crunch ----------
  // Every death breaks the sprite itself into chunks that fly, bounce and
  // settle, and leaves a stain. Each land dies its own way.
  const GORE = {
    shore:     { blood: '#d8642a', style: 'splat' },
    meadow:    { blood: '#8e1f1f', style: 'splat' },
    forest:    { blood: '#7a2596', style: 'spores' },
    highlands: { blood: '#55555f', style: 'shatter' },
    tundra:    { blood: '#6fb4f0', style: 'shatter' },
    godlands:  { blood: '#5f2aa8', style: 'splat' },
    abyss:     { blood: '#e0541c', style: 'embers' },
    void:      { blood: '#2e1c52', style: 'dissolve' },
    library:   { blood: '#1f3a6a', style: 'ink' },
    foundry:   { blood: '#3a3028', style: 'sparks' },
    ember:     { blood: '#1e1210', style: 'embers' },
    mirror:    { blood: '#9aa2bc', style: 'glass' },
    sky:       { blood: '#c8b070', style: 'feathers' },
    moon:      { blood: '#9aa2bc', style: 'glass' },
    cosmos:    { blood: '#3a2a6a', style: 'dissolve' },
  };
  const chunkCache = new WeakMap();
  // 2x2 blocks of a sprite's opaque pixels, sampled once per sprite
  function chunks(c) {
    let out = chunkCache.get(c);
    if (out) return out;
    out = [];
    try {
      // (a sprite built by SPR keeps its pixels: no read-back)
      const d = c._px && c._px.length === c.width * c.height * 4 ? c._px : c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) {
        let col = null, n = 0;
        for (let k = 0; k < 4; k++) {
          const px = x + (k & 1), py = y + (k >> 1);
          if (px >= c.width || py >= c.height) continue;
          const i = (py * c.width + px) * 4;
          if (d[i + 3] < 128) continue;
          n++;
          const hex = '#' + ((1 << 24) | (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]).toString(16).slice(1);
          if (!col || col === '#0c0b12') col = hex;
        }
        if (n >= 2 && col !== '#0c0b12' && col !== '#1a1a22') out.push({ x, y, col });
      }
    } catch (e) { /* canvas unreadable: deaths fall back to plain particles */ }
    chunkCache.set(c, out);
    return out;
  }
  let gOver = 0;
  function gib(o) {
    o.max = o.life;
    if (gibs.length >= Q.maxG) { gibs[gOver = (gOver + 1) % gibs.length] = o; return; }
    gibs.push(o);
  }
  // 3.6: the Button's last moment (see the 'wipe' handler): fallT counts the seconds since, -1 when it stands
  let fallT = -1;
  function buttonBoom() {
    const b = btnPos(), spr = btnSprite(btnLookNow(), false);
    fallT = 0;
    hitstop = Math.max(hitstop, 0.16); slowmo = Math.max(slowmo, 1.6);
    St.flash(1, '#ffffff'); St.shake(16); kick = 1;
    explodeSprite(spr, b.x, b.y + 4, 1, Math.round(110 * Math.max(0.4, Q.particles)), 2.6, 'shatter');
    explodeSprite(spr, b.x, b.y + 4, 2, Math.round(26 * Math.max(0.5, Q.particles)), 1.6);
    ring(b.x, b.y - 8, 34, 18, '#ffffff', 0.35); ring(b.x, b.y - 8, 110, 60, '#ffd84a', 0.6);
    ring(b.x, b.y - 8, 190, 104, '#ff7a2e', 0.85); ring(b.x, b.y - 4, 260, 140, '#ff4f4f', 1.1);
    burst(b.x, b.y - 12, ['#ffffff', '#fff3a0', '#ffd84a', '#ff7a2e', '#ff4f4f'], Math.round(120 * Q.particles), 300);
    burst(b.x, b.y - 6, ['#6e6e7c', '#3a3a44', '#2a2630'], Math.round(40 * Q.particles), 90, { grav: -20, life: 1.6 });
    for (let i = 0; i < 6; i++) decal(b.x + rand(-26, 26), b.y + rand(-4, 6), '#120c10', rand(4, 9));
    texts.length = 0; cardQ.length = 0;
    text(b.x, b.y - 30, G.t('fellCard'), '#ffb347', 11, { life: 1.8, max: 1.8, vy: -10, big: true, pop: 0.3 });
    if (G.Audio) { if (G.Audio.wipe) G.Audio.wipe(); if (G.Audio.boom) { G.Audio.boom(); setTimeout(() => G.Audio.boom(), 90); setTimeout(() => G.Audio.boom(), 220); } }
  }
  // where it stood: a scorched crater, smoke and embers (while the choice waits)
  function drawCrater(b) {
    if (fallT < 0) fallT = 1.5; // (a fall from before a reload)
    fallT += fdt;
    // the fireball, for its first half second
    if (fallT < 0.6) { const k = 1 - fallT / 0.6; glow(b.x, b.y - 10, 30 + 50 * (1 - k * k), '#ffd84a', 0.7 * k); glow(b.x, b.y - 10, 16 + 30 * (1 - k), '#ffffff', 0.8 * k); }
    shadow(b.x, b.y + 1, 40);
    lctx.fillStyle = '#120c10'; lctx.fillRect(b.x - 16, b.y, 32, 3); lctx.fillRect(b.x - 11, b.y - 1, 22, 1); lctx.fillRect(b.x - 20, b.y + 1, 40, 1);
    lctx.fillStyle = '#3a3348';
    for (const [dx, dy, w] of [[-14, -1, 4], [-6, -2, 3], [5, -1, 5], [12, 0, 3], [-2, 1, 2]]) lctx.fillRect(b.x + dx, b.y + dy, w, 2);
    const ember = 0.5 + 0.5 * Math.sin(time * 9);
    lctx.globalAlpha = 0.5 + 0.4 * ember; lctx.fillStyle = '#ff7a2e'; lctx.fillRect(b.x - 3, b.y, 2, 1); lctx.fillRect(b.x + 6, b.y + 1, 1, 1); lctx.fillRect(b.x - 10, b.y + 1, 1, 1); lctx.globalAlpha = 1;
    if (Math.random() < 0.35) part(b.x + rand(-12, 12), b.y - rand(0, 4), pick(['#6e6e7c', '#3a3a44', '#4a4450']), { vx: rand(-6, 6), vy: -rand(10, 26), grav: -8, life: 1.4 });
    if (Math.random() < 0.08) part(b.x + rand(-8, 8), b.y - 1, '#ff7a2e', { vx: rand(-10, 10), vy: -rand(20, 40), grav: 30, life: 0.5 });
  }
  // Break a sprite drawn at (x, y) (bottom-centre anchor, scale sc) into flying chunks
  function explodeSprite(c, x, y, sc, n, force, style) {
    const ch = chunks(c);
    if (!ch.length) { burst(x, y - 6, '#ffffff', 10, 60 * force); return; }
    const b = btnPos();
    let dx = x - b.x, dy = y - b.y;
    const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
    const w = c.width * sc, h = c.height * sc;
    for (let i = 0; i < n; i++) {
      const k = ch[Math.floor(Math.random() * ch.length)];
      const ox = k.x * sc - w / 2, oy = k.y * sc - h;
      gib({
        x: x + ox, y: y + oy, col: k.col, s: style === 'shatter' ? Math.max(1, sc) : 2 * sc,
        vx: (ox * rand(3, 8) / sc + dx * rand(20, 70)) * force, vy: (-rand(45, 120) + dy * rand(0, 30)) * force,
        floor: y + rand(-2, 4), b: 0, life: rand(0.9, 1.9), style,
      });
    }
  }
  // Blood soaks into the ground: splats are painted once onto a layer over the
  // ground that slowly fades, so a slaughter leaves the arena stained
  let stain = null, stainCtx = null, stainFade = 0, stainSweep = 0;
  function stainLayer() {
    if (!stain || stain.width !== W || stain.height !== H) { stain = SPR.makeCanvas(W, H); stainCtx = stain.getContext('2d', { willReadFrequently: true }); }
    return stainCtx;
  }
  St.clearStain = () => { if (stainCtx) stainCtx.clearRect(0, 0, W, H); };
  // 3.6: a splat is stamped from one of six ready-made ones per colour and size (the same dots, painted once)
  const splats = new Map();
  function splat(col, r) {
    const key = col + '|' + r + '|' + Math.floor(Math.random() * 6);
    let c = splats.get(key);
    if (c) return c;
    if (splats.size > 480) splats.clear();
    const R2 = Math.ceil(r * 1.6) + 1, w = R2 * 2 + 1, h = Math.ceil(r * 0.8) * 2 + 3;
    c = SPR.makeCanvas(w, h); c.ox = R2; c.oy = h >> 1;
    const x = c.getContext('2d'), n = Math.round(r * 4);
    x.globalAlpha = 0.5; x.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, d = Math.pow(Math.random(), 1.6) * r;
      x.fillRect(c.ox + Math.round(Math.cos(a) * d), c.oy + Math.round(Math.sin(a) * d * 0.5), 1, 1);
    }
    for (let i = 0; i < 2; i++) { const a = Math.random() * 6.28; x.fillRect(c.ox + Math.round(Math.cos(a) * r * 1.6), c.oy + Math.round(Math.sin(a) * r * 0.8), 1, 1); }
    splats.set(key, c);
    return c;
  }
  function decal(x, y, col, r) {
    const c = stainLayer();
    if (Array.isArray(col)) col = col[Math.floor(Math.random() * col.length)];
    const sp = splat(col, Math.round(r * 2) / 2);
    c.drawImage(sp, Math.round(x) - sp.ox, Math.round(y) - sp.oy);
  }
  function ring(x, y, rx, ry, col, life, arc) {
    if (rings.length >= Q.rings) rings.shift();
    rings.push({ x, y, rx, ry, col, life, max: life, arc });
  }
  // Splash radius in arena units -> pixels (the arena is squashed vertically)
  const aoePx = a => ({ rx: a * W * 0.62, ry: a * W * 0.62 * 0.55 });

  const streak = { n: 0, t: 9, pop: 0, at: -99 };
  let multiCd = 0, lastCount = 0;
  const STREAKS = [[50, 'sk_25'], [100, 'sk_50'], [200, 'sk_100'], [400, 'sk_200'], [800, 'sk_400'], [1500, 'sk_800'], [3000, 'sk_3000'], [6000, 'sk_6000'], [10000, 'sk_10000']];
  let goreRealm = null, goreDepth = -1;
  function gore(m, gold, chest, src) {
    const v0 = mobVis.get(m.id);
    const q = mobPos(m);
    mobVis.delete(m.id);
    const dn = G.depthNow ? G.depthNow() : G.S.depth;
    if (dn !== goreDepth || !goreRealm) { goreDepth = dn; goreRealm = G.REALMS[G.realmIndex(dn)]; }
    const realm = goreRealm;
    const g = GORE[realm.id] || GORE.meadow;
    const fod = !!G.SMALL[m.kind];
    // 3.6: past the tier's budget of full deaths this frame, small fry only leave their stain (and not every one)
    const lite = fod && frameKills >= Q.gore;
    const spr = lite ? null : v0 && v0.s0 && v0.sr === realm ? v0.s0 : mobSprite(m, realm);
    if (m.kind === 'guardian') { explodeSprite(spr, q.x, q.y, 2, 120, 1.8, g.style); decal(q.x, q.y, g.blood, 14); St.shake(7); hitstop = Math.max(hitstop, 0.2); slowmo = Math.max(slowmo, 0.8); }
    const over = Math.min(3, m.over || 0) + (m.crit ? 1 : 0) + (src === 'boss' ? 1.5 : 0);
    const force = 1 + over * 0.3 + (src === 'click' ? 0.35 : 0);
    // when the Horde dies in heaps, each body throws fewer chunks so the frame keeps up
    const n = fod ? (frameKills > 25 || gibs.length > Q.maxG * 0.7 ? Math.min(2, Q.chunks) : Q.chunks) : m.kind === 'brute' || m.kind === 'bomber' || m.kind === 'spitter' ? 16 : m.kind === 'tank' ? 36 : 30;
    if (!lite) explodeSprite(spr, q.x, q.y, 1, n, force, g.style);
    if (!fod || Q.decals >= 1 || keepHash(m.id) < Q.decals) decal(q.x, q.y - 1, g.blood, fod ? 2.5 : 4 + Math.min(4, m.w));
    // every land breaks differently
    const c = q.x, y = q.y - 5;
    if (lite) { /* the stain is enough */ }
    else if (g.style === 'shatter') burst(c, y, ['#ffffff', '#d8f0ff'], fod ? 3 : 8, 90, { grav: 200, life: 0.35 });
    else if (g.style === 'embers') for (let i = 0; i < (fod ? 3 : 8); i++) part(c + rand(-4, 4), y, pick(['#ffb347', '#ff6a2e', '#ffd84a']), { vx: rand(-15, 15), vy: rand(-50, -20), grav: -30, life: rand(0.5, 1.1) });
    else if (g.style === 'spores') for (let i = 0; i < (fod ? 3 : 7); i++) part(c + rand(-5, 5), y, pick(['#c84ae8', '#ff7ab0', '#f4ecd8']), { vx: rand(-10, 10), vy: rand(-25, -8), grav: -8, life: rand(0.8, 1.5) });
    else if (g.style === 'ink') for (let i = 0; i < (fod ? 2 : 7); i++) part(c + rand(-4, 4), y, pick(['#1f3a6a', '#2a4a8a', '#f4ecd8']), { vx: rand(-25, 25), vy: rand(-40, -10), grav: 160, life: rand(0.4, 0.8) });
    else if (g.style === 'sparks') for (let i = 0; i < (fod ? 3 : 9); i++) part(c, y, pick(['#ffd84a', '#ff7a2e', '#ffffff']), { vx: rand(-70, 70), vy: rand(-80, -20), grav: 260, life: rand(0.2, 0.5) });
    else if (g.style === 'feathers') for (let i = 0; i < (fod ? 2 : 6); i++) part(c + rand(-5, 5), y, pick(['#ffffff', '#fff3d0', '#ffd84a']), { vx: rand(-12, 12), vy: rand(-18, -4), grav: 12, life: rand(0.9, 1.6) });
    else if (g.style === 'glass') { burst(c, y, ['#ffffff', '#d8e6ff', '#ff7ae6'], fod ? 3 : 9, 100, { grav: 240, life: 0.4 }); }
    else if (g.style === 'dissolve') for (let i = 0; i < (fod ? 4 : 10); i++) part(c + rand(-5, 5), y + rand(-4, 4), pick(['#6b3fc0', '#7fe9ff', '#e0d0ff']), { vx: 0, vy: rand(-30, -10), grav: 0, life: rand(0.4, 0.9) });
    else burst(c, y, g.blood, fod ? 3 : 7, 70, { grav: 220, life: 0.45 });
    if (over >= 1.5 && !fod) ring(c, q.y - 3, 10, 5, '#ffffff', 0.18);
    frameKills++;
    if (fod && gold) { killGold += gold; if (killGoldT <= 0) killGoldT = 0.3; }
    if (m.kind === 'brute') { hitstop = Math.max(hitstop, 0.02); St.shake(1); ring(c, q.y - 3, 10, 5, '#ffffff', 0.15); }
    if (m.kind === 'tank') { hitstop = Math.max(hitstop, 0.05); St.shake(3); ring(c, q.y - 3, 20, 10, '#ffffff', 0.3); burst(c, y, ['#c8c8d4', '#ffffff'], 12, 90, { grav: 240, life: 0.4 }); }
    if (m.kind === 'magic') { hitstop = Math.max(hitstop, 0.035); St.shake(2); ring(c, q.y - 3, 16, 8, '#5a9cff', 0.3); }
    if (m.kind === 'rare') {
      hitstop = Math.max(hitstop, 0.09); St.shake(5); St.flash(0.18, '#ffd84a');
      ring(c, q.y - 3, 28, 15, '#ffd84a', 0.45); ring(c, q.y - 3, 16, 9, '#ffffff', 0.3);
      text(c, q.y - 26, G.t('slain', m.name), '#ffd84a', 4, { life: 1.6, max: 1.6, vy: -12 });
      beams.push({ x: c, y: q.y, col: '#ffd84a', life: 1, max: 1, w: 5 });
    }
    // XP crystals: blue for the small fry, green for brutes, red for champions and rares
    const ng = m.kind === 'rare' ? 6 : m.kind === 'magic' ? 3 : m.kind === 'tank' ? 3 : !fod ? 1 : Math.random() < 0.18 ? 1 : 0;
    const gc = fod ? '#6fb4ff' : m.kind === 'magic' || m.kind === 'rare' ? '#ff5a7a' : '#56d45a';
    for (let i = 0; i < ng && gems.length < 260; i++) gems.push({ x: c + rand(-3, 3), y: q.y - 4, vx: rand(-30, 30), vy: rand(-70, -30), floor: q.y + rand(-2, 3), t: rand(0.3, 0.6), fly: 0, col: gc, big: m.kind !== 'fodder' });
    const nc = m.kind === 'rare' ? 10 : m.kind === 'magic' ? 4 : m.kind === 'tank' ? 5 : !fod ? 2 : Math.random() < 0.04 ? 1 : 0;
    for (let i = 0; i < nc && coins.length < 220; i++) coins.push({ x: c, y: q.y - 6, vx: rand(-40, 40), vy: rand(-90, -40), floor: q.y + rand(-2, 3), t: rand(0.45, 0.8), fly: 0 });
    if (gold && !fod && !m.add && m.kind !== 'bomber') { if (m.kind === 'rare' || m.kind === 'magic') text(c, q.y - 16, '+' + G.fmt(gold), '#ffd84a', 4, { life: 0.8, max: 0.8 }); else { killGold += gold; if (killGoldT <= 0) killGoldT = 0.3; } }
    // kill streak
    streak.n = G.carnage ? Math.max(G.R.carn, 0) : streak.n + 1; streak.t = 0; streak.pop = 0.15;
    const sk = streak.n !== streak.last && streak.n >= 200 && time - streak.at > 30 && STREAKS.find(s => s[0] === streak.n);
    streak.last = streak.n;
    if (sk) {
      streak.at = time;
      for (let i = texts.length - 1; i >= 0; i--) if (texts[i].callout) texts.splice(i, 1);
      cardText(0, G.t(sk[1]), streak.n >= 3000 ? '#ff4fe0' : streak.n >= 400 ? '#ff4f7e' : '#ffe27a', streak.n >= 200 ? 8 : 7, { life: 1.8, max: 1.8, vy: -5, big: true, callout: true });
      St.shake(2 + Math.log2(streak.n / 50));
      if (G.Audio && G.Audio.streak) G.Audio.streak(streak.n);
    }
  }
  function drawDecals(dt) {
    if (!stain) return;
    // fade the whole layer a little, twice a second (about 20s to vanish)
    if ((stainFade += dt) >= 0.5) {
      stainFade = 0;
      // an 8-bit alpha stops fading at about 3%: every 20s wipe what's left that faint
      if ((stainSweep += 1) >= 40) {
        stainSweep = 0;
        try { const img = stainCtx.getImageData(0, 0, W, H), a = img.data; for (let i = 3; i < a.length; i += 4) if (a[i] < 14) a[i] = 0; stainCtx.putImageData(img, 0, 0); } catch (e) { /* unreadable canvas: leave it */ }
      }
      stainCtx.globalCompositeOperation = 'destination-out';
      stainCtx.globalAlpha = 0.06; stainCtx.fillStyle = '#000'; stainCtx.fillRect(0, 0, W, H);
      stainCtx.globalCompositeOperation = 'source-over'; stainCtx.globalAlpha = 1;
    }
    lctx.drawImage(stain, 0, 0);
  }
  function stepGibs(dt) {
    for (let i = gibs.length - 1; i >= 0; i--) {
      const g = gibs[i]; g.life -= dt;
      if (g.life <= 0) { const l = gibs.pop(); if (i < gibs.length) gibs[i] = l; continue; }
      if (g.rest) continue;
      if (g.style === 'dissolve') { g.vy -= 40 * dt; g.vx *= 0.96; g.x += g.vx * dt; g.y += g.vy * dt; continue; }
      g.vy += 320 * dt; g.x += g.vx * dt; g.y += g.vy * dt;
      if (g.y >= g.floor && g.vy > 0) {
        g.y = g.floor; g.vy *= -0.32; g.vx *= 0.5; g.b++;
        if (g.b >= 2 || Math.abs(g.vy) < 18) { g.rest = true; g.life = Math.min(g.life, rand(0.5, 1.4)); }
      }
    }
  }
  function drawGibs(resting) {
    let lastCol = null;
    for (const g of gibs) {
      if (!!g.rest !== resting) continue;
      lctx.globalAlpha = Math.min(1, g.life / 0.4);
      if (g.col !== lastCol) { lastCol = g.col; lctx.fillStyle = lastCol; }
      lctx.fillRect(Math.round(g.x), Math.round(g.y), g.s, g.s);
    }
    lctx.globalAlpha = 1;
  }
  // Coins bounce out of the dead and then get pulled into the Button
  function stepCoins(dt) {
    const b = btnPos();
    for (let i = coins.length - 1; i >= 0; i--) {
      const k = coins[i];
      if (k.t > 0) {
        k.t -= dt;
        k.vy += 300 * dt; k.x += k.vx * dt; k.y += k.vy * dt;
        if (k.y >= k.floor && k.vy > 0) { k.y = k.floor; k.vy *= -0.4; k.vx *= 0.6; }
      } else {
        k.fly += dt;
        const dx = b.x - k.x, dy = b.y - 6 - k.y, d = Math.hypot(dx, dy);
        const sp = 60 + k.fly * 520;
        if (d < 4) { const l = coins.pop(); if (i < coins.length) coins[i] = l; part(b.x + rand(-6, 6), b.y - 6, '#fff3a0', { vx: rand(-20, 20), vy: rand(-30, -10), grav: 0, life: 0.25 }); if (G.Audio && G.Audio.coin && Math.random() < 0.3) G.Audio.coin(); continue; }
        k.x += dx / d * Math.min(d, sp * dt); k.y += dy / d * Math.min(d, sp * dt);
      }
      lctx.fillStyle = '#c98f10'; lctx.fillRect(Math.round(k.x) - 1, Math.round(k.y), 3, 1);
      lctx.fillStyle = '#ffd84a'; lctx.fillRect(Math.round(k.x) - 1, Math.round(k.y) - 2, 3, 2);
      lctx.fillStyle = '#fff3a0'; lctx.fillRect(Math.round(k.x) - 1, Math.round(k.y) - 2, 1, 1);
    }
  }
  // XP crystals bounce out and get pulled into the Warden
  function stepGems(dt) {
    const hp = heroPos(), tx = hp.x, ty = hp.y - 10;
    for (let i = gems.length - 1; i >= 0; i--) {
      const k = gems[i];
      if (k.t > 0) {
        k.t -= dt;
        k.vy += 300 * dt; k.x += k.vx * dt; k.y += k.vy * dt;
        if (k.y >= k.floor && k.vy > 0) { k.y = k.floor; k.vy *= -0.4; k.vx *= 0.6; }
      } else {
        k.fly += dt;
        const dx = tx - k.x, dy = ty - k.y, d = Math.hypot(dx, dy), sp = 70 + k.fly * 600;
        if (d < 4) { const l = gems.pop(); if (i < gems.length) gems[i] = l; part(tx + rand(-4, 4), ty + rand(-4, 4), k.col, { vx: 0, vy: -15, grav: 0, life: 0.25 }); if (G.Audio && G.Audio.gem) G.Audio.gem(); continue; }
        k.x += dx / d * Math.min(d, sp * dt); k.y += dy / d * Math.min(d, sp * dt);
      }
      const x = Math.round(k.x), y = Math.round(k.y);
      lctx.fillStyle = '#0c0b12'; lctx.fillRect(x - 1, y - 2, 3, 5); lctx.fillRect(x - 2, y - 1, 5, 3);
      lctx.fillStyle = k.col; lctx.fillRect(x, y - 1, 1, 3); lctx.fillRect(x - 1, y, 3, 1);
      lctx.fillStyle = '#ffffff'; lctx.fillRect(x, y - 1, 1, 1);
    }
  }
  // Perks that live around the Button: Holy Ground and the Orbiting Blades
  function drawPerkFx() {
    const P = G.S.hero && G.S.hero.perks;
    if (!P) return;
    const b = btnPos();
    if (P.aura) {
      const sanct = P.evo_sanctuary, r = aoePx(sanct ? 0.4 : 0.3), pulse = 0.5 + 0.5 * Math.sin(time * 4);
      lctx.globalAlpha = 0.1 + 0.03 * P.aura + 0.04 * pulse;
      lctx.fillStyle = '#ffe27a';
      for (let dy = -Math.round(r.ry); dy <= r.ry; dy++) { const w = Math.round(r.rx * Math.sqrt(Math.max(0, 1 - (dy / r.ry) * (dy / r.ry)))); lctx.fillRect(b.x - w, b.y - 2 + dy, w * 2, 1); }
      lctx.globalAlpha = 0.85;
      const n = 56;
      for (let j = 0; j < n; j++) { if ((j + Math.floor(time * 8)) % 3) continue; const a = j / n * Math.PI * 2; lctx.fillRect(Math.round(b.x + Math.cos(a) * r.rx), Math.round(b.y - 2 + Math.sin(a) * r.ry), 1, 1); }
      lctx.globalAlpha = 1;
    }
    if (P.blades) {
      const n = G.bladeCount(), r = aoePx(P.evo_bladestorm ? 0.3 : 0.24), spr = SPR.get(P.evo_bladestorm ? 'it_eternity_blade' : 'ic_sword');
      for (let i = 0; i < n; i++) {
        const a = time * (P.evo_bladestorm ? 3.4 : 2.6) + i * Math.PI * 2 / n;
        const x = b.x + Math.cos(a) * r.rx, y = b.y - 6 + Math.sin(a) * r.ry;
        lctx.save(); lctx.translate(Math.round(x), Math.round(y)); lctx.rotate(Math.round((a + Math.PI * 0.75) / (Math.PI / 4)) * (Math.PI / 4));
        lctx.drawImage(spr, -5, -5); lctx.restore();
      }
    }
  }
  // quick light blooms (bomb blasts)
  function drawGlowFx(dt) {
    for (let i = glowFx.length - 1; i >= 0; i--) {
      const g = glowFx[i];
      if ((g.t -= dt) <= 0) { glowFx.splice(i, 1); continue; }
      glow(g.x, g.y, Math.max(2, Math.round(g.r * (1.2 - g.t / g.T * 0.4))), g.col, 0.5 * g.t / g.T);
    }
    if (glowFx.length > 30) glowFx.splice(0, glowFx.length - 30);
  }
  function drawRings(dt) {
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]; r.life -= dt;
      if (r.life <= 0) { rings.splice(i, 1); continue; }
      const k = 1 - r.life / r.max, e = 1 - (1 - k) * (1 - k);
      const rx = r.rx * (0.35 + 0.65 * e), ry = r.ry * (0.35 + 0.65 * e);
      lctx.globalAlpha = 0.85 * (1 - k);
      lctx.fillStyle = r.col;
      const n = Math.max(16, Math.round(rx * 1.6));
      const a0 = r.arc ? r.arc[0] : 0, a1 = r.arc ? r.arc[1] : Math.PI * 2;
      for (let j = 0; j <= n; j++) {
        const a = a0 + (a1 - a0) * j / n;
        lctx.fillRect(Math.round(r.x + Math.cos(a) * rx), Math.round(r.y + Math.sin(a) * ry), 1, 1);
      }
    }
    lctx.globalAlpha = 1;
  }

  // ---------- Drawing helpers ----------
  function shadow(x, y, w) {
    lctx.fillStyle = 'rgba(0,0,0,0.28)';
    lctx.fillRect(Math.round(x - w / 2), Math.round(y), w, 2);
    lctx.fillRect(Math.round(x - w / 2 + 1), Math.round(y - 1), w - 2, 1);
  }
  function blit(c, x, y, sc, alpha) {
    sc = sc || 1;
    if (alpha !== undefined) lctx.globalAlpha = alpha;
    // (unscaled: the plain three-argument draw, the quickest)
    if (sc === 1) lctx.drawImage(c, Math.round(x - c.width / 2), Math.round(y - c.height));
    else lctx.drawImage(c, Math.round(x - c.width * sc / 2), Math.round(y - c.height * sc), c.width * sc, c.height * sc);
    if (alpha !== undefined) lctx.globalAlpha = 1;
  }
  const whiteCache = new WeakMap();
  function white(c) {
    let w = whiteCache.get(c);
    if (w) return w;
    w = SPR.makeCanvas(c.width, c.height);
    const x = w.getContext('2d');
    x.drawImage(c, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height);
    whiteCache.set(c, w);
    return w;
  }
  function glow(x, y, r, col, a) {
    lctx.globalAlpha = a;
    lctx.fillStyle = col;
    for (let dy = -r; dy <= r; dy++) {
      const w = Math.round(Math.sqrt(r * r - dy * dy) * 1.6);
      lctx.fillRect(Math.round(x - w), Math.round(y + dy * 0.5), w * 2, 1);
    }
    lctx.globalAlpha = 1;
  }

  // ---------- Loot on the ground, events and Rifts (js/world.js) ----------
  // Label plates by value, loot-filter style: they say what fell before you
  // pick it up. Index = rarity; uniques and orbs have their own looks.
  // sz: 2 small, 3 medium, 5 large (the font snaps to 8/16/24 device px)
  const LSTYLE = [
    { fg: '#c7b299', sz: 2, dim: true },
    { fg: '#63d85b', bg: 'rgba(6,14,6,0.82)', sz: 2 },
    { fg: '#9ccfff', bg: 'rgba(4,10,26,0.9)', bd: '#4fa8ff', sz: 2 },
    { fg: '#f2e2ff', bg: '#4a1f80', bd: '#b36bff', sz: 3, beam: '#b36bff', temp: true },
    { fg: '#1a0c00', bg: '#ffa033', bd: '#fff0c0', sz: 3, beam: '#ffa033' },
    { fg: '#ffffff', bg: '#d8264e', bd: '#ffffff', sz: 3, beam: '#ff4f7e' },
    { fg: '#e01010', bg: '#ffffff', bd: '#e01010', sz: 5, beam: '#ffffff', halo: '#ff2020' },
  ];
  const USTYLE = { fg: '#ffffff', bg: '#af6025', bd: '#ffd28a', sz: 3, beam: '#e8903a' };
  const OSTYLE = {
    whet:   { fg: '#dfe8f6', bg: 'rgba(10,12,22,0.88)', bd: '#8898b8', sz: 2 },
    flux:   { fg: '#1a1200', bg: '#f2c21a', bd: '#fff3a0', sz: 2 },
    ruin:   { fg: '#ffffff', bg: '#9a1414', bd: '#ff6a5a', sz: 3, beam: '#ff3b3b', temp: true },
    ascent: { fg: '#1a1000', bg: '#ffe0a0', bd: '#ffffff', sz: 3, beam: '#ffe0a0' },
    grace:  { fg: '#e01010', bg: '#ffffff', bd: '#e01010', sz: 5, beam: '#ffffff', halo: '#ff2020' },
  };
  const lstyle = e => e.k === 'uq' ? USTYLE : e.k === 'orb' ? OSTYLE[e.orb] : LSTYLE[e.r];
  const lname = e => e.k === 'uq' ? G.UNIQUES[e.q].name : e.k === 'orb' ? G.ORBS[e.orb].name : G.L(e.it.name);
  const lspr = e => e.k === 'uq' ? 'u_' + e.q : e.k === 'orb' ? 'orb_' + e.orb : 'it_' + e.it.id;
  // how loud a drop is: 0 (junk) .. 8 (top tier)
  const loud = e => e.k === 'uq' ? 7 : e.k === 'orb' ? { whet: 1, flux: 2, ruin: 4, ascent: 5, grace: 8 }[e.orb] : e.r >= 6 ? 8 : e.r;
  St.lootStyle = e => lstyle(e);
  // arena position (a, p) -> stage pixels, on the same paths the mobs walk
  function arenaXY(a, p, j) {
    const b = btnPos();
    const ang = -Math.PI / 2 + 0.55 + a * (Math.PI * 2 - 1.1);
    const sx = b.x + Math.cos(ang) * W * 0.6, sy = b.y + Math.sin(ang) * H * 0.56;
    const ex = b.x + Math.cos(ang) * (21 + (j || 0) * 10), ey = b.y + Math.sin(ang) * (11 + (j || 0) * 6) + 4;
    return { x: sx + (ex - sx) * p, y: sy + (ey - sy) * p };
  }
  const gvis = new Map();
  let labels = [], hoverLoot = null, lootPitch = 0, lootPitchT = 0;
  function onDrop(e, m) {
    const j = ((e.id * 37) % 19) / 19;
    const q = arenaXY(e.a, Math.min(0.9, e.p), j);
    const land = onField(q.x, q.y);
    let s;
    if (m && !m.gone) { const mp = mobPos(m); s = { x: mp.x, y: mp.y - 8 }; }
    else if (e.src === 'boss' || e.src === 'rift') { const b = bossVis ? bossPos() : btnPos(); s = { x: b.x, y: b.y - 16 }; }
    else s = { x: land.x, y: land.y - 30 };
    const L = loud(e);
    gvis.set(e.id, { x: land.x, y: land.y, sx: s.x, sy: s.y, t: -(e.wait || 0), dur: 0.34 + 0.05 * L, pk: 10 + 3 * L, landed: false, up: e.from != null, pop: 0, bob: Math.random() * 6 });
  }
  function onLand(e, v) {
    const st = lstyle(e), L = loud(e);
    v.landed = true; v.pop = 0.18; v.age = 0;
    burst(v.x, v.y - 1, ['#c8b89a', '#8a7a60'], 4, 28, { grav: 60, life: 0.3 });
    if (v.up) { text(v.x, v.y - 18, G.t('upgrade'), st.fg === '#1a0c00' ? '#ffa033' : st.bd || st.fg, 4, { life: 1.1, max: 1.1, vy: -14 }); burst(v.x, v.y - 5, [st.bd || '#ffffff', '#ffffff'], 12, 60); }
    if (st.beam) { v.beam = st.temp ? 1.2 : 1e9; v.bt = 0; }
    if (L >= 4) ring(v.x, v.y - 1, 12 + L * 2, 6 + L, st.beam || st.fg, 0.5);
    if (L >= 5) { St.shake(2 + L * 0.4); hitstop = Math.max(hitstop, 0.03 * (L - 3)); }
    if (L >= 7) { St.flash(0.3, st.beam || '#ffffff'); slowmo = Math.max(slowmo, 0.25); }
    // rising pitch while a shower is coming down
    if (lootPitchT > 0) lootPitch = Math.min(12, lootPitch + 1); else lootPitch = 0;
    lootPitchT = 0.5;
    if (G.Audio && G.Audio.loot) G.Audio.loot(e.k, L, lootPitch);
  }
  function stepGround(dt) {
    if (lootPitchT > 0) lootPitchT -= dt;
    const live = G.R.ground || [];
    if (gvis.size > live.length + 8) { const ids = new Set(live.map(e => e.id)); for (const k of [...gvis.keys()]) if (!ids.has(k)) gvis.delete(k); }
    for (const e of live) {
      let v = gvis.get(e.id);
      if (!v) { onDrop(e, null); v = gvis.get(e.id); v.t = v.dur; }
      if (!v.landed) { v.t += dt; if (v.t >= v.dur) onLand(e, v); }
      else { v.age += dt; if (v.pop > 0) v.pop -= dt; if (v.beam) v.bt += dt; }
    }
  }
  function drawGroundItem(e, v) {
    const spr = SPR.get(lspr(e)) || SPR.get('ic_bag');
    const st = lstyle(e), L = loud(e);
    if (v.t < 0) return;
    if (!v.landed) {
      const k = clamp(v.t / v.dur, 0, 1), ek = 1 - (1 - k) * (1 - k);
      const x = v.sx + (v.x - v.sx) * ek, y = v.sy + (v.y - v.sy) * k - Math.sin(k * Math.PI) * v.pk;
      const flip = Math.floor(v.t * 16) % 2;
      if (flip) { lctx.save(); lctx.translate(Math.round(x), 0); lctx.scale(-1, 1); blit(spr, 0, y); lctx.restore(); } else blit(spr, x, y);
      if (L >= 3 && Math.random() < 0.7) part(x + rand(-2, 2), y - 4, v.up && k < 0.8 ? '#ffffff' : st.beam || st.fg, { vx: 0, vy: 0, grav: 0, life: 0.3 });
      return;
    }
    shadow(v.x, v.y - 1, 8);
    if (L >= 3) glow(v.x, v.y - 3, 5 + Math.min(4, L - 2), st.beam || st.bd || st.fg, 0.18 + 0.07 * Math.sin(time * 5 + e.id));
    const hover = e.k === 'orb' ? Math.round(Math.sin(time * 4 + v.bob) * 1.2) - 1 : 0;
    const sq = v.pop > 0.09 ? 1 : 0;
    blit(spr, v.x, v.y + sq + hover);
    if (hoverLoot === e) { lctx.globalAlpha = 0.35; blit(white(spr), v.x, v.y + hover); lctx.globalAlpha = 1; }
    if (e.k === 'uq' && Math.random() < 0.3) part(v.x + rand(-5, 5), v.y - rand(3, 10), pick(['#ffd28a', '#e8903a', '#ffffff']), { vy: -14, vx: 0, grav: 0, life: 0.6 });
  }
  function drawLootBeams() {
    // 4.0: the store's beam look (G.cosmetic('beam'): its core and sparks; the edge keeps the rarity's colour)
    const cb = cosm('beam');
    for (const e of G.R.ground || []) {
      const v = gvis.get(e.id);
      if (!v || !v.beam || !v.landed) continue;
      const st = lstyle(e);
      const left = v.beam - v.bt;
      if (left <= 0) { v.beam = 0; continue; }
      const grow = Math.min(1, v.bt / 0.12), fade = Math.min(1, left / 0.4);
      const top = Math.round(v.y - 2 - (v.y - 2) * grow);
      const w = st.halo ? 9 : loud(e) >= 5 ? 7 : 5;
      const a = (0.2 + 0.08 * Math.sin(time * 5 + e.id)) * fade;
      if (ultraE(e)) {
        // 4.0 (ADDENDUM 1): an ultra-rare stands in a rainbow beam, wider, with its colours climbing and sparks in it
        const uw = 11, x0 = Math.round(v.x - uw / 2), hh = Math.round(v.y - 2 - top), sh = Math.floor(time * 10 + e.id);
        for (let dx = 0; dx < uw; dx++) { lctx.globalAlpha = (0.22 + 0.3 * (1 - Math.abs(dx - uw / 2) / (uw / 2))) * fade; lctx.fillStyle = rbw(Math.floor(dx / 2) + sh); lctx.fillRect(x0 + dx, top, 1, hh); }
        lctx.globalAlpha = 0.8 * fade; lctx.fillStyle = cb && cb.core ? cb.core : '#ffffff'; lctx.fillRect(Math.round(v.x - 1), top, 2, hh);
        lctx.globalAlpha = 0.3 * fade; lctx.fillStyle = '#ffffff';
        for (let j = 0; j < 3; j++) { const by = Math.round(v.y - 2 - ((time * 60 + j * 31 + e.id * 7) % Math.max(1, hh))); lctx.fillRect(x0, by, uw, 1); }
        lctx.globalAlpha = 1;
        if (Math.random() < 0.35) part(v.x + rand(-uw / 2, uw / 2), v.y - rand(2, 40), cb && cb.spark ? cb.spark : rbw(Math.floor(Math.random() * 8)), { vx: 0, vy: -rand(18, 34), grav: 0, life: 0.7 });
        if (Math.random() < 0.08) part(v.x + rand(-6, 6), v.y - rand(0, 6), '#ffffff', { vx: 0, vy: 0, grav: 0, life: 0.35, plus: true });
        continue;
      }
      lctx.globalAlpha = a;
      lctx.fillStyle = st.halo || st.beam;
      lctx.fillRect(Math.round(v.x - w / 2), top, w, Math.round(v.y - 2 - top));
      lctx.globalAlpha = 0.65 * fade;
      lctx.fillStyle = cb && cb.core ? cb.core : st.beam;
      lctx.fillRect(Math.round(v.x - 1), top, 2, Math.round(v.y - 2 - top));
      lctx.globalAlpha = 1;
      if (Math.random() < 0.1) part(v.x + rand(-w / 2, w / 2), v.y - rand(2, 30), cb && cb.spark ? cb.spark : st.beam, { vx: 0, vy: -20, grav: 0, life: 0.6 });
    }
  }
  // Plates on the hi-res layer, stacked so they never overlap
  function drawLabels() {
    labels = [];
    // (3.6: only the loot that will wear a plate is sorted, not the whole floor every frame)
    const ground = G.R.ground || [], filter = G.S.set.filter;
    let landedN = 0;
    for (let i = 0; i < ground.length; i++) { const v = gvis.get(ground[i].id); if (v && v.landed) landedN++; }
    const busy = landedN > 16, list = [];
    for (let i = 0; i < ground.length; i++) {
      const e = ground[i], v = gvis.get(e.id);
      if (!v || !v.landed) continue;
      const st = lstyle(e);
      if (st.dim && filter) continue;
      // 2.2: only the loot that matters wears a plate (epic and up, the better orbs, uniques); the rest
      // shows on hover, and a crowded floor keeps only the best
      if ((filter ? loud(e) < 3 : busy && loud(e) < 2) && hoverLoot !== e) continue;
      list.push({ e, v, L: loud(e) });
    }
    if (!list.length) return;
    list.sort((a, b) => b.L - a.L || a.e.id - b.e.id);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const free = (x, y, w, h) => !labels.some(r => x < r.x + r.w + 1 && x + w + 1 > r.x && y < r.y + r.h + 1 && y + h + 1 > r.y);
    for (const { e, v } of list) {
      const st = lstyle(e);
      const sz = crisp(st.sz);
      ctx.font = sz + 'px ' + FONT;
      const txt = lname(e);
      // 4.0 (ADDENDUM 2): a rare+ piece rolled where it fell says whether it is an upgrade for someone: ▲ / ▼
      const cmp = e.g && G.groundCmp ? G.groundCmp(e) : null, arr = cmp ? (cmp.up ? 1 : cmp.pct < -1e-6 ? -1 : 0) : 0, aw = arr ? Math.ceil(sz) + 2 : 0;
      const w = Math.ceil(measureW(txt)) + 4 + aw, h = Math.ceil(sz) + 2;
      const x0 = clamp(Math.round(v.x - w / 2), 1, W - w - 1), y0 = Math.round(v.y - 10 - h);
      // try beside it first, then stack upwards
      let x = x0, y = y0, ok = false;
      const top = 16; // under the HUD strip
      for (let row = 0; row < 8 && !ok; row++) {
        for (const dx of [0, w * 0.55 + 2, -(w * 0.55 + 2)]) {
          const cx = clamp(Math.round(x0 + dx), 1, W - w - 1), cy = y0 - row * (h + 1);
          if (cy >= top && free(cx, cy, w, h)) { x = cx; y = cy; ok = true; break; }
        }
      }
      // no room above (near the top edge): try under the item
      for (let row = 0; row < 6 && !ok; row++) {
        const cy = Math.round(v.y + 2 + row * (h + 1)), cx = x0;
        if (cy + h < H - 2 && free(cx, cy, w, h)) { x = cx; y = cy; ok = true; }
      }
      if (!ok) continue;
      const pop = v.pop > 0 ? 1 + v.pop * 1.5 : 1;
      labels.push({ x, y, w, h, e });
      // (a popped plate is drawn scaled: its box is noted as drawn, the wrappers only know the plain transform)
      if (pop > 1) mark(x + w / 2 - w * pop / 2 - 2, y + h / 2 - h * pop / 2 - 2, x + w / 2 + w * pop / 2 + 2, y + h / 2 + h * pop / 2 + 2);
      ctx.save();
      if (pop > 1) { ctx.translate(x + w / 2, y + h / 2); ctx.scale(pop, pop); ctx.translate(-(x + w / 2), -(y + h / 2)); }
      if (st.bg) { ctx.fillStyle = st.bg; ctx.fillRect(x, y, w, h); }
      if (st.bd) { ctx.strokeStyle = st.bd; ctx.lineWidth = hoverLoot === e ? 1 : 0.6; ctx.strokeRect(x + 0.3, y + 0.3, w - 0.6, h - 0.6); }
      const tx = x + aw + (w - aw) / 2;
      if (!st.bg) { ctx.lineWidth = 1; ctx.strokeStyle = '#0c0b12'; ctx.strokeText(txt, tx, y + h / 2 + 0.3); }
      // (an ultra-rare's name runs through the rainbow: 8 steps, so each stays a stamped text)
      ctx.fillStyle = ultraE(e) ? (st.bg ? '#ffffff' : rbw(Math.floor(time * 8) + e.id)) : st.fg;
      ctx.fillText(txt, tx, y + h / 2 + 0.3);
      if (ultraE(e) && st.bg) { ctx.fillStyle = rbw(Math.floor(time * 8) + e.id); ctx.fillRect(x + aw, y + h - 0.6, w - aw, 0.6); ctx.fillRect(x + aw, y, w - aw, 0.6); }
      if (arr) {
        // the arrow: a little triangle in its own box at the plate's left (green up, red down)
        const ah = Math.max(2, sz * 0.75), cx = x + aw / 2 + 0.5, cy = y + h / 2, rows = 4;
        ctx.fillStyle = '#0c0b12'; ctx.fillRect(x, y, aw, h);
        ctx.fillStyle = arr > 0 ? '#56e05a' : '#ff4f4f';
        for (let j = 0; j < rows; j++) { const f = (j + 1) / rows, ww = ah * f, yy = arr > 0 ? cy - ah / 2 + j * ah / rows : cy + ah / 2 - (j + 1) * ah / rows; ctx.fillRect(cx - ww / 2, yy, ww, ah / rows + 0.05); }
      }
      if (hoverLoot === e) { ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x, y, w, h); }
      ctx.restore();
    }
  }
  function hitLoot(p) {
    for (let i = labels.length - 1; i >= 0; i--) { const r = labels[i]; if (p.x >= r.x - 1 && p.x <= r.x + r.w + 1 && p.y >= r.y - 1 && p.y <= r.y + r.h + 1) return r.e; }
    let best = null, bd = 60;
    for (const e of G.R.ground || []) { const v = gvis.get(e.id); if (!v || !v.landed) continue; const d = (p.x - v.x) ** 2 + (p.y - v.y + 4) ** 2; if (d < bd) { bd = d; best = e; } }
    return best;
  }
  function onPickup(e, how, res) {
    if (loud(e) >= 4) St.celebrate = time + 2.5;
    const v = gvis.get(e.id);
    gvis.delete(e.id);
    if (!v || !v.landed) return;
    const tgt = e.k === 'orb' ? btnPos() : heroPos();
    flyers.push({ x: v.x, y: v.y, tx: tgt.x, ty: tgt.y - 8, t: 0, dur: how === 'hand' ? 0.22 : 0.4, spr: lspr(e) });
    const st = lstyle(e);
    if (how === 'hand') burst(v.x, v.y - 4, [st.bd || st.fg, '#ffffff'], 6, 40, { life: 0.3 });
    if (e.k === 'orb' && loud(e) >= 2) text(tgt.x + rand(-10, 10), tgt.y - 24, '+1 ' + G.ORBS[e.orb].name, G.ORBS[e.orb].col, 3, { life: 1, max: 1, vy: -14 });
    if (G.Audio && G.Audio.pick) G.Audio.pick(e.k);
  }
  // Shrines stand on the field until touched (or the Warden claims them)
  function shrinePos() { const s = G.R.shrine; if (!s) return null; const q = arenaXY(s.a, s.p, 0.5); return onField(q.x, q.y); }
  function drawShrine() {
    const s = G.R.shrine, q = shrinePos();
    if (!s || !q) return;
    const col = G.SHRINES[s.k].col;
    glow(q.x, q.y - 6, 9, col, 0.22 + 0.1 * Math.sin(time * 5));
    shadow(q.x, q.y - 1, 12);
    blit(SPR.get('shrine_' + s.k) || SPR.get('ic_star'), q.x, q.y + Math.round(Math.sin(time * 2) * 0.5));
    if (Math.random() < 0.4) part(q.x + rand(-4, 4), q.y - rand(8, 16), col, { vx: 0, vy: -18, grav: 0, life: 0.5 });
    // 4.0: in a Siege the Hand charges it (the ring under it fills); its time left runs out round the outside
    if (inSiege() && G.shrineHold) {
      drawShrineCharge(s, q, col);
      const left = clamp(s.t / G.TUNE.shrineLife, 0, 1), m = 30;
      lctx.globalAlpha = 0.6; lctx.fillStyle = left < 0.3 && Math.floor(time * 6) % 2 ? '#ff4f4f' : '#ffffff';
      for (let j = 0; j < Math.round(m * left); j++) { const a = -Math.PI / 2 + j / m * Math.PI * 2; lctx.fillRect(Math.round(q.x + Math.cos(a) * 17), Math.round(q.y - 2 + Math.sin(a) * 8), 1, 1); }
      lctx.globalAlpha = 1;
      return;
    }
    // the ring fills as the Warden walks over to claim it
    const k = clamp(1 - s.t / G.TUNE.shrineLife, 0, 1), n = 24;
    lctx.fillStyle = col;
    for (let j = 0; j < Math.round(n * k); j++) { const a = -Math.PI / 2 + j / n * Math.PI * 2; lctx.fillRect(Math.round(q.x + Math.cos(a) * 9), Math.round(q.y - 2 + Math.sin(a) * 4), 1, 1); }
  }
  function hitShrine(p) { const q = shrinePos(); return q && Math.abs(p.x - q.x) < 9 && Math.abs(p.y - (q.y - 7)) < 11; }
  // The Breach: a purple tear at the edge of the field
  function breachPos() { const b = G.R.breach; if (!b) return null; const q = arenaXY(b.a, 0.08, 0); return onField(q.x, q.y); }
  function drawBreach() {
    const b = G.R.breach, q = breachPos();
    if (!b || !q) return;
    const k = clamp(b.t / b.T, 0, 1), rx = 14 + 4 * Math.sin(time * 3), ry = 7;
    lctx.globalAlpha = 0.35; lctx.fillStyle = '#2a0e4a';
    for (let dy = -ry; dy <= ry; dy++) { const w = Math.round(rx * Math.sqrt(1 - (dy / ry) * (dy / ry))); lctx.fillRect(q.x - w, q.y + dy, w * 2, 1); }
    lctx.globalAlpha = 0.9; lctx.fillStyle = '#b36bff';
    const n = 40;
    for (let j = 0; j < n; j++) { if ((j + Math.floor(time * 12)) % 4 === 0) continue; const a = j / n * Math.PI * 2 + time; lctx.fillRect(Math.round(q.x + Math.cos(a) * rx), Math.round(q.y + Math.sin(a) * ry), 1, 1); }
    lctx.globalAlpha = 1;
    for (let i = 0; i < 2; i++) { const a = Math.random() * 6.28; part(q.x + Math.cos(a) * rx, q.y + Math.sin(a) * ry, pick(['#b36bff', '#e0d0ff', '#6b2fb8']), { vx: -Math.cos(a) * 20, vy: -Math.sin(a) * 10 - 10, grav: 0, life: 0.5 }); }
    // timer under it
    lctx.fillStyle = '#0c0b12'; lctx.fillRect(q.x - 11, q.y + ry + 2, 22, 3);
    lctx.fillStyle = '#b36bff'; lctx.fillRect(q.x - 10, q.y + ry + 3, Math.round(20 * k), 1);
  }
  // Rift: a purple edge on the world (its bar and clock are in the HUD row)
  // An invasion paints the sky: a tint over the field, its moon, planet, sun or eye, and its weather
  function drawInvasionSky(dt) {
    const r = G.R.inv;
    invFade = clamp(invFade + (r ? dt : -dt) * 1.5, 0, 1);
    if (invFade <= 0) return;
    const V = G.INV_BY_ID[(r && r.k) || lastInv] || G.INVASIONS[0];
    if (r) lastInv = r.k;
    lctx.globalAlpha = V.tintA * invFade; lctx.fillStyle = V.tint; lctx.fillRect(0, 0, W, H); lctx.globalAlpha = 1;
    const sky = SPR.defs[V.sky] ? SPR.get(V.sky) : null;
    if (sky) { lctx.globalAlpha = 0.6 * invFade; lctx.drawImage(sky, Math.round(W * 0.8 - sky.width), Math.round(18 + Math.sin(time * 0.5) * 2), sky.width * 2, sky.height * 2); lctx.globalAlpha = 1; }
    if (!r) return;
    if (V.id === 'moon' && Math.random() < 0.5) part(rand(0, W), -2, pick(['#e8f0ff', '#c8d6ff', '#ffffff']), { vx: rand(-20, -5), vy: rand(40, 70), grav: 0, life: rand(0.8, 1.6) });
    if (V.id === 'cosmic' && Math.random() < 0.06) { const x = rand(20, W - 20); beams.push({ x, y: rand(H * 0.3, H * 0.8), col: '#7fff9a', life: 0.6, max: 0.6, w: 6 }); }
    if (V.id === 'heaven') { lctx.globalAlpha = 0.08 + 0.04 * Math.sin(time * 2); lctx.fillStyle = '#fff3a0'; for (let i = 0; i < 4; i++) { const x = (i * W / 3 + time * 8) % (W + 60) - 30; lctx.beginPath(); lctx.moveTo(x, 0); lctx.lineTo(x + 26, 0); lctx.lineTo(x + 70, H); lctx.lineTo(x + 30, H); lctx.fill(); } lctx.globalAlpha = 1; if (Math.random() < 0.2) part(rand(0, W), -2, '#ffffff', { vx: rand(-6, 6), vy: rand(10, 25), grav: 0, life: 2 }); }
    if (V.id === 'deep' && Math.random() < 0.4) part(rand(0, W), H + 2, pick(['#4fe0c8', '#9ff0e0']), { vx: rand(-4, 4), vy: -rand(20, 40), grav: 0, life: rand(1, 2) });
  }
  let invFade = 0, lastInv = null;
  // ---------- Sudden events (js/events.js) ----------
  let evFade = 0, evLastK = null;
  const metPos = mt => mobPos({ id: -1000 - mt.id, a: mt.a, p: mt.p, kind: 'x' });
  // the rocks fall over the crowd, not under it
  function drawMeteors() {
    const ev = G.R.ev;
    if (!ev || ev.k !== 'meteors') return;
    for (const mt of ev.met) {
      const q = metPos(mt), f = 1 - mt.t / mt.T;
      // where it will land: a shrinking red ring
      const r = Math.round(10 - 5 * f);
      lctx.globalAlpha = 0.35 + 0.4 * f; lctx.fillStyle = '#ff3b3b';
      for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2 + time * 2; lctx.fillRect(Math.round(q.x + Math.cos(a) * r), Math.round(q.y - 2 + Math.sin(a) * r * 0.55), 1, 1); }
      lctx.globalAlpha = 1;
      // the rock itself, coming in from high up and to the right
      const mx = q.x + (1 - f) * 70, my = q.y - 4 - (1 - f) * 130;
      const spr = SPR.defs.fx_meteor ? SPR.get('fx_meteor') : null;
      glow(mx, my - 3, 6, '#ff7a2e', 0.4);
      if (spr) blit(spr, Math.round(mx), Math.round(my)); else { lctx.fillStyle = '#ff7a2e'; lctx.fillRect(Math.round(mx) - 2, Math.round(my) - 4, 4, 4); }
      if (Math.random() < 0.8) part(mx + 2, my - 4, pick(['#ffd84a', '#ff7a2e', '#ff3b3b', '#6e6e7c']), { vx: rand(10, 30), vy: rand(-40, -20), grav: 0, life: 0.35 });
    }
  }
  function drawEventFx(dt) {
    const ev = G.R.ev;
    evFade = clamp(evFade + (ev ? dt : -dt) * 2, 0, 1);
    if (ev) evLastK = ev.k;
    const k = evLastK;
    if (evFade <= 0 || !k) return;
    if (k === 'bloodmoon') {
      lctx.globalAlpha = 0.2 * evFade; lctx.fillStyle = '#6a0014'; lctx.fillRect(0, 0, W, H);
      const mo = SPR.defs.ev_bloodmoon ? SPR.get('ev_bloodmoon') : null;
      if (mo) { lctx.globalAlpha = 0.85 * evFade; lctx.drawImage(mo, Math.round(W * 0.8 - mo.width * 1.5), 16, mo.width * 3, mo.height * 3); }
      lctx.globalAlpha = 1;
      if (ev && Math.random() < 0.3) part(rand(0, W), -2, pick(['#ff3b5c', '#a0102a']), { vx: rand(-4, 4), vy: rand(20, 40), grav: 0, life: 1.4 });
    } else if (k === 'goldrush') {
      lctx.globalAlpha = 0.07 * evFade; lctx.fillStyle = '#ffd84a'; lctx.fillRect(0, 0, W, H); lctx.globalAlpha = 1;
      if (ev) for (let i = 0; i < 2; i++) if (Math.random() < 0.7) part(rand(0, W), -2, pick(['#ffd84a', '#fff3a0', '#c98f10']), { vx: rand(-6, 6), vy: rand(50, 90), grav: 40, life: 1.6, size: 2 });
    } else if (k === 'frenzy') {
      lctx.globalAlpha = (0.06 + 0.04 * Math.sin(time * 12)) * evFade; lctx.fillStyle = '#ffe27a'; lctx.fillRect(0, 0, W, H); lctx.globalAlpha = 1;
    } else if (k === 'stampede' && ev) {
      // dust boils up where they charge from
      const q = mobPos({ id: -1, a: ev.a, p: 0.05, kind: 'x' });
      for (let i = 0; i < 3; i++) if (Math.random() < 0.8) part(q.x + rand(-26, 26), q.y + rand(-14, 14), pick(['#c8b89a', '#a89878', '#e0d4b8']), { vx: rand(-10, 10), vy: rand(-14, -4), grav: 0, life: rand(0.5, 1.1), size: 2 });
    }
  }
  // ---------- The JACKPOT: the whole screen goes gold ----------
  let jp = null;
  const easeBounce = x => { const n = 7.5625, d = 2.75; if (x < 1 / d) return n * x * x; if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75; if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375; return n * (x -= 2.625 / d) * x + 0.984375; };
  function drawJackpot(dt) {
    if (!jp) return;
    jp.t += dt;
    const T = 6, t = jp.t;
    if (t > T) { jp = null; return; }
    const fade = Math.min(1, t / 0.25, (T - t) / 0.8);
    const b = btnPos();
    // the world dims, and gold rays turn round the Button
    lctx.globalAlpha = 0.6 * fade; lctx.fillStyle = '#0c0712'; lctx.fillRect(0, 0, W, H);
    lctx.globalAlpha = 0.22 * fade;
    for (let i = 0; i < 16; i++) {
      const a0 = time * 0.9 + i / 16 * Math.PI * 2, a1 = a0 + Math.PI / 22, R_ = Math.max(W, H);
      lctx.fillStyle = i % 2 ? '#ffd84a' : '#fff3a0';
      lctx.beginPath(); lctx.moveTo(b.x, b.y - 10); lctx.lineTo(b.x + Math.cos(a0) * R_, b.y - 10 + Math.sin(a0) * R_); lctx.lineTo(b.x + Math.cos(a1) * R_, b.y - 10 + Math.sin(a1) * R_); lctx.fill();
    }
    lctx.globalAlpha = 1;
    // a golden Button drops from the sky and bounces
    const gb = SPR.button('#ffd84a', false, 0, false);
    // it lands just above the real one
    const k = Math.min(1, t / 0.9), y = Math.round(-40 + (b.y - 4) * easeBounce(k));
    glow(b.x, y - 12, 34, '#ffd84a', 0.5 * fade);
    lctx.globalAlpha = fade; blit(gb, b.x, y, 2); lctx.globalAlpha = 1;
    // a fountain of coins and confetti
    if (t < T - 1) for (let i = 0; i < 7; i++) part(b.x + rand(-10, 10), y - 16, pick(['#ffd84a', '#fff3a0', '#c98f10', '#ffffff', '#ff7ae6', '#7fe9ff']), { vx: rand(-90, 90), vy: rand(-170, -80), grav: 190, life: rand(1, 1.8), size: 2 });
  }
  function drawJackpotText() {
    if (!jp) return;
    const t = jp.t, b = btnPos(), pop = 1 + 0.12 * Math.sin(t * 9) + (t < 0.3 ? (0.3 - t) * 3 : 0);
    const alpha = Math.min(1, t / 0.2, (6 - t) / 0.8);
    if (alpha <= 0) return;
    ctx.save(); ctx.globalAlpha = alpha; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = crisp(13 * pop) + 'px ' + FONT; ctx.lineWidth = 3; ctx.strokeStyle = '#0c0b12';
    const str = G.t('jpTitle'), y = Math.round(cardY(0.15));
    // every letter its own colour, running round the rainbow
    const w = ctx.measureText(str).width;
    let x = W / 2 - w / 2;
    ctx.textAlign = 'left';
    for (let i = 0; i < str.length; i++) {
      const ch = str[i], cw = ctx.measureText(ch).width;
      ctx.strokeText(ch, x, y + Math.sin(t * 8 + i) * 1.5);
      ctx.fillStyle = 'hsl(' + ((t * 300 + i * 30) % 360) + ',95%,62%)';
      ctx.fillText(ch, x, y + Math.sin(t * 8 + i) * 1.5);
      x += cw;
    }
    ctx.textAlign = 'center'; ctx.font = crisp(4) + 'px ' + FONT; ctx.lineWidth = 2;
    ctx.strokeText(G.t('jpSub'), W / 2, y + 14); ctx.fillStyle = '#fff3a0'; ctx.fillText(G.t('jpSub'), W / 2, y + 14);
    if (jp.gold) { ctx.font = crisp(6) + 'px ' + FONT; ctx.strokeText('+' + G.fmt(jp.gold), W / 2, y + 24); ctx.fillStyle = '#ffd84a'; ctx.fillText('+' + G.fmt(jp.gold), W / 2, y + 24); }
    ctx.restore();
  }
  // a fallen ally blinks TAP, so it's clear the Hand can raise them
  function drawTapHints() {
    if (!G.partyUnits || Math.sin(time * 6) < -0.2) return;
    const units = G.partyUnits().filter(u => u.down > 0);
    if (!units.length) return;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = crisp(3) + 'px ' + FONT; ctx.lineWidth = 1.5; ctx.strokeStyle = '#0c0b12';
    for (const u of units) { const q = unitPos(u.who); ctx.strokeText(G.t('tapRevive'), q.x, q.y - 22); ctx.fillStyle = '#8ae07a'; ctx.fillText(G.t('tapRevive'), q.x, q.y - 22); }
  }
  // 3.0: where a dangerous pack comes in: a pulsing arrow at the edge of the view, with what it is
  const incoming = [];
  G.on('packIn', (a, k) => { if (incoming.length < 6 && !G.R.town) incoming.push({ a, k, t: 2.2 }); });
  const IN_COL = { rare: '#ffd84a', magic: '#5a8aff', warded: '#7ab8ff', charger: '#ff7a2e', healer: '#8ae07a', summoner: '#c88aff', leaper: '#b6ff5a', gnat: '#ffe27a', blob: '#5ae8ff', mole: '#c8a070', shieldwall: '#9ad8ff' };
  function drawIncoming(dt) {
    for (let i = incoming.length - 1; i >= 0; i--) {
      const n = incoming[i];
      if ((n.t -= dt) <= 0) { incoming.splice(i, 1); continue; }
      const e = ringPos(n.a, 0), b = btnPos(), x = clamp(e.x, 14, W - 14), y = clamp(e.y, 30, H - 40);
      const dx = b.x - x, dy = b.y - y, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, on = Math.floor(n.t * 6) % 2;
      // a chevron pointing in (3.6: painted once per arrow in both its colours, then stamped)
      const X = Math.round(x), Y = Math.round(y);
      if (!n.spr || n.sx !== X || n.sy !== Y) {
        n.sx = X; n.sy = Y; n.spr = [];
        for (const col of [IN_COL[n.k] || '#ff4f4f', '#ffffff']) {
          const c = SPR.makeCanvas(25, 25), g = c.getContext('2d'); g.fillStyle = col;
          for (let j = 0; j < 7; j++) { const w = 7 - j; for (let k = -w; k <= w; k++) g.fillRect(Math.round(x + ux * j - uy * k * 0.6) - X + 12, Math.round(y + uy * j + ux * k * 0.6) - Y + 12, 1, 1); }
          n.spr.push(c);
        }
      }
      lctx.drawImage(n.spr[on ? 0 : 1], X - 12, Y - 12);
      n.lx = x + ux * 14; n.ly = y + uy * 14;
    }
  }
  function drawIncomingNames() {
    if (!incoming.length) return;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = crisp(3) + 'px ' + FONT; ctx.lineWidth = 2; ctx.strokeStyle = '#0c0b12';
    for (const n of incoming) { if (n.lx == null) continue; const s2 = G.t('in_' + n.k); if (!nameFree(n.lx, n.ly, s2, crisp(3))) continue; ctx.strokeText(s2, n.lx, n.ly); ctx.fillStyle = IN_COL[n.k] || '#ff4f4f'; ctx.fillText(s2, n.lx, n.ly); }
  }
  // the Portal Storm's portals: drawn over the ground, tapped shut
  let wlMark = null;
  const porPos = po => mobPos({ id: -2000 - po.id, a: po.a, p: po.p, kind: 'x' });
  function drawPortals() {
    const ev = G.R.ev;
    if (!ev || ev.k !== 'portals' || !ev.por) return;
    for (const po of ev.por) {
      const q = porPos(po), id = Math.floor(time * 4 + po.id) % 2 && SPR.defs.tw_rift2 ? 'tw_rift2' : 'tw_rift';
      glow(q.x, q.y - 14, 16, '#c88aff', 0.3 + 0.1 * Math.sin(time * 6 + po.id));
      if (SPR.defs[id]) blit(SPR.get(id), q.x, q.y, 0.8);
      if (Math.random() < 0.4) part(q.x + rand(-8, 8), q.y - rand(4, 24), pick(['#c88aff', '#7a3aff', '#ffffff']), { vx: rand(-10, 10), vy: -rand(4, 14), grav: 0, life: 0.5 });
      for (let i = 0; i < 3; i++) { lctx.fillStyle = i < po.hp ? '#c88aff' : '#3a2a4a'; lctx.fillRect(Math.round(q.x - 5 + i * 4), Math.round(q.y - 38), 3, 2); }
    }
  }
  function hitPortal(p) {
    const ev = G.R.ev;
    if (!ev || ev.k !== 'portals' || !ev.por) return null;
    for (const po of ev.por) { const q = porPos(po); if (Math.abs(p.x - q.x) < 16 && p.y < q.y + 4 && p.y > q.y - 36) return po.id; }
    return null;
  }
  function hitMeteor(p) {
    const ev = G.R.ev;
    if (!ev || ev.k !== 'meteors') return null;
    for (const mt of ev.met) {
      const q = metPos(mt), f = 1 - mt.t / mt.T, mx = q.x + (1 - f) * 70, my = q.y - 6 - (1 - f) * 130;
      if (Math.hypot(p.x - mx, p.y - my) < 11 || Math.hypot(p.x - q.x, p.y - q.y) < 9) return mt.id;
    }
    return null;
  }
  function drawRiftTint() {
    const r = G.R.rift;
    if (!r) return;
    lctx.globalAlpha = 0.1 + 0.03 * Math.sin(time * 2);
    lctx.fillStyle = '#6b2fb8';
    lctx.fillRect(0, 0, W, 3); lctx.fillRect(0, H - 3, W, 3); lctx.fillRect(0, 0, 3, H); lctx.fillRect(W - 3, 0, 3, H);
    lctx.globalAlpha = 1;
    if (Math.random() < 0.5) part(rand(0, W), H - 2, pick(['#b36bff', '#6b2fb8', '#e0d0ff']), { vx: 0, vy: rand(-30, -10), grav: 0, life: 0.8 });
  }
  function drawEventNames() {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 1; ctx.strokeStyle = '#0c0b12';
    const s = G.R.shrine, q = shrinePos();
    if (s && q) {
      const S_ = G.SHRINES[s.k];
      ctx.font = crisp(3) + 'px ' + FONT;
      ctx.strokeText(S_.name, q.x, q.y - 22); ctx.fillStyle = S_.col; ctx.fillText(S_.name, q.x, q.y - 22);
      // 4.0: HOLD (the Hand charges it), and how far
      if (inSiege() && G.shrineHold) {
        const k = clamp((s.ch || 0) / (G.TUNE.shrineCharge || 2), 0, 1), str = k > 0 ? Math.round(k * 100) + '%' : G.t('ff_hold');
        ctx.strokeText(str, q.x, q.y + 9); ctx.fillStyle = k > 0 ? '#ffffff' : Math.floor(time * 2) % 2 ? S_.col : '#ffffff'; ctx.fillText(str, q.x, q.y + 9);
      }
    }
    const bq = breachPos();
    if (bq) { ctx.font = crisp(3) + 'px ' + FONT; ctx.strokeText(G.t('breach'), bq.x, bq.y - 12); ctx.fillStyle = '#d8b8ff'; ctx.fillText(G.t('breach'), bq.x, bq.y - 12); }
  }
  St.busyCelebrating = () => (St.celebrate || 0) > time;
  St.lootPoint = e => { const v = gvis.get(e.id); return v && v.landed ? St.toScreen(v.x, v.y - 14) : null; };
  St.shrinePoint = () => { const q = shrinePos(); return q ? St.toScreen(q.x, q.y - 16) : null; };
  function worldListen() {
    G.on('drop', onDrop);
    G.on('pickup', onPickup);
    G.on('hoard', m => {
      cardText(0, G.t('hoardComing'), '#ffd84a', 6, { life: 2, max: 2, vy: -4, big: true });
      St.flash(0.15, '#ffd84a');
      if (G.Audio && G.Audio.hoard) G.Audio.hoard();
    });
    G.on('hoardDie', m => {
      const q = mobPos(m);
      for (let i = 0; i < 40 && coins.length < 260; i++) coins.push({ x: q.x, y: q.y - 6, vx: rand(-70, 70), vy: rand(-150, -60), floor: q.y + rand(-3, 4), t: rand(0.6, 1), fly: 0 });
      text(q.x, q.y - 28, G.t('hoardBurst'), '#ffd84a', 7, { life: 1.8, max: 1.8, vy: -12, big: true });
      ring(q.x, q.y - 3, 34, 18, '#ffd84a', 0.6); ring(q.x, q.y - 3, 22, 12, '#ffffff', 0.4);
      St.shake(6); St.flash(0.3, '#ffd84a'); slowmo = Math.max(slowmo, 0.6); hitstop = Math.max(hitstop, 0.12);
      if (G.Audio && G.Audio.jackpot) G.Audio.jackpot();
    });
    G.on('hoardFlee', m => {
      const q = mobPos(m);
      ring(q.x, q.y - 4, 14, 7, '#b36bff', 0.5);
      burst(q.x, q.y - 6, ['#b36bff', '#e0d0ff'], 20, 60);
      text(q.x, q.y - 24, G.t('hoardFled', Math.max(1, Math.round(m.hp / m.max * 100))), '#c8b4ff', 4, { life: 2, max: 2, vy: -10 });
    });
    G.on('shrine', () => { const q = shrinePos(); if (q) { ring(q.x, q.y - 3, 20, 10, G.SHRINES[G.R.shrine.k].col, 0.6); } if (G.Audio && G.Audio.shrine) G.Audio.shrine(0); });
    G.on('shrineUse', (s, how) => {
      const col = G.SHRINES[s.k].col, b = btnPos(), q = arenaXY(s.a, s.p, 0.5);
      burst(q.x, q.y - 8, [col, '#ffffff'], 40, 100);
      ring(b.x, b.y - 4, 90, 50, col, 0.7); ring(b.x, b.y - 4, 55, 30, '#ffffff', 0.4);
      cardText(0, G.SHRINES[s.k].name, col, 6, { life: 2, max: 2, vy: -4, big: true });
      cardText(9, G.SHRINES[s.k].desc, '#ffffff', 3, { life: 2, max: 2, vy: -4 });
      St.flash(0.3, col); St.shake(3);
      if (G.Audio && G.Audio.shrine) G.Audio.shrine(1);
    });
    G.on('breach', b => {
      cardText(0, G.t('breachOpen'), '#d8b8ff', 7, { life: 2.2, max: 2.2, vy: -4, big: true });
      St.flash(0.3, '#6b2fb8'); St.shake(4);
      breachKills = 0;
      if (G.Audio && G.Audio.breach) G.Audio.breach();
    });
    G.on('breachEnd', () => { cardText(0, G.t('breachClosed', G.fmt(breachKills)), '#d8b8ff', 5, { life: 2, max: 2, vy: -4 }); });
    G.on('mobDie', m => { if (m.br) breachKills++; });
    G.on('blast', (m, r) => {
      const q = mobPos(m), a = aoePx(r);
      ring(q.x, q.y - 3, a.rx, a.ry, '#ff7a2e', 0.3); ring(q.x, q.y - 3, a.rx * 0.6, a.ry * 0.6, '#ffd84a', 0.2);
      burst(q.x, q.y - 5, ['#ff7a2e', '#ffd84a', '#ff3b3b'], 8, 70, { life: 0.35 });
      St.shake(1.5);
      if (G.Audio && G.Audio.boom) G.Audio.boom();
    });
    G.on('bomb', (m, r) => {
      const q = mobPos(m), a = aoePx(r);
      ring(q.x, q.y - 3, a.rx, a.ry, '#ffffff', 0.25); ring(q.x, q.y - 3, a.rx * 0.7, a.ry * 0.7, '#ff7a2e', 0.35);
      burst(q.x, q.y - 5, ['#ff7a2e', '#ffd84a', '#ffffff', '#3a3a44'], 16, 110, { life: 0.4 });
      glowFx.push({ x: q.x, y: q.y - 5, r: a.rx * 0.8, col: '#ff9a3a', t: 0.18, T: 0.18 });
      St.shake(2.5); hitstop = Math.max(hitstop, 0.025);
      if (G.Audio && G.Audio.boom) G.Audio.boom();
    });
    G.on('bomberPop', () => {
      const b = btnPos();
      burst(b.x, b.y - 8, ['#ff3b3b', '#ff7a2e', '#ffd84a', '#3a3a44'], 26, 120, { life: 0.5 });
      ring(b.x, b.y - 4, 34, 18, '#ff7a2e', 0.35);
      St.shake(4); St.flash(0.15, '#ff3b3b'); btnHurtT = 0.25;
      text(b.x + rand(-10, 10), b.y - 34, G.t('bomberPop'), '#ff7a2e', 5, { life: 0.8, max: 0.8, vy: -16 });
      if (G.Audio && G.Audio.boom) G.Audio.boom();
    });
    G.on('spitHit', () => { const b = btnPos(); btnHurtT = 0.12; burst(b.x + rand(-12, 12), b.y - 8, ['#b6ff5a', '#8ad83a', '#ffffff'], 6, 50, { life: 0.35 }); });
    // (3.6: a wave is a word over the Button, not a title card; the boss row says it too)
    G.on('wave', n => {
      const b = btnPos();
      if (cardT <= 0 && !bossVis) text(b.x, b.y - 54, G.t('waveN', n), '#ff9a3a', 5, { life: 1.3, max: 1.3, vy: -6, big: true });
      St.shake(2);
    });
    G.on('landStar', (i, bit) => {
      const R_ = G.REALMS[i], b = btnPos();
      cardText(0, '\u2605 ' + G.t('landStar', R_.name).toUpperCase(), '#ffd84a', 7, { life: 3, max: 3, vy: -3, big: true, tag: 'land' });
      St.flash(0.25, '#ffd84a');
      burst(b.x, b.y - 20, ['#ffd84a', '#fff3a0', '#ffffff'], 40, 130);
      ring(b.x, b.y - 6, 50, 26, '#ffd84a', 0.6);
    });
    // a new zone: its name, and the new kind of mob it brings
    G.on('bossWin', (rew, b) => {
      const d = G.S.depth;
      if (G.realmIndex(d) !== G.realmIndex(b.d)) return; // the land card covers it
      setTimeout(() => zoneCard(d), 900);
    });
    // 2.5: the new kinds show what they're doing
    G.on('charge', m => { const q = mobPos(m); text(q.x, q.y - 14, '!', '#ff3b3b', 6, { life: 0.7, max: 0.7, vy: -12 }); burst(q.x, q.y, ['#c8b89a', '#8a7a60'], 8, 40, { grav: 60, life: 0.4 }); if (G.Audio && G.Audio.whoosh) G.Audio.whoosh(); });
    G.on('mend', (m, n) => { const q = mobPos(m); ring(q.x, q.y - 4, 26, 14, '#5aff7a', 0.45); for (let i = 0; i < Math.min(6, n); i++) part(q.x + rand(-14, 14), q.y - rand(0, 10), '#7aff8a', { vx: 0, vy: -rand(10, 20), grav: 0, life: 0.6 }); });
    G.on('call', m => { const q = mobPos(m); ring(q.x, q.y - 4, 30, 16, '#c88aff', 0.5); burst(q.x, q.y - 6, ['#c88aff', '#6a3aa8'], 10, 50, { life: 0.4 }); });
    G.on('wardedHit', m => { const q = mobPos(m); text(q.x, q.y - 12, G.t('warded'), '#9ad8ff', 3, { life: 0.6, max: 0.6, vy: -14 }); });
    // one new kind's card at a time: two arriving together queue up
    let kindAt = 0;
    G.on('kindFirst', k => {
      const now = performance.now(), at = Math.max(now, kindAt);
      kindAt = at + 3600;
      setTimeout(() => { const A = G.ARCHETYPES[k], R_ = G.REALMS[G.realmIndex(G.S.depth)]; cardText(10, G.t('newKind', (R_.mobs && R_.mobs[k]) || A.name), '#b6ff5a', 4, { life: 3.4, vy: -3, own: true }); cardText(18, A.desc, '#e8f8d0', 3, { life: 3.4, vy: -3 }); }, at - now);
    });
    // 3.4 (js/mobs2.js): the new kinds show what they're doing
    G.on('leapCrouch', m => { const q = mobPos(m); text(q.x, q.y - 14, '!', '#b6ff5a', 5, { life: 0.6, max: 0.6, vy: -10 }); });
    G.on('mobLeap', m => { const q = mobPos(m); burst(q.x, q.y, ['#c8b89a', '#8a7a60'], 6, 35, { grav: 60, life: 0.35 }); });
    G.on('leapLand', m => { const q = mobPos(m); ring(q.x, q.y - 1, 10, 5, '#c8b89a', 0.35); burst(q.x, q.y, ['#c8b89a', '#8a7a60'], 8, 45, { grav: 80, life: 0.35 }); });
    G.on('wallBlock', m => { const q = mobPos(m); mobVisOf(m).hit = 0; burst(q.x + 2, q.y - 8, ['#ffffff', '#9ad8ff'], 3, 40, { life: 0.2 }); if (Math.random() < 0.25) text(q.x, q.y - 16, G.t('wallBlock'), '#9ad8ff', 3, { life: 0.5, max: 0.5, vy: -14 }); });
    G.on('wallShieldBreak', m => { const q = mobPos(m); burst(q.x + 2, q.y - 8, ['#9ad8ff', '#ffffff', '#4f8ad0'], 10, 60, { grav: 60, life: 0.45 }); });
    G.on('blobSplit', (m, kids) => { const q = mobPos(m); burst(q.x, q.y - 4, ['#5ae8ff', '#ffffff'], 8, 45, { grav: 50, life: 0.4 }); });
    G.on('molePop', m => { const q = mobPos(m); burst(q.x, q.y - 2, ['#7a5a3a', '#a8845a', '#5a3a22'], 14, 55, { grav: 110, life: 0.5 }); ring(q.x, q.y - 1, 12, 6, '#a8845a', 0.35); });
    G.on('spores', m => { const q = mobPos(m); burst(q.x, q.y - 5, ['#c84ae8', '#ff7ab0', '#f4ecd8'], 10, 40, { grav: -10, life: 0.8 }); });
    G.on('thorns', m => { const q = mobPos(m); burst(q.x, q.y - 6, ['#b36bff', '#ffffff'], 6, 50, { life: 0.3 }); });
    G.on('headhunter', m => { const hp = heroPos(); text(hp.x, hp.y - 34, G.t('headhunter'), '#e8903a', 4, { life: 1.6, max: 1.6, vy: -12 }); ring(hp.x, hp.y - 4, 30, 15, '#e8903a', 0.5); });
    G.on('bossMove', b => {
      const M = G.BOSS_MOVES[b.move.k], p = bossPos();
      ring(p.x, p.y - 10, 50, 28, M.col, 0.5);
      St.flash(0.12, M.col);
      if (G.Audio && G.Audio.windup) G.Audio.windup(b.move.k);
    });
    G.on('bossTap', b => {
      const w = weakPos(); if (!w) return;
      burst(w.x, w.y, ['#ffffff', G.BOSS_MOVES[b.move.k].col], 8, 60, { life: 0.3 }); ring(w.x, w.y, 14, 8, '#ffffff', 0.25);
      if (G.Audio && G.Audio.bossHit) G.Audio.bossHit();
    });
    G.on('torment', n => { cardText(0, n ? G.t('tormentCard', n) : G.t('tormentN', 0, G.tormentMax()), n ? '#ff3b5c' : '#ffffff', 6, { life: 1.6, max: 1.6, vy: -3, big: true }); if (n) St.flash(0.15 + 0.03 * n, '#ff2a4a'); });
    G.on('shieldBreak', () => { const p = bossPos(); text(p.x, overBoss(10), G.t('shieldBroken'), '#7ad0ff', 5, { life: 1.4, max: 1.4, vy: -6 }); burst(p.x, p.y - 14, ['#7ad0ff', '#ffffff'], 30, 110); ring(p.x, p.y - 10, 60, 34, '#7ad0ff', 0.4); });
    G.on('bossLeech', () => { const p = bossPos(); if (Math.random() < 0.6) text(p.x + rand(-10, 10), p.y - 30, '+', '#ff3b5c', 4, { life: 0.6, max: 0.6, vy: -20 }); });
    G.on('bossEnrage', b => {
      const p = bossPos();
      cardText(0, G.t('enrageCard'), '#ff3b3b', 6, { life: 2.2, max: 2.2, vy: -3, big: true });
      cardText(12, G.t('enrageSub'), '#ffd0c0', 3, { life: 2.2, max: 2.2, vy: -3 });
      ring(p.x, p.y - 10, 110, 60, '#ff2a2a', 0.6); St.flash(0.4, '#ff2a2a'); St.shake(7);
      if (G.Audio && G.Audio.boom) G.Audio.boom();
    });
    G.on('bossStagger', (b, k) => {
      const p = bossPos();
      text(p.x, overBoss(14), G.t('staggered'), '#ffffff', 7, { life: 1.4, max: 1.4, vy: -6, big: true });
      ring(p.x, p.y - 10, 80, 44, '#ffffff', 0.5); ring(p.x, p.y - 10, 50, 28, G.BOSS_MOVES[k].col, 0.4);
      burst(p.x, p.y - 14, ['#ffffff', G.BOSS_MOVES[k].col, '#ffe27a'], 40, 120);
      hitstop = Math.max(hitstop, 0.1); St.shake(5); St.flash(0.3, '#ffffff'); bossHitT = 0.2;
      if (G.Audio && G.Audio.stagger) G.Audio.stagger();
    });
    G.on('bossMoveLand', (b, k) => {
      const p = bossPos(), bp = btnPos();
      if (k === 'slam') { St.shake(8); St.flash(0.35, '#ff3b3b'); ring(bp.x, bp.y - 2, 70, 38, '#ff3b3b', 0.5); burst(bp.x, bp.y - 4, ['#ff3b3b', '#3a3a44', '#ffffff'], 40, 110); }
      if (k === 'summon') { ring(p.x, p.y - 10, 90, 50, '#b36bff', 0.6); St.flash(0.2, '#6b2fb8'); }
      if (k === 'doom') { St.shake(12); St.flash(0.6, '#ff2ad4'); ring(bp.x, bp.y - 2, 140, 80, '#ff2ad4', 0.7); burst(bp.x, bp.y - 4, ['#ff2ad4', '#0c0b12', '#ffffff'], 80, 160); hitstop = Math.max(hitstop, 0.12); }
      text(p.x, overBoss(12), G.BOSS_MOVES[k].name + '!', G.BOSS_MOVES[k].col, 6, { life: 1.2, max: 1.2, vy: -6 });
      if (G.Audio && G.Audio.boom) G.Audio.boom();
    });
    G.on('bossRage', () => {
      const p = bossPos();
      cardText(0, G.t('enraged'), '#ff3b3b', 7, { life: 1.8, max: 1.8, vy: -3, big: true, now: true, tag: 'phase' });
      St.flash(0.35, '#ff3b3b'); St.shake(6);
      if (G.Audio && G.Audio.horn) G.Audio.horn();
    });
    G.on('riftStart', r => {
      groundKey = '';
      cardText(0, G.t('riftName', r.lvl), '#e0c0ff', 9, { life: 2.2, max: 2.2, vy: -4, big: true });
      cardText(11, G.t('riftGo'), '#ffffff', 3, { life: 2.2, max: 2.2, vy: -4 });
      const b = btnPos(); ring(b.x, b.y - 4, 100, 56, '#b36bff', 0.8); ring(b.x, b.y - 4, 60, 34, '#ffffff', 0.5);
      St.flash(0.5, '#6b2fb8'); St.shake(5);
      if (G.Audio && G.Audio.rift) G.Audio.rift(0);
    });
    G.on('riftGuardian', m => {
      cardText(0, G.t('riftGuardian'), '#ff3b5c', 7, { life: 2, max: 2, vy: -4, big: true });
      St.flash(0.3, '#ff3b3b'); St.shake(5);
      if (G.Audio && G.Audio.horn) G.Audio.horn();
    });
    G.on('riftEnd', r => {
      groundKey = '';
      if (r.win) {
        cardText(0, G.t('riftCleared'), '#ffd84a', 8, { life: 2.6, max: 2.6, vy: -4, big: true });
        cardText(11, G.t(r.up === 1 ? 'riftUp1' : 'riftUp', r.up, r.open, Math.round(r.used)), '#ffffff', 3, { life: 2.6, max: 2.6, vy: -4 });
        const b = btnPos(); ring(b.x, b.y - 4, 100, 56, '#ffd84a', 0.8);
        burst(b.x, b.y - 10, ['#ffd84a', '#ffffff', '#b36bff'], 80, 150);
        St.flash(0.4, '#ffd84a'); St.shake(6); slowmo = Math.max(slowmo, 0.6);
      } else {
        cardText(0, G.t(r.why === 'broke' ? 'riftBroke' : 'riftFailed'), '#c8b4ff', 6, { life: 2.2, max: 2.2, vy: -4, big: true });
        St.flash(0.4, '#1e0e34');
      }
      if (G.Audio && G.Audio.rift) G.Audio.rift(r.win ? 1 : 2);
    });
  }
  let breachKills = 0;

  // ---------- Frame ----------
  // ---------- The Town (2.4) ----------
  // A square of cobbles round a well; each building opens its own window (see UI.townOpen). The field
  // holds still meanwhile. Places are fractions of the view: bottom-centre of each building's sprite.
  // 3.0: eleven buildings and the portal. A wide view has two rows; a narrow one (phones) three.
  // w/n: [x as a fraction of the view, row] for the wide and the narrow layout.
  const TOWN = [
    { id: 'barracks', spr: 'tw_barracks', w: [0.08, 0], n: [0.13, 1] },
    { id: 'forge', spr: 'tw_forge', npc: 'npc_smith', w: [0.22, 0], n: [0.2, 0] },
    { id: 'enchant', spr: 'tw_tower', npc: 'npc_witch', w: [0.36, 0], n: [0.33, 1] },
    { id: 'portal', spr: 'tw_portal', w: [0.5, 0], n: [0.5, 0] },
    { id: 'stars', spr: 'tw_obs', npc: 'npc_sage', w: [0.64, 0], n: [0.67, 1] },
    { id: 'alch', spr: 'tw_alch', npc: 'npc_alch', w: [0.78, 0], n: [0.8, 0] },
    { id: 'temple', spr: 'tw_temple', w: [0.92, 0], n: [0.87, 1] },
    { id: 'museum', spr: 'tw_museum', w: [0.11, 1], n: [0.1, 2] },
    { id: 'tavern', spr: 'tw_tavern', npc: 'npc_keeper', w: [0.29, 1], n: [0.3, 2] },
    { id: 'quests', spr: 'tw_board', w: [0.5, 1], n: [0.5, 2] },
    { id: 'pets', spr: 'tw_nest', w: [0.71, 1], n: [0.7, 2] },
    { id: 'rift', spr: 'tw_rift', w: [0.89, 1], n: [0.9, 2] },
  ];
  St.TOWN = TOWN;
  G.on('town', on => { parts.length = 0; texts.length = 0; villagers.length = 0; critters.length = 0; townHover = null; hudRead = false; St.flash(0.6, '#0c0b12'); if (!on) { groundKey = ''; } });
  G.on('build', id => { const t = TOWN.find(x => x.id === id); if (!t || !G.R.town) return; const q = townPlace(t); burst(q.x, q.y0 + q.h / 2, ['#ffd84a', '#ffffff', '#ffe27a'], 40, 90); ring(q.x, q.y - 4, 30, 14, '#ffd84a', 0.6); St.flash(0.15, '#ffe27a'); });
  let townGround = null, townKey = '', townHover = null, townVig = null, townVigK = '';
  const sprOr = id => (SPR.defs[id] ? SPR.get(id) : null);
  const narrowTown = () => W < 400;
  // a building still to open stands as scaffolding; one built up three times or more takes its grander look
  const townOpen = t => t.id === 'portal' || !G.bldOpen || G.bldOpen(t.id);
  const townLv = t => (G.bldLvl ? G.bldLvl(t.id) : 0);
  function townSpr(t) {
    if (!townOpen(t) && SPR.defs.tw_build) return 'tw_build';
    if (townLv(t) >= 3 && SPR.defs[t.spr + '_2']) return t.spr + '_2';
    return SPR.defs[t.spr] ? t.spr : null;
  }
  // the town is laid out below the top HUD: the back row stands its tallest building's height under it
  let townTop = 0;
  function townRows() {
    // (in town the land box is hidden: only the buttons at the top right stay; read with the HUD, St.readLayout)
    if (!townTop) hudBoxesNow();
    if (narrowTown()) {
      const r0 = Math.round(townTop + 70), r2 = H - 6, r1 = Math.round((r0 + r2) / 2);
      return { rows: [r0, r1, r2], r1: r0, r2, mid: r1, wellY: r1 - 2 };
    }
    const r1 = Math.round(Math.max(H * 0.42, townTop + 66)), r2 = Math.round(Math.min(H - 6, Math.max(r1 + 74, H * 0.8)));
    return { rows: [r1, r2], r1, r2, mid: Math.round((r1 + r2) / 2), wellY: Math.round((r1 + r2) / 2) + 10 };
  }
  function townPlace(t) {
    const id = townSpr(t), c = id ? SPR.get(id) : null, w = c ? c.width : 40, h = c ? c.height : 34, rw = townRows();
    const at = narrowTown() ? t.n : t.w, y = rw.rows[at[1]], x = Math.round(W * at[0]);
    return { x, y, w, h, c, x0: x - w / 2, y0: y - h };
  }
  function buildTownGround() {
    const c = SPR.makeCanvas(W, H), x = c.getContext('2d'), rnd = G.seeded(4242);
    // grass round the edge, cobbles in the square
    x.fillStyle = '#3e6b34'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < W * H / 14; i++) { x.fillStyle = rnd() < 0.5 ? '#4b7d3e' : '#355d2d'; x.fillRect(Math.floor(rnd() * W), Math.floor(rnd() * H), 1, 1); }
    const rw = townRows(), cx = W / 2, cy = rw.mid + 6, rx = W * (narrowTown() ? 0.46 : 0.37), ry = Math.max(H * 0.3, (rw.r2 - rw.r1) * 0.75 + 24);
    for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
      const dx = (xx - cx) / rx, dy = (yy - cy) / ry, d = dx * dx + dy * dy;
      if (d > 1 + (rnd() - 0.5) * 0.06) continue;
      // stones: a 6x4 brick grid, each stone its own shade, dark seams between
      const row = Math.floor(yy / 4), off = row % 2 ? 3 : 0, col = Math.floor((xx + off) / 6);
      const seam = yy % 4 === 3 || (xx + off) % 6 === 5;
      const v = ((col * 73856093) ^ (row * 19349663)) & 7;
      x.fillStyle = seam ? '#4a4540' : ['#8a837a', '#7f786f', '#958d83', '#867f75', '#7a736a', '#8f877d', '#827b72', '#9a9288'][v];
      x.fillRect(xx, yy, 1, 1);
    }
    // the road to the portal
    x.fillStyle = 'rgba(60,50,40,0.18)'; x.fillRect(Math.round(cx - 10), Math.round(H * 0.4), 20, Math.round(H * 0.2));
    // scatter: flowers on the grass, lamps, barrels and crates by the walls
    const put = (id, px, py) => { const s = sprOr(id); if (s) x.drawImage(s, Math.round(px - s.width / 2), Math.round(py - s.height)); };
    for (let i = 0; i < 26; i++) { const px = rnd() * W, py = rnd() * H, dx = (px - cx) / rx, dy = (py - cy) / ry; if (dx * dx + dy * dy > 1.05) put('tw_flower', px, py); }
    // a ring of trees round the square, thicker at the back
    for (let i = 0; i < 46; i++) { const a = rnd() * Math.PI * 2, k = 1.08 + rnd() * 0.5, px = cx + Math.cos(a) * rx * k, py = cy + Math.sin(a) * ry * k + 10; if (py > 20) put('tw_tree', px, py); }
    const wy = rw.wellY;
    put('tw_lamp', cx - 34, wy + 2); put('tw_lamp', cx + 34, wy + 2);
    put('tw_barrel', W * 0.4, rw.r2 + 3); put('tw_crate', W * 0.2, wy + 6); put('tw_barrel', W * 0.8, wy + 6); put('tw_crate', W * 0.6, rw.r2 + 3);
    put('tw_banner', W * 0.43, rw.r1 + 2); put('tw_banner', W * 0.57, rw.r1 + 2);
    // market stalls and benches round the fountain
    if (!narrowTown()) { put('tw_stall', cx - 62, wy + 8); put('tw_stall2', cx + 62, wy + 8); }
    put('tw_bench', cx - 22, wy + 18); put('tw_bench', cx + 22, wy + 18);
    return c;
  }
  const villagers = [], critters = [];
  // townsfolk: more of them the more the town is built up
  function stepVillagers(dt, cx, cy) {
    const ids = ['npc_sage', 'npc_keeper', 'npc_alch', 'npc_smith', 'npc_witch'], want = Math.min(16, 5 + Math.floor((G.townLvl ? G.townLvl() : 0) / 3));
    while (villagers.length < want) villagers.push({ x: cx + rand(-60, 60), y: cy + rand(-20, 30), tx: cx, ty: cy, id: pick(ids), w: rand(0, 3) });
    for (const v of villagers) {
      if (v.w > 0) v.w -= dt;
      else {
        const dx = v.tx - v.x, dy = v.ty - v.y, d = Math.hypot(dx, dy);
        if (d < 1) { v.w = rand(1, 4); const t = pick(TOWN), q = townPlace(t); v.tx = q.x + rand(-14, 14); v.ty = q.y + rand(2, 10); }
        else { const sp = 12 * dt / d; v.x += dx * Math.min(1, sp); v.y += dy * Math.min(1, sp); v.face = dx >= 0 ? 1 : -1; }
      }
      const f = v.w > 0 || Math.floor(time * 5) % 2 ? v.id : v.id + '2', c = sprOr(f) || sprOr(v.id);
      if (!c) continue;
      lctx.fillStyle = 'rgba(0,0,0,0.25)'; lctx.fillRect(Math.round(v.x) - 3, Math.round(v.y), 6, 1);
      if (v.face < 0) { lctx.save(); lctx.translate(Math.round(v.x), 0); lctx.scale(-1, 1); lctx.drawImage(c, -(c.width >> 1), Math.round(v.y) - c.height); lctx.restore(); }
      else lctx.drawImage(c, Math.round(v.x) - (c.width >> 1), Math.round(v.y) - c.height);
    }
  }
  // a cat on the steps, a dog trotting about, chickens pecking by the stalls
  function stepCritters(dt, cx, cy) {
    if (!critters.length && SPR.defs.tw_cat) {
      critters.push({ k: 'cat', x: cx - 40, y: cy + 14, w: 0 }, { k: 'dog', x: cx + 30, y: cy + 20, w: 1 }, { k: 'chicken', x: cx - 70, y: cy + 22, w: 0.5 }, { k: 'chicken', x: cx + 74, y: cy + 24, w: 2 });
      critters.forEach(c => { c.tx = c.x; c.ty = c.y; c.face = 1; c.pk = 0; });
    }
    for (const c of critters) {
      const sp = c.k === 'dog' ? 22 : c.k === 'cat' ? 9 : 6;
      if (c.w > 0) { c.w -= dt; if (c.k === 'chicken') c.pk = Math.random() < 0.04 ? 0.3 : Math.max(0, c.pk - dt); }
      else {
        const dx = c.tx - c.x, dy = c.ty - c.y, d = Math.hypot(dx, dy);
        if (d < 1) { c.w = c.k === 'cat' ? rand(4, 10) : rand(1, 4); const r = c.k === 'dog' ? 90 : 30; c.tx = clamp(c.x + rand(-r, r), 10, W - 10); c.ty = clamp(c.y + rand(-r / 3, r / 3), cy - 30, H - 10); }
        else { const k = Math.min(1, sp * dt / d); c.x += dx * k; c.y += dy * k; c.face = dx >= 0 ? 1 : -1; }
      }
      const id = c.k === 'cat' ? (Math.floor(time * 0.7) % 2 ? 'tw_cat2' : 'tw_cat') : c.k === 'chicken' ? (c.pk > 0 ? 'tw_chicken2' : 'tw_chicken') : 'tw_dog';
      const im = sprOr(id); if (!im) continue;
      const bob = c.k === 'dog' && c.w <= 0 ? Math.floor(time * 8) % 2 : 0;
      const x = Math.round(c.x), y = Math.round(c.y) - bob;
      lctx.fillStyle = 'rgba(0,0,0,0.25)'; lctx.fillRect(x - 3, Math.round(c.y), 6, 1);
      if (c.face < 0) { lctx.save(); lctx.translate(x, 0); lctx.scale(-1, 1); lctx.drawImage(im, -(im.width >> 1), y - im.height); lctx.restore(); }
      else lctx.drawImage(im, x - (im.width >> 1), y - im.height);
    }
  }
  function hitTown(p) {
    // front to back, as they're drawn
    for (const t of townSorted(true)) { const q = townPlace(t); if (p.x >= q.x0 - 2 && p.x <= q.x0 + q.w + 2 && p.y >= q.y0 - 2 && p.y <= q.y + 6) return t; }
    return null;
  }
  // back to front (front to back with rev): by row, then left to right
  function townSorted(rev) {
    const row = t => (narrowTown() ? t.n : t.w)[1];
    const l = TOWN.slice().sort((a, b) => row(a) - row(b));
    return rev ? l.reverse() : l;
  }
  St.townHit = p => hitTown(p);
  St.townPoint = id => { const t = TOWN.find(x => x.id === id); if (!t) return null; const q = townPlace(t), r = stageRect(); return { x: r.left + q.x * S, y: r.top + q.y0 * S }; };
  function drawTown(dt) {
    const k = W + 'x' + H + (SPR.defs.tw_forge ? 'a' : '') + townRows().r1;
    if (k !== townKey || !townGround) { townKey = k; townGround = buildTownGround(); }
    lctx.imageSmoothingEnabled = false;
    lctx.drawImage(townGround, 0, 0);
    const rw = townRows(), cx = Math.round(W / 2), cy = rw.wellY;
    // the fountain in the middle (the well, without the art), the party round it
    const fid = SPR.defs.tw_fountain ? (Math.floor(time * 3.5) % 2 ? 'tw_fountain2' : 'tw_fountain') : 'tw_well', well = sprOr(fid);
    if (well) lctx.drawImage(well, cx - (well.width >> 1), cy - well.height + 4);
    if (Math.random() < 0.3) part(cx + rand(-4, 4), cy - (well ? well.height : 16) + 6, pick(['#bfe8ff', '#ffffff', '#7fc8ff']), { vx: rand(-8, 8), vy: -rand(10, 20), grav: 60, life: 0.5 });
    const S0 = G.S, units = [S0.hero && S0.hero.cls].concat((S0.party || []).map(m => m.cls)).filter(Boolean);
    units.forEach((cls, i) => {
      const C = G.CLASS_BY_ID[cls], sp = C && sprOr(C.spr); if (!sp) return;
      const a = Math.PI * 0.75 + i * Math.PI * 0.5, px = Math.round(cx + Math.cos(a) * 24), py = Math.round(cy + 10 + Math.sin(a) * 9 + (Math.floor(time * 2 + i) % 2));
      lctx.fillStyle = 'rgba(0,0,0,0.25)'; lctx.fillRect(px - 4, py, 8, 1);
      lctx.drawImage(sp, px - (sp.width >> 1), py - sp.height);
    });
    stepCritters(dt, cx, cy);
    // buildings, back to front
    for (const t of townSorted()) {
      const q = townPlace(t), open = townOpen(t), lv = townLv(t);
      let c = q.c;
      if (open && t.id === 'portal' && Math.floor(time * 4) % 2 && SPR.defs.tw_portal2) c = SPR.get('tw_portal2');
      if (open && t.id === 'rift' && Math.floor(time * 4) % 2 && SPR.defs.tw_rift2) c = SPR.get('tw_rift2');
      lctx.fillStyle = 'rgba(0,0,0,0.25)'; lctx.fillRect(Math.round(q.x0 + 2), q.y - 1, q.w - 4, 2);
      // a fully built one glows gold underneath
      if (lv >= G.BLD_MAX) glow(q.x, q.y - q.h * 0.4, q.w * 0.6, '#ffd84a', 0.14 + 0.05 * Math.sin(time * 2 + q.x));
      if (c) lctx.drawImage(c, Math.round(q.x0), q.y0);
      else { lctx.fillStyle = '#6a4a30'; lctx.fillRect(Math.round(q.x0), q.y0, q.w, q.h); }
      if (townHover === t) { lctx.globalAlpha = 0.18 + 0.08 * Math.sin(time * 8); lctx.fillStyle = '#ffe27a'; lctx.fillRect(Math.round(q.x0) - 1, q.y0 - 1, q.w + 2, q.h + 2); lctx.globalAlpha = 1; }
      if (!open) continue;
      // lanterns by the door once it's built up
      if (lv >= 1) { const ln = sprOr('tw_lantern'); if (ln) { lctx.drawImage(ln, Math.round(q.x0) - 2, q.y - 22); if (lv >= 2) lctx.drawImage(ln, Math.round(q.x0 + q.w) - 4, q.y - 22); glow(q.x0 + 1, q.y - 15, 6, '#ffd27a', 0.2 + 0.05 * Math.sin(time * 3 + q.x)); } }
      // its keeper at the door, idling on two frames
      if (t.npc) { const f = Math.floor(time * 1.6 + q.x * 0.1) % 2 && SPR.defs[t.npc + '2'] ? t.npc + '2' : t.npc, n = sprOr(f); if (n) lctx.drawImage(n, Math.round(q.x + q.w / 2 - n.width + 2), q.y - n.height + 2); }
      if (t.id === 'forge' && Math.random() < 0.3 + 0.1 * lv) part(q.x0 + q.w * 0.75, q.y0 + 2, pick(lv >= 3 ? ['#ff9a3a', '#ffd84a', '#6a6a72'] : ['#6a6a72', '#8a8a92', '#4a4a52']), { vx: rand(-3, 3), vy: -rand(8, 16), grav: 0, life: rand(1, 2) });
      if (t.id === 'tavern' && Math.random() < 0.15) part(q.x0 + q.w * 0.3, q.y0 + 2, pick(['#8a8a92', '#6a6a72']), { vx: rand(-2, 2), vy: -rand(6, 12), grav: 0, life: rand(1.2, 2) });
      if (t.id === 'portal' && Math.random() < 0.5) part(q.x + rand(-8, 8), q.y0 + q.h * 0.5 + rand(-8, 8), pick(['#7fe9ff', '#4fa8ff', '#ffffff']), { vx: rand(-6, 6), vy: -rand(4, 12), grav: 0, life: 0.6 });
      if (t.id === 'rift' && Math.random() < 0.4) part(q.x + rand(-6, 6), q.y0 + q.h * 0.5 + rand(-8, 8), pick(['#c88aff', '#ffffff', '#7a3aff']), { vx: rand(-8, 8), vy: -rand(4, 12), grav: 0, life: 0.6 });
      if (t.id === 'temple' && Math.random() < 0.2) part(q.x + rand(-10, 10), q.y0 + rand(0, 10), pick(['#fff4c0', '#ffd84a']), { vx: rand(-2, 2), vy: -rand(4, 10), grav: 0, life: 1.2 });
      if (t.id === 'enchant' && Math.random() < 0.15) part(q.x + rand(-6, 6), q.y0 + 4, pick(['#c88aff', '#ffffff']), { vx: rand(-4, 4), vy: -rand(4, 10), grav: 0, life: 1 });
      if (lv >= G.BLD_MAX && Math.random() < 0.1) part(q.x + rand(-q.w / 2, q.w / 2), q.y0 + rand(0, q.h), '#ffe27a', { vx: 0, vy: -rand(4, 10), grav: 0, life: 0.8 });
    }
    // townsfolk strolling between the doors, fireflies in the dusk
    stepVillagers(dt, cx, cy);
    if (Math.random() < 0.08) part(rand(0, W), rand(rw.r1 - 30, H), pick(['#e8ff8a', '#ffe27a']), { vx: rand(-4, 4), vy: rand(-4, 4), grav: 0, life: rand(1.5, 3) });
    stepDrawParts(dt);
    // warm evening light, darker at the edges (3.6: painted once per size)
    const vk = W + 'x' + H + '@' + cx + ',' + cy;
    if (vk !== townVigK) {
      townVigK = vk; townVig = SPR.makeCanvas(W, H);
      const x = townVig.getContext('2d'), vgl = x.createRadialGradient(cx, cy, 30, cx, cy, Math.max(W, H) * 0.7);
      vgl.addColorStop(0, 'rgba(255,210,140,0.06)'); vgl.addColorStop(1, 'rgba(10,8,20,0.45)');
      x.fillStyle = vgl; x.fillRect(0, 0, W, H);
    }
    lctx.drawImage(townVig, 0, 0);
    // the pixel layer is on screen as it is; then the names on the hi-res layer
    setShift(0, 0); setFx(0, flash);
    if (flash > 0) flash = Math.max(0, flash - dt * 1.8);
    const kk = S * TDPR;
    clearText();
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(kk, 0, 0, kk, 0, 0);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 1.2; ctx.strokeStyle = '#0c0b12';
    for (const t of TOWN) {
      const q = townPlace(t), on = townHover === t, open = townOpen(t), lv = townLv(t), nm = G.t('town_' + t.id);
      ctx.font = crisp(on ? 4 : 3) + 'px ' + FONT;
      const y = q.y0 - 5 + (on ? Math.sin(time * 6) : 0);
      ctx.strokeText(nm, q.x, y); ctx.fillStyle = !open ? '#8a8494' : on ? '#ffe27a' : t.id === 'portal' ? '#7fe9ff' : lv >= G.BLD_MAX ? '#ffd84a' : '#ffffff'; ctx.fillText(nm, q.x, y);
      // what it wants from you: a red mark when there's something to do, a gold arrow when you can build it up
      const ping = open && G.UI && G.UI.bldPing && G.UI.bldPing(t.id), up = open && G.UI && G.UI.bldCanBuild && G.UI.bldCanBuild(t.id);
      if (ping || up) {
        const w = measureW(nm), bx = q.x + w / 2 + 3, by = y - 1 + Math.sin(time * 5) * 0.8;
        ctx.fillStyle = '#0c0b12'; ctx.fillRect(bx - 2, by - 2, 4, 4);
        ctx.fillStyle = ping ? '#ff4f4f' : '#ffd84a'; ctx.fillRect(bx - 1.5, by - 1.5, 3, 3);
      }
    }
    // (the town's name only where the HUD leaves room for it)
    if (W >= 320) {
    ctx.font = crisp(6) + 'px ' + FONT; const ty = H * 0.13;
    ctx.lineWidth = 2; ctx.strokeText(G.t('townTitle'), W / 2, ty); ctx.fillStyle = '#ffe27a'; ctx.fillText(G.t('townTitle'), W / 2, ty);
    ctx.font = crisp(3) + 'px ' + FONT; ctx.lineWidth = 1;
    const sub = G.townLvl ? G.t('dirLvl', G.townLvl()) + ' · ' + G.t('townSub') : G.t('townSub');
    ctx.strokeText(sub, W / 2, ty + 9); ctx.fillStyle = '#e8e0d0'; ctx.fillText(sub, W / 2, ty + 9);
    }
    drawTexts(dt);
    endText();
  }

  // (a section timer for profiling: St._sect = {} turns it on)
  let secT = 0;
  let secOps = 0;
  function SEC(k) { const o = St._sect; if (!o) return; const n = performance.now(); o[k] = (o[k] || 0) + n - secT; secT = n; if (typeof window !== 'undefined' && window.__opc != null) { o['#' + k] = (o['#' + k] || 0) + window.__opc - secOps; secOps = window.__opc; } }
  St.frame = function (dt) {
    if (St._sect) { secT = performance.now(); St._sect.n = (St._sect.n || 0) + 1; if (typeof window !== 'undefined' && window.__opc != null) secOps = window.__opc; }
    time += dt; fdt = dt || 1 / 60;
    if (G.R.town) { if (late.length) flushLate(); pfx.length = 0; pend.clear(); drawTown(dt); return; }
    // several kills in one frame weigh more
    // the Horde dies in heaps all the time now: only a real heap stops the frame
    if (multiCd > 0) multiCd -= dt;
    if (frameKills >= 12 && multiCd <= 0) {
      const big = frameKills >= 40;
      multiCd = big ? 0.5 : 0.3;
      hitstop = Math.max(hitstop, big ? 0.05 : 0.02); St.shake(big ? 3 : 1.5);
      const b = btnPos();
      if (cardT <= 0) text(b.x + rand(-40, 40), b.y + 30 + rand(0, 6), '×' + frameKills, big ? '#ff9a3a' : '#ffe27a', big ? 6 : 4, { life: 0.9, max: 0.9, vy: -20, dmg: !big });
      if (big && G.Audio && G.Audio.heap) G.Audio.heap(frameKills);
    }
    frameKills = 0;
    stepCards(dt);
    // a boss about to arrive on its own counts down over the Button
    const bin = G.R.bossReady && !G.R.boss && !G.R.inv && G.S.set.autoBoss && G.R.bossIn != null && G.R.bossIn > 0 && G.bossOdds && G.bossOdds() >= 0.6 ? Math.ceil(G.R.bossIn) : 0;
    if (bin && bin !== lastCount) { const b = btnPos(); text(b.x, b.y - 62, G.t('bossCountdown', bin), '#ff4f4f', 6, { life: 0.9, max: 0.9, vy: -6, big: true }); St.shake(1); if (G.Audio && G.Audio.bossCount) G.Audio.bossCount(bin); }
    lastCount = bin;
    openHeat = Math.max(0, openHeat - dt * 8);
    hurtFx = Math.max(0, hurtFx - dt * 1.1);
    if (btnDmg > 0 && (btnDmgT -= dt) <= 0) {
      const b = btnPos(), f = btnDmg / Math.max(1, G.D.heroHp);
      text(b.x + rand(-12, 12), b.y - 30, '-' + fmtSmall(btnDmg), f > 0.08 ? '#ff3b3b' : '#ff7a7a', f > 0.08 ? 5 : 4, { life: 0.75, max: 0.75, vy: -20, dmg: f <= 0.08 });
      btnDmg = 0; btnDmgT = 0.22;
    }
    const lowHp = G.S.hero && G.S.hero.cls && !(G.R.btnDown > 0) && G.S.hero.hp < G.D.heroHp * 0.3;
    if (lowHp && (beatT -= dt) <= 0) { beatT = 0.85; if (G.Audio && G.Audio.heartbeat) G.Audio.heartbeat(); }
    if (killGold > 0 && (killGoldT -= dt) <= 0) { const b = btnPos(); text(b.x + rand(-6, 6), b.y + 16, '+' + fmtSmall(killGold), '#f0c850', 3, { life: 0.8, max: 0.8, vy: -10, dmg: true }); killGold = 0; killGoldT = 0.45; }
    // hit-stop and slow motion only touch the visuals; the game keeps its own clock
    const vdt = dt * (hitstop > 0 ? 0.08 : slowmo > 0 ? 0.3 : 1);
    if (hitstop > 0) hitstop -= dt;
    if (slowmo > 0) slowmo -= dt;
    streak.t += dt;
    if (comboTier && G.R.combo < (G.D.comboCap || 50) / 4) comboTier = 0;
    if (streak.t > 2) streak.n = 0;
    if (streak.pop > 0) streak.pop -= dt;
    const S_ = G.S, R = G.R;
    const realm = G.REALMS[G.realmIndex(G.depthNow ? G.depthNow() : G.S.depth)];
    // every zone of a land has its own light and ground (in a Rift, the Rift's)
    const zone = G.R.rift ? 1 : G.ZONE_LOOK(G.zoneOf(G.depthNow ? G.depthNow() : G.S.depth));
    const gk = realm.id + '|' + zone + '|' + W + 'x' + H;
    if (gk !== groundKey) { if (groundKey.split('|')[0] !== realm.id) St.clearStain(); if (groundKey && !march) zoneFade = 1; groundKey = gk; groundCanvas = buildGround(realm.id, zone); }
    buildHeroes();
    SEC('pre');

    // hold-to-click
    if (holding) { holdTimer -= dt; if (holdTimer <= 0) { holdTimer = 1 / Math.max(0.5, G.D.holdRate || 0); if (G.D.holdRate > 0) G.manualClick(); } }

    lctx.imageSmoothingEnabled = false;
    // 3.4: the march: the old ground rolls away below and the next zone comes in from ahead (above)
    if (march) {
      march.t += dt;
      const k = Math.min(1, march.t / march.T), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2, off = Math.round(e * H);
      if (march.prev && march.prev !== groundCanvas) { lctx.drawImage(march.prev, 0, off); lctx.drawImage(groundCanvas, 0, off - H); }
      else lctx.drawImage(groundCanvas, 0, 0);
      marchFx(dt, k);
      if (k >= 1) march = null;
    } else lctx.drawImage(groundCanvas, 0, 0);
    SEC('ground');
    if (realm.id === 'shore') drawWater();
    drawDecals(dt);
    stepGibs(vdt);
    drawGibs(true);
    drawPerkFx();
    drawBreach();
    drawRiftTint();
    drawInvasionSky(vdt);
    drawZoneFx(vdt);
    drawEventFx(vdt);
    stepGround(vdt);
    drawJackpot(dt);
    siegeUnder(dt, vdt);

    // Collect drawables by y (3.6: into integer-y buckets, no sort; mobs go in as their cached vis)
    const list = DL;
    const b = btnPos();

    // Chests
    for (const c of S_.chests) {
      const v = visFor(c);
      v.t += dt;
      if (v.drop > 0) v.drop = Math.max(0, v.drop - dt * 3.2);
      if (v.hit > 0) v.hit -= dt;
      if (v.pop > 0) v.pop -= dt;
      if (v.arc && (v.arc.t += vdt) >= v.arc.dur) { v.arc = null; landed(c, v); }
      list.push({ y: v.y, draw: () => drawChest(c, v) });
    }
    // the Looters run for their chests
    stepLooters(vdt, list);
    // Remove stale vis entries (e.g. after load)
    if (vis.size > S_.chests.length + 4) {
      const ids = new Set(S_.chests.map(c => c.id));
      for (const k of [...vis.keys()]) if (!ids.has(k)) vis.delete(k);
    }
    // Loot on the ground and the shrine
    for (const e of R.ground || []) { const v = gvis.get(e.id); if (v) list.push({ y: v.landed ? v.y : v.y + 20, draw: () => drawGroundItem(e, v) }); }
    if (R.shrine) { const q = shrinePos(); if (q) list.push({ y: q.y, draw: drawShrine }); }
    // Heroes
    for (const hv of heroVis) {
      hv.fire -= dt;
      const tgt = bossVis ? bossPos() : b;
      if (hv.fire <= 0) {
        hv.fire = rand(0.9, 2.2);
        shots.push({ x: hv.x, y: hv.y - 6, sx: hv.x, sy: hv.y - 6, tx: tgt.x + rand(-6, 6), ty: tgt.y - 6 + rand(-4, 4), t: 0, dur: 0.35, col: hv.h.shot });
      }
      list.push({ y: hv.y, draw: () => {
        shadow(hv.x, hv.y - 1, 8);
        const bob = Math.round(Math.sin(time * 4 + hv.ph) * 0.6);
        blit(SPR.get('h_' + hv.h.id), hv.x, hv.y + bob);
      } });
    }
    // Pets
    S_.active.forEach((id, i) => {
      const pp = petPos(i);
      const st = S_.pets[id];
      list.push({ y: pp.y, draw: () => {
        shadow(pp.x, pp.y + 2, 6);
        blit(SPR.get('p_' + id, st && st.gold ? { gold: true } : null), pp.x, pp.y);
        if (st && st.gold && Math.random() < 0.08) part(pp.x + rand(-4, 4), pp.y - rand(2, 8), '#fff3a0', { vy: -10, vx: 0, grav: 0, life: 0.5 });
      } });
    });
    // Mobs and the hero
    if (G.S.hero && G.S.hero.cls) stepParty(dt);
    const mrealm = realm;
    frameRealm = realm;
    SEC('world');
    collectMobs(R.mobs || [], vdt);
    SEC('collect');
    if (G.mobs2) for (const dg of G.mobs2.digs()) {
      const q = mobPos({ id: 0, a: dg.a, p: dg.p });
      if (q.x < -12 || q.x > W + 12 || q.y < -4 || q.y > H + 20) continue;
      list.push({ y: q.y, draw: () => drawDig(q, dg) });
    }
    // the Warden and the companions, each where it has run to
    if (G.partyUnits && G.S.hero && G.S.hero.cls) for (const u of G.partyUnits()) { const q = u.who < 0 ? heroPos() : allySlot(u.who), v = unitVis(u.who); list.push({ y: q.y, draw: () => drawUnit(u, v, q) }); }
    // mobs a blow in the air has killed stand until it lands
    stepLate(dt, list, mrealm);
    if (mobVis.size > (R.mobs || []).length + 20) { const ids = new Set((R.mobs || []).map(m => m.id)); for (const k of [...mobVis.keys()]) if (!ids.has(k)) mobVis.delete(k); }
    // Button or boss
    if (bossVis && bossDmg.acc > 0 && (bossDmg.t -= dt) <= 0) {
      const bp = bossPos();
      text(bp.x + rand(-18, 18), bp.y - 26 - rand(0, 10), '-' + G.fmt(bossDmg.acc), bossDmg.crit ? '#ff7a2e' : '#ffffff', bossDmg.crit ? 5 : 4, { life: 0.7, max: 0.7, vy: -26, dmg: true });
      bossDmg.acc = 0; bossDmg.crit = false; bossDmg.t = Q.phone ? 0.3 : 0.22;
    }
    if (!bossVis) bossDmg.acc = 0;
    if (bossVis) {
      bossVis.t += dt;
      if (bossVis.enter > 0) bossVis.enter = Math.max(0, bossVis.enter - dt * 2.5);
      const bp = bossPos();
      list.push({ y: bp.y + 6, draw: () => drawBoss(bp) });
      bossBulletT -= dt;
      if (bossBulletT <= 0 && R.boss) {
        bossBulletT = bossVis.lord ? (R.boss.rage ? 0.45 : 0.9) : 1.4;
        const n = bossVis.lord ? 14 : 9, off = Math.random() * 6.28;
        const col = bossVis.lord ? '#ff4f7e' : '#ffe27a';
        for (let i = 0; i < n; i++) {
          const a = off + i / n * Math.PI * 2;
          bullets.push({ x: bp.x, y: bp.y - 10, vx: Math.cos(a) * 55, vy: Math.sin(a) * 38, life: 1.6, col });
        }
      }
    } else {
      list.push({ y: b.y + 6, draw: () => drawButton(b) });
    }
    // Wisp
    if (R.wisp) {
      const w = R.wisp, k = 1 - w.t / w.life;
      const dir = w.seed < 0.5 ? 1 : -1;
      const x = dir > 0 ? -10 + k * (W + 20) : W + 10 - k * (W + 20);
      const y = H * (0.25 + w.seed * 0.3) + Math.sin(time * 2.5 + w.seed * 10) * H * 0.12;
      St._wispPos = { x, y };
      list.push({ y, draw: () => {
        // 4.0: in a Siege the Golden Click is a little golden Button (DESIGN §5.8)
        if (inSiege() && SPR.defs.wisp_btn) { drawGoldenWisp(x, y); return; }
        glow(x, y - 4, 6, '#fff3a0', 0.25 + 0.1 * Math.sin(time * 8));
        blit(SPR.get('wisp'), x, y + Math.sin(time * 6) * 1.5);
        if (Math.random() < 0.5) part(x + rand(-3, 3), y - 4, pick(['#fff3a0', '#ffd84a', '#ffffff']), { vx: rand(-8, 8), vy: rand(-8, 8), grav: 0, life: 0.6 });
      } });
    } else St._wispPos = null;

    SEC('list');
    drawBuckets();
    SEC('buckets');
    drawPortals();
    drawMeteors();
    drawIncoming(dt);
    if (G.R.ward > 0) {
      const wb = btnPos(), k = Math.min(1, G.R.ward / 0.5);
      lctx.globalAlpha = (0.16 + 0.06 * Math.sin(time * 10)) * k; lctx.fillStyle = '#ffd84a';
      lctx.beginPath(); lctx.ellipse(wb.x, wb.y + 4, 52, 34, 0, 0, Math.PI * 2); lctx.fill();
      lctx.globalAlpha = 0.6 * k; lctx.strokeStyle = '#fff3a0'; lctx.lineWidth = 1; lctx.stroke(); lctx.globalAlpha = 1;
    }
    drawLootBeams();
    drawShotsInFlight();
    drawBeamsFx(vdt);
    drawRings(vdt); drawGlowFx(vdt);
    stepCoins(vdt);
    stepGems(vdt);

    // Opening chests animation
    for (let i = opening.length - 1; i >= 0; i--) {
      const o = opening[i]; o.t += dt;
      if (o.t >= o.dur) { opening.splice(i, 1); continue; }
      const a = 1 - o.t / o.dur;
      blit(SPR.get((o.bag ? 'bag_' : 'chesto_') + o.tier), o.x, o.y + 1 - (o.bag ? Math.round(o.t * 20) : 0), 1, a);
    }
    // Beams
    for (let i = beams.length - 1; i >= 0; i--) {
      const bm = beams[i]; bm.life -= dt;
      if (bm.life <= 0) { beams.splice(i, 1); continue; }
      const a = bm.life / bm.max;
      lctx.globalAlpha = 0.35 * a;
      lctx.fillStyle = bm.col;
      lctx.fillRect(Math.round(bm.x - bm.w / 2), 0, bm.w, Math.round(bm.y - 2));
      lctx.globalAlpha = 0.6 * a;
      lctx.fillRect(Math.round(bm.x - 1), 0, 2, Math.round(bm.y - 2));
      lctx.globalAlpha = 1;
    }
    // Shots
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i]; s.t += vdt;
      if (s.t >= s.dur) {
        shots.splice(i, 1);
        if (!s.key) part(s.tx, s.ty, s.col, { vx: rand(-20, 20), vy: rand(-20, 5), life: 0.2, grav: 0 });
        if (s.boom) { ring(s.boom.x, s.boom.y, s.boom.rx, s.boom.ry, s.boom.col, 0.2); burst(s.boom.x, s.boom.y - 2, [s.boom.col, '#ffffff'], 4, 50, { life: 0.25 }); }
        continue;
      }
      const k = s.t / s.dur;
      const arc = s.flat ? 0 : 6;
      const x = s.sx + (s.tx - s.sx) * k, y = s.sy + (s.ty - s.sy) * k - Math.sin(k * Math.PI) * arc;
      if (s.arrow) { // a shaft with a head, pointing where it flies
        const d = Math.hypot(s.tx - s.sx, s.ty - s.sy) || 1, ux = (s.tx - s.sx) / d, uy = (s.ty - s.sy) / d;
        lctx.fillStyle = '#c8a870';
        for (let j = 1; j <= 4; j++) lctx.fillRect(Math.round(x - ux * j), Math.round(y - uy * j), 1, 1);
        lctx.fillStyle = '#f0ead8'; lctx.fillRect(Math.round(x - ux * 5), Math.round(y - uy * 5), 1, 1);
        lctx.fillStyle = s.col; lctx.fillRect(Math.round(x), Math.round(y), 1, 1);
        continue;
      }
      lctx.fillStyle = s.col;
      lctx.fillRect(Math.round(x), Math.round(y), s.big ? 3 : 2, s.big ? 3 : 2);
      lctx.globalAlpha = 0.5;
      const px = s.sx + (s.tx - s.sx) * Math.max(0, k - 0.12), py = s.sy + (s.ty - s.sy) * Math.max(0, k - 0.12) - Math.sin(Math.max(0, k - 0.12) * Math.PI) * arc;
      lctx.fillRect(Math.round(px), Math.round(py), 1, 1);
      lctx.globalAlpha = 1;
    }
    if (shots.length > 120) shots.splice(0, shots.length - 120);
    // Boss bullets (RotMG-style rings)
    for (let i = bullets.length - 1; i >= 0; i--) {
      const bl = bullets[i]; bl.life -= dt;
      bl.x += bl.vx * dt; bl.y += bl.vy * dt;
      if (bl.life <= 0 || bl.x < -4 || bl.x > W + 4 || bl.y < -4 || bl.y > H + 4) { bullets.splice(i, 1); continue; }
      lctx.fillStyle = '#0c0b12'; lctx.fillRect(Math.round(bl.x) - 2, Math.round(bl.y) - 1, 4, 2); lctx.fillRect(Math.round(bl.x) - 1, Math.round(bl.y) - 2, 2, 4);
      lctx.fillStyle = bl.col; lctx.fillRect(Math.round(bl.x) - 1, Math.round(bl.y) - 1, 2, 2);
    }
    // Lightning
    for (let i = bolts.length - 1; i >= 0; i--) {
      const bo = bolts[i]; bo.life -= dt;
      if (bo.life <= 0) { bolts.splice(i, 1); continue; }
      if (bo.wide) { // ink edges, a coloured body and a white core, so it reads on sand too
        lctx.fillStyle = '#0c0b12';
        for (let j = 0; j < bo.pts.length - 1; j++) { line(bo.pts[j][0] - 1, bo.pts[j][1], bo.pts[j + 1][0] - 1, bo.pts[j + 1][1]); line(bo.pts[j][0] + 1, bo.pts[j][1], bo.pts[j + 1][0] + 1, bo.pts[j + 1][1]); }
        lctx.fillStyle = bo.cols[1];
        for (let j = 0; j < bo.pts.length - 1; j++) line(bo.pts[j][0] + (j % 2 ? 1 : -1) * 0, bo.pts[j][1], bo.pts[j + 1][0], bo.pts[j + 1][1]);
      }
      lctx.fillStyle = Math.random() < 0.5 ? '#ffffff' : bo.cols ? bo.cols[1] : '#7fe9ff';
      for (let j = 0; j < bo.pts.length - 1; j++) line(bo.pts[j][0], bo.pts[j][1], bo.pts[j + 1][0], bo.pts[j + 1][1]);
    }
    // Flyers (item pops, merge)
    for (let i = flyers.length - 1; i >= 0; i--) {
      const f = flyers[i]; f.t += dt;
      if (f.t >= f.dur) { flyers.splice(i, 1); continue; }
      const k = f.t / f.dur;
      if (f.float) {
        const y = f.y + f.vy * f.t * (1 - k * 0.5);
        const a = k > 0.7 ? (1 - k) / 0.3 : 1;
        if (f.r >= 3) glow(f.x, y - 5, 5, rarityCol(f.r), 0.3 * a);
        blit(SPR.get(f.spr), f.x, y, 1, a);
      } else {
        blit(SPR.get(f.spr) || SPR.get('chest_0'), f.x + (f.tx - f.x) * k, f.y + (f.ty - f.y) * k, 1, 1 - k * 0.5);
      }
    }
    // Particles
    SEC('fx');
    stepDrawParts(vdt);
    drawGibs(false);
    // the party's blows go over the gore, so they read in the thick of it
    drawPfx(vdt);
    siegeOver(dt, vdt);

    // Buff tint
    if (G.hasBuff('frenzy')) { lctx.globalAlpha = 0.07 + 0.03 * Math.sin(time * 6); lctx.fillStyle = '#ffd84a'; lctx.fillRect(0, 0, W, H); lctx.globalAlpha = 1; }
    if (G.hasBuff('storm')) { lctx.globalAlpha = 0.06 + 0.04 * Math.sin(time * 14); lctx.fillStyle = '#7fe9ff'; lctx.fillRect(0, 0, W, H); lctx.globalAlpha = 1; }

    // ---- Show it: the pixel layer is on screen already; the shake moves it, the CSS layers do the light ----
    let ox = 0, oy = 0;
    if (shake > 0) { ox = Math.round(rand(-shake, shake)); oy = Math.round(rand(-shake, shake)); shake = Math.max(0, shake - dt * 30); }
    if (kick > 0) { oy += 1; kick = 0; } // a one-frame downward kick on every click
    setShift(ox, oy);
    // hurt: the edges run red, and pulse while the Button is low (3.6: and while a DOOM gathers)
    const lowK = G.S.hero && G.S.hero.cls && !(G.R.btnDown > 0) && G.D.heroHp ? clamp(1 - G.S.hero.hp / (G.D.heroHp * 0.3), 0, 1) : 0;
    const doomK = R.boss && R.boss.move && R.boss.move.k === 'doom' ? clamp(1 - R.boss.move.t / R.boss.move.T, 0, 1) : 0;
    const red = Math.min(0.6, hurtFx * 0.6 + lowK * (0.16 + 0.12 * Math.sin(time * 7)) + (G.R.btnDown > 0 ? 0.22 : 0) + (doomK ? (0.12 + 0.3 * doomK) * (0.6 + 0.4 * Math.sin(time * (8 + 10 * doomK))) : 0) + siegeRed());
    setFx(red, flash);
    if (flash > 0) flash = Math.max(0, flash - dt * 1.8);
    // ---- Hi-res layer: text & bars ----
    SEC('parts');
    const k = S * TDPR;
    clearText(); SEC('t-clear');
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(k, 0, 0, k, ox * k, oy * k);
    drawNames(); SEC('t-names');
    drawEventNames();
    drawLabels(); SEC('t-labels');
    drawIncomingNames();
    // the Warlord's name and health over its head
    if (wlMark && G.R.ev && G.R.ev.k === 'warlord') {
      const w = 40, q = wlMark;
      ctx.fillStyle = '#0c0b12'; ctx.fillRect(q.x - w / 2 - 1, q.y - 1, w + 2, 4);
      ctx.fillStyle = '#ff5a2e'; ctx.fillRect(q.x - w / 2, q.y, Math.max(1, w * Math.max(0, q.k)), 2);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = crisp(4) + 'px ' + FONT; ctx.lineWidth = 1.5; ctx.strokeStyle = '#0c0b12';
      ctx.strokeText(G.t('warlordName'), q.x, q.y - 5); ctx.fillStyle = '#ff7a2e'; ctx.fillText(G.t('warlordName'), q.x, q.y - 5);
    }
    wlMark = null;
    SEC('t-misc');
    drawTexts(dt); SEC('t-texts');
    drawJackpotText();
    drawTapHints();
    drawStreak(); SEC('t-streak');
    if (R.rift) { /* the Rift's bar and clock live in the HUD row under the field */ }
    else if (bossVis && R.boss) { drawBossBar(); drawMoveName(); }
    else if (R.bossReady && !R.inv) drawReady(b);
    if (hoverChest) drawChestTip(hoverChest);
    SEC('text');
    if (Q.debug) drawQualityDebug();
    endText();
  };
  function drawQualityDebug() {
    ctx.font = crisp(3) + 'px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.lineWidth = 1; ctx.strokeStyle = '#0c0b12';
    const s = 'Q' + Q.tier + ' ' + Q.fps + 'fps ' + Q.work + 'ms ' + (G.R.mobs ? G.R.mobs.length : 0) + 'm ' + parts.length + 'p ' + texts.length + 't';
    ctx.strokeText(s, 4, H - 10); ctx.fillStyle = '#7fe9ff'; ctx.fillText(s, 4, H - 10);
  }

  function line(x0, y0, x1, y1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, guard = 0;
    while (guard++ < 400) {
      lctx.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  // The five zones of a land: dawn, midday, dusk, night, and the lord's own ground. Each has its
  // own grade of light, its own scatter of the land's decor, and (in drawZoneFx) its own weather.
  const ZONE_LOOK = [
    { grade: '#ffb070', ga: 0.3, mode: 'soft-light', decor: 1, keep: [0, 1, 2, 3] },
    { grade: null, ga: 0, mode: 'source-over', decor: 0.7, keep: [0, 2] },
    { grade: '#ff7a3a', ga: 0.2, mode: 'multiply', decor: 1.3, keep: [1, 3] },
    { grade: '#2a3470', ga: 0.55, mode: 'multiply', decor: 0.9, keep: [0, 1, 2, 3] },
    { grade: '#6a1030', ga: 0.45, mode: 'multiply', decor: 0.55, keep: [2, 3] },
  ];
  function buildGround(realmId, zone) {
    const Z = ZONE_LOOK[zone || 0] || ZONE_LOOK[1];
    const g = SPR.ground(realmId, W, H, 7 + realmId.length * 13 + (zone || 0) * 101);
    const c = SPR.makeCanvas(W, H), x = c.getContext('2d');
    x.drawImage(g, 0, 0);
    // scatter decor away from the centre: each zone keeps its own share of the land's pieces
    const cfg = SPR.REALM_GROUND[realmId];
    const pool = cfg.decor.filter((_, i) => Z.keep.includes(i % 4));
    const decor = pool.length ? pool : cfg.decor;
    const rnd = G.seeded(99 + realmId.length + (zone || 0) * 31);
    const b = btnPos();
    const n = Math.round(W * H / 900 * Z.decor);
    for (let i = 0; i < n; i++) {
      const px = Math.round(rnd() * W), py = Math.round(rnd() * H);
      const dx = (px - b.x) / (W * 0.33), dy = (py - b.y) / (H * 0.36);
      if (dx * dx + dy * dy < 1 || py < 14) continue;
      const spr = SPR.get(decor[Math.floor(rnd() * decor.length)]);
      x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(px - 3, py, 6, 1);
      x.drawImage(spr, Math.round(px - spr.width / 2), py - spr.height + 1);
    }
    // the zone's light
    if (Z.grade) { x.globalCompositeOperation = Z.mode; x.globalAlpha = Z.ga; x.fillStyle = Z.grade; x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; }
    return c;
  }
  // weather and light that move: mist at dawn, leaves at dusk, fireflies and a lit circle at night,
  // embers and a red sky on the lord's ground; and a dip to black between zones
  let zoneFade = 0;
  // 3.4: marching on to the next zone (game.js 'marchStart'): the ground scrolls, dust streams past the party,
  // speed lines at the edges and a chevron trail ahead
  let march = null;
  function marchFx(dt, k) {
    const sp = Math.sin(Math.PI * k), b = btnPos();
    // streaks of dust rushing past (the field moves, the party holds the Button and walks on)
    const n = Math.round(sp * 26 * Math.min(2, dt * 60));
    for (let i = 0; i < n; i++) part(rand(0, W), rand(-10, H * 0.6), pick(['#ffffff', '#e8e0c8', '#c8c0a8']), { vx: 0, vy: rand(260, 420) * sp, grav: 0, life: rand(0.25, 0.5), size: 1 });
    for (let i = 0; i < Math.round(sp * 3); i++) part(b.x + rand(-60, 60), b.y + rand(4, 30), pick(['#c8b89a', '#8a7a60', '#a89878']), { vx: rand(-20, 20), vy: rand(30, 70), grav: 0, life: rand(0.3, 0.6) });
    // chevrons pointing the way, ahead of the Button
    lctx.globalAlpha = 0.55 * sp; lctx.fillStyle = '#ffd84a';
    for (let j = 0; j < 3; j++) {
      const y = ((b.y - 70 - j * 26 - (march.t * 90) % 26) | 0), w = 18 - j * 3;
      for (let t = 0; t < 4; t++) { lctx.fillRect((b.x - w + t * 2) | 0, y + t * 2, 4, 2); lctx.fillRect((b.x + w - 4 - t * 2) | 0, y + t * 2, 4, 2); }
    }
    lctx.globalAlpha = 0.18 * sp; lctx.fillStyle = '#ffffff';
    for (let i = 0; i < 7; i++) { const x = (i < 4 ? i * 9 : W - (i - 3) * 9) | 0, y = ((time * 700 + i * 97) % (H + 80)) - 80; lctx.fillRect(x, y | 0, 2, 60); }
    lctx.globalAlpha = 1;
  }
  St.marching = () => !!march;
  G.on('marchStart', (T, newLand) => { march = { t: 0, T, prev: groundCanvas, land: newLand }; if (newLand && inSiege()) { const ri = G.realmIndex(G.depthNow ? G.depthNow() : G.S.depth); FF.gate = { col: landCol((G.REALMS[ri] || {}).id) }; } St.clearStain(); if (G.Audio && G.Audio.whoosh) G.Audio.whoosh(); if (newLand) setTimeout(prewarmLand, 120); });
  // 3.6: a new land's mob looks (and their gib chunks) are made during the march, not on first sight in the fight
  function prewarmLand() {
    try {
      const ri = G.realmIndex(G.depthNow ? G.depthNow() : G.S.depth), realm = G.REALMS[ri], sk = G.MOB_SKINS && G.MOB_SKINS[ri];
      const ids = [realm.fodder, realm.minion].concat(sk ? sk.fodder.concat(sk.brute) : []);
      if (G.ARCHETYPES) for (const k in G.ARCHETYPES) ids.push('a_' + k + '_' + realm.id);
      for (const id of ids) {
        if (!SPR.defs[id]) continue;
        for (const v of [id, id + '_2']) if (SPR.defs[v]) chunks(SPR.get(v));
        SPR.get(id, OC_MAGIC); SPR.get(id, OC_RARE);
      }
    } catch (e) { /* only a head start */ }
  }
  // a zone's light, painted once per screen size
  const zoneLights = {};
  function zoneLight(k, paint) {
    const key = k + W + 'x' + H;
    let c = zoneLights[k];
    if (!c || c.key !== key) { c = zoneLights[k] = SPR.makeCanvas(W, H); c.key = key; paint(c.getContext('2d')); }
    return c;
  }
  function drawZoneFx(dt) {
    if (G.R.rift) return;
    const z = G.ZONE_LOOK(G.zoneOf(G.depthNow ? G.depthNow() : G.S.depth)), b = btnPos();
    if (z === 0) {
      // low sun from the east: warm light across the field (3.6: painted once per size)
      lctx.drawImage(zoneLight('dawn', x => {
        const lg = x.createLinearGradient(0, 0, W * 0.8, H);
        lg.addColorStop(0, 'rgba(255,196,120,0.26)'); lg.addColorStop(0.55, 'rgba(255,196,120,0.05)'); lg.addColorStop(1, 'rgba(255,196,120,0)');
        x.fillStyle = lg; x.fillRect(0, 0, W, H);
      }), 0, 0);
    }
    if (z === 1) {
      // midday: clouds drift over and drag their shadows across the ground
      lctx.fillStyle = '#000000';
      for (let i = 0; i < 3; i++) {
        const cx = ((time * (6 + i * 2) + i * W * 0.45) % (W + 160)) - 80, cy = H * (0.2 + i * 0.3);
        lctx.globalAlpha = 0.07; lctx.beginPath(); lctx.ellipse(cx | 0, cy | 0, 70 + i * 14, 26 + i * 6, 0, 0, 6.3); lctx.fill();
      }
      lctx.globalAlpha = 1;
    }
    if (z === 0) { lctx.fillStyle = '#ffffff'; for (let i = 0; i < 3; i++) { lctx.globalAlpha = 0.05; const y = (H * (0.3 + i * 0.25) + Math.sin(time * 0.3 + i) * 8) | 0; lctx.fillRect(0, y, W, 6 + i * 3); } lctx.globalAlpha = 1; }
    if (z === 2 && Math.random() < 0.35) part(W + 4, rand(0, H), pick(['#c86a2a', '#e8a040', '#a04a1a']), { vx: -rand(20, 40), vy: rand(4, 12), grav: 0, life: rand(2, 4) });
    if (z === 3) {
      // the night closes in, the Button lights the ground round it
      lctx.drawImage(zoneLight('night', x => {
        const rg = x.createRadialGradient(b.x, b.y, 30, b.x, b.y, Math.max(W, H) * 0.6);
        rg.addColorStop(0, 'rgba(10,12,40,0)'); rg.addColorStop(1, 'rgba(6,8,26,0.5)');
        x.fillStyle = rg; x.fillRect(0, 0, W, H);
      }), 0, 0);
      if (Math.random() < 0.3) part(rand(0, W), rand(20, H), pick(['#d8ff7a', '#fff3a0']), { vx: rand(-4, 4), vy: rand(-4, 4), grav: 0, life: rand(1, 2.5) });
    }
    if (z === 4) {
      lctx.globalAlpha = 0.06 + 0.03 * Math.sin(time * 1.5); lctx.fillStyle = '#ff2a4a'; lctx.fillRect(0, 0, W, H); lctx.globalAlpha = 1;
      if (Math.random() < 0.5) part(rand(0, W), H + 2, pick(['#ff7a2e', '#ff3b3b', '#ffd84a']), { vx: rand(-6, 6), vy: -rand(18, 40), grav: 0, life: rand(1.5, 3) });
    }
    if (zoneFade > 0) { lctx.globalAlpha = Math.min(1, zoneFade); lctx.fillStyle = '#0c0b12'; lctx.fillRect(0, 0, W, H); lctx.globalAlpha = 1; zoneFade = Math.max(0, zoneFade - dt * 1.6); }
  }
  // 3.6: the Shoreline's water: the same waves, painted once per frame of a 64-frame loop (2π s) into a strip
  const WATER_N = 64, WATER_ROWS = 12;
  let waterC = null, waterX = null, waterDone = null, waterW = 0;
  const rgba32 = hex => { const [r, g, b] = G.hexToRgb(hex); return (255 << 24) | (b << 16) | (g << 8) | r; };
  function drawWater() {
    const cfg = SPR.REALM_GROUND.shore, rows = WATER_ROWS;
    if (!waterC || waterW !== W) { waterW = W; waterC = SPR.makeCanvas(W, rows * WATER_N); waterX = waterC.getContext('2d', { willReadFrequently: true }); waterDone = new Uint8Array(WATER_N); }
    const fi = Math.floor(((time % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI * 2) * WATER_N) % WATER_N;
    if (!waterDone[fi]) {
      waterDone[fi] = 1;
      const t = fi / WATER_N * Math.PI * 2, img = waterX.createImageData(W, rows), px = new Uint32Array(img.data.buffer);
      const c0 = rgba32(cfg.water[0]), c1 = rgba32(cfg.water[1]), c2 = rgba32(cfg.water[2]), foam = rgba32('#e8f4ff');
      for (let y = 0; y < rows; y++) for (let x = 0; x < W; x++) {
        const wave = Math.sin(x * 0.3 + t * 2 + y * 0.8);
        const edge = rows - 2 + Math.round(Math.sin(x * 0.15 + t) * 1.5);
        if (y > edge) continue;
        let col = c0;
        if (wave > 0.7) col = c1;
        if (wave > 0.95 && (x + y) % 3 === 0) col = c2;
        if (y === edge) col = foam;
        px[y * W + x] = col;
      }
      waterX.putImageData(img, 0, fi * rows);
    }
    lctx.drawImage(waterC, 0, fi * rows, W, rows, 0, 0, W, rows);
  }

  // PoE-style drop: a thud of dust, a beam for the good stuff, a name tag
  function landed(c, v) {
    burst(v.x, v.y - 1, ['#c8b89a', '#8a7a60'], 5, 30, { grav: 60, life: 0.35 });
    v.hit = 0.08;
    if (c.tier >= 3) beams.push({ x: v.x, y: v.y, col: rarityCol(c.tier), life: 1.4 + c.tier * 0.2, max: 1.4 + c.tier * 0.2, w: c.tier >= 5 ? 7 : 5 });
    if (c.tier >= 2 || c.mod) text(v.x, v.y - 16, G.L(G.RARITIES[c.tier].name) + (c.mod ? ' · ' + G.L(G.MOD_BY_ID[c.mod].name) : ''), c.mod ? G.MOD_BY_ID[c.mod].color : rarityCol(c.tier), 3, { vy: -6, life: 1.6, max: 1.6 });
    if (c.tier >= 5) { St.shake(3); St.flash(0.2, rarityCol(c.tier)); }
    if (G.Audio && G.Audio.drop) G.Audio.drop(c.tier);
  }
  // ---------- The Looters ----------
  const lootVis = [];
  function stepLooters(dt, list) {
    const R = G.R, L = R.looters || [];
    lootVis.length = Math.min(lootVis.length, L.length);
    const b = btnPos();
    L.forEach((l, i) => {
      const home = { x: b.x + 22 + (i % 3) * 9, y: b.y + 22 + Math.floor(i / 3) * 7 };
      let v = lootVis[i];
      if (!v) v = lootVis[i] = { x: home.x, y: home.y, face: 1, walk: 0, lift: 0 };
      const cv = l.tgt != null ? vis.get(l.tgt) : null;
      const tgt = cv && !cv.arc ? { x: cv.x - 5, y: cv.y + 1 } : home;
      const dx = tgt.x - v.x, dy = tgt.y - v.y, d = Math.hypot(dx, dy);
      // it arrives just as its time is up, however far the chest is
      const left = cv ? Math.max(0.08, (G.D.autoOpen || 1) - l.acc) : 0.6;
      const sp = Math.min(400, Math.max(28, d / left));
      if (d > 0.5) { const k = Math.min(1, sp * dt / d); v.x += dx * k; v.y += dy * k; v.face = dx >= 0 ? 1 : -1; v.walk += dt * (6 + sp / 12); }
      if (v.lift > 0) v.lift -= dt;
      const moving = d > 1.5;
      list.push({ y: v.y, draw: () => drawLooter(v, moving) });
    });
  }
  function drawLooter(v, moving) {
    const id = v.lift > 0 ? 'looter_2' : moving ? 'looter_' + (Math.floor(v.walk) % 2) : 'looter_0';
    const spr = SPR.defs[id] ? SPR.get(id) : SPR.get('ic_key');
    const x = Math.round(v.x), y = Math.round(v.y) - (moving && Math.floor(v.walk * 2) % 2 ? 1 : 0);
    shadow(x, y - 1, 7);
    if (v.face < 0) { lctx.save(); lctx.translate(x, 0); lctx.scale(-1, 1); blit(spr, 0, y); lctx.restore(); } else blit(spr, x, y);
    if (moving && Math.random() < 0.2) part(x - v.face * 3, y - 1, '#c8b89a', { vx: -v.face * 10, vy: -6, grav: 20, life: 0.25 });
  }
  function drawChest(c, v) {
    const dropY = v.drop > 0 ? -Math.round(v.drop * v.drop * 30) : 0;
    let x = v.x, y = v.y + dropY;
    if (v.arc) { // still flying out of the mob
      const a = v.arc, k = Math.min(1, a.t / a.dur);
      x = Math.round(a.sx + (v.x - a.sx) * k);
      y = Math.round(a.sy + (v.y - a.sy) * k - Math.sin(k * Math.PI) * 18);
      blit(chestSpr(c, v), x, y);
      if (c.tier >= 3 && Math.random() < 0.6) part(x + rand(-2, 2), y - 4, rarityCol(c.tier), { vx: 0, vy: 0, grav: 0, life: 0.3 });
      return;
    }
    let sc = 1;
    if (v.hit > 0) x += Math.round(rand(-1, 1));
    const mod = c.mod, mini = miniChest(v, c), crowd = G.S.chests.length > 40;
    shadow(v.x, v.y - 1, mini ? 7 : 12);
    // tier glow (in a crowd only the good ones glow)
    if ((c.tier >= 3 || mod) && (!crowd || c.tier >= 4 || mod)) {
      const col = mod ? G.MOD_BY_ID[mod].color : rarityCol(c.tier);
      glow(x, y - 3, mini ? 5 : 7, col, (mod ? 0.22 : 0.16) + 0.08 * Math.sin(time * 4 + c.id));
    }
    if (c.tier === 6 && Math.random() < 0.15) part(x + rand(-6, 6), y - rand(4, 12), '#ffffff', { vy: -15, vx: 0, grav: 0, life: 0.6 });
    let spr = chestSpr(c, v);
    let alpha;
    if (mod === 'ghost') { alpha = 0.55 + 0.15 * Math.sin(time * 3 + c.id); y -= 2 + Math.round(Math.sin(time * 2 + c.id) * 1.5); if (Math.random() < 0.08) part(x + rand(-5, 5), y - 3, '#ffffff', { vy: -8, vx: 0, grav: 0, life: 0.7 }); }
    if (mod === 'mimic' && c.awake) { spr = SPR.get('mimic'); x += Math.round(Math.sin(time * 30) * 1); }
    if (mod === 'mimic' && !c.awake && Math.sin(time * 1.3 + c.id) > 0.985) spr = SPR.get('mimic');
    if (v.pop > 0) sc = 1;
    blit(spr, x, y, sc, alpha);
    if (v.hit > 0) blit(white(spr), x, y, 1, v.hit * 4);
    // modifier overlays
    if (mod === 'golden' && Math.random() < 0.2) part(x + rand(-6, 6), y - rand(2, 10), pick(['#ffd84a', '#fff3a0']), { vy: -12, vx: 0, grav: 0, life: 0.5 });
    if (mod === 'chromatic') {
      const hue = (time * 200 + c.id * 40) % 360;
      lctx.fillStyle = 'hsl(' + hue + ',90%,65%)';
      const a = time * 3 + c.id;
      for (let i = 0; i < 3; i++) lctx.fillRect(Math.round(x + Math.cos(a + i * 2.1) * 9), Math.round(y - 6 + Math.sin(a + i * 2.1) * 5), 1, 1);
    }
    if (mod === 'lightning' && Math.random() < 0.06) { lctx.fillStyle = '#7fe9ff'; line(x - 4, y - 14, x + 1, y - 9); line(x + 1, y - 9, x - 2, y - 6); }
    if (mod === 'lightning') { lctx.drawImage(SPR.get('ic_bolt'), Math.round(x + 3), Math.round(y - 20)); }
    if (mod === 'void' && Math.random() < 0.3) { const a = Math.random() * 6.28; part(x + Math.cos(a) * 10, y - 5 + Math.sin(a) * 6, pick(['#8a4dff', '#3a2266']), { vx: -Math.cos(a) * 20, vy: -Math.sin(a) * 12, grav: 0, life: 0.5 }); }
    if (mod === 'blazing') {
      if (Math.random() < 0.6) part(x + rand(-6, 6), y - rand(2, 8), pick(['#ff7a2e', '#ffd84a', '#ff4040']), { vy: -30, vx: rand(-5, 5), grav: -10, life: 0.4 });
      const k = clamp(c.life / G.TUNE.blazeLife, 0, 1);
      lctx.fillStyle = '#0c0b12'; lctx.fillRect(x - 7, y + 1, 14, 2);
      lctx.fillStyle = k > 0.4 ? '#ffb347' : '#ff4040'; lctx.fillRect(x - 6, y + 1, Math.round(12 * k), 1);
    }
    if (mod === 'frozen') {
      lctx.globalAlpha = 0.55;
      lctx.fillStyle = '#bfe8ff'; lctx.fillRect(x - 8, y - 13, 16, 13);
      lctx.globalAlpha = 0.9;
      lctx.fillStyle = '#ffffff'; lctx.fillRect(x - 7, y - 12, 5, 1); lctx.fillRect(x - 7, y - 11, 1, 3);
      lctx.fillStyle = '#7fc4ff';
      const cracks = 8 - c.hp;
      for (let i = 0; i < cracks; i++) { lctx.fillRect(x - 6 + ((i * 5) % 12), y - 11 + ((i * 3) % 9), 2, 1); }
      lctx.globalAlpha = 1;
    }
    if (mod === 'mimic' && c.awake) {
      const k = c.hp / G.TUNE.mimicClicks;
      lctx.fillStyle = '#0c0b12'; lctx.fillRect(x - 7, y - 17, 14, 3);
      lctx.fillStyle = '#ff4f4f'; lctx.fillRect(x - 6, y - 16, Math.max(0, Math.round(12 * k)), 1);
    }
    if (hoverChest === c) { lctx.globalAlpha = 0.25; blit(white(spr), x, y); lctx.globalAlpha = 1; }
  }

  function drawButton(b) {
    if (G.S.fallen) { drawCrater(b); return; }
    if (fallT >= 0) fallT = -1;
    if (G.odActive && G.odActive()) {
      // the field goes electric blue, and arcs crawl out of the Button every frame
      lctx.globalAlpha = 0.08 + 0.04 * Math.sin(time * 20); lctx.fillStyle = '#7fe9ff'; lctx.fillRect(0, 0, W, H); lctx.globalAlpha = 1;
      if (Math.random() < 0.5) { const an = Math.random() * Math.PI * 2, r = rand(40, 110), pts = [[b.x, b.y - 14]]; for (let j = 1; j < 5; j++) pts.push([b.x + Math.cos(an) * r * j / 5 + rand(-6, 6), b.y - 14 + Math.sin(an) * r * 0.55 * j / 5 + rand(-6, 6)]); bolts.push({ pts, life: 0.1, cols: ['#ffffff', '#7fe9ff'] }); }
      glow(b.x, b.y - 8, 34 + 6 * Math.sin(time * 18), '#7fe9ff', 0.35 + 0.15 * Math.sin(time * 25)); if (Math.random() < 0.6) part(b.x + rand(-22, 22), b.y - rand(0, 20), pick(['#ffffff', '#7fe9ff']), { vx: rand(-30, 30), vy: -rand(20, 60), grav: 0, life: 0.3 }); }
    else if (G.odReady && G.odReady()) glow(b.x, b.y - 8, 22, '#7fe9ff', 0.12 + 0.08 * Math.sin(time * 6));
    // 4.0: the Button's look: the run's Button (its evolution), the store's finish (js/sprites.js SPR.buttonLook)
    const lk = btnLookNow(), skin = { id: lk.id };
    const evoK = drawEvoUnder(b, fdt);
    const pressed = btnPress > 0;
    if (btnPress > 0) btnPress -= fdt;
    const combo = G.R.combo, cap = G.D.comboCap || 50;
    if (combo > 10 && Math.random() < 0.25 + 0.5 * combo / cap) {
      const a = Math.random() * 6.28;
      part(b.x + Math.cos(a) * 16, b.y - 6 + Math.sin(a) * 6, combo >= cap ? pick(['#ff7ae6', '#ffffff']) : pick(['#ffd84a', '#fff3a0']), { vx: 0, vy: -rand(15, 35), grav: 0, life: 0.5 });
    }
    shadow(b.x, b.y + 1, 36);
    const spr = btnSprite(lk, pressed);
    btnSpring.v += (1 - btnSpring.s) * 0.35; btnSpring.v *= 0.7; btnSpring.s += btnSpring.v;
    const sy = clamp(btnSpring.s, 0.8, 1.15), sx = 1 + (1 - sy) * 0.9;
    const bw = Math.round(spr.width * sx), bh = Math.round(spr.height * sy);
    lctx.drawImage(spr, Math.round(b.x - bw / 2), Math.round(b.y + 4 - bh), bw, bh);
    if (evoK > 0) { lctx.globalAlpha = Math.min(0.85, evoK * evoK); lctx.drawImage(white(spr), Math.round(b.x - bw / 2), Math.round(b.y + 4 - bh), bw, bh); lctx.globalAlpha = 1; }
    if (btnFlashT > 0) { lctx.globalAlpha = Math.min(0.7, btnFlashT * 9); lctx.drawImage(white(spr), Math.round(b.x - bw / 2), Math.round(b.y + 4 - bh), bw, bh); lctx.globalAlpha = 1; btnFlashT -= fdt; }
    if (btnHurtT > 0) { blit(white(spr), b.x, b.y + 4, 1, btnHurtT * 3); btnHurtT -= fdt; }
    if (G.R.btnDown > 0) {
      // broken: dark, cracked, smoking, and a countdown until it mends
      lctx.globalAlpha = 0.8; blit(SPR.button('#3a3348', true, 0), b.x, b.y + 4); lctx.globalAlpha = 1;
      lctx.fillStyle = '#0c0b12';
      for (const [x0, y0, x1, y1] of [[-8, -12, -2, -4], [-2, -4, -5, 2], [3, -13, 7, -6], [7, -6, 4, 0]]) { lctx.fillRect(b.x + x0, b.y + y0, Math.max(1, Math.abs(x1 - x0)), 1); lctx.fillRect(b.x + x1, b.y + Math.min(y0, y1), 1, Math.abs(y1 - y0)); }
      if (Math.random() < 0.4) part(b.x + rand(-10, 10), b.y - rand(4, 12), pick(['#6e6e7c', '#3a3a44', '#ff7a2e']), { vx: rand(-5, 5), vy: -rand(15, 30), grav: -10, life: 0.8 });
    }
    if (G.R.stun > 0) {
      lctx.globalAlpha = 0.45; blit(SPR.button('#3a3348', true, 0), b.x, b.y + 4); lctx.globalAlpha = 1;
      if (Math.random() < 0.5) part(b.x + rand(-14, 14), b.y - rand(0, 12), pick(['#7fe9ff', '#ffffff']), { vx: rand(-30, 30), vy: rand(-40, -10), life: 0.3 });
    }
    const h = G.S.hero;
    if (h && h.cls && G.D.heroHp) {
      const k = clamp(h.hp / G.D.heroHp, 0, 1), w = 30;
      lctx.fillStyle = '#0c0b12'; lctx.fillRect(b.x - w / 2 - 1, b.y + 7, w + 2, 4);
      lctx.fillStyle = '#3a1a1e'; lctx.fillRect(b.x - w / 2, b.y + 8, w, 2);
      lctx.fillStyle = k > 0.35 ? '#56d45a' : '#e84a4a'; lctx.fillRect(b.x - w / 2, b.y + 8, Math.round(w * k), 2);
    }
    if ((G.S.upg.prince || 0) > 0) blit(SPR.get('crown_small'), b.x, b.y - 22 + (pressed ? 3 : 0) + Math.round(Math.sin(time * 2)));
    siegeOnButton(b, lk);
    if (skin.id === 'divine' && Math.random() < 0.2) part(b.x + rand(-14, 14), b.y - rand(8, 20), '#ffffff', { vy: -10, vx: 0, grav: 0, life: 0.6 });
    if (skin.id === 'gold' && Math.random() < 0.12) part(b.x + rand(-14, 14), b.y - rand(8, 20), '#fff3a0', { vy: -10, vx: 0, grav: 0, life: 0.6 });
  }

  function drawBossMove(bp) {
    const b = G.R.boss, sp = bossVis.sprite, sc = bossScale(), h = sp.canvas.height * sc;
    // the Shielded affix: a standing barrier until Smite or a broken wind-up cracks it
    if (G.bossHas(b, 'shielded') && !(b.sh > 0)) {
      const rx = Math.round(sp.canvas.width * sc * 0.62), ry = Math.round(h * 0.58), cy = Math.round(bp.y - h / 2);
      lctx.globalAlpha = 0.5 + 0.15 * Math.sin(time * 4); lctx.strokeStyle = '#7ad0ff'; lctx.lineWidth = 1;
      lctx.beginPath(); lctx.ellipse(bp.x, cy, rx, ry, 0, 0, 6.3); lctx.stroke();
      lctx.globalAlpha = 0.1; lctx.fillStyle = '#7ad0ff'; lctx.beginPath(); lctx.ellipse(bp.x, cy, rx, ry, 0, 0, 6.3); lctx.fill(); lctx.globalAlpha = 1;
    }
    if (b.move) {
      const M = G.BOSS_MOVES[b.move.k], k = clamp(b.move.t / b.move.T, 0, 1);
      if (b.move.k === 'shield') {
        lctx.globalAlpha = 0.18 + 0.08 * Math.sin(time * 10); lctx.fillStyle = M.col;
        const rx = sp.canvas.width * sc * 0.65, ry = h * 0.6;
        for (let dy = -ry; dy <= ry; dy++) { const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / ry) * (dy / ry)))); lctx.fillRect(Math.round(bp.x - w), Math.round(bp.y - h / 2 + dy), w * 2, 1); }
        lctx.globalAlpha = 1;
      } else if (Math.floor(time * 12) % 2) glow(bp.x, bp.y - h / 2, Math.round(sp.canvas.width * sc / 2), M.col, 0.25);
      // wind-up bar and taps left
      const w = 30, y = Math.round(bp.y - h - 10);
      lctx.fillStyle = '#0c0b12'; lctx.fillRect(bp.x - w / 2 - 1, y - 1, w + 2, 4);
      lctx.fillStyle = M.col; lctx.fillRect(bp.x - w / 2, y, Math.round(w * k), 2);
      for (let i = 0; i < b.move.need; i++) { lctx.fillStyle = i < b.move.n ? '#ffffff' : '#3a3a44'; lctx.fillRect(Math.round(bp.x - b.move.need * 2 + i * 4), y + 4, 3, 2); }
      // the weak point: a pulsing target beside the boss, the only thing that breaks the move
      const wp = weakPos();
      if (wp) {
        // (a DOOM's weak point is twice the size, with a ring that closes in as the time runs out)
        const dm = b.move.k === 'doom', pr = (6 + Math.sin(time * 14) * 1.5) * (dm ? 1.8 : 1);
        if (dm) { lctx.globalAlpha = 0.5; lctx.strokeStyle = M.col; lctx.lineWidth = 1; lctx.beginPath(); lctx.arc(wp.x, wp.y, pr + 4 + 14 * (1 - k), 0, 6.3); lctx.stroke(); lctx.globalAlpha = 1; }
        lctx.lineWidth = 2; lctx.strokeStyle = '#0c0b12'; lctx.beginPath(); lctx.arc(wp.x, wp.y, pr + 1, 0, 6.3); lctx.stroke();
        lctx.lineWidth = 1; lctx.strokeStyle = Math.floor(time * 10) % 2 ? '#ffffff' : M.col; lctx.beginPath(); lctx.arc(wp.x, wp.y, pr, 0, 6.3); lctx.stroke();
        lctx.fillStyle = M.col; lctx.fillRect(Math.round(wp.x) - 1, Math.round(wp.y) - 1, 3, 3);
        lctx.fillStyle = '#ffffff'; for (const [dx, dy] of [[-pr - 3, 0], [pr + 1, 0], [0, -pr - 3], [0, pr + 1]]) lctx.fillRect(Math.round(wp.x + dx), Math.round(wp.y + dy), dx ? 2 : 1, dy ? 2 : 1);
      }
    }
    if (b.enr > 0) { if (Math.random() < 0.6) part(bp.x + rand(-14, 14), bp.y - rand(0, h), pick(['#ff3b3b', '#ff7a2e', '#ffd84a']), { vx: rand(-10, 10), vy: -rand(20, 50), grav: 0, life: 0.6 }); glow(bp.x, bp.y - h / 2, Math.round(sp.canvas.width * sc / 2) + 4, '#ff2a2a', 0.18 + 0.1 * Math.sin(time * 12)); }
    if (b.stagger > 0 && Math.random() < 0.5) part(bp.x + rand(-12, 12), bp.y - h - rand(0, 6), pick(['#ffe27a', '#ffffff']), { vx: rand(-20, 20), vy: -10, grav: 0, life: 0.4 });
  }
  function drawBoss(bp) {
    const sp = bossVis.sprite, sc = bossScale();
    const bob = Math.round(Math.sin(bossVis.t * 3) * 1.5);
    const enterY = Math.round(-bossVis.enter * bossVis.enter * 60);
    shadow(bp.x, bp.y + 1, Math.round(sp.canvas.width * sc * 0.7));
    if (bossVis.lord) glow(bp.x, bp.y - sp.canvas.height * sc / 2, Math.round(sp.canvas.width * sc / 3), '#ff4f7e', 0.12 + 0.06 * Math.sin(time * 5));
    const x = bp.x + (bossHitT > 0 ? Math.round(rand(-1, 1)) : 0), y = bp.y + bob + enterY;
    if (bossVis.final) drawMadUnder(bp, sp.canvas, sc);
    blit(sp.canvas, x, y, sc);
    if (bossVis.final) drawMadOver(sp.canvas, x, y, sc);
    if (bossHitT > 0) { blit(white(sp.canvas), x, y, sc, Math.min(0.45, bossHitT * 6)); bossHitT -= fdt; }
    if (sp.crown) blit(SPR.get('crown_small'), x, y - sp.canvas.height * sc + 2, 1);
    if (G.R.boss) drawBossMove(bp);
  }

  // ======================================================================================================================
  // ---------- 4.0 "The Siege" on the field (the fieldfx stream) ----------
  // The loot moment (the boss's loot bursts toward the camera and the field dims; an ultra-rare's 1.2-s slow-motion
  // rainbow pillar with a screen-wide shimmer; rainbow beams on ultra-rares on the ground, ▲/▼ on the labels), the
  // Integrity pips cracking the Button (and mending it), the shrine's charge ring (the Hand held on it for 2 s), Pacts, the
  // Golden Click (a little golden Button), the door march and the land's title, the Last Stand (a red sky, packs
  // telegraphed at the edges, a drum: js/audio.js), the Mad Button, the camp's fire, the Buttons' looks and their
  // evolution, the store's looks (G.cosmetic: skin / trail / beam) and the Marks' blows (js/powers.js pw* events).
  // Everything here is drawn on the stage's own pixel layer with the 3.6 budgets (particles through newPart, rings capped).
  const inSiege = () => !!(G.inSiege && G.inSiege());
  const runP = () => { const r = G.S.run; return r && r.on ? r.phase : null; };
  const RBW = ['#ff4f4f', '#ffa033', '#ffd84a', '#56d45a', '#4fd0ff', '#5a7bff', '#b36bff', '#ff6ad8'];
  const rbw = i => RBW[((i % 8) + 8) % 8];
  // an ultra-rare (mythic, divine, unique, relic: ADDENDUM 1) on the ground or in a loot card
  const ultraG = g => !!(g && (g.q || g.relic || (g.r | 0) >= 5));
  const ultraE = e => !!(e && (e.k === 'uq' || (e.k === 'gear' && e.r >= 5) || ultraG(e.g)));
  const FF = { loot: null, dim: 0, pillars: [], shimmer: [], edges: [], lsK: 0, madK: 0, campK: 0, cracks: 0, crackT: 9, heal: null,
    pipFx: null, charge: null, pact: null, evo: null, door: null, gate: null, light: false, trailT: 0, edgeT: 0, lsFlashT: 0 };
  St.ff = FF; // (tests read it)
  // the store sells looks only when the stage draws them (js/store.js reads this flag)
  St.cosmetics = true;
  const cosm = k => { try { return G.cosmetic ? G.cosmetic(k) : null; } catch (e) { return null; } };
  if (G.tAdd) G.tAdd({
    ff_pipLost: 'INTEGRITY −1', ff_pipLast: 'LAST PIP', ff_pipLastSub: 'The next hit is the fall', ff_pipGain: 'INTEGRITY +1',
    ff_muster: 'The muster: no pip lost', ff_hold: 'HOLD', ff_landN: 'LAND {0} · {1}', ff_act: 'ACT {0}', ff_actFinal: 'THE FINALE',
    ff_twist: 'Twist: {0}', ff_prize: 'Prize: {0}', ff_cursed: 'CURSED ×2', ff_vault: 'THE VAULT', ff_ls: 'LAST STAND',
    ff_lsSub: 'Hold {0} s: the whole Horde, from every side', ff_lsHeld: 'THE HORDE HELD', ff_pact: 'PACT SEALED', ff_pactDone: 'PACT FULFILLED',
    ff_golden: 'GOLDEN CLICK', ff_camp: 'CAMP', ff_reap: 'REAP', ff_phoenix: 'PHOENIX', ff_echo: 'ECHO', ff_break: 'ARMOUR BROKEN', ff_engine: 'ENGINE +{0}%',
    ff_loot: 'LOOT!', ff_lootBig: 'HOLY LOOT!',
  });
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];

  // ---------- the loot moment: the boss's loot bursts toward the camera, the field dims ----------
  G.on('lootMoment', L => {
    const cards = (L && L.cards) || [], b = btnPos(), o = { x: b.x, y: b.y - 14 };
    let best = 0, ultra = 0;
    const list = cards.map((c, i) => {
      const g = c && c.g, r = g ? (g.q ? 7 : g.relic ? 8 : g.r | 0) : 0, u = ultraG(g);
      best = Math.max(best, r); if (u) ultra++;
      return { i, r, u, col: g && g.q ? '#e8903a' : g && g.relic ? '#ffffff' : G.RARITIES[Math.min(6, r)].color };
    });
    FF.loot = { t: 0, best, ultra, cards: list, o, n: list.length };
    const cols = list.map(c => c.col).concat(['#ffffff', '#ffd84a']);
    burst(o.x, o.y, cols, Math.round(40 + 10 * Math.min(best, 7)), 110 + best * 14, { life: 0.9 });
    ring(o.x, o.y + 6, 46 + best * 8, 26 + best * 4, best >= 4 ? '#ffd84a' : '#ffffff', 0.6);
    ring(o.x, o.y + 6, 24, 12, '#ffffff', 0.3);
    // great loot is felt: a gold flash, a kick, a held frame, the word on the field
    if (best >= 4) {
      St.flash(0.22 + 0.05 * Math.min(4, best - 4), best >= 7 ? '#ffe0a0' : '#ffd84a'); St.shake(3 + Math.min(5, best - 4)); hitstop = Math.max(hitstop, 0.07);
      text(o.x, o.y - 26, G.t(best >= 5 ? 'ff_lootBig' : 'ff_loot'), best >= 5 ? '#ff6ad8' : '#ffd84a', best >= 5 ? 9 : 7, { life: 1.4, max: 1.4, vy: -10, big: true, pop: 0.25 });
    }
  });
  function drawLootMoment(dt) {
    const L = FF.loot, on = runP() === 'loot';
    FF.dim += ((on ? 0.42 : 0) - FF.dim) * Math.min(1, dt * (on ? 5 : 3));
    if (FF.dim > 0.01) { lctx.globalAlpha = FF.dim; lctx.fillStyle = '#06040c'; lctx.fillRect(0, 0, W, H); lctx.globalAlpha = 1; }
    if (!L) return;
    L.t += dt;
    if (!on && L.t > 1.6) { FF.loot = null; return; }
    const o = L.o, best = L.best;
    // the spot it all came from keeps a light while the moment lasts; god rays turn behind it for legendary and up
    if (on || L.t < 1.2) {
      const fade = on ? Math.min(1, L.t * 3) : Math.max(0, 1 - (L.t - 1.2) * 2);
      const col = best >= 7 ? '#ffd28a' : best >= 4 ? G.RARITIES[Math.min(6, best)].color : '#ffffff';
      if (best >= 4 && Q.glows) {
        lctx.globalAlpha = 0.1 * fade; lctx.fillStyle = best >= 5 ? rbw(Math.floor(time * 4)) : col;
        const n = 9, r = Math.max(W, H);
        for (let j = 0; j < n; j++) {
          const a = time * 0.6 + j / n * Math.PI * 2;
          lctx.beginPath(); lctx.moveTo(o.x, o.y);
          lctx.lineTo(o.x + Math.cos(a - 0.08) * r, o.y + Math.sin(a - 0.08) * r); lctx.lineTo(o.x + Math.cos(a + 0.08) * r, o.y + Math.sin(a + 0.08) * r);
          lctx.fill();
        }
        lctx.globalAlpha = 1;
      }
      glow(o.x, o.y + 2, 10 + Math.min(8, best * 1.5), col, (0.25 + 0.08 * Math.sin(time * 6)) * fade);
    }
    // the cards themselves fly out of the boss toward the screen (growing, spinning), where the loot screen deals them
    const n = L.n;
    if (L.t < 1.05) for (const c of L.cards) {
      const k = clamp((L.t - c.i * 0.05) / 0.9, 0, 1); if (k <= 0) continue;
      const e = 1 - (1 - k) * (1 - k), tx = W / 2 + (c.i - (n - 1) / 2) * Math.min(W * 0.17, 46), ty = H * 0.3;
      const x = o.x + (tx - o.x) * e, y = o.y + (ty - o.y) * e - Math.sin(k * Math.PI) * 26;
      const s = 1 + 2.6 * e, fl = Math.abs(Math.cos(L.t * 11 + c.i * 1.3)), w = Math.max(1, Math.round(6 * s * fl)), h = Math.round(8 * s);
      const a = k > 0.75 ? (1 - k) / 0.25 : 1;
      lctx.globalAlpha = a;
      lctx.fillStyle = '#0c0b12'; lctx.fillRect(Math.round(x - w / 2) - 1, Math.round(y - h / 2) - 1, w + 2, h + 2);
      lctx.fillStyle = c.u ? rbw(Math.floor(time * 14) + c.i) : c.col; lctx.fillRect(Math.round(x - w / 2), Math.round(y - h / 2), w, h);
      if (w > 4) { lctx.fillStyle = '#2a2236'; lctx.fillRect(Math.round(x - w / 2) + 1, Math.round(y - h / 2) + 1, w - 2, h - 2); lctx.fillStyle = c.u ? '#ffffff' : c.col; lctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2); }
      lctx.globalAlpha = 1;
      if (k < 0.9 && Math.random() < 0.6) part(x + rand(-2, 2), y + rand(-2, 2), c.u ? rbw(Math.floor(Math.random() * 8)) : c.col, { vx: rand(-10, 10), vy: rand(-10, 10), grav: 0, life: 0.35 });
    }
  }

  // ---------- an ultra-rare's flip: a 1.2-s slow-motion rainbow pillar where the boss fell, hitstop, sparks, a shimmer ----------
  const PILLAR_COL = { mythic: '#ff4f7e', divine: '#ffffff', unique: '#e8903a', relic: '#ffffff' };
  function lootPillar(tier) {
    tier = tier || 'mythic';
    const b = btnPos();
    FF.pillars.push({ t: 0, T: tier === 'relic' ? 2.4 : 1.7, tier, x: b.x, y: b.y + 2 });
    if (FF.pillars.length > 3) FF.pillars.shift();
    slowmo = Math.max(slowmo, 1.2); hitstop = Math.max(hitstop, 0.14);
    if (Q.tier < 3) FF.shimmer.push({ t: 0, T: tier === 'relic' ? 1.6 : 1.1 });
    for (let i = 0; i < 3; i++) ring(b.x, b.y - 2, 60 + i * 34, 32 + i * 18, rbw(i * 3 + 1), 0.6 + i * 0.2);
    burst(b.x, b.y - 10, RBW.concat(['#ffffff']), Math.round(90 * Math.max(0.5, Q.particles)), 190, { life: 1.1 });
    St.shake(8); St.flash(0.35, PILLAR_COL[tier] || '#ffffff');
  }
  St.lootPillar = lootPillar;
  G.on('lootUltra', (c, tier) => lootPillar(tier));
  function drawPillars(dt) {
    for (let i = FF.pillars.length - 1; i >= 0; i--) {
      const p = FF.pillars[i];
      p.t += dt;
      if (p.t >= p.T) { FF.pillars.splice(i, 1); continue; }
      const k = p.t / p.T, wk = k < 0.08 ? k / 0.08 : k > 0.7 ? (1 - k) / 0.3 : 1;
      const w = Math.max(1, Math.round((8 + Math.min(26, W * 0.05)) * wk)), y = p.y, x0 = p.x;
      const edge = PILLAR_COL[p.tier] || '#ffffff';
      // a halo in the tier's colour, the rainbow body column by column (the bands climb), a white core
      lctx.globalAlpha = 0.18 * wk; lctx.fillStyle = edge; lctx.fillRect(x0 - w - 6, 0, w * 2 + 12, y);
      const sh = Math.floor(time * 24);
      for (let dx = -w; dx <= w; dx++) {
        const f = 1 - Math.abs(dx) / (w + 1);
        lctx.globalAlpha = (0.28 + 0.5 * f) * wk; lctx.fillStyle = rbw(Math.floor((dx + w) / 3) + sh);
        lctx.fillRect(x0 + dx, 0, 1, y);
      }
      lctx.globalAlpha = 0.9 * wk; lctx.fillStyle = '#ffffff'; lctx.fillRect(x0 - 1, 0, 3, y);
      lctx.globalAlpha = 0.35 * wk;
      for (let j = 0; j < 6; j++) { const by = Math.round(y - ((time * 150 + j * 37) % (y + 30))); lctx.fillRect(x0 - w, by, w * 2 + 1, 2); }
      lctx.globalAlpha = 1;
      glow(x0, y - 2, 12 + Math.round(10 * wk), '#ffffff', 0.5 * wk);
      // sparks rising up the pillar
      const ns = Math.round(4 * wk);
      for (let j = 0; j < ns; j++) part(x0 + rand(-w - 4, w + 4), y - rand(0, y), rbw(Math.floor(Math.random() * 8)), { vx: rand(-14, 14), vy: -rand(60, 150), grav: -20, life: rand(0.4, 0.9) });
    }
    // the shimmer: a rainbow band sweeps across the whole field
    for (let i = FF.shimmer.length - 1; i >= 0; i--) {
      const s = FF.shimmer[i];
      s.t += dt;
      if (s.t >= s.T) { FF.shimmer.splice(i, 1); continue; }
      const k = s.t / s.T, a = 0.2 * (1 - Math.abs(2 * k - 1)), x = -80 + (W + 160) * k;
      for (let yy = 0; yy < H; yy += 3) { lctx.globalAlpha = a; lctx.fillStyle = rbw(Math.floor(yy / 10 + time * 12)); lctx.fillRect(Math.round(x + yy * 0.45 - 30), yy, 28, 3); }
      lctx.globalAlpha = a * 0.5; lctx.fillStyle = '#ffffff';
      for (let yy = 0; yy < H; yy += 3) lctx.fillRect(Math.round(x + yy * 0.45 - 4), yy, 4, 3);
      lctx.globalAlpha = 1;
    }
  }

  // ---------- Integrity: a pip cracks the Button (and the crack stays), a pip back mends it with a sparkle ----------
  const CRACKS = [
    [[-7, -16], [-4, -11], [-6, -7], [-3, -3], [-4, 1]],
    [[6, -15], [8, -10], [5, -6], [8, -2]],
    [[0, -17], [1, -13], [-1, -10], [2, -6], [0, -2], [1, 2]],
  ];
  G.on('pip', (dl, n, why, kind) => {
    const b = btnPos();
    if (kind === 'lost' || kind === 'last') {
      FF.pipFx = { t: 0, kind }; FF.crackT = 0;
      burst(b.x, b.y - 12, ['#ffffff', '#e8f4ff', '#ff4f4f', '#c8c8d4'], Math.round(36 * Math.max(0.5, Q.particles)), 120, { life: 0.7, grav: 160 });
      ring(b.x, b.y - 6, 50, 28, '#ff3b3b', 0.5); ring(b.x, b.y - 6, 30, 16, '#ffffff', 0.3);
      St.flash(kind === 'last' ? 0.55 : 0.4, '#ff2a3a'); St.shake(kind === 'last' ? 10 : 6); hitstop = Math.max(hitstop, 0.1);
      cardText(0, G.t(kind === 'last' ? 'ff_pipLast' : 'ff_pipLost'), '#ff4f4f', kind === 'last' ? 8 : 7, { life: 2.2, vy: -3, big: true, now: true });
      if (kind === 'last') cardText(10, G.t('ff_pipLastSub'), '#ffffff', 3, { life: 2.2, vy: -3 });
    } else if (kind === 'gain') {
      FF.pipFx = { t: 0, kind };
      if (FF.cracks > 0) FF.heal = { t: 0, i: FF.cracks - 1 };
      burst(b.x, b.y - 12, ['#ffd84a', '#fff3a0', '#ffffff', '#8ae07a'], Math.round(40 * Math.max(0.5, Q.particles)), 90, { grav: -30, life: 0.9 });
      ring(b.x, b.y - 6, 40, 22, '#ffd84a', 0.6);
      text(b.x, b.y - 42, G.t('ff_pipGain'), '#ffd84a', 6, { life: 1.6, max: 1.6, vy: -10, big: true });
    } else if (kind === 'muster') text(b.x, b.y - 42, G.t('ff_muster'), '#c8c8d4', 3, { life: 1.8, max: 1.8, vy: -8 });
  });
  // the cracks the Button carries: one a pip lost this run (the next drawn as it splits); a pip back mends the last one
  function drawCracks(b, dt) {
    const r = G.S.run, want = r && r.on && !G.S.fallen ? clamp((r.pipMax | 0) - (r.pips | 0), 0, 3) : 0;
    if (want > FF.cracks) { FF.cracks = want; if (FF.crackT > 0.5) FF.crackT = 0; }
    else if (want < FF.cracks && !FF.heal) FF.heal = { t: 0, i: FF.cracks - 1 };
    FF.crackT += dt;
    let n = FF.cracks;
    if (FF.heal) {
      const hl = FF.heal; hl.t += dt;
      if (hl.t >= 0.7) { FF.heal = null; FF.cracks = Math.min(FF.cracks, want); n = FF.cracks; }
    }
    if (!n) return;
    const pressedY = btnPress > 0 ? 3 : 0;
    for (let i = 0; i < n; i++) {
      const pts = CRACKS[i];
      const grow = i === n - 1 ? clamp(FF.crackT / 0.25, 0, 1) : 1;
      const healK = FF.heal && FF.heal.i === i ? 1 - FF.heal.t / 0.7 : 1;
      const m = Math.max(1, Math.round((pts.length - 1) * grow));
      lctx.globalAlpha = 0.9 * healK; lctx.fillStyle = '#0c0b12';
      for (let j = 0; j < m; j++) line(b.x + pts[j][0], b.y + pts[j][1] + pressedY, b.x + pts[j + 1][0], b.y + pts[j + 1][1] + pressedY);
      lctx.globalAlpha = 0.45 * healK; lctx.fillStyle = '#ffffff';
      for (let j = 0; j < m; j++) line(b.x + pts[j][0] + 1, b.y + pts[j][1] + pressedY, b.x + pts[j + 1][0] + 1, b.y + pts[j + 1][1] + pressedY);
      lctx.globalAlpha = 1;
      if (FF.heal && FF.heal.i === i && Math.random() < 0.7) { const q = pts[Math.floor(Math.random() * pts.length)]; part(b.x + q[0], b.y + q[1], pick(['#ffd84a', '#ffffff', '#fff3a0']), { vx: rand(-10, 10), vy: -rand(10, 30), grav: 0, life: 0.5 }); }
    }
  }
  // the pip itself over the Button: a diamond that splits and falls (lost), or pops in gold and rises (gained)
  function drawPipFx(b, dt) {
    const f = FF.pipFx; if (!f) return;
    f.t += dt;
    if (f.t > 1) { FF.pipFx = null; return; }
    const x = b.x, y = b.y - 40, a = 1 - Math.max(0, f.t - 0.6) / 0.4;
    const dia = (cx, cy, col, half) => { lctx.fillStyle = col; for (let j = -3; j <= 3; j++) { const w = 3 - Math.abs(j); if (half < 0) lctx.fillRect(Math.round(cx - w), Math.round(cy + j), w + 1, 1); else if (half > 0) lctx.fillRect(Math.round(cx), Math.round(cy + j), w + 1, 1); else lctx.fillRect(Math.round(cx - w), Math.round(cy + j), w * 2 + 1, 1); } };
    lctx.globalAlpha = a;
    if (f.kind === 'gain') { const s = Math.min(1, f.t * 6), yy = y - f.t * 10; glow(x, yy, 6, '#ffd84a', 0.4 * a); dia(x, yy, '#0c0b12', 0); if (s >= 1) dia(x, yy, '#ffd84a', 0); }
    else {
      const k = clamp((f.t - 0.12) / 0.88, 0, 1), dx = k * 10, dy = k * k * 30;
      if (f.t < 0.12) dia(x, y, '#ff4f4f', 0);
      else { dia(x - dx, y + dy, '#ff4f4f', -1); dia(x + dx, y + dy, f.kind === 'last' ? '#7a1020' : '#ff4f4f', 1); lctx.fillStyle = '#ffffff'; lctx.fillRect(Math.round(x), Math.round(y - 3), 1, 7); }
    }
    lctx.globalAlpha = 1;
  }

  // ---------- the shrine: hold the Hand on it for 2 s (DESIGN §5.8); its ring fills, the light gathers in ----------
  function shrineChargeStep(dt) {
    const c = FF.charge;
    if (!c) return;
    if (!G.R.shrine || runP() !== 'field') { FF.charge = null; return; }
    if (hitShrine(pointer)) { c.k = G.shrineHold(dt); c.on = true; }
    else if (c.on) { c.on = false; c.k = 0; if (G.shrineLeave) G.shrineLeave(); }
  }
  function drawShrineCharge(s, q, col) {
    const T = G.TUNE.shrineCharge || 2, k = clamp((s.ch || 0) / T, 0, 1), n = 36;
    // the ring under it: dim dots all round, bright ones as far as the charge has come (two rows: it reads at arm's length)
    for (let j = 0; j < n; j++) {
      const a = -Math.PI / 2 + j / n * Math.PI * 2, lit = j / n < k;
      lctx.globalAlpha = lit ? 1 : 0.35; lctx.fillStyle = lit ? (k >= 0.999 ? '#ffffff' : col) : '#0c0b12';
      const x = Math.round(q.x + Math.cos(a) * 13), y = Math.round(q.y - 2 + Math.sin(a) * 6);
      lctx.fillRect(x, y, 1, 1); if (lit) lctx.fillRect(x, y + 1, 1, 1);
    }
    lctx.globalAlpha = 1;
    if (k > 0) {
      glow(q.x, q.y - 8, 8 + Math.round(8 * k), col, 0.2 + 0.3 * k);
      // the light runs in to it
      const m = Math.round(1 + 3 * k);
      for (let j = 0; j < m; j++) { const a = Math.random() * Math.PI * 2, r = rand(16, 26); part(q.x + Math.cos(a) * r, q.y - 6 + Math.sin(a) * r * 0.5, pick([col, '#ffffff']), { vx: -Math.cos(a) * r * 3, vy: -Math.sin(a) * r * 1.5, grav: 0, life: 0.3 }); }
      if (k > 0.85) St.shake(0.8);
    }
  }

  // ---------- Pacts: chains from the corners to the Button; dark runes circle it while the pact holds ----------
  G.on('pact', (id, yes) => {
    if (!yes) return;
    FF.pact = { t: 0, id };
    const b = btnPos(), P = (G.PACTS && G.PACTS[id]) || {};
    St.flash(0.5, '#3a0a5a'); St.shake(5); hitstop = Math.max(hitstop, 0.08);
    ring(b.x, b.y - 4, 70, 38, '#b36bff', 0.7); ring(b.x, b.y - 4, 40, 22, '#ff3b3b', 0.5);
    burst(b.x, b.y - 10, ['#b36bff', '#6a2fa8', '#ff3b3b', '#0c0b12'], 40, 90, { grav: -20 });
    cardText(0, G.t('ff_pact'), '#b36bff', 7, { life: 2.2, vy: -3, big: true });
    if (P.name) cardText(10, P.name, '#ffffff', 3, { life: 2.2, vy: -3 });
  });
  G.on('pactDone', () => {
    const b = btnPos();
    burst(b.x, b.y - 10, ['#ffd84a', '#b36bff', '#ffffff'], 50, 120); ring(b.x, b.y - 4, 80, 44, '#ffd84a', 0.7);
    cardText(0, G.t('ff_pactDone'), '#ffd84a', 6, { life: 2, vy: -3, big: true });
  });
  function drawPact(b, dt) {
    const r = G.S.run, held = !!(r && r.on && (r.pact || r.glass));
    const p = FF.pact;
    if (p) {
      p.t += dt;
      if (p.t > 1.6) FF.pact = null;
      else {
        // the chains come in from the four corners
        const k = clamp(p.t / 0.45, 0, 1), fade = 1 - Math.max(0, p.t - 1.1) / 0.5;
        lctx.globalAlpha = 0.85 * fade;
        for (const [cx, cy] of [[0, 0], [W, 0], [0, H], [W, H]]) {
          const ex = cx + (b.x - cx) * k, ey = cy + (b.y - 8 - cy) * k, d = Math.hypot(ex - cx, ey - cy), m = Math.floor(d / 4);
          for (let j = 0; j < m; j++) { const t = j / Math.max(1, m), x = cx + (ex - cx) * t, y = cy + (ey - cy) * t; lctx.fillStyle = j % 2 ? '#6a2fa8' : '#b36bff'; lctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, j % 2 ? 2 : 3, j % 2 ? 2 : 3); }
        }
        lctx.globalAlpha = 1;
      }
    }
    if (!held) return;
    // the runes of a pact still running
    for (let j = 0; j < 6; j++) {
      const a = time * 0.7 + j / 6 * Math.PI * 2, x = Math.round(b.x + Math.cos(a) * 28), y = Math.round(b.y - 4 + Math.sin(a) * 11);
      lctx.globalAlpha = 0.45 + 0.25 * Math.sin(time * 3 + j); lctx.fillStyle = j % 2 ? '#b36bff' : '#ff3b5c';
      lctx.fillRect(x, y - 1, 1, 3); lctx.fillRect(x - 1, y, 3, 1);
    }
    lctx.globalAlpha = 1;
  }

  // ---------- the Golden Click: a little golden Button on the wing ----------
  function drawGoldenWisp(x, y) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 8);
    glow(x, y - 4, 9, '#ffd84a', 0.22 + 0.12 * pulse);
    blit(SPR.get('wisp_btn'), x, y + Math.sin(time * 6) * 1.5);
    // a little ring that breathes round it, and a trail of gold
    if (Math.floor(time * 3) % 2 === 0) { lctx.globalAlpha = 0.5 * pulse; lctx.fillStyle = '#fff3a0'; for (let j = 0; j < 14; j++) { const a = j / 14 * Math.PI * 2 + time; lctx.fillRect(Math.round(x + Math.cos(a) * 10), Math.round(y - 4 + Math.sin(a) * 6), 1, 1); } lctx.globalAlpha = 1; }
    if (Math.random() < 0.7) part(x + rand(-4, 4), y - rand(0, 6), pick(['#fff3a0', '#ffd84a', '#ffffff', '#ffb347']), { vx: rand(-14, 14), vy: rand(-6, 14), grav: 30, life: 0.6 });
  }
  G.on('goldenClick', (id, e) => {
    const w = St._wispPos || btnPos(), b = btnPos();
    ring(w.x, w.y - 4, 30, 18, '#ffd84a', 0.5); ring(w.x, w.y - 4, 16, 9, '#ffffff', 0.3);
    for (let i = 0; i < 14 && coins.length < 240; i++) coins.push({ x: w.x + rand(-6, 6), y: w.y - 4, vx: rand(-60, 60), vy: rand(-90, -30), floor: b.y + rand(-6, 10), t: rand(0.4, 0.8), fly: 0 });
    cardText(0, G.t('ff_golden'), '#ffd84a', 6, { life: 1.8, vy: -3, big: true });
    if (e && e.name) cardText(9, G.L(e.name), '#ffffff', 3, { life: 1.8, vy: -3 });
  });

  // ---------- the doors: the march through a gate into the next land, the land's title ----------
  G.on('door', (o, slot, vault) => { FF.door = { o, slot, vault, at: time }; });
  function landCol(id) { const g = SPR.REALM_GROUND && SPR.REALM_GROUND[id]; return g ? g.detail || g.base[0] : '#ffd84a'; }
  function drawGate(dt) {
    const g = FF.gate;
    if (!g) return;
    if (!march) { FF.gate = null; return; }
    const k = Math.min(1, march.t / march.T), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    // the gate stands on the line between the lands: it comes down from ahead and the party walks through it
    const b = btnPos(), y = Math.round(e * H) + 6, half = Math.min(46, Math.round(W * 0.16)), ph = 34, col = g.col;
    if (y < 0 || y - ph - 10 > H) return;
    for (const sx of [-1, 1]) {
      const x = b.x + sx * half;
      lctx.fillStyle = 'rgba(0,0,0,0.3)'; lctx.fillRect(x - 5, y, 12, 2);
      lctx.fillStyle = '#4a4458'; lctx.fillRect(x - 4, y - ph, 8, ph);
      lctx.fillStyle = '#6e6880'; lctx.fillRect(x - 4, y - ph, 2, ph);
      lctx.fillStyle = '#2a2632'; lctx.fillRect(x + 3, y - ph, 1, ph); lctx.fillRect(x - 5, y - ph - 2, 10, 2); lctx.fillRect(x - 5, y - 2, 10, 2);
      // the land's banner on the pillar, waving
      const wv = Math.round(Math.sin(time * 6 + sx) * 1.2);
      lctx.fillStyle = col; lctx.fillRect(x - 3 + wv, y - ph + 3, 6, 12); lctx.fillStyle = '#0c0b12'; lctx.fillRect(x - 3 + wv, y - ph + 15, 2, 2); lctx.fillRect(x + 1 + wv, y - ph + 15, 2, 2);
      lctx.fillStyle = '#ffffff'; lctx.fillRect(x - 1 + wv, y - ph + 7, 2, 2);
      // torches
      glow(x, y - ph - 4, 4, '#ff9a3a', 0.35 + 0.1 * Math.sin(time * 12 + sx));
      if (Math.random() < 0.4) part(x + rand(-1, 1), y - ph - 4, pick(['#ffd84a', '#ff7a2e']), { vx: rand(-4, 4), vy: -rand(10, 24), grav: 0, life: 0.35 });
    }
    // the arch
    lctx.fillStyle = '#4a4458';
    for (let dx = -half; dx <= half; dx++) { const a = Math.abs(dx) / half, h = Math.round(6 * (1 - a * a)); lctx.fillRect(b.x + dx, y - ph - 4 - h, 1, 4); }
    lctx.fillStyle = col; lctx.fillRect(b.x - 4, y - ph - 12, 8, 4);
  }
  function landTitle(d) {
    const ri = G.realmIndex(d), R_ = G.REALMS[ri], slot = Math.floor(d / G.REALM_SIZE), act = G.SIEGE && G.SIEGE.actOf ? G.SIEGE.actOf[slot] : null;
    const dr = FF.door && time - FF.door.at < 12 ? FF.door : null, o = dr && dr.o;
    const name = (o && o.name) || G.realmName(d), col = landCol(R_.id);
    cardText(0, G.t('ff_landN', slot + 1, String(name).toUpperCase()), '#ffffff', 7, { life: 3.2, max: 3.2, vy: -3, big: true, tag: 'land' });
    cardText(10, act ? G.t('ff_act', ROMAN[act] || act) : act === 0 ? G.t('ff_actFinal') : '', act === 0 ? '#ff4f7e' : col, 3, { life: 3.2, max: 3.2, vy: -3 });
    cardText(16, R_.rule + ': ' + R_.ruleDesc, '#ffe27a', 3, { life: 3.2, max: 3.2, vy: -3 });
    const bits = [];
    if (o && o.mod && G.MAP_MODS && G.MAP_MODS[o.mod] && o.mod !== 'calm') bits.push(G.t('ff_twist', G.MAP_MODS[o.mod].name) + (o.cursed ? ' ' + G.t('ff_cursed') : ''));
    if (o && o.tag && G.REWARD_TAGS && G.REWARD_TAGS[o.tag]) bits.push(G.t('ff_prize', G.REWARD_TAGS[o.tag].name));
    if (bits.length) cardText(22, bits.join(' · '), o && o.cursed ? '#ff6a5a' : '#c8f0ff', 3, { life: 3.2, max: 3.2, vy: -3 });
    St.flash(0.25, col);
    if (G.Audio && G.Audio.landTitle) G.Audio.landTitle();
  }

  // ---------- the finale: the Last Stand (a red sky, packs telegraphed at the edges) and the Mad Button ----------
  G.on('lastStand', L => {
    FF.edges.length = 0;
    St.flash(0.6, '#ff2a2a'); St.shake(9); hitstop = Math.max(hitstop, 0.12);
    const b = btnPos(); ring(b.x, b.y - 4, 140, 80, '#ff3b3b', 1); ring(b.x, b.y - 4, 90, 50, '#ffffff', 0.6);
    cardText(0, G.t('ff_ls'), '#ff3b3b', 10, { life: 3, vy: -2, big: true, now: true });
    cardText(13, G.t('ff_lsSub', Math.round((L && L.T) || 75)), '#ffffff', 3, { life: 3, vy: -2 });
  });
  G.on('lastStandEnd', L => { if (!L) return; const b = btnPos(); ring(b.x, b.y - 4, 120, 66, '#ffd84a', 0.8); cardText(0, G.t('ff_lsHeld'), '#ffd84a', 7, { life: 1.6, vy: -3, big: true }); });
  G.on('packIn', a => { if (G.R.lastStand && FF.edges.length < 16) FF.edges.push({ a, t: 0 }); });
  G.on('madButton', () => {
    const p = bossPos();
    St.flash(0.95, '#1a0024'); St.shake(14); hitstop = Math.max(hitstop, 0.3); slowmo = Math.max(slowmo, 0.8);
    for (let i = 0; i < 4; i++) { const x = p.x + rand(-50, 50), pts = [[x + rand(-20, 20), 0]]; for (let j = 1; j < 7; j++) pts.push([x + (p.x - x) * j / 7 + rand(-10, 10), (p.y - 20) * j / 7]); bolts.push({ pts, life: 0.45, cols: ['#ffffff', '#ff2ad4'], wide: true }); }
    ring(p.x, p.y - 8, 150, 84, '#ff2ad4', 1); ring(p.x, p.y - 8, 100, 56, '#7a00ff', 0.8); ring(p.x, p.y - 8, 50, 28, '#ffffff', 0.5);
    burst(p.x, p.y - 14, ['#ff2ad4', '#7a00ff', '#0c0b12', '#ffffff'], 120, 200, { life: 1 });
  });
  function drawFinaleSky(dt) {
    const R = G.R, lsOn = !!R.lastStand, mad = !!(R.boss && R.boss.final);
    FF.lsK = clamp(FF.lsK + (lsOn ? dt : -dt) * 1.2, 0, 1);
    FF.madK = clamp(FF.madK + (mad ? dt : -dt) * 1.2, 0, 1);
    const k = FF.lsK, m = FF.madK;
    if (k <= 0 && m <= 0) return;
    if (k > 0) {
      // a red sky: the field runs red, a dark band at the top, a blood moon, ash on the wind, the odd flicker of red lightning
      lctx.globalCompositeOperation = 'multiply'; lctx.globalAlpha = 0.55 * k; lctx.fillStyle = '#ff7a6a'; lctx.fillRect(0, 0, W, H);
      lctx.globalCompositeOperation = 'source-over';
      for (let yy = 0; yy < H * 0.28; yy += 2) { lctx.globalAlpha = 0.5 * k * (1 - yy / (H * 0.28)); lctx.fillStyle = '#2a0006'; lctx.fillRect(0, yy, W, 2); }
      const mx = Math.round(W * 0.82), my = Math.round(H * 0.12) + 4;
      glow(mx, my, 14, '#ff3b2a', 0.3 * k);
      lctx.globalAlpha = k; lctx.fillStyle = '#ff3b2a';
      for (let dy = -7; dy <= 7; dy++) { const w = Math.round(Math.sqrt(49 - dy * dy)); lctx.fillRect(mx - w, my + dy, w * 2, 1); }
      lctx.fillStyle = '#8a0a12'; for (let dy = -7; dy <= 7; dy++) { const w = Math.round(Math.sqrt(49 - dy * dy) * 0.6); lctx.fillRect(mx + 2, my + dy, w, 1); }
      lctx.globalAlpha = 1;
      if (Math.random() < 0.5 * k) part(rand(0, W), -2, pick(['#3a2a2a', '#5a3a3a', '#ff7a2e']), { vx: rand(-30, -10), vy: rand(30, 60), grav: 0, life: rand(1.2, 2.4) });
      if ((FF.lsFlashT -= dt) <= 0) { FF.lsFlashT = rand(2.5, 5); if (lsOn) { St.flash(0.18, '#ff5a5a'); const x = rand(W * 0.1, W * 0.9), pts = [[x, 0]]; for (let j = 1; j < 5; j++) pts.push([x + rand(-12, 12), H * 0.2 * j / 5]); bolts.push({ pts, life: 0.2, cols: ['#ffffff', '#ff4f4f'] }); } }
    }
    if (m > 0) {
      // the Mad Button's own sky: the void closes in (dark, violet, the field's edges eaten away)
      lctx.globalAlpha = 0.28 * m; lctx.fillStyle = '#12001a'; lctx.fillRect(0, 0, W, H);
      lctx.globalAlpha = 0.35 * m; lctx.fillStyle = '#7a00ff';
      for (let j = 0; j < 24; j++) { const a = j / 24 * Math.PI * 2 + time * 0.3, r = 0.46 + 0.04 * Math.sin(time * 2 + j); lctx.fillRect(Math.round(W / 2 + Math.cos(a) * W * r), Math.round(H / 2 + Math.sin(a) * H * r), 3, 3); }
      lctx.globalAlpha = 1;
      if (Math.random() < 0.3 * m) part(rand(0, W), rand(0, H), pick(['#7a00ff', '#ff2ad4', '#0c0b12']), { vx: 0, vy: -rand(5, 15), grav: 0, life: 1 });
    }
  }
  function drawEdges(dt) {
    if (!FF.edges.length) return;
    const b = btnPos();
    for (let i = FF.edges.length - 1; i >= 0; i--) {
      const e = FF.edges[i];
      if ((e.t += dt) >= 0.9) { FF.edges.splice(i, 1); continue; }
      const q = ringPos(e.a, 0), x = clamp(q.x, 6, W - 6), y = clamp(q.y, 22, H - 24), a = 1 - e.t / 0.9;
      glow(x, y, 7, '#ff2a2a', 0.45 * a);
      const dx = b.x - x, dy = b.y - y, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
      lctx.globalAlpha = a; lctx.fillStyle = Math.floor(time * 10) % 2 ? '#ff4f4f' : '#ffffff';
      for (let j = 0; j < 3; j++) { const d = 6 + j * 5 + (e.t * 20) % 5; lctx.fillRect(Math.round(x + ux * d - uy * 2), Math.round(y + uy * d + ux * 2), 2, 2); lctx.fillRect(Math.round(x + ux * d + uy * 2), Math.round(y + uy * d - ux * 2), 2, 2); lctx.fillRect(Math.round(x + ux * (d + 2)), Math.round(y + uy * (d + 2)), 2, 2); }
      lctx.globalAlpha = 1;
    }
  }
  // the Last Stand's drum shows on the screen's edge (with the hurt glow's layer)
  function siegeRed() { return FF.lsK > 0 ? FF.lsK * (0.07 + 0.09 * Math.pow(0.5 + 0.5 * Math.sin(time * 12.5), 6)) : 0; }
  // the Mad Button: its colours split, the void crawls round it
  const tintCache = new Map();
  function tinted(c, col) {
    let m = tintCache.get(col); if (!m) { m = new WeakMap(); tintCache.set(col, m); }
    let w = m.get(c); if (w) return w;
    w = SPR.makeCanvas(c.width, c.height); const x = w.getContext('2d');
    x.drawImage(c, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
    m.set(c, w); return w;
  }
  function drawMadUnder(bp, sp, sc) {
    glow(bp.x, bp.y - sp.height * sc / 2, Math.round(sp.width * sc / 2), '#7a00ff', 0.18 + 0.08 * Math.sin(time * 4));
    if (Math.random() < 0.12) { const a = Math.random() * Math.PI * 2, r = sp.width * sc * 0.6, pts = [[bp.x, bp.y - sp.height * sc / 2]]; for (let j = 1; j < 4; j++) pts.push([bp.x + Math.cos(a) * r * j / 3 + rand(-4, 4), bp.y - sp.height * sc / 2 + Math.sin(a) * r * 0.6 * j / 3 + rand(-4, 4)]); bolts.push({ pts, life: 0.08, cols: ['#ffffff', '#ff2ad4'] }); }
  }
  function drawMadOver(sp, x, y, sc) {
    const glitch = Math.random() < (G.R.boss && G.R.boss.rage ? 0.35 : 0.15);
    if (!glitch) return;
    const o = Math.round(rand(1, 3));
    blit(tinted(sp, '#ff2a5a'), x - o, y, sc, 0.45); blit(tinted(sp, '#2af0ff'), x + o, y, sc, 0.35);
    if (Math.random() < 0.4) { lctx.globalAlpha = 0.6; lctx.fillStyle = pick(['#ff2ad4', '#0c0b12', '#ffffff']); lctx.fillRect(Math.round(x - sp.width * sc / 2 + rand(-6, 6)), Math.round(y - rand(0, sp.height * sc)), Math.round(sp.width * sc * rand(0.3, 0.9)), 1); lctx.globalAlpha = 1; }
  }

  // ---------- the camp (DESIGN §5.5): night falls on the field, a fire burns by the Button, the tents are up ----------
  function drawCamp(dt) {
    const on = runP() === 'camp';
    FF.campK = clamp(FF.campK + (on ? dt : -dt) * 1.5, 0, 1);
    const k = FF.campK;
    if (k <= 0) return;
    const b = btnPos(), fx = b.x, fy = b.y + 26, fl = 0.8 + 0.2 * Math.sin(time * 9) * Math.sin(time * 5.3);
    lctx.globalAlpha = 0.45 * k; lctx.fillStyle = '#0a0c24'; lctx.fillRect(0, 0, W, H);
    // the warm light (an additive glow) and the tents in it
    lctx.globalCompositeOperation = 'lighter';
    glow(fx, fy - 4, 34, '#ff7a2a', 0.16 * k * fl); glow(fx, fy - 4, 18, '#ffb347', 0.18 * k * fl);
    lctx.globalCompositeOperation = 'source-over'; lctx.globalAlpha = 1;
    const tent = SPR.get('camp_tent');
    if (tent) { lctx.globalAlpha = k; blit(tent, b.x - 48, b.y + 22); blit(tent, b.x + 50, b.y + 14); lctx.globalAlpha = 1; }
    // the fire: logs, then three tongues of flame that never hold still, sparks going up
    lctx.globalAlpha = k;
    lctx.fillStyle = '#4a2a16'; lctx.fillRect(fx - 6, fy - 1, 12, 2); lctx.fillStyle = '#6a3e20'; lctx.fillRect(fx - 5, fy - 2, 4, 2); lctx.fillRect(fx + 1, fy, 5, 2);
    lctx.fillStyle = '#8a8a98'; for (const dx of [-8, -5, 5, 8]) lctx.fillRect(fx + dx, fy + 1, 2, 1);
    const fh = [5 + Math.sin(time * 13) * 1.5, 8 + Math.sin(time * 11 + 1) * 2, 5 + Math.sin(time * 15 + 2) * 1.5];
    [['#ff4f2e', 1], ['#ffa033', 0.7], ['#fff3a0', 0.4]].forEach(([c, s]) => { lctx.fillStyle = c; for (let i = 0; i < 3; i++) { const h = Math.round(fh[i] * s), x = fx - 3 + i * 2; lctx.fillRect(x, fy - 1 - h, 2, h); } });
    lctx.globalAlpha = 1;
    if (Math.random() < 0.5 * k) part(fx + rand(-3, 3), fy - 6, pick(['#ffd84a', '#ff7a2e', '#fff3a0']), { vx: rand(-6, 6), vy: -rand(20, 40), grav: -6, life: rand(0.6, 1.2) });
  }

  // ---------- the Buttons' looks (DESIGN §6.1-6.2) and the store's skin ----------
  // the look on the field: the store's finish (if one is worn) over the run's Button (G.btnSkin(): its evolution once it
  // has evolved), or the 3.x skin outside a Siege
  function btnLookNow() {
    const cs = cosm('skin');
    let id = null;
    try { id = inSiege() && G.btnSkin ? G.btnSkin() : null; } catch (e) { id = null; }
    if (FF.evo && FF.evo.t < FF.evo.at) id = FF.evo.from;
    if (!id) id = G.S.skin || 'classic';
    const L = (SPR.BTN_LOOKS && SPR.BTN_LOOKS[id]) || null, sk = L ? null : G.SKINS.find(s => s.id === id);
    const look = L || { base: sk ? sk.base : '#e8413c' };
    return { id, look, base: cs && cs.base ? cs.base : look.base, glow: cs && cs.glow ? cs.glow : look.glow, aura: look.aura };
  }
  St.btnLook = btnLookNow;
  function btnSprite(lk, pressed) {
    const fr = Math.floor(time * (lk.aura === 'perpetual' ? 10 : lk.aura === 'clock' ? 2 : 3));
    return SPR.buttonLook ? SPR.buttonLook(lk.look, pressed, time * 120 % 360, fr, lk.base) : SPR.button(lk.base, pressed, time * 120 % 360);
  }
  // what each look does round the Button every frame (cheap: a few particles, a glow, the odd arc)
  function drawBtnAura(b, lk) {
    const A = lk.aura, P = Q.particles;
    if (lk.glow) glow(b.x, b.y - 10, 16, lk.glow, 0.1 + 0.05 * Math.sin(time * 4));
    if (!A) return;
    const top = () => [b.x + rand(-13, 13), b.y - rand(10, 20)];
    if (A === 'storm' || A === 'tempest') {
      if (Math.random() < (A === 'tempest' ? 0.3 : 0.1)) { const a = Math.random() * Math.PI * 2, r = rand(16, A === 'tempest' ? 34 : 24), pts = [[b.x, b.y - 14]]; for (let j = 1; j < 4; j++) pts.push([b.x + Math.cos(a) * r * j / 3 + rand(-3, 3), b.y - 14 + Math.sin(a) * r * 0.6 * j / 3 + rand(-3, 3)]); bolts.push({ pts, life: 0.08, cols: ['#ffffff', A === 'tempest' ? '#d27bff' : '#a048ff'] }); }
    } else if (A === 'spore' || A === 'bloom') {
      if (Math.random() < 0.25 * P) { const [x, y] = top(); part(x, y, A === 'bloom' ? pick(['#ffd0f0', '#ffffff', '#7dff9a']) : pick(['#b6ff5a', '#2fc46a', '#e8ffe8']), { vx: rand(-8, 8), vy: -rand(6, 14), grav: A === 'bloom' ? 12 : -4, life: rand(0.8, 1.4) }); }
    } else if (A === 'gold' || A === 'golden') {
      if (Math.random() < (A === 'golden' ? 0.35 : 0.15)) { const [x, y] = top(); part(x, y, pick(['#fff3a0', '#ffd84a', '#ffffff']), { vx: 0, vy: -rand(8, 16), grav: 0, life: 0.6, plus: Math.random() < 0.4 }); }
      if (A === 'golden' && Q.glows) { lctx.globalAlpha = 0.08; lctx.fillStyle = '#ffd84a'; for (let j = 0; j < 6; j++) { const a = time * 0.8 + j / 6 * Math.PI * 2; lctx.beginPath(); lctx.moveTo(b.x, b.y - 12); lctx.lineTo(b.x + Math.cos(a - 0.1) * 60, b.y - 12 + Math.sin(a - 0.1) * 36); lctx.lineTo(b.x + Math.cos(a + 0.1) * 60, b.y - 12 + Math.sin(a + 0.1) * 36); lctx.fill(); } lctx.globalAlpha = 1; }
    } else if (A === 'glass' || A === 'diamond' || A === 'iron' || A === 'adamant') {
      if (Math.random() < (A === 'diamond' ? 0.18 : 0.06)) { const [x, y] = top(); part(x, y, A === 'glass' ? '#d8b8ff' : '#ffffff', { vx: 0, vy: 0, grav: 0, life: 0.4, plus: true }); }
      if (A === 'adamant') { lctx.globalAlpha = 0.25 + 0.1 * Math.sin(time * 3); lctx.fillStyle = '#9fd8ff'; for (let j = 0; j < 28; j++) { if ((j + Math.floor(time * 6)) % 4 === 0) continue; const a = j / 28 * Math.PI * 2; lctx.fillRect(Math.round(b.x + Math.cos(a) * 24), Math.round(b.y - 6 + Math.sin(a) * 12), 1, 1); } lctx.globalAlpha = 1; }
    } else if (A === 'prism' || A === 'spectrum') {
      if (Math.random() < 0.2 * P) { const [x, y] = top(); part(x, y, rbw(Math.floor(Math.random() * 8)), { vx: rand(-6, 6), vy: -rand(6, 16), grav: 0, life: 0.6 }); }
      if (A === 'spectrum') for (let j = 0; j < 24; j++) { const a = j / 24 * Math.PI * 2 + time; lctx.fillStyle = rbw(j + Math.floor(time * 8)); lctx.globalAlpha = 0.55; lctx.fillRect(Math.round(b.x + Math.cos(a) * 25), Math.round(b.y - 6 + Math.sin(a) * 12), 1, 1); }
      lctx.globalAlpha = 1;
    } else if (A === 'crimson') {
      glow(b.x, b.y - 10, 18, '#ff2a3a', 0.12 + 0.06 * Math.sin(time * 7));
      if (Math.random() < 0.4 * P) part(b.x + rand(-14, 14), b.y - rand(0, 8), pick(['#ff2a3a', '#ff7a2e', '#ffd84a']), { vx: rand(-4, 4), vy: -rand(16, 34), grav: -10, life: rand(0.4, 0.8) });
    } else if (A === 'clock' || A === 'perpetual') {
      const per = A === 'perpetual' ? 0.25 : 1;
      if (Math.floor(time / per) !== Math.floor((time - fdt) / per)) { ring(b.x, b.y - 4, 22, 11, A === 'perpetual' ? '#ffe9a0' : '#c8b47a', 0.25); if (A === 'perpetual') part(b.x + rand(-16, 16), b.y - rand(0, 6), '#ffd84a', { vx: rand(-20, 20), vy: -rand(20, 40), life: 0.3 }); }
    }
  }
  // ---------- a Button evolving (DESIGN §6.2, 'btnEvolve'): it rises, spins and glows, the shell bursts, the new form ----------
  G.on('btnEvolve', (base, evo) => {
    const E = G.BUTTON_EVOS && G.BUTTON_EVOS[evo], B = G.BUTTON_BY_ID && G.BUTTON_BY_ID[base];
    if (!E) return;
    FF.evo = { t: 0, T: 2.6, at: 1.3, from: (B && B.skin) || 'classic', col: E.col || '#ffffff', golden: evo === 'golden', burst: false };
  });
  function drawEvoUnder(b, dt) {
    const v = FF.evo; if (!v) return 0;
    v.t += dt;
    if (v.t >= v.T) { FF.evo = null; return 0; }
    const pre = v.t < v.at, k = pre ? v.t / v.at : 1 - (v.t - v.at) / (v.T - v.at);
    // light rays turn behind the Button, faster as it charges
    if (Q.glows) {
      lctx.globalAlpha = 0.12 * k; lctx.fillStyle = v.golden ? '#ffd84a' : v.col;
      for (let j = 0; j < 10; j++) { const a = time * (pre ? 1 + 4 * k : 1) + j / 10 * Math.PI * 2, r = Math.max(W, H); lctx.beginPath(); lctx.moveTo(b.x, b.y - 12); lctx.lineTo(b.x + Math.cos(a - 0.07) * r, b.y - 12 + Math.sin(a - 0.07) * r); lctx.lineTo(b.x + Math.cos(a + 0.07) * r, b.y - 12 + Math.sin(a + 0.07) * r); lctx.fill(); }
      lctx.globalAlpha = 1;
    }
    if (pre) {
      // the light runs in to the Button
      for (let j = 0; j < Math.round(2 + 4 * k); j++) { const a = Math.random() * Math.PI * 2, r = rand(30, 60); part(b.x + Math.cos(a) * r, b.y - 12 + Math.sin(a) * r * 0.6, pick([v.col, '#ffffff']), { vx: -Math.cos(a) * r * 2.2, vy: -Math.sin(a) * r * 1.3, grav: 0, life: 0.4 }); }
      if (k > 0.6) St.shake(1 + 2 * k);
    } else if (!v.burst) {
      v.burst = true;
      const old = SPR.buttonLook ? SPR.buttonLook(v.from, false, time * 120 % 360, 0) : SPR.button('#e8413c', false, 0);
      explodeSprite(old, b.x, b.y + 4, 1, Math.round(70 * Math.max(0.5, Q.particles)), 2, 'shatter');
      St.flash(0.9, '#ffffff'); St.shake(10); hitstop = Math.max(hitstop, 0.2);
      ring(b.x, b.y - 8, 40, 22, '#ffffff', 0.4); ring(b.x, b.y - 8, 100, 56, v.col, 0.8); ring(b.x, b.y - 8, 160, 90, v.golden ? '#ffd84a' : rbw(2), 1.1);
      burst(b.x, b.y - 12, [v.col, '#ffffff', '#ffd84a'], Math.round(80 * Q.particles), 170);
      btnSpring.s = 1.5; btnSpring.v = 0;
    } else if (Math.random() < 0.5) part(b.x + rand(-16, 16), b.y - rand(4, 22), pick([v.col, '#ffffff']), { vx: 0, vy: -rand(10, 30), grav: 0, life: 0.6, plus: Math.random() < 0.5 });
    return pre ? k : 0;
  }

  // ---------- the store's looks: the Hand's trail ----------
  function trailAt(x, y, n) {
    const tr = cosm('trail'); if (!tr || !tr.cols || G.R.town) return;
    for (let i = 0; i < (n || 1); i++) part(x + rand(-1.5, 1.5), y + rand(-1.5, 1.5), pick(tr.cols), { vx: rand(-8, 8), vy: rand(-14, 2), grav: -4, life: rand(0.35, 0.6), size: Math.random() < 0.3 ? 2 : 1 });
  }

  // ---------- the Marks' blows (js/powers.js; ADDENDUM 1: Mythic and Divine items carry them) ----------
  const mpos = m => (m && m.a != null ? mobPos(m) : null);
  G.on('pwArc', (from, list) => { const a = mpos(from) || btnPos(); for (const m of (list || []).slice(0, 6)) { const q = mpos(m); if (q) zap(a, q, ['#ffffff', '#b36bff']); } if (!list || !list.length) { const p = bossPos(); ring(p.x, p.y - 10, 30, 16, '#b36bff', 0.3); } });
  G.on('pwSurge', (m, list) => { const q = mpos(m); if (!q) return; ring(q.x, q.y - 4, 26, 13, '#7fe9ff', 0.4); for (const o of (list || []).slice(0, 5)) { const p = mpos(o); if (p) zap(q, p, ['#ffffff', '#7fe9ff']); } });
  G.on('pwReap', m => { const q = mpos(m); if (!q) return; burst(q.x, q.y - 6, ['#0c0b12', '#6a2fa8', '#c8c8d4'], 14, 70, { life: 0.4 }); text(q.x, q.y - 16, G.t('ff_reap'), '#c8a0ff', 3, { life: 0.8, max: 0.8, vy: -14 }); });
  G.on('pwGold', (m, g) => { const q = mpos(m); if (!q) return; burst(q.x, q.y - 6, ['#ffd84a', '#fff3a0'], 12, 70, { life: 0.4 }); text(q.x, q.y - 14, '+' + G.fmt(g), '#ffd84a', 3, { life: 0.9, max: 0.9, vy: -14, dmg: true }); });
  G.on('pwPhoenix', who => { const q = unitPos(who); ring(q.x, q.y - 4, 40, 22, '#ff7a2e', 0.7); burst(q.x, q.y - 8, ['#ff4f2e', '#ffa033', '#ffd84a', '#ffffff'], 50, 110, { grav: -60, life: 0.9 }); text(q.x, q.y - 30, G.t('ff_phoenix'), '#ffa033', 6, { life: 1.6, max: 1.6, vy: -10, big: true }); St.flash(0.3, '#ff7a2e'); });
  G.on('pwBolt', (list, boss) => {
    const tg = boss ? [bossPos()] : (list || []).slice(0, 6).map(mpos).filter(Boolean);
    for (const q of tg) { const pts = [[q.x + rand(-10, 10), 0]]; for (let j = 1; j < 5; j++) pts.push([q.x + rand(-6, 6), (q.y - 6) * j / 5]); bolts.push({ pts, life: 0.18, cols: ['#ffffff', '#7fe9ff'], wide: true }); burst(q.x, q.y - 4, ['#ffffff', '#7fe9ff'], 6, 50, { life: 0.3 }); }
    if (tg.length) St.flash(0.1, '#bff4ff');
  });
  G.on('pwSpike', m => { const q = mpos(m); if (!q) return; for (let j = -2; j <= 2; j++) part(q.x + j * 3, q.y, '#c8c8d4', { vx: j * 10, vy: -rand(40, 70), grav: 200, life: 0.35 }); ring(q.x, q.y - 1, 12, 6, '#c8c8d4', 0.25); });
  G.on('pwMeteor', (m, r, n) => {
    const q = mpos(m) || bossPos(), rx = Math.max(10, (r || 0.15) * W * 0.62), ry = rx * 0.55;
    const pts = [[q.x + 40, 0], [q.x + 20, q.y * 0.5], [q.x, q.y - 6]];
    bolts.push({ pts, life: 0.15, cols: ['#ffd84a', '#ff7a2e'], wide: true });
    ring(q.x, q.y - 2, rx, ry, '#ff7a2e', 0.45); burst(q.x, q.y - 6, ['#ff4f2e', '#ffa033', '#ffd84a', '#3a2a2a'], 30, 120, { life: 0.6 });
    St.shake(4); hitstop = Math.max(hitstop, 0.04);
  });
  G.on('pwEcho', () => { const b = btnPos(); ring(b.x, b.y - 4, 50, 28, '#c8f0ff', 0.5); text(b.x, b.y - 46, G.t('ff_echo'), '#c8f0ff', 4, { life: 1, max: 1, vy: -10 }); });
  G.on('pwBreak', () => { const p = bossPos(); burst(p.x, p.y - 14, ['#c8c8d4', '#ffffff', '#6e6e7c'], 40, 140, { grav: 160 }); text(p.x, overBoss(6), G.t('ff_break'), '#ffffff', 6, { life: 1.4, max: 1.4, vy: -8, big: true }); St.shake(6); hitstop = Math.max(hitstop, 0.1); });
  G.on('pwNose', (m, v) => { const q = mpos(m); if (!q) return; burst(q.x, q.y - 6, ['#ff7a2e', '#ffd84a'], 6, 40, { grav: -30, life: 0.5 }); if (v) text(q.x, q.y - 14, '+' + fmtSmall(v), '#ffa033', 3, { life: 0.9, max: 0.9, vy: -12, dmg: true }); });
  G.on('pwLight', on => { FF.light = !!on; if (on) { const b = btnPos(); ring(b.x, b.y - 4, 50, 28, '#fff3a0', 0.6); } });
  G.on('pwEngine', pct => { if (!(pct > 0) || Math.round(pct) % 25) return; const b = btnPos(); text(b.x + 26, b.y - 30, G.t('ff_engine', Math.round(pct)), '#ffe27a', 3, { life: 1, max: 1, vy: -12 }); });
  function zap(a, q, cols) { const pts = [[a.x, a.y - 6]]; for (let i = 1; i < 3; i++) pts.push([a.x + (q.x - a.x) * i / 3 + rand(-3, 3), a.y - 6 + (q.y - a.y) * i / 3 + rand(-3, 3)]); pts.push([q.x, q.y - 6]); if (bolts.length < 80) bolts.push({ pts, life: 0.12, cols }); }
  // a chest the Siege's budget paid out as coin (game.js 'chestCoin'): a spill of coins where it fell
  G.on('chestCoin', (tier, v, at) => {
    const q = mpos(at) || btnPos(), b = btnPos();
    for (let i = 0; i < 6 && coins.length < 240; i++) coins.push({ x: q.x, y: q.y - 6, vx: rand(-50, 50), vy: rand(-90, -40), floor: q.y + rand(-2, 3), t: rand(0.4, 0.7), fly: 0 });
    burst(q.x, q.y - 6, ['#ffd84a', '#fff3a0'], 8, 50, { life: 0.4 });
    if (v > 0) text(q.x, q.y - 16, '+' + G.fmt(v), '#ffd84a', 3, { life: 0.9, max: 0.9, vy: -14, dmg: true });
    void b;
  });

  // ---------- the hooks the frame calls ----------
  // under the crowd (after the ground and the zone's light): the finale's sky, the camp, the door's gate
  function siegeUnder(dt, vdt) {
    shrineChargeStep(dt);
    drawFinaleSky(dt);
    drawCamp(dt);
    drawGate(dt);
    void vdt;
  }
  // over everything on the pixel layer: the edge telegraphs, the loot moment, the pillars and the shimmer
  function siegeOver(dt, vdt) {
    drawEdges(dt);
    drawLootMoment(dt);
    drawPillars(vdt > 0 ? Math.max(vdt, dt * 0.3) : dt);
  }
  // on the Button itself (drawButton): its look's aura, the Last Light, a pact's runes, the cracks, the pip over it
  function siegeOnButton(b, lk) {
    drawBtnAura(b, lk);
    if (FF.light) glow(b.x, b.y - 10, 20, '#fff3a0', 0.16 + 0.08 * Math.sin(time * 5));
    drawPact(b, fdt);
    drawCracks(b, fdt);
    drawPipFx(b, fdt);
  }
  // a resize or a new run forgets the moment's leftovers
  G.on('ascend', () => { FF.loot = null; FF.pillars.length = 0; FF.shimmer.length = 0; FF.edges.length = 0; FF.cracks = 0; FF.heal = null; FF.pipFx = null; FF.evo = null; FF.pact = null; FF.charge = null; FF.light = false; });
  G.on('runStart', () => { FF.cracks = 0; FF.heal = null; FF.light = false; });

  // ---------- Hi-res text layer (drawn in logical coords, crisp font) ----------
  const FONT = '"Press Start 2P", "BTTN Body", monospace';
  // Press Start 2P is only crisp on an 8px device grid, so snap logical sizes to it.
  // at least 8 CSS px on any screen, on the 8-device-px grid
  function crisp(size) { const k = S * TDPR, g = 8 * Math.ceil(TDPR); return Math.max(g, Math.round(size * k / 8) * 8) / k; }
  function drawTexts(dt) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i]; t.life -= dt;
      if (t.life <= 0) { texts.splice(i, 1); continue; }
      t.y += t.vy * dt; t.vy *= 0.97;
      const age = t.max - t.life;
      const pop = age < t.pop ? 1 + (1 - age / t.pop) * 0.5 : 1;
      const a = Math.min(1, t.life / t.max * 2.2);
      ctx.globalAlpha = a;
      ctx.font = crisp(t.size * pop) + 'px ' + FONT;
      // a line wider than the stage shrinks to fit
      if (t.fitW == null) { ctx.font = crisp(t.size) + 'px ' + FONT; t.fitW = ctx.measureText(t.str).width; t.fitS = crisp(t.size); ctx.font = crisp(t.size * pop) + 'px ' + FONT; }
      const wNow = t.fitW * crisp(t.size * pop) / t.fitS;
      if (wNow > W - 8) ctx.font = (crisp(t.size * pop) * (W - 8) / wNow) + 'px ' + FONT;
      ctx.lineWidth = Math.max(1, t.size * 0.35);
      ctx.strokeStyle = '#0c0b12';
      ctx.lineJoin = 'round';
      ctx.strokeText(t.str, t.x, t.y);
      ctx.fillStyle = t.col;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
  // Rare monsters wear their names, as in PoE
  // (3.6: a name that would sit on the HUD is left off; on a phone the magic mobs' mods are left off too)
  const nameFree = (x, y, str, sz) => { const w = str.length * sz * 0.55 + 2; return onFree(x - w, y - sz, x + w, y + sz); };
  function drawNames() {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 1; ctx.strokeStyle = '#0c0b12';
    // (only the mobs that wear a name, as the frame found them)
    const ms = named;
    for (let i = 0; i < ms.length; i++) {
      const m = ms[i];
      if (m.dead) continue;
      if (m.kind === 'hoard' || m.kind === 'guardian') {
        const q = mobPos(m), hoard = m.kind === 'hoard', y = hoard ? q.y - 25 : q.y - 44;
        const nm = m.gob ? G.t('goblin') : hoard ? G.t('hoarder') : m.inv && G.INV_BY_ID[m.inv] ? G.INV_BY_ID[m.inv].bossName : G.t('riftGuardian');
        if (!nameFree(q.x, y, nm, crisp(hoard ? 3 : 4))) continue;
        ctx.font = crisp(hoard ? 3 : 4) + 'px ' + FONT;
        ctx.strokeText(nm, q.x, y); ctx.fillStyle = m.gob ? '#8ae07a' : hoard ? '#ffd84a' : '#ff9ab4'; ctx.fillText(nm, q.x, y);
        if (hoard) { const k = clamp(m.life / (m.gob ? (G.R.ev && G.R.ev.T) || 20 : G.TUNE.hoardLife), 0, 1); ctx.fillStyle = '#0c0b12'; ctx.fillRect(q.x - 9, y + 3, 18, 2); ctx.fillStyle = k > 0.3 ? '#b36bff' : '#ff4f4f'; ctx.fillRect(q.x - 9, y + 3, 18 * k, 1); }
        else { const k = clamp(m.hp / m.max, 0, 1); ctx.fillStyle = '#0c0b12'; ctx.fillRect(q.x - 21, y + 3, 42, 3); ctx.fillStyle = '#ff3b5c'; ctx.fillRect(q.x - 20, y + 4, 40 * k, 1.5); }
        continue;
      }
      if (m.kind === 'magic' && m.mod) {
        if (Q.phone) continue;
        const q = mobPos(m);
        const mod = G.RARE_MODS[m.mod].name;
        if (!nameFree(q.x, q.y - 22, mod, crisp(3))) continue;
        ctx.font = crisp(3) + 'px ' + FONT;
        ctx.strokeText(mod, q.x, q.y - 22); ctx.fillStyle = '#8ac8ff'; ctx.fillText(mod, q.x, q.y - 22);
        continue;
      }
      if (m.kind !== 'rare') continue;
      const q = mobPos(m);
      if (!nameFree(q.x, q.y - 25, m.name, crisp(3) * 1.6)) continue;
      ctx.font = crisp(3) + 'px ' + FONT;
      ctx.strokeText(m.name, q.x, q.y - 27); ctx.fillStyle = '#ffd84a'; ctx.fillText(m.name, q.x, q.y - 27);
      const mod = G.RARE_MODS[m.mod].name;
      ctx.strokeText(mod, q.x, q.y - 23); ctx.fillStyle = '#c8b4ff'; ctx.fillText(mod, q.x, q.y - 23);
    }
  }
  let hudBottomH = 0;
  function drawStreak() {
    const c = G.carnage ? G.carnage() : { n: streak.n, tier: 0 };
    const n = Math.max(c.n, 0);
    if (n < 10 || (G.S.hero && G.S.hero.offer)) return;
    // the kill counter lives just above the bars at the bottom, clear of the title cards
    if (!hudBottomH) hudBoxesNow();
    const y = H - Math.ceil(hudBottomH / S) - 12;
    const pop = streak.pop > 0 ? 1 + streak.pop * 2 : 1;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = crisp(4 * pop) + 'px ' + FONT; ctx.lineWidth = 1.5; ctx.strokeStyle = '#0c0b12';
    const s = G.t('streak', G.fmt(n));
    const fade = Math.min(1, (2.5 - (G.R.carnT || 0)) * 2);
    ctx.globalAlpha = Math.max(0, fade);
    const col = c.tier >= 4 ? '#ff4fe0' : c.tier >= 3 ? '#ff4f7e' : c.tier >= 2 ? '#ff7a2e' : c.tier >= 1 ? '#ffb347' : '#ffe27a';
    ctx.strokeText(s, W / 2, y); ctx.fillStyle = col; ctx.fillText(s, W / 2, y);
    // Carnage: the streak's bonus, and how far to the next step
    if (c.tier > 0 || n >= 30) {
      const y2 = y + 6;
      ctx.font = crisp(3) + 'px ' + FONT;
      const s2 = c.tier ? G.t('carnage', (1 + 0.1 * c.tier).toFixed(1)) : G.t('carnageAt', '1.1', c.next);
      ctx.strokeText(s2, W / 2, y2); ctx.fillStyle = c.tier ? col : '#a8a4b8'; ctx.fillText(s2, W / 2, y2);
      if (c.next) {
        const prev = [0, 100, 300, 800, 2000][c.tier] || 0, k = clamp((n - prev) / (c.next - prev), 0, 1), w = 30;
        ctx.fillStyle = '#0c0b12'; ctx.fillRect(W / 2 - w / 2 - 0.5, y2 + 2.5, w + 1, 2);
        ctx.fillStyle = col; ctx.fillRect(W / 2 - w / 2, y2 + 3, w * k, 1);
      }
    }
    ctx.globalAlpha = 1;
  }
  // 3.6: the boss bar never collides: it sits under whatever HUD is over its span, the name is cut to the room
  // the timer leaves it (the depth is in the land box already), the wounds line goes under the name
  let barY = 0, barBottom = 0, barFitK = '', barFitS = '';
  function fitText(str, maxW) {
    if (ctx.measureText(str).width <= maxW) return str;
    let lo = 0, hi = str.length;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (ctx.measureText(str.slice(0, mid) + '…').width <= maxW) lo = mid; else hi = mid - 1; }
    return lo > 0 ? str.slice(0, lo).trimEnd() + '…' : '';
  }
  function bossBarSpot() {
    const w = Math.min(W - 20, 170), x = Math.round((W - w) / 2);
    let y = Math.ceil(50 / S);
    for (const hb of hudBoxesNow()) if (hb.sel !== '.hud.bottom' && hb.sel !== '#toasts' && x < hb.x1 + 2 && x + w > hb.x0 - 2) y = Math.max(y, Math.ceil(hb.y1 + 8 / S));
    return { x, y, w };
  }
  function drawBossBar() {
    const b = G.R.boss;
    const { x, y, w } = bossBarSpot();
    barY = y;
    ctx.fillStyle = '#0c0b12'; ctx.fillRect(x - 1, y - 1, w + 2, 7);
    ctx.fillStyle = '#3a1a1e'; ctx.fillRect(x, y, w, 5);
    const k = clamp(b.hp / b.max, 0, 1);
    ctx.fillStyle = b.lord ? '#ff3b5c' : '#e84a4a'; ctx.fillRect(x, y, Math.round(w * k), 5);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x, y, Math.round(w * k), 1);
    ctx.font = crisp(4) + 'px ' + FONT; ctx.textBaseline = 'top';
    ctx.lineWidth = 1.2; ctx.strokeStyle = '#0c0b12';
    const tt = b.enr > 0 ? G.t('enrageT', Math.ceil(b.enr)) : Math.ceil(b.t) + 's';
    const tw = measureW(tt);
    const full = (b.affix && b.affix.length ? b.affix.map(a => G.t('aff_' + a)).join(' ') + ' ' : '') + G.L(G.bossName(b.d));
    const fk = full + '|' + Math.round((w - tw - 6) * 10) + '|' + crisp(4);
    if (fk !== barFitK) { barFitK = fk; barFitS = fitText(full, w - tw - 6); }
    ctx.textAlign = 'left';
    ctx.strokeText(barFitS, x, y + 8); ctx.fillStyle = b.lord ? '#ff9ab4' : '#ffffff'; ctx.fillText(barFitS, x, y + 8);
    ctx.textAlign = 'right';
    ctx.strokeText(tt, x + w, y + 8); ctx.fillStyle = b.enr > 0 || b.t < 6 ? '#ff4f4f' : '#ffe27a'; ctx.fillText(tt, x + w, y + 8);
    let bottom = y + 8 + crisp(4) + 1;
    if (b.scar < 1) {
      const ws = G.t('wounded', Math.round((1 - b.scar) * 100)) + (b.rally ? ' · ' + G.t('rally', Math.round(b.rally * 100)) : '');
      // on its own line under the name, so the two never overlap
      ctx.font = crisp(3) + 'px ' + FONT; ctx.textAlign = 'left';
      ctx.strokeText(ws, x, bottom + 1); ctx.fillStyle = '#ff9a7a'; ctx.fillText(ws, x, bottom + 1);
      bottom += crisp(3) + 2;
    }
    barBottom = bottom;
    const hpT = G.fmt(Math.max(0, b.hp)) + ' / ' + G.fmt(b.max);
    ctx.textAlign = 'center'; ctx.font = crisp(3) + 'px ' + FONT;
    ctx.fillStyle = '#ffffff'; ctx.fillText(hpT, x + w / 2, y + 1);
  }
  // the top of the boss sprite, for words over it
  function bossTop() { if (!bossVis) return btnPos().y - 40; return bossPos().y - bossHalf().h * 2; }
  // a word just over the boss's head (never up under the bar)
  function overBoss(sz) { const y = bossTop() - sz * 0.6 - 2; const lo = (barBottom || Math.ceil(50 / S) + 14) + sz * 0.6; return Math.max(lo, y); }
  // 3.6: DOOM reads from across the room: its name, a countdown and the taps left, big and pulsing
  function drawMoveName() {
    const b = G.R.boss;
    if (!b || !b.move || !bossVis) return;
    const M = G.BOSS_MOVES[b.move.k], bp = bossPos(), h = bossVis.sprite.canvas.height * bossScale();
    const doom = b.move.k === 'doom';
    ctx.font = crisp(doom ? 6 : 4) + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = doom ? 2.2 : 1.5; ctx.strokeStyle = '#0c0b12';
    const s = doom ? M.name + ' ' + Math.max(1, Math.ceil(b.move.t)) : M.name + ' · ' + G.t('tapIt', b.move.need - b.move.n);
    let y = bp.y - h - 18 + (Math.floor(time * 8) % 2);
    if (barBottom) y = Math.max(y, barBottom + (doom ? 6 : 4));
    // (under a card that is up over the boss's head)
    if (time < cardBlock.until) y = Math.max(y, cardBlock.y1 + (doom ? 7 : 5));
    ctx.strokeText(s, bp.x, y); ctx.fillStyle = doom ? (Math.floor(time * 6) % 2 ? '#ffffff' : M.col) : M.col; ctx.fillText(s, bp.x, y);
    if (doom) {
      ctx.font = crisp(3) + 'px ' + FONT; ctx.lineWidth = 1.5;
      const s2 = G.t('tapIt', b.move.need - b.move.n);
      ctx.strokeText(s2, bp.x, y + 8); ctx.fillStyle = '#ffd0f4'; ctx.fillText(s2, bp.x, y + 8);
    }
  }
  function drawReady(b) {
    const y = b.y - 44 + Math.sin(time * 5) * 1.5;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(SPR.get('ic_skull'), Math.round(b.x - 5), Math.round(y - 5));
    ctx.font = crisp(4) + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 1.2; ctx.strokeStyle = '#0c0b12';
    const s = G.t('bossReadyTap');
    if (cardT <= 0) ctx.strokeText(s, b.x, y - 9);
    if (cardT > 0) { ctx.restore(); return; } ctx.fillStyle = '#ff7a2e'; ctx.fillText(s, b.x, y - 9);
    ctx.restore();
  }
  function drawChestTip(c) {
    const v = vis.get(c.id); if (!v) return;
    const label = G.L(G.RARITIES[c.tier].name) + (c.mod ? ' · ' + G.L(G.MOD_BY_ID[c.mod].name) : '');
    ctx.font = crisp(3) + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 1; ctx.strokeStyle = '#0c0b12';
    const y = v.y - 19;
    ctx.strokeText(label, v.x, y); ctx.fillStyle = c.mod ? G.MOD_BY_ID[c.mod].color : rarityCol(c.tier); ctx.fillText(label, v.x, y);
  }
})(globalThis.G = globalThis.G || {});
