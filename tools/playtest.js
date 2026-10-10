// Persona playtests (4.0, the Siege): bots that play like different kinds of people, and the numbers that say whether the
// game keeps them busy and how far they get.
//
//   node tools/playtest.js <persona> [seed] [minutes] [optsJSON]   one job (one persona playing Sieges for that long), JSON out
//   node tools/playtest.js all [seeds=4] [minutes=60]              every persona, the report (tools/siege.js aggregates)
//
// Personas (tools/bot.js SIEGE_POLICY has what each does at the setup, the cards, the loot moment, shrines, camps, doors):
//   active     10 clicks/s held, duty 1, reads the cards (schools), takes the best ▲ loot, charges every shrine, Elite/Treasure doors
//   attentive  the attentive casual (DESIGN §9.1: duty 1, events 0.6): takes the first card, the ▲ loot, Calm doors, extracts at Camp 4
//   casual     duty 0.6, events 0.3: the half-attentive one; slow to answer; the first card; a glance at the loot
//   idle       never clicks, checks in once a minute: the game's own auto for every hold (with {clockwork: 1}: the Clockwork
//              Button and Auto-Run, DESIGN §14's idle gate)
//   hardcore   the active persona climbing the Heat as wins come; returner: a casual in two short sessions a day for a week
// opts (JSON): { meta: 'none' | 'third' | 'full' | 0..1, heat: n (every run at this Heat), grow: 1 (buy the Hall / Town / Star
//   Chart with the Fame and Embers earned between runs), clockwork: 1 (unlock the Clockwork Button + Auto-Run, extract at Camp 2),
//   unlock: 1 (every Deed's unlock open), tune: {TUNE overrides}, po: {persona overrides}, pol: {policy overrides}, cls, btn,
//   keeps: false, tut: 0 (stay in the tutorial's shelter: no sudden events), eval: 'JS with G' }
'use strict';
const path = require('path');
const { execFile } = require('child_process');
const bot = require('./bot');
const { shop, buyMeta, metaMode, botSetup, botHold, SIEGE_POLICY } = bot;

const PERSONAS = {
  // bossDelay: s after the clear bar fills before the persona calls the boss in (⚔); null: the game's own call (0 s when
  // the party looks ready, else 12-25 s, 30 s after two losses: the idle one lets it farm the ground first)
  // tapBoss: weak-point taps a second that LAND during a boss's wind-up, after tapReact s of noticing it (bots C1: the old
  // loop tapped events x 5 a second, 4.5 for the active one, every tap landing (G.tapBoss has no hit test: the UI has), so
  // every telegraphed move - DOOM included, lords' too - was broken before it landed and the gates never saw a DOOM; a strong
  // person lands maybe 2.5 a second on a point that opens round the boss: a boss's SLAM (3 taps in 2.2 s) mostly, a lord's
  // DOOM (7 in 3.2 s) a third of the time, the rest is the Ward's)
  active:    { tap: 5, cps: 10, duty: 1, shopEvery: 1, chests: 0.3, wisp: 0.8, events: 0.9, craft: 1, bossDelay: 0, pol: 'active', tapBoss: 2.5, tapReact: 0.4 },
  attentive: { tap: 3, cps: 10, duty: 1, shopEvery: 10, chests: 0.3, wisp: 0.5, events: 0.6, craft: 0, bossDelay: 3, pol: 'attentive', tapBoss: 1.6, tapReact: 0.6 },
  casual:    { tap: 3, cps: 10, duty: 0.6, shopEvery: 20, chests: 0.3, wisp: 0.3, events: 0.3, craft: 0, bossDelay: 10, pol: 'casual', tapBoss: 0.8, tapReact: 0.8 },
  idle:      { cps: 0, duty: 0, shopEvery: 60, chests: 0, wisp: 0, events: 0, craft: 0, bossDelay: null, pol: 'idle', tapBoss: 0, tapReact: 0 },
  hardcore:  { tap: 6, cps: 10, duty: 1, shopEvery: 1, chests: 0.3, wisp: 0.8, events: 0.9, craft: 1, bossDelay: 0, pol: 'hardcore', tapBoss: 3, tapReact: 0.3 },
  returner:  { tap: 3, cps: 10, duty: 0.7, shopEvery: 10, chests: 0.3, wisp: 0.5, events: 0.5, craft: 1, bossDelay: 5, pol: 'casual', tapBoss: 1.2, tapReact: 0.6,
    days: 7, sessions: [[15, 8 * 3600], [15, 16 * 3600]] },
};
// "Big" moments are the ones a player would notice as progress
const BIG = new Set(['boss', 'lord', 'land', 'rarity', 'pet', 'unlock', 'evolve', 'unique', 'hoard', 'invasion', 'relic', 'deed', 'win', 'key', 'ultra']);
const med = a => { const b = a.filter(x => x != null).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null; };
const r2 = x => Math.round(x * 100) / 100;

