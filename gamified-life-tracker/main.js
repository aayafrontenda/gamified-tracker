const { app, BrowserWindow, ipcMain, dialog, shell, globalShortcut, Notification, Tray, Menu, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

const IS_MAC = process.platform === 'darwin';
const IS_WIN = process.platform === 'win32';
const ICON = path.join(__dirname, 'src', 'assets', 'icon.ico'); // Windows/Linux window + tray icon
const APP_ID = 'local.phantomlife';
// Fixed so the Start Menu shortcut and the running app agree (Electron picks a random one per run
// otherwise). Lets toasts that moved to the Action Center still activate the app.
const TOAST_CLSID = '{482CAAF0-BF9F-4558-8EFB-FE741FC19CD3}';

app.setName('Phantom Life');
// Dev/testing hook: point the save at a throwaway folder.
if (process.env.PL_USERDATA) app.setPath('userData', process.env.PL_USERDATA);

// Test runs (screenshots / eval) skip hotkeys, reminders and login items.
const TEST = !!(process.env.PL_SHOT || process.env.PL_EVAL);
let mainWin = null;
// Reminders and the hotkey belong to the installed app only, so `npm start` next to it
// doesn't double them. (macOS already keeps the installed app to a single copy; Electron's
// own single-instance lock rejects ad-hoc signed builds, so it's only used on Windows/Linux.)
const BACKGROUND = !TEST && app.isPackaged;
const PRIMARY = IS_MAC || !BACKGROUND || app.requestSingleInstanceLock();
if (!PRIMARY) app.quit();
else app.on('second-instance', () => showWindow());

// Start-at-login: macOS reports it itself; Windows/Linux get a flag in the login command.
const LOGIN_OPTS = IS_MAC ? {} : { args: ['--hidden'] };
const openedAtLogin = () => IS_MAC ? app.getLoginItemSettings().wasOpenedAtLogin : process.argv.includes('--hidden');

// Windows only shows toasts for an app with an AppUserModelID that a Start Menu shortcut
// carries. The installer creates the shortcut; rewriting it here adds the toast activator CLSID
// and covers a build run straight from dist/win-unpacked.
function ensureWinShortcut() {
  if (!IS_WIN || !BACKGROUND) return;
  app.setAppUserModelId(APP_ID);
  app.setToastActivatorCLSID(TOAST_CLSID);
  try {
    const lnk = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Phantom Life.lnk');
    shell.writeShortcutLink(lnk, fs.existsSync(lnk) ? 'replace' : 'create', {
      target: process.execPath, appUserModelId: APP_ID, toastActivatorClsid: TOAST_CLSID, icon: process.execPath, iconIndex: 0,
      description: 'Phantom Life — take your time.',
    });
  } catch (e) {
    console.error('shortcut failed', e);
  }
}

const savePath = () => path.join(app.getPath('userData'), 'save.json');
const backupDir = () => path.join(app.getPath('userData'), 'backups');

function writeAtomic(file, data) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

// One backup per day, keep the last 14.
function dailyBackup() {
  try {
    if (!fs.existsSync(savePath())) return;
    fs.mkdirSync(backupDir(), { recursive: true });
    const stamp = new Date().toISOString().slice(0, 10);
    const target = path.join(backupDir(), `save-${stamp}.json`);
    if (!fs.existsSync(target)) fs.copyFileSync(savePath(), target);
    const files = fs.readdirSync(backupDir()).filter(f => f.startsWith('save-')).sort();
    files.slice(0, Math.max(0, files.length - 14)).forEach(f => fs.unlinkSync(path.join(backupDir(), f)));
  } catch (e) {
    console.error('backup failed', e);
  }
}

ipcMain.handle('load', () => {
  try {
    return JSON.parse(fs.readFileSync(savePath(), 'utf8'));
  } catch {
    return null;
  }
});

ipcMain.handle('save', (_e, data) => {
  writeAtomic(savePath(), data);
  return true;
});

ipcMain.on('save-sync', (e, data) => {
  try { writeAtomic(savePath(), data); e.returnValue = true; } catch { e.returnValue = false; }
});

ipcMain.handle('export', async (_e, data) => {
  const stamp = new Date().toISOString().slice(0, 10);
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: path.join(app.getPath('documents'), `phantom-life-${stamp}.json`),
    filters: [{ name: 'Save file', extensions: ['json'] }],
  });
  if (canceled || !filePath) return false;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  return true;
});

ipcMain.handle('import', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Save file', extensions: ['json'] }],
  });
  if (canceled || !filePaths[0]) return null;
  return JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
});

ipcMain.handle('reveal-save', () => shell.showItemInFolder(savePath()));
ipcMain.handle('set-hotkey', (_e, on) => applyHotkey(on));
ipcMain.handle('set-login', (_e, on) => {
  // Outside macOS a dev run would register the bare electron.exe, so only the installed app does it.
  if (!TEST && (IS_MAC || app.isPackaged)) app.setLoginItemSettings({ openAtLogin: !!on, ...LOGIN_OPTS });
  return app.getLoginItemSettings(LOGIN_OPTS).openAtLogin;
});
// Delayed so the user can switch to another app: macOS shows no banner for the focused app.
ipcMain.handle('test-notify', async () => {
  if (!Notification.isSupported() || await winToastsBlocked()) return 'unsupported';
  setTimeout(() => remind('dailies', true), 5000);
  return 'scheduled';
});

