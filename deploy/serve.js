// BTTN — the public host (Railway, Render, any Node host). No dependencies (Node 18+: fetch, crypto).
//  GET  /            the landing page (deploy/landing.html): the pitch and one big PLAY that carries the utm tags on
//  GET  /play        the game (docs/index.html), with the analytics flag and share tags put in; /play/* too.
//                    Old links still work: /?play=1 and /index.html redirect to /play with their query.
//  GET  /press       the press kit (deploy/press.html; ?lang=ru for Russian); its files at /press/<name>
//                    (deploy/assets/press/*, streamed from disk with byte ranges, never from a user-built path)
//  GET  /privacy, /sitemap.xml, /robots.txt, /manifest.webmanifest, /favicon.ico, /og.png, /assets/*
//  GET  /api/config  which payment and ad providers are configured (from env vars, all off by default), the store
//                    (store.on, store.providers), prices per SKU, rewarded ads, public links (LINK_* env vars) and a
//                    rounded weekly player count for the landing's social proof
//  POST /api/ev      anonymous events from js/analytics.js and the landing, appended to $DATA_DIR/ev-YYYY-MM-DD.ndjson
//  4.0 store (Gems packs, the Starter Kit and looks; never power, unlocks or anything random — DESIGN §4.9):
//  POST /api/store/telegram/invoice {sku, v} → {link}          Bot API createInvoiceLink in Stars (XTR)
//  POST /api/store/telegram/webhook                             Bot updates (secret-token header): pre-checkout, payment
//  POST /api/store/yookassa/create {sku, v, return_url} → {confirmation_url, id}
//  POST /api/store/yookassa/webhook                             payment.succeeded / refund.succeeded, re-fetched from the API
//  POST /api/store/yandex/verify {signature, v} → {grants}      a Yandex Games signed purchase (HMAC-SHA256)
//  POST /api/store/vk/callback                                  VK payments callback (md5 sig): get_item, order_status_change
//  GET  /api/store/claim?v= → {grants}   POST /api/store/ack {v, ids}   (a grant is delivered until it is acked, once)
//       Every paid order lands in $DATA_DIR/store-ledger.ndjson: append-only, one grant per provider payment id.
//  GET  /api/daily?day=&v= → the Daily Siege board   POST /api/daily {day, zones, secs, btn, cls, heat, name, v, seed, tok?}
//       ($DATA_DIR/daily-YYYY-MM-DD.json; the first attempt per visitor per UTC day, the day's own setup, capped per address)
//  POST /api/daily/start {day, v} → {tok}   the run token the game asks for when a ranked Daily Siege begins
//  POST /api/csp     Content-Security-Policy violation reports (counted in memory for the dashboard)
//  GET  /admin       the admin dashboard (deploy/admin.html); its data needs the ADMIN_TOKEN
//  GET  /api/admin/stats, /api/admin/live, /api/admin/export, /api/admin/store, /api/admin/daily  (header x-admin-token)
//  POST /api/admin/store/grant, /api/admin/store/telegram-setup, /api/admin/daily/hide, /api/admin/daily/reset
//       (ADMIN_TOKEN must be 20+ characters; wrong tokens are throttled per address)
//  GET  /health
// Pages and assets are read once at boot, kept in memory with brotli/gzip copies and ETags. Every page gets a CSP that
// names its own inline scripts by hash (computed at boot), so a rebuilt game needs no change here.
// Events are kept on disk (a Railway volume at $DATA_DIR) and folded into memory at boot, so the dashboard is
// instant. No raw IPs are stored: only a salted hash, to count people and to rate-limit (an IPv6 address counts by its /64).
//
// Environment (all optional; everything that sells or shows ads is OFF until configured):
//  PORT, PUBLIC_URL (https://…, canonical links and the YooKassa return address), DATA_DIR, KEEP_DAYS,
//  PUBLIC_ORIGINS        more origins this same site answers on (comma list, e.g. https://bttn.example): a YooKassa
//                        payment may send the player back there too (Railway's own *.up.railway.app domain is added)
//  TRUST_PROXY           where the client's address comes from: x-real-ip | xff (last X-Forwarded-For hop) | off (the
//                        socket). Default: x-real-ip on Railway, xff on Render, off elsewhere (a header any client can
//                        send is never trusted by default: every rate limit and cap keys on this address)
//  ADMIN_TOKEN, ANALYTICS_SALT, CONTACT_EMAIL, LINK_TELEGRAM/DISCORD/VK/YOUTUBE/REDDIT/CONTACT/TG_APP/YANDEX_GAMES/
//  CRAZYGAMES/STEAM (public links).
//  PAYMENTS=1            the master switch: nothing is sold without it (webhooks, claims and acks still work)
//  TELEGRAM_BOT_TOKEN + TELEGRAM_WEBHOOK_SECRET   Stars invoices; the secret is the setWebhook secret_token
//                        (/admin → Store → "Connect the Telegram webhook" sets it up)
//  YOOKASSA_SHOP_ID + YOOKASSA_SECRET_KEY         card/SBP payments in RUB; YOOKASSA_IP_CHECK=1 adds the IP allow-list
//  YOOKASSA_RECEIPT=1    send a 54-FZ receipt with each payment ("Чеки от ЮKassa" for an ИП/ООО; the self-employed
//                        «Мой налог» link needs none: it takes the payment's description). The game then asks the buyer
//                        for an email (sent to YooKassa only, never stored here). YOOKASSA_VAT_CODE (1-6, default 1 = no
//                        VAT), YOOKASSA_TAX_SYSTEM (1-6, only if the shop has several), YOOKASSA_SUBJECT (default service)
//  YANDEX_GAMES_SECRET   the game's secret key from the Yandex Games console (signed purchases)
//  VK_APP_SECRET (+ VK_APP_ID)                    the VK Mini App's secure key (payments callback, launch params)
//  STORE_SECRET          signs Telegram invoice payloads (default: derived from TELEGRAM_BOT_TOKEN)
//  STORE_COS             the looks for sale, "id:tier,…" (tiers 1/2/3 = $0.99/$1.99/$2.99); default below
//  STORE_LOOKS=1         the game draws looks now: the landing advertises the Starter Kit and looks (config store.looks)
//  ADS_REWARDED          comma list of platforms whose rewarded video may pay a continue: yandex, vk, telegram
//                        (telegram needs ADSGRAM_BLOCK_ID); ADSGRAM_BLOCK_ID, YANDEX_RTB_ID, ADSENSE_CLIENT (3.6 flags)
//  ALLOWED_ORIGINS       extra origins (comma list, * wildcards) allowed to call /api/config, /api/store/*, /api/daily
//  CSP=on|report|off     the Content-Security-Policy mode (default on); CSP_CONNECT extra connect-src sources (a ladder
//                        server, for example)
//  DAILY_STRICT=0        stop checking Daily posts against the day's setup (Heat 2, Classic, the seed's class), in case
//                        the game's Daily rules change before this file's DAILY_RULES do; DAILY_TOKEN=1 requires the run
//                        token on every post; DAILY_MAX rows kept on a day's board (default 20000)
//  TELEGRAM_API, YOOKASSA_API   provider API base URLs, for local tests against a mock only
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

