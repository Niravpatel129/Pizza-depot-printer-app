const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

function init() {
  return Buffer.from([ESC, 0x40]);
}

function lineSpacingDefault() {
  return Buffer.from([ESC, 0x32]);
}

function alignment(n) {
  return Buffer.from([ESC, 0x61, n]);
}

function characterSize(n) {
  return Buffer.from([GS, 0x21, n]);
}

function leftMargin(nL, nH) {
  return Buffer.from([GS, 0x4c, nL ?? 0, nH ?? 0]);
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

function cut(partial = false) {
  return Buffer.from([GS, 0x56, partial ? 1 : 0]);
}

function drawerKick(pin = 0, onMs = 200, offMs = 200) {
  const t1 = Math.min(255, Math.floor(onMs / 2));
  const t2 = Math.min(255, Math.floor(offMs / 2));
  return Buffer.from([ESC, 0x70, pin, t1, t2]);
}

function buildRawReceipt(text, barcodeData, opts = {}) {
  const supportsCut = opts.supportsCut !== false;
  const supportsDrawerKick = !!opts.supportsDrawerKick;
  const parts = [
    init(),
    lineSpacingDefault(),
    leftMargin(0, 0),
    characterSize(0x00),
  ];
  const sections = String(text).split(/\n\n+/);
  const header = sections.length > 1 ? (sections[0] || '') : '';
  const body = sections.length > 1 ? (sections[1] || '') : (sections[0] || '');
  const footer = sections.length > 2 ? (sections[2] || '') : '';
  if (header) {
    parts.push(alignment(1), characterSize(0x01), Buffer.from(header + '\n', 'utf8'), characterSize(0x00));
  }
  parts.push(alignment(0), Buffer.from(body + (body ? '\n' : ''), 'utf8'));
  if (footer && footer !== body) {
    parts.push(alignment(1), characterSize(0x01), Buffer.from(footer + '\n', 'utf8'), characterSize(0x00));
  }
  parts.push(Buffer.from([LF]));
  if (barcodeData != null && String(barcodeData).trim()) {
    parts.push(barcodeCODE128(String(barcodeData).trim()));
    parts.push(Buffer.from([LF]));
  }
  parts.push(feed(2));
  if (supportsDrawerKick) parts.push(drawerKick());
  if (supportsCut) parts.push(cut());
  return Buffer.concat(parts);
}

module.exports = { buildRawReceipt };
