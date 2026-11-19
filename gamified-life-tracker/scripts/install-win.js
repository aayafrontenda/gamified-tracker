// `npm run install_app:win`: runs the installer built by `npm run package:win`
// (dist/squirrel/Phantom Life Setup.exe). It installs to %LOCALAPPDATA%\PhantomLife, adds Start menu
// and desktop shortcuts and opens the app. Installing over an existing copy updates it in place.
const fs = require('fs');
const path = require('path');
const { execFileSync, spawn } = require('child_process');

const setup = path.join(__dirname, '..', 'dist', 'squirrel', 'Phantom Life Setup.exe');

if (!fs.existsSync(setup)) {
  console.error(`Not found: ${setup}\nRun "npm run package:win" first.`);
  process.exit(1);
}

// A running copy keeps its files locked — close it (tray → Quit) before reinstalling.
try {
  const out = execFileSync('tasklist', ['/FI', 'IMAGENAME eq Phantom Life.exe', '/NH'], { encoding: 'utf8' });
  if (out.includes('Phantom Life.exe')) {
    console.error('Phantom Life is running. Quit it from the tray icon, then run this again.');
    process.exit(1);
  }
} catch { /* tasklist unavailable — try anyway */ }

// The installer starts the app when it's done, and the app inherits this environment.
// ELECTRON_RUN_AS_NODE (set by VS Code's terminal) would make it run as plain Node.
const env = { ...process.env };
for (const k of Object.keys(env)) if (k.toUpperCase() === 'ELECTRON_RUN_AS_NODE') delete env[k];

spawn(setup, [], { env, stdio: 'ignore' }).on('exit', code => {
  if (code) {
    console.error(`Installer exited with code ${code}.`);
    process.exit(code);
  }
  console.log('Installed. Phantom Life is in the Start menu and on the desktop; uninstall it from Settings → Apps.');
});
