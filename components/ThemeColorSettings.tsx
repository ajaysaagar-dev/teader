'use client';

import React, { useState, useEffect } from 'react';
import {
  Palette,
  RotateCcw,
  Check,
  Sparkles,
  Layers,
  Circle,
  Eye,
  Sliders,
  Flame,
  Info,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DEFAULT_ROOT_THEME_TOKENS,
  THEME_PRESETS,
  ThemeColorToken,
  ThemePreset,
  getSavedCustomTheme,
  getActivePresetId,
  saveAndApplyTheme,
  applyPresetTheme,
  setSingleThemeVariable,
  resetThemeToDefault,
} from '@/lib/theme-manager';

type CategoryFilter = 'all' | 'surfaces' | 'accent' | 'statuses' | 'priorities' | 'borders' | 'text' | 'feedback';

export const ThemeColorSettings: React.FC = () => {
  const [customVars, setCustomVars] = useState<Record<string, string>>({});
  const [activePreset, setActivePreset] = useState<string>('obsidian-default');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Load current theme state
  useEffect(() => {
    const saved = getSavedCustomTheme();
    setCustomVars(saved);
    setActivePreset(getActivePresetId());
  }, []);

  const handleApplyPreset = (preset: ThemePreset) => {
    applyPresetTheme(preset.id);
    setActivePreset(preset.id);
    setCustomVars(preset.vars);
    toast.success(`Applied ${preset.name} theme`);
  };

  const handleColorChange = (key: string, newHex: string) => {
    const updated = setSingleThemeVariable(key, newHex);
    setCustomVars(updated);
    setActivePreset('custom');
  };

  const handleResetSingleToken = (token: ThemeColorToken) => {
    const updated = { ...customVars };
    delete updated[token.key];
    saveAndApplyTheme(updated);
    setCustomVars(updated);
    toast.success(`Reset ${token.label} to default (${token.defaultValue})`);
  };

  const handleResetAll = () => {
    resetThemeToDefault();
    setCustomVars({});
    setActivePreset('obsidian-default');
    toast.success('Reset all :root theme colors to default Obsidian');
  };

  // Get current color for a token
  const getCurrentColor = (token: ThemeColorToken): string => {
    return customVars[token.key] || token.defaultValue;
  };

  // Filter tokens by category and search
  const filteredTokens = DEFAULT_ROOT_THEME_TOKENS.filter((t) => {
    const matchCat = selectedCategory === 'all' || t.category === selectedCategory;
    const matchSearch =
      searchQuery === '' ||
      t.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  const categories: { id: CategoryFilter; label: string; count: number }[] = [
    { id: 'all', label: 'All Colors', count: DEFAULT_ROOT_THEME_TOKENS.length },
    { id: 'surfaces', label: 'Surfaces & Cards', count: DEFAULT_ROOT_THEME_TOKENS.filter(t => t.category === 'surfaces').length },
    { id: 'accent', label: 'Brand Accent', count: DEFAULT_ROOT_THEME_TOKENS.filter(t => t.category === 'accent').length },
    { id: 'statuses', label: 'Task Statuses', count: DEFAULT_ROOT_THEME_TOKENS.filter(t => t.category === 'statuses').length },
    { id: 'priorities', label: 'Priorities', count: DEFAULT_ROOT_THEME_TOKENS.filter(t => t.category === 'priorities').length },
    { id: 'borders', label: 'Borders', count: DEFAULT_ROOT_THEME_TOKENS.filter(t => t.category === 'borders').length },
    { id: 'text', label: 'Typography', count: DEFAULT_ROOT_THEME_TOKENS.filter(t => t.category === 'text').length },
    { id: 'feedback', label: 'Feedback', count: DEFAULT_ROOT_THEME_TOKENS.filter(t => t.category === 'feedback').length },
  ];

  return (
    <div className="space-y-6">
      {/* ─── Header & Global Action Bar ───────────────────────────────── */}
      <div className="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-primary)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-yellow-subtle)] text-[var(--accent-yellow)] border border-[var(--accent-yellow-muted)] flex items-center justify-center font-bold shadow-sm">
              <Palette size={16} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                Theme Colors & :root Variables
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--bg-hover)] text-[var(--accent-yellow)] border border-[var(--border-primary)]">
                  Live Sync
                </span>
              </h4>
              <p className="text-[11px] text-[var(--text-muted)]">
                Customize global workspace colors, accents, statuses, and priorities with real-time CSS variable bindings.
              </p>
            </div>
          </div>

          {/* Reset Button */}
          <button
            onClick={handleResetAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-hover)] hover:bg-[var(--bg-hover-subtle)] text-[var(--text-primary)] hover:text-white text-xs font-semibold transition-all border border-[var(--border-secondary)] shadow-sm shrink-0"
            title="Restore all factory :root colors"
          >
            <RotateCcw size={13} className="text-[var(--accent-yellow)]" />
            <span>Reset to Default</span>
          </button>
        </div>

        {/* ─── Curated Theme Presets Grid ─────────────────────────────── */}
        <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
          <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider font-mono">
            Theme Presets
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {THEME_PRESETS.map((preset) => {
              const isActive = activePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => handleApplyPreset(preset)}
                  className={`p-2.5 rounded-xl text-left border transition-all relative overflow-hidden group ${
                    isActive
                      ? 'bg-[var(--bg-hover)] border-[var(--accent-yellow)] ring-1 ring-[var(--accent-yellow)]/40 shadow-sm'
                      : 'bg-[var(--bg-card)] border-[var(--border-primary)] hover:border-[var(--border-secondary)]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-white truncate max-w-[120px]">
                      {preset.name}
                    </span>
                    {isActive && (
                      <span className="w-4 h-4 rounded-full bg-[var(--accent-yellow)] text-[var(--bg-canvas)] flex items-center justify-center shrink-0">
                        <Check size={10} strokeWidth={3} />
                      </span>
                    )}
                  </div>

                  {/* Swatches bar */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <span
                      className="w-4 h-4 rounded-full border border-black/30 shadow-sm"
                      style={{ backgroundColor: preset.accent }}
                      title={`Accent: ${preset.accent}`}
                    />
                    <span
                      className="w-4 h-4 rounded-full border border-black/30 shadow-sm"
                      style={{ backgroundColor: preset.bgMain }}
                      title={`Main: ${preset.bgMain}`}
                    />
                    <span
                      className="w-4 h-4 rounded-full border border-black/30 shadow-sm"
                      style={{ backgroundColor: preset.bgCard }}
                      title={`Card: ${preset.bgCard}`}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Live Theme Preview Box ───────────────────────────────────── */}
      <div className="p-3.5 rounded-xl bg-[var(--bg-main)] border border-[var(--border-primary)] space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider font-mono flex items-center gap-1.5">
            <Sparkles size={12} className="text-[var(--accent-yellow)]" /> Live Theme Preview
          </span>
          <span className="text-[10px] font-mono text-[var(--text-muted)]">
            Changes reflect instantly across the entire application
          </span>
        </div>

        <div className="p-3 bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-[var(--accent-yellow)] bg-[var(--accent-yellow-subtle)] px-2 py-0.5 rounded border border-[var(--accent-yellow-muted)]">
                TEA-101
              </span>
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                Centralized Design System Verification
              </span>
            </div>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded uppercase bg-[var(--priority-critical-bg)] text-[var(--priority-critical)] border border-[var(--priority-critical-border)]">
              Critical (P0)
            </span>
          </div>

          <div className="flex items-center justify-between text-xs pt-1 border-t border-[var(--border-primary)]/50">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--status-inprogress-bg)] text-[var(--status-inprogress)] border border-[var(--status-inprogress-border)]">
                <Circle size={8} className="fill-current" /> In Progress
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--status-done-bg)] text-[var(--status-done)] border border-[var(--status-done-border)]">
                <CheckCircle2 size={10} /> Done
              </span>
            </div>

            <button className="px-2.5 py-1 bg-[var(--accent-yellow)] hover:bg-[var(--accent-yellow-hover)] text-[var(--bg-canvas)] font-bold text-xs rounded-md shadow-sm transition-all">
              Save Changes
            </button>
          </div>
        </div>
      </div>

      {/* ─── Category Filter Bar & Search ─────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                selectedCategory === cat.id
                  ? 'bg-[var(--accent-yellow)] text-[var(--bg-canvas)] font-bold shadow-sm'
                  : 'bg-[var(--bg-panel)] text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)] border border-[var(--border-primary)]'
              }`}
            >
              <span>{cat.label}</span>
              <span className={`text-[10px] font-mono px-1 rounded ${
                selectedCategory === cat.id ? 'bg-black/20 text-[var(--bg-canvas)]' : 'bg-[var(--bg-card)] text-[var(--text-muted)]'
              }`}>
                {cat.count}
              </span>
            </button>
          ))}
        </div>

        {/* ─── Color Variable Editors Grid ─────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {filteredTokens.map((token) => {
            const currentColor = getCurrentColor(token);
            const isModified = Boolean(customVars[token.key] && customVars[token.key] !== token.defaultValue);

            return (
              <div
                key={token.key}
                className="p-3 bg-[var(--bg-panel)] border border-[var(--border-primary)] rounded-xl flex items-center justify-between gap-3 hover:border-[var(--border-secondary)] transition-colors"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-white truncate">{token.label}</span>
                    {isModified && (
                      <span className="text-[9px] font-mono font-medium px-1.5 py-0.2 rounded bg-[var(--accent-yellow-subtle)] text-[var(--accent-yellow)] border border-[var(--accent-yellow-muted)]">
                        Custom
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] truncate">{token.description}</p>
                  <span className="text-[10px] font-mono text-[var(--text-disabled)] block truncate">
                    {token.key}
                  </span>
                </div>

                {/* Color Picker Swatch & Hex Control */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="relative flex items-center">
                    <input
                      type="color"
                      value={currentColor.startsWith('#') ? currentColor : '#DCB001'}
                      onChange={(e) => handleColorChange(token.key, e.target.value)}
                      className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0 p-0 overflow-hidden"
                      title="Pick custom color"
                    />
                  </div>

                  <input
                    type="text"
                    value={currentColor}
                    onChange={(e) => handleColorChange(token.key, e.target.value)}
                    className="w-20 bg-[var(--bg-input)] border border-[var(--border-primary)] focus:border-[var(--border-input-focus)] rounded-lg px-2 py-1 text-xs font-mono text-[var(--text-primary)] outline-none"
                    placeholder="#HEX"
                  />

                  {isModified && (
                    <button
                      onClick={() => handleResetSingleToken(token)}
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--accent-yellow)] rounded-md hover:bg-[var(--bg-hover)] transition-colors"
                      title="Reset this variable to default"
                    >
                      <RotateCcw size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
