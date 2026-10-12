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
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0A0A0A] border border-[var(--border-primary)] hover:border-[var(--border-secondary)] text-[var(--text-secondary)] hover:text-white tracking-wide shadow-lg transition-all cursor-pointer"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
        <span className="text-[var(--text-muted)] font-normal text-[11px]">Build</span>
        <span className="font-mono text-white text-[11px] tracking-tight">
          {copied ? 'Copied' : BUILD_NUMBER}
        </span>
      </button>
    </aside>
  );
};

