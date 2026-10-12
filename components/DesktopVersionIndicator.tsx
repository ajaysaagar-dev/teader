'use client';

import React, { useState } from 'react';
import { BUILD_NUMBER } from '@/lib/build-info';

export const DesktopVersionIndicator: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(BUILD_NUMBER);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <aside
      aria-label="Build Number"
      data-testid="teader-build-indicator"
      className="fixed bottom-2.5 right-3 z-[99999] pointer-events-auto select-none opacity-90 hover:opacity-100 transition-opacity"
      title={`Build: ${BUILD_NUMBER} (Click to copy)`}
    >
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#000000]/95 backdrop-blur-md border border-[var(--border-primary)] hover:border-[var(--border-secondary)] text-mono text-[var(--text-secondary)] hover:text-white tracking-wide shadow-2xl transition-all cursor-pointer"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--ramp-3)] animate-pulse shadow-[0_0_6px_#FFFFFF]" />
        <span className="text-white font-bold text-[10px] tracking-wider uppercase">BUILD:</span>
        <span className="font-semibold text-white text-[11px] tracking-tight">
          {copied ? 'COPIED!' : BUILD_NUMBER}
        </span>
      </button>
    </aside>
  );
};

