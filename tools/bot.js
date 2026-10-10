// Shared pieces for headless play: load the game logic into a sandbox, a simple shopping brain, and (4.0) the Siege
// personas' policies: what a kind of player does at the setup, with a card, at the loot moment, a shrine, the camp, the
// doors, a relic, a pact. Used by tools/playtest.js (the personas' loop), tools/siege.js (the measurement CLI) and the
// streams' balance harnesses (tests/*/bal/cell.js wrap makeWorld and tools/playtest.js run()).
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// the logic modules, in the page's order (DOM-free: no ui/stage/fx/audio)
const FILES = ['util.js', 'data.js', 'game.js', 'hero.js', 'ach.js', 'journey.js', 'world.js', 'events.js', 'perks2.js', 'casino.js', 'relic.js', 'powers.js', 'overdrive.js', 'champions.js', 'mobs2.js', 'blessings.js', 'spells.js', 'rare.js', 'run.js'];

function makeWorld(seed) {
  const clock = { now: 0 };
  const ctx = { console, Math, JSON, Date, performance: { now: () => clock.now * 1000 }, Object, Array, Number, String, Infinity, NaN, isFinite };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
  const G = ctx.G;
  if (seed != null) G.useSeed(seed);
  G.S = G.newState();
  G.recalc();
  G.fillQuests();
  // 4.0: bots play Sieges to their end (a fall or a win) and never abandon one: the 3.x Ascend shim (fameGain > 0 means
  // 'abandon now for this much Fame') reads 0 for them. A class pick with no Siege on starts one (hero.js chooseClass).
  G.fameGain = () => 0;
  // 4.0: what the persona decided (choices) against what the game did for it (autos): tools/playtest.js's two counts
  // (DESIGN §14: real choices a minute >= 3, automatic actions a minute < 30)
  G.botStats = { choices: 0, autos: 0 };
  // 4.0: the persona's own answers at the camp and the doors (G.botPolicy, below): a hold left to the game (no run UI)
  // is resolved through G.beatAuto, so the policy steps in there, before the game's own auto(); a hold the game resolves
  // itself (a persona too slow for it, the idle one) counts as an automatic action
  const beatAuto0 = G.beatAuto;
  if (beatAuto0) G.beatAuto = function () { if (siegeBeat(G)) return true; G.botStats.autos++; return beatAuto0.apply(this, arguments); };
  // the game's own picks and pickups are automatic actions too (the persona's hand-picked ones go through G.botStats.choices)
  G.on('cardPick', (id, rank, tier, how) => { if (how === 'auto') G.botStats.autos++; });
  G.on('pickup', (e, how) => { if (how !== 'hand') G.botStats.autos++; });
  G.on('gear', (g, eq) => { if (eq) G.botStats.autos++; });
  G.on('lootCollapse', () => { G.botStats.autos++; });
  return { G, clock };
}

// Rough income estimate used to rank purchases by payback
function metric(G, cps) {
  const D = G.D;
  const clickRate = cps * 0.7;
  const critEV = 1 + D.crit * (D.critMult - 1);
  const combo = 1 + Math.min(D.comboCap, 40) * D.comboPer;
  const clicksGold = D.click * clickRate * critEV * combo + D.click * (D.autoCps + D.petCps) * critEV;
  const chestRate = (clickRate * D.chestProg + (D.autoCps + D.petCps) * D.chestProg * 0.1) / D.chestNeed + D.scout;
  return D.gps + clicksGold + chestRate * D.incomeRef * 2.5 * D.itemMult;
}

