'use client';

import React from 'react';
import { BUILD_NUMBER } from '@/lib/build-info';

export const DesktopVersionIndicator: React.FC = () => {
  return (
    <div
      data-testid="teader-build-indicator"
      className="fixed bottom-0 right-0 z-[99999] pointer-events-auto select-none opacity-50 hover:opacity-0 transition-opacity"
    >
      <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg- backdrop-blur-md border border-[0] hover:border-[#DCB001]/50 text-[8px] font-mono text-[#9BA1A6] hover:text-white tracking-normal shadow-lg transition-all">
        <span className="font-semibold text-white text-[8px]">{BUILD_NUMBER}</span>
      </div>
    </div>
  );
};
