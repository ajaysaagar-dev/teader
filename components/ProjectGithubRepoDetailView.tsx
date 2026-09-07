'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  GitBranch,
  GitCommit,
  GitPullRequest,
  CircleDot,
  Code2,
  Folder,
  FileText,
  Copy,
  ExternalLink,
  Star,
  GitFork,
  Eye,
  Lock,
  Globe,
  RefreshCw,
  X,
  Check,
  ChevronRight,
  Calendar,
  User,
  Shield,
  FileCode,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { toast } from 'sonner';
import { ProjectRepositoryRecord, GithubIcon } from './ProjectGithubView';

interface ProjectGithubRepoDetailViewProps {
  repo: ProjectRepositoryRecord;
  projectId: number | string;
  onBack: () => void;
}

type TabType = 'code' | 'commits' | 'branches' | 'pulls' | 'issues';

interface FileTreeItem {
  name: string;
  path: string;
  type: 'file' | 'dir' | 'submodule' | 'symlink';
  size: number;
  htmlUrl: string;
  sha: string;
}

interface CommitItem {
  sha: string;
  shortSha: string;
  message: string;
  author: {
    name: string;
    email?: string;
    date: string;
    avatarUrl: string;
    login?: string;
  };
  htmlUrl: string;
}

interface DetailedCommit {
  sha: string;
  shortSha: string;
  message: string;
  author: {
    name: string;
    date: string;
    avatarUrl: string;
    login?: string;
  };
  stats?: {
    total: number;
    additions: number;
    deletions: number;
  };
  files: Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    changes: number;
    patch?: string;
  }>;
  htmlUrl: string;
}

