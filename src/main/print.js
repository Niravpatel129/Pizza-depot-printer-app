const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { getActiveProfile, getProfileById, widthToCharWidth } = require('./printerProfiles');
const { buildReceiptBuffer } = require('./receiptFormatter');
const { normalizeReceiptJob } = require('./printing/types');
const logger = require('./logger');

function getPrinterName(config) {
  const profile = config?._printProfile ?? getActiveProfile(config);
  const name = (profile && profile.deviceName) || config?.printer;
  return typeof name === 'string' ? name.trim() : '';
}

let printerModule = null;
try {
  printerModule = require('printer');
} catch {
  printerModule = null;
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
      });
    }
    return Promise.resolve({ ok: false, error: 'Raw printing on Windows requires the printer module' });
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

function doPrint(buffer, config) {
  if (!Buffer.isBuffer(buffer)) {
    return Promise.resolve({ ok: false, error: 'Receipt must be ESC/POS buffer' });
  }
  return doPrintRaw(buffer, config);
}

function logPrintAttempt(entry) {
  const msg = [
    'Print',
    entry.ok ? 'OK' : 'FAIL',
    `job=${entry.jobId ?? '?'}`,
    `profile=${entry.profileId ?? '?'}`,
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
  const opts = {
    ...config,
    receiptWidth: widthToCharWidth(profile.width),
    supportsCut: profile.supportsCut,
    supportsDrawerKick: profile.supportsDrawerKick,
    printerType: profile.printerType ?? 'epson',
  };
  const configForPrint = { ...config, _printProfile: profile };
  const receipt = await buildReceiptBuffer(normalized._raw ?? normalized.receipt ?? job, opts);
  const result = await doPrint(receipt, configForPrint);
  const durationMs = Date.now() - startedAt;
  logPrintAttempt({
    timestamp: new Date().toISOString(),
    jobId,
    profileId: profile.id,
    profileName: profile.name,
    ok: result && result.ok === true,
    error: result && !result.ok ? result.error : undefined,
    durationMs,
  });
  return result;
}

module.exports = { doPrint, printJob, logPrintAttempt };
