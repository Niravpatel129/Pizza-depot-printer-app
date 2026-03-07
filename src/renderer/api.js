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
