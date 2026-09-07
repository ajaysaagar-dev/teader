'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  ExternalLink,
  RotateCw,
  Maximize2,
  Minimize2,
  ArrowLeft,
  Share2,
  Key,
  X,
  Eye,
  EyeOff
} from 'lucide-react';
import { toast } from 'sonner';
import { ProjectGithubView } from './ProjectGithubView';

export interface AppDefinition {
  id: string;
  name: string;
  defaultUrl: string;
  iconBg: string;
  iconColor: string;
}

export const DEFAULT_APPS: AppDefinition[] = [
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

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [showTokenPromptModal, setShowTokenPromptModal] = useState<boolean>(false);
  const [tokenInput, setTokenInput] = useState<string>('');
  const [showTokenText, setShowTokenText] = useState<boolean>(false);
  const [isVerifyingToken, setIsVerifyingToken] = useState<boolean>(false);

  const activeApp = DEFAULT_APPS.find((a) => a.id === selectedAppId) || null;

  // Open an app from catalog
  const handleOpenApp = (app: AppDefinition) => {
    if (app.id === 'google') {
      setSelectedAppId(app.id);
      setCurrentUrl(app.defaultUrl);
      setAddressInput(app.defaultUrl);
      setIsLoadingIframe(true);
      setIframeKey((prev) => prev + 1);
    } else if (app.id === 'github') {
      // Check if access token is set
      const storedToken = typeof window !== 'undefined' ? localStorage.getItem('teader_github_token') : null;
      if (storedToken && storedToken.trim()) {
        // If set, open immediately!
        setSelectedAppId('github');
        setCurrentUrl('');
        setAddressInput('');
      } else {
        // When click to open GitHub, ask for access token
        setShowTokenPromptModal(true);
      }
    }
  };

  const handleConfirmTokenAndOpen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      toast.error('Please enter a GitHub Personal Access Token');
      return;
    }
    const cleanToken = tokenInput.trim();
    setIsVerifyingToken(true);
    try {
      const res = await fetch('/api/github/user', {
        headers: { 'x-github-token': cleanToken }
      });
      if (res.ok) {
        localStorage.setItem('teader_github_token', cleanToken);
        setShowTokenPromptModal(false);
        setTokenInput('');
        setSelectedAppId('github');
        setCurrentUrl('');
        setAddressInput('');
        toast.success('GitHub connected successfully!');
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Invalid GitHub access token');
      }
    } catch {
      toast.error('Network error verifying GitHub token');
    } finally {
      setIsVerifyingToken(false);
    }
  };

  // Open a specific URL inside the embedded browser
  const handleOpenInEmbed = (url: string) => {
    setCurrentUrl(url);
    setAddressInput(url);
    setIsLoadingIframe(true);
    setIframeKey((prev) => prev + 1);
  };

  // Close active app view back to apps directory
  const handleBackToCatalog = () => {
    setSelectedAppId(null);
    setCurrentUrl('');
    setAddressInput('');
  };

  // Back button within an app (e.g. from GitHub embed back to GitHub repo list)
  const handleBackFromEmbed = () => {
    if (selectedAppId === 'github') {
      setCurrentUrl('');
      setAddressInput('');
    } else {
      handleBackToCatalog();
    }
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
      {/* GITHUB INTEGRATION VIEW (DASHBOARD)                           */}
      {/* ------------------------------------------------------------- */}
      {selectedAppId === 'github' && !currentUrl ? (
        <ProjectGithubView
          projectId={projectId}
          projectName={projectName}
          onOpenInEmbed={handleOpenInEmbed}
          onBackToApps={handleBackToCatalog}
        />
      ) : activeApp && currentUrl ? (
        /* ------------------------------------------------------------- */
        /* ACTIVE EMBEDDED BROWSER VIEW (FOR GOOGLE OR EMBEDDED GITHUB)   */
        /* ------------------------------------------------------------- */
        <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
          {/* Top Browser Bar */}
          <div className="h-12 border-b border-[#2A2C30] bg-[#1B1C20] px-3 flex items-center justify-between gap-3 shrink-0">
            {/* Left: Back button & App Logo/Name */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleBackFromEmbed}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#787C83] hover:text-[#CFD4DD] hover:bg-[#2A2C30] transition-colors cursor-pointer"
                title={selectedAppId === 'github' ? 'Back to GitHub Repositories' : 'Back to Apps'}
              >
                <ArrowLeft size={14} />
                <span>{selectedAppId === 'github' ? 'Repos' : 'Apps'}</span>
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
                  placeholder="Enter URL or search..."
                  className="w-full bg-[#141518] border border-[#2A2C30] focus:border-[#DCB001] text-xs text-[#CFD4DD] placeholder-[#787C83] rounded-lg pl-8 pr-16 py-1.5 focus:outline-none transition-colors font-mono text-[11px]"
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
                <span className="text-xs text-[#787C83] font-medium">Loading {activeApp.name}...</span>
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
                title={activeApp.name}
              />
            ) : null}

            {/* Bottom Overlay Info */}
            <div className="absolute bottom-2 right-3 z-10 flex items-center gap-2 bg-[#1B1C20]/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-[#2A2C30] text-[11px] text-[#787C83] shadow-lg">
              <span>{activeApp.name}</span>
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
        /* APPS DIRECTORY / CATALOG: ONLY SHOW LOGO & NAME ONLY          */
        /* ------------------------------------------------------------- */
        <div className="flex-1 flex flex-col items-center justify-center h-full min-h-0 overflow-y-auto p-6 md:p-12">
          <div className="flex flex-wrap items-center justify-center gap-6 max-w-xl w-full">
            {DEFAULT_APPS.map((app) => (
              <button
                key={app.id}
                onClick={() => handleOpenApp(app)}
                className="flex flex-col items-center justify-center p-8 rounded-3xl bg-[#1B1C20] hover:bg-[#2A2C30] border border-[#2A2C30] hover:border-[#DCB001]/50 transition-all duration-200 hover:scale-105 hover:shadow-2xl w-48 h-48 cursor-pointer group"
                title={`Open ${app.name}`}
              >
                <div
                  className={`w-20 h-20 rounded-2xl flex items-center justify-center border ${app.iconBg} mb-4 transition-transform group-hover:scale-110 shadow-md ${app.iconColor}`}
                >
                  <AppIcon app={app} size={44} />
                </div>
                <span className="text-base font-semibold text-white group-hover:text-[#DCB001] transition-colors text-center">
                  {app.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TOKEN PROMPT MODAL (WHEN CLICKING GITHUB WITHOUT TOKEN)       */}
      {/* ------------------------------------------------------------- */}
      {showTokenPromptModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="max-w-md w-full bg-[#141518] border border-[#2A2C30] rounded-2xl p-6 shadow-2xl relative text-left">
            <button
              onClick={() => setShowTokenPromptModal(false)}
              className="absolute top-4 right-4 text-[#787C83] hover:text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white mb-4 shadow-md">
              <AppIcon app={{ id: 'github', name: 'GitHub', defaultUrl: '', iconBg: '', iconColor: '' }} size={28} />
            </div>

            <h3 className="text-base font-bold text-white tracking-tight mb-1">
              GitHub Access Token Required
            </h3>
            <p className="text-xs text-[#9BA1A6] mb-5 leading-relaxed">
              To open GitHub and connect repositories to this project, please provide your GitHub Personal Access Token.
            </p>

            <form onSubmit={handleConfirmTokenAndOpen} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#CFD4DD] mb-1.5 flex items-center gap-1.5">
                  <Key size={13} className="text-[#DCB001]" />
                  <span>Personal Access Token</span>
                </label>

                <div className="relative flex items-center">
                  <input
                    type={showTokenText ? 'text' : 'password'}
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx or github_pat_..."
                    className="w-full bg-[#0E0F12] border border-[#2A2C30] focus:border-[#DCB001] text-xs text-white placeholder-[#787C83] rounded-xl px-3 py-2.5 pr-10 focus:outline-none transition-colors font-mono"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowTokenText(!showTokenText)}
                    className="absolute right-3 text-[#787C83] hover:text-white transition-colors"
                  >
                    {showTokenText ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>

                <div className="flex items-center justify-between mt-2 text-[11px] text-[#787C83]">
                  <span>Requires <code className="text-[#DCB001] bg-[#1B1C20] px-1 py-0.5 rounded">repo</code> scope</span>
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo&description=Teader%20Workspace"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#DCB001] hover:underline flex items-center gap-1"
                  >
                    <span>Generate token</span>
                    <ExternalLink size={10} />
                  </a>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTokenPromptModal(false)}
                  className="px-4 py-2 text-xs font-medium text-[#787C83] hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingToken || !tokenInput.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-black bg-[#DCB001] hover:bg-[#E5B800] disabled:opacity-50 rounded-xl shadow-lg transition-all cursor-pointer"
                >
                  {isVerifyingToken ? (
                    <>
                      <RotateCw size={13} className="animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <span>Connect & Open</span>
                  )}
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
 * Dedicated App Icon Renderer for Google and GitHub
 */
function AppIcon({ app, size = 24 }: { app: AppDefinition; size?: number }) {
  if (app.id === 'github') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
        />
      </svg>
    );
  }

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
