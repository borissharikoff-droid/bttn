// Local test of the ladder server: runs server/src/worker.js against an
// in-memory SQLite that mimics Cloudflare D1. Usage: node tools/test-server.js
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const sqlite = new DatabaseSync(':memory:');
sqlite.exec(readFileSync(path.join(root, 'server/schema.sql'), 'utf8'));
const DB = {
  prepare(sql) {
    let args = [];
    const st = {
      bind(...a) { args = a; return st; },
      async first() { return sqlite.prepare(sql).get(...args) ?? null; },
      async all() { return { results: sqlite.prepare(sql).all(...args) }; },
      async run() { sqlite.prepare(sql).run(...args); return { success: true }; },
    };
    return st;
  },
};
const env = { DB, SECRET: 'test-secret', ALLOW_ORIGIN: '*', SEASON: '1' };
const worker = (await import(path.join(root, 'server/src/worker.js'))).default;
const G = globalThis.G;

let failed = 0;
const call = async (method, p, body, token) => {
  const r = await worker.fetch(new Request('http://x' + p, {
    method, body: body ? JSON.stringify(body) : undefined,
    headers: Object.assign({ 'content-type': 'application/json' }, token ? { authorization: 'Bearer ' + token } : {}),
  }), env);
  return { status: r.status, body: await r.json() };
};
const check = (name, ok, extra) => { console.log((ok ? 'ok  ' : 'FAIL') + ' ' + name + (extra ? ' ' + JSON.stringify(extra) : '')); if (!ok) failed++; };

const a = await call('POST', '/api/auth');
check('auth issues a token', a.status === 200 && a.body.token);
const tok = a.body.token;
check('rejects a forged token', (await call('GET', '/api/me', null, a.body.id + '.forged')).status === 401);
check('me', (await call('GET', '/api/me', null, tok)).body.id === a.body.id);

G.S = G.newState(); G.recalc(); G.chooseClass('archer');
const saveStr = G.serialize();
check('save upload', (await call('PUT', '/api/save', { data: saveStr, ts: 123 }, tok)).status === 200);
const back = await call('GET', '/api/save', null, tok);
check('save download matches', back.body.save && back.body.save.data === saveStr);
check('rejects junk save', (await call('PUT', '/api/save', { data: '{"nope":1}' }, tok)).status === 400);

const snap = G.ladderSnapshot();
snap.name = 'Archeress';
let r = await call('PUT', '/api/ladder', snap, tok);
check('honest snapshot accepted', r.status === 200 && r.body.power === snap.power, r.body);

const b = (await call('POST', '/api/auth')).body.token;
const cheat = JSON.parse(JSON.stringify(snap)); cheat.gear.weapon.e = 99;
r = await call('PUT', '/api/ladder', cheat, b);
check('impossible enchant rejected', r.status === 422 && r.body.problems.includes('weapon:enchant'), r.body);
const cheat2 = JSON.parse(JSON.stringify(snap)); cheat2.power = 9e15;
r = await call('PUT', '/api/ladder', cheat2, b);
check('inflated power rejected', r.status === 422 && r.body.problems.includes('power'), r.body);
const cheat3 = JSON.parse(JSON.stringify(snap)); cheat3.gear.weapon.il = 500;
r = await call('PUT', '/api/ladder', cheat3, b);
check('item level above depth rejected', r.status === 422 && r.body.problems.includes('weapon:ilvl'), r.body);
r = await call('PUT', '/api/ladder', snap, tok);
check('too frequent update throttled', r.status === 429);

const c = (await call('POST', '/api/auth')).body.token;
const deep = JSON.parse(JSON.stringify(snap)); deep.depth = 12; deep.lvl = 20; deep.name = 'Sir Clicks'; deep.power = G.ladderPower(deep);
check('second player accepted', (await call('PUT', '/api/ladder', deep, c)).status === 200);
const lad = await call('GET', '/api/ladder?limit=10');
check('ladder sorted by depth', lad.body.entries.length === 2 && lad.body.entries[0].depth === 12, lad.body.entries.map(e => [e.name, e.depth, e.power]));
const ladP = await call('GET', '/api/ladder?by=power');
check('ladder by power works', ladP.status === 200 && ladP.body.entries.length === 2);
check('unauthorized write refused', (await call('PUT', '/api/ladder', snap)).status === 401);

console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
process.exit(failed ? 1 : 0);
