import './index.css';
import { mountSettings } from './renderer/views/settings';

const views = { settings: mountSettings };

function mount() {
  const viewName = document.body.dataset.view || 'settings';
  const mountView = views[viewName];
  const appEl = document.getElementById('app-root') || document.body;
  const container = appEl.querySelector('.app') || appEl;
  function showPreloadWarning() {
    const existing = document.getElementById('preload-warning');
    if (existing) return;
    const warn = document.createElement('p');
    warn.id = 'preload-warning';
    warn.style.cssText = 'padding:16px;margin:16px;background:#fee2e2;color:#b91c1c;border-radius:8px;';
    warn.textContent = 'Printer Agent API not available. Preload may not have run — Settings and Refresh will not work. Run the app with npm start (Electron), not by opening the HTML file in a browser.';
    container.prepend(warn);
  }
  if (typeof window.printerAgent === 'undefined') {
    requestAnimationFrame(() => {
      if (typeof window.printerAgent === 'undefined') {
        showPreloadWarning();
        return;
      }
      if (mountView) mountView();
    });
    return;
  }
  if (mountView) mountView();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
