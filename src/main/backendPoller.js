const https = require('https');
const { loadConfig } = require('./config');
const { doPrint } = require('./print');

const DEFAULT_BACKEND_URL = 'https://pizza-depot-backend-91ae077a284d.herokuapp.com';
const POLL_INTERVAL_MS = 5000;
const FETCH_PATH = '/api/print-queue';

let pollTimer = null;

function fetchPrintQueue(url) {
  const u = new URL(FETCH_PATH, url || DEFAULT_BACKEND_URL);
  return new Promise((resolve, reject) => {
    const req = https.get(u.toString(), (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data || '{}'));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function markPrinted(url, jobId) {
  const base = url || DEFAULT_BACKEND_URL;
  const u = new URL(`${FETCH_PATH}/${jobId}`, base);
  const body = JSON.stringify({ printed: true });
  return new Promise((resolve, reject) => {
    const req = https.request(u.toString(), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve());
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function buildReceipt(lines) {
  return [
    '--------------------------------',
    ...(lines && lines.length ? lines : ['(no content)']),
    '--------------------------------',
    `Printed at ${new Date().toISOString()}`,
  ].join('\n');
}

function poll() {
  const config = loadConfig();
  const url = (config.backendUrl || DEFAULT_BACKEND_URL).replace(/\/$/, '');
  if (!url) return;
  fetchPrintQueue(url).then((data) => {
    const jobs = data.jobs || data.orders || data.items || Array.isArray(data) ? (data.jobs || data.orders || data.items || data) : [];
    jobs.forEach((job) => {
      const id = job.id || job.orderId || job._id;
      const lines = job.lines || job.receipt_lines || job.receiptLines || (job.text ? job.text.split('\n') : []);
      const receipt = buildReceipt(lines);
      console.log('\n' + receipt + '\n');
      doPrint(receipt, config);
      if (id) {
        markPrinted(url, id).catch((e) => console.error('Mark printed failed:', e.message));
      }
    });
  }).catch((e) => {
    if (e.code !== 'ECONNREFUSED' && e.message !== 'timeout') {
      console.error('Backend poll error:', e.message);
    }
  });
}

function startPoller() {
  stopPoller();
  poll();
  pollTimer = setInterval(poll, POLL_INTERVAL_MS);
}

function stopPoller() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

module.exports = { startPoller, stopPoller };
