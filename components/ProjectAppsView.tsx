'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  ExternalLink,
  RotateCw,
  Maximize2,
  Minimize2,
  ArrowLeft,
  Share2
} from 'lucide-react';

export interface AppDefinition {
  id: string;
  name: string;
  defaultUrl: string;
  iconBg: string;
  iconColor: string;
}

const DEFAULT_APPS: AppDefinition[] = [
  {
    id: 'google',
    name: 'Google',
    defaultUrl: 'https://www.google.com/webhp?igu=1',
    iconBg: 'bg-[#4285F4]/10 border-[#4285F4]/30',
    iconColor: 'text-[#4285F4]'
  }
];

function getIframeSrc(url: string): string {
  if (!url) return '';
  if (url.includes('google.com')) {
    if (url.includes('igu=1')) return url;
    return url + (url.includes('?') ? '&igu=1' : '?igu=1');
  }
  // In Electron desktop app, X-Frame-Options and CSP frame-ancestors are stripped at the network layer
  if (
    typeof window !== 'undefined' &&
    ((window as any).electronAPI ||
      navigator.userAgent.includes('TeaderDesktop') ||
      navigator.userAgent.includes('Electron'))
  ) {
    return url;
  }
  return `/api/apps/proxy?url=${encodeURIComponent(url)}`;
}

interface ProjectAppsViewProps {
  projectId: number | string;
  projectName?: string;
}

