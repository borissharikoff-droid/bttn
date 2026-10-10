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
    if (G.R.town) { G.R.town = false; G.emit('town', false); }
    G.S = G.newState();
    G.R.boss = null; G.R.bossReady = false; G.R.combo = 0; G.R.wisp = null;
    if (G.worldClear) G.worldClear();
    if (G.R.mobs) G.R.mobs.length = 0; if (G.R.shots) G.R.shots.length = 0;
    G.recalc(); G.fillQuests(); G.save();
    G.emit('ascend', 0);
  };

  let last = 0, uiT = 0, saveT = 15;
  // A render or UI error must never stop the game: the next frame is always booked first
  let frameErr = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    try { step(now); } catch (e) { if (frameErr++ < 3) console.error(e); }
  }
  // 3.6: the one frame loop. The game ticks every frame; the field (and the fx layers hung on it with
  // G.Stage.onFrame) is drawn every frame too, except under a window: a modal (the game waits) gets the
  // field at about 8 frames a second, a window that covers the whole field (the town's on a phone) none.
  let coverDt = 0, coverK = '', coverFull = false, coverMost = false, coverT = 0;
  const townWin = () => document.getElementById('townWin');
  function covered(dt) {
    const tw = townWin(), open = !!(tw && !tw.hidden), modal = !!(G.uiBusy && G.uiBusy());
    const k = (open ? 'w' : '') + (modal ? 'm' : '');
    // how much of the field the town window hides: measured when it opens (and once a second while open)
    if (k !== coverK || (open && (coverT -= dt) <= 0)) {
      coverK = k; coverT = 1; coverFull = false; coverMost = false;
      if (open) {
        const st = document.getElementById('stageWrap'), a = tw.getBoundingClientRect(), b = st && st.getBoundingClientRect();
        if (b && b.width > 0) {
          const ix = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)), iy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
          coverFull = ix * iy >= b.width * b.height * 0.92;
          coverMost = ix * iy >= b.width * b.height * 0.6;
        }
      }
    }
    // 2: nothing shows (no drawing), 1: a modal or a window over most of it (a low rate), 0: in full
    return coverFull ? 2 : modal || coverMost ? 1 : 0;
  }
  function step(now) {
    let dt = (now - last) / 1000; last = now;
    const dms = dt * 1000;
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
    const t0 = performance.now();
    // layout is read first, before the tick and the UI write to the page (no forced layouts mid-frame)
    if (G.Stage.readLayout) G.Stage.readLayout();
    G.tick(dt);
    const cov = covered(dt);
    let drew = true;
    if (cov) {
      // under a window: the field at a low rate (a full cover: not at all), with the time it missed
      coverDt += dt;
      if (cov === 1 && coverDt >= 0.034) { const d = Math.min(coverDt, 0.25); coverDt = 0; G.Stage.frame(d); if (G.Stage.runFrameFns) G.Stage.runFrameFns(d, now); }
      else drew = false;
    } else {
      if (coverDt > 0) { coverDt = 0; }
      G.Stage.frame(dt);
      if (G.Stage.runFrameFns) G.Stage.runFrameFns(dt, now);
    }
    uiT -= dt;
    if (uiT <= 0) { uiT = 0.12 + (G.Quality ? G.Quality.tier * 0.03 : 0); G.UI.update(); }
    saveT -= dt;
    if (saveT <= 0) { saveT = 15; G.save(); if (G.Net) G.Net.tick(); }
    // the quality governor learns from frames that drew the field in full
    if (G.Quality && G.Quality.sample) G.Quality.sample(dms, performance.now() - t0, !drew || cov > 0 || !!(G.Stage.marching && G.Stage.marching()) || dt <= 0);
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
    // loot still on the ground goes into the bag before the tab goes away
    const gather = () => { if (G.pickupAll) G.pickupAll(); };
    document.addEventListener('visibilitychange', () => { if (document.hidden) { gather(); G.save(); if (G.Net) G.Net.tick(true); } });
    window.addEventListener('pagehide', () => { gather(); G.save(); });
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
