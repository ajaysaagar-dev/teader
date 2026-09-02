/**
 * Teader Centralized Theme & :root CSS Variables Manager
 * Controls realtime dynamic styling, persistence, presets, and resets for all CSS variables in :root.
 */

export const THEME_STORAGE_KEY = 'teader_custom_theme_vars';
export const ACTIVE_PRESET_KEY = 'teader_active_preset_id';

export interface ThemeColorToken {
  key: string;
  label: string;
  defaultValue: string;
  category: 'surfaces' | 'accent' | 'borders' | 'text' | 'statuses' | 'priorities' | 'feedback';
  description: string;
}

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  accent: string;
  bgMain: string;
  bgCard: string;
  vars: Record<string, string>;
}

export const DEFAULT_ROOT_THEME_TOKENS: ThemeColorToken[] = [
  // ===== Surfaces & Backgrounds =====
  {
    key: '--bg-main',
    label: 'Main Canvas Background',
    defaultValue: '#131415',
    category: 'surfaces',
    description: 'Primary workspace background surface behind boards and editors.',
  },
  {
    key: '--bg-canvas',
    label: 'Sidebar & Base Canvas',
    defaultValue: '#0F1011',
    category: 'surfaces',
    description: 'Deepest background layer for sidebars and top bars.',
  },
  {
    key: '--bg-header',
    label: 'Header & Panels',
    defaultValue: '#17181A',
    category: 'surfaces',
    description: 'Background for top headers, modals, and panel containers.',
  },
  {
    key: '--bg-card',
    label: 'Card Surface',
    defaultValue: '#1B1C1F',
    category: 'surfaces',
    description: 'Background color for task cards, project tiles, and filter bars.',
  },
  {
    key: '--bg-hover',
    label: 'Hover State',
    defaultValue: '#222427',
    category: 'surfaces',
    description: 'Background highlight when hovering over cards, menu items, and tabs.',
  },
  {
    key: '--bg-input',
    label: 'Input Field',
    defaultValue: '#1A1B1D',
    category: 'surfaces',
    description: 'Background for text inputs, select dropdowns, and search bars.',
  },

  // ===== Brand Accent (Yellow/Gold) =====
  {
    key: '--accent-yellow',
    label: 'Primary Brand Accent',
    defaultValue: '#DCB001',
    category: 'accent',
    description: 'Main brand highlight color used for CTA buttons, active tabs, and badges.',
  },
  {
    key: '--accent-yellow-hover',
    label: 'Accent Hover State',
    defaultValue: '#E5B802',
    category: 'accent',
    description: 'Brighter highlight color when hovering over brand buttons.',
  },
  {
    key: '--accent-yellow-light',
    label: 'Accent Light Glow',
    defaultValue: '#FDE047',
    category: 'accent',
    description: 'Lighter tint used for text accents and gradients.',
  },
  {
    key: '--accent-yellow-dark',
    label: 'Accent Dark',
    defaultValue: '#AE8D05',
    category: 'accent',
    description: 'Darker gold tone for secondary accent borders and tags.',
  },

  // ===== Borders & Dividers =====
  {
    key: '--border-primary',
    label: 'Primary Border',
    defaultValue: '#2A2C30',
    category: 'borders',
    description: 'Standard container border and separator outline.',
  },
  {
    key: '--border-secondary',
    label: 'Divider Border',
    defaultValue: '#3B3D41',
    category: 'borders',
    description: 'Stronger divider line between major workspace sections.',
  },
  {
    key: '--border-subtle',
    label: 'Subtle Border',
    defaultValue: '#202226',
    category: 'borders',
    description: 'Delicate inner borders and sub-panel dividers.',
  },

  // ===== Typography / Text =====
  {
    key: '--text-white',
    label: 'Headings & Highlights',
    defaultValue: '#FFFFFF',
    category: 'text',
    description: 'Brightest white for active titles, bold headings, and hero text.',
  },
  {
    key: '--text-primary',
    label: 'Primary Body Text',
    defaultValue: '#CFD4DD',
    category: 'text',
    description: 'Standard readable text for task descriptions and table items.',
  },
  {
    key: '--text-secondary',
    label: 'Secondary Text',
    defaultValue: '#9499A0',
    category: 'text',
    description: 'Subtitles, secondary labels, and neutral icons.',
  },
  {
    key: '--text-muted',
    label: 'Muted & Caption Text',
    defaultValue: '#787C83',
    category: 'text',
    description: 'Timestamp captions, helper labels, and keyboard hints.',
  },

  // ===== Task Statuses =====
  {
    key: '--status-todo',
    label: 'Todo Status',
    defaultValue: '#787C83',
    category: 'statuses',
    description: 'Color indicator for Todo tasks.',
  },
  {
    key: '--status-inprogress',
    label: 'In Progress Status',
    defaultValue: '#DCB001',
    category: 'statuses',
    description: 'Color indicator for In Progress tasks.',
  },
  {
    key: '--status-review',
    label: 'Needs Review Status',
    defaultValue: '#A855F7',
    category: 'statuses',
    description: 'Color indicator for tasks under peer review.',
  },
  {
    key: '--status-done',
    label: 'Done Status',
    defaultValue: '#22C55E',
    category: 'statuses',
    description: 'Color indicator for completed tasks.',
  },
  {
    key: '--status-blocked',
    label: 'Blocked Status',
    defaultValue: '#EF4444',
    category: 'statuses',
    description: 'Color indicator for blocked or impediment tasks.',
  },
  {
    key: '--status-cancelled',
    label: 'Cancelled Status',
    defaultValue: '#64748B',
    category: 'statuses',
    description: 'Color indicator for cancelled tasks.',
  },

  // ===== Task Priorities =====
  {
    key: '--priority-critical',
    label: 'Critical (P0)',
    defaultValue: '#EF4444',
    category: 'priorities',
    description: 'High urgency flame priority indicator.',
  },
  {
    key: '--priority-high',
    label: 'High (P1)',
    defaultValue: '#F97316',
    category: 'priorities',
    description: 'High priority task indicator.',
  },
  {
    key: '--priority-medium',
    label: 'Medium (P2)',
    defaultValue: '#3B82F6',
    category: 'priorities',
    description: 'Standard medium priority indicator.',
  },
  {
    key: '--priority-low',
    label: 'Low (P3)',
    defaultValue: '#9499A0',
    category: 'priorities',
    description: 'Low priority indicator.',
  },

  // ===== System Feedback =====
  {
    key: '--success',
    label: 'Success Green',
    defaultValue: '#22C55E',
    category: 'feedback',
    description: 'Positive confirmation and approval feedback.',
  },
  {
    key: '--warning',
    label: 'Warning Amber',
    defaultValue: '#F59E0B',
    category: 'feedback',
    description: 'Cautionary alerts and warnings.',
  },
  {
    key: '--danger',
    label: 'Danger Red',
    defaultValue: '#EF4444',
    category: 'feedback',
    description: 'Error states, destructive actions, and critical notifications.',
  },
  {
    key: '--info',
    label: 'Info Blue',
    defaultValue: '#3B82F6',
    category: 'feedback',
    description: 'Informational notes, tooltips, and link highlights.',
  },
  {
    key: '--cyan',
    label: 'Cyan Accent',
    defaultValue: '#0391A1',
    category: 'feedback',
    description: 'Git branches, code diff highlights, and tags.',
  },
  {
    key: '--purple',
    label: 'Purple Accent',
    defaultValue: '#A855F7',
    category: 'feedback',
    description: 'Review tags, milestones, and special highlights.',
  },
];

