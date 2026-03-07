const { execSync } = require('child_process');

function doPrint(receipt, config) {
  if (process.platform === 'win32') return;
  try {
    const printerArg = config.printer ? ` -d ${JSON.stringify(config.printer)}` : '';
    execSync(`echo ${JSON.stringify(receipt)} | lp${printerArg}`, { stdio: 'inherit' });
  } catch (e) {
    console.error('Print failed:', e.message);
  }
}

module.exports = { doPrint };
