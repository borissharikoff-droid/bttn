// BTTN 3.0 — art5: the growing TOWN. New buildings (barracks, trophy hall, temple of ascension, rift gate,
// a construction site), square furniture (fountain, market stalls, bench, lantern), town critters (cat, dog,
// chicken), upgraded looks for the forge / tavern / alchemist, and four HUD icons.
// Loaded after art4.js; same palette, light from the top-left, no outline in the grids (SPR.get adds it).
// Anchor every building at its bottom-centre. Two-frame ids: tw_rift/tw_rift2, tw_fountain/tw_fountain2,
// tw_cat/tw_cat2, tw_chicken/tw_chicken2 (tw_stall2 is a colour variant, not an animation frame).
(function (G) {
  'use strict';
  const SPR = G.SPR;
  if (!SPR) return;
  const def = SPR.def;

  // ---------- helpers (same as art4) ----------
  const dist = (x, y, cx, cy) => Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
  function grid(w, h) {
    const g = [];
    for (let y = 0; y < h; y++) g.push(new Array(w).fill('.'));
    const C = {
      w, h,
      at: (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? g[y][x] : '.'),
      p(x, y, c) { if (c && x >= 0 && y >= 0 && x < w && y < h) g[y][x] = c; return C; },
      r(x, y, rw, rh, c) { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) C.p(x + i, y + j, c); return C; },
      f(fn, x0, y0, x1, y1) {
        x0 = x0 || 0; y0 = y0 || 0; x1 = x1 == null ? w - 1 : x1; y1 = y1 == null ? h - 1 : y1;
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) C.p(x, y, fn(x, y, C.at(x, y)));
        return C;
      },
      s(x0, y0, rows) {
        rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] !== '.') C.p(x0 + x, y0 + y, r[x]); });
        return C;
      },
      swap(map, x0, y0, x1, y1) { return C.f((x, y, c) => map[c], x0, y0, x1, y1); },
      clear(x, y, rw, rh) { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) if (x + i >= 0 && y + j >= 0 && x + i < w && y + j < h) g[y + j][x + i] = '.'; return C; },
      rows: () => g.map(r => r.join('')),
    };
    return C;
  }
  const ramp = (t, chars, cuts) => {
    cuts = cuts || [0.22, 0.55, 0.82];
    for (let i = 0; i < cuts.length; i++) if (t < cuts[i]) return chars[i];
    return chars[cuts.length];
  };
  // small deterministic RNG for crackles / sparkles
  const rng = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

  const TOWN = {
    S: '#d0d0dc', s: '#a4a4b2', d: '#7a7a88', D: '#565664',
    W: '#d09a5c', w: '#a86e38', b: '#7a4a24', B: '#4e2e16',
    p: '#f0e2c0', P: '#c8b28c',
    k: '#1e1a24', K: '#2e2834',
    h: '#fff6c8', y: '#ffe27a', Y: '#ffb347', o: '#ff7a2e', O: '#c8461a',
    j: '#d8dee8', i: '#8a90a0', I: '#4e5262',
    g: '#4fb83e', G: '#2d7a28', l: '#8ae07a',
  };
  const TP = (o) => Object.assign({}, TOWN, o);
  const RED = { a: '#e8413c', A: '#a82a26', e: '#7a1a1e' };
  const MARBLE = { m: '#fbf8f0', M: '#e4ddcc', n: '#c2b9a6', N: '#8e8676' };
  const GOLD = { z: '#c0841e' };
  const STRAW = { n: '#f0d070', N: '#c8a040', Z: '#8a6a28' };

  function roof(c, y0, y1, xl, xr, slope, ch, tw) {
    tw = tw || 5;
    for (let y = y0; y <= y1; y++) {
      const k = y - y0, a = Math.round(xl - k * slope), b = Math.round(xr + k * slope), course = Math.floor(k / 3), v = k % 3;
      for (let x = a; x <= b; x++) {
        const t = (x - a) / Math.max(1, b - a);
        let q = v === 0 ? 0 : v === 1 ? 1 : 2;
        if ((x + course * 3) % tw === 0 && v !== 0) q = 2;
        if (t > 0.62 && q < 3) q++;
        if (x === a) q = Math.min(q, 0);
        if (x === b) q = 3;
        c.p(x, y, ch[Math.min(3, q)]);
      }
    }
  }
  function blocks(c, x0, y0, rw, rh, bw, bh, ch, m) {
    c.f((x, y) => {
      const ly = y - y0, row = Math.floor(ly / bh), lx = x - x0 + (row % 2) * Math.floor(bw / 2);
      if (ly % bh === bh - 1 || lx % bw === bw - 1) return m;
      if (ly % bh === 0 || lx % bw === 0) return ch[0];
      return (x - x0) / rw > 0.7 ? ch[2] : ch[1];
    }, x0, y0, x0 + rw - 1, y0 + rh - 1);
  }
  function window_(c, x0, y0, ww, wh, f, glass, cross) {
    c.r(x0, y0, ww, wh, f);
    c.f((x, y) => {
      const t = ((x - x0 - 1) / Math.max(1, ww - 3) + (y - y0 - 1) / Math.max(1, wh - 3)) / 2;
      return ramp(t, glass, [0.2, 0.6]);
    }, x0 + 1, y0 + 1, x0 + ww - 2, y0 + wh - 2);
    if (cross) {
      const mx = x0 + Math.floor(ww / 2), my = y0 + Math.floor(wh / 2);
      c.f(() => f, mx, y0 + 1, mx, y0 + wh - 2);
      c.f(() => f, x0 + 1, my, x0 + ww - 2, my);
    }
  }
  // a hanging cloth banner (rod on top, swallow-tail bottom), red with a gold emblem
  function banner(c, x0, y0, bw, bh, emblem) {
    c.r(x0 - 1, y0, bw + 2, 1, 'i').p(x0 + bw, y0, 'I');
    c.f((x, y) => {
      const t = (x - x0) / Math.max(1, bw - 1), ly = y - y0;
      const mid = (bw - 1) / 2, tail = ly - (bh - 3);
      if (tail > 0 && Math.abs(x - x0 - mid) < tail) return '.';
      return t > 0.75 ? 'e' : t > 0.5 ? 'A' : 'a';
    }, x0, y0 + 1, x0 + bw - 1, y0 + bh - 1);
    c.f((x, y, ch) => (ch === '.' ? null : ''), x0, y0, x0 + bw - 1, y0 + bh);
    if (emblem) c.s(x0 + Math.floor((bw - emblem[0].length) / 2), y0 + 3, emblem);
  }
  // draw a prop in its own layer (fn gets a grid), then paste it with a 'k' line where it meets the building
  function prop(c, fn, oc) {
    const q = grid(c.w, c.h);
    fn(q);
    const rows = q.rows();
    for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
      if (rows[y][x] !== '.') continue;
      const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (rows[y + dy] || '')[x + dx] && rows[y + dy][x + dx] !== '.');
      if (n && c.at(x, y) !== '.') c.p(x, y, oc || 'k');
    }
    c.s(0, 0, rows);
  }
  // generic dome (half-ellipse above row cy), lit from the top-left; ch light→dark
  function dome(c, cx, cy, rx, ry, ch, ribs) {
    c.f((x, y) => {
      const X = x + 0.5, Y = y + 0.5, u = (X - cx) / rx, v = (Y - cy) / ry, d = u * u + v * v;
      if (d > 1 || Y > cy) return '';
      const lit = -u * 0.32 - v * 0.2 + (1 - d) * 0.55;
      let q = lit > 0.6 ? 0 : lit > 0.3 ? 1 : lit > 0.06 ? 2 : 3;
      if (ribs && ribs.some(r => Math.abs(u - r * Math.sqrt(Math.max(0, 1 - v * v))) < 0.5 / rx)) q = Math.min(3, q + 1);
      return ch[q];
    }, Math.floor(cx - rx), Math.floor(cy - ry), Math.ceil(cx + rx), Math.floor(cy));
  }

  // ================= BARRACKS (56x44) =================
  {
    const c = grid(56, 44);
    // a red pennant on the ridge
    c.r(27, 0, 1, 5, 'i').p(27, 0, 'j');
    c.s(28, 0, ['aaaA', 'aAe.', 'e...']);
    // steel-blue slate roof
    roof(c, 4, 14, 16, 39, 1.1, ['r', 'R', 'q', 'Q']);
    c.r(1, 15, 54, 1, 'B').r(2, 15, 52, 1, 'b');
    // upper storey: timber frame, plaster, braces, two lit windows and the crest
    c.r(5, 16, 46, 10, 'p');
    c.f((x, y) => (x > 44 || y > 23 ? 'P' : ''), 5, 16, 50, 25);
    for (const px of [5, 18, 36]) c.r(px, 16, 2, 10, 'b').r(px, 16, 1, 10, 'w');
    c.r(49, 16, 2, 10, 'B').r(49, 16, 1, 10, 'b');
    c.r(5, 16, 46, 1, 'w');
    window_(c, 9, 18, 7, 6, 'b', ['h', 'y', 'Y'], true);
    window_(c, 40, 18, 7, 6, 'b', ['y', 'Y', 'o'], true);
    // braces in the centre panel
    for (let k = 0; k < 7; k++) { c.p(21 + k, 18 + Math.floor(k * 7 / 7), 'b'); c.p(34 - k, 18 + Math.floor(k * 7 / 7), 'b'); }
    // crest: a shield with crossed swords
    c.s(23, 17, [
      'j........j',
      '.jiaaaaAi.',
      '..jaayaAe.',
      '..ayjyiAe.',
      '..aayyAAe.',
      '..aaiyjAe.',
      '..YaaAAeY.',
      '.Y..aAe..Y',
    ]);
    // jetty beam
    c.r(2, 26, 52, 2, 'b').r(2, 26, 52, 1, 'w').r(2, 27, 52, 1, 'B');
    // ground floor: stone
    blocks(c, 5, 28, 46, 12, 6, 3, ['S', 's', 'd'], 'D');
    // arrow slits
    c.s(13, 30, ['DD', 'kY', 'kY', 'ko', 'DD']).s(41, 30, ['DD', 'kY', 'ko', 'ko', 'DD']);
    // the gate: arched double door with iron bands and studs
    c.f((x, y) => {
      const X = x + 0.5, cx = 28, dx = X - cx;
      const top = 29 + Math.max(0, Math.abs(dx) - 2.5) * 0.6;
      if (y < top) return '';
      if (y < top + 1 || Math.abs(dx) > 5) return 'D';
      if (Math.abs(dx) < 0.6) return 'B';
      if (y === 32 || y === 37) return dx < 0 ? 'i' : 'I';
      const lit = dx < 0 ? (dx < -3.5 ? 'W' : 'w') : (dx > 3.5 ? 'B' : 'b');
      return lit;
    }, 22, 28, 33, 39);
    c.p(26, 34, 'y').p(29, 34, 'y').p(24, 32, 'j').p(31, 32, 'j').p(24, 37, 'j').p(31, 37, 'j');
    // banners hung from the jetty beam either side of the gate
    const EMB = ['.y.', 'yhy', '.Y.'];
    banner(c, 16, 27, 5, 11, EMB);
    banner(c, 35, 27, 5, 11, EMB);
    // stone base + step
    blocks(c, 1, 40, 54, 4, 7, 2, ['S', 's', 'd'], 'D');
    c.r(1, 40, 54, 1, 'S').r(1, 43, 54, 1, 'D');
    c.r(21, 40, 14, 1, 's').r(22, 40, 12, 1, 'S');
    // weapon rack (left): two posts, a bar, spears + a sword, a shield leaning on it
    prop(c, (q) => {
      // three spears standing in the rack
      for (const sx of [2, 6, 10]) {
        q.r(sx, 27, 1, 14, 'W').p(sx, 33, 'b');
        q.s(sx - 1, 23, ['.j.', 'jji', 'jiI', '.I.']);
      }
      q.r(0, 30, 2, 12, 'w').r(0, 30, 1, 12, 'W').r(11, 30, 2, 12, 'b').r(11, 30, 1, 12, 'w');
      q.r(0, 31, 13, 2, 'w').r(0, 31, 13, 1, 'W').r(0, 32, 13, 1, 'b');
      q.r(0, 38, 13, 1, 'b').r(0, 38, 3, 1, 'w');
      // a round shield leaning in front
      q.f((x, y) => {
        const X = x + 0.5, Y = y + 0.5, d = dist(X, Y, 6, 39.5);
        if (d > 4) return '';
        if (d > 3.1) return X + Y < 45 ? 'i' : 'I';
        if (d < 1.2) return d < 0.7 ? 'j' : 'i';
        return X + Y < 44 ? 'a' : X + Y < 47 ? 'A' : 'e';
      }, 1, 35, 10, 43);
    });
    // training dummy (right): post on a cross foot, straw body and head, a painted target
    prop(c, (q) => {
      q.r(49, 36, 2, 6, 'w').r(49, 36, 1, 6, 'W');
      q.r(46, 42, 9, 1, 'B').r(46, 41, 9, 1, 'w').r(46, 41, 3, 1, 'W');
      q.r(44, 29, 12, 2, 'w').r(44, 29, 12, 1, 'W').r(44, 30, 12, 1, 'b');
      q.s(43, 28, ['n.', 'Nn', 'n.']).s(54, 28, ['.N', 'NZ', '.N']);
      q.f((x, y) => {
        const X = x + 0.5, Y = y + 0.5, u = (X - 50) / 4.2, v = (Y - 33.5) / 4.8, d = u * u + v * v;
        if (d > 1) return '';
        const hatch = (x * 2 + y * 3) % 5 === 0;
        const t = (X - 46) / 8 + (Y - 30) / 20;
        let q2 = t < 0.45 ? 0 : t < 0.8 ? 1 : 2;
        if (hatch) q2 = Math.min(2, q2 + 1);
        return ['n', 'N', 'Z'][q2];
      }, 44, 28, 55, 39);
      q.f((x, y) => {
        const X = x + 0.5, Y = y + 0.5, d = dist(X, Y, 50, 33.5);
        if (d > 2.9) return '';
        return d > 2 ? 'a' : d > 1.1 ? 'p' : 'a';
      }, 46, 30, 54, 37);
      q.r(48, 38, 4, 1, 'b');
      q.f((x, y) => {
        const X = x + 0.5, Y = y + 0.5, d = dist(X, Y, 50, 24.5);
        if (d > 3.3) return '';
        const t = (X - 47) / 6 + (Y - 21.5) / 8;
        return t < 0.5 ? 'n' : t < 0.95 ? 'N' : 'Z';
      }, 46, 21, 54, 28);
      q.r(48, 28, 4, 1, 'b').p(49, 24, 'k').p(51, 24, 'k').r(49, 26, 3, 1, 'Z');
    });
    def('tw_barracks', TP(Object.assign({ r: '#7a96d0', R: '#5674b0', q: '#3c5490', Q: '#283a6c' }, RED, GOLD, STRAW)), c.rows());
  }

  // ================= HALL OF TROPHIES (54x46) =================
  {
    const c = grid(54, 46);
    const cx = 27;
    // gilded finial
    c.s(26, 0, ['h.', 'yY', 'yz', 'Yz']);
    // copper-green dome on a marble drum
    dome(c, cx, 14, 11.5, 11, ['c', 'C', 'v', 'V'], [-0.55, 0, 0.55]);
    c.f((x) => ramp((x - 15) / 23, ['m', 'M', 'n', 'N']), 15, 12, 38, 17);
    c.r(14, 12, 26, 1, 'y').r(14, 13, 26, 1, 'Y').r(36, 13, 4, 1, 'z');
    for (const wx of [17, 21, 31, 35]) c.s(wx, 14, ['k', 'k']);
    // pediment
    for (let y = 14; y <= 23; y++) {
      const hw = 1 + (y - 14) * 24 / 9, a = Math.round(cx - hw), b = Math.round(cx + hw) - 1;
      for (let x = a; x <= b; x++) {
        const edge = x - a < 3 || b - x < 3 || y === 23;
        let ch;
        if (edge) ch = y === 23 ? 'm' : x < cx ? 'm' : 'n';
        else ch = x - a < 4 || b - x < 4 ? 'N' : x < cx + 4 ? 'M' : 'n';
        c.p(x, y, ch);
      }
    }
    // golden trophy in the tympanum
    c.s(22, 16, [
      '..hyyyyz..',
      'yzhyyyYzYz',
      'y.hyyyYz.z',
      '.yzhyyYzz.',
      '...yyYz...',
      '....yz....',
      '...hyYz...',
    ]);
    // entablature: cornice, dentil frieze, shadow
    c.r(1, 23, 52, 1, 'm').r(1, 24, 52, 1, 'M');
    c.f((x) => (x % 3 === 0 ? 'N' : x > 40 ? 'n' : 'M'), 2, 25, 51, 25);
    c.r(2, 26, 50, 1, 'N');
    // back wall under the portico (shaded)
    c.f((x, y) => ((y - 27) % 3 === 2 ? 'N' : x > 40 ? 'N' : 'n'), 3, 27, 50, 39);
    // columns
    const colX = [4, 12, 20, 31, 39, 47];
    for (const x0 of colX) {
      c.r(x0 - 1, 27, 5, 1, 'm').r(x0 + 3, 27, 1, 1, 'n');
      c.r(x0, 28, 3, 11, 'M').r(x0, 28, 1, 11, 'm').r(x0 + 2, 28, 1, 11, 'n');
      c.r(x0 - 1, 39, 5, 1, 'M').p(x0 - 1, 39, 'm').p(x0 + 3, 39, 'n');
    }
    // display windows: a sword, a gem, a crown, a skull, each lit warm
    const ITEMS = [
      ['..j..', '..j..', '..j..', '.yzy.', '..b..'],
      ['.....', '.uuU.', 'uvuUU', '.uUU.', '..U..'],
      ['.....', 'y.y.y', 'yyyyy', 'yzyzz', '.....'],
      ['.....', '.mmM.', 'mkMkM', '.mMM.', '.m.M.'],
    ];
    [7, 15, 34, 42].forEach((wx, i) => {
      c.r(wx, 29, 5, 9, 'N');
      c.f((x, y) => {
        const t = (x - wx) / 4 * 0.5 + (y - 30) / 7 * 0.5;
        if (y === 30 && (x === wx || x === wx + 4)) return 'N';
        return ramp(t, ['h', 'y', 'Y'], [0.25, 0.65]);
      }, wx, 30, wx + 4, 36);
      c.s(wx, 31, ITEMS[i]);
      c.r(wx - 1, 37, 7, 1, 'M').p(wx - 1, 37, 'm');
    });
    // the door: bronze-studded double leaves in a marble frame
    c.r(23, 28, 8, 11, 'N');
    c.f((x, y) => {
      if (x === 27 && y > 29) return 'B';
      if (y === 29) return 'b';
      return x < 27 ? (x === 24 ? 'W' : 'w') : (x === 30 ? 'B' : 'b');
    }, 24, 29, 29, 38);
    c.p(26, 34, 'y').p(28, 34, 'y').r(24, 31, 6, 1, 'z').r(24, 36, 6, 1, 'z');
    // steps
    c.r(2, 40, 50, 2, 'M').r(2, 40, 50, 1, 'm');
    c.r(1, 42, 52, 2, 'M').r(1, 42, 52, 1, 'm');
    c.r(0, 44, 54, 2, 'n').r(0, 44, 54, 1, 'M');
    c.f((x, y, ch) => (x > 40 && ch === 'M' ? 'n' : x > 46 && ch === 'm' ? 'M' : ''), 0, 40, 53, 45);
    c.r(0, 45, 54, 1, 'N');
    // a red carpet down the steps
    c.f((x, y) => (y === 40 || y === 42 || y === 44 ? 'a' : 'A'), 24, 39, 29, 45);
    def('tw_museum', TP(Object.assign({ c: '#a8f0d8', C: '#62c4a8', v: '#3a9484', V: '#24605a', u: '#7fd0ff', U: '#3f8ae0' }, MARBLE, RED, GOLD)), c.rows());
  }

  // ================= TEMPLE OF ASCENSION (44x56) =================
  {
    const c = grid(44, 56);
    const cx = 22;
    // white stone tiers, lit left
    const tier = (x0, x1, y0, y1) => {
      c.f((x) => ramp((x - x0) / (x1 - x0), ['m', 'M', 'n', 'N'], [0.2, 0.6, 0.86]), x0, y0, x1, y1);
      c.f((x, y) => ((y - y0) % 4 === 3 && (x - x0) % 2 === 0 ? 'n' : ''), x0 + 1, y0 + 3, x1 - 3, y1);
      // cornice with a gold trim
      c.r(x0 - 1, y0, x1 - x0 + 3, 1, 'm').p(x1 + 1, y0, 'n');
      c.f((x) => ramp((x - x0) / (x1 - x0), ['y', 'Y', 'Y', 'z']), x0 - 1, y0 + 1, x1 + 1, y0 + 1);
      c.r(x0, y0 + 2, x1 - x0 + 1, 1, 'N');
    };
    tier(4, 39, 33, 46);
    tier(9, 34, 22, 32);
    tier(14, 29, 13, 21);
    // a glowing arch (opening with soft gold light)
    const glowArch = (x0, y0, ww, hh) => {
      c.f((x, y) => {
        const X = x + 0.5, mx = x0 + ww / 2, r = ww / 2;
        if (y < y0 + r && dist(X, y + 0.5, mx, y0 + r) > r) return '';
        const t = (y - y0) / hh;
        return Math.abs(X - mx) < r - 1 ? ramp(t, ['h', 'y', 'Y']) : 'N';
      }, x0, y0, x0 + ww - 1, y0 + hh - 1);
    };
    // top tier: the sigil window
    glowArch(19, 15, 6, 6);
    // mid tier: two windows
    glowArch(13, 25, 4, 6); glowArch(27, 25, 4, 6);
    c.s(20, 25, ['.yy.', 'yhhy', 'yhhy', '.yy.']).r(20, 29, 4, 1, 'Y');
    // base tier: columns and a tall glowing door
    for (const x0 of [6, 12, 29, 35]) {
      c.r(x0, 36, 3, 11, 'M').r(x0, 36, 1, 11, 'm').r(x0 + 2, 36, 1, 11, 'n');
      c.r(x0 - 1, 36, 5, 1, 'm').r(x0 - 1, 46, 5, 1, 'M');
    }
    c.r(17, 36, 10, 11, 'N');
    glowArch(18, 36, 8, 11);
    c.r(21, 40, 2, 7, 'h');
    // golden brazier + flame + a ring-sigil around it
    c.f((x, y) => {
      const X = x + 0.5, Y = y + 0.5, d = dist(X, Y, cx, 6.5);
      if (d > 5.2 && d < 6.4 && Y < 11) return X < cx ? 'y' : 'Y';
      return '';
    }, 14, 0, 30, 11);
    c.p(cx - 8, 6, 'h').p(cx + 7, 6, 'y').p(cx - 1, 0, 'h');
    c.s(19, 1, [
      '...y..',
      '..hy..',
      '..hyY.',
      '.yhhY.',
      '.hhhyY',
      'yhhhyY',
      'yhhhyY',
      '.yhyz.',
    ]);
    c.s(16, 9, [
      'yyyyyyYYzz',
      '.yyyYYYzz.',
      '..yYYzzz..',
      '...YYzz...',
    ]);
    c.r(19, 12, 6, 1, 'y').p(24, 12, 'z');
    // steps: four, widening, a beam of light down the middle
    for (let s = 0; s < 4; s++) {
      const y = 47 + s * 2, x0 = 3 - s, x1 = 40 + s;
      c.r(x0, y, x1 - x0 + 1, 1, 'm').r(x0, y + 1, x1 - x0 + 1, 1, 'n');
      c.r(x1 - 4, y, 5, 1, 'M').r(x1 - 4, y + 1, 5, 1, 'N');
      c.r(18, y, 8, 1, 'h').r(18, y + 1, 8, 1, 'y');
    }
    c.r(0, 55, 44, 1, 'N');
    def('tw_temple', TP(Object.assign({}, MARBLE, GOLD)), c.rows());
  }

  // ================= RIFT GATE (34x40, 2 frames) =================
  {
    const W = 34, H = 40, cx = 17, sy = 22;
    // pointed arch: inside both circles of radius 1.5R centred off-axis, or the jambs below the spring line
    const inPointed = (X, Y, R) => {
      if (Y >= sy) return Math.abs(X - cx) < R;
      const Rc = R * 1.5;
      return dist(X, Y, cx - R + Rc, sy) < Rc && dist(X, Y, cx + R - Rc, sy) < Rc;
    };
    const Ro = 15.5, Ri = 8.6;
    const frame = (seed) => {
      const c = grid(W, H);
      const rand = rng(seed);
      // obsidian body: faceted, lit top-left, glowing violet on the inner rim
      c.f((x, y) => {
        const X = x + 0.5, Y = y + 0.5;
        if (Y > 36) return '';
        if (!inPointed(X, Y, Ro)) return '';
        if (inPointed(X, Y, Ri)) return 'Z';
        if (inPointed(X, Y, Ri + 1.1)) return 'V';
        const lit = X < cx ? 1 : 0;
        if (!inPointed(X, Y, Ro - 1.1)) return lit ? 'x' : 'X';
        const u = (X * 0.7 + Y * 0.7 + 100) % 6, v = (X * 0.7 - Y * 0.7 + 100) % 6;
        if (u < 1) return lit ? 'x' : 'X';
        if (u + v < 6) return lit ? 'X' : 'z';
        return lit ? 'z' : 'Z';
      });
      // jagged shards jutting from the outer edge
      const SHARD_L = ['x..', 'xX.', '.xX'];
      const SHARD_R = ['..z', '.Xz', 'Xz.'];
      c.s(3, 9, SHARD_L).s(28, 9, SHARD_R).s(15, 0, ['.x.', 'xXz']).s(0, 18, ['xx.', '.xX']).s(31, 18, ['.zz', 'Xz.']);
      c.p(16, 0, 'c').p(4, 9, 'c').p(1, 18, 'c');
      // the tear: a lens of white-violet light; around it a churning void
      const top = sy - Ri * Math.sqrt(2) + 1, bot = 35;
      c.f((x, y) => {
        const X = x + 0.5, Y = y + 0.5;
        if (!inPointed(X, Y, Ri) || Y > 36) return '';
        const t = (Y - top) / (bot - top);
        const hw = Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, t))) * 3.6);
        const dx = Math.abs(X - cx + Math.sin(Y * 0.55 + seed) * 0.7);
        if (dx < hw * 0.35) return 'n';
        if (dx < hw * 0.75) return 'v';
        if (dx < hw + 0.6) return 'V';
        const sw = Math.sin((Y - top) * 0.5 - dx * 0.9 + seed * 1.7);
        const far = (dx - hw) / (Ri - hw + 0.01);
        return far < 0.3 ? (sw > 0.2 ? 'u' : 'U') : far < 0.75 ? (sw > 0.6 ? 'u' : 'U') : 'Z';
      });
      // crackles: short forking bolts from the tear to the rim
      for (let n = 0; n < 5; n++) {
        let x = cx + (rand() < 0.5 ? -2 : 1), y = Math.round(16 + rand() * 16);
        const dir = x < cx ? -1 : 1;
        for (let k = 0; k < 7; k++) {
          x += dir; y += Math.round(rand() * 2 - 1);
          const X = x + 0.5, Y = y + 0.5;
          if (!inPointed(X, Y, Ri - 0.3)) break;
          c.p(x, y, k < 3 ? 'n' : 'v');
        }
      }
      // sparks drifting off the gate
      for (let n = 0; n < 4; n++) {
        const a = rand() * Math.PI * 2, r = Ro + 0.5;
        const x = Math.round(cx + Math.cos(a) * r * 0.9), y = Math.round(sy + Math.sin(a) * r * 1.2) - 4;
        if (c.at(x, y) === '.' && y > 0 && y < 34) c.p(x, y, rand() < 0.5 ? 'v' : 'n');
      }
      // glowing runes on the jambs
      c.s(4, 25, ['V', 'v', 'V']).s(29, 25, ['V', 'u', 'V']);
      // obsidian plinth with a violet glow line
      c.r(0, 36, 34, 4, 'z');
      c.f((x) => ramp(x / 33, ['x', 'X', 'z', 'Z']), 0, 37, 33, 39);
      c.r(0, 36, 34, 1, 'x').r(0, 39, 34, 1, 'Z');
      c.f((x) => (x > 8 && x < 25 ? (x < 17 ? 'v' : 'V') : ''), 0, 36, 33, 36);
      // a few violet crystals at the foot
      c.s(1, 32, ['.v.', 'vVu', 'VuU', 'zzz']).s(29, 31, ['..v.', '.vVu', 'vVuU', 'zzzz']);
      return c.rows();
    };
    const RIFT_PAL = TP({ x: '#6a5a92', X: '#463a6a', z: '#2c2444', Z: '#18122a', c: '#b0a0e8',
      n: '#fbeaff', v: '#e09cff', V: '#a656f0', u: '#6a28c0', U: '#3c1474' });
    def('tw_rift', RIFT_PAL, frame(3));
    def('tw_rift2', RIFT_PAL, frame(11));
  }

  // ================= CONSTRUCTION SITE (40x30) =================
  {
    const c = grid(40, 30);
    // half-built stone wall with a ragged top
    const sky = [24, 22, 22, 19, 19, 19, 17, 17, 17, 17, 17, 20, 20, 20, 23, 23, 23, 21, 21, 21, 21, 19, 19, 19, 22, 22, 22, 24, 24, 24];
    blocks(c, 5, 16, 30, 11, 5, 3, ['S', 's', 'd'], 'D');
    for (let i = 0; i < 30; i++) {
      const x = 5 + i, top = sky[i] - 2;
      for (let y = 16; y < top; y++) c.p(x, y, '.');
      if (c.at(x, top) !== '.') c.p(x, top, 'S');
    }
    // scaffolding: three poles, two plank decks, braces
    for (const px of [4, 19, 34]) c.r(px, 3, 2, 25, 'w').r(px, 3, 1, 25, 'W').p(px, 3, 'W').p(px + 1, 3, 'W');
    for (let k = 0; k < 13; k++) { c.p(6 + k, 15 - Math.round(k * 4 / 12), 'b'); c.p(21 + k, 11 + Math.round(k * 4 / 12), 'b'); }
    c.r(2, 9, 36, 2, 'w').r(2, 9, 36, 1, 'W').r(2, 10, 36, 1, 'b').r(32, 9, 6, 1, 'w');
    c.r(2, 16, 36, 2, 'w').r(2, 16, 36, 1, 'W').r(2, 17, 36, 1, 'b').r(32, 16, 6, 1, 'w');
    c.p(11, 9, 'b').p(24, 9, 'b').p(13, 16, 'b').p(28, 16, 'b');
    // pulley at the top of the middle pole, a rope and a bucket of stones
    c.r(17, 1, 6, 2, 'w').r(17, 1, 6, 1, 'W');
    c.s(22, 2, ['iI', 'Ij']).r(23, 4, 1, 8, 'P');
    c.s(22, 12, ['iiI', 'sSd', 'iII']);
    // a stack of fresh planks
    c.s(25, 24, [
      '.WWWWWWWWWWWWW',
      'WwwwwwwwwwwwwB',
      'bbbbbbbbbbbbbB',
      '..WWWWWWWWWWWW',
      '.Wwwwwwwwwwwwb',
      '.bbbbbbbbbbbbB',
    ]);
    // the sign: a yellow board with a hammer, on two legs
    c.r(2, 23, 1, 7, 'b').r(9, 23, 1, 7, 'B');
    c.r(0, 15, 12, 9, 'O');
    c.f((x, y) => ((x - 1) / 9 + (y - 16) / 6 < 0.9 ? 'y' : 'Y'), 1, 16, 10, 22);
    c.r(0, 15, 12, 1, 'Y').r(0, 15, 1, 9, 'Y');
    c.s(3, 16, [
      '.jjjjI',
      '.iiiII',
      '...wb.',
      '...wb.',
      '...wb.',
      '...BB.',
    ]);
    // the dirt yard
    c.f((x, y, ch) => {
      if (ch !== '.') return '';
      if (y === 27) return x > 0 && x < 39 ? (x % 7 === 3 ? 'N' : 'n') : '';
      return (x + y) % 5 === 0 ? 'Z' : x > 30 ? 'N' : 'n';
    }, 0, 27, 39, 29);
    c.p(14, 28, 's').p(15, 28, 'd').p(22, 29, 's');
    def('tw_build', TP({ n: '#c8a468', N: '#9a7848', Z: '#6a5030' }), c.rows());
  }

  // ================= FOUNTAIN (30x24, 2 frames) =================
  {
    const W = 30, H = 24, cx = 15;
    const frame = (ph) => {
      const c = grid(W, H);
      const rx = 14.5, ry = 4.2, cy = 15.5, by = 21.2;
      c.f((x, y) => {
        const X = x + 0.5, Y = y + 0.5, u = (X - cx) / rx;
        if (Math.abs(u) > 1) return '';
        const e = Math.sqrt(1 - u * u);
        if (Y < cy - ry * e || Y > by + 2.2 * e) return '';
        const d = ((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2;
        const di = ((X - cx) / (rx - 2)) ** 2 + ((Y - cy + 0.3) / (ry - 1.2)) ** 2;
        if (di < 1) {
          // water: ripple rings moving out with the phase
          const rr = Math.sqrt(((X - cx) / 1.0) ** 2 + ((Y - cy) * 2.6) ** 2);
          const ring = (rr * 0.32 - ph) % 1;
          if (Y < cy - ry * 0.45 + 0.4) return 'n';
          return ring < 0.18 ? 'c' : (X > cx + 6 ? 'n' : 'C');
        }
        if (d < 1) return X < cx - 4 ? 'S' : X < cx + 7 ? 's' : 'd';
        // front wall: coursed stone, cylinder-shaded
        const t = (X - 0.5) / 29;
        const q = ramp(t, ['S', 's', 'd', 'D'], [0.15, 0.55, 0.85]);
        if (Math.abs(Y - (cy + ry * e + 2.2)) < 0.5) return 'D';
        if ((x + (Y > cy + ry * e + 2.2 ? 2 : 0)) % 5 === 0) return q === 'S' ? 's' : 'D';
        return q;
      });
      // centre column and the upper bowl
      c.r(14, 9, 2, 7, 's').p(14, 9, 'S').r(14, 9, 1, 7, 'S');
      c.s(9, 7, ['.SSSSsssdd.', 'SsxccCCCsdd', '.SsssssddD.', '...ssdd....']);
      c.r(13, 15, 4, 1, 'd');
      // jet and falling streams
      c.r(14, 1, 2, 6, 'c').r(14, 1, 1, 6, 'x');
      const drops = ph < 0.5
        ? [[13, 0, 'x'], [16, 1, 'c'], [11, 2, 'c'], [18, 3, 'c'], [12, 4, 'C']]
        : [[14, 0, 'x'], [12, 1, 'c'], [17, 2, 'c'], [11, 4, 'c'], [19, 4, 'C']];
      drops.forEach(([x, y, ch]) => c.p(x, y, ch));
      for (const [sx, dir] of [[9, -1], [19, 1]]) {
        for (let y = 9; y <= 13; y++) {
          const x = sx + (y > 10 ? dir : 0) + (y > 12 ? dir : 0);
          c.p(x, y, (y + Math.round(ph * 2)) % 2 ? 'c' : 'x');
        }
      }
      // splash on the water
      const sp = ph < 0.5 ? [[7, 13], [22, 13], [9, 14], [21, 14]] : [[8, 13], [23, 14], [10, 13], [20, 13]];
      sp.forEach(([x, y]) => c.p(x, y, 'x'));
      return c.rows();
    };
    const FPAL = TP({ x: '#effcff', c: '#9fe8ff', C: '#5ac0f0', n: '#3a8ad8', N: '#2a5aa8' });
    def('tw_fountain', FPAL, frame(0));
    def('tw_fountain2', FPAL, frame(0.5));
  }

  // ================= MARKET STALLS (28x26) =================
  function stall(id, awn, wares) {
    const c = grid(28, 26);
    // dark back of the stall
    c.r(3, 8, 22, 9, 'K').r(3, 8, 22, 1, 'k');
    // posts
    c.r(2, 6, 2, 20, 'w').r(2, 6, 1, 20, 'W').r(24, 6, 2, 20, 'b').r(24, 6, 1, 20, 'w');
    // awning: ridge pole, striped canopy, scalloped edge
    c.r(1, 0, 26, 1, 'b').r(1, 0, 3, 1, 'w');
    const stripe = (x) => Math.floor(x / 4) % 2;
    c.f((x, y) => {
      const shade = y > 4 || x > 22 ? 1 : 0;
      if (y === 1) return stripe(x) ? 'h' : 'r';
      return stripe(x) ? (shade ? 'P' : 'p') : (shade ? 'A' : 'a');
    }, 0, 1, 27, 6);
    c.p(0, 1, '.').p(27, 1, '.');
    for (let x = 0; x < 28; x++) { const lx = x % 4; if (lx === 1 || lx === 2) c.p(x, 7, stripe(x) ? 'P' : 'e'); }
    // wares on the counter
    wares(c);
    // counter: plank front with a cloth drape
    c.r(1, 16, 26, 1, 'W').r(1, 17, 26, 1, 'b');
    c.f((x, y) => ((x - 1) % 6 === 5 ? 'b' : y === 18 ? 'W' : x > 21 ? 'b' : 'w'), 1, 18, 26, 24);
    c.r(1, 25, 26, 1, 'B');
    c.f((x, y) => {
      const sc = (x - 1) % 4;
      if (y === 21 && sc === 0) return '';
      return Math.floor((x - 1) / 4) % 2 ? 'A' : 'a';
    }, 7, 18, 20, 21);
    c.r(7, 18, 14, 1, 'r');
    def(id, TP(Object.assign({}, RED, awn)), c.rows());
  }
  stall('tw_stall', { a: '#e8413c', A: '#a82a26', r: '#ff7a6a', e: '#7a1a1e' }, (c) => {
    // apples, oranges in a basket, cabbages
    c.f((x, y) => {
      const X = x + 0.5, Y = y + 0.5, d = dist(X, Y * 1.3, 8, 16.2 * 1.3);
      if (d > 4.6 || Y > 16) return '';
      return (x + y * 2) % 3 === 0 ? 'A' : (x + y) % 4 === 0 ? 'x' : 'm';
    }, 3, 11, 13, 15);
    c.s(12, 11, ['.oYo.Yo', 'YoYYoYo', 'BbbbbbB', '.bwWwb.', '..BBB..']);
    c.s(19, 12, ['.lg.gl', 'lgGlgG', 'gGgGGG', '.GGGG.']);
    c.s(5, 8, ['P', 'P', 'g']).s(22, 8, ['P', 'P', 'Y']).r(6, 9, 15, 1, 'P');
    c.s(9, 10, ['a', 'A']).s(13, 10, ['l', 'G']).s(17, 10, ['Y', 'o']);
  });
  stall('tw_stall2', { a: '#4f8ae0', A: '#2f5aa8', r: '#8ab8ff', e: '#1e3a7a' }, (c) => {
    // bread loaves, a wheel of cheese, jars
    c.s(4, 12, ['.WWWw.', 'WhWWwb', 'wwwwbb', '.bbbB.']);
    c.s(9, 13, ['.WWw.', 'WWwwb', '.wbB.']);
    c.s(14, 11, ['.yyyyY.', 'yhyyyYz', 'yyyyYYz', 'zyyYYzz', '.zzzzz.']);
    c.s(21, 11, ['.jI', 'uvU', 'uuU', 'UUU']).s(18, 12, ['jI', 'mM', 'mM', 'MM']);
    c.r(6, 9, 15, 1, 'P').s(8, 10, ['W', 'b']).s(12, 10, ['y', 'z']).s(16, 10, ['W', 'b']).s(20, 10, ['j', 'i']);
  });
  // stall palette extras (wares)
  {
    const extra = { m: '#ff4f4f', x: '#ffd0c0', z: '#c0841e', u: '#7fd0ff', v: '#e0f8ff', U: '#3f8ae0' };
    for (const id of ['tw_stall', 'tw_stall2']) Object.assign(SPR.defs[id].pal, extra, id === 'tw_stall2' ? { m: '#d06ad0', M: '#8a3a9a' } : {});
  }

  // ================= SMALL PROPS =================
  def('tw_bench', TOWN, [
    'WWWWWWWWWWWWWWWw',
    'wwwwwwwwwwwwwwbb',
    '.I..........I...',
    'WWWWWWWWWWWWWWWw',
    'wwwwwwwwwwwwwbbb',
    'bbbbbbbbbbbbbbBB',
    '.iI.........iI..',
    '.II.........II..',
  ].map(r => r.slice(0, 16)));
  def('tw_lantern', TOWN, [
    '.iiI..',
    'I...I.',
    '....I.',
    '...iI.',
    '..II..',
    '.IiiI.',
    'IIIIII',
    'IhyyYI',
    'IyyYYI',
    'IyYYoI',
    'IIIIII',
    '..iI..',
  ]);
  // sitting cat: orange tabby with a white chest; frame 2 flicks the tail down
  {
    const pal = TP({ a: '#ffb060', A: '#d07a30', z: '#9a4e20', x: '#fbf4e8', e: '#3a8a3a' });
    def('tw_cat', pal, [
      'a...a..z',
      'aaaaA..A',
      'eaeaA..A',
      '.axA..A.',
      '.axaAAA.',
      '.aaAAAz.',
    ]);
    def('tw_cat2', pal, [
      'a...a...',
      'aaaaA...',
      'eaeaA...',
      '.axA....',
      '.axaAA.z',
      '.aaAAAAA',
    ]);
  }
  def('tw_dog', TP({ f: '#c88a50', F: '#9a6030', z: '#5e3618', a: '#e8413c', x: '#f0e2c0' }), [
    '.zz.......',
    'zffz.....f',
    'fkfF....fF',
    'kffaffffF.',
    '.xxaffffFF',
    '..fFFFFFF.',
    '..f.F.f.F.',
    '..z.z.z.z.',
  ]);
  {
    const pal = TP({ x: '#fbfaf4', X: '#d6d0c2', a: '#e8413c' });
    def('tw_chicken', pal, [
      '.a....',
      'yxkx.X',
      '.axxxX',
      '.xxxXX',
      '..xXX.',
      '..Y.Y.',
    ]);
    def('tw_chicken2', pal, [
      '.....X',
      '..xxxX',
      '.axxXX',
      'yxkXX.',
      '.a.XX.',
      '..Y.Y.',
    ]);
  }

  // ================= UPGRADED FORGE (52x48: art4 forge + 6 rows of chimney) =================
  {
    const o = 6, c = grid(52, 42 + o);
    roof(c, 5 + o, 17 + o, 13, 38, 1, ['r', 'R', 'q', 'Q']);
    c.r(13, 5 + o, 26, 1, 'y').r(30, 5 + o, 9, 1, 'Y');
    c.r(0, 18 + o, 52, 1, 'B').r(1, 18 + o, 50, 1, 'b');
    // a big stone chimney with a capped, glowing crown
    blocks(c, 34, 4, 10, 15 + o - 4, 5, 3, ['S', 's', 'd'], 'D');
    c.r(32, 1, 14, 3, 's').r(32, 1, 14, 1, 'S').r(42, 2, 4, 2, 'd').r(32, 3, 14, 1, 'D');
    c.r(34, 2, 10, 1, 'k').r(35, 2, 8, 1, 'o').r(37, 2, 4, 1, 'Y');
    c.p(36, 0, 'Y').p(39, 0, 'y').p(42, 0, 'o').p(33, 0, 'O');
    // walls
    c.r(3, 19 + o, 46, 17, 'p');
    c.f((x, y) => (x > 12 && x < 17) || (x > 43 && x < 47) || y > 32 + o ? 'P' : '', 5, 21 + o, 46, 35 + o);
    c.r(3, 19 + o, 46, 2, 'b').r(3, 19 + o, 46, 1, 'w');
    c.r(3, 19 + o, 2, 17, 'b').r(3, 19 + o, 1, 17, 'w');
    c.r(47, 19 + o, 2, 17, 'B').r(47, 19 + o, 1, 17, 'b');
    c.r(5, 27 + o, 12, 1, 'b').r(40, 27 + o, 7, 1, 'b');
    window_(c, 7, 22 + o, 7, 5, 'b', ['h', 'y', 'Y'], true);
    // crossed swords over a shield on the right wall
    c.s(40, 28 + o, ['j.....j', '.jiaaj.', '..ayAi.', '..aAAe.', '.y.ae.y']);
    // the open front, brighter hearth
    c.r(17, 21 + o, 21, 15, 'k');
    c.f((x, y) => {
      const d = dist(x, y * 1.25, 28, (34 + o) * 1.25);
      return d < 7 ? 'x' : d < 11 ? 'X' : y < 23 + o ? 'k' : 'K';
    }, 19, 21 + o, 37, 35 + o);
    c.r(17, 21 + o, 2, 15, 'w').r(17, 21 + o, 1, 15, 'W');
    c.r(38, 21 + o, 2, 15, 'b').r(39, 21 + o, 1, 15, 'B');
    c.r(19, 21 + o, 19, 1, 'B');
    c.r(24, 22 + o, 9, 3, 'd').r(24, 22 + o, 1, 3, 's').r(32, 22 + o, 1, 3, 'D');
    c.r(22, 25 + o, 13, 11, 's');
    blocks(c, 22, 25 + o, 13, 11, 4, 3, ['S', 's', 'd'], 'D');
    c.r(22, 25 + o, 13, 1, 'S');
    c.f((x, y) => {
      const t = dist(x, y * 1.3, 28, (35.5 + o) * 1.3);
      if (y === 28 + o && (x === 25 || x === 31)) return '';
      return t < 3 ? 'h' : t < 4.8 ? 'y' : t < 6.4 ? 'Y' : t < 7.8 ? 'o' : 'O';
    }, 25, 28 + o, 31, 35 + o);
    c.p(25, 28 + o, 'D').p(31, 28 + o, 'D');
    c.r(20, 24 + o, 1, 6, 'i').p(21, 24 + o, 'i').p(21, 29 + o, 'I');
    c.s(35, 24 + o, ['i.i', 'i.I', '.I.']);
    // banners hung over the front posts
    const EMB = ['y.y', '.y.', 'yYy'];
    banner(c, 15, 20 + o, 5, 10, EMB);
    banner(c, 36, 20 + o, 5, 10, EMB);
    // stone base with a gold trim
    blocks(c, 1, 36 + o, 50, 6, 6, 3, ['S', 's', 'd'], 'D');
    c.r(1, 36 + o, 50, 1, 'S').r(1, 41 + o, 50, 1, 'D');
    c.r(18, 36 + o, 21, 1, 'x');
    // the anvil, hot metal glowing on it and sparks flying
    c.s(4, 31 + o, [
      'jjjjjjjjjjj.',
      '.YiiiiiiiiiI',
      '...iiiiiiII.',
      '.....iiI....',
      '....jiiiI...',
      '...iiiiiII..',
      '...WwwwwBb..',
      '...wwwwwbb..',
      '..BWwwwwbbB.',
      '..BBBBBBBBB.',
    ]);
    c.s(5, 28 + o, ['..y..h.', 'y..hy..', '.hhyYYo']).r(4, 31 + o, 11, 1, 'Y').r(6, 31 + o, 6, 1, 'y');
    c.p(13, 26 + o, 'Y');
    def('tw_forge_2', TP(Object.assign({ r: '#7a7898', R: '#5a5874', q: '#42405a', Q: '#2e2c42', x: '#8a4220', X: '#4a2420' }, RED)), c.rows());
  }

  // ================= UPGRADED TAVERN (60x55: a third floor, flower boxes, more lights) =================
  {
    const o = 13, c = grid(60, 44 + o);
    blocks(c, 44, 1, 6, 9, 3, 3, ['S', 's', 'd'], 'D');
    c.r(43, 0, 8, 2, 's').r(43, 0, 8, 1, 'S').r(45, 1, 4, 1, 'k');
    // a second chimney
    blocks(c, 11, 1, 4, 9, 2, 3, ['S', 's', 'd'], 'D');
    c.r(10, 0, 6, 2, 's').r(10, 0, 6, 1, 'S').r(11, 1, 4, 1, 'k');
    roof(c, 2, 13, 13, 46, 1, ['r', 'R', 'q', 'Q']);
    // a dormer window in the roof
    c.s(26, 4, ['...rr...', '..rRRq..', '.rRRRRq.', 'rrRRRRqQ', '.bbbbbB.', '.bhyyYB.', '.byyYoB.', '.bbbbbB.']);
    c.r(0, 14, 60, 1, 'B').r(1, 14, 58, 1, 'b');
    // two plaster storeys
    const storey = (y0, shutters) => {
      c.r(4, y0, 52, 11, 'p');
      c.f((x, y) => (x > 49 || y > y0 + 8 ? 'P' : ''), 4, y0, 55, y0 + 10);
      for (const px of [4, 18, 30, 42]) c.r(px, y0, 2, 11, 'b').r(px, y0, 1, 11, 'w');
      c.r(54, y0, 2, 11, 'B').r(54, y0, 1, 11, 'b');
      c.r(4, y0, 52, 1, 'w');
      window_(c, 9, y0 + 2, 6, 6, 'b', ['h', 'y', 'Y'], true);
      window_(c, 22, y0 + 2, 6, 6, 'b', ['h', 'y', 'Y'], true);
      window_(c, 34, y0 + 2, 6, 6, 'b', ['h', 'y', 'Y'], true);
      window_(c, 46, y0 + 2, 6, 6, 'b', ['y', 'Y', 'o'], true);
      // flower boxes under each window
      for (const wx of [9, 22, 34, 46]) {
        if (shutters) c.r(wx - 1, y0 + 2, 1, 6, 't').r(wx + 6, y0 + 2, 1, 6, 'T').p(wx - 1, y0 + 4, 'T').p(wx + 6, y0 + 4, 'G');
        c.r(wx - 1, y0 + 8, 8, 2, 'w').r(wx - 1, y0 + 8, 8, 1, 'W').r(wx + 5, y0 + 9, 2, 1, 'b');
        c.s(wx - 1, y0 + 7, [(wx % 2 ? 'mluGmlug' : 'ulmGulmg')]);
      }
    };
    storey(15, true);
    c.r(2, 26, 56, 1, 'w').r(2, 27, 56, 1, 'b');
    storey(28);
    // jetty beam with a string of lights
    c.r(2, 26 + o, 56, 2, 'b').r(2, 26 + o, 56, 1, 'w').r(2, 27 + o, 56, 1, 'B');
    // ground floor stone, windows, door
    blocks(c, 5, 28 + o, 50, 12, 6, 3, ['S', 's', 'd'], 'D');
    for (let x = 3; x < 57; x++) {
      const sag = Math.round(Math.sin(((x - 3) % 9) / 9 * Math.PI) * 1.4);
      c.p(x, 28 + o + sag, 'K');
      if ((x - 3) % 9 === 4) c.p(x, 29 + o + sag, 'hmyu'[Math.floor((x - 3) / 9) % 4]);
    }
    window_(c, 6, 31 + o, 7, 6, 'B', ['h', 'y', 'Y'], true);
    window_(c, 46, 31 + o, 7, 6, 'B', ['y', 'Y', 'o'], true);
    c.s(25, 29 + o, [
      '..BBBBBB..',
      '.BwWwwwbB.',
      'BwWwwwwbbB',
      'BwWyyYwbbB',
      'BwWYYYwbbB',
      'BwWwwwwbbB',
      'BwWwbwwbbB',
      'BwWwbwwyyB',
      'BwWwbwwbbB',
      'BwWwbwwbbB',
      'BwWwbwwbbB',
    ]);
    // lanterns either side of the door
    const LAN = ['.I.', '.I.', 'IiI', 'hyY', 'yYo', 'III'];
    // base + step
    blocks(c, 2, 40 + o, 56, 4, 7, 2, ['S', 's', 'd'], 'D');
    c.r(2, 40 + o, 56, 1, 'S').r(2, 43 + o, 56, 1, 'D');
    c.r(24, 40 + o, 12, 1, 'y');
    // hanging sign
    c.r(15, 28 + o, 9, 1, 'I').r(15, 28 + o, 8, 1, 'i').p(23, 29 + o, 'I');
    c.p(16, 29 + o, 'i').p(21, 29 + o, 'i');
    c.s(14, 30 + o, [
      'BBBBBBBBBB',
      'BYyyyyyyzB',
      'BwphhpwwbB',
      'BwjyyjjwbB',
      'BwjyYjbjbB',
      'BwjyYjbjbB',
      'BwjYYjjwbB',
      'BwwjjwwbbB',
      'BBBBBBBBBB',
    ]);
    // barrels and a flower tub
    const BARREL = [
      '.wWWwb.',
      'iijiiII',
      'wWWwwbb',
      'wWWwwbB',
      'iijiiII',
      'wWWwwbB',
      'wWWwwbB',
      'iijiiII',
      '.wWwbB.',
    ];
    c.s(38, 31 + o, BARREL.slice(0, 4));
    c.s(35, 35 + o, BARREL).s(42, 35 + o, BARREL);
    c.s(1, 36 + o, ['.mlum.', 'gGgGgG', 'WwwwbB', '.wwbB.']);
    c.s(2, 28 + o, LAN).s(55, 28 + o, LAN);
    def('tw_tavern_2', TP(Object.assign({ r: '#d0604a', R: '#a63e34', q: '#7a2a28', Q: '#541a1e', m: '#ff5a7a', u: '#b682f0', t: '#5aa84e', T: '#3a7a3a' }, GOLD)), c.rows());
  }

  // ================= UPGRADED ALCHEMIST (46x44: a greenhouse dome, more potions) =================
  {
    const o = 4, c = grid(46, 40 + o);
    // chimney with green smoke, behind the dome
    blocks(c, 35, 4, 5, 12, 3, 3, ['S', 's', 'd'], 'D');
    c.r(34, 4, 7, 1, 'S');
    c.s(34, 0, ['..lt.', '.ltt.', 'lt...', '.t...']);
    // greenhouse: a glass dome on iron ribs, plants showing through
    const gx = 23, gy = 22, grx = 20.5, gry = 19;
    c.f((x, y) => {
      const X = x + 0.5, Y = y + 0.5, u = (X - gx) / grx, v = (Y - gy) / gry, d = u * u + v * v;
      if (d > 1 || Y > gy) return '';
      // plants inside: a fern mound and a tall leafy stalk
      const plant = ((X - 14) / 7) ** 2 + ((Y - 22) / 7) ** 2 < 1 || ((X - 30) / 6) ** 2 + ((Y - 22) / 9) ** 2 < 1 || (Math.abs(X - 22) < 1 && Y > 9);
      const lit = -u * 0.3 - v * 0.25 + (1 - d) * 0.4;
      const gleam = Math.abs((X - gx) * 0.7 + (Y - gy) + 13) < 1.1 && X < gx;
      let ch;
      if (gleam) ch = 'x';
      else if (plant) ch = (x * 3 + y * 5) % 7 === 0 ? 'l' : lit > 0.4 ? 'g' : 'G';
      else ch = lit > 0.55 ? 'e' : lit > 0.3 ? 'E' : 'z';
      // iron ribs: meridians and parallels
      const s = Math.sqrt(Math.max(0, 1 - v * v));
      if ([-0.66, -0.33, 0, 0.33, 0.66].some(r => Math.abs(u - r * s) < 0.55 / grx)) ch = X < gx - 4 ? 'i' : 'I';
      if ([0.35, 0.68].some(r => Math.abs(-v - r) < 0.55 / gry)) ch = X < gx - 4 ? 'i' : 'I';
      if (d > 0.9) ch = X < gx ? 'j' : 'I';
      return ch;
    }, 1, 2, 44, 22);
    c.p(22, 1, 'j').p(23, 1, 'I').r(22, 0, 2, 1, 'y').p(23, 0, 'Y');
    c.r(0, 18 + o, 46, 1, 'B').r(1, 18 + o, 44, 1, 'b');
    // walls
    c.r(3, 19 + o, 40, 17, 'p');
    c.f((x, y) => (x > 36 || y > 32 + o ? 'P' : ''), 4, 19 + o, 42, 35 + o);
    c.r(3, 19 + o, 2, 17, 'w').r(3, 19 + o, 1, 17, 'W');
    c.r(41, 19 + o, 2, 17, 'b').r(42, 19 + o, 1, 17, 'B');
    c.r(5, 19 + o, 36, 1, 'b');
    // round window with potions on its sill
    c.f((x, y) => {
      const d = dist(x + 0.5, y + 0.5, 11, 25 + o);
      if (d > 4.2) return '';
      if (d > 3.1) return 'b';
      if (Math.abs(x + 0.5 - 11) < 0.6 || Math.abs(y + 0.5 - 25 - o) < 0.6) return 'b';
      return (x + y - o) < 34 ? 'e' : (x + y - o) < 37 ? 'E' : 'z';
    }, 6, 20 + o, 16, 30 + o);
    c.r(6, 30 + o, 11, 1, 'W').r(6, 31 + o, 11, 1, 'b');
    c.s(7, 27 + o, ['P..P...P.', 'a.vc..yc.', 'Aa.vC.yYc']);
    // door
    c.s(18, 21 + o, [
      '..bbbb..',
      '.bwWwwb.',
      'bwWwwwbb',
      'bwWwbwbb',
      'bwWwbwbb',
      'bwWwbwbb',
      'bwWwbwbb',
      'bwWwbwyb',
      'bwWwbwbb',
      'bwWwbwbb',
      'bwWwbwbb',
      'bwWwbwbb',
      'bwWwbwbb',
      'bwWwbwbb',
      'BBBBBBBB',
    ]);
    // three shelves of potions
    const sy = 21 + o;
    c.r(28, sy, 12, 15, 'K').r(28, sy, 12, 1, 'b').r(28, sy, 1, 15, 'b').r(39, sy, 1, 15, 'B');
    for (const yy of [sy + 4, sy + 9, sy + 14]) c.r(29, yy, 10, 1, 'W').r(29, yy + 1, 10, 1, 'b');
    c.r(29, sy + 14, 10, 1, 'W');
    const bottle = (x, y, col, tall) => {
      if (tall) c.p(x, y - 4, 'P').p(x, y - 3, 'f');
      else c.p(x, y - 3, 'P');
      c.p(x - 1, y - 2, col).p(x, y - 2, 'h').p(x + 1, y - 2, col);
      c.p(x - 1, y - 1, col).p(x, y - 1, col).p(x + 1, y - 1, col.toUpperCase());
    };
    bottle(30, sy + 4, 'a', false); bottle(33, sy + 4, 'c', true); bottle(37, sy + 4, 'v', false);
    bottle(30, sy + 9, 'e', true); bottle(33, sy + 9, 'y', false); bottle(37, sy + 9, 'a', true);
    bottle(30, sy + 14, 'v', false); bottle(34, sy + 14, 'c', true); bottle(37, sy + 14, 'e', false);
    // stone base
    blocks(c, 1, 36 + o, 44, 4, 5, 2, ['S', 's', 'd'], 'D');
    c.r(1, 36 + o, 44, 1, 'S').r(1, 39 + o, 44, 1, 'D');
    // cauldron out front, and a crate of potions by the shelves
    c.s(0, 29 + o, [
      '..l.t...l.',
      '.t..l.t...',
      'jiiiiiiiiI',
      'IltlltlttI',
      'KIiiIIIIKK',
      'KiIIIIIIKK',
      '.KIIIIIKK.',
      '..KKKKKK..',
      '.oKyoYKo..',
      '.OY.o.YO..',
      'BbbbbbbbB.',
    ]);
    c.s(38, 33 + o, ['.a.c.v.', 'ahcCvVb', 'WWWWWWb', 'WbwwbwB', 'wbwwbbB', 'BBBBBBB']);
    def('tw_alch_2', TP({ r: '#8ad86a', R: '#4ea84a', q: '#2e7a3a', Q: '#1c5a2c', t: '#4fd65b', e: '#c8fff0', E: '#7fe0c0', z: '#3aa890', x: '#f4fffc',
      a: '#ff4f6a', A: '#b82a40', c: '#4fa8ff', C: '#2a6ac0', v: '#c070ff', V: '#7a3ac0', f: '#a87048' }), c.rows());
  }

  // ================= HUD ICONS (10x10) =================
  // barracks: a red shield over crossed swords
  def('ic_barracks', TP(Object.assign({}, RED, GOLD)), [
    'j........j',
    'ij......ji',
    '.iaaaaaAi.',
    '..ayyyAA..',
    '..aaYaAe..',
    '..aaYAAe..',
    '.y.aAAe.y.',
    '..y.Ae.y..',
    '.b.y..y.b.',
    'Y........Y',
  ]);
  // trophy hall: a copper dome over white columns, a golden cup in the doorway (ic_trophy is the bare cup)
  def('ic_museum', TP(Object.assign({ c: '#a8f0d8', C: '#62c4a8', v: '#3a9484', V: '#24605a' }, MARBLE, GOLD)), [
    '....yz....',
    '...cCCv...',
    '..cCCvvV..',
    '.mmmmmMnN.',
    '.mNhyYNnN.',
    '.mNyyzNnN.',
    '.mNNyNNnN.',
    '.mNyYzNnN.',
    '.mmmmMMnN.',
    'mmmMMMnnNN',
  ]);
  // temple: a white shrine with a gold flame on top
  def('ic_temple', TP(Object.assign({}, MARBLE, GOLD)), [
    '....hy....',
    '...yhyY...',
    '....yY....',
    '...mmMn...',
    '..mmmMMn..',
    '.yyyyYYYz.',
    '.mMNhyNnN.',
    '.mMNyYNnN.',
    '.mMNyYNnN.',
    'mmmmMMMnnN',
  ]);
  // rift gate: an obsidian arch around a violet tear
  def('ic_riftgate', TP({ x: '#6a5a92', X: '#463a6a', z: '#2c2444', Z: '#18122a', n: '#fbeaff', v: '#e09cff', V: '#a656f0', u: '#6a28c0' }), [
    '...xXXz...',
    '..xXzzXz..',
    '.xXVVVVzZ.',
    '.xVuvnVVZ.',
    'xXVuvnuVzZ',
    'xXVvnvuVzZ',
    'xXVunvuVzZ',
    'xXVvnuuVzZ',
    'xXVuvnuVzZ',
    'xxXXzzzzZZ',
  ]);
  // 3.6: Gems, the premium currency (continue a fallen run, the store)
  def('ic_gem', { p: '#ff5ad2', P: '#b8208c', w: '#ffe0f6', d: '#6a0f52' }, [
    '..pppp..',
    '.pwwpPp.',
    'pwppPPPp',
    'dPpPPPPd',
    '.dPPPPd.',
    '..dPPd..',
    '...dd...',
    '........',
  ]);
})(globalThis.G = globalThis.G || {});
