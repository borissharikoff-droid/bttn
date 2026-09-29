// Persona playtests: bots that play like different kinds of people, and the
// numbers that say whether the game keeps them busy.
//
//   node tools/playtest.js <persona> [seed] [minutes]   one run, JSON out
//   node tools/playtest.js all [seeds=4] [minutes=120]  every persona, report
//
// Personas: active (6 clicks/s, picks perks well), casual (2.5 clicks/s half
// the time, takes the first perk, reacts slowly), idle (never clicks, checks
// in once a minute), returner (two short sessions a day for a week, offline
// in between).
'use strict';
const path = require('path');
const { execFile } = require('child_process');
const { makeWorld, shop, buyLegacy, PERK_PRIORITY } = require('./bot');

const PERSONAS = {
  active:   { cps: 6, duty: 1, shopEvery: 1, chests: 0.3, wisp: 0.8, perk: 'smart', perkDelay: 1, bossDelay: 0, ascend: 'smart' },
  casual:   { cps: 2.5, duty: 0.5, shopEvery: 20, chests: 0.3, wisp: 0.3, perk: 'first', perkDelay: 5, bossDelay: 10, ascend: 'stuck', stuckMin: 10 },
  idle:     { cps: 0, duty: 0, shopEvery: 60, chests: 0, wisp: 0, perk: 'auto', perkDelay: 99, bossDelay: 30, ascend: 'stuck', stuckMin: 20 },
  returner: { cps: 2.5, duty: 0.7, shopEvery: 10, chests: 0.3, wisp: 0.5, perk: 'first', perkDelay: 4, bossDelay: 5, ascend: 'stuck', stuckMin: 8,
    days: 7, sessions: [[15, 8 * 3600], [15, 16 * 3600]] },
};
// "Big" moments are the ones a player would notice as progress
const BIG = new Set(['boss', 'lord', 'land', 'rarity', 'pet', 'unlock', 'ascend', 'evolve', 'goal']);

