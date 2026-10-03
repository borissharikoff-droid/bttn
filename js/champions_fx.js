// BTTN 3.3 — champions_fx: the show for the Land Champions (js/champions.js).
// An overlay canvas of its own over the stage (under the HUD) for the champion's marks:
// a pulsing ring at its feet, a crown, its name, health and time over it, and what its
// rule looks like (the shield, the burrow, the stolen gold, the rage, the decoys, the
// fuse, the summoning circle). A card at the top of the field when it comes, when it
// falls and when it gets away, and a few notes from its own little WebAudio voice.
// Browser only; the stage's flash and shake are borrowed through G.Stage.
(function (G) {
  'use strict';
  if (typeof document === 'undefined' || !G.CHAMPS) return;
  const R = G.R;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const T = function (k, def) {
    let s = (G.STR && G.STR[k]) || def;
    for (let i = 2; i < arguments.length; i++) s = s.replace('{' + (i - 2) + '}', arguments[i]);
    return s;
  };
  const fmt = v => (G.fmt ? G.fmt(v) : String(Math.round(v)));
  const FONT = '"Press Start 2P", "BTTN Body", monospace';
  const BODY = '"BTTN Body", "Press Start 2P", monospace';
  const St = () => G.Stage || null;

  // ================= Styles =================
  const css = `
#champFx { position: absolute; left: 0; top: 0; width: 100%; height: 100%; max-width: none; pointer-events: none; }
#champCard { position: absolute; left: 50%; top: 13%; transform: translateX(-50%); z-index: 4; pointer-events: none;
  width: max-content; max-width: min(92%, 480px); text-align: center; }
#champCard .chBox { --c: #ffd84a; padding: 9px 16px 10px; background: rgba(10, 9, 16, .86); border: 2px solid #0a0910;
  box-shadow: inset 0 0 0 2px var(--c), 0 0 22px -4px var(--c), 0 3px 0 #0a0910; animation: chIn .45s cubic-bezier(.2, 1.6, .4, 1); }
#champCard.out .chBox { animation: chOut .35s ease-in forwards; }
#champCard .chTag { font: 8px/1.4 ${FONT}; letter-spacing: .14em; color: #ffd84a; opacity: .9; }
#champCard .chName { margin: 5px 0 4px; font: 14px/1.35 ${FONT}; color: var(--c); text-shadow: 2px 2px 0 #0a0910; letter-spacing: .04em; }
#champCard .chSub { font: 15px/1.25 ${BODY}; color: #f1ece0; text-shadow: 1px 1px 0 #0a0910; }
#champCard .chSub b { color: var(--c); font-weight: 700; letter-spacing: .03em; }
#champCard.big .chName { font-size: 16px; }
#champCard.dim .chBox { box-shadow: inset 0 0 0 2px #6d6784, 0 3px 0 #0a0910; }
@keyframes chIn { from { transform: scale(.4) translateY(-14px); opacity: 0; } }
@keyframes chOut { to { transform: translateY(-10px); opacity: 0; } }
@media (max-width: 860px) {
  #champCard { top: 11%; }
  #champCard .chBox { padding: 7px 10px 8px; }
  #champCard .chName { font-size: 11px; }
  #champCard.big .chName { font-size: 12px; }
  #champCard .chSub { font-size: 13px; }
}
`;
  const st = document.createElement('style');
  st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  // ================= Sound =================
  const Snd = {
    ac: null,
    on() { const s = G.S && G.S.set; return !!(s && s.sound && !(s.vol <= 0)); },
    ctx() {
      if (!this.on()) return null;
      if (!this.ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try { this.ac = new AC(); } catch (e) { return null; }
      }
      if (this.ac.state === 'suspended') { try { this.ac.resume(); } catch (e) { /* not yet allowed */ } }
      return this.ac;
    },
    vol() { return Math.min(1, G.S.set.vol == null ? 0.6 : G.S.set.vol) * 0.32; },
  };
  let noiseBuf = null;
  function tone(type, f0, f1, t, dur, v) {
    const ac = Snd.ctx(); if (!ac) return;
    const T0 = ac.currentTime + 0.02 + t, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, T0);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, T0 + dur);
    g.gain.setValueAtTime(0.0001, T0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v * Snd.vol()), T0 + Math.min(0.03, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, T0 + dur);
    o.connect(g); g.connect(ac.destination); o.start(T0); o.stop(T0 + dur + 0.05);
  }
  function noise(t, dur, v, f0, f1) {
    const ac = Snd.ctx(); if (!ac) return;
    if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const T0 = ac.currentTime + 0.02 + t, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; s.loop = true; f.type = 'lowpass'; f.frequency.setValueAtTime(f0 || 2000, T0);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, T0 + dur);
    g.gain.setValueAtTime(Math.max(0.0002, v * Snd.vol()), T0); g.gain.exponentialRampToValueAtTime(0.0001, T0 + dur);
    s.connect(f); f.connect(g); g.connect(ac.destination); s.start(T0); s.stop(T0 + dur + 0.05);
  }
  const SFX = {
    // two drum hits and a rising horn
    enter() { noise(0, 0.22, 0.9, 400, 80); noise(0.2, 0.3, 1, 380, 70); tone('sawtooth', 110, 110, 0.38, 0.5, 0.35); tone('sawtooth', 165, 220, 0.5, 0.55, 0.3); tone('square', 220, 330, 0.62, 0.45, 0.16); },
    kill() { [523, 659, 784, 1047].forEach((f, i) => tone('square', f, f, i * 0.08, 0.22, 0.22)); tone('triangle', 1568, 2093, 0.34, 0.5, 0.25); noise(0, 0.25, 0.4, 3000, 600); },
    escape() { [392, 330, 262].forEach((f, i) => tone('triangle', f, f * 0.94, i * 0.12, 0.25, 0.25)); noise(0, 0.4, 0.25, 1200, 200); },
    boom() { noise(0, 0.9, 1.4, 1800, 60); tone('sine', 90, 30, 0, 0.8, 0.9); },
    shield() { noise(0, 0.12, 0.5, 6000, 1500); tone('square', 880, 1320, 0, 0.12, 0.12); },
    crack() { noise(0, 0.05, 0.25, 5000, 2500); },
    dive() { noise(0, 0.5, 0.5, 600, 90); },
    steal() { tone('square', 1320, 990, 0, 0.07, 0.07); },
    rage() { tone('sawtooth', 80, 160, 0, 0.6, 0.35); noise(0, 0.5, 0.4, 900, 200); },
    summon() { tone('triangle', 220, 440, 0, 0.35, 0.15); tone('triangle', 277, 554, 0.05, 0.35, 0.12); },
    decoy() { [660, 880, 990].forEach((f, i) => tone('sine', f, f * 1.5, i * 0.05, 0.25, 0.12)); },
    pop() { tone('square', 990, 330, 0, 0.12, 0.12); },
    split() { noise(0, 0.25, 0.6, 3000, 400); tone('square', 330, 165, 0, 0.25, 0.2); },
  };
  let stealSnd = 0;

  // ================= Layers =================
  let cv = null, ctx = null, card = null, cardT = null, W = 0, H = 0, DPR = 1, rect = null;
  function ensure() {
    if (cv && cv.isConnected) return true;
    const stage = document.getElementById('stage'), wrap = document.getElementById('stageWrap');
    if (!stage || !wrap) return false;
    cv = document.createElement('canvas'); cv.id = 'champFx';
    stage.insertAdjacentElement('afterend', cv);
    ctx = cv.getContext('2d');
    card = document.createElement('div'); card.id = 'champCard'; card.hidden = true;
    wrap.appendChild(card);
    return true;
  }
  function resize() {
    const r = cv.getBoundingClientRect();
    rect = r;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (Math.round(r.width * dpr) !== cv.width || Math.round(r.height * dpr) !== cv.height || dpr !== DPR) {
      DPR = dpr; cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    }
    W = r.width; H = r.height;
  }
  // the card at the top of the field: one at a time, the newest wins
  function showCard(o) {
    if (!ensure()) return;
    clearTimeout(cardT);
    card.className = (o.big ? 'big' : '') + (o.dim ? ' dim' : '');
    card.innerHTML = '';
    const box = document.createElement('div'); box.className = 'chBox'; box.style.setProperty('--c', o.col || '#ffd84a');
    const tag = document.createElement('div'); tag.className = 'chTag'; tag.textContent = o.tag || '';
    const nm = document.createElement('div'); nm.className = 'chName'; nm.textContent = o.name || '';
    box.appendChild(tag); box.appendChild(nm);
    if (o.sub || o.subB) {
      const sub = document.createElement('div'); sub.className = 'chSub';
      if (o.subB) { const b = document.createElement('b'); b.textContent = o.subB; sub.appendChild(b); if (o.sub) sub.appendChild(document.createTextNode(' · ' + o.sub)); }
      else sub.textContent = o.sub;
      box.appendChild(sub);
    }
    card.appendChild(box);
    card.hidden = false;
    cardT = setTimeout(() => { card.classList.add('out'); cardT = setTimeout(() => { card.hidden = true; }, 380); }, o.ms || 2800);
  }

  // ================= Where things are =================
  // the stage's pixel scale and a mob's feet, in overlay pixels
  function px() { const s = St(); if (!s || !s.toScreen) return 3; const a = s.toScreen(0, 0), b = s.toScreen(1, 0); return Math.max(1, b.x - a.x); }
  function feetOf(m, u) {
    const s = St(); if (!s || !s.mobPoint || !rect) return null;
    const q = s.mobPoint(m);
    return { x: q.x - rect.left, y: q.y - rect.top + 18 * u };
  }
  const realmNow = () => G.REALMS[G.realmIndex(G.depthNow ? G.depthNow() : G.S.depth)];
  function sprH(scale) {
    try { const c = G.SPR && G.SPR.get(realmNow().minion); return (c ? c.height : 16) * scale; } catch (e) { return 16 * scale; }
  }
  function btnBox(u) {
    const s = St(); if (!s || !s.buttonPoint || !rect) return null;
    const b = s.buttonPoint(); // 24 pixels over the Button's centre
    const cx = b.x - rect.left, cy = b.y - rect.top + 24 * u;
    return { x0: cx - 24 * u, x1: cx + 24 * u, y0: cy - 34 * u, y1: cy + 14 * u, cx, cy };
  }
  const overlaps = (a, b) => a && b && a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

  // ================= Particles =================
  const parts = [], rings = [], flyers = [], floats = [];
  function burst(x, y, cols, n, sp, o) {
    for (let i = 0; i < n && parts.length < 400; i++) {
      const a = Math.random() * Math.PI * 2, s = rnd(sp * 0.35, sp);
      parts.push(Object.assign({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - sp * 0.3, life: rnd(0.4, 0.9), max: 1, col: cols[i % cols.length], sz: 2, grav: 220 }, o || {}));
      parts[parts.length - 1].max = parts[parts.length - 1].life;
    }
  }
  function ring(x, y, r0, r1, col, life, w) { rings.push({ x, y, r0, r1, col, life, max: life, w: w || 2 }); }
  function floatText(x, y, str, col, size, life) { floats.push({ x, y, str, col, size, life: life || 1.1, max: life || 1.1 }); }
  // last known spots, for the show after it's gone
  const spotOf = at => ({ id: -7, a: at.a, p: at.p });

  // ================= The marks =================
  // a little pixel crown, 7x5
  const CROWN = ['y.y.y.y', 'yyyyyyy', 'yrybyry', 'yyyyyyy', 'YYYYYYY'];
  const CROWN_COL = { y: '#ffd84a', Y: '#c99a2a', r: '#ff4f6a', b: '#5ae8ff' };
  function crown(x, y, u) {
    const w = CROWN[0].length, h = CROWN.length, s = Math.max(1, Math.round(u));
    const ox = Math.round(x - w * s / 2), oy = Math.round(y - h * s);
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      const k = CROWN[r][c]; if (k === '.') continue;
      ctx.fillStyle = '#0a0910'; ctx.fillRect(ox + c * s - 1, oy + r * s - 1, s + 2, s + 2);
    }
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      const k = CROWN[r][c]; if (k === '.') continue;
      ctx.fillStyle = CROWN_COL[k]; ctx.fillRect(ox + c * s, oy + r * s, s, s);
    }
  }
  function bar(x, y, w, h, k, col, back) {
    ctx.fillStyle = '#0a0910'; ctx.fillRect(Math.round(x - w / 2) - 1, Math.round(y) - 1, Math.round(w) + 2, Math.round(h) + 2);
    ctx.fillStyle = back || '#2a2440'; ctx.fillRect(Math.round(x - w / 2), Math.round(y), Math.round(w), Math.round(h));
    ctx.fillStyle = col; ctx.fillRect(Math.round(x - w / 2), Math.round(y), Math.max(1, Math.round(w * clamp(k, 0, 1))), Math.round(h));
  }
  function label(str, x, y, size, col) {
    ctx.font = size + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.lineWidth = Math.max(2, size * 0.35); ctx.strokeStyle = '#0a0910'; ctx.lineJoin = 'round';
    ctx.strokeText(str, x, y); ctx.fillStyle = col; ctx.fillText(str, x, y);
  }
  function ellipse(x, y, rx, ry, col, a, w, fill) {
    ctx.globalAlpha = a; ctx.beginPath(); ctx.ellipse(x, y, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = col; ctx.fill(); } else { ctx.strokeStyle = col; ctx.lineWidth = w || 2; ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  function glow(x, y, r, col, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1;
  }
  // an arrow at the edge of the field towards one still off it
  function edgeArrow(f, col, t) {
    const cx = W / 2, cy = H * 0.54, dx = f.x - cx, dy = f.y - cy, pad = 26;
    const k = Math.min((W / 2 - pad) / Math.max(1, Math.abs(dx)), (H / 2 - pad) / Math.max(1, Math.abs(dy)));
    const x = cx + dx * Math.min(1, k), y = clamp(cy + dy * Math.min(1, k), 70, H - 90), a = Math.atan2(dy, dx);
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(t * 8);
    ctx.fillStyle = '#0a0910'; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -11); ctx.lineTo(-8, 11); ctx.closePath(); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-5, -7); ctx.lineTo(-5, 7); ctx.closePath(); ctx.fill();
    ctx.restore(); ctx.globalAlpha = 1;
  }

  // one champion-shaped thing on the field: its ring, its crown, its bar
  function drawBody(c, m, u, t, o) {
    const f = feetOf(m, u);
    if (!f) return null;
    const sc = o.kid ? 1 : 2.2, h = sprH(sc) * u;
    const off = f.x < -10 || f.x > W + 10 || f.y < -10 || f.y > H + 30;
    if (off) { if (!o.kid && !o.decoy) edgeArrow(f, c.col, t); return null; }
    const pulse = 0.5 + 0.5 * Math.sin(t * 5 + (m.id || 0));
    // the ring at its feet, and one rippling out
    const rx = (o.kid ? 7 : 14) * u, ry = (o.kid ? 2.6 : 5) * u;
    ellipse(f.x, f.y, rx, ry, c.col, 0.35 + 0.35 * pulse, Math.max(2, u * 0.9));
    const rp = (t * 0.8 + (m.id || 0) * 0.13) % 1;
    ellipse(f.x, f.y, rx * (1 + rp * 0.7), ry * (1 + rp * 0.7), c.col, 0.5 * (1 - rp), Math.max(1, u * 0.6));
    const top = f.y - h;
    // the crown bobs over its head
    crown(f.x, top - 2 * u + Math.sin(t * 3.2 + (m.id || 0)) * u, Math.max(1, u * (o.kid ? 0.6 : 0.9)));
    return { f, top, h };
  }
  function drawPlate(c, x, y, u, t, kHp, below) {
    // name, health, time; laid out upward from y (or downward if it would sit on the Button)
    const bw = clamp(46 * u, 64, 132), size = Math.round(clamp(u * 2.8, 8, 11));
    const hpH = Math.max(3, Math.round(u * 1.4)), tH = Math.max(2, Math.round(u * 0.7));
    const tot = size + 4 + hpH + 2 + tH;
    let y0 = below ? y + 4 : y - tot - 4; // top of the name line
    y0 = clamp(y0, 4, H - tot - 4);
    const x0 = clamp(x, bw / 2 + 4, W - bw / 2 - 4);
    label(c.name, x0, y0 + size, size, c.col);
    bar(x0, y0 + size + 3, bw, hpH, kHp, kHp > 0.3 ? '#ff4f5e' : '#ff2a2a');
    const tk = clamp(c.t / c.T, 0, 1);
    bar(x0, y0 + size + 3 + hpH + 2, bw, tH, tk, tk > 0.3 ? '#f1ece0' : (Math.sin(t * 10) > 0 ? '#ff7a2e' : '#ffd84a'), '#1d1b26');
    return { x0: x0 - bw / 2, x1: x0 + bw / 2, y0, y1: y0 + tot, x: x0, yb: y0 + tot };
  }

  // the mechanics' own looks
  function drawMech(c, b, u, t) {
    const m = c.m, f = b.f, mid = f.y - b.h * 0.5;
    if (c.mech === 'shield') {
      if (c.sh > 0) {
        const hit = c._hitT > 0 ? c._hitT : 0;
        ellipse(f.x, mid, 13 * u, b.h * 0.62, '#8fc8ff', 0.12 + hit * 0.3, 0, true);
        ellipse(f.x, mid, 13 * u, b.h * 0.62, hit > 0 ? '#ffffff' : '#8fc8ff', 0.55 + 0.2 * Math.sin(t * 6), Math.max(2, u));
        // its pips, under the feet
        const n = c.shMax, pw = Math.max(2, Math.round(u * 1.2)), gap = Math.max(1, Math.round(u * 0.5)), tw = n * pw + (n - 1) * gap;
        for (let i = 0; i < n; i++) { ctx.fillStyle = '#0a0910'; ctx.fillRect(f.x - tw / 2 + i * (pw + gap) - 1, f.y + 4 * u - 1, pw + 2, pw + 2); ctx.fillStyle = i < c.sh ? '#8fc8ff' : '#2a2440'; ctx.fillRect(f.x - tw / 2 + i * (pw + gap), f.y + 4 * u, pw, pw); }
      } else if (c.exp > 0) {
        glow(f.x, mid, 18 * u, 'rgba(255,122,46,0.9)', 0.25 + 0.15 * Math.sin(t * 12));
        if (Math.random() < 0.3) burst(f.x + rnd(-8, 8) * u, mid + rnd(-8, 8) * u, ['#8fc8ff', '#ffffff'], 1, 30, { grav: 80, life: 0.4 });
      }
    } else if (c.mech === 'berserker') {
      const k = 1 - clamp(m.hp / m.max, 0, 1);
      glow(f.x, mid, (14 + 10 * k) * u, 'rgba(255,40,40,0.95)', 0.1 + 0.4 * k + 0.08 * Math.sin(t * (6 + 10 * k)));
      if (Math.random() < 0.1 + 0.5 * k) burst(f.x + rnd(-8, 8) * u, b.top + rnd(0, 6) * u, ['#ff4f4f', '#ffb0a0', '#ffffff'], 1, 20, { grav: -40, vy: -30, life: 0.5 });
    } else if (c.mech === 'thief') {
      if (c.stolen > 0) label('-' + fmt(c.stolen), f.x, f.y + 6 * u + 9, Math.round(clamp(u * 2.4, 7, 10)), '#ffd84a');
      if (c.flee) { for (let i = 0; i < 3; i++) { ctx.fillStyle = 'rgba(241,236,224,.6)'; const yy = mid + (i - 1) * 4 * u, ln = rnd(6, 14) * u; ctx.fillRect(f.x + 10 * u, yy, ln, Math.max(1, u * 0.5)); } }
      if (Math.random() < 0.25) burst(f.x + rnd(-5, 5) * u, mid, ['#ffd84a', '#fff3a0'], 1, 30, { grav: 160, life: 0.45, sz: Math.max(2, u) });
    } else if (c.mech === 'bomb') {
      // the fuse fizzes over its head, faster as it closes in; a red line marks how far it has to go
      const k = clamp(m.p, 0, 1);
      if (Math.random() < 0.5 + k * 0.5) burst(f.x + 3 * u, b.top - 1 * u, ['#ffe27a', '#ff7a2e', '#ffffff'], 1, 40, { grav: 60, life: 0.3, sz: Math.max(2, u * 0.8) });
      const bb = btnBox(u);
      if (bb && k > 0.25) {
        const ex = bb.cx, ey = bb.cy - 6 * u, dx = ex - f.x, dy = ey - mid, L = Math.hypot(dx, dy) || 1, stop = Math.max(0, L - 26 * u);
        ctx.save(); ctx.globalAlpha = 0.25 + 0.35 * k * (0.5 + 0.5 * Math.sin(t * (4 + 12 * k)));
        ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = Math.max(1, u * 0.7); ctx.setLineDash([3 * u, 3 * u]); ctx.lineDashOffset = -t * 30;
        ctx.beginPath(); ctx.moveTo(f.x, mid); ctx.lineTo(f.x + dx / L * stop, mid + dy / L * stop); ctx.stroke(); ctx.restore();
      }
      if (k > 0.7) glow(f.x, mid, 18 * u, 'rgba(255,59,59,0.9)', 0.15 + 0.25 * (Math.sin(t * 14) > 0 ? 1 : 0));
    } else if (c.mech === 'summoner') {
      const n = 8, rx = 16 * u, ry = 6 * u;
      for (let i = 0; i < n; i++) {
        const a = t * 1.6 + i / n * Math.PI * 2, x = f.x + Math.cos(a) * rx, y = f.y + Math.sin(a) * ry, s = Math.max(2, Math.round(u));
        ctx.fillStyle = '#0a0910'; ctx.fillRect(x - s / 2 - 1, y - s / 2 - 1, s + 2, s + 2);
        ctx.fillStyle = i % 2 ? '#7fff9a' : '#b36bff'; ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
      if (c._sumT > 0) ellipse(f.x, f.y, rx * (1.6 - c._sumT), ry * (1.6 - c._sumT), '#7fff9a', c._sumT, Math.max(2, u));
    }
  }

  // ================= The frame =================
  let last = 0, idle = true;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    const c = R.champ, busy = c || parts.length || rings.length || flyers.length || floats.length || celebr.length;
    if (!busy) { if (!idle && ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); } idle = true; return; }
    if (!ensure()) return;
    idle = false;
    resize();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    if (R.town) return;
    const t = now / 1000, u = px();
    if (c) {
      if (c._hitT > 0) c._hitT -= dt * 3;
      if (c._sumT > 0) c._sumT -= dt * 1.5;
      drawChamp(c, u, t);
    }
    drawCelebr(dt, u, t);
    // flying coins (the thief's take), particles, rings, floating words
    for (let i = flyers.length - 1; i >= 0; i--) {
      const p = flyers[i]; p.k += dt / p.dur;
      if (p.k >= 1) { flyers.splice(i, 1); continue; }
      const to = p.to(), x = p.x + (to.x - p.x) * p.k, y = p.y + (to.y - p.y) * p.k - Math.sin(p.k * Math.PI) * p.arc;
      const s = Math.max(2, Math.round(u * 1.2));
      ctx.fillStyle = '#0a0910'; ctx.fillRect(x - s / 2 - 1, y - s / 2 - 1, s + 2, s + 2);
      ctx.fillStyle = p.k < 0.5 ? '#ffd84a' : '#fff3a0'; ctx.fillRect(x - s / 2, y - s / 2, s, s);
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life -= dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      ctx.globalAlpha = Math.min(1, p.life / p.max * 1.6); ctx.fillStyle = p.col;
      const s = Math.max(1, Math.round(p.sz * (u / 2.5)));
      ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
    }
    ctx.globalAlpha = 1;
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]; r.life -= dt;
      if (r.life <= 0) { rings.splice(i, 1); continue; }
      const k = 1 - r.life / r.max, rr = r.r0 + (r.r1 - r.r0) * k;
      ellipse(r.x, r.y, rr, rr * 0.45, r.col, (1 - k) * 0.8, r.w);
    }
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i]; f.life -= dt;
      if (f.life <= 0) { floats.splice(i, 1); continue; }
      ctx.globalAlpha = Math.min(1, f.life / f.max * 2);
      label(f.str, f.x, f.y - (1 - f.life / f.max) * 18, f.size, f.col);
      ctx.globalAlpha = 1;
    }
  }
  function drawChamp(c, u, t) {
    const kHp = G.champHpK ? G.champHpK(c) : 0;
    if (c.sus) return;
    // the Splitter's copies: small crowns each, one shared bar over the first
    if (c.split) {
      let lead = null;
      for (const k of c.kids) { if (k.dead || !R.mobs.includes(k)) continue; const b = drawBody(c, k, u, t, { kid: true }); if (b && !lead) lead = b; }
      if (lead) plateFor(c, lead, u, t, kHp);
      return;
    }
    // the Burrower underground: a mound of earth crawling to where it will come up
    if (c.hid > 0 && c.from && c.to) {
      const k = clamp(1 - c.hid / 2.2, 0, 1), e = k * k * (3 - 2 * k);
      const at = { id: -9, a: c.from.a + (c.to.a - c.from.a) * e, p: c.from.p + (c.to.p - c.from.p) * e };
      const f = feetOf(at, u);
      if (f) {
        ellipse(f.x, f.y, 9 * u, 3.2 * u, '#5a3a2a', 0.9, 0, true);
        ellipse(f.x, f.y - u, 6 * u, 2 * u, '#8a6040', 0.9, 0, true);
        if (Math.random() < 0.6) burst(f.x + rnd(-6, 6) * u, f.y - u, ['#8a6040', '#5a3a2a', '#c8a070'], 1, 40, { grav: 260, life: 0.4, sz: Math.max(2, u) });
        plateFor(c, { f, top: f.y - 4 * u, h: 4 * u }, u, t, kHp);
      }
      return;
    }
    const m = c.m;
    if (!R.mobs.includes(m)) return;
    // the Phantom's copies look just like it; only a faint shimmer gives them away
    for (const d of c.decoys) {
      if (d.dead || !R.mobs.includes(d)) continue;
      const b = drawBody(c, d, u, t, { decoy: true });
      if (!b) continue;
      if (Math.sin(t * 2.2 + d.id) > 0.93) glow(b.f.x, b.f.y - b.h * 0.5, 12 * u, 'rgba(200,138,255,0.9)', 0.35);
      plateFor(c, b, u, t, kHp, true);
    }
    const b = drawBody(c, m, u, t, {});
    if (!b) return;
    drawMech(c, b, u, t);
    plateFor(c, b, u, t, kHp);
  }
  function plateFor(c, b, u, t, kHp, quiet) {
    const bb = btnBox(u);
    // over its head, unless that would sit on the Button: then under its feet
    const above = { x0: b.f.x - 30 * u, x1: b.f.x + 30 * u, y0: b.top - 20 * u, y1: b.top };
    const below = overlaps(above, bb);
    drawPlate(c, b.f.x, below ? b.f.y + (c.mech === 'shield' && !quiet ? 7 * u : 3 * u) : b.top - 8 * u, u, t, kHp, below);
  }

  // ================= The big moments =================
  const celebr = [];
  function drawCelebr(dt, u, t) {
    for (let i = celebr.length - 1; i >= 0; i--) {
      const e = celebr[i]; e.t += dt;
      if (e.t >= e.T) { celebr.splice(i, 1); continue; }
      const k = e.t / e.T, f = feetOf(e.at, u);
      if (!f) continue;
      if (e.k === 'kill') {
        // golden rays turning out of the spot it fell
        ctx.save(); ctx.translate(f.x, f.y - 12 * u); ctx.rotate(t * 0.8);
        ctx.globalAlpha = 0.5 * (1 - k);
        for (let r = 0; r < 10; r++) {
          ctx.rotate(Math.PI * 2 / 10);
          ctx.fillStyle = r % 2 ? '#ffd84a' : '#fff3a0';
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(70 * u * (0.4 + k), -5 * u); ctx.lineTo(70 * u * (0.4 + k), 5 * u); ctx.closePath(); ctx.fill();
        }
        ctx.restore(); ctx.globalAlpha = 1;
        glow(f.x, f.y - 12 * u, 30 * u, 'rgba(255,216,74,0.9)', 0.5 * (1 - k));
      } else if (e.k === 'boom') {
        glow(f.x, f.y - 8 * u, 60 * u * (0.4 + k), 'rgba(255,122,46,0.95)', 0.7 * (1 - k));
      }
    }
  }
  function champAt(c) {
    const m = c.m;
    return c.at ? spotOf(c.at) : m;
  }

  // ================= Listening =================
  G.on('champSpawn', c => {
    ensure();
    const s = St();
    if (s) { s.flash && s.flash(0.45, c.col); s.shake && s.shake(4); }
    SFX.enter();
    showCard({ tag: T('champTag', 'LAND CHAMPION'), name: c.name.toUpperCase(), subB: c.title.toUpperCase(), sub: c.hint, col: c.col, ms: 3400, big: true });
  });
  G.on('champKill', (c, rew) => {
    const s = St(), u = px();
    if (s) { s.flash && s.flash(0.4, '#ffd84a'); s.shake && s.shake(6); }
    SFX.kill();
    celebr.push({ k: 'kill', at: champAt(c), t: 0, T: 1.5 });
    const f = feetOf(champAt(c), u);
    if (f) { burst(f.x, f.y - 10 * u, ['#ffd84a', '#fff3a0', '#ffffff', c.col], 60, 260, { sz: 3 }); ring(f.x, f.y, 6 * u, 60 * u, '#ffd84a', 0.8, 3); ring(f.x, f.y, 4 * u, 36 * u, '#ffffff', 0.5, 2); }
    const bits = [];
    if (rew) {
      const top = rew.gear && rew.gear.length ? Math.max.apply(null, rew.gear) : -1;
      if (top >= 0 && G.RARITIES && G.RARITIES[top]) bits.push(rew.gear.length + ' gear (' + G.RARITIES[top].name + ')');
      if (rew.orbs && rew.orbs.length) bits.push(rew.orbs.length + ' orbs');
      if (rew.chests) bits.push(rew.chests + (rew.chests > 1 ? ' chests' : ' chest'));
      if (rew.uq) bits.push('a UNIQUE!');
      if (rew.gold) bits.push(T('champReturned', '+{0} returned', fmt(rew.gold)));
    }
    showCard({ tag: T('champSlain', 'CHAMPION SLAIN'), name: c.name.toUpperCase(), sub: bits.join(' · '), col: '#ffd84a', ms: 3000 });
  });
  G.on('champEscape', (c, why) => {
    const s = St(), u = px(), f = feetOf(champAt(c), u);
    if (why === 'boom') {
      SFX.boom();
      if (s) { s.flash && s.flash(0.8, '#ff7a2e'); s.shake && s.shake(10); }
      const bb = btnBox(u), x = bb ? bb.cx : W / 2, y = bb ? bb.cy : H * 0.54;
      celebr.push({ k: 'boom', at: champAt(c), t: 0, T: 1 });
      burst(x, y - 8 * u, ['#ff7a2e', '#ffe27a', '#ff3b3b', '#ffffff'], 80, 320, { sz: 3 });
      ring(x, y, 8 * u, 90 * u, '#ff7a2e', 0.7, 4); ring(x, y, 6 * u, 60 * u, '#ffe27a', 0.5, 3);
      showCard({ tag: T('champBoom', 'KABOOM!'), name: c.name.toUpperCase(), sub: 'reached the Button', col: '#ff7a2e', ms: 2600 });
      return;
    }
    SFX.escape();
    if (f) burst(f.x, f.y - 10 * u, ['#6e6e7c', '#a9a2b9', '#474258'], 30, 120, { grav: -20, life: 0.8, sz: 3 });
    if (why === 'left') return;
    const sub = c.stolen > 0 ? T('champStolen', 'got away with {0} gold', fmt(c.stolen)) : 'no reward this time';
    showCard({ tag: T('champEscaped', 'ESCAPED'), name: c.name.toUpperCase(), sub, col: '#a9a2b9', ms: 2600, dim: true });
  });
  G.on('champReturn', c => showCard({ tag: T('champTag', 'LAND CHAMPION'), name: c.name.toUpperCase(), sub: 'is back!', col: c.col, ms: 1800 }));
  G.on('champSlam', c => {
    if (!c) return;
    const u = px(), f = feetOf(c.m, u);
    if (f) ring(f.x, f.y, 6 * u, 30 * u, c.mech === 'berserker' ? '#ff4f4f' : '#ffffff', 0.35, 2);
    const s = St(); if (s && s.shake) s.shake(c.mech === 'berserker' ? 3 : 1.5);
  });
  G.on('champSplit', (c, m, kids) => {
    const u = px(), f = feetOf(m, u);
    SFX.split();
    if (f) { burst(f.x, f.y - 12 * u, [c.col, '#ffffff'], 40, 200); ring(f.x, f.y, 6 * u, 40 * u, c.col, 0.5, 3); floatText(f.x, f.y - 30 * u, 'SPLIT!', c.col, Math.round(clamp(u * 3, 9, 12)), 1.2); }
    const s = St(); if (s && s.shake) s.shake(4);
  });
  G.on('champDive', (c, from) => {
    const u = px(), f = feetOf(spotOf(from), u);
    SFX.dive();
    if (f) { burst(f.x, f.y - 2 * u, ['#8a6040', '#5a3a2a', '#c8a070'], 26, 140, { grav: 300, sz: 3 }); ring(f.x, f.y, 4 * u, 22 * u, '#c8a070', 0.4, 2); }
  });
  G.on('champSurface', (c, to) => {
    const u = px(), f = feetOf(spotOf(to), u);
    SFX.dive();
    if (f) { burst(f.x, f.y - 2 * u, ['#8a6040', '#5a3a2a', '#c8a070'], 30, 180, { grav: 300, sz: 3 }); ring(f.x, f.y, 4 * u, 28 * u, '#c8a070', 0.45, 3); }
    const s = St(); if (s && s.shake) s.shake(2);
  });
  G.on('champSteal', (c, amt) => {
    const u = px(), bb = btnBox(u);
    if (!bb || !rect) return;
    for (let i = 0; i < 3; i++) flyers.push({ x: bb.cx + rnd(-6, 6) * u, y: bb.cy - 10 * u, k: -i * 0.12, dur: 0.55, arc: rnd(12, 26) * u, to: () => { const f = feetOf(c.m, u); return f ? { x: f.x, y: f.y - 12 * u } : { x: bb.cx, y: bb.cy }; } });
    if ((stealSnd = (stealSnd + 1) % 2) === 0) SFX.steal();
  });
  G.on('champFlee', c => {
    const u = px(), f = feetOf(c.m, u);
    if (f) floatText(f.x, f.y - 34 * u, 'RUNNING!', '#ffd84a', Math.round(clamp(u * 3, 9, 12)), 1.4);
  });
  G.on('champShieldHit', c => { c._hitT = 1; if (Math.random() < 0.5) SFX.crack(); });
  G.on('champShieldBreak', c => {
    const u = px(), f = feetOf(c.m, u);
    SFX.shield();
    if (f) { burst(f.x, f.y - 14 * u, ['#8fc8ff', '#ffffff', '#5ae8ff'], 40, 220, { sz: 3 }); floatText(f.x, f.y - 36 * u, T('champShieldBroken', 'SHIELD BROKEN'), '#8fc8ff', Math.round(clamp(u * 3, 9, 12)), 1.4); }
    const s = St(); if (s) { s.flash && s.flash(0.2, '#8fc8ff'); s.shake && s.shake(3); }
  });
  G.on('champShieldUp', c => { const u = px(), f = feetOf(c.m, u); if (f) ring(f.x, f.y - 10 * u, 6 * u, 26 * u, '#8fc8ff', 0.5, 3); SFX.crack(); });
  G.on('champRage', c => {
    const u = px(), f = feetOf(c.m, u);
    SFX.rage();
    if (f) floatText(f.x, f.y - 38 * u, T('champRage', 'ENRAGED!'), '#ff4f4f', Math.round(clamp(u * 3.2, 9, 13)), 1.5);
    const s = St(); if (s) { s.flash && s.flash(0.25, '#ff3b3b'); s.shake && s.shake(4); }
  });
  G.on('champSummon', c => { c._sumT = 1; SFX.summon(); });
  G.on('champDecoys', (c, ds) => {
    const u = px();
    SFX.decoy();
    for (const m of [c.m].concat(ds)) { const f = feetOf(m, u); if (f) burst(f.x, f.y - 12 * u, ['#c88aff', '#e4eaf6', '#7a5aa8'], 14, 90, { grav: -30, life: 0.6, sz: 3 }); }
  });
  G.on('champDecoyPop', (c, m) => {
    const u = px(), f = feetOf(m, u);
    SFX.pop();
    if (f) { burst(f.x, f.y - 12 * u, ['#c88aff', '#ffffff'], 22, 160); floatText(f.x, f.y - 30 * u, 'FAKE!', '#c88aff', Math.round(clamp(u * 2.8, 8, 11)), 1); }
  });

  // for testing: the current overlay pieces
  G.champFx = { card: showCard, sfx: SFX, state: () => ({ parts: parts.length, rings: rings.length, card: card && !card.hidden ? card.textContent : null }) };
  requestAnimationFrame(frame);
})(globalThis.G = globalThis.G || {});
