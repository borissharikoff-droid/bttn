// BTTN — DOM interface: resources, tabs, lists, constellation, collection,
// pets, quests, achievements, ascension, settings, toasts and modals.
(function (G) {
  'use strict';
  const UI = G.UI = {};
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ic = (id, sc, o) => G.SPR.url(id, sc || 4, o);
  // each icon carries its sprite's size, so it can be shown at a whole multiple of it (see snapPixels)
  const sprW = id => { try { const c = G.SPR.get(id); return c ? c.width + 'x' + c.height : ''; } catch (e) { return ''; } };
  const img = (id, cls, sc, o) => `<img src="${ic(id, sc, o)}" alt="" class="${cls || ''}" data-b="${typeof id === 'string' ? sprW(id) : ''}" draggable="false">`;
  // Pixel art only looks right at whole multiples: snap every icon's CSS size to the nearest one that fits
  // (measured by layout, not by the screen box, so an icon caught mid-animation isn't snapped at its scaled size;
  // all the reads come before all the writes, so a tab full of icons lays out once, not once per icon)
  function snapPixels(root) {
    const ims = [...(root || document).querySelectorAll('img[data-b]:not([data-snap])')];
    if (!ims.length) return;
    for (const im of ims) { im.style.width = ''; im.style.height = ''; }
    const dpr = window.devicePixelRatio || 1;
    const ws = ims.map(im => im.offsetParent ? parseFloat(getComputedStyle(im).width) || 0 : 0);
    ims.forEach((im, i) => {
      const [bw, bh] = (im.dataset.b || '').split('x').map(Number), w = ws[i];
      if (!bw || !bh || !w) return;
      // whole screen pixels per art pixel, so no pixel comes out wider than its neighbour
      const wd = w * dpr;
      let k = Math.round(wd / bw);
      if (k * bw > wd * 1.2) k = Math.floor(wd / bw);
      k = Math.max(1, k);
      im.style.width = k * bw / dpr + 'px'; im.style.height = k * bh / dpr + 'px';
      im.dataset.snap = '1';
    });
  }
  // a new layout (a turned phone, a resized window, another screen) sizes icons afresh
  function resnap() {
    for (const im of document.querySelectorAll('img[data-snap]')) { im.style.width = ''; im.style.height = ''; delete im.dataset.snap; }
    snapPixels();
  }
  let resnapT = 0;
  window.addEventListener('resize', () => { clearTimeout(resnapT); resnapT = setTimeout(resnap, 150); });
  // new icons are snapped before they're painted, not a moment later
  let snapQ = false;
  if (typeof MutationObserver !== 'undefined') new MutationObserver(() => { if (!snapQ) { snapQ = true; requestAnimationFrame(() => { snapQ = false; snapPixels(); }); } })
    .observe(document.documentElement, { childList: true, subtree: true });
  UI.snapPixels = snapPixels;
  // (4.0: the Torment dial is gone: Heat is chosen at the Run Setup, between Sieges)
  // 4.0: the Embers' own icon (the Furnace's currency: town, Star Chart), drawn here when no art module has one
  if (G.SPR && G.SPR.def && G.SPR.defs && !G.SPR.defs.ic_ember) G.SPR.def('ic_ember', { r: '#ff5a2a', o: '#ffa033', y: '#ffe27a', d: '#8a2410', k: '#3a1a10' }, [
    '...o....',
    '..oo..o.',
    '..oyo.o.',
    '.oyyooo.',
    '.oyyyyo.',
    'royyyyor',
    'rrooyorr',
    '.dddddd.',
  ]);
  // QoL: numbers in letters (1.23Qa) or in science (1.23e15), as the player likes (Settings). Every file calls
  // G.fmt when it draws, so wrapping it here reaches the field's numbers too.
  if (G.fmt && !G.fmt._qol) {
    const fmt0 = G.fmt;
    G.fmt = function (n, small) {
      const s = G.S && G.S.set;
      if (s && s.sci && typeof n === 'number' && Number.isFinite(n) && Math.abs(n) >= 1e6) {
        const a = Math.abs(n), ex = Math.floor(Math.log10(a)), m = Math.floor(a / Math.pow(10, ex) * 100) / 100;
        return (n < 0 ? '-' : '') + m.toFixed(2) + 'e' + ex;
      }
      return fmt0(n, small);
    };
    G.fmt._qol = 1;
  }
  const fmt = G.fmt, t = G.t, L = G.L;
  // ---------- 4.0: the meta screens' words (English; js/i18n_ru.js adds Russian) ----------
  G.tAdd({
    newSiege: 'NEW SIEGE', newSiegeShort: 'SIEGE', siegeOn: 'A Siege is on: finish it first (Settings: Abandon).', siegeFirst: 'Start from nothing: choose a Button, a Warden and go.',
    siegeLast: 'Last time: {0} Button · {1} · Heat {2}', todoSiege: 'Start a new Siege', dailyNeedsGate: 'Build the Rift Gate for the Daily Siege',
    chNextSiege: 'The road goes on from the doors.', seatOpenCamp: 'A seat is open: the next camp brings recruits.', seatCamp: 'Opens at Camp {0}', campShort: 'Camp {0}',
    seatCampTip: 'Companions join at Camps 1, 2 and 3 of a Siege, each with a trait.', twTavernOut: 'Between Sieges the Tavern is quiet: recruits come at camp.',
    embers: 'Embers', gems: 'Gems', embersTip: 'Embers: everything a Siege carried, burned in the Furnace. They build the town and the Star Chart.',
    fameTip: 'Fame: what each Siege earns, even a fall. It buys the Hall of Fame at the Temple.',
    itemAttuned: 'attuned', itemRule: 'Rule:', cmpWornNow: '{0} wears this.', cmpBetter: 'Better for {0}: {1} power', cmpEmpty: 'fills an empty slot', cmpWorse: 'Not better for {0}', cmpWith: 'Compare with',
    enchNeedsForge: 'ENCHANT ALL opens with the Forge I (50 Embers).', enchLevels: 'levels', enchHave: 'You have {0} shards and {1} whetstones.', enchGoldOut: 'Between Sieges it costs gold too.',
    enchHint: 'Evenly raises the lowest enchanted pieces of the whole party first; Most power puts each shard where it adds the most.', enchDoneN: 'Enchanted: +{0} levels',
    enchBtn: '✦ ENCHANT ALL · +{0}', enchLocked: '✦ ENCHANT ALL · Forge I', todoEnch: 'Enchant All: +{0} levels waiting',
    twLegUp: 'better for {0}', twLegOth: 'better for someone else', twLegDn: 'nobody needs it', bagEmptyOut: 'Empty between Sieges: a new Siege starts from nothing.',
    bldNone: 'Not built yet', bldTable: 'All five levels', bldUpTo: 'Build {0}', bldTableHint: 'Each level opens something new and keeps what came before. Embers build it.',
    bldNoEmbers: '{0} more Embers needed. Every Siege burns into Embers, even a fall.', dirHint4: 'Embers build the town a level at a time; each level opens something new. Tap a building for its table.',
    dirBackIdle: 'Look at the field', hallHint4: 'Each rank costs more; every rank stays for good.', hfOn: 'on', hfNowIs: 'Now {0}', hfNone: 'Not bought', hfNextIs: 'next {0}', hfSum: 'Ranks {0}/{1} · {2} of {3} Fame spent',
    fallenHint: 'The last twelve Wardens. Their statues stand in the square; the winners on gold.', fallenWin: 'Broke the Mad Button', fallenExtract: 'Extracted in {0}, depth {1}',
    fallenAbandon: 'Left the Siege in {0}', fallenFell: 'Fell in {0}, depth {1}', fallenNone: 'No Warden has fallen yet.', heatN: 'Heat {0}',
    cause_doom: 'DOOM not answered', cause_boss: 'lost the fight', cause_overrun: 'overrun',
    btnsHint: 'Each Button is a different Siege: its own rule and starting card. Deeds open them; each Heat won puts a sticker on it.', btnEvoIs: 'Evolves: {0}', btnEvoUnknown: 'Evolution: ???',
    btnSecret: 'A Button no one has pressed.', btnNoRule: 'No rule: the Button as it is.', btnCard: 'Starts with {0}', btnSecretHow: 'A secret recipe', btnLocked: 'Locked', btnStickers: 'Heat won with it',
    btnsHeat: 'Heat won: {0}. Heat open: up to {1}.',
    btn_classic_n: 'Classic', btn_classic_r: 'No rule: the Button as it is.', btn_classic_u: 'From the start',
    btn_iron_n: 'Iron', btn_iron_r: 'Health +60%, damage −15%', btn_iron_c: 'Bulwark', btn_iron_u: 'Fall 3 times',
    btn_storm_n: 'Storm', btn_storm_r: '+1 bolt per click, companions −20%', btn_storm_c: 'Heavy Hand', btn_storm_u: 'Slay an Act I boss',
    btn_spore_n: 'Spore', btn_spore_r: 'Sporefall in every land, XP +30%', btn_spore_c: 'Corpse Blast', btn_spore_u: 'Slay 2,000 Spitters',
    btn_gold_n: 'Gold', btn_gold_r: 'Gold ×1.6, +1 market offer', btn_gold_c: 'Greed', btn_gold_u: 'Hold 1M gold in a Siege',
    btn_glass_n: 'Glass', btn_glass_r: 'Damage ×1.8, health ×0.55', btn_glass_u: 'Win a Siege',
    btn_prism_n: 'Prism', btn_prism_r: 'A 4th card when an evolution is ready; mythic and divine roll +1 perk rank; health −20%', btn_prism_u: 'Discover 5 evolutions',
    btn_clockwork_n: 'Clockwork', btn_clockwork_r: 'Holds itself at 8 clicks a second (manual ×0.5); cards, camps and doors choose themselves; Fame −20%', btn_clockwork_u: 'Play 3 Sieges',
    btn_golden_n: 'THE GOLDEN BUTTON', btn_golden_r: 'Loot rarity +1, Embers ×2, Horde health +50%, Integrity 2', btn_golden_u: 'A secret recipe',
    bevo_adamant_n: 'Adamant', bevo_adamant_r: 'Bites reflect 100%', bevo_adamant_h: 'A Bastion evolution, and the Aegis on the belt.',
    bevo_tempest_n: 'Tempest', bevo_tempest_r: 'Every click chains', bevo_tempest_h: 'The Hand’s wrath and a thunderstorm in one Siege.',
    bevo_crimson_n: 'Crimson', bevo_crimson_r: '+20% damage', bevo_crimson_h: 'Three evolutions in one Siege.',
    bevo_diamond_n: 'Diamond', bevo_diamond_r: 'Crit +10%', bevo_diamond_h: 'Clear Act II and never drop under half.',
    bevo_spectrum_n: 'Spectrum', bevo_spectrum_r: '+1 card at lords', bevo_spectrum_h: 'Five schools at rank 2 or more.',
    bevo_bloom_n: 'Bloom', bevo_bloom_r: 'Spores explode', bevo_bloom_h: 'Kindling and Corpse Blast, both at their max.',
    bevo_perpetual_n: 'Perpetual', bevo_perpetual_r: 'Holds at 12 clicks a second', bevo_perpetual_h: 'Ten thousand clicks it made itself, in one Siege.',
    bevo_golden_n: 'THE GOLDEN BUTTON', bevo_golden_r: 'Unlocks the Golden Button for good', bevo_golden_h: 'Midas, a dragon’s hoard and a million in gold when the Mad Button dies.',
    keepTitle: 'Keepsakes', keepSlots: '{0}/{1}', keepHint: 'Bring Codex entries into the next Siege: a unique starts on your Warden and attunes to the depth; a relic starts on the belt.',
    keepNeedsMuseum: 'The Museum I opens a keepsake slot (the Hall of Fame’s Heirloom Shelf a second).', keepEmpty: 'empty', keepOn: 'Bringing', keepTake: 'Bring',
    cxHint: 'Every unique and relic a Siege touches is kept here, even on a fall. A duplicate ranks it up (cap {0}): +12% to its fixed affixes; ranks 2 and 4 add a rank of its perk.',
    cxLocked: 'Locked: a Deed opens it', cxDropsBoss: 'Drops from {0}', cxDrops: 'Not found yet', cxRank: 'Rank {0}/{1}', cxTheme: '+{0} {1}',
    evoBookHint: 'An evolution: a perk at its max with two ranks you picked, and the right item worn.', evoHint4: '{0} at max (2 picked ranks) + {1}',
    bevoBook: 'Button evolutions', bevoHint: 'Secret recipes. One mid-Siege, the Button changes for good.', bevoFrom: 'From the {0} Button', bevoNoHint: 'No hint yet: each ranked Daily Siege finished gives a token that reads one.',
    bstHint: 'Every land you have fought in, its Horde and its lord.', bstUnseen: 'Not reached yet', bstKills: '{0} slain', bstKinds: 'New kinds', bstLands: 'Lands',
    kind_warded: 'Warded', kind_charger: 'Charger', kind_healer: 'Healer', kind_summoner: 'Summoner',
    unl_button: '{0} Button', unl_class: 'Class: {0}', unl_perk: 'Card: {0}', unl_land: 'Land: {0}', unl_unique: 'Unique: {0}', unl_relic: 'Relic: {0}', unl_shrine: 'Shrine: {0}', unl_system: '{0}',
    deedsSum: 'Deeds {0}/{1} · unlocks {2}/{3}', deedNext: 'NEXT UNLOCK', deedAllUnl: 'Every unlock is yours.', deedNoUnl: 'Deeds that unlock content come with the Siege.',
    deedF_unl: 'Unlocks', deedF_all: 'All', deedF_done: 'Done', deedNone: 'Nothing here yet.',
    st_sieges: 'Sieges', st_wins: 'Wins', st_extracts: 'Extracts', st_deaths: 'Falls', st_heat: 'Heat won',
    dailyTitle: 'THE DAILY SIEGE', dailySetupLine: 'Today: {0} Button · {1} · Heat {2}. The same seed for everyone.', dailyRules: 'The first attempt is ranked: +{0} Fame and +{1} Gems. No keepsakes, no Continue.',
    dailyTried: 'Attempts today: {0}. The rest are for fun.', dailyFresh: 'Not tried today.', dailyAgain: 'Play it again', dailyGo: 'Play the Daily Siege', dailyBoard: 'Today’s board',
    riftPowers: 'What the Rift Gate opens', riftOldGone: 'The old Rifts are closed: the Siege is the run now.',
    starsHint4: 'Lasting stars, bought with Embers.', starsVis: 'The Observatory {2} shows {0} of {1} stars.', starsNeedObs: 'Build the Observatory ({0} Embers) to see the Star Chart.', starHidden: 'Not yet seen: the Observatory {0} shows it.',
    collMoved: 'Uniques, relics and evolutions are in the Codex and the recipe book.', awayBarracks: 'the Barracks',
    // (continuation 1: the meta stream's final API)
    collCombatOff: 'Crit, crit power and boss damage from the collection are off: permanent power has a budget now.', collOff: 'off',
    hfPower: 'Permanent power: damage {0} · bosses {1} · health {2} (budget {3} / {4} / {5})', hfCapped: 'At the budget: the rest is scaled down.',
    qDaily: '×2 today', qWeekly: 'Weekly',
    setAutoRun: 'Auto-Run', setAutoRunHint: 'Clockwork plays on by itself: the next Siege starts when one ends, and it extracts at camp {0}.', setAutoRunCamp: 'Auto-Run extracts at camp',
    deedDone: 'Deed', unlTitle: 'Unlocked', unlOpens: 'opens: ', unlNext: 'from the next Siege', unlNow: 'now',
    alchStart: 'Each Siege starts with {0} potion(s)', alchPickHint: 'Pick up to {0}: tap to choose, tap again to drop.', alchRandom: 'Each Siege starts with {0} random potion(s). Alchemist III lets you choose them.',
    bevoTok: 'Hint tokens: {0} (one for each ranked Daily Siege finished).', bevoBuy: 'Read the hint',
    autoCards: 'Cards: auto-pick', autoCardsHint: 'Picks for you after {0} s. Off: the card waits (the field waits too).', autoInvest: 'Auto-invest', autoInvestHint: 'Spends the run’s gold on Upgrades and the Garrison by payback, keeping half for the camp',
    setSiege: 'This Siege', abandonTitle: 'Abandon the Siege', abandonHint: 'Ends it like a fall: Fame in full, Embers ×0.5.', abandon: 'Abandon', abandonSure: 'Sure? Tap again',
    setLang: 'Language', setLangPick: 'Language', setLangSoon: 'English. Русский is on its way.', setStream: 'Streamer mode', setStreamSoon: 'Twitch chat votes on cards, doors and relics: coming in this update.',
    pickClassHint4: 'Choose your Warden for this Siege. Its own weapon type deals +50%.',
    rec_sieges: 'Sieges', rec_wins: '{0} won', rec_heat: 'Heat won',
    tab_codex: 'Codex', tab_recipes: 'Recipes', tab_bestiary: 'Bestiary', tab_deeds: 'Deeds', tab_hall: 'Hall of Fame', tab_fallen: 'The Fallen', tab_buttons: 'Buttons', tab_rift: 'Daily Siege',
    bld_forge_1: 'ENCHANT ALL (camp and Forge)', bld_forge_2: 'Reforge at camp: an item’s level to this depth', bld_forge_3: 'Scrapping pays orbs (1 per 40 shards)', bld_forge_4: '+1 card at lords’ loot', bld_forge_5: 'A Siege’s first legendary rolls +1 perk rank',
    bld_tavern_1: '4 recruits to choose from at camp', bld_tavern_2: 'Recruits arrive with armour', bld_tavern_3: 'Companions +10% damage', bld_tavern_4: 'Companions +15% health', bld_tavern_5: 'Start each Siege with a companion',
    bld_enchant_1: 'Gamble ware at the camp market', bld_enchant_2: 'Enchanting costs 20% less', bld_enchant_3: 'Whetstones ×2 from lords', bld_enchant_4: 'The Orb of Ruin never bricks', bld_enchant_5: 'Crit power +0.05',
    bld_alch_1: 'A random potion at the start', bld_alch_2: '+1 Mend charge a Siege', bld_alch_3: '2 potions at the start', bld_alch_4: 'Potion caps +2', bld_alch_5: '3 potions at the start',
    bld_barracks_1: 'Embers while away: 3% of your best payout an hour, up to 4 h', bld_barracks_2: 'Up to 6 h away', bld_barracks_3: 'Up to 8 h away', bld_barracks_4: 'Up to 10 h away', bld_barracks_5: 'Up to 12 h away',
    bld_museum_1: 'A keepsake slot and the Codex shelf', bld_museum_2: 'Codex rank cap 3', bld_museum_3: 'Unique chance +20%', bld_museum_4: 'Codex rank cap 4', bld_museum_5: 'Item Embers +10%',
    bld_quests_1: '3 run deeds on the board', bld_quests_2: '4 run deeds', bld_quests_3: 'The daily deed pays ×2', bld_quests_4: '5 run deeds', bld_quests_5: 'A weekly deed (Gems)',
    bld_stars_1: 'The Star Chart opens: 8 stars', bld_stars_2: '16 stars', bld_stars_3: '24 stars', bld_stars_4: '32 stars', bld_stars_5: 'All 37 stars',
    bld_pets_1: 'The egg incubator', bld_pets_2: 'Hatching ×1.5', bld_pets_3: '+1 pet seat', bld_pets_4: 'Hatching ×2', bld_pets_5: 'Golden egg chance +2%',
    bld_temple_1: 'The Heat shrine (Heat opens with each win)', bld_temple_2: 'Fame +5%', bld_temple_3: 'Fame +10%', bld_temple_4: 'Fame +15%', bld_temple_5: 'Fame +20%',
    bld_rift_1: 'The Daily Siege', bld_rift_2: 'Push On after a win', bld_rift_3: 'Vault doors: one more secret land', bld_rift_4: 'Push loot +25%', bld_rift_5: 'The Weekly League (coming)',
  });
  // the player's interface choices (last tabs, sorts, buy amount…), kept in the save with the settings
  const PF = () => { const s = G.S.set; if (!s.ui || typeof s.ui !== 'object') s.ui = {}; return s.ui; };
  UI.prefs = PF;

  let tab = 'upg', buyAmt = 1, selNode = 'spark', selItem = null, ascArm = 0, resetArm = 0, selWho = -1;
  let refs = {}, lastText = new WeakMap();
  const setText = (el, s) => { if (el && lastText.get(el) !== s) { el.textContent = s; lastText.set(el, s); } };
  const setClass = (el, c, on) => { if (el && el.classList.contains(c) !== !!on) el.classList.toggle(c, !!on); };

  // 4.0: the meta opens with the first Siege's end (its Fame and Embers): the Temple, the Museum's Codex, the Board's
  // Deeds, the Observatory, the Rift Gate. A season-3 save (the founders' gift) has it all from the start.
  const metaOpen = S => !!(S.lastRun || (S.fameTotal || 0) > 0 || (S.emberTotal || 0) > 0 || (S.embers || 0) > 0 || Object.keys(S.codex || {}).length || (S.fallen12 || []).length || S.founders);
  const TABS = [
    { id: 'upg', icon: 'ic_rune', unlock: () => true },
    { id: 'hero', icon: 'ic_sword', unlock: () => true },
    { id: 'heroes', icon: 'h_knight', unlock: S => S.goldTotal >= 40 || metaOpen(S) },
    { id: 'codex', icon: 'ic_museum', unlock: S => metaOpen(S) || S.st.chests >= 1 },
    { id: 'recipes', icon: 'ic_star', unlock: metaOpen },
    { id: 'bestiary', icon: 'ic_skull', unlock: metaOpen },
    { id: 'coll', icon: 'ic_bag', unlock: S => S.st.chests >= 1 },
    { id: 'deeds', icon: 'ic_trophy', unlock: S => metaOpen(S) || Object.keys(S.ach).length > 0 },
    { id: 'quests', icon: 'ic_scroll', unlock: S => S.st.chests >= 5 || metaOpen(S) },
    { id: 'stars', icon: 'ic_star', unlock: metaOpen },
    { id: 'pets', icon: 'egg_2', unlock: S => S.eggs > 0 || Object.keys(S.pets).length > 0 },
    { id: 'hall', icon: 'ic_fame', unlock: metaOpen },
    { id: 'fallen', icon: 'ic_tomb', unlock: metaOpen },
    { id: 'buttons', icon: 'ic_star', unlock: metaOpen },
    { id: 'rift', icon: 'ic_rift', unlock: metaOpen },
    { id: 'ladder', icon: 'ic_crown', unlock: () => true },
    { id: 'set', icon: 'ic_gear', unlock: () => true },
  ];
  const tabOpen = id => { const d = TABS.find(x => x.id === id); return d && d.unlock(G.S); };
  // 3.0: the panel keeps only the Upgrades (and Settings); every other page lives in a town building
  // 4.0: the Temple holds the Hall of Fame, the Hall of the Fallen and the Buttons; the Museum the Codex (uniques, relics,
  // keepsakes), the recipe book and the bestiary; the Board the Deeds; the Rift Gate the Daily Siege
  const BLDS = {
    forge: { npc: 'npc_smith', subs: ['forge'] }, enchant: { npc: 'npc_witch', subs: ['enchant', 'gamble'] }, alch: { npc: 'npc_alch', subs: ['alch'] },
    tavern: { npc: 'npc_keeper', subs: ['tavern', 'hero', 'ladder'] },
    barracks: { npc: 'npc_keeper', subs: ['heroes'], sub: 'twBarracksSub' }, museum: { npc: 'npc_sage', subs: ['codex', 'recipes', 'bestiary', 'coll'], sub: 'twMuseumSub', wide: 1 },
    quests: { npc: 'npc_keeper', subs: ['deeds', 'quests'], sub: 'twBoardSub', wide: 1 }, stars: { npc: 'npc_sage', subs: ['stars'], sub: 'twObsSub' },
    pets: { npc: 'npc_alch', subs: ['pets'], sub: 'twNestSub' }, temple: { npc: 'npc_sage', subs: ['hall', 'fallen', 'buttons'], sub: 'twTempleSub', wide: 1 },
    rift: { npc: 'npc_witch', subs: ['rift'], sub: 'twRiftSub' },
  };
  const BLD_ORDER = ['forge', 'enchant', 'alch', 'tavern', 'barracks', 'museum', 'quests', 'stars', 'pets', 'temple', 'rift'];
  const BLD_SPR = { forge: 'tw_forge', enchant: 'tw_tower', alch: 'tw_alch', tavern: 'tw_tavern', barracks: 'tw_barracks', museum: 'tw_museum', quests: 'tw_board', stars: 'tw_obs', pets: 'tw_nest', temple: 'tw_temple', rift: 'tw_rift' };
  const CUSTOM = { forge: 1, enchant: 1, gamble: 1, alch: 1, tavern: 1 };
  const TAB_BLD = {}; Object.keys(BLDS).forEach(b => BLDS[b].subs.forEach(x => { TAB_BLD[x] = b; }));
  const subOpen = x => !!CUSTOM[x] || tabOpen(x);
  const bldOpen = id => !!BLDS[id] && BLDS[id].subs.some(subOpen);
  G.bldOpen = bldOpen;
  // a page shown in a town window (its renderer and updater run there), or null
  let wtab = null;
  const curTab = () => wtab || (G.R && G.R.town && tab !== 'set' ? 'towndir' : tab);

  // ---------- Shell ----------
  UI.init = function () {
    const S = G.S;
    S.seen = S.seen || {};
    S.seen.tabs = S.seen.tabs || {};
    // (3.6: the Lucky Spin's 'Spin at once' switch went with it)
    if (S.set) delete S.set.autoSpin;
    // (what's in the bag on the first look isn't news; gold is counted by source for the breakdown)
    if (PF().seenU == null && S.hero) bagSeen();
    if (!G.goldBySrc) G.goldBySrc = {};
    $('#goldIco').src = ic('ic_coin', 4);
    const ei = $('#emberIco'); if (ei) ei.src = ic(G.SPR.defs.ic_ember ? 'ic_ember' : 'ic_fame', 3);
    $('#eggIco').src = ic('ic_egg', 3);
    $('#fameIco').src = ic('ic_fame', 3);
    $('#gemIco').src = ic('ic_gem', 3);
    buildTabs();
    bindHud();
    bindPartyHud();
    bindKeys();
    listen();
    tab = 'upg';
    S.seen.tabs.upg = 1; S.seen.tabs._u_upg = 1;
    UI.render();
    UI.update(true);
    $('#perks').addEventListener('click', e => { if (performance.now() - (+$('#perks').dataset.shownAt || 0) < 600) return; const c = e.target.closest('[data-perk]'); if (c && G.pickPerk(c.dataset.perk)) { G.Audio && G.Audio.buy(); UI.update(true); } });
    // 4.0: the panel's NEW SIEGE (between Sieges) and the chips that open what they count
    const sb = $('#siegeBtn'); if (sb) { sb.innerHTML = `${img('ic_skull', '', 2)} ${esc(t('newSiege'))}`; sb.addEventListener('click', () => { G.Audio.unlock(); UI.newSiege(); }); }
    const ec = $('#emberChip'); if (ec) ec.addEventListener('click', () => { G.Audio.unlock(); UI.go(bldOpen('stars') && G.bldLvl('stars') > 0 ? 'stars' : 'towndir'); });
    const fc = $('#fameChip'); if (fc) fc.addEventListener('click', () => { G.Audio.unlock(); if (tabOpen('hall')) UI.go('hall'); });
    if (G.Tut) G.Tut.init();
    // 4.0: the first boot has no Warden yet: the Run Setup (js/run_ui.js) picks the Button, the class and the rest
    if (!S.hero.cls && !(S.run && S.run.on)) setTimeout(() => UI.newSiege({ boot: 1 }), 300);
  };
  // ---------- 4.0: NEW SIEGE: the one way into a run from the menu ----------
  // The Run Setup is run_ui's (G.RunUI.setup); until it is there (or if it is missing), a small class pick starts the
  // Siege with the last setup, so there is never a dead end. Waits for the intro, a window and the cloud save's question.
  let siegeWait = 0, siegeQ = 0;
  UI.newSiege = function (o) {
    o = o || {};
    // (one waiting call at a time: the boot's and the intro's end ask for the same screen)
    if (siegeQ && !o._q) return false;
    const later = () => { siegeQ = 1; setTimeout(() => { siegeQ = 0; UI.newSiege(Object.assign({}, o, { _q: 1 })); }, 500); return false; };
    const S = G.S, N = G.Net;
    if (S.run && S.run.on) { if (!o.boot) UI.toast(esc(t('siegeOn')), '', 'ic_skull', { p: 2 }); return false; }
    if (S.fallen) return false;
    // (a returning player on a new device gets their save back first)
    if (o.boot && N && N.hold && N.cloud && $('#modal').hidden && $('#intro').hidden) { askCloud(N.cloud); return later(); }
    if (!$('#modal').hidden || !$('#intro').hidden || (o.boot && N && (N.hold || (N.status === 'connecting' && siegeWait++ < 16)))) return later();
    if (G.R.town && !o.keepTown) G.leaveTown();
    if (UI.townId && UI.townId()) UI.townClose(true);
    if (G.RunUI && typeof G.RunUI.setup === 'function') { G.RunUI.setup(o); return true; }
    UI.pickClass();
    return true;
  };
  // the Daily Siege (Rift Gate I): run_ui's own way in when it has one, else straight in (its setup is fixed)
  UI.dailySiege = function () {
    const S = G.S;
    if (S.run && S.run.on) { UI.toast(esc(t('siegeOn')), '', 'ic_skull', { p: 2 }); return false; }
    if (!G.D.daily) { G.Audio.error(); UI.toast(esc(t('dailyNeedsGate')), '', 'ic_rift', { p: 2 }); return false; }
    if (G.R.town) G.leaveTown();
    if (G.RunUI && typeof G.RunUI.daily === 'function') { G.RunUI.daily(); return true; }
    if (G.RunUI && typeof G.RunUI.setup === 'function') { G.RunUI.setup({ daily: 1 }); return true; }
    return !!(G.runDaily && G.runDaily());
  };
  // the page in view: the Forge and Enchanter count as the Party page, for the tips that point there
  // 3.6: a big card waits for the field to be free: no window, relic show or boss fight; and for a while (maxWait)
  // also no march, title card or banner on the field and room in the pacing director. Then it counts as a big moment.
  function whenFree(fn, o) {
    o = o || {};
    const t0 = performance.now();
    const go = () => {
      const R = G.R, St = G.Stage || {}, waited = performance.now() - t0;
      // (4.0: a run screen or a card offer holds it; with no Siege on G.runHeld() is true too, but nothing of a run is up
      // then, so it no longer keeps the card waiting for good)
      const run = G.S.run, hard = !$('#modal').hidden || !$('#intro').hidden || (G.relicShow && G.relicShow()) || R.boss || !(G.S.hero && G.S.hero.cls) || !!(run && run.on && ((G.runHeld && G.runHeld()) || run.offer));
      let soft = false;
      try { soft = !!(R.march || (St.marching && St.marching()) || (St.cardBusy && St.cardBusy()) || bannerBusy || (o.dir && G.director && G.director.can && !G.director.can('card', 2))); } catch (e) { soft = false; }
      if (hard || (soft && waited < (o.maxWait || 20000))) { setTimeout(go, 400); return; }
      if (G.director && G.director.mark) { try { G.director.mark('card', o.secs || 4); } catch (e) { /* the director is optional */ } }
      fn();
    };
    setTimeout(go, o.delay || 0);
  }
  UI.whenFree = whenFree;
  // the chapter card (3.6: after the march and the new land's title card, never on top of them)
  UI.chapter = function (li, slot) {
    if (slot == null) slot = li;
    // (4.0: the chapter belongs to its Siege: with the Siege over it is dropped. A Siege on its own clocks (Clockwork's
    // beats, Auto-Run) has nobody to close a window, and a window holds the field and every run clock: a toast then.
    // It never covers a run screen or a card offer waiting between two beats)
    const r = G.S.run;
    if (G.inSiege && !(r && r.on)) return;
    if (r && r.on && ((+r.beatAfter || 0) > 0 || r.autoAgain)) { UI.toast(`<b>${esc(t('chTitle', slot + 1, G.REALMS[li].name))}</b>`, 'ach', 'ic_star', { k: 'chapter', p: 0 }); return; }
    if (!$('#modal').hidden || (G.relicShow && G.relicShow()) || G.R.boss || (G.runHeld && G.runHeld()) || (r && r.offer) || (G.RunUI && G.RunUI.busy && G.RunUI.busy())) { whenFree(() => UI.chapter(li, slot), { dir: true, secs: 5 }); return; }
    // (4.0: the road is chosen at the doors, so the card tells the land's story, not the next stop; the Torment line went;
    // its number is the land's place in this Siege)
    UI.modal(t('chTitle', slot + 1, G.REALMS[li].name), `<div class="chapter"><p class="story">${esc(t('ch_' + li))}</p>
      <p class="next">${esc(t('chNextSiege'))}</p></div>`, [{ label: t('chGo'), cls: 'gold' }]);
    G.Audio && G.Audio.achievement && G.Audio.achievement();
  };
  UI.rankText = x => t(x.k, x.tg || (x.cd ? x.cd.toFixed(1) : Math.round((x.spd || x.hp || x.dmg) * 100)));
  G.on('rankUp', x => UI.toast(`<b>${esc(t('rankUp'))}</b>&nbsp;${esc(t('lvl'))} ${x.lv}: ${esc(UI.rankText(x))}`, 'ach', 'ic_star', { k: 'rank', p: 0 }));
  UI.tab = () => (tw.id === 'forge' || tw.id === 'enchant' ? 'hero' : curTab());
  UI.townId = () => tw.id;
  UI.bldOf = id => TAB_BLD[id] || null;
  // the game's own link, for the brag line
  G.SHARE_URL = 'https://claude.ai/artifact/WcSxtLrabwMuEt2YcyxpWh';
  G.uiBusy = () => !$('#modal').hidden || !$('#intro').hidden;

  // ---------- The Hand's powers: three buttons with their cooldowns ----------
  function updatePowers() {
    const el = $id('powers'), h = G.S.hero;
    if (!el) return;
    setHid(el, !(h && h.cls));
    if (el.hidden) return;
    if (!el.children.length) {
      el.innerHTML = Object.keys(G.POWERS).map(id => { const P = G.POWERS[id]; return `<button class="pw" data-pw="${id}" title="${esc(t('pw_' + id) + ' (' + P.key + '): ' + t('pw_' + id + '_d'))}" aria-label="${esc(t('pw_' + id))}">${img(P.icon, '', 3)}<i></i><kbd>${P.key}</kbd></button>`; }).join('')
        + (G.overdrive ? `<button class="pw od" data-od title="${esc(t('odName') + ' (V): ' + t('odDesc'))}" aria-label="${esc(t('odName'))}">${img(G.SPR.defs.ic_bolt ? 'ic_bolt' : 'ic_star', '', 3)}<i></i><kbd>V</kbd></button>` : '');
      el.addEventListener('click', e => {
        if (e.target.closest('[data-od]')) { G.Audio.unlock(); if (!G.overdrive('tap')) G.Audio.error(); return; }
        const b = e.target.closest('[data-pw]'); if (b && !G.usePower(b.dataset.pw)) G.Audio.error();
      });
    }
    const odB = el.querySelector('[data-od]');
    if (odB) {
      const o = G.odState(), on = o.t > 0;
      setHgt(odB._i || (odB._i = odB.querySelector('i')), on ? 0 : (1 - o.m) * 100);
      setClass(odB, 'ready', G.odReady()); setClass(odB, 'on', on);
    }
    for (const b of el._pw || (el._pw = el.querySelectorAll('[data-pw]'))) {
      const id = b.dataset.pw, cd = G.R.pw[id] || 0, tot = G.POWERS[id].cd;
      setHgt(b._i || (b._i = b.querySelector('i')), cd > 0 ? cd / tot * 100 : 0);
      setClass(b, 'ready', !(cd > 0));
    }
  }
  // ---------- A sudden event: its name, its clock and how it's going ----------
  let evIcoK = null;
  function updateEventBar() {
    const R = G.R, ev = R.ev, row = $id('evRow');
    setHid(row, !ev);
    if (!ev) return;
    const e = G.EV_BY_ID[ev.k];
    if (evIcoK !== ev.k) { evIcoK = ev.k; $('#evIco').src = ic(e.icon, 2); $('#evWrap').style.setProperty('--ev', e.col); }
    setW($id('evMeter'), Math.max(0, ev.t / ev.T) * 100);
    let more = '';
    if (ev.k === 'goblins') more = t('evGoblins', ev.ids.filter(id => !R.mobs.some(m => m.id === id)).length, ev.ids.length);
    else if (ev.k === 'ambush') more = t('evAmbush', ev.ids.filter(id => R.mobs.some(m => m.id === id)).length);
    else if (ev.k === 'chestrain') more = t('evRain', ev.n);
    else if (ev.k === 'stampede') more = t('evHold');
    else if (ev.k === 'meteors') more = t('evTap');
    else if (ev.k === 'portals') more = t('evPortals', (ev.por || []).length);
    else if (ev.k === 'warlord') { const w = G.R.mobs.find(m => m.wl); more = w ? Math.ceil(w.hp / w.max * 100) + '%' : ''; }
    setText($id('evText'), e.name + ' · ' + Math.ceil(Math.max(0, ev.t)) + 's' + (more ? ' · ' + more : ''));
  }
  // ---------- The party on the field: a chip per unit, tap a fallen one to raise them ----------
  let phKey = '';
  function updatePartyHud() {
    const el = $id('partyHud'), h = G.S.hero;
    // 3.4: the team is always on show, from the first minute: the Warden, each companion, and the empty seats
    // (an open one pulses with a +, a locked one says the depth that opens it)
    const units = h && h.cls ? G.partyUnits() : [];
    setHid(el, !units.length || (G.S.tut >= 0 && G.S.tut < 3));
    if (!units.length) return;
    const slots = G.partySlots ? G.partySlots() : 0, seats = [];
    for (let k = G.S.party.length; k < 3; k++) seats.push(k < slots ? 'open' : 'lock');
    let key = seats.join(',');
    for (const u of units) { key += '|' + u.cls; if (u.eq) for (const s of G.SLOTS) { const g = u.eq[s]; key += ',' + (g ? g.id + (g.q || '') : ''); } }
    if (key !== phKey) {
      phKey = key;
      el.innerHTML = units.map(u => `<button class="pchip r_${u.role}" data-who="${u.who}" aria-label="${esc(u.who < 0 ? t('wardenName') : L(G.CLASS_BY_ID[u.cls].name))}"><img src="${G.Doll.portrait({ cls: u.cls, eq: u.eq }, 2, true)}" alt=""><i><u></u></i><b></b></button>`).join('')
        // (4.0: seats open per Siege at Camps 1-3, where the recruits wait)
        + seats.map((s, k) => s === 'open' ? `<button class="pseat open" data-seat title="${esc(t(G.inSiege() ? 'seatOpenCamp' : 'seatOpen'))}">+</button>` : `<button class="pseat lock" data-seatlock title="${esc(t('seatCamp', G.S.party.length + k + 1))}">${img('ic_key', '', 2)}<small>${esc(t('campShort', G.S.party.length + k + 1))}</small></button>`).join('');
    }
    const chips = el.children, rate = G.reviveRate ? G.reviveRate() : 1;
    setTitle(el, t('partyHint'));
    units.forEach((u, i) => {
      const c = chips[i]; if (!c) return;
      const down = u.down > 0, k = Math.max(0, Math.min(1, u.hp / (u.max || 1)));
      setClass(c, 'down', down);
      setClass(c, 'low', !down && k < 0.35);
      // a hit shows as a red flash on the chip
      if (c._k != null && k < c._k - 0.02 && !down) pulse(c, [{ background: '#ff3b3b', transform: 'translateY(-2px)' }, { transform: 'none' }], 300);
      c._k = k;
      if (!c._u) { c._u = c.querySelector('u'); c._t = c.querySelector('b'); }
      setW(c._u, down ? 0 : k * 100);
      setText(c._t, down ? Math.ceil(u.down / rate) + 's' : '');
      // (an upgrade just put on: a little ▲)
      setClass(c, 'gotUp', !!(UI._chipUp && performance.now() - (UI._chipUp[u.who] || -1e9) < 1800));
    });
  }
  function bindPartyHud() {
    $('#partyHud').addEventListener('click', e => {
      // (4.0: in a Siege the recruits come at the camps: a seat says where; outside one the Tavern still takes them on)
      if (e.target.closest('[data-seat]')) { G.Audio.unlock(); if (G.inSiege()) { UI.toast(esc(t('seatOpenCamp')), '', 'h_knight', { p: 2 }); return; } if (G.enterTown()) UI.townOpen('tavern', 'tavern'); else UI.toast(esc(t('townNo')), '', 'ic_tomb', { p: 2 }); return; }
      if (e.target.closest('[data-seatlock]')) { if (G.inSiege()) UI.toast(esc(t('seatCampTip')), '', 'h_knight', { p: 2 }); else UI.teamCard(); return; }
      const c = e.target.closest('.pchip'); if (!c) return;
      const who = +c.dataset.who;
      if (G.reviveTap(who)) { G.Audio.click(0, false); return; }
      // a standing unit: open their page in the Party tab
      selWho = who; selGear = null; tw.who = who;
      // (QoL: between fights a tap walks straight to their gear at the Forge)
      if (G.R.town || (!G.R.boss && !G.R.inv && G.enterTown())) UI.townOpen('forge'); else UI.toast(esc(t('chipTown')), '', 'ic_sword', { p: 2 });
    });
    $('#btnFold').addEventListener('click', () => { $('#app').classList.toggle('fold'); $('#btnFold').textContent = $('#app').classList.contains('fold') ? '▴' : '▾'; setTimeout(() => G.Stage && G.Stage.resize && G.Stage.resize(), 0); });
  }
  UI.unfold = function () { if ($('#app').classList.contains('fold')) { $('#app').classList.remove('fold'); $('#btnFold').textContent = '▾'; setTimeout(() => G.Stage && G.Stage.resize && G.Stage.resize(), 0); } };

  const NAV = [{ id: 'upg', icon: 'ic_rune', k: 'tab_upg' }, { id: 'town', icon: 'ic_town', k: 'tab_towndir' }, { id: 'set', icon: 'ic_gear', k: 'tab_set' }];
  function buildTabs() {
    const nav = $('#tabs');
    nav.classList.add('slim');
    nav.innerHTML = NAV.map(x => `<button class="tab" data-tab="${x.id}" aria-label="${esc(t(x.k))}" title="${esc(t(x.k))}">${img(G.SPR.defs[x.icon] ? x.icon : 'ic_tomb', '', 3)}<b>${esc(t(x.k))}</b><span class="dot" hidden></span></button>`).join('');
    if (nav._bound) return;
    nav._bound = true;
    nav.addEventListener('click', e => {
      const b = e.target.closest('.tab'); if (!b) return;
      const id = b.dataset.tab;
      G.Audio.unlock();
      UI.unfold();
      if (id === 'town') {
        if (G.R.town) { if (tab === 'set') { tab = 'upg'; UI.render(); } return; }
        if (!G.enterTown()) { G.Audio.error(); UI.toast(esc(t('townNo')), '', 'ic_tomb', { p: 2 }); }
        return;
      }
      if (id === 'upg' && G.R.town) { G.leaveTown(); tab = 'upg'; UI.render(); return; }
      UI.go(id);
    });
  }
  UI.go = function (id) {
    if (UI.unfold) UI.unfold();
    ascArm = 0; resetArm = 0;
    if (!TAB_BLD[id]) {
      if (id === 'set' && wtab) UI.townClose(true);
      tab = id === 'set' ? 'set' : 'upg';
      G.S.seen.tabs[tab] = 1;
      UI.render();
      $('#tabBody').scrollTop = 0;
      return;
    }
    // any other page: walk into town and open its building
    if (!G.R.town && !G.enterTown()) { G.Audio.error(); UI.toast(esc(t('townNo')), '', 'ic_tomb', { p: 2 }); return; }
    UI.townOpen(TAB_BLD[id], id);
  };

  function bindHud() {
    // (phones have less to spare: a smaller Horde at most)
    if (window.innerWidth < 700) G.TUNE.mobMax = Math.min(G.TUNE.mobMax, 750);
    bindTown();
    $('#btnTown').addEventListener('click', () => { G.Audio.unlock(); if (G.R.town) G.leaveTown(); else if (!G.enterTown()) { G.Audio.error(); UI.toast(esc(t('townNo')), '', 'ic_tomb', { p: 2 }); } });
    G.on('town', on => {
      // QoL: leave town from inside a building and the next visit opens it again (not while the tutorial walks you)
      if (!on) { PF().resume = tw.id || null; UI.townClose(true); }
      document.getElementById('app').classList.toggle('inTown', on); if (tab === 'set') tab = 'upg'; UI.render();
      if (on && PF().resume && G.S.tut < 0 && bldOpen(PF().resume)) { const id = PF().resume; setTimeout(() => { if (G.R.town && !tw.id && $('#modal').hidden) UI.townOpen(id); }, 0); }
    });
    bindSwipe();
    // a finger down on the panel: nothing there re-sorts or rebuilds under it
    $('#panel').addEventListener('pointerdown', () => { UI._panelDown = true; });
    window.addEventListener('pointerup', () => { UI._panelDown = false; });
    window.addEventListener('pointercancel', () => { UI._panelDown = false; });
    // the gold rate opens where the gold comes from
    const rt = $('#panel .rates'); if (rt) { rt.setAttribute('role', 'button'); rt.tabIndex = 0; rt.title = t('gpsTip'); rt.addEventListener('click', () => UI.goldBreakdown()); rt.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); UI.goldBreakdown(); } }); }
    $('#realmBox').addEventListener('click', () => { if (G.S.hero && G.S.hero.cls) UI.worldMap(); });
    $('#realmBox').addEventListener('keydown', e => { if (e.key !== 'Enter' && e.key !== ' ') return; e.preventDefault(); e.stopPropagation(); if (G.S.hero && G.S.hero.cls) UI.worldMap(); });
    $('#btnSound').addEventListener('click', () => { G.S.set.sound = G.S.set.sound ? 0 : 1; G.Audio.unlock(); G.Audio.apply(); UI.update(true); });
    $('#btnMusic').addEventListener('click', () => { G.S.set.music = G.S.set.music ? 0 : 1; G.Audio.unlock(); G.Audio.apply(); UI.update(true); });
    $('#btnSound img').src = ic('ic_note', 3);
    $('#btnTown img').src = ic(G.SPR.defs.ic_town ? 'ic_town' : 'ic_tomb', 3);
    // 2.4: every bar at the bottom says what it is: an icon, and a tip on hover
    $$('[data-mico]').forEach(im => { im.src = ic(im.dataset.mico, 2); });
    [['#bossWrap', 'tipClear'], ['#hpWrap', 'tipHp'], ['#chestWrap', 'tipChest'], ['#comboWrap', 'tipCombo'], ['#btnAbil', 'tipAbil']].forEach(([sel, k]) => { const el = $(sel); if (el) el.title = t(k); });
    $('#btnMusic img').src = ic('ic_echo', 3);
    $('#btnFight').addEventListener('click', () => { G.Audio.unlock(); G.startBoss(); });
    $('#btnRetreat').addEventListener('click', () => {
      // (3.6: on a touch screen the first tap only arms it: it sits a thumb away from the powers)
      const b = $('#btnRetreat');
      if (matchMedia('(pointer: coarse)').matches && !b._arm) { b._arm = 1; b.classList.add('arm'); b.textContent = t('retreatSure'); clearTimeout(b._armT); b._armT = setTimeout(() => disarmRetreat(b), 2500); return; }
      disarmRetreat(b);
      if (G.R.rift) G.riftEnd(false, 'left'); else G.fleeBoss();
    });
    // (4.0: the campaign's Rift button went: Rifts are off in a Siege; the Rift Gate holds the Daily Siege)
    $('#btnAbil').addEventListener('click', () => { G.Audio.unlock(); if (!G.castAbility()) G.Audio.error(); });
  }

  function bindKeys() {
    window.addEventListener('keydown', e => {
      const tg = e.target;
      if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.isContentEditable)) return;
      // Ctrl+C copies, it doesn't Mend
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // 4.0: a run screen (cards, the loot moment, camp, doors: js/run_ui.js) claims its keys first (a capture listener
      // that calls preventDefault); while one holds the field, the field's own keys rest
      if (e.defaultPrevented) return;
      if (G.runUI && G.inSiege && G.inSiege() && G.runHeld && G.runHeld() && !G.R.town && e.code !== 'Escape' && e.code !== 'KeyT') return;
      // QoL, in town: 1–9, 0, − open a building; ← → the next one; Shift+← → its tabs
      if (G.R.town && !G.uiBusy() && !(tg && tg.tagName === 'SELECT')) {
        const ki = e.code === 'Minus' || e.code === 'NumpadSubtract' ? 10 : /^(Digit|Numpad)[0-9]$/.test(e.code) ? (+e.code.slice(-1) + 9) % 10 : -1;
        if (ki >= 0 && !e.repeat) { const id = BLD_ORDER[ki]; if (id) { e.preventDefault(); G.Audio.unlock(); if (tw.id !== id) UI.townOpen(id); } return; }
        if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') { e.preventDefault(); const d = e.code === 'ArrowRight' ? 1 : -1; if (e.shiftKey && tw.id) UI.townSub(d); else UI.townStep(d); return; }
      }
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') {
        if (tg && tg.tagName === 'BUTTON' && e.code !== 'Space') return;
        e.preventDefault();
        // a held key repeats at Steady Hand's rate (none without it)
        if (e.repeat) UI._holdKeyT = performance.now();
        if (e.repeat) { const hr = G.D.holdRate || 0; if (!G.S.set.hold || hr <= 0 || performance.now() - (UI._holdT || 0) < 1000 / hr) return; UI._holdT = performance.now(); }
        G.Stage.keyClick();
      } else if (e.code === 'KeyE' || e.code === 'KeyF') { G.Stage.keyChest(); }
      else if (e.code === 'KeyB') { G.startBoss(); }
      else if (/^Digit[1-3]$/.test(e.code) && !$('#perks').hidden && !G.runUI) {
        // 3.0: 1, 2, 3 pick a level-up card
        const c = $$('#perks [data-perk]')[+e.code.slice(5) - 1];
        if (c && G.pickPerk(c.dataset.perk)) { G.Audio && G.Audio.buy(); UI.update(true); }
      }
      else if (e.code === 'KeyV') { if (!G.uiBusy() && G.overdrive && !G.overdrive('key')) G.Audio.error(); }
      else if (e.code === 'KeyQ') { G.castAbility(); }
      else if (e.code === 'KeyT') { if (G.uiBusy()) return; if (G.R.town) G.leaveTown(); else if (!G.enterTown()) { G.Audio.error(); UI.toast(esc(t('townNo')), '', 'ic_tomb', { p: 2 }); } }
      else if (e.code === 'Escape' && !$('#modal').hidden && $('#modal').dataset.locked !== '1') { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; }
      else if (e.code === 'Escape' && G.R.town && !G.uiBusy()) { if (!$('#townWin').hidden) UI.townClose(); else G.leaveTown(); }
      else if (e.code === 'KeyZ') { if (!G.uiBusy()) G.usePower('smite'); }
      else if (e.code === 'KeyX') { if (!G.uiBusy()) G.usePower('ward'); }
      else if (e.code === 'KeyC') { if (!G.uiBusy()) G.usePower('mend'); }
    });
  }

  // ---------- Events ----------
  function listen() {
    G.on('achievement', a => { UI.toast(`<span>${esc(t('achievement'))}: <b>${esc(L(a.name))}</b></span>`, 'ach', 'ic_trophy', { k: 'ach' }); dirtyTab('deeds'); });
    // 4.0 (js/ach.js): a run Deed done mid-run says so; what a Deed opens says when (a Deed done in a Siege opens it from
    // the next one). Achievements already had their toast above: only what they open is added. A thing opened by no Deed
    // (the Golden Button's recipe) has its own line
    const unlWhen = () => (G.inSiege && G.inSiege() ? t('unlNext') : t('unlNow'));
    const unlLine = un => (un || []).slice(0, 3).map(u => esc(u && u.name ? u.name : String(u))).join(', ');
    G.on('deed', (d, un) => {
      if (!d) return;
      dirtyTab('deeds');
      const opens = un && un.length ? ` · <span class="unl">${esc(t('unlOpens', ''))}${unlLine(un)} <small>(${esc(unlWhen())})</small></span>` : '';
      if (d.ach) { if (un && un.length) UI.toast(`<span><b>${esc(t('unlTitle'))}</b> · <span class="unl">${unlLine(un)} <small>(${esc(unlWhen())})</small></span></span>`, 'ach', 'ic_key', { k: 'unl' }); return; }
      UI.toast(`<span>${esc(t('deedDone'))}: <b>${esc(L(d.name))}</b>${opens}</span>`, 'ach', 'ic_trophy', { k: 'deed' });
    });
    G.on('unlock', (kind, id, deed) => { if (deed) return; UI.toast(`<span><b>${esc(t('unlTitle'))}</b> · ${esc(G.unlockName ? G.unlockName(kind, id) : id)}</span>`, 'ach', 'ic_key', { k: 'unl' }); dirtyTab('buttons'); });
    G.on('questDone', q => UI.toast(`<b>${esc(t('questDone'))}</b>`, '', 'ic_scroll', { k: 'quest', p: 0 }));
    // (4.0: land stars are completion marks: no bonus line)
    G.on('landStar', (i, bit) => { zoneKey = ''; UI.toast(`<span><b style="color:#ffd84a">\u2605 ${esc(G.REALMS[i].name)} · ${esc(t('starName_' + bit))}</b></span>`, 'ach', 'ic_star', { k: 'star' }); });
    // (a new land: the field's own title card names it and its rule; no toast on top of it)
    G.on('potion', p => UI.toast(`<span>${esc(t('potionDrink', L(p.name)))} <b>${esc(p.short)} ${G.S.pots[p.id]}/${G.D.potCap}</b></span>`, '', 'pot_' + p.id, { k: 'potion', p: 0 }));
    G.on('jackpot', (m, gold) => UI.toast(`<b>${esc(t('jpToast', fmt(gold)))}</b>`, 'ach', 'ic_jackpot'));
    G.on('chestOpen', loot => {
      if (loot.source === 'offline') return;
      if (!loot.items.length) return; // a little chest of coin
      const top = loot.items.reduce((a, b) => (b.it.r > a.it.r ? b : a), loot.items[0]);
      if (top.it.r >= 4 && (top.isNew || top.it.r >= 6)) UI.banner(top.it);
      // (3.6: a first find is news from blue up; the commoner ones show as NEW in the Forge and the Museum)
      else if (top.isNew && top.it.r >= 2) UI.toast(`<span style="color:${G.RARITIES[top.it.r].color}">${esc(L(top.it.name))}</span>&nbsp;<b>${esc(t('newPet'))}</b>`, '', 'it_' + top.it.id, { k: 'new', p: 0 });
      dirtyTab('coll'); dirtyTab('quests');
    });
    G.on('bossWin', (rew) => {
      dirtyTab('quests'); dirtyTab('deeds');
      // 3.0: a land's lord falls for the first time: its chapter of the story (4.0: after the camp and the doors)
      if (rew && rew.lord && !G.R.rift) {
        const li = G.realmIndex(rew.d), sn = G.S.seen = G.S.seen || {}; sn.ch = sn.ch || {};
        const slot = G.runSlot && G.inSiege() ? G.runSlot(rew.d) : li;
        if (!sn.ch[li]) { sn.ch[li] = 1; whenFree(() => UI.chapter(li, slot), { dir: true, secs: 5, delay: 2000 }); }
      }
    });
    // 3.0: a wipe says why, in one line, and what to do about it
    G.on('wipe', (from, to, rift, boss) => {
      const S = G.S, h = S.hero;
      let k = 'wipeWhy_up';
      if (G.partySlots && G.partySlots() > S.party.length) k = 'wipeWhy_seat';
      // (4.0: THE ▲ rule, for anyone in the party: G.bagUps)
      else if (G.bagUps ? G.bagUps().total > 0 : h.bag.some(g => { const sl = G.slotOf(g.id); return G.powerWith(sl, g, -1) > G.powerWith(sl, h.eq[sl], -1); })) k = 'wipeWhy_gear';
      else if (boss) k = 'wipeWhy_boss';
      // (when the run is over the tip goes in its card instead: one place, not a toast behind it)
      UI._wipeTip = { k, at: performance.now() };
      // (and in the tutorial the coach does the teaching)
      if (!(G.S.tut >= 0)) setTimeout(() => { if (performance.now() - (UI._runOverAt || -1e9) > 4000) UI.toast(`<span><b>${esc(t('wipeWhy'))}</b> ${esc(t(k))}</span>`, '', 'ic_skull', { k: 'wipe' }); }, 1800);
    });
    G.on('pull', res => showPull(res));
    G.on('buy', (kind) => { if ((kind === 'hero' && curTab() === 'heroes') || (kind === 'upg' && curTab() === 'upg') || (kind === 'node' && curTab() === 'stars') || (kind === 'legacy' && curTab() === 'hall')) UI.update(true); if ((kind === 'node' && curTab() === 'stars') || (kind === 'legacy' && curTab() === 'hall')) UI.render(); });
    // 4.0: a run's end (G.runEnd emits 'ascend'): the run summary is run_ui's; here the panel and the town catch up.
    // A save with no Warden (a reset) goes back to the setup
    G.on('ascend', () => { upDirty = true; UI.render(); if (!G.S.hero.cls) setTimeout(() => UI.newSiege({ boot: 1 }), 400); });
    G.on('build', () => { pingT = 0; dirtyTab('towndir'); });
    // 3.4: BUILD YOUR TEAM: when a seat opens (and from a locked seat on the party bar), a big card shows the five
    // classes and their roles, with a straight way to the Tavern
    UI.teamCard = function (slot) {
      if (!$('#modal').hidden || G.R.boss) { setTimeout(() => UI.teamCard(slot), 1500); return; }
      const S = G.S, n = G.partySlots ? G.partySlots() : 0, open = n > S.party.length;
      const m = UI.modal(t('teamTitle'), `<div class="teamCard">
        <p class="story">${esc(t('teamText'))}</p>
        <div class="teamRow">${G.CLASSES.map((c, i) => `<div class="teamCls" style="animation-delay:${0.08 * i}s">${img(c.spr, '', 6)}<b>${esc(L(c.name))}</b><small class="r_${G.ROLES[c.id]}">${esc(G.ROLE_NAMES[G.ROLES[c.id]])}</small></div>`).join('')}</div>
        <p class="note">${esc(t(open ? 'teamOpen' : 'teamNext', G.PARTY_AT[Math.min(2, n)] + 1))}</p></div>`,
        open ? [{ label: t('teamGo'), cls: 'gold', fn: () => { if (G.enterTown()) UI.townOpen('tavern', 'tavern'); } }, { label: t('later') }] : [{ label: t('close') }]);
      G.Audio && G.Audio.levelUp && G.Audio.levelUp();
      return m;
    };
    // (4.0: in a Siege a seat opens at a camp, whose recruits fill it there: no card)
    G.on('slotOpen', slot => { if (!(G.inSiege && G.inSiege())) whenFree(() => UI.teamCard(slot), { dir: true, secs: 4, delay: 1600 }); });
    // 3.4: a huge plate at the start: YOU CAN HOLD SPACE (on a phone: HOLD THE BUTTON). It goes once the
    // player has held for a second and a half, and comes back each session until they have.
    // 3.6: it waits for the tutorial's first step (one instruction at a time), shows for 12 s at most, sits where the
    // field is free (never on the Button, the coach, a title card or a card at the top) and steps aside for them.
    UI.holdPlate = function () {
      const S = G.S;
      if ((S.seen && S.seen.hold) || $('#holdPlate')) return;
      // (the first step of the tutorial says "press the Button": the plate comes after it)
      if (S.tut === 0 || !(S.hero && S.hero.cls) || !$('#intro').hidden) { clearTimeout(UI._holdTm); UI._holdTm = setTimeout(UI.holdPlate, 1500); return; }
      const touch = matchMedia('(pointer: coarse)').matches;
      const el = document.createElement('div');
      el.id = 'holdPlate'; el.className = 'away';
      el.innerHTML = `<div class="hpIn"><small>${esc(t('holdYouCan'))}</small><b>${esc(t(touch ? 'holdTouch' : 'holdKey'))}</b>
        <div class="hpArt">${touch ? `<img class="hpFinger" src="${ic('ic_finger', 6)}" alt="">` : `<span class="hpKey">SPACE</span>`}</div>
        <p>${esc(t('holdWhy'))}</p></div>`;
      $('#stageWrap').appendChild(el);
      let held = 0, life = 0, n = 0, lastT = performance.now();
      const iv = setInterval(() => {
        if (!el.isConnected) { clearInterval(iv); return; }
        // (real seconds: a busy frame stretches the ticks, not the plate's time)
        const nowT = performance.now(), dt = Math.min(1, (nowT - lastT) / 1000); lastT = nowT;
        if (S.seen && S.seen.hold) { el.classList.add('out'); clearInterval(iv); setTimeout(() => el.remove(), 600); return; }
        const on = (G.Stage.isHolding && G.Stage.isHolding()) || performance.now() - (UI._holdKeyT || 0) < 250;
        held = on ? held + dt : Math.max(0, held - dt / 2);
        // where it may sit, looked at three times a second
        let spot = el._spot;
        if (n++ % 3 === 0 || on) spot = el._spot = holdSpot(el);
        // (4.0: and while a run screen holds the field: the loot moment, a card, the camp, the doors)
        const away = !!(!spot || G.uiBusy() || G.R.town || G.S.fallen || (G.inSiege() && G.runHeld && G.runHeld()));
        if (away !== el.classList.contains('away')) { el.classList.toggle('away', away); if (!away && !el._popped) { el._popped = 1; el.classList.add('pop'); } }
        if (!away && el._top !== spot) { el._top = spot; el.style.top = spot + 'px'; }
        el.style.setProperty('--hk', Math.min(1, held / 1.5));
        setClass(el, 'on', !!on);
        if (!away) life += dt;
        // (12 s on screen at most; one that found no free spot for a minute tries again next session)
        if (held >= 1.5 || life > 12 || (n > 600 && life < 1)) {
          if (held >= 1.5) { S.seen.hold = 1; G.dirty && G.dirty(); G.Audio && G.Audio.levelUp && G.Audio.levelUp(); el.classList.add('done'); }
          el.classList.add('out'); clearInterval(iv); setTimeout(() => el.remove(), 600);
        }
      }, 100);
    };
    // the plate's place: under the top HUD and over the Button, or under the Button over the bottom HUD; null when
    // neither is free of the coach, a title card, a banner or a champion's card
    function holdSpot(el) {
      const w = $('#stageWrap'), box = el.firstElementChild; if (!w || !box) return null;
      const wr = w.getBoundingClientRect(), h = box.offsetHeight || 80, bw = box.offsetWidth || 300;
      if (bannerBusy) return null;
      if (G.Stage.cardBusy && G.Stage.cardBusy()) return null;
      let top = 8;
      for (const s of ['.hud.top .realm', '.hud.top .hudBtns', '#xpBar']) { const e = $(s); if (e && !e.hidden && e.offsetParent) top = Math.max(top, e.getBoundingClientRect().bottom - wr.top + 6); }
      // (in a boss fight it keeps under the boss's bar)
      if (G.R.boss) { const bb = bossBarRect(); if (bb) top = Math.max(top, bb.bottom - wr.top + 6); }
      const hb = $('.hud.bottom'), bottom = (hb ? hb.getBoundingClientRect().top : wr.bottom) - wr.top - 8;
      const br = btnRect(6);
      const bTop = br ? br.top - wr.top : wr.height * 0.4, bBot = br ? br.bottom - wr.top : wr.height * 0.6;
      const x0 = wr.left + (wr.width - bw) / 2, x1 = x0 + bw;
      const avoid = [];
      for (const s of ['#coach', '#champCard', '#toasts', '#perks']) { const e = $(s); if (e && !e.hidden && e.offsetParent !== null && (s !== '#toasts' || e.children.length)) avoid.push(e.getBoundingClientRect()); }
      const free = y => y >= top - 1 && !avoid.some(r => r.left < x1 && r.right > x0 && r.top < wr.top + y + h && r.bottom > wr.top + y);
      // over the Button (the middle of the free band), else under it
      const ups = [Math.round(Math.max(top, (top + bTop - h) / 2)), Math.round(top)].filter(y => y + h <= bTop);
      const downs = [Math.round(bBot + 4)].filter(y => y + h <= bottom);
      const y = ups.concat(downs).find(free);
      return y === undefined ? null : y;
    }
    G.on('classChosen', () => { clearTimeout(UI._holdTm); UI._holdTm = setTimeout(UI.holdPlate, 1200); });
    setTimeout(() => { if (G.S.hero && G.S.hero.cls) UI.holdPlate(); }, 3000);
    // 4.0: the run blessings went (their effects are Button rules and Power-shrine boons; the Run Setup is run_ui's), and
    // so did the 3.6 fall card: a fall's Continue and the run summary are js/run_ui.js's. With no run UI (run_ui missing)
    // the fall is given up after the BOOM, so the next Siege starts at once (TUNE.runAgainAuto): never a dead end.
    G.fallAsk = true;
    G.on('runOver', () => { UI._runOverAt = performance.now(); setTimeout(() => { if (G.S.fallen && !G.runUI && G.runGiveUp) G.runGiveUp(); }, 2600); });
    if (G.S.fallen) setTimeout(() => { if (G.S.fallen && !G.runUI && G.runGiveUp) G.runGiveUp(); }, 1500);
    G.on('gems', () => { const c = $id('gemChip'); if (c) { c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); } });
    G.on('quests', () => dirtyTab('quests'));
    G.on('questClaim', () => { if (curTab() === 'quests') UI.render(); });
    G.on('daily', () => { if (curTab() === 'quests') UI.render(); });
    G.on('journey', (st, got) => { UI.toast(`<span><b>${esc(t('journeyDone'))}</b> · ${esc(st.text)}</span>&nbsp;${rewIcons(got)}`, 'ach', 'ic_trophy', { k: 'journey' }); G.Audio && G.Audio.achievement(); if (curTab() === 'quests') UI.render(); });
    G.on('bounty', got => { UI.toast(`<span><b>${esc(t('bounty'))}</b> ✓</span>&nbsp;${rewIcons(got)}`, 'ach', 'ic_skull'); if (curTab() === 'quests') UI.render(); });
    G.on('evolve', id => {
      const E = G.EVOS[id];
      UI.bannerShow(`<div class="inner" style="color:#ffd84a"><h2>${esc(t('evoTitle'))}</h2><img class="ico" src="${ic(E.icon, 10)}" alt=""><p>${esc(E.name)}</p><p style="font-size:15px;color:#d8dce8">${esc(E.desc)}</p></div>`, 2600);
      G.Audio && G.Audio.achievement();
    });
    G.on('pets', () => { if (curTab() === 'pets') UI.render(); });
    G.on('ladder', () => { if (curTab() === 'ladder') updaters.ladder(); });
    G.on('net', () => { if (curTab() === 'ladder') updaters.ladder(); });
    G.on('cloudNewer', c => { const ask = () => { if ($('#modal').hidden) askCloud(c); else setTimeout(ask, 1500); }; setTimeout(ask, 1200); });
    G.on('pickup', (e, how, res) => {
      if (e.k === 'uq') { UI.bannerU(e.q, res && res.first); dirtyTab('coll'); dirtyTab('hero'); return; }
      if (e.k !== 'gear' || !res) return;
      // the big banner is for news: a first find, a divine, or an upgrade the Warden put on
      if (e.it.r >= 4 && (res.isNew || e.it.r >= 6 || (res.g && G.SLOTS.some(s => G.S.hero.eq[s] === res.g)))) UI.banner(e.it, res.g);
      else if (res.isNew && e.it.r >= 2) UI.toast(`<span style="color:${G.RARITIES[e.it.r].color}">${esc(L(e.it.name))}</span>&nbsp;<b>${esc(t('newPet'))}</b>`, '', 'it_' + e.it.id, { k: 'new', p: 0 });
      dirtyTab('coll');
    });
    G.on('riftEnd', r => {
      if (curTab() === 'rift') UI.render();
      if (r.win && r.lvl >= r.best && G.Net) G.Net.pushNow();
    });
    G.on('feed', () => { if (G.Net) setTimeout(() => G.Net.pushNow(), 1500); });
    G.on('crownTime', (d, secs) => {
      const N = G.Net, others = N ? N.entries.filter(e => !e.me && (e.ok) && e.cr && e.cr[d]) : [];
      const best = others.sort((a, b) => a.cr[d] - b.cr[d])[0];
      if (!best || secs < best.cr[d]) { UI.toast(`<b>${esc(t('crownTaken', G.bossName(d), secs))}</b>`, 'ach', 'ic_crown'); if (best) G.feed('crown', G.bossName(d)); }
      if (N) setTimeout(() => N.pushNow(), 1500);
    });
    G.on('first', k => {
      const f = G.FIRSTS.find(x => x[0] === k), N = G.Net;
      if (!f || !N || N.status !== 'online') return;
      // announce it only when no friend got there before you
      if (N.entries.length > 1 && !N.entries.some(e => !e.me && e.ok && e.fs && e.fs[k])) UI.toast(`<b>${esc(t('firstGot', f[1]))}</b>`, 'ach', 'ic_trophy');
      setTimeout(() => N.pushNow(), 2000);
    });
    G.on('rival', ev => UI.toast(esc(ev.up ? t('rivalUp', ev.name, ev.cat, ev.rank) : t('rivalDown', ev.name, ev.cat)), ev.up ? 'ach' : '', 'ic_crown', { k: 'rival', p: 0 }));
    // an upgrade put on: a ▲ on the wearer's chip; a toast only for the big ones (legendary up, a unique)
    G.on('gear', (g, equipped) => {
      if (!equipped) return;
      const S = G.S, who = [-1].concat((S.party || []).map((_, i) => i)).find(w => { const eq = G.eqOf ? G.eqOf(w) : null; return eq && G.SLOTS.some(sl => eq[sl] === g); });
      if (who != null) (UI._chipUp = UI._chipUp || {})[who] = performance.now();
      // (4.0: the rarity's colour, the rainbow for the ultra-rares, and who wears it with how much more power)
      if (g.r >= 4 || g.q) UI.toast(`<span>${esc(t('equipped'))}: ${UI.itemName(g)}${who != null ? ` <small>· ${esc(whoName(who))}</small>` : ''}</span>`, '', G.gearSpr(g), { k: 'equip', p: 0 });
    });
    // QoL: the bag filling up says so once (and again only after it's had room), since a full bag scraps the weakest
    G.on('gear', () => {
      const h = G.S.hero, full = h.bag.length >= G.TUNE.bagMax;
      if (full && !UI._bagFullSaid) { UI._bagFullSaid = true; setTimeout(() => UI.toast(`<span><b>${esc(t('bagFullT'))}</b> ${esc(t('bagFullToast'))}</span>`, '', 'ic_bag'), 600); }
      else if (h.bag.length < G.TUNE.bagMax - 3) UI._bagFullSaid = false;
    });
    G.on('levelUp', () => pulse($('#xpFill'), [{ background: '#ffffff' }, {}], 600));
    // (3.6: level-up points past the bank are picked for the player without a word: the XP bar shows what waits)
    // (THE BUTTON BROKE: the field's own title card says it, and the coach explains it the first time)
  }
  const dirty = {};
  function dirtyTab(id) { dirty[id] = true; }
  // 3.6: the Button (and the Warden at it, or the boss over it) on the screen, client px, padded: what nothing
  // that pops up may cover
  function btnRect(pad) {
    try {
      const St = G.Stage, b = St.buttonPoint(), k = St.scale ? St.scale() : 2;
      const c = UI._bsz || (UI._bsz = G.SPR.button('#e8413c', false, 0));
      const base = b.y + 24 * k, w = c.width * k * (G.R.boss ? 1.6 : 1), h = c.height * k + (G.R.boss ? 30 * k : 8 * k);
      pad = pad || 0;
      return { left: b.x - w / 2 - pad, right: b.x + w / 2 + pad, top: base + 4 * k - h - pad, bottom: base + 6 * k + pad };
    } catch (e) { return null; }
  }
  UI.btnRect = btnRect;

  // ---------- QoL: swipe between buildings on a phone ----------
  function bindSwipe() {
    const el = twEl(); if (!el) return;
    let sx = 0, sy = 0, st = 0, ok = false;
    el.addEventListener('touchstart', e => {
      const p = e.touches[0];
      // (not on anything that scrolls or slides sideways itself)
      ok = e.touches.length === 1 && !e.target.closest('.twNav, .twSubs, .seg, .flt, input, select, textarea, .starmap, .scrapSeg, .orbBar, .gmbSlots');
      if (ok) { sx = p.clientX; sy = p.clientY; st = performance.now(); }
    }, { passive: true });
    el.addEventListener('touchend', e => {
      if (!ok || !tw.id) return; ok = false;
      const p = e.changedTouches[0], dx = p.clientX - sx, dy = p.clientY - sy;
      if (performance.now() - st < 700 && Math.abs(dx) > 70 && Math.abs(dy) < Math.abs(dx) * 0.5) UI.townStep(dx < 0 ? 1 : -1);
    }, { passive: true });
  }
  // ---------- QoL: where the gold comes from ----------
  // the game counts every coin by its source (G.goldBySrc); a sample a second gives the last half minute's split
  const srcHist = [];
  const SRC_GROUP = { gps: 'gps', mob: 'mob', click: 'click', auto: 'click', chest: 'chest', spill: 'chest', boss: 'boss', champion: 'boss', drop: 'drop' };
  function sampleGold() {
    if (!G.goldBySrc) G.goldBySrc = {};
    const now = performance.now() / 1000;
    if (srcHist.length && now - srcHist[srcHist.length - 1].t < 1) return;
    srcHist.push({ t: now, v: Object.assign({}, G.goldBySrc) });
    while (srcHist.length > 31) srcHist.shift();
  }
  G.on('ascend', () => { srcHist.length = 0; });
  UI.goldBreakdown = function () {
    const D = G.D, a = srcHist[0], b = srcHist[srcHist.length - 1];
    const secs = a && b ? Math.max(1, b.t - a.t) : 0, by = {};
    let tot = 0;
    if (secs) for (const k in b.v) { const d = (b.v[k] || 0) - ((a.v[k]) || 0); if (d > 0) { const gk = SRC_GROUP[k] || 'other'; by[gk] = (by[gk] || 0) + d / secs; tot += d / secs; } }
    const rows = Object.keys(by).sort((x, y) => by[y] - by[x]).map(k => `<div class="gbRow"><span>${esc(t('gsrc_' + k))}</span><i><u style="width:${Math.max(2, Math.round(by[k] / tot * 100))}%"></u></i><b>${fmt(by[k], true)}${esc(t('perSec'))}</b><small>${Math.round(by[k] / tot * 100)}%</small></div>`).join('');
    const mul = [['gbGold', D.goldMult], ['gbDepth', D.depthMult], ['gbGarrison', D.gpsMult], ['gbFrenzy', D.buffGold]].filter(([, v]) => v && Math.abs(v - 1) > 1e-6)
      .map(([k, v]) => `<span>${esc(t(k))}</span><b>×${v >= 100 ? fmt(v) : v.toFixed(2)}</b>`).join('') + (G.odActive && G.odActive() ? `<span>${esc(t('odName'))}</span><b>×3</b>` : '');
    UI.modal(t('gbTitle'), `<p class="note">${esc(secs ? t('gbHint', Math.round(secs)) : t('gbWait'))}</p>
      ${rows ? `<div class="gbList">${rows}</div><p class="gbTot">${esc(t('total'))}: <b>${fmt(tot, true)}${esc(t('perSec'))}</b></p>` : ''}
      <div class="statList"><span>${esc(t('gbGarrisonNow'))}</span><b>${fmt(D.gps * (D.buffGold || 1), true)}${esc(t('perSec'))}</b><span>${esc(t('perClick'))}</span><b>${fmt(D.click, true)}</b>${mul}</div>
      <p class="note">${esc(t('gbMore'))}</p>`, [{ label: t('close'), cls: 'gold' }]);
  };

  // ---------- Update loop ----------
  let goalKey = '';
  let zoneKey = '';
  const goldHist = [];
  G.on('ascend', () => { goldHist.length = 0; });
  // The world map: every land, its zones and its three stars
  UI.worldMap = function () {
    UI.mapSeen = true;
    const S = G.S, here = G.realmIndex(S.depth), seen = Math.min(G.REALMS.length - 1, Math.floor(S.bestDepth / G.REALM_SIZE));
    const n = G.starCount ? G.starCount() : 0;
    const rows = G.REALMS.map((R_, i) => {
      const open = i <= seen || G.starsOf(i) > 0, rec = (S.lands && S.lands[i]) || { k: 0, s: 0 };
      const need = G.STAR_KILLS(i), st = rec.s | 0;
      const stars = [1, 2, 4].map(b => `<i class="${st & b ? 'on' : ''}" title="${esc(t('star_' + b, b === 2 ? fmt(need) : G.STAR_SWIFT))}">\u2605</i>`).join('');
      const head = i === 8 ? `<h3 class="wmHead">${esc(t('outerLands'))}</h3>` : '';
      if (!open) return head + `<div class="wmRow locked">${img(R_.fodder, '', 3, { dark: true })}<div><b>${esc(t('landLocked'))}</b><small>${esc(t('depth'))} ${i * G.REALM_SIZE + 1}–${(i + 1) * G.REALM_SIZE}</small></div><span class="lstars">${stars}</span></div>`;
      const cleared = S.bestDepth > i * G.REALM_SIZE + G.REALM_SIZE - 1;
      // the land you're in shows where you are now; the others how far you've ever got
      const zones = Array.from({ length: G.REALM_SIZE }, (_, zi) => R_.zones[G.ZONE_LOOK(zi)]).map((zn, zi) => { const d = i * G.REALM_SIZE + zi; const cls = i === here ? (zi < G.zoneOf(S.depth) ? 'done' : zi === G.zoneOf(S.depth) ? 'cur' : '') : d < S.bestDepth ? 'done' : ''; return `<span class="${cls} ${zi === G.REALM_SIZE - 1 ? 'lord' : ''}" title="${esc(zn)}"></span>`; }).join('');
      return head + `<div class="wmRow ${i === here ? 'here' : ''} ${cleared ? 'clear' : ''}">${img(R_.fodder, '', 3)}<div><b>${esc(R_.name)}${i === here ? ` <em>${esc(t('landHere'))}</em>` : ''}</b>
        <small>${esc(R_.rule)}: ${esc(R_.ruleDesc)}</small>
        <div class="wmZones">${zones}</div>
        <small>${esc(t('landKills', Math.min(rec.k | 0, need).toLocaleString('en-US'), Math.round(need).toLocaleString('en-US')))} · ${esc(R_.lordName)}</small></div><span class="lstars">${stars}</span></div>`;
    }).join('');
    UI.modal(t('worldMap'), `<p class="note">${esc(t('worldHint'))}</p><p class="note">${esc(t('starReqs', Math.round(G.STAR_KILLS(here)).toLocaleString('en-US'), G.STAR_SWIFT))}</p><p class="wmTotal">\u2605 ${n} / ${3 * G.REALMS.length} · +${+(n * G.STAR_BONUS * 100).toFixed(1)}%</p><div class="wmList">${rows}</div>`, [{ label: t('close') || 'Close', cls: '' }]);
  };
  function updateGoal() {
    const S = G.S, box = $id('goal');
    const on = !!(S.hero && S.hero.cls);
    setHid(box, !on);
    // the day's twist, and what it does
    const om = on ? G.omen() : null, tip = om ? t('omenLine', om.name) + ' · ' + om.desc : '';
    setText($id('omenLine'), tip);
    // (2.2: the omen lives in the land box's tooltip, off the field)
    setTitle($id('realmBox'), tip);
    // where you stand among friends, right on the play screen
    const N = G.Net, rl = $id('rivalLine');
    const list = on && N && N.entries.length > 1 ? N.sorted('depth') : [];
    const i = list.findIndex(e => e.me);
    setHid(rl, i < 0);
    if (i >= 0) {
      const up = list[i - 1], gap = up ? (up.depth || 0) - (list[i].depth || 0) : 0;
      setText(rl, up ? t('rivalAhead', i + 1, list.length, N.displayName(up) || t('anon'), gap === 1 ? t('rivalDepth1') : gap > 1 ? t('rivalDepths', gap) : fmt((up.power || 0) - (list[i].power || 0)) + ' ' + t('gearScore').toLowerCase()) : t('rivalTop', list.length));
    }
    if (!on) return;
    const p = G.Journey.progress();
    const key = (S.journey || 0) + '|' + p.st.text;
    if (key !== goalKey) {
      goalKey = key;
      box.innerHTML = `<b>${esc(t('goal'))}</b> <span>${esc(p.st.text)}</span> <em data-gp></em><i><u data-gb></u></i>`;
    }
    if (!box._gp || !box._gp.isConnected) { box._gp = box.querySelector('[data-gp]'); box._gb = box.querySelector('[data-gb]'); }
    setText(box._gp, fmt(p.cur) + '/' + fmt(p.need));
    setW(box._gb, p.cur / p.need * 100);
  }
  const rewIcons = got => got.map(([icon, n]) => `${img(icon, 'inl', 2)}${n > 1 ? fmt(n) : ''}`).join(' ');
  let perkKey = '';
  // (4.0: the card screen is js/run_ui.js's: this 3.x strip shows the run's card only when that screen is missing)
  function updatePerks() {
    const h = G.S.hero, box = $('#perks');
    const offer = h && h.cls && !G.runUI ? h.offer : null;
    const key = offer ? offer.join() + '|' + JSON.stringify(h.perks) : '';
    if (key !== perkKey) {
      perkKey = key;
      if (!offer) { box.hidden = true; box.innerHTML = ''; }
      else {
        box.innerHTML = `<h3>${esc(t('lvUp'))}</h3><div class="cards">${offer.map((id, i) => {
          if (id.startsWith('evo_')) {
            const E = G.EVOS[id.slice(4)];
            return `<button class="card evo" data-perk="${id}" style="animation-delay:${i * 0.07}s">${img(E.icon, '', 4)}<b>${esc(E.name)}</b><span class="lv">${esc(t('evoCard'))}</span><small>${esc(E.desc)}</small></button>`;
          }
          const P = G.PERKS[id], lv = h.perks[id] || 0;
          return `<button class="card" data-perk="${id}" style="animation-delay:${i * 0.07}s">${img(P.icon, '', 4)}<b>${esc(P.name)}</b><span class="lv">${esc(lv ? t('perkLv', lv + ' → ' + (lv + 1)) : t('perkNew'))}</span><small>${esc(P.desc)}</small></button>`;
        }).join('')}</div><p class="auto" data-auto></p>`;
        box._auto = null; box.hidden = false; box.dataset.shownAt = performance.now();
      }
    }
    if (offer) setText(box._auto || (box._auto = box.querySelector('[data-auto]')), (h.autoPerk ? t('perkAuto', Math.max(0, Math.ceil((G.TUNE.perkAuto || 12) - (h.offerT || 0)))) + ' · ' : '') + t('perkHint'));
  }
  // 3.6: the HUD's elements are looked up once (a tab's body is rebuilt on render and never kept here), and a
  // width, a height or a hidden flag is written only when it changes
  const E = {};
  const $id = id => { let e = E[id]; if (!e || !e.isConnected) e = E[id] = document.getElementById(id); return e; };
  const setPct = (e, prop, v) => { if (!e) return; v = Math.round(Math.max(0, Math.min(100, v)) * 10) / 10; const k = '_' + prop; if (e[k] !== v) { e[k] = v; e.style[prop] = v + '%'; } };
  const setW = (e, v) => setPct(e, 'width', v), setHgt = (e, v) => setPct(e, 'height', v);
  const setHid = (e, h) => { if (e && e.hidden !== !!h) e.hidden = !!h; };
  const setTitle = (e, s) => { if (e && e.title !== s) e.title = s; };
  const pulse = (e, kf, ms) => { if (e && e.animate) e.animate(kf, { duration: ms || 200, easing: 'ease-out' }); };
  UI._pulse = pulse;
  // the bag holds something better than what someone wears: looked at when the gear moves, not every second
  let upDirty = true, upT = 0;
  ['gear', 'pickup', 'chestOpen', 'recruit', 'ascend', 'town', 'salvage', 'equipBest'].forEach(k => G.on(k, () => { upDirty = true; }));
  function bagHasUp() {
    const S = G.S, now = performance.now();
    if (!upDirty && now - upT < 5000) return UI._up;
    upDirty = false; upT = now;
    // (4.0: THE ▲ rule, for anyone in the party)
    UI._up = !!(S.hero && S.hero.cls) && bagUps().total > 0;
    return UI._up;
  }
  // the level-up cards sit just above the bottom HUD: its height is watched, not read every update
  let hudObs = null;
  function watchHud() {
    const hb = document.querySelector('.hud.bottom'), w = $id('stageWrap');
    if (!hb || !w || hudObs) return;
    const put = () => { const hh = hb.offsetHeight + 8; if (hh !== UI._hudB) { UI._hudB = hh; w.style.setProperty('--hudB', hh + 'px'); } };
    if (typeof ResizeObserver !== 'undefined') { hudObs = new ResizeObserver(put); hudObs.observe(hb); }
    else hudObs = setInterval(put, 500);
    put();
  }
  let snapT = 0, lastFull = 0;
  UI.update = function (force) {
    const S = G.S, D = G.D, R = G.R;
    const now = performance.now();
    // under a window the HUD behind it only needs a slow refresh
    const covered = !$id('modal').hidden || !$id('intro').hidden;
    if (covered && !force && now - lastFull < 450) { if (G.Tut) G.Tut.update(); return; }
    lastFull = now;
    // (new icons are snapped by the MutationObserver; this catches the ones laid out late)
    if (now - snapT > 1000) { snapT = now; snapPixels(); }
    sampleGold();
    watchHud();
    // Settings → Reduce effects: the page's own pulses and glows rest (the field reads S.set.lowfx too)
    setClass(document.body, 'lowfx', !!S.set.lowfx);
    // the Town button: into town between fights, back to the field from it
    { const tb = $id('btnTown'); if (tb) { setText(tb._b || (tb._b = tb.querySelector('b')), R.town ? t('townBack') : t('townBtn')); const ok = G.townOk(); setClass(tb, 'dim', !R.town && !ok); setClass(tb, 'on', !!R.town);
      // it glows when the bag holds something better than what someone wears
      setClass(tb, 'glow', !R.town && ok && bagHasUp()); setTitle(tb, R.town ? t('townBackTip') : ok ? t('townTip') : t('townNo')); } }
    // (the Alchemist's prices follow the gold; the Forge redraws on what you do in it, never under your finger)
    if (R.town && tw.id === 'alch' && !tw.down && now - (UI._twT || 0) > 1500) { UI._twT = now; renderTown(); }
    // the gold number rolls toward the real value and bumps on a real gain
    const gShow = UI._gold == null ? S.gold : UI._gold + (S.gold - UI._gold) * 0.45;
    if (UI._goldLast != null && S.gold - UI._goldLast > Math.max(1, UI._goldLast * 0.05) && now - (UI._bumpT || 0) > 400) { UI._bumpT = now; pulse($id('goldNum'), [{ transform: 'scale(1.12)', color: '#fff3a0' }, { transform: 'none' }], 160); }
    UI._goldLast = S.gold;
    UI._gold = Math.abs(gShow - S.gold) < Math.max(1, S.gold * 0.001) ? S.gold : gShow;
    setText($id('goldNum'), fmt(UI._gold));
    // gold per second from everything (the Horde, clicks, the garrison), averaged over the last 10 seconds
    const nowS = now / 1000;
    if (!goldHist.length || nowS - goldHist[goldHist.length - 1][0] >= 1) { goldHist.push([nowS, S.goldTotal]); while (goldHist.length > 11) goldHist.shift(); }
    const g0 = goldHist[0], rate = goldHist.length > 2 && S.goldTotal >= g0[1] ? (S.goldTotal - g0[1]) / Math.max(1, nowS - g0[0]) : 0;
    UI._rate = Math.max(D.gps, rate);
    setText($id('gpsNum'), fmt(UI._rate, true));
    setText($id('clickNum'), fmt(D.click, true));
    // 4.0: the meta's three: Embers (town, Star Chart), Fame (the Hall of Fame), Gems; eggs when there are any
    setText($id('emberNum'), fmt(Math.floor(S.embers || 0)));
    setText($id('eggNum'), fmt(S.eggs));
    setText($id('fameNum'), fmt(Math.floor(S.fame || 0)));
    setText($id('gemNum'), fmt(S.gems || 0));
    const meta = metaOpen(S);
    setHid($id('emberChip'), !meta);
    setHid($id('eggChip'), !(S.eggs > 0 || Object.keys(S.pets).length));
    setHid($id('fameChip'), !meta);
    setHid($id('gemChip'), !(S.gems > 0 || S.seen.cont || meta));
    // NEW SIEGE in the panel, between Sieges (and never while a fall waits on its choice)
    { const sb = $id('siegeBtn'); setHid(sb, !!(S.run && S.run.on) || !!S.fallen || !(S.hero && (S.hero.cls || S.lastRun))); }
    // Pages opening up: a toast names the building that now holds them
    for (const d of TABS) {
      if (!d.unlock(S) || S.seen.tabs['_u_' + d.id]) continue;
      S.seen.tabs['_u_' + d.id] = 1;
      const bd = TAB_BLD[d.id];
      if (bd && !CUSTOM[d.id] && d.id !== 'hero' && d.id !== 'ladder' && BLDS[bd].subs[0] === d.id) UI.toast(`<span>${esc(t('unlocked', t('town_' + bd)))}</span>`, '', d.icon, { k: 'unlock', it: t('town_' + bd) });
    }
    // the panel's three buttons, and a mark on TOWN when something there wants you
    let canUpg = false;
    for (const u of G.UPGRADES) { const L_ = S.upg[u.id] || 0; if ((!u.max || L_ < u.max) && !u.secret && S.gold >= G.upgCost(u)) { canUpg = true; break; } }
    const pt = R.town && tab !== 'set' ? 'town' : tab;
    const nav = navBtns();
    for (const x of NAV) setClass(nav[x.id], 'on', x.id === pt);
    setClass(nav.upg, 'afford', canUpg);
    const ping = townPing();
    const td = nav.dot; if (td && td.hidden === !!ping) td.hidden = !ping;
    setClass($id('btnTown'), 'ping', !!ping && !R.town);
    const h = S.hero, on = !!(h && h.cls);
    // the field's HUD: hidden in town (the town has its own), so it rests there
    if (!R.town || force) updateField(S, D, R, h, on, force);
    if (G.Tut) G.Tut.update();
    setClass($id('btnSound'), 'off', !S.set.sound);
    setClass($id('btnMusic'), 'off', !S.set.music);
    // the panel's page (a phone's folded panel shows none of it)
    const ct = curTab(), folded = $id('app').classList.contains('fold') && !wtab;
    if (!folded || force) {
      if (dirty[ct]) { dirty[ct] = false; if (ct === 'coll' || ct === 'quests' || ct === 'deeds' || ct === 'towndir') { if (ct === 'deeds' || ct === 'towndir') UI.render(); else if (updaters[ct]) updaters[ct](true); } }
      if (updaters[ct]) updaters[ct](force);
    }
    if (R.town && tw.id) twFootLive();
  };
  // the panel's nav buttons (rebuilt with the tabs)
  let navC = null;
  function navBtns() {
    if (navC && navC.upg && navC.upg.isConnected) return navC;
    navC = {};
    for (const x of NAV) navC[x.id] = document.querySelector(`.tab[data-tab="${x.id}"]`);
    navC.dot = navC.town ? navC.town.querySelector('.dot') : null;
    return navC;
  }
  function updateField(S, D, R, h, on, force) {
    // in a Rift the HUD names the Rift's land, not the campaign's
    const hd = R.rift ? R.rift.d : S.depth, narrow = innerWidth < 600;
    setText($id('realmName'), G.realmName(hd));
    // where you are in this land: its zones, the last one the lord's
    const li = G.realmIndex(hd), z = G.zoneOf(hd);
    const zk = hd + '|' + (G.starsOf ? G.starsOf(li) : 0) + '|' + !!R.rift;
    if (zk !== zoneKey) {
      zoneKey = zk;
      let pips = '';
      for (let i = 0; i < G.REALM_SIZE; i++) pips += `<i class="${i < z ? 'done' : i === z ? 'cur' : ''} ${i === G.REALM_SIZE - 1 ? 'lord' : ''}"></i>`;
      $id('zonePips').innerHTML = pips;
      const n = G.starsOf ? G.starsOf(li) : 0;
      $id('landStars').innerHTML = [0, 1, 2].map(i => `<i class="${i < n ? 'on' : ''}">★</i>`).join('');
    }
    setHid($id('zonePips'), !!R.rift);
    // (a phone has the depth on the zone's line and no room for the zone's name)
    setText($id('zoneName'), R.rift ? t('riftName', R.rift.lvl) : narrow ? t('depthShort') + (S.depth + 1) : G.ZONE_NAME(S.depth));
    setTitle($id('zoneName'), R.rift ? '' : G.ZONE_NAME(S.depth));
    if (R.rift) setText($id('realmSub'), t('riftName', R.rift.lvl) + ' · ' + t('depth') + ' ' + (R.rift.d + 1));
    else setText($id('realmSub'), t('depth') + ' ' + (S.depth + 1));
    setW($id('chestMeter'), S.chestMeter / D.chestNeed * 100);
    const comboK = R.combo / (D.comboCap || 1);
    setW($id('comboMeter'), comboK * 100);
    setClass($id('comboWrap'), 'hot', comboK >= 1);
    const narrowBar = innerWidth <= 700;
    setText($id('comboText'), t(narrowBar ? 'comboLineShort' : 'comboLine', Math.floor(R.combo), (1 + R.combo * D.comboPer).toFixed(2)));
    setText($id('chestText'), t(narrowBar ? 'chestLineShort' : 'chestLine', Math.floor(S.chestMeter / D.chestNeed * 100), S.chests.length, D.slots));
    setClass($id('stageWrap'), 'fighting', !!R.boss);
    setClass($id('stageWrap'), 'evOn', !!R.ev);
    const bw = $id('bossWrap'), bt = $id('bossText'), bm = $id('bossMeter'), bf = $id('btnFight'), br = $id('btnRetreat');
    setHid($id('bossRow'), !on);

    if (on && R.inv && !R.boss) {
      // an invasion: hold it off until its herald comes, then slay the herald
      const V = G.INV_BY_ID[R.inv.k], hb = R.inv.boss ? R.mobs.find(m => m.id === R.inv.boss) : null;
      setW(bm, (hb ? Math.max(0, hb.hp / hb.max) : Math.min(1, R.inv.prog / R.inv.need)) * 100);
      setClass(bw, 'hp', !!hb); setClass(bw, 'weak', false); setClass(bw, 'rift', true); setClass(bw, 'enr', false); setClass(bw, 'waves', false);
      setText(bt, hb ? t('invHerald', V.bossName, Math.ceil(R.inv.t)) : t('invName', V.name, Math.floor(Math.min(R.inv.prog, R.inv.need)), R.inv.need, Math.ceil(R.inv.t)));
      setHid(bf, true); setHid(br, true);
    } else if (on && R.rift) {
      const r = R.rift, g = r.guard ? R.mobs.find(m => m.id === r.guard) : null;
      setW(bm, (g ? Math.max(0, g.hp / g.max) : Math.min(1, r.prog / r.need)) * 100);
      setClass(bw, 'hp', !!g); setClass(bw, 'weak', false); setClass(bw, 'rift', true); setClass(bw, 'enr', false); setClass(bw, 'waves', false);
      setText(bt, t('riftName', r.lvl) + ' · ' + Math.ceil(r.t) + 's · ' + (g ? t('riftGuardian') : Math.floor(Math.min(1, r.prog / r.need) * 100) + '%'));
      setHid(bf, true); setHid(br, false);
    } else if (on) {
      setClass(bw, 'rift', false);
      if (R.boss) {
        const k = Math.max(0, R.boss.hp / R.boss.max);
        setW(bm, k * 100);
        setClass(bw, 'hp', true); setClass(bw, 'waves', false);
        const tt = R.boss.enr > 0 ? t('enrageT', Math.ceil(R.boss.enr)) : Math.ceil(R.boss.t) + 's';
        // (the boss's own bar on the field names it; on a phone this row keeps only the clock)
        setText(bt, narrowBar ? tt : (R.boss.affix ? R.boss.affix.map(a => t('aff_' + a)).join(' ') + ' ' : '') + L(G.bossName(R.boss.d)) + ' · ' + tt);
        setClass(bw, 'enr', R.boss.enr > 0);
        setHid(bf, true); setHid(br, false);
      } else {
        setClass(bw, 'hp', false); setClass(bw, 'enr', false);
        const need = D.bossNeed;
        setW(bm, S.bossMeter / need * 100);
        const weak = G.mightRatio() < 1.35;
        // far too strong for new ground, with Torment to spare: say so
        const easy = !G.inSiege() && G.mightRatio() > 6 && S.depth >= S.bestDepth && (S.torment || 0) < G.tormentMax();
        const wave = Math.min(3, 1 + Math.floor(3 * S.bossMeter / need));
        const odds = R.bossReady && G.bossOdds ? G.bossOdds() : 1;
        // (3.6: two states: the boss is coming (or ready), or the waves before it; the odds only when they're poor)
        const oddsT = odds < 0.6 ? (narrow ? ' · ' + Math.max(1, Math.round(odds * 100)) + '%' : ' · ' + t('bossOdds', Math.max(1, Math.round(odds * 100)))) : '';
        const callIn = R.bossReady && S.set.autoBoss && R.bossIn != null ? Math.max(0, Math.ceil(R.bossIn + (odds >= 0.6 ? 0 : D.autoBoss ? 20 : 60))) : -1;
        const bn = L(G.bossName(S.depth));
        let txt;
        if (callIn >= 0) txt = (narrow ? t('bossInShort', bn, callIn) : t('bossIn', bn, callIn)) + oddsT;
        else if (R.bossReady) txt = (narrow ? t('bossReadyShort', bn) : t('bossReadyTo', bn, G.isLord(S.depth) ? G.realmName(S.depth + 1) : G.ZONE_NAME(S.depth + 1))) + oddsT;
        else txt = t('waveN', wave) + ' · ' + (narrowBar ? Math.floor(Math.min(S.bossMeter, Math.ceil(need))) + '/' + Math.ceil(need) : t('clearMeter', Math.floor(Math.min(S.bossMeter, Math.ceil(need))), Math.ceil(need)) + ' · ' + (weak ? t('hordeWeak') : easy ? t('tooEasy') : t('toBoss')));
        setText(bt, txt);
        setClass(bw, 'waves', true);
        setClass(bf, 'long', R.bossReady && odds < 0.6);
        setClass(bw, 'weak', weak && !R.bossReady);
        setHid(bf, !R.bossReady); setHid(br, true);
      }
    }
    if (br && br.hidden && br._arm) disarmRetreat(br);
    toastsYield();
    // the toasts step down out of the way of the boss bar, and of the tutorial's arrow, when they reach their corner
    { const ts = $id('toasts'), bb = R.boss ? bossBarRect() : null, pt = $id('pointer'); let top = '', block = false;
      if (ts && (bb || (pt && !pt.hidden))) {
        const wr = G.Stage.wrapRect ? G.Stage.wrapRect() : $id('stageWrap').getBoundingClientRect(), x0 = wr.right - 12 - Math.min(wr.width * (narrowUI() ? 0.6 : 0.7), narrowUI() ? 250 : 320);
        let y = 0;
        if (bb && bb.right > x0) y = bb.bottom - wr.top + 6;
        if (pt && !pt.hidden) { const a = pt.getBoundingClientRect(); if (a.right > x0 && a.left < wr.right && a.top - wr.top < (narrowUI() ? 50 : 54) + 80 && a.bottom > wr.top) y = Math.max(y, a.bottom - wr.top + 4); }
        // (stepped down that far it would sit on the Button: then the news waits for the arrow to go instead)
        const b = y ? btnRect(4) : null;
        if (b && b.right > x0 && b.left < wr.right && b.top - wr.top < y + 64 && b.bottom - wr.top > y) { block = true; y = 0; }
        if (y) top = Math.round(y) + 'px';
      }
      if (block !== toastBlock) { toastBlock = block; if (block) toastsYield(true); else if (toastQ.length && !toastTm) toastTm = setTimeout(pumpToasts, 300); }
      if (ts && ts._top !== top) { ts._top = top; ts.style.top = top; } }
    // Journey goal and today's omen
    updateGoal();
    // XP bar (and the level-up points waiting their turn) and level-up choices
    setHid($id('xpBar'), !on);
    if (on) {
      setW($id('xpFill'), h.xp / G.xpNeed(h.lvl) * 100);
      const nr = G.nextRank && G.nextRank(h.lvl), bank = Math.max(0, (h.perkPts || 0) - (h.offer ? 1 : 0));
      setText($id('xpText'), t('lvl') + ' ' + h.lvl + (bank > 0 ? ' · ' + t('perkBank', bank) : '') + (nr && !narrow ? ' · ' + t('rankNext', nr.lv, UI.rankText(nr)) : ''));
    }
    updatePerks();
    updatePartyHud();
    updateEventBar();
    updatePowers();
    setHid($id('hpRow'), !on);
    if (on) {
      const k = Math.max(0, h.hp / (D.heroHp || 1));
      setW($id('hpMeter'), k * 100);
      setW($id('hpTrail'), k * 100);
      setClass($id('hpWrap'), 'low', k < 0.35);
      setText($id('hpText'), R.btnDown > 0 ? t('btnBrokenFor', Math.ceil(R.btnDown)) : R.stun > 0 ? t('regroup') : t(narrowBar ? 'buttonHpShort' : 'buttonHp', fmt(Math.max(0, h.hp)), fmt(D.heroHp)));
      const ab = h.eq.ability, btn = $id('btnAbil');
      setHid(btn, !ab);
      if (ab) {
        const type = G.ITEM_TYPE[ab.id];
        if (btn._id !== ab.id) { btn._id = ab.id; btn.querySelector('img').src = ic('it_' + ab.id, 3); btn.title = L(G.ABILITIES[type].name) + ' (Q)'; }
        const cd = Math.max(0, R.abilCd), tot = G.ABILITIES[type].cd;
        setHgt($id('abilCd'), cd > 0 ? cd / tot * 100 : 0);
        setClass(btn, 'ready', cd <= 0);
      }
    }
    // Buffs
    const bb = !G.inSiege() && S.bless && G.BLESS_BY_ID && G.BLESS_BY_ID[S.bless];
    const bh = (bb ? `<span class="buff bless${bb.twist ? ' twist' : ''}" title="${esc(bb.desc)}">${img(G.SPR.defs[bb.icon] ? bb.icon : 'ic_star', '', 2)}${esc(bb.name)}</span>` : '') + S.buffs.map(b => `<span class="buff ${b.id}">${esc(t(b.id))} ${Math.ceil(b.t)}s</span>`).join('')
      + Object.keys(R.hb || {}).filter(k => R.hb[k] > 0).map(k => `<span class="buff ${k === 'hh' ? 'hunt' : 'storm'}">${esc(k === 'hh' ? G.UNIQUES.headhunter.name : L(G.ABILITIES[k].name))} ${Math.ceil(R.hb[k])}s</span>`).join('')
      + (R.shr && R.shr.t > 0 ? `<span class="buff shrine" style="--c:${G.SHRINES[R.shr.k].col}">${esc(t('shrineBuff', G.SHRINES[R.shr.k].name, Math.ceil(R.shr.t)))}</span>` : '');
    const bEl = $id('buffs');
    if (bEl._h !== bh) { bEl.innerHTML = bh; bEl._h = bh; }
  }
  // 3.6: where the boss's bar sits on the field (client px), as js/stage.js lays it out: centred, under whatever
  // HUD box is over its span, the name and the wounds lines under it
  function bossBarRect() {
    const St = G.Stage; if (!St || !St.size || !St.rect) return null;
    const sz = St.size(), S = sz.S, r = St.rect(), w = Math.min(sz.W - 20, 170), x = (sz.W - w) / 2;
    let y = Math.ceil(50 / S);
    for (const hb of St.hudBoxes ? St.hudBoxes() : []) if (hb.sel !== '.hud.bottom' && hb.sel !== '#toasts' && x < hb.x1 + 2 && x + w > hb.x0 - 2) y = Math.max(y, Math.ceil(hb.y1 + 8 / S));
    return { left: r.left + x * S, right: r.left + (x + w) * S, top: r.top + y * S, bottom: r.top + (y + 22) * S };
  }
  UI.bossBarRect = bossBarRect;
  // where the field's title cards show (client px), as js/stage.js puts them: centred, under the HUD (lower on a
  // narrow field); null when none is up (in a boss fight they go over the boss, under its bar)
  function cardRect() {
    const St = G.Stage; if (!St || !St.size || !St.rect || !(St.cardBusy && St.cardBusy()) || G.R.boss) return null;
    const sz = St.size(), S = sz.S, r = St.rect(), y = sz.H * (sz.W * S < 600 ? 0.37 : 0.27);
    return { left: r.left + (sz.W / 2 - 85) * S, right: r.left + (sz.W / 2 + 85) * S, top: r.top + (y - 10) * S, bottom: r.top + (y + 28) * S };
  }
  UI.cardRect = cardRect;
  // 3.6: the boss fight's ✕ on a touch screen takes two taps (it sits a thumb away from the powers)
  function disarmRetreat(b) { b._arm = 0; clearTimeout(b._armT); b.classList.remove('arm'); b.textContent = '✕'; }

  // what in town wants a visit: a building just opened, a finished quest or the daily gift, an empty
  // party seat, a star or a Garrison hire you can afford, a building you can build up
  function bldPing(id) {
    const S = G.S;
    if (!bldOpen(id)) return false;
    const f = BLDS[id].subs.find(x => !CUSTOM[x] && x !== 'hero' && x !== 'ladder');
    if (f && !S.seen.tabs[f]) return true;
    if (id === 'quests') return S.quests.some(q => q.done) || G.dailyAvailable();
    // (4.0: in a Siege the seats fill at camp)
    if (id === 'tavern') return !!(S.hero && S.hero.cls && !G.inSiege() && G.partySlots && G.partySlots() > S.party.length);
    if (id === 'temple') return hallCan();
    if (id === 'stars') return starCan();
    if (id === 'pets') return S.eggs >= 1;
    // (an upgrade in the bag for anyone in the party, or a full bag)
    if (id === 'forge') return bagUpsC().total > 0 || G.S.hero.bag.length >= G.TUNE.bagMax;
    return false;
  }
  // (4.0: built with Embers)
  const bldCanBuild = id => bldOpen(id) && G.bldLvl(id) < G.BLD_MAX && (G.S.embers || 0) >= G.bldCost(id);
  UI.bldPing = bldPing; UI.bldCanBuild = bldCanBuild;
  let pingT = 0, pingV = null;
  function townPing() {
    const now = performance.now();
    if (now - pingT < 500) return pingV;
    pingT = now; pingV = BLD_ORDER.find(id => bldPing(id)) || null;
    return pingV;
  }
  // ---------- Render tabs ----------
  const renderers = {}, updaters = {};
  function applyStatic() {
    $$('[data-i18n]').forEach(el => setText(el, t(el.dataset.i18n)));
    $$('[data-depth-label]').forEach(el => setText(el, t('depth')));
  }
  UI.render = function () {
    applyStatic();
    refs = {};
    // a fresh element per render, so the old tab's click handlers go with it
    const old = $('#tabBody'), body = old.cloneNode(false);
    old.replaceWith(body);
    // in town the panel lists the buildings; a page opened in one renders in its window (renderTown)
    const pt = G.R && G.R.town && tab !== 'set' ? 'towndir' : tab;
    const title = $('#tabTitle');
    title.innerHTML = `<span>${esc(t('tab_' + pt))}</span><small ${wtab ? '' : 'id="tabSub"'}></small>`;
    body.innerHTML = '';
    (renderers[pt] || (() => {}))(body);
    if (wtab && tw.id) renderTown(true);
    UI.update(true);
  };

  // Upgrades
  // QoL: buy ×1, ×10 or as many as you can afford; sort cheapest first; each row says how long until you can
  // afford it at this income; hold a row to keep buying
  function upgPlan(u, amt) {
    const S = G.S, L0 = S.upg[u.id] || 0, room = u.max ? Math.max(0, u.max - L0) : Infinity;
    if (!room) return { n: 0, c: 0 };
    let n = 0, c = 0;
    const want = amt === 'max' ? room : Math.min(room, amt);
    for (let i = 0; i < want && i < 1000; i++) {
      const ci = u.base * Math.pow(u.growth, L0 + i);
      if (amt === 'max' && n >= 1 && c + ci > S.gold) break;
      c += ci; n++;
      if (amt === 'max' && c > S.gold) break;
    }
    return { n, c };
  }
  function buyUpgN(id, n) { let k = 0; while (k < n && G.buyUpgrade(id)) k++; return k; }
  // how long until a price is in reach at this income ('' when it already is, or would take days)
  function eta(c) {
    const S = G.S, r = UI._rate || 0;
    if (S.gold >= c || r <= 0) return '';
    const s = (c - S.gold) / r;
    return s > 72 * 3600 ? '' : t('etaIn', G.fmtTime(Math.ceil(s)));
  }
  // hold a row: after a moment it buys again and again until it can't (a scroll or a lifted finger stops it)
  function holdBuy(list, sel, buy) {
    let tm = 0, iv = 0, row = null, did = false;
    const stop = () => { clearTimeout(tm); clearInterval(iv); tm = iv = 0; if (row) row.classList.remove('held'); row = null; };
    list.addEventListener('pointerdown', e => {
      const r = e.target.closest(sel); if (!r || e.button > 0) return;
      stop(); did = false; row = r;
      tm = setTimeout(() => { iv = setInterval(() => { if (!row || !row.isConnected) { stop(); return; } if (buy(row)) { did = true; row.classList.add('held'); } else stop(); }, 85); }, 420);
    });
    for (const k of ['pointerup', 'pointercancel', 'pointerleave']) list.addEventListener(k, stop);
    list.addEventListener('contextmenu', e => { if (e.target.closest(sel)) e.preventDefault(); });
    // (the click that ends a hold doesn't buy once more)
    list.addEventListener('click', e => { if (did) { did = false; e.stopPropagation(); } }, true);
  }
  renderers.upg = function (body) {
    const S = G.S, pf = PF(), amt = pf.upgAmt || 1, srt = pf.upgSort || 'def';
    let list = visUpg(S);
    if (srt === 'cost') {
      const k = u => (u.max && (S.upg[u.id] || 0) >= u.max ? Infinity : upgPlan(u, amt === 'max' ? 1 : amt).c);
      list = list.slice().sort((a, b) => k(a) - k(b));
    }
    body.innerHTML = `<div class="setRow autoInv"><span>${esc(t('autoInvest'))}<small>${esc(t('autoInvestHint'))}</small></span><button class="toggle ${S.set.autoInvest !== 0 ? 'on' : ''}" data-autoinv aria-pressed="${S.set.autoInvest !== 0 ? 'true' : 'false'}" aria-label="${esc(t('autoInvest'))}"></button></div>
      <button class="btn gold buyAll" data-buyall>${esc(t('buyAll'))}</button>
      <div class="upgBar"><span class="seg" data-uamt>${[1, 10, 'max'].map(a => `<button data-a="${a}" class="${a === amt ? 'on' : ''}">${a === 'max' ? 'MAX' : '×' + a}</button>`).join('')}</span>
        <span class="seg" data-usort>${['def', 'cost'].map(k => `<button data-s="${k}" class="${k === srt ? 'on' : ''}">${esc(t('upgSort_' + k))}</button>`).join('')}</span></div>
      <div class="list">${list.map(u => `
      <button class="row" data-u="${u.id}">
        <span class="ico">${img(u.icon, '', 4)}</span>
        <span class="info"><span class="name">${esc(L(u.name))}<span class="lv" data-lv></span></span><span class="desc">${esc(L(u.desc))}</span></span>
        <span class="cost">${img('ic_coin', '', 2)}<span data-cost></span><small class="eta" data-eta></small></span>
      </button>`).join('')}</div>
      <p class="note">${esc(t('holdBuyHint'))}</p>
      <p class="note keys">${esc(t('keysHint'))}</p>`;
    refs.rows = $$('.row', body).map(el => ({ el, u: G.UPGRADES.find(x => x.id === el.dataset.u), lv: el.querySelector('[data-lv]'), cost: el.querySelector('[data-cost]'), eta: el.querySelector('[data-eta]') }));
    refs.order = list.map(u => u.id).join();
    // 3.3: buy the cheapest affordable upgrade again and again until nothing's affordable
    body.querySelector('[data-buyall]').addEventListener('click', () => {
      G.Audio.unlock(); let n = 0;
      for (let k = 0; k < 300; k++) {
        const u = G.UPGRADES.filter(x => refs.rows.some(r => r.u === x) && !(x.max && (G.S.upg[x.id] || 0) >= x.max) && G.S.gold >= G.upgCost(x)).sort((a, b) => G.upgCost(a) - G.upgCost(b))[0];
        if (!u || !G.buyUpgrade(u.id)) break; n++;
      }
      if (n) { G.Audio.buy(); UI.toast(esc(t('buyAllDone', n)), '', 'ic_coin', { p: 2 }); UI.update(true); } else G.Audio.error();
    });
    body.querySelector('[data-autoinv]').addEventListener('click', () => { G.S.set.autoInvest = G.S.set.autoInvest === 0 ? 1 : 0; G.Audio.unlock(); UI.render(); });
    body.querySelector('[data-uamt]').addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b) return; pf.upgAmt = b.dataset.a === 'max' ? 'max' : +b.dataset.a; if (srt === 'cost') { UI.render(); return; } $$('[data-uamt] button', body).forEach(x => x.classList.toggle('on', x === b)); UI.update(true); });
    body.querySelector('[data-usort]').addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (!b) return; pf.upgSort = b.dataset.s; UI.render(); });
    const lst = body.querySelector('.list');
    const buyRow = r => { const u = G.UPGRADES.find(x => x.id === r.dataset.u), p = upgPlan(u, PF().upgAmt || 1); return p.n > 0 && G.S.gold >= p.c && buyUpgN(u.id, p.n) > 0; };
    holdBuy(lst, '.row', buyRow);
    lst.addEventListener('click', e => {
      const r = e.target.closest('.row'); if (!r) return;
      if (!buyRow(r)) shakeRow(r);
    });
    refs.count = list.length;
  };
  updaters.upg = function (force) {
    const S = G.S;
    if (!refs.rows) return;
    // (3.6: four times a second is plenty for prices; a buy or a render forces it)
    const now = performance.now();
    if (!force && now - (refs.updT || 0) < 240) return;
    refs.updT = now;
    if (visUpg(S).length !== refs.count) { UI.render(); return; }
    const amt = PF().upgAmt || 1;
    for (const r of refs.rows) {
      const L_ = S.upg[r.u.id] || 0;
      const maxed = r.u.max && L_ >= r.u.max;
      const p = upgPlan(r.u, amt), can = !maxed && p.n > 0 && S.gold >= p.c;
      setText(r.lv, t('lvl') + ' ' + L_ + (r.u.max ? '/' + r.u.max : ''));
      setText(r.cost, maxed ? t('max') : (p.n > 1 ? p.n + '× ' : '') + fmt(p.c));
      setText(r.eta, maxed || can ? '' : eta(p.c));
      setClass(r.el, 'maxed', maxed);
      setClass(r.el, 'can', can);
      setClass(r.el, 'cant', !maxed && !can);
    }
    const ba = $('[data-buyall]'); if (ba) setClass(ba, 'dim', !refs.rows.some(r => r.el.classList.contains('can')));
    // cheapest first: the order follows the prices, but never moves a row under a finger
    if ((PF().upgSort || 'def') === 'cost' && !UI._panelDown && performance.now() - (refs.ordT || 0) > 800) {
      refs.ordT = performance.now();
      const k = u => (u.max && (S.upg[u.id] || 0) >= u.max ? Infinity : upgPlan(u, amt === 'max' ? 1 : amt).c);
      const ord = visUpg(S).slice().sort((a, b) => k(a) - k(b)).map(u => u.id).join();
      if (ord !== refs.order) { const y = $('#tabBody').scrollTop; UI.render(); $('#tabBody').scrollTop = y; }
    }
  };
  function shakeRow(r) { r.classList.remove('shake'); void r.offsetWidth; r.classList.add('shake'); G.Audio.error(); }

  // Heroes
  function heroVisible(h, i) {
    const S = G.S;
    return (S.heroes[h.id] || 0) > 0 || S.goldTotal >= h.cost * 0.35 || i === 0;
  }
  renderers.heroes = function (body) {
    const S = G.S;
    const vis = G.HEROES.filter(heroVisible);
    const next = G.HEROES[vis.length];
    if (PF().hireAmt) buyAmt = PF().hireAmt;
    body.innerHTML = `
      <div class="sect">${esc(t('statsTitle'))}</div>
      <div class="statGrid">${G.POTIONS.map(p => `<div class="stat" data-p="${p.id}" title="${esc(L(p.name) + ': ' + L(p.desc))}">${img('pot_' + p.id, '', 2)}<b>${p.short}</b><span></span></div>`).join('')}</div>
      <p class="note" data-pothint></p>
      <div class="tabTitle" style="padding:6px 4px"><small>${esc(t('buyAmt'))}</small>
        <span class="seg" data-seg>${[1, 10, 100, 'max'].map(a => `<button data-a="${a}" class="${a === buyAmt ? 'on' : ''}">${a === 'max' ? 'MAX' : '×' + a}</button>`).join('')}</span></div>
      <div class="list">${vis.map(h => `
        <button class="row" data-h="${h.id}">
          <span class="ico">${img('h_' + h.id, '', 4)}</span>
          <span class="info"><span class="name">${esc(L(h.name))}<span class="count" data-n></span></span>
            <span class="desc" data-d></span><span class="bar"><i data-bar></i></span></span>
          <span class="cost">${img('ic_coin', '', 2)}<span data-cost></span><small class="eta" data-eta></small></span>
        </button>`).join('')}
        ${next ? `<div class="row locked"><span class="ico">${img('h_' + next.id, '', 4)}</span><span class="info"><span class="name">${esc(t('heroLocked'))}</span><span class="desc">${esc(t('heroLockedHint', fmt(next.cost * 0.35)))}</span></span><span></span></div>` : ''}
      </div>`;
    refs.rows = $$('.row[data-h]', body).map(el => ({ el, h: G.HEROES.find(x => x.id === el.dataset.h), n: el.querySelector('[data-n]'), d: el.querySelector('[data-d]'), bar: el.querySelector('[data-bar]'), cost: el.querySelector('[data-cost]'), eta: el.querySelector('[data-eta]') }));
    refs.stats = $$('.stat', body).map(el => ({ el, p: el.dataset.p, v: el.querySelector('span') }));
    refs.potHint = body.querySelector('[data-pothint]');
    refs.count = vis.length;
    body.querySelector('[data-seg]').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      buyAmt = b.dataset.a === 'max' ? 'max' : +b.dataset.a; PF().hireAmt = buyAmt;
      $$('[data-seg] button', body).forEach(x => x.classList.toggle('on', x === b));
      UI.update(true);
    });
    // (hold a row to keep hiring)
    holdBuy(body.querySelector('.list'), '.row[data-h]', r => !!G.buyHero(r.dataset.h, buyAmt));
    body.querySelector('.list').addEventListener('click', e => {
      const r = e.target.closest('.row[data-h]'); if (!r) return;
      if (!G.buyHero(r.dataset.h, buyAmt)) shakeRow(r);
    });
  };
  updaters.heroes = function () {
    const S = G.S, D = G.D;
    if (!refs.rows) return;
    if (G.HEROES.filter(heroVisible).length !== refs.count) { UI.render(); return; }
    for (const r of refs.rows) {
      const n = S.heroes[r.h.id] || 0;
      let amt = buyAmt === 'max' ? Math.max(1, G.heroMax(r.h)) : buyAmt;
      const c = G.heroCost(r.h, amt);
      const each = r.h.gps * Math.pow(2, G.heroMilestones(n)) * D.gpsMult * D.goldMult * D.depthMult * D.buffGold;
      const total = D.heroGps[r.h.id] ? D.heroGps[r.h.id] * D.buffGold : 0;
      setText(r.n, n ? '×' + n : '');
      const nextM = G.HERO_MILESTONES.find(m => m > n);
      const prevM = [0].concat(G.HERO_MILESTONES).filter(m => m <= n).pop();
      setText(r.d, fmt(each, true) + t('perSec') + ' ' + t('each') + (n ? ' · ' + t('total') + ' ' + fmt(total, true) + t('perSec') : '') + (nextM ? ' · ' + t('toMilestone', nextM - n) : ''));
      r.bar.style.width = nextM ? ((n - prevM) / (nextM - prevM) * 100) + '%' : '100%';
      setText(r.cost, (amt > 1 ? amt + '× ' : '') + fmt(c));
      setText(r.eta, S.gold >= c ? '' : eta(c));
      setClass(r.el, 'can', S.gold >= c);
      setClass(r.el, 'cant', S.gold < c);
    }
    for (const s of refs.stats) {
      const v = S.pots[s.p];
      setText(s.v, v + '/' + D.potCap);
      setClass(s.el, 'full', v >= D.potCap);
    }
    setText(refs.potHint, t('statsHint', D.potCap));
  };

  // Constellation
  renderers.stars = function (body) {
    const S = G.S;
    const width = Math.max(260, body.clientWidth - 24);
    const cell = Math.floor(Math.min(48, (width - 8) / 11));
    const cellY = Math.round(cell * 1.12);
    const mw = cell * 11 + 8, mh = cellY * 12 + 12;
    const pos = n => ({ x: 4 + (n.x + 5 + 0.5) * cell, y: 6 + (n.y + 5 + 0.5) * cellY });
    const nodeSize = Math.max(22, Math.round(cell * 0.72));
    let lines = '';
    for (const n of G.NODES) for (const r of n.req) {
      const a = pos(G.NODE_BY_ID[r]), b = pos(n);
      lines += `<line data-a="${r}" data-b="${n.id}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke-width="2"/>`;
    }
    // 4.0: the Star Chart is permanent and priced in Embers; the Observatory's level shows 8 / 16 / 24 / 32 / all 37 stars
    const vis = G.NODES.filter(n => G.nodeVisible(n)).length, ob = G.bldLvl('stars');
    body.innerHTML = `
      ${metaHead(EMB(), embersHave(), t('embers'), t('starsHint4'))}
      <p class="note starVis">${esc(ob ? t('starsVis', vis, G.NODES.length, ROMAN5[ob]) : t('starsNeedObs', fmt(G.BLD_COST[0])))}</p>
      <div class="detail" data-detail></div>
      <div class="starmap" style="width:${mw}px;height:${mh}px">
        <svg viewBox="0 0 ${mw} ${mh}" aria-hidden="true">${lines}</svg>
        ${G.NODES.map(n => { const p = pos(n); const sz = n.max === 1 && n.cost >= 150 ? nodeSize + 6 : nodeSize; return `<button class="node${sz > nodeSize ? ' big' : ''}" data-n="${n.id}" style="left:${p.x}px;top:${p.y}px;width:${sz}px;height:${sz}px;--c:${G.BRANCH_COLORS[n.br]}" aria-label="${esc(L(n.name))}"><i></i></button>`; }).join('')}
      </div>`;
    refs.nodes = $$('.node', body).map(el => ({ el, n: G.NODE_BY_ID[el.dataset.n], lbl: el.querySelector('i') }));
    refs.starVis = vis; refs.cur = body.querySelector('[data-cur]');
    refs.lines = $$('line', body);
    refs.detail = body.querySelector('[data-detail]');
    body.querySelector('.starmap').addEventListener('click', e => {
      const b = e.target.closest('.node'); if (!b) return;
      // a second click buys with a mouse; on touch screens only the Learn button does, so nothing is bought unseen
      if (selNode === b.dataset.n && !matchMedia('(pointer: coarse)').matches) { if (!G.buyNode(selNode)) G.Audio.error(); }
      selNode = b.dataset.n;
      renderDetail(true);
      if (refs.detail) refs.detail.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      UI.update(true);
    });
    renderDetail(true);
  };
  function renderDetail(full) {
    const n = G.NODE_BY_ID[selNode], S = G.S;
    if (!n || !refs.detail) return;
    const L_ = S.nodes[n.id] || 0, maxed = L_ >= n.max, avail = G.nodeAvailable(n), seen = G.nodeVisible(n);
    const c = G.nodeCost(n);
    // (a star the Observatory can't see yet: which level shows it)
    const needOb = () => { const i = G.NODES.indexOf(n); for (let k = 1; k <= G.BLD_MAX; k++) if (i < [0, 8, 16, 24, 32, 99][k]) return k; return G.BLD_MAX; };
    if (full || refs.detail.dataset.n !== n.id) {
      refs.detail.dataset.n = n.id;
      refs.detail.innerHTML = seen ? `<h3 style="color:${G.BRANCH_COLORS[n.br]}">${esc(L(n.name))} <span class="lv" data-lv style="font:8px var(--font-display);color:var(--dim)"></span></h3>
        <p>${esc(L(n.desc))}</p>
        <div class="act"><span class="reward">${img(EMB(), '', 2)}<span data-cost></span></span><button class="btn gold" data-buy>${esc(t('learn'))}</button></div>`
        : `<h3 style="color:var(--dim)">???</h3><p>${esc(t('starHidden', ROMAN5[needOb()]))}</p>`;
      const bb = refs.detail.querySelector('[data-buy]'); if (bb) bb.addEventListener('click', () => { if (!G.buyNode(selNode)) G.Audio.error(); else G.Audio.buy && G.Audio.buy(); UI.update(true); });
    }
    if (!seen) return;
    setText(refs.detail.querySelector('[data-lv]'), t('lvl') + ' ' + L_ + '/' + n.max);
    const costEl = refs.detail.querySelector('[data-cost]');
    setText(costEl, maxed ? t('nodeMaxed') : !avail ? t('nodeLocked') : fmt(c));
    const btn = refs.detail.querySelector('[data-buy]');
    btn.disabled = maxed || !avail || (S.embers || 0) < c;
  }
  updaters.stars = function () {
    const S = G.S;
    if (!refs.nodes) return;
    if (G.NODES.filter(n => G.nodeVisible(n)).length !== refs.starVis) { UI.render(); return; }
    for (const r of refs.nodes) {
      const L_ = S.nodes[r.n.id] || 0, avail = G.nodeAvailable(r.n), seen = G.nodeVisible(r.n);
      setText(r.lbl, seen ? L_ + '/' + r.n.max : '?');
      setClass(r.el, 'hid', !seen);
      setClass(r.el, 'owned', L_ > 0);
      setClass(r.el, 'maxed', L_ >= r.n.max);
      setClass(r.el, 'avail', seen && avail && L_ < r.n.max && (S.embers || 0) >= G.nodeCost(r.n));
      setClass(r.el, 'locked', !avail || !seen);
      setClass(r.el, 'sel', r.n.id === selNode);
    }
    for (const l of refs.lines) {
      const a = (S.nodes[l.dataset.a] || 0) > 0, b = (S.nodes[l.dataset.b] || 0) > 0;
      const col = a && b ? G.BRANCH_COLORS[G.NODE_BY_ID[l.dataset.b].br] : a ? '#5a5474' : '#2a2638';
      if (l._c !== col) { l.setAttribute('stroke', col); l._c = col; l.setAttribute('stroke-dasharray', a && b ? '' : '3 3'); }
    }
    setText($('#tabSub'), fmt(embersHave()) + ' ' + t('embers').toLowerCase());
    if (refs.cur) setText(refs.cur, fmt(embersHave()));
    renderDetail(false);
  };

  // Collection
  renderers.coll = function (body) {
    const S = G.S, D = G.D;
    const found = G.ITEMS.filter(it => (S.coll[it.id] || 0) > 0).length;
    const sums = D.collSums || {};
    // (4.0: the collection's combat kinds (G.BONUS[k].combat: crit, crit power, boss damage) give nothing now: struck out)
    const bonusRows = Object.keys(G.BONUS).filter(k => sums[k]).map(k => {
      const b = G.BONUS[k], v = sums[k], txt = b.pct ? G.fmtPct(v) : (b.x ? '+' + v.toFixed(1) + '×' : '+' + Math.floor(v));
      return b.combat ? `<span class="off" title="${esc(t('collCombatOff'))}">${esc(L(b.name))}</span><b class="off"><s>${txt}</s> ${esc(t('collOff'))}</b>`
        : `<span>${esc(L(b.name))}</span><b>${txt}</b>`;
    }).join('');
    body.innerHTML = `
      <p class="note">${esc(t('collFound', found, G.ITEMS.length))}. ${esc(t('collHint'))}</p>
      <div class="detail" data-item style="margin-bottom:8px"></div>
      ${G.RARITIES.map((r, ri) => `
        <div class="rarLabel" style="color:${r.color}"><span>${esc(L(r.name))}</span><span style="color:var(--dim)">${G.ITEMS_BY_RARITY[ri].filter(it => S.coll[it.id]).length}/6</span></div>
        <div class="rarRow">${G.ITEMS_BY_RARITY[ri].map(it => `<button class="slot r${ri}" data-i="${it.id}" aria-label="${esc(L(it.name))}">${img('it_' + it.id, '', 4)}<span class="stars"></span><span class="n"></span></button>`).join('')}</div>`).join('')}
      <p class="note">${esc(t('collMoved'))}</p>
      <div class="sect">${esc(t('collBonuses'))}</div>
      <div class="bonusList">${bonusRows || `<span>—</span>`}</div>
      <div class="sect">${esc(t('chestsOpened'))}</div>
      <div class="tierCounts">${G.RARITIES.map((r, i) => `<div style="color:${r.color}">${img('chest_' + i, '', 2)}<br>${fmt(S.opened[i])}</div>`).join('')}</div>
      <div class="sect">${esc(t('modifiers'))}</div>
      <div class="modList">${G.MODIFIERS.map(m => `<div class="modItem ${D.mods[m.id] ? '' : 'off'}"><b style="color:${m.color}">${esc(L(m.name))}</b><span>${esc(D.mods[m.id] ? L(m.desc) : t('modLocked'))}</span></div>`).join('')}</div>`;
    refs.slots = $$('.slot', body).map(el => ({ el, it: G.ITEM_BY_ID[el.dataset.i], n: el.querySelector('.n'), st: el.querySelector('.stars'), img: el.querySelector('img') }));
    refs.item = body.querySelector('[data-item]');
    refs.found = found + 100 * Object.keys(S.uq).length;
    body.addEventListener('click', e => {
      const s = e.target.closest('.slot'); if (!s) return;
      selItem = s.dataset.i; updaters.coll(true);
    });
    if (!selItem) selItem = (G.ITEMS.find(it => S.coll[it.id]) || G.ITEMS[0]).id;
  };
  updaters.coll = function (force) {
    const S = G.S;
    if (!refs.slots) return;
    const found = G.ITEMS.filter(it => (S.coll[it.id] || 0) > 0).length + 100 * Object.keys(S.uq).length;
    if (found !== refs.found) { UI.render(); return; }
    if (!force) return;
    for (const s of refs.slots) {
      const n = S.coll[s.it.id] || 0;
      setClass(s.el, 'none', n === 0);
      setClass(s.el, 'sel', s.it.id === selItem);
      setText(s.n, n ? fmt(n) : '');
      const st = G.stars(n);
      const sh = '<i></i>'.repeat(st);
      if (s.st._h !== sh) { s.st.innerHTML = sh; s.st._h = sh; }
    }
    const it = G.ITEM_BY_ID[selItem];
    if (it && refs.item) {
      const n = S.coll[it.id] || 0, r = G.RARITIES[it.r], b = G.BONUS[it.bonus];
      const st = G.stars(n), per = b.v * r.bonusMul;
      const next = G.STAR_THRESHOLDS.find(x => x > n);
      const fmtB = v => b.pct ? G.fmtPct(v) : (b.x ? '+' + v.toFixed(1) + '×' : '+' + Math.floor(v));
      const html = n ? `<h3 style="color:${r.color}">${esc(L(it.name))}</h3>
        <p>${esc(L(r.name))} · ${esc(t('count'))}: <b style="color:var(--text)">${fmt(n)}</b> · ${esc(t('value'))}: <b style="color:var(--gold)">${fmt(G.itemValue(it))}</b></p>
        <p>${esc(t('bonus'))}: ${esc(L(b.name))} <b style="color:var(--good)">${fmtB(per * st)}</b> (${fmtB(per)} / ★)</p>
        <p>${next ? esc(t('nextStar', fmt(next))) : esc(t('allStars'))}</p>`
        : `<h3 style="color:var(--dim)">???</h3><p>${esc(L(r.name))} · ${esc(t('unknownItem'))}</p>`;
      if (refs.item._h !== html) { refs.item.innerHTML = html; refs.item._h = html; }
    }
  };

  // Pets
  renderers.pets = function (body) {
    const S = G.S, D = G.D;
    const tierRates = G.PET_TIERS.map(x => Math.round(x.rate * 100));
    body.innerHTML = `
      <div class="hatch">
        <img class="egg" src="${ic('egg_' + Math.min(3, Math.floor(S.pulls / 20)), 10)}" alt="">
        <div>
          <b style="font:8px var(--font-display);color:var(--gold)">${esc(t('hatchery'))}</b>
          <div class="acts">
            <button class="btn gold" data-pull="1">${esc(t('hatch1'))} · ${img('ic_egg', '', 2)}1</button>
            <button class="btn gold" data-pull="10">${esc(t('hatch10'))} · ${img('ic_egg', '', 2)}9</button>
          </div>
          <small>${esc(t('eggOdds', tierRates[0], tierRates[1], tierRates[2], tierRates[3], Math.round(D.goldenChance * 100)))}</small>
          <small data-pity></small>
        </div>
      </div>
      <div class="sect" data-active></div>
      <p class="note">${esc(t('petHint'))}</p>
      <div class="petGrid">${G.PETS.map(p => `<button class="pet" data-p="${p.id}"><span class="tag" hidden>✓</span><img alt=""><b></b><span class="lv"></span><small></small></button>`).join('')}</div>`;
    refs.pets = $$('.pet', body).map(el => ({ el, p: G.PET_BY_ID[el.dataset.p], img: el.querySelector('img'), b: el.querySelector('b'), lv: el.querySelector('.lv'), sm: el.querySelector('small'), tag: el.querySelector('.tag') }));
    refs.pull = $$('[data-pull]', body);
    refs.pity = body.querySelector('[data-pity]');
    refs.active = body.querySelector('[data-active]');
    body.addEventListener('click', e => {
      const pb = e.target.closest('[data-pull]');
      if (pb) { G.Audio.unlock(); if (!G.pull(+pb.dataset.pull)) { G.Audio.error(); UI.toast(esc(t('noEggs')), '', 'ic_egg', { p: 2 }); } return; }
      const pe = e.target.closest('.pet');
      if (pe && G.S.pets[pe.dataset.p]) { G.togglePet(pe.dataset.p); }
    });
    refs.petKey = '';
  };
  updaters.pets = function () {
    const S = G.S, D = G.D;
    if (!refs.pets) return;
    refs.pull[0].disabled = S.eggs < 1;
    refs.pull[1].disabled = S.eggs < 9;
    setText(refs.pity, t('pityL', Math.max(1, 25 - S.pity.l)) + ' · ' + t('pityD', Math.max(1, 120 - S.pity.d)));
    setText(refs.active, t('activePets', S.active.length, D.petSlots));
    setText($('#tabSub'), fmt(S.eggs) + ' ' + t('eggs').toLowerCase());
    const key = JSON.stringify(S.pets) + S.active.join();
    if (key === refs.petKey) return;
    refs.petKey = key;
    for (const r of refs.pets) {
      const st = S.pets[r.p.id];
      const tier = G.PET_TIERS[r.p.tier];
      r.img.src = ic('p_' + r.p.id, 5, st && st.gold ? { gold: true } : null);
      setClass(r.el, 'none', !st);
      setClass(r.el, 'on', !!st && S.active.includes(r.p.id));
      setClass(r.el, 'gold', !!(st && st.gold));
      r.tag.hidden = !(st && S.active.includes(r.p.id));
      setText(r.b, st ? L(r.p.name) : t('petUnknown'));
      r.b.style.color = tier.color;
      setText(r.lv, st ? t('lvl') + ' ' + st.lvl + (st.gold ? ' · ' + t('golden') : '') : L(tier.name));
      setText(r.sm, st ? L(r.p.desc) + ' · ' + t('petPower', (G.petPower(st) * D.petMult).toFixed(1)) : '');
    }
  };
  function showPull(res) {
    const cards = res.map((r, i) => {
      const tier = G.PET_TIERS[r.pet.tier];
      return `<div class="pullCard" style="--c:${r.golden ? '#ffd84a' : tier.color};animation-delay:${i * 0.08}s">${img('p_' + r.pet.id, '', 5, r.golden ? { gold: true } : null)}<span style="color:${tier.color}">${esc(L(r.pet.name))}</span><em>${r.isNew ? esc(t('newPet')) : r.newGold ? esc(t('golden')) : t('lvl') + ' ' + r.lvl}</em></div>`;
    }).join('');
    const best = res.reduce((m, r) => Math.max(m, r.pet.tier + (r.golden ? 1 : 0)), 0);
    G.Audio.pull(best);
    // (3.6: a pet hatched out on the field (a rare surprise's) is a banner, not a window that stops the fight)
    if (!G.R.town && res.length === 1) {
      const r = res[0], tier = G.PET_TIERS[r.pet.tier];
      UI.bannerShow(`<div class="inner" style="color:${r.golden ? '#ffd84a' : tier.color}"><h2>${esc(t('pullTitle'))}</h2><img class="ico" src="${ic('p_' + r.pet.id, 8, r.golden ? { gold: true } : null)}" alt=""><p>${esc(L(r.pet.name))}</p><p class="sub">${esc(r.isNew ? t('newPet') : r.newGold ? t('golden') : t('lvl') + ' ' + r.lvl)}</p></div>`, 2800);
      if (curTab() === 'pets') UI.update(true);
      return;
    }
    UI.modal(t('pullTitle'), `<div class="pullGrid" style="${res.length === 1 ? 'grid-template-columns:1fr;justify-items:center' : ''}">${cards}</div>`, [{ label: t('ok'), cls: 'gold' }]);
    if (curTab() === 'pets') UI.update(true);
  }

  // Quests
  renderers.quests = function (body) {
    const S = G.S;
    const avail = G.dailyAvailable();
    const streak = avail ? (S.daily.last ? S.daily.streak + 1 : 0) : S.daily.streak; // a missed day pauses the streak
    const dayIcon = d => { const r = G.DAILY[d % 7]; return r.kind === 'embers' ? EMB() : r.kind === 'gems' ? 'ic_gem' : r.kind === 'gold' ? 'ic_coin' : r.kind === 'eggs' ? 'ic_egg' : r.kind === 'ess' ? 'ic_ess' : 'chest_6'; };
    const om = G.omen(), B = S.bounty && S.bounty.day === G.todayKey() ? S.bounty : { n: 0, done: false };
    const jp = G.Journey.progress();
    const nextSteps = [1, 2, 3].map(k => G.Journey.step((S.journey || 0) + k).text);
    body.innerHTML = `
      <div class="quest omen"><div class="top"><b>${esc(t('omen'))}: ${esc(om.name)}</b></div><p class="note">${esc(om.desc)}</p></div>
      <div class="quest ${B.done ? 'claimed' : ''}"><div class="top"><b>${esc(t('bounty'))}</b><small style="color:var(--dim)">${fmt(Math.min(B.n, G.Journey.BOUNTY))}/${fmt(G.Journey.BOUNTY)}</small></div>
        <p class="note">${esc(B.done ? t('bountyDone') : t('bountyText', fmt(G.Journey.BOUNTY)))}</p><div class="pbar"><i style="width:${Math.min(100, B.n / G.Journey.BOUNTY * 100)}%"></i></div></div>
      <div class="quest journey"><div class="top"><b>${esc(t('journey'))} · ${esc(t('journeyStep', (S.journey || 0) + 1))}</b><small style="color:var(--dim)">${fmt(jp.cur)}/${fmt(jp.need)}</small></div>
        <p>${esc(jp.st.text)}</p>${jp.st.hint ? `<p class="note">${esc(jp.st.hint)}</p>` : ''}
        <div class="pbar"><i style="width:${Math.min(100, jp.cur / jp.need * 100)}%"></i></div>
        <p class="note">${esc(t('journeyNext'))}: ${nextSteps.map(esc).join(' · ')}</p><p class="note">${esc(t('journeyHint'))}</p></div>
      <div class="quest ${avail ? 'done' : ''}">
        <div class="top"><b>${esc(t('daily'))}</b>${avail ? `<button class="btn gold" data-daily>${esc(t('collect'))}</button>` : `<small style="color:var(--dim)">${esc(t('tomorrow'))}</small>`}</div>
        <div class="dailyDays">${G.DAILY.map((d, i) => { const ld = G.S.daily.last ? G.S.daily.streak % 7 : -1, nw = avail ? (G.S.daily.last ? (G.S.daily.streak + 1) % 7 : 0) : -1; return `<div class="${(avail ? i < nw : i <= ld) ? 'past' : ''} ${i === nw ? 'now' : ''}">${esc(t('dayN', i + 1))}${img(dayIcon(i), '', 2)}</div>`; }).join('')}</div>
      </div>
      <div class="sect">${esc(t('quests'))}</div>
      <div class="list" data-q></div>`;
    const b = body.querySelector('[data-daily]');
    if (b) b.addEventListener('click', () => { const r = G.claimDaily(); if (r) UI.toast(`<b>${esc(t('daily'))}</b>&nbsp;+${r.kind === 'chest' ? esc(L(G.RARITIES[r.tier].name)) : fmt(r.v)}`, 'ach', dayIcon(G.S.daily.streak), { p: 2 }); UI.render(); });
    refs.q = body.querySelector('[data-q]');
    refs.qKey = '';
    refs.q.addEventListener('click', e => {
      const c = e.target.closest('[data-claim]');
      if (c) { G.claimQuest(+c.dataset.claim); return; }
      const rr = e.target.closest('[data-reroll]');
      if (rr && !G.rerollQuest(+rr.dataset.reroll)) G.Audio.error();
    });
  };
  function questText(q) {
    switch (q.k) {
      case 'clicks': return t('q_clicks', fmt(q.n));
      case 'chests': return t('q_chests', fmt(q.n));
      case 'rarity': return t('q_rarity', q.n, L(G.RARITIES[q.r].name));
      case 'gold': return t('q_gold', fmt(q.n));
      case 'boss': return t('q_boss', q.n);
      case 'crit': return t('q_crit', fmt(q.n));
      case 'combo': return t('q_combo', q.n);
      case 'mod': return t('q_mod', q.n);
      case 'wisp': return t('q_wisp');
      case 'kills': return t('q_kills', fmt(q.n));
    }
    return '';
  }
  updaters.quests = function () {
    const S = G.S;
    if (!refs.q) return;
    const rerollLeft = Math.max(0, (S.rerollAt - Date.now()) / 1000);
    const key = S.quests.map(q => q.k + (q.done ? 1 : 0) + (q.wait ? 'w' : '')).join('|') + (rerollLeft > 0 ? 'r' : '');
    if (key !== refs.qKey) {
      refs.qKey = key;
      refs.q.innerHTML = S.quests.map((q, i) => {
        if (q.wait) return `<div class="quest wait" data-i="${i}"><span data-wait></span></div>`;
        // (4.0: rewards in Embers and, for the weekly deed, Gems; the day's first deed pays x2 (Quest Board III))
        const rwIcon = q.rw === 'embers' ? EMB() : q.rw === 'gems' ? 'ic_gem' : q.rw === 'gold' ? 'ic_coin' : q.rw === 'ess' ? 'ic_ess' : 'ic_egg';
        const tag = q.weekly ? `<em class="qTag wk">${esc(t('qWeekly'))}</em>` : q.daily ? `<em class="qTag">${esc(t('qDaily'))}</em>` : '';
        return `<div class="quest ${q.done ? 'done' : ''}${q.weekly ? ' weekly' : ''}" data-i="${i}">
          <div class="top"><b>${tag}${esc(questText(q))}</b><span class="reward">${img(rwIcon, '', 2)}<span data-rw></span></span></div>
          <div class="pbar"><i data-bar></i><span data-p></span></div>
          <div class="top">${q.done ? `<button class="btn gold" data-claim="${i}">${esc(t('claim'))}</button>` : '<span></span>'}
            ${q.done ? '' : `<button class="btn" data-reroll="${i}" ${rerollLeft > 0 ? 'disabled' : ''}>${esc(t('reroll'))}</button>`}</div>
        </div>`;
      }).join('');
    }
    $$('.quest', refs.q).forEach(el => {
      const q = S.quests[+el.dataset.i]; if (!q) return;
      if (q.wait) { setText(el.querySelector('[data-wait]'), t('newQuestIn', G.fmtTime(q.wait))); return; }
      el.querySelector('[data-bar]').style.width = Math.min(100, q.p / q.n * 100) + '%';
      setText(el.querySelector('[data-p]'), fmt(Math.floor(q.p)) + ' / ' + fmt(q.n));
      setText(el.querySelector('[data-rw]'), fmt(G.questReward(q), true));
    });
    setText($('#tabSub'), rerollLeft > 0 ? t('rerollIn', G.fmtTime(rerollLeft)) : '');
  };

  // ---------- 4.0: the meta screens (DESIGN §4) ----------
  // Each reads the meta stream's data when it is there (G.BUTTONS, G.DEEDS and the achievements' unlock fields,
  // G.unlocked / G.btnOpen, Button-evolution recipes) and otherwise what the core keeps (G.LEGACY's hf_* ranks, G.BLD,
  // G.NODES, S.codex, S.fallen12, G.ACH, S.heatStk): never a blank page while the logic is still landing.
  const metaHead = (icon, n, label, note) => `<div class="metaHead"><span class="cur">${img(icon, '', 3)}<b data-cur>${fmt(n)}</b> <small>${esc(label)}</small></span>${note ? `<small class="note">${esc(note)}</small>` : ''}</div>`;

  // -- the Hall of Fame (the Temple): capped ranks bought with Fame; rank k costs base x k^2 --
  const HF_ICON = { hf_might: 'ic_sword', hf_iron: 'ic_heart', hf_swift: 'ic_bolt', hf_keen: 'ic_eye', hf_boss: 'ic_skull', hf_xp: 'ic_star', hf_gold: 'ic_coin', hf_chest: 'ic_chest', hf_fame: 'ic_fame', hf_wind: 'ic_heart', hf_reroll: 'ic_clover', hf_banish: 'ic_tomb', hf_door: 'ic_vault', hf_belt: 'ic_bag', hf_keep: 'ic_museum', hf_qm: 'ic_scale' };
  // what L ranks give: the first number in the rank's text times L ('Party damage +4% a rank' -> '+8%'), or on/off
  function hfNow(l, Lv) {
    const m = /([+-]?)(\d+(?:\.\d+)?)(%?)/.exec(L(l.desc));
    if (!Lv) return '—';
    if (!m || l.max === 1) return t('hfOn');
    const v = +m[2] * Lv;
    return (m[1] || '+') + (Number.isInteger(v) ? v : v.toFixed(1)) + m[3];
  }
  // (rank k's price: the meta's own when it has it; G.HALL ranks are base x k^2)
  const hfCost = (l, k) => (l.sq || !l.growth ? Math.ceil(l.base * (k + 1) * (k + 1)) : Math.ceil(l.base * Math.pow(l.growth, k)));
  const hfTotal = l => { if (G.hallTotal) return G.hallTotal(l); let c = 0; for (let k = 0; k < l.max; k++) c += hfCost(l, k); return c; };
  renderers.hall = function (body) {
    const S = G.S;
    body.innerHTML = `${metaHead('ic_fame', Math.floor(S.fame || 0), t('fame'), t('hallHint4'))}
      <div class="hofSum" data-hsum></div>
      <div class="hofGrid">${G.LEGACY.map(l => `<div class="hof" data-l="${l.id}">
        <div class="hofTop">${img(HF_ICON[l.id] || 'ic_fame', '', 3)}<b>${esc(L(l.name))}</b></div>
        <small class="d">${esc(L(l.desc))}</small>
        <div class="hofPips" data-pips></div>
        <div class="hofNow"><span data-now></span><em data-next></em></div>
        <button class="btn" data-buyl="${l.id}">${img('ic_fame', '', 2)}<span data-cost></span></button></div>`).join('')}</div>`;
    refs.hof = { cards: $$('.hof', body).map(el => ({ el, l: G.LEGACY_BY_ID[el.dataset.l], pips: el.querySelector('[data-pips]'), now: el.querySelector('[data-now]'), next: el.querySelector('[data-next]'), cost: el.querySelector('[data-cost]'), btn: el.querySelector('[data-buyl]') })), cur: body.querySelector('[data-cur]'), sum: body.querySelector('[data-hsum]') };
    body.addEventListener('click', e => {
      const b = e.target.closest('[data-buyl]'); if (!b) return;
      G.Audio.unlock();
      const l = G.LEGACY_BY_ID[b.dataset.buyl];
      if (G.buyLegacy(b.dataset.buyl)) { G.Audio.levelUp && G.Audio.levelUp(); UI.toast(`<span><b>${esc(L(l.name))} ${ROMAN5[G.S.legacy[l.id]]}</b> · ${esc(hfNow(l, G.S.legacy[l.id]))}</span>`, 'ach', HF_ICON[l.id] || 'ic_fame', { p: 2 }); const c = b.closest('.hof'); if (c && c.animate && !G.S.set.lowfx) c.animate([{ transform: 'scale(1.05)', boxShadow: '0 0 0 3px #ffd84a' }, {}], { duration: 380 }); }
      else shakeRow(b.closest('.hof'));
      updaters.hall(true);
    });
  };
  updaters.hall = function (force) {
    const rf = refs.hof; if (!rf) return;
    const S = G.S, now = performance.now();
    if (!force && now - (rf.t || 0) < 300) return;
    rf.t = now;
    let ranks = 0, max = 0, spent = 0, total = 0;
    for (const c of rf.cards) {
      const l = c.l, Lv = S.legacy[l.id] | 0, maxed = Lv >= l.max, cost = maxed ? 0 : G.legacyCost(l);
      ranks += Lv; max += l.max; total += hfTotal(l);
      for (let k = 0; k < Lv; k++) spent += hfCost(l, k);
      const ph = Array.from({ length: l.max }, (_, k) => `<i class="${k < Lv ? 'on' : ''}"></i>`).join('');
      if (c.pips._h !== ph) { c.pips.innerHTML = ph; c.pips._h = ph; }
      setText(c.now, Lv ? t('hfNowIs', hfNow(l, Lv)) : t('hfNone'));
      setText(c.next, maxed ? '' : t('hfNextIs', hfNow(l, Lv + 1)));
      setText(c.cost, maxed ? t('max') : fmt(cost));
      c.btn.disabled = maxed;
      setClass(c.btn, 'gold', !maxed && S.fame >= cost);
      setClass(c.el, 'maxed', maxed); setClass(c.el, 'can', !maxed && S.fame >= cost);
    }
    setText(rf.cur, fmt(Math.floor(S.fame || 0)));
    // (4.0: what the permanent block gives now against its budget: G.metaPower(), the meta's governor)
    let pw = '';
    if (G.metaPower) { try { const m = G.metaPower(), x = v => '×' + (+v || 1).toFixed(2); pw = ' · ' + t('hfPower', x(m.dmg), x(m.boss), x(m.hp), x(m.cap.dmg), x(m.cap.boss), x(m.cap.hp)) + (m.capped ? ' ' + t('hfCapped') : ''); } catch (e) { pw = ''; } }
    setText(rf.sum, t('hfSum', ranks, max, fmt(spent), fmt(total)) + pw);
    setText($('#tabSub'), fmt(Math.floor(S.fame || 0)) + ' ' + t('fame').toLowerCase());
  };

  // -- the Hall of the Fallen (the Temple): the last 12 Wardens; wins on gold plaques (the statues stand in the square) --
  const landName = id => { const i = G.REALM_BY_ID ? G.REALM_BY_ID[id] : null; return i != null && G.REALMS[i] ? G.REALMS[i].name : (id || '?'); };
  renderers.fallen = function (body) {
    const S = G.S, list = (S.fallen12 || []).slice().reverse();
    body.innerHTML = `<p class="note">${esc(t('fallenHint'))}</p>${list.length ? `<div class="plqList">${list.map(f => {
      const C = G.CLASS_BY_ID[f.cls] || G.CLASSES[0], b = btnInfo(f.btn || 'classic');
      const how = f.win || f.kind === 'win' ? t('fallenWin') : f.kind === 'extract' ? t('fallenExtract', landName(f.land), (f.depth | 0) + 1) : f.kind === 'abandon' ? t('fallenAbandon', landName(f.land)) : t('fallenFell', landName(f.land), (f.depth | 0) + 1);
      const cause = f.cause && f.cause !== 'abandon' ? t('cause_' + f.cause) : '';
      const cards = (f.cards || []).filter(k => G.PERKS[k]).map(k => `<i title="${esc(G.PERKS[k].name)}">${img(G.PERKS[k].icon, '', 2)}</i>`).join('');
      const keep = f.keep && G.UNIQUES[f.keep] ? `<i class="kp" title="${esc(G.UNIQUES[f.keep].name)}">${img('u_' + f.keep, '', 2)}</i>` : '';
      return `<div class="plq ${f.win || f.kind === 'win' ? 'win' : ''} k_${esc(f.kind || 'fall')}">
        <span class="statue">${img(C.spr, '', 3, { dark: !(f.win || f.kind === 'win') })}<i class="base" style="--bc:${b.base === 'rainbow' ? '#ff4f7e' : b.base}"></i></span>
        <div><b>#${f.n | 0} · ${esc(L(C.name))} · ${esc(b.name)}${f.heat ? ` · ${esc(t('heatN', f.heat))}` : ''}</b>
          <small>${esc(how)}${cause ? ' · ' + esc(cause) : ''}</small>
          <span class="plqCards">${cards}${keep}</span></div>
        <small class="when">${f.at ? esc(t('agoT', G.fmtTime(Math.max(60, (Date.now() - f.at) / 1000)))) : ''}</small></div>`;
    }).join('')}</div>` : `<p class="empty">${esc(t('fallenNone'))}</p>`}`;
  };

  // -- the Buttons (the Temple): the characters, their rules, how each opens, the Heat stickers, the evolution --
  const BTN_FALLBACK = [
    { id: 'classic', base: '#e8413c' }, { id: 'iron', base: '#3f7bff' }, { id: 'storm', base: '#a048ff' }, { id: 'spore', base: '#2fc46a' },
    { id: 'gold', base: '#ffc629' }, { id: 'glass', base: '#3a3348' }, { id: 'prism', base: 'rainbow' }, { id: 'clockwork', base: '#f4f6ff' },
    { id: 'golden', base: '#ffd84a', secret: 1 },
  ];
  const BTN_EVO = { iron: 'adamant', storm: 'tempest', classic: 'crimson', glass: 'diamond', prism: 'spectrum', spore: 'bloom', clockwork: 'perpetual', gold: 'golden' };
  const btnRaw = id => (Array.isArray(G.BUTTONS) ? G.BUTTONS.find(x => x.id === id) : G.BUTTONS && G.BUTTONS[id]) || null;
  const hasStr = k => Object.prototype.hasOwnProperty.call(G.STR, k);
  function btnInfo(id, raw) {
    const b = raw || btnRaw(id) || {}, fb = BTN_FALLBACK.find(x => x.id === id) || {};
    const str = k => (hasStr('btn_' + id + '_' + k) ? t('btn_' + id + '_' + k) : '');
    const open = G.btnOpen ? !!G.btnOpen(id) : G.BUTTONS ? (!G.unlocked || G.unlocked('button', id) !== false) : id === 'classic';
    const evo = b.evo || BTN_EVO[id] || null;
    return { id, base: b.base || b.skin || fb.base || '#e8413c', name: L(b.name) || str('n') || id[0].toUpperCase() + id.slice(1), rule: L(b.rule || b.desc) || str('r'),
      card: b.card ? (G.PERKS[b.card] ? G.PERKS[b.card].name : L(b.card)) : str('c'), unl: (() => { try { return G.unlockHint ? G.unlockHint('button', id) : ''; } catch (e) { return ''; } })() || L(b.unlockText || b.unlock && b.unlock.desc) || str('u'), open, secret: !!(b.secret || fb.secret), evo };
  }
  UI.btnInfo = id => btnInfo(id);
  function buttonsList() {
    const B = G.BUTTONS, arr = Array.isArray(B) ? B : B && typeof B === 'object' ? Object.keys(B).map(id => Object.assign({ id }, B[id])) : null;
    return (arr && arr.length ? arr : BTN_FALLBACK).map(b => btnInfo(b.id, arr && arr.length ? b : null));
  }
  // a Button evolution's recipe: discovered (named, its effect), or ??? with a hint
  const evoKnown = (base, evo) => { const S = G.S; try { if (G.btnEvoKnown) return !!G.btnEvoKnown(base, evo); } catch (e) { /* the meta's */ } return !!((S.rec && (S.rec.btnEvos || {})[evo]) || (S.btnEvos || {})[evo] || (S.skins || {})[evo]); };
  const evoHinted = base => { const S = G.S; try { if (G.btnEvoHint) return G.btnEvoHint(base); } catch (e) { /* the meta's */ } return !!((S.rec && S.rec.btnHints || {})[base]); };
  const btnSpr = base => { try { return G.SPR.url(G.SPR.button(base === 'rainbow' ? 'rainbow' : base, false, 200), 2); } catch (e) { return ''; } };
  renderers.buttons = function (body) {
    const S = G.S, list = buttonsList(), stk = S.heatStk || {}, mx = G.TORMENT_MAX || 10;
    body.innerHTML = `<p class="note">${esc(t('btnsHint'))}</p><div class="btnGrid">${list.map(b => {
      const hide = b.secret && !b.open, best = stk[b.id] != null ? stk[b.id] : -1;
      const stickers = Array.from({ length: mx + 1 }, (_, k) => `<i class="${k <= best ? 'on' : ''}" title="${esc(t('heatN', k))}">${k}</i>`).join('');
      const evoK = b.evo && evoKnown(b.id, b.evo);
      const evoLine = b.evo ? (evoK ? `<small class="evo rbw">${esc(t('btnEvoIs', hasStr('bevo_' + b.evo + '_n') ? t('bevo_' + b.evo + '_n') : b.evo))}</small>` : `<small class="evo">${esc(t('btnEvoUnknown'))}${evoHinted(b.id) && hasStr('bevo_' + b.evo + '_h') ? ' · ' + esc(t('bevo_' + b.evo + '_h')) : ''}</small>`) : '';
      return `<div class="btnCard ${b.open ? '' : 'no'} ${S.run && S.run.on && S.run.btn === b.id ? 'on' : ''}">
        <img class="bspr" src="${btnSpr(b.base)}" alt="">
        <div><b class="${b.id === 'golden' && b.open ? 'rbw' : ''}">${esc(hide ? '???' : b.name)}</b>
          <small>${esc(hide ? t('btnSecret') : b.rule || t('btnNoRule'))}</small>
          ${b.card && !hide ? `<small class="card">${esc(t('btnCard', b.card))}</small>` : ''}
          ${b.open ? '' : `<small class="lock">🔒 ${esc(hide ? t('btnSecretHow') : b.unl || t('btnLocked'))}</small>`}
          ${evoLine}
          <div class="stk" title="${esc(t('btnStickers'))}">${stickers}</div></div></div>`;
    }).join('')}</div><p class="note">${esc(t('btnsHeat', S.heatWon >= 0 ? S.heatWon : 0, G.tormentMax ? G.tormentMax() : 0))}</p>`;
  };

  // -- the Museum: the Codex (uniques and relics with ranks), the keepsake loadout --
  const codexOf = q => (G.S.codex || {})[q] || null;
  const keepsNow = () => { const S = G.S; return ((S.lastSetup && S.lastSetup.keeps) || []).filter(q => codexOf(q) && G.UNIQUES[q]); };
  function keepToggle(q) {
    const S = G.S, slots = G.keepSlots ? G.keepSlots() : 0;
    if (!slots) { G.Audio.error(); UI.toast(esc(t('keepNeedsMuseum')), '', 'ic_museum', { p: 2 }); return; }
    if (!codexOf(q)) return;
    const ls = S.lastSetup = S.lastSetup || { btn: 'classic', cls: S.hero.cls || null, heat: 0, keeps: [], first: null };
    let k = keepsNow();
    if (k.includes(q)) k = k.filter(x => x !== q);
    else { k.push(q); while (k.length > slots) k.shift(); }
    ls.keeps = k; G.dirty && G.dirty();
    G.Audio.buy && G.Audio.buy();
  }
  UI.keepToggle = keepToggle;
  function codexEntry(q) {
    const U = G.UNIQUES[q], c = codexOf(q), cap = U.relic ? 2 : (G.codexCap ? G.codexCap() : 2), locked = G.unlocked && !G.unlocked.fallback && G.unlocked(U.relic ? 'relic' : 'unique', q) === false;
    const theme = G.UQ_THEME && G.UQ_THEME[q] && G.PERKS[G.UQ_THEME[q]] ? G.PERKS[G.UQ_THEME[q]] : null;
    const kept = keepsNow().includes(q), slots = G.keepSlots ? G.keepSlots() : 0;
    const col = U.relic ? G.RELIC_COL : G.UNIQUE_COL;
    if (!c) return `<div class="cxRow off">${img('u_' + q, '', 3, { dark: true })}<div><b>???</b><small>${esc(locked ? t('cxLocked') : U.boss ? t('cxDropsBoss', G.bossName(U.minD)) : t('cxDrops'))}</small></div></div>`;
    const pips = Array.from({ length: cap }, (_, k) => `<i class="${k < (c.rank | 0) ? 'on' : ''}"></i>`).join('');
    return `<div class="cxRow ${kept ? 'kept' : ''}" style="--rc:${col}">${img('u_' + q, '', 3)}<div><b class="rbw">${esc(U.name)}</b>
      <small class="cxRank">${esc(t('cxRank', c.rank | 0, cap))} <span class="pips">${pips}</span>${(c.n | 0) > 1 ? ` · ×${c.n}` : ''}</small>
      ${theme ? `<small class="cxTheme">${img(theme.icon, '', 2)} ${esc(t('cxTheme', 2 + ((c.rank | 0) >= 2 ? 1 : 0) + ((c.rank | 0) >= 4 ? 1 : 0), theme.name))}</small>` : ''}
      <small class="d">${esc(U.fx)}</small></div>
      ${slots ? `<button class="btn ${kept ? 'gold' : ''}" data-keep="${q}">${esc(t(kept ? 'keepOn' : 'keepTake'))}</button>` : ''}</div>`;
  }
  renderers.codex = function (body) {
    const S = G.S, uq = (G.UNIQUE_IDS || []).filter(q => !G.UNIQUES[q].relic), rl = G.RELIC_IDS || [];
    const nU = uq.filter(codexOf).length, nR = rl.filter(codexOf).length, slots = G.keepSlots ? G.keepSlots() : 0, k = keepsNow();
    const slotsHtml = slots ? Array.from({ length: slots }, (_, i) => { const q = k[i]; return q ? `<div class="kpSlot on">${img('u_' + q, '', 3)}<b>${esc(G.UNIQUES[q].name)}</b><button class="btn small" data-keep="${q}">✕</button></div>` : `<div class="kpSlot">${esc(t('keepEmpty'))}</div>`; }).join('') : `<p class="note">${esc(t('keepNeedsMuseum'))}</p>`;
    body.innerHTML = `<p class="note">${esc(t('cxHint', G.codexCap ? G.codexCap() : 2))}</p>
      <div class="sect">${esc(t('keepTitle'))} <small>${esc(t('keepSlots', k.length, slots))}</small></div>
      <p class="note">${esc(t('keepHint'))}</p><div class="kpRow">${slotsHtml}</div>
      <div class="sect">${esc(t('uniques'))} <small>${nU} / ${uq.length}</small></div><div class="cxGrid">${uq.map(codexEntry).join('')}</div>
      <div class="sect" style="color:${G.RELIC_COL}">${esc(t('relicBook'))} <small>${nR} / ${rl.length}</small></div><div class="cxGrid">${rl.map(codexEntry).join('')}</div>`;
    refs.cx = (S.codex ? Object.keys(S.codex).length : 0) + '|' + k.join() + '|' + slots;
    body.addEventListener('click', e => { const b = e.target.closest('[data-keep]'); if (b) { keepToggle(b.dataset.keep); UI.render(); } });
  };
  updaters.codex = function () { const S = G.S, key = (S.codex ? Object.keys(S.codex).length : 0) + '|' + keepsNow().join() + '|' + (G.keepSlots ? G.keepSlots() : 0); if (key !== refs.cx) UI.render(); };

  // -- the Museum: the recipe book: perk evolutions, and the Button evolutions as ??? with hints --
  renderers.recipes = function (body) {
    const S = G.S, list = buttonsList().filter(b => b.evo);
    body.innerHTML = `<div class="sect">${esc(t('evoBook'))} <small>${esc(t('evoFound', Object.keys(S.rec.evos || {}).length, Object.keys(G.EVOS).length))}</small></div>
      <p class="note">${esc(t('evoBookHint'))}</p>
      <div class="evoBook">${Object.keys(G.EVOS).map(id => {
        const E = G.EVOS[id], got = S.rec.evos && S.rec.evos[id];
        return `<div class="evoRow ${got ? '' : 'off'}">${img(E.icon, '', 3, got ? null : { dark: true })}<div><b>${esc(got ? E.name : t('evoUnknown'))}</b><small>${esc(t('evoHint4', G.PERKS[E.from] ? G.PERKS[E.from].name : E.from, E.need))}</small>${got ? `<small class="d">${esc(E.desc)}</small>` : ''}</div></div>`;
      }).join('')}</div>
      <div class="sect">${esc(t('bevoBook'))}</div><p class="note">${esc(t('bevoHint'))}${G.btnHintBuy ? ' ' + esc(t('bevoTok', S.hintTok | 0)) : ''}</p>
      <div class="evoBook">${list.map(b => {
        const known = evoKnown(b.id, b.evo), hinted = evoHinted(b.id), nm = hasStr('bevo_' + b.evo + '_n') ? t('bevo_' + b.evo + '_n') : b.evo;
        // (4.0: a hint is bought with a token: one for each ranked Daily Siege finished, G.btnHintBuy)
        const ev = G.BUTTON_EVOS && G.BUTTON_EVOS[b.evo], hintTxt = hasStr('bevo_' + b.evo + '_h') ? t('bevo_' + b.evo + '_h') : ev && ev.hint ? ev.hint : t('bevoNoHint');
        const buy = !known && !hinted && G.btnHintBuy ? `<button class="btn small ${(S.hintTok | 0) > 0 ? 'gold' : ''}" data-hintbuy="${esc(b.id)}" ${(S.hintTok | 0) > 0 ? '' : 'disabled'}>${esc(t('bevoBuy'))}</button>` : '';
        return `<div class="evoRow ${known ? '' : 'off'}"><img src="${btnSpr(b.base)}" alt="" class="${known ? '' : 'dk'}"><div><b class="${known ? 'rbw' : ''}">${esc(known ? nm : '???')}</b>
          <small>${esc(t('bevoFrom', b.secret && !b.open ? '???' : String(b.name).replace(/\s+Button$/i, '')))}</small>
          <small class="d">${esc(known ? (hasStr('bevo_' + b.evo + '_r') ? t('bevo_' + b.evo + '_r') : '') : hinted ? hintTxt : t('bevoNoHint'))}</small>${buy}</div></div>`;
      }).join('')}</div>`;
    body.addEventListener('click', e => {
      const hb = e.target.closest('[data-hintbuy]'); if (!hb || !G.btnHintBuy) return;
      if (G.btnHintBuy(hb.dataset.hintbuy)) { G.Audio.buy && G.Audio.buy(); UI.render(); } else G.Audio.error();
    });
  };

  // -- the Museum: the bestiary: every land, its Horde, its lord; kills and lords slain --
  renderers.bestiary = function (body) {
    const S = G.S, kinds = (S.seen && S.seen.kinds) || {};
    const rows = G.REALMS.map((R_, i) => {
      const rec = (S.lands && S.lands[i]) || null, slain = !!(S.gemLords && S.gemLords[R_.id]), seen = !!(rec && (rec.k | 0) > 0) || slain;
      if (!seen) return `<div class="bstRow off">${img(R_.fodder, '', 3, { dark: true })}<div><b>???</b><small>${esc(t('bstUnseen'))}</small></div></div>`;
      const mobs = R_.mobs ? Object.values(R_.mobs).join(' · ') : '';
      return `<div class="bstRow ${slain ? 'slain' : ''}"><span class="bstArt">${img(R_.fodder, '', 3)}${img(R_.minion, '', 3)}${img(R_.lord, '', 2, slain ? null : { dark: true })}</span><div><b>${esc(R_.name)}</b>
        <small>${esc(R_.minionName)} · ${esc(slain ? R_.lordName : '???')}${slain ? ' ✓' : ''}</small>
        <small class="d">${esc(mobs)}</small><small>${esc(R_.rule)}: ${esc(R_.ruleDesc)} · ${esc(t('bstKills', fmt(rec ? rec.k | 0 : 0)))}</small></div></div>`;
    }).join('');
    const nk = (G.NEW_KINDS || []).map(k => `<span class="bstKind ${kinds[k] ? '' : 'off'}">${esc(kinds[k] ? t('kind_' + k) : '???')}</span>`).join('');
    body.innerHTML = `<p class="note">${esc(t('bstHint'))}</p>${G.rareFx ? `<button class="btn" data-rarecodex>${esc((G.STR && G.STR.rfCodex) || 'Rare surprises')}</button>` : ''}
      ${nk ? `<div class="sect">${esc(t('bstKinds'))}</div><div class="bstKinds">${nk}</div>` : ''}
      <div class="sect">${esc(t('bstLands'))}</div><div class="bstList">${rows}</div>`;
    const rc = body.querySelector('[data-rarecodex]'); if (rc) rc.addEventListener('click', () => G.rareFx && G.rareFx.openCodex());
  };

  // -- Deeds (the Board): about 120 of them; at least 45 unlock content; the next unlock with its bar --
  function deedList() {
    const own = Array.isArray(G.DEEDS) ? G.DEEDS : G.DEEDS && typeof G.DEEDS === 'object' ? Object.keys(G.DEEDS).map(id => Object.assign({ id }, G.DEEDS[id])) : [];
    const ids = new Set(own.map(d => d.id));
    return own.concat(G.ACH.filter(a => !ids.has(a.id)));
  }
  const deedDone = d => { try { if (G.deedDone) return !!G.deedDone(d.id); } catch (e) { /* the meta's */ } return !!(G.S.ach[d.id] || (G.S.deeds && G.S.deeds[d.id])); };
  function deedProg(d) {
    try {
      const p = G.deedProgress ? G.deedProgress(d.id) : typeof d.prog === 'function' ? d.prog(G.S) : null;
      if (Array.isArray(p)) return [+p[0] || 0, +p[1] || 1];
      if (p && typeof p === 'object') return [+(p.cur != null ? p.cur : p.have) || 0, +p.need || 1];
    } catch (e) { /* no bar */ }
    return null;
  }
  // what a Deed opens, in words: 'kind:id', {kind, id}, a list of them, or the meta's own text
  function unlockLabel(u) {
    if (!u) return '';
    if (Array.isArray(u)) return u.map(unlockLabel).filter(Boolean).join(', ');
    let kind, id;
    if (typeof u === 'string') { const i = u.indexOf(':'); if (i < 0) return u; kind = u.slice(0, i); id = u.slice(i + 1); } else { if (u.text || u.name) return L(u.text || u.name); kind = u.kind || u.k; id = u.id; }
    const nm = kind === 'button' ? btnInfo(id).name : kind === 'class' ? L((G.CLASS_BY_ID[id] || {}).name || id) : kind === 'perk' ? (G.PERKS[id] ? G.PERKS[id].name : id)
      : kind === 'land' ? landName(id) : (kind === 'unique' || kind === 'relic') ? (G.UNIQUES[id] ? G.UNIQUES[id].name : id) : id;
    return hasStr('unl_' + kind) ? t('unl_' + kind, nm) : nm;
  }
  UI.unlockLabel = unlockLabel;
  let deedFlt = 'unl';
  renderers.deeds = function (body) {
    const S = G.S, all = deedList(), done = all.filter(deedDone), unl = all.filter(d => d.unlock);
    // the nearest unlock: the open Deed with the most of its bar done
    const open = unl.filter(d => !deedDone(d)).map(d => ({ d, p: deedProg(d) })).sort((a, b) => (b.p ? b.p[0] / b.p[1] : -1) - (a.p ? a.p[0] / a.p[1] : -1));
    // (4.0: the meta's own pick when it has one, G.nextUnlocks: what changes the next run before a skin)
    let nx = open[0];
    try { const n1 = G.nextUnlocks && G.nextUnlocks(1)[0], d1 = n1 && (G.DEED_BY_ID ? G.DEED_BY_ID[n1.id] : all.find(d => d.id === n1.id)); if (d1) nx = { d: d1, p: [+n1.have || 0, +n1.need || 1] }; } catch (e) { /* the meta's */ }
    const nxP = nx && nx.p;
    // (no unlocking Deeds known yet: the whole list)
    const flt = deedFlt === 'unl' && !unl.length ? 'all' : deedFlt, list = flt === 'unl' ? unl : flt === 'done' ? done : all;
    const stats = [['st_sieges', fmt(S.st.sieges | 0)], ['st_wins', fmt(S.st.siegeWins | 0)], ['st_extracts', fmt(S.st.extracts | 0)], ['st_deaths', fmt(S.st.deaths | 0)], ['st_heat', S.heatWon >= 0 ? S.heatWon : '—'],
      ['st_boss', fmt(S.st.bossKills)], ['st_lords', fmt(S.st.lordKills)], ['st_clicks', fmt(S.clicks)], ['st_chests', fmt(S.st.chests)], ['st_best', S.bestDepth + 1], ['st_divine', fmt(S.st.divine)], ['st_time', G.fmtTime(S.st.playTime)]];
    body.innerHTML = `<p class="note">${esc(t('deedsSum', done.length, all.length, unl.filter(deedDone).length, unl.length))}</p>
      ${nx ? `<div class="nextUnl"><small>${esc(t('deedNext'))}</small><b>${esc(nx.d.hidden ? '???' : L(nx.d.name))}</b><span>${esc(nx.d.hidden ? '???' : L(nx.d.desc))}</span>
        <em class="unl">🔓 ${esc(unlockLabel(nx.d.unlock))}</em>${nxP ? `<div class="pbar"><i style="width:${Math.min(100, nxP[0] / nxP[1] * 100)}%"></i><span>${fmt(Math.min(nxP[0], nxP[1]))} / ${fmt(nxP[1])}</span></div>` : ''}</div>` : (unl.length ? `<p class="note good">${esc(t('deedAllUnl'))}</p>` : `<p class="note">${esc(t('deedNoUnl'))}</p>`)}
      <div class="tabTitle flt" data-dflt>${['unl', 'all', 'done'].map(k => `<button data-f="${k}" class="${flt === k ? 'on' : ''}">${esc(t('deedF_' + k))}</button>`).join('')}</div>
      <div class="achGrid deedGrid">${list.map(d => {
        const ok = deedDone(d), hide = d.hidden && !ok, p = !ok && d.unlock ? deedProg(d) : null;
        return `<div class="ach ${ok ? '' : 'no'} ${d.unlock ? 'unl' : ''}">${img(d.unlock ? 'ic_key' : 'ic_trophy', '', 3)}<div><b>${esc(hide ? '???' : L(d.name))}</b><small>${esc(hide ? '???' : L(d.desc))}</small>
          ${d.unlock ? `<small class="unl">${ok ? '✓ ' : '🔒 '}${esc(unlockLabel(d.unlock))}</small>` : ''}${p ? `<i class="mini"><u style="width:${Math.min(100, p[0] / p[1] * 100)}%"></u></i>` : ''}</div></div>`;
      }).join('') || `<p class="note">${esc(t('deedNone'))}</p>`}</div>
      <div class="sect">${esc(t('stats'))}</div><div class="statList">${stats.map(([k, v]) => `<span>${esc(t(k))}</span><b>${esc(v)}</b>`).join('')}</div>`;
    refs.deedN = done.length;
    body.querySelector('[data-dflt]').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (!b) return; deedFlt = b.dataset.f; UI.render(); });
  };
  updaters.deeds = function () { if (deedList().filter(deedDone).length !== refs.deedN) UI.render(); };

  // -- the Rift Gate: the Daily Siege (I), Push On (II), Vault kinds (III), Push loot (IV) --
  renderers.rift = function (body) {
    const S = G.S, L1 = G.bldLvl('rift'), day = G.utcDayKey ? G.utcDayKey() : G.todayKey(), ds = G.dailySetup ? G.dailySetup(day) : null;
    const tries = S.dailySiege && S.dailySiege.day === day ? S.dailySiege.tries | 0 : 0, siege = G.inSiege();
    const cls = ds && G.CLASS_BY_ID[ds.cls] ? L(G.CLASS_BY_ID[ds.cls].name) : '';
    body.innerHTML = `<div class="detail dailyBox">
        <h3>${img('ic_rift', '', 3)} ${esc(t('dailyTitle'))}</h3>
        ${ds ? `<p>${esc(t('dailySetupLine', btnInfo(ds.btn).name, cls, ds.heat))}</p>` : ''}
        <p class="note">${esc(t('dailyRules', (G.DAILY_SIEGE || {}).fame || 50, (G.DAILY_SIEGE || {}).gems || 5))}</p>
        <p>${esc(tries ? t('dailyTried', tries) : t('dailyFresh'))}</p>
        <div class="act"><button class="btn gold big" data-daily ${!G.D.daily || siege ? 'disabled' : ''}>${esc(!G.D.daily ? t('dailyNeedsGate') : siege ? t('siegeOn') : tries ? t('dailyAgain') : t('dailyGo'))}</button>
          ${G.Daily && G.Daily.ready && G.Daily.ready() ? `<button class="btn" data-dboard>${esc(t('dailyBoard'))}</button>` : ''}</div>
      </div>
      <div class="sect">${esc(t('riftPowers'))}</div>
      <div class="riftList">${[1, 2, 3, 4].map(k => `<div class="${L1 >= k ? 'on' : ''}"><b>${ROMAN5[k]}</b> ${esc(bldTxt('rift', k))}${L1 >= k ? ' ✓' : ''}</div>`).join('')}</div>
      <p class="note">${esc(t('riftOldGone'))}</p>`;
    body.addEventListener('click', e => {
      if (e.target.closest('[data-daily]')) { G.Audio.unlock(); UI.dailySiege(); return; }
      if (e.target.closest('[data-dboard]')) { G.Audio.unlock(); G.Daily.open(); }
    });
  };

  // Character: paper doll, stats, bag, enchanting and records
  let selGear = null; // gear uid
  const SLOT_ICON = { weapon: 'ic_sword', ability: 'ic_scroll', armor: 'it_chainmail', ring: 'it_copper_ring' };
  function findGear(u) {
    const h = G.S.hero;
    // worn by the member on screen, then by anyone else in the party, then in the bag
    const order = [selWho].concat([-1].concat(G.S.party.map((_, i) => i)).filter(w => w !== selWho));
    for (const w of order) { const eq = G.eqOf(w); for (const s of G.SLOTS) if (eq[s] && eq[s].u === u) return { g: eq[s], worn: s, who: w }; }
    const g = h.bag.find(x => x.u === u);
    return g ? { g, worn: null } : null;
  }
  function gearName(g) { return (g.q ? G.UNIQUES[g.q].name : L(G.ITEM_BY_ID[g.id].name)) + (g.e ? ' +' + g.e : ''); }
  const gearCol = g => (g.q ? (G.isRelic && G.isRelic(g) ? G.RELIC_COL : G.UNIQUE_COL) : G.RARITIES[g.r].color);
  const uqLabel = g => (G.isRelic && G.isRelic(g) ? `<b class="relicTxt" style="color:${G.RELIC_COL}">${esc(t('relic'))}</b>` : `<b style="color:${G.UNIQUE_COL}">${esc(t('unique'))}</b>`);
  function mainLine(g) {
    const slot = G.slotOf(g.id), type = G.ITEM_TYPE[g.id], v = G.mainStat(g);
    if (slot === 'weapon') return t('g_weapon', L(G.WEAPONS[type].name), fmt(v, true), G.WEAPONS[type].targets);
    if (slot === 'armor') return t('g_armor', fmt(v));
    if (slot === 'ring') return t('g_ring', G.fmtPct(v));
    return t('g_ability', G.fmtPct(v), L(G.ABILITIES[type].name), L(G.ABILITIES[type].desc));
  }
  // how good a roll is inside its range: T1 for the top fifth, a star for a near-perfect one
  function affLine(a, g) {
    const d = G.AFFIXES[a[0]];
    let tag = '';
    if (g && !g.q) {
      const k = 1 + 0.35 * g.r, q = (a[1] / k - d.v[0]) / (d.v[1] - d.v[0]);
      tag = q >= 0.95 ? ' <em class="t1">★ T1</em>' : q >= 0.8 ? ' <em class="t1">T1</em>' : '';
    }
    return `<li>${esc(L(d.name))} <b>${d.x ? '+' + a[1].toFixed(2) + '×' : G.fmtPct(a[1])}</b>${tag}</li>`;
  }
  function gearTile(g, extra) {
    return `<button class="gear r${g.r} ${g.q ? 'uq' : ''} ${isUltra(g) ? 'ult' : ''} ${G.isRelic && G.isRelic(g) ? 'relic' : ''} ${g.c ? 'corr' : ''} ${extra || ''}" data-g="${g.u}" style="--rc:${gearCol(g)}" aria-label="${esc(gearName(g))}">${img(G.gearSpr(g), '', 4)}${g.e ? `<em>+${g.e}</em>` : ''}<small>${g.il}</small><u hidden>▲</u>${g.keep ? `<i class="gk" title="${esc(t('lockedTip'))}">${img('ic_key', '', 1)}</i>` : ''}</button>`;
  }
  // The currency strip: tap an orb to use it on the selected item
  function orbBar(g) {
    const h = G.S.hero;
    return `<div class="orbBar">${G.ORB_IDS.map(id => {
      const O = G.ORBS[id], n = h.orbs[id] || 0, why = G.orbBlock(id, g);
      const tip = O.name + ': ' + O.desc + (n && why ? ' (' + t('orbNo_' + why, G.ENCHANT_MAX) + ')' : '');
      return `<button class="orb ${n ? '' : 'none'} ${n && !why ? 'can' : ''}" data-orb="${id}" title="${esc(tip)}" aria-label="${esc(O.name)}" style="--oc:${O.col}">${img('orb_' + id, '', 3)}<b>${fmt(n)}</b></button>`;
    }).join('')}</div>`;
  }
  // ---------- 4.0: items (ADDENDUM 1-3) ----------
  // Every item view says its rarity; the ultra-rares (mythic, divine, unique, relic) wear an animated rainbow name; their
  // Marks are named with one line each; perk ranks and a unique's rule show; any hero can be compared side by side
  // ('Worn | This', G.compareRows), by THE one ▲ rule (G.upgrade / G.bestWearer) that EQUIP BEST and auto-equip use.
  const isUltra = g => !!g && (!!g.q || g.r >= 5);
  UI.isUltra = isUltra;
  const rarName = g => (g.q ? t(G.isRelic && G.isRelic(g) ? 'relic' : 'unique') : L(G.RARITIES[g.r].name));
  const whoLabel = w => (w < 0 ? (G.S.profile.name || t('wardenName')) : L(G.CLASS_BY_ID[(G.S.party[w] || {}).cls || 'knight'].name));
  // the name as every view shows it: the rarity's colour, the rainbow for the ultra-rares
  UI.itemName = (g, cls) => `<b class="iName${isUltra(g) ? ' rbw' : ''}${cls ? ' ' + cls : ''}" style="--rc:${gearCol(g)}">${esc(gearName(g))}</b>`;
  UI.rarName = rarName;
  const markLines = g => (G.itemMarks ? G.itemMarks(g) : []).map(m => `<li class="iMark"><b class="rbw">◆ ${esc(m.name)} ${esc(m.roman)}</b> <span>${esc(m.text)}</span></li>`).join('');
  const perkName = k => (G.PERKS[k] ? G.PERKS[k].name : k);
  const rankChips = g => Object.keys(g.pk || {}).filter(k => (g.pk[k] | 0) > 0).map(k => `<span class="iRank">${G.PERKS[k] ? img(G.PERKS[k].icon, '', 2) : ''}${esc(t('loot_ranks', g.pk[k], perkName(k)))}</span>`).join('');
  // the whole item: name, rarity · slot · item level (and who wears it), the main stat, affixes, Marks, perk ranks, the rule
  UI.itemHtml = function (g, o) {
    o = o || {};
    const slot = G.slotOf(g.id), U = g.q ? G.UNIQUES[g.q] : null, mk = markLines(g), rk = rankChips(g);
    const wornBy = o.who != null ? `<b class="worn">${esc(t('twWornBy', whoLabel(o.who)))}</b>` : '';
    return `<div class="iView ${isUltra(g) ? 'ult' : ''}" style="--rc:${gearCol(g)}">
      <div class="iHead">${o.tile === false ? '' : gearTile(g)}<div>${UI.itemName(g)}
        <small class="iSub"><span class="rTag" style="--rc:${gearCol(g)}">${esc(rarName(g))}</span>${U ? ' · ' + esc(L(G.ITEM_BY_ID[g.id].name)) : ''} · ${esc(t('slot_' + slot))} · ${esc(t('ilvl', g.il))}${g.c ? ` · <b class="bad">${esc(t('corrupted'))}</b>` : ''}${g.att ? ' · ' + esc(t('itemAttuned')) : ''}${wornBy ? ' · ' + wornBy : ''}</small></div></div>
      <p class="iMain">${esc(mainLine(g))}</p>
      ${g.a.length ? `<ul class="affs">${g.a.map(a => affLine(a, g)).join('')}</ul>` : ''}
      ${mk ? `<ul class="iMarks" title="${esc(t('mark_party'))}">${mk}</ul>` : ''}
      ${rk ? `<div class="iRanks">${rk}</div>` : ''}
      ${U ? `<p class="uqfx"><b>${esc(t('itemRule'))}</b> ${esc(U.fx)}</p>` : ''}
    </div>`;
  };
  // a compared number, the way its row reads it
  function cmpFmt(k, v, g) {
    if (v == null || v === '') return '—';
    if (k === 'crit') return Math.round(v * 1000) / 10 + '%';
    if (k === 'main') { const sl = G.slotOf(g.id); return sl === 'weapon' || sl === 'armor' ? fmt(v, true) : G.fmtPct(v); }
    if (k.startsWith('aff:')) { const d = G.AFFIXES[k.slice(4)]; return !v ? '—' : d && d.x ? '+' + v.toFixed(2) + '×' : G.fmtPct(v); }
    return fmt(v, k === 'dps');
  }
  const ROMAN = ['—', 'I', 'II', 'III'];
  // the side-by-side block: the piece the hero wears now and this one, a row per stat with its change, then what the swap
  // gains or loses beyond numbers (a rule, a Mark, perk ranks) and the verdict by the one rule
  UI.cmpHtml = function (who, g) {
    if (!G.compareRows || !G.canWear(who, g)) return `<div class="cmp no"><p class="warn">${esc(t('twWrongClass'))}</p></div>`;
    const slot = G.slotOf(g.id), cur0 = G.eqOf(who)[slot] || null, cur = cur0 === g ? null : cur0, rows = G.compareRows(who, g);
    const num = [], extra = [];
    for (const r of rows) {
      if (r.k === 'rule') {
        const nm = q => (q && G.UNIQUES[q] ? G.UNIQUES[q].name : '');
        if (r.change === 'gain' || r.change === 'swap') extra.push(`<li class="up">▲ ${esc(t('cmp_ruleGain', nm(r.item)))}</li>`);
        if (r.change === 'lose' || r.change === 'swap') extra.push(`<li class="${r.kept ? '' : 'dn'}">▼ ${esc(t('cmp_ruleLose', nm(r.worn)))}${r.kept ? ' ' + esc(t('cmp_ruleKept')) : ''}</li>`);
        continue;
      }
      if (r.k.startsWith('mark:')) {
        const id = r.k.slice(5), a = r.worn | 0, b = r.item | 0;
        if (a === b) continue;
        extra.push(b > a ? `<li class="up">▲ ${esc(t('cmp_markGain', G.markName(id) + ' ' + ROMAN[b]))}${a ? ` <small>(${ROMAN[a]} → ${ROMAN[b]})</small>` : ''}</li>`
          : `<li class="${r.kept ? '' : 'dn'}">▼ ${esc(t('cmp_markLose', G.markName(id) + ' ' + ROMAN[a]))}${b ? ` <small>(${ROMAN[a]} → ${ROMAN[b]})</small>` : ''}${r.kept ? ' ' + esc(t('cmp_ruleKept')) : ''}</li>`);
        continue;
      }
      if (r.k.startsWith('perk:')) {
        const id = r.k.slice(5), d = (r.item | 0) - (r.worn | 0);
        if (d) extra.push(`<li class="${d > 0 ? 'up' : 'dn'}">${d > 0 ? '▲ ' + esc(t('cmp_rankGain', d, perkName(id))) : '▼ ' + esc(t('cmp_rankLose', -d, perkName(id)))}</li>`);
        continue;
      }
      const lbl = r.k.startsWith('aff:') ? L((G.AFFIXES[r.k.slice(4)] || {}).name || r.k) : t('cmp_' + r.k);
      const d = r.delta || 0, up = d > 1e-9, dn = d < -1e-9;
      // (the percent change on the hero's own numbers; the item's lines show the raw values)
      const pct = (r.k === 'power' || r.k === 'dps' || r.k === 'hp') && r.worn > 0 ? Math.round(d / r.worn * 1000) / 10 : null;
      num.push(`<span class="cl ${r.k === 'power' ? 'cpw' : ''}">${esc(lbl)}</span><span class="cw">${esc(cmpFmt(r.k, r.worn, g))}</span><span class="ct">${esc(cmpFmt(r.k, r.item, g))}</span><em class="${up ? 'up' : dn ? 'dn' : ''}">${up ? '▲' : dn ? '▼' : '='}${pct != null && (up || dn) ? ' ' + (pct > 0 ? '+' : '') + pct + '%' : ''}</em>`);
    }
    const p = G.wants(who, g), ok = G.upgrade(who, g);
    const verdict = cur0 === g ? `<p class="cmpV">${esc(t('cmpWornNow', whoLabel(who)))}</p>`
      : ok ? `<p class="cmpV up">▲ ${esc(t('cmpBetter', whoLabel(who), p >= 1 && !cur ? t('cmpEmpty') : '+' + Math.round(p * 100) + '%'))}</p>`
      : p > 1e-6 ? `<p class="cmpV keep">◇ ${esc(t('loot_keep'))}</p>`
      : `<p class="cmpV dn">▼ ${esc(t('cmpWorse', whoLabel(who)))}</p>`;
    return `<div class="cmp">
      <div class="cmpHead"><div class="cmpCol"><small>${esc(t('cmp_worn'))}</small>${cur ? `${gearTile(cur)}${UI.itemName(cur)}` : `<span class="gear none"></span><b class="dim">${esc(t('twEmpty'))}</b>`}</div>
        <div class="cmpCol"><small>${esc(t('cmp_this'))}</small>${gearTile(g)}${UI.itemName(g)}</div></div>
      <div class="cmpRows"><span></span><small>${esc(t('cmp_worn'))}</small><small>${esc(t('cmp_this'))}</small><span></span>${num.join('')}</div>
      ${extra.length ? `<ul class="cmpX">${extra.join('')}</ul>` : ''}${verdict}</div>`;
  };
  // the heroes to compare with: everyone in the party, a ▲ on whoever it is an upgrade for
  UI.whoPick = (g, on) => `<div class="cmpWho" role="group" aria-label="${esc(t('cmpWith'))}"><small>${esc(t('cmpWith'))}</small>${[-1].concat(G.S.party.map((_, i) => i)).map(w => {
    const m = w >= 0 ? G.S.party[w] : null, cls = m ? m.cls : G.S.hero.cls, can = G.canWear(w, g), up = can && G.upgrade(w, g);
    return `<button class="${w === on ? 'on' : ''} ${can ? '' : 'no'}" data-cmpwho="${w}" title="${esc(whoLabel(w))}"><img src="${G.Doll.portrait({ cls, eq: G.eqOf(w) }, 2, true)}" alt="">${up ? '<i class="up">▲</i>' : ''}</button>`;
  }).join('')}</div>`;
  // the default hero to compare with: whoever wears it, else whoever it suits best, else the one in view
  UI.cmpDefault = function (g, fallback) {
    for (const w of [-1].concat(G.S.party.map((_, i) => i))) if (G.SLOTS.some(s => G.eqOf(w)[s] === g)) return w;
    const b = G.bestWearer ? G.bestWearer(g) : null;
    if (b && b.up) return b.who;
    return fallback != null && G.canWear(fallback, g) ? fallback : (b && b.pct > -1 ? b.who : -1);
  };
  // a window on one item: its whole view, a hero to compare with, and EQUIP ON that hero (the loot moment's 'hold to look'
  // and anything else that wants it can open this)
  UI.itemCard = function (g, o) {
    o = o || {};
    let who = o.who != null ? o.who : UI.cmpDefault(g, -1);
    const findW = () => { for (const w of [-1].concat(G.S.party.map((_, i) => i))) if (G.SLOTS.some(s => G.eqOf(w)[s] === g)) return w; return null; };
    const draw = m => {
      const wearer = findW(), inBag = G.S.hero.bag.includes(g);
      const box = m.querySelector('[data-ic]'); if (!box) return;
      box.innerHTML = UI.itemHtml(g, { who: wearer }) + UI.whoPick(g, who) + UI.cmpHtml(who, g)
        + (inBag || (wearer != null && wearer !== who) ? `<div class="twActs"><button class="btn gold" data-icequip ${G.canWear(who, g) && wearer !== who ? '' : 'disabled'}>${esc(t('twEquipOn', whoLabel(who)))}</button></div>` : '');
    };
    const m = UI.modal(gearName(g), `<div class="itemCard" data-ic></div>`, [{ label: t('close'), cls: 'gold' }]);
    m.classList.add('itemM');
    draw(m);
    m.querySelector('[data-ic]').addEventListener('click', e => {
      const b = e.target.closest('[data-cmpwho]');
      if (b) { who = +b.dataset.cmpwho; draw(m); return; }
      if (e.target.closest('[data-icequip]')) {
        if (G.wearOn ? G.wearOn(g, who) : G.equip(g, false, who)) { G.Audio.buy(); UI.toast(`<span>${esc(t('equipped'))}: ${UI.itemName(g)} · ${esc(whoLabel(who))}</span>`, '', G.gearSpr(g), { p: 2 }); if (o.onEquip) o.onEquip(who); draw(m); UI.update(true); if (G.R.town && tw.id) renderTown(); }
        else G.Audio.error();
      }
    });
    return m;
  };
  // EQUIP BEST, one tap for the whole party (the fixed rules: companions take uniques), with who gained what
  UI.equipBest = function () {
    const n = G.equipBest();
    if (n) {
      G.Audio.levelUp && G.Audio.levelUp();
      const per = ((G.lastBest && G.lastBest.per) || []).filter(x => x.to > x.from && x.from > 0).map(x => esc(whoLabel(x.who)) + ' <b class="good">+' + Math.round((x.to / x.from - 1) * 100) + '%</b>');
      UI.toast(`<span>${esc(t('twBestDone', n))}${per.length ? '<br><small>' + per.join(' · ') + '</small>' : ''}</span>`, 'ach', 'ic_sword', { p: 2 });
    } else UI.toast(esc(t('twBestNone')), '', 'ic_sword', { p: 2 });
    upDirty = true; upsC = null; pingT = 0;
    return n;
  };
  // ---------- ENCHANT ALL (ADDENDUM 3; Forge I): a preview, then one tap ----------
  // the options are kept (PF().ench); the preview is the plan itself (G.enchantPlan: nothing changes until the tap)
  const enchOpts = () => { const pf = PF(); const e = pf.ench && typeof pf.ench === 'object' ? pf.ench : (pf.ench = {}); return { mode: e.mode === 'power' ? 'power' : 'even', whet: e.whet !== 0, bag: !!e.bag }; };
  let enchC = null, enchT = 0;
  // (the Forge's button counts what one tap would do: asked at most once a second)
  UI.enchantCount = function () {
    const now = performance.now();
    if (!enchC || now - enchT > 1000) { enchT = now; try { enchC = G.enchantPlan ? G.enchantPlan(enchOpts()) : null; } catch (e) { enchC = null; } }
    return enchC ? enchC.steps : 0;
  };
  ['enchantAll', 'enchant', 'gear', 'equipBest', 'salvage', 'ascend', 'recruit', 'useOrb'].forEach(k => G.on(k, () => { enchC = null; }));
  UI.enchantAsk = function (o) {
    o = o || {};
    const h = G.S.hero;
    if (!h || !h.cls || !G.enchantPlan) return null;
    if (!G.D.enchantAll) { G.Audio.error(); UI.toast(esc(t('enchNeedsForge')), '', 'npc_smith', { p: 2 }); return null; }
    const opts = enchOpts();
    const preview = () => {
      const P = G.enchantPlan(opts), siege = G.inSiege && G.inSiege();
      const rows = P.perHero.map(x => {
        const m = x.who >= 0 ? G.S.party[x.who] : null, cls = m ? m.cls : h.cls;
        const its = x.items.map(it => { const g = G.eqOf(x.who)[it.slot]; return g ? `<span class="enItem" title="${esc(gearName(g))}">${img(G.gearSpr(g), '', 2)}<small>+${it.from}→<b>+${it.to}</b></small></span>` : ''; }).join('');
        return `<div class="enRow"><img class="enPort" src="${G.Doll.portrait({ cls, eq: G.eqOf(x.who) }, 2, true)}" alt=""><div><b>${esc(whoLabel(x.who))}</b> <small>+${x.levels} · ${esc(t('power'))} ${fmt(x.before)} → <b class="good">${fmt(x.after)}</b> (+${Math.round(x.pct * 100)}%)</small><div class="enItems">${its}</div></div></div>`;
      }).join('');
      const cost = `${img('ic_shard', 'inl', 2)} ${fmt(P.cost.shards)}${P.cost.whet ? ` · ${img('orb_whet', 'inl', 2)} ${P.cost.whet}` : ''}${P.cost.gold ? ` · ${img('ic_coin', 'inl', 2)} ${fmt(P.cost.gold)}` : ''}`;
      return { P, html: (P.steps ? `<div class="enRows">${rows}</div><p class="enTot"><b>+${P.steps}</b> ${esc(t('enchLevels'))} · ${cost}</p>` : `<p class="note">${esc(t('ench_none'))}</p>`)
        + `<p class="note">${esc(t('enchHave', fmt(h.shards | 0), h.orbs.whet | 0))}${siege ? '' : ' ' + esc(t('enchGoldOut'))}</p>` };
    };
    const html = `<div class="ench">
      <div class="enOpts"><span class="seg" data-enmode>${['even', 'power'].map(k => `<button data-v="${k}" class="${opts.mode === k ? 'on' : ''}">${esc(t('ench_' + k))}</button>`).join('')}</span>
        <label><input type="checkbox" data-enwhet ${opts.whet ? 'checked' : ''}> ${esc(t('ench_whet', h.orbs.whet | 0))}</label>
        <label><input type="checkbox" data-enbag ${opts.bag ? 'checked' : ''}> ${esc(t('ench_bag'))}</label></div>
      <p class="note">${esc(t('enchHint'))}</p>
      <div data-enprev></div></div>`;
    const m = UI.modal(t('ench_all'), html, [{ label: t('ench_go', 0), cls: 'gold', fn: () => {
      const res = G.enchantAll(opts);
      if (res && res.steps) {
        G.Audio.levelUp && G.Audio.levelUp();
        const per = res.perHero.map(x => esc(whoLabel(x.who)) + ' <b class="good">+' + Math.round(x.pct * 100) + '%</b>').join(' · ');
        UI.toast(`<span><b>${esc(t('enchDoneN', res.steps))}</b>${per ? '<br><small>' + per + '</small>' : ''}</span>`, 'ach', 'orb_whet', { p: 2 });
        UI._enchFlash = performance.now();
      } else { G.Audio.error(); UI.toast(esc(t('ench_none')), '', 'ic_shard', { p: 2 }); }
      enchC = null;
      if (G.R.town && tw.id) renderTown(); UI.update(true);
      if (o.onDone) o.onDone(res);
    } }, { label: t('cancel') }]);
    m.classList.add('enchM');
    const upd = () => {
      const pv = preview(), box = m.querySelector('[data-enprev]'); if (box) box.innerHTML = pv.html;
      const go = m.querySelector('[data-a="0"]'); if (go) { go.textContent = t('ench_go', pv.P.steps); go.disabled = !pv.P.steps; }
      const pf = PF(); pf.ench = { mode: opts.mode, whet: opts.whet ? 1 : 0, bag: opts.bag ? 1 : 0 };
    };
    m.querySelector('[data-enmode]').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; opts.mode = b.dataset.v; m.querySelectorAll('[data-enmode] button').forEach(x => x.classList.toggle('on', x === b)); upd(); });
    m.querySelector('[data-enwhet]').addEventListener('change', e => { opts.whet = e.target.checked; upd(); });
    m.querySelector('[data-enbag]').addEventListener('change', e => { opts.bag = e.target.checked; upd(); });
    upd();
    return m;
  };
  renderers.hero = function (body) {
    const S = G.S, h = S.hero;
    if (!h.cls) { body.innerHTML = `<p class="note">${esc(t('pickClassHint'))}</p><button class="btn gold" data-pick>${esc(t('newSiege'))}</button>`; body.querySelector('[data-pick]').onclick = () => UI.newSiege(); return; }
    if (selWho >= S.party.length) selWho = -1;
    const who = selWho, mem = who >= 0 ? S.party[who] : null, cls = G.CLASS_BY_ID[mem ? mem.cls : h.cls];
    const salvOpts = [0, 1, 2, 3];
    body.innerHTML = `
      <p class="note">${esc(t('partyHint'))}</p>
      <div class="partyStrip" data-strip></div>
      <div class="charCard">
        <div class="portrait"><img data-doll src="${G.Doll.portrait(mem ? { cls: mem.cls, eq: mem.eq } : h, 4)}" alt=""></div>
        <div class="charInfo">
          ${mem ? `<div class="memName">${esc(L(cls.name))}</div>` : `<input id="heroName" maxlength="16" placeholder="${esc(t('namePh'))}" value="${esc(S.profile.name || '')}" aria-label="${esc(t('namePh'))}">`}
          <div class="clsLine">${esc(L(cls.name))} · <span class="r_${G.ROLES[cls.id]}" style="color:var(--role)">${esc(G.ROLE_NAMES[G.ROLES[cls.id]])}</span> · <span data-lvl></span></div>
          <div class="pbar"><i data-xp></i><span data-xpt></span></div>
          <div class="power"><small>${esc(t('power'))}</small><b data-pow></b></div>
        </div>
      </div>
      <div class="doll">${G.SLOTS.map(s => `<div class="dslot" data-slot="${s}"><span class="lbl">${esc(t('slot_' + s))}</span><div data-in></div></div>`).join('')}</div>
      <div class="bestRow"><button class="btn gold" data-bestall>${esc(t('twBest'))}</button><button class="btn enAll" data-enchall>${esc(G.D.enchantAll ? t('enchBtn', UI.enchantCount()) : t('enchLocked'))}</button></div>
      <div class="detail" data-gd></div>
      <div class="sect">${esc(t('orbs'))} <small style="color:var(--dim)">${esc(t('orbHint'))}</small></div>
      <div data-orbs></div>
      <div class="sect">${esc(t('bag'))} <span data-bagn></span> · ${img('ic_shard', 'inl', 2)} <span data-shards></span> ${esc(t('shards'))}</div>
      <div class="bag" data-bag></div>
      <div class="sect">${esc(mem ? t('roleTitleMem') : t('roleTitle'))}</div>
      <p class="note">${esc(mem ? t('roleHint_' + G.ROLES[mem.cls]) : t('roleHint'))}</p>
      <div class="statList" data-role></div>
      <div ${mem ? 'hidden' : ''}>
      <div class="sect">${esc(t('perksTitle'))}</div>
      <div class="perkList" data-perks></div>
      </div>
      <div class="statList heroStats" data-stats></div>
      <div class="setList" style="margin-top:8px">
        <div class="setRow"><span>${esc(t('autoEquip'))}</span><button class="toggle ${h.auto ? 'on' : ''}" data-ht="auto" aria-label="${esc(t('autoEquip'))}"></button></div>
        <div class="setRow"><span>${esc(t('autoCards'))}</span><button class="toggle ${h.autoPerk ? 'on' : ''}" data-ht="autoPerk" aria-label="${esc(t('autoCards'))}"></button></div>
        <div class="setRow"><span>${esc(t('autoCast'))}</span><button class="toggle ${h.cast ? 'on' : ''}" data-ht="cast" aria-label="${esc(t('autoCast'))}"></button></div>
        <div class="setRow"><span>${esc(t('autoSalv'))}</span><span class="seg" data-salv>${salvOpts.map(r => `<button data-r="${r}" class="${h.salv === r ? 'on' : ''}">${r === 0 ? esc(t('off')) : esc(L(G.RARITIES[r].name)).slice(0, 5) + '.'}</button>`).join('')}</span></div>
        <div class="setRow"><span>${esc(t('salvBelow'))}</span><button class="btn" data-salvall>${esc(t('salvage'))}</button></div>
      </div>
      <div class="sect">${esc(t('records'))}</div>
      <div class="statList" data-rec></div>
      <p class="note">${esc(t('ladderSoon'))}</p>`;
    refs.hero = {
      lvl: body.querySelector('[data-lvl]'), xp: body.querySelector('[data-xp]'), xpt: body.querySelector('[data-xpt]'), pow: body.querySelector('[data-pow]'),
      slots: $$('.dslot', body), gd: body.querySelector('[data-gd]'), stats: body.querySelector('[data-stats]'), bag: body.querySelector('[data-bag]'),
      bagn: body.querySelector('[data-bagn]'), shards: body.querySelector('[data-shards]'), rec: body.querySelector('[data-rec]'), key: '',
      role: body.querySelector('[data-role]'), perks: body.querySelector('[data-perks]'), orbs: body.querySelector('[data-orbs]'),
      strip: body.querySelector('[data-strip]'),
    };
    const nm = $('#heroName', body);
    if (nm) nm.addEventListener('change', e => { S.profile.name = e.target.value.trim().slice(0, 16); });
    body.addEventListener('click', e => {
      // pick whose gear you're looking at, or take on a new companion
      const pm = e.target.closest('[data-who]');
      if (pm) { selWho = +pm.dataset.who; selGear = null; UI.render(); return; }
      if (e.target.closest('[data-recruit]')) { if (G.inSiege()) UI.toast(esc(t('seatOpenCamp')), '', 'h_knight', { p: 2 }); else UI.recruit(); return; }
      const tg = e.target.closest('[data-ht]');
      if (tg) { h[tg.dataset.ht] = h[tg.dataset.ht] ? 0 : 1; tg.classList.toggle('on'); return; }
      const sb = e.target.closest('[data-salv] button');
      if (sb) { h.salv = +sb.dataset.r; $$('[data-salv] button', body).forEach(x => x.classList.toggle('on', x === sb)); return; }
      if (e.target.closest('[data-salvall]')) {
        // (locked items, uniques and worn gear stay)
        const r = scrapBelow(Math.max(1, h.salv || 2));
        UI.toast(esc(t('salvaged', r.n, fmt(r.v))), '', 'ic_shard', { p: 2 }); refs.hero.key = ''; return;
      }
      if (e.target.closest('[data-bestall]')) { UI.equipBest(); refs.hero.key = ''; refs.hero.dollKey = ''; updaters.hero(true); return; }
      if (e.target.closest('[data-enchall]')) { UI.enchantAsk({ onDone: () => { refs.hero.key = ''; updaters.hero(true); } }); return; }
      const cwb = e.target.closest('[data-cmpwho]');
      if (cwb) { refs.hero.cmpWho = +cwb.dataset.cmpwho; refs.hero.key = ''; updaters.hero(true); return; }
      const gt = e.target.closest('[data-g]');
      // the item's details sit above the bag: bring them into view, or on a phone nothing seems to happen
      if (gt) { selGear = +gt.dataset.g; refs.hero.key = ''; updaters.hero(true); if (refs.hero.gd) refs.hero.gd.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
      const ds = e.target.closest('.dslot');
      if (ds && !e.target.closest('[data-g]')) { const g = G.eqOf(selWho)[ds.dataset.slot]; if (g) { selGear = g.u; refs.hero.key = ''; updaters.hero(true); } return; }
      const ob = e.target.closest('[data-orb]');
      if (ob) {
        const f = findGear(selGear), id = ob.dataset.orb;
        if (!(h.orbs[id] > 0)) { G.Audio.error(); return; }
        const why = G.orbBlock(id, f && f.g);
        if (why) { G.Audio.error(); UI.toast(esc(t('orbNo_' + why, G.ENCHANT_MAX)), '', 'orb_' + id, { p: 2 }); return; }
        const res = G.useOrb(id, f.g);
        if (res) UI.toast(`<b style="color:${G.ORBS[id].col}">${esc(t('orbDone_' + res))}</b>`, res.startsWith('ruin') && res !== 'ruin_none' ? 'ach' : '', 'orb_' + id, { p: 2 });
        refs.hero.key = ''; updaters.hero(true); return;
      }
      const act = e.target.closest('[data-act]');
      if (act) {
        const f = findGear(selGear); if (!f) return;
        const a = act.dataset.act;
        // (4.0: onto the hero the card compares with, by the one rule's wearOn)
        if (a === 'equip') { const cw = refs.hero.cmpWho != null ? refs.hero.cmpWho : selWho; if (!G.canWear(cw, f.g) || !(G.wearOn ? G.wearOn(f.g, cw) : G.equip(f.g, false, cw))) G.Audio.error(); else { G.Audio.buy(); if (cw !== selWho) { selWho = cw; UI.render(); return; } } }
        else if (a === 'unequip') G.unequip(f.worn, f.who);
        else if (a === 'enchant') { if (!G.enchant(f.g)) G.Audio.error(); }
        else if (a === 'salvage') { if (f.g.keep) { G.Audio.error(); UI.toast(esc(t('lockedNoScrap')), '', 'ic_key', { p: 2 }); } else { const v = G.salvage(f.g); if (v) { UI.toast(esc(t('salvaged', 1, fmt(v))), '', 'ic_shard', { p: 2 }); selGear = null; } } }
        else if (a === 'lock') { if (f.g.keep) delete f.g.keep; else f.g.keep = 1; G.dirty(); }
        refs.hero.key = ''; updaters.hero(true);
      }
    });
    if (!selGear || !findGear(selGear)) { const e0 = G.eqOf(selWho); selGear = e0.weapon ? e0.weapon.u : null; }
  };
  // Taking on a companion: pick a class; the roles the party lacks come first
  UI.recruit = function () {
    const S = G.S;
    if (S.party.length >= G.partySlots()) return;
    const have = [S.hero.cls].concat(S.party.map(m => m.cls)).map(c => G.ROLES[c]);
    const need = r => !have.includes(r);
    const html = `<p>${esc(t('recruitHint'))}</p><div class="classGrid">${G.CLASSES.map(c => { const r = G.ROLES[c.id]; return `
      <button class="clsCard ${need(r) ? 'need' : ''}" data-c="${c.id}">${img(c.spr, '', 5)}<b>${esc(L(c.name))}</b><em class="role r_${r}">${esc(G.ROLE_NAMES[r])}${need(r) ? ' · ' + esc(t('recruitNeed')) : ''}</em><small>${esc(L(c.descAlly || c.desc))}</small></button>`; }).join('')}</div>`;
    const m = UI.modal(t('recruitTitle'), html, [{ label: t('close') }]);
    m.querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', () => {
      if (G.recruit(b.dataset.c)) { m.hidden = true; m.innerHTML = ''; selWho = S.party.length - 1; selGear = null; G.Audio && G.Audio.buy(); UI.render(); }
    }));
  };
  updaters.hero = function (force) {
    const S = G.S, D = G.D, h = S.hero, rf = refs.hero;
    if (!rf || !h.cls) return;
    if (selWho >= S.party.length) { selWho = -1; UI.render(); return; }
    const mem = selWho >= 0 ? S.party[selWho] : null, eqS = G.eqOf(selWho);
    const c = mem ? (D.party[selWho] || {}).c || D.hero : D.hero;
    // the party strip: everyone, their health, and the places still to fill
    const units = G.partyUnits(), slots = G.partySlots();
    // (built only when who is in it changes, so a tap is never lost to a rebuild; health updates in place)
    const sk = JSON.stringify([units.map(u => [u.who, u.cls, G.SLOTS.map(sl => u.eq[sl] ? u.eq[sl].id + (u.eq[sl].q || '') : '')]), slots, selWho]);
    if (rf.strip._k !== sk) {
      let sh = units.map(u => `<button class="pmem ${u.who === selWho ? 'on' : ''}" data-who="${u.who}"><img src="${G.Doll.portrait({ cls: u.cls, eq: u.eq }, 2, true)}" alt=""><small class="r_${u.role}">${esc(G.ROLE_NAMES[u.role])}</small><i><u></u></i></button>`).join('');
      for (let k = S.party.length; k < 3; k++) sh += k < slots ? `<button class="pmem add" data-recruit>+<small>${esc(t(G.inSiege() ? 'campShort' : 'recruit', k + 1))}</small></button>` : `<div class="pmem lock"><small>${esc(t('campShort', k + 1))}</small></div>`;
      rf.strip.innerHTML = sh; rf.strip._k = sk;
    }
    units.forEach((u, i) => { const b = rf.strip.children[i]; if (!b) return; setClass(b, 'down', u.down > 0); const bar = b.querySelector('u'); if (bar) bar.style.width = Math.round(100 * Math.max(0, u.hp) / u.max) + '%'; });
    setText(rf.lvl, t('lvl') + ' ' + h.lvl);
    rf.xp.style.width = Math.min(100, h.xp / G.xpNeed(h.lvl) * 100) + '%';
    setText(rf.xpt, fmt(Math.floor(h.xp)) + ' / ' + fmt(G.xpNeed(h.lvl)));
    const P = mem ? D.party[selWho] : null;
    setText(rf.pow, fmt(P ? P.c.power : D.power));
    setText(rf.shards, fmt(h.shards));
    setText(rf.bagn, h.bag.length + '/' + G.TUNE.bagMax);
    setClass(rf.bagn, 'full', h.bag.length >= G.TUNE.bagMax);
    setText($('#tabSub'), t('power') + ' ' + fmt(D.power));
    // what the Warden is doing for you right now
    const c0 = D.hero, critEV = 1 + c0.crit * (c0.critMult - 1);
    const bossSec = D.heroDps * D.bossMult, bossHp = G.bossMax(S.depth), limit = D.bossTime + (G.isLord(S.depth) ? 15 : 0);
    const alone = bossHp / Math.max(1e-9, bossSec);
    const role = [
      ['roleHorde', '×' + G.hordeScale().toFixed(1)],
      ['roleBossClick', fmt(D.heroHit * G.TUNE.clickVolley * D.bossMult * critEV, true)],
      ['roleBossSec', fmt(bossSec, true)],
      ['roleBoss', fmt(bossHp) + ' · ' + t('roleBossTime', alone > 999 ? '999+' : Math.ceil(alone), limit)],
    ];
    const roleHtml = role.map(([k, v]) => `<span>${esc(t(k))}</span><b>${esc(v)}</b>`).join('') + (alone > limit * 2 ? `<p class="note warn">${esc(t('roleWeak'))}</p>` : '');
    if (rf.role.innerHTML !== roleHtml) rf.role.innerHTML = roleHtml;
    const key = JSON.stringify([eqS, selWho, h.bag.length, h.bag.map(g => g.u + ':' + g.e + (g.keep ? 'k' : '')).join(), selGear, h.lvl, Math.floor(h.shards / 5), h.perks, h.orbs]);
    if (key === rf.key && !force) return;
    const pk = Object.keys(h.perks || {}).filter(k => h.perks[k] > 0);
    rf.perks.innerHTML = pk.length ? pk.map(k => {
      if (k.startsWith('evo_')) { const E = G.EVOS[k.slice(4)]; return `<div class="perkChip evo" title="${esc(E.desc)}">${img(E.icon, '', 3)}<b>${esc(E.name)}</b><small>★</small></div>`; }
      const P = G.PERKS[k]; return `<div class="perkChip" title="${esc(P.desc)}">${img(P.icon, '', 3)}<b>${esc(P.name)}</b><small>${h.perks[k]}/${P.max}</small></div>`;
    }).join('') : `<p class="note">${esc(t('perksNone'))}</p>`;
    rf.key = key;
    const dk = JSON.stringify(eqS) + selWho;
    if (dk !== rf.dollKey) { rf.dollKey = dk; const im = document.querySelector('.portrait img[data-doll]'); if (im) im.src = G.Doll.portrait(mem ? { cls: mem.cls, eq: mem.eq } : h, 4); }
    for (const el of rf.slots) {
      const g = eqS[el.dataset.slot];
      const box = el.querySelector('[data-in]');
      const hh = g ? gearTile(g, selGear === g.u ? 'sel' : '') : `<span class="empty">${img(SLOT_ICON[el.dataset.slot], '', 3, { dark: true })}</span>`;
      if (box._h !== hh) { box.innerHTML = hh; box._h = hh; }
    }
    // Bag, grouped by slot and sorted by power
    const order = G.SLOTS;
    const bag = h.bag.slice().sort((a, b) => order.indexOf(G.slotOf(a.id)) - order.indexOf(G.slotOf(b.id)) || b.r - a.r || b.il - a.il);
    rf.bag.innerHTML = bag.length ? bag.map(g => gearTile(g, selGear === g.u ? 'sel' : '')).join('') : `<p class="note">${esc(t('bagEmpty'))}</p>`;
    // upgrade arrows
    // (4.0: THE ▲ rule for the hero in view: G.upgrade; a blue ▲ when it suits someone else in the party)
    const bu = bagUps();
    $$('[data-g]', rf.bag).forEach(el => { const g = h.bag.find(x => x.u === +el.dataset.g); if (!g) return; const u = el.querySelector('u'); if (G.upgrade(selWho, g)) u.hidden = false; else if (bu.whoFor.has(g.u)) { u.hidden = false; u.classList.add('oth'); u.title = t('twBetterFor', whoName(bu.whoFor.get(g.u))); } });
    // Stats
    const cls = G.CLASS_BY_ID[mem ? mem.cls : h.cls];
    // a companion: what it really deals and takes, after its share and the run's bonuses
    const rows = [
      ['st_dps', fmt(P ? P.dps : c.dps, true)], ['st_hit', fmt(P ? P.hit : c.hit, true)], ['st_rate', (P ? P.rate : c.rate).toFixed(2) + t('perSec')], ['st_targets', c.targets],
      ['st_crit', Math.round(c.crit * 100) + '% · ×' + c.critMult.toFixed(1)], P ? ['st_unitHp', fmt(P.hp)] : ['st_hp', fmt(c.hp)],
      ...(P ? [] : [['st_wardenHp', fmt(D.wardenHp)]]),
      ['st_class', c.own ? t('classBonusOn') : t('classBonusOff', cls.weapons.map(w => L(G.WEAPONS[w].name)).join(', '))],
    ];
    rf.stats.innerHTML = rows.map(([k, v]) => `<span>${esc(t(k))}</span><b>${esc(v)}</b>`).join('');
    // Records (ladder material)
    const rec = [['rec_sieges', (S.st.sieges | 0) + ' · ' + t('rec_wins', S.st.siegeWins | 0)], ['rec_heat', S.heatWon >= 0 ? S.heatWon : '—'], ['rec_depth', S.bestDepth + 1], ['gsLadder', fmt(G.ladderSnapshot().power)], ['rec_power', fmt(S.rec.maxPower)], ['rec_level', S.rec.maxLevel], ['rec_mad', S.rec.madTime ? G.fmtTime(S.rec.madTime) : '—'],
      ['rec_jp', (S.jp && S.jp.n ? S.jp.n + ' · ' : '') + t('jpOdds', G.jackpotOdds ? G.jackpotOdds().toFixed(1) : '1.0')]];
    rf.rec.innerHTML = rec.map(([k, v]) => `<span>${esc(t(k))}</span><b>${esc(v)}</b>`).join('');
    // Detail
    const f = selGear ? findGear(selGear) : null;
    if (!f) { rf.gd.innerHTML = `<p>${esc(t('tapItem'))}</p>`; rf.orbs.innerHTML = orbBar(null); return; }
    const g = f.g;
    const ec = G.enchantCost(g);
    const canE = g.e < G.ENCHANT_MAX && h.shards >= ec.shards && S.gold >= ec.gold;
    // (4.0: the side-by-side 'Worn | This' for any hero: the one in view unless the card picked another)
    if (rf.cmpU !== g.u) { rf.cmpU = g.u; rf.cmpWho = f.worn ? f.who : UI.cmpDefault(g, selWho); }
    const cw = rf.cmpWho != null && rf.cmpWho < S.party.length ? rf.cmpWho : selWho;
    rf.orbs.innerHTML = orbBar(g);
    rf.gd.innerHTML = `${UI.itemHtml(g, { who: f.worn ? f.who : null })}
      ${UI.whoPick(g, cw)}${UI.cmpHtml(cw, g)}
      <div class="act">
        ${f.worn && f.who === cw ? `<button class="btn" data-act="unequip">${esc(t('unequip'))}</button>` : `<button class="btn gold" data-act="equip" ${G.canWear(cw, g) ? '' : 'disabled'}>${esc(t('twEquipOn', whoName(cw)))}</button>`}
        <button class="btn ${canE ? 'gold' : ''}" data-act="enchant" ${g.e >= G.ENCHANT_MAX ? 'disabled' : ''}>${esc(t('enchant'))} ${g.e >= G.ENCHANT_MAX ? t('max') : `${img('ic_shard', '', 2)}${fmt(ec.shards)}${ec.gold ? ` ${img('ic_coin', '', 2)}${fmt(ec.gold)}` : ''}`}</button>
        ${f.worn ? '' : `<button class="btn red" data-act="salvage" ${g.keep ? `disabled title="${esc(t('lockedNoScrap'))}"` : ''}>${esc(t('salvage'))} +${fmt(G.salvageValue(g))}</button>`}
        <button class="btn ${g.keep ? 'on' : ''}" data-act="lock" aria-pressed="${g.keep ? 'true' : 'false'}">${img('ic_key', '', 2)} ${esc(t(g.keep ? 'unlockItem' : 'lockItem'))}</button>
      </div>`;
  };
  // ---------- The Town (2.4): one window per building, over the field ----------
  // Forge: the party's gear, big and plain: who wears what, the bag, what an item would change, and the
  // buttons that matter (equip, equip best for everyone, upgrade, break down). The Enchanter is the same
  // window with the orbs first. Alchemist: brew the potion you want. Tavern: the party and new recruits.
  const tw = { id: null, who: -1, sel: null, filter: 'all', salv: 2 };
  const twEl = () => $('#townWin');
  UI.townOpen = function (id, sub) {
    if (!G.R.town) return;
    // a page's id opens the building that holds it
    if (!BLDS[id] && TAB_BLD[id]) { sub = id; id = TAB_BLD[id]; }
    const B = BLDS[id]; if (!B) return;
    if (!bldOpen(id)) { G.Audio.error(); UI.toast(esc(t('bldOpens', t('lock_' + id))), '', 'ic_scroll', { p: 2 }); return; }
    // QoL: a building opens on the tab it was left on
    const pf = PF(); pf.sub = pf.sub && typeof pf.sub === 'object' ? pf.sub : {};
    if (!sub && pf.sub[id]) sub = pf.sub[id];
    if (!sub || !B.subs.includes(sub) || !subOpen(sub)) sub = B.subs.find(subOpen);
    pf.sub[id] = sub;
    if (tw.id && tw.id !== id && (tw.id === 'forge' || tw.id === 'enchant')) bagSeen();
    tw.id = id; tw.sub = sub; tw.sel = null;
    if (tab === 'set') tab = 'upg';
    wtab = CUSTOM[sub] ? null : sub;
    G.S.seen.tabs[sub] = 1; pingT = 0;
    if (tw.who >= (G.S.party || []).length) tw.who = -1;
    twEl().hidden = false;
    UI.render();
    if (CUSTOM[sub]) renderTown();
    const sc = twEl().querySelector('.twTabBody'); if (sc) sc.scrollTop = 0;
  };
  UI.townClose = function (quiet) {
    const had = !!wtab;
    if (tw.id === 'forge' || tw.id === 'enchant') bagSeen();
    tw.id = null; wtab = null;
    const el = twEl(); if (el) { el.hidden = true; el.innerHTML = ''; }
    if (had && !quiet) UI.render(); else if (!quiet && G.R.town) UI.render();
  };
  // ---------- QoL: the town's quick bar ----------
  // Every window carries a row of the buildings that are open (one tap to the next, a dot where something wants
  // you, a ▲ where a build-up is affordable) and a FIELD button, so a phone's full-screen window is never a dead end.
  // Keys: 1–9, 0, − open a building; ← → step through them; Shift+← → the building's tabs; Esc closes.
  const BLD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-'];
  const bldSpr = id => (G.SPR.defs[BLD_SPR[id]] ? BLD_SPR[id] : 'ic_scroll');
  function twNav() {
    const keys = !matchMedia('(hover: none)').matches;
    // (4.0: between Sieges the bar's first button is NEW SIEGE)
    const idle = !G.inSiege() && !G.S.fallen;
    return `<nav class="twNav" aria-label="${esc(t('twNavLbl'))}">${idle ? `<button class="twGo siege" data-newsiege title="${esc(t('newSiege'))}" aria-label="${esc(t('newSiege'))}">${img('ic_skull', '', 2)}<b>${esc(t('newSiegeShort'))}</b></button>` : ''}<button class="twGo field" data-twgo="field" title="${esc(t('townBackTip'))}" aria-label="${esc(t('townBack'))}">${img(G.SPR.defs.ic_town ? 'ic_town' : 'ic_tomb', '', 2)}<b>${esc(t('townBack'))}</b></button>${BLD_ORDER.filter(bldOpen).map(id => {
      const k = BLD_KEYS[BLD_ORDER.indexOf(id)];
      return `<button class="twGo ${id === tw.id ? 'on' : ''}" data-twgo="${id}" title="${esc(t('town_' + id) + (keys ? ' (' + k + ')' : ''))}" aria-label="${esc(t('town_' + id))}"><span class="pic">${img(bldSpr(id), '', 1)}</span><small>${esc(t('twShort_' + id))}</small><i class="dot" hidden></i><i class="up" hidden>▲</i>${keys ? `<kbd class="hint">${k}</kbd>` : ''}</button>`;
    }).join('')}</nav>`;
  }
  let navT = 0;
  function twNavLive(force) {
    const el = twEl(); if (!el || el.hidden) return;
    const now = performance.now(); if (!force && now - navT < 400) return; navT = now;
    for (const b of el.querySelectorAll('.twGo[data-twgo]')) {
      const id = b.dataset.twgo; if (id === 'field') continue;
      const d = b.querySelector('.dot'), u = b.querySelector('.up'), p = id !== tw.id && bldPing(id), c = bldCanBuild(id);
      if (d && d.hidden === !!p) d.hidden = !p;
      if (u && u.hidden === !!c) u.hidden = !c;
    }
  }
  // the next (dir 1) or the previous (-1) open building; from the square, the first or the last
  UI.townStep = function (dir) {
    if (!G.R.town) return;
    const open = BLD_ORDER.filter(bldOpen); if (!open.length) return;
    let i = open.indexOf(tw.id);
    i = i < 0 ? (dir > 0 ? 0 : open.length - 1) : (i + dir + open.length) % open.length;
    G.Audio && G.Audio.unlock && G.Audio.unlock();
    UI.townOpen(open[i]);
    const w = twEl().querySelector('.tw'); if (w && !G.S.set.lowfx) w.classList.add(dir > 0 ? 'inR' : 'inL');
    // (the bar keeps the open building in view)
    const on = twEl().querySelector('.twGo.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  UI.townSub = function (dir) {
    const B = BLDS[tw.id]; if (!B || B.subs.length < 2) return;
    const subs = B.subs.filter(subOpen), i = subs.indexOf(tw.sub);
    if (subs.length > 1) UI.townOpen(tw.id, subs[(i + dir + subs.length) % subs.length]);
  };
  // gear the player has looked at: anything newer shows a NEW tag in the Forge
  const bagMaxU = () => (G.S.hero && G.S.hero.bag || []).reduce((m, g) => Math.max(m, g.u || 0), 0);
  function bagSeen() { const pf = PF(); pf.seenU = Math.max(pf.seenU || 0, bagMaxU()); }
  // a building's tabs (the Tavern: party, character, ladder; the Museum: collection, trophies)
  function twSubRow(id) {
    const B = BLDS[id]; if (!B || B.subs.length < 2) return '';
    return `<nav class="twSubs">${B.subs.map(x => `<button class="${x === tw.sub ? 'on' : ''}" data-twsub="${x}" ${subOpen(x) ? '' : 'disabled'}>${esc(x === 'tavern' ? t('twSubParty') : x === 'hero' ? t('twSubChar') : x === 'enchant' ? t('town_enchant') : x === 'gamble' ? t('gambleTab') : t('tab_' + x))}</button>`).join('')}</nav>`;
  }
  // ---------- 4.0: the Town in Embers (DESIGN §4.5): each level an unlock, 50 / 150 / 400 / 1,000 / 2,500 Embers ----------
  const ROMAN5 = ['0', 'I', 'II', 'III', 'IV', 'V'];
  const EMB = () => (G.SPR.defs.ic_ember ? 'ic_ember' : 'ic_fame');
  UI.EMB = EMB;
  const embersHave = () => Math.floor(G.S.embers || 0);
  const bldTxt = (id, L) => t('bld_' + id + '_' + L);
  // building it up: its level, what it gives now and what the next level opens, the price, and the whole I-V table
  function twBldFoot(id) {
    if (!G.BLD_BY_ID[id]) return '';
    const L = G.bldLvl(id), M = G.BLD_MAX, c = G.bldCost(id), can = L < M && embersHave() >= c;
    return `<footer class="twBld"><span class="lv"><b>${esc(t('town_' + id))} ${ROMAN5[L]}</b>${'<i class="pip on"></i>'.repeat(L)}${'<i class="pip"></i>'.repeat(M - L)}</span>
      <span class="fx">${L ? `<span class="now">${esc(bldTxt(id, L))}</span>` : `<span class="now dim">${esc(t('bldNone'))}</span>`}${L < M ? ` <em>${ROMAN5[L + 1]}: ${esc(bldTxt(id, L + 1))}</em>` : ''}</span>
      <button class="btn lvBtn" data-twlevels="${id}" title="${esc(t('bldTable'))}">I–V</button>
      ${L < M ? `<button class="btn ${can ? 'gold' : ''}" data-twbuild="${id}">${esc(t('bldUpTo', ROMAN5[L + 1]))} ${img(EMB(), '', 2)}${fmt(c)}</button>` : `<b class="max">${esc(t('bldMax'))}</b>`}</footer>`;
  }
  function twFootLive() {
    const b = twEl().querySelector('[data-twbuild]'); if (!b) return;
    setClass(b, 'gold', embersHave() >= G.bldCost(b.dataset.twbuild));
  }
  // the I-V table of one building: what each level opens, what it costs, what is built
  UI.bldLevels = function (id) {
    if (!G.BLD_BY_ID[id]) return null;
    const L = G.bldLvl(id), rows = [1, 2, 3, 4, 5].map(k => `<div class="blvRow ${k <= L ? 'done' : k === L + 1 ? 'next' : ''}"><b>${ROMAN5[k]}</b><span>${esc(bldTxt(id, k))}</span><em>${k <= L ? '✓' : `${img(EMB(), '', 2)}${fmt(G.BLD_COST[k - 1])}`}</em></div>`).join('');
    const can = L < G.BLD_MAX && embersHave() >= G.bldCost(id) && bldOpen(id);
    const acts = [];
    if (L < G.BLD_MAX) acts.push({ label: t('bldUpTo', ROMAN5[L + 1]) + ' · ' + fmt(G.bldCost(id)), cls: can ? 'gold' : '', fn: () => { if (G.buildUp(id)) { G.Audio.levelUp && G.Audio.levelUp(); UI.toast(esc(t('bldDone', t('town_' + id), ROMAN5[G.bldLvl(id)])), 'ach', G.SPR.defs[BLD_SPR[id]] ? BLD_SPR[id] : 'ic_town', { p: 2 }); pingT = 0; UI.render(); if (G.R.town && tw.id && CUSTOM[tw.sub]) renderTown(); } else { G.Audio.error(); UI.toast(esc(t('bldNoEmbers', fmt(G.bldCost(id) - embersHave()))), '', EMB(), { p: 2 }); } } });
    acts.push({ label: t('close') });
    const m = UI.modal(t('town_' + id), `<p class="note">${esc(t('bldTableHint'))}</p><div class="blvTab">${rows}</div><p class="blvHave">${img(EMB(), 'inl', 2)} <b>${fmt(embersHave())}</b> ${esc(t('embers'))}</p>`, acts);
    m.classList.add('blvM');
    return m;
  };
  // ---------- QoL: what wants you, in one list ----------
  // The town's panel and the welcome-back card both show it: each line is one tap to where it's done.
  // (4.0: the retired upgrades (sense, hall, golem, crew: off) never show)
  const visUpg = S => G.UPGRADES.filter(u => !u.off && ((S.upg[u.id] || 0) > 0 || (!u.req || S.upg[u.req] > 0) && (u.secret ? S.goldRun >= u.secret : S.goldTotal >= u.base * 0.3 || u.id === 'finger')));
  const hallCan = () => bldOpen('temple') && G.LEGACY.some(l => (G.S.legacy[l.id] || 0) < l.max && G.S.fame >= G.legacyCost(l));
  const starCan = () => bldOpen('stars') && G.NODES.some(n => (G.S.nodes[n.id] || 0) < n.max && G.nodeVisible(n) && G.nodeAvailable(n) && (G.S.embers || 0) >= G.nodeCost(n));
  function todoList() {
    const S = G.S, h = S.hero, out = [];
    if (!h) return out;
    const siege = G.inSiege();
    // (between Sieges: the next one first)
    if (!siege && !S.fallen) out.push({ k: 'siege', icon: 'ic_skull', txt: t('todoSiege'), go: 1 });
    if (h.cls) {
      // (the level-up cards wait on the field while you're in town)
      if (G.R.town && h.offer) out.push({ k: 'perk', icon: 'ic_star', txt: t('todoPerk') });
      const ups = bagUpsC().total;
      if (ups) out.push({ k: 'best', icon: 'ic_sword', txt: t('todoBest', ups) });
      const en = G.D.enchantAll ? UI.enchantCount() : 0;
      if (en >= 5) out.push({ k: 'ench', icon: 'orb_whet', txt: t('todoEnch', en) });
      if (h.bag.length >= G.TUNE.bagMax) out.push({ k: 'forge', icon: 'ic_bag', txt: t('todoBag', h.bag.length), warn: 1 });
    }
    const qd = S.quests.filter(q => q.done).length + (G.dailyAvailable() ? 1 : 0);
    if (qd && bldOpen('quests')) out.push({ k: 'quests', icon: 'ic_scroll', txt: t('todoQuests', qd) });
    if (S.eggs >= 1 && bldOpen('pets')) out.push({ k: 'pets', icon: 'ic_egg', txt: t('todoEggs', fmt(S.eggs)) });
    if (starCan()) out.push({ k: 'stars', icon: EMB(), txt: t('todoStars') });
    if (hallCan()) out.push({ k: 'temple', icon: 'ic_fame', txt: t('todoFame') });
    if (siege && h.cls) { const nu = visUpg(S).filter(u => !(u.max && (S.upg[u.id] || 0) >= u.max) && S.gold >= G.upgCost(u)).length; if (nu && !S.set.autoInvest) out.push({ k: 'upg', icon: 'ic_rune', txt: t('todoUpg', nu) }); }
    const nb = BLD_ORDER.filter(bldCanBuild).length;
    if (nb) out.push({ k: 'build', icon: G.SPR.defs.ic_town ? 'ic_town' : 'ic_tomb', txt: t('todoBuild', nb) });
    return out;
  }
  UI.todoList = todoList;
  function todoGo(k) {
    G.Audio && G.Audio.unlock && G.Audio.unlock();
    if (k === 'siege') { UI.newSiege(); return; }
    if (k === 'best') { UI.equipBest(); if (G.R.town && tw.id) renderTown(); UI.render(); return; }
    if (k === 'ench') { if (!G.R.town && !G.enterTown()) return; UI.townOpen('forge'); UI.enchantAsk(); return; }
    if (k === 'upg') { if (G.R.town) G.leaveTown(); tab = 'upg'; UI.render(); return; }
    if (k === 'perk') { if (G.R.town) G.leaveTown(); return; }
    if (!G.R.town && !G.enterTown()) { G.Audio.error(); UI.toast(esc(t('townNo')), '', 'ic_tomb', { p: 2 }); return; }
    if (k === 'build') { const id = BLD_ORDER.filter(bldCanBuild).sort((x, y) => G.bldCost(x) - G.bldCost(y))[0]; if (id) UI.townOpen(id); return; }
    if (k === 'temple') { UI.townOpen('temple', 'hall'); return; }
    UI.townOpen(k, k === 'tavern' ? 'tavern' : undefined);
  }
  UI.todoGo = todoGo;
  const todoHtml = list => list.length ? `<div class="todo">${list.map(x => `<button class="todoRow ${x.warn ? 'warn' : ''} ${x.go ? 'go' : ''}" data-todo="${x.k}">${img(G.SPR.defs[x.icon] ? x.icon : 'ic_star', '', 2)}<span>${esc(x.txt)}</span><i>›</i></button>`).join('')}</div>` : '';
  // the NEW SIEGE block (between Sieges): the big button and what AGAIN would bring
  function siegeBlock() {
    const S = G.S;
    if (G.inSiege() || S.fallen) return '';
    const ls = S.lastSetup, btn = ls && ls.btn ? btnInfo(ls.btn) : null;
    const sub = ls && ls.cls && G.CLASS_BY_ID[ls.cls] ? t('siegeLast', btn ? btn.name : t('btn_classic'), L(G.CLASS_BY_ID[ls.cls].name), ls.heat | 0) : t('siegeFirst');
    return `<div class="siegeBox"><button class="btn gold big newSiege" data-newsiege>${img('ic_skull', '', 3)} ${esc(t('newSiege'))}</button><small>${esc(sub)}</small></div>`;
  }
  UI.siegeBlock = siegeBlock;
  // the purse in town: Embers (the town, the Star Chart), Fame (the Hall of Fame), Gems
  const purseHtml = () => `<div class="purse"><span title="${esc(t('embersTip'))}">${img(EMB(), '', 2)}<b>${fmt(embersHave())}</b> <small>${esc(t('embers'))}</small></span><span title="${esc(t('fameTip'))}">${img('ic_fame', '', 2)}<b>${fmt(Math.floor(G.S.fame || 0))}</b> <small>${esc(t('fame'))}</small></span><span>${img('ic_gem', '', 2)}<b>${fmt(G.S.gems || 0)}</b> <small>${esc(t('gems'))}</small></span></div>`;
  // the panel, in town: the next Siege, the purse, what wants you, every building with its level, what the next level
  // opens and its price
  renderers.towndir = function (body) {
    const S = G.S, todo = todoList().filter(x => x.k !== 'siege'), canB = BLD_ORDER.filter(bldCanBuild);
    refs.todoKey = todo.map(x => x.k + x.txt).join('|') + '|' + G.inSiege();
    body.innerHTML = `${siegeBlock()}${purseHtml()}${todo.length ? `<div class="sect">${esc(t('todoTitle'))}</div>${todoHtml(todo)}` : ''}<p class="note">${esc(t('dirHint4'))}</p>
      <div class="dirLvl">${esc(t('dirLvl', G.townLvl()))} <small>/ ${G.BLD.length * G.BLD_MAX}</small></div>
      <div class="dirList">${BLD_ORDER.map(id => {
        const open = bldOpen(id), L = G.bldLvl(id), sp = G.SPR.defs[BLD_SPR[id]] ? BLD_SPR[id] : 'ic_scroll', nx = L < G.BLD_MAX;
        return `<button class="dirRow ${open ? '' : 'locked'} ${tw.id === id ? 'on' : ''}" data-dir="${id}">
          <span class="pic">${img(open ? sp : (G.SPR.defs.tw_build ? 'tw_build' : sp), '', 1)}</span>
          <span class="txt"><b>${esc(t('town_' + id))} <em class="lvR">${ROMAN5[L]}</em></b><small>${open ? (nx ? `${esc(ROMAN5[L + 1])}: ${esc(bldTxt(id, L + 1))}` : esc(t('bldMax'))) : esc(t('bldLocked') + ': ' + t('bldOpens', t('lock_' + id)))}</small></span>
          ${open && nx ? `<span class="cost">${img(EMB(), '', 2)}<b>${fmt(G.bldCost(id))}</b></span>` : ''}
          <span class="dot" hidden></span><i class="up" hidden>▲</i></button>`;
      }).join('')}</div>
      <button class="btn gold ${canB.length ? '' : 'dim'}" data-dirall>${esc(t('dirBuildAll'))}${canB.length ? ` · ${canB.length}` : ''}</button>
      <button class="btn big" data-dirback>${esc(t(G.inSiege() ? 'dirBack' : 'dirBackIdle'))}</button>
      ${matchMedia('(hover: none)').matches ? `<p class="note">${esc(t('dirSwipe'))}</p>` : `<p class="note keys">${esc(t('dirKeys'))}</p>`}`;
    body.addEventListener('click', e => {
      if (e.target.closest('[data-newsiege]')) { UI.newSiege(); return; }
      const td = e.target.closest('[data-todo]');
      if (td) { todoGo(td.dataset.todo); return; }
      const r = e.target.closest('[data-dir]');
      if (r) { G.Audio.unlock(); G.Audio.buy && G.Audio.buy(); UI.townOpen(r.dataset.dir); return; }
      if (e.target.closest('[data-dirback]')) { G.Audio.unlock(); G.leaveTown(); }
      if (e.target.closest('[data-dirall]')) {
        G.Audio.unlock(); let n = 0;
        for (let k = 0; k < 60; k++) { const id = BLD_ORDER.filter(bldCanBuild).sort((x, y) => G.bldCost(x) - G.bldCost(y))[0]; if (!id || !G.buildUp(id)) break; n++; }
        if (n) { G.Audio.levelUp && G.Audio.levelUp(); UI.toast(esc(t('dirBuilt', n)), 'ach', 'ic_town', { p: 2 }); pingT = 0; UI.render(); } else G.Audio.error();
      }
    });
    refs.dir = { rows: $$('[data-dir]', body) };
  };
  updaters.towndir = function () {
    const rf = refs.dir; if (!rf) return;
    // (the to-do list follows what changes, checked twice a second; never while a finger is down on the panel)
    if (performance.now() - (rf.tdT || 0) > 500 && !UI._panelDown) { rf.tdT = performance.now(); const k = todoList().filter(x => x.k !== 'siege').map(x => x.k + x.txt).join('|') + '|' + G.inSiege(); if (k !== refs.todoKey) { UI.render(); return; } }
    for (const r of rf.rows) {
      const id = r.dataset.dir, d = r.querySelector('.dot'), u = r.querySelector('.up'), p = bldPing(id), c = bldCanBuild(id);
      if (d.hidden === p) d.hidden = !p;
      if (u.hidden === c) u.hidden = !c;
      setClass(r, 'on', tw.id === id);
      if (r.classList.contains('locked') === bldOpen(id)) { UI.render(); return; }
    }
  };
  const memOf = who => (who >= 0 ? G.S.party[who] : null);
  const clsOf = who => (who >= 0 ? G.S.party[who].cls : G.S.hero.cls);
  // (4.0: the one rule set, hero.js: G.canWear(who, g) / G.upgrade(who, g) / G.bagUps)
  const canWear = (g, who) => G.canWear(who, g);
  function twFind(u) {
    const h = G.S.hero;
    for (const g of h.bag) if (g.u === u) return { g, worn: null, who: null };
    for (const s of G.SLOTS) if (h.eq[s] && h.eq[s].u === u) return { g: h.eq[s], worn: s, who: -1 };
    for (let i = 0; i < (G.S.party || []).length; i++) for (const s of G.SLOTS) { const g = G.S.party[i].eq[s]; if (g && g.u === u) return { g, worn: s, who: i }; }
    return null;
  }
  function twHeader(npc, title, sub) {
    return `<header class="twHead">${img(npc, '', 4)}<div><b>${esc(title)}</b><small>${esc(sub)}</small></div><button class="twX" data-tw="close" aria-label="${esc(t('close'))}">✕</button></header>`;
  }
  const whoName = w => (w < 0 ? (G.S.profile.name || t('wardenName')) : L(G.CLASS_BY_ID[clsOf(w)].name));
  // QoL: what in the bag is an upgrade for whom: the count per member, the total, and for each item its best wearer.
  // 4.0: THE rule (G.bagUps, hero.js): companions take uniques too (the ring bug), so every ▲ is what EQUIP BEST does
  function bagUps() {
    const S = G.S, h = S.hero;
    if (!h || !h.cls) return { total: 0, n: {}, whoFor: new Map() };
    return G.bagUps();
  }
  UI.bagUps = bagUps;
  // (the badges ask often: a fresh answer at most every 400 ms)
  let upsC = null, upsT = 0;
  function bagUpsC() { const now = performance.now(); if (!upsC || now - upsT > 400) { upsC = bagUps(); upsT = now; } return upsC; }
  // QoL: breaking down many at once never takes a locked item, a unique or anything someone wears
  const scrapList = r => G.S.hero.bag.filter(g => g.r < r && !g.q && !g.keep && !G.isWorn(g));
  function scrapBelow(r) {
    const list = scrapList(r); let v = 0;
    for (const g of list) v += G.salvage(g, true);
    if (list.length) { G.emit('salvage', null, v); G.dirty(); G.recalc(); }
    return { n: list.length, v };
  }
  UI.scrapBelow = scrapBelow;
  // pick the rarity, see how many go and the shards they give, then confirm
  UI.scrapAsk = function () {
    const pf = PF(); let r = Math.min(6, Math.max(1, pf.salv || 2));
    const html = `<p class="note">${esc(t('scrapHint'))}</p>
      <div class="scrapSeg">${[1, 2, 3, 4, 5, 6].map(i => `<button data-sr="${i}" style="--rc:${G.RARITIES[i].color}" class="${i === r ? 'on' : ''}">${esc(L(G.RARITIES[i].name))}</button>`).join('')}</div>
      <p class="scrapSum" data-ssum></p>`;
    const m = UI.modal(t('scrapTitle'), html, [{ label: t('salvage'), cls: 'red', fn: () => {
      const res = scrapBelow(r);
      if (res.n) { G.Audio.buy(); UI.toast(esc(t('salvaged', res.n, fmt(res.v))), '', 'ic_shard', { p: 2 }); } else G.Audio.error();
      if (G.R.town && tw.id) renderTown(); UI.update(true);
    } }, { label: t('cancel') }]);
    const upd = () => {
      const list = scrapList(r), v = list.reduce((a, g) => a + G.salvageValue(g), 0), kept = G.S.hero.bag.filter(g => g.r < r && (g.keep || g.q)).length;
      const sm = m.querySelector('[data-ssum]'); if (sm) sm.innerHTML = `${esc(t('scrapSum', list.length, L(G.RARITIES[r].name)))} ${img('ic_shard', 'inl', 2)} <b>+${fmt(v)}</b>${kept ? `<br><small>${esc(t('scrapKept', kept))}</small>` : ''}`;
      const go = m.querySelector('[data-a="0"]'); if (go) { go.textContent = t('scrapGo', list.length); go.disabled = !list.length; }
    };
    m.querySelector('.scrapSeg').addEventListener('click', e => {
      const b = e.target.closest('[data-sr]'); if (!b) return;
      r = +b.dataset.sr; pf.salv = r;
      m.querySelectorAll('[data-sr]').forEach(x => x.classList.toggle('on', x === b)); upd();
    });
    upd();
    return m;
  };
  function twWhoRow() {
    const S = G.S, units = [{ who: -1, cls: S.hero.cls, eq: S.hero.eq }].concat((S.party || []).map((m, i) => ({ who: i, cls: m.cls, eq: m.eq })));
    const ups = bagUps();
    return `<div class="twWho">${units.map(u => `<button class="${u.who === tw.who ? 'on' : ''}" data-twwho="${u.who}"><img src="${G.Doll.portrait({ cls: u.cls, eq: u.eq }, 2, true)}" alt=""><small>${esc(whoName(u.who))}</small>${ups.n[u.who] ? `<em class="upN" title="${esc(t('twUpsFor', ups.n[u.who]))}">▲${ups.n[u.who]}</em>` : ''}</button>`).join('')}</div>`;
  }
  function renderForge(el) {
    const S = G.S, h = S.hero, who = tw.who, m = memOf(who), eq = m ? m.eq : h.eq, enchant = tw.id === 'enchant';
    const c = G.heroCombat(eq, G.D, m ? { cls: m.cls, lvl: h.lvl } : undefined);
    const f = tw.sel != null ? twFind(tw.sel) : null;
    if (tw.sel != null && !f) tw.sel = null;
    const slots = G.SLOTS.map(s => {
      const g = eq[s];
      return `<div class="twSlot ${g && tw.sel === g.u ? 'sel' : ''}" role="button" tabindex="0" ${g ? `data-twg="${g.u}"` : `data-twf="${s}"`}>
        <span class="lbl">${esc(t('slot_' + s))}</span>
        <span class="row">${g ? gearTile(g) : `<span class="empty">${img(SLOT_ICON[s], '', 3, { dark: true })}</span>`}
        <span class="nm">${g ? UI.itemName(g) : esc(t('twEmpty'))}</span></span></div>`;
    }).join('');
    // QoL: the bag sorts by slot, rarity, power (for whoever is picked) or newest. 4.0: each tile carries THE ▲ rule
    // (G.upgrade, what EQUIP BEST and auto-equip do): a green ▲ is better for the hero in view, a blue ▲ for someone else
    // (its best wearer), ▼ for nobody; NEW since the last look; a key when locked; the rainbow ring for the ultra-rares
    const srt = PF().sort || 'slot', seenU = PF().seenU || 0, ups = bagUps();
    const gain = g => { const p = G.wants(who, g); return p == null ? -Infinity : p; };
    const gn = new Map(h.bag.map(g => [g, gain(g)]));
    const bySlot = (a, b) => G.SLOTS.indexOf(G.slotOf(a.id)) - G.SLOTS.indexOf(G.slotOf(b.id));
    const SORTS = { slot: (a, b) => bySlot(a, b) || b.r - a.r || b.il - a.il, rar: (a, b) => (b.q ? 9 : b.r) - (a.q ? 9 : a.r) || b.il - a.il || bySlot(a, b),
      pow: (a, b) => gn.get(b) - gn.get(a) || b.r - a.r, new: (a, b) => b.u - a.u };
    const bag = h.bag.filter(g => tw.filter === 'all' || G.slotOf(g.id) === tw.filter).sort(SORTS[srt] || SORTS.slot);
    const tiles = bag.map(g => {
      const ok = G.canWear(who, g), mine = ok && G.upgrade(who, g), bw = ups.whoFor.get(g.u), oth = !mine && bw != null && bw !== who;
      const mark = mine ? '<i class="up">▲</i>' : oth ? `<i class="oth" title="${esc(t('twBetterFor', whoName(bw)))}">▲</i>` : bw == null ? '<i class="dn">▼</i>' : '';
      // (who it suits best, a small head in the corner)
      const head = bw != null && (mine || oth) ? `<i class="bw">${img(G.CLASS_BY_ID[clsOf(bw)].spr, '', 1)}</i>` : '';
      return `<span class="twTile ${ok ? '' : 'no'} ${mine ? 'better' : ''} ${tw.sel === g.u ? 'sel' : ''} ${g.keep ? 'kept' : ''}" data-twg="${g.u}">${gearTile(g)}${mark}${head}${g.u > seenU ? `<i class="new">${esc(t('newTag'))}</i>` : ''}</span>`;
    }).join('');
    // the item card: the whole item, a hero to compare it with (whoever wears it, else its best wearer, else the one in
    // view) and the side-by-side 'Worn | This'; equip on that hero, upgrade, break down, lock, orbs
    let card = `<div class="twCard empty"><p>${esc(t(enchant ? 'twPickEnchant' : 'twPick'))}</p></div>`;
    if (f) {
      const g = f.g, ec = G.enchantCost(g);
      const canE = g.e < G.ENCHANT_MAX && h.shards >= ec.shards && S.gold >= ec.gold;
      if (tw.cmpU !== g.u) { tw.cmpU = g.u; tw.cmpWho = UI.cmpDefault(g, who); }
      const cw = tw.cmpWho != null && (tw.cmpWho < 0 || tw.cmpWho < S.party.length) ? tw.cmpWho : who;
      const wearer = f.who != null ? f.who : null;
      const sealable = enchant && !g.q && !g.c && g.a.length;
      card = `<div class="twCard">
        ${UI.itemHtml(g, { who: wearer })}
        ${sealable ? `<ul class="affs seal">${g.a.map((a, i) => affLine(a, g).replace(/<\/li>$/, ` <button class="sealB ${g.lk === i ? 'on' : ''}" data-twseal="${i}">${esc(g.lk === i ? t('sealed') : t('seal'))}</button></li>`)).join('')}</ul><p class="hint">${esc(t('sealHint', fmt(G.sealCost(g))))}</p>` : ''}
        ${UI.whoPick(g, cw)}${UI.cmpHtml(cw, g)}
        <div class="twActs">
          ${wearer === cw ? `<button class="btn" data-twa="unequip">${esc(t('unequip'))}</button>` : `<button class="btn gold" data-twa="equip" ${G.canWear(cw, g) ? '' : 'disabled'}>${esc(t('twEquipOn', whoName(cw)))}</button>`}
          <button class="btn ${canE ? 'gold' : ''}" data-twa="enchant" ${g.e >= G.ENCHANT_MAX ? 'disabled' : ''}>${esc(t('twUpgrade', g.e + 1))} ${g.e >= G.ENCHANT_MAX ? t('max') : `${img('ic_shard', '', 2)}${fmt(ec.shards)}${ec.gold ? ` ${img('ic_coin', '', 2)}${fmt(ec.gold)}` : ''}`}</button>
          ${f.worn ? '' : `<button class="btn red" data-twa="salvage" ${g.keep ? `disabled title="${esc(t('lockedNoScrap'))}"` : ''}>${esc(t('salvage'))} +${fmt(G.salvageValue(g))} ${img('ic_shard', '', 2)}</button>`}
          <button class="btn ${g.keep ? 'on' : ''}" data-twa="lock" aria-pressed="${g.keep ? 'true' : 'false'}">${img('ic_key', '', 2)} ${esc(t(g.keep ? 'unlockItem' : 'lockItem'))}</button>
        </div>
        <p class="hint">${esc(t('twUpgradeHint', g.e, G.ENCHANT_MAX))}</p>
        <div class="twOrbs"><small>${esc(t('twOrbs'))}</small>${orbBar(g)}</div>
      </div>`;
    }
    const filters = ['all'].concat(G.SLOTS).map(k => `<button class="${tw.filter === k ? 'on' : ''}" data-twflt="${k}">${esc(k === 'all' ? t('twAll') : t('slot_' + k))}</button>`).join('');
    const better = ups.total > 0, full = h.bag.length >= G.TUNE.bagMax;
    const sorts = ['slot', 'rar', 'pow', 'new'].map(k => `<button class="${srt === k ? 'on' : ''}" data-twsort="${k}">${esc(t('sort_' + k))}</button>`).join('');
    // ENCHANT ALL (Forge I): what one tap would do, counted; locked until the Forge is built
    const enOn = !!G.D.enchantAll, enN = enOn ? UI.enchantCount() : 0;
    el.innerHTML = `<div class="tw forge ${enchant ? 'ench' : ''}">
      ${twHeader(enchant ? 'npc_witch' : 'npc_smith', t(enchant ? 'town_enchant' : 'town_forge'), t(enchant ? 'twEnchSub' : 'twForgeSub'))}
      ${twWhoRow()}
      <div class="twBody">
        <div class="twDoll">
          <div class="twPortrait"><img src="${G.Doll.portrait(m ? { cls: m.cls, eq: m.eq } : h, 5)}" alt=""></div>
          <div class="twSlots ${performance.now() - (UI._enchFlash || -1e9) < 900 ? 'flash' : ''}">${slots}</div>
          <div class="twStat"><span>${esc(t('twPower'))}</span><b>${fmt(c.power)}</b><span>${esc(t('twDps'))}</span><b>${fmt(c.dps, true)}</b><span>${esc(t('twHp'))}</span><b>${fmt(c.hp)}</b></div>
          <button class="btn gold big ${better ? 'pulse' : ''}" data-twa="best">${esc(t('twBest'))}${better ? ` · ▲${ups.total}` : ''}</button>
          <button class="btn big enAll ${enOn && enN ? 'gold' : 'dim'} ${enN >= 10 ? 'pulse' : ''}" data-twa="enchall">${enOn ? esc(t('enchBtn', enN)) : esc(t('enchLocked'))}</button>
          <label class="twAuto"><input type="checkbox" data-twauto ${h.auto ? 'checked' : ''}> ${esc(t('twAutoEq'))}</label>
        </div>
        <div class="twBag">
          <div class="twBagHead"><b class="${full ? 'full' : ''}">${esc(t('twBag', h.bag.length, G.TUNE.bagMax))}</b><span class="flt">${filters}</span></div>
          ${full ? `<p class="bagFull">${esc(t('bagFullHint'))}</p>` : ''}
          <div class="twSort"><small>${esc(t('sortBy'))}</small><span class="flt">${sorts}</span></div>
          <div class="twGrid">${tiles || `<p class="note">${esc(t(G.inSiege() ? 'bagEmpty' : 'bagEmptyOut'))}</p>`}</div>
          <p class="twLegend"><i class="up">▲</i> ${esc(t('twLegUp', whoName(who)))} · <i class="oth">▲</i> ${esc(t('twLegOth'))} · <i class="dn">▼</i> ${esc(t('twLegDn'))}</p>
          <div class="twSalv">${img('ic_shard', '', 2)} <b>${fmt(h.shards)}</b> ${esc(t('twShards'))}
            <button class="btn red" data-twa="salvask">${esc(t('scrapMany'))}</button></div>
        </div>
        ${card}
      </div></div>`;
  }
  // 3.1: the Gambler, at the Enchanter's: shards for a mystery item of the slot you pick
  function renderGamble(el) {
    const h = G.S.hero, c = G.gambleCost(), can = h.shards >= c, last = tw.gamb;
    const cap = G.RARITIES[G.rarityCap()];
    el.innerHTML = `<div class="tw gamble">${twHeader('npc_witch', t('gambleTitle'), t('gambleSub'))}
      <div class="gmb">
        <p class="note">${esc(t('gambleHint', L(cap.name), Math.round(G.GAMBLE_UQ * 100)))}</p>
        <div class="gmbHave">${img('ic_shard', '', 3)} <b>${fmt(h.shards)}</b> ${esc(t('twShards'))}</div>
        <div class="gmbSlots">${G.SLOTS.map(s => `<button class="gmbSlot ${can ? '' : 'no'}" data-twgamb="${s}">${img(SLOT_ICON[s], '', 5)}<b>${esc(t('slot_' + s))}</b><small>${img('ic_shard', '', 2)}${fmt(c)}</small></button>`).join('')}</div>
        ${last ? `<div class="gmbRes ${last.q ? 'uq' : ''} ${last.fresh ? 'pop' : ''}" style="--rc:${last.col}">${last.g ? gearTile(last.g) : ''}<div><b style="color:${last.col}">${esc(last.name)}</b><small>${esc(last.sub)}</small></div></div>` : ''}
      </div></div>`;
    if (last) last.fresh = false;
  }
  function renderAlch(el) {
    const S = G.S, D = G.D;
    const rows = G.POTIONS.map(p => {
      const n = S.pots[p.id] || 0, full = n >= D.potCap, c = G.brewCost(p.id), can = !full && S.gold >= c;
      return `<div class="twPot">${img('pot_' + p.id, '', 4)}<div><b>${esc(L(p.name))}</b><small>${esc(L(p.desc))}</small><i class="bar"><u style="width:${Math.min(100, n / D.potCap * 100)}%;background:${p.color}"></u></i><small>${n} / ${D.potCap}</small></div>
        <button class="btn ${can ? 'gold' : ''}" data-twbrew="${p.id}" ${full ? 'disabled' : ''}>${full ? esc(t('max')) : `${esc(t('twBrew'))} ${img('ic_coin', '', 2)}${fmt(c)}`}</button></div>`;
    }).join('');
    // 4.0 (the Alchemist I-V): each Siege starts with D.startPots potions; from III the player picks which (G.alchPick)
    const n = D.startPots | 0, pick = D.startPotsPick && G.alchPick ? (Array.isArray(S.alchPick) ? S.alchPick : []) : null;
    const start = !n ? '' : pick ? `<div class="twStartPots"><b>${esc(t('alchStart', n))}</b><small>${esc(t('alchPickHint', n))}</small><div class="apChips">${G.POTIONS.map(p => `<button class="apChip ${pick.includes(p.id) ? 'on' : ''}" data-alpick="${p.id}" aria-pressed="${pick.includes(p.id) ? 'true' : 'false'}">${img('pot_' + p.id, '', 2)}${esc(L(p.name))}</button>`).join('')}</div></div>`
      : `<p class="note twStartPots">${esc(t('alchRandom', n))}</p>`;
    el.innerHTML = `<div class="tw alch">${twHeader('npc_alch', t('town_alch'), t('twAlchSub'))}${start}<div class="twPots">${rows}</div></div>`;
  }
  // QoL: the whole team at a glance: each one's power, damage, health, the four things they wear and how many
  // upgrades wait in the bag for them, the team's power, and EQUIP BEST right here
  function memStats(who) {
    const m = memOf(who), eq = m ? m.eq : G.S.hero.eq;
    return G.heroCombat(eq, G.D, m ? { cls: m.cls, lvl: G.S.hero.lvl } : undefined);
  }
  function memGear(who) {
    const eq = G.eqOf(who);
    return `<span class="mGear">${G.SLOTS.map(sl => { const g = eq[sl]; return g ? `<i class="mg" style="--rc:${gearCol(g)}" title="${esc(gearName(g))}">${img(G.gearSpr(g), '', 2)}</i>` : `<i class="mg none" title="${esc(t('slot_' + sl) + ': ' + t('twEmpty'))}">${img(SLOT_ICON[sl], '', 2, { dark: true })}</i>`; }).join('')}</span>`;
  }
  function memLine(who, ups) {
    const c = memStats(who);
    return `<span class="mStat"><b>${fmt(c.power)}</b> ${esc(t('power').toLowerCase())} · ${fmt(c.dps, true)}${esc(t('perSec'))} · ${fmt(c.hp)} ${esc(t('twHp').toLowerCase())}</span>${memGear(who)}${ups.n[who] ? `<em class="upN">▲${ups.n[who]} ${esc(t('twUpsShort'))}</em>` : ''}`;
  }
  function renderTavern(el) {
    const S = G.S, slots = G.partySlots(), party = S.party || [], ups = bagUps();
    const teamPow = [-1].concat(party.map((_, i) => i)).reduce((a, w) => a + memStats(w).power, 0);
    // (4.0: a companion's trait, from the camp that recruited it)
    const trait = m => (m.trait && G.TRAITS && G.TRAITS[m.trait] ? `<small class="trait" title="${esc(L(G.TRAITS[m.trait].desc))}">${esc(L(G.TRAITS[m.trait].name))} · ${esc(L(G.TRAITS[m.trait].desc))}</small>` : '');
    const mem = party.map((m, i) => `<div class="twMem"><img src="${G.Doll.portrait({ cls: m.cls, eq: m.eq }, 3, true)}" alt=""><b>${esc(L(G.CLASS_BY_ID[m.cls].name))}</b><small class="r_${G.ROLES[m.cls]}">${esc(G.ROLE_NAMES[G.ROLES[m.cls]])}</small>${trait(m)}${memLine(i, ups)}<button class="btn" data-twgear="${i}">${esc(t('twGearUp'))}</button></div>`).join('');
    const enN = G.D.enchantAll ? UI.enchantCount() : 0;
    const team = `<div class="twTeam"><span>${esc(t('teamPower'))} <b>${fmt(teamPow)}</b></span><button class="btn gold ${ups.total ? 'pulse' : ''}" data-twa="best">${esc(t('twBest'))}${ups.total ? ` · ▲${ups.total}` : ''}</button><button class="btn enAll ${enN ? 'gold' : 'dim'}" data-twa="enchall">${esc(G.D.enchantAll ? t('enchBtn', enN) : t('enchLocked'))}</button></div>`;
    const open = slots - party.length;
    // (4.0: in a Siege the recruits come at Camps 1-3, each with a trait; the Tavern shows who drinks here between runs)
    const siege = G.inSiege();
    const recruits = siege ? `<p class="note">${esc(t(open > 0 ? 'seatOpenCamp' : slots >= 3 ? 'twPartyFull' : 'seatCampTip'))}</p>`
      : open > 0 ? `<p>${esc(t('twRecruitN', open))}</p><div class="twRecruit">${G.CLASSES.map(c => `<button class="clsCard" data-twrec="${c.id}">${img(c.spr, '', 5)}<b>${esc(L(c.name))}</b><small class="r_${G.ROLES[c.id]}">${esc(G.ROLE_NAMES[G.ROLES[c.id]])}</small></button>`).join('')}</div>` : `<p class="note">${esc(t('twTavernOut'))}</p>`;
    el.innerHTML = `<div class="tw tavern">${twHeader('npc_keeper', t('town_tavern'), t('twTavernSub'))}
      ${team}<div class="twParty"><div class="twMem lead"><img src="${G.Doll.portrait(S.hero, 3)}" alt=""><b>${esc(S.profile.name || t('wardenName'))}</b><small>${esc(L(G.CLASS_BY_ID[S.hero.cls].name))} · ${esc(t('lvl'))} ${S.hero.lvl}</small>${memLine(-1, ups)}<button class="btn" data-twgear="-1">${esc(t('twGearUp'))}</button></div>${mem}</div>
      ${recruits}</div>`;
  }
  function renderTown(full) {
    const el = twEl(); if (!el || !tw.id) return;
    if (!G.S.hero || !G.S.hero.cls) { UI.townClose(); return; }
    if (tw.who >= (G.S.party || []).length) { tw.who = -1; tw.sel = null; }
    const B = BLDS[tw.id];
    const nv0 = el.querySelector('.twNav'), navX = nv0 ? nv0.scrollLeft : 0;
    if (!CUSTOM[tw.sub]) {
      // a page hosted here: its renderer draws it once (full), its updater keeps it live
      if (!full) { twFootLive(); return; }
      const old = el.querySelector('.twTabBody'), y = old ? old.scrollTop : 0;
      el.innerHTML = `<div class="tw host ${B.wide ? 'wide' : ''}">${twHeader(B.npc, t('town_' + tw.id), t(B.sub || 'twTavernSub'))}${twNav()}${twSubRow(tw.id)}
        <div class="twTabHead"><b>${esc(tw.sub === 'hero' ? t('twSubChar') : t('tab_' + tw.sub))}</b><small id="tabSub"></small></div><div class="tabBody twTabBody"></div>${twBldFoot(tw.id)}</div>`;
      const body = el.querySelector('.twTabBody');
      (renderers[tw.sub] || (() => {}))(body);
      body.scrollTop = y;
      const nv = el.querySelector('.twNav'); if (nv) nv.scrollLeft = navX;
      twNavLive(true);
      return;
    }
    const sc = el.querySelector('.twBody, .twPots, .tw.tavern'), y = sc ? sc.scrollTop : 0, gy = el.querySelector('.twGrid') ? el.querySelector('.twGrid').scrollTop : 0;
    // (on a phone the whole window scrolls: a tap deep in the bag must not jump back to the top)
    const w0 = el.querySelector('.tw'), wy = w0 && w0.dataset.b === tw.id + tw.sub ? w0.scrollTop : 0;
    if (tw.id === 'forge' || (tw.id === 'enchant' && tw.sub !== 'gamble')) renderForge(el);
    else if (tw.sub === 'gamble') renderGamble(el);
    else if (tw.id === 'alch') renderAlch(el);
    else if (tw.id === 'tavern') renderTavern(el);
    const head = el.querySelector('.twHead'); if (head) head.insertAdjacentHTML('afterend', twNav() + twSubRow(tw.id));
    const root = el.querySelector('.tw'); if (root) root.insertAdjacentHTML('beforeend', twBldFoot(tw.id));
    const sc2 = el.querySelector('.twBody, .twPots, .tw.tavern'); if (sc2) sc2.scrollTop = y;
    const g2 = el.querySelector('.twGrid'); if (g2) g2.scrollTop = gy;
    const nv = el.querySelector('.twNav'); if (nv) nv.scrollLeft = navX;
    const w1 = el.querySelector('.tw'); if (w1) { w1.dataset.b = tw.id + tw.sub; if (wy) w1.scrollTop = wy; }
    twNavLive(true);
  }
  UI.townRender = renderTown;
  function bindTown() {
    const el = twEl(); if (!el) return;
    el.addEventListener('pointerdown', () => { tw.down = true; });
    window.addEventListener('pointerup', () => { tw.down = false; });
    el.addEventListener('change', e => {
      if (e.target.matches('[data-twauto]')) { G.S.hero.auto = e.target.checked; }
      if (e.target.matches('[data-twsalv]')) { tw.salv = +e.target.value; renderTown(); }
    });
    el.addEventListener('click', e => {
      // (a page hosted here handles its own clicks; a target its handler already re-rendered away is no longer here)
      if (!e.target.isConnected || !el.contains(e.target) || e.target.closest('.twTabBody')) return;
      const b = e.target.closest('[data-tw],[data-twwho],[data-twg],[data-twf],[data-twflt],[data-twa],[data-twbrew],[data-twrec],[data-twgear],[data-orb],[data-twsub],[data-twbuild],[data-twgamb],[data-twseal],[data-twgo],[data-twsort],[data-cmpwho],[data-twlevels],[data-newsiege],[data-alpick]') || e.target.closest('[data-g]');
      // (a phone shows the building's note on one line: a tap on it shows the whole of it)
      if (!b && e.target.closest('.twHead > div')) { e.target.closest('.twHead').classList.toggle('open'); return; }
      if (!b) { if (e.target === el) UI.townClose(); return; }
      G.Audio.unlock();
      const h = G.S.hero;
      if (b.dataset.tw === 'close') { UI.townClose(); return; }
      if (b.dataset.twgo) { if (b.dataset.twgo === 'field') G.leaveTown(); else if (b.dataset.twgo !== tw.id) { G.Audio.buy && G.Audio.buy(); UI.townOpen(b.dataset.twgo); } return; }
      if (b.dataset.twsort) { PF().sort = b.dataset.twsort; renderTown(); return; }
      // 4.0: the item card's 'compare with', the building's I-V table, NEW SIEGE, ENCHANT ALL
      if (b.dataset.cmpwho != null) { tw.cmpWho = +b.dataset.cmpwho; renderTown(); return; }
      if (b.dataset.twlevels) { UI.bldLevels(b.dataset.twlevels); return; }
      if (b.dataset.newsiege != null) { UI.newSiege(); return; }
      if (b.dataset.twa === 'enchall') { UI.enchantAsk(); return; }
      // (a bare item tile outside the Forge's own grid: a window on it)
      if (b.dataset.g != null && b.dataset.twg == null && !b.closest('[data-twg]')) { const f0 = twFind(+b.dataset.g); if (f0) UI.itemCard(f0.g, { who: tw.who }); return; }
      if (b.dataset.twa === 'salvask') { UI.scrapAsk(); return; }
      if (b.dataset.twsub) { UI.townOpen(tw.id, b.dataset.twsub); return; }
      if (b.dataset.twgamb) {
        const r = G.gamble(b.dataset.twgamb);
        if (!r) { G.Audio.error(); UI.toast(esc(t('gambleNo')), '', 'ic_shard', { p: 2 }); return; }
        const g = r.g || null, rar = G.RARITIES[r.it.r];
        tw.gamb = { g, q: r.q, fresh: true, col: r.q ? G.UNIQUE_COL : rar.color, name: g ? gearName(g) : L(r.it.name), sub: r.q ? t('unique') + ' · ' + G.UNIQUES[r.q].fx : L(rar.name) + ' · ' + t('slot_' + r.slot) + (g && G.S.hero.eq[r.slot] === g ? ' · ' + t('equipped') : '') };
        if (r.q || r.it.r >= 4) { G.Audio.levelUp && G.Audio.levelUp(); } else G.Audio.buy();
        G.dirty(); G.recalc(); renderTown(); UI.update(true); return;
      }
      if (b.dataset.twseal != null) {
        const f = tw.sel != null ? twFind(tw.sel) : null;
        if (!f || !G.sealAffix(f.g, +b.dataset.twseal)) { G.Audio.error(); return; }
        G.Audio.buy(); renderTown(); UI.update(true); return;
      }
      if (b.dataset.twbuild) {
        const id = b.dataset.twbuild;
        if (G.buildUp(id)) { G.Audio.levelUp && G.Audio.levelUp(); UI.toast(`<span><b>${esc(t('bldDone', t('town_' + id), ROMAN5[G.bldLvl(id)]))}</b><br><small>${esc(bldTxt(id, G.bldLvl(id)))}</small></span>`, 'ach', G.SPR.defs[BLD_SPR[id]] ? BLD_SPR[id] : 'ic_town', { p: 2 }); pingT = 0; UI.render(); if (CUSTOM[tw.sub]) renderTown(); }
        else { G.Audio.error(); UI.toast(esc(t('bldNoEmbers', fmt(G.bldCost(id) - embersHave()))), '', EMB(), { p: 2 }); }
        return;
      }
      if (b.dataset.twwho != null) { tw.who = +b.dataset.twwho; tw.sel = null; }
      else if (b.dataset.twg != null) { tw.sel = +b.dataset.twg; }
      else if (b.dataset.twf != null) { tw.filter = b.dataset.twf; tw.sel = null; }
      else if (b.dataset.twflt != null) { tw.filter = b.dataset.twflt; }
      else if (b.dataset.twgear != null) { tw.who = +b.dataset.twgear; UI.townOpen('forge'); return; }
      else if (b.dataset.twrec) { if (G.recruit(b.dataset.twrec)) { G.Audio.levelUp && G.Audio.levelUp(); UI.toast(esc(t('twRecruited', L(G.CLASS_BY_ID[b.dataset.twrec].name))), 'ach', G.CLASS_BY_ID[b.dataset.twrec].spr, { p: 2 }); } else G.Audio.error(); }
      else if (b.dataset.twbrew) { const p = G.brewPotion(b.dataset.twbrew); if (p) G.Audio.buy(); else G.Audio.error(); }
      else if (b.dataset.alpick && G.alchPick) {
        // (a tap adds the kind, a second removes it; past the number allowed the oldest choice gives way)
        const id = b.dataset.alpick, cur = Array.isArray(G.S.alchPick) ? G.S.alchPick.slice() : [], n = G.D.startPots | 0;
        const next = cur.includes(id) ? cur.filter(x => x !== id) : cur.concat(id).slice(-Math.max(1, n));
        G.alchPick(next); G.Audio.click && G.Audio.click();
      }
      else if (b.dataset.orb) {
        const f = tw.sel != null ? twFind(tw.sel) : null;
        if (!f) { G.Audio.error(); return; }
        const res = G.useOrb(b.dataset.orb, f.g); if (!res) G.Audio.error();
      } else if (b.dataset.twa) {
        const a = b.dataset.twa, f = tw.sel != null ? twFind(tw.sel) : null;
        if (a === 'best') UI.equipBest();
        else if (a === 'salvall') { const r = scrapBelow(PF().salv || 2); if (r.n) G.Audio.buy(); }
        else if (f && a === 'lock') { if (f.g.keep) delete f.g.keep; else f.g.keep = 1; G.Audio.click && G.Audio.click(0, false); }
        // (4.0: onto the hero the card compares with; what they wore goes onward by the one rule when auto-equip is on)
        else if (f && a === 'equip') { const cw = tw.cmpWho != null ? tw.cmpWho : tw.who; if (canWear(f.g, cw) && (G.wearOn ? G.wearOn(f.g, cw) : G.equip(f.g, false, cw))) { G.Audio.buy(); tw.who = cw; } else G.Audio.error(); }
        else if (f && a === 'unequip') { G.unequip(f.worn, f.who); }
        else if (f && a === 'enchant') { if (G.enchant(f.g)) G.Audio.buy(); else G.Audio.error(); }
        else if (f && a === 'salvage') { if (f.g.keep) { G.Audio.error(); UI.toast(esc(t('lockedNoScrap')), '', 'ic_key', { p: 2 }); return; } G.salvage(f.g); tw.sel = null; G.Audio.buy(); }
      }
      G.dirty(); G.recalc(); renderTown(); UI.update(true);
      // (on a phone the item card sits under the bag: bring it into view after a pick)
      if (b.dataset.twg != null && innerWidth < 860) { const c = el.querySelector('.twCard'); if (c && c.scrollIntoView) c.scrollIntoView({ block: 'nearest', behavior: G.S.set.lowfx ? 'auto' : 'smooth' }); }
    });
  }

  // 4.0: the fallback Run Setup (only when js/run_ui.js has no setup screen): the Warden's class, then the Siege starts
  // with the last setup (Button, Heat, keepsakes) and that class. The classes open by Deeds (G.setupOptions)
  let pickWait = 0;
  UI.pickClass = function () {
    if (G.S.run && G.S.run.on) return;
    // Let the cloud save answer first: a returning player on a new device gets their hero back
    const N = G.Net;
    if (N && N.hold && N.cloud && $('#modal').hidden && $('#intro').hidden) { askCloud(N.cloud); setTimeout(UI.pickClass, 500); return; }
    if (!$('#modal').hidden || !$('#intro').hidden || (N && N.hold) || (N && N.status === 'connecting' && pickWait++ < 16)) { setTimeout(UI.pickClass, 500); return; }
    const opts = G.setupOptions ? G.setupOptions() : null, open = opts ? opts.classes : G.CLASSES.map(c => c.id);
    const html = `<p>${esc(t('pickClassHint4'))}</p><div class="classGrid">${G.CLASSES.filter(c => open.includes(c.id)).map(c => `
      <button class="clsCard ${G.S.hero.cls === c.id ? 'on' : ''}" data-c="${c.id}">${img(c.spr, '', 6)}<b>${esc(L(c.name))}</b><small>${esc(L(c.desc))}</small></button>`).join('')}</div>`;
    const m = UI.modal(t('pickClass'), html, G.S.hero.cls ? [{ label: t('cancel') }] : [], !G.S.hero.cls);
    m.querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', () => {
      if (G.runStart) G.runStart({ cls: b.dataset.c }); else G.chooseClass(b.dataset.c);
      if (!G.S.profile.name && G.Net && G.Net.myName) { G.S.profile.name = G.Net.myName.trim().split(/\s+/)[0].slice(0, 16); setTimeout(() => UI.toast(esc(t('onLadderAs', G.S.profile.name)), '', 'ic_crown'), 4000); }
      m.hidden = true; m.innerHTML = '';
      UI.render();
    }));
  };


  // (4.0: the campaign's Rift picker went: Rifts are off in a Siege; the Rift Gate's page is the Daily Siege, above)

  // Ladder: shared ranking and cloud save status
  let ladderBy = 'depth';
  const LADDER_BY = ['depth', 'power', 'rift', 'today', 'stars', 'uq', 'mad', 'crowns', 'firsts'];
  const LADDER_LBL = { depth: 'byDepth', power: 'byPower', rift: 'byRift', today: 'byToday', stars: 'byStars', uq: 'byUq', mad: 'byMad', crowns: 'byCrowns', firsts: 'byFirsts' };
  const nameOf = e => G.Net.displayName(e) || t('anon');
  // Lord crowns: the fastest fresh kill of each lord among everyone
  function crownBoard() {
    const N = G.Net, list = N.entries.filter(e => e.ok || e.me), S = G.S;
    const rows = [];
    const top = Math.max(S.bestDepth, ...list.filter(e => e.ok).flatMap(e => Object.keys(e.cr || {}).map(Number)).filter(n => n < 100000));
    for (let d = G.REALM_SIZE - 1; d <= top; d += G.REALM_SIZE) {
      const best = list.filter(e => e.cr && e.cr[d]).sort((a, b) => a.cr[d] - b.cr[d])[0];
      const mine = S.rec.crowns && S.rec.crowns[d];
      rows.push(`<div class="lrow crow ${best && best.me ? 'me' : ''}"><b class="rk">${best ? '\u{1F451}' : '·'}</b>
        <span class="nm">${esc(G.bossName(d))}<small>${esc(t('depthShort'))} ${d + 1}${mine ? ' · ' + esc(t('crownYours', mine)) : ''}</small></span>
        <span class="v"><b>${best ? esc(nameOf(best)) : esc(t('noCrown'))}</b><small>${best ? best.cr[d] + 's' : ''}</small></span></div>`);
    }
    return `<p class="note">${esc(t('crownsHint'))}</p>` + rows.join('');
  }
  // Firsts: the first three to reach each milestone
  function firstsBoard() {
    const N = G.Net, list = N.entries.filter(e => e.ok || e.me);
    const medal = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];
    return `<p class="note">${esc(t('firstsHint'))}</p>` + G.FIRSTS.map(([k, label]) => {
      const top = list.filter(e => e.fs && e.fs[k]).sort((a, b) => a.fs[k] - b.fs[k]).slice(0, 3);
      return `<div class="lrow first"><span class="nm">${esc(label)}</span><span class="v fsv">${top.length ? top.map((e, i) => `<small class="${e.me ? 'me' : ''}">${medal[i]} ${esc(nameOf(e))}</small>`).join('') : `<small>${esc(t('noCrown'))}</small>`}</span></div>`;
    }).join('');
  }
  // What the row shows on the right for each ranking
  function ladderVal(e, by) {
    if (by === 'rift') return [t('riftName', e.rift || 0), e.rt ? G.fmtTime(e.rt) : ''];
    if (by === 'today') return [t('riftName', (e.rd && e.rd.l) || 0), e.rd && e.rd.t ? G.fmtTime(e.rd.t) : t('riftToday')];
    if (by === 'uq') return [(e.uq || 0) + ' / ' + G.UNIQUE_IDS.length, t('uniques')];
    if (by === 'stars') return ['\u2605 ' + (e.ls || 0) + ' / ' + 3 * G.REALMS.length, t('byStars')];
    if (by === 'mad') return [G.fmtTime(e.mad || 0), t('byMad')];
    return [t('depthShort') + ' ' + (e.depth + 1), t('gearScore') + ' ' + fmt(e.power || 0)];
  }
  function ladderRow(e, i, by) {
    const cls = G.CLASS_BY_ID[e.cls] || G.CLASSES[0], N = G.Net;
    const nm = N.displayName(e) || t('anon'), v = ladderVal(e, by);
    const acc = N.accountName(e);
    const age = e.ts ? (Date.now() - e.ts) / 1000 : 0, stale = age > 14 * 86400;
    return `<div class="lrow ${e.me ? 'me' : ''} ${e.ok ? '' : 'bad'} ${stale ? 'stale' : ''}" data-uid="${esc(e.uid)}" role="button" tabindex="0">
        <b class="rk">${i + 1}</b><img class="ldoll" src="${G.Doll.portrait(G.Doll.fromSnapshot(e), 2, true)}" alt="">
        <span class="nm">${esc(nm)}${e.me ? ' · ' + esc(t('you')) : ''}<small>${esc(L(cls.name))} · ${esc(t('lvl'))} ${e.lvl}${acc && acc !== nm ? ' · ' + esc(acc) : ''}${!e.me && age > 3600 ? ' · ' + esc(t('seenAgo', G.fmtTime(Math.floor(age / 3600) * 3600))) : ''}${e.ok ? '' : ' · ' + esc(t('unverified'))}</small></span>
        <span class="v"><b>${esc(v[0])}</b><small>${esc(v[1])}</small></span>
      </div>`;
  }
  // Everyone's recent big moments, newest first
  function feedHtml() {
    const N = G.Net, rows = [];
    for (const e of N.entries) { if (!e.ok && !e.me) continue; for (const f of Array.isArray(e.ev) ? e.ev : []) if (Array.isArray(f) && typeof f[1] === 'string' && f[1] && typeof f[0] === 'number' && G.STR['feed' + f[1][0].toUpperCase() + f[1].slice(1)]) rows.push({ e, ts: f[0], k: f[1], s: String(f[2] || '') }); }
    rows.sort((a, b) => b.ts - a.ts);
    if (!rows.length) return `<p class="note">${esc(t('feedEmpty'))}</p>`;
    const icon = { uq: 'orb_grace', rift: 'ic_rift', lord: 'ic_skull', divine: 'it_halo', mad: 'ic_crown', evo: 'ic_star', crown: 'ic_crown', jackpot: 'ic_jackpot', relic: G.SPR.defs.rx_bag ? 'rx_bag' : 'ic_jackpot' };
    return rows.slice(0, 12).map(r => `<div class="feedRow">${img(icon[r.k] || 'ic_star', '', 2)}<span><b>${esc(N.displayName(r.e) || t('anon'))}</b> ${esc(t('feed' + r.k[0].toUpperCase() + r.k.slice(1), r.s))}</span><small>${esc(G.fmtTime(Math.max(1, (Date.now() - r.ts) / 1000)))}</small></div>`).join('');
  }
  renderers.ladder = function (body) {
    const S = G.S, N = G.Net;
    body.innerHTML = `
      <div class="detail" data-net></div>
      <div class="tabTitle" style="padding:8px 4px"><small>${esc(t('rankBy'))}</small>
        <span class="seg" data-by>${LADDER_BY.map(b => `<button data-b="${b}" class="${ladderBy === b ? 'on' : ''}">${esc(t(LADDER_LBL[b]))}</button>`).join('')}</span></div>
      <div class="ladder" data-list></div>
      <div class="sect">${esc(t('recent'))} <button class="btn" data-brag style="float:right">${esc(t('brag'))}</button></div>
      <div class="feed" data-feed></div>
      <p class="note">${esc(t('ladderRules'))}</p>`;
    refs.lad = { net: body.querySelector('[data-net]'), list: body.querySelector('[data-list]'), feed: body.querySelector('[data-feed]'), key: '' };
    body.addEventListener('click', e => {
      const b = e.target.closest('[data-b]');
      if (b) { ladderBy = b.dataset.b; $$('[data-by] button', body).forEach(x => x.classList.toggle('on', x === b)); refs.lad.key = ''; updaters.ladder(true); return; }
      if (e.target.closest('[data-push]')) { N.pushNow(); UI.toast(esc(t('synced')), '', 'ic_crown', { p: 2 }); return; }
      if (e.target.closest('[data-brag]')) {
        const h = S.hero, snap = G.ladderSnapshot(), crowns = Object.keys(S.rec.crowns || {}).filter(d => { const mine = S.rec.crowns[d]; return !N.entries.some(e => !e.me && e.cr && e.cr[d] && e.cr[d] < mine); }).length;
        const grid = G.UNIQUE_IDS.map(q => S.uq[q] ? '\u{1F7E7}' : '\u2B1B').join('');
        // only what's worth saying: zeros stay out
        const parts = ['\u2694 ' + t('depth') + ' ' + (S.bestDepth + 1)];
        if (S.rift.best) parts.push('\u25c8 ' + t('riftName', S.rift.best));
        if (snap.ls) parts.push('\u2605 ' + snap.ls + ' ' + t('byStars').toLowerCase());
        if (crowns) parts.push('\u{1F451} ' + crowns);
        const txt = t('bragText', L((G.CLASS_BY_ID[h.cls] || G.CLASSES[0]).name), snap.lvl, fmt(snap.power), parts.join(' · '), Object.keys(S.uq).length, G.UNIQUE_IDS.length, grid) + '\n' + t('bragJoin', G.SHARE_URL);
        // a box to copy from, since the clipboard may be refused inside the page
        const m = UI.modal(t('bragTitle'), `<textarea class="bragBox" readonly rows="6">${esc(txt)}</textarea>`, [{ label: t('bragCopy'), cls: 'gold', fn: () => { try { navigator.clipboard.writeText(txt).then(() => UI.toast(esc(t('bragged')), 'ach', 'ic_crown', { p: 2 }), () => {}); } catch (err) { /* the text stays selectable */ } } }, { label: t('close') }]);
        const ta = m.querySelector('textarea'); if (ta) { ta.focus(); ta.select(); }
        return;
      }
      if (e.target.closest('[data-cloud]')) { askCloud(N.cloud); return; }
      if (e.target.closest('[data-name]')) { selWho = -1; selGear = null; UI.go('hero'); setTimeout(() => { const i = $('#heroName'); if (i) i.focus(); }, 50); return; }
      const row = e.target.closest('.lrow[data-uid]');
      if (row) inspect(row.dataset.uid);
    });
  };
  updaters.ladder = function (force) {
    const N = G.Net, rf = refs.lad, S = G.S;
    if (!rf) return;
    const ago = ts => ts ? t('agoT', G.fmtTime((Date.now() - ts) / 1000)) : t('notYet');
    const statusText = N.status === 'online' ? (N.mode === 'http' ? t('netHttp') : t('netArtifact'))
      : N.status === 'connecting' ? t('netConnecting') : N.status === 'error' ? t('netDown') : N.status === 'signin' ? t('netSignin') : t('netOff');
    const netHtml = `<h3>${esc(statusText)}</h3>
      ${N.isOwner ? `<div class="invite"><b>${esc(t('inviteTitle'))}</b><p>${esc(t('inviteHow'))}</p></div>` : ''}
      ${N.status === 'online' ? `<p>${esc(N.readOnly ? t('netReadOnly') + ' ' + t('readOnlyHow') : t('netSynced', ago(N.lastSaveAt), ago(N.lastLadderAt)))}</p>`
        : `<p>${esc(N.status === 'error' ? t('netDownHint') : N.status === 'signin' ? t('netSigninHint') : N.status === 'connecting' ? '' : t('netOffHint'))}</p>`}
      ${S.profile.name ? '' : `<p>${esc(t('noNameYet'))} <button class="btn" data-name>${esc(t('setName'))}</button></p>`}
      <div class="act">${N.status === 'online' && !N.readOnly ? `<button class="btn gold" data-push>${esc(t('syncNow'))}</button>` : ''}
        ${N.cloud ? `<button class="btn" data-cloud>${esc(t('loadCloud'))}</button>` : ''}</div>
      ${N.error && N.status === 'online' && !N.readOnly ? `<p style="color:var(--bad)">${esc(N.error === 'unavailable' ? t('netDown') : N.error === 'resource_exhausted' ? t('netFull') : N.error === 'revoked' || N.error === 'permission_denied' ? t('netRevoked') : t('netRetry'))}</p>` : ''}
      ${N.behind ? `<p class="note warn">${esc(t('netBehind'))}</p>` : ''}
      ${(() => { const mine = N.entries.find(e => e.me); return mine && !mine.ok ? `<p class="note warn">${esc(t('myHidden', (mine.problems || []).join(', ')))}</p>` : ''; })()}`;
    if (rf.net._h !== netHtml) { rf.net.innerHTML = netHtml; rf.net._h = netHtml; }
    const list = N.sorted(ladderBy);
    const key = ladderBy + JSON.stringify(N.entries.map(e => [e.uid, e.depth, e.power, e.lvl, N.displayName(e), N.accountName(e), e.rift, e.rd, e.uq, e.ev, e.fs, e.cr, e.mad, e.ls])) + JSON.stringify(S.rec.crowns || {});
    if (key === rf.key && !force) return;
    rf.key = key;
    const suspicious = N.entries.filter(e => !e.ok && !e.me).length;
    const fh = feedHtml();
    if (rf.feed._h !== fh) { rf.feed.innerHTML = fh; rf.feed._h = fh; }
    if (ladderBy === 'crowns' || ladderBy === 'firsts') { rf.list.innerHTML = ladderBy === 'crowns' ? crownBoard() : firstsBoard(); return; }
    if (ladderBy === 'mad' && !list.length) { rf.list.innerHTML = `<p class="note">${esc(t('madHint'))}</p>`; return; }
    if (!list.length) { rf.list.innerHTML = `<p class="note">${esc(N.status !== 'online' ? t('ladderOffline') : ['rift', 'uq', 'stars'].includes(ladderBy) ? t('beFirst') : t('ladderEmpty'))}</p>` + (suspicious ? `<p class="note">${esc(t('hiddenBad', suspicious))}</p>` : ''); return; }
    rf.list.innerHTML = list.slice(0, 100).map((e, i) => ladderRow(e, i, ladderBy)).join('') + (suspicious ? `<p class="note">${esc(t('hiddenBad', suspicious))}</p>` : '');
    const myIdx = list.findIndex(e => e.me);
    setText($('#tabSub'), myIdx >= 0 ? t('yourRank', myIdx + 1, list.length) : '');
  };
  // A friend's Warden up close: their doll, their four items and how they compare with yours
  function inspect(uid) {
    const N = G.Net, e = N.entries.find(x => x.uid === uid);
    if (!e) return;
    const mine = G.S.hero.cls ? G.ladderSnapshot() : { power: 0 };
    const rows = G.SLOTS.map(s => {
      const g = e.gear && e.gear[s];
      if (!g || !G.ITEM_BY_ID[g.id]) return `<div class="insRow"><span class="empty">—</span><b>${esc(t('slot_' + s))}</b></div>`;
      const U = g.q && G.UNIQUES[g.q], col = U ? gearCol(g) : (G.RARITIES[g.r] || G.RARITIES[0]).color;
      const name = (U ? U.name : L(G.ITEM_BY_ID[g.id].name)) + (g.e ? ' +' + g.e : '');
      return `<div class="insRow">${img(U ? 'u_' + g.q : 'it_' + g.id, '', 3)}<div><b style="color:${col}">${esc(name)}</b><small>${esc(t('ilvl', g.il))}${g.c ? ' · ' + esc(t('corrupted')) : ''}</small>
        <ul class="affs">${(Array.isArray(g.a) ? g.a : []).filter(a => Array.isArray(a) && G.AFFIXES[a[0]] && typeof a[1] === 'number').map(a => affLine(a, g)).join('')}</ul>${U ? `<small class="uqfx">${esc(U.fx)}</small>` : ''}</div></div>`;
    }).join('');
    const d = (e.power || 0) - (mine.power || 0);
    const html = `<div class="insHead"><img src="${G.Doll.portrait(G.Doll.fromSnapshot(e), 4)}" alt=""><div>
        <p><b>${esc(N.displayName(e) || t('anon'))}</b>${N.accountName(e) && N.accountName(e) !== N.displayName(e) ? ' · ' + esc(N.accountName(e)) : ''}</p>
        <p>${esc(L((G.CLASS_BY_ID[e.cls] || G.CLASSES[0]).name))} · ${esc(t('lvl'))} ${e.lvl} · ${esc(t('depthShort'))} ${(e.depth || 0) + 1} · ${esc(t('riftName', e.rift || 0))} · ${esc(t('uniques'))} ${e.uq || 0}</p>
        <p>${esc(t('gearScore'))} <b>${fmt(e.power || 0)}</b>${e.me ? '' : ` <small style="color:${d > 0 ? 'var(--bad)' : 'var(--good)'}">(${d > 0 ? '+' : ''}${fmt(d)} ${esc(t('inspectVs'))})</small>`}</p></div></div>
      <div class="insGear">${rows}</div>`;
    const acts = [{ label: t('ok'), cls: 'gold' }];
    // the owner can take a row off the ladder (a cheat, or someone who left)
    if (N.isOwner && !e.me) acts.push({ label: t('removeRow'), fn: () => N.removeRow(e.uid).then(() => UI.toast(esc(t('removed')), '', 'ic_skull', { p: 2 }), err => UI.toast(esc(t('netError', err.code || err.message)), '', 'ic_skull', { p: 2 })) });
    UI.modal(N.displayName(e) || t('anon'), html, acts);
  }
  function askCloud(cloud) {
    if (!cloud) return;
    const when = new Date(cloud.ts || 0).toLocaleString();
    // say what each side holds, so nobody picks blind
    const sum = x => x && x.cls ? t('cloudSum', L((G.CLASS_BY_ID[x.cls] || G.CLASSES[0]).name), x.lvl, x.depth, fmt(x.gold)) : t('cloudNew');
    const there = G.Net.saveSummary(cloud.data), here = G.Net.saveSummary(G.S);
    const keep = () => { G.Net.keepLocal(cloud); if (G.Tut) G.Tut.maybeIntro(); };
    const weaker = there && (!here || !here.cls || here.gold < there.gold);
    UI.modal(t('cloudTitle'), `<p>${esc(t('cloudText', when))}</p><div class="sumList"><div><b>${esc(t('cloudThere'))}</b><span>${esc(sum(there))}</span></div><div><b>${esc(t('cloudThis'))}</b><span>${esc(sum(here))}</span></div></div>`, [
      { label: t('cloudLoad'), cls: 'gold', fn: () => { G.Net.hold = false; if (G.Net.loadCloud()) { UI.toast(esc(t('imported')), 'ach', 'ic_scroll', { p: 2 }); UI.render(); } else UI.toast(esc(t('badSave')), '', 'ic_skull', { p: 2 }); } },
      { label: t('cloudKeep'), fn: () => {
        if (!weaker) { keep(); return; }
        setTimeout(() => UI.modal(t('cloudTitle'), `<p>${esc(t('cloudSure', sum(there)))}</p>`, [{ label: t('cloudLoad'), cls: 'gold', fn: () => askCloud(cloud) }, { label: t('cloudSureYes'), fn: keep }], true), 50);
      } },
    ], true); // only the two buttons close it: a stray tap must not leave the save on hold
  }

  // Settings
  renderers.set = function (body) {
    const s = G.S.set, h = G.S.hero;
    const row = (on, attr, label, hint) => `<div class="setRow"><span>${esc(label)}${hint ? `<small>${esc(hint)}</small>` : ''}</span><button class="toggle ${on ? 'on' : ''}" ${attr} aria-pressed="${on ? 'true' : 'false'}" aria-label="${esc(label)}"></button></div>`;
    const tg = (k, label, hint) => row(!!s[k], `data-t="${k}"`, label, hint);
    // the Warden's own switches (kept on the hero, as the Character page has them); Overdrive is on unless switched off
    const htg = (k, label, hint) => row(k === 'autoOd' ? h.autoOd !== 0 : !!h[k], `data-ht="${k}"`, label, hint);
    const fmt0Demo = () => G.fmt(1234567890) + ' · ' + G.fmt(4.2e18);
    // 4.0 (the Buttons: Clockwork's Deed opens Auto-Run): the next Siege starts by itself, extracting at camp N (1-5)
    const autoRunRow = () => { const a = G.autoRun ? G.autoRun() : null; if (!a || !a.open) return ''; return `${row(a.on, 'data-autorun', t('setAutoRun'), t('setAutoRunHint', a.camp))}<div class="setRow"><span>${esc(t('setAutoRunCamp'))}</span><span class="seg" data-arcamp>${[1, 2, 3, 4, 5].map(c => `<button data-c="${c}" class="${a.camp === c ? 'on' : ''}">${c}</button>`).join('')}</span></div>`; };
    body.innerHTML = `
      <div class="setList">
        ${tg('sound', t('sound'))}${tg('music', t('music'))}
        <div class="setRow"><span>${esc(t('volume'))}</span><input id="vol" type="range" min="0" max="1" step="0.05" value="${s.vol}"></div>
        ${tg('hold', t('hold'))}${tg('shake', t('shake'))}${tg('autoBoss', t('autoBoss'))}${tg('filter', t('lootFilter'))}
        ${window.BTTN_AN ? tg('stats', t('statsOpt')) : ''}
      </div>
      <div class="sect">${esc(t('setPlay'))}</div>
      <div class="setList">
        ${htg('autoPerk', t('autoCards'), t('autoCardsHint', (G.TUNE.cardAuto || 10)))}${htg('auto', t('autoEquip'))}${htg('cast', t('autoCast'))}${htg('autoOd', t('autoOd'), t('autoOdHint'))}
        ${row(s.autoInvest !== 0, 'data-t="autoInvest"', t('autoInvest'), t('autoInvestHint'))}
        ${autoRunRow()}
        ${tg('lowfx', t('lowfx'), t('lowfxHint'))}
        <div class="setRow"><span>${esc(t('autoSalv'))}</span><span class="seg" data-hsalv>${[0, 1, 2, 3].map(r => `<button data-r="${r}" class="${(h.salv || 0) === r ? 'on' : ''}">${r === 0 ? esc(t('off')) : esc(L(G.RARITIES[r].name))}</button>`).join('')}</span></div>
        <div class="setRow"><span>${esc(t('numFmt'))}<small>${esc(fmt0Demo())}</small></span><span class="seg" data-nf>${[0, 1].map(v => `<button data-v="${v}" class="${(s.sci ? 1 : 0) === v ? 'on' : ''}">${esc(t('numFmt' + v))}</button>`).join('')}</span></div>
      </div>
      ${G.inSiege() ? `<div class="sect">${esc(t('setSiege'))}</div><div class="setList"><div class="setRow"><span>${esc(t('abandonTitle'))}<small>${esc(t('abandonHint'))}</small></span><button class="btn red" data-abandon>${esc(t('abandon'))}</button></div></div>` : ''}
      <div class="sect">${esc(t('setLang'))}</div>
      <div class="setSlot" id="setLang" data-slot="lang">${G.setLang && Array.isArray(G.LANGS) && G.LANGS.length > 1 ? `<div class="setRow"><span>${esc(t('setLangPick'))}</span><span class="seg" data-lang>${G.LANGS.map(l => `<button data-v="${esc(l.id || l)}" class="${(G.LANG || 'en') === (l.id || l) ? 'on' : ''}">${esc(l.name || l)}</button>`).join('')}</span></div>` : `<p class="note">${esc(t('setLangSoon'))}</p>`}</div>
      <div class="sect">${esc(t('setStream'))}</div>
      <div class="setSlot" id="setStream" data-slot="stream"><p class="note">${esc(t('setStreamSoon'))}</p></div>
      <div class="sect">${esc(t('saveTitle'))}</div>
      <p class="note">${esc(t('importHint'))}</p>
      <textarea id="saveBox" spellcheck="false" aria-label="${esc(t('saveTitle'))}"></textarea>
      <div class="acts" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
        <button class="btn" data-exp>${esc(t('export'))}</button>
        <button class="btn" data-copy>${esc(t('copy'))}</button>
        <button class="btn gold" data-imp>${esc(t('import'))}</button>
        <button class="btn" data-save>${esc(t('saveNow'))}</button>
        ${G.Net && G.Net.mode === 'artifact' && G.Net.uid ? `<button class="btn" data-restore>${esc(t('restoreBackup'))}</button>` : ''}
      </div>
      <div class="sect">&nbsp;</div>
      <button class="btn red" data-reset>${esc(t('resetBtn'))}</button>
      <p class="note" style="margin-top:14px">${esc(t('keysHint'))}</p>
      <p class="note">BTTN · ${esc(t('tagline'))}</p>`;
    body.addEventListener('click', e => {
      const arB = e.target.closest('[data-autorun]');
      if (arB && G.autoRun) { G.autoRun(!G.autoRun().on); G.Audio.unlock(); UI.render(); return; }
      const arC = e.target.closest('[data-arcamp] [data-c]');
      if (arC && G.autoRun) { G.autoRun(null, +arC.dataset.c); UI.render(); return; }
      const tgB = e.target.closest('[data-t]');
      if (tgB) { const k = tgB.dataset.t; s[k] = k === 'autoInvest' ? (s[k] === 0 ? 1 : 0) : s[k] ? 0 : 1; G.Audio.unlock(); G.Audio.apply(); UI.render(); return; }
      const lb = e.target.closest('[data-lang] [data-v]');
      if (lb && G.setLang) { G.setLang(lb.dataset.v); buildTabs(); UI.render(); return; }
      const ab = e.target.closest('[data-abandon]');
      if (ab) {
        // (two taps: a Siege abandoned pays as a fall: Fame in full, Embers x0.5)
        if (!ab._arm) { ab._arm = 1; ab.textContent = t('abandonSure'); setTimeout(() => { if (ab.isConnected) { ab._arm = 0; ab.textContent = t('abandon'); } }, 3000); return; }
        if (G.runAbandon) { G.runAbandon(); UI.go('upg'); }
        return;
      }
      const hb = e.target.closest('[data-ht]');
      if (hb) { const k = hb.dataset.ht; h[k] = k === 'autoOd' ? (h.autoOd === 0 ? 1 : 0) : (h[k] ? 0 : 1); G.dirty && G.dirty(); UI.render(); return; }
      const sv = e.target.closest('[data-hsalv] [data-r]');
      if (sv) { h.salv = +sv.dataset.r; UI.render(); return; }
      const nf = e.target.closest('[data-nf] [data-v]');
      if (nf) { s.sci = +nf.dataset.v; UI.render(); return; }
      if (e.target.closest('[data-exp]')) { $('#saveBox').value = G.exportSave(); return; }
      if (e.target.closest('[data-restore]')) { G.Net.restoreBackup().then(ok => { UI.toast(esc(ok ? t('imported') : t('noBackup')), ok ? 'ach' : '', 'ic_scroll', { p: 2 }); if (ok) UI.render(); }); return; }
      if (e.target.closest('[data-copy]')) {
        const v = $('#saveBox').value || G.exportSave(); $('#saveBox').value = v;
        const ok = () => UI.toast(esc(t('copied')), '', 'ic_scroll', { p: 2 });
        try { navigator.clipboard.writeText(v).then(ok, () => { $('#saveBox').select(); }); } catch (err) { $('#saveBox').select(); }
        return;
      }
      if (e.target.closest('[data-imp]')) {
        const v = $('#saveBox').value.trim();
        if (!v || !G.importSave(v)) { UI.toast(esc(t('badSave')), '', 'ic_skull', { p: 2 }); return; }
        UI.toast(esc(t('imported')), 'ach', 'ic_scroll', { p: 2 }); buildTabs(); UI.render(); return;
      }
      if (e.target.closest('[data-save]')) { G.save(); UI.toast(esc(t('saved')), '', 'ic_scroll', { p: 2 }); return; }
      const rb = e.target.closest('[data-reset]');
      if (rb) {
        if (!resetArm) { resetArm = 1; rb.textContent = t('resetConfirm'); return; }
        resetArm = 0; G.hardReset(); buildTabs(); tab = 'upg'; UI.render();
      }
    });
    $('#vol').addEventListener('input', e => { s.vol = +e.target.value; G.Audio.unlock(); G.Audio.apply(); });
    // 4.0: the Language and Streamer slots are filled by their modules (js/i18n_ru.js, js/stream.js): 'uiSettings'(body)
    G.emit('uiSettings', body);
  };

  // ---------- Toasts, banner, modal ----------
  // 3.6: one corner, one message at a time. A burst of one kind of news becomes one toast ("3 new finds"); at most
  // two show at once (one on a phone, or in a boss fight or a big moment), each a beat after the last. The small
  // ones (p 0) wait out a boss fight or a big moment (G.director.quiet()) and are dropped once stale; under a
  // window only the answers to what you just did (p 2) show.
  const narrowUI = () => innerWidth <= 860;
  const dirQuiet = () => { try { return !!(G.director && G.director.quiet && G.director.quiet()); } catch (e) { return false; } };
  const toastQ = [];
  let toastLast = 0, toastTm = 0, toastBlock = false;
  // what a burst of one kind says (q.n of them; q.items: what each one was about)
  const TOAST_N = {
    new: q => `<b>${esc(t('toastNewN', q.n))}</b>`,
    ach: q => `<span>${esc(t('achievement'))}: <b>${esc(t('toastAchN', q.n))}</b></span>`,
    quest: q => `<b>${esc(t('toastQuestN', q.n))}</b>`,
    journey: q => `<span><b>${esc(t('journeyDone'))}</b> ×${q.n}</span>`,
    unlock: q => `<span>${esc(t('unlocked', q.items.filter(Boolean).join(', ')))}</span>`,
    equip: q => `<span>${esc(t('toastEquipN', q.n))}</span>`,
    potion: q => `<span>${esc(t('toastPotionN', q.n))}</span>`,
    star: q => `<b style="color:#ffd84a">★ ${esc(t('toastStarN', q.n))}</b>`,
    rank: q => `<b>${esc(t('rankUp'))}</b> ×${q.n}`,
    gold: q => `<b>${esc(t('tu_reward', fmt(q.items.reduce((a, b) => a + (+b || 0), 0)) + ' ' + t('gold').toLowerCase()))}</b>`,
    perkAuto: q => `<span>${esc(t('perkAutoDone'))} ×${q.n}</span>`,
  };
  const liveToasts = box => Array.prototype.filter.call(box.children, e => !e.classList.contains('out'));
  function toastHeld(q) {
    if (q.p >= 2) return false;
    if (toastBlock) return true;
    if (G.uiBusy && G.uiBusy()) return true;
    if (q.p <= 0 && dirQuiet()) return true;
    // (a phone's field has room for one card at the top: a champion's waits nobody)
    if (narrowUI()) {
      const c = document.getElementById('champCard'); if (c && !c.hidden && !c.classList.contains('out')) return true;
      // (nor a big banner: it has the top of the field for its few seconds)
      if (bannerBusy) return true;
    }
    return false;
  }
  function pumpToasts() {
    clearTimeout(toastTm); toastTm = 0;
    const box = $('#toasts'); if (!box) return;
    const now = performance.now();
    for (let i = toastQ.length - 1; i >= 0; i--) { const q = toastQ[i]; if (q.p < 2 && now - q.t0 > (q.p <= 0 ? 25000 : 45000)) toastQ.splice(i, 1); }
    if (!toastQ.length) return;
    const live = liveToasts(box), cap = narrowUI() || G.R.boss || dirQuiet() ? 1 : 2;
    let best = -1;
    for (let i = 0; i < toastQ.length; i++) { const q = toastQ[i]; if (!toastHeld(q) && (best < 0 || q.p > toastQ[best].p)) best = i; }
    if (best >= 0) {
      const q = toastQ[best];
      // (an answer to a tap never waits: it pushes the oldest out)
      if (q.p >= 2 && live.length >= cap) toastOut(live[0]);
      if (q.p >= 2 || (live.length < cap && now - toastLast >= (narrowUI() ? 1200 : 600))) { toastQ.splice(best, 1); showToast(q); toastLast = now; }
    }
    if (toastQ.length) toastTm = setTimeout(pumpToasts, 300);
  }
  const toastBody = q => (q.iconId ? img(q.iconId, '', 3) : '') + `<span>${q.html}</span>`;
  function showToast(q) {
    const box = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + (q.cls || '');
    el.innerHTML = toastBody(q);
    el._q = q; q.at = performance.now();
    box.appendChild(el);
    toastLife(el, toastQ.length > 1 ? 1800 : 2600);
  }
  function toastLife(el, ms) { clearTimeout(el._tm); el._tm = setTimeout(() => toastOut(el), ms); }
  function toastOut(el) {
    if (!el || el.classList.contains('out')) return;
    clearTimeout(el._tm); el.classList.add('out');
    setTimeout(() => { el.remove(); pumpToasts(); }, 260);
  }
  // UI.toast(html, cls, icon, { k: kind (same-kind news merges), p: 0 small / 1 news (default) / 2 an answer, it })
  UI.toast = function (html, cls, iconId, o) {
    o = o || {};
    const k = o.k || '', p = o.p != null ? o.p : 1, now = performance.now();
    if (k && TOAST_N[k]) {
      // the same news again: the one waiting counts it, or the one just shown does
      const q = toastQ.find(x => x.k === k);
      if (q) { q.n++; q.items.push(o.it); q.html = TOAST_N[k](q); if (iconId) q.iconId = iconId; q.t0 = now; return; }
      const box = $('#toasts'), el = box && liveToasts(box).find(e => e._q && e._q.k === k && now - e._q.at < 2000);
      if (el) {
        const q2 = el._q; q2.n++; q2.items.push(o.it); q2.html = TOAST_N[k](q2); if (iconId) q2.iconId = iconId;
        el.innerHTML = toastBody(q2); toastLife(el, 2400);
        if (el.animate) el.animate([{ transform: 'scale(1.06)' }, { transform: 'none' }], { duration: 180 });
        return;
      }
    }
    // (a long line loses its oldest small news first)
    if (toastQ.length >= 6) { let i = toastQ.findIndex(x => x.p <= 0); if (i < 0) i = toastQ.findIndex(x => x.p < 2); toastQ.splice(i < 0 ? 0 : i, 1); }
    toastQ.push({ html, cls, iconId, k, p, t0: now, n: 1, items: [o.it] });
    pumpToasts();
  };
  UI.toastQueue = () => toastQ.length;
  // (a phone has room for one card at the top: when a champion's comes up, a toast that just came steps back into
  // the line, an older one goes)
  function toastsYield(force) {
    if (!narrowUI()) return;
    const c = document.getElementById('champCard'), box = $('#toasts');
    if (!box || (!force && (!c || c.hidden || c.classList.contains('out')))) return;
    const now = performance.now();
    for (const el of liveToasts(box)) {
      if (force && el._q && el._q.p >= 2) continue;
      if (el._q && now - el._q.at < 1200) { clearTimeout(el._tm); el.remove(); el._q.t0 = now; toastQ.unshift(el._q); }
      else if (force) { clearTimeout(el._tm); el.remove(); }
      else toastOut(el);
    }
    if (toastQ.length && !toastTm) toastTm = setTimeout(pumpToasts, 300);
  }
  // 3.3: big centre banners take turns (a burst of loot shows one by one, a little quicker when more wait).
  // 3.6: they show in the free field between the top HUD and the Button, never on it; they wait for the field's own
  // title card, a champion's card, a window or the town (and a loot banner for the end of a boss fight); each one
  // counts as a big moment for the pacing director. A loot banner whose moment has passed becomes a toast.
  const bannerQ = [];
  let bannerBusy = false, bannerTm = 0, bannerUpAt = 0;
  UI.bannerBusy = () => bannerBusy;
  function bannerHard() { return !!((G.uiBusy && G.uiBusy()) || G.R.town || (G.relicShow && G.relicShow())); }
  let cardSeenAt = -1e9;
  function bannerSoft(b) {
    // (a title card's words linger a beat after its turn ends: the banner gives them that beat)
    if (G.Stage && G.Stage.cardBusy && G.Stage.cardBusy()) { cardSeenAt = performance.now(); return true; }
    if (performance.now() - cardSeenAt < 500) return true;
    const c = document.getElementById('champCard'); if (c && !c.hidden && !c.classList.contains('out')) return true;
    return b.p <= 0 && !!G.R.boss;
  }
  // the band of field it may use: under the top HUD, over the Button (or the boss) and the Warden on it
  let btnArtH = 0;
  function placeBanner(el) {
    const w = $('#stageWrap'); if (!w) return;
    const wr = w.getBoundingClientRect();
    let top = 8;
    for (const s of ['.hud.top .realm', '.hud.top .hudBtns', '#xpBar']) { const e = $(s); if (e && !e.hidden && e.offsetParent) top = Math.max(top, e.getBoundingClientRect().bottom - wr.top + 6); }
    if (G.R.boss) { const bb = bossBarRect(); if (bb) top = Math.max(top, bb.bottom - wr.top + 4); }
    let bot = wr.height * 0.42;
    try {
      // (the Button's sprite top: its base sits 24 px under the point, its art rises h px from base + 4)
      const bp = G.Stage.buttonPoint(), sc = G.Stage.scale ? G.Stage.scale() : 2;
      if (!btnArtH) { try { btnArtH = G.SPR.button('#e8413c', false, 0).height || 46; } catch (e) { btnArtH = 46; } }
      bot = bp.y - wr.top + Math.min(G.R.boss ? -26 : -12, 28 - btnArtH - 4) * sc;
    } catch (e) { /* the stage is optional */ }
    if (bot - top < 90) top = Math.max(0, bot - 90);
    el.style.top = Math.round(top) + 'px'; el.style.height = Math.round(Math.max(60, bot - top)) + 'px';
    const inner = el.firstElementChild;
    el.style.placeItems = '';
    if (inner) {
      inner.style.scale = ''; inner.style.transformOrigin = '';
      const h = inner.offsetHeight, k = h > 0 ? Math.min(1, (bot - top) / h) : 1;
      // (an overflowing card sits at the band's top: it shrinks from there)
      if (k < 1) { const kk = Math.max(0.5, Math.floor(k * 100) / 100); inner.style.scale = String(kk); inner.style.transformOrigin = '50% 0'; el.style.placeItems = 'start center';
        // (too tall even scaled down: it keeps its foot over the Button and spills up over the top HUD instead)
        if (k < 0.5) el.style.top = Math.round(Math.max(0, bot - h * kk)) + 'px'; }
    }
  }
  function pumpBanner() {
    clearTimeout(bannerTm); bannerTm = 0;
    if (bannerBusy || !bannerQ.length) return;
    const now = performance.now();
    for (let i = bannerQ.length - 1; i >= 0; i--) { const b = bannerQ[i]; if (now - b.t0 > (b.stale || 30000)) { bannerQ.splice(i, 1); if (b.late) b.late(); } }
    const b = bannerQ[0];
    if (!b) return;
    // a window, the town, a relic, the field's own title card, a champion's card or (loot) a boss fight hold it;
    // past its stale time it goes (a loot banner as a line in the corner)
    if (bannerHard() || bannerSoft(b)) { bannerTm = setTimeout(pumpBanner, 250); return; }
    bannerQ.shift();
    const el = $('#banner');
    bannerBusy = true; bannerUpAt = now;
    el.innerHTML = b.html; el.hidden = false; el.classList.remove('out');
    toastsYield(true);
    placeBanner(el);
    // (its art may land a frame later and make it taller: then it fits itself again)
    for (const im of el.querySelectorAll('img')) if (!im.complete) im.addEventListener('load', () => { if (!el.hidden) placeBanner(el); }, { once: true });
    const ms = bannerQ.length ? b.ms * 0.7 : b.ms;
    if (G.director && G.director.mark) { try { G.director.mark('card', ms / 1000); } catch (e) { /* the director is optional */ } }
    setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.hidden = true; el.innerHTML = ''; bannerBusy = false; pumpBanner(); }, 400); }, ms);
  }
  // UI.bannerShow(html, ms, { p: 0 can wait out a boss fight, late: what to do when it went stale, stale: ms })
  UI.bannerShow = function (html, ms, o) {
    o = o || {};
    if (bannerQ.length > 2) { const i = bannerQ.findIndex(x => x.p <= 0); const d = bannerQ.splice(i >= 0 ? i : 0, 1)[0]; if (d && d.late) d.late(); }
    bannerQ.push({ html, ms: ms || 2000, p: o.p != null ? o.p : 1, late: o.late, stale: o.stale, t0: performance.now() });
    pumpBanner();
  };
  // (4.0: with the rolled piece g: its rainbow name for a mythic or divine, its Marks named)
  UI.banner = function (it, g) {
    const r = G.RARITIES[it.r];
    const title = it.r === 6 ? t('divineLoot') : it.r === 5 ? t('mythicLoot') : t('legendLoot');
    const mk = g && G.itemMarks ? G.itemMarks(g).map(m => `<small class="rbw">◆ ${esc(m.name)} ${esc(m.roman)}</small>`).join(' ') : '';
    // (in a burst or a boss fight it can come late: past its moment it's a line in the corner)
    UI.bannerShow(`<div class="inner ${it.r >= 5 ? 'ultB' : ''}" style="color:${r.color}"><h2 class="${it.r >= 5 ? 'rbw' : ''}">${esc(title)}</h2><img class="ico" src="${ic('it_' + it.id, 10)}" alt=""><p class="${it.r >= 5 ? 'rbw' : ''}">${esc(g ? gearName(g) : L(it.name))}</p>${mk ? `<p class="sub">${mk}</p>` : ''}</div>`, it.r >= 6 ? 2600 : 1700,
      { p: 0, stale: 20000, late: () => UI.toast(`<span>${esc(title)}: <b style="color:${r.color}">${esc(L(it.name))}</b></span>`, 'ach', 'it_' + it.id) });
  };
  UI.bannerU = function (q, first) {
    const U = G.UNIQUES[q];
    UI.bannerShow(`<div class="inner uqb ultB" style="color:${G.UNIQUE_COL}"><h2 class="rbw">${esc(first ? t('uqNew') : t('uqBanner'))}</h2><img class="ico" src="${ic('u_' + q, 10)}" alt=""><p class="rbw">${esc(U.name)}</p><p class="sub">${esc(U.fx)}</p></div>`, 3200,
      { p: 0, stale: 25000, late: () => UI.toast(`<span>${esc(first ? t('uqNew') : t('uqBanner'))}: <b style="color:${G.UNIQUE_COL}">${esc(U.name)}</b></span>`, 'ach', 'u_' + q) });
  };
  UI.modal = function (title, html, actions, locked) {
    const m = $('#modal');
    m.classList.remove('fallM');
    m.innerHTML = `<div class="box" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h2>${esc(title)}</h2>${html}<div class="acts">${(actions || []).map((a, i) => `<button class="btn ${a.cls || ''}" data-a="${i}">${esc(a.label)}</button>`).join('')}</div></div>`;
    m.hidden = false; m.dataset.locked = locked ? '1' : '';
    const close = () => { m.hidden = true; m.innerHTML = ''; };
    m.onclick = e => {
      const b = e.target.closest('[data-a]');
      if (b) { const a = actions[+b.dataset.a]; close(); a.fn && a.fn(); }
      else if (e.target === m && !locked) close();
    };
    return m;
    const first = m.querySelector('[data-a]'); if (first) first.focus();
  };
  UI.offline = function (r) {
    if (!r) return;
    // (4.0: time away never moves a Siege; the Barracks pays Embers for it)
    const html = `<p>${esc(t('awayFor', G.fmtTime(r.sec)))}</p>
      <div class="sumList">
        ${r.embers ? `<div>${img(EMB(), '', 3)}<span style="color:#ffa033">+${fmt(r.embers)} ${esc(t('embers'))}</span><small>${esc(t('awayBarracks'))}</small></div>` : ''}
        ${r.gold ? `<div>${img('ic_coin', '', 3)}<span style="color:var(--gold)">+${fmt(r.gold)}</span></div>` : ''}
        ${r.chests ? `<div>${img('ic_chest', '', 3)}<span>${esc(t('foundChests'))}: ${fmt(r.chests)}</span></div>` : ''}
        ${r.ess >= 0.1 ? `<div>${img('ic_ess', '', 3)}<span style="color:var(--ess)">+${fmt(r.ess, true)}</span></div>` : ''}
      </div>
      ${r.warden && r.warden.kills ? `<p>${esc(t('wardenAway'))}</p><div class="sumList">
        <div>${img('ic_sword', '', 3)}<span>${esc(t('offKills', fmt(r.warden.kills)))}</span></div>
        ${r.warden.levels ? `<div>${img('ic_star', '', 3)}<span style="color:#a8dcff">${esc(r.warden.levels === 1 ? t('offLevel1') : t('offLevels', r.warden.levels))}</span></div>` : ''}
        ${r.warden.perks ? `<div>${img('ic_bolt', '', 3)}<span style="color:#ffe27a">${esc(r.warden.perks === 1 ? t('offPerk1') : t('offPerks', r.warden.perks))}</span></div>` : ''}
        ${r.warden.shards ? `<div>${img('ic_shard', '', 3)}<span>${esc(t('offShards', fmt(r.warden.shards)))}</span></div>` : ''}
      </div>` : ''}`;
    // QoL: and what waits for you now, each one tap away
    const todo = todoList().slice(0, 5);
    const m = UI.modal(t('welcomeBack'), html + (r.rested ? `<p style="color:#8ae07a">${esc(t('restedNote'))}</p>` : '') + (todo.length ? `<div class="sect">${esc(t('todoTitle'))}</div>${todoHtml(todo)}` : ''), [{ label: t('collect'), cls: 'gold' }]);
    m.querySelectorAll('[data-todo]').forEach(b => b.addEventListener('click', () => { m.hidden = true; m.innerHTML = ''; todoGo(b.dataset.todo); }));
    return m;
  };
})(globalThis.G = globalThis.G || {});
