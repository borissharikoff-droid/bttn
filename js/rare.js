// BTTN 3.5 — rare: once-in-a-blue-moon surprises. Every few hours of play something happens that
// most players will only see a handful of times, each with a loud reveal and a codex entry:
//
//   merchant  THE LUCKY MERCHANT  a cloaked trader walks onto the field; tap him for a 30 s shop of
//                                 great deals (a sure top-rarity item, orbs, a shimmering egg, a chest
//                                 trove, a Midas draught, now and then a unique or a treasure map).
//   land      A SECRET LAND       about one march in 300 leads into a bonus zone for 75 s (the Gilded
//                                 Vault, Candy Hollow or the Upside Land): treasure goblins, a chest
//                                 rain, gold geysers, a soft and golden Horde; then the party marches back.
//   pet       A MYTHIC PET        three tier-4 pets (G.PETS, tier 4 'Mythic'): one hatch in 5000, or from
//                                 the merchant's egg, a secret land, a wish, or the Button of Legends.
//   horde     THE GOLDEN HORDE    one Stampede in 20 turns golden: the Horde pours in from every side
//                                 and every kill pays eight times the gold.
//   well      THE WISHING WELL    a well by the Button: toss a coin, pick one of three wishes.
//   gambler   THE GHOSTLY GAMBLER a ghost stakes its own gold: double or nothing, up to five times.
//   star      A SHOOTING STAR     streaks over the field for a few seconds: tap it for a wish.
//   king      THE GOBLIN KING     a huge treasure goblin that spills coins as it bleeds and flees in 24 s.
//   legend    THE BUTTON OF LEGENDS  one click in a million.
//
// Never in the tutorial, in town, in a Rift, during a boss, a cinematic or a march; one at a time,
// at least TUNE.rareGap seconds of play apart. All rolls go through G.rng. DOM-free like hero.js (it
// runs in the Node playtests); the show is js/rare_fx.js.
//
// Saved: S.st.rare {kind: count}, S.st.rareSeen {kind: play time first seen}, S.st.rareP (pity clocks),
// S.st.rareMap (a treasure map in hand), S.st.rareLog (the last 30 moments), S.st.rareLuckT.
// Runtime: R.rare. Events: 'rare' (kind, obj) for every reveal, plus rareSpawn, rareGone, rareShop,
// rareBuy, rareLandStart, rareLandEnd, rareGeyser, rareTrove, rareWish,
// rareFlip, rareKingCoins, rareKingKill, rareKingEscape, rarePet, rareSeen.
(function (G) {
  'use strict';
  if (!G.hook || !G.makeMob || !G.TUNE || !G.R) return; // needs hero.js
  const { emit, clamp } = G;
  const R = G.R, TUNE = G.TUNE;
  const rng = () => G.rng();
  const chance = p => rng() < p;
  const rand = (a, b) => a + rng() * (b - a);
  const randInt = (a, b) => Math.floor(a + rng() * (b - a + 1));
  const pickOf = arr => arr[Math.floor(rng() * arr.length)];
  const S_ = () => G.S;

  Object.assign(TUNE, {
    rareOn: 1,
    rareFrom: 300,            // nothing rare in a save's first five minutes of play
    rareRoll: 10,             // the field surprises roll once every this many seconds of unblocked play (owed rolls wait for a quiet field)...
    rareGap: 240,             // ...and never closer than this to the last one
    // per roll; each climbs with the hours since its last (x(1 + pity x hours)) and is sure after `hard` s
    rareMerchant: 0.0007, rareMerchantPity: 0.8, rareMerchantHard: 4 * 3600,
    rareWell: 0.0003, rareGambler: 0.0004, rareStar: 0.0005, rareKing: 0.0004, rarePity: 0.5, rareHard: 12 * 3600,
    rareMerchantWait: 24,     // he waits this long to be tapped, then walks off
    rareShopTime: 30,         // the shop stays open this long (real seconds in the browser)
    rareLand: 1 / 300,        // per march to a new zone; doubles after rareLandSoft marches without, sure at rareLandHard...
    rareLandSoft: 300, rareLandHard: 900, rareLandT: 75, rareLandFrom: 3,
    rareLandGap: 2 * 3600,    // ...but never within this much play of the last one (a treasure map ignores it)
    rareHorde: 1 / 20,        // per Stampede
    rareHordeGold: 8,
    rareTroveN: 8,            // a chest trove (the merchant's, a star's wish): this many chests, a tier up
    rarePet: 1 / 5000,        // per egg hatched...
    rarePetGap: 6 * 3600,     // ...and not within six hours of play of the last one (late-game hatcheries open thousands)
    rareLegend: 1e-6,         // per click of the Hand (no luck counts here)
    rareLuckMax: 3,
    rareStarT: 5.5, rareWellT: 26, rareGamblerT: 22, rareKingT: 24,
  });

  // ---------- Strings (the UI may translate them; these are the fallbacks) ----------
  if (G.STR) {
    const s = G.STR, put = (k, v) => { if (!s[k]) s[k] = v; };
    put('rareTag', 'ONCE IN A BLUE MOON');
    put('rareFirst', 'FIRST SIGHTING');
    put('rareCodex', 'Rare sightings');
    put('feedRare', '{0}');
  }

  // ---------- The codex ----------
  G.RARE_LOG = [
    { id: 'merchant', feed: 'met the Lucky Merchant', name: 'The Lucky Merchant', col: '#ffd84a', icon: 'ic_coin', odds: 'about once in 1–3 hours', desc: 'A cloaked trader with a pack full of bargains. Tap him before he leaves.' },
    { id: 'land', feed: 'found a SECRET LAND', name: 'A Secret Land', col: '#ff8ad8', icon: 'ic_star', odds: 'about 1 march in 300', desc: 'A wrong turn into a land of treasure: the Gilded Vault, Candy Hollow or the Upside Land.' },
    { id: 'pet', feed: 'hatched a MYTHIC pet', name: 'A Mythic Pet', col: '#ff5fd2', icon: 'ic_egg', odds: '1 hatch in 5000', desc: 'Three pets above Divine. Eggs, wishes and secret lands may hold one.' },
    { id: 'horde', name: 'The Golden Horde', col: '#ffd84a', icon: 'ev_stampede', odds: '1 Stampede in 20', desc: 'The Stampede turns to gold: every kill pays eight times.' },
    { id: 'well', name: 'The Wishing Well', col: '#7fe9ff', icon: 'ic_star', odds: 'once in a blue moon (more on a full one)', desc: 'Toss a coin and make one of three wishes.' },
    { id: 'gambler', name: 'The Ghostly Gambler', col: '#c8d6ff', icon: 'ic_coin', odds: 'every few hours', desc: 'A ghost stakes its own gold. Double or nothing?' },
    { id: 'star', name: 'A Shooting Star', col: '#fff3a0', icon: 'ic_star', odds: 'every few hours', desc: 'Tap it before it is gone and make a wish.' },
    { id: 'king', feed: 'met the Goblin King', name: 'The Goblin King', col: '#8ae07a', icon: 'ic_crown', odds: 'every few hours', desc: 'A giant treasure goblin that bleeds coins. Catch him!' },
    { id: 'legend', feed: 'pressed the BUTTON OF LEGENDS', name: 'The Button of Legends', col: '#ffffff', icon: 'ic_jackpot', odds: '1 click in a million', desc: 'Nobody knows what happens. Nobody has pressed it right.' },
  ];
  const LOG_BY_ID = {}; G.RARE_LOG.forEach(e => { LOG_BY_ID[e.id] = e; });

  // ---------- Saved bits ----------
  function st() { const s = S_().st; if (!s.rare || typeof s.rare !== 'object') s.rare = {}; return s.rare; }
  function seenOf() { const s = S_().st; if (!s.rareSeen || typeof s.rareSeen !== 'object') s.rareSeen = {}; return s.rareSeen; }
  function pity() { const s = S_().st; if (!s.rareP || typeof s.rareP !== 'object') s.rareP = { field: 0, land: 0 }; return s.rareP; }
  function record(kind, sub) {
    const S = S_(), n = st(), seen = seenOf(), first = !seen[kind];
    n[kind] = (n[kind] || 0) + 1;
    if (first) seen[kind] = Math.round(S.st.playTime || 0);
    if (sub) { const k = kind + ':' + sub; n[k] = (n[k] || 0) + 1; if (!seen[k]) seen[k] = Math.round(S.st.playTime || 0); }
    if (!Array.isArray(S.st.rareLog)) S.st.rareLog = [];
    S.st.rareLog.push({ k: kind, s: sub || null, t: Math.round(S.st.playTime || 0), d: S.depth || 0 });
    if (S.st.rareLog.length > 30) S.st.rareLog.splice(0, S.st.rareLog.length - 30);
    // the rarest ones go on the friends' feed
    const L = LOG_BY_ID[kind];
    if (G.feed && L && L.feed) { try { G.feed('rare', L.feed); } catch (e) { /* the feed is optional */ } }
    emit('rareSeen', kind, first, sub);
    return first;
  }
  G.rareCodex = () => {
    const n = S_().st.rare || {}, seen = S_().st.rareSeen || {};
    return G.RARE_LOG.map(e => Object.assign({}, e, { n: n[e.id] || 0, first: seen[e.id] != null ? seen[e.id] : null }));
  };

  // ---------- Runtime ----------
  function fresh() { return { S: G.S, acc: 0, cur: null, land: null, gild: null, midas: 0, uid: 0, own: false, pull: false }; }
  const RR = () => { if (!R.rare || R.rare.S !== G.S) R.rare = fresh(); return R.rare; };
  RR();
  G.rareState = RR;
  const inc = () => Math.max(1, G.casinoIncome ? G.casinoIncome() : (G.D.incomeRef || 1));
  // gold from a surprise: kept out of the casino's estimate of what the purse takes in (G.casinoIncome),
  // which every payout here is measured in, so a gold geyser can't feed the next one
  function addG(g) { if (!(g > 0)) return; if (G.casino) G.casino().own += g; G.addGold(g, 'rare'); }
  // the odds of the surprises: a Clover Sprite or Golden Buttonling (G.D.rareLuck, up to x2) and a wish of Luck (x2 for an
  // hour), never more than TUNE.rareLuckMax in all
  const luck = () => Math.min(TUNE.rareLuckMax, Math.min(2, G.D.rareLuck || 1) * ((S_().st.rareLuckT || 0) > (S_().st.playTime || 0) ? 2 : 1));

  // What keeps every surprise away: no Warden, the tutorial, town, a cinematic, a Rift, a window open
  function blocked() {
    const S = S_();
    if (!TUNE.rareOn || !S || !S.hero || !S.hero.cls) return 'hero';
    if (G.Tut && S.tut >= 0) return 'tut';
    if (R.town) return 'town';
    if (R.cine > 0) return 'cine';
    if (R.rift) return 'rift';
    if (G.uiBusy && G.uiBusy()) return 'ui';
    return null;
  }
  G.rareBlocked = blocked;
  // ...and what keeps a surprise from walking onto the field: a boss, a march, an invasion, a Land Champion,
  // a sudden event, another surprise (a boss that is only waiting to come waits a little longer: see the tick)
  function fieldOk() {
    const r = RR(), S = S_();
    return !blocked() && !R.boss && !R.march && !R.inv && !R.champ && !R.ev && !r.cur && !r.land
      && (S.st.playTime || 0) >= TUNE.rareFrom && (!G.director || G.director.can('rare', 1));
  }
  G.rareFieldOk = fieldOk;

  // ---------- The rolls ----------
  // the field surprises: [kind, base odds, pity per hour, sure after]
  const FIELD = () => [
    ['merchant', TUNE.rareMerchant, TUNE.rareMerchantPity, TUNE.rareMerchantHard],
    ['star', TUNE.rareStar, TUNE.rarePity, TUNE.rareHard],
    ['king', TUNE.rareKing, TUNE.rarePity, TUNE.rareHard],
    ['gambler', TUNE.rareGambler, TUNE.rarePity, TUNE.rareHard],
    ['well', TUNE.rareWell * moonK(), TUNE.rarePity, TUNE.rareHard],
  ];
  // the Wishing Well comes three times as often on the nights round a full moon (a real one)
  function moonK() {
    if (typeof Date === 'undefined') return 1;
    const days = (Date.now() / 864e5 - 10957.5 + 3.1) % 29.530588; // days since a new moon (2000-01-06)
    return Math.abs(days - 14.77) < 1.2 ? 3 : 1;
  }
  G.rareMoon = () => moonK() > 1;
  // the clocks (and the rolls owed) run through all of play that isn't blocked, boss fights and marches too;
  // the rolls themselves wait for a quiet field, so a fast player who is always fighting meets them as often
  function clockField(dt) {
    const r = RR(), P = pity();
    P.field = (P.field || 0) + dt;
    for (const [k] of FIELD()) P[k] = (P[k] || 0) + dt;
    r.acc = Math.min(r.acc + dt, TUNE.rareRoll * 90);
  }
  function rollField() {
    const r = RR(), P = pity();
    while (r.acc >= TUNE.rareRoll) {
      r.acc -= TUNE.rareRoll;
      if (P.field < TUNE.rareGap) { r.acc = 0; return; }
      const L = luck();
      for (const [k, base, pk, hard] of FIELD()) {
        const p = base * L * (1 + pk * (P[k] || 0) / 3600);
        if ((P[k] || 0) >= hard || chance(p)) { r.acc = 0; spawnField(k); return; }
      }
    }
  }
  // 3.6: how long each visitor holds the field, for the pacing director (it ends early when the visitor goes)
  const RARE_SECS = { merchant: 40, star: 6, king: 24, gambler: 22, well: 26 };
  ['rareGone', 'rareKingKill'].forEach(k => G.on(k, () => { if (G.director) G.director.end('rare'); }));
  function spawnField(k, force) {
    const r = RR(), P = pity();
    if (r.cur) clearCur('force');
    P.field = 0; P[k] = 0;
    if (G.director) G.director.mark('rare', RARE_SECS[k] || 20);
    if (k === 'merchant') return spawnMerchant();
    if (k === 'star') return spawnStar();
    if (k === 'king') return spawnKing();
    if (k === 'gambler') return spawnGambler();
    if (k === 'well') return spawnWell();
    return null;
  }

  // ---------- Shared bits ----------
  const at = (o, dp) => ({ id: -77, a: o.a, p: clamp(o.p + (dp || 0), 0.05, 1) });
  // where a visitor stands: off to the left or the right of the Button, level with it (a is the angle round the Button:
  // 0 and 1 are the top corners under the HUD, 0.5 the bottom, where the slot machine and the level-up cards sit)
  const sideA = () => (chance(0.5) ? rand(0.12, 0.22) : rand(0.78, 0.88));
  function clearCur(why) {
    const r = RR(), c = r.cur;
    if (!c) return;
    if (c.m) removeMob(c.m);
    r.cur = null;
    c.why = why;
    if (G.director) G.director.end('rare');
    emit('rareGone', c, why);
  }
  function removeMob(m) {
    const i = R.mobs.indexOf(m);
    if (i >= 0) { R.mobs.splice(i, 1); m.dead = true; m.gone = true; emit('mobFlee', m); }
    if (R.focus === m.id) R.focus = null;
  }
  function uniqueAny() {
    const S = S_(), d = G.depthNow ? G.depthNow() : S.depth;
    const ok = (G.UNIQUE_IDS || []).filter(q => { const U = G.UNIQUES[q]; return U && U.minD <= d && !U.boss; });
    if (!ok.length) return null;
    const fresh = ok.filter(q => !S.uq[q]), from = fresh.length && chance(0.6) ? fresh : ok;
    return pickOf(from);
  }
  function orbs(list, o) {
    if (!G.dropItem) return;
    list.forEach((k, i) => { if (!G.ORBS || G.ORBS[k]) G.dropItem('orb', k, o && o.m || null, Object.assign({ src: 'rare', wait: 0.2 + i * 0.1, spread: 0.06 }, o || {})); });
  }
  function rainChests(n, bump) {
    let got = 0;
    for (let i = 0; i < n; i++) {
      R.rain = 1;
      const c = G.spawnChest(Math.max(1, Math.min(G.rarityCap(), G.rollTier() + (bump || 0))));
      R.rain = 0;
      if (c) got++;
    }
    return got;
  }

  // ================= THE LUCKY MERCHANT =================
  // His wares. price: [currency, amount]; secs: gold in seconds of income; sh: shards as gamble costs
  const WARES = {
    gear:  { name: 'Sealed Masterwork', icon: 'ic_sword', col: '#ff9a3a', cur: 'shards', sh: 2.5, desc: () => 'A sure ' + rarName(G.rarityCap()) + ' item' },
    orbs:  { name: 'Orb Satchel', icon: 'orb_ascent', col: '#7fe9ff', cur: 'gold', secs: 120, desc: () => '4 Orbs of Ascent + 1 Orb of Grace' },
    egg:   { name: 'Shimmering Egg', icon: 'ic_egg', col: '#ff5fd2', cur: 'gold', secs: 200, desc: () => 'Hatches Legendary or better · 1 in 10 Mythic' },
    trove: { name: 'Chest Trove', icon: 'ic_chest', col: '#e0a060', cur: 'gold', secs: 80, desc: () => TUNE.rareTroveN + ' good chests rain down' },
    midas: { name: 'Midas Draught', icon: 'ic_coin', col: '#ffd84a', cur: 'gold', secs: 40, desc: () => 'All gold ×3 for 60 s' },
    eggs:  { name: 'Nest of Eggs', icon: 'ic_egg', col: '#f1ece0', cur: 'shards', sh: 0.8, desc: () => '3 eggs' },
    uq:    { name: 'Curio of Legend', icon: 'ic_crown', col: '#e8903a', cur: 'shards', sh: 5, rare: 1, desc: () => 'A unique item' },
    map:   { name: 'Treasure Map', icon: 'ic_scroll', col: '#ff8ad8', cur: 'gold', secs: 300, rare: 1, desc: () => 'Your next march finds a secret land' },
  };
  G.RARE_WARES = WARES;
  const rarName = r => (G.RARITIES && G.RARITIES[r] ? G.RARITIES[r].name : 'rare');
  function gambleUnit() { return Math.max(10, G.gambleCost ? G.gambleCost() : 30); }
  function makeOffers() {
    const pool = ['orbs', 'egg', 'trove', 'midas', 'eggs'];
    const out = ['gear'];
    if (chance(0.3)) out.push(chance(0.5) ? 'uq' : 'map');
    while (out.length < 4 && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    return out.map(k => {
      const W = WARES[k];
      const price = W.cur === 'gold' ? Math.ceil(inc() * W.secs) : Math.ceil(gambleUnit() * W.sh);
      return { k, cur: W.cur, price, was: Math.ceil(price * (3 + Math.floor(rng() * 3))), sold: false, desc: W.desc() };
    });
  }
  function spawnMerchant() {
    const r = RR();
    const c = r.cur = { k: 'merchant', id: ++r.uid, a: sideA(), p: -0.06, to: rand(0.42, 0.52), st: 'in', t: 0,
      wait: TUNE.rareMerchantWait, shopT: 0, offers: makeOffers(), bought: 0, S: G.S };
    record('merchant');
    emit('rareSpawn', c);
    emit('rare', 'merchant', c);
    return c;
  }
  function tickMerchant(c, dt) {
    c.t += dt;
    if (c.st === 'in') { c.p = Math.min(c.to, c.p + dt * 0.16); if (c.p >= c.to) c.st = 'wait'; }
    else if (c.st === 'wait') { if ((c.wait -= dt) <= 0) { c.st = 'out'; emit('rareLeave', c, 'ignored'); } }
    else if (c.st === 'shop') { if ((c.shopT -= dt) <= 0) closeShop(); }
    else if (c.st === 'out') { c.p -= dt * 0.2; if (c.p <= -0.08) clearCur(c.bought ? 'done' : 'left'); }
  }
  // tap him: the shop opens
  function openShop() {
    const c = RR().cur;
    if (!c || c.k !== 'merchant' || (c.st !== 'wait' && c.st !== 'in')) return null;
    c.st = 'shop'; c.shopT = TUNE.rareShopTime;
    // (prices follow what the purse takes in right now)
    for (const o of c.offers) if (!o.sold && o.cur === 'gold') { const W = WARES[o.k]; o.price = Math.ceil(inc() * W.secs); o.was = Math.max(o.was, o.price * 3); }
    emit('rareShop', c);
    return c;
  }
  function closeShop() {
    const c = RR().cur;
    if (!c || c.k !== 'merchant' || c.st !== 'shop') return false;
    c.st = 'out';
    emit('rareShopClose', c);
    emit('rareLeave', c, c.bought ? 'thanks' : 'shrug');
    return true;
  }
  G.rareShopClose = closeShop;
  G.rareCanBuy = function (i) {
    const c = RR().cur, S = S_();
    if (!c || c.k !== 'merchant' || c.st !== 'shop') return false;
    const o = c.offers[i];
    if (!o || o.sold) return false;
    return o.cur === 'gold' ? S.gold >= o.price : (S.hero.shards || 0) >= o.price;
  };
  G.rareBuy = function (i) {
    const c = RR().cur, S = S_();
    if (!G.rareCanBuy(i)) return null;
    const o = c.offers[i];
    if (o.cur === 'gold') S.gold -= o.price; else S.hero.shards -= o.price;
    o.sold = true; c.bought++;
    const got = giveWare(o.k, c);
    S.st.rareBuys = (S.st.rareBuys || 0) + 1;
    G.dirty();
    emit('rareBuy', c, o, got);
    return got;
  };
  function giveWare(k, c) {
    const S = S_(), spot = at(c, 0.08);
    if (k === 'gear') {
      const it = G.pickItem(G.rarityCap());
      if (G.dropItem) G.dropItem('gear', it, spot, { src: 'merchant', spread: 0.03 });
      else G.lootItem(it, 'merchant');
      return { gear: it.r, name: it.name };
    }
    if (k === 'orbs') { orbs(['ascent', 'ascent', 'ascent', 'ascent', 'grace'], { m: spot }); return { orbs: 5 }; }
    if (k === 'egg') { const res = hatch(2, 0.1, 'merchant'); return { pet: res && res.pet.id, mythic: res && res.pet.tier === 4 }; }
    if (k === 'trove') return { chests: trove('merchant') };
    if (k === 'midas') { RR().midas = Math.max(RR().midas, 60); G.dirty(); emit('rareMidas', 60); return { midas: 60 }; }
    if (k === 'eggs') { const n = G.addEggs ? G.addEggs(3) : 0; return { eggs: n }; }
    if (k === 'uq') { const q = uniqueAny(); if (q && G.dropItem) G.dropItem('uq', q, spot, { src: 'merchant' }); return { uq: q }; }
    if (k === 'map') { S.st.rareMap = 1; return { map: 1 }; }
    return {};
  }

  // ================= A SECRET LAND =================
  const LANDS = G.RARE_LANDS = {
    vault:  { name: 'The Gilded Vault', sub: 'Everything here is made of gold', col: '#ffd84a', gold: 10, click: 4, chest: 3, geyser: 8 },
    candy:  { name: 'Candy Hollow', sub: 'Sweet, sticky and full of eggs', col: '#ff8ad8', gold: 6, click: 3, chest: 4, geyser: 5, eggs: 1 },
    upside: { name: 'The Upside Land', sub: 'Down is up, and loot rains upward', col: '#7fe9ff', gold: 6, click: 3, chest: 3, geyser: 5, gear: 1 },
  };
  G.on('marchStart', () => {
    const r = RR(), S = S_();
    if (r.own || r.land) return;
    if (blocked() || (S.bestDepth || 0) < TUNE.rareLandFrom || (S.st.playTime || 0) < TUNE.rareFrom) return;
    const P = pity(), now = S.st.playTime || 0;
    if (!S.st.rareMap && S.st.rareLandAt != null && now - S.st.rareLandAt < TUNE.rareLandGap) return;
    P.land = (P.land || 0) + 1;
    const p = TUNE.rareLand * luck() * (P.land >= TUNE.rareLandSoft ? 2 : 1);
    if (S.st.rareMap || P.land >= TUNE.rareLandHard || chance(p)) {
      const map = !!S.st.rareMap;
      S.st.rareMap = 0;
      startLand(null, map);
    }
  });
  function startLand(k, map) {
    const r = RR(), P = pity();
    if (r.land) return r.land;
    if (r.cur) clearCur('land');
    k = k && LANDS[k] ? k : pickOf(Object.keys(LANDS));
    P.land = 0;
    G.S.st.rareLandAt = Math.round(G.S.st.playTime || 0);
    const L = LANDS[k];
    const land = r.land = { k, name: L.name, sub: L.sub, col: L.col, t: TUNE.rareLandT, T: TUNE.rareLandT, on: false, map: !!map,
      gobT: 1, rainT: 0.4, geyT: 2, eggT: 6, gearT: 4, haul: { gold: 0, chests: 0, eggs: 0, drops: 0, goblins: 0 }, meter: G.S.bossMeter || 0, S: G.S };
    record('land', k);
    if (G.director) G.director.mark('rare', TUNE.rareLandT + 3);
    emit('rareLandStart', land);
    emit('rare', 'land', land);
    return land;
  }
  function tickLand(land, dt) {
    const S = S_(), L = LANDS[land.k];
    if (R.boss || R.rift) { endLand('boss'); return; }
    // the way in: the march from the boss has to finish first
    // (its geysers are measured against the purse as it was on the way in, not as the land's own gold swells it)
    if (!land.on) { if (R.march) return; land.on = true; land.inc = inc(); emit('rareLandOn', land); }
    // nothing else gets in: no boss calls, no sudden events, no champions
    R.bossHold = Math.max(R.bossHold || 0, 1);
    if (R.bossReady && R.bossIn != null) R.bossIn = Math.max(R.bossIn, 1);
    if (R.evT != null && R.evT < 5) R.evT = 5;
    R.chRetry = Math.max(R.chRetry || 0, 5);
    land.t -= dt;
    // treasure goblins, up to six at once
    if ((land.gobT -= dt) <= 0) {
      land.gobT = rand(1.4, 2.4);
      const n = R.mobs.filter(m => m.rareGob).length;
      if (n < 6 && R.mobs.length < TUNE.mobMax) {
        const m = G.makeMob('hoard', rand(0.08, 0.92), rand(0.5, 0.7));
        m.gob = 1; m.rareGob = 1; m.gild = 1; m.w = 0.4; m.hp = m.max = G.mobHp(G.depthNow()) * 2.5;
        m.move = 'hoard'; m.life = rand(10, 16); m.dir = chance(0.5) ? 1 : -1; m.ph = rand(0, 6);
        land.haul.goblins++;
      }
    }
    // a rain of chests, a step better than the depth's own
    if ((land.rainT -= dt) <= 0) { land.rainT = 0.55; land.haul.chests += rainChests(1, 1); }
    // gold geysers by the Button
    if ((land.geyT -= dt) <= 0) {
      land.geyT = 3;
      const g = (land.inc || inc()) * L.geyser;
      addG(g); land.haul.gold += g;
      emit('rareGeyser', g, land);
    }
    if (L.eggs && (land.eggT -= dt) <= 0) { land.eggT = 7; const n = G.addEggs ? G.addEggs(1) : 0; land.haul.eggs += n; if (n) emit('rareCandyEgg', land); }
    if (L.gear && (land.gearT -= dt) <= 0 && G.lootShower) {
      land.gearT = 5;
      G.lootShower(null, 3, Math.min(G.rarityCap(), 2), 0, { at: { a: rand(0.2, 0.8), p: rand(0.55, 0.85) }, floorN: 1, src: 'rare', spread: 0.12 });
      land.haul.drops += 3;
    }
    if (land.t <= 0) endLand('time');
  }
  function endLand(why) {
    const r = RR(), land = r.land;
    if (!land) return;
    r.land = null;
    // the land's last gift: a treasure trove where the party stood
    if (why === 'time' && G.lootShower) {
      const cap = G.rarityCap();
      G.lootShower(null, 8, Math.min(cap, 3), 0.25, { at: { a: 0.5, p: 0.75 }, floorN: 3, src: 'rare', spread: 0.18, rolls: 2 });
      orbs(['ascent', chance(0.4) ? 'grace' : 'ascent', 'flux'], { at: { a: 0.5, p: 0.75 } });
      land.haul.drops += 11;
      if (chance(0.05 * luck())) hatchMythic('land');
    }
    // the goblins that are left run home, and the clear bar is where the party left it (the land was a detour)
    for (const m of R.mobs.slice()) if (m.rareGob) removeMob(m);
    if (land.S === G.S && !R.boss) G.S.bossMeter = Math.min(G.S.bossMeter || 0, land.meter);
    land.why = why;
    if (G.director) G.director.end('rare');
    emit('rareLandEnd', land, why);
    // and the party marches back to where it was
    if (why === 'time' && !R.rift && !R.boss) {
      R.march = { t: TUNE.marchTime || 2.4, T: TUNE.marchTime || 2.4 };
      r.own = true; emit('marchStart', R.march.T, false); r.own = false;
    }
  }
  G.rareLandEnd = () => endLand('debug');
  // every mob born in a secret land or a Golden Horde is made of gold
  G.on('mobSpawn', m => { const r = R.rare; if (r && (r.land && r.land.on || r.gild)) m.gild = 1; });

  // gold, chests and the Horde's health and bite, through the arena's multiplier (js/events.js, js/casino.js)
  const baseEv = G.evMul || (() => 1);
  G.evMul = k => {
    let v = baseEv(k);
    const r = R.rare;
    if (!r) return v;
    if (r.land && r.land.on) {
      const L = LANDS[r.land.k];
      if (k === 'gold') v *= L.gold; else if (k === 'click') v *= L.click; else if (k === 'chest') v *= L.chest;
      else if (k === 'mobHp') v *= 0.6; else if (k === 'bite') v *= 0.3;
    }
    if (r.gild && k === 'gold') v *= TUNE.rareHordeGold;
    if (r.midas > 0 && (k === 'gold' || k === 'click')) v *= 3;
    return v;
  };

  // ================= A CHEST TROVE (3.6: in place of Free-Spin Fever) =================
  function trove(src, n) {
    const got = rainChests(n || TUNE.rareTroveN, 1);
    emit('rareTrove', got, src);
    return got;
  }

  // ================= THE GOLDEN HORDE =================
  G.on('evStart', (ev, e) => {
    const r = RR();
    if (!e || e.id !== 'stampede' || r.gild || blocked()) return;
    if (r.forceHorde || chance(TUNE.rareHorde * luck())) { r.forceHorde = false; gild(ev); }
  });
  function gild(ev) {
    const r = RR();
    ev.t += 6; ev.T += 6;
    const g = r.gild = { ev, acc: 0, t: ev.t, kills: 0, gold: 0, S: G.S };
    for (const m of R.mobs) m.gild = 1;
    record('horde');
    emit('rare', 'horde', g);
    return g;
  }
  G.on('evEnd', ev => {
    const r = R.rare;
    if (!r || !r.gild || r.gild.ev !== ev) return;
    const g = r.gild; r.gild = null;
    // and the herd leaves a pile of chests behind
    g.chests = rainChests(6, 1);
    emit('rareHordeEnd', g);
  });
  function tickGild(g, dt) {
    if (R.ev !== g.ev) { RR().gild = null; emit('rareHordeEnd', g); return; }
    // packs from every side, not one
    g.acc += dt;
    while (g.acc >= 0.45 && R.mobs.length < TUNE.mobMax) { g.acc -= 0.45; G.spawnPack(false, rng()); }
    if (g.acc >= 0.45) g.acc = 0;
  }

  // ================= THE WISHING WELL =================
  const WISHES = {
    riches:  { name: 'Riches', desc: 'Ten minutes of gold, now', col: '#ffd84a', icon: 'ic_coin' },
    fortune: { name: 'Fortune', desc: '2 Orbs of Grace and 2 of Ascent', col: '#7fe9ff', icon: 'orb_grace' },
    kin:     { name: 'Kin', desc: 'A Shimmering Egg and 2 eggs', col: '#ff5fd2', icon: 'ic_egg' },
    luck:    { name: 'Luck', desc: 'Rare surprises ×3 for an hour', col: '#8ae07a', icon: 'ic_star' },
    glory:   { name: 'Glory', desc: 'A unique item', col: '#e8903a', icon: 'ic_crown' },
  };
  G.RARE_WISHES = WISHES;
  function spawnWell() {
    const r = RR();
    const keys = Object.keys(WISHES), pick3 = [];
    while (pick3.length < 3) { const k = keys.splice(Math.floor(rng() * keys.length), 1)[0]; pick3.push(k); }
    const c = r.cur = { k: 'well', id: ++r.uid, a: sideA(), p: rand(0.5, 0.58), t: 0, T: TUNE.rareWellT, open: false, wishes: pick3, moon: moonK() > 1, S: G.S };
    record('well');
    emit('rareSpawn', c);
    emit('rare', 'well', c);
    return c;
  }
  function grantWish(k, src, spot) {
    const S = S_(), got = { k };
    spot = spot || { a: 0.5, p: 0.75 };
    if (k === 'riches') { got.gold = inc() * 600; addG(got.gold); }
    else if (k === 'fortune') { orbs(['ascent', 'grace', 'ascent', 'grace'], { at: spot }); got.orbs = 4; }
    else if (k === 'kin') { const res = hatch(2, 0.1, src); got.pet = res && res.pet.id; got.mythic = !!(res && res.pet.tier === 4); got.eggs = G.addEggs ? G.addEggs(2) : 0; }
    else if (k === 'luck') { S.st.rareLuckT = Math.max(S.st.rareLuckT || 0, S.st.playTime || 0) + 3600; got.luck = 3600; }
    else if (k === 'glory') { const q = uniqueAny(); if (q && G.dropItem) G.dropItem('uq', q, null, { at: spot, src: 'rare' }); got.uq = q; }
    else if (k === 'mythic') { const res = hatchMythic(src); got.pet = res && res.pet.id; got.mythic = true; }
    else if (k === 'trove') { got.chests = trove(src); }
    else if (k === 'eggs') { got.eggs = G.addEggs ? G.addEggs(3) : 0; }
    G.dirty();
    return got;
  }
  G.rareWish = function (i) {
    const c = RR().cur;
    if (!c || c.k !== 'well' || !c.open || c.done) return null;
    const k = c.wishes[i];
    if (!k) return null;
    c.done = true;
    const got = grantWish(k, 'well', at(c, 0.05));
    emit('rareWish', c, k, got);
    c.t = Math.max(c.t, c.T - 1.5); // it sinks away
    return got;
  };

  // ================= THE GHOSTLY GAMBLER =================
  function spawnGambler() {
    const r = RR();
    const stake = Math.ceil(inc() * 60);
    const c = r.cur = { k: 'gambler', id: ++r.uid, a: sideA(), p: rand(0.45, 0.55), t: 0, T: TUNE.rareGamblerT, open: false, stake, pot: stake, flips: 0, max: 5, done: false, S: G.S };
    record('gambler');
    emit('rareSpawn', c);
    emit('rare', 'gambler', c);
    return c;
  }
  G.rareFlip = function () {
    const c = RR().cur;
    if (!c || c.k !== 'gambler' || !c.open || c.done || c.flips >= c.max) return null;
    c.flips++;
    const win = chance(0.55);
    c.last = win;
    if (win) c.pot *= 2; else { c.lost = c.pot; c.pot = 0; c.done = true; c.t = Math.max(c.t, c.T - 3); }
    S_().st.rareFlips = (S_().st.rareFlips || 0) + 1;
    emit('rareFlip', c, win);
    if (win && c.flips >= c.max) G.rareCash();
    return { win, pot: c.pot, flips: c.flips };
  };
  G.rareCash = function () {
    const c = RR().cur;
    if (!c || c.k !== 'gambler' || !c.open || c.done) return null;
    c.done = true; c.cashed = c.pot;
    addG(c.pot);
    const S = S_(); S.st.rareGhostBest = Math.max(S.st.rareGhostBest || 0, c.flips);
    emit('rareCash', c, c.pot);
    c.t = Math.max(c.t, c.T - 2.5);
    return c.pot;
  };

  // walk away from the well or the ghost: the well sinks, the ghost hands over what is on the table
  G.rareDismiss = function () {
    const c = RR().cur;
    if (!c || (c.k !== 'well' && c.k !== 'gambler')) return false;
    if (c.k === 'gambler' && c.open && !c.done && c.pot > 0) G.rareCash();
    c.open = false; c.done = true; c.t = Math.max(c.t, c.T - 1.2);
    emit('rareDismiss', c);
    return true;
  };

  // ================= A SHOOTING STAR =================
  // what a wish on a star brings: [wish, weight]
  const STAR_W = [['riches', 30], ['eggs', 22], ['fortune', 18], ['glory', 14], ['trove', 10], ['luck', 4], ['mythic', 2]];
  function spawnStar() {
    const r = RR();
    const c = r.cur = { k: 'star', id: ++r.uid, t: 0, T: TUNE.rareStarT, dir: chance(0.5) ? 1 : -1, y: rand(0.28, 0.38), caught: false, S: G.S };
    record('star');
    emit('rareSpawn', c);
    emit('rare', 'star', c);
    return c;
  }
  function starWish() {
    let tot = 0; for (const x of STAR_W) tot += x[1];
    let v = rng() * tot;
    for (const [k, w] of STAR_W) { v -= w; if (v < 0) return k; }
    return 'riches';
  }

  // ================= THE GOBLIN KING =================
  function spawnKing() {
    const r = RR(), d = G.depthNow();
    const m = G.makeMob('hoard', rand(0.15, 0.85), 0.5);
    m.inv = null; m.br = 0;
    m.gob = 1; m.gk = 1; m.gild = 1; m.w = 3; m.move = 'gking'; m.life = TUNE.rareKingT; m.dir = chance(0.5) ? 1 : -1; m.ph = rand(0, 6);
    m.a = sideA(); m.p = 0.3;
    const eff = G.champEffDps ? G.champEffDps() : Math.max(1, G.D.heroDps || 1);
    const mh = G.mobHp(d) * (G.torment ? G.torment().mobHp : 1);
    m.hp = m.max = clamp(eff * 11, mh * 25, mh * 160);
    if (!R.focus) R.focus = m.id;
    const c = r.cur = { k: 'king', id: ++r.uid, m, a: m.a, p: m.p, t: 0, T: TUNE.rareKingT, lost: 0, coins: 0, gold: 0, drops: 0, S: G.S };
    record('king');
    emit('rareSpawn', c);
    emit('rare', 'king', c);
    return c;
  }
  // he runs round the upper field, just out of the Horde's way, and bolts for the edge when his time is up
  const prevMove = G.moveMob;
  G.moveMob = function (m, dt) {
    if (m.move !== 'gking') return prevMove ? prevMove(m, dt) : undefined;
    m.life -= dt; m.ph += dt * 1.6;
    if (m.life > 1.5) {
      m.a += m.dir * dt * 0.06;
      if (m.a > 0.97 || m.a < 0.03) { m.dir = -m.dir; m.a = clamp(m.a, 0.03, 0.97); }
      m.p += (0.4 + 0.1 * Math.sin(m.ph) - m.p) * Math.min(1, dt * 2);
    } else m.p -= dt * 0.35;
    if (m.life <= 0 || m.p < -0.06) {
      m.dead = true; m.gone = true;
      const i = R.mobs.indexOf(m); if (i >= 0) R.mobs.splice(i, 1);
      if (R.focus === m.id) R.focus = null;
      emit('mobFlee', m);
    }
  };
  G.hook('hit', (m, dmg) => {
    if (!m.gk) return;
    const c = R.rare && R.rare.cur;
    if (!c || c.m !== m || !(dmg > 0)) return;
    // he bleeds coins: a purse for every 8% of his health, a piece of gear for every 25%
    const before = c.lost;
    c.lost = Math.min(1, c.lost + Math.min(dmg, Math.max(0, m.hp)) / m.max);
    const n8 = Math.floor(c.lost / 0.08) - Math.floor(before / 0.08);
    for (let i = 0; i < n8; i++) { const g = inc() * 4; addG(g); c.gold += g; c.coins++; emit('rareKingCoins', c, g); }
    const n25 = Math.floor(c.lost / 0.25) - Math.floor(before / 0.25);
    for (let i = 0; i < n25 && G.dropItem; i++) { G.dropItem('gear', G.pickItem(Math.min(G.rarityCap(), 2 + (chance(0.3) ? 1 : 0))), m, { src: 'rare', spread: 0.05 }); c.drops++; }
  });
  G.hook('kill', m => {
    if (!m.gk) return;
    const r = R.rare, c = r && r.cur;
    if (!c || c.m !== m) return;
    r.cur = null;
    c.at = { a: m.a, p: m.p };
    const cap = G.rarityCap();
    if (G.lootShower) G.lootShower(m, 12, Math.min(cap, 3), 0.35, { floorN: 4, spread: 0.12, src: 'rare', rolls: 2 });
    orbs(['ascent', 'ascent', chance(0.5) ? 'grace' : 'ruin'], { m });
    const ch = rainChests(5, 1);
    const g = inc() * 120; addG(g); c.gold += g;
    S_().st.rareKings = (S_().st.rareKings || 0) + 1;
    c.rew = { drops: 12 + c.drops, chests: ch, gold: c.gold };
    emit('rareKingKill', c, c.rew);
  });

  // ================= MYTHIC PETS =================
  if (G.PET_TIERS && !G.PET_TIERS[4]) G.PET_TIERS[4] = { name: 'Mythic', color: '#ff5fd2', rate: 0 };
  const MYTHIC = G.MYTHIC_PETS = [
    { id: 'goldling', tier: 4, mythic: 1, cps: 6, name: 'Golden Buttonling', desc: 'Gold, auto clicks, a little rare luck',
      fx: (p, D) => { D.goldMult *= 1 + 0.2 * p; D.rareLuck = (D.rareLuck || 1) * (1 + Math.min(0.5, 0.05 * p)); } },
    { id: 'voidkit', tier: 4, mythic: 1, cps: 0, name: 'Void Kitten', desc: 'Crit chance, crit power, boss damage',
      fx: (p, D) => { D.crit += 0.012 * p; D.critMult += 0.8 * p; D.bossMult *= 1 + 0.12 * p; } },
    { id: 'clover', tier: 4, mythic: 1, cps: 2, name: 'Clover Sprite', desc: 'Luck, eggs and rare surprises',
      fx: (p, D) => { D.luck += 0.03 * p; D.eggMult *= 1 + 0.12 * p; D.rareLuck = (D.rareLuck || 1) * (1 + Math.min(1, 0.1 * p)); } },
  ];
  if (G.PETS && G.PET_BY_ID) for (const p of MYTHIC) if (!G.PET_BY_ID[p.id]) { G.PETS.push(p); G.PET_BY_ID[p.id] = p; }

  function petInto(pet, golden) {
    const S = S_(), D = G.D;
    let s = S.pets[pet.id];
    const isNew = !s, newGold = golden && (!s || !s.gold);
    if (!s) s = S.pets[pet.id] = { lvl: 1, n: 1, gold: !!golden };
    else { s.n++; s.lvl = Math.min(G.PET_MAX_LEVEL || 25, s.lvl + 1); if (golden) s.gold = true; }
    if (S.active.length < (D.petSlots || 2) && !S.active.includes(pet.id)) S.active.push(pet.id);
    // a mythic takes a seat at once: it pushes out the weakest
    else if (pet.tier === 4 && !S.active.includes(pet.id) && S.active.length) {
      let lo = 0; S.active.forEach((id, i) => { if ((G.PET_BY_ID[id] || { tier: 9 }).tier < (G.PET_BY_ID[S.active[lo]] || { tier: 9 }).tier) lo = i; });
      if ((G.PET_BY_ID[S.active[lo]] || { tier: 9 }).tier < 4) S.active[lo] = pet.id;
    }
    G.dirty(); G.recalc();
    return { pet, golden: !!golden, isNew, newGold, lvl: s.lvl };
  }
  // (3.6: the hatch card waits until the surprise's own card has played and the field is free: it no longer pops up a
  // window over the reveal; see the tick)
  function showPull(res) { const r = RR(); (r.pullQ = r.pullQ || []).push({ res, at: (S_().st.playTime || 0) + 3.5 }); }
  function pumpPull() {
    const r = RR(), q = r.pullQ;
    if (!q || !q.length || R.boss || R.march || blocked() || (S_().st.playTime || 0) < q[0].at) return;
    const { res } = q.shift();
    if (G.director) G.director.mark('card', 3);
    r.pull = true; try { emit('pull', [res]); } finally { r.pull = false; }
  }
  // a hatch of at least minTier, with a chance at a mythic (the merchant's egg, the well)
  function hatch(minTier, mythP, src) {
    if (chance(mythP * luck())) return hatchMythic(src);
    const T = G.PET_TIERS.slice(0, 4);
    let tot = 0; T.forEach((t, i) => { if (i >= minTier) tot += t.rate; });
    let v = rng() * tot, tier = 3;
    for (let i = minTier; i < 4; i++) { v -= T[i].rate; if (v < 0) { tier = i; break; } }
    const pool = G.PETS.filter(p => p.tier === tier);
    const res = petInto(pickOf(pool), chance(G.D.goldenChance || 0.05));
    S_().pulls = (S_().pulls || 0) + 1;
    showPull(res);
    return res;
  }
  function hatchMythic(src) {
    const S = S_();
    const fresh = MYTHIC.filter(p => !S.pets[p.id]);
    const pet = pickOf(fresh.length ? fresh : MYTHIC);
    const res = petInto(pet, chance((G.D.goldenChance || 0.05) * 2));
    res.mythic = true; res.src = src;
    S.st.rarePetAt = Math.round(S.st.playTime || 0);
    record('pet', pet.id);
    emit('rarePet', res);
    emit('rare', 'pet', res);
    showPull(res);
    return res;
  }
  // every hatch in the Hatchery: one in five thousand, a mythic hatches with it
  G.on('pull', res => {
    const r = RR();
    if (r.pull || !Array.isArray(res)) return;
    const S = S_(), n = res.length;
    for (let i = 0; i < n; i++) {
      if (S.st.rarePetAt != null && (S.st.playTime || 0) - S.st.rarePetAt < TUNE.rarePetGap) return;
      if (!chance(TUNE.rarePet)) continue;
      const fresh = MYTHIC.filter(p => !S.pets[p.id]), pet = pickOf(fresh.length ? fresh : MYTHIC);
      const m = petInto(pet, chance((G.D.goldenChance || 0.05) * 2));
      m.mythic = true; m.src = 'hatch';
      S.st.rarePetAt = Math.round(S.st.playTime || 0);
      record('pet', pet.id);
      res.push(m); // into the Hatchery's own card
      emit('rarePet', m);
      emit('rare', 'pet', m);
    }
  });

  // ================= THE BUTTON OF LEGENDS =================
  G.hook('click', () => {
    if (!chance(TUNE.rareLegend) || blocked()) return;
    legend();
  });
  function legend() {
    const S = S_();
    const gold = inc() * 3000;
    addG(gold);
    const q = uniqueAny();
    if (q && G.dropItem) G.dropItem('uq', q, null, { at: { a: 0.5, p: 0.8 }, src: 'rare', wait: 1.2 });
    orbs(['grace', 'grace', 'grace', 'ascent', 'ascent'], { at: { a: 0.5, p: 0.8 }, wait: 1.4 });
    const o = { gold, uq: q };
    record('legend');
    S.st.rareLegendAt = Math.round(S.st.playTime || 0);
    emit('rare', 'legend', o);
    o.pet = hatchMythic('legend');
    o.chests = trove('legend', TUNE.rareTroveN * 2);
    return o;
  }

  // ================= Taps =================
  // tap the surprise on the field (the merchant, the well, the gambler, the star)
  G.rareTap = function () {
    const r = RR(), c = r.cur;
    if (!c) return null;
    if (c.k === 'merchant') return openShop();
    if ((c.k === 'well' || c.k === 'gambler') && !c.open && !c.done) { c.open = true; c.T = Math.max(c.T, c.t + 20); emit('rareOpen', c); return c; }
    if (c.k === 'star' && !c.caught) {
      c.caught = true;
      const k = starWish();
      const got = grantWish(k, 'star', { a: 0.5, p: 0.7 });
      c.wish = k; c.got = got;
      S_().st.rareStars = (S_().st.rareStars || 0) + 1;
      emit('rareStarWish', c, k, got);
      clearCur('caught');
      return got;
    }
    return null;
  };

  // ================= The clock =================
  function tickCur(c, dt) {
    if (c.k === 'merchant') { tickMerchant(c, dt); return; }
    if (c.k === 'king') {
      const m = c.m; c.a = m.a; c.p = m.p; c.t += dt;
      if (!R.mobs.includes(m)) { RR().cur = null; c.at = { a: m.a, p: m.p }; emit('rareKingEscape', c); emit('rareGone', c, 'fled'); }
      return;
    }
    c.t += dt;
    if (c.k === 'star' && c.t >= c.T) { clearCur('missed'); return; }
    if ((c.k === 'well' || c.k === 'gambler') && c.t >= c.T) {
      // a gambler walked away from with a pot on the table still pays it
      if (c.k === 'gambler' && c.open && !c.done && c.flips > 0) G.rareCash();
      clearCur(c.done ? 'done' : 'left');
    }
  }
  G.hook('tick', dt => {
    const r = RR(), S = S_();
    if (r.midas > 0 && (r.midas -= dt) <= 0) { r.midas = 0; G.dirty(); emit('rareMidasEnd'); }
    if (r.cur) {
      // a surprise on the field holds back a boss that would come on its own (one called with the sword still sweeps it away)
      if (R.bossReady && !R.boss) R.bossHold = Math.max(R.bossHold || 0, 0.5);
      // a boss, a Rift or a load sweeps a surprise away (the king and the merchant leave)
      if (r.cur.S !== G.S) { r.cur = null; }
      else if ((R.boss || R.rift) && r.cur.k !== 'merchant') clearCur('boss');
      else if ((R.boss || R.rift) && r.cur.st !== 'shop' && r.cur.st !== 'out') { r.cur.st = 'out'; emit('rareLeave', r.cur, 'boss'); }
      if (r.cur) tickCur(r.cur, dt);
    }
    if (r.land) tickLand(r.land, dt);
    if (r.gild) tickGild(r.gild, dt);
    pumpPull();
    if (S.st.rareLuckT && S.st.rareLuckT < (S.st.playTime || 0)) S.st.rareLuckT = 0;
    if (!blocked() && (S.st.playTime || 0) >= TUNE.rareFrom) clockField(dt);
    if (fieldOk()) rollField();
  });
  G.on('ascend', () => {
    const r = RR();
    if (r.cur) clearCur('run');
    if (r.land) endLand('run');
    r.gild = null; r.midas = 0;
  });

  // ================= For testing (and the UI) =================
  // G.forceRare('merchant' | 'land' [, 'vault'|'candy'|'upside'] | 'pet' | 'trove' | 'horde' | 'well' | 'gambler' | 'star' | 'king' | 'legend')
  G.forceRare = function (kind, sub) {
    const S = S_();
    if (!S.hero || !S.hero.cls) return null;
    const r = RR();
    if (['merchant', 'well', 'gambler', 'star', 'king'].includes(kind)) return spawnField(kind, true);
    if (kind === 'land') {
      if (r.land) endLand('force');
      const land = startLand(sub);
      R.march = { t: TUNE.marchTime || 2.4, T: TUNE.marchTime || 2.4 };
      r.own = true; emit('marchStart', R.march.T, false); r.own = false;
      return land;
    }
    if (kind === 'pet') return hatchMythic('force');
    if (kind === 'trove') return trove('force', sub);
    if (kind === 'horde') {
      if (R.ev && R.ev.k === 'stampede') return gild(R.ev);
      r.forceHorde = true;
      const ev = G.startEvent ? G.startEvent('stampede') : null;
      r.forceHorde = false;
      return ev && r.gild;
    }
    if (kind === 'legend') return legend();
    return null;
  };
  G.rareClear = function () { const r = RR(); if (r.cur) clearCur('debug'); if (r.land) endLand('debug'); r.gild = null; };
})(globalThis.G = globalThis.G || {});
