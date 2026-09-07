'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Key,
  ExternalLink,
  Plus,
  Check,
  Search,
  RefreshCw,
  Trash2,
  Copy,
  Lock,
  Globe,
  Star,
  GitFork,
  GitBranch,
  ArrowLeft,
  Eye,
  EyeOff,
  LogOut,
  FolderGit2,
  Code2,
  X,
  RotateCw
} from 'lucide-react';
import { toast } from 'sonner';
import { ProjectGithubRepoDetailView } from './ProjectGithubRepoDetailView';

export function GithubIcon({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-label="GitHub Logo"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

export interface RepositoryItem {
  id: number;
  name: string;
  fullName: string;
  htmlUrl: string;
  description?: string | null;
  defaultBranch?: string;
  isPrivate?: boolean;
  language?: string | null;
  starsCount?: number;
  forksCount?: number;
  openIssuesCount?: number;
  updatedAt?: string;
  owner?: {
    login: string;
    avatarUrl?: string;
    htmlUrl?: string;
  };
}

export interface ProjectRepositoryRecord extends RepositoryItem {
  projectId: number;
  repoId?: number | null;
  createdBy?: number | null;
  createdAt: string;
}

interface ProjectGithubViewProps {
  projectId: number | string;
  projectName?: string;
  onOpenInEmbed?: (url: string, title?: string) => void;
  onBackToPlugins?: () => void;
  onBackToApps?: () => void;
  onBack?: () => void;
}

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178C6',
  JavaScript: '#F7DF1E',
  Python: '#3776AB',
  Rust: '#DEA584',
  Go: '#00ADD8',
  Java: '#B07219',
  'C++': '#F34B7D',
  C: '#555555',
  'C#': '#178600',
  PHP: '#4F5D95',
  Ruby: '#701516',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Dart: '#00B4AB',
  HTML: '#E34C26',
  CSS: '#563D7C',
  Shell: '#89E051',
  Vue: '#41B883',
};

function getIframeSrc(url: string): string {
  if (!url) return '';
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

export function ProjectGithubView({
  projectId,
  projectName,
  onOpenInEmbed,
  onBackToPlugins,
  onBackToApps,
  onBack,
}: ProjectGithubViewProps) {
  // Authentication State
  const [token, setToken] = useState<string>('');
  const [githubUser, setGithubUser] = useState<any>(null);
  const [isVerifyingToken, setIsVerifyingToken] = useState<boolean>(false);

  // Repositories Data for this Project (The Page List)
  const [projectRepos, setProjectRepos] = useState<ProjectRepositoryRecord[]>([]);
  const [isLoadingProjectRepos, setIsLoadingProjectRepos] = useState<boolean>(true);
  const [activeRepo, setActiveRepo] = useState<ProjectRepositoryRecord | null>(null);

  // All User Repositories from GitHub
  const [allUserRepos, setAllUserRepos] = useState<RepositoryItem[]>([]);
  const [isLoadingAllRepos, setIsLoadingAllRepos] = useState<boolean>(false);

  // Search & Filter for Page List
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'private'>('all');

  // Modal 1: Token Prompt Modal (if clicked Add without token)
  const [showTokenPromptModal, setShowTokenPromptModal] = useState<boolean>(false);
  const [tokenInput, setTokenInput] = useState<string>('');
  const [showTokenText, setShowTokenText] = useState<boolean>(false);

  // Modal 2: Add Repositories Selection Modal (Show All Repos)
  const [showAddReposModal, setShowAddReposModal] = useState<boolean>(false);
  const [modalSearchQuery, setModalSearchQuery] = useState<string>('');
  const [modalVisibilityFilter, setModalVisibilityFilter] = useState<'all' | 'public' | 'private'>('all');
  const [selectedRepoFullNames, setSelectedRepoFullNames] = useState<Set<string>>(new Set());
  const [isAddingRepos, setIsAddingRepos] = useState<boolean>(false);

  // In-view Embedded Browser
  const [embeddedUrl, setEmbeddedUrl] = useState<string | null>(null);
  const [embeddedTitle, setEmbeddedTitle] = useState<string>('');
  const [isLoadingIframe, setIsLoadingIframe] = useState<boolean>(false);
  const [iframeKey, setIframeKey] = useState<number>(0);

  // Navigation back handler
  const handleBackNavigation = () => {
    if (onBackToPlugins) {
      onBackToPlugins();
    } else if (onBackToApps) {
      onBackToApps();
    } else if (onBack) {
      onBack();
    }
  };

  const backLabel = onBackToPlugins ? 'Plugins' : onBackToApps ? 'Apps' : 'Back';

  // Load stored GitHub token & fetch project repos on mount
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem('teader_github_token');
      if (storedToken && storedToken.trim()) {
        setToken(storedToken.trim());
        verifyAndFetchUser(storedToken.trim());
      }
    } catch {}
    fetchProjectRepositories();
  }, [projectId]);

  // Fetch project repositories from Teader DB (The Page List)
  const fetchProjectRepositories = async () => {
    setIsLoadingProjectRepos(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/repositories`);
      if (res.ok) {
        const data = await res.json();
        setProjectRepos(data.repositories || []);
      }
    } catch (err) {
      console.error('Failed to load project repositories:', err);
    } finally {
      setIsLoadingProjectRepos(false);
    }
  };

  // Verify token and fetch user details
  const verifyAndFetchUser = async (authToken: string) => {
    setIsVerifyingToken(true);
    try {
      const res = await fetch('/api/github/user', {
        headers: {
          'x-github-token': authToken,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setGithubUser(data.user);
      } else {
        // Token invalid or expired
        setToken('');
        setGithubUser(null);
        try {
          localStorage.removeItem('teader_github_token');
        } catch {}
      }
    } catch {
      // Ignore network errors on background check
    } finally {
      setIsVerifyingToken(false);
    }
  };

  // Fetch all user repos from GitHub API
  const fetchAllUserRepos = async (authToken?: string) => {
    const t = authToken || token;
    if (!t) return;
    setIsLoadingAllRepos(true);
    try {
      const res = await fetch('/api/github/repos', {
        headers: {
          'x-github-token': t,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setAllUserRepos(data.repos || []);
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.error || 'Failed to list GitHub repositories');
      }
    } catch {
      toast.error('Failed to connect to GitHub API');
    } finally {
      setIsLoadingAllRepos(false);
    }
  };

  // Handle clicking top-right "Add" button
  const handleHeaderAddClick = () => {
    const storedToken =
      token || (typeof window !== 'undefined' ? localStorage.getItem('teader_github_token') : null);

    if (storedToken && storedToken.trim()) {
      // Token is set: immediately show all repos modal
      setShowAddReposModal(true);
      fetchAllUserRepos(storedToken.trim());
    } else {
      // Token is NOT set: ask for auth token first
      setTokenInput('');
      setShowTokenPromptModal(true);
    }
  };

  // Handle Token Submission from Modal 1
  const handleConfirmTokenAndProceed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      toast.error('Please enter a GitHub Personal Access Token');
      return;
    }
    const cleanToken = tokenInput.trim();
    setIsVerifyingToken(true);
    try {
      const res = await fetch('/api/github/user', {
        headers: { 'x-github-token': cleanToken },
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('teader_github_token', cleanToken);
        setToken(cleanToken);
        setGithubUser(data.user);
        setShowTokenPromptModal(false);
        setTokenInput('');
        toast.success('GitHub authenticated successfully!');

        // Immediately show all repos modal
        setShowAddReposModal(true);
        fetchAllUserRepos(cleanToken);
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

  // Disconnect GitHub Account
  const handleDisconnect = () => {
    if (confirm('Disconnect GitHub account from this browser?')) {
      try {
        localStorage.removeItem('teader_github_token');
      } catch {}
      setToken('');
      setGithubUser(null);
      setAllUserRepos([]);
      setSelectedRepoFullNames(new Set());
      toast.success('GitHub account disconnected');
    }
  };

  // Add selected repos to this project
  const handleAddSelectedRepos = async () => {
    if (selectedRepoFullNames.size === 0) {
      toast.error('Please select at least one repository to add');
      return;
    }

    const reposToAdd = allUserRepos.filter((r) => selectedRepoFullNames.has(r.fullName));
    if (reposToAdd.length === 0) return;

    setIsAddingRepos(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/repositories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repos: reposToAdd }),
      });

      if (res.ok) {
        const data = await res.json();
        const count = data.added?.length || reposToAdd.length;
        toast.success(`Added ${count} repository${count === 1 ? '' : 's'} to this project!`);
        setShowAddReposModal(false);
        setSelectedRepoFullNames(new Set());
        fetchProjectRepositories();
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.error || 'Failed to add repository to project');
      }
    } catch (err) {
      console.error('Error adding repositories:', err);
      toast.error('Network error while adding repositories');
    } finally {
      setIsAddingRepos(false);
    }
  };

  // Remove repo from project
  const handleDeleteRepo = async (fullName: string) => {
    if (!confirm(`Remove "${fullName}" from this project?`)) return;

    try {
      const res = await fetch(
        `/api/projects/${projectId}/repositories?repoId=${encodeURIComponent(fullName)}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        toast.success(`Removed "${fullName}" from project`);
        setProjectRepos((prev) => prev.filter((r) => r.fullName !== fullName));
      } else {
        toast.error('Failed to remove repository');
      }
    } catch {
      toast.error('Error removing repository');
    }
  };

  // Copy Clone Command
  const handleCopyClone = (htmlUrl: string) => {
    const cloneUrl = htmlUrl.endsWith('.git') ? htmlUrl : `${htmlUrl}.git`;
    navigator.clipboard.writeText(`git clone ${cloneUrl}`);
    toast.success('Copied clone command to clipboard!');
  };

  // Open repository in native in-app detail view
  const handleOpenRepo = (repo: ProjectRepositoryRecord | RepositoryItem) => {
    setActiveRepo(repo as ProjectRepositoryRecord);
  };

  // Filtered Project Repos (The Page List)
  const filteredProjectRepos = useMemo(() => {
    return projectRepos.filter((r) => {
      const matchesSearch =
        !searchQuery.trim() ||
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.language && r.language.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesVisibility =
        visibilityFilter === 'all' ||
        (visibilityFilter === 'public' && !r.isPrivate) ||
        (visibilityFilter === 'private' && r.isPrivate);

      return matchesSearch && matchesVisibility;
    });
  }, [projectRepos, searchQuery, visibilityFilter]);

  // Set of already added repo full names
  const addedFullNameSet = useMemo(() => {
    return new Set(projectRepos.map((r) => r.fullName));
  }, [projectRepos]);

  // Filtered All User Repos for Modal 2
  const filteredModalRepos = useMemo(() => {
    return allUserRepos.filter((r) => {
      const matchesSearch =
        !modalSearchQuery.trim() ||
        r.name.toLowerCase().includes(modalSearchQuery.toLowerCase()) ||
        r.fullName.toLowerCase().includes(modalSearchQuery.toLowerCase()) ||
        (r.description && r.description.toLowerCase().includes(modalSearchQuery.toLowerCase())) ||
        (r.language && r.language.toLowerCase().includes(modalSearchQuery.toLowerCase()));

      const matchesVisibility =
        modalVisibilityFilter === 'all' ||
        (modalVisibilityFilter === 'public' && !r.isPrivate) ||
        (modalVisibilityFilter === 'private' && r.isPrivate);

      return matchesSearch && matchesVisibility;
    });
  }, [allUserRepos, modalSearchQuery, modalVisibilityFilter]);

  // Toggle selection in Modal 2
  const toggleSelectRepo = (fullName: string) => {
    const next = new Set(selectedRepoFullNames);
    if (next.has(fullName)) {
      next.delete(fullName);
    } else {
      next.add(fullName);
    }
    setSelectedRepoFullNames(next);
  };

  const toggleSelectAll = () => {
    const unaddedFiltered = filteredModalRepos.filter((r) => !addedFullNameSet.has(r.fullName));
    if (selectedRepoFullNames.size === unaddedFiltered.length && unaddedFiltered.length > 0) {
      setSelectedRepoFullNames(new Set());
    } else {
      setSelectedRepoFullNames(new Set(unaddedFiltered.map((r) => r.fullName)));
    }
  };

  // If viewing repository details in-app
  if (activeRepo) {
    return (
      <ProjectGithubRepoDetailView
        repo={activeRepo}
        projectId={projectId}
        onBack={() => setActiveRepo(null)}
      />
    );
  }

  // If in embedded browser view
  if (embeddedUrl) {
    return (
      <div className="flex-1 flex flex-col h-full min-h-0 bg-[#0E0F12] text-[#CFD4DD] overflow-hidden">
        {/* Top Browser Bar */}
        <div className="h-12 border-b border-[#2A2C30] bg-[#141518] px-3 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setEmbeddedUrl(null)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#787C83] hover:text-[#CFD4DD] hover:bg-[#2A2C30] transition-colors cursor-pointer"
              title="Back to Repository List"
            >
              <ArrowLeft size={14} />
              <span>Repos</span>
            </button>
            <div className="h-4 w-px bg-[#2A2C30]" />
            <span className="text-xs font-bold text-white tracking-tight">{embeddedTitle || 'GitHub'}</span>
          </div>

          <div className="flex-1 max-w-xl min-w-0 bg-[#0E0F12] border border-[#2A2C30] rounded-lg px-3 py-1 text-xs text-[#787C83] font-mono truncate">
            {embeddedUrl}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => {
                setIsLoadingIframe(true);
                setIframeKey((k) => k + 1);
              }}
              className="p-1.5 text-[#787C83] hover:text-[#CFD4DD] hover:bg-[#2A2C30] rounded-lg transition-colors cursor-pointer"
              title="Reload"
            >
              <RotateCw size={14} className={isLoadingIframe ? 'animate-spin text-[#DCB001]' : ''} />
            </button>
            <button
              onClick={() => window.open(embeddedUrl, '_blank')}
              className="p-1.5 text-[#787C83] hover:text-[#CFD4DD] hover:bg-[#2A2C30] rounded-lg transition-colors cursor-pointer"
              title="Open in New Tab"
            >
              <ExternalLink size={14} />
            </button>
          </div>
        </div>

        {/* Embedded Iframe */}
        <div className="flex-1 w-full h-full min-h-0 relative bg-[#0D0E11] overflow-hidden">
          {isLoadingIframe && (
            <div className="absolute inset-0 bg-[#141518]/60 backdrop-blur-xs flex flex-col items-center justify-center z-10 pointer-events-none">
              <div className="w-8 h-8 rounded-full border-2 border-[#2A2C30] border-t-[#DCB001] animate-spin mb-2" />
              <span className="text-xs text-[#787C83] font-medium">Loading GitHub...</span>
            </div>
          )}
          <iframe
            key={iframeKey}
            src={getIframeSrc(embeddedUrl)}
            onLoad={() => setIsLoadingIframe(false)}
            allow="accelerometer; autoplay; camera; clipboard-read; clipboard-write; encrypted-media; fullscreen; gyroscope; microphone; picture-in-picture; web-share"
            className="w-full h-full border-0 bg-white"
            title={embeddedTitle || 'GitHub'}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-[#0E0F12] text-[#CFD4DD] overflow-hidden select-none">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* TOP BAR: Back + Title + Linked Count + Add Button             */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="h-14 border-b border-[#2A2C30] bg-[#141518] px-6 flex items-center justify-between gap-3 shrink-0">
        {/* Left: Back Button & GitHub Branding */}
        <div className="flex items-center gap-3 shrink-0">
          {(onBackToPlugins || onBackToApps || onBack) && (
            <>
              <button
                onClick={handleBackNavigation}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#787C83] hover:text-[#CFD4DD] hover:bg-[#2A2C30] transition-colors cursor-pointer"
                title={`Back to ${backLabel}`}
              >
                <ArrowLeft size={14} />
                <span>{backLabel}</span>
              </button>
              <div className="h-4 w-px bg-[#2A2C30]" />
            </>
          )}

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-sm">
              <GithubIcon size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white tracking-tight">
                  GitHub Repositories
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#2A2C30] text-[#DCB001] font-mono font-medium">
                  {projectRepos.length}
                </span>
              </div>
              <p className="text-[11px] text-[#787C83]">
                {projectName ? `${projectName} repositories` : 'Connected project repositories'}
              </p>
            </div>
          </div>
        </div>

        {/* Right: Connected Account Info & Prominent "Add" Button */}
        <div className="flex items-center gap-3 shrink-0">
          {token && githubUser && (
            <div className="flex items-center gap-2 bg-[#1B1C20] border border-[#2A2C30] px-2.5 py-1 rounded-xl">
              {githubUser.avatar_url && (
                <img
                  src={githubUser.avatar_url}
                  alt={githubUser.login}
                  className="w-5 h-5 rounded-full object-cover border border-[#2A2C30]"
                />
              )}
              <span className="text-xs font-medium text-white tracking-tight">
                {githubUser.login}
              </span>
              <button
                onClick={handleDisconnect}
                className="text-[#787C83] hover:text-[#EF4444] transition-colors p-0.5 ml-1 cursor-pointer"
                title="Disconnect GitHub Account"
              >
                <LogOut size={12} />
              </button>
            </div>
          )}

          {/* Top Right Button called "Add" */}
          <button
            onClick={handleHeaderAddClick}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#DCB001] hover:bg-[#E5B800] text-black text-xs font-bold rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer"
            title="Add repository to this project"
          >
            <Plus size={14} className="stroke-[3]" />
            <span>Add</span>
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* CONTROLS BAR: Filter Linked Repositories                      */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="h-12 border-b border-[#2A2C30] bg-[#141518]/60 px-6 flex items-center justify-between gap-3 shrink-0">
        {/* Search within page list */}
        <div className="relative flex-1 max-w-md">
          <Search size={13} className="absolute left-3 top-2.5 text-[#787C83]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search connected repositories..."
            className="w-full bg-[#1B1C20] border border-[#2A2C30] focus:border-[#DCB001] text-xs text-white placeholder-[#787C83] rounded-lg pl-8 pr-3 py-1.5 focus:outline-none transition-colors"
          />
        </div>

        {/* Filter Pills & Refresh */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#1B1C20] p-0.5 rounded-lg border border-[#2A2C30] text-xs">
            {(['all', 'public', 'private'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setVisibilityFilter(mode)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer capitalize ${
                  visibilityFilter === mode
                    ? 'bg-[#2A2C30] text-white'
                    : 'text-[#787C83] hover:text-[#CFD4DD]'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchProjectRepositories()}
            className="p-1.5 text-[#787C83] hover:text-[#CFD4DD] hover:bg-[#2A2C30] rounded-lg transition-colors cursor-pointer"
            title="Refresh List"
          >
            <RefreshCw
              size={13}
              className={isLoadingProjectRepos ? 'animate-spin text-[#DCB001]' : ''}
            />
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MAIN CONTENT: THE PAGE LIST                                   */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6 min-h-0 custom-scrollbar">
        {isLoadingProjectRepos ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-xs text-[#787C83]">
            <RefreshCw size={20} className="animate-spin text-[#DCB001]" />
            <span>Loading repositories...</span>
          </div>
        ) : filteredProjectRepos.length === 0 ? (
          /* Clean Empty State */
          <div className="flex flex-col items-center justify-center h-80 max-w-md mx-auto text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#1B1C20] border border-[#2A2C30] flex items-center justify-center text-[#787C83] mb-4 shadow-inner">
              <FolderGit2 size={32} />
            </div>
            <h4 className="text-base font-bold text-white mb-1">
              {searchQuery ? 'No matching repositories' : 'No Repositories Added Yet'}
            </h4>
            <p className="text-xs text-[#9BA1A6] mb-6 leading-relaxed max-w-sm">
              {searchQuery
                ? 'Try clearing or changing your search filter to find repositories.'
                : 'Connect your GitHub repositories to this project to track branches, open code, and collaborate.'}
            </p>
            <button
              onClick={handleHeaderAddClick}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#DCB001] hover:bg-[#E5B800] text-black text-xs font-bold rounded-xl shadow-lg transition-all cursor-pointer hover:scale-105"
            >
              <Plus size={15} className="stroke-[3]" />
              <span>Add Repository</span>
            </button>
          </div>
        ) : (
          /* Repositories Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjectRepos.map((repo) => (
              <div
                key={repo.id || repo.fullName}
                className="bg-[#141518] hover:bg-[#18191D] border border-[#2A2C30] hover:border-[#DCB001]/40 rounded-2xl p-4 flex flex-col justify-between transition-all duration-150 shadow-md group"
              >
                <div>
                  {/* Card Header: Repo name + Badges */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[#DCB001] shrink-0">
                        <Code2 size={16} />
                      </span>
                      <h4
                        className="text-xs font-bold text-white hover:text-[#DCB001] transition-colors truncate cursor-pointer"
                        onClick={() => handleOpenRepo(repo)}
                        title={repo.fullName}
                      >
                        {repo.name}
                      </h4>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md shrink-0 border ${
                        repo.isPrivate
                          ? 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20'
                          : 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20'
                      }`}
                    >
                      {repo.isPrivate ? <Lock size={10} /> : <Globe size={10} />}
                      <span>{repo.isPrivate ? 'Private' : 'Public'}</span>
                    </span>
                  </div>

                  {/* Full Name / Namespace */}
                  <p className="text-[11px] text-[#787C83] font-mono mb-2 truncate">
                    {repo.fullName}
                  </p>

                  {/* Description */}
                  <p className="text-xs text-[#9BA1A6] line-clamp-2 mb-3 min-h-[32px]">
                    {repo.description || 'No description provided.'}
                  </p>

                  {/* Metadata Chips */}
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#787C83] mb-4">
                    {repo.language && (
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{
                            backgroundColor: LANGUAGE_COLORS[repo.language] || '#8B949E',
                          }}
                        />
                        <span>{repo.language}</span>
                      </div>
                    )}

                    {repo.defaultBranch && (
                      <div className="flex items-center gap-1 font-mono">
                        <GitBranch size={11} />
                        <span>{repo.defaultBranch}</span>
                      </div>
                    )}

                    {typeof repo.starsCount === 'number' && (
                      <div className="flex items-center gap-1">
                        <Star size={11} className="text-[#DCB001]" />
                        <span>{repo.starsCount}</span>
                      </div>
                    )}

                    {typeof repo.forksCount === 'number' && (
                      <div className="flex items-center gap-1">
                        <GitFork size={11} />
                        <span>{repo.forksCount}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="pt-3 border-t border-[#2A2C30] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenRepo(repo)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-[#222428] hover:bg-[#2A2C30] text-[#CFD4DD] hover:text-white rounded-lg transition-colors cursor-pointer"
                      title="Open repository"
                    >
                      <span>Open</span>
                      <ExternalLink size={11} />
                    </button>

                    <button
                      onClick={() => handleCopyClone(repo.htmlUrl)}
                      className="p-1.5 text-[#787C83] hover:text-white hover:bg-[#2A2C30] rounded-lg transition-colors cursor-pointer"
                      title="Copy clone URL"
                    >
                      <Copy size={13} />
                    </button>
                  </div>

                  <button
                    onClick={() => handleDeleteRepo(repo.fullName)}
                    className="p-1.5 text-[#787C83] hover:text-[#EF4444] hover:bg-[#EF4444]/10 rounded-lg transition-colors cursor-pointer"
                    title="Remove from project"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 1: TOKEN PROMPT (WHEN CLICKING ADD WITHOUT AUTH TOKEN)  */}
      {/* ───────────────────────────────────────────────────────────── */}
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
              <GithubIcon size={28} />
            </div>

            <h3 className="text-base font-bold text-white tracking-tight mb-1">
              GitHub Access Token Required
            </h3>
            <p className="text-xs text-[#9BA1A6] mb-5 leading-relaxed">
              To browse and add repositories to this project, please provide your GitHub Personal Access Token.
            </p>

            <form onSubmit={handleConfirmTokenAndProceed} className="space-y-4">
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
                    className="absolute right-3 text-[#787C83] hover:text-white transition-colors cursor-pointer"
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
                    <span>Connect &amp; Continue</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 2: SELECT REPOSITORIES FROM GITHUB ACCOUNT (SHOW REPOS) */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showAddReposModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="max-w-2xl w-full bg-[#141518] border border-[#2A2C30] rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-left">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#2A2C30] flex items-center justify-between shrink-0 bg-[#17181D]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white">
                  <GithubIcon size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">
                    Add Repositories to Project
                  </h3>
                  <p className="text-xs text-[#787C83]">
                    Select repositories from your GitHub account to link to this project
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowAddReposModal(false);
                  setSelectedRepoFullNames(new Set());
                }}
                className="text-[#787C83] hover:text-white p-1 rounded-lg hover:bg-[#2A2C30] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Search & Filter Controls */}
            <div className="px-5 py-3 border-b border-[#2A2C30] bg-[#141518] flex items-center justify-between gap-3 shrink-0">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-3 top-2.5 text-[#787C83]" />
                <input
                  type="text"
                  value={modalSearchQuery}
                  onChange={(e) => setModalSearchQuery(e.target.value)}
                  placeholder="Search your GitHub repositories..."
                  className="w-full bg-[#0E0F12] border border-[#2A2C30] focus:border-[#DCB001] text-xs text-white placeholder-[#787C83] rounded-lg pl-8 pr-3 py-1.5 focus:outline-none transition-colors"
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center bg-[#0E0F12] p-0.5 rounded-lg border border-[#2A2C30] text-xs">
                  {(['all', 'public', 'private'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setModalVisibilityFilter(mode)}
                      className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer capitalize ${
                        modalVisibilityFilter === mode
                          ? 'bg-[#2A2C30] text-white'
                          : 'text-[#787C83] hover:text-[#CFD4DD]'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="px-2.5 py-1 text-[11px] font-semibold text-[#DCB001] hover:bg-[#DCB001]/10 rounded-lg transition-colors cursor-pointer"
                >
                  {selectedRepoFullNames.size > 0 ? 'Clear All' : 'Select All'}
                </button>
              </div>
            </div>

            {/* Modal Repos List */}
            <div className="flex-1 overflow-y-auto p-5 min-h-[250px] space-y-2 custom-scrollbar">
              {isLoadingAllRepos ? (
                <div className="flex flex-col items-center justify-center h-48 gap-2 text-xs text-[#787C83]">
                  <RefreshCw size={20} className="animate-spin text-[#DCB001]" />
                  <span>Fetching repositories from GitHub...</span>
                </div>
              ) : filteredModalRepos.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center text-[#787C83]">
                  <FolderGit2 size={28} className="mb-2 opacity-50" />
                  <p className="text-xs font-semibold text-white">No repositories found</p>
                  <p className="text-[11px]">No repositories matched your search criteria</p>
                </div>
              ) : (
                filteredModalRepos.map((repo) => {
                  const isAdded = addedFullNameSet.has(repo.fullName);
                  const isSelected = selectedRepoFullNames.has(repo.fullName);

                  return (
                    <div
                      key={repo.id}
                      onClick={() => {
                        if (!isAdded) toggleSelectRepo(repo.fullName);
                      }}
                      className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all select-none ${
                        isAdded
                          ? 'bg-[#18191D]/50 border-[#2A2C30]/50 opacity-60 cursor-not-allowed'
                          : isSelected
                          ? 'bg-[#DCB001]/10 border-[#DCB001] cursor-pointer'
                          : 'bg-[#18191D] hover:bg-[#202227] border-[#2A2C30] cursor-pointer'
                      }`}
                    >
                      {/* Checkbox / Added Indicator */}
                      <div className="pt-0.5 shrink-0">
                        {isAdded ? (
                          <div className="w-4 h-4 rounded bg-[#22C55E]/20 text-[#22C55E] flex items-center justify-center">
                            <Check size={11} className="stroke-[3]" />
                          </div>
                        ) : (
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                              isSelected
                                ? 'bg-[#DCB001] border-[#DCB001] text-black'
                                : 'border-[#4E5158] bg-[#0E0F12]'
                            }`}
                          >
                            {isSelected && <Check size={11} className="stroke-[3]" />}
                          </div>
                        )}
                      </div>

                      {/* Repo Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-bold text-white truncate">
                            {repo.name}
                          </span>

                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.2 rounded border ${
                              repo.isPrivate
                                ? 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20'
                                : 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20'
                            }`}
                          >
                            {repo.isPrivate ? <Lock size={9} /> : <Globe size={9} />}
                            <span>{repo.isPrivate ? 'Private' : 'Public'}</span>
                          </span>

                          {isAdded && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#22C55E]/20 text-[#22C55E] font-medium ml-auto shrink-0">
                              Added
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-[#787C83] font-mono truncate mb-1">
                          {repo.fullName}
                        </p>

                        {repo.description && (
                          <p className="text-xs text-[#9BA1A6] line-clamp-1 mb-2">
                            {repo.description}
                          </p>
                        )}

                        <div className="flex items-center gap-3 text-[11px] text-[#787C83]">
                          {repo.language && (
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{
                                  backgroundColor: LANGUAGE_COLORS[repo.language] || '#8B949E',
                                }}
                              />
                              <span>{repo.language}</span>
                            </div>
                          )}

                          {repo.defaultBranch && (
                            <div className="flex items-center gap-1 font-mono">
                              <GitBranch size={10} />
                              <span>{repo.defaultBranch}</span>
                            </div>
                          )}

                          {typeof repo.starsCount === 'number' && (
                            <div className="flex items-center gap-1">
                              <Star size={10} className="text-[#DCB001]" />
                              <span>{repo.starsCount}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#2A2C30] bg-[#17181D] flex items-center justify-between shrink-0">
              <span className="text-xs text-[#787C83]">
                {selectedRepoFullNames.size === 0
                  ? 'Select repositories to add'
                  : `${selectedRepoFullNames.size} repositor${
                      selectedRepoFullNames.size === 1 ? 'y' : 'ies'
                    } selected`}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddReposModal(false);
                    setSelectedRepoFullNames(new Set());
                  }}
                  className="px-4 py-2 text-xs font-semibold text-[#787C83] hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleAddSelectedRepos}
                  disabled={selectedRepoFullNames.size === 0 || isAddingRepos}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#DCB001] hover:bg-[#E5B800] disabled:opacity-50 text-black text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
                >
                  {isAddingRepos ? (
                    <>
                      <RotateCw size={13} className="animate-spin" />
                      <span>Adding...</span>
                    </>
                  ) : (
                    <>
                      <Plus size={13} className="stroke-[3]" />
                      <span>Add</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
