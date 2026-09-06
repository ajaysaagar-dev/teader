'use client';

import React, { useState, useRef, useMemo } from 'react';
import {
  AppWindow,
  Search,
  ExternalLink,
  RotateCw,
  Maximize2,
  Minimize2,
  Globe,
  Sparkles,
  Tv,
  ArrowLeft,
  Plus,
  X,
  Compass,
  Play,
  Share2
} from 'lucide-react';

export interface AppDefinition {
  id: string;
  name: string;
  category: 'search' | 'media' | 'dev' | 'reference' | 'design' | 'custom';
  tagline: string;
  description: string;
  defaultUrl: string;
  iconBg: string;
  iconColor: string;
  badge?: string;
  supportsEmbed: boolean;
  searchUrlTemplate?: string;
  quickActions?: { label: string; query: string }[];
}

const DEFAULT_APPS: AppDefinition[] = [
  {
    id: 'google',
    name: 'Google',
    category: 'search',
    tagline: 'Search the web, articles, documentation & tools',
    description: 'Fast web search and answers powered by Google inside your workspace.',
    defaultUrl: 'https://www.google.com/webhp?igu=1',
    iconBg: 'bg-[#4285F4]/10 border-[#4285F4]/30',
    iconColor: 'text-[#4285F4]',
    badge: 'Web Search',
    supportsEmbed: true,
    searchUrlTemplate: 'https://www.google.com/search?q={query}&igu=1',
    quickActions: [
      { label: 'Next.js Docs', query: 'next.js app router documentation' },
      { label: 'React Docs', query: 'react 19 official documentation' },
      { label: 'TypeScript', query: 'typescript handbook cheatsheet' },
      { label: 'Tailwind CSS', query: 'tailwindcss utilities documentation' }
    ]
  },
  {
    id: 'youtube',
    name: 'YouTube',
    category: 'media',
    tagline: 'Coding tutorials, music streams, tech keynotes & podcasts',
    description: 'Watch video tutorials, developer keynotes, and ambient background music without leaving your project.',
    defaultUrl: 'https://www.youtube-nocookie.com/embed?listType=search&list=lofi+coding+beats',
    iconBg: 'bg-[#FF0000]/10 border-[#FF0000]/30',
    iconColor: 'text-[#FF0000]',
    badge: 'Video & Audio',
    supportsEmbed: true,
    searchUrlTemplate: 'https://www.youtube-nocookie.com/embed?listType=search&list={query}',
    quickActions: [
      { label: '🎵 Lo-Fi Coding Beats', query: 'lofi hip hop radio beats to relax study to' },
      { label: '💻 Web Dev Tutorials', query: 'nextjs full stack tutorial 2026' },
      { label: '⚡ Synthwave Radio', query: 'synthwave lofi beats stream' },
      { label: '🎧 Deep Focus Noise', query: 'brown noise focus study 4k' }
    ]
  },
  {
    id: 'wikipedia',
    name: 'Wikipedia',
    category: 'reference',
    tagline: 'The free encyclopedia — research concepts, science & history',
    description: 'Instant access to millions of reference articles, technical definitions, and research material.',
    defaultUrl: 'https://en.m.wikipedia.org',
    iconBg: 'bg-white/10 border-white/20',
    iconColor: 'text-white',
    badge: 'Encyclopedia',
    supportsEmbed: true,
    searchUrlTemplate: 'https://en.m.wikipedia.org/wiki/Special:Search?search={query}',
    quickActions: [
      { label: 'Computer Science', query: 'Computer science' },
      { label: 'Software Architecture', query: 'Software architecture' },
      { label: 'Database Normalization', query: 'Database normalization' },
      { label: 'WebRTC Protocol', query: 'WebRTC' }
    ]
  },
  {
    id: 'excalidraw',
    name: 'Excalidraw',
    category: 'design',
    tagline: 'Virtual whiteboard for hand-drawn sketches & architecture diagrams',
    description: 'Sketch out system architecture, workflows, user journeys, and wireframes directly inside your workspace.',
    defaultUrl: 'https://excalidraw.com',
    iconBg: 'bg-[#6965DB]/10 border-[#6965DB]/30',
    iconColor: 'text-[#6965DB]',
    badge: 'Whiteboard',
    supportsEmbed: true
  },
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    category: 'search',
    tagline: 'Private web search with zero tracking and embedded support',
    description: 'Search the web privately without tracking cookies or targeted advertising.',
    defaultUrl: 'https://duckduckgo.com',
    iconBg: 'bg-[#DE5833]/10 border-[#DE5833]/30',
    iconColor: 'text-[#DE5833]',
    badge: 'Private Search',
    supportsEmbed: true,
    searchUrlTemplate: 'https://duckduckgo.com/?q={query}'
  },
  {
    id: 'github',
    name: 'GitHub',
    category: 'dev',
    tagline: 'Code repositories, developer community, issues & PRs',
    description: 'Quickly look up open source repositories, issue trackers, and technical documentation.',
    defaultUrl: 'https://github.com',
    iconBg: 'bg-[#8B949E]/10 border-[#8B949E]/30',
    iconColor: 'text-[#E6EDF3]',
    badge: 'Code & Repos',
    supportsEmbed: false,
    searchUrlTemplate: 'https://github.com/search?q={query}'
  },
  {
    id: 'stackoverflow',
    name: 'Stack Overflow',
    category: 'dev',
    tagline: 'Find solutions to coding errors, bugs & framework questions',
    description: 'Look up solutions, debugging patterns, and best practices for every programming language.',
    defaultUrl: 'https://stackoverflow.com',
    iconBg: 'bg-[#F48024]/10 border-[#F48024]/30',
    iconColor: 'text-[#F48024]',
    badge: 'Developer Q&A',
    supportsEmbed: false,
    searchUrlTemplate: 'https://stackoverflow.com/search?q={query}'
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
  const [selectedAppId, setSelectedAppId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(`teader_last_app_${projectId}`) || null;
    }
    return null;
  });

  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [addressInput, setAddressInput] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [iframeKey, setIframeKey] = useState<number>(0);
  const [isLoadingIframe, setIsLoadingIframe] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
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
  const [customTagline, setCustomTagline] = useState<string>('');

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const allApps = useMemo(() => {
    return [...DEFAULT_APPS, ...customApps];
  }, [customApps]);

  const activeApp = useMemo(() => {
    return allApps.find((a) => a.id === selectedAppId) || null;
  }, [allApps, selectedAppId]);

  // Open an app
  const handleOpenApp = (app: AppDefinition, initialUrl?: string) => {
    const urlToLoad = initialUrl || app.defaultUrl;
    setSelectedAppId(app.id);
    setCurrentUrl(urlToLoad);
    setAddressInput(urlToLoad);
    setIsLoadingIframe(true);
    setIframeKey((prev) => prev + 1);

    if (typeof window !== 'undefined') {
      localStorage.setItem(`teader_last_app_${projectId}`, app.id);
    }
  };

  // Close active app view back to apps directory
  const handleBackToCatalog = () => {
    setSelectedAppId(null);
    setCurrentUrl('');
    setAddressInput('');
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`teader_last_app_${projectId}`);
    }
  };

  // Navigate or search from address bar
  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addressInput.trim()) return;

    let target = addressInput.trim();

    // YouTube specific query / video ID detection
    if (activeApp?.id === 'youtube') {
      const ytId = extractYouTubeVideoId(target);
      if (ytId) {
        target = `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1`;
      } else if (!target.startsWith('http://') && !target.startsWith('https://')) {
        target = `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(target)}`;
      }
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
        // Fallback search query
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
    const u = urlToOpen || currentUrl || activeApp?.defaultUrl;
    if (u) {
      window.open(u, '_blank', 'noopener,noreferrer');
    }
  };

  // Pop out auxiliary window
  const handlePopOutWindow = () => {
    const u = currentUrl || activeApp?.defaultUrl;
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
      category: 'custom',
      tagline: customTagline.trim() || 'Custom workspace web application',
      description: `Custom app pointing to ${formattedUrl}`,
      defaultUrl: formattedUrl,
      iconBg: 'bg-[#DCB001]/10 border-[#DCB001]/30',
      iconColor: 'text-[#DCB001]',
      badge: 'Custom',
      supportsEmbed: true
    };

    const updated = [...customApps, newApp];
    setCustomApps(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`teader_custom_apps_${projectId}`, JSON.stringify(updated));
    }

    setIsAddCustomModalOpen(false);
    setCustomName('');
    setCustomUrl('');
    setCustomTagline('');
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

  // Filtered apps catalog
  const filteredApps = useMemo(() => {
    return allApps.filter((app) => {
      const matchesCategory =
        categoryFilter === 'all' ||
        (categoryFilter === 'custom' ? app.category === 'custom' : app.category === categoryFilter);

      const matchesSearch =
        !searchFilter.trim() ||
        app.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        app.tagline.toLowerCase().includes(searchFilter.toLowerCase()) ||
        app.description.toLowerCase().includes(searchFilter.toLowerCase());

      return matchesCategory && matchesSearch;
    });
  }, [allApps, categoryFilter, searchFilter]);

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
            {/* Left Controls: Back button & App Badge */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleBackToCatalog}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#787C83] hover:text-[#CFD4DD] hover:bg-[#2A2C30] transition-colors"
                title="Back to All Apps Catalog"
              >
                <ArrowLeft size={14} />
                <span className="hidden sm:inline">Apps</span>
              </button>

              <div className="h-4 w-px bg-[#2A2C30]" />

              <div className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-md flex items-center justify-center border ${activeApp.iconBg}`}
                >
                  <AppIcon app={activeApp} size={13} />
                </div>
                <span className="text-xs font-semibold text-white tracking-tight">
                  {activeApp.name}
                </span>
                {activeApp.badge && (
                  <span className="hidden md:inline-block px-1.5 py-0.5 text-[10px] font-semibold bg-[#2A2C30] text-[#DCB001] rounded">
                    {activeApp.badge}
                  </span>
                )}
              </div>
            </div>

            {/* Middle: Address / Search Bar */}
            <form onSubmit={handleAddressSubmit} className="flex-1 max-w-2xl min-w-0">
              <div className="relative flex items-center">
                <div className="absolute left-3 text-[#787C83] pointer-events-none">
                  {activeApp.id === 'google' || activeApp.id === 'duckduckgo' ? (
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

            {/* Right Controls: Quick Switcher, Reload, External Link, Fullscreen */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Quick Switcher Pills for Popular Apps */}
              <div className="hidden lg:flex items-center gap-1 bg-[#141518] p-0.5 rounded-lg border border-[#2A2C30]">
                {DEFAULT_APPS.slice(0, 4).map((app) => (
                  <button
                    key={app.id}
                    onClick={() => handleOpenApp(app)}
                    className={`px-2 py-1 text-[11px] font-medium rounded transition-colors ${
                      activeApp.id === app.id
                        ? 'bg-[#2A2C30] text-[#DCB001] font-semibold'
                        : 'text-[#787C83] hover:text-[#CFD4DD]'
                    }`}
                  >
                    {app.name}
                  </button>
                ))}
              </div>

              <div className="h-4 w-px bg-[#2A2C30] hidden lg:block" />

              <button
                onClick={handleReload}
                className="p-1.5 text-[#787C83] hover:text-[#CFD4DD] hover:bg-[#2A2C30] rounded-lg transition-colors"
                title="Reload Page"
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
                title="Open in New Browser Tab"
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

          {/* Quick Action Chips (Presets for Google, YouTube, etc.) */}
          {activeApp.quickActions && activeApp.quickActions.length > 0 && (
            <div className="bg-[#18191D] border-b border-[#2A2C30] px-3 py-1.5 flex items-center gap-2 overflow-x-auto text-xs shrink-0 scrollbar-none">
              <span className="text-[11px] font-semibold text-[#787C83] uppercase tracking-wider shrink-0 flex items-center gap-1">
                <Sparkles size={11} className="text-[#DCB001]" />
                Presets:
              </span>
              {activeApp.quickActions.map((qa, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    if (activeApp.id === 'youtube') {
                      const ytUrl = `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(
                        qa.query
                      )}`;
                      setCurrentUrl(ytUrl);
                      setAddressInput(qa.query);
                      setIsLoadingIframe(true);
                      setIframeKey((k) => k + 1);
                    } else if (activeApp.searchUrlTemplate) {
                      const target = activeApp.searchUrlTemplate.replace(
                        '{query}',
                        encodeURIComponent(qa.query)
                      );
                      setCurrentUrl(target);
                      setAddressInput(qa.query);
                      setIsLoadingIframe(true);
                      setIframeKey((k) => k + 1);
                    }
                  }}
                  className="px-2.5 py-0.5 rounded-full bg-[#2A2C30] hover:bg-[#DCB001]/20 hover:text-[#DCB001] text-[#CFD4DD] text-[11px] transition-colors shrink-0 flex items-center gap-1"
                >
                  {activeApp.id === 'youtube' && <Play size={10} className="text-[#DCB001]" />}
                  {qa.label}
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

            {/* Frame Helper / Security Notice Ribbon (bottom overlay) */}
            <div className="absolute bottom-2 right-3 z-10 flex items-center gap-2 bg-[#1B1C20]/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-[#2A2C30] text-[11px] text-[#787C83] shadow-lg">
              <span>Viewing {activeApp.name} inside Teader</span>
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
        /* APPS DIRECTORY / CATALOG (When no app is opened)              */
        /* ------------------------------------------------------------- */
        <div className="flex-1 flex flex-col h-full min-h-0 overflow-y-auto">
          {/* Header Banner */}
          <div className="border-b border-[#2A2C30] bg-gradient-to-b from-[#1B1C20] to-[#141518] px-6 py-6 shrink-0">
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5 mb-1.5">
                  <div className="w-8 h-8 rounded-lg bg-[#DCB001]/10 border border-[#DCB001]/30 flex items-center justify-center text-[#DCB001]">
                    <AppWindow size={18} />
                  </div>
                  <h1 className="text-xl font-bold text-white tracking-tight">Apps & Tools</h1>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#2A2C30] text-[#DCB001]">
                    {allApps.length} Apps
                  </span>
                </div>
                <p className="text-xs text-[#787C83] max-w-xl">
                  Launch external applications, web search, video tutorials, and interactive tools directly
                  within {projectName || 'this project'}. Click any app below to open it in this view.
                </p>
              </div>

              {/* Action Buttons: Add Custom App */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsAddCustomModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#DCB001] hover:bg-[#c49d01] text-black text-xs font-bold transition-colors shadow-sm"
                >
                  <Plus size={14} />
                  <span>Add Custom App</span>
                </button>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="max-w-6xl mx-auto mt-6 flex flex-col sm:flex-row sm:items-center gap-3">
              {/* Search Box */}
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-2.5 text-[#787C83]" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Search apps or enter any web address..."
                  className="w-full bg-[#1B1C20] border border-[#2A2C30] focus:border-[#DCB001] text-xs text-[#CFD4DD] placeholder-[#787C83] rounded-lg pl-9 pr-4 py-2 focus:outline-none transition-colors"
                />
                {searchFilter && (
                  <button
                    onClick={() => setSearchFilter('')}
                    className="absolute right-3 top-2.5 text-[#787C83] hover:text-[#CFD4DD]"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                {[
                  { id: 'all', label: 'All Apps' },
                  { id: 'search', label: 'Search' },
                  { id: 'media', label: 'Media' },
                  { id: 'reference', label: 'Reference' },
                  { id: 'design', label: 'Design' },
                  { id: 'dev', label: 'Developer' },
                  { id: 'custom', label: 'Custom' }
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                      categoryFilter === cat.id
                        ? 'bg-[#2A2C30] text-[#DCB001] font-semibold border border-[#DCB001]/30'
                        : 'text-[#787C83] hover:text-[#CFD4DD] hover:bg-[#1B1C20]'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Apps Cards Grid */}
          <div className="flex-1 max-w-6xl w-full mx-auto px-6 py-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredApps.map((app) => (
                <div
                  key={app.id}
                  onClick={() => handleOpenApp(app)}
                  className="group relative bg-[#1B1C20] border border-[#2A2C30] hover:border-[#DCB001]/50 rounded-xl p-5 cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-black/40 flex flex-col justify-between"
                >
                  <div>
                    {/* Card Header: Icon, Name & Badge */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center border ${app.iconBg} transition-transform group-hover:scale-105`}
                        >
                          <AppIcon app={app} size={22} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-white group-hover:text-[#DCB001] transition-colors">
                              {app.name}
                            </h3>
                            {app.badge && (
                              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-[#2A2C30] text-[#DCB001] rounded">
                                {app.badge}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-[#787C83] uppercase tracking-wider font-medium">
                            {app.category}
                          </span>
                        </div>
                      </div>

                      {/* Custom App Delete Button */}
                      {app.category === 'custom' && (
                        <button
                          onClick={(e) => handleDeleteCustomApp(app.id, e)}
                          className="text-[#787C83] hover:text-red-400 p-1 rounded transition-colors"
                          title="Remove custom app"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    {/* Tagline & Description */}
                    <p className="text-xs font-medium text-[#CFD4DD] mb-1.5 leading-snug">
                      {app.tagline}
                    </p>
                    <p className="text-[11px] text-[#787C83] line-clamp-2 leading-relaxed">
                      {app.description}
                    </p>
                  </div>

                  {/* Card Footer: Quick Actions / Open Button */}
                  <div className="mt-4 pt-3 border-t border-[#2A2C30]/60 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#DCB001] group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                      <span>Open in View</span>
                      <ArrowLeft size={11} className="rotate-180" />
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenExternal(app.defaultUrl);
                      }}
                      className="text-[#787C83] hover:text-white p-1 rounded hover:bg-[#2A2C30] transition-colors"
                      title="Open in new browser tab"
                    >
                      <ExternalLink size={13} />
                    </button>
                  </div>
                </div>
              ))}

              {/* Add Custom App Card */}
              <div
                onClick={() => setIsAddCustomModalOpen(true)}
                className="border border-dashed border-[#2A2C30] hover:border-[#DCB001]/60 bg-[#1B1C20]/40 hover:bg-[#1B1C20] rounded-xl p-5 cursor-pointer transition-all flex flex-col items-center justify-center text-center group min-h-[160px]"
              >
                <div className="w-10 h-10 rounded-full bg-[#2A2C30] group-hover:bg-[#DCB001] group-hover:text-black text-[#787C83] flex items-center justify-center mb-2.5 transition-colors">
                  <Plus size={18} />
                </div>
                <h4 className="text-xs font-bold text-white group-hover:text-[#DCB001] mb-1">
                  Add Any Web App or URL
                </h4>
                <p className="text-[11px] text-[#787C83] max-w-[200px]">
                  Integrate your favorite documentation, dashboard, or internal tool.
                </p>
              </div>
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
                <h3 className="text-base font-bold text-white">Add Custom Web App</h3>
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
                  placeholder="e.g. Staging Server, Linear, Notion, Figma"
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
                  placeholder="https://example.com or localhost:3000"
                  required
                  className="w-full bg-[#141518] border border-[#2A2C30] focus:border-[#DCB001] text-xs text-white placeholder-[#787C83] rounded-lg px-3 py-2 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#CFD4DD] mb-1">
                  Tagline / Description (Optional)
                </label>
                <input
                  type="text"
                  value={customTagline}
                  onChange={(e) => setCustomTagline(e.target.value)}
                  placeholder="Short description of this tool"
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
function AppIcon({ app, size = 18 }: { app: AppDefinition; size?: number }) {
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
      <div className="font-serif font-black text-white text-xs leading-none">W</div>
    );
  }

  if (app.id === 'excalidraw') {
    return <PenTool size={size} className={app.iconColor} />;
  }

  if (app.id === 'github') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className="text-white">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
        />
      </svg>
    );
  }

  if (app.id === 'stackoverflow') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className="text-[#F48024]">
        <path d="M18.986 21.865v-6.404h2.134V24H1.844v-8.539h2.13v6.404h15.012zM6.111 19.731H16.85v-2.137H6.111v2.137zm.259-4.852l10.48 2.189.451-2.07-10.478-2.187-.453 2.068zm1.5-4.887l9.656 4.826.955-1.89-9.657-4.828-.954 1.892zm3.22-4.61l8.206 6.964 1.38-1.61-8.206-6.965-1.38 1.611zm6.564-5.382l-1.624 1.39 6.513 8.601 1.625-1.39-6.514-8.601z" />
      </svg>
    );
  }

  if (app.id === 'duckduckgo') {
    return <Compass size={size} className={app.iconColor} />;
  }

  return <Globe size={size} className={app.iconColor} />;
}

// Inline PenTool component if not imported
function PenTool({ size = 18, className = '' }: { size?: number; className?: string }) {
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
      className={className}
    >
      <path d="m12 19 7-7 3 3-7 7-3-3z" />
      <path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
      <path d="m2 2 7.586 7.586" />
      <circle cx="11" cy="11" r="2" />
    </svg>
  );
}
