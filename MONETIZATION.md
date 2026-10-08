# BTTN — Monetization model

This is the model, with enough detail to build from. Numbers carry a source tag like [16], listed at the end.
**(est.)** marks our own estimate, with its basis given next to it. Research date: 2026-10-04. Exchange rate: 1 USD =
83.48 RUB (Bank of Russia, 2026-10-03) [28].

Related documents: marketing in [MARKETING.md](MARKETING.md), systems in [GDD.md](GDD.md).

## 0. Decisions

1. **The game is free everywhere.** Money buys looks, time and convenience. It never buys a random outcome, and never
   buys power a free player can't get.
2. **No paid random items, not even with odds shown** (§1.1).
3. **No premium currency.** Prices are in real money (₽, $). Platform currencies (Telegram Stars, Yandex's Yan) are used
   only where the platform requires them, one price per item (§1.2).
4. **The main product is the Supporter Pack: $9.99 / 599 ₽ / 500⭐.**
   - The first offer is the Starter Kit at $1.99, shown once after the first THE BUTTON FELL, with no timer.
   - No single item costs more than $19.99.
5. **Ads are opt-in rewarded videos first.**
   - 6 rewarded placements at launch; about 2 views per daily player; a hard cap of 12 a day.
   - Full-screen ads run only in portal builds, at natural breaks, and never in a player's first 10 minutes.
   - **The own site and Telegram show no full-screen ads and no banners.**
6. **Payment rails depend on where the owner is a tax resident.**
   - **Scenario A (Russia-resident, the default):** Yandex Games, Telegram Stars with Adsgram, and the own site through
     YooKassa and Robokassa.
   - **Scenario B (an entity outside Russia):** adds Stripe, Google H5 Games ads, CrazyGames payouts, Steam and Google
     Play (§2.1).
7. **Expected economics (est.).** About $0.010–0.027 per daily player and $0.06–0.16 per install over 180 days. Growth
   is organic. Buy traffic only below ~$0.045 per install until measured value says otherwise (§10).
8. **Build order:**
   - the platform layer, the Yandex adapter and rewarded ads (W3);
   - the Trader's Tent with the Starter Kit and Supporter Pack, own-site checkout and cloud save (W5–6);
   - Telegram Stars (W6);
   - the Season Pass and Patron (W10, the "Winter Horde" season);
   - CrazyGames purchases, Google ads and Steam (Scenario B only).

## 1. Principles: the fair-play pact

Show the pact in the shop, in Settings → Purchases and on the landing site:

1. **Money never buys a random outcome.** Eggs, chests, orbs, shards, Gambler rolls, relics, uniques and gear are
   earned only.
2. **Money buys time, convenience and looks, never power a free player can't get.** Every bonus that affects power has
   a free path, a video or play, under the same daily cap. Paying skips the video; it never raises the cap.
3. **The Rift and the ladders stay pure.** No paid or ad boosts work in the Rift. Ladder boards show looks, never
   purchases.
4. **No forced ads on the own site or in Telegram.** On portals, full-screen ads come only at natural breaks: never in
   a fight, never in a player's first 10 minutes.
5. **Plain prices.** No premium currency, no countdowns on real-money offers, no streak penalties.
6. **A low ceiling.** $19.99 at most per item, a $50 monthly soft cap on the own site, and no VIP tiers based on spend.
7. **Yours forever.** Purchases are tied to an account, can be restored in Settings, and unused consumables can be
   refunded within 14 days.

### 1.1 Decision: no paid random items, even with odds shown

| Reason | Evidence |
|---|---|
| Age rating | From June 2026, PEGI rates paid random items **16+** by default, and time-limited offers 12+ [30]. CrazyGames requires a 12+ rating [8], so one paid box would bar BTTN from CrazyGames. |
| Law | Belgium has treated paid loot boxes as illegal gambling since 2018 [33]. Brazil bans them in games minors can reach from 2026-03-17, with fines up to R$50M [34]. Australia rates paid chance items M and simulated gambling R18+ (from 2024-09-22) [36]. South Korea requires published odds [35]. Russian lawmakers have proposed treating loot-box sales as gambling [46]. |
| Payment rails | Stripe Managed Payments excludes "betting, gambling, lottery" [23]. Paddle bans games of chance and virtual currency [24]. |
| Players | Idle Champions' chest economy is its top complaint (77% positive) [43]. Clicker Heroes' developer: "we don't want this kind of money if it came from anyone who regrets their decision" [40]. |
| Money | Rare drops drive engagement, not revenue: Bongo Cat peaked at 194k concurrent players and earned $2–4k a month [42]. |

**What follows from it:**
- Earned randomness stays, with odds shown wherever the player rolls (the Hatchery already shows egg odds): eggs,
  chests, orbs, the shard Gambler, the Lucky Merchant, relics, the Button of Legends.
- **Everything money or the Golden Ticket can reach is fixed** (§4). The two placements with a chance element (the
  blessing reroll, the daily gift) stay video-only.
- **Remove the Ghostly Gambler's double-or-nothing** in all builds, and keep the Lucky Spin removed (3.6). Both are
  simulated gambling (PEGI 18 [30]).

### 1.2 Decision: no premium currency

- The EU consumer-protection network's 2025 principles require real-money prices, a free choice of amount and no
  confusing multi-currency setups [31].
- The EU Digital Fairness Act is due in Q4 2026. The Parliament's consumer committee (IMCO) asks it to ban in-game
  currencies in games minors are likely to play [32].
- Paddle bans virtual currency [24].
- Platform currencies are not ours. Each item gets one price in Stars on Telegram and one price in Yan on Yandex.

### 1.2a Amendment (3.6): Gems, for one thing only

- The owner asked for a paid way to continue a fallen run, so 3.6 adds **Gems**. They are earned in play (achievements,
  land stars, lords' first falls, relics, the daily gift) and buy one thing: **Continue here** after the Button falls
  (first ever free, then 25 / 50 / 100 in a run, three at most). Nothing random is ever sold for Gems.
- If Gems are sold, keep the 1.2 rules as close as they allow:
  - fixed packs priced in real money (or in ⭐/Yan where the platform requires), sized so a pack covers a whole number of
    continues (no leftover change to nudge another purchase);
  - next to every Gem price in the game, its real-money worth;
  - no Paddle for Gems (it bans virtual currency [24]); a platform store, Stripe or ЮKassa instead;
  - watch the Digital Fairness Act [32]: if it bans in-game currencies for games minors play, switch the continue to a
    direct real-money price (or a rewarded ad) and keep Gems earn-only.
- Rewarded ads, where a platform provides them, can pay for one continue a run instead (`G.Ads.ready('continue')`).

### 1.3 Decision: no pay-to-win walls

- **Offline cap.** The only permanent paid power is a longer offline cap: +2 h from the Starter Kit, +4 h from the
  Supporter Pack, at most +6 h from purchases in total.
  - Free players raise the same cap through the Hall of Fame's Time Warp (`lg_time`, +2 h a level, up to 5) and the
    Observatory's Night Watch star (`i_watch`, +1 h a level) in `js/data.js`. The consumable is called "Hourglass" so
    it doesn't clash with that name.
  - It does nothing in the Rift.
- **Auto play is not for sale.** Hold-to-click (up to 10 a second) and the auto settings are free by design.

## 2. Revenue streams per platform

### 2.1 Jurisdiction scenarios (decide in W1)

| Rail | **A: Russia-resident** (self-employed, ИП or ООО) | **B: entity and bank outside Russia** |
|---|---|---|
| Yandex Games ads + purchases | ✓ [16] | ✓ (through the Yandex Advertising Network) [15] |
| Telegram Stars + Adsgram | ✓. Payout via Fragment in crypto [21]; whether a Russian resident can cash out is **unverified**. | ✓ |
| Own-site cards | YooKassa 2.8% + 1% per receipt [25]; Robokassa foreign cards 9.9% [26] | Stripe Checkout with Managed Payments (merchant of record), ~6.4% + 30¢ [23] |
| Google H5 Games ads (Ad Placement API) | ✗ (Russian AdSense accounts shut down in Aug 2024) [14] | ✓ if approved [12] |
| CrazyGames, Poki and GameDistribution payouts | Probably blocked (Tipalti) | ✓ |
| Google Play, Steam | ✗ | ✓ |

Tax in Scenario A: as self-employed (НПД), 4% on income from individuals and 6% from companies (Yandex counts as a
company), up to 2.4M ₽ a year [27]. This is not legal or tax advice; check sanctions, tax and crypto rules with an
accountant.

### 2.2 Streams

| Platform | Phase | Ads | Purchases | Developer share | Notes |
|---|---|---|---|---|---|
| **Own site** `/play` (+ installable PWA) | 1 | A: **none**. B: rewarded only (Ad Placement API). **No full-screen ads, no banners.** | Full catalog. A: YooKassa (RU cards, SBP, SberPay), Robokassa (foreign cards) and "Pay with Stars in Telegram". B: Stripe Checkout. | ~92% (A), ~90% (B) | The best experience; 100% of revenue from our own traffic |
| **Yandex Games** | 1 | Rewarded; full-screen at breaks; sticky banner in town | Catalog through Yandex payments (Yan) + No Ads | Purchases: 50% of Yandex's income [16]. Ads: RU platforms pay 50–70% [18]. Payout from 3,000 ₽. | The main cash channel in A: 50M+ monthly players, developer purchase revenue +75% in 2025 [17] |
| **Telegram Mini App** | 1 (W6) | Adsgram rewarded only [22] | Catalog in Stars | $0.013 per Star; the buyer pays ~$0.02 [20][21] | No token, no airdrop, no "earn" |
| **CrazyGames** | 2 (B) | Rewarded; midgame ads at most 1 every 3 min [8]; banners in menus | Invite-only through Xsolla [8][9] | 60% ads / 70% purchases (2026 jam terms) [3] | Revenue needs Full Launch |
| **Poki** | Only with a non-exclusive deal | Poki SDK breaks | **None** (not allowed [10]) | 50% on Poki traffic | All shop UI hidden |
| **VK Play, VK Mini Apps, OK** (via GamePush) | 2 | VK ads at breaks | VK payments | VK Play keeps 5% | Pays in rubles |
| **Android wrapper** (Google Play in B, RuStore in A) | 3 | None | Store billing (Play Billing via the Digital Goods API; RuStore Pay) | 85% (15% fee) [29] | Only if > 50% of traffic is Android and D7 ≥ 8% |
| GameDistribution, Playgama | 3 | Their SDK | Their system | GameDistribution: 33% of net [11] | Reach, not money |
| **Steam** | 3 (B) | None | $4.99 premium + Supporter DLC $1.99–3.99 | 70% | The web stays free (the Cookie Clicker pattern) |

Expected early mix (est., because Yandex brings the most RU traffic): Yandex 40–60%, own site 20–30%,
Telegram 15–25%.

## 3. Product catalog

**Pricing rules:**
- **USD ladder:** $0.99 · $1.99 · $2.99 · $4.99 · $9.99 · $19.99.
- **RUB:** about 0.72 × the official rate, rounded down to end in 9: 59 · 119 · 179 · 299 · 599 · 1,199 ₽ (est.: lower
  RU purchasing power; A/B test 0.72 against 0.85).
- **Stars:** 50 · 100 · 150 · 250 · 500 · 1,000. The buyer pays ~$0.02 per Star; we net $0.65 · $1.30 · $1.95 ·
  $3.25 · $6.50 · $13.00 [20][21].
- **Yandex:** set each Yan price in the console so the RU price matches the ₽ column. One-time items are permanent
  purchases (restored with `getPurchases`); consumables are consumed after the grant.
- **Display:** always show the real price ([31]), never a "value" that wasn't a real list price.

| ID | Name | Contents (always fixed) | USD | RUB | ⭐ | Kind | Power | Builds | Where offered |
|---|---|---|---|---|---|---|---|---|---|
| `starter_kit` | **Starter Kit** (once) | "Spark" Button skin, "Spark" Hand trail, 3 Golden Hour tokens, 1 Hourglass token, +2 h offline cap for good. The parts are listed at $5.96. | 1.99 | 119 | 100 | once | low | all with purchases | Card on the **first** THE BUTTON FELL (once, no timer); Trader's Tent |
| `supporter` | **Supporter Pack** (Founder) | **Golden Ticket**: claim the 4 fixed ad bonuses with one tap, no video, same caps (§4). Founder animated Button. Gold Hand lightning. Founder badge and gold name on the ladder and share card. +4 h offline cap. Name on the Museum's Patron Wall. On portals: no full-screen ads or banners. | 9.99 | 599 | 500 | once | low (convenience) | all with purchases | Trader's Tent (top card), welcome-back line, Settings, landing |
| `no_ads` | **No Ads** | Removes full-screen ads and banners; rewarded videos stay optional | 2.99 | 179 | — | once | none | Yandex, CrazyGames, VK | Trader's Tent; a quiet link after the 3rd full-screen ad of a day |
| `skin_btn_{obsidian,candy,frost,gilded,clockwork,moon}` | **Button skin** (6 at launch) | The Button's look, plus its crack and mend animation | 1.99 | 119 | 100 | cosmetic | none | all with purchases | Tent → Looks; Settings → Look |
| `trail_{azure,crimson,verdant,violet,prism,frost}` | **Hand trail** (6) | Lightning colour and click flourish | 0.99 | 59 | 50 | cosmetic | none | ″ | Tent → Looks |
| `outfit_{knight,cleric,archer,wizard,rogue}` | **Party outfit** (5) | An outfit for one class (palette and trim) | 2.99 | 179 | 150 | cosmetic | none | ″ | Tavern; Tent → Looks |
| `petskin_{slime,bat,frog,beetle,owl,boo,imp,pebble,phoenix,drake,starfox,buttonling}` | **Pet skin** | A look for a pet you own (shown only for owned pets) | 0.99 | 59 | 50 | cosmetic | none | ″ | Hatchery |
| `decor_{lanterns,banners}` | **Town decor** (2) | Fountain, banners, lanterns and stall awnings | 2.99 | 179 | 150 | cosmetic | none | ″ | Town square (preview); Tent |
| `look_{shoreline,abyss,starsea}` | **Land Look** (3 at launch, one more each month) | A Button skin, Hand trail and Warden outfit tint from one land, plus a ladder frame only sold here. The singles total $5.97. | 4.99 | 299 | 250 | cosmetic bundle | none | ″ | Tent → Looks |
| `pass_s{n}` (S1 = "Winter Horde", from W10) | **Season Pass** (28 days) | A 20-tier premium track: 6 cosmetics (including a season Button), 4 Golden Hour tokens, a season title. **Only fixed items on the paid track.** Free track for everyone (it may hold chests and eggs). Progress from play only; **tiers can't be bought**; rewards stay claimable after the season. | 4.99 | 299 | 250 | season | very low | own, Telegram, Yandex | Tavern → Season; Tent |
| `gh_3` | **Golden Hour ×3** | 3 tokens of ×2 gold for 30 min of play. Shares the daily cap of 4 with the video. | 0.99 | 59 | 50 | consumable | low (free by video) | ″ | Golden Hour chip (when the cap is left); Tent → Boosts |
| `hg_3` | **Hourglass ×3** | 3 tokens of "2 h of idle gold now". Shares the cap of 1 a day with the video. | 1.99 | 119 | 100 | consumable | low (free by video) | ″ | Quest board; Tent → Boosts |
| `tip_pie` | **A pie for the Warden** | A pie hat for the Warden, and thanks on the Patron Wall | 2.99 | 179 | 150 | tip | none | ″ | Tent; landing |
| `bundle_all` | **Everything Bundle** (top anchor) | Supporter Pack + the current Season Pass + 2 Land Looks. Bought separately: $24.96. | 19.99 | 1,199 | 1,000 | bundle | low | ″ | Tent (last card) |
| `patron` (phase 2) | **Patron**, monthly | Golden Ticket while active (Supporters already have it); 1 new cosmetic a month, kept; a Patron ladder frame; +2 h offline cap while active. Cancel any time. | 2.99/mo | 179/mo | 150 per 30 days | subscription | low | own (recurring card), Telegram (Stars subscription) | Tent → Supporter |

**Never sold:**
- eggs, chests, orbs or shards, and Gambler rolls;
- fame, relics, uniques and gear;
- Rift entries or retries;
- ladder places;
- Lucky Merchant items (he takes in-game currency only);
- perk or blessing rerolls (blessing rerolls come only by video);
- auto-clickers.

**Considered and rejected:**

| Idea | Decision |
|---|---|
| Premium currency packs | ✗ (§1.2) |
| Spend-tier VIP (as in Tap Titans 2) | ✗, "whale hunting" [31] |
| Paid chests or eggs | ✗ (§1.1) |
| "Extra chest" for a video | ✗: a chest is random. Keeping chests out of video rewards keeps 4 of the 6 fixed, so the Golden Ticket can cover them. |
| "Revive the Button" for a video | Only as an A/B arm on the own site (`rv_second_wind`), because it blunts the run's ending. Never on CrazyGames, which bans a video offer on every life lost [8]. |
| Energy or timers | ✗ |

## 4. Rewarded video placements

**Global rules:**
- **Daily cap:** 12 rewarded videos a day per player, counted on the same day key as the daily gift.
- **None** in a player's first 3 minutes of play, or before the tutorial ends.
- **Ambient offers** (the field chip) need ≥ 3 min since the last rewarded video. **Screen offers** (welcome back, the
  fall, blessings, quest board) come with their screen.
- **Failures:** never reward on an error or no-fill. Show "No video right now — try later" and keep the offer. After
  2 failures in a session, hide offers until the next session (blockers).
- **Golden Ticket** (Supporter or Patron): the 4 placements marked **GT** grant instantly with no video, under the same
  caps. The 2 placements with a chance element stay video-only.
- **During any ad:** pause the field (the ad veil counts as a modal for `G.uiBusy()`), set master audio to 0, and call
  `GameplayAPI.stop` / `gameplayStop`.

| ID | Screen | Button copy (EN / RU) | Reward | Caps | Shown only when | GT |
|---|---|---|---|---|---|---|
| `rv_golden_hour` | **Field HUD chip** (top corner, never over the Button) | ▶ Golden Hour: ×2 gold, 30 min / ▶ Золотой час: ×2 золота, 30 мин | `goldMult ×2` for 30 min of play time. Ignored in the Rift. A pill timer shows while active. | 4 a day; one active at a time; ambient cooldown | After the player's first boss win. Hidden during a boss, Land Champion, DOOM, the march, the Rift or any window. Hides for 90 s if ignored for 20 s. | ✓ |
| `rv_double_haul` | **Welcome-back card** | ▶ Double it / ▶ Удвоить | ×2 the **gold, Essence and shards** from the time away (chests are not doubled) | 1 per return; 3 a day | Away ≥ 30 min | ✓ |
| `rv_tell_tale` | **THE BUTTON FELL card** | ▶ Tell the tale: +{n} fame / ▶ Рассказать легенду: +{n} славы | +25% of this fall's fame (`S.fame += n; S.fameTotal += n`) | 1 per run; 3 a day | Fame from the fall ≥ 1; not after a Rift | ✓ |
| `rv_hourglass` | **Quest board** (also a line in the town's Needs-you list) | ▶ Hourglass: 2 h of idle gold / ▶ Песочные часы: 2 ч золота | Gold for 2 h at the offline formula (`gpsBase` × 7,200 s × `offEff`, plus a quarter of the hold rate) | 1 a day, shared with `hg_3` tokens | Best depth ≥ 5 | ✓ |
| `rv_fresh_bless` | **Blessing card** | ▶ New blessings / ▶ Другие благословения | A new set of 3 to choose from (`G.blessOffer()` again) | 1 per run; 3 a day | At the start of a run | ✗ (chance) |
| `rv_daily_double` | **Quest board → daily gift** | ▶ Double today's gift / ▶ Удвоить подарок | A second copy of the daily gift | 1 a day | The gift can be claimed | ✗ (chance) |
| *Phase 2* `rv_free_flux` | Enchanter | ▶ Free Orb of Flux | 1 Orb of Flux | 1 a day | After the Enchanter opens | ✗ |
| *Phase 2* `rv_new_quest` | Quest board | ▶ New quest | Replace one quest | 2 a day | A quest isn't done yet | ✗ |
| *A/B only* `rv_second_wind` | THE BUTTON FELL (replaces Tell the Tale for 50% of own-site players) | ▶ Second wind | The Button rises with 50% health, once per run | 1 per run | Run ≥ 10 min, depth ≥ 10 | ✗ |

Plan for 1.5–2.5 rewarded views per daily player [2][45]. Rewarded viewers are 4.5× more likely to buy, and players
prefer rewarded videos to full-screen ads 4:1 (correlational) [7]. Expected opt-in rates (est.): Double Haul ≥ 40%,
Golden Hour ≥ 15%. Drop any placement whose opt-in stays under 5%.

## 5. Full-screen ads and banners (portal builds only)

| Rule | Value |
|---|---|
| Builds | Yandex, CrazyGames, Poki, VK. **Never** on the own site, in Telegram or on claude.ai. |
| Break points | (1) After **Rise again**, before the blessing cards. (2) After an ascension is confirmed at the Temple. (3) When leaving town after ≥ 2 min inside. |
| Never | In a player's first **10 min** of play; within 5 min of any other ad; during a fight, the march or a window; on a reward screen; for `supporter`, `no_ads` or `patron` owners. Not on the first fall (the Starter Kit card is shown there). |
| Frequency | ≥ 5 min apart (stricter than CrazyGames' 3 min [8]); at most 6 an hour (2–4 in practice). The platform's own caps also apply: Yandex and Poki decide whether an ad actually shows [10][15]. |
| Measuring | A 10% holdout gets no full-screen ads (`S.shop.isHold`, set once at random). **Stop rule:** if D1 falls > 2 pp or D7 > 1 pp against the holdout, show them less often. One disruptive ad raises churn 6–7%, and quits triple when the ad sits on a reward screen [6]. |
| Banners | They pay little (~$1.2–1.3 per 1,000 even on US mobile [5]). Only on the town square, in the Trader's Tent and in the Museum; one per screen; hidden on short screens and for owners of `supporter`, `no_ads` or `patron`. Yandex sticky banner; CrazyGames allows at most 2 per screen on screens open ≥ 5 s [8]. |
| Consent | Non-personalised ads by default in the EEA, UK and Switzerland until a Google-certified consent tool is added [13]. Contextual ads only, since ages are unknown (COPPA) [37]. |

## 6. Where everything appears

### 6.1 Game screens

| Screen | Rewarded | Purchase surface | Full-screen (portals) | Banner (portals) |
|---|---|---|---|---|
| Intro, class pick, tutorial | — | — | — | — |
| **Field HUD** | `rv_golden_hour` chip; the active Golden Hour pill | — | never | never |
| Level-up cards, boss, Land Champion, DOOM, the march | — | — | never | never |
| **Welcome-back card** | `rv_double_haul` | A line: "Supporters collect double without a video" → Tent | — | — |
| **THE BUTTON FELL** | `rv_tell_tale` | **Starter Kit card, the first fall only** | After **Rise again** | — |
| **Blessing cards** | `rv_fresh_bless` | — | — | — |
| **Town square** | — | The **Trader's Tent** (12th building, "NEW" badge once); decor preview at the fountain | When leaving after ≥ 2 min | ✓ |
| **Trader's Tent** (new) | — | Full catalog: tabs **Supporter · Looks · Season · Boosts**; "Nothing here is random"; the pact; Restore | — | ✓ |
| Quest board | `rv_daily_double`, `rv_hourglass` | — | — | — |
| Hatchery | — | Pet skins (owned pets only); egg odds stay visible | — | — |
| Tavern | — | Outfits; Season tab; ladder frames | — | — |
| Forge, Enchanter | Phase 2: `rv_free_flux` | — | — | — |
| Museum | — | **Patron Wall** (names of Supporters and Patrons) | — | ✓ |
| Temple | — | — | After an ascension | — |
| **Rift Gate / Rift** | **none** | **none** | **none** | **none** |
| Lucky Merchant | — | In-game currency only | — | — |
| **Settings** | — | **Purchases** (owned, Restore, history, monthly total); **Look** (equip cosmetics); **Ads & privacy** (consent, "why ads", personalised ads off) | — | — |
| Share and brag card | — | Shows equipped looks and the Founder badge (a viral loop) | — | — |

### 6.2 Landing site (`/`)

| Block | Monetization |
|---|---|
| Hero (first screen) | **Only PLAY.** No price, no ad, no pop-up. |
| Features, FAQ | "Is there gambling? No." The FAQ states the pact. |
| **Support block** | Three cards: **Supporter Pack** $9.99 / 599 ₽; **Looks** from $0.99 (4 Button skins); **A pie for the Warden** $2.99. Each opens `/play?open=shop&sku=<id>`, so the in-game Tent runs the single checkout. |
| Platform badges | Play in Telegram · Yandex Games · CrazyGames · Wishlist on Steam. Own site only; each shows only once live. |
| Footer | Fair play · Refunds · Privacy |

## 7. Provider adapters

One layer, `G.PF` in `js/platform.js`. Each build includes only its own adapter plus `none`. Method names are from
each SDK's docs as of 2026-10; check them against the current docs when integrating.

| `G.PF` method | Yandex Games (`/sdk.js`) | CrazyGames SDK v3 | Poki SDK v2 | Telegram | Own site, A | Own site, B |
|---|---|---|---|---|---|---|
| `init()` | `YaGames.init()` → `ysdk` | `await CrazyGames.SDK.init()` | `PokiSDK.init()` | `Telegram.WebApp.ready(); expand()`; `Adsgram.init({blockId})` | — | Load `adsbygoogle.js`; `adConfig({preloadAdBreaks:'on', sound:'on'})` |
| `ready()` | `ysdk.features.LoadingAPI.ready()` | `SDK.game.loadingStop()` | `PokiSDK.gameLoadingFinished()` | — | — | — |
| `gameplay(on)` | `ysdk.features.GameplayAPI.start()` / `.stop()` | `SDK.game.gameplayStart()` / `gameplayStop()` | `PokiSDK.gameplayStart()` / `gameplayStop()` | — | — | — |
| `rewarded(p)` | `ysdk.adv.showRewardedVideo({callbacks:{onOpen,onRewarded,onClose,onError}})` | `SDK.ad.requestAd('rewarded',{adStarted,adFinished,adError})` | `PokiSDK.rewardedBreak()` → `success` | `AdController.show()` → `result.done` | none | `adBreak({type:'reward', name:p, beforeReward(show){…}, adViewed, adDismissed, adBreakDone})`; reward only on `adViewed` [12] |
| `interstitial(p)` | `ysdk.adv.showFullscreenAdv({callbacks:{onClose(wasShown),onError}})` | `SDK.ad.requestAd('midgame',…)` | `PokiSDK.commercialBreak()` | — | — | — |
| `banner(on)` | `ysdk.adv.showBannerAdv()` / `hideBannerAdv()` | `SDK.banner.requestBanner({id,width,height})` / `clearBanner(id)` | — | — | — | — |
| `iap.catalog()` | `payments.getCatalog()` (`ysdk.getPayments({signed:true})`) | (Xsolla, invite-only, later) | none | our catalog | our catalog | our catalog |
| `iap.buy(sku)` | `payments.purchase({id, developerPayload: acct})` → signed → `POST /api/ya/verify` | — | — | `POST /api/tg/invoice` → `WebApp.openInvoice(link, status => …)` | `POST /api/pay/checkout` → YooKassa or Robokassa redirect | `POST /api/pay/checkout` → Stripe Checkout |
| `iap.restore()` | `payments.getPurchases()` | — | — | `GET /api/ent` (by Telegram user) | `GET /api/ent` (by account, e-mail magic link) | same |
| consume | `payments.consumePurchase(token)` once the grant is saved | — | — | — | — | — |
| `user()` | `ysdk.getPlayer({scopes:false})` → `getUniqueID()` | `SDK.user.getUser()` | — | `initData` checked by the server | account token | same |
| `cloud` | `player.setData(save, true)` / `getData()` | `SDK.data.setItem/getItem` | localStorage | `/api/save` | `/api/save` | `/api/save` |
| `lang()` | `ysdk.environment.i18n.lang` | `navigator.language` | `navigator.language` | `initDataUnsafe.user.language_code` | `navigator.language` | same |

**Detecting the platform at runtime:**

```js
// js/platform.js — the build flag wins; sniffing only confirms it and never loads another platform's SDK
function detectPlatform() {
  const b = window.BTTN_PLATFORM;                    // set by tools/build.js for each target
  const h = location.hostname, ref = document.referrer || '';
  const seen =
    window.Telegram && Telegram.WebApp && Telegram.WebApp.initData ? 'telegram' :
    window.YaGames || /(^|\.)yandex\.(ru|com|net)$|games\.s3\.yandex\.net$/.test(h) ? 'yandex' :
    window.CrazyGames || /crazygames\./.test(h + ' ' + ref) ? 'crazygames' :
    window.PokiSDK || /(^|\.)poki(-gdn)?\.com$/.test(h) ? 'poki' :
    /claude\.ai|claudeusercontent/.test(h) || (G.Net && G.Net.mode === 'artifact') ? 'artifact' : 'own';
  if (b && b !== 'own' && b !== seen) return 'none';  // a portal build opened somewhere else: no ads, no shop
  return b || seen;
}
G.PF.sub = { pwa: matchMedia('(display-mode: standalone)').matches, twa: document.referrer.startsWith('android-app://') };
```

`artifact` (claude.ai) and `none` turn ads and purchases off and keep the friends version clean.

## 8. Entitlements: client save plus server receipts

**Accounts.**
- **Own site:** an anonymous account from `POST /api/acct` gives `{acct, token}`, stored in localStorage `bttn-acct`.
  An optional e-mail magic link restores it on another device.
- **Telegram:** the account is `tg:<user.id>`, from `initData` checked by the server.
- **Yandex:** Yandex holds the purchases. We cache them in the save.

**What the server keeps** (`deploy/serve.js`, on the Railway volume `$DATA_DIR`): `ent.ndjson` is an append-only
ledger, folded into memory at boot like the analytics. Each line looks like this:

```json
{"acct":"a_7k2…","sku":"supporter","qty":1,"src":"yookassa","rid":"2f3c…","amt":59900,"cur":"RUB","vid":"x81…","at":1791234567890,"until":null,"state":"active"}
```

- `rid` is the provider's payment id. A pair of `src` and `rid` is granted only once, so retried webhooks are
  harmless.
- `vid` is the analytics visitor id, sent at checkout, so revenue is credited to the player's first-touch source.

**The entitlement token.** `GET /api/ent` returns
`{acct, items:[{sku,qty,until}], ts, sig}`, where `sig = HMAC_SHA256(ENT_SECRET, acct|ts|JSON(items))`.
- The client caches it in the save (`S.shop.ent`) and in localStorage `bttn-ent`.
- Online, it refreshes at boot and after each purchase; offline, the cache is used.
- Cosmetics are checked on the client. That is a low-stakes risk we accept.
- The ladder shows a Founder badge only if the ladder server checks `sig` against the shared `ENT_SECRET`.

**Consumables** (`gh_3`, `hg_3`, the Starter Kit's tokens) are delivered at least once:
1. The server lists undelivered `rid`s in `/api/ent`.
2. The client adds the tokens, records the `rid` in `S.shop.rids`, saves, then calls `POST /api/ent/ack {rids}`.
3. A `rid` already in `S.shop.rids` is never added twice.

**Refunds and revokes.**
- Triggers: Stripe `charge.refunded`, YooKassa `refund.succeeded`, or a Telegram `refundStarPayment` we send ourselves.
  The ledger line is set to `state:"refunded"`.
- The next `/api/ent` omits it, and the client removes the item. Consumables already used are not taken back.

**Soft cap.** If an account's own-site spend this calendar month would pass $50 / 3,000 ₽, checkout asks: "You've spent
{x} this month. Continue?"

**Restore** is at Settings → Purchases:
- own site: by e-mail magic link;
- Telegram: automatic by user id;
- Yandex: `getPurchases()`.

**Prerequisite: cloud save on the public host.** Port the save API of `server/worker.js` (`/api/auth`, `/api/save`)
into `deploy/serve.js` before taking money on the own site. Buyers must not lose a save; Idle Slayer's reviews punish
lost saves.

## 9. Analytics events and dashboard metrics

Events go through `G.track(t, d)` in `js/analytics.js`. It runs on the own site and in the Telegram build, which
`serve.js` also serves. Portal revenue comes from each portal's console, copied in once a month.

| Event | When | Fields |
|---|---|---|
| `ad_offer` | A rewarded offer becomes visible | `p` placement, `pf` platform |
| `ad_watch` | The player accepts and the video starts (or the Golden Ticket is used) | `p`, `pf`, `gt` 0/1 |
| `ad_reward` | The reward is granted | `p`, `v` (value, rounded) |
| `ad_fail` | No fill, error, dismissed, blocked or capped | `p`, `why` |
| `ad_break` | A full-screen ad was requested | `p` (`rise`, `ascend`, `town`), `shown` 0/1, `hold` 0/1 |
| `store_open` | The Trader's Tent opens | `from` (`town`, `fell`, `welcome`, `landing`, `settings`, `chip`) |
| `sku_view` | An item's card is opened | `sku` |
| `purchase_start` | Checkout begins | `sku`, `rail`, `cur`, `amt` |
| `purchase_complete` | The entitlement arrives on the client | `sku`, `rail`, `cur`, `amt`, `first` 0/1 |
| `purchase_fail` | Cancelled or failed | `sku`, `rail`, `why` |
| `refund` / `restore` | An item is revoked / a restore finishes | `sku` / `n` |
| `consent` | The ad consent state changes | `state` |

**Server changes:**
- Add these names to `MILESTONE` in `deploy/serve.js`.
- Add a **Money** card and an **Ads** card to `deploy/admin.html`. Revenue numbers come from the ledger, not the client.

**Money card:**
- revenue, gross and net, by day, rail and item;
- payers, payer % of daily players and of new visitors;
- ARPPU (revenue per paying player) and ARPDAU (revenue per daily player): net purchases plus estimated ad revenue;
- conversion to a first purchase, by source;
- play minutes until the first purchase;
- **value per visitor by first-touch source** at D7 and D30;
- the Supporter Pack attach rate among players still playing on D7.

**Ads card:**
- offers, opt-in % and completion % per placement;
- rewarded views per daily player;
- fill (watched ÷ accepted);
- full-screen ads per session, and quits within 60 s after one;
- **D1 and D7 for the holdout against everyone else**.

Estimated ad revenue = completions × `ECPM_<pf>` (an environment variable) / 1000, reconciled with the network's report
each month.

**Value against cost:** in the CSV export, add spend per source and compare value per visitor against cost per
visitor. Scale only when value ÷ cost > 1.3.

## 10. A simple LTV model (est.)

**The formulas:**
- ARPDAU from ads = Σ(views per daily player × net eCPM / 1000).
- Value from purchases per install = lifetime payer rate × ARPPU × net share.
- LTV per install = active days in 180 days × ads ARPDAU + value from purchases.
- Retention follows `R(d) = D1·d^(−b)`, fitted to D1 and D7.

| Retention | D1 | D7 | Active days per install (180 d) | Basis |
|---|---|---|---|---|
| Low | 15% | 4% | 3.1 | Near the mobile median [44] |
| **Base** | 25% | 8% | 5.7 | The GDD §7 targets |
| High | 35% | 14% | 10.9 | Top quartile and better [44] |

| Platform (base inputs) | Rewarded per day × net eCPM | Full-screen per day × net eCPM | Payer rate × ARPPU × share | **ARPDAU** | **LTV per install, base (low – high)** |
|---|---|---|---|---|---|
| Yandex Games | 2.0 × $1.2 | 2.0 × $0.8 | 1.0% × $6 × 48% | $0.010 (0.84 ₽) | **$0.057** (0.020 – 0.168) |
| Own site, A (no ads) | — | — | 1.5% × $6 × 92% | $0.0145 | **$0.083** (0.031 – 0.248) |
| Own site, B | 1.5 × $4.0 | — | 1.5% × $9 × 90% | $0.027 | **$0.156** (0.057 – 0.462) |
| Telegram | 2.5 × $1.5 | — | 1.0% × $6 × 62% | $0.010 | **$0.059** (0.021 – 0.173) |
| CrazyGames (B) | 1.5 × $3.6 | 2.0 × $2.4 | 0.7% × $8 × 70% | $0.020 | **$0.115** (0.039 – 0.333) |

The eCPM inputs come from these benchmarks:
- web rewarded video takes home ~$4–8 for tier-1-heavy games, and $1–4 gross in tier-3 countries [1][2];
- mobile rewarded video ranks Russia below Japan and Korea [4];
- casual ads-only ARPDAU is $0.01–0.05 [45];
- a small Yandex game typically earns 6–8k ₽ a month [19].

**What it means:**
- **Blended value:** 50% of installs on Yandex, 25% on the own site (A) and 25% on Telegram gives **≈ $0.064 per
  install**. Paid installs break even at ~$0.06, so with a 30% margin, **buy only below ~$0.045** until measured value
  replaces these assumptions.
- **$1,000 a month** takes ~3,300 daily players on Yandex or Telegram, ~2,300 on the own site (A), ~1,700 on
  CrazyGames, or ~1,200 on the own site (B).
- **The biggest lever is retention, not ad rates.** Going from low to high retention multiplies LTV by ~8×. After that
  comes the Supporter Pack. For reference, Rusty's Retirement's supporter pack sold to 11% of its paying Steam
  buyers [41].
- Replace every assumption with measured values after ~1,000 player-days per platform.

## 11. Compliance checklist

**Randomness and gambling**
- [ ] No item sold for money, or reachable with the Golden Ticket, has random contents (§1.1). That includes the paid
  Season Pass track.
- [ ] The Lucky Spin is removed (3.6), the Ghostly Gambler's double-or-nothing is removed, and no UI says "Casino" or
  "Gambler" (rename to e.g. "Mystery Forge").
- [ ] Odds are shown wherever the player rolls: egg odds now; add them to chests and the shard Gambler (South Korea
  rule [35]).

**Prices and offers**
- [ ] Every price is in real money (₽, $), or in ⭐/Yan as the platform requires. No premium currency.
- [ ] No countdown or "limited quantity" on any real-money offer (PEGI 12 trigger [30]); the Starter Kit has no timer.
- [ ] Bundles show only real list prices for the "bought separately" line.
- [ ] $19.99 cap per item; $50 monthly soft cap on the own site.

**Ads**
- [ ] Rewarded videos are optional, carry a video icon, state the reward, are never chained, and never reward on an
  error [8][15].
- [ ] Full-screen ads only in portal builds and at the break points in §5. Sound and game paused during ads (Yandex
  4.7).
- [ ] The 10% holdout and the stop rule are live before full-screen ads go on.

**Privacy and kids**
- [ ] Non-personalised ads in the EEA, UK and CH unless a certified consent tool is added [13]; contextual ads for
  unknown ages [37].
- [ ] Analytics stays anonymous; Global Privacy Control and Settings → Anonymous stats turn it off.
- [ ] Settings → Ads & privacy explains what is shown and why.

**Payments, tax and refunds**
- [ ] The jurisdiction scenario (A or B) is written down.
- [ ] Self-employed income stays under 2.4M ₽ a year [27]; switch to ИП above it.
- [ ] Receipts go to "Мой налог" through YooKassa's receipt service [25].
- [ ] Scenario B: Stripe Managed Payments is the merchant of record, which covers EU VAT from the first sale [23][38].
- [ ] EU checkout has a consent box for immediate delivery of digital content [39]. Separately, refund unused
  consumables on request within 14 days.
- [ ] Purchases can be restored on every platform; refunds revoke items through the ledger.

**Platform rules**
- [ ] Poki build: no shop UI at all [10].
- [ ] CrazyGames: purchases only for signed-in users [8].
- [ ] Yandex: payments and ads only through the SDK, no outside links, purchases checked on the server [15].
- [ ] Telegram: digital goods only for Stars; `refundStarPayment` is supported [20]. No token or "earn" framing.

## 12. Implementation spec

### 12.1 Files

| File | New or changed | What |
|---|---|---|
| `js/platform.js` | new | `G.PF`: detection (§7), adapters, the ad veil (pause and mute) |
| `js/shop.js` | new, **no DOM** (runs under Node for tests) | `G.SKUS` catalog, `G.Shop` (entitlements, tokens, caps, Golden Hour, Hourglass, offers), the `G.hook('stats', …)` effects |
| `js/shop_ui.js` | new | The Trader's Tent window, offer buttons, Golden Hour chip, Starter Kit card, Settings sections, Patron Wall |
| `js/ui.js` | changed | Hooks in `UI.offline` (welcome back), the `runOver` modal, `UI.blessCards`, the Quest board daily gift, Settings |
| `js/stage.js` | changed | `TOWN` gets `{ id:'shop', spr:'tw_tent', … }`; draws the chip area; Button skin and trail palettes |
| `js/game.js` / `js/hero.js` | changed | A `G.applyLook()` palette swap for the Button, trail, outfits and pets |
| `js/i18n.js` | changed | Shop strings (EN + RU) |
| `js/analytics.js` | changed | Nothing in the API (`G.track` already exists); map Telegram's `start_param` to `src`/`cnt` |
| `tools/build.js` | changed | Targets: `dist/bttn.html` (own), `dist/telegram.html`, `dist/yandex/index.html`, `dist/crazygames/index.html`, `dist/poki/index.html`, `dist/artifact.html`. Each sets `window.BTTN_PLATFORM` and `window.BTTN_FLAGS` and adds only its own SDK script tag. |
| `deploy/serve.js` | changed | Routes `/` (landing), `/play` (game), `/tg` (Telegram build), `/press`; the endpoints in §12.5 |
| `deploy/admin.html` | changed | The Money and Ads cards (§9) |
| `deploy/landing.html` | new | The landing page (MARKETING.md §10) |

`window.BTTN_FLAGS` per build:

| Build | `rv` | `is` | `banner` | `iap` | `noAdsSku` | `links` | `analytics` | `cloud` |
|---|---|---|---|---|---|---|---|---|
| own (A) | 0 | 0 | 0 | 1 | 0 | 1 | 1 | server |
| own (B) | 1 | 0 | 0 | 1 | 0 | 1 | 1 | server |
| telegram | 1 | 0 | 0 | 1 (Stars) | 0 | 1 | 1 | server |
| yandex | 1 | 1 | 1 | 1 (Yan) | 1 | **0** | 0 | Yandex |
| crazygames | 1 | 1 | 1 | 0 (until invited) | 1 | **0** | 0 | CrazyGames |
| poki | 1 | 1 | 0 | **0** | 0 | **0** | 0 | local |
| artifact | 0 | 0 | 0 | 0 | 0 | 1 | 0 | claude.ai |

### 12.2 Catalog definition (`G.SKUS` in `js/shop.js`)

```js
// kind: once | cos | cons | season | sub | bundle ; slot: where a cosmetic equips
{ id: 'starter_kit', kind: 'once', price: { usd: 199, rub: 11900, xtr: 100 }, yan: 'starter_kit',
  grants: [{ look: 'btn_spark' }, { look: 'trail_spark' }, { tok: 'gh', n: 3 }, { tok: 'hg', n: 1 }, { offCapH: 2 }],
  builds: ['own', 'telegram', 'yandex'], surfaces: ['fell_first', 'tent'], listValueUsd: 596 },
{ id: 'supporter', kind: 'once', price: { usd: 999, rub: 59900, xtr: 500 },
  grants: [{ flag: 'goldenTicket' }, { look: 'btn_founder' }, { look: 'trail_gold' }, { flag: 'founderBadge' },
           { offCapH: 4 }, { flag: 'patronWall' }, { flag: 'noForcedAds' }] },
{ id: 'gh_3', kind: 'cons', price: { usd: 99, rub: 5900, xtr: 50 }, grants: [{ tok: 'gh', n: 3 }] },
{ id: 'skin_btn_obsidian', kind: 'cos', slot: 'button', price: { usd: 199, rub: 11900, xtr: 100 }, grants: [{ look: 'btn_obsidian' }] },
```

Prices are in minor units (cents, kopecks). The server holds the same catalog (`deploy/catalog.json`, generated by
`tools/build.js` from `js/shop.js`), and it **never trusts a client price**.

### 12.3 Save fields (`S.shop`, serialized with the rest of the save)

```js
S.shop = {
  v: 1,
  ent: { tokenSig: '', ts: 0, items: { supporter: { at: 0, src: 'yookassa' } } }, // the cache of /api/ent or getPurchases
  rids: [],                       // consumable receipts already applied (the last 200)
  tok: { gh: 0, hg: 0 },          // Golden Hour and Hourglass tokens
  gh: { left: 0 },                // seconds of play left in the active Golden Hour
  day: 'YYYY-MM-DD', rv: { rv_golden_hour: 0 /* …per placement */ }, rvTotal: 0, rvLast: 0, rvFails: 0,
  isLast: 0, isHold: null,        // last full-screen ad (ms); holdout flag set once
  starter: { shown: 0 },          // when the Starter Kit card was shown (it is shown only once)
  looks: { button: '', trail: '', outfit: { knight: '' }, pet: {}, decor: '' },
  pass: { s: 0, xp: 0, claimed: { free: [], paid: [] } },
  playStart: 0,                   // lifetime play seconds at first boot (the "first 3 / 10 min" rules)
}
```

### 12.4 Client API

```js
G.PF = { id, sub, flags, init(): Promise, ready(), gameplay(on),
  rewarded(placement): Promise<{ ok: boolean, why?: 'nofill'|'error'|'dismissed'|'blocked'|'capped' }>,
  interstitial(placement): Promise<{ shown: boolean }>, banner(on, slot),
  iap: { catalog(): Promise<Sku[]>, buy(sku): Promise<{ ok, why? }>, restore(): Promise<number> },
  user(): Promise<{ id, src }>, cloud: { load(): Promise<string|null>, save(str): Promise<void> }, lang(): string };

G.Shop = {
  owns(sku): boolean, has(flag): boolean,              // e.g. has('goldenTicket'), has('noForcedAds')
  canOffer(placement): { ok: boolean, why?: string },  // caps, cooldowns, calm moment, first 3 min, flags
  offer(placement): Promise<boolean>,                  // Golden Ticket → instant; else PF.rewarded; grants; tracks
  canBreak(point): boolean, breakAt(point): Promise,   // full-screen ad rules (§5)
  useToken('gh' | 'hg'): boolean,
  goldenLeft(): number,                                // seconds
  merge(entToken), grant(sku, src, rid), revoke(sku),  // idempotent
  offCapBonusH(): number,                              // ≤ 6
};
// effects
G.hook('stats', d => { if (G.Shop.goldenLeft() > 0 && !G.R.rift) d.goldMult *= 2; d.offCap += 3600 * G.Shop.offCapBonusH(); });
// a calm moment: no boss, Land Champion, DOOM, march or Rift, and no window open
G.calm = () => !G.R.boss && !G.R.champ && !G.R.march && !G.R.rift && !(G.uiBusy && G.uiBusy()) && !(G.doomOn && G.doomOn());
```

Golden Hour time counts down from `S.st.playTime` deltas in `tick`, not from the wall clock. The daily key is the one
the daily gift uses. Hourglass gold is `(D.gpsBase + (S.upg.hold ? D.holdRate : 0) * D.clickBase * 0.25) * 7200 * D.offEff`,
the same formula as `applyOffline` but with no chests.

### 12.5 Server endpoints (`deploy/serve.js`, no new dependencies: Node 18 `fetch` + `crypto`)

| Method and path | Auth | Body → Response | Notes |
|---|---|---|---|
| `POST /api/acct` | — | `{vid}` → `{acct, token}` | An anonymous account; rate-limited per IP hash |
| `POST /api/acct/email` · `GET /api/acct/verify?t=` | Bearer | `{email}` → 204 · redirect to `/play?restored=1` | Magic link for restore; the e-mail is stored hashed and also kept for sending the link |
| `GET /api/save` · `PUT /api/save` | Bearer | → `{data, ts}` · `{data, ts}` → 204 | Ported from `server/worker.js`; ≤ 400 KB |
| `GET /api/ent` | Bearer or Telegram `initData` | → `{acct, items, pending:[{rid,sku,qty}], ts, sig}` | §8 |
| `POST /api/ent/ack` | Bearer | `{rids}` → 204 | Marks consumables as delivered |
| `POST /api/pay/checkout` | Bearer | `{sku, rail:'yookassa'\|'robokassa'\|'stripe', vid}` → `{url}` | Price comes from `catalog.json`. Soft-cap check. |
| `POST /api/pay/webhook/yookassa` | IP allowlist | YooKassa notification → 200 | **Re-fetch** `GET https://api.yookassa.ru/v3/payments/{id}` (Basic `shopId:secretKey`) and grant only if `status=succeeded` and the amount matches. Create payments with `capture:true`, `metadata:{acct,sku,vid}`, an `Idempotence-Key` header and a `receipt`. |
| `POST /api/pay/result/robokassa` | signature | Robokassa ResultURL → `OK{InvId}` | Check `SignatureValue` = hash of `OutSum:InvId:Password2[:Shp_…]` |
| `POST /api/pay/webhook/stripe` | `Stripe-Signature` | event → 200 | HMAC-SHA256 of `t.payload` with `STRIPE_WHSEC`. `checkout.session.completed` grants; `charge.refunded` revokes. Sessions: `mode:'payment'`, `line_items:[{price, quantity:1}]`, `client_reference_id: acct`, `metadata:{sku,vid}`. |
| `POST /api/tg/invoice` | Telegram `initData` | `{sku}` → `{link}` | Check `initData`: `secret = HMAC_SHA256("WebAppData", BOT_TOKEN)`, then `hash = HMAC_SHA256(secret, data_check_string)`. Then Bot API `createInvoiceLink` with `currency:'XTR'`, `prices:[{label, amount: xtr}]`, `provider_token:''`, `payload: acct|sku|nonce` (for `patron`: `subscription_period: 2592000`). |
| `POST /api/tg/webhook` | secret path + `X-Telegram-Bot-Api-Secret-Token` | Bot update → 200 | `pre_checkout_query` → `answerPreCheckoutQuery(ok)` within 10 s; `successful_payment` → grant with `rid = telegram_payment_charge_id` |
| `POST /api/ya/verify` | — | `{signature}` → `{items}` | Check Yandex's signed purchase (HMAC-SHA256 with the app's secret key from the console). Grant to `developerPayload` = acct. Optional: Yandex itself is the record. |
| `GET /api/pub/players` | — | → `{week: n}` (rounded down to 100s) | For the landing's social proof |

Secrets (Railway variables): `ENT_SECRET`, `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET`, `ROBOKASSA_LOGIN`,
`ROBOKASSA_PASS1`, `ROBOKASSA_PASS2`, `STRIPE_SECRET`, `STRIPE_WHSEC`, `TG_BOT_TOKEN`, `TG_WEBHOOK_SECRET`,
`YANDEX_PAY_SECRET`, `ECPM_YANDEX`, `ECPM_TELEGRAM`, `ECPM_OWN`.

### 12.6 Screens

| Screen | Spec |
|---|---|
| **Trader's Tent** (`#townWin`, building id `shop`, sprite `tw_tent`, NPC `npc_trader`) | Header: "Trader's Tent" / «Лавка торговца» and a line "Nothing here is random. Nothing here is power you can't earn." Tabs: **Supporter** (Supporter Pack hero card; Everything Bundle; Patron later), **Looks** (a grid of skins, trails, outfits, pet skins, decor and Land Looks; try on with a live preview of the Button), **Season** (pass track; from W10), **Boosts** (Golden Hour ×3, Hourglass ×3; each shows "or free: 1 video" and today's cap left). Each card shows a sprite, name, contents list, real price and Buy (or "Owned ✓"). Footer: the pact link, Restore purchases, "14-day refunds for unused items". |
| **Starter Kit card** (inside the first fall modal, under the fame line) | "Starter Kit · $1.99 / 119 ₽ / 100⭐": icons for the Spark Button, Spark trail, 3 Golden Hours, 1 Hourglass, +2 h offline; "Parts: $5.96". Buttons: **Get it** · Not now. Shown once (`S.shop.starter.shown`), never with a timer. |
| **Offer button** (shared component) | A ▶ video icon + reward text + "{n} left today". With the Golden Ticket: ★ "Claim" with no video icon. States: ready · loading (spinner, 8 s timeout → `nofill`) · done ✓ · unavailable (hidden). |
| **Golden Hour chip** | 40×40 px, top corner of the field (right on desktop, left on phone so it doesn't cover the party). It pulses once on appear. Active: a pill "×2 gold 23:41" in the buff row. |
| **Settings → Purchases** | Owned items, Restore, history (date, item, price, rail), this month's total against the $50 soft cap, "Link e-mail" (own site), refund contact |
| **Settings → Look** | Equip slots: Button, trail, each class's outfit, each pet, decor; only owned or free looks |
| **Settings → Ads & privacy** | "Ads are optional videos for bonuses" (portal builds: "plus a short ad between runs"); personalised ads off; anonymous stats on/off (exists) |
| **Museum → Patron Wall** | Names of Supporters and Patrons (opt-in, name from the ladder), with the Founder badge |
| **Season tab** (Tavern and Tent) | 20 tiers in two rows (free and paid); season stars come from bosses (1), Land Champions (2), lords (3) and the daily bounty (5); tune so a player on ~20 min a day finishes in ~21 days (est.); "Ends in N days" is only informative, and nothing paid expires |

### 12.7 Tests

- **Node unit tests on `js/shop.js`:**
  - caps and the day reset;
  - the 3-min cooldown only on ambient offers;
  - no offer in the first 3 min, before the tutorial ends, or when the field isn't calm;
  - the Golden Ticket path (4 placements) and video-only placements;
  - Golden Hour ignored in the Rift;
  - `merge` and `grant` are idempotent;
  - a refund revokes;
  - the paid offline cap ≤ 6 h.
- **Server tests** (extend `tools/test-server.js`):
  - a duplicate webhook grants once;
  - a bad signature is rejected;
  - a price is never taken from the client;
  - the soft cap;
  - Telegram `initData` checks;
  - restore by magic link.
- **Playwright checks:**
  - no offer appears during a boss or in the Rift;
  - no full-screen ad in the first 10 min or on the own site;
  - the first fall shows the Starter Kit and no ad;
  - the ad veil pauses the field and mutes audio;
  - the phone layout keeps the chip off the Button and the party.

### 12.8 Rollout

| When | Ships |
|---|---|
| W3 | `js/platform.js` + the Yandex adapter, `js/shop.js` with the 6 rewarded placements, the full-screen ad rules, the holdout, analytics events |
| W5–6 | Cloud save on the public host, accounts, the Trader's Tent, Starter Kit, Supporter Pack, cosmetics v1 (palette swaps), No Ads (Yandex), own-site checkout (YooKassa + Robokassa; Stripe in B), Money and Ads cards |
| W6 | The Telegram build: Stars invoices, Adsgram, a `startapp` referral (both players get an egg; a free reward, not a purchase) |
| W10 | Season Pass S1 "Winter Horde" + Land Looks; Patron (own site + Telegram) |
| Later (B) | CrazyGames Xsolla purchases (when invited), Google ads on the own site, the Steam edition |

First A/B tests:
1. Starter Kit $1.99 against $2.99.
2. Tell the Tale against Second Wind.
3. Golden Hour cap of 3 against 4.
4. RUB price index 0.72 against 0.85.
5. Full-screen ad gap of 5 min against 8 min.

## 13. Open questions

1. **Scenario A or B.** This decides own-site card coverage, CrazyGames and Steam money. It is the first decision.
2. **Yandex's purchase share.** The licence says 50% of Yandex's income [16]; secondary sources say "up to 30%" for
   the platform. Check the console's calculator.
3. **Cashing out Telegram Stars as a Russian resident** (crypto via Fragment) is unverified [21].
4. **No published web eCPM for Russian traffic.** Measure it from day 1.
5. **The EU Digital Fairness Act** (Q4 2026) may tighten the rules further. Having no currency and no randomness is the
   hedge.

## Sources

All accessed 2026-10-04 unless another date is given.

| # | Source |
|---|---|
| 1 | AppLixir, benchmarking rewarded video revenue for web games (Aug 2026) — https://www.applixir.com/blog/how-to-benchmark-your-rewarded-video-ad-revenue-for-your-web-game-2026/ |
| 2 | AppLixir, do rewarded ads make money on web games (2026) — https://www.applixir.com/blog/do-rewarded-ads-actually-make-money-on-web-games/ |
| 3 | Cinevva, web game monetization (updated Sep 2026) — https://app.cinevva.com/guides/web-game-monetization |
| 4 | TopOn, Global Mobile Games Monetization H1 2025, via Game Growth Advisor (2026-03-17) — https://gamegrowthadvisor.com/blog/2026-03-17-mobile-game-kpis-benchmarks-2026/ |
| 5 | Playio, rewarded ad benchmarks 2026 (2026-05-18) — https://blog.playio.co/rewarded-ad-benchmarks-2026 |
| 6 | Deloitte × Google AdMob, study of 7,000 gamers (2025-06-10) — https://www.prnewswire.com/news-releases/growth-in-mobile-gaming-new-global-study-from-deloitte-and-google-admob-reveals-the-link-between-mobile-ad-engagement-and-gamer-retention-302477095.html |
| 7 | Unity, rewarded ads and purchases, retention and engagement (2022-08-24) — https://unity.com/blog/understanding-the-impact-of-rewarded-ads-on-iap-retention-and-engagement |
| 8 | CrazyGames requirements (PEGI 12), ad requirements, FAQ and in-game purchases — https://docs.crazygames.com/requirements/intro/ · https://docs.crazygames.com/requirements/ads/ · https://docs.crazygames.com/faq/ · https://docs.crazygames.com/sdk/in-game-purchases/ |
| 9 | Xsolla, CrazyGames improves conversion with Xsolla Pay — https://xsolla.com/partner-spotlight/crazygames-improves-conversion-with-xsolla-pay |
| 10 | Poki, how monetization works; deal types — https://developers.poki.com/guide/how-monetization-works · https://sdk.poki.com/deals |
| 11 | GameDistribution, developer licence (updated 2025-06-19) — https://static.gamedistribution.com/terms/developer.html |
| 12 | Google AdSense, H5 Games Ads; Ad Placement API placement types and adBreak — https://adsense.google.com/start/h5-games-ads/ · https://developers.google.com/ad-placement/docs/placement-types · https://developers.google.com/ad-placement/apis/adbreak |
| 13 | Google AdSense, Google-certified consent tool requirement (EEA/UK 2024-01-16, CH 2024-07-31) — https://support.google.com/adsense/answer/13554116 |
| 14 | BleepingComputer, Google deactivates Russian AdSense accounts (Aug 2024) — https://www.bleepingcomputer.com/news/google/google-deactivates-russian-adsense-accounts-sends-final-payments/ |
| 15 | Yandex Games, advertising and in-app purchases; game requirements — https://yandex.com/dev/games/doc/en/console/adv-monetization · https://yandex.com/dev/games/doc/en/console/purchases · https://yandex.com/dev/games/doc/en/concepts/requirements |
| 16 | Yandex Games licence for developers — https://yandex.ru/legal/licensegames/ru/ |
| 17 | wnhub, Yandex Games 2025 results (2026-01-27) — https://wnhub.io/news/other/item-49945 |
| 18 | Kommersant, browser game platforms pay developers 50–70% (2024-07-26) — https://www.kommersant.ru/doc/6852581 |
| 19 | Habr, earnings from Yandex Games (2023-01-01); FinFocus (2026-10-03) — https://habr.com/ru/articles/708834/ · https://finfocus.today/zarabotok-na-yandeks-igrax.html |
| 20 | Telegram, Terms of Service for bot developers §6.2; Stars payments for digital goods — https://telegram.org/tos/bot-developers · https://core.telegram.org/bots/payments-stars |
| 21 | adminhub, withdrawing Telegram Stars (2026-07-27) — https://adminhub.tools/blog/withdraw-telegram-stars/ |
| 22 | Adsgram, publisher docs — https://docs.adsgram.ai/publisher/ · https://adsgram.ai/monetization |
| 23 | Stripe pricing; Managed Payments eligibility — https://stripe.com/pricing · https://docs.stripe.com/payments/managed-payments/eligibility |
| 24 | Paddle, what you may not sell — https://www.paddle.com/help/start/intro-to-paddle/what-am-i-not-allowed-to-sell-on-paddle |
| 25 | YooKassa fees — https://yookassa.ru/fees/ |
| 26 | Robokassa tariffs; foreign cards (2026-03-25) — https://robokassa.com/payments/tarify/ · https://robokassa.com/blog/articles/inokarty-dlya-biznesa-platezhi-iz-za-rubezha/ |
| 27 | Federal Tax Service, professional income tax (НПД) — https://npd.nalog.ru/ |
| 28 | Bank of Russia daily rates, JSON mirror (2026-10-03) — https://www.cbr-xml-daily.ru/daily_json.js |
| 29 | Apple Small Business Program; Google Play service fees — https://developer.apple.com/app-store/small-business-program/ · https://support.google.com/googleplay/android-developer/answer/112622 |
| 30 | PEGI, interactive risk categories (2026); Reed Smith (2026-03-23) — https://pegi.info/news/pegi-expands-age-rating-criteria-interactive-risk-categories · https://www.reedsmith.com/articles/pegi-launches-interactive-risk-categories-overhauls-age-ratings-for-loot-boxes-in-game-spending-and-communication-features/ |
| 31 | EU consumer-protection network, key principles on in-game virtual currencies (2025-03), via Gleiss Lutz and Linklaters — https://www.gleisslutz.com/en/know-how/new-guidelines-game-currencies-digital-consumer-protection-and-expanding-taboo-dark-patterns · https://techinsights.linklaters.com/post/102k6t4/game-changer-eu-introduces-consumer-protection-guidance-for-in-game-virtual-curr |
| 32 | Freshfields, the Digital Fairness Act for game developers (2025–2026) — https://www.freshfields.com/en/our-thinking/blogs/technology-quotient/the-eus-proposed-digital-fairness-act-a-game-developers-guide-to-potential-imp-102ltio |
| 33 | Xiao, Belgium's loot box ban, Collabra (2023) — https://online.ucpress.edu/collabra/article/9/1/57641/195100/Breaking-Ban-Belgium-s-Ineffective-Gambling-Law |
| 34 | Factotum, Brazil's Digital ECA bans loot boxes for minors (2026); Pixelkin (2025-09-29) — https://factotumcom.substack.com/p/brazil-digital-eca-bans-loot-boxes · https://pixelkin.org/2025/09/29/brazil-becomes-latest-country-to-ban-loot-boxes-targeted-at-minors/ |
| 35 | Game World Observer, 266 games broke South Korea's loot box rules (2024-07-08) — https://gameworldobserver.com/2024/07/08/266-games-violated-loot-box-rules-south-korea |
| 36 | Australian Classification, gambling-like content (effective 2024-09-22) — https://www.classification.gov.au/classification-ratings/new-classifications-for-gambling-content-video-games |
| 37 | Davis Polk, COPPA rule obligations (2025–2026) — https://www.davispolk.com/insights/client-update/ftc-prioritizes-coppa-enforcement-new-compliance-obligations-take-effect |
| 38 | GetMyVAT, OSS for non-EU sellers (2025) — https://www.getmyvat.com/en/resources/oss-registration-eu-non-eu-sellers |
| 39 | Your Europe, returns and withdrawal for digital content — https://europa.eu/youreurope/citizens/consumers/shopping/returns/index_en.htm |
| 40 | PCGamesN, Clicker Heroes 2 abandons microtransactions (2017-11-21) — https://www.pcgamesn.com/clicker-heroes-2/clicker-heroes-2-microtransactions |
| 41 | GameDiscoverCo, Rusty's Retirement (2024-08-28) — https://newsletter.gamediscover.co/p/how-rustys-retirement-idle-farmed |
| 42 | GameSpot, Bongo Cat doesn't make money (2025) — https://www.gamespot.com/articles/viral-steam-hit-bongo-cat-doesnt-actually-make-any-money/1100-6532777/ |
| 43 | Steam, Idle Champions negative reviews — https://steamcommunity.com/app/627690/negativereviews/ |
| 44 | GameAnalytics, 2026 mobile and PC benchmarks (2026-06-04) — https://www.gameanalytics.com/reports/2026-mobile-pc-gaming-benchmarks |
| 45 | Game Growth Advisor, mobile game KPIs 2026 (2026-03-17) — https://gamegrowthadvisor.com/blog/2026-03-17-mobile-game-kpis-benchmarks-2026/ |
| 46 | RBC, the Russian video-game bill (2025-06-18); Senatinform, loot boxes as gambling (2025) — https://www.rbc.ru/technology_and_media/18/06/2025/6852b5dd9a79474a1f9651e3 · https://senatinform.ru/news/prodazhu_lutboksov_geymeram_mogut_priravnyat_k_azartnym_igram_/ |
