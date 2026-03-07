const { app, ipcMain, dialog } = require('electron');
const config = require('./config');
const server = require('./server');
const tray = require('./tray');
const windows = require('./windows');
const backendSocket = require('./backendSocket');
const logger = require('./logger');

const _log = console.log;
const _error = console.error;
const _warn = console.warn;
console.log = (...args) => { _log.apply(console, args); logger.log('log', ...args); };
console.error = (...args) => { _error.apply(console, args); logger.log('error', ...args); };
console.warn = (...args) => { _warn.apply(console, args); logger.log('warn', ...args); };

if (require('electron-squirrel-startup')) {
  app.quit();
}

let trayApi = null;

ipcMain.on('save-config', (_, savedConfig) => {
  config.saveConfig(savedConfig);
  server.createServer(dialog);
  backendSocket.connect();
  windows.closeSettings();
  if (trayApi) trayApi.refreshMenu();
});

ipcMain.handle('get-config', () => config.loadConfig());
ipcMain.handle('get-print-queue', () => backendSocket.getQueue());
ipcMain.handle('get-status', () => backendSocket.getStatus());
ipcMain.on('set-paused', (_, paused) => backendSocket.setPaused(paused));

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    app.dock?.hide();
  }
  server.createServer(dialog);
  backendSocket.connect();
  const openSettings = () => windows.openSettings(() => trayApi && trayApi.refreshMenu());
  trayApi = tray.initTray(openSettings, () => server.createServer(dialog));
});

app.on('window-all-closed', () => {});

app.on('before-quit', () => {
  backendSocket.disconnect();
  server.closeServer();
});
