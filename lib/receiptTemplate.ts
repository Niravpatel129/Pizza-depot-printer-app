import type { ReceiptData } from "./escpos";

export interface OrderInput {
  businessName?: string;
  address?: string;
  orderNumber?: string | number;
  id?: string | number;
  dateTime?: string;
  items?: Array<{ name?: string; title?: string; quantity?: number; price?: number }>;
  taxRate?: number;
  paymentMethod?: string;
  thankYouMessage?: string;
}

export function formatReceiptFromOrder(order: OrderInput): ReceiptData {
  const items = (order.items ?? []).map((i) => ({
    name: i.name ?? i.title,
    quantity: i.quantity ?? 1,
    price: i.price ?? 0,
  }));
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.price, 0);
  const taxRate = order.taxRate != null ? Number(order.taxRate) : 0;
  const tax = subtotal * taxRate;
  const total = subtotal + tax;

  return {
    businessName: order.businessName ?? "My Business",
    address: order.address ?? "123 Main St",
    orderNumber: order.orderNumber ?? order.id ?? "N/A",
    dateTime: order.dateTime ?? new Date().toLocaleString(),
    items,
    subtotal: Number(subtotal.toFixed(2)),
    tax: Number(tax.toFixed(2)),
    total: Number(total.toFixed(2)),
    paymentMethod: order.paymentMethod ?? "Cash",
    thankYouMessage: order.thankYouMessage ?? "Thank you for your business!",
  };
}
