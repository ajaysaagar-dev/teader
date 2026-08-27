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
  ZoomIn
} from 'lucide-react';
import { toast } from 'sonner';
import { applyUIScale, resetUIScale, getSavedUIScale, DEFAULT_UI_SCALE } from './UIScaleInitializer';
import { getDesktopInfo } from '@/lib/desktop';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: any;
  onLogout?: () => void;
}

type TabType = 'appearance' | 'general' | 'account' | 'performance' | 'shortcuts';

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
            className="w-full max-w-3xl bg-[#111215] border border-[#2A2C30] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#2A2C30] bg-[#0E0F12] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#DCB001]/15 text-[#DCB001] border border-[#DCB001]/30 flex items-center justify-center font-bold">
                  <Settings size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">Workspace Settings</h3>
                  <p className="text-[11px] font-mono text-[#787C83]">Preferences, Scaling & Configuration</p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[#787C83] hover:text-white hover:bg-[#1C1D21] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Content Split: Sidebar + Panel */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
              {/* Left Navigation Sidebar */}
              <div className="w-48 bg-[#0D0E10] border-r border-[#24262B] p-3 space-y-1 shrink-0 overflow-y-auto">
                <button
                  onClick={() => setActiveTab('appearance')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                    activeTab === 'appearance'
                      ? 'bg-[#1F2126] text-white font-semibold border border-[#2E3138]'
                      : 'text-[#8E939D] hover:text-white hover:bg-[#16171A]'
                  }`}
                >
                  <SunMoon size={14} className={activeTab === 'appearance' ? 'text-[#DCB001]' : 'text-[#787C83]'} />
                  <span>Appearance</span>
                </button>

                <button
                  onClick={() => setActiveTab('general')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                    activeTab === 'general'
                      ? 'bg-[#1F2126] text-white font-semibold border border-[#2E3138]'
                      : 'text-[#8E939D] hover:text-white hover:bg-[#16171A]'
                  }`}
                >
                  <Sliders size={14} className={activeTab === 'general' ? 'text-[#06B6D4]' : 'text-[#787C83]'} />
                  <span>General</span>
                </button>

                <button
                  onClick={() => setActiveTab('account')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                    activeTab === 'account'
                      ? 'bg-[#1F2126] text-white font-semibold border border-[#2E3138]'
                      : 'text-[#8E939D] hover:text-white hover:bg-[#16171A]'
                  }`}
                >
                  <User size={14} className={activeTab === 'account' ? 'text-[#A855F7]' : 'text-[#787C83]'} />
                  <span>Account & Profile</span>
                </button>

                <button
                  onClick={() => setActiveTab('performance')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                    activeTab === 'performance'
                      ? 'bg-[#1F2126] text-white font-semibold border border-[#2E3138]'
                      : 'text-[#8E939D] hover:text-white hover:bg-[#16171A]'
                  }`}
                >
                  <Zap size={14} className={activeTab === 'performance' ? 'text-[#22C55E]' : 'text-[#787C83]'} />
                  <span>Performance</span>
                </button>

                <button
                  onClick={() => setActiveTab('shortcuts')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                    activeTab === 'shortcuts'
                      ? 'bg-[#1F2126] text-white font-semibold border border-[#2E3138]'
                      : 'text-[#8E939D] hover:text-white hover:bg-[#16171A]'
                  }`}
                >
                  <Keyboard size={14} className={activeTab === 'shortcuts' ? 'text-[#F59E0B]' : 'text-[#787C83]'} />
                  <span>Shortcuts</span>
                </button>
              </div>

              {/* Right Settings Body */}
              <div className="flex-1 p-6 overflow-y-auto space-y-6 text-xs text-[#CFD4DD]">
                {/* ─── Tab: Appearance ────────────────────────────────────── */}
                {activeTab === 'appearance' && (
                  <div className="space-y-6">
                    {/* UI Scaling Section */}
                    <div className="p-4 rounded-xl bg-[#0E0F12] border border-[#24262B] space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ZoomIn size={16} className="text-[#DCB001]" />
                          <div>
                            <h4 className="text-xs font-bold text-white">UI Scale & Zoom</h4>
                            <p className="text-[11px] text-[#787C83]">
                              Adjust global interface scaling for optimal display and visibility.
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#1F2126] text-[#DCB001] border border-[#2A2C30]">
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
                          className="w-full h-1.5 bg-[#222428] rounded-lg appearance-none cursor-pointer accent-[#DCB001]"
                        />
                        <div className="flex justify-between text-[10px] font-mono text-[#787C83]">
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
                                ? 'bg-[#DCB001] text-[#0A0B0D] font-bold shadow-sm'
                                : 'bg-[#181A1E] text-[#9BA1A6] hover:text-white hover:bg-[#202227] border border-[#26282E]'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>

                      {/* Reset UI Button */}
                      <div className="pt-2 border-t border-[#222428] flex items-center justify-between">
                        <span className="text-[11px] text-[#787C83]">Restore original 100% scale and settings</span>
                        <button
                          onClick={handleResetUI}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#222428] hover:bg-[#2E3138] text-white text-xs font-semibold transition-all border border-[#2E3138]"
                        >
                          <RotateCcw size={12} className="text-[#DCB001]" />
                          <span>Reset UI</span>
                        </button>
                      </div>
                    </div>

                    {/* Display Density */}
                    <div className="p-4 rounded-xl bg-[#0E0F12] border border-[#24262B] space-y-3">
                      <div className="flex items-center gap-2">
                        <Layers size={16} className="text-[#06B6D4]" />
                        <div>
                          <h4 className="text-xs font-bold text-white">Display Density</h4>
                          <p className="text-[11px] text-[#787C83]">Control row padding and list spacing.</p>
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
                                ? 'bg-[#1A1C20] border-[#06B6D4] text-white shadow-sm'
                                : 'bg-[#121316] border-[#222428] text-[#8E939D] hover:border-[#2E3138]'
                            }`}
                          >
                            <p className="font-bold text-xs">{item.label}</p>
                            <p className="text-[10px] text-[#787C83] mt-0.5">{item.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── Tab: General ───────────────────────────────────────── */}
                {activeTab === 'general' && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-[#0E0F12] border border-[#24262B] space-y-3">
                      <h4 className="text-xs font-bold text-white">Startup Preferences</h4>
                      <div className="flex items-center justify-between py-2 border-b border-[#222428]">
                        <div>
                          <p className="font-semibold text-white">Default Launch Tab</p>
                          <p className="text-[11px] text-[#787C83]">Page loaded on initial app open</p>
                        </div>
                        <select
                          value={defaultPage}
                          onChange={(e) => setDefaultPage(e.target.value)}
                          className="bg-[#181A1E] border border-[#2A2C30] rounded-lg px-2.5 py-1 text-xs text-[#CFD4DD] outline-none"
                        >
                          <option value="/dashboard">Dashboard</option>
                          <option value="/projects">Projects Directory</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between py-2">
                        <div>
                          <p className="font-semibold text-white">Audio & Interaction Chimes</p>
                          <p className="text-[11px] text-[#787C83]">Play feedback sound when completing tasks</p>
                        </div>
                        <button
                          onClick={() => setSoundEnabled(!soundEnabled)}
                          className={`w-10 h-5 rounded-full transition-colors relative ${
                            soundEnabled ? 'bg-[#DCB001]' : 'bg-[#26282E]'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-[#0A0B0D] absolute top-0.5 transition-transform ${
                              soundEnabled ? 'left-5.5' : 'left-0.5'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── Tab: Account ───────────────────────────────────────── */}
                {activeTab === 'account' && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-[#0E0F12] border border-[#24262B] flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-[#DCB001] text-[#0A0B0D] font-bold text-lg flex items-center justify-center font-mono shadow-md">
                        {(currentUser?.name || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-white truncate">{currentUser?.name || 'Developer User'}</p>
                        <p className="text-xs font-mono text-[#787C83] truncate">{currentUser?.email || 'test@teader.io'}</p>
                        <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.2 rounded bg-[#22C55E]/15 text-[#22C55E] text-[10px] font-mono font-medium border border-[#22C55E]/30">
                          <ShieldCheck size={10} /> Authenticated Active Session
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-[#0E0F12] border border-[#24262B] space-y-2 font-mono text-xs">
                      <div className="flex justify-between py-1.5 border-b border-[#222428]">
                        <span className="text-[#787C83]">Workspace Role</span>
                        <span className="text-[#DCB001] font-bold capitalize">{currentUser?.role || 'Project Lead'}</span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="text-[#787C83]">Storage Connection</span>
                        <span className="text-[#22C55E]">PostgreSQL Enterprise Engine</span>
                      </div>
                    </div>

                    {onLogout && (
                      <button
                        onClick={onLogout}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#EF4444]/15 hover:bg-[#EF4444]/25 text-[#EF4444] border border-[#EF4444]/30 text-xs font-bold transition-all shadow-sm"
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
                    <div className="p-4 rounded-xl bg-[#0E0F12] border border-[#24262B] space-y-3 font-mono text-xs">
                      <h4 className="font-bold text-white font-sans">Runtime Environment</h4>
                      <div className="flex justify-between py-1.5 border-b border-[#222428]">
                        <span className="text-[#787C83]">Client Architecture</span>
                        <span className="text-[#06B6D4]">{desktopInfo.isDesktop ? 'Electron Desktop Wrapper' : 'Next.js Web Browser'}</span>
                      </div>
                      {desktopInfo.version && (
                        <div className="flex justify-between py-1.5 border-b border-[#222428]">
                          <span className="text-[#787C83]">Desktop Version</span>
                          <span className="text-[#DCB001] font-bold">v{desktopInfo.version}</span>
                        </div>
                      )}
                      <div className="flex justify-between py-1.5">
                        <span className="text-[#787C83]">Optimistic UI Cache</span>
                        <span className="text-[#22C55E]">0ms Instant Feedback Active</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-[#0E0F12] border border-[#24262B] flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-white">Reset Local Workspace Cache</p>
                        <p className="text-[11px] text-[#787C83]">Clears cached tasks, draft comments, and temporary filters</p>
                      </div>
                      <button
                        onClick={handleClearCache}
                        className="px-3 py-1.5 bg-[#222428] hover:bg-[#2E3138] text-white rounded-lg text-xs font-medium transition-colors border border-[#2E3138]"
                      >
                        Clear Cache
                      </button>
                    </div>
                  </div>
                )}

                {/* ─── Tab: Shortcuts ─────────────────────────────────────── */}
                {activeTab === 'shortcuts' && (
                  <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-[#0E0F12] border border-[#24262B] space-y-2 font-mono text-xs">
                      <h4 className="font-bold text-white font-sans mb-3">Global Keyboard Shortcuts</h4>
                      {[
                        { keys: ['⌘', 'K'], desc: 'Open Command Palette & Quick Search' },
                        { keys: ['C'], desc: 'Create New Issue / Task' },
                        { keys: ['F5'], desc: 'Reload View' },
                        { keys: ['G', 'D'], desc: 'Go to Dashboard' },
                        { keys: ['G', 'P'], desc: 'Go to Projects' },
                        { keys: ['Esc'], desc: 'Close open modal / palette' },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between py-1.5 border-b border-[#222428]/60 last:border-0">
                          <span className="text-[#9BA1A6] font-sans">{item.desc}</span>
                          <div className="flex items-center gap-1">
                            {item.keys.map((k, ki) => (
                              <kbd key={ki} className="px-1.5 py-0.5 rounded bg-[#181A1E] border border-[#2A2C30] text-[#DCB001] font-bold text-[10px]">
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
            <div className="px-6 py-3.5 border-t border-[#2A2C30] bg-[#0E0F12] flex items-center justify-between shrink-0">
              <span className="text-[11px] font-mono text-[#787C83]">
                Teader Platform Settings • Scale: {Math.round(uiScale * 100)}%
              </span>
              <button
                onClick={onClose}
                className="px-4 py-1.5 bg-[#DCB001] hover:bg-[#E5B800] text-[#0A0B0D] font-bold text-xs rounded-lg transition-all shadow-sm"
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
