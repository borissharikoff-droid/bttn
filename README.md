# BTTN

A pixel-art incremental about a Button, the Horde that wants it broken, and you. Your Warden cuts through swarms of mobs in the style of Vampire Survivors, while you click the Button: every click spills gold and loot and calls lightning down on the Horde. Mobs burst into pieces and drop loot the way Path of Exile does, with label plates, beams and a sound for every tier, and the game goes on to bosses that fight back, lands with rules of their own, uniques and currency, timed Rifts to race your friends in, pets from an incubator, a skill constellation, and ascension for fame.

**What's new in 1.2 (Ready for friends) and 1.1 (The Horde): see [PATCHNOTES.md](PATCHNOTES.md)**, including the plan for the next patches.

## The setting

First, there was the Button. Nobody knows who put it in the Realm, but its glow can be seen from every land. Then the Horde came for its light: crabs from the shore, goblins from the meadows, spores, golems, yetis, watchers, fiends and void wraiths, crawling in from every side to break it. And when the Mad Button falls, the world behind it opens: a drowned library, a foundry of gears, burning wastes, a maze of mirrors, a citadel in the sky where the First Hand waits, and past it the Moon and the sea of stars. So the Button called a **Warden**, a hero to hold the line, dressed in whatever the Button spills out.

And then it called you. You sit on the other side of the glass. You are **the Hand**: every click spills gold and chests from the Button and brings lightning down on the mobs that got too close. Your Warden fights on their own; you are the help they get from outside the world.

