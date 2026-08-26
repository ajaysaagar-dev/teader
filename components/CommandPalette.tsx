'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Issue, Project } from '@/lib/types';
import { 
  Search,
  PlusCircle, 
  ArrowRight,
  LayoutGrid,
  BarChart3,
  Layers,
  FolderTree,
  Terminal,
  FolderKanban,
  LayoutDashboard,
  CheckCircle2,
  Clock,
  Flame,
  X,
  Sparkles,
  User,
  Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  issues: Issue[];
  projects: Project[];
  onSelectIssue: (issueId: string) => void;
  onOpenNewIssue: () => void;
  onSelectView?: (view: 'overview' | 'board' | 'hierarchy' | 'tree' | 'dev') => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  issues,
  projects,
  onSelectIssue,
  onOpenNewIssue,
  onSelectView,
}) => {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Global toggle shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // ─── Scoped Search Filtering (GitHub-style syntax) ─────────────────────────

  const { filteredIssues, filteredProjects, filteredActions } = useMemo(() => {
    const raw = query.trim().toLowerCase();
    
    // Parse operators like status:done, priority:high, label:ui
    let statusFilter: string | null = null;
    let priorityFilter: string | null = null;
    let labelFilter: string | null = null;
    let assigneeFilter: string | null = null;
    let cleanQuery = raw;

    const statusMatch = raw.match(/status:([a-z_-]+)/);
    if (statusMatch) {
      statusFilter = statusMatch[1];
      cleanQuery = cleanQuery.replace(statusMatch[0], '').trim();
    }

    const priorityMatch = raw.match(/priority:([a-z]+)/);
    if (priorityMatch) {
      priorityFilter = priorityMatch[1];
      cleanQuery = cleanQuery.replace(priorityMatch[0], '').trim();
    }

    const labelMatch = raw.match(/label:([a-z0-9_-]+)/);
    if (labelMatch) {
      labelFilter = labelMatch[1];
      cleanQuery = cleanQuery.replace(labelMatch[0], '').trim();
    }

    const assigneeMatch = raw.match(/assignee:([a-z0-9_-]+)/);
    if (assigneeMatch) {
      assigneeFilter = assigneeMatch[1];
      cleanQuery = cleanQuery.replace(assigneeMatch[0], '').trim();
    }

    const allActions = [
      {
        id: 'act_new',
        label: 'Create New Task (C)',
        category: 'Action',
        icon: PlusCircle,
        run: () => { onOpenNewIssue(); onClose(); },
      },
      {
        id: 'act_overview',
        label: 'Switch to Project Overview (Analytics & Charts)',
        category: 'View',
        icon: BarChart3,
        run: () => { onSelectView?.('overview'); onClose(); },
      },
      {
        id: 'act_board',
        label: 'Switch to Kanban Board View',
        category: 'View',
        icon: LayoutGrid,
        run: () => { onSelectView?.('board'); onClose(); },
      },
      {
        id: 'act_tree',
        label: 'Switch to Project Tree Explorer',
        category: 'View',
        icon: FolderTree,
        run: () => { onSelectView?.('tree'); onClose(); },
      },
      {
        id: 'act_hierarchy',
        label: 'Switch to Hierarchical View',
        category: 'View',
        icon: Layers,
        run: () => { onSelectView?.('hierarchy'); onClose(); },
      },
      {
        id: 'act_dev',
        label: 'Switch to Developer Workstation Stream',
        category: 'View',
        icon: Terminal,
        run: () => { onSelectView?.('dev'); onClose(); },
      },
      {
        id: 'act_projects',
        label: 'Go to Projects Directory',
        category: 'Navigation',
        icon: FolderKanban,
        run: () => { router.push('/projects'); onClose(); },
      },
      {
        id: 'act_dashboard',
        label: 'Go to Workspace Dashboard',
        category: 'Navigation',
        icon: LayoutDashboard,
        run: () => { router.push('/dashboard'); onClose(); },
      },
    ];

    const matchingActions = cleanQuery === ''
      ? allActions.slice(0, 5)
      : allActions.filter((a) => a.label.toLowerCase().includes(cleanQuery));

    const matchingIssues = issues.filter((i) => {
      if (statusFilter && !i.status.toLowerCase().includes(statusFilter)) return false;
      if (priorityFilter && !i.priority.toLowerCase().includes(priorityFilter)) return false;
      if (labelFilter && !(i.labels || []).some((l) => l.toLowerCase().includes(labelFilter!))) return false;
      if (assigneeFilter) {
        const name = (i as any).assigneeName || i.assignee?.name || '';
        if (!name.toLowerCase().includes(assigneeFilter)) return false;
      }

      if (!cleanQuery) return true;
      return (
        i.title.toLowerCase().includes(cleanQuery) ||
        i.key.toLowerCase().includes(cleanQuery) ||
        (i.labels || []).some((l) => l.toLowerCase().includes(cleanQuery))
      );
    });

    const matchingProjects = projects.filter(
      (p) =>
        cleanQuery === '' ||
        p.name.toLowerCase().includes(cleanQuery) ||
        p.key.toLowerCase().includes(cleanQuery)
    );

    return {
      filteredIssues: matchingIssues.slice(0, 15),
      filteredProjects: matchingProjects.slice(0, 6),
      filteredActions: matchingActions,
    };
  }, [query, issues, projects, onOpenNewIssue, onSelectView, router, onClose]);

  // Flatten items for arrow key indexing
  const flatItems = useMemo(() => {
    const list: Array<{ type: 'action' | 'issue' | 'project'; id: string; run: () => void }> = [];
    filteredActions.forEach((a) => list.push({ type: 'action', id: a.id, run: a.run }));
    filteredIssues.forEach((i) =>
      list.push({
        type: 'issue',
        id: i.id,
        run: () => {
          onSelectIssue(i.id);
          onClose();
        },
      })
    );
    filteredProjects.forEach((p) =>
      list.push({
        type: 'project',
        id: String(p.id),
        run: () => {
          router.push(`/projects/${p.id}`);
          onClose();
        },
      })
    );
    return list;
  }, [filteredActions, filteredIssues, filteredProjects, onSelectIssue, router, onClose]);

  // Arrow Key Navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (flatItems.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + flatItems.length) % (flatItems.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatItems[selectedIndex]) {
        flatItems[selectedIndex].run();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  let currentIndexTracker = 0;

  return (
    <AnimatePresence>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
        className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4 bg-black/75 backdrop-blur-sm select-none"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: -12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.97 }}
          transition={{ duration: 0.14, ease: 'easeOut' }}
          className="w-full max-w-2xl bg-[#1B1C1F] border border-[#2A2C30] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Input Bar */}
          <div className="flex items-center px-4 py-3.5 border-b border-[#2A2C30] bg-[#0F1011]">
            <Search size={18} className="text-[#DCB001] mr-3 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Type a command, search issues, or use operators (e.g. status:done, priority:high)..."
              className="w-full bg-transparent text-sm text-[#CFD4DD] placeholder-[#787C83] outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="p-1 text-[#787C83] hover:text-white rounded transition-colors"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Results List */}
          <div className="max-h-[60vh] overflow-y-auto p-2 space-y-3">
            {/* Quick Actions */}
            {filteredActions.length > 0 && (
              <div>
                <div className="px-3 py-1 text-[10px] font-bold text-[#787C83] uppercase tracking-wider font-mono">
                  Commands & Views
                </div>
                <div className="space-y-0.5">
                  {filteredActions.map((act) => {
                    const itemIndex = currentIndexTracker++;
                    const isSelected = selectedIndex === itemIndex;
                    const Icon = act.icon;
                    return (
                      <button
                        key={act.id}
                        onClick={act.run}
                        onMouseEnter={() => setSelectedIndex(itemIndex)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-xl text-left transition-colors ${
                          isSelected
                            ? 'bg-[#2A2C30] text-[#DCB001]'
                            : 'text-[#CFD4DD] hover:bg-[#222427]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon size={14} className={isSelected ? 'text-[#DCB001]' : 'text-[#787C83]'} />
                          <span className="font-medium">{act.label}</span>
                        </div>
                        <span className="text-[10px] font-mono text-[#787C83] opacity-60">
                          {act.category}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Issues */}
            {filteredIssues.length > 0 && (
              <div>
                <div className="px-3 py-1 text-[10px] font-bold text-[#787C83] uppercase tracking-wider font-mono">
                  Tasks ({filteredIssues.length})
                </div>
                <div className="space-y-0.5">
                  {filteredIssues.map((issue) => {
                    const itemIndex = currentIndexTracker++;
                    const isSelected = selectedIndex === itemIndex;
                    return (
                      <button
                        key={issue.id}
                        onClick={() => {
                          onSelectIssue(issue.id);
                          onClose();
                        }}
                        onMouseEnter={() => setSelectedIndex(itemIndex)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-xl text-left transition-colors ${
                          isSelected
                            ? 'bg-[#2A2C30] text-[#DCB001]'
                            : 'text-[#CFD4DD] hover:bg-[#222427]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden mr-2">
                          <span className="font-mono text-[11px] font-bold text-[#DCB001] shrink-0">
                            {issue.key}
                          </span>
                          <span className="truncate text-[#CFD4DD]">{issue.title}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 font-mono text-[10px]">
                          <span className="px-1.5 py-0.5 rounded bg-[#131415] text-[#787C83] border border-[#2A2C30] capitalize">
                            {issue.status.replace('_', ' ')}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Projects */}
            {filteredProjects.length > 0 && (
              <div>
                <div className="px-3 py-1 text-[10px] font-bold text-[#787C83] uppercase tracking-wider font-mono">
                  Projects ({filteredProjects.length})
                </div>
                <div className="space-y-0.5">
                  {filteredProjects.map((p) => {
                    const itemIndex = currentIndexTracker++;
                    const isSelected = selectedIndex === itemIndex;
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          router.push(`/projects/${p.id}`);
                          onClose();
                        }}
                        onMouseEnter={() => setSelectedIndex(itemIndex)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-xl text-left transition-colors ${
                          isSelected
                            ? 'bg-[#2A2C30] text-[#DCB001]'
                            : 'text-[#CFD4DD] hover:bg-[#222427]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <FolderKanban size={13} className="text-[#DCB001]" />
                          <span className="font-mono font-bold text-[#DCB001]">{p.key}</span>
                          <span className="text-[#CFD4DD]">{p.name}</span>
                        </div>
                        <span className="text-[10px] text-[#787C83] font-mono">Open Workspace ↵</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {flatItems.length === 0 && (
              <div className="p-8 text-center text-xs text-[#787C83] space-y-1">
                <Search size={20} className="mx-auto opacity-40 mb-2" />
                <p className="font-semibold text-[#CFD4DD]">No matching commands or tasks found</p>
                <p className="text-[11px]">Try searching by task ID, title, or status (e.g. `status:done`)</p>
              </div>
            )}
          </div>

          {/* Footer Shortcuts & Syntax Hints */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#0F1011] border-t border-[#2A2C30] text-[10px] text-[#787C83] font-mono">
            <div className="flex items-center gap-3">
              <span><kbd className="px-1.5 py-0.5 bg-[#1B1C1F] border border-[#2A2C30] rounded text-white">↑↓</kbd> Navigate</span>
              <span><kbd className="px-1.5 py-0.5 bg-[#1B1C1F] border border-[#2A2C30] rounded text-white">↵</kbd> Execute</span>
              <span><kbd className="px-1.5 py-0.5 bg-[#1B1C1F] border border-[#2A2C30] rounded text-white">ESC</kbd> Close</span>
            </div>
            <span className="hidden sm:inline opacity-70">
              Filter tips: <code className="text-[#DCB001]">status:in_progress</code> · <code className="text-[#3B82F6]">priority:high</code>
            </span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
