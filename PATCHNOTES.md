# BTTN 1.2 — Ready for friends

The patch that gets BTTN ready to hand to friends. Six audits went over the game the way a friend would meet it: a new player's first 15 minutes on desktop, three phones (portrait, small, landscape), a bug hunt with thousands of simulated hours, pacing over days of casual play, playing together on the ladder, and every word on screen. Each finding was then checked again by a second, skeptical pass. Everything below was confirmed and fixed.

## Crashes and lost progress

- **The game no longer freezes** after the tab sits in the background for 20–60 seconds. Catching up drew too many shots and broke the render loop for good. The loop now books the next frame first and survives any drawing error.
- **Spitter globs that break the Button** no longer crash the game (1 in 7 ten-minute runs hit it with a slightly weak Warden).
- **Cloud save:** tapping outside the "Cloud save" prompt used to leave a new device with no Warden and stop syncing for the session. The prompt now only closes with its buttons. It shows what each side holds ("Cloud: Knight lv 42, depth 21 · This browser: a new game"). Keeping the weaker one asks first, and the replaced cloud save is kept as a backup you can restore in Settings.
- **Losing a Rift** no longer halves the campaign's clear bar.

## Playing with friends

- **How to invite, in the game.** The owner sees an "Invite your friends" box on the Ladder tab: invite each friend by email as Editor, and keep "Anyone with the link" off, because while the public link is on, invited friends can only watch. Friends who can only watch are told exactly that, not a raw network error.
- **Honest status lines:** "Sign in to claude.ai to join the ladder", "Can't reach the ladder right now: your progress is safe", "Cloud save: 12s ago · ladder: not yet". The game only says online once the ladder has answered.
- **Cheats from the console are caught:** a depth the Warden's gear could never reach is rejected (the weakest honest player measured is a million times above the line). The crowns board no longer draws thousands of empty lords for a forged entry. The owner can remove any row from the ladder from its inspect window. Each friend can only ever write their own row.
- **Boards without zeros:** the Rift, Land stars and Uniques boards only rank people who have started on them ("Nobody on this board yet. Be the first!").
- **Rows show when that friend was last seen**, and fade after two weeks away.
- **The brag line** opens in a box you can copy from, says gear score like the boards do, leaves out zeros, and ends with the game's link and "ask me for an invite".
- New players are named after the first word of their account name, and told so once ("You're on the ladder as Anna. Rename in Character").

## Pacing

Casual and idle players spent 40–45% of their time losing boss fights, mostly at lords that took 4 to 9 tries. Regular bosses could turn into walls that healed back from 12% to 39% after every loss.

- **Lords have 3× a boss's health, not 4×.**
- **Every boss rallies the Warden now,** not just lords: +15% damage on it per failed try (+20% on a lord), up to five. A boss that escapes heals back less after each try, so a wall always gives way to someone who keeps at it.
- **The boss bar says how the fight would go:** "Fight Sand Crab to reach Salt Flats · Warden alone: 60%". The Hunt (auto-boss) waits for a fight the Warden can win, or tries again after 90 seconds so Rally can build.
- **Rested:** back after 4 hours or more, your first boss fight hits 40% harder.
- **Uniques have bad-luck protection:** the 25th chance in a row without one is a sure thing, and half the time it's one you don't have yet. "Find 4 different uniques" no longer blocks the Journey for 30–50 minutes.
- **The arena is never empty:** with fewer than 20 mobs on the field the next pack comes right away. This matters for Wizards and Archers at a new depth, who used to face a median of 0–8 mobs.
- **Spitters spit** from the moment they're in range instead of dying before their first glob.
- **Slaughter stars are reachable:** 12,000 kills in the Shoreline up to 26,400 in the Sky Citadel, instead of 10,000 up to 70,000.
- The wall tip comes back for each new wall, bosses included.

## Screens and controls

- **All 12 tabs fit on screen** on desktop and every phone. The Ladder and Settings tabs were off the edge, even on desktop.
- **Phones on their side** get the stage and panel side by side, and the intro fits.
- **Level-up cards on phones** come up as a sheet from the bottom, so the Button and the HUD stay clear. Their timer stops while another window covers them.
- **Switching tabs during a level-up** no longer wipes the cards and leaves a stray number on screen.
- **Title cards take turns** instead of piling up: land, zone, wave, land star and event cards queue, long lines shrink to fit, and the heap counter moved below the Button.
- **During a boss fight** the boss bar has the top of the stage; the goal box, omen and toasts step aside.
- **The coach** no longer covers the panel row it points at, steps that finish on their own stay up long enough to read, and event tips don't cut into panel steps.
- **Toasts on phones** sit at the top, one at a time, clear of the Fight button.
- **Tapping loot in the bag** scrolls its details into view.
- **The Constellation:** the details and Learn button come first, affordable stars glow, and on touch screens only the Learn button buys.
- **iPhones** don't zoom in when you type your Warden's name.
- **Bigger touch targets** for the boss buttons, pickers and HUD icons.
- **In a Rift** the HUD names the Rift's land.
- **Gold per second** counts everything you earn (averaged over 10 s), not just the garrison.
- The land strip has a dark plate so it reads on bright ground. The omen line says what today's omen does. Phones show the depth next to the zone name.

