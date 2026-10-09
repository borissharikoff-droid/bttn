// BTTN 4.0 — the Daily Siege board on the public host (deploy/serve.js /api/daily).
// One seed a UTC day, the first attempt ranked (DESIGN §6.5, ADDENDUM 11): by zones cleared, then time. The board lives
// on the public host because net.js boards exist only on claude.ai. The run logic posts its result with
// G.Daily.submit({day, zones, secs, btn, cls, heat, seed}) (or emits 'dailyResult' with it); the setup screen and the run
// summary open the board with G.Daily.open(). The name is the player's own (16 letters, digits, space, _ or -), kept on
// this device (localStorage 'bttn_dname'); the visitor id ('bttn_vid', js/analytics.js) finds "your row".
//   GET  /api/daily?day=YYYY-MM-DD&v=<visitor> -> {day, top:[{rank, name, zones, secs, btn, cls, heat}], you:{rank,...}|null, n}
//   POST /api/daily {day, zones, secs, btn, cls, heat, name, v, seed, tok} -> {ok, rank} | {error}
//   POST /api/daily/start {day, v} -> {tok}   (when a ranked Daily Siege begins: the host dates the run)
// 4.0 (platform-fix): the day's one ranked result is kept on this device ('bttn_dpend') from the moment the run ends
// until the host has it: 'Post later', a network error, a busy or restarting host only delay it (retried with backoff,
// and offered again whenever the board opens, while the day is still open).
(function (G) {
  'use strict';
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const Daily = G.Daily = {};
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
    json(k) { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v && typeof v === 'object' ? v : null; } catch (e) { return null; } },
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const t = (k, ...a) => (G.t ? G.t(k, ...a) : k);
  // the same host rule as the store: BTTN_API on a portal build, our own origin when deploy/serve.js served the game
  const apiBase = () => {
    if (typeof window.BTTN_API === 'string' && /^(https:\/\/[^\s"'<>]+|)$/.test(window.BTTN_API)) return window.BTTN_API.replace(/\/+$/, '');
    if (window.BTTN_AN && /^https?:$/.test(location.protocol)) return '';
    return null;
  };
  const vid = () => (G.visitorId ? G.visitorId() : (/^[a-z0-9]{6,24}$/.test(ls.get('bttn_vid') || '') ? ls.get('bttn_vid') : ''));
  const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
  const dayOf = ms => new Date(ms).toISOString().slice(0, 10);
  Daily.today = () => dayOf(Date.now());
  Daily.yesterday = () => dayOf(Date.now() - 864e5);
  Daily.ready = () => apiBase() != null;
  Daily.MAX_ZONES = 18;

  // ---------- the name ----------
  // letters (any script), digits, space, _ and -; 16 at most (the host checks the same)
  Daily.sanitize = s => [...String(s == null ? '' : s).normalize('NFKC').replace(/[^\p{L}\p{N} _-]/gu, '').replace(/\s+/g, ' ').trim()].slice(0, 16).join('').trim();
  Daily.name = () => Daily.sanitize(ls.get('bttn_dname') || '');
  Daily.setName = n => { n = Daily.sanitize(n); ls.set('bttn_dname', n); return n; };

  // ---------- the board ----------
  const cache = {};
  function req(path, body) {
    const base = apiBase();
    if (base == null) return Promise.reject(new Error('offline'));
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const tm = ctl ? setTimeout(() => ctl.abort(), 9000) : 0;
    const o = body === undefined ? { method: 'GET' } : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
    if (ctl) o.signal = ctl.signal;
    return fetch(base + path, o).then(r => r.text().then(txt => {
      let j = null;
      try { j = txt ? JSON.parse(txt) : {}; } catch (e) { j = null; }
      if (!j || typeof j !== 'object') throw Object.assign(new Error('http ' + r.status), { status: r.status });
      if (!r.ok && !j.error) j.error = 'http ' + r.status;
      if (!r.ok) Object.defineProperty(j, '_status', { value: r.status });
      return j;
    })).finally(() => { if (tm) clearTimeout(tm); });
  }
  const num = (v, lo, hi) => { v = Math.floor(+v); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : lo; };
  const row = r => r && typeof r === 'object' ? {
    rank: num(r.rank, 0, 1e6), name: Daily.sanitize(r.name) || '—', zones: num(r.zones, 0, Daily.MAX_ZONES), secs: num(r.secs, 0, 864e3),
    btn: String(r.btn || '').replace(/[^a-z0-9_]/gi, '').slice(0, 24), cls: String(r.cls || '').replace(/[^a-z0-9_]/gi, '').slice(0, 24), heat: num(r.heat, 0, 99),
  } : null;
  Daily.load = function (day, fresh) {
    day = DAY_RE.test(day || '') ? day : Daily.today();
    const c = cache[day];
    if (c && !fresh && Date.now() - c.at < 30e3) return c.p;
    const v = /^[a-z0-9]{6,24}$/.test(ls.get('bttn_vid') || '') ? ls.get('bttn_vid') : '';
    const p = req('/api/daily?day=' + day + (v ? '&v=' + encodeURIComponent(v) : '')).then(j => {
      if (j.error) throw new Error(String(j.error));
      return { day: DAY_RE.test(j.day || '') ? j.day : day, top: (Array.isArray(j.top) ? j.top : []).slice(0, 50).map(row).filter(Boolean), you: row(j.you), n: num(j.n, 0, 1e9) };
    });
    cache[day] = { at: Date.now(), p };
    p.catch(() => { delete cache[day]; });
    return p;
  };
  // the first attempt each day is the ranked one; the host refuses others too (this only saves the trip)
  const sentKey = 'bttn_dsent', PEND = 'bttn_dpend', TOK = 'bttn_dtok';
  Daily.posted = day => (ls.get(sentKey) || '') === (day || Daily.today());
  // a day takes posts until it ends (UTC), and yesterday's for the first hour of today (a run that crossed midnight)
  const open4 = day => day === Daily.today() || (day === Daily.yesterday() && Date.now() - Date.parse(Daily.today() + 'T00:00:00Z') < 3600e3);
  function check(r) {
    if (!r || typeof r !== 'object') return 'bad';
    if (r.assisted) return 'assisted';
    const day = r.day || Daily.today();
    if (!open4(day)) return 'late';
    const z = Math.floor(+r.zones), s = Math.round(+r.secs);
    if (!(z >= 0 && z <= Daily.MAX_ZONES) || !(s >= 20 * z) || !isFinite(s)) return 'bad';
    if (Daily.posted(day)) return 'twice';
    return '';
  }
  // ---------- the result waiting to be posted (one: the day's ranked run) ----------
  const keepRes = r => ({ day: r.day || Daily.today(), zones: Math.floor(+r.zones), secs: Math.round(+r.secs), btn: String(r.btn || '').slice(0, 24), cls: String(r.cls || '').slice(0, 24), heat: Math.max(0, Math.floor(+r.heat || 0)), seed: r.seed == null ? '' : String(r.seed).slice(0, 40) });
  Daily.pending = function () {
    const p = ls.json(PEND);
    if (!p || !DAY_RE.test(p.day || '')) return null;
    // (its day is over, or the host has it already: nothing to keep)
    if (!open4(p.day) || Daily.posted(p.day)) { ls.del(PEND); return null; }
    return p;
  };
  // posted, refused for good, or its day over: the result is done with. Anything else (offline, busy, 5xx): kept
  const final = res => !!(res && (res.ok || /^(twice|late|bad|assisted)$/.test(res.error || '')));
  let retryT = 0, retryN = 0;
  const BACKOFF = [15e3, 60e3, 300e3, 900e3];
  function later() {
    clearTimeout(retryT);
    const p = Daily.pending();
    if (!p || !Daily.ready()) return;
    retryT = setTimeout(() => { retryT = 0; if (asking()) return later(); Daily.retry().then(r => { if (!final(r)) later(); }); }, BACKOFF[Math.min(retryN++, BACKOFF.length - 1)]);
  }
  // (the board is up with the Post box: the player's own click posts it, not a timer behind their back)
  const asking = () => !!(el && st && st.post);
  // post what is waiting (no name yet: it waits for the board, where the player picks one)
  Daily.retry = function () {
    const p = Daily.pending();
    if (!p) return Promise.resolve({ error: 'none' });
    if (!Daily.ready()) return Promise.resolve({ error: 'offline' });
    if (!Daily.name()) return Promise.resolve({ error: 'name' });
    return post(p);
  };
  // post a finished Daily Siege. No name yet: the board opens and asks for one first (resolves after Post or Later).
  Daily.submit = function (result, opts) {
    opts = opts || {};
    const why = check(result);
    if (why) return Promise.resolve({ error: why });
    // kept on this device first: whatever happens next, the day's ranked run is not lost
    ls.set(PEND, JSON.stringify(keepRes(result)));
    if (!Daily.ready()) return Promise.resolve({ error: 'offline' });
    if (!Daily.name() && opts.ask !== false) return new Promise(res => open(Daily.today(), { post: keepRes(result), done: res }));
    return post(keepRes(result));
  };
  let posting = null;
  function post(r) {
    const day = r.day || Daily.today(), t = ls.json(TOK);
    const body = {
      day, zones: Math.floor(+r.zones), secs: Math.round(+r.secs), btn: String(r.btn || '').slice(0, 24), cls: String(r.cls || '').slice(0, 24),
      heat: Math.max(0, Math.floor(+r.heat || 0)), name: Daily.name() || 'Hand', v: vid(), seed: r.seed == null ? '' : String(r.seed).slice(0, 40),
    };
    // the run token from this run's start (same day, same visitor), when there is one
    if (t && t.day === day && t.v === body.v && typeof t.tok === 'string') body.tok = t.tok;
    if (posting) return posting;
    posting = req('/api/daily', body).then(j => {
      let res;
      if (j.ok) { ls.set(sentKey, day); delete cache[day]; try { G.emit && G.emit('dailyPosted', { day, rank: j.rank }); } catch (e) {} res = { ok: true, rank: num(j.rank, 0, 1e9) }; }
      else {
        // the host has this visitor's first attempt already: nothing more to send today
        const e = String(j.error || 'bad');
        if (/twice|first|already/i.test(e)) { ls.set(sentKey, day); res = { error: 'twice', rank: j.rank == null ? undefined : num(j.rank, 0, 1e9) }; }
        else if (/slow|too many|full|busy/i.test(e) || j._status === 429 || j._status >= 500) res = { error: 'busy' };
        else res = { error: /^day$/.test(e) ? 'late' : /^(zones|secs|heat|btn|v|bad|setup|token)$/.test(e) ? 'bad' : e.slice(0, 40) };
      }
      return res;
    }, () => ({ error: 'offline' })).then(res => {
      posting = null;
      if (final(res)) { ls.del(PEND); clearTimeout(retryT); retryN = 0; } else later();
      return res;
    });
    return posting;
  }
  // ---------- the run token: asked for when a ranked Daily Siege begins (a few tries; a post without one still counts) ----------
  function start(day, n) {
    const v = vid();
    if (!Daily.ready() || !v || !DAY_RE.test(day || '')) return;
    req('/api/daily/start', { day, v }).then(j => {
      if (j && typeof j.tok === 'string' && j.tok.length < 64) ls.set(TOK, JSON.stringify({ day, v, tok: j.tok }));
      else if ((n | 0) < 2 && !(j && j.error === 'day')) setTimeout(() => start(day, (n | 0) + 1), [3e3, 15e3][n | 0]);
    }, () => { if ((n | 0) < 2) setTimeout(() => start(day, (n | 0) + 1), [3e3, 15e3][n | 0]); });
  }
  if (G.on) G.on('runStart', r => { if (r && r.day && r.ranked) { ls.del(TOK); start(r.day); } });
  if (G.on) G.on('dailyResult', r => { Daily.submit(r); });
  // a result still waiting from an earlier visit (or a dropped connection): tried again soon after load, and when online
  window.addEventListener('load', () => setTimeout(() => { if (Daily.pending() && Daily.name() && !asking()) Daily.retry().then(r => { if (!final(r)) later(); }); }, 4000));
  window.addEventListener('online', () => { if (Daily.pending() && Daily.name() && !asking()) { retryN = 0; Daily.retry(); } });

  // ---------- the board window ----------
  G.tAdd && G.tAdd({
    dyTitle: 'Daily Siege', dyToday: 'Today', dyYesterday: 'Yesterday', dyClose: 'Close', dyLoading: 'Loading the board…',
    dyEmpty: 'No one has posted yet. The first run of the day is the ranked one.', dyOffline: 'The board lives on the public site.',
    dyErr: 'The board did not answer. Try again in a moment.', dyYou: 'You', dyNotYet: 'Your first Daily Siege today is your ranked run.',
    dyName: 'Your name on the board', dyNameHint: 'Letters, digits, space, _ or -. 16 at most. Posted runs keep the name they had.',
    dySave: 'Save', dySaved: 'Saved.', dyChange: 'Change', dyPost: 'Post my run', dySkip: 'Post later', dyRun: '{0} zones · {1}', dyPosted: 'Posted: #{0}',
    dyKept: 'Not posted yet ({0}). Your run is kept: it posts by itself when the board answers.', dyLater: 'Kept. Open the board to post it before the day ends.',
    dyPostErr: 'Not posted: {0}', dyPlayers: '{0} players', dyZones: 'Zones', dyTime: 'Time', dyHeat: 'H{0}',
    dyWhy_late: 'that day is over', dyWhy_twice: 'only the first attempt counts', dyWhy_bad: 'the run did not check out', dyWhy_offline: 'the board is offline', dyWhy_busy: 'the board is busy, try later', dyWhy_assisted: 'a continued run is not ranked',
  });
  // Russian, for the i18n stream's G.addStrings (ADDENDUM 10): registered when it exists, readable in G.STR_RU either way
  const RU_STR = {
    dyTitle: 'Осада дня', dyToday: 'Сегодня', dyYesterday: 'Вчера', dyClose: 'Закрыть', dyLoading: 'Загружаем таблицу…',
    dyEmpty: 'Пока никто не отправил результат. Рейтинговый — первый забег дня.', dyOffline: 'Таблица живёт на сайте игры.',
    dyErr: 'Таблица не ответила. Попробуй через минуту.', dyYou: 'Ты', dyNotYet: 'Первая Осада дня сегодня — рейтинговая.',
    dyName: 'Твоё имя в таблице', dyNameHint: 'Буквы, цифры, пробел, _ или -. Не больше 16. У отправленных забегов остаётся прежнее имя.',
    dySave: 'Сохранить', dySaved: 'Сохранено.', dyChange: 'Изменить', dyPost: 'Отправить забег', dySkip: 'Отправить позже', dyRun: 'Зон: {0} · {1}', dyPosted: 'Отправлено: №{0}',
    dyKept: 'Пока не отправлено ({0}). Забег сохранён и отправится сам, когда таблица ответит.', dyLater: 'Сохранено. Открой таблицу, чтобы отправить забег до конца дня.',
    dyPostErr: 'Не отправлено: {0}', dyPlayers: 'Игроков: {0}', dyZones: 'Зоны', dyTime: 'Время', dyHeat: 'Ж{0}',
    dyWhy_late: 'этот день закончился', dyWhy_twice: 'считается только первая попытка', dyWhy_bad: 'забег не прошёл проверку', dyWhy_offline: 'таблица недоступна', dyWhy_busy: 'таблица занята, попробуй позже', dyWhy_assisted: 'продолженный забег не идёт в рейтинг',
  };
  G.STR_RU = Object.assign(G.STR_RU || {}, RU_STR);
  try { if (G.addStrings) G.addStrings('ru', RU_STR); } catch (e) {}
  const CSS = `
#bDaily{position:fixed;inset:0;z-index:58;display:grid;place-items:center;padding:12px;background:rgba(6,5,10,.78);font:15px/1.35 var(--font-body,sans-serif);color:var(--text,#f1ece0)}
#bDaily .bdBox{width:min(520px,100%);max-height:calc(100vh - 24px);max-height:calc(100dvh - 24px);display:flex;flex-direction:column;background:var(--panel,#1d1b26);border:3px solid var(--ink,#0a0910);box-shadow:inset 0 0 0 2px var(--line-hi,#6d6784),0 6px 0 var(--ink,#0a0910);animation:toastIn .2s ease-out}
#bDaily .bdHead{display:flex;align-items:center;gap:8px;padding:12px 12px 8px;border-bottom:2px solid var(--line,#474258)}
#bDaily h2{flex:1;margin:0;font:13px/1.4 var(--font-display,monospace);color:var(--gold,#ffd84a)}
#bDaily h2 small{display:block;font:13px/1.2 var(--font-body,sans-serif);color:var(--dim,#a9a2b9)}
#bDaily .bdX{width:34px;height:34px;padding:0;font:14px/1 var(--font-display,monospace)}
#bDaily .bdTabs{display:flex;gap:6px;padding:8px 12px 0}
#bDaily .bdTabs button{flex:1;padding:8px 6px;font:9px/1.2 var(--font-display,monospace);background:var(--slot,#332f40);border:0;box-shadow:inset 0 0 0 2px var(--line,#474258);cursor:pointer;color:var(--dim,#a9a2b9)}
#bDaily .bdTabs button.on{color:var(--gold,#ffd84a);box-shadow:inset 0 0 0 2px var(--gold,#ffd84a)}
#bDaily .bdHead,#bDaily .bdTabs{flex:none}
#bDaily .bdBody{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:10px 12px 12px;display:grid;align-content:start;gap:10px;-webkit-overflow-scrolling:touch}
#bDaily .bdNote{margin:0;color:var(--dim,#a9a2b9);font-size:13px;text-align:center}
#bDaily .bdList{display:grid;gap:2px}
#bDaily .bdRow{display:grid;grid-template-columns:34px 20px minmax(0,1fr) 42px 52px 30px;gap:6px;align-items:center;padding:5px 6px;background:var(--panel2,#262331);font-size:14px}
#bDaily .bdRow.hd{background:none;color:var(--faint,#6f6883);font:7px/1.2 var(--font-display,monospace);padding-top:0;padding-bottom:0}
#bDaily .bdRow.me{background:#2c3a26;box-shadow:inset 0 0 0 2px var(--good,#56d45a)}
#bDaily .bdRow .rk{font:9px/1 var(--font-display,monospace);color:var(--dim,#a9a2b9);text-align:right}
#bDaily .bdRow.r1 .rk{color:var(--gold,#ffd84a)}#bDaily .bdRow.r2 .rk{color:#dfe6f0}#bDaily .bdRow.r3 .rk{color:#e09a5a}
#bDaily .bdRow img{width:20px;height:20px;image-rendering:pixelated}
#bDaily .bdRow .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#bDaily .bdRow .nm small{color:var(--faint,#6f6883);margin-left:4px}
#bDaily .bdRow .z{text-align:right;color:var(--gold,#ffd84a)}#bDaily .bdRow .tm{text-align:right;font-variant-numeric:tabular-nums}
#bDaily .bdRow .ht{text-align:right;color:var(--fame,#ffa033);font-size:12px}
#bDaily .bdGap{text-align:center;color:var(--faint,#6f6883);line-height:1}
#bDaily .bdName{display:grid;gap:6px;padding:10px;background:var(--panel2,#262331);box-shadow:inset 0 0 0 2px var(--line,#474258)}
#bDaily .bdName label{font:8px/1.4 var(--font-display,monospace);color:var(--dim,#a9a2b9)}
#bDaily .bdName .in{display:flex;gap:6px}
#bDaily .bdName input{flex:1;min-width:0;padding:8px;font:16px/1.2 var(--font-body,sans-serif);color:var(--text,#f1ece0);background:var(--ink,#0a0910);border:0;box-shadow:inset 0 0 0 2px var(--line-hi,#6d6784);-webkit-user-select:text;user-select:text}
#bDaily .bdName input:focus{outline:2px solid var(--gold,#ffd84a)}
#bDaily .bdName small{color:var(--faint,#6f6883);font-size:12px}
#bDaily .bdPost{display:grid;gap:8px;padding:10px;text-align:center;background:linear-gradient(#3a2414,#262331);box-shadow:inset 0 0 0 2px var(--fame,#ffa033)}
#bDaily .bdPost b{font:10px/1.4 var(--font-display,monospace);color:var(--fame,#ffa033)}
#bDaily .bdPost .acts{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
#bDaily .bdMe b{color:var(--text,#f1ece0)}#bDaily .bdMe .btn{padding:4px 8px;font-size:11px;margin-left:6px}
#bDaily .bdMsg{min-height:18px;margin:0;text-align:center;color:#ffe0a0;font-size:14px}
@media (max-width:420px){#bDaily{padding:0}#bDaily .bdBox{width:100%;height:100vh;height:100dvh;max-height:100vh;max-height:100dvh;border:0}#bDaily .bdRow{grid-template-columns:28px 18px minmax(0,1fr) 34px 46px 26px;gap:4px;font-size:13px}}
`;
  let el = null, st = null, lastFocus = null;
  const mmss = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
  const clsImg = c => {
    const d = G.CLASS_BY_ID && G.CLASS_BY_ID[c], id = (d && d.spr) || (c ? 'h_' + c : '');
    try { const u = id && G.SPR && G.SPR.get && G.SPR.get(id) ? G.SPR.url(id, 2) : ''; return u ? `<img src="${u}" alt="${esc(c)}">` : '<i></i>'; } catch (e) { return '<i></i>'; }
  };
  const btnName = b => { const d = (G.BUTTON_BY_ID && G.BUTTON_BY_ID[b]) || (G.BUTTONS_BY_ID && G.BUTTONS_BY_ID[b]); return d && d.name ? (G.L ? G.L(d.name) : d.name) : b ? b[0].toUpperCase() + b.slice(1) : ''; };
  const rowHtml = (r, me) => `<div class="bdRow${me ? ' me' : ''}${r.rank <= 3 ? ' r' + r.rank : ''}"><span class="rk">${r.rank ? '#' + r.rank : '—'}</span>${clsImg(r.cls)}<span class="nm">${esc(r.name)}${me ? ` <small>${esc(t('dyYou'))}</small>` : ''}${r.btn ? `<small>${esc(btnName(r.btn))}</small>` : ''}</span><span class="z">${r.zones}</span><span class="tm">${mmss(r.secs)}</span><span class="ht">${r.heat ? esc(t('dyHeat', r.heat)) : ''}</span></div>`;
  function render() {
    if (!el) return;
    const b = st.board, today = st.day === Daily.today();
    let list = '';
    if (!Daily.ready()) list = `<p class="bdNote">${esc(t('dyOffline'))}</p>`;
    else if (st.err) list = `<p class="bdNote">${esc(t('dyErr'))}</p>`;
    else if (!b) list = `<p class="bdNote">${esc(t('dyLoading'))}</p>`;
    else if (!b.top.length) list = `<p class="bdNote">${esc(t('dyEmpty'))}</p>`;
    else {
      const you = b.you, inTop = you && b.top.some(r => r.rank === you.rank && r.name === you.name);
      list = `<div class="bdList"><div class="bdRow hd"><span></span><span></span><span>${esc(t('dyPlayers', b.n || b.top.length))}</span><span class="z">${esc(t('dyZones'))}</span><span class="tm">${esc(t('dyTime'))}</span><span></span></div>` +
        b.top.map(r => rowHtml(r, inTop && r.rank === you.rank && r.name === you.name)).join('') +
        (you && !inTop ? `<div class="bdGap">⋮</div>${rowHtml(you, true)}` : '') + '</div>';
    }
    const youLine = b && !b.you && today && Daily.ready() && !Daily.posted() && !st.post ? `<p class="bdNote">${esc(t('dyNotYet'))}</p>` : '';
    const postBox = st.post ? `<div class="bdPost"><b>${esc(t('dyRun', Math.floor(+st.post.zones), mmss(+st.post.secs)))}${st.post.heat ? ' · ' + esc(t('dyHeat', st.post.heat)) : ''}</b>
      <div class="acts"><button class="btn gold" data-post ${Daily.name() ? '' : 'disabled'}>${esc(t('dyPost'))}</button><button class="btn" data-skip>${esc(t('dySkip'))}</button></div></div>` : '';
    const box = el.querySelector('.bdBody'), y = box ? box.scrollTop : 0, focusName = document.activeElement && document.activeElement.id === 'bdNameIn';
    el.innerHTML = `<div class="bdBox" role="dialog" aria-modal="true" aria-label="${esc(t('dyTitle'))}">
      <div class="bdHead"><h2>${esc(t('dyTitle'))}<small>${esc(st.day)}</small></h2><button class="btn bdX" data-close aria-label="${esc(t('dyClose'))}">✕</button></div>
      <div class="bdTabs" role="tablist"><button role="tab" data-day="${Daily.today()}" class="${today ? 'on' : ''}" aria-selected="${today}">${esc(t('dyToday'))}</button><button role="tab" data-day="${Daily.yesterday()}" class="${!today ? 'on' : ''}" aria-selected="${!today}">${esc(t('dyYesterday'))}</button></div>
      <div class="bdBody">
        ${postBox}
        ${!Daily.ready() ? '' : st.editName || !Daily.name() || st.post ? `<div class="bdName"><label for="bdNameIn">${esc(t('dyName'))}</label><div class="in"><input id="bdNameIn" maxlength="16" autocomplete="nickname" spellcheck="false" value="${esc(st.nameDraft != null ? st.nameDraft : Daily.name())}"><button class="btn" data-name>${esc(t('dySave'))}</button></div><small>${esc(t('dyNameHint'))}</small></div>`
          : `<p class="bdNote bdMe">${esc(t('dyName'))}: <b>${esc(Daily.name())}</b> <button class="btn" data-edit>${esc(t('dyChange'))}</button></p>`}
        <p class="bdMsg" aria-live="polite">${esc(st.msg || '')}</p>
        ${youLine}${list}
      </div></div>`;
    const nb = el.querySelector('.bdBody'); if (nb && y) nb.scrollTop = y;
    if (focusName) { const i = el.querySelector('#bdNameIn'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
  }
  function show(day) {
    st.day = day; st.board = null; st.err = false; render();
    if (!Daily.ready()) return;
    Daily.load(day).then(b => { if (el && st.day === day) { st.board = b; render(); } }, () => { if (el && st.day === day) { st.err = true; render(); } });
  }
  function saveName() {
    const i = el && el.querySelector('#bdNameIn');
    if (!i) return '';
    const n = Daily.setName(i.value);
    st.nameDraft = null; st.msg = n ? t('dySaved') : '';
    return n;
  }
  function onClick(e) {
    if (e.target === el) return Daily.close();
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.hasAttribute('data-close')) return Daily.close();
    if (b.dataset.day) { show(b.dataset.day); return; }
    if (b.hasAttribute('data-name')) { if (saveName()) st.editName = false; render(); return; }
    if (b.hasAttribute('data-edit')) { st.editName = true; render(); const i = el.querySelector('#bdNameIn'); if (i) i.focus(); return; }
    // 'Post later': the result stays kept (bttn_dpend) and comes back whenever the board opens, while the day lasts
    if (b.hasAttribute('data-skip')) { const d = st.done; st.post = null; st.done = null; st.msg = t('dyLater'); if (d) d({ error: 'later' }); render(); return; }
    if (b.hasAttribute('data-post')) {
      // (what is typed in the box is the name posted, saved or not)
      const inp = el.querySelector('#bdNameIn');
      if (inp && Daily.sanitize(inp.value)) saveName();
      if (!Daily.name()) return;
      b.disabled = true;
      const r = st.post, d = st.done;
      post(r).then(res => {
        if (!el) { if (d) d(res); return; }
        st.post = null; st.done = null;
        st.msg = posted(res);
        if (d) d(res);
        show(Daily.today());
      });
    }
  }
  // what the board says after a post: the rank, why it can never count, or that it is kept for later
  const why = e => (t('dyWhy_' + e) !== 'dyWhy_' + e ? t('dyWhy_' + e) : e);
  const posted = res => (res.ok ? t('dyPosted', res.rank) : final(res) ? t('dyPostErr', why(res.error)) : t('dyKept', why(res.error)));
  // the board opens with the day's ranked result still waiting: posted at once when there is a name, else asked for
  function offer() {
    const p = Daily.pending();
    if (!p || st.post || !Daily.ready()) return;
    if (!Daily.name()) { st.post = p; render(); return; }
    st.msg = t('dyLoading');
    post(p).then(res => { if (!el) return; st.msg = posted(res); show(st.day); });
  }
  function onInput(e) {
    if (e.target.id !== 'bdNameIn') return;
    const v = Daily.sanitize(e.target.value);
    // (keep a trailing space while typing; the saved name is trimmed)
    const raw = e.target.value.replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 16);
    if (raw !== e.target.value) e.target.value = raw;
    st.nameDraft = raw;
    const pb = el.querySelector('[data-post]'); if (pb) pb.disabled = !v;
  }
  function onKey(e) {
    if (!el) return;
    // while the board is up the game hears no keys (typing a name must not press the Button or fire hotkeys)
    e.stopPropagation();
    if (e.type !== 'keydown') return;
    if (e.key === 'Escape') { Daily.close(); return; }
    if (e.target && e.target.id === 'bdNameIn' && e.key === 'Enter') { if (saveName() && !st.post) st.editName = false; render(); }
  }
  // while it is up the field holds still, like under the game's own windows (G.uiBusy: game.js holds the tick)
  function wrapBusy() { if (G.uiBusy && !G.uiBusy._daily) { const prev = G.uiBusy; const f = () => !!el || prev(); f._daily = 1; G.uiBusy = f; } }
  wrapBusy();
  window.addEventListener('load', wrapBusy);
  function open(day, o) {
    o = o || {};
    if (!document.getElementById('bDailyCss')) { const s = document.createElement('style'); s.id = 'bDailyCss'; s.textContent = CSS; document.head.appendChild(s); }
    if (el) Daily.close();
    lastFocus = document.activeElement;
    st = { day: DAY_RE.test(day || '') ? day : Daily.today(), board: null, err: false, msg: '', post: o.post || null, done: o.done || null, nameDraft: null, editName: false };
    el = document.createElement('div'); el.id = 'bDaily';
    el.addEventListener('click', onClick);
    el.addEventListener('input', onInput);
    document.body.appendChild(el);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('keyup', onKey, true);
    wrapBusy();
    show(st.day);
    offer();
    setTimeout(() => { if (!el) return; const f = el.querySelector(st.post && !Daily.name() ? '#bdNameIn' : '[data-close]'); if (f) f.focus(); }, 30);
    return true;
  }
  Daily.open = day => open(day);
  // a ready-made entry for the setup screen and the run summary (the run UI places it): a button that opens the board,
  // hidden where there is no board (file://, claude.ai, Steam)
  Daily.button = function (label) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn'; b.textContent = label || t('dyTitle'); b.hidden = !Daily.ready();
    b.addEventListener('click', () => Daily.open());
    return b;
  };
  Daily.close = function () {
    if (!el) return;
    const d = st && st.done;
    el.remove(); el = null;
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('keyup', onKey, true);
    if (d) d({ error: 'later' });
    if (lastFocus && lastFocus.focus && lastFocus.isConnected) { try { lastFocus.focus(); } catch (e) {} }
  };
  Daily.isOpen = () => !!el;
})(globalThis.G = globalThis.G || {});
