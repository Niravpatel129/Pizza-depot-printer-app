export function getConfig() {
  return typeof window.printerAgent !== 'undefined' ? window.printerAgent.getConfig() : Promise.resolve({});
}

export function saveConfig(config) {
  if (typeof window.printerAgent !== 'undefined') {
    window.printerAgent.saveConfig(config);
  }
}

export function onConfig(fn) {
  if (typeof window.printerAgent !== 'undefined') {
    window.printerAgent.onConfig(fn);
  }
}

export function getPrintQueue() {
  return typeof window.printerAgent !== 'undefined' ? window.printerAgent.getPrintQueue() : Promise.resolve([]);
}

export function getStatus() {
  return typeof window.printerAgent !== 'undefined' ? window.printerAgent.getStatus() : Promise.resolve({});
}

export function getOrderList(opts) {
  return typeof window.printerAgent !== 'undefined' ? window.printerAgent.getOrderList(opts) : Promise.resolve({ orders: [] });
}

export function reprintOrder(order) {
  return typeof window.printerAgent !== 'undefined' ? window.printerAgent.reprintOrder(order) : Promise.resolve();
}

export function setPaused(paused) {
  if (typeof window.printerAgent !== 'undefined') {
    window.printerAgent.setPaused(paused);
  }
}

export function onPrintQueueUpdate(fn) {
  if (typeof window.printerAgent !== 'undefined') {
    window.printerAgent.onPrintQueueUpdate(fn);
  }
}

export function onLog(fn) {
  if (typeof window.printerAgent !== 'undefined') {
    window.printerAgent.onLog(fn);
  }
}

export function getLogHistory() {
  return typeof window.printerAgent !== 'undefined' ? window.printerAgent.getLogHistory() : Promise.resolve([]);
}

export function onLogHistory(fn) {
  if (typeof window.printerAgent !== 'undefined') {
    window.printerAgent.onLogHistory(fn);
  }
}

export function getAppVersion() {
  return typeof window.printerAgent !== 'undefined' ? window.printerAgent.getAppVersion() : Promise.resolve('0.0.0');
}

export function checkForUpdates() {
  return typeof window.printerAgent !== 'undefined' ? window.printerAgent.checkForUpdates() : Promise.resolve({});
}

export function downloadUpdate() {
  return typeof window.printerAgent !== 'undefined' ? window.printerAgent.downloadUpdate() : Promise.resolve({});
}

export function quitAndInstall() {
  if (typeof window.printerAgent !== 'undefined') {
    window.printerAgent.quitAndInstall();
  }
}

export function onUpdateStatus(fn) {
  if (typeof window.printerAgent !== 'undefined') {
    window.printerAgent.onUpdateStatus(fn);
  }
}
