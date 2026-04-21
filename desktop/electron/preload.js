const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('trovanDesktop', {
  onStartupError: (cb) => ipcRenderer.on('startup-error', (_event, payload) => cb(payload)),
});
