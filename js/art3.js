// BTTN — art for 2.1: field chests, the Looter, the treasure goblin, meteors, event and perk icons.
// Loaded after sprites.js (and art2.js); uses its def(). SPR.get() adds the 1px dark outline itself,
// so none of these grids carry one.
(function (G) {
  'use strict';
  const SPR = G.SPR;
  if (!SPR) return;
  const def = SPR.def;

  // rows for a w x h piece from a per-pixel painter (x, y) -> palette char or '.'
  function paint(w, h, fn) {
    const rows = [];
    for (let y = 0; y < h; y++) { let r = ''; for (let x = 0; x < w; x++) r += fn(x, y) || '.'; rows.push(r); }
    return rows;
  }
  // compose a w x h grid from [x, y, rows] layers, later layers on top ('.' keeps what is under)
  function stamp(w, h, layers) {
    const g = [];
    for (let y = 0; y < h; y++) g.push(new Array(w).fill('.'));
    for (const [x0, y0, rows] of layers) rows.forEach((r, y) => {
      for (let x = 0; x < r.length; x++) {
        const X = x0 + x, Y = y0 + y;
        if (r[x] !== '.' && X >= 0 && X < w && Y >= 0 && Y < h) g[Y][X] = r[x];
      }
    });
    return g.map(r => r.join(''));
  }
  // wrap the solid pixels in a ring of `ch` (4-neighbour, or 8 with diag)
  function ring(rows, ch, diag) {
    const h = rows.length, w = rows[0].length;
    const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && rows[y][x] !== '.';
    return rows.map((r, y) => r.split('').map((c, x) => {
      if (c !== '.') return c;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dy) || (!diag && dx && dy)) continue;
        if (solid(x + dx, y + dy)) return ch;
      }
      return '.';
    }).join(''));
  }
  const dist = (x, y, cx, cy) => Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));

  // ================= MINI CHESTS (8x7, scattered on the field) =================
  // Same palette keys as the big chest (sprites.js CHEST_PX): L lid, l lid light, w shine,
  // D body, d body light, M metal band, K lock, k keyhole. chestm_0..6 follow CHEST_PAL's tier order.
  const CHESTM_PX = [
    '.LLLLLL.',
    'LlwlllLL',
    'LLLLLLLL',
    'MMMKKMMM',
    'DddKkddD',
    'DddddddD',
    'MDDDDDDM',
  ];
  // copy of sprites.js CHEST_PAL (not exposed on SPR); keep in step if the big chests are recoloured
  const CHEST_PAL = [
    { L: '#b07a45', l: '#d09a5c', w: '#e8b878', D: '#7a4a24', d: '#9a6434', M: '#6e7080', K: '#b8c0cc', k: '#1a1a22' },
    { L: '#3f8a34', l: '#63c24f', w: '#9ae07a', D: '#285a22', d: '#347a2c', M: '#8a8a9a', K: '#ffd84a', k: '#1a1a22' },
    { L: '#2f66e0', l: '#5a90ff', w: '#9ac0ff', D: '#1a3f9a', d: '#2452c0', M: '#d2dae4', K: '#ffffff', k: '#1a1a22' },
    { L: '#7a38c0', l: '#a868f0', w: '#d0a8ff', D: '#4a1f80', d: '#6030a0', M: '#ffc629', K: '#fff3a0', k: '#2a1a3a' },
    { L: '#f08a1e', l: '#ffb85a', w: '#ffe0a0', D: '#a8520a', d: '#d06c14', M: '#ffe27a', K: '#ffffff', k: '#6b2a00' },
    { L: '#c8244e', l: '#ff5f86', w: '#ffa8c0', D: '#7a1030', d: '#a01a3e', M: '#2a2a33', K: '#ff9ab4', k: '#0c0b12' },
    { L: '#e8ecfa', l: '#ffffff', w: '#ffffff', D: '#aab4d0', d: '#ccd4ea', M: '#ffd84a', K: '#7fe9ff', k: '#3f63d9' },
  ];
  CHEST_PAL.forEach((pal, i) => def('chestm_' + i, pal, CHESTM_PX));

  // ================= THE LOOTER (12x12, faces right) =================
  // a round little stone porter with a dark visor and glowing cyan eyes, a big gold key held like a lance
  const LOOTER_PAL = { w: '#e8e8f0', g: '#b4b4c2', G: '#8a8a98', D: '#5e5e6c', c: '#7fe9ff', k: '#1a1a22', y: '#ffd84a', Y: '#c98f10' };
  const LOOTER_TOP = [
    '....ggggg...',
    '...gwwggggG.',
    '..gwgggggggG',
    '..gwgkckkckG',
    '..gggkkkkkkG',
    '..ggggggggGG',
    '...GGGGGGGG.',
    'yyy.DggggD..',
    'y.yYyyyyygYy',
    'yyy.gggggGyY',
  ];
  // run frames: legs apart, legs passing
  def('looter_0', LOOTER_PAL, LOOTER_TOP.concat([
    '...gG...gG..',
    '..DDD...DDD.',
  ]));
  def('looter_1', LOOTER_PAL, LOOTER_TOP.concat([
    '.....gGgG...',
    '....DDDD....',
  ]));
  // arms up, the key held high over its head (for opening a chest)
  def('looter_2', LOOTER_PAL, [
    '.........yyy',
    'YyyyyyyyyY.y',
    'Y.g.....gyyy',
    '..D.gggg.D..',
    '..DgwwgggD..',
    '..DwgggggD..',
    '..gkckkckG..',
    '..gkkkkkkG..',
    '..gggggggG..',
    '...GGGGGG...',
    '...gG..gG...',
    '..DDD..DDD..',
  ]);

  // ================= TREASURE GOBLIN (12x12, faces right) =================
  // a hunched goblin under a bulging golden sack, coins at its mouth and one tumbling out
  const THIEF_PAL = { g: '#7ac84a', G: '#4f8f2e', e: '#ffe27a', k: '#1a1a22', S: '#e0a848', s: '#f8d070', B: '#a8701e',
    y: '#ffe27a', Y: '#d8900e', w: '#ffffff', r: '#8a3a2a', t: '#7a4a22' };
  const THIEF_TOP = [
    '..ywyy......',
    '.ywyYyy.....',
    '.tSyySt.....',
    'SssSSSSS....',
    'SssSSSSSSg..',
    'SsSSSSSSggg.',
    'SSSSSSSBgekg',
    'BSSSSSBBgggg',
    '.BBBBBtgGgr.',
  ];
  def('m_thief', THIEF_PAL, THIEF_TOP.concat([
    '.w...gGGG...',
    'yYy..gG.gG..',
    '.Y..GG...GG.',
  ]));
  def('m_thief_1', THIEF_PAL, THIEF_TOP.concat([
    '.w...gGGG...',
    'yYy...gGG...',
    '.Y...GG.....',
  ]));

  // ================= METEOR (8x8) + IMPACT DECAL (12x7) =================
  // falls toward the bottom left; the fire streams off its top-right trailing edge
  const METEOR_PAL = { K: '#5a4a44', k: '#3a2e2c', R: '#8a6a5a', r: '#e0401e', o: '#ff8a2e', y: '#ffd84a', w: '#fff3b0' };
  def('fx_meteor', METEOR_PAL, [
    '.....o.r',
    '...royor',
    '..oywyo.',
    '.KRyyo.r',
    'KKKRyo..',
    'KkKKo...',
    'KKkK....',
    '.KK.....',
  ]);
  // scorched crater: lighter dirt rim, dark burnt floor, glowing cracks from a hot centre
  def('d_impact', { r: '#9a8466', R: '#6a5642', K: '#2e2426', k: '#1c1618', o: '#ff7a2e', y: '#ffd84a' }, [
    '...rrrrrr...',
    '.rrKKoKKKrr.',
    'rKKoKoKKoKKr',
    'rKKKoyyoKKKR',
    'RKKoKkKoKoKR',
    '.RRKKKKKKRR.',
    '...RRRRRR...',
  ]);

  // ================= EVENT / PERK ICONS (16x16) =================
  // stampede: a charging bull's head, horns out, dust kicked up
  def('ev_stampede', { h: '#f4ecd8', H: '#b8ac90', b: '#8a5a34', B: '#5e3a20', l: '#b07a4a', r: '#ff3b3b', m: '#e0a888', M: '#b8806a', n: '#3a2014', d: '#cfc4ae', D: '#968a74' }, [
    'h..............h',
    'Hh............hH',
    'Hhh..bbbbbb..hhH',
    '.HhhbbllllbbhhH.',
    '..HbbllllllbbH..',
    '..bbBBllllBBbb..',
    '..bbbrBllBrbbb..',
    '...bbbbbbbbbb...',
    '....mmmmmmmm....',
    '...mMnmmmmnMm...',
    '...mmmmmmmmmm...',
    '....MmmmmmmM....',
    '.dd..........dd.',
    'dddd.d....d.dddd',
    'dDddddd..ddddDdd',
    '.DDDDD....DDDDD.',
  ]);

  // gold rush: a heap of coins, two big ones in front, and a sparkle
  {
    const COIN8 = ['..YYYY..', '.YyWWyY.', 'YyWyyyyo', 'YWyYYyyo', 'YyyYyyyo', 'Yyyyyyyo', '.oyyyyo.', '..oooo..'];
    const COIN6 = ['.YYYY.', 'YWWyyo', 'YWyYyo', 'YyyYyo', 'Yyyyyo', '.oooo.'];
    const FLAT = ['.yyyy.', 'yWyyyy', 'YyyyyY', '.YYYY.'];
    const mound = paint(16, 16, (x, y) => (((x + 0.5 - 8) / 7.8) ** 2 + ((y + 0.5 - 16) / 9.5) ** 2 < 1 ? 'o' : ''));
    def('ev_goldrush', { y: '#ffd84a', Y: '#d8900e', o: '#8a5a08', W: '#fffbe0', w: '#ffffff' }, stamp(16, 16, [
      [0, 0, mound],
      [5, 7, FLAT], [1, 9, FLAT], [9, 9, FLAT], [-1, 12, FLAT], [11, 12, FLAT], [4, 12, FLAT],
      [0, 9, COIN6], [7, 8, COIN8],
      [11, 0, ['..w..', '..w..', 'wwwww', '..w..', '..w..']],
      [2, 3, ['.w.', 'www', '.w.']],
    ]));
  }

  // chest rain: two chunky down arrows over a chest
  {
    const ARROW = ['..awA..', '..aaA..', '..aaA..', 'aaaaaAA', '.aaaAA.', '..aAA..', '...A...'];
    def('ev_chestrain', { a: '#ffe27a', A: '#ffb347', w: '#ffffff', L: '#c98f55', l: '#e0aa6a', D: '#8b5a2b', d: '#a86e38', M: '#9aa0a8', K: '#ffd84a', k: '#1a1a22' }, stamp(16, 16, [
      [0, 0, ARROW], [8, 0, ARROW],
      [1, 8, [
        '..LLLLLLLLLL..',
        '.LlwwlllllllL.',
        'LLLLLLLLLLLLLL',
        'MMMMMKKKKMMMMM',
        'DddddKkkKddddD',
        'DddddKKKKddddD',
        'DddddddddddddD',
        'MDDDDDDDDDDDDM',
      ]],
    ]));
  }

  // goblins: a fat gold sack, a green claw reaching down to snatch it by the neck
  def('ev_goblins', { y: '#ffd84a', Y: '#c98f10', o: '#8a5a08', W: '#fffbe0', r: '#8a5a2e', g: '#7ac84a', G: '#3f7a26', c: '#f4ecd8', k: '#1a1a22' }, stamp(16, 16, [
    [0, 3, [
      '....y.yy.....',
      '....yyWyy....',
      '....oyyyo....',
      '.....rrr.....',
      '...yyyyyyy...',
      '..yyyyyyyyy..',
      '.yWyyyyyyyyY.',
      'yWWyyyyyyyyYY',
      'yWyyyyyyyyyYY',
      'yyyyyyyyyyYYY',
      'yyyyyyyyyYYYo',
      '.yyyyyyyYYYo.',
      '..ooooooooo..',
    ]],
    [8, 0, [
      '.....GgG',
      '....GggG',
      '...GgggG',
      '.ggggggG',
      'gGgGgGGk',
      'g.g.g.G.',
      'c.c.c...',
    ]],
  ]));

  // meteors: a burning rock streaking down from the top right
  def('ev_meteors', METEOR_PAL, paint(16, 16, (x, y) => {
    const X = x + 0.5, Y = y + 0.5, cx = 4.6, cy = 11.4;
    const vx = X - cx, vy = Y - cy, r = Math.sqrt(vx * vx + vy * vy);
    const a = (vx - vy) * Math.SQRT1_2, b = Math.abs(vx + vy) * Math.SQRT1_2; // along / across the trail
    if (r < 3.5) {
      if (dist(X, Y, 3.6, 12.6) < 1.1) return 'k';
      if (a > 1.6) return 'R';
      return vx + vy > 2.2 ? 'k' : 'K';
    }
    if (a > 0 && a < 15.5) {
      const wd = 3.3 - a * 0.21 + Math.sin(a * 1.9) * 0.35;
      if (b < wd) {
        const f = b / wd;
        if (f < 0.4) return a < 6 ? 'w' : a < 9.5 ? 'y' : 'o';
        if (f < 0.75) return a < 8 ? 'y' : 'o';
        return a < 10 ? 'o' : 'r';
      }
    }
    return '';
  }));

  // blood moon: a big red moon with dark craters, lit from the top left
  {
    const craters = [[5.2, 5.4, 1.9], [10.6, 5.2, 1.3], [9.6, 11, 2.3], [4.2, 10.6, 1.3], [12.6, 9.4, 0.9]];
    def('ev_bloodmoon', { h: '#ff8a7a', r: '#e8323a', R: '#b01a2e', D: '#78101e', c: '#8e1426', C: '#560818' }, paint(16, 16, (x, y) => {
      const X = x + 0.5, Y = y + 0.5, rr = dist(X, Y, 8, 8);
      if (rr > 7.7) return '';
      const lit = ((8 - X) + (8 - Y)) * 0.075 + (1 - rr / 7.7) * 0.55;
      let ch = lit > 0.78 ? 'h' : lit > 0.18 ? 'r' : lit > -0.2 ? 'R' : 'D';
      for (const [cx, cy, cr] of craters) {
        const d = dist(X, Y, cx, cy);
        if (d < cr) ch = d > cr - 1 && (X - cx) + (Y - cy) < 0 ? 'C' : 'c';
      }
      return ch;
    }));
  }

  // ambush: two crossed swords behind a red "!"
  {
    const sword = (X, Y, px, py, tx, ty) => {
      const L = dist(px, py, tx, ty), dx = (tx - px) / L, dy = (ty - py) / L;
      const vx = X - px, vy = Y - py, a = vx * dx + vy * dy, b = vx * dy - vy * dx, ab = Math.abs(b);
      if (a < 0 || a > L + 0.3) return '';
      if (a < 1.3) return ab < 0.8 ? 'P' : '';
      if (a < 3.4) return ab < 0.4 ? 'H' : '';
      if (a < 4.8) return ab < 1.8 ? (b > 0 ? 'g' : 'G') : '';
      if (ab < Math.min(0.8, (L + 0.3 - a) * 0.9)) return ab < 0.35 ? 'D' : 'L';
      return '';
    };
    const swords = paint(16, 16, (x, y) => {
      const X = x + 0.5, Y = y + 0.5;
      return sword(X, Y, 1.5, 14.5, 14.5, 1.5) || sword(X, Y, 14.5, 14.5, 1.5, 1.5);
    });
    def('ev_ambush', { L: '#eef2f8', D: '#9aa6b8', g: '#ffd84a', G: '#c98f10', H: '#6b4020', P: '#c9a032', r: '#ff4040', R: '#b01a1a', k: '#1a1a22' }, stamp(16, 16, [
      [0, 0, swords],
      [6, 1, ['kkkk', 'krRk', 'krRk', 'krRk', 'krRk', 'krRk', 'kkkk', '.kk.', 'kkkk', 'krRk', 'kkkk']],
    ]));
  }

  // swarm: a cloud of little red-eyed bugs
  {
    const BUG = ['w...w', 'Wbbbw', 'brbrb', '.bBb.'];
    def('ev_swarm', { b: '#6a4aa0', B: '#3a2460', w: '#e0e6ff', W: '#a8b0d8', r: '#ff3b3b' }, stamp(16, 16, [
      [0, 1, BUG], [9, 0, BUG], [5, 5, BUG], [11, 6, BUG], [0, 9, BUG], [6, 11, BUG], [12, 12, BUG],
    ]));
  }

  // frenzy: a yellow lightning bolt in a red glow
  {
    const bolt = [
      '................',
      '..........yyy...',
      '.........yyY....',
      '........yyY.....',
      '.......yyY......',
      '......ywyyyyy...',
      '.....yyyyyyY....',
      '.........yY.....',
      '........yY......',
      '.......yY.......',
      '......yY........',
      '.....yY.........',
      '....yY..........',
      '................',
      '................',
      '................',
    ];
    def('ev_frenzy', { y: '#ffe27a', Y: '#ffb347', w: '#ffffff', o: '#ff7a2e', r: '#e0303a' }, ring(ring(bolt, 'o', false), 'r', true));
  }

  // jackpot: a golden Button (gold dome on a dark-gold base) with star sparkles
  def('ic_jackpot', { w: '#ffffff', W: '#fff3b0', y: '#ffd84a', Y: '#f5b62a', o: '#c98f10', O: '#6a4404', b: '#a8700c', B: '#d8900e' }, stamp(16, 16, [
    [0, 0, paint(16, 16, (x, y) => {
      const X = x + 0.5, Y = y + 0.5, cx = 8;
      const inE = (ey, rx, ry) => ((X - cx) / rx) ** 2 + ((Y - ey) / ry) ** 2 < 1;
      if (inE(6, 5.6, 2.4)) return inE(5.4, 3.6, 1.4) && X < cx ? 'W' : 'y'; // glossy top face
      if ((Y > 6 && Y < 10 && Math.abs(X - cx) < 5.6) || inE(10, 5.6, 2.2)) return X < cx - 3.6 ? 'W' : X < cx + 1.5 ? 'Y' : 'o'; // dome side
      if (inE(11, 6.8, 2.2)) return 'O'; // housing ring
      if (Y > 11 && Y < 15.5 && Math.abs(X - cx) < 7.6 - Math.max(0, Y - 14)) return Y < 13 ? 'B' : Math.abs(X - cx) > 6.8 || Y > 14.5 ? 'O' : 'b'; // base
      return '';
    })],
    [0, 0, ['.w.', 'www', '.w.']],
    [12, 0, ['..w..', '..w..', 'wwwww', '..w..', '..w..']],
  ]));

  // vault: a round steel door with bolts on the rim and a gold wheel
  def('ic_vault', { s: '#c8d0dc', S: '#7a8494', m: '#aab4c4', M: '#8a94a6', D: '#4a5262', w: '#ffffff', y: '#ffd84a', Y: '#c98f10' }, paint(16, 16, (x, y) => {
    const X = x + 0.5, Y = y + 0.5, r = dist(X, Y, 8, 8), ang = Math.atan2(Y - 8, X - 8);
    if (r > 7.7) return '';
    if (r > 6.3) {
      const k = Math.round(ang / (Math.PI / 4)), off = Math.abs(ang - k * Math.PI / 4) * r;
      if (off < 0.55 && r < 7.2) return 'w';
      return X + Y < 15 ? 's' : 'S';
    }
    if (r > 5.5) return 'D';
    const spoke = Math.abs(X - 8) < 0.6 || Math.abs(Y - 8) < 0.6;
    if (r < 1.3) return 'w';
    if (r < 3.2 && spoke) return 'Y';
    if (r >= 3.2 && r < 4.3) return X + Y < 16 ? 'y' : 'Y';
    if (r >= 4.3 && r < 5.3 && spoke) return 'y';
    return X + Y < 14 ? 'm' : 'M';
  }));

  // crew: two little Looter heads side by side
  {
    const HEAD = [
      '..gggg..',
      '.gwwgggG',
      'gwwggggG',
      'gwggggGG',
      'gkckkckG',
      'gkkkkkkG',
      'ggggggGG',
      '.GGGGGG.',
      'DggggggD',
      'gggggGGG',
    ];
    def('ic_crew', LOOTER_PAL, stamp(16, 16, [[0, 1, HEAD], [8, 6, HEAD]]));
  }

  // plunder: a sleeved hand pinching a gold coin up out of an open chest
  def('pk_plunder', { s: '#f2c6a0', S: '#c8906a', v: '#4f7ac8', V: '#2a4a8a', y: '#ffd84a', Y: '#c98f10', W: '#fffbe0',
    L: '#c98f55', l: '#e0aa6a', D: '#8b5a2b', d: '#a86e38', M: '#9aa0a8', k: '#2a1a14', K: '#ffd84a' }, stamp(16, 16, [
    [1, 8, [
      '.DDDDDDDDDDDD.',
      'LLLLLLLLLLLLLL',
      'kkkkkkkkkkkkkk',
      'MkykkyykkykyyM',
      'LlllllKKllllLL',
      'DdddddKKddddDD',
      'DddddddddddddD',
      'MDDDDDDDDDDDDM',
    ]],
    [5, 4, ['.yyyy.', 'yWWyyY', 'yWyyyY', 'yyyyyY', 'yyyyYY', '.YYYY.']],
    [4, 0, [
      '........vVV',
      '......ssvVV',
      '...sSsSssV.',
      '..sSsSsssS.',
      '.ss.......S',
      '.s.......sS',
      '.........s.',
    ]],
  ]));
})(globalThis.G = globalThis.G || {});