export function ProjectGithubRepoDetailView({
  repo,
  projectId,
  onBack,
}: ProjectGithubRepoDetailViewProps) {
  // Parsing owner and repo from fullName (e.g. 'owner/repo')
  const [owner, repoName] = useMemo(() => {
    if (repo.fullName && repo.fullName.includes('/')) {
      const parts = repo.fullName.split('/');
      return [parts[0], parts[1]];
    }
    return [repo.owner?.login || '', repo.name];
  }, [repo]);

  const [activeTab, setActiveTab] = useState<TabType>('code');
  const [selectedBranch, setSelectedBranch] = useState<string>(repo.defaultBranch || 'main');
  const [branches, setBranches] = useState<Array<{ name: string; protected?: boolean; sha?: string }>>([]);

  // Repository overview data
  const [repoDetails, setRepoDetails] = useState<any>(null);
  const [readmeContent, setReadmeContent] = useState<string | null>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState<boolean>(true);

  // Code Tab: Directory & File navigation
  const [currentPath, setCurrentPath] = useState<string>('');
  const [directoryItems, setDirectoryItems] = useState<FileTreeItem[]>([]);
  const [activeFile, setActiveFile] = useState<{ name: string; path: string; size: number; content: string } | null>(null);
  const [isLoadingContents, setIsLoadingContents] = useState<boolean>(false);

  // Commits Tab
  const [commits, setCommits] = useState<CommitItem[]>([]);
  const [isLoadingCommits, setIsLoadingCommits] = useState<boolean>(false);
  const [selectedCommit, setSelectedCommit] = useState<DetailedCommit | null>(null);
  const [isLoadingCommitDetail, setIsLoadingCommitDetail] = useState<boolean>(false);

  // Branches Tab
  const [isLoadingBranches, setIsLoadingBranches] = useState<boolean>(false);

  // Pull Requests Tab
  const [pullRequests, setPullRequests] = useState<any[]>([]);
  const [isLoadingPulls, setIsLoadingPulls] = useState<boolean>(false);
  const [pullFilter, setPullFilter] = useState<'open' | 'closed' | 'all'>('open');

  // Issues Tab
  const [issues, setIssues] = useState<any[]>([]);
  const [isLoadingIssues, setIsLoadingIssues] = useState<boolean>(false);
  const [issueFilter, setIssueFilter] = useState<'open' | 'closed' | 'all'>('open');

  const [cloneMode, setCloneMode] = useState<'https' | 'ssh'>('https');

  const getToken = () => {
    return typeof window !== 'undefined' ? localStorage.getItem('teader_github_token') || '' : '';
  };

  // Initial fetch on mount or branch change
  useEffect(() => {
    fetchOverview();
  }, [owner, repoName]);

  useEffect(() => {
    if (activeTab === 'code') {
      fetchContents(currentPath, selectedBranch);
    } else if (activeTab === 'commits') {
      fetchCommits(selectedBranch);
    } else if (activeTab === 'branches') {
      fetchBranches();
    } else if (activeTab === 'pulls') {
      fetchPulls(pullFilter);
    } else if (activeTab === 'issues') {
      fetchIssues(issueFilter);
    }
  }, [activeTab, selectedBranch]);

  // Fetch overview (repo metadata, readme, branches)
  const fetchOverview = async () => {
    setIsLoadingOverview(true);
    try {
      const res = await fetch(
        `/api/github/repo?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repoName)}&action=overview&ref=${encodeURIComponent(selectedBranch)}`,
        { headers: { 'x-github-token': getToken() } }
      );
      if (res.ok) {
        const data = await res.json();
        setRepoDetails(data.repository || null);
        setReadmeContent(data.readme || null);
        if (data.branches && data.branches.length > 0) {
          setBranches(data.branches);
          if (!data.branches.some((b: any) => b.name === selectedBranch)) {
            setSelectedBranch(data.repository?.defaultBranch || data.branches[0].name);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load repo overview:', err);
    } finally {
      setIsLoadingOverview(false);
    }
  };

  // Fetch directory or file contents
  const fetchContents = async (path: string = '', refBranch: string = selectedBranch) => {
    setIsLoadingContents(true);
    try {
      const res = await fetch(
        `/api/github/repo?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repoName)}&action=contents&path=${encodeURIComponent(path)}&ref=${encodeURIComponent(refBranch)}`,
        { headers: { 'x-github-token': getToken() } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.type === 'dir') {
          setDirectoryItems(data.items || []);
          setActiveFile(null);
          setCurrentPath(path);
        } else if (data.type === 'file') {
          setActiveFile({
            name: data.name,
            path: data.path,
            size: data.size,
            content: data.content,
          });
        }
      } else {
        toast.error('Failed to load repository contents');
      }
    } catch (err) {
      console.error('Failed to fetch contents:', err);
      toast.error('Error fetching file contents');
    } finally {
      setIsLoadingContents(false);
    }
  };

  // Fetch commits
  const fetchCommits = async (refBranch: string = selectedBranch) => {
    setIsLoadingCommits(true);
    try {
      const res = await fetch(
        `/api/github/repo?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repoName)}&action=commits&sha=${encodeURIComponent(refBranch)}&per_page=50`,
        { headers: { 'x-github-token': getToken() } }
      );
      if (res.ok) {
        const data = await res.json();
        setCommits(data.commits || []);
      } else {
        toast.error('Failed to load commits');
      }
    } catch (err) {
      console.error('Error fetching commits:', err);
    } finally {
      setIsLoadingCommits(false);
    }
  };

  // Fetch single commit details (with diff patches)
  const fetchCommitDetail = async (commitSha: string) => {
    setIsLoadingCommitDetail(true);
    try {
      const res = await fetch(
        `/api/github/repo?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repoName)}&action=commit&ref=${encodeURIComponent(commitSha)}`,
        { headers: { 'x-github-token': getToken() } }
      );
      if (res.ok) {
        const data = await res.json();
        setSelectedCommit(data.commit);
      } else {
        toast.error('Failed to load commit changes');
      }
    } catch (err) {
      console.error('Error fetching commit diff:', err);
      toast.error('Network error loading commit diff');
    } finally {
      setIsLoadingCommitDetail(false);
    }
  };

  // Fetch branches
  const fetchBranches = async () => {
    setIsLoadingBranches(true);
    try {
      const res = await fetch(
        `/api/github/repo?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repoName)}&action=branches`,
        { headers: { 'x-github-token': getToken() } }
      );
      if (res.ok) {
        const data = await res.json();
        setBranches(data.branches || []);
      }
    } catch (err) {
      console.error('Error fetching branches:', err);
    } finally {
      setIsLoadingBranches(false);
    }
  };

  // Fetch pull requests
  const fetchPulls = async (stateFilter: 'open' | 'closed' | 'all' = pullFilter) => {
    setIsLoadingPulls(true);
    try {
      const res = await fetch(
        `/api/github/repo?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repoName)}&action=pulls&state=${stateFilter}`,
        { headers: { 'x-github-token': getToken() } }
      );
      if (res.ok) {
        const data = await res.json();
        setPullRequests(data.pullRequests || []);
      }
    } catch (err) {
      console.error('Error fetching PRs:', err);
    } finally {
      setIsLoadingPulls(false);
    }
  };

  // Fetch issues
  const fetchIssues = async (stateFilter: 'open' | 'closed' | 'all' = issueFilter) => {
    setIsLoadingIssues(true);
    try {
      const res = await fetch(
        `/api/github/repo?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repoName)}&action=issues&state=${stateFilter}`,
        { headers: { 'x-github-token': getToken() } }
      );
      if (res.ok) {
        const data = await res.json();
        setIssues(data.issues || []);
      }
    } catch (err) {
      console.error('Error fetching issues:', err);
    } finally {
      setIsLoadingIssues(false);
    }
  };

  // Navigate up in directory breadcrumb
  const navigateBreadcrumb = (index: number) => {
    if (index === -1) {
      fetchContents('', selectedBranch);
      return;
    }
    const parts = currentPath.split('/').filter(Boolean);
    const targetPath = parts.slice(0, index + 1).join('/');
    fetchContents(targetPath, selectedBranch);
  };

  // Copy clone command
  const handleCopyCloneCommand = () => {
    const url =
      cloneMode === 'https'
        ? repoDetails?.cloneUrl || repo.htmlUrl + '.git'
        : repoDetails?.sshUrl || `git@github.com:${owner}/${repoName}.git`;
    navigator.clipboard.writeText(`git clone ${url}`);
    toast.success(`Copied git clone (${cloneMode.toUpperCase()}) command!`);
  };

  // Format relative time (e.g. '2 hours ago')
  const formatTimeAgo = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSec < 60) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 30) return `${diffDay}d ago`;
    return date.toLocaleDateString();
  };

  // Format bytes
  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const pathSegments = useMemo(() => {
    return currentPath ? currentPath.split('/').filter(Boolean) : [];
  }, [currentPath]);

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-[#0D0E11] text-[#CFD4DD] overflow-hidden select-none">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* HEADER BAR: Back Button + Repo Identity + Actions             */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="h-14 border-b border-[#2A2C30] bg-[#141518] px-6 flex items-center justify-between gap-4 shrink-0">
        {/* Left: Back button + Repo Name */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#787C83] hover:text-[#CFD4DD] hover:bg-[#2A2C30] transition-colors cursor-pointer shrink-0"
            title="Back to Repositories"
          >
            <ArrowLeft size={14} />
            <span>Repos</span>
          </button>

          <div className="h-4 w-px bg-[#2A2C30] shrink-0" />

          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white shrink-0">
              <GithubIcon size={16} />
            </div>

            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-sm font-bold text-white tracking-tight truncate flex items-center gap-1.5">
                <span className="text-[#787C83] font-normal">{owner}/</span>
                <span>{repoName}</span>
              </h2>

              <span
                className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0 ${
                  repo.isPrivate || repoDetails?.isPrivate
                    ? 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20'
                    : 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20'
                }`}
              >
                {repo.isPrivate || repoDetails?.isPrivate ? <Lock size={9} /> : <Globe size={9} />}
                <span>{repo.isPrivate || repoDetails?.isPrivate ? 'Private' : 'Public'}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right: Branch Selector, Clone, External Link */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Branch Switcher */}
          {branches.length > 0 && (
            <div className="flex items-center gap-1.5 bg-[#1B1C20] border border-[#2A2C30] px-2.5 py-1 rounded-xl text-xs">
              <GitBranch size={13} className="text-[#DCB001]" />
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="bg-transparent text-white text-xs font-semibold focus:outline-none cursor-pointer pr-1"
              >
                {branches.map((b) => (
                  <option key={b.name} value={b.name} className="bg-[#141518] text-white">
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Clone Command Copy */}
          <div className="flex items-center bg-[#1B1C20] border border-[#2A2C30] rounded-xl overflow-hidden p-0.5 text-xs">
            <button
              onClick={() => setCloneMode('https')}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer ${
                cloneMode === 'https' ? 'bg-[#2A2C30] text-white' : 'text-[#787C83] hover:text-[#CFD4DD]'
              }`}
            >
              HTTPS
            </button>
            <button
              onClick={() => setCloneMode('ssh')}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer ${
                cloneMode === 'ssh' ? 'bg-[#2A2C30] text-white' : 'text-[#787C83] hover:text-[#CFD4DD]'
              }`}
            >
              SSH
            </button>
            <button
              onClick={handleCopyCloneCommand}
              className="px-2 py-1 text-xs text-[#DCB001] hover:text-white flex items-center gap-1 transition-colors cursor-pointer ml-1"
              title="Copy git clone command"
            >
              <Copy size={12} />
              <span className="text-[11px] font-medium">Clone</span>
            </button>
          </div>

          {/* Open on GitHub.com */}
          <a
            href={repo.htmlUrl || `https://github.com/${owner}/${repoName}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#222428] hover:bg-[#2A2C30] text-xs font-semibold text-white rounded-xl transition-all cursor-pointer border border-[#2A2C30]"
          >
            <span>GitHub</span>
            <ExternalLink size={11} />
          </a>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* STATS & METADATA BAR                                          */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="px-6 py-2 border-b border-[#2A2C30] bg-[#141518]/50 flex items-center justify-between gap-4 text-xs text-[#787C83] shrink-0">
        <div className="flex items-center gap-4 flex-wrap">
          {repoDetails?.language && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#DCB001]" />
              <span className="text-white font-medium">{repoDetails.language}</span>
            </div>
          )}

          <div className="flex items-center gap-1">
            <Star size={12} className="text-[#DCB001]" />
            <span className="text-[#CFD4DD] font-medium">{repoDetails?.starsCount || repo.starsCount || 0}</span>
            <span>stars</span>
          </div>

          <div className="flex items-center gap-1">
            <GitFork size={12} />
            <span className="text-[#CFD4DD] font-medium">{repoDetails?.forksCount || repo.forksCount || 0}</span>
            <span>forks</span>
          </div>

          <div className="flex items-center gap-1">
            <CircleDot size={12} />
            <span className="text-[#CFD4DD] font-medium">{repoDetails?.openIssuesCount || repo.openIssuesCount || 0}</span>
            <span>issues</span>
          </div>

          {repoDetails?.license && (
            <div className="flex items-center gap-1">
              <Shield size={12} />
              <span>{repoDetails.license}</span>
            </div>
          )}
        </div>

        {repoDetails?.updatedAt && (
          <div className="text-[11px] text-[#787C83]">
            Updated {formatTimeAgo(repoDetails.updatedAt)}
          </div>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* SUB-TABS NAVIGATION: Code | Commits | Branches | PRs | Issues */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="h-12 border-b border-[#2A2C30] bg-[#141518] px-6 flex items-center gap-2 shrink-0">
        {[
          { id: 'code', label: 'Code', icon: Code2 },
          { id: 'commits', label: 'Commits', icon: GitCommit },
          { id: 'branches', label: 'Branches', icon: GitBranch, count: branches.length },
          { id: 'pulls', label: 'Pull Requests', icon: GitPullRequest },
          { id: 'issues', label: 'Issues', icon: CircleDot, count: repoDetails?.openIssuesCount },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#2A2C30] text-[#DCB001] shadow-sm'
                  : 'text-[#787C83] hover:text-[#CFD4DD] hover:bg-[#1B1C20]'
              }`}
            >
              <Icon size={13} />
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && tab.count > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#1B1C20] text-[#CFD4DD] font-mono">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MAIN VIEW CONTENT ACCORDING TO ACTIVE SUB-TAB                 */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0 p-6 custom-scrollbar">
        {/* ============================================================= */}
        {/* TAB 1: CODE (FILE EXPLORER & README)                          */}
        {/* ============================================================= */}
        {activeTab === 'code' && (
          <div className="space-y-6 max-w-6xl mx-auto">
            {/* Breadcrumb Path Bar */}
            <div className="flex items-center gap-1 text-xs text-[#787C83] bg-[#141518] border border-[#2A2C30] rounded-xl px-4 py-2.5 overflow-x-auto">
              <button
                onClick={() => navigateBreadcrumb(-1)}
                className="font-bold text-white hover:text-[#DCB001] transition-colors cursor-pointer"
              >
                {repoName}
              </button>

              {pathSegments.map((segment, idx) => (
                <React.Fragment key={idx}>
                  <ChevronRight size={12} className="text-[#787C83] shrink-0" />
                  <button
                    onClick={() => navigateBreadcrumb(idx)}
                    className={`font-medium hover:text-[#DCB001] transition-colors cursor-pointer ${
                      idx === pathSegments.length - 1 ? 'text-[#DCB001]' : 'text-white'
                    }`}
                  >
                    {segment}
                  </button>
                </React.Fragment>
              ))}

              {isLoadingContents && (
                <RefreshCw size={12} className="animate-spin text-[#DCB001] ml-auto shrink-0" />
              )}
            </div>

            {/* If a file is selected: Display File Viewer */}
            {activeFile ? (
              <div className="bg-[#141518] border border-[#2A2C30] rounded-2xl overflow-hidden shadow-lg">
                {/* File Header */}
                <div className="h-11 px-4 border-b border-[#2A2C30] bg-[#18191E] flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-white">
                    <FileCode size={14} className="text-[#DCB001]" />
                    <span>{activeFile.name}</span>
                    <span className="text-[11px] text-[#787C83] font-mono font-normal">
                      ({formatBytes(activeFile.size)})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(activeFile.content);
                        toast.success('Copied file contents to clipboard!');
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#222428] hover:bg-[#2A2C30] text-[11px] text-[#CFD4DD] rounded-lg transition-colors cursor-pointer"
                    >
                      <Copy size={11} />
                      <span>Copy</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveFile(null);
                        // Back to parent directory
                        const parent = activeFile.path.split('/').slice(0, -1).join('/');
                        fetchContents(parent, selectedBranch);
                      }}
                      className="p-1 text-[#787C83] hover:text-white rounded-lg hover:bg-[#2A2C30] transition-colors cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>

                {/* File Lines */}
                <div className="p-4 font-mono text-xs text-[#CFD4DD] bg-[#0E0F12] overflow-x-auto max-h-[600px] leading-relaxed">
                  {activeFile.content.split('\n').map((line, lineIdx) => (
                    <div key={lineIdx} className="flex hover:bg-[#1A1C22]">
                      <span className="w-12 text-right pr-4 select-none text-[#525761] shrink-0 text-[11px]">
                        {lineIdx + 1}
                      </span>
                      <pre className="flex-1 whitespace-pre font-mono">{line || ' '}</pre>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Directory Items List */
              <div className="bg-[#141518] border border-[#2A2C30] rounded-2xl overflow-hidden shadow-lg">
                <div className="h-10 px-4 border-b border-[#2A2C30] bg-[#18191E] flex items-center justify-between text-xs text-[#787C83] font-semibold">
                  <span>Name</span>
                  <span>Branch: {selectedBranch}</span>
                </div>

                {isLoadingContents ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-2 text-xs text-[#787C83]">
                    <RefreshCw size={20} className="animate-spin text-[#DCB001]" />
                    <span>Loading repository contents...</span>
                  </div>
                ) : directoryItems.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#787C83]">
                    This folder is empty.
                  </div>
                ) : (
                  <div className="divide-y divide-[#202227]">
                    {/* Go back row if inside subdirectory */}
                    {currentPath && (
                      <div
                        onClick={() => {
                          const parent = currentPath.split('/').slice(0, -1).join('/');
                          fetchContents(parent, selectedBranch);
                        }}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#1B1C20] cursor-pointer text-xs text-[#787C83] transition-colors"
                      >
                        <Folder size={15} className="text-[#787C83]" />
                        <span>..</span>
                      </div>
                    )}

                    {directoryItems.map((item) => (
                      <div
                        key={item.path}
                        onClick={() => {
                          if (item.type === 'dir') {
                            fetchContents(item.path, selectedBranch);
                          } else {
                            fetchContents(item.path, selectedBranch);
                          }
                        }}
                        className="flex items-center justify-between px-4 py-2.5 hover:bg-[#1B1C20] cursor-pointer text-xs transition-colors group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {item.type === 'dir' ? (
                            <Folder size={15} className="text-[#DCB001] shrink-0" />
                          ) : (
                            <FileText size={15} className="text-[#787C83] group-hover:text-white shrink-0" />
                          )}
                          <span className="text-[#CFD4DD] group-hover:text-white font-medium truncate">
                            {item.name}
                          </span>
                        </div>

                        {item.type === 'file' && (
                          <span className="text-[11px] text-[#787C83] font-mono shrink-0">
                            {formatBytes(item.size)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Formatted README Viewer if at root path */}
            {!currentPath && readmeContent && (
              <div className="bg-[#141518] border border-[#2A2C30] rounded-2xl overflow-hidden shadow-lg">
                <div className="h-11 px-4 border-b border-[#2A2C30] bg-[#18191E] flex items-center gap-2 text-xs font-bold text-white">
                  <FileText size={14} className="text-[#DCB001]" />
                  <span>README.md</span>
                </div>
                <div className="p-6 text-xs text-[#CFD4DD] space-y-4 leading-relaxed whitespace-pre-wrap font-sans bg-[#0E0F12]">
                  {readmeContent}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================= */}
        {/* TAB 2: COMMITS (HISTORY & COMMIT DIFF VIEWER)                 */}
        {/* ============================================================= */}
        {activeTab === 'commits' && (
          <div className="space-y-4 max-w-4xl mx-auto">
            <div className="flex items-center justify-between text-xs text-[#787C83] mb-2">
              <span>Commits on <strong className="text-white">{selectedBranch}</strong> ({commits.length})</span>
              <button
                onClick={() => fetchCommits(selectedBranch)}
                className="p-1 hover:text-white cursor-pointer"
                title="Refresh commits"
              >
                <RefreshCw size={12} className={isLoadingCommits ? 'animate-spin text-[#DCB001]' : ''} />
              </button>
            </div>

            {isLoadingCommits ? (
              <div className="flex flex-col items-center justify-center h-48 gap-2 text-xs text-[#787C83]">
                <RefreshCw size={20} className="animate-spin text-[#DCB001]" />
                <span>Loading commit history...</span>
              </div>
            ) : commits.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#787C83] bg-[#141518] border border-[#2A2C30] rounded-2xl">
                No commits found on branch {selectedBranch}.
              </div>
            ) : (
              <div className="bg-[#141518] border border-[#2A2C30] rounded-2xl overflow-hidden shadow-lg divide-y divide-[#202227]">
                {commits.map((commit) => (
                  <div
                    key={commit.sha}
                    onClick={() => fetchCommitDetail(commit.sha)}
                    className="p-4 hover:bg-[#18191E] cursor-pointer transition-colors flex items-start justify-between gap-4 group"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      {commit.author?.avatarUrl ? (
                        <img
                          src={commit.author.avatarUrl}
                          alt={commit.author.name}
                          className="w-7 h-7 rounded-full object-cover border border-[#2A2C30] shrink-0 mt-0.5"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-[#2A2C30] flex items-center justify-center text-[#787C83] shrink-0 mt-0.5">
                          <User size={13} />
                        </div>
                      )}

                      <div className="min-w-0">
                        <h4 className="text-xs font-semibold text-white group-hover:text-[#DCB001] transition-colors line-clamp-1 mb-1">
                          {commit.message}
                        </h4>

                        <div className="flex items-center gap-2 text-[11px] text-[#787C83]">
                          <span className="text-[#CFD4DD] font-medium">{commit.author?.name}</span>
                          <span>committed {formatTimeAgo(commit.author?.date)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2 py-0.5 rounded-md bg-[#222428] text-[#DCB001] font-mono text-[11px] font-semibold">
                        {commit.shortSha}
                      </span>
                      <ChevronRight size={14} className="text-[#787C83] group-hover:text-white transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================================= */}
        {/* TAB 3: BRANCHES                                               */}
        {/* ============================================================= */}
        {activeTab === 'branches' && (
          <div className="space-y-4 max-w-3xl mx-auto">
            <div className="flex items-center justify-between text-xs text-[#787C83] mb-2">
              <span>Branches ({branches.length})</span>
              <button
                onClick={fetchBranches}
                className="p-1 hover:text-white cursor-pointer"
                title="Refresh branches"
              >
                <RefreshCw size={12} className={isLoadingBranches ? 'animate-spin text-[#DCB001]' : ''} />
              </button>
            </div>

            <div className="bg-[#141518] border border-[#2A2C30] rounded-2xl overflow-hidden shadow-lg divide-y divide-[#202227]">
              {branches.map((b) => {
                const isDefault = b.name === (repoDetails?.defaultBranch || repo.defaultBranch || 'main');
                const isSelected = b.name === selectedBranch;
                return (
                  <div
                    key={b.name}
                    className="p-4 flex items-center justify-between gap-4 hover:bg-[#18191E] transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <GitBranch size={15} className={isSelected ? 'text-[#DCB001]' : 'text-[#787C83]'} />
                      <span className="text-xs font-semibold text-white font-mono truncate">{b.name}</span>
                      {isDefault && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#DCB001]/10 text-[#DCB001] border border-[#DCB001]/30 font-medium">
                          default
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {b.sha && (
                        <span className="text-[11px] text-[#787C83] font-mono">
                          {b.sha.substring(0, 7)}
                        </span>
                      )}
                      <button
                        onClick={() => {
                          setSelectedBranch(b.name);
                          setActiveTab('code');
                          toast.success(`Switched active branch to ${b.name}`);
                        }}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#DCB001] text-black'
                            : 'bg-[#222428] hover:bg-[#2A2C30] text-[#CFD4DD]'
                        }`}
                      >
                        {isSelected ? 'Active' : 'Switch'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* TAB 4: PULL REQUESTS                                          */}
        {/* ============================================================= */}
        {activeTab === 'pulls' && (
          <div className="space-y-4 max-w-4xl mx-auto">
            {/* Filter Pills */}
            <div className="flex items-center justify-between text-xs text-[#787C83] mb-2">
              <div className="flex items-center bg-[#141518] p-0.5 rounded-xl border border-[#2A2C30]">
                {(['open', 'closed', 'all'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => {
                      setPullFilter(filter);
                      fetchPulls(filter);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer capitalize ${
                      pullFilter === filter ? 'bg-[#2A2C30] text-white' : 'text-[#787C83] hover:text-[#CFD4DD]'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              <button onClick={() => fetchPulls(pullFilter)} className="p-1 hover:text-white cursor-pointer">
                <RefreshCw size={12} className={isLoadingPulls ? 'animate-spin text-[#DCB001]' : ''} />
              </button>
            </div>

            {isLoadingPulls ? (
              <div className="flex flex-col items-center justify-center h-48 gap-2 text-xs text-[#787C83]">
                <RefreshCw size={20} className="animate-spin text-[#DCB001]" />
                <span>Loading pull requests...</span>
              </div>
            ) : pullRequests.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#787C83] bg-[#141518] border border-[#2A2C30] rounded-2xl">
                No {pullFilter} pull requests found.
              </div>
            ) : (
              <div className="bg-[#141518] border border-[#2A2C30] rounded-2xl overflow-hidden shadow-lg divide-y divide-[#202227]">
                {pullRequests.map((pr) => (
                  <a
                    key={pr.id}
                    href={pr.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-4 hover:bg-[#18191E] transition-colors flex items-start justify-between gap-4 block group"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <GitPullRequest
                        size={16}
                        className={`mt-0.5 shrink-0 ${
                          pr.merged
                            ? 'text-[#A855F7]'
                            : pr.state === 'open'
                            ? 'text-[#22C55E]'
                            : 'text-[#EF4444]'
                        }`}
                      />

                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-white group-hover:text-[#DCB001] transition-colors line-clamp-1 mb-1">
                          {pr.title} <span className="text-[#787C83] font-normal font-mono">#{pr.number}</span>
                        </h4>

                        <p className="text-[11px] text-[#787C83]">
                          opened by {pr.user?.login} • {formatTimeAgo(pr.createdAt)}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium border shrink-0 ${
                        pr.merged
                          ? 'bg-[#A855F7]/10 text-[#A855F7] border-[#A855F7]/30'
                          : pr.state === 'open'
                          ? 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/30'
                          : 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30'
                      }`}
                    >
                      {pr.merged ? 'Merged' : pr.state === 'open' ? 'Open' : 'Closed'}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================================= */}
        {/* TAB 5: ISSUES                                                 */}
        {/* ============================================================= */}
        {activeTab === 'issues' && (
          <div className="space-y-4 max-w-4xl mx-auto">
            {/* Filter Pills */}
            <div className="flex items-center justify-between text-xs text-[#787C83] mb-2">
              <div className="flex items-center bg-[#141518] p-0.5 rounded-xl border border-[#2A2C30]">
                {(['open', 'closed', 'all'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => {
                      setIssueFilter(filter);
                      fetchIssues(filter);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer capitalize ${
                      issueFilter === filter ? 'bg-[#2A2C30] text-white' : 'text-[#787C83] hover:text-[#CFD4DD]'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              <button onClick={() => fetchIssues(issueFilter)} className="p-1 hover:text-white cursor-pointer">
                <RefreshCw size={12} className={isLoadingIssues ? 'animate-spin text-[#DCB001]' : ''} />
              </button>
            </div>

            {isLoadingIssues ? (
              <div className="flex flex-col items-center justify-center h-48 gap-2 text-xs text-[#787C83]">
                <RefreshCw size={20} className="animate-spin text-[#DCB001]" />
                <span>Loading issues...</span>
              </div>
            ) : issues.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#787C83] bg-[#141518] border border-[#2A2C30] rounded-2xl">
                No {issueFilter} issues found.
              </div>
            ) : (
              <div className="bg-[#141518] border border-[#2A2C30] rounded-2xl overflow-hidden shadow-lg divide-y divide-[#202227]">
                {issues.map((issue) => (
                  <a
                    key={issue.id}
                    href={issue.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-4 hover:bg-[#18191E] transition-colors flex items-start justify-between gap-4 block group"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <CircleDot
                        size={16}
                        className={`mt-0.5 shrink-0 ${
                          issue.state === 'open' ? 'text-[#22C55E]' : 'text-[#8957E5]'
                        }`}
                      />

                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-white group-hover:text-[#DCB001] transition-colors line-clamp-1 mb-1">
                          {issue.title} <span className="text-[#787C83] font-normal font-mono">#{issue.number}</span>
                        </h4>

                        <p className="text-[11px] text-[#787C83]">
                          opened by {issue.user?.login} • {formatTimeAgo(issue.createdAt)}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium border shrink-0 ${
                        issue.state === 'open'
                          ? 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/30'
                          : 'bg-[#8957E5]/10 text-[#8957E5] border-[#8957E5]/30'
                      }`}
                    >
                      {issue.state === 'open' ? 'Open' : 'Closed'}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* COMMIT DIFF VIEWER MODAL                                      */}
      {/* ───────────────────────────────────────────────────────────── */}
      {selectedCommit && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="max-w-4xl w-full bg-[#141518] border border-[#2A2C30] rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-left">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#2A2C30] bg-[#18191E] flex items-start justify-between gap-4 shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded bg-[#DCB001]/10 text-[#DCB001] font-mono text-[11px] font-bold border border-[#DCB001]/30">
                    {selectedCommit.shortSha}
                  </span>
                  <span className="text-xs text-[#787C83]">
                    by <strong className="text-white">{selectedCommit.author?.name}</strong> • {formatTimeAgo(selectedCommit.author?.date)}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-white tracking-tight leading-snug">
                  {selectedCommit.message}
                </h3>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {selectedCommit.stats && (
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-[#22C55E]">+{selectedCommit.stats.additions}</span>
                    <span className="text-[#EF4444]">-{selectedCommit.stats.deletions}</span>
                  </div>
                )}

                <button
                  onClick={() => setSelectedCommit(null)}
                  className="text-[#787C83] hover:text-white p-1 rounded-lg hover:bg-[#2A2C30] transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Changed Files & Diffs */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[#0E0F12]">
              {selectedCommit.files.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#787C83]">
                  No changed files in this commit.
                </div>
              ) : (
                selectedCommit.files.map((file, fileIdx) => (
                  <div
                    key={fileIdx}
                    className="border border-[#2A2C30] rounded-xl overflow-hidden bg-[#141518] shadow-md"
                  >
                    {/* File bar */}
                    <div className="px-4 py-2.5 bg-[#18191E] border-b border-[#2A2C30] flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase ${
                            file.status === 'added'
                              ? 'bg-[#22C55E]/10 text-[#22C55E]'
                              : file.status === 'removed'
                              ? 'bg-[#EF4444]/10 text-[#EF4444]'
                              : 'bg-[#38BDF8]/10 text-[#38BDF8]'
                          }`}
                        >
                          {file.status}
                        </span>
                        <span className="text-white font-semibold truncate">{file.filename}</span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] shrink-0">
                        <span className="text-[#22C55E]">+{file.additions}</span>
                        <span className="text-[#EF4444]">-{file.deletions}</span>
                      </div>
                    </div>

                    {/* Diff Patch Viewer */}
                    {file.patch ? (
                      <div className="font-mono text-[11px] leading-relaxed overflow-x-auto p-2 bg-[#0A0B0D]">
                        {file.patch.split('\n').map((diffLine, lineIndex) => {
                          let lineStyle = 'text-[#CFD4DD]';
                          let bgStyle = '';

                          if (diffLine.startsWith('+') && !diffLine.startsWith('+++')) {
                            lineStyle = 'text-[#4ADE80]';
                            bgStyle = 'bg-[#22C55E]/10';
                          } else if (diffLine.startsWith('-') && !diffLine.startsWith('---')) {
                            lineStyle = 'text-[#F87171]';
                            bgStyle = 'bg-[#EF4444]/10';
                          } else if (diffLine.startsWith('@@')) {
                            lineStyle = 'text-[#38BDF8]';
                            bgStyle = 'bg-[#38BDF8]/10 font-bold';
                          }

                          return (
                            <div key={lineIndex} className={`px-3 py-0.5 rounded-xs ${bgStyle} ${lineStyle}`}>
                              <pre className="whitespace-pre font-mono">{diffLine || ' '}</pre>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-4 text-xs text-[#787C83] text-center">
                        Binary file or diff not displayed.
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
