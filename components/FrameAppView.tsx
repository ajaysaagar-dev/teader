'use client';

import React, { useState, useEffect } from 'react';
import { TopFrame } from '@/components/TopFrame';
import Link from 'next/link';

interface FrameAppViewProps {
  initialVersion?: string;
}

export const FrameAppView: React.FC<FrameAppViewProps> = () => {
  const [isWorkspaceMode, setIsWorkspaceMode] = useState<boolean>(false);
  const [electronVersion, setElectronVersion] = useState<string>('1.0.0');
  const [isElectronConnected, setIsElectronConnected] = useState<boolean>(false);

  useEffect(() => {
    async function initDesktopConnection() {
      if (typeof window === 'undefined') return;

      if (window.electron && typeof window.electron.getVersion === 'function') {
        try {
          const v = await window.electron.getVersion();
          if (v) {
            setElectronVersion(v);
            setIsElectronConnected(true);
          }
        } catch (e) {
          console.warn('Electron version check error:', e);
        }
      } else if (window.teaderDesktop?.version) {
        setElectronVersion(window.teaderDesktop.version);
        setIsElectronConnected(true);
      }
    }

    initDesktopConnection();
  }, []);

  return (
    <div className="w-screen h-screen min-h-screen overflow-hidden bg-black text-white flex flex-col p-[19px] box-border select-none font-sans">
      {/* ─── Top Header Frame: Title, Version & Window Controls ──────── */}
      <TopFrame />

      {/* ─── Main Box: Sidebar View & Main App View ──────────────────── */}
      <div className="mt-[15px] flex-1 flex flex-row overflow-hidden bg-[#1E1E1E] rounded-[5px] border-2 border-[rgba(255,255,255,0.13)] box-border">
        {/* Left Sidebar View */}
        <section
          aria-label="Sidebar View"
          className="w-[368px] min-w-[260px] max-w-[368px] h-full border-r-2 border-[rgba(255,255,255,0.13)] bg-[#1E1E1E] flex flex-col items-center justify-center p-6 text-center shrink-0 relative group transition-colors"
        >
          <div className="flex flex-col items-center justify-center gap-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white select-none">
              [Sidebar View]
            </h2>
            {isWorkspaceMode && (
              <div className="mt-4 flex flex-col gap-2 w-full max-w-[200px] text-xs">
                <Link
                  href="/dashboard"
                  className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  href="/projects"
                  className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
                >
                  Projects
                </Link>
                <Link
                  href="/documentation"
                  className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
                >
                  Documentation
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* Right Main App View */}
        <main
          aria-label="Main App View"
          className="flex-1 h-full bg-[#1E1E1E] flex flex-col items-center justify-center p-8 text-center relative overflow-hidden"
        >
          <div className="flex flex-col items-center justify-center gap-3">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white select-none">
              [Main App View]
            </h1>
            <p className="text-xs sm:text-sm text-white/40 font-mono max-w-md">
              {isElectronConnected
                ? `Electron Desktop Client Active • Version v${electronVersion}`
                : 'Web Viewer Runtime • Frameless UI Window'}
            </p>
          </div>
        </main>
      </div>

      {/* ─── Bottom Frame: Status Bar View ──────────────────────────── */}
      <footer
        role="contentinfo"
        aria-label="Status Bar View"
        className="mt-[11px] h-[42px] min-h-[42px] flex items-center justify-center bg-[#1E1E1E] rounded-[5px] border-2 border-[rgba(255,255,255,0.13)] px-4 box-border shrink-0 select-none"
      >
        <span className="text-[14px] sm:text-[15px] font-medium text-white tracking-normal">
          [StatusBar View]
        </span>
      </footer>
    </div>
  );
};
