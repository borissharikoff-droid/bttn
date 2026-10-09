// Shared pieces for headless play: load the game logic into a sandbox and a
// simple shopping brain. Used by tools/playtest.js.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function makeWorld(seed) {
  const clock = { now: 0 };
  const ctx = { console, Math, JSON, Date, performance: { now: () => clock.now * 1000 }, Object, Array, Number, String, Infinity, NaN, isFinite };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['util.js', 'data.js', 'game.js', 'hero.js', 'ach.js', 'journey.js', 'world.js', 'events.js', 'perks2.js', 'casino.js', 'relic.js', 'powers.js', 'overdrive.js', 'champions.js', 'mobs2.js', 'blessings.js', 'spells.js', 'rare.js', 'run.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
  }
  const G = ctx.G;
  if (seed != null) G.useSeed(seed);
  G.S = G.newState();
  G.recalc();
  G.fillQuests();
  // 4.0: bots play Sieges to their end (a fall or a win) and never abandon one: the 3.x Ascend shim (fameGain > 0 means
  // 'abandon now for this much Fame') reads 0 for them. A class pick with no Siege on starts one (hero.js chooseClass).
  G.fameGain = () => 0;
  // 4.0: the persona's own answers at the camp and the doors (G.botPolicy, below): a hold left to the game (no run UI)
  // is resolved through G.beatAuto, so the policy steps in there, before the game's own auto()
  const beatAuto0 = G.beatAuto;
  if (beatAuto0) G.beatAuto = function () { return siegeBeat(G) || beatAuto0.apply(this, arguments); };
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
// 4.0: per-persona Siege policies (DESIGN §13 item 16). G.botPolicy is the persona's (a test or tools/playtest.js sets it:
// G.botPolicy = SIEGE_POLICY[name]; shop() infers one from the click rate when nothing set it; null: the game's own auto()
// for every hold, as the 3.x page with no run UI does):
//   camp: Rest under rest (50%) of the Button's health, else Temper (the game's campAuto then recruits the missing role,
//     buys what helps and enchants); extract: at Camp extract.camp with fewer than extract.pips pips, bank the run (x1);
//   doors: the first door whose reward tag is in tags (active: Elite, then Treasure), else whose map mod is in mods (casual:
//     Calm), else the one with the mildest twist (MOD_RISK); vault: spend a Key on the Vault when holding one;
//   Continue: never (no G.fallAsk: a fall ends the run at once).
const SIEGE_POLICY = {
  active: { name: 'active', rest: 0.5, tags: ['elite', 'treasure'], mods: null, vault: 1, extract: null },
  casual: { name: 'casual', rest: 0.5, tags: null, mods: ['calm'], vault: 0, extract: { camp: 4, pips: 2 } },
  idle: null,
};
SIEGE_POLICY.hardcore = SIEGE_POLICY.active;
SIEGE_POLICY.returner = SIEGE_POLICY.casual;
// how much a map mod hurts a casual party (the door policy's tie-break: the mildest)
const MOD_RISK = { calm: 0, treasure: 1, thick: 2, elite: 3, swift: 4, nomend: 5, armored: 6, hexed: 7 };
function doorPick(G, pol, opts) {
  let i = -1;
  if (pol.tags) for (const t of pol.tags) { i = opts.findIndex(o => o.tag === t && !o.cursed); if (i >= 0) return i; }
  if (pol.mods) { i = opts.findIndex(o => pol.mods.includes(o.mod || 'calm') && !o.cursed); if (i >= 0) return i; }
  const risk = o => (MOD_RISK[o.mod || 'calm'] || 0) * (o.cursed ? 2 : 1);
  i = 0; opts.forEach((o, k) => { if (risk(o) < risk(opts[i])) i = k; });
  return i;
}
// the persona's answer to the hold on screen (G.beatAuto's wrapper): true when it took care of it
function siegeBeat(G) {
  const S = G.S, r = S && S.run, pol = G.botPolicy;
  if (!pol || !r || !r.on || !r.beat || !r.beat.id) return false;
  if (r.beat.id === 'camp' && r.camp) {
    const c = r.camp;
    if (pol.extract && c.n === pol.extract.camp && (r.pips | 0) < pol.extract.pips && G.runExtract) { G.runExtract(); return true; }
    if (!c.act && pol.rest != null) G.campAct(S.hero.hp < (G.D.heroHp || 1) * pol.rest ? 'rest' : 'temper');
    return false; // (the rest of the camp: the game's campAuto)
  }
  if (r.beat.id === 'doors' && r.doors && r.doors.opts.length) {
    const D_ = r.doors;
    return G.runDoor(doorPick(G, pol, D_.opts), !!(pol.vault && D_.vault && (r.keys | 0) > 0));
  }
  return false;
}
// 4.0: the Siege, minimal policy (the bots stream improves it): no run on -> AGAIN (the last setup); a fall -> no Continue,
// the run ends; a post-boss beat on screen (the loot moment, a card, camp, doors...) -> its own auto() (the best loot, the
// best card, the default door), so the field never waits on a bot that checks in once a minute
function siegeAct(G) {
  const S = G.S;
  if (S.fallen) { G.runGiveUp(); return 'fall'; }
  if (!S.run || !S.run.on) { if (G.runAgain && S.hero && S.hero.cls && G.runAgain()) return 'again'; return null; }
  // (a card on screen is the persona's own to pick: tools/playtest.js reads h.offer; idle ones leave it to the timer)
  if (S.run.offer) return null;
  // a shrine's choice: the steadiest boon; a pact declined
  if (S.run.boonOffer && G.boonPick) { const ids = S.run.boonOffer.ids; G.boonPick(['dmg', 'spd', 'crit', 'hp'].find(k => ids.includes(k)) || ids[0]); return 'boon'; }
  if (S.run.pactOffer && G.pactAnswer) { G.pactAnswer(false); return 'pact'; }
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
  // (4.0: no Constellation, town or Hall of Fame buys: those are the meta, the 'no meta' baseline of DESIGN §9.1; and no
  // run blessing: the cards are retired, their effects become Button rules and Power-shrine boons)
  if (G.S.eggs >= 1) G.pull(G.S.eggs >= 9 ? 10 : 1);
  G.S.quests.forEach((q, i) => { if (q.done) G.claimQuest(i); });
  if (G.dailyAvailable()) G.claimDaily();
}
// the Hall of Fame (G.LEGACY, 4.0: capped ranks for Fame), cheapest first: only when a test asks (the personas play
// with no meta; the bots stream adds the meta tiers)
function buyLegacy(G) {
  for (let guard = 0; guard < 200; guard++) {
    const l = G.LEGACY.filter(x => (G.S.legacy[x.id] || 0) < x.max).sort((a, b) => G.legacyCost(a) - G.legacyCost(b))[0];
    if (!l || !G.buyLegacy(l.id)) break;
  }
}
// (4.0: Plunder is in: rares, champions and Hoarders drop a chest)
const PERK_PRIORITY = ['might', 'frenzy', 'momentum', 'nova', 'blades', 'corpse', 'multi', 'overkill', 'aura', 'glass', 'chain', 'burn', 'execute', 'laststand', 'cleave', 'crush', 'thunder', 'mark', 'ricochet', 'bulwark', 'aegis', 'thorns', 'secondwind', 'warband', 'frost', 'souls', 'greed', 'avarice', 'reach', 'fortress', 'leech', 'loot', 'plunder'];

module.exports = { makeWorld, metric, tryBuy, shop, siegeAct, siegeBeat, doorPick, buyLegacy, PERK_PRIORITY, SIEGE_POLICY };
