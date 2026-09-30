# Retention: research, playtests, changes

What keeps people playing BTTN, measured with bots that play like different kinds of players, compared against what the genre's best games do.

## What the market says

| Source | What it says | What it means for BTTN |
|---|---|---|
| [GameAnalytics 2026 benchmarks](https://www.gameanalytics.com/reports/2026-mobile-pc-gaming-benchmarks) | Median mobile game: D1 ~22%, D7 under 4%, D30 ~0.7%. Top quarter: D7 6–7%. | Most games lose nearly everyone in a week; the first sessions decide it. |
| [playio 2026 benchmarks](https://blog.playio.co/d1-d7-d30-retention-benchmarks-2026) | A "good" profile is D1/D7/D30 = 35/15/5; the top quarter clears 40/20/10. | The bar to aim for. |
| [Segwise](https://segwise.ai/blog/boost-mobile-game-retention-strategies) | Idle/AFK games run 35–50% D1, 20–30% D7, 10–15% D30; idle games with daily rewards show 18% stickiness vs 10.5% for hyper-casual. A rolling "3 of 7 days" login reward is more forgiving and more sustainable than a strict streak that resets. | Idle is the stickiest genre when coming back is rewarded; streaks shouldn't punish a missed day. |
| [Solsten](https://solsten.io/blog/d1-d7-d30-retention-in-gaming) | D1 is the quickest path to the fun and good guidance; D7 is progression and deeper meta-systems; D30 is investment, routine and limited-time events. | Guidance (a goal on screen), a meta layer (evolutions, collection), and a daily rhythm (omens, bounties). |
| [Vampire Survivors on Wikipedia](https://en.wikipedia.org/wiki/Vampire_Survivors) and [playtracker](https://playtracker.net/insight/game/72856) | Median playtime about 18–19 hours; 226 achievements/unlocks in the base game alone. | The unlock treadmill is what turns a 30-minute run into a hobby. |
| [Vampire Survivors analyses](https://www.natrowley.com/the-addictive-nature-of-vampire-survivors/), [rogueliker review](https://rogueliker.com/vampire-survivors-review/) | You start weak and become an unstoppable force; weapon evolutions make choices strategic instead of random. | Level-up choices need a goal beyond "+12%": evolutions. |
| [Survivors-likes overview](https://en.wikipedia.org/wiki/Vampire_Survivors%E2%80%93like) and [genre guides](https://choostgames.com/blog/best-survivors-like-games/) | Runs are 10–30 minutes (20 Minutes Till Dawn, Deep Rock Galactic: Survivor, Soulstone Survivors) with meta progression between runs. | An ascension cycle of 10–40 minutes fits the genre. |
| [Cookie Clicker golden cookies](https://cookieclicker.wiki.gg/wiki/Golden_Cookie) | A random clickable every few minutes, 13 seconds on screen; ~40% "Lucky", ~40% "Frenzy ×7 for 77 s". | BTTN's wisps already follow this pattern. |
| [Click the Button on Steam](https://store.steampowered.com/app/3946950/Click_the_Button/) and [a review](https://note.com/inari_229/n/nc00b3a54753a?hl=en) | 93% positive, but 100% in 1–2 hours; the main complaint is lack of content. | The thing to beat: BTTN must not run out in two hours. |
| [GDC: Quest for Progress (Kongregate)](https://www.gdcvault.com/play/1023876/Quest-for-Progress-The-Math) and [Wikipedia: incremental games](https://en.wikipedia.org/wiki/Incremental_game) | Exponential costs against slower production, prestige when progress slows, multiple prestige layers, offline earning (AdVenture Capitalist). | Ascension at a wall is right, but the game has to say when and why. |

## How the playtests work

`node tools/playtest.js all 4 120` runs four kinds of player, four seeds each, for two hours of game time (the returner plays a week), in parallel. A run takes under a minute.

| Persona | Plays like |
|---|---|
| active | 6 clicks a second, reacts at once, picks perks well, ascends at the right time |
| casual | 2.5 clicks a second half the time, takes the first perk after 5 s, presses the boss after 10 s, ascends after 10 minutes stuck |
| idle | never clicks, checks in once a minute, lets perks auto-pick, ascends after 20 minutes stuck |
| returner | two 15-minute sessions a day for a week, 8 and 16 hours offline in between, a new calendar day each night |

A "big moment" is something a player notices as progress: a boss or lord beaten, a new land, a best-ever rarity, a new pet, a tab unlocking, an ascension, a Journey step, an evolution. The report gives big moments per minute and the longest dry spell between them, per time window, plus first-time events, depth milestones, boss failures and stalls.

## What the first playtests found

1. **Content ran out in two hours.** Active and casual bots completed the whole collection (42/42) and every pet (12/12) within 120 minutes, the same complaint the original gets.
2. **Walls without a way through.** Casual and idle bots lost 46–58 bosses in two hours, up to 14 in a row, and went 11–20 minutes without a new depth.
3. **Coming back gave little.** Offline time only paid gold, for up to 2 hours; the Warden did nothing.
4. **A missed day reset the daily streak.**
5. **No long-term direction.** After the first hour the only goal was "go deeper".

## What changed

| Change | Answers | How it works |
|---|---|---|
| **Perk evolutions** | Vampire Survivors' strongest hook; D7 meta | A perk at its top rank plus the right gear worn turns into a golden card at the next level-up: Blade Storm, Sanctuary, Supernova, Thunderstorm, Arrow Rain, Wrath of the Hand, Blood Pact, Midas Touch, Berserk, Titan, Bastion. Discoveries are permanent and fill a recipe book in the Collection with hints. |
| **The Journey** | D1 guidance, D7 progression | An ordered road of 44 written goals (then endless), always one on screen with a progress bar and a reward. Each step gives +2% Warden damage for good. Goals point at systems the player might miss: perks, enchanting, pets, evolutions, rares, collection stars. |
| **Wounded bosses** | Frustrating walls | A boss that got away keeps 70% of the damage it took (never back below 25%), shown as "Wounded −N%". After three failures at a lord, a tip explains the wall and points to ascension. |
| **The Warden fights while you're away** | Idle genre's return reward | Offline time now also gives XP (a quarter of the active rate, at most 5 levels per return, so perk picks wait for you) and shards. The offline window is 4 hours by default instead of 2. The welcome-back window reports it. |
| **Omen of the day** | D30 routine, variety | A daily twist to the Horde, the same for everyone: Blood Moon, Gold Rush, The Swarm, Champions' Day, Storm Day, Night of Giants, Fortune. |
| **Daily bounty** | A reason to play today | Slay 3,000 of today's Horde for 3 eggs and a chest. |
| **Forgiving streak** | Research on strict streaks | A missed day pauses the daily streak instead of resetting it. |

## Before and after

Same bots, same seeds, same metrics; "before" is the previous commit.

| | Active | Casual | Idle | Returner |
|---|---|---|---|---|
| Big moments per minute, first 10 min | 3.6 → **5.7** | 1.7 → **3.4** | 1.0 → **2.7** | 2.2 → **3.5** |
| Longest dry spell, first 10 min | 127 → **75 s** | 177 → **113 s** | 324 → **125 s** | 247 → **106 s** |
| Longest dry spell, 10–30 min | 200 → **127 s** | 335 → **323 s** | 550 → **424 s** | 480 → **380 s** |
| Longest dry spell, 30–60 min | 206 → **160 s** | 519 → 600 s | 1095 → **573 s** | 480 → **474 s** |
| Bosses lost in 2 h (worst streak) | 15 (4) → **7 (2)** | 46 (9) → **43 (7)** | 58 (14) → 57 (15) | 66 (7) → **57 (5)** |
| Time to depth 20 | 33 → **20 min** | 108 → **73 min** | never → **106 min** | 60 → **47 min** |
| Best depth | 43 → **52** | 24 → **29** | 14 → **24** | 49 → **54** |
| Journey step / evolutions / bounties | — | — | — | **27 / 6 / 7 of 7** |

What's still open: casual and idle bots spend their last 10–20 minutes before an ascension stuck at a lord. That's the prestige wall the genre is built on, and the new tip now tells a real player what to do; the bots just follow their fixed "ascend after N minutes stuck" rule.


## Release 1.0: what the loot, land and social research said

For the release, four research passes looked at loot feel, the first minutes, competing with friends, and land design, and five audits went through the build (feel, loot, progression, online, the first five minutes in a real browser). The main sources:

| Source | What it says | What BTTN took |
|---|---|---|
| [NeverSink's loot filter for Path of Exile](https://github.com/NeverSinkDev/NeverSink-Filter) and [PoE's filter spec](https://www.pathofexile.com/item-filter/about) | Value is told before pickup: label plates by tier, font size, a sound per tier, beams that stay for the top tiers, cheap loot hidden | Ground loot with 8 label styles, lasting beams for legendary and up, a sound per tier, a filter for commons |
| [PoE's currency economy](https://www.gamedeveloper.com/design/path-of-exile-economy-currency-trading) | Every orb is useful by itself; currency is the steady drip under the jackpots | Five orbs that change gear, with a corruption gamble |
| [Destiny's engrams](https://www.gamedeveloper.com/design/psychology-and-destiny-s-loot-system) | A colour cue that promises a minimum must never lie; uncertainty makes the reveal better | Showers where the best lands last; a drop that can only upgrade in mid-air, never downgrade |
| [Vampire Survivors' first chests](https://jboger.substack.com/p/the-secret-sauce-of-vampire-survivors) | The first rewards are scripted to set expectations, then the odds take over | Scripted first drops, the first lord's guaranteed unique, bad-luck protection |
| [Diablo 3's treasure goblins](https://www.diablowiki.net/Treasure_Goblin) | A harmless runner that escapes creates an instant "drop everything and chase" | The Hoarder |
| [Diablo 3's Greater Rifts](https://maxroll.gg/d3/resources/greater-rift-explained) | Timed runs, progress then a guardian, faster clears open more levels; the ladder ranks level then time | Rifts and the Rift ladder |
| [Vampire Survivors' stages](https://vampire.survivors.wiki/w/Stages) | Each stage has a rule that changes play, not just new art | A rule for every land |
| [Telegraphing enemy attacks](https://www.gamedeveloper.com/design/enemy-attacks-and-telegraphing) | Every attack needs a readable wind-up; colour coding and exaggeration read best | Boss moves with a colour, a bar and taps to break them |
| [Cookie Clicker's source](https://orteil.dashnet.org/cookieclicker/main.js), [Juicing your cameras](https://gdcvault.com/play/1023146/Math-for-Game-Programmers-Juicing), [Juice it or lose it](https://www.gdcvault.com/play/1016487/Juice-It-or-Lose) | Springy targets, never-repeating click sounds, freeze frames scaled to the event | The Button spring, click variants and the freeze ladder |
| [Peggle's sound](https://www.audiogang.org/peggle2-sonic-joy/) | Hits climb a scale that fits the music; a fever state at the top | Clicks climb as the combo builds; a full combo overcharges |
| [Spelunky's Daily Challenge](https://www.gamedeveloper.com/design/the-understated-genius-of-the-i-spelunky-i-daily-challenge) | One shared run a day makes a fair daily race among friends | Today's Rift board now; a seeded Trial of the Day next (1.1) |
| [Strava notifications](https://support.strava.com/hc/en-us/articles/216918367-Strava-Notifications) and [Local Legends](https://www.dcrainmaker.com/2020/06/strava-legends-feature.html) | Losing a title you held pulls people back harder than reminders | Lord crowns and rival notices |
| [Wordle](https://en.wikipedia.org/wiki/Wordle) | A spoiler-free result grid is what spreads in group chats | The brag line with a uniques grid |
| [PoE league races](https://pathofexile.fandom.com/wiki/Races) | Being first to a milestone is its own status | The Firsts board |
| [RuneScape's announcements](https://runescape.fandom.com/wiki/Server-wide_Announcements) | Rare drops announced to everyone start a wave of reactions | The Recent feed on the ladder |

The audits found problems the research alone wouldn't have: for the first five seconds after picking a class the arena was empty and clicks killed nothing; about half of all clicks called no lightning because mobs died before reaching the Hand's range; a full chest room silently sold every new drop; the event bus dropped the fourth argument, so click kills never broke mobs harder; animation timers ran on frames, not time. All of these are fixed in 1.0.

### 1.0 before and after

Same bots and seeds as above; "before" is the build this file described up to now.

| | Active | Casual | Idle | Returner |
|---|---|---|---|---|
| Big moments per minute, first 10 min | 5.7 → **8.5** | 3.4 → **4.1** | 2.7 → **4.0** | 3.5 → **4.4** |
| Big moments per minute, 10–30 min | 3.95 → **4.95** | 0.6 → **1.05** | 0.55 → **0.95** | 0.7 → **1.25** |
| Longest dry spell, 10–30 min | 127 → 139 s | 323 → **237 s** | 424 → **258 s** | 380 → **272 s** |
| Longest dry spell, 30–60 min | 160 → **113 s** | 600 → **390 s** | 573 → **409 s** | 474 → **410 s** |
| Time to depth 20 | 20 → **12 min** | 73 → **54 min** | 106 → **90 min** | 47 → **36 min** |
| Bosses lost in 2 h | 7 → 6 | 43 → **41** | 57 → **48** | 57 → **51** |
| Uniques in 2 h (different) | 14 (9) | 5 (4) | 3 (2) | 18 (8) in a week |

Big moments now also count uniques, Hoarders slain and Rifts cleared. The full table and the first-minutes timeline are in [PATCHNOTES.md](PATCHNOTES.md#measured).

## Next, in order of expected effect

The patch plan with dates, lands and progression is in [PATCHNOTES.md](PATCHNOTES.md#next-patches). In short:

1. **Trial of the Day** (1.1): a shared seed and a fixed Warden, one ranked attempt a day, replays checked by every friend's browser. The fairest race among friends who started at different times.
2. **Doors after bosses and Legend crowns** (1.2): a choice every one or two minutes, and a title for consistency, not just speed.
3. **Frozen Warband, Blood Altar and land set pieces** (1.3): more events that break up the middle of a session, where the casual and idle bots still wait longest.
4. **Seasons and a weekly Friends League** (1.4): a fresh start every 6 weeks, the thing that brings Path of Exile and Diablo players back.
5. **Carnage rank and relics** (1.5): a visible reward for playing fast, and secrets per land.
