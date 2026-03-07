# Releasing Windows builds

1. Update version in `package.json` if needed.
2. Commit, push, then create and push a tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
3. The **Release Windows** GitHub Action will build the app for Windows and attach the installer (`.exe`) and portable zip to the new release.
4. Users download from your repo’s **Releases** page (e.g. `https://github.com/YOUR_USERNAME/printer-software/releases`).
