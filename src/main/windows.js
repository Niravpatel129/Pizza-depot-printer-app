const { BrowserWindow } = require('electron');
const { loadConfig } = require('./config');

let settingsWindow = null;

function openSettings(refreshMenu) {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }
  const config = loadConfig();
  settingsWindow = new BrowserWindow({
    width: 440,
    height: 200,
    show: false,
    title: 'Printer Agent',
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });
  settingsWindow.setMenuBarVisibility(false);
  settingsWindow.on('closed', () => {
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
