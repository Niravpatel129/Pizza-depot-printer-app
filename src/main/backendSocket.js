const io = require('socket.io-client');
const https = require('https');
const http = require('http');
const { loadConfig, API_BASE_URL } = require('./config');
const { doPrint } = require('./print');
const { buildReceipt } = require('./receiptFormatter');

const MAX_RECENTLY_PRINTED = 50;
const RETRY_DELAY_MS = 15000;

let socket = null;
let printQueue = [];
let recentlyPrinted = [];
let printedOrderIds = new Set();
let isPaused = false;
let lastPrintedAt = null;
let connected = false;
let pollTimer = null;
let lastPollSince = null;
let notifyFn = null;
let retryTimer = null;
let printError = null;
let nextRetryAt = null;

function notify() {
  if (notifyFn) notifyFn({ queue: getQueue(), status: getStatus() });
}

function getQueue() {
  const pending = printQueue.map((item, i) => ({
    id: item.id ?? i,
    label: item.label ?? `Order ${i + 1}`,
    addedAt: item.addedAt,
    printed: false,
  }));
  const printed = recentlyPrinted.map((item) => ({
    id: item.id,
    label: item.label ?? `#${item.id}`,
    addedAt: item.addedAt,
    printedAt: item.printedAt,
    printed: true,
  }));
  return { pending, printed };
}

function getStatus() {
  return {
    connected,
    paused: isPaused,
    queueLength: printQueue.length,
    lastPrintedAt,
    printError: printError || null,
    retryScheduled: !!retryTimer,
    nextRetryAt: nextRetryAt || null,
  };
}

function clearRetryTimer() {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  nextRetryAt = null;
}

function setPaused(paused) {
  isPaused = !!paused;
  if (isPaused) {
    clearRetryTimer();
    printError = null;
  }
  notify();
  if (!isPaused && printQueue.length > 0) processNext();
}

function setNotify(fn) {
  notifyFn = fn;
  if (fn) fn({ queue: getQueue(), status: getStatus() });
}

function processNext() {
  if (isPaused || printQueue.length === 0) return;
  const item = printQueue[0];
  const config = loadConfig();
  const receipt = buildReceipt(item.order);
  console.log('\n' + receipt + '\n');
  const ok = doPrint(receipt, config);
  if (ok) {
    clearRetryTimer();
    printError = null;
    printQueue.shift();
    if (item.order && (item.order._id || item.order.id)) {
      printedOrderIds.add(item.order._id || item.order.id);
    }
    lastPrintedAt = new Date().toISOString();
    const printedEntry = { ...item, printedAt: lastPrintedAt };
    recentlyPrinted.push(printedEntry);
    if (recentlyPrinted.length > MAX_RECENTLY_PRINTED) {
      recentlyPrinted = recentlyPrinted.slice(-MAX_RECENTLY_PRINTED);
    }
    notify();
    if (printQueue.length > 0 && !isPaused) setImmediate(processNext);
  } else {
    printError = 'Printer unavailable';
    nextRetryAt = new Date(Date.now() + RETRY_DELAY_MS).toISOString();
    clearRetryTimer();
    retryTimer = setTimeout(() => {
      retryTimer = null;
      processNext();
    }, RETRY_DELAY_MS);
    notify();
  }
}

function addOrderToQueue(order) {
  const id = order?._id ?? order?.id ?? order?.orderId ?? String(Date.now());
  if (printedOrderIds.has(id)) return;
  const label = (order.orderNumber || order._id || order.id || `Order ${id}`).toString().slice(0, 40);
  printQueue.push({ id, order, addedAt: new Date().toISOString(), label });
  notify();
  if (!isPaused) processNext();
}

function reprintOrder(order) {
  if (!order || typeof order !== 'object') return;
  const id = order._id ?? order.id ?? order.orderId;
  if (id) printedOrderIds.delete(id);
  addOrderToQueue(order);
}

function onOrderNew(order) {
  addOrderToQueue(order);
}

function onOrderPrint(order) {
  addOrderToQueue(order);
}

