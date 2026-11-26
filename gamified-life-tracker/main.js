const { app, BrowserWindow, ipcMain, dialog, shell, globalShortcut, Notification, Tray, Menu, session, powerMonitor, clipboard, ClipboardItem, screen } = require('electron');
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
// Tests pin the system language (Chromium's --lang) so "System language" means the same everywhere.
if (process.env.PL_LANG) app.commandLine.appendSwitch('lang', process.env.PL_LANG);

// Test runs (screenshots / eval) skip hotkeys, reminders and login items.
const TEST = !!(process.env.PL_SHOT || process.env.PL_EVAL || process.env.PL_HIDDEN);
// Tests and screenshots: never show the window (it would jump in front of whatever you're doing)
// and switch off animations so every check sees the final state.
const HIDDEN = !!process.env.PL_HIDDEN;
let mainWin = null;
// Reminders and the hotkey belong to the installed app only, so `npm start` next to it
// doesn't double them. (macOS already keeps the installed app to a single copy; Electron's
// own single-instance lock rejects ad-hoc signed builds, so it's only used on Windows/Linux.)
const BACKGROUND = !TEST && app.isPackaged;

// Windows installer = Squirrel: the app lives in <install>\app-<version>\ next to Update.exe, which
// starts it once with a --squirrel-* flag on install / update / uninstall (handled below, then quit).
const SQUIRREL_UPDATE = IS_WIN ? path.resolve(path.dirname(process.execPath), '..', 'Update.exe') : '';
const SQUIRREL = IS_WIN && app.isPackaged && fs.existsSync(SQUIRREL_UPDATE);
const EXE_NAME = path.basename(process.execPath);

// Start-at-login: macOS reports it itself; Windows/Linux get a flag in the login command. Under
// Squirrel the app folder changes with every version, so login goes through Update.exe.
const LOGIN_OPTS = IS_MAC ? {}
  : SQUIRREL ? { path: SQUIRREL_UPDATE, args: ['--processStart', `"${EXE_NAME}"`, '--process-start-args', '"--hidden"'] }
  : { args: ['--hidden'] };
const openedAtLogin = () => IS_MAC ? app.getLoginItemSettings().wasOpenedAtLogin : process.argv.includes('--hidden');

function squirrelEvent() {
  const cmd = SQUIRREL && process.argv.find(a => a.startsWith('--squirrel-'));
  if (!cmd || cmd === '--squirrel-firstrun') return false; // first run after install: just open the app
  const update = args => require('child_process').spawn(SQUIRREL_UPDATE, args, { detached: true }).on('close', () => app.quit());
  if (cmd === '--squirrel-install' || cmd === '--squirrel-updated') {
    update(['--createShortcut', EXE_NAME]); // Start menu + desktop, with the AppUserModelID toasts need
  } else if (cmd === '--squirrel-uninstall') {
    try { app.setLoginItemSettings({ openAtLogin: false, ...LOGIN_OPTS }); } catch { /* best effort */ }
    update(['--removeShortcut', EXE_NAME]);
  } else {
    app.quit(); // --squirrel-obsolete: an older version being replaced
  }
  return true;
}
const SQUIRREL_EVENT = squirrelEvent();

const PRIMARY = !SQUIRREL_EVENT && (IS_MAC || !BACKGROUND || app.requestSingleInstanceLock());
if (!PRIMARY) { if (!SQUIRREL_EVENT) app.quit(); }
else app.on('second-instance', () => showWindow());

// Windows only shows toasts for an app with an AppUserModelID that a Start Menu shortcut carries.
// Squirrel's shortcuts have one and Electron picks it up by itself; a build run straight from
// dist/win-unpacked gets its own shortcut here.
function ensureWinShortcut() {
  if (!IS_WIN || !BACKGROUND || SQUIRREL) return;
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
    filters: [{ name: t('Save file'), extensions: ['json'] }],
  });
  if (canceled || !filePath) return false;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  return true;
});

ipcMain.handle('import', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: t('Save file'), extensions: ['json'] }],
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

/* ---------- week card: the renderer's card HTML → a 1080×1080 PNG ----------
   Drawn in a hidden window sized so its pixels come out at 1080 on this display (the card is laid
   out at 540 CSS px and zoomed), then copied to the clipboard or saved. */
