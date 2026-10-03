# BTTN — Game Design Document

Living document. Version 3.3 (October 2026). Patch history: [PATCHNOTES.md](PATCHNOTES.md).

## 1. Vision

**A Button, a Horde that wants it broken, and you: the Hand on the other side of the glass.**

BTTN is a clicker in which every click matters on a battlefield. The idle core is a pixel-art horde defense: your party
holds a glowing Button against thousands of mobs while you click, hold, and choose builds. The loot comes in the style of
Path of Exile, and runs work like a roguelite: when the Button falls, the run ends and you come back stronger.

- **Platform:** a single HTML file. It is played in the browser on desktop and phone, as a claude.ai artifact (with the friends
  ladder and cloud saves) or on a public host (Railway or GitHub Pages; saves stay in the browser).
- **Session shape:** one session is 3–30 minutes. Long-term play runs over weeks through fame, the town, the collection,
  relics and the ladder.
- **Audience:** fans of idle and incremental games, players of Vampire Survivors, RotMG and PoE, and friends competing on a shared ladder.

## 2. Pillars

1. **Every click lands on something.** Clicks and holds drive gold, chests, lightning and the Overdrive. Holding the
   Button is a first-class way to play.
2. **Pressure you can read.** The Horde visibly threatens the Button. You see what is coming (incoming arrows, a boss
   wind-up, DOOM) and have an answer to it (powers, weak points, the tank's line).
3. **Loot worth screaming about.** Rarity tiers come with beams and sounds. Uniques change the rules, relics are the
   rarest drop in the game, and the jackpot is about one kill in two million.
4. **Runs that teach and pay.** A lost run is never wasted: fame, the town, gear and the collection carry over. Each new
   run should feel different.
5. **Short words, big feedback.** Text is short and the game shows rather than tells. It should be readable on a phone.

## 3. Core loops

- **Second to second.** Click or hold the Button. That gives gold, fills the chest bar and calls lightning down on nearby
  mobs. The party fights by itself, and you tap targets, loot labels, bubbles, portals and boss weak points.
- **Minute to minute.**
  - Kills fill the clear bar, then a boss comes. Beating it moves you one depth deeper; every 5th depth is a lord.
  - Level-ups offer one of three perks, and every 5 levels gives a rank.
  - Events, the Lucky Spin and the Overdrive break the rhythm.
- **Session.**
  - Push through lands, going into town to gear up and build up between fights.
  - A wipe ends the run: **THE BUTTON FELL** awards fame, and the next run starts at a checkpoint with a choice of
    one of three **blessings** for the run.
- **Meta (days and weeks).**
  - Spend fame in the Hall of Fame, build the town to 55/55, and chase uniques, relics, land stars and achievements.
  - Climb the friends ladder and the daily Rift.

## 4. Systems

### 4.1 The Button and the Hand

- A click gives gold, chest progress and a lightning strike near the Button. Fast clicks build a combo.
- A held Button clicks once a second, and Steady Hand raises that to 10. No more than 10 clicks a second count.
- The Hand's powers are Smite (Z), Ward (X) and Mend (C).
- **Overdrive (V)** fills by fighting. When used, it gives 8 seconds of lightning novas over the whole field, ×2 party
  attack speed and ×3 gold.
- When the Button breaks, clicks do nothing for 12 seconds. If the party also falls, it is a wipe.

### 4.2 Warden and party

- **Classes:** Knight (tank), Cleric (healer), Archer, Wizard and Rogue (damage). Each gets +50% from its own weapon type.
- Companion slots open at depths 3, 12 and 20. Roles are visible on the field: the tank holds a line of mobs, the
  healer runs to whoever is hurt, and damage dealers flank.
- Each level gives +5% damage and health, and one perk choice (33 perks plus evolutions that need a matching item). Ranks
  every 5 levels add an extra target, attack speed, crit, health or damage.

### 4.3 The Horde

- **Mob types:** small fry, brutes, champions, rares, runners, spitters, bombers and tanks. From land 2 on, warded,
  charger, mender and caller packs join; Hoarders and goblins also appear.
- Bites have a floor relative to the Button's health, so pressure stays even when you overpower a depth.
- **Land Champions:** once per land per run, a named mini-boss with a rule of its own (splits, steals, burrows, shields,
  rages, hides among decoys, carries a bomb, summons). Kill it within a minute for guaranteed good loot.
- Big mobs take 1.8 times as long to kill. Arrows mark dangerous packs as they come in.

### 4.4 Bosses and lords

- **Fight rules:**
  - A boss lasts 30 seconds, a lord 45.
  - Wind-ups have a weak point to tap.
  - DOOM (from land 2) must be warded or smitten.
  - When time runs out the boss ENRAGES.
- **Variety and scaling:**
  - Affixes appear from depth 9 and phases at each third of health.
  - The first two lords hit a third softer.
  - Torment 0–10 trades difficulty for rewards.

### 4.5 Lands

- There are 15 lands of 3 zones each (3.4; was 5), and each land has its own rule, lord and three stars. Corrupted cycles follow.
- A depth needs 11 clear-bar kills. A new run starts at the land at half your best depth.

### 4.6 Loot

- **Gear:** four slots, seven rarities that open by depth, affix tiers, and enchanting up to +20. Breaking gear down gives shards.
- **Orbs:** Whetstone, Flux, Ruin, Ascent and Grace. You can seal one affix against Flux.
- **Uniques:** 19, each with a rule of its own.
- **Relics:** 8, boss-only, about 1 boss in 600. They drop with a full cinematic and have pity protection.
- **The Gambler:** shards buy a mystery item of a chosen slot.
- **Chests:** they come in tiers and carry modifiers; Looters open them.

### 4.7 The town (hub)

- Every page lives in a building. The side panel keeps only Upgrades and Settings.
- **Buildings:** Forge, Enchanter and Gambler, Alchemist, Tavern (party, character, ladder), Barracks (Garrison),
  Museum, Quest board, Observatory, Hatchery, Temple (Hall of Fame) and Rift Gate.
- The town opens at any time except in a Rift, and the field waits meanwhile.
- Each building builds up five times (800 × 20^level gold) for bonuses that last forever.

### 4.8 Runs and fame

- **A fall:** fame worth 60% of an ascension, for the depth gained beyond the run's start.
- **Ascension** (from depth 15): full fame.
- **Hall of Fame:** 15 permanent upgrades.
- **Kept:** gear, the town, pets, the collection, relics, stars and fame.
- **Lost:** gold, Upgrades, the Garrison, the Constellation, potions, levels and perks.

### 4.9 Casino and events

- **Lucky Spin:** kills fill the meter. The machine pays gold, chests, Frenzy, XP or orbs, and 7-7-7 is the top prize.
- "?" bubbles give quick boosts, and crits in a row chain for extra damage.
- **Events** come about every minute:
  - stampede, gold fever, chest rain, goblins, meteors, crimson moon, ambush, flood, adrenaline;
  - Portal Storm, Warlord, High Stakes;
  - jackpot frenzy.
- Invasions arrive about every 7 minutes.
- **Rare surprises** (3.5, js/rare.js): the Lucky Merchant, secret lands, mythic pets, Free-Spin Fever, the Golden Horde,
  the Wishing Well, the Ghostly Gambler, Shooting Stars, the Goblin King and the Button of Legends, with pity timers and a codex.

### 4.10 Social

- **Friends ladder** (claude.ai only): nine boards, a feed of big moments, rivals, a daily Rift and seasons. Season 2 is the current one.

## 5. Economy targets

| Metric | Target | Now (playtest bot) |
|---|---|---|
| Time to depth 5 (active) | 3–5 min | 3.7 |
| Time to depth 20 (casual, first run) | ≤ 25 min | 24.4 |
| Button under 50% (casual / active) | 15–25% of the time | 15.5% / 11% |
| Land Champions slain (casual, idle) | most | 3/3, 3/3 |
| A big moment | ≥ 4 per min early, ≥ 2 later | 9 / 5 |
| A whole town (55/55) | weeks, across ascensions | — |
| Relic | about 1 per 600 bosses, with pity | ✓ |

## 6. UX rules

- One message, one place: big moments are queued, never stacked.
- A phone is the default screen: windows go full screen, nothing covers the Button, and no keyboard letters show on touch.
- Every lock says how to open it, and every loss says why it happened.
- Nothing runs behind a window you are reading.

## 7. Roadmap

### 3.3 — Polish & Runs (this patch)

1. ✅ **Run blessings.** A new run starts with a choice of 1 of 3 blessings that hold for the whole run (upside, or upside
   with a twist), so each run plays differently.
2. ✅ **Land Champions.** One mini-boss per land per run, each with its own mechanic (8 rules across 15 champions) and
   guaranteed good loot: a moment in every land. Logic in `js/champions.js`, show in `js/champions_fx.js`.
3. ✅ **Polish:**
   - floating center texts are queued instead of stacked;
   - "SO CLOSE" for a two-of-a-kind miss on the Lucky Spin;
   - "Buy all" for Upgrades;
   - an affordable glow on Upgrades;
   - a gentler first-run level-up pace.
4. ✅ Tests, patch notes, build, publish (artifact + Railway).

### 3.4 — Momentum (done)

- Lands of three zones, the march between zones, Hand Spells (13 spells + land flourishes), 75 new mob looks and
  five new kinds, a denser Horde, the HOLD SPACE plate, the team always on show.

### Next: measure, then grow (now)

- ✅ **Analytics** on the public host: anonymous events (first-touch UTM source / referrer, device and in-app browser,
  country from the time zone, language), the funnel (intro → class → first press → hold → boss → tutorial → land 2 →
  depth 5 → 5 min → land 3 → 15 min → recruit → fall → came back), retention cohorts, drop-off, errors. Off with Global
  Privacy Control or Settings → Anonymous play stats. No IPs or saves are stored.
- ✅ **Admin dashboard** at `/admin` (token: Railway → bttn → Variables → `ADMIN_TOKEN`): sources ranked by a quality
  score, campaigns, funnel, cohorts, devices, countries, play hours, game stats, live players, CSV export, and a
  tracking-link builder.
- **Traffic plan.** Tag every post and ad (`?utm_source=tiktok&utm_medium=video&utm_campaign=…&utm_content=clip_3`).
  Start small on 3–4 channels (TikTok/Reels/Shorts clips of meteors and a breaking Button, Reddit r/incremental_games
  and r/WebGames, Telegram game channels, itch.io/CrazyGames/Poki listings). After ~100 visitors a source, keep the
  ones with the best quality score and day-1 return, cut the rest, and fix the biggest funnel drop before scaling.
- **Targets to scale paid traffic:** picked a class ≥ 85%, played 5 min ≥ 40%, day-1 return ≥ 20%, day-7 ≥ 8%.

### 3.5 — Builds

- Class talents at ranks: a choice of two.
- Item sets (2 and 4 pieces).
- A Hall of Fame tree with rule-changing keystones.

### 3.6 — Friends

- Daily seeded challenge run on the ladder.
- Ghost runs of friends.
- Season rewards.

## 8. Tech

- Vanilla JS. The game logic files are DOM-free and also run under Node:
  - util, data, game, hero, ach, journey, world, events;
  - perks2, casino, relic, overdrive, champions, blessings.
- Logic talks to the rest through events (`G.on`/`G.emit`) and hooks (`G.hook`: hit, kill, bite, tick, stats, click).
- `tools/build.js` produces `dist/bttn.html`, `dist/artifact.html`, `docs/index.html` and the ladder server's game logic.
- Headless persona playtests (`tools/playtest.js`), regression suites, and Playwright checks on desktop and phone.
