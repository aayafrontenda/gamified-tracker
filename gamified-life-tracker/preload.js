const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  platform: process.platform,
  load: () => ipcRenderer.invoke('load'),
  save: data => ipcRenderer.invoke('save', data),
  saveSync: data => ipcRenderer.sendSync('save-sync', data),
  exportSave: data => ipcRenderer.invoke('export', data),
  importSave: () => ipcRenderer.invoke('import'),
  revealSave: () => ipcRenderer.invoke('reveal-save'),
  savePath: () => ipcRenderer.invoke('save-path'),
  setHotkey: on => ipcRenderer.invoke('set-hotkey', on),
  setLogin: on => ipcRenderer.invoke('set-login', on),
  testNotify: () => ipcRenderer.invoke('test-notify'),
  onQuickLog: cb => ipcRenderer.on('quick-log', () => cb()),
  onGo: cb => ipcRenderer.on('go', (_e, screen) => cb(screen)),
  onMorgana: cb => ipcRenderer.on('morgana', (_e, msg) => cb(msg)),
  timerChanged: timer => ipcRenderer.send('timer', timer),
  weekCard: (html, mode, name) => ipcRenderer.invoke('week-card', html, mode, name),
  pendingAway: () => ipcRenderer.invoke('pending-away'),
  onTimerStop: cb => ipcRenderer.on('timer-stop', () => cb()),
  onTimerAway: cb => ipcRenderer.on('timer-away', (_e, away) => cb(away)),
});
