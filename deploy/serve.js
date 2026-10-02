// BTTN — a tiny static server for hosting the built game (Railway, Render, any Node host).
// Serves docs/index.html (the standalone single-file game) on $PORT. No dependencies.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const FILE = path.join(__dirname, '..', 'docs', 'index.html');
let page = fs.readFileSync(FILE);

http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];
  if (url === '/health') { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('ok'); return; }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
  // one page: every path gets the game
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff' });
  res.end(req.method === 'HEAD' ? undefined : page);
}).listen(PORT, () => console.log('BTTN on port ' + PORT));