function tryBuy(G, cps) {
  const S = G.S;
  const base = metric(G, cps);
  let best = null;
  const consider = (kind, id, cost, apply, undo) => {
    if (cost > S.gold) return;
    apply(); G.recalc();
    const gain = metric(G, cps) - base;
    undo(); G.recalc();
    const score = gain / cost;
    if (!best || score > best.score) best = { kind, id, score };
  };
  for (const u of G.UPGRADES) {
    const L = S.upg[u.id] || 0;
    // (4.0: Treasure Sense, Treasure Hall, Looter and Loot Crew are off the run shop)
    if (u.off || (u.max && L >= u.max)) continue;
    const cost = G.upgCost(u);
    if (['clover', 'rhythm'].includes(u.id)) {
      if (cost < S.gold * 0.3 && cost < base * 60) { G.buyUpgrade(u.id); return true; }
      continue;
    }
    consider('upg', u.id, cost, () => { S.upg[u.id] = L + 1; }, () => { if (L) S.upg[u.id] = L; else delete S.upg[u.id]; });
  }
  for (const h of G.HEROES) {
    const n = S.heroes[h.id] || 0;
    consider('hero', h.id, G.heroCost(h, 1), () => { S.heroes[h.id] = n + 1; }, () => { if (n) S.heroes[h.id] = n; else delete S.heroes[h.id]; });
  }
  if (!best) return false;
  if (best.kind === 'upg') G.buyUpgrade(best.id); else G.buyHero(best.id, 1);
  return true;
}

// ---------- 4.0: the Siege personas' policies (DESIGN §13 item 16) ----------
// G.botPolicy is the persona's (tools/playtest.js sets it from SIEGE_POLICY[name]; a test may set its own; shop() infers
// one from the click rate when nothing set it; null: the game's own auto() for every hold, as the 3.x page with no run UI
// does - the idle persona). A policy:
//   setup: { btn: [Button ids by preference; the first open one], heat: 'max' (heatWon + 1: the hardcore climbs) | n | null
//     (the last setup's, else 0), keeps: how many keepsakes (relics first, then the highest Codex rank), cls: a class id or
//     null (the seed's rotation among the open classes) }
//   card: 'school' (concentrate: an evolution first, then a card of a school the build owns toward the evolution whose item
//     is worn, PERK_PRIORITY among equals, a rarer card first) | 'first' (the first card, an evolution apart) | 'auto'
//   loot: 'best' (the biggest ▲, a unique ▲ before it; nothing ▲: stash a legendary+/unique, else burn) | 'glance' (the
//     biggest ▲ lootSee of the time, else the first card as it comes) | 'auto'
//   shrine: the chance a shrine is charged (the Hand held on it for 2 s, the Button let go meanwhile)
//   boon: 'build' | 'steady' (BOON_PREF; 'build' takes health when the Button is under half)
//   pact: 'bold' (Blood / Greed / Hunt with 2+ pips and the Button over 60%; never Glass) | 'no'
//   relic: 'school' (a rule of a school the build owns, then a true relic, then the first) | 'first'
//   camp: Rest under rest of the Button's health, else Temper; recruits the missing role (healer, tank, damage);
//     market 'all' (every ware that helps, as the game's campAuto) | 'one' (the first by MARKET_PREF) | 'none'
//   doors: the first door whose reward tag is in tags (active: Elite, then Treasure), else whose map mod is in mods
//     (casual: Calm), else the mildest twist (MOD_RISK); vault: spend a Key on the Vault when holding one
//   extract: { camp, pips }: at Camp extract.camp with fewer than extract.pips pips, bank the run (x1); null: never
//   delay: s before the persona answers each hold (card, loot, boon, pact, camp, doors, relic); holdAuto: s after which the
//     game answers an unanswered hold for them (TUNE.beatAutoNoUI; a card after TUNE.cardAuto 10 s anyway)
//   Continue: never (no G.fallAsk: a fall ends the run at once).
const SIEGE_POLICY = {
  active: { name: 'active', rest: 0.5, tags: ['elite', 'treasure'], mods: null, vault: 1, extract: null, market: 'all',
    card: 'school', loot: 'best', shrine: 1, boon: 'build', pact: 'bold', relic: 'school',
    setup: { btn: ['glass', 'prism', 'storm', 'classic'], heat: null, keeps: 2, cls: null },
    delay: { card: 1, loot: 1.5, boon: 1, pact: 1, camp: 2, doors: 1, relic: 1 }, holdAuto: 10 },
  casual: { name: 'casual', rest: 0.5, tags: null, mods: ['calm'], vault: 0, extract: { camp: 4, pips: 2 }, market: 'one',
    card: 'first', loot: 'glance', lootSee: 0.5, shrine: 0.3, boon: 'steady', pact: 'no', relic: 'first',
    setup: { btn: ['iron', 'classic'], heat: null, keeps: 1, cls: null },
    delay: { card: 5, loot: 4, boon: 3, pact: 3, camp: 6, doors: 4, relic: 3 }, holdAuto: 14 },
  idle: null,
};
// the attentive casual (DESIGN §9.1: duty 1, events 0.6): the casual's choices, made on time, the ▲ on a loot card seen
SIEGE_POLICY.attentive = Object.assign({}, SIEGE_POLICY.casual, { name: 'attentive', loot: 'best', shrine: 0.6,
  delay: { card: 3, loot: 2.5, boon: 2, pact: 2, camp: 4, doors: 3, relic: 2 }, holdAuto: 12 });
