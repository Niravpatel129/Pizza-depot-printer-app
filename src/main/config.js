const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

const API_BASE_URL = 'https://pizza-depot-backend-91ae077a284d.herokuapp.com';

const DEFAULTS = {
  printer: '',
  receiptWidth: 42,
  printBarcode: true,
  kitchenSecret: '',
  pollIntervalMs: 10000,
  port: 3847,
};

function loadConfig() {
  try {
    const c = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    return { ...DEFAULTS, ...c };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveConfig(config) {
  const existing = loadConfig();
  const merged = { ...existing, ...config };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2));
}

module.exports = { loadConfig, saveConfig, CONFIG_PATH, API_BASE_URL };
