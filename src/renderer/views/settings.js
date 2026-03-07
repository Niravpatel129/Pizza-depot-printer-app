import { onConfig, saveConfig } from '../api';

export function mountSettings() {
  onConfig((data) => {
    const { config, printers = [] } = data || {};
    const select = document.getElementById('printer');
    if (!select) return;
    select.innerHTML = '<option value="">System default</option>';
    printers.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.name;
      opt.textContent = p.displayName || p.name || p.description;
      select.appendChild(opt);
    });
    select.value = config?.printer || '';
  });
  const saveBtn = document.getElementById('save');
  if (saveBtn) {
    saveBtn.onclick = () => {
      const select = document.getElementById('printer');
      saveConfig({ printer: select ? select.value.trim() : '' });
    };
  }
}
