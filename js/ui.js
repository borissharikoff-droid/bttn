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
    { id: 'hero', icon: 'ic_sword', unlock: () => true },
    { id: 'heroes', icon: 'h_knight', unlock: S => S.goldTotal >= 40 || S.ascensions > 0 },
    { id: 'coll', icon: 'ic_bag', unlock: S => S.st.chests >= 1 },
    { id: 'quests', icon: 'ic_scroll', unlock: S => S.st.chests >= 5 || S.ascensions > 0 },
    { id: 'stars', icon: 'ic_star', unlock: S => S.essRun >= 1 || Object.keys(S.nodes).length > 0 || S.ascensions > 0 },
    { id: 'pets', icon: 'egg_2', unlock: S => S.eggs > 0 || Object.keys(S.pets).length > 0 },
    { id: 'ach', icon: 'ic_trophy', unlock: S => Object.keys(S.ach).length > 0 },
    { id: 'asc', icon: 'ic_tomb', unlock: S => S.maxDepth >= 5 || S.ascensions > 0 },
    { id: 'rift', icon: 'ic_rift', unlock: S => S.bestDepth >= 5 || S.rift.runs > 0 },
    { id: 'ladder', icon: 'ic_crown', unlock: () => true },
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
    $('#perks').addEventListener('click', e => { if (performance.now() - (+$('#perks').dataset.shownAt || 0) < 600) return; const c = e.target.closest('[data-perk]'); if (c && G.pickPerk(c.dataset.perk)) { G.Audio && G.Audio.buy(); UI.update(true); } });
    if (G.Tut) G.Tut.init();
    if (!S.hero.cls) setTimeout(() => UI.pickClass(), 300);
  };
  UI.tab = () => tab;
  // the game's own link, for the brag line
  G.SHARE_URL = 'https://claude.ai/artifact/WcSxtLrabwMuEt2YcyxpWh';
  G.uiBusy = () => !$('#modal').hidden || !$('#intro').hidden;

  function buildTabs() {
    const nav = $('#tabs');
    nav.innerHTML = TABS.map((x, i) => `<button class="tab" data-tab="${x.id}" aria-label="${esc(t('tab_' + x.id))}" title="${esc(t('tab_' + x.id))}${i < 10 ? ` (${(i + 1) % 10})` : ''}">${img(x.icon, '', 3)}<span class="dot" hidden></span></button>`).join('');
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
    $('#realmBox').addEventListener('click', () => { if (G.S.hero && G.S.hero.cls) UI.worldMap(); });
    $('#realmBox').addEventListener('keydown', e => { if (e.key !== 'Enter' && e.key !== ' ') return; e.preventDefault(); e.stopPropagation(); if (G.S.hero && G.S.hero.cls) UI.worldMap(); });
    $('#btnSound').addEventListener('click', () => { G.S.set.sound = G.S.set.sound ? 0 : 1; G.Audio.unlock(); G.Audio.apply(); UI.update(true); });
    $('#btnMusic').addEventListener('click', () => { G.S.set.music = G.S.set.music ? 0 : 1; G.Audio.unlock(); G.Audio.apply(); UI.update(true); });
    $('#btnSound img').src = ic('ic_note', 3);
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
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') {
        if (tg && tg.tagName === 'BUTTON' && e.code !== 'Space') return;
        e.preventDefault();
        if (e.repeat && !G.S.set.hold) return;
        G.Stage.keyClick();
      } else if (e.code === 'KeyE' || e.code === 'KeyF') { G.Stage.keyChest(); }
      else if (e.code === 'KeyB') { G.startBoss(); }
      else if (e.code === 'KeyQ') { G.castAbility(); }
      else if (/^Digit[0-9]$/.test(e.code)) {
        const d = TABS[(+e.code.slice(5) + 9) % 10];
        if (d && tabOpen(d.id)) UI.go(d.id);
      }
    });
  }

  // ---------- Events ----------
  function listen() {
    G.on('achievement', a => { UI.toast(`<span>${esc(t('achievement'))}: <b>${esc(L(a.name))}</b></span>`, 'ach', 'ic_trophy'); if (tab === 'ach') UI.render(); });
    G.on('questDone', q => UI.toast(`<b>${esc(t('questDone'))}</b>`, '', 'ic_scroll'));
    G.on('landStar', (i, bit, n) => { zoneKey = ''; UI.toast(`<span><b style="color:#ffd84a">\u2605 ${esc(G.REALMS[i].name)} · ${esc(t('starName_' + bit))}</b><br><small>${esc(t('starBonus', n === 1 ? t('star1') : t('starsN', n), '+' + +(n * G.STAR_BONUS * 100).toFixed(1) + '%'))}</small></span>`, 'ach', 'ic_star'); });
    G.on('realm', r => UI.toast(`<span>${esc(t('newLands', G.realmName(G.S.depth)))} · <b>${esc(G.REALMS[r].rule)}</b></span>`, 'ach', 'ic_star'));
    G.on('potion', p => UI.toast(`<span>${esc(t('potionDrink', L(p.name)))} <b>${esc(p.short)} ${G.S.pots[p.id]}/${G.D.potCap}</b></span>`, '', 'pot_' + p.id));
    G.on('chestOpen', loot => {
      if (loot.source === 'offline') return;
      const top = loot.items.reduce((a, b) => (b.it.r > a.it.r ? b : a), loot.items[0]);
      if (top.it.r >= 4 && (top.isNew || top.it.r >= 6)) UI.banner(top.it);
      else if (top.isNew) UI.toast(`<span style="color:${G.RARITIES[top.it.r].color}">${esc(L(top.it.name))}</span>&nbsp;<b>${esc(t('newPet'))}</b>`, '', 'it_' + top.it.id);
      dirtyTab('coll'); dirtyTab('quests');
    });
    G.on('bossWin', (rew) => { dirtyTab('quests'); dirtyTab('asc'); });
    G.on('pull', res => showPull(res));
    G.on('buy', (kind) => { if ((kind === 'hero' && tab === 'heroes') || (kind === 'upg' && tab === 'upg') || (kind === 'node' && tab === 'stars') || (kind === 'legacy' && tab === 'asc')) UI.update(true); if (kind === 'node' && tab === 'stars') UI.render(); });
    G.on('ascend', g => { if (g) UI.toast(`<b>${esc(t('ascDone', fmt(g)))}</b>`, 'ach', 'ic_fame'); UI.render(); if (!G.S.hero.cls) setTimeout(() => UI.pickClass(), 400); });
    G.on('quests', () => dirtyTab('quests'));
    G.on('questClaim', () => { if (tab === 'quests') UI.render(); });
    G.on('daily', () => { if (tab === 'quests') UI.render(); });
    G.on('journey', (st, got) => { UI.toast(`<span><b>${esc(t('journeyDone'))}</b> · ${esc(st.text)}</span>&nbsp;${rewIcons(got)}`, 'ach', 'ic_trophy'); G.Audio && G.Audio.achievement(); if (tab === 'quests') UI.render(); });
    G.on('bounty', got => { UI.toast(`<span><b>${esc(t('bounty'))}</b> ✓</span>&nbsp;${rewIcons(got)}`, 'ach', 'ic_skull'); if (tab === 'quests') UI.render(); });
    G.on('evolve', id => {
      const E = G.EVOS[id], el = $('#banner');
      el.innerHTML = `<div class="inner" style="color:#ffd84a"><h2>${esc(t('evoTitle'))}</h2><img class="ico" src="${ic(E.icon, 10)}" alt=""><p>${esc(E.name)}</p><p style="font-size:15px;color:#d8dce8">${esc(E.desc)}</p></div>`;
      el.hidden = false; el.classList.remove('out');
      clearTimeout(bannerT);
      bannerT = setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.hidden = true; }, 400); }, 2600);
      G.Audio && G.Audio.achievement();
    });
    G.on('pets', () => { if (tab === 'pets') UI.render(); });
    G.on('ladder', () => { if (tab === 'ladder') updaters.ladder(); if (tab === 'rift') updaters.rift(); });
    G.on('net', () => { if (tab === 'ladder') updaters.ladder(); });
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
      if (tab === 'rift') UI.render();
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
      const zones = R_.zones.map((zn, zi) => { const d = i * G.REALM_SIZE + zi; const cls = i === here ? (zi < G.zoneOf(S.depth) ? 'done' : zi === G.zoneOf(S.depth) ? 'cur' : '') : d < S.bestDepth ? 'done' : ''; return `<span class="${cls} ${zi === G.REALM_SIZE - 1 ? 'lord' : ''}" title="${esc(zn)}"></span>`; }).join('');
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
  UI.update = function (force) {
    const S = G.S, D = G.D, R = G.R;
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
    else setText($('#realmSub'), t('depth') + ' ' + (S.depth + 1) + ' · ' + (G.isLord(S.depth) ? t('lordTitle') + ': ' : t('bossTitle') + ': ') + L(G.bossName(S.depth)));
    const cm = $('#chestMeter');
    cm.style.width = Math.min(100, S.chestMeter / D.chestNeed * 100) + '%';
    const comboK = R.combo / (D.comboCap || 1);
    $('#comboMeter').style.width = Math.min(100, comboK * 100) + '%';
    setClass($('#comboWrap'), 'hot', comboK >= 1);
    setText($('#comboText'), t('combo') + ' ' + Math.floor(R.combo) + ' · ×' + (1 + R.combo * D.comboPer).toFixed(2));
    setText($('#chestText'), t('nextChest') + ' ' + Math.floor(S.chestMeter / D.chestNeed * 100) + '%');
    const bossShown = !!(S.hero && S.hero.cls);
    setClass($('#stageWrap'), 'fighting', !!R.boss);
    $('#bossRow').hidden = !bossShown;
    $('#btnRift').hidden = !(bossShown && !R.boss && !R.rift && G.riftOpenable());
    if (bossShown && R.rift) {
      const r = R.rift, g = r.guard ? R.mobs.find(m => m.id === r.guard) : null;
      $('#bossMeter').style.width = (g ? Math.max(0, g.hp / g.max) : Math.min(1, r.prog / r.need)) * 100 + '%';
      setClass($('#bossWrap'), 'hp', !!g); setClass($('#bossWrap'), 'weak', false); setClass($('#bossWrap'), 'rift', true); setClass($('#bossWrap'), 'waves', false);
      setText($('#bossText'), t('riftName', r.lvl) + ' · ' + Math.ceil(r.t) + 's · ' + (g ? t('riftGuardian') : Math.floor(Math.min(1, r.prog / r.need) * 100) + '%'));
      $('#btnFight').hidden = true; $('#btnRetreat').hidden = false;
    } else if (bossShown) {
      setClass($('#bossWrap'), 'rift', false);
      if (R.boss) {
        const k = Math.max(0, R.boss.hp / R.boss.max);
        $('#bossMeter').style.width = k * 100 + '%';
        setClass($('#bossWrap'), 'hp', true); setClass($('#bossWrap'), 'waves', false);
        setText($('#bossText'), L(G.bossName(R.boss.d)) + ' · ' + Math.ceil(R.boss.t) + 's');
        $('#btnFight').hidden = true; $('#btnRetreat').hidden = false;
      } else {
        setClass($('#bossWrap'), 'hp', false);
        const need = D.bossNeed;
        $('#bossMeter').style.width = Math.min(100, S.bossMeter / need * 100) + '%';
        const hs = G.hordeScale(), weak = hs <= 0.45;
        const wave = Math.min(3, 1 + Math.floor(3 * S.bossMeter / need));
        const odds = R.bossReady && G.bossOdds ? G.bossOdds() : 1;
        const narrow = innerWidth < 600;
        // the countdown to a boss that comes on its own
        const callIn = R.bossReady && S.set.autoBoss && R.bossIn != null ? Math.max(0, Math.ceil(R.bossIn + (odds >= 0.6 ? 0 : D.autoBoss ? 20 : 60))) : -1;
        if (callIn >= 0) setText($('#bossText'), narrow ? t('bossInShort', L(G.bossName(S.depth)), callIn) : t('bossIn', L(G.bossName(S.depth)), callIn) + (odds < 1 ? ' · ' + t('bossOdds', Math.max(1, Math.round(odds * 100))) : ''));
        else         setText($('#bossText'), R.bossReady && narrow ? t('bossReadyShort', L(G.bossName(S.depth))) + (odds < 1 ? ' · ' + Math.max(1, Math.round(odds * 100)) + '%' : '') : R.bossReady ? t('bossReadyTo', L(G.bossName(S.depth)), G.isLord(S.depth) ? G.realmName(S.depth + 1) : G.ZONE_NAME(S.depth + 1)) + (odds < 1 ? ' · ' + t('bossOdds', Math.max(1, Math.round(odds * 100))) : '') : t('waveN', wave) + ' · ' + t('clearMeter', Math.floor(Math.min(S.bossMeter, Math.ceil(need))), Math.ceil(need)) + ' · ' + (weak ? t('hordeWeak') : t('hordeX', hs.toFixed(1))));
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
      setText($('#xpText'), t('lvl') + ' ' + h.lvl);
    }
    updatePerks();
    $('#hpRow').hidden = !(h && h.cls);
    if (h && h.cls) {
      const k = Math.max(0, h.hp / (D.heroHp || 1));
      $('#hpMeter').style.width = k * 100 + '%';
      setClass($('#hpWrap'), 'low', k < 0.35);
      setText($('#hpText'), R.stun > 0 ? t('overload') : t('buttonHp', fmt(Math.max(0, h.hp)), fmt(D.heroHp)));
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
    const bh = S.buffs.map(b => `<span class="buff ${b.id}">${esc(t(b.id))} ${Math.ceil(b.t)}s</span>`).join('')
      + Object.keys(R.hb || {}).filter(k => R.hb[k] > 0).map(k => `<span class="buff ${k === 'hh' ? 'hunt' : 'storm'}">${esc(k === 'hh' ? G.UNIQUES.headhunter.name : L(G.ABILITIES[k].name))} ${Math.ceil(R.hb[k])}s</span>`).join('')
      + (R.shr && R.shr.t > 0 ? `<span class="buff shrine" style="--c:${G.SHRINES[R.shr.k].col}">${esc(t('shrineBuff', G.SHRINES[R.shr.k].name, Math.ceil(R.shr.t)))}</span>` : '');
    const bEl = $('#buffs');
    if (bEl._h !== bh) { bEl.innerHTML = bh; bEl._h = bh; }
    if (G.Tut) G.Tut.update();
    $('#btnSound').classList.toggle('off', !S.set.sound);
    $('#btnMusic').classList.toggle('off', !S.set.music);

    if (dirty[tab]) { dirty[tab] = false; if (tab === 'coll' || tab === 'quests' || tab === 'asc') { updaters[tab] && updaters[tab](true); } }
    if (updaters[tab]) updaters[tab](force);
  };

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
      <p class="note keys">${esc(t('keysHint'))}</p>`;
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
    if (tab === 'pets') UI.update(true);
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
    for (const s of G.SLOTS) if (h.eq[s] && h.eq[s].u === u) return { g: h.eq[s], worn: s };
    const g = h.bag.find(x => x.u === u);
    return g ? { g, worn: null } : null;
  }
  function gearName(g) { return (g.q ? G.UNIQUES[g.q].name : L(G.ITEM_BY_ID[g.id].name)) + (g.e ? ' +' + g.e : ''); }
  const gearCol = g => (g.q ? G.UNIQUE_COL : G.RARITIES[g.r].color);
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
    return `<button class="gear r${g.r} ${g.q ? 'uq' : ''} ${g.c ? 'corr' : ''} ${extra || ''}" data-g="${g.u}" style="--rc:${gearCol(g)}" aria-label="${esc(gearName(g))}">${img(G.gearSpr(g), '', 4)}${g.e ? `<em>+${g.e}</em>` : ''}<small>${g.il}</small><u hidden>▲</u></button>`;
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
    const cls = G.CLASS_BY_ID[h.cls];
    const salvOpts = [0, 1, 2, 3];
    body.innerHTML = `
      <div class="charCard">
        <div class="portrait"><img data-doll src="${G.Doll.portrait(h, 4)}" alt=""></div>
        <div class="charInfo">
          <input id="heroName" maxlength="16" placeholder="${esc(t('namePh'))}" value="${esc(S.profile.name || '')}" aria-label="${esc(t('namePh'))}">
          <div class="clsLine">${esc(L(cls.name))} · <span data-lvl></span></div>
          <div class="pbar"><i data-xp></i><span data-xpt></span></div>
          <div class="power"><small>${esc(t('power'))}</small><b data-pow></b></div>
        </div>
      </div>
      <div class="sect">${esc(t('roleTitle'))}</div>
      <p class="note">${esc(t('roleHint'))}</p>
      <div class="statList" data-role></div>
      <div class="sect">${esc(t('perksTitle'))}</div>
      <div class="perkList" data-perks></div>
      <div class="doll">${G.SLOTS.map(s => `<div class="dslot" data-slot="${s}"><span class="lbl">${esc(t('slot_' + s))}</span><div data-in></div></div>`).join('')}</div>
      <div class="detail" data-gd></div>
      <div class="sect">${esc(t('orbs'))} <small style="color:var(--dim)">${esc(t('orbHint'))}</small></div>
      <div data-orbs></div>
      <div class="statList heroStats" data-stats></div>
      <div class="sect">${esc(t('bag'))} <span data-bagn></span> · ${img('ic_shard', 'inl', 2)} <span data-shards></span> ${esc(t('shards'))}</div>
      <div class="bag" data-bag></div>
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
    };
    $('#heroName', body).addEventListener('change', e => { S.profile.name = e.target.value.trim().slice(0, 16); });
    body.addEventListener('click', e => {
      const tg = e.target.closest('[data-ht]');
      if (tg) { h[tg.dataset.ht] = h[tg.dataset.ht] ? 0 : 1; tg.classList.toggle('on'); return; }
      const sb = e.target.closest('[data-salv] button');
      if (sb) { h.salv = +sb.dataset.r; $$('[data-salv] button', body).forEach(x => x.classList.toggle('on', x === sb)); return; }
      if (e.target.closest('[data-salvall]')) {
        const r = G.salvageBelow(Math.max(1, h.salv || 2));
        UI.toast(esc(t('salvaged', r.n, fmt(r.v))), '', 'ic_shard'); refs.hero.key = ''; return;
      }
      const gt = e.target.closest('[data-g]');
      // the item's details sit above the bag: bring them into view, or on a phone nothing seems to happen
      if (gt) { selGear = +gt.dataset.g; refs.hero.key = ''; updaters.hero(true); if (refs.hero.gd) refs.hero.gd.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
      const ds = e.target.closest('.dslot');
      if (ds && !e.target.closest('[data-g]')) { const g = h.eq[ds.dataset.slot]; if (g) { selGear = g.u; refs.hero.key = ''; updaters.hero(true); } return; }
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
        if (a === 'equip') G.equip(f.g);
        else if (a === 'unequip') G.unequip(f.worn);
        else if (a === 'enchant') { if (!G.enchant(f.g)) G.Audio.error(); }
        else if (a === 'salvage') { const v = G.salvage(f.g); if (v) { UI.toast(esc(t('salvaged', 1, fmt(v))), '', 'ic_shard'); selGear = null; } }
        refs.hero.key = ''; updaters.hero(true);
      }
    });
    if (!selGear || !findGear(selGear)) selGear = h.eq.weapon ? h.eq.weapon.u : null;
  };
  updaters.hero = function (force) {
    const S = G.S, D = G.D, h = S.hero, rf = refs.hero;
    if (!rf || !h.cls) return;
    const c = D.hero;
    setText(rf.lvl, t('lvl') + ' ' + h.lvl);
    rf.xp.style.width = Math.min(100, h.xp / G.xpNeed(h.lvl) * 100) + '%';
    setText(rf.xpt, fmt(Math.floor(h.xp)) + ' / ' + fmt(G.xpNeed(h.lvl)));
    setText(rf.pow, fmt(D.power));
    setText(rf.shards, fmt(h.shards));
    setText(rf.bagn, h.bag.length + '/' + G.TUNE.bagMax);
    setText($('#tabSub'), t('power') + ' ' + fmt(D.power));
    // what the Warden is doing for you right now
    const c0 = D.hero, critEV = 1 + c0.crit * (c0.critMult - 1);
    const bossSec = D.heroDps * D.bossMult, bossHp = G.bossHp(S.depth), limit = D.bossTime + (G.isLord(S.depth) ? 15 : 0);
    const alone = bossHp / Math.max(1e-9, bossSec);
    const role = [
      ['roleHorde', '×' + G.hordeScale().toFixed(1)],
      ['roleBossClick', fmt(D.heroHit * G.TUNE.clickVolley * D.bossMult * critEV, true)],
      ['roleBossSec', fmt(bossSec, true)],
      ['roleBoss', fmt(bossHp) + ' · ' + t('roleBossTime', alone > 999 ? '999+' : Math.ceil(alone), limit)],
    ];
    const roleHtml = role.map(([k, v]) => `<span>${esc(t(k))}</span><b>${esc(v)}</b>`).join('') + (alone > limit * 2 ? `<p class="note warn">${esc(t('roleWeak'))}</p>` : '');
    if (rf.role.innerHTML !== roleHtml) rf.role.innerHTML = roleHtml;
    const key = JSON.stringify([h.eq, h.bag.length, h.bag.map(g => g.u + ':' + g.e).join(), selGear, h.lvl, Math.floor(h.shards / 5), h.perks, h.orbs]);
    if (key === rf.key && !force) return;
    const pk = Object.keys(h.perks || {}).filter(k => h.perks[k] > 0);
    rf.perks.innerHTML = pk.length ? pk.map(k => {
      if (k.startsWith('evo_')) { const E = G.EVOS[k.slice(4)]; return `<div class="perkChip evo" title="${esc(E.desc)}">${img(E.icon, '', 3)}<b>${esc(E.name)}</b><small>★</small></div>`; }
      const P = G.PERKS[k]; return `<div class="perkChip" title="${esc(P.desc)}">${img(P.icon, '', 3)}<b>${esc(P.name)}</b><small>${h.perks[k]}/${P.max}</small></div>`;
    }).join('') : `<p class="note">${esc(t('perksNone'))}</p>`;
    rf.key = key;
    const dk = JSON.stringify(h.eq);
    if (dk !== rf.dollKey) { rf.dollKey = dk; const im = document.querySelector('.portrait img[data-doll]'); if (im) im.src = G.Doll.portrait(h, 4); }
    for (const el of rf.slots) {
      const g = h.eq[el.dataset.slot];
      const box = el.querySelector('[data-in]');
      const hh = g ? gearTile(g, selGear === g.u ? 'sel' : '') : `<span class="empty">${img(SLOT_ICON[el.dataset.slot], '', 3, { dark: true })}</span>`;
      if (box._h !== hh) { box.innerHTML = hh; box._h = hh; }
    }
    // Bag, grouped by slot and sorted by power
    const order = G.SLOTS;
    const bag = h.bag.slice().sort((a, b) => order.indexOf(G.slotOf(a.id)) - order.indexOf(G.slotOf(b.id)) || b.r - a.r || b.il - a.il);
    rf.bag.innerHTML = bag.length ? bag.map(g => gearTile(g, selGear === g.u ? 'sel' : '')).join('') : `<p class="note">${esc(t('bagEmpty'))}</p>`;
    // upgrade arrows
    const cur = D.power;
    $$('[data-g]', rf.bag).forEach(el => { const g = h.bag.find(x => x.u === +el.dataset.g); if (g && G.powerWith(G.slotOf(g.id), g) > cur) el.querySelector('u').hidden = false; });
    // Stats
    const cls = G.CLASS_BY_ID[h.cls];
    const rows = [
      ['st_dps', fmt(c.dps, true)], ['st_hit', fmt(c.hit, true)], ['st_rate', c.rate.toFixed(2) + t('perSec')], ['st_targets', c.targets],
      ['st_crit', Math.round(c.crit * 100) + '% · ×' + c.critMult.toFixed(1)], ['st_hp', fmt(c.hp)],
      ['st_class', c.own ? t('classBonusOn') : t('classBonusOff', cls.weapons.map(w => L(G.WEAPONS[w].name)).join(', '))],
    ];
    rf.stats.innerHTML = rows.map(([k, v]) => `<span>${esc(t(k))}</span><b>${esc(v)}</b>`).join('');
    // Records (ladder material)
    const rec = [['rec_depth', S.bestDepth + 1], ['gsLadder', fmt(G.ladderSnapshot().power)], ['rec_power', fmt(S.rec.maxPower)], ['rec_level', S.rec.maxLevel], ['rec_mad', S.rec.madTime ? G.fmtTime(S.rec.madTime) : '—'], ['rec_rift', S.rift.best || '—']];
    rf.rec.innerHTML = rec.map(([k, v]) => `<span>${esc(t(k))}</span><b>${esc(v)}</b>`).join('');
    // Detail
    const f = selGear ? findGear(selGear) : null;
    if (!f) { rf.gd.innerHTML = `<p>${esc(t('tapItem'))}</p>`; rf.orbs.innerHTML = orbBar(null); return; }
    const g = f.g, r = G.RARITIES[g.r], slot = G.slotOf(g.id), U = g.q ? G.UNIQUES[g.q] : null;
    const cmp = f.worn ? null : G.powerWith(slot, g) - G.powerWith(slot, h.eq[slot]);
    const ec = G.enchantCost(g);
    const canE = g.e < G.ENCHANT_MAX && h.shards >= ec.shards && S.gold >= ec.gold;
    rf.orbs.innerHTML = orbBar(g);
    rf.gd.innerHTML = `
      <h3 style="color:${gearCol(g)}">${esc(gearName(g))}</h3>
      <p>${U ? `<b style="color:${G.UNIQUE_COL}">${esc(t('unique'))}</b> · ${esc(L(G.ITEM_BY_ID[g.id].name))}` : esc(L(r.name))} · ${esc(t('slot_' + slot))} · ${esc(t('ilvl', g.il))}${g.c ? ` · <b style="color:#ff5a4a">${esc(t('corrupted'))}</b>` : ''}</p>
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
    const icon = { uq: 'orb_grace', rift: 'ic_rift', lord: 'ic_skull', divine: 'it_halo', mad: 'ic_crown', evo: 'ic_star', crown: 'ic_crown' };
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
      if (e.target.closest('[data-name]')) { UI.go('hero'); setTimeout(() => { const i = $('#heroName'); if (i) i.focus(); }, 50); return; }
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
      const U = g.q && G.UNIQUES[g.q], col = U ? G.UNIQUE_COL : (G.RARITIES[g.r] || G.RARITIES[0]).color;
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
  let bannerT = null;
  UI.banner = function (it) {
    const el = $('#banner'), r = G.RARITIES[it.r];
    const title = it.r === 6 ? t('divineLoot') : it.r === 5 ? t('mythicLoot') : t('legendLoot');
    el.innerHTML = `<div class="inner" style="color:${r.color}"><h2>${esc(title)}</h2><img class="ico" src="${ic('it_' + it.id, 10)}" alt=""><p>${esc(L(it.name))}</p></div>`;
    el.hidden = false; el.classList.remove('out');
    clearTimeout(bannerT);
    bannerT = setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.hidden = true; }, 400); }, it.r >= 6 ? 2600 : 1700);
  };
  UI.bannerU = function (q, first) {
    const el = $('#banner'), U = G.UNIQUES[q];
    el.innerHTML = `<div class="inner uqb" style="color:${G.UNIQUE_COL}"><h2>${esc(first ? t('uqNew') : t('uqBanner'))}</h2><img class="ico" src="${ic('u_' + q, 10)}" alt=""><p>${esc(U.name)}</p><p style="font-size:15px;color:#ffe0c0">${esc(U.fx)}</p></div>`;
    el.hidden = false; el.classList.remove('out');
    clearTimeout(bannerT);
    bannerT = setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.hidden = true; }, 400); }, 3200);
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