const PORT = process.env.PORT || 8080;
const ROOT = path.join(__dirname, '..');
const DATA = process.env.DATA_DIR || path.join(ROOT, 'data');
const TOKEN = process.env.ADMIN_TOKEN || '';
const SALT = process.env.ANALYTICS_SALT || crypto.createHash('sha256').update('bttn|' + TOKEN).digest('hex');
const KEEP_DAYS = +process.env.KEEP_DAYS || 400;
// the public address, for canonical links, the sitemap and og:image (crawlers want absolute URLs)
const ORIGIN = (process.env.PUBLIC_URL || 'https://bttn-production.up.railway.app').replace(/\/+$/, '');
fs.mkdirSync(DATA, { recursive: true });
const env = k => String(process.env[k] || '').trim();
// secrets never reach a log line: every message passes through this
const SECRETS = ['ADMIN_TOKEN', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET', 'YOOKASSA_SECRET_KEY', 'YANDEX_GAMES_SECRET', 'VK_APP_SECRET', 'STORE_SECRET', 'ANALYTICS_SALT'].map(env).filter(s => s.length >= 6);
const redact = s => { s = String(s); for (const k of SECRETS) s = s.split(k).join('***'); return s.slice(0, 400); };
const log = (...a) => console.log(redact(a.join(' ')));

// ---------- Content-Security-Policy: each page's own inline scripts by hash, no 'unsafe-inline' for scripts ----------
// The game is one file with one inline script; hashes are taken from the very bytes served, at boot, so a rebuilt
// docs/index.html needs no change here. The game also gets: Twitch chat for streamer mode (4.0, ADDENDUM 6), and the
// platform SDKs the store loads (Yandex Games, VK Bridge from a CDN, Telegram WebApp, Adsgram).
// (report-only by default until every browser is confirmed clean: Firefox visitors sent violation reports and no game events;
// CSP=on enforces it)
const CSP_MODE = (env('CSP') || 'report').toLowerCase();
const CSP_HDR = CSP_MODE === 'report' ? 'content-security-policy-report-only' : 'content-security-policy';
const CSP_EXTRA = env('CSP_CONNECT').split(/[\s,]+/).filter(s => /^(https|wss):\/\/[a-z0-9.*:-]+(\/[^\s;,'"]*)?$/i.test(s)).join(' ');
// (exact files, not whole hosts: a host-only source would let any file on a public CDN run here. These are the files
// js/store.js loads, plus the folder the Yandex SDK pulls its polyfills from; none of them redirect)
const SDK_SCRIPTS = 'https://yandex.ru/games/sdk/v2 https://yastatic.net/s3/games-static/ https://telegram.org/js/telegram-web-app.js https://unpkg.com/@vkontakte/vk-bridge@2.15.12/dist/browser.min.js https://sad.adsgram.ai/js/sad.min.js';
const SDK_CONNECT = 'https://yandex.ru https://*.yandex.ru https://*.yandex.net https://*.adsgram.ai https://*.vk.com https://*.vk-apps.com';
function scriptHashes(html) {
  const out = new Set(), re = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  for (let m; (m = re.exec(html));) {
    if (/\bsrc\s*=/i.test(m[1])) continue;
    const ty = /\btype\s*=\s*["']?([^"'\s>]+)/i.exec(m[1]);
    if (ty && !/^((text|application)\/(java|ecma)script|module)$/i.test(ty[1])) continue; // data blocks (ld+json) never run
    out.add("'sha256-" + crypto.createHash('sha256').update(m[2], 'utf8').digest('base64') + "'");
  }
  return [...out];
}
function cspFor(html, kind) {
  if (CSP_MODE === 'off') return '';
  const h = scriptHashes(html), scripts = h.length ? "'self' " + h.join(' ') : "'none'";
  const base = "object-src 'none'; base-uri 'self'; form-action 'self'; report-uri /api/csp";
  if (kind === 'game') return `default-src 'self'; script-src ${scripts} ${SDK_SCRIPTS}; connect-src 'self' wss://irc-ws.chat.twitch.tv ${SDK_CONNECT}${CSP_EXTRA ? ' ' + CSP_EXTRA : ''}; img-src 'self' data: blob: https:; media-src 'self' data: blob: https:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-src 'self' https:; worker-src 'self' blob:; ${base}`;
  return `default-src 'self'; script-src ${scripts}; connect-src 'self'; img-src 'self' data:${kind === 'admin' ? ' blob:' : ''}; media-src 'self'; font-src 'self'; style-src 'self' 'unsafe-inline'; ${kind === 'admin' ? "frame-ancestors 'none'; " : ''}${base}`;
}

// ---------- files: read once, compressed once ----------
function pack(buf, type, cache) {
  const o = { raw: buf, type, cache: cache || 'no-cache', etag: 'W/"' + crypto.createHash('sha1').update(buf).digest('base64').slice(0, 22) + '"' };
  if (/^(text\/|application\/(json|manifest|xml|javascript)|image\/svg)/.test(type) && buf.length > 1024) {
    o.br = zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: buf.length > 4e5 ? 9 : 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buf.length } });
    o.gz = zlib.gzipSync(buf, { level: 9 });
  }
  return o;
}
const readOr = (f, alt) => { try { return fs.readFileSync(path.join(__dirname, f)); } catch (e) { return Buffer.from(alt); } };
const HTML = 'text/html; charset=utf-8';
const origin = s => s.replace(/%ORIGIN%/g, ORIGIN);
const withCsp = (o, kind) => { o.csp = cspFor(o.raw.toString('utf8'), kind); return o; };
const escH = x => String(x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// the game, at /play
const HEAD = `<meta name="description" content="Hold the Button against a 1,000-monster Horde. Your party fights, your clicks call lightning, the loot rains. Free, in the browser.">
<link rel="canonical" href="${ORIGIN}/play"><meta name="theme-color" content="#0d0a12"><link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png"><link rel="apple-touch-icon" href="/assets/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest">
<meta property="og:title" content="BTTN — Don't let the Button break"><meta property="og:description" content="Hold the Button against a 1,000-monster Horde. Your party fights, your clicks call lightning, the loot rains. Free, in the browser.">
<meta property="og:type" content="website"><meta property="og:url" content="${ORIGIN}/play"><meta property="og:image" content="${ORIGIN}/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${ORIGIN}/og.png">
<script>window.BTTN_AN='/api/ev'</script>`;
function loadPage() {
  const html = fs.readFileSync(path.join(ROOT, 'docs', 'index.html'), 'utf8');
  return withCsp(pack(Buffer.from(html.includes('</head>') ? html.replace('</head>', HEAD + '\n</head>') : HEAD + html), HTML), 'game');
}
const page = loadPage();
// the landing, at / (and /?lang=ru, the same page with Russian marked as its language for crawlers)
const landingSrc = origin(readOr('landing.html', '<!doctype html><a href="/play">Play</a>').toString('utf8'));
const landing = { en: withCsp(pack(Buffer.from(landingSrc), HTML), 'page'), ru: withCsp(pack(Buffer.from(landingSrc.replace('<html lang="en">', '<html lang="ru">').replace(`<link rel="canonical" href="${ORIGIN}/">`, `<link rel="canonical" href="${ORIGIN}/?lang=ru">`).replace('content="en_US"', 'content="ru_RU"').replace('content="ru_RU">\n<meta name="twitter', 'content="en_US">\n<meta name="twitter')), HTML), 'page') };
const CONTACT = (() => {
  const m = String(process.env.CONTACT_EMAIL || '').trim(), l = String(process.env.LINK_TELEGRAM || process.env.LINK_CONTACT || '').trim();
  const esc = x => x.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  if (/^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i.test(m)) return { en: `Questions or a deletion request: <a href="mailto:${esc(m)}">${esc(m)}</a>.`, ru: `Вопросы или просьба удалить данные: <a href="mailto:${esc(m)}">${esc(m)}</a>.` };
  if (/^https:\/\/[^\s"'<>]+$/i.test(l)) return { en: `Questions or a deletion request: <a href="${esc(l)}">${esc(l)}</a>.`, ru: `Вопросы или просьба удалить данные: <a href="${esc(l)}">${esc(l)}</a>.` };
  return { en: 'Questions or a deletion request: use the contact links on the <a href="/">home page</a>. Clearing this site\'s data also unlinks you from everything recorded so far.', ru: 'Вопросы или просьба удалить данные: ссылки для связи на <a href="/">главной</a>.' };
})();
const privacy = withCsp(pack(Buffer.from(origin(readOr('privacy.html', 'Privacy: anonymous play stats only.').toString('utf8')).replace('%CONTACT%', CONTACT.en).replace('%CONTACT_RU%', CONTACT.ru)), HTML), 'page');
const admin = withCsp(pack(readOr('admin.html', 'no dashboard'), HTML), 'admin');
const og = (() => { try { return pack(fs.readFileSync(path.join(__dirname, 'og.png')), 'image/png', 'public, max-age=86400'); } catch (e) { return null; } })();
const BOOT_DAY = new Date().toISOString().slice(0, 10);
const sitemap = pack(Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
<url><loc>${ORIGIN}/</loc><lastmod>${BOOT_DAY}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority><xhtml:link rel="alternate" hreflang="en" href="${ORIGIN}/"/><xhtml:link rel="alternate" hreflang="ru" href="${ORIGIN}/?lang=ru"/><xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}/"/></url>
<url><loc>${ORIGIN}/?lang=ru</loc><lastmod>${BOOT_DAY}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority><xhtml:link rel="alternate" hreflang="en" href="${ORIGIN}/"/><xhtml:link rel="alternate" hreflang="ru" href="${ORIGIN}/?lang=ru"/><xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}/"/></url>
<url><loc>${ORIGIN}/play</loc><lastmod>${BOOT_DAY}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>
<url><loc>${ORIGIN}/press</loc><lastmod>${BOOT_DAY}</lastmod><changefreq>monthly</changefreq><priority>0.5</priority><xhtml:link rel="alternate" hreflang="en" href="${ORIGIN}/press"/><xhtml:link rel="alternate" hreflang="ru" href="${ORIGIN}/press?lang=ru"/></url>
<url><loc>${ORIGIN}/press?lang=ru</loc><lastmod>${BOOT_DAY}</lastmod><changefreq>monthly</changefreq><priority>0.4</priority><xhtml:link rel="alternate" hreflang="en" href="${ORIGIN}/press"/><xhtml:link rel="alternate" hreflang="ru" href="${ORIGIN}/press?lang=ru"/></url>
<url><loc>${ORIGIN}/privacy</loc><lastmod>${BOOT_DAY}</lastmod><changefreq>yearly</changefreq><priority>0.2</priority></url>
</urlset>
`), 'application/xml; charset=utf-8', 'public, max-age=3600');
const robots = pack(Buffer.from(`User-agent: *\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${ORIGIN}/sitemap.xml\n`), 'text/plain; charset=utf-8', 'public, max-age=3600');
const manifest = pack(Buffer.from(JSON.stringify({
  name: 'BTTN — hold the Button', short_name: 'BTTN', description: 'A free pixel-art idle horde clicker. Hold the Button, build a party, chase the loot.',
  id: '/play', start_url: '/play?utm_source=pwa&utm_medium=app', scope: '/', display: 'standalone', orientation: 'any', background_color: '#0d0a12', theme_color: '#0d0a12', categories: ['games', 'entertainment'],
  icons: [{ src: '/assets/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/assets/icon-512.png', sizes: '512x512', type: 'image/png' }, { src: '/assets/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }],
})), 'application/manifest+json; charset=utf-8', 'public, max-age=86400');
// deploy/assets/*: the landing's posters, video loops, sprite atlas, fonts and icons
const TYPES = { '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff2': 'font/woff2', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json', '.zip': 'application/zip', '.pdf': 'application/pdf' };
const assets = new Map();
(function loadAssets(dir, pre) {
  let names = []; try { names = fs.readdirSync(dir); } catch (e) { return; }
  for (const n of names) {
    const f = path.join(dir, n), st = fs.statSync(f);
    if (st.isDirectory()) { if (!(pre === '' && n === 'press')) loadAssets(f, pre + n + '/'); continue; } // press media: from disk, at /press/*
    const type = TYPES[path.extname(n).toLowerCase()]; if (!type) continue;
    assets.set(pre + n, pack(fs.readFileSync(f), type, /\.(woff2)$/.test(n) ? 'public, max-age=604800, immutable' : 'public, max-age=86400'));
  }
})(path.join(__dirname, 'assets'), '');
const favicon = assets.get('favicon-32.png') || null;
// public links (LINK_* env vars): the landing's footer and badges, and the press kit
const okLink = u => (/^https:\/\/[^\s"'<>]+$/i.test(u) ? u : '');
const MAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i.test(env('CONTACT_EMAIL')) ? env('CONTACT_EMAIL') : '';
const LINKS = (() => {
  const l = {
    telegram: okLink(env('LINK_TELEGRAM')), discord: okLink(env('LINK_DISCORD')), vk: okLink(env('LINK_VK')), youtube: okLink(env('LINK_YOUTUBE')), reddit: okLink(env('LINK_REDDIT')),
    contact: MAIL ? 'mailto:' + MAIL : okLink(env('LINK_CONTACT')),
    tg_app: okLink(env('LINK_TG_APP')), yandex: okLink(env('LINK_YANDEX_GAMES')), crazygames: okLink(env('LINK_CRAZYGAMES')), steam: okLink(env('LINK_STEAM')),
  };
  for (const k in l) if (!l[k]) delete l[k];
  return l;
})();

// ---------- the press kit: /press (EN), /press?lang=ru, and its files at /press/<name> ----------
// deploy/press.html holds both languages in <!--en-->…<!--/en--> and <!--ru-->…<!--/ru--> blocks; each variant is cut
// at boot, so crawlers and readers without JS get one language. The media list comes from
// deploy/assets/press/manifest.json and shows only files that exist. Press media are big (PNG screenshots, video), so
// they are streamed from disk: the folder's names are read once into an allow-list, and a request can only ever name
// one of them (nothing from the URL is joined into a file path).
const PRESS_DIR = path.join(__dirname, 'assets', 'press');
const pressFiles = new Map();
try {
  for (const n of fs.readdirSync(PRESS_DIR)) {
    if (!/^[a-z0-9][a-z0-9._-]{0,80}$/i.test(n) || n === 'manifest.json') continue;
    const f = path.join(PRESS_DIR, n), st = fs.statSync(f), type = TYPES[path.extname(n).toLowerCase()];
    if (!st.isFile() || !type) continue;
    pressFiles.set(n, { f, size: st.size, type, etag: 'W/"' + st.size.toString(36) + '-' + Math.floor(st.mtimeMs).toString(36) + '"' });
  }
} catch (e) {}
const press = (() => {
  const src = origin(readOr('press.html', '<!doctype html><title>BTTN press kit</title><a href="/play">Play BTTN</a>').toString('utf8'));
  let M = { items: [] };
  try { M = JSON.parse(fs.readFileSync(path.join(PRESS_DIR, 'manifest.json'), 'utf8')); } catch (e) {}
  const mb = (n, ru) => { const s = (n / 1048576).toFixed(1); return (ru ? s.replace('.', ',') : s) + (ru ? ' МБ' : ' MB'); };
  const kb = (n, ru) => Math.round(n / 1024) + (ru ? ' КБ' : ' KB');
  const sizeOf = n => { const F = pressFiles.get(n); return F ? F.size : 0; };
  function media(lang) {
    const ru = lang === 'ru', T = ru ? { dl: 'Скачать', soon: 'вид 3.6 — обновим с интерфейсом 4.0', none: 'Медиафайлы скоро появятся.' } : { dl: 'Download', soon: '3.6 look — to be refreshed with the 4.0 UI', none: 'Media is on its way.' };
    const out = { shot: [], phone: [], clip: [], brand: [] };
    for (const it of Array.isArray(M.items) ? M.items : []) {
      if (!it || typeof it.file !== 'string' || !pressFiles.has(it.file)) continue;
      const cap = escH((ru ? it.ru : it.en) || it.en || it.file), file = escH(it.file), w = it.w | 0, h = it.h | 0;
      const thumb = typeof it.thumb === 'string' && pressFiles.has(it.thumb) ? escH(it.thumb) : file;
      const fmt = escH(path.extname(it.file).slice(1).toUpperCase()), sz = sizeOf(it.file) >= 1048576 ? mb(sizeOf(it.file), ru) : kb(sizeOf(it.file), ru);
      const meta = `<span class="meta">${w && h ? w + '×' + h + ' · ' : ''}${fmt} · ${sz}${it.refresh ? ' · <i>' + T.soon + '</i>' : ''}</span>`;
      const dl = `<a class="dl" href="/press/${file}?dl=1" download>${T.dl}</a>`;
      const kind = ['shot', 'phone', 'clip', 'brand'].includes(it.kind) ? it.kind : 'brand';
      if (kind === 'clip' && !/\.gif$/i.test(it.file)) {
        const poster = typeof it.poster === 'string' && pressFiles.has(it.poster) ? ` poster="/press/${escH(it.poster)}"` : '';
        out.clip.push(`<figure class="tile clip"><video controls muted loop playsinline preload="none"${poster}${w && h ? ` width="${w}" height="${h}"` : ''}><source src="/press/${file}" type="${escH(pressFiles.get(it.file).type)}"></video><figcaption><b>${cap}</b>${meta}${dl}</figcaption></figure>`);
      } else {
        out[kind].push(`<figure class="tile ${kind}"><a class="pic" href="/press/${file}"><img src="/press/${thumb}" alt="${cap}" loading="lazy" decoding="async"${w && h ? ` width="${w}" height="${h}"` : ''}></a><figcaption><b>${cap}</b>${meta}${dl}</figcaption></figure>`);
      }
    }
    const grid = (k, cls) => (out[k].length ? `<div class="grid ${cls}">${out[k].join('')}</div>` : '');
    const html = grid('shot', 'g-shot') + grid('phone', 'g-phone') + grid('clip', 'g-clip') + grid('brand', 'g-brand');
    return html || `<p class="dim">${T.none}</p>`;
  }
  function links(lang) {
    const ru = lang === 'ru';
    const NAME = { tg_app: 'Telegram Mini App', yandex: ru ? 'Яндекс Игры' : 'Yandex Games', crazygames: 'CrazyGames', steam: 'Steam', telegram: 'Telegram', discord: 'Discord', vk: ru ? 'ВКонтакте' : 'VK', youtube: 'YouTube', reddit: 'Reddit' };
    return Object.keys(NAME).filter(k => LINKS[k]).map(k => `<a class="btn2" href="${escH(LINKS[k])}" rel="noopener">${NAME[k]}</a>`).join('');
  }
  function contact(lang) {
    const ru = lang === 'ru';
    if (MAIL) return `<a href="mailto:${escH(MAIL)}">${escH(MAIL)}</a>`;
    if (LINKS.contact || LINKS.telegram) { const u = LINKS.contact || LINKS.telegram; return `<a href="${escH(u)}" rel="noopener">${escH(u.replace(/^https:\/\//, ''))}</a>`; }
    return ru ? 'через ссылки на <a href="/?lang=ru">главной</a>' : 'through the links on the <a href="/">home page</a>';
  }
  function steam(lang) {
    if (!LINKS.steam) return '';
    return `<a class="btn2 gold" href="${escH(LINKS.steam)}" rel="noopener">${lang === 'ru' ? 'В желаемое в Steam' : 'Wishlist on Steam'}</a>`;
  }
  const build = lang => {
    const ru = lang === 'ru';
    let s = src.replace(/<!--(en|ru)-->([\s\S]*?)<!--\/\1-->/g, (m, l, body) => (l === lang ? body : ''));
    if (ru) s = s.replace('<html lang="en">', '<html lang="ru">').replace(`<link rel="canonical" href="${ORIGIN}/press">`, `<link rel="canonical" href="${ORIGIN}/press?lang=ru">`);
    const vals = { MEDIA: media(lang), LINKS: links(lang), CONTACT: contact(lang), STEAM: steam(lang), SIZE: mb(page.raw.length, ru), SIZE_BR: page.br ? kb(page.br.length, ru) : mb(page.raw.length, ru) };
    s = s.replace(/\{\{(MEDIA|LINKS|CONTACT|STEAM|SIZE|SIZE_BR)\}\}/g, (m, k) => vals[k]);
    return withCsp(pack(Buffer.from(s), HTML), 'page');
  };
  return { en: build('en'), ru: build('ru') };
})();
// a file from the press folder: ETag, byte ranges (Safari wants them for video), ?dl=1 for a download
function serveFile(req, res, F, dl) {
  const h = Object.assign({ 'content-type': F.type, 'cache-control': 'public, max-age=86400', etag: F.etag, 'accept-ranges': 'bytes' }, SEC);
  if (dl) h['content-disposition'] = 'attachment; filename="bttn-' + path.basename(F.f) + '"';
  const inm = req.headers['if-none-match'];
  if (inm && inm.split(/\s*,\s*/).includes(F.etag)) { res.writeHead(304, h); return res.end(); }
  let a = 0, b = F.size - 1, code = 200;
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (range && (range[1] || range[2])) {
    a = range[1] === '' ? F.size - +range[2] : +range[1]; b = range[1] !== '' && range[2] !== '' ? Math.min(+range[2], F.size - 1) : F.size - 1;
    if (a < 0) a = 0;
    if (a > b || a >= F.size) { res.writeHead(416, Object.assign(h, { 'content-range': 'bytes */' + F.size })); return res.end(); }
    code = 206; h['content-range'] = `bytes ${a}-${b}/${F.size}`;
  }
  h['content-length'] = b - a + 1;
  res.writeHead(code, h);
  if (req.method === 'HEAD' || F.size === 0) return res.end();
  const st = fs.createReadStream(F.f, { start: a, end: b });
  st.on('error', () => res.destroy()); st.pipe(res);
}

// ---------- who's on the other end ----------
const BOT = /bot|crawl|spider|slurp|headless|playwright|puppeteer|phantom|python|curl|wget|httpclient|lighthouse|preview|facebookexternalhit|embedly|vkshare/i;
function parseUA(ua) {
  ua = ua || '';
  const type = /iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua) ? 'tablet' : /Mobi|iPhone|iPod|Android|IEMobile|Opera Mini/i.test(ua) ? 'mobile' : 'desktop';
  const os = /Windows/i.test(ua) ? 'Windows' : /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Android/i.test(ua) ? 'Android' : /CrOS/i.test(ua) ? 'ChromeOS' : /Mac OS X|Macintosh/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : 'Other';
  const br = /Instagram/i.test(ua) ? 'Instagram app' : /FBAN|FBAV/i.test(ua) ? 'Facebook app' : /musical_ly|TikTok|BytedanceWebview/i.test(ua) ? 'TikTok app' : /Telegram/i.test(ua) ? 'Telegram app'
    : /YaBrowser/i.test(ua) ? 'Yandex' : /Edg\//i.test(ua) ? 'Edge' : /OPR\/|Opera/i.test(ua) ? 'Opera' : /SamsungBrowser/i.test(ua) ? 'Samsung' : /Firefox|FxiOS/i.test(ua) ? 'Firefox'
    : /Chrome|CriOS/i.test(ua) ? 'Chrome' : /Safari/i.test(ua) ? 'Safari' : 'Other';
  return { type, os, br, bot: BOT.test(ua) };
}
// where: a CDN country header if there is one, else the browser's time zone, else its language's region
const TZ = { 'Europe/Moscow': 'RU', 'Europe/Samara': 'RU', 'Europe/Volgograd': 'RU', 'Europe/Kaliningrad': 'RU', 'Asia/Yekaterinburg': 'RU', 'Asia/Omsk': 'RU', 'Asia/Novosibirsk': 'RU', 'Asia/Barnaul': 'RU', 'Asia/Krasnoyarsk': 'RU', 'Asia/Irkutsk': 'RU', 'Asia/Yakutsk': 'RU', 'Asia/Vladivostok': 'RU', 'Asia/Magadan': 'RU', 'Asia/Kamchatka': 'RU', 'Europe/Kiev': 'UA', 'Europe/Kyiv': 'UA', 'Europe/Minsk': 'BY', 'Asia/Almaty': 'KZ', 'Asia/Qostanay': 'KZ', 'Asia/Aqtobe': 'KZ', 'Asia/Tashkent': 'UZ', 'Asia/Bishkek': 'KG', 'Asia/Tbilisi': 'GE', 'Asia/Yerevan': 'AM', 'Asia/Baku': 'AZ', 'Europe/Chisinau': 'MD', 'Europe/Riga': 'LV', 'Europe/Vilnius': 'LT', 'Europe/Tallinn': 'EE', 'Europe/Warsaw': 'PL', 'Europe/Berlin': 'DE', 'Europe/Paris': 'FR', 'Europe/London': 'GB', 'Europe/Dublin': 'IE', 'Europe/Madrid': 'ES', 'Europe/Lisbon': 'PT', 'Europe/Rome': 'IT', 'Europe/Amsterdam': 'NL', 'Europe/Brussels': 'BE', 'Europe/Zurich': 'CH', 'Europe/Vienna': 'AT', 'Europe/Prague': 'CZ', 'Europe/Bratislava': 'SK', 'Europe/Budapest': 'HU', 'Europe/Bucharest': 'RO', 'Europe/Sofia': 'BG', 'Europe/Belgrade': 'RS', 'Europe/Zagreb': 'HR', 'Europe/Athens': 'GR', 'Europe/Istanbul': 'TR', 'Europe/Helsinki': 'FI', 'Europe/Stockholm': 'SE', 'Europe/Oslo': 'NO', 'Europe/Copenhagen': 'DK', 'Asia/Jerusalem': 'IL', 'Asia/Dubai': 'AE', 'Asia/Riyadh': 'SA', 'Asia/Tehran': 'IR', 'Asia/Karachi': 'PK', 'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN', 'Asia/Dhaka': 'BD', 'Asia/Bangkok': 'TH', 'Asia/Jakarta': 'ID', 'Asia/Ho_Chi_Minh': 'VN', 'Asia/Saigon': 'VN', 'Asia/Manila': 'PH', 'Asia/Kuala_Lumpur': 'MY', 'Asia/Singapore': 'SG', 'Asia/Shanghai': 'CN', 'Asia/Hong_Kong': 'HK', 'Asia/Taipei': 'TW', 'Asia/Seoul': 'KR', 'Asia/Tokyo': 'JP', 'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU', 'Australia/Brisbane': 'AU', 'Australia/Perth': 'AU', 'Pacific/Auckland': 'NZ', 'Africa/Cairo': 'EG', 'Africa/Lagos': 'NG', 'Africa/Johannesburg': 'ZA', 'Africa/Nairobi': 'KE', 'Africa/Casablanca': 'MA', 'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US', 'America/Phoenix': 'US', 'America/Los_Angeles': 'US', 'America/Anchorage': 'US', 'America/Detroit': 'US', 'America/Indiana/Indianapolis': 'US', 'Pacific/Honolulu': 'US', 'America/Toronto': 'CA', 'America/Vancouver': 'CA', 'America/Edmonton': 'CA', 'America/Winnipeg': 'CA', 'America/Halifax': 'CA', 'America/Mexico_City': 'MX', 'America/Bogota': 'CO', 'America/Lima': 'PE', 'America/Santiago': 'CL', 'America/Argentina/Buenos_Aires': 'AR', 'America/Buenos_Aires': 'AR', 'America/Sao_Paulo': 'BR', 'America/Caracas': 'VE' };
function country(req, tz, lang) {
  const h = req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || req.headers['x-country-code'] || req.headers['x-geo-country'];
  if (h && /^[A-Z]{2}$/i.test(h)) return h.toUpperCase();
  if (tz && TZ[tz]) return TZ[tz];
  const m = /^[a-z]{2,3}-([A-Z]{2})$/i.exec(lang || '');
  return m ? m[1].toUpperCase() : '??';
}
// The client's address comes from a proxy header only when a proxy we know of sets it (any client can send one).
// TRUST_PROXY: 'x-real-ip' (Railway's edge sets X-Real-IP to the client's address, docs: networking/public-networking/
// specs-and-limits), 'xff' (the last X-Forwarded-For hop: the address the nearest proxy saw; Render, Fly, nginx) or
// 'off' (no proxy: the socket's own address). Default: x-real-ip on Railway, xff on Render, off anywhere else.
const TRUST = (() => {
  const t = env('TRUST_PROXY').toLowerCase();
  if (t === 'x-real-ip' || t === 'xff' || t === 'off') return t;
  if (t === '1' || t === 'true') return 'xff';
  if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_SERVICE_ID) return 'x-real-ip';
  return process.env.RENDER ? 'xff' : 'off';
})();
const ipOf = req => {
  let ip = TRUST === 'x-real-ip' ? String(req.headers['x-real-ip'] || '') : TRUST === 'xff' ? String(req.headers['x-forwarded-for'] || '').split(',').pop() : '';
  ip = ip.trim() || String(req.socket.remoteAddress || '');
  // (an IPv4 client on a dual-stack socket, a port, brackets)
  return ip.trim().replace(/^\[([^\]]+)\](?::\d+)?$/, '$1').replace(/^(\d+\.\d+\.\d+\.\d+):\d+$/, '$1').replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/i, '').toLowerCase();
};
// an IPv6 address cut to its first `bits` (a home, a phone or a rented server gets a whole /64, often a /56 or a /48: one
// address there is free to change every request); IPv4 stays as it is
function netOf(ip, bits) {
  if (!ip.includes(':')) return ip;
  const s = ip.split('%')[0], two = s.split('::');
  if (two.length > 2 || !/^[0-9a-f:.]+$/.test(s)) return ip;
  const part = x => (x ? x.split(':') : []).flatMap(h => (h.includes('.') ? (n => (n == null ? ['0', '0'] : [(n >>> 16).toString(16), (n & 65535).toString(16)]))(ip4(h)) : [h]));
  const a = part(two[0]), b = two.length === 2 ? part(two[1]) : [];
  const all = two.length === 2 ? a.concat(Array(Math.max(0, 8 - a.length - b.length)).fill('0'), b) : a;
  if (all.length !== 8) return ip;
  return all.slice(0, bits >> 4).map(h => parseInt(h || '0', 16).toString(16)).join(':') + '::/' + bits;
}
const hashIp = ip => crypto.createHash('sha256').update(SALT + ip).digest('hex').slice(0, 12);
// the rate-limit key: an IPv4 address or an IPv6 /64 (hashed: no raw address is kept anywhere)
const ipKey = req => hashIp(netOf(ipOf(req), 64));
// (ip4 is with the YooKassa allow-list below)