## Words

- Depth numbers now agree everywhere ("Reach depth 5" means the depth the HUD shows).
- The Ascension screen says what you keep (gear, orbs, uniques, land stars, collection, pets, Rift levels) and what resets (including your Warden's level and perks, and the class). It also says that fame gives Warden damage as well as gold.
- "Hero" meant both the Warden and the garrison. Now it's the Warden or the garrison ("Garrison income", "Warden name", "hire a Rogue for the garrison").
- Shards have their own icon instead of essence's; fame is written as fame, not a ★.
- The Swift star says it needs a fresh try. Corrupted lands read "Corrupted Shoreline", not "Corrupted Shoreline 1" or "Corrupted The Crab King". Plurals fixed, jargon replaced ("Start each run with 1K gold, ×10 per level"; the Rift tab says easy, a fair fight or hard).
- The help page explains runners, spitters, bombers, tanks and Carnage. A one-time tip explains Carnage when it first kicks in.

## Measured

`node tools/playtest.js all 3 90`, 1.1 → 1.2 (medians of 3 seeds, 90 minutes):

| | Active | Casual | Idle | Returner (a week) |
|---|---|---|---|---|
| Mobs alive at once, median | 33 → **108** | 22 → **54** | 18 → **66** | 2 → **49** |
| Longest wait between big moments, 10–30 min | 184 → **86 s** | 290 → 289 s | 218 → **164 s** | 243 → 285 s |
| Time to depth 20 | 11.8 → **9.6 min** | 30.9 → 31.8 min | 57.7 → **36 min** | 31.3 → **18.3 min** |
| Time to depth 40 | 51.1 → **41.7 min** | — | — | 96.5 → **80.8 min** |
| Best depth after 90 min | 54 → 60 | 29 → **34** | 24 → **29** | 63 → 64 (d65 reached) |
| Uniques found (different ones) | 11 (7) → 26 (15) | 5 (2) → 7 (4) | 2 (2) → 9 (7) | 13 (6) → 24 (14) |

Tested with those bots, fresh regression checks for every fix (`/tmp` scripts: freezes, cloud save, Rift breaks, Rally, unique pity, ladder plausibility, Rested, names, the visible floor), the browser suites on desktop, three phone sizes and landscape, two devices online against the local server, and the server tests (15/15).

---

# BTTN 1.1 — The Horde

The Horde patch. The arena is never empty now: hundreds of mobs pour in from every side and die in heaps. Each land is a journey of five zones with its own mobs, five new lands wait past the Mad Button, and every land has three stars to earn for good.

## At a glance

- **A real horde.** Up to 600 mobs on screen, about 3× the kills per minute, the same gold and XP per second of play.
- **Four new kinds of mob,** each with its own silhouette and a name in every land: runners, spitters, bombers and tanks.
- **Zones.** Every land is five named zones, the last one its lord's. Each zone brings a new kind of mob and is fought in three waves.
- **Five new lands past the Mad Button** (depths 41–65): the Sunken Library, the Clockwork Foundry, the Ember Wastes, the Mirror Maze and the Sky Citadel, each with its own mobs, rule, ground, music, gore and lord, and a unique of its own.
- **Land stars.** Three per land, kept forever: slay the lord, slay enough of its Horde, slay the lord fast. Each one: +2.5% damage and gold. A new *Land stars* ladder board.
- **The world map.** Tap the land name: every land, its zones, your stars and what's left.
- **Carnage.** The kill streak pays: keep it going and gold and XP climb up to +40%.
- **Crunch.** Blood soaks into the ground and stays for a while, bombers go off in chains, heaps of kills stop the frame, the kill counter climbs with a bright tick that rises with the streak.

## The Horde, thicker

Before this patch the arena was empty most of the time: the Warden killed each pack the moment it walked into reach, so a median of 2 to 5 mobs were alive at once. Now:

- Fodder weighs a quarter of what it did and comes four times as many, so the gold, XP and clearing progress per second are the same, but the bodies are not. A pack is a leader and a long tail of 25 to 90 small fry that streams in from past the edge of the arena.
- Up to 600 mobs at once. Surges, Breaches and wave rushes fill the field from every side.
- Splash, chain lightning, blades, Holy Ground and Nova now cut through crowds, which is what they were for.
- Drop chances, leech, Sporeheart and the Hand's knock-back were rescaled to the new weights, so none of them got 4× stronger by accident.

## Four new kinds of mob

Each has one silhouette everywhere, so you learn it once, drawn in the colours of the land it's in and named after it (a Gull on the Shoreline, a Warg Pup in the Meadows, a Cinder Hound in the Ember Wastes):

| Kind | What it does | Answer |
|---|---|---|
| **Runner** | Twice as fast, comes in streams | Splash and reach |
| **Spitter** | Stops at range and lobs a glob at the Button every couple of seconds | Tap it: the Warden kills what you tap first |
| **Bomber** | Its fuse is lit. Killed in the crowd, it blows up the pack around it, and blasts chain. If it reaches the Button, it blows up on it | Kill it early, inside the pack |
| **Tank** | Slow, three brutes' worth of health, big loot | Focus it |

## Zones and waves

Every land is now five named zones instead of five numbered depths: the Shoreline runs Tide Pools, Wreck Cove, Salt Flats, Coral Maze and the Crab King's Throne. The HUD shows the land, five pips for its zones (the last one the lord's) and the zone's name.

