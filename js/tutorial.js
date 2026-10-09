// BTTN — onboarding: a short intro, a guided first Siege with a pointer
// and a guide (Buttonling), one-time tips when a new mechanic shows up, and
// a "How to play" sheet behind the ? button.
// 4.0: the first Siege is coached as the loop it is: hold the Button, the Horde, the first boss, the loot moment, the
// first card, the Integrity pips at camp 1, the doors. The retired systems' steps (Iron Finger, the Garrison hire, the
// Constellation's essence, ascending, Torment, Rifts) went.
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
    help_18: 'Bubbles and crit chains', help_18t: 'Tap the ? bubbles mobs drop for a quick boost: double gold or damage, a purse, a loot magnet or longer buffs. Crits in a row chain for extra damage; every tenth link tops up Overdrive.',
    help_19: 'Relics', help_19t: 'The rarest drop there is: a white bag from a boss (about 1 in 600; 1 in 200 for a lord; more at higher Torment; never in Rifts). Each relic changes how you play. The Museum keeps the list.',
    help_20: 'Holding the Button', help_20t: 'Hold Space or the Button to click 1 time a second; each Steady Hand level (Upgrades) adds one, up to 10.',
    help_10: 'Carnage', help_10t: 'Kill without a 2.5-second pause to raise gold and XP, up to +40%.',
    help_21: 'Shortcuts', help_21t: 'In a building, the bar on top jumps to any other one (or swipe; keys 1–0, ← →); FIELD goes back. Lock gear so it is never scrapped. Hold an upgrade to keep buying. Tap the gold rate to see where gold comes from. Settings → Play: auto-perks, Overdrive, fewer effects.',
  });

  // 4.0: the first Siege's words (these replace the 3.x steps' and tips' where they share a key)
  Object.assign(G.STR, {
    in_play: 'To the Siege',
    tu_hold: "I'm Buttonling. You're the Hand: hold the Button! (Space, or keep a finger on it.) Every press spills gold and zaps the Horde.",
    tu_mobs: 'The Horde comes for the Button. Your Warden fights it; tap a mob to make it the target. Kills fill the clear bar.',
    tu_boss: 'Fill the clear bar and the boss comes. Keep holding.',
    tu_bossReady: 'Boss ready! It comes on its own, or press ⚔.',
    tu_bossFight: 'Hit the boss! Tap its glowing weak point when it winds up. Z Smite · X Ward · C Mend.',
    tu_lootWait: 'Beat the boss: its loot bursts out.',
    tu_loot: 'LOOT! Tap a card to put it on: ▲ means better for that hero. What you leave burns into Embers.',
    tu_card: 'A card! Each adds a perk rank. A school you own comes up more often; six perks at most.',
    tu_campWait: 'Three zones make a land. After its lord: the camp.',
    tu_camp: 'CAMP. Your three Integrity pips light up: land 1 was the muster. From now on a wipe cracks one; each lord gives one back. Rest, Temper or Train; then the market.',
    tu_doors: 'Choose the next land. Each door shows its rule, its lord, a risk and a reward.',
    tu_final: 'That\u2019s the Siege. When the Button falls, all you carried burns into Embers for the town, and Fame buys the Hall of Fame. Press ? any time.',
    tip_shrine: 'A shrine! Hold the Hand on it for 2 s (not on the Button) to claim it.',
    tip_shards: 'Shards piled up: ENCHANT ALL at the Forge (TOWN) raises the whole party.',
    tip_break: 'The Button broke: clicks do nothing for 12 seconds. If the party falls meanwhile, Integrity cracks.',
    help_15: 'Your powers', help_15t: 'Z Smite (18 s): break wind-ups, hit hard. X Ward (26 s): no damage for 3.5 s. C Mend: 2 charges a land, each heals 35%.',
    tip_relic: 'A relic: its rule goes on your belt for the rest of the Siege. Choose one that fits your cards.',
    tip_pipLost: 'INTEGRITY CRACKED: the Horde broke through. A lord gives a pip back; at none left, the next hit is the fall.',
    tip_embers: 'Embers and Fame! Build the town with Embers; buy the Hall of Fame at the Temple with Fame. Then NEW SIEGE.',
    tip_codex: 'A unique joined the Codex: from the Museum I it can come along as a keepsake.',
    help_1: 'You are the Hand', help_1t: 'Hold the Button: every press spills gold, fills the chest bar and zaps the Horde near it. Fast presses build a combo.',
    help_2: 'The Siege', help_2t: 'A run from nothing: six lands of three zones, chosen at the doors; the last is the Void, then the Mad Button. When the Button falls, the run is over.',
    help_3: 'Cards', help_3t: 'Levels 2 to 4 and every boss give a card: pick 1 of 3. Six perks at most; a perk at max with two picked ranks and the right item evolves.',
    help_4: 'Horde and bosses', help_4t: 'Tap a mob to target it. Fill the clear bar for the boss; tap its glowing weak point to break its moves. Ward its DOOM.',
    help_5: 'Gold', help_5t: 'Gold is the Siege\u2019s: Upgrades and the Garrison (Auto-invest spends it for you), the camp market.',
    help_6: 'Loot', help_6t: 'After every boss its loot bursts out: tap a card to wear it (▲ better for that hero), hold to stash it. The rest burns into Embers. Rainbow names are ultra-rare.',
    help_7: 'Integrity', help_7t: 'Three pips. A wipe or a lost lord fight cracks one (not in land 1); each lord gives one back. At none, the next hit is the fall.',
    help_8: 'Camp and doors', help_8t: 'After each lord: Rest, Temper or Train, a market, recruits (Camps 1 to 3), Enchant All, Extract. Then choose the next land at the doors.',
    help_9: 'Relics', help_9t: 'After each act boss, choose a relic: its rule goes on your belt for the Siege.',
    help_11: 'Your party', help_11t: 'Camps 1 to 3 bring recruits, each with a trait. Companions wear uniques too, and the rule works for the whole party. Tap a fallen ally to raise them.',
    help_12: 'Embers and Fame', help_12t: 'At the end, everything carried burns into Embers (a fall ×0.5, an extract ×1, a win ×1.5): they build the town and the Star Chart. Fame buys the Hall of Fame.',
    help_13: 'The town', help_13t: 'Each building\u2019s five levels open something new. Tap TOWN (T) any time; NEW SIEGE starts the next run.',
    help_16: 'Heat', help_16t: 'A win opens the next Heat (up to ten), chosen at the setup: a tougher Horde, more Fame and Embers, a named rule each.',
    help_17: 'Forge', help_17t: 'EQUIP BEST dresses the whole party by one rule; tap an item to compare it side by side with what any hero wears; ENCHANT ALL (Forge I) spends your shards.',
    help_19: 'Deeds and Buttons', help_19t: 'Deeds unlock Buttons, classes, cards, lands, uniques and relics. Each Button is its own Siege; some evolve by secret recipes.',
    help_20: 'Holding the Button', help_20t: 'Hold Space or the Button to click 1 time a second; each Steady Hand level (Upgrades) adds one, up to 10.',
    help_21: 'Shortcuts', help_21t: 'In a building, the bar on top jumps to any other one (or swipe; keys 1–0, ← →); FIELD goes back. Lock gear so it is never scrapped. Settings → Play: card auto-pick, Auto-invest, fewer effects.',
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
      // (TOWN/FIELD or Upgrades under it: the window's own FIELD button on its quick bar, one tap back to the field)
      if (tw && !tw.hidden && !tw.contains(e)) { const a = tw.getBoundingClientRect(), b = e.getBoundingClientRect(); if (b.left < a.right && b.right > a.left && b.top < a.bottom && b.bottom > a.top) e = ((e.id === 'btnTown' || e.matches('.tab[data-tab="upg"]')) && tw.querySelector('[data-twgo="field"]')) || tw.querySelector('.twX') || e; }
      const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top - 2, el: e };
    },
    // a page lives in a town building: point at TOWN, then the building, in the square or the panel's list
    tab: id => {
      const b = G.UI.bldOf && G.UI.bldOf(id);
      if (!b) return P.el(`.tab[data-tab="${id}"]`);
      if (!G.R.town) return P.el('#btnTown');
      if (G.UI.townId() === b) return null;
      // a window covers the square: its quick bar's button for the building, the panel's list, or the close button
      if (G.UI.townId()) {
        const nb = $(`#townWin [data-twgo="${b}"]`), nv = nb && nb.parentElement;
        if (nb && nv) { const r = nb.getBoundingClientRect(), q = nv.getBoundingClientRect(); if (r.left < q.left || r.right > q.right) nv.scrollLeft += r.left < q.left ? r.left - q.left - 8 : r.right - q.right + 8; }
        return P.el(nb) || P.el(`[data-dir="${b}"]`) || P.el('#townWin .twX');
      }
      const q = G.Stage.townPoint && G.Stage.townPoint(b);
      return q ? { x: q.x, y: q.y - 4 } : P.el(`[data-dir="${b}"]`);
    },
    inTab: (id, sel) => (G.UI.tab() === id ? P.el(sel) : P.tab(id)),
  };
  const val = (f, S) => (typeof f === 'function' ? f(S) : f);

  // ---------- Guided steps (4.0: the first Siege) ----------
  // A step with `wait` is a moment of the run (the loot moment, a card, the camp, the doors): it speaks while that screen
  // is up (`wait(S)` true, the coach on top of it) and is done once the player has been through it (its seen flag, set
  // from the run's events below); until it comes, `idle` says what leads there. A moment that came early (the warm-up
  // cards come before the first boss) is already done when its step's turn comes.
  const runPh = () => (G.S.run && G.S.run.on ? G.S.run.phase : '');
  const moment = k => !!seen()['tut_' + k];
  const STEPS = [
    { id: 'hold', text: 'tu_hold', point: P.button, done: S => S.clicks >= 25 || !!(S.seen && S.seen.hold) },
    { id: 'mobs', text: 'tu_mobs', point: () => P.mob() || P.button(), minT: 6000, done: S => S.hero.kills - (seen().tutK || 0) >= 40 },
    { id: 'boss', text: () => (G.R.boss ? 'tu_bossFight' : G.R.bossReady ? 'tu_bossReady' : 'tu_boss'),
      point: () => (G.R.boss ? P.button() : G.R.bossReady ? (P.el('#btnFight') || P.button()) : P.el('#bossRow')), done: S => S.st.bossKills >= 1 || moment('loot') },
    { id: 'loot', wait: () => runPh() === 'loot', text: S => (runPh() === 'loot' ? 'tu_loot' : 'tu_lootWait'), point: () => (runPh() === 'loot' ? null : P.el('#bossRow')), done: () => moment('loot') },
    { id: 'card', wait: S => !!(S.run && S.run.offer), text: 'tu_card', point: null, done: () => moment('card') },
    { id: 'camp', wait: () => runPh() === 'camp', text: () => (runPh() === 'camp' ? 'tu_camp' : 'tu_campWait'), point: () => (runPh() === 'camp' ? null : P.el('#bossRow')), done: () => moment('camp') },
    { id: 'doors', wait: () => runPh() === 'doors', text: 'tu_doors', point: null, done: () => moment('doors') },
    { id: 'final', town: 1, text: 'tu_final', point: () => P.el('#btnHelp'), manual: true },
  ];
  // the run's moments, seen: what moves the waiting steps on (and only during the tutorial)
  const seeMoment = k => () => { if (active()) seen()['tut_' + k] = 1; };
  G.on('lootDone', seeMoment('loot')); G.on('lootTake', seeMoment('loot'));
  G.on('cardPick', seeMoment('card'));
  G.on('campDone', seeMoment('camp'));
  G.on('door', seeMoment('doors'));
  // (a phase that ended after its words showed counts too: a camp the auto-continue closed)
  G.on('runPhase', (ph, ctx, prev) => { if (!active()) return; const st = STEPS[G.S.tut]; if (st && st.wait && stepShown === st.id && ph !== st.id) seen()['tut_' + st.id] = 1; });
  let stepShown = '';

  // ---------- One-time tips (after the tutorial) ----------
  const TIPS = [
    { id: 'wisp', when: () => G.R.wisp, point: P.wisp, text: 'tip_wisp', until: () => !G.R.wisp },
    { id: 'mod', when: S => S.chests.some(c => c.mod), point: () => { const c = G.S.chests.find(x => x.mod); return c && G.Stage.chestPoint(c); },
      text: () => { const c = G.S.chests.find(x => x.mod); const m = c && G.MOD_BY_ID[c.mod]; return m ? t('tip_mod', G.L(m.name), G.L(m.desc)) : ''; }, raw: true, until: S => !S.chests.some(c => c.mod) },
    { id: 'bossReady', when: () => G.R.bossReady && !G.R.boss, point: () => P.el('#btnFight'), text: 'tip_bossReady', until: () => !G.R.bossReady },
    { id: 'ability', when: S => S.hero.eq.ability, point: () => P.el('#btnAbil'), text: 'tip_ability' },
    { id: 'shards', when: S => S.hero.shards >= 150 && G.D.enchantAll, point: () => P.tab('forge'), text: 'tip_shards', until: () => G.UI.tab() === 'hero' },
    { id: 'loot', when: () => (G.R.ground || []).some(e => e.t > 0.6 && (e.k !== 'gear' || e.r >= 1)), point: () => { const e = (G.R.ground || []).find(x => x.t > 0.6 && (x.k !== 'gear' || x.r >= 1)); return e && G.Stage.lootPoint(e); }, text: 'tip_loot', until: () => !(G.R.ground || []).length },
    { id: 'hoard', when: () => (G.R.mobs || []).some(m => m.kind === 'hoard' && !m.gob), point: () => { const m = G.R.mobs.find(x => x.kind === 'hoard' && !x.gob); return m && G.Stage.mobPoint(m); }, text: 'tip_hoard', until: () => !(G.R.mobs || []).some(m => m.kind === 'hoard' && !m.gob) },
    { id: 'shrine', when: () => G.R.shrine, point: () => G.Stage.shrinePoint(), text: 'tip_shrine', until: () => !G.R.shrine },
    { id: 'powers', when: () => G.R.boss && G.R.boss.t < G.R.boss.T - 2, point: () => P.el('#powers'), text: 'tip_powers', until: () => !G.R.boss },
    { id: 'move', when: () => G.R.boss && G.R.boss.move, point: () => G.Stage.weakPoint && G.Stage.weakPoint() && (() => { const w = G.Stage.weakPoint(), r = document.querySelector('#stage').getBoundingClientRect(); return { x: r.left + w.x, y: r.top + w.y - 10 }; })(), text: 'tip_move', until: () => !(G.R.boss && G.R.boss.move) },
    { id: 'town', when: () => G.UI._up && G.townOk() && !G.R.town && !(G.runHeld && G.runHeld()), point: () => P.el('#btnTown'), text: 'tip_town', until: () => !!G.R.town },
    { id: 'orb', when: S => G.ORB_IDS.some(k => S.hero.orbs[k] > 0), point: () => P.tab('enchant'), text: 'tip_orb', until: () => G.UI.townId() === 'enchant' },
    { id: 'relic', when: S => !!(S.run && S.run.on && S.run.phase === 'relic'), point: null, text: 'tip_relic', top: 1, until: S => !(S.run && S.run.phase === 'relic') },
    { id: 'embers', when: S => !(S.run && S.run.on) && !!S.lastRun && (S.embers > 0 || S.fame > 0) && !!G.R.town, point: () => P.tab('temple'), text: 'tip_embers', until: () => G.UI.townId() === 'temple' },
    { id: 'spitter', when: () => (G.R.mobs || []).some(m => m.kind === 'spitter' && m.spit), point: () => { const m = G.R.mobs.find(x => x.kind === 'spitter' && x.p >= G.TUNE.spitStop); return m && G.Stage.mobPoint(m); }, text: 'tip_spitter', until: () => !(G.R.mobs || []).some(m => m.kind === 'spitter') },
    { id: 'bomber', when: () => (G.R.mobs || []).some(m => m.kind === 'bomber' && m.p > 0.3), point: () => { const m = G.R.mobs.find(x => x.kind === 'bomber' && x.p > 0.3); return m && G.Stage.mobPoint(m); }, text: 'tip_bomber', until: () => !(G.R.mobs || []).some(m => m.kind === 'bomber') },
    { id: 'map', when: S => S.depth >= 1 && !G.R.boss && !(G.runHeld && G.runHeld()), point: () => { const r = document.querySelector('#realmBox').getBoundingClientRect(); return { x: r.right + 14, y: Math.max(50, r.bottom) }; }, text: 'tip_map', until: () => !!G.UI.mapSeen },
    { id: 'carnage', when: () => G.carnage && G.carnage().tier >= 1, point: null, text: 'tip_carnage' },
  ];

  let tip = null, tipT = 0, lastHl = null, shownT = 0, nextTipAt = 0;
  const TIP_GAP = 40000; // after the tutorial, one tip at a time with a breather between them
  const stepAt = { i: -1, t: 0 };
  // bosses don't come on their own before the tutorial's boss step (for the first few minutes); the field waits for the first press
  G.tutHold = () => active() && G.S.tut < 2 && G.S.st.playTime < 150;
  G.tutFreeze = () => G.S.tut === 0 && !(G.S.clicks > 0) && !!(G.S.hero && G.S.hero.cls) && !!(G.S.run && G.S.run.on) && G.S.run.phase === 'field';
  const TOWN_TIPS = { shards: 1, orb: 1, embers: 1 };
  const EVENT_TIPS = { hoard: 1, loot: 1, shrine: 1, move: 1, spitter: 1, bomber: 1, powers: 1, relic: 1 };
  // 3.6: in a boss fight only the fight's own tips speak; the rest wait (unseen) for after it
  const BOSS_TIPS = { powers: 1, move: 1, break: 1 };
  const quiet = () => { try { return !!(G.director && G.director.quiet && G.director.quiet()); } catch (e) { return false; } };

  function seen() { const S = G.S; S.seen = S.seen || {}; S.seen.tips = S.seen.tips || {}; return S.seen; }
  const veteran = S => S.clicks > 60 || S.ascensions > 0 || S.st.bossKills > 0 || S.maxDepth > 0 || S.goldTotal > 5000 || !!S.lastRun || !!S.founders || (S.st.sieges | 0) > 1;
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
    // 4.0: the first cracked pip says what Integrity is
    G.on('pip', (d, pips, why, kind) => { if (kind === 'lost' && !active() && !seen().tips.pipLost) showTip({ id: 'pipLost', text: 'tip_pipLost' }); });
    G.on('potion', () => { if (!active() && !seen().tips.potion && !G.R.boss) showTip({ id: 'potion', text: 'tip_potion' }); });
    window.addEventListener('resize', () => place(true));
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
    else if (reward) { G.addGold(reward, 'tutorial'); G.UI.toast(esc(t('tu_reward', G.fmt(reward) + ' ' + t('gold').toLowerCase())), 'ach', 'ic_coin', { k: 'gold', it: reward }); }
    else { G.S.eggs += 1; G.UI.toast(esc(t('tu_reward', '1 ' + t('eggs').toLowerCase())), 'ach', 'ic_egg'); }
    S.tut = i + 1;
    while (active() && STEPS[S.tut].skip && STEPS[S.tut].skip(S)) S.tut++;
    // the welcome pack kills plenty before this step comes up, so count from here
    if (active() && STEPS[S.tut].id === 'mobs') seen().tutK = S.hero.kills;
    if (!active()) S.tut = -1;
    if (G.Audio) G.Audio.achievement();
  }

  // (3.6: the arrow's target is looked up four times a second, not on every update: each look reads the layout)
  let pointT = 0, pointK = '';
  const pointDue = () => { const now = performance.now(); if (lastKey !== pointK || now - pointT >= 240) { pointK = lastKey; pointT = now; return true; } return false; };
  // Called ~8 times a second from UI.update
  Tut.update = function () {
    const S = G.S;
    // in town only the steps and tips about the town speak; the field's other steps point the way back (FIELD)
    const inTown = !!(G.R && G.R.town);
    if (inTown) {
      const st = active() && STEPS[S.tut];
      if (st && !st.town) { render(st.id + ':town', t('tu_toField') + ' ' + t(val(st.text, S)), t('tu_step', S.tut + 1, STEPS.length), st.manual); if (pointDue()) point(P.el('#btnTown')); return; }
      if (!st && tip && !TOWN_TIPS[tip.id]) { tip = null; hide(); return; }
    }
    const busy = !$('#intro').hidden || !$('#modal').hidden || !$('#perks').hidden; // a level-up choice is on screen
    // 4.0: a run screen (js/run_ui.js) covering the field: only a step about that very moment speaks, on top of it
    // (a step already done, the next one's moment up: that moment is what speaks)
    const st0 = active() && STEPS[S.tut], nx0 = active() && STEPS[S.tut + 1];
    const momentUp = !!((st0 && st0.wait && st0.wait(S)) || (st0 && st0.done && st0.done(S) && nx0 && nx0.wait && nx0.wait(S)));
    if (!busy && !momentUp && G.RunUI && G.RunUI.busy && G.RunUI.busy()) { hide(); return; }
    if (!S || !$('#coach') || busy) {
      hidePointer(); if (busy) $('#coach').hidden = true;
      // a step already done still finishes behind a level-up card; only a real window holds the clock back
      if (active() && S.hero && S.hero.cls) { const st = STEPS[S.tut]; if (st.done && st.done(S) && performance.now() - stepAt.t > (st.minT || 3500)) { complete(); return; } }
      if (!$('#modal').hidden || !$('#intro').hidden) stepAt.t += 120;
      return;
    }
    if (!S.hero || !S.hero.cls) { hide(); return; }
    // tips for things that come and go (a Hoarder, loot, a shrine, a boss move) may cut into the tutorial
    if (tip && G.R.boss && !BOSS_TIPS[tip.id]) { tip = null; hide(); }
    // (4.0: but never into a moment of the run the tutorial is about: the tip waits, unseen)
    if (tip && momentUp && !tip.top) { tip = null; hide(); }
    if (tip) {
      tipT -= 0.12;
      if (tipT <= 0 || (tip.until && tip.until(S))) { finishTip(); return; }
      if (pointDue()) point(tip.point ? tip.point() : null);
      return;
    }
    if (active()) {
      const st = STEPS[S.tut];
      if (stepAt.i !== S.tut) { stepAt.i = S.tut; stepAt.t = performance.now(); }
      const target = st.point ? val(st.point, S) : null;
      const inPanel = !!(target && target.el && target.el.closest('#panel'));
      // (a field tip may cut in, but not while a run screen holds the field: those moments are the tutorial's)
      const held = !!(G.runHeld && G.runHeld());
      const ev = !inPanel && !held && !momentUp && S.tut >= 3 && TIPS.find(tp => EVENT_TIPS[tp.id] && !seen().tips[tp.id] && (!G.R.boss || BOSS_TIPS[tp.id]) && tp.when(S));
      if (ev) { showTip(ev); return; }
      // (a step done while the next one's moment is already up gives way at once: the boss falls, the loot is out)
      const nx = STEPS[S.tut + 1];
      if (st.done && st.done(S) && nx && nx.wait && nx.wait(S)) { complete(); return; }
      if (st.skip && st.skip(S)) { S.tut++; if (!active()) S.tut = -1; return; }
      // a step that finishes on its own still stays up long enough to be read (a moment already lived: at once)
      if (st.done && st.done(S) && (st.wait ? !st.wait(S) : performance.now() - stepAt.t > (st.minT || 3500))) { complete(); return; }
      // (a moment of the run: its words over its screen; before it comes, what leads there, or nothing)
      const up = !!(st.wait && st.wait(S));
      if (st.wait && !up && typeof st.text !== 'function') { hide(); return; }
      if (up) stepShown = st.id;
      render(st.id + (up ? ':up' : ''), t(val(st.text, S)), t('tu_step', S.tut + 1, STEPS.length), st.manual, up);
      if (pointDue()) point(st.point ? val(st.point, S) : null);
      return;
    }
    if (G.Stage.busyCelebrating && G.Stage.busyCelebrating()) return; // don't talk over a big drop
    // the wall tip comes back for each new wall
    if (S.scar && S.scar.n >= 3 && seen().tips.wall && seen().wallD !== S.scar.d) { delete seen().tips.wall; seen().wallD = S.scar.d; }
    // (a big moment or a title card on the field: the tips that can wait, wait)
    const rest = performance.now() < nextTipAt || quiet() || !!(G.Stage.cardBusy && G.Stage.cardBusy());
    for (const tp of TIPS) {
      if (seen().tips[tp.id] || (inTown && !TOWN_TIPS[tp.id])) continue;
      if (G.R.boss && !BOSS_TIPS[tp.id]) continue;
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
    render('tip:' + tp.id, text, '', true, !!tp.top);
    point(tp.point ? tp.point() : null);
  }
  function finishTip() { if (tip) { seen().tips[tip.id] = 1; nextTipAt = performance.now() + TIP_GAP; } tip = null; hide(); }

  // ---------- Coach bubble & pointer ----------
  let lastKey = '';
  // on a touch screen the keyboard letters mean nothing: drop them from what the coach says
  const touch = typeof matchMedia !== 'undefined' && matchMedia('(hover: none)').matches;
  const untype = s => s.replace(/ ?\((?:or press )?[A-Z]\)/g, '').replace(/\b([ZXC]) (Smite|Ward|Mend)\b/g, '$2').replace(/ (?:or )?(?:with|press) [ZXCQRTEB]\b/g, '').replace(/ ?\((?:[ZXC] )?\d+ ?s\)/g, m => m.replace(/[ZXC] /, ''));
  function render(key, text, step, manual, top) {
    if (touch && typeof text === 'string') text = untype(text);
    const c = $('#coach');
    // (over a run screen it docks at the very top, clear of the cards)
    if (c.classList.contains('top') !== !!top) { c.classList.toggle('top', !!top); placedY = null; }
    const k = key + text + step + manual;
    if (k !== lastKey) {
      lastKey = k; shownT = performance.now();
      c.innerHTML = `<div class="guide">${img('p_buttonling', 5)}</div>
        <div class="say"><b>${esc(t('tu_guide'))}</b>${step ? `<small>${esc(step)}</small>` : ''}<p>${esc(text)}</p>
          <div class="acts">${manual ? `<button class="btn gold" data-ok>${esc(t('tu_ok'))}</button>` : ''}${active() ? `<button class="linkBtn" data-skip>${esc(t('tu_skip'))}</button>` : ''}</div></div>`;
      c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');
    }
    const was = c.hidden;
    c.hidden = false;
    place(was || lastKey === k && performance.now() - shownT < 50);
  }
  // The bubble sits above the meters by default and moves out of the way of what it points at, the Button (and the
  // party or the boss at it), the boss's bar, the toasts, the hold plate, a banner or a champion's card, and on a
  // desktop the level-up cards (3.6: on a wide field it docks to a side, not the middle; narrower on a phone).
  let aim = null, placedY = null, placedX = null, aimEl = null;
  function rectOf(sel) {
    const e = typeof sel === 'string' ? $(sel) : sel;
    if (!e || e.hidden || (e.offsetParent === null && getComputedStyle(e).position !== 'fixed')) return null;
    const r = e.getBoundingClientRect(); return r.width && r.height ? r : null;
  }
  // the boss's bar on the canvas: centred under whatever HUD box is over it (as js/stage.js lays it out)
  function bossBand(r) {
    const bb = G.R.boss && G.UI.bossBarRect ? G.UI.bossBarRect() : null;
    return bb ? { left: bb.left - 6, right: bb.right + 6, top: r.top, bottom: bb.bottom } : null;
  }
  let placeT = 0;
  function place(force) {
    const c = $('#coach'), w = $('#stageWrap');
    if (!c || c.hidden || !w) return;
    // (it reads the page's layout: a few times a second is plenty, unless what it says just changed)
    const now = performance.now();
    if (!force && now - placeT < 300) return;
    placeT = now;
    const r = w.getBoundingClientRect(), wide = r.width >= 700;
    const width = Math.round(wide ? Math.min(r.width - 20, 400) : Math.min(r.width - 12, 360));
    if (c._w !== width) { c._w = width; c.style.width = width + 'px'; }
    // (over a run screen: a slim strip along the top edge, as wide as the page allows, so it covers the screen's title only)
    if (c.classList.contains('top')) { const wt = Math.round(Math.min(window.innerWidth - 12, 620)), x = Math.round((window.innerWidth - wt) / 2); if (c._w !== wt) { c._w = wt; c.style.width = wt + 'px'; } c.style.left = x + 'px'; c.style.top = '4px'; placedX = x; placedY = 4; return; }
    const meters = document.querySelector('.hud.bottom');
    const bottom = meters ? meters.getBoundingClientRect().top : r.bottom;
    const h = c.offsetHeight;
    let top = r.top + 50;
    for (const sel of ['.hud.top .realm', '.hud.top .hudBtns']) { const q = rectOf(sel); if (q) top = Math.max(top, q.bottom + 6); }
    const band = bossBand(r);
    if (band) top = Math.max(top, band.bottom + 4);
    // (a phone's field is small: the bubble would rather sit over the panel below it than on the field's top)
    const low = window.innerHeight - h - 10;
    const ys = wide ? [Math.max(top, bottom - h - 10), top, low] : [Math.max(top, bottom - h - 10), low, top];
    const xs = wide ? [r.left + 10, r.right - width - 10, r.left + (r.width - width) / 2] : [r.left + (r.width - width) / 2];
    // what it keeps off: the target, the Button where the player keeps tapping, and whatever else is up
    const bp = G.UI.btnRect ? G.UI.btnRect(8) : null;
    const avoid = [bp, band];
    const ts = $('#toasts'); if (ts && ts.children.length) avoid.push(rectOf(ts));
    const hp = document.querySelector('#holdPlate:not(.away) .hpIn'); if (hp) avoid.push(hp.getBoundingClientRect());
    const bn = $('#banner'); if (bn && !bn.hidden && bn.firstElementChild) avoid.push(bn.firstElementChild.getBoundingClientRect());
    avoid.push(rectOf('#champCard'));
    if (G.UI.cardRect) avoid.push(G.UI.cardRect());
    if (wide) avoid.push(rectOf('#perks'));
    const hit = (a, x, y) => !!a && x < a.right && x + width > a.left && y < a.bottom && y + h > a.top;
    const clear = (x, y) => !hit(aim, x, y) && !avoid.some(a => hit(a, x, y));
    // what it points at is in the panel: keep the panel clear, even if the bubble has to cover part of the stage
    const panelAim = !!(aimEl && aimEl.closest('#panel'));
    const cand = [];
    ys.forEach(y => { if (!(panelAim && y === low)) xs.forEach(x => cand.push([x, y])); });
    let best = placedX !== null && cand.find(([x, y]) => x === placedX && y === placedY && clear(x, y));
    if (!best) best = cand.find(([x, y]) => clear(x, y));
    if (!best) best = cand.find(([x, y]) => !hit(aim, x, y) && !hit(bp, x, y));
    if (!best) best = cand[0];
    const [x, y] = best;
    if (y !== placedY || x !== placedX) shownT = performance.now();
    placedY = y; placedX = x;
    c.style.left = Math.round(x) + 'px'; c.style.top = Math.round(y) + 'px';
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
  function hide() { const c = $('#coach'); if (c) c.hidden = true; lastKey = ''; placedY = null; placedX = null; aim = null; hidePointer(); }

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
      // (4.0: the Run Setup; the boot already asked for it and waits for the intro to close)
      if (G.UI.newSiege && !(G.S.run && G.S.run.on)) setTimeout(() => G.UI.newSiege({ boot: 1 }), 500);
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
    // (4.0: the Siege's sheet: the loop first, then the meta, then the details)
    const rows = [['ic_coin', 1], ['ic_skull', 2], ['ic_star', 3], ['ic_bag', 6], ['ic_skull', 4], ['ic_heart', 7], ['ic_town', 8], [G.SPR.defs.rx_bag ? 'rx_bag' : 'ic_jackpot', 9], ['h_priest', 11], [G.SPR.defs.ic_ember ? 'ic_ember' : 'ic_fame', 12], ['ic_town', 13], ['ic_sword', 17], ['ic_skull', 16], ['ic_trophy', 19], ['ic_bolt', 15], ['h_rogue', 5], [G.SPR.defs.cs_bubble ? 'cs_bubble' : 'ic_coin', 18], ['ic_skull', 10], ['ic_jackpot', 14], ['ic_clock', 20], ['ic_gear', 21]];
    const html = `<div class="helpList">${rows.map(([ic, n]) => `<div class="helpRow">${img(ic, 3)}<div><b>${esc(t('help_' + n))}</b><p>${esc(t('help_' + n + 't'))}</p></div></div>`).join('')}</div>
      <div class="helpRow"><span></span><div><b>${esc(t('help_bars'))}</b><div class="helpBars">${[['ic_skull', 'tipClear'], ['ic_heart', 'tipHp'], ['ic_chest', 'tipChest'], ['ic_coin', 'tipCombo']].map(([ic, k]) => `<p>${img(ic, 2)} ${esc(t(k))}</p>`).join('')}</div></div></div>
      <p style="font-size:15px">${esc(t('keysHint'))}</p>`;
    G.UI.modal(t('help_title'), html, [
      { label: t('help_intro'), fn: () => Tut.intro() },
      { label: t('help_tut'), fn: () => { G.S.tut = 0; } },
      { label: t('close'), cls: 'gold' },
    ]);
  };
})(globalThis.G = globalThis.G || {});
