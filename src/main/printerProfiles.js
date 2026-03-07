const { randomUUID } = require('crypto');

function createDefaultProfile(overrides = {}) {
  const name = overrides.name ?? 'Default receipt';
  return {
    id: overrides.id ?? randomUUID(),
    name,
    displayName: overrides.displayName ?? name,
    connection: overrides.connection ?? 'usb',
    protocol: 'escpos',
    width: overrides.width ?? overrides.paperWidth ?? 80,
    printerType: overrides.printerType ?? 'epson',
    supportsCut: overrides.supportsCut ?? true,
    supportsDrawerKick: overrides.supportsDrawerKick ?? false,
    deviceName: overrides.deviceName ?? '',
    role: overrides.role ?? 'generic',
  };
}

function widthToCharWidth(width) {
  if (width === 58) return 42;
  if (width === 80) return 48;
  return 48;
}

function getProfileById(config, profileId) {
  const profiles = config?.printerProfiles ?? [];
  if (profileId && Array.isArray(profiles)) {
    const found = profiles.find((p) => p && p.id === profileId);
    if (found) return normalizeProfile(found);
  }
  return null;
}

function getActiveProfile(config) {
  const profiles = config?.printerProfiles ?? [];
  const id = config?.activePrinterProfileId ?? '';
  if (id && Array.isArray(profiles)) {
    const found = profiles.find((p) => p && p.id === id);
    if (found) return normalizeProfile(found);
  }
  if (profiles && profiles.length > 0) return normalizeProfile(profiles[0]);
  const legacy = (config?.printer ?? '').trim();
  const width = Math.max(16, Math.min(64, Number(config?.receiptWidth) || 48));
  const paperWidth = width <= 42 ? 58 : 80;
  return createDefaultProfile({
    name: 'Legacy',
    deviceName: legacy,
    width: paperWidth,
  });
}

function normalizeProfile(p) {
  const connection = ['usb', 'network', 'windows-shared', 'windows'].includes(p.connection) ? p.connection : 'usb';
  const width = p.width === 58 || p.width === 80 ? p.width : (p.paperWidth === 58 ? 58 : 80);
  return {
    id: p.id ?? randomUUID(),
    name: String(p.name ?? 'Unnamed').trim() || 'Unnamed',
    displayName: p.displayName != null ? String(p.displayName).trim() : (String(p.name ?? 'Unnamed').trim() || 'Unnamed'),
    connection,
    protocol: 'escpos',
    strategy: 'escpos',
    role: ['front', 'kitchen', 'label', 'generic'].includes(p.role) ? p.role : 'generic',
    width,
    paperWidth: width,
    printerType: (p.printerType ?? 'epson').toLowerCase() === 'star' ? 'star' : 'epson',
    supportsCut: !!p.supportsCut,
    supportsDrawerKick: !!p.supportsDrawerKick,
    deviceName: p.deviceName != null ? String(p.deviceName).trim() : '',
  };
}

function migrateConfig(config) {
  const profiles = config?.printerProfiles ?? [];
  if (Array.isArray(profiles) && profiles.length > 0) {
    return {
      ...config,
      printerProfiles: profiles.map(normalizeProfile),
      activePrinterProfileId: config.activePrinterProfileId ?? profiles[0]?.id ?? '',
    };
  }
  const legacyPrinter = (config?.printer ?? '').trim();
  const receiptWidth = Math.max(16, Math.min(64, Number(config?.receiptWidth) || 48));
  const width = receiptWidth <= 42 ? 58 : 80;
  const defaultProfile = createDefaultProfile({
    name: 'Default receipt',
    deviceName: legacyPrinter,
    width,
  });
  return {
    ...config,
    printer: legacyPrinter,
    printerProfiles: [defaultProfile],
    activePrinterProfileId: defaultProfile.id,
  };
}

module.exports = {
  createDefaultProfile,
  getActiveProfile,
  getProfileById,
  normalizeProfile,
  migrateConfig,
  widthToCharWidth,
};