export function ProjectAppsView({ projectId }: ProjectAppsViewProps) {
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`teader_last_app_${projectId}`);
      }
    } catch {}
  }, [projectId]);

  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [addressInput, setAddressInput] = useState<string>('');
  const [iframeKey, setIframeKey] = useState<number>(0);
  const [isLoadingIframe, setIsLoadingIframe] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeApp = DEFAULT_APPS.find((a) => a.id === selectedAppId) || null;

  // Open an app
  const handleOpenApp = (app: AppDefinition, initialUrl?: string) => {
    const urlToLoad = initialUrl || app.defaultUrl;
    setSelectedAppId(app.id);
    setCurrentUrl(urlToLoad);
    setAddressInput(urlToLoad);
    setIsLoadingIframe(true);
    setIframeKey((prev) => prev + 1);
  };

  // Close active app view back to apps directory
  const handleBackToCatalog = () => {
    setSelectedAppId(null);
    setCurrentUrl('');
    setAddressInput('');
  };

  // Navigate or search from address bar
  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addressInput.trim()) return;

    let target = addressInput.trim();

    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      if (target.includes('.') && !target.includes(' ')) {
        target = `https://${target}`;
      } else {
        target = `https://www.google.com/search?q=${encodeURIComponent(target)}&igu=1`;
      }
    } else if (target.includes('google.com') && !target.includes('igu=1')) {
      target = target + (target.includes('?') ? '&igu=1' : '?igu=1');
    }

    setCurrentUrl(target);
    setAddressInput(target);
    setIsLoadingIframe(true);
    setIframeKey((prev) => prev + 1);
  };

  // Refresh iframe
  const handleReload = () => {
    setIsLoadingIframe(true);
    setIframeKey((prev) => prev + 1);
  };

  // Open external window
  const handleOpenExternal = (urlToOpen?: string) => {
    const u = urlToOpen || currentUrl || activeApp?.defaultUrl || 'https://www.google.com';
    window.open(u, '_blank', 'noopener,noreferrer');
  };

  // Pop out auxiliary window
  const handlePopOutWindow = () => {
    const u = currentUrl || activeApp?.defaultUrl || 'https://www.google.com';
    window.open(u, '_blank', 'width=1180,height=800,menubar=no,status=no,toolbar=no');
  };

  return (
    <div
      ref={containerRef}
      className={`flex-1 flex flex-col h-full min-h-0 bg-[#141518] text-[#CFD4DD] select-none ${
        isFullscreen ? 'fixed inset-0 z-50 bg-[#141518]' : 'relative'
      }`}
    >
      {/* ------------------------------------------------------------- */}
      {/* ACTIVE GOOGLE VIEW                                            */}
      {/* ------------------------------------------------------------- */}
      {activeApp ? (
        <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
          {/* Top Browser Bar */}
          <div className="h-12 border-b border-[#2A2C30] bg-[#1B1C20] px-3 flex items-center justify-between gap-3 shrink-0">
            {/* Left: Back button & App Logo/Name */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleBackToCatalog}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#787C83] hover:text-[#CFD4DD] hover:bg-[#2A2C30] transition-colors cursor-pointer"
                title="Back to Apps"
              >
                <ArrowLeft size={14} />
                <span>Apps</span>
              </button>

              <div className="h-4 w-px bg-[#2A2C30]" />

              <div className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-md flex items-center justify-center border ${activeApp.iconBg}`}
                >
                  <AppIcon app={activeApp} size={14} />
                </div>
                <span className="text-xs font-semibold text-white tracking-tight">
                  {activeApp.name}
                </span>
              </div>
            </div>

            {/* Middle: Address / Search Bar */}
            <form onSubmit={handleAddressSubmit} className="flex-1 max-w-2xl min-w-0">
              <div className="relative flex items-center">
                <div className="absolute left-3 text-[#787C83] pointer-events-none">
                  <Search size={13} />
                </div>
                <input
                  type="text"
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                  placeholder="Search Google or enter query..."
                  className="w-full bg-[#141518] border border-[#2A2C30] focus:border-[#DCB001] text-xs text-[#CFD4DD] placeholder-[#787C83] rounded-lg pl-8 pr-16 py-1.5 focus:outline-none transition-colors"
                />
                <button
                  type="submit"
                  className="absolute right-1.5 px-2 py-0.5 bg-[#2A2C30] hover:bg-[#DCB001] hover:text-black text-[11px] font-medium text-[#CFD4DD] rounded transition-colors cursor-pointer"
                >
                  Go
                </button>
              </div>
            </form>

            {/* Right: Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleReload}
                className="p-1.5 text-[#787C83] hover:text-[#CFD4DD] hover:bg-[#2A2C30] rounded-lg transition-colors cursor-pointer"
                title="Reload"
              >
                <RotateCw size={14} className={isLoadingIframe ? 'animate-spin text-[#DCB001]' : ''} />
              </button>

              <button
                onClick={handlePopOutWindow}
                className="p-1.5 text-[#787C83] hover:text-[#CFD4DD] hover:bg-[#2A2C30] rounded-lg transition-colors cursor-pointer"
                title="Pop out in Separate Window"
              >
                <Share2 size={14} />
              </button>

              <button
                onClick={() => handleOpenExternal()}
                className="p-1.5 text-[#787C83] hover:text-[#CFD4DD] hover:bg-[#2A2C30] rounded-lg transition-colors cursor-pointer"
                title="Open in New Tab"
              >
                <ExternalLink size={14} />
              </button>

              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-1.5 text-[#787C83] hover:text-[#CFD4DD] hover:bg-[#2A2C30] rounded-lg transition-colors cursor-pointer"
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
            </div>
          </div>

          {/* Main App Canvas / Iframe View */}
          <div className="flex-1 w-full h-full min-h-0 relative bg-[#0D0E11] overflow-hidden">
            {/* Loading Indicator */}
            {isLoadingIframe && (
              <div className="absolute inset-0 bg-[#141518]/60 backdrop-blur-xs flex flex-col items-center justify-center z-10 pointer-events-none">
                <div className="w-8 h-8 rounded-full border-2 border-[#2A2C30] border-t-[#DCB001] animate-spin mb-2" />
                <span className="text-xs text-[#787C83] font-medium">Loading Google...</span>
              </div>
            )}

            {/* Embedded Iframe */}
            {currentUrl ? (
              <iframe
                key={iframeKey}
                ref={iframeRef}
                src={getIframeSrc(currentUrl)}
                onLoad={() => setIsLoadingIframe(false)}
                allow="accelerometer; autoplay; camera; clipboard-read; clipboard-write; encrypted-media; fullscreen; gyroscope; microphone; picture-in-picture; web-share"
                className="w-full h-full border-0 bg-white"
                title="Google"
              />
            ) : null}

            {/* Bottom Overlay Info */}
            <div className="absolute bottom-2 right-3 z-10 flex items-center gap-2 bg-[#1B1C20]/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-[#2A2C30] text-[11px] text-[#787C83] shadow-lg">
              <span>Google</span>
              <button
                onClick={() => handleOpenExternal()}
                className="text-[#DCB001] hover:underline flex items-center gap-1 font-medium cursor-pointer"
              >
                <span>Open in Tab</span>
                <ExternalLink size={11} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ------------------------------------------------------------- */
        /* APPS DIRECTORY / CATALOG: ONLY SHOW GOOGLE (LOGO & NAME ONLY) */
        /* ------------------------------------------------------------- */
        <div className="flex-1 flex flex-col items-center justify-center h-full min-h-0 overflow-y-auto p-6 md:p-12">
          <div className="flex flex-col items-center justify-center max-w-xs w-full">
            <button
              onClick={() => handleOpenApp(DEFAULT_APPS[0])}
              className="flex flex-col items-center justify-center p-8 rounded-3xl bg-[#1B1C20] hover:bg-[#2A2C30] border border-[#2A2C30] hover:border-[#DCB001]/50 transition-all duration-200 hover:scale-105 hover:shadow-2xl w-48 h-48 cursor-pointer group"
              title="Open Google"
            >
              <div
                className={`w-20 h-20 rounded-2xl flex items-center justify-center border ${DEFAULT_APPS[0].iconBg} mb-4 transition-transform group-hover:scale-110 shadow-md`}
              >
                <AppIcon app={DEFAULT_APPS[0]} size={44} />
              </div>
              <span className="text-base font-semibold text-white group-hover:text-[#DCB001] transition-colors text-center">
                {DEFAULT_APPS[0].name}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Dedicated Google Icon Renderer
 */
function AppIcon({ app, size = 24 }: { app: AppDefinition; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  );
}
