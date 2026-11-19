// Second half of `npm run package:win`: wraps dist/win-unpacked (from `electron-builder --win --dir`)
// into a Squirrel installer — dist/squirrel/Phantom Life Setup.exe. Double-click: it plays
// build/installer/loading.gif while it installs to %LOCALAPPDATA%\PhantomLife, adds Start menu and
// desktop shortcuts, then opens the app. No wizard, no admin rights. Uninstall: Settings → Apps.
const path = require('path');
const { createWindowsInstaller } = require('electron-winstaller');
const pkg = require('../package.json');

const ROOT = path.join(__dirname, '..');
const APP_DIR = path.join(ROOT, 'dist', 'win-unpacked');

// Squirrel's package template expects Electron's license as plain LICENSE; electron-builder names it
// LICENSE.electron.txt.
const fs = require('fs');
const license = path.join(APP_DIR, 'LICENSE');
if (!fs.existsSync(license)) fs.copyFileSync(path.join(APP_DIR, 'LICENSE.electron.txt'), license);

createWindowsInstaller({
  appDirectory: APP_DIR,
  outputDirectory: path.join(ROOT, 'dist', 'squirrel'),
  exe: 'Phantom Life.exe',
  name: 'PhantomLife', // package id → install folder; no spaces or dashes
  title: 'Phantom Life',
  authors: 'Phantom Life',
  description: pkg.description,
  version: pkg.version,
  setupExe: 'Phantom Life Setup.exe',
  setupIcon: path.join(ROOT, 'src', 'assets', 'icon.ico'),
  loadingGif: path.join(ROOT, 'build', 'installer', 'loading.gif'),
  noMsi: true,
}).then(
  () => console.log('dist/squirrel/Phantom Life Setup.exe'),
  e => { console.error(e.message || e); process.exit(1); },
);
