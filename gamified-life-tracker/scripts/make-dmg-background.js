// `npm run dmg-background`: renders build/installer/dmg.html into build/installer/dmg-background.png
// (540×380) and dmg-background@2x.png (1080×760) — the macOS installer window's background. The PNGs
// are committed, so building the DMG on a Mac doesn't need this step.
//
// Run from Node, it relaunches itself inside Electron (with ELECTRON_RUN_AS_NODE cleared).
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const W = 540, H = 380;
const DIR = path.join(ROOT, 'build', 'installer');

if (!process.versions.electron) {
  const { spawn } = require('child_process');
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (k.toUpperCase() === 'ELECTRON_RUN_AS_NODE') delete env[k];
  for (const scale of [1, 2]) {
    // one Electron run per scale: the device scale factor is fixed at startup
    const r = require('child_process').spawnSync(require(path.join(ROOT, 'node_modules', 'electron')),
      [__filename, '--disable-gpu', `--scale=${scale}`], { env, stdio: 'inherit' });
    if (r.status) process.exit(r.status);
  }
  return;
}

const scale = Number((process.argv.find(a => a.startsWith('--scale=')) || '--scale=1').split('=')[1]);
const { app, BrowserWindow } = require('electron');
app.commandLine.appendSwitch('force-device-scale-factor', String(scale));
app.on('window-all-closed', () => {});

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: W, height: H, useContentSize: true, show: false, frame: false, webPreferences: { backgroundThrottling: false } });
  await win.loadFile(path.join(DIR, 'dmg.html'));
  await new Promise(r => setTimeout(r, 500)); // fonts
  let img = await win.webContents.capturePage({ x: 0, y: 0, width: W, height: H });
  const s = img.getSize();
  if (s.width !== W * scale) img = img.resize({ width: W * scale, height: H * scale, quality: 'best' });
  const out = path.join(DIR, scale === 1 ? 'dmg-background.png' : 'dmg-background@2x.png');
  fs.writeFileSync(out, img.toPNG());
  console.log(`build/installer/${path.basename(out)}  ${W * scale}×${H * scale}`);
  app.quit();
}).catch(e => { console.error(e); app.exit(1); });