// the hardcore climbs the Heat as wins come
SIEGE_POLICY.hardcore = Object.assign({}, SIEGE_POLICY.active, { name: 'hardcore', setup: Object.assign({}, SIEGE_POLICY.active.setup, { heat: 'max' }) });
SIEGE_POLICY.returner = SIEGE_POLICY.casual;
// the idle Clockwork (the game's own auto for every hold; the setup takes the Clockwork Button when it is open)
SIEGE_POLICY.clockwork = { name: 'clockwork', setup: { btn: ['clockwork', 'classic'], heat: null, keeps: 0, cls: null }, auto: 1 };
// a casual shopper's first pick at the market
const MARKET_PREF = ['pip', 'mend', 'item', 'potion'];
// the game's own market order (every ware that helps)
const MARKET_ALL = ['pip', 'mend', 'item', 'reroll', 'potion', 'orbs', 'key'];
// how much a map mod hurts a casual party (the door policy's tie-break: the mildest)
const MOD_RISK = { calm: 0, treasure: 1, thick: 2, elite: 3, swift: 4, nomend: 5, armored: 6, hexed: 7 };
// the steadiest boons first (a Power shrine's 1 of 3, a complete build's boon cards)
const BOON_PREF = ['dmg', 'spd', 'crit', 'hp', 'boss', 'reroll', 'xp', 'gold', 'luck', 'od', 'orbs'];
// (4.0: Plunder is in: rares, champions and Hoarders drop a chest)
const PERK_PRIORITY = ['might', 'frenzy', 'momentum', 'nova', 'blades', 'corpse', 'multi', 'overkill', 'aura', 'glass', 'chain', 'burn', 'execute', 'laststand', 'cleave', 'crush', 'thunder', 'mark', 'ricochet', 'bulwark', 'aegis', 'thorns', 'secondwind', 'warband', 'frost', 'souls', 'greed', 'avarice', 'reach', 'fortress', 'leech', 'loot', 'plunder'];
const CLASS_ROTATION = ['knight', 'archer', 'wizard', 'rogue', 'cleric'];
const choice = G => { if (G.botStats) G.botStats.choices++; };

