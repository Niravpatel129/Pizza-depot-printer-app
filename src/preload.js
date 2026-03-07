const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('printerAgent', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.send('save-config', config),
  onConfig: (fn) => {
    ipcRenderer.on('config', (_, data) => fn(data));
  },
});
