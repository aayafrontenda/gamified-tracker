// `npm run splash`: renders build/installer/splash.html frame by frame into build/installer/loading.gif —
// the animation Squirrel shows while installing. One seamless loop of LOOP_MS.
//
// Run from Node, it relaunches itself inside Electron (with ELECTRON_RUN_AS_NODE cleared).
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const W = 600, H = 340, LOOP_MS = 2400, FPS = 25;
const OUT = path.join(ROOT, 'build', 'installer', 'loading.gif');

if (!process.versions.electron) {
  const { spawn } = require('child_process');
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (k.toUpperCase() === 'ELECTRON_RUN_AS_NODE') delete env[k];
  spawn(require(path.join(ROOT, 'node_modules', 'electron')), [__filename, '--disable-gpu'], { env, stdio: 'inherit' })
    .on('close', code => process.exit(code ?? 0));
  return;
}

const { app, BrowserWindow } = require('electron');
const { GIFEncoder, quantize, applyPalette } = require('gifenc');
app.commandLine.appendSwitch('force-device-scale-factor', '1'); // 1 CSS px = 1 GIF px
app.on('window-all-closed', () => {});

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: W, height: H, useContentSize: true, show: false, frame: false, webPreferences: { backgroundThrottling: false } });
  await win.loadFile(path.join(ROOT, 'build', 'installer', 'splash.html'));
  await new Promise(r => setTimeout(r, 500)); // fonts

  const count = Math.round((LOOP_MS / 1000) * FPS);
  const frames = [];
  for (let i = 0; i < count; i++) {
    await win.webContents.executeJavaScript(`seek(${(i * LOOP_MS) / count})`);
    await new Promise(r => setTimeout(r, 30));
    const img = await win.webContents.capturePage({ x: 0, y: 0, width: W, height: H });
    const bgra = img.toBitmap();
    const rgba = new Uint8Array(bgra.length);
    for (let p = 0; p < bgra.length; p += 4) { rgba[p] = bgra[p + 2]; rgba[p + 1] = bgra[p + 1]; rgba[p + 2] = bgra[p]; rgba[p + 3] = 255; }
    frames.push(rgba);
    if (process.env.SPLASH_FRAMES) fs.writeFileSync(path.join(process.env.SPLASH_FRAMES, `frame-${i}.png`), img.toPNG());
  }

  // One palette for the whole loop (sampled across frames) so colors don't flicker between frames.
  const sample = new Uint8Array(W * H * 4 * 4);
  [0, 0.25, 0.5, 0.75].forEach((f, k) => sample.set(frames[Math.floor(f * count)], k * W * H * 4));
  const palette = quantize(sample, 256);

  const gif = GIFEncoder();
  const delay = Math.round(1000 / FPS);
  frames.forEach((rgba, i) => gif.writeFrame(applyPalette(rgba, palette), W, H, i === 0 ? { palette, delay, repeat: 0 } : { delay }));
  gif.finish();
  fs.writeFileSync(OUT, gif.bytes());
  console.log(`build/installer/loading.gif  ${W}×${H}, ${count} frames, ${Math.round(fs.statSync(OUT).size / 1024)} KB`);
  app.quit();
}).catch(e => { console.error(e); app.exit(1); });
