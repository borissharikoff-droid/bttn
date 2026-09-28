// BTTN — shared helpers. Every file attaches to the global G namespace so the
// game runs from file://, as a single inlined page, and inside a Node sim.
(function (G) {
  'use strict';

  const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc',
    'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc', 'Vg'];

  // Compact number: 999, 1.23K, 45.6M, 7.89e75
  function fmt(n, small) {
    if (n === undefined || n === null || Number.isNaN(n)) return '0';
    if (!Number.isFinite(n)) return '∞';
    const neg = n < 0; if (neg) n = -n;
    let s;
    if (n < 1000) {
      if (small && n < 10 && n % 1 !== 0) s = (Math.floor(n * 10) / 10).toString();
      else if (small && n < 100 && n % 1 !== 0) s = (Math.floor(n * 10) / 10).toFixed(1);
      else s = Math.floor(n).toString();
    } else {
      const e = Math.floor(Math.log10(n) / 3);
      if (e < SUFFIXES.length) {
        const v = n / Math.pow(1000, e);
        const d = v < 10 ? 2 : v < 100 ? 1 : 0;
        s = (Math.floor(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d) + SUFFIXES[e];
      } else {
        const ex = Math.floor(Math.log10(n));
        s = (n / Math.pow(10, ex)).toFixed(2) + 'e' + ex;
      }
    }
    return (neg ? '-' : '') + s;
  }

  function fmtPct(x) { // 0.25 -> +25%
    const v = x * 100;
    return (v >= 0 ? '+' : '') + (Math.abs(v) < 10 && v % 1 ? v.toFixed(1) : Math.round(v)) + '%';
  }

  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600),
      m = Math.floor(sec % 3600 / 60), s = sec % 60;
    if (d) return d + 'd ' + h + 'h';
    if (h) return h + 'h ' + m + 'm';
    if (m) return m + 'm ' + s + 's';
    return s + 's';
  }

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const chance = p => Math.random() < p;

  function weighted(weights) { // returns index
    let total = 0;
    for (let i = 0; i < weights.length; i++) total += weights[i];
    let r = Math.random() * total;
    for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r < 0) return i; }
    return weights.length - 1;
  }

  // Deterministic RNG for level decoration so a biome always looks the same.
  function seeded(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function todayKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // Sum of geometric series cost: buying `n` levels starting from level L.
  function geoCost(base, growth, L, n) {
    if (n <= 0) return 0;
    if (growth === 1) return base * n;
    return base * Math.pow(growth, L) * (Math.pow(growth, n) - 1) / (growth - 1);
  }
  // How many levels are affordable with `money`.
  function geoMax(base, growth, L, money) {
    const first = base * Math.pow(growth, L);
    if (money < first) return 0;
    return Math.floor(Math.log(money * (growth - 1) / first + 1) / Math.log(growth));
  }

  const hexToRgb = h => {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  };
  const rgbToHex = (r, g, b) => '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  function shade(hex, amt) { // amt -1..1
    const [r, g, b] = hexToRgb(hex);
    if (amt >= 0) return rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
    return rgbToHex(r * (1 + amt), g * (1 + amt), b * (1 + amt));
  }

  // Tiny event bus: logic emits, stage/ui/audio listen.
  const listeners = {};
  function on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); }
  function emit(ev, a, b, c) {
    const l = listeners[ev]; if (!l) return;
    for (let i = 0; i < l.length; i++) l[i](a, b, c);
  }

  Object.assign(G, {
    fmt, fmtPct, fmtTime, clamp, lerp, rand, randInt, pick, chance, weighted, seeded,
    todayKey, geoCost, geoMax, hexToRgb, rgbToHex, shade, on, emit,
  });
})(globalThis.G = globalThis.G || {});
