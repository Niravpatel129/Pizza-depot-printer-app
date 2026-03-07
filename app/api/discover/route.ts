import net from "net";

const PRINTER_PORT = 9100;
const CONNECT_TIMEOUT = 400;
const BATCH_SIZE = 50;

function checkPort(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (open: boolean) => {
      try {
        socket.destroy();
      } catch {
        // ignore
      }
      resolve(open);
    };
    socket.setTimeout(CONNECT_TIMEOUT);
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, host, () => done(true));
  });
}

async function scanSubnet(subnet: string): Promise<string[]> {
  const parts = subnet.trim().split(".");
  if (parts.length < 3 || parts.some((p) => p === "" || isNaN(Number(p)))) {
    return [];
  }
  const base = parts.slice(0, 3).join(".");
  const found: string[] = [];
  for (let i = 1; i < 255; i += BATCH_SIZE) {
    const batch: Promise<boolean>[] = [];
    for (let j = i; j < Math.min(i + BATCH_SIZE, 255); j++) {
      batch.push(checkPort(`${base}.${j}`, PRINTER_PORT));
    }
    const results = await Promise.all(batch);
    results.forEach((open, idx) => {
      if (open) found.push(`${base}.${i + idx}`);
    });
  }
  return found.sort((a, b) => {
    const [a1, a2, a3, a4] = a.split(".").map(Number);
    const [b1, b2, b3, b4] = b.split(".").map(Number);
    return a1 - b1 || a2 - b2 || a3 - b3 || a4 - b4;
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const subnet = searchParams.get("subnet") ?? "192.168.1";
  try {
    const printers = await scanSubnet(subnet);
    return Response.json({ ok: true, printers });
  } catch (err) {
    return Response.json(
      {
        ok: false,
        printers: [],
        message: err instanceof Error ? err.message : "Discovery failed",
      },
      { status: 500 }
    );
  }
}
