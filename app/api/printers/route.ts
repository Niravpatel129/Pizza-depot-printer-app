import { exec } from "child_process";
import { promisify } from "util";
import os from "os";

const execAsync = promisify(exec);

export async function GET() {
  const platform = os.platform();
  try {
    if (platform === "darwin" || platform === "linux") {
      const { stdout } = await execAsync("lpstat -p 2>/dev/null || true");
      const names: string[] = [];
      for (const line of stdout.split("\n")) {
        const m = line.match(/^printer\s+(\S+)\s+/i);
        if (m) names.push(m[1]);
      }
      return Response.json({ ok: true, printers: names });
    }
    if (platform === "win32") {
      const { stdout } = await execAsync("wmic printer get name /format:csv", {
        encoding: "utf8",
        maxBuffer: 1024 * 1024,
      });
      const names = stdout
        .split("\n")
        .map((s) => s.split(",")[1]?.trim())
        .filter((s): s is string => Boolean(s && s !== "Name"));
      return Response.json({ ok: true, printers: names });
    }
    return Response.json({ ok: true, printers: [] });
  } catch (err) {
    return Response.json(
      { ok: false, printers: [], message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