// ---------- the store ----------
const dayKey = ts => new Date(ts).toISOString().slice(0, 10);
const visitors = new Map(); // vid -> visitor
const sessions = new Map(); // sid -> session
const MILESTONE = new Set(['intro_next', 'intro_skip', 'intro_done', 'class', 'first_click', 'tut', 'tut_end', 'hold', 'boss_win', 'boss_fail', 'land', 'depth', 'run_over', 'run_cont', 'run_end', 'gems', 'ascend', 'bless', 'champ', 'recruit', 'seat', 'town', 'build', 'relic', 'jackpot', 'od', 'rank', 'lvl', 'err', 'end', 'start',
  // 4.0 (DESIGN §12, ADDENDUM 12): the Siege and the store funnel; camelCase names (runStart) arrive as run_start
  'run_start', 'door', 'card', 'loot', 'camp', 'extract', 'deed', 'daily', 'store_open', 'buy_start', 'buy_ok', 'buy_fail', 'ad_show', 'ad_ok']);
const snake = t => (/[A-Z]/.test(t) ? t.replace(/[A-Z]/g, c => '_' + c.toLowerCase()) : t);
const clip = (v, n) => (typeof v === 'string' ? v.slice(0, n) : v);
const touchOf = d => ({ src: clip(d.src, 60) || '', med: clip(d.med, 40) || '', cmp: clip(d.cmp, 80) || '', cnt: clip(d.cnt, 80) || '', ref: clip(d.ref, 80) || '' });
const lands = new Map(); // sid -> one landing page view
function ingestLanding(rec, V, xs) {
  const { r, s } = rec;
  let L = lands.get(s);
  for (const x of xs.slice(0, 100)) {
    const ts = Math.min(r, Math.max(r - 6 * 3600e3, +x.ts || r));
    const d = x.d && typeof x.d === 'object' ? x.d : {};
    if (!L) { L = { sid: s, vid: V.vid, ts, touch: null, dev: V.dev, cc: V.cc, ui: '', play: 0, pos: '', how: '', ms: 0, s50: 0, s100: 0, sc: 0, dur: 0, faq: [], sup: [], pf: [], bot: V.bot }; lands.set(s, L); }
    V.last = Math.max(V.last, ts);
    if (x.t === 'land_view' && !L.touch) {
      L.ts = ts; L.touch = touchOf(d); L.ui = clip(d.ui, 4) || ''; L.nw = d.nw ? 1 : 0;
      if (!V.touch) V.touch = d.f && typeof d.f === 'object' ? touchOf(d.f) : L.touch;
      if (!d.nw && d.age > 0 && V.first === r) V.first = r - d.age * 864e5;
      if (!V.lang) V.lang = clip(d.lang, 12) || ''; if (!V.tz) V.tz = clip(d.tz, 40) || '';
      const where = country({ headers: {} }, clip(d.tz, 40), clip(d.lang, 12));
      L.cc = rec.geo ? rec.cc : where !== '??' ? where : rec.cc || '??'; if (!V.ses) V.cc = L.cc;
    } else if (x.t === 'land_play') { if (!L.play) { L.play = ts; L.pos = clip(d.pos, 12) || ''; L.how = clip(d.how, 8) || ''; L.ms = Math.max(0, +d.ms || 0); } }
    else if (x.t === 'land_scroll') { if (+d.p >= 50) L.s50 = 1; if (+d.p >= 100) L.s100 = 1; }
    else if (x.t === 'land_end') { L.sc = Math.max(L.sc, Math.min(100, +d.sc || 0)); L.dur = Math.max(L.dur, Math.min(36e5, +d.ms || 0)); }
    else if (x.t === 'land_faq' && L.faq.length < 12) L.faq.push(clip(String(d.q || ''), 16));
    else if (x.t === 'land_support' && L.sup.length < 12) L.sup.push(clip(String(d.sku || ''), 32));
    else if (x.t === 'land_platform' && L.pf.length < 12) L.pf.push(clip(String(d.pf || ''), 16));
    if ((x.t === 'land_view' || x.t === 'land_play') && !V.steps[x.t]) V.steps[x.t] = ts;
  }
}
function ingest(rec) {
  const { r, ip, ua, cc, v, s } = rec;
  let e = rec.e;
  if (!v || !s || !Array.isArray(e)) return;
  const dev = parseUA(ua);
  let V = visitors.get(v);
  if (!V) { V = { vid: v, first: r, last: r, touch: null, dev, cc, lang: '', tz: '', days: new Set(), ses: 0, pt: 0, bd: 0, steps: {}, cls: '', bot: dev.bot, ip }; visitors.set(v, V); }
  // the landing page reports in its own session; it is not a play session (no time played, no milestones)
  const isLand = x => x && typeof x.t === 'string' && x.t.startsWith('land_');
  if (e.some(isLand)) { ingestLanding(rec, V, e.filter(isLand)); e = e.filter(x => !isLand(x)); if (!e.length) return; }
  let Ss = sessions.get(s);
  if (!Ss) {
    Ss = { sid: s, vid: v, start: r, last: r, touch: null, dev, cc, pt0: null, pt: 0, d: 0, bd: 0, tut: null, secs: 0, n: 0, ev: [], bot: dev.bot };
    sessions.set(s, Ss); V.ses++; V.days.add(dayKey(r));
  }
  for (let x of e.slice(0, 300)) {
    if (!x || typeof x.t !== 'string') continue;
    if (/[A-Z]/.test(x.t)) x = Object.assign({}, x, { t: snake(x.t) });
    const ts = Math.min(r, Math.max(r - 6 * 3600e3, +x.ts || r)); // the client clock, trusted within reason
    const d = x.d && typeof x.d === 'object' ? x.d : {};
    Ss.n++; Ss.last = Math.max(Ss.last, ts); V.last = Math.max(V.last, ts);
    if (x.t === 'start') {
      const t = { src: clip(d.src, 60) || '', med: clip(d.med, 40) || '', cmp: clip(d.cmp, 80) || '', cnt: clip(d.cnt, 80) || '', ref: clip(d.ref, 80) || '' };
      Ss.touch = t; Ss.lang = clip(d.lang, 12) || ''; Ss.tz = clip(d.tz, 40) || ''; Ss.scr = (d.sw | 0) + 'x' + (d.sh | 0); Ss.tch = d.tch ? 1 : 0;
      if (!V.touch) V.touch = d.f && typeof d.f === 'object' ? { src: clip(d.f.src, 60) || '', med: clip(d.f.med, 40) || '', cmp: clip(d.f.cmp, 80) || '', cnt: clip(d.f.cnt, 80) || '', ref: clip(d.f.ref, 80) || '' } : t;
      if (!d.nw && d.age > 0 && V.first === r) V.first = r - d.age * 864e5; // known from before this server saw them
      const where = country({ headers: {} }, Ss.tz, Ss.lang);
      V.lang = Ss.lang; V.tz = Ss.tz; V.cc = Ss.cc = rec.geo ? cc : where !== '??' ? where : cc || '??'; // a CDN's country header wins, then the time zone
      if (d.save && d.save.pt) { Ss.pt0 = +d.save.pt || 0; V.pt = Math.max(V.pt, Ss.pt0); V.bd = Math.max(V.bd, +d.save.bd || 0); }
    }
    if (x.t === 'hb' || x.t === 'end') {
      const pt = +d.pt || 0; if (Ss.pt0 == null) Ss.pt0 = pt; Ss.pt = Math.max(Ss.pt, pt); V.pt = Math.max(V.pt, pt);
      if (d.d != null) Ss.d = +d.d || 0;
      if (x.t === 'end') { Ss.secs = Math.max(Ss.secs, Math.min(6 * 3600, +d.secs || 0)); Ss.bd = Math.max(Ss.bd, +d.bd || 0); Ss.tut = d.tut; }
    }
    if (x.t === 'depth') { Ss.bd = Math.max(Ss.bd, +d.d || 0); V.bd = Math.max(V.bd, +d.d || 0); }
    if (x.t === 'class' && d.c) V.cls = clip(d.c, 12);
    if (x.t === 'tut') Ss.tut = d.k;
    // the funnel: each step's first time, per visitor
    // (a tutorial step on the way isn't the end of it; a skip counts as done)
    const step = x.t === 'intro_done' || x.t === 'intro_skip' ? 'intro' : x.t === 'boss_win' ? 'boss' : x.t === 'tut_end' ? 'tut' : x.t === 'tut' ? 'tut_step' : x.t === 'land' ? (d.li >= 2 ? 'land3' : 'land2') : x.t;
    if (!V.steps[step]) V.steps[step] = ts;
    if (x.t === 'land' && d.li >= 1 && !V.steps.land2) V.steps.land2 = ts;
    if (x.t === 'depth' && d.d >= 4 && !V.steps.depth5) V.steps.depth5 = ts;
    if (MILESTONE.has(x.t) && Ss.ev.length < 400) Ss.ev.push([x.t, ts, d]);
  }
  Ss.secs = Math.max(Ss.secs, Math.round((Ss.last - Ss.start) / 1000));
  if (V.pt >= 300 && !V.steps.m5) V.steps.m5 = r;
  if (V.pt >= 900 && !V.steps.m15) V.steps.m15 = r;
}
function replay() {
  const files = fs.readdirSync(DATA).filter(f => /^ev-\d{4}-\d\d-\d\d\.ndjson$/.test(f)).sort();
  const cut = dayKey(Date.now() - KEEP_DAYS * 864e5);
  let n = 0;
  for (const f of files) {
    if (f.slice(3, 13) < cut) { try { fs.unlinkSync(path.join(DATA, f)); } catch (e) {} continue; }
    for (const line of fs.readFileSync(path.join(DATA, f), 'utf8').split('\n')) { if (!line) continue; try { ingest(JSON.parse(line)); n++; } catch (e) {} }
  }
  console.log(`analytics: ${n} batches, ${visitors.size} visitors, ${sessions.size} sessions from ${files.length} files in ${DATA}`);
}
replay();
function append(rec) { fs.appendFile(path.join(DATA, 'ev-' + dayKey(rec.r) + '.ndjson'), JSON.stringify(rec) + '\n', () => {}); }

// ---------- rate limits: per address key (ipKey) and global budgets ('g:' keys), a minute and an hour ----------
const hits = new Map(), hitsH = new Map();
setInterval(() => hits.clear(), 60e3).unref();
setInterval(() => hitsH.clear(), 3600e3).unref();
const limited = (k, max) => { const n = (hits.get(k) || 0) + 1; hits.set(k, n); return n > max; };
const limitedH = (k, max) => { const n = (hitsH.get(k) || 0) + 1; hitsH.set(k, n); return n > max; };
// a budget a minute and an hour, both counted only when both still have room (a refusal doesn't eat the hour)
const budget = (k, perMin, perHour) => {
  if ((hits.get(k) || 0) >= perMin || (hitsH.get(k) || 0) >= perHour) return false;
  hits.set(k, (hits.get(k) || 0) + 1); hitsH.set(k, (hitsH.get(k) || 0) + 1); return true;
};

// ---------- request bodies and small helpers ----------
const J = (res, code, o, extra) => send(res, code, 'application/json; charset=utf-8', JSON.stringify(o), extra);
// a body over the cap gets 413 and the connection is closed once the answer is out (the rest is never read)
function tooBig(req, res) { if (res.headersSent) return; res.on('finish', () => req.destroy()); J(res, 413, { error: 'too big' }, { connection: 'close' }); }
function readBody(req, res, max, cb) {
  if ((+req.headers['content-length'] || 0) > max) return tooBig(req, res);
  let size = 0, over = false; const chunks = [];
  req.on('data', c => { if (over) return; size += c.length; if (size > max) { over = true; chunks.length = 0; return tooBig(req, res); } chunks.push(c); });
  req.on('end', () => { if (!over) cb(Buffer.concat(chunks)); });
  req.on('error', () => { over = true; });
}
const readJson = (req, res, max, cb) => readBody(req, res, max, buf => {
  let b; try { b = JSON.parse(buf.toString('utf8')); } catch (e) { return J(res, 400, { error: 'bad json' }); }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return J(res, 400, { error: 'bad body' });
  cb(b);
});
const safeEq = (a, b) => { a = Buffer.from(String(a)); b = Buffer.from(String(b)); return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b); };
const hmac = (key, s, enc) => crypto.createHmac('sha256', key).update(s).digest(enc);
const b64url = buf => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const rid = n => Array.from(crypto.randomBytes(n), b => (b % 36).toString(36)).join('');
const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
const VID_RE = /^[a-z0-9]{6,24}$/;         // the analytics visitor id (localStorage bttn_vid, js/analytics.js)
const VKV_RE = /^vk:\d{1,12}$/;            // a VK buyer without a visitor id in the order (claims need signed launch params)
// our own addresses: the only places a payment page may send the player back to (never taken from a request header:
// Host and X-Forwarded-Host are whatever the client says). PUBLIC_URL, Railway's own domain for this service, and
// PUBLIC_ORIGINS (more of our domains, comma list)
const OWN_ORIGINS = new Set([ORIGIN, process.env.RAILWAY_PUBLIC_DOMAIN ? 'https://' + String(process.env.RAILWAY_PUBLIC_DOMAIN).trim() : '', ...env('PUBLIC_ORIGINS').split(/[\s,]+/)]
  .map(s => { try { const u = new URL(s); return /^https?:$/.test(u.protocol) && !u.username && !u.password && s.replace(/\/+$/, '') === u.origin ? u.origin : ''; } catch (e) { return ''; } }).filter(Boolean));

// ======================================================================================================
// ---------- 4.0: the Gems store (ADDENDUM 9; DESIGN §4.9; MONETIZATION 1.2a) ----------
// Sells fixed Gems packs, the Starter Kit (100 Gems + the Founder Flame look) and looks (cos_<id>). Never power, never
// unlocks, never anything random. Prices live only here (a client's price is never trusted): the MONETIZATION §3 ladder,
// linear (no "bonus" decoys), ₽ at about 0.72× the dollar rate, Stars at about $0.02, VK votes at 7 ₽.
const TIERS = {
  1: { usd: 0.99, rub: 59, stars: 50, votes: 8 }, 2: { usd: 1.99, rub: 119, stars: 100, votes: 17 }, 3: { usd: 2.99, rub: 179, stars: 150, votes: 26 },
  10: { usd: 9.99, rub: 599, stars: 500, votes: 86 },
};
const SKUS = Object.assign(Object.create(null), {
  gems_100: { gems: 100, tier: 1, en: '100 Gems', ru: '100 самоцветов' },
  gems_300: { gems: 300, tier: 3, en: '300 Gems', ru: '300 самоцветов' },
  gems_1000: { gems: 1000, tier: 10, en: '1,000 Gems', ru: '1000 самоцветов' },
  starter: { gems: 100, cos: 'founder_flame', tier: 2, once: 1, en: 'Starter Kit', ru: 'Набор новичка' },
});
// looks: "id:tier,…" (STORE_COS replaces the default); the name comes from the id: <kind>_<word>
const COS_KIND = { skin: ['Button skin', 'Облик Кнопки'], trail: ['Hand trail', 'След Руки'], beam: ['Loot beam', 'Столб лута'], flame: ['Flame', 'Пламя'] };
const COS_WORD = { frost: ['Frost', 'Иней'], candy: ['Candy', 'Карамель'], ember: ['Ember', 'Угли'], void: ['Void', 'Пустота'], azure: ['Azure', 'Лазурь'], crimson: ['Crimson', 'Багрянец'], verdant: ['Verdant', 'Зелень'], prism: ['Prism', 'Призма'], rose: ['Rose', 'Роза'], ice: ['Ice', 'Лёд'], gold: ['Gold', 'Золото'], founder: ['Founder', 'Основателя'] };
for (const part of (env('STORE_COS') || 'skin_frost:2,skin_candy:2,skin_ember:2,skin_void:2,trail_azure:1,trail_crimson:1,trail_verdant:1,trail_prism:1,beam_rose:1,beam_ice:1').split(',')) {
  const m = /^\s*([a-z0-9_]{2,28}):(1|2|3)\s*$/.exec(part); if (!m) continue;
  const [kind, ...rest] = m[1].split('_'), K = COS_KIND[kind] || ['Look', 'Облик'], wk = rest.join('_'), W = COS_WORD[wk] || [wk.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()) || m[1], wk || m[1]];
  SKUS['cos_' + m[1]] = { gems: 0, cos: m[1], tier: +m[2], once: 1, en: (W[0] + ' ' + K[0]).slice(0, 32), ru: (K[1] + ' «' + W[1] + '»').slice(0, 32) };
}
const okSku = s => own(SKUS, s);
const priceOf = sku => TIERS[SKUS[sku].tier];
const descOf = (sku, lang) => {
  const S = SKUS[sku], ru = lang === 'ru';
  if (S.cos && S.gems) return ru ? `${S.gems} самоцветов и облик «Пламя основателя». Только внешний вид, никакой силы.` : `${S.gems} Gems and the Founder Flame look. Looks only, never power.`;
  if (S.cos) return ru ? 'Облик для BTTN. Только внешний вид, без характеристик.' : 'A look for BTTN. Looks only, never stats.';
  return ru ? 'Самоцветы для BTTN: на продолжение забега и на облики. Ничего случайного, никакой силы.' : 'Gems for BTTN: they pay for a Continue and for looks. Nothing random, never power.';
};

