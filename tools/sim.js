// Headless balance simulator (4.0, the Siege): one persona plays one or more Sieges and prints a pacing timeline, a
// line a game-minute (depth, zone, Integrity, the Button's health, level, party, gold, Embers in the pouch, the Horde's
// size, boss fights) plus every run's end. For the broad numbers use tools/siege.js; this is the magnifying glass.
//   node tools/sim.js [minutes=60] [persona=active] [seed=1] [optsJSON]      opts as tools/playtest.js's
//   env DBG=1: a damage line a minute (hero dps, mob and boss health, the clear-bar floor, hordeScale)
'use strict';
const pt = require('./playtest');
const bot = require('./bot');

const [minS = '60', persona = 'active', seedS = '1', optsS] = process.argv.slice(2);
const MIN = +minS, seed = +seedS, opts = optsS ? JSON.parse(optsS) : {};
const log = [];
let W = null;
// (the timeline hooks ride on tools/playtest.js's world: makeWorld is wrapped for this process only)
const orig = bot.makeWorld;
bot.makeWorld = function (sd) {
  W = orig(sd);
  const { G, clock } = W;
  const S = () => G.S;
  let nextLog = 60, bossTries = 0, bossFails = 0, bossT0 = 0;
  const bossDur = [];
  G.on('bossStart', b => { bossTries++; bossT0 = clock.now; log.push(`${tm()} BOSS ${b.kind} d${b.d}${b.affix && b.affix.length ? ' [' + b.affix.join(',') + ']' : ''} floor ${Math.round(b.t)}s`); });
  G.on('bossFail', b => { bossFails++; log.push(`${tm()}   lost (${(100 * Math.max(0, b.hp) / b.max).toFixed(0)}% left)`); });
  G.on('bossWin', (rew, b) => { bossDur.push(clock.now - bossT0); log.push(`${tm()}   won in ${(clock.now - bossT0).toFixed(1)}s`); });
  G.on('pip', (d, pips, why, kind) => log.push(`${tm()} PIP ${kind} (${why}) -> ${pips}`));
  G.on('cardPicked', c => log.push(`${tm()} card ${c.id}${c.rank ? ' r' + c.rank : ''} (${c.tierName || ''}${c.evo ? ' EVOLUTION' : ''}, ${c.why}, ${c.how})`));
  G.on('lootTake', (i, c, who, info, v) => log.push(`${tm()} loot ${v ? v.name : c.g.id} r${c.g.r} il${c.g.il}${c.g.q ? ' UNIQUE' : ''} -> ${who === 'bag' ? 'bag' : who === -1 ? 'Warden' : 'ally ' + who} ${v && v.up ? '▲' + Math.round(v.pct * 100) + '%' : ''}`));
  G.on('lootBurn', (out, tot) => log.push(`${tm()}   burned ${out.length} -> +${tot.toFixed(1)} Embers`));
  G.on('campAct', k => log.push(`${tm()} CAMP ${k}`));
  G.on('campRecruit', x => log.push(`${tm()}   recruit ${x.cls} (${x.trait})`));
  G.on('campBuy', w => log.push(`${tm()}   buy ${w.k}`));
  G.on('door', (o, slot, vault) => log.push(`${tm()} DOOR ${o.name} (${o.mod || 'calm'} / ${o.tag || '-'})${vault ? ' via the Vault' : ''}`));
  G.on('relicPick', id => log.push(`${tm()} RELIC ${id}`));
  G.on('shrineUse', (s, how) => log.push(`${tm()} shrine ${s.kind}${s.kind === 'fury' ? ':' + s.k : ''} (${how})`));
  G.on('boon', id => log.push(`${tm()}   boon ${id}`));
  G.on('pact', (id, yes) => log.push(`${tm()}   pact ${id} ${yes ? 'ACCEPTED' : 'declined'}`));
  G.on('evolve', e => log.push(`${tm()} EVOLUTION ${e}`));
  G.on('deed', d => log.push(`${tm()} deed ${d.id || d}`));
  G.on('lastStand', () => log.push(`${tm()} LAST STAND`));
  G.on('madButton', () => log.push(`${tm()} THE MAD BUTTON`));
  G.on('runStart', r => log.push(`${tm()} === SIEGE ${r.n}: ${r.btn} / ${r.cls} / Heat ${r.heat}${r.keeps.length ? ' / keepsakes ' + r.keeps.join(',') : ''} -> ${G.REALMS[r.route[0]].id}`));
  G.on('runSummary', s => log.push(`${tm()} === ${s.kind.toUpperCase()} at zone ${s.cleared} (${s.land}): ${(s.secs / 60).toFixed(1)} min, Fame ${Math.round(s.fame.total)}, Embers ${Math.round(s.embers.total)}, lvl ${s.lvl}, evos ${s.evos.length}, cards ${s.cardsN}${s.cause ? ', cause ' + s.cause : ''}`));
  const tm = () => String((clock.now / 60).toFixed(1)).padStart(5) + 'm';
  const tk = G.tick;
  G.tick = dt => {
    const out = tk(dt);
    if (clock.now >= nextLog) {
      nextLog += 60;
      const s = S(), r = s.run, D = G.D;
      if (r && r.on) log.push(`${tm()} d${s.depth} zone ${r.cleared}/18 pips ${r.pips}/${r.pipMax} hp ${(100 * s.hero.hp / Math.max(1, D.heroHp)).toFixed(0)}% lvl ${s.hero.lvl} party ${s.party.length} gold ${G.fmt(s.gold)} pouch ${Math.round(r.pouch || 0)} mobs ${G.R.mobs.length} boss ${bossTries - bossFails}/${bossTries} ${r.phase !== 'field' ? '[' + r.phase + ']' : ''}`
        + (process.env.DBG ? ` | dps ${G.fmt(D.heroDps)} mobHp ${G.fmt(G.mobHp(s.depth))} bossHp ${G.fmt(G.bossHp(s.depth))} hs ${G.hordeScale().toFixed(2)} fight ${bossDur.length ? (bossDur.slice(-6).reduce((a, b) => a + b, 0) / Math.min(6, bossDur.length)).toFixed(1) + 's' : '-'}` : ''));
    }
    return out;
  };
  return W;
};
const res = pt.run(persona, seed, MIN, opts);
console.log(log.join('\n'));
console.log(`\n${res.runs.length} runs ended (${res.runs.filter(r => r.win).length} wins)` + (res.cur ? `; one on at zone ${res.cur.cleared}, ${res.cur.pips} pips, ${res.cur.min} min` : ''));
console.log('choices/min ' + (res.runs.length ? res.runs.map(r => r.choicesPerMin).join(' ') : '-') + ' | autos/min ' + (res.runs.length ? res.runs.map(r => r.autosPerMin).join(' ') : '-') + ' | choices ' + res.stats.choices + ' autos ' + res.stats.autos);
