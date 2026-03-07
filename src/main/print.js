const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { BrowserWindow } = require('electron');
const { getActiveProfile, getProfileById, widthToCharWidth } = require('./printerProfiles');
const { buildReceipt, buildReceiptBuffer } = require('./receiptFormatter');
const { normalizeReceiptJob } = require('./printing/types');
const logger = require('./logger');

function getPrinterName(config) {
  const profile = config?._printProfile ?? getActiveProfile(config);
  const name = (profile && profile.deviceName) || config?.printer;
  return typeof name === 'string' ? name.trim() : '';
}

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

const RECEIPT_WIDTH_MICRONS = 80000;
const RECEIPT_HEIGHT_MICRONS = 300000;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildReceiptPrintHtml(receiptText) {
  const body = escapeHtml(receiptText || '(no content)');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @media print {
    @page { size: 80mm auto; margin: 0; }
    html, body { width: 80mm; margin: 0; padding: 0; }
    .receipt {
      width: 72mm;
      padding: 4mm;
      box-sizing: border-box;
      font-family: ui-monospace, monospace;
      font-size: 12px;
      line-height: 1.25;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
  }
  html, body { width: 80mm; margin: 0; padding: 0; font-family: ui-monospace, monospace; font-size: 12px; }
  .receipt { width: 72mm; padding: 4mm; box-sizing: border-box; white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
</head>
<body><div class="receipt">${body}</div></body>
</html>`;
}

function doPrintReceiptViaHtml(receiptText, config) {
  const printerName = getPrinterName(config) || undefined;
  const html = buildReceiptPrintHtml(receiptText);
  const url = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true },
  });
  return new Promise((resolve) => {
    const runPrint = () => {
      win.webContents.print(
        {
          silent: true,
          deviceName: printerName || undefined,
          printBackground: true,
          margins: { marginType: 'none' },
          pageSize: {
            width: RECEIPT_WIDTH_MICRONS,
            height: RECEIPT_HEIGHT_MICRONS,
          },
        },
        (success, failureReason) => {
          win.close();
          if (success) resolve({ ok: true });
          else resolve({ ok: false, error: failureReason || 'Print failed' });
        }
      );
    };
    win.webContents.once('did-finish-load', runPrint);
    win.loadURL(url).catch((err) => {
      win.close();
      resolve({ ok: false, error: err?.message || String(err) });
    });
  });
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
  const printerName = getPrinterName(config) || undefined;
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
  const printerName = getPrinterName(config) || undefined;
  if (process.platform === 'win32') {
    if (printerModule && typeof printerModule.printDirect === 'function') {
      return new Promise((resolve) => {
        printerModule.printDirect({
          data: buffer,
          printer: printerName || undefined,
          type: 'RAW',
          success: () => resolve({ ok: true }),
          error: (err) => resolve({ ok: false, error: err?.message || String(err) }),
        });
      }).then((result) => {
        if (result.ok) return result;
        const text = stripControlChars(buffer);
        if (!text.trim()) return result;
        // Degraded text fallback: ESC/POS commands (cut, drawer, formatting) are lost
        return doPrintReceiptViaHtml(text, config).then((fallback) => {
          if (fallback.ok) return fallback;
          if (PosPrinter) {
            return PosPrinter.print(
              [{ type: 'text', value: text, style: { whiteSpace: 'pre-wrap', fontFamily: 'monospace' } }],
              posPrintOptions(config)
            ).then(() => ({ ok: true })).catch((e) => {
              const msg = e?.message || String(e);
              console.error('POS printer fallback failed:', msg);
              return { ok: false, error: msg };
            });
          }
          return doPrint(text, config);
        });
      });
    }
    const text = stripControlChars(buffer);
    if (text.trim()) {
      return doPrintReceiptViaHtml(text, config).then((result) => {
        if (result.ok) return result;
        if (PosPrinter) {
          return PosPrinter.print(
            [{ type: 'text', value: text, style: { whiteSpace: 'pre-wrap', fontFamily: 'monospace' } }],
            posPrintOptions(config)
          ).then(() => ({ ok: true })).catch((e) => {
            const msg = e?.message || String(e);
            console.error('POS printer fallback failed:', msg);
            return { ok: false, error: msg };
          });
        }
        return doPrint(text, config);
      });
    }
    console.error('No printer module (Windows)');
    return Promise.resolve({ ok: false, error: 'No printer module (Windows)' });
  }
  let tmpFile;
  try {
    tmpFile = path.join(os.tmpdir(), `receipt-raw-${Date.now()}.bin`);
    fs.writeFileSync(tmpFile, buffer);
    const printerArg = printerName ? ` -d ${JSON.stringify(String(printerName))}` : '';
    const mediaOpt = process.platform === 'darwin' ? ' -o media=Custom.80x297mm' : ' -o media=80mm';
    execSync(`lp -o raw${mediaOpt}${printerArg} ${JSON.stringify(tmpFile)}`, { stdio: 'pipe' });
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
    return doPrintReceiptViaHtml(receipt, config).then((result) => {
      if (result.ok) return result;
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
      let tmpFile;
      try {
        tmpFile = path.join(os.tmpdir(), `receipt-${Date.now()}.txt`);
        fs.writeFileSync(tmpFile, receipt, 'utf8');
        const winPrinterName = getPrinterName(config);
        const escapeForCmd = (s) => JSON.stringify(s).replace(/"/g, '\\"');
        const printerArg = winPrinterName ? ` -Name ${escapeForCmd(winPrinterName)}` : '';
        execSync(
          `powershell -NoProfile -NonInteractive -Command "Get-Content -LiteralPath ${escapeForCmd(tmpFile)} -Raw | Out-Printer${printerArg}"`,
          { stdio: 'pipe', windowsHide: true }
        );
        return Promise.resolve({ ok: true });
      } catch (e) {
        const msg = e?.message || String(e);
        console.error('Print failed:', msg);
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
    });
  }
  let tmpFile;
  try {
    tmpFile = path.join(os.tmpdir(), `receipt-${Date.now()}.txt`);
    fs.writeFileSync(tmpFile, receipt, 'utf8');
    const printerArg = getPrinterName(config) ? ` -d ${JSON.stringify(getPrinterName(config))}` : '';
    execSync(`lp${printerArg} ${JSON.stringify(tmpFile)}`, { stdio: 'pipe' });
    return Promise.resolve({ ok: true });
  } catch (e) {
    const msg = e?.message || String(e);
    console.error('Print failed:', msg);
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

function logPrintAttempt(entry) {
  const msg = [
    'Print',
    entry.ok ? 'OK' : 'FAIL',
    `job=${entry.jobId ?? '?'}`,
    `profile=${entry.profileId ?? '?'}`,
    `strategy=${entry.strategy ?? '?'}`,
    entry.durationMs != null ? `duration=${entry.durationMs}ms` : '',
    entry.error ? `error=${entry.error}` : '',
  ].filter(Boolean).join(' ');
  logger.log(entry.ok ? 'log' : 'error', msg);
}

async function printJob(job, config) {
  const startedAt = Date.now();
  const normalized = normalizeReceiptJob(job, config);
  const jobId = normalized.jobId;
  const profileId = normalized.printerProfileId || config?.activePrinterProfileId;
  const profile = (profileId && getProfileById(config, profileId)) || getActiveProfile(config);
  const strategy = profile.strategy ?? profile.protocol ?? 'escpos';
  const opts = {
    ...config,
    receiptWidth: widthToCharWidth(profile.width),
    supportsCut: profile.supportsCut,
    supportsDrawerKick: profile.supportsDrawerKick,
  };
  const configForPrint = { ...config, _printProfile: profile };
  let receipt;
  if (strategy === 'html') {
    receipt = buildReceipt(normalized._raw ?? normalized.receipt ?? job, opts);
  } else {
    receipt = buildReceiptBuffer(normalized._raw ?? normalized.receipt ?? job, opts);
  }
  const result = await doPrint(receipt, configForPrint);
  const durationMs = Date.now() - startedAt;
  logPrintAttempt({
    timestamp: new Date().toISOString(),
    jobId,
    profileId: profile.id,
    profileName: profile.name,
    strategy,
    ok: result && result.ok === true,
    error: result && !result.ok ? result.error : undefined,
    durationMs,
  });
  return result;
}

module.exports = { doPrint, printJob, buildReceiptPrintHtml, logPrintAttempt };
