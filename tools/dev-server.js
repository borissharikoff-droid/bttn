// Local ladder server for development: the Cloudflare Worker on Node's
// built-in SQLite. Usage: node tools/dev-server.js [port=8787]
// Then in the game: localStorage.setItem('bttn-api', 'http://localhost:8787')
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const sqlite = new DatabaseSync(path.join(root, 'server', 'dev.sqlite'));
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
const env = { DB, SECRET: 'dev-secret', ALLOW_ORIGIN: '*', SEASON: '1' };
const worker = (await import(path.join(root, 'server/src/worker.js'))).default;
const port = +(process.argv[2] || 8787);
createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const r = await worker.fetch(new Request('http://localhost:' + port + req.url, {
    method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
  }), env);
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(port, () => console.log('BTTN ladder dev server on http://localhost:' + port));