const CARD_PX = 1080;
async function renderCard(html) {
  const dpr = screen.getPrimaryDisplay().scaleFactor || 1;
  const size = Math.ceil(CARD_PX / dpr);
  const win = new BrowserWindow({
    width: size, height: size, useContentSize: true, show: false, frame: false, skipTaskbar: true,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
  });
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  try {
    await win.loadFile(path.join(__dirname, 'src', 'card.html'));
    await win.webContents.executeJavaScript(
      `document.body.innerHTML = ${JSON.stringify(String(html))}; document.body.style.zoom = ${size / 540}; document.fonts.ready.then(() => true)`);
    await new Promise(r => setTimeout(r, 120));
    let img = await win.webContents.capturePage({ x: 0, y: 0, width: size, height: size });
    const s = img.getSize();
    if (s.width !== CARD_PX || s.height !== CARD_PX) img = img.resize({ width: CARD_PX, height: CARD_PX, quality: 'best' });
    return img;
  } finally {
    win.destroy();
  }
}
// mode 'copy' → clipboard; 'save' → asks where (name = suggested file name). Resolves true when done.
ipcMain.handle('week-card', async (_e, html, mode, name) => {
  const img = await renderCard(html);
  if (mode === 'copy') {
    // Electron 44's clipboard follows the W3C API: write([ClipboardItem]) — there's no writeImage.
    await clipboard.write([new ClipboardItem({ 'image/png': new Blob([img.toPNG()], { type: 'image/png' }) })]);
    return true;
  }
  const { canceled, filePath } = await dialog.showSaveDialog(mainWin || undefined, {
    defaultPath: path.join(app.getPath('pictures'), String(name || 'phantom-life-week.png').replace(/[\\/:*?"<>|]/g, '-')),
    filters: [{ name: t('PNG image'), extensions: ['png'] }],
  });
  if (canceled || !filePath) return false;
  fs.writeFileSync(filePath, img.toPNG());
  return true;
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1120,
    minHeight: 740,
    show: !HIDDEN,
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
      backgroundThrottling: !process.env.PL_SHOT && !HIDDEN,
    },
  });
  // Zero-length (not removed) animations, so fill-forwards ones still land on their final state.
  if (HIDDEN) win.webContents.on('did-finish-load', () => win.webContents.insertCSS(
    '*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition: none !important; }'));
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
      // Fresh save: character creation shows first — capture its title screen and four steps.
      if (!process.env.PL_SEED) {
        for (const step of [0, 1, 2, 3, 4]) {
          await win.webContents.executeJavaScript(`window.__ngShot(${step})`);
          await wait(step === 0 ? 900 : 500);
          fs.writeFileSync(path.join(process.env.PL_SHOT, `newgame-${step}.png`), (await win.webContents.capturePage()).toPNG());
        }
        await win.webContents.executeJavaScript('window.__skipOnboarding()');
      }
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

/* ---------- language of the tray, notifications and dialogs ----------
   The renderer reports the interface language (see i18n.js); until it does — started at login with
   no window — the save's setting decides, or the system's for "auto". */
let uiLang = null;
function lang() {
  if (uiLang) return uiLang;
  const pref = ((readSave() || {}).settings || {}).lang;
  return pref === 'en' || pref === 'ru' ? pref : app.getLocale().toLowerCase().startsWith('ru') ? 'ru' : 'en';
}
const RU = {
  'Stop timer': 'Остановить таймер', 'Open Phantom Life': 'Открыть Phantom Life', 'Take action': 'Действовать', Quit: 'Выйти',
  ' (paused)': ' (пауза)', 'Save file': 'Файл сохранения', 'PNG image': 'Изображение PNG', Morgana: 'Моргана', 'Velvet Room': 'Бархатная комната',
};
const t = s => (lang() === 'ru' && RU[s]) || s;
ipcMain.on('lang', (_e, l) => {
  if (l === uiLang) return;
  uiLang = l === 'ru' ? 'ru' : 'en';
  refreshTray();
});

/* ---------- tray (Windows/Linux): keeps the app alive with the window closed ---------- */
let tray = null;
function createTray() {
  if (IS_MAC || !BACKGROUND || tray) return;
  tray = new Tray(ICON);
  tray.on('click', () => showWindow());
  refreshTray();
}
function refreshTray() {
  if (!tray) return;
  tray.setToolTip(timer ? `Phantom Life · ${timerText()}` : 'Phantom Life');
  tray.setContextMenu(Menu.buildFromTemplate([
    ...(timer ? [
      { label: timerText(), enabled: false },
      { label: t('Stop timer'), click: () => sendToRenderer('timer-stop') },
      { type: 'separator' },
    ] : []),
    { label: t('Open Phantom Life'), click: () => showWindow() },
    { label: t('Take action'), click: () => sendToRenderer('quick-log') },
    { type: 'separator' },
    { label: t('Quit'), click: () => app.quit() },
  ]));
}

/* ---------- focus timer: tray readout + away detection ----------
   The renderer owns the timer (it's in the save); main mirrors it so the tray can show it and so
   time away from the computer is noticed even with the window closed. */
let timer = null;        // { label, startedAt, pausedAt, pausedMs, … } as last sent by the renderer
let awaySince = null;    // when the current idle/sleep stretch began, while the timer runs
let pendingAway = null;  // an away stretch the renderer hasn't seen yet (window was closed)
const AWAY_MS = 10 * 60 * 1000;
const timerRunning = () => !!timer && !timer.pausedAt;
function timerText() {
  const end = timer.pausedAt ? Date.parse(timer.pausedAt) : Date.now();
  const min = Math.max(0, Math.floor((end - Date.parse(timer.startedAt) - (timer.pausedMs || 0)) / 60000));
  return `${timer.label} — ${Math.floor(min / 60)}:${pad(min % 60)}${timer.pausedAt ? t(' (paused)') : ''}`;
}
ipcMain.on('timer', (_e, t) => {
  const changed = JSON.stringify(t) !== JSON.stringify(timer);
  timer = t || null;
  if (!timerRunning()) awaySince = null;
  if (changed) refreshTray();
});
ipcMain.handle('pending-away', () => { const a = pendingAway; pendingAway = null; return a; });

function reportAway(from, to) {
  if (!timerRunning() || to - from < AWAY_MS) return;
  if (mainWin) { mainWin.webContents.send('timer-away', { from, to }); return; }
  pendingAway = { from, to };
  const min = Math.round((to - from) / 60000);
  notify(t('Morgana'), lang() === 'ru' ? `Таймер «${timer.label}» продолжал идти, пока тебя не было (${min} мин).`
    : `Your ${timer.label} timer kept running while you were away (${min} min).`, 'status');
}
function checkAway() {
  if (!timerRunning()) { awaySince = null; return; }
  const idleMs = powerMonitor.getSystemIdleTime() * 1000;
  if (!awaySince && idleMs >= AWAY_MS) awaySince = Date.now() - idleMs;
  else if (awaySince && idleMs < 60 * 1000) { reportAway(awaySince, Date.now() - idleMs); awaySince = null; }
}
function watchAway() {
  if (TEST) return;
  timer = (readSave() || {}).timer || null; // started at login: the window isn't there to tell us
  powerMonitor.on('suspend', () => { if (timerRunning() && !awaySince) awaySince = Date.now(); });
  powerMonitor.on('resume', () => { if (awaySince) { reportAway(awaySince, Date.now()); awaySince = null; } });
  setInterval(() => { checkAway(); refreshTray(); }, 15 * 1000);
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
  const name = (save.player && save.player.name) || 'Joker'; // the codename picked at character creation
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
    const ru = lang() === 'ru';
    return notify(t('Morgana'), left.length ? pick(ru ? [
      `Эй, ${name}! Ежедневных квестов осталось: ${left.length} — ${list}.`,
      `Не расслабляйся! Ещё не сделано: ${list}.`,
      `Мррр… день почти закончился, а в списке всё ещё: ${list}.`,
    ] : [
      `Hey ${name}! You've still got ${left.length} daily quest${left.length > 1 ? 's' : ''}: ${list}.`,
      `Don't slack off now! ${list} still need${left.length > 1 ? '' : 's'} doing.`,
      `Mrrrow… the day's almost over and ${list} ${left.length > 1 ? "aren't" : "isn't"} done.`,
    ]) : ru ? `Все ежедневные на сегодня выполнены. Неплохо, ${name}!` : `All dailies cleared today. Not bad, ${name}!`, 'quests');
  }
  if (kind === 'bed' && due(st.remindBed, st.bedAt || '23:30')) {
    fired[kind] = today;
    notify(t('Morgana'), pick(lang() === 'ru' ? [
      `Пора спать, ${name}.`,
      'Уже поздно. Давай на сегодня закончим.',
      'Тебе стоит отдохнуть. Завтра большой день.',
    ] : [
      `Let's go to sleep, ${name}.`,
      "It's getting late. Let's call it a day.",
      'You should get some rest. Big day tomorrow.',
    ]), 'status');
  }
  if (kind === 'velvet' && now.getDay() === 0 && due(st.remindVelvet, '19:00')) {
    fired[kind] = today;
    if ((save.reviews || {})[weekKey(now)]) return;
    notify(t('Velvet Room'), lang() === 'ru' ? 'Неделя подходит к концу — самое время подвести итоги и заключить контракт.'
      : 'The week is almost over — time to review it and seal your contract.', 'velvet');
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
  watchAway();
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
