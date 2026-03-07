/**
 * Structured receipt payload. One source of truth for preview and print.
 * Backend sends orders; app can normalize to this shape.
 */
function normalizeReceiptJob(orderOrJob, config) {
  const order = orderOrJob && typeof orderOrJob === 'object' ? orderOrJob : {};
  const jobId = order._id ?? order.id ?? order.orderId ?? order.orderNumber ?? `job-${Date.now()}`;
  const profileId = config?.activePrinterProfileId ?? (config?.printerProfiles?.[0]?.id ?? '');
  return {
    jobId: String(jobId),
    printerProfileId: profileId || undefined,
    createdAt: order.createdAt ?? order.created_at ?? new Date().toISOString(),
    kind: 'receipt',
    receipt: {
      businessName: order.receiptStoreName ?? order.storeName ?? config?.receiptStoreName ?? '',
      orderNumber: String(order.orderNumber ?? order.order_id ?? order._id ?? order.id ?? order.orderId ?? ''),
      customerName: order.customerName ?? order.customer_name ?? order.customer?.name ?? '',
      notes: order.notes ?? '',
      items: (order.items || order.lineItems || []).map((item) => ({
        name: item.name ?? item.title ?? '',
        qty: Number(item.quantity ?? item.qty ?? 1) || 1,
        unitPrice: item.price ?? item.unitPrice,
        total: item.total ?? item.amount ?? (item.price != null && (item.quantity ?? item.qty) ? Number(item.price) * Number(item.quantity ?? item.qty) : undefined),
        modifiers: [].concat(item.modifiers ?? item.toppings ?? item.options ?? []).map((m) => (typeof m === 'string' ? m : (m && m.name) || '')),
      })),
      subtotal: order.subtotal,
      tax: order.tax,
      total: order.total,
      footer: order.receiptFooterMessage ?? order.footerMessage ?? config?.receiptFooterMessage ?? '',
      addressLine1: order.receiptAddressLine1 ?? order.addressLine1 ?? config?.receiptAddressLine1 ?? '',
      addressLine2: order.receiptAddressLine2 ?? order.addressLine2 ?? config?.receiptAddressLine2 ?? '',
      footerWebsite: order.receiptFooterWebsite ?? order.footerWebsite ?? config?.receiptFooterWebsite ?? '',
    },
    _raw: order,
  };
}

/**
 * Logical receipt row for deterministic layout. Convert to ESC-POS, plain text, or HTML.
 * type: 'text' | 'columns' | 'divider' | 'feed' | 'cut'
 */
function isReceiptRow(row) {
  return row && typeof row === 'object' && typeof row.type === 'string';
}

module.exports = { normalizeReceiptJob, isReceiptRow };
