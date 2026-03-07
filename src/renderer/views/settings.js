import {
  getAppVersion,
  checkForUpdates,
  downloadUpdate,
  quitAndInstall,
  onUpdateStatus,
  getLogHistory,
  getOrderList,
  getPrintQueue,
  getStatus,
  onConfig,
  onLog,
  onLogHistory,
  onPrintQueueUpdate,
  reprintOrder,
  retryPrint,
  saveConfig,
  setPaused,
} from '../api';

function renderStatus(status) {
  const pill = document.getElementById('statusPill');
  const text = document.getElementById('statusText');
  const meta = document.getElementById('statusMeta');
  const hint = document.getElementById('statusHint');
  if (!pill || !text || !meta) return;
  const { connected, queueLength, lastPrintedAt, printError, retryScheduled, nextRetryAt } = status || {};
  const hasPrintError = !!printError;
  pill.className = 'status-pill ' + (connected ? 'connected' : 'disconnected') + (hasPrintError ? ' print-error' : '');
  text.textContent = hasPrintError ? 'Printer unavailable' : (connected ? 'Connected' : 'Disconnected');
  const parts = [`${queueLength ?? 0} in queue`];
  if (lastPrintedAt) parts.push(`Last: ${new Date(lastPrintedAt).toLocaleTimeString()}`);
  if (hasPrintError && connected) parts.push('Backend connected');
  if (hasPrintError && retryScheduled && nextRetryAt) {
    const retryIn = Math.max(0, Math.ceil((new Date(nextRetryAt) - Date.now()) / 1000));
    parts.push(`Retry in ${retryIn}s`);
  }
  meta.textContent = parts.join(' · ');
  const errorBox = document.getElementById('printErrorBox');
  const errorMsg = document.getElementById('printErrorMessage');
  if (errorBox && errorMsg) {
    errorBox.style.display = hasPrintError ? 'flex' : 'none';
    if (hasPrintError) {
      errorMsg.textContent = retryScheduled
        ? `${printError}. Retrying automatically every 15s until printer is available.`
        : printError;
    }
  }
  if (hint) {
    if (hasPrintError) {
      hint.style.display = 'none';
    } else {
      hint.style.display = '';
      hint.textContent = connected
        ? 'Receiving orders from backend.'
        : 'Add your kitchen secret in the Kitchen section above and click Save to connect.';
    }
    hint.classList.toggle('connected', !!connected);
    hint.classList.toggle('print-error', false);
  }
}

function setOrderListEmptyMessage(msg) {
  const empty = document.getElementById('orderListEmpty');
  if (empty) empty.textContent = msg;
}

const REPRINT_COOLDOWN_MS = 4000;

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toast.setAttribute('role', 'status');
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3500);
}

function orderDetailsLine(order) {
  const parts = [];
  if (order.storeName) parts.push(order.storeName);
  if (order.items && order.items.length) {
    const count = order.items.reduce((sum, i) => sum + (Number(i.quantity) || Number(i.qty) || 1), 0);
    parts.push(`${count} item${count !== 1 ? 's' : ''}`);
  }
  if (order.notes) {
    const n = String(order.notes);
    parts.push(`Note: ${n.slice(0, 40)}${n.length > 40 ? '…' : ''}`);
  }
  if (order.deliveryAddress) {
    const a = String(order.deliveryAddress);
    parts.push(a.slice(0, 35) + (a.length > 35 ? '…' : ''));
  }
  const createdAt = order.createdAt || order.created_at || order.updatedAt || order.updated_at;
  if (createdAt) {
    try {
      const d = new Date(createdAt);
      if (!Number.isNaN(d.getTime())) parts.push(d.toLocaleString());
    } catch { void 0; }
  }
  return parts.join(' · ');
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
    const content = document.createElement('div');
    content.className = 'order-content';
    const label = document.createElement('span');
    label.className = 'order-label';
    const numStr = order.orderNumber || order._id || order.id || '—';
    const totalStr = order.total != null ? `$${Number(order.total).toFixed(2)}` : '';
    const statusStr = order.status || '';
    label.textContent = [numStr, statusStr, totalStr].filter(Boolean).join(' · ');
    content.appendChild(label);
    const detailsStr = orderDetailsLine(order);
    if (detailsStr) {
      const details = document.createElement('span');
      details.className = 'order-details';
      details.textContent = detailsStr;
      content.appendChild(details);
    }
    li.appendChild(num);
    li.appendChild(content);
    const reprintBtn = document.createElement('button');
    reprintBtn.type = 'button';
    reprintBtn.className = 'btn-reprint';
    reprintBtn.textContent = 'Reprint';
    reprintBtn.addEventListener('click', (e) => {
      e.preventDefault();
      reprintBtn.disabled = true;
      reprintBtn.classList.add('printing');
      reprintBtn.textContent = 'Printing…';
      showToast('Sending to printer…', 'info');
      reprintOrder(order)
        .then(() => {
          getPrintQueue().then(renderQueue);
          return getStatus();
        })
        .then((s) => {
          renderStatus(s);
          if (document.getElementById('paused')) {
            document.getElementById('paused').checked = !!s.paused;
            syncPauseSwitch();
          }
          showToast('Printed', 'success');
        })
        .catch(() => {
          showToast('Reprint failed', 'error');
        })
        .finally(() => {
          setTimeout(() => {
            reprintBtn.disabled = false;
            reprintBtn.classList.remove('printing');
            reprintBtn.textContent = 'Reprint';
          }, REPRINT_COOLDOWN_MS);
        });
    });
    li.appendChild(reprintBtn);
    list.appendChild(li);
  });
}

