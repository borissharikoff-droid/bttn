// BTTN — original pixel art in a chunky 8x8 top-down style: bright palettes,
// a 1px dark outline added automatically, drawn with nearest-neighbour scaling.
(function (G) {
  'use strict';
  const SPR = G.SPR = { defs: {}, cache: {}, urls: {} };
  const OUTLINE = '#0c0b12';

  function def(id, pal, px) {
    const w = px[0].length;
    for (const row of px) if (row.length !== w) console.warn('sprite row width mismatch', id, row);
    SPR.defs[id] = { pal, px, w, h: px.length };
  }
  SPR.def = def;

  // ---------- Shared palette bits ----------
  const SKIN = { s: '#f2c6a0', S: '#d49b72', e: '#1a1a22' };
  const P = (o) => Object.assign({}, SKIN, o);

  // ================= HEROES (8x8) =================
  def('h_rogue', P({ h: '#5a5a74', H: '#3f3f56', c: '#76768e', C: '#5b5b72', d: '#e6ebf2', b: '#2d2430' }), [
    '..hhhh..',
    '.hHhhHh.',
    '.hseesh.',
    '..ssss.d',
    '.cCCCCdd',
    '.cCccCc.',
    '..cccc..',
    '..b..b..',
  ]);
  def('h_archer', P({ g: '#58a83e', G: '#3d7f2b', t: '#8a5a2e', T: '#6b4420', B: '#a86a32', w: '#f0ead8', b: '#3a2a1a' }), [
    '..gggg.B',
    '.gGggGgw',
    '.gseesgw',
    '..ssss.B',
    '.tTTTTtB',
    'stTttTt.',
    '..tttt..',
    '..b..b..',
  ]);
  def('h_wizard', P({ h: '#4468e0', H: '#ffd84a', r: '#4468e0', R: '#2c47a6', y: '#ffe27a', w: '#8b5a2b' }), [
    '...hh..y',
    '..hhhh.w',
    '.hHHHHhw',
    '..sees.w',
    '..ssss.w',
    '.rrRRrrw',
    '.rRrrRr.',
    '..r..r..',
  ]);
  def('h_priest', P({ y: '#ffe27a', h: '#fff0b8', w: '#f4f4fa', W: '#ffd84a', g: '#c8ccd8' }), [
    '..yyyy..',
    '.hhhhhh.',
    '.hseesh.',
    '.hssssh.',
    '.wwWWww.',
    'swgWWgws',
    '.wgwwgw.',
    '..w..w..',
  ]);
  def('h_warrior', P({ m: '#e8e4d8', r: '#d63b3b', R: '#9e2424', a: '#a8b0c0', A: '#7a8294', b: '#4a3a2a' }), [
    'm.rrrr.m',
    'mrrRRrrm',
    '.rseesr.',
    '..ssss..',
    '.aAAAAa.',
    'saAaaAas',
    '..aAAa..',
    '..b..b..',
  ]);
  def('h_knight', P({ m: '#d2dae4', M: '#8f99a8', k: '#1a1a22', b: '#3f63d9', B: '#ffd84a', a: '#b8c2d0', g: '#6b7484' }), [
    '..mmmm..',
    '.mMMMMm.',
    '.mkkkkm.',
    '.mMMMMm.',
    'bbaMMam.',
    'bBaaaam.',
    'bbamma..',
    '..g..g..',
  ]);
  def('h_paladin', P({ y: '#ffc629', Y: '#c98f10', w: '#f4f4fa', W: '#cfd6e0', r: '#e84a4a' }), [
    '..yyyy..',
    '.yYrrYy.',
    '.yseesy.',
    '..ssss.w',
    'WyYyyYyw',
    'WyYyyYyw',
    'W.yyyy.w',
    '..Y..Y..',
  ]);
  def('h_necro', P({ k: '#2e2438', K: '#1b1622', g: '#c8d8c0', e: '#ff3b3b', p: '#3f2d55', P: '#2a1f3a', W: '#e8e4d8', w: '#6b5a4a' }), [
    '..kkkk.W',
    '.kKKKKkw',
    '.kgeegkw',
    '..gggg.w',
    '.pPPPPpw',
    'gpPppPpw',
    '..pppp..',
    '..p..p..',
  ]);
  def('h_mystic', P({ m: '#9446e0', M: '#6a2fb0', o: '#ff7ae6', O: '#ffd0f4', y: '#ffd84a' }), [
    '..mmmm..',
    '.mMyyMm.',
    '.mseesm.',
    '..ssss.O',
    '.mmMMmoo',
    'smMmmMm.',
    '.mmmmmm.',
    '..m..m..',
  ]);
  def('h_sorcerer', P({ r: '#e03a3a', R: '#a82424', y: '#ffd84a', f: '#ffb347' }), [
    '...rr..f',
    '..rrrr.y',
    '.rRyyRry',
    '.rseesr.',
    '..ssss..',
    '.rrRRrr.',
    'rrRrrRrr',
    '..r..r..',
  ]);
  def('h_ninja', P({ k: '#2a2a33', K: '#17171e', R: '#e03a3a', w: '#e6ebf2' }), [
    '..kkkk..',
    '.kkkkkk.',
    '.kseesk.',
    '.RRRRRRR',
    '.kKkkKk.',
    'wkKkkKk.',
    'w.kkkk..',
    '..k..k..',
  ]);
  def('h_summoner', P({ l: '#6ee06e', h: '#8a5a32', g: '#3aa05e', G: '#277a45', Y: '#ffd84a', o: '#8affc8' }), [
    '.l.ll.l.',
    '..hhhh..',
    '.hseesh.',
    '..ssss.o',
    '.gGYYGgo',
    'sggYYgg.',
    '.gGggGg.',
    '..g..g..',
  ]);

  // ================= PETS (8x8) =================
  def('p_slime', { g: '#6ee06e', G: '#3a9a3a', w: '#e0ffd8', e: '#1a1a22' }, [
    '........',
    '...gg...',
    '..gwgg..',
    '.gwgggg.',
    '.geggegg',
    'gggggggg',
    'gGGGGGGg',
    '.gggggg.',
  ]);
  def('p_bat', { b: '#7a52a0', B: '#4f3470', r: '#ff4040', w: '#ffffff' }, [
    '........',
    'b..bb..b',
    'bb.bb.bb',
    'bbbbbbbb',
    'Bbrbbrbb',
    '.bbwwbb.',
    'B..bb..B',
    '........',
  ]);
  def('p_frog', { g: '#5cc84a', G: '#3a8a2e', w: '#ffffff', k: '#1a1a22', r: '#e0413b' }, [
    '........',
    '.gg..gg.',
    'gwkggwkg',
    'gggggggg',
    'gGrrrrGg',
    '.gggggg.',
    'gg.gg.gg',
    '........',
  ]);
  def('p_beetle', { k: '#1a1a22', c: '#2ab8b0', C: '#1a7a78', w: '#b8fff8', y: '#ffd84a' }, [
    '.k....k.',
    '..k..k..',
    '..cccc..',
    '.cwcCCc.',
    '.cCCkCc.',
    '.cCCkCc.',
    'k.cyyc.k',
    '.k....k.',
  ]);
  def('p_owl', { b: '#a07040', B: '#7a5230', w: '#fff4d8', k: '#1a1a22', y: '#ffc629' }, [
    '.b....b.',
    '.bbbbbb.',
    'bwwbbwwb',
    'bwkbbkwb',
    'bbbyybbb',
    '.bBwwBb.',
    '.bBwwBb.',
    '..y..y..',
  ]);
  def('p_boo', { w: '#f4f6ff', W: '#c8d0e8', k: '#1a1a22', p: '#ff8ab8' }, [
    '..wwww..',
    '.wwwwww.',
    'wwkwwkww',
    'wwkwwkww',
    'wwwppwww',
    'wwwwwwww',
    'wWwWwWwW',
    'w.w..w.w',
  ]);
  def('p_imp', { r: '#e84a2e', R: '#a82a1a', y: '#ffe27a', k: '#1a1a22', f: '#ffb347' }, [
    'k......k',
    '.k.rr.k.',
    '..rrrr..',
    '.ryrryr.',
    '.rrkkrr.',
    'rrRrrRrr',
    '.r.rr.rf',
    '.R....Rf',
  ]);
  def('p_pebble', { g: '#9a9aa8', G: '#6e6e7c', w: '#c8c8d4', k: '#1a1a22', m: '#6ee06e' }, [
    '....m...',
    '..gggm..',
    '.gwggGg.',
    '.gkggkg.',
    'gggggGGg',
    'gGgggggG',
    '.gg..gg.',
    '.GG..GG.',
  ]);
  def('p_phoenix', { y: '#ffe27a', o: '#ff9a2e', O: '#e0601e', r: '#e0303a', k: '#1a1a22' }, [
    '..y..y..',
    '...yy...',
    '..oooo..',
    '.okooko.',
    'oooyyooo',
    'rOooooOr',
    '.r.oo.r.',
    'r..rr..r',
  ]);
  def('p_drake', { p: '#8a5ae0', P: '#5f38a8', y: '#ffe27a', w: '#c8b0ff', g: '#6ee06e' }, [
    '.y....y.',
    '.pp..pp.',
    '..pppp..',
    '.pyppyp.',
    '.pppgpp.',
    'wpPPPPpw',
    'w.pPPp.w',
    '..p..p..',
  ]);
  def('p_starfox', { b: '#4f8aff', B: '#2c5ad0', w: '#e8f0ff', k: '#1a1a22', y: '#ffe27a' }, [
    'b......b',
    'bb....bb',
    'bbbbbbbb',
    'bwkbbkwb',
    '.bbwwbb.',
    '..bkkb.y',
    '.bBBBByy',
    '.b.bb.y.',
  ]);
  def('p_buttonling', { r: '#e8413c', R: '#a82a26', w: '#ffb0a8', k: '#1a1a22', g: '#8a8a9a' }, [
    '........',
    '..rrrr..',
    '.rwwrrr.',
    '.rwrrrr.',
    'rrkrrkrr',
    'gRRRRRRg',
    '.gggggg.',
    '.k....k.',
  ]);

  // ================= ITEMS (8x8) =================
  const T = {
    sword: [
      '......LL',
      '.....LDL',
      '....LDL.',
      '.G.LDL..',
      '..GDL...',
      '..HG....',
      '.H..G...',
      'P.......',
    ],
    dagger: [
      '........',
      '......L.',
      '.....LD.',
      '....LD..',
      '.G.LD...',
      '..GD....',
      '.HG.G...',
      'P.......',
    ],
    katana: [
      '.......L',
      '......LD',
      '.....LD.',
      '....LD..',
      '...LD...',
      '..GG....',
      '.H......',
      'H.......',
    ],
    scythe: [
      '..BBBBB.',
      '.BLLLLLB',
      'BL...HB.',
      'L....H..',
      '....H...',
      '...H....',
      '..H.....',
      '.H......',
    ],
    bow: [
      '...BW...',
      '..B.W...',
      '.B..W...',
      'B...W...',
      'B...W...',
      '.B..W...',
      '..B.W...',
      '...BW...',
    ],
    staff: [
      '.....OO.',
      '....OwOO',
      '.....OO.',
      '....W...',
      '...W....',
      '..W.....',
      '.W......',
      'W.......',
    ],
    wand: [
      '......y.',
      '.....yay',
      '......y.',
      '....W...',
      '...W....',
      '..W.....',
      '.W......',
      '........',
    ],
    armor: [
      '.A....A.',
      'AAA..AAA',
      'AaAAAAaA',
      '.AaAAaA.',
      '.AAtAAA.',
      '.AaAAaA.',
      '.AAAAAA.',
      '..AAAA..',
    ],
    ring: [
      '...gg...',
      '..gwgg..',
      '..GggG..',
      '.G....G.',
      'G......G',
      'G......G',
      '.G....G.',
      '..GGGG..',
    ],
    boot: [
      '...BBB..',
      '...BbB..',
      '...BbB..',
      '...BbB..',
      '..BbbB..',
      'BBbbbB..',
      'BbbbbbB.',
      'SSSSSSS.',
    ],
    potion: [
      '...cc...',
      '...GG...',
      '..G..G..',
      '.GLLLLG.',
      'GLLwLLLG',
      'GLLLLLLG',
      '.GLLLLG.',
      '..GGGG..',
    ],
    shield: [
      'SSSSSSSS',
      'SmmmmmmS',
      'SmmEmmmS',
      'SmEEEmmS',
      'SmmEmmmS',
      '.SmmmmS.',
      '..SmmS..',
      '...SS...',
    ],
    tome: [
      '.CCCCCC.',
      'CccccccW',
      'CcyyyccW',
      'CcyccccW',
      'CcyyyccW',
      'CccccccW',
      'CCCCCCCW',
      '.WWWWWW.',
    ],
    scroll: [
      '.BBBBBB.',
      'BwwwwwwB',
      '.WkkkwW.',
      '.WwwwwW.',
      '.WkkkkW.',
      '.WwwwwW.',
      'BwwwwwwB',
      '.BBBBBB.',
    ],
    orb: [
      '..OOOO..',
      '.OwwOOO.',
      'OwOOOOOO',
      'OOOOOOOo',
      'OOOOOOoo',
      '.OOOOoo.',
      '..SSSS..',
      '.SSSSSS.',
    ],
    skull: [
      '..WWWW..',
      '.WWWWWW.',
      'WWWWWWWW',
      'WkkWWkkW',
      'WkkWWkkW',
      '.WWkkWW.',
      '..WWWW..',
      '..W.W.W.',
    ],
    helm: [
      'H......H',
      'H.MMMM.H',
      '.HMMMMH.',
      '.MMMMMM.',
      'MMkkkkMM',
      'MMkMMkMM',
      '.MM..MM.',
      '.M....M.',
    ],
    cloak: [
      '..CCCC..',
      '.CCccCC.',
      '.CcccccC',
      'CCcccccC',
      'CcccccCC',
      'CcccccCC',
      'CCcccCCC',
      '.C.C.C.C',
    ],
    crown: [
      '........',
      'Y.Y..Y.Y',
      'YYY..YYY',
      'YYYYYYYY',
      'YrYYgYbY',
      'YYYYYYYY',
      '.yyyyyy.',
      '........',
    ],
    amulet: [
      'CC....CC',
      '.C....C.',
      '..C..C..',
      '...CC...',
      '..GggG..',
      '.GgwggG.',
      '.GggggG.',
      '..GGGG..',
    ],
    heart: [
      '.RR..RR.',
      'RwRRRRRR',
      'RwRRRRRR',
      'RRRRRRRr',
      '.RRRRRr.',
      '..RRRr..',
      '...Rr...',
      '........',
    ],
    halo: [
      '........',
      '..wwww..',
      '.wYYYYw.',
      'wY....Yw',
      'wY....Yw',
      '.wYYYYw.',
      '..wwww..',
      '........',
    ],
    wing: [
      '.......W',
      '.....WWW',
      '...WWWWw',
      '.WWWWWww',
      'WWWWWww.',
      '.WWWww..',
      '..Www...',
      '...w....',
    ],
    egg: [
      '...EE...',
      '..EEEE..',
      '.EwEEEE.',
      '.EEEsEE.',
      'EEsEEEEE',
      'EEEEEsEE',
      '.EEEEEE.',
      '..EEEE..',
    ],
    button: [
      '........',
      '..YYYY..',
      '.YwwYYY.',
      '.YwYYYy.',
      '.YYYYyy.',
      'BBYYyyBB',
      'BBBBBBBB',
      '.BBBBBB.',
    ],
  };
  SPR.T = T;
  const items = {
    // common
    rusty_dagger: ['dagger', { L: '#c08a5a', D: '#8a5530', G: '#6b5a4a', H: '#5a3a22', P: '#6b5a4a' }],
    twig_staff: ['wand', { W: '#8b5a2b', y: '#6ee06e', a: '#c8ffb8' }],
    short_bow: ['bow', { B: '#a06a32', W: '#e8e0c8' }],
    leather_vest: ['armor', { A: '#9a6434', a: '#744820', t: '#c89060' }],
    copper_ring: ['ring', { G: '#c87533', g: '#e8a060', w: '#fff0d8' }],
    old_boot: ['boot', { B: '#6b4a2e', b: '#8b6a4a', S: '#3a2a1a' }],
    // uncommon
    steel_sword: ['sword', { L: '#eef2f8', D: '#9aa6b8', G: '#c9a032', H: '#6b4020', P: '#c9a032' }],
    oak_wand: ['wand', { W: '#6b4020', y: '#63d85b', a: '#ffffff' }],
    hunter_bow: ['bow', { B: '#3f8a34', W: '#f0f0e0' }],
    chainmail: ['armor', { A: '#b4bece', a: '#7a8494', t: '#e6ebf2' }],
    emerald_ring: ['ring', { G: '#c9a032', g: '#3fd65b', w: '#d8ffd0' }],
    hp_potion: ['potion', { L: '#e8413c', G: '#d8ecff', w: '#ffb0a8', c: '#8b5a2b' }],
    // rare
    sapphire_blade: ['sword', { L: '#b0dcff', D: '#3f7bff', G: '#e6ebf2', H: '#2a2a3a', P: '#3f7bff' }],
    frost_staff: ['staff', { O: '#9fd8ff', w: '#ffffff', W: '#d8ecff' }],
    crystal_dagger: ['dagger', { L: '#e0f4ff', D: '#7fc4ff', G: '#4fa8ff', H: '#3a3a5a', P: '#7fc4ff' }],
    knight_shield: ['shield', { S: '#a8b2c2', m: '#3f63d9', E: '#ffd84a' }],
    mana_tome: ['tome', { C: '#2c47a6', c: '#4468e0', y: '#b0dcff', W: '#f4f0e0' }],
    sapphire_amulet: ['amulet', { C: '#c9a032', G: '#c9a032', g: '#3f7bff', w: '#d8ecff' }],
    // epic
    shadow_katana: ['katana', { L: '#d4b0ff', D: '#7a38c0', G: '#3a2a4a', H: '#241a30' }],
    necro_skull: ['skull', { W: '#e8e4d8', k: '#8a3fd6' }],
    arcane_orb: ['orb', { O: '#b36bff', o: '#6b2fb8', w: '#f0d8ff', S: '#4a3a5a' }],
    demon_helm: ['helm', { H: '#e8e4d8', M: '#6b2f80', k: '#ff3b3b' }],
    void_cloak: ['cloak', { C: '#3a2255', c: '#7040b0' }],
    amethyst_tiara: ['crown', { Y: '#d0c8e0', y: '#a098b8', r: '#b36bff', g: '#b36bff', b: '#b36bff' }],
    // legendary
    dragon_sword: ['sword', { L: '#ffc06b', D: '#e0561a', G: '#ffd84a', H: '#6b2020', P: '#ff6b2e' }],
    phoenix_bow: ['bow', { B: '#ff7a2e', W: '#ffe08a' }],
    sun_staff: ['staff', { O: '#ffd84a', w: '#fffbe0', W: '#c98f10' }],
    golden_plate: ['armor', { A: '#ffc629', a: '#c98f10', t: '#fff3a0' }],
    titan_ring: ['ring', { G: '#ffa033', g: '#ff4040', w: '#ffd8d0' }],
    ancient_scroll: ['scroll', { B: '#8b5a2b', W: '#f0dca0', w: '#f8ecc0', k: '#a0522d' }],
    // mythic
    blood_scythe: ['scythe', { B: '#2a1016', L: '#ff4f7e', H: '#6b3a3a' }],
    star_codex: ['tome', { C: '#1a1a44', c: '#2e2e6a', y: '#ffe27a', W: '#d8d0ff' }],
    chaos_wand: ['wand', { W: '#3a1a2a', y: '#ff4f7e', a: '#ffd0dc' }],
    moon_orb: ['orb', { O: '#ff4f7e', o: '#9e1f44', w: '#ffd0dc', S: '#2a1a2a' }],
    realm_heart: ['heart', { R: '#ff3b5c', r: '#b01a36', w: '#ffc0cc' }],
    king_crown: ['crown', { Y: '#ffd84a', y: '#c98f10', r: '#ff3b3b', g: '#3fd65b', b: '#3f7bff' }],
    // divine
    eternity_blade: ['sword', { L: '#ffffff', D: '#c0d0ff', G: '#ffd84a', H: '#e0e8ff', P: '#7fe9ff' }],
    celestial_staff: ['staff', { O: '#ffffff', w: '#bfe8ff', W: '#e0e8ff' }],
    halo: ['halo', { Y: '#fff3a0', w: '#ffffff' }],
    seraph_wing: ['wing', { W: '#ffffff', w: '#c8d8ff' }],
    cosmic_egg: ['egg', { E: '#2e2266', s: '#ffe27a', w: '#9a7bff' }],
    golden_button: ['button', { Y: '#ffd84a', y: '#c98f10', w: '#fffbe0', B: '#8a8a9a' }],
  };
  Object.keys(items).forEach(id => def('it_' + id, items[id][1], T[items[id][0]]));

  // ================= POTIONS / EGGS / MISC ICONS (8x8) =================
  G.POTIONS && G.POTIONS.forEach(p => def('pot_' + p.id, { c: '#8b5a2b', G: '#d8ecff', L: p.color, w: '#ffffff' }, T.potion));
  const EGGS = [['#e8dcc0', '#b8a888'], ['#9fd0ff', '#4fa8ff'], ['#ffc06b', '#ff9a2e'], ['#ffffff', '#c8d0ff']];
  EGGS.forEach((c, i) => def('egg_' + i, { E: c[0], s: c[1], w: '#ffffff' }, T.egg));

  def('ic_coin', { y: '#ffd84a', Y: '#c98f10', w: '#fffbe0' }, [
    '..yyyy..',
    '.ywwyyY.',
    'ywyYYyyY',
    'yyYyyyyY',
    'yyYyyyyY',
    'yyyYYyYY',
    '.yyyyYY.',
    '..YYYY..',
  ]);
  def('ic_ess', { p: '#b36bff', P: '#6b2fb8', w: '#f0d8ff' }, [
    '...pp...',
    '..pwpp..',
    '.pwpppP.',
    'pwppppPP',
    'ppppppPP',
    '.ppppPP.',
    '..pPPP..',
    '...PP...',
  ]);
  def('ic_fame', { y: '#ffa033', Y: '#c96a10', w: '#fff0c0' }, [
    '...yy...',
    '...wy...',
    'yyywyyyy',
    '.yyyyyY.',
    '..yyyY..',
    '.yyYYyY.',
    '.yY..YY.',
    '.Y....Y.',
  ]);
  def('ic_egg', { E: '#f4ecd8', s: '#6ee06e', w: '#ffffff' }, T.egg);
  def('ic_skull', { W: '#e8e4d8', k: '#1a1a22' }, T.skull);
  def('ic_finger', { s: '#f2c6a0', S: '#d49b72', w: '#ffffff' }, [
    '...ss...',
    '...ws...',
    '...ss...',
    '.s.ssss.',
    '.ssssssS',
    '.sssssSS',
    '..sssSS.',
    '...SSS..',
  ]);
  def('ic_rune', { g: '#8a8a9a', G: '#5a5a6a', r: '#ff5a5a' }, [
    '.gggggg.',
    'gGGGGGGg',
    'gGrGGrGg',
    'gGGrrGGg',
    'gGGrrGGg',
    'gGrGGrGg',
    'gGGGGGGg',
    '.gggggg.',
  ]);
  def('ic_echo', { b: '#7fe9ff', w: '#ffffff' }, [
    '..b..b..',
    '.b..b..b',
    'b..b..b.',
    'b.w.w.b.',
    'b.w.w.b.',
    'b..b..b.',
    '.b..b..b',
    '..b..b..',
  ]);
  def('ic_eye', { w: '#ffffff', W: '#c8d0e8', b: '#3f7bff', k: '#1a1a22' }, [
    '........',
    '..WWWW..',
    '.WwbbwW.',
    'WwbkkbwW',
    'WwbkkbwW',
    '.WwbbwW.',
    '..WWWW..',
    '........',
  ]);
  def('ic_nose', { y: '#ffd84a', Y: '#c98f10', k: '#1a1a22' }, [
    '....y...',
    '...yYy..',
    '..y.Y.y.',
    '.y..Y..y',
    '....Y...',
    '...kYk..',
    '..kkkkk.',
    '........',
  ]);
  def('ic_hall', { g: '#9a9aa8', G: '#6e6e7c', d: '#5a3a22', y: '#ffd84a' }, [
    '...gg...',
    '..gGGg..',
    '.gGGGGg.',
    'gggggggg',
    '.g.gg.g.',
    '.g.dd.g.',
    '.g.dy.g.',
    'gggggggg',
  ]);
  def('ic_key', { y: '#ffd84a', Y: '#c98f10' }, [
    '.yyy....',
    'y...y...',
    'y...y...',
    '.yyyYy..',
    '.....Yy.',
    '....yY.y',
    '.....y..',
    '........',
  ]);
  def('ic_clover', { g: '#4fd65b', G: '#2d9a38', b: '#6b4020' }, [
    '.gg..gg.',
    'gGgggGgg',
    'ggGggGgg',
    '..gggg..',
    '..gggg..',
    'ggGggGgg',
    'gGgbbgGg',
    '.gg.b.g.',
  ]);
  def('ic_scale', { y: '#ffd84a', Y: '#c98f10', g: '#8a8a9a' }, [
    '...yy...',
    'yyyyyyyy',
    'y..yy..y',
    'y..yy..y',
    'YY.yy.YY',
    '...yy...',
    '..gggg..',
    '.gggggg.',
  ]);
  def('ic_note', { b: '#7fe9ff', B: '#3fa0d0' }, [
    '...bbbbb',
    '...bBBBb',
    '...b...b',
    '...b...b',
    '.bbb.bbb',
    'bBBbbBBb',
    'bBBbbBBb',
    '.bb..bb.',
  ]);
  def('ic_gear', { g: '#b8c0cc', G: '#7a8494', k: '#1a1a22' }, [
    '.g.gg.g.',
    'gggggggg',
    '.gGGGGg.',
    'ggGkkGgg',
    'ggGkkGgg',
    '.gGGGGg.',
    'gggggggg',
    '.g.gg.g.',
  ]);
  def('ic_crown', { Y: '#ffd84a', y: '#c98f10', r: '#ff3b3b', g: '#3fd65b', b: '#3f7bff' }, T.crown);
  def('ic_sword', { L: '#eef2f8', D: '#9aa6b8', G: '#c9a032', H: '#6b4020', P: '#c9a032' }, T.sword);
  def('ic_chest', { L: '#c98f55', D: '#8b5a2b', M: '#9aa0a8', K: '#ffd84a' }, [
    '.LLLLLL.',
    'LLLLLLLL',
    'MMMKKMMM',
    'DDDKKDDD',
    'DDDDDDDD',
    'DDDDDDDD',
    'MDDDDDDM',
    '........',
  ]);
  def('ic_scroll', { B: '#8b5a2b', W: '#f0dca0', w: '#f8ecc0', k: '#a0522d' }, T.scroll);
  def('ic_trophy', { y: '#ffd84a', Y: '#c98f10', w: '#fffbe0', b: '#6b4020' }, [
    'yyyyyyyy',
    'yywyyyYy',
    '.ywyyYy.',
    '..yyYy..',
    '...yY...',
    '...yY...',
    '..bbbb..',
    '.bbbbbb.',
  ]);
  def('ic_tomb', { g: '#9a9aa8', G: '#6e6e7c', k: '#3a3a44', m: '#4f9a3a' }, [
    '..gggg..',
    '.gGGGGg.',
    '.gGkkGg.',
    '.gkkkkg.',
    '.gGkkGg.',
    '.gGkkGg.',
    '.gGGGGg.',
    'mmmmmmmm',
  ]);
  def('ic_star', { w: '#ffffff', b: '#bfe8ff' }, [
    '...w....',
    '...w....',
    '..bwb...',
    'wwwwwww.',
    '..bwb...',
    '...w....',
    '...w....',
    '........',
  ]);
  def('ic_bolt', { y: '#ffe27a', Y: '#ffb347' }, [
    '....yy..',
    '...yY...',
    '..yY....',
    '.yyyyy..',
    '...Yy...',
    '..Yy....',
    '.Yy.....',
    '.y......',
  ]);
  def('ic_clock', { w: '#f4f4fa', W: '#c8ccd8', k: '#1a1a22', r: '#e84a4a' }, [
    '..WWWW..',
    '.WwwwwW.',
    'Wwwkwwww',
    'Wwwkwwww',
    'Wwwkkrww',
    'WwwwwwwW',
    '.WwwwwW.',
    '..WWWW..',
  ]);
  def('ic_bag', { b: '#a07040', B: '#7a5230', y: '#ffd84a' }, [
    '...bb...',
    '..b..b..',
    '..bbbb..',
    '.bBbbbb.',
    'bbBbybbb',
    'bbBbbbbb',
    'bbbBBbbb',
    '.bbbbbb.',
  ]);
  def('ic_arrow', { y: '#ffe27a', Y: '#ffb347', w: '#ffffff' }, [
    '..ywyy..',
    '..ywyy..',
    '..yyyY..',
    'yyyyyyYY',
    '.yyyyYY.',
    '..yyYY..',
    '...YY...',
    '........',
  ]);
  def('ic_heart', { R: '#ff3b5c', r: '#b01a36', w: '#ffc0cc' }, T.heart);

  // ================= WISP / FX =================
  def('wisp', { y: '#fff3a0', Y: '#ffd84a', w: '#ffffff', o: '#ffb347' }, [
    '...yy...',
    '..yYYy..',
    '.yYwwYy.',
    'yYwwwwYy',
    'yYwwwwYy',
    '.yYwwYy.',
    '..yYYy..',
    '...oo...',
  ]);
  def('crown_small', { Y: '#ffd84a', y: '#c98f10', r: '#ff3b3b', b: '#3f7bff' }, [
    'Y..Y..Y',
    'YY.Y.YY',
    'YYYYYYY',
    'YrYbYrY',
    'yyyyyyy',
  ]);
  def('tomb', { g: '#a8a8b6', G: '#74747e', k: '#3a3a44', m: '#4f9a3a', M: '#3d7f2b' }, [
    '...gggg...',
    '..gGGGGg..',
    '.gGGkkGGg.',
    '.gGkkkkGg.',
    '.gGGkkGGg.',
    '.gGGkkGGg.',
    '.gGGGGGGg.',
    '.gGGGGGGg.',
    'mMmmMmmMmm',
  ]);

  // ================= DECOR (8x8 / 8x12) =================
  def('d_palm', { g: '#4fd65b', G: '#2d9a38', t: '#a06a32', T: '#7a4a22', c: '#6b4020' }, [
    '.gg..gg.',
    'gGgggGgg',
    'g..gg..g',
    '...ct...',
    '...tT...',
    '...tT...',
    '...tT...',
    '..ttTT..',
  ]);
  def('d_shell', { p: '#ffb0c8', P: '#e07898', w: '#fff0f4' }, [
    '........',
    '........',
    '..pppp..',
    '.pwpPpp.',
    'ppPpPpPp',
    '.pPpPpP.',
    '...PP...',
    '........',
  ]);
  def('d_flower', { r: '#ff5a7a', y: '#ffe27a', g: '#4fd65b', G: '#2d9a38' }, [
    '........',
    '.r......',
    'ryr..r..',
    '.r..ryr.',
    '.g...r..',
    '.g...g..',
    'GgG.GgG.',
    '........',
  ]);
  def('d_flower2', { r: '#7fb8ff', y: '#ffffff', g: '#4fd65b', G: '#2d9a38' }, [
    '........',
    '....r...',
    '...ryr..',
    '.r..r...',
    'ryr.g...',
    '.g..g...',
    'GgGGgG..',
    '........',
  ]);
  def('d_bush', { g: '#4fb83e', G: '#2d7a28', w: '#8ae07a', r: '#ff4f4f' }, [
    '........',
    '..gggg..',
    '.gwggrg.',
    'gggggggg',
    'gGggrgGg',
    'gGGggGGg',
    '.GGGGGG.',
    '........',
  ]);
  def('d_tree', { g: '#3a9a34', G: '#236b20', w: '#5cc84a', t: '#7a4a22', T: '#5a3418' }, [
    '..gggg..',
    '.gwgggg.',
    'gwgggGgg',
    'ggggGGgg',
    'gGggGGGg',
    'gGGgGGGg',
    '.gGGGGG.',
    '..GGGG..',
    '...tT...',
    '...tT...',
    '..ttTT..',
    '........',
  ]);
  def('d_shroom', { r: '#e84a4a', R: '#a82a2a', w: '#ffffff', s: '#f4ecd8', S: '#c8bca0' }, [
    '........',
    '..rrrr..',
    '.rwrrwr.',
    'rrrrrrrr',
    'RRRRRRRR',
    '...sS...',
    '...sS...',
    '..ssSS..',
  ]);
  def('d_rock', { g: '#9a9aa8', G: '#6e6e7c', w: '#c8c8d4' }, [
    '........',
    '........',
    '..ggg...',
    '.gwggg..',
    'gggggGg.',
    'gGggGGG.',
    '.GGGGG..',
    '........',
  ]);
  def('d_pine', { g: '#2d7a5a', G: '#1d5a40', w: '#f4f8fc', t: '#6b4020' }, [
    '...ww...',
    '...gw...',
    '..wggw..',
    '..gGgg..',
    '.wwggww.',
    '.gGgGgg.',
    'wwgGgGww',
    'gGGGGGGg',
    '...tt...',
    '...tt...',
    '..tttt..',
    '........',
  ]);
  def('d_crystal', { c: '#b36bff', C: '#6b2fb8', w: '#f0d8ff' }, [
    '....c...',
    '...cw.c.',
    '...cwcC.',
    '.c.cwCC.',
    '.wccwCC.',
    '.wcCcCC.',
    '..cCCC..',
    '........',
  ]);
  def('d_bones', { w: '#e8e4d8', W: '#b8b4a8' }, [
    '........',
    '........',
    'w....w..',
    '.wWWw...',
    '..wW....',
    '.wWWw.ww',
    'w....wWw',
    '.....ww.',
  ]);
  def('d_lava', { r: '#ff6a2e', y: '#ffd84a', k: '#2a1a1c', K: '#1a0e10' }, [
    '........',
    '..kkkk..',
    '.kryrrk.',
    'kryyyrrk',
    'krryyrrk',
    '.krrrrk.',
    '..kkkk..',
    '........',
  ]);
  def('d_shard', { p: '#8a5ae0', P: '#4a2f80', w: '#e0d0ff' }, [
    '........',
    '...p....',
    '..pwp...',
    '..pwPp..',
    '.ppwPP..',
    '..pPP...',
    '...P....',
    '........',
  ]);
  def('d_ice', { c: '#bfe8ff', C: '#7fc4ff', w: '#ffffff' }, [
    '........',
    '....c...',
    '...cwc..',
    '..cwcC..',
    '.ccwcCC.',
    '.cCcCCC.',
    '..CCCC..',
    '........',
  ]);

  // ================= MONSTERS (16x16) =================
  def('b_crab', { r: '#ff7a45', R: '#c9481c', w: '#ffffff', k: '#1a1a22', y: '#ffc06b' }, [
    '................',
    '.rr..........rr.',
    'rRRr........rRRr',
    'rR.r........r.Rr',
    '.rrr..w..w..rrr.',
    '...r..k..k..r...',
    '...rrrrrrrrrr...',
    '..rryrrrrrryrr..',
    '.rRrrrrrrrrrrRr.',
    '.rRRrrrrrrrrRRr.',
    '..rRRRRRRRRRRr..',
    '...rRRRRRRRRr...',
    '..r.r.r..r.r.r..',
    '.r..r.r..r.r..r.',
    '.R..R.R..R.R..R.',
    '................',
  ]);
  def('b_goblin', { g: '#7ac84a', G: '#4f8f2e', e: '#ffe27a', k: '#1a1a22', b: '#7a5230', B: '#5a3a22', w: '#e6ebf2', m: '#c9a032' }, [
    '................',
    '..g..........g..',
    '..gg.gggggg.gg..',
    '...gggggggggg...',
    '....geggggeg....',
    '....gkgggkgg....',
    '....ggwggwgg....',
    '.....gggggg.....',
    '...bbbbbbbbbb.w.',
    '..gbBbbmmbbBbgw.',
    '..g.bbbbbbbb.gw.',
    '....bBbbbbBb..m.',
    '....bbbbbbbb....',
    '.....gg..gg.....',
    '.....gg..gg.....',
    '....BBB..BBB....',
  ]);
  def('b_shroom', { r: '#c84ae8', R: '#8a2aa8', w: '#ffffff', s: '#f4ecd8', S: '#c8bca0', k: '#1a1a22', m: '#ff7ab0' }, [
    '................',
    '.....rrrrrr.....',
    '...rrwrrrrwrr...',
    '..rrwwrrrrrrrr..',
    '.rrrrrrrwwrrrrr.',
    '.rrrrrrrwwrrrrr.',
    'rrwrrrrrrrrrrwrr',
    'RRRRRRRRRRRRRRRR',
    '..RRRRRRRRRRRR..',
    '....ssssssss....',
    '....skssssks....',
    '....ssssssss....',
    '....ssmmmmss....',
    '.....ssssss.....',
    '....SS....SS....',
    '...SSS....SSS...',
  ]);
  def('b_golem', { g: '#9a9aa8', G: '#6e6e7c', w: '#c8c8d4', k: '#1a1a22', c: '#7fe9ff', m: '#4f9a3a' }, [
    '.....gggggg.....',
    '....gwwggggg....',
    '....gcggggcg....',
    '....gggggggG....',
    '.gggggGGGGgggggg',
    'gwwgggggggggggGg',
    'gwggggmgggggggGg',
    'ggGg.gggggggg.GG',
    'gGGg.ggGGGGgg.GG',
    '.GG..gggggggg.G.',
    '.....gGGgGGGg...',
    '.....ggg..ggg...',
    '.....ggg..ggg...',
    '....gGGg..gGGg..',
    '....GGGG..GGGG..',
    '................',
  ]);
  def('b_yeti', { w: '#f4f8fc', W: '#bfd0e0', b: '#7fc4ff', k: '#1a1a22', p: '#ff8ab8', B: '#4f8ad0' }, [
    '................',
    '.....wwwwww.....',
    '....wwwwwwww....',
    '...wwbbbbbbww...',
    '...wbkbbbbkbw...',
    '...wbbbppbbbw...',
    '...wwbbbbbbww...',
    '.wwwwwwwwwwwwww.',
    'wwWwwwwwwwwwwWww',
    'wwWwwwwwwwwwwWww',
    'bb.wwwwwwwwww.bb',
    'bb.wWwwwwwwWw.bb',
    '...wwwwwwwwww...',
    '...www....www...',
    '...WWW....WWW...',
    '..BBBB....BBBB..',
  ]);
  def('b_eye', { w: '#ffffff', W: '#d8d0e8', r: '#ff4f7e', k: '#1a1a22', p: '#8a3fd6', P: '#5f2aa8', v: '#ff8aa8' }, [
    '................',
    '.....pppppp.....',
    '...ppWWWWWWpp...',
    '..pWWwwwwwwWWp..',
    '.pWwwvwwwwvwwWp.',
    '.pWwwwrrrrwwwWp.',
    'pWwwwrrkkrrwwwWp',
    'pWwvwrkkkkrwvwWp',
    'pWwwwrkkkkrwwwWp',
    'pWwwwrrkkrrwwwWp',
    '.pWwwwrrrrwwwWp.',
    '.pWwvwwwwwwvwWp.',
    '..pWWwwwwwwWWp..',
    '...ppWWWWWWpp...',
    '.p...pppppp...p.',
    '..p.p..pp..p.p..',
  ]);
  def('b_imp', { r: '#e03a3a', R: '#9e2424', y: '#ffe27a', k: '#1a1a22', h: '#3a2a2a', f: '#ffb347', o: '#ff6a2e' }, [
    '..h..........h..',
    '..hh........hh..',
    '...hh.rrrr.hh...',
    '....rrrrrrrr....',
    '...rryrrrryrr...',
    '...rrkrrrrkrr...',
    '...rrrrkkrrrr...',
    '....rrrrrrrr....',
    '.RR.rrrrrrrr.RR.',
    'RRRRrrRRRRrrRRRR',
    'R.RRrrrrrrrrRR.R',
    '....rrRRRRrr....',
    '....rrr..rrr...o',
    '....rr....rr..of',
    '...RRR....RRR.f.',
    '................',
  ]);
  def('b_wraith', { p: '#6b3fc0', P: '#3a2266', w: '#e0d0ff', c: '#7fe9ff', k: '#0c0b12' }, [
    '......pppp......',
    '.....pPPPPp.....',
    '....pPkkkkPp....',
    '....pkckkckp....',
    '....pkkkkkkp....',
    '...pPkkkkkkPp...',
    '..wpPPkkkkPPpw..',
    '.w.pPPPPPPPPp.w.',
    'w..pPPPPPPPPp..w',
    '...pPPPPPPPPp...',
    '...ppPPPPPPpp...',
    '....pPPPPPPp....',
    '....ppPPPPpp....',
    '.....pPppPp.....',
    '......p..p......',
    '.....p....p.....',
  ]);
  def('l_tree', { g: '#3a9a34', G: '#236b20', w: '#6ee06e', t: '#7a4a22', T: '#5a3418', k: '#1a1a22', y: '#ffe27a' }, [
    '....gggggggg....',
    '..gggwgggggggg..',
    '.ggwgggGGggggGg.',
    'ggggggGGGggGGGgg',
    'gGggGggggGggGGGg',
    '.gGGGgggGGGGGGg.',
    '...GGttttttGG...',
    '.....tykkyt.....',
    '.....tttttt.....',
    't...tTkkkkTt...t',
    '.t..ttTTTTtt..t.',
    '..ttttttttttt...',
    '.....tTttTt.....',
    '.....tt..tt.....',
    '....tTT..TTt....',
    '...ttt....ttt...',
  ]);
  def('l_wyrm', { b: '#7fc4ff', B: '#3f7bd0', w: '#f4f8fc', k: '#1a1a22', c: '#c8ecff', y: '#ffe27a' }, [
    '.w............w.',
    '.ww..........ww.',
    '..bw.bbbbbb.wb..',
    '...bbbbbbbbbb...',
    '..bbybbbbbbybb..',
    '..bbkbbbbbbkbb..',
    '...bbbccccbbb...',
    '....bwbwwbwb....',
    'cc...bbbbbb...cc',
    'ccc.bbBBBBbb.ccc',
    '.cccbbbbbbbbccc.',
    '..cbBbbbbbbBbc..',
    '....bbbBBbbb....',
    '....bb.bb.bb....',
    '.....b.bb.b.....',
    '......BBBB......',
  ]);

  // ================= Rendering =================
  function hexA(h) { return h; }
  function drawDef(ctx, d, ox, oy, recolor) {
    for (let y = 0; y < d.h; y++) {
      const row = d.px[y];
      for (let x = 0; x < d.w; x++) {
        const ch = row[x];
        if (ch === '.') continue;
        let col = d.pal[ch];
        if (!col) continue;
        if (recolor) col = recolor(col);
        ctx.fillStyle = col;
        ctx.fillRect(ox + x, oy + y, 1, 1);
      }
    }
  }
  function outline(ctx, w, h, color) {
    const img = ctx.getImageData(0, 0, w, h);
    const a = img.data;
    const solid = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) solid[i] = a[i * 4 + 3] > 0 ? 1 : 0;
    const [r, g, b] = G.hexToRgb(color);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (solid[i]) continue;
      if ((x > 0 && solid[i - 1]) || (x < w - 1 && solid[i + 1]) || (y > 0 && solid[i - w]) || (y < h - 1 && solid[i + w])) {
        a[i * 4] = r; a[i * 4 + 1] = g; a[i * 4 + 2] = b; a[i * 4 + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  const GOLD_RAMP = ['#5a3200', '#9a5a08', '#d8900e', '#f5b62a', '#ffd84a', '#ffec9a', '#fffbe0'];
  function toGold(col) {
    const [r, g, b] = G.hexToRgb(col);
    const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return GOLD_RAMP[Math.min(GOLD_RAMP.length - 1, Math.floor(l * GOLD_RAMP.length))];
  }
  function toShadow() { return '#141320'; }
  function makeCanvas(w, h) {
    if (typeof OffscreenCanvas !== 'undefined' && !SPR.forceDom) {
      try { return new OffscreenCanvas(w, h); } catch (e) { /* fall through */ }
    }
    const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  }
  SPR.makeCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  // get(id, {gold, dark, noOutline, outlineColor}) -> canvas (w+2)x(h+2) (outline adds 1px border)
  function get(id, o) {
    o = o || {};
    const key = id + (o.gold ? '|g' : '') + (o.dark ? '|d' : '') + (o.noOutline ? '|n' : '') + (o.oc || '');
    let c = SPR.cache[key];
    if (c) return c;
    const d = SPR.defs[id];
    if (!d) return null;
    c = SPR.makeCanvas(d.w + 2, d.h + 2);
    const ctx = c.getContext('2d');
    drawDef(ctx, d, 1, 1, o.gold ? toGold : o.dark ? toShadow : null);
    if (!o.noOutline) outline(ctx, d.w + 2, d.h + 2, o.oc || (o.dark ? '#3a3850' : OUTLINE));
    SPR.cache[key] = c;
    return c;
  }
  SPR.get = get;

  // Scaled data URL for DOM <img>
  function url(id, scale, o) {
    scale = scale || 4;
    const key = id + '@' + scale + JSON.stringify(o || {});
    if (SPR.urls[key]) return SPR.urls[key];
    const src = typeof id === 'string' ? get(id, o) : id;
    if (!src) return '';
    const c = SPR.makeCanvas(src.width * scale, src.height * scale);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, c.width, c.height);
    const u = c.toDataURL();
    if (typeof id === 'string') SPR.urls[key] = u;
    return u;
  }
  SPR.url = url;

  // ---------- Procedural: chest ----------
  const CHEST_PX = [
    '..LLLLLLLL..',
    '.LlwllllllL.',
    'LlMllllllMlL',
    'LLMLLLLLLMLL',
    'MMMMMKKMMMMM',
    'DdMddKKddMdD',
    'DdMddkkddMdD',
    'DdMddddddMdD',
    'DdMddddddMdD',
    'DDMDDDDDDMDD',
    '.MMMMMMMMMM.',
  ];
  const CHEST_PAL = [
    { L: '#b07a45', l: '#d09a5c', w: '#e8b878', D: '#7a4a24', d: '#9a6434', M: '#6e7080', K: '#b8c0cc', k: '#1a1a22' },
    { L: '#3f8a34', l: '#63c24f', w: '#9ae07a', D: '#285a22', d: '#347a2c', M: '#8a8a9a', K: '#ffd84a', k: '#1a1a22' },
    { L: '#2f66e0', l: '#5a90ff', w: '#9ac0ff', D: '#1a3f9a', d: '#2452c0', M: '#d2dae4', K: '#ffffff', k: '#1a1a22' },
    { L: '#7a38c0', l: '#a868f0', w: '#d0a8ff', D: '#4a1f80', d: '#6030a0', M: '#ffc629', K: '#fff3a0', k: '#2a1a3a' },
    { L: '#f08a1e', l: '#ffb85a', w: '#ffe0a0', D: '#a8520a', d: '#d06c14', M: '#ffe27a', K: '#ffffff', k: '#6b2a00' },
    { L: '#c8244e', l: '#ff5f86', w: '#ffa8c0', D: '#7a1030', d: '#a01a3e', M: '#2a2a33', K: '#ff9ab4', k: '#0c0b12' },
    { L: '#e8ecfa', l: '#ffffff', w: '#ffffff', D: '#aab4d0', d: '#ccd4ea', M: '#ffd84a', K: '#7fe9ff', k: '#3f63d9' },
  ];
  CHEST_PAL.forEach((pal, i) => def('chest_' + i, pal, CHEST_PX));
  // Open chest (lid thrown back) for the burst frame
  const CHEST_OPEN_PX = [
    '.LLLLLLLLLL.',
    'LlMllllllMlL',
    'LLMLLLLLLMLL',
    '.kkkkkkkkkk.',
    'MkkkkkkkkkkM',
    'DdMddKKddMdD',
    'DdMddkkddMdD',
    'DdMddddddMdD',
    'DdMddddddMdD',
    'DDMDDDDDDMDD',
    '.MMMMMMMMMM.',
  ];
  CHEST_PAL.forEach((pal, i) => def('chesto_' + i, pal, CHEST_OPEN_PX));
  // Mimic: chest with teeth and eyes
  def('mimic', { L: '#b07a45', l: '#d09a5c', D: '#7a4a24', d: '#9a6434', M: '#6e7080', w: '#ffffff', r: '#c81e3a', y: '#ffe27a', k: '#1a1a22' }, [
    '..LLLLLLLL..',
    '.LlykllkylL.',
    'LlMllllllMlL',
    'LwLwLwLwLwLw',
    'rrrrrrrrrrrr',
    'wDwDwDwDwDwD',
    'DdMddddddMdD',
    'DdMddddddMdD',
    'DdMddddddMdD',
    'DDMDDDDDDMDD',
    '.MMMMMMMMMM.',
  ]);

  // ---------- Procedural: the Button ----------
  // Returns a canvas ~ (2R+6) wide. skin: hex base or 'rainbow' with hue.
  function hsl(h, s, l) { return 'hsl(' + h + ',' + s + '%,' + l + '%)'; }
  function button(skin, pressed, hue, evil) {
    const key = 'btn|' + skin + '|' + (pressed ? 1 : 0) + '|' + (skin === 'rainbow' ? Math.floor(hue / 15) : 0) + '|' + (evil ? 1 : 0);
    if (SPR.cache[key]) return SPR.cache[key];
    const R = 14, W = 2 * R + 11, H = 36;
    const c = SPR.makeCanvas(W, H);
    const ctx = c.getContext('2d');
    let base = skin, light, dark, rim, deep;
    if (skin === 'rainbow') {
      const h = Math.floor(hue / 15) * 15;
      base = hsl(h, 85, 55); light = hsl(h, 95, 76); dark = hsl(h, 80, 38); rim = hsl(h, 75, 26); deep = hsl(h, 70, 18);
    } else {
      light = G.shade(base, 0.42); dark = G.shade(base, -0.3); rim = G.shade(base, -0.5); deep = G.shade(base, -0.68);
    }
    const cx = Math.floor(W / 2);
    const ellip = (oy, rx, ry, col) => {
      ctx.fillStyle = col;
      for (let y = -ry; y <= ry; y++) {
        const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / ((ry + 0.5) * (ry + 0.5)))));
        ctx.fillRect(cx - w, oy + y, w * 2 + 1, 1);
      }
    };
    // stone pedestal
    const baseY = 26;
    for (let y = 0; y < 8; y++) {
      const half = R + 4 - (y >= 6 ? y - 5 : 0);
      for (let x = -half; x <= half; x++) {
        let col = y < 2 ? '#b4b4c2' : y < 6 ? '#8a8a98' : '#6a6a78';
        if (Math.abs(x) === half) col = '#565664';
        else if (y > 1 && y < 6 && ((x + 40) * 3 + y * 5) % 11 === 0) col = '#767684';
        ctx.fillStyle = col; ctx.fillRect(cx + x, baseY + y, 1, 1);
      }
    }
    // metal housing ring
    ellip(baseY, R + 3, 5, '#1c1c24');
    ellip(baseY - 1, R + 2, 5, '#4a4a58');
    ellip(baseY - 2, R + 1, 4, '#2a2a34');
    // dome: stacked ellipses from the bottom (dark) up to the face
    const domeH = pressed ? 5 : 10;
    const faceY = baseY - 2 - domeH;
    for (let i = 0; i <= domeH; i++) {
      const col = i === 0 ? deep : i < 2 ? rim : i < 4 ? dark : base;
      ellip(baseY - 2 - i, R, 5, col);
    }
    // glossy face
    ellip(faceY, R, 5, base);
    ellip(faceY - 1, R - 1, 4, light);
    ellip(faceY - 1, R - 3, 3, base);
    ellip(faceY, R - 5, 2, G.shade ? (skin === 'rainbow' ? base : G.shade(base, 0.12)) : base);
    // specular highlights
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - R + 4, faceY - 3, 4, 1);
    ctx.fillRect(cx - R + 3, faceY - 2, 2, 1);
    ctx.fillRect(cx + R - 6, faceY + 2, 1, 1);
    // side sheen stripe
    ctx.fillStyle = light;
    for (let i = 3; i < domeH; i++) ctx.fillRect(cx - R + 3, baseY - 2 - i + 5, 2, 1);
    if (evil) {
      ctx.fillStyle = '#ffe27a';
      ctx.fillRect(cx - 7, faceY - 1, 4, 2); ctx.fillRect(cx + 4, faceY - 1, 4, 2);
      ctx.fillStyle = '#0c0b12';
      ctx.fillRect(cx - 8, faceY - 2, 5, 1); ctx.fillRect(cx + 4, faceY - 2, 5, 1);
      ctx.fillRect(cx - 5, faceY + 3, 11, 1);
      ctx.fillStyle = '#ffffff';
      for (let x = -4; x <= 4; x += 2) ctx.fillRect(cx + x, faceY + 4, 1, 1);
    }
    outline(ctx, W, H, OUTLINE);
    SPR.cache[key] = c;
    return c;
  }
  SPR.button = button;
  SPR.buttonSize = () => ({ w: 39, h: 36, R: 14 });

  // ---------- Procedural: The All-Seeing Eye (lord) ----------
  function bigEye() {
    if (SPR.cache.bigEye) return SPR.cache.bigEye;
    const S = 28, c = SPR.makeCanvas(S + 2, S + 2), ctx = c.getContext('2d');
    const cx = S / 2 + 0.5, cy = S / 2 + 0.5;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = x - S / 2 + 0.5, dy = y - S / 2 + 0.5, r = Math.sqrt(dx * dx + dy * dy);
      let col = null;
      if (r < 13.5) col = r > 12 ? '#5f2aa8' : r > 10.5 ? '#8a3fd6' : '#f4f0ff';
      if (r < 10.5 && ((x * 7 + y * 3) % 23 === 0)) col = '#ff8aa8';
      if (r < 6.5) col = r > 5 ? '#c81e3a' : '#ff4f7e';
      if (r < 3.5) col = '#0c0b12';
      if (col) { ctx.fillStyle = col; ctx.fillRect(x + 1, y + 1, 1, 1); }
    }
    ctx.fillStyle = '#ffffff'; ctx.fillRect(12, 11, 2, 2);
    outline(ctx, S + 2, S + 2, OUTLINE);
    SPR.cache.bigEye = c;
    return c;
  }
  SPR.bigEye = bigEye;

  // Boss sprite resolver: returns {canvas, scale}
  SPR.boss = function (spriteId, lord) {
    const map = {
      l_crab: ['b_crab', { r: '#ff4f4f', R: '#a82424', y: '#ffd84a' }],
      l_goblin: ['b_goblin', { g: '#c8e04a', G: '#8a9a2e', b: '#a82424', B: '#6b1818' }],
      l_titan: ['b_golem', { g: '#7a8aa8', G: '#4f5a78', c: '#ff7a2e', w: '#b0bcd8' }],
      l_demon: ['b_imp', { r: '#c0265a', R: '#781436', y: '#ffe27a', h: '#f4f0e4', k: '#1a0c14', o: '#b36bff', f: '#e0d0ff' }],
    };
    if (spriteId === 'l_eye') return { canvas: bigEye(), scale: 2 };
    if (spriteId === 'l_button') return { canvas: button('#3a3348', false, 0, true), scale: 2, isButton: true };
    if (map[spriteId]) {
      const [base, pal] = map[spriteId];
      const vid = spriteId + '_v';
      if (!SPR.defs[vid]) def(vid, Object.assign({}, SPR.defs[base].pal, pal), SPR.defs[base].px);
      return { canvas: get(vid), scale: 2, crown: true };
    }
    return { canvas: get(spriteId), scale: lord ? 2 : 1, crown: lord };
  };

  // ---------- Procedural ground tiles per realm ----------
  const REALM_GROUND = {
    shore:     { base: ['#e6d08e', '#dcc47c', '#efdca2', '#d2b86c'], detail: '#c8a85a', decor: ['d_palm', 'd_shell', 'd_rock'], water: ['#2f6fd0', '#4a8ae8', '#7ab4ff'] },
    meadow:    { base: ['#56a83c', '#4c9a34', '#62b448', '#44902e'], detail: '#7ccc5a', decor: ['d_flower', 'd_flower2', 'd_bush', 'd_tree', 'd_rock'] },
    forest:    { base: ['#2f6b2a', '#285e24', '#357832', '#23541f'], detail: '#48903e', decor: ['d_tree', 'd_tree', 'd_shroom', 'd_bush'] },
    highlands: { base: ['#8c8a7a', '#807e6e', '#98968a', '#747264'], detail: '#aaa89a', decor: ['d_rock', 'd_rock', 'd_bones', 'd_bush'] },
    tundra:    { base: ['#e6eef5', '#d8e4ee', '#f2f7fb', '#c8d6e4'], detail: '#b8cce0', decor: ['d_pine', 'd_pine', 'd_ice', 'd_rock'] },
    godlands:  { base: ['#3b3346', '#342d3f', '#453c52', '#2c2636'], detail: '#5a4f6e', decor: ['d_crystal', 'd_bones', 'd_rock', 'd_crystal'] },
    abyss:     { base: ['#2e1a1c', '#261618', '#382022', '#1e1012'], detail: '#ff6a2e', decor: ['d_lava', 'd_bones', 'd_lava', 'd_rock'] },
    void:      { base: ['#15101f', '#110d1a', '#1a1426', '#0d0a14'], detail: '#3a2a5a', decor: ['d_shard', 'd_crystal', 'd_shard'] },
  };
  SPR.REALM_GROUND = REALM_GROUND;
  function ground(realmId, w, h, seed) {
    const cfg = REALM_GROUND[realmId] || REALM_GROUND.meadow;
    const c = SPR.makeCanvas(w, h), ctx = c.getContext('2d');
    const rnd = G.seeded(seed || 1);
    // 8x8 tiles with per-tile tone + per-pixel noise
    for (let ty = 0; ty < Math.ceil(h / 8); ty++) for (let tx = 0; tx < Math.ceil(w / 8); tx++) {
      const tone = cfg.base[Math.floor(rnd() * 3)];
      ctx.fillStyle = tone; ctx.fillRect(tx * 8, ty * 8, 8, 8);
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = rnd() < 0.5 ? cfg.base[3] : cfg.base[2];
        ctx.fillRect(tx * 8 + Math.floor(rnd() * 8), ty * 8 + Math.floor(rnd() * 8), 1, 1);
      }
      if (realmId === 'meadow' || realmId === 'forest') {
        for (let i = 0; i < 2; i++) { // grass blades
          const x = tx * 8 + Math.floor(rnd() * 7), y = ty * 8 + Math.floor(rnd() * 7);
          ctx.fillStyle = cfg.detail; ctx.fillRect(x, y, 1, 2);
        }
      } else if (realmId === 'highlands') {
        if (rnd() < 0.5) { ctx.fillStyle = cfg.base[3]; ctx.fillRect(tx * 8, ty * 8 + 7, 8, 1); ctx.fillRect(tx * 8 + 7, ty * 8, 1, 8); }
      } else if (realmId === 'abyss') {
        if (rnd() < 0.18) { // lava cracks
          let x = tx * 8 + Math.floor(rnd() * 8), y = ty * 8 + Math.floor(rnd() * 8);
          for (let k = 0; k < 5; k++) { ctx.fillStyle = k % 2 ? '#ffb347' : cfg.detail; ctx.fillRect(x, y, 1, 1); x += rnd() < 0.5 ? 1 : 0; y += 1; }
        }
      } else if (realmId === 'void') {
        if (rnd() < 0.5) { ctx.fillStyle = cfg.detail; ctx.fillRect(tx * 8, ty * 8, 8, 1); ctx.fillRect(tx * 8, ty * 8, 1, 8); }
        if (rnd() < 0.15) { ctx.fillStyle = rnd() < 0.5 ? '#ffffff' : '#b0a0ff'; ctx.fillRect(tx * 8 + Math.floor(rnd() * 8), ty * 8 + Math.floor(rnd() * 8), 1, 1); }
      } else if (realmId === 'godlands') {
        if (rnd() < 0.3) { ctx.fillStyle = cfg.detail; ctx.fillRect(tx * 8 + 1, ty * 8 + 1, 6, 1); }
      } else if (realmId === 'tundra') {
        if (rnd() < 0.3) { ctx.fillStyle = cfg.detail; ctx.fillRect(tx * 8 + Math.floor(rnd() * 6), ty * 8 + Math.floor(rnd() * 8), 2, 1); }
      } else if (realmId === 'shore') {
        if (rnd() < 0.3) { ctx.fillStyle = cfg.detail; ctx.fillRect(tx * 8 + Math.floor(rnd() * 8), ty * 8 + Math.floor(rnd() * 8), 1, 1); }
      }
    }
    return c;
  }
  SPR.ground = ground;
})(globalThis.G = globalThis.G || {});
