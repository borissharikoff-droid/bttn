// BTTN — art for 2.0: invasion mobs, the Moon and the Star Sea, sky pieces.
// Loaded after sprites.js; uses its def() and the hooks it exposes.
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

  // ================= LUNAR INVASION =================
  // moonling: a pale moon-rabbit with a lilac glow at its feet
  def('v_moonling', { w: '#f4f6ff', W: '#c4cce4', b: '#a8d4ff', l: '#c8a8ff', k: '#1a1a22', p: '#ffb0d8' }, [
    '.w....w.',
    '.wl..lw.',
    '.wl..lw.',
    '.wwwwww.',
    'wwkwwkww',
    'wbwppwbw',
    '.wWWWWw.',
    '.l.ll.l.',
  ]);
  // lunar knight: silver plate, crescent crest, lance
  def('v_lunar', { m: '#e4e9f6', M: '#a4aec8', D: '#6c7696', c: '#fff1a8', C: '#d8c060', b: '#8ae8ff', l: '#a888f0', L: '#6a4ab8', w: '#ffffff' }, [
    '....c......c..w.',
    '....cc....cc.www',
    '.....cccccc...D.',
    '....mmmmmmmm..D.',
    '....mMMMMMMm..D.',
    '....mbbbbbbm..D.',
    '....mMMMMMMm..D.',
    '..l..mmmmmm...D.',
    '.llmmmMccMmmm.D.',
    '.lmMmmmccmmmMmmm',
    '.lmM.mmmmmm.M.D.',
    '.lL..mMMMMm...D.',
    '.lL..mmmmmm...D.',
    '.L...mM..Mm...D.',
    '.....mM..Mm.....',
    '....DDD..DDD....',
  ]);
  // the Moon Queen (boss): crown, silver hair and robes, crescent staff
  def('v_moonqueen', { y: '#ffd84a', Y: '#c98f10', b: '#8ae8ff', h: '#f0f2ff', H: '#b0b8e0', s: '#f6e4ec', e: '#1a1a22', p: '#ff9ad0',
    r: '#e8e4ff', R: '#a898e0', l: '#9a70f0', L: '#5a3ab0', c: '#fff3b0', D: '#8a90b0' }, [
    'c...c..y.yy.y...',
    'cc.cc..yybbyy...',
    '.ccc..hhhhhhhh..',
    '..D..hhsssssshh.',
    '..D..hhsesseshh.',
    '..D..hhssppsshh.',
    '..D.hhhHssssHhh.',
    '..D..hlrrrrrrlh.',
    '..srrhhrrllrrhh.',
    '..D..hRrrllrrRh.',
    '..D..hRrrllrrRh.',
    '..D..RrrrllrrrR.',
    '..D.RrrrrllrrrrR',
    '..D.RrrrrllrrrrR',
    '..DRrrrrrllrrrrR',
    '..DLLLLLLLLLLLL.',
  ]);

  // ================= COSMIC INVASION =================
  // grey: big head, big black eyes, silver suit
  def('v_grey', { g: '#b8e8a8', G: '#7ab880', k: '#0c0b12', w: '#ffffff', m: '#b8c0d0' }, [
    '.gggggg.',
    'gggggggg',
    'gkkggkkg',
    'gkkggkkg',
    '.gkggkg.',
    '..gGGg..',
    '.gmmmmg.',
    '..m..m..',
  ]);
  // saucer: glass dome with a pilot, rim lights, a tractor beam
  def('v_saucer', { m: '#d8dee8', M: '#9aa4b8', D: '#5e6680', w: '#ffffff', r: '#ff4f4f', y: '#ffe27a', c: '#8ae8ff', C: '#3aa8d0',
    g: '#8adc6a', k: '#0c0b12', b: '#b8ffb0', B: '#eaffe4' }, [
    '................',
    '......cccc......',
    '.....cwggcC.....',
    '....cwkggkCc....',
    '....ccCggCCc....',
    '..mmmmmmmmmmmm..',
    '.mwwmmmmmmmmMMm.',
    'DMrMMyMMMMyMMrMD',
    '.DDDDDDDDDDDDDD.',
    '...DDDDDDDDDD...',
    '.....DyyyyD.....',
    '......bbbb......',
    '.....bbBBbb.....',
    '....bbbBBbbb....',
    '...bbbbBBbbbb...',
    '..bBbbbBBbbbBb..',
  ]);
  // the Overmind (boss): a brain in a glass jar on a ship, with claws
  def('v_mothership', { c: '#8ae8ff', w: '#ffffff', p: '#ff9ac8', P: '#d860a0', r: '#ff3b3b', y: '#ffe27a', k: '#0c0b12',
    C: '#3aa8d0', m: '#d8dee8', M: '#9aa4b8', D: '#5e6680', t: '#8adc6a', T: '#4a9a3a' }, [
    '....cccccccc....',
    '...cwppPPppwc...',
    '..cwpPppppPpPc..',
    '..cppPpPPpPppc..',
    '.cpPppppPpppPpc.',
    '.cpPPpppppPPppc.',
    '.cpprrppppprrpc.',
    '.cCpppPPPPpppCc.',
    'MmmmmmmmmmmmmmmM',
    'MyMMrMMyyMMrMMyM',
    '.MMMMMMMMMMMMMM.',
    '..DDDDDDDDDDDD..',
    '.t.DtDDDDDDtD.t.',
    't..t.t....t.t..t',
    't..T..t..t..T..t',
    '.T.T..T..T..T.T.',
  ]);

  // ================= HEAVENLY CRUSADE =================
  // putto: golden curls, a floating halo, little wings
  def('v_putto', { y: '#ffe27a', h: '#ffb040', s: '#f8d4b0', e: '#1a1a22', p: '#ff9ab0', w: '#ffffff', W: '#d8dcef' }, [
    '..yyyy..',
    '.hhhhhh.',
    '.sesses.',
    'wwpsspww',
    'wWswwsWw',
    '.W.ww.W.',
    '...ss...',
  ]);
  // archon: gold plate, wide wings, a flaming sword
  def('v_archon', { y: '#ffe27a', g: '#ffd84a', G: '#c98f10', s: '#f2c6a0', e: '#1a1a22', w: '#ffffff', W: '#c8d6e8',
    o: '#ff9a2e', r: '#e0402a', f: '#fff3a0', m: '#f4f4fa' }, [
    '.....yyyyyy...r.',
    'w.............or',
    'ww....gggg...ofo',
    'wWw..gGGGGg.wofo',
    'wWWw.gseesgwWofo',
    '.wWWw.ssss.wWofo',
    '..wWwggggggwWofo',
    '...wgGgyygGgwofo',
    '....gGgggggGgGG.',
    '.....gGggGg..sG.',
    '.....gGggGg.....',
    '......gGGg......',
    '.....gg..gg.....',
    '.....gg..gg.....',
    '....GGG..GGG....',
    '................',
  ]);
  // seraphim (boss): a golden ring around an eye, three pairs of wings
  def('v_seraphim', { y: '#ffd84a', Y: '#c98f10', e: '#fffbe8', b: '#4fa8ff', k: '#0c0b12', w: '#ffffff', W: '#c8d6e8', f: '#ffb347' }, [
    '.w............w.',
    'wWw..........wWw',
    '.wWw...ff...wWw.',
    '..wWw.yyyy.wWw..',
    '...wwyYeeYyww...',
    'wwwwyYeeeeYywwww',
    'WWwwyebbbbeywwWW',
    '.WWyYebkkbeYyWW.',
    '.WWyYebkkbeYyWW.',
    'WWwwyebbbbeywwWW',
    'wwwwyYeeeeYywwww',
    '...wwyYeeYyww...',
    '..wWw.yyyy.wWw..',
    '.wWw........wWw.',
    'wWw..........wWw',
    '.w............w.',
  ]);

  // ================= ABYSSAL TIDE =================
  // squidling: teal mantle, violet tentacles
  def('v_squidling', { t: '#3ad0c0', T: '#1f8a8a', g: '#b0fff0', w: '#ffffff', k: '#1a1a22', v: '#a060e0', V: '#6a38b0' }, [
    '...tt...',
    '..tggt..',
    '.tTttTt.',
    'tTttttTt',
    'twkttwkt',
    '.tvvvvt.',
    '.v.vv.v.',
    'v.v..v.v',
  ]);
  // deep one: fish-headed warrior with a trident
  def('v_deepone', { g: '#4ac8a0', G: '#2a8a78', d: '#1f5a5a', f: '#a070e0', y: '#ffe27a', k: '#1a1a22', b: '#c8f0e0',
    t: '#c8a032', T: '#8a6a20', w: '#ffffff' }, [
    't.t.t....f.f....',
    'ttttt...fgfgf...',
    '..t....ggggggg..',
    '..t...gyygggyyg.',
    '..t...gykgggkyg.',
    '..t...ggggggggg.',
    '..t...gwdwdwdwg.',
    '..t....ggggggg..',
    '..t..ggGbbbbGgg.',
    '.ggggggGbbbbGggg',
    '..t.fggGbbbbGgf.',
    '..t..ggGbbbbGg..',
    '..t...gGGGGGGg..',
    '..t...gg....gg..',
    '..t...gg....gg..',
    '..T..fff...fff..',
  ]);
  // leviathan (boss): a kraken's head, slit eyes, a ring of tentacles
  def('v_leviathan', { g: '#2a9a8a', G: '#1a5a64', v: '#c080ff', V: '#7a48c0', y: '#ffe27a', k: '#0c0b12', w: '#ffffff', c: '#7affe8' }, [
    '.....gggggg.....',
    '...ggcggggcgg...',
    '..gggggggggggg..',
    '.gGggvggggvggGg.',
    'v.gggggggggggg.v',
    'v.gyyyggggyyyg.v',
    'vgGykyGggGykyGgv',
    'vgGGggggggggGGgv',
    '.vgGGwGwwGwGGgv.',
    '.vvgGGkkkkGGgvv.',
    '..vgvgGGGGgvgv..',
    '.vg.vg.gg.gv.gv.',
    'vg..vg.gg.gv..gv',
    'v..vg..gg..gv..v',
    '.vvg..gg..gg.gvv',
    '......v....v....',
  ]);

  // ================= SKY PIECES (24x24 backdrops, no gameplay) =================
  const C24 = 11.5;
  const dist = (x, y, cx, cy) => Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
  // full moon: lit from the top left, with maria and craters
  {
    const craters = [[7, 8, 2.2], [15, 6, 1.6], [14, 15, 2.8], [6, 16, 1.4], [18, 11, 1.2], [10, 19, 1.3]];
    const maria = [[9, 11, 3.6], [15, 10, 2.6], [12, 15, 2.4]];
    def('sky_moon', { w: '#fffdf0', m: '#ece6cc', M: '#d2cbae', D: '#aaa38a', c: '#c2bb9e', k: '#8a846e' }, paint(24, 24, (x, y) => {
      const r = dist(x, y, C24, C24);
      if (r > 11.2) return '';
      const lit = ((C24 - x) * 0.55 + (C24 - y) * 0.55) / 11 + (1 - r / 11.2) * 0.6;
      let ch = lit > 0.95 ? 'w' : lit > 0.25 ? 'm' : lit > -0.25 ? 'M' : 'D';
      for (const [cx, cy, cr] of maria) if (dist(x, y, cx, cy) < cr && ch !== 'D') ch = 'M';
      for (const [cx, cy, cr] of craters) {
        const d = dist(x, y, cx, cy);
        if (d < cr) ch = d > cr - 1.1 && (x - cx) + (y - cy) < 0 ? 'k' : 'c';
        else if (cr >= 2 && d < cr + 0.7 && (x - cx) + (y - cy) > 1) ch = 'w';
      }
      return ch;
    }));
  }
  // ringed planet: banded globe, a tilted ring passing behind and in front
  {
    const cx = 12, cy = 12, pr = 6.6, tilt = -0.35, ct = Math.cos(tilt), st = Math.sin(tilt);
    def('sky_planet', { o: '#f09a50', O: '#c8703a', y: '#ffc07a', D: '#8a4424', r: '#f8f0dc', R: '#c0b494', k: '#7a6a58' }, paint(24, 24, (x, y) => {
      const dx = x - cx + 0.5, dy = y - cy + 0.5;
      const u = dx * ct + dy * st, v = -dx * st + dy * ct; // ring frame
      const e = Math.sqrt((u / 11.6) * (u / 11.6) + (v / 4.2) * (v / 4.2));
      const inRing = e > 0.68 && e < 1 && !(e > 0.83 && e < 0.87);
      const onPlanet = dx * dx + dy * dy < pr * pr;
      if (inRing && (v > 0 || !onPlanet)) return e > 0.9 ? 'R' : e < 0.84 ? 'r' : 'k';
      if (onPlanet) {
        const band = Math.floor((v + 7) / 2.2) % 3;
        const shade = dx * 0.5 + dy * 0.5 > 2.6;
        if (shade) return band === 0 ? 'D' : 'O';
        return band === 0 ? 'O' : band === 1 ? 'o' : 'y';
      }
      return '';
    }));
  }
  // holy sun: a white-gold core, a halo ring, long and short rays
  def('sky_sun', { w: '#ffffff', f: '#fffbe0', y: '#ffe27a', Y: '#ffc629', h: '#fff3b0', o: '#ffb347' }, paint(24, 24, (x, y) => {
    const dx = x - C24, dy = y - C24, r = Math.sqrt(dx * dx + dy * dy);
    const a = Math.atan2(dy, dx), k = Math.round(a / (Math.PI / 8));
    const off = Math.abs(a - k * Math.PI / 8) * r; // distance from the nearest ray axis
    if (r < 2.5) return 'w';
    if (r < 4.5) return 'f';
    if (r < 6.2) return 'y';
    if (r < 7.0) return 'Y';
    if (r > 7.6 && r < 8.6) return 'h';
    const long = k % 2 === 0;
    if (off < 0.8 && r < (long ? 11.8 : 10)) return long ? 'y' : 'o';
    return '';
  }));
  // abyssal eye: a whirlpool of teal and violet around a slit-pupilled eye
  def('sky_eye', { k: '#0c1020', d: '#16304a', t: '#2a8a9a', T: '#6ae8e0', v: '#5a2a9a', i: '#ffb02e', I: '#e0601e', y: '#ffe27a', s: '#0c0b12' }, paint(24, 24, (x, y) => {
    const dx = x - C24, dy = y - C24, r = Math.sqrt(dx * dx + dy * dy);
    if (r > 11.6) return '';
    if (r < 4.6) {
      if (Math.abs(dx) < 0.9 && Math.abs(dy) < 3.6) return 's';
      return r < 2.2 ? 'y' : r < 3.6 ? 'i' : 'I';
    }
    const s = ((Math.atan2(dy, dx) + Math.log(r) * 2.4) / (Math.PI * 2 / 3)) % 1;
    const f = (s + 1) % 1;
    if (r < 5.6) return 'k';
    if (f < 0.18) return r < 8 ? 'T' : 't';
    if (f < 0.4) return 'd';
    if (f < 0.55) return 'v';
    return 'k';
  }));

  // ================= THE MOON =================
  // decor: craters, moonrock with a lilac crystal, a planted flag
  def('d_crater', { w: '#e8e8f0', g: '#b4b4c0', G: '#8a8a98', D: '#6a6a78', K: '#50505e' }, [
    '........',
    '........',
    '.wwwwww.',
    'wKKKKKDw',
    'wKDDggGw',
    '.wggggw.',
    '..GGGG..',
    '........',
  ]);
  def('d_moonrock', { w: '#e4e6f0', m: '#b8bcc8', M: '#8a8e9e', l: '#c8a8ff', L: '#8a68e0' }, [
    '........',
    '......l.',
    '..ww.lL.',
    '.wmmmlL.',
    'wmmmmMM.',
    'mMmmMMMM',
    '.MMMMMM.',
    '........',
  ]);
  // a planted flag with the Button on it
  def('d_flag', { p: '#c8ccd8', w: '#f4f6ff', W: '#c8cce0', r: '#e8413c', g: '#9a9aa8' }, [
    '.pwwwwww',
    '.pwwrrww',
    '.pwwrrWw',
    '.pWwwwWW',
    '.p......',
    '.p......',
    '.p......',
    'gpg.....',
  ]);
  // selenite: a moonstone beetle with crystals on its back
  def('f_selenite', { m: '#dce4f4', M: '#9aa8c8', c: '#c8a8ff', C: '#8a68e0', w: '#ffffff', k: '#1a1a22' }, [
    '...c.c..',
    '.c.wcCc.',
    '.wcwcCC.',
    'mmmmmmmm',
    'mmkmmkmm',
    'mMmmmmMm',
    '.MMMMMM.',
    'm.m..m.m',
  ]);
  // selenite golem: moonstone body, crystal growths, a glowing moon-orb core
  def('b_selenite', { m: '#dce4f4', M: '#9aa8c8', D: '#6a7898', c: '#c8a8ff', C: '#8a68e0', w: '#ffffff', b: '#8ae8ff', k: '#1a1a22', y: '#fff3b0' }, [
    '.......c........',
    '.c....wcC.....c.',
    'wcC..mmmmmm..wcC',
    'wcC.mwmmmmmM.wcC',
    'wcC.mbbmmbbM.wcC',
    'mmmmmmmmmmMMmmMM',
    'mwmmmmMMMMMMmmMM',
    'mwmm.mmmmmmM.mMM',
    'mwmm.mmwymmM.MMM',
    'mmMm.mmyymmM.MMD',
    '.MM..mmmmmMM..D.',
    '.....mmmmMMM....',
    '.....mmm.mMM....',
    '....mmMM.mMMM...',
    '....DDDD.DDDD...',
    '................',
  ]);
  // ground: pale grey regolith (light to dark); lilac-glow archetypes
  SPR.REALM_GROUND.moon = { base: ['#bcbcc6', '#b2b2bc', '#a8a8b4', '#94949f'], detail: '#e4e4ee', decor: ['d_crater', 'd_moonrock', 'd_crater', 'd_flag'] };
  SPR.addArchPal('moon', { a: '#d0d4e0', A: '#7a7e92', c: '#b890ff' });

  // ================= THE STAR SEA =================
  // decor: drifting asteroids and a little satellite
  def('d_asteroid', { b: '#9a8a7a', B: '#6a5a4e', w: '#c8b8a8', K: '#4a3e36' }, [
    '........',
    '..bbbb..',
    '.bwbbKb.',
    'bbbKbbBb',
    'bKbbbBBb',
    'bbbBBKBb',
    '.BBBBBB.',
    '........',
  ]);
  def('d_satellite', { b: '#4a7ae8', B: '#2a4ab0', y: '#ffd84a', m: '#d8dee8', w: '#ffffff', r: '#ff4f4f' }, [
    '....r...',
    '...mm...',
    'bBbyybBb',
    'BbByyBbB',
    'bBbyybBb',
    '...mm...',
    '..w..w..',
    '........',
  ]);
  // a small glowing puff of star gas
  def('d_nebula', { p: '#ff7ae6', w: '#ffe0f8', c: '#8a6aff', s: '#ffffff' }, [
    '......s.',
    '..pp....',
    '.pwwp.c.',
    'pwwwppcc',
    '.pwppcc.',
    '..ppccc.',
    '...cc...',
    '........',
  ]);
  // starling: a living five-pointed star
  def('f_starling', { y: '#ffe27a', Y: '#ffb347', w: '#fffbe0', k: '#1a1a22', p: '#ff8ab8' }, [
    '...yy...',
    '...wy...',
    'yywyyyyy',
    '.ykyyky.',
    '..yppy..',
    '..yYYy..',
    '.yY..Yy.',
    '.Y....Y.',
  ]);
  // voidwalker: an astronaut with a cracked visor and something inside
  def('b_voidwalker', { w: '#eceff6', W: '#a8b0c4', D: '#6e7690', k: '#1a1438', c: '#ffffff', e: '#ff4fd8', s: '#9af0ff', v: '#8a4ae0', V: '#4a2a90', r: '#ff4f4f', o: '#ffb347' }, [
    '..........vv....',
    '....wwwwwwvw....',
    '...wkkkkkkckw...',
    '...wkeeekckkw...',
    '...wkekekckkw...',
    '...wkeeeckckw...',
    '...wkskkckkcw...',
    '....wwwwwwww....',
    '..WwwwwwwwwwwW..',
    '.WwwWwrowwWwwwW.',
    '.Ww.wwwwwwww.wW.',
    '.WW.wWwwwwWw.WW.',
    '....wwwwwwww....',
    '....ww....ww....',
    '....wW....Ww....',
    '...DDD....DDD...',
  ]);
  // ground: deep blue-violet space with a starlight detail; blue and gold archetypes
  SPR.REALM_GROUND.cosmos = { base: ['#1a1e44', '#15183a', '#20244e', '#0e1030'], detail: '#9af0ff', decor: ['d_asteroid', 'd_satellite', 'd_asteroid', 'd_nebula'] };
  SPR.addArchPal('cosmos', { a: '#5a78f0', A: '#26307a', c: '#ffe27a' });

  // ================= LORDS (recoloured minions with a crown) =================
  SPR.bossMap = Object.assign(SPR.bossMap || {}, {
    l_selenite: ['b_selenite', { m: '#8a90c8', M: '#5a5e98', D: '#383a6a', c: '#ffd84a', C: '#c98f10', w: '#c8ccf0', b: '#ff7ae6', y: '#ffe27a' }],
    l_voidwalker: ['b_voidwalker', { w: '#6a5a90', W: '#463a68', D: '#2a2244', k: '#0c0b12', c: '#d8c8ff', e: '#ff3b3b', s: '#ffd84a', v: '#ff4f7e', V: '#9e2440', r: '#ffd84a', o: '#ff7a2e' }],
  });
})(globalThis.G = globalThis.G || {});
