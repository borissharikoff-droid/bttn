// BTTN for Steam — the Electron main process. One window with the single-file game (game/index.html, a copy of
// dist/steam.html made by `node build.js`), Steamworks when the Steam client is running (achievements, overlay, the
// player's name), and the save kept in a file Steam Auto-Cloud can sync (userData/save.json): Electron's own
// localStorage is a LevelDB folder, which Auto-Cloud can't merge. Nothing here talks to the network.
'use strict';
const { app, BrowserWindow, shell, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// the app id: STEAM_APPID, else steam_appid.txt (480 = Valve's Spacewar test app until BTTN has its own)
const APPID = (() => {
  const v = +(process.env.STEAM_APPID || (() => { try { return fs.readFileSync(path.join(__dirname, 'steam_appid.txt'), 'utf8').trim(); } catch (e) { return ''; } })());
  return v > 0 ? v : 480;
})();
// Steamworks is optional: without the Steam client (or the native module) the game plays offline, saves still work
let steam = null;
try {
  const sw = require('steamworks.js');
  steam = sw.init(APPID);
  sw.electronEnableSteamOverlay();
} catch (e) { steam = null; }

if (!app.requestSingleInstanceLock()) app.quit();
const GAME = path.join(__dirname, 'game', 'index.html');
const SAVE = () => path.join(app.getPath('userData'), 'save.json');
let win = null;

// ---------- the save file (atomic: write a temp file, keep the last good one, rename) ----------
const okSave = s => typeof s === 'string' && s.length > 2 && s.length < 8e6 && s[0] === '{';
function readSave() {
  for (const f of [SAVE(), SAVE() + '.prev']) {
    try { const s = fs.readFileSync(f, 'utf8'); if (okSave(s)) { JSON.parse(s); return s; } } catch (e) { /* missing or torn: try the previous one */ }
  }
  return null;
}
function writeSave(s) {
  if (!okSave(s)) return false;
  try {
    const f = SAVE(), tmp = f + '.tmp';
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(tmp, s);
    try { fs.copyFileSync(f, f + '.prev'); } catch (e) { /* first save */ }
    fs.renameSync(tmp, f);
    return true;
  } catch (e) { return false; }
}
// only our own page may call in (no other frame, no navigated-away page)
const { fileURLToPath } = require('url');
const same = (a, b) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);
const ours = e => { try { return !!e.senderFrame && /^file:/i.test(e.senderFrame.url) && same(path.resolve(fileURLToPath(e.senderFrame.url)), path.resolve(GAME)); } catch (er) { return false; } };

// (the preload asks before the page has run anything, when the frame may still read about:blank; the window never
// leaves the game's own file (will-navigate below), so a file: or blank frame here is ours)
ipcMain.on('save:loadSync', e => { const u = (e.senderFrame && e.senderFrame.url) || ''; e.returnValue = ours(e) || /^(file:|about:blank|$)/.test(u) ? readSave() : null; });
ipcMain.handle('save:write', (e, s) => ours(e) && writeSave(s));
ipcMain.on('save:writeSync', (e, s) => { e.returnValue = ours(e) && writeSave(s); });
// the web build's export code (Settings → Export) to and from a text file: how a web save comes to Steam and back
ipcMain.handle('save:export', async (e, code) => {
  if (!ours(e) || typeof code !== 'string' || !code || code.length > 8e6) return false;
  const r = await dialog.showSaveDialog(win, { defaultPath: 'bttn-save.txt', filters: [{ name: 'BTTN save code', extensions: ['txt'] }] });
  if (r.canceled || !r.filePath) return false;
  try { fs.writeFileSync(r.filePath, code); return true; } catch (er) { return false; }
});
ipcMain.handle('save:import', async e => {
  if (!ours(e)) return null;
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'BTTN save code', extensions: ['txt', 'json'] }] });
  if (r.canceled || !r.filePaths || !r.filePaths[0]) return null;
  try { const st = fs.statSync(r.filePaths[0]); return st.size < 8e6 ? fs.readFileSync(r.filePaths[0], 'utf8') : null; } catch (er) { return null; }
});
// ---------- Steam ----------
ipcMain.handle('steam:ach', (e, id) => {
  if (!ours(e) || !steam || !/^[A-Z0-9_]{1,64}$/.test(String(id))) return false;
  try { return !!steam.achievement.activate(id); } catch (er) { return false; }
});
ipcMain.handle('steam:who', e => {
  if (!ours(e) || !steam) return null;
  try { return { name: String(steam.localplayer.getName() || '').slice(0, 64) }; } catch (er) { return null; }
});
ipcMain.handle('app:quit', e => { if (ours(e)) app.quit(); return true; });

function open() {
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 960, minHeight: 540, backgroundColor: '#0e0c15', autoHideMenuBar: true, show: false, title: 'BTTN',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false, spellcheck: false },
  });
  win.loadFile(GAME);
  win.once('ready-to-show', () => win.show());
  // links (Discord, the press kit, the store page) open in the player's browser; the game never navigates away
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!ours({ senderFrame: { url } })) { e.preventDefault(); if (/^https:\/\//i.test(url)) shell.openExternal(url); } });
  win.webContents.on('before-input-event', (e, i) => {
    if (i.type !== 'keyDown') return;
    if (i.key === 'F11' || (i.alt && i.key === 'Enter')) { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    // a developer build only: F12 for the console (packaged builds have no menu and no devtools shortcut)
    if (i.key === 'F12' && !app.isPackaged) { win.webContents.toggleDevTools(); e.preventDefault(); }
  });
}
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(open);
app.on('window-all-closed', () => app.quit());
