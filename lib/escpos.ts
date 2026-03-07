const ESC = "\x1b";
const GS = "\x1d";

export const commands = {
  INIT: ESC + "@",
  ALIGN_LEFT: ESC + "a" + "\x00",
  ALIGN_CENTER: ESC + "a" + "\x01",
  ALIGN_RIGHT: ESC + "a" + "\x02",
  BOLD_ON: ESC + "E" + "\x01",
  BOLD_OFF: ESC + "E" + "\x00",
  CUT: GS + "V" + "\x00",
  CUT_FEED: GS + "V" + "\x01",
  SEPARATOR: "\n" + "-".repeat(42) + "\n",
  LF: "\n",
};

export interface ReceiptData {
  businessName?: string;
  address?: string;
  orderNumber?: string | number;
  dateTime?: string;
  items?: Array<{ name?: string; title?: string; quantity?: number; price?: number }>;
  subtotal?: number;
  tax?: number;
  total?: number;
  paymentMethod?: string;
  thankYouMessage?: string;
}

export function buildEscposFromReceiptData(data: ReceiptData): Buffer {
  const buffers: Buffer[] = [];
  const push = (str: string) => buffers.push(Buffer.from(str, "utf8"));

  push(commands.INIT);
  push(commands.ALIGN_CENTER);
  push(commands.BOLD_ON);
  push((data.businessName ?? "").trim() + commands.LF);
  push(commands.BOLD_OFF);
  if (data.address) push(data.address.trim() + commands.LF);
  push(commands.LF);

  push(commands.ALIGN_LEFT);
  push(commands.SEPARATOR);
  if (data.orderNumber != null) push(`Order #${data.orderNumber}` + commands.LF);
  if (data.dateTime) push(`Date: ${data.dateTime}` + commands.LF);
  push(commands.SEPARATOR);

  if (data.items?.length) {
    for (const item of data.items) {
      const name = (item.name ?? item.title ?? "").toString();
      const qty = item.quantity ?? 1;
      const price = item.price ?? 0;
      const lineTotal = (qty * price).toFixed(2);
      const left = name.length > 28 ? name.slice(0, 25) + "..." : name;
      const right = `${qty} x ${price.toFixed(2)} = ${lineTotal}`;
      const padding = Math.max(0, 42 - left.length - right.length);
      push(left + " ".repeat(padding) + right + commands.LF);
    }
  }

  push(commands.SEPARATOR);
  if (data.subtotal != null) push(`Subtotal: ${Number(data.subtotal).toFixed(2)}` + commands.LF);
  if (data.tax != null) push(`Tax: ${Number(data.tax).toFixed(2)}` + commands.LF);
  push(commands.BOLD_ON);
  if (data.total != null) push(`Total: ${Number(data.total).toFixed(2)}` + commands.LF);
  push(commands.BOLD_OFF);
  if (data.paymentMethod) push(`Payment: ${data.paymentMethod}` + commands.LF);
  push(commands.SEPARATOR);

  push(commands.ALIGN_CENTER);
  push(commands.LF);
  push((data.thankYouMessage ?? "Thank you for your business!") + commands.LF);
  push(commands.LF);
  push(commands.CUT_FEED);

  return Buffer.concat(buffers);
}

export function buildTestReceiptEscpos(): Buffer {
  return buildEscposFromReceiptData({
    businessName: "Test Receipt",
    address: "Printer OK",
    orderNumber: "TEST-001",
    dateTime: new Date().toLocaleString(),
    items: [{ name: "Test Item", quantity: 1, price: 0.01 }],
    subtotal: 0.01,
    tax: 0,
    total: 0.01,
    paymentMethod: "Test",
    thankYouMessage: "Connection test successful.",
  });
}
