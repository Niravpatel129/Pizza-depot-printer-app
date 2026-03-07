import { buildTestReceiptEscpos } from "@/lib/escpos";
import {
  sendToPrinter,
  sendToPrinterUSB,
  parsePrinterIP,
  parsePrinterName,
} from "@/lib/sendToPrinter";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      printerIP?: string;
      printerName?: string;
      printer?: string;
    };
    const buffer = buildTestReceiptEscpos();
    const printerName = parsePrinterName(body);
    if (printerName) {
      await sendToPrinterUSB(printerName, buffer);
      return Response.json({ ok: true, message: "Test receipt sent (USB)" });
    }
    const printerIP = parsePrinterIP(body);
    if (printerIP) {
      await sendToPrinter(printerIP, buffer);
      return Response.json({ ok: true, message: "Test receipt sent (Ethernet)" });
    }
    return Response.json(
      {
        ok: false,
        code: "NO_TARGET",
        message: "Provide printerName (USB) or printerIP (Ethernet)",
      },
      { status: 400 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Test print failed";
    const code =
      err instanceof Error && "code" in err
        ? (err.code as string)
        : message.includes("timeout")
          ? "TIMEOUT"
          : "PRINTER_ERROR";
    return Response.json({ ok: false, code, message }, { status: 500 });
  }
}
