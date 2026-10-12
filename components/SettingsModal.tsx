'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings,
  Sliders,
  User,
  RotateCcw,
  X,
  Keyboard,
  ShieldCheck,
  LogOut,
  Sparkles,
  ZoomIn,
  Monitor,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { applyUIScale, resetUIScale, getSavedUIScale, DEFAULT_UI_SCALE } from './UIScaleInitializer';
import { getDesktopInfo } from '@/lib/desktop';
import { CustomDropdown } from './ui/CustomDropdown';
import { Avatar } from './ui/Avatar';
import { ProfileAvatarPickerModal } from './ProfileAvatarPickerModal';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: any;
  onLogout?: () => void;
}

type TabType = 'general' | 'account' | 'shortcuts';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [uiScale, setUiScale] = useState<number>(DEFAULT_UI_SCALE);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [defaultPage, setDefaultPage] = useState('/dashboard');
  const [desktopInfo, setDesktopInfo] = useState<{ isDesktop: boolean; version: string | null; platform: string | null }>({
    isDesktop: false,
    version: null,
    platform: null,
  });
  const [user, setUser] = useState<any>(currentUser);
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);

  useEffect(() => {
    setUser(currentUser);
  }, [currentUser]);

  useEffect(() => {
    const handleUserUpdate = (e: any) => {
      if (e.detail) {
        setUser(e.detail);
      }
    };
    window.addEventListener('teader_user_updated', handleUserUpdate);
    return () => window.removeEventListener('teader_user_updated', handleUserUpdate);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setUiScale(getSavedUIScale());
      setDesktopInfo(getDesktopInfo());
    }
  }, [isOpen]);

  const handleScaleChange = (newScale: number) => {
    setUiScale(newScale);
    applyUIScale(newScale);
  };

  const handleResetUI = () => {
    resetUIScale();
    setUiScale(DEFAULT_UI_SCALE);
    toast.success('UI reset to default (Scale: 1.0x)');
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
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.16 }}
              className="w-full max-w-3xl bg-[var(--bg-panel)] border border-[var(--border-primary)] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-[var(--border-primary)] bg-[var(--bg-canvas)] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-md bg-[var(--ramp-2)] text-[var(--text-primary)] border border-[var(--border-secondary)] flex items-center justify-center">
                    <Settings size={15} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white tracking-tight">Settings</h3>
                    <p className="text-xs text-[var(--text-muted)]">Preferences and workspace configuration</p>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-hover)] transition-colors focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)]"
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
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors text-left relative focus:outline-none focus:ring-1 focus:ring-white ${
                      activeTab === 'general'
                        ? 'bg-white/10 text-white before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[2px] before:bg-white'
                        : 'text-[var(--text-secondary)] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Sliders size={14} className={activeTab === 'general' ? 'text-white' : 'text-[var(--text-muted)]'} />
                    <span>General</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('account')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors text-left relative focus:outline-none focus:ring-1 focus:ring-white ${
                      activeTab === 'account'
                        ? 'bg-white/10 text-white before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[2px] before:bg-white'
                        : 'text-[var(--text-secondary)] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <User size={14} className={activeTab === 'account' ? 'text-white' : 'text-[var(--text-muted)]'} />
                    <span>Account</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('shortcuts')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors text-left relative focus:outline-none focus:ring-1 focus:ring-white ${
                      activeTab === 'shortcuts'
                        ? 'bg-white/10 text-white before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[2px] before:bg-white'
                        : 'text-[var(--text-secondary)] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Keyboard size={14} className={activeTab === 'shortcuts' ? 'text-white' : 'text-[var(--text-muted)]'} />
                    <span>Shortcuts</span>
                  </button>
                </div>

                {/* Right Settings Body */}
                <div className="flex-1 p-6 overflow-y-auto space-y-6 text-xs text-[var(--text-primary)]">
                  {/* ─── Tab: General ───────────────────────────────────────── */}
                  {activeTab === 'general' && (
                    <div className="space-y-5">
                      {/* UI Scaling Section */}
                      <div className="p-5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-primary)] space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <ZoomIn size={16} className="text-white" />
                            <div>
                              <h4 className="text-sm font-semibold text-white">Interface Scale</h4>
                              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                                Adjust global interface scale for optimal viewing comfort.
                              </p>
                            </div>
                          </div>
                          <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-[var(--ramp-2)] text-white border border-[var(--border-primary)]">
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
                            className="w-full h-1.5 bg-[var(--ramp-2)] rounded-lg appearance-none cursor-pointer accent-white"
                          />
                          <div className="flex justify-between text-[11px] text-[var(--text-muted)] font-mono">
                            <span>75%</span>
                            <span>100% (Default)</span>
                            <span>150%</span>
                          </div>
                        </div>

                        {/* Preset Buttons */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {scalePresets.map((preset) => (
                            <button
                              key={preset.value}
                              onClick={() => handleScaleChange(preset.value)}
                              className={`px-2.5 py-1 rounded text-xs transition-colors focus:outline-none ${
                                Math.abs(uiScale - preset.value) < 0.02
                                  ? 'bg-white text-black font-semibold'
                                  : 'bg-[var(--bg-input)] text-[var(--text-secondary)] hover:text-white hover:bg-[var(--ramp-2)] border border-[var(--border-primary)]'
                              }`}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>

                        {/* Reset UI Button */}
                        <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
                          <span className="text-xs text-[var(--text-muted)]">Restore default 100% scale</span>
                          <button
                            onClick={handleResetUI}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[var(--ramp-2)] hover:bg-[var(--ramp-3)] text-white text-xs font-medium transition-colors border border-[var(--border-secondary)]"
                          >
                            <RotateCcw size={12} />
                            <span>Reset Scale</span>
                          </button>
                        </div>
                      </div>

                      {/* Startup Preferences */}
                      <div className="p-5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-primary)] space-y-4">
                        <h4 className="text-sm font-semibold text-white">Preferences</h4>
                        <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
                          <div>
                            <p className="font-medium text-white">Default Launch View</p>
                            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Page loaded on initial app open</p>
                          </div>
                          <CustomDropdown<string>
                            value={defaultPage}
                            onChange={(val) => setDefaultPage(val)}
                            options={[
                              { value: '/dashboard', label: 'Dashboard' },
                              { value: '/projects', label: 'Projects' },
                            ]}
                            triggerClassName="bg-[var(--bg-input)] border border-[var(--border-primary)] rounded px-3 py-1.5 text-xs text-white hover:border-[var(--border-secondary)]"
                            size="sm"
                          />
                        </div>

                        <div className="flex items-center justify-between py-2">
                          <div>
                            <p className="font-medium text-white">Task Completion Audio</p>
                            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Play subtle feedback sound when completing tasks</p>
                          </div>
                          <button
                            onClick={() => setSoundEnabled(!soundEnabled)}
                            className={`w-10 h-5 rounded-full transition-colors relative focus:outline-none ${
                              soundEnabled ? 'bg-white' : 'bg-[var(--ramp-2)]'
                            }`}
                          >
                            <div
                              className={`w-4 h-4 rounded-full absolute top-0.5 transition-transform ${
                                soundEnabled ? 'left-5 bg-black' : 'left-0.5 bg-[var(--text-muted)]'
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* System & Cache */}
                      <div className="p-5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-primary)] space-y-4">
                        <div className="flex items-center gap-2">
                          <Monitor size={15} className="text-white" />
                          <h4 className="text-sm font-semibold text-white">System & Cache</h4>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-[var(--border-subtle)]">
                          <span className="text-[var(--text-muted)]">Client Environment</span>
                          <span className="text-white font-mono">{desktopInfo.isDesktop ? 'Electron Desktop Wrapper' : 'Web Browser'}</span>
                        </div>
                        {desktopInfo.version && (
                          <div className="flex justify-between py-1.5 border-b border-[var(--border-subtle)]">
                            <span className="text-[var(--text-muted)]">Desktop Version</span>
                            <span className="text-white font-mono">v{desktopInfo.version}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-2">
                          <div>
                            <p className="font-medium text-white">Reset Local Workspace Cache</p>
                            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Clears cached tasks, draft comments, and temporary filters</p>
                          </div>
                          <button
                            onClick={handleClearCache}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--ramp-2)] hover:bg-[var(--ramp-3)] text-white rounded text-xs font-medium transition-colors border border-[var(--border-secondary)]"
                          >
                            <Trash2 size={12} />
                            <span>Clear Cache</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ─── Tab: Account ───────────────────────────────────────── */}
                  {activeTab === 'account' && (
                    <div className="space-y-5">
                      <div className="p-5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-primary)] flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <div
                            className="relative group cursor-pointer"
                            onClick={() => setIsAvatarPickerOpen(true)}
                            title="Click to choose avatar portrait"
                          >
                            <Avatar user={user || currentUser} size="lg" />
                            <div className="absolute inset-0 rounded-full bg-black/70 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-medium">
                              Change
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-white truncate">{(user || currentUser)?.name || 'Developer User'}</p>
                            <p className="text-xs font-mono text-[var(--text-muted)] truncate mt-0.5">{(user || currentUser)?.email || 'test@teader.io'}</p>
                            <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--ramp-2)] text-[var(--text-secondary)] text-[11px] font-mono border border-[var(--border-primary)]">
                              <ShieldCheck size={12} /> Active Session
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsAvatarPickerOpen(true)}
                          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded bg-[var(--ramp-2)] hover:bg-[var(--ramp-3)] text-white border border-[var(--border-secondary)] text-xs font-medium transition-colors"
                        >
                          <Sparkles size={13} />
                          <span>Change Avatar</span>
                        </button>
                      </div>

                      <div className="p-5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-primary)] space-y-3">
                        <h4 className="text-sm font-semibold text-white">Account Details</h4>
                        <div className="flex justify-between py-1.5 border-b border-[var(--border-subtle)]">
                          <span className="text-[var(--text-muted)]">Workspace Role</span>
                          <span className="text-white font-medium capitalize">{currentUser?.role || 'Project Lead'}</span>
                        </div>
                        <div className="flex justify-between py-1.5">
                          <span className="text-[var(--text-muted)]">Storage Engine</span>
                          <span className="text-white font-mono">PostgreSQL</span>
                        </div>
                      </div>

                      {onLogout && (
                        <div className="pt-2">
                          <button
                            onClick={onLogout}
                            className="flex items-center gap-2 px-4 py-2 rounded bg-[var(--ramp-2)] hover:bg-[var(--ramp-3)] text-white border border-[var(--border-secondary)] text-xs font-medium transition-colors"
                          >
                            <LogOut size={14} />
                            <span>Sign Out of Session</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ─── Tab: Shortcuts ─────────────────────────────────────── */}
                  {activeTab === 'shortcuts' && (
                    <div className="space-y-4">
                      <div className="p-5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-primary)] space-y-2.5">
                        <h4 className="text-sm font-semibold text-white mb-3">Global Keyboard Shortcuts</h4>
                        {[
                          { keys: ['⌘', 'K'], desc: 'Open Command Palette & Quick Search' },
                          { keys: ['C'], desc: 'Create New Issue / Task' },
                          { keys: ['F5'], desc: 'Reload View' },
                          { keys: ['G', 'D'], desc: 'Go to Dashboard' },
                          { keys: ['G', 'P'], desc: 'Go to Projects' },
                          { keys: ['Esc'], desc: 'Close open modal / palette' },
                        ].map((item, i) => (
                          <div key={i} className="flex items-center justify-between py-1.5 border-b border-[var(--border-subtle)] last:border-0">
                            <span className="text-[var(--text-secondary)]">{item.desc}</span>
                            <div className="flex items-center gap-1.5">
                              {item.keys.map((k, ki) => (
                                <kbd key={ki} className="px-1.5 py-0.5 rounded bg-[var(--ramp-2)] border border-[var(--border-primary)] text-white font-mono font-medium text-[11px]">
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
              <div className="px-6 py-3 border-t border-[var(--border-primary)] bg-[var(--bg-canvas)] flex items-center justify-between shrink-0">
                <span className="text-[11px] text-[var(--text-muted)] font-mono">
                  Scale: {Math.round(uiScale * 100)}%
                </span>
                <button
                  onClick={onClose}
                  className="px-4 py-1.5 bg-white hover:bg-neutral-200 text-black font-medium text-xs rounded transition-colors"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Profile Avatar Selection Modal */}
      <ProfileAvatarPickerModal
        isOpen={isAvatarPickerOpen}
        onClose={() => setIsAvatarPickerOpen(false)}
        currentAvatar={(user || currentUser)?.avatar}
        onAvatarUpdated={(newAvatar, updatedUser) => {
          setUser(updatedUser);
        }}
      />
    </>
  );
};
