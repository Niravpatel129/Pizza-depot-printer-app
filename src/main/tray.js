const { Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { app } = require('electron');
const { loadConfig } = require('./config');

let tray = null;

function getTrayIcon() {
  const templateName = process.platform === 'darwin' ? 'trayIconTemplate.png' : 'tray-icon.png';
  const iconPath = path.join(app.getAppPath(), 'src', 'assets', templateName);
  let img = nativeImage.createFromPath(iconPath);
  if (!img || img.isEmpty()) {
    img = nativeImage.createFromBuffer(Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAOklEQVQ4T2NkYGD4z0ABYBw1gGE0DBhGwwAGBgYGBgYGRtWA/wwMDP8ZGBj+MzAw/GdgYPjPwMAAANJ8A0s+Wl2lAAAAAElFTkSuQmCC',
      'base64'
    ));
  }
  img = img.resize({ width: 16, height: 16 });
  if (process.platform === 'darwin') {
    img.setTemplateImage(true);
  }
  return img;
}

function buildTrayMenu(openSettings, onRestart) {
  const config = loadConfig();
  const printerLabel = config.printer || '(default)';
  const hasCreds = !!config.kitchenSecret;
  return Menu.buildFromTemplate([
    { label: `Printer: ${printerLabel}`, enabled: false },
    { label: hasCreds ? 'Connected' : 'Set kitchen secret in Settings', enabled: false },
    { type: 'separator' },
    { label: 'Settings', click: () => openSettings() },
    { label: 'Restart server', click: () => onRestart && onRestart() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
}

function initTray(openSettings, createServer) {
  tray = new Tray(getTrayIcon());
  tray.setToolTip('Printer Agent');
  const refreshMenu = () => tray.setContextMenu(buildTrayMenu(openSettings, () => { createServer(); refreshMenu(); }));
  refreshMenu();
  return { setContextMenu: (menu) => tray.setContextMenu(menu), refreshMenu };
}

module.exports = { getTrayIcon, buildTrayMenu, initTray };