- Each zone brings one more kind of mob: runners from the second zone, spitters from the third, bombers from the fourth, tanks in the lord's zone. A card announces the zone and its newcomer ("NEW: Spitting Clam").
- Each zone is fought in **three waves**. The clear bar has two notches; crossing one sends in a pair of champions and a rush from two sides.
- When the boss is ready, the bar says where it leads: "Fight Sand Crab to reach Salt Flats".

## Five new lands past the Mad Button

The Mad Button used to be the end of the road, after which the same lands came round again, corrupted. Now it opens the world behind it, depths 41 to 65. The corrupted cycles start after that, at depth 66.

| Land | Rule | Lord | Unique |
|---|---|---|---|
| **Sunken Library** | *Ink Storm*: spitters three times as often, +30% XP | The Drowned Archivist | *The Drowned Codex*: spitters and bombers die to any hit |
| **Clockwork Foundry** | *Assembly Line*: the Horde is 40% thicker, tanks three times as often | The Gear Tyrant | *Crown of the Gear Tyrant*: tanks, brutes and champions take double damage |
| **Ember Wastes** | *Firestorm*: bombers three times as often, their blasts twice as strong | The Ashen Colossus | *Ashbringer*: the Warden's kills burst into flame |
| **Mirror Maze** | *Echoes*: runners twice as often, big mobs shatter into shards | The Other Warden | *The Other Cloak*: one bite in three is turned back on the biter |
| **Sky Citadel** | *Thin Air*: champions and rares twice as often, loot +40% | The First Hand | *Palm of the First Hand*: every click calls three more bolts (only the First Hand and deep Rifts drop it) |

Each has its own fodder, champion and lord sprites, ground, decor, gore (ink, sparks, embers, glass, feathers), music and named zones. There are now 19 uniques, a new first to race for (*The First Hand*), and new achievements: *Past the Button*, *Hand to Hand*, three for land stars and one for a 2,000-kill streak.

## Land stars and the world map

Every land has three stars, kept forever, ascension included:

1. **Conquered:** slay its lord.
2. **Slaughter:** slay 10,000 of its Horde (more in later lands), counted across every visit.
3. **Swift:** slay its lord within 20 seconds.

Each star adds 2.5% damage and gold, up to +97.5% for all 39. Ascending now has one more reason: coming back stronger to take the Swift stars you couldn't. Tap the land name for the **world map**: every land with its rule, its zones as you've cleared them, kill counts and stars; lands you haven't reached are silhouettes. Friends can compare on the new **Land stars** ladder board.

## Carnage

The kill streak is no longer just a number. Keep killing without a 2.5-second pause and gold and XP go up: +10% at 100 kills, +20% at 300, +30% at 800, +40% at 2,000. The counter sits above the bars with a small bar to the next step; the callouts now go up to EXTINCTION, CATACLYSM and GODLIKE at 3,000, 6,000 and 10,000.

## Crunch

- **Blood that stays.** Splats are painted onto a layer over the ground that fades over about 20 seconds, instead of a short list of stains that vanished; a slaughter leaves the arena stained.
- **Bomber chains** with a flash of light, a shockwave and a small frame stop.
- **Heaps stop the frame.** A dozen kills in one frame shake the screen; forty or more stop it for a moment with a deep crunch. This used to fire on any five kills, which with the new Horde would have been all the time.
- **A bright tick** on top of the kill crunch that climbs in pitch with the Carnage step.
- Tanks break apart with a shockwave; spitters swell before they spit; bombers' fuses fizz faster as they close in.
- Fewer chunks per body when hundreds die at once, so the frame rate holds: 60 fps with 600 mobs on screen in a headless browser.

## Interface

