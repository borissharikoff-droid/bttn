// BTTN — boot, main loop, saving, offline progress and live-reload snapshots.
(function (G) {
  'use strict';
  const KEY = 'bttn-save-v1';
  const get = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const put = v => { try { localStorage.setItem(KEY, v); return true; } catch (e) { return false; } };

  G.save = function () { const s = G.serialize(); put(s); return s; };
  G.exportSave = () => btoa(unescape(encodeURIComponent(G.serialize())));
  G.importSave = function (code) {
    try {
      let json = code.trim();
      if (json[0] !== '{') json = decodeURIComponent(escape(atob(json)));
      G.deserialize(json);
      G.fillQuests(); G.save(); G.emit('ascend', 0);
      return true;
    } catch (e) { return false; }
  };
  G.hardReset = function () {
    G.S = G.newState();
    G.R.boss = null; G.R.bossReady = false; G.R.combo = 0; G.R.wisp = null;
    G.recalc(); G.fillQuests(); G.save();
    G.emit('ascend', 0);
  };

  let last = 0, uiT = 0, saveT = 15;
  function frame(now) {
    let dt = (now - last) / 1000; last = now;
    if (dt > 60) {
      const r = G.applyOffline(dt);
      G.UI.offline(r);
      dt = 0;
    } else if (dt > 1) {
      // Tab was in the background briefly: catch up at full speed in small steps.
      let left = dt;
      while (left > 0) { const s = Math.min(0.5, left); G.tick(s); left -= s; }
      dt = 0;
    }
    dt = Math.min(dt, 0.1);
    G.tick(dt);
    G.Stage.frame(dt);
    uiT -= dt;
    if (uiT <= 0) { uiT = 0.12; G.UI.update(); }
    saveT -= dt;
    if (saveT <= 0) { saveT = 15; G.save(); if (G.Net) G.Net.tick(); }
    requestAnimationFrame(frame);
  }

  function boot(data) {
    let loaded = false;
    const raw = (data && data.save) || get();
    if (raw) { try { G.deserialize(raw); loaded = true; } catch (e) { G.S = G.newState(); } }
    delete G.S.set.lang; // older saves carried a language choice
    G.recalc();
    G.fillQuests();
    let offline = null;
    if (loaded && !(data && data.save)) offline = G.applyOffline((Date.now() - G.S.lastSave) / 1000);
    G.Stage.init(document.getElementById('stage'));
    G.UI.init();
    if (offline) G.UI.offline(offline);
    if (G.Net) G.Net.start();
    window.addEventListener('resize', () => { G.Stage.resize(); if (document.querySelector('.starmap')) G.UI.render(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { G.save(); if (G.Net) G.Net.tick(true); } });
    window.addEventListener('pagehide', () => G.save());
    const hot = window.claude && window.claude.hot;
    if (hot && hot.snapshot) { try { hot.snapshot(() => ({ save: G.serialize() })); } catch (e) { /* optional */ } }
    last = performance.now();
    requestAnimationFrame(frame);
  }

  const hot = window.claude && window.claude.hot;
  const start = () => {
    if (hot && hot.ready) hot.ready(boot);
    else boot((hot && hot.data) || {});
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(globalThis.G = globalThis.G || {});
