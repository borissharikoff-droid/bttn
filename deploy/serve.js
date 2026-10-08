// BTTN — the public host (Railway, Render, any Node host). No dependencies.
//  GET  /            the landing page (deploy/landing.html): the pitch and one big PLAY that carries the utm tags on
//  GET  /play        the game (docs/index.html), with the analytics flag and share tags put in; /play/* too.
//                    Old links still work: /?play=1 and /index.html redirect to /play with their query.
//  GET  /privacy, /sitemap.xml, /robots.txt, /manifest.webmanifest, /favicon.ico, /og.png, /assets/*
//  GET  /api/config  which payment and ad providers are configured (from env vars, all off by default), public
//                    links (LINK_* env vars) and a rounded weekly player count for the landing's social proof
//  POST /api/ev      anonymous events from js/analytics.js and the landing, appended to $DATA_DIR/ev-YYYY-MM-DD.ndjson
//  GET  /admin       the admin dashboard (deploy/admin.html); its data needs the ADMIN_TOKEN
//  GET  /api/admin/stats, /api/admin/live, /api/admin/export   (header x-admin-token)
//  GET  /health
// Pages and assets are read once at boot, kept in memory with brotli/gzip copies and ETags.
// Events are kept on disk (a Railway volume at $DATA_DIR) and folded into memory at boot, so the dashboard is
// instant. No raw IPs are stored: only a salted hash, to count people and to rate-limit.
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

