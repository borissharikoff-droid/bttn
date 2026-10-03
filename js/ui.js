// BTTN — DOM interface: resources, tabs, lists, constellation, collection,
// pets, quests, achievements, ascension, settings, toasts and modals.
(function (G) {
  'use strict';
  const UI = G.UI = {};
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ic = (id, sc, o) => G.SPR.url(id, sc || 4, o);
  // each icon carries its sprite's size, so it can be shown at a whole multiple of it (see snapPixels)
  const sprW = id => { try { const c = G.SPR.get(id); return c ? c.width + 'x' + c.height : ''; } catch (e) { return ''; } };
  const img = (id, cls, sc, o) => `<img src="${ic(id, sc, o)}" alt="" class="${cls || ''}" data-b="${typeof id === 'string' ? sprW(id) : ''}" draggable="false">`;
  // Pixel art only looks right at whole multiples: snap every icon's CSS size to the nearest one that fits
  // (measured by layout, not by the screen box, so an icon caught mid-animation isn't snapped at its scaled size;
  // all the reads come before all the writes, so a tab full of icons lays out once, not once per icon)
  function snapPixels(root) {
    const ims = [...(root || document).querySelectorAll('img[data-b]:not([data-snap])')];
    if (!ims.length) return;
    for (const im of ims) { im.style.width = ''; im.style.height = ''; }
    const dpr = window.devicePixelRatio || 1;
    const ws = ims.map(im => im.offsetParent ? parseFloat(getComputedStyle(im).width) || 0 : 0);
    ims.forEach((im, i) => {
      const [bw, bh] = (im.dataset.b || '').split('x').map(Number), w = ws[i];
      if (!bw || !bh || !w) return;
      // whole screen pixels per art pixel, so no pixel comes out wider than its neighbour
      const wd = w * dpr;
      let k = Math.round(wd / bw);
      if (k * bw > wd * 1.2) k = Math.floor(wd / bw);
      k = Math.max(1, k);
      im.style.width = k * bw / dpr + 'px'; im.style.height = k * bh / dpr + 'px';
      im.dataset.snap = '1';
    });
  }
  // a new layout (a turned phone, a resized window, another screen) sizes icons afresh
  function resnap() {
    for (const im of document.querySelectorAll('img[data-snap]')) { im.style.width = ''; im.style.height = ''; delete im.dataset.snap; }
    snapPixels();
  }
  let resnapT = 0;
  window.addEventListener('resize', () => { clearTimeout(resnapT); resnapT = setTimeout(resnap, 150); });
  // new icons are snapped before they're painted, not a moment later
  let snapQ = false;
  if (typeof MutationObserver !== 'undefined') new MutationObserver(() => { if (!snapQ) { snapQ = true; requestAnimationFrame(() => { snapQ = false; snapPixels(); }); } })
    .observe(document.documentElement, { childList: true, subtree: true });
  UI.snapPixels = snapPixels;
  // 2.3: the Torment dial: shows once the first land is conquered
  function updateTorment() {
    const el = $('#torment'); if (!el || !G.S) return;
    const mx = G.tormentMax(), T = G.torment(true), busy = !!(G.R.boss || G.R.rift);
    // (on a phone the boss's bar takes its place at the top while the fight is on)
    el.hidden = mx < 1 || (busy && window.innerWidth < 700);
    if (el.hidden) return;
    setText($('#tormentN'), t('tormentN', T.n, mx));
    el.classList.toggle('on', T.n > 0);
    const [lo, hi] = el.querySelectorAll('button');
    lo.disabled = busy || T.n <= 0; hi.disabled = busy || T.n >= mx;
    const tip = (T.n ? t('tormentTip', T.n, '×' + T.mobHp.toFixed(2), '×' + T.bite.toFixed(2), '×' + T.bossHp.toFixed(2), '×' + T.gold.toFixed(2), '×' + T.xp.toFixed(2), '+' + Math.round((T.drop - 1) * 100) + '%') + (T.rarity ? ' ' + t('tormentRar', T.rarity) : '') : t('tormentZero')) + ' ' + t('tormentMore') + (busy ? ' ' + t('tormentBusy') : '');
    if (el.title !== tip) el.title = tip;
  }
  const fmt = G.fmt, t = G.t, L = G.L;

  let tab = 'upg', buyAmt = 1, selNode = 'spark', selItem = null, ascArm = 0, resetArm = 0, selWho = -1;
  let refs = {}, lastText = new WeakMap();
  const setText = (el, s) => { if (el && lastText.get(el) !== s) { el.textContent = s; lastText.set(el, s); } };
  const setClass = (el, c, on) => { if (el && el.classList.contains(c) !== !!on) el.classList.toggle(c, !!on); };

  const TABS = [
    { id: 'upg', icon: 'ic_rune', unlock: () => true },
    { id: 'hero', icon: 'ic_sword', unlock: () => true },
    { id: 'heroes', icon: 'h_knight', unlock: S => S.goldTotal >= 40 || S.ascensions > 0 },
    { id: 'coll', icon: 'ic_bag', unlock: S => S.st.chests >= 1 },
    { id: 'quests', icon: 'ic_scroll', unlock: S => S.st.chests >= 5 || S.ascensions > 0 },
    { id: 'stars', icon: 'ic_star', unlock: S => S.essRun >= 1 || Object.keys(S.nodes).length > 0 || S.ascensions > 0 },
    { id: 'pets', icon: 'egg_2', unlock: S => S.eggs > 0 || Object.keys(S.pets).length > 0 },
    { id: 'ach', icon: 'ic_trophy', unlock: S => Object.keys(S.ach).length > 0 },
    { id: 'asc', icon: 'ic_tomb', unlock: S => S.maxDepth >= 15 || S.ascensions > 0 || S.fameTotal > 0 },
    { id: 'rift', icon: 'ic_rift', unlock: S => S.bestDepth >= 5 || S.rift.runs > 0 },
    { id: 'ladder', icon: 'ic_crown', unlock: () => true },
    { id: 'set', icon: 'ic_gear', unlock: () => true },
  ];
  const tabOpen = id => { const d = TABS.find(x => x.id === id); return d && d.unlock(G.S); };
  // 3.0: the panel keeps only the Upgrades (and Settings); every other page lives in a town building
  const BLDS = {
    forge: { npc: 'npc_smith', subs: ['forge'] }, enchant: { npc: 'npc_witch', subs: ['enchant', 'gamble'] }, alch: { npc: 'npc_alch', subs: ['alch'] },
    tavern: { npc: 'npc_keeper', subs: ['tavern', 'hero', 'ladder'] },
    barracks: { npc: 'npc_keeper', subs: ['heroes'], sub: 'twBarracksSub' }, museum: { npc: 'npc_sage', subs: ['coll', 'ach'], sub: 'twMuseumSub' },
    quests: { npc: 'npc_keeper', subs: ['quests'], sub: 'twBoardSub' }, stars: { npc: 'npc_sage', subs: ['stars'], sub: 'twObsSub' },
    pets: { npc: 'npc_alch', subs: ['pets'], sub: 'twNestSub' }, temple: { npc: 'npc_sage', subs: ['asc'], sub: 'twTempleSub' },
    rift: { npc: 'npc_witch', subs: ['rift'], sub: 'twRiftSub' },
  };
  const BLD_ORDER = ['forge', 'enchant', 'alch', 'tavern', 'barracks', 'museum', 'quests', 'stars', 'pets', 'temple', 'rift'];
  const BLD_SPR = { forge: 'tw_forge', enchant: 'tw_tower', alch: 'tw_alch', tavern: 'tw_tavern', barracks: 'tw_barracks', museum: 'tw_museum', quests: 'tw_board', stars: 'tw_obs', pets: 'tw_nest', temple: 'tw_temple', rift: 'tw_rift' };
  const CUSTOM = { forge: 1, enchant: 1, gamble: 1, alch: 1, tavern: 1 };
  const TAB_BLD = {}; Object.keys(BLDS).forEach(b => BLDS[b].subs.forEach(x => { TAB_BLD[x] = b; }));
  const subOpen = x => !!CUSTOM[x] || tabOpen(x);
  const bldOpen = id => !!BLDS[id] && BLDS[id].subs.some(subOpen);
  G.bldOpen = bldOpen;
  // a page shown in a town window (its renderer and updater run there), or null
  let wtab = null;
  const curTab = () => wtab || (G.R && G.R.town && tab !== 'set' ? 'towndir' : tab);

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
    bindPartyHud();
    bindKeys();
    listen();
    tab = 'upg';
    S.seen.tabs.upg = 1; S.seen.tabs._u_upg = 1;
    UI.render();
    UI.update(true);
    $('#perks').addEventListener('click', e => { if (performance.now() - (+$('#perks').dataset.shownAt || 0) < 600) return; const c = e.target.closest('[data-perk]'); if (c && G.pickPerk(c.dataset.perk)) { G.Audio && G.Audio.buy(); UI.update(true); } });
    if (G.Tut) G.Tut.init();
    if (!S.hero.cls) setTimeout(() => UI.pickClass(), 300);
  };
  // the page in view: the Forge and Enchanter count as the Party page, for the tips that point there
  // the chapter card (waits for a relic show or another window to finish)
  UI.chapter = function (li) {
    if (!$('#modal').hidden || (G.relicShow && G.relicShow()) || G.R.boss) { setTimeout(() => UI.chapter(li), 1500); return; }
    const nx = G.REALMS[li + 1], d = (li + 2) * G.REALM_SIZE - 1;
    const opened = [];
    const tm = G.tormentMax ? G.tormentMax() : 0;
    if (tm) opened.push(t('tormentCard', tm));
    UI.modal(t('chTitle', li + 1, G.REALMS[li].name), `<div class="chapter"><p class="story">${esc(t('ch_' + li))}</p>
      ${opened.length ? `<p><b>${esc(t('chOpen'))}:</b> ${esc(opened.join(' · '))}</p>` : ''}
      <p class="next">${esc(nx ? t('chNext', G.bossName(d), nx.name, d + 1) : t('chEnd'))}</p></div>`, [{ label: t('chGo'), cls: 'gold' }]);
    G.Audio && G.Audio.achievement && G.Audio.achievement();
  };
  UI.rankText = x => t(x.k, x.tg || (x.cd ? x.cd.toFixed(1) : Math.round((x.spd || x.hp || x.dmg) * 100)));
  G.on('rankUp', x => UI.toast(`<b>${esc(t('rankUp'))}</b>&nbsp;${esc(t('lvl'))} ${x.lv}: ${esc(UI.rankText(x))}`, 'ach', 'ic_star'));
  UI.tab = () => (tw.id === 'forge' || tw.id === 'enchant' ? 'hero' : curTab());
  UI.townId = () => tw.id;
  UI.bldOf = id => TAB_BLD[id] || null;
  // the game's own link, for the brag line
  G.SHARE_URL = 'https://claude.ai/artifact/WcSxtLrabwMuEt2YcyxpWh';
  G.uiBusy = () => !$('#modal').hidden || !$('#intro').hidden;

  // ---------- The Hand's powers: three buttons with their cooldowns ----------
  function updatePowers() {
    const el = $('#powers'), h = G.S.hero;
    if (!el) return;
    el.hidden = !(h && h.cls);
    if (el.hidden) return;
    if (!el.children.length) {
      el.innerHTML = Object.keys(G.POWERS).map(id => { const P = G.POWERS[id]; return `<button class="pw" data-pw="${id}" title="${esc(t('pw_' + id) + ' (' + P.key + '): ' + t('pw_' + id + '_d'))}" aria-label="${esc(t('pw_' + id))}">${img(P.icon, '', 3)}<i></i><kbd>${P.key}</kbd></button>`; }).join('')
        + (G.overdrive ? `<button class="pw od" data-od title="${esc(t('odName') + ' (V): ' + t('odDesc'))}" aria-label="${esc(t('odName'))}">${img(G.SPR.defs.ic_bolt ? 'ic_bolt' : 'ic_star', '', 3)}<i></i><kbd>V</kbd></button>` : '');
      el.addEventListener('click', e => {
        if (e.target.closest('[data-od]')) { G.Audio.unlock(); if (!G.overdrive('tap')) G.Audio.error(); return; }
        const b = e.target.closest('[data-pw]'); if (b && !G.usePower(b.dataset.pw)) G.Audio.error();
      });
    }
    const odB = el.querySelector('[data-od]');
    if (odB) {
      const o = G.odState(), on = o.t > 0;
      odB.querySelector('i').style.height = (on ? 0 : (1 - o.m) * 100) + '%';
      setClass(odB, 'ready', G.odReady()); setClass(odB, 'on', on);
    }
    for (const b of el.querySelectorAll('[data-pw]')) {
      const id = b.dataset.pw, cd = G.R.pw[id] || 0, tot = G.POWERS[id].cd;
      b.querySelector('i').style.height = (cd > 0 ? cd / tot * 100 : 0) + '%';
      setClass(b, 'ready', !(cd > 0));
    }
  }
  // ---------- A sudden event: its name, its clock and how it's going ----------
  let evIcoK = null;
  function updateEventBar() {
    const R = G.R, ev = R.ev, row = $('#evRow');
    row.hidden = !ev;
    if (!ev) return;
    const e = G.EV_BY_ID[ev.k];
    if (evIcoK !== ev.k) { evIcoK = ev.k; $('#evIco').src = ic(e.icon, 2); $('#evWrap').style.setProperty('--ev', e.col); }
    $('#evMeter').style.width = Math.max(0, ev.t / ev.T) * 100 + '%';
    let more = '';
    if (ev.k === 'goblins') more = t('evGoblins', ev.ids.filter(id => !R.mobs.some(m => m.id === id)).length, ev.ids.length);
    else if (ev.k === 'ambush') more = t('evAmbush', ev.ids.filter(id => R.mobs.some(m => m.id === id)).length);
    else if (ev.k === 'chestrain') more = t('evRain', ev.n);
    else if (ev.k === 'stampede') more = t('evHold');
    else if (ev.k === 'meteors') more = t('evTap');
    else if (ev.k === 'portals') more = t('evPortals', (ev.por || []).length);
    else if (ev.k === 'warlord') { const w = G.R.mobs.find(m => m.wl); more = w ? Math.ceil(w.hp / w.max * 100) + '%' : ''; }
    setText($('#evText'), e.name + ' · ' + Math.ceil(Math.max(0, ev.t)) + 's' + (more ? ' · ' + more : ''));
  }
  // ---------- The party on the field: a chip per unit, tap a fallen one to raise them ----------
  let phKey = '';
  function updatePartyHud() {
    const el = $('#partyHud'), h = G.S.hero;
    // 3.4: the team is always on show, from the first minute: the Warden, each companion, and the empty seats
    // (an open one pulses with a +, a locked one says the depth that opens it)
    const units = h && h.cls ? G.partyUnits() : [];
    el.hidden = !units.length || (G.S.tut >= 0 && G.S.tut < 3);
    if (!units.length) return;
    const slots = G.partySlots ? G.partySlots() : 0, seats = [];
    for (let k = G.S.party.length; k < 3; k++) seats.push(k < slots ? 'open' : 'lock');
    const key = units.map(u => u.cls + JSON.stringify(u.eq && G.SLOTS.map(s => u.eq[s] ? u.eq[s].id + (u.eq[s].q || '') : ''))).join('|') + '|' + seats.join(',');
    if (key !== phKey) {
      phKey = key;
      el.innerHTML = units.map(u => `<button class="pchip r_${u.role}" data-who="${u.who}" aria-label="${esc(u.who < 0 ? t('wardenName') : L(G.CLASS_BY_ID[u.cls].name))}"><img src="${G.Doll.portrait({ cls: u.cls, eq: u.eq }, 2, true)}" alt=""><i><u></u></i><b></b></button>`).join('')
        + seats.map((s, k) => s === 'open' ? `<button class="pseat open" data-seat title="${esc(t('seatOpen'))}">+</button>` : `<button class="pseat lock" data-seatlock title="${esc(t('recruitAt', G.PARTY_AT[G.S.party.length + k]))}">${img('ic_key', '', 2)}<small>D${G.PARTY_AT[G.S.party.length + k] + 1}</small></button>`).join('');
    }
    const chips = el.children, rate = G.reviveRate ? G.reviveRate() : 1;
    el.title = t('partyHint');
    units.forEach((u, i) => {
      const c = chips[i]; if (!c) return;
      const down = u.down > 0, k = Math.max(0, Math.min(1, u.hp / (u.max || 1)));
      setClass(c, 'down', down);
      setClass(c, 'low', !down && k < 0.35);
      // a hit shows as a red flash on the chip
      if (c._k != null && k < c._k - 0.02) { c.classList.remove('hit'); void c.offsetWidth; c.classList.add('hit'); }
      c._k = k;
      c.querySelector('u').style.width = (down ? 0 : k * 100) + '%';
      setText(c.querySelector('b'), down ? Math.ceil(u.down / rate) + 's' : '');
    });
  }
  function bindPartyHud() {
    $('#partyHud').addEventListener('click', e => {
      if (e.target.closest('[data-seat]')) { G.Audio.unlock(); if (G.enterTown()) UI.townOpen('tavern'); else UI.toast(esc(t('townNo')), '', 'ic_tomb'); return; }
      if (e.target.closest('[data-seatlock]')) { UI.teamCard(); return; }
      const c = e.target.closest('.pchip'); if (!c) return;
      const who = +c.dataset.who;
      if (G.reviveTap(who)) { G.Audio.click(0, false); return; }
      // a standing unit: open their page in the Party tab
      selWho = who; selGear = null; tw.who = who;
      if (G.R.town) UI.townOpen('forge'); else UI.toast(esc(t('chipTown')), '', 'ic_sword');
    });
    $('#btnFold').addEventListener('click', () => { $('#app').classList.toggle('fold'); $('#btnFold').textContent = $('#app').classList.contains('fold') ? '▴' : '▾'; setTimeout(() => G.Stage && G.Stage.resize && G.Stage.resize(), 0); });
  }
  UI.unfold = function () { if ($('#app').classList.contains('fold')) { $('#app').classList.remove('fold'); $('#btnFold').textContent = '▾'; setTimeout(() => G.Stage && G.Stage.resize && G.Stage.resize(), 0); } };

  const NAV = [{ id: 'upg', icon: 'ic_rune', k: 'tab_upg' }, { id: 'town', icon: 'ic_town', k: 'tab_towndir' }, { id: 'set', icon: 'ic_gear', k: 'tab_set' }];
  function buildTabs() {
    const nav = $('#tabs');
    nav.classList.add('slim');
    nav.innerHTML = NAV.map(x => `<button class="tab" data-tab="${x.id}" aria-label="${esc(t(x.k))}" title="${esc(t(x.k))}">${img(G.SPR.defs[x.icon] ? x.icon : 'ic_tomb', '', 3)}<b>${esc(t(x.k))}</b><span class="dot" hidden></span></button>`).join('');
    if (nav._bound) return;
    nav._bound = true;
    nav.addEventListener('click', e => {
      const b = e.target.closest('.tab'); if (!b) return;
      const id = b.dataset.tab;
      G.Audio.unlock();
      UI.unfold();
      if (id === 'town') {
        if (G.R.town) { if (tab === 'set') { tab = 'upg'; UI.render(); } return; }
        if (!G.enterTown()) { G.Audio.error(); UI.toast(esc(t('townNo')), '', 'ic_tomb'); }
        return;
      }
      if (id === 'upg' && G.R.town) { G.leaveTown(); tab = 'upg'; UI.render(); return; }
      UI.go(id);
    });
  }
  UI.go = function (id) {
    if (UI.unfold) UI.unfold();
    ascArm = 0; resetArm = 0;
    if (!TAB_BLD[id]) {
      if (id === 'set' && wtab) UI.townClose(true);
      tab = id === 'set' ? 'set' : 'upg';
      G.S.seen.tabs[tab] = 1;
      UI.render();
      $('#tabBody').scrollTop = 0;
      return;
    }
    // any other page: walk into town and open its building
    if (!G.R.town && !G.enterTown()) { G.Audio.error(); UI.toast(esc(t('townNo')), '', 'ic_tomb'); return; }
    UI.townOpen(TAB_BLD[id], id);
  };

  function bindHud() {
    // (phones have less to spare: a smaller Horde at most)
    if (window.innerWidth < 700) G.TUNE.mobMax = Math.min(G.TUNE.mobMax, 750);
    bindTown();
    $('#btnTown').addEventListener('click', () => { G.Audio.unlock(); if (G.R.town) G.leaveTown(); else if (!G.enterTown()) { G.Audio.error(); UI.toast(esc(t('townNo')), '', 'ic_tomb'); } });
    G.on('town', on => { if (!on) UI.townClose(true); document.getElementById('app').classList.toggle('inTown', on); if (tab === 'set') tab = 'upg'; UI.render(); });
    $('#torment').addEventListener('click', e => { const b = e.target.closest('[data-tm]'); if (!b) return; G.Audio.unlock(); if (G.setTorment((G.S.torment || 0) + +b.dataset.tm)) { G.Audio.buy(); updateTorment(); } else G.Audio.error(); });
    $('#realmBox').addEventListener('click', () => { if (G.S.hero && G.S.hero.cls) UI.worldMap(); });
    $('#realmBox').addEventListener('keydown', e => { if (e.key !== 'Enter' && e.key !== ' ') return; e.preventDefault(); e.stopPropagation(); if (G.S.hero && G.S.hero.cls) UI.worldMap(); });
    $('#btnSound').addEventListener('click', () => { G.S.set.sound = G.S.set.sound ? 0 : 1; G.Audio.unlock(); G.Audio.apply(); UI.update(true); });
    $('#btnMusic').addEventListener('click', () => { G.S.set.music = G.S.set.music ? 0 : 1; G.Audio.unlock(); G.Audio.apply(); UI.update(true); });
    $('#btnSound img').src = ic('ic_note', 3);
    $('#btnTown img').src = ic(G.SPR.defs.ic_town ? 'ic_town' : 'ic_tomb', 3);
    // 2.4: every bar at the bottom says what it is: an icon, and a tip on hover
    $$('[data-mico]').forEach(im => { im.src = ic(im.dataset.mico, 2); });
    [['#bossWrap', 'tipClear'], ['#hpWrap', 'tipHp'], ['#chestWrap', 'tipChest'], ['#comboWrap', 'tipCombo'], ['#btnAbil', 'tipAbil']].forEach(([sel, k]) => { const el = $(sel); if (el) el.title = t(k); });
    $('#btnMusic img').src = ic('ic_echo', 3);
    $('#btnFight').addEventListener('click', () => { G.Audio.unlock(); G.startBoss(); });
    $('#btnRetreat').addEventListener('click', () => { if (G.R.rift) G.riftEnd(false, 'left'); else G.fleeBoss(); });
    $('#btnRift').addEventListener('click', () => { G.Audio.unlock(); UI.go('rift'); });
    $('#btnAbil').addEventListener('click', () => { G.Audio.unlock(); if (!G.castAbility()) G.Audio.error(); });
  }

  function bindKeys() {
    window.addEventListener('keydown', e => {
      const tg = e.target;
      if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.isContentEditable)) return;
      // Ctrl+C copies, it doesn't Mend
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') {
        if (tg && tg.tagName === 'BUTTON' && e.code !== 'Space') return;
        e.preventDefault();
        // a held key repeats at Steady Hand's rate (none without it)
        if (e.repeat) UI._holdKeyT = performance.now();
        if (e.repeat) { const hr = G.D.holdRate || 0; if (!G.S.set.hold || hr <= 0 || performance.now() - (UI._holdT || 0) < 1000 / hr) return; UI._holdT = performance.now(); }
        G.Stage.keyClick();
      } else if (e.code === 'KeyE' || e.code === 'KeyF') { G.Stage.keyChest(); }
      else if (e.code === 'KeyB') { G.startBoss(); }
      else if (/^Digit[1-3]$/.test(e.code) && !$('#perks').hidden) {
        // 3.0: 1, 2, 3 pick a level-up card
        const c = $$('#perks [data-perk]')[+e.code.slice(5) - 1];
        if (c && G.pickPerk(c.dataset.perk)) { G.Audio && G.Audio.buy(); UI.update(true); }
      }
      else if (e.code === 'KeyV') { if (!G.uiBusy() && G.overdrive && !G.overdrive('key')) G.Audio.error(); }
      else if (e.code === 'KeyQ') { G.castAbility(); }
      else if (e.code === 'KeyT') { if (G.uiBusy()) return; if (G.R.town) G.leaveTown(); else if (!G.enterTown()) { G.Audio.error(); UI.toast(esc(t('townNo')), '', 'ic_tomb'); } }
      else if (e.code === 'Escape' && G.R.town && !G.uiBusy()) { if (!$('#townWin').hidden) UI.townClose(); else G.leaveTown(); }
      else if (e.code === 'KeyZ') { if (!G.uiBusy()) G.usePower('smite'); }
      else if (e.code === 'KeyX') { if (!G.uiBusy()) G.usePower('ward'); }
      else if (e.code === 'KeyC') { if (!G.uiBusy()) G.usePower('mend'); }
    });
  }

  // ---------- Events ----------
  function listen() {
    G.on('achievement', a => { UI.toast(`<span>${esc(t('achievement'))}: <b>${esc(L(a.name))}</b></span>`, 'ach', 'ic_trophy'); if (curTab() === 'ach') UI.render(); });
    G.on('questDone', q => UI.toast(`<b>${esc(t('questDone'))}</b>`, '', 'ic_scroll'));
    G.on('landStar', (i, bit, n) => { zoneKey = ''; UI.toast(`<span><b style="color:#ffd84a">\u2605 ${esc(G.REALMS[i].name)} · ${esc(t('starName_' + bit))}</b><br><small>${esc(t('starBonus', n === 1 ? t('star1') : t('starsN', n), '+' + +(n * G.STAR_BONUS * 100).toFixed(1) + '%'))}</small></span>`, 'ach', 'ic_star'); });
    G.on('realm', r => UI.toast(`<span>${esc(t('newLands', G.realmName(G.S.depth)))} · <b>${esc(G.REALMS[r].rule)}</b></span>`, 'ach', 'ic_star'));
    G.on('potion', p => UI.toast(`<span>${esc(t('potionDrink', L(p.name)))} <b>${esc(p.short)} ${G.S.pots[p.id]}/${G.D.potCap}</b></span>`, '', 'pot_' + p.id));
    G.on('jackpot', (m, gold) => UI.toast(`<b>${esc(t('jpToast', fmt(gold)))}</b>`, 'ach', 'ic_jackpot'));
    G.on('chestOpen', loot => {
      if (loot.source === 'offline') return;
      if (!loot.items.length) return; // a little chest of coin
      const top = loot.items.reduce((a, b) => (b.it.r > a.it.r ? b : a), loot.items[0]);
      if (top.it.r >= 4 && (top.isNew || top.it.r >= 6)) UI.banner(top.it);
      else if (top.isNew) UI.toast(`<span style="color:${G.RARITIES[top.it.r].color}">${esc(L(top.it.name))}</span>&nbsp;<b>${esc(t('newPet'))}</b>`, '', 'it_' + top.it.id);
      dirtyTab('coll'); dirtyTab('quests');
    });
    G.on('bossWin', (rew) => {
      dirtyTab('quests'); dirtyTab('asc');
      // 3.0: a land's lord falls for the first time: its chapter of the story, and where the road goes next
      if (rew && rew.lord && !G.R.rift) {
        const li = G.realmIndex(rew.d), sn = G.S.seen = G.S.seen || {}; sn.ch = sn.ch || {};
        if (!sn.ch[li]) { sn.ch[li] = 1; setTimeout(() => UI.chapter(li), 2600); }
      }
      // a land conquered opens the next Torment level
      const mx = G.tormentMax(), sn = G.S.seen = G.S.seen || {};
      if (mx > (sn.tmax || 0)) { sn.tmax = mx; UI.toast(esc(t('tormentOpen', mx)), 'ach', 'ic_skull'); updateTorment(); }
    });
    G.on('torment', () => updateTorment());
    // 3.0: a wipe says why, in one line, and what to do about it
    G.on('wipe', (from, to, rift, boss) => {
      const S = G.S, h = S.hero;
      let k = 'wipeWhy_up';
      if (G.partySlots && G.partySlots() > S.party.length) k = 'wipeWhy_seat';
      else if (h.bag.some(g => { const sl = G.slotOf(g.id); return G.powerWith(sl, g, -1) > G.powerWith(sl, h.eq[sl], -1); })) k = 'wipeWhy_gear';
      else if (boss) k = 'wipeWhy_boss';
      setTimeout(() => UI.toast(`<span><b>${esc(t('wipeWhy'))}</b> ${esc(t(k))}</span>`, '', 'ic_skull'), 1800);
    });
    G.on('pull', res => showPull(res));
    G.on('buy', (kind) => { if ((kind === 'hero' && curTab() === 'heroes') || (kind === 'upg' && curTab() === 'upg') || (kind === 'node' && curTab() === 'stars') || (kind === 'legacy' && curTab() === 'asc')) UI.update(true); if (kind === 'node' && curTab() === 'stars') UI.render(); });
    G.on('ascend', (g, death) => { if (g && !death) UI.toast(`<b>${esc(t('ascDone', fmt(g)))}</b>`, 'ach', 'ic_fame'); UI.render(); if (!G.S.hero.cls) setTimeout(() => UI.pickClass(), 400); });
    // 3.4: BUILD YOUR TEAM: when a seat opens (and from a locked seat on the party bar), a big card shows the five
    // classes and their roles, with a straight way to the Tavern
    UI.teamCard = function (slot) {
      if (!$('#modal').hidden || G.R.boss) { setTimeout(() => UI.teamCard(slot), 1500); return; }
      const S = G.S, n = G.partySlots ? G.partySlots() : 0, open = n > S.party.length;
      const m = UI.modal(t('teamTitle'), `<div class="teamCard">
        <p class="story">${esc(t('teamText'))}</p>
        <div class="teamRow">${G.CLASSES.map((c, i) => `<div class="teamCls" style="animation-delay:${0.08 * i}s">${img(c.spr, '', 6)}<b>${esc(L(c.name))}</b><small class="r_${G.ROLES[c.id]}">${esc(G.ROLE_NAMES[G.ROLES[c.id]])}</small></div>`).join('')}</div>
        <p class="note">${esc(t(open ? 'teamOpen' : 'teamNext', G.PARTY_AT[Math.min(2, n)] + 1))}</p></div>`,
        open ? [{ label: t('teamGo'), cls: 'gold', fn: () => { if (G.enterTown()) UI.townOpen('tavern'); } }, { label: t('later') }] : [{ label: t('close') }]);
      G.Audio && G.Audio.levelUp && G.Audio.levelUp();
      return m;
    };
    G.on('slotOpen', slot => setTimeout(() => UI.teamCard(slot), 1600));
    // 3.4: a huge plate at the start: YOU CAN HOLD SPACE (on a phone: HOLD THE BUTTON). It goes once the
    // player has held for a second and a half (or after a while), and comes back each session until they have
    UI.holdPlate = function () {
      const S = G.S;
      if ((S.seen && S.seen.hold) || $('#holdPlate')) return;
      const touch = matchMedia('(pointer: coarse)').matches;
      const el = document.createElement('div');
      el.id = 'holdPlate';
      el.innerHTML = `<div class="hpIn"><small>${esc(t('holdYouCan'))}</small><b>${esc(t(touch ? 'holdTouch' : 'holdKey'))}</b>
        <div class="hpArt">${touch ? `<img class="hpFinger" src="${ic('ic_finger', 6)}" alt="">` : `<span class="hpKey">SPACE</span>`}</div>
        <p>${esc(t('holdWhy'))}</p></div>`;
      $('#stageWrap').appendChild(el);
      let held = 0, life = 0;
      const iv = setInterval(() => {
        if (!el.isConnected) { clearInterval(iv); return; }
        const busy = !!(G.uiBusy() || G.R.town);
        el.classList.toggle('away', busy);
        if (busy) return;
        life += 0.1;
        const on = (G.Stage.isHolding && G.Stage.isHolding()) || performance.now() - (UI._holdKeyT || 0) < 250;
        held = on ? held + 0.1 : Math.max(0, held - 0.05);
        el.style.setProperty('--hk', Math.min(1, held / 1.5));
        el.classList.toggle('on', !!on);
        if (held >= 1.5 || life > 40) {
          if (held >= 1.5) { S.seen.hold = 1; G.dirty && G.dirty(); G.Audio && G.Audio.levelUp && G.Audio.levelUp(); el.classList.add('done'); }
          el.classList.add('out'); clearInterval(iv); setTimeout(() => el.remove(), 600);
        }
      }, 100);
    };
    G.on('classChosen', () => setTimeout(UI.holdPlate, 1200));
    setTimeout(() => { if (G.S.hero && G.S.hero.cls) UI.holdPlate(); }, 3000);
    // 3.3: a new run's blessings: three cards, after whatever window is up (the fall, a class pick) closes
    UI.blessCards = function () {
      const S = G.S, o = S.blessOffer;
      if (!o || !o.length) return;
      if (!$('#modal').hidden || !$('#intro').hidden || (G.relicShow && G.relicShow()) || !(S.hero && S.hero.cls)) { setTimeout(UI.blessCards, 600); return; }
      const m = UI.modal(t('blessTitle'), `<p class="note">${esc(t('blessHint'))}</p><div class="blessCards">${o.map(id => { const b = G.BLESS_BY_ID[id]; return `<button class="blessCard ${b.twist ? 'twist' : ''}" data-bless="${id}">${img(G.SPR.defs[b.icon] ? b.icon : 'ic_star', '', 5)}<b>${esc(b.name)}</b><small>${esc(b.desc)}</small>${b.twist ? `<em>${esc(t('blessTwist'))}</em>` : ''}</button>`; }).join('')}</div>`, [], true);
      m.querySelectorAll('[data-bless]').forEach(el => el.addEventListener('click', () => {
        if (G.chooseBlessing(el.dataset.bless)) { m.hidden = true; m.innerHTML = ''; G.Audio && G.Audio.levelUp && G.Audio.levelUp(); UI.toast(`<b>${esc(t('blessOn'))}</b>&nbsp;${esc(G.BLESS_BY_ID[el.dataset.bless].name)}`, 'ach', G.BLESS_BY_ID[el.dataset.bless].icon); UI.update(true); }
      }));
    };
    G.on('blessOffer', () => setTimeout(UI.blessCards, 1900));
    setTimeout(() => { if (G.S.blessOffer) UI.blessCards(); }, 2500);
    // 3.1: the Button fell: the run's tally, the fame it earned, and where the next one starts
    G.on('runOver', sum => setTimeout(() => {
      const m = UI.modal(t('fellTitle'), `<div class="fell">
        <p class="story">${esc(t('fellText'))}</p>
        <div class="fellStats"><span>${esc(t('fellDepth'))}</span><b>${sum.depth + 1}</b><span>${esc(t('fellTime'))}</span><b>${esc(G.fmtTime(sum.secs))}</b><span>${esc(t('fellLvl'))}</span><b>${sum.lvl}</b><span>${esc(t('fellGold'))}</span><b>${fmt(sum.gold)}</b></div>
        <p class="fellFame">${img('ic_fame', '', 3)} <b>+${fmt(sum.fame)}</b> ${esc(t('fame').toLowerCase())} <small>(${esc(t('fellTotal', fmt(sum.total)))})</small></p>
        <p class="note">${esc(t('fellKeep'))}</p>
        <p class="next">${esc(t('fellNext', G.realmName(sum.next), sum.next + 1))}</p></div>`,
        [{ label: t('fellAgain'), cls: 'gold' }, { label: t('fellSpend'), fn: () => { if (G.enterTown()) UI.townOpen('temple'); } }], true);
      return m;
    }, 1400));
    G.on('quests', () => dirtyTab('quests'));
    G.on('questClaim', () => { if (curTab() === 'quests') UI.render(); });
    G.on('daily', () => { if (curTab() === 'quests') UI.render(); });
    G.on('journey', (st, got) => { UI.toast(`<span><b>${esc(t('journeyDone'))}</b> · ${esc(st.text)}</span>&nbsp;${rewIcons(got)}`, 'ach', 'ic_trophy'); G.Audio && G.Audio.achievement(); if (curTab() === 'quests') UI.render(); });
    G.on('bounty', got => { UI.toast(`<span><b>${esc(t('bounty'))}</b> ✓</span>&nbsp;${rewIcons(got)}`, 'ach', 'ic_skull'); if (curTab() === 'quests') UI.render(); });
    G.on('evolve', id => {
      const E = G.EVOS[id];
      UI.bannerShow(`<div class="inner" style="color:#ffd84a"><h2>${esc(t('evoTitle'))}</h2><img class="ico" src="${ic(E.icon, 10)}" alt=""><p>${esc(E.name)}</p><p style="font-size:15px;color:#d8dce8">${esc(E.desc)}</p></div>`, 2600);
      G.Audio && G.Audio.achievement();
    });
    G.on('pets', () => { if (curTab() === 'pets') UI.render(); });
    G.on('ladder', () => { if (curTab() === 'ladder') updaters.ladder(); if (curTab() === 'rift') updaters.rift(); });
    G.on('net', () => { if (curTab() === 'ladder') updaters.ladder(); });
    G.on('cloudNewer', c => { const ask = () => { if ($('#modal').hidden) askCloud(c); else setTimeout(ask, 1500); }; setTimeout(ask, 1200); });
    G.on('pickup', (e, how, res) => {
      if (e.k === 'uq') { UI.bannerU(e.q, res && res.first); dirtyTab('coll'); dirtyTab('hero'); return; }
      if (e.k !== 'gear' || !res) return;
      // the big banner is for news: a first find, a divine, or an upgrade the Warden put on
      if (e.it.r >= 4 && (res.isNew || e.it.r >= 6 || (res.g && G.SLOTS.some(s => G.S.hero.eq[s] === res.g)))) UI.banner(e.it);
      else if (res.isNew) UI.toast(`<span style="color:${G.RARITIES[e.it.r].color}">${esc(L(e.it.name))}</span>&nbsp;<b>${esc(t('newPet'))}</b>`, '', 'it_' + e.it.id);
      dirtyTab('coll');
    });
    G.on('riftEnd', r => {
      if (curTab() === 'rift') UI.render();
      if (r.win && r.lvl >= r.best && G.Net) G.Net.pushNow();
    });
    G.on('feed', () => { if (G.Net) setTimeout(() => G.Net.pushNow(), 1500); });
    G.on('crownTime', (d, secs) => {
      const N = G.Net, others = N ? N.entries.filter(e => !e.me && (e.ok) && e.cr && e.cr[d]) : [];
      const best = others.sort((a, b) => a.cr[d] - b.cr[d])[0];
      if (!best || secs < best.cr[d]) { UI.toast(`<b>${esc(t('crownTaken', G.bossName(d), secs))}</b>`, 'ach', 'ic_crown'); if (best) G.feed('crown', G.bossName(d)); }
      if (N) setTimeout(() => N.pushNow(), 1500);
    });
    G.on('first', k => {
      const f = G.FIRSTS.find(x => x[0] === k), N = G.Net;
      if (!f || !N || N.status !== 'online') return;
      // announce it only when no friend got there before you
      if (N.entries.length > 1 && !N.entries.some(e => !e.me && e.ok && e.fs && e.fs[k])) UI.toast(`<b>${esc(t('firstGot', f[1]))}</b>`, 'ach', 'ic_trophy');
      setTimeout(() => N.pushNow(), 2000);
    });
    G.on('rival', ev => UI.toast(esc(ev.up ? t('rivalUp', ev.name, ev.cat, ev.rank) : t('rivalDown', ev.name, ev.cat)), ev.up ? 'ach' : '', 'ic_crown'));
    G.on('gear', (g, equipped) => { if (equipped && (g.r >= 2 || g.q)) UI.toast(`<span>${esc(t('equipped'))}: <b style="color:${gearCol(g)}">${esc(gearName(g))}</b></span>`, '', G.gearSpr(g)); });
    G.on('levelUp', () => { const xb = $('#xpBar'); xb.classList.remove('up'); void xb.offsetWidth; xb.classList.add('up'); });
    G.on('buttonBreak', () => UI.toast(`<b>${esc(t('overload'))}</b> ${esc(t('overloadHint'))}`, '', 'ic_skull'));
  }
  const dirty = {};
  function dirtyTab(id) { dirty[id] = true; }

  // ---------- Update loop ----------
  let goalKey = '';
  let zoneKey = '';
  const goldHist = [];
  G.on('ascend', () => { goldHist.length = 0; });
  // The world map: every land, its zones and its three stars
  UI.worldMap = function () {
    UI.mapSeen = true;
    const S = G.S, here = G.realmIndex(S.depth), seen = Math.min(G.REALMS.length - 1, Math.floor(S.bestDepth / G.REALM_SIZE));
    const n = G.starCount ? G.starCount() : 0;
    const rows = G.REALMS.map((R_, i) => {
      const open = i <= seen || G.starsOf(i) > 0, rec = (S.lands && S.lands[i]) || { k: 0, s: 0 };
      const need = G.STAR_KILLS(i), st = rec.s | 0;
      const stars = [1, 2, 4].map(b => `<i class="${st & b ? 'on' : ''}" title="${esc(t('star_' + b, b === 2 ? fmt(need) : G.STAR_SWIFT))}">\u2605</i>`).join('');
      const head = i === 8 ? `<h3 class="wmHead">${esc(t('outerLands'))}</h3>` : '';
      if (!open) return head + `<div class="wmRow locked">${img(R_.fodder, '', 3, { dark: true })}<div><b>${esc(t('landLocked'))}</b><small>${esc(t('depth'))} ${i * G.REALM_SIZE + 1}–${(i + 1) * G.REALM_SIZE}</small></div><span class="lstars">${stars}</span></div>`;
      const cleared = S.bestDepth > i * G.REALM_SIZE + G.REALM_SIZE - 1;
      // the land you're in shows where you are now; the others how far you've ever got
      const zones = Array.from({ length: G.REALM_SIZE }, (_, zi) => R_.zones[G.ZONE_LOOK(zi)]).map((zn, zi) => { const d = i * G.REALM_SIZE + zi; const cls = i === here ? (zi < G.zoneOf(S.depth) ? 'done' : zi === G.zoneOf(S.depth) ? 'cur' : '') : d < S.bestDepth ? 'done' : ''; return `<span class="${cls} ${zi === G.REALM_SIZE - 1 ? 'lord' : ''}" title="${esc(zn)}"></span>`; }).join('');
      return head + `<div class="wmRow ${i === here ? 'here' : ''} ${cleared ? 'clear' : ''}">${img(R_.fodder, '', 3)}<div><b>${esc(R_.name)}${i === here ? ` <em>${esc(t('landHere'))}</em>` : ''}</b>
        <small>${esc(R_.rule)}: ${esc(R_.ruleDesc)}</small>
        <div class="wmZones">${zones}</div>
        <small>${esc(t('landKills', Math.min(rec.k | 0, need).toLocaleString('en-US'), Math.round(need).toLocaleString('en-US')))} · ${esc(R_.lordName)}</small></div><span class="lstars">${stars}</span></div>`;
    }).join('');
    UI.modal(t('worldMap'), `<p class="note">${esc(t('worldHint'))}</p><p class="note">${esc(t('starReqs', Math.round(G.STAR_KILLS(here)).toLocaleString('en-US'), G.STAR_SWIFT))}</p><p class="wmTotal">\u2605 ${n} / ${3 * G.REALMS.length} · +${+(n * G.STAR_BONUS * 100).toFixed(1)}%</p><div class="wmList">${rows}</div>`, [{ label: t('close') || 'Close', cls: '' }]);
  };
  function updateGoal() {
    const S = G.S, box = $('#goal');
    const on = !!(S.hero && S.hero.cls);
    box.hidden = !on;
    // the day's twist, and what it does
    setText($('#omenLine'), on ? t('omenLine', G.omen().name) + ' · ' + G.omen().desc : '');
    // (2.2: the omen lives in the land box's tooltip, off the field)
    updateTorment();
    const rb = $('#realmBox'), tip = on ? t('omenLine', G.omen().name) + ' · ' + G.omen().desc : '';
    if (rb && rb.title !== tip) rb.title = tip;
    // where you stand among friends, right on the play screen
    const N = G.Net, rl = $('#rivalLine');
    const list = on && N && N.entries.length > 1 ? N.sorted('depth') : [];
    const i = list.findIndex(e => e.me);
    rl.hidden = i < 0;
    if (i >= 0) {
      const up = list[i - 1], gap = up ? (up.depth || 0) - (list[i].depth || 0) : 0;
      setText(rl, up ? t('rivalAhead', i + 1, list.length, N.displayName(up) || t('anon'), gap === 1 ? t('rivalDepth1') : gap > 1 ? t('rivalDepths', gap) : fmt((up.power || 0) - (list[i].power || 0)) + ' ' + t('gearScore').toLowerCase()) : t('rivalTop', list.length));
    }
    if (!on) return;
    const p = G.Journey.progress();
    const key = (S.journey || 0) + '|' + p.st.text;
    if (key !== goalKey) {
      goalKey = key;
      box.innerHTML = `<b>${esc(t('goal'))}</b> <span>${esc(p.st.text)}</span> <em data-gp></em><i><u data-gb></u></i>`;
    }
    setText(box.querySelector('[data-gp]'), fmt(p.cur) + '/' + fmt(p.need));
    box.querySelector('[data-gb]').style.width = Math.min(100, p.cur / p.need * 100) + '%';
  }
  const rewIcons = got => got.map(([icon, n]) => `${img(icon, 'inl', 2)}${n > 1 ? fmt(n) : ''}`).join(' ');
  let perkKey = '';
  function updatePerks() {
    const h = G.S.hero, box = $('#perks');
    const offer = h && h.cls ? h.offer : null;
    const key = offer ? offer.join() + '|' + JSON.stringify(h.perks) : '';
    if (key !== perkKey) {
      perkKey = key;
      if (!offer) { box.hidden = true; box.innerHTML = ''; }
      else {
        box.innerHTML = `<h3>${esc(t('lvUp'))}</h3><div class="cards">${offer.map((id, i) => {
          if (id.startsWith('evo_')) {
            const E = G.EVOS[id.slice(4)];
            return `<button class="card evo" data-perk="${id}" style="animation-delay:${i * 0.07}s">${img(E.icon, '', 4)}<b>${esc(E.name)}</b><span class="lv">${esc(t('evoCard'))}</span><small>${esc(E.desc)}</small></button>`;
          }
          const P = G.PERKS[id], lv = h.perks[id] || 0;
          return `<button class="card" data-perk="${id}" style="animation-delay:${i * 0.07}s">${img(P.icon, '', 4)}<b>${esc(P.name)}</b><span class="lv">${esc(lv ? t('perkLv', lv + ' → ' + (lv + 1)) : t('perkNew'))}</span><small>${esc(P.desc)}</small></button>`;
        }).join('')}</div><p class="auto" data-auto></p>`;
        box.hidden = false; box.dataset.shownAt = performance.now();
      }
    }
    if (offer) setText(box.querySelector('[data-auto]'), (h.autoPerk ? t('perkAuto', Math.max(0, Math.ceil(12 - (h.offerT || 0)))) + ' · ' : '') + t('perkHint'));
  }
  let snapT = 0;
  UI.update = function (force) {
    const S = G.S, D = G.D, R = G.R;
    if (performance.now() - snapT > 250) { snapT = performance.now(); snapPixels(); }
    // the Town button: into town between fights, back to the field from it
    { const tb = $('#btnTown'); if (tb) { setText(tb.querySelector('b'), R.town ? t('townBack') : t('townBtn')); tb.classList.toggle('dim', !R.town && !G.townOk()); tb.classList.toggle('on', !!R.town);
      // it glows when the bag holds something better than what someone wears (checked once a second)
      if (performance.now() - (UI._upT || 0) > 1000) { UI._upT = performance.now(); UI._up = !!(S.hero && S.hero.cls) && [-1].concat((S.party || []).map((_, i) => i)).some(w => S.hero.bag.some(g => { const sl = G.slotOf(g.id); return canWear(g, w) && G.powerWith(sl, g, w) > G.powerWith(sl, G.eqOf(w)[sl], w); })); }
      tb.classList.toggle('glow', !R.town && UI._up && G.townOk()); tb.title = R.town ? t('townBackTip') : G.townOk() ? t('townTip') : t('townNo'); } }
    // (the Alchemist's prices follow the gold; the Forge redraws on what you do in it, never under your finger)
    if (R.town && tw.id === 'alch' && !tw.down && performance.now() - (UI._twT || 0) > 1500) { UI._twT = performance.now(); renderTown(); }
    // the gold number rolls toward the real value and bumps on a real gain
    const gShow = UI._gold == null ? S.gold : UI._gold + (S.gold - UI._gold) * 0.45;
    const now = performance.now();
    if (UI._goldLast != null && S.gold - UI._goldLast > Math.max(1, UI._goldLast * 0.05) && now - (UI._bumpT || 0) > 400) { UI._bumpT = now; const g = $('#goldNum'); g.classList.remove('bump'); void g.offsetWidth; g.classList.add('bump'); }
    UI._goldLast = S.gold;
    UI._gold = Math.abs(gShow - S.gold) < Math.max(1, S.gold * 0.001) ? S.gold : gShow;
    setText($('#goldNum'), fmt(UI._gold));
    // gold per second from everything (the Horde, clicks, the garrison), averaged over the last 10 seconds
    const nowS = performance.now() / 1000;
    if (!goldHist.length || nowS - goldHist[goldHist.length - 1][0] >= 1) { goldHist.push([nowS, S.goldTotal]); while (goldHist.length > 11) goldHist.shift(); }
    const g0 = goldHist[0], rate = goldHist.length > 2 && S.goldTotal >= g0[1] ? (S.goldTotal - g0[1]) / Math.max(1, nowS - g0[0]) : 0;
    setText($('#gpsNum'), fmt(Math.max(D.gps, rate), true));
    setText($('#clickNum'), fmt(D.click, true));
    setText($('#essNum'), fmt(S.essence, true));
    setText($('#eggNum'), fmt(S.eggs));
    setText($('#fameNum'), fmt(S.fame));
    $('#essChip').hidden = !tabOpen('stars');
    $('#eggChip').hidden = !(S.eggs > 0 || Object.keys(S.pets).length);
    $('#fameChip').hidden = !(S.fameTotal > 0);
    // Pages opening up: a toast names the building that now holds them
    for (const d of TABS) {
      if (!d.unlock(S) || S.seen.tabs['_u_' + d.id]) continue;
      S.seen.tabs['_u_' + d.id] = 1;
      const bd = TAB_BLD[d.id];
      if (bd && !CUSTOM[d.id] && d.id !== 'hero' && d.id !== 'ladder' && BLDS[bd].subs[0] === d.id) UI.toast(`<span>${esc(t('unlocked', t('town_' + bd)))}</span>`, '', d.icon);
    }
    // the panel's three buttons, and a mark on TOWN when something there wants you
    let canUpg = false;
    for (const u of G.UPGRADES) { const L_ = S.upg[u.id] || 0; if ((!u.max || L_ < u.max) && !u.secret && S.gold >= G.upgCost(u)) { canUpg = true; break; } }
    const pt = G.R.town && tab !== 'set' ? 'town' : tab;
    for (const x of NAV) { const b = $(`.tab[data-tab="${x.id}"]`); if (b) setClass(b, 'on', x.id === pt); }
    setClass($('.tab[data-tab="upg"]'), 'afford', canUpg);
    const ping = townPing();
    const td = $('.tab[data-tab="town"] .dot'); if (td && td.hidden === !!ping) td.hidden = !ping;
    setClass($('#btnTown'), 'ping', !!ping && !G.R.town);
    // HUD
    const realm = G.REALMS[G.realmIndex(S.depth)];
    // in a Rift the HUD names the Rift's land, not the campaign's
    const hd = R.rift ? R.rift.d : S.depth;
    setText($('#realmName'), G.realmName(hd));
    // where you are in this land: five zones, the last one the lord's
    const li = G.realmIndex(hd), z = G.zoneOf(hd);
    const zk = hd + '|' + (G.starsOf ? G.starsOf(li) : 0) + '|' + !!R.rift;
    if (zk !== zoneKey) {
      zoneKey = zk;
      let pips = '';
      for (let i = 0; i < G.REALM_SIZE; i++) pips += `<i class="${i < z ? 'done' : i === z ? 'cur' : ''} ${i === G.REALM_SIZE - 1 ? 'lord' : ''}"></i>`;
      $('#zonePips').innerHTML = pips;
      const n = G.starsOf ? G.starsOf(li) : 0;
      $('#landStars').innerHTML = [0, 1, 2].map(i => `<i class="${i < n ? 'on' : ''}">\u2605</i>`).join('');
    }
    $('#zonePips').hidden = !!R.rift;
    setText($('#zoneName'), R.rift ? t('riftName', R.rift.lvl) : G.ZONE_NAME(S.depth) + (innerWidth < 600 ? ' · ' + t('depthShort') + (S.depth + 1) : ''));
    if (R.rift) setText($('#realmSub'), t('riftName', R.rift.lvl) + ' · ' + t('depth') + ' ' + (R.rift.d + 1));
    else setText($('#realmSub'), t('depth') + ' ' + (S.depth + 1));
    const cm = $('#chestMeter');
    cm.style.width = Math.min(100, S.chestMeter / D.chestNeed * 100) + '%';
    const comboK = R.combo / (D.comboCap || 1);
    $('#comboMeter').style.width = Math.min(100, comboK * 100) + '%';
    setClass($('#comboWrap'), 'hot', comboK >= 1);
    setText($('#comboText'), t('comboLine', Math.floor(R.combo), (1 + R.combo * D.comboPer).toFixed(2)));
    setText($('#chestText'), t('chestLine', Math.floor(S.chestMeter / D.chestNeed * 100), S.chests.length, D.slots));
    const bossShown = !!(S.hero && S.hero.cls);
    setClass($('#stageWrap'), 'fighting', !!R.boss);
    $('#bossRow').hidden = !bossShown;
    $('#btnRift').hidden = !(bossShown && !R.boss && !R.rift && G.riftOpenable());
    if (bossShown && R.inv && !R.boss) {
      // an invasion: hold it off until its herald comes, then slay the herald
      const V = G.INV_BY_ID[R.inv.k], hb = R.inv.boss ? R.mobs.find(m => m.id === R.inv.boss) : null;
      $('#bossMeter').style.width = (hb ? Math.max(0, hb.hp / hb.max) : Math.min(1, R.inv.prog / R.inv.need)) * 100 + '%';
      setClass($('#bossWrap'), 'hp', !!hb); setClass($('#bossWrap'), 'weak', false); setClass($('#bossWrap'), 'rift', true); setClass($('#bossWrap'), 'enr', false); setClass($('#bossWrap'), 'waves', false);
      setText($('#bossText'), hb ? t('invHerald', V.bossName, Math.ceil(R.inv.t)) : t('invName', V.name, Math.floor(Math.min(R.inv.prog, R.inv.need)), R.inv.need, Math.ceil(R.inv.t)));
      $('#btnFight').hidden = true; $('#btnRetreat').hidden = true;
    } else if (bossShown && R.rift) {
      const r = R.rift, g = r.guard ? R.mobs.find(m => m.id === r.guard) : null;
      $('#bossMeter').style.width = (g ? Math.max(0, g.hp / g.max) : Math.min(1, r.prog / r.need)) * 100 + '%';
      setClass($('#bossWrap'), 'hp', !!g); setClass($('#bossWrap'), 'weak', false); setClass($('#bossWrap'), 'rift', true); setClass($('#bossWrap'), 'enr', false); setClass($('#bossWrap'), 'waves', false);
      setClass($('#bossWrap'), 'enr', false);
      setText($('#bossText'), t('riftName', r.lvl) + ' · ' + Math.ceil(r.t) + 's · ' + (g ? t('riftGuardian') : Math.floor(Math.min(1, r.prog / r.need) * 100) + '%'));
      $('#btnFight').hidden = true; $('#btnRetreat').hidden = false;
    } else if (bossShown) {
      setClass($('#bossWrap'), 'rift', false);
      if (R.boss) {
        const k = Math.max(0, R.boss.hp / R.boss.max);
        $('#bossMeter').style.width = k * 100 + '%';
        setClass($('#bossWrap'), 'hp', true); setClass($('#bossWrap'), 'waves', false);
        setText($('#bossText'), (R.boss.affix ? R.boss.affix.map(a => t('aff_' + a)).join(' ') + ' ' : '') + L(G.bossName(R.boss.d)) + ' · ' + (R.boss.enr > 0 ? t('enrageT', Math.ceil(R.boss.enr)) : Math.ceil(R.boss.t) + 's'));
        setClass($('#bossWrap'), 'enr', R.boss.enr > 0);
        $('#btnFight').hidden = true; $('#btnRetreat').hidden = false;
      } else {
        setClass($('#bossWrap'), 'hp', false); setClass($('#bossWrap'), 'enr', false);
        const need = D.bossNeed;
        $('#bossMeter').style.width = Math.min(100, S.bossMeter / need * 100) + '%';
        const hs = G.hordeScale(), weak = G.mightRatio() < 1.35;
        // far too strong for new ground, with Torment to spare: say so
        const easy = G.mightRatio() > 6 && S.depth >= S.bestDepth && (S.torment || 0) < G.tormentMax();
        const wave = Math.min(3, 1 + Math.floor(3 * S.bossMeter / need));
        const odds = R.bossReady && G.bossOdds ? G.bossOdds() : 1;
        const narrow = innerWidth < 600;
        // the countdown to a boss that comes on its own
        const callIn = R.bossReady && S.set.autoBoss && R.bossIn != null ? Math.max(0, Math.ceil(R.bossIn + (odds >= 0.6 ? 0 : D.autoBoss ? 20 : 60))) : -1;
        if (callIn >= 0) setText($('#bossText'), narrow ? t('bossInShort', L(G.bossName(S.depth)), callIn) : t('bossIn', L(G.bossName(S.depth)), callIn) + (odds < 1 ? ' · ' + t('bossOdds', Math.max(1, Math.round(odds * 100))) : ''));
        else         setText($('#bossText'), R.bossReady && narrow ? t('bossReadyShort', L(G.bossName(S.depth))) + (odds < 1 ? ' · ' + Math.max(1, Math.round(odds * 100)) + '%' : '') : R.bossReady ? t('bossReadyTo', L(G.bossName(S.depth)), G.isLord(S.depth) ? G.realmName(S.depth + 1) : G.ZONE_NAME(S.depth + 1)) + (odds < 1 ? ' · ' + t('bossOdds', Math.max(1, Math.round(odds * 100))) : '') : t('waveN', wave) + ' · ' + t('clearMeter', Math.floor(Math.min(S.bossMeter, Math.ceil(need))), Math.ceil(need)) + ' · ' + (weak ? t('hordeWeak') : easy ? t('tooEasy') : t('toBoss')));
        setClass($('#bossWrap'), 'waves', true);
        setClass($('#btnFight'), 'long', R.bossReady && odds < 0.6);
        setClass($('#bossWrap'), 'weak', weak && !R.bossReady);
        $('#btnFight').hidden = !R.bossReady; $('#btnRetreat').hidden = true;
      }
    }
    // Button HP and ability
    const h = S.hero;
    // Journey goal and today's omen
    updateGoal();
    // XP bar and level-up choices
    $('#xpBar').hidden = !(h && h.cls);
    if (h && h.cls) {
      $('#xpFill').style.width = Math.min(100, h.xp / G.xpNeed(h.lvl) * 100) + '%';
      const nr = G.nextRank && G.nextRank(h.lvl);
      setText($('#xpText'), t('lvl') + ' ' + h.lvl + (nr ? ' · ' + t('rankNext', nr.lv, UI.rankText(nr)) : ''));
    }
    updatePerks();
    updatePartyHud();
    updateEventBar();
    updatePowers();
    // the level-up cards sit just above whatever the bottom HUD holds right now
    const hb = $('.hud.bottom'); if (hb) { const hh = hb.offsetHeight + 8; if (hh !== UI._hudB) { UI._hudB = hh; $('#stageWrap').style.setProperty('--hudB', hh + 'px'); } }
    $('#hpRow').hidden = !(h && h.cls);
    if (h && h.cls) {
      const k = Math.max(0, h.hp / (D.heroHp || 1));
      $('#hpMeter').style.width = k * 100 + '%';
      $('#hpTrail').style.width = k * 100 + '%';
      setClass($('#hpWrap'), 'low', k < 0.35);
      setText($('#hpText'), R.btnDown > 0 ? t('btnBrokenFor', Math.ceil(R.btnDown)) : R.stun > 0 ? t('regroup') : t('buttonHp', fmt(Math.max(0, h.hp)), fmt(D.heroHp)));
      const ab = h.eq.ability, btn = $('#btnAbil');
      btn.hidden = !ab;
      if (ab) {
        const type = G.ITEM_TYPE[ab.id];
        if (btn._id !== ab.id) { btn._id = ab.id; btn.querySelector('img').src = ic('it_' + ab.id, 3); btn.title = L(G.ABILITIES[type].name) + ' (Q)'; }
        const cd = Math.max(0, R.abilCd), tot = G.ABILITIES[type].cd;
        $('#abilCd').style.height = (cd > 0 ? cd / tot * 100 : 0) + '%';
        setClass(btn, 'ready', cd <= 0);
      }
    }
    // Buffs
    const bb = S.bless && G.BLESS_BY_ID && G.BLESS_BY_ID[S.bless];
    const bh = (bb ? `<span class="buff bless${bb.twist ? ' twist' : ''}" title="${esc(bb.desc)}">${img(G.SPR.defs[bb.icon] ? bb.icon : 'ic_star', '', 2)}${esc(bb.name)}</span>` : '') + S.buffs.map(b => `<span class="buff ${b.id}">${esc(t(b.id))} ${Math.ceil(b.t)}s</span>`).join('')
      + Object.keys(R.hb || {}).filter(k => R.hb[k] > 0).map(k => `<span class="buff ${k === 'hh' ? 'hunt' : 'storm'}">${esc(k === 'hh' ? G.UNIQUES.headhunter.name : L(G.ABILITIES[k].name))} ${Math.ceil(R.hb[k])}s</span>`).join('')
      + (R.shr && R.shr.t > 0 ? `<span class="buff shrine" style="--c:${G.SHRINES[R.shr.k].col}">${esc(t('shrineBuff', G.SHRINES[R.shr.k].name, Math.ceil(R.shr.t)))}</span>` : '');
    const bEl = $('#buffs');
    if (bEl._h !== bh) { bEl.innerHTML = bh; bEl._h = bh; }
    if (G.Tut) G.Tut.update();
    $('#btnSound').classList.toggle('off', !S.set.sound);
    $('#btnMusic').classList.toggle('off', !S.set.music);

    const ct = curTab();
    if (dirty[ct]) { dirty[ct] = false; if (ct === 'coll' || ct === 'quests' || ct === 'asc') { updaters[ct] && updaters[ct](true); } }
    if (updaters[ct]) updaters[ct](force);
    if (G.R.town && tw.id) twFootLive();
  };

  // what in town wants a visit: a building just opened, a finished quest or the daily gift, an empty
  // party seat, a star or a Garrison hire you can afford, a building you can build up
  function bldPing(id) {
    const S = G.S;
    if (!bldOpen(id)) return false;
    const f = BLDS[id].subs.find(x => !CUSTOM[x] && x !== 'hero' && x !== 'ladder');
    if (f && !S.seen.tabs[f]) return true;
    if (id === 'quests') return S.quests.some(q => q.done) || G.dailyAvailable();
    if (id === 'tavern') return !!(S.hero && S.hero.cls && G.partySlots && G.partySlots() > S.party.length);
    if (id === 'pets') return S.eggs >= 1;
    if (id === 'forge') return G.S.hero.bag.some(g => G.powerWith(G.slotOf(g.id), g, -1) > G.powerWith(G.slotOf(g.id), G.S.hero.eq[G.slotOf(g.id)], -1));
    return false;
  }
  const bldCanBuild = id => bldOpen(id) && G.bldLvl(id) < G.BLD_MAX && G.S.gold >= G.bldCost(id);
  UI.bldPing = bldPing; UI.bldCanBuild = bldCanBuild;
  let pingT = 0, pingV = null;
  function townPing() {
    const now = performance.now();
    if (now - pingT < 500) return pingV;
    pingT = now; pingV = BLD_ORDER.find(id => bldPing(id)) || null;
    return pingV;
  }
  // ---------- Render tabs ----------
  const renderers = {}, updaters = {};
  function applyStatic() {
    $$('[data-i18n]').forEach(el => setText(el, t(el.dataset.i18n)));
    $$('[data-depth-label]').forEach(el => setText(el, t('depth')));
  }
  UI.render = function () {
    applyStatic();
    refs = {};
    // a fresh element per render, so the old tab's click handlers go with it
    const old = $('#tabBody'), body = old.cloneNode(false);
    old.replaceWith(body);
    // in town the panel lists the buildings; a page opened in one renders in its window (renderTown)
    const pt = G.R && G.R.town && tab !== 'set' ? 'towndir' : tab;
    const title = $('#tabTitle');
    title.innerHTML = `<span>${esc(t('tab_' + pt))}</span><small ${wtab ? '' : 'id="tabSub"'}></small>`;
    body.innerHTML = '';
    (renderers[pt] || (() => {}))(body);
    if (wtab && tw.id) renderTown(true);
    UI.update(true);
  };

  // Upgrades
  renderers.upg = function (body) {
    const S = G.S;
    const list = G.UPGRADES.filter(u => (S.upg[u.id] || 0) > 0 || (!u.req || S.upg[u.req] > 0) && (u.secret ? S.goldRun >= u.secret : S.goldTotal >= u.base * 0.3 || u.id === 'finger'));
    body.innerHTML = `<button class="btn gold buyAll" data-buyall>${esc(t('buyAll'))}</button><div class="list">${list.map(u => `
      <button class="row" data-u="${u.id}">
        <span class="ico">${img(u.icon, '', 4)}</span>
        <span class="info"><span class="name">${esc(L(u.name))}<span class="lv" data-lv></span></span><span class="desc">${esc(L(u.desc))}</span></span>
        <span class="cost">${img('ic_coin', '', 2)}<span data-cost></span></span>
      </button>`).join('')}</div>
      <p class="note keys">${esc(t('keysHint'))}</p>`;
    refs.rows = $$('.row', body).map(el => ({ el, u: G.UPGRADES.find(x => x.id === el.dataset.u), lv: el.querySelector('[data-lv]'), cost: el.querySelector('[data-cost]') }));
    // 3.3: buy the cheapest affordable upgrade again and again until nothing's affordable
    body.querySelector('[data-buyall]').addEventListener('click', () => {
      G.Audio.unlock(); let n = 0;
      for (let k = 0; k < 300; k++) {
        const u = G.UPGRADES.filter(x => refs.rows.some(r => r.u === x) && !(x.max && (G.S.upg[x.id] || 0) >= x.max) && G.S.gold >= G.upgCost(x)).sort((a, b) => G.upgCost(a) - G.upgCost(b))[0];
        if (!u || !G.buyUpgrade(u.id)) break; n++;
      }
      if (n) { G.Audio.buy(); UI.toast(esc(t('buyAllDone', n)), '', 'ic_coin'); UI.update(true); } else G.Audio.error();
    });
    body.querySelector('.list').addEventListener('click', e => {
      const r = e.target.closest('.row'); if (!r) return;
      if (!G.buyUpgrade(r.dataset.u)) { shakeRow(r); }
    });
    refs.count = list.length;
  };
  updaters.upg = function () {
    const S = G.S;
    if (!refs.rows) return;
    const visible = G.UPGRADES.filter(u => (S.upg[u.id] || 0) > 0 || (!u.req || S.upg[u.req] > 0) && (u.secret ? S.goldRun >= u.secret : S.goldTotal >= u.base * 0.3 || u.id === 'finger')).length;
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
    const ba = $('[data-buyall]'); if (ba) setClass(ba, 'dim', !refs.rows.some(r => r.el.classList.contains('can')));
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
    const width = Math.max(260, body.clientWidth - 24);
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
      <div class="detail" data-detail></div>
      <div class="starmap" style="width:${mw}px;height:${mh}px">
        <svg viewBox="0 0 ${mw} ${mh}" aria-hidden="true">${lines}</svg>
        ${G.NODES.map(n => { const p = pos(n); const sz = n.max === 1 && n.cost >= 150 ? nodeSize + 6 : nodeSize; return `<button class="node${sz > nodeSize ? ' big' : ''}" data-n="${n.id}" style="left:${p.x}px;top:${p.y}px;width:${sz}px;height:${sz}px;--c:${G.BRANCH_COLORS[n.br]}" aria-label="${esc(L(n.name))}"><i></i></button>`; }).join('')}
      </div>`;
    refs.nodes = $$('.node', body).map(el => ({ el, n: G.NODE_BY_ID[el.dataset.n], lbl: el.querySelector('i') }));
    refs.lines = $$('line', body);
    refs.detail = body.querySelector('[data-detail]');
    body.querySelector('.starmap').addEventListener('click', e => {
      const b = e.target.closest('.node'); if (!b) return;
      // a second click buys with a mouse; on touch screens only the Learn button does, so nothing is bought unseen
      if (selNode === b.dataset.n && !matchMedia('(pointer: coarse)').matches) { if (!G.buyNode(selNode)) G.Audio.error(); }
      selNode = b.dataset.n;
      renderDetail(true);
      if (refs.detail) refs.detail.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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
      ${G.RELIC_IDS ? `<div class="sect" style="color:${G.RELIC_COL}">${esc(t('relicBook'))} <small style="color:var(--dim)">${esc(t('uqFound', G.RELIC_IDS.filter(q => (S.rec.relicN || {})[q]).length, G.RELIC_IDS.length))}</small></div>
      <p class="note">${esc(t('relicHint'))}</p>
      <div class="evoBook uqBook relicBook">${G.RELIC_IDS.map(q => {
        const U = G.UNIQUES[q], n = (S.rec.relicN || {})[q] || 0;
        return `<div class="evoRow ${n ? 'uq relic' : 'off'}">${img('u_' + q, '', 3, n ? null : { dark: true })}<div><b style="${n ? 'color:' + G.RELIC_COL : ''}">${esc(n ? U.name : '???')}${n > 1 ? ` <small>×${n}</small>` : ''}</b>${n ? `<small class="d">${esc(U.fx)}</small>` : ''}</div></div>`;
      }).join('')}</div>` : ''}
      <div class="sect">${esc(t('uniques'))} <small style="color:var(--dim)">${esc(t('uqFound', Object.keys(S.uq).length, G.UNIQUE_IDS.length))}</small></div>
      <div class="evoBook uqBook">${G.UNIQUE_IDS.map(q => {
        const U = G.UNIQUES[q], n = S.uq[q] || 0;
        return `<div class="evoRow ${n ? 'uq' : 'off'}">${img('u_' + q, '', 3, n ? null : { dark: true })}<div><b>${esc(n ? U.name : '???')}${n > 1 ? ` <small>×${n}</small>` : ''}</b><small>${esc(U.boss ? t('uqDropsBoss', G.bossName(U.minD)) : t('uqDrops', U.minD + 1))}</small>${n ? `<small class="d">${esc(U.fx)}</small>` : ''}</div></div>`;
      }).join('')}</div>
      <div class="sect">${esc(t('evoBook'))} <small style="color:var(--dim)">${esc(t('evoFound', Object.keys(S.rec.evos || {}).length, Object.keys(G.EVOS).length))}</small></div>
      <div class="evoBook">${Object.keys(G.EVOS).map(id => {
        const E = G.EVOS[id], got = S.rec.evos && S.rec.evos[id];
        return `<div class="evoRow ${got ? '' : 'off'}">${img(E.icon, '', 3, got ? null : { dark: true })}<div><b>${esc(got ? E.name : t('evoUnknown'))}</b><small>${esc(t('evoHint', G.PERKS[E.from].name, E.need))}</small>${got ? `<small class="d">${esc(E.desc)}</small>` : ''}</div></div>`;
      }).join('')}</div>
      <div class="sect">${esc(t('collBonuses'))}</div>
      <div class="bonusList">${bonusRows || `<span>—</span>`}</div>
      <div class="sect">${esc(t('chestsOpened'))}</div>
      <div class="tierCounts">${G.RARITIES.map((r, i) => `<div style="color:${r.color}">${img('chest_' + i, '', 2)}<br>${fmt(S.opened[i])}</div>`).join('')}</div>
      <div class="sect">${esc(t('modifiers'))}</div>
      <div class="modList">${G.MODIFIERS.map(m => `<div class="modItem ${D.mods[m.id] ? '' : 'off'}"><b style="color:${m.color}">${esc(L(m.name))}</b><span>${esc(D.mods[m.id] ? L(m.desc) : t('modLocked'))}</span></div>`).join('')}</div>`;
    refs.slots = $$('.slot', body).map(el => ({ el, it: G.ITEM_BY_ID[el.dataset.i], n: el.querySelector('.n'), st: el.querySelector('.stars'), img: el.querySelector('img') }));
    refs.item = body.querySelector('[data-item]');
    refs.found = found + 100 * Object.keys(S.uq).length;
    body.addEventListener('click', e => {
      const s = e.target.closest('.slot'); if (!s) return;
      selItem = s.dataset.i; updaters.coll(true);
    });
    if (!selItem) selItem = (G.ITEMS.find(it => S.coll[it.id]) || G.ITEMS[0]).id;
  };
  updaters.coll = function (force) {
    const S = G.S;
    if (!refs.slots) return;
    const found = G.ITEMS.filter(it => (S.coll[it.id] || 0) > 0).length + 100 * Object.keys(S.uq).length;
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
    const key = JSON.stringify(S.pets) + S.active.join();
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
    if (curTab() === 'pets') UI.update(true);
  }

  // Quests
  renderers.quests = function (body) {
    const S = G.S;
    const avail = G.dailyAvailable();
    const streak = avail ? (S.daily.last ? S.daily.streak + 1 : 0) : S.daily.streak; // a missed day pauses the streak
    const dayIcon = d => { const r = G.DAILY[d % 7]; return r.kind === 'gold' ? 'ic_coin' : r.kind === 'eggs' ? 'ic_egg' : r.kind === 'ess' ? 'ic_ess' : 'chest_6'; };
    const om = G.omen(), B = S.bounty && S.bounty.day === G.todayKey() ? S.bounty : { n: 0, done: false };
    const jp = G.Journey.progress();
    const nextSteps = [1, 2, 3].map(k => G.Journey.step((S.journey || 0) + k).text);
    body.innerHTML = `
      <div class="quest omen"><div class="top"><b>${esc(t('omen'))}: ${esc(om.name)}</b></div><p class="note">${esc(om.desc)}</p></div>
      <div class="quest ${B.done ? 'claimed' : ''}"><div class="top"><b>${esc(t('bounty'))}</b><small style="color:var(--dim)">${fmt(Math.min(B.n, G.Journey.BOUNTY))}/${fmt(G.Journey.BOUNTY)}</small></div>
        <p class="note">${esc(B.done ? t('bountyDone') : t('bountyText', fmt(G.Journey.BOUNTY)))}</p><div class="pbar"><i style="width:${Math.min(100, B.n / G.Journey.BOUNTY * 100)}%"></i></div></div>
      <div class="quest journey"><div class="top"><b>${esc(t('journey'))} · ${esc(t('journeyStep', (S.journey || 0) + 1))}</b><small style="color:var(--dim)">${fmt(jp.cur)}/${fmt(jp.need)}</small></div>
        <p>${esc(jp.st.text)}</p>${jp.st.hint ? `<p class="note">${esc(jp.st.hint)}</p>` : ''}
        <div class="pbar"><i style="width:${Math.min(100, jp.cur / jp.need * 100)}%"></i></div>
        <p class="note">${esc(t('journeyNext'))}: ${nextSteps.map(esc).join(' · ')}</p><p class="note">${esc(t('journeyHint'))}</p></div>
      <div class="quest ${avail ? 'done' : ''}">
        <div class="top"><b>${esc(t('daily'))}</b>${avail ? `<button class="btn gold" data-daily>${esc(t('collect'))}</button>` : `<small style="color:var(--dim)">${esc(t('tomorrow'))}</small>`}</div>
        <div class="dailyDays">${G.DAILY.map((d, i) => { const ld = G.S.daily.last ? G.S.daily.streak % 7 : -1, nw = avail ? (G.S.daily.last ? (G.S.daily.streak + 1) % 7 : 0) : -1; return `<div class="${(avail ? i < nw : i <= ld) ? 'past' : ''} ${i === nw ? 'now' : ''}">${esc(t('dayN', i + 1))}${img(dayIcon(i), '', 2)}</div>`; }).join('')}</div>
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
      case 'kills': return t('q_kills', fmt(q.n));
    }
    return '';
  }
  updaters.quests = function () {
    const S = G.S;
    if (!refs.q) return;
    const rerollLeft = Math.max(0, (S.rerollAt - Date.now()) / 1000);
    const key = S.quests.map(q => q.k + (q.done ? 1 : 0) + (q.wait ? 'w' : '')).join('|') + (rerollLeft > 0 ? 'r' : '');
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
      ['st_lords', fmt(S.st.lordKills)], ['st_best', S.bestDepth + 1], ['st_crits', fmt(S.st.crits)], ['st_combo', Math.floor(S.st.maxCombo)],
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
    setText(refs.gain, g >= 1 ? '+' + fmt(g) + ' ' + t('fame').toLowerCase() : t('ascNeed'));
    setText(refs.passive, t('famePassive', fmt(S.fameTotal), fmt(S.fameTotal), fmt(S.fameTotal * 0.5)));
    refs.ascBtn.disabled = g < 1;
    for (const r of refs.rows) {
      const L_ = S.legacy[r.l.id] || 0, maxed = L_ >= r.l.max, c = G.legacyCost(r.l);
      setText(r.lv, t('lvl') + ' ' + L_ + '/' + r.l.max);
      setText(r.cost, maxed ? t('max') : fmt(c));
      setClass(r.el, 'maxed', maxed);
      setClass(r.el, 'can', !maxed && S.fame >= c);
      setClass(r.el, 'cant', !maxed && S.fame < c);
    }
    setText($('#tabSub'), fmt(S.fame) + ' ' + t('fame').toLowerCase());
  };

  // Character: paper doll, stats, bag, enchanting and records
  let selGear = null; // gear uid
  const SLOT_ICON = { weapon: 'ic_sword', ability: 'ic_scroll', armor: 'it_chainmail', ring: 'it_copper_ring' };
  function findGear(u) {
    const h = G.S.hero;
    // worn by the member on screen, then by anyone else in the party, then in the bag
    const order = [selWho].concat([-1].concat(G.S.party.map((_, i) => i)).filter(w => w !== selWho));
    for (const w of order) { const eq = G.eqOf(w); for (const s of G.SLOTS) if (eq[s] && eq[s].u === u) return { g: eq[s], worn: s, who: w }; }
    const g = h.bag.find(x => x.u === u);
    return g ? { g, worn: null } : null;
  }
  function gearName(g) { return (g.q ? G.UNIQUES[g.q].name : L(G.ITEM_BY_ID[g.id].name)) + (g.e ? ' +' + g.e : ''); }
  const gearCol = g => (g.q ? (G.isRelic && G.isRelic(g) ? G.RELIC_COL : G.UNIQUE_COL) : G.RARITIES[g.r].color);
  const uqLabel = g => (G.isRelic && G.isRelic(g) ? `<b class="relicTxt" style="color:${G.RELIC_COL}">${esc(t('relic'))}</b>` : `<b style="color:${G.UNIQUE_COL}">${esc(t('unique'))}</b>`);
  function mainLine(g) {
    const slot = G.slotOf(g.id), type = G.ITEM_TYPE[g.id], v = G.mainStat(g);
    if (slot === 'weapon') return t('g_weapon', L(G.WEAPONS[type].name), fmt(v, true), G.WEAPONS[type].targets);
    if (slot === 'armor') return t('g_armor', fmt(v));
    if (slot === 'ring') return t('g_ring', G.fmtPct(v));
    return t('g_ability', G.fmtPct(v), L(G.ABILITIES[type].name), L(G.ABILITIES[type].desc));
  }
  // how good a roll is inside its range: T1 for the top fifth, a star for a near-perfect one
  function affLine(a, g) {
    const d = G.AFFIXES[a[0]];
    let tag = '';
    if (g && !g.q) {
      const k = 1 + 0.35 * g.r, q = (a[1] / k - d.v[0]) / (d.v[1] - d.v[0]);
      tag = q >= 0.95 ? ' <em class="t1">★ T1</em>' : q >= 0.8 ? ' <em class="t1">T1</em>' : '';
    }
    return `<li>${esc(L(d.name))} <b>${d.x ? '+' + a[1].toFixed(2) + '×' : G.fmtPct(a[1])}</b>${tag}</li>`;
  }
  function gearTile(g, extra) {
    return `<button class="gear r${g.r} ${g.q ? 'uq' : ''} ${G.isRelic && G.isRelic(g) ? 'relic' : ''} ${g.c ? 'corr' : ''} ${extra || ''}" data-g="${g.u}" style="--rc:${gearCol(g)}" aria-label="${esc(gearName(g))}">${img(G.gearSpr(g), '', 4)}${g.e ? `<em>+${g.e}</em>` : ''}<small>${g.il}</small><u hidden>▲</u></button>`;
  }
  // The currency strip: tap an orb to use it on the selected item
  function orbBar(g) {
    const h = G.S.hero;
    return `<div class="orbBar">${G.ORB_IDS.map(id => {
      const O = G.ORBS[id], n = h.orbs[id] || 0, why = G.orbBlock(id, g);
      const tip = O.name + ': ' + O.desc + (n && why ? ' (' + t('orbNo_' + why, G.ENCHANT_MAX) + ')' : '');
      return `<button class="orb ${n ? '' : 'none'} ${n && !why ? 'can' : ''}" data-orb="${id}" title="${esc(tip)}" aria-label="${esc(O.name)}" style="--oc:${O.col}">${img('orb_' + id, '', 3)}<b>${fmt(n)}</b></button>`;
    }).join('')}</div>`;
  }
  renderers.hero = function (body) {
    const S = G.S, h = S.hero;
    if (!h.cls) { body.innerHTML = `<p class="note">${esc(t('pickClassHint'))}</p><button class="btn gold" data-pick>${esc(t('pickClass'))}</button>`; body.querySelector('[data-pick]').onclick = () => UI.pickClass(); return; }
    if (selWho >= S.party.length) selWho = -1;
    const who = selWho, mem = who >= 0 ? S.party[who] : null, cls = G.CLASS_BY_ID[mem ? mem.cls : h.cls];
    const salvOpts = [0, 1, 2, 3];
    body.innerHTML = `
      <p class="note">${esc(t('partyHint'))}</p>
      <div class="partyStrip" data-strip></div>
      <div class="charCard">
        <div class="portrait"><img data-doll src="${G.Doll.portrait(mem ? { cls: mem.cls, eq: mem.eq } : h, 4)}" alt=""></div>
        <div class="charInfo">
          ${mem ? `<div class="memName">${esc(L(cls.name))}</div>` : `<input id="heroName" maxlength="16" placeholder="${esc(t('namePh'))}" value="${esc(S.profile.name || '')}" aria-label="${esc(t('namePh'))}">`}
          <div class="clsLine">${esc(L(cls.name))} · <span class="r_${G.ROLES[cls.id]}" style="color:var(--role)">${esc(G.ROLE_NAMES[G.ROLES[cls.id]])}</span> · <span data-lvl></span></div>
          <div class="pbar"><i data-xp></i><span data-xpt></span></div>
          <div class="power"><small>${esc(t('power'))}</small><b data-pow></b></div>
        </div>
      </div>
      <div class="doll">${G.SLOTS.map(s => `<div class="dslot" data-slot="${s}"><span class="lbl">${esc(t('slot_' + s))}</span><div data-in></div></div>`).join('')}</div>
      <div class="bestRow"><button class="btn gold" data-bestall>${esc(t('twBest'))}</button></div>
      <div class="detail" data-gd></div>
      <div class="sect">${esc(t('orbs'))} <small style="color:var(--dim)">${esc(t('orbHint'))}</small></div>
      <div data-orbs></div>
      <div class="sect">${esc(t('bag'))} <span data-bagn></span> · ${img('ic_shard', 'inl', 2)} <span data-shards></span> ${esc(t('shards'))}</div>
      <div class="bag" data-bag></div>
      <div class="sect">${esc(mem ? t('roleTitleMem') : t('roleTitle'))}</div>
      <p class="note">${esc(mem ? t('roleHint_' + G.ROLES[mem.cls]) : t('roleHint'))}</p>
      <div class="statList" data-role></div>
      <div ${mem ? 'hidden' : ''}>
      <div class="sect">${esc(t('perksTitle'))}</div>
      <div class="perkList" data-perks></div>
      </div>
      <div class="statList heroStats" data-stats></div>
      <div class="setList" style="margin-top:8px">
        <div class="setRow"><span>${esc(t('autoEquip'))}</span><button class="toggle ${h.auto ? 'on' : ''}" data-ht="auto" aria-label="${esc(t('autoEquip'))}"></button></div>
        <div class="setRow"><span>${esc(t('autoPerk'))}</span><button class="toggle ${h.autoPerk ? 'on' : ''}" data-ht="autoPerk" aria-label="${esc(t('autoPerk'))}"></button></div>
        <div class="setRow"><span>${esc(t('autoCast'))}</span><button class="toggle ${h.cast ? 'on' : ''}" data-ht="cast" aria-label="${esc(t('autoCast'))}"></button></div>
        <div class="setRow"><span>${esc(t('autoSalv'))}</span><span class="seg" data-salv>${salvOpts.map(r => `<button data-r="${r}" class="${h.salv === r ? 'on' : ''}">${r === 0 ? esc(t('off')) : esc(L(G.RARITIES[r].name)).slice(0, 5) + '.'}</button>`).join('')}</span></div>
        <div class="setRow"><span>${esc(t('salvBelow'))}</span><button class="btn" data-salvall>${esc(t('salvage'))}</button></div>
      </div>
      <div class="sect">${esc(t('records'))}</div>
      <div class="statList" data-rec></div>
      <p class="note">${esc(t('ladderSoon'))}</p>`;
    refs.hero = {
      lvl: body.querySelector('[data-lvl]'), xp: body.querySelector('[data-xp]'), xpt: body.querySelector('[data-xpt]'), pow: body.querySelector('[data-pow]'),
      slots: $$('.dslot', body), gd: body.querySelector('[data-gd]'), stats: body.querySelector('[data-stats]'), bag: body.querySelector('[data-bag]'),
      bagn: body.querySelector('[data-bagn]'), shards: body.querySelector('[data-shards]'), rec: body.querySelector('[data-rec]'), key: '',
      role: body.querySelector('[data-role]'), perks: body.querySelector('[data-perks]'), orbs: body.querySelector('[data-orbs]'),
      strip: body.querySelector('[data-strip]'),
    };
    const nm = $('#heroName', body);
    if (nm) nm.addEventListener('change', e => { S.profile.name = e.target.value.trim().slice(0, 16); });
    body.addEventListener('click', e => {
      // pick whose gear you're looking at, or take on a new companion
      const pm = e.target.closest('[data-who]');
      if (pm) { selWho = +pm.dataset.who; selGear = null; UI.render(); return; }
      if (e.target.closest('[data-recruit]')) { UI.recruit(); return; }
      const tg = e.target.closest('[data-ht]');
      if (tg) { h[tg.dataset.ht] = h[tg.dataset.ht] ? 0 : 1; tg.classList.toggle('on'); return; }
      const sb = e.target.closest('[data-salv] button');
      if (sb) { h.salv = +sb.dataset.r; $$('[data-salv] button', body).forEach(x => x.classList.toggle('on', x === sb)); return; }
      if (e.target.closest('[data-salvall]')) {
        const r = G.salvageBelow(Math.max(1, h.salv || 2));
        UI.toast(esc(t('salvaged', r.n, fmt(r.v))), '', 'ic_shard'); refs.hero.key = ''; return;
      }
      if (e.target.closest('[data-bestall]')) { const n = G.equipBest(); if (n) { G.Audio.levelUp && G.Audio.levelUp(); UI.toast(esc(t('twBestDone', n)), 'ach', 'ic_sword'); } else UI.toast(esc(t('twBestNone')), '', 'ic_sword'); refs.hero.key = ''; refs.hero.dollKey = ''; updaters.hero(true); return; }
      const gt = e.target.closest('[data-g]');
      // the item's details sit above the bag: bring them into view, or on a phone nothing seems to happen
      if (gt) { selGear = +gt.dataset.g; refs.hero.key = ''; updaters.hero(true); if (refs.hero.gd) refs.hero.gd.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
      const ds = e.target.closest('.dslot');
      if (ds && !e.target.closest('[data-g]')) { const g = G.eqOf(selWho)[ds.dataset.slot]; if (g) { selGear = g.u; refs.hero.key = ''; updaters.hero(true); } return; }
      const ob = e.target.closest('[data-orb]');
      if (ob) {
        const f = findGear(selGear), id = ob.dataset.orb;
        if (!(h.orbs[id] > 0)) { G.Audio.error(); return; }
        const why = G.orbBlock(id, f && f.g);
        if (why) { G.Audio.error(); UI.toast(esc(t('orbNo_' + why, G.ENCHANT_MAX)), '', 'orb_' + id); return; }
        const res = G.useOrb(id, f.g);
        if (res) UI.toast(`<b style="color:${G.ORBS[id].col}">${esc(t('orbDone_' + res))}</b>`, res.startsWith('ruin') && res !== 'ruin_none' ? 'ach' : '', 'orb_' + id);
        refs.hero.key = ''; updaters.hero(true); return;
      }
      const act = e.target.closest('[data-act]');
      if (act) {
        const f = findGear(selGear); if (!f) return;
        const a = act.dataset.act;
        if (a === 'equip') G.equip(f.g, false, selWho);
        else if (a === 'unequip') G.unequip(f.worn, f.who);
        else if (a === 'enchant') { if (!G.enchant(f.g)) G.Audio.error(); }
        else if (a === 'salvage') { const v = G.salvage(f.g); if (v) { UI.toast(esc(t('salvaged', 1, fmt(v))), '', 'ic_shard'); selGear = null; } }
        refs.hero.key = ''; updaters.hero(true);
      }
    });
    if (!selGear || !findGear(selGear)) { const e0 = G.eqOf(selWho); selGear = e0.weapon ? e0.weapon.u : null; }
  };
  // Taking on a companion: pick a class; the roles the party lacks come first
  UI.recruit = function () {
    const S = G.S;
    if (S.party.length >= G.partySlots()) return;
    const have = [S.hero.cls].concat(S.party.map(m => m.cls)).map(c => G.ROLES[c]);
    const need = r => !have.includes(r);
    const html = `<p>${esc(t('recruitHint'))}</p><div class="classGrid">${G.CLASSES.map(c => { const r = G.ROLES[c.id]; return `
      <button class="clsCard ${need(r) ? 'need' : ''}" data-c="${c.id}">${img(c.spr, '', 5)}<b>${esc(L(c.name))}</b><em class="role r_${r}">${esc(G.ROLE_NAMES[r])}${need(r) ? ' · ' + esc(t('recruitNeed')) : ''}</em><small>${esc(L(c.descAlly || c.desc))}</small></button>`; }).join('')}</div>`;
    const m = UI.modal(t('recruitTitle'), html, [{ label: t('close') }]);
    m.querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', () => {
      if (G.recruit(b.dataset.c)) { m.hidden = true; m.innerHTML = ''; selWho = S.party.length - 1; selGear = null; G.Audio && G.Audio.buy(); UI.render(); }
    }));
  };
  updaters.hero = function (force) {
    const S = G.S, D = G.D, h = S.hero, rf = refs.hero;
    if (!rf || !h.cls) return;
    if (selWho >= S.party.length) { selWho = -1; UI.render(); return; }
    const mem = selWho >= 0 ? S.party[selWho] : null, eqS = G.eqOf(selWho);
    const c = mem ? (D.party[selWho] || {}).c || D.hero : D.hero;
    // the party strip: everyone, their health, and the places still to fill
    const units = G.partyUnits(), slots = G.partySlots();
    // (built only when who is in it changes, so a tap is never lost to a rebuild; health updates in place)
    const sk = JSON.stringify([units.map(u => [u.who, u.cls, G.SLOTS.map(sl => u.eq[sl] ? u.eq[sl].id + (u.eq[sl].q || '') : '')]), slots, selWho]);
    if (rf.strip._k !== sk) {
      let sh = units.map(u => `<button class="pmem ${u.who === selWho ? 'on' : ''}" data-who="${u.who}"><img src="${G.Doll.portrait({ cls: u.cls, eq: u.eq }, 2, true)}" alt=""><small class="r_${u.role}">${esc(G.ROLE_NAMES[u.role])}</small><i><u></u></i></button>`).join('');
      for (let k = S.party.length; k < 3; k++) sh += k < slots ? `<button class="pmem add" data-recruit>+<small>${esc(t('recruit'))}</small></button>` : `<div class="pmem lock"><small>${esc(t('recruitAt', G.PARTY_AT[k]))}</small></div>`;
      rf.strip.innerHTML = sh; rf.strip._k = sk;
    }
    units.forEach((u, i) => { const b = rf.strip.children[i]; if (!b) return; setClass(b, 'down', u.down > 0); const bar = b.querySelector('u'); if (bar) bar.style.width = Math.round(100 * Math.max(0, u.hp) / u.max) + '%'; });
    setText(rf.lvl, t('lvl') + ' ' + h.lvl);
    rf.xp.style.width = Math.min(100, h.xp / G.xpNeed(h.lvl) * 100) + '%';
    setText(rf.xpt, fmt(Math.floor(h.xp)) + ' / ' + fmt(G.xpNeed(h.lvl)));
    const P = mem ? D.party[selWho] : null;
    setText(rf.pow, fmt(P ? P.c.power : D.power));
    setText(rf.shards, fmt(h.shards));
    setText(rf.bagn, h.bag.length + '/' + G.TUNE.bagMax);
    setText($('#tabSub'), t('power') + ' ' + fmt(D.power));
    // what the Warden is doing for you right now
    const c0 = D.hero, critEV = 1 + c0.crit * (c0.critMult - 1);
    const bossSec = D.heroDps * D.bossMult, bossHp = G.bossMax(S.depth), limit = D.bossTime + (G.isLord(S.depth) ? 15 : 0);
    const alone = bossHp / Math.max(1e-9, bossSec);
    const role = [
      ['roleHorde', '×' + G.hordeScale().toFixed(1)],
      ['roleBossClick', fmt(D.heroHit * G.TUNE.clickVolley * D.bossMult * critEV, true)],
      ['roleBossSec', fmt(bossSec, true)],
      ['roleBoss', fmt(bossHp) + ' · ' + t('roleBossTime', alone > 999 ? '999+' : Math.ceil(alone), limit)],
    ];
    const roleHtml = role.map(([k, v]) => `<span>${esc(t(k))}</span><b>${esc(v)}</b>`).join('') + (alone > limit * 2 ? `<p class="note warn">${esc(t('roleWeak'))}</p>` : '');
    if (rf.role.innerHTML !== roleHtml) rf.role.innerHTML = roleHtml;
    const key = JSON.stringify([eqS, selWho, h.bag.length, h.bag.map(g => g.u + ':' + g.e).join(), selGear, h.lvl, Math.floor(h.shards / 5), h.perks, h.orbs]);
    if (key === rf.key && !force) return;
    const pk = Object.keys(h.perks || {}).filter(k => h.perks[k] > 0);
    rf.perks.innerHTML = pk.length ? pk.map(k => {
      if (k.startsWith('evo_')) { const E = G.EVOS[k.slice(4)]; return `<div class="perkChip evo" title="${esc(E.desc)}">${img(E.icon, '', 3)}<b>${esc(E.name)}</b><small>★</small></div>`; }
      const P = G.PERKS[k]; return `<div class="perkChip" title="${esc(P.desc)}">${img(P.icon, '', 3)}<b>${esc(P.name)}</b><small>${h.perks[k]}/${P.max}</small></div>`;
    }).join('') : `<p class="note">${esc(t('perksNone'))}</p>`;
    rf.key = key;
    const dk = JSON.stringify(eqS) + selWho;
    if (dk !== rf.dollKey) { rf.dollKey = dk; const im = document.querySelector('.portrait img[data-doll]'); if (im) im.src = G.Doll.portrait(mem ? { cls: mem.cls, eq: mem.eq } : h, 4); }
    for (const el of rf.slots) {
      const g = eqS[el.dataset.slot];
      const box = el.querySelector('[data-in]');
      const hh = g ? gearTile(g, selGear === g.u ? 'sel' : '') : `<span class="empty">${img(SLOT_ICON[el.dataset.slot], '', 3, { dark: true })}</span>`;
      if (box._h !== hh) { box.innerHTML = hh; box._h = hh; }
    }
    // Bag, grouped by slot and sorted by power
    const order = G.SLOTS;
    const bag = h.bag.slice().sort((a, b) => order.indexOf(G.slotOf(a.id)) - order.indexOf(G.slotOf(b.id)) || b.r - a.r || b.il - a.il);
    rf.bag.innerHTML = bag.length ? bag.map(g => gearTile(g, selGear === g.u ? 'sel' : '')).join('') : `<p class="note">${esc(t('bagEmpty'))}</p>`;
    // upgrade arrows
    $$('[data-g]', rf.bag).forEach(el => { const g = h.bag.find(x => x.u === +el.dataset.g); if (!g) return; const sl = G.slotOf(g.id); if (mem && sl === 'weapon' && !G.CLASS_BY_ID[mem.cls].weapons.includes(G.ITEM_TYPE[g.id])) return; if (G.powerWith(sl, g, selWho) > G.powerWith(sl, eqS[sl], selWho)) el.querySelector('u').hidden = false; });
    // Stats
    const cls = G.CLASS_BY_ID[mem ? mem.cls : h.cls];
    // a companion: what it really deals and takes, after its share and the run's bonuses
    const rows = [
      ['st_dps', fmt(P ? P.dps : c.dps, true)], ['st_hit', fmt(P ? P.hit : c.hit, true)], ['st_rate', (P ? P.rate : c.rate).toFixed(2) + t('perSec')], ['st_targets', c.targets],
      ['st_crit', Math.round(c.crit * 100) + '% · ×' + c.critMult.toFixed(1)], P ? ['st_unitHp', fmt(P.hp)] : ['st_hp', fmt(c.hp)],
      ...(P ? [] : [['st_wardenHp', fmt(D.wardenHp)]]),
      ['st_class', c.own ? t('classBonusOn') : t('classBonusOff', cls.weapons.map(w => L(G.WEAPONS[w].name)).join(', '))],
    ];
    rf.stats.innerHTML = rows.map(([k, v]) => `<span>${esc(t(k))}</span><b>${esc(v)}</b>`).join('');
    // Records (ladder material)
    const rec = [['rec_depth', S.bestDepth + 1], ['gsLadder', fmt(G.ladderSnapshot().power)], ['rec_power', fmt(S.rec.maxPower)], ['rec_level', S.rec.maxLevel], ['rec_mad', S.rec.madTime ? G.fmtTime(S.rec.madTime) : '—'], ['rec_rift', S.rift.best || '—'],
      ['rec_jp', (S.jp && S.jp.n ? S.jp.n + ' · ' : '') + t('jpOdds', G.jackpotOdds ? G.jackpotOdds().toFixed(1) : '1.0')]];
    rf.rec.innerHTML = rec.map(([k, v]) => `<span>${esc(t(k))}</span><b>${esc(v)}</b>`).join('');
    // Detail
    const f = selGear ? findGear(selGear) : null;
    if (!f) { rf.gd.innerHTML = `<p>${esc(t('tapItem'))}</p>`; rf.orbs.innerHTML = orbBar(null); return; }
    const g = f.g, r = G.RARITIES[g.r], slot = G.slotOf(g.id), U = g.q ? G.UNIQUES[g.q] : null;
    const cmp = f.worn ? null : G.powerWith(slot, g, selWho) - G.powerWith(slot, eqS[slot], selWho);
    const ec = G.enchantCost(g);
    const canE = g.e < G.ENCHANT_MAX && h.shards >= ec.shards && S.gold >= ec.gold;
    rf.orbs.innerHTML = orbBar(g);
    rf.gd.innerHTML = `
      <h3 style="color:${gearCol(g)}">${esc(gearName(g))}</h3>
      <p>${U ? `${uqLabel(g)} · ${esc(L(G.ITEM_BY_ID[g.id].name))}` : esc(L(r.name))} · ${esc(t('slot_' + slot))} · ${esc(t('ilvl', g.il))}${g.c ? ` · <b style="color:#ff5a4a">${esc(t('corrupted'))}</b>` : ''}</p>
      <p>${esc(mainLine(g))}</p>
      ${g.a.length ? `<ul class="affs">${g.a.map(a => affLine(a, g)).join('')}</ul>` : ''}
      ${U ? `<p class="uqfx">${esc(U.fx)}</p>` : ''}
      ${cmp !== null ? `<p>${esc(t('vsWorn'))}: <b style="color:${cmp >= 0 ? 'var(--good)' : 'var(--bad)'}">${cmp >= 0 ? '+' : ''}${fmt(cmp)} ${esc(t('power').toLowerCase())}</b></p>` : ''}
      <div class="act">
        ${f.worn ? `<button class="btn" data-act="unequip">${esc(t('unequip'))}</button>` : `<button class="btn gold" data-act="equip">${esc(t('equip'))}</button>`}
        <button class="btn ${canE ? 'gold' : ''}" data-act="enchant" ${g.e >= G.ENCHANT_MAX ? 'disabled' : ''}>${esc(t('enchant'))} ${g.e >= G.ENCHANT_MAX ? t('max') : `${img('ic_shard', '', 2)}${fmt(ec.shards)} ${img('ic_coin', '', 2)}${fmt(ec.gold)}`}</button>
        ${f.worn ? '' : `<button class="btn red" data-act="salvage">${esc(t('salvage'))} +${fmt(G.salvageValue(g))}</button>`}
      </div>`;
  };
  // ---------- The Town (2.4): one window per building, over the field ----------
  // Forge: the party's gear, big and plain: who wears what, the bag, what an item would change, and the
  // buttons that matter (equip, equip best for everyone, upgrade, break down). The Enchanter is the same
  // window with the orbs first. Alchemist: brew the potion you want. Tavern: the party and new recruits.
  const tw = { id: null, who: -1, sel: null, filter: 'all', salv: 2 };
  const twEl = () => $('#townWin');
  UI.townOpen = function (id, sub) {
    if (!G.R.town) return;
    // a page's id opens the building that holds it
    if (!BLDS[id] && TAB_BLD[id]) { sub = id; id = TAB_BLD[id]; }
    const B = BLDS[id]; if (!B) return;
    if (!bldOpen(id)) { G.Audio.error(); UI.toast(esc(t('bldOpens', t('lock_' + id))), '', 'ic_scroll'); return; }
    if (!sub || !B.subs.includes(sub) || !subOpen(sub)) sub = B.subs.find(subOpen);
    tw.id = id; tw.sub = sub; tw.sel = null;
    if (tab === 'set') tab = 'upg';
    wtab = CUSTOM[sub] ? null : sub;
    G.S.seen.tabs[sub] = 1; pingT = 0;
    if (tw.who >= (G.S.party || []).length) tw.who = -1;
    twEl().hidden = false;
    UI.render();
    if (CUSTOM[sub]) renderTown();
    const sc = twEl().querySelector('.twTabBody'); if (sc) sc.scrollTop = 0;
  };
  UI.townClose = function (quiet) {
    const had = !!wtab;
    tw.id = null; wtab = null;
    const el = twEl(); if (el) { el.hidden = true; el.innerHTML = ''; }
    if (had && !quiet) UI.render(); else if (!quiet && G.R.town) UI.render();
  };
  // a building's tabs (the Tavern: party, character, ladder; the Museum: collection, trophies)
  function twSubRow(id) {
    const B = BLDS[id]; if (!B || B.subs.length < 2) return '';
    return `<nav class="twSubs">${B.subs.map(x => `<button class="${x === tw.sub ? 'on' : ''}" data-twsub="${x}" ${subOpen(x) ? '' : 'disabled'}>${esc(x === 'tavern' ? t('twSubParty') : x === 'hero' ? t('twSubChar') : x === 'enchant' ? t('town_enchant') : x === 'gamble' ? t('gambleTab') : t('tab_' + x))}</button>`).join('')}</nav>`;
  }
  const bldVal = (id, L) => { const b = G.BLD_BY_ID[id]; return b.v >= 1 ? L * b.v : Math.round(L * b.v * 100); };
  // building it up: its level, what it gives now and next, the price
  function twBldFoot(id) {
    if (!G.BLD_BY_ID[id]) return '';
    const L = G.bldLvl(id), M = G.BLD_MAX, c = G.bldCost(id), can = L < M && G.S.gold >= c;
    return `<footer class="twBld"><span class="lv"><b>${esc(t('bldLvl', L, M))}</b>${'<i class="pip on"></i>'.repeat(L)}${'<i class="pip"></i>'.repeat(M - L)}</span>
      <span class="fx">${esc(t('bldFx_' + id, bldVal(id, L)))}${L < M ? ` <em>→ ${esc(t('bldFx_' + id, bldVal(id, L + 1)))}</em>` : ''}</span>
      ${L < M ? `<button class="btn ${can ? 'gold' : ''}" data-twbuild="${id}">${esc(t('bldUp'))} ${img('ic_coin', '', 2)}${fmt(c)}</button>` : `<b class="max">${esc(t('bldMax'))}</b>`}</footer>`;
  }
  function twFootLive() {
    const b = twEl().querySelector('[data-twbuild]'); if (!b) return;
    setClass(b, 'gold', G.S.gold >= G.bldCost(b.dataset.twbuild));
  }
  // the panel, in town: every building, what it does, how built up it is, what opens it
  renderers.towndir = function (body) {
    const S = G.S;
    body.innerHTML = `<p class="note">${esc(t('dirHint'))}</p>
      <div class="dirLvl">${esc(t('dirLvl', G.townLvl()))} <small>/ ${G.BLD.length * G.BLD_MAX}</small></div>
      <div class="dirList">${BLD_ORDER.map(id => {
        const open = bldOpen(id), L = G.bldLvl(id), sp = G.SPR.defs[BLD_SPR[id]] ? BLD_SPR[id] : 'ic_scroll';
        return `<button class="dirRow ${open ? '' : 'locked'} ${tw.id === id ? 'on' : ''}" data-dir="${id}">
          <span class="pic">${img(open ? sp : (G.SPR.defs.tw_build ? 'tw_build' : sp), '', 1)}</span>
          <span class="txt"><b>${esc(t('town_' + id))}</b><small>${open ? esc(t('bldLvl', L, G.BLD_MAX) + ' · ' + (L ? '' : t('bldNext') + ': ') + t('bldFx_' + id, bldVal(id, Math.max(1, L)))) : esc(t('bldLocked') + ': ' + t('bldOpens', t('lock_' + id)))}</small></span>
          <span class="dot" hidden></span><i class="up" hidden>▲</i></button>`;
      }).join('')}</div>
      <button class="btn gold" data-dirall>${esc(t('dirBuildAll'))}</button>
      <button class="btn big" data-dirback>${esc(t('dirBack'))}</button>`;
    body.addEventListener('click', e => {
      const r = e.target.closest('[data-dir]');
      if (r) { G.Audio.unlock(); G.Audio.buy && G.Audio.buy(); UI.townOpen(r.dataset.dir); return; }
      if (e.target.closest('[data-dirback]')) { G.Audio.unlock(); G.leaveTown(); }
      if (e.target.closest('[data-dirall]')) {
        G.Audio.unlock(); let n = 0;
        for (let k = 0; k < 60; k++) { const id = BLD_ORDER.filter(bldCanBuild).sort((x, y) => G.bldCost(x) - G.bldCost(y))[0]; if (!id || !G.buildUp(id)) break; n++; }
        if (n) { G.Audio.levelUp && G.Audio.levelUp(); UI.toast(esc(t('dirBuilt', n)), 'ach', 'ic_town'); pingT = 0; UI.render(); } else G.Audio.error();
      }
    });
    refs.dir = { rows: $$('[data-dir]', body) };
  };
  updaters.towndir = function () {
    const rf = refs.dir; if (!rf) return;
    for (const r of rf.rows) {
      const id = r.dataset.dir, d = r.querySelector('.dot'), u = r.querySelector('.up'), p = bldPing(id), c = bldCanBuild(id);
      if (d.hidden === p) d.hidden = !p;
      if (u.hidden === c) u.hidden = !c;
      setClass(r, 'on', tw.id === id);
      if (r.classList.contains('locked') === bldOpen(id)) { UI.render(); return; }
    }
  };
  const memOf = who => (who >= 0 ? G.S.party[who] : null);
  const clsOf = who => (who >= 0 ? G.S.party[who].cls : G.S.hero.cls);
  const canWear = (g, who) => G.slotOf(g.id) !== 'weapon' || who < 0 || G.CLASS_BY_ID[clsOf(who)].weapons.includes(G.ITEM_TYPE[g.id]);
  function twFind(u) {
    const h = G.S.hero;
    for (const g of h.bag) if (g.u === u) return { g, worn: null, who: null };
    for (const s of G.SLOTS) if (h.eq[s] && h.eq[s].u === u) return { g: h.eq[s], worn: s, who: -1 };
    for (let i = 0; i < (G.S.party || []).length; i++) for (const s of G.SLOTS) { const g = G.S.party[i].eq[s]; if (g && g.u === u) return { g, worn: s, who: i }; }
    return null;
  }
  // what wearing g would change for this member: damage, health, crit, power
  function twCompare(g, who) {
    const m = memOf(who), base = m ? m.eq : G.S.hero.eq, slot = G.slotOf(g.id), o = m ? { cls: m.cls, lvl: G.S.hero.lvl } : undefined;
    const a = G.heroCombat(base, G.D, o), eq2 = Object.assign({}, base); eq2[slot] = g;
    const b = G.heroCombat(eq2, G.D, o);
    return [['twDps', a.dps, b.dps, v => fmt(v, true)], ['twHp', a.hp, b.hp, v => fmt(v)], ['twCrit', a.crit, b.crit, v => Math.round(v * 100) + '%'], ['twPower', a.power, b.power, v => fmt(v)]];
  }
  function twDelta(a, b, f) {
    const d = b - a, up = d > 1e-9, dn = d < -1e-9;
    return `<span><b>${esc(f(b))}</b> <em class="${up ? 'up' : dn ? 'dn' : ''}">${up ? '▲' : dn ? '▼' : '='}${up || dn ? ' ' + esc(f(Math.abs(d))) : ''}</em></span>`;
  }
  function twHeader(npc, title, sub) {
    return `<header class="twHead">${img(npc, '', 4)}<div><b>${esc(title)}</b><small>${esc(sub)}</small></div><button class="twX" data-tw="close" aria-label="${esc(t('close'))}">✕</button></header>`;
  }
  function twWhoRow() {
    const S = G.S, units = [{ who: -1, cls: S.hero.cls, eq: S.hero.eq }].concat((S.party || []).map((m, i) => ({ who: i, cls: m.cls, eq: m.eq })));
    return `<div class="twWho">${units.map(u => `<button class="${u.who === tw.who ? 'on' : ''}" data-twwho="${u.who}"><img src="${G.Doll.portrait({ cls: u.cls, eq: u.eq }, 2, true)}" alt=""><small>${esc(u.who < 0 ? (S.profile.name || t('wardenName')) : L(G.CLASS_BY_ID[u.cls].name))}</small></button>`).join('')}</div>`;
  }
  function renderForge(el) {
    const S = G.S, h = S.hero, who = tw.who, m = memOf(who), eq = m ? m.eq : h.eq, enchant = tw.id === 'enchant';
    const c = G.heroCombat(eq, G.D, m ? { cls: m.cls, lvl: h.lvl } : undefined);
    const f = tw.sel != null ? twFind(tw.sel) : null;
    if (tw.sel != null && !f) tw.sel = null;
    const slots = G.SLOTS.map(s => {
      const g = eq[s];
      return `<div class="twSlot ${g && tw.sel === g.u ? 'sel' : ''}" role="button" tabindex="0" ${g ? `data-twg="${g.u}"` : `data-twf="${s}"`}>
        <span class="lbl">${esc(t('slot_' + s))}</span>
        <span class="row">${g ? gearTile(g) : `<span class="empty">${img(SLOT_ICON[s], '', 3, { dark: true })}</span>`}
        <span class="nm" style="color:${g ? gearCol(g) : 'var(--dim)'}">${g ? esc(gearName(g)) : esc(t('twEmpty'))}</span></span></div>`;
    }).join('');
    const bag = h.bag.filter(g => tw.filter === 'all' || G.slotOf(g.id) === tw.filter)
      .sort((a, b) => G.SLOTS.indexOf(G.slotOf(a.id)) - G.SLOTS.indexOf(G.slotOf(b.id)) || b.r - a.r || b.il - a.il);
    const tiles = bag.map(g => {
      const sl = G.slotOf(g.id), ok = canWear(g, who), d = ok ? G.powerWith(sl, g, who) - G.powerWith(sl, eq[sl], who) : 0;
      return `<span class="twTile ${ok ? '' : 'no'} ${d > 0 ? 'better' : ''} ${tw.sel === g.u ? 'sel' : ''}" data-twg="${g.u}">${gearTile(g)}${d > 0 ? '<i class="up">▲</i>' : ''}</span>`;
    }).join('');
    // the item card
    let card = `<div class="twCard empty"><p>${esc(t(enchant ? 'twPickEnchant' : 'twPick'))}</p></div>`;
    if (f) {
      const g = f.g, slot = G.slotOf(g.id), U = g.q ? G.UNIQUES[g.q] : null, ec = G.enchantCost(g);
      const canE = g.e < G.ENCHANT_MAX && h.shards >= ec.shards && S.gold >= ec.gold;
      const wearer = f.who != null ? f.who : who;
      const cmp = f.worn ? null : (canWear(g, who) ? twCompare(g, who) : null);
      card = `<div class="twCard">
        <h3 style="color:${gearCol(g)}">${gearTile(g)} ${esc(gearName(g))}</h3>
        <p class="sub">${U ? `${uqLabel(g)} · ` : ''}${esc(L(G.RARITIES[g.r].name))} · ${esc(t('slot_' + slot))} · ${esc(t('ilvl', g.il))}${f.worn ? ' · <b class="worn">' + esc(t('twWornBy', wearer < 0 ? (S.profile.name || t('wardenName')) : L(G.CLASS_BY_ID[clsOf(wearer)].name))) + '</b>' : ''}</p>
        <p class="main">${esc(mainLine(g))}</p>
        ${g.a.length ? (enchant && !g.q && !g.c ? `<ul class="affs seal">${g.a.map((a, i) => affLine(a, g).replace(/<\/li>$/, ` <button class="sealB ${g.lk === i ? 'on' : ''}" data-twseal="${i}">${esc(g.lk === i ? t('sealed') : t('seal'))}</button></li>`)).join('')}</ul><p class="hint">${esc(t('sealHint', fmt(G.sealCost(g))))}</p>` : `<ul class="affs">${g.a.map(a => affLine(a, g)).join('')}</ul>`) : ''}
        ${U ? `<p class="uqfx">${esc(U.fx)}</p>` : ''}
        ${cmp ? `<div class="twCmp"><small>${esc(t('twIfWorn', who < 0 ? (S.profile.name || t('wardenName')) : L(G.CLASS_BY_ID[clsOf(who)].name)))}</small>${cmp.map(([k, a, b, fm]) => `<span>${esc(t(k))}</span>${twDelta(a, b, fm)}`).join('')}</div>` : (!f.worn && !canWear(g, who) ? `<p class="warn">${esc(t('twWrongClass'))}</p>` : '')}
        <div class="twActs">
          ${f.worn ? `<button class="btn" data-twa="unequip">${esc(t('unequip'))}</button>` : `<button class="btn gold" data-twa="equip" ${canWear(g, who) ? '' : 'disabled'}>${esc(t('twEquipOn', who < 0 ? (S.profile.name || t('wardenName')) : L(G.CLASS_BY_ID[clsOf(who)].name)))}</button>`}
          <button class="btn ${canE ? 'gold' : ''}" data-twa="enchant" ${g.e >= G.ENCHANT_MAX ? 'disabled' : ''}>${esc(t('twUpgrade', g.e + 1))} ${g.e >= G.ENCHANT_MAX ? t('max') : `${img('ic_shard', '', 2)}${fmt(ec.shards)} ${img('ic_coin', '', 2)}${fmt(ec.gold)}`}</button>
          ${f.worn ? '' : `<button class="btn red" data-twa="salvage">${esc(t('salvage'))} +${fmt(G.salvageValue(g))} ${img('ic_shard', '', 2)}</button>`}
        </div>
        <p class="hint">${esc(t('twUpgradeHint', g.e, G.ENCHANT_MAX))}</p>
        <div class="twOrbs"><small>${esc(t('twOrbs'))}</small>${orbBar(g)}</div>
      </div>`;
    }
    const filters = ['all'].concat(G.SLOTS).map(k => `<button class="${tw.filter === k ? 'on' : ''}" data-twflt="${k}">${esc(k === 'all' ? t('twAll') : t('slot_' + k))}</button>`).join('');
    const better = h.bag.some(g => { const sl = G.slotOf(g.id); return canWear(g, who) && G.powerWith(sl, g, who) > G.powerWith(sl, eq[sl], who); });
    el.innerHTML = `<div class="tw forge ${enchant ? 'ench' : ''}">
      ${twHeader(enchant ? 'npc_witch' : 'npc_smith', t(enchant ? 'town_enchant' : 'town_forge'), t(enchant ? 'twEnchSub' : 'twForgeSub'))}
      ${twWhoRow()}
      <div class="twBody">
        <div class="twDoll">
          <div class="twPortrait"><img src="${G.Doll.portrait(m ? { cls: m.cls, eq: m.eq } : h, 5)}" alt=""></div>
          <div class="twSlots">${slots}</div>
          <div class="twStat"><span>${esc(t('twPower'))}</span><b>${fmt(c.power)}</b><span>${esc(t('twDps'))}</span><b>${fmt(c.dps, true)}</b><span>${esc(t('twHp'))}</span><b>${fmt(c.hp)}</b></div>
          <button class="btn gold big ${better ? 'pulse' : ''}" data-twa="best">${esc(t('twBest'))}</button>
          <label class="twAuto"><input type="checkbox" data-twauto ${h.auto ? 'checked' : ''}> ${esc(t('twAutoEq'))}</label>
        </div>
        <div class="twBag">
          <div class="twBagHead"><b>${esc(t('twBag', h.bag.length, G.TUNE.bagMax))}</b><span class="flt">${filters}</span></div>
          <div class="twGrid">${tiles || `<p class="note">${esc(t('bagEmpty'))}</p>`}</div>
          <div class="twSalv">${img('ic_shard', '', 2)} <b>${fmt(h.shards)}</b> ${esc(t('twShards'))}
            <button class="btn red" data-twa="salvall">${esc(t('twSalvAll', L(G.RARITIES[tw.salv].name)))}</button>
            <select data-twsalv>${G.RARITIES.slice(1, 6).map((r, i) => `<option value="${i + 1}" ${tw.salv === i + 1 ? 'selected' : ''}>${esc(L(r.name))}</option>`).join('')}</select></div>
        </div>
        ${card}
      </div></div>`;
  }
  // 3.1: the Gambler, at the Enchanter's: shards for a mystery item of the slot you pick
  function renderGamble(el) {
    const h = G.S.hero, c = G.gambleCost(), can = h.shards >= c, last = tw.gamb;
    const cap = G.RARITIES[G.rarityCap()];
    el.innerHTML = `<div class="tw gamble">${twHeader('npc_witch', t('gambleTitle'), t('gambleSub'))}
      <div class="gmb">
        <p class="note">${esc(t('gambleHint', L(cap.name), Math.round(G.GAMBLE_UQ * 100)))}</p>
        <div class="gmbHave">${img('ic_shard', '', 3)} <b>${fmt(h.shards)}</b> ${esc(t('twShards'))}</div>
        <div class="gmbSlots">${G.SLOTS.map(s => `<button class="gmbSlot ${can ? '' : 'no'}" data-twgamb="${s}">${img(SLOT_ICON[s], '', 5)}<b>${esc(t('slot_' + s))}</b><small>${img('ic_shard', '', 2)}${fmt(c)}</small></button>`).join('')}</div>
        ${last ? `<div class="gmbRes ${last.q ? 'uq' : ''} ${last.fresh ? 'pop' : ''}" style="--rc:${last.col}">${last.g ? gearTile(last.g) : ''}<div><b style="color:${last.col}">${esc(last.name)}</b><small>${esc(last.sub)}</small></div></div>` : ''}
      </div></div>`;
    if (last) last.fresh = false;
  }
  function renderAlch(el) {
    const S = G.S, D = G.D;
    const rows = G.POTIONS.map(p => {
      const n = S.pots[p.id] || 0, full = n >= D.potCap, c = G.brewCost(p.id), can = !full && S.gold >= c;
      return `<div class="twPot">${img('pot_' + p.id, '', 4)}<div><b>${esc(L(p.name))}</b><small>${esc(L(p.desc))}</small><i class="bar"><u style="width:${Math.min(100, n / D.potCap * 100)}%;background:${p.color}"></u></i><small>${n} / ${D.potCap}</small></div>
        <button class="btn ${can ? 'gold' : ''}" data-twbrew="${p.id}" ${full ? 'disabled' : ''}>${full ? esc(t('max')) : `${esc(t('twBrew'))} ${img('ic_coin', '', 2)}${fmt(c)}`}</button></div>`;
    }).join('');
    el.innerHTML = `<div class="tw alch">${twHeader('npc_alch', t('town_alch'), t('twAlchSub'))}<div class="twPots">${rows}</div></div>`;
  }
  function renderTavern(el) {
    const S = G.S, slots = G.partySlots(), party = S.party || [];
    const mem = party.map((m, i) => `<div class="twMem"><img src="${G.Doll.portrait({ cls: m.cls, eq: m.eq }, 3, true)}" alt=""><b>${esc(L(G.CLASS_BY_ID[m.cls].name))}</b><small class="r_${G.ROLES[m.cls]}">${esc(G.ROLE_NAMES[G.ROLES[m.cls]])}</small><button class="btn" data-twgear="${i}">${esc(t('twGearUp'))}</button></div>`).join('');
    const open = slots - party.length;
    const recruits = open > 0 ? `<p>${esc(t('twRecruitN', open))}</p><div class="twRecruit">${G.CLASSES.map(c => `<button class="clsCard" data-twrec="${c.id}">${img(c.spr, '', 5)}<b>${esc(L(c.name))}</b><small class="r_${G.ROLES[c.id]}">${esc(G.ROLE_NAMES[G.ROLES[c.id]])}</small></button>`).join('')}</div>` : `<p class="note">${esc(t(slots >= 3 ? 'twPartyFull' : 'twNextSlot', (G.PARTY_AT || [])[slots] || ''))}</p>`;
    el.innerHTML = `<div class="tw tavern">${twHeader('npc_keeper', t('town_tavern'), t('twTavernSub'))}
      <div class="twParty"><div class="twMem lead"><img src="${G.Doll.portrait(S.hero, 3)}" alt=""><b>${esc(S.profile.name || t('wardenName'))}</b><small>${esc(L(G.CLASS_BY_ID[S.hero.cls].name))} · ${esc(t('lvl'))} ${S.hero.lvl}</small><button class="btn" data-twgear="-1">${esc(t('twGearUp'))}</button></div>${mem}</div>
      ${recruits}</div>`;
  }
  function renderTown(full) {
    const el = twEl(); if (!el || !tw.id) return;
    if (!G.S.hero || !G.S.hero.cls) { UI.townClose(); return; }
    if (tw.who >= (G.S.party || []).length) { tw.who = -1; tw.sel = null; }
    const B = BLDS[tw.id];
    if (!CUSTOM[tw.sub]) {
      // a page hosted here: its renderer draws it once (full), its updater keeps it live
      if (!full) { twFootLive(); return; }
      const old = el.querySelector('.twTabBody'), y = old ? old.scrollTop : 0;
      el.innerHTML = `<div class="tw host">${twHeader(B.npc, t('town_' + tw.id), t(B.sub || 'twTavernSub'))}${twSubRow(tw.id)}
        <div class="twTabHead"><b>${esc(tw.sub === 'hero' ? t('twSubChar') : t('tab_' + tw.sub))}</b><small id="tabSub"></small></div><div class="tabBody twTabBody"></div>${twBldFoot(tw.id)}</div>`;
      const body = el.querySelector('.twTabBody');
      (renderers[tw.sub] || (() => {}))(body);
      body.scrollTop = y;
      return;
    }
    const sc = el.querySelector('.twBody, .twPots, .tw.tavern'), y = sc ? sc.scrollTop : 0, gy = el.querySelector('.twGrid') ? el.querySelector('.twGrid').scrollTop : 0;
    if (tw.id === 'forge' || (tw.id === 'enchant' && tw.sub !== 'gamble')) renderForge(el);
    else if (tw.sub === 'gamble') renderGamble(el);
    else if (tw.id === 'alch') renderAlch(el);
    else if (tw.id === 'tavern') renderTavern(el);
    const head = el.querySelector('.twHead'); if (head) head.insertAdjacentHTML('afterend', twSubRow(tw.id));
    const root = el.querySelector('.tw'); if (root) root.insertAdjacentHTML('beforeend', twBldFoot(tw.id));
    const sc2 = el.querySelector('.twBody, .twPots, .tw.tavern'); if (sc2) sc2.scrollTop = y;
    const g2 = el.querySelector('.twGrid'); if (g2) g2.scrollTop = gy;
  }
  UI.townRender = renderTown;
  function bindTown() {
    const el = twEl(); if (!el) return;
    el.addEventListener('pointerdown', () => { tw.down = true; });
    window.addEventListener('pointerup', () => { tw.down = false; });
    el.addEventListener('change', e => {
      if (e.target.matches('[data-twauto]')) { G.S.hero.auto = e.target.checked; }
      if (e.target.matches('[data-twsalv]')) { tw.salv = +e.target.value; renderTown(); }
    });
    el.addEventListener('click', e => {
      // (a page hosted here handles its own clicks)
      if (e.target.closest('.twTabBody')) return;
      const b = e.target.closest('[data-tw],[data-twwho],[data-twg],[data-twf],[data-twflt],[data-twa],[data-twbrew],[data-twrec],[data-twgear],[data-orb],[data-twsub],[data-twbuild],[data-twgamb],[data-twseal]');
      if (!b) { if (e.target === el) UI.townClose(); return; }
      G.Audio.unlock();
      const h = G.S.hero;
      if (b.dataset.tw === 'close') { UI.townClose(); return; }
      if (b.dataset.twsub) { UI.townOpen(tw.id, b.dataset.twsub); return; }
      if (b.dataset.twgamb) {
        const r = G.gamble(b.dataset.twgamb);
        if (!r) { G.Audio.error(); UI.toast(esc(t('gambleNo')), '', 'ic_shard'); return; }
        const g = r.g || null, rar = G.RARITIES[r.it.r];
        tw.gamb = { g, q: r.q, fresh: true, col: r.q ? G.UNIQUE_COL : rar.color, name: g ? gearName(g) : L(r.it.name), sub: r.q ? t('unique') + ' · ' + G.UNIQUES[r.q].fx : L(rar.name) + ' · ' + t('slot_' + r.slot) + (g && G.S.hero.eq[r.slot] === g ? ' · ' + t('equipped') : '') };
        if (r.q || r.it.r >= 4) { G.Audio.levelUp && G.Audio.levelUp(); } else G.Audio.buy();
        G.dirty(); G.recalc(); renderTown(); UI.update(true); return;
      }
      if (b.dataset.twseal != null) {
        const f = tw.sel != null ? twFind(tw.sel) : null;
        if (!f || !G.sealAffix(f.g, +b.dataset.twseal)) { G.Audio.error(); return; }
        G.Audio.buy(); renderTown(); UI.update(true); return;
      }
      if (b.dataset.twbuild) {
        const id = b.dataset.twbuild;
        if (G.buildUp(id)) { G.Audio.levelUp && G.Audio.levelUp(); UI.toast(esc(t('bldDone', t('town_' + id), G.bldLvl(id))), 'ach', G.SPR.defs[BLD_SPR[id]] ? BLD_SPR[id] : 'ic_town'); pingT = 0; UI.render(); if (CUSTOM[tw.sub]) renderTown(); }
        else G.Audio.error();
        return;
      }
      if (b.dataset.twwho != null) { tw.who = +b.dataset.twwho; tw.sel = null; }
      else if (b.dataset.twg != null) { tw.sel = +b.dataset.twg; }
      else if (b.dataset.twf != null) { tw.filter = b.dataset.twf; tw.sel = null; }
      else if (b.dataset.twflt != null) { tw.filter = b.dataset.twflt; }
      else if (b.dataset.twgear != null) { tw.who = +b.dataset.twgear; UI.townOpen('forge'); return; }
      else if (b.dataset.twrec) { if (G.recruit(b.dataset.twrec)) { G.Audio.levelUp && G.Audio.levelUp(); UI.toast(esc(t('twRecruited', L(G.CLASS_BY_ID[b.dataset.twrec].name))), 'ach', G.CLASS_BY_ID[b.dataset.twrec].spr); } else G.Audio.error(); }
      else if (b.dataset.twbrew) { const p = G.brewPotion(b.dataset.twbrew); if (p) G.Audio.buy(); else G.Audio.error(); }
      else if (b.dataset.orb) {
        const f = tw.sel != null ? twFind(tw.sel) : null;
        if (!f) { G.Audio.error(); return; }
        const res = G.useOrb(b.dataset.orb, f.g); if (!res) G.Audio.error();
      } else if (b.dataset.twa) {
        const a = b.dataset.twa, f = tw.sel != null ? twFind(tw.sel) : null;
        if (a === 'best') { const n = G.equipBest(); if (n) { G.Audio.levelUp && G.Audio.levelUp(); UI.toast(esc(t('twBestDone', n)), 'ach', 'ic_sword'); } else UI.toast(esc(t('twBestNone')), '', 'ic_sword'); }
        else if (a === 'salvall') { const r = G.salvageBelow(tw.salv); if (r.n) G.Audio.buy(); }
        else if (f && a === 'equip') { if (canWear(f.g, tw.who)) { G.equip(f.g, false, tw.who); G.Audio.buy(); } }
        else if (f && a === 'unequip') { G.unequip(f.worn, f.who); }
        else if (f && a === 'enchant') { if (G.enchant(f.g)) G.Audio.buy(); else G.Audio.error(); }
        else if (f && a === 'salvage') { G.salvage(f.g); tw.sel = null; G.Audio.buy(); }
      }
      G.dirty(); G.recalc(); renderTown(); UI.update(true);
    });
  }

  let pickWait = 0;
  UI.pickClass = function () {
    if (G.S.hero.cls) return;
    // Let the cloud save answer first: a returning player on a new device gets their hero back
    const N = G.Net;
    if (N && N.hold && N.cloud && $('#modal').hidden && $('#intro').hidden) { askCloud(N.cloud); setTimeout(UI.pickClass, 500); return; }
    if (!$('#modal').hidden || !$('#intro').hidden || (N && N.hold) || (N && N.status === 'connecting' && pickWait++ < 16)) { setTimeout(UI.pickClass, 500); return; }
    const html = `<p>${esc(t('pickClassHint'))}</p><div class="classGrid">${G.CLASSES.map(c => `
      <button class="clsCard" data-c="${c.id}">${img(c.spr, '', 6)}<b>${esc(L(c.name))}</b><small>${esc(L(c.desc))}</small></button>`).join('')}</div>`;
    const m = UI.modal(t('pickClass'), html, [], true);
    m.querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', () => {
      G.chooseClass(b.dataset.c);
      if (!G.S.profile.name && G.Net && G.Net.myName) { G.S.profile.name = G.Net.myName.trim().split(/\s+/)[0].slice(0, 16); setTimeout(() => UI.toast(esc(t('onLadderAs', G.S.profile.name)), '', 'ic_crown'), 4000); }
      m.hidden = true; m.innerHTML = '';
      UI.render();
    }));
  };


  // Rifts: pick a level, open it, see how friends are doing
  let riftSel = null;
  renderers.rift = function (body) {
    const S = G.S, rf = S.rift;
    if (!G.riftOpenable()) { body.innerHTML = `<p class="note">${esc(t('riftLocked'))}</p>`; return; }
    if (riftSel == null || riftSel > G.riftMax()) {
      // start on the highest level the Warden can clear comfortably, or one past the best
      const D = G.D, mx = G.riftMax();
      let pick = 1;
      for (let L = mx; L >= 1; L--) if ((D.heroDps || 0) / G.mobHp(G.riftDepth(L)) >= 6) { pick = L; break; }
      riftSel = Math.min(mx, Math.max(pick, rf.best ? rf.best + 1 : 1));
    }
    body.innerHTML = `
      <div class="detail riftBox">
        <p class="note">${esc(t('riftIntro', G.TUNE.riftTime))}</p>
        <div class="riftPick">
          <button class="btn" data-rl="-5">-5</button><button class="btn" data-rl="-1">-</button>
          <span class="rl"><small>${esc(t('riftLevel'))}</small><b data-rlv></b></span>
          <button class="btn" data-rl="1">+</button><button class="btn" data-rl="max">${esc(t('max'))}</button>
        </div>
        <p data-rinfo></p>
        <button class="btn gold big" data-ropen></button>
      </div>
      <div class="statList" data-rstats></div>
      <div class="sect">${esc(t('riftFriends'))}</div>
      <div class="ladder" data-rlist></div>`;
    refs.rift = { lv: body.querySelector('[data-rlv]'), info: body.querySelector('[data-rinfo]'), open: body.querySelector('[data-ropen]'), stats: body.querySelector('[data-rstats]'), list: body.querySelector('[data-rlist]'), key: '' };
    body.addEventListener('click', e => {
      const b = e.target.closest('[data-rl]');
      if (b) { const v = b.dataset.rl; riftSel = v === 'max' ? G.riftMax() : Math.max(1, Math.min(G.riftMax(), riftSel + +v)); updaters.rift(true); return; }
      if (e.target.closest('[data-ropen]')) {
        G.Audio.unlock();
        if (G.R.town) G.leaveTown();
        // (a boss in the way steps aside for the Rift; it comes back after)
        if (G.R.boss && !G.R.rift) G.fleeBoss();
        if (!G.riftStart(riftSel)) { G.Audio.error(); UI.toast(esc(t('riftBusy')), '', 'ic_rift'); return; }
        updaters.rift(true);
      }
    });
  };
  updaters.rift = function (force) {
    const S = G.S, D = G.D, rf = S.rift, r = refs.rift, R = G.R;
    if (!r) return;
    const d = G.riftDepth(riftSel), realm = G.REALMS[G.realmIndex(d)];
    const might = (D.heroDps || 0) / G.mobHp(d);
    setText(r.lv, String(riftSel));
    const col = might >= 6 ? 'var(--good)' : might >= 2.5 ? '#ffe27a' : 'var(--bad)';
    const info = `${esc(t('riftHere', d + 1, G.realmName(d)))} <b style="color:${col}">${esc(t('riftCan', t(might >= 6 ? 'riftEasy' : might >= 2.5 ? 'riftEven' : 'riftHard')))}</b>`;
    if (r.info._h !== info) { r.info.innerHTML = info; r.info._h = info; }
    setText(r.open, R.rift ? t('riftName', R.rift.lvl) + ' · ' + Math.ceil(R.rift.t) + 's' : t('riftOpenBtn', riftSel));
    r.open.disabled = !!(R.rift || R.boss);
    const today = rf.day.k === G.utcDayKey() ? rf.day.l : 0;
    const stats = [[t('riftBest'), rf.best ? rf.best + ' · ' + G.fmtTime(rf.bestT) : '—'], [t('riftToday'), today || '—'], [t('riftLevel') + ' max', G.riftMax()], [t('riftRuns'), fmt(rf.runs)]];
    const sh = stats.map(([k, v]) => `<span>${esc(k)}</span><b>${esc(v)}</b>`).join('');
    if (r.stats._h !== sh) { r.stats.innerHTML = sh; r.stats._h = sh; }
    setText($('#tabSub'), t('riftBest') + ' ' + (rf.best || '—'));
    const N = G.Net, list = N ? N.sorted('rift').filter(e => (e.rift || 0) > 0) : [];
    const key = JSON.stringify(list.map(e => [e.uid, e.rift, e.rt, e.rd]));
    if (key === r.key && !force) return;
    r.key = key;
    r.list.innerHTML = list.length ? list.slice(0, 30).map((e, i) => ladderRow(e, i, 'rift')).join('') : `<p class="note">${esc(t('riftNoFriends'))}</p>`;
  };

  // Ladder: shared ranking and cloud save status
  let ladderBy = 'depth';
  const LADDER_BY = ['depth', 'power', 'rift', 'today', 'stars', 'uq', 'mad', 'crowns', 'firsts'];
  const LADDER_LBL = { depth: 'byDepth', power: 'byPower', rift: 'byRift', today: 'byToday', stars: 'byStars', uq: 'byUq', mad: 'byMad', crowns: 'byCrowns', firsts: 'byFirsts' };
  const nameOf = e => G.Net.displayName(e) || t('anon');
  // Lord crowns: the fastest fresh kill of each lord among everyone
  function crownBoard() {
    const N = G.Net, list = N.entries.filter(e => e.ok || e.me), S = G.S;
    const rows = [];
    const top = Math.max(S.bestDepth, ...list.filter(e => e.ok).flatMap(e => Object.keys(e.cr || {}).map(Number)).filter(n => n < 100000));
    for (let d = G.REALM_SIZE - 1; d <= top; d += G.REALM_SIZE) {
      const best = list.filter(e => e.cr && e.cr[d]).sort((a, b) => a.cr[d] - b.cr[d])[0];
      const mine = S.rec.crowns && S.rec.crowns[d];
      rows.push(`<div class="lrow crow ${best && best.me ? 'me' : ''}"><b class="rk">${best ? '\u{1F451}' : '·'}</b>
        <span class="nm">${esc(G.bossName(d))}<small>${esc(t('depthShort'))} ${d + 1}${mine ? ' · ' + esc(t('crownYours', mine)) : ''}</small></span>
        <span class="v"><b>${best ? esc(nameOf(best)) : esc(t('noCrown'))}</b><small>${best ? best.cr[d] + 's' : ''}</small></span></div>`);
    }
    return `<p class="note">${esc(t('crownsHint'))}</p>` + rows.join('');
  }
  // Firsts: the first three to reach each milestone
  function firstsBoard() {
    const N = G.Net, list = N.entries.filter(e => e.ok || e.me);
    const medal = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];
    return `<p class="note">${esc(t('firstsHint'))}</p>` + G.FIRSTS.map(([k, label]) => {
      const top = list.filter(e => e.fs && e.fs[k]).sort((a, b) => a.fs[k] - b.fs[k]).slice(0, 3);
      return `<div class="lrow first"><span class="nm">${esc(label)}</span><span class="v fsv">${top.length ? top.map((e, i) => `<small class="${e.me ? 'me' : ''}">${medal[i]} ${esc(nameOf(e))}</small>`).join('') : `<small>${esc(t('noCrown'))}</small>`}</span></div>`;
    }).join('');
  }
  // What the row shows on the right for each ranking
  function ladderVal(e, by) {
    if (by === 'rift') return [t('riftName', e.rift || 0), e.rt ? G.fmtTime(e.rt) : ''];
    if (by === 'today') return [t('riftName', (e.rd && e.rd.l) || 0), e.rd && e.rd.t ? G.fmtTime(e.rd.t) : t('riftToday')];
    if (by === 'uq') return [(e.uq || 0) + ' / ' + G.UNIQUE_IDS.length, t('uniques')];
    if (by === 'stars') return ['\u2605 ' + (e.ls || 0) + ' / ' + 3 * G.REALMS.length, t('byStars')];
    if (by === 'mad') return [G.fmtTime(e.mad || 0), t('byMad')];
    return [t('depthShort') + ' ' + (e.depth + 1), t('gearScore') + ' ' + fmt(e.power || 0)];
  }
  function ladderRow(e, i, by) {
    const cls = G.CLASS_BY_ID[e.cls] || G.CLASSES[0], N = G.Net;
    const nm = N.displayName(e) || t('anon'), v = ladderVal(e, by);
    const acc = N.accountName(e);
    const age = e.ts ? (Date.now() - e.ts) / 1000 : 0, stale = age > 14 * 86400;
    return `<div class="lrow ${e.me ? 'me' : ''} ${e.ok ? '' : 'bad'} ${stale ? 'stale' : ''}" data-uid="${esc(e.uid)}" role="button" tabindex="0">
        <b class="rk">${i + 1}</b><img class="ldoll" src="${G.Doll.portrait(G.Doll.fromSnapshot(e), 2, true)}" alt="">
        <span class="nm">${esc(nm)}${e.me ? ' · ' + esc(t('you')) : ''}<small>${esc(L(cls.name))} · ${esc(t('lvl'))} ${e.lvl}${acc && acc !== nm ? ' · ' + esc(acc) : ''}${!e.me && age > 3600 ? ' · ' + esc(t('seenAgo', G.fmtTime(Math.floor(age / 3600) * 3600))) : ''}${e.ok ? '' : ' · ' + esc(t('unverified'))}</small></span>
        <span class="v"><b>${esc(v[0])}</b><small>${esc(v[1])}</small></span>
      </div>`;
  }
  // Everyone's recent big moments, newest first
  function feedHtml() {
    const N = G.Net, rows = [];
    for (const e of N.entries) { if (!e.ok && !e.me) continue; for (const f of Array.isArray(e.ev) ? e.ev : []) if (Array.isArray(f) && typeof f[1] === 'string' && f[1] && typeof f[0] === 'number') rows.push({ e, ts: f[0], k: f[1], s: String(f[2] || '') }); }
    rows.sort((a, b) => b.ts - a.ts);
    if (!rows.length) return `<p class="note">${esc(t('feedEmpty'))}</p>`;
    const icon = { uq: 'orb_grace', rift: 'ic_rift', lord: 'ic_skull', divine: 'it_halo', mad: 'ic_crown', evo: 'ic_star', crown: 'ic_crown', jackpot: 'ic_jackpot', relic: G.SPR.defs.rx_bag ? 'rx_bag' : 'ic_jackpot', spin: 'ic_coin' };
    return rows.slice(0, 12).map(r => `<div class="feedRow">${img(icon[r.k] || 'ic_star', '', 2)}<span><b>${esc(N.displayName(r.e) || t('anon'))}</b> ${esc(t('feed' + r.k[0].toUpperCase() + r.k.slice(1), r.s))}</span><small>${esc(G.fmtTime(Math.max(1, (Date.now() - r.ts) / 1000)))}</small></div>`).join('');
  }
  renderers.ladder = function (body) {
    const S = G.S, N = G.Net;
    body.innerHTML = `
      <div class="detail" data-net></div>
      <div class="tabTitle" style="padding:8px 4px"><small>${esc(t('rankBy'))}</small>
        <span class="seg" data-by>${LADDER_BY.map(b => `<button data-b="${b}" class="${ladderBy === b ? 'on' : ''}">${esc(t(LADDER_LBL[b]))}</button>`).join('')}</span></div>
      <div class="ladder" data-list></div>
      <div class="sect">${esc(t('recent'))} <button class="btn" data-brag style="float:right">${esc(t('brag'))}</button></div>
      <div class="feed" data-feed></div>
      <p class="note">${esc(t('ladderRules'))}</p>`;
    refs.lad = { net: body.querySelector('[data-net]'), list: body.querySelector('[data-list]'), feed: body.querySelector('[data-feed]'), key: '' };
    body.addEventListener('click', e => {
      const b = e.target.closest('[data-b]');
      if (b) { ladderBy = b.dataset.b; $$('[data-by] button', body).forEach(x => x.classList.toggle('on', x === b)); refs.lad.key = ''; updaters.ladder(true); return; }
      if (e.target.closest('[data-push]')) { N.pushNow(); UI.toast(esc(t('synced')), '', 'ic_crown'); return; }
      if (e.target.closest('[data-brag]')) {
        const h = S.hero, snap = G.ladderSnapshot(), crowns = Object.keys(S.rec.crowns || {}).filter(d => { const mine = S.rec.crowns[d]; return !N.entries.some(e => !e.me && e.cr && e.cr[d] && e.cr[d] < mine); }).length;
        const grid = G.UNIQUE_IDS.map(q => S.uq[q] ? '\u{1F7E7}' : '\u2B1B').join('');
        // only what's worth saying: zeros stay out
        const parts = ['\u2694 ' + t('depth') + ' ' + (S.bestDepth + 1)];
        if (S.rift.best) parts.push('\u25c8 ' + t('riftName', S.rift.best));
        if (snap.ls) parts.push('\u2605 ' + snap.ls + ' ' + t('byStars').toLowerCase());
        if (crowns) parts.push('\u{1F451} ' + crowns);
        const txt = t('bragText', L((G.CLASS_BY_ID[h.cls] || G.CLASSES[0]).name), snap.lvl, fmt(snap.power), parts.join(' · '), Object.keys(S.uq).length, G.UNIQUE_IDS.length, grid) + '\n' + t('bragJoin', G.SHARE_URL);
        // a box to copy from, since the clipboard may be refused inside the page
        const m = UI.modal(t('bragTitle'), `<textarea class="bragBox" readonly rows="6">${esc(txt)}</textarea>`, [{ label: t('bragCopy'), cls: 'gold', fn: () => { try { navigator.clipboard.writeText(txt).then(() => UI.toast(esc(t('bragged')), 'ach', 'ic_crown'), () => {}); } catch (err) { /* the text stays selectable */ } } }, { label: t('close') }]);
        const ta = m.querySelector('textarea'); if (ta) { ta.focus(); ta.select(); }
        return;
      }
      if (e.target.closest('[data-cloud]')) { askCloud(N.cloud); return; }
      if (e.target.closest('[data-name]')) { selWho = -1; selGear = null; UI.go('hero'); setTimeout(() => { const i = $('#heroName'); if (i) i.focus(); }, 50); return; }
      const row = e.target.closest('.lrow[data-uid]');
      if (row) inspect(row.dataset.uid);
    });
  };
  updaters.ladder = function (force) {
    const N = G.Net, rf = refs.lad, S = G.S;
    if (!rf) return;
    const ago = ts => ts ? t('agoT', G.fmtTime((Date.now() - ts) / 1000)) : t('notYet');
    const statusText = N.status === 'online' ? (N.mode === 'http' ? t('netHttp') : t('netArtifact'))
      : N.status === 'connecting' ? t('netConnecting') : N.status === 'error' ? t('netDown') : N.status === 'signin' ? t('netSignin') : t('netOff');
    const netHtml = `<h3>${esc(statusText)}</h3>
      ${N.isOwner ? `<div class="invite"><b>${esc(t('inviteTitle'))}</b><p>${esc(t('inviteHow'))}</p></div>` : ''}
      ${N.status === 'online' ? `<p>${esc(N.readOnly ? t('netReadOnly') + ' ' + t('readOnlyHow') : t('netSynced', ago(N.lastSaveAt), ago(N.lastLadderAt)))}</p>`
        : `<p>${esc(N.status === 'error' ? t('netDownHint') : N.status === 'signin' ? t('netSigninHint') : N.status === 'connecting' ? '' : t('netOffHint'))}</p>`}
      ${S.profile.name ? '' : `<p>${esc(t('noNameYet'))} <button class="btn" data-name>${esc(t('setName'))}</button></p>`}
      <div class="act">${N.status === 'online' && !N.readOnly ? `<button class="btn gold" data-push>${esc(t('syncNow'))}</button>` : ''}
        ${N.cloud ? `<button class="btn" data-cloud>${esc(t('loadCloud'))}</button>` : ''}</div>
      ${N.error && N.status === 'online' && !N.readOnly ? `<p style="color:var(--bad)">${esc(N.error === 'unavailable' ? t('netDown') : N.error === 'resource_exhausted' ? t('netFull') : N.error === 'revoked' || N.error === 'permission_denied' ? t('netRevoked') : t('netRetry'))}</p>` : ''}
      ${N.behind ? `<p class="note warn">${esc(t('netBehind'))}</p>` : ''}
      ${(() => { const mine = N.entries.find(e => e.me); return mine && !mine.ok ? `<p class="note warn">${esc(t('myHidden', (mine.problems || []).join(', ')))}</p>` : ''; })()}`;
    if (rf.net._h !== netHtml) { rf.net.innerHTML = netHtml; rf.net._h = netHtml; }
    const list = N.sorted(ladderBy);
    const key = ladderBy + JSON.stringify(N.entries.map(e => [e.uid, e.depth, e.power, e.lvl, N.displayName(e), N.accountName(e), e.rift, e.rd, e.uq, e.ev, e.fs, e.cr, e.mad, e.ls])) + JSON.stringify(S.rec.crowns || {});
    if (key === rf.key && !force) return;
    rf.key = key;
    const suspicious = N.entries.filter(e => !e.ok && !e.me).length;
    const fh = feedHtml();
    if (rf.feed._h !== fh) { rf.feed.innerHTML = fh; rf.feed._h = fh; }
    if (ladderBy === 'crowns' || ladderBy === 'firsts') { rf.list.innerHTML = ladderBy === 'crowns' ? crownBoard() : firstsBoard(); return; }
    if (ladderBy === 'mad' && !list.length) { rf.list.innerHTML = `<p class="note">${esc(t('madHint'))}</p>`; return; }
    if (!list.length) { rf.list.innerHTML = `<p class="note">${esc(N.status !== 'online' ? t('ladderOffline') : ['rift', 'uq', 'stars'].includes(ladderBy) ? t('beFirst') : t('ladderEmpty'))}</p>` + (suspicious ? `<p class="note">${esc(t('hiddenBad', suspicious))}</p>` : ''); return; }
    rf.list.innerHTML = list.slice(0, 100).map((e, i) => ladderRow(e, i, ladderBy)).join('') + (suspicious ? `<p class="note">${esc(t('hiddenBad', suspicious))}</p>` : '');
    const myIdx = list.findIndex(e => e.me);
    setText($('#tabSub'), myIdx >= 0 ? t('yourRank', myIdx + 1, list.length) : '');
  };
  // A friend's Warden up close: their doll, their four items and how they compare with yours
  function inspect(uid) {
    const N = G.Net, e = N.entries.find(x => x.uid === uid);
    if (!e) return;
    const mine = G.S.hero.cls ? G.ladderSnapshot() : { power: 0 };
    const rows = G.SLOTS.map(s => {
      const g = e.gear && e.gear[s];
      if (!g || !G.ITEM_BY_ID[g.id]) return `<div class="insRow"><span class="empty">—</span><b>${esc(t('slot_' + s))}</b></div>`;
      const U = g.q && G.UNIQUES[g.q], col = U ? gearCol(g) : (G.RARITIES[g.r] || G.RARITIES[0]).color;
      const name = (U ? U.name : L(G.ITEM_BY_ID[g.id].name)) + (g.e ? ' +' + g.e : '');
      return `<div class="insRow">${img(U ? 'u_' + g.q : 'it_' + g.id, '', 3)}<div><b style="color:${col}">${esc(name)}</b><small>${esc(t('ilvl', g.il))}${g.c ? ' · ' + esc(t('corrupted')) : ''}</small>
        <ul class="affs">${(Array.isArray(g.a) ? g.a : []).filter(a => Array.isArray(a) && G.AFFIXES[a[0]] && typeof a[1] === 'number').map(a => affLine(a, g)).join('')}</ul>${U ? `<small class="uqfx">${esc(U.fx)}</small>` : ''}</div></div>`;
    }).join('');
    const d = (e.power || 0) - (mine.power || 0);
    const html = `<div class="insHead"><img src="${G.Doll.portrait(G.Doll.fromSnapshot(e), 4)}" alt=""><div>
        <p><b>${esc(N.displayName(e) || t('anon'))}</b>${N.accountName(e) && N.accountName(e) !== N.displayName(e) ? ' · ' + esc(N.accountName(e)) : ''}</p>
        <p>${esc(L((G.CLASS_BY_ID[e.cls] || G.CLASSES[0]).name))} · ${esc(t('lvl'))} ${e.lvl} · ${esc(t('depthShort'))} ${(e.depth || 0) + 1} · ${esc(t('riftName', e.rift || 0))} · ${esc(t('uniques'))} ${e.uq || 0}</p>
        <p>${esc(t('gearScore'))} <b>${fmt(e.power || 0)}</b>${e.me ? '' : ` <small style="color:${d > 0 ? 'var(--bad)' : 'var(--good)'}">(${d > 0 ? '+' : ''}${fmt(d)} ${esc(t('inspectVs'))})</small>`}</p></div></div>
      <div class="insGear">${rows}</div>`;
    const acts = [{ label: t('ok'), cls: 'gold' }];
    // the owner can take a row off the ladder (a cheat, or someone who left)
    if (N.isOwner && !e.me) acts.push({ label: t('removeRow'), fn: () => N.removeRow(e.uid).then(() => UI.toast(esc(t('removed')), '', 'ic_skull'), err => UI.toast(esc(t('netError', err.code || err.message)), '', 'ic_skull')) });
    UI.modal(N.displayName(e) || t('anon'), html, acts);
  }
  function askCloud(cloud) {
    if (!cloud) return;
    const when = new Date(cloud.ts || 0).toLocaleString();
    // say what each side holds, so nobody picks blind
    const sum = x => x && x.cls ? t('cloudSum', L((G.CLASS_BY_ID[x.cls] || G.CLASSES[0]).name), x.lvl, x.depth, fmt(x.gold)) : t('cloudNew');
    const there = G.Net.saveSummary(cloud.data), here = G.Net.saveSummary(G.S);
    const keep = () => { G.Net.keepLocal(cloud); if (G.Tut) G.Tut.maybeIntro(); };
    const weaker = there && (!here || !here.cls || here.gold < there.gold);
    UI.modal(t('cloudTitle'), `<p>${esc(t('cloudText', when))}</p><div class="sumList"><div><b>${esc(t('cloudThere'))}</b><span>${esc(sum(there))}</span></div><div><b>${esc(t('cloudThis'))}</b><span>${esc(sum(here))}</span></div></div>`, [
      { label: t('cloudLoad'), cls: 'gold', fn: () => { G.Net.hold = false; if (G.Net.loadCloud()) { UI.toast(esc(t('imported')), 'ach', 'ic_scroll'); UI.render(); } else UI.toast(esc(t('badSave')), '', 'ic_skull'); } },
      { label: t('cloudKeep'), fn: () => {
        if (!weaker) { keep(); return; }
        setTimeout(() => UI.modal(t('cloudTitle'), `<p>${esc(t('cloudSure', sum(there)))}</p>`, [{ label: t('cloudLoad'), cls: 'gold', fn: () => askCloud(cloud) }, { label: t('cloudSureYes'), fn: keep }], true), 50);
      } },
    ], true); // only the two buttons close it: a stray tap must not leave the save on hold
  }

  // Settings
  renderers.set = function (body) {
    const s = G.S.set;
    const tg = (k, label) => `<div class="setRow"><span>${esc(label)}</span><button class="toggle ${s[k] ? 'on' : ''}" data-t="${k}" aria-pressed="${s[k] ? 'true' : 'false'}" aria-label="${esc(label)}"></button></div>`;
    body.innerHTML = `
      <div class="setList">
        ${tg('sound', t('sound'))}${tg('music', t('music'))}
        <div class="setRow"><span>${esc(t('volume'))}</span><input id="vol" type="range" min="0" max="1" step="0.05" value="${s.vol}"></div>
        ${tg('hold', t('hold'))}${tg('shake', t('shake'))}${tg('autoBoss', t('autoBoss'))}${tg('filter', t('lootFilter'))}
        ${window.BTTN_AN ? tg('stats', t('statsOpt')) : ''}
      </div>
      <div class="sect">${esc(t('saveTitle'))}</div>
      <p class="note">${esc(t('importHint'))}</p>
      <textarea id="saveBox" spellcheck="false" aria-label="${esc(t('saveTitle'))}"></textarea>
      <div class="acts" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
        <button class="btn" data-exp>${esc(t('export'))}</button>
        <button class="btn" data-copy>${esc(t('copy'))}</button>
        <button class="btn gold" data-imp>${esc(t('import'))}</button>
        <button class="btn" data-save>${esc(t('saveNow'))}</button>
        ${G.Net && G.Net.mode === 'artifact' && G.Net.uid ? `<button class="btn" data-restore>${esc(t('restoreBackup'))}</button>` : ''}
      </div>
      <div class="sect">&nbsp;</div>
      <button class="btn red" data-reset>${esc(t('resetBtn'))}</button>
      <p class="note" style="margin-top:14px">${esc(t('keysHint'))}</p>
      <p class="note">BTTN · ${esc(t('tagline'))}</p>`;
    body.addEventListener('click', e => {
      const tgB = e.target.closest('[data-t]');
      if (tgB) { const k = tgB.dataset.t; s[k] = s[k] ? 0 : 1; G.Audio.unlock(); G.Audio.apply(); UI.render(); return; }
      if (e.target.closest('[data-exp]')) { $('#saveBox').value = G.exportSave(); return; }
      if (e.target.closest('[data-restore]')) { G.Net.restoreBackup().then(ok => { UI.toast(esc(ok ? t('imported') : t('noBackup')), ok ? 'ach' : '', 'ic_scroll'); if (ok) UI.render(); }); return; }
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
  // 3.3: big center banners wait their turn instead of wiping each other out (a burst of loot shows one by one,
  // a little quicker when more are waiting)
  const bannerQ = [];
  let bannerBusy = false;
  function pumpBanner() {
    if (bannerBusy || !bannerQ.length) return;
    const { html, ms } = bannerQ.shift(), el = $('#banner');
    bannerBusy = true;
    el.innerHTML = html; el.hidden = false; el.classList.remove('out');
    setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.hidden = true; bannerBusy = false; pumpBanner(); }, 400); }, bannerQ.length ? ms * 0.7 : ms);
  }
  UI.bannerShow = function (html, ms) {
    if (bannerQ.length > 4) bannerQ.splice(0, bannerQ.length - 4);
    bannerQ.push({ html, ms: ms || 2000 });
    pumpBanner();
  };
  UI.banner = function (it) {
    const r = G.RARITIES[it.r];
    const title = it.r === 6 ? t('divineLoot') : it.r === 5 ? t('mythicLoot') : t('legendLoot');
    UI.bannerShow(`<div class="inner" style="color:${r.color}"><h2>${esc(title)}</h2><img class="ico" src="${ic('it_' + it.id, 10)}" alt=""><p>${esc(L(it.name))}</p></div>`, it.r >= 6 ? 2600 : 1700);
  };
  UI.bannerU = function (q, first) {
    const U = G.UNIQUES[q];
    UI.bannerShow(`<div class="inner uqb" style="color:${G.UNIQUE_COL}"><h2>${esc(first ? t('uqNew') : t('uqBanner'))}</h2><img class="ico" src="${ic('u_' + q, 10)}" alt=""><p>${esc(U.name)}</p><p style="font-size:15px;color:#ffe0c0">${esc(U.fx)}</p></div>`, 3200);
  };
  UI.modal = function (title, html, actions, locked) {
    const m = $('#modal');
    m.innerHTML = `<div class="box" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h2>${esc(title)}</h2>${html}<div class="acts">${(actions || []).map((a, i) => `<button class="btn ${a.cls || ''}" data-a="${i}">${esc(a.label)}</button>`).join('')}</div></div>`;
    m.hidden = false;
    const close = () => { m.hidden = true; m.innerHTML = ''; };
    m.onclick = e => {
      const b = e.target.closest('[data-a]');
      if (b) { const a = actions[+b.dataset.a]; close(); a.fn && a.fn(); }
      else if (e.target === m && !locked) close();
    };
    return m;
    const first = m.querySelector('[data-a]'); if (first) first.focus();
  };
  UI.offline = function (r) {
    if (!r) return;
    const html = `<p>${esc(t('awayFor', G.fmtTime(r.sec)))}</p>
      <div class="sumList">
        <div>${img('ic_coin', '', 3)}<span style="color:var(--gold)">+${fmt(r.gold)}</span></div>
        ${r.chests ? `<div>${img('ic_chest', '', 3)}<span>${esc(t('foundChests'))}: ${fmt(r.chests)}</span></div>` : ''}
        ${r.ess >= 0.1 ? `<div>${img('ic_ess', '', 3)}<span style="color:var(--ess)">+${fmt(r.ess, true)}</span></div>` : ''}
      </div>
      ${r.warden && r.warden.kills ? `<p>${esc(t('wardenAway'))}</p><div class="sumList">
        <div>${img('ic_sword', '', 3)}<span>${esc(t('offKills', fmt(r.warden.kills)))}</span></div>
        ${r.warden.levels ? `<div>${img('ic_star', '', 3)}<span style="color:#a8dcff">${esc(r.warden.levels === 1 ? t('offLevel1') : t('offLevels', r.warden.levels))}</span></div>` : ''}
        ${r.warden.perks ? `<div>${img('ic_bolt', '', 3)}<span style="color:#ffe27a">${esc(r.warden.perks === 1 ? t('offPerk1') : t('offPerks', r.warden.perks))}</span></div>` : ''}
        ${r.warden.shards ? `<div>${img('ic_shard', '', 3)}<span>${esc(t('offShards', fmt(r.warden.shards)))}</span></div>` : ''}
      </div>` : ''}`;
    UI.modal(t('welcomeBack'), html + (r.rested ? `<p style="color:#8ae07a">${esc(t('restedNote'))}</p>` : ''), [{ label: t('collect'), cls: 'gold' }]);
  };
})(globalThis.G = globalThis.G || {});
