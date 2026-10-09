// BTTN 4.0 — the Gems store and rewarded ads behind one interface (G.Store, G.Ads), with platform providers
// (Yandex Games, VK, Telegram Stars, YooKassa); everything stays off until the host configures a provider.
// The rules (DESIGN §4.9, MONETIZATION 1.2a): Gems buy the Continue and looks, never power, Fame, Embers or unlocks;
// fixed packs, with the real-money worth next to every Gem price; Steam builds are earn-only; a rewarded-ad Continue
// at most once a day. The host decides what is on: deploy/serve.js GET /api/config ->
//   store: {on, providers:[...]}, prices: {<sku>: {rub, usd, stars}}, ads: {rewarded, provider}   (PAYMENTS=1 gates selling)
// Purchases land in the server's ledger keyed by the analytics visitor id (localStorage 'bttn_vid'); the client claims
// them (GET /api/store/claim), applies each grant once (G.addGems(n, 'store'), G.S.cos.owned) and acks them.
// Looks live in G.S.cos = {owned:{id:1}, on:{skin, trail, beam}, got:[grant ids], starter}; G.cosmetic(kind) is what the
// stage reads. A per-device mirror (localStorage 'bttn_store') keeps paid looks and applied grant ids through a reset.
(function (G) {
  'use strict';

  // ---------- looks (DOM-free: the stage and the bots can read them) ----------
  // Button finishes: a palette over whatever Button you play (base = the dome colour SPR.button takes, glow = its halo).
  // Hand trails: what follows the Hand across the field (cols, bright to dark). Loot beams: the beam's core and sparks;
  // the beam's EDGE keeps the rarity colour, so a drop still reads at a glance (rarity is information, not a look).
  // (ids match the host's default catalog in deploy/serve.js: kind_word, sold for money as 'cos_<id>' where priced.
  // Gem prices follow the host's price tiers, so both ways cost the same: a $0.99 look is 100 Gems, a $1.99 one 200)
  G.COSMETICS = [
    { id: 'skin_void', kind: 'skin', gems: 200, name: 'Void Glass', desc: 'A dome of polished night.', base: '#2b2540', glow: '#b36bff' },
    { id: 'skin_frost', kind: 'skin', gems: 200, name: 'Hoarfrost', desc: 'Cold to the touch, loud when pressed.', base: '#7fd8ff', glow: '#e0f7ff' },
    { id: 'skin_ember', kind: 'skin', gems: 200, name: 'Ember Cast', desc: 'Forged hot and never cooled.', base: '#ff6a2e', glow: '#ffd84a' },
    { id: 'skin_candy', kind: 'skin', gems: 200, name: 'Candy Shell', desc: 'Sweet, glossy, and still very pressable.', base: '#ff8ad0', glow: '#fff0fa' },
    { id: 'founder_flame', kind: 'trail', gems: 0, only: 'starter', name: "Founder's Flame", desc: 'The Starter Kit\'s flame: your Hand burns bright.', cols: ['#fff3a0', '#ffd84a', '#ff7a2e', '#ff4f4f'] },
    { id: 'trail_azure', kind: 'trail', gems: 100, name: 'Azure Dust', desc: 'Every click leaves a little sky.', cols: ['#ffffff', '#a8dcff', '#4c86ff'] },
    { id: 'trail_crimson', kind: 'trail', gems: 100, name: 'Crimson Wake', desc: 'A red streak where you point.', cols: ['#ffd0d0', '#ff4f4f', '#a82424'] },
    { id: 'trail_verdant', kind: 'trail', gems: 100, name: 'Verdant Leaves', desc: 'Soft green, and entirely harmless.', cols: ['#e0ffd0', '#56d45a', '#2a8a3a'] },
    { id: 'trail_prism', kind: 'trail', gems: 100, name: 'Prism Trail', desc: 'Pale light split three ways.', cols: ['#ffffff', '#a8f0ff', '#ffb0f0', '#fff0a0'] },
    { id: 'beam_rose', kind: 'beam', gems: 100, name: 'Rose Beams', desc: 'Loot beams with a rose core and pink sparks.', core: '#ffe0f0', spark: '#ff6ad8' },
    { id: 'beam_ice', kind: 'beam', gems: 100, name: 'Ice Beams', desc: 'Loot beams with a white-blue core and frost sparks.', core: '#e8fbff', spark: '#7fd8ff' },
  ];
  G.COS_BY_ID = {};
  G.COSMETICS.forEach(c => { G.COS_BY_ID[c.id] = c; });
  G.COS_KINDS = ['skin', 'trail', 'beam'];
  // (server or older ids that mean the starter's flame)
  const COS_ALIAS = { flame: 'founder_flame', founder: 'founder_flame', founderflame: 'founder_flame', founders_flame: 'founder_flame' };
  const cosId = id => { id = String(id || '').replace(/^cos_/, ''); return G.COS_BY_ID[id] ? id : (COS_ALIAS[id] || ''); };
  // the active look of a kind, or null (only what is owned; the stage falls back to its default)
  G.cosmetic = function (kind) {
    const c = G.S && G.S.cos, id = c && c.on && c.on[kind], d = id && G.COS_BY_ID[id];
    return d && d.kind === kind && c.owned && c.owned[id] ? d : null;
  };

  // ---------- what each SKU gives (the server's grant may say it itself; this is the fallback) ----------
  const PACKS = ['gems_100', 'gems_300', 'gems_1000'];
  const SKUS = { gems_100: { gems: 100 }, gems_300: { gems: 300 }, gems_1000: { gems: 1000 }, starter: { gems: 100, cos: 'founder_flame', once: 1 } };
  const skuInfo = sku => {
    if (SKUS[sku]) return SKUS[sku];
    if (/^cos_[a-z0-9_]+$/.test(sku || '')) { const id = cosId(sku); return id ? { cos: id, once: 1 } : null; }
    return null;
  };

  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  // ---------- small helpers ----------
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
    json(k, d) { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v && typeof v === 'object' ? v : d; } catch (e) { return d; } },
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const t = (k, ...a) => (G.t ? G.t(k, ...a) : k);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const emit = (k, d) => { try { G.emit && G.emit('store', k, d); } catch (e) {} };
  const lang = () => String(G.LANG || (G.S && G.S.set && G.S.set.lang) || 'en').slice(0, 2);
  // whole numbers as they are (1,000 Gems; 1 490 руб.), not the game's short form (1.00K)
  const fmtN = n => String(Math.round(+n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, lang() === 'ru' ? '\u00a0' : ',');
  const PLATFORM = () => String(window.BTTN_PLATFORM || '');
  // Steam is earn-only (the Steam store takes the money for the game itself); the claude.ai artifact has no host
  const earnOnly = () => PLATFORM() === 'steam' || PLATFORM() === 'artifact' || (G.Net && G.Net.mode === 'artifact');
  // where the API is: a portal build sets window.BTTN_API; the game served by deploy/serve.js (BTTN_AN set) uses its
  // own origin; anywhere else (file://, claude.ai, Steam) there is no host and nothing is fetched at all
  const apiBase = () => {
    if (typeof window.BTTN_API === 'string' && /^(https:\/\/[^\s"'<>]+|)$/.test(window.BTTN_API)) return window.BTTN_API.replace(/\/+$/, '');
    if (window.BTTN_AN && /^https?:$/.test(location.protocol)) return '';
    return null;
  };
  // the analytics visitor id (js/analytics.js makes it; made the same way here, only when a purchase needs it)
  const rid = n => { const a = new Uint8Array(n); if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a); else a.forEach((_, i) => { a[i] = Math.random() * 256; }); return Array.from(a, b => (b % 36).toString(36)).join(''); };
  const VID_RE = /^[a-z0-9]{6,24}$/;
  const vidNow = () => { const v = ls.get('bttn_vid'); return v && VID_RE.test(v) ? v : ''; };
  G.visitorId = function () {
    let v = vidNow();
    if (!v) { v = rid(14); ls.set('bttn_vid', v); if (!ls.get('bttn_vfirst')) ls.set('bttn_vfirst', String(Date.now())); }
    return v;
  };
  function api(path, body, ms, hdr) {
    const base = apiBase();
    if (base == null) return Promise.reject(Object.assign(new Error('offline'), { status: 0 }));
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const tm = ctl ? setTimeout(() => ctl.abort(), ms || 10000) : 0;
    const o = body === undefined ? { method: 'GET', headers: Object.assign({}, hdr || {}) } : { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, hdr || {}), body: JSON.stringify(body) };
    if (ctl) o.signal = ctl.signal;
    return fetch(base + path, o).then(r => r.text().then(txt => {
      let j = null;
      try { j = txt ? JSON.parse(txt) : {}; } catch (e) { j = null; }
      if (!r.ok || !j || typeof j !== 'object') throw Object.assign(new Error((j && j.error) || 'http ' + r.status), { status: r.status, body: j });
      return j;
    })).finally(() => { if (tm) clearTimeout(tm); });
  }
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.async = true; s.onload = () => res(); s.onerror = () => rej(new Error('sdk'));
      document.head.appendChild(s);
    });
  }
  const within = (p, ms, dflt) => Promise.race([Promise.resolve(p).catch(() => dflt), sleep(ms).then(() => dflt)]);
  const today = () => new Date().toISOString().slice(0, 10);

  // ---------- the looks state (G.S.cos, made on first use) and the per-device mirror ----------
  const MIR = 'bttn_store';
  let mirror = ls.json(MIR, {});
  const mirOk = () => { if (!mirror.own || typeof mirror.own !== 'object') mirror.own = {}; if (!Array.isArray(mirror.got)) mirror.got = []; return mirror; };
  const mirSave = () => ls.set(MIR, JSON.stringify(mirOk()));
  function cos() {
    const S = G.S;
    if (!S) return null;
    let c = S.cos;
    if (!c || typeof c !== 'object') c = S.cos = {};
    if (!c.owned || typeof c.owned !== 'object') c.owned = {};
    if (!c.on || typeof c.on !== 'object') c.on = {};
    if (!Array.isArray(c.got)) c.got = [];
    if (c._m !== S) {
      // looks paid with money on this device come back after a reset or an import (gems do not: they were spent or wiped)
      mirOk();
      for (const id in mirror.own) if (G.COS_BY_ID[id]) c.owned[id] = 1;
      if (mirror.starter) c.starter = 1;
      Object.defineProperty(c, '_m', { value: S, enumerable: false, configurable: true, writable: true });
    }
    return c;
  }
  const gotIt = id => !!id && (cos().got.includes(id) || mirOk().got.includes(id));
  const keep = (arr, id) => { arr.push(id); if (arr.length > 300) arr.splice(0, arr.length - 300); };
  // one grant, once: Gems through G.addGems (so the HUD, analytics and the ledger of sources see it), a look owned
  function applyGrant(g) {
    if (!g || typeof g !== 'object' || !G.S) return null;
    const id = String(g.id || ''), c = cos();
    if (!id || gotIt(id)) return null;
    const info = skuInfo(String(g.sku || '')) || {};
    const gems = Math.max(0, Math.min(100000, Math.floor(typeof g.gems === 'number' ? g.gems : (info.gems || 0))));
    const look = cosId(g.cos || info.cos);
    if (gems > 0 && G.addGems) G.addGems(gems, 'store');
    if (look) {
      c.owned[look] = 1; mirOk().own[look] = 1;
      const k = G.COS_BY_ID[look].kind;
      if (!c.on[k]) c.on[k] = look; // a new look goes on at once (it can be taken off in the store)
    }
    if (g.sku === 'starter') { c.starter = 1; mirOk().starter = 1; }
    keep(c.got, id); keep(mirOk().got, id); mirSave();
    // saved now, before the ack: a reload in between must not pay twice (the ids above stop a second grant)
    try { G.save && G.save(); } catch (e) {}
    try { G.emit && G.emit('storeGrant', { id, sku: g.sku, gems, cos: look }); } catch (e) {}
    return { id, sku: String(g.sku || ''), gems, cos: look };
  }

  // ---------- config and providers ----------
  let cfg = null, cfgP = null, prov = null, provId = '', provOk = false, adProv = null, adId = '', adOk = false, booted = false, busy = false;
  const extraKeys = []; // other ledger keys this player claims with (VK: 'vk:<user id>')
  function loadConfig() {
    // (?pf= tells the host where this page runs, so it answers with the provider and the ads that fit here)
    const pf = /^(yandex|vk|telegram|web)$/.test(PLATFORM()) ? PLATFORM() : inTelegram() ? 'telegram' : inYandex() ? 'yandex' : inVK() ? 'vk' : 'web';
    if (!cfgP) cfgP = apiBase() == null ? Promise.resolve(cfg = {}) : api('/api/config?pf=' + pf, undefined, 8000).then(c => (cfg = c || {}), () => (cfg = {}));
    return cfgP;
  }
  const RU = { yandex: 1, vk: 1, yookassa: 1, robokassa: 1 };
  // (the page's own host only: a visitor who came from a Yandex or VK link is still on the web)
  const hostIs = re => { try { return re.test(location.hostname); } catch (e) { return false; } };
  const qs = () => new URLSearchParams(location.search);
  const inTelegram = () => !!(window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) || /tgWebAppData=/.test(location.hash);
  const inYandex = () => PLATFORM() === 'yandex' || !!window.YaGames || hostIs(/(^|\.)yandex\.(ru|com|net|by|kz|uz|com\.tr)$|(^|\.)games\.s3\.yandex\.net$|(^|\.)playhop\.com$/);
  const inVK = () => PLATFORM() === 'vk' || !!window.vkBridge || (qs().has('vk_app_id') && qs().has('sign'));
  function pickProvider(list) {
    const has = id => list.indexOf(id) >= 0, pf = PLATFORM();
    // a portal build sells only through its portal (portal rules forbid other checkouts inside them)
    if (pf && pf !== 'web') return has(pf) ? pf : '';
    if (inTelegram()) return has('telegram') ? 'telegram' : '';
    if (inYandex()) return has('yandex') ? 'yandex' : '';
    if (inVK()) return has('vk') ? 'vk' : '';
    return has('yookassa') ? 'yookassa' : '';
  }
  // one Yandex SDK for the whole page (the platform/i18n code may share it: G.ysdk is a promise of the sdk)
  function ysdk() {
    if (!G.ysdk) {
      G.ysdk = (window.YaGames ? Promise.resolve() : loadScript(hostIs(/games\.s3\.yandex\.net$/) ? '/sdk.js' : 'https://yandex.ru/games/sdk/v2'))
        .then(() => window.YaGames.init());
      G.ysdk.catch(() => { G.ysdk = null; });
    }
    return G.ysdk;
  }
  function bridge() {
    if (window.vkBridge) return Promise.resolve(window.vkBridge);
    return loadScript('https://unpkg.com/@vkontakte/vk-bridge@2.15.12/dist/browser.min.js').then(() => window.vkBridge);
  }
  function tgApp() {
    if (window.Telegram && window.Telegram.WebApp) return Promise.resolve(window.Telegram.WebApp);
    return loadScript('https://telegram.org/js/telegram-web-app.js').then(() => window.Telegram && window.Telegram.WebApp);
  }
  // wait for the webhook to land in the ledger (Telegram, VK, YooKassa pay on the server side)
  async function pollFor(sku, tries, gap) {
    let all = [];
    for (let i = 0; i < tries; i++) {
      const got = await claimAll(true);
      all = all.concat(got);
      if (got.some(g => !sku || g.sku === sku)) return all;
      await sleep(gap);
    }
    return all;
  }
  const bad = (why) => ({ ok: false, why });
  const good = got => ({ ok: true, grants: got });

  const ADAPT = {
    // Yandex Games: purchases signed by Yandex; the host checks the signature (/api/store/yandex/verify) and returns the
    // grants. Gem packs and the Starter Kit are consumed after the grant; a look stays unconsumed, so getPurchases()
    // restores it on a new device.
    yandex: {
      cat: {}, pay: null,
      async init() {
        const sdk = await within(ysdk(), 8000, null);
        if (!sdk) return false;
        if (!G.PF && sdk.features && sdk.features.LoadingAPI && !ADAPT.yandex.ready) { ADAPT.yandex.ready = 1; try { sdk.features.LoadingAPI.ready(); } catch (e) {} }
        try { this.pay = await sdk.getPayments({ signed: true }); } catch (e) { this.pay = null; }
        if (!this.pay) return false;
        try { (await this.pay.getCatalog() || []).forEach(p => { this.cat[p.id] = p; }); } catch (e) {}
        return true;
      },
      price(sku) { const p = this.cat[sku]; return p ? String(p.price || (p.priceValue + ' ' + (p.priceCurrencyCode || ''))) : ''; },
      sells(sku) { return !Object.keys(this.cat).length || !!this.cat[sku]; },
      async handle(p, signature) {
        if (!p || !p.purchaseToken) return [];
        const tok = 'ya:' + p.purchaseToken;
        let got = [];
        try {
          const r = await api('/api/store/yandex/verify', { signature: signature || p.signature, v: G.visitorId() });
          got = (r.grants || []).map(applyGrant).filter(Boolean);
          ack(G.visitorId(), (r.grants || []).map(g => g && g.id));
        } catch (e) {
          // no checker on this host (404/501/offline): the SDK's own word is enough for a cosmetic game; an explicit
          // refusal (400/403) is not
          if (!(e.status === 0 || e.status === 404 || e.status === 501 || e.status === 503)) return [];
          const one = applyGrant({ id: tok, sku: p.productID });
          if (one) got.push(one);
        }
        if (!gotIt(tok)) { keep(cos().got, tok); keep(mirOk().got, tok); mirSave(); }
        // Gems are consumed once granted; a look stays a Yandex purchase (restorable on any device)
        if (!/^cos_/.test(p.productID || '')) { try { await this.pay.consumePurchase(p.purchaseToken); } catch (e) {} }
        return got;
      },
      async buy(sku) {
        let p;
        // (the visitor id rides along: the host refuses a signature replayed for someone else)
        try { p = await this.pay.purchase({ id: sku, developerPayload: G.visitorId() }); } catch (e) { return bad('cancel'); }
        const got = await this.handle(p);
        return got.length ? good(got) : bad('verify');
      },
      // purchases not yet consumed (a crash between paying and granting), and looks on a new device
      async restore() {
        let list = [];
        try { list = await this.pay.getPurchases(); } catch (e) { return []; }
        let got = [];
        for (const p of list || []) {
          if (!p || !p.purchaseToken) continue;
          const tok = 'ya:' + p.purchaseToken, look = /^cos_/.test(p.productID || '') ? cosId(p.productID) : '';
          // a look Yandex says you own is yours here too (no Gems in it, so nothing can be paid twice)
          if (look && gotIt(tok)) { if (!cos().owned[look]) { cos().owned[look] = 1; mirOk().own[look] = 1; mirSave(); got.push({ id: tok, sku: p.productID, gems: 0, cos: look }); } continue; }
          // granted before but not consumed (closed in between): consume it now, grant nothing
          if (gotIt(tok)) { try { await this.pay.consumePurchase(p.purchaseToken); } catch (e) {} continue; }
          got = got.concat(await this.handle(p, list.signature));
          if (look && !cos().owned[look]) { cos().owned[look] = 1; mirOk().own[look] = 1; mirSave(); got.push({ id: tok + ':own', sku: p.productID, gems: 0, cos: look }); }
        }
        return got;
      },
    },
    // VK Mini Apps: the order box; VK calls the host (/api/store/vk/callback), the ledger gets the order under the
    // visitor id carried in the item ('<sku>:<visitor id>') and under 'vk:<user id>'; the client then claims it.
    vk: {
      async init() {
        const b = await within(bridge(), 8000, null);
        if (!b) return false;
        try { await within(b.send('VKWebAppInit'), 4000, null); } catch (e) {}
        const uid = qs().get('vk_user_id');
        if (uid && /^\d{1,20}$/.test(uid) && extraKeys.indexOf('vk:' + uid) < 0) extraKeys.push('vk:' + uid);
        return true;
      },
      price(sku) { const p = (cfg.prices || {})[sku] || {}, n = p.votes || p.vk; return n ? t('stVotes', fmtN(n)) : money(p.rub, 'RUB'); },
      sells() { return true; },
      async buy(sku) {
        let r;
        try { r = await window.vkBridge.send('VKWebAppShowOrderBox', { type: 'item', item: sku + ':' + G.visitorId() }); } catch (e) { return bad('cancel'); }
        if (r && r.success === false) return bad('cancel');
        const got = await pollFor(sku, 10, 1500);
        return got.length ? good(got) : bad('pending');
      },
    },
    // Telegram Stars: an invoice link from the host (Bot API createInvoiceLink, XTR), WebApp.openInvoice; the bot's
    // webhook writes the ledger on successful_payment; the client claims it.
    telegram: {
      async init() { const w = await within(tgApp(), 8000, null); if (w && w.ready) { try { w.ready(); } catch (e) {} } return !!(w && w.openInvoice); },
      price(sku) { const p = (cfg.prices || {})[sku] || {}; return p.stars ? '⭐ ' + fmtN(p.stars) : ''; },
      sells(sku) { const p = (cfg.prices || {})[sku]; return !!(p && p.stars); },
      async buy(sku) {
        let link;
        const W = window.Telegram && window.Telegram.WebApp, init = W && typeof W.initData === 'string' ? W.initData.slice(0, 4000) : '';
        try { link = (await api('/api/store/telegram/invoice', { sku, v: G.visitorId(), lang: lang() }, 12000, init ? { 'x-tg-init-data': init } : undefined)).link; } catch (e) { return bad(e.status === 409 ? 'owned' : 'invoice'); }
        if (!/^https:\/\/t\.me\/\$?[\w-]+/.test(String(link || ''))) return bad('invoice');
        const st = await new Promise(res => { try { window.Telegram.WebApp.openInvoice(link, res); } catch (e) { res('failed'); } });
        if (st === 'cancelled') return bad('cancel');
        if (st === 'failed') return bad('failed');
        const got = await pollFor(sku, 10, 1500);
        return got.length ? good(got) : bad('pending');
      },
    },
    // YooKassa (the own site): the host creates the payment and returns YooKassa's page; we go there and come back to
    // /play?paid=yk, where the claim picks up what the webhook wrote (the host re-fetches the payment to verify it)
    yookassa: {
      async init() { return true; },
      price(sku) { const p = (cfg.prices || {})[sku] || {}; return money(p.rub, 'RUB'); },
      sells(sku) { const p = (cfg.prices || {})[sku]; return !!(p && p.rub); },
      async buy(sku) {
        const u = new URL(location.href);
        ['paid', 'open', 'sku'].forEach(k => u.searchParams.delete(k));
        u.searchParams.set('paid', 'yk'); u.hash = '';
        let r;
        try { r = await api('/api/store/yookassa/create', { sku, v: G.visitorId(), return_url: u.toString() }); } catch (e) { return bad('create'); }
        if (!/^https:\/\/([a-z0-9-]+\.)*(yookassa\.ru|yoomoney\.ru)\//i.test(String(r.confirmation_url || ''))) return bad('create');
        ls.set('bttn_pay', JSON.stringify({ id: String(r.id || '').slice(0, 64), sku, at: Date.now() }));
        try { G.save && G.save(); } catch (e) {}
        location.assign(r.confirmation_url);
        return bad('redirect');
      },
    },
  };
  // rewarded ads (only where a provider has them; never on Steam)
  const ADS = {
    yandex: {
      async init() { const sdk = await within(ysdk(), 8000, null); return !!(sdk && sdk.adv && sdk.adv.showRewardedVideo); },
      show() {
        return G.ysdk.then(sdk => new Promise(res => {
          let paid = false;
          try {
            sdk.adv.showRewardedVideo({ callbacks: { onRewarded: () => { paid = true; }, onClose: () => res(paid), onError: () => res(false) } });
          } catch (e) { res(false); }
        }));
      },
    },
    vk: {
      async init() {
        const b = await within(bridge(), 8000, null);
        if (!b) return false;
        const r = await within(b.send('VKWebAppCheckNativeAds', { ad_format: 'reward' }), 5000, null);
        return !!(r && r.result);
      },
      async show() {
        try { const r = await window.vkBridge.send('VKWebAppShowNativeAds', { ad_format: 'reward' }); return !!(r && r.result); } catch (e) { return false; }
        finally { ADS.vk.init().then(ok => { adOk = ok; }); } // the next one loads in the background
      },
    },
    // Telegram: Adsgram (needs its block id from the host: ads.block)
    adsgram: {
      ctl: null,
      async init() {
        const block = cfg.ads && /^[\w-]{1,40}$/.test(String(cfg.ads.block || '')) ? String(cfg.ads.block) : '';
        if (!block || !inTelegram()) return false;
        if (!window.Adsgram) { try { await loadScript('https://sad.adsgram.ai/js/sad.min.js'); } catch (e) { return false; } }
        try { this.ctl = window.Adsgram.init({ blockId: block }); } catch (e) { return false; }
        return !!this.ctl;
      },
      async show() { try { const r = await this.ctl.show(); return !!(r && r.done); } catch (e) { return false; } },
    },
  };

  // ---------- money on screen ----------
  function money(n, cur) {
    n = +n;
    if (!(n > 0)) return '';
    if (cur === 'RUB') return (lang() === 'ru' ? fmtN(Math.round(n)) + ' руб.' : fmtN(Math.round(n)) + ' RUB');
    if (cur === 'STARS') return '⭐ ' + fmtN(Math.round(n));
    return '$' + n.toFixed(2);
  }
  // the currency the shown prices are in: Stars on Telegram, RUB for the Russian providers, USD otherwise
  const curOf = () => (provId === 'telegram' ? 'STARS' : RU[provId] ? 'RUB' : 'USD');
  function priceText(sku) {
    if (!prov) return '';
    if (prov.price) { const s = prov.price(sku); if (s) return s; }
    const p = (cfg && cfg.prices || {})[sku] || {};
    return money(curOf() === 'STARS' ? p.stars : curOf() === 'RUB' ? p.rub : p.usd, curOf());
  }
  // what N Gems are worth in money, from the smallest pack (the dearest per Gem: an honest upper bound)
  function worth(gems) {
    if (!G.Store.ready()) return '';
    const p = (cfg.prices || {}).gems_100;
    if (!p) return '';
    const cur = curOf(), per = (cur === 'STARS' ? p.stars : cur === 'RUB' ? p.rub : p.usd) / 100;
    if (!(per > 0)) return '';
    return money(cur === 'USD' ? Math.max(0.01, per * gems) : Math.max(1, Math.round(per * gems)), cur);
  }
  const sellable = sku => !!(G.Store.ready() && (!cfg.skus || typeof cfg.skus !== 'object' || cfg.skus[sku]) && (!prov.sells || prov.sells(sku)) && priceText(sku));

  // ---------- the ledger: claim and ack ----------
  // a 'vk:<user id>' key is the VK player's own only with VK's signed launch params (the host checks them)
  const keyHdr = key => (/^vk:/.test(key) ? { 'x-vk-params': location.search.slice(1, 4000) } : undefined);
  function ack(key, ids) {
    ids = (ids || []).filter(Boolean).map(String).slice(0, 100);
    if (!ids.length || apiBase() == null) return Promise.resolve();
    return api('/api/store/ack', { v: key, ids }, 8000, keyHdr(key)).catch(() => {});
  }
  async function claimAll(quiet) {
    if (apiBase() == null || !G.S) return [];
    const keys = [vidNow()].concat(extraKeys).filter(Boolean);
    let got = [];
    for (const key of keys) {
      let r;
      try { r = await api('/api/store/claim?v=' + encodeURIComponent(key), undefined, 12000, keyHdr(key)); } catch (e) { continue; }
      const list = Array.isArray(r.grants) ? r.grants.slice(0, 50) : [];
      got = got.concat(list.map(applyGrant).filter(Boolean));
      // ack all of them, also ones already applied here (an ack lost earlier must not keep them coming)
      await ack(key, list.map(g => g && g.id));
    }
    if (got.length && !quiet) announce(got);
    return got;
  }
  function announce(got) {
    const gems = got.reduce((a, g) => a + (g.gems || 0), 0), looks = got.filter(g => g.cos).map(g => G.L ? G.L(G.COS_BY_ID[g.cos].name) : G.COS_BY_ID[g.cos].name);
    const UI = G.UI;
    if (UI && UI.toast) UI.toast(`<b>${esc(t('stThanks'))}</b>&nbsp;${gems ? '+' + esc(fmtN(gems)) + ' ' + esc(t('stGemsWord')) : ''}${looks.length ? (gems ? ' · ' : '') + esc(looks.join(', ')) : ''}`, 'ach', 'ic_gem', { p: 2 });
    if (UI && UI.update) UI.update(true);
    if (openEl) render();
  }

  // ---------- G.Store ----------
  const Store = G.Store = {};
  // selling is possible here: the host configured it, a provider fits this place and answered, not Steam
  Store.ready = () => !!(booted && provOk && prov && !earnOnly() && cfg && cfg.store && cfg.store.on && cfg.payments !== false);
  Store.state = () => ({ booted, provider: provId, ready: Store.ready(), ads: adOk ? adId : '', earnOnly: earnOnly(), currency: prov ? curOf() : '' });
  Store.price = priceText;
  Store.worth = worth;
  Store.skus = () => PACKS.concat(['starter'], G.COSMETICS.filter(c => !c.only).map(c => 'cos_' + c.id)).filter(sellable);
  Store.claim = async function () {
    let got = await claimAll(true);
    if (prov && prov.restore && provOk) { try { got = got.concat(await prov.restore()); } catch (e) {} }
    cos();
    if (got.length) announce(got);
    return got;
  };
  Store.buy = async function (sku) {
    if (!Store.ready()) return bad('off');
    if (busy) return bad('busy');
    if (!skuInfo(sku) || !sellable(sku)) return bad('sku');
    if (sku === 'starter' && cos().starter) return bad('owned');
    const info = skuInfo(sku);
    if (info.cos && !info.gems && cos().owned[info.cos]) return bad('owned');
    busy = true; emit('buy_start', { sku, p: provId });
    let r;
    try { r = await prov.buy(sku); } catch (e) { r = bad(String((e && e.message) || e).slice(0, 40)); } finally { busy = false; }
    if (r.ok) { emit('buy_ok', { sku, p: provId }); announce(r.grants || []); } else if (r.why !== 'redirect') emit('buy_fail', { sku, p: provId, w: r.why });
    return r;
  };
  // looks bought with Gems (earned or bought): a fixed Gem price, the money worth shown beside it where Gems are sold
  Store.unlock = function (id) {
    const d = G.COS_BY_ID[id], S = G.S;
    if (!d || d.only || !S || cos().owned[id]) return false;
    if ((S.gems || 0) < d.gems) return false;
    S.gems -= d.gems;
    cos().owned[id] = 1; cos().on[d.kind] = id;
    try { G.emit && G.emit('cosmetic', d.kind, id, 'unlock'); } catch (e) {}
    try { G.save && G.save(); } catch (e) {}
    return true;
  };
  Store.wear = function (id) {
    const d = G.COS_BY_ID[id];
    if (!d || !cos().owned[id]) return false;
    cos().on[d.kind] = id;
    try { G.emit && G.emit('cosmetic', d.kind, id); } catch (e) {}
    return true;
  };
  Store.takeOff = function (kind) {
    if (G.COS_KINDS.indexOf(kind) < 0) return false;
    cos().on[kind] = '';
    try { G.emit && G.emit('cosmetic', kind, ''); } catch (e) {}
    return true;
  };

  // ---------- G.Ads ----------
  const Ads = G.Ads = {};
  let hushVol = null;
  function hush(on) {
    if (G.Audio && G.Audio.duck) { try { G.Audio.duck(on); } catch (e) {} return; }
    const s = G.S && G.S.set;
    if (!s) return;
    if (on && hushVol == null) { hushVol = s.vol; ls.set('bttn_hush', String(s.vol)); s.vol = 0; }
    else if (!on && hushVol != null) { s.vol = hushVol; hushVol = null; ls.del('bttn_hush'); }
    if (G.Audio && G.Audio.apply) G.Audio.apply();
  }
  // a continue paid by an ad: once a UTC day (DESIGN §4.9), counted in the save and on this device
  const adDay = () => ls.get('bttn_adc') || (G.S && G.S.cos && G.S.cos.adDay) || '';
  Ads.ready = function (pl) {
    if (!adOk || !adProv || earnOnly()) return false;
    if (pl === 'continue' && adDay() === today()) return false;
    return true;
  };
  Ads.show = async function (pl) {
    if (!Ads.ready(pl)) return false;
    emit('ad_show', { pl: pl || '', p: adId });
    G.adShowing = true; hush(true);
    let ok = false;
    try { ok = !!(await adProv.show(pl)); } catch (e) { ok = false; } finally { G.adShowing = false; hush(false); }
    if (ok) {
      emit('ad_ok', { pl: pl || '', p: adId });
      if (pl === 'continue') { ls.set('bttn_adc', today()); if (G.S) cos().adDay = today(); }
    }
    return ok;
  };

  // ---------- the store window (its own DOM and CSS, above the game's #modal) ----------
  G.tAdd && G.tAdd({
    stTitle: 'Gems & Looks', stTabGems: 'Gems', stTabLooks: 'Looks', stClose: 'Close', stHave: 'You have',
    stGemsWord: 'Gems', stPack: '{0} Gems', stConts: '{0} Continues', stStarter: 'Starter Kit',
    stStarterD: '100 Gems and the Founder\'s Flame (a Hand trail). Once.', stOnce: 'Once',
    stFair: 'Gems pay for the Continue (one a run) and for looks. Nothing here makes you stronger or unlocks anything.',
    stRestore: 'Restore purchases', stRestored: 'Restored: {0}', stNothing: 'Nothing new to restore.',
    stWait: 'Waiting for the payment…', stThanks: 'Thank you!', stFail: 'The payment did not go through.', stCancel: 'Cancelled.',
    stPending: 'Paid? It can take a minute to arrive: tap Restore purchases.', stBusy: 'One moment…',
    stSkin: 'Button finish', stTrail: 'Hand trail', stBeam: 'Loot beam', stWear: 'Wear', stOff: 'Take off', stWorn: 'Worn',
    stUnlock: 'Unlock', stStarterOnly: 'Starter Kit only', stNeed: '{0} more Gems needed', stWorth: '≈ {0}',
    stLooksNote: 'Looks change how things look, nothing else. Beams keep their rarity colour at the edge.',
    stEarnOnly: 'Gems are earned in play here: achievements, land stars, lords, relics and the daily gift.',
    stVotes: '{0} votes', stBuyFor: 'Buy · {0}',
  });
  const CSS = `
#bStore{position:fixed;inset:0;z-index:60;display:grid;place-items:center;padding:12px;background:rgba(6,5,10,.78);font:15px/1.35 var(--font-body,sans-serif);color:var(--text,#f1ece0)}
#bStore .bsBox{width:min(520px,100%);max-height:calc(100vh - 24px);max-height:calc(100dvh - 24px);display:flex;flex-direction:column;background:var(--panel,#1d1b26);border:3px solid var(--ink,#0a0910);box-shadow:inset 0 0 0 2px var(--line-hi,#6d6784),0 6px 0 var(--ink,#0a0910);animation:toastIn .2s ease-out}
#bStore .bsHead{display:flex;align-items:center;gap:8px;padding:12px 12px 8px;border-bottom:2px solid var(--line,#474258)}
#bStore h2{flex:1;margin:0;font:13px/1.4 var(--font-display,monospace);color:var(--gold,#ffd84a)}
#bStore .bsBal{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;background:var(--slot,#332f40);box-shadow:inset 0 0 0 2px var(--line,#474258);font:10px/1 var(--font-display,monospace);color:#ffd0f0}
#bStore .bsBal img,#bStore .bsGemI{width:15px;height:15px;image-rendering:pixelated}
#bStore .bsX{width:34px;height:34px;padding:0;font:14px/1 var(--font-display,monospace)}
#bStore .bsTabs{display:flex;gap:6px;padding:8px 12px 0}
#bStore .bsTabs button{flex:1;padding:8px 6px;font:9px/1.2 var(--font-display,monospace);background:var(--slot,#332f40);border:0;box-shadow:inset 0 0 0 2px var(--line,#474258);cursor:pointer;color:var(--dim,#a9a2b9)}
#bStore .bsTabs button.on{color:var(--gold,#ffd84a);box-shadow:inset 0 0 0 2px var(--gold,#ffd84a)}
#bStore .bsBody{overflow-y:auto;padding:12px;display:grid;gap:12px;-webkit-overflow-scrolling:touch}
#bStore .bsNote{margin:0;color:var(--dim,#a9a2b9);font-size:13px;text-align:center}
#bStore .bsMsg{min-height:18px;margin:0;text-align:center;color:#ffe0a0;font-size:14px}
#bStore .bsMsg.ok{color:var(--good,#56d45a)}#bStore .bsMsg.bad{color:var(--bad,#ff5a5a)}
#bStore .bsPacks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
#bStore .bsCard{position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 6px;background:var(--panel2,#262331);box-shadow:inset 0 0 0 2px var(--line,#474258);text-align:center}
#bStore .bsCard.hl{box-shadow:inset 0 0 0 2px var(--gold,#ffd84a),0 0 10px #ffd84a66}
#bStore .bsCard b{font:10px/1.3 var(--font-display,monospace);color:#ffd0f0}
#bStore .bsCard small{color:var(--dim,#a9a2b9);font-size:12px}
#bStore .bsGems{display:flex;gap:1px;justify-content:center;min-height:30px;align-items:flex-end}
#bStore .bsGems img{width:24px;height:24px;image-rendering:pixelated}
#bStore .bsBuy{width:100%;justify-content:center;font-size:12px;padding:8px 6px}
#bStore .bsStarter{display:grid;grid-template-columns:64px minmax(0,1fr);gap:10px;align-items:center;padding:10px;background:linear-gradient(#3a2414,#262331);box-shadow:inset 0 0 0 2px var(--fame,#ffa033)}
#bStore .bsStarter h3{margin:0 0 4px;font:11px/1.4 var(--font-display,monospace);color:var(--fame,#ffa033)}
#bStore .bsStarter p{margin:0 0 8px;color:var(--text,#f1ece0);font-size:13px}
#bStore .bsSect{margin:4px 0 0;font:9px/1.4 var(--font-display,monospace);color:var(--dim,#a9a2b9);letter-spacing:.05em}
#bStore .bsLook{display:grid;grid-template-columns:52px minmax(0,1fr);gap:4px 10px;align-items:center;padding:8px;background:var(--panel2,#262331);box-shadow:inset 0 0 0 2px var(--line,#474258)}
#bStore .bsLook.worn{box-shadow:inset 0 0 0 2px var(--good,#56d45a)}
#bStore .bsLook .pv{grid-row:span 2;width:52px;height:52px;display:grid;place-items:center;background:var(--ink,#0a0910);overflow:hidden;position:relative}
#bStore .bsLook .pv img{width:39px;height:36px;image-rendering:pixelated}
#bStore .bsLook h4{margin:0;font:9px/1.4 var(--font-display,monospace);color:var(--text,#f1ece0)}
#bStore .bsLook h4 i{font-style:normal;color:var(--good,#56d45a);margin-left:6px}
#bStore .bsLook p{margin:0;color:var(--dim,#a9a2b9);font-size:13px}
#bStore .bsActs{grid-column:2;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
#bStore .bsActs .btn{padding:6px 10px;font-size:12px}
#bStore .bsActs small{color:var(--faint,#6f6883);font-size:12px}
#bStore .trl{display:flex;align-items:center;gap:2px;transform:rotate(-20deg)}
#bStore .trl i{display:block;image-rendering:pixelated}
#bStore .beam{position:absolute;bottom:4px;left:50%;width:14px;height:46px;transform:translateX(-50%);background:linear-gradient(90deg,var(--r4,#ffa033) 0 3px,var(--c) 3px 11px,var(--r4,#ffa033) 11px)}
#bStore .beam::after{content:'';position:absolute;left:-6px;top:6px;width:3px;height:3px;background:var(--s);box-shadow:20px 10px 0 var(--s),4px 22px 0 var(--s),18px 30px 0 var(--s)}
#bStore .bsFoot{display:flex;justify-content:center;gap:8px;flex-wrap:wrap}
@media (max-width:420px){#bStore{padding:0}#bStore .bsBox{width:100%;height:100%;max-height:none;border:0}#bStore .bsPacks{grid-template-columns:1fr}#bStore .bsCard{flex-direction:row;justify-content:space-between;text-align:left;padding:8px 10px}#bStore .bsCard .bsBuy{width:auto;min-width:110px}#bStore .bsGems{min-height:0}}
`;
  let openEl = null, openCb = null, tab = 'gems', hl = '', msg = { t: '', k: '' }, lastFocus = null;
  const pvCache = {};
  function skinPv(d) {
    if (pvCache[d.id] == null) { try { pvCache[d.id] = G.SPR && G.SPR.button ? G.SPR.url(G.SPR.button(d.base, false, 0), 1) : ''; } catch (e) { pvCache[d.id] = ''; } }
    return pvCache[d.id] ? `<img src="${pvCache[d.id]}" alt="">` : `<i style="display:block;width:30px;height:30px;border-radius:50%;background:${esc(d.base)}"></i>`;
  }
  const trailPv = d => `<span class="trl">${[8, 7, 6, 5, 4, 3].map((s, i) => `<i style="width:${s}px;height:${s}px;background:${esc(d.cols[Math.min(d.cols.length - 1, Math.floor(i * d.cols.length / 6))])};opacity:${(1 - i * 0.13).toFixed(2)}"></i>`).join('')}</span>`;
  const beamPv = d => `<span class="beam" style="--c:${esc(d.core)};--s:${esc(d.spark)}"></span>`;
  const gemImg = (cls) => { try { return `<img class="${cls || ''}" src="${G.SPR.url('ic_gem', 3)}" alt="">`; } catch (e) { return '◆'; } };
  function lookRow(d) {
    const c = cos(), own = !!c.owned[d.id], worn = c.on[d.kind] === d.id, S = G.S, sell = Store.ready();
    const pv = d.kind === 'skin' ? skinPv(d) : d.kind === 'trail' ? trailPv(d) : beamPv(d);
    let acts = '';
    if (own) acts = worn ? `<button class="btn" data-off="${d.kind}">${esc(t('stOff'))}</button>` : `<button class="btn gold" data-wear="${d.id}">${esc(t('stWear'))}</button>`;
    else if (d.only === 'starter') acts = `<small>${esc(t('stStarterOnly'))}</small>`;
    else {
      const can = (S.gems || 0) >= d.gems, w = worth(d.gems);
      acts = `<button class="btn gem" data-unlock="${d.id}" ${can ? '' : 'disabled'}>${esc(t('stUnlock'))} <span class="cost">${gemImg()}${esc(fmtN(d.gems))}</span></button>` +
        (w ? `<small>${esc(t('stWorth', w))}</small>` : '') +
        (!can ? `<small>${esc(t('stNeed', fmtN(d.gems - (S.gems || 0))))}</small>` : '') +
        (sell && sellable('cos_' + d.id) ? `<button class="btn" data-buy="cos_${d.id}">${esc(t('stBuyFor', priceText('cos_' + d.id)))}</button>` : '');
    }
    const nm = G.L ? G.L(d.name) : d.name, ds = G.L ? G.L(d.desc) : d.desc;
    return `<div class="bsLook${worn ? ' worn' : ''}${hl === 'cos_' + d.id ? ' hl' : ''}" data-look="${d.id}"><span class="pv">${pv}</span><div><h4>${esc(nm)}${worn ? `<i>${esc(t('stWorn'))}</i>` : ''}</h4><p>${esc(ds)}</p></div><div class="bsActs">${acts}</div></div>`;
  }
  function gemsTab() {
    const c = cos(), cont = (G.TUNE && G.TUNE.contCost) || 30; // (DESIGN §4.9: 30 Gems a Continue)
    const starter = !c.starter && sellable('starter') ? `<div class="bsStarter${hl === 'starter' ? ' hl' : ''}"><span class="pv" style="display:grid;place-items:center;height:64px;background:var(--ink)">${trailPv(G.COS_BY_ID.founder_flame)}</span>
      <div><h3>${esc(t('stStarter'))}</h3><p>${esc(t('stStarterD'))}</p><button class="btn gold bsBuy" data-buy="starter">${esc(priceText('starter'))}</button></div></div>` : '';
    const packs = PACKS.filter(sellable).map((sku, i) => `<div class="bsCard${hl === sku ? ' hl' : ''}"><span class="bsGems">${gemImg().repeat(i + 1)}</span>
      <div><b>${esc(t('stPack', fmtN(SKUS[sku].gems)))}</b><br><small>${esc(t('stConts', Math.floor(SKUS[sku].gems / cont)))}</small></div>
      <button class="btn gem bsBuy" data-buy="${sku}">${esc(priceText(sku))}</button></div>`).join('');
    return `${starter}${packs ? `<div class="bsPacks">${packs}</div>` : ''}<p class="bsNote">${esc(t('stFair'))}</p>`;
  }
  function looksTab() {
    const sect = k => `<p class="bsSect">${esc(t(k === 'skin' ? 'stSkin' : k === 'trail' ? 'stTrail' : 'stBeam'))}</p>` + G.COSMETICS.filter(d => d.kind === k && (!d.only || cos().owned[d.id] || Store.ready())).map(lookRow).join('');
    return G.COS_KINDS.map(sect).join('') + `<p class="bsNote">${esc(t('stLooksNote'))}</p>`;
  }
  function render() {
    if (!openEl || !G.S) return;
    const sell = Store.ready();
    if (!sell) tab = 'looks';
    const box = openEl.querySelector('.bsBox'), keepY = box && box.querySelector('.bsBody') ? box.querySelector('.bsBody').scrollTop : 0;
    openEl.innerHTML = `<div class="bsBox" role="dialog" aria-modal="true" aria-label="${esc(t('stTitle'))}">
      <div class="bsHead"><h2>${esc(t('stTitle'))}</h2><span class="bsBal" title="${esc(t('stHave'))}">${gemImg()}<b>${esc(fmtN(G.S.gems || 0))}</b></span><button class="btn bsX" data-close aria-label="${esc(t('stClose'))}">✕</button></div>
      ${sell ? `<div class="bsTabs" role="tablist"><button role="tab" data-tab="gems" class="${tab === 'gems' ? 'on' : ''}" aria-selected="${tab === 'gems'}">${esc(t('stTabGems'))}</button><button role="tab" data-tab="looks" class="${tab === 'looks' ? 'on' : ''}" aria-selected="${tab === 'looks'}">${esc(t('stTabLooks'))}</button></div>` : ''}
      <div class="bsBody">
        ${tab === 'gems' ? gemsTab() : looksTab()}
        <p class="bsMsg ${msg.k}" aria-live="polite">${esc(msg.t)}</p>
        ${sell ? `<div class="bsFoot"><button class="btn" data-claim>${esc(t('stRestore'))}</button></div>` : `<p class="bsNote">${esc(t('stEarnOnly'))}</p>`}
      </div></div>`;
    const body = openEl.querySelector('.bsBody');
    if (body && keepY) body.scrollTop = keepY;
  }
  function say(k, txt) { msg = { t: txt || '', k: k || '' }; if (openEl) { const m = openEl.querySelector('.bsMsg'); if (m) { m.className = 'bsMsg ' + msg.k; m.textContent = msg.t; } } }
  function onClick(e) {
    const el = e.target.closest('button,[data-close]');
    if (e.target === openEl) return Store.close();
    if (!el || el.disabled) return;
    if (el.hasAttribute('data-close')) return Store.close();
    if (el.dataset.tab) { tab = el.dataset.tab; hl = ''; render(); return; }
    if (el.dataset.wear) { Store.wear(el.dataset.wear); render(); return; }
    if (el.dataset.off) { Store.takeOff(el.dataset.off); render(); return; }
    if (el.dataset.unlock) {
      if (Store.unlock(el.dataset.unlock)) { if (G.Audio && G.Audio.buy) G.Audio.buy(); if (G.UI && G.UI.update) G.UI.update(true); }
      render(); return;
    }
    if (el.dataset.buy) {
      const sku = el.dataset.buy;
      say('', t('stWait'));
      openEl.querySelectorAll('[data-buy],[data-claim]').forEach(b => { b.disabled = true; });
      Store.buy(sku).then(r => {
        if (!openEl) return;
        render();
        if (r.ok) say('ok', t('stThanks'));
        else if (r.why === 'redirect') say('', t('stWait'));
        else say(r.why === 'cancel' ? '' : 'bad', t(r.why === 'cancel' ? 'stCancel' : r.why === 'pending' ? 'stPending' : r.why === 'busy' ? 'stBusy' : 'stFail'));
      });
      return;
    }
    if (el.hasAttribute('data-claim')) {
      el.disabled = true; say('', t('stBusy'));
      Store.claim().then(got => { if (!openEl) return; render(); say(got.length ? 'ok' : '', got.length ? t('stRestored', got.length) : t('stNothing')); });
    }
  }
  // while the store is up the game hears no keys (Space must not hold the Button under it); buttons still work
  function onKey(e) { if (!openEl) return; e.stopPropagation(); if (e.key === 'Escape') Store.close(); }
  Store.open = function (which, cb) {
    if (typeof which === 'function') { cb = which; which = ''; }
    if (!G.S) return false;
    if (!document.getElementById('bStoreCss')) { const st = document.createElement('style'); st.id = 'bStoreCss'; st.textContent = CSS; document.head.appendChild(st); }
    hl = /^(gems_\d+|starter|cos_[a-z0-9_]+)$/.test(which || '') ? which : '';
    tab = which === 'looks' || /^cos_/.test(hl) ? 'looks' : 'gems';
    msg = { t: '', k: '' };
    if (openEl) Store.close(true);
    lastFocus = document.activeElement;
    openEl = document.createElement('div');
    openEl.id = 'bStore';
    openEl.addEventListener('click', onClick);
    document.body.appendChild(openEl);
    document.addEventListener('keydown', onKey, true);
    openCb = typeof cb === 'function' ? cb : null;
    render();
    emit('store_open', { tab, p: provId, sell: Store.ready() ? 1 : 0 });
    setTimeout(() => {
      if (!openEl) return;
      const h = openEl.querySelector('.hl'); if (h && h.scrollIntoView) h.scrollIntoView({ block: 'center' });
      const f = openEl.querySelector('.hl [data-buy],[data-close]'); if (f) f.focus();
    }, 30);
    return true;
  };
  Store.close = function (silent) {
    if (!openEl) return;
    openEl.remove(); openEl = null;
    document.removeEventListener('keydown', onKey, true);
    const cb = openCb; openCb = null;
    if (lastFocus && lastFocus.focus && lastFocus.isConnected) { try { lastFocus.focus(); } catch (e) {} }
    if (G.UI && G.UI.update) G.UI.update(true);
    if (!silent && cb) cb();
  };
  Store.isOpen = () => !!openEl;

  // ---------- boot: after the game's own boot (main.js), never in the way of it ----------
  async function boot() {
    if (booted) return;
    // a volume left at 0 by an ad that never ended (the tab closed mid-ad)
    const hv = ls.get('bttn_hush'); if (hv != null && G.S && G.S.set && !(G.S.set.vol > 0)) { G.S.set.vol = +hv || 0.5; ls.del('bttn_hush'); if (G.Audio && G.Audio.apply) G.Audio.apply(); }
    if (G.S) cos();
    if (earnOnly() || apiBase() == null) { booted = true; return; }
    await loadConfig();
    const st = cfg.store || {};
    provId = st.on && cfg.payments !== false && Array.isArray(st.providers) ? pickProvider(st.providers.map(String)) : '';
    prov = provId ? ADAPT[provId] : null;
    if (prov) provOk = !!(await within(prov.init(), 10000, false));
    const ad = cfg.ads || {};
    adId = ad.rewarded ? String(ad.provider || '') : '';
    // (the ad provider has to fit this place too: Yandex ads inside Yandex, VK inside VK, Adsgram inside Telegram)
    if (adId === 'telegram') adId = 'adsgram';
    if (ADS[adId] && ((adId === 'yandex' && inYandex()) || (adId === 'vk' && inVK()) || (adId === 'adsgram' && inTelegram()))) { adProv = ADS[adId]; adOk = !!(await within(adProv.init(), 10000, false)); }
    booted = true;
    // back from YooKassa (or a payment that was still on its way): claim, a few times while the webhook lands
    const q = qs(), pend = ls.json('bttn_pay', null);
    if (pend && Date.now() - (+pend.at || 0) > 3 * 864e5) ls.del('bttn_pay');
    if (q.has('paid') || (pend && Date.now() - (+pend.at || 0) <= 3 * 864e5)) {
      const got = await pollFor(pend && pend.sku, q.has('paid') ? 6 : 1, 2500);
      if (got.length) { if (pend) { emit('buy_ok', { sku: pend.sku, p: provId || 'yookassa' }); ls.del('bttn_pay'); } announce(got); }
      if (q.has('paid')) { const u = new URL(location.href); u.searchParams.delete('paid'); try { history.replaceState(history.state, '', u.toString()); } catch (e) {} }
    // (a claim only where something can be waiting: selling is on here, or this device has bought before)
    } else if ((vidNow() || extraKeys.length) && (Store.ready() || mirOk().got.length)) claimAll(false);
    if (prov && prov.restore && provOk) { try { const got = await prov.restore(); if (got.length) announce(got); } catch (e) {} }
    // the landing's support links: /play?open=shop&sku=<sku>#store
    if ((q.get('open') === 'shop' || location.hash === '#store') && Store.ready()) {
      const sku = String(q.get('sku') || '');
      setTimeout(() => Store.open(skuInfo(sku) ? sku : 'gems'), 600);
      const u = new URL(location.href); u.searchParams.delete('open'); u.searchParams.delete('sku'); if (u.hash === '#store') u.hash = '';
      try { history.replaceState(history.state, '', u.toString()); } catch (e) {}
    }
    try { G.emit && G.emit('storeReady', Store.state()); } catch (e) {}
    if (G.UI && G.UI.update) G.UI.update(true);
  }
  // the Gems chip in the HUD opens the store (the looks where nothing is sold)
  function wireChip() {
    const chip = document.getElementById('gemChip');
    if (!chip || chip.dataset.store) return;
    chip.dataset.store = '1'; chip.style.cursor = 'pointer'; chip.setAttribute('role', 'button'); chip.tabIndex = 0;
    chip.setAttribute('aria-label', t('stTitle'));
    const go = () => Store.open(Store.ready() ? 'gems' : 'looks');
    chip.addEventListener('click', go);
    chip.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  }
  // a new save (an import, a reset) brings its own looks state; the mirror goes back onto it
  if (G.on) G.on('ascend', () => { if (G.S) cos(); });
  const start = () => setTimeout(() => { wireChip(); boot().catch(() => { booted = true; }); }, 0);
  if (document.readyState === 'complete') start(); else window.addEventListener('load', start);
  // (tests and the console)
  Store._grant = applyGrant;
})(globalThis.G = globalThis.G || {});