/**
 * Utility: Converts hex string (#RRGGBB) to rgba(r, g, b, alpha)
 */
export function hexToRgba(hex: string, alpha: number = 1): string {
  if (!hex || typeof hex !== 'string') return `rgba(220, 176, 1, ${alpha})`;
  let cleanHex = hex.trim().replace(/^#/, '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map((c) => c + c).join('');
  }
  if (cleanHex.length !== 6) {
    return hex;
  }
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return hex;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Maps derived companion variables (like background tints and glows)
 * whenever a base token is customized.
 */
export function computeDerivedThemeVariables(customVars: Record<string, string>): Record<string, string> {
  const derived: Record<string, string> = {};

  // Accent companions
  const accent = customVars['--accent-yellow'] || '#DCB001';
  derived['--accent-yellow-subtle'] = hexToRgba(accent, 0.12);
  derived['--accent-yellow-muted'] = hexToRgba(accent, 0.25);
  derived['--accent-yellow-glow'] = hexToRgba(accent, 0.4);
  derived['--border-accent'] = hexToRgba(accent, 0.3);
  derived['--border-accent-strong'] = accent;
  derived['--border-input-focus'] = accent;
  derived['--text-accent'] = accent;

  // Status companions
  if (customVars['--status-todo']) {
    derived['--status-todo-bg'] = hexToRgba(customVars['--status-todo'], 0.12);
    derived['--status-todo-border'] = hexToRgba(customVars['--status-todo'], 0.3);
  }
  if (customVars['--status-inprogress']) {
    derived['--status-inprogress-bg'] = hexToRgba(customVars['--status-inprogress'], 0.12);
    derived['--status-inprogress-border'] = hexToRgba(customVars['--status-inprogress'], 0.3);
  }
  if (customVars['--status-review']) {
    derived['--status-review-bg'] = hexToRgba(customVars['--status-review'], 0.12);
    derived['--status-review-border'] = hexToRgba(customVars['--status-review'], 0.3);
  }
  if (customVars['--status-done']) {
    derived['--status-done-bg'] = hexToRgba(customVars['--status-done'], 0.12);
    derived['--status-done-border'] = hexToRgba(customVars['--status-done'], 0.3);
  }
  if (customVars['--status-blocked']) {
    derived['--status-blocked-bg'] = hexToRgba(customVars['--status-blocked'], 0.12);
    derived['--status-blocked-border'] = hexToRgba(customVars['--status-blocked'], 0.3);
  }
  if (customVars['--status-cancelled']) {
    derived['--status-cancelled-bg'] = hexToRgba(customVars['--status-cancelled'], 0.12);
    derived['--status-cancelled-border'] = hexToRgba(customVars['--status-cancelled'], 0.3);
  }

  // Priority companions
  if (customVars['--priority-critical']) {
    derived['--priority-critical-bg'] = hexToRgba(customVars['--priority-critical'], 0.12);
    derived['--priority-critical-border'] = hexToRgba(customVars['--priority-critical'], 0.3);
  }
  if (customVars['--priority-high']) {
    derived['--priority-high-bg'] = hexToRgba(customVars['--priority-high'], 0.12);
    derived['--priority-high-border'] = hexToRgba(customVars['--priority-high'], 0.3);
  }
  if (customVars['--priority-medium']) {
    derived['--priority-medium-bg'] = hexToRgba(customVars['--priority-medium'], 0.12);
    derived['--priority-medium-border'] = hexToRgba(customVars['--priority-medium'], 0.3);
  }
  if (customVars['--priority-low']) {
    derived['--priority-low-bg'] = hexToRgba(customVars['--priority-low'], 0.12);
    derived['--priority-low-border'] = hexToRgba(customVars['--priority-low'], 0.3);
  }

  // Feedback companions
  if (customVars['--success']) {
    derived['--success-bg'] = hexToRgba(customVars['--success'], 0.12);
    derived['--success-border'] = hexToRgba(customVars['--success'], 0.3);
  }
  if (customVars['--warning']) {
    derived['--warning-bg'] = hexToRgba(customVars['--warning'], 0.12);
    derived['--warning-border'] = hexToRgba(customVars['--warning'], 0.3);
  }
  if (customVars['--danger']) {
    derived['--danger-bg'] = hexToRgba(customVars['--danger'], 0.12);
    derived['--danger-border'] = hexToRgba(customVars['--danger'], 0.3);
  }
  if (customVars['--info']) {
    derived['--info-bg'] = hexToRgba(customVars['--info'], 0.12);
    derived['--info-border'] = hexToRgba(customVars['--info'], 0.3);
  }

  return derived;
}

/**
 * Curated Theme Presets
 */
export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'obsidian-default',
    name: 'Teader Obsidian (Default)',
    description: 'Signature dark titanium styling with high-velocity gold highlights.',
    accent: '#DCB001',
    bgMain: '#131415',
    bgCard: '#1B1C1F',
    vars: {
      '--bg-main': '#131415',
      '--bg-canvas': '#0F1011',
      '--bg-sidebar': '#0F1011',
      '--bg-header': '#17181A',
      '--bg-panel': '#17181A',
      '--bg-card': '#1B1C1F',
      '--bg-hover': '#222427',
      '--bg-input': '#1A1B1D',
      '--border-primary': '#2A2C30',
      '--border-secondary': '#3B3D41',
      '--accent-yellow': '#DCB001',
      '--accent-yellow-hover': '#E5B802',
      '--accent-yellow-light': '#FDE047',
      '--accent-yellow-dark': '#AE8D05',
      '--text-primary': '#CFD4DD',
      '--status-inprogress': '#DCB001',
      '--status-done': '#22C55E',
      '--status-review': '#A855F7',
    },
  },
  {
    id: 'cyberpunk-neon',
    name: 'Cyberpunk Neon',
    description: 'Deep electric onyx with high-voltage neon yellow and cyan circuits.',
    accent: '#FFE600',
    bgMain: '#0B0C10',
    bgCard: '#151821',
    vars: {
      '--bg-main': '#0B0C10',
      '--bg-canvas': '#07080B',
      '--bg-sidebar': '#07080B',
      '--bg-header': '#10131A',
      '--bg-panel': '#10131A',
      '--bg-card': '#151821',
      '--bg-hover': '#1F2432',
      '--bg-input': '#12151D',
      '--border-primary': '#222A3A',
      '--border-secondary': '#303B52',
      '--accent-yellow': '#FFE600',
      '--accent-yellow-hover': '#FFF04B',
      '--accent-yellow-light': '#FFF894',
      '--accent-yellow-dark': '#C7B300',
      '--text-primary': '#D8E2F0',
      '--status-inprogress': '#FFE600',
      '--status-done': '#00F0FF',
      '--status-review': '#D946EF',
      '--cyan': '#00F0FF',
    },
  },
  {
    id: 'midnight-sapphire',
    name: 'Midnight Sapphire',
    description: 'Deep oceanic blues with vibrant electric sapphire highlights.',
    accent: '#3B82F6',
    bgMain: '#0B0F19',
    bgCard: '#121826',
    vars: {
      '--bg-main': '#0B0F19',
      '--bg-canvas': '#070A11',
      '--bg-sidebar': '#070A11',
      '--bg-header': '#0F1422',
      '--bg-panel': '#0F1422',
      '--bg-card': '#121826',
      '--bg-hover': '#1B2438',
      '--bg-input': '#101521',
      '--border-primary': '#1E293B',
      '--border-secondary': '#334155',
      '--accent-yellow': '#3B82F6',
      '--accent-yellow-hover': '#60A5FA',
      '--accent-yellow-light': '#93C5FD',
      '--accent-yellow-dark': '#1D4ED8',
      '--text-primary': '#CBD5E1',
      '--status-inprogress': '#3B82F6',
      '--status-done': '#10B981',
      '--status-review': '#818CF8',
      '--cyan': '#06B6D4',
    },
  },
  {
    id: 'emerald-matrix',
    name: 'Emerald Matrix',
    description: 'Deep slate forest with vibrant emerald and mint highlights.',
    accent: '#10B981',
    bgMain: '#0B130E',
    bgCard: '#132018',
    vars: {
      '--bg-main': '#0B130E',
      '--bg-canvas': '#070D09',
      '--bg-sidebar': '#070D09',
      '--bg-header': '#0F1A13',
      '--bg-panel': '#0F1A13',
      '--bg-card': '#132018',
      '--bg-hover': '#1C3024',
      '--bg-input': '#101B14',
      '--border-primary': '#1B3828',
      '--border-secondary': '#274E39',
      '--accent-yellow': '#10B981',
      '--accent-yellow-hover': '#34D399',
      '--accent-yellow-light': '#6EE7B7',
      '--accent-yellow-dark': '#047857',
      '--text-primary': '#D1FAE5',
      '--status-inprogress': '#10B981',
      '--status-done': '#34D399',
      '--status-review': '#A7F3D0',
      '--cyan': '#14B8A6',
    },
  },
  {
    id: 'solar-amber',
    name: 'Solar Amber',
    description: 'Warm dark embers with flame orange and fiery amber highlights.',
    accent: '#F97316',
    bgMain: '#140E0A',
    bgCard: '#1F1610',
    vars: {
      '--bg-main': '#140E0A',
      '--bg-canvas': '#0D0906',
      '--bg-sidebar': '#0D0906',
      '--bg-header': '#1A120D',
      '--bg-panel': '#1A120D',
      '--bg-card': '#1F1610',
      '--bg-hover': '#2C2017',
      '--bg-input': '#18110C',
      '--border-primary': '#38251A',
      '--border-secondary': '#4F3526',
      '--accent-yellow': '#F97316',
      '--accent-yellow-hover': '#FB923C',
      '--accent-yellow-light': '#FDBA74',
      '--accent-yellow-dark': '#C2410C',
      '--text-primary': '#FED7AA',
      '--status-inprogress': '#F97316',
      '--status-done': '#22C55E',
      '--status-review': '#FB7185',
    },
  },
  {
    id: 'crimson-night',
    name: 'Crimson Rose',
    description: 'Velvet night with vibrant ruby rose and crimson highlights.',
    accent: '#F43F5E',
    bgMain: '#140A0D',
    bgCard: '#201015',
    vars: {
      '--bg-main': '#140A0D',
      '--bg-canvas': '#0D0608',
      '--bg-sidebar': '#0D0608',
      '--bg-header': '#1A0D11',
      '--bg-panel': '#1A0D11',
      '--bg-card': '#201015',
      '--bg-hover': '#2D171E',
      '--bg-input': '#180C10',
      '--border-primary': '#3D1A25',
      '--border-secondary': '#542433',
      '--accent-yellow': '#F43F5E',
      '--accent-yellow-hover': '#FB7185',
      '--accent-yellow-light': '#FDA4AF',
      '--accent-yellow-dark': '#BE123C',
      '--text-primary': '#FFE4E6',
      '--status-inprogress': '#F43F5E',
      '--status-done': '#10B981',
      '--status-review': '#C084FC',
    },
  },
  {
    id: 'nordic-violet',
    name: 'Nordic Aurora',
    description: 'Deep Scandinavian charcoal with celestial ultraviolet accents.',
    accent: '#A855F7',
    bgMain: '#0F0E17',
    bgCard: '#1B1828',
    vars: {
      '--bg-main': '#0F0E17',
      '--bg-canvas': '#0A0910',
      '--bg-sidebar': '#0A0910',
      '--bg-header': '#151320',
      '--bg-panel': '#151320',
      '--bg-card': '#1B1828',
      '--bg-hover': '#262238',
      '--bg-input': '#161322',
      '--border-primary': '#2C2742',
      '--border-secondary': '#3E375C',
      '--accent-yellow': '#A855F7',
      '--accent-yellow-hover': '#C084FC',
      '--accent-yellow-light': '#E9D5FF',
      '--accent-yellow-dark': '#7E22CE',
      '--text-primary': '#E9D5FF',
      '--status-inprogress': '#A855F7',
      '--status-done': '#22C55E',
      '--status-review': '#EC4899',
    },
  },
  {
    id: 'monochrome-titanium',
    name: 'Monochrome Stealth',
    description: 'Pure aerospace grayscale with platinum silver accents.',
    accent: '#E2E8F0',
    bgMain: '#0D0E10',
    bgCard: '#17191C',
    vars: {
      '--bg-main': '#0D0E10',
      '--bg-canvas': '#08090A',
      '--bg-sidebar': '#08090A',
      '--bg-header': '#121417',
      '--bg-panel': '#121417',
      '--bg-card': '#17191C',
      '--bg-hover': '#23262B',
      '--bg-input': '#141619',
      '--border-primary': '#272A30',
      '--border-secondary': '#383C45',
      '--accent-yellow': '#E2E8F0',
      '--accent-yellow-hover': '#F8FAFC',
      '--accent-yellow-light': '#FFFFFF',
      '--accent-yellow-dark': '#94A3B8',
      '--text-primary': '#E2E8F0',
      '--status-inprogress': '#E2E8F0',
      '--status-done': '#22C55E',
      '--status-review': '#A855F7',
    },
  },
];

