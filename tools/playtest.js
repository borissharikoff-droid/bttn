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
  active:   { tap: 5, cps: 10, duty: 1, shopEvery: 1, chests: 0.3, wisp: 0.8, perk: 'smart', perkDelay: 1, bossDelay: 0, ascend: 'smart', events: 0.9, craft: 1, rift: 300 },
  casual:   { tap: 3, cps: 10, duty: 0.6, shopEvery: 20, chests: 0.3, wisp: 0.3, perk: 'first', perkDelay: 5, bossDelay: 10, ascend: 'stuck', stuckMin: 10, events: 0.3, craft: 0, rift: 900 },
  idle:     { cps: 0, duty: 0, shopEvery: 60, chests: 0, wisp: 0, perk: 'auto', perkDelay: 99, bossDelay: 30, ascend: 'stuck', stuckMin: 20, events: 0, craft: 0, rift: 1800 },
  // an active player who wants a fight: raises Torment while the depth is easy, lowers it after two lost bosses
  hardcore: { tap: 6, cps: 10, duty: 1, shopEvery: 1, chests: 0.3, wisp: 0.8, perk: 'smart', perkDelay: 1, bossDelay: 0, ascend: 'smart', events: 0.9, craft: 1, rift: 300, torment: 1 },
  returner: { tap: 3, cps: 10, duty: 0.7, shopEvery: 10, chests: 0.3, wisp: 0.5, perk: 'first', perkDelay: 4, bossDelay: 5, ascend: 'stuck', stuckMin: 8, events: 0.5, craft: 1, rift: 600,
    days: 7, sessions: [[15, 8 * 3600], [15, 16 * 3600]] },
};
// "Big" moments are the ones a player would notice as progress
const BIG = new Set(['boss', 'lord', 'land', 'rarity', 'pet', 'unlock', 'ascend', 'evolve', 'goal', 'unique', 'hoard', 'riftWin', 'landStar', 'invasion']);

