// BTTN — onboarding: a short intro, a guided first session with a pointer
// and a guide (Buttonling), one-time tips when a new mechanic shows up, and
// a "How to play" sheet behind the ? button.
(function (G) {
  'use strict';
  const Tut = G.Tut = {};
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const t = (...a) => G.t(...a);
  const img = (id, sc, o) => `<img src="${G.SPR.url(id, sc || 4, o)}" alt="" draggable="false">`;

  Object.assign(G.STR, {
    in_1: 'Somewhere deep in the Realm stands a Button.', in_1b: 'Nobody remembers who put it there. Everyone knows it must be pressed.',
    in_2: 'Every press makes chests spill out of it.', in_2b: 'Gold, weapons, armour, and loot the bards sing about.',
    in_3: 'The treasure draws the mobs.', in_3b: 'They come from every side to break the Button.',
    in_4: 'Choose a hero and defend it.', in_4b: 'Gear them up with loot, dive deeper and become the strongest.',
    in_next: 'Next', in_skip: 'Skip', in_play: 'Choose a hero',
    tu_guide: 'Buttonling', tu_step: 'Tutorial {0}/{1}', tu_skip: 'Skip the tutorial', tu_ok: 'Got it', tu_reward: 'Done! Reward: {0}',
    tu_click: "Hi, I'm Buttonling! Press the big button. Every click gives gold and fills the chest bar below.",
    tu_chestWait: 'Almost! When the green Chest bar fills up, a chest drops nearby.',
    tu_chest: 'A chest! Tap it to open. Inside are gold and gear for your hero.',
    tu_gear: "The chest had an item. Open the Character tab and let's look at your hero.",
    tu_doll: 'This is your hero with 4 slots: weapon, ability, armour and ring. Better items are equipped automatically. Scrap spares into shards and enchant your gear with them.',
    tu_upgWait: "Click up 15 gold and we'll buy the first upgrade.",
    tu_upg: 'You have the gold! In Upgrades, buy Iron Finger to make clicks stronger.',
    tu_mobs: 'Mobs are coming for the button! Your hero shoots on their own, and each of your clicks fires another volley. Tap a mob to focus it.',
    tu_garrisonWait: "Great! Save 50 gold and we'll hire the first fighter for the garrison.",
    tu_garrison: 'In Garrison, hire a Rogue. The garrison earns gold even when you are not clicking.',
    tu_boss: 'The orange bar is the area clear. Slay 25 mobs and a boss arrives.',
    tu_bossReady: 'The boss is ready! Press ⚔ or the skull above the button. You have 30 seconds, click like mad.',
    tu_bossFight: "Hit the boss! Clicks are your hero's volleys. Too slow and it leaves, but it comes back.",
    tu_pets: 'The boss dropped an egg! Hatch it in Pets: pets help in battle.',
    tu_final: 'You know it all! Next: dive deeper, fill the collection, grow the constellation and ascend for fame. The Ladder tab ranks you against others. Press ? any time.',
    tip_wisp: 'A wisp! Catch it before it flies off: it gives a buff or gold.',
    tip_mod: 'Special chest — {0}: {1}.',
    tip_bossReady: 'The boss is ready. Press ⚔ when you are.',
    tip_ess: 'You have essence! Spend it in the Constellation on bonuses for this run.',
    tip_ability: 'Your hero has an ability. It casts itself, or press the button on the right or Q.',
    tip_asc: "You can ascend! The run restarts, but you earn fame: a permanent bonus to gold and damage. Gear and pets stay.",
    tip_shards: 'Shards piled up. In Character, tap a worn item and enchant it.',
    tip_break: 'Mobs broke the button and the clear bar dropped. Get tougher armour or enchant your weapon.',
    tip_potion: 'A potion! It raises a stat until you ascend. See them in the Garrison tab.',
    help_title: 'How to play', help_intro: 'Show the intro', help_tut: 'Replay the tutorial',
    help_1: 'The Button', help_1t: 'A click gives gold and fills the chest bar. Fast clicks build a combo multiplier.',
    help_2: 'Chests and gear', help_2t: 'Open chests for gold, essence and items of 7 rarities. Special chests (storm, frozen, mimics…) each work their own way.',
    help_3: 'Hero', help_3t: '4 slots: weapon, ability, armour, ring. Your class weapon type deals +50%. Scrap spares into shards and enchant gear up to +20.',
    help_4: 'Mobs and bosses', help_4t: 'Mobs march on the button. Slay 25 and a boss comes. Winning opens the next depth: tougher mobs, better loot.',
    help_5: 'Gold', help_5t: 'Upgrades boost clicks and chests; the Garrison earns on its own.',
    help_6: 'Constellation and pets', help_6t: 'Essence goes into the skill constellation, boss eggs into the pet hatchery.',
    help_7: 'Ascension', help_7t: 'Stuck? Ascend for fame, a permanent bonus. Gear, pets and the collection stay.',
    help_8: 'Ladder', help_8t: 'Name your hero in Character and compare depth and power with others.',
  });

  // ---------- Pointer targets ----------
  const P = {
    button: () => G.Stage.buttonPoint(),
    chest: () => { const cs = G.S.chests; if (!cs.length) return null; const c = cs.reduce((a, b) => (b.tier > a.tier ? b : a), cs[0]); return G.Stage.chestPoint(c); },
    mob: () => { const ms = (G.R.mobs || []).slice().sort((a, b) => b.p - a.p); return ms.length ? G.Stage.mobPoint(ms[0]) : null; },
    wisp: () => G.Stage.wispPoint(),
    el: sel => { const e = typeof sel === 'string' ? $(sel) : sel; if (!e || !e.offsetParent) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top - 2, el: e }; },
    tab: id => P.el(`.tab[data-tab="${id}"]`),
    inTab: (id, sel) => (G.UI.tab() === id ? P.el(sel) : P.tab(id)),
  };
  const val = (f, S) => (typeof f === 'function' ? f(S) : f);

  // ---------- Guided steps ----------
  const STEPS = [
    { id: 'click', text: 'tu_click', point: P.button, done: S => S.clicks >= 12 },
    { id: 'chest', text: S => (S.chests.length ? 'tu_chest' : 'tu_chestWait'), point: S => (S.chests.length ? P.chest() : P.button()), done: S => S.st.chests >= 1 },
    { id: 'gear', text: 'tu_gear', point: () => P.tab('hero'), done: () => G.UI.tab() === 'hero' },
    { id: 'doll', text: 'tu_doll', point: () => P.inTab('hero', '.doll'), manual: true },
    { id: 'upg', text: S => (S.gold >= 15 || S.upg.finger ? 'tu_upg' : 'tu_upgWait'), point: S => (S.gold >= 15 ? P.inTab('upg', '.row[data-u="finger"]') : P.button()), done: S => (S.upg.finger || 0) >= 1 },
    { id: 'mobs', text: 'tu_mobs', point: () => P.mob() || P.button(), done: S => S.hero.kills >= 8 },
    { id: 'garrison', text: S => (S.gold >= 50 ? 'tu_garrison' : 'tu_garrisonWait'), point: S => (S.gold >= 50 ? P.inTab('heroes', '.row[data-h="rogue"]') : P.button()), done: S => (S.heroes.rogue || 0) >= 1 },
    { id: 'boss', text: () => (G.R.boss ? 'tu_bossFight' : G.R.bossReady ? 'tu_bossReady' : 'tu_boss'),
      point: () => (G.R.boss ? P.button() : G.R.bossReady ? (P.el('#btnFight') || P.button()) : P.el('#bossRow')), done: S => S.st.bossKills >= 1 },
    { id: 'pets', text: 'tu_pets', point: () => P.inTab('pets', '[data-pull="1"]'), done: S => Object.keys(S.pets).length >= 1,
      skip: S => S.eggs < 1 && !Object.keys(S.pets).length },
    { id: 'final', text: 'tu_final', point: () => P.tab('ladder'), manual: true },
  ];

  // ---------- One-time tips (after the tutorial) ----------
  const TIPS = [
    { id: 'wisp', when: () => G.R.wisp, point: P.wisp, text: 'tip_wisp', until: () => !G.R.wisp },
    { id: 'mod', when: S => S.chests.some(c => c.mod), point: () => { const c = G.S.chests.find(x => x.mod); return c && G.Stage.chestPoint(c); },
      text: () => { const c = G.S.chests.find(x => x.mod); const m = c && G.MOD_BY_ID[c.mod]; return m ? t('tip_mod', G.L(m.name), G.L(m.desc)) : ''; }, raw: true, until: S => !S.chests.some(c => c.mod) },
    { id: 'bossReady', when: () => G.R.bossReady && !G.R.boss, point: () => P.el('#btnFight'), text: 'tip_bossReady', until: () => !G.R.bossReady },
    { id: 'ess', when: S => S.essence >= 1, point: () => P.tab('stars'), text: 'tip_ess', until: () => G.UI.tab() === 'stars' },
    { id: 'ability', when: S => S.hero.eq.ability, point: () => P.el('#btnAbil'), text: 'tip_ability' },
    { id: 'shards', when: S => S.hero.shards >= 40, point: () => P.tab('hero'), text: 'tip_shards', until: () => G.UI.tab() === 'hero' },
    { id: 'asc', when: () => G.fameGain() >= 1, point: () => P.tab('asc'), text: 'tip_asc', until: () => G.UI.tab() === 'asc' },
  ];

  let tip = null, tipT = 0, lastHl = null;

  function seen() { const S = G.S; S.seen = S.seen || {}; S.seen.tips = S.seen.tips || {}; return S.seen; }
  const veteran = S => S.clicks > 60 || S.ascensions > 0 || S.st.bossKills > 0 || S.maxDepth > 0 || S.goldTotal > 5000;
  function active() { return typeof G.S.tut === 'number' && G.S.tut >= 0 && G.S.tut < STEPS.length; }

  Tut.init = function () {
    const S = G.S;
    // Players who were already playing before onboarding existed skip the intro and tutorial
    if (S.tut === 0 && veteran(S)) S.tut = -1;
    $('#btnHelp').addEventListener('click', Tut.help);
    $('#coach').addEventListener('click', e => {
      if (e.target.closest('[data-skip]')) { G.S.tut = -1; hide(); return; }
      if (e.target.closest('[data-ok]')) {
        if (tip) { finishTip(); return; }
        if (active() && STEPS[S.tut] && STEPS[G.S.tut].manual) complete();
      }
    });
    G.on('buttonBreak', () => { if (!active()) showTip({ id: 'break', text: 'tip_break' }); });
    G.on('potion', () => { if (!active() && !seen().tips.potion) showTip({ id: 'potion', text: 'tip_potion' }); });
    window.addEventListener('resize', () => place());
    Tut.maybeIntro();
    // A returning player on a new device: the cloud prompt goes first, the intro only if they keep this fresh save
    G.on('cloudNewer', () => { if (closeIntro) closeIntro(true); });
  };
  let closeIntro = null;
  Tut.maybeIntro = function () {
    const S = G.S;
    if (!seen().intro && !veteran(S) && !closeIntro) Tut.intro();
  };

  function complete() {
    const S = G.S, i = S.tut;
    const paid = seen().tutPaid = seen().tutPaid || {};
    const first = !paid[STEPS[i].id];
    paid[STEPS[i].id] = 1;
    const reward = i === STEPS.length - 1 ? null : Math.max(25, Math.round(G.D.incomeRef * 20));
    if (!first) { /* replaying the tutorial pays nothing */ }
    else if (reward) { G.addGold(reward, 'tutorial'); G.UI.toast(esc(t('tu_reward', G.fmt(reward) + ' ' + t('gold').toLowerCase())), 'ach', 'ic_coin'); }
    else { G.S.eggs += 1; G.UI.toast(esc(t('tu_reward', '1 ' + t('eggs').toLowerCase())), 'ach', 'ic_egg'); }
    S.tut = i + 1;
    while (active() && STEPS[S.tut].skip && STEPS[S.tut].skip(S)) S.tut++;
    if (!active()) S.tut = -1;
    if (G.Audio) G.Audio.achievement();
  }

  // Called ~8 times a second from UI.update
  Tut.update = function () {
    const S = G.S;
    if (!S || !$('#coach') || !$('#intro').hidden || !$('#modal').hidden) { hidePointer(); if (!$('#modal').hidden || !$('#intro').hidden) $('#coach').hidden = true; return; }
    if (!S.hero || !S.hero.cls) { hide(); return; }
    if (active()) {
      const st = STEPS[S.tut];
      if (st.skip && st.skip(S)) { S.tut++; if (!active()) S.tut = -1; return; }
      if (!st.manual && st.done(S)) { complete(); return; }
      render(st.id, t(val(st.text, S)), t('tu_step', S.tut + 1, STEPS.length), st.manual);
      point(val(st.point, S));
      return;
    }
    // tips
    if (tip) {
      tipT -= 0.12;
      if (tipT <= 0 || (tip.until && tip.until(S))) { finishTip(); return; }
      point(tip.point ? tip.point() : null);
      return;
    }
    for (const tp of TIPS) {
      if (seen().tips[tp.id]) continue;
      if (tp.when(S)) { showTip(tp); return; }
    }
    hide();
  };

  function showTip(tp) {
    tip = tp; tipT = 9;
    const text = tp.raw ? tp.text() : t(val(tp.text, G.S));
    if (!text) { finishTip(); return; }
    render('tip:' + tp.id, text, '', true);
    point(tp.point ? tp.point() : null);
  }
  function finishTip() { if (tip) seen().tips[tip.id] = 1; tip = null; hide(); }

  // ---------- Coach bubble & pointer ----------
  let lastKey = '';
  function render(key, text, step, manual) {
    const c = $('#coach');
    const k = key + text + step + manual;
    if (k !== lastKey) {
      lastKey = k;
      c.innerHTML = `<div class="guide">${img('p_buttonling', 5)}</div>
        <div class="say"><b>${esc(t('tu_guide'))}</b>${step ? `<small>${esc(step)}</small>` : ''}<p>${esc(text)}</p>
          <div class="acts">${manual ? `<button class="btn gold" data-ok>${esc(t('tu_ok'))}</button>` : ''}${active() ? `<button class="linkBtn" data-skip>${esc(t('tu_skip'))}</button>` : ''}</div></div>`;
      c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');
    }
    c.hidden = false;
    place();
  }
  // The bubble sits above the meters by default and moves out of the way when
  // the pointer's target would be underneath it (small screens, top-of-stage targets).
  let aim = null, placedY = null;
  function place() {
    const c = $('#coach'), w = $('#stageWrap');
    if (!c || c.hidden || !w) return;
    const r = w.getBoundingClientRect();
    const width = Math.min(r.width - 20, 460);
    c.style.width = width + 'px';
    c.style.left = (r.left + (r.width - width) / 2) + 'px';
    const meters = document.querySelector('.hud.bottom');
    const bottom = meters ? meters.getBoundingClientRect().top : r.bottom;
    const h = c.offsetHeight;
    const spots = [Math.max(r.top + 50, bottom - h - 10), r.top + 50, window.innerHeight - h - 10];
    const clear = y => !aim || y >= aim.bottom || y + h <= aim.top;
    let y = placedY !== null && spots.includes(placedY) && clear(placedY) ? placedY : spots.find(clear);
    if (y === undefined) y = spots[0];
    placedY = y;
    c.style.top = y + 'px';
  }
  function point(p) {
    const el = $('#pointer');
    if (lastHl && (!p || p.el !== lastHl)) { lastHl.classList.remove('tut-hl'); lastHl = null; }
    if (!p) { el.hidden = true; aim = null; place(); return; }
    if (p.el && !lastHl) {
      lastHl = p.el; lastHl.classList.add('tut-hl');
      const body = p.el.closest('.tabBody');
      if (body) { const br = body.getBoundingClientRect(), er = p.el.getBoundingClientRect(); if (er.top < br.top || er.bottom > br.bottom) p.el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    }
    if (!el.firstChild) el.innerHTML = img('ic_arrow', 5);
    el.hidden = false;
    el.style.transform = `translate(${Math.round(p.x - 25)}px, ${Math.round(p.y - 50)}px)`;
    // Arrow plus the thing it points at
    aim = { top: p.y - 58, bottom: p.y + 44 };
    if (p.el) { const er = p.el.getBoundingClientRect(); aim.top = Math.min(aim.top, er.top); aim.bottom = Math.max(aim.bottom, er.bottom); }
    place();
  }
  function hidePointer() { const el = $('#pointer'); if (el) el.hidden = true; if (lastHl) { lastHl.classList.remove('tut-hl'); lastHl = null; } }
  function hide() { const c = $('#coach'); if (c) c.hidden = true; lastKey = ''; placedY = null; aim = null; hidePointer(); }

  // ---------- Intro ----------
  Tut.intro = function () {
    const box = $('#intro');
    const skins = ['#e8413c'];
    const btn = G.SPR.url(G.SPR.button(skins[0], false, 0), 6);
    const slides = [
      { a: 'in_1', b: 'in_1b', art: `<div class="introTitle">${'BTTN'.split('').map((ch, i) => `<span style="animation-delay:${0.15 * i}s">${ch}</span>`).join('')}</div><img class="dropBtn" src="${btn}" alt="">` },
      { a: 'in_2', b: 'in_2b', art: `<div class="row3">${[0, 2, 4, 6].map((tr, i) => `<span class="popIn" style="animation-delay:${0.25 * i}s">${img('chest_' + tr, 6)}</span>`).join('')}</div>
          <div class="row3 small">${['it_steel_sword', 'it_sapphire_amulet', 'it_golden_plate', 'it_halo'].map((id, i) => `<span class="popIn" style="animation-delay:${0.9 + 0.2 * i}s">${img(id, 5)}</span>`).join('')}</div>` },
      { a: 'in_3', b: 'in_3b', art: `<div class="march"><span class="mL">${img('b_goblin', 4)}${img('b_crab', 4)}</span><img class="midBtn" src="${G.SPR.url(G.SPR.button('#e8413c', false, 0), 4)}" alt=""><span class="mR">${img('b_imp', 4)}${img('b_eye', 4)}</span></div>` },
      { a: 'in_4', b: 'in_4b', art: `<div class="row3">${G.CLASSES.map((c, i) => `<span class="popIn" style="animation-delay:${0.2 * i}s">${img(c.spr, 8)}</span>`).join('')}</div>`, last: true },
    ];
    let i = 0, timer = null;
    const show = () => {
      const s = slides[i];
      box.innerHTML = `<div class="introInner">
        <div class="art">${s.art}</div>
        <h2 class="type" data-full="${esc(t(s.a))}"></h2>
        <p class="fadeIn">${esc(t(s.b))}</p>
        <div class="dots">${slides.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
        <div class="acts"><button class="linkBtn" data-skip>${esc(t('in_skip'))}</button><button class="btn gold" data-next>${esc(t(s.last ? 'in_play' : 'in_next'))}</button></div>
      </div>`;
      typeText(box.querySelector('.type'));
      if (G.Audio) G.Audio.coin && G.Audio.coin();
    };
    // `quiet` closes the intro without marking it seen (the cloud-save prompt took over)
    const end = quiet => {
      clearTimeout(timer);
      closeIntro = null;
      box.classList.add('out');
      setTimeout(() => { box.hidden = true; box.classList.remove('out'); box.innerHTML = ''; }, 450);
      if (quiet) return;
      seen().intro = 1;
      G.save && G.save();
      setTimeout(() => G.UI.pickClass(), 500);
    };
    closeIntro = end;
    const next = () => { G.Audio && G.Audio.unlock(); if (i < slides.length - 1) { i++; show(); } else end(false); };
    box.onclick = e => {
      if (e.target.closest('[data-skip]')) { end(false); return; }
      if (e.target.closest('[data-next]')) { next(); return; }
      const h = box.querySelector('.type');
      if (h && h.dataset.done !== '1') { h.textContent = h.dataset.full; h.dataset.done = '1'; } else next();
    };
    box.hidden = false;
    show();
  };
  function typeText(h) {
    if (!h) return;
    const full = h.dataset.full;
    let n = 0;
    const step = () => {
      if (!h.isConnected || h.dataset.done === '1') return;
      n += 2;
      h.textContent = full.slice(0, n);
      if (n < full.length) setTimeout(step, 28); else h.dataset.done = '1';
    };
    step();
  }

  // ---------- Help ----------
  Tut.help = function () {
    const rows = [['ic_coin', 1], ['ic_chest', 2], ['ic_sword', 3], ['ic_skull', 4], ['h_rogue', 5], ['ic_star', 6], ['ic_tomb', 7], ['ic_crown', 8]];
    const html = `<div class="helpList">${rows.map(([ic, n]) => `<div class="helpRow">${img(ic, 3)}<div><b>${esc(t('help_' + n))}</b><p>${esc(t('help_' + n + 't'))}</p></div></div>`).join('')}</div>
      <p style="font-size:15px">${esc(t('keysHint'))}</p>`;
    G.UI.modal(t('help_title'), html, [
      { label: t('help_intro'), fn: () => Tut.intro() },
      { label: t('help_tut'), fn: () => { G.S.tut = 0; } },
      { label: t('close'), cls: 'gold' },
    ]);
  };
})(globalThis.G = globalThis.G || {});
