'use client';

import React from 'react';
import { BUILD_NUMBER } from '@/lib/build-info';

export const DesktopVersionIndicator: React.FC = () => {
  return (
    <div
      data-testid="teader-build-indicator"
      className="fixed bottom-1.5 right-2 z-[99999] pointer-events-auto select-none opacity-80 hover:opacity-100 transition-opacity"
    >
      <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#0F1011]/90 backdrop-blur-md border border-[#2A2C30] hover:border-[#DCB001]/50 text-[8px] font-mono text-[#9BA1A6] hover:text-white tracking-normal shadow-lg transition-all">
        <span className="w-1 h-1 rounded-full bg-[#22C55E] animate-pulse shadow-[0_0_3px_#22C55E]" />
        <span className="text-[#DCB001] font-bold text-[7.5px]">BUILD:</span>
        <span className="font-semibold text-white text-[8px]">{BUILD_NUMBER}</span>
      </div>
    </div>
  );
};
