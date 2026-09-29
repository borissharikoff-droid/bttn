// Headless balance simulator: a bot plays BTTN and prints a pacing timeline.
// Usage: node tools/sim.js [minutes=180] [cps=6]
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console, Math, JSON, Date, performance: { now: () => simNow * 1000 }, Object, Array, Number, String, Infinity, NaN, isFinite };
let simNow = 0;
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['util.js', 'data.js', 'game.js', 'hero.js', 'ach.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
}
const G = ctx.G;
const MIN = +(process.argv[2] || 180);
const CPS = +(process.argv[3] || 6);
const QUIET = process.argv.includes('-q');
let botSeed = 12345; const botRnd = () => ((botSeed = (botSeed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

if (process.env.SEED) G.useSeed(+process.env.SEED);
G.S = G.newState();
G.recalc();
G.chooseClass(process.env.CLS || 'knight');
G.fillQuests();

const log = [];
const events = {};
function mark(k, t) { if (!(k in events)) events[k] = t; }
G.on('bossWin', (r, b) => { mark('firstBoss', simNow); if (b.lord) mark('lord_d' + b.d, simNow); });
G.on('ascend', g => { log.push(`  >> ASCEND at ${(simNow / 60).toFixed(1)}m: +${g} fame (total ${G.S.fameTotal})`); });
G.on('achievement', a => { if (!QUIET) mark('ach_' + a.id, simNow); });

function metric(D) {
  const clickRate = CPS * 0.7;
  const critEV = 1 + D.crit * (D.critMult - 1);
  const combo = 1 + Math.min(D.comboCap, 40) * D.comboPer;
  const clicksGold = D.click * clickRate * critEV * combo + D.click * (D.autoCps + D.petCps) * critEV;
  const chestRate = (clickRate * D.chestProg + (D.autoCps + D.petCps) * D.chestProg * 0.1) / D.chestNeed + D.scout;
  const avgSecs = 2.5; // rough common-heavy value
  const chestGold = chestRate * D.incomeRef * avgSecs * D.itemMult;
  return D.gps + clicksGold + chestGold;
}

function tryBuy() {
  const S = G.S, D = G.D;
  // Candidate: upgrades & heroes by payback
  const base = metric(D);
  let best = null;
  const consider = (kind, id, cost, apply, undo) => {
    if (cost > S.gold) return;
    apply(); G.recalc();
    const gain = metric(G.D) - base;
    undo(); G.recalc();
    const score = gain / cost;
    if (!best || score > best.score) best = { kind, id, cost, score };
  };
  for (const u of G.UPGRADES) {
    const L = S.upg[u.id] || 0;
    if (u.max && L >= u.max) continue;
    const cost = G.upgCost(u);
    if (['hall', 'golem', 'clover', 'rhythm'].includes(u.id)) {
      if (cost < S.gold * 0.3 && cost < base * 60) { G.buyUpgrade(u.id); return true; }
      continue;
    }
    consider('upg', u.id, cost, () => S.upg[u.id] = L + 1, () => { if (L) S.upg[u.id] = L; else delete S.upg[u.id]; });
  }
  for (const h of G.HEROES) {
    const n = S.heroes[h.id] || 0;
    const cost = G.heroCost(h, 1);
    consider('hero', h.id, cost, () => S.heroes[h.id] = n + 1, () => { if (n) S.heroes[h.id] = n; else delete S.heroes[h.id]; });
  }
  if (best) {
    if (best.kind === 'upg') G.buyUpgrade(best.id); else G.buyHero(best.id, 1);
    return true;
  }
  return false;
}

function enchantAll() { // enchant worn gear, cheapest first
  let k = 0;
  while (k++ < 10) {
    const worn = G.SLOTS.map(s => G.S.hero.eq[s]).filter(g => g && g.e < G.ENCHANT_MAX).sort((a, b) => G.enchantCost(a).shards - G.enchantCost(b).shards);
    if (!worn.length || !G.enchant(worn[0])) break;
  }
}
function buyNodes() {
  let bought = true;
  while (bought) {
    bought = false;
    const avail = G.NODES.filter(n => (G.S.nodes[n.id] || 0) < n.max && G.nodeAvailable(n))
      .sort((a, b) => G.nodeCost(a) - G.nodeCost(b));
    for (const n of avail) { if (G.buyNode(n.id)) { bought = true; break; } }
  }
}
function buyLegacy() {
  let bought = true;
  while (bought) {
    bought = false;
    const avail = G.LEGACY.filter(l => (G.S.legacy[l.id] || 0) < l.max).sort((a, b) => G.legacyCost(a) - G.legacyCost(b));
    for (const l of avail) { if (G.buyLegacy(l.id)) { bought = true; break; } }
  }
}

const dt = 0.2;
let clickAcc = 0, nextLog = 0, bossFails = 0, bossTries = 0;
G.on('bossFail', () => bossFails++);
G.on('bossStart', () => { bossTries++; bossT0 = simNow; });
let bossT0 = 0, bossDur = [];
G.on('bossWin', () => { bossDur.push(simNow - bossT0); });
let lastAscend = 0, lastDepth = 0, lastDepthT = 0;
for (let t = 0; t < MIN * 60; t += dt) {
  simNow = t;
  clickAcc += CPS * dt;
  while (clickAcc >= 1) {
    clickAcc -= 1;
    const S = G.S;
    // 30% of clicks go to chests when there are chests on the field
    if (S.chests.length && botRnd() < 0.3) G.clickChest(S.chests[S.chests.length - 1]);
    else G.manualClick(0, 0);
    if (G.R.wisp && botRnd() < 0.2) G.catchWisp();
  }
  G.tick(dt);
  // level-up perks: an active player picks right away, by a simple priority
  if (G.S.hero.offer && process.env.PERKS !== 'auto') {
    const pr = ['might', 'frenzy', 'nova', 'blades', 'multi', 'aura', 'chain', 'cleave', 'thunder', 'bulwark', 'greed', 'reach', 'leech', 'loot'];
    G.pickPerk(G.S.hero.offer.slice().sort((a, b) => pr.indexOf(a) - pr.indexOf(b))[0]);
  }
  if (G.R.bossReady && !G.R.boss) G.startBoss();
  if (Math.round(t * 5) % 5 === 0) { enchantAll(); let k = 0; while (tryBuy() && k++ < 30); buyNodes(); }
  if (G.S.eggs >= 1) G.pull(G.S.eggs >= 9 ? 10 : 1);

  G.S.quests.forEach((q, i) => { if (q.done) G.claimQuest(i); });
  // Ascend when fame gain would double total fame and at least 20 minutes passed
  const fg = G.fameGain();
  if (G.S.depth > lastDepth) { lastDepth = G.S.depth; lastDepthT = t; }
  if (fg >= 10 && t - lastAscend > 10 * 60 && (fg >= G.S.fameTotal * 0.6 || t - lastDepthT > 6 * 60)) {
    G.ascend(); lastAscend = t; buyLegacy(); G.chooseClass(process.env.CLS || 'knight'); lastDepth = G.S.depth; lastDepthT = t;
  }
  if (t >= nextLog) {
    nextLog += (t < 1800 ? 60 : 600);
    const S = G.S, D = G.D;
    const heroes = G.HEROES.map(h => S.heroes[h.id] || 0).filter(Boolean).join('/');
    if (process.env.DBG) { const w = S.hero.eq.weapon, c = D.hero; log.push(`   DBG d${S.depth} lv${S.hero.lvl} w ${w ? w.id + ' r' + w.r + ' il' + w.il + ' +' + w.e : '-'} main ${w ? G.fmt(G.mainStat(w)) : '-'} heroMult ${G.fmt(D.heroMult)} fame ${S.fameTotal} hit ${G.fmt(D.heroHit)} rate ${D.heroRate.toFixed(2)} crit ${c.crit.toFixed(2)}x${c.critMult.toFixed(1)} dps ${G.fmt(D.heroDps)} mobHp ${G.fmt(G.mobHp(S.depth))} bossHp ${G.fmt(G.bossHp(S.depth))} bossMult ${G.fmt(D.bossMult)} fight ${bossDur.length ? (bossDur.slice(-8).reduce((a, b) => a + b, 0) / Math.min(8, bossDur.length)).toFixed(1) + 's' : '-'} hs ${G.hordeScale().toFixed(2)}`); }
    log.push(`${String((t / 60).toFixed(0)).padStart(4)}m gold ${G.fmt(S.gold).padStart(8)} run ${G.fmt(S.goldRun).padStart(8)} gps ${G.fmt(D.gps).padStart(8)} click ${G.fmt(D.click).padStart(7)} ` +
      `d${S.depth} (best ${S.bestDepth}) chests ${S.st.chests} ess ${G.fmt(S.essence, 1)} nodes ${Object.values(S.nodes).reduce((a, b) => a + b, 0)} ` +
      `lv ${S.hero.lvl} pow ${G.fmt(D.power)} eq ${G.SLOTS.map(s=>{const g=S.hero.eq[s];return g?g.r+'/'+g.il+'+'+g.e:'-'}).join(' ')} sh ${G.fmt(S.hero.shards)} pets ${Object.keys(S.pets).length} eggs ${S.eggs} fame ${G.fmt(G.fameGain())}/${S.fameTotal} ach ${Object.keys(S.ach).length} heroes ${heroes} boss ${bossTries - bossFails}/${bossTries} cap ${(D.heroDps / G.mobHp(S.depth)).toFixed(1)} kills ${S.hero.kills}`);
  }
}
console.log(log.join('\n'));
console.log('\nFirst events (min):');
const ev = Object.entries(events).sort((a, b) => a[1] - b[1]).map(([k, v]) => `${k}@${(v / 60).toFixed(1)}`);
console.log(ev.join('  '));
console.log('\nUpgrades:', JSON.stringify(G.S.upg));
console.log('Opened by tier:', G.S.opened.join(' '), ' divine', G.S.st.divine, ' merges', G.S.st.merges);
console.log('Pots:', JSON.stringify(G.S.pots));
