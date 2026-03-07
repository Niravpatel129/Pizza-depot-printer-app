import { onConfig, saveConfig, getStatus, setPaused, onPrintQueueUpdate, onLog, onLogHistory } from '../api';

function renderStatus(status) {
  const pill = document.getElementById('statusPill');
  const text = document.getElementById('statusText');
  const meta = document.getElementById('statusMeta');
  if (!pill || !text || !meta) return;
  const { connected, paused, queueLength, lastPrintedAt } = status || {};
  pill.className = 'status-pill ' + (connected ? 'connected' : 'disconnected');
  text.textContent = connected ? 'Connected' : 'Disconnected';
  const parts = [`${queueLength ?? 0} in queue`];
  if (lastPrintedAt) parts.push(`Last: ${new Date(lastPrintedAt).toLocaleTimeString()}`);
  meta.textContent = parts.join(' · ');
}

function renderQueue(queue) {
  const list = document.getElementById('queueList');
  const empty = document.getElementById('queueEmpty');
  if (!list || !empty) return;
  const items = queue || [];
  list.innerHTML = '';
  if (items.length === 0) {
    list.style.display = 'none';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  list.style.display = 'block';
  items.forEach((item, i) => {
    const li = document.createElement('li');
    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = `${i + 1}.`;
    const label = document.createElement('span');
    label.textContent = item.label || `#${item.id}`;
    li.appendChild(num);
    li.appendChild(label);
    list.appendChild(li);
  });
}

function syncPauseSwitch() {
  const checkbox = document.getElementById('paused');
  const sw = document.getElementById('pausedSwitch');
  if (!sw || !checkbox) return;
  sw.classList.toggle('checked', checkbox.checked);
  sw.setAttribute('aria-checked', String(checkbox.checked));
}

function formatLogTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
  } catch {
    return '';
  }
}

function appendLogEntry(entry, container) {
  if (!container) return;
  const { level, time, message } = entry || {};
  const line = document.createElement('div');
  line.className = 'line ' + (level || 'log');
  const ts = formatLogTime(time);
  line.innerHTML = `<span class="ts">${ts}</span><span class="lvl ${level || 'log'}">${(level || 'log').toUpperCase()}</span> ${escapeHtml(message || '')}`;
  container.appendChild(line);
  container.scrollTop = container.scrollHeight;
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function renderLogHistory(entries, container) {
  if (!container) return;
  container.innerHTML = '';
  (entries || []).forEach((e) => appendLogEntry(e, container));
  container.scrollTop = container.scrollHeight;
}

export function mountSettings() {
  onConfig((data) => {
    const { config, printers = [] } = data || {};
    const select = document.getElementById('printer');
    if (select) {
      select.innerHTML = '<option value="">System default</option>';
      printers.forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p.name;
        opt.textContent = p.displayName || p.name || p.description;
        select.appendChild(opt);
      });
      select.value = config?.printer || '';
    }
    const backendUrl = document.getElementById('backendUrl');
    const serverPort = document.getElementById('serverPort');
    if (backendUrl) backendUrl.value = config?.backendUrl || '';
    if (serverPort) serverPort.value = config?.port ?? 3847;
  });
  const saveBtn = document.getElementById('save');
  if (saveBtn) {
    saveBtn.onclick = () => {
      const select = document.getElementById('printer');
      const backendUrl = document.getElementById('backendUrl');
      const serverPort = document.getElementById('serverPort');
      const port = serverPort ? parseInt(serverPort.value, 10) : 3847;
      saveConfig({
        printer: select ? select.value.trim() : '',
        backendUrl: backendUrl ? backendUrl.value.trim() : '',
        port: Number.isFinite(port) ? port : 3847,
      });
    };
  }
  const pausedEl = document.getElementById('paused');
  const switchEl = document.getElementById('pausedSwitch');
  if (switchEl && pausedEl) {
    switchEl.addEventListener('click', () => {
      pausedEl.checked = !pausedEl.checked;
      setPaused(pausedEl.checked);
      syncPauseSwitch();
    });
    switchEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        switchEl.click();
      }
    });
  }
  onPrintQueueUpdate((data) => {
    if (data.queue) renderQueue(data.queue);
    if (data.status) {
      renderStatus(data.status);
      if (pausedEl) {
        pausedEl.checked = !!data.status.paused;
        syncPauseSwitch();
      }
    }
  });
  getStatus().then((s) => {
    renderStatus(s);
    if (pausedEl) {
      pausedEl.checked = !!s.paused;
      syncPauseSwitch();
    }
  });
  getPrintQueue().then(renderQueue);

  const debugTrigger = document.getElementById('debugTrigger');
  const debugPopover = document.getElementById('debugPopover');
  const debugLog = document.getElementById('debugLog');
  const debugClear = document.getElementById('debugClear');
  onLogHistory((entries) => renderLogHistory(entries, debugLog));
  onLog((entry) => appendLogEntry(entry, debugLog));
  if (debugTrigger && debugPopover) {
    debugTrigger.addEventListener('click', () => {
      const open = debugPopover.classList.toggle('open');
      debugTrigger.setAttribute('aria-expanded', String(open));
    });
  }
  if (debugClear && debugLog) {
    debugClear.addEventListener('click', () => { debugLog.innerHTML = ''; });
  }
}
