import net from "net";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

const PRINTER_PORT = 9100;
const CONNECT_TIMEOUT = 8000;
const WRITE_TIMEOUT = 5000;

export function sendToPrinter(host: string, buffer: Buffer): Promise<{ ok: true }> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let resolved = false;
    const done = (err: Error | null, result?: { ok: true }) => {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      if (err) reject(err);
      else resolve(result ?? { ok: true });
    };
    socket.setTimeout(CONNECT_TIMEOUT);
    socket.on("timeout", () => done(new Error("Connection timeout")));
    socket.on("error", (err) => done(err));
    socket.connect(PRINTER_PORT, host, () => {
      socket.setTimeout(WRITE_TIMEOUT);
      socket.write(buffer, (err) => {
        if (err) return done(err);
        done(null, { ok: true });
      });
    });
  });
}

export function sendToPrinterUSB(printerName: string, buffer: Buffer): Promise<{ ok: true }> {
  const platform = os.platform();
  if (platform === "darwin" || platform === "linux") {
    const tmp = path.join(os.tmpdir(), `receipt-${Date.now()}.bin`);
    return new Promise((resolve, reject) => {
      fs.writeFile(tmp, buffer, (err) => {
        if (err) return reject(err);
        const lp = spawn("lp", ["-d", printerName, "-o", "raw", tmp], {
          stdio: ["ignore", "pipe", "pipe"],
        });
        let stderr = "";
        lp.stderr?.on("data", (d) => {
          stderr += d.toString();
        });
        lp.on("close", (code) => {
          fs.unlink(tmp, () => {});
          if (code === 0) resolve({ ok: true });
          else reject(new Error(stderr || `lp exited with code ${code}`));
        });
        lp.on("error", (e) => {
          fs.unlink(tmp, () => {});
          reject(e);
        });
      });
    });
  }
  if (platform === "win32") {
    const tmp = path.join(os.tmpdir(), `receipt-${Date.now()}.bin`);
    return new Promise((resolve, reject) => {
      fs.writeFile(tmp, buffer, (err) => {
        if (err) return reject(err);
        const escaped = printerName.replace(/"/g, '`"');
        const cmd = `Get-Content -Path "${tmp}" -Raw -Encoding Byte | Out-Printer -Name "${escaped}"`;
        const ps = spawn("powershell", ["-NoProfile", "-Command", cmd], {
          stdio: ["ignore", "pipe", "pipe"],
        });
        let stderr = "";
        ps.stderr?.on("data", (d) => {
          stderr += d.toString();
        });
        ps.on("close", (code) => {
          fs.unlink(tmp, () => {});
          if (code === 0) resolve({ ok: true });
          else reject(new Error(stderr || `Print failed (code ${code})`));
        });
        ps.on("error", (e) => {
          fs.unlink(tmp, () => {});
          reject(e);
        });
      });
    });
  }
  return Promise.reject(new Error("USB printing not supported on this OS"));
}

export function parsePrinterIP(body: { printerIP?: string; ip?: string } | null): string | null {
  const ip = body?.printerIP ?? body?.ip;
  if (!ip || typeof ip !== "string") return null;
  const trimmed = ip.trim();
  const parts = trimmed.split(".");
  if (parts.length !== 4) return null;
  if (parts.some((p) => p === "" || isNaN(Number(p)) || Number(p) < 0 || Number(p) > 255))
    return null;
  return trimmed;
}

export function parsePrinterName(body: { printerName?: string; printer?: string } | null): string | null {
  const name = body?.printerName ?? body?.printer;
  if (!name || typeof name !== "string") return null;
  return name.trim();
}
