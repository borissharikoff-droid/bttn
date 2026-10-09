// BTTN for Steam — the game-side bridge. `node tools/build.js --target steam` inlines it into dist/steam.html BEFORE
// the game's scripts, with window.BTTN_STEAM_ACH = {ach id: Steam API name} from steam/achievements.json.
// It needs window.BTTN_STEAM from steam/preload.js; in a plain browser (dist/steam.html opened by hand) only the
// platform flag is set and the rest stays idle.
//  1. The platform: window.BTTN_PLATFORM = 'steam' (js/store.js: Gems are earn-only, no store, no ads).
//  2. The save: the game keeps it in localStorage 'bttn-save-v1' (js/main.js). Here it is mirrored to
//     userData/save.json (what Steam Auto-Cloud syncs): the newer of file and localStorage wins at start; every
//     write is copied to the file (batched, and synchronously while the window closes).
//  3. Carry-over from the web build: the web Settings → Save → Export code (js/main.js G.exportSave: base64 of the
//     save's JSON) goes into "Bring your web save" on the first start (or Settings → Load from file), which calls
//     G.importSave(code) and reloads. Settings also gets "Save to file / Load from file" for the same code.
//  4. Achievements: every unlocked one (G.on('achievement'), and the ones already in the save at start) is
//     activated on Steam under its API name (Steam ignores repeats).
(function () {
  'use strict';
  window.BTTN_PLATFORM = 'steam';
  const ST = window.BTTN_STEAM, KEY = 'bttn-save-v1';
  if (!ST) return;
  const stamp = s => { try { return +JSON.parse(s).lastSave || 0; } catch (e) { return -1; } };

  // ---------- 2. the save file ----------
  let local = null;
  try { local = localStorage.getItem(KEY); } catch (e) { local = null; }
  const file = typeof ST.initial === 'string' && ST.initial[0] === '{' ? ST.initial : null;
  // the cloud copy from another PC is newer: it goes in before the game reads the save
  if (file && (!local || stamp(file) > stamp(local))) { try { localStorage.setItem(KEY, file); local = file; } catch (e) {} }
  const fresh = !file && !local;
  let pend = null, tm = 0, closing = false;
  const flush = () => { tm = 0; if (pend == null) return; const v = pend; pend = null; try { ST.save(v); } catch (e) {} };
  const setItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    setItem.call(this, k, v);
    if (k !== KEY || this !== window.localStorage) return;
    if (closing) { pend = null; try { ST.saveSync(String(v)); } catch (e) {} return; }
    pend = String(v);
    if (!tm) tm = setTimeout(flush, 1500);
  };
  // (this runs before the game's own pagehide save, so from here on every save goes straight to the file)
  const bye = () => { closing = true; if (pend != null) { const v = pend; pend = null; try { ST.saveSync(v); } catch (e) {} } };
  window.addEventListener('beforeunload', bye);
  window.addEventListener('pagehide', bye);

  // ---------- after the game has booted ----------
  const MAP = window.BTTN_STEAM_ACH || {};
  const api = id => MAP[id] || ('ACH_' + String(id).toUpperCase().replace(/[^A-Z0-9_]/g, '_')).slice(0, 64);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function later() {
    const G = window.G;
    if (!G || !G.S) return;
    const t = (k, ...a) => (G.t ? G.t(k, ...a) : k);
    if (G.tAdd) G.tAdd({
      stmBring: 'Bring your web save', stmBringHint: 'Played BTTN in the browser? There: Settings → Save → Export, then Copy. Paste the code here.',
      stmImport: 'Import', stmFile: 'From a file…', stmFresh: 'Start fresh', stmBad: 'That code did not load. Copy the whole code and try again.',
      stmToFile: 'Save to file…', stmFromFile: 'Load from file…', stmSavedFile: 'Saved to file.',
    });
    // ---------- 4. achievements ----------
    const done = {};
    const unlock = id => { if (!id || done[id]) return; done[id] = 1; try { ST.ach(api(id)); } catch (e) {} };
    if (G.on) {
      G.on('achievement', a => unlock(a && a.id));
      // (4.0 deeds that map to a Steam achievement too)
      G.on('deed', d => { const id = d && (d.id || d); if (id && MAP[id]) unlock(id); });
    }
    setTimeout(() => { const A = (G.S && G.S.ach) || {}; Object.keys(A).forEach(id => { if (A[id]) unlock(id); }); }, 3000);

    // ---------- 3. carry-over ----------
    const load = code => {
      code = String(code || '').trim();
      if (!code || !G.importSave || !G.importSave(code)) return false;
      try { G.save && G.save(); } catch (e) {}
      setTimeout(() => location.reload(), 60);
      return true;
    };
    const css = `#stmBring{position:fixed;inset:0;z-index:70;display:grid;place-items:center;padding:16px;background:rgba(6,5,10,.82);font:15px/1.35 var(--font-body,sans-serif);color:var(--text,#f1ece0)}
#stmBring .box{width:min(520px,100%);display:grid;gap:10px;padding:18px;background:var(--panel,#1d1b26);border:3px solid var(--ink,#0a0910);box-shadow:inset 0 0 0 2px var(--line-hi,#6d6784),0 6px 0 var(--ink,#0a0910)}
#stmBring h2{margin:0;font:14px/1.5 var(--font-display,monospace);color:var(--gold,#ffd84a);text-align:center}
#stmBring p{margin:0;color:var(--dim,#a9a2b9);text-align:center}#stmBring p.bad{color:var(--bad,#ff5a5a)}
#stmBring textarea{min-height:90px;resize:vertical;padding:8px;font:12px/1.3 ui-monospace,monospace;color:var(--text,#f1ece0);background:var(--ink,#0a0910);border:0;box-shadow:inset 0 0 0 2px var(--line-hi,#6d6784);-webkit-user-select:text;user-select:text}
#stmBring .acts{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}`;
    function bringBox() {
      if (document.getElementById('stmBring')) return;
      const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
      const el = document.createElement('div'); el.id = 'stmBring';
      el.innerHTML = `<div class="box" role="dialog" aria-modal="true" aria-label="${esc(t('stmBring'))}"><h2>${esc(t('stmBring'))}</h2><p>${esc(t('stmBringHint'))}</p>
        <textarea spellcheck="false" aria-label="${esc(t('stmBring'))}"></textarea><p class="bad" hidden>${esc(t('stmBad'))}</p>
        <div class="acts"><button class="btn gold" data-imp>${esc(t('stmImport'))}</button><button class="btn" data-file>${esc(t('stmFile'))}</button><button class="btn" data-fresh>${esc(t('stmFresh'))}</button></div></div>`;
      document.body.appendChild(el);
      const ta = el.querySelector('textarea'), bad = el.querySelector('.bad');
      const fail = () => { bad.hidden = false; };
      el.addEventListener('keydown', e => e.stopPropagation(), true);
      el.addEventListener('click', e => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.hasAttribute('data-fresh')) { el.remove(); return; }
        if (b.hasAttribute('data-imp')) { if (!load(ta.value)) fail(); return; }
        if (b.hasAttribute('data-file')) ST.importFile().then(code => { if (code == null) return; ta.value = code; if (!load(code)) fail(); });
      });
      setTimeout(() => ta.focus(), 50);
    }
    // a first start on Steam (no save in the file nor here) offers the web save; a save made since says no more
    if (fresh) setTimeout(() => { if (!(G.S.st && G.S.st.playTime > 60)) bringBox(); }, 1200);
    // Settings → Save: the same code to and from a file
    const addFileButtons = () => {
      const box = document.getElementById('saveBox'), acts = box && box.parentElement && box.parentElement.querySelector('.acts');
      if (!acts || acts.querySelector('[data-stm]')) return;
      acts.insertAdjacentHTML('beforeend', `<button class="btn" data-stm="to">${esc(t('stmToFile'))}</button><button class="btn" data-stm="from">${esc(t('stmFromFile'))}</button>`);
      acts.addEventListener('click', e => {
        const b = e.target.closest('[data-stm]');
        if (!b) return;
        e.stopPropagation();
        if (b.dataset.stm === 'to') ST.exportFile(G.exportSave()).then(ok => { if (ok && G.UI && G.UI.toast) G.UI.toast(esc(t('stmSavedFile')), '', 'ic_scroll', { p: 2 }); });
        else ST.importFile().then(code => { if (code == null) return; if (!load(code) && G.UI && G.UI.toast) G.UI.toast(esc(t('stmBad')), '', 'ic_skull', { p: 2 }); });
      }, true);
    };
    new MutationObserver(addFileButtons).observe(document.body, { childList: true, subtree: true });
    addFileButtons();
  }
  if (document.readyState === 'complete') setTimeout(later, 0); else window.addEventListener('load', () => setTimeout(later, 0));
})();
