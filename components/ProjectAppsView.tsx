'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  ExternalLink,
  RotateCw,
  Maximize2,
  Minimize2,
  Globe,
  Tv,
  ArrowLeft,
  Plus,
  X,
  Play,
  Share2,
  Loader2
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
  },
  {
    id: 'youtube',
    name: 'YouTube',
    defaultUrl: 'https://www.youtube-nocookie.com/embed/jfKfPfyJRdk?autoplay=1',
    iconBg: 'bg-[#FF0000]/10 border-[#FF0000]/30',
    iconColor: 'text-[#FF0000]'
  },
  {
    id: 'wikipedia',
    name: 'Wikipedia',
    defaultUrl: 'https://en.m.wikipedia.org',
    iconBg: 'bg-white/10 border-white/20',
    iconColor: 'text-white'
  },
  {
    id: 'excalidraw',
    name: 'Excalidraw',
    defaultUrl: 'https://excalidraw.com',
    iconBg: 'bg-[#6965DB]/10 border-[#6965DB]/30',
    iconColor: 'text-[#6965DB]'
  }
];

function extractYouTubeVideoId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/
  );
  return match ? match[1] : null;
}

interface ProjectAppsViewProps {
  projectId: number | string;
  projectName?: string;
}

export function ProjectAppsView({ projectId, projectName }: ProjectAppsViewProps) {
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
  const [isSearchingYT, setIsSearchingYT] = useState<boolean>(false);

  const [customApps, setCustomApps] = useState<AppDefinition[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`teader_custom_apps_${projectId}`);
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const [isAddCustomModalOpen, setIsAddCustomModalOpen] = useState<boolean>(false);
  const [customName, setCustomName] = useState<string>('');
  const [customUrl, setCustomUrl] = useState<string>('');

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const allApps = [...DEFAULT_APPS, ...customApps];
  const activeApp = allApps.find((a) => a.id === selectedAppId) || null;

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
  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addressInput.trim()) return;

    let target = addressInput.trim();

    if (activeApp?.id === 'youtube') {
      const ytId = extractYouTubeVideoId(target);
      if (ytId) {
        target = `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1`;
        setCurrentUrl(target);
        setIsLoadingIframe(true);
        setIframeKey((prev) => prev + 1);
        return;
      }

      // Query YouTube API to find the top video and play it
      try {
        setIsSearchingYT(true);
        const res = await fetch(`/api/apps/youtube?q=${encodeURIComponent(target)}`);
        const data = await res.json();
        if (data?.embedUrl) {
          setCurrentUrl(data.embedUrl);
          setIsLoadingIframe(true);
          setIframeKey((prev) => prev + 1);
          return;
        }
      } catch (err) {
        console.error('YouTube search error:', err);
      } finally {
        setIsSearchingYT(false);
      }

      // Fallback direct embed
      target = `https://www.youtube-nocookie.com/embed/jfKfPfyJRdk?autoplay=1`;
    } else if (activeApp?.id === 'google') {
      if (!target.startsWith('http://') && !target.startsWith('https://')) {
        target = `https://www.google.com/search?q=${encodeURIComponent(target)}&igu=1`;
      } else if (target.includes('google.com') && !target.includes('igu=1')) {
        target = target + (target.includes('?') ? '&igu=1' : '?igu=1');
      }
    } else if (activeApp?.id === 'wikipedia') {
      if (!target.startsWith('http://') && !target.startsWith('https://')) {
        target = `https://en.m.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(target)}`;
      }
    } else if (!target.startsWith('http://') && !target.startsWith('https://')) {
      if (target.includes('.') && !target.includes(' ')) {
        target = `https://${target}`;
      } else {
        target = `https://www.google.com/search?q=${encodeURIComponent(target)}&igu=1`;
      }
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
    let u = urlToOpen || currentUrl || activeApp?.defaultUrl;
    if (activeApp?.id === 'youtube' && !urlToOpen) {
      const vidId = extractYouTubeVideoId(currentUrl);
      u = vidId ? `https://www.youtube.com/watch?v=${vidId}` : 'https://www.youtube.com';
    }
    if (u) {
      window.open(u, '_blank', 'noopener,noreferrer');
    }
  };

  // Pop out auxiliary window
  const handlePopOutWindow = () => {
    let u = currentUrl || activeApp?.defaultUrl;
    if (activeApp?.id === 'youtube') {
      const vidId = extractYouTubeVideoId(currentUrl);
      u = vidId ? `https://www.youtube.com/watch?v=${vidId}` : 'https://www.youtube.com';
    }
    if (u) {
      window.open(u, '_blank', 'width=1180,height=800,menubar=no,status=no,toolbar=no');
    }
  };

  // Add custom web app
  const handleCreateCustomApp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || !customUrl.trim()) return;

    let formattedUrl = customUrl.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    const newApp: AppDefinition = {
      id: `custom_${Date.now()}`,
      name: customName.trim(),
      defaultUrl: formattedUrl,
      iconBg: 'bg-[#DCB001]/10 border-[#DCB001]/30',
      iconColor: 'text-[#DCB001]'
    };

    const updated = [...customApps, newApp];
    setCustomApps(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`teader_custom_apps_${projectId}`, JSON.stringify(updated));
    }

    setIsAddCustomModalOpen(false);
    setCustomName('');
    setCustomUrl('');
    handleOpenApp(newApp);
  };

  // Delete custom app
  const handleDeleteCustomApp = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customApps.filter((a) => a.id !== id);
    setCustomApps(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`teader_custom_apps_${projectId}`, JSON.stringify(updated));
    }
    if (selectedAppId === id) {
      handleBackToCatalog();
    }
  };

  return (
    <div
      ref={containerRef}
      className={`flex-1 flex flex-col h-full min-h-0 bg-[#141518] text-[#CFD4DD] select-none ${
        isFullscreen ? 'fixed inset-0 z-50 bg-[#141518]' : 'relative'
      }`}
    >
      {/* ------------------------------------------------------------- */}
      {/* ACTIVE APP VIEW (When an app is selected)                      */}
      {/* ------------------------------------------------------------- */}
      {activeApp ? (
        <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
          {/* Top Browser Bar */}
          <div className="h-12 border-b border-[#2A2C30] bg-[#1B1C20] px-3 flex items-center justify-between gap-3 shrink-0">
            {/* Left: Back button & App Logo/Name */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleBackToCatalog}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#787C83] hover:text-[#CFD4DD] hover:bg-[#2A2C30] transition-colors"
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
                  {isSearchingYT ? (
                    <Loader2 size={13} className="animate-spin text-[#DCB001]" />
                  ) : activeApp.id === 'google' ? (
                    <Search size={13} />
                  ) : activeApp.id === 'youtube' ? (
                    <Tv size={13} />
                  ) : (
                    <Globe size={13} />
                  )}
                </div>
                <input
                  type="text"
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                  placeholder={
                    activeApp.id === 'google'
                      ? 'Search Google or enter query...'
                      : activeApp.id === 'youtube'
                      ? 'Search YouTube videos, topics, or paste link...'
                      : 'Enter web address or search term...'
                  }
                  className="w-full bg-[#141518] border border-[#2A2C30] focus:border-[#DCB001] text-xs text-[#CFD4DD] placeholder-[#787C83] rounded-lg pl-8 pr-16 py-1.5 focus:outline-none transition-colors"
                />
                <button
                  type="submit"
                  className="absolute right-1.5 px-2 py-0.5 bg-[#2A2C30] hover:bg-[#DCB001] hover:text-black text-[11px] font-medium text-[#CFD4DD] rounded transition-colors"
                >
                  Go
                </button>
              </div>
            </form>

            {/* Right: Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Quick Switcher Icons */}
              <div className="hidden md:flex items-center gap-1 bg-[#141518] p-0.5 rounded-lg border border-[#2A2C30]">
                {DEFAULT_APPS.map((app) => (
                  <button
                    key={app.id}
                    onClick={() => handleOpenApp(app)}
                    className={`px-2 py-1 text-[11px] font-medium rounded transition-colors flex items-center gap-1.5 ${
                      activeApp.id === app.id
                        ? 'bg-[#2A2C30] text-[#DCB001] font-semibold'
                        : 'text-[#787C83] hover:text-[#CFD4DD]'
                    }`}
                  >
                    <AppIcon app={app} size={12} />
                    <span>{app.name}</span>
                  </button>
                ))}
              </div>

              <div className="h-4 w-px bg-[#2A2C30] hidden md:block" />

              <button
                onClick={handleReload}
                className="p-1.5 text-[#787C83] hover:text-[#CFD4DD] hover:bg-[#2A2C30] rounded-lg transition-colors"
                title="Reload"
              >
                <RotateCw size={14} className={isLoadingIframe ? 'animate-spin text-[#DCB001]' : ''} />
              </button>

              <button
                onClick={handlePopOutWindow}
                className="p-1.5 text-[#787C83] hover:text-[#CFD4DD] hover:bg-[#2A2C30] rounded-lg transition-colors"
                title="Pop out in Separate Window"
              >
                <Share2 size={14} />
              </button>

              <button
                onClick={() => handleOpenExternal()}
                className="p-1.5 text-[#787C83] hover:text-[#CFD4DD] hover:bg-[#2A2C30] rounded-lg transition-colors"
                title="Open in New Tab"
              >
                <ExternalLink size={14} />
              </button>

              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-1.5 text-[#787C83] hover:text-[#CFD4DD] hover:bg-[#2A2C30] rounded-lg transition-colors"
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
            </div>
          </div>

          {/* YouTube Quick Channel Presets */}
          {activeApp.id === 'youtube' && (
            <div className="bg-[#18191D] border-b border-[#2A2C30] px-3 py-1.5 flex items-center gap-2 overflow-x-auto text-xs shrink-0 scrollbar-none">
              <span className="text-[11px] font-semibold text-[#787C83] shrink-0">Featured:</span>
              {[
                { label: '🎵 Lo-Fi Beats', vid: 'jfKfPfyJRdk' },
                { label: '⚡ Synthwave', vid: '4xDzrJKXOOY' },
                { label: '☕ Relaxing Chill', vid: 'MVPTGNGiI-4' },
                { label: '💻 Web Dev & Next.js', vid: '843nec-IvW0' }
              ].map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    const url = `https://www.youtube-nocookie.com/embed/${preset.vid}?autoplay=1`;
                    setCurrentUrl(url);
                    setAddressInput(preset.label);
                    setIsLoadingIframe(true);
                    setIframeKey((k) => k + 1);
                  }}
                  className="px-2.5 py-0.5 rounded-full bg-[#2A2C30] hover:bg-[#DCB001]/20 hover:text-[#DCB001] text-[#CFD4DD] text-[11px] transition-colors shrink-0 flex items-center gap-1"
                >
                  <Play size={10} className="text-[#DCB001]" />
                  {preset.label}
                </button>
              ))}
            </div>
          )}

          {/* Main App Canvas / Iframe View */}
          <div className="flex-1 w-full h-full min-h-0 relative bg-[#0D0E11] overflow-hidden">
            {/* Loading Indicator */}
            {isLoadingIframe && (
              <div className="absolute inset-0 bg-[#141518]/60 backdrop-blur-xs flex flex-col items-center justify-center z-10 pointer-events-none">
                <div className="w-8 h-8 rounded-full border-2 border-[#2A2C30] border-t-[#DCB001] animate-spin mb-2" />
                <span className="text-xs text-[#787C83] font-medium">Loading {activeApp.name}...</span>
              </div>
            )}

            {/* Embedded Iframe */}
            {currentUrl ? (
              <iframe
                key={iframeKey}
                ref={iframeRef}
                src={currentUrl}
                onLoad={() => setIsLoadingIframe(false)}
                allow="camera; microphone; fullscreen; clipboard-read; clipboard-write; encrypted-media; picture-in-picture; autoplay"
                sandbox="allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-downloads allow-presentation"
                className="w-full h-full border-0 bg-white"
                title={activeApp.name}
              />
            ) : null}

            {/* Bottom Overlay Info */}
            <div className="absolute bottom-2 right-3 z-10 flex items-center gap-2 bg-[#1B1C20]/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-[#2A2C30] text-[11px] text-[#787C83] shadow-lg">
              <span>{activeApp.name}</span>
              <button
                onClick={() => handleOpenExternal()}
                className="text-[#DCB001] hover:underline flex items-center gap-1 font-medium"
              >
                <span>Open in Tab</span>
                <ExternalLink size={11} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ------------------------------------------------------------- */
        /* APPS DIRECTORY / CATALOG: ONLY SHOW LOGO AND ONLY NAME        */
        /* ------------------------------------------------------------- */
        <div className="flex-1 flex flex-col h-full min-h-0 overflow-y-auto p-6 md:p-12">
          <div className="max-w-4xl mx-auto w-full">
            {/* Clean, minimalist apps grid with only logo and name */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 sm:gap-8">
              {allApps.map((app) => (
                <div
                  key={app.id}
                  className="relative group flex flex-col items-center justify-center"
                >
                  <button
                    onClick={() => handleOpenApp(app)}
                    className="flex flex-col items-center justify-center p-4 rounded-2xl bg-[#1B1C20] hover:bg-[#2A2C30] border border-[#2A2C30] hover:border-[#DCB001]/50 transition-all duration-200 group-hover:scale-105 group-hover:shadow-xl w-full aspect-square cursor-pointer"
                  >
                    <div
                      className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center border ${app.iconBg} mb-3 transition-transform group-hover:scale-110 shadow-sm`}
                    >
                      <AppIcon app={app} size={32} />
                    </div>
                    <span className="text-sm font-semibold text-white group-hover:text-[#DCB001] transition-colors text-center truncate max-w-[120px]">
                      {app.name}
                    </span>
                  </button>

                  {/* Delete button for custom apps */}
                  {app.id.startsWith('custom_') && (
                    <button
                      onClick={(e) => handleDeleteCustomApp(app.id, e)}
                      className="absolute top-2 right-2 text-[#787C83] hover:text-red-400 p-1 rounded-full bg-[#141518]/80 hover:bg-[#141518] transition-colors"
                      title="Remove"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}

              {/* Add Custom App Card: Only Icon + Name */}
              <button
                onClick={() => setIsAddCustomModalOpen(true)}
                className="flex flex-col items-center justify-center p-4 rounded-2xl border border-dashed border-[#2A2C30] hover:border-[#DCB001]/60 bg-[#1B1C20]/40 hover:bg-[#1B1C20] transition-all duration-200 hover:scale-105 group w-full aspect-square cursor-pointer"
              >
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#2A2C30] group-hover:bg-[#DCB001] group-hover:text-black text-[#787C83] flex items-center justify-center mb-3 transition-colors shadow-sm">
                  <Plus size={26} />
                </div>
                <span className="text-sm font-semibold text-[#787C83] group-hover:text-[#DCB001] transition-colors text-center">
                  Add App
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: ADD CUSTOM APP                                         */}
      {/* ------------------------------------------------------------- */}
      {isAddCustomModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#1B1C20] border border-[#2A2C30] rounded-xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#DCB001]/10 border border-[#DCB001]/30 flex items-center justify-center text-[#DCB001]">
                  <Plus size={16} />
                </div>
                <h3 className="text-base font-bold text-white">Add App</h3>
              </div>
              <button
                onClick={() => setIsAddCustomModalOpen(false)}
                className="text-[#787C83] hover:text-white p-1 rounded"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateCustomApp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#CFD4DD] mb-1">App Name</label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Figma, Notion, Staging"
                  required
                  className="w-full bg-[#141518] border border-[#2A2C30] focus:border-[#DCB001] text-xs text-white placeholder-[#787C83] rounded-lg px-3 py-2 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#CFD4DD] mb-1">Web URL</label>
                <input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://example.com"
                  required
                  className="w-full bg-[#141518] border border-[#2A2C30] focus:border-[#DCB001] text-xs text-white placeholder-[#787C83] rounded-lg px-3 py-2 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2A2C30]">
                <button
                  type="button"
                  onClick={() => setIsAddCustomModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-[#787C83] hover:text-white rounded-lg hover:bg-[#2A2C30] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-black bg-[#DCB001] hover:bg-[#c49d01] rounded-lg transition-colors"
                >
                  Add App
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Dedicated Brand Icon Renderer
 */
function AppIcon({ app, size = 24 }: { app: AppDefinition; size?: number }) {
  if (app.id === 'google') {
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

  if (app.id === 'youtube') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path
          d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.5 12 3.5 12 3.5s-7.505 0-9.377.55a3.016 3.016 0 0 0-2.122 2.136C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.55 9.376.55 9.376.55s7.505 0 9.377-.55a3.016 3.016 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"
          fill="#FF0000"
        />
        <path d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="#FFFFFF" />
      </svg>
    );
  }

  if (app.id === 'wikipedia') {
    return (
      <div
        className="font-serif font-black text-white flex items-center justify-center leading-none"
        style={{ fontSize: size * 0.7 }}
      >
        W
      </div>
    );
  }

  if (app.id === 'excalidraw') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={app.iconColor}
      >
        <path d="m12 19 7-7 3 3-7 7-3-3z" />
        <path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
        <path d="m2 2 7.586 7.586" />
        <circle cx="11" cy="11" r="2" />
      </svg>
    );
  }

  return <Globe size={size} className={app.iconColor} />;
}
