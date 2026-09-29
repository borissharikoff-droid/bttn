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
  let backend = null, lastSaveStr = '', lastLadderKey = '', busy = false, ticks = 0;
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
      async pushLadder(snap) { await ladderRef.set(snap); },
      subscribe(cb) {
        return db.collection('ladder').orderBy('depth', 'desc').limit(300).onSnapshot(
          qs => cb(qs.docs.map(d => Object.assign({ uid: d.id }, d.data()))),
          e => { Net.error = e.code; G.emit('net'); });
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
        if (!db || !uid) { Net.status = 'off'; G.emit('net'); return; }
        const can = user.can ? await user.can('data.write') : null;
        Net.readOnly = can === false;
        backend = artifactBackend(db, user, uid);
        Net.uid = uid;
      } else { Net.status = 'off'; G.emit('net'); return; }
      Net.mode = backend.name;
      Net.status = 'online';
      backend.subscribe(list => { Net.entries = prepare(list); resolveNames(); G.emit('ladder'); });
      // Cloud save: offer it when it is newer than what this browser has
      const cloud = await backend.loadSave().catch(() => null);
      if (cloud && cloud.data) {
        Net.cloud = cloud;
        // Hold all uploads until the player decides, so a fresh device never overwrites a real save
        let cs = null;
        try { cs = JSON.parse(cloud.data); } catch (e) { cs = null; }
        const more = cs && (cs.goldTotal || 0) > (G.S.goldTotal || 0) * 1.01 + 100;
        const newer = (cloud.ts || 0) > (G.S.lastSave || 0) + 60e3;
        if (cs && (more || newer) && cloud.data !== G.serialize()) { Net.hold = true; G.emit('cloudNewer', cloud); }
      }
      G.emit('net');
      Net.tick(true);
    } catch (e) {
      Net.status = 'error'; Net.error = e.code || e.message || String(e); G.emit('net');
    }
  };

  function prepare(list) {
    return list.filter(e => e && typeof e === 'object').map(e => {
      const problems = G.verifySnapshot(e);
      return Object.assign({}, e, { ok: problems.length === 0, problems, me: e.uid === Net.uid || e.id === Net.uid });
    });
  }
  const nameCache = {};
  async function resolveNames() {
    if (!backend) return;
    const need = Net.entries.filter(e => !e.name && !(e.uid in nameCache)).map(e => e.uid);
    if (!need.length) return;
    const got = await backend.names(need).catch(() => ({}));
    Object.assign(nameCache, got);
    G.emit('ladder');
  }
  Net.displayName = e => e.name || nameCache[e.uid] || '';

  function ladderKey(s) { return JSON.stringify([s.name, s.cls, s.lvl, s.depth, s.power, s.asc, s.gear]); }

  // Called every few seconds by the main loop; `force` pushes right away.
  // Save and ladder uploads are independent, so one failing never blocks the other.
  let pending = false;
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
        if (key !== lastLadderKey) { await backend.pushLadder(snap); lastLadderKey = key; }
        Net.lastLadderAt = now;
      } catch (e) { note(e); }
    }
    if (force || now - Net.lastSaveAt > SAVE_EVERY) {
      try {
        const str = G.serialize();
        if (str !== lastSaveStr) { await backend.pushSave({ data: str, ts: G.S.lastSave, v: 1 }); lastSaveStr = str; }
        Net.lastSaveAt = now;
      } catch (e) { note(e); }
    }
    Net.error = err;
    busy = false;
    G.emit('net');
    if (pending) { pending = false; Net.tick(true); }
  };
  Net.pushNow = () => Net.tick(true);
  Net.loadCloud = function () {
    if (!Net.cloud || !Net.cloud.data) return false;
    return G.importSave(Net.cloud.data);
  };

  // Rank helpers for the UI
  Net.sorted = function (by) {
    const list = Net.entries.filter(e => e.ok || e.me);
    const key = by === 'power' ? e => e.power || 0 : e => (e.depth || 0) * 1e15 + (e.power || 0);
    return list.slice().sort((a, b) => key(b) - key(a));
  };
})(globalThis.G = globalThis.G || {});