function onOrderUpdated(order) {
  console.log('Order updated:', order?._id || order?.orderNumber);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function getOrderList(opts = {}) {
  const config = loadConfig();
  const base = (API_BASE_URL || '').replace(/\/$/, '');
  const secret = config.kitchenSecret || '';
  if (!base || !secret) {
    console.log('GET /api/kitchen/orders skipped (no kitchen secret or API base)');
    return Promise.resolve({ orders: [] });
  }
  const params = new URLSearchParams({ secret, limit: String(opts.limit || 50) });
  if (opts.since) params.set('since', opts.since);
  if (opts.status) params.set('status', opts.status);
  const pathStr = `/api/kitchen/orders?${params.toString()}`;
  const fullUrl = new URL(pathStr, base);
  console.log('GET /api/kitchen/orders requesting', fullUrl.origin + fullUrl.pathname);
  return new Promise((resolve, reject) => {
    const protocol = fullUrl.protocol === 'https:' ? https : http;
    const req = protocol.get(fullUrl.toString(), (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data || '{}');
          const orders = json.orders || [];
          console.log('Order list response:', orders.length, 'orders');
          resolve({ orders });
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function fetchKitchenOrders(cb) {
  const config = loadConfig();
  const base = (API_BASE_URL || '').replace(/\/$/, '');
  const secret = config.kitchenSecret || '';
  if (!base || !secret) return cb(null, []);
  const since = lastPollSince ? `&since=${encodeURIComponent(lastPollSince)}` : '';
  const pathStr = `/api/kitchen/orders?secret=${encodeURIComponent(secret)}&limit=50${since}`;
  const url = new URL(pathStr, base);
  const protocol = url.protocol === 'https:' ? https : http;
  const req = protocol.get(url.toString(), (res) => {
    let data = '';
    res.on('data', (chunk) => (data += chunk));
    res.on('end', () => {
      try {
        const json = JSON.parse(data || '{}');
        const orders = json.orders || [];
        let maxUpdated = lastPollSince;
        orders.forEach((o) => {
          const u = o.updatedAt || o.createdAt;
          if (u && (!maxUpdated || u > maxUpdated)) maxUpdated = u;
          addOrderToQueue(o);
        });
        if (maxUpdated) lastPollSince = maxUpdated;
        cb(null, orders);
      } catch (e) {
        cb(e, []);
      }
    });
  });
  req.on('error', cb);
  req.setTimeout(15000, () => { req.destroy(); cb(new Error('timeout'), []); });
}

function startPolling() {
  stopPolling();
  const config = loadConfig();
  const interval = Math.max(5000, config.pollIntervalMs || 10000);
  fetchKitchenOrders(() => {});
  pollTimer = setInterval(() => fetchKitchenOrders(() => {}), interval);
  console.log('Kitchen polling started (interval %d ms)', interval);
}

function connect() {
  const config = loadConfig();
  const url = (API_BASE_URL || '').replace(/\/$/, '');
  const secret = config.kitchenSecret || '';
  stopPolling();
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  connected = false;
  notify();
  if (!secret) {
    console.log('Socket skipped: kitchen secret required');
    return;
  }
  socket = io(url, {
    auth: { secret },
    query: { secret },
    transports: ['websocket', 'polling'],
    reconnection: true,
  });
  socket.on('order:new', onOrderNew);
  socket.on('order:print', onOrderPrint);
  socket.on('order:updated', onOrderUpdated);
  socket.on('connect', () => {
    connected = true;
    stopPolling();
    lastPollSince = null;
    console.log('Printer agent connected to backend');
    notify();
  });
  socket.on('disconnect', () => {
    connected = false;
    notify();
    startPolling();
  });
  socket.on('connect_error', (e) => {
    connected = false;
    notify();
    if (e.message) console.error('Backend socket error:', e.message);
    startPolling();
  });
}

function disconnect() {
  stopPolling();
  clearRetryTimer();
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  connected = false;
  notify();
}

module.exports = { connect, disconnect, getQueue, getStatus, setPaused, setNotify, getOrderList, reprintOrder };
