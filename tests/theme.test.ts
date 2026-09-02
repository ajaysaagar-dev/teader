import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DEFAULT_ROOT_THEME_TOKENS,
  THEME_PRESETS,
  hexToRgba,
  computeDerivedThemeVariables,
  getSavedCustomTheme,
  getActivePresetId,
  saveAndApplyTheme,
  applyPresetTheme,
  setSingleThemeVariable,
  resetThemeToDefault,
  THEME_STORAGE_KEY,
  ACTIVE_PRESET_KEY,
} from '@/lib/theme-manager';

describe('Teader Theme & :root Color System Tests', () => {
  let mockLocalStorage: Record<string, string> = {};

  beforeEach(() => {
    mockLocalStorage = {};

    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mockLocalStorage[key] || null,
      setItem: (key: string, val: string) => {
        mockLocalStorage[key] = val;
      },
      removeItem: (key: string) => {
        delete mockLocalStorage[key];
      },
      clear: () => {
        mockLocalStorage = {};
      },
    });

    // Mock document.documentElement.style
    const mockStyle: Record<string, string> = {};
    vi.stubGlobal('document', {
      documentElement: {
        style: {
          setProperty: (k: string, v: string) => {
            mockStyle[k] = v;
          },
          removeProperty: (k: string) => {
            delete mockStyle[k];
          },
          getPropertyValue: (k: string) => mockStyle[k] || '',
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defines all key :root color tokens across surfaces, accents, statuses, and priorities', () => {
    expect(DEFAULT_ROOT_THEME_TOKENS.length).toBeGreaterThanOrEqual(25);

    const keys = DEFAULT_ROOT_THEME_TOKENS.map((t) => t.key);
    expect(keys).toContain('--bg-main');
    expect(keys).toContain('--bg-canvas');
    expect(keys).toContain('--bg-card');
    expect(keys).toContain('--bg-header');
    expect(keys).toContain('--accent-yellow');
    expect(keys).toContain('--status-todo');
    expect(keys).toContain('--status-inprogress');
    expect(keys).toContain('--status-done');
    expect(keys).toContain('--priority-critical');
    expect(keys).toContain('--priority-high');
    expect(keys).toContain('--priority-medium');
    expect(keys).toContain('--priority-low');
    expect(keys).toContain('--success');
    expect(keys).toContain('--danger');

    DEFAULT_ROOT_THEME_TOKENS.forEach((token) => {
      expect(token.key.startsWith('--')).toBe(true);
      expect(token.defaultValue.startsWith('#')).toBe(true);
      expect(token.label).toBeTruthy();
      expect(token.category).toBeTruthy();
      expect(token.description).toBeTruthy();
    });
  });

  it('accurately converts hex to rgba with alpha opacity', () => {
    expect(hexToRgba('#DCB001', 0.12)).toBe('rgba(220, 176, 1, 0.12)');
    expect(hexToRgba('#22C55E', 0.3)).toBe('rgba(34, 197, 94, 0.3)');
    expect(hexToRgba('#EF4444', 1)).toBe('rgba(239, 68, 68, 1)');
    expect(hexToRgba('#FFF', 0.5)).toBe('rgba(255, 255, 255, 0.5)');
  });

  it('computes derived companion opacity and glow variables from customized tokens', () => {
    const custom = {
      '--accent-yellow': '#3B82F6',
      '--status-done': '#10B981',
      '--priority-critical': '#F43F5E',
    };

    const derived = computeDerivedThemeVariables(custom);

    expect(derived['--accent-yellow-subtle']).toBe('rgba(59, 130, 246, 0.12)');
    expect(derived['--accent-yellow-glow']).toBe('rgba(59, 130, 246, 0.4)');
    expect(derived['--border-accent']).toBe('rgba(59, 130, 246, 0.3)');
    expect(derived['--border-accent-strong']).toBe('#3B82F6');
    expect(derived['--status-done-bg']).toBe('rgba(16, 185, 129, 0.12)');
    expect(derived['--status-done-border']).toBe('rgba(16, 185, 129, 0.3)');
    expect(derived['--priority-critical-bg']).toBe('rgba(244, 63, 94, 0.12)');
  });

  it('provides curated presets and applies them to localStorage and DOM', () => {
    expect(THEME_PRESETS.length).toBeGreaterThanOrEqual(6);

    const cyber = THEME_PRESETS.find((p) => p.id === 'cyberpunk-neon');
    expect(cyber).toBeDefined();

    const applied = applyPresetTheme('cyberpunk-neon');
    expect(applied).toBeDefined();
    expect(applied?.id).toBe('cyberpunk-neon');

    const saved = getSavedCustomTheme();
    expect(saved['--accent-yellow']).toBe('#FFE600');
    expect(getActivePresetId()).toBe('cyberpunk-neon');
  });

  it('updates single color variables in realtime', () => {
    const updated = setSingleThemeVariable('--bg-main', '#000000');
    expect(updated['--bg-main']).toBe('#000000');

    const saved = getSavedCustomTheme();
    expect(saved['--bg-main']).toBe('#000000');
  });

  it('resets theme to default factory settings and cleans up overrides', () => {
    // Set a custom theme first
    setSingleThemeVariable('--accent-yellow', '#FF0055');
    expect(getSavedCustomTheme()['--accent-yellow']).toBe('#FF0055');

    // Reset
    resetThemeToDefault();

    expect(getSavedCustomTheme()).toEqual({});
    expect(getActivePresetId()).toBe('obsidian-default');
  });
});