// Windows drops toasts silently when they're switched off — for all apps, or for this one
// (Settings → System → Notifications). Both switches are plain registry values.
function winToastsBlocked() {
  if (!IS_WIN) return Promise.resolve(false);
  const isOff = (key, name) => new Promise(res =>
    execFile('reg', ['query', key, '/v', name], { windowsHide: true }, (err, out) => res(!err && /REG_DWORD\s+0x0\s*$/m.test(out))));
  const base = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion';
  return Promise.all([
    isOff(`${base}\\PushNotifications`, 'ToastEnabled'),
    isOff(`${base}\\Notifications\\Settings\\${APP_ID}`, 'Enabled'),
  ]).then(r => r.some(Boolean));
}
ipcMain.handle('save-path', () => savePath());

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1120,
    minHeight: 740,
    backgroundColor: '#0b0b0b',
    // macOS: traffic lights inset into the content. Windows/Linux: frameless top with native
    // min/max/close drawn over the top-right corner (the .dragbar strip is the drag handle).
    ...(IS_MAC
      ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 18, y: 16 } }
      : { titleBarStyle: 'hidden', titleBarOverlay: { color: '#0b0b0b', symbolColor: '#f4f2ec', height: 34 }, icon: ICON }),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: !process.env.PL_SHOT,
    },
  });
  if (!IS_MAC && app.isPackaged) win.removeMenu();
  // The UI is one local page: never navigate away or open other windows (links, middle-click, drops).
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWin = win;
  win.on('closed', () => { if (mainWin === win) mainWin = null; });

  // Dev/testing hook: PL_EVAL=<js> runs an expression after load, prints the result and quits.
  if (process.env.PL_EVAL) {
    win.webContents.once('did-finish-load', async () => {
      await new Promise(r => setTimeout(r, 800));
      try { console.log('PL_EVAL', JSON.stringify(await win.webContents.executeJavaScript(process.env.PL_EVAL))); }
      catch (e) { console.log('PL_EVAL_ERR', e.message); }
      app.quit();
    });
  }

  // Dev/testing hook: PL_SHOT=<dir> captures every screen to PNGs and quits.
  if (process.env.PL_SHOT) {
    win.webContents.once('did-finish-load', async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      await wait(800);
      if (process.env.PL_SEED) await win.webContents.executeJavaScript('window.__seedDemo && window.__seedDemo()');
      for (const id of ['status', 'skills', 'quests', 'confidants', 'journal', 'compendium', 'velvet', 'shop', 'system']) {
        await win.webContents.executeJavaScript(`go(${JSON.stringify(id)})`);
        await wait(id === "velvet" ? 4500 : 700);
        const img = await win.webContents.capturePage();
        fs.writeFileSync(path.join(process.env.PL_SHOT, `${id}.png`), img.toPNG());
        if (id === 'journal') {
          for (const tab of ['calendar', 'charts']) {
            await win.webContents.executeJavaScript(`journalTab = '${tab}'; render()`);
            await wait(600);
            fs.writeFileSync(path.join(process.env.PL_SHOT, `journal-${tab}.png`), (await win.webContents.capturePage()).toPNG());
          }
          await win.webContents.executeJavaScript("journalTab = 'log'");
        }
        if (id === 'velvet') {
          await win.webContents.executeJavaScript("document.querySelector('#main').scrollTop = 99999");
          await wait(500);
          fs.writeFileSync(path.join(process.env.PL_SHOT, 'velvet-contract.png'), (await win.webContents.capturePage()).toPNG());
        }
      }
      await win.webContents.executeJavaScript('window.__demoRankUp && window.__demoRankUp()');
      await wait(900);
      fs.writeFileSync(path.join(process.env.PL_SHOT, 'rankup.png'), (await win.webContents.capturePage()).toPNG());
      await win.webContents.executeJavaScript('closeRankUp(); openQuickLog()');
      await wait(500);
      fs.writeFileSync(path.join(process.env.PL_SHOT, 'quicklog.png'), (await win.webContents.capturePage()).toPNG());
      await win.webContents.executeJavaScript('closeModal(); skillModal(state.skills[0].id)');
      await wait(500);
      fs.writeFileSync(path.join(process.env.PL_SHOT, 'skillmodal.png'), (await win.webContents.capturePage()).toPNG());
      app.quit();
    });
  }
}

/* ---------- window helpers ---------- */
function showWindow() {
  if (!mainWin) {
    createWindow();
    return new Promise(r => mainWin.webContents.once('did-finish-load', () => setTimeout(r, 400)));
  }
  if (mainWin.isMinimized()) mainWin.restore();
  mainWin.show();
  mainWin.focus();
  app.focus({ steal: true });
  return Promise.resolve();
}
async function sendToRenderer(channel, ...args) {
  await showWindow();
  mainWin.webContents.send(channel, ...args);
}

