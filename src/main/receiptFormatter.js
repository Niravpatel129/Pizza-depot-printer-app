const DEFAULT_RECEIPT_WIDTH = 42;

function getWidth(opts) {
  const w = opts?.receiptWidth ?? DEFAULT_RECEIPT_WIDTH;
  return Math.max(16, Math.min(64, Number(w) || DEFAULT_RECEIPT_WIDTH));
}

function padRight(str, width) {
  const s = String(str);
  return s.length >= width ? s.slice(0, width) : s + ' '.repeat(width - s.length);
}

function formatPrice(price) {
  if (price == null || price === '') return '';
  const n = Number(price);
  return Number.isFinite(n) ? n.toFixed(2) : String(price);
}

function formatDateTime(order) {
  const raw = order.date || order.orderDate || order.createdAt || order.created_at;
  if (!raw) return '';
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '';
    const mon = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const dateStr = `${mon} ${d.getDate()}, ${d.getFullYear()}`;
    const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${dateStr} ${timeStr}`;
  } catch {
    return '';
  }
}

function center(str, width) {
  const s = String(str).trim();
  if (s.length >= width) return s.slice(0, width);
  const pad = Math.max(0, width - s.length);
  return ' '.repeat(Math.floor(pad / 2)) + s + ' '.repeat(Math.ceil(pad / 2));
}

function receiptToRows(orderOrReceipt, opts) {
  const width = getWidth(opts);
  const w = width;
  const nameCol = Math.max(10, w - 10);
  const order = orderOrReceipt && typeof orderOrReceipt === 'object' && !Array.isArray(orderOrReceipt) ? orderOrReceipt : {};
  const receipt = orderOrReceipt?.receipt ?? order;
  const data = { ...order, ...receipt };
  const rows = [];
  const pushText = (value, align = 'left', bold = false) => {
    rows.push({ type: 'text', value: String(value ?? '').trim(), align, bold });
  };
  const pushColumns = (left, right) => {
    rows.push({ type: 'columns', left: String(left ?? ''), right: String(right ?? '') });
  };
  const pushDivider = () => rows.push({ type: 'divider' });
  const businessName = (data.businessName ?? data.receiptStoreName ?? data.storeName ?? '').toString().trim().toUpperCase();
  const addr1 = (data.addressLine1 ?? data.receiptAddressLine1 ?? data.storeAddressLine1 ?? '').toString().trim().toUpperCase();
  const addr2 = (data.addressLine2 ?? data.receiptAddressLine2 ?? data.storeAddressLine2 ?? '').toString().trim().toUpperCase();
  if (businessName) pushText(businessName, 'center', true);
  if (addr1) pushText(addr1, 'center');
  if (addr2) pushText(addr2, 'center');
  const timestampStr = formatDateTime(order.receipt ? order : data);
  if (timestampStr) pushText(timestampStr.slice(0, w));
  const orderNum = data.orderNumber ?? order.orderNumber ?? order.order_id ?? order._id ?? order.id ?? order.orderId ?? '';
  const customerName = (data.customerName ?? order.customerName ?? order.customer_name ?? order.customer?.name ?? '').toString().trim().toUpperCase();
  if (orderNum || customerName) {
    const orderLabel = orderNum ? `ORDER #${String(orderNum).replace(/^#/, '')}${customerName ? ` · ${customerName}` : ''}` : customerName ? `FOR ${customerName}` : '';
    if (orderLabel) pushText(orderLabel.slice(0, w));
  }
  const orderType = (order.orderType ?? order.type ?? data.orderType ?? '').toString().trim().toUpperCase();
  if (orderType) pushText(orderType.slice(0, w));
  pushDivider();
  pushColumns(padRight('ITEM', nameCol), 'AMT ($)');
  const items = data.items ?? order.items ?? order.lineItems ?? [];
  let itemCount = 0;
  items.forEach((item) => {
    const name = (item.name ?? item.title ?? '').toString().trim().toUpperCase();
    const price = formatPrice(item.price ?? item.unitPrice ?? item.total ?? item.amount);
    itemCount += Number(item.qty ?? item.quantity ?? 1) || 1;
    pushColumns(padRight(name, nameCol), price ? price.padStart(8) : '');
    const mods = item.modifiers ?? item.toppings ?? item.options ?? [];
    (Array.isArray(mods) ? mods : [mods]).forEach((m) => {
      const modName = (typeof m === 'string' ? m : (m && m.name) || '').toString().trim().toUpperCase();
      if (modName) pushText(('   ' + modName).slice(0, w));
    });
  });
  pushDivider();
  const totalCount = order.itemCount ?? data.items?.length ?? items.length ?? itemCount;
  pushColumns(padRight('ITEM COUNT', nameCol), String(totalCount).padStart(8));
  const total = order.total != null ? formatPrice(order.total) : (data.total != null ? formatPrice(data.total) : '');
  if (total) pushColumns(padRight('TOTAL', nameCol), '$ ' + total.padStart(6));
  pushDivider();
  const cardLast4 = order.cardLast4 ?? order.card_last4 ?? order.payment?.last4 ?? data.cardLast4;
  if (cardLast4 != null) pushText(`CARD #: **** **** **** ${String(cardLast4).slice(-4)}`.slice(0, w));
  const authNum = order.authNumber ?? order.auth_number ?? order.payment?.authNumber ?? data.authNumber;
  if (authNum != null) pushText(`AUTH #: ${authNum}`.slice(0, w));
  const userId = order.userId ?? order.user_id ?? order.cashierName ?? order.payment?.userId ?? data.userId;
  if (userId != null) pushText(`USERID: ${String(userId).toUpperCase()}`.slice(0, w));
  const footerMsg = (data.footer ?? data.receiptFooterMessage ?? data.footerMessage ?? 'ENJOY YOUR MEAL!').toString().trim().toUpperCase() || 'ENJOY YOUR MEAL!';
  const footerSite = (data.footerWebsite ?? data.receiptFooterWebsite ?? '').toString().trim().toUpperCase();
  pushText(footerMsg, 'center', true);
  if (footerSite) pushText(footerSite, 'center');
  return rows;
}

