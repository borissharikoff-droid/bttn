# Multiplayer and the ladder: how to build it

The goal: players level their heroes and compete over who is strongest. That takes a fair ladder and reasons to come back every day. Below is what to build, in what order, and why.

## The core problem: clickers are easy to cheat

The whole game runs in the browser. Anyone can open the console and type `G.S.gold = 1e100` or edit their save. So the ladder can't be built on numbers the client sends ("my power is 5 billion"). They will be faked on day one.

The fix: only what the **server has recomputed itself** goes on the ladder.

The code for this is already in place:

- The logic (`js/game.js`, `js/hero.js`) doesn't depend on the browser. `tools/sim.js` already runs it in Node, and a JavaScript server runs the same code unchanged.
- All game randomness goes through `G.rng`, and `G.useSeed(seed)` makes it reproducible. Verified: the same seed and the same actions give the same result down to the last coin (`SEED=42 node tools/sim.js 8`).
- `G.ladderSnapshot()` returns a compact description of the hero: class, level, and the 4 items with their levels, enchants and affixes. The server computes power from it with the same `G.heroCombat()` function and doesn't trust the client's number.
- Each player already has a `profile.id`, a name and records (depth, power, level, time to the Mad Button).

## Modes that keep players around

All of them are asynchronous; no live rooms are needed. That's cheap, scales well and is easy to verify.

### 1. Daily Trial (the core of the ladder)

Every day everyone gets the same seed: the same mob waves, the same bosses, 3 minutes. Each player brings their own hero. The score is depth and clear time. 3 attempts a day, the best one counts.

Why this is the main mode:

- **It's fair.** The client sends an action log, not a result: the time of every click, taps on mobs, ability uses. The server replays the run with the same seed and hero and computes the score itself. You can't fake the result without faking the run.
- **A daily reason to log in.** A new trial every day and a "today's best" table.
- **Skill matters too.** When to use the ability and which mob to hit first is the player's call, not just raw power.

### 2. Seasons and leagues

- A season lasts 4–6 weeks. Each season starts a **fresh seasonal hero**, so everyone starts equal.
- Leagues by trial rating: Bronze → Silver → Gold → Platinum → Diamond → Top 100. Promotion and relegation once a week.
- Rewards are cosmetic only: button skins, profile frames, titles ("Season 3 Conqueror"), a golden name. Hero power never grows from money or rewards, or the ladder loses its meaning.
- After the season, the hero and gear move to the "eternal" world, like seasonal characters in Diablo.

Why reset: even if someone finds an exploit, they ruin one season, not the whole game forever. And every season gives newcomers a shot at the top.

### 3. World boss (weekends)

One huge boss for all players (HP in the trillions). Everyone hits it with their own hero, and the damage adds up on a shared bar.

- Personal rewards by contribution (top 10%, top 50%, "participant") and a shared reward for everyone if the boss dies.
- Technically: the client sends a batch of damage every 10 seconds. The server caps it: no more than verified power × elapsed time × a margin. All it needs is a shared counter, with no real-time sync.
- Great for chats and social media: "let's finish the boss, 3% left".

### 4. Arena (asynchronous PvP)

You against another player's snapshot. Both defend their button against the **same** waves from one seed; whoever gets deeper and faster wins. Elo rating, 5 fights a day. The other player can be offline: the server resolves the fight from the two snapshots.

### 5. Guilds

- Up to 30 members, a shared weekly goal (for example, kill 1 million mobs together), a guild chest with rewards.
- A guild ladder from the sum of its members' trials.
- Guild chat can come later; an event feed is enough at first ("Sam found a Divine Halo").

### 6. Live co-op like RotMG (later, and only if it takes off)

4–8 players in one land defending a shared big button. This is the most expensive part: WebSocket rooms, sync, real-time server simulation. Only build it after the asynchronous modes have gathered an audience.

## Architecture

```
Browser (game)  ──HTTPS──▶  API (Cloudflare Workers)  ──▶  DB (D1 / Postgres)
      │                            │
      │                            ├─ run verification: the same js/game.js + js/hero.js
      │                            └─ world boss counter (Durable Object)
      └─ cloud save and offline mode as today
```

Why Cloudflare Workers: it's JavaScript, so the game code runs on the server as is. The free tier is generous, there are no servers to manage, and D1 (SQLite) is enough for the first few hundred thousand players. An alternative is Supabase (Postgres + auth) with Edge Functions on Deno, which is JavaScript too.

### Sign-in