// ---------- the ledger: $DATA_DIR/store-ledger.ndjson, append-only, folded into memory at boot ----------
//  {t:'order', prov, pid, sku, v, amt, cur, at}            a payment we created (YooKassa), waiting for the provider
//  {t:'grant', id, prov, pid, sku, gems, cos, v, amt, cur, at, test?, flag?, hold?}   a paid order: what the player gets
//  {t:'ack', id, at}   the client saved it (never delivered again)     {t:'refund', id, at}   money went back
//  {t:'orphan', prov, pid, amt, cur, at, why}   money arrived but the order can't be read (for /admin, by hand)
// A grant's id is a hash of provider + payment id, and a payment id is granted once: retried webhooks are harmless.
const LEDGER = path.join(DATA, 'store-ledger.ndjson');
const ledger = { grants: new Map(), byKey: new Map(), byV: new Map(), orders: new Map(), ordersByV: new Map(), orphans: [], lines: 0, bad: 0, badLines: [], oldOrders: 0, torn: false, writeFail: null };
// orders (payments we created, waiting for the provider) are kept in memory for a week: YooKassa cancels an unpaid one
// long before that, and a paid one past it still settles (its webhook re-fetch falls back to the list price)
const ORDER_KEEP = 7 * 864e5;
function fold(x) {
  if (!x || typeof x !== 'object') return;
  if (x.t === 'grant' && typeof x.id === 'string' && !ledger.grants.has(x.id)) {
    const g = { id: x.id, prov: String(x.prov), pid: String(x.pid), sku: x.sku, gems: x.gems | 0, cos: x.cos || null, v: String(x.v), amt: +x.amt || 0, cur: x.cur || '', at: +x.at || 0, test: x.test ? 1 : 0, flag: x.flag || '', hold: x.hold ? 1 : 0, acked: 0, refunded: 0 };
    ledger.grants.set(g.id, g); ledger.byKey.set(g.prov + ':' + g.pid, g.id);
    let s = ledger.byV.get(g.v); if (!s) ledger.byV.set(g.v, (s = new Set())); s.add(g.id);
    const o = ledger.orders.get(g.prov + ':' + g.pid); if (o) o.state = 'paid';
  } else if (x.t === 'ack') { const g = ledger.grants.get(x.id); if (g && !g.acked) g.acked = +x.at || 1; }
  else if (x.t === 'refund') { const g = ledger.grants.get(x.id); if (g && !g.refunded) g.refunded = +x.at || 1; }
  else if (x.t === 'order' && x.prov && x.pid) {
    const k = x.prov + ':' + x.pid; if (ledger.orders.has(k)) return;
    if (Date.now() - (+x.at || 0) > ORDER_KEEP) { ledger.oldOrders++; return; }
    ledger.orders.set(k, { prov: String(x.prov), pid: String(x.pid), sku: x.sku, v: String(x.v), amt: +x.amt || 0, cur: x.cur || '', at: +x.at || 0, idem: String(x.idem || ''), test: x.test ? 1 : 0, state: ledger.byKey.has(k) ? 'paid' : 'pending', checked: 0 });
    let a = ledger.ordersByV.get(String(x.v)); if (!a) ledger.ordersByV.set(String(x.v), (a = [])); a.push(k);
  } else if (x.t === 'orphan') { ledger.orphans.push(x); if (ledger.orphans.length > 100) ledger.orphans.shift(); }
}
(function loadLedger() {
  let txt = ''; try { txt = fs.readFileSync(LEDGER, 'utf8'); } catch (e) { return; }
  let n = 0;
  for (const line of txt.split('\n')) {
    n++; if (!line) continue;
    // (an unreadable line is money someone may have paid: kept for /admin, where a person can grant it by hand)
    try { fold(JSON.parse(line)); ledger.lines++; } catch (e) { ledger.bad++; ledger.badLines.push({ line: n, text: line.slice(0, 400) }); if (ledger.badLines.length > 20) ledger.badLines.shift(); }
  }
  // a crash mid-line must not glue the next record onto it
  if (txt && !txt.endsWith('\n')) fs.appendFileSync(LEDGER, '\n');
  log(`store: ${ledger.grants.size} grants, ${ledger.orders.size} open orders from ${ledger.lines} ledger lines${ledger.bad ? ' (' + ledger.bad + ' UNREADABLE: see /admin → Store)' : ''}`);
})();
// written and fsynced before the provider hears "OK". Every byte or nothing: a short write (a full disk) is written on in
// a loop, and any failure cuts the file back to where it was and throws, so the webhook answers 5xx and the provider
// retries the whole record (a torn half line would make this grant, and the next one glued to it, unreadable)
function ledgerWrite(xs) {
  const buf = Buffer.from((ledger.torn ? '\n' : '') + xs.map(x => JSON.stringify(x)).join('\n') + '\n');
  const fd = fs.openSync(LEDGER, 'a');
  let size = -1;
  try {
    size = fs.fstatSync(fd).size;
    for (let off = 0; off < buf.length;) {
      const n = fs.writeSync(fd, buf, off, buf.length - off);
      if (!(n > 0)) throw new Error('ledger: nothing written');
      off += n;
    }
    fs.fsyncSync(fd);
    ledger.torn = false;
  } catch (e) {
    let undone = false;
    if (size >= 0) { try { fs.ftruncateSync(fd, size); fs.fsyncSync(fd); undone = true; } catch (e2) {} }
    // (could not cut it back: the next record starts on a line of its own)
    if (!undone) ledger.torn = true;
    ledger.writeFail = { at: Date.now(), why: String(e.code || e.message).slice(0, 80), undone };
    log('store: LEDGER WRITE FAILED (' + (e.code || e.message) + ')' + (undone ? ', cut back; the provider will retry' : ', could not cut back'));
    throw e;
  } finally { fs.closeSync(fd); }
  for (const x of xs) fold(x);
}
function grant(prov, pid, sku, v, amt, cur, extra) {
  const key = prov + ':' + pid, have = ledger.byKey.get(key);
  if (have) return { g: ledger.grants.get(have), dup: true };
  let id = 'g_' + crypto.createHash('sha256').update(key).digest('hex').slice(0, 20);
  while (ledger.grants.has(id)) id += 'x'; // (80 bits; never in practice)
  const S = SKUS[sku];
  ledgerWrite([Object.assign({ t: 'grant', id, prov, pid: String(pid), sku, gems: S.gems, cos: S.cos || null, v, amt, cur, at: Date.now() }, extra || {})]);
  log(`store: grant ${id} ${prov} ${sku} ${amt} ${cur}${extra && extra.test ? ' (test)' : ''}${extra && extra.flag ? ' FLAG ' + extra.flag : ''}`);
  return { g: ledger.grants.get(id), dup: false };
}
const refund = id => { const g = ledger.grants.get(id); if (g && !g.refunded) { ledgerWrite([{ t: 'refund', id, at: Date.now() }]); log('store: refund ' + id); } };
const orphan = (prov, pid, amt, cur, why) => { ledgerWrite([{ t: 'orphan', prov, pid: String(pid).slice(0, 200), amt, cur, at: Date.now(), why }]); log(`store: ORPHAN ${prov} payment (${why}): grant it by hand in /admin`); };
const gOf = v => [...(ledger.byV.get(v) || [])].map(id => ledger.grants.get(id));
const owned = (v, sku) => gOf(v).some(g => g.sku === sku && !g.refunded);
const claimable = v => gOf(v).filter(g => !g.acked && !g.refunded && !g.hold);
const view = g => ({ id: g.id, sku: g.sku, gems: g.gems, cos: g.cos });

