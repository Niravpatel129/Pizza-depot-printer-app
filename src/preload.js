const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('printerAgent', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.send('save-config', config),
  onConfig: (fn) => {
    ipcRenderer.on('config', (_, data) => fn(data));
  },
  getPrintQueue: () => ipcRenderer.invoke('get-print-queue'),
  getStatus: () => ipcRenderer.invoke('get-status'),
  setPaused: (paused) => ipcRenderer.send('set-paused', paused),
  onPrintQueueUpdate: (fn) => {
    ipcRenderer.on('print-queue-update', (_, data) => fn(data));
  },
  onLog: (fn) => { ipcRenderer.on('log', (_, entry) => fn(entry)); },
  onLogHistory: (fn) => { ipcRenderer.on('log-history', (_, entries) => fn(entries)); },
});
