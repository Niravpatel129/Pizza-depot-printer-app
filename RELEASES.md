# Releasing Windows builds

**Automatic (on push to main):**
1. Bump `version` in `package.json` (e.g. `1.0.0` → `1.0.1`).
2. Commit and push to `main` (or `master`).
3. The **Auto tag** workflow creates tag `v1.0.1` and pushes it; **Release Windows** then builds and uploads the `.exe` and `.zip` to that release.
4. Users download from the repo’s **Releases** page.

**Manual:** Push a tag yourself, e.g. `git tag v1.0.0 && git push origin v1.0.0`; the release workflow will run and attach the Windows build.
