const http = require('http');
const { loadConfig } = require('./config');
const { printJob } = require('./print');

let currentPort = 3847;
let httpServer = null;

function createServer(dialog) {
  if (httpServer) {
    httpServer.close();
    httpServer = null;
  }
  const config = loadConfig();
  currentPort = parseInt(config.port, 10) || parseInt(process.env.PORT, 10) || 3847;
  httpServer = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/print-receipt') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'POST /print-receipt only' }));
      return;
    }
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const data = body ? JSON.parse(body) : {};
        const lines = data.lines ?? (data.text ? data.text.split('\n') : ['(no content)']);
        const job = {
          lines: [
            '--------------------------------',
            ...lines,
            '--------------------------------',
            `Printed at ${new Date().toISOString()}`,
          ],
        };
        console.log('\n' + job.lines.join('\n') + '\n');
        const config = loadConfig();
        const result = await printJob(job, config);
        if (result && result.ok) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, printed: true }));
        } else {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: (result && result.error) || 'Print failed' }));
        }
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
  httpServer.listen(currentPort, () => {
    console.log(`Printer agent listening on port ${currentPort}`);
  });
}

function closeServer() {
  if (httpServer) {
    httpServer.close();
    httpServer = null;
  }
}

module.exports = { createServer, closeServer };
