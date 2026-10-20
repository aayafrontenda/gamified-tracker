const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  load: () => ipcRenderer.invoke('load'),
  save: data => ipcRenderer.invoke('save', data),
  saveSync: data => ipcRenderer.sendSync('save-sync', data),
  exportSave: data => ipcRenderer.invoke('export', data),
  importSave: () => ipcRenderer.invoke('import'),
  revealSave: () => ipcRenderer.invoke('reveal-save'),
  savePath: () => ipcRenderer.invoke('save-path'),
});
