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
  const sm = id => `<img class="sm" src="${G.SPR.url(id, 4)}" alt="" draggable="false">`;

  Object.assign(G.STR, {
    in_1: 'First came the Button.', in_1b: 'No one knows who left it. Every land sees its glow.',
    in_2: 'Then the Horde came.', in_2b: 'From every side at once. They want it broken.',
    in_3: 'The Button called a Warden.', in_3b: 'A hero to hold the line, wearing what the Button spills.',
    in_4: 'Then it called you.', in_4b: 'Every click spills gold and calls lightning. You are the Hand.',
    in_next: 'Next', in_skip: 'Skip', in_play: 'Pick your Warden',
    tu_guide: 'Buttonling', tu_step: 'Step {0}/{1}', tu_skip: 'Skip tutorial', tu_ok: 'Got it', tu_reward: 'Done! +{0}',
    tu_click: "I'm Buttonling. You're the Hand: press the Button! Clicks spill gold and fill the chest bar.",
    tu_chestWait: 'Keep going! A full green bar drops a chest.',
    tu_chest: 'A chest! Tap it to open.',
    tip_seat: 'A seat opened in your party! Recruit a companion at the Tavern in town: a Knight takes the hits, a Cleric heals.',
    tu_gear: 'Gear inside! Tap TOWN, then the Forge.', tu_toField: 'Tap FIELD to fight on.',
    tu_doll: 'Your Warden has 4 slots. EQUIP BEST dresses the party; scrap spares into shards to upgrade.',
    tu_upgWait: 'Click up 15 gold for your first upgrade.',
    tu_upg: 'Back to the field: buy Iron Finger in Upgrades for stronger clicks.',
    tu_mobs: 'The Horde! Your Warden fights alone; clicks zap mobs near the Button. Tap a mob to focus it.',
    tu_garrisonWait: 'Nice! Save 50 gold to hire a fighter.',
    tu_garrison: 'In town, at the Barracks, hire a Cutpurse. The Garrison earns gold without clicks.',
    tu_boss: 'Kill mobs to fill the orange bar. Then the boss comes.',
    tu_bossReady: 'Boss ready! Press ⚔ or the skull. You have 30 seconds: click like mad.',
    tu_bossFight: 'Hit the boss! Too slow and it leaves, but it comes back.',
    tu_pets: 'An egg! Hatch it at the Hatchery in town: pets fight with you.',
    tu_final: 'That’s it! Go deeper, build up the town, climb the Ladder at the Tavern. Press ? any time.',
    tip_wisp: 'A wisp! Catch it for a buff or gold.',
    tip_mod: 'Special chest — {0}: {1}.',
    tip_bossReady: 'Boss ready. Press ⚔ when you are.',
    tip_ess: 'Essence! At the Observatory in town, pick a glowing star, then Learn.',
    tip_ability: 'Your Warden has an ability. It casts itself, or tap its button (Q).',
    tip_asc: 'You can ascend at the Temple in town! Restart for fame: permanent gold and damage. Gear, pets and the town stay.',
    tip_shards: 'Shards piled up. Upgrade an item at the Forge in town.',
    tip_break: 'The Button broke: clicks do nothing for 12 seconds. If the party falls meanwhile, you lose a depth.',
    tip_wall: 'Stuck on this boss? Each try adds +5% damage on it (max +15%). Or ascend for fame; gear and pets stay.',
    tip_loot: 'Loot! Tap a label to grab it, or the Warden will. A beam means something good.',
    tip_spitter: 'A spitter lobs globs from range. Tap it so the Warden kills it first.',
    tip_bomber: 'A bomber! Kill it in the crowd to blow up the pack, not the Button.',
    tip_carnage: 'Carnage! Kill with no 2.5-second pause: +10% gold and XP at 100 kills, up to +40% at 2,000.',
    tip_map: 'Tap the land name for the world map: five zones and three stars per land.',
    tip_hoard: 'A Hoarder! It flees in 16 seconds. Tap it so the Warden chases it: it bursts into loot.',
    tip_shrine: 'A shrine! Tap it for a 15-second blessing.',
    tip_powers: 'Powers! Z Smite: break wind-ups, hit hard. X Ward: no damage for 3.5 s. C Mend: heal the Button and party.',
    tip_move: 'Boss wind-up! Tap the glowing weak point (not the Button) or Smite with Z. Broken, it takes +50% damage.',
    tip_town: 'Better gear in your bag! Go to TOWN (T): EQUIP BEST at the Forge dresses everyone. The field waits.',
    tip_torment: 'Torment is open! Raise it for a tougher Horde and more gold, XP and loot. Lower it any time outside a fight.',
    tip_orb: 'Currency! At the Enchanter in town, pick an item, then an orb: reroll affixes, add one, or gamble (Orb of Ruin).',
    tip_rift: 'The Rift Gate in town is open: timed runs at your chosen level, better loot. Your best shows on the ladder.',
    tip_evo: 'Evolution ready! A maxed perk plus the right gear evolves. Look for the golden card.',
    tip_potion: 'A potion! It boosts a stat until you ascend. See Garrison.',
    help_title: 'How to play', help_intro: 'Watch intro', help_tut: 'Replay tutorial',
    help_1: 'You are the Hand', help_1t: 'Clicks spill gold, fill the chest bar and zap mobs near the Button. Fast clicks build a combo.',
    help_2: 'Loot', help_2t: 'Tap loot to grab it, or the Warden will; beams mark good drops. Orbs reshape gear at the Enchanter in town.',
    help_3: 'Your Warden', help_3t: 'Each level, pick one of three perks (they last until you ascend). Your class weapon deals +50%.',
    help_4: 'Horde and bosses', help_4t: 'Tap a mob to target it. Fill the clear bar for the boss (30 s, 45 for a lord); tap its glowing weak point to break its moves. Ward its DOOM; out of time it ENRAGES. Warded mobs shrug off the Hand: your party kills them.',
    help_5: 'Gold', help_5t: 'Upgrades boost clicks and chests. The Garrison earns on its own.',
    help_6: 'Constellation and pets', help_6t: 'Essence buys stars; boss eggs hatch pets.',
    help_7: 'Ascension', help_7t: 'When the Button falls, the run is over: you earn fame and start again from a checkpoint (half your best depth). Spend fame in the Hall of Fame at the Temple. Ascending on purpose from depth 15 pays full fame. Gear, the town, pets and collection always stay.',
    help_8: 'Ladder', help_8t: 'Name your hero at the Tavern (Character) and compare with friends there.',
    help_9: 'Lands and stars', help_9t: 'Each land has five zones and three stars (+2.5% damage and gold each, forever). Tap the land name for the map.',
    help_11: 'Your party', help_11t: 'Beat depths 3, 12 and 20 for party slots; recruit at the Tavern. Tap a fallen ally to raise them sooner.',
    help_12: 'Events and invasions', help_12t: 'About every minute, an event hits. Every seven minutes or so, a world invades: slay its herald for loot.',
    help_13: 'Chests and Looters', help_13t: 'The chest bar brings chests; the Treasure Hall holds more. Looters open them for you.',
    help_14: 'JACKPOT', help_14t: 'About one kill in two million, and the odds grow over time. You’ll know it.',
    help_15: 'Your powers', help_15t: 'Z Smite (18 s): break wind-ups, hit hard. X Ward (26 s): no damage for 3.5 s. C Mend (40 s): heal and raise everyone.',
    help_16: 'Torment', help_16t: 'Conquer a land to open a Torment level (up to ten). Raise it with + under the land name: tougher foes, more rewards.',
    help_17: 'Town', help_17t: 'Everything but Upgrades is in town: tap TOWN (or press T) between fights; the field waits. EQUIP BEST at the Forge dresses the party in one tap. Build up each building for a bonus that lasts through ascension.',
    help_18: 'Lucky Spin', help_18t: 'Kills fill the spin meter. When the slot machine pops up, tap it (or R): gold, chests, Frenzy, XP, orbs; 7-7-7 is the big one. Tap the ? bubbles mobs drop for a quick boost. Crits in a row chain for extra damage.',
    help_19: 'Relics', help_19t: 'The rarest drop there is: a white bag from a boss (about 1 in 600; 1 in 200 for a lord; more at higher Torment; never in Rifts). Each relic changes how you play. The Museum keeps the list.',
    help_20: 'Holding the Button', help_20t: 'Hold Space or the Button to click 1 time a second; each Steady Hand level (Upgrades) adds one, up to 10.',
    help_10: 'Carnage', help_10t: 'Kill without a 2.5-second pause to raise gold and XP, up to +40%.',
  });

  // ---------- Pointer targets ----------
  const P = {
    button: () => G.Stage.buttonPoint(),
    chest: () => { const cs = G.S.chests; if (!cs.length) return null; const c = cs.reduce((a, b) => (b.tier > a.tier ? b : a), cs[0]); return G.Stage.chestPoint(c); },
    mob: () => { const ms = (G.R.mobs || []).slice().sort((a, b) => b.p - a.p); return ms.length ? G.Stage.mobPoint(ms[0]) : null; },
    wisp: () => G.Stage.wispPoint(),
    el: sel => {
      let e = typeof sel === 'string' ? $(sel) : sel; if (!e || !e.offsetParent) return null;
      // a town window covering the target (a phone's full-screen one): point at its close button first
      const tw = $('#townWin');
      if (tw && !tw.hidden && !tw.contains(e)) { const a = tw.getBoundingClientRect(), b = e.getBoundingClientRect(); if (b.left < a.right && b.right > a.left && b.top < a.bottom && b.bottom > a.top) e = tw.querySelector('.twX') || e; }
      const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top - 2, el: e };
    },
    // a page lives in a town building: point at TOWN, then the building, in the square or the panel's list
    tab: id => {
      const b = G.UI.bldOf && G.UI.bldOf(id);
      if (!b) return P.el(`.tab[data-tab="${id}"]`);
      if (!G.R.town) return P.el('#btnTown');
      if (G.UI.townId() === b) return null;
      // a window covers the square: the building's row in the panel's list, or the window's close button
      if (G.UI.townId()) return P.el(`[data-dir="${b}"]`) || P.el('#townWin .twX');
      const q = G.Stage.townPoint && G.Stage.townPoint(b);
      return q ? { x: q.x, y: q.y - 4 } : P.el(`[data-dir="${b}"]`);
    },
    inTab: (id, sel) => (G.UI.tab() === id ? P.el(sel) : P.tab(id)),
  };
  const val = (f, S) => (typeof f === 'function' ? f(S) : f);

  // ---------- Guided steps ----------
  const STEPS = [
    { id: 'click', text: 'tu_click', point: P.button, done: S => S.clicks >= 12 },
    { id: 'chest', text: S => (S.chests.length ? 'tu_chest' : 'tu_chestWait'), point: S => (S.chests.length ? P.chest() : P.button()), done: S => S.st.chests >= 1 },
    { id: 'gear', town: 1, text: 'tu_gear', point: () => P.tab('forge'), done: () => G.UI.townId() === 'forge' },
    { id: 'doll', town: 1, text: 'tu_doll', point: () => (G.UI.townId() === 'forge' ? P.el('.twDoll') : P.tab('forge')), manual: true, done: () => G.UI.townId() !== 'forge', minT: 2500 },
    { id: 'upg', town: 1, text: S => (S.gold >= 15 || S.upg.finger ? 'tu_upg' : 'tu_upgWait'), point: S => (S.gold >= 15 ? P.inTab('upg', '.row[data-u="finger"]') : P.button()), done: S => (S.upg.finger || 0) >= 1 },
    { id: 'mobs', text: 'tu_mobs', point: () => P.mob() || P.button(), minT: 7000, done: S => S.hero.kills - (seen().tutK || 0) >= 40 },
    { id: 'garrison', town: 1, text: S => (S.gold >= 50 ? 'tu_garrison' : 'tu_garrisonWait'), point: S => (S.gold >= 50 ? P.inTab('heroes', '.row[data-h="rogue"]') : P.button()), done: S => (S.heroes.rogue || 0) >= 1 },
    { id: 'boss', text: () => (G.R.boss ? 'tu_bossFight' : G.R.bossReady ? 'tu_bossReady' : 'tu_boss'),
      point: () => (G.R.boss ? P.button() : G.R.bossReady ? (P.el('#btnFight') || P.button()) : P.el('#bossRow')), done: S => S.st.bossKills >= 1 },
    { id: 'pets', town: 1, text: 'tu_pets', point: () => P.inTab('pets', '[data-pull="1"]'), done: S => Object.keys(S.pets).length >= 1,
      skip: S => S.eggs < 1 && !Object.keys(S.pets).length },
    { id: 'final', town: 1, text: 'tu_final', point: () => P.tab('ladder'), manual: true },
  ];

  // ---------- One-time tips (after the tutorial) ----------
  const TIPS = [
    { id: 'wisp', when: () => G.R.wisp, point: P.wisp, text: 'tip_wisp', until: () => !G.R.wisp },
    { id: 'mod', when: S => S.chests.some(c => c.mod), point: () => { const c = G.S.chests.find(x => x.mod); return c && G.Stage.chestPoint(c); },
      text: () => { const c = G.S.chests.find(x => x.mod); const m = c && G.MOD_BY_ID[c.mod]; return m ? t('tip_mod', G.L(m.name), G.L(m.desc)) : ''; }, raw: true, until: S => !S.chests.some(c => c.mod) },
    { id: 'bossReady', when: () => G.R.bossReady && !G.R.boss, point: () => P.el('#btnFight'), text: 'tip_bossReady', until: () => !G.R.bossReady },
    { id: 'ess', when: S => S.essence >= 1 && !Object.keys(S.nodes).length, point: () => P.inTab('stars', '[data-detail] [data-buy]'), text: 'tip_ess', until: S => Object.keys(S.nodes).length > 0 },
    { id: 'ability', when: S => S.hero.eq.ability, point: () => P.el('#btnAbil'), text: 'tip_ability' },
    { id: 'shards', when: S => S.hero.shards >= 40, point: () => P.tab('forge'), text: 'tip_shards', until: () => G.UI.tab() === 'hero' },
    { id: 'asc', when: () => G.fameGain() >= 1, point: () => P.tab('asc'), text: 'tip_asc', until: () => G.UI.tab() === 'asc' },
    { id: 'loot', when: () => (G.R.ground || []).some(e => e.t > 0.6 && (e.k !== 'gear' || e.r >= 1)), point: () => { const e = (G.R.ground || []).find(x => x.t > 0.6 && (x.k !== 'gear' || x.r >= 1)); return e && G.Stage.lootPoint(e); }, text: 'tip_loot', until: () => !(G.R.ground || []).length },
    { id: 'hoard', when: () => (G.R.mobs || []).some(m => m.kind === 'hoard' && !m.gob), point: () => { const m = G.R.mobs.find(x => x.kind === 'hoard' && !x.gob); return m && G.Stage.mobPoint(m); }, text: 'tip_hoard', until: () => !(G.R.mobs || []).some(m => m.kind === 'hoard' && !m.gob) },
    { id: 'shrine', when: () => G.R.shrine, point: () => G.Stage.shrinePoint(), text: 'tip_shrine', until: () => !G.R.shrine },
    { id: 'powers', when: () => G.R.boss && G.R.boss.t < G.R.boss.T - 2, point: () => P.el('#powers'), text: 'tip_powers', until: () => !G.R.boss },
    { id: 'move', when: () => G.R.boss && G.R.boss.move, point: () => G.Stage.weakPoint && G.Stage.weakPoint() && (() => { const w = G.Stage.weakPoint(), r = document.querySelector('#stage').getBoundingClientRect(); return { x: r.left + w.x, y: r.top + w.y - 10 }; })(), text: 'tip_move', until: () => !(G.R.boss && G.R.boss.move) },
    { id: 'town', when: () => G.UI._up && G.townOk() && !G.R.town, point: () => P.el('#btnTown'), text: 'tip_town', until: () => !!G.R.town },
    { id: 'seat', when: S => S.hero && S.hero.cls && G.partySlots && G.partySlots() > S.party.length, point: () => P.tab('tavern'), text: 'tip_seat', until: S => G.partySlots() <= S.party.length || G.UI.townId() === 'tavern' },
    { id: 'torment', when: () => G.tormentMax() >= 1 && !G.R.boss, point: () => P.el('#torment'), text: 'tip_torment' },
    { id: 'orb', when: S => G.ORB_IDS.some(k => S.hero.orbs[k] > 0), point: () => P.tab('enchant'), text: 'tip_orb', until: () => G.UI.townId() === 'enchant' },
    { id: 'rift', when: () => G.riftOpenable() && !G.R.boss, point: () => P.el('#btnRift') || P.tab('rift'), text: 'tip_rift', until: () => G.UI.tab() === 'rift' || !!G.R.rift },
    { id: 'spitter', when: () => (G.R.mobs || []).some(m => m.kind === 'spitter' && m.spit), point: () => { const m = G.R.mobs.find(x => x.kind === 'spitter' && x.p >= G.TUNE.spitStop); return m && G.Stage.mobPoint(m); }, text: 'tip_spitter', until: () => !(G.R.mobs || []).some(m => m.kind === 'spitter') },
    { id: 'bomber', when: () => (G.R.mobs || []).some(m => m.kind === 'bomber' && m.p > 0.3), point: () => { const m = G.R.mobs.find(x => x.kind === 'bomber' && x.p > 0.3); return m && G.Stage.mobPoint(m); }, text: 'tip_bomber', until: () => !(G.R.mobs || []).some(m => m.kind === 'bomber') },
    { id: 'map', when: S => S.depth >= 1 && !G.R.boss, point: () => { const r = document.querySelector('#realmBox').getBoundingClientRect(); return { x: r.right + 14, y: Math.max(50, r.bottom) }; }, text: 'tip_map', until: () => !!G.UI.mapSeen },
    { id: 'carnage', when: () => G.carnage && G.carnage().tier >= 1, point: null, text: 'tip_carnage' },
    { id: 'wall', when: S => S.scar && S.scar.n >= 3 && G.fameGain() >= 1, point: () => P.tab('asc'), text: 'tip_wall', until: () => G.UI.tab() === 'asc' },
  ];

  let tip = null, tipT = 0, lastHl = null, shownT = 0, nextTipAt = 0;
  const TIP_GAP = 40000; // after the tutorial, one tip at a time with a breather between them
  const stepAt = { i: -1, t: 0 };
  // bosses don't come on their own before the tutorial's boss step (for the first few minutes); the field waits for the first press
  G.tutHold = () => active() && G.S.tut < 7 && G.S.st.playTime < 150;
  G.tutFreeze = () => G.S.tut === 0 && !(G.S.clicks > 0) && !!(G.S.hero && G.S.hero.cls);
  const TOWN_TIPS = { seat: 1, shards: 1, orb: 1, asc: 1, ess: 1, rift: 1, wall: 1 };
  const EVENT_TIPS = { hoard: 1, loot: 1, shrine: 1, move: 1, spitter: 1, bomber: 1, powers: 1 };

  function seen() { const S = G.S; S.seen = S.seen || {}; S.seen.tips = S.seen.tips || {}; return S.seen; }
  const veteran = S => S.clicks > 60 || S.ascensions > 0 || S.st.bossKills > 0 || S.maxDepth > 0 || S.goldTotal > 5000;
  function active() { return typeof G.S.tut === 'number' && G.S.tut >= 0 && G.S.tut < STEPS.length; }

  Tut.init = function () {
    const S = G.S;
    // Players who were already playing before onboarding existed skip the intro and tutorial
    if (S.tut === 0 && veteran(S)) S.tut = -1;
    $('#btnHelp').addEventListener('click', Tut.help);
    $('#coach').addEventListener('click', e => {
      // the bubble can appear under a finger that is busy clicking: ignore taps for a moment
      if (performance.now() - shownT < 500) return;
      if (e.target.closest('[data-skip]')) { G.S.tut = -1; hide(); return; }
      if (e.target.closest('[data-ok]')) {
        if (tip) { finishTip(); return; }
        if (active() && STEPS[S.tut] && STEPS[G.S.tut].manual) complete();
      }
    });
    G.on('buttonBreak', () => { if (!active() && !seen().tips.break && !G.R.rift) showTip({ id: 'break', text: 'tip_break' }); });
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
    // the welcome pack kills plenty before this step comes up, so count from here
    if (active() && STEPS[S.tut].id === 'mobs') seen().tutK = S.hero.kills;
    if (!active()) { S.tut = -1; if (!S.bless && G.blessOffer) G.blessOffer(); }
    if (G.Audio) G.Audio.achievement();
  }

  // Called ~8 times a second from UI.update
  Tut.update = function () {
    const S = G.S;
    // in town only the steps and tips about the town speak; the field's other steps point the way back (FIELD)
    const inTown = !!(G.R && G.R.town);
    if (inTown) {
      const st = active() && STEPS[S.tut];
      if (st && !st.town) { render(st.id + ':town', t('tu_toField') + ' ' + t(val(st.text, S)), t('tu_step', S.tut + 1, STEPS.length), st.manual); point(P.el('#btnTown')); return; }
      if (!st && tip && !TOWN_TIPS[tip.id]) { tip = null; hide(); return; }
    }
    const busy = !$('#intro').hidden || !$('#modal').hidden || !$('#perks').hidden; // a level-up choice is on screen
    if (!S || !$('#coach') || busy) {
      hidePointer(); if (busy) $('#coach').hidden = true;
      // a step already done still finishes behind a level-up card; only a real window holds the clock back
      if (active() && S.hero && S.hero.cls) { const st = STEPS[S.tut]; if (st.done && st.done(S) && performance.now() - stepAt.t > (st.minT || 3500)) { complete(); return; } }
      if (!$('#modal').hidden || !$('#intro').hidden) stepAt.t += 120;
      return;
    }
    if (!S.hero || !S.hero.cls) { hide(); return; }
    // tips for things that come and go (a Hoarder, loot, a shrine, a boss move) may cut into the tutorial
    if (tip) {
      tipT -= 0.12;
      if (tipT <= 0 || (tip.until && tip.until(S))) { finishTip(); return; }
      point(tip.point ? tip.point() : null);
      return;
    }
    if (active()) {
      const st = STEPS[S.tut];
      if (stepAt.i !== S.tut) { stepAt.i = S.tut; stepAt.t = performance.now(); }
      const target = val(st.point, S);
      const inPanel = !!(target && target.el && target.el.closest('#panel'));
      const ev = !inPanel && S.tut >= 3 && TIPS.find(tp => EVENT_TIPS[tp.id] && !seen().tips[tp.id] && tp.when(S));
      if (ev) { showTip(ev); return; }
      if (st.skip && st.skip(S)) { S.tut++; if (!active()) S.tut = -1; return; }
      // a step that finishes on its own still stays up long enough to be read
      if (st.done && st.done(S) && performance.now() - stepAt.t > (st.minT || 3500)) { complete(); return; }
      render(st.id, t(val(st.text, S)), t('tu_step', S.tut + 1, STEPS.length), st.manual);
      point(val(st.point, S));
      return;
    }
    if (G.Stage.busyCelebrating && G.Stage.busyCelebrating()) return; // don't talk over a big drop
    // the wall tip comes back for each new wall
    if (S.scar && S.scar.n >= 3 && seen().tips.wall && seen().wallD !== S.scar.d) { delete seen().tips.wall; seen().wallD = S.scar.d; }
    const rest = performance.now() < nextTipAt;
    for (const tp of TIPS) {
      if (seen().tips[tp.id] || (inTown && !TOWN_TIPS[tp.id])) continue;
      // tips about something on screen right now can't wait; the rest keep their distance
      if (rest && !EVENT_TIPS[tp.id]) continue;
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
  function finishTip() { if (tip) { seen().tips[tip.id] = 1; nextTipAt = performance.now() + TIP_GAP; } tip = null; hide(); }

  // ---------- Coach bubble & pointer ----------
  let lastKey = '';
  // on a touch screen the keyboard letters mean nothing: drop them from what the coach says
  const touch = typeof matchMedia !== 'undefined' && matchMedia('(hover: none)').matches;
  const untype = s => s.replace(/ ?\((?:or press )?[A-Z]\)/g, '').replace(/\b([ZXC]) (Smite|Ward|Mend)\b/g, '$2').replace(/ (?:or )?(?:with|press) [ZXCQRTEB]\b/g, '').replace(/ ?\((?:[ZXC] )?\d+ ?s\)/g, m => m.replace(/[ZXC] /, ''));
  function render(key, text, step, manual) {
    if (touch && typeof text === 'string') text = untype(text);
    const c = $('#coach');
    const k = key + text + step + manual;
    if (k !== lastKey) {
      lastKey = k; shownT = performance.now();
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
  let aim = null, placedY = null, aimEl = null;
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
    // keep off what is being pointed at, and off the Button and its boss skull where the player keeps tapping
    const bp = G.Stage.buttonPoint(), sc = G.Stage.toScreen(1, 0).x - G.Stage.toScreen(0, 0).x;
    const btn = { top: bp.y - 30 * sc, bottom: bp.y + 40 * sc };
    const off = (a, y) => !a || y >= a.bottom || y + h <= a.top;
    const clear = y => off(aim, y) && off(btn, y);
    let y = placedY !== null && spots.includes(placedY) && clear(placedY) ? placedY : spots.find(clear);
    if (y === undefined) y = spots.find(y2 => off(aim, y2));
    // what it points at is in the panel: keep the panel clear, even if the bubble has to cover part of the stage
    if (aimEl && aimEl.closest('#panel') && y === spots[2]) y = spots.slice(0, 2).find(y2 => off(btn, y2)) || spots[0];
    if (y === undefined) y = spots[0];
    if (y !== placedY) shownT = performance.now();
    placedY = y;
    c.style.top = y + 'px';
  }
  function point(p) {
    const el = $('#pointer');
    if (lastHl && (!p || p.el !== lastHl)) { lastHl.classList.remove('tut-hl'); lastHl = null; }
    if (!p) { el.hidden = true; aim = null; aimEl = null; place(); return; }
    if (p.el && !lastHl) {
      lastHl = p.el; lastHl.classList.add('tut-hl');
      const body = p.el.closest('.tabBody');
      if (body) { const br = body.getBoundingClientRect(), er = p.el.getBoundingClientRect(); if (er.top < br.top || er.bottom > br.bottom) p.el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    }
    if (!el.firstChild) el.innerHTML = img('ic_arrow', 5);
    el.hidden = false;
    // (a target at the very top of the screen: the arrow comes from below, pointing up)
    const up = p.y < 56 && p.el;
    const ub = up ? p.el.getBoundingClientRect().bottom + 2 : 0;
    el.style.transform = up ? `translate(${Math.round(p.x - 25)}px, ${Math.round(ub)}px) rotate(180deg)` : `translate(${Math.round(p.x - 25)}px, ${Math.round(p.y - 50)}px)`;
    // Arrow plus the thing it points at
    aim = up ? { top: p.y - 4, bottom: ub + 54 } : { top: p.y - 58, bottom: p.y + 44 }; aimEl = p.el || null;
    if (p.el) { const er = p.el.getBoundingClientRect(); aim.top = Math.min(aim.top, er.top); aim.bottom = Math.max(aim.bottom, er.bottom); }
    place();
  }
  function hidePointer() { const el = $('#pointer'); if (el) el.hidden = true; if (lastHl) { lastHl.classList.remove('tut-hl'); lastHl = null; } }
  function hide() { const c = $('#coach'); if (c) c.hidden = true; lastKey = ''; placedY = null; aim = null; hidePointer(); }

  // ---------- Intro ----------
  // slide 2: the Horde closes in on the Button from both sides, wave after wave, and the Button flinches at every blow
  function siege() {
    const L = [['f_crab', 0], ['b_goblin', 1], ['f_goblin', 0], ['f_spore', 0], ['b_crab', 1], ['f_pebble', 0]];
    const Rt = [['f_bat', 0], ['b_imp', 1], ['f_eye', 0], ['f_shade', 0], ['b_eye', 1], ['f_ember', 0]];
    // lane (vertical place), how far in it stops, when it sets off
    // (they gather in an arc round it: the outer lanes, and the big ones, stand further out)
    const lanes = [[-44, 0], [-4, 0.3], [34, 0.7], [-24, 1.1], [16, 1.5], [48, 1.9]];
    const mob = (side, [id, big], k) => {
      const [y, d] = lanes[k], stop = Math.round(80 + Math.abs(y) * 0.55 + (big ? 22 : 0) + (k > 2 ? 34 : 0));
      return `<span class="sgMob ${side}${big ? ' big' : ''}" style="--y:${y}px;--d:${d}s;--stop:${stop}px"><img src="${G.SPR.url(id, big ? 4 : 5)}" alt="" draggable="false"></span>`;
    };
    return `<div class="siege" aria-hidden="true">
      <div class="sgGround"></div>
      ${L.map((m, k) => mob('l', m, k)).join('')}${Rt.map((m, k) => mob('r', m, k)).join('')}
      <div class="sgBtn"><i class="sgGlow"></i><img src="${G.SPR.url(G.SPR.button('#e8413c', false, 0), 4)}" alt="" draggable="false"><i class="sgHit l"></i><i class="sgHit r"></i></div>
    </div>`;
  }
  Tut.intro = function () {
    const box = $('#intro');
    const skins = ['#e8413c'];
    const btn = G.SPR.url(G.SPR.button(skins[0], false, 0), 6);
    const slides = [
      { a: 'in_1', b: 'in_1b', art: `<div class="introTitle">${'BTTN'.split('').map((ch, i) => `<span style="animation-delay:${0.15 * i}s">${ch}</span>`).join('')}</div><img class="dropBtn" src="${btn}" alt="">` },
      { a: 'in_2', b: 'in_2b', art: siege() },
      { a: 'in_3', b: 'in_3b', art: `<div class="row3">${G.CLASSES.map((c, i) => `<span class="popIn" style="animation-delay:${0.2 * i}s">${img(c.spr, 8)}</span>`).join('')}</div>
          <div class="row3 small">${['bag_3', 'it_steel_sword', 'chest_4', 'it_golden_plate', 'bag_6'].map((id, i) => `<span class="popIn" style="animation-delay:${0.9 + 0.15 * i}s">${img(id, 5)}</span>`).join('')}</div>` },
      { a: 'in_4', b: 'in_4b', art: `<div class="handArt"><img class="zap l" src="${G.SPR.url('ic_bolt', 5)}" alt=""><img class="finger" src="${G.SPR.url('ic_finger', 8)}" alt=""><img class="btn2" src="${btn}" alt=""><img class="zap r" src="${G.SPR.url('ic_bolt', 5)}" alt=""></div>`, last: true },
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
    const rows = [['ic_coin', 1], ['ic_chest', 2], ['ic_sword', 3], ['h_priest', 11], ['ic_skull', 4], ['ic_town', 17], ['ic_bolt', 15], ['ic_skull', 16], ['ev_meteors', 12], ['ic_vault', 13], ['h_rogue', 5], ['ic_star', 6], ['ic_tomb', 7], ['ic_crown', 8], ['f_crab', 9], ['ic_skull', 10], ['ic_jackpot', 14], ['ic_coin', 18], [G.SPR.defs.rx_bag ? 'rx_bag' : 'ic_jackpot', 19], ['ic_clock', 20]];
    const html = `<div class="helpList">${rows.map(([ic, n]) => `<div class="helpRow">${img(ic, 3)}<div><b>${esc(t('help_' + n))}</b><p>${esc(t('help_' + n + 't'))}</p></div></div>`).join('')}</div>
      <p style="font-size:15px">${esc(t('keysHint'))}</p>`;
    G.UI.modal(t('help_title'), html, [
      { label: t('help_intro'), fn: () => Tut.intro() },
      { label: t('help_tut'), fn: () => { G.S.tut = 0; } },
      { label: t('close'), cls: 'gold' },
    ]);
  };
})(globalThis.G = globalThis.G || {});
