# BTTN — Marketing plan (launch: Oct 2026 – Jan 2027)

This is the plan for the owner. Decisions come first, then the week-by-week plan. Numbers carry a source tag like [7],
listed at the end. **(est.)** marks our own estimate, with its basis given next to it. Research date: 2026-10-04.
Money is covered in [MONETIZATION.md](MONETIZATION.md). Retention is covered in [RETENTION.md](RETENTION.md), and the
analytics in GDD §7.

## 0. Decisions

1. **Positioning:** *"Vampire Survivors, but you're the clicker."* Every first frame and the landing hero carry one
   emotional hook: **"Don't let the Button break."**
2. **The first players come from portals, not ads.**
   - Yandex Games has 50M+ monthly players, 60% of them in the CIS [7][8]. It is the cash channel for a Russia-based
     owner.
   - CrazyGames has 35–50M monthly players [14]. It is the global test.
   - Both are free and non-exclusive, and BTTN's 1.56 MB file fits their size limits.
3. **Paid traffic is only for measuring.**
   - One web player is worth about **$0.03–0.15** (MONETIZATION.md §10).
   - A paid visitor who actually plays costs **$0.20–2.00**: a click costs $0.31 for TikTok in Southeast Asia, $1.18 for
     TikTok US and $2.69 for Meta US [29], and only ~60% of clicks start playing.
   - So spend at most $50–150 per test, and scale only where the measured value per player beats its cost.
4. **The spectacle is the ad.**
   - Post 3–5 vertical clips a week, and put the same clip on Shorts, Reels, TikTok and VK Clips.
   - Shorts and Reels now reach more people than TikTok for games: 85–90% of creators in one 2025 campaign did better
     there [23].
   - In Russia, TikTok has blocked new uploads since 2022 [26], so use VK Clips (3B views a day) and VK Video, which now
     reaches more Russians than YouTube [25].
5. **RU/CIS is a first-class market.** Russian localization blocks Yandex: it requires automatic language
   detection [9].
6. **Fix the first session before any traffic arrives.** Put PLAY on the first screen, and make the first press of the
   Button come within 10 seconds of it. Remove gambling-styled features and prove phone performance (§3).
   - In a 2026 launch of a solo browser game, D1 was 2%, and its developer's lesson was to fix the first session
     before the traffic arrives [20].
7. **Steam is the second wave.**
   - Put up a "Coming soon" page by about day 60, but only if D7 ≥ 8% and there is a payout route outside Russia.
     Steam payouts need a bank outside the sanctions lists [34].
   - Enter Next Fest February 2027. Registration closes **Jan 10, 2027** [21].
8. **Measure everything.**
   - Every link carries UTM tags (§7).
   - Judge each source only once it has 100+ visitors, by the `/admin` quality score.
   - Scale a source at a score of **≥ 42** (the score of a player who hits every design target) and kill it below
     **30** (§8).

## 1. Positioning

**One-liner.** BTTN is a free browser clicker where every click and hold hits a 1,000-monster Horde. Your party holds
the line around a glowing Button, loot rains in Path of Exile style, and every time the Button falls the next run is
stronger.

**Category:** idle horde-defense clicker (pixel art, roguelite runs). Long-tail search terms: "horde defense clicker",
"hold the button game", "idle game with PoE loot", «кликер с ордой».

| # | Tagline (EN) | RU | Use |
|---|---|---|---|
| A | **Vampire Survivors, but you're the clicker.** | «Vampire Survivors, только ты — кликер.» | Reddit, YouTube titles, press, Steam capsule |
| D | **Don't let the Button break.** | «Не дай Кнопке сломаться.» | Landing hero, first 2 s of every clip |
| B | Hold the Button. Hold the line. | «Удержи Кнопку. Удержи строй.» | Mobile web, Yandex, Telegram |
| C | Loot worth screaming about, one click at a time. | «Лут, ради которого орёшь, — по одному клику.» | Loot-drop clips, ARPG communities |
| E | A tap game that is actually a game. | «Тапалка, в которой есть игра.» | Telegram, VK, RU press (against tap-to-earn) |

**Elevator pitch (EN, 30 s).** "BTTN is a free pixel-art clicker you play in the browser. A Horde of over a thousand
monsters wants to break a glowing Button. You are the Hand: click or just hold, and your clicks call lightning,
meteors and tornadoes while your knight holds the line, your cleric heals and your archer flanks. Loot drops with
beams, like in Path of Exile: 19 uniques that bend the rules, and relics from about 1 boss in 600. When the Button
falls, the run pays fame and the next one goes deeper. There are 15 lands and a town to build: weeks of play, three to
thirty minutes at a time. No download, no sign-up."

**Pitch (RU).** «BTTN — бесплатный пиксельный кликер в браузере. Орда из тысячи монстров хочет сломать светящуюся
Кнопку. Ты — Рука: кликай или просто держи, и с неба бьют молнии и метеоры, пока рыцарь держит строй, клирик лечит, а
лучник заходит с фланга. Лут падает со столбами света, как в Path of Exile: 19 уникальных предметов меняют правила
игры. Когда Кнопка падает, забег приносит славу, и следующий идёт глубже. 15 земель и свой город — недели игры по 3–30
минут. Без скачивания и регистрации.»

**Proof points for copy.** These are true in the code today:
- 1,000+ mobs on screen (up to 1,100) and 13 Hand spells;
- 5 classes and a party of 4;
- 15 lands × 3 zones;
- 7 rarities, 19 uniques, and 8 relics (about 1 boss in 600);
- 11 town buildings;
- the Button of Legends, about once in a million clicks;
- a single 1.56 MB file (490 KB gzipped), playable on phone and desktop.

**Personas**

| Persona | Who and where | Hook that works | What they must see |
|---|---|---|---|
| **The Incrementalist** | 18–35, idle on a second monitor; r/incremental_games (190k members [17]), idle YouTubers | Depth, fame meta, numbers going up, fairness | "Weeks of content", offline progress, no pay-to-win. The Click the Button reviews punish "done in 2 hours" [2]. |
| **The Survivors fan** | Players of Vampire Survivors, Brotato and Megabonk; Steam, YouTube, Twitch | A dense horde, builds that break the game | Clip of 1,000 mobs plus a meteor shower; blessings plus uniques |
| **The Looter** | Players of PoE, Diablo and RotMG; TikTok loot clips | Beams, uniques with rules, a relic cinematic | A legendary drop on screen in the first 2 s |
| **The break-time phone player** | Mobile web, Yandex Games (58% women, 80% aged 25+ [8]) | One finger, no energy, the cozy town and pets | Instant start, readable on a phone, holding the Button with one thumb |
| **The RU Telegram player** | Tired of tap-to-earn | "A tap game with a real game inside, no tokens" | The friends ladder and invites. No "earn" framing: tap-to-earn retention ran 5–20% [32]. |

## 2. Competitors and differentiation

