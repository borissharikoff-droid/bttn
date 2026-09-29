// BTTN — the stage: a low-res pixel canvas scaled by an integer factor, plus a
// hi-res pass for text and bars. Listens to game events for all the juice.
(function (G) {
  'use strict';
  const { SPR, clamp, rand, pick } = G;
  const St = G.Stage = {};

  let cv, ctx, low, lctx, W = 200, H = 150, S = 3, DPR = 1;
  let groundCanvas = null, groundKey = '';
  const parts = [], texts = [], shots = [], beams = [], bolts = [], bullets = [], opening = [], flyers = [];
  const gibs = [], decals = [], rings = [], coins = [], gems = [];
  const vis = new Map(); // chest id -> visual state
  let slots = [];
  let heroVis = [], heroKey = '';
  let shake = 0, flash = 0, flashCol = '#ffffff', btnPress = 0, time = 0;
  let bossVis = null, bossHitT = 0, bossBulletT = 0;
  let hoverChest = null, pointer = { x: -99, y: -99, over: false };
  let holdTimer = 0, holding = false;
  let hitstop = 0, slowmo = 0;
  const MAXP = 700, MAXG = 650, MAXD = 170;

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
    S = clamp(Math.floor(Math.min(cw / 200, ch / 150)), 2, 6);
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
    for (let i = 0; i < slots.length; i++) if (!used.has(i)) return i;
    return 0;
  }
  function visFor(c) {
    let v = vis.get(c.id);
    if (!v) {
      const slot = freeSlot(), s = slots[slot];
      v = { slot, x: s.x, y: s.y, t: 0, drop: 1, hit: 0 };
      vis.set(c.id, v);
    }
    return v;
  }
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

  // ---------- Events ----------
  function listen() {
    G.on('click', ev => {
      const b = bossVis ? bossPos() : btnPos();
      btnPress = 0.09;
      const x = b.x + rand(-16, 16), y = b.y - 14 - rand(0, 8);
      const combo = ev.combo;
      const col = ev.mega ? '#7fe9ff' : ev.crit ? '#ff7a2e' : combo >= 150 ? '#ff7ae6' : combo >= 60 ? '#ffe27a' : '#ffffff';
      const size = ev.mega ? 9 : ev.crit ? 7 : 5;
      if (!ev.crit && !ev.mega && texts.length > 26) texts.splice(texts.findIndex(q => !q.big), 1);
      text(x, y, '+' + G.fmt(ev.gain), col, size, ev.crit || ev.mega ? { life: 1.3, max: 1.3, big: true } : { life: 0.8, max: 0.8 });
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
      if (src) {
        const q = mobPos(src);
        const land = onField(q.x + rand(-10, 10), q.y + rand(-2, 6));
        vis.set(c.id, { slot: -1, x: land.x, y: land.y, t: 0, drop: 0, hit: 0, arc: { sx: q.x, sy: q.y - 8, t: 0, dur: 0.5 } });
        return;
      }
      const v = visFor(c);
      v.drop = 1; v.t = 0;
      if (c.tier >= 3) beams.push({ x: v.x, y: v.y, col: rarityCol(c.tier), life: 0.8, max: 0.8, w: 3 });
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
      opening.push({ x, y, tier: c.tier, t: 0, dur: 0.35, bag: c.bag });
      const top = loot.items.reduce((a, b) => (b.it.r > a.it.r ? b : a), loot.items[0]);
      const r = top.it.r;
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
    G.on('golem', c => {
      const v = vis.get(c.id); if (!v) return;
      const b = btnPos();
      shots.push({ x: b.x, y: b.y + 14, sx: b.x, sy: b.y + 14, tx: v.x, ty: v.y - 4, t: 0, dur: 0.18, col: '#ffd84a', key: true });
    });
    G.on('heroAttack', onHeroAttack);
    G.on('mobDie', gore);
    G.on('mobFlee', m => { const q = mobPos(m); burst(q.x, q.y - 6, '#6e6e7c', 6, 30); mobVis.delete(m.id); });
    G.on('mobBite', m => {
      btnHurtT = 0.15; mobVisOf(m).lunge = 0.12;
      const b = btnPos(); burst(b.x + rand(-14, 14), b.y - 4, ['#ff4f4f', '#ffffff'], m.kind === 'fodder' ? 1 : 3, 40);
    });
    G.on('surge', () => {
      text(W / 2, H * 0.3, G.t('surge'), '#ff4f4f', 7, { life: 2, max: 2, vy: -4, big: true });
      St.shake(3); St.flash(0.18, '#ff3b3b');
    });
    G.on('rareSpawn', () => text(W / 2, H * 0.3 + 12, G.t('rareComing'), '#ffd84a', 4, { life: 1.8, max: 1.8, vy: -4 }));
    G.on('buttonBreak', () => {
      const b = btnPos();
      St.shake(6); St.flash(0.5, '#ff3b3b');
      burst(b.x, b.y - 6, ['#ff4f4f', '#ffd84a', '#3a3a44'], 40, 110);
      text(b.x, b.y - 30, G.t('overload'), '#ff4f4f', 5, { life: 1.8, max: 1.8, vy: -10 });
    });
    G.on('levelUp', lvl => {
      const hp = heroPos();
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
    G.on('realm', () => { groundKey = ''; St.flash(0.3, '#000000'); });
    G.on('ascend', () => { gems.length = 0; });
    G.on('ascend', () => { groundKey = ''; vis.clear(); mobVis.clear(); decals.length = 0; gibs.length = 0; heroKey = ''; streak.n = 0; St.flash(0.8, '#ffffff'); });
    G.on('buy', (kind) => { if (kind === 'hero') heroKey = ''; });
  }

  // ---------- Input ----------
  function toLogical(e) {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) / S, y: (e.clientY - r.top) / S };
  }
  function hitChest(p) {
    let best = null, bd = 1e9;
    for (const c of G.S.chests) {
      const v = vis.get(c.id); if (!v) continue;
      const dx = p.x - v.x, dy = p.y - (v.y - 5);
      if (Math.abs(dx) <= 10 && Math.abs(dy) <= 9) { const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = c; } }
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
    if (!G.R.bossReady || G.R.boss) return false;
    const b = btnPos();
    return Math.abs(p.x - b.x) < 14 && Math.abs(p.y - (b.y - 34)) < 8;
  }
  function doPress(p) {
    G.Audio && G.Audio.unlock();
    if (hitWisp(p)) { G.catchWisp(); return 'wisp'; }
    if (hitReady(p)) { G.startBoss(); return 'boss'; }
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
    cv.addEventListener('pointerleave', () => { end(); pointer.over = false; hoverChest = null; });
    cv.addEventListener('pointermove', e => {
      const p = toLogical(e);
      pointer.x = p.x; pointer.y = p.y; pointer.over = true;
      hoverChest = hitChest(p);
      cv.style.cursor = (hoverChest || hitMob(p) || hitButton(p) || hitWisp(p) || hitReady(p)) ? 'pointer' : 'default';
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
    if (m.kind === 'fodder') return SPR.get(realm.fodder);
    return SPR.get(realm.minion, m.kind === 'magic' ? { oc: '#3f7fff' } : m.kind === 'rare' ? { oc: '#ffd84a' } : null);
  }
  const MOB_BAR = { brute: '#e84a4a', magic: '#5a9cff', rare: '#ffd84a' };
  function drawMob(m) {
    const realm = G.REALMS[G.realmIndex(G.S.depth)];
    const spr = mobSprite(m, realm);
    const v = mobVisOf(m);
    const q = mobPos(m);
    const fod = m.kind === 'fodder';
    shadow(q.x, q.y - 1, fod ? 6 : 10);
    if (m.kind === 'magic') glow(q.x, q.y - 8, 7, '#3f7fff', 0.2 + 0.07 * Math.sin(time * 5 + m.id));
    if (m.kind === 'rare') glow(q.x, q.y - 9, 10, '#ffd84a', 0.24 + 0.08 * Math.sin(time * 6));
    let x = q.x;
    if (v.hit > 0) x += Math.round(rand(-1, 1));
    if (v.lunge > 0) { x += Math.sign(btnPos().x - q.x) * 2; v.lunge -= 1 / 60; }
    blit(spr, x, q.y);
    if (v.hit > 0) { blit(white(spr), x, q.y, 1, Math.min(0.85, v.hit * 10)); v.hit -= 1 / 60; }
    if (!fod && m.hp < m.max) {
      const w = m.kind === 'rare' ? 16 : 12, k = clamp(m.hp / m.max, 0, 1);
      lctx.fillStyle = '#0c0b12'; lctx.fillRect(q.x - w / 2 - 1, q.y - 21, w + 2, 3);
      lctx.fillStyle = MOB_BAR[m.kind]; lctx.fillRect(q.x - w / 2, q.y - 20, Math.max(1, Math.round(w * k)), 1);
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
  function drawHero(hp) {
    const h = G.S.hero;
    if (!h || !h.cls) return;
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
      bolts.push({ pts: path, life: 0.11, cols: ['#ffffff', '#ffe27a'] });
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
  function decal(x, y, col, r) {
    if (decals.length >= MAXD) decals.shift();
    const px = [];
    const n = Math.round(r * 4);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, d = Math.pow(Math.random(), 1.6) * r;
      px.push([Math.round(Math.cos(a) * d), Math.round(Math.sin(a) * d * 0.5)]);
    }
    for (let i = 0; i < 2; i++) { const a = Math.random() * 6.28; px.push([Math.round(Math.cos(a) * r * 1.6), Math.round(Math.sin(a) * r * 0.8)]); }
    decals.push({ x: Math.round(x), y: Math.round(y), col, px, life: rand(7, 10), max: 10 });
  }
  function ring(x, y, rx, ry, col, life, arc) {
    if (rings.length > 40) rings.shift();
    rings.push({ x, y, rx, ry, col, life, max: life, arc });
  }
  // Splash radius in arena units -> pixels (the arena is squashed vertically)
  const aoePx = a => ({ rx: a * W * 0.62, ry: a * W * 0.62 * 0.55 });

  const streak = { n: 0, t: 9, pop: 0 };
  const STREAKS = [[25, 'sk_25'], [50, 'sk_50'], [100, 'sk_100'], [200, 'sk_200'], [400, 'sk_400'], [800, 'sk_800']];
  function gore(m, gold, chest, src) {
    const q = mobPos(m);
    mobVis.delete(m.id);
    const realm = G.REALMS[G.realmIndex(G.S.depth)];
    const g = GORE[realm.id] || GORE.meadow;
    const spr = mobSprite(m, realm);
    const fod = m.kind === 'fodder';
    const over = Math.min(3, m.over || 0) + (m.crit ? 1 : 0) + (src === 'boss' ? 1.5 : 0);
    const force = 1 + over * 0.3 + (src === 'click' ? 0.35 : 0);
    const n = fod ? (gibs.length > MAXG * 0.7 ? 3 : 6) : m.kind === 'brute' ? 20 : 30;
    explodeSprite(spr, q.x, q.y, 1, n, force, g.style);
    decal(q.x, q.y - 1, g.blood, fod ? 2.5 : 4 + Math.min(4, m.w));
    // every land breaks differently
    const c = q.x, y = q.y - 5;
    if (g.style === 'shatter') burst(c, y, ['#ffffff', '#d8f0ff'], fod ? 3 : 8, 90, { grav: 200, life: 0.35 });
    else if (g.style === 'embers') for (let i = 0; i < (fod ? 3 : 8); i++) part(c + rand(-4, 4), y, pick(['#ffb347', '#ff6a2e', '#ffd84a']), { vx: rand(-15, 15), vy: rand(-50, -20), grav: -30, life: rand(0.5, 1.1) });
    else if (g.style === 'spores') for (let i = 0; i < (fod ? 3 : 7); i++) part(c + rand(-5, 5), y, pick(['#c84ae8', '#ff7ab0', '#f4ecd8']), { vx: rand(-10, 10), vy: rand(-25, -8), grav: -8, life: rand(0.8, 1.5) });
    else if (g.style === 'dissolve') for (let i = 0; i < (fod ? 4 : 10); i++) part(c + rand(-5, 5), y + rand(-4, 4), pick(['#6b3fc0', '#7fe9ff', '#e0d0ff']), { vx: 0, vy: rand(-30, -10), grav: 0, life: rand(0.4, 0.9) });
    else burst(c, y, g.blood, fod ? 3 : 7, 70, { grav: 220, life: 0.45 });
    if (over >= 1.5 && !fod) ring(c, q.y - 3, 10, 5, '#ffffff', 0.18);
    if (m.kind === 'magic') { hitstop = Math.max(hitstop, 0.035); St.shake(2); ring(c, q.y - 3, 16, 8, '#5a9cff', 0.3); }
    if (m.kind === 'rare') {
      hitstop = Math.max(hitstop, 0.09); St.shake(5); St.flash(0.18, '#ffd84a');
      ring(c, q.y - 3, 28, 15, '#ffd84a', 0.45); ring(c, q.y - 3, 16, 9, '#ffffff', 0.3);
      text(c, q.y - 26, G.t('slain', m.name), '#ffd84a', 4, { life: 1.6, max: 1.6, vy: -12 });
      beams.push({ x: c, y: q.y, col: '#ffd84a', life: 1, max: 1, w: 5 });
    }
    // XP crystals: blue for the small fry, green for brutes, red for champions and rares
    const ng = m.kind === 'rare' ? 6 : m.kind === 'magic' ? 3 : m.kind === 'brute' ? 1 : Math.random() < 0.5 ? 1 : 0;
    const gc = m.kind === 'fodder' ? '#6fb4ff' : m.kind === 'brute' ? '#56d45a' : '#ff5a7a';
    for (let i = 0; i < ng && gems.length < 260; i++) gems.push({ x: c + rand(-3, 3), y: q.y - 4, vx: rand(-30, 30), vy: rand(-70, -30), floor: q.y + rand(-2, 3), t: rand(0.3, 0.6), fly: 0, col: gc, big: m.kind !== 'fodder' });
    const nc = m.kind === 'rare' ? 10 : m.kind === 'magic' ? 4 : m.kind === 'brute' ? 2 : Math.random() < 0.12 ? 1 : 0;
    for (let i = 0; i < nc && coins.length < 220; i++) coins.push({ x: c, y: q.y - 6, vx: rand(-40, 40), vy: rand(-90, -40), floor: q.y + rand(-2, 3), t: rand(0.45, 0.8), fly: 0 });
    if (gold && !fod && !m.add) text(c, q.y - 16, '+' + G.fmt(gold), m.kind === 'brute' ? '#e8d890' : '#ffd84a', m.kind === 'brute' ? 3 : 4, { life: 0.8, max: 0.8 });
    // kill streak
    streak.n++; streak.t = 0; streak.pop = 0.15;
    const sk = STREAKS.find(s => s[0] === streak.n);
    if (sk) {
      for (let i = texts.length - 1; i >= 0; i--) if (texts[i].callout) texts.splice(i, 1);
      text(W / 2, H * 0.24, G.t(sk[1]), streak.n >= 200 ? '#ff4f7e' : '#ffe27a', streak.n >= 100 ? 8 : 7, { life: 1.8, max: 1.8, vy: -5, big: true, callout: true });
      St.shake(2 + Math.log2(streak.n / 25));
    }
  }
  function drawDecals(dt) {
    for (let i = decals.length - 1; i >= 0; i--) {
      const d = decals[i]; d.life -= dt;
      if (d.life <= 0) { decals.splice(i, 1); continue; }
      lctx.globalAlpha = 0.55 * Math.min(1, d.life / 2.5);
      lctx.fillStyle = d.col;
      for (const p of d.px) lctx.fillRect(d.x + p[0], d.y + p[1], 1, 1);
    }
    lctx.globalAlpha = 1;
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
        if (d < 4) { gems.splice(i, 1); part(tx + rand(-4, 4), ty + rand(-4, 4), k.col, { vx: 0, vy: -15, grav: 0, life: 0.25 }); continue; }
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

  // ---------- Frame ----------
  St.frame = function (dt) {
    time += dt;
    // hit-stop and slow motion only touch the visuals; the game keeps its own clock
    const vdt = dt * (hitstop > 0 ? 0.08 : slowmo > 0 ? 0.3 : 1);
    if (hitstop > 0) hitstop -= dt;
    if (slowmo > 0) slowmo -= dt;
    streak.t += dt;
    if (streak.t > 2) streak.n = 0;
    if (streak.pop > 0) streak.pop -= dt;
    const S_ = G.S, R = G.R;
    const realm = G.REALMS[G.realmIndex(S_.depth)];
    const gk = realm.id + '|' + W + 'x' + H;
    if (gk !== groundKey) { groundKey = gk; groundCanvas = buildGround(realm.id); }
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
    // Remove stale vis entries (e.g. after load)
    if (vis.size > S_.chests.length + 4) {
      const ids = new Set(S_.chests.map(c => c.id));
      for (const k of [...vis.keys()]) if (!ids.has(k)) vis.delete(k);
    }
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
    for (const m of R.mobs || []) {
      const v = mobVisOf(m);
      v.vp = v.vp == null ? m.p : v.vp + (m.p - v.vp) * Math.min(1, vdt * 14);
      const q = mobPos(m);
      list.push({ y: q.y, draw: () => drawMob(m) });
    }
    if (G.S.hero && G.S.hero.cls) { const hp = heroPos(); list.push({ y: hp.y, draw: () => drawHero(hp) }); }
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
        bossBulletT = bossVis.lord ? 0.9 : 1.4;
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
    drawRings(vdt);
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
      if (shots.length > 120) shots.splice(0, 20);
    }
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
    if (flash > 0) {
      ctx.globalAlpha = Math.min(0.85, flash);
      ctx.fillStyle = flashCol; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.globalAlpha = 1; flash = Math.max(0, flash - dt * 1.8);
    }
    // ---- Hi-res layer: text & bars ----
    ctx.setTransform(k, 0, 0, k, ox * k, oy * k);
    drawNames();
    drawTexts(dt);
    drawStreak();
    if (bossVis && R.boss) drawBossBar();
    else if (R.bossReady) drawReady(b);
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
  function drawChest(c, v) {
    const dropY = v.drop > 0 ? -Math.round(v.drop * v.drop * 30) : 0;
    let x = v.x, y = v.y + dropY;
    if (v.arc) { // still flying out of the mob
      const a = v.arc, k = Math.min(1, a.t / a.dur);
      x = Math.round(a.sx + (v.x - a.sx) * k);
      y = Math.round(a.sy + (v.y - a.sy) * k - Math.sin(k * Math.PI) * 18);
      blit(SPR.get((c.bag ? 'bag_' : 'chest_') + c.tier), x, y);
      if (c.tier >= 3 && Math.random() < 0.6) part(x + rand(-2, 2), y - 4, rarityCol(c.tier), { vx: 0, vy: 0, grav: 0, life: 0.3 });
      return;
    }
    let sc = 1;
    if (v.hit > 0) x += Math.round(rand(-1, 1));
    const mod = c.mod;
    shadow(v.x, v.y - 1, 12);
    // tier glow
    if (c.tier >= 3 || mod) {
      const col = mod ? G.MOD_BY_ID[mod].color : rarityCol(c.tier);
      glow(x, y - 3, 7, col, (mod ? 0.22 : 0.16) + 0.08 * Math.sin(time * 4 + c.id));
    }
    if (c.tier === 6 && Math.random() < 0.15) part(x + rand(-6, 6), y - rand(4, 12), '#ffffff', { vy: -15, vx: 0, grav: 0, life: 0.6 });
    let spr = SPR.get((c.bag ? 'bag_' : 'chest_') + c.tier);
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
    if (btnPress > 0) btnPress -= 1 / 60;
    const combo = G.R.combo, cap = G.D.comboCap || 50;
    if (combo > 10 && Math.random() < 0.25 + 0.5 * combo / cap) {
      const a = Math.random() * 6.28;
      part(b.x + Math.cos(a) * 16, b.y - 6 + Math.sin(a) * 6, combo >= cap ? pick(['#ff7ae6', '#ffffff']) : pick(['#ffd84a', '#fff3a0']), { vx: 0, vy: -rand(15, 35), grav: 0, life: 0.5 });
    }
    shadow(b.x, b.y + 1, 36);
    const spr = SPR.button(skin.base, pressed, time * 120 % 360);
    blit(spr, b.x, b.y + 4);
    if (btnHurtT > 0) { blit(white(spr), b.x, b.y + 4, 1, btnHurtT * 3); btnHurtT -= 1 / 60; }
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

  function drawBoss(bp) {
    const sp = bossVis.sprite, sc = bossScale();
    const bob = Math.round(Math.sin(bossVis.t * 3) * 1.5);
    const enterY = Math.round(-bossVis.enter * bossVis.enter * 60);
    shadow(bp.x, bp.y + 1, Math.round(sp.canvas.width * sc * 0.7));
    if (bossVis.lord) glow(bp.x, bp.y - sp.canvas.height * sc / 2, Math.round(sp.canvas.width * sc / 3), '#ff4f7e', 0.12 + 0.06 * Math.sin(time * 5));
    const x = bp.x + (bossHitT > 0 ? Math.round(rand(-1, 1)) : 0), y = bp.y + bob + enterY;
    blit(sp.canvas, x, y, sc);
    if (bossHitT > 0) { blit(white(sp.canvas), x, y, sc, Math.min(0.45, bossHitT * 6)); bossHitT -= 1 / 60; }
    if (sp.crown) blit(SPR.get('crown_small'), x, y - sp.canvas.height * sc + 2, 1);
  }

  // ---------- Hi-res text layer (drawn in logical coords, crisp font) ----------
  const FONT = '"Press Start 2P", "BTTN Body", monospace';
  // Press Start 2P is only crisp on an 8px device grid, so snap logical sizes to it.
  function crisp(size) { const k = S * DPR; return Math.max(8, Math.round(size * k / 8) * 8) / k; }
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
      if (m.kind !== 'rare') continue;
      const q = mobPos(m);
      ctx.font = crisp(3) + 'px ' + FONT;
      ctx.strokeText(m.name, q.x, q.y - 27); ctx.fillStyle = '#ffd84a'; ctx.fillText(m.name, q.x, q.y - 27);
      const mod = G.RARE_MODS[m.mod].name;
      ctx.strokeText(mod, q.x, q.y - 23); ctx.fillStyle = '#c8b4ff'; ctx.fillText(mod, q.x, q.y - 23);
    }
  }
  function drawStreak() {
    if (streak.n < 10) return;
    const y = G.R.boss ? Math.ceil(50 / S) + 22 : Math.ceil(50 / S) + 2;
    const pop = streak.pop > 0 ? 1 + streak.pop * 2 : 1;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = crisp(4 * pop) + 'px ' + FONT; ctx.lineWidth = 1.5; ctx.strokeStyle = '#0c0b12';
    const s = G.t('streak', G.fmt(streak.n));
    ctx.globalAlpha = Math.min(1, (2 - streak.t) * 2);
    ctx.strokeText(s, W / 2, y); ctx.fillStyle = streak.n >= 100 ? '#ff7ae6' : streak.n >= 50 ? '#ff7a2e' : '#ffe27a'; ctx.fillText(s, W / 2, y);
    ctx.globalAlpha = 1;
  }
  function drawBossBar() {
    const b = G.R.boss;
    const w = Math.min(W - 20, 170), x = Math.round((W - w) / 2), y = Math.ceil(50 / S);
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
    if (b.scar < 1) { ctx.textAlign = 'center'; ctx.strokeText(G.t('wounded', Math.round((1 - b.scar) * 100)), x + w / 2, y + 8); ctx.fillStyle = '#ff9a7a'; ctx.fillText(G.t('wounded', Math.round((1 - b.scar) * 100)), x + w / 2, y + 8); ctx.textAlign = 'right'; }
    ctx.strokeText(tt, x + w, y + 8); ctx.fillStyle = b.t < 6 ? '#ff4f4f' : '#ffe27a'; ctx.fillText(tt, x + w, y + 8);
    const hpT = G.fmt(Math.max(0, b.hp)) + ' / ' + G.fmt(b.max);
    ctx.textAlign = 'center'; ctx.font = crisp(3) + 'px ' + FONT;
    ctx.fillStyle = '#ffffff'; ctx.fillText(hpT, x + w / 2, y + 1);
  }
  function drawReady(b) {
    const y = b.y - 34 + Math.sin(time * 5) * 1.5;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(SPR.get('ic_skull'), Math.round(b.x - 5), Math.round(y - 5));
    ctx.font = crisp(4) + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 1.2; ctx.strokeStyle = '#0c0b12';
    const s = G.t('bossReadyTap');
    ctx.strokeText(s, b.x, y - 9); ctx.fillStyle = '#ff7a2e'; ctx.fillText(s, b.x, y - 9);
    ctx.restore();
  }
  function drawHeroPlate() {
    const h = G.S.hero;
    if (!h || !h.cls) return;
    const hp = heroPos();
    ctx.font = crisp(3) + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 1; ctx.strokeStyle = '#0c0b12';
    const s = (G.S.profile.name || G.L(G.CLASS_BY_ID[h.cls].name)) + ' · ' + G.t('lvl') + ' ' + h.lvl;
    const y = (hero.top != null ? hero.top : hp.y - 22) - 6;
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
