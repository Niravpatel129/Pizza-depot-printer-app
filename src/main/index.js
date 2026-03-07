const { app, ipcMain, dialog } = require('electron');
const config = require('./config');
const server = require('./server');
const tray = require('./tray');
const windows = require('./windows');
const backendSocket = require('./backendSocket');
const logger = require('./logger');

const _log = console.log.bind(console);
const _error = console.error.bind(console);
const _warn = console.warn.bind(console);
function patchLog(level) {
  const original = level === 'log' ? _log : level === 'error' ? _error : _warn;
  return (...args) => {
    original(...args);
    logger.log(level, ...args);
  };
}
console.log = patchLog('log');
console.error = patchLog('error');
console.warn = patchLog('warn');

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
ipcMain.handle('get-order-list', async (_, opts) => {
  try {
    console.log('get-order-list requested (Refresh clicked)');
    return await backendSocket.getOrderList(opts || {});
  } catch (err) {
    console.error('get-order-list error', err);
    return { orders: [] };
  }
});
ipcMain.handle('get-log-history', () => {
  try {
    return logger.getHistory();
  } catch (err) {
    console.error('get-log-history error', err);
    return [];
  }
});
ipcMain.on('set-paused', (_, paused) => backendSocket.setPaused(paused));
ipcMain.handle('reprint-order', (_, order) => {
  try {
    backendSocket.reprintOrder(order);
    return Promise.resolve();
  } catch (err) {
    console.error('reprint-order error', err);
    return Promise.reject(err);
  }
});

app.whenReady().then(() => {
  server.createServer(dialog);
  backendSocket.connect();
  const openSettings = () => windows.openSettings(() => trayApi && trayApi.refreshMenu());
  const refreshOrderList = () => {
    console.log('Order list refresh triggered from tray');
    backendSocket.getOrderList({ limit: 50 }).catch((err) => console.error('Order list refresh failed', err));
  };
  trayApi = tray.initTray(openSettings, () => server.createServer(dialog), refreshOrderList);
  openSettings();
});

app.on('window-all-closed', () => {});

app.on('before-quit', () => {
  backendSocket.disconnect();
  server.closeServer();
});
