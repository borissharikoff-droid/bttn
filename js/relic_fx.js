// BTTN 3.0 — relic_fx: the show when a relic falls (js/relic.js emits 'relicDrop').
// A full-screen pixel canvas of its own over everything, drawn at low resolution
// and scaled up nearest-neighbour like the stage: the world slows to a stop and
// greys out, the screen goes black but for the boss's last spot, a spear of white
// light crashes down, a White Bag falls and bounces, god-rays turn, the bag bursts
// and the relic spins out huge, "R E L I C" slams in letter by letter, then its
// name; its own WebAudio score (a bass drop, bells, a choir, a rising shimmer).
// It ends on a card with the stats and the rule: Equip (on the Warden) or Later
// (it is already in the bag). A tap after 2 s skips to the card.
(function (G) {
  'use strict';
  if (typeof document === 'undefined' || !G.SPR || !G.RELICS) return;
  const SPR = G.SPR;
  G.relicFx = true; // relic.js leaves the choice to the card

  // ================= Sprites =================
  // Inventory icons (u_<id>, what the bag, the Party tab and the ladder show): the base item's shape in pearl and prism
  const SMALL = {
    firstcrown:   { Y: '#ffffff', y: '#aab6d0', r: '#ff4f6a', g: '#5affd8', b: '#8fa8ff' },
    lastword:     { L: '#ffffff', D: '#5ae8ff', G: '#ff7ae0', H: '#8a90b0', P: '#ff7ae0' },
    dawnpiercer:  { B: '#ffffff', W: '#ffe9a0' },
    unpressed:    { O: '#ffffff', w: '#ff7ae0', W: '#5ae8ff' },
    lastfeather:  { W: '#ffffff', w: '#ff7ae0' },
    worldegg:     { E: '#f4f6ff', s: '#ff8ae8', w: '#5ae8ff' },
    unbroken:     { A: '#ffffff', a: '#b8c4dc', t: '#5ae8ff' },
    hundredkings: { Y: '#ff7ae0', w: '#ffffff' },
  };
  for (const id of G.RELIC_IDS) {
    const base = SPR.defs['it_' + G.RELICS[id].base];
    if (base && SMALL[id]) SPR.def('u_' + id, SMALL[id], base.px);
  }
  // The big art for the show and the card (16 px): W white, w pearl, s shade, S deep shade, h highlight,
  // c cyan, m magenta, y gold, Y deep gold
  const PEARL = { W: '#ffffff', w: '#e4eaf6', s: '#aeb8d0', S: '#6c7896', h: '#ffffff', c: '#5ae8ff', C: '#2aa0d8', m: '#ff7ae0', M: '#c03aa8', y: '#ffe27a', Y: '#c99a2a', r: '#ff4f6a', R: '#a82440', k: '#2a2440' };
  const BIG = {
    firstcrown: [
      '..c.....m.....c..',
      '.cWc...mWm...cWc.',
      '..W.....W.....W..',
      '..Ww...wWw...wW..',
      '.wWWw.wWWWw.wWWs.',
      '.WWWWwWRRRWwWWWs.',
      '.WhWWWRrhrRWWWWs.',
      '.WWWWWRrrrRWWWss.',
      '.wWWWWWRRRWWWWss.',
      '.SSSSSSSSSSSSSSS.',
      '.wWcWWWmWmWWWcWs.',
      '.wWWWWWWWWWWWWss.',
      '..sssssssssssss..',
    ],
    lastword: [
      '..............hW',
      '.............hWs',
      '............hWs.',
      '...........hWs..',
      '..........hWs...',
      '.........hWs....',
      '........hWs.....',
      '.......hWs......',
      '..y...hWs.......',
      '..yy.hWs........',
      '...ycWs.........',
      '....cy..........',
      '...k.yy.........',
      '..k....y........',
      '.k..............',
      'c...............',
    ],
    dawnpiercer: [
      '....yW.........',
      '...yWsl........',
      '..yWs.l........',
      '..Ws..l........',
      '.yWs...l.......',
      '.Ws....l.......',
      'yWs....l.....h.',
      'yyy....l....hWh',
      'yCyccccccccccWc',
      'yyy....l....hWh',
      'yWs....l.....h.',
      '.Ws....l.......',
      '.yWs...l.......',
      '..Ws..l........',
      '..yWs.l........',
      '...yWsl........',
      '....yW.........',
    ],
    unpressed: [
      '..........sWWs..',
      '.........sWhhWs.',
      '........sWhWWcWs',
      '........WWWWcWWs',
      '........WWWcWWWs',
      '........sWWcWWs.',
      '........y.sWWs..',
      '.......yWy......',
      '......yWy.......',
      '.....wWy........',
      '....wWs.........',
      '...wWs..........',
      '..wWs...........',
      '.wWs............',
      'wWs.............',
      'Ws..............',
    ],
    lastfeather: [
      '.............wWW',
      '...........wWWWs',
      '..........wWhWWs',
      '.........wWhWWs.',
      '........wWhWWWs.',
      '.......wWhWWWs..',
      '......wWhWWWs...',
      '.....wWhWWWs....',
      '....wWhWWss.....',
      '...wWhWWs.......',
      '...WhWss........',
      '..wWss..........',
      '..Whs...........',
      '.yW.............',
      '.y..............',
      'y...............',
    ],
    worldegg: [
      '.....wwWWw.....',
      '...wWWWWWWWs...',
      '..wWhWWWWWWWs..',
      '.wWhWWcWWWWWWs.',
      '.WhWWccWWWWWWs.',
      'wWWWWWcWWWWWWss',
      'WWWWWWWWWWWmWss',
      'WWWcWWWWWWmmWss',
      'WWccWWWWWWWWsss',
      'wWWWWWWWWWWWsss',
      '.WWWWWWWWWWsss.',
      '.sWWWWWWWWssss.',
      '..ssWWWWWsssS..',
      '....ssssssSS...',
    ],
    unbroken: [
      '..wWWs....wWWs..',
      '.wWWWWs..wWWWWs.',
      'wWWhWWWssWWWWWWs',
      'wWhWWWWWWWWWWWss',
      '.WWWWWWWWWWWWss.',
      '.sWWWWWccWWWWWs.',
      '..WWWWcWWcWWWs..',
      '..WWWWcWWcWWWs..',
      '..WWWWWccWWWss..',
      '..sWWWWWWWWWss..',
      '..sWWWWWWWWsss..',
      '...sWWWWWWsss...',
      '...ssWWWWssss...',
      '.....ssssss.....',
    ],
    hundredkings: [
      '..y...y..y...y..',
      '.yWy.yWyyWy.yWy.',
      '..wWWWWWWWWWWw..',
      '.wWs........sWw.',
      'wWs..........sWw',
      'wWs..........sWw',
      '.wWs........sWw.',
      '..wWWWWWWWWWWw..',
      '....swwwwwws....',
    ],
  };
  for (const id in BIG) SPR.def('rx_' + id, PEARL, BIG[id]);
  // The White Bag, as in RotMG: what only the best things come in
  SPR.def('rx_bag', { W: '#ffffff', w: '#e8eef8', s: '#bcc6da', S: '#8792ac', h: '#ffffff', y: '#ffe27a', Y: '#c99a2a' }, [
    '.....w....w.....',
    '....wWw..wWw....',
    '.....wWWWWw.....',
    '.......yY.......',
    '......yYYy......',
    '.....wWWWWs.....',
    '....wWWWWWWs....',
    '...wWhWWWWWWs...',
    '..wWhWWWWWWWss..',
    '..wWWWWWWWWWss..',
    '.wWWWWWWWWWWsss.',
    '.wWWWWWWWWWsssS.',
    '.wWWWWWWWWssssS.',
    '..wWWWWWWssssS..',
    '..swwwwwsssSS...',
    '....ssssSSSS....',
  ]);

  // ================= Style =================
  const css = `
#relicFx { position: fixed; inset: 0; z-index: 9000; pointer-events: none; }
#relicFx.tap { pointer-events: auto; cursor: pointer; }
#relicFx.held { cursor: default; }
#relicFx canvas { position: absolute; left: 0; top: 0; image-rendering: pixelated; image-rendering: crisp-edges; }
#app.rlDim { filter: saturate(0) brightness(.55) contrast(1.1); transition: filter .9s ease-in; }
#app.rlUndim { transition: filter .6s ease-out; }
.rlCard { position: absolute; width: min(440px, calc(100vw - 24px)); box-sizing: border-box; padding: 14px 16px 14px; pointer-events: auto; cursor: default;
  background: linear-gradient(180deg, #1f1c2c, #14121c); border: 3px solid #0c0b12; color: #f1ece0; font: 15px/1.3 var(--font-body);
  box-shadow: inset 0 0 0 2px #ffffff, inset 0 0 0 4px #0c0b12, inset 0 0 0 6px #6c7896, 0 0 24px rgba(255,255,255,.35), 0 0 60px rgba(150,220,255,.25);
  animation: rlCardIn .45s cubic-bezier(.2,1.5,.4,1) both, rlGlow 2.4s ease-in-out infinite .45s; overflow-y: auto; }
@keyframes rlCardIn { from { transform: translateY(26px) scale(.85); opacity: 0; } }
@keyframes rlGlow { 50% { box-shadow: inset 0 0 0 2px #ffffff, inset 0 0 0 4px #0c0b12, inset 0 0 0 6px #c8b8ff, 0 0 34px rgba(255,255,255,.55), 0 0 80px rgba(255,140,230,.25); } }
.rlCard.out { animation: rlCardOut .3s ease-in forwards; }
@keyframes rlCardOut { to { transform: translateY(16px) scale(.92); opacity: 0; } }
.rlTag { display: inline-block; font: 10px/1 var(--font-display); letter-spacing: .3em; padding: 5px 4px 5px 8px; color: #0c0b12;
  background: linear-gradient(90deg, #ffffff, #bfe8ff, #ffd0f4, #fff3a0, #ffffff); background-size: 300% 100%; animation: rlShim 2.2s linear infinite; }
@keyframes rlShim { to { background-position: -300% 0; } }
.rlTop { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.rlTop small { color: #a9a2b9; font-size: 13px; text-align: right; }
.rlCard h2 { margin: 10px 0 2px; font: 14px/1.35 var(--font-display); color: #ffffff; text-shadow: 2px 2px 0 #0c0b12, 0 0 12px rgba(190,230,255,.7); }
.rlSub { margin: 0 0 6px; color: #c8d0e4; font-size: 14px; }
.rlMain { margin: 0 0 4px; color: #ffffff; }
.rlPow { margin: 0 0 6px; color: #8ef08a; font-size: 14px; }
.rlCard ul { list-style: none; margin: 4px 0 8px; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 2px 12px; }
.rlCard li b { color: #ffffff; text-shadow: 0 0 6px rgba(190,230,255,.8); }
.rlRule { padding: 8px 10px; margin: 0 0 6px; background: #0c0b12; box-shadow: inset 0 0 0 2px #5ae8ff; color: #e8fbff; }
.rlRule b { display: block; font: 8px/1 var(--font-display); letter-spacing: .2em; color: #5ae8ff; margin-bottom: 5px; }
.rlLore { margin: 0 0 10px; color: #8f88a6; font-style: italic; font-size: 14px; }
.rlBtns { display: flex; gap: 10px; }
.rlBtns .btn { flex: 1; font: 11px/1 var(--font-display); padding: 12px 10px; }
.rlBtns .rlEq { background: #f4f6ff; color: #0c0b12; box-shadow: inset 0 0 0 2px #ffffff, 0 3px 0 #0c0b12, 0 0 14px rgba(255,255,255,.6); }
.rlBtns .rlEq:hover { background: #ffffff; }
.gear.relic { box-shadow: inset 0 0 0 2px #ffffff, 0 0 10px rgba(255,255,255,.6), 0 0 18px rgba(150,220,255,.35); background: #2a2a3a; animation: shimmer 1.6s ease-in-out infinite; }
.relicTxt { background: linear-gradient(90deg, #ffffff, #bfe8ff, #ffd0f4, #fff3a0, #ffffff); background-size: 300% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; animation: rlShim 2.2s linear infinite; }
`;
  const st = document.createElement('style');
  st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  // ================= Sound =================
  // its own little studio: a bus per show (so a skip can cut it), a big generated hall for the choir and bells
  const Snd = {
    ac: null, rev: null,
    on() { const s = G.S && G.S.set; return !!(s && s.sound && s.vol > 0); },
    init(use) {
      if (this.ac && !use) { if (this.ac.state === 'suspended') { const pr = this.ac.resume(); if (pr && pr.catch) pr.catch(() => {}); } return true; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC && !use) return false;
      try { this.ac = use || new AC(); } catch (e) { return false; }
      noiseBuf = null;
      const ac = this.ac, len = Math.floor(ac.sampleRate * 3.2), ir = ac.createBuffer(2, len, ac.sampleRate);
      for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
      this.rev = ac.createConvolver(); this.rev.buffer = ir;
      const wet = ac.createGain(); wet.gain.value = 0.55; this.rev.connect(wet); wet.connect(ac.destination);
      return true;
    },
    // a fresh bus: dry straight out, a send into the hall
    bus() {
      const ac = this.ac, v = Math.min(1, (G.S.set.vol || 0.6)) * 0.9;
      const dry = ac.createGain(); dry.gain.value = v; dry.connect(ac.destination);
      const send = ac.createGain(); send.gain.value = v; send.connect(this.rev);
      return { dry, send, t0: ac.currentTime + 0.03 };
    },
  };
  let noiseBuf = null;
  function noiseB(ac) {
    if (noiseBuf) return noiseBuf;
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  // one oscillator voice: f0 -> f1 over dur, attack a, peak vol, into dest (and the hall if rv)
  function osc(B, type, f0, f1, t, dur, vol, a, rv, detune) {
    const ac = Snd.ac, T = B.t0 + t;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, T);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, T + dur);
    if (detune) o.detune.value = detune;
    g.gain.setValueAtTime(0.0001, T);
    g.gain.exponentialRampToValueAtTime(vol, T + (a || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, T + dur);
    o.connect(g); g.connect(B.dry); if (rv) { const s = ac.createGain(); s.gain.value = rv; g.connect(s); s.connect(B.send); }
    o.start(T); o.stop(T + dur + 0.05);
    return o;
  }
  function noise(B, t, dur, type, f0, f1, vol, a, rv) {
    const ac = Snd.ac, T = B.t0 + t;
    const s = ac.createBufferSource(); s.buffer = noiseB(ac); s.loop = true;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, T); if (f1) f.frequency.exponentialRampToValueAtTime(f1, T + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, T); g.gain.exponentialRampToValueAtTime(vol, T + (a || 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, T + dur);
    s.connect(f); f.connect(g); g.connect(B.dry); if (rv) { const x = ac.createGain(); x.gain.value = rv; g.connect(x); x.connect(B.send); }
    s.start(T); s.stop(T + dur + 0.05);
  }
  // a bell: inharmonic partials, long ring, mostly in the hall
  function bell(B, f, t, dur, vol) {
    [[1, 1], [2.0, 0.55], [2.76, 0.4], [5.4, 0.22], [8.93, 0.1]].forEach(([k, v]) => osc(B, 'sine', f * k, null, t, dur / Math.sqrt(k), vol * v, 0.004, 0.9));
  }
  function thud(B, t, vol, lp) { noise(B, t, 0.35, 'lowpass', lp || 400, 60, vol, 0.004); osc(B, 'sine', 120, 40, t, 0.3, vol, 0.003); }
  // the bass drop: a sub that falls through the floor, hard clipped
  function drop(B, t) {
    const ac = Snd.ac, T = B.t0 + t;
    const o = ac.createOscillator(), g = ac.createGain(), sh = ac.createWaveShaper();
    const curve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 3.2); }
    sh.curve = curve;
    o.type = 'sine'; o.frequency.setValueAtTime(170, T); o.frequency.exponentialRampToValueAtTime(28, T + 1.8);
    g.gain.setValueAtTime(0.0001, T); g.gain.exponentialRampToValueAtTime(0.95, T + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, T + 2.6);
    o.connect(sh); sh.connect(g); g.connect(B.dry);
    o.start(T); o.stop(T + 2.7);
    osc(B, 'sine', 1800, 50, t, 0.08, 0.6, 0.002);
    noise(B, t, 1.4, 'lowpass', 5000, 120, 0.55, 0.003, 0.4);
    noise(B, t, 2.2, 'highpass', 3000, 9000, 0.12, 0.003, 1);
  }
  // the choir: "aah" on a big chord, through two formants, with a slow vibrato, into the hall
  function choir(B, t, dur, notes, vol) {
    const ac = Snd.ac, T = B.t0 + t;
    const out = ac.createGain();
    out.gain.setValueAtTime(0.0001, T); out.gain.exponentialRampToValueAtTime(vol, T + 0.35); out.gain.setValueAtTime(vol, T + dur - 1.6); out.gain.exponentialRampToValueAtTime(0.0001, T + dur);
    const f1 = ac.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 730; f1.Q.value = 5;
    const f2 = ac.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1150; f2.Q.value = 7;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
    lp.connect(f1); lp.connect(f2); f1.connect(out); f2.connect(out);
    const dry = ac.createGain(); dry.gain.value = 0.5; out.connect(dry); dry.connect(B.dry);
    out.connect(B.send);
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 5.2; lg.gain.value = 9; lfo.connect(lg); lfo.start(T); lfo.stop(T + dur + 0.1);
    for (const n of notes) for (const dt of [-11, 0, 9]) {
      const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = midi(n); o.detune.value = dt; lg.connect(o.detune);
      o.connect(lp); o.start(T); o.stop(T + dur + 0.1);
    }
  }
  // the rising shimmer: a detuned saw stack sweeping up through an opening filter, a tremolo speeding up
  function riser(B, t, dur) {
    const ac = Snd.ac, T0 = B.t0 + t;
    const g = ac.createGain(), lp = ac.createBiquadFilter(), trem = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(500, T0); lp.frequency.exponentialRampToValueAtTime(9000, T0 + dur);
    g.gain.setValueAtTime(0.0001, T0); g.gain.linearRampToValueAtTime(0.09, T0 + dur * 0.5); g.gain.linearRampToValueAtTime(0.22, T0 + dur - 0.02); g.gain.linearRampToValueAtTime(0.0001, T0 + dur);
    lfo.frequency.setValueAtTime(5, T0); lfo.frequency.exponentialRampToValueAtTime(26, T0 + dur); lg.gain.value = 0.5; trem.gain.value = 0.6;
    lfo.connect(lg); lg.connect(trem.gain);
    lp.connect(trem); trem.connect(g); g.connect(B.dry);
    const s = ac.createGain(); s.gain.value = 0.4; g.connect(s); s.connect(B.send);
    for (const d of [-16, -6, 0, 7, 17]) { const o = ac.createOscillator(); o.type = 'sawtooth'; o.detune.value = d; o.frequency.setValueAtTime(196, T0); o.frequency.exponentialRampToValueAtTime(1568, T0 + dur); o.connect(lp); o.start(T0); o.stop(T0 + dur + 0.05); }
    lfo.start(T0); lfo.stop(T0 + dur + 0.05);
  }
  // the whole score, scheduled at once against the show's clock
  function score(B) {
    // a low drone while the world stops; silence for a breath before the spear
    osc(B, 'sine', 55, null, 0.05, 1.45, 0.2, 1.1);
    osc(B, 'triangle', 82.5, null, 0.1, 1.4, 0.07, 1.0);
    noise(B, 0.0, 1.45, 'lowpass', 300, 900, 0.08, 1.0);
    // a heartbeat as everything stops
    for (const t of [0.12, 0.8]) { thud(B, t, 0.5, 180); thud(B, t + 0.2, 0.32, 160); }
    // the inhale: a reversed cymbal rising into the strike
    noise(B, 0.85, 0.72, 'bandpass', 500, 8000, 0.38, 0.69);
    osc(B, 'sawtooth', 220, 1760, 1.05, 0.52, 0.03, 0.5);
    // THE SPEAR
    drop(B, 1.58);
    bell(B, midi(91), 1.6, 3.2, 0.06);
    // the bag lands, twice
    thud(B, 2.22, 0.7, 500); bell(B, midi(76), 2.22, 2.6, 0.16); bell(B, midi(83), 2.24, 2.2, 0.07);
    thud(B, 2.52, 0.35, 400); bell(B, midi(88), 2.52, 1.8, 0.08);
    // the rising shimmer: a detuned stack climbing, a tremolo speeding up, a hiss on top
    riser(B, 2.6, 1.0);
    noise(B, 2.6, 1.02, 'highpass', 1500, 9000, 0.24, 1.0, 0.5);
    for (let i = 0; i < 14; i++) osc(B, 'square', midi(64 + i * 2), null, 2.62 + i * 0.068, 0.06, 0.02 + i * 0.002);
    // THE BURST: a boom, a crash, the choir and the bells
    osc(B, 'sine', 95, 32, 3.6, 1.6, 0.9, 0.004);
    noise(B, 3.6, 2.4, 'highpass', 1200, 4000, 0.32, 0.004, 1.2);
    choir(B, 3.62, 5.6, [48, 55, 60, 64, 67, 71, 74], 0.11);
    [72, 76, 79, 84, 88].forEach((n, i) => bell(B, midi(n), 3.62 + i * 0.06, 3.4, 0.09));
    // sparkles over the reveal
    const P = [0, 2, 4, 7, 9];
    for (let i = 0; i < 34; i++) osc(B, 'sine', midi(84 + P[i % 5] + 12 * ((i * 7) % 3 === 0 ? 1 : 0)), null, 3.75 + i * 0.075 + Math.random() * 0.03, 0.22, 0.035, 0.003, 1);
    // R E L I C: five slams, the last one a chord
    [0, 4, 7, 11, 12].forEach((s, i) => { const t = T.title + i * T.letter; thud(B, t, 0.35, 700); osc(B, 'square', midi(60 + s), null, t, 0.12, 0.08, 0.002, 0.4); osc(B, 'square', midi(72 + s), null, t, 0.09, 0.05, 0.002, 0.6); });
    bell(B, midi(84), T.title + 4 * T.letter, 3, 0.12); bell(B, midi(91), T.title + 4 * T.letter + 0.02, 2.6, 0.06);
    // the name types in
    for (let i = 0; i < 26; i++) osc(B, 'triangle', 1900 + (i % 3) * 220, null, T.name + i * T.char, 0.025, 0.035);
    // the card: a soft whoosh and a last chord
    noise(B, T.card - 0.1, 0.5, 'bandpass', 600, 3000, 0.1, 0.25, 0.6);
  }
  // a skip still pays off: the reveal chord on its own
  function reveal(B) {
    osc(B, 'sine', 95, 32, 0, 1.4, 0.8, 0.004);
    noise(B, 0, 1.8, 'highpass', 1200, 4000, 0.25, 0.004, 1);
    choir(B, 0.02, 4, [48, 55, 60, 64, 67, 71, 74], 0.1);
    [72, 76, 79, 84].forEach((n, i) => bell(B, midi(n), 0.02 + i * 0.05, 3, 0.09));
  }

  // ================= The show =================
  // timeline, seconds
  const T = { dark: 0.15, black: 1.1, star: 0.85, spear: 1.55, hit: 1.63, fall: 1.88, land: 2.22, land2: 2.52, wob: 2.65, burst: 3.6, title: 4.15, letter: 0.13, name: 4.95, char: 0.034, card: 6.3, skip: 2 };
  const OUTL = '#0c0b12';
  const FONT = '"Press Start 2P", monospace';
  const PRISM = ['#ffffff', '#ffffff', '#bfe8ff', '#ffd0f4', '#fff3a0', '#c8ffe8', '#d8c8ff'];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = k => 1 - Math.pow(1 - clamp(k, 0, 1), 3);
  const easeIn = k => Math.pow(clamp(k, 0, 1), 2);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pickc = a => a[Math.floor(Math.random() * a.length)];

  let show = null;
  const queue = [];
  let root = null, cv = null, ctx = null, K = 3, W = 320, H = 200;

  // time: the Horde and the stage slow down with the show (both are called through G, so they can be wrapped here)
  const tick0 = G.tick;
  if (tick0) G.tick = dt => tick0(show ? dt * show.k : dt);
  if (G.Stage && G.Stage.frame) { const f0 = G.Stage.frame; G.Stage.frame = dt => f0(show ? dt * show.kv : dt); }

  function layout() {
    const vw = window.innerWidth, vh = window.innerHeight;
    K = clamp(Math.round(Math.min(vw, vh * 1.5) / 330), 2, 5);
    W = Math.ceil(vw / K); H = Math.ceil(vh / K);
    cv.width = W; cv.height = H;
    cv.style.width = W * K + 'px'; cv.style.height = H * K + 'px';
    ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
    if (!show) return;
    // where the boss stood, in show pixels
    let sx = W / 2, sy = H * 0.55;
    try { const St = G.Stage, b = St.btnPos(), p = St.toScreen(b.x, b.y + 2); if (p && isFinite(p.x)) { sx = p.x / K; sy = p.y / K; } } catch (e) { /* stage not ready */ }
    show.sx = Math.round(clamp(sx, 40, W - 40)); show.sy = Math.round(clamp(sy, H * 0.3, H * 0.8));
    show.bs = K <= 2 ? 4 : 3;                          // bag scale
    show.is = K <= 2 ? 5 : 4;                          // item scale
    const half = 8 * show.is;
    show.bar = Math.round(H * 0.09);
    show.hx = show.sx;
    // (on a tall phone the relic rises to the middle of the screen, the stage is only its top part)
    show.hy = Math.round(H > W * 1.4 ? clamp(H * 0.34, show.bar + half + 6, H * 0.5) : clamp(show.sy - half - 6, show.bar + half + 6, H * 0.5));
    show.ts = W >= 160 ? 16 : 8;                       // title size
    show.ty = show.hy + half + 12;                      // the title's top
    show.cs = 0.62;                                      // the item's scale on the card
    show.cy = Math.round(show.bar * 0.3 + 6 + half * show.cs);
  }
  function ensureRoot() {
    if (root) return;
    root = document.createElement('div'); root.id = 'relicFx';
    cv = document.createElement('canvas'); root.appendChild(cv);
    document.body.appendChild(root);
    root.addEventListener('pointerdown', e => { if (show && show.belt) { e.preventDefault(); e.stopPropagation(); if (show.t >= TB.skip) beltOut(); return; } if (show && show.t >= T.skip && show.t < T.card && !show.card) { e.preventDefault(); e.stopPropagation(); skip(); } });
    window.addEventListener('resize', () => { if (show) { layout(); if (show.card) placeCard(); } });
    window.addEventListener('keydown', e => {
      if (!show) return;
      if (show.belt) { if (show.t >= TB.skip && !e.repeat && (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); beltOut(); } e.stopPropagation(); return; }
      if (show.card) { if (e.key === 'Escape') { e.preventDefault(); close(false); } else if (e.key === 'Enter') { e.preventDefault(); close(true); } }
      else if (show.t >= T.skip && (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); skip(); }
      e.stopPropagation();
    }, true);
  }

  G.on('relicDrop', (g, info) => {
    queue.push({ g, info });
    if (!show) next();
  });
  function next() {
    const it = queue.shift();
    if (!it) return;
    ensureRoot();
    if (it.belt) { startBelt(it); return; }
    const id = it.info.q;
    show = { g: it.g, info: it.info, id, U: G.UNIQUES[id], t: 0, prev: -1, k: 1, kv: 1, parts: [], rings: [], cracks: [], pieces: [], shake: 0, flash: 0, flashCol: '#ffffff', card: null, out: 0, done: {} };
    layout();
    root.style.display = 'block'; root.classList.remove('tap');
    cv.style.opacity = '1';
    const app = document.getElementById('app');
    if (app) { app.classList.remove('rlUndim'); app.classList.add('rlDim'); }
    show.sound = Snd.on() && Snd.init();
    if (show.sound) { show.B = Snd.bus(); try { score(show.B); } catch (e) { /* audio is a bonus */ } }
    show.flash = 0.35; show.flashCol = '#ffffff';
    show.last = performance.now();
    requestAnimationFrame(loop);
  }

  function loop(now) {
    if (!show) return;
    // (a slow device: the frame's time is stepped in <= 0.05-s pieces, up to 0.15 s a frame, so the show keeps pace with
    // its score (scheduled on the audio clock) down to ~7 fps instead of stretching; a longer stall is not counted)
    let left = Math.min(0.15, Math.max(0, (now - show.last) / 1000));
    show.last = now;
    try {
      do {
        const dt = Math.min(0.05, left); left -= dt;
        show.prev = show.t; show.t += dt;
        if (show.belt) stepBelt(dt); else step(dt);
      } while (show && left > 1e-6);
      if (show) { if (show.belt) drawBelt(); else draw(); }
    } catch (e) { console.error(e); finish(); return; }
    if (show) requestAnimationFrame(loop);
  }
  const passed = k => show.prev < k && show.t >= k;

  function step(dt) {
    const s = show, t = s.t;
    // the world: slows to a stop over the first second, then holds (G.cinematic) until the card is closed
    if (s.out > 0) { s.out += dt; s.k = s.kv = clamp(s.out / 0.6, 0, 1); }
    else { s.k = Math.pow(clamp(1 - t / 0.95, 0, 1), 2); s.kv = Math.max(0.03, s.k); }
    if (t >= 0.9 && !s.out && G.cinematic) G.cinematic(2);
    if (t >= T.skip && !s.card && !s.out) root.classList.add('tap');
    // moments
    if (passed(T.hit)) impact();
    if (passed(T.land)) landFx(1);
    if (passed(T.land2)) landFx(0.5);
    if (passed(T.burst)) burstFx();
    for (let i = 0; i < 5; i++) if (passed(T.title + i * T.letter)) {
      const step = s.ts * 2, lx = s.hx - (4 * step) / 2 + i * step;
      s.shake = Math.max(s.shake, i === 4 ? 5 : 2.5);
      burst(lx, s.ty + s.ts / 2, i === 4 ? 40 : 12, i === 4 ? 160 : 70, PRISM, { g: 40, drag: 2.5 });
      if (i === 4) s.flash = Math.max(s.flash, 0.3);
    }
    if (passed(T.card)) showCard();
    // implosion: light gathers into the bag before it goes
    if (t > 3.0 && t < T.burst && !s.skipped) for (let i = 0; i < 4; i++) {
      const a = Math.random() * Math.PI * 2, r = rnd(50, 90), bx = s.sx, by = s.sy - 8 * s.bs;
      s.parts.push({ x: bx + Math.cos(a) * r, y: by + Math.sin(a) * r * 0.7, vx: -Math.cos(a) * r * 2.6, vy: -Math.sin(a) * r * 1.8, life: 0.36, max: 0.36, col: pickc(PRISM), sz: 1, g: 0, drag: 0 });
    }
    // embers rising in the pillar, motes round the relic
    if (t > T.hit && t < T.burst && Math.random() < 0.7) s.parts.push({ x: s.sx + rnd(-6, 6), y: s.sy - rnd(0, 20), vx: rnd(-4, 4), vy: rnd(-60, -25), life: rnd(0.6, 1.2), max: 1.2, col: pickc(PRISM), sz: 1, g: 0, drag: 0 });
    if (t > T.burst && Math.random() < 0.85) { const p = itemPos(); s.parts.push({ x: p.x + rnd(-30, 30), y: p.y + rnd(-26, 30), vx: rnd(-5, 5), vy: rnd(-26, -8), life: rnd(0.6, 1.4), max: 1.4, col: pickc(PRISM), sz: Math.random() < 0.2 ? 2 : 1, g: 0, drag: 0, tw: 1 }); }
    physics(dt);
    // the shake reaches the world under the show too
    // and the camera pushes in on the spot while the world stops (and eases back out at the end)
    const wrap = document.getElementById('stageWrap');
    if (wrap) {
      const z = s.out > 0 ? 1 + 0.14 * (1 - clamp(s.out / 0.6, 0, 1)) : 1 + 0.14 * ease(t / 1.4);
      const j = s.shake > 0.5 && G.S.set.shake ? s.shake * K * 0.5 : 0;
      if (!s.origin) { const r = wrap.getBoundingClientRect(); s.origin = `${Math.round(s.sx * K - r.left)}px ${Math.round(s.sy * K - r.top)}px`; }
      wrap.style.transformOrigin = s.origin;
      wrap.style.transform = `translate(${Math.round(rnd(-1, 1) * j)}px, ${Math.round(rnd(-1, 1) * j)}px) scale(${z.toFixed(4)})`;
    }
    if (s.out > 0.65) finish();
  }

  function ring(x, y, r, life, col, th, v) { show.rings.push({ x, y, r, life, max: life, col, th: th || 1, v: v || 300 }); }
  function burst(x, y, n, sp, cols, o) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = rnd(sp * 0.25, sp);
      show.parts.push(Object.assign({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.75 - sp * 0.15, life: rnd(0.5, 1.3), max: 1.3, col: pickc(cols), sz: Math.random() < 0.25 ? 2 : 1, g: 120, drag: 2.2 }, o || {}));
    }
  }
  function impact() {
    const s = show;
    s.flash = 1; s.flashCol = '#ffffff'; s.shake = 12;
    ring(s.sx, s.sy, 3, 0.9, '#ffffff', 2, 520); ring(s.sx, s.sy, 2, 1.1, '#bfe8ff', 1, 340); ring(s.sx, s.sy, 1, 1.3, '#ffffff', 1, 200);
    burst(s.sx, s.sy - 2, 90, 230, ['#ffffff', '#ffffff', '#bfe8ff', '#e4eaf6'], { floor: s.sy + 6 });
    burst(s.sx, s.sy - 2, 26, 160, ['#3a3448', '#5a5470', '#2a2440'], { g: 340, drag: 1, floor: s.sy + 8 });
    // the ground cracks under the strike
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rnd(-0.25, 0.25), pts = [[s.sx, s.sy]];
      let x = s.sx, y = s.sy, len = rnd(18, 46);
      for (let j = 0; j < 5; j++) { const aa = a + rnd(-0.5, 0.5); x += Math.cos(aa) * len / 5; y += Math.sin(aa) * len / 5 * 0.45; pts.push([x, y]); }
      s.cracks.push(pts);
    }
  }
  function landFx(k) {
    const s = show;
    s.shake = Math.max(s.shake, 5 * k);
    for (let i = 0; i < 26 * k; i++) { const dir = Math.random() < 0.5 ? -1 : 1; s.parts.push({ x: s.sx + dir * rnd(4, 10) * s.bs / 2, y: s.sy, vx: dir * rnd(30, 110), vy: rnd(-40, -6), life: rnd(0.4, 0.9), max: 0.9, col: pickc(['#e4eaf6', '#aeb8d0', '#ffffff']), sz: Math.random() < 0.3 ? 2 : 1, g: 60, drag: 3 }); }
    ring(s.sx, s.sy, 6, 0.5, '#ffffff', 1, 160 * k);
  }
  function burstFx() {
    const s = show, by = s.sy - 8 * s.bs;
    s.flash = Math.max(s.flash, 0.95); s.flashCol = '#ffffff'; s.shake = Math.max(s.shake, 9);
    burst(s.sx, by, 220, 300, PRISM, { g: 30, drag: 1.6 });
    burst(s.sx, by, 40, 120, ['#ffffff'], { g: 0, drag: 0.8, sz: 2 });
    ring(s.sx, by, 4, 1.0, '#ffffff', 2, 460); ring(s.sx, by, 3, 1.2, '#ffd0f4', 1, 330); ring(s.sx, by, 2, 1.4, '#bfe8ff', 1, 220);
    // the bag tears into four
    const bag = SPR.get('rx_bag'), hw = bag.width / 2, hh = bag.height / 2;
    [[0, 0, -1, -1], [hw, 0, 1, -1], [0, hh, -1, 0.4], [hw, hh, 1, 0.4]].forEach(([qx, qy, dx, dy]) => s.pieces.push({ sx: qx, sy: qy, w: hw, h: hh, x: s.sx + (qx - hw + hw / 2) * s.bs, y: s.sy - (bag.height - qy - hh / 2) * s.bs, vx: dx * rnd(90, 150), vy: dy * rnd(90, 160) - 60, a: 0, va: dx * rnd(6, 12), life: 1.4 }));
  }
  function skip() {
    const s = show;
    if (!s || s.card) return;
    s.skipped = true;
    if (s.B) { try { const now = Snd.ac.currentTime; for (const n of [s.B.dry, s.B.send]) { n.gain.cancelScheduledValues(now); n.gain.setValueAtTime(n.gain.value, now); n.gain.linearRampToValueAtTime(0, now + 0.08); } } catch (e) { /* fine */ } }
    if (s.t < T.burst) { s.prev = T.burst - 0.001; s.t = T.burst; burstFx(); if (s.sound) { s.B = Snd.bus(); try { reveal(s.B); } catch (e) { /* fine */ } } }
    s.cracks.length = 0;
    s.t = Math.max(s.t, T.card - 0.6); s.prev = s.t;
    s.skipT = s.t;
  }

  // ---------- drawing helpers (all on the low-res grid) ----------
  function fillEllipse(cx, cy, rx, ry) {
    cx = Math.round(cx); cy = Math.round(cy);
    for (let dy = -Math.floor(ry); dy <= Math.floor(ry); dy++) { const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry)))); ctx.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1); }
  }
  function strokeEllipse(cx, cy, rx, ry, th) {
    const n = Math.max(16, Math.ceil(Math.PI * 2 * Math.max(rx, ry)));
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; ctx.fillRect(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), th, th); }
  }
  const tints = {};
  function tinted(key, src, col) {
    const k = key + col;
    if (tints[k]) return tints[k];
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const x = c.getContext('2d'); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
    return (tints[k] = c);
  }
  // a sprite centred on (x, y), scaled sc, squashed (sx, sy), turned a radians
  function blit(img, x, y, sc, kx, ky, a, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.translate(Math.round(x), Math.round(y));
    if (a) ctx.rotate(a);
    if (kx < 0) { ctx.scale(-1, 1); kx = -kx; }
    const w = img.width * sc * (kx || 1), h = img.height * sc * (ky || 1);
    ctx.drawImage(img, Math.round(-w / 2), Math.round(-h / 2), Math.max(1, Math.round(w)), Math.round(h));
    ctx.restore();
  }
  function text(str, x, y, size, col, align, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.font = size + 'px ' + FONT; ctx.textBaseline = 'top'; ctx.textAlign = align || 'center';
    x = Math.round(x); y = Math.round(y);
    ctx.fillStyle = OUTL;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [2, 2]]) ctx.fillText(str, x + dx, y + dy);
    ctx.fillStyle = col; ctx.fillText(str, x, y);
    ctx.restore();
  }
  function wrap(str, max) {
    const out = []; let line = '';
    for (const w of String(str).split(' ')) { if ((line + ' ' + w).trim().length > max && line) { out.push(line); line = w; } else line = (line + ' ' + w).trim(); }
    if (line) out.push(line);
    return out;
  }
  // where the relic is: popping out of the bag, rising to its place, then up to sit over the card
  function itemPos() {
    const s = show, t = s.t, bagY = s.sy - 8 * s.bs;
    const k = ease((t - T.burst) / 0.9);
    let x = lerp(s.sx, s.hx, k), y = lerp(bagY, s.hy, k), sc = 1;
    if (s.card || t > T.card) { const c = ease((t - T.card) / 0.5); y = lerp(s.hy, s.cy, c); sc = lerp(1, s.cs, c); }
    y += Math.sin(t * 2.2) * 2;
    return { x, y, sc };
  }

  function draw() {
    const s = show, t = s.t;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);
    const fade = s.out > 0 ? clamp(1 - s.out / 0.55, 0, 1) : 1;
    cv.style.opacity = String(fade);
    const sh = G.S.set.shake ? s.shake : s.shake * 0.25;
    ctx.translate(Math.round(rnd(-1, 1) * sh), Math.round(rnd(-1, 1) * sh));

    // 1. the dark, with a hole of light where the boss fell
    const dk = t < T.burst ? ease((t - T.dark) / (T.black - T.dark)) * 0.975 : 0.95;
    ctx.fillStyle = `rgba(4,3,9,${dk})`;
    ctx.fillRect(-20, -20, W + 40, H + 40);
    if (t < T.burst + 0.3) {
      // (it closes to nothing for a breath just before the strike)
      const shut = t < T.hit ? 1 - easeIn((t - 1.3) / 0.25) : 1;
      const k = ease((t - 0.2) / 1.0), r = lerp(Math.max(W, H) * 0.8, 20, k) * shut * (t > T.hit ? 1 + 0.6 * Math.max(0, 1 - (t - T.hit) * 2) : 1);
      const fadeHole = t > T.burst ? 1 - (t - T.burst) / 0.3 : 1;
      ctx.globalCompositeOperation = 'destination-out';
      for (const [kr, a] of [[1, 0.25], [0.72, 0.45], [0.48, 0.65]]) { ctx.fillStyle = `rgba(0,0,0,${a * fadeHole})`; fillEllipse(s.sx, s.sy - 6, r * kr, r * kr * 0.62); }
      ctx.globalCompositeOperation = 'source-over';
    }

    // a field of stars comes out once the bag is open
    if (t > T.burst) {
      if (!s.stars) { s.stars = []; for (let i = 0; i < 90; i++) s.stars.push({ x: Math.random() * W, y: Math.random() * H, ph: Math.random() * 6.3, c: pickc(PRISM) }); }
      const a = clamp((t - T.burst) / 1.2, 0, 1);
      for (const st of s.stars) { const tw = 0.5 + 0.5 * Math.sin(t * 2.5 + st.ph); ctx.globalAlpha = a * tw * 0.7; ctx.fillStyle = st.c; ctx.fillRect(Math.round(st.x), Math.round(st.y - t * 2) , 1, 1); }
      ctx.globalAlpha = 1;
    }
    // 2. god-rays, turning
    const rayOn = t > T.land ? clamp((t - T.land) / 0.8, 0, 1) * (t > T.burst ? 1 : 0.45) : 0;
    if (rayOn > 0) {
      const p = t > T.burst ? itemPos() : { x: s.sx, y: s.sy - 8 * s.bs };
      drawRays(p, rayOn, t);
    }

    // 3. the star that becomes a spear, and the pillar it leaves
    if (t > T.star && t < T.spear) {
      const k = (t - T.star) / (T.spear - T.star), z = Math.round(1 + k * 5 + (Math.sin(t * 30) > 0 ? 1 : 0)), y = show.bar + 6;
      // the light takes aim: a hair-thin line flickers down to the spot
      if (k > 0.45) { ctx.fillStyle = `rgba(191,232,255,${(0.12 + 0.12 * Math.sin(t * 50)) * k})`; ctx.fillRect(s.sx, y, 1, s.sy - y); }
      ctx.fillStyle = 'rgba(191,232,255,.35)'; fillEllipse(s.sx, y, z + 2, z + 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(s.sx - z, y, z * 2 + 1, 1); ctx.fillRect(s.sx, y - z, 1, z * 2 + 1);
      if (k > 0.5) { ctx.fillStyle = 'rgba(191,232,255,.6)'; ctx.fillRect(s.sx - 1, y - 1, 3, 3); }
    }
    if (t >= T.spear && t < 3.4) {
      const k = clamp((t - T.spear) / (T.hit - T.spear), 0, 1), tip = lerp(-10, s.sy, easeIn(k));
      const after = Math.max(0, t - T.hit), wide = t < T.hit ? 5 : Math.max(1, 26 * Math.exp(-after * 3.2) + 2 + Math.sin(t * 40) * (after < 1 ? 1 : 0));
      const al = t < T.hit ? 1 : clamp(1 - (t - 2.4) / 1.0, 0, 1);
      ctx.fillStyle = `rgba(191,232,255,${0.55 * al})`; ctx.fillRect(Math.round(s.sx - wide - 2), -20, Math.round(wide * 2 + 5), tip + 20);
      ctx.fillStyle = `rgba(255,255,255,${al})`; ctx.fillRect(Math.round(s.sx - wide / 2), -20, Math.max(1, Math.round(wide)), tip + 20);
      if (t < T.hit) { ctx.fillStyle = '#ffffff'; for (let i = 0; i < 6; i++) ctx.fillRect(s.sx - 6 + i * 2 - (i > 2 ? 0 : 0), Math.round(tip) - 6 + Math.abs(i - 3) * 2, 1, 1); fillEllipse(s.sx, tip, 4, 6); }
    }
    // the ground glow and the cracks
    if (t > T.hit && t < T.burst + 1.2) {
      const al = t < T.burst ? 1 : clamp(1 - (t - T.burst) / 1.2, 0, 1);
      ctx.fillStyle = `rgba(191,232,255,${0.18 * al})`; fillEllipse(s.sx, s.sy + 1, 30, 9);
      ctx.fillStyle = `rgba(255,255,255,${0.35 * al})`; fillEllipse(s.sx, s.sy + 1, 16, 5);
      for (const c of s.cracks) {
        for (let i = 1; i < c.length; i++) {
          const [x0, y0] = c[i - 1], [x1, y1] = c[i], n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
          for (let j = 0; j < n; j++) { const px = Math.round(lerp(x0, x1, j / n)), py = Math.round(lerp(y0, y1, j / n)); ctx.fillStyle = `rgba(150,220,255,${0.5 * al})`; ctx.fillRect(px - 1, py, 3, 1); ctx.fillStyle = `rgba(255,255,255,${al})`; ctx.fillRect(px, py, 1, 1); }
        }
      }
    }

    // 4. the White Bag
    if (t > T.fall && t < T.burst) {
      const bag = SPR.get('rx_bag');
      let y, kx = 1, ky = 1, a = 0;
      if (t < T.land) { const k = (t - T.fall) / (T.land - T.fall); y = lerp(-bag.height * s.bs, s.sy, easeIn(k)); kx = 0.82; ky = 1.25; }
      else if (t < T.land2) { const k = (t - T.land) / (T.land2 - T.land); y = s.sy - Math.sin(k * Math.PI) * 12; const sq = Math.max(0, 1 - k * 5); kx = 1 + 0.4 * sq; ky = 1 - 0.38 * sq; }
      else { y = s.sy; const sq = Math.max(0, 1 - (t - T.land2) * 6); kx = 1 + 0.2 * sq; ky = 1 - 0.2 * sq; }
      // trembling, faster and harder, then a gulp before it goes
      if (t > T.wob) { const k = (t - T.wob) / (T.burst - T.wob); a = Math.sin(t * (30 + 40 * k)) * 0.22 * k * k; if (k > 0.85) { const g = (k - 0.85) / 0.15; kx *= 1 - 0.18 * g; ky *= 1 + 0.12 * g; } else if (k > 0.3 && Math.sin(t * 13) > 0.94) y -= 3; }
      const h = bag.height * s.bs * ky;
      // a halo under it once it's down
      if (t > T.land) { ctx.fillStyle = 'rgba(255,255,255,.18)'; fillEllipse(s.sx, s.sy + 1, 12 * s.bs, 3 * s.bs); }
      blit(bag, s.sx, y - h / 2, s.bs, kx, ky, a);
      // it shines brighter and brighter
      if (t > T.wob) blit(tinted('bag', bag, '#ffffff'), s.sx, y - h / 2, s.bs, kx, ky, a, clamp((t - T.wob) / (T.burst - T.wob), 0, 1) * (0.5 + 0.5 * Math.sin(t * 25)));
      // light leaking out at the knot
      if (t > 3.1) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,255,255,.5)'; const ky0 = y - h + 4 * s.bs; for (let i = -2; i <= 2; i++) ctx.fillRect(s.sx + i * 3, ky0 - 30, 1, 30); ctx.restore(); }
    }
    for (const pc of s.pieces) if (pc.life > 0) {
      ctx.save(); ctx.globalAlpha = clamp(pc.life, 0, 1); ctx.translate(Math.round(pc.x), Math.round(pc.y)); ctx.rotate(pc.a);
      ctx.drawImage(SPR.get('rx_bag'), pc.sx, pc.sy, pc.w, pc.h, Math.round(-pc.w * s.bs / 2), Math.round(-pc.h * s.bs / 2), pc.w * s.bs, pc.h * s.bs);
      ctx.restore();
    }

    // 5. the relic: huge, spinning, shimmering
    if (t >= T.burst) drawRelic(itemPos(), t - T.burst, t);

    // 6. particles and shockwaves
    drawParts();

    // 7. the letterbox
    const bar = s.bar * (s.card || t > T.card ? 1 - ease((t - T.card) / 0.5) : ease((t - 0.1) / 0.6));
    if (bar > 0.5) { ctx.fillStyle = '#000000'; ctx.fillRect(-20, -20, W + 40, Math.round(bar) + 20); ctx.fillRect(-20, H - Math.round(bar), W + 40, Math.round(bar) + 20); }

    // 8. R E L I C, then the name
    const cardK = s.card || t > T.card ? clamp(1 - (t - T.card) / 0.35, 0, 1) : 1;
    if (t >= T.title && cardK > 0) drawTitle(T.title, T.letter, cardK, t);
    if (t >= T.name && cardK > 0) {
      const maxC = Math.max(10, Math.floor((W - 16) / 8)), lines = wrap(s.U.name, maxC);
      let left = Math.floor((t - T.name) / T.char), y = s.ty + s.ts + 12;
      for (const ln of lines) { if (left <= 0) break; text(ln.slice(0, left), s.hx, y, 8, '#ffffff', 'center', cardK); left -= ln.length + 1; y += 11; }
      const typed = (t - T.name) / T.char > s.U.name.length + 4;
      if (typed) {
        const slot = G.slotOf(s.g.id);
        text(G.t('slot_' + slot).toUpperCase() + ' · ' + G.t('ilvl', s.g.il).toUpperCase(), s.hx, y + 3, 8, '#8f9ab8', 'center', cardK * clamp(((t - T.name) / T.char - s.U.name.length - 4) / 8, 0, 1));
      }
    }

    // 9. the flash over everything
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (s.flash > 0) { ctx.globalAlpha = Math.min(1, s.flash); ctx.fillStyle = s.flashCol; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    // the tap hint
    if (t > T.skip + 0.4 && t < T.card - 0.2 && !s.skipped) text(G.t('relicSkip') === 'relicSkip' ? 'TAP TO SKIP' : G.t('relicSkip'), W - 6, H - s.bar + Math.max(2, (s.bar - 8) / 2), 8, 'rgba(169,162,185,.8)', 'right', 0.5 + 0.3 * Math.sin(t * 4));
  }
  function physics(dt) {
    const s = show;
    for (let i = s.parts.length - 1; i >= 0; i--) {
      const p = s.parts[i];
      if ((p.life -= dt) <= 0) { s.parts.splice(i, 1); continue; }
      p.vy += p.g * dt; if (p.drag) { p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.floor != null && p.y > p.floor) { p.y = p.floor; p.vy *= -0.3; p.vx *= 0.6; }
    }
    if (s.parts.length > 900) s.parts.splice(0, s.parts.length - 900);
    for (let i = s.rings.length - 1; i >= 0; i--) { const r = s.rings[i]; if ((r.life -= dt) <= 0) s.rings.splice(i, 1); else r.r += r.v * dt * (r.life / r.max + 0.15); }
    for (const pc of s.pieces) { pc.vy += 260 * dt; pc.x += pc.vx * dt; pc.y += pc.vy * dt; pc.a += pc.va * dt; pc.life -= dt; }
    s.shake = Math.max(0, s.shake - dt * (s.shake > 6 ? 18 : 9));
    s.flash = Math.max(0, s.flash - dt * 2.4);
  }
  // god-rays turning round p, and the core glow in bands (rayOn: 0..1)
  function drawRays(p, rayOn, t) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const n = 16, R = Math.max(W, H) * 1.2, rot = t * 0.32;
    for (let i = 0; i < n; i++) {
      const a0 = rot + (i / n) * Math.PI * 2, wdt = (i % 2 ? 0.07 : 0.12) * (1 + 0.25 * Math.sin(t * 1.7 + i));
      ctx.fillStyle = (i % 4 === 1 ? 'rgba(255,208,244,' : i % 4 === 3 ? 'rgba(191,232,255,' : 'rgba(255,255,255,') + (0.085 * rayOn * (i % 2 ? 0.7 : 1)).toFixed(3) + ')';
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(a0 - wdt) * R, p.y + Math.sin(a0 - wdt) * R); ctx.lineTo(p.x + Math.cos(a0 + wdt) * R, p.y + Math.sin(a0 + wdt) * R); ctx.closePath(); ctx.fill();
    }
    // the core glow, in bands
    const pulse = 1 + 0.08 * Math.sin(t * 6);
    for (const [r, a, c] of [[56, 0.05, '150,200,255'], [42, 0.07, '255,170,240'], [30, 0.1, '200,230,255'], [20, 0.14, '255,255,255'], [12, 0.2, '255,255,255']]) { ctx.fillStyle = `rgba(${c},${a * rayOn})`; fillEllipse(p.x, p.y, r * pulse * 1.1, r * pulse * 1.1); }
    ctx.restore();
  }
  // the relic at p: huge, spinning, shimmering (age: seconds since it burst out)
  function drawRelic(p, age, t) {
    const s = show, img = SPR.get('rx_' + s.id, { oc: '#2a2440' });
    const pop = age < 0.45 ? 0.3 + 0.95 * ease(age / 0.3) - 0.25 * Math.max(0, (age - 0.3) / 0.15) : 1;
    const spin = Math.PI * 2 * 4 * ease(age / 2.4) + (age > 2.4 ? Math.sin((age - 2.4) * 1.3) * 0.45 : 0);
    const cx = Math.cos(spin), sc = s.is * pop * p.sc;
    // orbiting sparkles behind and in front
    const orb = (front) => { for (let i = 0; i < 10; i++) { const a = t * 1.6 + (i / 10) * Math.PI * 2, z = Math.sin(a); if ((z > 0) !== front) continue; const ox = p.x + Math.cos(a) * 11 * sc, oy = p.y + z * 3 * sc + Math.sin(a * 2 + t) * 2; const tw = 1 + ((t * 8 + i) % 3 < 1 ? 1 : 0); ctx.fillStyle = PRISM[i % PRISM.length]; ctx.fillRect(Math.round(ox) - tw, Math.round(oy), tw * 2 + 1, 1); ctx.fillRect(Math.round(ox), Math.round(oy) - tw, 1, tw * 2 + 1); } };
    orb(false);
    const kx = Math.max(0.06, Math.abs(cx)) * (cx >= 0 ? 1 : -1);
    // chromatic shimmer: magenta and cyan ghosts, wide just after the burst, then breathing
    const ab = age < 0.8 ? Math.round(3 * (1 - age / 0.8)) + 1 : (Math.sin(t * 3.1) > 0.92 ? 2 : 1);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    blit(tinted('m' + s.id, img, '#ff3ad0'), p.x - ab, p.y, sc, kx, 1, 0, 0.55);
    blit(tinted('c' + s.id, img, '#30e8ff'), p.x + ab, p.y, sc, kx, 1, 0, 0.55);
    ctx.restore();
    blit(img, p.x, p.y, sc, kx, 1, 0);
    // its back is in shadow
    if (cx < 0) blit(tinted('back' + s.id, img, '#3a3458'), p.x, p.y, sc, kx, 1, 0, 0.45 * Math.min(1, -cx * 2));
    // a white glint sweeping over it
    const sweep = (age * 0.8) % 1.6;
    if (sweep < 0.6) {
      const g = sheen(img, sweep / 0.6);
      blit(g, p.x, p.y, sc, kx, 1, 0, 0.85);
    }
    if (age < 0.25) blit(tinted('w' + s.id, img, '#ffffff'), p.x, p.y, sc, kx, 1, 0, 1 - age / 0.25);
    orb(true);
  }
  function drawParts() {
    const s = show;
    for (const p of s.parts) {
      let a = clamp(p.life / p.max * 1.8, 0, 1);
      if (p.tw) a *= 0.5 + 0.5 * Math.sin(p.life * 20);
      ctx.globalAlpha = a; ctx.fillStyle = p.col;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.sz, p.sz);
    }
    ctx.globalAlpha = 1;
    for (const r of s.rings) { ctx.globalAlpha = clamp(r.life / r.max * 1.4, 0, 1); ctx.fillStyle = r.col; strokeEllipse(r.x, r.y, r.r, r.r * 0.42, r.th); }
    ctx.globalAlpha = 1;
  }
  // R E L I C slammed in letter by letter from T0 (letter: seconds a letter), a lens streak when the last one lands
  function drawTitle(T0, letter, al, t) {
    const s = show, c = s.tx != null ? s.tx : s.hx;
    const size = s.ts, word = 'RELIC', step = size * 2, x0 = c - (word.length - 1) * step / 2;
    for (let i = 0; i < word.length; i++) {
      const lt = t - (T0 + i * letter);
      if (lt < 0) break;
      const pop = lt < 0.12 ? 1 + (1 - lt / 0.12) * 1.4 : 1;
      const hue = ((t * 0.6 + i * 0.17) % 1);
      const col = hue < 0.25 ? '#ffffff' : hue < 0.5 ? '#bfe8ff' : hue < 0.75 ? '#ffd0f4' : '#fff3a0';
      const lx = Math.round(x0 + i * step), ly = s.ty;
      if (pop > 1) { ctx.save(); ctx.translate(lx, ly + size / 2); ctx.scale(pop, pop); text(word[i], 0, -size / 2, size, '#ffffff', 'center', al); ctx.restore(); }
      else text(word[i], lx, ly, size, col, 'center', al);
    }
    // a lens streak through the title when the last letter lands
    const st = t - (T0 + 4 * letter);
    if (st > 0 && st < 0.7) { const k = 1 - st / 0.7; ctx.fillStyle = `rgba(255,255,255,${k})`; const w = W * ease(st / 0.25); ctx.fillRect(Math.round(c - w / 2), s.ty + size / 2, Math.round(w), 1); ctx.fillStyle = `rgba(191,232,255,${k * 0.5})`; ctx.fillRect(Math.round(c - w / 3), s.ty + size / 2 - 1, Math.round(w / 1.5), 3); }
  }
  // the sprite with a diagonal white band across it at k (0..1)
  let sheenC = null;
  function sheen(img, k) {
    if (!sheenC) sheenC = document.createElement('canvas');
    sheenC.width = img.width; sheenC.height = img.height;
    const x = sheenC.getContext('2d'), c = lerp(-4, img.width + img.height, k);
    x.clearRect(0, 0, img.width, img.height);
    x.drawImage(img, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = '#ffffff';
    x.beginPath(); x.moveTo(c, 0); x.lineTo(c + 3, 0); x.lineTo(c + 3 - img.height, img.height); x.lineTo(c - img.height, img.height); x.closePath(); x.fill();
    x.globalCompositeOperation = 'source-over';
    return sheenC;
  }

  // ================= The card =================
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  function mainLine(g) {
    const slot = G.slotOf(g.id), type = G.ITEM_TYPE[g.id], v = G.mainStat(g);
    if (slot === 'weapon') return G.t('g_weapon', G.WEAPONS[type].name, G.fmt(v, true), G.WEAPONS[type].targets);
    if (slot === 'armor') return G.t('g_armor', G.fmt(v));
    if (slot === 'ring') return G.t('g_ring', G.fmtPct(v));
    return G.t('g_ability', G.fmtPct(v), G.ABILITIES[type].name, G.ABILITIES[type].desc);
  }
  function showCard() {
    const s = show;
    if (s.card) return;
    // the card waits for a choice: taps round it don't fall through to the field
    root.classList.add('tap', 'held');
    const g = s.g, U = s.U, slot = G.slotOf(g.id), h = G.S.hero, cur = h.eq[slot];
    let pow = '';
    try {
      const a = cur && cur !== g ? G.powerWith(slot, cur) : 0, b = G.powerWith(slot, g);
      if (cur === g) pow = '';
      else if (!cur) pow = 'Power +' + G.fmt(b);
      else { const d = a > 0 ? b / a - 1 : 0; pow = 'Power ' + G.fmt(a) + ' → ' + G.fmt(b) + (d ? ` (${d > 0 ? '+' : ''}${Math.round(d * 100)}%)` : ''); }
    } catch (e) { pow = ''; }
    const found = Object.keys((G.S.rec && G.S.rec.relicN) || {}).length;
    const affs = g.a.map(([k, v]) => { const d = G.AFFIXES[k]; return d ? `<li>${esc(d.name)} <b>${d.x ? '+' + v.toFixed(2) + '×' : G.fmtPct(v)}</b></li>` : ''; }).join('');
    const el = document.createElement('div');
    el.className = 'rlCard';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Relic: ' + U.name);
    el.innerHTML = `<div class="rlTop"><span class="rlTag">R E L I C</span><small>${s.info.first ? 'NEW! ' : ''}${found}/${G.RELIC_IDS.length} found${s.info.lord ? ' · from a lord' : ''}</small></div>
      <h2>${esc(U.name)}</h2>
      <p class="rlSub">${esc(G.ITEM_BY_ID[g.id].name)} · ${esc(G.t('slot_' + slot))} · ${esc(G.t('ilvl', g.il))}</p>
      <p class="rlMain">${esc(mainLine(g))}</p>
      ${pow ? `<p class="rlPow">${esc(pow)}</p>` : ''}
      <ul>${affs}</ul>
      <div class="rlRule"><b>RULE</b>${esc(U.fx)}</div>
      ${U.lore ? `<p class="rlLore">“${esc(U.lore)}”</p>` : ''}
      <div class="rlBtns"><button type="button" class="btn rlEq" data-eq>${cur === g ? 'WORN' : 'EQUIP'}</button><button type="button" class="btn" data-later>LATER</button></div>`;
    el.addEventListener('pointerdown', e => e.stopPropagation());
    el.querySelector('[data-eq]').addEventListener('click', () => close(true));
    el.querySelector('[data-later]').addEventListener('click', () => close(false));
    root.appendChild(el);
    s.card = el;
    placeCard();
    setTimeout(() => { try { el.querySelector('[data-eq]').focus({ preventScroll: true }); } catch (e) { /* fine */ } }, 50);
  }
  function placeCard() {
    const s = show, el = s.card;
    if (!el) return;
    const vw = window.innerWidth, vh = window.innerHeight, w = Math.min(440, vw - 24);
    const top = Math.round((s.cy + 8 * s.is * s.cs + 8) * K);
    const left = Math.round(clamp(s.hx * K - w / 2, 12, vw - w - 12));
    el.style.left = left + 'px'; el.style.top = top + 'px'; el.style.maxHeight = Math.max(200, vh - top - 12) + 'px';
  }
  function close(equip) {
    const s = show;
    if (!s || s.out) return;
    const g = s.g;
    if (equip && G.S.hero.bag.includes(g)) G.equip(g);
    if (s.card) s.card.classList.add('out');
    root.classList.remove('tap', 'held');
    s.out = 0.0001;
    G.R.cine = 0;
    const app = document.getElementById('app');
    if (app) { app.classList.remove('rlDim'); app.classList.add('rlUndim'); }
    if (s.B) { try { const now = Snd.ac.currentTime; for (const n of [s.B.dry, s.B.send]) { n.gain.cancelScheduledValues(now); n.gain.setValueAtTime(n.gain.value, now); n.gain.linearRampToValueAtTime(0, now + 1.2); } } catch (e) { /* fine */ } }
    if (G.UI && G.UI.toast) G.UI.toast(`<span>${equip ? 'Equipped' : 'In your bag'}: <b style="color:#fff">${esc(s.U.name)}</b></span>`, 'ach', 'u_' + s.id);
  }
  function finish() {
    const s = show;
    show = null;
    if (s && s.belt) beltDone(s);
    if (s && s.card && s.card.parentNode) s.card.parentNode.removeChild(s.card);
    if (root) { root.style.display = 'none'; root.classList.remove('tap', 'held'); }
    const app = document.getElementById('app');
    if (app) app.classList.remove('rlDim');
    const wrap = document.getElementById('stageWrap');
    if (wrap) { wrap.style.transform = ''; wrap.style.transformOrigin = ''; }
    if (G.R.cine > 0 && !queue.length) G.R.cine = 0;
    if (queue.length) setTimeout(next, 250);
  }
  // ================= 4.0: a true relic onto the belt (DESIGN §5.7) =================
  // A belt rule has no item: no White Bag, no Equip/Later card. The short show (2.55 s, then a 0.45-s fade): the dark
  // closes on the Button, the spear strikes it, the relic bursts out of the light spinning, R E L I C slams in, its name
  // types in, its rule and the belt count show, then the field comes back - the done callback runs as the fade starts
  // (stage.js raises its relic pillar there). The field slows (visual only: the logic's clock is the run's), and the
  // Horde's clock is not held. Sound: audio.js's relic sting (its limiter's bus; throttled, so run_ui's call at the
  // same pick is not doubled) + A.relicStrike on the show's beats. A tap / Space / Enter / Esc after 0.5 s ends it
  // (a held key's repeats do not). Reduce effects / the low quality tiers: fewer particles, no star field.
  const TB = { spear: 0.16, hit: 0.4, burst: 0.48, title: 0.8, letter: 0.08, name: 1.25, char: 0.022, rule: 1.6, out: 2.55, skip: 0.5, fade: 0.45 };
  const lowQ = () => !!((G.Quality && G.Quality.tier >= 2) || (G.S && G.S.set && G.S.set.lowfx));
  G.relicBelt = function (id, done) {
    if (!G.RELICS[id] || !SPR.defs['rx_' + id]) return false;
    queue.push({ belt: id, done });
    if (!show) next();
    return true;
  };
  function startBelt(it) {
    const id = it.belt, U = G.UNIQUES[id] || G.RELICS[id], r = G.S && G.S.run;
    const Lc = x => (G.L ? G.L(x) : x || '');
    show = { belt: true, id, U, name: Lc(U.name), rule: Lc(U.fx), done: it.done, low: lowQ(),
      beltN: r && r.belt ? r.belt.length : 0, beltMax: r && r.beltMax ? r.beltMax : 0,
      t: 0, prev: -1, k: 1, kv: 1, parts: [], rings: [], cracks: [], pieces: [], shake: 0, flash: 0, flashCol: '#ffffff', card: null, out: 0, done1: false };
    layout();
    // (the relic rises higher than the 3.x show's: the rule needs two or three lines under the name)
    if (H < 260) show.is = 3;
    // the words' column: up to 30 characters wide, centred on the relic where it fits (the Button can sit far left)
    show.lw = Math.min(W - 16, 8 * 30); show.tx = Math.round(clamp(show.hx, show.lw / 2 + 8, W - show.lw / 2 - 8));
    show.hy = Math.round(clamp(Math.min(show.hy, H * 0.3), show.bar + 8 * show.is + 6, H * 0.5));
    show.ty = show.hy + 8 * show.is + 10;
    root.style.display = 'block'; root.classList.add('tap'); root.classList.remove('held');
    cv.style.opacity = '1';
    try { const A = G.Audio; if (A) { if (A.unlock) A.unlock(); if (A.lootUltra) A.lootUltra('relic'); if (A.relicStrike) A.relicStrike(); } } catch (e) { /* sound is a bonus */ }
    show.last = performance.now();
    requestAnimationFrame(loop);
  }
  // where the relic is: out of the strike, up to its place, bobbing
  function beltPos() {
    const s = show, k = ease((s.t - TB.burst) / 0.55);
    return { x: lerp(s.sx, s.hx, k), y: lerp(s.sy - 10, s.hy, k) + Math.sin(s.t * 2.2) * 2, sc: 1 };
  }
  function beltOut() {
    const s = show;
    if (!s || !s.belt || s.out) return;
    s.out = 0.0001;
    root.classList.remove('tap');
    beltDone(s);
  }
  function beltDone(s) {
    if (s.done1) return;
    s.done1 = true;
    if (typeof s.done === 'function') { try { s.done(); } catch (e) { console.error(e); } }
  }
  function stepBelt(dt) {
    const s = show, t = s.t, n = s.low ? 0.45 : 1;
    if (s.out > 0) { s.out += dt; s.kv = lerp(0.3, 1, clamp(s.out / TB.fade, 0, 1)); }
    else s.kv = lerp(1, 0.3, ease(t / 0.4));
    s.k = 1;
    if (passed(TB.hit)) {
      s.flash = 0.9; s.flashCol = '#ffffff'; s.shake = 10;
      ring(s.sx, s.sy, 3, 0.8, '#ffffff', 2, 480); ring(s.sx, s.sy, 2, 1.0, '#bfe8ff', 1, 300);
      burst(s.sx, s.sy - 2, Math.round(70 * n), 220, ['#ffffff', '#ffffff', '#bfe8ff', '#e4eaf6'], { floor: s.sy + 6 });
      burst(s.sx, s.sy - 2, Math.round(20 * n), 150, ['#3a3448', '#5a5470', '#2a2440'], { g: 340, drag: 1, floor: s.sy + 8 });
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + rnd(-0.25, 0.25), pts = [[s.sx, s.sy]];
        let x = s.sx, y = s.sy; const len = rnd(16, 40);
        for (let j = 0; j < 5; j++) { const aa = a + rnd(-0.5, 0.5); x += Math.cos(aa) * len / 5; y += Math.sin(aa) * len / 5 * 0.45; pts.push([x, y]); }
        s.cracks.push(pts);
      }
    }
    if (passed(TB.burst)) {
      s.flash = Math.max(s.flash, 0.7); s.shake = Math.max(s.shake, 7);
      burst(s.sx, s.sy - 10, Math.round(160 * n), 280, PRISM, { g: 30, drag: 1.6 });
      ring(s.sx, s.sy - 10, 4, 0.9, '#ffffff', 2, 420); ring(s.sx, s.sy - 10, 3, 1.1, '#ffd0f4', 1, 300); ring(s.sx, s.sy - 10, 2, 1.3, '#bfe8ff', 1, 200);
    }
    for (let i = 0; i < 5; i++) if (passed(TB.title + i * TB.letter)) {
      const step = s.ts * 2, lx = s.tx - (4 * step) / 2 + i * step;
      s.shake = Math.max(s.shake, i === 4 ? 4 : 2);
      burst(lx, s.ty + s.ts / 2, Math.round((i === 4 ? 30 : 10) * n), i === 4 ? 150 : 70, PRISM, { g: 40, drag: 2.5 });
      if (i === 4) s.flash = Math.max(s.flash, 0.25);
    }
    // light pours down the spear's trail, motes round the relic
    if (t > TB.hit && t < TB.burst + 0.6 && Math.random() < 0.7 * n) s.parts.push({ x: s.sx + rnd(-6, 6), y: s.sy - rnd(0, 20), vx: rnd(-4, 4), vy: rnd(-60, -25), life: rnd(0.5, 1.0), max: 1.0, col: pickc(PRISM), sz: 1, g: 0, drag: 0 });
    if (t > TB.burst && !s.out && Math.random() < 0.85 * n) { const p = beltPos(); s.parts.push({ x: p.x + rnd(-30, 30), y: p.y + rnd(-26, 30), vx: rnd(-5, 5), vy: rnd(-26, -8), life: rnd(0.6, 1.3), max: 1.3, col: pickc(PRISM), sz: Math.random() < 0.2 ? 2 : 1, g: 0, drag: 0, tw: 1 }); }
    physics(dt);
    if (!s.out && t >= TB.out) beltOut();
    if (s.out > TB.fade) finish();
  }
  function drawBelt() {
    const s = show, t = s.t;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);
    cv.style.opacity = String(s.out > 0 ? clamp(1 - s.out / TB.fade, 0, 1) : 1);
    const sh = G.S.set.shake ? s.shake : s.shake * 0.25;
    ctx.translate(Math.round(rnd(-1, 1) * sh), Math.round(rnd(-1, 1) * sh));
    // the dark, closing on the Button (a hole of light there until the burst)
    ctx.fillStyle = `rgba(4,3,9,${(ease(t / 0.3) * 0.93).toFixed(3)})`;
    ctx.fillRect(-20, -20, W + 40, H + 40);
    if (t < TB.burst + 0.3) {
      const k = ease(t / TB.hit), r = lerp(Math.max(W, H) * 0.7, 16, k) * (t > TB.hit ? 1 + 0.6 * Math.max(0, 1 - (t - TB.hit) * 3) : 1);
      const fh = t > TB.burst ? 1 - (t - TB.burst) / 0.3 : 1;
      ctx.globalCompositeOperation = 'destination-out';
      for (const [kr, a] of [[1, 0.25], [0.72, 0.45], [0.48, 0.65]]) { ctx.fillStyle = `rgba(0,0,0,${a * fh})`; fillEllipse(s.sx, s.sy - 6, r * kr, r * kr * 0.62); }
      ctx.globalCompositeOperation = 'source-over';
    }
    // stars once it is out
    if (t > TB.burst && !s.low) {
      if (!s.stars) { s.stars = []; for (let i = 0; i < 70; i++) s.stars.push({ x: Math.random() * W, y: Math.random() * H, ph: Math.random() * 6.3, c: pickc(PRISM) }); }
      const a = clamp((t - TB.burst) / 0.8, 0, 1);
      for (const st of s.stars) { ctx.globalAlpha = a * (0.5 + 0.5 * Math.sin(t * 2.5 + st.ph)) * 0.7; ctx.fillStyle = st.c; ctx.fillRect(Math.round(st.x), Math.round(st.y - t * 2), 1, 1); }
      ctx.globalAlpha = 1;
    }
    if (t > TB.burst) drawRays(beltPos(), clamp((t - TB.burst) / 0.5, 0, 1), t);
    // the spear: it falls on the Button, then thins out into a pillar and fades
    if (t >= TB.spear && t < TB.hit + 1.2) {
      const k = clamp((t - TB.spear) / (TB.hit - TB.spear), 0, 1), tip = lerp(-10, s.sy, easeIn(k));
      const after = Math.max(0, t - TB.hit), wide = t < TB.hit ? 4 : Math.max(1, 22 * Math.exp(-after * 4) + 2);
      const al = t < TB.hit ? 1 : clamp(1 - after / 1.2, 0, 1);
      ctx.fillStyle = `rgba(191,232,255,${0.55 * al})`; ctx.fillRect(Math.round(s.sx - wide - 2), -20, Math.round(wide * 2 + 5), tip + 20);
      ctx.fillStyle = `rgba(255,255,255,${al})`; ctx.fillRect(Math.round(s.sx - wide / 2), -20, Math.max(1, Math.round(wide)), tip + 20);
      if (t < TB.hit) { ctx.fillStyle = '#ffffff'; fillEllipse(s.sx, tip, 4, 6); }
    }
    // the ground glow and the cracks
    if (t > TB.hit && t < TB.burst + 1.2) {
      const al = t < TB.burst ? 1 : clamp(1 - (t - TB.burst) / 1.2, 0, 1);
      ctx.fillStyle = `rgba(191,232,255,${0.18 * al})`; fillEllipse(s.sx, s.sy + 1, 30, 9);
      ctx.fillStyle = `rgba(255,255,255,${0.35 * al})`; fillEllipse(s.sx, s.sy + 1, 16, 5);
      for (const c of s.cracks) for (let i = 1; i < c.length; i++) {
        const [x0, y0] = c[i - 1], [x1, y1] = c[i], m = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
        for (let j = 0; j < m; j++) { const px = Math.round(lerp(x0, x1, j / m)), py = Math.round(lerp(y0, y1, j / m)); ctx.fillStyle = `rgba(150,220,255,${0.5 * al})`; ctx.fillRect(px - 1, py, 3, 1); ctx.fillStyle = `rgba(255,255,255,${al})`; ctx.fillRect(px, py, 1, 1); }
      }
    }
    if (t >= TB.burst) drawRelic(beltPos(), t - TB.burst, t);
    drawParts();
    // the letterbox
    const bar = s.bar * ease(t / 0.35);
    if (bar > 0.5) { ctx.fillStyle = '#000000'; ctx.fillRect(-20, -20, W + 40, Math.round(bar) + 20); ctx.fillRect(-20, H - Math.round(bar), W + 40, Math.round(bar) + 20); }
    if (t >= TB.title) drawTitle(TB.title, TB.letter, 1, t);
    // the name types in; the rule and the belt under it
    let y = s.ty + s.ts + 12;
    if (t >= TB.name) {
      const maxC = Math.max(10, Math.floor(s.lw / 8)), lines = wrap(s.name, maxC);
      let left = Math.floor((t - TB.name) / TB.char);
      for (const ln of lines) { if (left > 0) text(ln.slice(0, left), s.tx, y, 8, '#ffffff', 'center'); left -= ln.length + 1; y += 11; }
    }
    if (t >= TB.rule) {
      const a = clamp((t - TB.rule) / 0.3, 0, 1), maxC = Math.max(12, Math.floor(s.lw / 8));
      y += 3;
      for (const ln of wrap(s.rule, maxC).slice(0, 5)) { text(ln, s.tx, y, 8, '#bfe8ff', 'center', a); y += 11; }
      if (s.beltMax) text(G.t('ff_beltN', s.beltN, s.beltMax), s.tx, y + 3, 8, '#8f9ab8', 'center', a);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (s.flash > 0) { ctx.globalAlpha = Math.min(1, s.flash); ctx.fillStyle = s.flashCol; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  }

  // for testing: the running show; the score rendered into an OfflineAudioContext
  G.relicShow = () => show;
  G.relicScoreTest = ac => { const was = Snd.ac; Snd.init(ac); const B = Snd.bus(); B.t0 = 0; score(B); Snd.ac = was; return ac.startRendering(); };
})(globalThis.G = globalThis.G || {});
