const { _electron: electron } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');

const APP_DIR = path.join(__dirname, '..');

/** A fresh, empty save folder (the real save is never touched). */
function tempUserData() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'phantom-life-test-'));
}

/**
 * Launches the app against `userData` and waits for the first render.
 * An empty save opens character creation; unless `fresh` is set, it's skipped and the sample
 * character (DevOps, Frontend, Sports…) is loaded instead.
 * Returns { app, page } — `page` is the main window.
 */
async function launch(userData, { fresh = false } = {}) {
  const env = { ...process.env, PL_USERDATA: userData };
  // Set by VS Code's terminal; makes Electron run as plain Node.
  for (const k of Object.keys(env)) if (k.toUpperCase() === 'ELECTRON_RUN_AS_NODE') delete env[k];
  const app = await electron.launch({ args: [APP_DIR], cwd: APP_DIR, env });
  const page = await app.firstWindow();
  await page.waitForSelector('#side .menu', { state: 'attached' });
  await page.waitForFunction(() => typeof window.__skipOnboarding === 'function');
  if (!fresh) await page.evaluate(() => window.__skipOnboarding());
  return { app, page };
}

/** Values derived from the journal (XP, stats, ¥) — read straight from the renderer. */
const derived = page => page.evaluate(() => derive());

module.exports = { launch, tempUserData, derived };
