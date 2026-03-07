const https = require('https');
const http = require('http');
const { loadConfig, API_BASE_URL } = require('./config');
const { printJob } = require('./print');

const MAX_RECENTLY_PRINTED = 50;
const RETRY_DELAY_MS = 15000;

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
let connectionError = null;
let lastPolledAt = null;

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
    lastPolledAt: lastPolledAt || null,
    printError: printError || null,
    connectionError: connectionError || null,
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

function retryPrintNow() {
  clearRetryTimer();
  if (printQueue.length > 0 && !isPaused) {
    printError = null;
    notify();
    setImmediate(processNext);
  }
}

function setNotify(fn) {
  notifyFn = fn;
  if (fn) fn({ queue: getQueue(), status: getStatus() });
}

async function processNext() {
  if (isPaused || printQueue.length === 0) return;
  const item = printQueue[0];
  const config = loadConfig();
  const job = { ...item.order, _queueId: item.id };
  const result = await printJob(job, config);
  const ok = result && result.ok === true;
  if (ok) {
    clearRetryTimer();
    printError = null;
    printQueue.shift();
    const printedId = item.id ?? normalizeOrderId(item.order);
    if (printedId) {
      printedOrderIds.add(printedId);
      markOrderPrinted(printedId).catch((e) => console.error('Mark printed failed:', e.message));
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
    const errMsg = (result && result.error) ? result.error : 'Printer unavailable';
    printError = errMsg;
    console.error('Print failed:', errMsg);
    nextRetryAt = new Date(Date.now() + RETRY_DELAY_MS).toISOString();
    clearRetryTimer();
    retryTimer = setTimeout(() => {
      retryTimer = null;
      processNext();
    }, RETRY_DELAY_MS);
    notify();
  }
}

function normalizeOrderId(order) {
  const id = order?._id ?? order?.id ?? order?.orderId;
  return id != null ? String(id) : null;
}

function markOrderPrinted(orderId) {
  const config = loadConfig();
  const base = (API_BASE_URL || '').replace(/\/$/, '');
  const secret = config.kitchenSecret || '';
  if (!base || !secret || !orderId) return Promise.resolve();
  const pathStr = `/api/kitchen/orders/${encodeURIComponent(orderId)}?secret=${encodeURIComponent(secret)}`;
  const url = new URL(pathStr, base);
  const protocol = url.protocol === 'https:' ? https : http;
  const body = JSON.stringify({ printed: true });
  return new Promise((resolve, reject) => {
    const req = protocol.request(url.toString(), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      res.on('data', () => {});
      res.on('end', () => resolve());
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

function addOrderToQueue(order) {
  const id = normalizeOrderId(order) ?? String(Date.now());
  if (printedOrderIds.has(id)) return;
  const alreadyQueued = printQueue.some((item) => String(item.id) === String(id));
  if (alreadyQueued) return;
  const label = (order.orderNumber || order._id || order.id || `Order ${id}`).toString().slice(0, 40);
  printQueue.push({ id, order, addedAt: new Date().toISOString(), label });
  notify();
  if (!isPaused) processNext();
}

function reprintOrder(order) {
  if (!order || typeof order !== 'object') return;
  const id = normalizeOrderId(order);
  if (id) printedOrderIds.delete(id);
  addOrderToQueue(order);
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
  return new Promise((resolve, reject) => {
    const protocol = fullUrl.protocol === 'https:' ? https : http;
    const req = protocol.get(fullUrl.toString(), (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data || '{}');
          const orders = json.orders || [];
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

function fetchKitchenOrders() {
  const config = loadConfig();
  const base = (API_BASE_URL || '').replace(/\/$/, '');
  const secret = config.kitchenSecret || '';
  if (!base || !secret) return;
  const since = lastPollSince ? `&since=${encodeURIComponent(lastPollSince)}` : '';
  const pathStr = `/api/kitchen/orders?secret=${encodeURIComponent(secret)}&limit=50${since}`;
  const url = new URL(pathStr, base);
  const protocol = url.protocol === 'https:' ? https : http;
  const wasFirstPoll = lastPollSince == null;
  const req = protocol.get(url.toString(), (res) => {
    let data = '';
    res.on('data', (chunk) => (data += chunk));
    res.on('end', () => {
      try {
        connectionError = null;
        lastPolledAt = new Date().toISOString();
        const json = JSON.parse(data || '{}');
        const orders = json.orders || [];
        let maxUpdated = lastPollSince;
        orders.forEach((o) => {
          const u = o.updatedAt || o.createdAt;
          if (u && (!maxUpdated || u > maxUpdated)) maxUpdated = u;
          if (wasFirstPoll) {
            const id = normalizeOrderId(o);
            if (id) printedOrderIds.add(id);
          } else {
            addOrderToQueue(o);
          }
        });
        if (maxUpdated) lastPollSince = maxUpdated;
        notify();
      } catch (e) {
        connectionError = e?.message || 'Parse error';
        notify();
      }
    });
  });
  req.on('error', (e) => {
    connectionError = e?.message || 'Request failed';
    notify();
  });
  req.setTimeout(15000, () => {
    req.destroy();
    connectionError = 'timeout';
    notify();
  });
}

function startPolling() {
  stopPolling();
  const config = loadConfig();
  const interval = Math.max(5000, config.pollIntervalMs || 10000);
  fetchKitchenOrders();
  pollTimer = setInterval(fetchKitchenOrders, interval);
  console.log('Kitchen polling started (interval %d ms)', interval);
}

function connect() {
  const config = loadConfig();
  const secret = config.kitchenSecret || '';
  stopPolling();
  connected = false;
  connectionError = null;
  notify();
  if (!secret) {
    console.log('Polling skipped: kitchen secret required');
    return;
  }
  connected = true;
  lastPollSince = null;
  startPolling();
  notify();
}

function disconnect() {
  stopPolling();
  clearRetryTimer();
  connected = false;
  connectionError = null;
  notify();
}

module.exports = { connect, disconnect, getQueue, getStatus, setPaused, setNotify, getOrderList, reprintOrder, retryPrintNow };