function run(name, seed, minutes, opts) {
  opts = opts || {};
  const P = Object.assign({}, PERSONAS[name] || PERSONAS.casual, opts.po || {});
  // (the tutorial ends 15 s after the first boss falls, as for a real player: sudden events, Hoarders and the rest then
  // happen; opts.tut 0 keeps the bots in its shelter, as the 3.x GDD numbers assumed)
  const tut = opts.tut != null ? !!opts.tut : process.env.PT_TUT !== '0';
  // (bot.makeWorld read at call time: the balance harnesses (tests/*/bal/cell.js, tools/sim.js) wrap it to hook the world)
  const { G, clock } = bot.makeWorld(seed);
  if (opts.tune) Object.assign(G.TUNE, opts.tune);
  const S = () => G.S;
  // the policy: the persona's (opts.pol overrides fields; null for the idle one, who leaves every hold to the game)
  const pol0 = SIEGE_POLICY[P.pol] === undefined ? SIEGE_POLICY[name] : SIEGE_POLICY[P.pol];
  const pol = pol0 ? Object.assign({}, pol0, opts.pol || {}) : (opts.pol ? Object.assign({}, opts.pol) : null);
  G.botPolicy = pol;
  G.botLoop = 1;
  if (pol && pol.holdAuto) G.TUNE.beatAutoNoUI = pol.holdAuto;
  // the next Siege is the persona's to set up (Button, class, Heat, keepsakes, first door): not the game's AGAIN
  G.TUNE.runAgainAuto = 0;
  // a simulated calendar: each seed starts on its own day, the returner lives through a week
  let simDay = seed * 3;
  G.todayKey = () => 'sim-day-' + simDay;
  G.utcDayKey = G.todayKey;
  // the meta tier (DESIGN §14 cells), the idle gate's Clockwork + Auto-Run, every unlock
  const metaK = metaMode(G, opts.meta || 0);
  if (opts.unlock) bot.metaFill(G, 0, { unlock: true });
  if (opts.clockwork && G.unlockAdd) { G.unlockAdd('button:clockwork'); G.unlockAdd('system:autorun'); if (G.autoRun) G.autoRun(1, opts.autoRunCamp || 2); }
  const setupPol = opts.clockwork ? SIEGE_POLICY.clockwork : pol;
  if (opts.heat != null) { G.S.heatWon = Math.max(G.S.heatWon | 0, (opts.heat | 0) - 1); }
  if (opts.eval) new Function('G', opts.eval)(G);
  let rnd = seed * 7919 + 1; const r = () => ((rnd = (rnd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

  // ---------- the moments and the lifetime counters (the 3.x shape, kept) ----------
  const moments = [], first = {};
  const mark = (k, t = clock.now) => { moments.push([t, k]); if (!(k in first)) first[k] = t; };
  let bestR = -1;
  G.on('levelUp', () => mark('level'));
  G.on('perk', () => mark('perk'));
  G.on('bossWin', (rew, b) => mark(b.lord ? 'lord' : 'boss'));
  G.on('bossFail', () => mark('bossFail'));
  G.on('realm', () => mark('land'));
  G.on('achievement', () => mark('ach'));
  G.on('deed', () => mark('deed'));
  G.on('unlock', () => mark('unlock'));
  G.on('gear', (g, eq) => { if (eq) mark('gear'); });
  G.on('pull', res => { if (res && res.some && res.some(x => x.isNew)) mark('pet'); });
  G.on('questClaim', () => mark('quest'));
  G.on('wispCatch', () => mark('wisp'));
  G.on('buttonBreak', () => mark('break'));
  G.on('journey', () => mark('goal'));
  G.on('evolve', () => mark('evolve'));
  G.on('relicPick', () => mark('relic'));
  G.on('key', () => mark('key'));
  G.on('pip', (d, pips, why, kind) => mark('pip_' + kind));
  const party = { downs: 0, wipes: 0, breaks: 0, invasions: 0, invWins: 0 };
  G.on('unitDown', () => party.downs++); G.on('wipe', () => { party.wipes++; mark('wipe'); }); G.on('buttonBreak', () => party.breaks++);
  G.on('invasion', () => party.invasions++); G.on('invasionEnd', w => { if (w) { party.invWins++; mark('invasion'); } });
  G.on('pickup', (e, how, res) => {
    if (e.k === 'uq') { mark('unique'); if (res && res.first) mark('newUnique'); }
    if (e.k === 'gear' && e.it.r > bestR) { bestR = e.it.r; mark('rarity'); }
  });
  G.on('loot', li => { if (li && li.g && li.g.r > bestR) { bestR = li.g.r; mark('rarity'); } if (li && li.g && (li.g.q || li.g.r >= 5)) mark('ultra'); });
  G.on('hoardDie', () => mark('hoard'));
  G.on('shrineUse', () => mark('shrine'));
  G.on('champKill', () => mark('champ'));

  // ---------- the run's facts (DESIGN §13 item 16's metrics), one record per Siege ----------
  const runs = [];
  let c = null;
  const fresh = () => {
    c = { t0: clock.now, choices0: G.botStats.choices, autos0: G.botStats.autos, chests: 0, labels: 0, n: 0, low: 0, crit: 0, fails: 0, lordFails: 0,
      loots: 0, lootT: [], lootOpen: null, lootUltra: 0, cardsT: [], cardOpen: null, camps: 0, campT: [], campOpen: null, shrines: 0, shrinesSeen: 0, charged: 0,
      bossT: [], lordT: [], b0: 0, wisps: 0, powers: 0, taps: 0, od: 0, chestClicks: 0, picks: 0, relics: 0, doors: 0, pacts: 0, boons: 0, keys: 0, uniques: 0, deeds: 0 };
  };
  fresh();
  G.on('runStart', () => fresh());
  G.on('bossStart', () => { c.b0 = clock.now; });
  G.on('bossWin', (rew, b) => (b.lord ? c.lordT : c.bossT).push(r2(clock.now - c.b0)));
  G.on('bossFail', b => { c.fails++; if (b.lord) c.lordFails++; });
  // (the jackpot's rain of chests is one in hours, by design: not counted)
  G.on('chestSpawn', () => { if (!(G.R.ev && G.R.ev.k === 'jackpot')) c.chests++; });
  G.on('drop', e => { if ((e.k === 'gear' && e.r >= 2) || e.k === 'uq') c.labels++; });
  G.on('perk', (id, rank, how) => { if (how !== 'button') c.picks++; });
  G.on('evolve', () => c.picks++);
  G.on('lootMoment', L => { c.loots++; c.lootOpen = clock.now; if (L && L.ultra) c.lootUltra += L.ultra; });
  G.on('lootDone', () => { if (c.lootOpen != null) c.lootT.push(r2(clock.now - c.lootOpen)); c.lootOpen = null; });
  G.on('cardOffer', () => { if (c.cardOpen == null) c.cardOpen = clock.now; });
  G.on('cardPick', () => { if (c.cardOpen != null) c.cardsT.push(r2(clock.now - c.cardOpen)); c.cardOpen = null; });
  G.on('campOpen', () => { c.camps++; c.campOpen = clock.now; });
  G.on('campDone', () => { if (c.campOpen != null) c.campT.push(r2(clock.now - c.campOpen)); c.campOpen = null; });
  G.on('shrine', () => c.shrinesSeen++);
  G.on('shrineUse', (s, how) => { c.shrines++; if (how === 'hand') c.charged++; });
  G.on('wispCatch', () => c.wisps++);
  G.on('power', () => c.powers++);
  G.on('bossTap', () => c.taps++);
  G.on('overdrive', () => c.od++);
  G.on('relicPick', () => c.relics++);
  G.on('door', () => c.doors++);
  G.on('pact', (id, yes) => { if (yes) c.pacts++; });
  G.on('boon', () => c.boons++);
  G.on('key', () => c.keys++);
  G.on('loot', li => { if (li && li.g && li.g.q) c.uniques++; });
  G.on('deed', () => c.deeds++);
  const tk0 = G.tick;
  G.tick = dt => {
    const rr = G.S.run;
    if (rr && rr.on && rr.phase === 'field' && G.D.heroHp) { c.n++; const f = G.S.hero.hp / G.D.heroHp; if (f < 0.5) c.low++; if (f < 0.2) c.crit++; }
    return tk0(dt);
  };
  G.on('runSummary', s => {
    const nm = s.nearMiss || {}, mins = Math.max(0.01, s.secs / 60), fmin = Math.max(0.01, s.field / 60);
    const rec = { n: s.n, kind: s.kind, win: s.kind === 'win' ? 1 : 0, heat: s.heat, meta: metaK, btn: s.btn, cls: s.cls, keeps: (s.keeps || []).length,
      min: r2(s.secs / 60), field: r2(s.field / 60),
      // the wall time a person would take (DESIGN §8: loot moment ~4 s, card ~3 s, camp and doors ~28 s, relic ~5 s) on top
      // of the field: the bots answer faster than that
      wall: r2((s.field + 4 * c.loots + 3 * (s.cardsN || 0) + 28 * c.camps + 5 * c.relics) / 60),
      cleared: s.cleared, depth: s.depth, lvl: s.lvl, party: (s.party || []).length, lords: s.lords, acts: s.acts,
      cause: s.cause || null, fallKind: s.kind === 'fall' ? nm.bossKind || 'zone' : null, fallSlot: s.kind === 'fall' ? Math.floor(s.depth / 3) : null, land: nm.landId || s.land || null,
      pips: s.pips, pipMax: s.pipMax, wipes: s.wipes, fails: c.fails, lordFails: c.lordFails,
      evos: (s.evos || []).length, cards: s.cardsN | 0, picks: c.picks, top: (s.cards || []).map(x => x.id), belt: (s.belt || []).length, relics: c.relics,
      fame: Math.round(s.fame.total), embers: Math.round(s.embers.total), pouch: Math.round(s.embers.pouch || 0),
      chests: c.chests, labels: c.labels, chestsPerMin: r2(c.chests / fmin), labelsPerMin: r2(c.labels / fmin),
      low: c.n ? r2(c.low / c.n) : 0, crit: c.n ? r2(c.crit / c.n) : 0,
      choices: G.botStats.choices - c.choices0, autos: G.botStats.autos - c.autos0,
      choicesPerMin: r2((G.botStats.choices - c.choices0) / mins), autosPerMin: r2((G.botStats.autos - c.autos0) / mins),
      loots: c.loots, lootSecs: med(c.lootT), lootSecsMax: c.lootT.length ? Math.max(...c.lootT) : null, lootUltra: c.lootUltra,
      cardSecs: med(c.cardsT), camps: c.camps, campSecs: med(c.campT), doors: c.doors,
      shrines: c.shrines, shrinesSeen: c.shrinesSeen, charged: c.charged, boons: c.boons, pacts: c.pacts, keys: c.keys, uniques: c.uniques, deeds: c.deeds,
      wisps: c.wisps, powers: c.powers, taps: c.taps, od: c.od, bossMed: med(c.bossT), lordMed: med(c.lordT), at: r2(clock.now / 60) };
    runs.push(rec);
    mark(s.kind === 'win' ? 'win' : 'fall');
    // between runs: the meta a growing player buys with what the run paid
    if (opts.grow) buyMeta(G);
  });

  // ---------- the loop ----------
  const dt = 0.2;
  let clickAcc = 0, lastShop = -99, bossSeen = -1;
  const hold = { kind: null, ref: null, t: 0 };
  const shr = { ref: null, go: false };
  const crowd = []; let kills = 0;
  const press = { n: 0, low: 0, crit: 0, boss: 0 };
  G.on('mobDie', () => kills++);
  const sessions = [];
  function startRun() {
    const su = botSetup(G, setupPol, seed, { heat: opts.heat, cls: opts.cls, btn: opts.btn, keeps: opts.keeps });
    const ok = G.runStart(su);
    if (ok) G.botStats.choices++; // the setup is a choice (one, however many fields)
    return ok;
  }
  function playFor(seconds) {
    const end = clock.now + seconds;
    for (; clock.now < end; clock.now += dt) {
      const s = S(), t = clock.now;
      if (s.fallen) G.runGiveUp();
      if (!s.run || !s.run.on) { if (!startRun()) break; }
      const held = G.runHeld ? G.runHeld() : false;
      // a hold on screen (a card, the loot moment, a shrine's choice, camp, doors, a relic, the win): the persona's turn
      if (held || s.run.offer || s.run.boonOffer || s.run.pactOffer) botHold(G, pol, dt, hold, r);
      // clicking: bursts of attention for part-timers; not while the Hand charges a shrine
      const on = P.duty >= 1 || (P.duty > 0 && (t % 60) < 60 * P.duty);
      // a shrine: charge it (hold the Hand on it for 2 s, the Button let go meanwhile) as often as the policy says
      let charging = false;
      if (G.R.shrine && !held && pol && pol.shrine > 0 && on) {
        if (shr.ref !== G.R.shrine) { shr.ref = G.R.shrine; shr.go = r() < pol.shrine; if (shr.go) G.botStats.choices++; }
        if (shr.go) { charging = true; G.shrineHold(dt); }
      } else if (!G.R.shrine) shr.ref = null;
      if (on && P.cps > 0 && !held && !charging) {
        // 3.0: holding clicks only at Steady Hand's rate; before that (and above it) only as fast as they tap
        clickAcc += Math.min(P.cps, Math.max(P.tap || 0, G.D.holdRate || 0)) * dt;
        // and they buy Steady Hand as soon as they can
        if ((s.upg.hold || 0) < 10) G.buyUpgrade('hold');
        while (clickAcc >= 1) {
          clickAcc -= 1;
          if (s.chests.length && r() < P.chests) { G.clickChest(s.chests[s.chests.length - 1]); c.chestClicks++; }
          else G.manualClick(0, 0);
        }
        if (G.R.wisp && r() < P.wisp * dt) G.catchWisp();
      }
      if (!held) {
        // a wind-up's weak point: the persona lands tapBoss taps a second on it, once it has noticed the wind-up (tapReact s)
        // (a persona without the fields - a harness's own - taps as the 3.x loop did: events x 5 a second)
        { const b = G.R.boss, mv = b && b.move; if (on && mv && G.tapBoss && (P.tapBoss != null ? (mv.T - mv.t) >= (P.tapReact || 0) && r() < P.tapBoss * dt : P.events && r() < P.events * dt * 5)) G.tapBoss(); }
        // the Hand's powers, as a person would use them (active players well, casual ones now and then)
        if (on && P.events && G.usePower && r() < P.events * dt * 4) {
          const R_ = G.R, b = R_.boss, h = s.hero, low = h.hp < G.D.heroHp * 0.45 || (G.partyUnits && G.partyUnits().some(u => u.down > 0 || u.hp < u.max * 0.35));
          if (b && b.move && (b.move.k === 'slam' || b.move.k === 'barrage' || b.move.k === 'doom') && b.move.t < 1) G.usePower('ward');
          else if (b && b.move && b.move.k === 'doom' && b.move.t < 1.5) G.usePower('smite');
          else if (low) G.usePower('mend');
          else if (b && !(b.inv > 0)) G.usePower('smite');
        }
        // the Hoarder chased, a rare+ label grabbed off the ground before the Warden gets to it
        if (P.events && !G.R.focus) { const hd = G.R.mobs.find(m => m.kind === 'hoard'); if (hd && r() < P.events * dt * 3) G.R.focus = hd.id; }
        if (P.events && G.R.ground.length && r() < P.events * dt * 3) { const e = G.R.ground.find(x => (x.k === 'gear' && x.r >= 2) || x.k === 'uq') || G.R.ground[0]; G.pickup(e, 'hand'); }
        // 3.1: OVERDRIVE when it's full (the idle ones let it go off by itself)
        if (on && P.events && G.odReady && G.odReady() && r() < P.events * dt * 2) G.overdrive('tap');
        // the bonus bubbles
        if (on && P.events && G.bubbles && G.bubbles.length && r() < P.events * dt * 2) G.popBubble(G.bubbles[0].id);
        if (P.craft && Math.round(t / dt) % 50 === 0) craft(G);
      }
      // the tutorial ends 15 s after the first boss falls (sudden events, Hoarders, the director's beats from then on)
      if (tut && s.tut >= 0 && first.boss != null && t - first.boss >= 15) s.tut = -1;
      G.tick(dt);
      if (Math.round(t / dt) % 5 === 0) {
        crowd.push(G.R.mobs.length); press.n++;
        const hf = s.hero.hp / Math.max(1, G.D.heroHp); if (hf < 0.5) press.low++; if (hf < 0.2) press.crit++; if (G.R.boss) press.boss++;
      }
      // the boss is called in when the bar is full (⚔ after bossDelay s; the idle one waits for the game's own call)
      if (G.R.bossReady && !G.R.boss && !held && P.bossDelay != null) { if (bossSeen < 0) bossSeen = t; if (t - bossSeen >= P.bossDelay) { G.startBoss(); bossSeen = -1; } }
      else if (!G.R.bossReady) bossSeen = -1;
      if (t - lastShop >= P.shopEvery) { lastShop = t; shop(G, P.cps * P.duty); }
    }
  }
  if (P.days) {
    for (let day = 0; day < P.days; day++) for (const [mins, off] of P.sessions) {
      const before = { runs: runs.length, m: moments.length, embers: S().embers | 0 };
      const t0 = clock.now;
      playFor(mins * 60);
      const big = moments.filter(m => m[0] >= t0 && BIG.has(m[1])).length;
      sessions.push({ day: day + 1, runs: runs.length - before.runs, wins: runs.slice(before.runs).filter(x => x.win).length, big, embers: (S().embers | 0) - before.embers, cur: S().run && S().run.on ? { cleared: S().run.cleared, pips: S().run.pips } : null });
      const rew = G.applyOffline(off);
      if (off >= 12 * 3600) simDay++;
      clock.now += 0.001;
      if (rew && (rew.gold || rew.embers)) mark('offline');
    }
  } else playFor(minutes * 60);

  // ---------- the report of one job ----------
  const bigT = moments.filter(m => BIG.has(m[1])).map(m => m[0]).sort((a, b) => a - b);
  const total = clock.now;
  const windows = [[0, 600], [600, 1800], [1800, 3600], [3600, 7200], [7200, 1e9]].filter(([a]) => a < total).map(([a, b]) => {
    const e = Math.min(b, total), ts = [a, ...bigT.filter(x => x >= a && x < e), e];
    let gap = 0; for (let i = 1; i < ts.length; i++) gap = Math.max(gap, ts[i] - ts[i - 1]);
    return { from: a / 60, to: e / 60, perMin: r2(moments.filter(m => m[0] >= a && m[0] < e).length / ((e - a) / 60)), bigPerMin: r2((ts.length - 2) / ((e - a) / 60)), maxGap: Math.round(gap) };
  });
  const s = S(), cur = s.run && s.run.on ? { n: s.run.n, cleared: s.run.cleared, depth: s.depth, pips: s.run.pips, min: r2(s.run.secs / 60), heat: s.run.heat } : null;
  return {
    persona: name, seed, minutes: Math.round(total / 60), opts, meta: metaK, cls: s.hero.cls, policy: pol ? pol.name : null,
    runs, cur,
    first: Object.fromEntries(['boss', 'lord', 'perk', 'rarity', 'unique', 'ultra', 'evolve', 'relic', 'shrine', 'hoard', 'wipe', 'pip_lost', 'win', 'fall', 'deed', 'unlock', 'key', 'champ', 'break'].map(k => [k, first[k] != null ? r2(first[k] / 60) : null])),
    party, crowd: (() => { const a = crowd.slice().sort((x, y) => x - y); return { p50: a[a.length >> 1] || 0, p90: a[Math.floor(a.length * 0.9)] || 0, max: a[a.length - 1] || 0, killsPerMin: Math.round(kills / (total / 60)) }; })(),
    pressure: { low: r2(press.low / Math.max(1, press.n)), crit: r2(press.crit / Math.max(1, press.n)), boss: r2(press.boss / Math.max(1, press.n)) },
    windows, sessions,
    meta_end: { fame: Math.round(s.fame || 0), embers: Math.round(s.embers || 0), heatWon: s.heatWon, hall: Object.values(s.legacy || {}).reduce((a, b) => a + b, 0), town: Object.values(s.bld || {}).reduce((a, b) => a + b, 0), stars: Object.values(s.nodes || {}).reduce((a, b) => a + b, 0), codex: Object.keys(s.codex || {}).length, deeds: Object.keys(s.deeds || {}).length + Object.keys(s.ach || {}).length },
    stats: { choices: G.botStats.choices, autos: G.botStats.autos },
  };
}

// A simple crafter: whetstones and grace on the weapon, flux on a worn item with weak affixes
function craft(G) {
  const h = G.S.hero, w = h.eq.weapon;
  if (!w) return;
  if (h.orbs.whet > 0 && !G.orbBlock('whet', w)) G.useOrb('whet', w);
  for (const s of G.SLOTS) { const g = h.eq[s]; if (g && h.orbs.grace > 0 && !G.orbBlock('grace', g)) { G.useOrb('grace', g); break; } }
  for (const s of G.SLOTS) { const g = h.eq[s]; if (g && h.orbs.ascent > 0 && !G.orbBlock('ascent', g)) { G.useOrb('ascent', g); break; } }
}
// every persona x seeds in parallel (one child process a job)
function all(seeds, minutes, opts) {
  const jobs = [];
  for (const p of Object.keys(PERSONAS)) for (let sd = 1; sd <= seeds; sd++) jobs.push([p, sd]);
  const results = [];
  let next = 0;
  const workers = +process.env.PT_WORKERS || Math.max(2, Math.min(8, require('os').cpus().length));
  return new Promise(done => {
    const launch = () => {
      if (next >= jobs.length) { if (results.length === jobs.length) done(results); return; }
      const [p, sd] = jobs[next++];
      execFile(process.execPath, [__filename, p, String(sd), String(minutes), JSON.stringify(opts || {})], { maxBuffer: 1e8 }, (err, out) => {
        let o = null; try { o = JSON.parse(out); } catch (e) { err = err || e; }
        results.push(err ? { persona: p, seed: sd, error: String(err).slice(0, 300) } : o);
        launch();
      });
    };
    for (let i = 0; i < workers; i++) launch();
  });
}
// the report of a set of jobs (tools/siege.js's aggregate, per persona)
function report(results) {
  const { report: rep } = require('./siege');
  return rep(results.map(j => Object.assign({ cell: j.persona }, j)));
}

if (require.main === module) {
  const [who = 'all', a, b, c] = process.argv.slice(2);
  const opts = c ? JSON.parse(c) : {};
  if (who === 'all') all(+(a || 4), +(b || 60), opts).then(res => {
    require('fs').writeFileSync(path.join(__dirname, '..', 'playtest-results.json'), JSON.stringify(res, null, 1));
    console.log(report(res));
  });
  else process.stdout.write(JSON.stringify(run(who, +(a || 1), +(b || 60), opts)));
}
module.exports = { run, report, all, PERSONAS, BIG };