- The land strip at the top: land name, its stars, five zone pips and the zone's name. Depth and boss sit on the line under it (hidden on phones to save room).
- The clear bar shows the wave and two notches.
- Title cards and callouts sit lower on phones, clear of the HUD; the kill counter moved from the top of the stage to just above the bars.
- New tips for the first spitter, the first bomber and the world map; two new help pages (lands, zones and stars; Carnage).
- Kill goals were scaled to the thicker Horde: the first Journey step is 300 kills, the daily bounty 12,000, kill quests four times as many.

## Measured

`node tools/playtest.js all 3 90`, 3 seeds per persona, 90 minutes each (the returner plays a week). "Before" is 1.0.

| | Active | Casual | Idle | Returner |
|---|---|---|---|---|
| Mobs alive at once, median · 90th percentile | 2 · 20 → **33 · 177** | 5 · 38 → **22 · 178** | 0 · 26 → **18 · 169** | → **2 · 146** |
| Kills per minute | 718 → **2,043** | 856 → **2,268** | 873 → **2,158** | → **2,032** |
| Big moments per minute, first 10 min | 8.6 → **9.0** | 4.2 → **4.9** | 4.4 → 4.3 | 4.7 → 4.7 |
| Time to depth 20 | 13.2 → **11.8 min** | 56.5 → **30.9 min** | 82.8 → **57.7 min** | 30.6 → 31.3 min |
| Time to depth 40 | 64.9 → **51.1 min** | — | — | 131 → **96.5 min** |
| Land stars after 90 min | 20 | 11 | 7 | 24 in a week |
| Button broken | 1 | 0 | 0 | 1 in a week |

"Before" crowd numbers come from a 30-minute run of 1.0 with the same bots. Medians of 3 seeds; the 1.0 columns for depth and moments are from its 4-seed, 2-hour runs.

What got worse: the active player's longest wait between big moments in minutes 10–30 (110 → 184 s) and the casual player's (211 → 290 s). Kill goals take longer now, and the extra speed through the depths comes mostly from land stars, which don't count as a moment after the first few. Worth watching in 1.2.

Tested with: the persona bots above, a render check at 13 depths with 600 mobs (60 fps, no errors), the browser suites from 1.0 on desktop and phone (onboarding, UI, loot, Rifts, bosses, ladder boards, migration from old saves, two devices online), the server tests (15/15), and the ladder verification and regression checks.


---

# BTTN 1.0 — Loot & Rifts

The release patch: the one to send to friends. Loot now drops the way it does in Path of Exile, every land plays by its own rule, bosses fight back, and there is an endgame to race each other in. What follows is what changed, why, and what's planned for the next patches.

