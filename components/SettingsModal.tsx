'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings,
  Sliders,
  SunMoon,
  Monitor,
  User,
  Zap,
  RotateCcw,
  Check,
  X,
  Volume2,
  VolumeX,
  Keyboard,
  ShieldCheck,
  LogOut,
  Sparkles,
  Layers,
  Database,
  Smartphone,
  ZoomIn,
  Palette
} from 'lucide-react';
import { toast } from 'sonner';
import { applyUIScale, resetUIScale, getSavedUIScale, DEFAULT_UI_SCALE } from './UIScaleInitializer';
import { getDesktopInfo } from '@/lib/desktop';
import { ThemeColorSettings } from './ThemeColorSettings';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: any;
  onLogout?: () => void;
}

type TabType = 'general' | 'theme' | 'appearance' | 'account' | 'performance' | 'shortcuts';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('appearance');
  const [uiScale, setUiScale] = useState<number>(DEFAULT_UI_SCALE);
  const [density, setDensity] = useState<'compact' | 'standard' | 'comfortable'>('standard');
  const [accentColor, setAccentColor] = useState<string>('yellow');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [defaultPage, setDefaultPage] = useState('/dashboard');
  const [desktopInfo, setDesktopInfo] = useState<{ isDesktop: boolean; version: string | null; platform: string | null }>({
    isDesktop: false,
    version: null,
    platform: null,
  });

  useEffect(() => {
    if (isOpen) {
      setUiScale(getSavedUIScale());
      setDesktopInfo(getDesktopInfo());
      try {
        const savedDensity = localStorage.getItem('teader_ui_density') as any;
        if (savedDensity) setDensity(savedDensity);
        const savedAccent = localStorage.getItem('teader_accent_color');
        if (savedAccent) setAccentColor(savedAccent);
      } catch {}
    }
  }, [isOpen]);

  const handleScaleChange = (newScale: number) => {
    setUiScale(newScale);
    applyUIScale(newScale);
  };

  const handleResetUI = () => {
    resetUIScale();
    setUiScale(DEFAULT_UI_SCALE);
    setDensity('standard');
    try {
      localStorage.removeItem('teader_ui_density');
      localStorage.removeItem('teader_accent_color');
    } catch {}
    toast.success('UI reset to default (Scale: 1.0x)');
  };

  const handleDensityChange = (d: 'compact' | 'standard' | 'comfortable') => {
    setDensity(d);
    try {
      localStorage.setItem('teader_ui_density', d);
    } catch {}
    toast.success(`Display density set to ${d}`);
  };

  const handleClearCache = () => {
    try {
      const keysToKeep = ['teader_token', 'teader_user'];
      const keptItems: Record<string, string> = {};
      keysToKeep.forEach(k => {
        const v = localStorage.getItem(k);
        if (v) keptItems[k] = v;
      });
      localStorage.clear();
      Object.entries(keptItems).forEach(([k, v]) => localStorage.setItem(k, v));
      toast.success('Workspace caches cleared successfully');
    } catch {
      toast.error('Failed to clear cache');
    }
  };

  const scalePresets = [
    { label: '80%', value: 0.8 },
    { label: '90%', value: 0.9 },
    { label: '100% (Default)', value: 1.0 },
    { label: '110%', value: 1.1 },
    { label: '125%', value: 1.25 },
    { label: '140%', value: 1.4 },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.16 }}
            className="w-full max-w-4xl bg-[var(--bg-panel)] border border-[var(--border-primary)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[var(--border-primary)] bg-[var(--bg-header)] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--accent-yellow-subtle)] text-[var(--accent-yellow)] border border-[var(--accent-yellow-muted)] flex items-center justify-center font-bold">
                  <Settings size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">Workspace Settings</h3>
                  <p className="text-[11px] font-mono text-[var(--text-muted)]">Preferences, Theme Colors & Configuration</p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-hover)] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Content Split: Sidebar + Panel */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
              {/* Left Navigation Sidebar */}
              <div className="w-48 bg-[var(--bg-canvas)] border-r border-[var(--border-primary)] p-3 space-y-1 shrink-0 overflow-y-auto">
                <button
                  onClick={() => setActiveTab('general')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                    activeTab === 'general'
                      ? 'bg-[var(--bg-hover)] text-white font-semibold border border-[var(--border-secondary)]'
                      : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-panel)]'
                  }`}
                >
                  <Sliders size={14} className={activeTab === 'general' ? 'text-[var(--accent-yellow)]' : 'text-[var(--text-muted)]'} />
                  <span>General</span>
                </button>

                <button
                  onClick={() => setActiveTab('theme')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                    activeTab === 'theme'
                      ? 'bg-[var(--bg-hover)] text-white font-semibold border border-[var(--border-secondary)]'
                      : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-panel)]'
                  }`}
                >
                  <Palette size={14} className={activeTab === 'theme' ? 'text-[var(--accent-yellow)]' : 'text-[var(--text-muted)]'} />
                  <span>Theme & Colors</span>
                </button>

                <button
                  onClick={() => setActiveTab('appearance')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                    activeTab === 'appearance'
                      ? 'bg-[var(--bg-hover)] text-white font-semibold border border-[var(--border-secondary)]'
                      : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-panel)]'
                  }`}
                >
                  <SunMoon size={14} className={activeTab === 'appearance' ? 'text-[var(--cyan)]' : 'text-[var(--text-muted)]'} />
                  <span>UI Scaling</span>
                </button>

                <button
                  onClick={() => setActiveTab('account')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                    activeTab === 'account'
                      ? 'bg-[var(--bg-hover)] text-white font-semibold border border-[var(--border-secondary)]'
                      : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-panel)]'
                  }`}
                >
                  <User size={14} className={activeTab === 'account' ? 'text-[var(--purple)]' : 'text-[var(--text-muted)]'} />
                  <span>Account & Profile</span>
                </button>

                <button
                  onClick={() => setActiveTab('performance')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                    activeTab === 'performance'
                      ? 'bg-[var(--bg-hover)] text-white font-semibold border border-[var(--border-secondary)]'
                      : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-panel)]'
                  }`}
                >
                  <Zap size={14} className={activeTab === 'performance' ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'} />
                  <span>Performance</span>
                </button>

                <button
                  onClick={() => setActiveTab('shortcuts')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                    activeTab === 'shortcuts'
                      ? 'bg-[var(--bg-hover)] text-white font-semibold border border-[var(--border-secondary)]'
                      : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-panel)]'
                  }`}
                >
                  <Keyboard size={14} className={activeTab === 'shortcuts' ? 'text-[var(--warning)]' : 'text-[var(--text-muted)]'} />
                  <span>Shortcuts</span>
                </button>
              </div>

              {/* Right Settings Body */}
              <div className="flex-1 p-6 overflow-y-auto space-y-6 text-xs text-[var(--text-primary)]">
                {/* ─── Tab: General ───────────────────────────────────────── */}
                {activeTab === 'general' && (
                  <div className="space-y-6">
                    {/* Theme Colors with Reset in General Settings */}
                    <ThemeColorSettings />

                    <div className="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-primary)] space-y-3">
                      <h4 className="text-xs font-bold text-white">Startup Preferences</h4>
                      <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
                        <div>
                          <p className="font-semibold text-white">Default Launch Tab</p>
                          <p className="text-[11px] text-[var(--text-muted)]">Page loaded on initial app open</p>
                        </div>
                        <select
                          value={defaultPage}
                          onChange={(e) => setDefaultPage(e.target.value)}
                          className="bg-[var(--bg-input)] border border-[var(--border-primary)] rounded-lg px-2.5 py-1 text-xs text-[var(--text-primary)] outline-none"
                        >
                          <option value="/dashboard">Dashboard</option>
                          <option value="/projects">Projects Directory</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between py-2">
                        <div>
                          <p className="font-semibold text-white">Audio & Interaction Chimes</p>
                          <p className="text-[11px] text-[var(--text-muted)]">Play feedback sound when completing tasks</p>
                        </div>
                        <button
                          onClick={() => setSoundEnabled(!soundEnabled)}
                          className={`w-10 h-5 rounded-full transition-colors relative ${
                            soundEnabled ? 'bg-[var(--accent-yellow)]' : 'bg-[var(--bg-hover)]'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-[var(--bg-canvas)] absolute top-0.5 transition-transform ${
                              soundEnabled ? 'left-5.5' : 'left-0.5'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── Tab: Theme ─────────────────────────────────────────── */}
                {activeTab === 'theme' && (
                  <div className="space-y-6">
                    <ThemeColorSettings />
                  </div>
                )}

                {/* ─── Tab: Appearance / UI Scaling ───────────────────────── */}
                {activeTab === 'appearance' && (
                  <div className="space-y-6">
                    {/* UI Scaling Section */}
                    <div className="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-primary)] space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ZoomIn size={16} className="text-[var(--accent-yellow)]" />
                          <div>
                            <h4 className="text-xs font-bold text-white">UI Scale & Zoom</h4>
                            <p className="text-[11px] text-[var(--text-muted)]">
                              Adjust global interface scaling for optimal display and visibility.
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--accent-yellow)] border border-[var(--border-primary)]">
                          {Math.round(uiScale * 100)}%
                        </span>
                      </div>

                      {/* Slider */}
                      <div className="space-y-2">
                        <input
                          type="range"
                          min="0.75"
                          max="1.5"
                          step="0.05"
                          value={uiScale}
                          onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-[var(--bg-hover)] rounded-lg appearance-none cursor-pointer accent-[#DCB001]"
                        />
                        <div className="flex justify-between text-[10px] font-mono text-[var(--text-muted)]">
                          <span>75% (Small)</span>
                          <span>100% (Default: 1.0)</span>
                          <span>150% (Large)</span>
                        </div>
                      </div>

                      {/* Preset Buttons */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {scalePresets.map((preset) => (
                          <button
                            key={preset.value}
                            onClick={() => handleScaleChange(preset.value)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                              Math.abs(uiScale - preset.value) < 0.02
                                ? 'bg-[var(--accent-yellow)] text-[var(--bg-canvas)] font-bold shadow-sm'
                                : 'bg-[var(--bg-input)] text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)] border border-[var(--border-primary)]'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>

                      {/* Reset UI Button */}
                      <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between">
                        <span className="text-[11px] text-[var(--text-muted)]">Restore original 100% scale and settings</span>
                        <button
                          onClick={handleResetUI}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-hover)] hover:bg-[var(--bg-hover-subtle)] text-white text-xs font-semibold transition-all border border-[var(--border-secondary)]"
                        >
                          <RotateCcw size={12} className="text-[var(--accent-yellow)]" />
                          <span>Reset UI</span>
                        </button>
                      </div>
                    </div>

                    {/* Display Density */}
                    <div className="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-primary)] space-y-3">
                      <div className="flex items-center gap-2">
                        <Layers size={16} className="text-[var(--cyan)]" />
                        <div>
                          <h4 className="text-xs font-bold text-white">Display Density</h4>
                          <p className="text-[11px] text-[var(--text-muted)]">Control row padding and list spacing.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'compact', label: 'Compact', desc: 'Dense data grids' },
                          { id: 'standard', label: 'Standard', desc: 'Balanced layout' },
                          { id: 'comfortable', label: 'Comfortable', desc: 'Spacious padding' },
                        ].map((item) => (
                          <button
                            key={item.id}
                            onClick={() => handleDensityChange(item.id as any)}
                            className={`p-2.5 rounded-xl text-left border transition-all ${
                              density === item.id
                                ? 'bg-[var(--bg-hover)] border-[var(--cyan)] text-white shadow-sm'
                                : 'bg-[var(--bg-card)] border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--border-secondary)]'
                            }`}
                          >
                            <p className="font-bold text-xs">{item.label}</p>
                            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{item.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── Tab: Account ───────────────────────────────────────── */}
                {activeTab === 'account' && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-primary)] flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-[var(--accent-yellow)] text-[var(--bg-canvas)] font-bold text-lg flex items-center justify-center font-mono shadow-md">
                        {(currentUser?.name || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-white truncate">{currentUser?.name || 'Developer User'}</p>
                        <p className="text-xs font-mono text-[var(--text-muted)] truncate">{currentUser?.email || 'test@teader.io'}</p>
                        <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.2 rounded bg-[var(--success-bg)] text-[var(--success)] text-[10px] font-mono font-medium border border-[var(--success-border)]">
                          <ShieldCheck size={10} /> Authenticated Active Session
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-primary)] space-y-2 font-mono text-xs">
                      <div className="flex justify-between py-1.5 border-b border-[var(--border-subtle)]">
                        <span className="text-[var(--text-muted)]">Workspace Role</span>
                        <span className="text-[var(--accent-yellow)] font-bold capitalize">{currentUser?.role || 'Project Lead'}</span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="text-[var(--text-muted)]">Storage Connection</span>
                        <span className="text-[var(--success)]">PostgreSQL Enterprise Engine</span>
                      </div>
                    </div>

                    {onLogout && (
                      <button
                        onClick={onLogout}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--danger-bg)] hover:bg-[var(--danger)]/25 text-[var(--danger)] border border-[var(--danger-border)] text-xs font-bold transition-all shadow-sm"
                      >
                        <LogOut size={13} />
                        <span>Sign Out of Session</span>
                      </button>
                    )}
                  </div>
                )}

                {/* ─── Tab: Performance ───────────────────────────────────── */}
                {activeTab === 'performance' && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-primary)] space-y-3 font-mono text-xs">
                      <h4 className="font-bold text-white font-sans">Runtime Environment</h4>
                      <div className="flex justify-between py-1.5 border-b border-[var(--border-subtle)]">
                        <span className="text-[var(--text-muted)]">Client Architecture</span>
                        <span className="text-[var(--cyan)]">{desktopInfo.isDesktop ? 'Electron Desktop Wrapper' : 'Next.js Web Browser'}</span>
                      </div>
                      {desktopInfo.version && (
                        <div className="flex justify-between py-1.5 border-b border-[var(--border-subtle)]">
                          <span className="text-[var(--text-muted)]">Desktop Version</span>
                          <span className="text-[var(--accent-yellow)] font-bold">v{desktopInfo.version}</span>
                        </div>
                      )}
                      <div className="flex justify-between py-1.5">
                        <span className="text-[var(--text-muted)]">Optimistic UI Cache</span>
                        <span className="text-[var(--success)]">0ms Instant Feedback Active</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-primary)] flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-white">Reset Local Workspace Cache</p>
                        <p className="text-[11px] text-[var(--text-muted)]">Clears cached tasks, draft comments, and temporary filters</p>
                      </div>
                      <button
                        onClick={handleClearCache}
                        className="px-3 py-1.5 bg-[var(--bg-hover)] hover:bg-[var(--bg-hover-subtle)] text-white rounded-lg text-xs font-medium transition-colors border border-[var(--border-secondary)]"
                      >
                        Clear Cache
                      </button>
                    </div>
                  </div>
                )}

                {/* ─── Tab: Shortcuts ─────────────────────────────────────── */}
                {activeTab === 'shortcuts' && (
                  <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-primary)] space-y-2 font-mono text-xs">
                      <h4 className="font-bold text-white font-sans mb-3">Global Keyboard Shortcuts</h4>
                      {[
                        { keys: ['⌘', 'K'], desc: 'Open Command Palette & Quick Search' },
                        { keys: ['C'], desc: 'Create New Issue / Task' },
                        { keys: ['F5'], desc: 'Reload View' },
                        { keys: ['G', 'D'], desc: 'Go to Dashboard' },
                        { keys: ['G', 'P'], desc: 'Go to Projects' },
                        { keys: ['Esc'], desc: 'Close open modal / palette' },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between py-1.5 border-b border-[var(--border-subtle)] last:border-0">
                          <span className="text-[var(--text-secondary)] font-sans">{item.desc}</span>
                          <div className="flex items-center gap-1">
                            {item.keys.map((k, ki) => (
                              <kbd key={ki} className="px-1.5 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-primary)] text-[var(--accent-yellow)] font-bold text-[10px]">
                                {k}
                              </kbd>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-[var(--border-primary)] bg-[var(--bg-header)] flex items-center justify-between shrink-0">
              <span className="text-[11px] font-mono text-[var(--text-muted)]">
                Teader Platform Settings • Scale: {Math.round(uiScale * 100)}%
              </span>
              <button
                onClick={onClose}
                className="px-4 py-1.5 bg-[var(--accent-yellow)] hover:bg-[var(--accent-yellow-hover)] text-[var(--bg-canvas)] font-bold text-xs rounded-lg transition-all shadow-sm"
              >
                Done
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
