// BTTN — DOM interface: resources, tabs, lists, constellation, collection,
// pets, quests, achievements, ascension, settings, toasts and modals.
(function (G) {
  'use strict';
  const UI = G.UI = {};
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ic = (id, sc, o) => G.SPR.url(id, sc || 4, o);
  const img = (id, cls, sc, o) => `<img src="${ic(id, sc, o)}" alt="" class="${cls || ''}" draggable="false">`;
  const fmt = G.fmt, t = G.t, L = G.L;

  let tab = 'upg', buyAmt = 1, selNode = 'spark', selItem = null, ascArm = 0, resetArm = 0;
  let refs = {}, lastText = new WeakMap();
  const setText = (el, s) => { if (el && lastText.get(el) !== s) { el.textContent = s; lastText.set(el, s); } };
  const setClass = (el, c, on) => { if (el && el.classList.contains(c) !== !!on) el.classList.toggle(c, !!on); };

  const TABS = [
    { id: 'upg', icon: 'ic_rune', unlock: () => true },
    { id: 'heroes', icon: 'h_knight', unlock: S => S.goldTotal >= 40 || S.ascensions > 0 },
    { id: 'coll', icon: 'ic_bag', unlock: S => S.st.chests >= 1 },
    { id: 'quests', icon: 'ic_scroll', unlock: S => S.st.chests >= 5 || S.ascensions > 0 },
    { id: 'stars', icon: 'ic_star', unlock: S => S.essRun >= 1 || Object.keys(S.nodes).length > 0 || S.ascensions > 0 },
    { id: 'pets', icon: 'egg_2', unlock: S => S.eggs > 0 || Object.keys(S.pets).length > 0 },
    { id: 'ach', icon: 'ic_trophy', unlock: S => Object.keys(S.ach).length > 0 },
    { id: 'asc', icon: 'ic_tomb', unlock: S => S.maxDepth >= 5 || S.ascensions > 0 },
    { id: 'set', icon: 'ic_gear', unlock: () => true },
  ];
  const tabOpen = id => { const d = TABS.find(x => x.id === id); return d && d.unlock(G.S); };

  // ---------- Shell ----------
  UI.init = function () {
    const S = G.S;
    S.seen = S.seen || {};
    S.seen.tabs = S.seen.tabs || {};
    $('#goldIco').src = ic('ic_coin', 4);
    $('#essIco').src = ic('ic_ess', 3);
    $('#eggIco').src = ic('ic_egg', 3);
    $('#fameIco').src = ic('ic_fame', 3);
    buildTabs();
    bindHud();
    bindKeys();
    listen();
    tab = 'upg';
    S.seen.tabs.upg = 1; S.seen.tabs._u_upg = 1;
    UI.render();
    UI.update(true);
  };

  function buildTabs() {
    const nav = $('#tabs');
    nav.innerHTML = TABS.map((x, i) => `<button class="tab" data-tab="${x.id}" aria-label="${esc(t('tab_' + x.id))}" title="${esc(t('tab_' + x.id))} (${i + 1})">${img(x.icon, '', 3)}<span class="dot" hidden></span></button>`).join('');
    nav.addEventListener('click', e => {
      const b = e.target.closest('.tab'); if (!b) return;
      const id = b.dataset.tab;
      if (!tabOpen(id)) { G.Audio.error(); return; }
      UI.go(id);
    });
  }
  UI.go = function (id) {
    tab = id; ascArm = 0; resetArm = 0;
    G.S.seen.tabs[id] = 1;
    UI.render();
    $('#tabBody').scrollTop = 0;
  };

  function bindHud() {
    $('#btnSound').addEventListener('click', () => { G.S.set.sound = G.S.set.sound ? 0 : 1; G.Audio.unlock(); G.Audio.apply(); UI.update(true); });
    $('#btnMusic').addEventListener('click', () => { G.S.set.music = G.S.set.music ? 0 : 1; G.Audio.unlock(); G.Audio.apply(); UI.update(true); });
    $('#btnSound img').src = ic('ic_note', 3);
    $('#btnMusic img').src = ic('ic_echo', 3);
    $('#btnFight').addEventListener('click', () => { G.Audio.unlock(); G.startBoss(); });
    $('#btnRetreat').addEventListener('click', () => G.fleeBoss());
  }

  function bindKeys() {
    window.addEventListener('keydown', e => {
      const tg = e.target;
      if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.isContentEditable)) return;
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') {
        if (tg && tg.tagName === 'BUTTON' && e.code !== 'Space') return;
        e.preventDefault();
        if (e.repeat && !G.S.set.hold) return;
        G.Stage.keyClick();
      } else if (e.code === 'KeyE' || e.code === 'KeyF') { G.Stage.keyChest(); }
      else if (e.code === 'KeyB') { G.startBoss(); }
      else if (/^Digit[1-9]$/.test(e.code)) {
        const d = TABS[+e.code.slice(5) - 1];
        if (d && tabOpen(d.id)) UI.go(d.id);
      }
    });
  }

  // ---------- Events ----------
  function listen() {
    G.on('achievement', a => { UI.toast(`<span>${esc(t('achievement'))}: <b>${esc(L(a.name))}</b></span>`, 'ach', 'ic_trophy'); if (tab === 'ach') UI.render(); });
    G.on('questDone', q => UI.toast(`<b>${esc(t('questDone'))}</b>`, '', 'ic_scroll'));
    G.on('realm', r => UI.toast(`<span>${esc(t('newLands', L(G.REALMS[r].name)))}</span>`, 'ach', 'ic_star'));
    G.on('potion', p => UI.toast(`<span>${esc(t('potionDrink', L(p.name)))} <b>${esc(p.short)} ${G.S.pots[p.id]}/${G.D.potCap}</b></span>`, '', 'pot_' + p.id));
    G.on('chestOpen', loot => {
      if (loot.source === 'offline') return;
      const top = loot.items.reduce((a, b) => (b.it.r > a.it.r ? b : a), loot.items[0]);
      if (top.it.r >= 4) UI.banner(top.it);
      else if (top.isNew) UI.toast(`<span style="color:${G.RARITIES[top.it.r].color}">${esc(L(top.it.name))}</span>&nbsp;<b>${esc(t('newPet'))}</b>`, '', 'it_' + top.it.id);
      dirtyTab('coll'); dirtyTab('quests');
    });
    G.on('bossWin', (rew) => { dirtyTab('quests'); dirtyTab('asc'); });
    G.on('pull', res => showPull(res));
    G.on('buy', (kind) => { if ((kind === 'hero' && tab === 'heroes') || (kind === 'upg' && tab === 'upg') || (kind === 'node' && tab === 'stars') || (kind === 'legacy' && tab === 'asc')) UI.update(true); if (kind === 'node' && tab === 'stars') UI.render(); });
    G.on('ascend', g => { UI.toast(`<b>${esc(t('ascDone', fmt(g)))}</b>`, 'ach', 'ic_fame'); UI.render(); });
    G.on('quests', () => dirtyTab('quests'));
    G.on('questClaim', () => { if (tab === 'quests') UI.render(); });
    G.on('daily', () => { if (tab === 'quests') UI.render(); });
    G.on('pets', () => { if (tab === 'pets') UI.render(); });
  }
  const dirty = {};
  function dirtyTab(id) { dirty[id] = true; }

  // ---------- Update loop ----------
  UI.update = function (force) {
    const S = G.S, D = G.D, R = G.R;
    setText($('#goldNum'), fmt(S.gold));
    setText($('#gpsNum'), fmt(D.gps, true));
    setText($('#clickNum'), fmt(D.click, true));
    setText($('#essNum'), fmt(S.essence, true));
    setText($('#eggNum'), fmt(S.eggs));
    setText($('#fameNum'), fmt(S.fame));
    $('#essChip').hidden = !tabOpen('stars');
    $('#eggChip').hidden = !(S.eggs > 0 || Object.keys(S.pets).length);
    $('#fameChip').hidden = !(S.fameTotal > 0);
    // Tabs
    for (const d of TABS) {
      const b = $(`.tab[data-tab="${d.id}"]`);
      const open = d.unlock(S);
      setClass(b, 'locked', !open);
      setClass(b, 'on', d.id === tab);
      const dot = b.querySelector('.dot');
      const showDot = open && !S.seen.tabs[d.id] && d.id !== 'set';
      if (dot.hidden === showDot) dot.hidden = !showDot;
      if (open && !S.seen.tabs['_u_' + d.id]) {
        S.seen.tabs['_u_' + d.id] = 1;
        if (d.id !== 'set' && d.id !== tab) UI.toast(`<span>${esc(t('unlocked', t('tab_' + d.id)))}</span>`, '', d.icon);
      }
    }
    // Gold marker on shop tabs when something is affordable
    let canUpg = false, canHero = false, canNode = false;
    for (const u of G.UPGRADES) { const L_ = S.upg[u.id] || 0; if ((!u.max || L_ < u.max) && !u.secret && S.gold >= G.upgCost(u)) { canUpg = true; break; } }
    for (const h of G.HEROES) { if (S.gold >= G.heroCost(h, 1)) { canHero = true; break; } }
    if (tabOpen('stars')) for (const n of G.NODES) { if ((S.nodes[n.id] || 0) < n.max && G.nodeAvailable(n) && S.essence >= G.nodeCost(n)) { canNode = true; break; } }
    setClass($('.tab[data-tab="upg"]'), 'afford', canUpg);
    setClass($('.tab[data-tab="heroes"]'), 'afford', canHero && tabOpen('heroes'));
    setClass($('.tab[data-tab="stars"]'), 'afford', canNode);
    const qDot = $(`.tab[data-tab="quests"] .dot`);
    if (tabOpen('quests') && (S.quests.some(q => q.done) || G.dailyAvailable())) qDot.hidden = false;
    // HUD
    const realm = G.REALMS[G.realmIndex(S.depth)];
    setText($('#realmName'), L(realm.name));
    setText($('#depthNum'), String(S.depth + 1));
    setText($('#realmSub'), (G.isLord(S.depth) ? t('lordTitle') + ': ' : t('bossTitle') + ': ') + L(G.bossName(S.depth)));
    const cm = $('#chestMeter');
    cm.style.width = Math.min(100, S.chestMeter / D.chestNeed * 100) + '%';
    const comboK = R.combo / (D.comboCap || 1);
    $('#comboMeter').style.width = Math.min(100, comboK * 100) + '%';
    setClass($('#comboWrap'), 'hot', comboK >= 1);
    setText($('#comboText'), t('combo') + ' ' + Math.floor(R.combo) + ' · ×' + (1 + R.combo * D.comboPer).toFixed(2));
    setText($('#chestText'), t('nextChest') + ' ' + Math.floor(S.chestMeter / D.chestNeed * 100) + '%');
    const bossShown = S.st.chests >= 10 || S.st.bossKills > 0;
    $('#bossRow').hidden = !bossShown;
    if (bossShown) {
      if (R.boss) {
        const k = Math.max(0, R.boss.hp / R.boss.max);
        $('#bossMeter').style.width = k * 100 + '%';
        setClass($('#bossWrap'), 'hp', true);
        setText($('#bossText'), L(G.bossName(R.boss.d)) + ' · ' + Math.ceil(R.boss.t) + 's');
        $('#btnFight').hidden = true; $('#btnRetreat').hidden = false;
      } else {
        setClass($('#bossWrap'), 'hp', false);
        const need = D.bossNeed;
        $('#bossMeter').style.width = Math.min(100, S.bossMeter / need * 100) + '%';
        setText($('#bossText'), R.bossReady ? t('bossReady') : t('bossMeter', Math.max(0, Math.ceil(need - S.bossMeter))));
        $('#btnFight').hidden = !R.bossReady; $('#btnRetreat').hidden = true;
      }
    }
    // Buffs
    const bh = S.buffs.map(b => `<span class="buff ${b.id}">${esc(t(b.id))} ${Math.ceil(b.t)}s</span>`).join('');
    const bEl = $('#buffs');
    if (bEl._h !== bh) { bEl.innerHTML = bh; bEl._h = bh; }
    // Tutorial hint
    let hint = '';
    if (S.clicks < 3 && !S.ascensions) hint = t('tut0');
    else if (S.chests.length && S.st.chests === 0) hint = t('tut1');
    setText($('#hint'), hint);
    $('#hint').hidden = !hint;
    $('#btnSound').classList.toggle('off', !S.set.sound);
    $('#btnMusic').classList.toggle('off', !S.set.music);

    if (dirty[tab]) { dirty[tab] = false; if (tab === 'coll' || tab === 'quests' || tab === 'asc') { updaters[tab] && updaters[tab](true); } }
    if (updaters[tab]) updaters[tab](force);
  };

  // ---------- Render tabs ----------
  const renderers = {}, updaters = {};
  function applyStatic() {
    $$('[data-t]').forEach(el => setText(el, t(el.dataset.t)));
    $$('[data-depth-label]').forEach(el => setText(el, t('depth')));
  }
  UI.render = function () {
    applyStatic();
    refs = {};
    const body = $('#tabBody');
    const title = $('#tabTitle');
    title.innerHTML = `<span>${esc(t('tab_' + tab))}</span><small id="tabSub"></small>`;
    body.innerHTML = '';
    (renderers[tab] || (() => {}))(body);
    UI.update(true);
  };

  // Upgrades
  renderers.upg = function (body) {
    const S = G.S;
    const list = G.UPGRADES.filter(u => (S.upg[u.id] || 0) > 0 || (u.secret ? S.goldRun >= u.secret : S.goldTotal >= u.base * 0.3 || u.id === 'finger'));
    body.innerHTML = `<div class="list">${list.map(u => `
      <button class="row" data-u="${u.id}">
        <span class="ico">${img(u.icon, '', 4)}</span>
        <span class="info"><span class="name">${esc(L(u.name))}<span class="lv" data-lv></span></span><span class="desc">${esc(L(u.desc))}</span></span>
        <span class="cost">${img('ic_coin', '', 2)}<span data-cost></span></span>
      </button>`).join('')}</div>
      <p class="note">${esc(t('keysHint'))}</p>`;
    refs.rows = $$('.row', body).map(el => ({ el, u: G.UPGRADES.find(x => x.id === el.dataset.u), lv: el.querySelector('[data-lv]'), cost: el.querySelector('[data-cost]') }));
    body.querySelector('.list').addEventListener('click', e => {
      const r = e.target.closest('.row'); if (!r) return;
      if (!G.buyUpgrade(r.dataset.u)) { shakeRow(r); }
    });
    refs.count = list.length;
  };
  updaters.upg = function () {
    const S = G.S;
    if (!refs.rows) return;
    const visible = G.UPGRADES.filter(u => (S.upg[u.id] || 0) > 0 || (u.secret ? S.goldRun >= u.secret : S.goldTotal >= u.base * 0.3 || u.id === 'finger')).length;
    if (visible !== refs.count) { UI.render(); return; }
    for (const r of refs.rows) {
      const L_ = S.upg[r.u.id] || 0;
      const maxed = r.u.max && L_ >= r.u.max;
      const c = G.upgCost(r.u);
      setText(r.lv, t('lvl') + ' ' + L_ + (r.u.max ? '/' + r.u.max : ''));
      setText(r.cost, maxed ? t('max') : fmt(c));
      setClass(r.el, 'maxed', maxed);
      setClass(r.el, 'can', !maxed && S.gold >= c);
      setClass(r.el, 'cant', !maxed && S.gold < c);
    }
  };
  function shakeRow(r) { r.classList.remove('shake'); void r.offsetWidth; r.classList.add('shake'); G.Audio.error(); }

  // Heroes
  function heroVisible(h, i) {
    const S = G.S;
    return (S.heroes[h.id] || 0) > 0 || S.goldTotal >= h.cost * 0.35 || i === 0;
  }
  renderers.heroes = function (body) {
    const S = G.S;
    const vis = G.HEROES.filter(heroVisible);
    const next = G.HEROES[vis.length];
    body.innerHTML = `
      <div class="sect">${esc(t('statsTitle'))}</div>
      <div class="statGrid">${G.POTIONS.map(p => `<div class="stat" data-p="${p.id}" title="${esc(L(p.name) + ': ' + L(p.desc))}">${img('pot_' + p.id, '', 2)}<b>${p.short}</b><span></span></div>`).join('')}</div>
      <p class="note" data-pothint></p>
      <div class="tabTitle" style="padding:6px 4px"><small>${esc(t('buyAmt'))}</small>
        <span class="seg" data-seg>${[1, 10, 100, 'max'].map(a => `<button data-a="${a}" class="${a === buyAmt ? 'on' : ''}">${a === 'max' ? 'MAX' : '×' + a}</button>`).join('')}</span></div>
      <div class="list">${vis.map(h => `
        <button class="row" data-h="${h.id}">
          <span class="ico">${img('h_' + h.id, '', 4)}</span>
          <span class="info"><span class="name">${esc(L(h.name))}<span class="count" data-n></span></span>
            <span class="desc" data-d></span><span class="bar"><i data-bar></i></span></span>
          <span class="cost">${img('ic_coin', '', 2)}<span data-cost></span></span>
        </button>`).join('')}
        ${next ? `<div class="row locked"><span class="ico">${img('h_' + next.id, '', 4)}</span><span class="info"><span class="name">${esc(t('heroLocked'))}</span><span class="desc">${esc(t('heroLockedHint', fmt(next.cost * 0.35)))}</span></span><span></span></div>` : ''}
      </div>`;
    refs.rows = $$('.row[data-h]', body).map(el => ({ el, h: G.HEROES.find(x => x.id === el.dataset.h), n: el.querySelector('[data-n]'), d: el.querySelector('[data-d]'), bar: el.querySelector('[data-bar]'), cost: el.querySelector('[data-cost]') }));
    refs.stats = $$('.stat', body).map(el => ({ el, p: el.dataset.p, v: el.querySelector('span') }));
    refs.potHint = body.querySelector('[data-pothint]');
    refs.count = vis.length;
    body.querySelector('[data-seg]').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      buyAmt = b.dataset.a === 'max' ? 'max' : +b.dataset.a;
      $$('[data-seg] button', body).forEach(x => x.classList.toggle('on', x === b));
      UI.update(true);
    });
    body.querySelector('.list').addEventListener('click', e => {
      const r = e.target.closest('.row[data-h]'); if (!r) return;
      if (!G.buyHero(r.dataset.h, buyAmt)) shakeRow(r);
    });
  };
  updaters.heroes = function () {
    const S = G.S, D = G.D;
    if (!refs.rows) return;
    if (G.HEROES.filter(heroVisible).length !== refs.count) { UI.render(); return; }
    for (const r of refs.rows) {
      const n = S.heroes[r.h.id] || 0;
      let amt = buyAmt === 'max' ? Math.max(1, G.heroMax(r.h)) : buyAmt;
      const c = G.heroCost(r.h, amt);
      const each = r.h.gps * Math.pow(2, G.heroMilestones(n)) * D.gpsMult * D.goldMult * D.depthMult * D.buffGold;
      const total = D.heroGps[r.h.id] ? D.heroGps[r.h.id] * D.buffGold : 0;
      setText(r.n, n ? '×' + n : '');
      const nextM = G.HERO_MILESTONES.find(m => m > n);
      const prevM = [0].concat(G.HERO_MILESTONES).filter(m => m <= n).pop();
      setText(r.d, fmt(each, true) + t('perSec') + ' ' + t('each') + (n ? ' · ' + t('total') + ' ' + fmt(total, true) + t('perSec') : '') + (nextM ? ' · ' + t('toMilestone', nextM - n) : ''));
      r.bar.style.width = nextM ? ((n - prevM) / (nextM - prevM) * 100) + '%' : '100%';
      setText(r.cost, (amt > 1 ? amt + '× ' : '') + fmt(c));
      setClass(r.el, 'can', S.gold >= c);
      setClass(r.el, 'cant', S.gold < c);
    }
    for (const s of refs.stats) {
      const v = S.pots[s.p];
      setText(s.v, v + '/' + D.potCap);
      setClass(s.el, 'full', v >= D.potCap);
    }
    setText(refs.potHint, t('statsHint', D.potCap));
  };

  // Constellation
  renderers.stars = function (body) {
    const S = G.S;
    const width = Math.max(260, body.clientWidth - 8);
    const cell = Math.floor(Math.min(48, (width - 8) / 11));
    const cellY = Math.round(cell * 1.12);
    const mw = cell * 11 + 8, mh = cellY * 12 + 12;
    const pos = n => ({ x: 4 + (n.x + 5 + 0.5) * cell, y: 6 + (n.y + 5 + 0.5) * cellY });
    const nodeSize = Math.max(22, Math.round(cell * 0.72));
    let lines = '';
    for (const n of G.NODES) for (const r of n.req) {
      const a = pos(G.NODE_BY_ID[r]), b = pos(n);
      lines += `<line data-a="${r}" data-b="${n.id}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke-width="2"/>`;
    }
    body.innerHTML = `
      <p class="note">${esc(t('starsHint'))}</p>
      <div class="starmap" style="width:${mw}px;height:${mh}px">
        <svg viewBox="0 0 ${mw} ${mh}" aria-hidden="true">${lines}</svg>
        ${G.NODES.map(n => { const p = pos(n); const sz = n.max === 1 && n.cost >= 150 ? nodeSize + 6 : nodeSize; return `<button class="node${sz > nodeSize ? ' big' : ''}" data-n="${n.id}" style="left:${p.x}px;top:${p.y}px;width:${sz}px;height:${sz}px;--c:${G.BRANCH_COLORS[n.br]}" aria-label="${esc(L(n.name))}"><i></i></button>`; }).join('')}
      </div>
      <div class="detail" data-detail></div>`;
    refs.nodes = $$('.node', body).map(el => ({ el, n: G.NODE_BY_ID[el.dataset.n], lbl: el.querySelector('i') }));
    refs.lines = $$('line', body);
    refs.detail = body.querySelector('[data-detail]');
    body.querySelector('.starmap').addEventListener('click', e => {
      const b = e.target.closest('.node'); if (!b) return;
      if (selNode === b.dataset.n) { if (!G.buyNode(selNode)) G.Audio.error(); }
      selNode = b.dataset.n;
      renderDetail(true);
      UI.update(true);
    });
    renderDetail(true);
  };
  function renderDetail(full) {
    const n = G.NODE_BY_ID[selNode], S = G.S;
    if (!n || !refs.detail) return;
    const L_ = S.nodes[n.id] || 0, maxed = L_ >= n.max, avail = G.nodeAvailable(n);
    const c = G.nodeCost(n);
    if (full || refs.detail.dataset.n !== n.id) {
      refs.detail.dataset.n = n.id;
      refs.detail.innerHTML = `<h3 style="color:${G.BRANCH_COLORS[n.br]}">${esc(L(n.name))} <span class="lv" data-lv style="font:8px var(--font-display);color:var(--dim)"></span></h3>
        <p>${esc(L(n.desc))}</p>
        <div class="act"><span class="reward">${img('ic_ess', '', 2)}<span data-cost></span></span><button class="btn gold" data-buy>${esc(t('learn'))}</button></div>`;
      refs.detail.querySelector('[data-buy]').addEventListener('click', () => { if (!G.buyNode(selNode)) G.Audio.error(); UI.update(true); });
    }
    setText(refs.detail.querySelector('[data-lv]'), t('lvl') + ' ' + L_ + '/' + n.max);
    const costEl = refs.detail.querySelector('[data-cost]');
    setText(costEl, maxed ? t('nodeMaxed') : !avail ? t('nodeLocked') : fmt(c));
    const btn = refs.detail.querySelector('[data-buy]');
    btn.disabled = maxed || !avail || S.essence < c;
  }
  updaters.stars = function () {
    const S = G.S;
    if (!refs.nodes) return;
    for (const r of refs.nodes) {
      const L_ = S.nodes[r.n.id] || 0, avail = G.nodeAvailable(r.n);
      setText(r.lbl, L_ + '/' + r.n.max);
      setClass(r.el, 'owned', L_ > 0);
      setClass(r.el, 'maxed', L_ >= r.n.max);
      setClass(r.el, 'avail', avail && L_ < r.n.max && S.essence >= G.nodeCost(r.n));
      setClass(r.el, 'locked', !avail);
      setClass(r.el, 'sel', r.n.id === selNode);
    }
    for (const l of refs.lines) {
      const a = (S.nodes[l.dataset.a] || 0) > 0, b = (S.nodes[l.dataset.b] || 0) > 0;
      const col = a && b ? G.BRANCH_COLORS[G.NODE_BY_ID[l.dataset.b].br] : a ? '#5a5474' : '#2a2638';
      if (l._c !== col) { l.setAttribute('stroke', col); l._c = col; l.setAttribute('stroke-dasharray', a && b ? '' : '3 3'); }
    }
    setText($('#tabSub'), fmt(S.essence, true) + ' ✦');
    renderDetail(false);
  };

  // Collection
  renderers.coll = function (body) {
    const S = G.S, D = G.D;
    const found = G.ITEMS.filter(it => (S.coll[it.id] || 0) > 0).length;
    const sums = D.collSums || {};
    const bonusRows = Object.keys(G.BONUS).filter(k => sums[k]).map(k => {
      const b = G.BONUS[k], v = sums[k];
      return `<span>${esc(L(b.name))}</span><b>${b.pct ? G.fmtPct(v) : (b.x ? '+' + v.toFixed(1) + '×' : '+' + Math.floor(v))}</b>`;
    }).join('');
    body.innerHTML = `
      <p class="note">${esc(t('collFound', found, G.ITEMS.length))}. ${esc(t('collHint'))}</p>
      <div class="detail" data-item style="margin-bottom:8px"></div>
      ${G.RARITIES.map((r, ri) => `
        <div class="rarLabel" style="color:${r.color}"><span>${esc(L(r.name))}</span><span style="color:var(--dim)">${G.ITEMS_BY_RARITY[ri].filter(it => S.coll[it.id]).length}/6</span></div>
        <div class="rarRow">${G.ITEMS_BY_RARITY[ri].map(it => `<button class="slot r${ri}" data-i="${it.id}" aria-label="${esc(L(it.name))}">${img('it_' + it.id, '', 4)}<span class="stars"></span><span class="n"></span></button>`).join('')}</div>`).join('')}
      <div class="sect">${esc(t('collBonuses'))}</div>
      <div class="bonusList">${bonusRows || `<span>—</span>`}</div>
      <div class="sect">${esc(t('chestsOpened'))}</div>
      <div class="tierCounts">${G.RARITIES.map((r, i) => `<div style="color:${r.color}">${img('chest_' + i, '', 2)}<br>${fmt(S.opened[i])}</div>`).join('')}</div>
      <div class="sect">${esc(t('modifiers'))}</div>
      <div class="modList">${G.MODIFIERS.map(m => `<div class="modItem ${D.mods[m.id] ? '' : 'off'}"><b style="color:${m.color}">${esc(L(m.name))}</b><span>${esc(D.mods[m.id] ? L(m.desc) : t('modLocked'))}</span></div>`).join('')}</div>`;
    refs.slots = $$('.slot', body).map(el => ({ el, it: G.ITEM_BY_ID[el.dataset.i], n: el.querySelector('.n'), st: el.querySelector('.stars'), img: el.querySelector('img') }));
    refs.item = body.querySelector('[data-item]');
    refs.found = found;
    body.addEventListener('click', e => {
      const s = e.target.closest('.slot'); if (!s) return;
      selItem = s.dataset.i; updaters.coll(true);
    });
    if (!selItem) selItem = (G.ITEMS.find(it => S.coll[it.id]) || G.ITEMS[0]).id;
  };
  updaters.coll = function (force) {
    const S = G.S;
    if (!refs.slots) return;
    const found = G.ITEMS.filter(it => (S.coll[it.id] || 0) > 0).length;
    if (found !== refs.found) { UI.render(); return; }
    if (!force) return;
    for (const s of refs.slots) {
      const n = S.coll[s.it.id] || 0;
      setClass(s.el, 'none', n === 0);
      setClass(s.el, 'sel', s.it.id === selItem);
      setText(s.n, n ? fmt(n) : '');
      const st = G.stars(n);
      const sh = '<i></i>'.repeat(st);
      if (s.st._h !== sh) { s.st.innerHTML = sh; s.st._h = sh; }
    }
    const it = G.ITEM_BY_ID[selItem];
    if (it && refs.item) {
      const n = S.coll[it.id] || 0, r = G.RARITIES[it.r], b = G.BONUS[it.bonus];
      const st = G.stars(n), per = b.v * r.bonusMul;
      const next = G.STAR_THRESHOLDS.find(x => x > n);
      const fmtB = v => b.pct ? G.fmtPct(v) : (b.x ? '+' + v.toFixed(1) + '×' : '+' + Math.floor(v));
      const html = n ? `<h3 style="color:${r.color}">${esc(L(it.name))}</h3>
        <p>${esc(L(r.name))} · ${esc(t('count'))}: <b style="color:var(--text)">${fmt(n)}</b> · ${esc(t('value'))}: <b style="color:var(--gold)">${fmt(G.itemValue(it))}</b></p>
        <p>${esc(t('bonus'))}: ${esc(L(b.name))} <b style="color:var(--good)">${fmtB(per * st)}</b> (${fmtB(per)} / ★)</p>
        <p>${next ? esc(t('nextStar', fmt(next))) : esc(t('allStars'))}</p>`
        : `<h3 style="color:var(--dim)">???</h3><p>${esc(L(r.name))} · ${esc(t('unknownItem'))}</p>`;
      if (refs.item._h !== html) { refs.item.innerHTML = html; refs.item._h = html; }
    }
  };

  // Pets
  renderers.pets = function (body) {
    const S = G.S, D = G.D;
    const tierRates = G.PET_TIERS.map(x => Math.round(x.rate * 100));
    body.innerHTML = `
      <div class="hatch">
        <img class="egg" src="${ic('egg_' + Math.min(3, Math.floor(S.pulls / 20)), 10)}" alt="">
        <div>
          <b style="font:8px var(--font-display);color:var(--gold)">${esc(t('hatchery'))}</b>
          <div class="acts">
            <button class="btn gold" data-pull="1">${esc(t('hatch1'))} · ${img('ic_egg', '', 2)}1</button>
            <button class="btn gold" data-pull="10">${esc(t('hatch10'))} · ${img('ic_egg', '', 2)}9</button>
          </div>
          <small>${esc(t('eggOdds', tierRates[0], tierRates[1], tierRates[2], tierRates[3], Math.round(D.goldenChance * 100)))}</small>
          <small data-pity></small>
        </div>
      </div>
      <div class="sect" data-active></div>
      <p class="note">${esc(t('petHint'))}</p>
      <div class="petGrid">${G.PETS.map(p => `<button class="pet" data-p="${p.id}"><span class="tag" hidden>✓</span><img alt=""><b></b><span class="lv"></span><small></small></button>`).join('')}</div>`;
    refs.pets = $$('.pet', body).map(el => ({ el, p: G.PET_BY_ID[el.dataset.p], img: el.querySelector('img'), b: el.querySelector('b'), lv: el.querySelector('.lv'), sm: el.querySelector('small'), tag: el.querySelector('.tag') }));
    refs.pull = $$('[data-pull]', body);
    refs.pity = body.querySelector('[data-pity]');
    refs.active = body.querySelector('[data-active]');
    body.addEventListener('click', e => {
      const pb = e.target.closest('[data-pull]');
      if (pb) { G.Audio.unlock(); if (!G.pull(+pb.dataset.pull)) { G.Audio.error(); UI.toast(esc(t('noEggs')), '', 'ic_egg'); } return; }
      const pe = e.target.closest('.pet');
      if (pe && G.S.pets[pe.dataset.p]) { G.togglePet(pe.dataset.p); }
    });
    refs.petKey = '';
  };
  updaters.pets = function () {
    const S = G.S, D = G.D;
    if (!refs.pets) return;
    refs.pull[0].disabled = S.eggs < 1;
    refs.pull[1].disabled = S.eggs < 9;
    setText(refs.pity, t('pityL', Math.max(1, 25 - S.pity.l)) + ' · ' + t('pityD', Math.max(1, 120 - S.pity.d)));
    setText(refs.active, t('activePets', S.active.length, D.petSlots));
    setText($('#tabSub'), fmt(S.eggs) + ' ' + t('eggs').toLowerCase());
    const key = JSON.stringify(S.pets) + S.active.join() + G.lang();
    if (key === refs.petKey) return;
    refs.petKey = key;
    for (const r of refs.pets) {
      const st = S.pets[r.p.id];
      const tier = G.PET_TIERS[r.p.tier];
      r.img.src = ic('p_' + r.p.id, 5, st && st.gold ? { gold: true } : null);
      setClass(r.el, 'none', !st);
      setClass(r.el, 'on', !!st && S.active.includes(r.p.id));
      setClass(r.el, 'gold', !!(st && st.gold));
      r.tag.hidden = !(st && S.active.includes(r.p.id));
      setText(r.b, st ? L(r.p.name) : t('petUnknown'));
      r.b.style.color = tier.color;
      setText(r.lv, st ? t('lvl') + ' ' + st.lvl + (st.gold ? ' · ' + t('golden') : '') : L(tier.name));
      setText(r.sm, st ? L(r.p.desc) + ' · ' + t('petPower', (G.petPower(st) * D.petMult).toFixed(1)) : '');
    }
  };
  function showPull(res) {
    const cards = res.map((r, i) => {
      const tier = G.PET_TIERS[r.pet.tier];
      return `<div class="pullCard" style="--c:${r.golden ? '#ffd84a' : tier.color};animation-delay:${i * 0.08}s">${img('p_' + r.pet.id, '', 5, r.golden ? { gold: true } : null)}<span style="color:${tier.color}">${esc(L(r.pet.name))}</span><em>${r.isNew ? esc(t('newPet')) : r.newGold ? esc(t('golden')) : t('lvl') + ' ' + r.lvl}</em></div>`;
    }).join('');
    const best = res.reduce((m, r) => Math.max(m, r.pet.tier + (r.golden ? 1 : 0)), 0);
    G.Audio.pull(best);
    UI.modal(t('pullTitle'), `<div class="pullGrid" style="${res.length === 1 ? 'grid-template-columns:1fr;justify-items:center' : ''}">${cards}</div>`, [{ label: t('ok'), cls: 'gold' }]);
    if (tab === 'pets') UI.update(true);
  }

  // Quests
  renderers.quests = function (body) {
    const S = G.S;
    const avail = G.dailyAvailable();
    const streak = avail ? (() => { const y = new Date(); y.setDate(y.getDate() - 1); return S.daily.last === G.todayKey(y) ? S.daily.streak + 1 : 0; })() : S.daily.streak;
    const dayIcon = d => { const r = G.DAILY[d % 7]; return r.kind === 'gold' ? 'ic_coin' : r.kind === 'eggs' ? 'ic_egg' : r.kind === 'ess' ? 'ic_ess' : 'chest_6'; };
    body.innerHTML = `
      <div class="quest ${avail ? 'done' : ''}">
        <div class="top"><b>${esc(t('daily'))}</b>${avail ? `<button class="btn gold" data-daily>${esc(t('collect'))}</button>` : `<small style="color:var(--dim)">${esc(t('tomorrow'))}</small>`}</div>
        <div class="dailyDays">${G.DAILY.map((d, i) => `<div class="${i < streak % 7 ? 'past' : ''} ${i === streak % 7 && avail ? 'now' : ''}">${esc(t('dayN', i + 1))}${img(dayIcon(i), '', 2)}</div>`).join('')}</div>
      </div>
      <div class="sect">${esc(t('quests'))}</div>
      <div class="list" data-q></div>`;
    const b = body.querySelector('[data-daily]');
    if (b) b.addEventListener('click', () => { const r = G.claimDaily(); if (r) UI.toast(`<b>${esc(t('daily'))}</b>&nbsp;+${r.kind === 'chest' ? esc(L(G.RARITIES[r.tier].name)) : fmt(r.v)}`, 'ach', dayIcon(G.S.daily.streak)); UI.render(); });
    refs.q = body.querySelector('[data-q]');
    refs.qKey = '';
    refs.q.addEventListener('click', e => {
      const c = e.target.closest('[data-claim]');
      if (c) { G.claimQuest(+c.dataset.claim); return; }
      const rr = e.target.closest('[data-reroll]');
      if (rr && !G.rerollQuest(+rr.dataset.reroll)) G.Audio.error();
    });
  };
  function questText(q) {
    switch (q.k) {
      case 'clicks': return t('q_clicks', fmt(q.n));
      case 'chests': return t('q_chests', fmt(q.n));
      case 'rarity': return t('q_rarity', q.n, L(G.RARITIES[q.r].name));
      case 'gold': return t('q_gold', fmt(q.n));
      case 'boss': return t('q_boss', q.n);
      case 'crit': return t('q_crit', fmt(q.n));
      case 'combo': return t('q_combo', q.n);
      case 'mod': return t('q_mod', q.n);
      case 'wisp': return t('q_wisp');
    }
    return '';
  }
  updaters.quests = function () {
    const S = G.S;
    if (!refs.q) return;
    const rerollLeft = Math.max(0, (S.rerollAt - Date.now()) / 1000);
    const key = S.quests.map(q => q.k + (q.done ? 1 : 0) + (q.wait ? 'w' : '')).join('|') + (rerollLeft > 0 ? 'r' : '') + G.lang();
    if (key !== refs.qKey) {
      refs.qKey = key;
      refs.q.innerHTML = S.quests.map((q, i) => {
        if (q.wait) return `<div class="quest wait" data-i="${i}"><span data-wait></span></div>`;
        const rwIcon = q.rw === 'gold' ? 'ic_coin' : q.rw === 'ess' ? 'ic_ess' : 'ic_egg';
        return `<div class="quest ${q.done ? 'done' : ''}" data-i="${i}">
          <div class="top"><b>${esc(questText(q))}</b><span class="reward">${img(rwIcon, '', 2)}<span data-rw></span></span></div>
          <div class="pbar"><i data-bar></i><span data-p></span></div>
          <div class="top">${q.done ? `<button class="btn gold" data-claim="${i}">${esc(t('claim'))}</button>` : '<span></span>'}
            ${q.done ? '' : `<button class="btn" data-reroll="${i}" ${rerollLeft > 0 ? 'disabled' : ''}>${esc(t('reroll'))}</button>`}</div>
        </div>`;
      }).join('');
    }
    $$('.quest', refs.q).forEach(el => {
      const q = S.quests[+el.dataset.i]; if (!q) return;
      if (q.wait) { setText(el.querySelector('[data-wait]'), t('newQuestIn', G.fmtTime(q.wait))); return; }
      el.querySelector('[data-bar]').style.width = Math.min(100, q.p / q.n * 100) + '%';
      setText(el.querySelector('[data-p]'), fmt(Math.floor(q.p)) + ' / ' + fmt(q.n));
      setText(el.querySelector('[data-rw]'), fmt(G.questReward(q), true));
    });
    setText($('#tabSub'), rerollLeft > 0 ? t('rerollIn', G.fmtTime(rerollLeft)) : '');
  };

  // Achievements
  renderers.ach = function (body) {
    const S = G.S;
    const got = Object.keys(S.ach).length;
    const stats = [
      ['st_goldTotal', fmt(S.goldTotal)], ['st_clicks', fmt(S.clicks)], ['st_chests', fmt(S.st.chests)], ['st_boss', fmt(S.st.bossKills)],
      ['st_lords', fmt(S.st.lordKills)], ['st_best', S.bestDepth], ['st_crits', fmt(S.st.crits)], ['st_combo', Math.floor(S.st.maxCombo)],
      ['st_wisps', fmt(S.st.wisps)], ['st_merges', fmt(S.st.merges)], ['st_divine', fmt(S.st.divine)], ['st_asc', S.ascensions], ['st_time', G.fmtTime(S.st.playTime)],
    ];
    body.innerHTML = `
      <p class="note">${esc(t('achSummary', got, G.ACH.length, got))}</p>
      <div class="sect">${esc(t('skins'))}</div>
      <div class="skinRow">${G.SKINS.map(s => {
        const ok = !s.unlock || S.ach[s.unlock];
        const a = s.unlock && G.ACH_BY_ID[s.unlock];
        return `<button class="skin ${S.skin === s.id ? 'on' : ''} ${ok ? '' : 'no'}" data-s="${s.id}" title="${esc(ok ? L(s.name) : t('skinLocked', L(a.name)))}"><img src="${G.SPR.url(G.SPR.button(s.base, false, 200), 2)}" alt=""><span>${esc(ok ? L(s.name) : '???')}</span></button>`;
      }).join('')}</div>
      <div class="sect">${esc(t('tab_ach'))}</div>
      <div class="achGrid">${G.ACH.map(a => {
        const ok = !!S.ach[a.id];
        const hide = a.hidden && !ok;
        return `<div class="ach ${ok ? '' : 'no'}">${img('ic_trophy', '', 3)}<div><b>${esc(hide ? '???' : L(a.name))}</b><small>${esc(hide ? '???' : L(a.desc))}</small></div></div>`;
      }).join('')}</div>
      <div class="sect">${esc(t('stats'))}</div>
      <div class="statList">${stats.map(([k, v]) => `<span>${esc(t(k))}</span><b>${esc(v)}</b>`).join('')}</div>`;
    body.querySelector('.skinRow').addEventListener('click', e => {
      const b = e.target.closest('.skin'); if (!b || b.classList.contains('no')) return;
      G.S.skin = b.dataset.s; UI.render();
    });
  };

  // Ascension
  renderers.asc = function (body) {
    const S = G.S;
    body.innerHTML = `
      <div class="ascBox">
        ${img('tomb', '', 8)}
        <div class="big" data-gain></div>
        <small style="color:var(--dim)">${esc(t('ascGain'))}</small>
        <p>${esc(t('ascText'))}</p>
        <p>${esc(t('ascEach'))} <b style="color:var(--fame)" data-passive></b></p>
        <button class="btn red" data-asc>${esc(t('ascBtn'))}</button>
      </div>
      <div class="sect">${esc(t('hallOfFame'))}</div>
      <p class="note">${esc(t('hallHint'))}</p>
      <div class="list">${G.LEGACY.map(l => `
        <button class="row" data-l="${l.id}">
          <span class="ico">${img('ic_fame', '', 4)}</span>
          <span class="info"><span class="name">${esc(L(l.name))}<span class="lv" data-lv></span></span><span class="desc">${esc(L(l.desc))}</span></span>
          <span class="cost">${img('ic_fame', '', 2)}<span data-cost></span></span>
        </button>`).join('')}</div>`;
    refs.gain = body.querySelector('[data-gain]');
    refs.passive = body.querySelector('[data-passive]');
    refs.ascBtn = body.querySelector('[data-asc]');
    refs.rows = $$('.row[data-l]', body).map(el => ({ el, l: G.LEGACY_BY_ID[el.dataset.l], lv: el.querySelector('[data-lv]'), cost: el.querySelector('[data-cost]') }));
    refs.ascBtn.addEventListener('click', () => {
      if (G.fameGain() < 1) { G.Audio.error(); return; }
      if (!ascArm) { ascArm = 1; refs.ascBtn.textContent = t('ascConfirm'); return; }
      ascArm = 0;
      G.ascend();
    });
    body.querySelector('.list').addEventListener('click', e => {
      const r = e.target.closest('.row'); if (!r) return;
      if (!G.buyLegacy(r.dataset.l)) shakeRow(r);
    });
  };
  updaters.asc = function () {
    const S = G.S;
    if (!refs.gain) return;
    const g = G.fameGain();
    setText(refs.gain, g >= 1 ? '+' + fmt(g) + ' ★' : t('ascNeed'));
    setText(refs.passive, t('famePassive', fmt(S.fameTotal), fmt(S.fameTotal)));
    refs.ascBtn.disabled = g < 1;
    for (const r of refs.rows) {
      const L_ = S.legacy[r.l.id] || 0, maxed = L_ >= r.l.max, c = G.legacyCost(r.l);
      setText(r.lv, t('lvl') + ' ' + L_ + '/' + r.l.max);
      setText(r.cost, maxed ? t('max') : fmt(c));
      setClass(r.el, 'maxed', maxed);
      setClass(r.el, 'can', !maxed && S.fame >= c);
      setClass(r.el, 'cant', !maxed && S.fame < c);
    }
    setText($('#tabSub'), fmt(S.fame) + ' ★');
  };

  // Settings
  renderers.set = function (body) {
    const s = G.S.set;
    const tg = (k, label) => `<div class="setRow"><span>${esc(label)}</span><button class="toggle ${s[k] ? 'on' : ''}" data-t="${k}" aria-pressed="${s[k] ? 'true' : 'false'}" aria-label="${esc(label)}"></button></div>`;
    body.innerHTML = `
      <div class="setList">
        <div class="setRow"><span>${esc(t('language'))}</span><span class="seg" data-lang><button data-l="ru" class="${G.lang() === 'ru' ? 'on' : ''}">RU</button><button data-l="en" class="${G.lang() === 'en' ? 'on' : ''}">EN</button></span></div>
        ${tg('sound', t('sound'))}${tg('music', t('music'))}
        <div class="setRow"><span>${esc(t('volume'))}</span><input id="vol" type="range" min="0" max="1" step="0.05" value="${s.vol}"></div>
        ${tg('hold', t('hold'))}${tg('shake', t('shake'))}${tg('autoBoss', t('autoBoss'))}
      </div>
      <div class="sect">${esc(t('saveTitle'))}</div>
      <p class="note">${esc(t('importHint'))}</p>
      <textarea id="saveBox" spellcheck="false" aria-label="${esc(t('saveTitle'))}"></textarea>
      <div class="acts" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
        <button class="btn" data-exp>${esc(t('export'))}</button>
        <button class="btn" data-copy>${esc(t('copy'))}</button>
        <button class="btn gold" data-imp>${esc(t('import'))}</button>
        <button class="btn" data-save>${esc(t('saveNow'))}</button>
      </div>
      <div class="sect">&nbsp;</div>
      <button class="btn red" data-reset>${esc(t('resetBtn'))}</button>
      <p class="note" style="margin-top:14px">${esc(t('keysHint'))}</p>
      <p class="note">BTTN · ${esc(t('tagline'))}</p>`;
    body.addEventListener('click', e => {
      const tgB = e.target.closest('[data-t]');
      if (tgB) { const k = tgB.dataset.t; s[k] = s[k] ? 0 : 1; G.Audio.unlock(); G.Audio.apply(); UI.render(); return; }
      const lb = e.target.closest('[data-l]');
      if (lb) { s.lang = lb.dataset.l; buildTabs(); document.documentElement.lang = s.lang; UI.render(); return; }
      if (e.target.closest('[data-exp]')) { $('#saveBox').value = G.exportSave(); return; }
      if (e.target.closest('[data-copy]')) {
        const v = $('#saveBox').value || G.exportSave(); $('#saveBox').value = v;
        const ok = () => UI.toast(esc(t('copied')), '', 'ic_scroll');
        try { navigator.clipboard.writeText(v).then(ok, () => { $('#saveBox').select(); }); } catch (err) { $('#saveBox').select(); }
        return;
      }
      if (e.target.closest('[data-imp]')) {
        const v = $('#saveBox').value.trim();
        if (!v || !G.importSave(v)) { UI.toast(esc(t('badSave')), '', 'ic_skull'); return; }
        UI.toast(esc(t('imported')), 'ach', 'ic_scroll'); buildTabs(); UI.render(); return;
      }
      if (e.target.closest('[data-save]')) { G.save(); UI.toast(esc(t('saved')), '', 'ic_scroll'); return; }
      const rb = e.target.closest('[data-reset]');
      if (rb) {
        if (!resetArm) { resetArm = 1; rb.textContent = t('resetConfirm'); return; }
        resetArm = 0; G.hardReset(); buildTabs(); tab = 'upg'; UI.render();
      }
    });
    $('#vol').addEventListener('input', e => { s.vol = +e.target.value; G.Audio.unlock(); G.Audio.apply(); });
  };

  // ---------- Toasts, banner, modal ----------
  // Toasts queue up and show at most two at a time so they never bury the stage.
  const toastQ = [];
  function pumpToasts() {
    const box = $('#toasts');
    while (toastQ.length && box.children.length < 2) {
      const tt = toastQ.shift();
      const el = document.createElement('div');
      el.className = 'toast ' + (tt.cls || '');
      el.innerHTML = (tt.iconId ? img(tt.iconId, '', 3) : '') + `<span>${tt.html}</span>`;
      box.appendChild(el);
      setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.remove(); pumpToasts(); }, 260); }, toastQ.length > 2 ? 1400 : 2400);
    }
  }
  UI.toast = function (html, cls, iconId) {
    if (toastQ.length > 8) toastQ.splice(0, toastQ.length - 8);
    toastQ.push({ html, cls, iconId });
    pumpToasts();
  };
  let bannerT = null;
  UI.banner = function (it) {
    const el = $('#banner'), r = G.RARITIES[it.r];
    const title = it.r === 6 ? t('divineLoot') : it.r === 5 ? t('mythicLoot') : t('legendLoot');
    el.innerHTML = `<div class="inner" style="color:${r.color}"><h2>${esc(title)}</h2><img class="ico" src="${ic('it_' + it.id, 10)}" alt=""><p>${esc(L(it.name))}</p></div>`;
    el.hidden = false; el.classList.remove('out');
    clearTimeout(bannerT);
    bannerT = setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.hidden = true; }, 400); }, it.r >= 6 ? 2600 : 1700);
  };
  UI.modal = function (title, html, actions) {
    const m = $('#modal');
    m.innerHTML = `<div class="box" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h2>${esc(title)}</h2>${html}<div class="acts">${(actions || []).map((a, i) => `<button class="btn ${a.cls || ''}" data-a="${i}">${esc(a.label)}</button>`).join('')}</div></div>`;
    m.hidden = false;
    const close = () => { m.hidden = true; m.innerHTML = ''; };
    m.onclick = e => {
      const b = e.target.closest('[data-a]');
      if (b) { const a = actions[+b.dataset.a]; close(); a.fn && a.fn(); }
      else if (e.target === m) close();
    };
    const first = m.querySelector('[data-a]'); if (first) first.focus();
  };
  UI.offline = function (r) {
    if (!r) return;
    const html = `<p>${esc(t('awayFor', G.fmtTime(r.sec)))}</p>
      <div class="sumList">
        <div>${img('ic_coin', '', 3)}<span style="color:var(--gold)">+${fmt(r.gold)}</span></div>
        ${r.chests ? `<div>${img('ic_chest', '', 3)}<span>${esc(t('foundChests'))}: ${fmt(r.chests)}</span></div>` : ''}
        ${r.ess >= 0.1 ? `<div>${img('ic_ess', '', 3)}<span style="color:var(--ess)">+${fmt(r.ess, true)}</span></div>` : ''}
      </div>`;
    UI.modal(t('welcomeBack'), html, [{ label: t('collect'), cls: 'gold' }]);
  };
})(globalThis.G = globalThis.G || {});
