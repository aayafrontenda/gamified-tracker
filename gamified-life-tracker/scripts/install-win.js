// `npm run install_app:win`: copies the packaged app to %LOCALAPPDATA%\Programs\Phantom Life.
// On first launch the app adds itself to the Start Menu (needed for Windows notifications).
const fs = require('fs');
const path = require('path');
const { execFileSync, spawn } = require('child_process');

const src = path.join(__dirname, '..', 'dist', `Phantom Life-win32-${process.arch}`);
const dest = path.join(process.env.LOCALAPPDATA, 'Programs', 'Phantom Life');
const exe = path.join(dest, 'Phantom Life.exe');

if (!fs.existsSync(src)) {
  console.error(`Not found: ${src}\nRun "npm run package:win" first.`);
  process.exit(1);
}

// A running copy locks its files — close it (tray → Quit) before replacing.
try {
  const out = execFileSync('tasklist', ['/FI', 'IMAGENAME eq Phantom Life.exe', '/NH'], { encoding: 'utf8' });
  if (out.includes('Phantom Life.exe')) {
    console.error('Phantom Life is running. Quit it from the tray icon, then run this again.');
    process.exit(1);
  }
} catch { /* tasklist unavailable — try anyway */ }

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.cpSync(src, dest, { recursive: true });
console.log(`Installed to ${dest}`);

// Launch it once so it adds its Start Menu shortcut. ELECTRON_RUN_AS_NODE (set by VS Code's
// terminal) would make it run as plain Node, so it's cleared for the child.
const env = { ...process.env };
for (const k of Object.keys(env)) if (k.toUpperCase() === 'ELECTRON_RUN_AS_NODE') delete env[k];
spawn(exe, [], { env, detached: true, stdio: 'ignore' }).unref();
console.log('Launched. From now on, open it from the Start Menu: "Phantom Life".');
