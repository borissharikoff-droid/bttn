// BTTN — synthesized chiptune SFX and a tiny per-realm music loop (WebAudio).
(function (G) {
  'use strict';
  const A = G.Audio = {};
  let ac = null, master = null, sfxBus = null, musicBus = null, unlocked = false;
  const last = {};

  A.unlock = function () {
    if (unlocked) { if (ac && ac.state === 'suspended') ac.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      master = ac.createGain(); master.connect(ac.destination);
      sfxBus = ac.createGain(); sfxBus.connect(master);
      musicBus = ac.createGain(); musicBus.connect(master);
      unlocked = true;
      A.apply();
      startMusic();
    } catch (e) { /* audio unavailable */ }
  };
  A.apply = function () {
    if (!ac) return;
    const s = G.S.set;
    master.gain.value = s.vol;
    sfxBus.gain.value = s.sound ? 0.5 : 0;
    musicBus.gain.value = s.music ? 0.16 : 0;
  };

  function throttle(key, ms) {
    const now = performance.now();
    if (last[key] && now - last[key] < ms) return false;
    last[key] = now; return true;
  }
  function tone(freq, dur, type, vol, when, slide, bus) {
    if (!ac) return;
    const t = ac.currentTime + (when || 0);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || sfxBus);
    o.start(t); o.stop(t + dur + 0.02);
  }
  let noiseBuf = null;
  function noise(dur, vol, when, hp) {
    if (!ac) return;
    if (!noiseBuf) {
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = ac.currentTime + (when || 0);
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 800;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol || 0.15, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(sfxBus);
    s.start(t); s.stop(t + dur + 0.02);
  }
  const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
  const note = n => 440 * Math.pow(2, (n - 9) / 12); // n: semitones from C4

  A.click = function (combo, crit) {
    if (!throttle('click', 28)) return;
    const step = PENTA[Math.min(PENTA.length - 1, Math.floor((combo || 0) / 12))];
    tone(note(12 + step), 0.06, 'square', 0.09, 0, note(12 + step) * 0.7);
    if (crit) { tone(note(31), 0.12, 'square', 0.08, 0.01); noise(0.08, 0.06, 0, 3000); }
  };
  A.coin = function () { if (!throttle('coin', 60)) return; tone(1320, 0.05, 'triangle', 0.08); tone(1760, 0.08, 'triangle', 0.07, 0.04); };
  A.chest = function (r) {
    if (!throttle('chest', 40)) return;
    const base = 12 + r * 2;
    const seq = [0, 4, 7, 12].slice(0, 2 + Math.min(2, r));
    seq.forEach((s, i) => tone(note(base + s), 0.09, 'square', 0.08, i * 0.05));
    noise(0.05, 0.05, 0, 2000);
    if (r >= 4) [0, 4, 7, 11, 14].forEach((s, i) => tone(note(24 + s), 0.25, 'triangle', 0.07, 0.2 + i * 0.06));
    if (r >= 6) { [0, 7, 12, 16, 19, 24].forEach((s, i) => tone(note(28 + s), 0.5, 'sine', 0.08, 0.5 + i * 0.08)); }
  };
  A.buy = function () { if (!throttle('buy', 50)) return; tone(880, 0.05, 'square', 0.07); tone(1175, 0.09, 'square', 0.07, 0.05); };
  A.error = function () { if (!throttle('err', 120)) return; tone(160, 0.15, 'sawtooth', 0.06, 0, 110); };
  A.merge = function () { if (!throttle('merge', 80)) return; tone(300, 0.2, 'triangle', 0.08, 0, 900); noise(0.15, 0.04, 0, 1200); };
  A.bossHit = function () { if (!throttle('bhit', 45)) return; noise(0.06, 0.08, 0, 400); tone(110, 0.06, 'square', 0.05, 0, 70); };
  A.bossStart = function (lord) { tone(98, 0.5, 'sawtooth', 0.1, 0, 60); tone(147, 0.5, 'sawtooth', 0.07, 0.1, 90); if (lord) tone(73, 0.9, 'sawtooth', 0.1, 0.25, 40); };
  A.bossWin = function () { [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tone(note(12 + s), 0.18, 'square', 0.08, i * 0.07)); noise(0.3, 0.08, 0, 300); };
  A.bossFail = function () { [7, 4, 0, -5].forEach((s, i) => tone(note(12 + s), 0.2, 'triangle', 0.08, i * 0.1)); };
  A.wisp = function () { [0, 7, 12, 19].forEach((s, i) => tone(note(24 + s), 0.15, 'sine', 0.06, i * 0.05)); };
  A.catchWisp = function () { [0, 4, 7, 12, 16, 19, 24, 28].forEach((s, i) => tone(note(24 + s), 0.12, 'triangle', 0.07, i * 0.035)); };
  A.achievement = function () { [0, 7, 12, 16].forEach((s, i) => tone(note(19 + s), 0.2, 'square', 0.07, i * 0.09)); };
  A.lightning = function () { noise(0.25, 0.1, 0, 1500); tone(1800, 0.2, 'sawtooth', 0.03, 0, 300); };
  A.pull = function (tier) { [0, 5, 7, 12].forEach((s, i) => tone(note(17 + s + tier * 2), 0.12, 'triangle', 0.07, i * 0.06)); };
  A.ascend = function () { [0, 4, 7, 12, 16, 19, 24, 28, 31].forEach((s, i) => tone(note(7 + s), 0.5, 'sine', 0.07, i * 0.1)); };

  // ---------- Music: 16-step loop, mood per realm ----------
  const MOODS = [
    { bass: [0, 0, 7, 7, 5, 5, 3, 7], lead: [12, 16, 19, 16, 14, 12, 9, 12], tempo: 0.2 },
    { bass: [0, 0, 5, 5, 7, 7, 5, 4], lead: [12, 14, 16, 19, 16, 14, 12, 7], tempo: 0.19 },
    { bass: [-3, -3, 0, 0, 2, 2, -5, -5], lead: [9, 12, 14, 12, 9, 7, 9, 4], tempo: 0.21 },
    { bass: [0, 0, -2, -2, -4, -4, -5, -5], lead: [12, 15, 17, 15, 12, 10, 12, 7], tempo: 0.2 },
    { bass: [-3, -3, -7, -7, -5, -5, -8, -8], lead: [9, 12, 16, 12, 9, 7, 4, 7], tempo: 0.23 },
    { bass: [0, 0, 1, 1, 0, 0, -2, -2], lead: [12, 13, 16, 13, 12, 10, 8, 7], tempo: 0.22 },
    { bass: [-5, -5, -4, -4, -5, -5, -7, -7], lead: [7, 8, 11, 8, 7, 5, 4, 1], tempo: 0.18 },
    { bass: [-12, -12, -11, -11, -9, -9, -8, -8], lead: [0, 3, 6, 9, 6, 3, 1, -2], tempo: 0.25 },
  ];
  let step = 0, musicTimer = null;
  function startMusic() {
    if (musicTimer) return;
    const tickMusic = () => {
      if (!ac) return;
      const S = G.S;
      const mood = MOODS[G.realmIndex(S.depth) % MOODS.length];
      const boss = G.R.boss;
      const tempo = boss ? mood.tempo * 0.75 : mood.tempo;
      if (S.set.music && ac.state === 'running') {
        const i = step % 16, bar = Math.floor(step / 16) % 2;
        if (i % 2 === 0) tone(note(mood.bass[(i / 2) | 0] - 12), tempo * 1.8, 'triangle', 0.22, 0, null, musicBus);
        if (i % 4 === 2 || (boss && i % 2 === 1)) noiseM(0.03);
        if (bar === 1 || boss) {
          const n = mood.lead[(i / 2 | 0) % 8];
          if (i % 2 === 0) tone(note(n + (boss ? 12 : 0)), tempo * 0.9, 'square', 0.06, 0, null, musicBus);
        }
      }
      step++;
      musicTimer = setTimeout(tickMusic, tempo * 1000);
    };
    tickMusic();
  }
  function noiseM(vol) {
    if (!ac || !noiseBuf) { noise(0.001, 0.0001); }
    const t = ac.currentTime;
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    s.connect(f); f.connect(g); g.connect(musicBus); s.start(t); s.stop(t + 0.06);
  }

  // Wire game events
  G.on('click', ev => { A.click(ev.combo, ev.crit || ev.mega); if (ev.dmg) A.bossHit(); });
  G.on('chestOpen', loot => { if (loot.source === 'offline') return; A.chest(loot.items.reduce((m, x) => Math.max(m, x.it.r), 0)); });
  G.on('merge', () => A.merge());
  G.on('buy', () => A.buy());
  G.on('bossStart', b => A.bossStart(b.lord));
  G.on('bossWin', () => A.bossWin());
  G.on('bossFail', () => A.bossFail());
  G.on('wisp', () => A.wisp());
  G.on('wispCatch', () => A.catchWisp());
  G.on('achievement', () => A.achievement());
  G.on('lightning', () => A.lightning());
  G.on('chestHit', () => A.bossHit());
  G.on('ascend', () => A.ascend());
})(globalThis.G = globalThis.G || {});