- First, an anonymous account per device: the player starts playing and lands on the ladder right away.
- Then account linking so progress isn't lost: Telegram, Google or a sign-in link by email.

### Saves

- Cloud save once a minute and on exit. The server keeps the latest version and checks it for plausibility: gold can't grow 1000× in 5 minutes, depth can't jump 20 levels without boss kills, offline income can't exceed the cap.
- A violation doesn't ban right away; it sets a flag, and that player disappears from public ladders until reviewed.

### Loot that can't be forged (the second layer of protection)

Right now items are created on the client. For full protection, the server issues a "loot seed" and a counter once per session. Each item comes from `seed + roll number`, so the server can recompute whether that item could have dropped. A snapshot with a made-up +20 sword won't pass the check.

### Tables

| Table | Fields |
|---|---|
| `players` | id, name, sign-in method, created date, flags |
| `saves` | player_id, save data, version, updated_at |
| `snapshots` | player_id, hero snapshot, recomputed power, updated_at |
| `trials` | date, seed, rules |
| `trial_runs` | player_id, date, action log, score after recompute, verification status |
| `seasons` | id, start, end |
| `ladder` | season_id, player_id, rating, league |
| `world_boss` | event_id, HP, player contributions |
| `guilds`, `guild_members` | membership, weekly progress |

### API

```
POST /auth/anon                  → token
PUT  /save                       → cloud save (with plausibility check)
PUT  /snapshot                   → hero snapshot; the server computes power itself
GET  /trial/today                → trial seed and rules
POST /trial/run                  → action log; the server replays it and returns the score
GET  /ladder?mode=trial&season=3 → ladder table (the top and the player's neighbours)
POST /boss/damage                → a batch of damage to the world boss (capped)
GET  /boss                       → HP and your contribution
```

## Where to launch to get players fast

- **Yandex Games.** Built-in leaderboards, cloud saves and auth through the SDK, and a large HTML5-games audience. The least server work for a first ladder.
- **Telegram Mini App.** Clickers are popular there right now. Auth comes free by checking the `initData` signature, and friends and guilds map naturally onto chats.
- **Your own site + itch.io**: full control, but you have to bring the traffic yourself.

A good plan: launch on Yandex Games or Telegram with their leaderboards, and add your own trial server once there are players.

## What already works (stage 1)

- `js/net.js` is a sync layer with two interchangeable backends:
  - **the published page's database** on claude.ai: a private cloud save at `data/users/<id>/save` (only the player can see it) and a shared ladder at `ladder/<id>`, where each player writes only their own row;
  - **your own server** (`server/`): Cloudflare Worker + D1. Turned on by an address in `localStorage['bttn-api']` or `window.BTTN_API`.
- Ladder power is computed by `G.ladderPower()` from gear, level and class only, the same for everyone. `G.verifySnapshot()` weeds out impossible items: enchants above +20, affixes outside their rarity's range, item levels above depth, items in the wrong slot, a wrong power value. The server rejects such snapshots with a 422 and recomputes power itself; in the claude.ai version every client re-checks every entry and hides suspicious ones.
- The cloud save is offered when the cloud has more progress than this browser. Nothing is uploaded until the player answers, so a new device never overwrites a real save.
- Checks: `node tools/test-server.js` (15 cases); `node tools/dev-server.js` runs the server locally.

The stage 1 limitation: a snapshot made of plausible but invented items still passes. Stage 2 (a trial with server-side replay) and the server "loot seed" close that gap.

## Roadmap

| Stage | What | Status |
|---|---|---|
| 0 | Hero: class, levels, 4 slots, items with level, affixes and enchant, mobs, power. Ladder snapshot, profile, reproducible randomness | **done** |
| 1 | Anonymous sign-in, cloud save, ladder by depth and power with snapshot checks | **done**: in the published game (page database) and the `server/` server on Cloudflare Workers |
| 2 | Daily Trial with server-side run replay: a fair ladder | next |
| 3 | Seasons, leagues, cosmetic rewards, weekend world boss | |
| 4 | Arena with Elo, guilds and their weekly goals | |
| 5 | Live co-op (if there's an audience) | |

## What else to add to the game itself for retention

- **Gear sets** (4 items of one theme grant a special effect): the next most important thing after affixes.
- **Dungeon keys**: a rare portal dropped by mobs opens a timed run with a guaranteed rare bag.
- **A vault** with limited space, as in RotMG: it forces choices about what to keep.
- **Feeding pets with items** instead of scrapping them.
- **A season pass without payments**: 30 reward tiers for daily quests and trials.
