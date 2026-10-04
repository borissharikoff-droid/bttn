// BTTN 3.5 — rare_fx: the show for the rare surprises (js/rare.js).
//   * the art: the Lucky Merchant, the Wishing Well, the Ghostly Gambler and the three mythic pets
//     (G.SPR.def, drawn like every other sprite);
//   * an overlay canvas over the stage (under the HUD) for the visitors on the field, the shooting
//     star, the Goblin King's crown, a secret land's weather, gold geysers and the Golden Horde's glitter;
//   * the reveals: queued into the game's big banner (G.UI.bannerShow) so they never stack with loot
//     banners, and held back while a relic cinematic, a window or the town is up;
//   * the merchant's shop, the well's wishes and the ghost's coin (they hold the field still while open,
//     through G.uiBusy), the secret land's tint and timer;
//   * a codex of what has been seen (G.rareFx.openCodex()).
// Browser only; strings sit in G.STR with fallbacks here.
(function (G) {
  'use strict';
  if (typeof document === 'undefined' || !G.forceRare) return;
  const R = G.R;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const fmt = v => (G.fmt ? G.fmt(v) : String(Math.round(v)));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const FONT = '"Press Start 2P", "BTTN Body", monospace';
  const BODY = '"BTTN Body", "Press Start 2P", monospace';
  const St = () => G.Stage || null;
  const $ = s => document.querySelector(s);

  // ================= Strings =================
  const STR = {
    rfTag: 'ONCE IN A BLUE MOON', rfFirst: 'FIRST SIGHTING!', rfNth: 'sighting #{0}',
    rfMerchant: 'THE LUCKY MERCHANT', rfMerchantSub: 'Tap him before he leaves!', rfMerchantName: 'Lucky Merchant',
    rfShopHi: 'Psst, friend. Bargains. Only for you, only now.', rfShopBuy: 'BUY', rfShopSold: 'SOLD', rfShopLeave: 'LEAVE', rfShopBye: 'Pleasure doing business!',
    rfShopNo: 'Not enough {0}', rfShards: 'shards', rfGold: 'gold',
    rfLandTag: 'A WRONG TURN...', rfLandBack: 'BACK ON THE ROAD', rfLandHaul: '+{0} gold · {1} chests · {2} drops',
    rfTrove: 'CHEST TROVE!', rfTroveSub: '{0} chests rain down',
    rfHorde: 'THE GOLDEN HORDE!', rfHordeSub: 'The Stampede turned to gold: every kill pays ×8',
    rfWell: 'THE WISHING WELL', rfWellSub: 'Toss a coin, make a wish', rfWellPick: 'Toss a coin and make one wish:',
    rfGambler: 'THE GHOSTLY GAMBLER', rfGamblerSub: '“My gold, your luck. Double or nothing?”', rfGhostPot: 'On the table', rfFlip: 'FLIP ×2', rfTake: 'TAKE IT', rfWin: 'HEADS! ×2', rfLose: 'TAILS... gone', rfGhostBye: 'The ghost tips its hat.',
    rfStar: 'MAKE A WISH!', rfStarMissed: 'The star is gone...', rfWishGranted: 'WISH GRANTED',
    rfKing: 'THE GOBLIN KING!', rfKingSub: 'He bleeds coins. Catch him before he flees!', rfKingSlain: 'THE KING IS DEAD', rfKingFled: 'THE KING ESCAPED',
    rfPet: 'MYTHIC PET!', rfLegend: 'THE BUTTON OF LEGENDS', rfLegendSub: 'One click in a million. That was it.',
    rfMidas: 'MIDAS ×3', rfLuck: 'LUCK ×3', rfCodex: 'Rare sightings', rfUnseen: '???', rfSeenN: 'seen ×{0}',
  };
  if (G.STR) for (const k in STR) if (!G.STR[k]) G.STR[k] = STR[k];
  const T = function (k) {
    let s = (G.STR && G.STR[k]) || STR[k] || k;
    for (let i = 1; i < arguments.length; i++) s = s.replace('{' + (i - 1) + '}', arguments[i]);
    return s;
  };

  // ================= Art =================
  function art() {
    const SPR = G.SPR;
    if (!SPR || SPR.defs.rare_merchant) return;
    const fix = (rows, w) => rows.map(r => (r + '.'.repeat(w)).slice(0, w));
    const D = (id, pal, rows) => { const w = Math.max.apply(null, rows.map(r => r.length)); SPR.def(id, Object.assign({ k: '#1a1a22' }, pal), fix(rows, w)); };
    // the Lucky Merchant: a hooded purple cloak with gold trim, eyes glinting in the hood, a pack of
    // wares on his back and a lantern held out
    D('rare_merchant', { c: '#6a42a8', C: '#432a70', t: '#ffd84a', T: '#c98f10', e: '#fff3a0', b: '#9a6a36', B: '#6a4422', p: '#ff5fd2', g: '#6ee06e', l: '#fff3a0', L: '#c98f10', s: '#d49b72' }, [
      '......cccc.......',
      '.....cccccc..bbb.',
      '....cccccccc.bpbB',
      '....cckkkkcc.bbbB',
      '....ckekkekc.bgbB',
      '....ckkkkkkc.BbbB',
      '.....tcccct..BBB.',
      '...ccccccccccbbB.',
      '..cccctcctcccBB..',
      '..ccctccccccc....',
      '.scccccccccccc...',
      'LLccccctcccccc...',
      'LlLcccccccccccc..',
      'LlL.cccctccccccc.',
      '.L..cccccccccccc.',
      '...tttttttttttt..',
      '....CC.....CC....',
      '....kk.....kk....',
    ]);
    D('rare_well', { r: '#c8503a', R: '#8a3022', w: '#8a5a2e', s: '#a9a2b9', S: '#6e6880', b: '#5ae8ff', B: '#2a8ac8', y: '#ffd84a' }, [
      '...rrrrrrrrrr...',
      '..rRRRRRRRRRRr..',
      '.rrrrrrrrrrrrrr.',
      '...w........w...',
      '...w...yy...w...',
      '...w...ww...w...',
      '...w........w...',
      '.ssssssssssssss.',
      'sSsSsSsSsSsSsSsS',
      'sbBbbBbbBbbBbbBs',
      'SsSsSsSsSsSsSsSs',
      'sSsSsSsSsSsSsSsS',
      '.SSSSSSSSSSSSSS.',
    ]);
    D('rare_ghost', { w: '#e8f0ff', W: '#a8b8e0', h: '#2a2440', H: '#5a4a8a', e: '#5ae8ff', y: '#ffd84a', Y: '#c98f10', m: '#ffffff' }, [
      '....hhhh....',
      '....hhhh....',
      '...HHHHHH...',
      '...wwwwww...',
      '..wwwwwwww..',
      '..wekwwekw..',
      '..wwwwwwww..',
      '.wwwwmmwwww.',
      'yywwwwwwwwww',
      'YywwwwwwwWww',
      '.wwwwwwwwwW.',
      '.wWwwWwwWwW.',
      '.w.W.w.W.w..',
    ]);
    D('rare_star', { w: '#ffffff', y: '#fff3a0', Y: '#ffd84a' }, [
      '....w....',
      '....y....',
      '...yYy...',
      'wyyYwYyyw',
      '..yYwYy..',
      '...yYy...',
      '..yY.Yy..',
      '.yY...Yy.',
      '.w.....w.',
    ]);
    // the mythic pets (8x8 like every pet)
    D('p_goldling', { y: '#ffd84a', Y: '#c98f10', w: '#fffbe0', o: '#a86a10', r: '#ff5fd2' }, [
      'y.y..y.y',
      '.yyrryy.',
      '.ywwyyy.',
      'yywyyyyy',
      'yykyykyy',
      'oYYYYYYo',
      '.oooooo.',
      '.k....k.',
    ]);
    D('p_voidkit', { v: '#3a2460', V: '#1e1238', p: '#c88aff', s: '#5ae8ff', w: '#ffffff' }, [
      '.v....v.',
      '.vp..pv.',
      '.vvvvvv.',
      'vswvvswv',
      'vvvppvvv',
      '.vVvvVv.',
      '.vvvvvvp',
      '.V.VV.p.',
    ]);
    D('p_clover', { g: '#4fd65b', G: '#2a8a34', w: '#ffffff', y: '#ffd84a', e: '#1a1a22', b: '#8a5a2e' }, [
      '.gg..gg.',
      'gGgggGgg',
      '.ggyygg.',
      'gweggewg',
      'gGggggGg',
      '.gg..gg.',
      '....b...',
      '...b....',
    ]);
  }
  art();

  // ================= Styles =================
  const css = `
#rareFx { position: absolute; left: 0; top: 0; width: 100%; height: 100%; max-width: none; pointer-events: none; }
#stage.rfVault { filter: sepia(.72) saturate(2.3) hue-rotate(-14deg) brightness(1.06); }
#stage.rfCandy { filter: hue-rotate(285deg) saturate(1.5) brightness(1.1); }
#stage.rfUpside { filter: invert(.88) hue-rotate(180deg) saturate(1.3); }
#stage.rfGild { filter: sepia(.35) saturate(1.6) brightness(1.04); }
.rfHot { position: absolute; z-index: 5; width: 64px; height: 72px; margin: -72px 0 0 -32px; padding: 0; border: 0; background: transparent;
  cursor: pointer; pointer-events: auto; touch-action: manipulation; -webkit-tap-highlight-color: transparent; border-radius: 12px; }
.rfHot:focus-visible { outline: 2px dashed #ffd84a; }
.rfHot[hidden] { display: none; }
#rfChips { position: absolute; left: 50%; top: 12%; transform: translateX(-50%); z-index: 4; display: flex; gap: 6px; pointer-events: none; flex-wrap: wrap; justify-content: center; width: max-content; max-width: 94%; }
#rfChips[hidden] { display: none; }
.rfChip { --c: #ffd84a; font: 9px/1 ${FONT}; color: var(--c); padding: 6px 9px 5px; background: rgba(10,9,16,.86); border: 2px solid #0a0910;
  box-shadow: inset 0 0 0 2px var(--c), 0 0 14px -3px var(--c); letter-spacing: .06em; text-shadow: 1px 1px 0 #0a0910; white-space: nowrap; }
.rfChip i { font-style: normal; color: #f1ece0; margin-left: 6px; }
#banner .inner.rfB { position: relative; --c: #ffd84a; color: var(--c); padding: 26px 34px 22px; max-width: min(92vw, 560px); }
#banner .inner.rfB::before { content: ''; position: absolute; left: 50%; top: 50%; width: 520px; height: 520px; margin: -260px 0 0 -260px; z-index: -1; pointer-events: none;
  background: repeating-conic-gradient(from 0deg, color-mix(in srgb, var(--c) 60%, transparent) 0deg 8deg, transparent 8deg 20deg);
  -webkit-mask: radial-gradient(circle, #000 0 22%, transparent 66%); mask: radial-gradient(circle, #000 0 22%, transparent 66%); animation: rfSpin 9s linear infinite; z-index: -2; }
#banner .inner.rfB::after { content: ''; position: absolute; inset: -14% -18%; z-index: -1; background: radial-gradient(ellipse closest-side, rgba(10,9,16,.86), rgba(10,9,16,.6) 55%, rgba(10,9,16,0)); }
#banner .inner.rfB .rfTag { font: 9px/1.4 ${FONT}; letter-spacing: .22em; color: #f1ece0; opacity: .85; margin-bottom: 8px; }
#banner .inner.rfB h2 { font-size: 20px; color: var(--c); margin: 0 0 12px; text-shadow: 3px 3px 0 #0a0910, 0 0 18px var(--c); }
#banner .inner.rfB .rfIco { width: 112px; height: 112px; image-rendering: pixelated; filter: drop-shadow(0 0 16px var(--c)) drop-shadow(3px 3px 0 #0a0910); animation: rfBob 1.2s ease-in-out infinite; }
#banner .inner.rfB p { color: #f1ece0; }
#banner .inner.rfB .rfFirst { display: inline-block; margin-top: 10px; font: 9px/1 ${FONT}; color: #0a0910; background: var(--c); padding: 6px 8px 5px; transform: rotate(-4deg); box-shadow: 2px 2px 0 #0a0910; letter-spacing: .1em; }
#banner .inner.rfB .rfNth { display: block; margin-top: 8px; font: 13px/1 ${BODY}; color: #a9a2b9; }
#banner .inner.rfB.legend h2 { font-size: 24px; animation: rfRainbow 1.6s linear infinite; }
#banner .inner.rfB.mythic .rfIco { animation: rfBob 1.2s ease-in-out infinite, rfHue 2.4s linear infinite; }
@keyframes rfSpin { to { transform: rotate(360deg); } }
@keyframes rfBob { 50% { transform: translateY(-6px) scale(1.04); } }
@keyframes rfHue { 0%, 100% { filter: drop-shadow(0 0 18px #ff5fd2) drop-shadow(3px 3px 0 #0a0910); } 33% { filter: drop-shadow(0 0 18px #ffd84a) drop-shadow(3px 3px 0 #0a0910); } 66% { filter: drop-shadow(0 0 18px #5ae8ff) drop-shadow(3px 3px 0 #0a0910); } }
@keyframes rfRainbow { 0% { color: #ff5f5f; } 20% { color: #ffd84a; } 40% { color: #6ee06e; } 60% { color: #5ae8ff; } 80% { color: #c88aff; } 100% { color: #ff5f5f; } }
.rfPanel { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 20; width: min(94%, 560px); max-height: 92%; overflow: auto;
  --c: #ffd84a; background: #14111e; border: 3px solid #0a0910; box-shadow: inset 0 0 0 2px var(--c), 0 0 40px -6px var(--c), 0 6px 0 #0a0910;
  padding: 14px 14px 12px; pointer-events: auto; animation: rfIn .4s cubic-bezier(.2,1.6,.4,1); color: #f1ece0; font: 15px/1.25 ${BODY}; }
.rfPanel.out { animation: rfOut .3s ease-in forwards; }
.rfBack { position: absolute; inset: 0; z-index: 19; background: rgba(6,5,10,.45); pointer-events: auto; animation: rfFade .3s ease-out; }
.rfBack.out { opacity: 0; transition: opacity .3s; }
@keyframes rfFade { from { opacity: 0; } }
#stageWrap.rfPanelOn #banner .inner.rfB { visibility: hidden; }
@keyframes rfIn { from { transform: translate(-50%, -50%) scale(.5); opacity: 0; } }
@keyframes rfOut { to { transform: translate(-50%, -46%); opacity: 0; } }
.rfPanel .rfHead { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.rfPanel .rfHead img { width: 54px; height: 60px; image-rendering: pixelated; object-fit: contain; filter: drop-shadow(0 0 10px var(--c)); flex: none; }
.rfPanel .rfHead b { display: block; font: 12px/1.4 ${FONT}; color: var(--c); letter-spacing: .04em; text-shadow: 2px 2px 0 #0a0910; }
.rfPanel .rfHead small { display: block; font: 14px/1.25 ${BODY}; color: #d8d2e6; margin-top: 4px; }
.rfPanel .rfTime { height: 5px; background: #2a2440; border: 1px solid #0a0910; margin: 0 0 10px; }
.rfPanel .rfTime i { display: block; height: 100%; background: var(--c); width: 100%; }
.rfOffers { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.rfOffer { --o: #ffd84a; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 4px; padding: 8px 6px; background: #1d1929;
  border: 2px solid #0a0910; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--o) 55%, transparent); min-width: 0; }
.rfOffer img { width: 40px; height: 40px; image-rendering: pixelated; filter: drop-shadow(0 0 8px var(--o)); }
.rfOffer b { font: 8px/1.45 ${FONT}; color: var(--o); }
.rfOffer small { font: 13px/1.15 ${BODY}; color: #d8d2e6; min-height: 30px; }
.rfOffer s { font: 12px/1 ${BODY}; color: #8a8298; }
.rfOffer .rfPrice { font: 14px/1 ${BODY}; color: #ffd84a; display: flex; align-items: center; gap: 3px; }
.rfOffer .rfPrice img { width: 12px; height: 12px; filter: none; }
.rfOffer button, .rfBtns button, .rfWish { font: 9px/1 ${FONT}; padding: 8px 10px 7px; border: 2px solid #0a0910; background: #ffd84a; color: #0a0910; cursor: pointer;
  box-shadow: inset -2px -2px 0 rgba(0,0,0,.25), 0 2px 0 #0a0910; touch-action: manipulation; letter-spacing: .04em; }
.rfOffer button { width: 100%; margin-top: auto; }
.rfOffer button:disabled { background: #3a3448; color: #8a8298; cursor: default; }
.rfOffer.sold { opacity: .55; }
.rfOffer.sold button { background: #6ee06e; }
.rfBtns { display: flex; gap: 8px; justify-content: flex-end; margin-top: 10px; }
.rfBtns button.ghost { background: #2a2440; color: #f1ece0; }
.rfWishes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.rfWish { --o: #7fe9ff; display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 10px 6px; background: #1d1929; color: var(--o);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--o) 55%, transparent), 0 2px 0 #0a0910; text-align: center; }
.rfWish img { width: 36px; height: 36px; image-rendering: pixelated; filter: drop-shadow(0 0 8px var(--o)); }
.rfWish span { display: flex; flex-direction: column; gap: 5px; }
.rfWish small { display: block; font: 13px/1.15 ${BODY}; color: #d8d2e6; letter-spacing: 0; }
.rfWish:hover, .rfOffer button:not(:disabled):hover, .rfBtns button:hover { filter: brightness(1.15); }
.rfPot { text-align: center; margin: 4px 0 6px; }
.rfPot small { display: block; font: 9px/1.4 ${FONT}; color: #a9a2b9; letter-spacing: .1em; }
.rfPot b { display: block; font: 18px/1.4 ${FONT}; color: #ffd84a; text-shadow: 2px 2px 0 #0a0910; }
.rfPot .rfRes { display: block; min-height: 18px; font: 15px/1.2 ${BODY}; }
.rfPot .rfRes.win { color: #6ee06e; } .rfPot .rfRes.lose { color: #ff6a6a; }
.rfCoin { width: 34px; height: 34px; image-rendering: pixelated; margin: 2px auto; display: block; }
.rfCoin.flip { animation: rfFlip .6s ease-in-out; }
@keyframes rfFlip { 0% { transform: rotateY(0) translateY(0); } 50% { transform: rotateY(900deg) translateY(-26px); } 100% { transform: rotateY(1800deg) translateY(0); } }
.rfCodex { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; text-align: left; }
.rfCodex > div { display: flex; gap: 8px; align-items: center; padding: 8px; background: #1d1929; border: 2px solid #0a0910; }
.rfCodex img { width: 32px; height: 32px; image-rendering: pixelated; flex: none; }
.rfCodex b { display: block; font: 8px/1.4 var(--font-display, ${FONT}); }
.rfCodex small { display: block; font: 13px/1.2 ${BODY}; color: #a9a2b9; }
.rfCodex .no img { filter: brightness(0) opacity(.5); }
@media (max-width: 860px) {
  /* a phone: the window takes the screen, the wares stack as rows */
  .rfPanel { position: fixed; z-index: 40; width: min(96vw, 520px); max-height: 92vh; padding: 10px; font-size: 14px; }
  .rfBack { position: fixed; z-index: 39; }
  .rfPanel .rfHead img { width: 44px; height: 48px; }
  .rfOffers { grid-template-columns: 1fr; gap: 6px; }
  .rfOffer { display: grid; grid-template-columns: 40px minmax(0, 1fr) auto; column-gap: 8px; row-gap: 3px; align-items: center; text-align: left; padding: 7px 8px; }
  .rfOffer > img { grid-row: 1 / span 2; grid-column: 1; width: 36px; height: 36px; }
  .rfOffer b { grid-row: 1; grid-column: 2; }
  .rfOffer small { grid-row: 2; grid-column: 2; min-height: 0; }
  .rfOffer s { display: none; }
  .rfOffer .rfPrice { grid-row: 1; grid-column: 3; justify-self: end; }
  .rfOffer button { grid-row: 2; grid-column: 3; width: auto; margin: 0; }
  .rfPanel .rfHead b { font-size: 10px; }
  #banner .inner.rfB { padding: 18px 14px 16px; }
  #banner .inner.rfB h2 { font-size: 14px; }
  #banner .inner.rfB.legend h2 { font-size: 15px; }
  #banner .inner.rfB .rfIco { width: 84px; height: 84px; }
  #banner .inner.rfB::before { width: 380px; height: 380px; margin: -190px 0 0 -190px; }
  #rfChips { top: 74px; }
  .rfChip { font-size: 8px; }
  .rfCodex { grid-template-columns: 1fr; }
}
@media (max-width: 420px) { .rfWishes { grid-template-columns: 1fr; } .rfWish { flex-direction: row; text-align: left; } }
`;
  const styleEl = document.createElement('style');
  styleEl.id = 'rareFxStyle';
  styleEl.textContent = css;
  (document.head || document.documentElement).appendChild(styleEl);

  // ================= Sound =================
  const Snd = {
    ac: null,
    on() { const s = G.S && G.S.set; return !!(s && s.sound && !(s.vol <= 0)); },
    ctx() {
      if (!this.on()) return null;
      if (!this.ac) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; try { this.ac = new AC(); } catch (e) { return null; } }
      if (this.ac.state === 'suspended') { try { this.ac.resume(); } catch (e) { /* not yet allowed */ } }
      return this.ac;
    },
    vol() { return Math.min(1, G.S.set.vol == null ? 0.6 : G.S.set.vol) * 0.3; },
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
  const arp = (fs, step, type, v, dur) => fs.forEach((f, i) => tone(type || 'square', f, f, i * step, dur || 0.2, v || 0.18));
  const SFX = {
    // a rising shimmer and a bright chord: something special is here
    reveal() { noise(0, 0.6, 0.35, 8000, 1500); arp([523, 659, 784, 1047, 1319, 1568], 0.06, 'triangle', 0.22, 0.35); tone('square', 262, 262, 0.4, 0.7, 0.12); tone('square', 392, 392, 0.4, 0.7, 0.1); },
    bell() { [1568, 2093, 1568, 2637].forEach((f, i) => tone('sine', f, f, i * 0.1, 0.5, 0.2)); },
    coin() { tone('square', 988, 988, 0, 0.06, 0.12); tone('square', 1319, 1319, 0.06, 0.18, 0.12); },
    buy() { arp([784, 988, 1175, 1568], 0.05, 'square', 0.16, 0.16); },
    trove() { arp([392, 523, 659, 784, 1047, 784, 1047, 1319], 0.07, 'square', 0.18, 0.18); noise(0, 0.5, 0.3, 6000, 1200); },
    land() { noise(0, 1.4, 0.5, 300, 4000); tone('sine', 110, 440, 0, 1.4, 0.25); arp([440, 554, 659, 880], 0.18, 'triangle', 0.2, 0.5); },
    wish() { arp([1047, 1319, 1568, 2093, 2637], 0.07, 'sine', 0.2, 0.6); },
    flip() { [0, 0.07, 0.14, 0.21, 0.28].forEach(t => tone('square', 1800, 2400, t, 0.04, 0.06)); },
    win() { arp([659, 784, 1047], 0.08, 'square', 0.2, 0.2); },
    lose() { [392, 370, 349, 262].forEach((f, i) => tone('sawtooth', f, f * 0.97, i * 0.22, 0.3, 0.12)); },
    king() { tone('sawtooth', 220, 330, 0, 0.3, 0.2); tone('sawtooth', 165, 247, 0.12, 0.3, 0.18); noise(0, 0.4, 0.4, 1200, 300); arp([523, 659, 784], 0.1, 'square', 0.16, 0.25); },
    legend() { noise(0, 2.2, 0.6, 200, 9000); [262, 330, 392, 523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.1 * i, 2.2 - 0.1 * i, 0.18)); tone('sine', 55, 55, 0, 2.4, 0.5); },
    star() { [2637, 3136, 2637, 3520].forEach((f, i) => tone('sine', f, f * 1.01, i * 0.08, 0.3, 0.1)); },
    sad() { arp([523, 440, 349], 0.12, 'triangle', 0.16, 0.3); },
  };

  // ================= Layers =================
  let cv = null, ctx = null, W = 0, H = 0, DPR = 1, rect = null, wrap = null, hot = null, chips = null;
  function ensure() {
    if (cv && cv.isConnected) return true;
    const stage = document.getElementById('stage');
    wrap = document.getElementById('stageWrap');
    if (!stage || !wrap) return false;
    cv = document.createElement('canvas'); cv.id = 'rareFx';
    stage.insertAdjacentElement('afterend', cv);
    ctx = cv.getContext('2d');
    hot = document.createElement('button'); hot.type = 'button'; hot.className = 'rfHot'; hot.hidden = true; hot.setAttribute('aria-label', 'Rare visitor');
    hot.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); tapHot(); });
    hot.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); });
    wrap.appendChild(hot);
    chips = document.createElement('div'); chips.id = 'rfChips'; chips.hidden = true; wrap.appendChild(chips);
    return true;
  }
  function resize() {
    const r = cv.getBoundingClientRect();
    rect = r;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (Math.round(r.width * dpr) !== cv.width || Math.round(r.height * dpr) !== cv.height || dpr !== DPR) { DPR = dpr; cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
    W = r.width; H = r.height;
  }
  function px() { const s = St(); if (!s || !s.toScreen) return 3; const a = s.toScreen(0, 0), b = s.toScreen(1, 0); return Math.max(1, b.x - a.x); }
  function feetOf(o, u) {
    const s = St(); if (!s || !s.mobPoint || !rect) return null;
    const q = s.mobPoint({ id: o.id || -77, a: o.a, p: o.p, kind: 'brute' });
    return { x: q.x - rect.left, y: q.y - rect.top + 18 * u };
  }
  function btnXY(u) {
    const s = St(); if (!s || !s.buttonPoint || !rect) return { x: W / 2, y: H * 0.54 };
    const b = s.buttonPoint(); return { x: b.x - rect.left, y: b.y - rect.top + 24 * u };
  }

  // ================= Particles =================
  const parts = [], rings = [], floats = [];
  function burst(x, y, cols, n, sp, o) {
    for (let i = 0; i < n && parts.length < 600; i++) {
      const a = Math.random() * Math.PI * 2, s = rnd(sp * 0.35, sp);
      const p = Object.assign({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - sp * 0.3, life: rnd(0.5, 1), col: cols[i % cols.length], sz: 2, grav: 220 }, o || {});
      p.max = p.life; parts.push(p);
    }
  }
  function ring(x, y, r0, r1, col, life, w) { rings.push({ x, y, r0, r1, col, life, max: life, w: w || 2 }); }
  function floatText(x, y, str, col, size, life) { floats.push({ x, y, str, col, size, life: life || 1.2, max: life || 1.2 }); }
  function label(str, x, y, size, col) {
    ctx.font = size + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.lineWidth = Math.max(2, size * 0.35); ctx.strokeStyle = '#0a0910'; ctx.lineJoin = 'round';
    ctx.strokeText(str, x, y); ctx.fillStyle = col; ctx.fillText(str, x, y);
  }
  function glow(x, y, r, col, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(1, r));
    g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1;
  }
  function sprite(id, x, y, u, o) {
    const SPR = G.SPR; if (!SPR) return null;
    const c = SPR.get(id, o && o.gold ? { gold: true } : null); if (!c) return null;
    const w = c.width * u, h = c.height * u;
    if (o && o.flip) { ctx.save(); ctx.translate(Math.round(x), 0); ctx.scale(-1, 1); ctx.drawImage(c, Math.round(-w / 2), Math.round(y - h), Math.round(w), Math.round(h)); ctx.restore(); }
    else ctx.drawImage(c, Math.round(x - w / 2), Math.round(y - h), Math.round(w), Math.round(h));
    return { w, h };
  }
  function bar(x, y, w, h, k, col) {
    ctx.fillStyle = '#0a0910'; ctx.fillRect(Math.round(x - w / 2) - 1, Math.round(y) - 1, Math.round(w) + 2, Math.round(h) + 2);
    ctx.fillStyle = '#2a2440'; ctx.fillRect(Math.round(x - w / 2), Math.round(y), Math.round(w), Math.round(h));
    ctx.fillStyle = col; ctx.fillRect(Math.round(x - w / 2), Math.round(y), Math.max(1, Math.round(w * clamp(k, 0, 1))), Math.round(h));
  }
  const CROWN = ['y.y.y.y', 'yyyyyyy', 'yrybyry', 'yyyyyyy', 'YYYYYYY'];
  const CROWN_COL = { y: '#ffd84a', Y: '#c99a2a', r: '#ff4f6a', b: '#5ae8ff' };
  function crown(x, y, s) {
    s = Math.max(1, Math.round(s));
    const w = CROWN[0].length, h = CROWN.length, ox = Math.round(x - w * s / 2), oy = Math.round(y - h * s);
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) if (CROWN[r][c] !== '.') { ctx.fillStyle = '#0a0910'; ctx.fillRect(ox + c * s - 1, oy + r * s - 1, s + 2, s + 2); }
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) { const k = CROWN[r][c]; if (k === '.') continue; ctx.fillStyle = CROWN_COL[k]; ctx.fillRect(ox + c * s, oy + r * s, s, s); }
  }

  // ================= The reveals =================
  // queued here while something bigger is on (a relic, a window, the town), then handed to the game's banner queue
  const queue = [];
  let uid = 0, live = null;
  const LOG = id => (G.RARE_LOG || []).find(e => e.id === id) || { id, name: id, col: '#ffd84a' };
  const icoUrl = (id, sc, o) => (G.SPR ? G.SPR.url(id, sc || 6, o) : '');
  function reveal(o) { queue.push(Object.assign({ id: ++uid, ms: 2800, t0: performance.now() }, o)); }
  function heldBack() {
    return !!(R.cine > 0 || (G.relicShow && G.relicShow()) || R.town || (G.uiBusy && G.uiBusy()) || !(G.UI && G.UI.bannerShow));
  }
  function pumpReveals() {
    // a stale one (its moment long gone) is dropped
    while (queue.length && ((queue[0].stale && performance.now() - queue[0].t0 > queue[0].stale) || (queue[0].ok && !queue[0].ok()))) queue.shift();
    if (!queue.length || heldBack()) return;
    const o = queue.shift();
    const n = o.kind && G.S.st.rare ? G.S.st.rare[o.kind] || 0 : 0;
    const first = o.kind && n === 1;
    const html = `<div class="inner rfB ${o.cls || ''}" data-rf="${o.id}" style="--c:${o.col || '#ffd84a'}">` +
      `<div class="rfTag">${esc(o.tag || T('rfTag'))}</div><h2>${esc(o.title)}</h2>` +
      (o.icon ? `<img class="rfIco" src="${o.icon}" alt="">` : '') +
      (o.sub ? `<p>${esc(o.sub)}</p>` : '') +
      (first ? `<span class="rfFirst">${esc(T('rfFirst'))}</span>` : n > 1 && !o.noCount ? `<span class="rfNth">${esc(T('rfNth', n))}</span>` : '') + '</div>';
    live = o;
    G.UI.bannerShow(html, o.ms);
  }
  // the moment the banner actually shows it: the sting, the flash, the shake
  function watchLive() {
    if (!live) return;
    const b = document.getElementById('banner');
    if (!b || b.hidden || !b.querySelector('[data-rf="' + live.id + '"]')) { if (performance.now() - live.t0 > 30000) live = null; return; }
    const o = live; live = null;
    (SFX[o.sfx || 'reveal'] || SFX.reveal)();
    const s = St();
    if (s) { s.flash && s.flash(o.flash || 0.45, o.col || '#ffd84a'); s.shake && s.shake(o.shake || 5); }
    if (rect) { const u = px(); burst(W / 2, H * 0.45, [o.col || '#ffd84a', '#ffffff', '#fff3a0'], o.big ? 140 : 70, o.big ? 420 : 300, { sz: 3, grav: 160 }); ring(W / 2, H * 0.45, 10 * u, 120 * u, o.col || '#ffd84a', 0.9, 4); }
  }
  const toast = (html, icon) => { if (G.UI && G.UI.toast) G.UI.toast(html, 'ach', icon); };

  // ================= What each one looks like =================
  // a visitor's reveal only while it is still there and nobody has tapped it yet
  const still = c => () => { const k = G.rareState().cur; return !!k && k === c && !k.open && k.st !== 'shop' && k.st !== 'out'; };
  G.on('rare', (kind, o) => {
    ensure();
    const L = LOG(kind);
    if (kind === 'merchant') { SFX.bell(); reveal({ kind, title: T('rfMerchant'), sub: T('rfMerchantSub'), col: L.col, icon: icoUrl('rare_merchant', 5), stale: 14000, ok: still(o), ms: 2400 }); }
    else if (kind === 'land') reveal({ kind, tag: T('rfLandTag'), title: o.name.toUpperCase(), sub: o.sub, col: o.col, icon: icoUrl('ic_star', 7), sfx: 'land', ms: 3200, big: true, flash: 0.7, shake: 7 });
    else if (kind === 'horde') reveal({ kind, title: T('rfHorde'), sub: T('rfHordeSub'), col: '#ffd84a', icon: icoUrl('ev_stampede', 6, { gold: true }), ms: 2600, big: true });
    else if (kind === 'well') reveal({ kind, title: T('rfWell'), sub: T('rfWellSub'), col: L.col, icon: icoUrl('rare_well', 5), stale: 16000, ok: still(o), ms: 2400 });
    else if (kind === 'gambler') reveal({ kind, title: T('rfGambler'), sub: T('rfGamblerSub'), col: L.col, icon: icoUrl('rare_ghost', 6), stale: 14000, ok: still(o), ms: 2400 });
    else if (kind === 'star') SFX.star();
    else if (kind === 'king') { SFX.king(); reveal({ kind, title: T('rfKing'), sub: T('rfKingSub'), col: L.col, icon: icoUrl('m_thief', 7, { gold: true }), stale: 12000, ok: () => G.rareState().cur === o, ms: 2200 }); }
    else if (kind === 'pet') {
      const P = o.pet;
      reveal({ kind, title: T('rfPet'), sub: P.name + ' · ' + P.desc, col: '#ff5fd2', icon: icoUrl('p_' + P.id, 12, o.golden ? { gold: true } : null), cls: 'mythic', ms: 3600, big: true, flash: 0.7, shake: 6 });
    }
    else if (kind === 'legend') {
      reveal({ kind, title: T('rfLegend'), sub: T('rfLegendSub') + ' +' + fmt(o.gold) + ' gold', col: '#ffffff', icon: icoUrl('ic_jackpot', 7), cls: 'legend', sfx: 'legend', ms: 4800, big: true, flash: 1, shake: 12 });
    }
  });

  // ---------- The merchant's shop ----------
  let panel = null, panelKind = null, panelT0 = 0, panelTimer = null, back = null;
  function closePanel() {
    if (!panel) return;
    const p = panel, b = back; panel = null; panelKind = null; back = null; clearInterval(panelTimer); panelTimer = null;
    p.classList.add('out'); setTimeout(() => p.remove(), 320);
    if (b) { b.classList.add('out'); setTimeout(() => b.remove(), 320); }
    if (wrap) wrap.classList.remove('rfPanelOn');
  }
  function openPanel(kind, col, html) {
    if (!ensure()) return null;
    closePanel();
    // a dim backdrop that swallows taps meant for the field
    back = document.createElement('div'); back.className = 'rfBack';
    back.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); });
    wrap.appendChild(back);
    wrap.classList.add('rfPanelOn');
    const p = document.createElement('div');
    p.className = 'rfPanel ' + kind; p.style.setProperty('--c', col);
    p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', kind);
    p.innerHTML = html;
    p.addEventListener('pointerdown', e => e.stopPropagation());
    wrap.appendChild(p);
    panel = p; panelKind = kind; panelT0 = performance.now();
    return p;
  }
  function shopHtml(c) {
    const S = G.S;
    const offers = c.offers.map((o, i) => {
      const W = G.RARE_WARES[o.k], can = G.rareCanBuy(i);
      return `<div class="rfOffer ${o.sold ? 'sold' : ''}" style="--o:${W.col}"><img src="${icoUrl(W.icon, 4)}" alt=""><b>${esc(W.name)}</b><small>${esc(o.desc)}</small>` +
        `<s>${fmt(o.was)}</s><span class="rfPrice"><img src="${icoUrl(o.cur === 'gold' ? 'ic_coin' : 'ic_shard', 2)}" alt="">${fmt(o.price)} ${esc(o.cur === 'gold' ? T('rfGold') : T('rfShards'))}</span>` +
        `<button type="button" data-buy="${i}" ${o.sold || !can ? 'disabled' : ''}>${esc(o.sold ? T('rfShopSold') : T('rfShopBuy'))}</button></div>`;
    }).join('');
    return `<div class="rfHead"><img src="${icoUrl('rare_merchant', 4)}" alt=""><div><b>${esc(T('rfMerchant'))}</b><small>${esc(T('rfShopHi'))}</small>` +
      `<small style="color:#ffd84a">${img('ic_coin')} ${fmt(S.gold)} · ${img('ic_shard')} ${fmt(S.hero.shards || 0)}</small></div></div>` +
      `<div class="rfTime"><i></i></div><div class="rfOffers">${offers}</div>` +
      `<div class="rfBtns"><button type="button" class="ghost" data-leave>${esc(T('rfShopLeave'))}</button></div>`;
  }
  const img = id => `<img src="${icoUrl(id, 2)}" alt="" style="width:12px;height:12px;vertical-align:-1px;image-rendering:pixelated">`;
  function openShop(c) {
    const p = openPanel('shop', '#ffd84a', shopHtml(c));
    if (!p) return;
    SFX.bell();
    const total = (G.TUNE.rareShopTime || 30) * 1000;
    const bind = () => {
      p.querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', e => {
        e.stopPropagation();
        const i = +b.dataset.buy, o = c.offers[i];
        const got = G.rareBuy(i);
        if (!got) { SFX.sad(); return; }
        SFX.buy();
        afterBuy(c, o, got);
        const keep = p.querySelector('.rfTime i').style.width;
        p.innerHTML = shopHtml(c); p.querySelector('.rfTime i').style.width = keep; bind();
      }));
      const lv = p.querySelector('[data-leave]');
      if (lv) lv.addEventListener('click', e => { e.stopPropagation(); leaveShop(); });
    };
    bind();
    panelTimer = setInterval(() => {
      if (panel !== p) return;
      const k = 1 - (performance.now() - panelT0) / total;
      const bar = p.querySelector('.rfTime i'); if (bar) bar.style.width = Math.max(0, k * 100) + '%';
      if (k <= 0) leaveShop();
    }, 100);
  }
  function leaveShop() {
    const st = G.rareState(), c = st.cur;
    closePanel();
    if (c && c.k === 'merchant') { if (c.bought) toast(`<b>${esc(T('rfShopBye'))}</b>`, 'rare_merchant'); G.rareShopClose(); }
  }
  function afterBuy(c, o, got) {
    const W = G.RARE_WARES[o.k];
    const u = px(), f = feetOf(c, u);
    if (f) { burst(f.x, f.y - 20 * u, [W.col, '#ffffff', '#ffd84a'], 30, 200, { sz: 3 }); ring(f.x, f.y, 6 * u, 34 * u, W.col, 0.6, 3); }
    toast(`<span>${esc(W.name)}: <b style="color:${W.col}">${esc(o.desc)}</b></span>`, W.icon);
  }
  G.on('rareShop', c => openShop(c));
  G.on('rareShopClose', () => { if (panelKind === 'shop') closePanel(); });

  // ---------- The well and the ghost ----------
  function wellHtml(c) {
    const ws = c.wishes.map((k, i) => { const X = G.RARE_WISHES[k]; return `<button type="button" class="rfWish" data-wish="${i}" style="--o:${X.col}"><img src="${icoUrl(X.icon, 4)}" alt=""><span>${esc(X.name.toUpperCase())}<small>${esc(X.desc)}</small></span></button>`; }).join('');
    return `<div class="rfHead"><img src="${icoUrl('rare_well', 4)}" alt=""><div><b>${esc(T('rfWell'))}</b><small>${esc(T('rfWellPick'))}</small></div></div>` +
      `<div class="rfTime"><i></i></div><div class="rfWishes">${ws}</div><div class="rfBtns"><button type="button" class="ghost" data-leave>${esc(T('rfShopLeave'))}</button></div>`;
  }
  function ghostHtml(c, res) {
    const can = !c.done && c.flips < c.max;
    return `<div class="rfHead"><img src="${icoUrl('rare_ghost', 4)}" alt=""><div><b>${esc(T('rfGambler'))}</b><small>${esc(T('rfGamblerSub'))}</small></div></div>` +
      `<div class="rfTime"><i></i></div><div class="rfPot"><img class="rfCoin" src="${icoUrl('ic_coin', 4)}" alt=""><small>${esc(T('rfGhostPot'))} · ${c.flips}/${c.max}</small><b>${fmt(c.pot)}</b>` +
      `<span class="rfRes ${res ? (res.win ? 'win' : 'lose') : ''}">${res ? esc(res.win ? T('rfWin') : T('rfLose')) : ''}</span></div>` +
      `<div class="rfBtns">${c.done ? `<button type="button" class="ghost" data-leave>OK</button>` : `<button type="button" class="ghost" data-take>${esc(T('rfTake'))} · ${fmt(c.pot)}</button>${can ? `<button type="button" data-flip>${esc(T('rfFlip'))}</button>` : ''}`}</div>`;
  }
  function timed(p, ms, onEnd) {
    panelTimer = setInterval(() => {
      if (panel !== p) return;
      const k = 1 - (performance.now() - panelT0) / ms;
      const bar = p.querySelector('.rfTime i'); if (bar) bar.style.width = Math.max(0, k * 100) + '%';
      if (k <= 0) onEnd();
    }, 100);
  }
  function openWell(c) {
    const p = openPanel('well', '#7fe9ff', wellHtml(c));
    if (!p) return;
    p.querySelectorAll('[data-wish]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      const i = +b.dataset.wish, k = c.wishes[i], got = G.rareWish(i);
      closePanel();
      if (got) wishShow(k, got, 'well');
    }));
    p.querySelector('[data-leave]').addEventListener('click', e => { e.stopPropagation(); closePanel(); G.rareDismiss(); });
    timed(p, 20000, () => { closePanel(); G.rareDismiss(); });
  }
  function openGhost(c, res) {
    const p = openPanel('ghost', '#c8d6ff', ghostHtml(c, res));
    if (!p) return;
    if (res) { const coin = p.querySelector('.rfCoin'); if (coin) coin.classList.add('flip'); }
    const fl = p.querySelector('[data-flip]'), tk = p.querySelector('[data-take]'), lv = p.querySelector('[data-leave]');
    if (fl) fl.addEventListener('click', e => {
      e.stopPropagation();
      SFX.flip();
      fl.disabled = true; if (tk) tk.disabled = true;
      const coin = p.querySelector('.rfCoin'); if (coin) { coin.classList.remove('flip'); void coin.offsetWidth; coin.classList.add('flip'); }
      setTimeout(() => {
        const r = G.rareFlip();
        if (!r) { closePanel(); return; }
        const cc = G.rareState().cur || c;
        if (r.win) SFX.win(); else SFX.sad();
        const keepT = panelT0;
        if (c.cashed != null) { closePanel(); ghostCashed(c); return; }
        openGhost(c, r); panelT0 = keepT;
        if (!r.win) setTimeout(() => { if (panelKind === 'ghost') closePanel(); }, 1800);
      }, 600);
    });
    if (tk) tk.addEventListener('click', e => { e.stopPropagation(); const g = G.rareCash(); closePanel(); if (g) ghostCashed(c); });
    if (lv) lv.addEventListener('click', e => { e.stopPropagation(); closePanel(); });
    timed(p, 20000, () => { closePanel(); G.rareDismiss(); });
  }
  function ghostCashed(c) {
    SFX.coin();
    const u = px(), f = feetOf(c, u);
    if (f) { burst(f.x, f.y - 20 * u, ['#ffd84a', '#fff3a0', '#ffffff'], 40, 240, { sz: 3 }); floatText(f.x, f.y - 40 * u, '+' + fmt(c.cashed), '#ffd84a', Math.round(clamp(u * 3.2, 9, 13)), 1.6); }
    if (c.flips >= 3 && G.UI && G.UI.bannerShow) reveal({ title: '+' + fmt(c.cashed), tag: T('rfGambler'), sub: T('rfGhostBye') + ' ×' + Math.pow(2, c.flips), col: '#ffd84a', icon: icoUrl('ic_coin', 7), ms: 2200, noCount: 1, sfx: 'win' });
    else toast(`<span>${esc(T('rfGhostBye'))} <b style="color:#ffd84a">+${fmt(c.cashed)}</b></span>`, 'rare_ghost');
  }
  G.on('rareOpen', c => { if (c.k === 'well') openWell(c); else if (c.k === 'gambler') openGhost(c); });
  function wishShow(k, got, src) {
    const X = G.RARE_WISHES[k] || { name: k === 'mythic' ? 'A mythic pet' : k === 'trove' ? 'A chest trove' : k === 'eggs' ? 'Eggs' : k, col: '#fff3a0', icon: 'ic_star' };
    const bits = [];
    if (got.gold) bits.push('+' + fmt(got.gold) + ' gold');
    if (got.orbs) bits.push(got.orbs + ' orbs');
    if (got.eggs) bits.push(got.eggs + ' eggs');
    if (got.pet && G.PET_BY_ID[got.pet]) bits.push(G.PET_BY_ID[got.pet].name);
    if (got.uq && G.UNIQUES[got.uq]) bits.push(G.UNIQUES[got.uq].name);
    if (got.luck) bits.push('rare surprises ×3 for an hour');
    if (got.chests) bits.push(got.chests + ' chests');
    SFX.wish();
    reveal({ tag: T('rfWishGranted'), title: X.name.toUpperCase(), sub: bits.join(' · '), col: X.col, icon: icoUrl(X.icon, 7), ms: 2400, noCount: 1, sfx: 'wish' });
  }
  G.on('rareStarWish', (c, k, got) => {
    const u = px();
    if (c._x != null) { burst(c._x, c._y, ['#fff3a0', '#ffffff', '#ffd84a', '#7fe9ff'], 80, 320, { sz: 3, grav: 120 }); ring(c._x, c._y, 4 * u, 60 * u, '#fff3a0', 0.8, 3); }
    wishShow(k, got, 'star');
  });
  G.on('rareGone', (c, why) => {
    if (c.k === 'star' && why === 'missed') { const u = px(); floatText(W / 2, H * 0.22, T('rfStarMissed'), '#a9a2b9', Math.round(clamp(u * 3, 9, 12)), 1.6); }
    if ((c.k === 'well' || c.k === 'gambler') && panelKind && (panelKind === 'well' || panelKind === 'ghost')) closePanel();
    if (c.k === 'merchant' && panelKind === 'shop') closePanel();
  });
  G.on('rareLeave', (c, why) => {
    const u = px(), f = feetOf(c, u);
    if (f && why === 'ignored') floatText(f.x, f.y - 46 * u, 'Hmph.', '#d8d2e6', Math.round(clamp(u * 2.8, 8, 11)), 1.4);
  });

  // ---------- The Goblin King ----------
  G.on('rareKingCoins', (c, g) => {
    const u = px(), f = feetOf(c.m, u);
    if (!f) return;
    burst(f.x, f.y - 14 * u, ['#ffd84a', '#fff3a0', '#c98f10'], 14, 200, { sz: 3, grav: 320 });
    if (Math.random() < 0.6) SFX.coin();
  });
  G.on('rareKingKill', (c, rew) => {
    const u = px(), f = feetOf(c.at, u);
    if (f) { burst(f.x, f.y - 14 * u, ['#ffd84a', '#fff3a0', '#ffffff', '#8ae07a'], 120, 360, { sz: 3 }); ring(f.x, f.y, 6 * u, 80 * u, '#ffd84a', 0.9, 4); }
    reveal({ tag: T('rfKing'), title: T('rfKingSlain'), sub: '+' + fmt(rew.gold) + ' gold · ' + rew.drops + ' drops · ' + rew.chests + ' chests', col: '#8ae07a', icon: icoUrl('ic_crown', 7), ms: 2600, noCount: 1, sfx: 'win', big: true });
  });
  G.on('rareKingEscape', c => {
    SFX.sad();
    reveal({ tag: T('rfKing'), title: T('rfKingFled'), sub: c.coins ? '+' + fmt(c.gold) + ' gold shaken loose' : 'Next time...', col: '#a9a2b9', icon: icoUrl('m_thief', 6), ms: 2000, noCount: 1, sfx: 'sad', flash: 0.1, shake: 1 });
  });

  // ---------- A secret land ----------
  const LAND_CLS = { vault: 'rfVault', candy: 'rfCandy', upside: 'rfUpside' };
  G.on('rareLandEnd', (land, why) => {
    if (why === 'force' || why === 'debug' || why === 'run') return;
    const h = land.haul;
    reveal({ tag: land.name.toUpperCase(), title: T('rfLandBack'), sub: T('rfLandHaul', fmt(h.gold), h.chests, h.drops) + (h.eggs ? ' · ' + h.eggs + ' eggs' : ''), col: land.col, icon: icoUrl('ic_chest', 7), ms: 2800, noCount: 1, sfx: 'win' });
  });
  G.on('rareGeyser', g => {
    const u = px(), b = btnXY(u);
    for (let i = 0; i < 26; i++) parts.push({ x: b.x + rnd(-6, 6) * u, y: b.y - 6 * u, vx: rnd(-90, 90), vy: rnd(-420, -220), life: rnd(0.8, 1.3), max: 1.3, col: i % 3 ? '#ffd84a' : '#fff3a0', sz: 3, grav: 520 });
    floatText(b.x, b.y - 60 * u, '+' + fmt(g), '#ffd84a', Math.round(clamp(u * 3, 9, 12)), 1.2);
    if (Math.random() < 0.5) SFX.coin();
  });
  G.on('rareCandyEgg', () => { const u = px(), b = btnXY(u); floatText(b.x + rnd(-40, 40), b.y - 40 * u, '+1 EGG', '#ff8ad8', Math.round(clamp(u * 3, 9, 12)), 1.4); });

  // ---------- A chest trove (the merchant's and the star's; 3.6: in place of Free-Spin Fever) ----------
  G.on('rareTrove', (n, src) => { if (src === 'force' && n) toast(`<span><b style="color:#e0a060">${esc(T('rfTrove'))}</b> ${esc(T('rfTroveSub', n))}</span>`, 'ic_chest'); });
  G.on('rareMidas', () => { SFX.coin(); });

  // ================= Taps =================
  function tapHot() {
    if (G.Audio && G.Audio.unlock) G.Audio.unlock();
    if (G.rareState().cur) G.rareTap();
  }

  // ================= The frame =================
  let last = 0, idle = true, filterCls = '';
  function setFilter(cls) {
    if (cls === filterCls) return;
    const stage = document.getElementById('stage');
    if (!stage) return;
    if (filterCls) stage.classList.remove(filterCls);
    if (cls) stage.classList.add(cls);
    filterCls = cls;
  }
  function wrapBusy() {
    // a window of ours over the field holds it still, like the game's own windows
    if (G.uiBusy && !G.uiBusy._rare) { const prev = G.uiBusy; const f = () => !!panel || prev(); f._rare = 1; G.uiBusy = f; }
  }
  function chipsUpdate(r, now) {
    const S = G.S, out = [];
    if (r.land && r.land.on) out.push(`<span class="rfChip" style="--c:${r.land.col}">${img('ic_star')} ${esc(r.land.name.toUpperCase())}<i>${Math.ceil(Math.max(0, r.land.t))}s</i></span>`);
    if (r.gild) out.push(`<span class="rfChip" style="--c:#ffd84a">${esc(T('rfHorde').replace('!', ''))}<i>×${G.TUNE.rareHordeGold}</i></span>`);
    if (r.midas > 0) out.push(`<span class="rfChip" style="--c:#ffd84a">${esc(T('rfMidas'))}<i>${Math.ceil(r.midas)}s</i></span>`);
    if ((S.st.rareLuckT || 0) > (S.st.playTime || 0)) out.push(`<span class="rfChip" style="--c:#8ae07a">${esc(T('rfLuck'))}<i>${Math.ceil((S.st.rareLuckT - S.st.playTime) / 60)}m</i></span>`);
    const html = out.join('');
    if (chips._h !== html) { chips.innerHTML = html; chips._h = html; }
    chips.hidden = !out.length || !!R.town;
    // on a narrow field: under the land's name box, not over it
    if (!chips.hidden && wrap) {
      const wr = wrap.getBoundingClientRect(), rb = $('.hud.top .realm');
      chips.style.top = wr.width < 600 && rb ? Math.round(rb.getBoundingClientRect().bottom - wr.top + 6) + 'px' : '';
    }
  }
  function frame(now) {
    requestAnimationFrame(frame);
    try { step(now); } catch (e) { if (!frame.err) { frame.err = 1; console.error(e); } }
  }
  function step(now) {
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    if (!G.S || !ensure()) return;
    wrapBusy();
    pumpReveals(); watchLive();
    const r = G.rareState(), c = r.cur;
    resize();
    // the secret land's (or the Golden Horde's) colours on the stage itself
    setFilter(R.town ? '' : r.land && r.land.on ? LAND_CLS[r.land.k] : r.gild ? 'rfGild' : '');
    chipsUpdate(r, now);
    const busy = c || r.land || r.gild || r.midas > 0 || parts.length || rings.length || floats.length;
    // the hot spot over a visitor
    placeHot(c);
    if (!busy) { if (!idle) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); } idle = true; return; }
    idle = false;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    if (R.town) return;
    const t = now / 1000, u = px();
    if (r.land && r.land.on) drawLand(r.land, dt, u, t);
    if (r.gild) drawGild(dt, u, t);
    if (r.midas > 0) { const a = 0.18 + 0.08 * Math.sin(t * 6); ctx.globalAlpha = a; ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, W - 6, H - 6); ctx.globalAlpha = 1; }
    if (c) drawCur(c, dt, u, t);
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
      const q = rings[i]; q.life -= dt;
      if (q.life <= 0) { rings.splice(i, 1); continue; }
      const k = 1 - q.life / q.max, rr = q.r0 + (q.r1 - q.r0) * k;
      ctx.globalAlpha = (1 - k) * 0.8; ctx.strokeStyle = q.col; ctx.lineWidth = q.w;
      ctx.beginPath(); ctx.ellipse(q.x, q.y, Math.max(1, rr), Math.max(1, rr * 0.45), 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i]; f.life -= dt;
      if (f.life <= 0) { floats.splice(i, 1); continue; }
      ctx.globalAlpha = Math.min(1, f.life / f.max * 2);
      label(f.str, f.x, f.y - (1 - f.life / f.max) * 18, f.size, f.col);
      ctx.globalAlpha = 1;
    }
  }
  // where a visitor stands on the screen, and the button over it
  function curSpot(c, u, t) {
    if (c.k === 'star') {
      const k = clamp(c.t / c.T, 0, 1), x = c.dir > 0 ? -30 + (W + 60) * k : W + 30 - (W + 60) * k;
      return { x, y: H * c.y + Math.sin(k * Math.PI) * -H * 0.05 + (k * H * 0.08) };
    }
    if (c.k === 'king') return null;
    return feetOf(c, u);
  }
  function placeHot(c) {
    if (!hot) return;
    const tappable = c && !R.town && ((c.k === 'merchant' && (c.st === 'in' || c.st === 'wait')) || ((c.k === 'well' || c.k === 'gambler') && !c.open && !c.done) || (c.k === 'star' && !c.caught));
    if (!tappable || !rect) { hot.hidden = true; return; }
    const u = px(), f = curSpot(c, u, performance.now() / 1000);
    if (!f || f.x < 8 || f.x > W - 8 || f.y < 16 || f.y > H) { hot.hidden = true; return; }
    const big = c.k === 'star' ? 1.4 : 1;
    const w = Math.round(clamp(20 * u, 52, 84) * big), h = Math.round(clamp(24 * u, 60, 96) * (c.k === 'star' ? 0.9 : 1));
    hot.style.width = w + 'px'; hot.style.height = h + 'px';
    hot.style.margin = (c.k === 'star' ? -h / 2 : -h + 6) + 'px 0 0 ' + (-w / 2) + 'px';
    hot.style.left = Math.round(f.x) + 'px'; hot.style.top = Math.round(f.y) + 'px';
    hot.hidden = false;
  }
  function plate(name, x, y, u, col, k, kc) {
    const size = Math.round(clamp(u * 2.6, 8, 11)), bw = clamp(40 * u, 60, 120);
    ctx.font = size + 'px ' + FONT;
    const half = Math.max(bw, ctx.measureText(name).width) / 2 + 4;
    x = clamp(x, half, Math.max(half, W - half)); y = Math.max(size + 4, y);
    label(name, x, y, size, col);
    if (k != null) bar(x, y + 3, bw, Math.max(2, Math.round(u * 0.8)), k, kc || '#f1ece0');
    return x;
  }
  function drawCur(c, dt, u, t) {
    if (c.k === 'king') {
      const m = c.m; if (!R.mobs.includes(m)) return;
      const f = feetOf(m, u); if (!f) return;
      glow(f.x, f.y - 12 * u, 30 * u, 'rgba(255,216,74,0.9)', 0.32 + 0.12 * Math.sin(t * 6));
      ctx.globalAlpha = 0.4; ctx.fillStyle = '#0a0910'; ctx.beginPath(); ctx.ellipse(f.x, f.y, 13 * u, 4 * u, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      const fr = Math.floor(t * 8) % 2 && G.SPR.defs.m_thief_1 ? 'm_thief_1' : 'm_thief';
      const sp = sprite(fr, f.x, f.y + Math.round(Math.abs(Math.sin(t * 10)) * -u), u * 2, { gold: true, flip: m.dir < 0 });
      const top = f.y - (sp ? sp.h : 30 * u);
      crown(f.x, top + 1 * u + Math.sin(t * 4) * u, Math.max(1, u * 1.2));
      const px0 = plate(T('rfKing').replace('!', ''), f.x, top - 9 * u, u, '#ffd84a', clamp(m.hp / m.max, 0, 1), '#ff4f5e');
      bar(px0, Math.max(Math.round(clamp(u * 2.6, 8, 11)) + 4, top - 9 * u) + 3 + Math.max(2, Math.round(u * 0.8)) + 2, clamp(40 * u, 60, 120), Math.max(2, Math.round(u * 0.6)), clamp((m.life || 0) / c.T, 0, 1), '#b36bff');
      if (Math.random() < 0.4) burst(f.x + rnd(-8, 8) * u, f.y - rnd(4, 16) * u, ['#ffd84a', '#fff3a0'], 1, 40, { grav: 120, life: 0.5, sz: 3 });
      return;
    }
    const f = curSpot(c, u, t); if (!f) return;
    if (c.k === 'star') {
      c._x = f.x; c._y = f.y;
      // the tail, then the star
      const dir = c.dir > 0 ? -1 : 1;
      for (let i = 0; i < 18; i++) { ctx.globalAlpha = (1 - i / 18) * 0.8; ctx.fillStyle = i % 3 ? '#fff3a0' : '#ffffff'; const s = Math.max(2, Math.round(u * (1.6 - i / 14))); ctx.fillRect(Math.round(f.x + dir * i * 5 * u * 0.6), Math.round(f.y - i * 0.9 * u), s, s); }
      ctx.globalAlpha = 1;
      glow(f.x, f.y, 34 * u, 'rgba(255,243,160,0.95)', 0.6 + 0.25 * Math.sin(t * 14));
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(t * 3);
      sprite('rare_star', 0, 5.5 * u * 1.4, u * 1.4);
      ctx.restore();
      const sz = Math.round(clamp(u * 3.2, 9, 14));
      label(T('rfStar'), clamp(f.x, 70, W - 70), f.y + 16 * u + sz + (Math.sin(t * 10) > 0 ? 1 : 0), sz, '#fff3a0');
      if (Math.random() < 0.7) burst(f.x, f.y, ['#fff3a0', '#ffffff', '#7fe9ff'], 1, 30, { grav: 40, life: 0.8, sz: 2 });
      return;
    }
    const bob = Math.round(Math.sin(t * 3) * u * 0.8);
    if (c.k === 'merchant') {
      const walking = c.st === 'in' || c.st === 'out';
      const step = walking ? Math.round(Math.abs(Math.sin(t * 9)) * u) : 0;
      // the lantern's light, and the man himself
      glow(f.x - 7 * u, f.y - 9 * u, 22 * u, 'rgba(255,226,122,0.9)', 0.32 + 0.1 * Math.sin(t * 7));
      ctx.globalAlpha = 0.35; ctx.fillStyle = '#0a0910'; ctx.beginPath(); ctx.ellipse(f.x, f.y, 10 * u, 3 * u, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      const s = sprite('rare_merchant', f.x, f.y - step + (walking ? 0 : bob), u * 1.5, { flip: c.st === 'out' });
      const top = f.y - (s ? s.h : 24 * u) - 4 * u;
      if (c.st === 'wait' || c.st === 'in') {
        // a "!" over his head, and how long he will wait
        const ex = Math.round(clamp(u * 4.4, 12, 18));
        label('!', f.x, top + Math.sin(t * 8) * 2 * u - 6, ex, '#ffd84a');
        plate(T('rfMerchantName').toUpperCase(), f.x, top - ex - 4, u, '#ffd84a', c.st === 'wait' ? c.wait / (G.TUNE.rareMerchantWait || 24) : 1, '#ffd84a');
        if (Math.random() < 0.15) burst(f.x + rnd(-10, 10) * u, f.y - rnd(4, 20) * u, ['#ffd84a', '#fff3a0'], 1, 20, { grav: -20, life: 0.8, sz: 2 });
      }
      return;
    }
    if (c.k === 'well') {
      const sink = c.done ? clamp((c.t - (c.T - 1.2)) / 1.2, 0, 1) : 0;
      ctx.globalAlpha = 1 - sink;
      glow(f.x, f.y - 8 * u, 26 * u, 'rgba(90,232,255,0.9)', 0.25 + 0.1 * Math.sin(t * 4));
      sprite('rare_well', f.x, f.y + sink * 10 * u, u * 1.3);
      ctx.globalAlpha = 1;
      if (Math.random() < 0.2) burst(f.x + rnd(-8, 8) * u, f.y - rnd(6, 18) * u, ['#7fe9ff', '#ffffff', '#ffd84a'], 1, 20, { grav: -30, life: 1, sz: 2 });
      if (!c.open && !c.done) plate(T('rfWell'), f.x, f.y - 26 * u, u, '#7fe9ff', 1 - c.t / c.T, '#7fe9ff');
      return;
    }
    if (c.k === 'gambler') {
      const fade = c.done ? clamp((c.t - (c.T - 2.5)) / 2.5, 0, 1) : 0;
      ctx.globalAlpha = (0.72 + 0.2 * Math.sin(t * 5)) * (1 - fade);
      sprite('rare_ghost', f.x, f.y - 6 * u + Math.sin(t * 2.2) * 3 * u, u * 1.3);
      ctx.globalAlpha = 1;
      if (Math.random() < 0.2) burst(f.x + rnd(-8, 8) * u, f.y - rnd(4, 20) * u, ['#c8d6ff', '#ffffff'], 1, 16, { grav: -40, life: 0.9, sz: 2 });
      if (!c.open && !c.done) plate(T('rfGambler'), f.x, f.y - 30 * u, u, '#c8d6ff', 1 - c.t / c.T, '#c8d6ff');
    }
  }
  // a secret land's weather: gold dust, candy confetti, loot bubbles rising
  function drawLand(land, dt, u, t) {
    const col = land.col;
    // a tinted edge round the field
    const g = ctx.createRadialGradient(W / 2, H * 0.5, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, land.k === 'vault' ? 'rgba(255,190,40,0.35)' : land.k === 'candy' ? 'rgba(255,110,210,0.32)' : 'rgba(90,232,255,0.3)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const n = land.k === 'candy' ? 3 : 2;
    for (let i = 0; i < n; i++) {
      if (parts.length > 500) break;
      if (land.k === 'vault') parts.push({ x: rnd(0, W), y: -6, vx: rnd(-10, 10), vy: rnd(40, 90), life: rnd(3, 6), max: 6, col: Math.random() < 0.6 ? '#ffd84a' : '#fff3a0', sz: 2, grav: 0 });
      else if (land.k === 'candy') parts.push({ x: rnd(0, W), y: -6, vx: rnd(-30, 30), vy: rnd(50, 110), life: rnd(3, 6), max: 6, col: ['#ff8ad8', '#7fe9ff', '#ffd84a', '#b6ff5a', '#c88aff'][Math.floor(Math.random() * 5)], sz: 3, grav: 0 });
      else parts.push({ x: rnd(0, W), y: H + 6, vx: rnd(-8, 8), vy: -rnd(40, 100), life: rnd(3, 6), max: 6, col: Math.random() < 0.5 ? '#7fe9ff' : '#ffffff', sz: 2, grav: 0 });
    }
    // gilded goblins sparkle
    let k = 0;
    for (const m of R.mobs) { if (!m.rareGob || k++ > 8) continue; if (Math.random() < 0.3) { const f = feetOf(m, u); if (f) burst(f.x + rnd(-6, 6) * u, f.y - rnd(4, 14) * u, [col, '#ffffff'], 1, 30, { grav: 60, life: 0.5, sz: 2 }); } }
  }
  function drawGild(dt, u, t) {
    // a gold glint on a handful of the Horde each frame
    const ms = R.mobs; if (!ms.length) return;
    for (let i = 0; i < 6; i++) {
      const m = ms[Math.floor(Math.random() * ms.length)];
      if (!m || !m.gild) continue;
      const f = feetOf(m, u); if (!f || f.x < 0 || f.x > W || f.y < 0 || f.y > H) continue;
      burst(f.x + rnd(-4, 4) * u, f.y - rnd(4, 12) * u, ['#ffd84a', '#fff3a0', '#ffffff'], 1, 30, { grav: 40, life: 0.5, sz: 2 });
    }
  }

  // ================= The codex =================
  function codexHtml() {
    const rows = G.rareCodex().map(e => {
      const seen = e.n > 0, ic = { merchant: 'rare_merchant', well: 'rare_well', gambler: 'rare_ghost', star: 'rare_star', king: 'm_thief', horde: 'ev_stampede', pet: 'p_goldling', land: 'ic_star', legend: 'ic_jackpot' }[e.id] || e.icon;
      return `<div class="${seen ? '' : 'no'}"><img src="${icoUrl(ic, 3, e.id === 'horde' || e.id === 'king' ? { gold: true } : null)}" alt=""><span><b style="color:${seen ? e.col : '#6d6784'}">${esc(seen ? e.name : T('rfUnseen'))}</b><small>${esc(seen ? T('rfSeenN', e.n) + ' · ' + e.desc : e.odds)}</small></span></div>`;
    }).join('');
    return `<div class="rfCodex">${rows}</div>`;
  }
  G.rareFx = {
    sfx: SFX, reveal, codexHtml,
    openCodex() { if (G.UI && G.UI.modal) G.UI.modal(T('rfCodex'), codexHtml(), [{ label: 'OK', cls: 'gold' }]); },
    state: () => ({ queue: queue.length, panel: panelKind, filter: filterCls, hot: hot && !hot.hidden, parts: parts.length }),
  };
  requestAnimationFrame(frame);
})(globalThis.G = globalThis.G || {});
