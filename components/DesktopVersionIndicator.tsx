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
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0E0F12]/95 backdrop-blur-md border border-[#2A2C30] hover:border-[#DCB001]/60 text-mono text-[#9BA1A6] hover:text-white tracking-wide shadow-2xl transition-all cursor-pointer"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse shadow-[0_0_6px_#22C55E]" />
        <span className="text-[#DCB001] font-bold text-[10px] tracking-wider uppercase">BUILD:</span>
        <span className="font-semibold text-white text-[11px] tracking-tight">
          {copied ? 'COPIED!' : BUILD_NUMBER}
        </span>
      </button>
    </aside>
  );
};

