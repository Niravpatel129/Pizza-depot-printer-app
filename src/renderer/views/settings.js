import {
  getAppVersion,
  checkForUpdates,
  downloadUpdate,
  quitAndInstall,
  onUpdateStatus,
  getConfig,
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
  getReceiptPreview,
  testPrint,
} from '../api';

function renderStatus(status) {
  const pill = document.getElementById('statusPill');
  const text = document.getElementById('statusText');
  const meta = document.getElementById('statusMeta');
  const hint = document.getElementById('statusHint');
  if (!pill || !text || !meta) return;
  const { connected, queueLength, lastPrintedAt, lastPolledAt, printError, connectionError, retryScheduled, nextRetryAt } = status || {};
  const hasPrintError = !!printError;
  const hasBackendError = !connected;
  let statusLabel;
  if (hasPrintError && connected) {
    statusLabel = 'Printer error';
  } else if (hasBackendError) {
    statusLabel = 'Backend disconnected';
  } else {
    statusLabel = 'Connected';
  }
  pill.className = 'status-pill ' + (connected ? 'connected' : 'disconnected') + (hasPrintError ? ' print-error' : '');
  text.textContent = statusLabel;
  const parts = [`${queueLength ?? 0} in queue`];
  if (lastPolledAt) parts.push(`Polling: ${new Date(lastPolledAt).toLocaleTimeString()}`);
  if (lastPrintedAt) parts.push(`Last print: ${new Date(lastPrintedAt).toLocaleTimeString()}`);
  if (hasPrintError && connected) parts.push('Backend OK');
  if (hasPrintError && retryScheduled && nextRetryAt) {
    const retryIn = Math.max(0, Math.ceil((new Date(nextRetryAt) - Date.now()) / 1000));
    parts.push(`Retry in ${retryIn}s`);
  }
  meta.textContent = parts.join(' · ');
  const errorBox = document.getElementById('printErrorBox');
  const errorMsg = document.getElementById('printErrorMessage');
  if (errorBox && errorMsg) {
    if (hasPrintError) {
      errorBox.style.display = 'flex';
      const detail = retryScheduled
        ? `${printError} Retrying automatically every 15s.`
        : printError;
      errorMsg.textContent = `Printer: ${detail}`;
    } else {
      errorBox.style.display = 'none';
    }
  }
  if (hint) {
    if (hasPrintError) {
      hint.style.display = 'none';
    } else if (hasBackendError) {
      hint.style.display = '';
      hint.classList.add('backend-error');
      hint.classList.remove('connected');
      const backendReason = connectionError
        ? `Backend: ${connectionError}`
        : 'Backend: Not connected. Add your kitchen secret in the Kitchen section above and click Save, or check network.';
      hint.textContent = backendReason;
    } else {
      hint.classList.remove('backend-error');
      hint.style.display = '';
      hint.textContent = 'Backend connected. Receiving orders.';
      hint.classList.add('connected');
    }
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

function showReceiptPreview(text) {
  const overlay = document.getElementById('receiptPreviewOverlay');
  const pre = document.getElementById('receiptPreviewText');
  if (!overlay || !pre) return;
  pre.textContent = text || '(No receipt content)';
  overlay.classList.add('open');
}

function closeReceiptPreview() {
  const overlay = document.getElementById('receiptPreviewOverlay');
  if (overlay) overlay.classList.remove('open');
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
    const btnWrap = document.createElement('div');
    btnWrap.className = 'order-actions';
    const previewBtn = document.createElement('button');
    previewBtn.type = 'button';
    previewBtn.className = 'btn-preview';
    previewBtn.textContent = 'Show preview';
    previewBtn.addEventListener('click', (e) => {
      e.preventDefault();
      getReceiptPreview(order).then((text) => showReceiptPreview(text));
    });
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
    btnWrap.appendChild(previewBtn);
    btnWrap.appendChild(reprintBtn);
    li.appendChild(btnWrap);
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
  const items = [...pending, ...printed].reverse();
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

let lastConfig = null;
let lastPrinters = [];

function renderProfilesTable(config, printers) {
  const activeSelect = document.getElementById('activePrinterProfile');
  const tbody = document.getElementById('profilesTableBody');
  if (!activeSelect || !tbody) return;
  const profiles = config?.printerProfiles ?? [];
  const activeId = config?.activePrinterProfileId ?? (profiles[0]?.id ?? '');
  activeSelect.innerHTML = '<option value="">—</option>';
  profiles.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name || 'Unnamed';
    if (p.id === activeId) opt.selected = true;
    activeSelect.appendChild(opt);
  });
  tbody.innerHTML = '';
  profiles.forEach((p) => {
    const tr = document.createElement('tr');
    tr.dataset.profileId = p.id;
    const connectionOpts = ['usb', 'network', 'windows-shared'].map((c) => `<option value="${c}" ${p.connection === c ? 'selected' : ''}>${c}</option>`).join('');
    const widthOpts = [58, 80].map((w) => `<option value="${w}" ${p.width === w ? 'selected' : ''}>${w}mm</option>`).join('');
    const deviceOpts = ['<option value="">System default</option>', ...printers.map((pr) => {
      const val = escapeHtml(String(pr.name || ''));
      const label = escapeHtml(pr.displayName || pr.name || pr.description || pr.name || '');
      const sel = (p.deviceName || '') === (pr.name || '') ? ' selected' : '';
      return `<option value="${val}"${sel}>${label}</option>`;
    })].join('');
    tr.innerHTML = `
      <td><input type="text" name="profileName" value="${escapeHtml(String(p.name || ''))}" placeholder="Profile name" /></td>
      <td><select name="profileConnection">${connectionOpts}</select></td>
      <td><select name="profileWidth">${widthOpts}</select></td>
      <td><input type="checkbox" name="profileCut" ${p.supportsCut ? 'checked' : ''} /></td>
      <td><input type="checkbox" name="profileDrawer" ${p.supportsDrawerKick ? 'checked' : ''} /></td>
      <td><select name="profileDevice">${deviceOpts}</select></td>
      <td><button type="button" class="btn-delete-profile" data-profile-id="${escapeHtml(String(p.id))}" aria-label="Delete profile">Delete</button></td>
    `;
    tbody.appendChild(tr);
  });
}

export function mountSettings() {
  onConfig((data) => {
    const { config, printers = [] } = data || {};
    lastConfig = config;
    lastPrinters = printers;
    renderProfilesTable(config, printers);
    const setVal = (id, val, def = '') => {
      const el = document.getElementById(id);
      if (el) el.value = val != null && val !== '' ? String(val) : def;
    };
    setVal('kitchenSecret', config?.kitchenSecret);
    setVal('pollIntervalMs', config?.pollIntervalMs ?? 10000);
    setVal('receiptStoreName', config?.receiptStoreName);
    setVal('receiptAddressLine1', config?.receiptAddressLine1);
    setVal('receiptAddressLine2', config?.receiptAddressLine2);
    setVal('receiptFooterMessage', config?.receiptFooterMessage);
    setVal('receiptFooterWebsite', config?.receiptFooterWebsite);
    setVal('receiptWidth', config?.receiptWidth ?? 48);
  });
  const testPrintBtn = document.getElementById('testPrintBtn');
  if (testPrintBtn) {
    testPrintBtn.addEventListener('click', async () => {
      testPrintBtn.disabled = true;
      try {
        const res = await testPrint();
        if (res && res.ok) showToast('Test print sent', 'success');
        else showToast((res && res.error) || 'Test print failed', 'error');
      } finally {
        testPrintBtn.disabled = false;
      }
    });
  }
  const addProfileBtn = document.getElementById('addPrinterProfile');
  if (addProfileBtn) {
    addProfileBtn.addEventListener('click', () => {
      if (!lastConfig) return;
      const newId = 'new-' + Date.now();
      const profiles = [...(lastConfig.printerProfiles || []), {
        id: newId,
        name: 'New profile',
        connection: 'usb',
        width: 80,
        supportsCut: true,
        supportsDrawerKick: false,
        deviceName: '',
      }];
      lastConfig = { ...lastConfig, printerProfiles: profiles, activePrinterProfileId: lastConfig.activePrinterProfileId || newId };
      renderProfilesTable(lastConfig, lastPrinters);
      showToast('Profile added. Save to apply.', 'info');
    });
  }
  document.getElementById('profilesTableBody')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-delete-profile');
    if (!btn || !lastConfig) return;
    const id = btn.dataset.profileId;
    const profiles = (lastConfig.printerProfiles || []).filter((p) => p.id !== id);
    const activeId = lastConfig.activePrinterProfileId === id ? (profiles[0]?.id ?? '') : lastConfig.activePrinterProfileId;
    lastConfig = { ...lastConfig, printerProfiles: profiles, activePrinterProfileId: activeId };
    renderProfilesTable(lastConfig, lastPrinters);
  });
  const saveBtn = document.getElementById('save');
  if (saveBtn) {
    saveBtn.onclick = async () => {
      const activeSelect = document.getElementById('activePrinterProfile');
      const tbody = document.getElementById('profilesTableBody');
      const kitchenSecret = document.getElementById('kitchenSecret');
      const pollIntervalMs = document.getElementById('pollIntervalMs');
      const getVal = (id) => {
        const el = document.getElementById(id);
        return el ? el.value.trim() : '';
      };
      const getNum = (id, min, max, def) => {
        const el = document.getElementById(id);
        const n = el ? parseInt(el.value, 10) : def;
        return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : def;
      };
      const profiles = [];
      if (tbody) {
        tbody.querySelectorAll('tr[data-profile-id]').forEach((row) => {
          const id = row.dataset.profileId;
          const name = row.querySelector('[name="profileName"]')?.value?.trim() || 'Unnamed';
          const connection = row.querySelector('[name="profileConnection"]')?.value || 'usb';
          const width = parseInt(row.querySelector('[name="profileWidth"]')?.value, 10) === 58 ? 58 : 80;
          const supportsCut = row.querySelector('[name="profileCut"]')?.checked ?? true;
          const supportsDrawerKick = row.querySelector('[name="profileDrawer"]')?.checked ?? false;
          const deviceName = row.querySelector('[name="profileDevice"]')?.value?.trim() || '';
          profiles.push({ id, name, connection, protocol: 'escpos', width, supportsCut, supportsDrawerKick, deviceName });
        });
      }
      const activePrinterProfileId = activeSelect?.value?.trim() || profiles[0]?.id || '';
      const current = await getConfig();
      const pollMs = pollIntervalMs ? parseInt(pollIntervalMs.value, 10) : 10000;
      const activeProfile = profiles.find((p) => p.id === activePrinterProfileId);
      const printer = activeProfile?.deviceName ?? current?.printer ?? '';
      saveConfig({
        ...current,
        printer,
        printerProfiles: profiles,
        activePrinterProfileId,
        kitchenSecret: kitchenSecret ? kitchenSecret.value : '',
        pollIntervalMs: Number.isFinite(pollMs) ? Math.max(3000, Math.min(120000, pollMs)) : 10000,
        receiptStoreName: getVal('receiptStoreName'),
        receiptAddressLine1: getVal('receiptAddressLine1'),
        receiptAddressLine2: getVal('receiptAddressLine2'),
        receiptFooterMessage: getVal('receiptFooterMessage'),
        receiptFooterWebsite: getVal('receiptFooterWebsite'),
        receiptWidth: getNum('receiptWidth', 24, 64, 48),
      });
      lastConfig = { ...current, printerProfiles: profiles, activePrinterProfileId };
      showToast('Settings saved', 'success');
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
  const previewOverlay = document.getElementById('receiptPreviewOverlay');
  const previewCloseBtn = document.getElementById('receiptPreviewClose');
  if (previewCloseBtn) previewCloseBtn.addEventListener('click', closeReceiptPreview);
  if (previewOverlay) {
    previewOverlay.addEventListener('click', (e) => { if (e.target === previewOverlay) closeReceiptPreview(); });
  }
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
