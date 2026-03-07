const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');

function getRepoFromPackage() {
  const readPkg = (dir) => {
    try {
      const p = path.join(dir, 'package.json');
      if (!fs.existsSync(p)) return null;
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch {
      return null;
    }
  };
  const roots = [app.getAppPath()];
  if (!app.isPackaged) {
    roots.push(process.cwd(), path.resolve(__dirname, '../..'));
  }
  let pkg = null;
  for (const root of roots) {
    pkg = readPkg(root);
    if (pkg?.repository) break;
  }
  if (!pkg?.repository) return null;
  const repo = pkg.repository;
  const url = typeof repo === 'string' ? repo : repo.url || '';
  const m = url.match(/github\.com[/:]([^/]+)\/([^/.]+)(?:\.git)?$/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

function fetchLatestRelease(owner, repo) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      `https://api.github.com/repos/${owner}/${repo}/releases/latest`,
      { headers: { 'User-Agent': 'Printer-Agent-Updater', Accept: 'application/vnd.github.v3+json' } },
      (res) => {
        if (res.statusCode === 404) {
          resolve(null);
          return;
        }
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            resolve(data ? JSON.parse(data) : null);
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Request timeout')); });
  });
}

function initAutoUpdater(ipcMain, sendToWindows) {
  ipcMain.handle('get-app-version', () => Promise.resolve(app.getVersion()));

  const repo = getRepoFromPackage();
  if (!repo) {
    ipcMain.handle('check-for-updates', async () => ({ error: 'Updates not configured' }));
    ipcMain.handle('download-update', async () => ({ error: 'Not available' }));
    return;
  }

  const { autoUpdater } = require('electron-updater');
  autoUpdater.autoDownload = false;
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: repo.owner,
    repo: repo.repo,
  });

  const send = (channel, payload) => {
    try {
      sendToWindows(channel, payload);
    } catch (e) {
      console.warn('Updater send:', e);
    }
  };

  autoUpdater.on('download-progress', (p) => send('update-status', { status: 'downloading', progress: p }));
  autoUpdater.on('update-downloaded', () => send('update-status', { status: 'downloaded' }));
  autoUpdater.on('error', (err) => send('update-status', { status: 'error', error: String(err.message) }));

  ipcMain.handle('check-for-updates', async () => {
    send('update-status', { status: 'checking' });
    try {
      const release = await fetchLatestRelease(repo.owner, repo.repo);
      if (release?.tag_name) {
        const latest = release.tag_name.replace(/^v/, '');
        const current = app.getVersion();
        if (latest !== current) {
          send('update-status', { status: 'available', info: { version: latest } });
          return { version: latest };
        }
      }
      send('update-status', { status: 'not-available' });
      return {};
    } catch (err) {
      send('update-status', { status: 'error', error: err?.message || 'Update check failed' });
      return { error: err?.message || String(err) };
    }
  });

  ipcMain.handle('download-update', async () => {
    try {
      const check = Promise.race([
        autoUpdater.checkForUpdates(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('Timed out')), 20000)),
      ]);
      await check;
      await autoUpdater.downloadUpdate();
      return {};
    } catch (err) {
      return { error: err?.message || String(err) };
    }
  });

  ipcMain.on('quit-and-install', () => {
    autoUpdater.quitAndInstall(false, true);
  });
}

module.exports = { initAutoUpdater };
