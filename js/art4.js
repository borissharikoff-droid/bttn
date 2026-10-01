// BTTN — art for the TOWN hub: the buildings (forge, enchanter's tower, alchemist, tavern, notice board,
// observatory, hatchery, portal back to the field), street props, the five townsfolk and the HUD icon.
// Loaded after sprites.js (and art2.js / art3.js); uses its def(). SPR.get() adds the 1px dark outline
// itself, so none of these grids carry one (inner lines are drawn with the dark 'k' / 'K' keys).
(function (G) {
  'use strict';
  const SPR = G.SPR;
  if (!SPR) return;
  const def = SPR.def;

  // ---------- helpers ----------
  const dist = (x, y, cx, cy) => Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
  // a w x h char grid with a few drawing ops; .rows() gives the def() rows
  function grid(w, h) {
    const g = [];
    for (let y = 0; y < h; y++) g.push(new Array(w).fill('.'));
    const C = {
      w, h,
      at: (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? g[y][x] : '.'),
      p(x, y, c) { if (c && x >= 0 && y >= 0 && x < w && y < h) g[y][x] = c; return C; },
      r(x, y, rw, rh, c) { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) C.p(x + i, y + j, c); return C; },
      // painter over the region: fn(x, y, current) -> char to set, or falsy to keep
      f(fn, x0, y0, x1, y1) {
        x0 = x0 || 0; y0 = y0 || 0; x1 = x1 == null ? w - 1 : x1; y1 = y1 == null ? h - 1 : y1;
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) C.p(x, y, fn(x, y, C.at(x, y)));
        return C;
      },
      // paste rows at x, y ('.' keeps what is under)
      s(x0, y0, rows) {
        rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] !== '.') C.p(x0 + x, y0 + y, r[x]); });
        return C;
      },
      // recolour: inside the region swap chars by map {from: to}
      swap(map, x0, y0, x1, y1) { return C.f((x, y, c) => map[c], x0, y0, x1, y1); },
      rows: () => g.map(r => r.join('')),
    };
    return C;
  }
  // pick from a light→dark ramp by t in 0..1 (left = lit)
  const ramp = (t, chars, cuts) => {
    cuts = cuts || [0.22, 0.55, 0.82];
    for (let i = 0; i < cuts.length; i++) if (t < cuts[i]) return chars[i];
    return chars[cuts.length];
  };
  // rows for a w x h piece from a per-pixel painter (x, y) -> palette char or '.'
  function paint(w, h, fn) {
    const rows = [];
    for (let y = 0; y < h; y++) { let r = ''; for (let x = 0; x < w; x++) r += fn(x, y) || '.'; rows.push(r); }
    return rows;
  }

  // ---------- shared town palette ----------
  // S s d D stone (light→dark) · W w b B wood · p P plaster · k K dark interior / inner lines
  // h y Y o O warm glow (hot white → deep orange) · j i I iron · g G l foliage
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

  // shingled roof: a trapezoid from the ridge row y0 to the eave row y1, growing `slope` px per row each side.
  // course of 3 rows: lit top edge, body, shadow; seams staggered. chars [light, mid, dark, deepest]
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
  // stone blocks over a rect, mortar in `m`, blocks lit at their top-left
  function blocks(c, x0, y0, rw, rh, bw, bh, ch, m) {
    c.f((x, y) => {
      const ly = y - y0, row = Math.floor(ly / bh), lx = x - x0 + (row % 2) * Math.floor(bw / 2);
      if (ly % bh === bh - 1 || lx % bw === bw - 1) return m;
      if (ly % bh === 0 || lx % bw === 0) return ch[0];
      return (x - x0) / rw > 0.7 ? ch[2] : ch[1];
    }, x0, y0, x0 + rw - 1, y0 + rh - 1);
  }
  // a lit window: frame f, glass glowing top-left → bottom-right, cross mullion
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

  // ================= THE FORGE (52x42) =================
  {
    const c = grid(52, 42);
    // dark slate roof
    roof(c, 5, 17, 13, 38, 1, ['r', 'R', 'q', 'Q']);
    c.r(0, 18, 52, 1, 'B').r(1, 18, 50, 1, 'b');
    // stone chimney through the roof, embers drifting out
    blocks(c, 36, 2, 7, 13, 4, 3, ['S', 's', 'd'], 'D');
    c.r(35, 1, 9, 2, 's').r(35, 1, 9, 1, 'S').r(37, 2, 5, 1, 'k');
    c.p(39, 0, 'Y').p(42, 0, 'o');
    // walls: timber posts + beams, plaster panels
    c.r(3, 19, 46, 17, 'p');
    c.f((x, y) => (x > 12 && x < 17) || (x > 43 && x < 47) || y > 32 ? 'P' : '', 5, 21, 46, 35);
    c.r(3, 19, 46, 2, 'b').r(3, 19, 46, 1, 'w');
    c.r(3, 19, 2, 17, 'b').r(3, 19, 1, 17, 'w');
    c.r(47, 19, 2, 17, 'B').r(47, 19, 1, 17, 'b');
    c.r(5, 27, 12, 1, 'b').r(40, 27, 7, 1, 'b');
    c.s(40, 29, ['.iIi.', 'iaaAI', 'iayAI', 'iaAAI', '.iII.']); // a shield hung on the plaster
    window_(c, 7, 22, 7, 5, 'b', ['y', 'Y', 'o'], true);
    // the open front: posts, dark workshop, the hearth glowing at the back
    c.r(17, 21, 21, 15, 'k');
    c.f((x, y) => {
      const d = dist(x, y * 1.25, 28, 34 * 1.25);
      return d < 6 ? 'x' : d < 10 ? 'X' : y < 23 ? 'k' : 'K';
    }, 19, 21, 37, 35);
    c.r(17, 21, 2, 15, 'w').r(17, 21, 1, 15, 'W');
    c.r(38, 21, 2, 15, 'b').r(39, 21, 1, 15, 'B');
    c.r(19, 21, 19, 1, 'B');
    // hood + hearth
    c.r(24, 22, 9, 3, 'd').r(24, 22, 1, 3, 's').r(32, 22, 1, 3, 'D');
    c.r(22, 25, 13, 11, 's');
    blocks(c, 22, 25, 13, 11, 4, 3, ['S', 's', 'd'], 'D');
    c.r(22, 25, 13, 1, 'S');
    c.f((x, y) => {
      const t = dist(x, y * 1.3, 28, 35.5 * 1.3);
      if (y === 28 && (x === 25 || x === 31)) return '';
      return t < 2.6 ? 'h' : t < 4.4 ? 'y' : t < 6.2 ? 'Y' : t < 7.6 ? 'o' : 'O';
    }, 25, 28, 31, 35);
    c.p(25, 28, 'D').p(31, 28, 'D');
    // tongs and a horseshoe on the workshop wall
    c.r(20, 24, 1, 6, 'i').p(21, 24, 'i').p(21, 29, 'I');
    c.s(35, 24, ['i.i', 'i.I', '.I.']);
    // stone base
    blocks(c, 1, 36, 50, 6, 6, 3, ['S', 's', 'd'], 'D');
    c.r(1, 36, 50, 1, 'S').r(1, 41, 50, 1, 'D');
    c.r(18, 36, 21, 1, 'x'); // glow on the threshold
    // the anvil on a stump out front
    c.s(4, 31, [
      'jjjjjjjjjjj.',
      '.jiiiiiiiiiI',
      '...iiiiiiII.',
      '.....iiI....',
      '....jiiiI...',
      '...iiiiiII..',
      '...WwwwwBb..',
      '...wwwwwbb..',
      '..BWwwwwbbB.',
      '..BBBBBBBBB.',
    ]);
    def('tw_forge', TP({ a: '#e8413c', A: '#a82a26', r: '#7a7898', R: '#5a5874', q: '#42405a', Q: '#2e2c42', x: '#7a3a1e', X: '#4a2420' }), c.rows());
  }

  // ================= ENCHANTER'S TOWER (30x58) =================
  {
    const c = grid(30, 58);
    // stone body, cylinder-shaded, coursed blocks
    const bx0 = 5, bx1 = 24;
    c.f((x, y) => {
      const t = (x - bx0) / (bx1 - bx0), row = Math.floor((y - 25) / 3), lx = x + (row % 2) * 2;
      let q = t < 0.18 ? 0 : t < 0.55 ? 1 : t < 0.84 ? 2 : 3;
      if ((y - 25) % 3 === 2 || lx % 5 === 0) q = Math.min(3, q + 1);
      return ['S', 's', 'd', 'D'][q];
    }, bx0, 25, bx1, 54);
    // base flare
    c.f((x) => ramp((x - 3) / 23, ['S', 's', 'd', 'D']), 3, 54, 26, 57);
    c.r(3, 54, 24, 1, 'S').r(4, 54, 1, 1, 'S');
    c.f((x) => (x > 20 ? 'D' : 'd'), 3, 57, 26, 57);
    // purple trim band
    c.f((x) => ramp((x - bx0) / (bx1 - bx0), ['u', 'U', 'm', 'M']), bx0, 42, bx1, 43);
    // conical roof
    for (let y = 8; y <= 24; y++) {
      const hw = 1 + (y - 8) * 13 / 16, a = Math.round(15 - hw), b = Math.round(14 + hw);
      for (let x = a; x <= b; x++) {
        const t = (x - a) / Math.max(1, b - a);
        let q = t < 0.28 ? 0 : t < 0.6 ? 1 : t < 0.86 ? 2 : 3;
        if ((y - 8) % 4 === 3) q = Math.min(3, q + 1);
        c.p(x, y, ['u', 'U', 'm', 'M'][q]);
      }
    }
    c.f((x) => ramp((x - 1) / 27, ['y', 'Y', 'Y', 'O']), 1, 24, 28, 24);
    c.r(2, 25, 26, 1, 'M');
    // little gold stars on the cone
    c.p(10, 17, 'y').p(18, 13, 'y').p(13, 21, 'y').p(20, 20, 'Y');
    // crystal tip on a gold finial
    c.s(12, 0, [
      '...n..',
      '..nvV.',
      '.nvvVV',
      '.vvVVm',
      '..VVm.',
      '...m..',
      '..yY..',
      '..YO..',
    ]);
    // glowing violet arched window with a ledge
    c.s(11, 29, [
      '..DDDD..',
      '.DnnvvD.',
      'DnnvDvVD',
      'DnvvDvVD',
      'DvvvDVVD',
      'DDDDDDDD',
      'DvVVDVcD',
      'DVVcDccD',
      'SSssddDD',
    ]);
    // a small lit slit lower down and the door
    c.s(8, 45, ['DD', 'nv', 'vV', 'DD']);
    c.s(11, 47, [
      '..BBBB..',
      '.BwWwbB.',
      'BwWwwbbB',
      'BwWwwbbB',
      'BwWwwyby',
      'BwWwwbbB',
      'BwWwwbbB',
      'BwWwwbbB',
    ]);
    c.p(17, 51, 'B');
    def('tw_tower', TP({ u: '#b682f0', U: '#8a4ad0', m: '#5e2e9a', M: '#3c1c68', n: '#f4e2ff', v: '#c890ff', V: '#9a5ae8', c: '#6a32b8' }), c.rows());
  }

  // ================= ALCHEMIST'S HUT (46x40) =================
  {
    const c = grid(46, 40);
    // small stone chimney with a puff of green smoke
    blocks(c, 31, 3, 5, 8, 3, 3, ['S', 's', 'd'], 'D');
    c.r(30, 3, 7, 1, 'S');
    c.s(30, 0, ['.lt.', 'ltt.', '.t..']);
    // green scalloped tiles
    for (let y = 5; y <= 17; y++) {
      const k = y - 5, a = 12 - k, b = 33 + k, course = Math.floor(k / 3), v = k % 3;
      for (let x = a; x <= b; x++) {
        const u = (x + course * 2 + 100) % 4, t = (x - a) / Math.max(1, b - a);
        let q = v === 0 ? (u === 0 ? 2 : 0) : v === 1 ? (u === 0 ? 2 : 1) : (u === 0 || u === 3 ? 2 : 1);
        if (t > 0.62) q = Math.min(3, q + 1);
        if (x === b) q = 3;
        c.p(x, y, ['r', 'R', 'q', 'Q'][q]);
      }
    }
    c.r(0, 18, 46, 1, 'B').r(1, 18, 44, 1, 'b');
    // walls
    c.r(3, 19, 40, 17, 'p');
    c.f((x, y) => (x > 36 || y > 32 ? 'P' : ''), 4, 19, 42, 35);
    c.r(3, 19, 2, 17, 'w').r(3, 19, 1, 17, 'W');
    c.r(41, 19, 2, 17, 'b').r(42, 19, 1, 17, 'B');
    c.r(5, 19, 36, 1, 'b');
    // round window (cool green glow)
    c.f((x, y) => {
      const d = dist(x + 0.5, y + 0.5, 11, 25);
      if (d > 4.2) return '';
      if (d > 3.1) return 'b';
      if (Math.abs(x + 0.5 - 11) < 0.6 || Math.abs(y + 0.5 - 25) < 0.6) return 'b';
      return (x + y) < 34 ? 'e' : (x + y) < 37 ? 'E' : 'z';
    }, 6, 20, 16, 30);
    // door, arched, with a brass knob
    c.s(18, 21, [
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
    // shelves of potions beside the door
    c.r(28, 21, 12, 15, 'K').r(28, 21, 12, 1, 'b').r(28, 21, 1, 15, 'b').r(39, 21, 1, 15, 'B');
    c.r(29, 26, 10, 1, 'W').r(29, 27, 10, 1, 'b').r(29, 31, 10, 1, 'W').r(29, 32, 10, 1, 'b');
    const bottle = (x, y, col, tall) => {
      if (tall) c.p(x, y - 4, 'P').p(x, y - 3, 'f');
      else c.p(x, y - 3, 'P');
      c.p(x - 1, y - 2, col).p(x, y - 2, 'h').p(x + 1, y - 2, col);
      c.p(x - 1, y - 1, col).p(x, y - 1, col).p(x + 1, y - 1, col.toUpperCase() === col ? col : col.toUpperCase());
    };
    bottle(30, 26, 'a', true); bottle(34, 26, 'c', false); bottle(37, 26, 'v', true);
    bottle(30, 31, 'e', false); bottle(33, 31, 'y', true); bottle(37, 31, 'a', false);
    c.r(29, 33, 2, 2, 'f').p(29, 33, 'v').r(33, 34, 3, 1, 'c').p(37, 34, 'e').p(37, 33, 'E');
    // stone base
    blocks(c, 1, 36, 44, 4, 5, 2, ['S', 's', 'd'], 'D');
    c.r(1, 36, 44, 1, 'S').r(1, 39, 44, 1, 'D');
    // a little bubbling cauldron on a fire, out front
    c.s(0, 29, [
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
    def('tw_alch', TP({ r: '#8ad86a', R: '#4ea84a', q: '#2e7a3a', Q: '#1c5a2c', t: '#4fd65b', e: '#c8fff0', E: '#7fe0c0', z: '#3aa890',
      a: '#ff4f6a', A: '#b82a40', c: '#4fa8ff', C: '#2a6ac0', v: '#c070ff', V: '#7a3ac0', f: '#a87048' }), c.rows());
  }

  // ================= TAVERN (60x44) =================
  {
    const c = grid(60, 44);
    // chimney first so the roof ridge overlaps its foot
    blocks(c, 44, 1, 6, 9, 3, 3, ['S', 's', 'd'], 'D');
    c.r(43, 0, 8, 2, 's').r(43, 0, 8, 1, 'S').r(45, 1, 4, 1, 'k');
    roof(c, 2, 13, 13, 46, 1, ['r', 'R', 'q', 'Q']);
    c.r(0, 14, 60, 1, 'B').r(1, 14, 58, 1, 'b');
    // upper storey: timber frame + plaster, four lit windows
    c.r(4, 15, 52, 11, 'p');
    c.f((x, y) => (x > 49 || y > 23 ? 'P' : ''), 4, 15, 55, 25);
    for (const px of [4, 18, 30, 42]) c.r(px, 15, 2, 11, 'b').r(px, 15, 1, 11, 'w');
    c.r(54, 15, 2, 11, 'B').r(54, 15, 1, 11, 'b');
    c.r(4, 15, 52, 1, 'w');
    window_(c, 9, 17, 6, 6, 'b', ['h', 'y', 'Y'], true);
    window_(c, 22, 17, 6, 6, 'b', ['h', 'y', 'Y'], true);
    window_(c, 34, 17, 6, 6, 'b', ['h', 'y', 'Y'], true);
    window_(c, 46, 17, 6, 6, 'b', ['y', 'Y', 'o'], true);
    // jetty beam
    c.r(2, 26, 56, 2, 'b').r(2, 26, 56, 1, 'w').r(2, 27, 56, 1, 'B');
    // ground floor: stone
    blocks(c, 5, 28, 50, 12, 6, 3, ['S', 's', 'd'], 'D');
    // lower windows (wider, warm) and the door with a lit pane
    window_(c, 6, 30, 7, 6, 'B', ['h', 'y', 'Y'], true);
    window_(c, 46, 30, 7, 6, 'B', ['y', 'Y', 'o'], true);
    c.s(25, 29, [
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
    // stone base + step
    blocks(c, 2, 40, 56, 4, 7, 2, ['S', 's', 'd'], 'D');
    c.r(2, 40, 56, 1, 'S').r(2, 43, 56, 1, 'D');
    c.r(24, 40, 12, 1, 'y');
    // hanging sign: iron bracket, chains, a board with a frothy mug
    c.r(15, 28, 9, 1, 'I').r(15, 28, 8, 1, 'i').p(23, 29, 'I');
    c.p(16, 29, 'i').p(21, 29, 'i');
    c.s(14, 30, [
      'BBBBBBBBBB',
      'BWwwwwwwbB',
      'BwphhpwwbB',
      'BwjyyjjwbB',
      'BwjyYjbjbB',
      'BwjyYjbjbB',
      'BwjYYjjwbB',
      'BwwjjwwbbB',
      'BBBBBBBBBB',
    ]);
    // barrels by the door
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
    c.s(38, 31, BARREL.slice(0, 4)); // a third one lying behind, on top
    c.s(35, 35, BARREL).s(42, 35, BARREL);
    def('tw_tavern', TP({ r: '#d0604a', R: '#a63e34', q: '#7a2a28', Q: '#541a1e' }), c.rows());
  }

  // ================= QUEST NOTICE BOARD (22x24) =================
  {
    const c = grid(22, 24);
    // posts
    c.r(3, 2, 3, 22, 'w').r(3, 2, 1, 22, 'W').r(5, 2, 1, 22, 'b');
    c.r(16, 2, 3, 22, 'w').r(16, 2, 1, 22, 'W').r(18, 2, 1, 22, 'b');
    // little plank roof
    c.r(0, 0, 22, 1, 'W').r(1, 1, 20, 1, 'w').r(1, 2, 20, 1, 'B');
    // board
    c.r(1, 3, 20, 14, 'b');
    c.f((x, y) => ((y - 4) % 4 === 3 ? 'b' : x > 15 ? 'w' : 'W'), 2, 4, 19, 15);
    c.r(1, 16, 20, 1, 'B');
    // pinned notes
    c.s(3, 5, ['pprpp', 'pPPPp', 'pPPpp', 'pPPPp', 'ppppP']);
    c.s(10, 4, ['ppprpp', 'pPPPPp', 'ppppPp', 'pPPPPp', 'pPPpPp', 'pppppP']);
    c.s(16, 6, ['prpP', 'pPPP', 'pPPP']);
    c.s(5, 11, ['ppryp', 'pPPPp', 'ppPPP']);
    c.s(13, 11, ['pppr', 'pnnp', 'pPPP', 'pppP']);
    c.p(4, 16, 'g').p(17, 16, 'g'); // nothing; keep the frame bottom
    c.r(4, 16, 1, 1, 'B').r(17, 16, 1, 1, 'B');
    // grass at the feet
    c.s(1, 21, ['l..l...', 'gglGg..']).s(14, 21, ['..l..l.', '.gGglgg']);
    def('tw_board', TP({ r: '#e84a4a', n: '#e84a4a' }), c.rows());
  }

  // ================= OBSERVATORY (34x44) =================
  {
    const c = grid(34, 44);
    const cx = 16.5;
    // round stone body
    const bx0 = 4, bx1 = 29;
    c.f((x, y) => {
      const t = (x - bx0) / (bx1 - bx0), row = Math.floor((y - 19) / 3), lx = x + (row % 2) * 2;
      let q = t < 0.18 ? 0 : t < 0.55 ? 1 : t < 0.84 ? 2 : 3;
      if ((y - 19) % 3 === 2 || lx % 5 === 0) q = Math.min(3, q + 1);
      return ['S', 's', 'd', 'D'][q];
    }, bx0, 19, bx1, 39);
    // dome
    c.f((x, y) => {
      const X = x + 0.5, Y = y + 0.5, d = dist(X, Y, cx, 19);
      if (d > 12.8 || Y > 19) return '';
      const lit = ((cx - X) * 0.06 + (19 - Y) * 0.03) + (1 - d / 12.8) * 0.5;
      return lit > 0.62 ? 'c' : lit > 0.3 ? 'C' : lit > 0.02 ? 'n' : 'N';
    }, 3, 5, 30, 18);
    // dome ribs and the open slit
    c.f((x, y, ch) => (ch !== '.' && (x === 9 || x === 24) && y > 8 ? (x < 16 ? 'C' : 'N') : ''), 0, 6, 33, 18);
    c.f((x, y, ch) => (ch !== '.' ? 'k' : ''), 18, 6, 21, 18);
    c.r(18, 6, 4, 1, 'N');
    // gold trim ring between dome and body
    c.f((x) => ramp((x - 2) / 29, ['y', 'Y', 'Y', 'O']), 2, 19, 31, 20);
    c.r(2, 19, 30, 1, 'y').r(2, 20, 30, 1, 'Y').r(27, 20, 5, 1, 'O');
    // star decal on the dome
    c.s(6, 10, ['..y..', '.yyy.', 'yyhyy', '.yYy.', '.y.Y.']);
    // brass telescope out of the slit, pointing to the top right
    {
      const px = 19.5, py = 14, tx = 31.5, ty = 1.5, L = dist(px, py, tx, ty), dx = (tx - px) / L, dy = (ty - py) / L;
      c.f((x, y) => {
        const vx = x + 0.5 - px, vy = y + 0.5 - py, a = vx * dx + vy * dy, b = vx * dy - vy * dx, ab = Math.abs(b);
        if (a < 0 || a > L) return '';
        const wdt = a > L - 3 ? 2.2 : a > L - 9 ? 1.6 : 1.3;
        if (ab > wdt) return '';
        if (a > L - 3.2 && a < L - 2.2) return 'z';
        return b < -0.4 ? 'a' : b < 0.5 ? 'A' : 'z';
      }, 16, 0, 33, 16);
      c.p(32, 1, 'c').p(31, 0, 'c');
    }
    // windows and a door
    c.s(8, 24, ['DD', 'yh', 'yY', 'YY', 'DD']);
    c.s(25, 24, ['DD', 'YY', 'Yo', 'DD']);
    c.s(13, 31, [
      '..DDDD..',
      '.DbwwbD.',
      'DbWwwbbD',
      'DbWwwbbD',
      'DbWwwybD',
      'DbWwwbbD',
      'DbWwwbbD',
      'DbWwwbbD',
      'DbWwwbbD',
    ]);
    // base
    c.f((x) => ramp((x - 2) / 29, ['S', 's', 'd', 'D']), 2, 40, 31, 43);
    c.r(2, 40, 30, 1, 'S');
    c.r(2, 43, 30, 1, 'D');
    c.r(13, 40, 8, 1, 's');
    def('tw_obs', TP({ c: '#8ab4e8', C: '#5a7ec8', n: '#3a5096', N: '#232f66', a: '#ffe08a', A: '#d0a040', z: '#8a6220' }), c.rows());
  }

  // ================= HATCHERY (34x26) =================
  {
    const c = grid(34, 26);
    // back fence: posts + two rails
    const post = (x) => c.r(x, 3, 2, 15, 'w').r(x, 3, 1, 15, 'W').p(x, 3, 'W').p(x + 1, 3, 'w');
    c.r(0, 7, 34, 2, 'w').r(0, 7, 34, 1, 'W');
    c.r(0, 12, 34, 2, 'w').r(0, 12, 34, 1, 'W');
    c.f((x, y, ch) => (ch === 'w' && (x + y) % 7 === 0 ? 'b' : ''), 0, 7, 33, 13);
    [0, 11, 21, 32].forEach(post);
    c.f((x, y, ch) => (ch === 'w' && y === 17 ? 'b' : ''), 0, 3, 33, 17);
    // straw heap
    c.f((x, y) => {
      const X = x + 0.5, Y = y + 0.5, e = ((X - 17) / 16.5) ** 2 + ((Y - 19) / 6.8) ** 2;
      if (e > 1) return '';
      const ei = ((X - 17) / 11) ** 2 + ((Y - 16.6) / 3.4) ** 2;
      if (ei < 1) return ei < 0.5 ? 'z' : 'Z';
      const hatch = (x * 2 + y * 3) % 5 === 0 ? 2 : (x - y * 2 + 40) % 7 === 0 ? 0 : 1;
      let q = hatch;
      if (X > 26 || Y > 23) q = Math.min(2, q + 1);
      if (Y < 14.5 && hatch === 1 && X < 20) q = 0;
      return ['n', 'N', 'Z'][q];
    }, 0, 11, 33, 25);
    // three speckled eggs
    const EGG = (sp, SP) => [
      '..ppp..',
      '.phppp.',
      'phhp' + sp + 'pP',
      'phppppP',
      'p' + sp + 'ppp' + SP + 'P',
      'pppp' + sp + 'PP',
      '.pPPPP.',
    ];
    c.s(5, 9, EGG('t', 'T')).s(13, 7, EGG('u', 'U')).s(21, 9, EGG('t', 'T'));
    c.f((x, y, ch) => (ch === 'p' && y === 15 ? 'P' : ''), 0, 15, 33, 15);
    // straw wisps in front
    c.s(3, 21, ['n.N..N', '.nNnN.']).s(24, 21, ['.N..n.', 'NnNnN.']);
    // a short front fence piece each side
    c.r(0, 18, 2, 7, 'w').r(0, 18, 1, 7, 'W').r(32, 18, 2, 7, 'b').r(32, 18, 1, 7, 'w');
    c.r(0, 21, 6, 1, 'W').r(28, 21, 6, 1, 'w');
    def('tw_nest', TP({ n: '#f0d070', N: '#c8a040', Z: '#8a6a28', z: '#5a4420', t: '#a0602e', T: '#7a4422', u: '#4f8ad0', U: '#2f5a9a' }), c.rows());
  }

  // ================= PORTAL (30x38, 2 frames) =================
  {
    const W = 30, H = 38, cx = 15, cy = 15, Ro = 14.6, Ri = 8.8;
    const inArch = (X, Y, r) => (Y < cy ? dist(X, Y, cx, cy) < r : Math.abs(X - cx) < r);
    const frame = (phase) => {
      const c = grid(W, H);
      c.f((x, y) => {
        const X = x + 0.5, Y = y + 0.5;
        if (Y > 34) return '';
        if (!inArch(X, Y, Ro)) return '';
        if (inArch(X, Y, Ri)) {
          // swirl: spiral bands around the centre
          const vx = X - cx, vy = (Y - 20) * 0.85, r = Math.sqrt(vx * vx + vy * vy);
          const a = Math.atan2(vy, vx) / (Math.PI * 2);
          if (r < 1.8) return 'h';
          let v = (a * 3 + r * 0.22 + phase) % 1; if (v < 0) v += 1;
          const edge = Math.min(1, r / 12);
          const band = v < 0.18 ? 0 : v < 0.45 ? 1 : v < 0.75 ? 2 : 3;
          const q = Math.min(4, band + (edge > 0.7 ? 1 : 0));
          return ['h', 'c', 'C', 'n', 'N'][q];
        }
        // stone: voussoirs on the arch, blocks on the jambs, lit top-left
        const lit = X < cx - 1;
        if (Y < cy) {
          const ang = Math.atan2(Y - cy, X - cx), seg = Math.round(ang / (Math.PI / 7));
          const off = Math.abs(ang - seg * Math.PI / 7) * dist(X, Y, cx, cy);
          if (off < 0.5) return 'D';
          const rr = dist(X, Y, cx, cy);
          if (rr > Ro - 1.2) return lit ? 'S' : 'd';
          return lit ? 's' : rr < Ri + 1.2 ? 'D' : 'd';
        }
        const jx = X < cx ? X - (cx - Ro) : (cx + Ro) - X; // 0 at the outer face
        if ((y - 15) % 4 === 3) return 'D';
        if (jx < 1.1) return lit ? 'S' : 'd';
        if (jx > Ro - Ri - 1.1) return lit ? 's' : 'D';
        return lit ? 's' : 'd';
      });
      // keystone with a glowing rune, runes on the jambs
      c.s(13, 0, ['SSSs', 'SsSd', 'scCd', 'sCcd', 'dddD']);
      c.s(2, 21, ['c.', 'C.', 'cc']).s(26, 21, ['.C', 'CC', '.n']);
      // base step
      c.r(0, 34, 30, 4, 's');
      c.f((x) => ramp(x / 29, ['S', 's', 'd', 'D']), 0, 35, 29, 37);
      c.r(0, 34, 30, 1, 'S').r(0, 37, 30, 1, 'D');
      c.f((x) => (x > 6 && x < 23 ? (x < 15 ? 'c' : 'C') : ''), 0, 34, 29, 34);
      return c.rows();
    };
    const PORTAL_PAL = TP({ h: '#f0fdff', c: '#7fe9ff', C: '#3fa8e8', n: '#2a62d0', N: '#1e2a8a' });
    def('tw_portal', PORTAL_PAL, frame(0));
    def('tw_portal2', PORTAL_PAL, frame(0.5));
  }

  // ================= STREET PROPS =================
  // well: little shingled roof on two posts, a bucket on a rope, round stone rim
  {
    const c = grid(18, 18);
    roof(c, 0, 4, 6, 11, 1.2, ['r', 'R', 'q', 'Q'], 4);
    c.r(2, 5, 2, 7, 'w').r(2, 5, 1, 7, 'W').r(14, 5, 2, 7, 'b').r(15, 5, 1, 7, 'B');
    c.r(4, 6, 10, 1, 'b').r(8, 7, 1, 2, 'P').s(7, 8, ['iWi', 'iwI']);
    c.f((x, y) => {
      const t = (x - 1) / 15;
      if (y === 10) return x > 1 && x < 16 ? 'K' : '';
      if (y === 11 && x > 2 && x < 15) return 'k';
      const q = ramp(t, ['S', 's', 'd', 'D']);
      return (y === 13 || y === 16) || (x + (y > 13 ? 2 : 0)) % 4 === 0 ? (q === 'S' ? 's' : 'D') : q;
    }, 1, 9, 16, 17);
    c.r(1, 9, 16, 1, 'S').r(13, 9, 4, 1, 's');
    c.r(1, 10, 1, 1, 'S').r(16, 10, 1, 1, 'd').r(1, 11, 2, 1, 'S').r(15, 11, 2, 1, 'd');
    def('tw_well', TP({ r: '#d0604a', R: '#a63e34', q: '#7a2a28', Q: '#541a1e' }), c.rows());
  }
  def('tw_lamp', TOWN, [
    '..II..',
    '.IiiI.',
    'IIIIII',
    'Ihyy.I'.replace('.', 'Y'),
    'IyyYYI',
    'IyYYoI',
    'IIIIII',
    '.IiiI.',
    '..iI..',
    '..iI..',
    '..iI..',
    '..iI..',
    '..iI..',
    '..iI..',
    '..iI..',
    '..iI..',
    '..iI..',
    '.IiiI.',
    'IiiiII',
    'IIIIII',
  ]);
  def('tw_barrel', TOWN, [
    '.wWWWwbb.',
    'iijjiiiII',
    'wWWbwwbbB',
    'wWWbwwbbB',
    'wWWbwwbbB',
    'iijiiiiII',
    'wWWbwwbbB',
    'wWWbwwbbB',
    'wWWbwwbbB',
    'iijiiiiII',
    '.wWbwbbB.',
  ]);
  def('tw_crate', TOWN, [
    'WWWWWWWWWb',
    'WbbbbbbbbB',
    'WbWwwwwbbB',
    'WbwWwwbwbB',
    'WbwwWbwwbB',
    'WbwwbWwwbB',
    'WbwbwwWwbB',
    'WbbwwwwWbB',
    'WbbbbbbbbB',
    'bBBBBBBBBB',
  ]);
  // round leafy tree: overlapping leaf clumps, each lit from its own top-left
  {
    const c = grid(20, 26);
    c.r(8, 16, 4, 10, 'w').r(8, 16, 1, 10, 'W').r(11, 16, 1, 10, 'b');
    c.s(5, 23, ['..wW..bb..', '.wwWwwbbb.', 'wwWwwwbbbB']);
    c.p(10, 18, 'b').p(9, 21, 'b');
    // back clumps first, front (lower) ones last
    const clumps = [[10, 5, 5], [5, 8, 4.4], [15, 8, 4.4], [10, 9.5, 5], [4, 13, 3.8], [16, 13, 3.8], [8, 14, 4.2], [13, 14.5, 4]];
    clumps.forEach(([bx, by, br], n) => {
      const dark = by > 12 ? 1 : 0;
      c.f((x, y) => {
        const X = x + 0.5, Y = y + 0.5, d = dist(X, Y, bx, by);
        if (d > br) return '';
        const hl = dist(X, Y, bx - br * 0.38, by - br * 0.4);
        let q = hl < br * 0.26 ? 0 : hl < br * 0.85 ? 1 : d > br - 1.2 && (X > bx || Y > by) ? 3 : 2;
        q = Math.min(3, q + dark);
        if (bx > 12 && q < 3 && hl > br * 0.5) q++;
        return ['l', 'g', 'G', 'm'][q];
      }, 0, 0, 19, 19);
    });
    c.p(14, 7, 'a').p(5, 11, 'a').p(12, 12, 'a'); // a few red apples
    def('tw_tree', TP({ g: '#3fa838', G: '#2a7a28', l: '#78d05a', m: '#1c5a20', a: '#ff4f4f' }), c.rows());
  }
  def('tw_flower', TP({ r: '#ff5a7a', R: '#c83a5a', u: '#b682f0' }), [
    '.r..u..',
    'ryr.uyu',
    '.R.g.u.',
    '.g.g.g.',
    'gGgGgGg',
    '.GgGgG.',
  ]);
  def('tw_banner', TP({ r: '#e8413c', R: '#a82a26', q: '#7a1a1e' }), [
    'yY......',
    'YO......',
    'ibbbbbbb',
    'irrrrrRq',
    'irrrrRRq',
    'irryyRRq',
    'iryhyYRq',
    'irryYRRq',
    'irrYRRRq',
    'irrrrRRq',
    'irrrRRRq',
    'irrrRRRq',
    'irrrRRqq',
    'irr.RR.q',
    'ir...R..',
    'iI......',
    'iI......',
    'iI......',
    'iI......',
    'iI......',
    'iI......',
    'IIi.....',
  ]);

  // ================= TOWNSFOLK (11-12 x 15-16, 2 idle frames each: id and id + '2') =================
  // shared keys: s/S skin, e eyes, plus each figure's own clothes
  const SKIN = { s: '#f2c6a0', S: '#d49b72', e: '#1a1a22' };
  const NP = (o) => Object.assign({}, TOWN, SKIN, o);
  const frames = (id, pal, a, b) => { def(id, pal, a); def(id + '2', pal, b); };

  // blacksmith: bald, big brown beard, bare arms, leather apron; hammer at his side / raised
  {
    const pal = NP({ H: '#6a3e1c', a: '#9a6434', A: '#6a4020', t: '#5a5e70' });
    const top = [
      '....sssS....',
      '...sssssS...',
      '...sesesS...',
      '...sssSsS...',
      '..HHHHHHHH..',
      '.ssHHHHHHSS.',
    ];
    const legs = [
      '...tt..tt...',
      '...tt..tt...',
      '..BBB..BBB..',
    ];
    frames('npc_smith', pal, top.concat([
      'sssaHHHHaASS',
      'ss.aaaaaaASS',
      'ss.aaaaaaASS',
      'Ss.aaWaaaASb',
      '...aaaaaaA.b',
      '...AAAAAAAjiI',
    ].map(r => r.slice(0, 12))).concat([
      '...tt..tt.iI',
      '...tt..tt...',
      '..BBB..BBB..',
    ]), [
      '....sssS.jiI',
      '...sssssSIiI',
      '...sesesS.b.',
      '...sssSsSsS.',
      '..HHHHHHHHSS',
      '.ssHHHHHHSS.',
      'sssaHHHHaA..',
      'ss.aaaaaaA..',
      'ss.aaaaaaA..',
      'Ss.aaWaaaA..',
      '...aaaaaaA..',
      '...AAAAAAA..',
    ].concat(legs));
  }
  // witch: tall crooked hat with a gold band, dark hair, purple robe, a glowing charm (raised in frame 2)
  {
    const pal = NP({ u: '#b682f0', m: '#8a4ad0', M: '#5e2e9a', N: '#3c1c68', H: '#2a1a3a', v: '#c890ff', n: '#f4e2ff' });
    const robe = [
      '..HNNsNNH..',
      '..uummmMN..',
      '.suummmMMs.',
      '..uummmMMv.',
      '.uummmmMMN.',
      '.uummmmMMMN',
      '..KK...KK..',
    ];
    const head = (tip) => tip.concat([
      '...yyyyYY..',
      '.uummmmMMMN',
      '..HsesesH..',
      '..HsssssH..',
    ]);
    const A = head([
      '......m....',
      '.....mM....',
      '....mmM....',
      '....umMM...',
      '...ummMM...',
    ]).concat(robe);
    const B = head([
      '...........',
      '.......mM..',
      '....mmmM...',
      '....umMM...',
      '...ummMM...',
    ]).concat(robe);
    B[10] = '..uummmMNn.';
    B[11] = '.suummmMsvn';
    B[12] = '..uummmMM..';
    frames('npc_witch', pal, A, B);
  }
  // alchemist: ginger hair, brass goggles up on the brow, green robe, a pink flask (held up higher in frame 2)
  {
    const pal = NP({ H: '#d07a3a', h: '#a85a2a', r: '#5ab84e', R: '#3a8a3e', q: '#1c5a2c', A: '#c99a3a', c: '#bff0ff', f: '#ff7ae6', F: '#c040b0', w: '#e8f0ff' });
    const head = [
      '...HHHHH...',
      '..HHHHHHh..',
      '..AcAAcAh..',
      '..HsesesH..',
      '...sssSs...',
    ];
    const legs = ['..qq...qq..', '..BB...BB..'];
    frames('npc_alch', pal, head.concat([
      '..rrrRRRq.w',
      '.rrrrRRRRfF',
      '.rrrrRRRRfF',
      '.srrrRRRRsS',
      '..rrrRRRq..',
      '..rrrRRRq..',
      '..rrrRRRq..',
      '.rrrrRRRqq.',
    ], legs), head.concat([
      '..rrrRRRqfF',
      '.rrrrRRRRsS',
      '.rrrrRRRRq.',
      '.srrrRRRRq.',
      '..rrrRRRq..',
      '..rrrRRRq..',
      '..rrrRRRq..',
      '.rrrrRRRqq.',
    ], legs).map((r, i) => (i === 2 ? '..AcAAcAhcw'.slice(0, 11) : r)));
  }
  // tavern keeper: brown hair, moustache, red shirt, white apron, a frothy mug (raised in frame 2)
  {
    const pal = NP({ H: '#7a4a24', r: '#d0483a', R: '#8a2a26', a: '#f4f0e4', A: '#c8c0b0', t: '#4e4a5a', m: '#f0a090' });
    const head = [
      '...HHHHH...',
      '..HHHHHHH..',
      '..HsesesH..',
      '..smsSsmS..',
      '...sHHHs...',
    ];
    const legs = ['...AAAAA...', '...tt.tt...', '..BBB.BBB..'];
    frames('npc_keeper', pal, head.concat([
      '.rrrsssrR..',
      'rrraaaaaRRh',
      'ss.aaaaaApp',
      'ss.aaaaajyj',
      '...aAaaajYj',
      '...aaaaaSj.',
      '...aaaaaA..',
    ], legs), head.concat([
      '.rrrsssrRhp',
      'rrraaaaaRjy',
      'ss.aaaaaAjY',
      'ss.aaaaaASj',
      '...aAaaaA..',
      '...aaaaaA..',
      '...aaaaaA..',
    ], legs));
  }
  // sage: blue hood and robe, long white beard, a staff with a cyan gem (frame 2: bobs down a pixel)
  {
    const pal = NP({ u: '#6a9aff', U: '#3f63d9', N: '#26388a', H: '#f4f4fa', h: '#c8ccd8', c: '#7fe9ff', C: '#2f8fb8' });
    const head = [
      '...UUUUU.c.',
      '..UuuuuUUCC',
      '..UsesesU.w',
      '..UHsssHU.w',
      '...HHHHH..w',
    ];
    const body = [
      '..uHHHHhUsw',
      '.uuUHHhUUUw',
      '.suUHHhUUNw',
      '..uUUHUUUNw',
      '..uUUuUUUNw',
      '..uUUuUUUNw',
      '.uuUUuUUUNw',
      '.uuUUuUUUNw',
      '.uUUUUUUUNN',
    ];
    const feet = ['..ee...ee.b'];
    const A = head.concat(body, feet);
    const B = ['..........c', '...UUUUU.CC', '..UuuuuUU.w'].concat(head.slice(2), body.slice(0, 2), body.slice(3), feet);
    frames('npc_sage', pal, A, B);
  }

  // ================= HUD ICON: TOWN (10x10) =================
  // a little castle: two towers, a gate and a red flag on the keep
  def('ic_town', TP({ r: '#ff4f4f', R: '#b82a2a' }), [
    '....irrr..',
    '....iRrr..',
    'S.s.i..d.D',
    'SsS.i..ddD',
    'SssSsSsddD',
    'SssssssddD',
    'SKsssssdKD',
    'SssskKsddD',
    'SssKkkKddD',
    'SssKkkKddD',
  ]);
})(globalThis.G = globalThis.G || {});
