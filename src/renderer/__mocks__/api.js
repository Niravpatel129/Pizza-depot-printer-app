module.exports = {
  getConfig: () => Promise.resolve({}),
  saveConfig: () => {},
  onConfig: () => {},
  getPrintQueue: () => Promise.resolve([]),
  getStatus: () => Promise.resolve({}),
  getOrderList: () => Promise.resolve({ orders: [] }),
  setPaused: () => {},
  onPrintQueueUpdate: () => {},
  getLogHistory: () => Promise.resolve([]),
  onLog: () => {},
  onLogHistory: () => {},
};