/**
 * Reads user saved theme color variables from localStorage
 */
export function getSavedCustomTheme(): Record<string, string> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed;
      }
    }
  } catch {}
  return {};
}

/**
 * Returns the currently active preset ID if set
 */
export function getActivePresetId(): string {
  if (typeof localStorage === 'undefined') return 'obsidian-default';
  try {
    return localStorage.getItem(ACTIVE_PRESET_KEY) || 'obsidian-default';
  } catch {
    return 'obsidian-default';
  }
}

/**
 * Applies a dictionary of CSS variables to document.documentElement (:root)
 */
export function applyThemeVariablesToDOM(customVars: Record<string, string>) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  // Apply explicit overrides
  Object.entries(customVars).forEach(([key, val]) => {
    if (key.startsWith('--') && val) {
      root.style.setProperty(key, val);
    }
  });

  // Apply derived companions
  const derived = computeDerivedThemeVariables(customVars);
  Object.entries(derived).forEach(([key, val]) => {
    root.style.setProperty(key, val);
  });
}

/**
 * Persists and applies a complete theme configuration
 */
export function saveAndApplyTheme(customVars: Record<string, string>, presetId?: string) {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(customVars));
      if (presetId) {
        localStorage.setItem(ACTIVE_PRESET_KEY, presetId);
      }
    } catch {}
  }
  applyThemeVariablesToDOM(customVars);
}