// ---------- providers: on when configured; PAYMENTS=1 gates every sale ----------
const PAY_ON = () => env('PAYMENTS') === '1';
const PROV = {
  yandex: () => !!env('YANDEX_GAMES_SECRET'),
  vk: () => !!env('VK_APP_SECRET'),
  telegram: () => !!(env('TELEGRAM_BOT_TOKEN') && env('TELEGRAM_WEBHOOK_SECRET')),
  yookassa: () => !!(env('YOOKASSA_SHOP_ID') && env('YOOKASSA_SECRET_KEY')),
};
const PROV_ENV = { yandex: ['YANDEX_GAMES_SECRET'], vk: ['VK_APP_SECRET'], telegram: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET'], yookassa: ['YOOKASSA_SHOP_ID', 'YOOKASSA_SECRET_KEY'] };
const storeProviders = () => (PAY_ON() ? Object.keys(PROV).filter(k => PROV[k]()) : []);
const selling = p => PAY_ON() && PROV[p]();
const stat = { tgInvoices: 0, tgPreOk: 0, tgPreNo: 0, tgInitStale: 0, ykCreated: 0, ykBusy: 0, yaVerified: 0, yaBadSig: 0, vkBadSig: 0, vkRefunds: 0, hookBad: 0, adminBad: 0 };
// what the store may ask the providers for (each create/invoice is a real object at the provider, and an order line
// here): per address an hour, and for everyone a minute and an hour. A real player needs a handful; past the budget
// the game says the payment did not go through and the player can try again in a moment.
const STORE_PER_NET_H = 30, STORE_G_MIN = 60, STORE_G_HOUR = 1000;
// a YooKassa payment the player left on the payment page stays pending for a while: at most this many open at once
// per visitor (a new one past that waits until one of them is paid, canceled or an hour old)
const YK_OPEN_PER_V = 3;

// --- Telegram Stars: createInvoiceLink (XTR, one price), then the bot's webhook ---
const TG_API = (env('TELEGRAM_API') || 'https://api.telegram.org').replace(/\/+$/, '');
const PAYLOAD_KEY = env('STORE_SECRET') || crypto.createHash('sha256').update('bttn-store-payload|' + env('TELEGRAM_BOT_TOKEN')).digest('hex');
// the invoice payload (≤128 bytes): sku|v|nonce|sig, so a pre-checkout query can be checked with no state
const signPayload = (sku, v) => { const body = sku + '|' + v + '|' + rid(8); return body + '|' + b64url(hmac(PAYLOAD_KEY, body)).slice(0, 16); };
function openPayload(p) {
  if (typeof p !== 'string' || p.length > 128) return null;
  const a = p.split('|'); if (a.length !== 4) return null;
  return { sku: a[0], v: a[1], ok: safeEq(a[3], b64url(hmac(PAYLOAD_KEY, a[0] + '|' + a[1] + '|' + a[2])).slice(0, 16)) };
}
async function tgCall(method, body) {
  const r = await fetch(`${TG_API}/bot${env('TELEGRAM_BOT_TOKEN')}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
  const j = await r.json().catch(() => null);
  if (!j || !j.ok) throw new Error(`telegram ${method}: ${(j && j.description) || 'HTTP ' + r.status}`);
  return j.result;
}
// Mini App initData (optional on the invoice call): HMAC-SHA256 with secret = HMAC("WebAppData", bot token), ≤ 24 h old.
// The newer 'signature' field is tried both in and out of the check string (either form proves the bot token).
function tgInitData(raw) {
  if (typeof raw !== 'string' || !raw || raw.length > 4096) return null;
  const q = new URLSearchParams(raw), hash = q.get('hash'); if (!hash) return null;
  const secret = crypto.createHmac('sha256', 'WebAppData').update(env('TELEGRAM_BOT_TOKEN')).digest();
  const dcs = skip => [...q.entries()].filter(([k]) => k !== 'hash' && k !== skip).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(([k, v]) => k + '=' + v).join('\n');
  if (!safeEq(hash, hmac(secret, dcs(''), 'hex')) && !safeEq(hash, hmac(secret, dcs('signature'), 'hex'))) return null;
  if (Date.now() / 1000 - (+q.get('auth_date') || 0) > 86400) return null;
  let u = null; try { u = JSON.parse(q.get('user') || 'null'); } catch (e) {}
  return { uid: u && u.id ? String(u.id) : '' };
}
async function tgInvoice(req, res, b) {
  if (!selling('telegram')) return J(res, 503, { error: 'off' });
  const { sku, v } = b;
  if (!okSku(sku)) return J(res, 400, { error: 'sku' });
  if (typeof v !== 'string' || !VID_RE.test(v)) return J(res, 400, { error: 'v' });
  if (SKUS[sku].once && owned(v, sku)) return J(res, 409, { error: 'owned' });
  // initData proves nothing the invoice needs (its payload is signed and bound to v already), and a Mini App left open
  // past a day sends a stale one: counted for /admin, never a refusal
  const init = req.headers['x-tg-init-data'];
  if (init != null && String(init) !== '' && !tgInitData(String(init))) stat.tgInitStale++;
  // the bot's API is a shared budget: per address an hour, and for everyone a minute and an hour
  if (limitedH('tgi:' + ipKey(req), STORE_PER_NET_H) || !budget('g:tgi', STORE_G_MIN, STORE_G_HOUR)) return J(res, 429, { error: 'slow down' });
  const lang = b.lang === 'ru' ? 'ru' : 'en', S = SKUS[sku], P = priceOf(sku);
  try {
    const link = await tgCall('createInvoiceLink', Object.assign({ title: S[lang], description: descOf(sku, lang), payload: signPayload(sku, v), provider_token: '', currency: 'XTR', prices: [{ label: S[lang], amount: P.stars }] },
      /^https:/.test(ORIGIN) ? { photo_url: ORIGIN + '/assets/icon-512.png', photo_width: 512, photo_height: 512 } : {}));
    if (typeof link !== 'string' || !/^https:\/\//.test(link)) throw new Error('telegram createInvoiceLink: no link');
    stat.tgInvoices++;
    return J(res, 200, { link });
  } catch (e) { log('store: telegram invoice failed:', e.message); return J(res, 502, { error: 'provider' }); }
}
function tgWebhook(req, res, b) {
  const want = env('TELEGRAM_WEBHOOK_SECRET');
  if (!want || !env('TELEGRAM_BOT_TOKEN')) return J(res, 503, { error: 'off' });
  if (!safeEq(req.headers['x-telegram-bot-api-secret-token'] || '', want)) { stat.hookBad++; return J(res, 401, { error: 'secret' }); }
  const q = b.pre_checkout_query;
  if (q && typeof q === 'object') {
    const P = openPayload(q.invoice_payload);
    const why = !P || !P.ok ? 'bad payload' : !okSku(P.sku) || !VID_RE.test(P.v) ? 'unknown item' : q.currency !== 'XTR' || +q.total_amount !== priceOf(P.sku).stars ? 'price' : SKUS[P.sku].once && owned(P.v, P.sku) ? 'owned' : !PAY_ON() ? 'closed' : '';
    if (why) { stat.tgPreNo++; log('store: telegram pre-checkout refused:', why); } else stat.tgPreOk++;
    // answered in the webhook reply itself: no outbound call, well inside Telegram's 10 s
    const lang = q.from && /^ru/.test(String(q.from.language_code || '')) ? 'ru' : 'en';
    const msg = why === 'owned' ? (lang === 'ru' ? 'Это у тебя уже есть.' : 'You already own this.') : (lang === 'ru' ? 'Этот товар сейчас недоступен. Открой магазин заново.' : 'This item is not available right now. Please reopen the store.');
    return J(res, 200, Object.assign({ method: 'answerPreCheckoutQuery', pre_checkout_query_id: String(q.id), ok: !why }, why ? { error_message: msg } : {}));
  }
  const m = b.message && typeof b.message === 'object' ? b.message : null;
  try {
    const sp = m && m.successful_payment;
    if (sp && typeof sp === 'object') {
      const pid = String(sp.telegram_payment_charge_id || ''), P = openPayload(sp.invoice_payload), amt = +sp.total_amount || 0;
      if (!pid || pid.length > 200) return J(res, 200, {});
      if (!P || !okSku(P.sku) || !VID_RE.test(P.v)) { if (!ledger.byKey.has('telegram:' + pid)) orphan('telegram', pid, amt, 'XTR', 'payload'); return J(res, 200, {}); }
      // the money has moved: grant even if the signing key changed since the invoice (flagged), hold if it's short
      const short = sp.currency !== 'XTR' || amt < priceOf(P.sku).stars;
      grant('telegram', pid, P.sku, P.v, amt, 'XTR', Object.assign({}, P.ok ? {} : { flag: 'sig' }, short ? { flag: 'amount', hold: 1 } : {}));
    }
    const rp = m && m.refunded_payment;
    if (rp && typeof rp === 'object') { const id = ledger.byKey.get('telegram:' + String(rp.telegram_payment_charge_id || '')); if (id) refund(id); }
  } catch (e) { log('store: telegram webhook failed:', e.message); return J(res, 500, { error: 'ledger' }); }
  return J(res, 200, {});
}

// --- YooKassa: create a payment (redirect), then the webhook, verified by fetching the payment back ---
const YK_API = (env('YOOKASSA_API') || 'https://api.yookassa.ru/v3').replace(/\/+$/, '');
const YK_ID = /^[A-Za-z0-9_-]{8,64}$/;
async function ykCall(method, p, body, idem) {
  const h = { authorization: 'Basic ' + Buffer.from(env('YOOKASSA_SHOP_ID') + ':' + env('YOOKASSA_SECRET_KEY')).toString('base64'), 'content-type': 'application/json' };
  if (idem) h['idempotence-key'] = idem;
  const r = await fetch(YK_API + p, { method, headers: h, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000) });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j) { const e = new Error(`yookassa ${method} ${p.split('/')[1]}: HTTP ${r.status}${j && j.code ? ' ' + j.code : ''}`); e.status = r.status; throw e; }
  return j;
}
async function ykCreate(req, res, b) {
  if (!selling('yookassa')) return J(res, 503, { error: 'off' });
  const { sku, v } = b;
  if (!okSku(sku)) return J(res, 400, { error: 'sku' });
  if (typeof v !== 'string' || !VID_RE.test(v)) return J(res, 400, { error: 'v' });
  if (SKUS[sku].once && owned(v, sku)) return J(res, 409, { error: 'owned' });
  // the way back must be our own site (no open redirect through a genuine payment page): one of OWN_ORIGINS, never an
  // address taken from the request (Host / X-Forwarded-Host are the client's to say)
  let ret = ORIGIN + '/play?paid=yookassa';
  if (b.return_url != null) {
    let x = null; try { x = new URL(String(b.return_url)); } catch (e) {}
    if (!x || !/^https?:$/.test(x.protocol) || !OWN_ORIGINS.has(x.origin) || String(b.return_url).length > 512 || x.username || x.password) return J(res, 400, { error: 'return_url' });
    ret = x.toString();
  }
  // the 54-FZ receipt (YOOKASSA_RECEIPT=1): the buyer's email, checked here and handed to YooKassa only
  const rc = ykReceipt(sku, b.email);
  if (rc === false) return J(res, 400, { error: 'email' });
  // payments left open on the payment page: a few per visitor, then wait (each one is a real payment at YooKassa)
  // (a double click inside a minute gets the same payment back: YooKassa's own idempotence, and no new order here)
  const now = Date.now(), idem = crypto.createHash('sha256').update(['yk', v, sku, ret, Math.floor(now / 60e3), rc ? rc.customer.email : ''].join('|')).digest('hex').slice(0, 36);
  const open = (ledger.ordersByV.get(v) || []).map(k => ledger.orders.get(k)).filter(o => o && o.prov === 'yookassa' && o.state === 'pending' && now - o.at < 3600e3);
  if (open.length >= YK_OPEN_PER_V && !open.some(o => o.idem === idem.slice(0, 12))) { stat.ykBusy++; return J(res, 429, { error: 'pending' }); }
  if (limitedH('ykc:' + ipKey(req), STORE_PER_NET_H) || !budget('g:ykc', STORE_G_MIN, STORE_G_HOUR)) { stat.ykBusy++; return J(res, 429, { error: 'slow down' }); }
  const P = priceOf(sku);
  try {
    const p = await ykCall('POST', '/payments', Object.assign({ amount: { value: P.rub.toFixed(2), currency: 'RUB' }, capture: true, confirmation: { type: 'redirect', return_url: ret }, description: ('BTTN: ' + SKUS[sku].ru).slice(0, 128), metadata: { sku, v } }, rc ? { receipt: rc } : {}), idem);
    const url = p && p.confirmation && p.confirmation.confirmation_url;
    if (!p || !YK_ID.test(String(p.id)) || typeof url !== 'string' || !/^https:\/\//.test(url)) throw new Error('yookassa create: no confirmation url');
    if (!ledger.orders.has('yookassa:' + p.id)) ledgerWrite([{ t: 'order', prov: 'yookassa', pid: String(p.id), sku, v, amt: P.rub, cur: 'RUB', at: Date.now(), idem: idem.slice(0, 12), test: p.test ? 1 : undefined }]);
    stat.ykCreated++;
    return J(res, 200, { confirmation_url: url, id: String(p.id) });
  } catch (e) { log('store: yookassa create failed:', e.message); return J(res, 502, { error: 'provider' }); }
}
// the receipt object (YooKassa API v3 'receipt'): null when receipts are off, false when the email is missing or bad
const YK_RECEIPT = () => env('YOOKASSA_RECEIPT') === '1';
const MAIL_RE = /^[^\s@<>"(),;:\\]{1,64}@[a-z0-9.-]{1,190}\.[a-z]{2,24}$/i;
function ykReceipt(sku, email) {
  if (!YK_RECEIPT()) return null;
  const m = typeof email === 'string' ? email.trim() : '';
  if (!MAIL_RE.test(m) || m.length > 254) return false;
  const vat = /^[1-6]$/.test(env('YOOKASSA_VAT_CODE')) ? +env('YOOKASSA_VAT_CODE') : 1, tax = env('YOOKASSA_TAX_SYSTEM');
  const r = { customer: { email: m }, items: [{ description: ('BTTN: ' + SKUS[sku].ru).slice(0, 128), quantity: '1.00', amount: { value: priceOf(sku).rub.toFixed(2), currency: 'RUB' }, vat_code: vat, payment_mode: 'full_payment', payment_subject: /^[a-z_]{3,40}$/.test(env('YOOKASSA_SUBJECT')) ? env('YOOKASSA_SUBJECT') : 'service' }] };
  if (/^[1-6]$/.test(tax)) r.tax_system_code = +tax;
  return r;
}
// the one place a YooKassa payment becomes a grant: its state as the API reports it, never as a notification says
async function ykSettle(pid) {
  const o = ledger.orders.get('yookassa:' + pid); if (o) o.checked = Date.now();
  const p = await ykCall('GET', '/payments/' + encodeURIComponent(pid));
  if (String(p.id) !== pid) throw new Error('yookassa: id mismatch');
  if (p.status === 'canceled') { if (o) o.state = 'canceled'; return null; }
  if (p.status !== 'succeeded' || p.paid !== true) return null;
  const md = p.metadata || {}, amt = Number(p.amount && p.amount.value) || 0;
  if (!okSku(md.sku) || typeof md.v !== 'string' || !VID_RE.test(md.v)) { if (!ledger.byKey.has('yookassa:' + pid)) orphan('yookassa', pid, amt, 'RUB', 'metadata'); return null; }
  const want = o && o.sku === md.sku ? o.amt : priceOf(md.sku).rub;
  const short = (p.amount && p.amount.currency) !== 'RUB' || amt + 1e-9 < want;
  return grant('yookassa', pid, md.sku, md.v, amt, 'RUB', Object.assign({}, p.test ? { test: 1 } : {}, short ? { flag: 'amount', hold: 1 } : {})).g;
}
const YK_NETS = ['185.71.76.0/27', '185.71.77.0/27', '77.75.153.0/25', '77.75.156.11/32', '77.75.156.35/32', '77.75.154.128/25'];
const ip4 = s => { const m = /^(?:::ffff:)?(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/i.exec(s); return m ? ((+m[1] << 24) >>> 0) + (+m[2] << 16) + (+m[3] << 8) + +m[4] : null; };
const ykIpOk = ip => /^2a02:5180:/i.test(ip) || (n => n != null && YK_NETS.some(c => { const [a, bits] = c.split('/'), mask = (~0 << (32 - +bits)) >>> 0; return ((n & mask) >>> 0) === ((ip4(a) & mask) >>> 0); }))(ip4(ip));
async function ykWebhook(req, res, b) {
  if (!PROV.yookassa()) return J(res, 503, { error: 'off' });
  if (env('YOOKASSA_IP_CHECK') === '1' && !ykIpOk(ipOf(req))) { stat.hookBad++; return J(res, 403, { error: 'ip' }); }
  const ev = String(b.event || ''), id = String((b.object && b.object.id) || '');
  if (!YK_ID.test(id)) { stat.hookBad++; return J(res, 400, { error: 'id' }); }
  // every payment is created here, so a notification about one we know is checked at once (granted already: nothing to
  // ask). Anything else (an order older than a week, a refund, a forged id) shares a small budget for the whole server:
  // past it the answer is 503 and YooKassa asks again later, so a flood of made-up ids can't spend our API quota
  const known = ev.startsWith('payment.') ? ledger.orders.has('yookassa:' + id) : ev === 'refund.succeeded' && ledger.byKey.has('yookassa:' + String((b.object && b.object.payment_id) || ''));
  if (ev.startsWith('payment.') && ledger.byKey.has('yookassa:' + id)) return J(res, 200, { ok: true });
  if (!known && !budget('g:ykhook', 6, 60)) { stat.hookBad++; return J(res, 503, { error: 'busy' }); }
  try {
    if (ev.startsWith('payment.')) await ykSettle(id);
    else if (ev === 'refund.succeeded') {
      const r = await ykCall('GET', '/refunds/' + encodeURIComponent(id));
      const gid = r && r.status === 'succeeded' && ledger.byKey.get('yookassa:' + String(r.payment_id || '')), g = gid && ledger.grants.get(gid);
      if (g && Number(r.amount && r.amount.value) + 1e-9 >= g.amt) refund(gid); else if (g) log('store: partial refund on ' + gid + ', grant kept');
    }
  } catch (e) {
    // a made-up id: nothing to do (200 stops the retries); anything else: 502, YooKassa tries again for a day
    if (e.status === 404) { stat.hookBad++; return J(res, 200, { ok: true }); }
    log('store: yookassa webhook failed:', e.message); return J(res, 502, { error: 'provider' });
  }
  return J(res, 200, { ok: true });
}

// --- Yandex Games: a signed purchase ('<base64 HMAC-SHA256>.<base64 JSON>', key = the game's secret) ---
function yaVerify(req, res, b) {
  const key = env('YANDEX_GAMES_SECRET');
  if (!key) return J(res, 503, { error: 'off' });
  const v = b.v, sig = typeof b.signature === 'string' ? b.signature : '';
  if (typeof v !== 'string' || !VID_RE.test(v)) return J(res, 400, { error: 'v' });
  const dot = sig.indexOf('.');
  if (dot < 1) return J(res, 400, { error: 'signature' });
  // Yandex signs the DECODED payload (its docs: hmac.update(Buffer.from(data, 'base64').toString('utf8')); Python
  // hmac.new(secret, base64.b64decode(data))), not the base64 text after the dot
  const norm = x => x.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  const raw = Buffer.from(norm(sig.slice(dot + 1)), 'base64');
  if (!raw.length || !safeEq(norm(sig.slice(0, dot)), norm(crypto.createHmac('sha256', key).update(raw).digest('base64')))) { stat.yaBadSig++; return J(res, 403, { error: 'signature' }); }
  let p; try { p = JSON.parse(raw.toString('utf8')); } catch (e) { return J(res, 400, { error: 'payload' }); }
  const items = p && Array.isArray(p.data) ? p.data : p && p.data && typeof p.data === 'object' ? [p.data] : [];
  const grants = [], tokens = [];
  try {
    for (const it of items.slice(0, 50)) {
      if (!it || typeof it !== 'object' || it.errorCode) continue;
      const tok = String(it.token || it.purchaseToken || ''), sku = (it.product && it.product.id) || it.productID;
      if (!tok || tok.length > 200 || !okSku(sku)) continue;
      // a developerPayload that names another visitor: bought by someone else (a replayed signature gets nothing)
      if (typeof it.developerPayload === 'string' && VID_RE.test(it.developerPayload) && it.developerPayload !== v) continue;
      const price = (it.product && it.product.price) || {};
      const r = grant('yandex', tok, sku, v, +price.value || 0, String(price.code || 'YAN').slice(0, 8));
      if (r.g.v !== v) continue;
      tokens.push(tok);
      if (!r.g.acked && !r.g.refunded && !r.g.hold) grants.push(view(r.g));
    }
  } catch (e) { log('store: yandex verify failed:', e.message); return J(res, 500, { error: 'ledger' }); }
  stat.yaVerified++;
  // tokens: the purchases this server holds for you, safe to consumePurchase() once the grants are saved
  return J(res, 200, { grants, tokens });
}

// --- VK Mini Apps payments callback (form POST; sig = md5 of the sorted k=v pairs + the app's secure key) ---
const vkSig = (o, secret) => crypto.createHash('md5').update(Object.keys(o).filter(k => k !== 'sig').sort().map(k => k + '=' + o[k]).join('') + secret).digest('hex');
// item: '<sku>' or '<sku>:<visitor id>' (VKWebAppShowOrderBox {type:'item', item})
function vkItem(s) { const m = /^([a-z0-9_]{2,32})(?:[:|~]([a-z0-9]{6,24}))?$/.exec(String(s || '')); return m && okSku(m[1]) ? { sku: m[1], v: m[2] || '' } : null; }
// signed launch params (the Mini App's query string): sign = base64url(HMAC-SHA256(secret, sorted vk_* params))
function vkLaunch(raw) {
  const secret = env('VK_APP_SECRET'); if (!secret || typeof raw !== 'string' || !raw || raw.length > 4096) return null;
  const q = new URLSearchParams(raw.replace(/^[?#]/, '')), sign = q.get('sign'); if (!sign) return null;
  const o = {}; for (const [k, v] of q) if (k.startsWith('vk_')) o[k] = v;
  const str = require('querystring').stringify(Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k]])));
  if (!safeEq(sign, b64url(hmac(secret, str)))) return null;
  if (env('VK_APP_ID') && o.vk_app_id !== env('VK_APP_ID')) return null;
  // signed launch params are a credential for 'vk:<user id>': they expire (the game reads fresh ones at every launch),
  // so a leaked Mini App link doesn't open that player's grants for good
  const age = Date.now() / 1000 - (+o.vk_ts || 0);
  if (!(age < VK_LAUNCH_TTL && age > -3600)) return null;
  return { uid: String(o.vk_user_id || '') };
}
const VK_LAUNCH_TTL = 72 * 3600;
function vkCallback(req, res, raw) {
  const out = o => J(res, 200, o), err = (code, msg, critical) => out({ error: { error_code: code, error_msg: msg, critical: !!critical } });
  const secret = env('VK_APP_SECRET');
  if (!secret) return J(res, 503, { error: 'off' });
  const o = Object.create(null);
  for (const [k, v] of new URLSearchParams(raw.toString('utf8'))) o[k] = v;
  if (!o.sig || !safeEq(String(o.sig).toLowerCase(), vkSig(o, secret))) { stat.vkBadSig++; return err(10, 'signature mismatch', true); }
  if (env('VK_APP_ID') && o.app_id !== env('VK_APP_ID')) return err(11, 'app mismatch', true);
  const type = String(o.notification_type || ''), test = type.endsWith('_test'), it = vkItem(o.item), lang = /^ru|^0$/.test(String(o.lang || '')) ? 'ru' : 'en';
  if (type === 'get_item' || type === 'get_item_test') {
    if (!it) return err(20, 'no such item', true);
    if (!PAY_ON()) return err(21, 'store closed', true);
    if (SKUS[it.sku].once && it.v && owned(it.v, it.sku)) return err(21, 'already owned', true);
    return out({ response: { item_id: it.sku, title: SKUS[it.sku][lang], price: priceOf(it.sku).votes, photo_url: ORIGIN + '/assets/icon-192.png', expiration: 3600 } });
  }
  if (type === 'order_status_change' || type === 'order_status_change_test') {
    const oid = String(o.order_id || '');
    if (!/^\d{1,18}$/.test(oid)) return err(11, 'bad order id', true);
    // VK cancelled a paid order: take the grant back (a delivered one stays with the player, marked in /admin) and say
    // yes; an order we never granted is fine too (logged)
    if (o.status === 'refunded') {
      const gid = ledger.byKey.get('vk:' + oid);
      if (gid) { try { refund(gid); stat.vkRefunds++; } catch (e) { return err(2, 'temporary error', false); } } else log('store: vk refund for an order we never granted: ' + oid);
      return out({ response: { order_id: Number(oid), app_order_id: gid ? parseInt(gid.slice(2, 14), 16) : 0 } });
    }
    if (o.status !== 'chargeable') return err(100, 'unsupported status', true);
    if (!it) { try { if (!ledger.byKey.has('vk:' + oid)) orphan('vk', oid, +o.item_price || 0, 'VOTES', 'item'); } catch (e) { return err(2, 'temporary error', false); } return err(20, 'no such item', true); }
    const v = it.v || 'vk:' + String(o.receiver_id || o.user_id || '').replace(/\D/g, '').slice(0, 12);
    if (!VID_RE.test(v) && !VKV_RE.test(v)) return err(11, 'no receiver', true);
    const price = +o.item_price || 0, short = price < priceOf(it.sku).votes;
    let r; try { r = grant('vk', oid, it.sku, v, price, 'VOTES', Object.assign({}, test ? { test: 1 } : {}, short ? { flag: 'amount', hold: 1 } : {})); } catch (e) { return err(2, 'temporary error', false); }
    return out({ response: { order_id: Number(oid), app_order_id: parseInt(r.g.id.slice(2, 14), 16) } });
  }
  return err(100, 'unknown notification', true);
}

// --- claim and ack: the client takes its grants (at least once) and acks them (then never again) ---
// a 'vk:<user id>' key is claimed only with that user's signed launch params (header x-vk-params)
function vOk(req, v) {
  if (typeof v !== 'string') return false;
  if (VID_RE.test(v)) return true;
  if (VKV_RE.test(v)) { const L = vkLaunch(String(req.headers['x-vk-params'] || '')); return !!L && L.uid === v.slice(3); }
  return false;
}
async function claim(req, res, v) {
  if (!vOk(req, v)) return J(res, VKV_RE.test(String(v)) ? 401 : 400, { error: 'v' });
  // back from the YooKassa page before its webhook landed (or no webhook set up at all): ask YooKassa directly
  if (PROV.yookassa()) {
    const now = Date.now(), mine = (ledger.ordersByV.get(v) || []).map(k => ledger.orders.get(k)).filter(o => o && o.prov === 'yookassa' && o.state === 'pending' && now - o.at < 864e5 && now - o.checked > 10e3).slice(-3);
    // (a shared budget too: past it the claim answers from the ledger and the webhook settles the rest)
    if (mine.length && budget('g:ykpoll', 120, 3000)) await Promise.race([Promise.all(mine.map(o => ykSettle(o.pid).catch(e => log('store: yookassa check failed:', e.message)))), new Promise(r => setTimeout(r, 6000))]);
  }
  return J(res, 200, { grants: claimable(v).map(view) });
}
function ack(req, res, b) {
  if (!vOk(req, b.v)) return J(res, VKV_RE.test(String(b.v)) ? 401 : 400, { error: 'v' });
  if (!Array.isArray(b.ids) || b.ids.length > 100) return J(res, 400, { error: 'ids' });
  const now = Date.now(), lines = [];
  for (const id of new Set(b.ids)) { const g = typeof id === 'string' && ledger.grants.get(id); if (g && g.v === b.v && !g.acked) lines.push({ t: 'ack', id, at: now }); }
  try { if (lines.length) ledgerWrite(lines); } catch (e) { log('store: ack failed:', e.message); return J(res, 500, { error: 'ledger' }); }
  return J(res, 200, { ok: true, acked: lines.length });
}

// --- /admin: what was sold, through which rail, and what is still waiting to be delivered ---
// free space on the data volume (events, the ledger and the boards all live there; a full disk refuses payments)
function diskFree() {
  try { const f = fs.statfsSync(DATA); const free = f.bavail * f.bsize, total = f.blocks * f.bsize; return { free, total, low: free < Math.max(50 * 1048576, total * 0.05) }; } catch (e) { return null; }
}
function storeStats() {
  const now = Date.now(), G = [...ledger.grants.values()], real = G.filter(g => !g.test && g.prov !== 'admin');
  const rev = {}, bySku = {}, days = {};
  for (const g of real) {
    bump(bySku, g.sku);
    if (g.refunded) continue;
    const k = g.prov + ' · ' + g.cur, o = rev[k] || (rev[k] = { prov: g.prov, cur: g.cur, n: 0, sum: 0 }); o.n++; o.sum = Math.round((o.sum + g.amt) * 100) / 100;
    if (now - g.at < 30 * 864e5) bump(days, dayKey(g.at));
  }
  const pend = G.filter(g => !g.acked && !g.refunded && !g.hold);
  const orders = [...ledger.orders.values()];
  return {
    on: PAY_ON(), selling: storeProviders(), providers: Object.keys(PROV).map(k => ({ k, on: PROV[k](), missing: PROV_ENV[k].filter(e => !env(e)) })),
    purchases: real.length, refunds: real.filter(g => g.refunded).length, tests: G.length - real.length,
    revenue: Object.values(rev).sort((a, b) => b.n - a.n), bySku: top(bySku, 20), byDay: Object.entries(days).sort(),
    pending: { n: pend.length, oldest: pend.length ? Math.round((now - Math.min(...pend.map(g => g.at))) / 60e3) : 0 },
    held: G.filter(g => g.hold && !g.refunded).length, orphans: ledger.orphans.slice(-20).reverse(),
    orders: { pending: orders.filter(o => o.state === 'pending' && now - o.at < 864e5).length, canceled: orders.filter(o => o.state === 'canceled').length, total: orders.length + ledger.oldOrders },
    // the ledger's health: unreadable lines (money someone may have paid: grant by hand), a failed write, the disk
    health: { lines: ledger.lines, bad: ledger.bad, badLines: ledger.badLines.slice(-20), writeFail: ledger.writeFail, disk: diskFree() },
    recent: G.slice().sort((a, b) => b.at - a.at).slice(0, 40).map(g => ({ id: g.id, at: g.at, prov: g.prov, sku: g.sku, v: g.v, amt: g.amt, cur: g.cur, acked: !!g.acked, refunded: !!g.refunded, test: !!g.test, flag: g.flag, hold: !!g.hold })),
    counters: stat, csp: top(Object.fromEntries(cspSeen), 15), skus: Object.keys(SKUS),
    telegramHook: ORIGIN + '/api/store/telegram/webhook', yookassaHook: ORIGIN + '/api/store/yookassa/webhook', vkHook: ORIGIN + '/api/store/vk/callback',
  };
}

// ======================================================================================================
// ---------- 4.0: the public Daily Siege board (ADDENDUM 11; DESIGN §6.5) ----------
// One file per UTC day ($DATA_DIR/daily-YYYY-MM-DD.json), held in memory while in use, written whole (fsynced, renamed
// into place; the file from before the last write kept as .prev). The first attempt per visitor per day is the ranked
// one; ranks: zones cleared, then time, then who was first. A post must match the day's own setup (Heat, Button, class
// and seed are all known here), the clock (20 s a zone at least; with a run token, no longer than the run has been
// going), and the caps per address. A visitor id costs nothing, so the caps are what hold a script back; a full board
// makes room (the address with the most rows loses its worst one) instead of turning everyone away.
const DAILY_MAX = Math.max(50, Math.min(200000, +env('DAILY_MAX') || 20000)); // rows on a day's board (hidden rows aside)
const DAILY_GRACE = 60 * 60e3; // a run that started before midnight UTC may still post for 1 h
const DAILY_PER_NET = 24, DAILY_PER_48 = 72; // rows a day from one IPv4 address / IPv6 /64 (a home, a school, a carrier's NAT), and from one IPv6 /48
const DAILY_G_MIN = 120, DAILY_G_HOUR = 3000; // new rows a minute / an hour for the whole board (past it: 'busy', the game posts later)
const DAILY_TOK_SLACK = 120; // seconds a run may have been going before its token was asked for
// the Daily Siege's fixed setup: js/run.js G.DAILY_SIEGE and G.dailySetup (FNV-1a of 'bttn-siege|<day>'). Keep the two in
// step (tests/platform-fix/server_fix_test.js compares them); DAILY_STRICT=0 turns the setup check off if the game changes
// first. DAILY_TOKEN=1 makes the run token (POST /api/daily/start at the run's start) required; by default a post is
// checked against its token when it brings one, and rows without one are marked in /admin.
const DAILY_RULES = { heat: 2, btn: 'classic', classes: ['knight', 'archer', 'wizard'] };
const DAILY_STRICT = env('DAILY_STRICT') !== '0', DAILY_TOKEN = env('DAILY_TOKEN') === '1';
const fnv1a = str => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; };
const dailySetup = day => { const seed = fnv1a('bttn-siege|' + day); return { seed, heat: DAILY_RULES.heat, btn: DAILY_RULES.btn, cls: DAILY_RULES.classes[seed % DAILY_RULES.classes.length] }; };
// the run token: when this server first heard of the run (t0), signed for this visitor and day; no state kept
const DAILY_KEY = crypto.createHash('sha256').update('bttn-daily-token|' + SALT).digest();
const dailyTok = (v, day, t0) => b64url(hmac(DAILY_KEY, 'dt|' + v + '|' + day + '|' + t0)).slice(0, 22) + '.' + t0.toString(36);
const dailyTokT0 = (tok, v, day) => { const m = /^[A-Za-z0-9_-]{22}\.([0-9a-z]{6,10})$/.exec(typeof tok === 'string' ? tok : ''); if (!m) return null; const t0 = parseInt(m[1], 36); return safeEq(tok, dailyTok(v, day, t0)) ? t0 : null; };
const dailyDays = new Map();
const dayFile = d => path.join(DATA, 'daily-' + d + '.json');
const cmpRow = (a, b) => b.zones - a.zones || a.secs - b.secs || a.at - b.at;
const vHash = v => crypto.createHash('sha256').update(SALT + '|daily|' + v).digest('hex').slice(0, 16);
const validDay = d => typeof d === 'string' && /^\d{4}-\d\d-\d\d$/.test(d) && !isNaN(Date.parse(d + 'T00:00:00Z')) && new Date(d + 'T00:00:00Z').toISOString().slice(0, 10) === d;
// who has posted (rows, and rows that made room on a full board: 'gone'), and the counts per address (posts a day, rows
// on the board now)
function dayIndex(D) {
  D.byV = new Map(); D.seen = new Set(); D.byNet = new Map(); D.by48 = new Map(); D.onNet = new Map(); D.hidN = 0;
  const add = (m, k) => { if (k) m.set(k, (m.get(k) || 0) + 1); };
  for (const r of D.rows) { D.byV.set(r.vh, r); D.seen.add(r.vh); add(D.byNet, r.ih); add(D.by48, r.i48 || r.ih); if (r.hid) D.hidN++; else add(D.onNet, r.ih); }
  for (const g of D.gone) { D.seen.add(g[0]); add(D.byNet, g[1]); add(D.by48, g[2] || g[1]); }
}
function dayLoad(d) {
  let D = dailyDays.get(d);
  if (D) { D.used = Date.now(); return D; }
  D = { day: d, rows: [], gone: [], dirty: false, writing: false, used: Date.now(), ro: 0, restored: 0 };
  const f = dayFile(d), read = x => { const j = JSON.parse(fs.readFileSync(x, 'utf8')); if (!j || typeof j !== 'object' || !Array.isArray(j.rows)) throw new Error('no rows'); return j; };
  let j = null;
  try { j = read(f); } catch (e) {
    if (e.code !== 'ENOENT') {
      // damaged (a crash, a full disk): never written over. Kept aside for a person to look at; the copy from before the
      // last write takes its place, or the day goes read-only until /admin starts its board again
      const bad = f + '.bad-' + Date.now();
      try { fs.renameSync(f, bad); } catch (e2) {}
      log('daily: ' + path.basename(f) + ' is unreadable (' + String(e.message).slice(0, 60) + '), kept as ' + path.basename(bad));
      try { j = read(f + '.prev'); D.restored = 1; log('daily: ' + d + ' restored from the copy before its last write'); } catch (e3) { D.ro = 1; log('daily: no good copy of ' + d + ': its board is read-only until /admin starts it again'); }
    }
  }
  if (j) {
    const seen = new Set();
    for (const r of j.rows) if (r && typeof r === 'object' && typeof r.vh === 'string' && !seen.has(r.vh)) { seen.add(r.vh); D.rows.push(r); }
    if (Array.isArray(j.gone)) D.gone = j.gone.filter(g => Array.isArray(g) && typeof g[0] === 'string');
  }
  D.rows.sort(cmpRow);
  dayIndex(D);
  dailyDays.set(d, D);
  if (D.restored) daySave(D);
  if (dailyDays.size > 8) { const old = [...dailyDays.values()].filter(x => x !== D && !x.dirty && !x.writing).sort((a, b) => a.used - b.used)[0]; if (old) dailyDays.delete(old.day); }
  return D;
}
function daySave(D) {
  if (D.ro) return;
  if (D.writing) { D.dirty = true; return; }
  D.writing = true; D.dirty = false;
  const f = dayFile(D.day), tmp = f + '.tmp', prev = f + '.prev';
  const done = e => { D.writing = false; if (e) { D.dirty = true; log('daily: write failed:', e.message); } else if (D.dirty) daySave(D); };
  fs.open(tmp, 'w', (e, fd) => {
    if (e) return done(e);
    fs.writeFile(fd, JSON.stringify({ day: D.day, v: 2, rows: D.rows, gone: D.gone }), e1 => fs.fsync(fd, e2 => fs.close(fd, e3 => {
      if (e1 || e2 || e3) return done(e1 || e2 || e3);
      // the file being replaced stays as .prev (a hard link, no copy), then the new one takes its name in one step
      fs.unlink(prev + '.tmp', () => fs.link(f, prev + '.tmp', el => {
        const swap = () => fs.rename(tmp, f, done);
        if (el) return swap();
        fs.rename(prev + '.tmp', prev, swap);
      }));
    })));
  });
}
const visible = D => D.rows.filter(r => !r.hid);
const pubRow = (r, rank) => ({ rank, name: r.name, zones: r.zones, secs: r.secs, btn: r.btn, cls: r.cls, heat: r.heat });
// a name: 16 letters/digits/spaces/_- (any script), NFKC-folded, so no markup, no bidi tricks, no zalgo
const cleanName = s => [...(typeof s === 'string' ? s.normalize('NFKC') : '').replace(/[^\p{L}\p{N} _-]/gu, '').replace(/\s+/g, ' ').trim()].slice(0, 16).join('').trim() || 'Hand';
const idOf = x => (typeof x === 'string' && /^[a-z0-9_-]{1,24}$/i.test(x) ? x.toLowerCase() : null);
function dailyGet(req, res, u) {
  const now = Date.now(), today = dayKey(now), day = u.searchParams.get('day') || today, v = u.searchParams.get('v') || '';
  if (!validDay(day) || day > today || day < dayKey(now - KEEP_DAYS * 864e5)) return J(res, 400, { error: 'day' });
  if (day !== today && !dailyDays.has(day) && !fs.existsSync(dayFile(day))) return J(res, 200, { day, top: [], you: null, n: 0 });
  const D = dayLoad(day), vis = visible(D);
  let you = null;
  if (VID_RE.test(v)) { const vh = vHash(v), i = vis.findIndex(r => r.vh === vh); if (i >= 0) you = pubRow(vis[i], i + 1); }
  return J(res, 200, { day, top: vis.slice(0, 50).map((r, i) => pubRow(r, i + 1)), you, n: vis.length });
}
// the run's start: a token that dates it (the post may then claim no more time than has passed since)
function dailyStart(req, res, b) {
  const now = Date.now(), { day, v } = b;
  if (typeof v !== 'string' || !VID_RE.test(v)) return J(res, 400, { error: 'v' });
  if (day !== dayKey(now)) return J(res, 400, { error: 'day' });
  return J(res, 200, { tok: dailyTok(v, day, now), t0: now });
}
// a full board makes room: the worst row of the address with the most rows on it (a flood pays for itself); with no
// such address, the last row. The visitor stays 'seen' (no second post), and the address keeps the count.
function dayEvict(D) {
  let net = null, max = 1;
  for (const [k, n] of D.onNet) if (n > max) { max = n; net = k; }
  for (let i = D.rows.length - 1; i >= 0; i--) {
    const r = D.rows[i];
    if (r.hid || (net && r.ih !== net)) continue;
    D.rows.splice(i, 1); D.byV.delete(r.vh); D.gone.push([r.vh, r.ih || '', r.i48 || '']);
    D.onNet.set(r.ih, (D.onNet.get(r.ih) || 1) - 1);
    return true;
  }
  return false;
}
function dailyPost(req, res, b, ih, i48) {
  const now = Date.now(), today = dayKey(now), { day, zones, secs, heat, v } = b;
  if (typeof v !== 'string' || !VID_RE.test(v)) return J(res, 400, { error: 'v' });
  // today (UTC); yesterday only within the first hour of today, for a run that crossed midnight
  if (day !== today && !(day === dayKey(now - 864e5) && now - Date.parse(today + 'T00:00:00Z') < DAILY_GRACE)) return J(res, 400, { error: 'day' });
  if (!Number.isInteger(zones) || zones < 0 || zones > 18) return J(res, 400, { error: 'zones' });
  // 20 s a zone at the very least, and no longer than the day has lasted
  if (typeof secs !== 'number' || !isFinite(secs) || secs < 1 || secs < 20 * zones || secs > 6 * 3600 || secs > (now - Date.parse(day + 'T00:00:00Z')) / 1000 + 60) return J(res, 400, { error: 'secs' });
  if (heat != null && (!Number.isInteger(heat) || heat < 0 || heat > 10)) return J(res, 400, { error: 'heat' });
  const btn = idOf(b.btn), cls = idOf(b.cls);
  if (!btn || !cls) return J(res, 400, { error: 'btn' });
  // the day's own setup: everyone plays the same Heat, Button, class and seed
  if (DAILY_STRICT) { const w = dailySetup(day); if (heat !== w.heat || btn !== w.btn || cls !== w.cls || String(b.seed) !== String(w.seed)) return J(res, 400, { error: 'setup' }); }
  // the run token: no more time claimed than has passed since the run began here
  let nt = 0;
  if (b.tok != null && b.tok !== '') {
    const t0 = dailyTokT0(b.tok, v, day);
    if (t0 == null) return J(res, 400, { error: 'token' });
    if (secs > (now - t0) / 1000 + DAILY_TOK_SLACK) return J(res, 400, { error: 'secs' });
  } else if (DAILY_TOKEN) return J(res, 400, { error: 'token' });
  else nt = 1;
  const D = dayLoad(day), vh = vHash(v), had = D.byV.get(vh);
  if (had) { const i = visible(D).indexOf(had); return J(res, 409, { error: 'already', rank: i >= 0 ? i + 1 : null }); }
  if (D.seen.has(vh)) return J(res, 409, { error: 'already', rank: null });
  if (D.ro) return J(res, 503, { error: 'busy' });
  // the caps: rows a day per address (kept with the rows, so a restart doesn't reset them), then the whole board's pace
  if ((D.byNet.get(ih) || 0) >= DAILY_PER_NET || (D.by48.get(i48) || 0) >= DAILY_PER_48) return J(res, 429, { error: 'too many today' });
  if (!budget('g:daily', DAILY_G_MIN, DAILY_G_HOUR)) return J(res, 503, { error: 'busy' });
  if (D.rows.length - D.hidN >= DAILY_MAX) dayEvict(D);
  const r = { vh, ih, i48, name: cleanName(b.name), zones, secs: Math.round(secs * 10) / 10, btn, cls, heat: heat | 0, seed: b.seed == null ? '' : String(b.seed).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40), at: now };
  if (nt) r.nt = 1;
  let lo = 0, hi = D.rows.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (cmpRow(D.rows[mid], r) <= 0) lo = mid + 1; else hi = mid; }
  D.rows.splice(lo, 0, r); D.byV.set(vh, r); D.seen.add(vh);
  for (const [m, k] of [[D.byNet, ih], [D.by48, i48], [D.onNet, ih]]) m.set(k, (m.get(k) || 0) + 1);
  daySave(D);
  return J(res, 200, { ok: true, rank: visible(D).indexOf(r) + 1 });
}
// the boards older than KEEP_DAYS go, like the events (and their .prev / .bad copies)
try { const cut = dayKey(Date.now() - KEEP_DAYS * 864e5); for (const f of fs.readdirSync(DATA)) { const m = /^daily-(\d{4}-\d\d-\d\d)\.json(\.prev|\.bad-\d+)?$/.exec(f); if (m && m[1] < cut) fs.unlinkSync(path.join(DATA, f)); } } catch (e) {}

// ---------- CSP violation reports (report-uri /api/csp): counted in memory, shown in /admin ----------
const cspSeen = new Map();
const uaFamily = ua => (/firefox\//i.test(ua) ? 'firefox' : /edg\//i.test(ua) ? 'edge' : /chrome\//i.test(ua) ? 'chrome' : /safari\//i.test(ua) ? 'safari' : 'other');
function cspReport(buf, req) {
  let j; try { j = JSON.parse(buf.toString('utf8')); } catch (e) { return; }
  const list = Array.isArray(j) ? j.filter(x => x && x.type === 'csp-violation').map(x => x.body || {}) : [(j && j['csp-report']) || {}];
  for (const r of list.slice(0, 20)) {
    const dir = String(r['effective-directive'] || r.effectiveDirective || r['violated-directive'] || '').split(' ')[0].slice(0, 40);
    let blocked = String(r['blocked-uri'] || r.blockedURL || '').slice(0, 200), doc = '';
    try { if (/^[a-z][a-z0-9+.-]*:\/\//i.test(blocked)) blocked = new URL(blocked).origin; } catch (e) {}
    try { doc = new URL(String(r['document-uri'] || r.documentURL || '')).pathname.slice(0, 40); } catch (e) {}
    const k = (doc || '?') + ' · ' + (dir || '?') + ' · ' + (blocked || '?');
    // (each new kind also goes to the log once, with the browser family, so it can be read without the dashboard)
    if (!cspSeen.has(k) && cspSeen.size < 300) log('csp report:', k, '·', uaFamily(String((req && req.headers['user-agent']) || '')), '·', String(r['script-sample'] || r.sample || '').slice(0, 60));
    if (cspSeen.size < 300 || cspSeen.has(k)) cspSeen.set(k, (cspSeen.get(k) || 0) + 1);
  }
}

// ---------- CORS: portal builds hosted elsewhere (Yandex Games' own CDN) call the public APIs; no cookies anywhere ----------
const ORIGINS = ['https://*.games.s3.yandex.net', 'https://yandex.ru', 'https://*.yandex.ru', 'https://*.yandex.com', 'https://*.yandex.net', 'https://vk.com', 'https://*.vk.com', 'https://*.vk-apps.com', 'https://web.telegram.org', ...env('ALLOWED_ORIGINS').split(',')].map(s => s.trim()).filter(Boolean);
const ORIGIN_RE = ORIGINS.map(s => (s === '*' ? /^https?:\/\/[^/]+$/i : new RegExp('^' + s.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[a-z0-9-]+(?:\\.[a-z0-9-]+)*') + '$', 'i')));
const corsOf = req => { const o = String(req.headers.origin || ''); return o && o !== ORIGIN && ORIGIN_RE.some(r => r.test(o)) ? { 'access-control-allow-origin': o, vary: 'origin' } : null; };

// ---------- the numbers ----------
const pct = (a, b) => (b ? Math.round(1000 * a / b) / 10 : 0);
const med = a => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
const bump = (o, k, n = 1) => { k = k || '(none)'; o[k] = (o[k] || 0) + n; };
const top = (o, n = 12) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
const srcKey = t => (t && (t.src || (t.ref ? 'ref:' + t.ref : ''))) || '(direct)';
function stats(qs) {
  const now = Date.now();
  const to = qs.to ? Date.parse(qs.to + 'T23:59:59.999Z') : now, from = qs.from ? Date.parse(qs.from + 'T00:00:00Z') : now - 7 * 864e5;
  const wantBots = qs.bots === '1', fSrc = qs.src || '', fDev = qs.dev || '', fCc = qs.cc || '';
  const okV = V => (wantBots || !V.bot) && (!fSrc || srcKey(V.touch) === fSrc) && (!fDev || V.dev.type === fDev) && (!fCc || V.cc === fCc);
  const S = [...sessions.values()].filter(s => s.start >= from && s.start <= to && okV(visitors.get(s.vid)));
  const vids = new Set(S.map(s => s.vid));
  const V = [...vids].map(v => visitors.get(v));
  const fresh = V.filter(v => v.first >= from && v.first <= to);
  const days = [];
  for (let t = Date.parse(dayKey(from) + 'T00:00:00Z'); t <= to; t += 864e5) days.push(dayKey(t));
  const daily = {}; for (const d of days) daily[d] = { day: d, nw: new Set(), ret: new Set(), ses: 0, play: 0 };
  for (const s of S) { const D = daily[dayKey(s.start)]; if (!D) continue; const v = visitors.get(s.vid); (dayKey(v.first) === D.day ? D.nw : D.ret).add(s.vid); D.ses++; D.play += Math.max(0, s.pt - (s.pt0 || 0)) / 60; }
  const back = (v, n) => { const f = dayKey(v.first), want = dayKey(Date.parse(f + 'T00:00:00Z') + n * 864e5); return v.days.has(want); };
  const backAny = v => [...v.days].some(d => d > dayKey(v.first));
  const d1Base = fresh.filter(v => now - Date.parse(dayKey(v.first) + 'T00:00:00Z') >= 2 * 864e5);
  const live = [...sessions.values()].filter(s => now - s.last < 5 * 60e3 && (wantBots || !s.bot)).sort((a, b) => b.last - a.last).slice(0, 50)
    .map(s => ({ src: srcKey((visitors.get(s.vid) || {}).touch), dev: s.dev.type + ' · ' + s.dev.os, cc: s.cc, d: s.d, bd: s.bd, pt: Math.round(s.pt / 60), ago: Math.round((now - s.last) / 1000), secs: s.secs }));
  // the landing page: views in the range, how many pressed PLAY, by source and device
  const LV = [...lands.values()].filter(l => l.touch && l.ts >= from && l.ts <= to && okV(visitors.get(l.vid)));
  const lvIds = new Set(LV.map(l => l.vid)), lvVis = [...lvIds].map(id => visitors.get(id));
  const landRow = (rows, keyOf) => {
    const o = {};
    for (const l of rows) { const k = keyOf(l), x = o[k] || (o[k] = { k, views: 0, plays: 0, vids: new Set() }); x.views++; if (l.play) x.plays++; x.vids.add(l.vid); }
    return Object.values(o).map(x => { const vs = [...x.vids].map(id => visitors.get(id)); return { k: x.k, views: x.views, ctr: pct(x.plays, x.views), opened: pct(vs.filter(v => v.steps.start).length, vs.length), m5: pct(vs.filter(v => v.steps.m5).length, vs.length) }; }).sort((a, b) => b.views - a.views);
  };
  const lpos = {}, lfaq = {}, lsup = {}, lpf = {}, lui = {};
  for (const l of LV) { if (l.play) bump(lpos, l.pos); for (const q of l.faq) bump(lfaq, q); for (const k of l.sup) bump(lsup, k); for (const k of l.pf) bump(lpf, k); bump(lui, l.ui || 'en'); }
  const lPlays = LV.filter(l => l.play);
  const landing = {
    views: LV.length, visitors: lvIds.size, plays: lPlays.length, ctr: pct(lPlays.length, LV.length),
    visitorCtr: pct(lvVis.filter(v => v.steps.land_play).length, lvVis.length), opened: pct(lvVis.filter(v => v.steps.start).length, lvVis.length),
    s50: pct(LV.filter(l => l.s50).length, LV.length), s100: pct(LV.filter(l => l.s100).length, LV.length),
    secToPlay: lPlays.length ? Math.round(med(lPlays.map(l => l.ms)) / 100) / 10 : null,
    bySrc: landRow(LV, l => srcKey(l.touch)).slice(0, 20), byDev: landRow(LV, l => l.dev.type),
    pos: top(lpos), faq: top(lfaq), support: top(lsup), platform: top(lpf), ui: top(lui),
  };
  // the funnel, over visitors first seen in the range: the landing first (visitors who skip it, like /play links,
  // start at "Opened the game")
  const lnew = [...visitors.values()].filter(v => v.steps.land_view && v.first >= from && v.first <= to && okV(v));
  const FUN = [['land_view', 'Saw the landing'], ['land_play', 'Clicked Play'], ['visit', 'Opened the game'], ['intro', 'Got through the intro'], ['class', 'Picked a class'], ['first_click', 'Pressed the Button'], ['hold', 'Held the Button'], ['boss', 'Beat a boss'], ['tut', 'Finished the tutorial'], ['land2', 'Reached land 2'], ['depth5', 'Reached depth 5'], ['m5', 'Played 5 minutes'], ['land3', 'Reached land 3'], ['m15', 'Played 15 minutes'], ['recruit', 'Recruited a companion'], ['run_over', 'Lost a run (the Button fell)'], ['back', 'Came back another day']];
  const funnel = FUN.map(([k, label]) => ({ k, label, n: k === 'land_view' ? lnew.length : k === 'land_play' ? lnew.filter(v => v.steps.land_play).length : k === 'visit' ? fresh.length : k === 'back' ? fresh.filter(backAny).length : fresh.filter(v => v.steps[k]).length }));
  // sources: first touch
  const bySrc = {};
  for (const v of fresh) {
    const k = srcKey(v.touch), o = bySrc[k] || (bySrc[k] = { src: k, med: (v.touch && v.touch.med) || '', cmp: {}, n: 0, cls: 0, tut: 0, m5: 0, land2: 0, back: 0, d1n: 0, d1: 0, play: [], dev: {} });
    o.n++; if (v.steps.class) o.cls++; if (v.steps.tut) o.tut++; if (v.steps.m5) o.m5++; if (v.steps.land2) o.land2++; if (backAny(v)) o.back++;
    if (d1Base.includes(v)) { o.d1n++; if (back(v, 1)) o.d1++; }
    o.play.push(v.pt / 60); bump(o.dev, v.dev.type); if (v.touch && v.touch.cmp) bump(o.cmp, v.touch.cmp);
  }
  const sources = Object.values(bySrc).map(o => {
    const r = { src: o.src, med: o.med, campaigns: top(o.cmp, 5), visitors: o.n, cls: pct(o.cls, o.n), tut: pct(o.tut, o.n), m5: pct(o.m5, o.n), land2: pct(o.land2, o.n), back: pct(o.back, o.n), d1: o.d1n ? pct(o.d1, o.d1n) : null, medMin: Math.round(med(o.play) * 10) / 10, mobile: pct(o.dev.mobile || 0, o.n) };
    r.score = Math.round(0.2 * r.cls + 0.3 * r.m5 + 0.2 * r.land2 + 0.3 * (r.d1 != null ? r.d1 : r.back));
    return r;
  }).sort((a, b) => b.visitors - a.visitors);
  // campaigns (source + campaign + content)
  const byCmp = {};
  for (const v of fresh) { const t = v.touch || {}; if (!t.cmp && !t.cnt) continue; const k = [srcKey(t), t.cmp, t.cnt].join(' / '); const o = byCmp[k] || (byCmp[k] = { k, n: 0, m5: 0, back: 0 }); o.n++; if (v.steps.m5) o.m5++; if (backAny(v)) o.back++; }
  const campaigns = Object.values(byCmp).map(o => ({ k: o.k, visitors: o.n, m5: pct(o.m5, o.n), back: pct(o.back, o.n) })).sort((a, b) => b.visitors - a.visitors).slice(0, 30);
  // where they stop: sessions that ended and never came back that day
  const quitPlay = { '<30s': 0, '30s-1m': 0, '1-2m': 0, '2-5m': 0, '5-10m': 0, '10-20m': 0, '20-40m': 0, '40m+': 0 };
  const quitTut = {}, quitDepth = {};
  for (const v of fresh) {
    const m = v.pt / 60;
    bump(quitPlay, m < 0.5 ? '<30s' : m < 1 ? '30s-1m' : m < 2 ? '1-2m' : m < 5 ? '2-5m' : m < 10 ? '5-10m' : m < 20 ? '10-20m' : m < 40 ? '20-40m' : '40m+');
    if (!backAny(v)) {
      const last = S.filter(s => s.vid === v.vid).sort((a, b) => b.last - a.last)[0];
      if (last) { bump(quitTut, last.tut == null ? '(no tutorial data)' : last.tut === -1 ? 'done' : 'step ' + (last.tut + 1)); bump(quitDepth, 'depth ' + ((last.bd || 0) + 1)); }
    }
  }
  // devices and places, over visitors in range
  const dev = { type: {}, os: {}, br: {}, scr: {} }, geo = { cc: {}, lang: {}, tz: {} };
  for (const v of V) { bump(dev.type, v.dev.type); bump(dev.os, v.dev.os); bump(dev.br, v.dev.br); bump(geo.cc, v.cc); bump(geo.lang, (v.lang || '').slice(0, 2)); }
  for (const s of S) bump(dev.scr, s.scr);
  // the game itself
  const game = { cls: {}, bless: {}, champ: {}, land: {}, build: {}, recruit: {}, runOver: [], conts: { gems: 0, ad: 0 }, runEnd: 0, gems: 0, bossWin: 0, bossFail: 0, od: 0, relic: 0, jackpot: 0, ascend: 0 };
  // 4.0 runs (runEnd {kind, depth, mins, cause, heat, btn}; card/deed/door {id}; loot {r}; camp {a}) and the store funnel
  const runs = { start: 0, end: 0, win: 0, extract: 0, kind: {}, cause: {}, heat: {}, btn: {}, card: {}, deed: {}, door: {}, loot: {}, camp: {}, mins: [], depth: [] };
  const shop = { open: 0, start: 0, ok: 0, fail: 0, from: {}, prov: {}, sku: {}, why: {}, okProv: {}, ads: 0, adsOk: 0 };
  const errors = {};
  const hours = new Array(24).fill(0);
  for (const s of S) {
    hours[new Date(s.start).getUTCHours()]++;
    for (const [t, , d] of s.ev) {
      if (t === 'class') bump(game.cls, d.c);
      else if (t === 'bless') bump(game.bless, d.id);
      else if (t === 'champ') { const o = game.champ[d.m] || (game.champ[d.m] = { ok: 0, fail: 0 }); o[d.ok ? 'ok' : 'fail']++; }
      else if (t === 'land') bump(game.land, 'land ' + ((d.li | 0) + 1));
      else if (t === 'build') bump(game.build, d.id);
      else if (t === 'recruit') bump(game.recruit, d.c);
      else if (t === 'run_over') game.runOver.push(+d.d || 0);
      else if (t === 'run_cont') game.conts[d.h === 'ad' ? 'ad' : 'gems']++;
      else if (t === 'run_end') {
        game.runEnd++;
        if (d.kind) {
          runs.end++; bump(runs.kind, clip(String(d.kind), 16)); if (/^win/.test(d.kind)) runs.win++;
          if (+d.mins > 0) runs.mins.push(Math.min(600, +d.mins)); if (d.depth != null) runs.depth.push(+d.depth || 0);
          if (!/^win|^extract/.test(d.kind)) bump(runs.cause, clip(String(d.cause || '?'), 32));
          bump(runs.heat, 'Heat ' + (d.heat | 0)); bump(runs.btn, clip(String(d.btn || '?'), 16));
        }
      }
      else if (t === 'run_start') runs.start++;
      else if (t === 'extract') runs.extract++;
      else if (t === 'card' || t === 'deed' || t === 'door') bump(runs[t], clip(String(d.id || d.land || d.c || '?'), 24));
      else if (t === 'loot') bump(runs.loot, clip(String(d.r || d.rar || '?'), 12));
      else if (t === 'camp') bump(runs.camp, clip(String(d.a || d.act || '?'), 16));
      else if (t === 'store_open') { shop.open++; bump(shop.from, clip(String(d.from || d.tab || d.at || '?'), 16)); }
      else if (t === 'buy_start') { shop.start++; bump(shop.prov, clip(String(d.p || d.prov || '?'), 12)); bump(shop.sku, clip(String(d.sku || '?'), 32)); }
      else if (t === 'buy_ok') { shop.ok++; bump(shop.okProv, clip(String(d.p || d.prov || '?'), 12)); }
      else if (t === 'buy_fail') { shop.fail++; bump(shop.why, clip(String(d.why || d.w || '?'), 24)); }
      else if (t === 'ad_show') shop.ads++;
      else if (t === 'ad_ok') shop.adsOk++;
      else if (t === 'gems') game.gems += +d.n || 0;
      else if (t === 'boss_win') game.bossWin++;
      else if (t === 'boss_fail') game.bossFail++;
      else if (t === 'od') game.od++;
      else if (t === 'relic') game.relic++;
      else if (t === 'jackpot') game.jackpot++;
      else if (t === 'ascend') game.ascend++;
      else if (t === 'err') bump(errors, (d.m || '') + ' @ ' + (d.at || ''));
    }
  }
  const cohorts = days.slice(-21).map(day => {
    const c = fresh.filter(v => dayKey(v.first) === day), age = (now - Date.parse(day + 'T00:00:00Z')) / 864e5;
    const r = n => (age >= n + 1 && c.length ? pct(c.filter(v => back(v, n)).length, c.length) : null);
    return { day, n: c.length, d1: r(1), d3: r(3), d7: r(7) };
  });
  const playMin = V.map(v => v.pt / 60);
  return {
    range: { from: dayKey(from), to: dayKey(to), days: days.length }, generated: now,
    kpi: {
      visitors: V.length, newVisitors: fresh.length, sessions: S.length, medSessionMin: Math.round(med(S.map(s => s.secs)) / 6) / 10,
      medPlayMin: Math.round(med(playMin) * 10) / 10, hooked: pct(fresh.filter(v => v.steps.m5).length, fresh.length),
      d1: d1Base.length ? pct(d1Base.filter(v => back(v, 1)).length, d1Base.length) : null, d1Base: d1Base.length, live: live.length,
    },
    daily: days.map(d => ({ day: d, nw: daily[d].nw.size, ret: daily[d].ret.size, ses: daily[d].ses, play: Math.round(daily[d].play) })),
    funnel, landing, sources, campaigns, cohorts, hours,
    quit: { play: Object.entries(quitPlay), tut: top(quitTut, 12), depth: top(quitDepth, 12) },
    dev: { type: top(dev.type), os: top(dev.os), br: top(dev.br), scr: top(dev.scr, 8) },
    geo: { cc: top(geo.cc, 15), lang: top(geo.lang, 12) },
    game: { cls: top(game.cls), bless: top(game.bless), champ: Object.entries(game.champ).map(([m, o]) => [m, o.ok, o.fail]), land: Object.entries(game.land).sort((a, b) => +a[0].slice(5) - +b[0].slice(5)), build: top(game.build), recruit: top(game.recruit), runOvers: game.runOver.length, runOverMedDepth: med(game.runOver) + 1, bossWin: game.bossWin, bossFail: game.bossFail, od: game.od, relic: game.relic, jackpot: game.jackpot, ascend: game.ascend, conts: game.conts, runEnd: game.runEnd, gems: game.gems },
    runs: { start: runs.start, end: runs.end, win: runs.win, winPct: pct(runs.win, runs.end), extract: runs.extract, medMin: Math.round(med(runs.mins) * 10) / 10, medDepth: med(runs.depth), kind: top(runs.kind), cause: top(runs.cause), heat: top(runs.heat, 11), btn: top(runs.btn, 10), card: top(runs.card, 15), deed: top(runs.deed, 15), door: top(runs.door, 12), loot: top(runs.loot, 10), camp: top(runs.camp, 8) },
    shop: { open: shop.open, start: shop.start, ok: shop.ok, fail: shop.fail, from: top(shop.from, 8), prov: top(shop.prov, 8), okProv: top(shop.okProv, 8), sku: top(shop.sku, 12), why: top(shop.why, 8), ads: shop.ads, adsOk: shop.adsOk },
    errors: top(errors, 15), live,
    filters: { sources: [...new Set([...visitors.values()].filter(v => !v.bot).map(v => srcKey(v.touch)))].sort().slice(0, 100), cc: [...new Set([...visitors.values()].map(v => v.cc))].sort() },
    totals: { visitors: visitors.size, sessions: sessions.size, landingViews: lands.size },
  };
}
function exportCsv(qs) {
  const from = qs.from ? Date.parse(qs.from + 'T00:00:00Z') : 0, to = qs.to ? Date.parse(qs.to + 'T23:59:59.999Z') : Date.now();
  const rows = [['session', 'visitor', 'start', 'minutes', 'play_min', 'best_depth', 'source', 'medium', 'campaign', 'referrer', 'device', 'os', 'browser', 'country', 'lang', 'bot']];
  for (const s of sessions.values()) {
    if (s.start < from || s.start > to) continue;
    const v = visitors.get(s.vid) || {}, t = v.touch || {};
    rows.push([s.sid, s.vid, new Date(s.start).toISOString(), (s.secs / 60).toFixed(1), (Math.max(0, s.pt - (s.pt0 || 0)) / 60).toFixed(1), s.bd, t.src, t.med, t.cmp, t.ref, s.dev.type, s.dev.os, s.dev.br, s.cc, s.lang, s.bot ? 1 : 0]);
  }
  // (a cell a spreadsheet would read as a formula, from a visitor's own utm tags, starts with ' and stays text)
  const cell = x => { x = x == null ? '' : String(x); if (/^[=+\-@\t\r]/.test(x)) x = "'" + x; return /[",\n\r]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
  return rows.map(r => r.map(cell).join(',')).join('\n');
}
const authed = req => {
  if (!TOKEN) return false;
  const got = Buffer.from(String(req.headers['x-admin-token'] || '')), want = Buffer.from(TOKEN);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
};
// the admin token mints store grants and points the Telegram webhook: it must be long (a guessable one is refused, the
// dashboard says why), and wrong guesses are throttled per address (10 in 10 minutes, then 15 minutes of 429)
const ADMIN_MIN = 20, ADMIN_TRIES = 10, ADMIN_WINDOW = 10 * 60e3, ADMIN_LOCK = 15 * 60e3;
const adminFails = new Map(); // address key -> {n, t0, until}
setInterval(() => { const now = Date.now(); for (const [k, f] of adminFails) if (now - f.t0 > ADMIN_WINDOW && now > f.until) adminFails.delete(k); }, 60e3).unref();
const adminLocked = k => { const f = adminFails.get(k); return !!f && Date.now() < f.until; };
function adminFail(k) {
  const now = Date.now();
  let f = adminFails.get(k);
  if (!f || now - f.t0 > ADMIN_WINDOW) adminFails.set(k, (f = { n: 0, t0: now, until: 0 }));
  if (++f.n >= ADMIN_TRIES) f.until = now + ADMIN_LOCK;
  stat.adminBad++;
  log('admin: wrong token from ' + k.slice(0, 8) + (f.until ? ' (locked for 15 min)' : ''));
}

// ---------- the public config: which providers are set up (never the secrets themselves) ----------
// ?pf=yandex|vk|telegram|web|steam tailors store.provider and ads.provider to the platform asking (optional)
const ADS_REWARDED = env('ADS_REWARDED').toLowerCase().split(',').map(s => s.trim()).filter(k => (k === 'yandex' || k === 'vk' || (k === 'telegram' && env('ADSGRAM_BLOCK_ID'))));
const STORE_OF = { yandex: 'yandex', vk: 'vk', telegram: 'telegram', web: 'yookassa' };
const cfgCache = new Map();
let players7d = null, playersAt = 0;
function config(pf) {
  pf = /^(yandex|vk|telegram|web|steam)$/.test(pf || '') ? pf : '';
  const now = Date.now(), hit = cfgCache.get(pf);
  if (hit && now - hit.at < 60e3) return hit.body;
  const providers = {
    yookassa: PROV.yookassa(), robokassa: !!(env('ROBOKASSA_LOGIN') && env('ROBOKASSA_PASS1')),
    stripe: !!env('STRIPE_SECRET_KEY'), stars: PROV.telegram(), telegram: PROV.telegram(), vk: PROV.vk(), yandex: PROV.yandex(),
  };
  // social proof for the landing: real people who played this week, rounded down to the hundred, only past 500
  if (now - playersAt > 60e3) {
    const wk = now - 7 * 864e5, seen = new Set();
    for (const S of sessions.values()) if (S.last >= wk && !S.bot) seen.add(S.vid);
    players7d = seen.size >= 500 ? Math.floor(seen.size / 100) * 100 : null; playersAt = now;
  }
  // 4.0: the store and its prices (Steam: Gems are earn-only, so the store is off there)
  const sell = pf === 'steam' ? [] : storeProviders();
  const prices = {}, skus = {};
  for (const k of Object.keys(SKUS)) { const P = priceOf(k); prices[k] = { rub: P.rub, usd: P.usd, stars: P.stars, votes: P.votes }; skus[k] = { gems: SKUS[k].gems, cos: SKUS[k].cos || null }; }
  // (looks: whether the landing may advertise the Starter Kit and looks; set STORE_LOOKS=1 once the game draws them.
  // The game itself offers them only when its stage does: G.Stage.cosmetics)
  const store = { on: sell.length > 0, providers: sell, provider: pf && sell.includes(STORE_OF[pf]) ? STORE_OF[pf] : null, looks: env('STORE_LOOKS') === '1' };
  // (a YooKassa payment needs the buyer's email for its receipt: the game asks for it before the payment page)
  if (sell.includes('yookassa') && YK_RECEIPT() && (!pf || pf === 'web')) store.email = true;
  const adsOn = pf === 'steam' || pf === 'web' ? [] : ADS_REWARDED;
  const adProv = pf ? (adsOn.includes(pf) ? pf : null) : adsOn[0] || null;
  const ads = { adsgram: !!env('ADSGRAM_BLOCK_ID'), yandex: !!env('YANDEX_RTB_ID'), adsense: !!env('ADSENSE_CLIENT'), rewarded: !!adProv, provider: adProv, providers: adsOn };
  if (adProv === 'telegram') ads.block = env('ADSGRAM_BLOCK_ID');
  const body = JSON.stringify({ v: 2, payments: PAY_ON() && Object.values(providers).some(Boolean), providers, ads, links: LINKS, players7d, store, prices, skus });
  cfgCache.set(pf, { at: now, body });
  return body;
}

// ---------- the server ----------
const SEC = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin', 'permissions-policy': 'camera=(), microphone=(), geolocation=()' };
function send(res, code, type, body, extra) { res.writeHead(code, Object.assign({ 'content-type': type, 'cache-control': 'no-store' }, SEC, extra || {})); res.end(body); }
// a packed file: 304 on a matching ETag, brotli or gzip when the browser takes it, byte ranges for video (Safari needs them)
function serve(req, res, o, extra) {
  const h = Object.assign({ 'content-type': o.type, 'cache-control': o.cache, etag: o.etag }, SEC, o.csp ? { [CSP_HDR]: o.csp } : {}, extra || {});
  if (o.br) h.vary = 'accept-encoding';
  const inm = req.headers['if-none-match'];
  if (inm && inm.split(/\s*,\s*/).includes(o.etag)) { res.writeHead(304, h); return res.end(); }
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (!o.br && range && (range[1] || range[2])) {
    const size = o.raw.length;
    let a = range[1] === '' ? size - +range[2] : +range[1], b = range[1] !== '' && range[2] !== '' ? Math.min(+range[2], size - 1) : size - 1;
    if (a < 0) a = 0;
    if (a > b || a >= size) { res.writeHead(416, Object.assign(h, { 'content-range': 'bytes */' + size })); return res.end(); }
    res.writeHead(206, Object.assign(h, { 'accept-ranges': 'bytes', 'content-range': `bytes ${a}-${b}/${size}`, 'content-length': b - a + 1 }));
    return res.end(req.method === 'HEAD' ? undefined : o.raw.subarray(a, b + 1));
  }
  const ae = String(req.headers['accept-encoding'] || '');
  let body = o.raw;
  if (o.br && /\bbr\b/.test(ae)) { body = o.br; h['content-encoding'] = 'br'; } else if (o.gz && /\bgzip\b/.test(ae)) { body = o.gz; h['content-encoding'] = 'gzip'; }
  if (!o.br) h['accept-ranges'] = 'bytes';
  h['content-length'] = body.length;
  res.writeHead(200, h); res.end(req.method === 'HEAD' ? undefined : body);
}
const redirect = (res, to, code) => { res.writeHead(code || 302, Object.assign({ location: to, 'cache-control': 'no-cache' }, SEC)); res.end(); };
const dec = s => { try { return decodeURIComponent(s); } catch (e) { return null; } };
// an async handler's failure answers 500 instead of taking the process down
const run = (res, pr) => Promise.resolve(pr).catch(e => { log('error:', e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e); if (!res.headersSent) J(res, 500, { error: 'server' }); });
// POST routes: path → [body cap, per-IP per-minute limit, handler(req, res, body, ih)]
const POSTS = {
  '/api/store/telegram/invoice': [4e3, 10, (req, res, b) => run(res, tgInvoice(req, res, b))],
  '/api/store/telegram/webhook': [256e3, 600, (req, res, b) => tgWebhook(req, res, b)],
  '/api/store/yookassa/create': [4e3, 10, (req, res, b) => run(res, ykCreate(req, res, b))],
  '/api/store/yookassa/webhook': [64e3, 600, (req, res, b) => run(res, ykWebhook(req, res, b))],
  '/api/store/yandex/verify': [64e3, 20, (req, res, b) => yaVerify(req, res, b)],
  '/api/store/ack': [8e3, 30, (req, res, b) => ack(req, res, b)],
  '/api/daily': [2e3, 6, (req, res, b, ih, i48) => dailyPost(req, res, b, ih, i48)],
  '/api/daily/start': [1e3, 6, (req, res, b) => dailyStart(req, res, b)],
};
const ADMIN_POSTS = {
  '/api/admin/store/grant': b => {
    if (!okSku(b.sku) || typeof b.v !== 'string' || !(VID_RE.test(b.v) || VKV_RE.test(b.v))) return [400, { error: 'sku or v' }];
    const r = grant('admin', 'a' + Date.now().toString(36) + rid(6), b.sku, b.v, 0, '', { test: 1, note: String(b.note || '').slice(0, 120) });
    return [200, { ok: true, grant: view(r.g) }];
  },
  // hide one row ({day, vh}) or every row from one address ({day, ih}); hid:false shows them again
  '/api/admin/daily/hide': b => {
    const D = validDay(b.day) && (dailyDays.has(b.day) || fs.existsSync(dayFile(b.day))) ? dayLoad(b.day) : null;
    const rows = !D ? [] : typeof b.vh === 'string' ? [D.byV.get(b.vh)].filter(Boolean) : typeof b.ih === 'string' && b.ih ? D.rows.filter(r => r.ih === b.ih) : [];
    if (!rows.length) return [404, { error: 'no such row' }];
    for (const r of rows) { if (b.hid === false) delete r.hid; else r.hid = 1; }
    dayIndex(D); daySave(D); return [200, { ok: true, hid: b.hid !== false, n: rows.length }];
  },
  // a day whose file was damaged and had no good copy: start its board again (empty)
  '/api/admin/daily/reset': b => {
    const D = validDay(b.day) && dailyDays.get(b.day);
    if (!D || !D.ro) return [400, { error: 'that day is not read-only' }];
    D.ro = 0; D.rows = []; D.gone = []; dayIndex(D); daySave(D);
    return [200, { ok: true }];
  },
};
const server = http.createServer((req, res) => {
  try { handle(req, res); } catch (e) { log('error:', e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e); if (!res.headersSent) J(res, 500, { error: 'server' }); }
});
function handle(req, res) {
  let u; try { u = new URL(req.url || '/', 'http://x'); } catch (e) { return send(res, 400, 'text/plain', 'bad url'); }
  const p = u.pathname;
  if (p === '/health') return send(res, 200, 'text/plain', 'ok');
  if (req.headers['x-forwarded-proto'] === 'https' && /^https:/.test(ORIGIN)) res.setHeader('strict-transport-security', 'max-age=15552000');
  // the public APIs answer portal builds hosted elsewhere (CORS without credentials)
  const api = p.startsWith('/api/') && !p.startsWith('/api/admin/'), C = api ? corsOf(req) : null;
  if (C) for (const k in C) res.setHeader(k, C[k]);
  if (req.method === 'OPTIONS') {
    if (!C) return send(res, 405, 'text/plain', '');
    res.writeHead(204, Object.assign({ 'access-control-allow-methods': 'GET, POST', 'access-control-allow-headers': 'content-type, x-vk-params, x-tg-init-data', 'access-control-max-age': '600' }, SEC)); return res.end();
  }
  if (p === '/api/ev' && req.method === 'POST') {
    const ip = ipOf(req), ih = hashIp(ip);
    if (limited('ev:' + ipKey(req), 90)) return send(res, 429, 'text/plain', 'slow down');
    return readBody(req, res, 64e3, buf => {
      let b; try { b = JSON.parse(buf.toString('utf8')); } catch (e) { return send(res, 400, 'text/plain', 'bad'); }
      if (!b || typeof b.v !== 'string' || typeof b.s !== 'string' || !/^[a-z0-9]{6,24}$/.test(b.v) || !/^[a-z0-9]{6,24}$/.test(b.s) || !Array.isArray(b.e)) return send(res, 400, 'text/plain', 'bad');
      const ses = sessions.get(b.s);
      if (ses && ses.n > 6000) return send(res, 204, 'text/plain', '');
      const rec = { r: Date.now(), ip: ih, ua: String(req.headers['user-agent'] || '').slice(0, 300), cc: country(req, '', String(req.headers['accept-language'] || '').split(',')[0]), geo: !!(req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || req.headers['x-country-code'] || req.headers['x-geo-country']) || undefined, v: b.v, s: b.s, e: b.e.slice(0, 300) };
      ingest(rec); append(rec);
      send(res, 204, 'text/plain', '');
    });
  }
  if (p === '/api/csp') {
    if (req.method !== 'POST') return send(res, 405, 'text/plain', '');
    if (limited('csp:' + ipKey(req), 20)) return send(res, 429, 'text/plain', 'slow down');
    return readBody(req, res, 16e3, buf => { cspReport(buf, req); send(res, 204, 'text/plain', ''); });
  }
  // the store and the Daily board
  if (p.startsWith('/api/store/') || p === '/api/daily' || p === '/api/daily/start') {
    // (an IPv4 address or an IPv6 /64; the Daily board also counts an IPv6 /48)
    const ip = ipOf(req), ih = hashIp(netOf(ip, 64));
    if (p === '/api/store/claim' || (p === '/api/daily' && req.method !== 'POST')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return J(res, 405, { error: 'method' });
      if (limited((p === '/api/daily' ? 'dg:' : 'cl:') + ih, p === '/api/daily' ? 60 : 30)) return J(res, 429, { error: 'slow down' });
      return p === '/api/daily' ? dailyGet(req, res, u) : run(res, claim(req, res, u.searchParams.get('v') || ''));
    }
    if (p === '/api/store/vk/callback') {
      if (req.method !== 'POST') return J(res, 405, { error: 'method' });
      if (limited('vk:' + ih, 600)) return J(res, 429, { error: 'slow down' });
      return readBody(req, res, 16e3, buf => { try { vkCallback(req, res, buf); } catch (e) { log('store: vk callback failed:', e.message); if (!res.headersSent) J(res, 200, { error: { error_code: 2, error_msg: 'temporary error', critical: false } }); } });
    }
    const R = own(POSTS, p) && POSTS[p];
    if (!R) return J(res, 404, { error: 'not found' });
    if (req.method !== 'POST') return J(res, 405, { error: 'method' });
    if (limited('st:' + p + ':' + ih, R[1])) return J(res, 429, { error: 'slow down' });
    return readJson(req, res, R[0], b => { try { R[2](req, res, b, ih, hashIp(netOf(ip, 48))); } catch (e) { log('error:', p, e.message); if (!res.headersSent) J(res, 500, { error: 'server' }); } });
  }
  if (p.startsWith('/api/admin/')) {
    if (!TOKEN) return J(res, 503, { error: 'ADMIN_TOKEN is not set on the server' });
    if (TOKEN.length < ADMIN_MIN) return J(res, 503, { error: 'ADMIN_TOKEN is too short: set it to ' + ADMIN_MIN + ' or more random characters (Railway → Variables), then reload.' });
    const ak = ipKey(req);
    if (adminLocked(ak)) return J(res, 429, { error: 'Too many wrong tokens from here: wait 15 minutes.' });
    if (!authed(req)) { adminFail(ak); return J(res, 401, { error: 'bad token' }); }
    const qs = Object.fromEntries(u.searchParams);
    if (req.method === 'POST') {
      if (p === '/api/admin/store/telegram-setup') return run(res, (async () => {
        if (!PROV.telegram()) return J(res, 400, { error: 'Set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET first.' });
        if (!/^[A-Za-z0-9_-]{1,256}$/.test(env('TELEGRAM_WEBHOOK_SECRET'))) return J(res, 400, { error: 'TELEGRAM_WEBHOOK_SECRET may use only A-Z, a-z, 0-9, _ and -.' });
        if (!/^https:\/\//.test(ORIGIN)) return J(res, 400, { error: 'PUBLIC_URL must be https.' });
        try {
          await tgCall('setWebhook', { url: ORIGIN + '/api/store/telegram/webhook', secret_token: env('TELEGRAM_WEBHOOK_SECRET'), allowed_updates: ['message', 'pre_checkout_query'] });
          const w = await tgCall('getWebhookInfo', {});
          return J(res, 200, { ok: true, url: w.url, pending: w.pending_update_count || 0, lastError: w.last_error_message || '' });
        } catch (e) { return J(res, 502, { error: redact(e.message) }); }
      })());
      const A = own(ADMIN_POSTS, p) && ADMIN_POSTS[p];
      if (!A) return J(res, 404, { error: 'no' });
      return readJson(req, res, 4e3, b => { try { const [code, o] = A(b); J(res, code, o); } catch (e) { log('admin:', e.message); J(res, 500, { error: 'server' }); } });
    }
    if (p === '/api/admin/stats') return J(res, 200, stats(qs));
    if (p === '/api/admin/live') return J(res, 200, stats(Object.assign({}, qs, { from: dayKey(Date.now()), to: dayKey(Date.now()) })).live);
    if (p === '/api/admin/export') return send(res, 200, 'text/csv; charset=utf-8', exportCsv(qs), { 'content-disposition': 'attachment; filename="bttn-sessions.csv"' });
    if (p === '/api/admin/store') return J(res, 200, storeStats());
    if (p === '/api/admin/daily') {
      const day = qs.day || dayKey(Date.now());
      if (!validDay(day)) return J(res, 400, { error: 'day' });
      const D = dailyDays.has(day) || fs.existsSync(dayFile(day)) ? dayLoad(day) : { rows: [], gone: [], byNet: new Map() };
      // (ih: the address key, hashed; with how many posts that address made today, so a flood stands out)
      return J(res, 200, { day, n: D.rows.length, gone: D.gone.length, ro: !!D.ro, restored: !!D.restored, max: DAILY_MAX, strict: DAILY_STRICT, token: DAILY_TOKEN,
        nets: top(Object.fromEntries(D.byNet), 10), rows: D.rows.slice(0, 300).map(r => ({ vh: r.vh, ih: r.ih || '', n: D.byNet.get(r.ih) || 0, name: r.name, zones: r.zones, secs: r.secs, btn: r.btn, cls: r.cls, heat: r.heat, seed: r.seed, at: r.at, hid: !!r.hid, nt: !!r.nt })) });
    }
    return J(res, 404, { error: 'no' });
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'text/plain', '');
  if (p === '/api/config') return send(res, 200, 'application/json', config(u.searchParams.get('pf')), { 'cache-control': 'public, max-age=60' });
  if (p.startsWith('/api/')) return J(res, 404, { error: 'not found' });
  // the landing; old links to the game (/?play=1, /index.html) go to /play with the rest of their query
  if (p === '/' || p === '/index.html') {
    if (p === '/index.html' || u.searchParams.has('play')) { u.searchParams.delete('play'); const qs = u.searchParams.toString(); return redirect(res, '/play' + (qs ? '?' + qs : '')); }
    return serve(req, res, u.searchParams.get('lang') === 'ru' ? landing.ru : landing.en);
  }
  if (p === '/play' || p === '/play/' || p.startsWith('/play/')) return serve(req, res, page);
  if (p === '/press' || p === '/press/') return serve(req, res, u.searchParams.get('lang') === 'ru' ? press.ru : press.en);
  if (p.startsWith('/press/')) { const n = dec(p.slice(7)), F = n != null && pressFiles.get(n); return F ? serveFile(req, res, F, u.searchParams.get('dl') === '1') : send(res, 404, 'text/plain', 'not found'); }
  if (p.startsWith('/assets/')) { const n = dec(p.slice(8)), a = n != null && assets.get(n); return a ? serve(req, res, a) : send(res, 404, 'text/plain', 'not found'); }
  if (p === '/privacy' || p === '/privacy/' || p === '/privacy.html') return serve(req, res, privacy);
  if (p === '/admin' || p === '/admin/') return serve(req, res, admin, { 'x-robots-tag': 'noindex', 'x-frame-options': 'DENY', 'cache-control': 'no-store' });
  if (p === '/og.png' && og) return serve(req, res, og);
  if (p === '/favicon.ico' && favicon) return serve(req, res, favicon);
  if (p === '/robots.txt') return serve(req, res, robots);
  if (p === '/sitemap.xml') return serve(req, res, sitemap);
  if (p === '/manifest.webmanifest' || p === '/site.webmanifest') return serve(req, res, manifest);
  // anything else: the landing, keeping the query (tags on a mistyped link still count)
  return redirect(res, '/' + (u.search || ''));
}
// slow clients don't get to hold a socket open forever
server.headersTimeout = 20e3; server.requestTimeout = 30e3;
server.listen(PORT, () => log('BTTN on port ' + PORT + (!TOKEN ? ' (admin off: set ADMIN_TOKEN)' : TOKEN.length < ADMIN_MIN ? ' (admin off: ADMIN_TOKEN is shorter than ' + ADMIN_MIN + ' characters)' : '') + ' · ' + ORIGIN + ' · store ' + (storeProviders().join(', ') || 'off') + ' · CSP ' + CSP_MODE + ' · client address from ' + (TRUST === 'off' ? 'the socket' : TRUST)));
process.on('unhandledRejection', e => log('unhandled:', e && e.message));
