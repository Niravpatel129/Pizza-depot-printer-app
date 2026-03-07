const { BrowserWindow } = require('electron');
const { loadConfig } = require('./config');
const backendSocket = require('./backendSocket');
const logger = require('./logger');

let settingsWindow = null;

function openSettings(refreshMenu) {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }
  const config = loadConfig();
  settingsWindow = new BrowserWindow({
    width: 400,
    height: 640,
    minWidth: 360,
    minHeight: 420,
    show: false,
    title: 'Settings',
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });
  settingsWindow.setMenuBarVisibility(false);
  settingsWindow.on('closed', () => {
    backendSocket.setNotify(null);
    logger.setWebContents(null);
    settingsWindow = null;
    if (refreshMenu) refreshMenu();
  });
  settingsWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  settingsWindow.on('ready-to-show', async () => {
    let printers = [];
    try {
      printers = await settingsWindow.webContents.getPrintersAsync();
    } catch (e) {
      console.error('getPrintersAsync failed:', e);
    }
    backendSocket.setNotify((data) => {
      if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.webContents.send('print-queue-update', data);
      }
    });
    logger.setWebContents(settingsWindow.webContents);
    settingsWindow.show();
    settingsWindow.webContents.send('config', { config, printers });
  });
}

function closeSettings() {
  if (settingsWindow) {
    settingsWindow.close();
    settingsWindow = null;
  }
}

module.exports = { openSettings, closeSettings };
