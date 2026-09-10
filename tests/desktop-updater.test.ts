import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { compareVersions, getDesktopInfo } from '@/lib/desktop';

describe('Desktop Updater & Version Utilities', () => {
  const originalWindow = global.window;
  const originalNavigator = global.navigator;

  beforeEach(() => {
    (global as any).window = {};
    Object.defineProperty(global, 'navigator', {
      value: { userAgent: '' },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    (global as any).window = originalWindow;
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  });

  it('correctly compares semantic versions', () => {
    expect(compareVersions('0.0.1', '0.0.2')).toBeLessThan(0);
    expect(compareVersions('0.0.2', '0.0.2')).toBe(0);
    expect(compareVersions('0.0.3', '0.0.2')).toBeGreaterThan(0);
    expect(compareVersions('v0.0.1', '0.0.2')).toBeLessThan(0);
    expect(compareVersions('0.1.0', '0.0.2')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '0.0.2')).toBeGreaterThan(0);

    // Verifying update triggers from 0.0.2 to target version 0.1 / 0.1.0
    expect(compareVersions('0.0.2', '0.1.0')).toBeLessThan(0);
    expect(compareVersions('0.0.2', '0.1')).toBeLessThan(0);
    expect(compareVersions('0.1.0', '0.1.0')).toBe(0);
    expect(compareVersions('0.1', '0.1.0')).toBe(0);
  });

  it('detects desktop environment and version from window.teaderDesktop', () => {
    (global as any).window.teaderDesktop = {
      isDesktop: true,
      version: '0.0.1',
      appVersion: '0.0.1',
      platform: 'win32',
      electronVersion: '34.5.8',
    };

    const info = getDesktopInfo();
    expect(info.isDesktop).toBe(true);
    expect(info.version).toBe('0.0.1');
    expect(info.platform).toBe('win32');
    expect(info.electronVersion).toBe('34.5.8');
    expect(compareVersions(info.version!, '0.0.2')).toBeLessThan(0);
  });

  it('triggers update to 0.1 when running Electron version 0.0.2', () => {
    (global as any).window.teaderDesktop = {
      isDesktop: true,
      version: '0.0.2',
      appVersion: '0.0.2',
      platform: 'win32',
      electronVersion: '34.5.8',
    };

    const info = getDesktopInfo();
    expect(info.isDesktop).toBe(true);
    expect(info.version).toBe('0.0.2');
    const TARGET_VERSION = '0.1.0';
    expect(compareVersions(info.version!, TARGET_VERSION)).toBeLessThan(0);
  });

  it('detects desktop environment from userAgent when window.teaderDesktop is not present', () => {
    (global as any).navigator = {
      userAgent: 'Mozilla/5.0 Chrome/130 TeaderDesktop/0.0.1 Electron/34.5.8',
    };

    const info = getDesktopInfo();
    expect(info.isDesktop).toBe(true);
    expect(info.version).toBe('0.0.1');
    expect(compareVersions(info.version!, '0.0.2')).toBeLessThan(0);
  });

  it('detects non-desktop browser environment', () => {
    (global as any).navigator = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    };

    const info = getDesktopInfo();
    expect(info.isDesktop).toBe(false);
    expect(info.version).toBeNull();
  });
});
