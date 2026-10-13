import { describe, it, expect } from 'vitest';
import { BUILD_NUMBER, getBuildNumber } from '@/lib/build-info';
import { DesktopVersionIndicator } from '@/components/DesktopVersionIndicator';
import { getDesktopInfo } from '@/lib/desktop';

describe('App Details & Build Configuration', () => {
  it('has a valid BUILD_NUMBER format', () => {
    expect(BUILD_NUMBER).toBeDefined();
    expect(typeof BUILD_NUMBER).toBe('string');
    expect(getBuildNumber()).toBe(BUILD_NUMBER);
    // Format B<A|P>-<DDMMYYYY>-<HHMM>
    expect(BUILD_NUMBER).toMatch(/^B[AP]-[0-9]{8}-[0-9]{4}$/);
  });

  it('DesktopVersionIndicator returns null to remove bottom-right screen badge', () => {
    const result = DesktopVersionIndicator({});
    expect(result).toBeNull();
  });

  it('getDesktopInfo returns consistent runtime info in browser/node environment', () => {
    const info = getDesktopInfo();
    expect(info).toHaveProperty('isDesktop');
    expect(info).toHaveProperty('version');
    expect(info).toHaveProperty('platform');
    expect(info).toHaveProperty('electronVersion');
  });
});
