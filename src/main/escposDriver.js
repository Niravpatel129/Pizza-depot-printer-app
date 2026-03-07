const os = require('os');
const path = require('path');
const { ThermalPrinter, PrinterTypes, CharacterSet, BreakLine } = require('node-thermal-printer');

function buildReceiptBufferFromRows(rows, opts) {
  const width = Math.max(16, Math.min(64, Number(opts?.receiptWidth) || 48));
  const interfacePath = path.join(os.tmpdir(), `receipt-build-${Date.now()}.bin`);
  const printerType = opts?.printerType === 'star' ? PrinterTypes.STAR : PrinterTypes.EPSON;
  const printer = new ThermalPrinter({
    type: printerType,
    width,
    interface: interfacePath,
    characterSet: opts?.characterSet ?? CharacterSet.WPC1252,
    removeSpecialCharacters: opts?.removeSpecialCharacters ?? false,
    lineCharacter: opts?.lineCharacter ?? '-',
    breakLine: opts?.breakLine ?? BreakLine.WORD,
    options: opts?.printerOptions ?? { timeout: 5000 },
  });

  const supportsCut = opts?.supportsCut !== false;
  const supportsDrawerKick = !!opts?.supportsDrawerKick;
  const barcodeData = opts?.barcodeData ? String(opts.barcodeData).replace(/^#/, '').trim() : null;

  rows.forEach((row) => {
    if (row.type === 'text') {
      if (row.align === 'center') printer.alignCenter();
      else if (row.align === 'right') printer.alignRight();
      else printer.alignLeft();
      if (row.bold) printer.bold(true);
      printer.println(String(row.value ?? '').trim() || ' ');
      if (row.bold) printer.bold(false);
    } else if (row.type === 'columns') {
      printer.alignLeft();
      printer.leftRight(String(row.left ?? '').trim(), String(row.right ?? '').trim());
    } else if (row.type === 'divider') {
      printer.drawLine();
    } else if (row.type === 'feed') {
      for (let i = 0; i < (row.lines ?? 1); i++) printer.newLine();
    }
  });

  if (barcodeData) {
    printer.newLine();
    try {
      printer.code128(barcodeData);
    } catch {
      printer.println(`#${barcodeData}`);
    }
  }

  printer.newLine();
  printer.newLine();
  if (supportsDrawerKick) printer.openCashDrawer();
  if (supportsCut) printer.cut();

  const buffer = printer.getBuffer();
  return buffer ? Promise.resolve(Buffer.from(buffer)) : Promise.resolve(Buffer.alloc(0));
}

module.exports = { buildReceiptBufferFromRows, PrinterTypes, CharacterSet, BreakLine };
