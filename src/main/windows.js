const path = require('path');
const { BrowserWindow } = require('electron');
const { loadConfig } = require('./config');
const backendSocket = require('./backendSocket');
const logger = require('./logger');

let settingsWindow = null;
let isQuitting = false;

function getPreloadPath() {
  if (typeof MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY !== 'undefined' && MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY) {
    const p = MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY;
    return path.isAbsolute(p) ? p : path.resolve(__dirname, p);
  }
  return path.resolve(__dirname, '..', 'renderer', 'main_window', 'preload.js');
}

function getWindowUrl() {
  if (typeof MAIN_WINDOW_WEBPACK_ENTRY !== 'undefined' && MAIN_WINDOW_WEBPACK_ENTRY) {
    return MAIN_WINDOW_WEBPACK_ENTRY;
  }
  return path.join('file://', __dirname, '..', 'renderer', 'main_window', 'index.html');
}

function openSettings(refreshMenu) {
  if (settingsWindow) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }
  const config = loadConfig();
  settingsWindow = new BrowserWindow({
    width: 880,
    height: 780,
    minWidth: 640,
    minHeight: 520,
    show: false,
    title: 'Settings',
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  settingsWindow.setMenuBarVisibility(false);
  settingsWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      settingsWindow.minimize();
      if (refreshMenu) refreshMenu();
    }
  });
  settingsWindow.on('closed', () => {
    backendSocket.setNotify(null);
    logger.setWebContents(null);
    settingsWindow = null;
    if (refreshMenu) refreshMenu();
  });
  settingsWindow.loadURL(getWindowUrl());
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
    console.log('Settings window opened — logs appear in Debug logs and in this terminal.');
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

function sendToSettings(channel, payload) {
  if (settingsWindow && !settingsWindow.isDestroyed() && settingsWindow.webContents) {
    settingsWindow.webContents.send(channel, payload);
  }
}

function prepareForQuit() {
  isQuitting = true;
}

module.exports = { openSettings, closeSettings, sendToSettings, prepareForQuit };
