import { onConfig, saveConfig, getStatus, setPaused, onPrintQueueUpdate, onLog, onLogHistory, getLogHistory, getOrderList, getPrintQueue } from '../api';

function renderStatus(status) {
  const pill = document.getElementById('statusPill');
  const text = document.getElementById('statusText');
  const meta = document.getElementById('statusMeta');
  const hint = document.getElementById('statusHint');
  if (!pill || !text || !meta) return;
  const { connected, paused, queueLength, lastPrintedAt } = status || {};
  pill.className = 'status-pill ' + (connected ? 'connected' : 'disconnected');
  text.textContent = connected ? 'Connected' : 'Disconnected';
  const parts = [`${queueLength ?? 0} in queue`];
  if (lastPrintedAt) parts.push(`Last: ${new Date(lastPrintedAt).toLocaleTimeString()}`);
  meta.textContent = parts.join(' · ');
  if (hint) {
    hint.textContent = connected
      ? 'Receiving orders from backend.'
      : 'Add your kitchen secret in the Kitchen section above and click Save to connect.';
    hint.classList.toggle('connected', !!connected);
  }
}

function setOrderListEmptyMessage(msg) {
  const empty = document.getElementById('orderListEmpty');
  if (empty) empty.textContent = msg;
}

function renderOrderList(orders, emptyMessage) {
  const list = document.getElementById('orderList');
  const empty = document.getElementById('orderListEmpty');
  if (!list || !empty) return;
  const items = orders || [];
  list.innerHTML = '';
  if (items.length === 0) {
    list.style.display = 'none';
    empty.style.display = 'block';
    setOrderListEmptyMessage(emptyMessage || 'No orders in list. Click Refresh to load.');
    return;
  }
  empty.style.display = 'none';
  list.style.display = 'block';
  items.forEach((order, i) => {
    const li = document.createElement('li');
    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = `${i + 1}.`;
    const label = document.createElement('span');
    const numStr = order.orderNumber || order._id || order.id || '—';
    const totalStr = order.total != null ? `$${Number(order.total).toFixed(2)}` : '';
    const statusStr = order.status || '';
    label.textContent = [numStr, statusStr, totalStr].filter(Boolean).join(' · ');
    li.appendChild(num);
    li.appendChild(label);
    list.appendChild(li);
  });
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

export function appendRendererLog(container, message) {
  if (!container) return;
  const line = document.createElement('div');
  line.className = 'line log';
  const ts = new Date().toLocaleTimeString('en-US', { hour12: false }) + '.' + String(new Date().getMilliseconds()).padStart(3, '0');
  line.innerHTML = `<span class="ts">${ts}</span><span class="lvl log">LOG</span> ${escapeHtml(message)}`;
  container.appendChild(line);
  container.scrollTop = container.scrollHeight;
}

export function setupRefreshClick(getOrderListFn, opts = {}) {
  const doc = opts.document || document;
  const debugLogEl = opts.debugLogEl || doc.getElementById('debugLog');
  const debugDetailsEl = opts.debugDetailsEl || doc.getElementById('debugDetails');
  const refreshBtn = doc.getElementById('refreshOrderList') || doc.querySelector('[data-action="refresh-order-list"]');
  function onRefresh() {
    alert('hello world');
    if (debugDetailsEl) debugDetailsEl.open = true;
    appendRendererLog(debugLogEl, 'hello world (Refresh clicked in renderer)');
    if (typeof getOrderListFn === 'function') getOrderListFn();
  }
  if (refreshBtn) {
    refreshBtn.addEventListener('click', (e) => {
      e.preventDefault();
      onRefresh();
    });
  }
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
    const kitchenSecret = document.getElementById('kitchenSecret');
    const pollIntervalMs = document.getElementById('pollIntervalMs');
    if (kitchenSecret) kitchenSecret.value = config?.kitchenSecret || '';
    if (pollIntervalMs) pollIntervalMs.value = config?.pollIntervalMs ?? 10000;
  });
  const saveBtn = document.getElementById('save');
  if (saveBtn) {
    saveBtn.onclick = () => {
      const select = document.getElementById('printer');
      const kitchenSecret = document.getElementById('kitchenSecret');
      const pollIntervalMs = document.getElementById('pollIntervalMs');
      const pollMs = pollIntervalMs ? parseInt(pollIntervalMs.value, 10) : 10000;
      saveConfig({
        printer: select ? select.value.trim() : '',
        kitchenSecret: kitchenSecret ? kitchenSecret.value : '',
        pollIntervalMs: Number.isFinite(pollMs) ? Math.max(3000, Math.min(120000, pollMs)) : 10000,
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

  function loadOrderList() {
    const empty = document.getElementById('orderListEmpty');
    const refreshBtn = document.getElementById('refreshOrderList');
    if (empty) empty.style.display = 'block';
    setOrderListEmptyMessage('Loading…');
    if (refreshBtn) refreshBtn.disabled = true;
    getOrderList({ limit: 50 })
      .then(({ orders }) => renderOrderList(orders))
      .catch(() => renderOrderList([], 'Load failed. Click Refresh to try again.'))
      .finally(() => { if (refreshBtn) refreshBtn.disabled = false; });
  }
  loadOrderList();
  setupRefreshClick(loadOrderList);

  const debugLog = document.getElementById('debugLog');
  const debugClear = document.getElementById('debugClear');
  const debugDetailsEl = document.getElementById('debugDetails');

  function refreshLogHistory() {
    if (!debugLog) return;
    getLogHistory()
      .then((entries) => {
        const list = Array.isArray(entries) ? entries : [];
        if (list.length === 0) {
          debugLog.innerHTML = '';
          debugLog.appendChild(document.createTextNode('No logs yet. Main process logs appear here and in the terminal.'));
        } else {
          renderLogHistory(list, debugLog);
        }
      })
      .catch(() => { if (debugLog) debugLog.textContent = 'Could not load logs.'; });
  }

  refreshLogHistory();
  if (debugDetailsEl) {
    debugDetailsEl.addEventListener('toggle', () => { if (debugDetailsEl.open) refreshLogHistory(); });
  }
  onLogHistory((entries) => renderLogHistory(Array.isArray(entries) ? entries : [], debugLog));
  onLog((entry) => appendLogEntry(entry, debugLog));
  if (debugClear && debugLog) {
    debugClear.addEventListener('click', (e) => {
      e.preventDefault();
      debugLog.innerHTML = '';
    });
  }
}
