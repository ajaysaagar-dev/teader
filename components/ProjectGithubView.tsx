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
  CheckCircle2,
  Code2
} from 'lucide-react';
import { toast } from 'sonner';

function GithubIcon({ size = 24, className = '' }: { size?: number; className?: string }) {
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
  onOpenInEmbed: (url: string, title?: string) => void;
  onBackToApps: () => void;
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

export function ProjectGithubView({
  projectId,
  onOpenInEmbed,
  onBackToApps,
}: ProjectGithubViewProps) {
  // Authentication State
  const [token, setToken] = useState<string>('');
  const [tokenInput, setTokenInput] = useState<string>('');
  const [showToken, setShowToken] = useState<boolean>(false);
  const [isVerifyingToken, setIsVerifyingToken] = useState<boolean>(false);
  const [githubUser, setGithubUser] = useState<any>(null);

  // View Sub-tabs: 'project_repos' | 'browse'
  const [activeSubTab, setActiveSubTab] = useState<'project_repos' | 'browse'>('project_repos');

  // Repositories Data
  const [projectRepos, setProjectRepos] = useState<ProjectRepositoryRecord[]>([]);
  const [isLoadingProjectRepos, setIsLoadingProjectRepos] = useState<boolean>(true);
  const [allUserRepos, setAllUserRepos] = useState<RepositoryItem[]>([]);
  const [isLoadingAllRepos, setIsLoadingAllRepos] = useState<boolean>(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'private'>('all');

  // Multi-selection for adding to project
  const [selectedRepoFullNames, setSelectedRepoFullNames] = useState<Set<string>>(new Set());
  const [isAddingRepos, setIsAddingRepos] = useState<boolean>(false);

  // Load stored GitHub token & fetch project repos on mount
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem('teader_github_token');
      if (storedToken) {
        setToken(storedToken);
        verifyAndFetchUser(storedToken);
      }
    } catch {}
    fetchProjectRepositories();
  }, [projectId]);

  // Fetch project repositories from Teader DB
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
        // Automatically fetch repos if verified
        fetchAllUserRepos(authToken);
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.error || 'Invalid GitHub token');
        setToken('');
        setGithubUser(null);
        localStorage.removeItem('teader_github_token');
      }
    } catch {
      toast.error('Network error verifying GitHub token');
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
        toast.error(errData.error || 'Failed to list GitHub repos');
      }
    } catch {
      toast.error('Failed to connect to GitHub API');
    } finally {
      setIsLoadingAllRepos(false);
    }
  };

  // Handle Token Submission
  const handleConnectToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      toast.error('Please enter a GitHub Personal Access Token');
      return;
    }
    const cleanToken = tokenInput.trim();
    setToken(cleanToken);
    try {
      localStorage.setItem('teader_github_token', cleanToken);
    } catch {}
    verifyAndFetchUser(cleanToken);
    setTokenInput('');
  };

  // Disconnect GitHub Account
  const handleDisconnect = () => {
    setToken('');
    setGithubUser(null);
    setAllUserRepos([]);
    try {
      localStorage.removeItem('teader_github_token');
    } catch {}
    toast.info('Disconnected GitHub account');
  };

  // Add a single repo to project
  const handleAddSingleRepo = async (repo: RepositoryItem) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/repositories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo }),
      });
      if (res.ok) {
        const data = await res.json();
        setProjectRepos(data.repositories || []);
        toast.success(`Added ${repo.fullName} to project`);
      } else {
        toast.error('Failed to add repository to project');
      }
    } catch {
      toast.error('Error adding repository');
    }
  };

  // Add multiple selected repos to project
  const handleAddSelectedRepos = async () => {
    if (selectedRepoFullNames.size === 0) return;
    setIsAddingRepos(true);
    const reposToAdd = allUserRepos.filter((r) => selectedRepoFullNames.has(r.fullName));

    try {
      const res = await fetch(`/api/projects/${projectId}/repositories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repos: reposToAdd }),
      });
      if (res.ok) {
        const data = await res.json();
        setProjectRepos(data.repositories || []);
        setSelectedRepoFullNames(new Set());
        toast.success(`Successfully added ${reposToAdd.length} repositories to project!`);
        setActiveSubTab('project_repos');
      } else {
        toast.error('Failed to add selected repositories');
      }
    } catch {
      toast.error('Error connecting repositories to project');
    } finally {
      setIsAddingRepos(false);
    }
  };

  // Remove repo from project
  const handleRemoveRepo = async (repo: ProjectRepositoryRecord) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/repositories?fullName=${encodeURIComponent(repo.fullName)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const data = await res.json();
        setProjectRepos(data.repositories || []);
        toast.info(`Removed ${repo.fullName} from project`);
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

  // Filtered Project Repos
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

  // Filtered All User Repos
  const filteredAllRepos = useMemo(() => {
    return allUserRepos.filter((r) => {
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
  }, [allUserRepos, searchQuery, visibilityFilter]);

  const addedFullNameSet = useMemo(() => {
    return new Set(projectRepos.map((r) => r.fullName));
  }, [projectRepos]);

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
    const unaddedFiltered = filteredAllRepos.filter((r) => !addedFullNameSet.has(r.fullName));
    if (selectedRepoFullNames.size === unaddedFiltered.length && unaddedFiltered.length > 0) {
      setSelectedRepoFullNames(new Set());
    } else {
      setSelectedRepoFullNames(new Set(unaddedFiltered.map((r) => r.fullName)));
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-[#0E0F12] text-[#CFD4DD] overflow-hidden">
      {/* ------------------------------------------------------------- */}
      {/* TOP BAR: Navigation & Connected Account Header               */}
      {/* ------------------------------------------------------------- */}
      <div className="h-14 border-b border-[#2A2C30] bg-[#141518] px-4 flex items-center justify-between gap-3 shrink-0">
        {/* Left: Back to Apps & GitHub Branding */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onBackToApps}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#787C83] hover:text-[#CFD4DD] hover:bg-[#2A2C30] transition-colors cursor-pointer"
            title="Back to Apps Catalog"
          >
            <ArrowLeft size={14} />
            <span>Apps</span>
          </button>

          <div className="h-4 w-px bg-[#2A2C30]" />

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-sm">
              <GithubIcon size={16} />
            </div>
            <div>
              <span className="text-xs font-bold text-white tracking-tight flex items-center gap-1.5">
                GitHub Repositories
                <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-[#2A2C30] text-[#DCB001] font-mono">
                  {projectRepos.length} linked
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Center: Sub-tab switcher (Project Repos vs Browse) */}
        {token && githubUser && (
          <div className="flex items-center bg-[#1B1C20] p-1 rounded-xl border border-[#2A2C30]">
            <button
              onClick={() => setActiveSubTab('project_repos')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeSubTab === 'project_repos'
                  ? 'bg-[#2A2C30] text-[#DCB001] shadow-sm'
                  : 'text-[#787C83] hover:text-[#CFD4DD]'
              }`}
            >
              <FolderGit2 size={13} />
              <span>Project Repos ({projectRepos.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('browse')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeSubTab === 'browse'
                  ? 'bg-[#2A2C30] text-[#DCB001] shadow-sm'
                  : 'text-[#787C83] hover:text-[#CFD4DD]'
              }`}
            >
              <Plus size={13} />
              <span>Browse All Repos</span>
            </button>
          </div>
        )}

        {/* Right: User Profile & Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {token && githubUser ? (
            <div className="flex items-center gap-2 bg-[#1B1C20] border border-[#2A2C30] px-2.5 py-1 rounded-xl">
              {githubUser.avatar_url && (
                <img
                  src={githubUser.avatar_url}
                  alt={githubUser.login}
                  className="w-5 h-5 rounded-full object-cover border border-[#2A2C30]"
                />
              )}
              <span className="text-xs font-medium text-white tracking-tight">{githubUser.login}</span>
              <button
                onClick={handleDisconnect}
                className="text-[#787C83] hover:text-[#EF4444] transition-colors p-1"
                title="Disconnect GitHub Account"
              >
                <LogOut size={12} />
              </button>
            </div>
          ) : (
            <a
              href="https://github.com/settings/tokens/new?scopes=repo&description=Teader%20Workspace"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#DCB001] hover:underline"
            >
              <span>Get Token</span>
              <ExternalLink size={11} />
            </a>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MAIN VIEW CONTENT                                             */}
      {/* ------------------------------------------------------------- */}
      {!token ? (
        /* ============================================================= */
        /* AUTH STATE: CONNECT GITHUB TOKEN PROMPT                       */
        /* ============================================================= */
        <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
          <div className="max-w-md w-full bg-[#141518] border border-[#2A2C30] rounded-2xl p-7 shadow-2xl text-center">
            {/* GitHub Logo Header */}
            <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white mx-auto mb-4 shadow-lg">
              <GithubIcon size={34} />
            </div>

            <h3 className="text-lg font-bold text-white tracking-tight mb-2">
              Connect GitHub Account
            </h3>
            <p className="text-xs text-[#9BA1A6] leading-relaxed mb-6">
              Provide your GitHub Personal Access Token to list your public and private repositories and link them to this project.
            </p>

            {/* Token Form */}
            <form onSubmit={handleConnectToken} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-medium text-[#CFD4DD] mb-1.5 flex items-center gap-1.5">
                  <Key size={13} className="text-[#DCB001]" />
                  <span>GitHub Personal Access Token (PAT)</span>
                </label>

                <div className="relative flex items-center">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx or github_pat_..."
                    className="w-full bg-[#0E0F12] border border-[#2A2C30] focus:border-[#DCB001] text-xs text-white placeholder-[#787C83] rounded-xl px-3 py-2.5 pr-10 focus:outline-none transition-colors font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 text-[#787C83] hover:text-white transition-colors"
                    title={showToken ? 'Hide token' : 'Show token'}
                  >
                    {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
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

              <button
                type="submit"
                disabled={isVerifyingToken || !tokenInput.trim()}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-black bg-[#DCB001] hover:bg-[#E5B800] disabled:opacity-50 transition-all cursor-pointer shadow-lg"
              >
                {isVerifyingToken ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Verifying Token...</span>
                  </>
                ) : (
                  <>
                    <GithubIcon size={14} />
                    <span>Connect GitHub</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* ============================================================= */
        /* AUTHENTICATED WORKSPACE                                       */
        /* ============================================================= */
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Controls Bar: Search & Filter */}
          <div className="h-12 border-b border-[#2A2C30] bg-[#141518]/60 px-4 flex items-center justify-between gap-3 shrink-0">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search size={13} className="absolute left-3 top-2.5 text-[#787C83]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeSubTab === 'project_repos'
                    ? 'Filter linked repositories...'
                    : 'Search GitHub repositories...'
                }
                className="w-full bg-[#1B1C20] border border-[#2A2C30] focus:border-[#DCB001] text-xs text-white placeholder-[#787C83] rounded-lg pl-8 pr-3 py-1.5 focus:outline-none transition-colors"
              />
            </div>

            {/* Visibility Filters & Batch Actions */}
            <div className="flex items-center gap-2">
              {/* Filter: All / Public / Private */}
              <div className="flex items-center bg-[#1B1C20] p-0.5 rounded-lg border border-[#2A2C30] text-xs">
                {(['all', 'public', 'private'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setVisibilityFilter(mode)}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer capitalize ${
                      visibilityFilter === mode
                        ? 'bg-[#2A2C30] text-white'
                        : 'text-[#787C83] hover:text-[#CFD4DD]'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              {/* Refresh button */}
              <button
                onClick={() => {
                  fetchProjectRepositories();
                  if (activeSubTab === 'browse') fetchAllUserRepos();
                }}
                className="p-1.5 text-[#787C83] hover:text-[#CFD4DD] hover:bg-[#2A2C30] rounded-lg transition-colors cursor-pointer"
                title="Refresh Repositories"
              >
                <RefreshCw
                  size={13}
                  className={isLoadingProjectRepos || isLoadingAllRepos ? 'animate-spin text-[#DCB001]' : ''}
                />
              </button>

              {/* Browse Tab: Add Selected Repos Button */}
              {activeSubTab === 'browse' && selectedRepoFullNames.size > 0 && (
                <button
                  onClick={handleAddSelectedRepos}
                  disabled={isAddingRepos}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#DCB001] hover:bg-[#E5B800] text-black text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
                >
                  <Plus size={13} />
                  <span>
                    {isAddingRepos
                      ? 'Adding...'
                      : `Add ${selectedRepoFullNames.size} to Project`}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* ----------------------------------------------------------- */}
          {/* TAB 1: PROJECT REPOSITORIES                                 */}
          {/* ----------------------------------------------------------- */}
          {activeSubTab === 'project_repos' && (
            <div className="flex-1 overflow-y-auto p-4 md:p-6 min-h-0">
              {isLoadingProjectRepos ? (
                <div className="flex flex-col items-center justify-center h-64 gap-2 text-xs text-[#787C83]">
                  <RefreshCw size={18} className="animate-spin text-[#DCB001]" />
                  <span>Loading project repositories...</span>
                </div>
              ) : filteredProjectRepos.length === 0 ? (
                /* Empty state */
                <div className="flex flex-col items-center justify-center h-80 max-w-md mx-auto text-center">
                  <div className="w-14 h-14 rounded-2xl bg-[#1B1C20] border border-[#2A2C30] flex items-center justify-center text-[#787C83] mb-3">
                    <FolderGit2 size={28} />
                  </div>
                  <h4 className="text-sm font-semibold text-white mb-1">
                    {searchQuery ? 'No matching repositories' : 'No Repositories Linked Yet'}
                  </h4>
                  <p className="text-xs text-[#9BA1A6] mb-5 max-w-sm">
                    {searchQuery
                      ? 'Try clearing your search filter to see all connected repositories.'
                      : 'Connect your GitHub repositories to this project to access source code, track branches, and open repositories directly in Teader.'}
                  </p>
                  <button
                    onClick={() => setActiveSubTab('browse')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#DCB001] hover:bg-[#E5B800] text-black text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-md"
                  >
                    <Plus size={14} />
                    <span>Browse & Add Repositories</span>
                  </button>
                </div>
              ) : (
                /* Repos Grid */
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
                              onClick={() => onOpenInEmbed(repo.htmlUrl, repo.name)}
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
                      </div>

                      <div>
                        {/* Meta Tags: Language, Stars, Forks, Branch */}
                        <div className="flex items-center gap-3 text-[11px] text-[#787C83] mb-4 flex-wrap">
                          {repo.language && (
                            <span className="inline-flex items-center gap-1">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{
                                  backgroundColor: LANGUAGE_COLORS[repo.language] || '#787C83',
                                }}
                              />
                              <span className="text-[#CFD4DD]">{repo.language}</span>
                            </span>
                          )}

                          {repo.starsCount !== undefined && repo.starsCount > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[#DCB001]">
                              <Star size={11} fill="currentColor" />
                              <span>{repo.starsCount}</span>
                            </span>
                          )}

                          {repo.forksCount !== undefined && repo.forksCount > 0 && (
                            <span className="inline-flex items-center gap-0.5">
                              <GitFork size={11} />
                              <span>{repo.forksCount}</span>
                            </span>
                          )}

                          {repo.defaultBranch && (
                            <span className="inline-flex items-center gap-0.5 font-mono text-[10px] bg-[#1B1C20] px-1.5 py-0.5 rounded border border-[#2A2C30]">
                              <GitBranch size={10} />
                              <span>{repo.defaultBranch}</span>
                            </span>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-[#232529]">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => onOpenInEmbed(repo.htmlUrl, repo.name)}
                              className="px-2.5 py-1 rounded-lg bg-[#2A2C30] hover:bg-[#DCB001] hover:text-black text-xs font-semibold text-white transition-colors cursor-pointer"
                              title="Open in Teader Workspace"
                            >
                              Open
                            </button>

                            <button
                              onClick={() => handleCopyClone(repo.htmlUrl)}
                              className="p-1 text-[#787C83] hover:text-white hover:bg-[#2A2C30] rounded-lg transition-colors cursor-pointer"
                              title="Copy git clone URL"
                            >
                              <Copy size={13} />
                            </button>

                            <a
                              href={repo.htmlUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 text-[#787C83] hover:text-white hover:bg-[#2A2C30] rounded-lg transition-colors"
                              title="Open on GitHub.com"
                            >
                              <ExternalLink size={13} />
                            </a>
                          </div>

                          <button
                            onClick={() => handleRemoveRepo(repo)}
                            className="p-1 text-[#787C83] hover:text-[#EF4444] hover:bg-[#EF4444]/10 rounded-lg transition-colors cursor-pointer"
                            title="Remove from Project"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ----------------------------------------------------------- */}
          {/* TAB 2: BROWSE ALL GITHUB REPOSITORIES                       */}
          {/* ----------------------------------------------------------- */}
          {activeSubTab === 'browse' && (
            <div className="flex-1 overflow-y-auto p-4 md:p-6 min-h-0">
              {/* Select All Toggle */}
              {filteredAllRepos.length > 0 && (
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#2A2C30] text-xs text-[#787C83]">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleSelectAll}
                      className="flex items-center gap-1.5 text-xs text-[#DCB001] hover:underline cursor-pointer"
                    >
                      <span>
                        {selectedRepoFullNames.size > 0 ? 'Deselect All' : 'Select All Available'}
                      </span>
                    </button>
                    <span>•</span>
                    <span>{filteredAllRepos.length} repositories found</span>
                  </div>

                  {selectedRepoFullNames.size > 0 && (
                    <span className="text-white font-medium">
                      {selectedRepoFullNames.size} selected
                    </span>
                  )}
                </div>
              )}

              {isLoadingAllRepos ? (
                <div className="flex flex-col items-center justify-center h-64 gap-2 text-xs text-[#787C83]">
                  <RefreshCw size={18} className="animate-spin text-[#DCB001]" />
                  <span>Fetching your repositories from GitHub...</span>
                </div>
              ) : filteredAllRepos.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center text-xs text-[#787C83]">
                  <p>No repositories found matching your query.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredAllRepos.map((repo) => {
                    const isAlreadyAdded = addedFullNameSet.has(repo.fullName);
                    const isSelected = selectedRepoFullNames.has(repo.fullName);

                    return (
                      <div
                        key={repo.id || repo.fullName}
                        className={`bg-[#141518] border rounded-2xl p-4 flex flex-col justify-between transition-all duration-150 shadow-md relative ${
                          isAlreadyAdded
                            ? 'border-[#22C55E]/30 bg-[#161B16]/50'
                            : isSelected
                            ? 'border-[#DCB001] bg-[#1C1B14]'
                            : 'border-[#2A2C30] hover:border-[#787C83]'
                        }`}
                      >
                        <div>
                          {/* Card Header: Checkbox + Name + Badges */}
                          <div className="flex items-start gap-2.5 mb-2">
                            {!isAlreadyAdded ? (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectRepo(repo.fullName)}
                                className="mt-0.5 rounded border-[#2A2C30] text-[#DCB001] focus:ring-0 cursor-pointer"
                              />
                            ) : (
                              <CheckCircle2 size={16} className="text-[#22C55E] shrink-0 mt-0.5" />
                            )}

                            <div className="min-w-0 flex-1">
                              <h4
                                className="text-xs font-bold text-white hover:text-[#DCB001] transition-colors truncate cursor-pointer"
                                onClick={() => onOpenInEmbed(repo.htmlUrl, repo.name)}
                                title={repo.fullName}
                              >
                                {repo.name}
                              </h4>
                              <p className="text-[11px] text-[#787C83] font-mono truncate">
                                {repo.fullName}
                              </p>
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

                          {/* Description */}
                          <p className="text-xs text-[#9BA1A6] line-clamp-2 mb-3 min-h-[32px]">
                            {repo.description || 'No description provided.'}
                          </p>
                        </div>

                        <div>
                          {/* Meta Tags: Language, Stars, Forks */}
                          <div className="flex items-center gap-3 text-[11px] text-[#787C83] mb-4 flex-wrap">
                            {repo.language && (
                              <span className="inline-flex items-center gap-1">
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{
                                    backgroundColor: LANGUAGE_COLORS[repo.language] || '#787C83',
                                  }}
                                />
                                <span className="text-[#CFD4DD]">{repo.language}</span>
                              </span>
                            )}

                            {repo.starsCount !== undefined && repo.starsCount > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-[#DCB001]">
                                <Star size={11} fill="currentColor" />
                                <span>{repo.starsCount}</span>
                              </span>
                            )}

                            {repo.forksCount !== undefined && repo.forksCount > 0 && (
                              <span className="inline-flex items-center gap-0.5">
                                <GitFork size={11} />
                                <span>{repo.forksCount}</span>
                              </span>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#232529]">
                            <button
                              onClick={() => onOpenInEmbed(repo.htmlUrl, repo.name)}
                              className="text-[11px] font-medium text-[#787C83] hover:text-white flex items-center gap-1 cursor-pointer"
                            >
                              <span>Preview</span>
                              <ExternalLink size={10} />
                            </button>

                            {isAlreadyAdded ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-[#22C55E]">
                                <Check size={13} />
                                <span>In Project</span>
                              </span>
                            ) : (
                              <button
                                onClick={() => handleAddSingleRepo(repo)}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-[#2A2C30] hover:bg-[#DCB001] hover:text-black text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                              >
                                <Plus size={12} />
                                <span>Add to Project</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
