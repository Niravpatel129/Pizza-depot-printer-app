import type { ReceiptData } from "./escpos";

const DEFAULT_API_BASE = "/api";

let connectionType: "usb" | "ethernet" = "usb";
let printerName: string | null = null;
let printerIP: string | null = null;
let apiBase = DEFAULT_API_BASE;

export function connectPrinter(ip: string): { ok: true; connectionType: "ethernet"; printerIP: string } {
  connectionType = "ethernet";
  printerName = null;
  const trimmed = String(ip).trim();
  if (!trimmed) throw new Error("Invalid printer IP");
  const parts = trimmed.split(".");
  if (
    parts.length !== 4 ||
    parts.some((p) => p === "" || isNaN(Number(p)) || Number(p) < 0 || Number(p) > 255)
  ) {
    throw new Error("Invalid printer IP address");
  }
  printerIP = trimmed;
  return { ok: true, connectionType: "ethernet", printerIP: printerIP };
}

export function connectPrinterUSB(name: string): { ok: true; connectionType: "usb"; printerName: string } {
  connectionType = "usb";
  printerIP = null;
  if (!name || String(name).trim() === "") throw new Error("Invalid printer name");
  printerName = String(name).trim();
  return { ok: true, connectionType: "usb", printerName };
}

export function getConnectionType(): "usb" | "ethernet" {
  return connectionType;
}

export function getPrinterIP(): string | null {
  return printerIP;
}

export function getPrinterName(): string | null {
  return printerName;
}

export function setApiBase(base: string): void {
  apiBase = base.replace(/\/$/, "") || DEFAULT_API_BASE;
}

async function request(path: string, body: object): Promise<{ ok: boolean; message?: string }> {
  const url = `${apiBase}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    message?: string;
    error?: string;
    code?: string;
  };
  if (!res.ok) {
    const err = new Error(data.message ?? data.error ?? `Request failed: ${res.status}`);
    (err as Error & { status?: number; code?: string }).status = res.status;
    (err as Error & { status?: number; code?: string }).code = data.code;
    throw err;
  }
  return { ok: data.ok ?? true, message: data.message };
}

function body(): { printerName?: string; printerIP?: string } {
  if (connectionType === "usb" && printerName) return { printerName };
  if (connectionType === "ethernet" && printerIP) return { printerIP };
  return {};
}

export async function printReceipt(data: ReceiptData): Promise<{ ok: boolean; message?: string }> {
  const b = body();
  if (!b.printerName && !b.printerIP) {
    throw new Error(
      "Printer not connected. Select a USB printer or set an Ethernet IP and connect."
    );
  }
  return request("/print", { ...b, data });
}

export async function testPrint(): Promise<{ ok: boolean; message?: string }> {
  const b = body();
  if (!b.printerName && !b.printerIP) {
    throw new Error(
      "Printer not connected. Select a USB printer or set an Ethernet IP and connect."
    );
  }
  return request("/test", b);
}

export async function listPrinters(): Promise<string[]> {
  const url = `${apiBase}/printers`;
  const res = await fetch(url);
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; printers?: string[]; message?: string };
  if (!res.ok) throw new Error(data.message ?? "Failed to list printers");
  return data.printers ?? [];
}
