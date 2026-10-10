// BTTN — synthesized chiptune SFX and a tiny per-realm music loop (WebAudio).
(function (G) {
  'use strict';
  const A = G.Audio = {};
  let ac = null, master = null, sfxBus = null, musicBus = null, unlocked = false;
  const last = {};

  // (4.0: resume() is a promise: Safari rejects it with 'Failed to start the audio device' when iOS holds the audio; a
  // try/catch does not see that, so the rejection is caught here and nothing reaches the page as an unhandled one)
  const resume = () => { try { const p = ac.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* fine */ } };
  A.unlock = function () {
    if (unlocked) { if (ac && ac.state === 'suspended') resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      if (ac.state === 'suspended') resume();
      master = ac.createGain(); master.connect(ac.destination);
      // 4.0: every sound effect goes through a limiter before the master: the tier stings stack many voices (louder and
      // longer than 3.x's), and a JACKPOT or a relic over a crunch of the Horde must never clip
      limiter = ac.createDynamicsCompressor ? ac.createDynamicsCompressor() : null;
      if (limiter) {
        const set = (p, v) => { try { p.value = v; } catch (e) { /* older engines */ } };
        // (a high threshold and no knee: it only touches the peaks; WebAudio adds a makeup gain to every compressor, so a
        // trim after it keeps the everyday sounds at their 3.x level - measured: tests/fieldfx/audio.js)
        set(limiter.threshold, -1.5); set(limiter.knee, 0); set(limiter.ratio, 20); set(limiter.attack, 0.002); set(limiter.release, 0.18);
        const trim = ac.createGain(); trim.gain.value = 0.92;
        limiter.connect(trim); trim.connect(master);
      }
      sfxBus = ac.createGain(); sfxBus.connect(limiter || master);
      musicBus = ac.createGain(); musicBus.connect(master);
      unlocked = true;
      A.apply();
      startMusic();
    } catch (e) { /* audio unavailable */ }
  };
  let limiter = null;
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
  // 3.6: no sound nodes at all for a muted bus or a hidden tab (they were made and played into silence)
  const quiet = bus => { const s = G.S && G.S.set; if (!s || !(s.vol > 0) || (typeof document !== 'undefined' && document.hidden)) return true; return bus === musicBus ? !s.music : !s.sound; };
  function tone(freq, dur, type, vol, when, slide, bus) {
    if (!ac || quiet(bus || sfxBus)) return;
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
    if (!ac || quiet(sfxBus)) return;
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
    if (!ac || quiet(sfxBus)) return;
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
      // a bright tick on top that climbs as the Carnage streak does
      if (throttle('ktick', 45)) { const tier = G.carnage ? G.carnage().tier : 0; tone(note(24 + tier * 2 + Math.floor(Math.random() * 3)), 0.025, 'square', 0.018 + 0.004 * tier); }
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
    // 4.0: 'item' is a loot moment's card turning over (js/run_ui.js): the card's flip and its tier's sting
    if (kind === 'item') { A.lootFlip(L); return; }
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
  // a heap of the Horde dying in one frame: a deep crunch with a bright top
  A.bossCount = function (n) { tone(n === 1 ? 660 : 440, 0.12, 'square', 0.07); thud(0.08, 0.1, 0, 500); };
  A.pulse = function () { if (!throttle('pulse', 300)) return; tone(220, 0.25, 'triangle', 0.06, 0, 440); thud(0.1, 0.1, 0, 600); };
  A.wipe = function () { tone(196, 1.2, 'sawtooth', 0.1, 0, 49); tone(147, 1.4, 'sawtooth', 0.08, 0.1, 37); noise(0.8, 0.1, 0, 200); thud(0.4, 0.2, 0, 300); };
  A.phase = function () { tone(110, 0.7, 'sawtooth', 0.1, 0, 55); noise(0.4, 0.08, 0, 400); thud(0.3, 0.18, 0, 400); [0, 3, 7].forEach((s, i) => tone(note(s), 0.3, 'square', 0.06, 0.2 + i * 0.08)); };
  A.invasion = function (k) { const base = k === 'heaven' ? 12 : k === 'cosmic' ? 7 : k === 'deep' ? -5 : 3; [0, 5, 10, 15, 12].forEach((s, i) => tone(note(base + s), 0.35, k === 'cosmic' ? 'sawtooth' : 'triangle', 0.08, i * 0.12, k === 'cosmic' ? note(base + s + 12) : null)); noise(0.6, 0.05, 0, 800); };
  A.down = function () { tone(330, 0.3, 'square', 0.07, 0, 110); };
  A.revive = function () { [0, 4, 7, 12].forEach((s, i) => tone(note(12 + s), 0.12, 'triangle', 0.07, i * 0.05)); };
  A.heap = function (n) { if (!throttle('heap', 180)) return; thud(0.14, 0.16, 0, 700); noise(0.12, 0.08, 0, 900); tone(note(7 + Math.min(12, Math.log2(n / 10) * 4)), 0.08, 'square', 0.05, 0.02); };
  A.spit = function () { if (!throttle('spit', 120)) return; tone(420, 0.06, 'triangle', 0.04, 0, 260); noise(0.04, 0.03, 0, 3000); };
  A.carnage = function (t) { if (!t) return; [0, 5, 9, 12].forEach((s, i) => tone(note(14 + s + t * 2), 0.1, 'square', 0.05, i * 0.04)); };
  A.star = function () { [0, 4, 7, 12, 16, 19].forEach((s, i) => tone(note(12 + s), 0.22, 'triangle', 0.08, i * 0.07)); thud(0.2, 0.14, 0, 600); };
  A.wave = function () { tone(98, 0.6, 'sawtooth', 0.07, 0, 131); tone(147, 0.6, 'sawtooth', 0.05, 0.05, 196); thud(0.15, 0.12, 0, 500); };
  // a sting for each sudden event
  const EV_STING = {
    stampede: { seq: [0, 0, -5, -5, 0], type: 'sawtooth', base: 7, step: 0.09 },
    goldrush: { seq: [0, 4, 7, 12, 16, 19], type: 'square', base: 24, step: 0.05 },
    chestrain: { seq: [12, 7, 4, 0, 7, 12], type: 'triangle', base: 22, step: 0.06 },
    goblins: { seq: [0, 3, 0, 5, 7], type: 'square', base: 19, step: 0.07 },
    meteors: { seq: [12, 7, 2, -3], type: 'sawtooth', base: 14, step: 0.1 },
    bloodmoon: { seq: [0, 3, 7, 6], type: 'triangle', base: 5, step: 0.16 },
    ambush: { seq: [0, 6, 0, 6, 0, 6], type: 'sawtooth', base: 12, step: 0.07 },
    swarm: { seq: [0, 1, 0, 1, 0, 1, 0, 1], type: 'square', base: 26, step: 0.03 },
    frenzy: { seq: [0, 5, 7, 12, 17, 19, 24], type: 'square', base: 17, step: 0.035 },
  };
  A.event = function (k) {
    const e = EV_STING[k]; if (!e) return;
    e.seq.forEach((s, i) => tone(note(e.base + s), e.step * 1.8, e.type, 0.07, i * e.step));
    if (k === 'stampede' || k === 'meteors' || k === 'ambush') { thud(0.3, 0.12, 0, 300); noise(0.5, 0.05, 0.05, 400); }
  };
  // the JACKPOT: a slot machine running up, the big chord, bells
  A.jackpot = function () {
    for (let i = 0; i < 24; i++) tone(note(24 + (i * 5) % 24), 0.06, 'square', 0.05, i * 0.045);
    [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tone(note(24 + s), 1.4, i % 2 ? 'triangle' : 'square', 0.05, 1.1 + i * 0.02));
    for (let i = 0; i < 10; i++) tone(note(48 + [0, 7, 12, 16][i % 4]), 0.35, 'sine', 0.05, 1.3 + i * 0.16);
    thud(0.5, 0.16, 1.1, 250); noise(1.2, 0.04, 1.1, 3000);
  };
  // the Button low on health: a heartbeat
  A.heartbeat = function () { thud(0.12, 0.13, 0, 160); thud(0.1, 0.09, 0.16, 140); };
  A.whoosh = function () { if (!throttle('whoosh', 120)) return; noise(0.35, 0.025, 0, 1800); tone(900, 0.35, 'sine', 0.012, 0, 200); };
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

  // ---------- 4.0: the Siege's sounds (DESIGN §5.3 / ADDENDUM 1: one sting a tier, louder and longer than a field drop) ----------
  // voice(): an oscillator with a real envelope (attack, hold, release), detune, a vibrato and an optional low-pass sweep;
  // the stings are built from it. Every voice goes through sfxBus -> the limiter, so stacked chords never clip.
  function voice(f, dur, o) {
    o = o || {};
    if (!ac || quiet(sfxBus)) return;
    const t = ac.currentTime + (o.when || 0), att = o.att || 0.01, rel = Math.max(0.05, o.rel || dur * 0.6);
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(f, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, o.slide), t + (o.slideT || dur));
    if (o.det) osc.detune.setValueAtTime(o.det, t);
    let tail = osc;
    if (o.lp) {
      const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = o.q || 1;
      fl.frequency.setValueAtTime(o.lp, t); if (o.lp2) fl.frequency.exponentialRampToValueAtTime(o.lp2, t + (o.lpT || dur));
      osc.connect(fl); tail = fl;
    }
    if (o.vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = o.vibF || 5.5; lg.gain.value = f * o.vib; l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + dur + 0.05); }
    const v = o.vol || 0.06, hold = Math.max(att, dur - rel);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + att);
    g.gain.setValueAtTime(v, t + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    tail.connect(g); g.connect(sfxBus);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  // shaped noise: a band/high/low-pass sweep from f0 to f1 (a whoosh, a cymbal, a snare, a crack)
  function hiss(dur, vol, when, type, f0, f1, att, q) {
    if (!ac || quiet(sfxBus)) return;
    ensureNoise();
    const t = ac.currentTime + (when || 0);
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = type || 'bandpass'; f.Q.value = q || 1.2;
    f.frequency.setValueAtTime(f0 || 1000, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain(); const a = att || 0.005;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(sfxBus);
    s.start(t, Math.random() * 0.3); s.stop(t + dur + 0.05);
  }
  const boom = (v, w, f0) => { voice(f0 || 72, 1.3, { type: 'sine', vol: v, when: w, slide: 30, att: 0.004, rel: 1.1 }); thud(0.5, v * 0.9, w || 0, 220); };
  const snare = (v, w) => { hiss(0.14, v, w, 'highpass', 1800, 1200); voice(190, 0.08, { type: 'triangle', vol: v * 0.6, when: w, slide: 120 }); };
  const crash = (v, w, d) => hiss(d || 1.6, v, w, 'highpass', 5000, 7000, 0.004, 0.5);
  // a choir 'aah': detuned saws through the two formants of an open vowel, a slow swell and a singer's vibrato
  function choir(notes, dur, vol, when) {
    if (!ac || quiet(sfxBus)) return;
    const t = ac.currentTime + (when || 0);
    for (const n of notes) {
      const f = note(n);
      for (const d of [-7, 6]) {
        const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d;
        const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 5 + Math.random(); lg.gain.value = f * 0.007; l.connect(lg); lg.connect(o.frequency);
        const g = ac.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.32); g.gain.setValueAtTime(vol, t + dur * 0.55); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        for (const [ff, q, k] of [[780, 6, 1], [1180, 7, 0.6], [2600, 8, 0.25]]) {
          const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = ff; bp.Q.value = q;
          const kg = ac.createGain(); kg.gain.value = k * 2.2;
          o.connect(bp); bp.connect(kg); kg.connect(g);
        }
        g.connect(sfxBus);
        o.start(t); o.stop(t + dur + 0.05); l.start(t); l.stop(t + dur + 0.05);
      }
    }
  }
  const bellAt = (n, d, v, w) => bell(note(n), d, v, w);
  // the music steps back while a sting plays (and comes back up after it)
  function duckFor(sec) { if (!ac || !G.S.set.music) return; const t = ac.currentTime; musicBus.gain.cancelScheduledValues(t); musicBus.gain.setValueAtTime(0.03, t); musicBus.gain.setValueAtTime(0.03, t + sec * 0.7); musicBus.gain.linearRampToValueAtTime(0.16, t + sec); }

  // the loot moment's card turning over: a paper snap, and a tier's own little sting on top (rare / epic / legendary);
  // the ultra-rares get lootUltra() instead
  A.lootFlip = function (r) {
    if (!ac) return;
    r = r | 0;
    hiss(0.05, 0.08, 0, 'highpass', 4500, 7000); voice(note(26 + r * 2), 0.05, { type: 'square', vol: 0.04 }); thud(0.04, 0.06, 0, 1600);
    if (r === 2) { bellAt(31, 0.9, 0.08, 0.04); bellAt(38, 0.8, 0.05, 0.12); }
    else if (r === 3) {
      [0, 4, 7, 12].forEach((s, i) => voice(note(24 + s), 0.22, { type: 'triangle', vol: 0.07, when: 0.03 + i * 0.06 }));
      bellAt(36, 1.3, 0.09, 0.26); hiss(0.6, 0.03, 0.2, 'highpass', 5000, 9000, 0.1);
    } else if (r === 4) {
      duckFor(1.6);
      boom(0.16, 0, 60);
      [0, 4, 7, 11, 14].forEach((s, i) => voice(note(19 + s), 1.4, { type: i % 2 ? 'triangle' : 'square', vol: 0.045, when: 0.05 + i * 0.03, lp: 2400, lp2: 900, rel: 1.1 }));
      bellAt(31, 1.8, 0.1, 0.1); bellAt(38, 1.6, 0.06, 0.22);
      for (let i = 0; i < 8; i++) voice(note(36 + PENTA[i % PENTA.length]), 0.12, { type: 'triangle', vol: 0.035, when: 0.3 + i * 0.05 });
      hiss(1.1, 0.035, 0.15, 'highpass', 4000, 10000, 0.2);
    }
  };
  // the beat of suspense before an ultra card turns: a rising hiss, a climbing whine and a drum roll
  A.ultraRiser = function (sec) {
    if (!ac) return;
    sec = Math.max(0.3, Math.min(3, sec || 0.9));
    duckFor(sec + 0.6);
    hiss(sec, 0.11, 0, 'bandpass', 300, 6000, sec * 0.8, 2);
    voice(note(0), sec, { type: 'sawtooth', vol: 0.04, slide: note(24), att: sec * 0.6, rel: 0.08, lp: 600, lp2: 4000 });
    voice(note(7), sec, { type: 'square', vol: 0.025, slide: note(31), att: sec * 0.6, rel: 0.08, when: 0.04 });
    const n = Math.round(sec * 14); for (let i = 0; i < n; i++) snare(0.02 + 0.06 * i / n, i * sec / n);
  };
  // ONE STING A TIER (the owner: "crazy sound"): mythic a chord, divine a choir, unique a fanfare, relic all of it
  function mythicChord(w) {
    boom(0.24, w, 66);
    crash(0.05, w + 0.02, 1.4);
    // the strike: a wide ninth chord in detuned saws that opens up, then rings
    [0, 7, 12, 16, 19, 23, 26].forEach((s, i) => { voice(note(7 + s), 3, { type: 'sawtooth', vol: 0.04, when: w + i * 0.012, det: -8, lp: 700, lp2: 5000, lpT: 0.5, rel: 2.3 }); voice(note(7 + s), 3, { type: 'sawtooth', vol: 0.03, when: w + i * 0.012, det: 9, lp: 700, lp2: 5000, lpT: 0.5, rel: 2.3 }); });
    // a run up the chord, and bells on top
    [0, 4, 7, 11, 14, 19, 23, 26, 31].forEach((s, i) => voice(note(31 + s), 0.18, { type: i % 2 ? 'triangle' : 'square', vol: 0.05, when: w + 0.1 + i * 0.045 }));
    bellAt(43, 2.8, 0.1, w + 0.5); bellAt(38, 3, 0.08, w + 0.56); bellAt(31, 3, 0.06, w + 0.62);
    hiss(1.8, 0.03, w + 0.4, 'highpass', 6000, 11000, 0.3);
  }
  function divineChoir(w) {
    boom(0.22, w, 55);
    choir([0, 7, 12, 16, 19], 3, 0.022, w + 0.02);
    voice(note(-12), 3, { type: 'sine', vol: 0.12, when: w, att: 0.3, rel: 1.6 });
    for (let i = 0; i < 12; i++) bellAt(36 + [0, 4, 7, 12, 16, 19][i % 6], 1.4, 0.06, w + 0.25 + i * 0.11);
    hiss(2.6, 0.04, w + 0.1, 'highpass', 3500, 12000, 0.8, 0.7);
  }
  function uniqueFanfare(w) {
    boom(0.2, w, 70);
    // ta-ta-taaa, ta-ta-TAAA: brass (squares and saws through a low-pass) over a snare and a timpani
    const brass = (k, at, d) => { voice(note(12 + k), d, { type: 'square', vol: 0.06, when: w + at, att: 0.02, lp: 1800, lp2: 3200, lpT: 0.1, rel: Math.min(0.5, d * 0.5) }); voice(note(k), d, { type: 'sawtooth', vol: 0.045, when: w + at, att: 0.02, lp: 1200, rel: Math.min(0.5, d * 0.5) }); voice(note(k + 7), d, { type: 'sawtooth', vol: 0.03, when: w + at, att: 0.03, lp: 1400, rel: Math.min(0.5, d * 0.5) }); };
    [[7, 0, 0.13], [7, 0.15, 0.13], [12, 0.3, 0.8], [11, 1.0, 0.13], [12, 1.15, 0.13], [16, 1.3, 1.3]].forEach(([k, at, d]) => brass(k, at, d));
    [0, 0.15, 0.3, 1.0, 1.15, 1.3].forEach(at => snare(0.08, w + at));
    for (let i = 0; i < 8; i++) snare(0.03 + i * 0.006, w + 0.6 + i * 0.05);
    [0.3, 1.3].forEach(at => { voice(note(-17), 0.6, { type: 'sine', vol: 0.14, when: w + at, slide: note(-24) }); });
    crash(0.06, w + 1.3, 1.8);
    bellAt(36, 2, 0.08, w + 1.35);
  }
  A.lootUltra = function (tier) {
    if (!ac) return;
    if (!throttle('ultra', 250)) return;
    if (tier === 'relic') { duckFor(5); divineChoir(0); mythicChord(0.9); uniqueFanfare(1.8); for (let i = 0; i < 14; i++) bellAt(43 + PENTA[i % 8], 0.5, 0.04, 3.2 + i * 0.06); return; }
    duckFor(tier === 'divine' ? 3.4 : 2.8);
    if (tier === 'divine') divineChoir(0);
    else if (tier === 'unique') uniqueFanfare(0);
    else mythicChord(0);
  };
  // a true relic onto the belt: relic_fx's short show (G.relicBelt) strikes on these beats over the relic sting - the
  // inhale, the spear at 0.4 s (a sub drop, a crack, a zap), R E L I C slammed in at 0.8 s + 0.08 s a letter, a bell
  A.relicStrike = function () {
    if (!ac || !throttle('rstrike', 400)) return;
    hiss(0.4, 0.05, 0, 'bandpass', 500, 7000, 0.36, 1);
    voice(note(-3), 0.36, { type: 'sawtooth', vol: 0.025, slide: note(21), lp: 900, lp2: 4000, att: 0.3, rel: 0.05 });
    boom(0.22, 0.4, 64); hiss(0.9, 0.07, 0.4, 'lowpass', 5000, 150, 0.003, 0.5);
    voice(1800, 0.08, { type: 'sine', vol: 0.05, slide: 60, when: 0.4 });
    [0, 4, 7, 11, 12].forEach((s, i) => { const w = 0.8 + i * 0.08; thud(0.12, 0.09 + (i === 4 ? 0.05 : 0), w, 700); voice(note(12 + s), 0.12, { type: 'square', vol: 0.04, when: w }); });
    bellAt(43, 2.2, 0.07, 1.12); bellAt(50, 1.8, 0.035, 1.14);
  };
  // a card that burns into Embers: a soft whoosh and a crackle
  A.burn = function () {
    if (!ac || !throttle('burn', 120)) return;
    hiss(0.45, 0.07, 0, 'lowpass', 2200, 260, 0.08, 0.8);
    for (let i = 0; i < 5; i++) hiss(0.03, 0.04, 0.05 + Math.random() * 0.35, 'highpass', 3000 + Math.random() * 3000);
    voice(note(5), 0.3, { type: 'triangle', vol: 0.03, slide: note(-7) });
  };
  // the loot bursting out of a boss toward the screen: a pop and a glitter that climbs with the best rarity in it
  A.lootBurst = function (r) {
    if (!ac || !throttle('lburst', 300)) return;
    r = Math.max(0, Math.min(7, r | 0));
    thud(0.18, 0.16, 0, 500); hiss(0.4, 0.06, 0, 'bandpass', 600, 5000, 0.05, 1.5);
    for (let i = 0; i < 4 + r; i++) voice(note(24 + PENTA[i % PENTA.length] + r), 0.1, { type: 'triangle', vol: 0.035, when: 0.04 + i * 0.04 });
    if (r >= 4) bellAt(31 + r, 1.2, 0.07, 0.2);
  };
  // the Button's Integrity: a pip cracks (glass breaking, a falling tone; darker on the last one), or comes back (a sparkle)
  A.pipCrack = function (last) {
    if (!ac) return;
    hiss(0.06, 0.14, 0, 'highpass', 5000, 3000); hiss(0.35, 0.06, 0.03, 'highpass', 7000, 4000);
    for (let i = 0; i < 6; i++) voice(2200 + Math.random() * 2600, 0.05, { type: 'triangle', vol: 0.03, when: 0.02 + i * 0.03 + Math.random() * 0.02 });
    voice(note(last ? 4 : 12), 0.6, { type: 'square', vol: 0.06, slide: note(last ? -20 : -5), when: 0.02, lp: 2000 });
    thud(0.25, 0.16, 0, 400);
    if (last) { voice(note(-20), 1.2, { type: 'sawtooth', vol: 0.06, when: 0.1, lp: 500, rel: 0.9 }); A.heartbeat(); }
  };
  A.pipGain = function () {
    if (!ac) return;
    [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => voice(note(31 + s), 0.18, { type: 'triangle', vol: 0.05, when: i * 0.045 }));
    bellAt(43, 1.2, 0.06, 0.2); hiss(0.5, 0.03, 0.05, 'highpass', 6000, 11000, 0.1);
  };
  // the Hand charging a shrine: a hum that climbs as the ring fills (stage calls it every few frames with the charge 0-1)
  A.shrineCharge = function (k) {
    if (!ac || !throttle('shrineCh', 95)) return;
    voice(note(12 + Math.round(k * 19)), 0.12, { type: 'triangle', vol: 0.03 + 0.03 * k });
    voice(note(24 + Math.round(k * 19)), 0.08, { type: 'sine', vol: 0.02 + 0.02 * k, when: 0.02 });
  };
  // a Pact sealed: a low minor chord and a bell that does not quite ring true
  A.pact = function (yes) {
    if (!ac) return;
    if (!yes) { voice(note(0), 0.3, { type: 'triangle', vol: 0.05, slide: note(-5) }); return; }
    boom(0.16, 0, 50);
    [-12, -9, -5, 0, 3].forEach((s, i) => voice(note(s), 2, { type: 'sawtooth', vol: 0.035, when: i * 0.04, lp: 500, lp2: 1400, rel: 1.4 }));
    bell(note(27) * 1.03, 2, 0.06, 0.3); hiss(1.2, 0.04, 0.1, 'lowpass', 800, 200, 0.3);
  };
  // a Golden Click: coins and a bright chord
  A.goldenClick = function () {
    if (!ac) return;
    [0, 4, 7, 12, 16, 19, 24, 28].forEach((s, i) => voice(note(31 + s), 0.14, { type: i % 2 ? 'triangle' : 'square', vol: 0.05, when: i * 0.03 }));
    for (let i = 0; i < 6; i++) { voice(1320 + i * 90, 0.05, { type: 'triangle', vol: 0.04, when: 0.25 + i * 0.05 }); voice(1760 + i * 90, 0.07, { type: 'triangle', vol: 0.035, when: 0.28 + i * 0.05 }); }
    bellAt(36, 1.2, 0.07, 0.25);
  };
  // a vault key: found, a bright little jingle and a bell (a thing worth keeping); 'vault', the key turning in the gate
  A.key = function (src) {
    if (!ac) return;
    if (src === 'vault') {
      // two clicks of the mechanism, the bolt drawn, a low thunk as the gate gives
      for (let i = 0; i < 2; i++) { voice(2200 - i * 300, 0.03, { type: 'square', vol: 0.07, when: i * 0.13, att: 0.002, rel: 0.02 }); hiss(0.04, 0.08, i * 0.13, 'highpass', 4000, 3000, 0.002); }
      hiss(0.25, 0.05, 0.3, 'bandpass', 700, 1800, 0.01, 3);
      thud(0.3, 0.24, 0.5, 350); voice(90, 0.35, { type: 'triangle', vol: 0.09, when: 0.5, slide: 60 });
      return;
    }
    [0, 7, 12, 19].forEach((s, i) => voice(note(29 + s), 0.1, { type: i % 2 ? 'triangle' : 'square', vol: 0.07, when: i * 0.045 }));
    bellAt(41, 0.9, 0.09, 0.2);
    hiss(0.3, 0.025, 0.2, 'highpass', 6000, 9000, 0.01);
  };
  // the Hunt pact's champion comes: two low horn notes, a snare
  A.hunt = function () {
    if (!ac) return;
    voice(note(-7), 0.5, { type: 'sawtooth', vol: 0.07, lp: 900, att: 0.03 }); voice(note(-5), 0.4, { type: 'sawtooth', vol: 0.07, lp: 900, when: 0.45, att: 0.03 });
    voice(note(5), 0.45, { type: 'sawtooth', vol: 0.045, lp: 1200, when: 0.45, att: 0.03 });
    snare(0.12, 0.42); snare(0.1, 0.9);
  };
  // the doors: a heavy gate swings, then the march's drums
  A.door = function () {
    if (!ac) return;
    voice(70, 0.9, { type: 'sawtooth', vol: 0.06, slide: 52, lp: 400 });
    hiss(0.8, 0.05, 0, 'bandpass', 300, 160, 0.2, 4);
    thud(0.4, 0.2, 0.75, 300);
    for (let i = 0; i < 6; i++) thud(0.12, 0.08 + i * 0.012, 1 + i * 0.16, 500);
  };
  // a new land's title (after a door): a horn call
  A.landTitle = function () {
    if (!ac) return;
    [[0, 0, 0.5], [7, 0.45, 0.35], [12, 0.75, 1.1]].forEach(([k, at, d]) => { voice(note(-5 + k), d, { type: 'sawtooth', vol: 0.05, when: at, att: 0.05, lp: 900, lp2: 2000, rel: d * 0.6 }); voice(note(7 + k), d, { type: 'square', vol: 0.025, when: at, att: 0.06, lp: 1500 }); });
    thud(0.3, 0.12, 0, 300);
  };
  // the Last Stand: a war drum that quickens as the clock runs down (its own loop; stops with the Stand)
  let drumT = null;
  function drumLoop() {
    drumT = null;
    const L = G.R.lastStand;
    if (!L || !ac) return;
    const k = Math.max(0, Math.min(1, 1 - L.t / (L.T || 75))), beat = 0.52 - 0.22 * k;
    if (!quiet(sfxBus)) {
      voice(55, 0.4, { type: 'sine', vol: 0.18, slide: 38 }); thud(0.22, 0.17, 0, 260);
      voice(82, 0.22, { type: 'sine', vol: 0.11, slide: 55, when: beat * 0.5 }); thud(0.1, 0.08, beat * 0.5, 600);
      if (k > 0.6) snare(0.03, beat * 0.75);
    }
    drumT = setTimeout(drumLoop, beat * 1000);
  }
  A.drum = function (on) { if (on === false) { if (drumT) clearTimeout(drumT); drumT = null; return; } if (!drumT) drumLoop(); };
  A.lastStand = function () {
    if (!ac) return;
    duckFor(2.5);
    A.horn(); boom(0.22, 0.1, 50);
    [0, 3, 7].forEach((s, i) => voice(note(-12 + s), 1.6, { type: 'sawtooth', vol: 0.05, when: 0.3 + i * 0.03, lp: 600, rel: 1 }));
    setTimeout(() => A.drum(true), 900);
  };
  // THE MAD BUTTON: a clang, a laugh that falls apart, a crushed chord
  A.madButton = function () {
    if (!ac) return;
    duckFor(3);
    boom(0.26, 0, 44); crash(0.06, 0, 2);
    for (let i = 0; i < 7; i++) voice(note(19 - i * 2 + (i % 2) * 5), 0.12, { type: 'square', vol: 0.05, when: 0.35 + i * 0.1, slide: note(14 - i * 2), vib: 0.03, vibF: 18 });
    [-24, -23, -18, -12].forEach((s, i) => voice(note(s), 2.2, { type: 'sawtooth', vol: 0.06, when: 1.1 + i * 0.02, lp: 300, lp2: 2400, lpT: 0.8, rel: 1.4 }));
  };
  // a Button evolving: a rising spin, the crack of the shell, the new form's chord (ui.js's banner plays its tier sting)
  A.evolveMorph = function () {
    if (!ac) return;
    hiss(1.4, 0.08, 0, 'bandpass', 200, 7000, 1.2, 3);
    voice(note(-5), 1.4, { type: 'sawtooth', vol: 0.04, slide: note(31), att: 1.1, rel: 0.1, lp: 800, lp2: 6000 });
    boom(0.22, 1.4, 60); hiss(0.08, 0.14, 1.4, 'highpass', 6000, 3000);
    [0, 4, 7, 12, 16].forEach((s, i) => voice(note(19 + s), 1.6, { type: i % 2 ? 'triangle' : 'square', vol: 0.045, when: 1.45 + i * 0.03, rel: 1.2 }));
  };
  // the camp: a fire crackles while it is open (its own loop; stops when the camp closes)
  let fireT = null;
  function fireLoop() {
    fireT = null;
    const r = G.S && G.S.run;
    if (!ac || !r || r.phase !== 'camp') return;
    if (!quiet(sfxBus)) { hiss(0.02 + Math.random() * 0.03, 0.02 + Math.random() * 0.035, 0, 'highpass', 1500 + Math.random() * 3000); if (Math.random() < 0.25) thud(0.15, 0.03, 0, 300); }
    fireT = setTimeout(fireLoop, 70 + Math.random() * 380);
  }
  A.campfire = function (on) { if (on === false) { if (fireT) clearTimeout(fireT); fireT = null; return; } if (!fireT) fireLoop(); };
  // a chest that came as coin (the Siege's chest budget): a quick jingle
  A.coinBurst = function () { if (!throttle('coinB', 120)) return; for (let i = 0; i < 5; i++) voice(1320 + Math.random() * 900, 0.05, { type: 'triangle', vol: 0.035, when: i * 0.035 }); };

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
    // past the Button
    { bass: [-5, -5, -2, -2, 0, 0, -2, -7], lead: [7, 10, 14, 12, 10, 7, 5, 2], tempo: 0.24 },
    { bass: [0, 0, 0, 0, -1, -1, -3, -3], lead: [12, 12, 15, 12, 17, 15, 12, 10], tempo: 0.16 },
    { bass: [-7, -7, -4, -4, -2, -2, -9, -9], lead: [5, 8, 12, 13, 12, 8, 5, 1], tempo: 0.18 },
    { bass: [0, 0, 4, 4, 0, 0, 3, 3], lead: [12, 16, 11, 15, 12, 16, 10, 14], tempo: 0.21 },
    { bass: [0, 0, 5, 5, 9, 9, 7, 7], lead: [19, 21, 24, 21, 19, 16, 19, 12], tempo: 0.22 },
    // the Moon and the Star Sea
    { bass: [-5, -5, -1, -1, 2, 2, -3, -3], lead: [14, 19, 21, 19, 14, 11, 9, 7], tempo: 0.26 },
    { bass: [-12, -12, -7, -7, -5, -5, -10, -10], lead: [12, 19, 24, 22, 19, 17, 15, 10], tempo: 0.2 },
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
  G.on('chestOpen', loot => {
    if (loot.source === 'offline') return;
    // a little chest of coin: a bright tick, kept sparse when they pop in heaps
    if (!loot.items.length) { if (throttle('coinChest', 70)) { tone(note(30 + (Math.random() * 5 | 0)), 0.05, 'square', 0.035); tone(note(37), 0.04, 'triangle', 0.03, 0.03); } return; }
    A.chest(loot.items.reduce((m, x) => Math.max(m, x.it.r), 0));
  });
  G.on('merge', () => A.merge());
  G.on('buy', () => A.buy());
  G.on('bossStart', b => A.bossStart(b.lord));
  G.on('bossWin', () => A.bossWin());
  G.on('bossFail', () => A.bossFail());
  G.on('wisp', () => A.wisp());
  G.on('wispCatch', () => { if (!(G.inSiege && G.inSiege())) A.catchWisp(); });
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
  G.on('spit', () => A.spit());
  G.on('spitHit', () => A.bite());
  G.on('bomberPop', () => A.boom());
  G.on('carnage', t => A.carnage(t));
  G.on('landStar', () => A.star());
  G.on('unitDown', () => A.down());
  G.on('unitRevive', () => A.revive());
  G.on('buttonBreak', () => A.boom());
  G.on('wave', () => A.wave());
  G.on('buttonBreak', () => A.overload());
  G.on('perk', () => A.perk());
  G.on('evolve', () => A.evolve());
  G.on('nova', () => A.nova());
  // 4.0: the Siege
  G.on('lootMoment', L => { let r = 0; for (const c of (L && L.cards) || []) if (c && c.g) r = Math.max(r, c.g.q ? 7 : c.g.r | 0); A.lootBurst(r); });
  G.on('pip', (dl, n, why, kind) => { if (kind === 'lost' || kind === 'last') A.pipCrack(kind === 'last'); else if (kind === 'gain') A.pipGain(); });
  G.on('shrineCharge', (s, k) => A.shrineCharge(k));
  G.on('pact', (id, yes) => A.pact(yes));
  G.on('goldenClick', () => A.goldenClick());
  G.on('key', (n, src) => A.key(src));
  G.on('huntChamp', () => A.hunt());
  G.on('door', () => A.door());
  G.on('lastStand', () => A.lastStand());
  G.on('lastStandEnd', () => A.drum(false));
  G.on('madButton', () => A.madButton());
  G.on('btnEvolve', () => A.evolveMorph());
  G.on('campOpen', () => A.campfire(true));
  G.on('campDone', () => A.campfire(false));
  G.on('runPhase', p => { if (p === 'camp') A.campfire(true); });
  G.on('chestCoin', () => A.coinBurst());
  G.on('ascend', () => { A.drum(false); A.campfire(false); });
})(globalThis.G = globalThis.G || {});
