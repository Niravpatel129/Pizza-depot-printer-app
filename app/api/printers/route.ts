import { exec } from "child_process";
import { promisify } from "util";
import os from "os";

const execAsync = promisify(exec);

function parseLpstatP(stdout: string): string[] {
  const names: string[] = [];
  for (const line of stdout.split("\n")) {
    const m = line.match(/^printer\s+(\S+)\s+/i);
    if (m) names.push(m[1]);
  }
  return names;
}

function parseLpstatA(stdout: string): string[] {
  const names: string[] = [];
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("accepting")) continue;
    const first = trimmed.split(/\s+/)[0];
    if (first && first !== "Printer") names.push(first);
  }
  return names;
}

export async function GET() {
  const platform = os.platform();
  try {
    if (platform === "darwin" || platform === "linux") {
      const lpstat = "/usr/bin/lpstat";
      let names: string[] = [];
      let debug = "";

      try {
        const { stdout } = await execAsync(`${lpstat} -p 2>&1`, { maxBuffer: 4096 });
        debug = stdout.trim() || "(no output)";
        names = parseLpstatP(stdout);
      } catch (e) {
        const err = e as { stdout?: string; stderr?: string };
        debug = [err.stdout, err.stderr].filter(Boolean).join("\n").trim() || (e instanceof Error ? e.message : "lpstat failed");
      }

      if (names.length === 0) {
        try {
          const { stdout } = await execAsync(`${lpstat} -a 2>&1`, { maxBuffer: 4096 });
          const fromA = parseLpstatA(stdout);
          fromA.forEach((n) => {
            if (!names.includes(n)) names.push(n);
          });
        } catch {
          // ignore
        }
      }

      return Response.json({
        ok: true,
        printers: names,
        ...(names.length === 0 && debug ? { debug } : {}),
      });
    }
    if (platform === "win32") {
      let names: string[] = [];
      let debug = "";
      try {
        const { stdout } = await execAsync("wmic printer get name /format:csv", {
          encoding: "utf8",
          maxBuffer: 1024 * 1024,
        });
        debug = stdout.slice(0, 500);
        names = stdout
          .split("\n")
          .map((s) => s.split(",")[1]?.trim())
          .filter((s): s is string => Boolean(s && s !== "Name"));
      } catch (e) {
        debug = e instanceof Error ? e.message : "wmic failed";
      }
      return Response.json({
        ok: true,
        printers: names,
        ...(names.length === 0 && debug ? { debug } : {}),
      });
    }
    return Response.json({ ok: true, printers: [] });
  } catch (err) {
    return Response.json(
      {
        ok: false,
        printers: [],
        message: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