function rowsToPlainText(rows, width) {
  const w = width ?? DEFAULT_RECEIPT_WIDTH;
  const sep = '-'.repeat(w);
  const nameCol = Math.max(10, w - 10);
  const lines = [];
  rows.forEach((row) => {
    if (row.type === 'text') {
      const s = (row.value || '').slice(0, w);
      if (row.align === 'center') lines.push(center(s, w));
      else lines.push(s || '');
    } else if (row.type === 'columns') {
      const rightColWidth = w - nameCol;
      const left = (row.left ?? '').slice(0, nameCol);
      const right = (row.right ?? '').slice(-rightColWidth).padStart(rightColWidth);
      lines.push(padRight(left, nameCol) + right);
    } else if (row.type === 'divider') {
      lines.push(sep);
    } else if (row.type === 'feed') {
      for (let i = 0; i < (row.lines ?? 1); i++) lines.push('');
    }
  });
  return lines.join('\n');
}

function buildReceipt(orderOrLines, opts) {
  const width = getWidth(opts);
  if (orderOrLines && typeof orderOrLines === 'object' && !Array.isArray(orderOrLines)) {
    if (orderOrLines.lines?.length) return orderOrLines.lines.join('\n');
    if (orderOrLines.receipt_lines?.length) return orderOrLines.receipt_lines.join('\n');
    if (orderOrLines.receiptLines?.length) return orderOrLines.receiptLines.join('\n');
    if (orderOrLines.text) return orderOrLines.text;
    const receiptData = { ...orderOrLines, ...(orderOrLines.receipt || {}), ...opts };
    const rows = receiptToRows(receiptData, { ...opts, receiptWidth: width });
    return rowsToPlainText(rows, width);
  }
  if (Array.isArray(orderOrLines) && orderOrLines.length) return orderOrLines.join('\n');
  return '(no content)';
}

const { buildReceiptBufferFromRows } = require('./escposDriver');

const DEFAULT_RAW_RECEIPT_WIDTH = 48;

function getReceiptRows(orderOrLines, opts) {
  const w = opts?.receiptWidth != null ? Number(opts.receiptWidth) : DEFAULT_RAW_RECEIPT_WIDTH;
  const rawOpts = { ...opts, receiptWidth: Math.max(16, Math.min(64, w)) || DEFAULT_RAW_RECEIPT_WIDTH };
  if (orderOrLines && typeof orderOrLines === 'object' && !Array.isArray(orderOrLines)) {
    if (orderOrLines.lines?.length) {
      return orderOrLines.lines.map((line) => ({ type: 'text', value: line, align: 'left', bold: false }));
    }
    if (orderOrLines.receipt_lines?.length || orderOrLines.receiptLines?.length) {
      const lines = orderOrLines.receipt_lines ?? orderOrLines.receiptLines ?? [];
      return lines.map((line) => ({ type: 'text', value: line, align: 'left', bold: false }));
    }
    const receiptData = { ...orderOrLines, ...(orderOrLines.receipt || {}), ...opts };
    return receiptToRows(receiptData, { ...rawOpts, receiptWidth: getWidth(rawOpts) });
  }
  if (Array.isArray(orderOrLines) && orderOrLines.length) {
    return orderOrLines.map((line) => ({ type: 'text', value: line, align: 'left', bold: false }));
  }
  return [{ type: 'text', value: '(no content)', align: 'left', bold: false }];
}

function buildReceiptBuffer(orderOrLines, opts) {
  const w = opts?.receiptWidth != null ? Number(opts.receiptWidth) : DEFAULT_RAW_RECEIPT_WIDTH;
  const rawOpts = { ...opts, receiptWidth: Math.max(16, Math.min(64, w)) || DEFAULT_RAW_RECEIPT_WIDTH };
  const rows = getReceiptRows(orderOrLines, rawOpts);
  const order = orderOrLines && typeof orderOrLines === 'object' && !Array.isArray(orderOrLines) ? orderOrLines : null;
  const barcodeData = order
    ? (order.orderNumber ?? order.order_id ?? order._id ?? order.id ?? order.orderId ?? '')
    : '';
  return buildReceiptBufferFromRows(rows, {
    ...rawOpts,
    supportsCut: opts?.supportsCut !== false,
    supportsDrawerKick: !!opts?.supportsDrawerKick,
    barcodeData: barcodeData ? String(barcodeData).replace(/^#/, '') : null,
  });
}

module.exports = { buildReceipt, buildReceiptBuffer, receiptToRows, rowsToPlainText };