function normalizeQueuePayload(queue) {
  if (queue && typeof queue === 'object' && !Array.isArray(queue) && ('pending' in queue || 'printed' in queue)) {
    return {
      pending: Array.isArray(queue.pending) ? queue.pending : [],
      printed: Array.isArray(queue.printed) ? queue.printed : [],
    };
  }
  if (Array.isArray(queue)) {
    return { pending: queue, printed: [] };
  }
  return { pending: [], printed: [] };
}

function renderQueue(queue) {
  const list = document.getElementById('queueList');
  const empty = document.getElementById('queueEmpty');
  if (!list || !empty) return;
  const { pending, printed } = normalizeQueuePayload(queue);
  const items = [...pending, ...printed];
  list.innerHTML = '';
  empty.style.display = items.length === 0 ? 'block' : 'none';
  list.style.display = items.length === 0 ? 'none' : 'block';
  if (items.length === 0) return;
  items.forEach((item, i) => {
    const li = document.createElement('li');
    if (item.printed) li.classList.add('printed');
    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = `${i + 1}.`;
    const label = document.createElement('span');
    label.className = 'queue-item-label';
    label.textContent = item.label || `#${item.id}`;
    li.appendChild(num);
    li.appendChild(label);
    if (item.printed) {
      const badge = document.createElement('span');
      badge.className = 'queue-printed-badge';
      badge.textContent = 'Printed';
      li.appendChild(badge);
    }
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
    return (
      d.toLocaleTimeString('en-US', { hour12: false }) +
      '.' +
      String(d.getMilliseconds()).padStart(3, '0')
    );
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
  const ts =
    new Date().toLocaleTimeString('en-US', { hour12: false }) +
    '.' +
    String(new Date().getMilliseconds()).padStart(3, '0');
  line.innerHTML = `<span class="ts">${ts}</span><span class="lvl log">LOG</span> ${escapeHtml(message)}`;
  container.appendChild(line);
  container.scrollTop = container.scrollHeight;
}

export function setupRefreshClick(getOrderListFn, opts = {}) {
  const doc = opts.document || document;
  const debugLogEl = opts.debugLogEl || doc.getElementById('debugLog');
  const debugDetailsEl = opts.debugDetailsEl || doc.getElementById('debugDetails');
  const refreshBtn =
    doc.getElementById('refreshOrderList') ||
    doc.querySelector('[data-action="refresh-order-list"]');
  function onRefresh() {
    if (debugDetailsEl) debugDetailsEl.open = true;
    appendRendererLog(debugLogEl, 'Order list refresh requested');
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
    const receiptWidthEl = document.getElementById('receiptWidth');
    if (receiptWidthEl) receiptWidthEl.value = String(config?.receiptWidth ?? 42);
    const printBarcodeEl = document.getElementById('printBarcode');
    const printBarcodeSwitch = document.getElementById('printBarcodeSwitch');
    if (printBarcodeEl) printBarcodeEl.checked = config?.printBarcode !== false;
    if (printBarcodeSwitch) {
      printBarcodeSwitch.setAttribute('aria-checked', printBarcodeEl?.checked ? 'true' : 'false');
      printBarcodeSwitch.classList.toggle('checked', !!printBarcodeEl?.checked);
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
      const receiptWidthEl = document.getElementById('receiptWidth');
      const receiptWidth = receiptWidthEl ? Math.max(16, Math.min(64, parseInt(receiptWidthEl.value, 10) || 42)) : 42;
      const printBarcodeEl = document.getElementById('printBarcode');
      saveConfig({
        printer: select ? select.value.trim() : '',
        receiptWidth,
        printBarcode: printBarcodeEl ? printBarcodeEl.checked : true,
        kitchenSecret: kitchenSecret ? kitchenSecret.value : '',
        pollIntervalMs: Number.isFinite(pollMs) ? Math.max(3000, Math.min(120000, pollMs)) : 10000,
      });
      showToast('Settings saved', 'success');
    };
  }
  const printBarcodeCheckbox = document.getElementById('printBarcode');
  const printBarcodeSwitchEl = document.getElementById('printBarcodeSwitch');
  if (printBarcodeSwitchEl && printBarcodeCheckbox) {
    printBarcodeSwitchEl.addEventListener('click', () => {
      printBarcodeCheckbox.checked = !printBarcodeCheckbox.checked;
      printBarcodeSwitchEl.setAttribute('aria-checked', String(printBarcodeCheckbox.checked));
      printBarcodeSwitchEl.classList.toggle('checked', printBarcodeCheckbox.checked);
    });
    printBarcodeSwitchEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        printBarcodeSwitchEl.click();
      }
    });
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
    renderQueue(data?.queue);
    if (data?.status) {
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
  const retryPrintBtn = document.getElementById('retryPrintBtn');
  if (retryPrintBtn) {
    retryPrintBtn.addEventListener('click', () => {
      retryPrint().then(() => getStatus().then(renderStatus));
    });
  }

  function loadOrderList() {
    const empty = document.getElementById('orderListEmpty');
    const refreshBtn = document.getElementById('refreshOrderList');
    if (empty) empty.style.display = 'block';
    setOrderListEmptyMessage('Loading…');
    if (refreshBtn) refreshBtn.disabled = true;
    getOrderList({ limit: 50 })
      .then(({ orders }) => renderOrderList(orders))
      .catch(() => renderOrderList([], 'Load failed. Click Refresh to try again.'))
      .finally(() => {
        if (refreshBtn) refreshBtn.disabled = false;
      });
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
          debugLog.appendChild(
            document.createTextNode(
              'No logs yet. Main process logs appear here and in the terminal.',
            ),
          );
        } else {
          renderLogHistory(list, debugLog);
        }
      })
      .catch(() => {
        if (debugLog) debugLog.textContent = 'Could not load logs.';
      });
  }

  refreshLogHistory();
  if (debugDetailsEl) {
    debugDetailsEl.addEventListener('toggle', () => {
      if (debugDetailsEl.open) refreshLogHistory();
    });
  }
  onLogHistory((entries) => renderLogHistory(Array.isArray(entries) ? entries : [], debugLog));
  onLog((entry) => appendLogEntry(entry, debugLog));
  if (debugClear && debugLog) {
    debugClear.addEventListener('click', (e) => {
      e.preventDefault();
      debugLog.innerHTML = '';
    });
  }

  const versionEl = document.getElementById('appVersion');
  const checkUpdatesBtn = document.getElementById('checkUpdatesBtn');
  const updateStatusEl = document.getElementById('updateStatus');
  const updateAvailableEl = document.getElementById('updateAvailable');
  const updateAvailableText = document.getElementById('updateAvailableText');
  const downloadUpdateBtn = document.getElementById('downloadUpdateBtn');
  const installUpdateBtn = document.getElementById('installUpdateBtn');

  getAppVersion().then((v) => {
    if (versionEl) versionEl.textContent = v || '—';
  });

  function setUpdateStatus(text) {
    if (updateStatusEl) updateStatusEl.textContent = text;
  }

  onUpdateStatus((data) => {
    const { status, info, progress, error } = data || {};
    if (status === 'checking') setUpdateStatus('Checking…');
    else if (status === 'available') {
      setUpdateStatus(`Update available: v${info?.version || '?'}`);
      if (updateAvailableEl) updateAvailableEl.style.display = 'block';
      if (updateAvailableText) updateAvailableText.textContent = `Version ${info?.version} is available.`;
      if (downloadUpdateBtn) downloadUpdateBtn.style.display = 'inline-flex';
      if (installUpdateBtn) installUpdateBtn.style.display = 'none';
    } else if (status === 'not-available') setUpdateStatus('You’re on the latest version.');
    else if (status === 'downloading' && progress != null) {
      const pct = progress.percent != null ? Math.round(progress.percent) : 0;
      setUpdateStatus(`Downloading… ${pct}%`);
    } else if (status === 'downloaded') {
      setUpdateStatus('Update ready.');
      if (downloadUpdateBtn) downloadUpdateBtn.style.display = 'none';
      if (installUpdateBtn) installUpdateBtn.style.display = 'inline-flex';
    } else if (status === 'error') setUpdateStatus(error || 'Update check failed.');
  });

  if (checkUpdatesBtn) {
    checkUpdatesBtn.addEventListener('click', () => {
      setUpdateStatus('Checking…');
      if (updateAvailableEl) updateAvailableEl.style.display = 'none';
      checkForUpdates().then((res) => {
        if (res?.error) setUpdateStatus(res.error);
      });
    });
  }

  if (downloadUpdateBtn) {
    downloadUpdateBtn.addEventListener('click', () => {
      setUpdateStatus('Downloading…');
      downloadUpdate().then((res) => {
        if (res?.error) setUpdateStatus(res.error);
      });
    });
  }

  if (installUpdateBtn) {
    installUpdateBtn.addEventListener('click', () => quitAndInstall());
  }
}
