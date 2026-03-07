const RECEIPT_WIDTH = 32;

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

function center(str) {
  const s = String(str).trim();
  if (s.length >= RECEIPT_WIDTH) return s.slice(0, RECEIPT_WIDTH);
  const pad = Math.max(0, RECEIPT_WIDTH - s.length);
  return ' '.repeat(Math.floor(pad / 2)) + s + ' '.repeat(Math.ceil(pad / 2));
}

function buildHeader(data) {
  const name = (data?.receiptStoreName ?? data?.storeName ?? '').toString().trim().toUpperCase();
  const line1 = (data?.receiptAddressLine1 ?? data?.addressLine1 ?? data?.storeAddressLine1 ?? '').toString().trim().toUpperCase();
  const line2 = (data?.receiptAddressLine2 ?? data?.addressLine2 ?? data?.storeAddressLine2 ?? '').toString().trim().toUpperCase();
  const lines = [];
  if (name) lines.push(center(name));
  if (line1) lines.push(center(line1));
  if (line2) lines.push(center(line2));
  return lines.length ? lines.join('\n') : '';
}

function buildFooter(data) {
  const msg = (data?.receiptFooterMessage ?? data?.footerMessage ?? data?.footer_message ?? '').toString().trim().toUpperCase();
  const site = (data?.receiptFooterWebsite ?? data?.footerWebsite ?? data?.footer_website ?? '').toString().trim().toUpperCase();
  const lines = [];
  if (msg) lines.push(center(msg));
  if (site) lines.push(center(site));
  return lines.length ? lines.join('\n') : '';
}

function orderToReceiptLines(order) {
  if (!order) return [];
  const lines = [];
  const orderNum = order.orderNumber ?? order.order_id ?? order._id ?? order.id ?? order.orderId ?? '';
  const customerName = (order.customerName ?? order.customer_name ?? order.customer?.name ?? order.customer?.firstName ?? '').toString().trim().toUpperCase();
  const orderLabel = orderNum ? `ORDER: #${String(orderNum).replace(/^#/, '')}${customerName ? ` FOR ${customerName}` : ''}` : '';
  if (orderLabel) lines.push(orderLabel);
  const dateStr = formatDate(order);
  if (dateStr) lines.push(`DATE: ${dateStr}`);
  lines.push('................................');
  lines.push(padRight('NUM ITEM', RECEIPT_WIDTH - 10) + 'AMT ($)');
  const items = order.items || order.lineItems || [];
  let itemCount = 0;
  items.forEach((item, idx) => {
    const num = String(idx + 1).padStart(2, '0');
    const name = (item.name ?? item.title ?? '').toString().trim().toUpperCase();
    const price = formatPrice(item.price ?? item.total ?? item.amount);
    itemCount += Number(item.quantity ?? item.qty ?? 1) || 1;
    const namePart = `${num} ${name}`;
    const pricePart = price ? price.padStart(8) : '';
    lines.push(padRight(namePart, RECEIPT_WIDTH - 10) + pricePart);
    const modifiers = item.modifiers ?? item.toppings ?? item.options ?? [];
    if (Array.isArray(modifiers) && modifiers.length) {
      modifiers.forEach((m) => {
        const modName = (typeof m === 'string' ? m : (m && m.name) || '').toString().trim().toUpperCase();
        if (modName) lines.push('   ' + modName);
      });
    } else if (item.options && typeof item.options === 'string') {
      lines.push('   ' + String(item.options).trim().toUpperCase());
    }
  });
  lines.push('................................');
  const totalCount = order.itemCount ?? items.length ?? itemCount;
  lines.push(padRight(`ITEM COUNT`, RECEIPT_WIDTH - 10) + String(totalCount).padStart(8));
  const total = order.total != null ? formatPrice(order.total) : '';
  if (total) lines.push(padRight('TOTAL', RECEIPT_WIDTH - 10) + '$ ' + total.padStart(6));
  lines.push('................................');
  const cardLast4 = order.cardLast4 ?? order.card_last4 ?? order.payment?.last4;
  if (cardLast4 != null) lines.push(`CARD #: **** **** **** ${String(cardLast4).slice(-4)}`);
  const authNum = order.authNumber ?? order.auth_number ?? order.authorizationNumber ?? order.payment?.authNumber;
  if (authNum != null) lines.push(`AUTH #: ${authNum}`);
  const userId = order.userId ?? order.user_id ?? order.cashierName ?? order.payment?.userId;
  if (userId != null) lines.push(`USERID: ${String(userId).toUpperCase()}`);
  return lines;
}

function buildReceipt(orderOrLines) {
  const data = orderOrLines && typeof orderOrLines === 'object' && !Array.isArray(orderOrLines) ? orderOrLines : {};
  const header = buildHeader(data);
  let body;
  if (orderOrLines && typeof orderOrLines === 'object' && !Array.isArray(orderOrLines)) {
    if (orderOrLines.lines?.length) body = orderOrLines.lines.join('\n');
    else if (orderOrLines.receipt_lines?.length) body = orderOrLines.receipt_lines.join('\n');
    else if (orderOrLines.receiptLines?.length) body = orderOrLines.receiptLines.join('\n');
    else if (orderOrLines.text) body = orderOrLines.text;
    else body = orderToReceiptLines(orderOrLines).join('\n');
  } else if (Array.isArray(orderOrLines) && orderOrLines.length) {
    body = orderOrLines.join('\n');
  } else {
    body = '(no content)';
  }
  const footer = buildFooter(data);
  const parts = [header, body, footer].filter(Boolean);
  return parts.join('\n\n');
}

module.exports = { buildReceipt, buildHeader, buildFooter, orderToReceiptLines };
