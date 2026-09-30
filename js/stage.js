// BTTN — the stage: a low-res pixel canvas scaled by an integer factor, plus a
// hi-res pass for text and bars. Listens to game events for all the juice.
(function (G) {
  'use strict';
  const { SPR, clamp, rand, pick } = G;
  const St = G.Stage = {};

  let cv, ctx, low, lctx, W = 200, H = 150, S = 3, DPR = 1;
  let groundCanvas = null, groundKey = '';
  const parts = [], texts = [], shots = [], beams = [], bolts = [], bullets = [], opening = [], flyers = [];
  const gibs = [], rings = [], coins = [], gems = [], glowFx = [];
  const vis = new Map(); // chest id -> visual state
  let slots = [];
  let heroVis = [], heroKey = '';
  let shake = 0, flash = 0, flashCol = '#ffffff', btnPress = 0, time = 0;
  let bossVis = null, bossHitT = 0, bossBulletT = 0;
  let hoverChest = null, pointer = { x: -99, y: -99, over: false };
  let holdTimer = 0, holding = false;
  let hitstop = 0, slowmo = 0, kick = 0, btnFlashT = 0, fdt = 1 / 60;
  // clicks in a quick run add up into one growing number; kill gold is summed and shown at the Button
  let clickTxt = null, killGold = 0, killGoldT = 0, frameKills = 0, comboTier = 0, openHeat = 0;
  // how hard the party is being hit right now (drives the red edge), and the Button's damage not yet shown
  let hurtFx = 0, btnDmg = 0, btnDmgT = 0, beatT = 0;
  const fmtSmall = v => (v < 10 ? String(+v.toFixed(2)) : G.fmt(v));
  // The Button is a spring: every click squashes it and it bounces back
  const btnSpring = { s: 1, v: 0 };
  const MAXP = 700, MAXG = 650;

  St.init = function (canvas) {
    cv = canvas; ctx = cv.getContext('2d');
    low = SPR.makeCanvas(W, H); lctx = low.getContext('2d');
    bindInput();
    listen();
    St.resize();
  };

  St.resize = function () {
    const r = cv.parentElement.getBoundingClientRect();
    DPR = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.max(200, r.width), ch = Math.max(160, r.height);
    // a wide view of the field: on sharp screens the scale may be a half step (1.5 = 3 device pixels a pixel)
    const step = DPR >= 2 ? 0.5 : 1;
    S = clamp(Math.floor(Math.min(cw / 270, ch / 200) / step) * step, DPR >= 2 ? 1.5 : 2, 6);
    W = Math.ceil(cw / S); H = Math.ceil(ch / S);
    cv.width = Math.round(cw * DPR); cv.height = Math.round(ch * DPR);
    cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
    low.width = W; low.height = H;
    groundKey = '';
    computeSlots();
    heroKey = '';
  };

  // ---------- Layout ----------
  function btnPos() { return { x: Math.round(W / 2), y: Math.round(H * 0.54) }; }
  St.btnPos = btnPos;
  function computeSlots() {
    const b = btnPos();
    slots = [];
    const rings = [
      { n: 8, rx: Math.min(W * 0.25, 62), ry: Math.min(H * 0.27, 44), off: Math.PI / 8 },
      { n: 10, rx: Math.min(W * 0.41, 104), ry: Math.min(H * 0.39, 64), off: 0 },
    ];
    for (const ring of rings) {
      for (let i = 0; i < ring.n; i++) {
        const a = ring.off + (i / ring.n) * Math.PI * 2;
        slots.push({ x: Math.round(b.x + Math.cos(a) * ring.rx), y: Math.round(b.y + Math.sin(a) * ring.ry + 4) });
      }
    }
    // Keep slots on-screen and clear of the top HUD strip
    slots.forEach(s => { s.x = clamp(s.x, 10, W - 10); s.y = clamp(s.y, 22, H - 10); });
    // Re-seat existing chests
    for (const [, v] of vis) { const s = slots[v.slot]; if (s) { v.x = s.x; v.y = s.y; } else if (v.slot < 0) Object.assign(v, onField(v.x, v.y)); }
  }
  // Keep ground loot clear of the HUD strips
  function onField(x, y) { return { x: Math.round(clamp(x, 10, W - 10)), y: Math.round(clamp(y, 26, H - Math.ceil(66 / S))) }; }
  function freeSlot() {
    const used = new Set(); for (const [, v] of vis) used.add(v.slot);
    const n = Math.min(slots.length, G.D.slots || 6);
    for (let i = 0; i < n; i++) if (!used.has(i)) return i;
    return -1;
  }
  // a spot on the open field for a chest that has no slot by the Button: anywhere round it, clear of the middle
  function fieldSpot() {
    const b = btnPos();
    const a = rand(0, Math.PI * 2), k = Math.sqrt(rand(0.18, 0.9));
    return inField(b.x + Math.cos(a) * W * 0.44 * k, b.y + Math.sin(a) * H * 0.38 * k + 6);
  }
  // chests keep inside an oval round the Button, not in heaps along the edges of the screen
  function inField(x, y) {
    const b = btnPos(), rx = W * 0.44, ry = H * 0.38, dx = x - b.x, dy = y - b.y - 6, r = Math.hypot(dx / rx, dy / ry);
    if (r > 1) { const k = rand(0.8, 0.98) / r; x = b.x + dx * k; y = b.y + 6 + dy * k; }
    return onField(x, y);
  }
  function visFor(c) {
    let v = vis.get(c.id);
    if (!v) {
      const slot = freeSlot(), s = slot >= 0 ? slots[slot] : fieldSpot();
      v = { slot, x: s.x, y: s.y, t: 0, drop: 1, hit: 0 };
      vis.set(c.id, v);
    }
    return v;
  }
  // with a crowd of chests the field ones shrink to little ones
  const miniChest = (v, c) => (c && c.small) || (v.slot < 0 && G.S.chests.length > 12);
  const chestSpr = (c, v) => SPR.get((c.bag ? 'bag_' : miniChest(v, c) && SPR.defs['chestm_' + c.tier] ? 'chestm_' : 'chest_') + c.tier);
  St.chestScreen = function (c) { const v = vis.get(c.id); return v ? { x: v.x * S, y: v.y * S } : null; };
  // Logical stage point -> viewport pixels (for the tutorial pointer)
  St.toScreen = function (x, y) { const r = cv.getBoundingClientRect(); return { x: r.left + x * S, y: r.top + y * S }; };
  St.chestPoint = function (c) { const v = vis.get(c.id); return v ? St.toScreen(v.x, v.y - 12) : null; };
  St.mobPoint = function (m) { const q = mobPos(m); return St.toScreen(q.x, q.y - 18); };
  St.wispPoint = function () { return St._wispPos ? St.toScreen(St._wispPos.x, St._wispPos.y - 10) : null; };
  St.buttonPoint = function () { const b = btnPos(); return St.toScreen(b.x, b.y - 24); };

  // ---------- Particles & text ----------
  function part(x, y, col, o) {
    if (parts.length > MAXP) parts.shift();
    parts.push(Object.assign({ x, y, vx: rand(-40, 40), vy: rand(-70, -20), life: rand(0.4, 0.9), max: 0, col, size: 1, grav: 120 }, o || {}));
    parts[parts.length - 1].max = parts[parts.length - 1].life;
  }
  function burst(x, y, col, n, speed, o) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = rand(speed * 0.4, speed);
      part(x, y, Array.isArray(col) ? pick(col) : col, Object.assign({ vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20 }, o || {}));
    }
  }
  function text(x, y, str, col, size, o) {
    if (texts.length > 70) texts.shift();
    texts.push(Object.assign({ x, y, str, col, size: size || 5, vy: -22, life: 1.1, max: 1.1, pop: 0.12 }, o || {}));
  }
  St.text = text;
  St.shake = v => { if (G.S.set.shake) shake = Math.max(shake, v); };
  St.flash = (v, c) => { flash = Math.max(flash, v); flashCol = c || '#ffffff'; };

  function rarityCol(r) { return G.RARITIES[r].color; }
  // Title cards sit under the HUD: lower on narrow screens, where the HUD takes more room
  const cardY = k => Math.round(H * (W * S < 600 ? k + 0.1 : k));
  // Title cards take turns: each card's lines appear together, the next card when this one is done
  const cardQ = [];
  let cardT = 0;
  let lastCard = null;
  function cardText(off, str, col, size, o) {
    o = o || {};
    let g = lastCard;
    if (off === 0 || !g || g.shown) {
      g = { items: [], life: 0, callout: !!o.callout, age: 0, tag: o.tag };
      // an urgent card (a boss changing phase) cuts in front and replaces whatever is up
      if (o.now) { cardQ.unshift(g); cardT = 0; for (let i = texts.length - 1; i >= 0; i--) if (texts[i].card) texts.splice(i, 1); }
      else cardQ.push(g);
      lastCard = g;
    }
    g.items.push({ off, str, col, size, o });
    g.life = Math.max(g.life, o.life || 1.1);
    // streak callouts are only worth showing on time
    while (cardQ.length > 5) { const i = cardQ.findIndex(x => x.callout); cardQ.splice(i >= 0 ? i : 0, 1); }
  }
  function stepCards(dt) {
    for (const g of cardQ) g.age += dt;
    if (cardT > 0) { cardT -= dt; return; }
    while (cardQ.length && cardQ[0].callout && cardQ[0].age > 1) cardQ.shift();
    const g = cardQ.shift();
    if (!g) return;
    g.shown = true;
    const y0 = cardY(0.27);
    for (const it of g.items) text(W / 2, y0 + it.off, it.str, it.col, it.size, Object.assign({}, it.o, { life: g.life, max: g.life, card: true }));
    cardT = g.life * 0.8;
  }
  St.cardBusy = () => cardT > 0;

  // ---------- Events ----------
  function listen() {
    G.on('click', ev => {
      const b = bossVis ? bossPos() : btnPos();
      btnPress = 0.09;
      btnSpring.v -= ev.crit || ev.mega ? 0.3 : 0.17; kick = 1;
      if (ev.crit || ev.mega) { hitstop = Math.max(hitstop, 0.03); btnFlashT = 0.08; }
      const x = b.x + rand(-16, 16), y = b.y - 14 - rand(0, 8);
      const combo = ev.combo;
      const col = ev.mega ? '#7fe9ff' : ev.crit ? '#ff7a2e' : combo >= 150 ? '#ff7ae6' : combo >= 60 ? '#ffe27a' : '#ffffff';
      const size = ev.mega ? 9 : ev.crit ? 7 : 5;
      if (!ev.crit && !ev.mega && texts.length > 26) texts.splice(texts.findIndex(q => !q.big), 1);
      const live = clickTxt && texts.includes(clickTxt) && clickTxt.max - clickTxt.life < 0.35;
      if (!ev.crit && !ev.mega && live) {
        clickTxt.sum += ev.gain; clickTxt.str = '+' + fmtSmall(clickTxt.sum); clickTxt.col = col;
        clickTxt.life = clickTxt.max = 0.8; clickTxt.pop = 0.12; clickTxt.size = Math.min(8, 5 + Math.log10(1 + clickTxt.n++));
      } else {
        text(x, y, '+' + fmtSmall(ev.gain), col, size, ev.crit || ev.mega ? { life: 1.3, max: 1.3, big: true } : { life: 0.8, max: 0.8 });
        if (!ev.crit && !ev.mega) { clickTxt = texts[texts.length - 1]; clickTxt.sum = ev.gain; clickTxt.n = 1; }
      }
      ring(b.x, b.y - 2, 22, 8, ev.crit ? '#ff7a2e' : '#ffffff', 0.16);
      // combo tiers: a quarter, half and full of the cap each announce themselves once
      const cap = G.D.comboCap || 50, tier = combo >= cap ? 3 : combo >= cap / 2 ? 2 : combo >= cap / 4 ? 1 : 0;
      if (tier > comboTier) { text(b.x, b.y - 46, tier === 3 ? G.t('overcharged') : G.t('comboUp', (1 + combo * G.D.comboPer).toFixed(2)), tier === 3 ? '#ff7ae6' : '#ffe27a', tier === 3 ? 6 : 4, { life: 1.2, max: 1.2, vy: -14, big: true }); ring(b.x, b.y - 4, 40, 20, tier === 3 ? '#ff7ae6' : '#ffe27a', 0.4); if (G.Audio && G.Audio.comboUp) G.Audio.comboUp(tier); }
      comboTier = tier;
      if (ev.crit) { text(x, y - 9, G.t('crit'), '#ff4f4f', 5, { vy: -30 }); St.shake(2); }
      if (ev.mega) { text(x, y - 12, 'MEGA ×30', '#7fe9ff', 7, { vy: -30, life: 1.5, max: 1.5 }); St.shake(5); St.flash(0.25, '#7fe9ff'); }
      const n = ev.crit ? 10 : 4;
      burst(b.x, b.y - 4, ['#ffd84a', '#ffe27a', '#c98f10'], n, 70, { size: rand(1, 2) | 0 || 1 });
      if (bossVis) { bossHitT = 0.07; burst(b.x + rand(-8, 8), b.y - rand(0, 12), '#ffffff', 3, 50); }
      if (pointer.over && ev.x != null) burst(ev.x, ev.y, '#ffffff', 2, 30, { life: 0.25 });
    });
    G.on('autoClicks', (n) => {
      // pets fire sparkles at the target
      const tgt = bossVis ? bossPos() : btnPos();
      const pets = G.S.active;
      for (let i = 0; i < Math.min(n, 3); i++) {
        if (!pets.length) break;
        const pp = petPos(i % pets.length);
        shots.push({ x: pp.x, y: pp.y, sx: pp.x, sy: pp.y, tx: tgt.x + rand(-4, 4), ty: tgt.y - 6, t: 0, dur: 0.25, col: '#fff3a0' });
      }
    });
    G.on('chestSpawn', (c, fromBoss) => {
      // Loot from a mob pops out of its body in an arc and lands where it fell
      const src = G.R.dropAt;
      if (G.R.rain) {
        const land = fieldSpot();
        vis.set(c.id, { slot: -1, x: land.x, y: land.y, t: 0, drop: 0, hit: 0, arc: { sx: land.x + rand(-30, 30), sy: -30, t: 0, dur: rand(0.55, 0.85) } });
        return;
      }
      if (src) {
        const q = mobPos(src);
        const land = inField(q.x + rand(-10, 10), q.y + rand(-2, 6));
        vis.set(c.id, { slot: -1, x: land.x, y: land.y, t: 0, drop: 0, hit: 0, arc: { sx: q.x, sy: q.y - 8, t: 0, dur: 0.5 } });
        return;
      }
      const v = visFor(c);
      v.drop = 1; v.t = 0;
      if (c.tier >= 3 && G.S.chests.length < 60) beams.push({ x: v.x, y: v.y, col: rarityCol(c.tier), life: 0.8, max: 0.8, w: 3 });
    });
    G.on('merge', (partsC, nc) => {
      const pts = partsC.map(c => vis.get(c.id)).filter(Boolean);
      const v = visFor(nc);
      for (const p of pts) {
        flyers.push({ x: p.x, y: p.y, tx: v.x, ty: v.y, t: 0, dur: 0.3, spr: 'chest_' + Math.max(0, nc.tier - 1) });
      }
      partsC.forEach(c => vis.delete(c.id));
      v.drop = 0; v.pop = 0.35;
      burst(v.x, v.y - 4, [rarityCol(nc.tier), '#ffffff'], 14, 60);
      text(v.x, v.y - 12, G.t('fusion'), rarityCol(nc.tier), 4);
    });
    G.on('chestOpen', loot => {
      const c = loot.chest;
      let v = vis.get(c.id);
      let x, y;
      if (v) { x = v.x; y = v.y; vis.delete(c.id); }
      else if (loot.source === 'boss' && bossVis) { const b = bossPos(); x = b.x + rand(-20, 20); y = b.y + rand(-4, 10); }
      else { const b = btnPos(); x = b.x + rand(-30, 30); y = b.y + rand(10, 25); }
      if (loot.source === 'offline') return;
      const top = loot.items.length ? loot.items.reduce((a, b) => (b.it.r > a.it.r ? b : a), loot.items[0]) : null;
      const r = top ? top.it.r : 0;
      // a little chest of coin: a pop and the gold
      if (!top) { burst(x, y - 4, ['#ffd84a', '#fff3a0', rarityCol(c.tier)], 5, 45, { life: 0.35 }); openHeat += 1; killGold += loot.gold; if (killGoldT <= 0) killGoldT = 0.3; if (coins.length < 200) coins.push({ x, y: y - 6, vx: rand(-30, 30), vy: rand(-80, -40), floor: y + rand(-2, 3), t: rand(0.35, 0.6), fly: 0 }); return; }
      // many at once (Looters, Plunder, a full field): a pop and the gold, the good ones still in full
      openHeat += 1;
      if (openHeat > 6 && r < 3 && !c.mod) {
        burst(x, y - 4, [rarityCol(c.tier), '#ffd84a'], 3, 40, { life: 0.3 });
        killGold += loot.gold; if (killGoldT <= 0) killGoldT = 0.3;
        return;
      }
      opening.push({ x, y, tier: c.tier, t: 0, dur: 0.35, bag: c.bag });
      burst(x, y - 5, [rarityCol(r), '#ffffff', rarityCol(c.tier)], 8 + r * 4, 55 + r * 10);
      if (r >= 3) beams.push({ x, y, col: rarityCol(r), life: 1.2 + r * 0.2, max: 1.2 + r * 0.2, w: r >= 5 ? 7 : 5 });
      // Item icons pop up
      loot.items.slice(0, 5).forEach((li, i) => {
        flyers.push({ x: x + (i - (Math.min(5, loot.items.length) - 1) / 2) * 9, y: y - 8, vy: -26, t: 0, dur: 1.1, spr: 'it_' + li.it.id, float: true, r: li.it.r });
      });
      text(x, y - 14, '+' + G.fmt(loot.gold), '#ffd84a', 4, { vy: -16 });
      if (r >= 2) text(x, y - 22, G.L(top.it.name), rarityCol(r), 4, { vy: -12, life: 1.6, max: 1.6 });
      if (loot.pots.length) text(x, y - 30, G.t('potionGot'), '#ff7ae6', 4, { vy: -10, life: 1.6, max: 1.6 });
      if (r >= 5) { St.shake(4); St.flash(r === 6 ? 0.7 : 0.35, rarityCol(r)); }
      if (c.mod === 'golden') burst(x, y - 4, ['#ffd84a', '#fff3a0'], 30, 90);
      if (c.mod === 'void') burst(x, y - 4, ['#8a4dff', '#3a2266', '#e0d0ff'], 20, 50);
    });
    G.on('lightning', (c, targets) => {
      const v0 = vis.get(c.id); if (!v0) return;
      for (const t of targets) {
        const v = vis.get(t.id); if (!v) continue;
        const pts = [[v0.x, v0.y - 5]];
        for (let i = 1; i < 6; i++) pts.push([v0.x + (v.x - v0.x) * i / 6 + rand(-5, 5), v0.y - 5 + (v.y - v0.y) * i / 6 + rand(-5, 5)]);
        pts.push([v.x, v.y - 5]);
        bolts.push({ pts, life: 0.35 });
      }
      St.flash(0.15, '#7fe9ff');
    });
    G.on('chestHit', c => { const v = vis.get(c.id); if (v) { v.hit = 0.12; burst(v.x, v.y - 5, c.mod === 'frozen' ? ['#bfe8ff', '#ffffff'] : ['#ff4f4f', '#ffffff'], 5, 40); } });
    G.on('mimicWake', c => { const v = vis.get(c.id); if (v) { v.hit = 0.3; text(v.x, v.y - 14, G.t('mimic'), '#ff4f4f', 5); St.shake(3); } });
    G.on('mimicFlee', c => { const v = vis.get(c.id); if (v) { burst(v.x, v.y, '#9a9aa8', 10, 40); text(v.x, v.y - 10, G.t('fled'), '#9a9aa8', 4); } vis.delete(c.id); });
    G.on('burn', (c, g) => { const v = vis.get(c.id); if (v) { burst(v.x, v.y, ['#ff7a2e', '#ffd84a', '#3a3a44'], 16, 50); text(v.x, v.y - 10, G.t('burned'), '#ff7a2e', 4); } vis.delete(c.id); });
    G.on('spill', (tier, g) => { if (g < 1) return; const b = btnPos(); text(b.x + rand(-40, 40), b.y + 30, G.t('noRoom') + ' +' + G.fmt(g), '#c8c8d4', 3, { vy: -10 }); });
    G.on('golem', (c, i) => {
      const v = vis.get(c.id); if (!v) return;
      const L = i != null ? lootVis[i] : null;
      if (L) { L.lift = 0.25; L.x = v.x - 5 * L.face; L.y = v.y + 1; burst(v.x, v.y - 6, ['#ffd84a', '#7fe9ff'], 4, 40, { life: 0.3 }); return; }
      const b = btnPos();
      shots.push({ x: b.x, y: b.y + 14, sx: b.x, sy: b.y + 14, tx: v.x, ty: v.y - 4, t: 0, dur: 0.18, col: '#ffd84a', key: true });
    });
    G.on('plunder', (m, c) => {
      const v = vis.get(c.id); if (!v) return;
      const q = mobPos(m);
      shots.push({ x: q.x, y: q.y - 6, sx: q.x, sy: q.y - 6, tx: v.x, ty: v.y - 4, t: 0, dur: 0.22, col: '#ffd84a' });
    });
    G.on('heroAttack', onHeroAttack);
    G.on('mobDie', gore);
    G.on('mobFlee', m => { const q = mobPos(m); burst(q.x, q.y - 6, '#6e6e7c', 6, 30); mobVis.delete(m.id); });
    G.on('mobBite', m => {
      btnHurtT = 0.15; mobVisOf(m).lunge = 0.12;
      const b = btnPos(); burst(b.x + rand(-14, 14), b.y - 4, ['#ff4f4f', '#ffffff'], m.kind === 'fodder' ? 1 : 3, 40);
    });
    G.on('surge', () => {
      cardText(0, G.t('surge'), '#ff4f4f', 7, { life: 2, max: 2, vy: -4, big: true });
      St.shake(3); St.flash(0.18, '#ff3b3b');
    });
    G.on('rareSpawn', () => cardText(12, G.t('rareComing'), '#ffd84a', 4, { life: 1.8, max: 1.8, vy: -4 }));
    G.on('buttonBreak', () => {
      const b = btnPos();
      St.shake(6); St.flash(0.5, '#ff3b3b');
      burst(b.x, b.y - 6, ['#ff4f4f', '#ffd84a', '#3a3a44'], 40, 110);
      text(b.x, b.y - 30, G.t('btnBroken'), '#ff4f4f', 5, { life: 1.8, max: 1.8, vy: -10 });
      cardText(0, G.t('btnBrokenCard'), '#ff4f4f', 6, { life: 2.2, vy: -3, big: true });
      cardText(9, G.t('btnBrokenSub', G.TUNE.btnDown), '#ffffff', 3, { life: 2.2, vy: -3 });
    });
    partyListen();
    G.on('levelUp', lvl => {
      const hp = heroPos();
      hitstop = Math.max(hitstop, 0.06);
      for (const g of gems) g.t = Math.min(g.t, 0); // every crystal on the field flies in
      burst(hp.x, hp.y - 12, ['#a8dcff', '#ffffff', '#4f8cff', '#ffe27a'], 34, 80);
      ring(hp.x, hp.y - 4, 26, 12, '#a8dcff', 0.5); ring(hp.x, hp.y - 4, 16, 8, '#ffffff', 0.35);
      beams.push({ x: hp.x, y: hp.y, col: '#a8dcff', life: 0.9, max: 0.9, w: 9 });
      text(hp.x, hp.y - 32, G.t('levelUp', lvl), '#a8dcff', 5, { life: 1.6, max: 1.6, vy: -14, big: true });
      St.flash(0.18, '#a8dcff');
      if (G.Audio && G.Audio.levelUp) G.Audio.levelUp();
    });
    G.on('perk', id => {
      const hp = heroPos();
      burst(hp.x, hp.y - 12, ['#ffe27a', '#ffffff'], 20, 60);
      text(hp.x, hp.y - 32, G.PERKS[id].name, '#ffe27a', 4, { life: 1.4, max: 1.4, vy: -12 });
    });
    G.on('evolve', () => {
      const hp = heroPos();
      burst(hp.x, hp.y - 12, ['#ffd84a', '#ffffff', '#ff7a2e'], 60, 110);
      ring(hp.x, hp.y - 4, 40, 20, '#ffd84a', 0.7); ring(hp.x, hp.y - 4, 26, 13, '#ffffff', 0.5);
      beams.push({ x: hp.x, y: hp.y, col: '#ffd84a', life: 1.6, max: 1.6, w: 11 });
      St.shake(5); St.flash(0.35, '#ffd84a'); slowmo = 0.5;
    });
    G.on('journey', () => { const hp = heroPos(); burst(hp.x, hp.y - 20, ['#ffd84a', '#fff3a0'], 24, 70); });
    G.on('bladeHit', m => { const q = mobPos(m); mobVisOf(m).hit = 0.08; burst(q.x, q.y - 5, ['#e6ebf2', '#ffffff'], 3, 40, { life: 0.2 }); });
    G.on('auraTick', list => { for (const m of list) mobVisOf(m).hit = Math.max(mobVisOf(m).hit, 0.04); if (list.length) { const m = list[Math.floor(Math.random() * list.length)], q = mobPos(m); part(q.x + rand(-3, 3), q.y - 4, pick(['#ffe27a', '#fff3a0']), { vx: 0, vy: -20, grav: 0, life: 0.4 }); } });
    G.on('nova', rad => {
      const b = btnPos(), r = aoePx(rad || 0.5);
      ring(b.x, b.y - 4, r.rx, r.ry, '#fff3a0', 0.45); ring(b.x, b.y - 4, r.rx * 0.7, r.ry * 0.7, '#ffffff', 0.3);
      St.shake(2); St.flash(0.12, '#fff3a0');
    });
    G.on('chain', (from, list) => {
      const a = mobPos(from);
      for (const m of list) {
        const q = mobPos(m), pts = [[a.x, a.y - 6]];
        for (let i = 1; i < 4; i++) pts.push([a.x + (q.x - a.x) * i / 4 + rand(-4, 4), a.y - 6 + (q.y - a.y) * i / 4 + rand(-4, 4)]);
        pts.push([q.x, q.y - 6]);
        bolts.push({ pts, life: 0.15 });
      }
    });
    G.on('ability', type => {
      hero.cast = 0.35;
      const b = btnPos(), hp = heroPos();
      const cfg = { potion: ['#ff4f7e', '#ffc0cc'], tome: ['#56d45a', '#d8ffd0'], scroll: ['#ffd84a', '#fff3a0'], skull: ['#b36bff', '#ffffff'], orb: ['#7fe9ff', '#ffffff'], wing: ['#ffffff', '#bfe8ff'], egg: ['#ffe27a', '#ffffff'] }[type] || ['#ffffff'];
      if (type === 'skull' || type === 'egg') {
        for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; part(b.x, b.y - 6, pick(cfg), { vx: Math.cos(a) * 120, vy: Math.sin(a) * 70, grav: 0, life: 0.5 }); }
        St.shake(4); St.flash(0.2, cfg[0]);
      } else if (type === 'potion' || type === 'tome') {
        burst(b.x, b.y - 6, cfg, 24, 50, { vy: -40 });
      } else burst(hp.x, hp.y - 12, cfg, 24, 70);
      text(hp.x, hp.y - 30, G.L(G.ABILITIES[type].name), cfg[0], 4, { life: 1.2, max: 1.2, vy: -16 });
    });
    G.on('classChosen', () => { const hp = heroPos(); burst(hp.x, hp.y - 12, ['#ffffff', '#ffe27a'], 30, 80); St.flash(0.3, '#ffffff'); });
    G.on('bossStart', b => {
      bossVis = { t: 0, sprite: SPR.boss(b.sprite, b.lord), lord: b.lord, enter: 1 };
      St.shake(4); St.flash(0.3, b.lord ? '#ff3b3b' : '#ffffff');
      const p = btnPos();
      burst(p.x, p.y, ['#3a3a44', '#6e6e7c', '#ffffff'], 30, 90);
      ring(p.x, p.y - 4, 60, 34, '#ffffff', 0.5);
      bossBulletT = 1.2;
    });
    G.on('bossWin', (rew, b) => {
      const p = bossPos();
      if (bossVis) explodeSprite(bossVis.sprite.canvas, p.x, p.y, bossScale(), 90, 1.8);
      slowmo = 0.8;
      ring(p.x, p.y - 6, 90, 50, '#ffd84a', 0.7); ring(p.x, p.y - 6, 60, 34, '#ffffff', 0.45);
      decal(p.x, p.y, (GORE[G.REALMS[b.realm].id] || GORE.meadow).blood, 16);
      burst(p.x, p.y - 8, ['#ffd84a', '#ffffff', '#ff7a2e', '#ff4f4f'], 60, 130);
      text(p.x, p.y - 30, G.t('victory'), '#ffd84a', 8, { life: 1.8, max: 1.8, vy: -12 });
      St.shake(7); St.flash(0.5, '#ffd84a');
      bossVis = null; bullets.length = 0;
    });
    G.on('bossFail', () => {
      const p = bossPos();
      text(p.x, p.y - 30, G.t('bossFled'), '#9a9aa8', 6, { life: 1.6, max: 1.6 });
      burst(p.x, p.y, '#6e6e7c', 30, 80);
      bossVis = null; bullets.length = 0;
    });
    G.on('wispCatch', (e, amount) => {
      const w = St._wispPos || btnPos();
      burst(w.x, w.y, ['#fff3a0', '#ffd84a', '#ffffff'], 30, 90);
      text(w.x, w.y - 10, G.L(e.name), '#fff3a0', 5, { life: 1.8, max: 1.8, vy: -14 });
      if (amount) text(w.x, w.y, '+' + G.fmt(amount), '#ffd84a', 5);
      St.flash(0.25, '#fff3a0');
    });
    G.on('realm', r => {
      groundKey = ''; St.flash(0.3, '#000000');
      // a title card for the new land and its rule
      const R_ = G.REALMS[r];
      cardText(0, G.realmName(G.S.depth).toUpperCase(), '#ffffff', 7, { life: 3, max: 3, vy: -3, big: true });
      cardText(11, R_.rule + ': ' + R_.ruleDesc, '#ffe27a', 3, { life: 3, max: 3, vy: -3 });
      cardText(19, G.t('zoneCard', 1, G.ZONE_NAME(G.S.depth)), '#ffffff', 3, { life: 3, max: 3, vy: -3 });
    });
    G.on('ascend', () => { gems.length = 0; });
    // the first land introduces itself when the Warden takes the field, and again after each ascension
    G.on('classChosen', () => setTimeout(() => {
      const d = G.S.depth, R_ = G.REALMS[G.realmIndex(d)];
      cardText(0, G.realmName(d).toUpperCase(), '#ffffff', 7, { life: 3, max: 3, vy: -3, big: true });
      cardText(11, G.t('zoneCard', G.zoneOf(d) + 1, G.ZONE_NAME(d)), '#ffe27a', 3, { life: 3, max: 3, vy: -3 });
    }, 700));
    G.on('ascend', () => { groundKey = ''; vis.clear(); mobVis.clear(); St.clearStain(); gibs.length = 0; heroKey = ''; streak.n = 0; St.flash(0.8, '#ffffff'); });
    G.on('buy', (kind) => { if (kind === 'hero') heroKey = ''; });
    worldListen();
  }

  function zoneCard(d) {
    const z = G.zoneOf(d), R_ = G.REALMS[G.realmIndex(d)];
    cardText(0, G.t('zoneCard', z + 1, G.ZONE_NAME(d)).toUpperCase(), '#ffffff', 5, { life: 2.6, max: 2.6, vy: -3, big: true });
    if (z === G.REALM_SIZE - 1) cardText(10, G.t('zoneLord'), '#ff4f7e', 4, { life: 2.6, max: 2.6, vy: -3 });
    // the kind of mob this zone brings for the first time
    const now = G.ZONE_MIX[z], before = z ? G.ZONE_MIX[z - 1] : {};
    for (const k in G.ARCHETYPES) if (now[k] > 0 && !(before[k] > 0) && z > 0) {
      const A = G.ARCHETYPES[k];
      const o = z === G.REALM_SIZE - 1 ? 19 : 10;
      cardText(o, G.t('newKind', (R_.mobs && R_.mobs[k]) || A.name), '#b6ff5a', 4, { life: 3.2, vy: -3 });
      cardText(o + 8, A.desc, '#e8f8d0', 3, { life: 3.2, vy: -3 });
    }
  }
  St.zoneCard = zoneCard;

  // ---------- Input ----------
  function toLogical(e) {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) / S, y: (e.clientY - r.top) / S };
  }
  function hitChest(p) {
    let best = null, bd = 1e9;
    for (const c of G.S.chests) {
      const v = vis.get(c.id); if (!v) continue;
      const mini = miniChest(v, c), dx = p.x - v.x, dy = p.y - (v.y - (mini ? 3 : 5));
      if (Math.abs(dx) <= (mini ? 7 : 10) && Math.abs(dy) <= (mini ? 6 : 9)) { const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = c; } }
    }
    return best;
  }
  function hitWisp(p) {
    const w = St._wispPos; if (!w || !G.R.wisp) return false;
    return Math.abs(p.x - w.x) < 10 && Math.abs(p.y - w.y) < 10;
  }
  function hitButton(p) {
    const b = bossVis ? bossPos() : btnPos();
    const rx = bossVis ? bossHalf().w + 4 : 20, ry = bossVis ? bossHalf().h + 4 : 18;
    return Math.abs(p.x - b.x) <= rx && Math.abs(p.y - (b.y - 4)) <= ry;
  }
  function hitReady(p) {
    if (!G.R.bossReady || G.R.boss || G.R.rift || G.R.inv) return false;
    const b = btnPos();
    return Math.abs(p.x - b.x) < 12 && Math.abs(p.y - (b.y - 44)) < 6;
  }
  function doPress(p) {
    G.Audio && G.Audio.unlock();
    if (hitWisp(p)) { G.catchWisp(); return 'wisp'; }
    if (hitReady(p)) { G.startBoss(); return 'boss'; }
    const mt = hitMeteor(p);
    if (mt != null && G.smashMeteor(mt)) return 'meteor';
    const ge = hitLoot(p);
    if (ge) { G.pickup(ge, 'hand'); return 'loot'; }
    if (hitShrine(p)) { G.useShrine('hand'); return 'shrine'; }
    const dn = hitDowned(p);
    if (dn != null) { G.reviveTap(dn); return 'revive'; }
    const c = hitChest(p);
    if (c) { G.clickChest(c); return 'chest'; }
    const m = hitMob(p);
    if (m) { G.R.focus = m.id; G.manualClick(p.x, p.y); return 'button'; }
    if (hitButton(p)) { G.manualClick(p.x, p.y); return 'button'; }
    return null;
  }
  function bindInput() {
    cv.addEventListener('pointerdown', e => {
      e.preventDefault();
      const p = toLogical(e);
      const what = doPress(p);
      if (what === 'button' && G.S.set.hold) { holding = true; holdTimer = 0.14; }
    });
    const end = () => { holding = false; };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('pointerleave', () => { end(); pointer.over = false; hoverChest = null; hoverLoot = null; });
    cv.addEventListener('pointermove', e => {
      const p = toLogical(e);
      pointer.x = p.x; pointer.y = p.y; pointer.over = true;
      hoverChest = hitChest(p);
      hoverLoot = hitLoot(p);
      cv.style.cursor = (hoverLoot || hitShrine(p) || hoverChest || hitMob(p) || hitButton(p) || hitWisp(p) || hitReady(p)) ? 'pointer' : 'default';
    });
    cv.addEventListener('contextmenu', e => e.preventDefault());
  }
  St.keyClick = function () { G.Audio && G.Audio.unlock(); G.manualClick(); };
  St.keyChest = function () {
    const list = G.S.chests;
    if (!list.length) return;
    const c = list.reduce((a, b) => (b.tier > a.tier ? b : a), list[0]);
    G.clickChest(c);
  };

  // ---------- Heroes & pets ----------
  function buildHeroes() {
    const key = G.HEROES.map(h => G.S.heroes[h.id] || 0).join(',') + '|' + W + 'x' + H;
    if (key === heroKey) return;
    heroKey = key;
    heroVis = [];
    const list = [];
    for (const h of G.HEROES) {
      const n = G.S.heroes[h.id] || 0;
      if (!n) continue;
      const k = Math.min(3, 1 + Math.floor(Math.log10(n)));
      for (let i = 0; i < k; i++) list.push(h);
    }
    const cap = Math.min(list.length, 28);
    const b = btnPos();
    for (let i = 0; i < cap; i++) {
      const h = list[i];
      // arc along the bottom and the sides
      const a = Math.PI * (0.08 + 0.84 * (cap === 1 ? 0.5 : i / (cap - 1)));
      const rx = W * 0.46, ry = H * 0.44;
      const x = Math.round(b.x - Math.cos(a) * rx), y = Math.round(b.y + Math.sin(a) * ry * 0.85 - 4);
      heroVis.push({ h, x: clamp(x, 6, W - 6), y: clamp(y, 30, H - 6), ph: Math.random() * 6, fire: Math.random() * 2 });
    }
  }
  function petPos(i) {
    const n = Math.max(1, G.S.active.length);
    const b = bossVis ? bossPos() : btnPos();
    const a = time * 0.8 + (i / n) * Math.PI * 2;
    const r = bossVis ? 36 : 30;
    return { x: Math.round(b.x + Math.cos(a) * r), y: Math.round(b.y - 2 + Math.sin(a) * r * 0.45 + Math.sin(time * 3 + i) * 1.5) };
  }

  // ---------- Boss ----------
  function bossScale() {
    if (!bossVis) return 1;
    const c = bossVis.sprite.canvas;
    const want = bossVis.lord ? 3 : 2;
    return Math.max(1, Math.min(want, Math.floor((H * 0.46) / c.height)));
  }
  function bossHalf() { const c = bossVis.sprite.canvas, s = bossScale(); return { w: c.width * s / 2, h: c.height * s / 2 }; }
  function bossPos() { const b = btnPos(); return { x: b.x, y: b.y - 2 }; }

  // ---------- Hero & mobs ----------
  const mobVis = new Map();
  let btnHurtT = 0;
  // The Warden's animation state: position, facing, walk cycle and the current move
  const hero = { x: null, y: null, face: 1, walk: 0, moving: false, atk: null, cast: 0, tgt: null, tgtT: 9, hand: null, top: null };
  function heroBase() { const b = btnPos(); return { x: b.x - 30, y: b.y + 16 }; }
  function heroPos() {
    if (hero.x == null) { const p = heroBase(); hero.x = p.x; hero.y = p.y; }
    return { x: Math.round(hero.x), y: Math.round(hero.y) };
  }
  const ATTACK = { sword: ['swing', 0.24], katana: ['swing', 0.2], scythe: ['swing', 0.3], dagger: ['stab', 0.15], bow: ['shot', 0.3], staff: ['cast', 0.3], wand: ['cast', 0.22] };
  // Melee Wardens step out to meet the crowd and fall back to the Button
  function stepHero(dt) {
    const base = heroBase();
    if (hero.x == null) { hero.x = base.x; hero.y = base.y; }
    const wt = G.D.hero ? G.D.hero.wtype : 'dagger';
    let gx = base.x, gy = base.y;
    hero.tgtT += dt;
    if (MELEE[wt] && hero.tgt && hero.tgtT < 0.9 && !bossVis) {
      const dx = hero.tgt.x - base.x, dy = hero.tgt.y - base.y, d = Math.hypot(dx, dy);
      const go = clamp(d - 11, 0, 26);
      if (d > 0) { gx = base.x + dx / d * go; gy = base.y + dy / d * go; }
    }
    gy = clamp(gy, 30, H - Math.ceil(70 / S));
    const dx = gx - hero.x, dy = gy - hero.y, d = Math.hypot(dx, dy);
    hero.moving = d > 0.7;
    if (hero.moving) {
      const st = Math.min(d, 80 * dt);
      hero.x += dx / d * st; hero.y += dy / d * st; hero.walk += dt;
      if (!hero.atk && Math.abs(dx) > 0.5) hero.face = dx > 0 ? 1 : -1;
    }
    if (hero.atk && (hero.atk.t += dt) >= hero.atk.dur) hero.atk = null;
    if (hero.cast > 0) hero.cast -= dt;
  }
  St.heroPos = heroPos;

  // ---------- The party on the field ----------
  // Companions hold places around the Button; the Warden keeps the left.
  const allyVis = [];
  const aVis = i => allyVis[i] || (allyVis[i] = { atk: null, face: 1, hurt: 0, heal: 0, ph: Math.random() * 6 });
  // clear of the chest ring by the Button
  const SLOTS_AT = [[34, 14], [0, 36], [-34, -4]];
  function allySlot(i) { const b = btnPos(), o = SLOTS_AT[i] || [0, 40]; return { x: b.x + o[0], y: b.y + o[1] }; }
  function unitPos(who) { return who === 'button' ? { x: btnPos().x, y: btnPos().y - 6 } : who < 0 ? heroPos() : allySlot(who); }
  St.unitPoint = who => { const q = unitPos(who); return St.toScreen(q.x, q.y - 12); };
  const ROLE_COL = { tank: '#7fb8ff', heal: '#8ae07a', dps: '#ff9a5a' };
  function hpBar(x, y, k, w, col) {
    lctx.fillStyle = '#0c0b12'; lctx.fillRect(Math.round(x - w / 2) - 1, y - 1, w + 2, 4);
    lctx.fillStyle = '#3a1a1e'; lctx.fillRect(Math.round(x - w / 2), y, w, 2);
    lctx.fillStyle = k > 0.5 ? '#56d45a' : k > 0.25 ? '#ffd84a' : '#ff4f4f'; lctx.fillRect(Math.round(x - w / 2), y, Math.max(0, Math.round(w * k)), 2);
    if (col) { lctx.fillStyle = col; lctx.fillRect(Math.round(x - w / 2) - 3, y - 1, 2, 4); }
  }
  // a fallen hero lies on its side, greyed, with a ring that fills as it gets back up
  function drawDowned(u, q) {
    lctx.save(); lctx.globalAlpha = 0.55;
    lctx.translate(q.x, q.y - 3); lctx.rotate(-Math.PI / 2);
    G.Doll.draw(lctx, u, 0, 0, { face: 1, pose: 'rest', ang: 0, time: 0 });
    lctx.restore();
    const k = clamp(1 - u.down / (G.TUNE.reviveTime || 24), 0, 1);
    lctx.strokeStyle = '#0c0b12'; lctx.lineWidth = 3; lctx.beginPath(); lctx.arc(q.x, q.y - 6, 9, 0, Math.PI * 2); lctx.stroke();
    lctx.strokeStyle = '#ffd84a'; lctx.lineWidth = 1; lctx.beginPath(); lctx.arc(q.x, q.y - 6, 9, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); lctx.stroke();
    if (Math.random() < 0.08) part(q.x + rand(-4, 4), q.y - 10, '#c8c8d4', { vx: 0, vy: -8, grav: 0, life: 0.6 });
  }
  function drawAlly(i, u, q) {
    const v = aVis(i);
    if (u.down > 0) { drawDowned(u, q); return; }
    const w = u.eq.weapon, wt = w ? G.ITEM_TYPE[w.id] : null;
    shadow(q.x, q.y - 1, 12);
    if (v.heal > 0) { glow(q.x, q.y - 8, 9, '#8ae07a', v.heal * 2); v.heal -= fdt; }
    let pose = 'rest', ang = G.Doll.restAngle(wt), draw = 0;
    const a = v.atk;
    if (a) {
      const k = a.t / a.dur;
      if (a.kind === 'swing') { if (k < 0.3) { pose = 'up'; ang = -2.4; } else { pose = 'fwd'; ang = G.lerp(-2.4, 0.8, Math.min(1, (k - 0.3) / 0.4)); } }
      else if (a.kind === 'stab') { if (k > 0.3) { pose = 'fwd'; ang = 0; } }
      else if (a.kind === 'shot') { pose = 'fwd'; draw = k < 0.5 ? k / 0.5 : 0; }
      else if (a.kind === 'cast') { if (k < 0.4) { pose = 'up'; ang = -1.9; } else { pose = 'fwd'; ang = -0.55; } }
      if ((a.t += fdt) >= a.dur) v.atk = null;
    }
    const bob = a ? 0 : Math.floor(time * 1.6 + v.ph) % 2;
    G.Doll.draw(lctx, u, q.x, q.y, { face: v.face, pose, bob, ang, draw, time: time + v.ph });
    if (v.hurt > 0) { lctx.globalAlpha = Math.min(0.6, v.hurt * 4); lctx.fillStyle = '#ff3b3b'; lctx.fillRect(q.x - 6, q.y - 20, 12, 20); lctx.globalAlpha = 1; v.hurt -= fdt; }
    hpBar(q.x, q.y - 24, u.hp / u.max, 14, ROLE_COL[u.role]);
  }
  // heals, bites and boss shots between the party, the Button and the Horde
  const beamsFx = [];
  function drawBeamsFx(dt) {
    for (let i = beamsFx.length - 1; i >= 0; i--) {
      const f = beamsFx[i];
      if ((f.t += dt) >= f.dur) { beamsFx.splice(i, 1); if (f.onEnd) f.onEnd(); continue; }
      const k = f.t / f.dur, a = unitPos(f.from), b = unitPos(f.to);
      if (f.kind === 'heal') {
        lctx.globalAlpha = 0.7 * (1 - k); lctx.strokeStyle = '#8ae07a'; lctx.lineWidth = 2;
        lctx.beginPath(); lctx.moveTo(a.x, a.y - 14); lctx.lineTo(b.x, b.y - 10); lctx.stroke(); lctx.globalAlpha = 1;
      } else {
        // a bolt from the boss to its victim
        const bp = bossVis ? bossPos() : btnPos(), x = bp.x + (b.x - bp.x) * k, y = bp.y - 12 + (b.y - 10 - bp.y + 12) * k - Math.sin(k * Math.PI) * 10;
        lctx.fillStyle = '#0c0b12'; lctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 5, 5);
        lctx.fillStyle = f.col || '#ff7a2e'; lctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
        if (Math.random() < 0.5) part(x, y, f.col || '#ffb347', { vx: rand(-8, 8), vy: rand(-8, 8), grav: 0, life: 0.2 });
      }
    }
  }
  function partyListen() {
    G.on('allyAttack', ev => {
      const v = aVis(ev.i), q = allySlot(ev.i), m = G.S.party[ev.i];
      if (!m) return;
      const wt = ev.wt || (m.eq.weapon ? G.ITEM_TYPE[m.eq.weapon.id] : 'sword'), at = ATTACK[wt] || ['swing', 0.24];
      v.atk = { kind: at[0], t: 0, dur: at[1] };
      const t0 = ev.ids && G.R.mobs.find(x => x.id === ev.ids[0]);
      const tp = t0 ? mobPos(t0) : ev.boss && bossVis ? bossPos() : null;
      if (!tp) return;
      v.face = tp.x >= q.x ? 1 : -1;
      if (shots.length < 110 && !MELEE[wt]) shots.push({ x: q.x, y: q.y - 10, sx: q.x, sy: q.y - 10, tx: tp.x, ty: tp.y - 6, t: 0, dur: 0.2, col: G.WEAPONS[wt] ? G.WEAPONS[wt].col : '#ffffff', arrow: wt === 'bow', flat: wt === 'bow', big: wt === 'staff' });
      else if (MELEE[wt]) burst(tp.x, tp.y - 5, ['#ffffff', G.WEAPONS[wt].col], 3, 40, { life: 0.2 });
      for (const id of ev.splash || []) mobVisOf({ id }).hit = 0.07;
      for (const id of ev.ids || []) mobVisOf({ id }).hit = 0.09;
    });
    G.on('heal', (i, who) => {
      beamsFx.push({ kind: 'heal', from: i, to: who, t: 0, dur: 0.35 });
      const q = unitPos(who);
      burst(q.x, q.y - 12, ['#8ae07a', '#ffffff'], 5, 30, { grav: -20, life: 0.5 });
      if (who !== 'button') aVisOf(who).heal = 0.3;
    });
    G.on('unitHurt', (who, dmg, src) => {
      aVisOf(who).hurt = 0.12;
      const q = unitPos(who), max = who < 0 ? G.D.wardenHp : (G.D.party[who] || {}).hp || 1, f = dmg / Math.max(1, max);
      hurtFx = Math.min(1, hurtFx + f * 1.6);
      const big = f > 0.12 || src === 'boss' || src === 'slam' || src === 'barrage' || src === 'meteor';
      if (big || Math.random() < 0.35) text(q.x + rand(-5, 5), q.y - 28, '-' + G.fmt(dmg), big ? '#ff3b3b' : '#ff6b6b', big ? 4 : 3, { life: 0.7, max: 0.7, vy: -18 });
      if (big) { burst(q.x, q.y - 8, ['#ff3b3b', '#ffffff'], 5, 50); St.shake(2); }
    });
    // the Button: every bite shows, summed up a few times a second so a swarm reads as one big number
    G.on('buttonHurt', dmg => {
      const f = dmg / Math.max(1, G.D.heroHp);
      btnDmg += dmg; hurtFx = Math.min(1, hurtFx + f * 2.2);
      if (f > 0.06) { btnSpring.v -= Math.min(0.35, f * 2); St.shake(Math.min(5, 1 + f * 20)); }
    });
    G.on('unitDown', who => {
      const q = unitPos(who);
      burst(q.x, q.y - 8, ['#8a8a9a', '#ff4f4f', '#ffffff'], 18, 70);
      text(q.x, q.y - 30, G.t('downed'), '#ff4f4f', 4, { life: 1.4, max: 1.4, vy: -10 });
      St.shake(2);
    });
    G.on('unitRevive', who => { const q = unitPos(who); burst(q.x, q.y - 8, ['#ffd84a', '#8ae07a', '#ffffff'], 20, 60, { grav: -30 }); text(q.x, q.y - 30, G.t('backUp'), '#8ae07a', 4, { life: 1.2, max: 1.2, vy: -10 }); ring(q.x, q.y - 4, 14, 7, '#ffd84a', 0.4); });
    G.on('reviveTap', who => { const q = unitPos(who); burst(q.x, q.y - 8, ['#ffd84a', '#ffffff'], 6, 40, { life: 0.3 }); });
    G.on('bossHit', (b, v) => beamsFx.push({ kind: 'bolt', from: 'boss', to: v, t: 0, dur: 0.35, col: b.lord ? '#ff4f7e' : '#ff7a2e' }));
    G.on('barrageHit', (b, v, i) => setTimeout(() => beamsFx.push({ kind: 'bolt', from: 'boss', to: v, t: 0, dur: 0.4, col: '#ffb347' }), i * 90));
    G.on('buttonPulse', () => { const b = btnPos(); ring(b.x, b.y - 4, 30, 15, '#ffd84a', 0.35); ring(b.x, b.y - 4, 20, 10, '#ffffff', 0.25); if (G.Audio && G.Audio.pulse) G.Audio.pulse(); });
    G.on('buttonFixed', () => { const b = btnPos(); burst(b.x, b.y - 8, ['#ffd84a', '#ffffff', '#56d45a'], 24, 80); text(b.x, b.y - 32, G.t('buttonFixed'), '#56d45a', 4, { life: 1.4, max: 1.4, vy: -10 }); });
    G.on('clickDead', () => { const b = btnPos(); burst(b.x + rand(-8, 8), b.y - 6, ['#6e6e7c', '#3a3a44'], 3, 25, { life: 0.3 }); });
    G.on('recruit', (m, i) => { const q = allySlot(i); burst(q.x, q.y - 10, ['#ffd84a', '#ffffff'], 30, 90); ring(q.x, q.y - 4, 20, 10, '#ffd84a', 0.5); cardText(0, G.t('joined', G.L(G.CLASS_BY_ID[m.cls].name)).toUpperCase(), '#ffd84a', 6, { life: 2.4, vy: -3, big: true }); cardText(9, G.t('role_' + G.ROLES[m.cls]), '#ffffff', 3, { life: 2.4, vy: -3 }); });
    G.on('evStart', (ev, e) => {
      if (e.id === 'jackpot') return; // the jackpot has a show of its own
      cardText(0, e.name, e.col, 7, { life: 2.6, vy: -2, big: true, now: true });
      cardText(10, e.sub, '#ffffff', 3, { life: 2.6, vy: -2 });
      St.flash(0.3, e.col); St.shake(e.id === 'ambush' || e.id === 'stampede' ? 6 : 3);
      if (G.Audio && G.Audio.event) G.Audio.event(e.id);
    });
    G.on('evEnd', (ev, e, ok, reward) => {
      if (reward && ev.k === 'stampede') cardText(0, G.t('evHeld', reward), '#ffd84a', 6, { life: 2.2, vy: -3, big: true });
      else if (reward && ev.k === 'ambush') cardText(0, G.t('evCleared', reward), '#ffd84a', 6, { life: 2.2, vy: -3, big: true });
      else if (ok && ev.k === 'goblins' && ev.ids.every(id => !G.R.mobs.some(m => m.id === id)) && ev.t > 0) cardText(0, G.t('evCaught'), '#8ae07a', 6, { life: 2, vy: -3, big: true });
      if (reward && G.Audio && G.Audio.levelUp) G.Audio.levelUp();
    });
    G.on('jackpot', (m, gold) => {
      jp = { t: 0, gold };
      hitstop = Math.max(hitstop, 0.5); slowmo = Math.max(slowmo, 2.5);
      St.flash(1, '#fff3a0'); St.shake(10);
      if (G.Audio && G.Audio.jackpot) G.Audio.jackpot();
    });
    G.on('meteorFall', () => { if (G.Audio && G.Audio.whoosh) G.Audio.whoosh(); });
    G.on('meteorHit', mt => {
      const q = metPos(mt);
      burst(q.x, q.y - 3, ['#ffd84a', '#ff7a2e', '#ff3b3b', '#3a2a24'], 26, 110);
      ring(q.x, q.y - 2, 22, 11, '#ff7a2e', 0.45);
      decal(q.x, q.y, ['#2a1a14', '#3a2418', '#1a0e0a'], 7);
      St.shake(3); hitstop = Math.max(hitstop, 0.03);
      if (G.Audio && G.Audio.boom) G.Audio.boom();
    });
    G.on('meteorSmash', (mt, g) => {
      const q = metPos(mt), f = 1 - mt.t / mt.T, mx = q.x + (1 - f) * 70, my = q.y - 6 - (1 - f) * 130;
      burst(mx, my, ['#ffd84a', '#ffffff', '#ff7a2e'], 18, 90);
      text(mx, my - 8, G.t('evSmashed', G.fmt(g)), '#ffd84a', 4, { life: 1.2, max: 1.2, vy: -14 });
      if (G.Audio && G.Audio.click) G.Audio.click(40, true);
    });
    G.on('slotOpen', () => { cardText(0, G.t('slotOpen'), '#ffd84a', 6, { life: 3, vy: -2, big: true }); cardText(9, G.t('slotOpenSub'), '#ffffff', 3, { life: 3, vy: -2 }); if (G.Audio && G.Audio.levelUp) G.Audio.levelUp(); });
    G.on('invasion', (r, V) => {
      St.flash(0.4, V.col); St.shake(4);
      cardText(0, V.name, V.col, 8, { life: 3, vy: -2, big: true });
      cardText(11, V.sub, '#ffffff', 3, { life: 3, vy: -2 });
      if (G.Audio && G.Audio.invasion) G.Audio.invasion(V.id);
    });
    G.on('invasionBoss', (m, V) => { cardText(0, V.bossName.toUpperCase(), V.col, 7, { life: 2.4, vy: -2, big: true }); cardText(10, G.t('heraldSub'), '#ffffff', 3, { life: 2.4, vy: -2 }); St.shake(5); });
    G.on('invasionEnd', (won, r) => { const V = G.INV_BY_ID[r.k]; cardText(0, won ? G.t('invWon') : G.t('invLost'), won ? '#ffd84a' : '#c8b4ff', 7, { life: 2.6, vy: -2, big: true }); if (won) { St.flash(0.4, '#ffd84a'); St.shake(6); } });
    G.on('wipe', (from, to, rift) => {
      St.flash(0.9, '#3a0000'); St.shake(9); slowmo = Math.max(slowmo, 1.2);
      cardText(0, G.t('wipeTitle'), '#ff4f4f', 8, { life: 3.4, vy: -2, big: true });
      cardText(11, rift ? G.t('wipeRift') : to < from ? G.t('wipeBack', to + 1) : G.t('wipeBar'), '#ffffff', 3, { life: 3.4, vy: -2 });
      if (G.Audio && G.Audio.wipe) G.Audio.wipe();
    });
    // a phase card still waiting when the fight ends is stale
    const dropPhase = () => { for (let i = cardQ.length - 1; i >= 0; i--) if (cardQ[i].tag === 'phase') cardQ.splice(i, 1); };
    G.on('bossWin', dropPhase); G.on('bossFail', dropPhase); G.on('wipe', dropPhase);
    G.on('bossPhase', b => {
      const bp = bossPos();
      hitstop = Math.max(hitstop, 0.25); St.shake(7); St.flash(0.35, b.lord ? '#ff4f7e' : '#ffffff');
      ring(bp.x, bp.y - 8, 70, 36, '#ffffff', 0.6); ring(bp.x, bp.y - 8, 50, 26, b.lord ? '#ff4f7e' : '#ffb347', 0.5);
      burst(bp.x, bp.y - 12, ['#ffffff', '#ffb347', '#ff4f7e'], 50, 150);
      cardText(0, G.t('phaseN', b.phase), b.phase >= 3 ? '#ff4f4f' : '#ffb347', 8, { life: 2, vy: -3, big: true, now: true, tag: 'phase' });
      cardText(11, G.t(b.phase >= 3 && b.lord ? 'phaseRage' : 'phaseSub'), '#ffffff', 3, { life: 2, vy: -3 });
      if (G.Audio && G.Audio.phase) G.Audio.phase();
    });
  }
  const aVisOf = who => (who < 0 ? hero : aVis(who));
  // a tap on a fallen hero helps them up
  function hitDowned(p) {
    for (const u of G.partyUnits ? G.partyUnits() : []) {
      if (!(u.down > 0)) continue;
      const q = unitPos(u.who);
      if (Math.abs(p.x - q.x) <= 9 && Math.abs(p.y - (q.y - 3)) <= 6) return u.who;
    }
    return null;
  }
  function mobPos(m) {
    const b = btnPos();
    const a = -Math.PI / 2 + 0.55 + m.a * (Math.PI * 2 - 1.1);
    // the crowd at the Button spreads into a loose ring instead of one pile
    const j = ((m.id * 7919) % 97) / 97;
    const sx = b.x + Math.cos(a) * W * 0.6, sy = b.y + Math.sin(a) * H * 0.56;
    const ex = b.x + Math.cos(a) * (21 + j * 10), ey = b.y + Math.sin(a) * (11 + j * 6) + 4;
    const v = mobVis.get(m.id);
    const k = v && v.vp != null ? v.vp : m.p;
    const bob = m.p < 1 ? Math.round(Math.abs(Math.sin(time * (m.kind === 'fodder' ? 14 : 9) + m.id)) * 1.5) : 0;
    return { x: Math.round(sx + (ex - sx) * k), y: Math.round(sy + (ey - sy) * k) - bob };
  }
  function mobVisOf(m) { let v = mobVis.get(m.id); if (!v) { v = { hit: 0 }; mobVis.set(m.id, v); } return v; }
  function hitMob(p) {
    let best = null, bd = 1e9;
    for (const m of G.R.mobs || []) {
      const q = mobPos(m);
      const dx = p.x - q.x, dy = p.y - (q.y - 7);
      if (Math.abs(dx) <= 10 && Math.abs(dy) <= 10) { const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = m; } }
    }
    return best;
  }
  function mobSprite(m, realm) {
    if (m.gob) { const f = Math.floor(time * 8 + m.id) % 2 ? 'm_thief_1' : 'm_thief'; return SPR.defs[f] ? SPR.get(f) : SPR.get('m_hoard'); }
    // an invasion's mobs come in its own shapes
    if (m.inv && G.INV_BY_ID[m.inv]) {
      const V = G.INV_BY_ID[m.inv];
      if (m.kind === 'guardian') return SPR.boss(V.boss, true).canvas;
      const id = G.SMALL[m.kind] ? V.swarm : V.elite;
      if (SPR.defs[id]) return SPR.get(id, m.kind === 'magic' ? { oc: '#3f7fff' } : m.kind === 'rare' ? { oc: '#ffd84a' } : null);
    }
    if (m.kind === 'fodder') return SPR.get(realm.fodder);
    if (G.ARCHETYPES && G.ARCHETYPES[m.kind]) return SPR.arch(m.kind, realm.id);
    if (m.kind === 'hoard') return SPR.get('m_hoard');
    if (m.kind === 'guardian') return SPR.boss(m.lord || realm.lord, true).canvas;
    return SPR.get(realm.minion, m.kind === 'magic' ? { oc: '#3f7fff' } : m.kind === 'rare' ? { oc: '#ffd84a' } : null);
  }
  const MOB_BAR = { brute: '#e84a4a', magic: '#5a9cff', rare: '#ffd84a', tank: '#c8c8d4', spitter: '#b6ff5a', bomber: '#ff7a2e' };
  function drawMob(m, q, realm) {
    const spr = mobSprite(m, realm);
    const v = mobVisOf(m);
    const fod = !!G.SMALL[m.kind];
    if (m.kind === 'guardian') { drawGuardian(m, spr, v, q); return; }
    shadow(q.x, q.y - 1, fod ? 6 : 10);
    if (m.br) glow(q.x, q.y - 5, fod ? 4 : 7, '#b36bff', 0.28);
    if (m.kind === 'hoard') {
      glow(q.x, q.y - 7, 9, '#ffd84a', 0.28 + 0.1 * Math.sin(time * 8));
      if (Math.random() < 0.35) part(q.x + rand(-4, 4), q.y - rand(2, 10), pick(['#ffd84a', '#fff3a0']), { vy: -10, vx: rand(-8, 8), grav: 60, life: 0.5 });
      if (v.hit > 0 && Math.random() < 0.5 && coins.length < 240) coins.push({ x: q.x, y: q.y - 8, vx: rand(-50, 50), vy: rand(-90, -40), floor: q.y + rand(-2, 3), t: rand(0.4, 0.7), fly: 0 });
    }
    if (m.kind === 'magic') glow(q.x, q.y - 8, 7, '#3f7fff', 0.2 + 0.07 * Math.sin(time * 5 + m.id));
    if (m.amb) glow(q.x, q.y - 6, 9, '#ff3b3b', 0.22 + 0.1 * Math.sin(time * 9 + m.id));
    if (m.gob && Math.random() < 0.15 && coins.length < 200) coins.push({ x: q.x, y: q.y - 6, vx: rand(-20, 20), vy: rand(-50, -20), floor: q.y + rand(-2, 3), t: rand(0.4, 0.7), fly: 0 });
    // a spitter swells before it spits; a bomber's fuse fizzes, faster as it gets close
    if (m.kind === 'spitter' && m.p >= (G.TUNE.spitStop || 0.68) && m.atkT < 0.6) glow(q.x, q.y - 5, 5, '#b6ff5a', 0.25 + 0.5 * (0.6 - m.atkT));
    if (m.kind === 'bomber') {
      if (Math.random() < 0.3) part(q.x + 2, q.y - 9, pick(['#ffe27a', '#ff7a2e', '#ffffff']), { vx: rand(-10, 10), vy: rand(-30, -10), grav: 40, life: 0.25 });
      if (m.p > 0.75 && Math.sin(time * (10 + 20 * m.p)) > 0.4) glow(q.x, q.y - 5, 5, '#ff3b3b', 0.35);
    }
    if (m.kind === 'runner' && m.p > 0 && Math.random() < 0.15) part(q.x, q.y - 1, '#d8cfb8', { vx: 0, vy: -4, grav: 0, life: 0.3 });
    if (m.kind === 'rare') glow(q.x, q.y - 9, 10, '#ffd84a', 0.24 + 0.08 * Math.sin(time * 6));
    let x = q.x, y = q.y;
    // a hit knocks it back from the Button for a moment, a small one further
    if (v.hit > 0) { const b = btnPos(), dx = q.x - b.x, dy = q.y - b.y, l = Math.hypot(dx, dy) || 1, k = v.hit * (fod ? 34 : 18); x += Math.round(dx / l * k + rand(-1, 1)); y += Math.round(dy / l * k * 0.6); }
    if (v.lunge > 0) { x += Math.sign(btnPos().x - q.x) * 2; v.lunge -= fdt; }
    blit(spr, x, y);
    if (v.hit > 0) { blit(white(spr), x, y, 1, Math.min(0.85, v.hit * 10)); v.hit -= fdt; }
    if (!fod && m.hp < m.max) {
      const w = m.kind === 'rare' || m.kind === 'hoard' || m.kind === 'tank' ? 16 : m.kind === 'bomber' || m.kind === 'spitter' ? 8 : 12, k = clamp(m.hp / m.max, 0, 1);
      lctx.fillStyle = '#0c0b12'; lctx.fillRect(q.x - w / 2 - 1, q.y - 21, w + 2, 3);
      lctx.fillStyle = MOB_BAR[m.kind] || '#ffd84a'; lctx.fillRect(q.x - w / 2, q.y - 20, Math.max(1, Math.round(w * k)), 1);
    }
    if (G.R.focus === m.id) {
      lctx.fillStyle = '#ffffff';
      const r = fod ? 6 : 9, y = q.y - (fod ? 4 : 8);
      lctx.fillRect(q.x - r, y - r, 3, 1); lctx.fillRect(q.x - r, y - r, 1, 3);
      lctx.fillRect(q.x + r - 2, y - r, 3, 1); lctx.fillRect(q.x + r, y - r, 1, 3);
      lctx.fillRect(q.x - r, y + r, 3, 1); lctx.fillRect(q.x - r, y + r - 2, 1, 3);
      lctx.fillRect(q.x + r - 2, y + r, 3, 1); lctx.fillRect(q.x + r, y + r - 2, 1, 3);
    }
  }
  // Spitters' globs, arcing from the spitter to the Button
  function drawShotsInFlight() {
    const sh = G.R.shots;
    if (!sh || !sh.length) return;
    const b = btnPos();
    for (const x of sh) {
      const q = mobPos({ id: x.m, a: x.a, p: x.p }), k = clamp(1 - x.t / 0.5, 0, 1);
      const px = Math.round(q.x + (b.x - q.x) * k), py = Math.round(q.y - 8 + (b.y - 6 - q.y + 8) * k - Math.sin(k * Math.PI) * 16);
      lctx.fillStyle = '#0c0b12'; lctx.fillRect(px - 2, py - 2, 5, 5);
      lctx.fillStyle = '#b6ff5a'; lctx.fillRect(px - 1, py - 1, 3, 3);
      lctx.fillStyle = '#ffffff'; lctx.fillRect(px - 1, py - 1, 1, 1);
      if (Math.random() < 0.4) part(px, py, '#8ad83a', { vx: rand(-6, 6), vy: rand(-4, 4), grav: 30, life: 0.25 });
    }
  }
  function drawGuardian(m, spr, v, q) {
    const sc = 2;
    shadow(q.x, q.y - 1, Math.round(spr.width * sc * 0.7));
    glow(q.x, q.y - spr.height * sc / 2, Math.round(spr.width * sc / 2.5), '#ff3b5c', 0.18 + 0.07 * Math.sin(time * 5));
    let x = q.x;
    if (v.hit > 0) x += Math.round(rand(-1, 1));
    blit(spr, x, q.y, sc);
    if (v.hit > 0) { blit(white(spr), x, q.y, sc, Math.min(0.6, v.hit * 8)); v.hit -= fdt; }
    if (Math.random() < 0.4) part(q.x + rand(-10, 10), q.y - rand(0, spr.height * sc), pick(['#b36bff', '#ff3b5c']), { vx: 0, vy: -20, grav: 0, life: 0.5 });
  }
  function drawHero(hp) {
    const h = G.S.hero;
    if (!h || !h.cls) return;
    if (h.wdown > 0) { drawDowned({ cls: h.cls, eq: h.eq, down: h.wdown }, hp); return; }
    if (hero.hurt > 0) hero.hurt -= fdt;
    if (hero.heal > 0) { glow(hp.x, hp.y - 8, 9, '#8ae07a', hero.heal * 2); hero.heal -= fdt; }
    const w = h.eq.weapon, wt = w ? G.ITEM_TYPE[w.id] : null;
    if (w && w.r >= 3) glow(hp.x, hp.y - 6, 10, G.RARITIES[w.r].color, 0.16 + 0.06 * Math.sin(time * 4));
    if (G.R.hb && G.R.hb.wing > 0) glow(hp.x, hp.y - 12, 12, '#ffffff', 0.25);
    shadow(hp.x, hp.y - 1, 14);
    let pose = 'rest', ang = G.Doll.restAngle(wt), draw = 0;
    const a = hero.atk;
    if (a) {
      const k = a.t / a.dur;
      if (a.kind === 'swing') {
        if (k < 0.25) { pose = 'up'; ang = -2.4; }
        else if (k < 0.6) { pose = 'fwd'; ang = G.lerp(-2.4, 0.8, (k - 0.25) / 0.35); }
        else ang = G.lerp(0.8, ang, (k - 0.6) / 0.4);
      } else if (a.kind === 'stab') {
        if (k < 0.35) ang = -0.3; else if (k < 0.8) { pose = 'fwd'; ang = 0; }
      } else if (a.kind === 'shot') { pose = 'fwd'; draw = k < 0.5 ? k / 0.5 : 0; }
      else if (a.kind === 'cast') {
        if (k < 0.4) { pose = 'up'; ang = -1.9; } else if (k < 0.85) { pose = 'fwd'; ang = -0.55; }
      }
    }
    if (hero.cast > 0) { pose = 'up'; ang = -1.7; }
    const legs = hero.moving ? Math.floor(hero.walk * 11) % 4 : 0;
    const bob = hero.moving || a ? 0 : Math.floor(time * 1.6) % 2;
    const lunge = a && a.kind !== 'shot' && pose === 'fwd' ? hero.face : 0;
    const r = G.Doll.draw(lctx, h, hp.x + lunge, hp.y, { face: hero.face, legs, pose, bob, ang, draw, time });
    hero.hand = { x: r.hx, y: r.hy }; hero.top = r.top;
    // a crescent smear behind the blade, and a flash ahead of a stab
    if (a && w) {
      const k = a.t / a.dur, col = G.WEAPONS[wt].col;
      if (a.kind === 'swing' && k >= 0.25 && k < 0.8) {
        const cur = k < 0.6 ? ang : 0.8, from = Math.max(-2.4, cur - 2.2);
        lctx.fillStyle = col;
        for (let t = from; t <= cur; t += 0.1) {
          lctx.globalAlpha = 0.25 + 0.6 * (t - from) / Math.max(0.01, cur - from);
          for (const rr of [9, 11]) lctx.fillRect(Math.round(r.hx + hero.face * Math.cos(t) * rr), Math.round(r.hy + Math.sin(t) * rr), 1, 1);
        }
        lctx.globalAlpha = 1;
      } else if (a.kind === 'stab' && k >= 0.35 && k < 0.8) {
        lctx.fillStyle = '#ffffff';
        for (let j = 10; j < 15; j++) { lctx.globalAlpha = 1 - (j - 10) / 5; lctx.fillRect(Math.round(r.hx + hero.face * j), Math.round(r.hy), 1, 1); }
        lctx.globalAlpha = 1;
      }
    }
    if (a && a.kind === 'cast' && !a.flash && a.t / a.dur >= 0.4 && w) {
      a.flash = true;
      const tp = G.Doll.tip(w, r.hx, r.hy, hero.face, -0.55);
      burst(tp.x, tp.y, [G.WEAPONS[wt].col, '#ffffff'], 7, 45, { grav: 0, life: 0.25 });
      ring(tp.x, tp.y, 5, 4, G.WEAPONS[wt].col, 0.18);
    }
    if (hero.moving && Math.random() < 0.3) part(hp.x + rand(-3, 3), hp.y, pick(['#c8b89a', '#8a7a60']), { vx: -hero.face * rand(5, 15), vy: rand(-10, -2), grav: 20, life: 0.3 });
    if (hero.hurt > 0) { lctx.globalAlpha = Math.min(0.6, hero.hurt * 4); lctx.fillStyle = '#ff3b3b'; lctx.fillRect(hp.x - 6, hp.y - 20, 12, 20); lctx.globalAlpha = 1; }
    if (G.D.wardenHp) hpBar(hp.x, hp.y - 26, h.whp / G.D.wardenHp, 16, ROLE_COL[G.ROLES[h.cls]]);
  }
  const MELEE = { dagger: 1, sword: 1, katana: 1, scythe: 1 };
  // The Warden's hits on a boss add up into floating numbers a few times a second
  const bossDmg = { acc: 0, t: 0, crit: false };
  function onHeroAttack(ev) {
    const h = G.S.hero;
    if (!h || !h.cls) return;
    if (ev.boss) { bossDmg.acc += ev.dmg * (G.D.bossMult || 1); bossDmg.crit = bossDmg.crit || ev.crit; }
    const D = G.D, wt = D.hero ? D.hero.wtype : 'dagger';
    const col = G.WEAPONS[wt].col;
    const find = id => { const m = G.R.mobs.find(q => q.id === id); return m ? Object.assign(mobPos(m), { m }) : null; };
    const pts = ev.boss ? [Object.assign({}, bossPos(), { y: bossPos().y - 12 })] : (ev.ids || []).map(find).filter(Boolean);
    if (!pts.length) return;
    for (const id of ev.splash || []) mobVisOf({ id }).hit = 0.07;
    // The Hand: a click calls lightning down from above the screen
    if (ev.src === 'click') {
      if (ev.boss) { bossHitT = 0.07; return; }
      const t = pts[0], ty = t.y - 6;
      if (t.m) mobVisOf(t.m).hit = 0.1;
      const x0 = t.x + rand(-12, 12), path = [[x0, -4]];
      for (let i = 1; i < 6; i++) path.push([x0 + (t.x - x0) * i / 6 + rand(-4, 4), -4 + (ty + 4) * i / 6]);
      path.push([t.x, ty]);
      bolts.push({ pts: path, life: 0.16, cols: ['#ffffff', '#ffe27a'], wide: true });
      glow(t.x, ty, 5, '#ffffff', 0.5);
      if (Math.random() < 0.5) decal(t.x, t.y, '#2a2418', 2);
      const r = aoePx(G.TUNE.smiteR);
      ring(t.x, t.y - 3, r.rx, r.ry, '#ffe27a', 0.22);
      burst(t.x, ty, ['#ffffff', '#ffe27a'], 5, 60, { life: 0.3 });
      if (ev.crit) text(t.x, ty - 8, G.t('crit'), '#ff7a2e', 3, { vy: -20, life: 0.6, max: 0.6 });
      return;
    }
    const hp = heroPos();
    const src = hero.hand ? { x: hero.hand.x, y: hero.hand.y - 1 } : { x: hp.x + hero.face * 9, y: hp.y - 12 };
    if (ev.src === 'pet') {
      if (shots.length > 90) return;
      const t = pts[0], pp = petPos(Math.floor(Math.random() * Math.max(1, G.S.active.length)));
      if (G.S.active.length) shots.push({ x: pp.x, y: pp.y, sx: pp.x, sy: pp.y, tx: t.x, ty: t.y - 6, t: 0, dur: 0.22, col: '#fff3a0' });
      return;
    }
    hero.face = pts[0].x >= hp.x ? 1 : -1;
    const kind = ATTACK[wt] || ATTACK.dagger;
    if (!hero.atk || hero.atk.t > hero.atk.dur * 0.5) hero.atk = { kind: kind[0], t: 0, dur: kind[1] };
    if (!ev.boss) { hero.tgt = { x: pts[0].x, y: pts[0].y }; hero.tgtT = 0; }
    if (shots.length > 110) return;
    const melee = MELEE[wt];
    const area = ev.aoe ? aoePx(ev.aoe) : null;
    pts.forEach((t, i) => {
      const ty = t.y - 7;
      if (t.m) mobVisOf(t.m).hit = 0.08;
      const dur = melee ? 0.1 : wt === 'bow' ? 0.16 : 0.22;
      if (!melee) shots.push({ x: src.x, y: src.y, sx: src.x, sy: src.y, tx: t.x, ty, t: 0, dur, col: ev.crit ? '#ff7a2e' : col, flat: wt === 'bow', big: wt === 'staff' || ev.crit, arrow: wt === 'bow', boom: area && !ev.boss ? { x: t.x, y: t.y - 3, rx: area.rx, ry: area.ry, col } : null });
      else if (ev.boss) shots.push({ x: src.x, y: src.y, sx: src.x, sy: src.y, tx: t.x, ty, t: 0, dur, col: ev.crit ? '#ff7a2e' : col, flat: true, key: true });
      if (wt === 'staff') shots.push({ x: src.x, y: src.y + 2, sx: src.x, sy: src.y + 2, tx: t.x, ty: ty + 3, t: 0, dur: dur * 1.1, col, flat: false });
      if (melee && !ev.boss) { // a crescent sweep through the pack
        const a = Math.atan2(t.y - hp.y, t.x - hp.x);
        ring(t.x, t.y - 4, area ? area.rx : 8, area ? area.ry : 5, ev.crit ? '#ff7a2e' : col, 0.14, [a - 1.2, a + 1.2]);
      } else if (melee) {
        for (let j = 0; j < 5; j++) { const a = -1 + j * 0.5; part(t.x + Math.cos(a) * 6 * hero.face, ty + Math.sin(a) * 6, col, { vx: 0, vy: 0, grav: 0, life: 0.14 }); }
      }
      if (ev.crit && i === 0) text(t.x, ty - 8, G.t('crit'), '#ff7a2e', 3, { vy: -20, life: 0.6, max: 0.6 });
    });
  }

  // ---------- Horde FX: the crunch ----------
  // Every death breaks the sprite itself into chunks that fly, bounce and
  // settle, and leaves a stain. Each land dies its own way.
  const GORE = {
    shore:     { blood: '#d8642a', style: 'splat' },
    meadow:    { blood: '#8e1f1f', style: 'splat' },
    forest:    { blood: '#7a2596', style: 'spores' },
    highlands: { blood: '#55555f', style: 'shatter' },
    tundra:    { blood: '#6fb4f0', style: 'shatter' },
    godlands:  { blood: '#5f2aa8', style: 'splat' },
    abyss:     { blood: '#e0541c', style: 'embers' },
    void:      { blood: '#2e1c52', style: 'dissolve' },
    library:   { blood: '#1f3a6a', style: 'ink' },
    foundry:   { blood: '#3a3028', style: 'sparks' },
    ember:     { blood: '#1e1210', style: 'embers' },
    mirror:    { blood: '#9aa2bc', style: 'glass' },
    sky:       { blood: '#c8b070', style: 'feathers' },
    moon:      { blood: '#9aa2bc', style: 'glass' },
    cosmos:    { blood: '#3a2a6a', style: 'dissolve' },
  };
  const chunkCache = new WeakMap();
  // 2x2 blocks of a sprite's opaque pixels, sampled once per sprite
  function chunks(c) {
    let out = chunkCache.get(c);
    if (out) return out;
    out = [];
    try {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) {
        let col = null, n = 0;
        for (let k = 0; k < 4; k++) {
          const px = x + (k & 1), py = y + (k >> 1);
          if (px >= c.width || py >= c.height) continue;
          const i = (py * c.width + px) * 4;
          if (d[i + 3] < 128) continue;
          n++;
          const hex = '#' + ((1 << 24) | (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]).toString(16).slice(1);
          if (!col || col === '#0c0b12') col = hex;
        }
        if (n >= 2 && col !== '#0c0b12' && col !== '#1a1a22') out.push({ x, y, col });
      }
    } catch (e) { /* canvas unreadable: deaths fall back to plain particles */ }
    chunkCache.set(c, out);
    return out;
  }
  function gib(o) {
    if (gibs.length >= MAXG) gibs.splice(0, 40);
    o.max = o.life;
    gibs.push(o);
  }
  // Break a sprite drawn at (x, y) (bottom-centre anchor, scale sc) into flying chunks
  function explodeSprite(c, x, y, sc, n, force, style) {
    const ch = chunks(c);
    if (!ch.length) { burst(x, y - 6, '#ffffff', 10, 60 * force); return; }
    const b = btnPos();
    let dx = x - b.x, dy = y - b.y;
    const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
    const w = c.width * sc, h = c.height * sc;
    for (let i = 0; i < n; i++) {
      const k = ch[Math.floor(Math.random() * ch.length)];
      const ox = k.x * sc - w / 2, oy = k.y * sc - h;
      gib({
        x: x + ox, y: y + oy, col: k.col, s: style === 'shatter' ? Math.max(1, sc) : 2 * sc,
        vx: (ox * rand(3, 8) / sc + dx * rand(20, 70)) * force, vy: (-rand(45, 120) + dy * rand(0, 30)) * force,
        floor: y + rand(-2, 4), b: 0, life: rand(0.9, 1.9), style,
      });
    }
  }
  // Blood soaks into the ground: splats are painted once onto a layer over the
  // ground that slowly fades, so a slaughter leaves the arena stained
  let stain = null, stainCtx = null, stainFade = 0, stainSweep = 0;
  function stainLayer() {
    if (!stain || stain.width !== W || stain.height !== H) { stain = SPR.makeCanvas(W, H); stainCtx = stain.getContext('2d'); }
    return stainCtx;
  }
  St.clearStain = () => { if (stainCtx) stainCtx.clearRect(0, 0, W, H); };
  function decal(x, y, col, r) {
    const c = stainLayer();
    const n = Math.round(r * 4);
    x = Math.round(x); y = Math.round(y);
    c.globalAlpha = 0.5; c.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, d = Math.pow(Math.random(), 1.6) * r;
      c.fillRect(x + Math.round(Math.cos(a) * d), y + Math.round(Math.sin(a) * d * 0.5), 1, 1);
    }
    for (let i = 0; i < 2; i++) { const a = Math.random() * 6.28; c.fillRect(x + Math.round(Math.cos(a) * r * 1.6), y + Math.round(Math.sin(a) * r * 0.8), 1, 1); }
    c.globalAlpha = 1;
  }
  function ring(x, y, rx, ry, col, life, arc) {
    if (rings.length > 40) rings.shift();
    rings.push({ x, y, rx, ry, col, life, max: life, arc });
  }
  // Splash radius in arena units -> pixels (the arena is squashed vertically)
  const aoePx = a => ({ rx: a * W * 0.62, ry: a * W * 0.62 * 0.55 });

  const streak = { n: 0, t: 9, pop: 0 };
  let multiCd = 0, lastCount = 0;
  const STREAKS = [[50, 'sk_25'], [100, 'sk_50'], [200, 'sk_100'], [400, 'sk_200'], [800, 'sk_400'], [1500, 'sk_800'], [3000, 'sk_3000'], [6000, 'sk_6000'], [10000, 'sk_10000']];
  function gore(m, gold, chest, src) {
    const q = mobPos(m);
    mobVis.delete(m.id);
    const realm = G.REALMS[G.realmIndex(G.depthNow ? G.depthNow() : G.S.depth)];
    const g = GORE[realm.id] || GORE.meadow;
    const spr = mobSprite(m, realm);
    const fod = !!G.SMALL[m.kind];
    if (m.kind === 'guardian') { explodeSprite(spr, q.x, q.y, 2, 120, 1.8, g.style); decal(q.x, q.y, g.blood, 14); St.shake(7); hitstop = Math.max(hitstop, 0.2); slowmo = Math.max(slowmo, 0.8); }
    const over = Math.min(3, m.over || 0) + (m.crit ? 1 : 0) + (src === 'boss' ? 1.5 : 0);
    const force = 1 + over * 0.3 + (src === 'click' ? 0.35 : 0);
    const fod2 = G.SMALL[m.kind];
    // when the Horde dies in heaps, each body throws fewer chunks so the frame keeps up
    const n = fod2 ? (frameKills > 25 || gibs.length > MAXG * 0.7 ? 2 : 5) : m.kind === 'brute' || m.kind === 'bomber' || m.kind === 'spitter' ? 16 : m.kind === 'tank' ? 36 : 30;
    explodeSprite(spr, q.x, q.y, 1, n, force, g.style);
    decal(q.x, q.y - 1, g.blood, fod ? 2.5 : 4 + Math.min(4, m.w));
    // every land breaks differently
    const c = q.x, y = q.y - 5;
    if (g.style === 'shatter') burst(c, y, ['#ffffff', '#d8f0ff'], fod ? 3 : 8, 90, { grav: 200, life: 0.35 });
    else if (g.style === 'embers') for (let i = 0; i < (fod ? 3 : 8); i++) part(c + rand(-4, 4), y, pick(['#ffb347', '#ff6a2e', '#ffd84a']), { vx: rand(-15, 15), vy: rand(-50, -20), grav: -30, life: rand(0.5, 1.1) });
    else if (g.style === 'spores') for (let i = 0; i < (fod ? 3 : 7); i++) part(c + rand(-5, 5), y, pick(['#c84ae8', '#ff7ab0', '#f4ecd8']), { vx: rand(-10, 10), vy: rand(-25, -8), grav: -8, life: rand(0.8, 1.5) });
    else if (g.style === 'ink') for (let i = 0; i < (fod ? 2 : 7); i++) part(c + rand(-4, 4), y, pick(['#1f3a6a', '#2a4a8a', '#f4ecd8']), { vx: rand(-25, 25), vy: rand(-40, -10), grav: 160, life: rand(0.4, 0.8) });
    else if (g.style === 'sparks') for (let i = 0; i < (fod ? 3 : 9); i++) part(c, y, pick(['#ffd84a', '#ff7a2e', '#ffffff']), { vx: rand(-70, 70), vy: rand(-80, -20), grav: 260, life: rand(0.2, 0.5) });
    else if (g.style === 'feathers') for (let i = 0; i < (fod ? 2 : 6); i++) part(c + rand(-5, 5), y, pick(['#ffffff', '#fff3d0', '#ffd84a']), { vx: rand(-12, 12), vy: rand(-18, -4), grav: 12, life: rand(0.9, 1.6) });
    else if (g.style === 'glass') { burst(c, y, ['#ffffff', '#d8e6ff', '#ff7ae6'], fod ? 3 : 9, 100, { grav: 240, life: 0.4 }); }
    else if (g.style === 'dissolve') for (let i = 0; i < (fod ? 4 : 10); i++) part(c + rand(-5, 5), y + rand(-4, 4), pick(['#6b3fc0', '#7fe9ff', '#e0d0ff']), { vx: 0, vy: rand(-30, -10), grav: 0, life: rand(0.4, 0.9) });
    else burst(c, y, g.blood, fod ? 3 : 7, 70, { grav: 220, life: 0.45 });
    if (over >= 1.5 && !fod) ring(c, q.y - 3, 10, 5, '#ffffff', 0.18);
    frameKills++;
    if (fod && gold) { killGold += gold; if (killGoldT <= 0) killGoldT = 0.3; }
    if (m.kind === 'brute') { hitstop = Math.max(hitstop, 0.02); St.shake(1); ring(c, q.y - 3, 10, 5, '#ffffff', 0.15); }
    if (m.kind === 'tank') { hitstop = Math.max(hitstop, 0.05); St.shake(3); ring(c, q.y - 3, 20, 10, '#ffffff', 0.3); burst(c, y, ['#c8c8d4', '#ffffff'], 12, 90, { grav: 240, life: 0.4 }); }
    if (m.kind === 'magic') { hitstop = Math.max(hitstop, 0.035); St.shake(2); ring(c, q.y - 3, 16, 8, '#5a9cff', 0.3); }
    if (m.kind === 'rare') {
      hitstop = Math.max(hitstop, 0.09); St.shake(5); St.flash(0.18, '#ffd84a');
      ring(c, q.y - 3, 28, 15, '#ffd84a', 0.45); ring(c, q.y - 3, 16, 9, '#ffffff', 0.3);
      text(c, q.y - 26, G.t('slain', m.name), '#ffd84a', 4, { life: 1.6, max: 1.6, vy: -12 });
      beams.push({ x: c, y: q.y, col: '#ffd84a', life: 1, max: 1, w: 5 });
    }
    // XP crystals: blue for the small fry, green for brutes, red for champions and rares
    const ng = m.kind === 'rare' ? 6 : m.kind === 'magic' ? 3 : m.kind === 'tank' ? 3 : !fod ? 1 : Math.random() < 0.18 ? 1 : 0;
    const gc = fod ? '#6fb4ff' : m.kind === 'magic' || m.kind === 'rare' ? '#ff5a7a' : '#56d45a';
    for (let i = 0; i < ng && gems.length < 260; i++) gems.push({ x: c + rand(-3, 3), y: q.y - 4, vx: rand(-30, 30), vy: rand(-70, -30), floor: q.y + rand(-2, 3), t: rand(0.3, 0.6), fly: 0, col: gc, big: m.kind !== 'fodder' });
    const nc = m.kind === 'rare' ? 10 : m.kind === 'magic' ? 4 : m.kind === 'tank' ? 5 : !fod ? 2 : Math.random() < 0.04 ? 1 : 0;
    for (let i = 0; i < nc && coins.length < 220; i++) coins.push({ x: c, y: q.y - 6, vx: rand(-40, 40), vy: rand(-90, -40), floor: q.y + rand(-2, 3), t: rand(0.45, 0.8), fly: 0 });
    if (gold && !fod && !m.add && m.kind !== 'bomber') text(c, q.y - 16, '+' + G.fmt(gold), m.kind === 'brute' ? '#e8d890' : '#ffd84a', m.kind === 'brute' ? 3 : 4, { life: 0.8, max: 0.8 });
    // kill streak
    streak.n = G.carnage ? Math.max(G.R.carn, 0) : streak.n + 1; streak.t = 0; streak.pop = 0.15;
    const sk = streak.n !== streak.last && STREAKS.find(s => s[0] === streak.n);
    streak.last = streak.n;
    if (sk) {
      for (let i = texts.length - 1; i >= 0; i--) if (texts[i].callout) texts.splice(i, 1);
      cardText(0, G.t(sk[1]), streak.n >= 3000 ? '#ff4fe0' : streak.n >= 400 ? '#ff4f7e' : '#ffe27a', streak.n >= 200 ? 8 : 7, { life: 1.8, max: 1.8, vy: -5, big: true, callout: true });
      St.shake(2 + Math.log2(streak.n / 50));
      if (G.Audio && G.Audio.streak) G.Audio.streak(streak.n);
    }
  }
  function drawDecals(dt) {
    if (!stain) return;
    // fade the whole layer a little, twice a second (about 20s to vanish)
    if ((stainFade += dt) >= 0.5) {
      stainFade = 0;
      // an 8-bit alpha stops fading at about 3%: every 20s wipe what's left that faint
      if ((stainSweep += 1) >= 40) {
        stainSweep = 0;
        try { const img = stainCtx.getImageData(0, 0, W, H), a = img.data; for (let i = 3; i < a.length; i += 4) if (a[i] < 14) a[i] = 0; stainCtx.putImageData(img, 0, 0); } catch (e) { /* unreadable canvas: leave it */ }
      }
      stainCtx.globalCompositeOperation = 'destination-out';
      stainCtx.globalAlpha = 0.06; stainCtx.fillStyle = '#000'; stainCtx.fillRect(0, 0, W, H);
      stainCtx.globalCompositeOperation = 'source-over'; stainCtx.globalAlpha = 1;
    }
    lctx.drawImage(stain, 0, 0);
  }
  function stepGibs(dt) {
    for (let i = gibs.length - 1; i >= 0; i--) {
      const g = gibs[i]; g.life -= dt;
      if (g.life <= 0) { gibs.splice(i, 1); continue; }
      if (g.rest) continue;
      if (g.style === 'dissolve') { g.vy -= 40 * dt; g.vx *= 0.96; g.x += g.vx * dt; g.y += g.vy * dt; continue; }
      g.vy += 320 * dt; g.x += g.vx * dt; g.y += g.vy * dt;
      if (g.y >= g.floor && g.vy > 0) {
        g.y = g.floor; g.vy *= -0.32; g.vx *= 0.5; g.b++;
        if (g.b >= 2 || Math.abs(g.vy) < 18) { g.rest = true; g.life = Math.min(g.life, rand(0.5, 1.4)); }
      }
    }
  }
  function drawGibs(resting) {
    for (const g of gibs) {
      if (!!g.rest !== resting) continue;
      lctx.globalAlpha = Math.min(1, g.life / 0.4);
      lctx.fillStyle = g.col;
      lctx.fillRect(Math.round(g.x), Math.round(g.y), g.s, g.s);
    }
    lctx.globalAlpha = 1;
  }
  // Coins bounce out of the dead and then get pulled into the Button
  function stepCoins(dt) {
    const b = btnPos();
    for (let i = coins.length - 1; i >= 0; i--) {
      const k = coins[i];
      if (k.t > 0) {
        k.t -= dt;
        k.vy += 300 * dt; k.x += k.vx * dt; k.y += k.vy * dt;
        if (k.y >= k.floor && k.vy > 0) { k.y = k.floor; k.vy *= -0.4; k.vx *= 0.6; }
      } else {
        k.fly += dt;
        const dx = b.x - k.x, dy = b.y - 6 - k.y, d = Math.hypot(dx, dy);
        const sp = 60 + k.fly * 520;
        if (d < 4) { coins.splice(i, 1); part(b.x + rand(-6, 6), b.y - 6, '#fff3a0', { vx: rand(-20, 20), vy: rand(-30, -10), grav: 0, life: 0.25 }); if (G.Audio && G.Audio.coin && Math.random() < 0.3) G.Audio.coin(); continue; }
        k.x += dx / d * Math.min(d, sp * dt); k.y += dy / d * Math.min(d, sp * dt);
      }
      lctx.fillStyle = '#c98f10'; lctx.fillRect(Math.round(k.x) - 1, Math.round(k.y), 3, 1);
      lctx.fillStyle = '#ffd84a'; lctx.fillRect(Math.round(k.x) - 1, Math.round(k.y) - 2, 3, 2);
      lctx.fillStyle = '#fff3a0'; lctx.fillRect(Math.round(k.x) - 1, Math.round(k.y) - 2, 1, 1);
    }
  }
  // XP crystals bounce out and get pulled into the Warden
  function stepGems(dt) {
    const hp = heroPos(), tx = hp.x, ty = hp.y - 10;
    for (let i = gems.length - 1; i >= 0; i--) {
      const k = gems[i];
      if (k.t > 0) {
        k.t -= dt;
        k.vy += 300 * dt; k.x += k.vx * dt; k.y += k.vy * dt;
        if (k.y >= k.floor && k.vy > 0) { k.y = k.floor; k.vy *= -0.4; k.vx *= 0.6; }
      } else {
        k.fly += dt;
        const dx = tx - k.x, dy = ty - k.y, d = Math.hypot(dx, dy), sp = 70 + k.fly * 600;
        if (d < 4) { gems.splice(i, 1); part(tx + rand(-4, 4), ty + rand(-4, 4), k.col, { vx: 0, vy: -15, grav: 0, life: 0.25 }); if (G.Audio && G.Audio.gem) G.Audio.gem(); continue; }
        k.x += dx / d * Math.min(d, sp * dt); k.y += dy / d * Math.min(d, sp * dt);
      }
      const x = Math.round(k.x), y = Math.round(k.y);
      lctx.fillStyle = '#0c0b12'; lctx.fillRect(x - 1, y - 2, 3, 5); lctx.fillRect(x - 2, y - 1, 5, 3);
      lctx.fillStyle = k.col; lctx.fillRect(x, y - 1, 1, 3); lctx.fillRect(x - 1, y, 3, 1);
      lctx.fillStyle = '#ffffff'; lctx.fillRect(x, y - 1, 1, 1);
    }
  }
  // Perks that live around the Button: Holy Ground and the Orbiting Blades
  function drawPerkFx() {
    const P = G.S.hero && G.S.hero.perks;
    if (!P) return;
    const b = btnPos();
    if (P.aura) {
      const sanct = P.evo_sanctuary, r = aoePx(sanct ? 0.4 : 0.3), pulse = 0.5 + 0.5 * Math.sin(time * 4);
      lctx.globalAlpha = 0.1 + 0.03 * P.aura + 0.04 * pulse;
      lctx.fillStyle = '#ffe27a';
      for (let dy = -Math.round(r.ry); dy <= r.ry; dy++) { const w = Math.round(r.rx * Math.sqrt(Math.max(0, 1 - (dy / r.ry) * (dy / r.ry)))); lctx.fillRect(b.x - w, b.y - 2 + dy, w * 2, 1); }
      lctx.globalAlpha = 0.85;
      const n = 56;
      for (let j = 0; j < n; j++) { if ((j + Math.floor(time * 8)) % 3) continue; const a = j / n * Math.PI * 2; lctx.fillRect(Math.round(b.x + Math.cos(a) * r.rx), Math.round(b.y - 2 + Math.sin(a) * r.ry), 1, 1); }
      lctx.globalAlpha = 1;
    }
    if (P.blades) {
      const n = G.bladeCount(), r = aoePx(P.evo_bladestorm ? 0.3 : 0.24), spr = SPR.get(P.evo_bladestorm ? 'it_eternity_blade' : 'ic_sword');
      for (let i = 0; i < n; i++) {
        const a = time * (P.evo_bladestorm ? 3.4 : 2.6) + i * Math.PI * 2 / n;
        const x = b.x + Math.cos(a) * r.rx, y = b.y - 6 + Math.sin(a) * r.ry;
        lctx.save(); lctx.translate(Math.round(x), Math.round(y)); lctx.rotate(Math.round((a + Math.PI * 0.75) / (Math.PI / 4)) * (Math.PI / 4));
        lctx.drawImage(spr, -5, -5); lctx.restore();
      }
    }
  }
  // quick light blooms (bomb blasts)
  function drawGlowFx(dt) {
    for (let i = glowFx.length - 1; i >= 0; i--) {
      const g = glowFx[i];
      if ((g.t -= dt) <= 0) { glowFx.splice(i, 1); continue; }
      glow(g.x, g.y, Math.max(2, Math.round(g.r * (1.2 - g.t / g.T * 0.4))), g.col, 0.5 * g.t / g.T);
    }
    if (glowFx.length > 30) glowFx.splice(0, glowFx.length - 30);
  }
  function drawRings(dt) {
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]; r.life -= dt;
      if (r.life <= 0) { rings.splice(i, 1); continue; }
      const k = 1 - r.life / r.max, e = 1 - (1 - k) * (1 - k);
      const rx = r.rx * (0.35 + 0.65 * e), ry = r.ry * (0.35 + 0.65 * e);
      lctx.globalAlpha = 0.85 * (1 - k);
      lctx.fillStyle = r.col;
      const n = Math.max(16, Math.round(rx * 1.6));
      const a0 = r.arc ? r.arc[0] : 0, a1 = r.arc ? r.arc[1] : Math.PI * 2;
      for (let j = 0; j <= n; j++) {
        const a = a0 + (a1 - a0) * j / n;
        lctx.fillRect(Math.round(r.x + Math.cos(a) * rx), Math.round(r.y + Math.sin(a) * ry), 1, 1);
      }
    }
    lctx.globalAlpha = 1;
  }

  // ---------- Drawing helpers ----------
  function shadow(x, y, w) {
    lctx.fillStyle = 'rgba(0,0,0,0.28)';
    lctx.fillRect(Math.round(x - w / 2), Math.round(y), w, 2);
    lctx.fillRect(Math.round(x - w / 2 + 1), Math.round(y - 1), w - 2, 1);
  }
  function blit(c, x, y, sc, alpha) {
    sc = sc || 1;
    if (alpha !== undefined) lctx.globalAlpha = alpha;
    lctx.drawImage(c, Math.round(x - c.width * sc / 2), Math.round(y - c.height * sc), c.width * sc, c.height * sc);
    if (alpha !== undefined) lctx.globalAlpha = 1;
  }
  const whiteCache = new WeakMap();
  function white(c) {
    let w = whiteCache.get(c);
    if (w) return w;
    w = SPR.makeCanvas(c.width, c.height);
    const x = w.getContext('2d');
    x.drawImage(c, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height);
    whiteCache.set(c, w);
    return w;
  }
  function glow(x, y, r, col, a) {
    lctx.globalAlpha = a;
    lctx.fillStyle = col;
    for (let dy = -r; dy <= r; dy++) {
      const w = Math.round(Math.sqrt(r * r - dy * dy) * 1.6);
      lctx.fillRect(Math.round(x - w), Math.round(y + dy * 0.5), w * 2, 1);
    }
    lctx.globalAlpha = 1;
  }

  // ---------- Loot on the ground, events and Rifts (js/world.js) ----------
  // Label plates by value, loot-filter style: they say what fell before you
  // pick it up. Index = rarity; uniques and orbs have their own looks.
  // sz: 2 small, 3 medium, 5 large (the font snaps to 8/16/24 device px)
  const LSTYLE = [
    { fg: '#c7b299', sz: 2, dim: true },
    { fg: '#63d85b', bg: 'rgba(6,14,6,0.82)', sz: 2 },
    { fg: '#9ccfff', bg: 'rgba(4,10,26,0.9)', bd: '#4fa8ff', sz: 2 },
    { fg: '#f2e2ff', bg: '#4a1f80', bd: '#b36bff', sz: 3, beam: '#b36bff', temp: true },
    { fg: '#1a0c00', bg: '#ffa033', bd: '#fff0c0', sz: 3, beam: '#ffa033' },
    { fg: '#ffffff', bg: '#d8264e', bd: '#ffffff', sz: 3, beam: '#ff4f7e' },
    { fg: '#e01010', bg: '#ffffff', bd: '#e01010', sz: 5, beam: '#ffffff', halo: '#ff2020' },
  ];
  const USTYLE = { fg: '#ffffff', bg: '#af6025', bd: '#ffd28a', sz: 3, beam: '#e8903a' };
  const OSTYLE = {
    whet:   { fg: '#dfe8f6', bg: 'rgba(10,12,22,0.88)', bd: '#8898b8', sz: 2 },
    flux:   { fg: '#1a1200', bg: '#f2c21a', bd: '#fff3a0', sz: 2 },
    ruin:   { fg: '#ffffff', bg: '#9a1414', bd: '#ff6a5a', sz: 3, beam: '#ff3b3b', temp: true },
    ascent: { fg: '#1a1000', bg: '#ffe0a0', bd: '#ffffff', sz: 3, beam: '#ffe0a0' },
    grace:  { fg: '#e01010', bg: '#ffffff', bd: '#e01010', sz: 5, beam: '#ffffff', halo: '#ff2020' },
  };
  const lstyle = e => e.k === 'uq' ? USTYLE : e.k === 'orb' ? OSTYLE[e.orb] : LSTYLE[e.r];
  const lname = e => e.k === 'uq' ? G.UNIQUES[e.q].name : e.k === 'orb' ? G.ORBS[e.orb].name : G.L(e.it.name);
  const lspr = e => e.k === 'uq' ? 'u_' + e.q : e.k === 'orb' ? 'orb_' + e.orb : 'it_' + e.it.id;
  // how loud a drop is: 0 (junk) .. 8 (top tier)
  const loud = e => e.k === 'uq' ? 7 : e.k === 'orb' ? { whet: 1, flux: 2, ruin: 4, ascent: 5, grace: 8 }[e.orb] : e.r >= 6 ? 8 : e.r;
  St.lootStyle = e => lstyle(e);
  // arena position (a, p) -> stage pixels, on the same paths the mobs walk
  function arenaXY(a, p, j) {
    const b = btnPos();
    const ang = -Math.PI / 2 + 0.55 + a * (Math.PI * 2 - 1.1);
    const sx = b.x + Math.cos(ang) * W * 0.6, sy = b.y + Math.sin(ang) * H * 0.56;
    const ex = b.x + Math.cos(ang) * (21 + (j || 0) * 10), ey = b.y + Math.sin(ang) * (11 + (j || 0) * 6) + 4;
    return { x: sx + (ex - sx) * p, y: sy + (ey - sy) * p };
  }
  const gvis = new Map();
  let labels = [], hoverLoot = null, lootPitch = 0, lootPitchT = 0;
  function onDrop(e, m) {
    const j = ((e.id * 37) % 19) / 19;
    const q = arenaXY(e.a, Math.min(0.9, e.p), j);
    const land = onField(q.x, q.y);
    let s;
    if (m && !m.gone) { const mp = mobPos(m); s = { x: mp.x, y: mp.y - 8 }; }
    else if (e.src === 'boss' || e.src === 'rift') { const b = bossVis ? bossPos() : btnPos(); s = { x: b.x, y: b.y - 16 }; }
    else s = { x: land.x, y: land.y - 30 };
    const L = loud(e);
    gvis.set(e.id, { x: land.x, y: land.y, sx: s.x, sy: s.y, t: -(e.wait || 0), dur: 0.34 + 0.05 * L, pk: 10 + 3 * L, landed: false, up: e.from != null, pop: 0, bob: Math.random() * 6 });
  }
  function onLand(e, v) {
    const st = lstyle(e), L = loud(e);
    v.landed = true; v.pop = 0.18; v.age = 0;
    burst(v.x, v.y - 1, ['#c8b89a', '#8a7a60'], 4, 28, { grav: 60, life: 0.3 });
    if (v.up) { text(v.x, v.y - 18, G.t('upgrade'), st.fg === '#1a0c00' ? '#ffa033' : st.bd || st.fg, 4, { life: 1.1, max: 1.1, vy: -14 }); burst(v.x, v.y - 5, [st.bd || '#ffffff', '#ffffff'], 12, 60); }
    if (st.beam) { v.beam = st.temp ? 1.2 : 1e9; v.bt = 0; }
    if (L >= 4) ring(v.x, v.y - 1, 12 + L * 2, 6 + L, st.beam || st.fg, 0.5);
    if (L >= 5) { St.shake(2 + L * 0.4); hitstop = Math.max(hitstop, 0.03 * (L - 3)); }
    if (L >= 7) { St.flash(0.3, st.beam || '#ffffff'); slowmo = Math.max(slowmo, 0.25); }
    // rising pitch while a shower is coming down
    if (lootPitchT > 0) lootPitch = Math.min(12, lootPitch + 1); else lootPitch = 0;
    lootPitchT = 0.5;
    if (G.Audio && G.Audio.loot) G.Audio.loot(e.k, L, lootPitch);
  }
  function stepGround(dt) {
    if (lootPitchT > 0) lootPitchT -= dt;
    const live = G.R.ground || [];
    if (gvis.size > live.length + 8) { const ids = new Set(live.map(e => e.id)); for (const k of [...gvis.keys()]) if (!ids.has(k)) gvis.delete(k); }
    for (const e of live) {
      let v = gvis.get(e.id);
      if (!v) { onDrop(e, null); v = gvis.get(e.id); v.t = v.dur; }
      if (!v.landed) { v.t += dt; if (v.t >= v.dur) onLand(e, v); }
      else { v.age += dt; if (v.pop > 0) v.pop -= dt; if (v.beam) v.bt += dt; }
    }
  }
  function drawGroundItem(e, v) {
    const spr = SPR.get(lspr(e)) || SPR.get('ic_bag');
    const st = lstyle(e), L = loud(e);
    if (v.t < 0) return;
    if (!v.landed) {
      const k = clamp(v.t / v.dur, 0, 1), ek = 1 - (1 - k) * (1 - k);
      const x = v.sx + (v.x - v.sx) * ek, y = v.sy + (v.y - v.sy) * k - Math.sin(k * Math.PI) * v.pk;
      const flip = Math.floor(v.t * 16) % 2;
      if (flip) { lctx.save(); lctx.translate(Math.round(x), 0); lctx.scale(-1, 1); blit(spr, 0, y); lctx.restore(); } else blit(spr, x, y);
      if (L >= 3 && Math.random() < 0.7) part(x + rand(-2, 2), y - 4, v.up && k < 0.8 ? '#ffffff' : st.beam || st.fg, { vx: 0, vy: 0, grav: 0, life: 0.3 });
      return;
    }
    shadow(v.x, v.y - 1, 8);
    if (L >= 3) glow(v.x, v.y - 3, 5 + Math.min(4, L - 2), st.beam || st.bd || st.fg, 0.18 + 0.07 * Math.sin(time * 5 + e.id));
    const hover = e.k === 'orb' ? Math.round(Math.sin(time * 4 + v.bob) * 1.2) - 1 : 0;
    const sq = v.pop > 0.09 ? 1 : 0;
    blit(spr, v.x, v.y + sq + hover);
    if (hoverLoot === e) { lctx.globalAlpha = 0.35; blit(white(spr), v.x, v.y + hover); lctx.globalAlpha = 1; }
    if (e.k === 'uq' && Math.random() < 0.3) part(v.x + rand(-5, 5), v.y - rand(3, 10), pick(['#ffd28a', '#e8903a', '#ffffff']), { vy: -14, vx: 0, grav: 0, life: 0.6 });
  }
  function drawLootBeams() {
    for (const e of G.R.ground || []) {
      const v = gvis.get(e.id);
      if (!v || !v.beam || !v.landed) continue;
      const st = lstyle(e);
      const left = v.beam - v.bt;
      if (left <= 0) { v.beam = 0; continue; }
      const grow = Math.min(1, v.bt / 0.12), fade = Math.min(1, left / 0.4);
      const top = Math.round(v.y - 2 - (v.y - 2) * grow);
      const w = st.halo ? 9 : loud(e) >= 5 ? 7 : 5;
      const a = (0.2 + 0.08 * Math.sin(time * 5 + e.id)) * fade;
      lctx.globalAlpha = a;
      lctx.fillStyle = st.halo || st.beam;
      lctx.fillRect(Math.round(v.x - w / 2), top, w, Math.round(v.y - 2 - top));
      lctx.globalAlpha = 0.65 * fade;
      lctx.fillStyle = st.beam;
      lctx.fillRect(Math.round(v.x - 1), top, 2, Math.round(v.y - 2 - top));
      lctx.globalAlpha = 1;
      if (Math.random() < 0.1) part(v.x + rand(-w / 2, w / 2), v.y - rand(2, 30), st.beam, { vx: 0, vy: -20, grav: 0, life: 0.6 });
    }
  }
  // Plates on the hi-res layer, stacked so they never overlap
  function drawLabels() {
    labels = [];
    const list = (G.R.ground || []).map(e => ({ e, v: gvis.get(e.id) })).filter(o => o.v && o.v.landed);
    list.sort((a, b) => loud(b.e) - loud(a.e) || a.e.id - b.e.id);
    const filter = G.S.set.filter;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const busy = list.length > 16;
    const free = (x, y, w, h) => !labels.some(r => x < r.x + r.w + 1 && x + w + 1 > r.x && y < r.y + r.h + 1 && y + h + 1 > r.y);
    for (const { e, v } of list) {
      const st = lstyle(e);
      if (st.dim && filter) continue;
      // a crowded floor shows the plates that matter; the rest waits for a hover
      if (busy && loud(e) < 2 && hoverLoot !== e) continue;
      const sz = crisp(st.sz);
      ctx.font = sz + 'px ' + FONT;
      const txt = lname(e);
      const w = Math.ceil(ctx.measureText(txt).width) + 4, h = Math.ceil(sz) + 2;
      const x0 = clamp(Math.round(v.x - w / 2), 1, W - w - 1), y0 = Math.round(v.y - 10 - h);
      // try beside it first, then stack upwards
      let x = x0, y = y0, ok = false;
      const top = 16; // under the HUD strip
      for (let row = 0; row < 8 && !ok; row++) {
        for (const dx of [0, w * 0.55 + 2, -(w * 0.55 + 2)]) {
          const cx = clamp(Math.round(x0 + dx), 1, W - w - 1), cy = y0 - row * (h + 1);
          if (cy >= top && free(cx, cy, w, h)) { x = cx; y = cy; ok = true; break; }
        }
      }
      // no room above (near the top edge): try under the item
      for (let row = 0; row < 6 && !ok; row++) {
        const cy = Math.round(v.y + 2 + row * (h + 1)), cx = x0;
        if (cy + h < H - 2 && free(cx, cy, w, h)) { x = cx; y = cy; ok = true; }
      }
      if (!ok) continue;
      const pop = v.pop > 0 ? 1 + v.pop * 1.5 : 1;
      labels.push({ x, y, w, h, e });
      ctx.save();
      if (pop > 1) { ctx.translate(x + w / 2, y + h / 2); ctx.scale(pop, pop); ctx.translate(-(x + w / 2), -(y + h / 2)); }
      if (st.bg) { ctx.fillStyle = st.bg; ctx.fillRect(x, y, w, h); }
      if (st.bd) { ctx.strokeStyle = st.bd; ctx.lineWidth = hoverLoot === e ? 1 : 0.6; ctx.strokeRect(x + 0.3, y + 0.3, w - 0.6, h - 0.6); }
      if (!st.bg) { ctx.lineWidth = 1; ctx.strokeStyle = '#0c0b12'; ctx.strokeText(txt, x + w / 2, y + h / 2 + 0.3); }
      ctx.fillStyle = st.fg;
      ctx.fillText(txt, x + w / 2, y + h / 2 + 0.3);
      if (hoverLoot === e) { ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x, y, w, h); }
      ctx.restore();
    }
  }
  function hitLoot(p) {
    for (let i = labels.length - 1; i >= 0; i--) { const r = labels[i]; if (p.x >= r.x - 1 && p.x <= r.x + r.w + 1 && p.y >= r.y - 1 && p.y <= r.y + r.h + 1) return r.e; }
    let best = null, bd = 60;
    for (const e of G.R.ground || []) { const v = gvis.get(e.id); if (!v || !v.landed) continue; const d = (p.x - v.x) ** 2 + (p.y - v.y + 4) ** 2; if (d < bd) { bd = d; best = e; } }
    return best;
  }
  function onPickup(e, how, res) {
    if (loud(e) >= 4) St.celebrate = time + 2.5;
    const v = gvis.get(e.id);
    gvis.delete(e.id);
    if (!v || !v.landed) return;
    const tgt = e.k === 'orb' ? btnPos() : heroPos();
    flyers.push({ x: v.x, y: v.y, tx: tgt.x, ty: tgt.y - 8, t: 0, dur: how === 'hand' ? 0.22 : 0.4, spr: lspr(e) });
    const st = lstyle(e);
    if (how === 'hand') burst(v.x, v.y - 4, [st.bd || st.fg, '#ffffff'], 6, 40, { life: 0.3 });
    if (e.k === 'orb' && loud(e) >= 2) text(tgt.x + rand(-10, 10), tgt.y - 24, '+1 ' + G.ORBS[e.orb].name, G.ORBS[e.orb].col, 3, { life: 1, max: 1, vy: -14 });
    if (G.Audio && G.Audio.pick) G.Audio.pick(e.k);
  }
  // Shrines stand on the field until touched (or the Warden claims them)
  function shrinePos() { const s = G.R.shrine; if (!s) return null; const q = arenaXY(s.a, s.p, 0.5); return onField(q.x, q.y); }
  function drawShrine() {
    const s = G.R.shrine, q = shrinePos();
    if (!s || !q) return;
    const col = G.SHRINES[s.k].col;
    glow(q.x, q.y - 6, 9, col, 0.22 + 0.1 * Math.sin(time * 5));
    shadow(q.x, q.y - 1, 12);
    blit(SPR.get('shrine_' + s.k) || SPR.get('ic_star'), q.x, q.y + Math.round(Math.sin(time * 2) * 0.5));
    if (Math.random() < 0.4) part(q.x + rand(-4, 4), q.y - rand(8, 16), col, { vx: 0, vy: -18, grav: 0, life: 0.5 });
    // the ring fills as the Warden walks over to claim it
    const k = clamp(1 - s.t / G.TUNE.shrineLife, 0, 1), n = 24;
    lctx.fillStyle = col;
    for (let j = 0; j < Math.round(n * k); j++) { const a = -Math.PI / 2 + j / n * Math.PI * 2; lctx.fillRect(Math.round(q.x + Math.cos(a) * 9), Math.round(q.y - 2 + Math.sin(a) * 4), 1, 1); }
  }
  function hitShrine(p) { const q = shrinePos(); return q && Math.abs(p.x - q.x) < 9 && Math.abs(p.y - (q.y - 7)) < 11; }
  // The Breach: a purple tear at the edge of the field
  function breachPos() { const b = G.R.breach; if (!b) return null; const q = arenaXY(b.a, 0.08, 0); return onField(q.x, q.y); }
  function drawBreach() {
    const b = G.R.breach, q = breachPos();
    if (!b || !q) return;
    const k = clamp(b.t / b.T, 0, 1), rx = 14 + 4 * Math.sin(time * 3), ry = 7;
    lctx.globalAlpha = 0.35; lctx.fillStyle = '#2a0e4a';
    for (let dy = -ry; dy <= ry; dy++) { const w = Math.round(rx * Math.sqrt(1 - (dy / ry) * (dy / ry))); lctx.fillRect(q.x - w, q.y + dy, w * 2, 1); }
    lctx.globalAlpha = 0.9; lctx.fillStyle = '#b36bff';
    const n = 40;
    for (let j = 0; j < n; j++) { if ((j + Math.floor(time * 12)) % 4 === 0) continue; const a = j / n * Math.PI * 2 + time; lctx.fillRect(Math.round(q.x + Math.cos(a) * rx), Math.round(q.y + Math.sin(a) * ry), 1, 1); }
    lctx.globalAlpha = 1;
    for (let i = 0; i < 2; i++) { const a = Math.random() * 6.28; part(q.x + Math.cos(a) * rx, q.y + Math.sin(a) * ry, pick(['#b36bff', '#e0d0ff', '#6b2fb8']), { vx: -Math.cos(a) * 20, vy: -Math.sin(a) * 10 - 10, grav: 0, life: 0.5 }); }
    // timer under it
    lctx.fillStyle = '#0c0b12'; lctx.fillRect(q.x - 11, q.y + ry + 2, 22, 3);
    lctx.fillStyle = '#b36bff'; lctx.fillRect(q.x - 10, q.y + ry + 3, Math.round(20 * k), 1);
  }
  // Rift: a purple edge on the world (its bar and clock are in the HUD row)
  // An invasion paints the sky: a tint over the field, its moon, planet, sun or eye, and its weather
  function drawInvasionSky(dt) {
    const r = G.R.inv;
    invFade = clamp(invFade + (r ? dt : -dt) * 1.5, 0, 1);
    if (invFade <= 0) return;
    const V = G.INV_BY_ID[(r && r.k) || lastInv] || G.INVASIONS[0];
    if (r) lastInv = r.k;
    lctx.globalAlpha = V.tintA * invFade; lctx.fillStyle = V.tint; lctx.fillRect(0, 0, W, H); lctx.globalAlpha = 1;
    const sky = SPR.defs[V.sky] ? SPR.get(V.sky) : null;
    if (sky) { lctx.globalAlpha = 0.6 * invFade; lctx.drawImage(sky, Math.round(W * 0.8 - sky.width), Math.round(18 + Math.sin(time * 0.5) * 2), sky.width * 2, sky.height * 2); lctx.globalAlpha = 1; }
    if (!r) return;
    if (V.id === 'moon' && Math.random() < 0.5) part(rand(0, W), -2, pick(['#e8f0ff', '#c8d6ff', '#ffffff']), { vx: rand(-20, -5), vy: rand(40, 70), grav: 0, life: rand(0.8, 1.6) });
    if (V.id === 'cosmic' && Math.random() < 0.06) { const x = rand(20, W - 20); beams.push({ x, y: rand(H * 0.3, H * 0.8), col: '#7fff9a', life: 0.6, max: 0.6, w: 6 }); }
    if (V.id === 'heaven') { lctx.globalAlpha = 0.08 + 0.04 * Math.sin(time * 2); lctx.fillStyle = '#fff3a0'; for (let i = 0; i < 4; i++) { const x = (i * W / 3 + time * 8) % (W + 60) - 30; lctx.beginPath(); lctx.moveTo(x, 0); lctx.lineTo(x + 26, 0); lctx.lineTo(x + 70, H); lctx.lineTo(x + 30, H); lctx.fill(); } lctx.globalAlpha = 1; if (Math.random() < 0.2) part(rand(0, W), -2, '#ffffff', { vx: rand(-6, 6), vy: rand(10, 25), grav: 0, life: 2 }); }
    if (V.id === 'deep' && Math.random() < 0.4) part(rand(0, W), H + 2, pick(['#4fe0c8', '#9ff0e0']), { vx: rand(-4, 4), vy: -rand(20, 40), grav: 0, life: rand(1, 2) });
  }
  let invFade = 0, lastInv = null;
  // ---------- Sudden events (js/events.js) ----------
  let evFade = 0, evLastK = null;
  const metPos = mt => mobPos({ id: -1000 - mt.id, a: mt.a, p: mt.p, kind: 'x' });
  function drawEventFx(dt) {
    const ev = G.R.ev;
    evFade = clamp(evFade + (ev ? dt : -dt) * 2, 0, 1);
    if (ev) evLastK = ev.k;
    const k = evLastK;
    if (evFade <= 0 || !k) return;
    if (k === 'bloodmoon') {
      lctx.globalAlpha = 0.2 * evFade; lctx.fillStyle = '#6a0014'; lctx.fillRect(0, 0, W, H);
      const mo = SPR.defs.ev_bloodmoon ? SPR.get('ev_bloodmoon') : null;
      if (mo) { lctx.globalAlpha = 0.85 * evFade; lctx.drawImage(mo, Math.round(W * 0.8 - mo.width * 1.5), 16, mo.width * 3, mo.height * 3); }
      lctx.globalAlpha = 1;
      if (ev && Math.random() < 0.3) part(rand(0, W), -2, pick(['#ff3b5c', '#a0102a']), { vx: rand(-4, 4), vy: rand(20, 40), grav: 0, life: 1.4 });
    } else if (k === 'goldrush') {
      lctx.globalAlpha = 0.07 * evFade; lctx.fillStyle = '#ffd84a'; lctx.fillRect(0, 0, W, H); lctx.globalAlpha = 1;
      if (ev) for (let i = 0; i < 2; i++) if (Math.random() < 0.7) part(rand(0, W), -2, pick(['#ffd84a', '#fff3a0', '#c98f10']), { vx: rand(-6, 6), vy: rand(50, 90), grav: 40, life: 1.6, size: 2 });
    } else if (k === 'frenzy') {
      lctx.globalAlpha = (0.06 + 0.04 * Math.sin(time * 12)) * evFade; lctx.fillStyle = '#ffe27a'; lctx.fillRect(0, 0, W, H); lctx.globalAlpha = 1;
    } else if (k === 'stampede' && ev) {
      // dust boils up where they charge from
      const q = mobPos({ id: -1, a: ev.a, p: 0.05, kind: 'x' });
      for (let i = 0; i < 3; i++) if (Math.random() < 0.8) part(q.x + rand(-26, 26), q.y + rand(-14, 14), pick(['#c8b89a', '#a89878', '#e0d4b8']), { vx: rand(-10, 10), vy: rand(-14, -4), grav: 0, life: rand(0.5, 1.1), size: 2 });
    }
    if (k === 'meteors' && ev) for (const mt of ev.met) {
      const q = metPos(mt), f = 1 - mt.t / mt.T;
      // where it will land: a shrinking red ring
      const r = Math.round(10 - 5 * f);
      lctx.globalAlpha = 0.35 + 0.4 * f; lctx.fillStyle = '#ff3b3b';
      for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2 + time * 2; lctx.fillRect(Math.round(q.x + Math.cos(a) * r), Math.round(q.y - 2 + Math.sin(a) * r * 0.55), 1, 1); }
      lctx.globalAlpha = 1;
      // the rock itself, coming in from high up and to the right
      const mx = q.x + (1 - f) * 70, my = q.y - 4 - (1 - f) * 130;
      const spr = SPR.defs.fx_meteor ? SPR.get('fx_meteor') : null;
      glow(mx, my - 3, 6, '#ff7a2e', 0.4);
      if (spr) blit(spr, Math.round(mx), Math.round(my)); else { lctx.fillStyle = '#ff7a2e'; lctx.fillRect(Math.round(mx) - 2, Math.round(my) - 4, 4, 4); }
      if (Math.random() < 0.8) part(mx + 2, my - 4, pick(['#ffd84a', '#ff7a2e', '#ff3b3b', '#6e6e7c']), { vx: rand(10, 30), vy: rand(-40, -20), grav: 0, life: 0.35 });
    }
  }
  // ---------- The JACKPOT: the whole screen goes gold ----------
  let jp = null;
  const easeBounce = x => { const n = 7.5625, d = 2.75; if (x < 1 / d) return n * x * x; if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75; if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375; return n * (x -= 2.625 / d) * x + 0.984375; };
  function drawJackpot(dt) {
    if (!jp) return;
    jp.t += dt;
    const T = 6, t = jp.t;
    if (t > T) { jp = null; return; }
    const fade = Math.min(1, t / 0.25, (T - t) / 0.8);
    const b = btnPos();
    // the world dims, and gold rays turn round the Button
    lctx.globalAlpha = 0.6 * fade; lctx.fillStyle = '#0c0712'; lctx.fillRect(0, 0, W, H);
    lctx.globalAlpha = 0.22 * fade;
    for (let i = 0; i < 16; i++) {
      const a0 = time * 0.9 + i / 16 * Math.PI * 2, a1 = a0 + Math.PI / 22, R_ = Math.max(W, H);
      lctx.fillStyle = i % 2 ? '#ffd84a' : '#fff3a0';
      lctx.beginPath(); lctx.moveTo(b.x, b.y - 10); lctx.lineTo(b.x + Math.cos(a0) * R_, b.y - 10 + Math.sin(a0) * R_); lctx.lineTo(b.x + Math.cos(a1) * R_, b.y - 10 + Math.sin(a1) * R_); lctx.fill();
    }
    lctx.globalAlpha = 1;
    // a golden Button drops from the sky and bounces
    const gb = SPR.button('#ffd84a', false, 0, false);
    // it lands just above the real one
    const k = Math.min(1, t / 0.9), y = Math.round(-40 + (b.y - 4) * easeBounce(k));
    glow(b.x, y - 12, 34, '#ffd84a', 0.5 * fade);
    lctx.globalAlpha = fade; blit(gb, b.x, y, 2); lctx.globalAlpha = 1;
    // a fountain of coins and confetti
    if (t < T - 1) for (let i = 0; i < 7; i++) part(b.x + rand(-10, 10), y - 16, pick(['#ffd84a', '#fff3a0', '#c98f10', '#ffffff', '#ff7ae6', '#7fe9ff']), { vx: rand(-90, 90), vy: rand(-170, -80), grav: 190, life: rand(1, 1.8), size: 2 });
  }
  function drawJackpotText() {
    if (!jp) return;
    const t = jp.t, b = btnPos(), pop = 1 + 0.12 * Math.sin(t * 9) + (t < 0.3 ? (0.3 - t) * 3 : 0);
    const alpha = Math.min(1, t / 0.2, (6 - t) / 0.8);
    if (alpha <= 0) return;
    ctx.save(); ctx.globalAlpha = alpha; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = crisp(13 * pop) + 'px ' + FONT; ctx.lineWidth = 3; ctx.strokeStyle = '#0c0b12';
    const str = G.t('jpTitle'), y = Math.round(cardY(0.15));
    // every letter its own colour, running round the rainbow
    const w = ctx.measureText(str).width;
    let x = W / 2 - w / 2;
    ctx.textAlign = 'left';
    for (let i = 0; i < str.length; i++) {
      const ch = str[i], cw = ctx.measureText(ch).width;
      ctx.strokeText(ch, x, y + Math.sin(t * 8 + i) * 1.5);
      ctx.fillStyle = 'hsl(' + ((t * 300 + i * 30) % 360) + ',95%,62%)';
      ctx.fillText(ch, x, y + Math.sin(t * 8 + i) * 1.5);
      x += cw;
    }
    ctx.textAlign = 'center'; ctx.font = crisp(4) + 'px ' + FONT; ctx.lineWidth = 2;
    ctx.strokeText(G.t('jpSub'), W / 2, y + 14); ctx.fillStyle = '#fff3a0'; ctx.fillText(G.t('jpSub'), W / 2, y + 14);
    if (jp.gold) { ctx.font = crisp(6) + 'px ' + FONT; ctx.strokeText('+' + G.fmt(jp.gold), W / 2, y + 24); ctx.fillStyle = '#ffd84a'; ctx.fillText('+' + G.fmt(jp.gold), W / 2, y + 24); }
    ctx.restore();
  }
  // a fallen ally blinks TAP, so it's clear the Hand can raise them
  function drawTapHints() {
    if (!G.partyUnits || Math.sin(time * 6) < -0.2) return;
    const units = G.partyUnits().filter(u => u.down > 0);
    if (!units.length) return;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = crisp(3) + 'px ' + FONT; ctx.lineWidth = 1.5; ctx.strokeStyle = '#0c0b12';
    for (const u of units) { const q = unitPos(u.who); ctx.strokeText(G.t('tapRevive'), q.x, q.y - 22); ctx.fillStyle = '#8ae07a'; ctx.fillText(G.t('tapRevive'), q.x, q.y - 22); }
  }
  function hitMeteor(p) {
    const ev = G.R.ev;
    if (!ev || ev.k !== 'meteors') return null;
    for (const mt of ev.met) {
      const q = metPos(mt), f = 1 - mt.t / mt.T, mx = q.x + (1 - f) * 70, my = q.y - 6 - (1 - f) * 130;
      if (Math.hypot(p.x - mx, p.y - my) < 11 || Math.hypot(p.x - q.x, p.y - q.y) < 9) return mt.id;
    }
    return null;
  }
  function drawRiftTint() {
    const r = G.R.rift;
    if (!r) return;
    lctx.globalAlpha = 0.1 + 0.03 * Math.sin(time * 2);
    lctx.fillStyle = '#6b2fb8';
    lctx.fillRect(0, 0, W, 3); lctx.fillRect(0, H - 3, W, 3); lctx.fillRect(0, 0, 3, H); lctx.fillRect(W - 3, 0, 3, H);
    lctx.globalAlpha = 1;
    if (Math.random() < 0.5) part(rand(0, W), H - 2, pick(['#b36bff', '#6b2fb8', '#e0d0ff']), { vx: 0, vy: rand(-30, -10), grav: 0, life: 0.8 });
  }
  function drawEventNames() {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 1; ctx.strokeStyle = '#0c0b12';
    const s = G.R.shrine, q = shrinePos();
    if (s && q) {
      const S_ = G.SHRINES[s.k];
      ctx.font = crisp(3) + 'px ' + FONT;
      ctx.strokeText(S_.name, q.x, q.y - 22); ctx.fillStyle = S_.col; ctx.fillText(S_.name, q.x, q.y - 22);
    }
    const bq = breachPos();
    if (bq) { ctx.font = crisp(3) + 'px ' + FONT; ctx.strokeText(G.t('breach'), bq.x, bq.y - 12); ctx.fillStyle = '#d8b8ff'; ctx.fillText(G.t('breach'), bq.x, bq.y - 12); }
  }
  St.busyCelebrating = () => (St.celebrate || 0) > time;
  St.lootPoint = e => { const v = gvis.get(e.id); return v && v.landed ? St.toScreen(v.x, v.y - 14) : null; };
  St.shrinePoint = () => { const q = shrinePos(); return q ? St.toScreen(q.x, q.y - 16) : null; };
  function worldListen() {
    G.on('drop', onDrop);
    G.on('pickup', onPickup);
    G.on('hoard', m => {
      cardText(0, G.t('hoardComing'), '#ffd84a', 6, { life: 2, max: 2, vy: -4, big: true });
      St.flash(0.15, '#ffd84a');
      if (G.Audio && G.Audio.hoard) G.Audio.hoard();
    });
    G.on('hoardDie', m => {
      const q = mobPos(m);
      for (let i = 0; i < 40 && coins.length < 260; i++) coins.push({ x: q.x, y: q.y - 6, vx: rand(-70, 70), vy: rand(-150, -60), floor: q.y + rand(-3, 4), t: rand(0.6, 1), fly: 0 });
      text(q.x, q.y - 28, G.t('jackpot'), '#ffd84a', 7, { life: 1.8, max: 1.8, vy: -12, big: true });
      ring(q.x, q.y - 3, 34, 18, '#ffd84a', 0.6); ring(q.x, q.y - 3, 22, 12, '#ffffff', 0.4);
      St.shake(6); St.flash(0.3, '#ffd84a'); slowmo = Math.max(slowmo, 0.6); hitstop = Math.max(hitstop, 0.12);
      if (G.Audio && G.Audio.jackpot) G.Audio.jackpot();
    });
    G.on('hoardFlee', m => {
      const q = mobPos(m);
      ring(q.x, q.y - 4, 14, 7, '#b36bff', 0.5);
      burst(q.x, q.y - 6, ['#b36bff', '#e0d0ff'], 20, 60);
      text(q.x, q.y - 24, G.t('hoardFled', Math.max(1, Math.round(m.hp / m.max * 100))), '#c8b4ff', 4, { life: 2, max: 2, vy: -10 });
    });
    G.on('shrine', () => { const q = shrinePos(); if (q) { ring(q.x, q.y - 3, 20, 10, G.SHRINES[G.R.shrine.k].col, 0.6); } if (G.Audio && G.Audio.shrine) G.Audio.shrine(0); });
    G.on('shrineUse', (s, how) => {
      const col = G.SHRINES[s.k].col, b = btnPos(), q = arenaXY(s.a, s.p, 0.5);
      burst(q.x, q.y - 8, [col, '#ffffff'], 40, 100);
      ring(b.x, b.y - 4, 90, 50, col, 0.7); ring(b.x, b.y - 4, 55, 30, '#ffffff', 0.4);
      cardText(0, G.SHRINES[s.k].name, col, 6, { life: 2, max: 2, vy: -4, big: true });
      cardText(9, G.SHRINES[s.k].desc, '#ffffff', 3, { life: 2, max: 2, vy: -4 });
      St.flash(0.3, col); St.shake(3);
      if (G.Audio && G.Audio.shrine) G.Audio.shrine(1);
    });
    G.on('breach', b => {
      cardText(0, G.t('breachOpen'), '#d8b8ff', 7, { life: 2.2, max: 2.2, vy: -4, big: true });
      St.flash(0.3, '#6b2fb8'); St.shake(4);
      breachKills = 0;
      if (G.Audio && G.Audio.breach) G.Audio.breach();
    });
    G.on('breachEnd', () => { cardText(0, G.t('breachClosed', G.fmt(breachKills)), '#d8b8ff', 5, { life: 2, max: 2, vy: -4 }); });
    G.on('mobDie', m => { if (m.br) breachKills++; });
    G.on('blast', (m, r) => {
      const q = mobPos(m), a = aoePx(r);
      ring(q.x, q.y - 3, a.rx, a.ry, '#ff7a2e', 0.3); ring(q.x, q.y - 3, a.rx * 0.6, a.ry * 0.6, '#ffd84a', 0.2);
      burst(q.x, q.y - 5, ['#ff7a2e', '#ffd84a', '#ff3b3b'], 8, 70, { life: 0.35 });
      St.shake(1.5);
      if (G.Audio && G.Audio.boom) G.Audio.boom();
    });
    G.on('bomb', (m, r) => {
      const q = mobPos(m), a = aoePx(r);
      ring(q.x, q.y - 3, a.rx, a.ry, '#ffffff', 0.25); ring(q.x, q.y - 3, a.rx * 0.7, a.ry * 0.7, '#ff7a2e', 0.35);
      burst(q.x, q.y - 5, ['#ff7a2e', '#ffd84a', '#ffffff', '#3a3a44'], 16, 110, { life: 0.4 });
      glowFx.push({ x: q.x, y: q.y - 5, r: a.rx * 0.8, col: '#ff9a3a', t: 0.18, T: 0.18 });
      St.shake(2.5); hitstop = Math.max(hitstop, 0.025);
      if (G.Audio && G.Audio.boom) G.Audio.boom();
    });
    G.on('bomberPop', () => {
      const b = btnPos();
      burst(b.x, b.y - 8, ['#ff3b3b', '#ff7a2e', '#ffd84a', '#3a3a44'], 26, 120, { life: 0.5 });
      ring(b.x, b.y - 4, 34, 18, '#ff7a2e', 0.35);
      St.shake(4); St.flash(0.15, '#ff3b3b'); btnHurtT = 0.25;
      text(b.x + rand(-10, 10), b.y - 34, G.t('bomberPop'), '#ff7a2e', 5, { life: 0.8, max: 0.8, vy: -16 });
      if (G.Audio && G.Audio.boom) G.Audio.boom();
    });
    G.on('spitHit', () => { const b = btnPos(); btnHurtT = 0.12; burst(b.x + rand(-12, 12), b.y - 8, ['#b6ff5a', '#8ad83a', '#ffffff'], 6, 50, { life: 0.35 }); });
    G.on('wave', n => {
      cardText(0, G.t('waveN', n), '#ff9a3a', 7, { life: 1.8, max: 1.8, vy: -4, big: true, callout: true });
      cardText(11, G.t('waveSub'), '#ffe27a', 3, { life: 1.8, max: 1.8, vy: -4 });
      St.shake(2);
    });
    G.on('landStar', (i, bit) => {
      const R_ = G.REALMS[i], b = btnPos();
      cardText(0, '\u2605 ' + G.t('landStar', R_.name).toUpperCase(), '#ffd84a', 7, { life: 3, max: 3, vy: -3, big: true });
      St.flash(0.25, '#ffd84a');
      burst(b.x, b.y - 20, ['#ffd84a', '#fff3a0', '#ffffff'], 40, 130);
      ring(b.x, b.y - 6, 50, 26, '#ffd84a', 0.6);
    });
    // a new zone: its name, and the new kind of mob it brings
    G.on('bossWin', (rew, b) => {
      const d = G.S.depth;
      if (G.realmIndex(d) !== G.realmIndex(b.d)) return; // the land card covers it
      setTimeout(() => zoneCard(d), 900);
    });
    G.on('spores', m => { const q = mobPos(m); burst(q.x, q.y - 5, ['#c84ae8', '#ff7ab0', '#f4ecd8'], 10, 40, { grav: -10, life: 0.8 }); });
    G.on('thorns', m => { const q = mobPos(m); burst(q.x, q.y - 6, ['#b36bff', '#ffffff'], 6, 50, { life: 0.3 }); });
    G.on('headhunter', m => { const hp = heroPos(); text(hp.x, hp.y - 34, G.t('headhunter'), '#e8903a', 4, { life: 1.6, max: 1.6, vy: -12 }); ring(hp.x, hp.y - 4, 30, 15, '#e8903a', 0.5); });
    G.on('bossMove', b => {
      const M = G.BOSS_MOVES[b.move.k], p = bossPos();
      ring(p.x, p.y - 10, 50, 28, M.col, 0.5);
      St.flash(0.12, M.col);
      if (G.Audio && G.Audio.windup) G.Audio.windup(b.move.k);
    });
    G.on('bossStagger', (b, k) => {
      const p = bossPos();
      text(p.x, p.y - 44, G.t('staggered'), '#ffffff', 7, { life: 1.4, max: 1.4, vy: -10, big: true });
      ring(p.x, p.y - 10, 80, 44, '#ffffff', 0.5); ring(p.x, p.y - 10, 50, 28, G.BOSS_MOVES[k].col, 0.4);
      burst(p.x, p.y - 14, ['#ffffff', G.BOSS_MOVES[k].col, '#ffe27a'], 40, 120);
      hitstop = Math.max(hitstop, 0.1); St.shake(5); St.flash(0.3, '#ffffff'); bossHitT = 0.2;
      if (G.Audio && G.Audio.stagger) G.Audio.stagger();
    });
    G.on('bossMoveLand', (b, k) => {
      const p = bossPos(), bp = btnPos();
      if (k === 'slam') { St.shake(8); St.flash(0.35, '#ff3b3b'); ring(bp.x, bp.y - 2, 70, 38, '#ff3b3b', 0.5); burst(bp.x, bp.y - 4, ['#ff3b3b', '#3a3a44', '#ffffff'], 40, 110); }
      if (k === 'summon') { ring(p.x, p.y - 10, 90, 50, '#b36bff', 0.6); St.flash(0.2, '#6b2fb8'); }
      text(p.x, p.y - 44, G.BOSS_MOVES[k].name + '!', G.BOSS_MOVES[k].col, 6, { life: 1.2, max: 1.2, vy: -10 });
      if (G.Audio && G.Audio.boom) G.Audio.boom();
    });
    G.on('bossRage', () => {
      const p = bossPos();
      text(p.x, p.y - 40, G.t('enraged'), '#ff3b3b', 7, { life: 1.8, max: 1.8, vy: -8, big: true });
      St.flash(0.35, '#ff3b3b'); St.shake(6);
      if (G.Audio && G.Audio.horn) G.Audio.horn();
    });
    G.on('riftStart', r => {
      groundKey = '';
      cardText(0, G.t('riftName', r.lvl), '#e0c0ff', 9, { life: 2.2, max: 2.2, vy: -4, big: true });
      cardText(11, G.t('riftGo'), '#ffffff', 3, { life: 2.2, max: 2.2, vy: -4 });
      const b = btnPos(); ring(b.x, b.y - 4, 100, 56, '#b36bff', 0.8); ring(b.x, b.y - 4, 60, 34, '#ffffff', 0.5);
      St.flash(0.5, '#6b2fb8'); St.shake(5);
      if (G.Audio && G.Audio.rift) G.Audio.rift(0);
    });
    G.on('riftGuardian', m => {
      cardText(0, G.t('riftGuardian'), '#ff3b5c', 7, { life: 2, max: 2, vy: -4, big: true });
      St.flash(0.3, '#ff3b3b'); St.shake(5);
      if (G.Audio && G.Audio.horn) G.Audio.horn();
    });
    G.on('riftEnd', r => {
      groundKey = '';
      if (r.win) {
        cardText(0, G.t('riftCleared'), '#ffd84a', 8, { life: 2.6, max: 2.6, vy: -4, big: true });
        cardText(11, G.t(r.up === 1 ? 'riftUp1' : 'riftUp', r.up, r.open, Math.round(r.used)), '#ffffff', 3, { life: 2.6, max: 2.6, vy: -4 });
        const b = btnPos(); ring(b.x, b.y - 4, 100, 56, '#ffd84a', 0.8);
        burst(b.x, b.y - 10, ['#ffd84a', '#ffffff', '#b36bff'], 80, 150);
        St.flash(0.4, '#ffd84a'); St.shake(6); slowmo = Math.max(slowmo, 0.6);
      } else {
        cardText(0, G.t(r.why === 'broke' ? 'riftBroke' : 'riftFailed'), '#c8b4ff', 6, { life: 2.2, max: 2.2, vy: -4, big: true });
        St.flash(0.4, '#1e0e34');
      }
      if (G.Audio && G.Audio.rift) G.Audio.rift(r.win ? 1 : 2);
    });
  }
  let breachKills = 0;

  // ---------- Frame ----------
  St.frame = function (dt) {
    time += dt; fdt = dt || 1 / 60;
    // several kills in one frame weigh more
    // the Horde dies in heaps all the time now: only a real heap stops the frame
    if (multiCd > 0) multiCd -= dt;
    if (frameKills >= 12 && multiCd <= 0) {
      const big = frameKills >= 40;
      multiCd = big ? 0.5 : 0.3;
      hitstop = Math.max(hitstop, big ? 0.05 : 0.02); St.shake(big ? 3 : 1.5);
      const b = btnPos();
      if (cardT <= 0) text(b.x + rand(-40, 40), b.y + 30 + rand(0, 6), '×' + frameKills, big ? '#ff9a3a' : '#ffe27a', big ? 6 : 4, { life: 0.9, max: 0.9, vy: -20 });
      if (big && G.Audio && G.Audio.heap) G.Audio.heap(frameKills);
    }
    frameKills = 0;
    stepCards(dt);
    // a boss about to arrive on its own counts down over the Button
    const bin = G.R.bossReady && !G.R.boss && !G.R.inv && G.S.set.autoBoss && G.R.bossIn != null && G.R.bossIn > 0 && G.bossOdds && G.bossOdds() >= 0.6 ? Math.ceil(G.R.bossIn) : 0;
    if (bin && bin !== lastCount) { const b = btnPos(); text(b.x, b.y - 62, G.t('bossCountdown', bin), '#ff4f4f', 6, { life: 0.9, max: 0.9, vy: -6, big: true }); St.shake(1); if (G.Audio && G.Audio.bossCount) G.Audio.bossCount(bin); }
    lastCount = bin;
    openHeat = Math.max(0, openHeat - dt * 8);
    hurtFx = Math.max(0, hurtFx - dt * 1.1);
    if (btnDmg > 0 && (btnDmgT -= dt) <= 0) {
      const b = btnPos(), f = btnDmg / Math.max(1, G.D.heroHp);
      text(b.x + rand(-12, 12), b.y - 30, '-' + fmtSmall(btnDmg), f > 0.08 ? '#ff3b3b' : '#ff7a7a', f > 0.08 ? 5 : 4, { life: 0.75, max: 0.75, vy: -20 });
      btnDmg = 0; btnDmgT = 0.22;
    }
    const lowHp = G.S.hero && G.S.hero.cls && !(G.R.btnDown > 0) && G.S.hero.hp < G.D.heroHp * 0.3;
    if (lowHp && (beatT -= dt) <= 0) { beatT = 0.85; if (G.Audio && G.Audio.heartbeat) G.Audio.heartbeat(); }
    if (killGold > 0 && (killGoldT -= dt) <= 0) { const b = btnPos(); text(b.x + rand(-6, 6), b.y + 16, '+' + fmtSmall(killGold), '#f0c850', 3, { life: 0.8, max: 0.8, vy: -10 }); killGold = 0; killGoldT = 0.3; }
    // hit-stop and slow motion only touch the visuals; the game keeps its own clock
    const vdt = dt * (hitstop > 0 ? 0.08 : slowmo > 0 ? 0.3 : 1);
    if (hitstop > 0) hitstop -= dt;
    if (slowmo > 0) slowmo -= dt;
    streak.t += dt;
    if (comboTier && G.R.combo < (G.D.comboCap || 50) / 4) comboTier = 0;
    if (streak.t > 2) streak.n = 0;
    if (streak.pop > 0) streak.pop -= dt;
    const S_ = G.S, R = G.R;
    const realm = G.REALMS[G.realmIndex(G.depthNow ? G.depthNow() : G.S.depth)];
    const gk = realm.id + '|' + W + 'x' + H;
    if (gk !== groundKey) { if (groundKey.split('|')[0] !== realm.id) St.clearStain(); groundKey = gk; groundCanvas = buildGround(realm.id); }
    buildHeroes();

    // hold-to-click
    if (holding) { holdTimer -= dt; if (holdTimer <= 0) { holdTimer = 0.125; G.manualClick(); } }

    lctx.imageSmoothingEnabled = false;
    lctx.drawImage(groundCanvas, 0, 0);
    if (realm.id === 'shore') drawWater();
    drawDecals(dt);
    stepGibs(vdt);
    drawGibs(true);
    drawPerkFx();
    drawBreach();
    drawRiftTint();
    drawInvasionSky(vdt);
    drawEventFx(vdt);
    stepGround(vdt);
    drawJackpot(dt);

    // Collect drawables sorted by y
    const list = [];
    const b = btnPos();

    // Chests
    for (const c of S_.chests) {
      const v = visFor(c);
      v.t += dt;
      if (v.drop > 0) v.drop = Math.max(0, v.drop - dt * 3.2);
      if (v.hit > 0) v.hit -= dt;
      if (v.pop > 0) v.pop -= dt;
      if (v.arc && (v.arc.t += vdt) >= v.arc.dur) { v.arc = null; landed(c, v); }
      list.push({ y: v.y, draw: () => drawChest(c, v) });
    }
    // the Looters run for their chests
    stepLooters(vdt, list);
    // Remove stale vis entries (e.g. after load)
    if (vis.size > S_.chests.length + 4) {
      const ids = new Set(S_.chests.map(c => c.id));
      for (const k of [...vis.keys()]) if (!ids.has(k)) vis.delete(k);
    }
    // Loot on the ground and the shrine
    for (const e of R.ground || []) { const v = gvis.get(e.id); if (v) list.push({ y: v.landed ? v.y : v.y + 20, draw: () => drawGroundItem(e, v) }); }
    if (R.shrine) { const q = shrinePos(); if (q) list.push({ y: q.y, draw: drawShrine }); }
    // Heroes
    for (const hv of heroVis) {
      hv.fire -= dt;
      const tgt = bossVis ? bossPos() : b;
      if (hv.fire <= 0) {
        hv.fire = rand(0.9, 2.2);
        shots.push({ x: hv.x, y: hv.y - 6, sx: hv.x, sy: hv.y - 6, tx: tgt.x + rand(-6, 6), ty: tgt.y - 6 + rand(-4, 4), t: 0, dur: 0.35, col: hv.h.shot });
      }
      list.push({ y: hv.y, draw: () => {
        shadow(hv.x, hv.y - 1, 8);
        const bob = Math.round(Math.sin(time * 4 + hv.ph) * 0.6);
        blit(SPR.get('h_' + hv.h.id), hv.x, hv.y + bob);
      } });
    }
    // Pets
    S_.active.forEach((id, i) => {
      const pp = petPos(i);
      const st = S_.pets[id];
      list.push({ y: pp.y, draw: () => {
        shadow(pp.x, pp.y + 2, 6);
        blit(SPR.get('p_' + id, st && st.gold ? { gold: true } : null), pp.x, pp.y);
        if (st && st.gold && Math.random() < 0.08) part(pp.x + rand(-4, 4), pp.y - rand(2, 8), '#fff3a0', { vy: -10, vx: 0, grav: 0, life: 0.5 });
      } });
    });
    // Mobs and the hero
    if (G.S.hero && G.S.hero.cls) stepHero(dt);
    const mrealm = realm;
    for (const m of R.mobs || []) {
      const v = mobVisOf(m);
      v.vp = v.vp == null ? m.p : v.vp + (m.p - v.vp) * Math.min(1, vdt * 14);
      const q = mobPos(m);
      // still walking in from past the edge
      if (q.x < -12 || q.x > W + 12 || q.y < -4 || q.y > H + 20) continue;
      list.push({ y: q.y, draw: () => drawMob(m, q, mrealm) });
    }
    if (G.S.hero && G.S.hero.cls) { const hp = heroPos(); list.push({ y: hp.y, draw: () => drawHero(hp) }); }
    // companions, each at their place
    if (G.partyUnits && G.S.hero && G.S.hero.cls) for (const u of G.partyUnits()) if (u.who >= 0) { const q = allySlot(u.who); list.push({ y: q.y, draw: () => drawAlly(u.who, u, q) }); }
    if (mobVis.size > (R.mobs || []).length + 20) { const ids = new Set((R.mobs || []).map(m => m.id)); for (const k of [...mobVis.keys()]) if (!ids.has(k)) mobVis.delete(k); }
    // Button or boss
    if (bossVis && bossDmg.acc > 0 && (bossDmg.t -= dt) <= 0) {
      const bp = bossPos();
      text(bp.x + rand(-18, 18), bp.y - 26 - rand(0, 10), '-' + G.fmt(bossDmg.acc), bossDmg.crit ? '#ff7a2e' : '#ffffff', bossDmg.crit ? 5 : 4, { life: 0.7, max: 0.7, vy: -26 });
      bossDmg.acc = 0; bossDmg.crit = false; bossDmg.t = 0.16;
    }
    if (!bossVis) bossDmg.acc = 0;
    if (bossVis) {
      bossVis.t += dt;
      if (bossVis.enter > 0) bossVis.enter = Math.max(0, bossVis.enter - dt * 2.5);
      const bp = bossPos();
      list.push({ y: bp.y + 6, draw: () => drawBoss(bp) });
      bossBulletT -= dt;
      if (bossBulletT <= 0 && R.boss) {
        bossBulletT = bossVis.lord ? (R.boss.rage ? 0.45 : 0.9) : 1.4;
        const n = bossVis.lord ? 14 : 9, off = Math.random() * 6.28;
        const col = bossVis.lord ? '#ff4f7e' : '#ffe27a';
        for (let i = 0; i < n; i++) {
          const a = off + i / n * Math.PI * 2;
          bullets.push({ x: bp.x, y: bp.y - 10, vx: Math.cos(a) * 55, vy: Math.sin(a) * 38, life: 1.6, col });
        }
      }
    } else {
      list.push({ y: b.y + 6, draw: () => drawButton(b) });
    }
    // Wisp
    if (R.wisp) {
      const w = R.wisp, k = 1 - w.t / w.life;
      const dir = w.seed < 0.5 ? 1 : -1;
      const x = dir > 0 ? -10 + k * (W + 20) : W + 10 - k * (W + 20);
      const y = H * (0.25 + w.seed * 0.3) + Math.sin(time * 2.5 + w.seed * 10) * H * 0.12;
      St._wispPos = { x, y };
      list.push({ y, draw: () => {
        glow(x, y - 4, 6, '#fff3a0', 0.25 + 0.1 * Math.sin(time * 8));
        blit(SPR.get('wisp'), x, y + Math.sin(time * 6) * 1.5);
        if (Math.random() < 0.5) part(x + rand(-3, 3), y - 4, pick(['#fff3a0', '#ffd84a', '#ffffff']), { vx: rand(-8, 8), vy: rand(-8, 8), grav: 0, life: 0.6 });
      } });
    } else St._wispPos = null;

    list.sort((a, c) => a.y - c.y);
    for (const d of list) d.draw();
    drawLootBeams();
    drawShotsInFlight();
    drawBeamsFx(vdt);
    drawRings(vdt); drawGlowFx(vdt);
    stepCoins(vdt);
    stepGems(vdt);

    // Opening chests animation
    for (let i = opening.length - 1; i >= 0; i--) {
      const o = opening[i]; o.t += dt;
      if (o.t >= o.dur) { opening.splice(i, 1); continue; }
      const a = 1 - o.t / o.dur;
      blit(SPR.get((o.bag ? 'bag_' : 'chesto_') + o.tier), o.x, o.y + 1 - (o.bag ? Math.round(o.t * 20) : 0), 1, a);
    }
    // Beams
    for (let i = beams.length - 1; i >= 0; i--) {
      const bm = beams[i]; bm.life -= dt;
      if (bm.life <= 0) { beams.splice(i, 1); continue; }
      const a = bm.life / bm.max;
      lctx.globalAlpha = 0.35 * a;
      lctx.fillStyle = bm.col;
      lctx.fillRect(Math.round(bm.x - bm.w / 2), 0, bm.w, Math.round(bm.y - 2));
      lctx.globalAlpha = 0.6 * a;
      lctx.fillRect(Math.round(bm.x - 1), 0, 2, Math.round(bm.y - 2));
      lctx.globalAlpha = 1;
    }
    // Shots
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i]; s.t += vdt;
      if (s.t >= s.dur) {
        shots.splice(i, 1);
        if (!s.key) part(s.tx, s.ty, s.col, { vx: rand(-20, 20), vy: rand(-20, 5), life: 0.2, grav: 0 });
        if (s.boom) { ring(s.boom.x, s.boom.y, s.boom.rx, s.boom.ry, s.boom.col, 0.2); burst(s.boom.x, s.boom.y - 2, [s.boom.col, '#ffffff'], 4, 50, { life: 0.25 }); }
        continue;
      }
      const k = s.t / s.dur;
      const arc = s.flat ? 0 : 6;
      const x = s.sx + (s.tx - s.sx) * k, y = s.sy + (s.ty - s.sy) * k - Math.sin(k * Math.PI) * arc;
      if (s.arrow) { // a shaft with a head, pointing where it flies
        const d = Math.hypot(s.tx - s.sx, s.ty - s.sy) || 1, ux = (s.tx - s.sx) / d, uy = (s.ty - s.sy) / d;
        lctx.fillStyle = '#c8a870';
        for (let j = 1; j <= 4; j++) lctx.fillRect(Math.round(x - ux * j), Math.round(y - uy * j), 1, 1);
        lctx.fillStyle = '#f0ead8'; lctx.fillRect(Math.round(x - ux * 5), Math.round(y - uy * 5), 1, 1);
        lctx.fillStyle = s.col; lctx.fillRect(Math.round(x), Math.round(y), 1, 1);
        continue;
      }
      lctx.fillStyle = s.col;
      lctx.fillRect(Math.round(x), Math.round(y), s.big ? 3 : 2, s.big ? 3 : 2);
      lctx.globalAlpha = 0.5;
      const px = s.sx + (s.tx - s.sx) * Math.max(0, k - 0.12), py = s.sy + (s.ty - s.sy) * Math.max(0, k - 0.12) - Math.sin(Math.max(0, k - 0.12) * Math.PI) * arc;
      lctx.fillRect(Math.round(px), Math.round(py), 1, 1);
      lctx.globalAlpha = 1;
    }
    if (shots.length > 120) shots.splice(0, shots.length - 120);
    // Boss bullets (RotMG-style rings)
    for (let i = bullets.length - 1; i >= 0; i--) {
      const bl = bullets[i]; bl.life -= dt;
      bl.x += bl.vx * dt; bl.y += bl.vy * dt;
      if (bl.life <= 0 || bl.x < -4 || bl.x > W + 4 || bl.y < -4 || bl.y > H + 4) { bullets.splice(i, 1); continue; }
      lctx.fillStyle = '#0c0b12'; lctx.fillRect(Math.round(bl.x) - 2, Math.round(bl.y) - 1, 4, 2); lctx.fillRect(Math.round(bl.x) - 1, Math.round(bl.y) - 2, 2, 4);
      lctx.fillStyle = bl.col; lctx.fillRect(Math.round(bl.x) - 1, Math.round(bl.y) - 1, 2, 2);
    }
    // Lightning
    for (let i = bolts.length - 1; i >= 0; i--) {
      const bo = bolts[i]; bo.life -= dt;
      if (bo.life <= 0) { bolts.splice(i, 1); continue; }
      if (bo.wide) { // ink edges, a coloured body and a white core, so it reads on sand too
        lctx.fillStyle = '#0c0b12';
        for (let j = 0; j < bo.pts.length - 1; j++) { line(bo.pts[j][0] - 1, bo.pts[j][1], bo.pts[j + 1][0] - 1, bo.pts[j + 1][1]); line(bo.pts[j][0] + 1, bo.pts[j][1], bo.pts[j + 1][0] + 1, bo.pts[j + 1][1]); }
        lctx.fillStyle = bo.cols[1];
        for (let j = 0; j < bo.pts.length - 1; j++) line(bo.pts[j][0] + (j % 2 ? 1 : -1) * 0, bo.pts[j][1], bo.pts[j + 1][0], bo.pts[j + 1][1]);
      }
      lctx.fillStyle = Math.random() < 0.5 ? '#ffffff' : bo.cols ? bo.cols[1] : '#7fe9ff';
      for (let j = 0; j < bo.pts.length - 1; j++) line(bo.pts[j][0], bo.pts[j][1], bo.pts[j + 1][0], bo.pts[j + 1][1]);
    }
    // Flyers (item pops, merge)
    for (let i = flyers.length - 1; i >= 0; i--) {
      const f = flyers[i]; f.t += dt;
      if (f.t >= f.dur) { flyers.splice(i, 1); continue; }
      const k = f.t / f.dur;
      if (f.float) {
        const y = f.y + f.vy * f.t * (1 - k * 0.5);
        const a = k > 0.7 ? (1 - k) / 0.3 : 1;
        if (f.r >= 3) glow(f.x, y - 5, 5, rarityCol(f.r), 0.3 * a);
        blit(SPR.get(f.spr), f.x, y, 1, a);
      } else {
        blit(SPR.get(f.spr) || SPR.get('chest_0'), f.x + (f.tx - f.x) * k, f.y + (f.ty - f.y) * k, 1, 1 - k * 0.5);
      }
    }
    // Particles
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life -= vdt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.vy += p.grav * vdt; p.x += p.vx * vdt; p.y += p.vy * vdt;
      lctx.globalAlpha = Math.min(1, p.life / p.max * 1.6);
      lctx.fillStyle = p.col;
      lctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    lctx.globalAlpha = 1;
    drawGibs(false);

    // Buff tint
    if (G.hasBuff('frenzy')) { lctx.globalAlpha = 0.07 + 0.03 * Math.sin(time * 6); lctx.fillStyle = '#ffd84a'; lctx.fillRect(0, 0, W, H); lctx.globalAlpha = 1; }
    if (G.hasBuff('storm')) { lctx.globalAlpha = 0.06 + 0.04 * Math.sin(time * 14); lctx.fillStyle = '#7fe9ff'; lctx.fillRect(0, 0, W, H); lctx.globalAlpha = 1; }

    // ---- Blit to display ----
    let ox = 0, oy = 0;
    if (shake > 0) { ox = Math.round(rand(-shake, shake)); oy = Math.round(rand(-shake, shake)); shake = Math.max(0, shake - dt * 30); }
    if (kick > 0) { oy += 1; kick = 0; } // a one-frame downward kick on every click
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0c0b12';
    ctx.fillRect(0, 0, cv.width, cv.height);
    const k = S * DPR;
    ctx.drawImage(low, ox * k, oy * k, W * k, H * k);
    // Vignette
    const vg = ctx.createRadialGradient(cv.width / 2, cv.height * 0.55, Math.min(cv.width, cv.height) * 0.35, cv.width / 2, cv.height * 0.55, Math.max(cv.width, cv.height) * 0.75);
    vg.addColorStop(0, 'rgba(8,6,14,0)');
    vg.addColorStop(1, 'rgba(8,6,14,0.62)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, cv.width, cv.height);
    // hurt: the edges run red, and pulse while the Button is low
    const lowK = G.S.hero && G.S.hero.cls && !(G.R.btnDown > 0) && G.D.heroHp ? clamp(1 - G.S.hero.hp / (G.D.heroHp * 0.3), 0, 1) : 0;
    const red = Math.min(0.6, hurtFx * 0.6 + lowK * (0.16 + 0.12 * Math.sin(time * 7)) + (G.R.btnDown > 0 ? 0.22 : 0));
    if (red > 0.01) {
      const rg = ctx.createRadialGradient(cv.width / 2, cv.height * 0.55, Math.min(cv.width, cv.height) * 0.3, cv.width / 2, cv.height * 0.55, Math.max(cv.width, cv.height) * 0.72);
      rg.addColorStop(0, 'rgba(255,30,40,0)'); rg.addColorStop(1, 'rgba(255,30,40,' + red.toFixed(3) + ')');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, cv.width, cv.height);
    }
    if (flash > 0) {
      ctx.globalAlpha = Math.min(0.85, flash);
      ctx.fillStyle = flashCol; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.globalAlpha = 1; flash = Math.max(0, flash - dt * 1.8);
    }
    // ---- Hi-res layer: text & bars ----
    ctx.setTransform(k, 0, 0, k, ox * k, oy * k);
    drawNames();
    drawEventNames();
    drawLabels();
    drawTexts(dt);
    drawJackpotText();
    drawTapHints();
    drawStreak();
    if (R.rift) { /* the Rift's bar and clock live in the HUD row under the field */ }
    else if (bossVis && R.boss) { drawBossBar(); drawMoveName(); }
    else if (R.bossReady && !R.inv) drawReady(b);
    if (hoverChest) drawChestTip(hoverChest);
    drawHeroPlate();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  };

  function line(x0, y0, x1, y1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, guard = 0;
    while (guard++ < 400) {
      lctx.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  function buildGround(realmId) {
    const g = SPR.ground(realmId, W, H, 7 + realmId.length * 13);
    const c = SPR.makeCanvas(W, H), x = c.getContext('2d');
    x.drawImage(g, 0, 0);
    // scatter decor away from the centre
    const cfg = SPR.REALM_GROUND[realmId];
    const rnd = G.seeded(99 + realmId.length);
    const b = btnPos();
    const n = Math.round(W * H / 900);
    for (let i = 0; i < n; i++) {
      const px = Math.round(rnd() * W), py = Math.round(rnd() * H);
      const dx = (px - b.x) / (W * 0.33), dy = (py - b.y) / (H * 0.36);
      if (dx * dx + dy * dy < 1 || py < 14) continue;
      const spr = SPR.get(cfg.decor[Math.floor(rnd() * cfg.decor.length)]);
      x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(px - 3, py, 6, 1);
      x.drawImage(spr, Math.round(px - spr.width / 2), py - spr.height + 1);
    }
    return c;
  }
  function drawWater() {
    const cfg = SPR.REALM_GROUND.shore;
    const rows = 12;
    for (let y = 0; y < rows; y++) for (let x = 0; x < W; x += 1) {
      const wave = Math.sin(x * 0.3 + time * 2 + y * 0.8);
      const edge = rows - 2 + Math.round(Math.sin(x * 0.15 + time) * 1.5);
      if (y > edge) continue;
      let col = cfg.water[0];
      if (wave > 0.7) col = cfg.water[1];
      if (wave > 0.95 && (x + y) % 3 === 0) col = cfg.water[2];
      if (y === edge) col = '#e8f4ff';
      lctx.fillStyle = col; lctx.fillRect(x, y, 1, 1);
    }
  }

  // PoE-style drop: a thud of dust, a beam for the good stuff, a name tag
  function landed(c, v) {
    burst(v.x, v.y - 1, ['#c8b89a', '#8a7a60'], 5, 30, { grav: 60, life: 0.35 });
    v.hit = 0.08;
    if (c.tier >= 3) beams.push({ x: v.x, y: v.y, col: rarityCol(c.tier), life: 1.4 + c.tier * 0.2, max: 1.4 + c.tier * 0.2, w: c.tier >= 5 ? 7 : 5 });
    if (c.tier >= 2 || c.mod) text(v.x, v.y - 16, G.L(G.RARITIES[c.tier].name) + (c.mod ? ' · ' + G.L(G.MOD_BY_ID[c.mod].name) : ''), c.mod ? G.MOD_BY_ID[c.mod].color : rarityCol(c.tier), 3, { vy: -6, life: 1.6, max: 1.6 });
    if (c.tier >= 5) { St.shake(3); St.flash(0.2, rarityCol(c.tier)); }
    if (G.Audio && G.Audio.drop) G.Audio.drop(c.tier);
  }
  // ---------- The Looters ----------
  const lootVis = [];
  function stepLooters(dt, list) {
    const R = G.R, L = R.looters || [];
    lootVis.length = Math.min(lootVis.length, L.length);
    const b = btnPos();
    L.forEach((l, i) => {
      const home = { x: b.x + 22 + (i % 3) * 9, y: b.y + 22 + Math.floor(i / 3) * 7 };
      let v = lootVis[i];
      if (!v) v = lootVis[i] = { x: home.x, y: home.y, face: 1, walk: 0, lift: 0 };
      const cv = l.tgt != null ? vis.get(l.tgt) : null;
      const tgt = cv && !cv.arc ? { x: cv.x - 5, y: cv.y + 1 } : home;
      const dx = tgt.x - v.x, dy = tgt.y - v.y, d = Math.hypot(dx, dy);
      // it arrives just as its time is up, however far the chest is
      const left = cv ? Math.max(0.08, (G.D.autoOpen || 1) - l.acc) : 0.6;
      const sp = Math.min(400, Math.max(28, d / left));
      if (d > 0.5) { const k = Math.min(1, sp * dt / d); v.x += dx * k; v.y += dy * k; v.face = dx >= 0 ? 1 : -1; v.walk += dt * (6 + sp / 12); }
      if (v.lift > 0) v.lift -= dt;
      const moving = d > 1.5;
      list.push({ y: v.y, draw: () => drawLooter(v, moving) });
    });
  }
  function drawLooter(v, moving) {
    const id = v.lift > 0 ? 'looter_2' : moving ? 'looter_' + (Math.floor(v.walk) % 2) : 'looter_0';
    const spr = SPR.defs[id] ? SPR.get(id) : SPR.get('ic_key');
    const x = Math.round(v.x), y = Math.round(v.y) - (moving && Math.floor(v.walk * 2) % 2 ? 1 : 0);
    shadow(x, y - 1, 7);
    if (v.face < 0) { lctx.save(); lctx.translate(x, 0); lctx.scale(-1, 1); blit(spr, 0, y); lctx.restore(); } else blit(spr, x, y);
    if (moving && Math.random() < 0.2) part(x - v.face * 3, y - 1, '#c8b89a', { vx: -v.face * 10, vy: -6, grav: 20, life: 0.25 });
  }
  function drawChest(c, v) {
    const dropY = v.drop > 0 ? -Math.round(v.drop * v.drop * 30) : 0;
    let x = v.x, y = v.y + dropY;
    if (v.arc) { // still flying out of the mob
      const a = v.arc, k = Math.min(1, a.t / a.dur);
      x = Math.round(a.sx + (v.x - a.sx) * k);
      y = Math.round(a.sy + (v.y - a.sy) * k - Math.sin(k * Math.PI) * 18);
      blit(chestSpr(c, v), x, y);
      if (c.tier >= 3 && Math.random() < 0.6) part(x + rand(-2, 2), y - 4, rarityCol(c.tier), { vx: 0, vy: 0, grav: 0, life: 0.3 });
      return;
    }
    let sc = 1;
    if (v.hit > 0) x += Math.round(rand(-1, 1));
    const mod = c.mod, mini = miniChest(v, c), crowd = G.S.chests.length > 40;
    shadow(v.x, v.y - 1, mini ? 7 : 12);
    // tier glow (in a crowd only the good ones glow)
    if ((c.tier >= 3 || mod) && (!crowd || c.tier >= 4 || mod)) {
      const col = mod ? G.MOD_BY_ID[mod].color : rarityCol(c.tier);
      glow(x, y - 3, mini ? 5 : 7, col, (mod ? 0.22 : 0.16) + 0.08 * Math.sin(time * 4 + c.id));
    }
    if (c.tier === 6 && Math.random() < 0.15) part(x + rand(-6, 6), y - rand(4, 12), '#ffffff', { vy: -15, vx: 0, grav: 0, life: 0.6 });
    let spr = chestSpr(c, v);
    let alpha;
    if (mod === 'ghost') { alpha = 0.55 + 0.15 * Math.sin(time * 3 + c.id); y -= 2 + Math.round(Math.sin(time * 2 + c.id) * 1.5); if (Math.random() < 0.08) part(x + rand(-5, 5), y - 3, '#ffffff', { vy: -8, vx: 0, grav: 0, life: 0.7 }); }
    if (mod === 'mimic' && c.awake) { spr = SPR.get('mimic'); x += Math.round(Math.sin(time * 30) * 1); }
    if (mod === 'mimic' && !c.awake && Math.sin(time * 1.3 + c.id) > 0.985) spr = SPR.get('mimic');
    if (v.pop > 0) sc = 1;
    blit(spr, x, y, sc, alpha);
    if (v.hit > 0) blit(white(spr), x, y, 1, v.hit * 4);
    // modifier overlays
    if (mod === 'golden' && Math.random() < 0.2) part(x + rand(-6, 6), y - rand(2, 10), pick(['#ffd84a', '#fff3a0']), { vy: -12, vx: 0, grav: 0, life: 0.5 });
    if (mod === 'chromatic') {
      const hue = (time * 200 + c.id * 40) % 360;
      lctx.fillStyle = 'hsl(' + hue + ',90%,65%)';
      const a = time * 3 + c.id;
      for (let i = 0; i < 3; i++) lctx.fillRect(Math.round(x + Math.cos(a + i * 2.1) * 9), Math.round(y - 6 + Math.sin(a + i * 2.1) * 5), 1, 1);
    }
    if (mod === 'lightning' && Math.random() < 0.06) { lctx.fillStyle = '#7fe9ff'; line(x - 4, y - 14, x + 1, y - 9); line(x + 1, y - 9, x - 2, y - 6); }
    if (mod === 'lightning') { lctx.drawImage(SPR.get('ic_bolt'), Math.round(x + 3), Math.round(y - 20)); }
    if (mod === 'void' && Math.random() < 0.3) { const a = Math.random() * 6.28; part(x + Math.cos(a) * 10, y - 5 + Math.sin(a) * 6, pick(['#8a4dff', '#3a2266']), { vx: -Math.cos(a) * 20, vy: -Math.sin(a) * 12, grav: 0, life: 0.5 }); }
    if (mod === 'blazing') {
      if (Math.random() < 0.6) part(x + rand(-6, 6), y - rand(2, 8), pick(['#ff7a2e', '#ffd84a', '#ff4040']), { vy: -30, vx: rand(-5, 5), grav: -10, life: 0.4 });
      const k = clamp(c.life / G.TUNE.blazeLife, 0, 1);
      lctx.fillStyle = '#0c0b12'; lctx.fillRect(x - 7, y + 1, 14, 2);
      lctx.fillStyle = k > 0.4 ? '#ffb347' : '#ff4040'; lctx.fillRect(x - 6, y + 1, Math.round(12 * k), 1);
    }
    if (mod === 'frozen') {
      lctx.globalAlpha = 0.55;
      lctx.fillStyle = '#bfe8ff'; lctx.fillRect(x - 8, y - 13, 16, 13);
      lctx.globalAlpha = 0.9;
      lctx.fillStyle = '#ffffff'; lctx.fillRect(x - 7, y - 12, 5, 1); lctx.fillRect(x - 7, y - 11, 1, 3);
      lctx.fillStyle = '#7fc4ff';
      const cracks = 8 - c.hp;
      for (let i = 0; i < cracks; i++) { lctx.fillRect(x - 6 + ((i * 5) % 12), y - 11 + ((i * 3) % 9), 2, 1); }
      lctx.globalAlpha = 1;
    }
    if (mod === 'mimic' && c.awake) {
      const k = c.hp / G.TUNE.mimicClicks;
      lctx.fillStyle = '#0c0b12'; lctx.fillRect(x - 7, y - 17, 14, 3);
      lctx.fillStyle = '#ff4f4f'; lctx.fillRect(x - 6, y - 16, Math.max(0, Math.round(12 * k)), 1);
    }
    if (hoverChest === c) { lctx.globalAlpha = 0.25; blit(white(spr), x, y); lctx.globalAlpha = 1; }
  }

  function drawButton(b) {
    const skin = G.SKINS.find(s => s.id === G.S.skin) || G.SKINS[0];
    const pressed = btnPress > 0;
    if (btnPress > 0) btnPress -= fdt;
    const combo = G.R.combo, cap = G.D.comboCap || 50;
    if (combo > 10 && Math.random() < 0.25 + 0.5 * combo / cap) {
      const a = Math.random() * 6.28;
      part(b.x + Math.cos(a) * 16, b.y - 6 + Math.sin(a) * 6, combo >= cap ? pick(['#ff7ae6', '#ffffff']) : pick(['#ffd84a', '#fff3a0']), { vx: 0, vy: -rand(15, 35), grav: 0, life: 0.5 });
    }
    shadow(b.x, b.y + 1, 36);
    const spr = SPR.button(skin.base, pressed, time * 120 % 360);
    btnSpring.v += (1 - btnSpring.s) * 0.35; btnSpring.v *= 0.7; btnSpring.s += btnSpring.v;
    const sy = clamp(btnSpring.s, 0.8, 1.15), sx = 1 + (1 - sy) * 0.9;
    const bw = Math.round(spr.width * sx), bh = Math.round(spr.height * sy);
    lctx.drawImage(spr, Math.round(b.x - bw / 2), Math.round(b.y + 4 - bh), bw, bh);
    if (btnFlashT > 0) { lctx.globalAlpha = Math.min(0.7, btnFlashT * 9); lctx.drawImage(white(spr), Math.round(b.x - bw / 2), Math.round(b.y + 4 - bh), bw, bh); lctx.globalAlpha = 1; btnFlashT -= fdt; }
    if (btnHurtT > 0) { blit(white(spr), b.x, b.y + 4, 1, btnHurtT * 3); btnHurtT -= fdt; }
    if (G.R.btnDown > 0) {
      // broken: dark, cracked, smoking, and a countdown until it mends
      lctx.globalAlpha = 0.8; blit(SPR.button('#3a3348', true, 0), b.x, b.y + 4); lctx.globalAlpha = 1;
      lctx.fillStyle = '#0c0b12';
      for (const [x0, y0, x1, y1] of [[-8, -12, -2, -4], [-2, -4, -5, 2], [3, -13, 7, -6], [7, -6, 4, 0]]) { lctx.fillRect(b.x + x0, b.y + y0, Math.max(1, Math.abs(x1 - x0)), 1); lctx.fillRect(b.x + x1, b.y + Math.min(y0, y1), 1, Math.abs(y1 - y0)); }
      if (Math.random() < 0.4) part(b.x + rand(-10, 10), b.y - rand(4, 12), pick(['#6e6e7c', '#3a3a44', '#ff7a2e']), { vx: rand(-5, 5), vy: -rand(15, 30), grav: -10, life: 0.8 });
    }
    if (G.R.stun > 0) {
      lctx.globalAlpha = 0.45; blit(SPR.button('#3a3348', true, 0), b.x, b.y + 4); lctx.globalAlpha = 1;
      if (Math.random() < 0.5) part(b.x + rand(-14, 14), b.y - rand(0, 12), pick(['#7fe9ff', '#ffffff']), { vx: rand(-30, 30), vy: rand(-40, -10), life: 0.3 });
    }
    const h = G.S.hero;
    if (h && h.cls && G.D.heroHp) {
      const k = clamp(h.hp / G.D.heroHp, 0, 1), w = 30;
      lctx.fillStyle = '#0c0b12'; lctx.fillRect(b.x - w / 2 - 1, b.y + 7, w + 2, 4);
      lctx.fillStyle = '#3a1a1e'; lctx.fillRect(b.x - w / 2, b.y + 8, w, 2);
      lctx.fillStyle = k > 0.35 ? '#56d45a' : '#e84a4a'; lctx.fillRect(b.x - w / 2, b.y + 8, Math.round(w * k), 2);
    }
    if ((G.S.upg.prince || 0) > 0) blit(SPR.get('crown_small'), b.x, b.y - 22 + (pressed ? 3 : 0) + Math.round(Math.sin(time * 2)));
    if (skin.id === 'divine' && Math.random() < 0.2) part(b.x + rand(-14, 14), b.y - rand(8, 20), '#ffffff', { vy: -10, vx: 0, grav: 0, life: 0.6 });
    if (skin.id === 'gold' && Math.random() < 0.12) part(b.x + rand(-14, 14), b.y - rand(8, 20), '#fff3a0', { vy: -10, vx: 0, grav: 0, life: 0.6 });
  }

  function drawBossMove(bp) {
    const b = G.R.boss, sp = bossVis.sprite, sc = bossScale(), h = sp.canvas.height * sc;
    if (b.move) {
      const M = G.BOSS_MOVES[b.move.k], k = clamp(b.move.t / b.move.T, 0, 1);
      if (b.move.k === 'shield') {
        lctx.globalAlpha = 0.18 + 0.08 * Math.sin(time * 10); lctx.fillStyle = M.col;
        const rx = sp.canvas.width * sc * 0.65, ry = h * 0.6;
        for (let dy = -ry; dy <= ry; dy++) { const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / ry) * (dy / ry)))); lctx.fillRect(Math.round(bp.x - w), Math.round(bp.y - h / 2 + dy), w * 2, 1); }
        lctx.globalAlpha = 1;
      } else if (Math.floor(time * 12) % 2) glow(bp.x, bp.y - h / 2, Math.round(sp.canvas.width * sc / 2), M.col, 0.25);
      // wind-up bar and taps left
      const w = 30, y = Math.round(bp.y - h - 10);
      lctx.fillStyle = '#0c0b12'; lctx.fillRect(bp.x - w / 2 - 1, y - 1, w + 2, 4);
      lctx.fillStyle = M.col; lctx.fillRect(bp.x - w / 2, y, Math.round(w * k), 2);
      for (let i = 0; i < b.move.need; i++) { lctx.fillStyle = i < b.move.n ? '#ffffff' : '#3a3a44'; lctx.fillRect(Math.round(bp.x - b.move.need * 2 + i * 4), y + 4, 3, 2); }
    }
    if (b.stagger > 0 && Math.random() < 0.5) part(bp.x + rand(-12, 12), bp.y - h - rand(0, 6), pick(['#ffe27a', '#ffffff']), { vx: rand(-20, 20), vy: -10, grav: 0, life: 0.4 });
  }
  function drawBoss(bp) {
    const sp = bossVis.sprite, sc = bossScale();
    const bob = Math.round(Math.sin(bossVis.t * 3) * 1.5);
    const enterY = Math.round(-bossVis.enter * bossVis.enter * 60);
    shadow(bp.x, bp.y + 1, Math.round(sp.canvas.width * sc * 0.7));
    if (bossVis.lord) glow(bp.x, bp.y - sp.canvas.height * sc / 2, Math.round(sp.canvas.width * sc / 3), '#ff4f7e', 0.12 + 0.06 * Math.sin(time * 5));
    const x = bp.x + (bossHitT > 0 ? Math.round(rand(-1, 1)) : 0), y = bp.y + bob + enterY;
    blit(sp.canvas, x, y, sc);
    if (bossHitT > 0) { blit(white(sp.canvas), x, y, sc, Math.min(0.45, bossHitT * 6)); bossHitT -= fdt; }
    if (sp.crown) blit(SPR.get('crown_small'), x, y - sp.canvas.height * sc + 2, 1);
    if (G.R.boss) drawBossMove(bp);
  }

  // ---------- Hi-res text layer (drawn in logical coords, crisp font) ----------
  const FONT = '"Press Start 2P", "BTTN Body", monospace';
  // Press Start 2P is only crisp on an 8px device grid, so snap logical sizes to it.
  // at least 8 CSS px on any screen, on the 8-device-px grid
  function crisp(size) { const k = S * DPR, g = 8 * Math.ceil(DPR); return Math.max(g, Math.round(size * k / 8) * 8) / k; }
  function drawTexts(dt) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i]; t.life -= dt;
      if (t.life <= 0) { texts.splice(i, 1); continue; }
      t.y += t.vy * dt; t.vy *= 0.97;
      const age = t.max - t.life;
      const pop = age < t.pop ? 1 + (1 - age / t.pop) * 0.5 : 1;
      const a = Math.min(1, t.life / t.max * 2.2);
      ctx.globalAlpha = a;
      ctx.font = crisp(t.size * pop) + 'px ' + FONT;
      // a line wider than the stage shrinks to fit
      if (t.fitW == null) t.fitW = ctx.measureText(t.str).width / pop;
      if (t.fitW > W - 8) ctx.font = (crisp(t.size * pop) * (W - 8) / t.fitW) + 'px ' + FONT;
      ctx.lineWidth = Math.max(1, t.size * 0.35);
      ctx.strokeStyle = '#0c0b12';
      ctx.lineJoin = 'round';
      ctx.strokeText(t.str, t.x, t.y);
      ctx.fillStyle = t.col;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
  // Rare monsters wear their names, as in PoE
  function drawNames() {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 1; ctx.strokeStyle = '#0c0b12';
    for (const m of G.R.mobs || []) {
      if (m.kind === 'hoard' || m.kind === 'guardian') {
        const q = mobPos(m), hoard = m.kind === 'hoard', y = hoard ? q.y - 25 : q.y - 44;
        const nm = hoard ? G.t('hoarder') : m.inv && G.INV_BY_ID[m.inv] ? G.INV_BY_ID[m.inv].bossName : G.t('riftGuardian');
        ctx.font = crisp(hoard ? 3 : 4) + 'px ' + FONT;
        ctx.strokeText(nm, q.x, y); ctx.fillStyle = hoard ? '#ffd84a' : '#ff9ab4'; ctx.fillText(nm, q.x, y);
        if (hoard) { const k = clamp(m.life / G.TUNE.hoardLife, 0, 1); ctx.fillStyle = '#0c0b12'; ctx.fillRect(q.x - 9, y + 3, 18, 2); ctx.fillStyle = k > 0.3 ? '#b36bff' : '#ff4f4f'; ctx.fillRect(q.x - 9, y + 3, 18 * k, 1); }
        else { const k = clamp(m.hp / m.max, 0, 1); ctx.fillStyle = '#0c0b12'; ctx.fillRect(q.x - 21, y + 3, 42, 3); ctx.fillStyle = '#ff3b5c'; ctx.fillRect(q.x - 20, y + 4, 40 * k, 1.5); }
        continue;
      }
      if (m.kind !== 'rare') continue;
      const q = mobPos(m);
      ctx.font = crisp(3) + 'px ' + FONT;
      ctx.strokeText(m.name, q.x, q.y - 27); ctx.fillStyle = '#ffd84a'; ctx.fillText(m.name, q.x, q.y - 27);
      const mod = G.RARE_MODS[m.mod].name;
      ctx.strokeText(mod, q.x, q.y - 23); ctx.fillStyle = '#c8b4ff'; ctx.fillText(mod, q.x, q.y - 23);
    }
  }
  let hudBottomH = 0, hudBottomT = 0;
  function drawStreak() {
    const c = G.carnage ? G.carnage() : { n: streak.n, tier: 0 };
    const n = Math.max(c.n, 0);
    if (n < 10 || (G.S.hero && G.S.hero.offer)) return;
    // the kill counter lives just above the bars at the bottom, clear of the title cards
    if (!hudBottomH || (hudBottomT -= fdt) <= 0) { hudBottomT = 1; const el = typeof document !== 'undefined' && document.querySelector('.hud.bottom'); hudBottomH = el ? el.offsetHeight : 90; }
    const y = H - Math.ceil(hudBottomH / S) - 12;
    const pop = streak.pop > 0 ? 1 + streak.pop * 2 : 1;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = crisp(4 * pop) + 'px ' + FONT; ctx.lineWidth = 1.5; ctx.strokeStyle = '#0c0b12';
    const s = G.t('streak', G.fmt(n));
    const fade = Math.min(1, (2.5 - (G.R.carnT || 0)) * 2);
    ctx.globalAlpha = Math.max(0, fade);
    const col = c.tier >= 4 ? '#ff4fe0' : c.tier >= 3 ? '#ff4f7e' : c.tier >= 2 ? '#ff7a2e' : c.tier >= 1 ? '#ffb347' : '#ffe27a';
    ctx.strokeText(s, W / 2, y); ctx.fillStyle = col; ctx.fillText(s, W / 2, y);
    // Carnage: the streak's bonus, and how far to the next step
    if (c.tier > 0 || n >= 30) {
      const y2 = y + 6;
      ctx.font = crisp(3) + 'px ' + FONT;
      const s2 = c.tier ? G.t('carnage', (1 + 0.1 * c.tier).toFixed(1)) : G.t('carnageAt', '1.1', c.next);
      ctx.strokeText(s2, W / 2, y2); ctx.fillStyle = c.tier ? col : '#a8a4b8'; ctx.fillText(s2, W / 2, y2);
      if (c.next) {
        const prev = [0, 100, 300, 800, 2000][c.tier] || 0, k = clamp((n - prev) / (c.next - prev), 0, 1), w = 30;
        ctx.fillStyle = '#0c0b12'; ctx.fillRect(W / 2 - w / 2 - 0.5, y2 + 2.5, w + 1, 2);
        ctx.fillStyle = col; ctx.fillRect(W / 2 - w / 2, y2 + 3, w * k, 1);
      }
    }
    ctx.globalAlpha = 1;
  }
  function drawBossBar() {
    const b = G.R.boss;
    const w = Math.min(W - 20, 170), x = Math.round((W - w) / 2);
    // on narrow screens the bar would run into the land strip: it goes under it
    let y = Math.ceil(50 / S);
    if (x * S < 230) { const el = document.querySelector('#realmBox'), r = el && el.getBoundingClientRect(), c = cv.getBoundingClientRect(); if (r && r.height) y = Math.max(y, Math.ceil((r.bottom - c.top + 8) / S)); }
    ctx.fillStyle = '#0c0b12'; ctx.fillRect(x - 1, y - 1, w + 2, 7);
    ctx.fillStyle = '#3a1a1e'; ctx.fillRect(x, y, w, 5);
    const k = clamp(b.hp / b.max, 0, 1);
    ctx.fillStyle = b.lord ? '#ff3b5c' : '#e84a4a'; ctx.fillRect(x, y, Math.round(w * k), 5);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x, y, Math.round(w * k), 1);
    ctx.font = crisp(4) + 'px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.lineWidth = 1.2; ctx.strokeStyle = '#0c0b12';
    const name = G.L(G.bossName(b.d)) + '  ·  ' + G.t('depthShort') + ' ' + (b.d + 1);
    ctx.strokeText(name, x, y + 8); ctx.fillStyle = b.lord ? '#ff9ab4' : '#ffffff'; ctx.fillText(name, x, y + 8);
    ctx.textAlign = 'right';
    const tt = Math.ceil(b.t) + 's';
    if (b.scar < 1) {
      const ws = G.t('wounded', Math.round((1 - b.scar) * 100)) + (b.rally ? ' · ' + G.t('rally', Math.round(b.rally * 100)) : '');
      // on its own line under the name, so the two never overlap
      ctx.font = crisp(3) + 'px ' + FONT; ctx.textAlign = 'left';
      ctx.strokeText(ws, x, y + 15); ctx.fillStyle = '#ff9a7a'; ctx.fillText(ws, x, y + 15);
      ctx.font = crisp(4) + 'px ' + FONT; ctx.textAlign = 'right';
    }
    ctx.strokeText(tt, x + w, y + 8); ctx.fillStyle = b.t < 6 ? '#ff4f4f' : '#ffe27a'; ctx.fillText(tt, x + w, y + 8);
    const hpT = G.fmt(Math.max(0, b.hp)) + ' / ' + G.fmt(b.max);
    ctx.textAlign = 'center'; ctx.font = crisp(3) + 'px ' + FONT;
    ctx.fillStyle = '#ffffff'; ctx.fillText(hpT, x + w / 2, y + 1);
  }
  function drawMoveName() {
    const b = G.R.boss;
    if (!b || !b.move || !bossVis) return;
    const M = G.BOSS_MOVES[b.move.k], bp = bossPos(), h = bossVis.sprite.canvas.height * bossScale();
    ctx.font = crisp(4) + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 1.5; ctx.strokeStyle = '#0c0b12';
    const s = M.name + ' · ' + G.t('tapIt', b.move.need - b.move.n);
    const y = bp.y - h - 18 + (Math.floor(time * 8) % 2);
    ctx.strokeText(s, bp.x, y); ctx.fillStyle = M.col; ctx.fillText(s, bp.x, y);
  }
  function drawReady(b) {
    const y = b.y - 44 + Math.sin(time * 5) * 1.5;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(SPR.get('ic_skull'), Math.round(b.x - 5), Math.round(y - 5));
    ctx.font = crisp(4) + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 1.2; ctx.strokeStyle = '#0c0b12';
    const s = G.t('bossReadyTap');
    if (cardT <= 0) ctx.strokeText(s, b.x, y - 9);
    if (cardT > 0) { ctx.restore(); return; } ctx.fillStyle = '#ff7a2e'; ctx.fillText(s, b.x, y - 9);
    ctx.restore();
  }
  function drawHeroPlate() {
    const h = G.S.hero;
    if (!h || !h.cls) return;
    const hp = heroPos();
    ctx.font = crisp(3) + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 1; ctx.strokeStyle = '#0c0b12';
    const s = (G.S.profile.name || G.L(G.CLASS_BY_ID[h.cls].name)) + ' · ' + G.t('lvl') + ' ' + h.lvl;
    const y = hp.y + 5;
    ctx.strokeText(s, hp.x, y); ctx.fillStyle = '#ffe27a'; ctx.fillText(s, hp.x, y);
  }
  function drawChestTip(c) {
    const v = vis.get(c.id); if (!v) return;
    const label = G.L(G.RARITIES[c.tier].name) + (c.mod ? ' · ' + G.L(G.MOD_BY_ID[c.mod].name) : '');
    ctx.font = crisp(3) + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 1; ctx.strokeStyle = '#0c0b12';
    const y = v.y - 19;
    ctx.strokeText(label, v.x, y); ctx.fillStyle = c.mod ? G.MOD_BY_ID[c.mod].color : rarityCol(c.tier); ctx.fillText(label, v.x, y);
  }
})(globalThis.G = globalThis.G || {});
