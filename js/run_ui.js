// BTTN 4.0 — the Siege on screen: run setup, cards, the loot moment, camp, doors, relics, shrine choices, the win's
// question, the fall's Continue, the run summary (the Furnace) and the run HUD. The rules live in js/run.js: every screen
// here is drawn from its state (S.run) and its events, and every button calls its API. Nothing here changes a rule.
//
// One root (#ru, z 40: over the field and the town window, under #modal, the store and the Daily board). Two kinds of
// screen: the ones over part of the field (the loot moment, the cards, a shrine's choice: their own clocks run, the
// field stays drawn) and the covering ones (setup, summary, camp, doors, relic, the fall, the win: G.uiBusy reports them,
// so main.js draws the field at its low rate under them). Keys are taken first (a capture listener) while a screen is up;
// Space/Enter act only on a FRESH press (a Space held on the field when a screen opens does nothing). Strings: G.tAdd.
(function (G) {
  'use strict';
  if (typeof document === 'undefined' || !G.runStart || !G.on) return;
  const RU = G.RunUI = G.RunUI || {};
  // run.js: a run UI shows the beats, the summary and the setup (no automatic AGAIN, no 4-s auto-resolve of a beat)
  G.runUI = true;
  // the fall waits for the player's answer (Continue or the end): this module asks (the 3.6 fall card did before)
  G.fallAsk = true;
  const R = G.R, TUNE = G.TUNE;
  const run = () => (G.S && G.S.run) || null;
  const on = () => { const r = run(); return !!(r && r.on); };
  const t = function () { return G.t ? G.t.apply(null, arguments) : arguments[0]; };
  const L = s => (G.L ? G.L(s) : s || '');
  const fmt = (n, small) => (G.fmt ? G.fmt(n, small) : String(Math.round(n)));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const now = () => performance.now();
  const reduced = () => { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) || !!(G.S && G.S.set && G.S.set.calm); } catch (e) { return false; } };
  // (uifix: the viewport from js/ui.js's resize-time cache: window.innerWidth forces a layout on a phone)
  const vw = () => (G.UI && G.UI.vw ? G.UI.vw() : window.innerWidth), vh = () => (G.UI && G.UI.vh ? G.UI.vh() : window.innerHeight);
  const narrow = () => vw() <= 600;
  const wideStage = () => vw() > 860 || (vh() <= 520 && vw() > vh());
  const mmss = s => { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const pctTxt = v => (v >= 0 ? '+' : '-') + (Math.abs(v) >= 9.995 ? fmt(Math.round(Math.abs(v) * 100)) : Math.round(Math.abs(v) * 100)) + '%';
  // the run's own auto clock for a camp, the doors, a relic, a shrine (run.js G.beatAfter: Clockwork's 4 s; else the TUNE's)
  const beatAfter = d => (G.beatAfter ? G.beatAfter(d) : d != null ? d : TUNE.campAuto || 30);
  const sfx = function (k) { try { const A = G.Audio; if (A && typeof A[k] === 'function') A[k].apply(A, Array.prototype.slice.call(arguments, 1)); } catch (e) { /* sound is a bonus */ } };
  const safe = (f, d) => { try { return f(); } catch (e) { if (typeof console !== 'undefined') console.error(e); return d; } };

  // ---------- sprites ----------
  const sprB = id => { try { const c = G.SPR.get(id); return c ? c.width + 'x' + c.height : ''; } catch (e) { return ''; } };
  const sprOk = id => { try { return !!G.SPR.get(id); } catch (e) { return false; } };
  // (data-b: ui.js snaps every such icon to whole pixel multiples)
  function img(id, sc, cls) {
    let u = '';
    try { u = G.SPR.url(id, sc || 3); } catch (e) { u = ''; }
    return u ? `<img src="${u}" alt="" class="${cls || ''}" data-b="${typeof id === 'string' ? sprB(id) : ''}" draggable="false">` : '';
  }
  const RAR = r => G.RARITIES[clamp(r | 0, 0, 6)];
  const isRelicQ = q => !!(q && G.UNIQUES[q] && G.UNIQUES[q].relic);
  const isUltra = g => !!(g && (g.q || g.r >= 5));
  const tierOf = g => (!g ? 'normal' : isRelicQ(g.q) ? 'relic' : g.q ? 'unique' : g.r >= 6 ? 'divine' : g.r >= 5 ? 'mythic' : 'normal');
  const TIER_RANK = { normal: 0, mythic: 1, divine: 2, unique: 3, relic: 4 };
  const gcol = g => (g.q ? (isRelicQ(g.q) ? '#ffffff' : G.UNIQUE_COL || '#e8903a') : RAR(g.r).color);
  const gname = g => (g.q ? L(G.UNIQUES[g.q].name) : L((G.ITEM_BY_ID[g.id] || {}).name || g.id));
  const gspr = g => (G.gearSpr ? G.gearSpr(g) : g.q ? 'u_' + g.q : 'it_' + g.id);
  const unitOf = who => (who == null || who < 0 ? G.S.hero : G.S.party[who]);
  const clsOf = who => { const u = unitOf(who); return u && G.CLASS_BY_ID[u.cls] ? G.CLASS_BY_ID[u.cls] : null; };
  const whoName = who => { const C = clsOf(who); return who == null || who < 0 ? t('ru_warden') : C ? L(C.name) : '?'; };
  const whoSpr = who => { const C = clsOf(who); return C ? C.spr : 'h_knight'; };
  const whos = () => [-1].concat(((G.S && G.S.party) || []).map((_, i) => i));
  const SCHOOL_COL = { storm: '#7fe9ff', blades: '#ff9a6a', fire: '#ff5a3a', frost: '#a8dcff', bastion: '#6aa8ff', greed: '#ffd84a', party: '#6ee07a' };
  const schoolName = s => (s ? t('school_' + s) : '');
  const relicName = id => { const U = G.UNIQUES[id]; return U ? L(U.name) : id; };
  const relicFx = id => { const U = G.UNIQUES[id]; return U ? L(U.fx) : ''; };
  const streamOn = () => { try { const St = G.Stream; if (St && (typeof St.on === 'function' ? St.on() : St.on)) return true; const s = G.S && G.S.set; return !!(s && (s.streamer || (s.stream && (s.stream.on || s.stream === true)))); } catch (e) { return false; } };
  const toast = (html, cls, icon, o) => { try { if (G.UI && G.UI.toast) G.UI.toast(html, cls || '', icon || 'ic_star', o || { p: 1 }); } catch (e) { /* the toast column is ui.js's */ } };
  // a near-miss line from run.js: [key, ...args], where an arg can itself be a line
  const line = x => (Array.isArray(x) ? t.apply(null, [x[0]].concat(x.slice(1).map(a => (Array.isArray(a) ? line(a) : a)))) : String(x == null ? '' : x));

  // ---------- strings (English; i18n_ru.js adds Russian later) ----------
  if (G.tAdd) G.tAdd({
    ru_warden: 'Warden', ru_newSiege: 'NEW SIEGE', ru_siegeN: 'Siege #{0}', ru_again: 'AGAIN', ru_start: 'START SIEGE', ru_againOf: '{0} · {1} · Heat {2}',
    ru_first: 'CHOOSE YOUR WARDEN', ru_firstHint: 'Tap one to begin. A Siege starts from nothing: six lands, then the Mad Button.',
    ru_button: 'Button', ru_class: 'Warden', ru_keeps: 'Keepsakes', ru_keepsNone: 'Museum I opens a keepsake slot', ru_keepsEmpty: 'Uniques and relics you find go into the Codex: bring them back here as keepsakes.',
    ru_keepsN: '{0}/{1}', ru_heat: 'Heat', ru_heatLocked: 'Win a Siege to open Heat 1', ru_heatMul: 'Fame ×{0} · Embers ×{1} · rarity +{2}', ru_heatNone: 'No rules: the plain Siege',
    ru_firstDoor: 'First land', ru_code: 'Enter a code', ru_codeGo: 'Replay', ru_codeBad: 'That is not a Siege code', ru_codeNote: 'A replay of that seed (unranked)',
    ru_daily: 'DAILY SIEGE', ru_dailyRanked: 'Ranked: your first try today', ru_dailyPractice: 'Practice: today’s ranked try is done', ru_dailyGo: 'PLAY THE DAILY',
    ru_dailyRule: '{0} · Heat {1} · no keepsakes, no Continue', ru_board: 'Board', ru_locked: 'Locked', ru_stickers: 'Heat won with it', ru_toTown: 'Town',
    ru_btnClassic: 'Classic', ru_btnNoRule: 'No rule: the plain Button', ru_lockHint_rogue: 'Kill 10 Land Champions', ru_lockHint_cleric: 'Revive companions 100 times',
    ru_pickKeys: 'Keys 1-{0} · R reroll · B banish', ru_banishOn: 'Tap a card to banish it from this run', ru_slotsTitle: 'Perks {0}/{1}', ru_gearR: '+{0} gear',
    ru_evo: 'EVOLUTION', ru_evoNeed: 'Needs {0}', ru_rankAdd: 'Rank {0}/{1} +{2}', ru_boon: 'BOON', ru_cardsQ: '+{0} more after this', ru_maxed: 'MAX',
    ru_lootboss: 'BOSS LOOT', ru_lootlord: 'LORD LOOT', ru_lootact: 'ACT BOSS LOOT', ru_lootfinal: 'THE MAD BUTTON’S HOARD', ru_lootvault: 'THE VAULT',
    ru_lootHint: 'Tap: wear it · Hold: stash it · 1-{0} · Space: the best', ru_lootHintPhone: 'Tap: wear it · Hold: stash it', ru_auto: 'Best fit', ru_cantWear: 'can’t wear',
    ru_for: 'for {0}', ru_paused: 'paused', ru_burned: 'Burned: +{0} Embers', ru_equipped: '{0} wears it', ru_stashed: 'Into the bag', ru_take: 'WEAR · {0}', ru_stash: 'STASH',
    ru_ultra: 'ULTRA RARE', ru_tier_mythic: 'MYTHIC', ru_tier_divine: 'DIVINE', ru_tier_unique: 'UNIQUE', ru_tier_relic: 'RELIC', ru_marks: 'Marks', ru_ranks: 'Perk ranks',
    ru_slot_weapon: 'Weapon', ru_slot_ability: 'Ability', ru_slot_armor: 'Armor', ru_slot_ring: 'Ring',
    ru_rule: 'Rule', ru_new: 'NEW', ru_left: 'Take {0} more', ru_info: 'Details', ru_worn: 'Worn', ru_this: 'This', ru_noWorn: 'empty slot',
    ru_campLand: '{0} is behind you', ru_campAct: 'One action', ru_chosen: 'Done', ru_buy: 'Buy', ru_sold: 'Sold', ru_recruitTitle: 'Recruit a companion',
    ru_recruitDone: 'A companion joined the party', ru_noSeat: 'No free seat in this camp', ru_extractArm: 'Tap again: extract and end the run', ru_extractT: 'Extract', ru_extractNote: 'End the run here: everything burns at ×1, nothing at ×0.5.', ru_autoIn: 'On its own in {0}s',
    ru_gold: 'Gold', ru_shards: 'Shards', ru_reforgeT: 'Reforge: item level up to the depth', ru_party: 'Party', ru_market: 'Market', ru_enchHint: 'Raise the lowest enchants first, across the party',
    ru_land: 'Land {0}', ru_vaultOn: 'Vault first', ru_risk: 'Twist', ru_reward: 'Prize', ru_doorGo: 'ENTER', ru_doorVault: 'VAULT, THEN ENTER', ru_champ: 'A Land Champion waits',
    ru_relicBelt: 'Belt', ru_relicFull: 'The belt is full: pick one, then the one it replaces', ru_relicTrue: 'RELIC', ru_relicUq: 'UNIQUE RULE', ru_theme: '+2 {0} ranks while worn',
    ru_replace: 'Replaces {0}', ru_shrineAuto: 'Chosen for you in {0}s', ru_pactAuto: 'Declined in {0}s', ru_chanceCost: '-{0} gold',
    ru_wonBank: 'Return now: +{0} Fame · +{1} Embers', ru_pushHint: 'Push On: corrupted lands, the Tide rises, every land pays more. A fall burns only the Push.',
    ru_returnHint: 'Return: the win, paid in full',
    ru_fallTitle: 'THE BUTTON FALLS', ru_cont: 'CONTINUE', ru_contFree: 'FREE', ru_contNote: 'Back on your feet right here with 1 pip. One a run; the run counts as assisted.',
    ru_contAd: 'WATCH AN AD', ru_contNo: 'No Continue in this run', ru_end: 'END THE RUN', ru_endNote: '+{0} Fame · +{1} Embers', ru_gems: 'Gems {0}', ru_getGems: 'Get Gems',
    ru_sum_fall: 'THE BUTTON FELL', ru_sum_win: 'VICTORY', ru_sum_extract: 'EXTRACTED', ru_sum_abandon: 'ABANDONED', ru_furnace: 'THE FURNACE', ru_more: '+{0} more',
    ru_embers: 'EMBERS', ru_fame: 'FAME', ru_unlocked: 'Unlocked', ru_next: 'Next', ru_town: 'TOWN', ru_codexNew: 'NEW', ru_codexRank: 'RANK {0}', ru_dailyRank: 'Daily Siege: rank #{0}',
    ru_dailyPosting: 'Daily Siege: posting your run to the board…', ru_dailyUnranked: 'Daily Siege: unranked (a repeat or an assisted run)', ru_dailyDone: 'Daily Siege: {0} zones in {1}',
    ru_stats: '{0} zones · {1} · level {2} · {3} cards', ru_skip: 'Tap to skip', ru_base: 'Burned', ru_heatX: 'Heat {0}', ru_extraX: 'Bonus', ru_pushBank: 'The win was banked before the Push',
    ru_sum_pushfall: 'WON · THE PUSH FELL', ru_banked: 'Banked', ru_pushFellLine: 'The Mad Button is slain. The Push held {0} corrupted lands; its pouch burns at half.', ru_pushPouch: 'Below: the Push pouch only',
    ru_unl_heat: 'Heat {0}', ru_bank: 'Banked',
    ru_hudPips: 'Integrity: a wipe or a lost lord fight cracks one; a lord gives one back', ru_hudPouch: 'Embers in the pouch', ru_hudPace: 'Pace against par',
    ru_onPace: 'on pace', ru_hudMend: 'Mend charges', ru_hudKeys: 'Keys', ru_hudHeat: 'Heat', ru_hudBelt: 'Relic belt', ru_newSiegeBtn: 'NEW SIEGE',
    ru_ls: 'LAST STAND', ru_lsSub: 'Hold out: {0}', ru_lsRetry: 'The Mad Button returns: {0}',
    // (continuation 3: runflow's doors at the setup, codes, the Daily's doors, the Push, the Reaper, the Hunt, the summary's extras)
    ru_champLine: 'Champion: {0}', ru_cursedTag: 'CURSED', ru_firstDoorHint: 'Its twist and its prize come with it', ru_heat8: 'Heat 8: one door is cursed',
    ru_codeRun: '{0} · Heat {1}', ru_codeDoors: 'Its first land:', ru_codeLocked: '{0} is locked here: Classic instead', ru_dailyDoor: 'First land:',
    ru_mad: 'THE MAD BUTTON', ru_madSub: 'It walks into the standing Horde', ru_pushOnT: 'PUSH ON · the win is banked: +{0} Fame · +{1} Embers',
    ru_pushLandT: 'Push land {0}: {1} · pays ×{2}', ru_tideUp: 'The Tide rises: the Horde ×{0}', ru_hudTide: 'The Tide: the Horde grows each Push minute', ru_hudPush: 'Push land {0}',
    ru_reaperOn: 'THE REAPER bites ×{0}: catch up with par', ru_reaperOff: 'The Reaper falls back', ru_hudReaper: 'Heat 7: more than 2 minutes behind par, the Horde bites harder',
    ru_hunt: 'THE HUNT: {0} comes for you', ru_golden: 'Golden Clicks {0}', ru_shrinesN: 'Shrines {0}', ru_replay: 'Replay · unranked', ru_swift: 'Under par',
    ru_unl_swift: 'Swift sticker: {0} · Heat {1}', ru_pays: 'pays ×{0}', ru_keepRank: 'Rank {0}/{1}', ru_keepTheme: '+{0} {1} ranks',
  });

  // ---------- CSS ----------
  const CSS = `
#ru{position:fixed;inset:0;z-index:40;pointer-events:none;font:15px/1.3 var(--font-body);color:var(--text);-webkit-user-select:none;user-select:none}
#ru *{box-sizing:border-box}
#ru .ruScr{position:fixed;inset:0;pointer-events:none}
#ru .ruScr.cover{pointer-events:auto;background:rgba(6,5,10,.84);display:flex;align-items:center;justify-content:center;padding:12px;animation:ruFade .22s ease-out}
#ru .ruScr.out{animation:ruOut .22s ease-in forwards;pointer-events:none}
#ru .ruBox{position:relative;width:min(900px,100%);max-height:100%;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;padding:14px 16px 16px;display:grid;grid-template-columns:minmax(0,1fr);gap:12px;align-content:start;
  background:var(--panel);border:3px solid var(--ink);box-shadow:inset 0 0 0 2px var(--line-hi),0 6px 0 var(--ink)}
#ru .ruBox::-webkit-scrollbar{width:10px}#ru .ruBox::-webkit-scrollbar-thumb{background:var(--line);border:2px solid var(--panel)}
#ru h2.ruH{margin:0;font:16px/1.4 var(--font-display);color:var(--gold);text-align:center;text-shadow:3px 3px 0 var(--ink);letter-spacing:.04em}
#ru h3.ruS{margin:4px 0 0;font:8px/1.6 var(--font-display);color:var(--dim);letter-spacing:.06em;text-transform:uppercase;display:flex;justify-content:space-between;gap:8px;align-items:center}
#ru h3.ruS small{font:13px/1.2 var(--font-body);text-transform:none;letter-spacing:0;color:var(--faint)}
#ru .ruNote{margin:0;color:var(--dim);font-size:14px;text-align:center}
#ru .ruRow{display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:center}
#ru .ruX{position:absolute;right:8px;top:8px;width:30px;height:30px;padding:0;display:grid;place-items:center;cursor:pointer;font:12px/1 var(--font-display);color:var(--dim);background:var(--panel2);border:2px solid var(--ink);box-shadow:inset 0 0 0 2px var(--line)}
#ru .btn{pointer-events:auto}
#ru .btn.ruBig{font-size:11px;padding:13px 20px;min-width:180px}
#ru .btn.ruKey{position:relative}
#ru kbd{font:7px/1 var(--font-display);color:var(--dim);background:var(--ink);padding:2px 3px;border:1px solid var(--line)}
#ru .ruChip{display:inline-flex;align-items:center;gap:4px;padding:2px 6px;background:var(--slot);border:2px solid var(--ink);font:8px/1.3 var(--font-display);color:var(--text)}
#ru .ruChip img{width:14px;height:14px}
#ru .ruRbw{background:linear-gradient(90deg,#ff4f7e,#ffa033,#ffd84a,#56d45a,#4fd0ff,#b36bff,#ff4f7e);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent!important;animation:ruRbwT 2.6s steps(26) infinite;text-shadow:none!important;-webkit-text-stroke:.35px rgba(12,11,18,.55);paint-order:stroke fill}
#ru .lmSlam .ruRbw{-webkit-text-stroke:1px rgba(12,11,18,.8)}
#ru .up{color:var(--good)}#ru .dn{color:var(--bad)}#ru .eq{color:var(--faint)}
#ru .ruTimer{font:8px/1 var(--font-display);color:var(--faint);text-align:center}
@keyframes ruFade{from{opacity:0}}
@keyframes ruOut{to{opacity:0}}
@keyframes ruPop{from{transform:scale(.6);opacity:0}}
/* (uifix: the rainbow steps 10 times a second, not every frame: a background-position animation on clipped text repaints the text each step) */
@keyframes ruRbwT{to{background-position:200% 0}}
@keyframes ruSpin{to{transform:rotate(1turn)}}
@keyframes ruPulse{50%{transform:scale(1.08)}}
#ru .lmCard.best .lmUp{will-change:transform}
@keyframes ruShake{0%,100%{transform:translate(0,0) rotate(0)}20%{transform:translate(-2px,1px) rotate(-1.5deg)}40%{transform:translate(2px,-1px) rotate(1.5deg)}60%{transform:translate(-2px,-1px) rotate(-1deg)}80%{transform:translate(2px,1px) rotate(1deg)}}
@keyframes ruDrop{from{transform:translateY(-30px) scale(1.3);opacity:0}}
@keyframes ruSlam{0%{transform:scale(2.4);opacity:0}60%{transform:scale(.92);opacity:1}100%{transform:scale(1)}}
#perks{display:none!important}
/* ---- the run HUD (beside the land strip) ---- */
#ruHud{display:flex;flex-wrap:wrap;gap:3px 5px;align-items:center;margin-top:4px;pointer-events:auto;font:8px/1 var(--font-display);letter-spacing:0;max-width:360px}
#ruHud[hidden]{display:none!important}
#ruHud>span{display:inline-flex;align-items:center;gap:3px;height:18px;padding:0 4px;background:rgba(12,11,18,.78);border:2px solid var(--ink);box-shadow:inset 0 0 0 1px var(--line);color:var(--text);white-space:nowrap}
#ruHud>span img{width:12px;height:12px}
#ruHud .rhPips{gap:4px;padding:0 5px}
#ruHud .rhPips i{position:relative;width:9px;height:9px;transform:rotate(45deg);background:#ff4f7e;box-shadow:0 0 0 1px var(--ink),0 0 5px #ff4f7e88}
#ruHud .rhPips i.off{background:#2a2838;box-shadow:0 0 0 1px var(--ink)}
#ruHud .rhPips.last i:not(.off){animation:ruPulse .6s steps(2) infinite}
#ruHud .rhPips i.crack{animation:ruCrack .9s ease-out}
#ruHud .rhPips i.glow{animation:ruGlow 1.1s ease-out}
@keyframes ruCrack{0%{background:#fff;transform:rotate(45deg) scale(1.8)}30%{background:#ff4f7e;transform:rotate(45deg) scale(1.2)}60%{transform:rotate(45deg) scale(1) translate(1px,-1px)}100%{background:#2a2838}}
@keyframes ruGlow{0%{transform:rotate(45deg) scale(2);box-shadow:0 0 0 1px var(--ink),0 0 16px #fff}100%{transform:rotate(45deg) scale(1)}}
#ruHud .rhPouch b{color:#ffb15a}#ruHud .rhPouch.bump{animation:ruBump .3s ease-out}
@keyframes ruBump{40%{transform:scale(1.25);filter:brightness(1.6)}}
#ruHud .rhPace.behind{color:#ff8a7a}#ruHud .rhPace.ahead{color:#8ae07a}
#ruHud .rhHeat{color:#ff9a4a}
#ruHud .rhTide{color:#c8a0ff}#ruHud .rhReaper{color:#ff6a6a;animation:ruPulse 1s steps(2) infinite}
#ru .ruBanner{position:fixed;z-index:5;left:50%;transform:translate(-50%,-50%);pointer-events:none;text-align:center;white-space:nowrap;animation:lmSlam 2.4s cubic-bezier(.2,1.5,.4,1) forwards}
#ru .ruBanner b{display:block;font:26px/1.1 var(--font-display);letter-spacing:.06em;color:#ff4f4f;text-shadow:3px 3px 0 var(--ink),0 0 18px #ff2a2a}
#ru .ruBanner small{display:block;margin-top:6px;font:9px/1.3 var(--font-display);color:#ffe0c0;text-shadow:2px 2px 0 var(--ink)}
#ru .ruBanner.push b{color:#d8b8ff;text-shadow:3px 3px 0 var(--ink),0 0 18px #9146ff}
@media (max-width:600px){#ru .ruBanner b{font-size:17px}#ru .ruBanner small{font-size:7px;white-space:normal;width:86vw}}
#ruHud .rhBelt{gap:2px;cursor:pointer;padding:0 2px}
#ruHud .rhBelt img{width:14px;height:14px}
#ruHud .rhCode{color:#c8b4ff;font-size:7px}
#ruHud .rhNew{cursor:pointer;color:var(--gold);box-shadow:inset 0 0 0 1px var(--gold);animation:ruPulse 1.2s ease-in-out infinite}
#ruTip{position:fixed;z-index:41;max-width:260px;padding:8px 10px;background:var(--panel);border:2px solid var(--ink);box-shadow:inset 0 0 0 2px var(--line-hi),0 4px 0 var(--ink);font:14px/1.25 var(--font-body);color:var(--text);pointer-events:auto}
#ruTip b{display:block;font:8px/1.5 var(--font-display);color:var(--gold);margin-bottom:3px}
#ruLS{position:absolute;left:50%;top:44px;transform:translateX(-50%);z-index:6;width:min(420px,70%);pointer-events:none;text-align:center;font:10px/1.2 var(--font-display);color:#ff6a5a;text-shadow:2px 2px 0 var(--ink)}
#ruLS[hidden]{display:none!important}
#ruLS .lsBar{height:10px;margin-top:4px;background:var(--ink);border:2px solid var(--ink);box-shadow:inset 0 0 0 1px #ff4f4f88,0 0 10px #ff2a2a66}
#ruLS .lsBar i{display:block;height:100%;width:100%;background:linear-gradient(90deg,#ff2a2a,#ffa033);transform-origin:left;transition:transform .12s linear}
#ruLS.slam{animation:ruSlam .6s cubic-bezier(.2,1.6,.4,1)}
#ruLS small{display:block;font:8px/1.4 var(--font-display);color:#ffd0c0}
@media (max-width:860px){#ruHud{max-width:64vw}#ruLS{top:38px;font-size:9px}}
`;
  // (the screens' own CSS sections are added below, next to their code)
  const CSS_PARTS = [CSS];

  // ---------- the screens ----------
  let root = null;
  const SCR = {};         // name -> { el, cover, keys(e), def(), timers[], armed, closing }
  const STACK = [];       // open order (the last one takes the keys)
  function ensureRoot() {
    if (root && root.isConnected) return root;
    if (!document.getElementById('ruCss')) { const st = document.createElement('style'); st.id = 'ruCss'; st.textContent = CSS_PARTS.join('\n'); document.head.appendChild(st); }
    root = document.getElementById('ru');
    if (!root) { root = document.createElement('div'); root.id = 'ru'; document.body.appendChild(root); }
    return root;
  }
  // open (or re-render) a screen: o = { cover, cls, html, keys(e) -> handled, def() (Enter/Space), stage (anchored to the field) }
  function open(name, o) {
    ensureRoot();
    let s = SCR[name];
    if (s && s.closing) { clearTimers(s); if (s.el) s.el.remove(); delete SCR[name]; s = null; }
    const fresh = !s;
    if (!s) {
      s = SCR[name] = { name, el: document.createElement('div'), timers: [], armed: !(keyDown.Space || keyDown.Enter || keyDown.NumpadEnter), t0: now() };
      root.appendChild(s.el);
      STACK.push(name);
    }
    s.cover = !!o.cover; s.keys = o.keys || null; s.def = o.def || null; s.stage = !!o.stage;
    s.el.className = 'ruScr ru-' + name + (o.cover ? ' cover' : '') + (o.cls ? ' ' + o.cls : '');
    if (o.html != null) s.el.innerHTML = o.html;
    if (s.stage) place(s.el);
    bodyMarks();
    if (fresh) { try { G.emit('ruScreen', name, true); } catch (e) { /* listeners are optional */ } }
    return s;
  }
  // 4.0 (uifix): the page knows a run screen is up - body.ruUp while any is, body.ruStageUp while one sits over the field
  // (the loot moment, a card, a boon, a pact): the desktop's side panel dims and stops taking taps under them (it stayed
  // fully lit and clickable beside the rainbow sheet), and the 3.x chest/combo bar steps back under the loot hint.
  function bodyMarks() {
    const b = document.body; if (!b) return;
    let up = false, st = false;
    for (const k in SCR) { const s = SCR[k]; if (!s || s.closing) continue; up = true; if (s.stage) st = true; }
    if (b.classList.contains('ruUp') !== up) b.classList.toggle('ruUp', up);
    if (b.classList.contains('ruStageUp') !== st) b.classList.toggle('ruStageUp', st);
  }
  function close(name, ms) {
    const s = SCR[name];
    if (!s || s.closing) return;
    const i = STACK.indexOf(name); if (i >= 0) STACK.splice(i, 1);
    if (s.onClose) safe(() => s.onClose());
    const done = () => { clearTimers(s); if (s.el) s.el.remove(); if (SCR[name] === s) delete SCR[name]; bodyMarks(); };
    if (ms > 0 && !reduced()) { s.closing = true; s.el.classList.add('out'); setTimeout(done, ms); } else done();
    bodyMarks();
    try { G.emit('ruScreen', name, false); } catch (e) { /* listeners are optional */ }
  }
  const isOpen = name => !!(SCR[name] && !SCR[name].closing);
  const later = (name, fn, ms) => { const s = SCR[name]; if (!s) return 0; const id = setTimeout(() => { const k = s.timers.indexOf(id); if (k >= 0) s.timers.splice(k, 1); if (SCR[name] === s && !s.closing) safe(fn); }, ms); s.timers.push(id); return id; };
  function clearTimers(s) { for (const id of s.timers) clearTimeout(id); s.timers.length = 0; if (s.raf) cancelAnimationFrame(s.raf); s.raf = 0; }
  // a screen over the field: its box matches the stage on a wide screen; the whole page on a phone
  function place(el) {
    const sw = document.getElementById('stageWrap');
    const wide = wideStage() && sw;
    el.classList.toggle('wide', !!wide);
    if (wide) { const r = sw.getBoundingClientRect(); el.style.left = r.left + 'px'; el.style.top = r.top + 'px'; el.style.width = r.width + 'px'; el.style.height = r.height + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto'; }
    else { el.style.left = el.style.top = el.style.right = el.style.bottom = '0'; el.style.width = el.style.height = ''; }
  }
  window.addEventListener('resize', () => { for (const k in SCR) if (SCR[k].stage && SCR[k].el) place(SCR[k].el); });
  const top = () => { for (let i = STACK.length - 1; i >= 0; i--) { const s = SCR[STACK[i]]; if (s && !s.closing) return s; } return null; };
  // covering screens hold the screen: G.uiBusy says so (the field drops to its low rate; ui.js holds its keys and banners).
  // Not while a card or the loot moment is up over them: their clocks stop under G.uiBusy.
  RU.busy = () => { for (const k in SCR) if (SCR[k].cover && !SCR[k].closing) return !isOpen('cards') && !isOpen('loot'); return false; };
  function wrapBusy() {
    if (!G.uiBusy || G.uiBusy._ru) return;
    const prev = G.uiBusy, f = () => RU.busy() || prev();
    f._ru = 1; G.uiBusy = f;
  }
  RU.state = () => ({ screens: STACK.filter(n => isOpen(n)), cover: RU.busy() });
  // windows of other modules over ours (settings, the store, the Daily board): our keys wait
  const otherWindow = () => { const m = document.getElementById('modal'), it = document.getElementById('intro'); return !!((m && !m.hidden) || (it && !it.hidden) || vis('bStore') || vis('bDaily') || (G.relicShow && G.relicShow())); };
  const vis = id => { const e = document.getElementById(id); return !!(e && !e.hidden && e.offsetParent); };

  // ---------- keys ----------
  const keyDown = {};
  window.addEventListener('keyup', e => {
    keyDown[e.code] = false;
    // (a fresh press is armed by letting go)
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') { for (const k in SCR) SCR[k].armed = true; const s = top(); if (s && !otherWindow() && !(e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) { e.preventDefault(); e.stopPropagation(); } }
  }, true);
  window.addEventListener('blur', () => { for (const k in keyDown) keyDown[k] = false; });
  window.addEventListener('keydown', e => {
    const was = keyDown[e.code];
    keyDown[e.code] = true;
    const s = top();
    if (!s || otherWindow()) return;
    const tg = e.target;
    if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.isContentEditable)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const enter = e.code === 'Enter' || e.code === 'NumpadEnter', space = e.code === 'Space';
    // a focused button of ours takes Enter/Space itself (keyboard users); the field never hears it
    if ((enter || space) && tg && tg.tagName === 'BUTTON' && s.el.contains(tg)) { e.stopPropagation(); return; }
    let used = false;
    if (s.keys) used = !!safe(() => s.keys(e, !was && !e.repeat));
    if (!used && (enter || space)) {
      // only a fresh press: a key held since before the screen came up does nothing
      if (!e.repeat && !was && s.armed && s.def) safe(() => s.def());
      used = true;
    }
    // while a screen is up the field's keys (powers, the town, the boss) wait
    if (used || /^(Digit|Numpad)\d$/.test(e.code) || ['KeyB', 'KeyE', 'KeyF', 'KeyQ', 'KeyV', 'KeyT', 'KeyZ', 'KeyX', 'KeyC'].includes(e.code) || (s.cover && e.code === 'Escape')) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  const digit = e => { const m = /^(Digit|Numpad)([0-9])$/.exec(e.code); return m ? +m[2] : -1; };

  // ---------- my own sound for the big moments (the ultra stings, the suspense); audio.js's own when it has them ----------
  // (an audio.js G.Audio.lootUltra(tier) / G.Audio.ultraRiser() replaces these; the bus follows the Sound switch and volume)
  const Snd = (function () {
    let ac = null, bus = null, noiseB = null;
    const ok = () => { const s = G.S && G.S.set; return !!(s && s.sound && s.vol > 0 && !document.hidden); };
    function ctx() {
      if (!ok()) return null;
      try {
        if (!ac) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ac = new AC(); bus = ac.createGain(); bus.connect(ac.destination); }
        // (resume() is a promise: Safari rejects it with 'Failed to start the audio device' when iOS holds the audio)
        if (ac.state === 'suspended') { const pr = ac.resume(); if (pr && pr.catch) pr.catch(() => {}); }
        bus.gain.value = 0.42 * (G.S.set.vol || 1);
        return ac;
      } catch (e) { return null; }
    }
    function tone(f, d, type, v, w, slide, attack) {
      const c = ctx(); if (!c) return;
      const t0 = c.currentTime + (w || 0), o = c.createOscillator(), g = c.createGain();
      o.type = type || 'square'; o.frequency.setValueAtTime(f, t0);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t0 + d);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v || 0.1, t0 + (attack || 0.008)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      o.connect(g); g.connect(bus); o.start(t0); o.stop(t0 + d + 0.05);
    }
    function noise(d, v, w, f0, f1, type) {
      const c = ctx(); if (!c) return;
      if (!noiseB) { noiseB = c.createBuffer(1, c.sampleRate, c.sampleRate); const a = noiseB.getChannelData(0); for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1; }
      const t0 = c.currentTime + (w || 0), s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = noiseB; s.loop = true; f.type = type || 'bandpass'; f.Q.value = 2; f.frequency.setValueAtTime(f0 || 800, t0); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t0 + d);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v || 0.1, t0 + d * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      s.connect(f); f.connect(g); g.connect(bus); s.start(t0); s.stop(t0 + d + 0.05);
    }
    const n = k => 440 * Math.pow(2, (k - 9) / 12);
    const bell = (f, d, v, w) => [[1, 1], [2.76, 0.45], [5.4, 0.22], [8.93, 0.1]].forEach(([m, g]) => tone(f * m, d / Math.sqrt(m), 'sine', v * g, w));
    const boom = (v, w) => { tone(70, 1.1, 'sine', v, w, 32); noise(0.5, v * 0.5, w, 300, 80, 'lowpass'); };
    const pad = (notes, d, v, w) => notes.forEach((k, i) => { tone(n(k), d, 'sawtooth', v, w, null, 0.35); tone(n(k) * 1.006, d, 'sawtooth', v * 0.7, w + 0.01, null, 0.4); tone(n(k + 12), d * 0.9, 'triangle', v * 0.6, w + 0.02 * i, null, 0.3); });
    return {
      // the beat of suspense before an ultra card turns: a rising hiss and a climbing whine
      riser(sec) { sec = sec || 0.9; noise(sec, 0.12, 0, 400, 5000); tone(n(0), sec, 'sawtooth', 0.035, 0, n(24), 0.3); tone(n(7), sec, 'square', 0.02, 0.05, n(31), 0.3); },
      // one sting a tier, louder and longer than a field drop: mythic a chord, divine a choir, unique a fanfare, relic all of it
      sting(tier) {
        if (!ctx()) return;
        if (tier === 'mythic' || tier === 'relic') {
          boom(0.22, 0);
          [0, 4, 7, 11, 14, 19, 23, 26].forEach((k, i) => tone(n(24 + k), 0.26, i % 2 ? 'triangle' : 'square', 0.07, i * 0.055));
          [12, 16, 19, 23].forEach(k => tone(n(k), 1.6, 'triangle', 0.06, 0.45, null, 0.05));
          bell(n(36), 1.8, 0.09, 0.42);
        }
        if (tier === 'divine' || tier === 'relic') {
          const w = tier === 'relic' ? 0.9 : 0;
          boom(0.24, w);
          pad([0, 4, 7, 12], 2.4, 0.03, w + 0.05);
          for (let i = 0; i < 10; i++) bell(n(36 + [0, 4, 7, 12, 16][i % 5]), 1.2, 0.06, w + 0.2 + i * 0.11);
          noise(1.6, 0.05, w + 0.1, 3000, 9000, 'highpass');
        }
        if (tier === 'unique' || tier === 'relic') {
          const w = tier === 'relic' ? 1.9 : 0;
          boom(0.2, w);
          // ta-ta-taaa: brass in squares and a snare
          [[7, 0, 0.14], [7, 0.16, 0.14], [12, 0.32, 0.9], [11, 1.05, 0.14], [12, 1.2, 0.14], [16, 1.36, 1.1]].forEach(([k, at, d]) => { tone(n(12 + k), d, 'square', 0.06, w + at, null, 0.02); tone(n(k), d, 'sawtooth', 0.04, w + at, null, 0.02); });
          [0, 0.16, 0.32, 1.05, 1.2, 1.36].forEach(at => noise(0.12, 0.08, w + at, 2500, 1800, 'highpass'));
          bell(n(31), 2, 0.08, w + 1.4);
        }
      },
      // (made on the first touch of the page: a context born outside a gesture may start suspended)
      warm() { ctx(); },
      flip(r) { tone(n(24 + r * 2), 0.07, 'square', 0.05); noise(0.06, 0.05, 0, 3000, 6000, 'highpass'); },
      burn() { noise(0.35, 0.05, 0, 1200, 300, 'lowpass'); tone(n(12), 0.25, 'triangle', 0.03, 0, n(0)); },
    };
  })();
  window.addEventListener('pointerdown', () => Snd.warm(), { once: true, capture: true });
  window.addEventListener('keydown', () => Snd.warm(), { once: true, capture: true });
  const ultraSting = tier => { if (G.Audio && typeof G.Audio.lootUltra === 'function') sfx('lootUltra', tier); else Snd.sting(tier); };
  const ultraRiser = sec => { if (G.Audio && typeof G.Audio.ultraRiser === 'function') sfx('ultraRiser', sec); else Snd.riser(sec); };
  // (audio.js's burn when it has one - fieldfx stream; it does not listen to 'lootBurn' itself, so no double)
  const burnSnd = () => { if (G.Audio && typeof G.Audio.burn === 'function') sfx('burn'); else Snd.burn(); };
  // Embers in one decimal under 10 ('0.5', '2.3'), whole over (the Furnace rounds each item to 0.1)
  const fmtE = v => { v = Math.round((+v || 0) * 10) / 10; return v < 10 && v % 1 !== 0 ? v.toFixed(1) : fmt(Math.round(v)); };

  // ---------- flying Embers (a burned card's '+N' into the pouch chip) ----------
  function rectOf(el) { if (!el || !el.getBoundingClientRect) return null; const r = el.getBoundingClientRect(); return r.width || r.height ? { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height } : null; }
  function pouchTarget() { const p = $('#ruHud .rhPouch'); const r = p && p.offsetParent ? rectOf(p) : null; return r || { x: 40, y: 40 }; }
  function floatText(x, y, txt, cls) {
    ensureRoot();
    const e = document.createElement('b'); e.className = 'ruFloat ' + (cls || ''); e.textContent = txt;
    e.style.left = x + 'px'; e.style.top = y + 'px'; root.appendChild(e);
    setTimeout(() => e.remove(), 1300);
  }
  function flyEmbers(from, n, onDone) {
    ensureRoot();
    const a = from && from.x != null ? from : rectOf(from), b = pouchTarget();
    if (!a || reduced()) { bumpPouch(); if (onDone) onDone(); return; }
    const k = clamp(Math.round(n), 2, 7);
    let left = k;
    for (let i = 0; i < k; i++) {
      const e = document.createElement('i'); e.className = 'ruEmb';
      e.style.left = a.x + 'px'; e.style.top = a.y + 'px'; root.appendChild(e);
      const mx = (Math.random() - 0.5) * 120, my = -30 - Math.random() * 70;
      const an = e.animate([{ transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 }, { transform: `translate(calc(-50% + ${mx}px), calc(-50% + ${my}px)) scale(1.5)`, opacity: 1, offset: 0.3 },
        { transform: `translate(calc(-50% + ${b.x - a.x}px), calc(-50% + ${b.y - a.y}px)) scale(.7)`, opacity: 0.9 }], { duration: 650 + i * 70, delay: i * 45, easing: 'cubic-bezier(.4,0,.7,1)', fill: 'forwards' });
      an.onfinish = () => { e.remove(); if (--left === 0) { bumpPouch(); if (onDone) onDone(); } };
    }
  }
  CSS_PARTS.push(`
#ru .ruEmb{position:fixed;width:9px;height:9px;z-index:3;pointer-events:none;background:radial-gradient(circle,#fff6c0 0 25%,#ffb13a 30% 60%,#ff5a1a 65%);box-shadow:0 0 8px #ff8a2a;border-radius:2px}
#ru .ruFloat{position:fixed;z-index:4;pointer-events:none;transform:translate(-50%,-50%);font:12px/1 var(--font-display);color:#ffc35a;text-shadow:2px 2px 0 var(--ink);animation:ruFloatUp 1.25s ease-out forwards;white-space:nowrap}
#ru .ruFloat.big{font-size:16px;color:#fff}
@keyframes ruFloatUp{0%{transform:translate(-50%,-30%) scale(.6);opacity:0}15%{transform:translate(-50%,-60%) scale(1.15);opacity:1}100%{transform:translate(-50%,-260%) scale(1);opacity:0}}
`);

  // ---------- the run HUD ----------
  let hud = null, lsEl = null, tipEl = null;
  const hudKey = {};
  function ensureHud() {
    if (hud && hud.isConnected) return hud;
    const realm = $('.hud.top .realm');
    if (!realm) return null;
    hud = document.createElement('div'); hud.id = 'ruHud'; hud.hidden = true;
    hud.innerHTML = `<span class="rhPips" title="${esc(t('ru_hudPips'))}"></span><span class="rhPouch" title="${esc(t('ru_hudPouch'))}">${img('ic_ember', 2)}<b>0</b></span>`
      + `<span class="rhPace" title="${esc(t('ru_hudPace'))}">${img('ic_clock', 1)}<b>0:00</b></span><span class="rhMend" title="${esc(t('ru_hudMend'))}">${img('ic_heart', 1)}<b>0</b></span>`
      + `<span class="rhKeys" title="${esc(t('ru_hudKeys'))}" hidden>${img('ic_key', 1)}<b>0</b></span><span class="rhHeat" title="${esc(t('ru_hudHeat'))}" hidden></span>`
      + `<span class="rhTide" title="${esc(t('ru_hudTide'))}" hidden>${img('ic_rift', 1)}<b></b></span><span class="rhReaper" title="${esc(t('ru_hudReaper'))}" hidden>${img('ic_skull', 1)}<b></b></span>`
      + `<span class="rhBelt" title="${esc(t('ru_hudBelt'))}" hidden></span><span class="rhCode" hidden></span>`;
    // (after the land strip's own lines: depth, omen, rival, goal)
    realm.appendChild(hud);
    hud.addEventListener('click', e => {
      const b = e.target.closest('[data-relic]');
      if (b) { e.stopPropagation(); relicTip(b.dataset.relic, b); return; }
      if (e.target.closest('.rhNew')) { RU.setup(); }
    });
    const sw = document.getElementById('stageWrap');
    if (sw && !lsEl) { lsEl = document.createElement('div'); lsEl.id = 'ruLS'; lsEl.hidden = true; lsEl.innerHTML = `<span class="lsT"></span><div class="lsBar"><i></i></div><small></small>`; sw.appendChild(lsEl); }
    return hud;
  }
  const setT = (el, s) => { if (el && el._t !== s) { el._t = s; el.textContent = s; } };
  const setH = (el, h) => { if (el && el.hidden !== !!h) el.hidden = !!h; };
  function relicTip(id, anchor) {
    if (tipEl) { tipEl.remove(); tipEl = null; }
    const r = rectOf(anchor) || { x: 100, y: 100, h: 10 };
    tipEl = document.createElement('div'); tipEl.id = 'ruTip';
    tipEl.innerHTML = `<b class="${isRelicQ(id) ? 'ruRbw' : ''}">${esc(relicName(id))}</b>${esc(relicFx(id))}`;
    document.body.appendChild(tipEl);
    const w = Math.min(260, window.innerWidth - 16);
    tipEl.style.left = clamp(r.x - w / 2, 8, window.innerWidth - w - 8) + 'px'; tipEl.style.top = (r.y + r.h / 2 + 6) + 'px';
    const off = ev => { if (tipEl && !tipEl.contains(ev.target)) { tipEl.remove(); tipEl = null; document.removeEventListener('pointerdown', off, true); } };
    setTimeout(() => document.addEventListener('pointerdown', off, true), 0);
    setTimeout(() => { if (tipEl) { tipEl.remove(); tipEl = null; } }, 5000);
  }
  function bumpPouch() { const p = hud && hud.querySelector('.rhPouch'); if (p) { p.classList.remove('bump'); void p.offsetWidth; p.classList.add('bump'); } hudUpdate(true); }
  // (5 times a second at most: text only where it changed)
  function hudUpdate(force) {
    if (!ensureHud()) return;
    const r = run(), live = !!(r && r.on);
    // between runs the strip offers the way back in
    if (!live) {
      if (hudKey.mode !== 'new') { for (const k in hudKey) delete hudKey[k]; hudKey.mode = 'new'; hud.innerHTML = `<span class="rhNew" role="button" tabindex="0">${esc(t('ru_newSiegeBtn'))}</span>`; }
      setH(hud, !!G.S.fallen);
      if (lsEl) setH(lsEl, true);
      return;
    }
    if (hudKey.mode !== 'run') { hud.remove(); hud = null; for (const k in hudKey) delete hudKey[k]; if (!ensureHud()) return; hudKey.mode = 'run'; }
    hud.hidden = false;
    const pipsK = r.pips + '/' + r.pipMax;
    if (hudKey.pips !== pipsK) {
      hudKey.pips = pipsK;
      const el = hud.querySelector('.rhPips');
      let h = '';
      for (let i = 0; i < (r.pipMax | 0); i++) h += `<i class="${i < (r.pips | 0) ? '' : 'off'}"></i>`;
      el.innerHTML = h;
      el.classList.toggle('last', (r.pips | 0) === 0 && G.runSlot && G.runSlot() > 0);
    }
    setT(hud.querySelector('.rhPouch b'), fmt(Math.floor(r.pouch || 0)));
    const p = G.runPace ? G.runPace() : null, pe = hud.querySelector('.rhPace');
    if (p) {
      const b = Math.round(p.behind), txt = b > 0 ? '+' + mmss(b) : '-' + mmss(-b);
      setT(pe.querySelector('b'), txt);
      if (pe._c !== (b > 0)) { pe._c = b > 0; pe.classList.toggle('behind', b > 0); pe.classList.toggle('ahead', b <= 0); }
    }
    setT(hud.querySelector('.rhMend b'), (r.mend | 0) + '/' + (r.mendMax | 0));
    const ke = hud.querySelector('.rhKeys'); setH(ke, !(r.keys > 0)); if (r.keys > 0) setT(ke.querySelector('b'), String(r.keys | 0));
    const he = hud.querySelector('.rhHeat'); setH(he, !(r.heat > 0)); if (r.heat > 0) setT(he, 'H' + (r.heat | 0));
    // (runflow: a Push's land and Tide; Heat 7's Reaper while it bites)
    const te = hud.querySelector('.rhTide'); setH(te, !r.push); if (r.push) setT(te.querySelector('b'), 'P' + Math.max(1, (G.runSlot ? G.runSlot() : 0) - G.SIEGE.lands + 1) + ' ×' + (G.runTide ? (+G.runTide()).toFixed(2) : '1.00'));
    const rk = r.reaperStep > 0 && G.runReaper ? +G.runReaper() : 1, re_ = hud.querySelector('.rhReaper'); setH(re_, !(rk > 1)); if (rk > 1) setT(re_.querySelector('b'), '×' + rk.toFixed(2));
    const beltK = (r.belt || []).join(',');
    if (hudKey.belt !== beltK) {
      hudKey.belt = beltK;
      const be = hud.querySelector('.rhBelt');
      be.innerHTML = (r.belt || []).map(id => `<i data-relic="${esc(id)}" title="${esc(relicName(id) + ': ' + relicFx(id))}">${img('u_' + id, 1)}</i>`).join('');
      setH(be, !(r.belt && r.belt.length));
    }
    const ce = hud.querySelector('.rhCode'), so = streamOn();
    setH(ce, !so); if (so) setT(ce, G.runCode ? G.runCode() : '');
    // the Last Stand's clock
    const LS = R.lastStand;
    if (lsEl) {
      setH(lsEl, !LS);
      if (LS) {
        setT(lsEl.querySelector('.lsT'), t('ru_ls'));
        const k = clamp(LS.t / (LS.T || 1), 0, 1), bar = lsEl.querySelector('.lsBar i');
        const tr = 'scaleX(' + k.toFixed(3) + ')'; if (bar._tr !== tr) { bar._tr = tr; bar.style.transform = tr; }
        setT(lsEl.querySelector('small'), t(LS.retry ? 'ru_lsRetry' : 'ru_lsSub', mmss(LS.t)));
      }
    }
  }
  G.on('pip', (delta, pips, why, kind) => {
    hudUpdate(true);
    const el = hud && hud.querySelector('.rhPips'); if (!el) return;
    const ps = el.querySelectorAll('i');
    if (kind === 'lost' || kind === 'last') { const i = ps[pips | 0]; if (i) { i.classList.remove('crack'); void i.offsetWidth; i.classList.add('crack'); } toast(`<b>${esc(t(kind === 'last' ? 'pip_last' : 'pip_lost'))}</b>`, 'ach', 'ic_heart', { p: 2 }); }
    else if (kind === 'gain') { for (let k = Math.max(0, (pips | 0) - delta); k < (pips | 0); k++) { const i = ps[k]; if (i) { i.classList.remove('glow'); void i.offsetWidth; i.classList.add('glow'); } } toast(`<b>${esc(t('pip_back'))}</b>`, 'ach', 'ic_heart'); }
    else if (kind === 'muster') {
      // (uifix: a new player who wipes every 20 s in land 1 read this line after every wipe, with the wipe tip under it:
      // once a land is enough - the coach's 'Button broke' tip says why, and the pips on the HUD stay lit)
      const r = run(), key = (r ? r.n + ':' + Math.floor((G.S.depth | 0) / (G.REALM_SIZE || 3)) : '0');
      if (musterSaid !== key) { musterSaid = key; toast(esc(t('pip_muster')), '', 'ic_heart', { k: 'muster', p: 0 }); }
    }
  });
  let musterSaid = '';
  G.on('pouch', () => { if (!pouchHold) hudUpdate(); });
  let pouchHold = 0;
  ['key', 'mendCharge', 'relicPick', 'runStart', 'runResume', 'boon'].forEach(k => G.on(k, () => hudUpdate(true)));
  G.on('lastStand', L => { hudUpdate(true); if (lsEl) { lsEl.classList.remove('slam'); void lsEl.offsetWidth; lsEl.classList.add('slam'); } sfx('horn'); });
  G.on('lastStandEnd', () => hudUpdate(true));
  // a banner across the field (the Mad Button walking in): DOM over the stage, never in the way, gone in 2.4 s
  function banner(title, sub, cls) {
    ensureRoot();
    const sw = document.getElementById('stageWrap'), rr = sw && sw.getBoundingClientRect();
    const e = document.createElement('div'); e.className = 'ruBanner ' + (cls || '');
    e.innerHTML = `<b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}`;
    e.style.left = (rr && rr.width ? rr.left + rr.width / 2 : window.innerWidth / 2) + 'px';
    e.style.top = (rr && rr.height ? rr.top + rr.height * 0.3 : window.innerHeight * 0.3) + 'px';
    root.appendChild(e); setTimeout(() => e.remove(), 2500);
  }
  // runflow's moments the player must see: the Mad Button enters at once after the Last Stand (into the standing Horde),
  // PUSH ON banks the win, each Push land and its pay, the Tide's steps, the Reaper (Heat 7), the Hunt Pact's champion
  G.on('madButton', () => { hudUpdate(true); banner(t('ru_mad'), t('ru_madSub')); sfx('horn'); });
  G.on('pushOn', r => { hudUpdate(true); const b = (r && r.pushBank) || {}; toast(`<b>${esc(t('ru_pushOnT', fmt(b.fame || 0), fmt(b.embers || 0)))}</b>`, 'ach', 'ic_fame', { p: 2 }); });
  G.on('pushLand', (k, o) => {
    hudUpdate(true);
    const Rm = (o && G.REALMS[o.land]) || {}, slot = G.SIEGE.lands + (k | 0) - 1;
    let nm = L(Rm.name || (o && o.name) || ''); if (G.corrupt && G.REALM_SIZE) nm = safe(() => G.corrupt(nm, slot * G.REALM_SIZE), nm);
    toast(`<b>${esc(t('ru_pushLandT', k, nm, G.runPushMul ? (+G.runPushMul(slot)).toFixed(2) : '1'))}</b>`, 'ach', 'ic_skull', { p: 2 });
  });
  G.on('tide', f => { hudUpdate(true); toast(esc(t('ru_tideUp', (+f || 1).toFixed(2))), '', 'ic_skull', { k: 'tide', p: 1 }); });
  G.on('reaper', (f, step) => {
    hudUpdate(true);
    if (f > 1) { toast(`<b>${esc(t('ru_reaperOn', (+f).toFixed(2)))}</b>`, 'ach', 'ic_skull', { k: 'reaper', p: 2 }); if ((step | 0) <= 1) sfx('horn'); }
    else toast(esc(t('ru_reaperOff')), '', 'ic_clock', { k: 'reaper', p: 1 });
  });
  G.on('huntChamp', c => toast(`<b>${esc(t('ru_hunt', L((c && c.name) || '')))}</b>`, 'ach', 'ic_skull', { p: 2 }));

  // ---------- RUN SETUP (DESIGN §2.1): Button, class, keepsakes, Heat, the first door; AGAIN; a code; the Daily ----------
  CSS_PARTS.push(`
#ru .ru-setup .ruBox{width:min(920px,100%)}
#ru .suTop{display:grid;gap:6px;justify-items:center}
#ru .suTop small{color:var(--dim)}
#ru .suAgain{display:grid;justify-items:center;gap:4px}
#ru .suAgain small{color:var(--dim);font-size:13px}
#ru .suGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
#ru .suGrid.cls{grid-template-columns:repeat(auto-fill,minmax(120px,1fr))}
#ru .suCard{position:relative;display:grid;justify-items:center;align-content:start;gap:3px;padding:8px 6px 9px;cursor:pointer;text-align:center;color:var(--text);
  background:var(--panel2);border:2px solid var(--ink);box-shadow:inset 0 0 0 2px var(--line);font:13px/1.2 var(--font-body)}
#ru .suCard:hover{box-shadow:inset 0 0 0 2px var(--line-hi)}
#ru .suCard.on{background:var(--slot-hi);box-shadow:inset 0 0 0 2px var(--gold),0 0 10px #ffd84a44}
#ru .suCard.lock{opacity:.5;cursor:default}
#ru .suCard.lock img{filter:brightness(0) opacity(.6)}
#ru .suCard img{width:44px;height:44px}
#ru .suCard b{font:8px/1.5 var(--font-display);color:var(--gold);font-weight:normal}
#ru .suCard small{color:var(--dim);font-size:13px;line-height:1.2}
#ru .suCard em{font:7px/1.3 var(--font-display);font-style:normal;color:var(--role,var(--dim))}
#ru .suCard .stk{display:flex;gap:2px;margin-top:2px}
#ru .suCard .stk i{width:6px;height:6px;background:#2a2838;border:1px solid var(--ink)}
#ru .suCard .stk i.on{background:#ff9a4a}
#ru .suCard .rk{position:absolute;right:4px;top:4px;font:7px/1 var(--font-display);color:var(--gold)}
#ru .suHeat{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;align-items:center;padding:8px 10px;background:var(--panel2);border:2px solid var(--ink);box-shadow:inset 0 0 0 2px var(--line)}
#ru .suDial{display:flex;align-items:center;gap:6px}
#ru .suDial b{min-width:58px;text-align:center;font:16px/1 var(--font-display);color:#ff9a4a;text-shadow:2px 2px 0 var(--ink)}
#ru .suDial button{width:34px;height:34px;padding:0;font:14px/1 var(--font-display)}
#ru .suRules{display:grid;gap:2px;font-size:13px;color:var(--dim)}
#ru .suRules .add{color:#ffd0a0}
#ru .suRules small{color:var(--faint)}
#ru .suFoot{display:grid;gap:8px;justify-items:center;position:sticky;bottom:-16px;padding:10px 0 4px;background:linear-gradient(transparent,var(--panel) 30%)}
#ru .suCode{display:flex;gap:6px;align-items:center;justify-content:center;flex-wrap:wrap}
#ru .suCode input{width:220px;max-width:60vw;padding:7px 8px;font:13px/1.2 ui-monospace,monospace;color:var(--text);background:var(--ink);border:2px solid var(--line);-webkit-user-select:text;user-select:text;text-transform:uppercase}
#ru .suCode small{width:100%;text-align:center;color:var(--faint);font-size:12px}
#ru .suDaily{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;padding:8px 10px;background:linear-gradient(90deg,#3a2414,#262331);border:2px solid var(--ink);box-shadow:inset 0 0 0 2px var(--fame)}
#ru .suDaily b{font:9px/1.5 var(--font-display);color:var(--fame)}
#ru .suDaily small{display:block;color:var(--dim);font-size:13px}
#ru .suDaily .acts{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
#ru .suFirst .suGrid{grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;max-width:640px;margin:0 auto;width:100%}
#ru .suFirst .suCard{padding:14px 8px}
#ru .suFirst .suCard img{width:72px;height:72px}
#ru .suFirst .suCard b{font-size:10px}
#ru .suDoor img{width:40px;height:40px}
#ru .suDoor .lord{font:7px/1.3 var(--font-display);color:#ff9ab4}
#ru .suDoor .suTw,#ru .suDoor .suPz,#ru .suDoor .suCh{font-size:12px;line-height:1.2;color:#ff8a6a}
#ru .suDoor .suTw b,#ru .suDoor .suPz b{font:7px/1.3 var(--font-display);color:inherit;margin-right:4px}
#ru .suDoor .suPz{color:#ffd84a}#ru .suDoor .suCh{color:#ffb0d0}
#ru .suCard.cursed{box-shadow:inset 0 0 0 2px #b36bff,0 0 12px #b36bff55;background:linear-gradient(180deg,#30183e,var(--panel2))}
#ru .suCard.cursed.on{box-shadow:inset 0 0 0 2px var(--gold),0 0 12px #b36bff88}
#ru .suCard .drTag{top:-8px;right:4px}
#ru .suCodeInfo{width:100%;display:flex;gap:5px;flex-wrap:wrap;justify-content:center;align-items:center;font-size:12px;color:var(--dim)}
#ru .suCodeInfo:empty{display:none}
#ru .suCodeInfo small{width:auto!important}
#ru .dyDoors{display:flex;gap:4px;flex-wrap:wrap;align-items:center;margin-top:3px}
#ru .dyDoors small{display:inline!important}
#ru button.ruChip{cursor:pointer;pointer-events:auto}
#ru button.ruChip.on{background:var(--slot-hi);box-shadow:inset 0 0 0 1px var(--gold);color:var(--gold)}
#ru button.ruChip.cursed{box-shadow:inset 0 0 0 1px #b36bff}
@media (max-width:600px){#ru .ru-setup .ruBox{padding:12px 10px 14px}#ru .suGrid{grid-template-columns:repeat(2,minmax(0,1fr))}#ru .suGrid.cls{grid-template-columns:repeat(3,minmax(0,1fr))}
  #ru .suCard img{width:36px;height:36px}#ru .suFirst .suCard img{width:52px;height:52px}#ru .suDaily{grid-template-columns:minmax(0,1fr)}#ru .suDaily .acts{justify-content:flex-start}#ru .suHeat{grid-template-columns:minmax(0,1fr)}}
`);
  const sel = { btn: 'classic', cls: 'knight', heat: 0, keeps: [], first: null, code: '', codeErr: '', codeFirst: null, dailyDoor: 0 };
  // (runflow: the setup's options carry the next run's own first doors, dealt from the seed G.runStart will use; the Heat
  // on the dial previews Heat 8's cursed door)
  const setupOpts = () => G.setupOptions({ heat: sel.heat });
  const doorsOf = opts => (opts.firstDoors && opts.firstDoors.length ? opts.firstDoors : (opts.firstLands || []).map(id => { const i = G.REALM_BY_ID[id], Rm = G.REALMS[i] || {}; return { land: i, id, name: Rm.name, rule: Rm.rule, ruleDesc: Rm.ruleDesc, lord: Rm.lordName, lordSpr: Rm.lord, minionSpr: Rm.minion, mod: 'calm', tag: null, cursed: 0 }; }));
  // a door as a setup card: its land, rule, lord, twist (map mod), prize (reward tag), Land Champion, a cursed door's mark
  function doorMini(o, isOn, attr) {
    const Rm = G.REALMS[o.land] || {}, M = o.mod && o.mod !== 'calm' ? (G.MAP_MODS || {})[o.mod] : null, T_ = o.tag ? (G.REWARD_TAGS || {})[o.tag] : null;
    const spr = sprOk(o.lordSpr || Rm.lord) ? (o.lordSpr || Rm.lord) : (o.minionSpr || Rm.minion);
    return `<button class="suCard suDoor ${isOn ? 'on' : ''} ${o.cursed ? 'cursed' : ''}" ${attr}>${o.cursed ? `<span class="drTag cur">${esc(t('ru_cursedTag'))}</span>` : ''}${img(spr, 2)}<b>${esc(L(Rm.name || o.name || ''))}</b>`
      + `<small>${esc(L(o.rule || Rm.rule || ''))}: ${esc(L(o.ruleDesc || Rm.ruleDesc || ''))}</small><span class="lord">${esc(t('door_lord', L(o.lord || Rm.lordName || '')))}</span>`
      + (M ? `<span class="suTw"><b>${esc(t('ru_risk'))}</b>${esc(L(M.name))}${o.cursed ? ' ×2' : ''}: ${esc(L(M.desc))}</span>` : '')
      + (T_ ? `<span class="suPz"><b>${esc(t('ru_reward'))}</b>${esc(L(T_.name))}${o.cursed ? ' ×2' : ''}: ${esc(L(T_.desc))}</span>` : '')
      + (o.champ ? `<span class="suCh">${esc(t('ru_champLine', L(o.champ)))}</span>` : '') + `</button>`;
  }
  // a door as a chip (the Daily's and a code's first doors)
  const doorChip = (o, isOn, attr) => `<button class="ruChip ${isOn ? 'on' : ''} ${o.cursed ? 'cursed' : ''}" ${attr} title="${esc([o.mod && o.mod !== 'calm' && G.MAP_MODS && G.MAP_MODS[o.mod] ? L(G.MAP_MODS[o.mod].name) : '', o.tag && G.REWARD_TAGS && G.REWARD_TAGS[o.tag] ? L(G.REWARD_TAGS[o.tag].name) : ''].filter(Boolean).join(' · '))}">${esc(L((G.REALMS[o.land] || {}).name || o.name || ''))}</button>`;
  // the Daily's own first doors (its seed, its Heat)
  const dailyDoors = ds => (ds && G.firstDoors ? safe(() => G.firstDoors({ seed: ds.seed, heat: ds.heat }), []) || [] : []);
  const btnList = () => { const B = G.BUTTONS; if (!B) return [{ id: 'classic', name: t('ru_btnClassic'), rule: t('ru_btnNoRule') }]; return (Array.isArray(B) ? B : Object.keys(B).map(id => Object.assign({ id }, B[id]))); };
  const skinBase = b => { const sk = (G.SKINS || []).find(s => s.id === (b.skin || b.id)); return (sk && sk.base) || b.base || '#e8413c'; };
  function btnImg(b) { try { return `<img src="${G.SPR.url(G.SPR.button(skinBase(b), false, 200), 1)}" alt="" draggable="false">`; } catch (e) { return img('ic_star', 3); } }
  const lockHint = (kind, id) => (G.unlockHint ? safe(() => G.unlockHint(kind, id), '') : '') || (kind === 'class' ? t('ru_lockHint_' + id) : '') || t('ru_locked');
  const firstEver = () => !((G.S.st && G.S.st.sieges) > 0) && !G.S.lastRun;
  function setupFrom(opts) {
    const last = opts.last || {};
    sel.btn = opts.buttons.includes(last.btn) ? last.btn : opts.buttons[0] || 'classic';
    sel.cls = opts.classes.includes(last.cls) ? last.cls : opts.classes[0] || 'knight';
    sel.heat = clamp(last.heat | 0, 0, opts.heat.max | 0);
    sel.keeps = (last.keeps || []).filter(q => opts.keepsakes.some(k => k.q === q)).slice(0, opts.keepSlots);
    sel.first = opts.firstLands.includes(last.first) ? last.first : opts.firstLands[0] || null;
  }
  const sameAsLast = opts => { const l = opts.last; return !!l && l.btn === sel.btn && l.cls === sel.cls && (l.heat | 0) === sel.heat && (l.keeps || []).join() === sel.keeps.join() && (!l.first || l.first === sel.first); };
  RU.setup = function (o) {
    if (on() || G.S.fallen) return false;
    o = o || {};
    if (isOpen('summary')) close('summary');
    const fresh = !isOpen('setup') || o.reset;
    let opts = safe(() => (fresh ? G.setupOptions() : setupOpts()), null);
    if (!opts) return false;
    if (fresh) {
      setupFrom(opts); sel.dailyDoor = 0;
      // (the dial's Heat may differ from the one the options were dealt at: the cursed door follows the dial)
      if ((((opts.last && opts.last.heat) | 0)) !== sel.heat) opts = safe(setupOpts, opts);
    }
    renderSetup(opts, o);
    return true;
  };
  function renderSetup(opts, o) {
    const S = G.S;
    if (firstEver()) {
      // the very first run: one tap (DESIGN §8.1: the class pick, then Shoreline)
      const html = `<div class="ruBox suFirst"><div class="suTop"><h2 class="ruH">${esc(t('ru_first'))}</h2><p class="ruNote">${esc(t('ru_firstHint'))}</p></div>
        <div class="suGrid cls">${opts.classes.map((id, i) => { const C = G.CLASS_BY_ID[id], role = G.ROLES[id]; return `<button class="suCard r_${role}" data-cls1="${id}">${img(C.spr, 6)}<b>${esc(L(C.name))}</b><em>${esc(G.ROLE_NAMES[role] || '')}</em><small>${esc(L(C.desc))}</small><kbd>${i + 1}</kbd></button>`; }).join('')}</div></div>`;
      const s = open('setup', { cover: true, html, keys: (e, fresh) => { const d = digit(e); if (d >= 1 && d <= opts.classes.length && fresh) { startFirst(opts.classes[d - 1]); return true; } return false; }, def: null });
      s.el.onclick = e => { const b = e.target.closest('[data-cls1]'); if (b) startFirst(b.dataset.cls1); };
      return;
    }
    const btns = btnList(), stk = S.heatStk || {};
    const heatN = opts.heat.max | 0, hi = G.heatInfo ? G.heatInfo(sel.heat) : null;
    const lastTxt = opts.last ? t('ru_againOf', btnName(opts.last.btn), L((G.CLASS_BY_ID[opts.last.cls] || {}).name || ''), opts.last.heat | 0) : '';
    const same = sameAsLast(opts);
    const ds = G.dailySetup ? safe(() => G.dailySetup(), null) : null, dsS = S.dailySiege;
    const dailyTried = !!(ds && dsS && dsS.day === ds.day && dsS.tries > 0);
    const board = G.Daily && G.Daily.ready && G.Daily.ready();
    const dd = opts.daily && ds ? dailyDoors(ds) : [];
    if (sel.dailyDoor >= dd.length) sel.dailyDoor = 0;
    const fdoors = doorsOf(opts), cursed = fdoors.some(x => x.cursed);
    // (keepsakes with the meta's Codex info when it has it: rank of cap, the theme's ranks)
    const kinfo = q => (G.codexInfo ? safe(() => G.codexInfo(q), null) : null);
    const html = `<div class="ruBox"><button class="ruX" data-act="town" aria-label="${esc(t('ru_toTown'))}" title="${esc(t('ru_toTown'))}">✕</button>
      <div class="suTop"><h2 class="ruH">${esc(t('ru_newSiege'))}</h2><small>${esc(t('ru_siegeN', ((S.st && S.st.sieges) | 0) + 1))}</small></div>
      ${opts.daily && ds ? `<div class="suDaily">${img('ic_trophy', 3)}<div><b>${esc(t('ru_daily'))}</b><small>${esc(t('ru_dailyRule', L((G.CLASS_BY_ID[ds.cls] || {}).name || ''), ds.heat))}</small><small>${esc(t(dailyTried ? 'ru_dailyPractice' : 'ru_dailyRanked'))}</small>
        ${dd.length > 1 ? `<span class="dyDoors"><small>${esc(t('ru_dailyDoor'))}</small>${dd.map((x, i) => doorChip(x, i === sel.dailyDoor, `data-ddoor="${i}"`)).join('')}</span>` : ''}</div>
        <div class="acts"><button class="btn gold" data-act="daily">${esc(t('ru_dailyGo'))}</button>${board ? `<button class="btn" data-act="board">${esc(t('ru_board'))}</button>` : ''}</div></div>` : ''}
      <h3 class="ruS">${esc(t('ru_button'))}</h3>
      <div class="suGrid">${btns.map(b => { const open_ = opts.buttons.includes(b.id), n = stk[b.id]; let st = ''; for (let i = 0; i <= 10; i++) st += `<i class="${n != null && i <= n ? 'on' : ''}"></i>`;
        return `<button class="suCard ${sel.btn === b.id ? 'on' : ''} ${open_ ? '' : 'lock'}" data-btn="${esc(b.id)}" ${open_ ? '' : 'disabled'}>${btnImg(b)}<b>${esc(open_ ? L(b.name || b.id) : '???')}</b><small>${esc(open_ ? L(b.rule || b.desc || '') : lockHint('button', b.id))}</small>${open_ ? `<span class="stk" title="${esc(t('ru_stickers'))}">${st}</span>` : ''}</button>`; }).join('')}</div>
      <h3 class="ruS">${esc(t('ru_class'))}</h3>
      <div class="suGrid cls">${G.CLASSES.map(C => { const open_ = opts.classes.includes(C.id), role = G.ROLES[C.id];
        return `<button class="suCard r_${role} ${sel.cls === C.id ? 'on' : ''} ${open_ ? '' : 'lock'}" data-cls="${C.id}" ${open_ ? '' : 'disabled'}>${img(C.spr, 4)}<b>${esc(L(C.name))}</b><em>${esc(G.ROLE_NAMES[role] || '')}</em><small>${esc(open_ ? L(C.desc) : lockHint('class', C.id))}</small></button>`; }).join('')}</div>
      <h3 class="ruS">${esc(t('ru_keeps'))}<small>${opts.keepSlots ? esc(t('ru_keepsN', sel.keeps.length, opts.keepSlots)) : ''}</small></h3>
      ${!opts.keepSlots ? `<p class="ruNote">${esc(t(opts.keepsakes.length ? 'ru_keepsNone' : 'ru_keepsEmpty'))}</p>` : !opts.keepsakes.length ? `<p class="ruNote">${esc(t('ru_keepsEmpty'))}</p>`
        : `<div class="suGrid">${opts.keepsakes.map(k => { const ci = kinfo(k.q), th = ci && ci.theme && G.PERKS[ci.theme];
          return `<button class="suCard ${sel.keeps.includes(k.q) ? 'on' : ''}" data-keep="${esc(k.q)}">${img('u_' + k.q, 3)}<b class="${k.relic ? 'ruRbw' : ''}">${esc(relicName(k.q))}</b><small>${esc(relicFx(k.q))}</small>${th && ci.themeRanks ? `<em>${esc(t('ru_keepTheme', ci.themeRanks, L(th.name)))}</em>` : ''}<span class="rk">${esc(ci ? t('ru_keepRank', ci.rank, ci.cap) : k.rank > 1 ? t('ru_codexRank', k.rank) : '')}</span></button>`; }).join('')}</div>`}
      <h3 class="ruS">${esc(t('ru_heat'))}<small>${hi && hi.perLevel ? esc(t('heat_each', hi.perLevel.hp, hi.perLevel.bite)) : ''}</small></h3>
      ${heatN < 1 && sel.heat === 0 ? `<p class="ruNote">${esc(t('ru_heatLocked'))}</p>` : `<div class="suHeat"><div class="suDial"><button class="btn" data-act="heat-" ${sel.heat <= 0 ? 'disabled' : ''} aria-label="-">-</button><b>H${sel.heat}</b><button class="btn" data-act="heat+" ${sel.heat >= heatN ? 'disabled' : ''} aria-label="+">+</button></div>
        <div class="suRules">${hi ? `<small>${esc(t('ru_heatMul', hi.fame.toFixed(1), hi.embers.toFixed(2), hi.rarity))}</small>` : ''}${hi && hi.rules.length ? hi.rules.map(x => `<span class="${hi.added && hi.added.n === x.n ? 'add' : ''}">${x.n}. ${esc(L(x.name))}: ${esc(L(x.desc))}</span>`).join('') : `<span>${esc(t('ru_heatNone'))}</span>`}</div></div>`}
      ${fdoors.length ? `<h3 class="ruS">${esc(t('ru_firstDoor'))}<small>${esc(cursed ? t('ru_heat8') : fdoors.length > 1 ? t('ru_firstDoorHint') : '')}</small></h3><div class="suGrid">${fdoors.map((x, i) => doorMini(x, sel.first === x.id || (!sel.first && !i), `data-first="${esc(x.id)}"`)).join('')}</div>` : ''}
      <div class="suFoot"><button class="btn gold ruBig" data-act="start">${esc(t(same ? 'ru_again' : 'ru_start'))}</button>${same && lastTxt ? `<small class="ruNote">${esc(lastTxt)}</small>` : ''}
        <div class="suCode"><input id="ruCodeIn" maxlength="40" placeholder="${esc(t('ru_code'))}" value="${esc(sel.code)}" spellcheck="false" autocomplete="off"><button class="btn" data-act="code">${esc(t('ru_codeGo'))}</button><small>${esc(sel.codeErr || t('ru_codeNote'))}</small><span class="suCodeInfo"></span></div></div></div>`;
    const s = open('setup', { cover: true, html, keys: setupKeys, def: () => startSetup(opts) });
    const box = s.el.querySelector('.ruBox'); if (box && o && o.scroll != null) box.scrollTop = o.scroll;
    s.el.onclick = e => setupClick(e, opts, s);
    const inp = s.el.querySelector('#ruCodeIn');
    if (inp) { inp.oninput = () => { sel.code = inp.value; codeInfo(); }; inp.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); ev.stopPropagation(); startCode(); } }; }
    codeInfo();
  }
  // a valid code shows what it replays: its Button (Classic while that one is locked here), its Heat, its own first doors
  // (runflow: G.firstDoors({seed}) - a code's run deals its own, not this setup's)
  function codeInfo() {
    const s = SCR.setup, el = s && s.el.querySelector('.suCodeInfo'); if (!el) return;
    const p = sel.code && G.runParseCode ? G.runParseCode(sel.code) : null;
    if (!p) { if (el.innerHTML) el.innerHTML = ''; sel.codeFirst = null; return; }
    const open_ = !G.btnOpen || p.btn === 'classic' || safe(() => G.btnOpen(p.btn), false);
    const heat = Math.min(p.heat, G.tormentMax ? G.tormentMax() : p.heat);
    const ds = G.firstDoors ? safe(() => G.firstDoors({ seed: p.seed, heat }), []) || [] : [];
    if (!ds.some(x => x.id === sel.codeFirst)) sel.codeFirst = ds.length ? ds[0].id : null;
    el.innerHTML = `<span>${esc(t('ru_codeRun', btnName(open_ ? p.btn : 'classic'), heat))}${open_ ? '' : ' · ' + esc(t('ru_codeLocked', btnName(p.btn)))}</span>`
      + (ds.length > 1 ? `<small>${esc(t('ru_codeDoors'))}</small>${ds.map(x => doorChip(x, x.id === sel.codeFirst, `data-cdoor="${esc(x.id)}"`)).join('')}` : '');
  }
  const btnName = id => { const b = btnList().find(x => x.id === id); return b ? L(b.name || id) : id === 'classic' ? t('ru_btnClassic') : id; };
  function setupKeys(e, fresh) {
    if (e.code === 'Escape') { setupTown(); return true; }
    return false;
  }
  function setupClick(e, opts, s) {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (G.Audio && G.Audio.unlock) G.Audio.unlock();
    const box = s.el.querySelector('.ruBox'), scroll = box ? box.scrollTop : 0;
    const re = () => renderSetup(setupOpts(), { scroll });
    if (b.dataset.btn) { sel.btn = b.dataset.btn; sfx('buy'); re(); }
    else if (b.dataset.cls) { sel.cls = b.dataset.cls; sfx('buy'); re(); }
    else if (b.dataset.keep) {
      const q = b.dataset.keep, i = sel.keeps.indexOf(q); if (i >= 0) sel.keeps.splice(i, 1); else { sel.keeps.push(q); while (sel.keeps.length > opts.keepSlots) sel.keeps.shift(); }
      // (the meta's loadout: kept for the next Siege even when this setup is left for the town)
      if (G.keepSet) safe(() => G.keepSet(sel.keeps.slice()));
      sfx('buy'); re();
    }
    else if (b.dataset.first) { sel.first = b.dataset.first; sfx('buy'); re(); }
    else if (b.dataset.ddoor != null) { sel.dailyDoor = +b.dataset.ddoor | 0; sfx('buy'); re(); }
    else if (b.dataset.cdoor != null) { sel.codeFirst = b.dataset.cdoor; sfx('buy'); codeInfo(); }
    else if (b.dataset.act === 'heat-') { sel.heat = Math.max(0, sel.heat - 1); sfx('buy'); re(); }
    else if (b.dataset.act === 'heat+') { sel.heat = Math.min(opts.heat.max | 0, sel.heat + 1); sfx('buy'); re(); }
    else if (b.dataset.act === 'start') startSetup(opts);
    else if (b.dataset.act === 'code') startCode();
    else if (b.dataset.act === 'daily') { if (G.runDaily && G.runDaily(undefined, { door: sel.dailyDoor | 0 })) sfx('levelUp'); else sfx('error'); }
    else if (b.dataset.act === 'board') { if (G.Daily && G.Daily.open) G.Daily.open(); }
    else if (b.dataset.act === 'town') setupTown();
  }
  function startFirst(cls) {
    if (G.Audio && G.Audio.unlock) G.Audio.unlock();
    if (G.runStart({ btn: 'classic', cls, heat: 0, keeps: [], first: 'shore' })) sfx('levelUp'); else sfx('error');
  }
  function startSetup(opts) {
    if (G.Audio && G.Audio.unlock) G.Audio.unlock();
    const r = G.runStart({ btn: sel.btn, cls: sel.cls, heat: sel.heat, keeps: sel.keeps.slice(), first: sel.first });
    if (r) sfx('levelUp'); else sfx('error');
  }
  // 'Enter a code' (streamer mode's share code): the same seed, Button and Heat; an unranked replay (no Daily, flagged)
  function startCode() {
    const p = G.runParseCode ? G.runParseCode(sel.code) : null;
    if (!p) { sel.codeErr = t('ru_codeBad'); sfx('error'); renderSetup(setupOpts(), {}); return; }
    sel.codeErr = '';
    // (runflow's G.runFromCode: the parse, a locked Button -> Classic, the Heat clamp, no keepsakes, r.replay; the first
    // land is one of the code's own doors - the one picked under the code, else its first)
    let r;
    if (G.runFromCode) r = G.runFromCode(sel.code, Object.assign({ cls: sel.cls }, sel.codeFirst ? { first: sel.codeFirst } : {}));
    else { const opts = setupOpts(); r = G.runStart({ seed: p.seed, btn: opts.buttons.includes(p.btn) ? p.btn : 'classic', cls: sel.cls, heat: Math.min(p.heat, opts.heat.max | 0), keeps: [], replay: 1 }); }
    if (r) sfx('levelUp'); else sfx('error');
  }
  // (a replay is marked on the run: ladders and records may leave it out)
  G.on('runSetup', (r, setup) => { if (r && setup && setup.replay) r.replay = 1; });
  function setupTown() {
    close('setup', 200);
    if (G.enterTown && !G.R.town) G.enterTown();
  }

  // ---------- CARDS (DESIGN §5.1): school chips, rank pips (own + gear), Empowered/Golden frames, NEW, the evolution,
  // reroll/banish, the 6 slots, keys 1-4, the auto-pick countdown, chat votes ----------
  CSS_PARTS.push(`
#ru .ru-cards{pointer-events:none}
#ru .ckWrap{position:absolute;left:50%;bottom:var(--hudB,110px);transform:translateX(-50%);width:min(96%,780px);display:grid;gap:8px;justify-items:center;pointer-events:auto;animation:ruFade .2s ease-out}
#ru .ru-cards:not(.wide) .ckWrap{position:fixed;left:0;right:0;bottom:0;transform:none;width:auto;max-height:100%;overflow-y:auto;padding:10px 8px 12px;background:rgba(12,11,18,.95);border-top:3px solid var(--ink);box-shadow:inset 0 2px 0 var(--line)}
#ru .ckTitle{margin:0;font:13px/1.3 var(--font-display);color:#a8dcff;text-shadow:2px 2px 0 var(--ink);text-align:center;animation:ruPop .35s cubic-bezier(.3,1.7,.5,1) both}
#ru .ckTitle small{display:block;font:12px/1.2 var(--font-body);color:var(--dim);text-shadow:1px 1px 0 var(--ink)}
#ru .ckRow{display:flex;gap:8px;width:100%;justify-content:center}
#ru .ckCard{position:relative;flex:1 1 0;min-width:0;max-width:190px;display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 6px 9px;cursor:pointer;color:var(--text);text-align:center;
  background:var(--panel);border:3px solid var(--ink);box-shadow:inset 0 0 0 2px var(--fr,#4f8cff),0 4px 0 var(--ink);animation:ckIn .38s cubic-bezier(.3,1.6,.5,1) both;animation-delay:var(--d,0s)}
#ru .ckCard:hover,#ru .ckCard:focus-visible{transform:translateY(-4px);box-shadow:inset 0 0 0 2px #ffe27a,0 8px 0 var(--ink)}
#ru .ckCard.t1{--fr:#c86bff;background:linear-gradient(#2c1f3e,var(--panel) 60%)}
#ru .ckCard.t1::after{content:'';position:absolute;inset:-3px;box-shadow:0 0 14px #b36bff88;pointer-events:none;animation:ruPulse 1.6s ease-in-out infinite}
#ru .ckCard.t2,#ru .ckCard.evo{--fr:#ffd84a;background:linear-gradient(#3e2e10,var(--panel) 65%)}
#ru .ckCard.t2::after,#ru .ckCard.evo::after{content:'';position:absolute;inset:-3px;box-shadow:0 0 18px #ffd84aaa;pointer-events:none;animation:ruPulse 1.1s ease-in-out infinite}
#ru .ckCard.evo{max-width:220px}
#ru .ckCard.boon{--fr:#6ee07a}
#ru .ckCard.ban{box-shadow:inset 0 0 0 2px #ff5a5a,0 4px 0 var(--ink)}
#ru .ckCard.ban::before{content:'✕';position:absolute;inset:0;display:grid;place-items:center;font:34px/1 var(--font-display);color:#ff5a5a88;pointer-events:none}
#ru .ckCard.picked{animation:ckPick .3s ease-in forwards}
#ru .ckCard img.ico{width:40px;height:40px}
#ru .ckCard b{font:8px/1.5 var(--font-display);color:#ffe27a;font-weight:normal}
#ru .ckCard small{font-size:13px;line-height:1.15;color:var(--dim)}
#ru .ckCard small.evw{color:#ffd28a;font-size:12px}
#ru .ckNew{position:absolute;left:-4px;top:-6px;padding:2px 4px;background:#56d45a;color:var(--ink);font:7px/1 var(--font-display);border:2px solid var(--ink);transform:rotate(-8deg)}
#ru .ckTier{font:7px/1.3 var(--font-display);color:var(--fr)}
#ru .ckSch{font:7px/1 var(--font-display);padding:2px 4px;color:var(--ink);background:var(--sc,#888);border:1px solid var(--ink)}
#ru .ckPips{display:flex;gap:2px;flex-wrap:wrap;justify-content:center}
#ru .ckPips i{width:8px;height:8px;background:#2a2838;border:1px solid var(--ink)}
#ru .ckPips i.own{background:#ffd84a}
#ru .ckPips i.add{background:#fff;animation:ruPulse .7s steps(2) infinite}
#ru .ckPips i.gear{background:#5ae8ff}
#ru .ckPips i.over{width:6px;height:6px;align-self:center;border-style:dashed}
#ru .ckRank{font:7px/1.3 var(--font-display);color:#a8dcff}
#ru .ckCard kbd{position:absolute;right:4px;bottom:4px}
#ru .ckVote{position:absolute;left:4px;right:4px;top:-12px;height:9px;background:var(--ink);border:1px solid #9146ff}
#ru .ckVote i{display:block;height:100%;background:#9146ff;transition:width .3s}
#ru .ckVote b{position:absolute;right:0;top:-12px;font:7px/1 var(--font-display);color:#c9a6ff}
#ru .ckFoot{display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap;width:100%}
#ru .ckSlots{display:flex;gap:3px;align-items:center;padding:3px 5px;background:rgba(12,11,18,.8);border:2px solid var(--ink)}
#ru .ckSlots span{font:7px/1 var(--font-display);color:var(--dim);margin-right:3px}
#ru .ckSlots i{position:relative;width:22px;height:22px;display:grid;place-items:center;background:#1c1a28;border:1px solid var(--line)}
#ru .ckSlots i img{width:18px;height:18px}
#ru .ckSlots i u{position:absolute;right:0;bottom:-1px;font:6px/1 var(--font-display);text-decoration:none;color:#fff;text-shadow:1px 1px 0 var(--ink)}
#ru .ckAuto,#ru .ckHint{margin:0;font-size:13px;color:#d8dce8;text-shadow:1px 1px 0 var(--ink);text-align:center}
#ru .ckChat{font:8px/1 var(--font-display);color:#c9a6ff}
#ru .btn.on{background:#6a1f2a;box-shadow:inset 0 0 0 2px #ff6a6a,0 3px 0 var(--ink)}
@keyframes ckIn{from{transform:translateY(40px) scale(.8);opacity:0}}
@keyframes ckPick{to{transform:translateY(-40px) scale(1.15);opacity:0}}
@media (max-width:600px){#ru .ckRow{flex-direction:column;gap:6px}#ru .ckCard{max-width:none;flex-direction:row;flex-wrap:wrap;text-align:left;align-items:center;padding:7px 8px;gap:2px 8px}
  #ru .ckCard img.ico{width:32px;height:32px;flex:none}#ru .ckCard .ckMain{flex:1;min-width:0;display:grid;gap:2px;justify-items:start}#ru .ckCard .ckPips{justify-content:flex-start}#ru .ckCard.evo{max-width:none}
  #ru .ckCard:hover{transform:none}#ru .ckHint{display:none}#ru .ckVote{top:2px;left:auto;width:60px}}
`);
  let banishMode = false;
  const votes = {};
  // the pips: picked ranks (gold), the card's new ranks (white), the party's gear ranks (cyan); past the max only what gear adds
  function pipsHtml(c) {
    const max = c.max || 1, cap = c.cap || max, own = c.own | 0, to = Math.max(own, c.to | 0), eff = Math.min(cap, to + (c.gear | 0));
    let h = '';
    for (let i = 0; i < Math.max(max, eff); i++) h += `<i class="${i < own ? 'own' : i < to ? 'add' : i < eff ? 'gear' : ''}${i >= max ? ' over' : ''}"></i>`;
    return `<span class="ckPips">${h}</span>`;
  }
  function cardHtml(c, n) {
    const P = c.perk && G.PERKS[c.perk], i = c.i;
    const ico = img(c.icon || (P && P.icon) || 'ic_star', 3, 'ico');
    const sc = c.school ? `<span class="ckSch" style="--sc:${SCHOOL_COL[c.school] || '#888'}">${esc(schoolName(c.school))}</span>` : '';
    let inner;
    if (c.boon) inner = `<div class="ckMain"><span class="ckTier">${esc(t('ru_boon'))}</span><b>${esc(L(c.name))}</b>${c.own ? `<small>×${c.own}</small>` : ''}</div>`;
    else if (c.evo) inner = `<div class="ckMain"><span class="ckTier">${esc(t('ru_evo'))}</span><b>${esc(L(c.name))}</b>${sc}<small>${esc(L(c.desc))}</small>${c.need ? `<small class="evw">${esc(t('ru_evoNeed', L(c.need)))}</small>` : ''}</div>`;
    else inner = `<div class="ckMain">${c.tier ? `<span class="ckTier">${esc(t(c.tier === 2 ? 'card_tier2' : 'card_tier1'))} · ${esc(t('card_ranks', c.add))}</span>` : ''}<b>${esc(L(c.name))}</b>${sc}${pipsHtml(c)}
      <span class="ckRank">${esc(t('ru_rankAdd', c.own, c.max, Math.max(0, c.to - c.own)))}${c.maxed ? ' · ' + esc(t('ru_maxed')) : ''}${c.gear ? ' · ' + esc(t('ru_gearR', c.gear)) : ''}</span><small>${esc(L(c.desc))}</small>
      ${c.evoWith ? `<small class="evw">${esc(t('card_evoWith', L(c.evoWith.name)))}${c.evoWith.have ? ' · ' + esc(t('card_evoHave')) : ' · ' + esc(t('ru_evoNeed', L(c.evoWith.need)))}</small>` : ''}</div>`;
    const cls = `ckCard ${c.boon ? 'boon' : c.evo ? 'evo' : 't' + (c.tier | 0)} ${banishMode && c.banishable !== false && !c.evo && !c.boon ? 'ban' : ''}`;
    return `<button class="${cls}" data-i="${i}" style="--d:${(i * 0.07).toFixed(2)}s">${c.isNew && !c.boon ? `<span class="ckNew">${esc(t(c.evo ? 'ru_new' : 'card_new'))}</span>` : ''}${ico}${inner}<i class="ckVote" hidden><i></i><b></b></i>${n <= 9 ? `<kbd>${i + 1}</kbd>` : ''}</button>`;
  }
  function renderCards(view) {
    view = view || (G.cardView ? G.cardView() : null);
    if (!view) { if (isOpen('cards')) close('cards', 200); return; }
    const n = view.cards.length, slots = view.slots || { used: 0, max: 6, ids: [] };
    let sl = '';
    for (let i = 0; i < slots.max; i++) { const id = slots.ids[i], P = id && G.PERKS[id]; sl += `<i title="${esc(P ? L(P.name) : '')}">${P ? img(P.icon || 'ic_star', 1) + `<u>${G.perkOwn ? G.perkOwn(id) : ''}</u>` : ''}</i>`; }
    const html = `<div class="ckWrap"><h3 class="ckTitle">${esc(t(view.title, view.lvl))}${view.queued ? `<small>${esc(t('ru_cardsQ', view.queued))}</small>` : ''}${banishMode ? `<small>${esc(t('ru_banishOn'))}</small>` : ''}</h3>
      <div class="ckRow">${view.cards.map(c => cardHtml(c, n)).join('')}</div>
      <div class="ckFoot"><button class="btn" data-act="reroll" ${view.rerolls > 0 ? '' : 'disabled'}>${esc(t('card_reroll', view.rerolls))}</button>
        ${view.banish > 0 || banishMode ? `<button class="btn ${banishMode ? 'on' : ''}" data-act="banish">${esc(t('card_banish', view.banish))}</button>` : ''}
        <span class="ckSlots"><span>${esc(t('ru_slotsTitle', slots.used, slots.max))}</span>${sl}</span><span class="ckChat" hidden></span></div>
      <p class="ckAuto" hidden></p><p class="ckHint">${esc(t('ru_pickKeys', Math.min(n, 9)))}</p></div>`;
    const s = open('cards', { stage: true, html, keys: cardKeys, def: null });
    // (uifix: on a wide screen the sheet's title was printed through the Button sprite: the sheet sits under the Button line
    // when the stage is tall enough for it; one layout read a render)
    if (s.el.classList.contains('wide')) {
      const w = s.el.querySelector('.ckWrap'), bp = btnPoint();
      if (w && bp) { const r = w.getBoundingClientRect(), sr = s.el.getBoundingClientRect(), topMin = bp.y + 34 - sr.top; if (r.top - sr.top < topMin) { const nb = sr.height - topMin - r.height; if (nb >= 4) w.style.bottom = Math.round(nb) + 'px'; } }
    }
    s.el.onclick = cardClick;
    s.el.onpointerdown = () => { if (G.cardTouch) G.cardTouch(); };
    s.view = view;
    if (votes.card) drawVotes('card');
    cardTick();
  }
  function cardClick(e) {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (G.Audio && G.Audio.unlock) G.Audio.unlock();
    if (b.dataset.act === 'reroll') { banishMode = false; if (G.cardReroll && G.cardReroll()) sfx('orb', 'flux'); else sfx('error'); return; }
    if (b.dataset.act === 'banish') { banishMode = !banishMode; renderCards(); return; }
    if (b.dataset.i != null) cardChoose(+b.dataset.i, b);
  }
  function cardChoose(i, el) {
    const r = run(); if (!r || !r.offer) return;
    if (banishMode) { banishMode = false; if (G.cardBanish && G.cardBanish(i)) sfx('boom'); else { sfx('error'); renderCards(); } return; }
    el = el || (SCR.cards && SCR.cards.el.querySelector(`.ckCard[data-i="${i}"]`));
    if (el) el.classList.add('picked');
    const id = r.offer.ids[i];
    if (G.cardPick && G.cardPick(i)) { sfx(String(id).startsWith('evo_') ? 'evolve' : 'perk'); if (!run().offer) close('cards', 280); }
    else sfx('error');
  }
  function cardKeys(e, fresh) {
    const d = digit(e), s = SCR.cards, n = s && s.view ? s.view.cards.length : 0;
    if (d >= 1 && d <= n) { if (fresh) cardChoose(d - 1); return true; }
    if (e.code === 'KeyR') { if (fresh && G.cardReroll && G.cardReroll()) sfx('orb', 'flux'); return true; }
    if (e.code === 'KeyB') { if (fresh) { const r = run(); if ((r && r.banish > 0) || banishMode) { banishMode = !banishMode; renderCards(); } } return true; }
    if (e.code === 'Escape' && banishMode) { banishMode = false; renderCards(); return true; }
    return false;
  }
  // the auto-pick countdown (only with auto-pick on: the player's toggle, Clockwork, Auto-Run) and the chat's clock
  function cardTick() {
    const s = SCR.cards; if (!s || s.closing) return;
    const r = run(), o = r && r.offer, h = G.S.hero, el = s.el.querySelector('.ckAuto');
    if (!o || !el) return;
    const auto = !!((h && h.autoPerk) || r.autoCards), left = auto && !o.touch ? Math.max(0, (G.cardAfter ? G.cardAfter() : 10) - o.t) : null;
    setH(el, left == null); if (left != null) setT(el, t('card_auto', Math.ceil(left)));
  }
  G.on('cardOffer', () => { if (SCR.loot) return; if (isOpen('cards')) later('cards', () => renderCards(), 240); else renderCards(); });
  G.on('cardNone', () => toast(esc(t('card_none')), '', 'ic_star'));
  G.on('cardPicked', c => { if (c && c.how && c.how !== 'pick' && isOpen('cards') && !run().offer) close('cards', 200); });

  // ---------- chat votes (streamer mode): G.RunUI.voteTally(kind, counts, secsLeft) draws the live tally on the open
  // choice (kind 'card' | 'door' | 'relic' | 'boon' | 'loot'); counts null clears it. js/stream.js calls it; the pick stays
  // the logic's (G.cardPick(i, 'chat'), G.runDoor(i), G.relicPick(i)...) ----------
  const VOTE_SCR = { card: ['cards', '.ckCard'], door: ['doors', '.drCard'], relic: ['relic', '.rlCard'], boon: ['boon', '.bnCard'], loot: ['loot', '.lmCard'] };
  RU.voteTally = function (kind, counts, secsLeft) {
    if (!VOTE_SCR[kind]) return false;
    votes[kind] = Array.isArray(counts) ? { counts: counts.map(x => Math.max(0, x | 0)), secs: secsLeft } : null;
    drawVotes(kind);
    return true;
  };
  function drawVotes(kind) {
    const [name, sel_] = VOTE_SCR[kind], s = SCR[name];
    if (!s || !s.el) return;
    const v = votes[kind], els = s.el.querySelectorAll(sel_), tot = v ? v.counts.reduce((a, x) => a + x, 0) : 0, mx = v ? Math.max(1, ...v.counts) : 1;
    els.forEach((el, i) => {
      let bar = el.querySelector('.ckVote');
      if (!bar) { bar = document.createElement('i'); bar.className = 'ckVote'; bar.innerHTML = '<i></i><b></b>'; el.appendChild(bar); }
      setH(bar, !v);
      if (!v) return;
      const n = v.counts[i] | 0;
      bar.firstChild.style.width = Math.round(n / mx * 100) + '%';
      bar.lastChild.textContent = n + (tot ? ' · ' + Math.round(n / tot * 100) + '%' : '');
      el.classList.toggle('lead', n === mx && n > 0);
    });
    // (the doors' bars sit above their cards: the row makes room so they do not cover the 'Land N' line - stream handoff)
    s.el.classList.toggle('voting', !!v);
    const chat = s.el.querySelector('.ckChat, .ruChat');
    // (the chip names as many options as the vote has: '!1 !2' on two doors, '!1 .. !5' on a 5-card loot moment)
    if (chat) { setH(chat, !v); if (v) chat.textContent = Array.from({ length: Math.max(1, Math.min(9, v.counts.length || els.length)) }, (_, k) => '!' + (k + 1)).join(' ') + ' · ' + (v.secs != null ? Math.ceil(v.secs) + 's' : ''); }
  }

  // ---------- THE LOOT MOMENT (DESIGN §5.3, ADDENDUM 1-2): cards dealt from the boss and flipped like a booster pack,
  // ▲/▼ against the hero each suits (or the hero picked in the switcher), a ring timer in real seconds that stops for a
  // touch, tap = wear it on the hero shown, hold = stash it, 1-5, a FRESH Space/Enter takes the best. Junk collapses into a
  // quick burn; an ultra-rare (mythic, divine, unique, relic) turns last after a beat of suspense, rainbow, with its big
  // stat sheet, and emits 'lootUltra' (the field's pillar, the sting). What is left burns into Embers that fly to the pouch.
  CSS_PARTS.push(`
#ru .ru-loot{pointer-events:auto}
#ru .lmDim{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 70%,rgba(6,5,10,.35),rgba(6,5,10,.78));animation:ruFade .3s ease-out;transition:opacity .25s}
#ru .ru-loot.pillarUp .lmDim{opacity:.2}
#ru .ru-loot.wide.reveal .lmSheetBox{visibility:hidden}
#ru .lmWrap{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);width:min(97%,900px);max-height:calc(100% - 20px);display:flex;flex-direction:column;gap:7px;align-items:center;justify-content:flex-end}
#ru .lmWrap>*{flex:none}
#ru .lmSheetBox{flex:0 1 auto!important;min-height:0;overflow-y:auto;overscroll-behavior:contain;width:100%;display:flex;justify-content:center}
#ru .lmSheetBox:empty{display:none}
#ru .ru-loot:not(.wide) .lmWrap{position:fixed;left:0;right:0;bottom:0;transform:none;width:auto;max-height:100%;overflow-y:auto;overscroll-behavior:contain;padding:8px 8px 10px;background:rgba(12,11,18,.94);border-top:3px solid var(--ink);box-shadow:inset 0 2px 0 var(--line)}
#ru .lmHead{display:flex;align-items:center;gap:10px;justify-content:center;flex-wrap:wrap;width:100%}
#ru .lmTitle{font:13px/1.2 var(--font-display);color:var(--gold);text-shadow:2px 2px 0 var(--ink);animation:ruDrop .4s cubic-bezier(.3,1.6,.5,1) both}
#ru .lmTitle small{display:block;font:8px/1.4 var(--font-display);color:#ff9ab4}
#ru .lmHeroes{display:flex;gap:3px}
#ru .lmHeroes button{position:relative;display:grid;justify-items:center;gap:1px;min-width:42px;padding:2px 3px;cursor:pointer;background:rgba(12,11,18,.85);border:2px solid var(--ink);box-shadow:inset 0 0 0 1px var(--line);color:var(--dim);font:6px/1.2 var(--font-display)}
#ru .lmHeroes button img{width:24px;height:24px}
#ru .lmHeroes button.on{color:var(--gold);box-shadow:inset 0 0 0 2px var(--gold)}
#ru .lmHeroes button.got{animation:ruBump .5s ease-out}
#ru .lmHeroes .auto{align-content:center;min-height:36px;font-size:7px}
#ru .lmRing{position:relative;width:42px;height:42px;flex:none}
#ru .lmRing svg{width:100%;height:100%;transform:rotate(-90deg)}
#ru .lmRing circle{fill:none;stroke-width:4}
#ru .lmRing .bg{stroke:#2a2838}
#ru .lmRing .fg{stroke:var(--gold);stroke-linecap:butt}
#ru .lmRing.low .fg{stroke:#ff6a5a}
#ru .lmRing.paused .fg{stroke:#7fe9ff}
#ru .lmRing b{position:absolute;inset:0;display:grid;place-items:center;font:11px/1 var(--font-display);color:#fff;text-shadow:1px 1px 0 var(--ink)}
#ru .lmRing.paused b{font-size:7px;color:#7fe9ff}
#ru .lmCards{position:relative;isolation:isolate;display:flex;gap:10px;justify-content:center;width:100%;perspective:900px}
#ru .lmPack{position:fixed;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;pointer-events:none;background:radial-gradient(circle,#fff,#ffd84a 40%,transparent 70%);animation:lmBurst .6s ease-out forwards}
#ru .lmCard{position:relative;flex:0 1 150px;min-width:0;height:210px;padding:0;cursor:pointer;background:none;border:0;color:var(--text);transform:translate(var(--fx,0px),var(--fy,-70vh)) rotate(var(--fr,-12deg)) scale(.3);opacity:0;
  transition:transform .42s cubic-bezier(.25,1.35,.5,1),opacity .2s}
#ru .lmCard.dealt{transform:none;opacity:1}
#ru .lmCard.sel .lmFace{box-shadow:inset 0 0 0 3px var(--rc),0 0 0 2px #fff,0 6px 0 var(--ink)}
#ru .lmCard:hover .lmIn{transform:translateY(-5px) rotateY(0)}
#ru .lmCard:not(.flip):hover .lmIn{transform:translateY(-5px) rotateY(180deg)}
#ru .lmIn{position:absolute;inset:0;transform-style:preserve-3d;transition:transform .45s cubic-bezier(.3,1.4,.5,1);transform:rotateY(180deg)}
#ru .lmCard.flip .lmIn{transform:rotateY(0)}
#ru .lmFace,#ru .lmBackF{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;border:3px solid var(--ink)}
#ru .lmBackF{transform:rotateY(180deg);background:repeating-linear-gradient(45deg,#2a2440 0 6px,#211c33 6px 12px);box-shadow:inset 0 0 0 2px #6d6784,0 5px 0 var(--ink);display:grid;place-items:center}
#ru .lmBackF::after{content:'?';font:22px/1 var(--font-display);color:#6d6784;text-shadow:2px 2px 0 var(--ink)}
#ru .lmCard.ultra .lmBackF{box-shadow:inset 0 0 0 2px #fff,0 5px 0 var(--ink),0 0 16px #fff6}
#ru .lmCard.charge .lmBackF{animation:ruShake .12s linear infinite;box-shadow:inset 0 0 0 3px #fff,0 0 30px #fff,0 0 60px #ff4f7e}
#ru .lmCard.charge .lmBackF::after{content:'!';color:#fff;animation:ruPulse .2s steps(2) infinite}
#ru .lmFace{display:flex;flex-direction:column;align-items:center;gap:2px;padding:12px 6px 8px;overflow:hidden;background:linear-gradient(180deg,color-mix(in srgb,var(--rc) 22%,#1d1b26),#1d1b26 60%);box-shadow:inset 0 0 0 2px var(--rc),0 5px 0 var(--ink)}
#ru .lmCard.ultra .lmFace{box-shadow:inset 0 0 0 2px #fff,0 5px 0 var(--ink)}
#ru .lmCard.ultra .lmFace::before{content:'';position:absolute;left:50%;top:50%;width:260%;height:260%;margin:-130% 0 0 -130%;background:conic-gradient(#ff4f7e,#ffa033,#ffd84a,#56d45a,#4fd0ff,#b36bff,#ff4f7e);animation:ruSpin 2.4s linear infinite;z-index:0;opacity:.95;will-change:transform}
#ru .lmCard.ultra .lmFace::after{content:'';position:absolute;inset:4px;background:linear-gradient(180deg,#2e2a3e,#16131f);z-index:0}
#ru .lmFace>*{position:relative;z-index:1}
#ru .lmTag{font:6px/1.3 var(--font-display);font-style:normal;color:#ffe27a;background:rgba(10,9,16,.8);padding:2px 4px;max-width:100%;text-align:center;overflow-wrap:anywhere}
#ru .lmIco{width:52px;height:52px;margin:2px 0;filter:drop-shadow(0 0 6px var(--rc))}
#ru .lmCard.ultra .lmIco{width:60px;height:60px;filter:drop-shadow(0 0 10px #fff)}
#ru .lmName{font:8px/1.3 var(--font-display);color:var(--rc);text-align:center;max-height:2.6em;overflow:hidden;font-weight:normal;overflow-wrap:anywhere;flex:none}
#ru .lmCard.ultra .lmName{font-size:7px}
#ru .lmRar{font-size:12px;color:var(--dim);line-height:1.1}
#ru .lmUp{font:13px/1.1 var(--font-display);margin-top:auto;text-shadow:2px 2px 0 var(--ink)}
#ru .lmWho{display:flex;align-items:center;gap:3px;font-size:12px;color:var(--dim);line-height:1}
#ru .lmWho img{width:18px;height:18px}
#ru .lmBurn{display:flex;align-items:center;gap:2px;font:7px/1 var(--font-display);color:#ffb15a}
#ru .lmBurn img{width:10px;height:10px}
#ru .lmCard kbd{position:absolute;left:4px;top:4px;z-index:2}
#ru .lmInfo{position:absolute;right:3px;top:3px;z-index:2;width:20px;height:20px;padding:0;font:9px/1 var(--font-display);color:var(--dim);background:var(--ink);border:1px solid var(--line);display:none}
#ru .lmHoldB{position:absolute;left:0;bottom:0;height:4px;width:100%;background:#7fe9ff;transform:scaleX(0);transform-origin:left;z-index:2}
#ru .lmCard.holding .lmHoldB{transform:scaleX(1);transition:transform .45s linear}
#ru .lmCard.best .lmUp{animation:ruPulse .8s steps(2) infinite}
#ru .lmCard.taken{transition:transform .45s cubic-bezier(.5,0,.7,1),opacity .45s;transform:translateY(-40px) scale(.4);opacity:0}
#ru .lmCard.burn .lmFace{animation:lmBurn .8s ease-in forwards}
#ru .lmCard.burn::after{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 50% 100%,#ffb13a,#ff4a1a 40%,transparent 70%);animation:lmFlame .8s ease-out forwards;pointer-events:none}
@keyframes lmBurn{0%{filter:none}40%{filter:brightness(1.6) sepia(1) hue-rotate(-20deg)}100%{filter:brightness(.2);clip-path:inset(100% 0 0 0);opacity:.2}}
@keyframes lmFlame{0%{opacity:0;transform:scaleY(.3)}30%{opacity:1}100%{opacity:0;transform:scaleY(1.4) translateY(-30%)}}
#ru .lmBurst{position:absolute;left:50%;top:50%;width:20px;height:20px;margin:-10px;border-radius:50%;pointer-events:none;z-index:3;box-shadow:0 0 0 4px #fff,0 0 30px 10px #ffd84a;animation:lmBurst .7s ease-out forwards}
@keyframes lmBurst{to{transform:scale(14);opacity:0}}
#ru .lmSlam{position:fixed;z-index:4;left:50%;transform:translate(-50%,-50%);pointer-events:none;text-align:center;white-space:nowrap;padding:8px 22px;background:rgba(6,5,10,.72);border:3px solid var(--ink);box-shadow:inset 0 0 0 2px #ffffff22,0 0 40px #000;animation:lmSlam 1.5s cubic-bezier(.2,1.5,.4,1) forwards}
#ru .lmSlam b{display:block;font:48px/1.1 var(--font-display);letter-spacing:.06em;animation:ruRbwT 1.2s steps(12) infinite}
#ru .lmSlam small{display:block;margin-top:6px;font:12px/1.2 var(--font-display);color:#fff;text-shadow:2px 2px 0 var(--ink)}
#ru .lmSlam.narrow b{font-size:32px}#ru .lmSlam.narrow small{font-size:10px}#ru .lmSlam.narrow{padding:6px 14px;max-width:94vw;white-space:normal}
@keyframes lmSlam{0%{transform:translate(-50%,-50%) scale(3) rotate(-6deg);opacity:0}12%{transform:translate(-50%,-50%) scale(1) rotate(-3deg);opacity:1}75%{transform:translate(-50%,-50%) scale(1.05) rotate(-3deg);opacity:1}100%{transform:translate(-50%,-80%) scale(1.1) rotate(-3deg);opacity:0}}
#ru .lmBit{position:fixed;z-index:4;width:6px;height:6px;pointer-events:none}
#ru .lmPillar{position:fixed;width:46px;margin-left:-23px;top:0;pointer-events:none;background:linear-gradient(90deg,transparent,#ff4f7e88,#ffd84acc,#ffffff,#4fd0ffcc,#b36bff88,transparent);filter:blur(1px);animation:lmPillar 1.4s ease-out forwards;mix-blend-mode:screen}
@keyframes lmPillar{0%{transform:scaleX(.1);opacity:0}15%{transform:scaleX(1.4);opacity:1}100%{transform:scaleX(.6);opacity:0}}
#ru .lmSheet{width:min(100%,600px);padding:8px 10px;background:rgba(18,16,26,.96);border:3px solid var(--ink);box-shadow:inset 0 0 0 2px var(--rc,var(--line-hi)),0 4px 0 var(--ink);display:grid;gap:5px;animation:ruFade .2s ease-out}
#ru .lmSheet.wait{opacity:.5}
#ru .lmSheet.big{width:min(100%,680px);padding:10px 12px;position:relative;overflow:hidden;animation:ruPop .45s cubic-bezier(.3,1.5,.5,1) both}
#ru .lmSheet.big::before{content:'';position:absolute;inset:0;border:3px solid transparent;border-image:linear-gradient(90deg,#ff4f7e,#ffa033,#ffd84a,#56d45a,#4fd0ff,#b36bff) 1;pointer-events:none}
#ru .shTop{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center}
#ru .shTop>img{width:40px;height:40px}
#ru .lmSheet.big .shTop>img{width:64px;height:64px;filter:drop-shadow(0 0 8px #fff)}
#ru .shTop b{display:block;font:9px/1.4 var(--font-display);color:var(--rc);font-weight:normal}
#ru .lmSheet.big .shTop b{font-size:22px;line-height:1.2}
#ru .shTop small{display:block;color:var(--dim);font-size:13px;line-height:1.2}
#ru .shTop em{font:7px/1.4 var(--font-display);font-style:normal;color:#fff;letter-spacing:.1em}
#ru .lmSheet.big .shTop em{font-size:13px;letter-spacing:.14em;margin-bottom:3px}
#ru .shD{font:14px/1 var(--font-display);text-shadow:2px 2px 0 var(--ink);text-align:right}
#ru .lmSheet.big .shD{font-size:20px}
#ru .shD small{display:flex;align-items:center;gap:3px;justify-content:flex-end;font:12px/1 var(--font-body);color:var(--dim);margin-top:4px}
#ru .shD small img{width:18px;height:18px}
#ru .shRows{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;gap:1px 10px;align-items:baseline;font-size:13px}
#ru .shRows .h{font:7px/1.4 var(--font-display);color:var(--faint)}
#ru .shRows span{color:var(--dim)}
#ru .shRows i{font-style:normal;color:var(--faint);text-align:right;font-variant-numeric:tabular-nums}
#ru .shRows b{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}
#ru .shRows em{font-style:normal;text-align:right;font-variant-numeric:tabular-nums;min-width:60px}
#ru .lmSheet.big .shRows{font-size:16px;gap:4px 14px}
#ru .lmSheet.big .shRows b{font:17px/1.3 var(--font-display);color:#fff;text-shadow:2px 2px 0 var(--ink)}
#ru .lmSheet.big .shRows em{font:15px/1.3 var(--font-display)}
#ru .lmSheet.big .shRows i{font-size:15px}
#ru .shAff{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:1px 12px;font-size:12px}
#ru .shAff span{display:flex;gap:5px;align-items:baseline;white-space:nowrap;overflow:hidden}
#ru .shAff i{font-style:normal;color:var(--dim);flex:1;overflow:hidden;text-overflow:ellipsis}
#ru .shAff b{font-variant-numeric:tabular-nums}
#ru .shAff em{font-style:normal;min-width:0}
#ru .lmSheet.big .shAff{font-size:13px}
#ru .shX{display:grid;gap:3px;font-size:13px}
#ru .shX p{margin:0;color:var(--text)}
#ru .shX p b{font:7px/1.5 var(--font-display);color:var(--gold);margin-right:4px;font-weight:normal}
#ru .shX .mk b{color:#ff9ae0}
#ru .shX .rl{color:#ffc890;font-style:italic}
#ru .shX .chg.up{color:var(--good)}#ru .shX .chg.dn{color:var(--bad)}
#ru .lmSheet.big .shX{font-size:15px}
#ru .shActs{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
#ru .lmFoot{display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap;font-size:13px;color:#d8dce8;text-shadow:1px 1px 0 var(--ink)}
#ru .lmFoot .ruChip{font-size:7px}
#ru .lmFoot .hint{background:rgba(10,9,16,.85);padding:3px 9px;border:2px solid var(--ink);box-shadow:inset 0 0 0 1px var(--line)}
body.ruStageUp #panel{opacity:.35;pointer-events:none;transition:opacity .25s}
body.ruStageUp .hud.bottom{opacity:.25;pointer-events:none;transition:opacity .25s}
#ru .lmMsg{font:9px/1.4 var(--font-display);color:#ffb15a;text-shadow:2px 2px 0 var(--ink);min-height:1.4em;text-align:center}
#ru .ru-loot.collapse .lmCard{height:120px;flex-basis:96px}
#ru .ru-loot.collapse .lmUp,#ru .ru-loot.collapse .lmWho,#ru .ru-loot.collapse .lmTag,#ru .ru-loot.collapse .lmRar{display:none}
#ru .ru-loot.collapse .lmIco{width:36px;height:36px}
@media (max-width:860px){#ru .lmCards{flex-wrap:wrap;gap:6px}#ru .lmCard{flex:0 1 calc(33.3% - 6px);height:178px}#ru .lmIco{width:40px;height:40px}#ru .lmCard.ultra .lmIco{width:46px;height:46px}
  #ru .lmInfo{display:block}#ru .lmSheet{padding:6px 8px}#ru .shRows{font-size:12px}#ru .lmSheet.big .shRows{font-size:13px}#ru .lmSheet.big .shTop>img{width:48px;height:48px}
  #ru .lmSheet.big .shTop b{font-size:16px}#ru .lmSheet.big .shTop em{font-size:9px}#ru .lmSheet.big .shD{font-size:16px}#ru .lmSheet.big .shRows b{font-size:12px}#ru .lmSheet.big .shRows em,#ru .lmSheet.big .shRows i{font-size:11px}#ru .lmSheet.big .shRows{font-size:13px;gap:2px 10px}#ru .lmHeroes button{min-width:36px}#ru .lmHeroes button img{width:20px;height:20px}
  #ru .lmTitle{font-size:11px}#ru .lmFoot .hint{display:none}#ru .shX{font-size:12px}#ru .lmSheet.big .shX{font-size:13px}}
@media (max-width:380px){#ru .lmCard{height:166px}#ru .lmName{font-size:7px}#ru .lmUp{font-size:11px}}
`);
  const LM = { L: null, ctx: null, who: null, sel: -1, rev: {}, flipped: false, msg: '', hold: null, ultraSeen: {} };
  // a card's ▲/▼ for the hero it is shown to: its own best fit (auto), or the hero picked in the switcher
  function lmStat(c) {
    if (LM.who == null || c.taken || c.burned) return { who: c.who, pct: c.pct, up: c.up, can: true };
    const can = !!G.canWear(LM.who, c.g), pct = can ? G.wants(LM.who, c.g) : null;
    return { who: LM.who, pct: pct == null ? 0 : pct, up: !!(can && G.upgrade(LM.who, c.g)), can };
  }
  const arrowHtml = (st, big) => (!st.can ? `<span class="eq">${esc(t('ru_cantWear'))}</span>` : st.up ? `<span class="up">▲ ${pctTxt(st.pct)}</span>` : st.pct < -1e-6 ? `<span class="dn">▼ ${pctTxt(st.pct)}</span>` : `<span class="eq">= 0%</span>`);
  const tagTxt = (c) => { if (!c.tag) return ''; if (c.tag === 'W') return t('loot_tag_W', whoName(c.who)); const k = 'loot_tag_' + c.tag; const s = t(k); return s === k ? '' : s; };
  function lmCardHtml(c, n) {
    const g = c.g, st = lmStat(c), ult = isUltra(g), rc = gcol(g);
    const rar = g.q ? t(isRelicQ(g.q) ? 'ru_tier_relic' : 'ru_tier_unique') : L(RAR(g.r).name);
    return `<button class="lmCard ${ult ? 'ultra' : ''} ${LM.rev[c.i] ? 'flip dealt' : ''} ${c.i === LM.sel ? 'sel' : ''} ${c.best ? 'best' : ''}" data-i="${c.i}" style="--rc:${rc}" aria-label="${esc(gname(g))}">
      <span class="lmIn"><span class="lmBackF"></span><span class="lmFace">
        ${tagTxt(c) ? `<em class="lmTag">${esc(tagTxt(c))}</em>` : `<em class="lmTag" style="visibility:hidden">·</em>`}
        ${img(gspr(g), 4, 'lmIco')}
        <b class="lmName ${ult ? 'ruRbw' : ''}">${esc(gname(g))}${g.e ? ' +' + g.e : ''}</b>
        <small class="lmRar">${esc(rar)} · il ${g.il | 0}</small>
        <span class="lmUp">${arrowHtml(st)}</span>
        <span class="lmWho">${img(whoSpr(st.who), 2)}${esc(whoName(st.who))}</span>
        <small class="lmBurn">${img('ic_ember', 1)}${fmt(c.v, true)}</small>
      </span></span>${n <= 9 ? `<kbd>${c.i + 1}</kbd>` : ''}<span class="lmInfo" data-info="${c.i}" role="button" aria-label="${esc(t('ru_info'))}">i</span><i class="lmHoldB"></i></button>`;
  }
  // the comparison rows (G.compareRows) in words and numbers; big: the ultra's stat sheet
  const rowLabel = k => (k === 'power' ? t('cmp_power') : k === 'dps' ? t('cmp_dps') : k === 'hp' ? t('cmp_hp') : k === 'crit' ? t('cmp_crit') : k === 'main' ? t('cmp_main') : k.startsWith('aff:') ? L((G.AFFIXES[k.slice(4)] || {}).name || k) : k);
  function rowVal(k, v, g) {
    if (typeof v !== 'number' || !isFinite(v)) return '—';
    if (k === 'crit') return (v * 100).toFixed(1) + '%';
    if (k === 'main') { const sl = G.slotOf(g.id); return sl === 'ring' || sl === 'ability' ? '+' + (v * 100).toFixed(1) + '%' : fmt(v, true); }
    if (k.startsWith('aff:')) { const A = G.AFFIXES[k.slice(4)] || {}; return A.x ? '+' + v.toFixed(2) + '×' : '+' + Math.round(v * 100) + '%'; }
    return fmt(v, true);
  }
  function rowDelta(k, d, g, p) {
    if (d == null || Math.abs(d) < 1e-9) return '<em class="eq">=</em>';
    const up = d > 0, a = Math.abs(d);
    let s;
    if (k === 'crit') s = (a * 100).toFixed(1) + '%';
    else if (k.startsWith('aff:')) { const A = G.AFFIXES[k.slice(4)] || {}; s = A.x ? a.toFixed(2) + '×' : Math.round(a * 100) + '%'; }
    else if (k === 'main') { const sl = G.slotOf(g.id); s = sl === 'ring' || sl === 'ability' ? (a * 100).toFixed(1) + '%' : fmt(a, true); }
    else s = fmt(a, true);
    return `<em class="${up ? 'up' : 'dn'}">${up ? '▲ +' : '▼ -'}${s}${k === 'power' && p != null ? ' (' + pctTxt(p) + ')' : ''}</em>`;
  }
  function sheetHtml(c) {
    if (!c) return '';
    const g = c.g, st = lmStat(c), ult = isUltra(g), tier = tierOf(g), rc = gcol(g), U = g.q ? G.UNIQUES[g.q] : null;
    // (nothing before its card has turned: the sheet comes in with the first face)
    if (!LM.rev[c.i]) return '';
    const who = st.who, rows = c.taken || c.burned ? [] : st.can ? (LM.who == null ? c.rows : G.compareRows(LM.who, g)) : [];
    const cur = G.eqOf(who)[G.slotOf(g.id)];
    const stat = rows.filter(r => !/^(rule|mark:|perk:)/.test(r.k)), other = rows.filter(r => /^(rule|mark:|perk:)/.test(r.k));
    // the hero's numbers (power, damage, health, crit) in full; the item's own (main stat, affixes) compact beside them
    const core = stat.filter(r => ['power', 'dps', 'hp', 'crit'].includes(r.k)), own = stat.filter(r => !['power', 'dps', 'hp', 'crit'].includes(r.k));
    const rowsH = (core.length ? `<div class="shRows"><span class="h"></span><i class="h">${esc(t('ru_worn'))}</i><b class="h">${esc(t('ru_this'))}</b><em class="h"></em>`
      + core.map(r => `<span>${esc(rowLabel(r.k))}</span><i>${rowVal(r.k, r.worn, cur || g)}</i><b>${rowVal(r.k, r.item, g)}</b>${rowDelta(r.k, r.delta, g, r.k === 'power' ? st.pct : null)}`).join('') + '</div>' : '')
      + (own.length ? `<div class="shAff">${own.map(r => `<span><i>${esc(rowLabel(r.k))}</i> <b>${rowVal(r.k, r.item, g)}</b> ${rowDelta(r.k, r.delta, g)}</span>`).join('')}</div>` : '');
    // what this hero would LOSE beyond the numbers (a worn rule, Mark or perk ranks); what it gains is the item's own list below
    const chg = other.map(r => {
      if (r.k === 'rule') return r.worn && r.worn !== r.item ? `<p class="chg dn">${esc(t('cmp_ruleLose', relicName(r.worn)))}${r.kept ? ' ' + esc(t('cmp_ruleKept')) : ''}</p>` : '';
      if (r.k.startsWith('mark:')) { const id = r.k.slice(5), nm = G.markName ? G.markName(id) : id, R_ = ['', 'I', 'II', 'III']; return r.item < r.worn ? `<p class="chg dn">${esc(t('cmp_markLose', nm + ' ' + R_[r.worn]))}${r.kept ? ' ' + esc(t('cmp_ruleKept')) : ''}</p>` : ''; }
      if (r.k.startsWith('perk:')) { const id = r.k.slice(5), P = G.PERKS[id], d = (r.item | 0) - (r.worn | 0); return d < 0 ? `<p class="chg dn">${esc(t('cmp_rankLose', -d, P ? L(P.name) : id))}</p>` : ''; }
      return '';
    }).join('');
    // the item's own Marks (named, one line each), perk ranks and rule
    const marks = (c.marks || []).map(m => `<p class="mk"><b>${esc(m.name)} ${esc(m.roman)}</b>${esc(m.text)}</p>`).join('');
    const ranks = (c.ranks || []).map(x => `<p class="chg up"><b>+${x.n}</b>${esc(L(x.name))}${G.PERK_SCHOOL && G.PERK_SCHOOL[x.id] ? ' · ' + esc(schoolName(G.PERK_SCHOOL[x.id])) : ''}</p>`).join('');
    const rule = U ? `<p class="rl"><b>${esc(t(isRelicQ(g.q) ? 'ru_tier_relic' : 'ru_rule'))}</b>${esc(L(U.fx))}</p>` : '';
    const tg = c.taken ? (c.who === 'bag' ? t('ru_stashed') : t('ru_equipped', whoName(c.who))) : '';
    const big = ult;
    const slotName = t('ru_slot_' + G.slotOf(g.id));
    return `<div class="lmSheet ${big ? 'big' : ''}" style="--rc:${rc}">
      <div class="shTop">${img(gspr(g), big ? 5 : 3)}<div>${big ? `<em class="ruRbw">✦ ${esc(t('ru_ultra'))} · ${esc(t('ru_tier_' + tier))} ✦</em>` : ''}<b class="${ult ? 'ruRbw' : ''}">${esc(gname(g))}${g.e ? ' +' + g.e : ''}</b>
        <small>${esc(g.q ? relicName(g.q) === gname(g) ? L((G.ITEM_BY_ID[g.id] || {}).name || '') : '' : L(RAR(g.r).name))} · ${esc(slotName)} · il ${g.il | 0}${cur ? '' : ' · ' + esc(t('ru_noWorn'))}</small></div>
        <div class="shD">${tg ? `<span class="up" style="font-size:9px">${esc(tg)}</span>` : arrowHtml(st, big)}<small>${img(whoSpr(who), 2)}${esc(t('ru_for', whoName(who)))}</small></div></div>
      ${rowsH}${chg || marks || ranks || rule ? `<div class="shX">${chg}${marks ? `${marks}` : ''}${ranks}${rule}</div>` : ''}
      ${!c.taken && !c.burned ? `<div class="shActs"><button class="btn gold" data-take="${c.i}">${esc(t('ru_take', whoName(who)))}</button><button class="btn" data-stash="${c.i}">${esc(t('ru_stash'))}</button></div>` : ''}</div>`;
  }
  function lootRender() {
    const L_ = run() && run().loot; if (!L_) return;
    const view = G.lootView() || [], n = view.length, ws = whos();
    if (LM.sel < 0 || LM.sel >= n || (view[LM.sel] && (view[LM.sel].taken || view[LM.sel].burned))) LM.sel = Math.max(0, view.findIndex(c => !c.taken && !c.burned));
    const left = Math.max(0, L_.pick - L_.taken);
    const sub = L_.lord && L_.kind !== 'final' ? (G.bossName ? G.bossName(L_.d) : '') : '';
    const extras = [];
    for (const k in L_.orbs || {}) extras.push(`<span class="ruChip">${img('orb_' + k, 1)}+${L_.orbs[k]}</span>`);
    if (L_.key) extras.push(`<span class="ruChip">${img('ic_key', 1)}${esc(t('loot_key'))}</span>`);
    const html = `<div class="lmDim"></div><div class="lmWrap">
      <div class="lmHead"><div class="lmTitle">${esc(t('ru_loot' + (L_.kind || 'boss')))}${sub ? `<small>${esc(sub)}</small>` : ''}</div>
        ${ws.length > 1 ? `<div class="lmHeroes"><button class="auto ${LM.who == null ? 'on' : ''}" data-who="auto">${esc(t('ru_auto'))}</button>${ws.map(w => `<button class="${LM.who === w ? 'on' : ''}" data-who="${w}">${img(whoSpr(w), 2)}${esc(whoName(w))}</button>`).join('')}</div>` : ''}
        <div class="lmRing ${L_.collapse ? '' : ''}" ${L_.collapse ? 'hidden' : ''}><svg viewBox="0 0 36 36"><circle class="bg" cx="18" cy="18" r="15"/><circle class="fg" cx="18" cy="18" r="15" stroke-dasharray="94.25" stroke-dashoffset="0"/></svg><b>${Math.ceil(L_.T - L_.t)}</b></div></div>
      <div class="lmSheetBox">${L_.collapse ? '' : sheetHtml(view[LM.sel])}</div>
      <div class="lmCards">${view.map(c => lmCardHtml(c, n)).join('')}</div>
      <div class="lmMsg">${esc(LM.msg || (L_.collapse ? t('loot_collapse') : left > 1 ? t('ru_left', left) : ''))}</div>
      <div class="lmFoot">${extras.join('')}<span class="hint">${esc(t('ru_lootHint', Math.min(n, 9)))}</span><span class="ruChat ckChat" hidden></span></div></div>`;
    const s = open('loot', { stage: true, html, keys: lootKeys, def: lootBest, cls: L_.collapse ? 'collapse' : '' });
    s.el.onclick = lootClick; s.el.onpointerdown = lootDown; s.el.onpointerup = lootUp; s.el.onpointercancel = lootCancel; s.el.onpointerleave = null;
    s.el.onpointerover = e => { const b = e.target.closest('.lmCard'); if (b && e.pointerType === 'mouse' && LM.flipped) lootSelect(+b.dataset.i); };
    if (!s.raf) s.raf = requestAnimationFrame(lootRing);
    if (votes.loot) drawVotes('loot');
  }
  function lootSheetOnly() {
    const s = SCR.loot; if (!s) return;
    const view = G.lootView(); if (!view) return;
    const box = s.el.querySelector('.lmSheetBox'); if (box) box.innerHTML = sheetHtml(view[LM.sel]);
    s.el.querySelectorAll('.lmCard').forEach(el => el.classList.toggle('sel', +el.dataset.i === LM.sel));
  }
  function lootSelect(i) { if (i === LM.sel) return; LM.sel = i; lootSheetOnly(); }
  // the ring: the moment's own clock (run.js, real seconds), its pillar wait, a touch that stops it
  function lootRing() {
    const s = SCR.loot; if (!s || s.closing) return;
    s.raf = requestAnimationFrame(lootRing);
    // (uifix: the ring is a clock in whole seconds: 8 updates a second are plenty - every frame it was 30-46 SVG attribute
    // writes a second during the ultra moment)
    const nowT = now(); if (s.ringT && nowT - s.ringT < 120) return; s.ringT = nowT;
    const L_ = run() && run().loot, ring = s.el.querySelector('.lmRing');
    if (!L_ || !ring || ring.hidden) return;
    const fg = ring.querySelector('.fg'), b = ring.querySelector('b');
    const left = L_.wait > 0 ? L_.T : Math.max(0, L_.T - L_.t), k = clamp(left / (L_.T || 1), 0, 1);
    const off = (94.25 * (1 - k)).toFixed(1);
    if (fg._o !== off) { fg._o = off; fg.setAttribute('stroke-dashoffset', off); }
    const paused = !!L_.touch;
    if (ring._p !== paused) { ring._p = paused; ring.classList.toggle('paused', paused); }
    ring.classList.toggle('low', !paused && left < 2);
    setT(b, paused ? t('ru_paused') : String(Math.ceil(left)));
  }
  // the deal and the flips: plain cards first (fast), each ultra last with its beat of suspense
  function lootDeal() {
    const s = SCR.loot, L_ = run() && run().loot; if (!s || !L_) return;
    const view = G.lootView() || [], cards = s.el.querySelectorAll('.lmCard');
    const fast = L_.collapse || reduced();
    sfx('whoosh');
    // dealt from where the boss fell (the Button): each card starts there and flies to its place
    const bp = btnPoint(), row = s.el.querySelector('.lmCards'), rr = row && row.getBoundingClientRect();
    if (bp && rr && !fast) {
      cards.forEach((el, i) => { const cx = rr.left + el.offsetLeft + el.offsetWidth / 2, cy = rr.top + el.offsetTop + el.offsetHeight / 2; el.style.setProperty('--fx', Math.round(bp.x - cx) + 'px'); el.style.setProperty('--fy', Math.round(bp.y - cy) + 'px'); el.style.setProperty('--fr', ((i - (cards.length - 1) / 2) * 14) + 'deg'); });
      const pk = document.createElement('i'); pk.className = 'lmPack'; pk.style.left = bp.x + 'px'; pk.style.top = bp.y + 'px'; ensureRoot().appendChild(pk); setTimeout(() => pk.remove(), 700);
    }
    cards.forEach((el, i) => later('loot', () => el.classList.add('dealt'), fast ? 20 : 80 + i * 90));
    let at = fast ? 120 : 60 + cards.length * 90 + 200;
    const plain = view.filter(c => !isUltra(c.g)), ultras = view.filter(c => isUltra(c.g)).sort((a, b) => TIER_RANK[tierOf(a.g)] - TIER_RANK[tierOf(b.g)] || a.g.r - b.g.r);
    for (const c of plain) { const i = c.i; later('loot', () => lootFlip(i, false), at); at += fast ? 30 : 120; }
    ultras.forEach((c, k) => {
      const i = c.i;
      if (fast) { later('loot', () => lootFlip(i, true), at); at += 60; return; }
      // (the first one gets the whole beat of suspense; each one after it a shorter one)
      const charge = k ? 560 : 900;
      // (uifix: the sheet of the card turned last stays up through the charge - selecting the face-down card emptied the
      // sheet box for 0.6-0.9 s, a black upper screen on a phone; the flip selects it)
      later('loot', () => { const el = cardEl(i); if (el) el.classList.add('charge'); ultraRiser(charge / 1000); }, at);
      at += charge;
      later('loot', () => lootFlip(i, true), at);
      at += k < ultras.length - 1 ? 700 : 900;
    });
    later('loot', () => { LM.flipped = true; const u = ultras.length ? ultras[ultras.length - 1].i : null; const L2 = run() && run().loot; LM.sel = u != null ? u : L2 && L2.best >= 0 ? L2.best : LM.sel; lootSheetOnly(); }, at);
    // the moment's clock waits for the reveal (run.js holds it lootUltraT a pillar; this reveal may take longer)
    if (!fast && G.lootHold) G.lootHold(at / 1000);
  }
  const cardEl = i => SCR.loot && SCR.loot.el.querySelector(`.lmCard[data-i="${i}"]`);
  // where the Button stands on screen (null before the stage is up: a moment reopened while the page boots)
  function btnPoint() { try { const St = G.Stage; if (!St || !St.rect || !St.rect() || !St.buttonPoint) return null; const p = St.buttonPoint(); return p && isFinite(p.x) && isFinite(p.y) ? p : null; } catch (e) { return null; } }
  function lootFlip(i, ult) {
    const el = cardEl(i); if (!el || LM.rev[i]) return;
    LM.rev[i] = 1;
    el.classList.remove('charge'); el.classList.add('flip', 'dealt');
    const v = G.lootView() || [], c = v[i];
    if (!c) return;
    if (ult) {
      const tier = c.ultraKind || tierOf(c.g), at = rectOf(el) || { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      const burst = document.createElement('i'); burst.className = 'lmBurst'; el.appendChild(burst); setTimeout(() => burst.remove(), 800);
      ultraSting(tier);
      LM.ultraSeen[i] = tier;
      try { G.emit('lootUltra', c, tier, { x: at.x, y: at.y }); } catch (e) { /* listeners are optional */ }
      try { if (G.Stage) { G.Stage.flash && G.Stage.flash(0.55, tier === 'divine' ? '#ffffff' : tier === 'mythic' ? '#ff4f7e' : '#ffd84a'); G.Stage.shake && G.Stage.shake(7); } } catch (e) { /* the field is optional */ }
      // the field's pillar where the boss fell (the stage draws its own when it has one: G.Stage.lootPillar)
      if (!(G.Stage && typeof G.Stage.lootPillar === 'function') && !reduced()) {
        const bp = btnPoint(), p = document.createElement('i'); p.className = 'lmPillar';
        p.style.left = (bp ? bp.x : at.x) + 'px'; p.style.height = Math.max(120, (bp ? bp.y : at.y) + 20) + 'px';
        // (behind the cards, over the field)
        const se = SCR.loot && SCR.loot.el, wr = se && se.querySelector('.lmWrap');
        if (wr) se.insertBefore(p, wr); else ensureRoot().appendChild(p);
        setTimeout(() => p.remove(), 1500);
      }
      // the slam: the tier's name, rainbow, over the field half of the screen (uifix: it used to sit 130 px over the card,
      // which is the sheet's WEAR/STASH row on every layout); a burst of confetti. The field's dims lift for the pillar's
      // 1.5 s (class pillarUp; the stage lifts its own), and on a wide screen the sheet steps aside for the first second so
      // the pillar's base and the Button show (class reveal). The old light rays (a 900 px spinning masked gradient) are
      // gone: the stage draws god rays of its own, and that element alone cost ~6 fps.
      if (!reduced()) {
        const se = SCR.loot && SCR.loot.el, wr = se && se.querySelector('.lmWrap'), wide = !!(se && se.classList.contains('wide'));
        const wrTop = wr ? wr.getBoundingClientRect().top : window.innerHeight * 0.5;
        const sl = document.createElement('div'); sl.className = 'lmSlam' + (wide ? '' : ' narrow');
        sl.style.top = Math.round(wide ? Math.max(70, Math.min(wrTop - 56, window.innerHeight * 0.42)) : Math.max(60, window.innerHeight * 0.26)) + 'px';
        sl.innerHTML = `<b class="ruRbw">${esc(t('ru_tier_' + tier))}!</b><small>${esc(gname(c.g))}</small>`;
        ensureRoot().appendChild(sl); setTimeout(() => sl.remove(), 1600);
        if (se) {
          se.classList.add('pillarUp'); later('loot', () => se.classList.remove('pillarUp'), 1500);
          if (wide) { se.classList.add('reveal'); later('loot', () => se.classList.remove('reveal'), 950); }
        }
        const cols = ['#ff4f7e', '#ffa033', '#ffd84a', '#56d45a', '#4fd0ff', '#b36bff', '#ffffff'];
        for (let k = 0; k < 26; k++) {
          const bit = document.createElement('i'); bit.className = 'lmBit'; bit.style.left = at.x + 'px'; bit.style.top = at.y + 'px'; bit.style.background = cols[k % cols.length];
          ensureRoot().appendChild(bit);
          const a = Math.random() * Math.PI * 2, d = 70 + Math.random() * 160;
          bit.animate([{ transform: 'translate(-50%,-50%) scale(1.4)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d + 60}px)) rotate(${(Math.random() * 720) | 0}deg) scale(.6)`, opacity: 0 }],
            { duration: 700 + Math.random() * 500, easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'forwards' }).onfinish = () => bit.remove();
        }
      }
      lootSelect(i); lootSheetOnly();
    } else {
      if (G.Audio && G.Audio.loot) sfx('loot', 'item', clamp(c.g.r | 0, 0, 4)); else Snd.flip(c.g.r | 0);
      if (i === LM.sel) lootSheetOnly();
    }
  }
  function lootTakeI(i, stash) {
    const L_ = run() && run().loot, v = G.lootView(); if (!L_ || !v || !v[i]) return false;
    if (!LM.rev[i]) { lootFlip(i, isUltra(v[i].g)); return true; }
    const c = v[i], st = lmStat(c), who = stash ? 'bag' : st.who;
    if (!G.lootTake(i, who, !!stash)) { sfx('error'); return false; }
    return true;
  }
  function lootBest() {
    const L_ = run() && run().loot; if (!L_) return;
    // (nothing turned yet: show them all at once first)
    if (!LM.flipped) { const v = G.lootView() || []; v.forEach(c => { if (!LM.rev[c.i]) lootFlip(c.i, isUltra(c.g)); }); LM.flipped = true; return; }
    if (!(G.lootTakeBest && G.lootTakeBest())) { sfx('error'); LM.msg = t('loot_none'); const m = SCR.loot && SCR.loot.el.querySelector('.lmMsg'); if (m) m.textContent = LM.msg; }
  }
  function lootKeys(e, fresh) {
    const d = digit(e), v = G.lootView() || [];
    if (d >= 1 && d <= v.length) { if (fresh) { G.lootTouch && G.lootTouch(); lootTakeI(d - 1, e.shiftKey); } return true; }
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') { const k = e.code === 'ArrowLeft' ? -1 : 1; let i = LM.sel; for (let g = 0; g < v.length; g++) { i = (i + k + v.length) % v.length; if (!v[i].taken && !v[i].burned) break; } lootSelect(i); return true; }
    if (e.code === 'KeyS') { if (fresh) lootTakeI(LM.sel, true); return true; }
    if (e.code === 'KeyW') { if (fresh) lootTakeI(LM.sel, false); return true; }
    return false;
  }
  // tap = wear it on the hero shown; hold (0.45 s) = stash it
  function lootDown(e) {
    if (G.lootTouch) G.lootTouch();
    if (G.Audio && G.Audio.unlock) G.Audio.unlock();
    const b = e.target.closest('.lmCard'); if (!b || e.target.closest('.lmInfo') || b.classList.contains('taken') || b.classList.contains('burn')) return;
    const i = +b.dataset.i;
    if (!LM.rev[i]) return;
    LM.hold = { i, x: e.clientX, y: e.clientY, done: false, el: b, id: setTimeout(() => { if (!LM.hold || LM.hold.i !== i) return; LM.hold.done = true; b.classList.remove('holding'); lootTakeI(i, true); }, 450) };
    b.classList.add('holding');
    try { b.setPointerCapture(e.pointerId); } catch (er) { /* fine */ }
  }
  function lootUp(e) {
    const h = LM.hold; LM.hold = null;
    if (!h) return;
    clearTimeout(h.id); h.el.classList.remove('holding');
    if (h.done) { h.el._noClick = true; return; }
    if (Math.abs(e.clientX - h.x) > 14 || Math.abs(e.clientY - h.y) > 14) { h.el._noClick = true; return; }
    h.el._noClick = true;
    lootTakeI(h.i, false);
  }
  function lootCancel() { const h = LM.hold; LM.hold = null; if (h) { clearTimeout(h.id); h.el.classList.remove('holding'); } }
  function lootClick(e) {
    const info = e.target.closest('[data-info]'); if (info) { e.stopPropagation(); lootSelect(+info.dataset.info); return; }
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.who != null) { LM.who = b.dataset.who === 'auto' ? null : +b.dataset.who; lootRender(); sfx('buy'); return; }
    if (b.dataset.take != null) { lootTakeI(+b.dataset.take, false); return; }
    if (b.dataset.stash != null) { lootTakeI(+b.dataset.stash, true); return; }
    if (b.classList.contains('lmCard')) {
      if (b._noClick) { b._noClick = false; return; }
      const i = +b.dataset.i;
      // (a keyboard click, or a card still face down: turn it / take it)
      if (!LM.rev[i]) { const v = G.lootView() || []; if (v[i]) lootFlip(i, isUltra(v[i].g)); return; }
      lootTakeI(i, false);
    }
  }
  function lootOpen(L_, ctx) {
    if (!L_) return;
    LM.L = L_; LM.ctx = ctx || null; LM.who = null; LM.rev = {}; LM.flipped = false; LM.msg = ''; LM.ultraSeen = {};
    LM.sel = L_.best >= 0 ? L_.best : 0;
    // (uifix: the comparison rows read D: a keepsake attuned or gear moved at bossWin left D stale, so the same sheet read
    // differently after a reload (Worn 448 before, 570 after). One recalc before the sheet is built.)
    try { if (G.recalc) G.recalc(); } catch (e) { /* the sheet still reads what D holds */ }
    if (SCR.loot) { clearTimers(SCR.loot); SCR.loot.el.remove(); const k = STACK.indexOf('loot'); if (k >= 0) STACK.splice(k, 1); delete SCR.loot; }
    if (isOpen('cards')) close('cards');
    lootRender();
    lootDeal();
  }
  G.on('lootMoment', (L_, ctx) => lootOpen(L_, ctx));
  G.on('lootUpdate', () => { LM.msg = ''; if (isOpen('loot')) lootRender(); });
  G.on('lootTake', (i, c, w, info) => {
    const s = SCR.loot; if (!s) return;
    const el = cardEl(i), r = rectOf(el);
    sfx(c && c.g && c.g.q ? 'pick' : 'buy', c && c.g && c.g.q ? 'uq' : undefined);
    LM.msg = w === 'bag' ? t('ru_stashed') : t('ru_equipped', whoName(w)) + (info && info.pct != null && info.pct > 0 ? ' ' + pctTxt(info.pct) : '');
    const m = s.el.querySelector('.lmMsg'); if (m) m.textContent = LM.msg;
    if (r) floatText(r.x, r.y - 30, w === 'bag' ? '⤓' : '✔', 'big');
    if (el) el.classList.add('taken');
    const hb = s.el.querySelector(`.lmHeroes [data-who="${w}"]`); if (hb) { hb.classList.remove('got'); void hb.offsetWidth; hb.classList.add('got'); }
    if (info && info.moved) toast(esc(t('gear_onward', gname(info.moved.g), whoName(info.moved.who))), '', gspr(info.moved.g));
  });
  G.on('lootBurn', (list, total) => {
    const s = SCR.loot;
    if (!s || !list || !list.length) return;
    pouchHold = 1;
    burnSnd();
    let k = list.length;
    list.forEach((x, j) => {
      const el = cardEl(x.i), r = rectOf(el);
      setTimeout(() => {
        // (uifix: not once the moment has gone - a stray '+0' used to float over the camp that came next)
        if (SCR.loot !== s || s.closing) return;
        if (el) el.classList.add('burn');
        // (uifix: a run-1 common is worth 0.3-0.5 Ember: one decimal, never '+0')
        if (r) { floatText(r.x, r.y - 10, '+' + fmtE(x.v)); flyEmbers(r, Math.max(2, x.v), () => { if (--k <= 0) { pouchHold = 0; hudUpdate(true); } }); }
        else if (--k <= 0) { pouchHold = 0; hudUpdate(true); }
      }, j * 90);
    });
    const m = s.el.querySelector('.lmMsg'); if (m) { m.textContent = t('ru_burned', fmtE(total)); }
    setTimeout(() => { if (pouchHold) { pouchHold = 0; hudUpdate(true); } }, 2500);
  });
  G.on('lootDone', () => {
    const s = SCR.loot; if (!s) return;
    s.done = true;
    // (the burn plays out; the card that comes next waits for it: the sync opens it once this has gone)
    setTimeout(() => { if (SCR.loot === s) { close('loot', 240); setTimeout(() => safe(sync), 260); } }, 750);
  });

  // ---------- CAMP (DESIGN §5.5): one action (Rest / Temper / Train), the market, a recruit, Enchant All, Reforge,
  // Extract (Camp 4: 'Extract now: N Embers safe, or go for x1.5'), then the doors; on its own after 30 s untouched ----------
  CSS_PARTS.push(`
#ru .ru-camp .ruBox{width:min(940px,100%)}
#ru .cpHead{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center}
#ru .cpHead h2{text-align:left}
#ru .cpHead small{display:block;color:var(--dim)}
#ru .cpVit{display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:flex-end}
#ru .cpHp{display:grid;justify-items:center;gap:1px;width:44px;font:6px/1.2 var(--font-display);color:var(--dim)}
#ru .cpHp img{width:26px;height:26px}
#ru .cpHp i{display:block;width:100%;height:5px;background:#2a0f16;border:1px solid var(--ink)}
#ru .cpHp u{display:block;height:100%;background:var(--good)}
#ru .cpHp.low u{background:var(--hp)}
#ru .cpActs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
#ru .cpAct{display:grid;justify-items:center;gap:4px;padding:10px 6px;cursor:pointer;text-align:center;color:var(--text);background:var(--panel2);border:2px solid var(--ink);box-shadow:inset 0 0 0 2px var(--line);font:13px/1.2 var(--font-body)}
#ru .cpAct:hover:not([disabled]){box-shadow:inset 0 0 0 2px var(--gold)}
#ru .cpAct b{font:9px/1.4 var(--font-display);color:var(--gold);font-weight:normal}
#ru .cpAct img{width:30px;height:30px}
#ru .cpAct.on{background:#2c3a26;box-shadow:inset 0 0 0 2px var(--good)}
#ru .cpAct[disabled]:not(.on){opacity:.4;cursor:default}
#ru .cpMarket{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}
#ru .cpWare{position:relative;display:grid;grid-template-columns:34px minmax(0,1fr);gap:2px 8px;align-items:center;padding:6px 8px;text-align:left;cursor:pointer;color:var(--text);background:var(--panel2);border:2px solid var(--ink);box-shadow:inset 0 0 0 2px var(--rc,var(--line));font:13px/1.2 var(--font-body)}
#ru .cpWare img{width:30px;height:30px;grid-row:span 2}
#ru .cpWare b{font-weight:600;font-size:13px;line-height:1.15;color:var(--wc,#fff)}
#ru .cpWare .pr{display:flex;align-items:center;gap:4px;font:8px/1 var(--font-display);color:var(--gold)}
#ru .cpWare .pr img{width:12px;height:12px;grid-row:auto}
#ru .cpWare.cant .pr{color:var(--bad)}
#ru .cpWare.sold{opacity:.45;cursor:default}
#ru .cpWare.sold .pr{color:var(--good)}
#ru .cpWare small{grid-column:2;font-size:12px;color:var(--dim)}
#ru .cpLock{position:absolute;right:3px;top:3px;width:20px;height:20px;padding:0;display:grid;place-items:center;background:var(--ink);border:1px solid var(--line);cursor:pointer;font:9px/1 var(--font-display);color:var(--faint)}
#ru .cpLock.on{color:var(--gold);border-color:var(--gold)}
#ru .cpRecruits{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:6px}
#ru .cpRec{display:grid;justify-items:center;gap:2px;padding:8px 6px;cursor:pointer;text-align:center;color:var(--text);background:var(--panel2);border:2px solid var(--ink);box-shadow:inset 0 0 0 2px var(--role,var(--line));font:13px/1.2 var(--font-body)}
#ru .cpRec:hover{box-shadow:inset 0 0 0 2px var(--gold)}
#ru .cpRec img{width:40px;height:40px}
#ru .cpRec b{font:8px/1.5 var(--font-display);color:var(--gold);font-weight:normal}
#ru .cpRec em{font:7px/1.3 var(--font-display);font-style:normal;color:var(--role,var(--dim))}
#ru .cpRec strong{font-size:13px;color:#ffd0a0;font-weight:600}
#ru .cpRec small{color:var(--dim);font-size:12px}
#ru .cpTools{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px}
#ru .cpTool{display:grid;gap:6px;padding:8px 10px;background:var(--panel2);border:2px solid var(--ink);box-shadow:inset 0 0 0 2px var(--line)}
#ru .cpTool b{font:8px/1.5 var(--font-display);color:var(--gold);font-weight:normal}
#ru .cpTool small{color:var(--dim);font-size:13px}
#ru .cpTool .per{display:flex;gap:6px;flex-wrap:wrap}
#ru .cpTool .per span{display:inline-flex;align-items:center;gap:3px;font-size:12px;color:var(--good)}
#ru .cpTool .per img{width:18px;height:18px}
#ru .cpTool.ext{box-shadow:inset 0 0 0 2px #ff9a4a}
#ru .cpFoot{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;position:sticky;bottom:-16px;padding:10px 0 4px;background:linear-gradient(transparent,var(--panel) 30%)}
#ru .cpPurse{display:flex;gap:6px;flex-wrap:wrap}
#ru .cpFoot .go{display:grid;justify-items:end;gap:3px}
@media (max-width:600px){#ru .cpActs{grid-template-columns:minmax(0,1fr)}#ru .cpAct{grid-template-columns:34px minmax(0,1fr);justify-items:start;text-align:left}#ru .cpAct img{grid-row:span 2}
  #ru .cpMarket{grid-template-columns:minmax(0,1fr)}#ru .cpRecruits{grid-template-columns:repeat(2,minmax(0,1fr))}#ru .cpHead{grid-template-columns:minmax(0,1fr)}#ru .cpVit{justify-content:flex-start}#ru .cpFoot .go{justify-items:stretch;width:100%}}
`);
  const WARE_ICO = { item: null, orbs: 'orb_flux', potion: 'pot_life', mend: 'ic_heart', reroll: 'ic_clover', pip: 'ic_heart', key: 'ic_key', gamble: 'ic_scale' };
  let extractArm = 0;
  // the Button's health, then each hero's (who 'btn' = the Button)
  function hpChip(who) {
    const U = G.partyUnits ? (G.partyUnits() || []) : [];
    const u = who === 'btn' ? null : U.find(x => x.who === who) || null;
    let k = 1;
    if (who === 'btn') k = G.D.heroHp > 0 ? clamp(G.S.hero.hp / G.D.heroHp, 0, 1) : 1;
    else if (u && u.max > 0) k = u.down > 0 ? 0 : clamp(u.hp / u.max, 0, 1);
    return `<span class="cpHp ${k < 0.35 ? 'low' : ''}">${img(who === 'btn' ? 'ic_heart' : whoSpr(who), 2)}<i><u style="width:${Math.round(k * 100)}%"></u></i>${who === 'btn' ? esc(t('ru_button')) : esc(whoName(who))}</span>`;
  }
  function renderCamp() {
    const c = G.campNow && G.campNow(), r = run(), S = G.S;
    if (!c || !r) { if (isOpen('camp')) close('camp', 200); return; }
    const land = G.REALMS[r.route[c.slot]] || {}, heat = G.heat ? G.heat() : { rest: 0.4 };
    const gold = S.gold || 0, shards = (S.hero && S.hero.shards) | 0;
    const act = k => `<button class="cpAct ${c.act === k ? 'on' : ''}" data-act="${k}" ${c.act ? 'disabled' : ''}>${img(k === 'rest' ? 'ic_heart' : k === 'temper' ? 'ic_gear' : 'ic_scroll', 3)}<b>${esc(t('camp_' + k).split(':')[0])}</b><small>${esc(k === 'rest' ? t('camp_rest', Math.round(heat.rest * 100)).split(': ').slice(1).join(': ') : t('camp_' + k).split(': ').slice(1).join(': '))}</small></button>`;
    const ware = (w, i) => {
      const cur = w.cur === 'shards' ? shards : gold, can = !w.sold && cur >= w.price;
      let name = t('ware_' + w.k), ico = WARE_ICO[w.k] || 'ic_bag', rc = '', wc = '', sub = '';
      if (w.k === 'item' && w.g) { name = gname(w.g); ico = gspr(w.g); rc = gcol(w.g); wc = rc; const bw = G.bestWearer(w.g); sub = bw.up ? `<span class="up">▲ ${pctTxt(bw.pct)}</span> ${esc(whoName(bw.who))}` : `<span class="eq">${esc(t('loot_none'))}</span>`; }
      if (w.k === 'gamble') name = t('ware_gamble', t('ru_slot_' + w.slot));
      return `<button class="cpWare ${w.sold ? 'sold' : can ? '' : 'cant'}" data-buy="${i}" style="${rc ? '--rc:' + rc + ';--wc:' + wc : ''}" ${w.sold ? 'disabled' : ''}>${img(ico, 3)}<b class="${w.g && isUltra(w.g) ? 'ruRbw' : ''}">${esc(name)}</b>
        <span class="pr">${w.sold ? esc(t('ru_sold')) : img(w.cur === 'shards' ? 'ic_shard' : 'ic_coin', 1) + fmt(w.price)}</span>${sub ? `<small>${sub}</small>` : ''}
        ${!w.sold ? `<span class="cpLock ${c.lock === i ? 'on' : ''}" data-lock="${i}" role="button" title="${esc(t('camp_lock'))}">${c.lock === i ? '■' : '□'}</span>` : ''}</button>`;
    };
    const rec = c.recruits && !c.hired ? `<h3 class="ruS">${esc(t('ru_recruitTitle'))}</h3><div class="cpRecruits">${c.recruits.map((x, i) => { const C = G.CLASS_BY_ID[x.cls] || {}, T = (G.TRAITS || {})[x.trait] || {}, role = G.ROLES[x.cls];
      return `<button class="cpRec r_${role}" data-rec="${i}">${img(C.spr || 'h_knight', 4)}<b>${esc(L(C.name || x.cls))}</b><em>${esc(G.ROLE_NAMES[role] || '')}</em><strong>${esc(L(T.name || x.trait))}</strong><small>${esc(L(T.desc || ''))}</small></button>`; }).join('')}</div>`
      : c.hired ? `<p class="ruNote">${esc(t('ru_recruitDone'))}</p>` : '';
    // (runflow: c.can says what this camp offers - Forge I's Enchant All, Forge II's Reforge; else the derived flags)
    const can = c.can || { enchant: !!G.D.enchantAll, reforge: !!G.D.reforge };
    let ench = '';
    if (can.enchant && G.enchantPlan) {
      const plan = safe(() => G.enchantPlan({}), null);
      const steps = plan ? plan.steps | 0 : 0, cost = plan && (plan.cost || plan.spent) || {};
      const per = plan ? (plan.perHero || plan.per || []).filter(x => x.levels > 0) : [];
      ench = `<div class="cpTool"><b>${esc(t('ench_all'))}</b><small>${esc(steps ? t('ench_cost', steps, fmt(cost.shards || 0), fmt(cost.whet || 0)) : t('ench_none'))}</small>
        ${per.length ? `<div class="per">${per.map(x => `<span>${img(whoSpr(x.who), 2)}+${x.levels}${x.pct ? ' (' + pctTxt(x.pct) + ')' : ''}</span>`).join('')}</div>` : `<small>${esc(t('ru_enchHint'))}</small>`}
        <button class="btn gold" data-ench ${steps ? '' : 'disabled'}>${esc(t('ench_go', steps))}</button></div>`;
    }
    let reforge = '';
    if (can.reforge && G.campReforge) {
      const cost = Math.ceil(Math.max(1, G.D.incomeRef || 1) * (TUNE.reforgeSecs || 60)), list = [];
      for (const w of whos()) for (const sl of G.SLOTS) { const g = G.eqOf(w)[sl]; if (g && (g.il | 0) < S.depth) list.push({ g, w }); }
      list.sort((a, b) => (a.g.il | 0) - (b.g.il | 0));
      if (list.length) reforge = `<div class="cpTool"><b>${esc(t('camp_reforge'))}</b><small>${esc(t('ru_reforgeT'))}</small><div class="per">${list.slice(0, 4).map(x => `<button class="btn" data-ref="${x.g.u}" ${gold >= cost ? '' : 'disabled'}>${img(gspr(x.g), 1)} il ${x.g.il | 0}→${S.depth} · ${img('ic_coin', 1)}${fmt(cost)}</button>`).join('')}</div></div>`;
    }
    // (runflow: c.extract is the camp's own Extract line - the Embers banked at x1 now, Camp 4's 'or go for x1.5' text)
    const ex = c.extract || (G.campExtract ? safe(() => G.campExtract(), null) : null);
    const emb = ex ? ex.embers : G.runEmbers ? G.runEmbers('extract') : 0, c4 = ex ? !!ex.camp4 : c.n >= 4;
    const exTxt = ex && Array.isArray(ex.text) ? t.apply(null, [ex.text[0]].concat(ex.text.slice(1).map(v => (typeof v === 'number' ? fmt(v) : v)))) : '';
    const extract = `<div class="cpTool ext"><b>${esc(t('ru_extractT'))}</b><small>${esc(c4 ? exTxt || t('camp_extract4', fmt(emb)) : t('ru_extractNote'))}</small><button class="btn ${extractArm > now() ? 'red' : ''}" data-extract>${esc(extractArm > now() ? t('ru_extractArm') : t('camp_extract', fmt(emb)))}</button></div>`;
    const party = ['btn'].concat(whos()).map(hpChip).join('');
    const html = `<div class="ruBox"><div class="cpHead"><div><h2 class="ruH">${esc(t('camp_title', c.n))}</h2><small>${esc(t('ru_campLand', L(land.name || '')))}</small></div><div class="cpVit">${party}</div></div>
      <h3 class="ruS">${esc(t('ru_campAct'))}</h3><div class="cpActs">${act('rest')}${act('temper')}${act('train')}</div>
      ${rec}
      <h3 class="ruS">${esc(t('ru_market'))}<button class="btn" data-reroll ${gold >= (G.campRerollCost ? G.campRerollCost() : 0) ? '' : 'disabled'}>${esc(t('camp_reroll', fmt(G.campRerollCost ? G.campRerollCost() : 0)))} ${img('ic_coin', 1)}</button></h3>
      <div class="cpMarket">${c.wares.map(ware).join('')}</div>
      <div class="cpTools">${ench}${reforge}${extract}</div>
      <div class="cpFoot"><div class="cpPurse"><span class="ruChip">${img('ic_coin', 1)}${fmt(gold)}</span><span class="ruChip">${img('ic_shard', 1)}${fmt(shards)}</span><span class="ruChip">${img('ic_heart', 1)}${r.mend | 0}/${r.mendMax | 0}</span>${r.keys ? `<span class="ruChip">${img('ic_key', 1)}${r.keys}</span>` : ''}</div>
        <div class="go"><button class="btn gold ruBig" data-go>${esc(t('camp_go'))} ▶</button><span class="ruTimer cpAuto"></span></div></div></div>`;
    const s = SCR.camp, box = s && s.el.querySelector('.ruBox'), sc = box ? box.scrollTop : 0;
    const n = open('camp', { cover: true, html, keys: campKeys, def: campGo });
    const b2 = n.el.querySelector('.ruBox'); if (b2) b2.scrollTop = sc;
    n.el.onclick = campClick;
    n.el.onpointerdown = () => { if (G.campTouch) G.campTouch(); };
    campTick();
  }
  // (a card on screen - Train's - is picked first: the doors don't open over it)
  function campGo() { if (run() && run().offer) { sfx('error'); return; } if (G.campDone && G.campDone()) sfx('whoosh'); }
  function campKeys(e, fresh) {
    if (!fresh) return false;
    const c = G.campNow && G.campNow(); if (!c) return false;
    if (e.code === 'KeyR' && !c.act) { G.campTouch(); G.campAct('rest') && sfx('revive'); return true; }
    if (e.code === 'KeyT' && !c.act) { G.campTouch(); G.campAct('temper') && sfx('orb', 'whet'); return true; }
    return false;
  }
  function campClick(e) {
    const b = e.target.closest('button,[data-lock]'); if (!b || b.disabled) return;
    if (G.Audio && G.Audio.unlock) G.Audio.unlock();
    if (b.dataset.lock != null) { e.stopPropagation(); G.campLock(+b.dataset.lock); renderCamp(); return; }
    if (b.dataset.act) { if (G.campAct(b.dataset.act)) sfx(b.dataset.act === 'rest' ? 'revive' : b.dataset.act === 'temper' ? 'orb' : 'perk', 'whet'); else sfx('error'); renderCamp(); return; }
    if (b.dataset.buy != null) { if (G.campBuy(+b.dataset.buy)) sfx('buy'); else sfx('error'); renderCamp(); return; }
    if (b.dataset.reroll != null) { if (G.campReroll()) sfx('orb', 'flux'); else sfx('error'); renderCamp(); return; }
    if (b.dataset.rec != null) { if (G.campRecruit(+b.dataset.rec)) { sfx('levelUp'); toast(esc(t('ru_recruitDone')), 'ach', 'h_knight'); } else sfx('error'); renderCamp(); return; }
    if (b.dataset.ench != null) {
      // (ui.js's Enchant All window when it has one: modes, whetstones, bag items; else the plain 'even' plan here)
      if (G.UI && typeof G.UI.enchantAsk === 'function') { G.UI.enchantAsk({ onDone: () => renderCamp() }); return; }
      const res = G.enchantAll({}); if (res && res.steps) { sfx('orb', 'whet'); toast(esc(t('ench_done', res.steps, Math.round(((res.perHero || []).reduce((a, x) => a + (x.pct || 0), 0) / Math.max(1, (res.perHero || []).length)) * 100))), 'ach', 'ic_gear'); } else sfx('error');
      renderCamp(); return;
    }
    if (b.dataset.ref != null) { if (G.campReforge(+b.dataset.ref)) sfx('orb', 'ascent'); else sfx('error'); renderCamp(); return; }
    if (b.dataset.extract != null) {
      if (extractArm > now()) { extractArm = 0; sfx('ascend'); G.runExtract(); return; }
      extractArm = now() + 3000; sfx('error'); renderCamp(); later('camp', () => { if (extractArm && extractArm <= now()) renderCamp(); }, 3100); return;
    }
    if (b.dataset.go != null) campGo();
  }
  function campTick() {
    const s = SCR.camp; if (!s || s.closing) return;
    const c = G.campNow && G.campNow(), el = s.el.querySelector('.cpAuto'); if (!c || !el) return;
    const left = c.touch || run().offer ? null : Math.max(0, beatAfter() - c.t);
    setT(el, left == null ? '' : t('ru_autoIn', Math.ceil(left)));
  }
  ['campOpen', 'campAct', 'campBuy', 'campReroll', 'campRecruit', 'campReforge', 'enchantAll'].forEach(k => G.on(k, () => { if (k === 'campOpen' || isOpen('camp')) setTimeout(renderCamp, 0); }));
  G.on('campDone', () => close('camp', 220));

  // ---------- DOORS (DESIGN §5.6): the next land, its lord, the map mod (the twist), the reward tag (the prize), a cursed
  // door (Heat 8), the Vault (a Key) ----------
  CSS_PARTS.push(`
#ru .ru-doors .ruBox{width:min(900px,100%)}
#ru .drRow{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}
#ru .drCard{position:relative;display:grid;gap:6px;align-content:start;padding:10px 10px 12px;cursor:pointer;text-align:left;color:var(--text);background:linear-gradient(180deg,#2a2438,#1a1724);border:3px solid var(--ink);
  box-shadow:inset 0 0 0 2px var(--line-hi),0 5px 0 var(--ink);font:13px/1.25 var(--font-body);animation:ckIn .4s cubic-bezier(.3,1.5,.5,1) both;animation-delay:var(--d,0s)}
#ru .drCard:hover,#ru .drCard:focus-visible{transform:translateY(-4px);box-shadow:inset 0 0 0 2px var(--gold),0 9px 0 var(--ink)}
#ru .drCard.cursed{box-shadow:inset 0 0 0 2px #b36bff,0 5px 0 var(--ink),0 0 18px #b36bff66;background:linear-gradient(180deg,#30183e,#1a1724)}
#ru .drCard.lead{box-shadow:inset 0 0 0 2px #9146ff,0 5px 0 var(--ink)}
#ru .drTop{display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px;align-items:center}
#ru .drTop .art{position:relative;width:64px;height:58px;display:grid;place-items:end center;background:radial-gradient(ellipse at 50% 80%,#3a3350,#1c1a28);border:2px solid var(--ink)}
#ru .drTop .art img{width:44px;height:44px}
#ru .drTop .art img.f{position:absolute;left:2px;bottom:2px;width:20px;height:18px}
#ru .drTop b{display:block;font:10px/1.4 var(--font-display);color:var(--gold);font-weight:normal}
#ru .drTop small{display:block;color:var(--faint);font:7px/1.4 var(--font-display)}
#ru .drLine{display:grid;grid-template-columns:62px minmax(0,1fr);gap:6px;align-items:baseline}
#ru .drLine>span{font:7px/1.5 var(--font-display);color:var(--faint)}
#ru .drLine b{font-weight:600}
#ru .drLine small{display:block;color:var(--dim)}
#ru .drLine.lord b{color:#ff9ab4}
#ru .drLine.mod b{color:#ff8a6a}#ru .drLine.mod.calm b{color:#8ae07a}
#ru .drLine.tag b{color:#ffd84a}
#ru .drTag{position:absolute;right:6px;top:-9px;padding:2px 5px;font:7px/1 var(--font-display);border:2px solid var(--ink);background:#ff4f7e;color:#fff}
#ru .drTag.cur{background:#b36bff}
#ru .drGo{justify-self:stretch;margin-top:2px}
#ru .drVault{display:flex;gap:8px;align-items:center;justify-content:center}
#ru .drCard kbd{position:absolute;left:6px;bottom:6px}
#ru .ru-doors.voting .drRow{padding-top:16px}
@media (max-width:600px){#ru .drRow{grid-template-columns:minmax(0,1fr)}}
`);
  let vaultMode = false;
  function renderDoors() {
    const r = run(), D_ = r && r.doors;
    if (!D_) { if (isOpen('doors')) close('doors', 200); return; }
    const slot = D_.slot, push = slot >= G.SIEGE.lands;
    // (a Push land: its pay and the Tide as it stands)
    const pushTxt = push ? [t('push_land', slot - G.SIEGE.lands + 1), G.runPushMul ? t('ru_pays', (+G.runPushMul(slot)).toFixed(2)) : '', G.runTide ? t('push_tide', (+G.runTide()).toFixed(2)) : ''].filter(Boolean).join(' · ') : '';
    const html = `<div class="ruBox"><h2 class="ruH">${esc(t('doors_title'))}</h2><p class="ruNote">${esc(push ? pushTxt : t('ru_land', slot + 1))}</p>
      ${D_.vault && (r.keys | 0) > 0 ? `<div class="drVault"><button class="btn ${vaultMode ? 'on' : ''}" data-vault>${img('ic_key', 1)} ${esc(t('door_vault'))} <kbd>V</kbd></button></div>` : ''}
      <div class="drRow">${D_.opts.map((o, i) => {
        const Rm = G.REALMS[o.land] || {}, M = (G.MAP_MODS || {})[o.mod] || null, T_ = o.tag ? (G.REWARD_TAGS || {})[o.tag] : null;
        // (runflow's door: its lord's and minions' sprites, its Land Champion; past the Void a Push land reads 'Corrupted <land>')
        const spr = sprOk(o.lordSpr || Rm.lord) ? (o.lordSpr || Rm.lord) : (o.minionSpr || Rm.minion);
        let nm = L(Rm.name || o.name || ''), lord = L(o.lord || Rm.lordName || '');
        if (push && G.corrupt && G.REALM_SIZE) { const d0 = slot * G.REALM_SIZE; nm = safe(() => G.corrupt(nm, d0), nm); lord = safe(() => G.corrupt(lord, d0), lord); }
        return `<button class="drCard ${o.cursed ? 'cursed' : ''}" data-door="${i}" style="--d:${(i * 0.08).toFixed(2)}s">
          ${o.final ? `<span class="drTag">${esc(t('door_final'))}</span>` : o.act ? `<span class="drTag">${esc(t('door_act'))}</span>` : ''}${o.cursed ? `<span class="drTag cur" style="right:auto;left:6px">${esc(t('door_cursed').split(':')[0])}</span>` : ''}
          <div class="drTop"><span class="art">${img(spr, 2)}${img(Rm.fodder, 2, 'f')}</span><div><b>${esc(nm)}</b><small>${esc((Rm.zones || []).slice(0, 2).map(L).join(' · '))}</small></div></div>
          <div class="drLine"><span>${esc(L(o.rule || Rm.rule || ''))}</span><div><small>${esc(L(o.ruleDesc || Rm.ruleDesc || ''))}</small></div></div>
          <div class="drLine lord"><span>${esc(t('door_lord', '').replace(/[:\s]+$/, ''))}</span><div><b>${esc(lord)}</b>${o.champ && !o.final ? `<small>${esc(t('ru_champLine', L(o.champ)))}</small>` : ''}</div></div>
          ${M ? `<div class="drLine mod ${o.mod === 'calm' ? 'calm' : ''}"><span>${esc(t('ru_risk'))}</span><div><b>${esc(L(M.name))}${o.cursed ? ' ×2' : ''}</b><small>${esc(L(M.desc))}</small></div></div>` : ''}
          ${T_ ? `<div class="drLine tag"><span>${esc(t('ru_reward'))}</span><div><b>${esc(L(T_.name))}${o.cursed ? ' ×2' : ''}</b><small>${esc(L(T_.desc))}</small></div></div>` : ''}
          <span class="btn gold drGo">${esc(t(vaultMode ? 'ru_doorVault' : 'ru_doorGo'))}</span><kbd>${i + 1}</kbd></button>`; }).join('')}</div>
      <span class="ruTimer drAuto"></span><span class="ruChat ckChat" hidden></span></div>`;
    const n = open('doors', { cover: true, html, keys: doorKeys, def: null });
    n.el.onclick = doorClick;
    n.el.onpointerdown = () => { if (G.doorsTouch) G.doorsTouch(); };
    if (votes.door) drawVotes('door');
    doorTick();
  }
  function doorPick(i) { const ok = G.runDoor(i, vaultMode); if (ok) { sfx('horn'); vaultMode = false; } else sfx('error'); }
  function doorClick(e) {
    const b = e.target.closest('button'); if (!b) return;
    if (G.Audio && G.Audio.unlock) G.Audio.unlock();
    if (b.dataset.vault != null) { vaultMode = !vaultMode; sfx('buy'); renderDoors(); return; }
    if (b.dataset.door != null) doorPick(+b.dataset.door);
  }
  function doorKeys(e, fresh) {
    const d = digit(e), r = run(), D_ = r && r.doors; if (!D_) return false;
    if (d >= 1 && d <= D_.opts.length) { if (fresh) doorPick(d - 1); return true; }
    if (e.code === 'KeyV' && D_.vault) { if (fresh) { vaultMode = !vaultMode; renderDoors(); } return true; }
    return false;
  }
  function doorTick() {
    const s = SCR.doors; if (!s || s.closing) return;
    const D_ = run() && run().doors, el = s.el.querySelector('.drAuto'); if (!D_ || !el) return;
    setT(el, D_.touch ? '' : t('ru_autoIn', Math.ceil(Math.max(0, beatAfter() - D_.t))));
  }
  G.on('doorsOpen', () => { vaultMode = false; setTimeout(renderDoors, 0); });
  G.on('door', () => close('doors', 220));

  // ---------- RELIC (DESIGN §5.7): 1 of 3 onto the belt after an act boss; the 8 true relics turn rainbow ----------
  CSS_PARTS.push(`
#ru .ru-relic .ruBox{width:min(860px,100%)}
#ru .rlRow{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;perspective:900px}
#ru .rlCard{position:relative;display:grid;justify-items:center;gap:5px;padding:12px 10px;cursor:pointer;text-align:center;color:var(--text);background:linear-gradient(180deg,#2e1e12,#1a1724);border:3px solid var(--ink);
  box-shadow:inset 0 0 0 2px #e8903a,0 5px 0 var(--ink);font:13px/1.25 var(--font-body);overflow:hidden;animation:rlIn .55s cubic-bezier(.3,1.4,.5,1) both;animation-delay:var(--d,0s)}
#ru .rlCard:hover{transform:translateY(-4px)}
#ru .rlCard.true{box-shadow:inset 0 0 0 2px #fff,0 5px 0 var(--ink),0 0 22px #ffffff55;background:linear-gradient(180deg,#2a2a3e,#16131f)}
#ru .rlCard.true::before{content:'';position:absolute;left:50%;top:50%;width:300%;height:300%;margin:-150% 0 0 -150%;background:conic-gradient(#ff4f7e33,#ffa03333,#ffd84a33,#56d45a33,#4fd0ff33,#b36bff33,#ff4f7e33);animation:ruSpin 4s linear infinite;pointer-events:none}
#ru .rlCard>*{position:relative;max-width:100%;min-width:0}
#ru .rlRow>*,#ru .drRow>*,#ru .suGrid>*,#ru .cpMarket>*,#ru .cpRecruits>*,#ru .cpActs>*{min-width:0;width:100%}
#ru .rlCard img{width:56px;height:56px}
#ru .rlCard b{font:9px/1.5 var(--font-display);color:#ffd28a;font-weight:normal}
#ru .rlCard em{font:7px/1.3 var(--font-display);font-style:normal;color:var(--faint)}
#ru .rlCard small{color:var(--dim)}
#ru .rlCard.pick{box-shadow:inset 0 0 0 3px var(--gold),0 5px 0 var(--ink)}
#ru .rlCard kbd{position:absolute;left:6px;bottom:6px}
#ru .rlBelt{display:flex;gap:6px;justify-content:center;align-items:center;flex-wrap:wrap}
#ru .rlBelt>span{font:7px/1 var(--font-display);color:var(--dim)}
#ru .rlSlot{width:46px;height:46px;display:grid;place-items:center;background:var(--slot);border:2px solid var(--ink);box-shadow:inset 0 0 0 1px var(--line)}
#ru .rlSlot img{width:34px;height:34px}
#ru .rlSlot.rep{cursor:pointer;box-shadow:inset 0 0 0 2px #ff6a5a;animation:ruPulse .8s steps(2) infinite}
@keyframes rlIn{from{transform:rotateY(90deg) scale(.7);opacity:0}}
`);
  let relicSel = -1;
  function renderRelic() {
    const r = run(), o = r && r.relicOffer;
    if (!o) { if (isOpen('relic')) close('relic', 200); return; }
    const full = (r.belt || []).length >= (r.beltMax | 0);
    let belt = '';
    for (let i = 0; i < Math.max(r.beltMax | 0, (r.belt || []).length); i++) { const id = r.belt[i]; belt += `<span class="rlSlot ${full && relicSel >= 0 && id ? 'rep' : ''}" ${id ? `data-rep="${i}" title="${esc(relicName(id) + ': ' + relicFx(id))}"` : ''}>${id ? img('u_' + id, 3) : ''}</span>`; }
    const html = `<div class="ruBox"><h2 class="ruH">${esc(t('relic_title'))}</h2>
      <div class="rlRow">${o.ids.map((id, i) => { const tr = isRelicQ(id), th = G.UQ_THEME && G.UQ_THEME[id], P = th && G.PERKS[th];
        return `<button class="rlCard ${tr ? 'true' : ''} ${relicSel === i ? 'pick' : ''}" data-relic="${i}" style="--d:${(i * 0.12).toFixed(2)}s">${img('u_' + id, 4)}<em class="${tr ? 'ruRbw' : ''}">${esc(t(tr ? 'ru_relicTrue' : 'ru_relicUq'))}</em><b class="${tr ? 'ruRbw' : ''}">${esc(relicName(id))}</b><small>${esc(relicFx(id))}</small>${P ? `<em>${esc(schoolName(G.PERK_SCHOOL[th]))} · ${esc(L(P.name))}</em>` : ''}<kbd>${i + 1}</kbd></button>`; }).join('')}</div>
      <div class="rlBelt"><span>${esc(t('relic_belt', (r.belt || []).length, r.beltMax | 0))}</span>${belt}</div>
      ${full ? `<p class="ruNote">${esc(t('ru_relicFull'))}</p>` : ''}
      <div class="ruRow"><button class="btn" data-skip>${esc(t('relic_skip'))}</button><span class="ruTimer rlAuto"></span><span class="ruChat ckChat" hidden></span></div></div>`;
    const n = open('relic', { cover: true, html, keys: relicKeys, def: null });
    n.el.onclick = relicClick;
    n.el.onpointerdown = () => { if (G.relicTouch) G.relicTouch(); };
    if (votes.relic) drawVotes('relic');
    relicTick();
  }
  function relicChoose(i) {
    const r = run(), o = r && r.relicOffer; if (!o) return;
    const full = (r.belt || []).length >= (r.beltMax | 0);
    if (full) { relicSel = i; renderRelic(); return; }
    const id = o.ids[i];
    if (G.relicPick(i)) { relicSel = -1; if (isRelicQ(id)) ultraSting('relic'); else sfx('evolve'); } else sfx('error');
  }
  function relicClick(e) {
    const b = e.target.closest('button,[data-rep]'); if (!b) return;
    if (G.Audio && G.Audio.unlock) G.Audio.unlock();
    if (b.dataset.rep != null && relicSel >= 0) { const id = run().relicOffer.ids[relicSel]; if (G.relicPick(relicSel, +b.dataset.rep)) { relicSel = -1; if (isRelicQ(id)) ultraSting('relic'); else sfx('evolve'); } return; }
    if (b.dataset.relic != null) relicChoose(+b.dataset.relic);
    if (b.dataset.skip != null) { relicSel = -1; G.relicSkip(); }
  }
  function relicKeys(e, fresh) {
    const d = digit(e), o = run() && run().relicOffer; if (!o) return false;
    if (d >= 1 && d <= o.ids.length) { if (fresh) relicChoose(d - 1); return true; }
    if (e.code === 'Escape' && relicSel >= 0) { relicSel = -1; renderRelic(); return true; }
    return false;
  }
  function relicTick() {
    const s = SCR.relic; if (!s || s.closing) return;
    const o = run() && run().relicOffer, el = s.el.querySelector('.rlAuto'); if (!o || !el) return;
    setT(el, o.touch ? '' : t('ru_autoIn', Math.ceil(Math.max(0, beatAfter() - o.t))));
  }
  G.on('relicOffer', o => {
    relicSel = -1; setTimeout(renderRelic, 0);
    // a true relic in the offer: its sting as the cards turn
    if (o && o.ids && o.ids.some(isRelicQ)) setTimeout(() => ultraSting('relic'), 450);
  });
  G.on('relicPick', () => close('relic', 220));
  G.on('relicSkip', () => close('relic', 220));

  // ---------- SHRINES (DESIGN §5.8): a Power shrine's boon (1 of 3), a Pact (accept / decline), a Chance shrine's roll ----------
  CSS_PARTS.push(`
#ru .ru-boon,#ru .ru-pact{pointer-events:none}
#ru .bnWrap{position:absolute;left:50%;bottom:var(--hudB,110px);transform:translateX(-50%);width:min(94%,620px);display:grid;gap:8px;justify-items:center;pointer-events:auto;padding:10px;background:rgba(12,11,18,.92);border:3px solid var(--ink);box-shadow:inset 0 0 0 2px var(--sc,#ffd84a),0 5px 0 var(--ink);animation:ruPop .35s cubic-bezier(.3,1.5,.5,1) both}
#ru .ru-boon:not(.wide) .bnWrap,#ru .ru-pact:not(.wide) .bnWrap{position:fixed;left:0;right:0;bottom:0;transform:none;width:auto;border-width:3px 0 0}
#ru .bnWrap h3{margin:0;font:12px/1.3 var(--font-display);color:var(--sc,#ffd84a);text-shadow:2px 2px 0 var(--ink);text-align:center}
#ru .bnRow{display:flex;gap:8px;width:100%;justify-content:center;flex-wrap:wrap}
#ru .bnCard{position:relative;flex:1 1 140px;max-width:200px;display:grid;justify-items:center;gap:4px;padding:10px 6px;cursor:pointer;color:var(--text);background:var(--panel2);border:3px solid var(--ink);box-shadow:inset 0 0 0 2px #ffd84a88,0 4px 0 var(--ink);font:13px/1.2 var(--font-body);animation:ckIn .35s cubic-bezier(.3,1.6,.5,1) both;animation-delay:var(--d,0s)}
#ru .bnCard:hover{transform:translateY(-3px);box-shadow:inset 0 0 0 2px #ffd84a,0 7px 0 var(--ink)}
#ru .bnCard b{font:8px/1.5 var(--font-display);color:#ffe27a;font-weight:normal}
#ru .bnCard img{width:32px;height:32px}
#ru .bnCard kbd{position:absolute;right:4px;bottom:4px}
#ru .pcText{margin:0;text-align:center;color:var(--text);font-size:15px;max-width:46ch}
#ru .pcText b{display:block;font:10px/1.5 var(--font-display);color:#d8b8ff;font-weight:normal}
`);
  function renderBoon() {
    const r = run(), o = r && r.boonOffer;
    if (!o) { if (isOpen('boon')) close('boon', 200); return; }
    const html = `<div class="bnWrap" style="--sc:${(G.SHRINE_KINDS && G.SHRINE_KINDS.power && G.SHRINE_KINDS.power.col) || '#ffd84a'}"><h3>${esc(t('boon_title'))}</h3>
      <div class="bnRow">${o.ids.map((id, i) => { const B = (G.BOONS || {})[id] || {}; return `<button class="bnCard" data-boon="${i}" style="--d:${(i * 0.07).toFixed(2)}s">${img(id === 'reroll' ? 'ic_clover' : id === 'gold' ? 'ic_coin' : id === 'hp' ? 'ic_heart' : id === 'xp' ? 'ic_star' : id === 'crit' ? 'ic_eye' : id === 'spd' ? 'ic_clock' : 'ic_sword', 3)}<b>${esc(L(B.name || id))}</b>${r.boons && r.boons[id] ? `<small>×${r.boons[id]}</small>` : ''}<kbd>${i + 1}</kbd></button>`; }).join('')}</div>
      <span class="ruTimer bnAuto"></span><span class="ruChat ckChat" hidden></span></div>`;
    const n = open('boon', { stage: true, html, keys: (e, fresh) => { const d = digit(e); if (d >= 1 && d <= o.ids.length) { if (fresh && G.boonPick(d - 1)) sfx('shrine', true); return true; } return false; }, def: null });
    n.el.onclick = e => { const b = e.target.closest('[data-boon]'); if (b && G.boonPick(+b.dataset.boon)) sfx('shrine', true); };
    n.el.onpointerdown = () => { if (G.shrineTouch) G.shrineTouch(); };
    if (votes.boon) drawVotes('boon');
    shrineTick();
  }
  function renderPact() {
    const r = run(), o = r && r.pactOffer;
    if (!o) { if (isOpen('pact')) close('pact', 200); return; }
    const P = (G.PACTS || {})[o.id] || {};
    const html = `<div class="bnWrap" style="--sc:${(G.SHRINE_KINDS && G.SHRINE_KINDS.pact && G.SHRINE_KINDS.pact.col) || '#b36bff'}"><h3>${esc(t('pact_title'))}</h3>
      <p class="pcText"><b>${esc(L(P.name || o.id))}</b>${esc(L(P.desc || ''))}</p>
      <div class="ruRow"><button class="btn gold" data-pact="1">${esc(t('pact_yes'))} <kbd>Y</kbd></button><button class="btn" data-pact="0">${esc(t('pact_no'))} <kbd>N</kbd></button></div>
      <span class="ruTimer bnAuto"></span></div>`;
    const n = open('pact', { stage: true, html, keys: (e, fresh) => { if (e.code === 'KeyY') { if (fresh) pactSay(true); return true; } if (e.code === 'KeyN' || e.code === 'Escape') { if (fresh) pactSay(false); return true; } return false; }, def: null });
    n.el.onclick = e => { const b = e.target.closest('[data-pact]'); if (b) pactSay(b.dataset.pact === '1'); };
    n.el.onpointerdown = () => { if (G.shrineTouch) G.shrineTouch(); };
    shrineTick();
  }
  function pactSay(yes) { if (G.pactAnswer(yes)) sfx(yes ? 'phase' : 'buy'); }
  function shrineTick() {
    for (const k of ['boon', 'pact']) {
      const s = SCR[k]; if (!s || s.closing) continue;
      const r = run(), o = r && (k === 'boon' ? r.boonOffer : r.pactOffer), el = s.el.querySelector('.bnAuto'); if (!o || !el) continue;
      setT(el, o.touch ? '' : t(k === 'boon' ? 'ru_shrineAuto' : 'ru_pactAuto', Math.ceil(Math.max(0, beatAfter(TUNE.shrineAuto || 10) - o.t))));
    }
  }
  G.on('boonOffer', () => setTimeout(renderBoon, 0));
  G.on('boon', () => { if (isOpen('boon') && !(run() && run().boonOffer)) close('boon', 200); });
  G.on('pactOffer', () => setTimeout(renderPact, 0));
  G.on('pact', (id, yes) => { close('pact', 200); if (yes) { const P = (G.PACTS || {})[id]; toast(`<b>${esc(L(P ? P.name : id))}</b>`, 'ach', 'ic_skull', { p: 2 }); } });
  G.on('shrineChance', (out, cost, boon) => {
    const B = boon && G.BOONS && G.BOONS[boon];
    const msg = out === 'boon' ? t('chance_boon', B ? L(B.name) : boon) : out === 'loot' ? t('chance_loot') : t('chance_none');
    toast(`<b>${esc(msg)}</b>${cost ? ' · ' + esc(t('ru_chanceCost', fmt(cost))) : ''}`, out === 'none' ? '' : 'ach', out === 'none' ? 'ic_skull' : 'ic_clover', { p: 2 });
    sfx(out === 'none' ? 'bossFail' : 'shrine', true);
  });
  G.on('pactDone', p => { if (p) toast(`<b>${esc(L(((G.PACTS || {})[p.id] || {}).name || p.id))}</b> ✓`, 'ach', 'ic_trophy'); });

  // ---------- AFTER A WIN (DESIGN §2.4): PUSH ON or RETURN (with the Rift Gate II) ----------
  CSS_PARTS.push(`
#ru .ru-won .ruBox{width:min(560px,100%);text-align:center;justify-items:center;background:linear-gradient(180deg,#3a2e10,var(--panel) 55%)}
#ru .ru-won h2{color:#fff3a0;animation:ruSlam .7s cubic-bezier(.2,1.6,.4,1) both}
#ru .wnOpts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;width:100%}
#ru .wnOpt{display:grid;gap:6px;padding:10px;background:var(--panel2);border:2px solid var(--ink);box-shadow:inset 0 0 0 2px var(--line)}
#ru .wnOpt small{color:var(--dim)}
@media (max-width:600px){#ru .wnOpts{grid-template-columns:minmax(0,1fr)}}
`);
  function renderWon() {
    const r = run(), a = r && r.pushAsk;
    if (!a) { if (isOpen('won')) close('won', 200); return; }
    const html = `<div class="ruBox"><h2 class="ruH">${esc(t('won_title'))}</h2><p class="ruNote">${esc(t('ru_wonBank', fmt(a.fame), fmt(a.embers)))}</p>
      <div class="wnOpts"><div class="wnOpt"><button class="btn gold ruBig" data-ret>${esc(t('push_return'))}</button><small>${esc(t('ru_returnHint'))}</small></div>
        <div class="wnOpt"><button class="btn red ruBig" data-push>${esc(t('push_on'))}</button><small>${esc(t('ru_pushHint'))}</small></div></div></div>`;
    const n = open('won', { cover: true, html, def: () => G.runReturn(), keys: null });
    n.el.onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.ret != null) G.runReturn(); else if (b.dataset.push != null) { if (G.runPush()) { close('won', 220); sfx('horn'); } } };
  }
  G.on('runWon', () => { sfx('ascend'); setTimeout(renderWon, 400); });

  // ---------- THE FALL: after the BOOM, Continue first (1 a run: free the first time, then Gems; an ad where ads are on),
  // or the end of the run (then the summary). No Continue possible: straight to the summary ----------
  CSS_PARTS.push(`
#ru .ru-fall .ruBox{width:min(480px,100%);text-align:center;justify-items:center}
#ru .ru-fall h2{color:#ff5a4f;animation:ruSlam .6s cubic-bezier(.2,1.8,.4,1) both}
#ru .flCause{margin:0;color:#ffb0a0;font-size:15px}
#ru .flActs{display:grid;gap:8px;width:100%;justify-items:center}
#ru .flActs .btn{min-width:240px}
#ru .flActs .cost{display:inline-flex;align-items:center;gap:3px;margin-left:6px;color:#ffc8f0}
#ru .flActs .cost img{width:14px;height:14px}
#ru .flGems{display:flex;align-items:center;gap:6px;justify-content:center;color:var(--dim);font-size:14px}
#ru .flGems img{width:15px;height:15px}
`);
  let fallT = 0;
  function renderFall() {
    const S = G.S, f = S.fallen;
    if (!f) { if (isOpen('fall')) close('fall', 200); return; }
    const can = G.canContinue ? G.canContinue() : false;
    // nothing to ask: the run ends here (the summary follows)
    if (!can) { close('fall'); safe(() => G.runGiveUp()); return; }
    const cost = G.contCost ? G.contCost() : 0, gems = S.gems || 0, afford = gems >= cost;
    const ad = !!(G.Ads && G.Ads.ready && safe(() => G.Ads.ready('continue'), false));
    const shop = !!(G.Store && G.Store.ready && safe(() => G.Store.ready(), false));
    const r = run(), cause = r && r.cause ? t('nm_cause_' + r.cause) : '';
    const fame = G.runFame ? G.runFame() : 0, emb = G.runEmbers ? G.runEmbers('fall') : 0;
    const html = `<div class="ruBox"><h2 class="ruH">${esc(t('ru_fallTitle'))}</h2>${cause && cause !== 'nm_cause_' + r.cause ? `<p class="flCause">${esc(cause)}</p>` : ''}
      <div class="flActs"><button class="btn gold ruBig" data-cont ${afford ? '' : 'disabled'}>${esc(t('ru_cont'))}<span class="cost">${cost ? img('ic_gem', 1) + fmt(cost) : esc(t('ru_contFree'))}</span></button>
        ${ad ? `<button class="btn" data-ad>${esc(t('ru_contAd'))}</button>` : ''}<small class="ruNote">${esc(t('ru_contNote'))}</small>
        <button class="btn red" data-end>${esc(t('ru_end'))}</button><small class="ruNote">${esc(t('ru_endNote', fmt(fame), fmt(emb)))}</small></div>
      <p class="flGems">${esc(t('ru_gems', ''))}${img('ic_gem', 1)}<b>${fmt(gems)}</b>${shop && !afford ? ` <button class="btn" data-shop>${esc(t('ru_getGems'))}</button>` : ''}</p></div>`;
    const n = open('fall', { cover: true, html, def: () => { if (afford) fallCont(); else fallEnd(); }, keys: null });
    n.el.onclick = e => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      if (G.Audio && G.Audio.unlock) G.Audio.unlock();
      if (b.dataset.cont != null) fallCont();
      else if (b.dataset.end != null) fallEnd();
      else if (b.dataset.shop != null) { if (G.Store && G.Store.open) G.Store.open('gems', () => renderFall()); }
      else if (b.dataset.ad != null) { b.disabled = true; Promise.resolve(safe(() => G.Ads.show('continue'), false)).then(ok => { if (ok && G.runContinue('ad')) close('fall', 200); else { b.disabled = false; renderFall(); } }); }
    };
  }
  function fallCont() { if (G.runContinue && G.runContinue('gems')) { sfx('revive'); close('fall', 200); } else sfx('error'); }
  function fallEnd() { close('fall', 150); safe(() => G.runGiveUp()); }
  // (after the Button's BOOM has played: 1.7 s, as the 3.6 card waited)
  RU.fall = function () { if (!G.S.fallen) return false; if (isOpen('fall')) return true; renderFall(); return true; };
  G.on('runOver', () => { clearTimeout(fallT); fallT = setTimeout(() => { if (G.S.fallen) RU.fall(); }, 1700); });
  G.on('runContinue', () => { clearTimeout(fallT); close('fall', 200); hudUpdate(true); });

  // ---------- THE RUN SUMMARY / THE FURNACE (DESIGN §4.3, §7.1): the cause and the near miss; every item flies into the
  // forge with its Embers (a unique stops and stamps the Codex: NEW / RANK 2); the multipliers applied where you can see
  // them; Fame by line; Unlocked; the next goals with their bars; the Daily's rank; AGAIN (the default) and TOWN ----------
  CSS_PARTS.push(`
#ru .ru-summary .ruBox{width:min(920px,100%)}
#ru .ru-summary .pend{visibility:hidden}
#ru .ru-summary .shown{visibility:visible;animation:ruFade .3s ease-out}
#ru .smTitle{font-size:20px!important;animation:ruSlam .7s cubic-bezier(.2,1.6,.4,1) both}
#ru .sk-fall .smTitle,#ru .sk-abandon .smTitle{color:#ff5a4f!important}
#ru .sk-win .ruBox,#ru .ru-summary.sk-win .ruBox{background:linear-gradient(180deg,#3a2e10,var(--panel) 40%)}
#ru .sk-win .smTitle{color:#fff3a0!important}
#ru .sk-pushfall .smTitle{color:#fff3a0!important}#ru .smBank{display:flex;gap:6px;align-items:center;justify-content:center;flex-wrap:wrap}#ru .smBank small{color:var(--dim);font-size:12px}
#ru .sk-extract .smTitle{color:#8ae07a!important}
#ru .smNear{display:grid;gap:3px;text-align:center}
#ru .smNear p{margin:0;font-size:15px;color:var(--text)}
#ru .smNear p+p{color:#ffb0a0;font-size:14px}
#ru .smStats{display:flex;gap:5px;flex-wrap:wrap;justify-content:center}
#ru .smCols{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,2fr);gap:10px}
#ru .smPan{display:grid;gap:6px;align-content:start;padding:10px;background:var(--panel2);border:2px solid var(--ink);box-shadow:inset 0 0 0 2px var(--line)}
#ru .smPan h3{margin:0;font:9px/1.4 var(--font-display);color:#ffb15a;text-align:center;letter-spacing:.08em}
#ru .smPan.fame h3{color:var(--fame)}
#ru .fnStage{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 96px;gap:8px;align-items:center;min-height:96px}
#ru .fnHopper{display:flex;flex-wrap:wrap;gap:3px;align-content:center;min-height:40px}
#ru .fnHopper i{position:relative;width:30px;height:30px;display:grid;place-items:center;background:var(--slot);border:2px solid var(--ink);box-shadow:inset 0 0 0 1px var(--rc,var(--line))}
#ru .fnHopper i img{width:24px;height:24px}
#ru .fnHopper i.gone{visibility:hidden}
#ru .fnHopper i.more{width:auto;padding:0 5px;font:7px/1 var(--font-display);color:var(--dim)}
#ru .fnForge{position:relative;height:96px;display:grid;place-items:center;background:linear-gradient(#2a1a12,#120c0a);border:3px solid var(--ink);box-shadow:inset 0 0 0 2px #6a3a1a,inset 0 -20px 30px #ff5a1a55;overflow:hidden}
#ru .fnForge .fl{position:absolute;left:10%;right:10%;bottom:-6px;height:70%;background:radial-gradient(ellipse at 50% 100%,#fff3a0,#ffb13a 30%,#ff4a1a 55%,transparent 72%);animation:fnFl .35s steps(3) infinite alternate;filter:blur(1px)}
#ru .fnForge.hot .fl{animation-duration:.18s;height:95%}
#ru .fnForge b{position:relative;font:15px/1 var(--font-display);color:#fff3d0;text-shadow:2px 2px 0 var(--ink),0 0 8px #ff8a2a}
@keyframes fnFl{from{transform:scaleY(.85) scaleX(1.05)}to{transform:scaleY(1.1) scaleX(.95)}}
#ru .fnStamp{position:absolute;left:50%;top:40%;z-index:3;transform:translate(-50%,-50%) rotate(-12deg);padding:4px 8px;font:11px/1 var(--font-display);color:#fff;background:#c8102e;border:3px solid #fff;box-shadow:0 0 0 2px var(--ink),0 0 20px #ff4f7e;animation:fnStamp .5s cubic-bezier(.2,1.8,.4,1) both;pointer-events:none;white-space:nowrap}
#ru .fnStamp.rank{background:#7a4a10}
@keyframes fnStamp{from{transform:translate(-50%,-50%) rotate(-12deg) scale(3);opacity:0}}
#ru .fnLines{display:grid;gap:2px;font-size:13px}
#ru .fnLines div{display:flex;justify-content:space-between;gap:8px;color:var(--dim)}
#ru .fnLines div b{color:var(--text);font-weight:600;font-variant-numeric:tabular-nums}
#ru .fnMuls{display:flex;gap:5px;flex-wrap:wrap;justify-content:center}
#ru .fnMul{padding:3px 6px;font:8px/1.2 var(--font-display);color:#fff;background:#3a2448;border:2px solid var(--ink);box-shadow:inset 0 0 0 1px var(--line-hi)}
#ru .fnMul.shown{animation:ruSlam .45s cubic-bezier(.2,1.6,.4,1) both}
#ru .fnMul.bad{background:#5a1a22}#ru .fnMul.good{background:#244a22}
#ru .fnTotal{text-align:center;font:9px/1.3 var(--font-display);color:#ffb15a}
#ru .fnTotal b{display:block;font:22px/1.2 var(--font-display);color:#fff3d0;text-shadow:3px 3px 0 var(--ink),0 0 12px #ff8a2a}
#ru .fame .fnTotal{color:var(--fame)}#ru .fame .fnTotal b{text-shadow:3px 3px 0 var(--ink),0 0 12px #ffa033}
#ru .smCodex{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}
#ru .smCodex .cx{position:relative;display:grid;justify-items:center;gap:2px;width:96px;padding:6px 4px;background:var(--panel2);border:2px solid var(--ink);box-shadow:inset 0 0 0 2px #e8903a;font-size:12px;text-align:center}
#ru .smCodex .cx img{width:30px;height:30px}
#ru .smCodex .cx em{font:7px/1 var(--font-display);font-style:normal;padding:2px 3px;background:#c8102e;color:#fff}
#ru .smCodex .cx em.rank{background:#7a4a10}
#ru .smUnl{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;align-items:center}
#ru .smUnl .ruChip{font-size:8px;background:#244a22;box-shadow:inset 0 0 0 1px var(--good)}
#ru .smNext{display:grid;gap:5px}
#ru .nxRow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 8px;align-items:center;font-size:13px}
#ru .nxRow span{color:var(--text)}
#ru .nxRow small{color:var(--dim);font-variant-numeric:tabular-nums}
#ru .nxRow i{grid-column:1/-1;display:block;height:6px;background:var(--ink);border:1px solid var(--line)}
#ru .nxRow i u{display:block;height:100%;background:var(--gold);width:0;transition:width .8s ease-out}
#ru .nxRow.done i u{background:var(--good)}
#ru .smDaily{display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap;padding:6px 8px;background:linear-gradient(90deg,#3a2414,#262331);border:2px solid var(--ink);box-shadow:inset 0 0 0 2px var(--fame);font-size:14px}
#ru .smActs{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;position:sticky;bottom:-16px;padding:10px 0 4px;background:linear-gradient(transparent,var(--panel) 30%)}
#ru .smSkip{text-align:center;font:7px/1 var(--font-display);color:var(--faint)}
#ru .smCode{text-align:center;font:8px/1 var(--font-display);color:#c8b4ff}
#ru .smAuto{margin:0;display:flex;gap:8px;align-items:center;justify-content:center;font:9px/1.4 var(--font-display);color:var(--gold)}
@media (max-width:700px){#ru .smCols{grid-template-columns:minmax(0,1fr)}#ru .smTitle{font-size:15px!important}#ru .fnStage{grid-template-columns:minmax(0,1fr) 80px}#ru .fnForge{height:80px}}
`);
  const SM = { sum: null, anim: false, steps: [], dailyRank: null };
  const FAME_K = { zones: 'fame_zones', lords: 'fame_lords', acts: 'fame_acts', win: 'fame_win', par: 'fame_par', push: 'fame_push', daily: 'fame_daily', sticker: 'fame_sticker' };
  const END_K = { fall: 'run_mulFall', extract: 'run_mulExtract', win: 'run_mulWin', abandon: 'run_mulAbandon' };
  function unlText(u) {
    if (!u) return '';
    if (typeof u === 'string') return u;
    if (u.kind === 'heat') return t('ru_unl_heat', u.n);
    if (u.kind === 'swift') return t('ru_unl_swift', btnName(u.btn), u.heat | 0);
    return L(u.name || u.label || u.text || '') || [u.kind, u.id].filter(Boolean).join(' ');
  }
  const bldName = id => { for (const k of ['town_' + id, 'twShort_' + id]) { const v = t(k); if (v !== k) return v; } const B = (G.BLD || []).find(b => b.id === id); return (B && B.name && L(B.name)) || id; };
  function nextRow(x) {
    let name = L(x.name || x.label || '');
    if (x.kind === 'hall') name = (L(x.name || '') || x.id) + ' ' + (['', 'I', 'II', 'III', 'IV', 'V'][x.rank] || x.rank || '');
    else if (x.kind === 'town') { name = bldName(x.id) + ' ' + (['', 'I', 'II', 'III', 'IV', 'V'][x.lvl] || x.lvl || ''); const u = t('bld_' + x.id + '_' + x.lvl); if (u !== 'bld_' + x.id + '_' + x.lvl) name += ': ' + u; }
    const have = +x.have || 0, need = +x.need || 0, k = need > 0 ? clamp(have / need, 0, 1) : 1;
    const ico = x.kind === 'hall' ? 'ic_fame' : x.kind === 'town' ? 'ic_ember' : x.kind === 'deed' ? 'ic_trophy' : 'ic_star';
    return `<div class="nxRow ${k >= 1 ? 'done' : ''}"><span>${img(ico, 1)} ${esc(name)}</span><small>${need ? fmt(Math.min(have, need)) + '/' + fmt(need) : ''}${k >= 1 ? ' ✓' : ''}</small><i><u data-w="${Math.round(k * 100)}"></u></i></div>`;
  }
  RU.summary = function (sum) {
    sum = sum || G.S.lastRun;
    if (!sum) return false;
    renderSummary(sum, false);
    return true;
  };
  function renderSummary(sum, animate) {
    SM.sum = sum; SM.dailyRank = null; SM.autoStopped = false; if (SM.autoT) { clearInterval(SM.autoT); SM.autoT = 0; }
    const S = G.S, E = sum.embers || {}, F = sum.fame || {}, nm = sum.nearMiss || {};
    const kind = sum.kind || 'fall';
    const items = (E.items || []).slice(), shown = items.slice(0, 14), more = items.length - shown.length;
    const moreV = items.slice(14).reduce((a, x) => a + (x.v || 0), 0);
    const C = G.CLASS_BY_ID[sum.cls] || {};
    // (runflow: a replay's mark, the run under par, the Golden Clicks caught and the shrines met)
    const stats = [t('ru_siegeN', sum.n), btnName(sum.btn), L(C.name || ''), sum.heat ? 'H' + sum.heat : '', t('ru_stats', sum.cleared | 0, mmss(sum.secs), sum.lvl | 0, sum.cardsN | 0),
      sum.replay ? t('ru_replay') : '', sum.swift ? t('ru_swift') : '', sum.golden ? t('ru_golden', sum.golden) : '', sum.shrines ? t('ru_shrinesN', sum.shrines) : ''].filter(Boolean);
    const evos = (sum.evos || []).map(e => (G.EVOS[e] ? L(G.EVOS[e].name) : e));
    const lines = [];
    if (E.shards && E.shards.v) lines.push([t('emb_shards') + ' (' + fmt(E.shards.n) + ')', E.shards.v]);
    if (E.orbsV) lines.push([t('emb_orbs'), E.orbsV]);
    if (E.keys && E.keys.v) lines.push([t('emb_keys') + ' (' + E.keys.n + ')', E.keys.v]);
    if (E.pouch) lines.push([t('emb_pouch'), E.pouch]);
    const mul = E.mul || {}, fm = F.mul || {};
    const muls = [`<span class="fnMul pend ${mul.end < 1 ? 'bad' : mul.end > 1 ? 'good' : ''}">${esc(t(END_K[kind] || 'run_mulFall'))}</span>`];
    if (mul.heat > 1) muls.push(`<span class="fnMul pend good">${esc(t('ru_heatX', sum.heat))} ×${(+mul.heat).toFixed(2)}</span>`);
    if (mul.extra && Math.abs(mul.extra - 1) > 1e-3) muls.push(`<span class="fnMul pend good">${esc(t('ru_extraX'))} ×${(+mul.extra).toFixed(2)}</span>`);
    const fmuls = [];
    if (fm.heat > 1) fmuls.push(`<span class="fnMul pend good">${esc(t('fame_heat', sum.heat, (+fm.heat).toFixed(1)))}</span>`);
    if (fm.extra && Math.abs(fm.extra - 1) > 1e-3) fmuls.push(`<span class="fnMul pend good">${esc(t('ru_extraX'))} ×${(+fm.extra).toFixed(2)}</span>`);
    const codex = (sum.codex || []).map(c => { const rk = S.codex && S.codex[c.q] ? S.codex[c.q].rank | 0 : 1; return `<div class="cx pend">${img('u_' + c.q, 3)}<span class="${c.relic ? 'ruRbw' : ''}">${esc(relicName(c.q))}</span><em class="${c.isNew ? '' : 'rank'}">${esc(c.isNew ? t('ru_codexNew') : t('ru_codexRank', rk))}</em></div>`; }).join('');
    const unl = (sum.unlocked || []).map(u => `<span class="ruChip">${esc(unlText(u))}</span>`).join('');
    const next = (sum.next || []).map(nextRow).join('');
    const daily = sum.daily ? `<div class="smDaily pend">${img('ic_trophy', 2)}<span class="dyTxt">${esc(t('ru_dailyDone', sum.daily.zones, mmss(sum.daily.secs)))} · ${esc(sum.daily.ranked && !sum.daily.assisted ? t('ru_dailyPosting') : t('ru_dailyUnranked'))}</span><span class="dyBtn"></span></div>` : '';
    // (uifix: a fall inside the Push is still a WON Siege: the title says so, the banked pile is the headline and the
    // near-miss line counts the Push lands, not 'zones from the Mad Button')
    const pushFall = !!(kind === 'fall' && sum.push && sum.push.bank);
    const nearLines = pushFall ? [t('ru_pushFellLine', sum.push.lands | 0)] : (nm.lines || []).map(l => line(l));
    const html = `<div class="ruBox">
      <h2 class="ruH smTitle">${esc(pushFall ? t('ru_sum_pushfall') : t('ru_sum_' + kind))}</h2>
      ${pushFall ? `<div class="smBank pend"><span class="ruChip">${img('ic_fame', 1)} ${esc(t('ru_banked'))} +${fmt(sum.push.bank.fame)}</span><span class="ruChip">${img('ic_ember', 1)} ${esc(t('ru_banked'))} +${fmt(sum.push.bank.embers)}</span><small>${esc(t('ru_pushPouch'))}</small></div>` : ''}
      <div class="smNear pend">${nearLines.map(l => `<p>${esc(l)}</p>`).join('')}</div>
      <div class="smStats pend">${stats.map(s => `<span class="ruChip">${esc(s)}</span>`).join('')}${evos.map(e => `<span class="ruChip" style="color:#ffd84a">${esc(t('ru_evo'))}: ${esc(e)}</span>`).join('')}</div>
      <div class="smCols">
        <div class="smPan"><h3>${esc(t('ru_furnace'))}</h3>
          <div class="fnStage"><div class="fnHopper">${shown.map((x, i) => `<i data-fi="${i}" style="--rc:${x.q ? (isRelicQ(x.q) ? '#fff' : G.UNIQUE_COL) : RAR(x.r).color}">${img(x.q ? 'u_' + x.q : 'it_' + x.id, 2)}</i>`).join('')}${more > 0 ? `<i class="more" data-fi="more">${esc(t('ru_more', more))}</i>` : ''}</div>
            <div class="fnForge"><i class="fl"></i><b class="fnCount">0</b></div></div>
          <div class="fnLines">${items.length ? `<div class="pend" data-fl="items"><span>${esc(t('emb_items', items.length))}</span><b>${fmt(Math.round(E.itemsV || 0))}</b></div>` : ''}${lines.map((l, i) => `<div class="pend" data-fl="${i}"><span>${esc(l[0])}</span><b>${fmt(Math.round(l[1]))}</b></div>`).join('')}
            <div class="pend" data-fl="base"><span>${esc(t('ru_base'))}</span><b>${fmt(E.base || 0)}</b></div></div>
          <div class="fnMuls">${muls.join('')}</div>
          <div class="fnTotal pend" data-ft="emb">+<b>0</b>${esc(t('ru_embers'))}</div></div>
        <div class="smPan fame"><h3>${esc(t('ru_fame'))}</h3>
          <div class="fnLines">${(F.lines || []).map((l, i) => `<div class="pend" data-ml="${i}"><span>${esc(t(FAME_K[l.k] || ('fame_' + l.k)))}</span><b>${fmt(Math.round(l.v))}</b></div>`).join('')}</div>
          <div class="fnMuls">${fmuls.join('')}</div>
          <div class="fnTotal pend" data-ft="fame">+<b>0</b>${esc(t('ru_fame'))}</div></div></div>
      ${codex ? `<div class="smCodex">${codex}</div>` : ''}
      ${unl ? `<div class="smUnl pend"><h3 class="ruS">${esc(t('ru_unlocked'))}</h3>${unl}</div>` : ''}
      ${next ? `<div class="smNext pend"><h3 class="ruS">${esc(t('ru_next'))}</h3>${next}</div>` : ''}
      ${daily}
      ${streamOn() && sum.code ? `<p class="smCode">${esc(sum.code)}</p>` : ''}
      <div class="smActs"><button class="btn gold ruBig" data-again>${esc(t('ru_again'))}</button><button class="btn ruBig" data-town>${esc(t('ru_town'))}</button></div>
      <p class="smAuto" hidden><span></span> <button class="btn" data-stop>${esc(t('auto_stop'))}</button></p>
      <p class="smSkip">${esc(t('ru_skip'))}</p></div>`;
    const s = open('summary', { cover: true, cls: 'sk-' + (pushFall ? 'pushfall' : kind), html, keys: smKeys, def: () => { if (SM.anim) smSkip(); else smAgain(); } });
    s.el.onclick = e => {
      const b = e.target.closest('button');
      if (b && b.dataset.again != null) { smAgain(); return; }
      if (b && b.dataset.town != null) { smTown(); return; }
      if (b && b.dataset.stop != null) { SM.autoStopped = true; const a = s.el.querySelector('.smAuto'); if (a) a.hidden = true; return; }
      if (b && b.closest('.dyBtn')) return;
      if (SM.anim) smSkip();
    };
    const dy = s.el.querySelector('.dyBtn');
    if (dy && G.Daily && G.Daily.button) { const bb = safe(() => G.Daily.button(t('ru_board')), null); if (bb && bb.nodeType === 1) dy.appendChild(bb); }
    if (sum.daily && G.Daily && G.Daily.posted && G.Daily.posted(sum.daily.day) && SM.dailyRank == null) setDaily(null);
    if (animate && !reduced()) smPlay(s, sum); else smSkip();
  }
  function smKeys(e, fresh) { if (e.code === 'Escape') { if (SM.anim) smSkip(); return true; } return false; }
  function count(el, from, to, ms) {
    if (!el) return;
    const t0 = now();
    const step = () => { if (!el.isConnected) return; const k = Math.min(1, (now() - t0) / ms); el.textContent = fmt(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  // the Furnace plays: items into the forge one by one (a unique stops and stamps the Codex), the other lines, the
  // multipliers slam in, the totals count up; then Fame, the unlocks and the next goals
  function smPlay(s, sum) {
    SM.anim = true;
    const E = sum.embers || {}, F = sum.fame || {}, el = s.el, forge = el.querySelector('.fnForge'), cnt = el.querySelector('.fnCount');
    const show = q => { const x = typeof q === 'string' ? el.querySelector(q) : q; if (x) { x.classList.remove('pend'); x.classList.add('shown'); } return x; };
    let at = 450, acc = 0;
    sfx(sum.kind === 'win' ? 'bossWin' : sum.kind === 'extract' ? 'achievement' : 'bossFail');
    later('summary', () => { show('.smNear'); show('.smStats'); }, at);
    at += 350;
    const items = (E.items || []).slice(0, 14), cx = sum.codex || [];
    items.forEach((x, i) => {
      const isU = !!x.q, c = isU ? cx.find(k => k.q === x.q) : null;
      later('summary', () => {
        const ic = el.querySelector(`.fnHopper [data-fi="${i}"]`), a = rectOf(ic), b = rectOf(forge);
        acc += x.v || 0;
        if (ic && a && b) {
          const ghost = ic.cloneNode(true); ghost.style.position = 'fixed'; ghost.style.left = (a.x - a.w / 2) + 'px'; ghost.style.top = (a.y - a.h / 2) + 'px'; ghost.style.zIndex = 5; ghost.style.margin = 0;
          ensureRoot().appendChild(ghost); ic.classList.add('gone');
          ghost.animate([{ transform: 'none' }, { transform: `translate(${b.x - a.x}px, ${b.y - a.y - 20}px) scale(1.2)`, offset: 0.6 }, { transform: `translate(${b.x - a.x}px, ${b.y - a.y + 10}px) scale(.2)`, opacity: 0 }], { duration: 420, easing: 'ease-in' }).onfinish = () => ghost.remove();
          setTimeout(() => { if (!cnt.isConnected) return; cnt.textContent = fmt(Math.round(acc)); forge.classList.add('hot'); setTimeout(() => forge.classList.remove('hot'), 150); floatText(b.x, b.y - 30, '+' + fmt(Math.round((x.v || 0) * 10) / 10)); Snd.flip(Math.min(6, x.r | 0)); }, 300);
          // a unique or relic: it stops and stamps the Codex
          if (c) setTimeout(() => { if (!forge.isConnected) return; const st = document.createElement('span'); const rk = G.S.codex && G.S.codex[c.q] ? G.S.codex[c.q].rank | 0 : 1; st.className = 'fnStamp ' + (c.isNew ? '' : 'rank'); st.textContent = c.isNew ? t('ru_codexNew') : t('ru_codexRank', rk); forge.appendChild(st); sfx('stagger'); setTimeout(() => st.remove(), 900); }, 320);
        } else if (ic) ic.classList.add('gone');
      }, at);
      at += isU ? 480 : 100;
    });
    const moreEl = el.querySelector('.fnHopper [data-fi="more"]');
    if (moreEl) { later('summary', () => { moreEl.classList.add('gone'); acc = E.itemsV || acc; cnt.textContent = fmt(Math.round(acc)); burnSnd(); }, at); at += 300; }
    later('summary', () => { show(el.querySelector('[data-fl="items"]')); acc = E.itemsV || acc; cnt.textContent = fmt(Math.round(acc)); }, at); at += 220;
    el.querySelectorAll('.fnLines [data-fl]').forEach(x => { if (x.dataset.fl === 'items' || x.dataset.fl === 'base') return; later('summary', () => { show(x); sfx('coin'); }, at); at += 140; });
    later('summary', () => { show(el.querySelector('[data-fl="base"]')); cnt.textContent = fmt(E.base || 0); }, at); at += 220;
    el.querySelectorAll('.smPan:not(.fame) .fnMul').forEach(x => { later('summary', () => { show(x); sfx('buy'); }, at); at += 300; });
    later('summary', () => { const tt = show(el.querySelector('[data-ft="emb"]')); count(tt && tt.querySelector('b'), 0, E.total || 0, 700); sfx('levelUp'); }, at); at += 500;
    // (Fame plays beside the Furnace, from the start: the whole summary is readable within a few seconds)
    let fat = 900;
    el.querySelectorAll('.fame .fnLines [data-ml]').forEach(x => { later('summary', () => show(x), fat); fat += 160; });
    el.querySelectorAll('.fame .fnMul').forEach(x => { later('summary', () => show(x), fat); fat += 300; });
    later('summary', () => { const tt = show(el.querySelector('[data-ft="fame"]')); count(tt && tt.querySelector('b'), 0, F.total || 0, 700); }, fat); fat += 500;
    at = Math.max(at, fat);
    el.querySelectorAll('.smCodex .cx').forEach(x => { later('summary', () => show(x), at); at += 90; });
    later('summary', () => { show('.smUnl'); show('.smNext'); show('.smDaily'); smBars(el); sfx('achievement'); }, at); at += 200;
    later('summary', () => { SM.anim = false; const sk = el.querySelector('.smSkip'); if (sk) sk.hidden = true; smAutoStart(); }, at);
  }
  function smBars(el) { el.querySelectorAll('.nxRow i u').forEach(u => { u.style.width = (u.dataset.w || 0) + '%'; }); }
  function smSkip() {
    const s = SCR.summary; if (!s) return;
    clearTimers(s);
    SM.anim = false;
    const sum = SM.sum || {}, E = sum.embers || {}, F = sum.fame || {}, el = s.el;
    el.querySelectorAll('.pend').forEach(x => { x.classList.remove('pend'); x.classList.add('shown'); });
    el.querySelectorAll('.fnHopper i').forEach(x => x.classList.add('gone'));
    const cnt = el.querySelector('.fnCount'); if (cnt) cnt.textContent = fmt(E.base || 0);
    const te = el.querySelector('[data-ft="emb"] b'); if (te) te.textContent = fmt(E.total || 0);
    const tf = el.querySelector('[data-ft="fame"] b'); if (tf) tf.textContent = fmt(F.total || 0);
    smBars(el);
    const sk = el.querySelector('.smSkip'); if (sk) sk.hidden = true;
    smAutoStart();
  }
  // Auto-Run (run.js S.run.autoAgain): the next Siege starts by itself after a short countdown; Stop keeps the summary
  function smAutoStart() {
    const s = SCR.summary, r = run();
    if (!s || SM.autoT || SM.autoStopped || !(r && !r.on && r.autoAgain > 0)) return;
    let left = +r.autoAgain;
    const el = s.el.querySelector('.smAuto'); if (!el) return;
    el.hidden = false;
    const upd = () => setT(el.querySelector('span'), t('auto_again', Math.ceil(left)));
    upd();
    SM.autoT = setInterval(() => {
      if (!isOpen('summary') || SM.autoStopped || on()) { clearInterval(SM.autoT); SM.autoT = 0; return; }
      left -= 0.25; upd();
      if (left <= 0) { clearInterval(SM.autoT); SM.autoT = 0; smAgain(); }
    }, 250);
  }
  function smAgain() {
    if (G.Audio && G.Audio.unlock) G.Audio.unlock();
    if (on()) { close('summary', 200); return; }
    // AGAIN: the last setup at once (DESIGN §7.1: summary to field within 15 s)
    const r = G.runAgain ? G.runAgain() : null;
    if (r) sfx('levelUp'); else { sfx('error'); RU.setup({ reset: true }); }
  }
  function smTown() {
    if (G.Audio && G.Audio.unlock) G.Audio.unlock();
    close('summary', 200);
    // (the summary has been seen: a reload now opens the setup, not the summary)
    if (G.runPhase && run() && !run().on) G.runPhase('setup');
    if (G.enterTown && !G.R.town) G.enterTown();
  }
  function setDaily(rank, err) {
    const el = SCR.summary && SCR.summary.el.querySelector('.smDaily .dyTxt'); if (!el || !SM.sum || !SM.sum.daily) return;
    const d = SM.sum.daily;
    el.textContent = t('ru_dailyDone', d.zones, mmss(d.secs)) + ' · ' + (rank ? t('ru_dailyRank', rank) : err ? t('ru_dailyUnranked') : t('ru_dailyPosting'));
  }
  G.on('autoExtract', n => toast(`<b>${esc(t('auto_extract', n))}</b>`, 'ach', 'ic_ember', { p: 2 }));
  G.on('dailyPosted', p => { if (p && SM.sum && SM.sum.daily && p.day === SM.sum.daily.day) { SM.dailyRank = p.rank; setDaily(p.rank); } });
  G.on('runSummary', sum => {
    // (a fall: the Continue was asked first; the fall screen is gone)
    close('fall'); close('won'); for (const k of ['loot', 'cards', 'camp', 'doors', 'relic', 'boon', 'pact']) close(k);
    hudUpdate(true);
    setTimeout(() => renderSummary(sum, true), sum && sum.kind === 'fall' ? 200 : 600);
  });

  // ---------- the router: what is on screen follows the run's state (events open the screens at once; this catches up
  // after a reload, a missed event, or a screen whose state went away) ----------
  let summaryDue = 0, fallAt = 0, setupWait = 0;
  const introOpen = () => { const it = document.getElementById('intro'); return !!(it && !it.hidden); };
  const modalOpen = () => { const m = document.getElementById('modal'); return !!(m && !m.hidden); };
  G.on('runOver', () => { fallAt = now(); });
  G.on('runSummary', () => { summaryDue = now() + 900; });
  G.on('runStart', () => { close('setup', 200); close('summary', 200); hudUpdate(true); });
  // (setup waits for the intro, a cloud-save question or a window of ui.js to close)
  const setupRaw = RU.setup;
  RU.setup = function (o) {
    if (on() || G.S.fallen) return false;
    if (introOpen() || modalOpen() || (G.Net && G.Net.hold)) { clearTimeout(setupWait); setupWait = setTimeout(() => RU.setup(o), 500); return true; }
    return setupRaw(o);
  };
  function sync() {
    const S = G.S, r = run();
    if (!S || !S.hero || !document.body) return;
    hudUpdate();
    if (S.fallen) {
      if (!isOpen('fall') && now() - fallAt > 1800 && !otherWindow()) RU.fall();
      return;
    }
    if (isOpen('fall')) close('fall', 150);
    if (r && r.on) {
      if (isOpen('setup')) close('setup', 150);
      if (isOpen('summary')) close('summary', 150);
      if (r.loot && r.phase === 'loot' && !SCR.loot) lootOpen(r.loot, r.beat && r.beat.ctx);
      if (!r.loot && isOpen('loot') && !SCR.loot.done) close('loot', 200);
      if (r.offer && !isOpen('cards') && !SCR.loot) renderCards();
      if (!r.offer && isOpen('cards')) close('cards', 200);
      if (r.camp && !isOpen('camp')) renderCamp(); else if (!r.camp && isOpen('camp')) close('camp', 200);
      if (r.doors && !isOpen('doors')) renderDoors(); else if (!r.doors && isOpen('doors')) close('doors', 200);
      if (r.relicOffer && !isOpen('relic')) renderRelic(); else if (!r.relicOffer && isOpen('relic')) close('relic', 200);
      if (r.boonOffer && !isOpen('boon')) renderBoon(); else if (!r.boonOffer && isOpen('boon')) close('boon', 200);
      if (r.pactOffer && !isOpen('pact')) renderPact(); else if (!r.pactOffer && isOpen('pact')) close('pact', 200);
      if (r.pushAsk && !isOpen('won')) renderWon(); else if (!r.pushAsk && isOpen('won')) close('won', 200);
      return;
    }
    // between runs: the summary (once), then the setup; the town is the other place to be
    for (const k of ['loot', 'cards', 'camp', 'doors', 'relic', 'boon', 'pact', 'won']) if (isOpen(k)) close(k);
    if (isOpen('setup') || isOpen('summary') || now() < summaryDue || G.R.town || otherWindow()) return;
    if (r && r.phase === 'summary' && S.lastRun) renderSummary(S.lastRun, false);
    // (uifix: a page reloaded in the town comes back to the square (ui.js keeps set.ui.place), not to the setup)
    else if (S.hero && S.set && S.set.ui && S.set.ui.place === 'town' && !townTried && G.enterTown) { townTried = true; if (!G.enterTown()) RU.setup(); }
    else if (S.hero) RU.setup();
  }
  let townTried = false;
  RU.sync = () => safe(sync);
  // the Daily Siege (the Rift Gate page, ui.js's UI.dailySiege): its setup is fixed, so straight in
  RU.daily = function () { if (on() || G.S.fallen) return false; const r = G.runDaily ? G.runDaily() : null; if (r) sfx('levelUp'); return !!r; };
  // leaving the town with no run on: back to the setup
  G.on('town', inTown => { if (!inTown && !on()) setTimeout(() => safe(sync), 50); if (inTown && isOpen('setup')) close('setup', 150); });

  // ---------- the clock: countdowns and the HUD at 10 Hz (text only where it changed), the router twice a second ----------
  let tickN = 0;
  setInterval(() => {
    tickN++;
    if (!G.S || !G.S.hero) return;
    if (!(tickN & 1)) safe(() => hudUpdate());
    if (STACK.length) { safe(cardTick); safe(campTick); safe(doorTick); safe(relicTick); safe(shrineTick); }
    if (tickN % 5 === 0) safe(sync);
  }, 100);

  // ---------- start: after ui.js has built the page ----------
  function shims() {
    const UI = G.UI;
    if (!UI) return;
    // (the 3.6 fall card, the 3.x class pick and the run blessings: this module's screens now; ui.js's owner retires them)
    UI.fallCard = function () { return RU.fall() && SCR.fall ? SCR.fall.el : null; };
    UI.pickClass = function () { return RU.setup(); };
    UI.blessCards = function () { /* 4.0: no run blessings (Buttons and Power-shrine boons) */ };
  }
  function init() {
    ensureRoot(); ensureHud(); wrapBusy(); shims();
    hudUpdate(true);
    setTimeout(() => safe(sync), 700);
  }
  if (G.UI && typeof G.UI.init === 'function' && !G.UI.init._ru) {
    const init0 = G.UI.init;
    G.UI.init = function () { const v = init0.apply(this, arguments); safe(init); return v; };
    G.UI.init._ru = 1;
  } else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => safe(init));
  else setTimeout(() => safe(init), 0);
})(globalThis.G = globalThis.G || {});
