import { exec } from "child_process";
import { promisify } from "util";
import os from "os";

const execAsync = promisify(exec);

const isCloud =
  process.env.VERCEL === "1" ||
  process.env.AWS_LAMBDA_FUNCTION_NAME != null ||
  process.env.KUBERNETES_SERVICE_HOST != null;

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
  if (isCloud) {
    return Response.json({
      ok: true,
      printers: [],
      debug: "Printers are only available when running the app locally (same machine as the printer).",
    });
  }

  const platform = os.platform();
  try {
    if (platform === "darwin" || platform === "linux") {
      const lpstat = "lpstat";
      let names: string[] = [];
      let debug = "";

      try {
        const { stdout } = await execAsync(`${lpstat} -p 2>&1`, { maxBuffer: 4096 });
        debug = stdout.trim() || "(no output)";
        names = parseLpstatP(stdout);
      } catch (e) {
        const err = e as { stdout?: string; stderr?: string };
        const raw = [err.stdout, err.stderr].filter(Boolean).join("\n").trim();
        debug = raw || (e instanceof Error ? e.message : "lpstat failed");
        if (raw && (raw.includes("No such file") || raw.includes("not found"))) {
          debug = "Printer list not available in this environment. Run the app on your computer for USB printing.";
        }
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