Inspired by [Click the Button](https://store.steampowered.com/app/3946950/Click_the_Button/) (LoopCap, 2026). The art style is chunky 8×8 pixel art with a dark outline, in the spirit of Realm of the Mad God. All art is drawn from scratch in code (`js/sprites.js`); the project uses no third-party assets.

## Running it

- Open `index.html` in a browser. No server or build step is needed.
- Or open `dist/bttn.html`: a single file with the fonts and scripts already inlined. You can host it anywhere (GitHub Pages, itch.io) or just send it to someone.
- For GitHub Pages: Settings → Pages → Deploy from branch, repository root.

Progress is saved to `localStorage` every 15 seconds and when the tab closes. Settings has save export and import as a code.

## First session

New players get a short onboarding:

1. **Intro.** Four slides with a typewriter effect that tell the setting: the Button, the Horde, the Warden, the Hand. It can be skipped, and it ends with picking a class.
2. **Guided tutorial.** Buttonling, the guide, walks through 10 steps: click the button, open a chest, check the hero and their 4 slots, buy an upgrade, clear mobs, hire the garrison, beat the first boss, hatch a pet, and a closing look at the ladder. A gold arrow points at whatever needs pressing, whether that's on the stage (button, chest, mob, wisp) or in the panel (tab, upgrade row). The bubble moves out of the arrow's way on small screens. Each step pays a small reward the first time, and the tutorial can be skipped at any point.
3. **One-time tips.** After the tutorial, a short tip shows the first time a new mechanic appears: a wisp, a modified chest, a boss ready to fight, essence, an ability, enough shards to enchant, the first chance to ascend, a broken button, a stat potion.
4. **The ? button** (top right) opens "How to play": a summary of every system, plus buttons to replay the intro or the tutorial.

Existing saves skip the intro and tutorial automatically. On a new device, the "load cloud save?" prompt comes before the intro.

## Controls

| Action | Mouse / touch | Keyboard |
|---|---|---|
| Click the button | tap the button (multi-touch works) | Space / Enter |
| Open a chest | tap the chest | E opens the most valuable one |
| Call the boss | the skull above the button, or the ⚔ button | B |
| Hero ability | the button to the right above the meters | Q |
| Focus a mob | tap the mob (the Hand strikes it wherever it is) | — |
| Pick up loot | tap its label; the Warden gathers the rest | — |
| Shrine | tap it | — |
| Break a boss move | tap the boss while it winds up | Space |
| Open a Rift | the ◈ button by the clear bar, or the Rifts tab | — |
| Raise a fallen ally | tap them on the field or on the party bar | — |
| Fold the panel (phones) | ▾ next to the gold; any tab opens it again | — |
| Tabs | icons on the right | 1–0 |
| How to play | ? at the top right | — |

Settings has "hold the button to click" to spare your mouse.

## What the original has and what changed

Before building, I went through the original's Steam page, the [clickthebutton.wiki](https://clickthebutton.wiki/), full-playthrough guides and player reviews. The original's structure:

1. Button → a click gives money and fills the chest meter.
2. Chests → items in 6 rarities (Broken … Extraterrestrial), 5 items per rarity, all at the same value.
3. Money → upgrades and a skill tree (click branch, idle branch), plus a "merge" upgrade against lag.
4. A gacha machine with "cuties" (normal and golden), purely a collection.
5. 4 chest modifiers (Chromatic, Ghost, Lightning, Void), and a rebirth with a handful of permanent upgrades.
6. 15 achievements, 100% in 70–120 minutes.

The main complaints in reviews: the game is over in an hour and a half to two hours; modifiers are "the same boring multiplier"; every item of a rarity is worth the same; there are few permanent upgrades; and near the end the game "throws everything at you until your PC starts lagging".

How BTTN answers each complaint:

| Problem in the original | What BTTN does |
|---|---|
| Short game | Bosses and endless depths (15 lands of 5 zones each, each land with its own lord and three stars to earn), ascension with fame and a Hall of Fame, 67 achievements. In simulation a fast player (6 clicks a second, picking well) reaches the Mad Button at depth 40 in about 100 minutes; a real player takes several hours, with a long tail after that. |
| Modifiers are one multiplier | 8 modifiers with different mechanics: Golden (gold burst), Storm (lightning opens nearby chests), Ghost (double loot), Chromatic (best of three rolls), Frozen (crack it in 8 clicks, 3 items inside), Blazing (×5, but burns out in 6 seconds), Mimic (it bites; defeat it), Void (×10 essence). |
| Items of a rarity are all worth the same | 7 rarities × 6 items. Each has its own drop rate and value, plus a collection bonus with stars at 1, 10, 100, 1,000 and 10,000 copies. Duplicates are always useful. |
| Few permanent upgrades | 15 permanent upgrades bought with fame; the collection and pets never reset; each achievement gives +1% gold forever. |
| Late-game lag | The field holds a limited number of chests. Extras merge 3 → 1 into a higher-tier chest or are sold unopened. Particles, projectiles and heroes on the stage are capped too, and auto-clicks are counted in batches. |
| Cuties do nothing | Pets run around the button and actually help: auto-clicks, luck, boss damage, opening chests. Duplicates level them up (to 25), there are golden versions, and a legendary is guaranteed every 25 eggs. |

New systems the original didn't have:

- **The Horde.** Mobs stream in from every side, up to 600 on screen, and every half minute the Horde surges. Packs mix small fodder (a swarm sprite for each of the 13 lands), runners, spitters that hold at range and lob globs at the Button, bombers that blow up the pack around them when they die, slow armoured tanks, brutes, pairs of blue champions and named yellow rares with a modifier (Hasted, Stoneskin, Splitting, Frenzied), as in Path of Exile. Each kind has a weight, its share of a standard mob's HP, bite and rewards, so a swarm of fodder is worth as much as a few brutes and the economy stays balanced.
- **The crunch.** Every death breaks the mob's own sprite into pieces that fly, bounce and settle, and leaves a stain. Each land dies its own way: ice and stone shatter, fiends scatter embers, spores drift up, void wraiths dissolve. Champions and rares get hit-stop, a shockwave and screen shake; a slain boss explodes in slow motion and takes its swarm with it. Kill streaks call out Killing Spree, Rampage, Massacre and higher, and every death has a crunch sound, heavier for a pile.
- **Loot on the ground.** Every drop is rolled when it falls and arcs out of the body to where it died, with a label plate styled like a Path of Exile loot filter: green, blue, purple plates, an orange one with a beam for legendaries, red for mythics, red-on-white with a haloed beam for divines, brown for uniques. Each tier has its own landing sound, showers land one piece at a time with the best last, and one drop in 25 upgrades in mid-air. Tap a label to grab it, or the Warden gathers it. There is bad-luck protection (a legendary at least every 250 drops) and scripted early luck. Chests still spill from the Button itself; a full room pops its lowest chest instead of throwing loot away.
- **Currency.** Whetstones, Orbs of Flux, Ascent, Grace and Ruin drop from the Horde and change gear: a free enchant, rerolled affixes, an extra affix, blessed rolls, or a corruption gamble.
- **19 uniques** with fixed affixes and a rule of their own (Headhunter, Hellstring, Voidplate, the Last Button…), each from its own depth on, with a page in the Collection.
- **Lands with rules and events.** Each land changes how the Horde plays (Treasure Tides, Goblin Raids, Sporefall, Stoneskin, Blizzard, Watchful Eyes, Hellfire, Unraveling), then five more lands lie past the Mad Button (Sunken Library, Clockwork Foundry, Ember Wastes, Mirror Maze, Sky Citadel: Ink Storm, Assembly Line, Firestorm, Echoes, Thin Air), then the Moon (Low Gravity: the Horde floats in slower but twice as thick) and the Star Sea (Supernova: three times the bombers, +50% loot), and after depth 75 the lands come round again, corrupted, with more loot per cycle.
- **Zones and waves.** Every land is five named zones (the Shoreline runs Tide Pools, Wreck Cove, Salt Flats, Coral Maze, the Crab King's Throne), the last one its lord's. Each zone brings a new kind of mob, with its own name in every land, and is fought in three waves; the second and third open with champions and a rush.
- **Land stars and the world map.** Each land has three stars, kept forever: slay its lord, slay enough of its Horde, slay its lord within 20 seconds. Each star adds 2.5% damage and gold. Tap the land name for the world map: every land, its zones, your stars and kill counts.
- **Carnage.** Kills in quick succession build a streak; at 100, 300, 800 and 2,000 kills gold and XP go up by 10% each, and the streak lapses after 2.5 seconds without a kill. Events break up the flow: the Hoarder (a loot goblin that runs off in 16 seconds), four Shrines, and the Breach.
- **Bosses fight back.** Telegraphed Slam, Summon and Shield moves that the Hand breaks by tapping, which staggers the boss; lords enrage at 30%.
- **Rifts.** From the first lord on: a 90-second run at the level you choose, a bar to fill, then the Rift Guardian. Fast clears open up to six levels at once, and Rift loot drops at the Rift's depth.
- **The Hand.** A click calls lightning on the thickest part of the Horde near the Button, knocking it back.
- **The Warden.** One of 5 classes (knight, archer, wizard, rogue, cleric) guards the Button from the Horde. Everything equipped shows on the character: body armour in the item's colours, helmets (horned ones too), cloaks, shields, boots, crowns, amulets, halos, wings, and tomes, orbs and skulls floating at the shoulder. The same figure appears in the Character tab and next to every name on the ladder. The Warden breathes when idle, walks with a four-frame cycle, and has a move per weapon: a sword or scythe swings with a crescent trail, a dagger stabs, a bow is drawn with the arrow nocked, a staff or wand is raised and thrust out with a flash. Melee Wardens step out to meet the crowd and fall back to the Button. Levels come from kills. There are 4 slots: weapon, ability, armour, ring. The weapon type sets how the Warden fights: melee weapons wait for the Horde to come close and cleave the pack, bows and staves reach further, a staff explodes, a scythe sweeps four targets. Your class weapon type deals +50% damage. The ability is triggered with a button (or on its own) and has a cooldown: skull blast, heal, stasis, wings, starfall.
- **Loot-game gear.** Every item has a level (from the depth where it dropped), a rarity and 0–3 random affixes: damage, attack speed, crit, button toughness, gold, luck, XP, shards. Spares are scrapped into shards, and shards plus gold enchant gear up to +20. A single Power number shows how strong the hero is. Gear survives ascension, so each new run starts stronger.
- **Why the Warden matters.** The Warden is the engine of a run. Their kills fill the clear bar and drop loot, gold and XP, and every boss dies by their hand: clicks during a fight are the Warden's strikes. The Horde answers the Warden's strength: the flow of mobs scales with how fast the Warden can kill at this depth (shown as "Horde ×N" on the clear bar), so a stronger Warden faces a bigger Horde and clears lands, earns gold and levels up faster, while a weak one gets a trickle and "Warden weak here". From the second land on, bosses are real walls that need a Warden strong enough for the depth. The Character tab spells it out: Horde size, boss damage per click and per second, and how long this depth's boss would take.
- **The party.** From depth 5, then 12 and 20, a party slot opens: up to three companions fight beside the Warden, each of any class with its own gear from the shared bag. Classes have roles: a knight is a tank (draws most of the bites and shrugs off 30% of them), a cleric is a healer (mends whoever is worst off, the Button included, and makes the fallen get up three times faster), the rest deal damage. Companions hit for 40% of what a Warden with the same gear would (a cleric for 20%). Everyone has health: a unit that drops is down for 24 seconds, and each tap on them (on the field or on the party bar) takes 4 seconds off. When the Button breaks it is out for 12 seconds and clicks do nothing; if the whole party falls while it is broken, that is a wipe: back one depth (not in a Rift), the clear bar empties and the loot on the ground is lost. The Party tab shows everyone: tap a portrait to see and equip that member.
- **Bosses fight back.** A boss hits a party member or the Button every 2 seconds. Lords change phase at 66% and 33% of their health, bosses at 50%: the boss shrugs off everything for a moment, throws the Horde back, hits the whole party and attacks faster. New moves come with each phase (a barrage of three bolts among them), and a lord's last phase is its rage.
- **Invasions.** From depth 3, about every 7 minutes another world pours in for 90 seconds: the Lunar Invasion, the Cosmic Invasion, the Heavenly Crusade or the Abyssal Tide, each with its own sky, mobs and herald. The Horde is 1.8× thicker. Fill the invasion bar and its herald comes; slay it within its time for a shower of 10–14 items, a real shot at a unique and three orbs. Bosses wait until the invasion is over.
- **Levels and perks.** The Horde drops XP crystals that fly into the Warden, and a blue XP bar runs along the top of the stage. Every level offers three perks to choose from, Vampire Survivors style: Might, Frenzy, Multistrike, Cleave, Long Reach, Orbiting Blades, Holy Ground, Chain Lightning, Nova, Heavy Hand, Bulwark, Leech, Greed and Scavenger, each with several ranks and a visible effect. Perks build this run's Warden and reset on ascension; gear, fame and pets carry over. If you leave the choice alone it is made for you after 12 seconds (can be turned off). In simulation, picking perks well instead of taking whatever comes first saves about a fifth of the time to depth 40.
- **Perk evolutions.** A perk at its top rank plus the right gear worn turns into a golden card at the next level-up, as in Vampire Survivors: Blade Storm, Sanctuary, Supernova, Thunderstorm, Arrow Rain, Wrath of the Hand, Blood Pact, Midas Touch, Berserk, Titan and Bastion. Discoveries are permanent and fill a recipe book in the Collection, with a hint for each.
- **The Journey.** An ordered road of goals, always one on screen under the land name with a progress bar and a reward: 55 written steps, then it keeps going ten depths at a time. Each step gives +2% Warden damage for good. The Quests tab shows the current step and the next three.
- **Omen of the day and the daily bounty.** Every day the Horde gets a twist, the same for everyone (Blood Moon, Gold Rush, The Swarm, Champions' Day, Storm Day, Night of Giants, Fortune), and a bounty pays eggs and a chest for slaying 12,000 of today's Horde. A missed day pauses the daily login streak instead of resetting it.
- **Clearing the land.** Slain mobs fill the clear bar by their weight, and when it is full the land's boss arrives. If mobs reach the Button and break it, clearing progress drops by half.
- **The garrison.** 12 classes to hire (rogue, archer, wizard, priestess … summoner). They stand on the stage and shoot the button; every 10/25/50/100… of a class doubles its income.
- **Bosses and depths.** A boss has 30 seconds (a lord 45), fires bullet rings and brings its own swarm. The bar tells you how much of it the Warden would take down alone. A boss that gets away keeps most of the damage it took ("Wounded −N%"), heals back less after each try, and every failed try rallies the Warden (+15% damage on a boss, +20% on a lord, up to five tries); after three failures a tip explains the wall and points to ascension. A win opens the next depth (+8% to all gold) and drops chests, essence, potions and eggs. Every 5th boss is a land's lord.
- **Stat potions.** 8 stats (ATT, DEF, SPD, DEX, VIT, WIS, LIFE, MANA) with a cap, dropped by bosses. As in RotMG, they're lost when the hero "dies" (on ascension).
- **Combo, crits and MEGA clicks.** Fast clicking builds a combo up to ×3+, with crits, and every 25th click is a MEGA click once the Thunder Palm node is learned.
- **Wandering wisps.** Every 1–2 minutes a wisp flies by: Frenzy (gold ×7), Chest Rain, a sack of gold, Click Storm (×77) or a pet egg.
- **Quests and daily reward.** Three quests with a refresh timer, and a weekly login streak.
- **Offline progress.** The garrison keeps earning while you're away (50% of income by default, up to 4 hours; both can be raised), and the Warden keeps fighting: XP at a quarter of the active rate (up to 5 levels per return, with their perk picks waiting for you) and shards.
- **8 button skins** from achievements, and a secret Prince's Crown, a nod to the original's "The Prince and the Button" achievement.
- Keyboard controls, a phone layout, and synthesized chiptune (each land has its own theme).

## Project layout

```
index.html          page markup
css/style.css       UI in the style of dark stone panels and inventory slots
fonts/              Press Start 2P and Tiny5, OFL licence (the Cyrillic subsets are kept so player names on the ladder render)
js/util.js          number formatting, randomness, event bus
js/data.js          all content: rarities, items, garrison, upgrades, constellation, pets, lands, fame
js/i18n.js          interface strings
js/game.js          DOM-free logic: clicks, chests, bosses, gacha, quests, ascension, offline, saves
js/hero.js          the hero: classes, gear, affixes, enchanting, mobs, combat, power, ladder snapshot
js/ach.js           achievements
js/journey.js       the Journey road of goals, the Omen of the day, the daily bounty
js/world.js         DOM-free: loot on the ground, currency drops, uniques, land rules, the Hoarder, shrines, Breaches, Rifts, firsts, crowns and the feed
js/net.js           cloud save and shared ladder (claude.ai page database or your own server)
js/sprites.js       pixel art: sprites as strings plus the procedural button, chests and ground
js/doll.js          the Warden's paper doll: layered body, worn gear, poses for the animations
js/audio.js         sound and music on WebAudio
js/stage.js         the canvas scene: low resolution × integer scale, particles, text on top
js/ui.js            panels, lists, modals and toasts
js/tutorial.js      onboarding: intro, guided tutorial, one-time tips, the How to play sheet
js/main.js          startup, game loop, saving
server/             ladder server: Cloudflare Worker + D1, same snapshot checks
tools/sim.js        balance-simulation bot
tools/playtest.js   persona playtests: active, casual, idle and returning bots, engagement report (see RETENTION.md)
tools/bot.js        shared sandbox loader and shopping brain for the playtests
tools/build.js      builds the single-file versions in dist/ and the game logic for the server
tools/test-server.js  server tests on Node's built-in SQLite
tools/dev-server.js   local ladder server for development
tools/sprites.html  sheet of every sprite for checking the art
```

`js/game.js` and `js/hero.js` don't touch the DOM, so the same logic runs in Node for balance simulation and on the server.

## Balance

```
node tools/sim.js 180 6 -q    # 180 minutes of play by the bot, 6 clicks per second
```

The bot buys whatever pays back fastest, opens chests, fights bosses, hatches eggs and ascends when it gets stuck. The script prints a timeline of gold, income, depth, fame and first-time events. That's how I caught and removed several economy runaways: quest rewards feeding themselves, pets giving unbounded luck, and bosses falling behind income growth.

```
node tools/playtest.js all 4 120   # 4 player types × 4 seeds, 2 hours each (the returner plays a week)
```

The playtests measure engagement rather than economy: big moments per minute, the longest dry spells, first-time events, stalls and lost bosses for an active clicker, a casual player, an idle player and someone who comes back twice a day. Findings, competitor research and before/after numbers are in [RETENTION.md](RETENTION.md).

## Build

```
node tools/build.js
```

Builds `dist/bttn.html` (a self-contained page with fonts inlined), `dist/artifact.html` (the same without the `<html>`/`<body>` wrapper) and `server/src/game.js`.

## Multiplayer and the ladder

The Ladder tab has nine boards (depth, power, best Rift, today's Rift, land stars, uniques, the Mad Button race, lord crowns and firsts), a feed of everyone's big moments, rival notices, and a share line for the group chat; progress is saved to the cloud. In the version published on claude.ai, invite each friend **by email as Editor** and keep link sharing off: while "Anyone with the link" is on, even invited friends can only watch. Friends open the link signed in to claude.ai; each can only write their own ladder row, and the owner can remove any row. For your own site there's a server in `server/` (instructions in `server/README.md`).

The plan for a fair ladder, seasons, a world boss, an arena and guilds is in [MULTIPLAYER.md](MULTIPLAYER.md). The code is already prepared for it: the logic runs without a browser, randomness is reproducible from a seed (`SEED=42 node tools/sim.js 8` gives the same result every time), and `G.ladderSnapshot()` returns a snapshot of the hero.

## Font licences

Press Start 2P (CodeMan38) and Tiny5 (Stefan Schmidt) are distributed under the SIL Open Font License 1.1; the licence text is in `fonts/OFL.txt`.
