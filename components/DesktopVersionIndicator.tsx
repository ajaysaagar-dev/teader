'use client';

import React from 'react';
import { BUILD_NUMBER } from '@/lib/build-info';

export const DesktopVersionIndicator: React.FC = () => {
  return (
    <aside
      aria-label="Build Number"
      className="fixed bottom-2 right-3 z-[99999] pointer-events-none select-none"
    >
      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#0F1011]/90 backdrop-blur-md border border-[#2A2C30] text-[10.5px] font-mono text-[#8E939D] tracking-wide shadow-md">
        <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
        <span className="font-semibold text-white/90">{BUILD_NUMBER}</span>
      </div>
    </aside>
  );
};