/**
 * Applies a specific preset theme
 */
export function applyPresetTheme(presetId: string): ThemePreset | undefined {
  const preset = THEME_PRESETS.find((p) => p.id === presetId);
  if (!preset) return undefined;
  saveAndApplyTheme(preset.vars, presetId);
  return preset;
}

/**
 * Updates a single CSS variable in :root and persists it
 */
export function setSingleThemeVariable(varKey: string, hexColor: string): Record<string, string> {
  const current = getSavedCustomTheme();
  const updated = { ...current, [varKey]: hexColor };
  saveAndApplyTheme(updated);
  return updated;
}

/**
 * Resets all :root variables back to default and clears custom overrides
 */
export function resetThemeToDefault() {
  if (typeof document !== 'undefined') {
    const root = document.documentElement;

    // Remove custom styles set directly on style attribute
    DEFAULT_ROOT_THEME_TOKENS.forEach((token) => {
      root.style.removeProperty(token.key);
    });

    // Remove derived companion properties
    const dummyDerived = computeDerivedThemeVariables({ '--accent-yellow': '#DCB001' });
    Object.keys(dummyDerived).forEach((k) => root.style.removeProperty(k));
  }

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(THEME_STORAGE_KEY);
      localStorage.setItem(ACTIVE_PRESET_KEY, 'obsidian-default');
    } catch {}
  }
}
