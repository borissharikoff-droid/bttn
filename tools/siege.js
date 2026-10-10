// The Siege measurement CLI (4.0): persona bots play Sieges in parallel cells (persona x meta tier x Heat), and the numbers
// come out as the DESIGN §14 acceptance-gate table plus the per-cell metrics of §13 item 16 (run length, fall depth
// histogram, win % by run index and meta tier, evolutions a run, picks, Button < 50%, choices and automatic actions a
// minute, chests and labels a minute, Embers and Fame a run, loot moments and their seconds, cause of death).
//
//   node tools/siege.js gates [--seeds 4] [--minutes 90] [--workers 3] [--label gates] [--only A0,T0] [--tune '{"mobGrowth":1.64}']
//       the §14 cells (see CELLS), then the gate table; results in <out>/<label>.json, .txt and .md
//   node tools/siege.js sweep <label> <cells.json | '[{...}]'> [--seeds n] [--minutes m] [--workers w] [--tune JSON]
//       your own cells: { name, persona, opts: tools/playtest.js opts ({meta, heat, grow, clockwork, tune, po, pol, eval...}) }
//   node tools/siege.js report <label | file.json> [--md]      re-print a saved sweep (the metrics, and the gates when the
//       cells carry gate ids)
//   node tools/siege.js cells                                     print the preset cells
//   --out <dir>: where results go (default $SIEGE_OUT or <tmp>/bttn-siege)
// One job = `node tools/playtest.js <persona> <seed> <minutes> <optsJSON>` in a child process; its JSON is kept whole.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFile } = require('child_process');

