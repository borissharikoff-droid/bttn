// Prepares the wrapper: regenerates steam/achievements.json from js/ach.js, builds the Steam page
// (node tools/build.js --target steam → dist/steam.html, nothing else) and copies it to steam/game/index.html,
// the file main.js loads. Run from anywhere: node steam/build.js (npm run prep does it).
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
execFileSync(process.execPath, [path.join(__dirname, 'achievements.js')], { stdio: 'inherit' });
execFileSync(process.execPath, [path.join(root, 'tools', 'build.js'), '--target', 'steam'], { stdio: 'inherit' });
fs.mkdirSync(path.join(__dirname, 'game'), { recursive: true });
fs.copyFileSync(path.join(root, 'dist', 'steam.html'), path.join(__dirname, 'game', 'index.html'));
console.log('steam/game/index.html ready');
