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
