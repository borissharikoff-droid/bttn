# BTTN for Steam (desktop wrapper)

The Steam edition is the same single-file game as the web build, in an Electron window. Nothing here is installed
by the web deploy: this folder has its own `package.json`, and Railway (NIXPACKS) only sees the root one. Keep
Electron out of the root `package.json`, or every deploy would download it.

| File | What it is |
|---|---|
| `package.json` | Electron (dev), `@electron/packager` (dev), `steamworks.js` (optional: the game runs without it) |
| `main.js` | The main process: one window, the save file, Steamworks, file dialogs for the save code |
| `preload.js` | The only bridge to the page (`window.BTTN_STEAM`): the save at start, save writes, export/import to a file, achievements |
| `bridge.js` | Game-side code, inlined into `dist/steam.html` by `node tools/build.js --target steam`: the platform flag, the save mirror, carry-over, achievements |
| `build.js` | `npm run prep`: regenerates `achievements.json`, builds `dist/steam.html`, copies it to `game/index.html` |
| `achievements.js` / `achievements.json` | Every achievement in `js/ach.js` (and 4.0 Deeds when `G.DEEDS` exists) with its Steam API name |
| `steam_appid.txt` | `480` (Valve's Spacewar test app) until BTTN has its own app id |
| `app_build.vdf` | SteamPipe upload script (placeholders for the app and depot ids) |

## What changes on Steam

- `window.BTTN_PLATFORM = 'steam'`. In `js/store.js` this makes `G.Store.ready()` and `G.Ads.ready()` false.
  Gems are only earned there (achievements, land stars, lords, relics, the daily gift); nothing is sold, no ads,
  no claim calls, no network for the store. Looks you already own still work, and the Looks list (tap the Gem chip)
  still lets you unlock looks with earned Gems.
- No analytics: `window.BTTN_AN` is only set by `deploy/serve.js`, and the Steam page is a local file.
- A Content-Security-Policy in the page allows no network except `https:` and Twitch chat (`wss://irc-ws.chat.twitch.tv`,
  for streamer mode).

## Saves and carry-over from the web

The web game keeps its save in `localStorage['bttn-save-v1']` (`js/main.js`). Its export code is
`G.exportSave()`: base64 of the save's JSON. `G.importSave(code)` takes the same code (or the raw JSON) back.
Settings → Save shows it (Export, Copy, Import: `js/ui.js`, the Settings renderer).

On Steam:

1. Electron keeps `localStorage` in a LevelDB folder, which Steam Auto-Cloud can't merge. `bridge.js` mirrors
   every save write to `userData/save.json` (batched every 1.5 s, and synchronously while the window closes;
   `main.js` writes it atomically and keeps `save.json.prev`). At start, the newer of the file and `localStorage`
   wins (by the save's `lastSave`), so a save synced from another PC is loaded.
2. The first start (no save anywhere) shows **Bring your web save**: paste the web export code, or load it from a
   file. It calls `G.importSave(code)`, saves, and reloads.
3. Settings → Save gets **Save to file…** and **Load from file…** (the same code, through a file dialog).
4. Going back from Steam to the web works the same way: Export on Steam, Import on the web.

Steam Auto-Cloud (Steamworks → App Admin → Cloud): quota 1 file, 10 MB. Root `WinAppDataRoaming` path
`BTTN/save.json` (Windows), `LinuxXdgConfigHome` path `BTTN/save.json` (Linux), `MacAppSupport` `BTTN/save.json`
(macOS). Check the folder name against `app.getPath('userData')` in a packaged build: it follows `productName`
or `name` in `package.json`.

## Build and run (a developer machine)

```sh
cd steam
npm install            # Electron, the packager, steamworks.js (prebuilt; no compiler needed)
npm start              # builds game/index.html and opens the window (F11 or Alt+Enter: fullscreen, F12: devtools)
npm run pack           # out/BTTN-win32-x64 and out/BTTN-linux-x64
npm run pack:mac       # out/BTTN-darwin-* (sign and notarize before shipping)
```

With the Steam client running and `steam_appid.txt` in the working folder, Steamworks starts (the overlay with
Shift+Tab, achievements). Without it the game plays offline and saves normally. `STEAM_APPID=<id> npm start`
overrides the file.

## Steamworks setup

1. Pay the Steam Direct fee at least 30 days before release (MARKETING.md, W8). Note the app id and create two
   depots (Windows, Linux; macOS later).
2. Put the app id in `steam_appid.txt` (development only; Steam passes it to a launched game) and in `app_build.vdf`
   with the depot ids.
3. Achievements: App Admin → Stats & Achievements. Add one row per entry in `achievements.json`: API name = `api`,
   display name = `name`, description = `desc`, hidden = `hidden`, plus the achieved and unachieved icons at the size
   the partner site asks for (render them from the game's sprites). Publish. API names must never change once
   published: Steam keys unlocks by them. `node steam/achievements.js` regenerates the file when `js/ach.js` changes
   (pass the file that defines `G.DEEDS` to add 4.0 Deeds as `DEED_*`).
4. Cloud: the Auto-Cloud paths above.
5. Launch options: `BTTN.exe` (Windows), `BTTN` (Linux).

## Upload (SteamPipe)

```sh
npm run pack
# with the Steamworks SDK's steamcmd:
steamcmd +login <builder account> +run_app_build "$(pwd)/app_build.vdf" +quit
```

Then set the build live on a branch (Steamworks → SteamPipe → Builds), test it from the Steam client, and only then
on the default branch.

## Next Fest checklist (February 2027; registration closes Jan 10, 2027)

- [ ] Steam Direct fee paid ≥ 30 days before any release; tax and bank interview done with a non-RU payout route
      (MONETIZATION.md §2.1, scenario B).
- [ ] Store page "Coming soon" (W9): capsules 920×430, 462×174, 1232×706, 748×896, 600×900, library hero 3840×1240,
      logo 1280×720; 5+ screenshots 1920×1080 (the press kit at `/press` has them); short and long descriptions
      with honest numbers ("hundreds on screen, up to ~850", not "1,000+").
- [ ] Trailer (30 s, the beats in MARKETING.md) uploaded; first 5 s show the horde and the Button.
- [ ] Demo app created (a separate app id under the main one), its own depot, same wrapper; the demo saves to the
      same `save.json` folder name only if progress should carry into the full game.
- [ ] `npm run pack` builds on Windows and Linux; tested on a Steam Deck (1280×800, gamepad as mouse, text readable).
- [ ] Achievements published; the overlay opens; a cloud save made on one PC loads on another.
- [ ] Carry-over tested: a web export code imports on Steam; a Steam export imports on the web.
- [ ] No store, no ads, no Gems sold on Steam (`G.Store.ready() === false`).
- [ ] Wishlist button on the own site and the landing (LINK_STEAM env var on the server) once the page is live.
- [ ] Next Fest registration (before Jan 10, 2027); a livestream slot booked; press and creators mailed the demo
      link two weeks before.
