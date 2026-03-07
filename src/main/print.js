const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

let printerModule = null;
let PosPrinter = null;
try {
  printerModule = require('printer');
} catch {
  printerModule = null;
}
try {
  PosPrinter = require('electron-pos-printer').PosPrinter;
} catch {
  PosPrinter = null;
}

function stripControlChars(buf) {
  const text = (typeof buf === 'string' ? buf : buf.toString('utf8')).replace(/\r\n/g, '\n');
  return Array.from(text)
    .filter((c) => {
      const code = c.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
    })
    .join('');
}

function posPrintOptions(config) {
  const printerName = config?.printer?.trim();
  return {
    preview: false,
    silent: true,
    printerName: printerName || undefined,
    pageSize: '80mm',
    margin: '0 0 0 0',
    copies: 1,
    timeOutPerLine: 400,
  };
}

function doPrintRaw(buffer, config) {
  const printerName = config?.printer?.trim();
  if (process.platform === 'win32') {
    if (printerModule && typeof printerModule.printDirect === 'function') {
      try {
        printerModule.printDirect({
          data: buffer,
          printer: printerName || undefined,
          type: 'RAW',
          success: () => {},
          error: (err) => {
            throw err;
          },
        });
        return Promise.resolve({ ok: true });
      } catch (e) {
        const msg = e?.message || String(e);
        console.error('Raw print failed:', msg);
        return Promise.resolve({ ok: false, error: msg });
      }
    }
    if (PosPrinter) {
      try {
        const text = stripControlChars(buffer);
        if (text.trim()) {
          return PosPrinter.print(
            [{ type: 'text', value: text, style: { whiteSpace: 'pre-wrap', fontFamily: 'monospace' } }],
            posPrintOptions(config)
          ).then(() => ({ ok: true })).catch((e) => {
            const msg = e?.message || String(e);
            console.error('POS printer fallback failed:', msg);
            return { ok: false, error: msg };
          });
        }
      } catch (e) {
        console.error('Fallback text print failed:', e?.message || e);
      }
    } else {
      try {
        const text = stripControlChars(buffer);
        if (text.trim()) return doPrint(text, config);
      } catch (e) {
        console.error('Fallback text print failed:', e?.message || e);
      }
    }
    const msg = 'No printer module (Windows)';
    console.error(msg);
    return Promise.resolve({ ok: false, error: msg });
  }
  let tmpFile;
  try {
    tmpFile = path.join(os.tmpdir(), `receipt-raw-${Date.now()}.bin`);
    fs.writeFileSync(tmpFile, buffer);
    const printerArg = printerName ? ` -d ${JSON.stringify(printerName)}` : '';
    execSync(`lp -o raw${printerArg} ${JSON.stringify(tmpFile)}`, { stdio: 'pipe' });
    return Promise.resolve({ ok: true });
  } catch (e) {
    const msg = e?.message || String(e);
    console.error('Raw print failed:', msg);
    return Promise.resolve({ ok: false, error: msg });
  } finally {
    if (tmpFile) {
      try {
        fs.unlinkSync(tmpFile);
      } catch (e) {
        console.warn('Cleanup temp file failed:', e.message);
      }
    }
  }
}

function doPrint(receipt, config) {
  if (Buffer.isBuffer(receipt)) {
    return doPrintRaw(receipt, config);
  }
  if (process.platform === 'win32') {
    if (PosPrinter) {
      const data = [{ type: 'text', value: receipt, style: { whiteSpace: 'pre-wrap', fontFamily: 'monospace' } }];
      return PosPrinter.print(data, posPrintOptions(config))
        .then(() => ({ ok: true }))
        .catch((e) => {
          const msg = e?.message || String(e);
          console.error('Print failed:', msg);
          return { ok: false, error: msg };
        });
    }
    try {
      const tmpFile = path.join(os.tmpdir(), `receipt-${Date.now()}.txt`);
      fs.writeFileSync(tmpFile, receipt, 'utf8');
      const printerName = config?.printer?.trim();
      const escapeForCmd = (s) => JSON.stringify(s).replace(/"/g, '\\"');
      const printerArg = printerName ? ` -Name ${escapeForCmd(printerName)}` : '';
      execSync(
        `powershell -NoProfile -NonInteractive -Command "Get-Content -LiteralPath ${escapeForCmd(tmpFile)} -Raw | Out-Printer${printerArg}"`,
        { stdio: 'pipe', windowsHide: true }
      );
      try {
        fs.unlinkSync(tmpFile);
      } catch (e) {
        console.warn('Cleanup temp file failed:', e.message);
      }
      return Promise.resolve({ ok: true });
    } catch (e) {
      const msg = e?.message || String(e);
      console.error('Print failed:', msg);
      return Promise.resolve({ ok: false, error: msg });
    }
  }
  try {
    const printerArg = config?.printer ? ` -d ${JSON.stringify(config.printer)}` : '';
    execSync(`echo ${JSON.stringify(receipt)} | lp${printerArg}`, { stdio: 'inherit' });
    return Promise.resolve({ ok: true });
  } catch (e) {
    const msg = e?.message || String(e);
    console.error('Print failed:', msg);
    return Promise.resolve({ ok: false, error: msg });
  }
}

module.exports = { doPrint };
