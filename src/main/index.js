const { app, ipcMain, dialog } = require('electron');
const config = require('./config');
const server = require('./server');
const tray = require('./tray');
const windows = require('./windows');

if (require('electron-squirrel-startup')) {
  app.quit();
}

let trayApi = null;

ipcMain.on('save-config', (_, savedConfig) => {
  config.saveConfig(savedConfig);
  windows.closeSettings();
  if (trayApi) trayApi.refreshMenu();
});

ipcMain.handle('get-config', () => config.loadConfig());

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    app.dock?.hide();
  }
  server.createServer(dialog);
  const openSettings = () => windows.openSettings(() => trayApi && trayApi.refreshMenu());
  trayApi = tray.initTray(openSettings, () => server.createServer(dialog));
});

app.on('window-all-closed', () => {});

app.on('before-quit', () => {
  server.closeServer();
});
