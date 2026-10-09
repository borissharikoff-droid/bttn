// BTTN for Steam — the preload (sandboxed, context-isolated): the only door between the game page and the main
// process. It hands the page the save file as it stood at start (synchronously, so it is in localStorage before the
// game boots), a way to write it back, the web export code to and from a file (save carry-over), and Steam
// achievements. steam/bridge.js (inlined into dist/steam.html by `node tools/build.js --target steam`) uses it.
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('BTTN_STEAM', {
  initial: ipcRenderer.sendSync('save:loadSync'),
  save: s => ipcRenderer.invoke('save:write', String(s)),
  saveSync: s => ipcRenderer.sendSync('save:writeSync', String(s)),
  exportFile: code => ipcRenderer.invoke('save:export', String(code)),
  importFile: () => ipcRenderer.invoke('save:import'),
  ach: id => ipcRenderer.invoke('steam:ach', String(id)),
  who: () => ipcRenderer.invoke('steam:who'),
  quit: () => ipcRenderer.invoke('app:quit'),
});
