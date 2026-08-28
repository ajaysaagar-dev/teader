'use client';

import React from 'react';
import { BUILD_NUMBER } from '@/lib/build-info';

export const DesktopVersionIndicator: React.FC = () => {
  return (
    <div className="fixed bottom-2 right-3 z-50 pointer-events-none select-none">
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#0F1011]/85 backdrop-blur-md border border-[#2A2C30]/70 text-[10.5px] font-mono text-[#787C83] tracking-wide shadow-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-[#DCB001]" />
        <span className="font-semibold text-[#8E939D]">{BUILD_NUMBER}</span>
      </span>
    </div>
  );
};
