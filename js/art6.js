// BTTN 3.4 — art6: a bigger Horde. Every land gets three more kinds of small fry and two more brutes in
// its own theme, so a pack is a crowd of different creatures, not one sprite copied a hundred times.
// Also the silhouettes of the 3.4 behaviours (js/mobs2.js): leapers, gnat swarms, shield walls,
// splitting blobs and burrowers, in each land's colours like the archetypes in sprites.js.
//
// Loaded after art5.js (needs G.SPR). Same rules as sprites.js: 8px-wide small fry, 16x16 brutes,
// no outline in the grids (SPR.get adds the dark one), light from the top-left.
//
// Exposes:
//   G.MOB_SKINS[landIndex] = { fodder: [ids], brute: [ids] }  (the land's original sprite first)
//   G.mobSkin(m, realm)  -> the sprite id a mob wears (stable per mob: picked by m.id)
//   G.mobFrame(id, t, m) -> id or its second walk frame (id + '_2') when one exists
// Every new sprite has a second frame '<id>_2' (legs, wings or tentacles moved).
(function (G) {
  'use strict';
  const SPR = G.SPR;
  if (!SPR) return;
  const K = '#1a1a22';

  // def with a second frame: alt replaces the bottom rows (or, as a full grid, the whole sprite);
  // without one the legs (the last row) step: each half of the row moves outwards by a pixel
  function stepRow(r) {
    const w = r.length, h = w >> 1, a = r.slice(0, h), b = r.slice(h);
    const L = (a.slice(1) + '.'), Rr = ('.' + b.slice(0, -1));
    const out = L + Rr;
    return out === r ? '.' + r.slice(0, -1) : out;
  }
  function D(id, pal, px, alt) {
    if (SPR.defs[id]) { console.warn('art6: sprite id taken', id); return; }
    pal = Object.assign({ k: K }, pal);
    SPR.def(id, pal, px);
    let px2;
    if (alt && alt.length === px.length) px2 = alt;
    else if (alt) px2 = px.slice(0, px.length - alt.length).concat(alt);
    else px2 = px.slice(0, -1).concat([stepRow(px[px.length - 1])]);
    SPR.def(id + '_2', pal, px2);
  }

  // ======================================================================
  // 0 SHORELINE
  // ======================================================================
  // a pink jellyfish, its frills swaying
  D('f_jelly', { p: '#ff8ad8', P: '#c04aa8', w: '#ffe0f6' }, [
    '..pppp..',
    '.pwwppp.',
    'pwpppppP',
    'pkppkppP',
    'PPPPPPPP',
    '.p.P.p.P',
    'p.P.p.P.',
    '.p...P..',
  ], [
    'P.p.P.p.',
    '.P.p.P.p',
    '..P...p.',
  ]);
  // a hermit crab in a borrowed pink shell
  D('f_hermit', { r: '#ff7a45', R: '#c9481c', s: '#f0a0b8', S: '#b8607a', w: '#ffe4ec' }, [
    '....sss.',
    'k..sSwSs',
    'r.sSwssS',
    'rrsswSSs',
    'rrrsSSs.',
    'Rrrrrrr.',
    '.r.r.r..',
  ]);
  // a gull, flapping
  D('f_gull', { w: '#ffffff', g: '#a8b4c4', G: '#6e7a8e', y: '#ffb347' }, [
    'G......G',
    'gG....Gg',
    '.ggwwgg.',
    '..wkkw..',
    '...yy...',
    '..wwww..',
    '...ww...',
  ], [
    '........',
    '........',
    '.ggwwgg.',
    'gGwkkwGg',
    'G..yy..G',
    '..wwww..',
    '...ww...',
  ]);
  // an octopus come up the beach
  D('b_octo', { o: '#e8586e', O: '#a83048', w: '#ffd0d8', W: '#ffffff' }, [
    '................',
    '......oooo......',
    '....oowwoooo....',
    '...oowwoooooO...',
    '..oowoooooooOO..',
    '..oooooooooooO..',
    '..ooWkooooWkoO..',
    '..ooWWooooWWoO..',
    '..oooooOOoooOO..',
    '...oooooooooO...',
    '..oOooOooOooOo..',
    '.oO.oO.oO.oO.oO.',
    'oO.oO..oO..Oo.Oo',
    'o..o...o....o..o',
    'oo.oo..oo..oo.oo',
    '................',
  ], [
    '.Oo.oO.oO.oO.Oo.',
    '.o..o..o...o..o.',
    'oo..oo.oo.oo..oo',
    '.o...o..o.o...o.',
    '................',
  ]);
  // a snapping sea turtle
  D('b_turtle', { g: '#6ab85a', G: '#3a7a34', s: '#8a6a3a', S: '#5a4022', y: '#d8b860', w: '#f4ecd8' }, [
    '................',
    '................',
    '................',
    '................',
    '......SSSSSS....',
    '....SSsyysyySS..',
    '...SsyyysyyysS..',
    '..SsyyysSsyyysS.',
    '.gSSssSSSSssSSS.',
    'gkgSyyySyyySyyS.',
    'ggwgSSSSSSSSSSS.',
    '.ggg.ggggggggg.g',
    '....gg.gg..gg.gg',
    '....gg.gg..gg.gg',
    '....GG.GG..GG.GG',
    '................',
  ], [
    '...gg..gg.gg..gg',
    '...gg..gg.gg..gg',
    '...GG..GG.GG..GG',
    '................',
  ]);

  // ======================================================================
  // 1 MEADOWS
  // ======================================================================
  // a striped boar piglet
  D('f_piglet', { b: '#a8703a', B: '#6e4420', y: '#d8a868', p: '#ffaaa8' }, [
    'B......B',
    'bb.yy.bb',
    '.bbbbbb.',
    'bkbyybkb',
    'bbppppbb',
    '.bpkkpb.',
    '.bybbyb.',
    '.B.BB.B.',
  ]);
  // a green shell beetle
  D('f_beetle', { g: '#3ac87a', G: '#1f7a50', w: '#c8ffe8', l: '#5a7a4a', h: '#2a4a3a' }, [
    'l......l',
    '.l.hh.l.',
    '..hhhh..',
    '.gwgGgg.',
    'lgwgGggl',
    '.gggGgg.',
    'l.gGGg.l',
  ], [
    '.lgGGgl.',
  ]);
  // a kobold with a spear
  D('f_kobold', { r: '#d86a3a', R: '#9a4020', y: '#ffd84a', w: '#e6ebf2', t: '#8a5a2e' }, [
    '.r...r.w',
    '.rrrrr.t',
    '.rkrrk.t',
    '.rrRRr.t',
    '..yyyy.t',
    '.rRrrRrt',
    '..rrrr.t',
    '..R..R..',
  ]);
  // a big tusked boar
  D('b_boar', { b: '#8a5a32', B: '#5a3a1e', h: '#3a2a1a', w: '#f4ecd8', p: '#d88a7a', r: '#ff4f4f' }, [
    '................',
    '................',
    '.......h.h.h....',
    '.....hhhhhhhh...',
    '...bbbhhhhhhhh..',
    '..bbbbbbbbbbbbh.',
    '.brbbbbbbbbbbbbh',
    'pbbbbbbbbbbbbbbB',
    'ppwbbbbbbbbbbbbB',
    'pkwbbbbbbbbbbbB.',
    '.w.bBbbbbbbbbBB.',
    '...BBBbbbbbBBB..',
    '...bb.bb..bb.bb.',
    '...bb.bb..bb.bb.',
    '...BB.BB..BB.BB.',
    '................',
  ], [
    '...bb..bb.bb..bb',
    '..bb...bb..bb.bb',
    '..BB...BB..BB.BB',
    '................',
  ]);
  // a scarecrow come down off its pole
  D('b_scarecrow', { t: '#c8a050', T: '#8a6a2a', f: '#e8d4a0', F: '#b09860', o: '#ff8a2e', c: '#5a7ad0', C: '#3a5aa0', s: '#ffe27a', w: '#7a5230' }, [
    '......tttt......',
    '.....tTTTTt.....',
    '...tttttttttt...',
    '.....ffffff.....',
    '.....fokfok.....',
    '.....ffffff.....',
    '.....fkFkFk.....',
    's...ccccccccc..s',
    'sswwcCccccCcwwss',
    's..wcccCCcccw..s',
    '....cCccccCc....',
    '....ccccccccc...',
    '.....ss.w.ss....',
    '.....s..w..s....',
    '........w.......',
    '.......www......',
  ], [
    '....s...w...s...',
    '........w.......',
    '........ww......',
  ]);

  // ======================================================================
  // 2 DEEPWOOD
  // ======================================================================
  // a will-o'-the-wisp
  D('f_wisp', { c: '#8affea', C: '#2ac8b0', w: '#f0fffc' }, [
    '....c...',
    '...cc.c.',
    '..cwwcc.',
    '.cwwwwc.',
    'cwkwwkwc',
    'cwwwwwwc',
    '.CwwwwC.',
    '..CCCC..',
  ], [
    '...c....',
    '.c.cc...',
    '.ccwwc..',
    '.cwwwwc.',
    'cwkwwkwc',
    'cwwwwwwc',
    '.CwwwwC.',
    '..CCCC..',
  ]);
  // a spiderling, red-eyed
  D('f_spider', { p: '#5a4a6e', P: '#352a44', r: '#ff4f4f' }, [
    '.p....p.',
    'p.pPPp.p',
    '.ppPPpp.',
    'pprPPrpp',
    'p.pppp.p',
    '.p.pp.p.',
    'p......p',
  ], [
    'pp.pp.pp',
    '.p....p.',
  ]);
  // a walking stump with a sprout
  D('f_stump', { t: '#9a6a3a', T: '#6a4420', y: '#e8c890', g: '#6ed04a' }, [
    '...gg...',
    '..g.gg..',
    '.tyyyyt.',
    '.tyTTyt.',
    '.tkttkt.',
    '.ttTTtt.',
    'tTttttTt',
    '.T.TT.T.',
  ]);
  // a great forest spider
  D('b_spider', { p: '#5a4a6e', P: '#352a44', m: '#8a74a0', r: '#ff3b3b', y: '#ffd84a' }, [
    '................',
    '.....pppppp.....',
    '....pmmppppP....',
    '....pmpyyppP....',
    '....ppyyyypP....',
    'PP...ppyypP...PP',
    '.pp...PPPP...pp.',
    '..ppp.pppp.ppp..',
    'pp..pprpprpp..pp',
    '.ppp.prpprp.ppp.',
    '...pp.pppp.pp...',
    '..pp.PpPPpP.pp..',
    '.pp..P....P..pp.',
    'pp..pp....pp..pp',
    'P..pP......Pp..P',
    '................',
  ], [
    '.pp..P....P..pp.',
    '.pp.pp....pp.pp.',
    '.P.pP......Pp.P.',
    '................',
  ]);
  // an owlbear: a bear with an owl's face
  D('b_owlbear', { b: '#8a6a4a', B: '#5e4630', f: '#e8d8b0', F: '#c8b088', y: '#ffd84a', o: '#e89a3a', w: '#ffffff' }, [
    '...b........b...',
    '...bb.bbbb.bb...',
    '....bbbbbbbb....',
    '...bffffffffb...',
    '...fyyfFFfyyf...',
    '...fykfFFfkyf...',
    '...bffooooffb...',
    '..bbbfFooFfbbb..',
    '.bbbbbFFFFbbbbb.',
    'bbFbbbbbbbbbbFbb',
    'bbFbbBbbbbBbbFbb',
    'ww.bbbbbbbbbb.ww',
    '...bBbbbbbbBb...',
    '...bbb....bbb...',
    '...BBB....BBB...',
    '..BBBB....BBBB..',
  ], [
    '...bbb....bbb...',
    '..BBB......BBB..',
    '.BBBB......BBBB.',
  ]);

  // ======================================================================
  // 3 HIGHLANDS
  // ======================================================================
  // a mountain goat kid
  D('f_goat', { w: '#f0ead8', W: '#c8bca0', h: '#6e5a40', p: '#d89a8a' }, [
    'h......h',
    '.h.ww.h.',
    '..wwww..',
    '.wkwwkw.',
    '.wwppww.',
    'WwwwwwwW',
    '.wWwwWw.',
    '.h.hh.h.',
  ]);
  // a hawk, wings spread
  D('f_hawk', { b: '#9a6a3a', B: '#5e3e20', w: '#f0e2c0', y: '#ffd84a' }, [
    'B......B',
    'bB.ww.Bb',
    '.bbwkbb.',
    '..bbybb.',
    '...bb...',
    '..BbbB..',
    '...BB...',
  ], [
    '........',
    '...ww...',
    '.bbwkbb.',
    'bBbbybBb',
    'B..bb..B',
    '..BbbB..',
    '...BB...',
  ]);
  // a gnome miner with a lamp and a pick
  D('f_miner', { y: '#ffd84a', Y: '#c9a032', s: '#f2c6a0', b: '#7a8494', B: '#4a5262', w: '#e6ebf2', t: '#8a5a2e' }, [
    '..YyyY..',
    '.YYYYYY.',
    '..skks..',
    '..wwww.w',
    '.bbbbbtw',
    'sbBbbBt.',
    '..bbbb..',
    '..B..B..',
  ]);
  // a hill troll, mossy and huge-nosed
  D('b_troll', { g: '#8a9a72', G: '#5e6c4a', m: '#5aa040', s: '#c8b890', y: '#ffe27a', w: '#f4ecd8', t: '#7a5230', T: '#5a3a22' }, [
    '.....mmmmm......',
    '....gmgggmg.....',
    '...gggggggggg...',
    '...gykgggykgg...',
    '...ggggGGgggg...',
    '....gggGGggg....',
    '....gwGGGGwg....',
    '..ggggggggggggt.',
    '.ggGgggggggggGtt',
    '.gg.gTTTTTTg.gt.',
    '.gg.gtttttTg..t.',
    '.GG.gtttttTg..t.',
    '....ggggggggg...',
    '....ggg...ggg...',
    '....GGG...GGG...',
    '...GGGG...GGGG..',
  ], [
    '....ggg...ggg...',
    '...GGG.....GGG..',
    '..GGGG.....GGGG.',
  ]);
  // a big ram with curled horns
  D('b_ram', { w: '#ece4d0', W: '#c8bca0', h: '#a08a60', H: '#6a5638', f: '#4a3e34', y: '#ffd84a' }, [
    '................',
    '..hhhh....hhhh..',
    '.hHHHhh..hhHHHh.',
    '.hH.hhffffhh.Hh.',
    '.hHh.ffffff.hHh.',
    '..hh.fyffyf.hh..',
    '.....ffkkff.....',
    '...wwwffffwww...',
    '..wwwwwffwwwwww.',
    '.wwWwwwwwwwwwWww',
    '.wwWwwwwwwwwwWww',
    '..wwwwwwwwwwwww.',
    '...WwwwwwwwwwW..',
    '....ff.....ff...',
    '....ff.....ff...',
    '...fff....fff...',
  ], [
    '...ff.......ff..',
    '...ff.......ff..',
    '..fff......fff..',
  ]);

  // ======================================================================
  // 4 FROSTLANDS
  // ======================================================================
  // a penguin
  D('f_penguin', { b: '#2e3a52', B: '#1e2638', w: '#f4f8fc', y: '#ffb347' }, [
    '..bbbb..',
    '.bbbbbb.',
    '.bwkwkb.',
    '.bwyywb.',
    'bbwwwwbb',
    'b.wwww.b',
    '..wwww..',
    '..y..y..',
  ]);
  // a little snowman with a coal smile
  D('f_snowman', { w: '#f4f8fc', W: '#bfd0e0', o: '#ff8a2e', r: '#e84a4a', t: '#7a5230' }, [
    '...ww...',
    '..wkwk..',
    '..wwow..',
    't.rrrr.t',
    '.twwwwt.',
    '.wwkwwW.',
    '.wwkwwW.',
    '..WWWW..',
  ], [
    '..W..W..',
  ]);
  // an ice shard come alive
  D('f_icicle', { c: '#c8f0ff', C: '#7fc4ff', b: '#3f7ad0', w: '#ffffff' }, [
    '...w....',
    '..wcC...',
    '.wccCC..',
    '.wkcCk.C',
    'C.cCCCcc',
    '.ccCCC..',
    '..CbbC..',
    '..b..b..',
  ]);
  // a woolly mammoth
  D('b_mammoth', { m: '#8a5a3a', M: '#5e3a22', h: '#b48a5e', w: '#f4ecd8' }, [
    '................',
    '.......mmmmm....',
    '..mmm.mmhhmmmm..',
    '.mhhmmmhmmmmmmm.',
    '.mmmmmmmmmmmmmmm',
    '.mkmmmmmmmmmmmmM',
    '.mmmmMmmmmmmmmMM',
    'mmmmMmmmmmmmmmMM',
    'mmwmmmmmmmmmmMMM',
    'mw.wmmmmmmmmmMM.',
    'm..wmmMmmmMmmM..',
    'm.ww.mm.mm..mm..',
    'M....mm.mm..mm..',
    '.....mm.mm..mm..',
    '.....MM.MM..MM..',
    '................',
  ], [
    '....mm..mm.mm...',
    '....mm..mm.mm...',
    '....MM..MM.MM...',
    '................',
  ]);
  // a walrus with long tusks
  D('b_walrus', { b: '#a8785a', B: '#7a5238', p: '#d8a888', w: '#f4ecd8', h: '#5e4430' }, [
    '................',
    '................',
    '.....bbbbbb.....',
    '....bbbbbbbb....',
    '...bbkbbbbkbb...',
    '...bbbbbbbbbb...',
    '...bbpppppbbb...',
    '...bphhphhpbb...',
    '..bbbwppppwbbb..',
    '.bbbbwbbbbwbbbb.',
    'bbbbbwbbbbwbbbbb',
    'bBbbbbbbbbbbbbBb',
    'bBBbbbbbbbbbbBBb',
    '.BBBbbbbbbbbBBB.',
    'BB..BBBBBBBB..BB',
    '................',
  ], [
    '.BBBbbbbbbbbBBB.',
    '.BB.BBBBBBBB.BB.',
    '................',
  ]);

  // ======================================================================
  // 5 GODLANDS
  // ======================================================================
  // a floating golden mask
  D('f_mask', { y: '#ffd84a', Y: '#c98f10', w: '#fff3b0', p: '#ff4f7e' }, [
    '..yyyy..',
    '.ywyyyy.',
    'ywkyykyY',
    'yyyyyyyY',
    '.yYppYy.',
    '..yYYy..',
    '...pp...',
  ], [
    '..yYYy..',
    '..p..p..',
  ]);
  // a hooded pilgrim with a candle
  D('f_pilgrim', { r: '#7a5ab0', R: '#4a3478', y: '#ffe27a', w: '#ffffff', c: '#f4ecd8', s: '#f2c6a0' }, [
    '.....y..',
    '..rr.w..',
    '.rRRrc..',
    '.rkskrc.',
    '.rrrrrs.',
    '.rRrrRr.',
    '.rrrrrr.',
    '..R..R..',
  ]);
  // a winged little eye
  D('f_wingeye', { w: '#ffffff', W: '#d8d0e8', r: '#ff4f7e', y: '#ffd84a' }, [
    'w......w',
    'Ww.ww.wW',
    '.WwrrwW.',
    '..rkkr..',
    '..wrrw..',
    '...WW...',
    '...yy...',
  ], [
    '........',
    '...ww...',
    'wWwrrwWw',
    'W.rkkr.W',
    '..wrrw..',
    '...WW...',
    '...yy...',
  ]);
  // a temple statue walking with its spear
  D('b_statue', { g: '#b8b8c8', G: '#7a7a8e', D: '#54546a', y: '#ffd84a', Y: '#c98f10', e: '#ff4f7e', w: '#e6ebf2' }, [
    '.....yyyy.....w.',
    '....yYYYYy....w.',
    '....gggggg....G.',
    '....geggeg....G.',
    '....gggggg....G.',
    '.....gGGg.....G.',
    '..gggyyyyggg..G.',
    '.ggGgYyyYgGgggG.',
    '.gg.gggggg.ggGG.',
    '.gg.gGggGg....G.',
    '.GG.gggggg....G.',
    '....ggGGgg....G.',
    '....gg..gg....G.',
    '....gg..gg......',
    '....GG..GG......',
    '...DDD..DDD.....',
  ], [
    '....gg...gg.....',
    '...GG.....GG....',
    '..DDD.....DDD...',
  ]);
  // an oracle: a robe, a halo and an eye for a head
  D('b_oracle', { r: '#5a3a90', R: '#3a2266', y: '#ffd84a', w: '#ffffff', W: '#d8d0e8', e: '#ff4f7e', s: '#f4ecd8' }, [
    '....yyyyyyyy....',
    '...y........y...',
    '...y.WWWWWW.y...',
    '....WwwwwwwW....',
    '...WwweeeewwW...',
    '...WwwekkewwW...',
    '...WwweeeewwW...',
    '....WwwwwwwW....',
    '...rrWWWWWWrr...',
    '..rrRrrrrrrRrr..',
    '.rrRrryyyyrrRrr.',
    'ss.Rrrryyrrrr.ss',
    '...RrrrrrrrrR...',
    '...RRrrrrrrRR...',
    '....RR.RR.RR....',
    '.....R..R..R....',
  ], [
    '....R.RR.RR.R...',
    '...R..R..R...R..',
  ]);

  // ======================================================================
  // 6 ABYSS
  // ======================================================================
  // a little imp with a fork
  D('f_imp', { r: '#e84a2e', R: '#a82a1a', y: '#ffe27a', h: '#3a2a2a', g: '#c9a032' }, [
    'h.....g.',
    'hrrrrhg.',
    '.ryrry.g',
    '.rrkkr.g',
    '..rrrrgg',
    '.RrrrR..',
    '..r..r..',
  ]);
  // a skull on fire
  D('f_skull', { w: '#f4f0e4', W: '#c8c0b0', o: '#ff7a2e', y: '#ffd84a', r: '#e03a1a' }, [
    '.o.y..o.',
    '.oyoyoy.',
    'roowwoor',
    '.wwwwww.',
    '.wkkwkk.',
    '.wwwwwW.',
    '..wkkW..',
  ], [
    '..o.y.o.',
    '.yoyooy.',
    'rooywoor',
    '.wwwwww.',
    '.wkkwkk.',
    '.wwwwwW.',
    '..wkkW..',
  ]);
  // a lava slug leaving a hot trail
  D('f_slug', { o: '#ff7a2e', y: '#ffd84a', r: '#c8301a', R: '#7a1a10' }, [
    '..y..y..',
    '..o..o..',
    '.ooooo..',
    'oyookoo.',
    'oyyooooo',
    'rrrrrrrr',
    '.RRRRRRR',
  ], [
    'rrrrrrrr',
    'RRRRRRR.',
  ]);
  // a hellhound
  D('b_hound', { r: '#5a2a2a', R: '#3a1a1a', o: '#ff7a2e', y: '#ffd84a', w: '#f4ecd8' }, [
    '................',
    '.r...........o..',
    '.rr.........ooy.',
    '.rrr......o.oyo.',
    '..rrrr...rrro...',
    '...rrrrrrrrrrr..',
    '..rrrrrrrrrrryr.',
    '.rrRrrrrrrrrrkrr',
    '.rRRrrrrrrrrrrrw',
    '.rR.rrrrrrrrrww.',
    '..R.rrRRRRrrr...',
    '....rr.....rr...',
    '...rr.......rr..',
    '...rr.......rr..',
    '..RR.......RR...',
    '................',
  ], [
    '....rr.....rr...',
    '....rr.....rr...',
    '....RR.....RR...',
    '................',
  ]);
  // a horned minotaur of the pits
  D('b_minotaur', { b: '#7a3a2a', B: '#4e2218', h: '#f4ecd8', H: '#c8bca0', r: '#ff3b3b', y: '#ffd84a', m: '#3a3038', M: '#24202a' }, [
    'h..............h',
    'hh............hh',
    '.hh..bbbbbb..hh.',
    '..hhbbbbbbbbhh..',
    '....brbbbbrb....',
    '....bbbbbbbb....',
    '.....bbyybb.....',
    '...bbbbbbbbbb...',
    '..bbbBbbbbBbbb..',
    '.bbbbbbbbbbbbbb.',
    '.bb.bmmmmmmb.bb.',
    '.bb.bmMMMMmb.bb.',
    '.BB.bbbbbbbb.BB.',
    '....bbb..bbb....',
    '....BBB..BBB....',
    '...BBBB..BBBB...',
  ], [
    '...bbb....bbb...',
    '...BBB....BBB...',
    '..BBBB....BBBB..',
  ]);

  // ======================================================================
  // 7 THE VOID
  // ======================================================================
  // a glitch: a cube that can't decide its colours
  D('f_glitch', { m: '#ff4fd8', c: '#4fe8ff', w: '#ffffff', v: '#3a2a6a' }, [
    '.mmmmmc.',
    'mmwmmcc.',
    'mmmmcccc',
    'mkmmckcc',
    'mmmmcccc',
    '.mmvvcc.',
    '..v..v..',
  ], [
    'c.mmmmm.',
    '.ccmmwmm',
    'ccccmmmm',
    'cckcmmkm',
    'ccccmmmm',
    '.ccvvmm.',
    '..v..v..',
  ]);
  // a tendril with an eye, risen out of nothing
  D('f_tendril', { p: '#6a48b8', P: '#3e2878', c: '#9af0ff', w: '#ffffff' }, [
    '...pp...',
    '..pwcp..',
    '..pckp..',
    '...pp...',
    '..pp....',
    '..pP....',
    '...pP...',
    '.PPPPP..',
  ], [
    '...pp...',
    '..pwcp..',
    '..pckp..',
    '...pp...',
    '....pp..',
    '....Pp..',
    '...Pp...',
    '..PPPPP.',
  ]);
  // a mote: a black star with a cyan ring
  D('f_mote', { v: '#4a2e8a', V: '#7a52c8', c: '#7fe9ff', w: '#ffffff' }, [
    '...v....',
    'c..vV..c',
    '.cvwvvc.',
    'vvvkvkvv',
    '.cvvvVc.',
    'c..vV..c',
    '...V....',
  ], [
    '....v...',
    '...vV...',
    'ccvwvvcc',
    'vvvkvkvv',
    'ccvvvVcc',
    '...vV...',
    '....V...',
  ]);
  // a horror: an eye among tentacles
  D('b_horror', { p: '#4a2a7a', P: '#2a1648', m: '#7a4ab0', w: '#ffffff', e: '#ff4fd8', c: '#9af0ff' }, [
    '................',
    '.p....pppp....p.',
    '.pp..pmmmpp..pp.',
    '..pppmwwwmppp...',
    '...pmwweewmPp...',
    '..ppmweekewmPp..',
    '.pp.mweeeewmPpp.',
    'pp..pmwwwwmPP.pp',
    'p..ppPmmmmPPpp.p',
    '..pp.pPPPPPp.pp.',
    '.pp.pp.pPp.pp.pp',
    '.p..p..pP..p...p',
    '.pp.pp.pp.pp..pp',
    '..p..p..p..p.p..',
    '.c..c...c...c..c',
    '................',
  ], [
    '.pp.pp..pp.pp.pp',
    '..p..p.pP.p..p..',
    '.pp.pp..pp..pp..',
    'p..p...p..p...p.',
    'c...c...c...c...',
    '................',
  ]);
  // a hollow knight: armour with nothing inside but two lights
  D('b_hollow', { a: '#4a4a6a', A: '#2e2e48', s: '#8a8ab0', c: '#7fe9ff', v: '#6a3fc0', w: '#e6ebf2' }, [
    '......ssss......',
    '.....saaaas.....',
    '....saaaaaas....',
    '....akkkkkka....',
    '....akckkcka....',
    '....akkkkkka....',
    '.....aaaaaa.....',
    '..ssaaavvaaass..',
    '.saaaavvvvaaaas.',
    '.sa.aaavvaaa.as.',
    '.aa.aaaaaaaa.aa.',
    '.w..aAAaaAAa..w.',
    '.w..aa....aa..w.',
    '....aa....aa....',
    '....AA....AA....',
    '...AAA....AAA...',
  ], [
    '...aa......aa...',
    '...AA......AA...',
    '..AAA......AAA..',
  ]);

  // ======================================================================
  // 8 SUNKEN LIBRARY
  // ======================================================================
  // a blot of living ink
  D('f_ink', { b: '#3a4a9a', B: '#1e2a5a', w: '#ffffff', c: '#8ab0ff' }, [
    '...b....',
    '..bbb.b.',
    '.bcbbbb.',
    'bwkbbwkb',
    'bbbbbbbb',
    '.bBbbBbb',
    'B.B.B..B',
  ], [
    '.B.B.B.B',
  ]);
  // a living candle
  D('f_candle', { c: '#f4ecd8', C: '#c8bca0', y: '#ffd84a', o: '#ff8a2e', b: '#8a6a3a' }, [
    '...y....',
    '..yoy...',
    '...o....',
    '..cccc..',
    '..ckck..',
    '..cccC..',
    '.bccCCb.',
    '.b.bb.b.',
  ], [
    '....y...',
    '...oyy..',
    '...o....',
    '..cccc..',
    '..ckck..',
    '..cccC..',
    '.bccCCb.',
    'b..bb..b',
  ]);
  // a bookworm in round spectacles
  D('f_worm', { g: '#8ad86a', G: '#4ea84a', w: '#ffffff', y: '#ffd84a' }, [
    '.....gg.',
    '....gwyw',
    '....gkyk',
    'gg..gggg',
    'gGg.gGg.',
    'gGggGgg.',
    '.GGGGG..',
  ], [
    '....gg..',
    '...gwyw.',
    '...gkyk.',
    '...gggg.',
    'g.ggGg..',
    'gGgGgg..',
    'GGGGGG..',
  ]);
  // a drowned scribe with a quill
  D('b_scribe', { b: '#3a6a8a', B: '#1f3e5a', w: '#d8f0ff', c: '#7fe9ff', q: '#f4ecd8', y: '#ffd84a' }, [
    '.....bbbbbb.....',
    '....bBBBBBBb....',
    '....bkwwwwkb....',
    '....bwcwwcwb..q.',
    '....bwwwwwwb.qq.',
    '.....bwkkwb..q..',
    '...bbbbbbbbbbq..',
    '..bBbbbyybbbwq..',
    '..bB.bbyybb.w...',
    '..wb.bbbbbb.....',
    '..w..bBbbBb.....',
    '.....bbbbbb.....',
    '....bbbbbbbb....',
    '...bbBbbbbBbb...',
    '..b.b.b.b.b.b.b.',
    '.b.b.b.b.b.b.b..',
  ], [
    '..b.b.b.b.b.b.b.',
    '...b.b.b.b.b.b.b',
  ]);
  // a bookshelf that bites
  D('b_shelf', { t: '#8a5a32', T: '#5a3a1e', r: '#d8504a', g: '#4fae6a', b: '#4f7ad8', y: '#ffd84a', w: '#ffffff' }, [
    'TTTTTTTTTTTTTTTT',
    'TttttttttttttttT',
    'TrrgbbyrgbrybgrT',
    'TrrgbbyrgbrybgrT',
    'TttttttttttttttT',
    'TkkkkkkkkkkkkkkT',
    'TkwkwkwkwkwkwkwT',
    'TkkkkkkkkkkkkkkT',
    'TwkwkwkwkwkwkwkT',
    'TttttttttttttttT',
    'TbyrgbbrgybrrgbT',
    'TbyrgbbrgybrrgbT',
    'TttttttttttttttT',
    'TTTTTTTTTTTTTTTT',
    '.TT..........TT.',
    '.TT..........TT.',
  ], [
    'TTTTTTTTTTTTTTTT',
    '..TT........TT..',
    '..TT........TT..',
  ]);

  // ======================================================================
  // 9 CLOCKWORK FOUNDRY
  // ======================================================================
  // a hex nut on little legs
  D('f_nut', { g: '#b8c0cc', G: '#7a8494', w: '#e6ebf2' }, [
    '..gggg..',
    '.gwgggG.',
    'ggk..kGG',
    'gg....GG',
    '.gG..GG.',
    '..GGGG..',
    '.g.GG.g.',
  ]);
  // a propeller drone with a red eye
  D('f_drone', { g: '#9a9aa8', G: '#6e6e7c', r: '#ff3b3b', w: '#e6ebf2', y: '#c8a032' }, [
    'ww..y.ww',
    '..yyyy..',
    '.gggggg.',
    'gGgrrgGg',
    '.gGGGGg.',
    '..y..y..',
  ], [
    '.ww.y.w.',
    '..yyyy..',
    '.gggggg.',
    'gGgrrgGg',
    '.gGGGGg.',
    '..y..y..',
  ]);
  // a wind-up beetle with a key on its back
  D('f_windup', { y: '#c8a032', Y: '#7a5a20', c: '#ffd84a', g: '#9a9aa8' }, [
    '...cc...',
    '..c..c..',
    '...gg...',
    '.yyyyyy.',
    'yYyyyyYy',
    'ykyyyyky',
    '.YYYYYY.',
    'g.g..g.g',
  ]);
  // a furnace bot with a fire in its belly
  D('b_furnace', { i: '#5a5a6a', I: '#3a3a48', g: '#8a8a9a', o: '#ff7a2e', y: '#ffd84a', r: '#e03a1a', w: '#c8c8d4' }, [
    '.....ii.ii......',
    '.....ii.ii......',
    '...gggggggggg...',
    '...gwyggggyIg...',
    '...ggggggggIg...',
    '..giiiiiiiiiig..',
    '.ggiorroyorrigg.',
    'g.giryyyyyyrig.g',
    'g.gioyyyyyyoig.g',
    'w.giiiiiiiiiig.w',
    '..ggIIIIIIIIgg..',
    '...gg......gg...',
    '..giiii..iiiig..',
    '..gIIIIg.gIIIIg.',
    '..kgkgk...kgkgk.',
    '................',
  ], [
    '..giiii..iiiig..',
    '..gIIIIg.gIIIIg.',
    '..gkgkg...gkgkg.',
    '................',
  ]);
  // a piston press on treads
  D('b_press', { y: '#c8a032', Y: '#7a5a20', g: '#9a9aa8', G: '#5e5e6e', r: '#ff3b3b', w: '#e6ebf2', o: '#ff7a2e' }, [
    '......gggg......',
    '......gwGg......',
    '......gwGg......',
    '....yyyyyyyy....',
    '...yYYYYYYYYy...',
    '...yYrryYrrYy...',
    '...yYYYYYYYYy...',
    '....yyyyyyyy....',
    '..ggggggggggggg.',
    '..gGGGGGGGGGGGg.',
    '..gwwwwwwwwwwwg.',
    '...oo......oo...',
    '..GGGGGGGGGGGG..',
    '.GgGgGgGgGgGgGG.',
    '.GGGGGGGGGGGGGG.',
    '................',
  ], [
    '..GGGGGGGGGGGG..',
    '.GGgGgGgGgGgGgG.',
    '.GGGGGGGGGGGGGG.',
    '................',
  ]);

  // ======================================================================
  // 10 EMBER WASTES
  // ======================================================================
  // a cinder sprite
  D('f_cinder', { o: '#ff7a2e', y: '#ffd84a', w: '#fffbe0', r: '#c8301a', R: '#7a1a10' }, [
    '..o..o..',
    '.oyo.yo.',
    '.oywwyo.',
    'oykwwkyo',
    '.oyyyyo.',
    '..rooR..',
    '...rr...',
  ], [
    '.o...o..',
    '..oyoyo.',
    '.oywwyo.',
    'oykwwkyo',
    '.oyyyyo.',
    '..rooR..',
    '...rr...',
  ]);
  // an ash scorpion
  D('f_scorp', { a: '#6a5a5a', A: '#3e3434', o: '#ff7a2e' }, [
    '.....ao.',
    '......a.',
    '.a....a.',
    'aa.aaaa.',
    '.aakaka.',
    '.AAAAAA.',
    'A.A.A.A.',
  ]);
  // a magma blob with a crust
  D('f_magma', { o: '#ff7a2e', y: '#ffd84a', R: '#5a2a1a', r: '#8a3a1a' }, [
    '..RRRR..',
    '.RroorR.',
    'RoyyoorR',
    'RokyykoR',
    'RooooooR',
    '.RrRRrR.',
  ], [
    '..RRRR..',
    '.RryorR.',
    'RoyyyorR',
    'RokyykoR',
    'RooooooR',
    'RRrRRrRR',
  ]);
  // a giant ash scorpion, sting lit
  D('b_scorpion', { a: '#6a5a5a', A: '#3e3434', m: '#9a8a80', o: '#ff7a2e', y: '#ffd84a', r: '#ff3b3b' }, [
    '................',
    '................',
    '..........yo....',
    '...........oa...',
    '............a...',
    '.aa.........a...',
    'a..a.......aa...',
    'a.aa......aa....',
    '.aa......aa.....',
    '..a..aaaaaa..aa.',
    '...aaamaamaaa..a',
    '....arammaraaa.a',
    '....aaaaaaaaaaa.',
    '...AaAaAaAaAaA..',
    '..A.A.A.A.A.A...',
    '.A..A..A..A..A..',
  ], [
    '...AaAaAaAaAaA..',
    '...A.A.A.A.A.A..',
    '..A..A..A..A..A.',
  ]);
  // a magma golem, cracks glowing
  D('b_magmag', { s: '#4a3e3a', S: '#2e2624', o: '#ff7a2e', y: '#ffd84a', r: '#c8301a' }, [
    '.....ssssss.....',
    '....ssosssss....',
    '....syossyss....',
    '....ssssssss....',
    '.sssssoosssssss.',
    'ssosssyossssosss',
    'syossssoosssyoSs',
    'ssss.ssyoss.sSSs',
    'sSSs.ssosss.sSSs',
    '.SS..ssssss..SS.',
    '.....sSossSs....',
    '.....sss.sss....',
    '.....sss.sss....',
    '....sSSs.sSSs...',
    '....SSSS.SSSS...',
    '................',
  ], [
    '.....sss..sss...',
    '....sSSs..sSSs..',
    '....SSSS..SSSS..',
    '................',
  ]);

  // ======================================================================
  // 11 MIRROR MAZE
  // ======================================================================
  // a prism, splitting light
  D('f_prism', { w: '#ffffff', c: '#c8d6ff', C: '#7a8ab8', p: '#ff7ae6', y: '#ffe27a', b: '#7fe9ff' }, [
    '...ww...',
    '..wccw..',
    '..wkck..',
    '.wcccCw.',
    '.wccCCw.',
    'wCCCCCCw',
    'p.y..b..',
  ], [
    '...ww...',
    '..wccw..',
    '..wkck..',
    '.wcccCw.',
    '.wccCCw.',
    'wCCCCCCw',
    '..p.y..b',
  ]);
  // a doppel: a little shadow of the Warden
  D('f_doppel', { d: '#4a3a68', D: '#2a2238', p: '#ff3b5c', w: '#c8b8f0' }, [
    '..dddd..',
    '.dDDDDd.',
    '.dDpDpd.',
    '..dddd..',
    '.wddddd.',
    'w.dDDd.d',
    '..dddd..',
    '..D..D..',
  ]);
  // a glass bat
  D('f_shardbat', { w: '#ffffff', c: '#c8d6ff', C: '#7a8ab8', p: '#ff7ae6' }, [
    'C......C',
    'cC.ww.Cc',
    'ccCwwCcc',
    'CcwppwcC',
    'C.cwwc.C',
    '...cc...',
  ], [
    '........',
    '...ww...',
    'CcCwwCcC',
    'ccwppwcc',
    'C.cwwc.C',
    '...cc...',
  ]);
  // a jester of mirrors
  D('b_jester', { p: '#a83fd6', P: '#6a2490', y: '#ffd84a', w: '#f4f4fa', W: '#c8d0e8', r: '#ff3b5c', c: '#7fe9ff', C: '#3fa0c0' }, [
    '..y..........y..',
    '..pp........cc..',
    '...ppp....ccc...',
    '....ppppcccc....',
    '.....wwwwww.....',
    '.....wkwwkw.....',
    '.....wwrrww.....',
    '......wwww......',
    '...ppppccccccc..',
    '..pPppppcccCcc..',
    '..p.ppppccccc.c.',
    '..w.yyyyyyyyy.w.',
    '....ppppcccc....',
    '....ppp..ccc....',
    '....PPP..ccc....',
    '...yPPP..cccy...',
  ], [
    '....ppp...ccc...',
    '...PPP.....ccc..',
    '..yPPP.....cccy.',
  ]);
  // a crystal beast, its body a dozen mirrors
  D('b_crystal', { w: '#ffffff', c: '#c8d6ff', C: '#7a8ab8', D: '#4a5a88', p: '#ff7ae6' }, [
    '.......w........',
    '......wcC.......',
    '..w..wccCC..w...',
    '.wcC.wccCC.wcC..',
    '.wcC.cccCC.wcC..',
    '..ccccccccccCC..',
    '..wccpccccpcCC..',
    '..wcckcccckcCC..',
    '..cccccccccCCC..',
    '.wcccCCCCCccCCC.',
    'wcc.cCCCCCCc.CCD',
    'wc..ccccccCC..CD',
    '....ccCCCCCC....',
    '....ccC..cCC....',
    '....cCC..cCC....',
    '...DDDD..DDDD...',
  ], [
    '....ccC...cCC...',
    '...cCC.....cCC..',
    '..DDDD.....DDDD.',
  ]);

  // ======================================================================
  // 12 SKY CITADEL
  // ======================================================================
  // an angry little storm cloud
  D('f_cloud', { g: '#9aa4b8', G: '#6a7488', w: '#e6ebf2', y: '#ffd84a' }, [
    '..ww....',
    '.wwwgww.',
    'wwggggww',
    'gkgggkgG',
    'gggGGggG',
    '.GGGGGG.',
    '..y..y..',
    '.y..y...',
  ], [
    '...y..y.',
    '..y..y..',
  ]);
  // a harpy
  D('f_harpy', { s: '#f2c6a0', h: '#c84a6a', f: '#8a6aa8', F: '#5a4078', y: '#ffd84a' }, [
    'F..hh..F',
    'fF.hh.Ff',
    'ffskksff',
    '.fssssf.',
    '..ffff..',
    '..fFFf..',
    '..y..y..',
  ], [
    '...hh...',
    '...hh...',
    'ffskksff',
    'FfssssfF',
    'F.ffff.F',
    '..fFFf..',
    '..y..y..',
  ]);
  // a golden bell that rings at you
  D('f_bell', { y: '#ffd84a', Y: '#c98f10', w: '#fff3b0', b: '#8a5a20' }, [
    '...bb...',
    '..yyyy..',
    '.ywyyyy.',
    '.ykyyky.',
    '.yyyyyY.',
    'yyyyyyYY',
    '...bb...',
  ], [
    '...bb...',
    '..yyyy..',
    '.ywyyyy.',
    '.ykyyky.',
    '.yyyyyY.',
    'yyyyyyYY',
    '....bb..',
  ]);
  // a griffin
  D('b_griffin', { w: '#f4f0e4', W: '#c8bca0', y: '#ffd84a', b: '#c8903a', B: '#8a5a20', o: '#ffb347' }, [
    'W..............W',
    'wW...wwww.....Ww',
    'wwW.wwwwww...Www',
    '.wwWwkwwwyo.Www.',
    '..wwwwwwwyyWww..',
    '...wWwwwwwWww...',
    '....bbwwwwbb....',
    '...bbbbbbbbbb...',
    '..bbbbbbbbbbbbB.',
    '..bBbbbbbbbbbBBB',
    '...bbBbbbbBbb..B',
    '...bb.bbbb.bb...',
    '...bb......bb...',
    '...bb......bb...',
    '..yy.......yy...',
    '................',
  ], [
    '................',
    '.....wwww.......',
    '....wwwwww......',
    '...wwkwwwyo.....',
    'W.wwwwwwwyy....W',
    'wWwWwwwwwwWwWwWw',
    '.wwwbbwwwwbbwww.',
    '...bbbbbbbbbb...',
    '..bbbbbbbbbbbbB.',
    '..bBbbbbbbbbbBBB',
    '...bbBbbbbBbb..B',
    '...bb.bbbb.bb...',
    '..bb........bb..',
    '..bb........bb..',
    '.yy..........yy.',
    '................',
  ]);
  // a gilded sentinel with a halo
  D('b_sentinel', { y: '#ffd84a', Y: '#c98f10', w: '#ffffff', W: '#e8e0c8', b: '#6fb4ff', g: '#f4f0e4' }, [
    '.....yyyyyy.....',
    '....y......y....',
    '.....YYYYYY.....',
    '....YyyyyyyY....',
    '....YybbbbyY....',
    '....YyyyyyyY....',
    '.....YyyyyY.....',
    '..wwwYYYYYYwww..',
    '.wWwYyyyyyyYwWw.',
    '.ww.YyybbyyY.ww.',
    '.w..YyyyyyyY..w.',
    '....YYyyyyYY....',
    '....yy....yy....',
    '....yy....yy....',
    '....YY....YY....',
    '...YYY....YYY...',
  ], [
    '...yy......yy...',
    '...YY......YY...',
    '..YYY......YYY..',
  ]);

  // ======================================================================
  // 13 THE MOON
  // ======================================================================
  // a moon rabbit
  D('f_rabbit', { w: '#f4f6ff', W: '#c8d0e8', p: '#ff8ab8', c: '#b890ff' }, [
    '.w..w...',
    '.wp.wp..',
    '.ww.ww..',
    '.wwwwww.',
    '.wkwwkw.',
    '.wwppwwc',
    '..wwwwW.',
    '..W..W..',
  ]);
  // a pale moth drawn to the Button's light
  D('f_moth', { m: '#dce4f4', M: '#9aa8c8', c: '#b890ff', y: '#fff3b0' }, [
    'm......m',
    'Mm.yy.mM',
    'mcMkkMcm',
    'mMmyymMm',
    'M.mmmm.M',
    '...mm...',
  ], [
    '........',
    '...yy...',
    'mmmkkmmm',
    'cMmyymMc',
    'M.mmmm.M',
    '...mm...',
  ]);
  // a tiny saucer
  D('f_saucer', { g: '#9a9aa8', G: '#5e5e6e', c: '#9af0ff', e: '#6ee06e', y: '#ffe27a' }, [
    '...cc...',
    '..cecc..',
    '.gggggg.',
    'gGyGGyGg',
    '.gggggg.',
    '...cc...',
  ], [
    '...cc...',
    '..ccec..',
    '.gggggg.',
    'gGGyGGyg',
    '.gggggg.',
    '..c..c..',
  ]);
  // a moon wolf howling for its sky
  D('b_moonwolf', { w: '#dce4f4', W: '#9aa8c8', D: '#6a7898', c: '#b890ff', y: '#fff3b0' }, [
    '................',
    '.....w...w......',
    '.....ww.ww......',
    '....wwwwwww.....',
    '....wywwywW.....',
    '...wwwwwwwWW....',
    '...wWkkkWWWw....',
    '....wwwwwWw.....',
    '..wwwwwwwwwww...',
    '.wwWwwwwwwwWwww.',
    '.ww.wwwccwww.wwW',
    '.WW.wwwwwwww..WW',
    '....wWwwwwWw...W',
    '....ww....ww....',
    '....WW....WW....',
    '...DDD....DDD...',
  ], [
    '...ww......ww...',
    '...WW......WW...',
    '..DDD......DDD..',
  ]);
  // a crater crab carrying a moonstone
  D('b_cratercrab', { m: '#bcbcc6', M: '#7a7e92', c: '#c8a8ff', C: '#8a68e0', w: '#ffffff' }, [
    '................',
    '.mm..........mm.',
    'mMMm...ww...mMMm',
    'mM.m..wcCw..m.Mm',
    '.mmm..cccC..mmm.',
    '...m...CC...m...',
    '...mmmmmmmmmm...',
    '..mmkmmmmmmkmm..',
    '.mMmmmmmmmmmmMm.',
    '.mMMmmmmmmmmMMm.',
    '..mMMMMMMMMMMm..',
    '...mMMMMMMMMm...',
    '..m.m.m..m.m.m..',
    '.m..m.m..m.m..m.',
    '.M..M.M..M.M..M.',
    '................',
  ], [
    '..m.m.m..m.m.m..',
    '..m..m.m..m.m..m',
    '..M..M.M..M.M..M',
    '................',
  ]);

  // ======================================================================
  // 14 THE STAR SEA
  // ======================================================================
  // a comet with a face
  D('f_comet', { y: '#ffe27a', w: '#fffbe0', o: '#ffb347', b: '#9af0ff' }, [
    'b.......',
    '.b..yy..',
    'b.oywwy.',
    '.ooykwky',
    'b.oywwy.',
    '.b..yy..',
  ], [
    '.b......',
    'b...yy..',
    '.boywwy.',
    'ooo.ykwk',
    '.boywwy.',
    'b...yy..',
  ]);
  // a little ringed planet
  D('f_planet', { p: '#ff8ab8', P: '#c84a7e', r: '#ffe27a', w: '#ffe0f0' }, [
    '..pppp..',
    '.pwpppP.',
    'rrrrrrrr',
    'pkppkppP',
    '.ppppPP.',
    '..PPPP..',
  ], [
    '..pppp..',
    '.pwpppP.',
    'pkppkppP',
    'rrrrrrrr',
    '.ppppPP.',
    '..PPPP..',
  ]);
  // a star squid
  D('f_squid', { c: '#5a78f0', C: '#26307a', w: '#ffffff', y: '#ffe27a' }, [
    '...cc...',
    '..cccc..',
    '.cwccwc.',
    '.ckcckc.',
    '..cccc..',
    '.c.cC.c.',
    'c..C..yc',
    '.y..c...',
  ], [
    '.c.cC.c.',
    '.c.C.c..',
    'y.c..c.y',
  ]);
  // a star whale swimming through the dark
  D('b_whale', { b: '#3a4ab0', B: '#26307a', w: '#c8d6ff', y: '#ffe27a', s: '#ffffff' }, [
    '................',
    '................',
    '................',
    '..........s.....',
    '.....bbbbbb.....',
    '...bbbbbbbbbb...',
    '..bbsbbbbybbbb..',
    '.bbbbbbbbbbbbbbB',
    '.bkbbbbbbbbbbbBB',
    'bbbbbbbbbbbybbBB',
    'wwbbbbbbbbbbbBBb',
    '.wwwwwwwwbbbBB.b',
    '..wwwwwwwwwBB...',
    '....wwwwwBB.....',
    '.....B..B.......',
    '................',
  ], [
    '....wwwwwBB.....',
    '......B..B......',
    '................',
  ]);
  // a nebula elemental: a gas cloud with a star heart
  D('b_nebula', { p: '#ff7ae6', P: '#b03aa8', c: '#8a6aff', C: '#4a3ab0', w: '#ffe0f8', y: '#ffe27a' }, [
    '.....pp..cc.....',
    '...pppppcccc....',
    '..ppwwpcccccc...',
    '.ppwppppccccCc..',
    '.ppppkppckccCc..',
    'pppppppcccccCCc.',
    'pPppppyyycccCCc.',
    '.pPpppyyyccCCc..',
    '.ppPpppycccCcc..',
    '..pp.ppcccc.cc..',
    '..p..pPcCcC..c..',
    '.....pP..cC.....',
    '....pP....cC....',
    '...p........c...',
    '................',
    '................',
  ], [
    '..pp.ppcccc.cc..',
    '.p...pPcCcC...c.',
    '......PcC.......',
    '.....P....C.....',
    '....p......c....',
    '................',
    '................',
  ]);

  // ======================================================================
  // THE 3.4 BEHAVIOURS, in each land's colours (a, A, c as in sprites.js ARCH_PAL)
  // ======================================================================
  const LAND_PAL = {
    shore:     { a: '#5ab4c8', A: '#2a6a80', c: '#ffd84a' },
    meadow:    { a: '#c8a050', A: '#7a5a2a', c: '#e84a4a' },
    forest:    { a: '#6ed04a', A: '#2d7a28', c: '#ffe27a' },
    highlands: { a: '#c08a5a', A: '#7a5230', c: '#7fe9ff' },
    tundra:    { a: '#9fd8ff', A: '#4f8ad0', c: '#ffffff' },
    godlands:  { a: '#ffd84a', A: '#b08a20', c: '#ff4f7e' },
    abyss:     { a: '#ff6a2e', A: '#9e2424', c: '#ffe27a' },
    void:      { a: '#8a5ae0', A: '#3a2266', c: '#7fe9ff' },
    library:   { a: '#4fb8a8', A: '#1f6a60', c: '#f4ecd8' },
    foundry:   { a: '#c8a032', A: '#6e5a2a', c: '#ff7a2e' },
    ember:     { a: '#ff4f2e', A: '#8a1f10', c: '#ffd84a' },
    mirror:    { a: '#d8e6ff', A: '#7a8ab8', c: '#ff7ae6' },
    sky:       { a: '#fff3d0', A: '#c8b070', c: '#6fb4ff' },
    moon:      { a: '#d0d4e0', A: '#7a7e92', c: '#b890ff' },
    cosmos:    { a: '#5a78f0', A: '#26307a', c: '#ffe27a' },
  };
  const BEH_PX = {
    // a frog-legged leaper, coiled to spring (frame 2: crouched low)
    leaper: [[
      '..aaaa....',
      '.aakaak...',
      '.aaaaaaa..',
      '..aAAAa...',
      '.aacccaa..',
      'aAaaaaaAa.',
      'aA.....Aa.',
      'A.......A.',
    ], [
      '..........',
      '..aaaa....',
      '.aakaak...',
      '.aaaaaaa..',
      '.aaAAAaa..',
      'aAacccaAa.',
      'AAaaaaaAA.',
      'A.A...A.A.',
    ]],
    // one gnat of a swarm, wings buzzing
    gnat: [[
      'w...w',
      'ww.ww',
      '.aka.',
      '..A..',
    ], [
      '.....',
      'wwaww',
      '.aka.',
      '..A..',
    ]],
    // a tower-shield bearer: the wall
    shieldwall: [[
      '...wwwwwww..',
      '..wAAAAAAAw.',
      '.awAAcccAAw.',
      'aakwAcAcAAw.',
      'aaawAcccAAw.',
      '.aawAAcAAAw.',
      '.aawAAcAAAw.',
      '..awAAAAAAw.',
      '..aAwAAAAw..',
      '..a..wwww...',
      '.AA..A..A...',
    ], [
      '.AA...A.A...',
    ]],
    // a splitting blob (and its two smaller halves)
    blob: [[
      '...aaaa...',
      '.aawaaaaa.',
      'aawaaaaaaA',
      'aakaaaakaA',
      'aaaaccaaaA',
      'AaaaaaaaAA',
      '.AAAAAAAA.',
    ], [
      '..........',
      '..aaaaaa..',
      '.aawaaaaa.',
      'aakaaaakaA',
      'aaaaccaaaA',
      'AaaaaaaaAA',
      'AAAAAAAAAA',
    ]],
    blob1: [[
      '.aaaa.',
      'awaaaA',
      'akaakA',
      'aacaaA',
      '.AAAA.',
    ], [
      '......',
      '.aaaa.',
      'akaakA',
      'aacaaA',
      'AAAAAA',
    ]],
    blob2: [[
      '.aa.',
      'akkA',
      '.AA.',
    ], [
      '....',
      'akkA',
      'AAAA',
    ]],
    // a burrower: a clawed digger with a drill snout
    mole: [[
      '...AAAA...',
      '..AaaaaA..',
      '.AakaakaA.',
      '.AaacaaaA.',
      'wwAaaaaAww',
      'w.AaaaaA.w',
      '..AaaaaA..',
      '..A....A..',
    ], [
      '..wAaaaAw.',
      '..AaaaaA..',
      '...A..A...',
    ]],
  };
  for (const land in LAND_PAL) for (const k in BEH_PX) {
    const pal = Object.assign({ w: '#ffffff', y: '#ffe27a' }, LAND_PAL[land]);
    const [a, b] = BEH_PX[k];
    D('a_' + k + '_' + land, pal, a, b);
  }

  // ======================================================================
  // The table: every land's skins, its original sprite first
  // ======================================================================
  const NEW = [
    { fodder: ['f_jelly', 'f_hermit', 'f_gull'], brute: ['b_octo', 'b_turtle'] },           // Shoreline
    { fodder: ['f_piglet', 'f_beetle', 'f_kobold'], brute: ['b_boar', 'b_scarecrow'] },      // Meadows
    { fodder: ['f_wisp', 'f_spider', 'f_stump'], brute: ['b_spider', 'b_owlbear'] },         // Deepwood
    { fodder: ['f_goat', 'f_hawk', 'f_miner'], brute: ['b_troll', 'b_ram'] },                // Highlands
    { fodder: ['f_penguin', 'f_snowman', 'f_icicle'], brute: ['b_mammoth', 'b_walrus'] },    // Frostlands
    { fodder: ['f_mask', 'f_pilgrim', 'f_wingeye'], brute: ['b_statue', 'b_oracle'] },       // Godlands
    { fodder: ['f_imp', 'f_skull', 'f_slug'], brute: ['b_hound', 'b_minotaur'] },            // Abyss
    { fodder: ['f_glitch', 'f_tendril', 'f_mote'], brute: ['b_horror', 'b_hollow'] },        // The Void
    { fodder: ['f_ink', 'f_candle', 'f_worm'], brute: ['b_scribe', 'b_shelf'] },             // Sunken Library
    { fodder: ['f_nut', 'f_drone', 'f_windup'], brute: ['b_furnace', 'b_press'] },           // Clockwork Foundry
    { fodder: ['f_cinder', 'f_scorp', 'f_magma'], brute: ['b_scorpion', 'b_magmag'] },       // Ember Wastes
    { fodder: ['f_prism', 'f_doppel', 'f_shardbat'], brute: ['b_jester', 'b_crystal'] },     // Mirror Maze
    { fodder: ['f_cloud', 'f_harpy', 'f_bell'], brute: ['b_griffin', 'b_sentinel'] },        // Sky Citadel
    { fodder: ['f_rabbit', 'f_moth', 'f_saucer'], brute: ['b_moonwolf', 'b_cratercrab'] },   // The Moon
    { fodder: ['f_comet', 'f_planet', 'f_squid'], brute: ['b_whale', 'b_nebula'] },          // The Star Sea
  ];
  G.MOB_SKINS = {};
  (G.REALMS || []).forEach((r, i) => {
    const n = NEW[i] || { fodder: [], brute: [] };
    G.MOB_SKINS[i] = {
      fodder: [r.fodder].concat(n.fodder).filter(id => SPR.defs[id]),
      brute: [r.minion].concat(n.brute).filter(id => SPR.defs[id]),
    };
  });
  // the original sprite keeps this share of a land's mobs, so its look stays the land's own
  G.MOB_SKIN_ORIG = 0.34;
  // a stable pick per mob: the same mob always wears the same skin
  function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); n ^= n >>> 15; return (n >>> 0) / 4294967296; }
  G.mobSkin = function (m, realm) {
    const ri = G.REALMS.indexOf(realm), sk = G.MOB_SKINS[ri < 0 ? 0 : ri];
    const list = sk && (m.kind === 'fodder' ? sk.fodder : sk.brute);
    if (!list || !list.length) return m.kind === 'fodder' ? realm.fodder : realm.minion;
    // a Land Champion, its decoys and its split copies keep the land's own look (decoys must not give it away,
    // and a burrower comes up with a new id)
    if (m.champ || m.champKid || m.decoy || m.wl || m.inv) return list[0];
    const u = hash(m.id | 0);
    if (u < G.MOB_SKIN_ORIG || list.length < 2) return list[0];
    return list[1 + Math.floor((u - G.MOB_SKIN_ORIG) / (1 - G.MOB_SKIN_ORIG) * (list.length - 1)) % (list.length - 1)];
  };
  // the second walk frame, at about 5 steps a second (small fry faster), each mob out of step with the next
  // (a mob that stands still, biting or held by the tank, keeps its first frame)
  G.mobFrame = function (id, t, m) {
    const id2 = id + '_2';
    if (!SPR.defs[id2]) return id;
    if (m && (m.p >= 1 || m.held || m.p < 0)) return id;
    const rate = m && m.kind === 'fodder' ? 7 : 4.5;
    return Math.floor(t * rate + ((m && m.id) || 0) * 0.37) % 2 ? id2 : id;
  };
})(globalThis.G = globalThis.G || {});
