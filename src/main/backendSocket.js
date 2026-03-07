const io = require('socket.io-client');
const { loadConfig } = require('./config');
const { doPrint } = require('./print');

const DEFAULT_BACKEND_URL = 'https://pizza-depot-backend-91ae077a284d.herokuapp.com';

let socket = null;
let printQueue = [];
let isPaused = false;
let lastPrintedAt = null;
let connected = false;
let notifyFn = null;

function orderToLines(order) {
  if (!order) return ['(no content)'];
  if (order.lines && order.lines.length) return order.lines;
  if (order.receipt_lines && order.receipt_lines.length) return order.receipt_lines;
  if (order.receiptLines && order.receiptLines.length) return order.receiptLines;
  if (order.text) return order.text.split('\n');
  const lines = [];
  if (order.id) lines.push(`Order #${order.id}`);
  if (order.orderId) lines.push(`Order #${order.orderId}`);
  if (order.items && order.items.length) {
    order.items.forEach((i) => {
      const name = i.name || i.title || '';
      const qty = i.quantity ?? i.qty ?? 1;
      const price = i.price ?? i.total ?? '';
      lines.push(`${qty}x ${name}${price ? `  $${price}` : ''}`);
    });
  }
  if (order.subtotal != null) lines.push(`Subtotal  $${order.subtotal}`);
  if (order.total != null) lines.push(`Total  $${order.total}`);
  if (lines.length) return lines;
  return ['(no content)'];
}

function buildReceipt(lines) {
  return [
    '--------------------------------',
    ...lines,
    '--------------------------------',
    `Printed at ${new Date().toISOString()}`,
  ].join('\n');
}

function notify() {
  if (notifyFn) notifyFn({ queue: getQueue(), status: getStatus() });
}

function getQueue() {
  return printQueue.map((item, i) => ({
    id: item.id ?? i,
    label: item.label ?? `Order ${i + 1}`,
    addedAt: item.addedAt,
  }));
}

function getStatus() {
  return {
    connected,
    paused: isPaused,
    queueLength: printQueue.length,
    lastPrintedAt,
  };
}

function setPaused(paused) {
  isPaused = !!paused;
  notify();
  if (!isPaused && printQueue.length > 0) processNext();
}

function setNotify(fn) {
  notifyFn = fn;
  if (fn) fn({ queue: getQueue(), status: getStatus() });
}

function processNext() {
  if (isPaused || printQueue.length === 0) return;
  const item = printQueue.shift();
  notify();
  const config = loadConfig();
  const lines = orderToLines(item.order);
  const receipt = buildReceipt(lines);
  console.log('\n' + receipt + '\n');
  doPrint(receipt, config);
  lastPrintedAt = new Date().toISOString();
  notify();
  if (printQueue.length > 0 && !isPaused) setImmediate(processNext);
}

function onOrderPrint(order) {
  const id = order?.id ?? order?.orderId ?? order?._id ?? Date.now();
  const lines = orderToLines(order);
  const label = (lines[0] || `Order ${id}`).slice(0, 40);
  printQueue.push({ id, order, addedAt: new Date().toISOString(), label });
  notify();
  if (!isPaused) processNext();
}

function connect() {
  const config = loadConfig();
  const url = (config.backendUrl || DEFAULT_BACKEND_URL).replace(/\/$/, '');
  if (!url) return;
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  connected = false;
  notify();
  socket = io(url, { transports: ['websocket', 'polling'], reconnection: true });
  socket.on('order:print', onOrderPrint);
  socket.on('connect', () => {
    connected = true;
    console.log('Printer agent connected to backend');
    notify();
  });
  socket.on('disconnect', () => {
    connected = false;
    notify();
  });
  socket.on('connect_error', (e) => {
    connected = false;
    notify();
    if (e.message) console.error('Backend socket error:', e.message);
  });
}

function disconnect() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  connected = false;
  notify();
}

module.exports = { connect, disconnect, getQueue, getStatus, setPaused, setNotify };
