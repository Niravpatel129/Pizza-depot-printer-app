const { app, ipcMain, dialog, powerSaveBlocker } = require('electron');
const config = require('./config');
const server = require('./server');
const tray = require('./tray');
const windows = require('./windows');
const backendSocket = require('./backendSocket');
const logger = require('./logger');
const { initAutoUpdater } = require('./updater');

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

app.setAppUserModelId('PrinterAgent');

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at', promise, 'reason:', reason);
});

let trayApi = null;
let powerSaveId = null;

ipcMain.on('save-config', (_, savedConfig) => {
  config.saveConfig(savedConfig);
  server.createServer(dialog);
  backendSocket.connect();
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
ipcMain.handle('retry-print', () => {
  backendSocket.retryPrintNow();
  return Promise.resolve();
});
ipcMain.handle('reprint-order', (_, order) => {
  try {
    if (!order || (typeof order !== 'object' && typeof order !== 'function')) {
      return Promise.reject(new Error('Invalid order'));
    }
    backendSocket.reprintOrder(order);
    return Promise.resolve();
  } catch (err) {
    console.error('reprint-order error', err);
    return Promise.reject(err);
  }
});

const { buildReceipt } = require('./receiptFormatter');
ipcMain.handle('get-receipt-preview', (_, order) => {
  try {
    if (!order || typeof order !== 'object') return '';
    const cfg = config.loadConfig();
    return buildReceipt(order, cfg);
  } catch (err) {
    console.error('get-receipt-preview error', err);
    return '';
  }
});

app.whenReady().then(() => {
  powerSaveId = powerSaveBlocker.start('prevent-app-suspension');
  server.createServer(dialog);
  backendSocket.connect();
  initAutoUpdater(ipcMain, (channel, payload) => windows.sendToSettings(channel, payload));
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
  if (powerSaveId != null) powerSaveBlocker.stop(powerSaveId);
  windows.prepareForQuit();
  backendSocket.disconnect();
  server.closeServer();
});
