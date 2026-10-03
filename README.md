# BTTN

A pixel-art incremental about a Button, the Horde that wants it broken, and you. Your Warden and party cut through swarms of mobs in the style of Vampire Survivors while you click the Button for gold, loot and lightning. Loot drops the way it does in Path of Exile, and there are bosses that fight back, lands with their own rules, uniques and currency, a Town, timed Rifts to race your friends in, pets, a skill constellation, and ascension for fame.

Changes by version: [PATCHNOTES.md](PATCHNOTES.md).

## The setting

First there was the Button, its glow seen from every land. Then the Horde came for its light: crabs, goblins, spores, golems, yetis, watchers, fiends and void wraiths. Past the Mad Button the world opens further: a drowned library, a foundry of gears, burning wastes, a maze of mirrors, a citadel in the sky, and then the Moon and the sea of stars. The Button called a **Warden** to hold the line, dressed in whatever it spills out.

And it called you: **the Hand**, on the other side of the glass. Your clicks spill gold and chests and bring lightning down on the mobs that got too close.

Inspired by [Click the Button](https://store.steampowered.com/app/3946950/Click_the_Button/) (LoopCap, 2026). Chunky 8×8 pixel art with a dark outline, in the spirit of Realm of the Mad God, all drawn in code (`js/sprites.js`); no third-party assets.

## Running it

- Open `index.html` in a browser. No server or build step is needed.
- Or open `dist/bttn.html`: a single file with fonts and scripts inlined, to host anywhere (GitHub Pages, itch.io) or send to someone.
- For GitHub Pages: Settings → Pages → Deploy from branch, repository root.

Progress is saved to `localStorage` every 15 seconds and when the tab closes. Settings can export and import a save as a code.

## First session

1. **Intro:** four skippable slides on the setting, ending with picking a class.
2. **Guided tutorial:** Buttonling walks through 10 steps (button, chest, hero, upgrade, mobs, garrison, first boss, pet, ladder), with a gold arrow on whatever to press and a small reward per step. Skippable.
3. **One-time tips** the first time a new mechanic appears.
4. **The ? button** (top right) opens "How to play" and can replay the intro or tutorial.

Existing saves skip the intro and tutorial. On a new device, the "load cloud save?" prompt comes first.

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
| Break a boss move | tap the glowing weak point beside the boss while it winds up | Z (Smite) |
| Torment | − / + under the land name | — |
| Town (every page but Upgrades) | TOWN at the top right, or Town in the panel; tap a building | T, Esc to leave |
| Smite / Ward / Mend | the three buttons right of the Button bar | Z / X / C |
| Open a Rift | the ◈ button by the clear bar, or the Rift Gate in town | — |
| Raise a fallen ally | tap them on the field or on the party bar | — |
| Fold the panel (phones) | ▾ next to the gold | — |
| Lucky Spin | tap the slot machine when it pops up | R |
| How to play | ? at the top right | — |

Holding the Button clicks once a second; **Steady Hand** takes it up to 10. Holding can be turned off in Settings.

## What the original has and what changed

The original (from its Steam page, [clickthebutton.wiki](https://clickthebutton.wiki/), guides and reviews): a button that gives money and fills a chest meter; items in 6 rarities, all of a rarity worth the same; upgrades and a skill tree; a gacha of "cuties" that do nothing; 4 chest modifiers and a small rebirth; 15 achievements, 100% in 70–120 minutes. Reviews complain it is short, the modifiers are one multiplier, there are few permanent upgrades, and the end lags.

| Problem in the original | What BTTN does |
|---|---|
| Short game | Bosses and endless depths (15 lands of 5 zones, each with a lord and three stars), ascension with fame, 67 achievements. A fast simulated player reaches the Mad Button at depth 40 in about 100 minutes; a real player takes several hours. |
| Modifiers are one multiplier | 8 modifiers with different mechanics: Golden, Storm, Ghost, Chromatic, Frozen, Blazing, Mimic, Void. |
| Items of a rarity are all worth the same | 7 rarities × 6 items, each with its own drop rate, value and collection stars at 1, 10, 100, 1,000 and 10,000 copies. |
| Few permanent upgrades | 15 fame upgrades; the collection and pets never reset; each achievement gives +1% gold forever. |
| Late-game lag | Capped chests (extras merge 3 → 1 or are sold), capped particles and projectiles, auto-clicks counted in batches. |
| Cuties do nothing | Pets help (auto-clicks, luck, boss damage, opening chests), level up to 25, have golden versions, and a legendary is guaranteed every 25 eggs. |

New systems:

- **The Horde:** packs of fodder, runners, spitters, bombers, tanks, brutes, champions and named rares with modifiers, weighted so the economy stays balanced. Every death shatters the sprite, each land in its own way.
- **Loot and currency:** Path of Exile-style label plates and beams per tier, bad-luck protection, five orbs that change gear, and 19 uniques with a rule of their own.
- **Lands, zones and stars:** each land has a rule, five named zones fought in three waves, a lord, and three stars kept forever. After depth 75 the lands return corrupted. Tap the land name for the world map.
- **The Warden and the party:** 5 classes, 4 gear slots, a weapon type that sets how they fight, and gear that shows on the character. Up to three companions with roles (tank, healer, damage); everyone can fall, and a broken Button plus a fallen party is a wipe. The Horde scales with how fast the Warden kills.
- **Gear:** item level, rarity, 0–3 affixes, enchanting to +20 with shards, a Power number, and it survives ascension. The Town's Forge has EQUIP BEST.
- **Bosses:** telegraphed moves with weak points, DOOM, phases, enrage, affixes and Torment 0–10. A boss that gets away stays wounded and rallies the Warden. Every 5th boss is a lord.
- **Rifts:** 90-second runs at a chosen level, then the Rift Guardian.
- **Events:** sudden events about every minute, invasions from depth 3, the Hoarder, Shrines, the Breach, wisps, Carnage streaks and the JACKPOT.
- **Chests:** little chests from the Horde, room for up to 200, and Looters that open them.
- **Levels and perks:** XP crystals, three perk cards per level, and perk evolutions recorded in the Collection.
- **Goals:** the Journey (55 written steps, then ten depths at a time), quests, the Omen of the day, a daily bounty and a login streak.
- **Also:** the garrison (12 classes), stat potions, combo, crits and MEGA clicks, offline progress, 8 button skins and a secret Prince's Crown, keyboard controls, a phone layout and chiptune music per land.

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

`js/game.js` and `js/hero.js` don't touch the DOM, so the same logic runs in Node for simulation and on the server.

## Balance

```
node tools/sim.js 180 6 -q    # 180 minutes of play by the bot, 6 clicks per second
```

The bot buys whatever pays back fastest, opens chests, fights bosses, hatches eggs and ascends when stuck, and prints a timeline of gold, income, depth, fame and first-time events.

```
node tools/playtest.js all 4 120   # 4 player types × 4 seeds, 2 hours each (the returner plays a week)
```

The playtests measure engagement (big moments per minute, dry spells, stalls, lost bosses) for an active, casual, idle and returning player. Findings are in [RETENTION.md](RETENTION.md).

## Build

```
node tools/build.js
```

Builds `dist/bttn.html` (self-contained, fonts inlined), `dist/artifact.html` (the same without the `<html>`/`<body>` wrapper) and `server/src/game.js`.

## Multiplayer and the ladder

The Ladder (at the Tavern) has nine boards (depth, power, best Rift, today's Rift, land stars, uniques, the Mad Button race, lord crowns and firsts), a feed of big moments, rival notices and a share line; progress is saved to the cloud. On claude.ai, invite each friend **by email as Editor** and keep link sharing off: while "Anyone with the link" is on, even invited friends can only watch. Each friend can only write their own row; the owner can remove any row. For your own site there's a server in `server/` (see `server/README.md`).

Plans for seasons, a world boss, an arena and guilds are in [MULTIPLAYER.md](MULTIPLAYER.md). The logic runs without a browser, randomness is reproducible from a seed (`SEED=42 node tools/sim.js 8` gives the same result every time), and `G.ladderSnapshot()` returns a snapshot of the hero.

## Font licences

Press Start 2P (CodeMan38) and Tiny5 (Stefan Schmidt) are distributed under the SIL Open Font License 1.1; the licence text is in `fonts/OFL.txt`.

## Hosting it

- **GitHub Pages:** Settings → Pages → Deploy from a branch → this branch, folder `/docs`.
- **Railway** (or any Node host): New Project → Deploy from GitHub repo → this repo and branch. `railway.json` and `npm start` run `deploy/serve.js`, which serves `docs/index.html` on `$PORT` (health check at `/health`). Then Settings → Networking → Generate Domain.

On a public host, saves stay in the player's browser. The friends ladder and cloud saves work only in the claude.ai artifact.

## Analytics and the admin dashboard

On the public host (deploy/serve.js) the game sends anonymous play events to `/api/ev` (js/analytics.js). They are
stored as NDJSON files in `$DATA_DIR` (a Railway volume mounted at `/data`) and folded into memory at boot.

- Dashboard: `https://<host>/admin`. The token is the `ADMIN_TOKEN` variable of the service (Railway → Variables).
- Variables: `ADMIN_TOKEN` (required for the dashboard), `DATA_DIR` (default `./data`), `ANALYTICS_SALT` (hashing IPs
  for counting, never stored raw), `KEEP_DAYS` (default 400).
- Tag links with `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`; the dashboard's link builder makes them.
- Players can turn it off in Settings; Global Privacy Control turns it off too. It never runs on claude.ai.
