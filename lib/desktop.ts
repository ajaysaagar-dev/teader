/**
 * Helper utility to detect Electron environment and read desktop application version.
 */
export function getDesktopInfo(): {
  isDesktop: boolean;
  version: string | null;
  platform: string | null;
  electronVersion: string | null;
} {
  if (typeof window === 'undefined' || !window.teaderDesktop) {
    return {
      isDesktop: false,
      version: null,
      platform: null,
      electronVersion: null,
    };
  }

  return {
    isDesktop: Boolean(window.teaderDesktop.isDesktop),
    version: window.teaderDesktop.version || window.teaderDesktop.appVersion || null,
    platform: window.teaderDesktop.platform || null,
    electronVersion: window.teaderDesktop.electronVersion || null,
  };
}
