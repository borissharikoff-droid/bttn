// BTTN 4.0 — streamer mode: Twitch chat (read-only, anonymous) votes on cards, doors and relics and calls in goblins,
// champions and a frenzy; the run's seed code shows on the HUD (run_ui reads G.Stream.on()).
//
// How it works (ADDENDUM 6):
// - Chat is read over Twitch's IRC WebSocket (wss://irc-ws.chat.twitch.tv:443) as an anonymous justinfanNNNNN: no login,
//   no token, nothing is ever posted. CAP twitch.tv/tags gives display names; PING/PONG keeps it alive; a dropped
//   socket comes back with a growing backoff (1 s .. 60 s); Twitch's RECONNECT is obeyed at once.
// - Votes: when a choice is on screen (cards, doors, a relic; each switchable) a 15-s window opens: !1 !2 !3 !4, one vote
//   per chatter per window (the first counts). The logic's own clock for that choice waits (G.cardTouch / doorsTouch /
//   relicTouch), the tally is drawn by run_ui (G.RunUI.voteTally). The streamer can still click: a choice taken by hand
//   closes the window. When it ends untouched, the top choice is taken (a tie: one of the tied at random); with no
//   votes nothing is taken and the choice's own clock is given back. A full relic belt is the streamer's (it needs to
//   know which relic to drop): no vote then.
// - Calls: !goblin (the Hoarder, world.js's loot goblin, as its own clock spawns it; 90 s global cooldown), !champ (the
//   land's champion through G.forceChamp: once a land, never when it already came), !hype (the ADRENALINE frenzy event
//   through G.startEvent('frenzy'); 3 min cooldown). A call waits (up to 45 s) for the field to be live: no boss, march,
//   run screen, cinematic or other event in the way; if it never is, its cooldown is given back. Calls are off in a
//   ranked Daily (the board must stay fair); votes are just choices and stay on.
// - The feed: top-right on the field, 4 lines, "name: !goblin" only (never message text), names sanitized (an ASCII
//   display name or the login, 14 chars), drawn as text nodes; lines fade after 12 s. DOM is touched only when a line
//   comes or goes (no per-frame work); the vote/call clock is one 250-ms interval of plain reads.
// - Settings: ui.js's Settings page emits 'uiSettings'(body); this module fills its #setStream slot (the switch, the
//   channel, the status, the per-command switches, the run code with Copy). Saved in S.set.stream.
// API: G.Stream = { on(), status(), cfg(), set(patch), connect(), disconnect(), chat(text, user, tags) (a local line, as
// if from chat: tests and tools), vote() (the open window or null), feed(name, cmd, kind), tune {win, gob, hype, wait} }.
// Events: 'streamStatus'(state), 'streamVote'(kind, index, counts), 'streamCall'(cmd, name, ok, why).
(function (G) {
  'use strict';
  if (typeof document === 'undefined' || !G.on) return;
  const St = G.Stream = G.Stream || {};
  const R = G.R;
  const t = function () { return G.t ? G.t.apply(null, arguments) : arguments[0]; };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const $ = (s, r) => (r || document).querySelector(s);
  const safe = (f, d) => { try { return f(); } catch (e) { if (typeof console !== 'undefined') console.error(e); return d; } };
  // the windows and cooldowns, in real seconds (tests shorten them)
  const TUNE_ST = St.tune = Object.assign({ win: 15, gob: 90, hype: 180, wait: 45, feedLife: 12, feedMax: 4, rejectGap: 8 }, St.tune || {});
  const IRC_URL = 'wss://irc-ws.chat.twitch.tv:443';

  if (G.tAdd) G.tAdd({
    st_mode: 'Streamer mode', st_modeHint: 'Twitch chat votes and calls things in. Read-only: no login, nothing is posted.',
    st_channel: 'Twitch channel', st_chPh: 'your_channel', st_connect: 'Connect', st_reconnect: 'Reconnect',
    st_s_off: 'Off', st_s_noch: 'Type your channel name', st_s_conn: 'Connecting to #{0}…', st_s_live: 'Reading #{0} chat',
    st_s_wait: 'Offline · retrying in {0} s', st_s_err: 'Twitch: {0}', st_s_bad: 'Not a channel name (letters, digits, _)',
    st_votes: 'Chat votes', st_votesHint: '!1 !2 !3 !4 · 15 s · one vote each · you can still click',
    st_v_card: 'Cards', st_v_door: 'Doors', st_v_relic: 'Relics',
    st_calls: 'Chat calls', st_callsHint: '!goblin 90 s cooldown · !champ once a land · !hype 3 min cooldown · off in a ranked Daily',
    st_feed: 'Chat feed on the field', st_feedHint: 'Top right, 4 lines: who called what',
    st_code: 'Run code', st_codeHint: 'Chat can replay this Siege: Enter a code at the setup', st_copy: 'Copy', st_copied: 'Copied',
    st_cd: '{0} s', st_champDone: 'came this land', st_daily: 'off in the Daily', st_busy: 'busy', st_picks: 'chat picks {0}',
    st_votesSeen: '{0} chatters seen',
  });

  // ---------- settings (S.set.stream) ----------
  const DEF = { on: 0, ch: '', vc: 1, vd: 1, vr: 1, gob: 1, champ: 1, hype: 1, feed: 1 };
  function cfg() {
    const S = G.S;
    if (!S || !S.set) return Object.assign({}, DEF);
    let c = S.set.stream;
    if (!c || typeof c !== 'object') c = S.set.stream = Object.assign({}, DEF);
    for (const k in DEF) if (!(k in c)) c[k] = DEF[k];
    return c;
  }
  // a Twitch login: 3-25 of a-z 0-9 _ (a pasted URL or '#name' is cut down to the name)
  function chanOf(s) {
    s = String(s || '').trim().toLowerCase();
    const m = s.match(/twitch\.tv\/([a-z0-9_]+)/);
    if (m) s = m[1];
    s = s.replace(/^[#@]/, '');
    return /^[a-z0-9_]{3,25}$/.test(s) ? s : '';
  }
  St.on = () => !!cfg().on;
  St.cfg = () => Object.assign({}, cfg());
  St.set = function (patch) {
    const c = cfg();
    for (const k in patch || {}) if (k in DEF) c[k] = k === 'ch' ? String(patch[k] || '').slice(0, 40) : patch[k] ? 1 : 0;
    if (G.dirty) safe(() => G.dirty());
    sync(true);
    return St.cfg();
  };

  // ---------- the IRC client ----------
  const irc = { ws: null, ch: '', state: 'off', err: '', retryAt: 0, tries: 0, timer: null, last: 0, joined: false, nick: '', seen: new Set() };
  St._irc = irc;
  function setState(s, err) {
    if (irc.state === s && irc.err === (err || '')) return;
    irc.state = s; irc.err = err || '';
    G.emit('streamStatus', s);
    drawStatus();
  }
  St.status = () => ({ state: irc.state, ch: irc.ch, err: irc.err, retry: irc.retryAt ? Math.max(0, Math.ceil((irc.retryAt - now()) / 1000)) : 0, chatters: irc.seen.size, joined: irc.joined });
  function connect(ch) {
    disconnect(true);
    ch = chanOf(ch);
    if (!ch) { setState('bad'); return false; }
    irc.ch = ch; irc.joined = false; irc.retryAt = 0;
    const url = (typeof window !== 'undefined' && window.BTTN_STREAM_WS) || IRC_URL;
    let ws;
    try { ws = new WebSocket(url); } catch (e) { setState('wait'); retry(); return false; }
    irc.ws = ws; irc.last = now();
    setState('conn');
    irc.nick = 'justinfan' + (10000 + Math.floor(Math.random() * 89999));
    ws.onopen = () => {
      if (irc.ws !== ws) return;
      // (tags: display names; commands: RECONNECT and NOTICE ids. No PASS: an anonymous justinfan needs none)
      send('CAP REQ :twitch.tv/tags twitch.tv/commands');
      send('NICK ' + irc.nick);
      send('JOIN #' + ch);
    };
    ws.onmessage = e => { if (irc.ws !== ws) return; irc.last = now(); String(e.data || '').split('\r\n').forEach(l => { if (l) safe(() => line(l)); }); };
    ws.onerror = () => {};
    ws.onclose = () => { if (irc.ws !== ws) return; irc.ws = null; irc.joined = false; if (cfg().on && irc.ch) { setState('wait'); retry(); } };
    return true;
  }
  function send(s) { try { if (irc.ws && irc.ws.readyState === 1) irc.ws.send(s + '\r\n'); } catch (e) { /* the close handler retries */ } }
  // backoff 1, 2, 4 ... 60 s (+ a little jitter, so many viewers' games don't knock at once)
  function retry(fast) {
    clearTimeout(irc.timer);
    const d = fast ? 300 : Math.min(60000, 1000 * Math.pow(2, irc.tries)) + Math.random() * 400;
    irc.tries = Math.min(irc.tries + 1, 8);
    irc.retryAt = now() + d;
    irc.timer = setTimeout(() => { irc.timer = null; irc.retryAt = 0; const c = cfg(); if (c.on && chanOf(c.ch)) connect(c.ch); }, d);
  }
  function disconnect(keep) {
    clearTimeout(irc.timer); irc.timer = null; irc.retryAt = 0;
    const ws = irc.ws; irc.ws = null; irc.joined = false;
    if (ws) { try { ws.onclose = null; ws.close(); } catch (e) { /* gone already */ } }
    if (!keep) { irc.ch = ''; irc.tries = 0; setState('off'); endVote(false); }
  }
  St.connect = () => { const c = cfg(); return c.on ? connect(c.ch) : false; };
  St.disconnect = () => disconnect();

  // one IRC line: [@tags] [:prefix] COMMAND params [:trailing]
  function parse(l) {
    const m = { tags: {}, prefix: '', cmd: '', params: [], text: '' };
    let i = 0;
    if (l[0] === '@') {
      const sp = l.indexOf(' ');
      l.slice(1, sp).split(';').forEach(kv => { const q = kv.indexOf('='); const k = q < 0 ? kv : kv.slice(0, q); m.tags[k] = q < 0 ? '' : kv.slice(q + 1).replace(/\\(.)/g, (_, c) => (c === 's' ? ' ' : c === ':' ? ';' : c === 'n' ? ' ' : c === 'r' ? '' : c)); });
      i = sp + 1;
    }
    if (l[i] === ':') { const sp = l.indexOf(' ', i); m.prefix = l.slice(i + 1, sp); i = sp + 1; }
    const tr = l.indexOf(' :', i);
    const head = (tr < 0 ? l.slice(i) : l.slice(i, tr)).trim().split(' ');
    m.cmd = (head.shift() || '').toUpperCase(); m.params = head;
    if (tr >= 0) m.text = l.slice(tr + 2);
    return m;
  }
  St._parse = parse;
  function line(l) {
    const m = parse(l);
    switch (m.cmd) {
      case 'PING': send('PONG :' + (m.text || m.params[0] || 'tmi.twitch.tv')); break;
      case 'RECONNECT': { const ws = irc.ws; irc.ws = null; if (ws) { try { ws.onclose = null; ws.close(); } catch (e) { /* */ } } setState('wait'); retry(true); break; }
      case 'JOIN': if ((m.prefix.split('!')[0] || '') === irc.nick) joined(); break;
      case '366': case 'ROOMSTATE': joined(); break;
      case 'NOTICE': {
        const id = m.tags['msg-id'] || '';
        if (/login|auth/i.test(m.text) || /suspended|banned|unavailable|nonexist/i.test(id)) { setState('err', (m.text || id).slice(0, 60)); }
        break;
      }
      case 'PRIVMSG': {
        const login = (m.prefix.split('!')[0] || '').toLowerCase();
        if (login) chat(m.text, login, m.tags);
        break;
      }
    }
  }
  function joined() { if (irc.joined) return; irc.joined = true; irc.tries = 0; setState('live'); }
  // a dead socket that never closed (a sleeping laptop, a proxy): no line for 6 min -> PING; 7 min -> start over
  setInterval(() => {
    if (!irc.ws || irc.ws.readyState !== 1) return;
    const idle = now() - irc.last;
    if (idle > 420000) { const ws = irc.ws; irc.ws = null; try { ws.onclose = null; ws.close(); } catch (e) { /* */ } setState('wait'); retry(); }
    else if (idle > 360000) send('PING :tmi.twitch.tv');
  }, 30000);

  // ---------- names: an ASCII display name, else the login; 14 characters at most; only ever set as text ----------
  function nameOf(login, tags) {
    const dn = tags && tags['display-name'];
    let n = dn && /^[A-Za-z0-9_]{1,25}$/.test(dn) ? dn : String(login || '').replace(/[^a-z0-9_]/gi, '');
    if (!n) n = '?';
    return n.length > 14 ? n.slice(0, 13) + '…' : n;
  }
  St._nameOf = nameOf;

  // ---------- chat lines ----------
  function chat(text, login, tags) {
    tags = tags || {};
    const c = cfg();
    if (!c.on) return false;
    login = String(login || '').toLowerCase();
    const who = tags['user-id'] || login;
    if (!who) return false;
    const s = String(text || '').trim().toLowerCase();
    if (s[0] !== '!') return false;
    if (irc.seen.size < 5000) irc.seen.add(who);
    const v = s.match(/^!([1-9])(?:\s|$)/);
    if (v) return castVote(who, +v[1] - 1);
    const k = s.match(/^!(goblin|champ|champion|hype)(?:\s|$)/);
    if (k) return call(k[1] === 'champion' ? 'champ' : k[1], nameOf(login, tags));
    return false;
  }
  St.chat = (text, user, tags) => safe(() => chat(text, user || 'tester', tags || {}), false);

  // ---------- votes ----------
  let V = null, lastDone = null;
  const RU = () => G.RunUI;
  const screens = () => safe(() => (RU() && RU().state ? RU().state().screens : []), []);
  // the choice open on screen now (and the switch allows): {kind, obj, n, sig}
  function choiceNow() {
    const S = G.S, r = S && S.run, c = cfg();
    if (!r || !r.on || !RU() || !RU().voteTally) return null;
    const sc = screens(), top = sc[sc.length - 1];
    if (c.vc && top === 'cards') { const o = G.cardOffer && G.cardOffer(); if (o && o.ids && o.ids.length >= 2) return { kind: 'card', obj: o, n: Math.min(9, o.ids.length), sig: o.ids.join(',') }; }
    if (c.vd && top === 'doors') { const d = r.doors; if (d && d.opts && d.opts.length >= 2) return { kind: 'door', obj: d, n: Math.min(9, d.opts.length), sig: d.opts.map(x => x.land).join(',') }; }
    if (c.vr && top === 'relic') { const o = r.relicOffer; if (o && o.ids && o.ids.length >= 2 && !(r.belt && r.beltMax && r.belt.length >= r.beltMax)) return { kind: 'relic', obj: o, n: Math.min(9, o.ids.length), sig: o.ids.join(',') }; }
    return null;
  }
  // (the choice's own clock waits while chat votes; the touch it had before is given back when nobody voted)
  function touch(kind) { if (kind === 'card' && G.cardTouch) G.cardTouch(); else if (kind === 'door' && G.doorsTouch) G.doorsTouch(); else if (kind === 'relic' && G.relicTouch) G.relicTouch(); }
  function openVote(ch) {
    V = { kind: ch.kind, obj: ch.obj, sig: ch.sig, n: ch.n, counts: new Array(ch.n).fill(0), voters: new Set(), t0: now(), end: now() + TUNE_ST.win * 1000, prevTouch: ch.obj.touch | 0, drawn: '' };
    touch(V.kind);
    drawTally(true);
  }
  function castVote(who, i) {
    if (!V || !(i >= 0 && i < V.n) || V.voters.has(who)) return false;
    V.voters.add(who);
    V.counts[i]++;
    V.dirty = 1;
    return true;
  }
  function drawTally(force) {
    if (!V) return;
    const secs = Math.max(0, Math.ceil((V.end - now()) / 1000));
    const key = V.counts.join(',') + '|' + secs;
    if (!force && key === V.drawn) return;
    V.drawn = key; V.dirty = 0;
    safe(() => RU().voteTally(V.kind, V.counts.slice(), secs));
  }
  function endVote(take) {
    if (!V) return;
    const v = V; V = null; lastDone = v.obj;
    safe(() => RU() && RU().voteTally && RU().voteTally(v.kind, null));
    if (!take) return;
    const tot = v.counts.reduce((a, x) => a + x, 0);
    if (!tot) { if (!v.prevTouch && v.obj) v.obj.touch = 0; return; }
    const mx = Math.max.apply(null, v.counts), top = [];
    v.counts.forEach((x, i) => { if (x === mx) top.push(i); });
    const i = top[Math.floor(Math.random() * top.length)];
    const ok = safe(() => (v.kind === 'card' ? G.cardPick(i, 'chat') : v.kind === 'door' ? G.runDoor(i) : G.relicPick(i)), false);
    if (ok) { G.emit('streamVote', v.kind, i, v.counts.slice()); feed('', t('st_picks', '!' + (i + 1)), 'sys'); }
  }
  St.vote = () => (V ? { kind: V.kind, counts: V.counts.slice(), left: Math.max(0, (V.end - now()) / 1000), voters: V.voters.size } : null);

  // ---------- calls ----------
  const cd = { goblin: 0, hype: 0 }, rejT = {};
  const champDone = {};
  let pend = [];
  const landKey = () => Math.floor(Math.max(0, (G.S && G.S.depth) || 0) / (G.REALM_SIZE || 3));
  const runId = () => { const r = G.S && G.S.run; return r ? (r.id || r.seed || 0) + ':' + (r.n | 0) : ''; };
  // the field is live: a Siege's field, no boss / march / town / Rift / cinematic / Last Stand / fall / covering window
  function live() {
    const S = G.S, r = S && S.run;
    if (!S || !S.hero || !S.hero.cls || !r || !r.on || r.phase !== 'field' || S.fallen) return false;
    if (R.boss || R.march || R.town || R.rift || R.cine > 0 || R.lastStand) return false;
    return !(G.uiBusy && G.uiBusy());
  }
  const rankedDaily = () => { const r = G.S && G.S.run; return !!(r && r.on && r.day && r.ranked); };
  const CMD_KEY = { goblin: 'gob', champ: 'champ', hype: 'hype' };
  // this land's champion: came already (champions.js's book S.champRun) unless the land was drawn without one (run.js's
  // r.noChamp: Heat 0 gives 40% of lands one; chat may still call it, once, as the Hunt pact does)
  const slotNow = () => (G.runSlot ? G.runSlot() : landKey());
  const champCame = () => { const S = G.S, r = S.run, sl = slotNow(); return !!(S.champRun && S.champRun[sl] && !(r && r.noChamp && r.noChamp[sl])); };
  function call(cmd, name) {
    const c = cfg(), r = G.S && G.S.run;
    if (!c[CMD_KEY[cmd]] || !(r && r.on)) return false;
    const T = now();
    const reject = why => {
      // (a crowd typing the same call on cooldown makes one dim line every few seconds, not a wall)
      if (T - (rejT[cmd] || -1e9) >= TUNE_ST.rejectGap * 1000) { rejT[cmd] = T; feed(name, '!' + cmd, 'no', why); }
      G.emit('streamCall', cmd, name, false, why);
      return false;
    };
    if (rankedDaily()) return reject(t('st_daily'));
    if (pend.some(p => p.cmd === cmd)) return reject(t('st_busy'));
    if (cmd === 'champ') {
      const k = runId() + ':' + slotNow();
      if (champDone[k] || R.champ || champCame()) return reject(t('st_champDone'));
      champDone[k] = 1;
    } else {
      if (T < cd[cmd]) return reject(t('st_cd', Math.ceil((cd[cmd] - T) / 1000)));
      cd[cmd] = T + TUNE_ST[cmd === 'goblin' ? 'gob' : 'hype'] * 1000;
    }
    pend.push({ cmd, name, t: T, land: runId() + ':' + slotNow() });
    feed(name, '!' + cmd, 'ok');
    G.emit('streamCall', cmd, name, true, '');
    return true;
  }
  // a pending call happens as soon as the field lets it (every 250 ms); one that never could is dropped, cooldown back
  function runCalls() {
    if (!pend.length) return;
    const T = now();
    pend = pend.filter(p => {
      if (T - p.t > TUNE_ST.wait * 1000 || !(G.S && G.S.run && G.S.run.on)) { if (p.cmd !== 'champ') cd[p.cmd] = 0; else delete champDone[p.land]; return false; }
      if (!live()) return true;
      if (p.cmd === 'goblin') return !spawnGoblin(p.name);
      if (p.cmd === 'champ') {
        // (a land left meanwhile: the call was for that land)
        if (p.land !== runId() + ':' + slotNow()) { delete champDone[p.land]; return false; }
        if (R.champ || champCame()) return false;
        const c = safe(() => G.forceChamp && G.forceChamp(), null);
        if (c) c.chat = 1;
        return !c;
      }
      if (p.cmd === 'hype') {
        if (R.ev || R.inv || !G.startEvent) return true;
        return !safe(() => G.startEvent('frenzy'), null);
      }
      return false;
    });
  }
  // the Hoarder as world.js's own clock brings one (spawnHoarder: round the Button, out of reach, then away), so the stage,
  // the sound and the loot rules treat it like any other
  function spawnGoblin() {
    if (!G.makeMob || !G.MOB_KINDS || !G.MOB_KINDS.hoard) return false;
    return safe(() => {
      const m = G.makeMob('hoard', 0.15 + Math.random() * 0.7, 0.55);
      m.move = 'hoard'; m.life = (G.TUNE && G.TUNE.hoardLife) || 16; m.dir = Math.random() < 0.5 ? 1 : -1; m.ph = Math.random() * 6; m.chat = 1;
      G.emit('hoard', m);
      return true;
    }, false);
  }

  // ---------- the feed (top-right on the field) ----------
  let feedEl = null;
  const NAME_COL = ['#ffd84a', '#7fe9ff', '#ff9ab4', '#8ae07a', '#c9a6ff', '#ffa033', '#a8dcff', '#ff7a6a'];
  const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
  function feedRoot() {
    if (feedEl && feedEl.isConnected) return feedEl;
    const wrap = document.getElementById('stageWrap');
    if (!wrap) return null;
    feedEl = document.createElement('div');
    feedEl.id = 'stFeed'; feedEl.setAttribute('aria-live', 'polite'); feedEl.setAttribute('aria-label', 'Chat');
    wrap.appendChild(feedEl);
    return feedEl;
  }
  function feedSize() {
    const el = feedEl, wrap = document.getElementById('stageWrap');
    if (!el || !wrap) return;
    const n = el.childElementCount;
    wrap.classList.toggle('stFeedOn', n > 0);
    wrap.style.setProperty('--stFeedH', n ? el.offsetHeight + 6 + 'px' : '0px');
  }
  function feed(name, cmd, kind, why) {
    if (!cfg().feed) return;
    const el = feedRoot();
    if (!el) return;
    const d = document.createElement('div');
    d.className = 'stL ' + (kind || 'ok');
    if (name) { const b = document.createElement('b'); b.textContent = name; b.style.color = NAME_COL[hash(name) % NAME_COL.length]; d.appendChild(b); d.appendChild(document.createTextNode(': ')); }
    const c = document.createElement('span'); c.className = 'stC'; c.textContent = cmd; d.appendChild(c);
    if (why) { const w = document.createElement('i'); w.textContent = ' · ' + why; d.appendChild(w); }
    el.appendChild(d);
    while (el.childElementCount > TUNE_ST.feedMax) el.firstChild.remove();
    feedSize();
    setTimeout(() => { d.classList.add('out'); setTimeout(() => { d.remove(); feedSize(); }, 400); }, TUNE_ST.feedLife * 1000);
  }
  St.feed = (name, cmd, kind, why) => feed(name ? nameOf(name, {}) : '', String(cmd || ''), kind, why);
  function feedClear() { if (feedEl) { feedEl.textContent = ''; feedSize(); } }

  // ---------- the clock: settings -> connection, the vote window, pending calls (plain reads; DOM only on change) ----------
  function sync(now_) {
    const c = cfg(), ch = chanOf(c.ch);
    if (!c.on) { if (irc.state !== 'off' || irc.ws) disconnect(); return; }
    if (!ch) { if (irc.ws || irc.timer) disconnect(true); setState(c.ch ? 'bad' : 'noch'); return; }
    if (ch !== irc.ch || (now_ && !irc.ws && !irc.timer)) { irc.tries = 0; connect(ch); }
  }
  let lastCfg = '';
  function tick() {
    const c = cfg(), key = c.on + '|' + c.ch;
    if (key !== lastCfg) { lastCfg = key; sync(true); if (!c.on) feedClear(); }
    if (!c.on) { if (V) endVote(false); pend.length = 0; return; }
    if (!c.feed && feedEl && feedEl.childElementCount) feedClear();
    const ch = choiceNow();
    if (V) {
      const same = ch && ch.kind === V.kind && ch.obj === V.obj && ch.sig === V.sig;
      // (taken by hand, rerolled, banished, the screen gone: the window closes with nothing taken)
      if (!same) { endVote(false); }
      else if (now() >= V.end) endVote(true);
      else drawTally(false);
    }
    if (!V && ch && ch.obj !== lastDone && (irc.joined || St._test)) openVote(ch);
    runCalls();
    if (slotEl && slotEl.isConnected) drawStatus();
  }
  setInterval(() => safe(tick), 250);
  // (a new save - import, reset, a cloud load - is read on the next tick: cfg() reads G.S each time)
  G.on('runStart', () => { pend.length = 0; });

  // ---------- the Settings slot ----------
  let slotEl = null, draft = null;
  function statusText() {
    const s = St.status(), c = cfg();
    if (!c.on) return t('st_s_off');
    switch (s.state) {
      case 'noch': return t('st_s_noch');
      case 'bad': return t('st_s_bad');
      case 'conn': return t('st_s_conn', s.ch);
      case 'live': return t('st_s_live', s.ch) + (s.chatters ? ' · ' + t('st_votesSeen', s.chatters) : '');
      case 'wait': return t('st_s_wait', s.retry);
      case 'err': return t('st_s_err', s.err);
      default: return t('st_s_off');
    }
  }
  function drawStatus() {
    if (!slotEl || !slotEl.isConnected) return;
    const el = slotEl.querySelector('.stStatus');
    if (!el) return;
    const s = statusText();
    if (el.textContent !== s) el.textContent = s;
    el.dataset.state = irc.state;
    const code = slotEl.querySelector('.stCode b'), r = G.S && G.S.run;
    if (code) { const v = r && r.on && G.runCode ? G.runCode() : ''; if (code.textContent !== v) code.textContent = v; }
  }
  function fill(body) {
    const slot = body && body.querySelector('#setStream');
    if (!slot) return;
    slotEl = slot;
    const c = cfg(), r = G.S && G.S.run;
    const tg = (on, attr, label, hint) => `<div class="setRow"><span>${esc(label)}${hint ? `<small>${esc(hint)}</small>` : ''}</span><button class="toggle ${on ? 'on' : ''}" ${attr} aria-pressed="${on ? 'true' : 'false'}" aria-label="${esc(label)}"></button></div>`;
    const seg = (items, label, hint) => `<div class="setRow stSeg"><span>${esc(label)}${hint ? `<small>${esc(hint)}</small>` : ''}</span><span class="seg">${items.map(([k, l]) => `<button data-st-k="${k}" class="${c[k] ? 'on' : ''}" aria-pressed="${c[k] ? 'true' : 'false'}">${esc(l)}</button>`).join('')}</span></div>`;
    const code = r && r.on && G.runCode ? G.runCode() : '';
    slot.innerHTML = `<div class="setList stSet">
      ${tg(c.on, 'data-st-on', t('st_mode'), t('st_modeHint'))}
      ${c.on ? `
      <div class="setRow stChRow"><span>${esc(t('st_channel'))}<small class="stStatus" role="status"></small></span>
        <span class="stChIn"><input id="stCh" type="text" inputmode="latin" maxlength="40" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(t('st_chPh'))}" value="${esc(c.ch)}" aria-label="${esc(t('st_channel'))}"><button class="btn" data-st-go>${esc(irc.joined ? t('st_reconnect') : t('st_connect'))}</button></span></div>
      ${seg([['vc', t('st_v_card')], ['vd', t('st_v_door')], ['vr', t('st_v_relic')]], t('st_votes'), t('st_votesHint'))}
      ${seg([['gob', '!goblin'], ['champ', '!champ'], ['hype', '!hype']], t('st_calls'), t('st_callsHint'))}
      ${tg(c.feed, 'data-st-feed', t('st_feed'), t('st_feedHint'))}
      ${code ? `<div class="setRow stCode"><span>${esc(t('st_code'))}<small>${esc(t('st_codeHint'))}</small></span><span class="stCodeV"><b></b><button class="btn" data-st-copy>${esc(t('st_copy'))}</button></span></div>` : ''}` : ''}
    </div>`;
    const inp = slot.querySelector('#stCh');
    if (inp) {
      // (ui.js re-renders the page on many events: a channel being typed keeps its text, focus and caret)
      if (draft && draft.focus) { inp.value = draft.v; try { inp.focus({ preventScroll: true }); inp.setSelectionRange(draft.s, draft.e); } catch (e) { /* */ } }
      const keep = () => { draft = { v: inp.value, s: inp.selectionStart, e: inp.selectionEnd, focus: document.activeElement === inp }; };
      inp.addEventListener('input', keep); inp.addEventListener('keyup', keep); inp.addEventListener('focus', keep);
      inp.addEventListener('blur', () => { setTimeout(() => { if (!inp.isConnected) return; draft = null; }, 0); });
      // (the field's keys must not fire while typing a name)
      inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); go(inp.value); } });
    }
    slot.addEventListener('click', e => {
      if (e.target.closest('[data-st-on]')) { St.set({ on: !c.on }); safe(() => G.Audio && G.Audio.unlock && G.Audio.unlock()); refill(); return; }
      if (e.target.closest('[data-st-go]')) { go(inp ? inp.value : c.ch); return; }
      const k = e.target.closest('[data-st-k]');
      if (k) { const key = k.dataset.stK; St.set({ [key]: !cfg()[key] }); refill(); return; }
      if (e.target.closest('[data-st-feed]')) { St.set({ feed: !c.feed }); refill(); return; }
      const cp = e.target.closest('[data-st-copy]');
      if (cp) {
        const v = G.runCode ? G.runCode() : '';
        const ok = () => { cp.textContent = t('st_copied'); setTimeout(() => { if (cp.isConnected) cp.textContent = t('st_copy'); }, 1500); };
        try { navigator.clipboard.writeText(v).then(ok, ok); } catch (err) { ok(); }
      }
    });
    drawStatus();
  }
  function go(v) { draft = null; const ch = chanOf(v); St.set({ ch: ch || v }); if (ch) { irc.tries = 0; connect(ch); } else setState('bad'); refill(); }
  function refill() { if (slotEl && slotEl.isConnected) { const body = slotEl.parentNode; if (body) fill(body); } }
  G.on('uiSettings', body => safe(() => fill(body)));

  // ---------- CSS (from css/style.css's variables; the pixel look: hard edges, ink outlines, the display font) ----------
  const css = `
#stFeed{position:absolute;top:54px;right:12px;z-index:6;display:flex;flex-direction:column;align-items:flex-end;gap:3px;max-width:min(46%,300px);pointer-events:none}
#stFeed:empty{display:none}
#stFeed .stL{max-width:100%;padding:3px 7px 3px 6px;background:rgba(12,11,18,.78);border:2px solid var(--ink);box-shadow:inset 0 0 0 1px var(--line);border-left:3px solid #9146ff;
  font:13px/1.2 var(--font-body);color:var(--text);text-shadow:1px 1px 0 var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;animation:stIn .22s steps(4) both}
#stFeed .stL b{font-weight:normal}
#stFeed .stL .stC{font:8px/1 var(--font-display);color:var(--gold);vertical-align:1px}
#stFeed .stL i{font-style:normal;color:var(--dim);font-size:11px}
#stFeed .stL.no{opacity:.62;border-left-color:var(--faint)}
#stFeed .stL.no .stC{color:var(--dim)}
#stFeed .stL.sys{border-left-color:var(--gold)}
#stFeed .stL.sys .stC{color:#c9a6ff}
#stFeed .stL.out{opacity:0;transform:translateX(12px);transition:opacity .35s,transform .35s}
@keyframes stIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:none}}
#stageWrap.stFeedOn #toasts{transform:translateY(var(--stFeedH,0px))}
.fighting #stFeed{top:124px}
@media (max-width:860px){#stFeed{top:50px;right:8px;max-width:min(58%,250px)}.fighting #stFeed{top:104px}#stFeed .stL{font-size:12px;padding:2px 5px}#stFeed .stL .stC{font-size:7px}}
@media (prefers-reduced-motion:reduce){#stFeed .stL{animation:none}#stFeed .stL.out{transition:none}}
.stSet .stChIn{display:flex;gap:6px;align-items:center;flex:none}
.stSet #stCh{width:150px;min-width:0;background:var(--ink);color:var(--text);border:2px solid var(--line);padding:5px 7px;font:13px/1.2 ui-monospace,monospace;-webkit-user-select:text;user-select:text}
.stSet #stCh:focus{outline:none;border-color:#9146ff}
.stSet .stStatus{color:var(--dim)}
.stSet .stStatus[data-state=live]{color:var(--good)}
.stSet .stStatus[data-state=wait],.stSet .stStatus[data-state=err],.stSet .stStatus[data-state=bad]{color:var(--bad)}
.stSet .stStatus[data-state=conn]{color:var(--gold)}
.stSet .stCodeV{display:flex;gap:6px;align-items:center;min-width:0}
.stSet .stCodeV b{font:8px/1.3 var(--font-display);color:var(--gold);word-break:break-all;-webkit-user-select:text;user-select:text}
.stSet .stSeg .seg button[data-st-k]{font-family:var(--font-body)}
@media (max-width:520px){.stSet .stChRow,.stSet .stSeg,.stSet .stCode{flex-wrap:wrap}.stSet .stChIn,.stSet .stCodeV{width:100%}.stSet #stCh{flex:1 1 auto;width:auto}.stSet .stSeg .seg{width:100%;justify-content:flex-start}}
`;
  const st = document.createElement('style');
  st.id = 'stCss'; st.textContent = css;
  (document.head || document.documentElement).appendChild(st);
  // tests: G.Stream._test = 1 opens vote windows without a live channel (G.Stream.chat feeds the votes)
})(globalThis.G = globalThis.G || {});
