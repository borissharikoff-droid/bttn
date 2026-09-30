// BTTN — the Warden's paper doll. A layered pixel character built from the
// class and whatever is equipped: body armour in the item's colours, helmets,
// hoods and hats, cloaks, shields, boots, crowns, amulets, wings, floating
// tomes and orbs, and the weapon in hand. The stage animates it with idle
// breathing, a 4-frame walk and arm poses for swings, shots and casts.
(function (G) {
  'use strict';
  const Doll = G.Doll = {};
  const SPR = G.SPR;
  const FW = 26, FH = 26, FEET = 23; // frame canvas and the row the boots stand on
  const OUT = '#0c0b12';
  const SKIN = '#f2c6a0', SKIN_S = '#d49b72', EYE = '#1a1a22';

  // What each class wears with nothing equipped in that spot
  const LOOK = {
    knight: { head: 'helm', helm: ['#d2dae4', '#8f99a8'], visor: '#1a1a22', plume: '#3f63d9', body: ['#b8c2d0', '#8f99a8'], tabard: '#3f63d9', legs: ['#6b7484', '#4f5664'], boots: ['#4a4f5c', '#35394a'], hands: '#b8c2d0' },
    archer: { head: 'hood', hood: ['#58a83e', '#3d7f2b'], body: ['#8a5a2e', '#6b4420'], collar: '#58a83e', legs: ['#6b4a2a', '#503620'], boots: ['#3a2a1a', '#2a1e12'], quiver: true },
    wizard: { head: 'hat', hat: ['#4468e0', '#2c47a6'], band: '#ffd84a', body: ['#4468e0', '#2c47a6'], robe: true, beard: '#e8e8f0', legs: ['#4468e0', '#2c47a6'], boots: ['#3a2a1a', '#2a1e12'] },
    cleric: { head: 'hood', hood: ['#f4efe0', '#c9c0a8'], body: ['#f4efe0', '#c9c0a8'], robe: true, band: '#ffd84a', cross: '#ffd84a', halo: '#fff3a8', legs: ['#f4efe0', '#c9c0a8'], boots: ['#8a6a3a', '#6a4e28'] },
    rogue: { head: 'hood', hood: ['#4a4a62', '#33334a'], mask: '#2d2430', body: ['#5a5a74', '#3f3f56'], strap: '#2d2430', legs: ['#2d2430', '#1f1a24'], boots: ['#1f1a24', '#141018'] },
  };

  // ---------- Item colours, sampled from the item's own sprite ----------
  const colCache = {};
  const dist = (a, b) => { const x = G.hexToRgb(a), y = G.hexToRgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
  // the sprite a piece of gear is drawn with: uniques have their own
  G.gearSpr = g => (g.q ? 'u_' + g.q : 'it_' + g.id);
  const ik = g => G.gearSpr(g);
  function itemCols(id) {
    if (colCache[id]) return colCache[id];
    const out = { main: '#9a9aa8', dark: '#6e6e7c', acc: '#ffd84a' };
    try {
      const c = SPR.get(id.indexOf('_') > 0 && SPR.defs[id] ? id : 'it_' + id);
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      const n = {};
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 128) continue;
        const l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
        if (l < 0.14) continue; // outline and deep shadow
        const hex = G.rgbToHex(d[i], d[i + 1], d[i + 2]);
        n[hex] = (n[hex] || 0) + 1;
      }
      const list = Object.keys(n).sort((a, b) => n[b] - n[a]);
      if (list[0]) { out.main = list[0]; out.dark = G.shade(list[0], -0.32); }
      const far = list.find(h => dist(h, out.main) > 110);
      if (far) out.acc = far;
    } catch (e) { /* keep the defaults */ }
    colCache[id] = out;
    return out;
  }
  Doll.itemCols = itemCols;

  const type = g => g ? G.ITEM_TYPE[g.id] : null;
  function gearKey(h) {
    return h.cls + '|' + G.SLOTS.map(s => h.eq[s] ? h.eq[s].id + ':' + h.eq[s].r + (h.eq[s].q || '') : '-').join(',');
  }

  // ---------- One frame of the body ----------
  // legs: 0..3 walk frame (0 and 2 stand), pose: rest | up | fwd, bob: 0/1 breathing
  function build(h, legs, pose, bob) {
    const look = LOOK[h.cls] || LOOK.knight;
    const eq = h.eq;
    const c = SPR.makeCanvas(FW, FH), x = c.getContext('2d');
    const px = (X, Y, w, hh, col) => { x.fillStyle = col; x.fillRect(X, Y, w, hh); };
    const O = 2; // top margin so hats and plumes fit
    const walkUp = legs === 1 || legs === 3 ? -1 : 0;
    const u = O + bob + walkUp; // upper body offset
    const armour = type(eq.armor);
    const body = armour === 'armor' ? itemCols(ik(eq.armor)) : null;
    const bodyMain = body ? body.main : look.body[0], bodyDark = body ? body.dark : look.body[1];
    const bootCols = armour === 'boot' ? itemCols(ik(eq.armor)) : null;
    const ring = type(eq.ring), abil = type(eq.ability);

    // --- behind the body ---
    if (armour === 'cloak') {
      const k = itemCols(ik(eq.armor));
      px(8, 12 + u, 10, 8 - bob - walkUp, k.dark);
      px(7, 14 + u, 12, 6 - bob - walkUp, k.dark);
      const sway = legs % 2 ? 1 : 0;
      px(7 + sway, 20 + O, 12, 1, k.main);
      px(8, 12 + u, 1, 8, k.main); px(17, 12 + u, 1, 8, k.main);
    }
    if (look.quiver) {
      px(16, 8 + u, 2, 6, '#7a4a22'); px(17, 8 + u, 1, 6, '#5a3418');
      px(16, 7 + u, 1, 1, '#f0ead8'); px(17, 6 + u, 1, 1, '#f0ead8'); px(18, 7 + u, 1, 1, '#e84a4a');
    }
    if (abil === 'scroll') {
      const k = itemCols(ik(eq.ability));
      px(7, 8 + u, 2, 5, k.main); px(7, 8 + u, 2, 1, k.dark); px(7, 12 + u, 2, 1, k.dark);
    }

    // --- legs and boots ---
    const legTop = 17 + u - O + O; // right under the belt
    const bootsC = bootCols ? [bootCols.main, bootCols.dark] : look.boots;
    const leg = (lx, lift) => {
      const top = legTop, bottom = FEET - 2 - lift;
      px(lx, top, 2, Math.max(1, bottom - top + 1), look.legs[0]);
      px(lx + 1, top, 1, Math.max(1, bottom - top + 1), look.legs[1]);
    };
    const boot = (bx, lift, out) => {
      const y = FEET - 1 - lift;
      px(bx, y, 3, 2, bootsC[0]); px(out ? bx + 2 : bx, y + 1, 1, 1, bootsC[1]);
      if (bootCols) px(bx, y, 3, 1, G.shade(bootsC[0], 0.25));
    };
    const liftL = legs === 1 ? 1 : 0, liftR = legs === 3 ? 1 : 0;
    if (look.robe) {
      // a robe hides the legs; only the boot tips peek out
      for (let r = legTop; r <= FEET - 1; r++) {
        const wdt = 8 + Math.floor((r - legTop) / 2);
        px(13 - Math.ceil(wdt / 2), r, wdt, 1, bodyMain);
        px(13 - Math.ceil(wdt / 2) + wdt - 1, r, 1, 1, bodyDark);
      }
      px(9, FEET - 1, 8, 1, look.band);
      px(9, FEET, 3, 1, bootsC[0]); px(14, FEET, 3, 1, bootsC[0]);
    } else {
      leg(10, liftL); leg(14, liftR);
      boot(9, liftL, false); boot(14, liftR, true);
    }

    // --- torso ---
    px(9, 12 + u, 8, 4, bodyMain);
    px(16, 12 + u, 1, 4, bodyDark);
    px(9, 12 + u, 1, 4, G.shade(bodyMain, 0.18));
    if (!body && look.tabard) px(12, 12 + u, 2, 4, look.tabard);
    if (!body && look.cross) { px(12, 12 + u, 2, 4, look.cross); px(11, 13 + u, 4, 1, look.cross); }
    if (!body && look.collar) px(9, 12 + u, 8, 1, look.collar);
    if (!body && look.strap) { [[10, 12], [11, 13], [12, 13], [13, 14], [14, 14], [15, 15]].forEach(([a, b]) => px(a, b + u - O + O, 1, 1, look.strap)); }
    if (body) { // plate: shoulder pads and a trim in the item's accent
      px(9, 12 + u, 8, 1, G.shade(bodyMain, 0.3));
      if (eq.armor.r >= 2) px(12, 13 + u, 2, 2, body.acc);
    }
    px(9, 16 + u, 8, 1, look.robe ? look.band : '#4a3222');
    px(12, 16 + u, 2, 1, look.robe ? G.shade(look.band, -0.3) : '#ffd84a');

    // --- arms ---
    const sleeve = bodyMain, sleeveD = bodyDark, hand = look.hands || SKIN;
    px(7, 12 + u, 2, 3, sleeve); px(7, 12 + u, 1, 3, G.shade(sleeve, 0.15)); px(7, 15 + u, 2, 1, hand);
    let hx, hy;
    if (pose === 'up') {
      px(17, 12 + u, 2, 1, sleeve); px(17, 9 + u, 2, 3, sleeve); px(18, 9 + u, 1, 3, sleeveD); px(17, 8 + u, 2, 1, hand);
      hx = 18; hy = 8 + u;
    } else if (pose === 'fwd') {
      px(17, 12 + u, 1, 2, sleeve); px(18, 12 + u, 2, 2, sleeve); px(18, 13 + u, 2, 1, sleeveD); px(20, 12 + u, 1, 2, hand);
      hx = 20; hy = 13 + u;
    } else {
      px(17, 12 + u, 2, 3, sleeve); px(18, 12 + u, 1, 3, sleeveD); px(17, 15 + u, 2, 1, hand);
      hx = 18; hy = 15 + u;
    }
    if (armour === 'shield') { // on the off arm, in front
      const k = itemCols(ik(eq.armor));
      px(4, 12 + u, 5, 6, k.dark); px(5, 12 + u, 3, 5, k.main); px(5, 17 + u, 3, 1, k.dark);
      px(4, 12 + u, 5, 1, G.shade(k.dark, 0.2)); px(6, 14 + u, 1, 2, k.acc); px(5, 14 + u, 3, 1, k.acc);
    }
    if (abil === 'potion') { const k = itemCols(ik(eq.ability)); px(15, 16 + u, 2, 2, k.main); px(15, 15 + u, 1, 1, '#8a5a2e'); }

    // --- head ---
    const hcol = armour === 'helm' ? itemCols(ik(eq.armor)) : null;
    const headKind = hcol ? 'helm' : look.head;
    px(9, 6 + u, 8, 6, SKIN); px(16, 6 + u, 1, 6, SKIN_S);
    px(11, 9 + u, 1, 1, EYE); px(14, 9 + u, 1, 1, EYE);
    let top = 5 + u;
    if (headKind === 'helm') {
      const m = hcol ? hcol.main : look.helm[0], d = hcol ? hcol.dark : look.helm[1];
      px(9, 5 + u, 8, 7, m); px(10, 4 + u, 6, 1, m); px(16, 5 + u, 1, 7, d);
      px(10, 9 + u, 6, 1, hcol ? hcol.acc : look.visor);
      px(9, 11 + u, 8, 1, d);
      top = 4 + u;
      if (!hcol && look.plume) { px(12, 1 + u, 2, 3, look.plume); px(13, 1 + u, 1, 3, G.shade(look.plume, -0.3)); top = 1 + u; }
      if (hcol && /demon|horn/.test(eq.armor.id)) { px(7, 2 + u, 1, 3, '#e8e4d8'); px(8, 4 + u, 1, 2, '#e8e4d8'); px(18, 2 + u, 1, 3, '#e8e4d8'); px(17, 4 + u, 1, 2, '#e8e4d8'); top = 2 + u; }
    } else if (headKind === 'hood') {
      const [m, d] = look.hood;
      px(9, 5 + u, 8, 3, m); px(10, 4 + u, 6, 1, m); px(9, 8 + u, 1, 4, m); px(16, 5 + u, 1, 7, d); px(10, 7 + u, 6, 1, d);
      if (look.mask) px(10, 10 + u, 6, 2, look.mask);
      top = 4 + u;
    } else if (headKind === 'hat') {
      const [m, d] = look.hat;
      px(7, 6 + u, 12, 1, d); px(10, 5 + u, 6, 1, look.band);
      px(10, 4 + u, 6, 1, m); px(11, 3 + u, 4, 1, m); px(12, 2 + u, 3, 1, m); px(13, 1 + u, 2, 1, m); px(14, 0 + u, 2, 1, d);
      px(15, 3 + u, 1, 2, d);
      top = 0 + u;
    }
    if (look.halo && !hcol) { px(10, top - 2, 6, 1, look.halo); px(9, top - 1, 1, 1, look.halo); px(16, top - 1, 1, 1, look.halo); top -= 2; }
    if (look.beard && !hcol) { px(11, 10 + u, 4, 3, look.beard); px(12, 13 + u, 2, 1, look.beard); }

    // --- worn jewellery ---
    if (ring === 'crown') {
      const k = itemCols(ik(eq.ring)), y = Math.max(0, top - 2);
      px(10, y + 1, 6, 1, k.main); px(10, y, 1, 1, k.main); px(12, y, 2, 1, k.main); px(15, y, 1, 1, k.main); px(12, y + 1, 2, 1, k.acc);
    }
    if (ring === 'amulet') { const k = itemCols(ik(eq.ring)); px(11, 12 + u, 1, 1, k.dark); px(14, 12 + u, 1, 1, k.dark); px(12, 13 + u, 2, 2, k.acc); }
    if (ring === 'heart') { const k = itemCols(ik(eq.ring)); px(11, 13 + u, 1, 1, k.main); px(13, 13 + u, 1, 1, k.main); px(11, 14 + u, 3, 1, k.main); px(12, 15 + u, 1, 1, k.main); }
    if (ring === 'button') { const k = itemCols(ik(eq.ring)); px(12, 13 + u, 2, 2, k.main); px(12, 13 + u, 1, 1, '#ffffff'); }

    outline(x, FW, FH);
    return { canvas: c, hx, hy, top, sh: 12 + u };
  }
  function outline(ctx, w, h) {
    const img = ctx.getImageData(0, 0, w, h), a = img.data;
    const solid = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) solid[i] = a[i * 4 + 3] > 0 ? 1 : 0;
    const [r, g, b] = G.hexToRgb(OUT);
    for (let y = 0; y < h; y++) for (let X = 0; X < w; X++) {
      const i = y * w + X;
      if (solid[i]) continue;
      if ((X > 0 && solid[i - 1]) || (X < w - 1 && solid[i + 1]) || (y > 0 && solid[i - w]) || (y < h - 1 && solid[i + w])) {
        a[i * 4] = r; a[i * 4 + 1] = g; a[i * 4 + 2] = b; a[i * 4 + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  let cacheKey = '', cache = new Map();
  function frame(h, legs, pose, bob) {
    const gk = gearKey(h);
    if (gk !== cacheKey) { cacheKey = gk; cache = new Map(); }
    const k = legs + pose + bob;
    let f = cache.get(k);
    if (!f) { f = build(h, legs, pose, bob); cache.set(k, f); }
    return f;
  }
  Doll.frame = frame;

  // ---------- Weapons ----------
  // Item sprites point up-right (-45°) with the grip bottom-left; bows stand upright.
  const GRIP = { x: 2, y: 8 };
  const REST = { dagger: -0.5, sword: -1.1, katana: -1.1, scythe: -1.25, staff: -1.4, wand: -1.2, bow: 0 };
  Doll.restAngle = t => REST[t] != null ? REST[t] : -1;
  const snap = a => Math.round(a / (Math.PI / 8)) * (Math.PI / 8);
  function drawWeapon(ctx, g, hx, hy, face, ang, draw) {
    const spr = SPR.get(G.gearSpr(g));
    if (!spr) return;
    const t = G.ITEM_TYPE[g.id];
    ctx.save();
    ctx.translate(Math.round(hx), Math.round(hy));
    if (t === 'bow') {
      // the bow's belly faces away from the Warden; the string pulls back while drawing
      ctx.scale(-face, 1);
      ctx.drawImage(spr, -5, -6);
      if (draw > 0) {
        const pull = Math.round(draw * 3);
        ctx.fillStyle = '#f0ead8'; ctx.fillRect(-2 + pull, -1, 1, 3);
        ctx.fillStyle = '#c8a870'; ctx.fillRect(-7 + pull, 0, 7, 1);
        ctx.fillStyle = '#e6ebf2'; ctx.fillRect(-8 + pull, 0, 1, 1);
      }
    } else {
      ctx.scale(face, 1);
      ctx.rotate(snap(ang) + Math.PI / 4);
      ctx.drawImage(spr, -GRIP.x, -GRIP.y);
    }
    ctx.restore();
  }
  Doll.drawWeapon = drawWeapon;
  // Where the tip of a held weapon is, for cast flashes
  Doll.tip = function (g, hx, hy, face, ang) {
    const len = G.ITEM_TYPE[g.id] === 'wand' ? 8 : 10;
    const a = snap(ang);
    return { x: hx + face * Math.cos(a) * len, y: hy + Math.sin(a) * len };
  };

  // ---------- The whole Warden at (x, y) = point between the feet ----------
  // o: { face, legs, pose, bob, ang, draw, time, alpha }
  Doll.draw = function (ctx, h, x, y, o) {
    const f = frame(h, o.legs || 0, o.pose || 'rest', o.bob || 0);
    const face = o.face < 0 ? -1 : 1, t = o.time || 0;
    const ox = Math.round(x - FW / 2), oy = Math.round(y - FEET);
    const ab = type(h.eq.ability), rg = type(h.eq.ring);
    // wings behind everything
    if (ab === 'wing') {
      const w = SPR.get(G.gearSpr(h.eq.ability)), flap = Math.round((Math.sin(t * 6) + 1) * 1.2);
      const wy = oy + f.sh - 9 + flap;
      ctx.drawImage(w, ox + FW / 2 + 1, wy);
      ctx.save(); ctx.translate(ox + FW / 2 - 1, 0); ctx.scale(-1, 1); ctx.drawImage(w, 0, wy); ctx.restore();
    }
    const hx = face > 0 ? ox + f.hx + 0.5 : ox + FW - f.hx - 0.5, hy = oy + f.hy + 0.5;
    const wpn = h.eq.weapon;
    if (face > 0) ctx.drawImage(f.canvas, ox, oy);
    else { ctx.save(); ctx.translate(ox + FW, oy); ctx.scale(-1, 1); ctx.drawImage(f.canvas, 0, 0); ctx.restore(); }
    if (wpn) drawWeapon(ctx, wpn, hx, hy, face, o.ang, o.draw);
    if (rg === 'halo') {
      const k = itemCols(ik(h.eq.ring)), hy2 = oy + f.top - 2 + Math.round(Math.sin(t * 3));
      ctx.fillStyle = OUT; ctx.fillRect(ox + 9, hy2 - 1, 8, 3);
      ctx.fillStyle = k.main; ctx.fillRect(ox + 10, hy2, 6, 1);
    }
    if (rg === 'ring' && (t * 1.3) % 1 < 0.12) { ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(hx), Math.round(hy) - 1, 1, 3); ctx.fillRect(Math.round(hx) - 1, Math.round(hy), 3, 1); }
    // a tome, orb, skull or egg floats at the Warden's shoulder
    if (ab === 'tome' || ab === 'orb' || ab === 'skull' || ab === 'egg') {
      const s = SPR.get(G.gearSpr(h.eq.ability));
      const fx = Math.round(x - face * 15 + Math.cos(t * 1.7) * 2 - s.width / 2), fy = Math.round(oy + f.sh - 8 + Math.sin(t * 2.3) * 2);
      ctx.drawImage(s, fx, fy);
    }
    return { hx, hy, top: oy + f.top };
  };

  // A still portrait (the Character tab, ladder rows). tight drops the margin
  // that floating tomes and wings need.
  const urls = new Map();
  Doll.portrait = function (h, scale, tight) {
    const key = gearKey(h) + '@' + scale + (tight ? 't' : '');
    if (urls.has(key)) return urls.get(key);
    const w = tight ? FW : FW + 12, hh = tight ? FH - 1 : FH + 4;
    const c = SPR.makeCanvas(w, hh), x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    Doll.draw(x, h, w / 2, FEET + (tight ? 0 : 2), { face: 1, pose: 'rest', ang: h.eq.weapon ? Doll.restAngle(G.ITEM_TYPE[h.eq.weapon.id]) : 0, time: 0.4 });
    const u = SPR.url(c, scale || 5);
    if (urls.size > 400) urls.clear();
    urls.set(key, u);
    return u;
  };
  // Someone else's Warden from a ladder snapshot; unknown items are left off
  Doll.fromSnapshot = function (snap) {
    const eq = {};
    for (const s of G.SLOTS) { const g = snap.gear && snap.gear[s]; eq[s] = g && G.ITEM_BY_ID[g.id] && G.slotOf(g.id) === s ? { id: g.id, r: g.r | 0, q: g.q && G.UNIQUES[g.q] ? g.q : undefined } : null; }
    return { cls: G.CLASS_BY_ID[snap.cls] ? snap.cls : 'knight', eq, lvl: snap.lvl | 0 };
  };
})(globalThis.G = globalThis.G || {});
