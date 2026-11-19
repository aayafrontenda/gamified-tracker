// Cross-platform `npm start`: launches Electron with ELECTRON_RUN_AS_NODE cleared.
// Some terminals (VS Code's, Electron-based tools) set it, which makes Electron run as plain
// Node. `env -u` did this before, but it doesn't exist in the Windows shell.
const { spawn } = require('child_process');
const path = require('path');
const electron = require('electron'); // from Node, this is the path to the Electron binary

const env = { ...process.env };
for (const k of Object.keys(env)) if (k.toUpperCase() === 'ELECTRON_RUN_AS_NODE') delete env[k];

const child = spawn(electron, ['.', ...process.argv.slice(2)], {
  cwd: path.join(__dirname, '..'),
  env,
  stdio: 'inherit',
});
child.on('close', (code, signal) => process.exit(signal ? 1 : code ?? 0));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
