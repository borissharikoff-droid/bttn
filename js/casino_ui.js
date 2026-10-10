// BTTN 3.0 — casino_ui: the bubbles, the boost chips and the crit cascade on screen (3.6: no slot machine).
// The rules live in js/casino.js; this file only draws them, plays their sounds and takes the taps.
(function (G) {
  'use strict';
  if (typeof document === 'undefined') return;
  const $ = s => document.querySelector(s);
  const now = () => performance.now();

  // ---------- Art ----------
  function art() {
    const SPR = G.SPR;
    if (!SPR || SPR.defs.cs_bubble) return;
    // a soap bubble: a bright rim, a see-through middle and a glint
    const rows = [];
    for (let y = 0; y < 14; y++) {
      let r = '';
      for (let x = 0; x < 14; x++) {
        const d = Math.hypot(x - 6.5, y - 6.5);
        r += (x === 4 && y >= 3 && y <= 5) || (y === 3 && x === 5) ? 'w' : d > 6.9 ? '.' : d > 5.6 ? 'o' : 'i';
      }
      rows.push(r);
    }
    SPR.def('cs_bubble', { o: '#c8f8ff', i: 'rgba(90,200,255,0.42)', w: '#ffffff' }, rows);
  }

  // ---------- Sound: a tiny WebAudio box of its own (js/audio.js keeps its context private) ----------
  const Snd = (function () {
    let ac = null, out = null, nb = null;
    const last = {};
    function unlock() {
      try {
        if (!ac) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; ac = new AC(); out = ac.createGain(); out.connect(ac.destination); }
        if (ac.state === 'suspended') { const r = ac.resume(); if (r && r.catch) r.catch(() => { }); }
      } catch (e) { ac = null; }
    }
    const level = () => { const s = G.S && G.S.set; return s && s.sound ? (s.vol == null ? 0.6 : s.vol) * 0.5 : 0; };
    const ok = () => ac && ac.state === 'running' && level() > 0;
    const gate = (k, ms) => { const t = now(); if (last[k] && t - last[k] < ms) return false; last[k] = t; return true; };
    function tone(f, dur, type, vol, when, slide) {
      if (!ok()) return;
      out.gain.value = level();
      const t = ac.currentTime + (when || 0), o = ac.createOscillator(), g = ac.createGain();
      o.type = type || 'square'; o.frequency.setValueAtTime(f, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.1, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
    }
    function noise(dur, vol, when, freq, type) {
      if (!ok()) return;
      if (!nb) { nb = ac.createBuffer(1, ac.sampleRate * 0.4, ac.sampleRate); const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      const t = ac.currentTime + (when || 0), s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = nb; f.type = type || 'highpass'; f.frequency.value = freq || 1000;
      g.gain.setValueAtTime(vol || 0.1, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + dur + 0.02);
    }
    const note = n => 440 * Math.pow(2, (n - 9) / 12);
    return {
      unlock, note,
      bubble: () => { if (gate('bub', 200)) tone(500, 0.18, 'sine', 0.05, 0, 900); },
      pop: () => { tone(700, 0.08, 'sine', 0.09, 0, 1800); noise(0.05, 0.08, 0, 3000); [0, 4, 7, 12].forEach((s, i) => tone(note(26 + s), 0.08, 'triangle', 0.05, 0.06 + i * 0.04)); },
      fizz: () => { if (gate('fizz', 300)) noise(0.2, 0.03, 0, 4000); },
      cascade: n => { if (!gate('casc', 40)) return; const p = Math.min(n, 16); tone(note(10 + p * 2), 0.07, 'square', 0.045 + Math.min(0.04, p * 0.004)); if (n >= 5) tone(note(22 + p * 2), 0.06, 'triangle', 0.03, 0.03); },
      hot: () => { [0, 5, 9, 12, 17, 21, 24].forEach((s, i) => tone(note(24 + s), 0.08, 'square', 0.05, i * 0.035)); noise(0.3, 0.05, 0, 2000); },
    };
  })();
  const addSounds = () => {
    if (!G.Audio) return;
    Object.assign(G.Audio, { bubblePop: Snd.pop, cascadeTick: Snd.cascade });
  };

  // ---------- Style ----------
  const CSS = `
#csRoot { position: absolute; inset: 0; pointer-events: none; z-index: 4; overflow: hidden; }
#csRoot[hidden] { display: none; }
#csRoot img { image-rendering: pixelated; }
.csFloat { position: absolute; transform: translate(-50%, -100%); text-align: center; white-space: nowrap; pointer-events: none; animation: csRise 1.9s cubic-bezier(.2,.8,.3,1) forwards; }
.csFloat b { display: block; font: 16px/1.2 var(--font-display); color: var(--c, #ffd84a); text-shadow: 2px 2px 0 #0a0910, -2px -2px 0 #0a0910, 2px -2px 0 #0a0910, -2px 2px 0 #0a0910, 0 0 14px var(--c, #ffd84a); }
.csFloat small { display: block; margin-top: 3px; font: 15px/1.1 var(--font-body); color: #fff; text-shadow: 2px 2px 0 #0a0910, -1px -1px 0 #0a0910; }
.csFloat.small b { font-size: 13px; }
@keyframes csRise { 0% { transform: translate(-50%, -60%) scale(.3); opacity: 0; } 12% { transform: translate(-50%, -110%) scale(1.25); opacity: 1; } 22% { transform: translate(-50%, -105%) scale(1); } 75% { opacity: 1; } 100% { transform: translate(-50%, -190%) scale(1); opacity: 0; } }
.csSq { position: absolute; left: 0; top: 0; width: 4px; height: 4px; pointer-events: none; will-change: transform; }
.csBub { position: absolute; left: 0; top: 0; width: 60px; height: 60px; margin: -30px 0 0 -30px; padding: 0; border: 0; background: none; pointer-events: auto; cursor: pointer;
  touch-action: manipulation; -webkit-tap-highlight-color: transparent; will-change: transform, opacity; }
.csBub::before { content: ''; position: absolute; inset: 4px; border-radius: 50%; border: 2px solid rgba(191,246,255,.7); animation: csBubRing 1s ease-out infinite; }
@keyframes csBubRing { 0% { transform: scale(.8); opacity: .9; } 100% { transform: scale(1.35); opacity: 0; } }
.csBub img { position: absolute; left: 6px; top: 6px; width: 48px; height: 48px; animation: csBubGlow .7s steps(2) infinite; }
.csBub b { position: absolute; inset: 0; display: grid; place-items: center; padding-top: 2px; font: 18px/1 var(--font-display); color: #ffd84a; text-shadow: 1px 1px 0 #0a0910, -1px -1px 0 #0a0910, 1px -1px 0 #0a0910, -1px 1px 0 #0a0910; animation: csBubQ .7s steps(2) infinite; }
.csBub.in { animation: csBubIn .35s cubic-bezier(.2,1.8,.4,1) both; }
@keyframes csBubIn { from { scale: 0; } to { scale: 1; } }
@keyframes csBubGlow { 0% { filter: drop-shadow(0 0 5px #7fe9ff) drop-shadow(0 0 2px #fff); } 50% { filter: drop-shadow(0 0 12px #ffffff) drop-shadow(0 0 4px #ffd84a); } }
@keyframes csBubQ { 50% { color: #ffffff; transform: translateY(-1px); } }
.csChips { position: absolute; left: 50%; transform: translateX(-50%); display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; max-width: 92%; }
.csChip { position: relative; display: flex; align-items: center; gap: 5px; padding: 4px 7px 6px 5px; background: rgba(10,9,16,.85); border: 2px solid var(--c);
  box-shadow: 0 2px 0 #0a0910, 0 0 10px color-mix(in srgb, var(--c) 45%, transparent); animation: csChipIn .3s cubic-bezier(.2,1.8,.4,1); }
.csChip img { width: 16px; height: 16px; }
.csChip b { font: 8px/1 var(--font-display); color: var(--c); text-shadow: 1px 1px 0 #0a0910; white-space: nowrap; }
.csChip span { font: 8px/1 var(--font-display); color: #fff; text-shadow: 1px 1px 0 #0a0910; min-width: 2.2em; text-align: right; }
.csChip > i { position: absolute; left: 0; bottom: 0; height: 2px; background: var(--c); }
.csChip.low { animation: csChipLow .3s steps(2) infinite; }
@keyframes csChipIn { from { transform: scale(.3); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes csChipLow { 50% { opacity: .55; } }
/* 3.6: the crit chain sits in a fixed slot at the top left of the field, under the HUD: never on the Button or the
   party, never cut off at the edge (it was drawn beside the Button and grew up to 26px) */
.csCasc { position: absolute; left: 10px; top: 0; transform-origin: 0 50%; text-align: left; white-space: nowrap; pointer-events: none; max-width: calc(100% - 20px); }
.csCasc b { display: block; font: 11px/1 var(--font-display); color: var(--c, #ffe27a); text-shadow: 2px 2px 0 #0a0910, -2px -2px 0 #0a0910, 2px -2px 0 #0a0910, -2px 2px 0 #0a0910; transform-origin: 0 50%; }
.csCasc small { display: block; margin-top: 3px; font: 7px/1 var(--font-display); color: #fff; text-shadow: 1px 1px 0 #0a0910; letter-spacing: .05em; }
.csCasc.bump b { animation: csBump .2s cubic-bezier(.2,2,.4,1); }
@keyframes csBump { 0% { transform: scale(1.15); } 100% { transform: none; } }
.csCasc.end { transition: opacity .5s; opacity: 0; }
@media (prefers-reduced-motion: reduce) { .csChip.low, .csBub img, .csBub b { animation: none !important; } }
`;

  // ---------- Building ----------
  let root, chips, cascEl;
  const bubEls = new Map();
  const parts = [];
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function build() {
    const wrap = $('#stageWrap');
    if (!wrap || root) return !!root;
    art(); addSounds();
    const st = document.createElement('style'); st.id = 'csStyle'; st.textContent = CSS; document.head.appendChild(st);
    root = el('div'); root.id = 'csRoot';
    chips = el('div', 'csChips');
    cascEl = el('div', 'csCasc'); cascEl.hidden = true;
    root.append(chips, cascEl);
    wrap.appendChild(root);
    return true;
  }
  // ---------- Layout ----------
  let lay = null, layT = 0;
  function layout() {
    const wrap = $('#stageWrap'), wr = wrap.getBoundingClientRect();
    const hud = $('.hud.bottom'), top = $('.hud.top');
    const hudTop = hud ? hud.getBoundingClientRect().top - wr.top : wr.height - 90;
    let topY = 60;
    if (top) { const tr = top.getBoundingClientRect(); topY = tr.bottom - wr.top + 6; }
    const xp = $('#xpBar'); if (xp && !xp.hidden) topY = Math.max(topY, xp.getBoundingClientRect().bottom - wr.top + 4);
    lay = { w: wr.width, h: wr.height, left: wr.left, top: wr.top, bottom: wr.height - hudTop + 8, topY, phone: wr.width < 600 };
    chips.style.top = topY + 'px';
    layT = now();
  }
  const fmt = v => (G.fmt ? G.fmt(v) : String(Math.round(v)));
  // ---------- Floating text and particles ----------
  function floatText(x, y, t, s, c, cls) {
    const f = el('div', 'csFloat ' + (cls || ''));
    f.style.left = Math.round(x) + 'px'; f.style.top = Math.round(y) + 'px'; f.style.setProperty('--c', c);
    f.innerHTML = `<b></b>${s ? '<small></small>' : ''}`;
    f.querySelector('b').textContent = t; if (s) f.querySelector('small').textContent = s;
    root.appendChild(f);
    // (kept inside the field)
    const half = f.offsetWidth / 2 + 6;
    if (lay) f.style.left = Math.round(Math.max(half, Math.min(lay.w - half, x))) + 'px';
    f.addEventListener('animationend', () => f.remove());
    setTimeout(() => f.remove(), 4000);
  }
  function squares(x, y, n, cols) {
    for (let i = 0; i < n; i++) {
      if (parts.length > 110) { const o = parts.shift(); o.el.remove(); }
      const q = el('i', 'csSq'); q.style.background = cols[i % cols.length];
      const a = Math.random() * Math.PI * 2, sp = 80 + Math.random() * 180;
      parts.push({ el: q, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, g: 380, life: 0.45 + Math.random() * 0.4, rot: 0, r: 0 });
      root.appendChild(q);
    }
  }
  function stepParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { p.el.remove(); parts.splice(i, 1); continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.rot * dt;
      p.el.style.transform = `translate(${Math.round(p.x)}px,${Math.round(p.y)}px) rotate(${Math.round(p.r / 90) * 90}deg)`;
      p.el.style.opacity = Math.min(1, p.life * 3);
    }
  }

  // ---------- Bubbles ----------
  // where a bubble sits on screen, in #stageWrap pixels; floats up and sways, kept off the Button
  function bubXY(b) {
    const St = G.Stage;
    if (!St || !St.mobPoint) return null;
    const q = St.mobPoint({ id: -1, a: b.a, p: b.p });
    let x = q.x - lay.left, y = q.y - lay.top - 6 - b.t * 13;
    x += Math.sin(b.t * 2.4 + b.ph * 6) * 7;
    if (St.btnPos && St.toScreen) {
      const c = St.btnPos(), bc = St.toScreen(c.x, c.y);
      const bx = bc.x - lay.left, by = bc.y - lay.top - 8, rx = lay.phone ? 66 : 84, ry = lay.phone ? 52 : 64;
      const dx = x - bx, dy = y - by, d = Math.hypot(dx / rx, dy / ry);
      if (d < 1) { const k = 1 / Math.max(0.2, d); x = bx + (dx || 1) * k; y = by + dy * k; }
    }
    return { x: Math.max(26, Math.min(lay.w - 26, x)), y: Math.max(lay.topY + 20, Math.min(lay.h - lay.bottom - 20, y)) };
  }
  function bubbleEl(b) {
    let e = bubEls.get(b.id);
    if (e) return e;
    e = el('button', 'csBub in', '<img alt=""><b>?</b>');
    e.type = 'button'; e.setAttribute('aria-label', 'Bonus bubble');
    e.querySelector('img').src = G.SPR.url('cs_bubble', 3);
    e.addEventListener('pointerdown', ev => {
      ev.preventDefault(); ev.stopPropagation();
      Snd.unlock(); if (G.Audio && G.Audio.unlock) G.Audio.unlock();
      G.popBubble(b.id);
    });
    root.appendChild(e);
    bubEls.set(b.id, e);
    Snd.bubble();
    return e;
  }
  function stepBubbles() {
    const list = G.bubbles || [];
    const live = new Set();
    for (const b of list) {
      live.add(b.id);
      const e = bubbleEl(b), p = bubXY(b);
      if (!p) continue;
      b._x = p.x; b._y = p.y;
      e.style.transform = `translate(${Math.round(p.x)}px,${Math.round(p.y)}px)`;
      const left = b.life - b.t;
      e.style.opacity = left < 1.6 ? (Math.floor(left * 8) % 2 ? 0.35 : 0.9) : 1;
    }
    for (const [id, e] of bubEls) if (!live.has(id)) { e.remove(); bubEls.delete(id); }
  }
  function onPop(b, res) {
    const e = bubEls.get(b.id);
    const x = b._x != null ? b._x : lay.w / 2, y = b._y != null ? b._y : lay.h / 2;
    if (e) { e.remove(); bubEls.delete(b.id); }
    const I = G.BUBBLE_INFO[res.kind] || { col: '#fff', name: res.kind, sub: '' };
    floatText(x, y - 10, I.name, res.kind === 'magnet' && res.n ? res.n + ' grabbed' : res.kind === 'purse' && res.n ? '+' + fmt(res.n) + ' gold' : I.sub, I.col, 'small');
    squares(x, y, 18, ['#bff6ff', '#ffffff', I.col]);
    Snd.pop();
  }

  // ---------- Boost chips ----------
  let chipKey = '';
  function stepChips() {
    const list = G.casinoBoosts ? G.casinoBoosts() : [];
    const key = list.map(b => b.id).join(',');
    if (key !== chipKey) {
      chipKey = key;
      chips.innerHTML = list.map(b => `<div class="csChip" data-b="${b.id}" style="--c:${b.col}"><img alt="" src="${G.SPR.url(b.icon, 2)}"><b>${b.name}</b><span></span><i></i></div>`).join('');
    }
    // (3.6: written only when the shown value changes: whole seconds, whole percent)
    for (const b of list) {
      const c = chips.querySelector(`[data-b="${b.id}"]`);
      if (!c) continue;
      const sec = Math.ceil(b.t) + 's', w = Math.round(Math.max(0, Math.min(100, b.t / b.T * 100))) + '%', low = b.t < 2.5;
      if (c._s !== sec) { c._s = sec; c.querySelector('span').textContent = sec; }
      if (c._w !== w) { c._w = w; c.querySelector('i').style.width = w; }
      if (c._l !== low) { c._l = low; c.classList.toggle('low', low); }
    }
  }

  // ---------- Crit cascade ----------
  // 3.6: a small counter in a fixed slot under the top HUD (left), shown from a chain of CASC_SHOW on; it pulses
  // only at the milestones (x10, x25, x50, x100...) and the text is written only when it changes
  const CASC_SHOW = 5;
  let cascN = 0, cascEndT = 0, cascTxt = '', cascCol = '';
  const CASC_COL = n => (n >= 25 ? '#ff7ae6' : n >= 10 ? '#ff3b5c' : n >= 7 ? '#ff9a2e' : '#ffe27a');
  const milestone = n => n === 10 || n === 25 || n === 50 || (n >= 100 && n % 50 === 0);
  function cascTop() { return Math.round((lay ? lay.topY : 60) + (chipKey ? 30 : 4)); }
  function onCascade(n, mul) {
    cascN = n;
    if (n < CASC_SHOW || !build()) return;
    if (!lay) layout();
    cascEndT = 0;
    if (cascEl.hidden || cascEl.classList.contains('end')) { cascEl.classList.remove('end'); cascEl.hidden = false; }
    const top = cascTop() + 'px';
    if (cascEl.style.top !== top) cascEl.style.top = top;
    const col = CASC_COL(n);
    if (col !== cascCol) { cascCol = col; cascEl.style.setProperty('--c', col); }
    const txt = `<b>CRIT ×${n}</b><small>${n >= 10 ? 'HOT STREAK!' : '+' + Math.round((mul - 1) * 100) + '% DMG'}</small>`;
    if (txt !== cascTxt) { cascTxt = txt; cascEl.innerHTML = txt; }
    if (milestone(n)) { cascEl.classList.remove('bump'); void cascEl.offsetWidth; cascEl.classList.add('bump'); }
    Snd.cascade(n);
  }
  function onCascadeEnd(n) {
    if (!cascEl || cascEl.hidden) return;
    if (n >= CASC_SHOW) { const sm = cascEl.querySelector('small'); if (sm) sm.textContent = '×' + n + ' CHAIN!'; cascTxt = ''; }
    cascEl.classList.add('end');
    cascEndT = now() + 520;
  }
  // a hot streak: the counter already says so; just the sound (3.6: the float beside the Button is gone)
  function onHot() { Snd.hot(); }

  // ---------- Every frame ----------
  let lastF = 0;
  function frame() {
    requestAnimationFrame(frame);
    try { step(); } catch (e) { if (!frame.err) { frame.err = 1; console.error(e); } }
  }
  function step() {
    const t = now(), dt = Math.min(0.05, (t - (lastF || t)) / 1000); lastF = t;
    if (!G.S || !G.casino || !build()) return;
    const R = G.R;
    const away = R.town || !(G.S.hero && G.S.hero.cls) || (G.casinoHold && G.casinoHold('all'));
    // (4.0 uifix: written only when it changes - every frame it was the one DOM mutation of the idle town, 60/s)
    if (root.hidden !== !!away) root.hidden = !!away;
    if (away) return;
    // (3.6: the layout is read only on a resize or while something is on screen to place, at most every 300 ms)
    const live = (G.bubbles && G.bubbles.length) || bubEls.size || chipKey || parts.length || (G.casinoBoosts && G.casinoBoosts().length);
    if (!lay || (live && t - layT > 300)) layout();
    if (!live && !parts.length) { if (cascEndT && t >= cascEndT) { cascEndT = 0; cascEl.hidden = true; cascEl.classList.remove('end'); } return; }
    stepBubbles();
    stepChips();
    stepParts(dt);
    if (cascEndT && t >= cascEndT) { cascEndT = 0; cascEl.hidden = true; cascEl.classList.remove('end'); }
  }

  // ---------- Wiring ----------
  // the bubbles and the cascade wait out the tutorial (3.6: all of it, not only its first steps)
  const tutOn = () => typeof G.S.tut === 'number' && G.S.tut >= 0;
  G.casinoHold = () => tutOn();
  G.on('bubblePop', (b, res) => { if (build()) { if (!lay) layout(); onPop(b, res); } });
  // a missed bubble fades away
  G.on('bubbleGone', b => { const e = bubEls.get(b.id); if (e) { Snd.fizz(); bubEls.delete(b.id); e.style.pointerEvents = 'none'; e.style.transition = 'opacity .4s'; e.style.opacity = '0'; setTimeout(() => e.remove(), 420); } });
  G.on('cascade', (n, mul) => onCascade(n, mul));
  G.on('cascadeEnd', n => onCascadeEnd(n));
  G.on('hotStreak', n => onHot(n));
  window.addEventListener('pointerdown', () => Snd.unlock(), { capture: true, passive: true });
  window.addEventListener('keydown', () => Snd.unlock(), { capture: true, passive: true });
  window.addEventListener('resize', () => { if (root) layout(); });
  requestAnimationFrame(frame);
})(globalThis.G = globalThis.G || {});