/* ---------- global hotkey: Take Action from anywhere ---------- */
const HOTKEY = 'CommandOrControl+Shift+L';
function applyHotkey(on) {
  if (!BACKGROUND) return false;
  globalShortcut.unregister(HOTKEY);
  if (on) globalShortcut.register(HOTKEY, () => sendToRenderer('quick-log'));
  return globalShortcut.isRegistered(HOTKEY);
}

/* ---------- tray (Windows/Linux): keeps the app alive with the window closed ---------- */
let tray = null;
function createTray() {
  if (IS_MAC || !BACKGROUND || tray) return;
  tray = new Tray(ICON);
  tray.setToolTip('Phantom Life');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Phantom Life', click: () => showWindow() },
    { label: 'Take action', click: () => sendToRenderer('quick-log') },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]));
  tray.on('click', () => showWindow());
}

/* ---------- Morgana: reminders (run in main, so they work with the window closed) ---------- */
const pad = n => String(n).padStart(2, '0');
const dkey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const weekKey = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return dkey(x); };
const pick = a => a[Math.floor(Math.random() * a.length)];
const minutesOf = hm => { const [h, m] = String(hm || '').split(':').map(Number); return Number.isFinite(h) ? h * 60 + (m || 0) : null; };
const fired = {}; // kind -> date it last fired

function readSave() {
  try { return JSON.parse(fs.readFileSync(savePath(), 'utf8')); } catch { return null; }
}

// Keep references so notifications aren't garbage-collected before they're clicked.
const live = new Set();
function notify(title, body, screen) {
  if (!Notification.isSupported()) return null;
  const n = new Notification({ title, body });
  live.add(n);
  n.on('click', () => { live.delete(n); sendToRenderer('go', screen); });
  n.on('close', () => live.delete(n));
  n.show();
  // macOS hides banners from the app in focus — so say it inside the window too.
  if (mainWin && mainWin.isFocused()) mainWin.webContents.send('morgana', { title, body, screen });
  return n;
}

function pendingDailies(save, now) {
  const today = dkey(now), dow = now.getDay();
  return (save.quests || []).filter(q => q.type === 'daily'
    && (!q.days || q.days.includes(dow))
    && !(save.log || []).some(e => e.questId === q.id && e.date === today));
}

// force=true: send right now (System → "Test Morgana").
function remind(kind, force = false) {
  const save = readSave();
  if (!save) return;
  const st = save.settings || {};
  const now = new Date(), today = dkey(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  // Fire once a day, only within 90 min after the chosen time (so a late launch doesn't nag at noon).
  const due = (on, at) => {
    if (force) return true;
    const t = minutesOf(at);
    return on !== false && t !== null && fired[kind] !== today && nowMin >= t && nowMin - t < 90;
  };

  if (kind === 'dailies' && due(st.remindDailies, st.dailiesAt || '21:00')) {
    fired[kind] = today;
    const left = pendingDailies(save, now);
    if (!left.length && !force) return;
    const list = left.slice(0, 3).map(q => q.title).join(', ') + (left.length > 3 ? '…' : '');
    return notify('Morgana', left.length ? pick([
      `Hey Joker! You've still got ${left.length} daily quest${left.length > 1 ? 's' : ''}: ${list}.`,
      `Don't slack off now! ${list} still need${left.length > 1 ? '' : 's'} doing.`,
      `Mrrrow… the day's almost over and ${list} ${left.length > 1 ? "aren't" : "isn't"} done.`,
    ]) : 'All dailies cleared today. Not bad, Joker!', 'quests');
  }
  if (kind === 'bed' && due(st.remindBed, st.bedAt || '23:30')) {
    fired[kind] = today;
    notify('Morgana', pick([
      "Let's go to sleep, Joker.",
      "It's getting late. Let's call it a day.",
      'You should get some rest. Big day tomorrow.',
    ]), 'status');
  }
  if (kind === 'velvet' && now.getDay() === 0 && due(st.remindVelvet, '19:00')) {
    fired[kind] = today;
    if ((save.reviews || {})[weekKey(now)]) return;
    notify('Igor', 'Welcome to the Velvet Room… The week draws to a close. Come, let us appraise it.', 'velvet');
  }
}
const checkReminders = () => ['dailies', 'bed', 'velvet'].forEach(k => remind(k));

app.whenReady().then(() => {
  if (!PRIMARY) return;
  // No camera, mic, location, etc. — the renderer never needs a web permission.
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  dailyBackup();
  ensureWinShortcut();
  const st = (readSave() || {}).settings || {};
  // Started at login: stay in the background (Dock / tray) — reminders and the hotkey still work.
  if (!openedAtLogin()) createWindow();
  if (BACKGROUND) {
    createTray();
    applyHotkey(st.hotkey !== false);
    setTimeout(checkReminders, 5000);
    setInterval(checkReminders, 30 * 1000);
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => globalShortcut.unregisterAll());

// macOS keeps running in the Dock; the installed app elsewhere keeps running in the tray.
app.on('window-all-closed', () => {
  if (!IS_MAC && !tray) app.quit();
});
