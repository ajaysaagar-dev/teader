import { describe, it, expect } from 'vitest';
import { cleanupLegacyTheme } from '@/lib/legacy-cleanup';

describe('Legacy Theme Cleanup Tests', () => {
  it('removes legacy theme and density keys from localStorage', () => {
    const mockStorage: Record<string, string> = {
      teader_custom_theme_vars: '{"--accent-yellow":"#3B82F6"}',
      teader_active_preset_id: 'cyberpunk-neon',
      teader_ui_density: 'compact',
      teader_accent_color: 'blue',
      teader_token: 'valid_token',
      teader_user: '{"id":1}',
      teader_ui_scale: '1.1',
    };

    const storageObj = {
      getItem: (k: string) => mockStorage[k] || null,
      setItem: (k: string, v: string) => { mockStorage[k] = v; },
      removeItem: (k: string) => { delete mockStorage[k]; },
      clear: () => {},
      key: () => null,
      length: Object.keys(mockStorage).length,
    } as unknown as Storage;

    cleanupLegacyTheme(storageObj);

    expect(mockStorage['teader_custom_theme_vars']).toBeUndefined();
    expect(mockStorage['teader_active_preset_id']).toBeUndefined();
    expect(mockStorage['teader_ui_density']).toBeUndefined();
    expect(mockStorage['teader_accent_color']).toBeUndefined();
    // Preserves non-theme user keys
    expect(mockStorage['teader_token']).toBe('valid_token');
    expect(mockStorage['teader_user']).toBe('{"id":1}');
    expect(mockStorage['teader_ui_scale']).toBe('1.1');
  });

  it('removes inline custom property overrides while preserving UI scale', () => {
    const props = ['--bg-main', '--accent-yellow', '--ui-scale', 'zoom', '--ui-scale-percent'];
    const removed: string[] = [];

    const styleObj = {
      length: props.length,
      [0]: '--bg-main',
      [1]: '--accent-yellow',
      [2]: '--ui-scale',
      [3]: 'zoom',
      [4]: '--ui-scale-percent',
      removeProperty: (p: string) => { removed.push(p); },
    } as unknown as CSSStyleDeclaration;

    cleanupLegacyTheme(null, styleObj);

    expect(removed).toContain('--bg-main');
    expect(removed).toContain('--accent-yellow');
    expect(removed).not.toContain('--ui-scale');
    expect(removed).not.toContain('--ui-scale-percent');
    expect(removed).not.toContain('zoom');
  });
});

describe('Centralized Theme Palette Tests', () => {
  it('defines the centralized theme variables in globals.css', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const cssPath = path.resolve(process.cwd(), 'app/globals.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toContain('--theme-bg: #121212;');
    expect(css).toContain('--theme-text-primary: #E0E0E0;');
    expect(css).toContain('--theme-text-secondary: #B0B0B0;');
    expect(css).toContain('--theme-border: #242424;');
    expect(css).toContain('--theme-accent: #BB86FC;');

    // Verify mapping from centralized variables to app tokens
    expect(css).toContain('--bg-main: var(--theme-bg);');
    expect(css).toContain('--text-primary: var(--theme-text-primary);');
    expect(css).toContain('--text-secondary: var(--theme-text-secondary);');
    expect(css).toContain('--border-primary: var(--theme-border);');
    expect(css).toContain('--accent: var(--theme-accent);');
  });
});
