'use client';

import React, { useState, useEffect } from 'react';
import { X, Check, Copy, Laptop, Cpu, ShieldCheck, RefreshCw, Layers } from 'lucide-react';
import { BUILD_NUMBER } from '@/lib/build-info';
import { getDesktopInfo } from '@/lib/desktop';
import { toast } from 'sonner';

interface AppDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  version?: string;
}

export const AppDetailsModal: React.FC<AppDetailsModalProps> = ({
  isOpen,
  onClose,
  version = '1.0.0',
}) => {
  const [copiedBuild, setCopiedBuild] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [desktopData, setDesktopData] = useState<{
    isDesktop: boolean;
    version: string | null;
    platform: string | null;
    electronVersion: string | null;
  }>({
    isDesktop: false,
    version: null,
    platform: null,
    electronVersion: null,
  });

  useEffect(() => {
    if (isOpen) {
      const info = getDesktopInfo();
      setDesktopData(info);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const effectiveVersion = desktopData.version || version;
  const isDesktop = desktopData.isDesktop;
  const platformName = desktopData.platform
    ? desktopData.platform.toUpperCase()
    : typeof navigator !== 'undefined' && navigator.userAgent.includes('Windows')
    ? 'WINDOWS'
    : typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac')
    ? 'MACOS'
    : 'LINUX / WEB';

  const runtimeLabel = isDesktop
    ? `Desktop Client (Electron ${desktopData.electronVersion ? `v${desktopData.electronVersion}` : ''})`
    : 'Web Application Client (Next.js Turbopack)';

  const handleCopyBuild = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(BUILD_NUMBER);
      setCopiedBuild(true);
      toast.success(`Build number copied: ${BUILD_NUMBER}`);
      setTimeout(() => setCopiedBuild(false), 2000);
    }
  };

  const handleCopyAll = () => {
    const detailsText = [
      `Teader Workspace Details`,
      `========================`,
      `Version: v${effectiveVersion}`,
      `Build Number: ${BUILD_NUMBER}`,
      `Runtime: ${runtimeLabel}`,
      `Platform: ${platformName}`,
      `Channel: Production Stable`,
      `Sync Engine: Active (Realtime Streams & Cloud Database)`,
      `Environment: ${process.env.NODE_ENV || 'production'}`,
      `User Agent: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}`,
    ].join('\n');

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(detailsText);
      setCopiedAll(true);
      toast.success('All application details copied to clipboard');
      setTimeout(() => setCopiedAll(false), 2000);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-details-title"
      className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150 select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#121212] border border-[#2B2B2B] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative p-5 pb-4 border-b border-[#222222] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl from-[#8400FF] to-[#FF0051] p-0.5 flex items-center justify-center">
              <div className="w-full h-full bg-[#141414] flex items-center justify-center">
                <img src="/logo.svg" alt="Teader" className="w-5 h-5 object-contain" />
              </div>
            </div>
            <div>
              <h2 id="app-details-title" className="text-base font-bold text-white tracking-tight leading-none">
                Teader App
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-white hover:bg-[#222222] transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content Details Grid */}
        <div className="p-5 space-y-4 text-xs">
          {/* Key Metric Highlights */}
          <div className="grid grid-cols-2 gap-3">
            {/* Version */}
            <div className="p-3 rounded-xl bg-[#181818] border border-[#262626] flex flex-col justify-between space-y-1">
              <span className="text-[11px] font-semibold text-[var(--text-muted)] flex items-center gap-1.5">
                <Layers size={13} className="text-[#8400FF]" />
                Version
              </span>
              <div className="flex items-baseline gap-1.5 pt-0.5">
                <span className="font-mono text-base font-bold text-white">v{effectiveVersion}</span>
                <span className="text-[10px] font-mono text-[#CCA5FD] px-1.5 py-0.2 bg-[#8400FF]/20 rounded border border-[#8400FF]/40">
                  Stable
                </span>
              </div>
            </div>

            {/* Build Number */}
            <div className="p-3 rounded-xl bg-[#181818] border border-[#262626] flex flex-col justify-between space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[var(--text-muted)] flex items-center gap-1.5">
                  <Cpu size={13} className="text-[#FF0051]" />
                  Build Number
                </span>
                <button
                  type="button"
                  onClick={handleCopyBuild}
                  title="Copy build number"
                  className="text-[10px] text-[#CCA5FD] hover:text-white flex items-center gap-0.5 cursor-pointer font-mono"
                >
                  {copiedBuild ? <Check size={11} className="text-[#CCA5FD]" /> : <Copy size={11} />}
                  <span>{copiedBuild ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="pt-0.5">
                <span className="font-mono text-xs font-semibold text-white tracking-tight break-all">
                  {BUILD_NUMBER}
                </span>
              </div>
            </div>
          </div>

          {/* Detailed System Specifications */}
          <div className="rounded-xl bg-[#181818] border border-[#262626] divide-y divide-[#222222] overflow-hidden">
            <div className="p-2.5 px-3 flex items-center justify-between">
              <span className="text-[var(--text-secondary)] flex items-center gap-2">
                <Laptop size={13} className="text-[#CCA5FD]" /> Client Runtime
              </span>
              <span className="font-mono text-white text-[11px] text-right font-medium">
                {isDesktop ? 'Desktop App (Electron)' : 'Web Client (Next.js)'}
              </span>
            </div>

            {isDesktop && desktopData.electronVersion && (
              <div className="p-2.5 px-3 flex items-center justify-between">
                <span className="text-[var(--text-secondary)]">Electron Framework</span>
                <span className="font-mono text-white text-[11px]">v{desktopData.electronVersion}</span>
              </div>
            )}

            <div className="p-2.5 px-3 flex items-center justify-between">
              <span className="text-[var(--text-secondary)] flex items-center gap-2">
                <ShieldCheck size={13} className="text-[#8400FF]" /> Target Platform
              </span>
              <span className="font-mono text-white text-[11px]">{platformName}</span>
            </div>

            <div className="p-2.5 px-3 flex items-center justify-between">
              <span className="text-[var(--text-secondary)] flex items-center gap-2">
                <RefreshCw size={13} className="text-[#FF0051]" /> Realtime Sync Engine
              </span>
              <div className="flex items-center gap-1.5 font-mono text-[11px] text-white">
                <span className="w-1.5 h-1.5 rounded-full bg-[#8400FF] shadow-[0_0_6px_rgba(132,0,255,0.8)]" />
                <span>Connected (Active)</span>
              </div>
            </div>

            <div className="p-2.5 px-3 flex items-center justify-between">
              <span className="text-[var(--text-secondary)]">Environment</span>
              <span className="font-mono text-white text-[11px] capitalize">
                {process.env.NODE_ENV || 'production'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#0F0F0F] border-t border-[#222222] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleCopyAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181818] hover:bg-[#222222] border border-[#2B2B2B] text-xs text-[var(--text-secondary)] hover:text-white transition-all cursor-pointer font-medium"
          >
            {copiedAll ? <Check size={12} className="text-[#CCA5FD]" /> : <Copy size={12} />}
            <span>{copiedAll ? 'Details Copied' : 'Copy All Details'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white text-black hover:bg-[#EDEDED] font-semibold text-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