Everything below was tested the way the rest of the game is: persona bots that play like an active clicker, a casual player, an idle player and someone who comes back twice a day (`node tools/playtest.js all 4 120`), a balance bot (`tools/sim.js`), browser runs on desktop and phone, and server-side checks of every new ladder field. The numbers are in [Measured](#measured) at the end.

## At a glance

- **Loot on the ground.** Every drop is rolled when it falls and wears a label plate in its rarity's colours; legendaries and better stand in a beam of light and ring out with their own sound. Rares, Hoarders and lords burst into showers of loot with the best piece landing last.
- **Currency.** Five orbs that change gear: reroll, add an affix, bless the rolls, or gamble on corruption.
- **14 uniques.** Named items with fixed affixes and a rule of their own, from the Crab King's Pincer to the Last Button.
- **Lands with rules.** Each of the 8 lands changes how the Horde plays. Past the Mad Button the lands come round again, corrupted.
- **Events.** The Hoarder (a loot goblin), four Shrines, and the Breach.
- **Bosses fight back.** Telegraphed moves you break by tapping; lords enrage at 30%.
- **Rifts.** Timed runs at the level you choose: the endgame and the ladder that ranks who is strongest.
- **Compete with friends.** Eight ladder boards (depth, gear score, Rift, today's Rift, uniques, the Mad Button race, lord crowns, firsts), your rank on the play screen, a feed of everyone's big moments, rival notices, a look at any friend's gear, and a share line for the group chat.
- **Feel.** A springy Button, a Hand bolt you can see, clicks that climb the scale, numbers that roll up, kills with weight.

## Loot, Path of Exile style

### Drops

Mobs no longer drop bags that you open later. Each drop is decided the moment it falls, so the ground tells you what you got:

| Tier | Label | Beam | Sound |
|---|---|---|---|
| Common | text only, hidden by the loot filter (on by default) | — | a thud |
| Uncommon | green on a dark plate | — | a thud |
| Rare | blue on a dark plate, blue border | — | a ping |
| Epic | white on purple, purple border | a short one | two glass pings with an echo |
| Legendary | black on orange | stays until picked up | a bell |
| Mythic | white on red, bigger | stays | a deep boom and a bell |
| Divine | red on white, the biggest | stays, with a red halo | boom, two bells, a shimmer |
| Unique | white on brown, gold border | stays | a low bell and a rising chord |

- Labels stack beside and above each other so they never overlap; on a crowded floor only the ones that matter stay up.
- Tap a label (or the item) to grab it. Anything left is gathered by the Warden: orbs after about a second, gear after 2.6 s (4.5 s for epics and better), uniques after 7 s.
- A shower lands one piece at a time with a pitch that climbs a semitone per drop, sorted so the best one lands last after a short pause.
- One drop in 25 upgrades in mid-air ("UPGRADE!").
- Bad-luck protection: at most 250 drops between legendaries.
- Early luck is scripted: the first kill drops an uncommon, a rare comes within the first 60 kills, the first champion always drops an epic, and the first lord always drops a unique.
- Boss rewards now burst out of the boss onto the ground instead of opening off-screen. The chests a boss used to give are still there, as the pieces promised their tier.
- When the chest room is full, the lowest chest pops open instead of the new one being sold.

### Currency

Orbs drop from the Horde, from bosses and from Rifts, stack, and stay through ascension like the gear. Use them in the Character tab: pick an item, then an orb.

| Orb | What it does |
|---|---|
| Whetstone | +1 enchant, free |
| Orb of Flux | rerolls every affix |
| Orb of Ascent | adds an affix, one past the usual count |
| Orb of Grace | rerolls affix values and keeps only the ones that go up |
| Orb of Ruin | corrupts the item: +3 item level, one more affix, or nothing. Corrupted items can't be changed again |

Uniques take only Whetstones.

### Uniques

| Unique | Base | Drops from | Affixes | Rule |
|---|---|---|---|---|
| The Crab King's Pincer | ring | depth 1 (the first lord drops it, if you don't have it yet) | +25% damage, +5% crit | critical kills burst, hitting everything around them |
| Goldgrin | crown | depth 1 | +60% gold, +30% luck | 40% more loot drops |
| Windripper | bow | depth 8 | +35% damage, +5% crit | arrows fork: two more targets |
| Warchief's Cleaver | sword | depth 10 | +50% damage, +25% toughness | every 5th attack is a critical hit with double splash |
| Sporeheart | heart | depth 13 | +45% toughness, +30% XP | every kill repairs the Button a little |
| Stormcaller | staff | depth 15 | +40% damage, +15% speed | every attack calls a bolt on another mob |
| Nightfang | dagger | depth 18 | +35% damage, +25% speed | critical hits strike twice |
| Headhunter | ring | depth 20 | +30% damage, +15% luck | slaying a rare: +60% damage and speed for 20 s |
| Frostwalkers | boots | depth 23 | +60% toughness, +12% speed | the Horde walks 35% slower |
| Eye of the Watcher | orb | depth 28 | +8% crit, +0.8 crit power | abilities recharge twice as fast |
| Hellstring | bow | depth 32 | +60% damage, +20% speed | kills by its arrows explode, hitting the mobs around them |
| Voidplate | armour | depth 35 | +120% toughness, +20% damage | mobs that bite the Button take ten hits back |
| Reaper's Due | scythe | depth 38 | +80% damage, +0.6 crit power | each kill: +2% attack speed for 6 s, up to +80% |
| The Last Button | button | the Mad Button, deep Rifts | +50% damage, +50% gold, +30% luck, +30% XP | every click strikes twice |

Uniques hit like a mythic of their kind. Their affixes count toward ladder power and are checked by every client and the server; their rules work in fights only. The Collection has a page for them, with silhouettes and where each one drops.

## Lands and events

### Every land plays by a rule

| Land | Depths | Rule |
|---|---|---|
| Shoreline | 1–5 | **Treasure Tides:** Hoarders come twice as often |
| Meadows | 6–10 | **Goblin Raids:** surges come 50% bigger and last longer |
| Deepwood | 11–15 | **Sporefall:** big mobs often burst into spores when they die |
| Highlands | 16–20 | **Stoneskin:** brutes take half damage and drop twice the loot |
| Frostlands | 21–25 | **Blizzard:** the Horde walks 25% slower, champions come twice as often |
| Godlands | 26–30 | **Watchful Eyes:** shrines rise twice as often, rares come 60% more |
| Abyss | 31–35 | **Hellfire:** one mob in four explodes when it dies, and blasts chain |
| The Void | 36–40 | **Unraveling:** Breaches tear open twice as often, loot +25% |

Each new land opens with a title card and its rule. After the Mad Button at depth 40 the lands come round again as **Corrupted Shoreline**, **Corrupted Meadows** and so on (then II, III…), with +15% loot for every cycle, instead of the Void repeating forever.

### Events

- **The Hoarder.** A goblin with a sack of loot runs around the Button, just out of reach, and escapes after 16 seconds ("It got away with 14% left"). It never bites. Tap it so the Warden chases it; coins fly off it with every hit, and a kill is a jackpot: a coin fountain and 8–12 drops. The first one comes about 40 seconds into a new game.
- **Shrines.** A pillar rises from the ground: Frenzy (attack speed ×2), Greed (loot ×3, gold ×2), Storms (every click calls 3 more bolts, every swing chains) or Slaughter (the Horde 2.5× thicker, XP ×2), for 15 seconds. Tap it, or the Warden claims it after 12 seconds.
- **The Breach.** From depth 3, a purple tear opens at the edge of the field and pours out the Horde for 12 seconds. Breach mobs glow purple and drop twice the loot and 1.5× the XP.

### Bosses fight back

- Bosses wind up telegraphed moves, each with its colour, a bar and the taps left: **Slam** (red, 5 taps: or the Button takes a heavy hit), **Summon** (purple, 6 taps: or a pack arrives) and, for lords, **Shield** (blue, 8 taps: for 3 seconds the boss takes 70% less unless you break it). Break a move and the boss is **staggered**: +50% damage for 3 seconds.
- Lords **enrage** at 30% health: twice the adds, harder bites, twice the bullets.
- Every failed try at a lord **rallies** the Warden: +20% damage on that lord, up to +100%, on top of the wounds it keeps ("Wounded −40% · Rally +60%"). Only tries that actually hurt the lord count.
- A slain boss or lord bursts into loot on the ground.

## Rifts: the endgame

Rifts open when you slay your first lord (the Crab King at depth 5). A Rift is a timed run at the level you pick:

1. **90 seconds** to fill the bar by killing the Horde, which comes 1.5× thicker than in the campaign.
2. Then the **Rift Guardian** walks in: a land's lord, twice the size. Slay it before the clock runs out.
3. Clear it and the next levels open: +1, and one more for every 15 seconds left, up to +6 at once.

- Rift N fights like depth N, in that depth's land, so pushing the Rift walks you through the lands.
- You can always open a Rift close to your campaign depth, or anything higher you've earned in Rifts.
- Rift loot drops at the Rift's depth, so it can beat anything the campaign gives. A clear pays a shower of loot (with two pieces promised a tier), orbs, essence and a chance at a unique that grows with the level.
- Leaving, running out of time or a broken Button collapses the Rift.
- Your best Rift, its time and today's best go on the ladder.

## Compete with friends

The Ladder tab now has eight boards:

| Board | Ranks by |
|---|---|
| Depth | deepest depth, then power |
| Gear score | gear, best level and class only, the same formula for everyone and recomputed by every client (it used to be called Power; ascending no longer sinks it) |
| Rift | best Rift level, then its time |
| Today | today's best Rift, then its time: a fresh race every day (UTC) |
| Uniques | how many different uniques |
| Mad Button race | play time from a fresh start to the first kill of the Mad Button |
| Crowns | each lord's crown goes to the fastest kill of a fresh lord (unwounded, no rally), set while it's at the edge of your progress, so re-clearing old lands after ascending doesn't count |
| Firsts | who was first to 22 milestones: first boss, the Crab King, depth 10/20/30/50/60, the Mad Button and its corrupted return at 80, first unique and all 14, first legendary, mythic, divine, ascension, evolution, Rift 5/15/30/45/60/80 |

- **Your rank on the play screen:** under the land name, "#2 of 6 · Anna is 3 depths ahead".
- **Inspect:** tap any row to see that Warden's paper doll, all four items with their affixes, and their gear score against yours.
- **Recent:** a feed of everyone's big moments: uniques found, divine drops, lords slain, Rift records, crowns taken, evolutions.
- **Rivals:** when the ladder updates you're told who you passed and who passed you ("You passed Sam · Rift #2").
- **Crown taken:** beat a friend's time on a lord and you take the crown, with a notice and a feed line.
- **Copy brag:** a share line for the group chat:

  ```
  BTTN · Knight Lv 54 · Gear score 1.2K
  ⚔ Depth 41 · ◈ Rift 23 · 👑 2 crowns
  Uniques 5/14: 🟧🟧⬛🟧⬛⬛🟧⬛⬛🟧⬛⬛⬛⬛
  Can you beat me?
  ```

Every new field (Rift, today, uniques, feed, firsts, crowns, corrupted and unique gear) is checked on every client and on the server: a tampered unique, an affix count past what orbs allow, an item level past the depth or Rift reached, a crown on a lord you never reached, a first dated before the release or for a milestone never reached, a Mad Button time under a minute, or a malformed feed line all keep an entry off the boards. Gear from a Rift above your best clear (up to six levels, the most a clear can open) is allowed.

**Safer for friends.** Honest players are no longer thrown off the ladder: the level limit is looser (levels come from kills, so a patient player can outlevel their depth), and the gear score check allows the last-bit rounding difference between Safari and Chrome. If your own entry fails a check, the Ladder tab says why instead of hiding it silently. Omens and today's Rift board follow the UTC day, so friends in different time zones share them. A tab left open on another device can no longer overwrite a newer cloud save (it asks first, and "keep this one" sticks) or lower your ladder row (it keeps the row and says why). Hero names default to your account name, and rows show the account next to the hero name. Loot left on the ground is gathered when the tab closes.

**Sharing it.** On claude.ai only people invited **by email with edit access** can write to the ladder; anyone opening a public link can look but not join. So invite each friend by email and leave the public link off. The Ladder tab tells view-only visitors how to get in.

## Feel

- **The Button is a spring.** Every click squashes it and it bounces back, the view kicks down a pixel, and a rim ring flashes. Crits add a white flash and a 30 ms freeze.
- **The Hand's bolt** is thicker, with an ink edge so it reads on sand, a flash at the impact and a scorch mark. A click always strikes something: the mob you tapped wherever it is, else the thickest pack near the Button, else the thickest anywhere.
- **Numbers roll up.** Quick clicks add into one growing number instead of a pile of "+1"s, with decimals while they're small. Gold from the swarm is summed into one number at the Button.
- **Combo tiers.** A quarter, half and all of the combo cap each announce themselves; a full combo **overcharges** the Button with one more bolt per click.
- **Kills with weight.** Brutes get a short freeze and a ring; five or more kills in one frame freeze a moment longer and show "×N".
- **Sound.** Clicks climb the scale as the combo builds and never sound exactly alike, with a thump under them. New sounds for XP crystals (a tink that climbs while they come), kill streaks, bites, a broken Button, perks, evolutions, Nova, every loot tier, every orb, the Hoarder's giggle and jackpot, shrines, the Breach, boss wind-ups and staggers, Rifts.
- **Level-ups** freeze a moment and pull every XP crystal on the field into the Warden; the perk cards are smaller so the fight stays visible.
- **The gold number** rolls toward its value and bumps on a real gain.
- **The first seconds.** A welcome pack of the Horde is already in reach when you pick a class, so the first click kills.
- Tips wait until a big drop has had its moment.
- Animation timers follow real time, so 120 Hz screens and slow tabs look the same.

## Progress and goals

- The Journey has 11 new steps that walk through the new systems: catch a Hoarder, find a unique, collect orbs, clear a Rift, Rift 15/25/35/50, find 4, 8 and all 14 uniques.
- New one-time tips: loot labels, the Hoarder, shrines, boss moves, orbs, Rifts.

## Fixes

From the adversarial review of the release build (every item reproduced, then fixed and covered by a test):

- A lord killed on the tick it appeared recorded a 0-second crown, which every client and the server rejected, so strong ascended players fell off the ladder. Crowns are at least 0.1 s, and old saves are repaired.
- Gear from a Rift above your best clear was over the item-level limit, keeping honest players off the ladder.
- A boss could be started inside a Rift, freezing its timer.
- Tab click handlers piled up each time a tab was opened: one orb click used several orbs, Rift level buttons skipped levels, settings toggles stopped working.
- The ability button covered the fight button.
- On phones the level-up cards appeared right under the Button (now at the top, and they ignore taps for 0.6 s), and the tutorial bubble no longer sits on the Button or takes a tap meant for it.
- Small loot labels were 4 CSS px tall on phones; labels near the top edge now go under the item instead of disappearing.
- "Scrap below" destroyed unequipped uniques.
- Saves from before 1.0 keep their place on the Journey instead of being paid again for steps they'd done.
- A hard reset or a loaded save kept the old run's Rift, ground loot and shrine buff.
- Instant retreats could farm Rally; a Rift far below your cap now pays no orbs or unique, so pushing beats farming.
- Shrine of Storms chains every swing even without the Chain Lightning perk; legendaries from chests count for the Firsts board.
- Rival notices ignore the Rift board until someone has a Rift, and don't announce friends who just joined above you.
- The Rifts tab opens on the highest level your Warden can clear comfortably, not on a level you can't win.

Earlier fixes in this patch:

- Kill effects now know what did the kill (the event bus passed only three arguments), so click and boss-sweep kills break mobs harder as intended.
- Tapping a mob out of the Hand's reach no longer does nothing.
- The Warden's name plate moved under their feet, and the "boss ready" skull moved up with a smaller hit area, so fast clicks on the Button no longer start a boss by accident.
- Headhunter and shrine buffs show in the buff row.

## Measured

`node tools/playtest.js all 4 120`, 4 seeds per persona, 2 hours each (the returner plays a week). "Before" is the previous release.

| | Active | Casual | Idle | Returner |
|---|---|---|---|---|
| Big moments per minute, first 10 min | 5.7 → **8.5** | 3.4 → **4.1** | 2.7 → **4.0** | 3.5 → **4.4** |
| Big moments per minute, 10–30 min | 3.95 → **4.95** | 0.6 → **1.05** | 0.55 → **0.95** | 0.7 → **1.25** |
| Big moments per minute, 30–60 min | 4.3 → **5.4** | 1.3 → **1.4** | 0.33 → **0.57** | 1.5 → **2.0** |
| Longest dry spell, first 10 min | 75 → **45 s** | 113 → **103 s** | 125 → **101 s** | 106 → 150 s |
| Longest dry spell, 10–30 min | 127 → 139 s | 323 → **237 s** | 424 → **258 s** | 380 → **272 s** |
| Longest dry spell, 30–60 min | 160 → **113 s** | 600 → **390 s** | 573 → **409 s** | 474 → **410 s** |
| First legendary / mythic / divine (min) | 5 / 6.3 / 19.8 → 2.6 / 5.5 / 11.3 | 6.6 / 24 / 24 → 6.3 / 12.9 / 24.4 | 26.5 / 38 / 73 → 9.4 / 27 / 49 | 5.3 / 15 / 28 → 2.7 / 15 / 19 |
| First Hoarder slain · first unique (min) | 0.7 · 1.8 | 0.8 · 6.3 | 0.7 · 8.9 | 0.8 · 4.7 |
| Uniques in 2 h (different ones) | 14 (9 of 14) | 5 (4) | 3 (2) | 18 (8) in a week |
| Best Rift after 2 h | 47 | 28 | 21 | 47 in a week |
| Time to depth 20 | 20 → **12 min** | 73 → **54 min** | 106 → **90 min** | 47 → **36 min** |
| Time to depth 40 | 82 → **64 min** | — | — | 140 → **125 min** |
| Bosses lost in 2 h (worst streak) | 7 (2) → 6 (3) | 43 (7) → **41 (7)** | 57 (15) → **48 (14)** | 57 (5) → **51 (6)** |
| Journey step reached | 29 → 38 | 17 → 23 | 6 → 19 | 27 → 36 |

Medians of 4 seeds. A "big moment" is something a player notices as progress: a boss or lord, a new land, a best-ever rarity, a new pet, a tab unlocking, an ascension, a Journey step, an evolution, and now also a unique, a Hoarder slain and a Rift cleared. The Journey has 11 more steps than before, so its step numbers run a little ahead.

What got worse: the returner's longest wait in their first 10 minutes (106 → 150 s) and the active player's in minutes 10–30 (127 → 139 s). Progress is also 15–25% faster to each depth, mostly from the extra loot; the corrupted cycles, uniques and Rifts are there to carry the late game past that.

**The first minutes, as the bots play them (medians):** the first kill comes with the first click (a welcome pack is already in reach), an uncommon drops on the first kill and a rare within seconds, the first perk comes at 6–25 s, the first Hoarder at about 40 s, the first boss at 30–75 s, the first shrine at about 2 minutes, the Crab King and the first unique at 2–9 minutes (Rifts open then), the first Breach at 8–11 minutes.

## Next patches

What comes next, in order. The five lands this roadmap used to promise shipped in 1.1; what's left changes how progress feels.

### 1.2 — Trials

- **Trial of the Day.** Everyone plays the same seed with the same fixed Warden for 3 minutes; one ranked attempt a day. Skill with the Hand, perk picks and boss timing decide it, not hours played.
- **A Wordle-style result line:** one square per boss (first try, after a fail, lord, the one that stopped you), your best drop's colour, your place among friends.
- **Loose Pages** in the Sunken Library: pages float over the field; tap one for a random perk rank for 20 seconds.

### 1.3 — Doors and Crowns

- **Doors after bosses,** Hades style: pick one of two rewards for the next zone before it starts (gold, champions, a guaranteed Hoarder, a Breach, an extra item, a harder zone for more loot).
- **Lord crowns with a Legend title:** besides the fastest kill, a second crown for the most kills of a lord in 7 days.

### 1.4 — Legion and Ritual

- **Frozen Warband** (Highlands, Frostlands): a formation frozen in time; damage piles up for 14 seconds, then everything shatters at once into a loot fountain.
- **Blood Altar** (Abyss, Godlands): the last 30 kills rise again; their tribute buys one of three rewards.
- **Land set pieces** instead of a plain surge: a Crab Stampede, a Goblin Raid from three sides, a Rockslide, an Eye Swarm crossing the field.

### 1.5 — Season 2 and Relics

- **Seasons:** a fresh seasonal save every 6 weeks, the old Warden moving to a Standard board. Firsts and crowns reset; cosmetics stay.
- **Weekly Friends League:** points from the Trial, the weekly best Rift, crowns and land stars.
- **Relics:** one hidden relic per land, found by a secret feat, each unlocking something permanent.
