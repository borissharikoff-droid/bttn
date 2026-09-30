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
  function ensureNoise() {
    if (noiseBuf) return;
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  function noise(dur, vol, when, hp) {
    if (!ac) return;
    ensureNoise();
    const t = ac.currentTime + (when || 0);
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 800;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol || 0.15, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(sfxBus);
    s.start(t); s.stop(t + dur + 0.02);
  }
  // Low-passed noise: the body of a crunch
  function thud(dur, vol, when, lp) {
    if (!ac) return;
    ensureNoise();
    const t = ac.currentTime + (when || 0);
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    s.playbackRate.value = 0.6 + Math.random() * 0.5;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp || 1800;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(sfxBus);
    s.start(t, Math.random() * 0.3); s.stop(t + dur + 0.02);
  }
  const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
  const note = n => 440 * Math.pow(2, (n - 9) / 12); // n: semitones from C4

  // Clicks climb the scale as the combo builds, and never sound exactly the same twice
  let clickVar = 0;
  A.click = function (combo, crit) {
    if (!throttle('click', 28)) return;
    const i = Math.min(PENTA.length - 1, Math.floor((combo || 0) / 3)), step = PENTA[i];
    clickVar = (clickVar + 1 + Math.floor(Math.random() * 3)) % 4;
    const f = note(12 + step) * (1 + (Math.random() - 0.5) * 0.01);
    tone(f, 0.06, clickVar === 1 ? 'triangle' : 'square', 0.085, 0, f * (clickVar === 2 ? 0.6 : 0.72));
    tone(150, 0.05, 'sine', 0.1, 0, 60); // a little body under the blip
    noise(0.012, 0.04, 0, 5000);
    if (clickVar === 3) noise(0.02, 0.03, 0, 4000);
    if (i === PENTA.length - 1) tone(f * 1.5, 0.05, 'triangle', 0.04, 0.01);
    if (crit) { tone(note(31), 0.12, 'square', 0.08, 0.01); noise(0.08, 0.06, 0, 3000); thud(0.06, 0.08, 0, 700); }
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
  // Deaths in the same instant share one crunch that gets heavier with the pile
  let crunchN = 0, crunchW = 0, crunchT = null;
  A.crunch = function (kind) {
    if (!ac) return;
    crunchN++; crunchW = Math.max(crunchW, kind === 'rare' ? 3 : kind === 'magic' ? 2 : kind === 'brute' ? 1 : 0);
    if (crunchT) return;
    crunchT = setTimeout(() => {
      const n = crunchN, w = crunchW;
      crunchT = null; crunchN = 0; crunchW = 0;
      const v = Math.min(0.22, 0.07 + 0.012 * n + 0.04 * w);
      thud(0.06 + 0.02 * w, v, 0, 1400 + Math.random() * 1400);
      noise(0.03, v * 0.5, 0, 2500 + Math.random() * 2000);
      if (w >= 1 || n >= 6) tone(95 + Math.random() * 30, 0.1 + 0.05 * w, 'square', 0.05 + 0.02 * w, 0, 45);
      if (w >= 3) { tone(60, 0.35, 'sawtooth', 0.09, 0.02, 30); noise(0.25, 0.08, 0.02, 300); }
    }, 16);
  };
  // A drop hitting the ground; the rare ones ring out like a divine orb in PoE
  A.drop = function (tier) {
    if (!throttle('drop', 60)) return;
    thud(0.05, 0.08, 0, 900);
    if (tier >= 3) [0, 7, 12].forEach((s, i) => tone(note(24 + s + tier), 0.14, 'triangle', 0.05, i * 0.04));
    if (tier >= 5) [0, 4, 7, 12, 16].forEach((s, i) => tone(note(31 + s), 0.3, 'sine', 0.06, 0.12 + i * 0.05));
  };
  // A bell: sine partials with a quick strike, the core of every good drop sound
  function bell(f, dur, vol, when) {
    [[1, 1], [2.76, 0.5], [5.4, 0.25], [8.93, 0.12]].forEach(([m, g]) => tone(f * m, dur / Math.sqrt(m), 'sine', vol * g, when));
  }
  // Loot hitting the ground. L is how much it matters (0 junk .. 8 top tier);
  // p climbs a semitone per drop while a shower is coming down.
  // the music steps back for a big drop
  function duck(sec) { if (!ac || !G.S.set.music) return; const t = ac.currentTime; musicBus.gain.cancelScheduledValues(t); musicBus.gain.setValueAtTime(0.04, t); musicBus.gain.linearRampToValueAtTime(0.16, t + sec); }
  A.loot = function (kind, L, p) {
    if (!ac) return;
    if (L >= 5) duck(1.4);
    if (!throttle('loot' + Math.min(L, 3), L >= 4 ? 120 : 45)) return;
    const up = Math.pow(2, (p || 0) / 12);
    thud(0.05, 0.07 + 0.01 * L, 0, 900);
    if (kind === 'orb') tone(2200 * up, 0.05, 'triangle', 0.05, 0.01);
    if (L === 2) tone(note(36) * up, 0.12, 'triangle', 0.06, 0.01);
    if (L === 3) [0, 0.09, 0.18].forEach((w, i) => { tone(note(36) * up, 0.18, 'triangle', 0.06 * Math.pow(0.4, i), w); tone(note(43) * up, 0.18, 'triangle', 0.05 * Math.pow(0.4, i), w + 0.05); });
    if (L === 4) { bell(520, 1.2, 0.09); noise(0.02, 0.06, 0, 3000); }
    if (L === 5 || L === 6) { tone(60, 0.4, 'sine', 0.16, 0, 35); bell(660, 1.4, 0.09, 0.02); [0, 4, 7, 12].forEach((s, i) => tone(note(31 + s), 0.3, 'triangle', 0.05, 0.1 + i * 0.07)); }
    if (L === 7) { tone(55, 0.6, 'sine', 0.18, 0, 30); bell(330, 2, 0.1); bell(495, 1.6, 0.06, 0.08); [0, 7, 12, 16, 19].forEach((s, i) => tone(note(24 + s), 0.4, 'sine', 0.05, 0.15 + i * 0.08)); }
    if (L >= 8) { tone(50, 0.8, 'sine', 0.2, 0, 28); bell(880, 2.4, 0.1); bell(1320, 2, 0.05, 0.1); [0, 4, 7, 11, 14, 19, 23].forEach((s, i) => tone(note(31 + s), 0.6, 'sine', 0.05, 0.2 + i * 0.09)); noise(0.6, 0.05, 0.1, 5000); }
  };
  A.pick = function (kind) {
    if (!throttle('pick', 50)) return;
    if (kind === 'orb') tone(3000 + Math.random() * 600, 0.03, 'triangle', 0.04);
    else if (kind === 'uq') bell(990, 0.5, 0.05);
    else thud(0.03, 0.05, 0, 1200);
  };
  // The Hoarder giggles when it shows up
  A.hoard = function () { [19, 16, 21, 16, 23, 19].forEach((s, i) => tone(note(24 + s), 0.06, 'square', 0.05, i * 0.07, note(24 + s) * 1.1)); };
  A.jackpot = function () {
    for (let i = 0; i < 14; i++) tone(1320 * Math.pow(2, i / 14), 0.06, 'triangle', 0.05, i * 0.035);
    [0, 4, 7, 12, 16].forEach((s, i) => tone(note(24 + s), 0.25, 'square', 0.06, 0.5 + i * 0.06));
  };
  A.shrine = function (use) {
    if (!use) { [0, 7, 12].forEach((s, i) => tone(note(24 + s), 0.3, 'sine', 0.05, i * 0.1)); return; }
    tone(220, 0.5, 'sawtooth', 0.05, 0, 880); bell(660, 1, 0.07, 0.1);
    [0, 4, 7, 12, 16, 19].forEach((s, i) => tone(note(19 + s), 0.18, 'square', 0.05, 0.15 + i * 0.05));
  };
  A.breach = function () { noise(0.8, 0.08, 0, 300); tone(70, 1.2, 'sawtooth', 0.08, 0, 45); tone(105, 1.2, 'sawtooth', 0.05, 0.1, 70); };
  A.boom = function () { if (!throttle('boom', 70)) return; thud(0.15, 0.14, 0, 500); tone(80, 0.18, 'square', 0.06, 0, 40); noise(0.08, 0.05, 0, 1500); };
  A.rift = function (n) {
    if (n === 0) { noise(0.9, 0.06, 0, 200); [0, 3, 7, 12].forEach((s, i) => tone(note(7 + s), 0.6, 'sawtooth', 0.04, i * 0.12)); tone(55, 1.4, 'sine', 0.12, 0, 40); }
    else if (n === 1) { [0, 4, 7, 12, 16, 19, 24, 28].forEach((s, i) => tone(note(19 + s), 0.25, 'square', 0.06, i * 0.07)); bell(880, 1.5, 0.08, 0.5); }
    else [7, 3, 0, -5, -9].forEach((s, i) => tone(note(12 + s), 0.3, 'triangle', 0.07, i * 0.12));
  };
  // Crafting: each orb has its own sound, and a ruined gamble sounds like one
  A.orb = function (res) {
    if (res === 'whet') { noise(0.18, 0.06, 0, 5000); tone(1800, 0.2, 'sawtooth', 0.02, 0, 2400); }
    else if (res === 'flux') { for (let i = 0; i < 6; i++) tone(note(24 + (i * 5) % 12), 0.05, 'square', 0.04, i * 0.04); }
    else if (res === 'ascent') [0, 4, 7, 12, 16].forEach((s, i) => tone(note(24 + s), 0.12, 'triangle', 0.06, i * 0.05));
    else if (res === 'grace') { bell(880, 1.4, 0.09); [0, 7, 12, 19].forEach((s, i) => tone(note(31 + s), 0.3, 'sine', 0.05, 0.1 + i * 0.07)); }
    else if (res === 'ruin_none') { tone(90, 0.5, 'sawtooth', 0.08, 0, 45); noise(0.3, 0.06, 0, 400); }
    else { tone(70, 0.4, 'sawtooth', 0.08, 0, 40); bell(440, 1.2, 0.08, 0.2); [0, 3, 7, 10].forEach((s, i) => tone(note(19 + s), 0.2, 'square', 0.05, 0.3 + i * 0.06)); }
  };
  // a boss winding up: a rising sweep in the move's own voice
  A.windup = function (k) {
    const f = k === 'shield' ? 300 : k === 'summon' ? 150 : 200;
    tone(f, 1.1, k === 'shield' ? 'triangle' : 'sawtooth', 0.06, 0, f * 4);
    if (k === 'summon') noise(0.8, 0.04, 0, 600);
  };
  A.stagger = function () { thud(0.2, 0.18, 0, 600); bell(440, 0.8, 0.08); [12, 16, 19, 24].forEach((s, i) => tone(note(12 + s), 0.1, 'square', 0.06, 0.05 + i * 0.04)); };
  A.levelUp = function () { [0, 4, 7, 12, 16].forEach((s, i) => tone(note(19 + s), 0.14, 'square', 0.06, i * 0.05)); tone(note(43), 0.35, 'triangle', 0.05, 0.25); };
  A.zap = function () { if (!throttle('zap', 45)) return; noise(0.05, 0.06, 0, 3500); thud(0.08, 0.07, 0, 700); tone(1400 + Math.random() * 400, 0.06, 'sawtooth', 0.04, 0, 300); };
  // XP crystals: a tink that climbs while they keep coming
  let gemN = 0, gemT = 0;
  A.gem = function () {
    if (!ac || !throttle('gem', 35)) return;
    const now = performance.now(); gemN = now - gemT < 600 ? Math.min(14, gemN + 1) : 0; gemT = now;
    tone(note(31 + PENTA[gemN % PENTA.length]), 0.05, 'triangle', 0.035);
  };
  A.streak = function (n) { [0, 4, 7, 12].forEach((s, i) => tone(note(19 + s + Math.min(12, Math.log2(n / 25) * 3)), 0.12, 'square', 0.06, i * 0.05)); thud(0.12, 0.1, 0, 500); };
  A.bite = function () { if (!throttle('bite', 90)) return; thud(0.05, 0.08, 0, 400); tone(90, 0.06, 'square', 0.04, 0, 60); };
  A.overload = function () { tone(220, 0.8, 'sawtooth', 0.1, 0, 40); noise(0.6, 0.1, 0, 300); };
  A.perk = function () { [0, 7, 12, 19].forEach((s, i) => tone(note(24 + s), 0.1, 'triangle', 0.06, i * 0.04)); };
  A.evolve = function () { bell(660, 1.6, 0.1); [0, 4, 7, 11, 14, 19, 24].forEach((s, i) => tone(note(19 + s), 0.3, 'square', 0.05, 0.1 + i * 0.07)); };
  A.nova = function () { if (!throttle('nova', 200)) return; thud(0.25, 0.14, 0, 800); tone(300, 0.3, 'sine', 0.06, 0, 80); };
  A.comboUp = function (tier) { [0, 4, 7].forEach((s, i) => tone(note(24 + tier * 4 + s), 0.1, 'square', 0.05, i * 0.04)); if (tier === 3) bell(880, 0.8, 0.06, 0.12); };
  A.horn = function () { tone(110, 0.9, 'sawtooth', 0.09, 0, 98); tone(165, 0.9, 'sawtooth', 0.06, 0.05, 147); noise(0.5, 0.03, 0, 200); };
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
  G.on('mobDie', m => A.crunch(m.kind));
  G.on('heroAttack', ev => { if (ev.src === 'click' && !ev.boss) A.zap(); });
  G.on('surge', () => A.horn());
  G.on('rareSpawn', () => tone(note(7), 0.4, 'triangle', 0.06, 0, note(0)));
  G.on('orb', (id, g, res) => A.orb(res));
  G.on('mobBite', () => A.bite());
  G.on('buttonBreak', () => A.overload());
  G.on('perk', () => A.perk());
  G.on('evolve', () => A.evolve());
  G.on('nova', () => A.nova());
})(globalThis.G = globalThis.G || {});
