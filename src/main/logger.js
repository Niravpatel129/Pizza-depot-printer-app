const MAX_ENTRIES = 300;
const buffer = [];
let webContents = null;

function formatMessage(args) {
  return args.map((a) => {
    if (typeof a === 'object' && a !== null) {
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    }
    return String(a);
  }).join(' ');
}

function log(level, ...args) {
  const message = formatMessage(args);
  const time = new Date().toISOString();
  const entry = { level, time, message };
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) buffer.shift();
  if (webContents && !webContents.isDestroyed()) {
    webContents.send('log', entry);
  }
}

function getHistory() {
  return buffer.slice();
}

function setWebContents(wc) {
  webContents = wc;
  if (wc && !wc.isDestroyed()) {
    wc.send('log-history', getHistory());
  }
}

module.exports = { log, getHistory, setWebContents };