| Cluster | Leaders (scale) | What it proves | BTTN takes | BTTN avoids |
|---|---|---|---|---|
| Idle defense | The Tower: #2 idle game by US revenue in Q3 2024, peak week ~$275k in the US [1] | "Defend the center + runs + permanent meta" earns money | Runs, permanent upgrades, a daily reason to return | Long real-time timers |
| Horde survivors | Vampire Survivors: free on itch.io, then $2.99 on Steam, ~$1.5M in its first month [4][38]; Survivor.io: $75M in 2 months [42] | A dense horde sells on video and through creators | Spectacle clips, creator outreach, free web first → Steam later | Energy systems, pay-to-win |
| Direct comparable | Click the Button (Steam 2026, $3.99): 94% positive of 4,458 reviews [2] | Short pixel clickers sell | Juice, rarity moments | Its complaints: "100% in 1–2 h", "slideshow" after long sessions [2] |
| Clicker RPG | Idle Slayer (solo developer); its Attack on Titan collab lifted revenue 88% [37] | A solo developer can run a pixel clicker as a live service | Events, a later collab | Spend-tier VIP |
| Formation idle | Idle Champions: 77% positive [40] | Complexity and chest economies get punished | Redeemable codes posted for streams | Predatory chests, "requires a PhD" |
| Clicker heritage | Cookie Clicker: free on the web in 2013 → $4.99 on Steam, 100k+ copies in days [41] | A long-lived free web game builds buyers | Web stays free, Steam edition later | — |
| Telegram tappers | Hamster Kombat: 300M → 41M monthly users after its airdrop [32] | Referrals and daily rituals spread a game; tokens destroy retention | Invite rewards, a daily code | Tokens, airdrops, "earn" |
| Rare-drop lotteries | Bongo Cat: 194k concurrent players at peak, but $2–4k a month [39] | Rare drops drive engagement, not money | Earned-only rare surprises | Selling randomness |

**Where BTTN wins.**
- **One input on a real battlefield.** Clickers hit one target and survivors need a stick; BTTN is click or hold
  against a 1,000-mob siege.
- **Items that change the rules.** Tap Tap Loot players say its items "barely matter" [43]; BTTN's uniques and relics
  each change how you play.
- **A visible party with roles.**
- **Runs that pay fame when the Button falls.**
- **Instant play** from a single HTML file.

**Messaging rules this sets:**
- Say "weeks of content" on every page.
- Show a phone in at least every third clip.
- Frame rare moments as *rarity* ("1 in a million"), never as gambling: no "casino", "spin" or "jackpot bet".
- Never fake numbers.

## 3. Before any traffic: the P0 gate

| # | Item | Why | Done when |
|---|---|---|---|
| 1 | **Landing at `/`, game at `/play`** (brief in §10). r/WebGames and HN links go straight to `/play`. | The owner's ask; Poki aims for 65%+ of visitors to start playing [16] | Landing live; query string forwarded to `/play` |
| 2 | **First press within 10 s of PLAY.** Arriving from the landing skips the intro; class pick is one tap. | CrazyGames Full Launch must "land directly in gameplay" [14] | `/admin` funnel: first_click ≥ 90% of visits |
| 3 | **Ship 3.6 with the Lucky Spin removed.** Remove the Ghostly Gambler's double-or-nothing, and rename "Gambler"/"Casino" in the UI. | Simulated gambling is PEGI 18 [31]; CrazyGames requires a 12+ rating [14] | No slot, wager or "casino" word in any build |
| 4 | **Russian localization** with automatic language detection | Yandex requirement 2.14 [9]; the RU audience | All UI strings in RU; `ysdk.environment.i18n.lang` honored |
| 5 | **Phone performance**: a 2-hour soak test on a mid-range Android, automatic reduce-effects, a mob cap per device tier | "Slideshow" complaints [2]; Yandex is 50% mobile web [8] | ≥ 30 fps after 2 h; no memory growth |
| 6 | **Per-platform builds with flags** (`own`, `yandex`, `crazygames`, `telegram`): no outside links and no claude.ai login in portal builds | Yandex 8.4.2 [9]; CrazyGames Basic Launch rules [14] | `tools/build.js` emits each target |
| 7 | **Payout scenario decided**: Russia-resident (A) or an entity outside Russia (B) | Tipalti (CrazyGames), Steam and Google Play don't pay Russian banks [34] | Written in MONETIZATION.md §2 |
| 8 | **Tracking links** for every planned post, made in `/admin` → Tracking links | First touch is credited forever (`bttn_vtouch`) | Links for weeks 2–4 exist |

## 4. Channel strategy, ranked

Reach is the realistic first-90-day reach for a new solo title. Every reach figure is **(est.)**, with its basis in
the source cited.

| Rank | Channel | Why | 90-day reach (est.) | Cost | Start | Keep or kill |
|---|---|---|---|---|---|---|
| 1 | **Yandex Games** | 50M+ monthly players, sessions near 60 min, purchase revenue for developers +75% in 2025 [7]; non-exclusive licence [10]; ranked on icon click rate, playtime per player per day and return rate [11] | 5k–100k players (one indie game got 8k in 2 weeks [12]) | $0 | Submit W3 | Rotate icons and covers until playtime and click rate rise |
| 2 | **Short video** (Shorts, Reels, TikTok, VK Clips) | The genre's proven ad: Survivor.io put 50% of its user-acquisition budget into TikTok [3]; one indie clip did 1M+ views on Reels [24] | 50k–1M views; 0.2–1% click through to play | $0 (+$100–400 boosts) | W2 | §8 rules per platform |
| 3 | **CrazyGames** | 35–50M monthly players, non-exclusive; Basic Launch needs no SDK [14] | Test traffic, then 10k–500k plays a month if it performs | $0 | Basic W2, Full W5–6 | Full Launch only if Basic passes |
| 4 | **Reddit** (r/incremental_games 190k, r/WebGames 144k, r/playmygame 145k, r/indiegames 338k [17]) | Where idle players find games | 300–5k visitors per good post | $0 | W2 | Post again only on major updates |
| 5 | **RU communities** (Pikabu League of Game Developers, DTF Indie, a VK group, your own Telegram channel) | Developer stories are welcome there, pure promo is not [36] | 1k–20k views per post | $0 | W3 | Keep if a post brings ≥ 100 players |
| 6 | **itch.io** (HTML5 page + devlogs) | Median 1,582 views and 590 browser plays; browser games get ~3× more players [18] | 0.6k–12k views | $0 | W2 | Always on; a devlog with every update |
| 7 | **Telegram Mini App** | 1B+ monthly users [45]; Stars purchases ($0.013 per Star to the developer [44]); `startapp` referral links | 1k–50k | $0–300 | W6 | Keep if invites per new player ≥ 0.3 |
| 8 | **Micro-creators** | Vampire Survivors and Megabonk spread through creators [4][38]; micro creators charge $400–3,500 a video [27] | 100–600 players per mid-size video | $0 → $1,500 | Pitch W5 | Pay only creators whose free traffic proved itself |
| 9 | **Show HN** | Front page brings 3.5k–25k visitors [19] | 0–15k, one shot | $0 | W4 | One shot; never share a link to the post [20] |
| 10 | **Steam** (desktop build of the web game) | The idle wave: Rusty's Retirement sold 100k in 5 days and ~330k by Aug 2024 [5]; Halls of Torment shipped a free Prelude with a carry-over save and passed 1M sales [6] | Under 1k wishlists → median +462 at Next Fest [22] | $100 + art | Page W9 | Go only if D7 ≥ 8% and a non-RU payout route exists |
| 11 | **Poki** | 100M monthly players, but only 227 new releases in 2025, and web-exclusive [16] | Free playtests | $0 | Test W1 | Don't sign until CrazyGames and Yandex data are in |
| 12 | **Newgrounds** | ~32M visits a month; Russia is its #2 country [51] | 500–5k | $0 | W3 | Low effort, keep |
| 13 | **Long-tail SDKs** (GamePush → VK, OK, Pikabu Games; Playgama → 100+ sites) | One SDK, many builds; Playgama keeps 70–90% for the developer, paid via Wise or crypto [35] | 1k–20k plays a month | $0 | W8 | Keep if the work stays under 1 day a month |
| 14 | **Paid tests** (Yandex Direct, VK Ads, TikTok in Brazil/Philippines/Indonesia) | Yandex Direct → a Yandex game cost ~3 RUB per player in one case [13]; VK Ads clicks cost 12.5 RUB [28] | Whatever you buy | $200–800 | W7 | Measurement only (§8) |
| 15 | **RuStore / Google Play** (web-app wrapper) | RuStore pays RU developers [52]; Google Play needs 12 testers × 14 days [50] and does not pay RU banks [34] | ~0 without store optimization | $25 | W11, conditional | Only if > 50% of own-site traffic is Android and D7 ≥ 8% |

