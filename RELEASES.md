# Releasing Windows builds

**Automatic (on push to main):**
1. Bump `version` in `package.json` (e.g. `1.0.0` → `1.0.1`).
2. Commit and push to `main` (or `master`).
3. The **Auto tag** workflow creates tag `v1.0.1` and pushes it; **Release Windows** then builds and uploads the `.exe` and `.zip` to that release.
4. Users download from the repo’s **Releases** page.

**Manual:** Push a tag yourself, e.g. `git tag v1.0.0 && git push origin v1.0.0`; the release workflow will run and attach the Windows build.

## If Windows setup says "Installation has failed"

The installer uses Squirrel.Windows, which shares `%LocalAppData%\SquirrelTemp` with other Squirrel apps (e.g. Discord). Leftover files there can make the wrong app install or the install fail.

**Try:**
1. Close any other Squirrel-based apps (Discord, Slack, etc.).
2. Delete the folder `%LocalAppData%\SquirrelTemp` (or `C:\Users\<you>\AppData\Local\SquirrelTemp`).
3. Run `Printer Agent-X.X.X Setup.exe` again. Optionally right‑click → **Run as administrator**.
4. If you use antivirus, temporarily allow or exclude the install folder and retry.