function run(name, seed, minutes) {
  const P = PERSONAS[name];
  const { G, clock } = makeWorld(seed);
  // a simulated calendar: each seed starts on its own day, the returner lives through a week
  let simDay = seed * 3;
  G.todayKey = () => 'sim-day-' + simDay;
  const S = () => G.S;
  G.chooseClass(['knight', 'archer', 'wizard', 'rogue'][seed % 4]);
  let rnd = seed * 7919 + 1; const r = () => ((rnd = (rnd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

  const moments = [], first = {};
  const mark = (k, t = clock.now) => { moments.push([t, k]); if (!(k in first)) first[k] = t; };
  let bestR = -1, fails = 0, failStreak = 0, maxFailStreak = 0;
  G.on('levelUp', () => mark('level'));
  G.on('perk', () => mark('perk'));
  G.on('bossWin', (rew, b) => { mark(b.lord ? 'lord' : 'boss'); failStreak = 0; });
  G.on('bossFail', () => { fails++; failStreak++; maxFailStreak = Math.max(maxFailStreak, failStreak); mark('bossFail'); });
  G.on('realm', () => mark('land'));
  G.on('achievement', () => mark('ach'));
  G.on('chestOpen', loot => { const top = loot.items.reduce((m, x) => Math.max(m, x.it.r), 0); if (top > bestR) { for (let q = bestR + 1; q <= top; q++) mark('r' + q); bestR = top; mark('rarity'); } });
  G.on('gear', (g, eq) => { if (eq) mark('gear'); });
  G.on('pull', res => { if (res && res.some && res.some(x => x.isNew)) mark('pet'); });
  G.on('ascend', () => mark('ascend'));
  G.on('questClaim', () => mark('quest'));
  G.on('wispCatch', () => mark('wisp'));
  G.on('buttonBreak', () => mark('break'));
  G.on('journey', () => mark('goal'));
  // every boss attempt: where the boss started, what was left, how strong the Warden was
  const attempts = [];
  G.on('bossStart', b => attempts.push({ t: +(clock.now / 60).toFixed(1), d: b.d, start: +(b.hp / b.max).toFixed(2), cap: +G.mightRatio().toFixed(2), t0: clock.now }));
  G.on('bossFail', b => Object.assign(attempts[attempts.length - 1] || {}, { res: 'fail', left: +(Math.max(0, b.hp) / b.max).toFixed(2), secs: Math.round(clock.now - attempts[attempts.length - 1].t0) }));
  G.on('bossWin', () => Object.assign(attempts[attempts.length - 1] || {}, { res: 'win', secs: Math.round(clock.now - attempts[attempts.length - 1].t0) }));
  G.on('evolve', () => mark('evolve'));
  G.on('bounty', () => mark('bounty'));
  // the tabs the UI unlocks, as a player would see them appear
  const TABS = { heroes: s => s.goldTotal >= 40, coll: s => s.st.chests >= 1, quests: s => s.st.chests >= 5, stars: s => s.essRun >= 1, pets: s => s.eggs > 0 || Object.keys(s.pets).length > 0, ach: s => Object.keys(s.ach).length > 0, asc: s => s.maxDepth >= 5 };
  const seenTab = {};

  const dt = 0.2;
  let clickAcc = 0, lastShop = -99, bossSeen = -1, offerSeen = -1, lastBestDepth = 0, lastDepthT = 0, lastAscend = -1e9;
  const depthAt = {}, stalls = [];
  const sessions = [];
  function playFor(seconds, P) {
    const end = clock.now + seconds;
    for (; clock.now < end; clock.now += dt) {
      const s = S(), t = clock.now;
      // clicking: bursts of attention for part-timers
      const on = P.duty >= 1 || (P.duty > 0 && (t % 60) < 60 * P.duty);
      if (on && P.cps > 0) {
        clickAcc += P.cps * dt;
        while (clickAcc >= 1) {
          clickAcc -= 1;
          if (s.chests.length && r() < P.chests) G.clickChest(s.chests[s.chests.length - 1]);
          else G.manualClick(0, 0);
        }
        if (G.R.wisp && r() < P.wisp * dt) G.catchWisp();
      }
      G.tick(dt);
      // boss: pressed after a reaction delay
      if (G.R.bossReady && !G.R.boss) { if (bossSeen < 0) bossSeen = t; if (t - bossSeen >= P.bossDelay) { G.startBoss(); bossSeen = -1; } }
      // perks
      const h = s.hero;
      if (h.offer && P.perk !== 'auto') {
        if (offerSeen < 0) offerSeen = t;
        if (t - offerSeen >= P.perkDelay) {
          const pick = P.perk === 'smart' ? h.offer.slice().sort((a, b) => PERK_PRIORITY.indexOf(a) - PERK_PRIORITY.indexOf(b))[0] : h.offer[0];
          G.pickPerk(pick); offerSeen = -1;
        }
      } else offerSeen = -1;
      if (t - lastShop >= P.shopEvery) { lastShop = t; shop(G, P.cps * P.duty); }
      // progress bookkeeping
      if (s.bestDepth > lastBestDepth) {
        if (t - lastDepthT > 60) stalls.push([lastDepthT, t - lastDepthT, lastBestDepth]);
        lastBestDepth = s.bestDepth; lastDepthT = t;
        for (const d of [5, 10, 20, 30, 40, 50]) if (s.bestDepth >= d && !(d in depthAt)) depthAt[d] = t;
      }
      if (Math.round(t * 5) % 25 === 0) for (const k in TABS) if (!seenTab[k] && TABS[k](s)) { seenTab[k] = 1; mark('unlock'); mark('tab_' + k); }
      // ascension
      const fg = G.fameGain();
      let go = false;
      if (P.ascend === 'smart') go = fg >= 10 && t - lastAscend > 600 && (fg >= s.fameTotal * 0.6 || t - lastDepthT > 360);
      else go = fg >= 5 && t - lastDepthT > P.stuckMin * 60 && t - lastAscend > 600;
      if (go) { G.ascend(); lastAscend = t; buyLegacy(G); G.chooseClass(['knight', 'archer', 'wizard', 'rogue'][seed % 4]); lastDepthT = t; lastBestDepth = S().bestDepth; }
    }
  }

  if (P.days) {
    for (let day = 0; day < P.days; day++) for (const [mins, off] of P.sessions) {
      const before = { depth: S().bestDepth, fame: S().fameTotal, lvl: S().hero.lvl, m: moments.length };
      const t0 = clock.now;
      playFor(mins * 60, P);
      const big = moments.filter(m => m[0] >= t0 && BIG.has(m[1])).length;
      sessions.push({ day: day + 1, depth: S().bestDepth, dDepth: S().bestDepth - before.depth, big, fame: S().fameTotal - before.fame });
      const rew = G.applyOffline(off);
      if (off >= 12 * 3600) simDay++;
      clock.now += 0.001; // offline time doesn't tick the sandbox clock; only the reward is applied
      if (rew && rew.gold) mark('offline');
    }
  } else playFor(minutes * 60, P);

  // dry spells: longest time between big moments, per window
  const bigT = moments.filter(m => BIG.has(m[1])).map(m => m[0]).sort((a, b) => a - b);
  const total = clock.now;
  const windows = [[0, 600], [600, 1800], [1800, 3600], [3600, 7200], [7200, 1e9]];
  const win = windows.filter(([a]) => a < total).map(([a, b]) => {
    const e = Math.min(b, total);
    const ts = [a, ...bigT.filter(x => x >= a && x < e), e];
    let gap = 0; for (let i = 1; i < ts.length; i++) gap = Math.max(gap, ts[i] - ts[i - 1]);
    const n = moments.filter(m => m[0] >= a && m[0] < e).length;
    return { from: a / 60, to: e / 60, perMin: +(n / ((e - a) / 60)).toFixed(1), bigPerMin: +(ts.length - 2) / ((e - a) / 60), maxGap: Math.round(gap) };
  });
  const s = S();
  return {
    persona: name, seed, minutes: Math.round(total / 60), cls: s.hero.cls,
    first: Object.fromEntries(['boss', 'lord', 'perk', 'r3', 'r4', 'r5', 'r6', 'pet', 'tab_stars', 'tab_pets', 'tab_asc', 'ascend', 'break'].map(k => [k, first[k] != null ? +(first[k] / 60).toFixed(1) : null])),
    depthAt: Object.fromEntries(Object.entries(depthAt).map(([k, v]) => [k, +(v / 60).toFixed(1)])),
    windows: win, longestStall: stalls.reduce((m, x) => Math.max(m, x[1]), 0) / 60,
    bossFails: fails, maxFailStreak, ascensions: s.ascensions, journey: s.journey || 0, evos: Object.keys((s.rec && s.rec.evos) || {}).length, bounties: moments.filter(m => m[1] === 'bounty').length, bestDepth: s.bestDepth, level: s.hero.lvl,
    ach: Object.keys(s.ach).length + '/' + G.ACH.length, pets: Object.keys(s.pets).length, collection: Object.keys(s.coll).length + '/' + G.ITEMS.length,
    sessions, attempts: process.env.BOSSLOG ? attempts : undefined,
  };
}

function all(seeds, minutes) {
  const jobs = [];
  for (const p of Object.keys(PERSONAS)) for (let sd = 1; sd <= seeds; sd++) jobs.push([p, sd]);
  const results = [];
  let next = 0;
  const workers = Math.max(2, Math.min(8, require('os').cpus().length));
  return new Promise(done => {
    const launch = () => {
      if (next >= jobs.length) { if (results.length === jobs.length) done(results); return; }
      const [p, sd] = jobs[next++];
      execFile(process.execPath, [__filename, p, String(sd), String(minutes)], { maxBuffer: 1e7 }, (err, out) => {
        results.push(err ? { persona: p, seed: sd, error: String(err).slice(0, 300) } : JSON.parse(out));
        launch();
      });
    };
    for (let i = 0; i < workers; i++) launch();
  });
}
function report(results) {
  const by = {};
  for (const r of results) (by[r.persona] = by[r.persona] || []).push(r);
  const med = a => { const b = a.filter(x => x != null).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null; };
  const lines = [];
  for (const [p, rs] of Object.entries(by)) {
    const ok = rs.filter(r => !r.error);
    lines.push(`\n== ${p} (${ok.length} runs${rs.length - ok.length ? ', ' + (rs.length - ok.length) + ' failed' : ''}) ==`);
    if (!ok.length) { lines.push(rs[0].error); continue; }
    const f = k => med(ok.map(r => r.first[k]));
    lines.push(`first (min): boss ${f('boss')} · lord ${f('lord')} · perk ${f('perk')} · epic ${f('r3')} · legendary ${f('r4')} · mythic ${f('r5')} · divine ${f('r6')} · pet ${f('pet')} · stars ${f('tab_stars')} · ascend-tab ${f('tab_asc')} · ascension ${f('ascend')} · first break ${f('break')}`);
    lines.push(`depth reached at (min): ` + [5, 10, 20, 30, 40, 50].map(d => `d${d} ${med(ok.map(r => r.depthAt[d]))}`).join(' · '));
    const wins = ok[0].windows.map((w, i) => {
      const gaps = ok.map(r => r.windows[i] && r.windows[i].maxGap).filter(x => x != null);
      const big = ok.map(r => r.windows[i] && r.windows[i].bigPerMin).filter(x => x != null);
      return `${w.from}-${Math.round(w.to)}m: big/min ${med(big).toFixed(2)}, longest dry ${med(gaps)}s (worst ${Math.max(...gaps)}s)`;
    });
    lines.push('moments: ' + wins.join(' | '));
    lines.push(`journey step ${med(ok.map(r => r.journey || 0))} · evolutions discovered ${med(ok.map(r => r.evos || 0))} · bounties ${med(ok.map(r => r.bounties || 0))}`);
    lines.push(`longest depth stall ${med(ok.map(r => r.longestStall)).toFixed(1)} min · boss fails ${med(ok.map(r => r.bossFails))} (worst streak ${Math.max(...ok.map(r => r.maxFailStreak))}) · ascensions ${med(ok.map(r => r.ascensions))} · best depth ${med(ok.map(r => r.bestDepth))} · lvl ${med(ok.map(r => r.level))} · ach ${ok[0].ach.split('/')[1] ? med(ok.map(r => +r.ach.split('/')[0])) + '/' + ok[0].ach.split('/')[1] : '-'} · pets ${med(ok.map(r => r.pets))} · collection ${med(ok.map(r => +r.collection.split('/')[0]))}/${ok[0].collection.split('/')[1]}`);
    if (ok[0].sessions.length) {
      const n = ok[0].sessions.length;
      const rows = [];
      for (let i = 0; i < n; i++) rows.push(`d${ok[0].sessions[i].day}: depth ${med(ok.map(r => r.sessions[i].depth))} (+${med(ok.map(r => r.sessions[i].dDepth))}), big ${med(ok.map(r => r.sessions[i].big))}`);
      lines.push('sessions: ' + rows.join(' | '));
    }
  }
  return lines.join('\n');
}

if (require.main === module) {
  const [who = 'all', a, b] = process.argv.slice(2);
  if (who === 'all') all(+(a || 4), +(b || 120)).then(res => {
    require('fs').writeFileSync(path.join(__dirname, '..', 'playtest-results.json'), JSON.stringify(res, null, 1));
    console.log(report(res));
  });
  else process.stdout.write(JSON.stringify(run(who, +(a || 1), +(b || 60))));
}
module.exports = { run, report, PERSONAS };
