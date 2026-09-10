/**
 * Helper utility to detect Electron environment and read desktop application version.
 */
export function getDesktopInfo(): {
  isDesktop: boolean;
  version: string | null;
  platform: string | null;
  electronVersion: string | null;
} {
  if (typeof window === 'undefined') {
    return {
      isDesktop: false,
      version: null,
      platform: null,
      electronVersion: null,
    };
  }

  const isDesktop = Boolean(
    window.teaderDesktop?.isDesktop ||
    (typeof navigator !== 'undefined' && /teaderdesktop/i.test(navigator.userAgent))
  );

  let version = window.teaderDesktop?.version || window.teaderDesktop?.appVersion || null;
  if (!version && isDesktop && typeof navigator !== 'undefined') {
    const match = navigator.userAgent.match(/TeaderDesktop\/([0-9.]+)/i);
    if (match) {
      version = match[1];
    }
  }

  return {
    isDesktop,
    version,
    platform: window.teaderDesktop?.platform || null,
    electronVersion: window.teaderDesktop?.electronVersion || null,
  };
}

/**
 * Compare semantic versions: returns negative if v1 < v2, positive if v1 > v2, 0 if equal.
 */
export function compareVersions(v1: string, v2: string): number {
  const parseParts = (v: string) =>
    v
      .replace(/^[vV]/, '')
      .split('.')
      .map((n) => parseInt(n.replace(/[^0-9].*$/, ''), 10) || 0);

  const parts1 = parseParts(v1);
  const parts2 = parseParts(v2);
  const maxLen = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < maxLen; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 !== p2) {
      return p1 - p2;
    }
  }
  return 0;
}

/**
 * Diagnostic helper to query GPU hardware acceleration and WebGPU availability
 * either through the Electron desktop bridge or browser WebGPU APIs.
 */
export async function getDesktopGpuInfo(): Promise<{
  isGpuAccelerated: boolean;
  gpuDeviceName: string;
  source: 'electron' | 'webgpu' | 'none';
  raw?: any;
}> {
  if (typeof window === 'undefined') {
    return { isGpuAccelerated: false, gpuDeviceName: 'None', source: 'none' };
  }

  // 1. First attempt through Electron desktop IPC bridge
  if (window.teaderDesktop?.getGpuInfo) {
    try {
      const res = await window.teaderDesktop.getGpuInfo();
      if (res && res.available) {
        let deviceName = 'Hardware Accelerated GPU';
        if (res.gpuInfo?.gpuDevice && Array.isArray(res.gpuInfo.gpuDevice) && res.gpuInfo.gpuDevice[0]) {
          const dev = res.gpuInfo.gpuDevice[0];
          deviceName = dev.driverDescription || dev.deviceDescription || `Vendor ID: ${dev.vendorId}`;
        }
        return {
          isGpuAccelerated: Boolean(res.isHardwareAccelerated || res.webgpu === 'enabled'),
          gpuDeviceName: deviceName,
          source: 'electron',
          raw: res,
        };
      }
    } catch {}
  }

  // 2. Direct WebGPU API query
  if (typeof navigator !== 'undefined' && (navigator as any).gpu) {
    try {
      const adapter = await (navigator as any).gpu.requestAdapter({
        powerPreference: 'high-performance',
      });
      if (adapter) {
        let name = 'WebGPU Hardware Adapter';
        if (adapter.info) {
          name = adapter.info.device || adapter.info.description || adapter.info.vendor || name;
        }
        return {
          isGpuAccelerated: true,
          gpuDeviceName: name,
          source: 'webgpu',
        };
      }
    } catch {}
  }

  return { isGpuAccelerated: false, gpuDeviceName: 'CPU WebAudio Fallback', source: 'none' };
}

