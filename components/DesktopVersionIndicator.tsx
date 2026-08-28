'use client';

import React from 'react';
import { BUILD_NUMBER } from '@/lib/build-info';

export const DesktopVersionIndicator: React.FC = () => {
  return (
    <div
      data-testid="teader-build-indicator"
      className="fixed bottom-2.5 right-3 z-[99999] pointer-events-auto select-none"
    >
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0F1011]/95 backdrop-blur-md border border-[#2A2C30] hover:border-[#DCB001]/60 text-[11px] font-mono text-[#9BA1A6] hover:text-white tracking-wide shadow-2xl transition-all">
        <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse shadow-[0_0_6px_#22C55E]" />
        <span className="text-[#DCB001] font-bold text-[10px]">BUILD:</span>
        <span className="font-semibold text-white">{BUILD_NUMBER}</span>
      </div>
    </div>
  );
};