function run(name, seed, minutes) {
  const P = PERSONAS[name];
  const { G, clock } = makeWorld(seed);
  // a simulated calendar: each seed starts on its own day, the returner lives through a week
  let simDay = seed * 3;
  G.todayKey = () => 'sim-day-' + simDay;
  G.utcDayKey = G.todayKey;
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
  G.on('bossStart', b => attempts.push({ t: +(clock.now / 60).toFixed(1), d: b.d, start: +(b.hp / b.max).toFixed(2), cap: +G.mightRatio().toFixed(2), t0: clock.now, fresh: b.d >= (G.S.bestDepth || 0) }));
  G.on('bossFail', b => Object.assign(attempts[attempts.length - 1] || {}, { res: 'fail', left: +(Math.max(0, b.hp) / b.max).toFixed(2), secs: Math.round(clock.now - attempts[attempts.length - 1].t0) }));
  G.on('bossWin', () => Object.assign(attempts[attempts.length - 1] || {}, { res: 'win', secs: Math.round(clock.now - attempts[attempts.length - 1].t0) }));
  G.on('evolve', () => mark('evolve'));
  G.on('landStar', () => mark('landStar'));
  const party = { downs: 0, wipes: 0, breaks: 0, invasions: 0, invWins: 0, phases: 0, heralds: 0, invLog: [] };
  G.on('invasion', () => party.invLog.push({ d: G.depthNow(), k: +((G.D.heroDps || 0) / G.mobHp(G.depthNow())).toFixed(2) }));
  G.on('invasionBoss', m => { party.heralds++; const l = party.invLog[party.invLog.length - 1]; if (l) { l.herald = +(G.R.inv.T - G.R.inv.t).toFixed(0); l.hp = +(m.max / Math.max(1, G.D.heroDps)).toFixed(1); } });
  G.on('invasionEnd', (w, r) => { const l = party.invLog[party.invLog.length - 1]; if (l) { l.win = w; l.prog = Math.round(r.prog); l.boss = !!G.R.boss; } });
  G.on('unitDown', () => party.downs++); G.on('wipe', () => { party.wipes++; mark('wipe'); }); G.on('buttonBreak', () => party.breaks++); G.on('invasion', () => party.invasions++); G.on('invasionEnd', w => { if (w) { party.invWins++; mark('invasion'); } }); G.on('bossPhase', () => party.phases++);
  let pops = 0; G.on('bomberPop', () => pops++);
  // chests: where they come from, how they open, how many sit on the field
  const chests = { spawn: {}, open: {}, field: [] };
  G.goldBySrc = {};
  G.on('chestSpawn', () => { const k = G.R.dropAt ? 'kill' : 'other'; chests.spawn[k] = (chests.spawn[k] || 0) + 1; });
  G.on('chestOpen', l => { chests.open[l.source] = (chests.open[l.source] || 0) + 1; });
  G.on('bounty', () => mark('bounty'));
  // loot on the ground, events and Rifts
  let drops = 0, orbs = 0, uniques = 0;
  G.on('pickup', (e, how, res) => {
    drops++;
    if (e.k === 'orb') orbs++;
    if (e.k === 'uq') { uniques++; mark('unique'); if (res && res.first) mark('newUnique'); }
    if (e.k === 'gear' && e.it.r > bestR) { for (let q = bestR + 1; q <= e.it.r; q++) mark('r' + q); bestR = e.it.r; mark('rarity'); }
  });
  G.on('hoardDie', () => mark('hoard'));
  G.on('hoard', () => mark('hoardSeen'));
  G.on('shrineUse', () => mark('shrine'));
  G.on('breach', () => mark('breach'));
  let riftBest = 0, riftRuns = 0;
  let riftFailed = false, riftLvl = 1;
  G.on('riftEnd', r => { riftRuns++; riftLvl = r.lvl; riftFailed = !r.win; if (r.win) { mark('riftWin'); riftBest = Math.max(riftBest, r.lvl); } else mark('riftFail'); });
  // the tabs the UI unlocks, as a player would see them appear
  const TABS = { heroes: s => s.goldTotal >= 40, coll: s => s.st.chests >= 1, quests: s => s.st.chests >= 5, stars: s => s.essRun >= 1, pets: s => s.eggs > 0 || Object.keys(s.pets).length > 0, ach: s => Object.keys(s.ach).length > 0, asc: s => s.maxDepth >= 15 };
  const seenTab = {};

  const dt = 0.2;
  let clickAcc = 0, lastShop = -99, bossSeen = -1, offerSeen = -1, lastBestDepth = 0, lastDepthT = 0, lastAscend = -1e9, lastRift = 0;
  const depthAt = {}, stalls = [];
  const sessions = [];
  // how crowded the arena is: mobs alive, sampled once a second, and kills per minute
  const crowd = []; let kills = 0;
  // pressure: how often the Button is in real danger (sampled once a second)
  const press = { n: 0, low: 0, crit: 0, boss: 0 };
  G.on('mobDie', () => kills++);
  function playFor(seconds, P) {
    const end = clock.now + seconds;
    for (; clock.now < end; clock.now += dt) {
      const s = S(), t = clock.now;
      // clicking: bursts of attention for part-timers
      const on = P.duty >= 1 || (P.duty > 0 && (t % 60) < 60 * P.duty);
      if (on && P.cps > 0) {
        // 3.0: holding clicks only at Steady Hand's rate; before that (and above it) only as fast as they tap
        clickAcc += Math.min(P.cps, Math.max(P.tap || 0, G.D.holdRate || 0)) * dt;
        // and they buy Steady Hand as soon as they can
        if ((G.S.upg.hold || 0) < 10) G.buyUpgrade('hold');
        while (clickAcc >= 1) {
          clickAcc -= 1;
          if (s.chests.length && r() < P.chests) G.clickChest(s.chests[s.chests.length - 1]);
          else G.manualClick(0, 0);
        }
        if (G.R.wisp && r() < P.wisp * dt) G.catchWisp();
      }
      // a wind-up's weak point: attentive players hit it a few times a second, others now and then
      if (on && P.events && G.R.boss && G.R.boss.move && G.tapBoss && r() < P.events * dt * 5) G.tapBoss();
      // the Hand's powers, as a person would use them (active players well, casual ones now and then)
      if (on && P.events && G.usePower && r() < P.events * dt * 4) {
        const R_ = G.R, b = R_.boss, h = s.hero, low = h.hp < G.D.heroHp * 0.45 || (G.partyUnits && G.partyUnits().some(u => u.down > 0 || u.hp < u.max * 0.35));
        if (b && b.move && (b.move.k === 'slam' || b.move.k === 'barrage' || b.move.k === 'doom') && b.move.t < 1) G.usePower('ward');
        else if (b && b.move && b.move.k === 'doom' && b.move.t < 1.5) G.usePower('smite');
        else if (low) G.usePower('mend');
        else if (b && !(b.inv > 0)) G.usePower('smite');
      }
      G.tick(dt);
      if (Math.round(t / dt) % 5 === 0) { crowd.push(G.R.mobs.length); chests.field.push(G.S.chests.length); press.n++; const hf = s.hero.hp / Math.max(1, G.D.heroHp); if (hf < 0.5) press.low++; if (hf < 0.2) press.crit++; if (G.R.boss) press.boss++; }
      // events: tap the shrine, chase the Hoarder
      if (P.events && G.R.shrine && r() < P.events * dt * 2) G.useShrine('hand');
      if (P.events && !G.R.focus) { const hd = G.R.mobs.find(m => m.kind === 'hoard'); if (hd && r() < P.events * dt * 3) G.R.focus = hd.id; }
      // loot: the attentive ones grab labels off the ground before the Warden does
      if (P.events && G.R.ground.length && r() < P.events * dt * 3) G.pickup(G.R.ground[0], 'hand');
      // Rifts: a run now and then once they open, harder when the last one went well
      if (P.rift && G.riftOpenable() && !G.R.rift && !G.R.boss && t - lastRift >= P.rift) { lastRift = t; G.riftStart(riftFailed ? Math.max(1, riftLvl - 3) : G.riftMax()); }
      if (P.craft && Math.round(t / dt) % 50 === 0) craft(G);
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
      if (P.torment && G.setTorment && Math.round(t / dt) % 50 === 0 && !G.R.boss) {
        const T = G.S.torment || 0;
        if (failStreak >= 2 && T > 0) { G.setTorment(T - 1); failStreak = 0; }
        else if (s.depth >= s.bestDepth && G.mightRatio() > 4 && T < G.tormentMax()) G.setTorment(T + 1);
      }
      // progress bookkeeping
      if (s.bestDepth > lastBestDepth) {
        if (t - lastDepthT > 60) stalls.push([lastDepthT, t - lastDepthT, lastBestDepth]);
        lastBestDepth = s.bestDepth; lastDepthT = t;
        for (const d of [5, 10, 20, 30, 40, 50, 65]) if (s.bestDepth >= d && !(d in depthAt)) depthAt[d] = t;
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
    first: Object.fromEntries(['boss', 'lord', 'perk', 'r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'pet', 'tab_stars', 'tab_pets', 'tab_asc', 'ascend', 'break', 'hoardSeen', 'hoard', 'shrine', 'breach', 'unique', 'riftWin'].map(k => [k, first[k] != null ? +(first[k] / 60).toFixed(1) : null])),
    loot: { dropsPerMin: +(drops / (clock.now / 60)).toFixed(1), orbs, uniques, found: Object.keys(S().uq || {}).length, hoards: moments.filter(m => m[1] === 'hoard').length, hoardsSeen: moments.filter(m => m[1] === 'hoardSeen').length, shrines: moments.filter(m => m[1] === 'shrine').length, breaches: moments.filter(m => m[1] === 'breach').length },
    party, chests: (() => { const m = clock.now / 60, o = {}; for (const k in chests.spawn) o['spawn_' + k] = +(chests.spawn[k] / m).toFixed(1); for (const k in chests.open) o['open_' + k] = +(chests.open[k] / m).toFixed(1); const f = chests.field.slice().sort((a, b) => a - b); o.fieldP50 = f[f.length >> 1] || 0; o.fieldMax = f[f.length - 1] || 0; const tot = Object.values(G.goldBySrc).reduce((a, b) => a + b, 0) || 1; o.gold = {}; for (const k in G.goldBySrc) o.gold[k] = +(G.goldBySrc[k] / tot).toFixed(3); return o; })(),
    stars: G.starCount(), breaks: moments.filter(m => m[1] === 'break').length, pops, uqTotal: G.UNIQUE_IDS.length,
    crowd: (() => { const c = crowd.slice().sort((a, b) => a - b); return { avg: Math.round(c.reduce((a, b) => a + b, 0) / (c.length || 1)), p50: c[c.length >> 1] || 0, p90: c[Math.floor(c.length * 0.9)] || 0, max: c[c.length - 1] || 0, killsPerMin: Math.round(kills / (clock.now / 60)) }; })(),
    rift: { best: riftBest, runs: riftRuns, open: S().rift.open },
    depthAt: Object.fromEntries(Object.entries(depthAt).map(([k, v]) => [k, +(v / 60).toFixed(1)])),
    windows: win, longestStall: stalls.reduce((m, x) => Math.max(m, x[1]), 0) / 60,
    bossFails: fails, maxFailStreak, ascensions: s.ascensions, journey: s.journey || 0, evos: Object.keys((s.rec && s.rec.evos) || {}).length, bounties: moments.filter(m => m[1] === 'bounty').length, bestDepth: s.bestDepth, level: s.hero.lvl,
    ach: Object.keys(s.ach).length + '/' + G.ACH.length, pets: Object.keys(s.pets).length, collection: Object.keys(s.coll).length + '/' + G.ITEMS.length,
    torment: s.torment || 0,
    pressure: { low: +(press.low / Math.max(1, press.n)).toFixed(3), crit: +(press.crit / Math.max(1, press.n)).toFixed(3), boss: +(press.boss / Math.max(1, press.n)).toFixed(3) },
    sessions, attempts: process.env.BOSSLOG ? attempts : undefined,
  };
}

// A simple crafter: whetstones and grace on the weapon, flux on a worn item with weak affixes
function craft(G) {
  const h = G.S.hero, w = h.eq.weapon;
  if (w && h.orbs.whet > 0 && !G.orbBlock('whet', w)) G.useOrb('whet', w);
  for (const s of G.SLOTS) { const g = h.eq[s]; if (g && h.orbs.grace > 0 && !G.orbBlock('grace', g)) { G.useOrb('grace', g); break; } }
  for (const s of G.SLOTS) { const g = h.eq[s]; if (g && h.orbs.ascent > 0 && !G.orbBlock('ascent', g)) { G.useOrb('ascent', g); break; } }
}
function all(seeds, minutes) {
  const jobs = [];
  for (const p of Object.keys(PERSONAS)) for (let sd = 1; sd <= seeds; sd++) jobs.push([p, sd]);
  const results = [];
  let next = 0;
  const workers = +process.env.PT_WORKERS || Math.max(2, Math.min(8, require('os').cpus().length));
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
    lines.push(`crowd: median alive ${med(ok.map(r => r.crowd.p50))} · p90 ${med(ok.map(r => r.crowd.p90))} · kills/min ${med(ok.map(r => r.crowd.killsPerMin))} · button breaks ${med(ok.map(r => r.breaks))} · bomber pops ${med(ok.map(r => r.pops))} · land stars ${med(ok.map(r => r.stars))}`);
    lines.push(`depth reached at (min): ` + [5, 10, 20, 30, 40, 50, 65].map(d => `d${d} ${med(ok.map(r => r.depthAt[d]))}`).join(' · '));
    const wins = ok[0].windows.map((w, i) => {
      const gaps = ok.map(r => r.windows[i] && r.windows[i].maxGap).filter(x => x != null);
      const big = ok.map(r => r.windows[i] && r.windows[i].bigPerMin).filter(x => x != null);
      return `${w.from}-${Math.round(w.to)}m: big/min ${med(big).toFixed(2)}, longest dry ${med(gaps)}s (worst ${Math.max(...gaps)}s)`;
    });
    lines.push('moments: ' + wins.join(' | '));
    const lt = k => med(ok.map(r => r.loot && r.loot[k]));
    lines.push(`first (min): uncommon ${f('r1')} · rare ${f('r2')} · hoarder seen ${f('hoardSeen')} / slain ${f('hoard')} · shrine ${f('shrine')} · breach ${f('breach')} · unique ${f('unique')} · rift win ${f('riftWin')}`);
    lines.push(`loot: drops/min ${lt('dropsPerMin')} · orbs ${lt('orbs')} · uniques ${lt('uniques')} (distinct ${lt('found')}/${ok[0].uqTotal}) · hoarders ${lt('hoards')}/${lt('hoardsSeen')} · shrines ${lt('shrines')} · breaches ${lt('breaches')} · rift best ${med(ok.map(r => r.rift && r.rift.best))} (${med(ok.map(r => r.rift && r.rift.runs))} runs)`);
    lines.push(`journey step ${med(ok.map(r => r.journey || 0))} · evolutions discovered ${med(ok.map(r => r.evos || 0))} · bounties ${med(ok.map(r => r.bounties || 0))}`);
    lines.push(`pressure: Button under 50% ${med(ok.map(r => r.pressure.low))} of the time, under 20% ${med(ok.map(r => r.pressure.crit))}, in boss fights ${med(ok.map(r => r.pressure.boss))} · wipes ${med(ok.map(r => r.party.wipes))} · downs ${med(ok.map(r => r.party.downs))}`);
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