const OUT_DEFAULT = process.env.SIEGE_OUT || path.join(os.tmpdir(), 'bttn-siege');
// the DESIGN §14 cells. gate: the gate ids this cell feeds (GATES below)
const CELLS = [
  { name: 'A0', title: 'active, no meta, Heat 0', persona: 'active', opts: { meta: 'none', heat: 0 } },
  { name: 'AF5', title: 'active, full meta, Heat 5', persona: 'active', opts: { meta: 'full', heat: 5 } },
  { name: 'AF6', title: 'active, full meta, Heat 6', persona: 'active', opts: { meta: 'full', heat: 6 } },
  { name: 'AF7', title: 'active, full meta, Heat 7', persona: 'active', opts: { meta: 'full', heat: 7 } },
  { name: 'AF8', title: 'active, full meta, Heat 8', persona: 'active', opts: { meta: 'full', heat: 8 } },
  { name: 'T0', title: 'attentive casual, no meta, Heat 0', persona: 'attentive', opts: { meta: 'none', heat: 0 } },
  { name: 'T3', title: 'attentive casual, 1/3 meta, Heat 0', persona: 'attentive', opts: { meta: 'third', heat: 0 } },
  { name: 'TF', title: 'attentive casual, full meta, Heat 0', persona: 'attentive', opts: { meta: 'full', heat: 0 } },
  { name: 'CF', title: 'half-attentive casual (duty 0.6), full meta, Heat 0', persona: 'casual', opts: { meta: 'full', heat: 0 } },
  { name: 'I', title: 'idle + Clockwork + Auto-Run, no meta, Heat 0', persona: 'idle', opts: { meta: 'none', heat: 0, clockwork: 1 } },
];
const med = a => { const s = a.filter(x => x != null && !Number.isNaN(x)).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const mean = a => { const s = a.filter(x => x != null); return s.length ? s.reduce((x, y) => x + y, 0) / s.length : null; };
const pct = (a, b) => (b ? Math.round(100 * a / b) : null);
const r1 = x => (x == null ? null : Math.round(x * 10) / 10);
const r2 = x => (x == null ? null : Math.round(x * 100) / 100);
const fmt = (x, d) => (x == null ? '-' : typeof x === 'number' ? (d != null ? x.toFixed(d) : String(x)) : String(x));

// ---------- the metrics of one cell (its jobs' runs pooled) ----------
function aggregate(jobs) {
  const ok = jobs.filter(j => j.out && !j.err && !j.out.error);
  const runs = ok.flatMap(j => j.out.runs.map(r => Object.assign({ seed: j.seed }, r)));
  const mins = ok.reduce((a, j) => a + (j.out.minutes || 0), 0);
  const wins = runs.filter(r => r.kind === 'win'), falls = runs.filter(r => r.kind === 'fall'), exts = runs.filter(r => r.kind === 'extract');
  const byIndex = {};
  for (const r of runs) { const k = r.n >= 4 ? '4+' : String(r.n); (byIndex[k] = byIndex[k] || { n: 0, w: 0 }).n++; if (r.win) byIndex[k].w++; }
  const firstWin = ok.map(j => { const i = j.out.runs.findIndex(r => r.kind === 'win'); return i < 0 ? null : j.out.runs[i].n; });
  const hist = {};
  for (const r of falls) hist[r.cleared] = (hist[r.cleared] || 0) + 1;
  const causes = {};
  for (const r of falls) { const k = (r.cause || 'none') + '@' + (r.fallKind || 'zone'); causes[k] = (causes[k] || 0) + 1; }
  const act2 = runs.filter(r => r.cleared >= 6);
  const fieldMin = runs.reduce((a, r) => a + r.field, 0) || 0.01;
  // runs an hour: the finished runs over the minutes played (an unfinished last run counts as its share of a median run)
  const part = ok.reduce((a, j) => a + (j.out.cur && j.out.cur.min && runs.length ? Math.min(1, j.out.cur.min / (med(runs.map(r => r.min)) || 1)) : 0), 0);
  const embIn = (lo, hi) => pct(runs.filter(r => r.embers >= lo && r.embers <= hi).length, runs.length);
  return {
    jobs: jobs.length, ok: ok.length, errors: jobs.filter(j => j.err || (j.out && j.out.error)).map(j => ({ seed: j.seed, err: j.err || j.out.error })),
    minutes: mins, runs: runs.length, wins: wins.length, falls: falls.length, extracts: exts.length,
    winPct: pct(wins.length, runs.length), extPct: pct(exts.length, runs.length),
    byIndex: Object.fromEntries(Object.entries(byIndex).map(([k, v]) => [k, { n: v.n, winPct: pct(v.w, v.n) }])),
    firstWin, firstWinMax: firstWin.some(x => x == null) ? null : Math.max(...firstWin),
    depthMed: med(runs.map(r => r.cleared)), fallHist: hist, fallsLand1: pct(falls.filter(r => r.fallSlot === 0).length, falls.length),
    fallsLord: pct(falls.filter(r => ['lord', 'act', 'final'].includes(r.fallKind)).length, falls.length), causes,
    runMin: med(runs.map(r => r.min)), winMin: med(wins.map(r => r.min)), winField: med(wins.map(r => r.field)), winWall: med(wins.map(r => r.wall)), fallMin: med(falls.map(r => r.min)),
    runsPerHour: mins ? r2(60 * runs.length / mins) : null, runsPerHourPart: mins ? r2(60 * (runs.length + part) / mins) : null,
    evoMean: r2(mean(runs.map(r => r.evos))), evo1Act2: pct(act2.filter(r => r.evos >= 1).length, act2.length), evo2Wins: pct(wins.filter(r => r.evos >= 2).length, wins.length),
    picks: med(runs.map(r => r.picks)), cards: med(runs.map(r => r.cards)),
    low: r2(med(runs.map(r => r.low))), lowMean: r2(mean(runs.map(r => r.low))),
    choicesPerMin: r2(med(runs.map(r => r.choicesPerMin))), autosPerMin: r2(med(runs.map(r => r.autosPerMin))),
    chestsPerMin: r2(runs.reduce((a, r) => a + r.chests, 0) / fieldMin), labelsPerMin: r2(runs.reduce((a, r) => a + r.labels, 0) / fieldMin),
    embers: { all: med(runs.map(r => r.embers)), win: med(wins.map(r => r.embers)), fall: med(falls.map(r => r.embers)), extract: med(exts.map(r => r.embers)),
      first: med(runs.filter(r => r.n === 1).map(r => r.embers)), early: med(falls.filter(r => r.cleared <= 8).map(r => r.embers)), act2fall: med(falls.filter(r => r.cleared >= 6 && r.cleared <= 11).map(r => r.embers)),
      act2ext: med(exts.filter(r => r.cleared >= 6 && r.cleared <= 12).map(r => r.embers)), in60_150: embIn(60, 150), perHour: mins ? Math.round(60 * runs.reduce((a, r) => a + r.embers, 0) / mins) : null },
    fame: { all: med(runs.map(r => r.fame)), win: med(wins.map(r => r.fame)), fall: med(falls.map(r => r.fame)), first: med(runs.filter(r => r.n === 1).map(r => r.fame)) },
    loots: med(runs.map(r => r.loots)), lootSecs: r2(med(runs.map(r => r.lootSecs))), lootSecsMax: r1(Math.max(0, ...runs.map(r => r.lootSecsMax || 0))), lootUltra: r2(mean(runs.map(r => r.lootUltra))),
    cardSecs: r2(med(runs.map(r => r.cardSecs))), campSecs: r2(med(runs.map(r => r.campSecs))),
    shrines: med(runs.map(r => r.shrines)), shrinesSeen: med(runs.map(r => r.shrinesSeen)), charged: med(runs.map(r => r.charged)),
    uniques: r2(mean(runs.map(r => r.uniques))), keys: r2(mean(runs.map(r => r.keys))), relics: r2(mean(runs.map(r => r.relics))), pacts: r2(mean(runs.map(r => r.pacts))), deeds: r2(mean(runs.map(r => r.deeds))),
    wipes: med(runs.map(r => r.wipes)), lordFails: med(runs.map(r => r.lordFails)), lordMed: r1(med(runs.map(r => r.lordMed))), bossMed: r1(med(runs.map(r => r.bossMed))),
    lvl: med(runs.map(r => r.lvl)), party: med(runs.map(r => r.party)), heat: med(runs.map(r => r.heat)), meta: ok.length ? ok[0].out.meta : null,
    cur: ok.map(j => j.out.cur).filter(Boolean),
  };
}
function cellLine(name, A) {
  const bi = Object.entries(A.byIndex).sort().map(([k, v]) => `${k}:${fmt(v.winPct)}%(${v.n})`).join(' ');
  const hist = Object.entries(A.fallHist).sort((a, b) => a[0] - b[0]).map(([d, n]) => `${d}x${n}`).join(' ');
  const causes = Object.entries(A.causes).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ');
  return [
    `${name.padEnd(4)} runs ${String(A.runs).padStart(3)} (${A.ok} jobs x ${A.ok ? Math.round(A.minutes / A.ok) : 0} min) | win ${fmt(A.winPct)}%${A.extPct ? ' ext ' + A.extPct + '%' : ''} | by run index ${bi} | first win ${A.firstWin.map(x => x == null ? '-' : x).join('/')} | depth med ${fmt(A.depthMed)} | runs/h ${fmt(A.runsPerHour)} (+part ${fmt(A.runsPerHourPart)})`,
    `     run min ${fmt(A.runMin)} (win ${fmt(A.winMin)}, field ${fmt(A.winField)}, wall ${fmt(A.winWall)}; fall ${fmt(A.fallMin)}) | falls: land1 ${fmt(A.fallsLand1)}% lord/act/mad ${fmt(A.fallsLord)}% | fall depth hist ${hist || '-'} | causes ${causes || '-'}`,
    `     evos ${fmt(A.evoMean)}/run, >=1 in Act II+ ${fmt(A.evo1Act2)}%, >=2 in wins ${fmt(A.evo2Wins)}% | picks ${fmt(A.picks)} cards ${fmt(A.cards)} | Button<50% ${fmt(A.low)} (mean ${fmt(A.lowMean)}) | choices/min ${fmt(A.choicesPerMin)} autos/min ${fmt(A.autosPerMin)} | chests/min ${fmt(A.chestsPerMin)} labels/min ${fmt(A.labelsPerMin)}`,
    `     Embers med ${fmt(A.embers.all)} (win ${fmt(A.embers.win)}, fall ${fmt(A.embers.fall)}, extract ${fmt(A.embers.extract)}; run 1 ${fmt(A.embers.first)}, early fall ${fmt(A.embers.early)}, Act II fall ${fmt(A.embers.act2fall)}, Act II extract ${fmt(A.embers.act2ext)}; in 60-150: ${fmt(A.embers.in60_150)}%; /h ${fmt(A.embers.perHour)}) | Fame med ${fmt(A.fame.all)} (win ${fmt(A.fame.win)}, fall ${fmt(A.fame.fall)}, run 1 ${fmt(A.fame.first)})`,
    `     loot moments ${fmt(A.loots)}/run, ${fmt(A.lootSecs)} s each (max ${fmt(A.lootSecsMax)}), ultra ${fmt(A.lootUltra)}/run | card ${fmt(A.cardSecs)} s, camp ${fmt(A.campSecs)} s | shrines ${fmt(A.shrines)}/${fmt(A.shrinesSeen)} seen (charged ${fmt(A.charged)}) | uniques ${fmt(A.uniques)} keys ${fmt(A.keys)} relics ${fmt(A.relics)} pacts ${fmt(A.pacts)} deeds ${fmt(A.deeds)} | wipes ${fmt(A.wipes)} lordF ${fmt(A.lordFails)} lord ${fmt(A.lordMed)} s boss ${fmt(A.bossMed)} s | lvl ${fmt(A.lvl)} party ${fmt(A.party)}`
      + (A.errors.length ? ` | ERRORS ${A.errors.length}: ${A.errors.map(e => 's' + e.seed + ' ' + String(e.err).slice(0, 120)).join(' | ')}` : ''),
  ].join('\n');
}
// ---------- the DESIGN §14 gates ----------
// each: { id, gate (the row's text), target, cells (which cell names it reads; '*' = every Heat-0 cell pooled), value(by) ->
// { v (the measured number or text), pass (true | false | null = not measured) } }
const inBand = (v, lo, hi) => (v == null ? null : v >= lo && v <= hi);
const topHeat = by => {
  const hs = Object.entries(by).filter(([k]) => /^AF\d+$/.test(k)).map(([k, A]) => ({ h: +k.slice(2), w: A.winPct, n: A.runs })).filter(x => x.n > 0).sort((a, b) => a.h - b.h);
  if (!hs.length) return { v: null, pass: null };
  let top = null;
  for (const x of hs) if (x.w >= 35) top = x.h;
  const txt = hs.map(x => `H${x.h} ${x.w}% (${x.n})`).join(', ');
  return { v: `top ${top == null ? '<' + hs[0].h : top}: ${txt}`, pass: top != null && top >= 5 && top <= 7 };
};
const pooled = (by, names, f) => { const rs = []; for (const n of names) if (by[n]) rs.push(by[n]); return rs.length ? f(rs) : { v: null, pass: null }; };
const h0cells = by => Object.keys(by).filter(k => !/^AF\d+$/.test(k) && k !== 'I');
const GATES = [
  { id: 'a_win', gate: 'Active, no meta, Heat 0: win %', target: '50-80%', cells: ['A0'], value: by => { const A = by.A0; return { v: A ? `${A.winPct}% (${A.runs} runs)` : null, pass: A ? inBand(A.winPct, 50, 80) : null }; } },
  { id: 'a_first', gate: 'Active, first win by run', target: '<= 4 on every seed', cells: ['A0'], value: by => { const A = by.A0; return { v: A ? A.firstWin.map(x => x == null ? '-' : x).join('/') : null, pass: A ? A.firstWin.every(x => x != null && x <= 4) : null }; } },
  { id: 'a_heat', gate: 'Active, full meta: highest Heat with >= 35% wins', target: 'Heat 5-7', cells: ['AF5', 'AF6', 'AF7', 'AF8'], value: topHeat },
  { id: 't0', gate: 'Attentive casual, no meta: win %', target: '>= 10%', cells: ['T0'], value: by => { const A = by.T0; return { v: A ? `${A.winPct}% (${A.runs} runs${A.extPct ? ', ' + A.extPct + '% extracts' : ''})` : null, pass: A ? A.winPct >= 10 : null }; } },
  { id: 't3', gate: 'Attentive casual, 1/3 meta: win %', target: '>= 30%', cells: ['T3'], value: by => { const A = by.T3; return { v: A ? `${A.winPct}% (${A.runs} runs${A.extPct ? ', ' + A.extPct + '% extracts' : ''})` : null, pass: A ? A.winPct >= 30 : null }; } },
  { id: 'tf', gate: 'Attentive casual, full meta: win %', target: '>= 40%', cells: ['TF'], value: by => { const A = by.TF; return { v: A ? `${A.winPct}% (${A.runs} runs${A.extPct ? ', ' + A.extPct + '% extracts' : ''})` : null, pass: A ? A.winPct >= 40 : null }; } },
  { id: 'cf', gate: 'Half-attentive casual (duty 0.6), full meta: median depth', target: '>= 14 (Act III)', cells: ['CF'], value: by => { const A = by.CF; return { v: A ? `${A.depthMed} zones (${A.runs} runs, win ${A.winPct}%)` : null, pass: A ? A.depthMed >= 14 : null }; } },
  { id: 'idle', gate: 'Idle + Clockwork + Auto-Run: runs an hour / Embers a run', target: '>= 3 / 60-150', cells: ['I'], value: by => { const A = by.I; return { v: A ? `${A.runsPerHour}/h (+part ${A.runsPerHourPart}), Embers med ${A.embers.all} (${A.embers.in60_150}% in band), ${A.extPct}% extracts` : null, pass: A ? (A.runsPerHour >= 3 || A.runsPerHourPart >= 3) && inBand(A.embers.all, 60, 150) : null }; } },
  { id: 'land1', gate: 'Land-1 falls', target: '0%', cells: ['*'], value: by => pooled(by, h0cells(by), rs => { const f = rs.reduce((a, A) => a + A.falls, 0), l1 = rs.reduce((a, A) => a + Math.round((A.fallsLand1 || 0) * A.falls / 100), 0); return { v: `${pct(l1, f)}% (${l1}/${f} falls)`, pass: f ? l1 === 0 : null }; }) },
  { id: 'lordfall', gate: 'Falls at a lord or the Mad Button', target: '>= 70% of falls', cells: ['*'], value: by => pooled(by, h0cells(by), rs => { const f = rs.reduce((a, A) => a + A.falls, 0), l = rs.reduce((a, A) => a + Math.round((A.fallsLord || 0) * A.falls / 100), 0); return { v: `${pct(l, f)}% (${l}/${f})`, pass: f ? pct(l, f) >= 70 : null }; }) },
  { id: 'evo', gate: 'Evolutions', target: '>= 1 in 60% of Act II+ runs; >= 2 in wins', cells: ['A0', 'T0', 'T3', 'TF'], value: by => pooled(by, ['A0', 'T0', 'T3', 'TF'].filter(k => by[k]), rs => { const a = rs.map(A => `${A.evo1Act2}%/${A.evo2Wins}%`).join(' '); const A = by.A0 || rs[0]; return { v: `(>=1 Act II+ / >=2 wins) ${a}; active ${A.evoMean}/run`, pass: A.evo1Act2 != null && A.evo1Act2 >= 60 && (A.evo2Wins == null || A.evo2Wins >= 50) }; }) },
  { id: 'low', gate: "Button < 50% at the persona's top Heat", target: '10-20% of field time', cells: ['A0', 'AF*'], value: by => { const tops = Object.keys(by).filter(k => /^AF\d+$/.test(k) && by[k].winPct >= 35).sort((a, b) => +b.slice(2) - +a.slice(2)); const A = by[tops[0]] || by.A0; return A ? { v: `${Math.round(A.low * 100)}% (${tops[0] || 'A0'}; mean ${Math.round(A.lowMean * 100)}%)`, pass: inBand(A.low * 100, 10, 20) } : { v: null, pass: null }; } },
  { id: 'choices', gate: 'Real choices a minute (active)', target: '>= 3', cells: ['A0'], value: by => { const A = by.A0; return { v: A ? `${A.choicesPerMin} (attentive ${by.T0 ? by.T0.choicesPerMin : '-'}, casual ${by.CF ? by.CF.choicesPerMin : '-'})` : null, pass: A ? A.choicesPerMin >= 3 : null }; } },
  { id: 'autos', gate: 'Automatic actions a minute (Auto-invest excluded)', target: '< 30', cells: ['*'], value: by => { const ks = Object.keys(by); const m = Math.max(...ks.map(k => by[k].autosPerMin || 0)); return ks.length ? { v: ks.map(k => `${k} ${by[k].autosPerMin}`).join(', '), pass: m < 30 } : { v: null, pass: null }; } },
  { id: 'chests', gate: 'Chests a minute / rare+ labels a minute (active)', target: '2-4 / <= 5', cells: ['A0'], value: by => { const A = by.A0; return { v: A ? `${A.chestsPerMin} / ${A.labelsPerMin}` : null, pass: A ? inBand(A.chestsPerMin, 2, 4) && A.labelsPerMin <= 5 : null }; } },
  { id: 'wall', gate: 'Active win, wall time', target: '15-20 min', cells: ['A0'], value: by => { const A = by.A0; return { v: A ? `${A.winWall} min (field ${A.winField}, bot ${A.winMin})` : null, pass: A ? inBand(A.winWall, 15, 20) : null }; } },
  // (the §4.3 rows read the no-meta Heat-0 cells: 'first run' = an early fall (Act I or the start of Act II, as §4.2's
  // first-run example at depth 7), 'Act II fall' = a fall at zones 6-11, 'Act II extract' = an extract at zones 6-12 (the
  // casual's Camp 4), 'win' = the active's Heat-0 wins)
  { id: 'emb', gate: 'Embers (DESIGN §4.3): early fall / Act II fall / Act II extract / Heat-0 win', target: '60-100 / 120-200 / 250-400 / 1200-1500', cells: ['A0', 'T0', 'T3'], value: by => { const A = by.A0, T = by.T0 || by.T3; if (!A) return { v: null, pass: null }; const f1 = A.embers.early != null ? A.embers.early : T && T.embers.early, a2 = A.embers.act2fall != null ? A.embers.act2fall : T && T.embers.act2fall, ex = (T && T.embers.act2ext) || (by.T3 && by.T3.embers.act2ext) || (by.CF && by.CF.embers.act2ext), w = A.embers.win; const ps = [f1 == null ? null : inBand(f1, 60, 100), a2 == null ? null : inBand(a2, 120, 200), ex == null ? null : inBand(ex, 250, 400), inBand(w, 1200, 1500)]; return { v: `${fmt(f1)} / ${fmt(a2)} / ${fmt(ex)} / ${fmt(w)}`, pass: ps.every(p => p !== false) && ps.some(p => p === true) }; } },
  { id: 'boom', gate: 'BOOM -> field', target: '<= 60 s', cells: [], value: () => ({ v: 'UI (not measured here)', pass: null }) },
  { id: 'frame', gate: 'Last Stand frame time, mid tier, 600 mobs', target: '<= 16 ms', cells: [], value: () => ({ v: 'stage (tests/runflow/ls_frame.js)', pass: null }) },
];
function gateRows(by) {
  return GATES.map(g => { const r = g.value(by); return { id: g.id, gate: g.gate, target: g.target, v: r.v, pass: r.pass }; });
}
const mark = p => (p === true ? 'PASS' : p === false ? 'FAIL' : 'n/a');
function gateTable(by, md) {
  const rows = gateRows(by);
  if (md) return ['| Gate | Target | Measured | |', '|---|---|---|---|'].concat(rows.map(r => `| ${r.gate} | ${r.target} | ${r.v == null ? '(not measured)' : r.v} | ${mark(r.pass)} |`)).join('\n');
  return rows.map(r => `${mark(r.pass).padEnd(5)} ${r.gate.padEnd(62)} ${r.target.padEnd(42)} ${r.v == null ? '(not measured)' : r.v}`).join('\n');
}
// the whole report of a sweep's jobs (each: { cell, seed, out, err })
function byCell(res) {
  const groups = {};
  for (const j of res) (groups[j.cell] = groups[j.cell] || []).push(j);
  const by = {};
  for (const k in groups) by[k] = aggregate(groups[k]);
  return by;
}
function report(res, o) {
  o = o || {};
  const by = byCell(res);
  const lines = Object.keys(by).map(k => cellLine(k, by[k]));
  const gates = Object.keys(by).some(k => CELLS.some(c => c.name === k));
  if (gates) lines.push('', 'DESIGN §14 acceptance gates', gateTable(by, o.md));
  return lines.join('\n');
}
// ---------- the sweep ----------
function sweep(label, cells, o) {
  const seeds = o.seeds || 4, mins = o.minutes || 90, workers = o.workers || 3, out = o.out || OUT_DEFAULT;
  fs.mkdirSync(out, { recursive: true });
  const jobs = [];
  const seed0 = o.seed0 || 1;
  for (const c of cells) for (let s = seed0; s < seed0 + seeds; s++) jobs.push({ c, s });
  const res = [];
  let next = 0, done = 0;
  const t0 = Date.now();
  const log = m => { if (!o.quiet) console.error(m); };
  return new Promise(resolve => {
    const finish = () => {
      fs.writeFileSync(path.join(out, label + '.json'), JSON.stringify(res));
      const txt = `[${label}] ${jobs.length} jobs, ${seeds} seeds x ${mins} min, ${((Date.now() - t0) / 1000).toFixed(0)} s` + (o.tune ? ' tune ' + JSON.stringify(o.tune) : '') + '\n' + report(res);
      fs.writeFileSync(path.join(out, label + '.txt'), txt + '\n');
      fs.writeFileSync(path.join(out, label + '.md'), `# ${label} (${seeds} seeds x ${mins} min${o.tune ? ', tune ' + JSON.stringify(o.tune) : ''})\n\n` + report(res, { md: true }).split('\n').map(l => (l.startsWith('|') || !l.trim() || l.startsWith('DESIGN') ? l : '    ' + l)).join('\n') + '\n');
      console.log(txt);
      resolve(res);
    };
    const launch = () => {
      if (next >= jobs.length) return;
      const { c, s } = jobs[next++];
      const opts = Object.assign({}, c.opts || {});
      if (o.tune) opts.tune = Object.assign({}, o.tune, opts.tune || {});
      const args = [path.join(__dirname, 'playtest.js'), c.persona, String(s), String(mins), JSON.stringify(opts)];
      execFile(process.execPath, args, { maxBuffer: 2e8, env: Object.assign({}, process.env, { PT_TUT: process.env.PT_TUT || '1' }) }, (err, stdout, stderr) => {
        let outJ = null; try { outJ = JSON.parse(stdout); } catch (e) { err = err || e; }
        res.push({ cell: c.name, seed: s, out: outJ, err: err ? (String(err).slice(0, 300) + ' ' + String(stderr || '').slice(0, 300)) : null });
        done++;
        log(`  [${label}] ${done}/${jobs.length} ${c.name} s${s} ${err ? 'ERR' : outJ.runs.map(r => r.kind[0] + r.cleared).join(' ')} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
        if (done === jobs.length) finish(); else launch();
      });
    };
    for (let i = 0; i < Math.min(workers, jobs.length); i++) launch();
  });
}
function parseArgs(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const k = a.slice(2); const v = argv[i + 1]; if (v == null || v.startsWith('--')) o[k] = true; else { o[k] = v; i++; } }
    else o._.push(a);
  }
  for (const k of ['seeds', 'minutes', 'workers', 'seed0']) if (o[k] != null) o[k] = +o[k];
  if (o.tune) o.tune = JSON.parse(o.tune);
  return o;
}
if (require.main === module) {
  const o = parseArgs(process.argv.slice(2));
  const cmd = o._[0] || 'gates';
  const out = o.out || OUT_DEFAULT;
  if (cmd === 'cells') { console.log(JSON.stringify(CELLS, null, 1)); }
  else if (cmd === 'report') {
    const f = o._[1], file = f && f.endsWith('.json') ? f : path.join(out, (f || 'gates') + '.json');
    console.log(report(JSON.parse(fs.readFileSync(file, 'utf8')), { md: !!o.md }));
  } else if (cmd === 'gates') {
    const only = o.only ? String(o.only).split(',') : null;
    const cells = CELLS.filter(c => !only || only.includes(c.name));
    sweep(o.label || 'gates', cells, { seeds: o.seeds || 4, minutes: o.minutes || 90, workers: o.workers || 3, out, tune: o.tune, seed0: o.seed0, quiet: o.quiet });
  } else if (cmd === 'sweep') {
    const label = o._[1], spec = o._[2];
    if (!label || !spec) { console.error('node tools/siege.js sweep <label> <cells.json | JSON> [--seeds n] [--minutes m] [--workers w]'); process.exit(2); }
    const cells = JSON.parse(spec.trim().startsWith('[') ? spec : fs.readFileSync(spec, 'utf8'));
    sweep(label, cells, { seeds: o.seeds || 4, minutes: o.minutes || 60, workers: o.workers || 3, out, tune: o.tune, seed0: o.seed0, quiet: o.quiet });
  } else { console.error('commands: gates | sweep | report | cells'); process.exit(2); }
}
module.exports = { CELLS, GATES, aggregate, byCell, gateRows, gateTable, report, sweep, cellLine };
