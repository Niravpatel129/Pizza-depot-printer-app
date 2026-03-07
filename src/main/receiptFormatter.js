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

function formatDate(order) {
  const raw = order.date || order.orderDate || order.createdAt || order.created_at;
  if (!raw) return '';
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '';
    const mon = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    return `${mon} ${d.getDate()}, ${d.getFullYear()}`;
  } catch {
    return '';
  }
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

function buildHeader(data, width) {
  const name = (data?.receiptStoreName ?? data?.storeName ?? '').toString().trim().toUpperCase();
  const line1 = (data?.receiptAddressLine1 ?? data?.addressLine1 ?? data?.storeAddressLine1 ?? '').toString().trim().toUpperCase();
  const line2 = (data?.receiptAddressLine2 ?? data?.addressLine2 ?? data?.storeAddressLine2 ?? '').toString().trim().toUpperCase();
  const lines = [];
  if (name) lines.push(center(name, width));
  if (line1) lines.push(center(line1, width));
  if (line2) lines.push(center(line2, width));
  return lines.length ? lines.join('\n') : '';
}

const DEFAULT_FOOTER_MSG = 'ENJOY YOUR MEAL!';

function buildFooter(data, width) {
  const msg = (data?.receiptFooterMessage ?? data?.footerMessage ?? data?.footer_message ?? DEFAULT_FOOTER_MSG).toString().trim().toUpperCase() || DEFAULT_FOOTER_MSG;
  const site = (data?.receiptFooterWebsite ?? data?.footerWebsite ?? data?.footer_website ?? '').toString().trim().toUpperCase();
  const lines = [];
  lines.push(center(msg, width));
  if (site) lines.push(center(site, width));
  return lines.join('\n');
}

function orderToReceiptLines(order, width) {
  if (!order) return [];
  const w = width ?? DEFAULT_RECEIPT_WIDTH;
  const sep = '-'.repeat(w);
  const nameCol = Math.max(10, w - 10);
  const lines = [];
  const orderNum = order.orderNumber ?? order.order_id ?? order._id ?? order.id ?? order.orderId ?? '';
  const customerName = (order.customerName ?? order.customer_name ?? order.customer?.name ?? order.customer?.firstName ?? '').toString().trim().toUpperCase();
  const timestampStr = formatDateTime(order);
  if (timestampStr) lines.push((timestampStr.length > w ? timestampStr.slice(0, w) : timestampStr));
  if (orderNum || customerName) {
    const orderLabel = orderNum
      ? `ORDER #${String(orderNum).replace(/^#/, '')}${customerName ? ` · ${customerName}` : ''}`
      : customerName ? `FOR ${customerName}` : '';
    if (orderLabel) lines.push(orderLabel.length > w ? orderLabel.slice(0, w) : orderLabel);
  }
  const orderType = (order.orderType ?? order.type ?? order.deliveryType ?? '').toString().trim().toUpperCase();
  if (orderType) lines.push((orderType.length > w ? orderType.slice(0, w) : orderType));
  lines.push(sep);
  lines.push(padRight('ITEM', nameCol) + 'AMT ($)');
  const items = order.items || order.lineItems || [];
  let itemCount = 0;
  items.forEach((item) => {
    const name = (item.name ?? item.title ?? '').toString().trim().toUpperCase();
    const price = formatPrice(item.price ?? item.total ?? item.amount);
    itemCount += Number(item.quantity ?? item.qty ?? 1) || 1;
    const namePart = name;
    const pricePart = price ? price.padStart(8) : '';
    lines.push(padRight(namePart, nameCol) + pricePart);
    const modifiers = item.modifiers ?? item.toppings ?? item.options ?? [];
    if (Array.isArray(modifiers) && modifiers.length) {
      modifiers.forEach((m) => {
        const modName = (typeof m === 'string' ? m : (m && m.name) || '').toString().trim().toUpperCase();
        if (modName) lines.push(('   ' + modName).slice(0, w));
      });
    } else if (item.options && typeof item.options === 'string') {
      lines.push(('   ' + String(item.options).trim().toUpperCase()).slice(0, w));
    }
  });
  lines.push(sep);
  const totalCount = order.itemCount ?? items.length ?? itemCount;
  lines.push(padRight(`ITEM COUNT`, nameCol) + String(totalCount).padStart(8));
  const total = order.total != null ? formatPrice(order.total) : '';
  if (total) lines.push(padRight('TOTAL', nameCol) + '$ ' + total.padStart(6));
  lines.push(sep);
  const cardLast4 = order.cardLast4 ?? order.card_last4 ?? order.payment?.last4;
  if (cardLast4 != null) lines.push(`CARD #: **** **** **** ${String(cardLast4).slice(-4)}`.slice(0, w));
  const authNum = order.authNumber ?? order.auth_number ?? order.authorizationNumber ?? order.payment?.authNumber;
  if (authNum != null) lines.push(`AUTH #: ${authNum}`.slice(0, w));
  const userId = order.userId ?? order.user_id ?? order.cashierName ?? order.payment?.userId;
  if (userId != null) lines.push(`USERID: ${String(userId).toUpperCase()}`.slice(0, w));
  return lines;
}

function buildReceipt(orderOrLines, opts) {
  const width = getWidth(opts);
  const orderData = orderOrLines && typeof orderOrLines === 'object' && !Array.isArray(orderOrLines) ? orderOrLines : {};
  const receiptData = { ...orderData, ...opts };
  const header = buildHeader(receiptData, width);
  let body;
  if (orderOrLines && typeof orderOrLines === 'object' && !Array.isArray(orderOrLines)) {
    if (orderOrLines.lines?.length) body = orderOrLines.lines.join('\n');
    else if (orderOrLines.receipt_lines?.length) body = orderOrLines.receipt_lines.join('\n');
    else if (orderOrLines.receiptLines?.length) body = orderOrLines.receiptLines.join('\n');
    else if (orderOrLines.text) body = orderOrLines.text;
    else body = orderToReceiptLines(orderOrLines, width).join('\n');
  } else if (Array.isArray(orderOrLines) && orderOrLines.length) {
    body = orderOrLines.join('\n');
  } else {
    body = '(no content)';
  }
  const footer = buildFooter(receiptData, width);
  const parts = [header, body, footer].filter(Boolean);
  return parts.join('\n\n');
}

const { buildRawReceipt } = require('./escpos');

const DEFAULT_RAW_RECEIPT_WIDTH = 48;

function buildReceiptBuffer(orderOrLines, opts) {
  const w = opts?.receiptWidth != null ? Number(opts.receiptWidth) : DEFAULT_RAW_RECEIPT_WIDTH;
  const rawOpts = { ...opts, receiptWidth: Math.max(16, Math.min(64, w)) || DEFAULT_RAW_RECEIPT_WIDTH };
  const text = buildReceipt(orderOrLines, rawOpts);
  const order = orderOrLines && typeof orderOrLines === 'object' && !Array.isArray(orderOrLines) ? orderOrLines : null;
  const barcodeData = order
    ? (order.orderNumber ?? order.order_id ?? order._id ?? order.id ?? order.orderId ?? '')
    : '';
  return buildRawReceipt(text, barcodeData ? String(barcodeData).replace(/^#/, '') : null);
}

module.exports = { buildReceipt, buildReceiptBuffer, buildHeader, buildFooter, orderToReceiptLines };
