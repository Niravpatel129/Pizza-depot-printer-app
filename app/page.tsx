"use client";

import {
    connectPrinter,
    connectPrinterUSB,
    getPrinterIP,
    listPrinters,
    printReceipt,
    setApiBase,
    testPrint,
} from "@/lib/receiptPrinter";
import { formatReceiptFromOrder } from "@/lib/receiptTemplate";
import { useState } from "react";

const SAMPLE_ORDER = {
  businessName: "Sample Cafe",
  address: "123 Main St, City",
  orderNumber: "ORD-2024-001",
  dateTime: new Date().toLocaleString(),
  items: [
    { name: "Coffee", quantity: 2, price: 3.5 },
    { name: "Croissant", quantity: 1, price: 4.0 },
    { name: "Orange Juice", quantity: 1, price: 2.5 },
  ],
  paymentMethod: "Card ****1234",
  thankYouMessage: "Thank you for your order!",
};

export default function Home() {
  const [connectionMode, setConnectionMode] = useState<"usb" | "ethernet">("usb");
  const [usbPrinters, setUsbPrinters] = useState<string[]>([]);
  const [selectedUsbPrinter, setSelectedUsbPrinter] = useState("");
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [printerIP, setPrinterIPState] = useState("192.168.1.200");
  const [subnet, setSubnet] = useState("192.168.1");
  const [foundPrinters, setFoundPrinters] = useState<string[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [printerDebug, setPrinterDebug] = useState<string | null>(null);

  const showMsg = (text: string, err = false) => {
    setMessage(text);
    setIsError(err);
  };

  const isDeployed = typeof window !== "undefined" && !["localhost", "127.0.0.1"].includes(window.location.hostname);

  const handleLoadPrinters = async () => {
    setApiBase("/api");
    setLoadingPrinters(true);
    setPrinterDebug(null);
    showMsg("Loading printers…");
    try {
      const { printers: list, debug } = await listPrinters();
      setUsbPrinters(list);
      if (list.length === 0) {
        if (debug) setPrinterDebug(debug);
        showMsg(
          isDeployed
            ? "No printers on this server. Run the app locally (same machine as the printer) for USB printing."
            : "No system printers found. Add a printer in System Settings (Mac) or Settings → Devices (Windows), then try again.",
          true
        );
      } else {
        showMsg(`Found ${list.length} printer(s). Select one below.`);
        if (!selectedUsbPrinter && list[0]) setSelectedUsbPrinter(list[0]);
      }
    } catch (e) {
      showMsg(e instanceof Error ? e.message : "Failed to list printers", true);
    } finally {
      setLoadingPrinters(false);
    }
  };

  const handleSelectUsb = () => {
    if (!selectedUsbPrinter) {
      showMsg("Select a printer from the list first.", true);
      return;
    }
    setApiBase("/api");
    try {
      connectPrinterUSB(selectedUsbPrinter);
      showMsg(`Using USB printer: ${selectedUsbPrinter}`);
    } catch (e) {
      showMsg(e instanceof Error ? e.message : "Invalid printer", true);
    }
  };

  const handleDiscover = async () => {
    setDiscovering(true);
    setFoundPrinters([]);
    showMsg("Scanning network…");
    try {
      const res = await fetch(
        `/api/discover?subnet=${encodeURIComponent(subnet.trim())}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Discovery failed");
      setFoundPrinters(data.printers ?? []);
      if ((data.printers as string[]).length === 0)
        showMsg("No printers found on port 9100.", true);
      else
        showMsg(
          `Found ${(data.printers as string[]).length} printer(s). Click one to use.`
        );
    } catch (e) {
      showMsg(e instanceof Error ? e.message : "Discovery failed", true);
    } finally {
      setDiscovering(false);
    }
  };

  const selectEthernetPrinter = (ip: string) => {
    setPrinterIPState(ip);
    setApiBase("/api");
    try {
      connectPrinter(ip);
      setConnectionMode("ethernet");
      showMsg(`Using Ethernet printer at ${ip}`);
    } catch {
      // ignore
    }
  };

  const handleConnectEthernet = () => {
    setApiBase("/api");
    const ip = printerIP.trim();
    if (!ip) {
      showMsg("Enter printer IP.", true);
      return;
    }
    try {
      connectPrinter(ip);
      setConnectionMode("ethernet");
      showMsg(`Connected to printer at ${getPrinterIP()}`);
    } catch (e) {
      showMsg(e instanceof Error ? e.message : "Invalid IP", true);
    }
  };

  const ensureTarget = () => {
    setApiBase("/api");
    if (connectionMode === "usb") {
      if (selectedUsbPrinter) connectPrinterUSB(selectedUsbPrinter);
    } else if (printerIP.trim()) {
      connectPrinter(printerIP.trim());
    }
  };

  const handleTest = async () => {
    try {
      ensureTarget();
    } catch (e) {
      showMsg(e instanceof Error ? e.message : "Invalid printer", true);
      return;
    }
    setBusy(true);
    showMsg("Sending test receipt…");
    try {
      await testPrint();
      showMsg("Test receipt sent.");
    } catch (e) {
      showMsg(
        e instanceof Error ? e.message : "Test print failed",
        true
      );
    } finally {
      setBusy(false);
    }
  };

  const handleOrder = async () => {
    try {
      ensureTarget();
    } catch (e) {
      showMsg(e instanceof Error ? e.message : "Invalid printer", true);
      return;
    }
    setBusy(true);
    showMsg("Printing receipt…");
    try {
      const data = formatReceiptFromOrder(SAMPLE_ORDER);
      await printReceipt(data);
      showMsg("Receipt printed.");
    } catch (e) {
      showMsg(e instanceof Error ? e.message : "Print failed", true);
    } finally {
      setBusy(false);
    }
  };

  const hasTarget =
    connectionMode === "usb"
      ? selectedUsbPrinter
      : getPrinterIP() || printerIP.trim();

  return (
    <div className="mx-auto max-w-lg px-4 py-8 font-sans">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Thermal receipt printer
      </h1>
      <p className="mt-1 text-zinc-600 dark:text-zinc-400">
        USB first, Ethernet backup. Epson TM-T88IV.
      </p>
      {isDeployed && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          You’re on a deployed site. Printing only works when this app runs on the same machine or network as the printer (e.g. <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/50">npm run dev</code> on your computer).
        </p>
      )}

      <div className="mt-4 flex gap-0">
        <button
          type="button"
          onClick={() => setConnectionMode("usb")}
          className={`rounded-l-lg border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-600 ${
            connectionMode === "usb"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
          }`}
        >
          USB
        </button>
        <button
          type="button"
          onClick={() => setConnectionMode("ethernet")}
          className={`rounded-r-lg border border-zinc-300 border-l-0 px-4 py-2 text-sm font-medium dark:border-zinc-600 ${
            connectionMode === "ethernet"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
          }`}
        >
          Ethernet (backup)
        </button>
      </div>

      {connectionMode === "usb" && (
        <section className="mt-6">
          <label className="block font-medium text-zinc-900 dark:text-zinc-50">
            USB printer (system)
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleLoadPrinters}
              disabled={loadingPrinters || busy}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {loadingPrinters ? "Loading…" : "Load printers"}
            </button>
          </div>
          {usbPrinters.length > 0 && (
            <>
              <select
                value={selectedUsbPrinter}
                onChange={(e) => setSelectedUsbPrinter(e.target.value)}
                className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="">Select printer</option>
                {usbPrinters.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleSelectUsb}
                disabled={busy}
                className="mt-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Use this printer
              </button>
            </>
          )}
          {printerDebug && (
            <details className="mt-2 rounded border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-800/50">
              <summary className="cursor-pointer text-xs font-medium text-zinc-600 dark:text-zinc-400">
                System printer check output
              </summary>
              <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all text-xs text-zinc-600 dark:text-zinc-400">
                {printerDebug}
              </pre>
            </details>
          )}
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Uses system printers (e.g. TM-T88IV over USB). Add the printer in System Settings → Printers &amp; Scanners (Mac) or Settings → Bluetooth &amp; devices → Printers (Windows) first.
          </p>
        </section>
      )}

      {connectionMode === "ethernet" && (
        <section className="mt-6">
          <label className="block font-medium text-zinc-900 dark:text-zinc-50">
            Ethernet printer (backup)
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              type="text"
              value={subnet}
              onChange={(e) => setSubnet(e.target.value)}
              placeholder="192.168.1"
              className="min-w-[120px] flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <button
              type="button"
              onClick={handleDiscover}
              disabled={discovering || busy}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {discovering ? "Scanning…" : "Find printers"}
            </button>
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Scans subnet for port 9100.
          </p>
          {foundPrinters.length > 0 && (
            <ul className="mt-2 list-inside list-disc pl-2">
              {foundPrinters.map((ip) => (
                <li key={ip}>
                  <button
                    type="button"
                    onClick={() => selectEthernetPrinter(ip)}
                    className="text-sm text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    {ip}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <label className="mt-4 block font-medium text-zinc-900 dark:text-zinc-50">
            Or enter IP
          </label>
          <input
            type="text"
            value={printerIP}
            onChange={(e) => setPrinterIPState(e.target.value)}
            placeholder="192.168.1.200"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <button
            type="button"
            onClick={handleConnectEthernet}
            disabled={busy}
            className="mt-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Connect
          </button>
        </section>
      )}

      <section className="mt-8">
        <label className="block font-medium text-zinc-900 dark:text-zinc-50">
          Print
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleTest}
            disabled={busy || !hasTarget}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Print test receipt
          </button>
          <button
            type="button"
            onClick={handleOrder}
            disabled={busy || !hasTarget}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Print sample order
          </button>
        </div>
        {!hasTarget && (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Select a USB printer or connect via Ethernet first.
          </p>
        )}
      </section>

      {message != null && (
        <div
          className={`mt-4 rounded-lg px-3 py-2 text-sm ${
            isError
              ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200"
              : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200"
          }`}
        >
          {message}
        </div>
      )}
    </div>
  );
}
