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
  const parts1 = v1.replace(/^[vV]/, '').split('.').map(n => parseInt(n, 10) || 0);
  const parts2 = v2.replace(/^[vV]/, '').split('.').map(n => parseInt(n, 10) || 0);
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

