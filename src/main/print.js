const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

function doPrint(receipt, config) {
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
