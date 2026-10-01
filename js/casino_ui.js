// BTTN 3.0 — casino_ui: the slot machine, the bubbles, the boost chips and the crit cascade on screen.
// The rules live in js/casino.js; this file only draws them, plays their sounds and takes the taps.
(function (G) {
  'use strict';
  if (typeof document === 'undefined') return;
  const $ = s => document.querySelector(s);
  const now = () => performance.now();

  // ---------- Art ----------
  function art() {
    const SPR = G.SPR;
    if (!SPR || SPR.defs.cs_seven) return;
    SPR.def('cs_seven', { r: '#ff3b5c', R: '#a8102c', w: '#ffd0d8' }, [
      'wwwwwww.',
      'rrrrrrR.',
      '....rR..',
      '...rR...',
      '..rrR...',
      '..rR....',
      '.rrR....',
      '.RR.....',
    ]);
    SPR.def('cs_gem', { p: '#c78bff', P: '#7a3fd0', q: '#a060f0', w: '#f4e8ff' }, [
      '..pppp..',
      '.pwwpqp.',
      'pwppqqpP',
      'PPPPPPPP',
      '.PpqqpP.',
      '..PqpP..',
      '...PP...',
      '........',
    ]);
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
    // the machine's little icon for the meter
    SPR.def('cs_slot', { r: '#ff3b5c', y: '#ffd84a', Y: '#c98f10', k: '#2a1f3a', w: '#fffbe8' }, [
      'yyyyyyy.',
      'Ywwwwwyr',
      'Ywrwrwy.',
      'Ywwwwwy.',
      'yyyyyyy.',
      'YkkkkkY.',
      'YYYYYYY.',
      '........',
    ]);
  }
  const SYM_ICON = { coin: 'ic_coin', chest: 'ic_chest', bolt: 'ic_bolt', skull: 'ic_skull', gem: 'cs_gem', seven: 'cs_seven' };
  const symUrl = s => G.SPR.url(SYM_ICON[s], 4);

  // ---------- Sound: a tiny WebAudio box of its own (js/audio.js keeps its context private) ----------
  const Snd = (function () {
    let ac = null, out = null, nb = null;
    const last = {};
    function unlock() {
      try {
        if (!ac) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; ac = new AC(); out = ac.createGain(); out.connect(ac.destination); }
        if (ac.state === 'suspended') ac.resume();
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
      tick: i => { if (gate('tick', 28)) tone(1500 + i * 260, 0.018, 'square', 0.035); },
      thunk: i => { tone(170 - i * 20, 0.11, 'square', 0.09, 0, 60); noise(0.08, 0.12, 0, 900, 'lowpass'); },
      lever: () => { noise(0.18, 0.05, 0, 1800); tone(320, 0.16, 'triangle', 0.06, 0, 120); },
      ready: () => { [0, 7, 12].forEach((s, i) => tone(note(24 + s), 0.09, 'square', 0.05, i * 0.08)); },
      tease: () => { tone(220, 0.95, 'sawtooth', 0.035, 0, 880); [0, 0.24, 0.48, 0.72].forEach((w, i) => noise(0.07, 0.07, w, 200, 'lowpass')); },
      miss: () => { tone(330, 0.16, 'triangle', 0.06, 0, 300); tone(262, 0.3, 'triangle', 0.06, 0.16, 200); },
      win: n => {
        const seq = n >= 3 ? [0, 4, 7, 12, 16, 19, 24, 28] : [0, 4, 7, 12];
        seq.forEach((s, i) => tone(note(14 + s), 0.12, 'square', 0.06, i * 0.06));
        const k = n >= 3 ? 14 : 5;
        for (let i = 0; i < k; i++) tone(1320 + (i % 3) * 220, 0.05, 'triangle', 0.04, 0.3 + i * 0.07);
      },
      jackpot: () => {
        [0, 4, 7, 12, 7, 12, 16, 19, 24].forEach((s, i) => tone(note(12 + s), 0.18, 'square', 0.07, i * 0.09));
        tone(note(36), 0.9, 'triangle', 0.06, 0.85);
        for (let i = 0; i < 26; i++) tone(1200 + (i % 4) * 240, 0.05, 'triangle', 0.04, 0.5 + i * 0.06);
        noise(0.6, 0.06, 0.8, 2500);
      },
      bubble: () => { if (gate('bub', 200)) tone(500, 0.18, 'sine', 0.05, 0, 900); },
      pop: () => { tone(700, 0.08, 'sine', 0.09, 0, 1800); noise(0.05, 0.08, 0, 3000); [0, 4, 7, 12].forEach((s, i) => tone(note(26 + s), 0.08, 'triangle', 0.05, 0.06 + i * 0.04)); },
      fizz: () => { if (gate('fizz', 300)) noise(0.2, 0.03, 0, 4000); },
      cascade: n => { if (!gate('casc', 40)) return; const p = Math.min(n, 16); tone(note(10 + p * 2), 0.07, 'square', 0.045 + Math.min(0.04, p * 0.004)); if (n >= 5) tone(note(22 + p * 2), 0.06, 'triangle', 0.03, 0.03); },
      hot: () => { [0, 5, 9, 12, 17, 21, 24].forEach((s, i) => tone(note(24 + s), 0.08, 'square', 0.05, i * 0.035)); noise(0.3, 0.05, 0, 2000); },
    };
  })();
  const addSounds = () => {
    if (!G.Audio) return;
    Object.assign(G.Audio, { slotTick: Snd.tick, slotThunk: Snd.thunk, slotWin: Snd.win, slotMiss: Snd.miss, slotJackpot: Snd.jackpot, bubblePop: Snd.pop, cascadeTick: Snd.cascade });
  };

  // ---------- Style ----------
  const CSS = `
#csRoot { position: absolute; inset: 0; pointer-events: none; z-index: 4; overflow: hidden; }
#csRoot[hidden] { display: none; }
#csRoot img { image-rendering: pixelated; }
.csM { position: absolute; left: 50%; bottom: 0; transform-origin: 50% 100%; transition: left .25s; pointer-events: auto; cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
.csM[hidden] { display: none; }
.csPop { position: relative; animation: csIn .42s cubic-bezier(.2,1.7,.4,1) both; }
.csM.out .csPop { animation: csOut .32s ease-in forwards; }
@keyframes csIn { 0% { transform: translateY(40px) scale(.4); opacity: 0; } 100% { transform: none; opacity: 1; } }
@keyframes csOut { to { transform: translateY(30px) scale(.6); opacity: 0; } }
.csCab { position: relative; padding: 4px 6px 5px; background: linear-gradient(#4a2a5e, #2a1838 60%, #1e1228); border: 3px solid #0a0910;
  box-shadow: inset 0 0 0 2px #ffd84a, inset 0 0 0 4px #8a5a10, 0 4px 0 #0a0910, 0 0 24px rgba(255,216,74,.25); }
.csM.ready .csCab { animation: csGlow .6s steps(2) infinite; }
@keyframes csGlow { 50% { box-shadow: inset 0 0 0 2px #fff3b0, inset 0 0 0 4px #c98f10, 0 4px 0 #0a0910, 0 0 34px rgba(255,216,74,.6); } }
.csM.shake .csCab { animation: csShake .12s steps(2) 2; }
@keyframes csShake { 50% { transform: translateX(-2px); } }
.csTop { display: flex; align-items: center; justify-content: center; gap: 5px; height: 14px; margin-bottom: 3px; }
.csTop b { font: 8px/1 var(--font-display); color: #ffd84a; letter-spacing: .06em; text-shadow: 1px 1px 0 #0a0910, 0 0 6px rgba(255,216,74,.6); white-space: nowrap; }
.csBulbs { display: flex; gap: 3px; }
.csBulbs i, .csFootB i { width: 4px; height: 4px; background: #6a4a20; box-shadow: 0 0 0 1px #0a0910; }
.csBulbs i:nth-child(odd), .csFootB i:nth-child(odd) { animation: csBlink .5s steps(1) infinite; }
.csBulbs i:nth-child(even), .csFootB i:nth-child(even) { animation: csBlink .5s steps(1) infinite .25s; }
.csM.spin .csBulbs i, .csM.spin .csFootB i { animation-duration: .16s; }
.csM.win .csBulbs i, .csM.win .csFootB i { animation: csBlinkW .12s steps(1) infinite; }
@keyframes csBlink { 0% { background: #ffd84a; box-shadow: 0 0 0 1px #0a0910, 0 0 6px #ffd84a; } 50% { background: #6a4a20; box-shadow: 0 0 0 1px #0a0910; } }
@keyframes csBlinkW { 0% { background: #ffffff; box-shadow: 0 0 0 1px #0a0910, 0 0 8px #fff; } 50% { background: #ff3b5c; box-shadow: 0 0 0 1px #0a0910, 0 0 8px #ff3b5c; } }
.csWin { position: relative; display: flex; gap: 4px; padding: 3px; background: #0a0910; box-shadow: inset 0 0 0 1px #3a2a10; }
.csReel { position: relative; width: 46px; height: 60px; overflow: hidden; background: linear-gradient(#a89f8c, #fffbe8 28%, #fffbe8 72%, #a89f8c); box-shadow: inset 0 0 0 2px #0a0910; }
.csReel::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(rgba(10,9,16,.55), transparent 26%, transparent 74%, rgba(10,9,16,.55)); }
.csBob { position: absolute; inset: 0; }
.csBob.thunk { animation: csThunk .2s cubic-bezier(.3,2,.5,1); }
@keyframes csThunk { 0% { transform: translateY(5px); } 100% { transform: none; } }
.csStrip { position: absolute; left: 0; top: 0; width: 100%; will-change: transform; }
.csStrip img { display: block; width: 40px; height: 40px; margin: 0 auto 4px; }
.csReel.blur .csStrip img { opacity: .75; transform: scaleY(1.25); }
.csReel.tease { box-shadow: inset 0 0 0 2px #ff3b5c; animation: csTease .18s steps(2) infinite; }
@keyframes csTease { 50% { box-shadow: inset 0 0 0 2px #ffd84a, 0 0 10px #ffd84a; } }
.csReel.hit { animation: csHit .22s steps(2) infinite; }
@keyframes csHit { 50% { background: linear-gradient(#ffd84a, #fff7c0 28%, #fff7c0 72%, #ffd84a); box-shadow: inset 0 0 0 2px #ff3b5c; } }
.csLine { position: absolute; left: 1px; right: 1px; top: 50%; height: 2px; margin-top: -1px; background: rgba(255,59,92,.55); pointer-events: none; }
.csFoot { display: flex; align-items: center; justify-content: center; gap: 5px; height: 13px; margin-top: 4px; }
.csFoot b { font: 7px/1 var(--font-display); color: #fff; text-shadow: 1px 1px 0 #0a0910; white-space: nowrap; }
.csM.ready .csFoot b { color: #ffd84a; animation: csCall .5s steps(1) infinite; }
@keyframes csCall { 50% { color: #fff; } }
.csFootB { display: flex; gap: 3px; }
.csAuto { position: absolute; left: 6px; right: 6px; bottom: 2px; height: 2px; background: rgba(0,0,0,.4); }
.csAuto > i { display: block; height: 100%; background: #ff7ae6; }
.csLever { position: absolute; right: -13px; top: 18px; width: 10px; height: 52px; }
.csLever .st { position: absolute; left: 3px; top: 8px; width: 4px; height: 36px; background: #c8ccd8; box-shadow: 0 0 0 2px #0a0910; transform-origin: 50% 100%; transition: transform .12s; }
.csLever .ba { position: absolute; left: -1px; top: 0; width: 12px; height: 12px; background: #ff3b5c; box-shadow: 0 0 0 2px #0a0910, inset -3px -3px 0 #a8102c, inset 2px 2px 0 #ffb0c0; transition: transform .12s; }
.csLever .bs { position: absolute; left: -2px; bottom: 0; width: 14px; height: 8px; background: #6a4a20; box-shadow: 0 0 0 2px #0a0910; }
.csM.pull .csLever .st { transform: scaleY(-.2); }
.csM.pull .csLever .ba { transform: translateY(40px); }
.csPill { position: absolute; left: 50%; bottom: 0; transform: translateX(-50%); display: flex; align-items: center; gap: 5px; padding: 3px 6px 3px 4px;
  background: rgba(10,9,16,.78); border: 2px solid #0a0910; box-shadow: inset 0 0 0 1px #ffd84a66; }
.csPill[hidden] { display: none; }
.csPill img { width: 20px; height: 20px; }
.csPill .bar { position: relative; width: 84px; height: 8px; background: #2a1f3a; box-shadow: 0 0 0 1px #0a0910; }
.csPill .bar > i { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(#ffe27a, #ff9a2e); }
.csPill b { font: 7px/1 var(--font-display); color: #ffd84a; text-shadow: 1px 1px 0 #0a0910; }
.csPill.hot { animation: csPill .5s steps(2) infinite; }
@keyframes csPill { 50% { box-shadow: inset 0 0 0 1px #ffd84a, 0 0 10px rgba(255,216,74,.6); } }
.csFloat { position: absolute; transform: translate(-50%, -100%); text-align: center; white-space: nowrap; pointer-events: none; animation: csRise 1.9s cubic-bezier(.2,.8,.3,1) forwards; }
.csFloat b { display: block; font: 16px/1.2 var(--font-display); color: var(--c, #ffd84a); text-shadow: 2px 2px 0 #0a0910, -2px -2px 0 #0a0910, 2px -2px 0 #0a0910, -2px 2px 0 #0a0910, 0 0 14px var(--c, #ffd84a); }
.csFloat small { display: block; margin-top: 3px; font: 15px/1.1 var(--font-body); color: #fff; text-shadow: 2px 2px 0 #0a0910, -1px -1px 0 #0a0910; }
.csFloat.big b { font-size: 24px; }
.csFloat.huge b { font-size: 30px; animation: csRainbow .3s steps(3) infinite; }
.csFloat.small b { font-size: 13px; }
@keyframes csRise { 0% { transform: translate(-50%, -60%) scale(.3); opacity: 0; } 12% { transform: translate(-50%, -110%) scale(1.25); opacity: 1; } 22% { transform: translate(-50%, -105%) scale(1); } 75% { opacity: 1; } 100% { transform: translate(-50%, -190%) scale(1); opacity: 0; } }
@keyframes csRainbow { 0% { color: #ffd84a; } 33% { color: #ff3b5c; } 66% { color: #ffffff; } }
.csFloat.long { animation-duration: 3.2s; }
.csP { position: absolute; left: 0; top: 0; width: 18px; height: 18px; margin: -9px 0 0 -9px; pointer-events: none; will-change: transform; }
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
.csCasc { position: absolute; transform: translate(-50%, -50%); text-align: center; white-space: nowrap; pointer-events: none; }
.csCasc b { display: block; font: 12px/1 var(--font-display); color: var(--c, #ffe27a); text-shadow: 2px 2px 0 #0a0910, -2px -2px 0 #0a0910, 2px -2px 0 #0a0910, -2px 2px 0 #0a0910, 0 0 10px var(--c, #ffe27a); }
.csCasc small { display: block; margin-top: 2px; font: 7px/1 var(--font-display); color: #fff; text-shadow: 1px 1px 0 #0a0910; letter-spacing: .05em; }
.csCasc.bump b { animation: csBump .18s cubic-bezier(.2,2,.4,1); }
@keyframes csBump { 0% { transform: scale(1.7); } 100% { transform: none; } }
.csCasc.end { transition: opacity .5s, transform .5s; opacity: 0; transform: translate(-50%, -110%); }
.csGold { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(circle at 50% 70%, rgba(255,216,74,.55), rgba(255,160,40,.15) 60%, transparent); animation: csGoldF 1.4s ease-out forwards; }
@keyframes csGoldF { 0% { opacity: 0; } 10% { opacity: 1; } 100% { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .csBulbs i, .csFootB i, .csReel.hit, .csReel.tease, .csChip.low, .csBub img, .csBub b { animation: none !important; } }
`;

  // ---------- Building ----------
  let root, mEl, popEl, reels = [], pill, pillFill, chips, cascEl, footTxt, autoFill;
  const bubEls = new Map();
  const parts = [];
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function build() {
    const wrap = $('#stageWrap');
    if (!wrap || root) return !!root;
    art(); addSounds();
    const st = document.createElement('style'); st.id = 'csStyle'; st.textContent = CSS; document.head.appendChild(st);
    root = el('div'); root.id = 'csRoot';
    const bulbs = n => `<span class="csBulbs">${'<i></i>'.repeat(n)}</span>`;
    mEl = el('div', 'csM'); mEl.hidden = true;
    mEl.setAttribute('role', 'button'); mEl.setAttribute('aria-label', 'Lucky spin');
    mEl.innerHTML = `<div class="csPop"><div class="csCab"><div class="csTop">${bulbs(4)}<b>LUCKY SPIN</b>${bulbs(4)}</div>
      <div class="csWin">${'<div class="csReel"><div class="csBob"><div class="csStrip"></div></div></div>'.repeat(3)}<i class="csLine"></i></div>
      <div class="csFoot"><span class="csFootB">${'<i></i>'.repeat(3)}</span><b class="csCall">TAP TO SPIN</b><span class="csFootB">${'<i></i>'.repeat(3)}</span></div>
      <div class="csAuto"><i></i></div></div>
      <div class="csLever"><i class="bs"></i><i class="st"></i><i class="ba"></i></div></div>`;
    popEl = mEl.querySelector('.csPop');
    footTxt = mEl.querySelector('.csCall');
    autoFill = mEl.querySelector('.csAuto > i');
    reels = [...mEl.querySelectorAll('.csReel')].map(r => ({ el: r, bob: r.querySelector('.csBob'), strip: r.querySelector('.csStrip'), syms: [], pos: 0, lastI: -1, stopped: true }));
    mEl.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); pull('tap'); });
    pill = el('div', 'csPill', `<img alt=""><span class="bar"><i></i></span><b>SPIN</b>`); pill.hidden = true;
    pill.querySelector('img').src = G.SPR.url('cs_slot', 2);
    pillFill = pill.querySelector('.bar > i');
    chips = el('div', 'csChips');
    cascEl = el('div', 'csCasc'); cascEl.hidden = true;
    root.append(chips, pill, mEl, cascEl);
    wrap.appendChild(root);
    for (let i = 0; i < 3; i++) setStrip(reels[i], [rndSym(), rndSym(), rndSym()], 1);
    return true;
  }
  const rndSym = () => G.SLOT_SYMS[Math.floor(Math.random() * G.SLOT_SYMS.length)];
  const CELL = 44, WIN_H = 60;
  function setStrip(r, syms, pos) {
    r.syms = syms;
    r.strip.innerHTML = syms.map(s => `<img alt="" src="${symUrl(s)}">`).join('');
    r.pos = pos; r.lastI = Math.round(pos);
    placeStrip(r);
  }
  function placeStrip(r) { r.strip.style.transform = `translateY(${Math.round(WIN_H / 2 - (r.pos * CELL + 20))}px)`; }

  // ---------- Layout ----------
  let lay = null, layT = 0;
  function layout() {
    const wrap = $('#stageWrap'), wr = wrap.getBoundingClientRect();
    const hud = $('.hud.bottom'), top = $('.hud.top');
    const hudTop = hud ? hud.getBoundingClientRect().top - wr.top : wr.height - 90;
    let topY = 60;
    if (top) { const tr = top.getBoundingClientRect(); topY = tr.bottom - wr.top + 6; }
    const xp = $('#xpBar'); if (xp && !xp.hidden) topY = Math.max(topY, xp.getBoundingClientRect().bottom - wr.top + 4);
    // keep clear of the Button (and the Warden at its feet)
    let btnBottom = wr.height * 0.6;
    const St = G.Stage;
    if (St && St.btnPos && St.toScreen) { const b = St.btnPos(); btnBottom = St.toScreen(b.x, b.y + 16).y - wr.top; }
    const room = hudTop - 8 - (btnBottom + 4);
    const natH = 104, natW = 200;
    let k = Math.max(0.62, Math.min(wr.width > 700 ? 1.3 : 0.88, room / natH)), cx = wr.width / 2;
    // 3.0: no room under the Button (a phone): a smaller machine in the bottom-right corner, off the Button and the boss
    if (room < natH * 0.8) { k = Math.min(0.6, (wr.width * 0.4) / natW); cx = wr.width - natW * k / 2 - 6; }
    // the level-up cards take the bottom middle of the field on wide screens: step aside for them
    const pk = $('#perks');
    if (pk && !pk.hidden) {
      const pr = pk.getBoundingClientRect();
      if (pr.width && pr.top < wr.bottom && pr.bottom > wr.top + hudTop - natH * k - 20) {
        const L = pr.left - wr.left, Rt = wr.right - pr.right, sp = Math.max(L, Rt);
        if (sp - 16 < natW * k) k = Math.max(0.62, (sp - 16) / natW);
        cx = L >= Rt ? L / 2 : wr.width - Rt / 2;
      }
    }
    lay = { w: wr.width, h: wr.height, left: wr.left, top: wr.top, bottom: wr.height - hudTop + 8, k, topY, phone: wr.width < 600 };
    mEl.style.bottom = lay.bottom + 'px';
    mEl.style.left = Math.round(cx) + 'px';
    mEl.style.transform = `translateX(-50%) scale(${k})`;
    pill.style.bottom = (lay.bottom - 2) + 'px';
    chips.style.top = topY + 'px';
    layT = now();
  }
  const machineTop = () => { const r = mEl.getBoundingClientRect(); return { x: r.left + r.width / 2 - lay.left, y: r.top - lay.top, w: r.width, h: r.height }; };

  // ---------- The spin ----------
  let shown = null, hideAt = 0, mode = 'off', stopsDone = 0, teaseOn = false;
  function show(on) {
    if (on) {
      if (mEl.hidden || mEl.classList.contains('out')) { mEl.hidden = false; mEl.classList.remove('out'); popEl.style.animation = 'none'; void popEl.offsetWidth; popEl.style.animation = ''; }
    } else if (!mEl.hidden && !mEl.classList.contains('out')) {
      mEl.classList.add('out');
      setTimeout(() => { if (mEl.classList.contains('out')) { mEl.hidden = true; mEl.classList.remove('out'); } }, 330);
    }
  }
  function pull(how) {
    Snd.unlock(); if (G.Audio && G.Audio.unlock) G.Audio.unlock();
    if (!G.spinReady()) return false;
    return !!G.spin(how);
  }
  function setMode(m) {
    mode = m;
    mEl.classList.toggle('ready', m === 'ready');
    mEl.classList.toggle('spin', m === 'spin');
    mEl.classList.toggle('win', m === 'win');
  }
  function onReady() {
    if (!build()) return;
    layout();
    for (const r of reels) r.el.classList.remove('hit', 'tease', 'blur');
    setMode('ready'); footTxt.textContent = lay.phone ? 'TAP TO SPIN' : 'TAP TO SPIN · R';
    show(true); Snd.ready();
  }
  function onStart(res) {
    if (!build()) return;
    layout();
    shown = res; stopsDone = 0; teaseOn = false; hideAt = 0;
    show(true); setMode('spin'); footTxt.textContent = 'GOOD LUCK!';
    mEl.classList.add('pull'); setTimeout(() => mEl.classList.remove('pull'), 260);
    Snd.lever();
    // each reel gets a long strip of symbols ending on the one it lands on
    reels.forEach((r, i) => {
      const n = 12 + i * 6 + (i === 2 && res.tease ? 9 : 0);
      const cur = r.syms[Math.round(r.pos)] || rndSym();
      const syms = [rndSym(), res.reels[i]];
      for (let k = 0; k < n; k++) syms.push(rndSym());
      syms.push(cur, rndSym());
      setStrip(r, syms, syms.length - 2);
      r.start = r.pos; r.stopped = false;
      r.el.classList.remove('hit', 'tease'); r.el.classList.add('blur');
    });
  }
  const easeOut = (u, p) => 1 - Math.pow(1 - u, p);
  function stepReels() {
    const res = shown;
    if (!res || mode !== 'spin') return;
    const t = res.t;
    reels.forEach((r, i) => {
      if (r.stopped) return;
      const stop = res.stops[i];
      if (t >= stop) {
        r.pos = 1; r.stopped = true; placeStrip(r);
        r.el.classList.remove('blur', 'tease');
        r.bob.classList.remove('thunk'); void r.bob.offsetWidth; r.bob.classList.add('thunk');
        mEl.classList.remove('shake'); void mEl.offsetWidth; mEl.classList.add('shake');
        Snd.thunk(i);
        stopsDone = i + 1;
        // two alike: the last reel keeps you waiting
        if (i === 1 && res.tease && !teaseOn) { teaseOn = true; reels[2].el.classList.add('tease'); Snd.tease(); footTxt.textContent = res.reels[0] === 'seven' ? '7 7 ...?' : 'ONE MORE...'; }
        return;
      }
      const u = t / stop, tease = i === 2 && res.tease;
      r.pos = r.start + (1 - r.start) * easeOut(u, tease ? 5 : 3);
      if (u > (tease ? 0.75 : 0.6)) r.el.classList.remove('blur');
      const ii = Math.round(r.pos);
      if (ii !== r.lastI) { r.lastI = ii; Snd.tick(i); }
      placeStrip(r);
    });
  }
  const fmt = v => (G.fmt ? G.fmt(v) : String(Math.round(v)));
  function resultText(res) {
    const p = res.paid || {}, I = G.SLOT_INFO[res.sym] || {};
    if (!res.n) return { t: 'NO LUCK', s: 'next time...', c: '#c8c0d8', cls: 'small' };
    if (res.jackpot) return { t: '777 JACKPOT!', s: '×10 · +' + fmt(p.gold || 0) + ' gold · chests · frenzy', c: '#ffd84a', cls: 'huge long' };
    const big = res.n === 3 ? 'big' : '';
    switch (res.sym) {
      case 'coin': return { t: '+' + fmt(p.gold || 0), s: res.n === 3 ? 'BIG WIN!' : 'gold', c: I.col, cls: big };
      case 'chest': return { t: res.n === 3 ? 'CHEST SHOWER!' : '+1 CHEST', s: res.n === 3 ? 'chests rain down' + (p.small ? ' \u00b7 ' + p.small + ' purses' : '') : '', c: I.col, cls: big };
      case 'bolt': return { t: 'FRENZY!', s: res.n === 3 ? '+100% attack speed 10s' : '+50% attack speed 6s', c: I.col, cls: big };
      case 'skull': return { t: res.n === 3 ? 'CARNAGE!' : 'XP BURST', s: res.n === 3 ? 'big XP · streak maxed' : '+XP', c: I.col, cls: big };
      case 'gem': return { t: res.n === 3 ? '+3 ORBS' : '+1 ORB', s: res.n === 3 ? 'one of them a good one' : '', c: I.col, cls: big };
      case 'seven': return { t: 'LUCKY 7s', s: '+' + fmt(p.gold || 0) + ' gold', c: I.col, cls: '' };
    }
    return { t: '', s: '', c: '#fff', cls: '' };
  }
  function onResult(res) {
    if (!build()) return;
    if (shown !== res) onStart(res);
    shown = res;
    // (a payout that landed while the reels were off screen: snap them)
    reels.forEach((r, i) => { if (!r.stopped) { r.pos = 1; r.stopped = true; placeStrip(r); r.el.classList.remove('blur', 'tease'); } });
    layout();
    const T = resultText(res), m = machineTop();
    // the jackpot takes the middle of the field
    if (res.jackpot) floatText(lay.w / 2, lay.h * 0.42, T.t, T.s, T.c, T.cls);
    else floatText(m.x, m.y - 6, T.t, T.s, T.c, T.cls);
    if (res.n) {
      setMode('win'); footTxt.textContent = res.jackpot ? 'JACKPOT!!!' : res.n === 3 ? 'WINNER!' : 'WIN';
      res.reels.forEach((s, i) => { if (res.reels.filter(x => x === s).length >= 2 && s === res.sym) reels[i].el.classList.add('hit'); });
      const icon = SYM_ICON[res.sym];
      const nCoins = res.jackpot ? 70 : res.n === 3 ? 26 : 10;
      spray(m.x, m.y + m.h * 0.35, nCoins, ['ic_coin', 'ic_coin', icon], res.jackpot ? 1.6 : 1);
      if (res.jackpot) {
        Snd.jackpot(); if (G.Audio && G.Audio.jackpot) G.Audio.jackpot();
        goldFlash(); if (G.Stage) { G.Stage.flash(0.8, '#ffd84a'); G.Stage.shake(9); }
        let k = 0; const iv = setInterval(() => { const q = machineTop(); spray(q.x, q.y + q.h * 0.3, 14, ['ic_coin', 'cs_seven'], 1.3); if (++k >= 5) clearInterval(iv); }, 380);
      } else {
        Snd.win(res.n);
        if (res.n === 3 && G.Stage) { G.Stage.flash(0.3, G.SLOT_INFO[res.sym].col); G.Stage.shake(4); }
      }
      hideAt = now() + (res.jackpot ? 4200 : res.n === 3 ? 2600 : 1900);
    } else {
      setMode('off'); footTxt.textContent = 'NO LUCK';
      Snd.miss();
      hideAt = now() + 1300;
    }
  }

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
  function spray(x, y, n, icons, pow) {
    for (let i = 0; i < n; i++) {
      if (parts.length > 110) { const o = parts.shift(); o.el.remove(); }
      const im = el('img', 'csP'); im.alt = ''; im.src = G.SPR.url(icons[i % icons.length], 2);
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, sp = (180 + Math.random() * 260) * (pow || 1);
      parts.push({ el: im, x: x + (Math.random() - 0.5) * 40, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 700, life: 1 + Math.random() * 0.6, rot: (Math.random() - 0.5) * 720, r: 0 });
      root.appendChild(im);
    }
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
  function goldFlash() { const g = el('div', 'csGold'); root.appendChild(g); setTimeout(() => g.remove(), 1500); }

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
    floatText(x, y - 10, I.name, res.kind === 'magnet' && res.n ? res.n + ' grabbed' : I.sub, I.col, 'small');
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
      chips.innerHTML = list.map(b => `<div class="csChip" data-b="${b.id}" style="--c:${b.col}"><img alt="" src="${G.SPR.url(b.icon, 2)}"><b>${b.id === 'rush' ? 'FRENZY +' + Math.round((b.k - 1) * 100) + '%' : b.name}</b><span></span><i></i></div>`).join('');
    }
    for (const b of list) {
      const c = chips.querySelector(`[data-b="${b.id}"]`);
      if (!c) continue;
      c.querySelector('span').textContent = Math.ceil(b.t) + 's';
      c.querySelector('i').style.width = Math.max(0, Math.min(100, b.t / b.T * 100)) + '%';
      c.classList.toggle('low', b.t < 2.5);
    }
  }

  // ---------- Crit cascade ----------
  let cascN = 0, cascEndT = 0;
  const CASC_COL = n => (n >= 10 ? '#ff7ae6' : n >= 7 ? '#ff3b5c' : n >= 4 ? '#ff9a2e' : '#ffe27a');
  function cascPos() {
    const St = G.Stage;
    if (!St || !St.btnPos || !St.toScreen) return { x: lay.w / 2 - 90, y: lay.h / 2 };
    const b = St.btnPos(), p = St.toScreen(b.x, b.y - 10);
    return { x: p.x - lay.left - (lay.phone ? 92 : 120), y: p.y - lay.top };
  }
  function onCascade(n, mul) {
    if (!build()) return;
    if (!lay) layout();
    cascN = n; cascEndT = 0;
    const p = cascPos();
    cascEl.hidden = false; cascEl.classList.remove('end', 'bump'); void cascEl.offsetWidth; cascEl.classList.add('bump');
    cascEl.style.left = Math.round(p.x) + 'px'; cascEl.style.top = Math.round(p.y) + 'px';
    cascEl.style.setProperty('--c', CASC_COL(n));
    const size = lay.phone ? Math.min(17, 10 + n) : Math.min(26, 11 + n * 1.5);
    cascEl.innerHTML = `<b style="font-size:${Math.round(size)}px">CRIT ×${n}</b><small>${n >= 10 ? 'HOT STREAK!' : '+' + Math.round((mul - 1) * 100) + '% DMG'}</small>`;
    // (kept on screen)
    const half = cascEl.offsetWidth / 2 + 6;
    cascEl.style.left = Math.round(Math.max(half, Math.min(lay.w - half, p.x))) + 'px';
    Snd.cascade(n);
    if (n >= 4) squares(p.x, p.y, Math.min(14, n), ['#ffe27a', CASC_COL(n), '#ffffff']);
  }
  function onCascadeEnd(n) {
    if (!cascEl) return;
    if (n >= 5) { cascEl.querySelector('small').textContent = '×' + n + ' CHAIN!'; }
    cascEl.classList.add('end');
    cascEndT = now() + 520;
  }
  function onHot(n) {
    if (!lay) return;
    const p = cascPos();
    floatText(p.x, p.y - 14, 'HOT STREAK!', 'spin meter +10%', '#ff7ae6', 'small');
    Snd.hot();
  }

  // ---------- Every frame ----------
  let lastF = 0;
  function frame() {
    requestAnimationFrame(frame);
    try { step(); } catch (e) { if (!frame.err) { frame.err = 1; console.error(e); } }
  }
  function step() {
    const t = now(), dt = Math.min(0.05, (t - (lastF || t)) / 1000); lastF = t;
    if (!G.S || !G.casino || !build()) return;
    const R = G.R, c = G.casino();
    const away = R.town || !(G.S.hero && G.S.hero.cls) || (G.casinoHold && G.casinoHold('all'));
    root.hidden = !!away;
    if (away) return;
    if (!lay || t - layT > 300) layout();
    // the machine: ready, turning, paying, or tucked away as a meter
    if (c.spin) { if (shown !== c.spin) onStart(c.spin); stepReels(); }
    else if (c.ready && mode !== 'ready' && !(hideAt && t < hideAt)) onReady();
    if (mode === 'ready') {
      autoFill.style.width = Math.max(0, 100 - c.readyT / G.TUNE.spinAuto * 100) + '%';
      const left = Math.ceil(G.TUNE.spinAuto - c.readyT);
      if (left <= 3 && !(G.casinoHold && G.casinoHold('auto'))) footTxt.textContent = 'AUTO IN ' + left;
    } else autoFill.style.width = '0%';
    if (hideAt && t >= hideAt && !c.spin) { hideAt = 0; if (!c.ready) { setMode('off'); show(false); for (const r of reels) r.el.classList.remove('hit'); } }
    const busy = !mEl.hidden && !mEl.classList.contains('out');
    pill.hidden = busy;
    if (!busy) {
      const f = G.spinMeter();
      pillFill.style.width = Math.round(f * 100) + '%';
      pill.classList.toggle('hot', f >= 0.85);
    }
    stepBubbles();
    stepChips();
    stepParts(dt);
    if (cascEndT && t >= cascEndT) { cascEndT = 0; cascEl.hidden = true; cascEl.classList.remove('end'); }
  }

  // ---------- Wiring ----------
  // the casino waits through the tutorial, and a ready spin doesn't pull itself behind an open window
  const tutOn = () => typeof G.S.tut === 'number' && G.S.tut >= 0;
  G.casinoHold = what => tutOn() || (what === 'auto' && !!(G.uiBusy && G.uiBusy()));
  G.on('spinReady', () => { if (!(hideAt && now() < hideAt)) onReady(); });
  G.on('spinStart', res => onStart(res));
  G.on('spinResult', res => onResult(res));
  G.on('bubblePop', (b, res) => { if (build()) { if (!lay) layout(); onPop(b, res); } });
  // a missed bubble fades away
  G.on('bubbleGone', b => { const e = bubEls.get(b.id); if (e) { Snd.fizz(); bubEls.delete(b.id); e.style.pointerEvents = 'none'; e.style.transition = 'opacity .4s'; e.style.opacity = '0'; setTimeout(() => e.remove(), 420); } });
  G.on('cascade', (n, mul) => onCascade(n, mul));
  G.on('cascadeEnd', n => onCascadeEnd(n));
  G.on('hotStreak', n => onHot(n));
  window.addEventListener('keydown', e => {
    if (e.code !== 'KeyR' || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const tg = e.target;
    if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.isContentEditable)) return;
    if (G.uiBusy && G.uiBusy()) return;
    if (pull('key')) e.preventDefault();
  });
  window.addEventListener('pointerdown', () => Snd.unlock(), { capture: true, passive: true });
  window.addEventListener('keydown', () => Snd.unlock(), { capture: true, passive: true });
  window.addEventListener('resize', () => { if (root) layout(); });
  requestAnimationFrame(frame);
})(globalThis.G = globalThis.G || {});
