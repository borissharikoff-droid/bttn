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
  for (const f of ['util.js', 'data.js', 'game.js', 'hero.js', 'ach.js', 'journey.js', 'world.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
  }
  const G = ctx.G;
  if (seed != null) G.useSeed(seed);
  G.S = G.newState();
  G.recalc();
  G.fillQuests();
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
    if (u.max && L >= u.max) continue;
    const cost = G.upgCost(u);
    if (['hall', 'golem', 'clover', 'rhythm'].includes(u.id)) {
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
function shop(G, cps) {
  // take on companions as slots open: a healer, a tank and damage, skipping what the Warden already is
  if (G.recruit && G.S.party && G.S.party.length < G.partySlots()) {
    const have = [G.S.hero.cls].concat(G.S.party.map(m => m.cls));
    const want = ['cleric', 'knight', 'archer', 'wizard', 'rogue'].find(c => !have.includes(c));
    if (want) G.recruit(want);
  }
  let k = 0;
  while (tryBuy(G, cps) && k++ < 40);
  // enchant worn gear, cheapest first
  for (let i = 0; i < 10; i++) {
    const worn = G.SLOTS.map(s => G.S.hero.eq[s]).filter(g => g && g.e < G.ENCHANT_MAX).sort((a, b) => G.enchantCost(a).shards - G.enchantCost(b).shards);
    if (!worn.length || !G.enchant(worn[0])) break;
  }
  // constellation, cheapest available first
  for (let guard = 0; guard < 60; guard++) {
    const n = G.NODES.filter(x => (G.S.nodes[x.id] || 0) < x.max && G.nodeAvailable(x)).sort((a, b) => G.nodeCost(a) - G.nodeCost(b))[0];
    if (!n || !G.buyNode(n.id)) break;
  }
  if (G.S.eggs >= 1) G.pull(G.S.eggs >= 9 ? 10 : 1);
  G.S.quests.forEach((q, i) => { if (q.done) G.claimQuest(i); });
  if (G.dailyAvailable()) G.claimDaily();
}
function buyLegacy(G) {
  for (let guard = 0; guard < 200; guard++) {
    const l = G.LEGACY.filter(x => (G.S.legacy[x.id] || 0) < x.max).sort((a, b) => G.legacyCost(a) - G.legacyCost(b))[0];
    if (!l || !G.buyLegacy(l.id)) break;
  }
}
const PERK_PRIORITY = ['might', 'frenzy', 'nova', 'blades', 'multi', 'aura', 'chain', 'cleave', 'thunder', 'bulwark', 'greed', 'reach', 'leech', 'loot'];

module.exports = { makeWorld, metric, tryBuy, shop, buyLegacy, PERK_PRIORITY };
