const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

function init() {
  return Buffer.from([ESC, 0x40]);
}

function barcodeCODE128(data) {
  const str = String(data).slice(0, 80);
  const bytes = Buffer.from(str, 'ascii');
  const buf = Buffer.alloc(4 + bytes.length + 1);
  buf[0] = GS;
  buf[1] = 0x6b;
  buf[2] = 73;
  buf[3] = 3;
  bytes.copy(buf, 4);
  buf[4 + bytes.length] = 0;
  return buf;
}

function feed(n) {
  return Buffer.from([ESC, 0x64, n ?? 3]);
}

function buildRawReceipt(text, barcodeData) {
  const parts = [init(), Buffer.from(text, 'utf8'), Buffer.from([LF])];
  if (barcodeData != null && String(barcodeData).trim()) {
    parts.push(barcodeCODE128(String(barcodeData).trim()));
    parts.push(Buffer.from([LF]));
  }
  parts.push(feed(4));
  return Buffer.concat(parts);
}

module.exports = { buildRawReceipt };
