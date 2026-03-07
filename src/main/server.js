const http = require('http');
const { loadConfig } = require('./config');
const { doPrint } = require('./print');

const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3847;
let currentPort = DEFAULT_PORT;
let httpServer = null;

function createServer(dialog) {
  if (httpServer) {
    httpServer.close();
    httpServer = null;
  }
  httpServer = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/print-receipt') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'POST /print-receipt only' }));
      return;
    }
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const data = body ? JSON.parse(body) : {};
        const lines = data.lines ?? (data.text ? data.text.split('\n') : ['(no content)']);
        const receipt = [
          '--------------------------------',
          ...lines,
          '--------------------------------',
          `Printed at ${new Date().toISOString()}`,
        ].join('\n');
        console.log('\n' + receipt + '\n');
        const config = loadConfig();
        doPrint(receipt, config);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, printed: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: String(e.message) }));
      }
    });
  });
  httpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && currentPort < 3857) {
      currentPort += 1;
      httpServer.listen(currentPort);
    } else if (dialog) {
      dialog.showErrorBox('Printer Agent', `Could not start server: ${err.message}`);
    }
  });
  currentPort = DEFAULT_PORT;
  httpServer.listen(currentPort, () => {
    console.log(`Printer agent listening on http://localhost:${currentPort}`);
  });
}

function closeServer() {
  if (httpServer) {
    httpServer.close();
    httpServer = null;
  }
}

module.exports = { createServer, closeServer };
