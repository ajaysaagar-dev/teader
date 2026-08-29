'use client';

import React, { useState, useMemo } from 'react';
import { Issue, Status, Priority } from '@/lib/types';
import { Avatar } from '@/components/ui/Avatar';
import { 
  Terminal, 
  GitBranch, 
  GitCommit, 
  CheckSquare, 
  Copy, 
  Check, 
  Search, 
  X, 
  Play, 
  CheckCircle2, 
  Eye, 
  RotateCcw, 
  Plus, 
  Code2, 
  Flame, 
  Clock, 
  User, 
  ExternalLink,
  Camera,
  Image as ImageIcon,
  Sparkles,
  ChevronRight,
  Filter,
  Folder,
  FolderOpen
} from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

interface DevStreamViewProps {
  issues: Issue[];
  onSelectIssue: (id: string) => void;
  onUpdateIssueStatus: (issueId: string, newStatus: Status) => void;
  onOpenNewIssue: () => void;
  currentUser?: any;
}

type DevFilter = 'all' | 'my_tasks' | 'in_progress' | 'needs_review' | 'critical';

export const DevStreamView: React.FC<DevStreamViewProps> = React.memo(({
  issues,
  onSelectIssue,
  onUpdateIssueStatus,
  onOpenNewIssue,
  currentUser,
}) => {
  const [activeFilter, setActiveFilter] = useState<DevFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(
    issues.length > 0 ? issues[0].id : null
  );
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  // Filter issues
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      const issueAny = issue as any;
      const assigneeName = issue.assignee?.name || issueAny.assigneeName || '';

      const matchesFilter =
        activeFilter === 'all' ||
        (activeFilter === 'my_tasks' && currentUser && assigneeName.toLowerCase().includes(currentUser.name?.toLowerCase() || '')) ||
        (activeFilter === 'in_progress' && issue.status === 'in_progress') ||
        (activeFilter === 'needs_review' && issue.status === 'needs_review') ||
        (activeFilter === 'critical' && (issue.priority === 'critical' || issue.priority === 'high'));

      const matchesSearch =
        searchQuery === '' ||
        issue.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        issue.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (issue.labels || []).some((l) => l.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (issue.subtasks || []).some((st) => st.title.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesFilter && matchesSearch;
    });
  }, [issues, activeFilter, searchQuery, currentUser]);

  // Keep selected issue synced
  const activeIssue = useMemo(() => {
    if (!selectedIssueId && filteredIssues.length > 0) {
      return filteredIssues[0];
    }
    return issues.find((i) => i.id === selectedIssueId) || filteredIssues[0] || null;
  }, [issues, filteredIssues, selectedIssueId]);

  // Helper for Git Branch Name
  const getBranchName = (issue: Issue) => {
    const slug = issue.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 35);
    return `feature/${issue.key.toLowerCase()}-${slug}`;
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(label);
    toast.success(`Copied: ${text}`);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  return (
    <div className="flex-1 h-full min-h-0 w-full overflow-hidden bg-[#131415] p-3 flex flex-col space-y-2.5 select-none font-sans text-xs">
      {/* Dev Stream Top Control Bar */}
      <div className="flex items-center justify-between gap-2 bg-[#1B1C1F] px-3 py-1.5 rounded-lg border border-[#2A2C30] shrink-0">
        {/* Quick Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
              activeFilter === 'all'
                ? 'bg-[#2A2C30] text-[#DCB001] shadow-sm'
                : 'text-[#787C83] hover:text-[#CFD4DD]'
            }`}
          >
            All Dev Stream ({issues.length})
          </button>

          <button
            onClick={() => setActiveFilter('in_progress')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-all ${
              activeFilter === 'in_progress'
                ? 'bg-[#DCB001]/15 text-[#DCB001] border border-[#DCB001]/30 shadow-sm'
                : 'text-[#787C83] hover:text-[#CFD4DD]'
            }`}
          >
            <Play size={11} />
            <span>Active Coding ({issues.filter((i) => i.status === 'in_progress').length})</span>
          </button>

          <button
            onClick={() => setActiveFilter('needs_review')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-all ${
              activeFilter === 'needs_review'
                ? 'bg-[#3B82F6]/15 text-[#3B82F6] border border-[#3B82F6]/30 shadow-sm'
                : 'text-[#787C83] hover:text-[#CFD4DD]'
            }`}
          >
            <Eye size={11} />
            <span>Review / PR ({issues.filter((i) => i.status === 'needs_review').length})</span>
          </button>

          <button
            onClick={() => setActiveFilter('critical')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-all ${
              activeFilter === 'critical'
                ? 'bg-[#C0393B]/15 text-[#C0393B] border border-[#C0393B]/30 shadow-sm'
                : 'text-[#787C83] hover:text-[#CFD4DD]'
            }`}
          >
            <Flame size={11} />
            <span>P0 / Blockers ({issues.filter((i) => i.priority === 'critical' || i.priority === 'high').length})</span>
          </button>
        </div>

        {/* Right Search Input & New Task */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-[#131415] border border-[#2A2C30] rounded-md px-2.5 py-1 w-44 md:w-56">
            <Search size={12} className="text-[#787C83] shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search code tasks..."
              className="w-full bg-transparent text-xs text-[#CFD4DD] placeholder-[#787C83] outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-[#787C83] hover:text-white">
                <X size={11} />
              </button>
            )}
          </div>

          <button
            onClick={onOpenNewIssue}
            className="flex items-center gap-1 px-2.5 py-1 bg-[#DCB001] hover:bg-[#c49c00] text-[#0F1011] rounded-md text-xs font-bold shadow-sm transition-all shrink-0"
          >
            <Plus size={13} />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Two-Pane Developer Workstation */}
      <div className="flex-1 grid grid-cols-12 gap-2.5 overflow-hidden min-h-0">
        {/* Left Pane: High-Density Task Stream */}
        <div className="col-span-12 md:col-span-5 lg:col-span-4 bg-[#1B1C1F] border border-[#2A2C30] rounded-lg overflow-y-auto divide-y divide-[#2A2C30]/50 flex flex-col">
          <div className="p-2.5 bg-[#17181A] border-b border-[#2A2C30] flex items-center justify-between shrink-0 font-mono text-[11px] text-[#787C83]">
            <span>ENGINEERING STREAM ({filteredIssues.length})</span>
            <span className="text-[10px]">Click to Inspect & Code</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#2A2C30]/40">
            {filteredIssues.length === 0 ? (
              <div className="p-8 text-center text-[#787C83] font-mono text-xs">
                No tasks match current dev filter.
              </div>
            ) : (
              filteredIssues.map((issue) => {
                const isSelected = activeIssue?.id === issue.id;
                const subsCount = issue.subtasks?.length || 0;
                const completedCount = issue.subtasks?.filter((st) => st.completed).length || 0;
                const issueAny = issue as any;
                const assigneeName = issue.assignee?.name || issueAny.assigneeName || 'User';

                return (
                  <div
                    key={issue.id}
                    onClick={() => setSelectedIssueId(issue.id)}
                    className={`p-2.5 cursor-pointer transition-all space-y-1.5 relative ${
                      isSelected
                        ? 'bg-[#131415] border-l-2 border-l-[#DCB001]'
                        : 'hover:bg-[#151618]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[11px] font-bold text-[#DCB001]">
                          {issue.key}
                        </span>
                        <span
                          className={`text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded uppercase ${
                            issue.status === 'done'
                              ? 'bg-[#22C55E]/15 text-[#22C55E]'
                              : issue.status === 'in_progress'
                              ? 'bg-[#DCB001]/15 text-[#DCB001]'
                              : issue.status === 'needs_review'
                              ? 'bg-[#3B82F6]/15 text-[#3B82F6]'
                              : 'bg-[#2A2C30] text-[#787C83]'
                          }`}
                        >
                          {issue.status.replace('_', ' ')}
                        </span>
                      </div>

                      <span
                        className={`text-[9px] font-mono uppercase font-bold ${
                          issue.priority === 'critical'
                            ? 'text-[#C0393B]'
                            : issue.priority === 'high'
                            ? 'text-[#DCB001]'
                            : 'text-[#787C83]'
                        }`}
                      >
                        {issue.priority}
                      </span>
                    </div>

                    <h4 className={`text-xs font-semibold line-clamp-2 leading-snug ${
                      isSelected ? 'text-white' : 'text-[#CFD4DD]'
                    }`}>
                      {issue.title}
                    </h4>

                    <div className="flex items-center justify-between text-[10px] text-[#787C83] font-mono pt-1">
                      <span className="truncate max-w-[120px]">{assigneeName}</span>
                      {subsCount > 0 && (
                        <span className="flex items-center gap-1 text-[#CFD4DD]">
                          <CheckSquare size={10} className="text-[#DCB001]" />
                          <span>{completedCount}/{subsCount}</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Developer Live Inspector & Git Console */}
        <div className="col-span-12 md:col-span-7 lg:col-span-8 bg-[#1B1C1F] border border-[#2A2C30] rounded-lg overflow-y-auto flex flex-col">
          {activeIssue ? (
            <div className="flex-1 flex flex-col overflow-y-auto">
              {/* Active Issue Header Bar */}
              <div className="p-3 bg-[#17181A] border-b border-[#2A2C30] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono font-bold text-xs text-[#DCB001] bg-[#131415] px-2 py-0.5 rounded border border-[#2A2C30]">
                    {activeIssue.key}
                  </span>
                  <span className="font-bold text-xs text-[#CFD4DD] truncate max-w-sm">
                    {activeIssue.title}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onSelectIssue(activeIssue.id)}
                    className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-[#787C83] hover:text-white bg-[#131415] hover:bg-[#2A2C30] border border-[#2A2C30] rounded transition-colors"
                    title="Open Full Detail Page"
                  >
                    <span>Full View</span>
                    <ExternalLink size={11} />
                  </button>
                </div>
              </div>

              {/* Dev Content Body */}
              <div className="p-4 space-y-4 flex-1 overflow-y-auto">
                {/* 1. Git Terminal Helper Box */}
                <div className="p-3 bg-[#131415] rounded-lg border border-[#2A2C30] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono text-[#DCB001] font-bold flex items-center gap-1.5">
                      <Terminal size={13} />
                      <span>Git Automation Commands</span>
                    </span>
                    <span className="text-[10px] font-mono text-[#787C83]">Click button to copy command</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* Branch Command */}
                    <div className="p-2 bg-[#17181A] rounded border border-[#2A2C30] flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-[9px] font-mono text-[#787C83] block">Checkout Feature Branch</span>
                        <code className="text-[10px] font-mono text-[#CFD4DD] truncate block">
                          git checkout -b {getBranchName(activeIssue)}
                        </code>
                      </div>
                      <button
                        onClick={() => copyToClipboard(`git checkout -b ${getBranchName(activeIssue)}`, 'branch')}
                        className="p-1.5 bg-[#1E1E1E] hover:bg-[#2A2C30] text-[#787C83] hover:text-[#DCB001] border border-[#2A2C30] rounded transition-colors shrink-0"
                        title="Copy Git Branch Command"
                      >
                        {copiedCmd === 'branch' ? <Check size={12} className="text-[#22C55E]" /> : <Copy size={12} />}
                      </button>
                    </div>

                    {/* Commit Template */}
                    <div className="p-2 bg-[#17181A] rounded border border-[#2A2C30] flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-[9px] font-mono text-[#787C83] block">Commit Message Prefix</span>
                        <code className="text-[10px] font-mono text-[#CFD4DD] truncate block">
                          [{activeIssue.key}] {activeIssue.title.slice(0, 30)}...
                        </code>
                      </div>
                      <button
                        onClick={() => copyToClipboard(`[${activeIssue.key}] ${activeIssue.title}`, 'commit')}
                        className="p-1.5 bg-[#1E1E1E] hover:bg-[#2A2C30] text-[#787C83] hover:text-[#DCB001] border border-[#2A2C30] rounded transition-colors shrink-0"
                        title="Copy Commit Prefix"
                      >
                        {copiedCmd === 'commit' ? <Check size={12} className="text-[#22C55E]" /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. Fast Status Lifecycle Progression */}
                <div className="p-3 bg-[#131415] rounded-lg border border-[#2A2C30] space-y-2">
                  <span className="text-[11px] font-mono text-[#787C83] block">Status Progression</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => onUpdateIssueStatus(activeIssue.id, 'todo')}
                      className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                        activeIssue.status === 'todo'
                          ? 'bg-[#2A2C30] text-white border border-[#3B3D41]'
                          : 'bg-[#17181A] text-[#787C83] hover:text-[#CFD4DD] border border-[#2A2C30]'
                      }`}
                    >
                      1. Todo
                    </button>

                    <button
                      onClick={() => onUpdateIssueStatus(activeIssue.id, 'in_progress')}
                      className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-all ${
                        activeIssue.status === 'in_progress'
                          ? 'bg-[#DCB001] text-[#0F1011] font-bold shadow-sm'
                          : 'bg-[#17181A] text-[#DCB001] hover:bg-[#DCB001]/10 border border-[#DCB001]/30'
                      }`}
                    >
                      <Play size={11} />
                      <span>2. In Progress (Coding)</span>
                    </button>

                    <button
                      onClick={() => onUpdateIssueStatus(activeIssue.id, 'needs_review')}
                      className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-all ${
                        activeIssue.status === 'needs_review'
                          ? 'bg-[#3B82F6] text-white font-bold shadow-sm'
                          : 'bg-[#17181A] text-[#3B82F6] hover:bg-[#3B82F6]/10 border border-[#3B82F6]/30'
                      }`}
                    >
                      <Eye size={11} />
                      <span>3. Needs Review (PR)</span>
                    </button>

                    <button
                      onClick={() => onUpdateIssueStatus(activeIssue.id, 'done')}
                      className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-all ${
                        activeIssue.status === 'done'
                          ? 'bg-[#22C55E] text-[#0F1011] font-bold shadow-sm'
                          : 'bg-[#17181A] text-[#22C55E] hover:bg-[#22C55E]/10 border border-[#22C55E]/30'
                      }`}
                    >
                      <CheckCircle2 size={11} />
                      <span>4. Approved & Done</span>
                    </button>
                  </div>
                </div>

                {/* 3. Description & Specifications */}

                {/* 4. Description & Specifications */}
                <div className="p-3 bg-[#131415] rounded-lg border border-[#2A2C30] space-y-1.5">
                  <span className="text-[11px] font-mono text-[#787C83] block">Specs & Description</span>
                  <p className="text-xs text-[#9499A0] leading-relaxed whitespace-pre-wrap font-normal">
                    {activeIssue.description || 'No description provided for this task.'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[#787C83] font-mono text-xs p-8">
              Select a task from the stream to start coding.
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

DevStreamView.displayName = 'DevStreamView';
