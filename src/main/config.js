const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

const DEFAULT_BACKEND_URL = 'https://pizza-depot-backend-91ae077a284d.herokuapp.com';

function loadConfig() {
  try {
    const c = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    return { printer: '', backendUrl: DEFAULT_BACKEND_URL, port: 3847, ...c };
  } catch {
    return { printer: '', backendUrl: DEFAULT_BACKEND_URL, port: 3847 };
  }
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

module.exports = { loadConfig, saveConfig, CONFIG_PATH };
