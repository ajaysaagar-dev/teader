'use client';

import React, { useEffect, useState } from 'react';
import { getDesktopInfo } from '@/lib/desktop';

export const DesktopVersionIndicator: React.FC = () => {
  const [version, setVersion] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    // Initial check
    const checkVersion = () => {
      const info = getDesktopInfo();
      if (info.version) {
        setVersion(info.version);
        setIsDesktop(info.isDesktop);
      } else if (typeof window !== 'undefined' && window.teaderDesktop?.version) {
        setVersion(window.teaderDesktop.version);
        setIsDesktop(true);
      }
    };

    checkVersion();

    // Check again after a small delay in case preload context initializes right after mount
    const timer = setTimeout(checkVersion, 250);
    return () => clearTimeout(timer);
  }, []);

  if (!version) return null;

  return (
    <div className="fixed bottom-2 right-3 z-50 pointer-events-none select-none">
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#0F1011]/80 backdrop-blur-md border border-[#2A2C30]/60 text-[10.5px] font-mono text-[#787C83] tracking-wide shadow-sm">
        {isDesktop && <span className="w-1.5 h-1.5 rounded-full bg-[#DCB001]" />}
        <span>v{version}</span>
      </span>
    </div>
  );
};
