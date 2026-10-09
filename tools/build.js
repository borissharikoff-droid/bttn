// Builds single-file versions of the game:
//   dist/bttn.html     — standalone page (open locally, host anywhere, itch.io)
//   dist/artifact.html — the same page body without <html>/<head>/<body> wrappers
//   docs/index.html    — the standalone page again, for the public site on GitHub Pages
//   dist/steam.html    — only with --target steam: the page for the Steam wrapper (steam/), with
//                        window.BTTN_PLATFORM = 'steam' and steam/bridge.js (save file, carry-over, achievements)
//   dist/<portal>/index.html — only with --target yandex|vk|telegram: the page a portal hosts itself (a Yandex Games
//                        zip, VK Mini Apps hosting, a static Telegram Mini App), with window.BTTN_PLATFORM = '<portal>'
//                        and window.BTTN_API = the public host (--api https://… or BTTN_API), where the store, the
//                        Daily board and the anonymous stats live; without it those stay off. Yandex gets its
//                        '/sdk.js' tag (its moderation looks for it); VK and Telegram load their SDKs from js/store.js.
// Usage: node tools/build.js            (the web build: dist/bttn.html, dist/artifact.html, docs/, server/src/game.js)
//        node tools/build.js --target steam   (writes dist/steam.html and nothing else)
//        node tools/build.js --target yandex --api https://bttn.example   (writes dist/yandex/index.html and nothing else)
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const html = read('index.html');

// CSS with fonts inlined as data URIs
let css = read('css/style.css').replace(/url\('\.\.\/fonts\/([^']+)'\)/g, (m, f) => {
  const b64 = fs.readFileSync(path.join(root, 'fonts', f)).toString('base64');
  return `url(data:font/woff2;base64,${b64})`;
});

const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const js = scripts.map(src => `/* ${src} */\n` + read(src)).join('\n');
const safeJs = js.replace(/<\/script/gi, '<\\/script');

const body = html.slice(html.indexOf('<!--BODY-->') + '<!--BODY-->'.length, html.indexOf('<!--/BODY-->')).trim();
const title = (html.match(/<title>([^<]*)<\/title>/) || [, 'BTTN'])[1];
const desc = (html.match(/<meta name="description" content="([^"]*)">/) || [, ''])[1];

const standalone = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="${desc}">
<style>
${css}
</style>
</head>
<body>
${body}
<script>
${safeJs}
</script>
</body>
</html>
`;

const artifact = `<title>${title}</title>
<style>
${css}
</style>
${body}
<script>
${safeJs}
</script>
`;

// 4.0: build targets. The default (web) writes what it always wrote; 'steam' writes dist/steam.html only.
const argv = process.argv.slice(2);
const target = (argv.find(a => a.startsWith('--target=')) || '').slice(9) || (argv.includes('--target') ? argv[argv.indexOf('--target') + 1] : '') || 'web';
if (target === 'steam') {
  // the bridge runs before the game's scripts; the achievement map comes from steam/achievements.json
  let achMap = {};
  try { (JSON.parse(read('steam/achievements.json')).achievements || []).forEach(a => { if (a && a.id && /^[A-Z0-9_]{1,64}$/.test(a.api)) achMap[a.id] = a.api; }); } catch (e) { achMap = {}; }
  const bridge = read('steam/bridge.js').replace(/<\/script/gi, '<\\/script');
  // no network but Twitch chat (streamer mode) and https links; everything else is inline or a data: URL
  const csp = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src https: wss://irc-ws.chat.twitch.tv; base-uri 'none'; form-action 'none'";
  const head = `<meta http-equiv="Content-Security-Policy" content="${csp}">
<script>window.BTTN_PLATFORM = 'steam'; window.BTTN_STEAM_ACH = ${JSON.stringify(achMap).replace(/</g, '\\u003c')};</script>
<script>
${bridge}
</script>`;
  if (!standalone.includes('</head>')) throw new Error('no </head> in the page');
  const steam = standalone.replace('</head>', () => head + '\n</head>');
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(root, 'dist', 'steam.html'), steam);
  console.log('dist/steam.html', (Buffer.byteLength(steam) / 1024).toFixed(1) + ' KB', Object.keys(achMap).length + ' Steam achievements');
  process.exit(0);
}
// 4.0 (platform-fix): the portal builds. Same page as the web build, plus the platform flag and where the host is.
const PORTALS = { yandex: '<script src="/sdk.js"></script>', vk: '', telegram: '' };
if (Object.prototype.hasOwnProperty.call(PORTALS, target)) {
  const apiArg = (argv.find(a => a.startsWith('--api=')) || '').slice(6) || (argv.includes('--api') ? argv[argv.indexOf('--api') + 1] : '') || process.env.BTTN_API || '';
  let api = '';
  if (apiArg) {
    let u = null; try { u = new URL(apiArg); } catch (e) {}
    if (!u || u.protocol !== 'https:' || u.username || u.password || (u.pathname !== '/' && u.pathname !== '')) { console.error('--api must be an https origin (https://host), got ' + apiArg); process.exit(1); }
    api = u.origin;
  } else console.warn('no --api: the store, the Daily board and the stats stay off in this build');
  const flags = { BTTN_PLATFORM: target };
  if (api) { flags.BTTN_API = api; flags.BTTN_AN = api + '/api/ev'; }
  const head = `<script>${Object.keys(flags).map(k => `window.${k} = ${JSON.stringify(flags[k]).replace(/</g, '\\u003c')};`).join(' ')}</script>${PORTALS[target] ? '\n' + PORTALS[target] : ''}`;
  if (!standalone.includes('</head>')) throw new Error('no </head> in the page');
  const page = standalone.replace('</head>', () => head + '\n</head>');
  fs.mkdirSync(path.join(root, 'dist', target), { recursive: true });
  fs.writeFileSync(path.join(root, 'dist', target, 'index.html'), page);
  console.log('dist/' + target + '/index.html', (Buffer.byteLength(page) / 1024).toFixed(1) + ' KB', api ? 'host ' + api : 'no host');
  process.exit(0);
}
if (target !== 'web') { console.error('unknown --target ' + target + ' (web, steam, yandex, vk, telegram)'); process.exit(1); }

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'bttn.html'), standalone);
fs.writeFileSync(path.join(root, 'dist', 'artifact.html'), artifact);
// the public site (GitHub Pages serves docs/ from this branch): the standalone page as its index
fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs', 'index.html'), standalone);
fs.writeFileSync(path.join(root, 'docs', '.nojekyll'), '');
// Game logic for the ladder server (same code, no DOM)
const serverGame = '// Generated by tools/build.js — do not edit. Game logic shared with the client.\n' +
  ['js/util.js', 'js/data.js', 'js/game.js', 'js/hero.js', 'js/relic.js'].map(f => `/* ${f} */\n` + read(f)).join('\n');
fs.writeFileSync(path.join(root, 'server', 'src', 'game.js'), serverGame);
const kb = s => (Buffer.byteLength(s) / 1024).toFixed(1) + ' KB';
console.log('dist/bttn.html', kb(standalone));
console.log('dist/artifact.html', kb(artifact));