function doorPick(G, pol, opts) {
  let i = -1;
  if (pol.tags) for (const t of pol.tags) { i = opts.findIndex(o => o.tag === t && !o.cursed); if (i >= 0) return i; }
  if (pol.mods) { i = opts.findIndex(o => pol.mods.includes(o.mod || 'calm') && !o.cursed); if (i >= 0) return i; }
  const risk = o => (MOD_RISK[o.mod || 'calm'] || 0) * (o.cursed ? 2 : 1) + (o.cursed ? 10 : 0);
  i = 0; opts.forEach((o, k) => { if (risk(o) < risk(opts[i])) i = k; });
  return i;
}
// the Run Setup (DESIGN §2.1) as the persona fills it: Button, class, Heat, keepsakes, first door. opts: { heat, cls, btn,
// keeps (false: none) } from the caller (a test's or a measurement cell's fixed choices) win over the policy
function botSetup(G, pol, seed, opts) {
  const S = G.S, P = (pol && pol.setup) || {}, o = opts || {}, last = S.lastSetup || {};
  const so = G.setupOptions ? G.setupOptions() : null;
  const open = (so && so.buttons) || ['classic'], classes = (so && so.classes) || ['knight', 'archer', 'wizard'];
  // the Button: the first open one of the preference list (a locked one would play as the Classic anyway)
  let btn = o.btn || (P.btn || ['classic']).find(b => open.includes(b)) || 'classic';
  // the class: the seed's rotation among the open ones (the 3.x bots' knight/archer/wizard/rogue by seed % 4)
  let cls = o.cls || P.cls;
  if (!cls || !classes.includes(cls)) { const rot = CLASS_ROTATION.filter(c => classes.includes(c)); cls = rot.length ? rot[(seed | 0) % rot.length] : classes[0]; }
  // the Heat: fixed by the caller, 'max' for the climber, else the last setup's
  let heat = o.heat != null ? o.heat : P.heat === 'max' ? (G.tormentMax ? G.tormentMax() : 0) : P.heat != null ? P.heat : last.heat | 0;
  heat = Math.max(0, Math.min(G.tormentMax ? G.tormentMax() : 0, heat | 0));
  // keepsakes: relics first (a rule on the belt from the start), then the highest Codex rank
  let keeps = [];
  const nk = o.keeps === false ? 0 : Math.min(P.keeps | 0, (so && so.keepSlots) | 0);
  if (nk > 0 && so && so.keepsakes) keeps = so.keepsakes.slice().sort((a, b) => (b.relic - a.relic) || (b.rank - a.rank)).slice(0, nk).map(k => k.q);
  // the first land: the door the door policy would take (the setup previews the next run's own doors)
  const doors = (so && so.firstDoors) || [];
  const door = doors.length && pol && (pol.tags || pol.mods) ? doorPick(G, pol, doors) : 0;
  return { btn, cls, heat, keeps, door };
}
// the owned schools: the perks picked this run, plus the class's own
function schoolsOf(G) {
  const S = G.S, set = new Set();
  for (const k of G.cardSlotsUsed ? G.cardSlotsUsed() : []) if (G.PERK_SCHOOL && G.PERK_SCHOOL[k]) set.add(G.PERK_SCHOOL[k]);
  return set;
}
// the card to pick (its index) under the policy; -1: leave it to the game
function cardChoice(G, pol) {
  const v = G.cardView ? G.cardView() : null;
  if (!v || !v.cards.length) return -1;
  const mode = pol ? pol.card : 'auto';
  if (mode === 'auto') return -1;
  const ev = v.cards.findIndex(c => c.evo);
  if (ev >= 0) return ev;
  if (mode === 'first') return 0;
  const own = schoolsOf(G), used = v.slots ? v.slots.used : 0;
  // (measured, g1: a class-school pull (wizard -> fire/storm, knight -> bastion) lost every no-meta Heat-0 run for those
  // classes while the blades builds (might, frenzy, blades: the top of PERK_PRIORITY) won; so the strongest perks lead, the
  // build's own school and the ranks already held concentrate the rest, and the class's schools don't count)
  const score = c => {
    if (c.boon) { const i = BOON_PREF.indexOf(String(c.id).slice(5)); return 10 - (i < 0 ? 9 : i); }
    const pr = PERK_PRIORITY.indexOf(c.id);
    let s = 2 * (40 - (pr < 0 ? 35 : pr));
    if (c.school && own.has(c.school)) s += 8;
    if (c.own > 0) s += 12;                               // concentrate the ranks: six slots
    if (c.evoWith && c.evoWith.have) s += 20;             // toward the evolution whose item is worn
    if (c.evoWith && c.evoWith.have && c.toEff >= c.max) s += 12;
    s += 5 * (c.tier | 0);                               // Empowered / Golden
    if (c.isNew && used >= 4 && !(c.school && own.has(c.school))) s -= 20; // the last slots go to the build's schools
    if (c.id === 'glass' && G.S.hero && G.D.heroHp && G.S.hero.hp < G.D.heroHp * 0.5) s -= 30;
    return s;
  };
  let best = 0;
  v.cards.forEach((c, i) => { if (score(c) > score(v.cards[best])) best = i; });
  return best;
}
// the loot moment: { i, who } to take, 'burn' when nothing is worth it, null with no moment open
function lootChoice(G, pol, rnd) {
  const st = G.lootState ? G.lootState() : null;
  if (!st || !st.cards) return null;
  const open = st.cards.filter(c => !c.taken && !c.burned);
  if (!open.length || st.left <= 0) return 'burn';
  const mode = pol ? pol.loot : 'auto';
  const ups = open.filter(c => c.up).sort((a, b) => b.pct - a.pct);
  // (a glance: the ▲ seen lootSee of the time; otherwise the first card as it comes, worn if it fits, else stashed)
  if (mode === 'glance' && (rnd ? rnd() : Math.random()) >= (pol.lootSee == null ? 0.5 : pol.lootSee)) {
    const c = open[0];
    return { i: c.i, who: c.up ? c.who : 'bag' };
  }
  if (ups.length) { const uq = ups.find(c => c.unique); const c = uq && uq.pct >= ups[0].pct * 0.6 ? uq : ups[0]; return { i: c.i, who: c.who }; }
  // nothing ▲: a legendary or better (or a unique) into the bag, the most valuable first; else burn
  const keep = open.filter(c => c.unique || c.r >= 4).sort((a, b) => b.v - a.v)[0];
  return keep ? { i: keep.i, who: 'bag' } : 'burn';
}
function boonChoice(G, pol) {
  const r = G.S.run, o = r && r.boonOffer;
  if (!o) return null;
  const ids = o.ids;
  if (pol && pol.boon === 'build' && G.S.hero && G.D.heroHp && G.S.hero.hp < G.D.heroHp * 0.5 && ids.includes('hp')) return 'hp';
  return BOON_PREF.find(k => ids.includes(k)) || ids[0];
}
function pactChoice(G, pol) {
  const r = G.S.run, o = r && r.pactOffer;
  if (!o) return null;
  if (!pol || pol.pact !== 'bold') return false;
  const hpOk = G.S.hero && G.D.heroHp && G.S.hero.hp >= G.D.heroHp * 0.6, pips = (r.pips | 0) >= 2;
  return o.id !== 'glass' && hpOk && pips;
}
function relicChoice(G, pol) {
  const r = G.S.run, o = r && r.relicOffer;
  if (!o || !o.ids.length) return -1;
  if (!pol || pol.relic !== 'school') return 0;
  const own = schoolsOf(G);
  let i = o.ids.findIndex(id => G.UQ_THEME && G.UQ_THEME[id] && own.has(G.PERK_SCHOOL[G.UQ_THEME[id]]));
  if (i < 0) i = o.ids.findIndex(id => G.RELICS && G.RELICS[id]);
  return i < 0 ? 0 : i;
}
// the camp under the policy (one action, the recruit, the market, Enchant All, the Train card, on to the doors)
function campDo(G, pol) {
  const S = G.S, r = S.run, c = r && r.camp;
  if (!c) return false;
  if (pol.extract && c.n === pol.extract.camp && (r.pips | 0) < pol.extract.pips && G.runExtract) { choice(G); G.runExtract(); return true; }
  if (!c.act && pol.rest != null) { G.campAct(S.hero.hp < (G.D.heroHp || 1) * pol.rest ? 'rest' : 'temper'); choice(G); }
  if (c.recruits && !c.hired) {
    const roles = [S.hero.cls].concat(S.party.map(m => m.cls)).map(k => G.ROLES[k]);
    const want = !roles.includes('heal') ? 'heal' : !roles.includes('tank') ? 'tank' : 'dps';
    const i = c.recruits.findIndex(x => G.ROLES[x.cls] === want);
    if (G.campRecruit(i < 0 ? 0 : i)) choice(G);
  }
  let bought = 0;
  const buy = (w, i) => { if (!w.sold && (w.k !== 'item' || G.bestWearer(w.g).up) && G.campBuy(i)) bought++; };
  if (pol.market === 'one') { for (const k of MARKET_PREF) { if (bought) break; c.wares.forEach((w, i) => { if (!bought && w.k === k) buy(w, i); }); } }
  else if (pol.market !== 'none') for (const k of MARKET_ALL) c.wares.forEach((w, i) => { if (w.k === k) buy(w, i); });
  if (bought) choice(G);
  if (G.D.enchantAll && G.enchantAll) G.enchantAll();
  // (a Train card on screen over the camp: the persona's own card policy)
  let g = 0;
  while (r.offer && g++ < 5) { const i = cardChoice(G, pol); if (i >= 0) { G.cardPick(i); choice(G); } else G.cardAuto(); }
  G.campDone();
  return true;
}
// the persona's answer to the hold on screen (G.beatAuto's wrapper: the game asks it before its own auto); true when it
// took care of it
function siegeBeat(G) {
  const S = G.S, r = S && S.run, pol = G.botPolicy;
  if (!pol || pol.auto || !r || !r.on || !r.beat || !r.beat.id) return false;
  if (r.beat.id === 'camp' && r.camp) return campDo(G, pol);
  if (r.beat.id === 'doors' && r.doors && r.doors.opts.length) {
    const D_ = r.doors;
    choice(G);
    return G.runDoor(doorPick(G, pol, D_.opts), !!(pol.vault && D_.vault && (r.keys | 0) > 0));
  }
  if (r.beat.id === 'relic' && r.relicOffer) { const i = relicChoice(G, pol); choice(G); return G.relicPick(i, r.belt.length >= r.beltMax ? 0 : undefined) || G.relicSkip(); }
  if (r.beat.id === 'loot' && G.lootNow && G.lootNow()) return lootDo(G, pol);
  return false;
}
// the loot moment under the policy: the picks (one, two at the Mad Button), then the burn
function lootDo(G, pol, rnd) {
  const L0 = G.lootNow();
  let g = 0;
  while (G.lootNow() === L0 && g++ < 6) {
    const c = lootChoice(G, pol, rnd);
    if (!c) return false;
    if (c === 'burn') { G.lootAuto(); break; }
    if (!G.lootTake(c.i, c.who)) { G.lootAuto(); break; }
    choice(G);
  }
  return true;
}
// what is open for the persona to answer: 'card' | 'boon' | 'pact' | 'loot' | 'camp' | 'doors' | 'relic' | 'push' | null,
// and the object behind it (a new one restarts the persona's delay)
function holdOpen(G) {
  const r = G.S.run;
  if (!r || !r.on) return null;
  if (r.offer) return { kind: 'card', ref: r.offer };
  if (r.boonOffer) return { kind: 'boon', ref: r.boonOffer };
  if (r.pactOffer) return { kind: 'pact', ref: r.pactOffer };
  const L = G.lootNow && G.lootNow();
  if (r.phase === 'loot' && L) return { kind: 'loot', ref: L };
  if (r.phase === 'camp' && r.camp) return { kind: 'camp', ref: r.camp };
  if (r.phase === 'doors' && r.doors) return { kind: 'doors', ref: r.doors };
  if (r.phase === 'relic' && r.relicOffer) return { kind: 'relic', ref: r.relicOffer };
  if (r.pushAsk) return { kind: 'push', ref: r.pushAsk };
  return null;
}
// the persona's turn at a hold: st keeps its clock ({kind, ref, t}); after the policy's delay it answers. Returns the
// kind answered, 'wait' while the delay runs, null with nothing open. rnd: the persona's own random stream.
function botHold(G, pol, dt, st, rnd) {
  const h = holdOpen(G);
  if (!h) { st.kind = null; st.ref = null; st.t = 0; return null; }
  if (st.ref !== h.ref) { st.kind = h.kind; st.ref = h.ref; st.t = 0; }
  st.t += dt;
  if (!pol || pol.auto) return 'wait';
  const delay = (pol.delay && pol.delay[h.kind]) || 0;
  if (st.t < delay) return 'wait';
  const r = G.S.run;
  let ok = false;
  switch (h.kind) {
    case 'card': { const i = cardChoice(G, pol); if (i < 0) return 'wait'; ok = G.cardPick(i); break; }
    case 'boon': ok = G.boonPick(boonChoice(G, pol)); break;
    case 'pact': ok = G.pactAnswer(pactChoice(G, pol)); break;
    case 'loot': ok = lootDo(G, pol, rnd); break;
    case 'camp': ok = campDo(G, pol); break;
    case 'doors': ok = G.runDoor(doorPick(G, pol, r.doors.opts), !!(pol.vault && r.doors.vault && (r.keys | 0) > 0)); break;
    case 'relic': ok = G.relicPick(relicChoice(G, pol), r.belt.length >= r.beltMax ? 0 : undefined) || G.relicSkip(); break;
    case 'push': ok = !!G.runReturn(); break; // (never Push On in a measurement: the win is the end)
  }
  if (ok && h.kind !== 'push' && h.kind !== 'loot' && h.kind !== 'camp') choice(G);
  st.kind = null; st.ref = null; st.t = 0;
  return h.kind;
}
// 4.0: the Siege, the minimal policy for a bot without the personas' loop (a test calling shop() alone): no run on -> AGAIN
// (the last setup); a fall -> no Continue, the run ends; a hold on screen -> the policy (siegeBeat) or the game's own auto
function siegeAct(G) {
  const S = G.S;
  if (S.fallen) { G.runGiveUp(); return 'fall'; }
  if (!S.run || !S.run.on) { if (G.runAgain && S.hero && S.hero.cls && G.runAgain()) return 'again'; return null; }
  // (the personas' loop (tools/playtest.js) answers every hold with its own delays: nothing to do here then)
  if (G.botLoop) return null;
  if (S.run.offer) return null;
  if (S.run.boonOffer && G.boonPick) { G.boonPick(boonChoice(G, G.botPolicy)); return 'boon'; }
  if (S.run.pactOffer && G.pactAnswer) { G.pactAnswer(pactChoice(G, G.botPolicy)); return 'pact'; }
  if (S.run.phase !== 'field' && G.beatAuto && G.beatAuto()) return 'beat';
  return null;
}
function shop(G, cps) {
  // (a persona's Siege policy, when nothing set one: by its click rate)
  if (G.botPolicy === undefined) G.botPolicy = cps >= 9 ? SIEGE_POLICY.active : cps > 0 ? SIEGE_POLICY.casual : SIEGE_POLICY.idle;
  siegeAct(G);
  const siege = !!(G.S.run && G.S.run.on);
  // take on companions as slots open: a healer, a tank and damage, skipping what the Warden already is
  // (4.0: inside a Siege the camp's candidates are how they join: its auto takes the role the party lacks)
  if (!siege && G.recruit && G.S.party && G.S.party.length < G.partySlots()) {
    const have = [G.S.hero.cls].concat(G.S.party.map(m => m.cls));
    const want = ['cleric', 'knight', 'archer', 'wizard', 'rogue'].find(c => !have.includes(c));
    if (want) G.recruit(want);
  }
  let k = 0;
  while (tryBuy(G, cps) && k++ < 40);
  // enchant worn gear, cheapest first (4.0: the whole party at once with the Forge's Enchant All)
  if (siege && G.D.enchantAll && G.enchantAll) G.enchantAll();
  else for (let i = 0; i < 10; i++) {
    const worn = G.SLOTS.map(s => G.S.hero.eq[s]).filter(g => g && g.e < G.ENCHANT_MAX).sort((a, b) => G.enchantCost(a).shards - G.enchantCost(b).shards);
    if (!worn.length || !G.enchant(worn[0])) break;
  }
  // (4.0: no Constellation, town or Hall of Fame buys here: those are the meta, bought between runs by the personas' loop
  // when a measurement asks (buyMeta); and no run blessing: the cards are retired, their effects are Button rules and
  // Power-shrine boons)
  if (G.S.eggs >= 1) G.pull(G.S.eggs >= 9 ? 10 : 1);
  G.S.quests.forEach((q, i) => { if (q.done) G.claimQuest(i); });
  if (G.dailyAvailable()) G.claimDaily();
}
// the Hall of Fame (G.HALL, 4.0: capped ranks for Fame), cheapest first: only when a measurement asks (the gate cells play
// with a fixed meta tier)
function buyLegacy(G) {
  const H = G.HALL || G.LEGACY;
  let n = 0;
  for (let guard = 0; guard < 200; guard++) {
    const l = H.filter(x => (G.S.legacy[x.id] || 0) < x.max).sort((a, b) => G.legacyCost(a) - G.legacyCost(b))[0];
    if (!l || !(G.buyHall || G.buyLegacy)(l.id)) break;
    n++;
  }
  return n;
}
// 4.0 meta helpers (the meta stream's): what a player buys between Sieges. Fame -> the Hall's cheapest rank; Embers -> the
// cheapest of the next Town level and the next visible Star Chart node (o.town / o.stars false: skip that sink). Returns
// what it bought {hall, town, stars}
function buyMeta(G, o) {
  o = o || {};
  const S = G.S, out = { hall: o.hall === false ? 0 : buyLegacy(G), town: 0, stars: 0 };
  for (let guard = 0; guard < 400; guard++) {
    const t = o.town === false ? null : (G.BLD || []).filter(b => G.bldLvl(b.id) < G.BLD_MAX && (!G.bldOpen || G.bldOpen(b.id))).map(b => ({ k: 'town', id: b.id, c: G.bldCost(b.id) })).sort((a, b) => a.c - b.c)[0];
    const n = o.stars === false ? null : (G.NODES || []).filter(nd => (S.nodes[nd.id] || 0) < nd.max && G.nodeAvailable(nd) && G.nodeVisible(nd)).map(nd => ({ k: 'stars', id: nd.id, c: G.nodeCost(nd) })).sort((a, b) => a.c - b.c)[0];
    const best = [t, n].filter(Boolean).sort((a, b) => a.c - b.c)[0];
    if (!best || (S.embers || 0) < best.c) break;
    if (best.k === 'town' ? G.buildUp(best.id) : G.buyNode(best.id)) out[best.k]++; else break;
  }
  return out;
}
// a share k (0..1) of the full meta set at once (the PT_META cells): every Hall rank, Town level and Star Chart node at
// round(max x k); o.pets / o.unlock also fill the pets (golden, level 25) and open every lockable thing (the Deeds' unlocks)
function metaFill(G, k, o) {
  o = o || {};
  const S = G.S;
  for (const l of G.HALL || G.LEGACY) S.legacy[l.id] = Math.round(l.max * k);
  for (const b of G.BLD) S.bld[b.id] = Math.round(G.BLD_MAX * k);
  for (const n of G.NODES) S.nodes[n.id] = Math.round(n.max * k);
  if (o.pets) { for (const p of G.PETS) S.pets[p.id] = { lvl: 25, n: 99, gold: true }; S.active = G.PETS.map(p => p.id); }
  if (o.unlock && G.UNLOCK_LOCKED) for (const kind in G.UNLOCK_LOCKED) for (const id of G.UNLOCK_LOCKED[kind]) G.unlockAdd(kind + ':' + id);
  G.dirty(); G.recalc();
  return G.metaPower ? G.metaPower() : null;
}
// the measurement cells' meta tiers (DESIGN §14): 'none' (a fresh save), 'third' (Hall / Town / Star Chart at a third, a
// Codex with the Crab King's Pincer for a keepsake, the Deeds as earned) and 'full' (everything maxed, every unlock open, a
// Codex with the start pool's uniques at rank 2 and the three starting relics for keepsakes). A number is a share.
const META_TIERS = { none: 0, third: 0.33, full: 1 };
function metaMode(G, mode) {
  const k = typeof mode === 'number' ? mode : META_TIERS[mode] || 0;
  if (!(k > 0)) return 0;
  const full = k >= 1;
  metaFill(G, k, { unlock: full });
  if (G.codexAdd) {
    if (full) {
      for (const q of ['pincer', 'goldgrin', 'windripper', 'cleaver', 'sporeheart', 'stormcaller', 'nightfang', 'headhunter']) if (G.UNIQUES[q]) G.codexAdd(q, 2, false);
      for (const q of ['unbroken', 'hundredkings', 'lastword']) if (G.UNIQUES[q]) G.codexAdd(q, 1, true);
    } else if (G.UNIQUES.pincer) G.codexAdd('pincer', 1, false);
  }
  G.dirty(); G.recalc();
  return k;
}

module.exports = { makeWorld, FILES, metric, tryBuy, shop, siegeAct, siegeBeat, doorPick, botSetup, cardChoice, lootChoice, lootDo, boonChoice, pactChoice, relicChoice, campDo, holdOpen, botHold,
  buyLegacy, buyHall: buyLegacy, buyMeta, metaFill, metaMode, META_TIERS, PERK_PRIORITY, BOON_PREF, SIEGE_POLICY, MOD_RISK };
