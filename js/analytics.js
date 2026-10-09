// BTTN 3.5 (4.0: + the Siege run events and the store funnel) — anonymous play analytics for the public host (deploy/serve.js). Where players come from (UTM tags,
// referrer), what they play on, and how far they get: intro, class, first press, tutorial, bosses, depths, lands,
// falls, the team, and whether they come back. No names, no saves, no IPs from here: a random visitor id kept in
// this browser, a session id, and game milestones. Off on claude.ai (the server sets window.BTTN_AN), with Global
// Privacy Control, or with Settings → Anonymous stats off.
(function (G) {
  'use strict';
  if (typeof window === 'undefined' || !window.BTTN_AN) return;
  const URL_EV = typeof window.BTTN_AN === 'string' ? window.BTTN_AN : '/api/ev';
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };
  const rid = n => { const a = new Uint8Array(n); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => { a[i] = Math.random() * 256; }); return Array.from(a, b => (b % 36).toString(36)).join(''); };
  const off = () => navigator.globalPrivacyControl === true || (G.S && G.S.set && G.S.set.stats === 0);

  // ---------- who and from where ----------
  let vid = ls.get('bttn_vid');
  const isNew = !vid;
  if (!vid) { vid = rid(14); ls.set('bttn_vid', vid); ls.set('bttn_vfirst', String(Date.now())); }
  const sid = rid(10);
  const q = new URLSearchParams(location.search);
  const refHost = (() => { try { const h = document.referrer ? new URL(document.referrer).hostname : ''; return h && h !== location.hostname ? h.replace(/^www\./, '') : ''; } catch (e) { return ''; } })();
  const touch = {
    src: (q.get('utm_source') || q.get('ref') || '').slice(0, 60), med: (q.get('utm_medium') || '').slice(0, 40),
    cmp: (q.get('utm_campaign') || '').slice(0, 80), cnt: (q.get('utm_content') || '').slice(0, 80), trm: (q.get('utm_term') || '').slice(0, 60),
    ref: refHost.slice(0, 80), land: location.pathname.slice(0, 60),
  };
  // the first touch stays with the visitor for good (that's what a campaign is credited with)
  let first = null;
  try { first = JSON.parse(ls.get('bttn_vtouch') || 'null'); } catch (e) {}
  if (!first) { first = touch; ls.set('bttn_vtouch', JSON.stringify(first)); }
  const firstAt = +ls.get('bttn_vfirst') || Date.now();

  // ---------- the queue ----------
  const t0 = Date.now();
  let queue = [], seq = 0, lastSend = 0;
  function ev(t, d) {
    if (off()) return;
    if (queue.length > 300) queue.splice(0, queue.length - 300);
    queue.push(d ? { t, ts: Date.now(), n: ++seq, d } : { t, ts: Date.now(), n: ++seq });
    if (queue.length >= 40) flush();
  }
  function flush(beacon) {
    if (!queue.length || off()) return;
    const body = JSON.stringify({ v: vid, s: sid, e: queue });
    queue = []; lastSend = Date.now();
    // text/plain keeps it a simple request (no preflight); sendBeacon survives the tab closing
    try {
      if (beacon && navigator.sendBeacon && navigator.sendBeacon(URL_EV, new Blob([body], { type: 'text/plain' }))) return;
      fetch(URL_EV, { method: 'POST', body, headers: { 'content-type': 'text/plain' }, keepalive: body.length < 60000 }).catch(() => {});
    } catch (e) {}
  }
  G.track = ev;

  // ---------- the session (once the save has loaded: main.js runs after this file) ----------
  function init() {
  const S0 = G.S || {};
  ev('start', {
    nw: isNew ? 1 : 0, age: Math.floor((Date.now() - firstAt) / 864e5), ...touch,
    f: isNew ? undefined : first, sw: screen.width, sh: screen.height, vw: innerWidth, vh: innerHeight, dpr: +(devicePixelRatio || 1).toFixed(2),
    tch: matchMedia('(pointer: coarse)').matches ? 1 : 0, lang: (navigator.language || '').slice(0, 12), tz: (Intl.DateTimeFormat().resolvedOptions().timeZone || '').slice(0, 40),
    save: S0.st && S0.st.playTime > 5 ? { pt: Math.round(S0.st.playTime), bd: S0.bestDepth || 0, asc: S0.ascensions || 0, cls: (S0.hero && S0.hero.cls) || '' } : undefined,
  });

  // ---------- milestones ----------
  const on = (k, f) => G.on && G.on(k, f);
  const S = () => G.S || {};
  // the intro (DOM: #intro shows first; its Skip / Next buttons)
  let introSeen = false;
  document.addEventListener('click', e => {
    const box = e.target.closest && e.target.closest('#intro');
    if (!box) return;
    if (e.target.closest('[data-skip]')) ev('intro_skip');
    else if (e.target.closest('[data-next]')) ev('intro_next');
  }, true);
  on('classChosen', () => ev('class', { c: S().hero && S().hero.cls }));
  on('bossWin', (rew, b) => ev('boss_win', { d: b && b.d, l: b && b.lord ? 1 : 0 }));
  on('bossFail', b => ev('boss_fail', { d: b && b.d, l: b && b.lord ? 1 : 0 }));
  on('realm', r => ev('land', { li: r, d: S().depth }));
  on('runOver', sum => ev('run_over', { d: sum && sum.depth, s: sum && Math.round(sum.secs), f: sum && sum.fame, g: S().gems || 0, c: S().runConts || 0 }));
  // 3.6: what they chose when it fell: continue here (how, the n-th this run) or a new run
  on('runContinue', how => ev('run_cont', { h: how, n: S().runConts, g: S().gems || 0, d: S().depth }));
  // (3.6's run_end {d, f}; in 4.0 the Siege's own run_end below says it, so this one is left out when it did)
  let sumAt = 0;
  on('runEnd', f => { if (Date.now() - sumAt > 5000) ev('run_end', { d: f && f.depth, f: f && f.fame }); });
  // 4.0 (ADDENDUM 12, DESIGN §12): the Siege. A run's start and end ({kind, depth, mins, cause, heat, btn}: the admin's
  // "Runs (4.0)" card), the cards picked, the doors taken, the camp's choices, the Deeds a run earned, and the big drops
  // (legendary and up, uniques, relics: the rest would only fill the queue)
  on('runStart', r => { if (r) ev('run_start', { btn: r.btn || '', heat: r.heat | 0, cls: r.cls || (S().hero && S().hero.cls) || '', day: r.day ? 1 : 0, n: r.n | 0 }); });
  on('runSummary', s => {
    if (!s) return;
    sumAt = Date.now();
    ev('run_end', { kind: String(s.kind || ''), depth: (s.maxDepth != null ? s.maxDepth : s.depth) | 0, mins: Math.round((+s.secs || 0) / 6) / 10, cause: s.cause || '', heat: s.heat | 0, btn: s.btn || '', cls: s.cls || '', day: s.day ? 1 : 0, f: s.fame && typeof s.fame === 'object' ? s.fame.total : undefined });
    if (s.kind === 'extract') ev('extract', { depth: s.depth | 0 });
    for (const d of (Array.isArray(s.deeds) ? s.deeds : []).slice(0, 20)) ev('deed', { id: String(d && typeof d === 'object' ? d.id : d).slice(0, 24) });
  });
  on('cardPick', (id, rank, tier, how) => ev('card', { id: String(id || '').slice(0, 24), n: rank | 0, how: how || '' }));
  on('door', (o, slot) => { if (o) ev('door', { id: String(o.land || '').slice(0, 24), mod: o.mod || '', tag: o.tag || '', slot: slot | 0 }); });
  on('campAct', k => ev('camp', { a: String(k || '').slice(0, 16) }));
  on('loot', li => {
    const it = li && li.it;
    if (!it || !(it.r >= 4 || it.uq || it.relic)) return;
    ev('loot', { r: it.relic ? 'relic' : it.uq ? 'unique' : (G.RARITIES && G.RARITIES[it.r] && G.RARITIES[it.r].id) || String(it.r) });
  });
  on('gems', (n, why) => ev('gems', { n, w: why }));
  // 4.0: the store funnel (js/store.js emits 'store' with the step): the store opened, a purchase started / paid /
  // failed, a rewarded ad shown / paid out. Only these names pass, with their small payload (sku, provider, why, placement)
  const FUNNEL = { store_open: 1, buy_start: 1, buy_ok: 1, buy_fail: 1, ad_show: 1, ad_ok: 1 };
  on('store', (k, d) => { if (FUNNEL[k]) ev(k, d && typeof d === 'object' ? d : undefined); });
  on('ascend', (g, death) => { if (!death) ev('ascend', { d: S().maxDepth }); });
  on('bless', b => ev('bless', { id: b && b.id }));
  on('champKill', c => ev('champ', { m: c.mech, ok: 1 }));
  on('champEscape', (c, why) => ev('champ', { m: c.mech, ok: 0, w: why }));
  on('recruit', m => ev('recruit', { c: m && m.cls }));
  on('slotOpen', k => ev('seat', { k }));
  on('town', inTown => { if (inTown) ev('town'); });
  on('build', (id, l) => ev('build', { id, l }));
  on('relicDrop', g => ev('relic', { id: g && g.id }));
  on('jackpot', () => ev('jackpot'));
  on('odStart', how => ev('od', { h: how }));
  on('rankUp', r => ev('rank', { r: r && r.n != null ? r.n : r }));
  on('levelUp', () => { const l = S().hero && S().hero.lvl; if (l && (l <= 5 || l % 5 === 0)) ev('lvl', { l }); });
  let bestSeen = S0.bestDepth || 0;
  // every second: the tutorial step, the first press, a held Button, a new best depth
  let tutLast = S0.tut, clicked = (S0.clicks || 0) > 0, held = !!(S0.seen && S0.seen.hold);
  setInterval(() => {
    const s = S();
    if (!s.st) return;
    if (!introSeen && document.getElementById('intro') && !document.getElementById('intro').hidden) introSeen = true;
    if (introSeen && document.getElementById('intro') && document.getElementById('intro').hidden) { introSeen = false; ev('intro_done'); }
    if (s.tut !== tutLast) { ev(s.tut === -1 ? 'tut_end' : 'tut', { k: s.tut, from: tutLast }); tutLast = s.tut; }
    if (!clicked && (s.clicks || 0) > 0) { clicked = true; ev('first_click'); }
    if (!held && s.seen && s.seen.hold) { held = true; ev('hold'); }
    if ((s.bestDepth || 0) > bestSeen) { bestSeen = s.bestDepth; ev('depth', { d: bestSeen }); }
  }, 1000);
  // a heartbeat while the tab is in front: how long they really play and where they are
  setInterval(() => {
    if (document.hidden) return;
    const s = S();
    // (3.6: and how smooth it runs for them: the frame rate and the quality tier the game settled on)
    const Q = G.Quality;
    ev('hb', { pt: Math.round((s.st && s.st.playTime) || 0), d: s.depth || 0, l: (s.hero && s.hero.lvl) || 0, p: (s.party || []).length, tn: G.R && G.R.town ? 1 : 0, fps: Q ? Q.fps | 0 : undefined, q: Q ? Q.tier : undefined, fx: s.set && s.set.lowfx ? 1 : 0 });
  }, 30000);
  // errors (to fix what breaks for real players)
  let errN = 0;
  window.addEventListener('error', e => { if (errN++ < 5) ev('err', { m: String(e.message || '').slice(0, 160), at: String((e.filename || '').split('/').pop() + ':' + (e.lineno || 0)).slice(0, 60) }); });
  // leaving: what they'd reached
  const bye = () => { const s = S(); ev('end', { secs: Math.round((Date.now() - t0) / 1000), pt: Math.round((s.st && s.st.playTime) || 0), d: s.depth || 0, bd: s.bestDepth || 0, tut: s.tut }); flush(true); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) bye(); });
  window.addEventListener('pagehide', bye);
  setInterval(() => { if (queue.length && Date.now() - lastSend > 15000) flush(); }, 5000);
  setTimeout(flush, 4000);
  }
  if (document.readyState === 'complete') setTimeout(init, 0); else window.addEventListener('load', () => setTimeout(init, 0));
})(globalThis.G = globalThis.G || {});
