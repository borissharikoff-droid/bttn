// BTTN — online layer: cloud save and the shared ladder.
// Two interchangeable backends:
//   • artifact — the claude.ai page database (db + user capabilities),
//     live when the game is opened as a published artifact;
//   • http     — our own server (server/worker.js), when an API address is
//     configured (window.BTTN_API or localStorage "bttn-api").
// Without either the game runs offline exactly as before.
(function (G) {
  'use strict';
  const Net = G.Net = {
    mode: 'off', uid: null, entries: [], status: 'off', error: '',
    lastSaveAt: 0, lastLadderAt: 0, cloud: null, readOnly: false,
  };
  let backend = null, lastSaveStr = '', lastLadderKey = '', busy = false, ticks = 0, lastPushTs = 0;
  // which browser wrote a cloud save, so an old tab left open elsewhere can't overwrite a newer one
  const DEV = (() => { try { let d = localStorage.getItem('bttn-dev'); if (!d) { d = Math.random().toString(36).slice(2, 10); localStorage.setItem('bttn-dev', d); } return d; } catch (e) { return 'x' + Math.random().toString(36).slice(2, 8); } })();
  const SAVE_EVERY = 60e3, LADDER_EVERY = 30e3;

  // ---------- artifact backend ----------
  function artifactBackend(db, user, uid) {
    const saveRef = db.doc('data/users/' + uid + '/save');
    const ladderRef = db.doc('ladder/' + uid);
    return {
      name: 'artifact',
      async loadSave() {
        const s = await saveRef.get();
        return s.exists ? s.data() : null;
      },
      async pushSave(body) { await saveRef.set(body); },
      // the cloud save a player chose not to load is kept one step back, so a mis-tap can be undone
      async backupSave(body) { await db.doc('data/users/' + uid + '/save_prev').set(body); },
      async loadBackup() { const s = await db.doc('data/users/' + uid + '/save_prev').get(); return s.exists ? s.data() : null; },
      async pushLadder(snap) { await ladderRef.set(snap); },
      // only the owner may do this (the ladder's access rules)
      async removeRow(id) { await db.doc('ladder/' + id).delete(); },
      subscribe(cb) {
        return db.collection('ladder').orderBy('depth', 'desc').limit(300).onSnapshot(
          qs => cb(qs.docs.map(d => Object.assign({ uid: d.id }, d.data()))),
          e => { Net.error = e.code; if (Net.status === 'connecting') Net.status = 'error'; G.emit('net'); });
      },
      async names(ids) {
        if (!user || !user.profiles) return {};
        const ps = await user.profiles(ids);
        const out = {};
        for (const id of ids) out[id] = (ps[id] && ps[id].name) || '';
        return out;
      },
    };
  }

  // ---------- http backend ----------
  function httpBackend(base) {
    const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
    const put = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } };
    let token = get('bttn-token');
    const call = async (method, path, body) => {
      const r = await fetch(base + path, {
        method, headers: Object.assign({ 'content-type': 'application/json' }, token ? { authorization: 'Bearer ' + token } : {}),
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw Object.assign(new Error(j.error || r.status), { code: j.error || 'http_' + r.status });
      return j;
    };
    let timer = null;
    return {
      name: 'http',
      async auth() {
        if (!token) { const j = await call('POST', '/api/auth'); token = j.token; put('bttn-token', token); }
        const me = await call('GET', '/api/me');
        return me.id;
      },
      async loadSave() { const j = await call('GET', '/api/save'); return j.save || null; },
      async pushSave(body) { await call('PUT', '/api/save', body); },
      async pushLadder(snap) { await call('PUT', '/api/ladder', snap); },
      subscribe(cb) {
        const pull = () => call('GET', '/api/ladder?limit=300').then(j => cb(j.entries || []), e => { Net.error = e.code; G.emit('net'); });
        pull(); timer = setInterval(pull, 45e3);
        return () => clearInterval(timer);
      },
      async names() { return {}; },
    };
  }

  // ---------- lifecycle ----------
  Net.start = async function () {
    try {
      let apiBase = window.BTTN_API || null;
      try { apiBase = apiBase || localStorage.getItem('bttn-api'); } catch (e) { /* ignore */ }
      if (apiBase) {
        backend = httpBackend(apiBase.replace(/\/$/, ''));
        Net.status = 'connecting'; G.emit('net');
        Net.uid = await backend.auth();
      } else if (window.claude && typeof window.claude.use === 'function') {
        Net.status = 'connecting'; G.emit('net');
        const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
        const uid = user && user.id ? await user.id() : null;
        try { const me = user && user.me ? await user.me() : null; Net.myName = (me && me.name) || ''; } catch (e) { Net.myName = ''; }
        // no db: signed out, or not let in. Say so instead of pretending to be offline
        if (!db) { Net.status = 'signin'; G.emit('net'); return; }
        try { Net.isOwner = user && user.isOwner ? !!(await user.isOwner()) : false; } catch (e) { Net.isOwner = false; }
        const can = user && user.can ? await user.can('data.write') : null;
        Net.readOnly = can === false || !uid; // without an id you can still watch the ladder
        backend = artifactBackend(db, user, uid || 'none');
        Net.uid = uid;
      } else { Net.status = 'off'; G.emit('net'); return; }
      Net.mode = backend.name;
      // online once the ladder has actually answered
      if (backend.name === 'http') Net.status = 'online';
      backend.subscribe(list => { if (Net.status !== 'online') { Net.status = 'online'; Net.error = ''; setTimeout(() => Net.tick(true), 0); } Net.entries = prepare(list); resolveNames(); rivals(); G.emit('ladder'); });
      if (!Net.uid) { G.emit('net'); return; }
      // Cloud save: offer it when it is newer than what this browser has
      const cloud = await backend.loadSave().catch(() => null);
      if (cloud && cloud.data) {
        Net.cloud = cloud;
        // Hold all uploads until the player decides, so a fresh device never overwrites a real save
        let cs = null;
        try { cs = JSON.parse(cloud.data); } catch (e) { cs = null; }
        // (4.0 fix1: a cloud save from an earlier season is NOT dropped any more - deserialize converts it (the founders'
        // gift, game.js), so it is offered like any other; the 2.3/3.1 wipes threw such saves away, 4.0 keeps the meta)
        const newer = (cloud.ts || 0) > (G.S.lastSave || 0) + 60e3;
        if (cs && (cloudMore(cs) || newer) && cloud.data !== G.serialize()) { Net.hold = true; G.emit('cloudNewer', cloud); }
      }
      G.emit('net');
      Net.tick(true);
    } catch (e) {
      Net.status = 'error'; Net.error = e.code || e.message || String(e); G.emit('net');
    }
  };

  // is the cloud save worth asking about, against what this browser holds? More gold earned (the 3.x rule), or - season-
  // aware - an earlier season's save while this browser never received the founders' gift (a new device, cleared
  // storage: the gift is in that save), or any save at all while this browser's state is fresh (nothing played, no gift):
  // a fresh newState never goes up over a cloud save nobody has looked at
  function cloudMore(cs) {
    if (!cs || typeof cs !== 'object') return false;
    const S = G.S, fresh = !((S.st && S.st.playTime) > 30) && !S.founders && !(S.goldTotal > 0);
    if (fresh) return true;
    if (G.oldSeason(cs)) return !S.founders;
    return (cs.goldTotal || 0) > (S.goldTotal || 0) * 1.01 + 100;
  }
  Net.cloudMore = cloudMore;
  function prepare(list) {
    // (rows from an earlier season don't show: everyone starts the new one from nothing)
    return list.filter(e => e && typeof e === 'object' && (e.ss || 1) >= (G.WIPE || 1)).map(e => {
      // rows from before 2.0: their crowns past depth 65 belonged to lands that come later now
      if ((e.v | 0) < 2 && e.cr && typeof e.cr === 'object') { const cr = {}; for (const k in e.cr) if (+k < 65) cr[k] = e.cr[k]; e = Object.assign({}, e, { cr }); }
      const problems = G.verifySnapshot(e);
      let power = e.power;
      try { if (!problems.length) power = G.ladderPower(e); } catch (err) { /* keep the claimed number */ }
      return Object.assign({}, e, { power, ok: problems.length === 0, problems, me: e.uid === Net.uid || e.id === Net.uid });
    });
  }
  const nameCache = {};
  async function resolveNames() {
    if (!backend) return;
    const need = Net.entries.filter(e => !(e.uid in nameCache)).map(e => e.uid);
    if (!need.length) return;
    const got = await backend.names(need).catch(() => ({}));
    Object.assign(nameCache, got);
    G.emit('ladder');
  }
  Net.displayName = e => e.name || nameCache[e.uid] || '';
  // the account behind a row, shown next to the hero name so nobody can pass as someone else
  Net.accountName = e => nameCache[e.uid] || '';

  function ladderKey(s) { return JSON.stringify([s.name, s.cls, s.lvl, s.depth, s.power, s.asc, s.gear, s.rift, s.rt, s.rd, s.uq, s.ev, s.fs, s.cr, s.ls, s.heat, s.hw, s.mad]); }

  // Rivalry: who went past whom since the last ladder update
  const CATS = { depth: 'Depth', rift: 'Rift', power: 'Gear score' };
  let seenUids = null;
  let above = null;
  function rivals() {
    const now = {};
    for (const cat in CATS) {
      const list = Net.sorted(cat).filter(e => cat !== 'rift' || (e.rift || 0) > 0), i = list.findIndex(e => e.me);
      if (i < 0) continue;
      now[cat] = { set: new Set(list.slice(0, i).map(e => e.uid)), list, i };
    }
    if (above) {
      let shown = 0;
      for (const cat in CATS) {
        const was = above[cat], cur = now[cat];
        if (!was || !cur || shown >= 2) continue;
        for (const e of cur.list.slice(cur.i + 1)) if (was.has(e.uid) && shown < 2) { shown++; G.emit('rival', { up: true, name: Net.displayName(e) || G.t('anon'), cat: CATS[cat], rank: cur.i + 1 }); }
        for (const e of cur.list.slice(0, cur.i)) if (!was.has(e.uid) && seenUids && seenUids.has(e.uid) && shown < 2) { shown++; G.emit('rival', { up: false, name: Net.displayName(e) || G.t('anon'), cat: CATS[cat] }); }
      }
    }
    above = {};
    for (const cat in now) above[cat] = now[cat].set;
    seenUids = new Set(Net.entries.map(e => e.uid));
  }

  // Called every few seconds by the main loop; `force` pushes right away.
  // Save and ladder uploads are independent, so one failing never blocks the other.
  let pending = false, lastLadderPush = 0;
  Net.tick = async function (force) {
    if (!backend || Net.status !== 'online' || Net.readOnly || Net.hold) return;
    if (busy) { if (force) pending = true; return; }
    const now = Date.now();
    busy = true;
    let err = '';
    const note = e => {
      if (e.code === 'too_soon') return; // server throttle: retried on a later tick
      err = e.code || e.message || String(e);
      if (e.code === 'invalid_argument' && Net.mode === 'artifact') Net.readOnly = true; // this viewer cannot write here
    };
    if (G.S.hero && G.S.hero.cls && (force || now - Net.lastLadderAt > LADDER_EVERY)) {
      try {
        const snap = G.ladderSnapshot();
        const key = ladderKey(snap);
        // never lower your own row from a device that is behind (another one got further)
        const mine = Net.entries.find(e => e.me);
        const behind = mine && mine.ok && ((mine.depth || 0) > snap.depth || (mine.rift || 0) > snap.rift);
        if (behind) Net.behind = true;
        // re-send every 6 hours even when nothing changed, so friends see you're still around
        else { Net.behind = false; if (key !== lastLadderKey || now - lastLadderPush > 6 * 3600e3) { await backend.pushLadder(snap); lastLadderKey = key; lastLadderPush = now; } Net.lastLadderAt = now; }
      } catch (e) { note(e); }
    }
    if (force || now - Net.lastSaveAt > SAVE_EVERY) {
      try {
        const str = G.serialize();
        if (str !== lastSaveStr) {
          // another device saved something further along since our last push: ask before overwriting it
          const cloud = await backend.loadSave().catch(() => null);
          let cs = null;
          if (cloud && cloud.dev && cloud.dev !== DEV && (cloud.ts || 0) > lastPushTs) { try { cs = JSON.parse(cloud.data); } catch (e) { cs = null; } }
          // (4.0 fix1: an earlier season's save counts too: see cloudMore)
          if (cs && cloudMore(cs)) {
            Net.cloud = cloud; Net.hold = true; busy = false; G.emit('cloudNewer', cloud); G.emit('net'); return;
          }
          await backend.pushSave({ data: str, ts: G.S.lastSave, v: 1, dev: DEV }); lastSaveStr = str; lastPushTs = G.S.lastSave;
        }
        Net.lastSaveAt = now;
      } catch (e) { note(e); }
    }
    Net.error = err;
    busy = false;
    G.emit('net');
    if (pending) { pending = false; Net.tick(true); }
  };
  Net.pushNow = () => Net.tick(true);
  // "keep this one": the player chose this browser's save over the cloud's, so stop asking about that cloud save
  Net.keepLocal = async function (c) {
    lastPushTs = Math.max(lastPushTs, (c && c.ts) || 0, Date.now());
    if (c && c.data && backend && backend.backupSave) { try { await backend.backupSave(c); } catch (e) { /* a failed backup must not block the choice */ } }
    Net.hold = false; Net.tick(true);
  };
  Net.restoreBackup = async function () {
    const b = backend && backend.loadBackup ? await backend.loadBackup().catch(() => null) : null;
    return b && b.data ? G.importSave(b.data) : false;
  };
  Net.removeRow = async function (id) { if (!backend || !backend.removeRow) return false; await backend.removeRow(id); return true; };
  // What a save holds, for the choice between two of them
  Net.saveSummary = function (str) {
    try { const s = typeof str === 'string' ? JSON.parse(str) : str; const h = s.hero || {}; return { cls: h.cls, lvl: h.lvl || 1, depth: (s.bestDepth || 0) + 1, gold: s.goldTotal || 0, asc: s.ascensions || 0 }; } catch (e) { return null; }
  };
  Net.loadCloud = function () {
    if (!Net.cloud || !Net.cloud.data) return false;
    return G.importSave(Net.cloud.data);
  };

  // Rank helpers for the UI
  Net.sorted = function (by) {
    let list = Net.entries.filter(e => e.ok || e.me);
    const today = G.utcDayKey();
    if (by === 'today') list = list.filter(e => e.rd && e.rd.k === today && e.rd.l > 0);
    if (by === 'mad') list = list.filter(e => (e.mad || 0) > 0);
    // nobody ranks on a board they haven't started: zeros stay off it (your own row too)
    if (by === 'rift') list = list.filter(e => (e.rift || 0) > 0);
    if (by === 'uq') list = list.filter(e => (e.uq || 0) > 0);
    if (by === 'stars') list = list.filter(e => (e.ls || 0) > 0);
    const pw = (a, b) => (b.power || 0) - (a.power || 0);
    const cmp = by === 'power' ? pw
      : by === 'rift' ? (a, b) => (b.rift || 0) - (a.rift || 0) || (a.rt || 1e9) - (b.rt || 1e9) || pw(a, b)
      : by === 'today' ? (a, b) => (b.rd.l || 0) - (a.rd.l || 0) || (a.rd.t || 1e9) - (b.rd.t || 1e9) || pw(a, b)
      : by === 'uq' ? (a, b) => (b.uq || 0) - (a.uq || 0) || pw(a, b)
      : by === 'stars' ? (a, b) => (b.ls || 0) - (a.ls || 0) || (b.depth || 0) - (a.depth || 0)
      : by === 'mad' ? (a, b) => a.mad - b.mad
      : (a, b) => (b.depth || 0) - (a.depth || 0) || pw(a, b);
    return list.slice().sort(cmp);
  };
})(globalThis.G = globalThis.G || {});
