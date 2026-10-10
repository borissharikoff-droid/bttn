// BTTN 4.0 — quality of life: a cursor you choose (and size with a slider), and one button that enchants every item.
// Pure DOM over the existing APIs (G.enchantAll, G.D.enchantAll, G.UI.toast). Choices are per-viewer (localStorage),
// nothing here touches the save or the rules.
(function (G) {
  'use strict';
  if (typeof document === 'undefined') return;
  const KEY = 'bttn_cursor';
  // Pixel cursors: one char per pixel, '.' = transparent. Each is drawn at the chosen size with nearest-neighbour scaling.
  const CURSORS = [
    { id: 'arrow', name: 'Arrow', hot: [0, 0], px: [
      'X...........', 'XX..........', 'XWX.........', 'XWWX........', 'XWWWX.......', 'XWWWWX......',
      'XWWWWWX.....', 'XWWWWWWX....', 'XWWWWWWWX...', 'XWWWWWXXXX..', 'XWWXWWX.....', 'XWX.XWWX....',
      'XX..XWWX....', 'X....XWWX...', '.....XWWX...', '......XX....'] },
    { id: 'hand', name: 'Hand', hot: [4, 0], px: [
      '....XX......', '...XWWX.....', '...XWWX.....', '...XWWXX....', '...XWWXWXX..', '.XXXWWXWXWX.',
      'XWWXWWWWWWX.', 'XWWXWWWWWWWX.', '.XWWWWWWWWWX', '..XWWWWWWWWX', '...XWWWWWWX', '...XWWWWWX.',
      '....XWWWWX..', '....XWWWWX..', '.....XXXXX..'] },
    { id: 'sword', name: 'Sword', hot: [0, 0], px: [
      'X...........', 'XX..........', 'XWX.........', 'XWWX........', 'XWWWX.......', 'XWWWWX......',
      'XWWWWWX.....', 'XWWWWWWX....', 'XWWWWWWWX...', 'X.XWWWWWWX..', '..XXXWWWX...', '.XXX.XWWX...',
      'XYX..XWX....', 'XYYX...X.....', 'XXX.........', '............'] },
    { id: 'cross', name: 'Crosshair', hot: [5, 5], px: [
      '.....X......', '.....X......', '.....X......', '.....X......', '.....X......', 'XXXXXWXXXXX.',
      '.....X......', '.....X......', '.....X......', '.....X......', '.....X......', '.....X......'] },
    { id: 'skull', name: 'Skull', hot: [5, 5], px: [
      '...XXXXXX...', '..XWWWWWWX..', '.XWWWWWWWWX.', '.XWWXXWWXWX.', '.XWWXXWWXWX.', '.XWWWWWWWWX.',
      '..XWWXWWX...', '..XWWWWWX...', '...XWXWX....', '...XXXXX....'] },
    { id: 'gold', name: 'Golden hand', hot: [4, 0], px: [
      '....XX......', '...XYYX.....', '...XYYX.....', '...XYYXX....', '...XYYXYXX..', '.XXXYYXYXYX.',
      'XYYXYYYYYYX.', 'XYYXYYYYYYYX.', '.XYYYYYYYYYX', '..XYYYYYYYYX', '...XYYYYYYX', '...XYYYYYX.',
      '....XYYYYX..', '....XYYYYX..', '.....XXXXX..'] },
  ];
  const PAL = { X: '#0c0b12', W: '#f4f1ea', Y: '#ffd84a' };

  const cfg = (() => { try { return Object.assign({ id: 'system', size: 32 }, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return { id: 'system', size: 32 }; } })();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {} };

  // draws a cursor at a size (the cursor image is capped at 128 px by browsers)
  function cursorUrl(c, size) {
    const h = c.px.length, w = c.px[0].length, s = Math.max(1, Math.floor(size / Math.max(w, h)));
    const cv = document.createElement('canvas'); cv.width = w * s; cv.height = h * s;
    const x = cv.getContext('2d');
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const ch = c.px[j][i]; if (PAL[ch]) { x.fillStyle = PAL[ch]; x.fillRect(i * s, j * s, s, s); } }
    return { url: cv.toDataURL('image/png'), hx: Math.round(c.hot[0] * s), hy: Math.round(c.hot[1] * s) };
  }
  let styleEl = null;
  function apply() {
    if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = 'qolCursor'; document.head.appendChild(styleEl); }
    const c = CURSORS.find(x => x.id === cfg.id);
    if (!c) { styleEl.textContent = ''; return; }
    const size = Math.min(128, Math.max(16, cfg.size | 0));
    const r = cursorUrl(c, size);
    const v = `url(${r.url}) ${r.hx} ${r.hy}, auto`;
    // the pointer over the field and buttons; a 'pointer' hand variant for tappable things
    styleEl.textContent = `html, body, canvas, button, [role=button], a { cursor: ${v}; }`;
  }

  // ---- the button and the cursor panel ----
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function css() {
    const s = document.createElement('style');
    s.textContent = `#qolBar{position:fixed;right:8px;bottom:8px;z-index:60;display:flex;gap:6px}
#qolBar button{font:9px/1 var(--font-display,monospace);padding:7px 8px;background:#2a2238;color:#ffe9a8;border:2px solid #0c0b12;box-shadow:inset 0 0 0 1px #ffd84a55,0 3px 0 #0c0b12;cursor:pointer}
#qolBar button:hover{background:#3a2f4d}#qolBar button[disabled]{opacity:.5}
#qolPanel{position:fixed;inset:0;z-index:70;background:#0c0b12cc;display:flex;align-items:center;justify-content:center;padding:16px}
#qolPanel .box{background:#1c1a2c;border:3px solid #0c0b12;box-shadow:inset 0 0 0 2px #ffd84a55;padding:14px;max-width:420px;width:100%;color:#f4f1ea;font:13px/1.4 system-ui,sans-serif}
#qolPanel h2{font:11px/1.2 var(--font-display,monospace);color:#ffd84a;margin:0 0 10px}
#qolPanel .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}
#qolPanel .opt{background:#2a2238;border:2px solid #0c0b12;padding:8px 4px;text-align:center;cursor:pointer;color:#f4f1ea;font-size:11px}
#qolPanel .opt.on{box-shadow:inset 0 0 0 2px #ffd84a}
#qolPanel .opt img{display:block;margin:0 auto 4px;image-rendering:pixelated;width:32px;height:32px}
#qolPanel .row{display:flex;align-items:center;gap:10px;margin:8px 0}
#qolPanel input[type=range]{flex:1}
#qolPanel .x{margin-top:10px;width:100%;padding:8px;background:#2a2238;color:#ffe9a8;border:2px solid #0c0b12;cursor:pointer}
@media (max-width:420px){#qolPanel .grid{grid-template-columns:repeat(3,1fr)}}`;
    return s;
  }
  let bar = null, panel = null;
  function enchantAll() {
    const ok = !!(G.D && G.D.enchantAll);
    if (!ok) { G.UI && G.UI.toast && G.UI.toast('Сначала откройте Кузницу I (Forge I)', '', 'ic_gear', { p: 2 }); return; }
    const r = G.enchantAll({ mode: 'power', shards: 1, gold: 1, whet: true, bag: true });
    const msg = r && r.steps ? `Зачаровано: +${r.steps} ур.` : 'Нечего зачаровывать: не хватает углей, золота или осколков';
    G.UI && G.UI.toast && G.UI.toast(msg, r && r.steps ? 'ach' : '', 'ic_gear', { p: 2 });
    if (G.Audio && G.Audio.buy && r && r.steps) G.Audio.buy();
  }
  function openPanel() {
    if (panel) return;
    panel = el('div'); panel.id = 'qolPanel';
    const box = el('div', 'box');
    box.appendChild(el('h2', '', 'КУРСОР'));
    const grid = el('div', 'grid');
    const opts = [{ id: 'system', name: 'Системный' }].concat(CURSORS.map(c => ({ id: c.id, name: c.name })));
    for (const o of opts) {
      const d = el('div', 'opt' + (cfg.id === o.id ? ' on' : ''));
      if (o.id !== 'system') { const c = CURSORS.find(x => x.id === o.id); d.appendChild(el('img', '', '')).src = cursorUrl(c, 32).url; }
      d.appendChild(el('div', '', o.name));
      d.onclick = () => { cfg.id = o.id; save(); apply(); grid.querySelectorAll('.opt').forEach(x => x.classList.toggle('on', x === d)); };
      grid.appendChild(d);
    }
    box.appendChild(grid);
    const row = el('div', 'row');
    const lbl = el('span', '', ''); lbl.textContent = `Размер: ${cfg.size} px`;
    const sl = el('input'); sl.type = 'range'; sl.min = 16; sl.max = 128; sl.step = 4; sl.value = cfg.size;
    sl.oninput = () => { cfg.size = +sl.value; lbl.textContent = `Размер: ${cfg.size} px`; save(); apply(); };
    row.appendChild(sl); row.appendChild(lbl); box.appendChild(row);
    const x = el('button', 'x', 'Готово'); x.onclick = () => { panel.remove(); panel = null; };
    box.appendChild(x);
    panel.appendChild(box);
    panel.addEventListener('click', e => { if (e.target === panel) { panel.remove(); panel = null; } });
    document.body.appendChild(panel);
  }
  function mount() {
    document.head.appendChild(css());
    bar = el('div'); bar.id = 'qolBar';
    const ench = el('button', '', '✦ ЗАЧАРОВАТЬ ВСЁ'); ench.title = 'Auto-enchant all items: spends shards, gold and whetstones on the best items (max where affordable)';
    ench.onclick = enchantAll;
    const cur = el('button', '', '🖱 КУРСОР'); cur.onclick = openPanel;
    bar.appendChild(ench); bar.appendChild(cur);
    document.body.appendChild(bar);
    setInterval(() => { ench.disabled = !(G.D && G.D.enchantAll); }, 1000);
    apply();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else setTimeout(mount, 0);
  G.qol = { CURSORS, apply, openPanel, enchantAll, cfg };
})(globalThis.G = globalThis.G || {});