// the game, at /play
const HEAD = `<meta name="description" content="Hold the Button against a 1,000-monster Horde. Your party fights, your clicks call lightning, the loot rains. Free, in the browser.">
<link rel="canonical" href="${ORIGIN}/play"><meta name="theme-color" content="#0d0a12"><link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png"><link rel="apple-touch-icon" href="/assets/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest">
<meta property="og:title" content="BTTN — Don't let the Button break"><meta property="og:description" content="Hold the Button against a 1,000-monster Horde. Your party fights, your clicks call lightning, the loot rains. Free, in the browser.">
<meta property="og:type" content="website"><meta property="og:url" content="${ORIGIN}/play"><meta property="og:image" content="${ORIGIN}/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${ORIGIN}/og.png">
<script>window.BTTN_AN='/api/ev'</script>`;
function loadPage() {
  const html = fs.readFileSync(path.join(ROOT, 'docs', 'index.html'), 'utf8');
  return pack(Buffer.from(html.includes('</head>') ? html.replace('</head>', HEAD + '\n</head>') : HEAD + html), HTML);
}
const page = loadPage();
// the landing, at / (and /?lang=ru, the same page with Russian marked as its language for crawlers)
const landingSrc = origin(readOr('landing.html', '<!doctype html><a href="/play">Play</a>').toString('utf8'));
const landing = { en: pack(Buffer.from(landingSrc), HTML), ru: pack(Buffer.from(landingSrc.replace('<html lang="en">', '<html lang="ru">').replace(`<link rel="canonical" href="${ORIGIN}/">`, `<link rel="canonical" href="${ORIGIN}/?lang=ru">`).replace('content="en_US"', 'content="ru_RU"').replace('content="ru_RU">\n<meta name="twitter', 'content="en_US">\n<meta name="twitter')), HTML) };
const CONTACT = (() => {
  const m = String(process.env.CONTACT_EMAIL || '').trim(), l = String(process.env.LINK_TELEGRAM || process.env.LINK_CONTACT || '').trim();
  const esc = x => x.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  if (/^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i.test(m)) return { en: `Questions or a deletion request: <a href="mailto:${esc(m)}">${esc(m)}</a>.`, ru: `Вопросы или просьба удалить данные: <a href="mailto:${esc(m)}">${esc(m)}</a>.` };
  if (/^https:\/\/[^\s"'<>]+$/i.test(l)) return { en: `Questions or a deletion request: <a href="${esc(l)}">${esc(l)}</a>.`, ru: `Вопросы или просьба удалить данные: <a href="${esc(l)}">${esc(l)}</a>.` };
  return { en: 'Questions or a deletion request: use the contact links on the <a href="/">home page</a>. Clearing this site\'s data also unlinks you from everything recorded so far.', ru: 'Вопросы или просьба удалить данные: ссылки для связи на <a href="/">главной</a>.' };
})();
const privacy = pack(Buffer.from(origin(readOr('privacy.html', 'Privacy: anonymous play stats only.').toString('utf8')).replace('%CONTACT%', CONTACT.en).replace('%CONTACT_RU%', CONTACT.ru)), HTML);
const admin = pack(readOr('admin.html', 'no dashboard'), HTML);
const og = (() => { try { return pack(fs.readFileSync(path.join(__dirname, 'og.png')), 'image/png', 'public, max-age=86400'); } catch (e) { return null; } })();
const BOOT_DAY = new Date().toISOString().slice(0, 10);
const sitemap = pack(Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
<url><loc>${ORIGIN}/</loc><lastmod>${BOOT_DAY}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority><xhtml:link rel="alternate" hreflang="en" href="${ORIGIN}/"/><xhtml:link rel="alternate" hreflang="ru" href="${ORIGIN}/?lang=ru"/><xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}/"/></url>
<url><loc>${ORIGIN}/?lang=ru</loc><lastmod>${BOOT_DAY}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority><xhtml:link rel="alternate" hreflang="en" href="${ORIGIN}/"/><xhtml:link rel="alternate" hreflang="ru" href="${ORIGIN}/?lang=ru"/><xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}/"/></url>
<url><loc>${ORIGIN}/play</loc><lastmod>${BOOT_DAY}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>
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
const TYPES = { '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff2': 'font/woff2', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json' };
const assets = new Map();
(function loadAssets(dir, pre) {
  let names = []; try { names = fs.readdirSync(dir); } catch (e) { return; }
  for (const n of names) {
    const f = path.join(dir, n), st = fs.statSync(f);
    if (st.isDirectory()) { loadAssets(f, pre + n + '/'); continue; }
    const type = TYPES[path.extname(n).toLowerCase()]; if (!type) continue;
    assets.set(pre + n, pack(fs.readFileSync(f), type, /\.(woff2)$/.test(n) ? 'public, max-age=604800, immutable' : 'public, max-age=86400'));
  }
})(path.join(__dirname, 'assets'), '');
const favicon = assets.get('favicon-32.png') || null;

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
const ipOf = req => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
const hashIp = ip => crypto.createHash('sha256').update(SALT + ip).digest('hex').slice(0, 12);

// ---------- the store ----------
const dayKey = ts => new Date(ts).toISOString().slice(0, 10);
const visitors = new Map(); // vid -> visitor
const sessions = new Map(); // sid -> session
const MILESTONE = new Set(['intro_next', 'intro_skip', 'intro_done', 'class', 'first_click', 'tut', 'tut_end', 'hold', 'boss_win', 'boss_fail', 'land', 'depth', 'run_over', 'run_cont', 'run_end', 'gems', 'ascend', 'bless', 'champ', 'recruit', 'seat', 'town', 'build', 'relic', 'jackpot', 'od', 'rank', 'lvl', 'err', 'end', 'start']);
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
  for (const x of e.slice(0, 300)) {
    if (!x || typeof x.t !== 'string') continue;
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

// ---------- rate limits ----------
const hits = new Map();
setInterval(() => hits.clear(), 60e3).unref();
const limited = (k, max) => { const n = (hits.get(k) || 0) + 1; hits.set(k, n); return n > max; };

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
      else if (t === 'run_end') game.runEnd++;
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
  return rows.map(r => r.map(x => { x = x == null ? '' : String(x); return /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; }).join(',')).join('\n');
}
const authed = req => {
  if (!TOKEN) return false;
  const got = Buffer.from(String(req.headers['x-admin-token'] || '')), want = Buffer.from(TOKEN);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
};

// ---------- the public config: which providers are set up (never the secrets themselves) ----------
const env = k => String(process.env[k] || '').trim();
const okLink = u => (/^https:\/\/[^\s"'<>]+$/i.test(u) ? u : '');
let cfgCache = null, cfgAt = 0;
function config() {
  if (cfgCache && Date.now() - cfgAt < 60e3) return cfgCache;
  const providers = {
    yookassa: !!(env('YOOKASSA_SHOP_ID') && env('YOOKASSA_SECRET_KEY')), robokassa: !!(env('ROBOKASSA_LOGIN') && env('ROBOKASSA_PASS1')),
    stripe: !!env('STRIPE_SECRET_KEY'), stars: !!env('TELEGRAM_BOT_TOKEN'),
  };
  const ads = { adsgram: !!env('ADSGRAM_BLOCK_ID'), yandex: !!env('YANDEX_RTB_ID'), adsense: !!env('ADSENSE_CLIENT') };
  const mail = env('CONTACT_EMAIL');
  const links = {
    telegram: okLink(env('LINK_TELEGRAM')), discord: okLink(env('LINK_DISCORD')), vk: okLink(env('LINK_VK')), youtube: okLink(env('LINK_YOUTUBE')), reddit: okLink(env('LINK_REDDIT')),
    contact: /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i.test(mail) ? 'mailto:' + mail : okLink(env('LINK_CONTACT')),
    tg_app: okLink(env('LINK_TG_APP')), yandex: okLink(env('LINK_YANDEX_GAMES')), crazygames: okLink(env('LINK_CRAZYGAMES')), steam: okLink(env('LINK_STEAM')),
  };
  for (const k in links) if (!links[k]) delete links[k];
  // social proof for the landing: real people who played this week, rounded down to the hundred, only past 500
  const wk = Date.now() - 7 * 864e5, seen = new Set();
  for (const S of sessions.values()) if (S.last >= wk && !S.bot) seen.add(S.vid);
  const players7d = seen.size >= 500 ? Math.floor(seen.size / 100) * 100 : null;
  cfgCache = { v: 1, payments: env('PAYMENTS') === '1' && Object.values(providers).some(Boolean), providers, ads, links, players7d };
  cfgAt = Date.now();
  return cfgCache;
}

// ---------- the server ----------
const SEC = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin' };
function send(res, code, type, body, extra) { res.writeHead(code, Object.assign({ 'content-type': type, 'cache-control': 'no-store' }, SEC, extra || {})); res.end(body); }
// a packed file: 304 on a matching ETag, brotli or gzip when the browser takes it, byte ranges for video (Safari needs them)
function serve(req, res, o, extra) {
  const h = Object.assign({ 'content-type': o.type, 'cache-control': o.cache, etag: o.etag }, SEC, extra || {});
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
http.createServer((req, res) => {
  const u = new URL(req.url || '/', 'http://x'), p = u.pathname;
  if (p === '/health') return send(res, 200, 'text/plain', 'ok');
  if (p === '/api/ev' && req.method === 'POST') {
    const ip = ipOf(req), ih = hashIp(ip);
    if (limited('ev:' + ih, 90)) return send(res, 429, 'text/plain', 'slow down');
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > 64e3) { req.destroy(); return; } chunks.push(c); });
    req.on('end', () => {
      let b; try { b = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) { return send(res, 400, 'text/plain', 'bad'); }
      if (!b || typeof b.v !== 'string' || typeof b.s !== 'string' || !/^[a-z0-9]{6,24}$/.test(b.v) || !/^[a-z0-9]{6,24}$/.test(b.s) || !Array.isArray(b.e)) return send(res, 400, 'text/plain', 'bad');
      const ses = sessions.get(b.s);
      if (ses && ses.n > 6000) return send(res, 204, 'text/plain', '');
      const rec = { r: Date.now(), ip: ih, ua: String(req.headers['user-agent'] || '').slice(0, 300), cc: country(req, '', String(req.headers['accept-language'] || '').split(',')[0]), geo: !!(req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || req.headers['x-country-code'] || req.headers['x-geo-country']) || undefined, v: b.v, s: b.s, e: b.e.slice(0, 300) };
      ingest(rec); append(rec);
      send(res, 204, 'text/plain', '');
    });
    return;
  }
  if (p.startsWith('/api/admin/')) {
    if (!authed(req)) return send(res, TOKEN ? 401 : 503, 'application/json', JSON.stringify({ error: TOKEN ? 'bad token' : 'ADMIN_TOKEN is not set on the server' }));
    const qs = Object.fromEntries(u.searchParams);
    if (p === '/api/admin/stats') return send(res, 200, 'application/json', JSON.stringify(stats(qs)));
    if (p === '/api/admin/live') return send(res, 200, 'application/json', JSON.stringify(stats(Object.assign({}, qs, { from: dayKey(Date.now()), to: dayKey(Date.now()) })).live));
    if (p === '/api/admin/export') return send(res, 200, 'text/csv; charset=utf-8', exportCsv(qs), { 'content-disposition': 'attachment; filename="bttn-sessions.csv"' });
    return send(res, 404, 'text/plain', 'no');
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'text/plain', '');
  if (p === '/api/config') return send(res, 200, 'application/json', JSON.stringify(config()), { 'cache-control': 'public, max-age=60' });
  // the landing; old links to the game (/?play=1, /index.html) go to /play with the rest of their query
  if (p === '/' || p === '/index.html') {
    if (p === '/index.html' || u.searchParams.has('play')) { u.searchParams.delete('play'); const qs = u.searchParams.toString(); return redirect(res, '/play' + (qs ? '?' + qs : '')); }
    return serve(req, res, u.searchParams.get('lang') === 'ru' ? landing.ru : landing.en);
  }
  if (p === '/play' || p === '/play/' || p.startsWith('/play/')) return serve(req, res, page);
  if (p.startsWith('/assets/')) { const a = assets.get(decodeURIComponent(p.slice(8))); return a ? serve(req, res, a) : send(res, 404, 'text/plain', 'not found'); }
  if (p === '/privacy' || p === '/privacy/' || p === '/privacy.html') return serve(req, res, privacy);
  if (p === '/admin' || p === '/admin/') return serve(req, res, admin, { 'x-robots-tag': 'noindex', 'x-frame-options': 'DENY', 'cache-control': 'no-store' });
  if (p === '/og.png' && og) return serve(req, res, og);
  if (p === '/favicon.ico' && favicon) return serve(req, res, favicon);
  if (p === '/robots.txt') return serve(req, res, robots);
  if (p === '/sitemap.xml') return serve(req, res, sitemap);
  if (p === '/manifest.webmanifest' || p === '/site.webmanifest') return serve(req, res, manifest);
  // anything else: the landing, keeping the query (tags on a mistyped link still count)
  return redirect(res, '/' + (u.search || ''));
}).listen(PORT, () => console.log('BTTN on port ' + PORT + (TOKEN ? '' : ' (admin off: set ADMIN_TOKEN)') + ' · ' + ORIGIN));
