const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

app.setName('Phantom Life');
// Dev/testing hook: point the save at a throwaway folder.
if (process.env.PL_USERDATA) app.setPath('userData', process.env.PL_USERDATA);

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
ipcMain.handle('save-path', () => savePath());

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1120,
    minHeight: 740,
    backgroundColor: '#0b0b0b',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Dev/testing hook: PL_SHOT=<dir> captures every screen to PNGs and quits.
  if (process.env.PL_SHOT) {
    win.webContents.once('did-finish-load', async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      await wait(800);
      if (process.env.PL_SEED) await win.webContents.executeJavaScript('window.__seedDemo && window.__seedDemo()');
      for (const id of ['status', 'skills', 'quests', 'confidants', 'journal', 'system']) {
        await win.webContents.executeJavaScript(`go(${JSON.stringify(id)})`);
        await wait(700);
        const img = await win.webContents.capturePage();
        fs.writeFileSync(path.join(process.env.PL_SHOT, `${id}.png`), img.toPNG());
      }
      await win.webContents.executeJavaScript('window.__demoRankUp && window.__demoRankUp()');
      await wait(900);
      fs.writeFileSync(path.join(process.env.PL_SHOT, 'rankup.png'), (await win.webContents.capturePage()).toPNG());
      await win.webContents.executeJavaScript('closeRankUp(); openQuickLog()');
      await wait(500);
      fs.writeFileSync(path.join(process.env.PL_SHOT, 'quicklog.png'), (await win.webContents.capturePage()).toPNG());
      app.quit();
    });
  }
}

app.whenReady().then(() => {
  dailyBackup();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