**Skip for now:**
- an iOS wrapper (Apple rejects bare website wrappers);
- Facebook Instant Games (Facebook's web games shut down 2026-09-30);
- Kongregate (closed to new games since 2020);
- Product Hunt (a few hundred visitors);
- Discord Activities (pays only developers based in the US, UK or EU).

## 5. The 90-day plan

Day 1 is **Mon 2026-10-05**. A gate KPI must pass before the next phase spends effort on reach.

### 5.1 Week by week

| Week | Product and builds | Distribution | Clips | Gate |
|---|---|---|---|---|
| **W1** Oct 5–11 | Landing `/` + `/play`; skip the intro when arriving from the landing; ship 3.6 (P0 #3); start RU strings; PWA manifest; own short domain (~$10–15 a year) | Accounts: itch, CrazyGames, Yandex, Newgrounds, YouTube, TikTok, Instagram, VK, a Telegram channel. Warm up Reddit by commenting. Run a **Poki Player Fit Test** (500 players in ~5 h [16]). Build all tracked links for W2–W4. | Record 15 raw captures (phone, vertical) | Friends baseline: first_click ≥ 90%, class ≥ 85% |
| **W2** Oct 12–18 | RU in progress; automatic reduce-effects by device tier | **itch.io** page + devlog #1. **r/WebGames** and **r/incremental_games** (reply to every comment for 48 h). **CrazyGames Basic Launch** submitted. | 3: clip01, clip02, clip07 | ≥ 100 Reddit visitors; m5 ≥ 30% |
| **W3** Oct 19–25 | **Yandex build**: SDK, RU/EN automatic, cloud save, leaderboards, rewarded ads + full-screen ads at breaks; 3 icons × 3 covers. Submit (3–5 working days [9]). | Developer stories on **Pikabu** and **DTF**, linking to Yandex (referral link [46]). **Newgrounds** upload. r/indiegames GIF. | 4 + VK Clips with RU text | Yandex accepted |
| **W4** Oct 26–Nov 1 | Fix the biggest funnel drop; `/press` page | **Show HN** (Tue or Wed, 8–10 am US Eastern). Email Jay Is Games, Alpha Beta Gamer and Warp Door [49]. | 4 | **Phase gate:** own-site m5 ≥ 40%, D1 ≥ 15%, JS errors < 1% of sessions |
| **W5** Nov 2–8 | CrazyGames SDK → Full Launch (if Basic passed); Yandex icon and cover A/B | **Pitch 30 creators** (§5.5), each with its own `utm_content` | 4 | CrazyGames Full approved; Yandex playtime per day rising |
| **W6** Nov 9–15 | **Telegram Mini App**: WebApp SDK; `startapp` referral ("invite a friend, you both get an egg"); share card; Stars shop | Own Telegram channel + seed 3–5 small channels ($0–150) | 4 | Invites per new Telegram player ≥ 0.3 (est. target) |
| **W7** Nov 16–22 | Rewarded ads live on all builds that allow them | **Paid tests** ($500 tier): Yandex Direct → Yandex page $100; VK Ads → own site $50–100; Reels or TikTok boost in BR/PH/ID $100. Post to r/playmygame. | 4 | Cost per 5-minute player and D1, per paid source vs organic |
| **W8** Nov 23–29 | **Steam decision** (D7 ≥ 8%, m15 ≥ 20%, non-RU payout): pay the $100 fee, start the desktop build and capsule art. GamePush/Playgama for the long tail. | Reddit update #2 if there is a major patch; itch devlog #2 | 4 | The fee is paid ≥ 30 days before any release [21] |
| **W9** Nov 30–Dec 6 | **Steam "Coming soon" page.** "Wishlist on Steam" on the own site only. | Clips end with "play free in the browser + wishlist" | 4 | Wishlists per day |
| **W10** Dec 7–13 | **Winter Horde** event update | Patch-note posts: Reddit, Pikabu, DTF, Telegram, VK. **Paid creators** ($3,000 tier): 2–4 who matched in free outreach. | 4 | Players per $ per creator; creator D1 ≥ organic D1 |
| **W11** Dec 14–20 | Conditional: PWA → Google Play closed test + RuStore | A Discord server for players (bugs, builds) | 3 | ≥ 12 testers held for 14 days |
| **W12** Dec 21–27 | Next Fest demo build, 30-s trailer | Draft "90 days of BTTN in numbers" | 3 | — |
| **W13** Dec 28–Jan 3 | Register for Next Fest (deadline Jan 10) | Publish the numbers post (Pikabu, DTF, itch, r/incremental_games). Retro: keep the top 3 sources by score, cut the rest; plan a monthly land or event drop for Q1. | 3 | ≥ 1,000 wishlists before Next Fest (stretch [22]) |

### 5.2 Portal submission order

| # | Where | Week | Needs | Why here |
|---|---|---|---|---|
| 0 | Poki Player Fit Test (test only) | W1 | Poki SDK test build | Free real first sessions. Passing needs ≥ 3 min average and ≥ 25% of plays over 3 min [16]. |
| 1 | itch.io | W2 | `dist/bttn.html` zipped; tags incremental, idle, clicker, pixel-art, tower-defense | No review; devlogs |
| 2 | CrazyGames Basic Launch | W2 | No SDK, no outside links or login, PEGI 12 | A ~2-week test with no integration [15] |
| 3 | Yandex Games | W3 | SDK, RU + EN, cloud saves, ads and payments only through the SDK, no links | The RU/CIS cash channel; 3–5 working days of moderation [9] |
| 4 | Newgrounds | W3 | Upload | Pixel-art community; Russia is its #2 country [51] |
| 5 | CrazyGames Full Launch | W5–6 | SDK v3, `gameplayStart`, ads through the SDK, lands straight in gameplay | Revenue needs Full Launch; payouts need a non-RU account [14][34] |
| 6 | Telegram Mini App | W6 | Bot + WebApp + Stars invoices | Social loop for RU/CIS |
| 7 | Long tail via GamePush/Playgama (VK Games, OK, Pikabu Games, GameDistribution, Y8) | W8 | One aggregator SDK | Reach with no new code per site [35] |
| 8 | Steam "Coming soon" | W9 | $100, desktop build, capsule | Wishlists before Next Fest [22] |
| 9 | RuStore / Google Play | W11 (conditional) | Web-app wrapper; Play needs 12 testers × 14 days | Only on Android-heavy traffic |
| — | Poki release | Not before CrazyGames and Yandex data | 5-year web exclusivity by default [16] | It would pull every other web build |

### 5.3 Community post calendar

Rules:
- Make about 9 community contributions per 1 promo post.
- Reply to every comment for 48 h.
- Re-read each subreddit's sidebar the day you post.

| Week | Where | Format | Title (draft) | `utm_content` |
|---|---|---|---|---|
| W2 | r/WebGames | Link post straight to `/play`, game name first | BTTN — hold the Button against a 1,000-monster Horde (free pixel idle clicker, no sign-up) | `r_webgames` |
| W2 | r/incremental_games | Text post from the developer | I made a horde-defense clicker where you hold the Button: 1,000+ mobs, PoE-style loot, runs that pay fame. Feedback wanted | `r_incremental_games` |
| W2 | itch.io devlog #1 | Devlog | What BTTN is, and the next 4 weeks | `itch_devlog1` |
| W3 | Pikabu, League of Game Developers | Developer story | «Сделал игру в одном HTML-файле: 1000 мобов и лут как в PoE — что я понял» | `pikabu_gamedev` |
| W3 | DTF, Indie | Developer diary with GIFs | «Кликер, где ты держишь Кнопку против орды: как я собрал его в 1,5 МБ» | `dtf_indie` |
| W3 | r/indiegames | GIF (meteor shower) | Meteor shower over a 1,000-mob horde in my browser clicker | `r_indiegames` |
| W4 | Hacker News | Show HN | Show HN: BTTN – a 1.5 MB single-file pixel clicker with a 1,000-mob horde (vanilla JS) | `hn_showhn` |
| W4 | r/pixelart | Sprite sheet (link in a comment only if allowed) | 75 walking mob sprites for 15 lands | `r_pixelart` |
| W6 | Own Telegram channel + 3–5 seeded channels | Mini App launch | «BTTN теперь в Telegram: зови друга — оба получите яйцо» | `tgch_<channel>` |
| W7 | r/playmygame | Feedback request on an update | — | `r_playmygame` |
| W8 | itch devlog #2, Reddit update | Patch notes | — | `upd_3_7` |
| W10 | Reddit, Pikabu, DTF, Telegram, VK | Event post | Winter Horde event | `upd_winter` |
| W13 | Pikabu, DTF, itch, r/incremental_games | Numbers post | 90 days of a free browser game: players, D1, money (real numbers) | `post_90days` |

### 5.4 Short-video plan

- **Cadence:** 3–5 a week. Four is the sweet spot [23].
- **Length and format:** 8–20 s, vertical 1080×1920, captured from the game in portrait.
- **Distribution:** the same clip goes to Shorts, Reels, TikTok and VK Clips. VK Clips gets the RU text.
- **First 1–2 seconds:** the payoff, with on-screen text and no logo intro.
- **Link:** in the bio or a pinned comment, with `utm_medium=video&utm_content=<clip id>` or `?ref=ttbio`. In-app
  browsers often drop the referrer.

| ID | Hook text (first 2 s), EN / RU | What's on screen | Length | CTA |
|---|---|---|---|---|
| `clip01_horde` | "1,000 monsters want this Button." / «1000 монстров хотят эту Кнопку.» | Zoom out from the Button to a full-screen Horde; a meteor shower clears it | 12 s | "Free in browser" |
| `clip02_fall` | "I let go for 3 seconds." / «Отпустил на 3 секунды.» | The Button cracks, the party falls, THE BUTTON FELL, fame; the next run steamrolls the same land | 15 s | "Would you have held?" |
| `clip03_relic` | "1 boss in 600 drops this." / «Это падает с 1 босса из 600.» | Relic cinematic: darkness, a spear of light, the bag bursts, the card | 10 s | "Link in bio" |
| `clip04_legend` | "1 in a million clicks. It happened." / «1 на миллион кликов. Выпало.» | Button of Legends reveal with the click counter visible | 10 s | "Play free" |
| `clip05_hold` | "Hold SPACE. That's the whole game. (It isn't.)" / «Держи ПРОБЕЛ. Это вся игра. (Нет.)» | A hand holds Space; montage of the party, town and loot | 15 s | "Try it" |
| `clip06_numbers` | "10 gold → 10^15 in 20 seconds." / «От 10 золота до 10^15 за 20 секунд.» | Timelapse of gold per second over a run | 20 s | "How far would you get?" |
| `clip07_meteor` | "POV: your Hand learned Meteor Shower." / «Когда Рука выучила Метеоритный дождь.» | One spell over a dense pack, gibs, numbers | 8 s | Loop |
| `clip08_merchant` | "He shows up 0.07% of the time. Tap him." / «Он приходит в 0,07% случаев. Жми.» | The Lucky Merchant walks in; a 30-s shop of bargains | 12 s | "Have you met him?" |
| `clip09_build` | "Glass Run + Greed: broken or genius?" / «Стеклянный забег + Жадность: имба или провал?» | Blessing pick → a wild run | 20 s | A question in the comments |
| `clip10_onefile` | "This whole game is one 1.5 MB HTML file." / «Вся игра — один HTML-файл на 1,5 МБ.» | File size, 1,000 mobs, the code scrolling | 25 s | For HN, Pikabu and DTF too |

**Series that follow once a format works:**
- 8 Land Champion rules, one per clip ("This one splits in three");
- the party roles ("My knight holds the line");
- one land a week ("Land 7 of 15").

**Rule:** once 9 clips are out, double the formats whose clips beat the median on m5 per visitor in `/admin` →
Campaigns, and drop the bottom 3.

### 5.5 Creator outreach

| Type | How to find | Size | Ask | Pay |
|---|---|---|---|---|
| EN idle and incremental YouTubers (e.g. Kosh Idle, IdleNiv, Tristan Makes Stuff) | YouTube search "idle game 2026", "incremental game review", sorted by upload date | 5k–100k | A free play video | $0 first. $200–1,500 integrations [27] only for creators whose free coverage proved itself. |
| Survivors-like and roguelite YouTubers and streamers | Search "bullet heaven", "Vampire Survivors-like", "Megabonk" | 10k–200k | A run on stream | $0, then paid if proven |
| Browser-game sites | Jay Is Games, Alpha Beta Gamer, Warp Door [49] | — | A write-up | $0 |
| Small Twitch variety streamers (50–500 viewers) | Twitch Indie and Just Chatting directories | — | Play live, use a streamer code | $0 |
| Pixel-art and gamedev creators | TikTok, Shorts, X: #pixelart #gamedev | — | Stitch or duet the one-file clip | $0 |
| RU YouTube and VK Video let's-players | VK Video search «кликер обзор», «инди игры» | 5k–100k | A video | $0, then rubles if proven |
| RU Telegram game and gamedev channels | tgstat.ru, category «Игры» | 2k–50k subscribers | A post (paid seeding) | 250–400 ₽ per 1,000 views [30] |

**Process.**
1. Pitch 30, each with its own `utm_content=creator_<handle>`.
2. Send one follow-up after 7 days, then stop.
3. Log each pitch in a sheet: date, reply, video, visitors, m5, D1.
4. Keymailer's free plan covers 10 requests a month [48]. A free browser game needs no keys.

**Template (EN).**

> Subject: A free browser horde-clicker for your channel (no keys, no sign-up)
>
> Hi {name}, I'm {owner}, the solo dev of BTTN. Your video on {game} ({one specific detail}) is why I'm writing.
> BTTN is "Vampire Survivors, but you're the clicker": you hold one Button while your party fights a 1,000-monster
> Horde, loot drops PoE-style, and every time the Button falls the next run gets stronger. It's free in the browser,
> 1.5 MB, and works on phones too.
> Your link: {domain}/play?utm_source=youtube&utm_medium=influencer&utm_content=creator_{handle}
> A run worth a video: pick the **Glass Run** blessing and push to the first lord (~10 min).
> Press kit (GIFs, logo, facts): {domain}/press. Streaming and monetized videos are welcome.
> No strings attached. If you play it, I'd love the honest take, and I'll fix what you hate.
> {name} · {email} · {telegram}

**Template (RU).**

> Тема: Бесплатный браузерный кликер против орды — для вашего канала
>
> Привет, {имя}! Я {имя}, один делаю игру BTTN. Пишу из-за вашего видео про {игра} ({конкретная деталь}).
> BTTN — это «Vampire Survivors, только ты — кликер»: держишь одну Кнопку, а отряд отбивается от орды в 1000 монстров,
> лут падает как в PoE, а каждое падение Кнопки делает следующий забег сильнее. Бесплатно, в браузере и на телефоне,
> 1,5 МБ.
> Ваша ссылка: {домен}/play?utm_source=vk&utm_medium=influencer&utm_content=creator_{ник}
> Забег для ролика: благословение «Стеклянный забег» и до первого лорда (~10 минут).
> Пресс-кит: {домен}/press. Стримить и монетизировать видео можно.
> Без условий. Если сыграете, буду рад честному мнению, а то, что не понравится, исправлю.

### 5.6 RU/CIS plan

| When | Action | Notes |
|---|---|---|
| W1–W3 | RU localization; Yandex title «BTTN: Кликер против Орды». Icons without text; keywords go in the title [11]. | Yandex players skew 25+ and female [8]: show the town and pets next to the Horde in its art |
| W1→ | VK group + VK Clips (every clip with RU text); VK Video for long devlogs | VK Video reaches more Russians than YouTube (82.8M vs 65.9M, Jan 2026) [25]. Instagram is blocked in Russia. |
| W1→ | Own Telegram channel: patch notes, rare-drop screenshots; later a **daily code** (Hamster Kombat's daily ritual, without a token) | The tap-to-earn bust: −86% monthly users [32] |
| W3 | Pikabu and DTF developer stories | Pikabu allows game ads only to Pikabu Games [36] |
| W3 | Every RU link to Yandex uses the **referral link** | Yandex shares ad and purchase revenue from new players you bring [46] |
| W6 | Telegram Mini App + seeding 3–5 channels (250–400 ₽ per 1,000 views [30]) | Fixed-content Stars items only |
| W7 | Yandex Direct → the Yandex Games page (~3–20 ₽ per player [13][28]); VK Ads → own site | Never buy incentivized or bot traffic to the Yandex build: bot traffic can zero a month of revenue [47] |
| W8 | GamePush → VK Games, OK, Pikabu Games | Payouts in rubles |
| W11 | RuStore (conditional) | 68M monthly users; pays RU developers [52] |

## 6. Budget tiers and expected results

| Item | $0 | $500 | $3,000 |
|---|---|---|---|
| Domain, PWA | stay on railway.app | $15 | $15 |
| Portals, Reddit, HN, Pikabu, DTF, own Telegram and VK | ✓ | ✓ | ✓ |
| Short-video boosts | — | $100 (top 2 clips) | $400 |
| Telegram channel seeding (RU) | — | $100 (~25k views at ~350 ₽ per 1,000) | $300 |
| Paid tests (Yandex Direct, VK Ads, TikTok tier 3) | — | $200 ($50–100 per test) | $800 (3 countries × 2 channels) |
| Creators | free outreach | $0–100 shout-outs | $1,000–1,500 (2–4 micro integrations) |
| Steam | — | — | $100 fee + $300–500 capsule and trailer |
| Google Play / RuStore | — | — | $25 |
| Tools and reserve (clip editor, Keymailer Indie) | free | $85 | $300 |
| **Total** | **$0** | **~$500** | **~$3,000** |

| Tier | Expected players in 90 days (est.) | Basis | Expected 180-day revenue from them (est.) |
|---|---|---|---|
| $0 | **10k–60k**, most from Yandex | Yandex 5k–100k [12]; 2–3 Reddit posts × 300–5k; itch 0.6k–12k views [18]; clips 50k–1M views × 0.2–1% | ~$600–3,800 at the blended $0.064 per install (MONETIZATION.md §10) |
| $500 | $0 tier **+ 1.5k–5k** paid and seeded players | $100 Yandex Direct ≈ 8,300 ₽ ÷ 3–20 ₽ per player; VK clicks 12.5 ₽ [28]; tier-3 TikTok clicks $0.31 [29] | Paid players repay ~10–30% of their cost. What this tier buys is the cost per 5-minute player for each channel. |
| $3,000 | $0 tier **+ 5k–15k** players, plus a Steam page | 2–4 creator videos × 100–600 players; 6 paid tests; Steam with ≥ 1,000 wishlists as the stretch (median +462 during Next Fest for pages under 1k [22]) | The ads and purchases don't repay it. It pays off later through Steam sales and creator reach. |

## 7. UTM conventions

How the game attributes a visitor (`js/analytics.js`):
- The **source** is `utm_source`, else `ref`, else the referrer's host, else `(direct)`.
- The **first touch is stored forever** per browser (`bttn_vtouch`), so returning visitors keep crediting it.
- Analytics does **not** run in portal builds or on claude.ai. Read portal traffic in each portal's dashboard.

| Param | Values (lowercase, `_` instead of spaces) | Example |
|---|---|---|
| `utm_source` | `reddit` `hn` `itch` `newgrounds` `youtube` `tiktok` `instagram` `vk` `telegram` `pikabu` `dtf` `discord` `x` `bluesky` `email` `press` `qr` `site` | `reddit` |
| `utm_medium` | `post` `comment` `video` `bio` `story` `ad` `influencer` `seed` (paid Telegram post) `crosspromo` `press` | `post` |
| `utm_campaign` | `launch_oct26`, `wk01`…`wk13`, `upd_3_7`, `winter_horde`, `nextfest_feb27` | `launch_oct26` |
| `utm_content` | The asset: subreddit, clip id, creator, creative | `r_webgames`, `clip07_meteor`, `creator_koshidle`, `tgch_gamedevru` |
| `utm_term` | Paid ads only: `<country>_<os>_<age>` | `br_android_18_34`, `ru_all_25_44` |
| `ref` (short, for bios and QR codes) | `ttbio` `ytbio` `igbio` `vkgroup` `tgchan` `qr_<place>` | `?ref=ttbio` |

Ready links (make each one in `/admin` → Tracking links):
- `{domain}/play?utm_source=reddit&utm_medium=post&utm_campaign=launch_oct26&utm_content=r_webgames`
- `{domain}/?utm_source=youtube&utm_medium=video&utm_campaign=wk03&utm_content=clip01_horde`
- `{domain}/?utm_source=vk&utm_medium=ad&utm_campaign=wk07&utm_content=vkads_horde&utm_term=ru_all_25_44`
- Telegram: `t.me/<bot>/play?startapp=tgch_<channel>`. The Mini App maps `start_param` to `src`/`cnt`; that code
  change is part of the Telegram build.

## 8. KPI targets and decision rules

### 8.1 Targets

These come from GDD §7 and outside benchmarks.

| Stage | Metric (`/admin`) | Target | Benchmark |
|---|---|---|---|
| Landing | Landing → PLAY (`lp_play` ÷ `lp_view`) | ≥ 70% | Poki aims for 65%+ of visitors to start playing [16] |
| Activation | Pressed the Button (`first_click` ÷ `visit`) | ≥ 90% | P0 #2 |
| Activation | Picked a class | ≥ 85% | GDD §7 |
| Engagement | Played 5 min (`m5`) | ≥ 40% | GDD §7 |
| Engagement | Reached land 2 | ≥ 35% (est.) | Lands change every few minutes since 3.4 |
| Retention | D1 | ≥ 20% (stretch 35%) | Median mobile game ~18–22% [33] |
| Retention | D7 | ≥ 8% | Median mobile game < 4% [33] |
| Portal | Poki Player Fit Test | ≥ 3 min average and ≥ 25% of plays > 3 min | [16] |
| Portal | Yandex playtime per player per day; icon click rate | Rising week on week | [11] |
| Paid | Value per install ÷ cost per install | > 1.3 to scale | MONETIZATION.md §10 |
| Steam | Wishlists before Next Fest | ≥ 1,000 (stretch) | [22] |

### 8.2 Decision rules

The quality score is `0.2·class + 0.3·m5 + 0.2·land2 + 0.3·D1`, and it falls back to "came back" until D1 data has
matured. A source at exactly the design targets (85 / 40 / 35 / 20) scores **42**.

| Situation | Rule |
|---|---|
| Fewer than 100 visitors from a source (`*` = under 20) | Don't judge it yet. Keep posting. |
| Score ≥ 42 **and** D1 ≥ 20% | **Scale:** more posts, a boost, a creator budget, the next subreddit or community of the same kind |
| Score 30–41 | **Fix:** open the Funnel with `?src=<source>&dev=<device>`, fix the step with the biggest relative drop, try one new creative |
| Score < 30 after 100+ visitors and 2 creatives | **Kill** the channel, or move it to repost-only |
| Paid source | Kill if the cost per 5-minute player is > 3× organic value per player. Scale only when **all** the global targets are met (class ≥ 85%, m5 ≥ 40%, D1 ≥ 20%, D7 ≥ 8%) and value ÷ cost > 1.3. |
| A short-video platform after 9 clips (3 weeks) | If its median clip has < 500 views and < 20 visitors to the game, repost only. Effort goes to the best platform. |
| The whole product: D1 < 15% after W4 | **Stop adding channels.** Every hour goes into the first session until D1 ≥ 20%. |
| In-app browser share is high but m5 is low (Browsers card) | Add an "Open in browser" hint for that app |
| Yandex: playtime and icon click rate both fall 2 weeks running | Swap the icon or cover, then the first 60 s of play |
| Full-screen ads (portals) | Stop rule from MONETIZATION.md: D1 −2 pp or D7 −1 pp against the holdout → show them less often |

### 8.3 Weekly review (30 min, Mondays)

1. Sources: the top 5 by score, and whether any crossed 42 or fell below 30.
2. Funnel: the step with the biggest drop, overall and for the top source. Pick **one** fix for this week.
3. Cohorts: D1, D3 and D7 for last week, compared with the week before (after every patch).
4. Campaigns: rank the clips and creators by m5 and by came back.
5. Portals: Yandex and CrazyGames console numbers go into the same sheet.
6. Decide: keep or kill each channel; the 3 posts and 4 clips for next week.

## 9. Press kit checklist (`/press`, EN + RU)

- [ ] One-line pitch, plus a 100-word and a 300-word description.
- [ ] Fact sheet:
  - [ ] developer and contact;
  - [ ] release date, platforms, price (free) and languages;
  - [ ] file size (1.56 MB), "no download, no sign-up";
  - [ ] links (play, Telegram, Yandex, itch, Steam when live).
- [ ] 6 GIFs or MP4s (≤ 8 MB each): Horde + meteor, the fall, relic drop, loot beam, town, party roles.
- [ ] 8 screenshots at 1920×1080 and 4 phone screenshots at 1080×1920.
- [ ] A 30-s trailer (MP4, YouTube, VK Video).
- [ ] Logo (transparent PNG, and SVG if possible), key art 1920×1080, icon 512×512. Steam capsules later.
- [ ] A short developer bio and photo (optional).
- [ ] **"Streaming and monetized videos are allowed"**, plus a music note.
- [ ] Creator extras: a seed or blessing combo for streams, and a redeemable code for viewers once codes exist.
- [ ] Quotes and coverage, added as they arrive (never invented).
- [ ] Portal asset packs to each portal's spec: icons, covers, screenshots, video.

## 10. Landing page brief

**Goal.** A visitor taps PLAY within 3 seconds, and the rest of the page sells depth and fairness in under 3 phone
screens. Keep it small, tight and juicy: the same pixel font, palette and glow as the game.

**Constraints.**
- **Routes.** `/` is the landing; `/play` is the game.
  - The landing's PLAY goes to `/play` with the **same query string**, and writes `bttn_vtouch` if it is missing.
  - It sets `sessionStorage.bttn_lp = 1` so the game skips its title or intro and lands straight in the class pick or
    the first press.
- **Speed.** Prefetch `/play` after first paint.
  - The page is ≤ 60 KB before media, with ≤ 15 KB of JS and no framework.
  - The hero video is ≤ 700 KB, muted, looping and lazy, with a poster WebP ≤ 80 KB. `saveData` or
    `prefers-reduced-motion` gets the poster only.
  - LCP ≤ 1.5 s on 4G.
- **Desktop.** Space or Enter presses PLAY (it teaches HOLD SPACE).
- **Phone.** PLAY sits in the thumb zone and is ≥ 64 px tall. Respect safe areas, keep 16 px side gutters, no
  horizontal scroll.
- **Languages.** EN/RU switch, chosen automatically from `navigator.language`, with `hreflang` tags.
- **Meta.** Title `BTTN — Don't let the Button break · Free idle horde clicker`; OG image `/og.png` (1200×630);
  `VideoGame` schema.org JSON-LD (free offer, genre, platform: web browser); canonical URL.
- **Tracking.** Send `lp_view`, `lp_play{pos}`, `lp_support{sku}`, `lp_platform{pf}` and `lp_faq{q}` to `/api/ev` with
  the same `bttn_vid`. Add a "landing → play" step to the `/admin` funnel.
- **No ads, no pop-ups and no cookie wall.** Analytics is anonymous and keeps no cookies (GPC is honored).

**Sections and copy.** RU copy follows each EN line.

1. **Hero** (full viewport). Background: a looping clip of the Horde at the Button with a meteor shower, under a dark
   gradient. The PLAY button *is* the glowing Button sprite.
   - Logo: **BTTN**
   - Headline: **Don't let the Button break.** / «Не дай Кнопке сломаться.»
   - Subline: *Hold it against a 1,000-monster Horde. Your party fights, your clicks call lightning, the loot rains.
     Free in your browser.* / «Удержи её против орды в 1000 монстров. Отряд сражается, клики бьют молнией, лут сыплется
     дождём. Бесплатно, прямо в браузере.»
   - CTA: **PLAY FREE** / «ИГРАТЬ»
   - Micro-line: *No download · No sign-up · Phone & desktop* (desktop adds: *or press SPACE*) / «Без скачивания · Без
     регистрации · Телефон и ПК»
   - Scroll cue: a small ▼ "What is this?"
2. **Three features** (3 cards in a row on desktop, stacked on phone; each has a looping 3-s GIF or WebP ≤ 150 KB):
   - **One finger. A thousand monsters.** *Click or hold the Button. Your knight holds the line, your cleric heals, your
     archer flanks, and your Hand drops meteors on the Horde.* / «Один палец. Тысяча монстров.» «Кликай или держи
     Кнопку. Рыцарь держит строй, клирик лечит, лучник бьёт с фланга, а твоя Рука обрушивает метеоры на орду.»
   - **Loot worth screaming about.** *Seven rarities with beams and sounds, 19 uniques that bend the rules, and 8 relics
     from about 1 boss in 600.* / «Лут, ради которого орёшь.» «Семь редкостей со столбами света, 19 уникальных
     предметов, меняющих правила, и 8 реликвий — примерно с 1 босса из 600.»
   - **Every fall makes you stronger.** *When the Button falls, the run pays fame. Conquer 15 lands, build a town of 11
     buildings, and come back deeper. Weeks of play, 3–30 minutes at a time.* / «Каждое падение делает сильнее.» «Когда
     Кнопка падает, забег приносит славу. 15 земель, город из 11 зданий, и каждый раз глубже. Недели игры по 3–30
     минут.»
3. **Social proof** (a placeholder, hidden until the data is real):
   - **{N} players held the Button this week.** The number is rounded down to the hundreds and shown only above 500.
     It comes from a public `/api/pub/players` endpoint.
   - 1–3 quote cards: "{quote}" — {source}, e.g. *r/incremental_games*, *Jay Is Games*.
   - An "As seen on" row: Yandex Games · CrazyGames · itch.io, each shown only once live.
4. **Support + platforms** (monetization on the site; full spec in MONETIZATION.md §6):
   - Title: **Free forever. Support it if you like it.** / «Бесплатно навсегда. Поддержи, если нравится.»
   - Body: *Made by one developer. Nothing for sale is random, and nothing for sale is power you can't earn by playing.*
     / «Игру делает один человек. Ничего случайного за деньги и никакой силы, которую нельзя заработать игрой.»
   - Three cards:
     - **Supporter Pack** $9.99 / 599 ₽ ("Founder Button, gold lightning, a gold name on the ladder, skip any ad-bonus
       video");
     - **Looks** from $0.99 (a strip of 4 Button skins);
     - **Buy the Warden a pie** $2.99 (a tip).
   - Each card deep-links into the in-game shop: `/play?open=shop&sku=<id>`.
   - A link to the **fair-play pact**.
   - A platform row: Play in Telegram · Yandex Games · CrazyGames · Wishlist on Steam. Each badge shows only when live,
     and only on the own site.
5. **FAQ** (accordion, 6 items):
   - *Is it really free?* Yes, the whole game. Optional looks and a Supporter Pack fund development. No energy, no
     timers on offers, no paid loot boxes.
   - *Do I need to download or sign up?* No. Press Play. It runs in any modern browser, on phone or desktop.
   - *Is my progress saved?* Yes, automatically in this browser, and Settings → Export gives you a save code. Cloud save
     comes with an account (built in on Telegram and Yandex).
   - *How long is it?* Weeks. 15 lands of 3 zones, a town to build, 19 uniques, 8 relics, and runs that make you
     stronger each time the Button falls. A session is 3–30 minutes.
   - *Can I play idle?* Yes. Hold the Button (or Space) and the party fights on. While you're away, your garrison and
     Warden keep earning for up to 4 hours.
   - *Is there gambling?* No. There are no slot machines, no paid loot boxes and no premium currency. Rare drops are
     earned by playing.
6. **Footer:**
   - *BTTN · made by one developer · © 2026*
   - Links: Patch notes · Press kit · Fair play · Privacy · Contact
   - Icons: Telegram channel, VK, YouTube, Reddit
   - *Anonymous play stats, no cookies, Global Privacy Control respected.*
   - EN | RU switch

## Sources

All accessed 2026-10-04 unless another date is given.

| # | Source |
|---|---|
| 1 | Sensor Tower, top 5 idle games by US revenue, Q3 2024 (2024-10) — https://sensortower.com/blog/2024-q3-unified-top-5-idler%20games-revenue-us-602ae7fb241bc16eb874f8e1 |
| 2 | Steam, Click the Button, plus the Steam store and review API (queried 2026-10-04) — https://store.steampowered.com/app/3946950/Click_the_Button/ |
| 3 | Naavik, How Habby mastered TikTok UA for Survivor.io (2022) — https://naavik.co/digest/how-habby-mastered-tiktok-ua-for-survivor/ |
| 4 | How To Market A Game, Vampire Survivors' success (2022-01-31) — https://howtomarketagame.com/2022/01/31/vampire-survivors-success-an-opportunity-in-the-steam-marketplace/ |
| 5 | GameDiscoverCo, Rusty's Retirement (2024-08-28) — https://newsletter.gamediscover.co/p/how-rustys-retirement-idle-farmed |
| 6 | GamingOnLinux, Halls of Torment passes 1M (2024-10-18) — https://www.gamingonlinux.com/2024/10/halls-of-torment-hits-1-million-sales-more-free-updates-planned/ |
| 7 | wnhub, Yandex Games 2025 results (2026-01-27) — https://wnhub.io/news/other/item-49945 |
| 8 | wnhub, Yandex Games at CII Minsk 2025 (2025-05-19) — https://wnhub.io/news/monetization/item-47819 |
| 9 | Yandex Games, game requirements — https://yandex.com/dev/games/doc/en/concepts/requirements |
| 10 | Yandex Games licence for developers (ed. 2025-11-28) — https://yandex.ru/legal/licensegames/ru/ |
| 11 | DTF, Yandex Games guide from a clicker developer (2024-12-07) — https://dtf.ru/indie/3258027-long-yandeks-igry-gaid-na-100k-nanosek-s-klikerov-i-o-tom-kak-zaletet-v-veb-razrabotku |
| 12 | Habr, earnings from Yandex Games (2023-01-01) — https://habr.com/ru/articles/708834/ |
| 13 | Pikabu, Yandex Direct for a Yandex game: players and cost (2024-01-19) — https://pikabu.ru/story/kupil_reklamu_dlya_igryi_cherez_yandeksdirekt__skolko_prishlo_igrokov_i_za_kakuyu_tsenu_11039557 |
| 14 | CrazyGames requirements, FAQ, payouts — https://docs.crazygames.com/requirements/intro/ · https://docs.crazygames.com/faq/ · https://docs.crazygames.com/payouts/ ; GamesBeat, 35M users — https://gamesbeat.com/crazygames-hits-35m-users-for-browser-games-and-launches-social-multiplayer-features/ |
| 15 | Cinevva, publishing on CrazyGames (2026-07-17) — https://app.cinevva.com/guides/publish-game-crazygames |
| 16 | Poki, Working with Poki; How testing works; 2025 year in review (2025-12-03) — https://developers.poki.com/guide/working-with-poki · https://developers.poki.com/guide/how-testing-works · https://poki.com/blog/2025-at-poki-a-year-in-review |
| 17 | threadfox, subreddit rules and sizes (read 2026-09-24 to 10-04) — https://threadfox.vip/rules/for/games |
| 18 | How To Market A Game, itch.io traffic benchmark (2025-05-12) — https://howtomarketagame.com/2025/05/12/benchmark-itch-io-traffic/ |
| 19 | Hacker News, Show HN rules; awesome-directories, HN front-page traffic — https://news.ycombinator.com/showhn.html · https://awesome-directories.com/blog/hacker-news-front-page-guide/ |
| 20 | itch.io forum, launch-week postmortem of a solo browser tower defense (~2026-07) — https://itch.io/t/6645181/launch-week-postmortem-solo-browser-td-product-hunt-a-portal-rejection-and-a-flagged-show-hn-numbers-inside |
| 21 | Steamworks, Next Fest February 2027; Steam Direct — https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest/feb_2027 · https://partner.steamgames.com/steamdirect |
| 22 | How To Market A Game, Next Fest benchmarks (2025-03-26, updated 2026) — https://howtomarketagame.com/2025/03/26/benchmarks-how-many-wishlists-can-i-get-from-steam-next-fest/ |
| 23 | CloutBoost, TikTok's changing landscape for game marketing (2025-12-02) — https://www.cloutboost.com/blog/tiktoks-changing-landscape-for-game-marketing-in-2026-what-developers-need-to-know |
| 24 | Acorn Games, our video went viral (2026-02) — https://acorngames.gg/blog/2026/2/3/our-video-went-viral-a-deep-dive-on-how-we-did-it |
| 25 | Sostav, VK Video passes YouTube in Russia (2026-02); CNews, VK Clips 3B views a day (2026-07-08) — https://www.sostav.ru/publication/vk-video-obognal-youtube-po-okhvatu-auditorii-v-rossii-81581.html · https://www.cnews.ru/news/top/2026-07-08_auditoriya_youtube_v_rossii_prodolzhaet |
| 26 | Tracking Exposed, TikTok blocks 95% of content in Russia (2022) — https://tracking.exposed/press/releases/tiktok-blocks-95-of-content-for-users-in-russia/ |
| 27 | LaunchPoint, gaming micro-influencer rates (2026) — https://www.launchpointhq.com/guides/rates/how-much-do-gaming-micro-influencers-charge |
| 28 | click.ru, CPC/CTR/CPM over a year (2025-10-22) — https://blog.click.ru/analytics/god-reklamy-v-cifrax-kak-izmenilis-cpc-ctr-i-cpm/ |
| 29 | digitalapplied, TikTok ads benchmarks 2026; adamigo, Meta CPC by country 2026 — https://www.digitalapplied.com/blog/tiktok-ads-benchmarks-2026-cpc-cpm-cvr-industry · https://www.adamigo.ai/blog/meta-ads-cpm-cpc-benchmarks-by-country-2026 |
| 30 | eLama, Telegram CPM (2026) — https://elama.ru/blog/vse-chto-nuzhno-znat-o-cpm-v-telegram-ads/ |
| 31 | Nintendo Life, PEGI's new ratings for loot boxes (2026-03); PEGI, gambling — https://www.nintendolife.com/news/2026/03/pegi-targets-loot-boxes-with-its-new-overhauled-ratings-system · https://pegi.info/gambling |
| 32 | crypto.news, Hamster Kombat exodus (2024-11); The Block, Telegram games in Q4 (2025-01) — https://crypto.news/hamster-kombat-ended-in-a-mass-exit-260-mln-players/ · https://www.theblock.co/post/339563/telegram-games-had-trouble-earning-revenue-retaining-users-in-q4-report |
| 33 | GameAnalytics, 2026 mobile and PC benchmarks (2026-06-04) — https://www.gameanalytics.com/reports/2026-mobile-pc-gaming-benchmarks |
| 34 | Creative Market, Tipalti and sanctions; RBC, Steam from Russia (2025); Vedomosti, Google Play stops paying (2024-12-13) — https://support.creativemarket.com/hc/en-us/articles/6204217395867-FAQ-Russian-Sanctions-Payouts · https://companies.rbc.ru/news/B3OM4zV5A0/kak-opublikovat-igru-v-steam-v-2025-godu-razrabotchikam-iz-rossii/ · https://www.vedomosti.ru/technology/articles/2024/12/13/1081372-google-play-perestanet-platit |
| 35 | Playgama for developers; GamePush — https://playgama.com/developers · https://gamepush.com/ru/ |
| 36 | Pikabu ad rules; Pikabu League of Game Developers; DTF rules — https://pikabu.ru/information/adrules · https://pikabu.ru/community/Gamedev · https://dtf.ru/rules |
| 37 | Yodo1, Idle Slayer × Attack on Titan (2026-01-13) — https://www.yodo1.com/case-studies/idle-slayer-x-attack-on-titan |
| 38 | Wikipedia, Vampire Survivors; Megabonk — https://en.wikipedia.org/wiki/Vampire_Survivors · https://en.wikipedia.org/wiki/Megabonk |
| 39 | GameSpot, Bongo Cat doesn't make money (2025) — https://www.gamespot.com/articles/viral-steam-hit-bongo-cat-doesnt-actually-make-any-money/1100-6532777/ |
| 40 | Steam, Idle Champions negative reviews — https://steamcommunity.com/app/627690/negativereviews/ |
| 41 | Wikipedia, Cookie Clicker; htxt, Cookie Clicker's first week on Steam (2021-09-09) — https://en.wikipedia.org/wiki/Cookie_Clicker · https://htxt.co.za/2021/09/09/cookie-clicker-has-a-strong-first-week-on-steam/ |
| 42 | mobilegamer.biz, Survivor.io passes $75m (2022-10) — https://mobilegamer.biz/two-months-in-survivor-io-passes-75m-from-37m-downloads/ |
| 43 | GameRant, Tap Tap Loot (2026), and Steam negative reviews (app 3959890) — https://gamerant.com/tap-tap-loot-release-date-time-when-come-out/ |
| 44 | adminhub, withdrawing Telegram Stars (2026-07-27) — https://adminhub.tools/blog/withdraw-telegram-stars/ |
| 45 | Pavel Durov, 1B monthly users (2025-03) — https://x.com/durov/status/1902454590747902091 |
| 46 | Yandex Games, the referral program (2023-01-20) — https://yandex.ru/blog/gamesfordevelopers/zarabatyvayte-na-reklame-s-referalnoy-programmoy-yandeks-igr |
| 47 | vc.ru, Yandex Games zeroed an indie developer's revenue — https://vc.ru/claim/2959132-kak-yandeks-igry-obnulili-dokhod-indi-razrabotchika |
| 48 | CreatorScout, creator outreach tools for indie games (2026) — https://www.creatorscout.dev/compare/best-creator-outreach-tools-for-indie-games |
| 49 | Jay Is Games; Alpha Beta Gamer — https://jayisgames.com/browser/ · https://www.alphabetagamer.com/ |
| 50 | Google Play Console Help, testing requirements for new personal accounts — https://support.google.com/googleplay/android-developer/answer/14151465 |
| 51 | Similarweb, newgrounds.com (Jul 2026, via search) — https://www.similarweb.com/website/newgrounds.com/ |
| 52 | yagla, RuStore passes 68M monthly users (2026-08) — https://yagla.ru/blog/o-saitah/ejemesyachnaya-auditoriya-rustore-prevysila-68-mln-polzovateley--2608u106040/ |
