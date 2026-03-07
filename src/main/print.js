const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

let printerModule = null;
try {
  printerModule = require('printer');
} catch {
  printerModule = null;
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
        return true;
      } catch (e) {
        console.error('Raw print failed:', e.message);
        return false;
      }
    }
    return false;
  }
  let tmpFile;
  try {
    tmpFile = path.join(os.tmpdir(), `receipt-raw-${Date.now()}.bin`);
    fs.writeFileSync(tmpFile, buffer);
    const printerArg = printerName ? ` -d ${JSON.stringify(printerName)}` : '';
    execSync(`lp -o raw${printerArg} ${JSON.stringify(tmpFile)}`, { stdio: 'pipe' });
    return true;
  } catch (e) {
    console.error('Raw print failed:', e.message);
    return false;
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
      return true;
    } catch (e) {
      console.error('Print failed:', e.message);
      return false;
    }
  }
  try {
    const printerArg = config?.printer ? ` -d ${JSON.stringify(config.printer)}` : '';
    execSync(`echo ${JSON.stringify(receipt)} | lp${printerArg}`, { stdio: 'inherit' });
    return true;
  } catch (e) {
    console.error('Print failed:', e.message);
    return false;
  }
}

module.exports = { doPrint };
