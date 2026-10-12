'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Issue, Project } from '@/lib/types';
import { resetUIScale } from '@/components/UIScaleInitializer';
import { StatusIcon } from '@/components/ui/StatusIcon';
import { PriorityIcon } from '@/components/ui/PriorityIcon';
import { toast } from 'sonner';
import { 
  Search,
  PlusCircle, 
  LayoutGrid,
  List,
  BarChart3,
  FolderTree,
  Calendar,
  Network,
  FolderKanban,
  LayoutDashboard,
  CheckCircle2,
  Clock,
  X,
  CheckSquare,
  Flame,
  MessageSquare,
  BookOpen,
  FileText,
  Workflow,
  PhoneCall,
  Boxes,
  Plug,
  Settings,
  RotateCcw,
  Trash2,
  History
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
  const pathname = usePathname();
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

  // ─── Scoped Search Filtering (GitHub / Linear syntax) ───────────────────────

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

    const projectMatch = pathname?.match(/^\/projects\/([^/?#]+)/);
    const currentProjectId = projectMatch ? projectMatch[1] : (projects.length > 0 ? String(projects[0].id) : null);
    const currentProject = projects.find((p) => String(p.id) === currentProjectId);
    const projPrefix = currentProject ? `${currentProject.key}: ` : 'Project: ';

    const allActions = [
      {
        id: 'act_new',
        label: 'Create New Task (C)',
        category: 'Action',
        icon: PlusCircle,
        run: () => { onOpenNewIssue(); onClose(); },
      },
      {
        id: 'act_dashboard',
        label: 'Go to Workspace Dashboard',
        category: 'Navigation',
        icon: LayoutDashboard,
        run: () => { router.push('/dashboard'); onClose(); },
      },
      {
        id: 'act_my_work',
        label: 'Go to Commitments',
        category: 'Navigation',
        icon: CheckSquare,
        run: () => { router.push('/my-work'); onClose(); },
      },
      {
        id: 'act_projects',
        label: 'Go to Projects Directory',
        category: 'Navigation',
        icon: FolderKanban,
        run: () => { router.push('/projects'); onClose(); },
      },
      ...(currentProjectId ? [
        {
          id: 'act_proj_overview',
          label: `${projPrefix}Overview & Analytics`,
          category: 'Project',
          icon: BarChart3,
          run: () => { router.push(`/projects/${currentProjectId}/overview`); onSelectView?.('overview'); onClose(); },
        },
        {
          id: 'act_proj_activity',
          label: `${projPrefix}Activity & History`,
          category: 'Project',
          icon: History,
          run: () => { router.push(`/projects/${currentProjectId}/history`); onClose(); },
        },
        {
          id: 'act_proj_board',
          label: `${projPrefix}Tasks — Kanban Board`,
          category: 'Project',
          icon: LayoutGrid,
          run: () => { router.push(`/projects/${currentProjectId}/board`); onSelectView?.('board'); onClose(); },
        },
        {
          id: 'act_proj_list',
          label: `${projPrefix}Tasks — Compact List`,
          category: 'Project',
          icon: List,
          run: () => { router.push(`/projects/${currentProjectId}/list`); onClose(); },
        },
        {
          id: 'act_proj_tree',
          label: `${projPrefix}Tasks — Structure Explorer`,
          category: 'Project',
          icon: FolderTree,
          run: () => { router.push(`/projects/${currentProjectId}/tree`); onSelectView?.('tree'); onClose(); },
        },
        {
          id: 'act_proj_timeline',
          label: `${projPrefix}Tasks — Timeline & Calendar`,
          category: 'Project',
          icon: Calendar,
          run: () => { router.push(`/projects/${currentProjectId}/timeline`); onClose(); },
        },
        {
          id: 'act_proj_deps',
          label: `${projPrefix}Tasks — Dependency Graph`,
          category: 'Project',
          icon: Network,
          run: () => { router.push(`/projects/${currentProjectId}/dependencies`); onClose(); },
        },
        {
          id: 'act_proj_docs',
          label: `${projPrefix}Documentation & Wiki`,
          category: 'Project',
          icon: FileText,
          run: () => { router.push(`/projects/${currentProjectId}/docs`); onClose(); },
        },
        {
          id: 'act_proj_charts',
          label: `${projPrefix}Diagrams & Architecture`,
          category: 'Project',
          icon: Workflow,
          run: () => { router.push(`/projects/${currentProjectId}/charts`); onClose(); },
        },
        {
          id: 'act_proj_chat',
          label: `${projPrefix}Chat & Discussion`,
          category: 'Project',
          icon: MessageSquare,
          run: () => { router.push(`/projects/${currentProjectId}/chats`); onClose(); },
        },
        {
          id: 'act_proj_meeting',
          label: `${projPrefix}Call & Meeting Room`,
          category: 'Project',
          icon: PhoneCall,
          run: () => { router.push(`/projects/${currentProjectId}/meeting`); onClose(); },
        },
        {
          id: 'act_proj_apps',
          label: `${projPrefix}Integrations & Apps`,
          category: 'Project',
          icon: Boxes,
          run: () => { router.push(`/projects/${currentProjectId}/apps`); onClose(); },
        },
        {
          id: 'act_proj_plugins',
          label: `${projPrefix}Plugins & Git Repositories`,
          category: 'Project',
          icon: Plug,
          run: () => { router.push(`/projects/${currentProjectId}/plugins`); onClose(); },
        },
        {
          id: 'act_proj_settings',
          label: `${projPrefix}Project Settings`,
          category: 'Project',
          icon: Settings,
          run: () => { router.push(`/projects/${currentProjectId}/settings`); onClose(); },
        },
      ] : []),
      {
        id: 'act_reset_scale',
        label: 'Reset UI Scale to 100%',
        category: 'Action',
        icon: RotateCcw,
        run: () => {
          resetUIScale();
          toast.success('UI scale reset to 100%');
          onClose();
        },
      },
      {
        id: 'act_clear_cache',
        label: 'Clear Local Storage & Cache',
        category: 'Action',
        icon: Trash2,
        run: () => {
          try {
            localStorage.clear();
            toast.success('Local cache cleared');
          } catch {}
          onClose();
        },
      },
    ];

    const matchingActions = cleanQuery === ''
      ? allActions.slice(0, 6)
      : allActions.filter((a) => 
          a.label.toLowerCase().includes(cleanQuery) || 
          a.category.toLowerCase().includes(cleanQuery)
        );

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
  }, [query, pathname, issues, projects, onOpenNewIssue, onSelectView, router, onClose]);

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
          router.push(`/task/${i.id}/details`);
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
        className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4 bg-black/80 backdrop-blur-sm select-none"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          transition={{ duration: 0.12, ease: 'easeOut' }}
          className="w-full max-w-2xl bg-[var(--bg-panel)] border border-[var(--border-primary)] rounded-xl shadow-2xl overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Input Bar */}
          <div className="flex items-center px-4 py-3 border-b border-[var(--border-primary)] bg-[var(--bg-canvas)]">
            <Search size={16} className="text-[var(--text-muted)] mr-3 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Type a command, search issues, or use operators (status:done, priority:high)..."
              className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded transition-colors"
                aria-label="Clear query"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Results List */}
          <div className="max-h-[60vh] overflow-y-auto p-2 space-y-3">
            {/* Quick Actions */}
            {filteredActions.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-xs font-medium text-[var(--text-muted)]">
                  Commands & Navigation
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
                        className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg text-left transition-colors ${
                          isSelected
                            ? 'bg-[var(--bg-active)] text-[var(--text-primary)]'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon size={15} className={isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'} />
                          <span className="font-medium text-xs sm:text-sm">{act.label}</span>
                        </div>
                        <span className="text-xs text-[var(--text-muted)]">
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
                <div className="px-3 py-1.5 text-xs font-medium text-[var(--text-muted)]">
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
                          router.push(`/task/${issue.id}/details`);
                          onClose();
                        }}
                        onMouseEnter={() => setSelectedIndex(itemIndex)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg text-left transition-colors ${
                          isSelected
                            ? 'bg-[var(--bg-active)] text-[var(--text-primary)]'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden mr-2">
                          <StatusIcon status={issue.status} size={14} className="shrink-0 text-[var(--text-muted)]" />
                          <span className="font-mono text-xs font-medium text-[var(--text-muted)] shrink-0">
                            {issue.key}
                          </span>
                          <span className="truncate text-xs sm:text-sm text-[var(--text-primary)]">{issue.title}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 text-xs text-[var(--text-muted)]">
                          <PriorityIcon priority={issue.priority} size={14} className="shrink-0" />
                          <span className="hidden sm:inline capitalize">
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
                <div className="px-3 py-1.5 text-xs font-medium text-[var(--text-muted)]">
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
                        className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg text-left transition-colors ${
                          isSelected
                            ? 'bg-[var(--bg-active)] text-[var(--text-primary)]'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <FolderKanban size={14} className="text-[var(--text-muted)]" />
                          <span className="font-mono text-xs font-medium text-[var(--text-primary)]">{p.key}</span>
                          <span className="text-xs sm:text-sm text-[var(--text-primary)]">{p.name}</span>
                        </div>
                        <span className="text-xs text-[var(--text-muted)]">Open ↵</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {flatItems.length === 0 && (
              <div className="p-8 text-center text-xs text-[var(--text-muted)] space-y-2">
                <Search size={20} className="mx-auto opacity-40 mb-2" />
                <p className="font-medium text-[var(--text-primary)] text-sm">No matching commands or tasks found</p>
                <p className="text-xs text-[var(--text-muted)]">Try searching by task ID, title, or status (e.g. status:done)</p>
              </div>
            )}
          </div>

          {/* Footer Shortcuts & Syntax Hints */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--bg-canvas)] border-t border-[var(--border-primary)] text-xs text-[var(--text-muted)]">
            <div className="flex items-center gap-3">
              <span><kbd className="px-1.5 py-0.5 bg-[var(--bg-panel)] border border-[var(--border-primary)] rounded font-mono text-[var(--text-primary)]">↑↓</kbd> Navigate</span>
              <span><kbd className="px-1.5 py-0.5 bg-[var(--bg-panel)] border border-[var(--border-primary)] rounded font-mono text-[var(--text-primary)]">↵</kbd> Select</span>
              <span><kbd className="px-1.5 py-0.5 bg-[var(--bg-panel)] border border-[var(--border-primary)] rounded font-mono text-[var(--text-primary)]">ESC</kbd> Close</span>
            </div>
            <span className="hidden sm:inline text-[var(--text-muted)]">
              Operators: <code className="text-[var(--text-primary)] font-mono">status:done</code> · <code className="text-[var(--text-primary)] font-mono">priority:high</code>
            </span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
