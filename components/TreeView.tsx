'use client';

import React, { useState, useMemo } from 'react';
import { Issue, Status, Priority, Subtask } from '@/lib/types';
import { Avatar } from './ui/Avatar';
import { CustomDropdown } from './ui/CustomDropdown';
import { TaskContextMenu } from './ui/TaskContextMenu';
import { 
  FolderTree, 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  CheckCircle2, 
  Circle, 
  Clock, 
  AlertCircle, 
  Search,
  Maximize2,
  Minimize2,
  Layers,
  CheckSquare,
  Square,
  FileCode,
  FolderOpen,
  Folder,
  Trash2,
  FolderPlus,
  Pencil,
  GripVertical,
  Check,
  X,
  CornerDownRight,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { 
  getTaskShortId, 
  getAvailableTaskMentions, 
  getMentionQueryAtCursor, 
  TaskMentionOption,
  formatAddedTiming,
  formatExactDateTime
} from '@/lib/task-id';
import { TaskMentionPopover } from './ui/TaskMentionPopover';

interface TreeViewProps {
  issues: Issue[];
  projectName?: string;
  projectKey?: string;
  onSelectIssue: (id: string) => void;
  onUpdateIssueStatus?: (id: string, status: Status) => void;
  onUpdateIssuePriority?: (id: string, priority: Priority) => void;
  onDeleteIssue?: (issueId: string) => void;
  onDeleteFolder?: (folderId: string, folderName: string, deleteTasks: boolean) => void;
  onOpenNewIssue?: () => void;
  onOpenNewFolder?: () => void;
  onRenameIssue?: (issueId: string, newTitle: string) => void;
  onRenameEpic?: (oldEpicName: string, newEpicName: string) => void;
  onMoveTaskToFolder?: (issueId: string, targetFolderId: string, targetFolderName?: string) => void;
  onAddTaskToFolder?: (folderId: string, folderName: string, title: string) => void;
  onReorderTaskInFolder?: (draggedIssueId: string, targetIssueId: string, targetFolderId: string, targetFolderName: string, position: 'before' | 'after') => void;
  canDelete?: boolean;
  canCompleteTasks?: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; icon: any }> = {
  todo: { label: 'Todo', bg: 'bg-[#666666]/10', text: 'text-[var(--text-muted)]', border: 'border-[#666666]/30', icon: Circle },
  in_progress: { label: 'In Progress', bg: 'bg-white/10', text: 'text-white', border: 'border-[var(--border-secondary)]', icon: Clock },
  needs_review: { label: 'Needs Review', bg: 'bg-[var(--ramp-3)]/10', text: 'text-white', border: 'border-[var(--border-secondary)]', icon: AlertCircle },
  done: { label: 'Done', bg: 'bg-[var(--ramp-3)]/10', text: 'text-white', border: 'border-[var(--border-secondary)]', icon: CheckCircle2 },
  blocked: { label: 'Blocked', bg: 'bg-[var(--ramp-3)]/10', text: 'text-white', border: 'border-[var(--border-secondary)]', icon: AlertCircle },
  cancelled: { label: 'Cancelled', bg: 'bg-[#666666]/10', text: 'text-[var(--text-muted)]', border: 'border-[#666666]/30', icon: Circle },
  merged: { label: 'Merged', bg: 'bg-[var(--ramp-3)]/10', text: 'text-white', border: 'border-[var(--border-secondary)]', icon: CheckCircle2 },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  none: { label: 'None', color: 'text-[var(--text-muted)]', dot: 'bg-[#666666]' },
  low: { label: 'Low', color: 'text-[var(--text-muted)]', dot: 'bg-[#666666]' },
  medium: { label: 'Medium', color: 'text-white', dot: 'bg-[#FFFFFF]' },
  high: { label: 'High', color: 'text-[#FFFFFF]', dot: 'bg-[#FFFFFF]' },
  critical: { label: 'Critical', color: 'text-white', dot: 'bg-[var(--ramp-3)]' },
};

function extractDroppedIssueId(e: React.DragEvent): string | null {
  try {
    const raw = e.dataTransfer.getData('application/json');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.issueId) return parsed.issueId;
    }
  } catch {}
  const plain = e.dataTransfer.getData('text/plain');
  if (plain && plain.trim()) return plain.trim();
  return null;
}

function isFolderEntity(i: Issue): boolean {
  return (
    (i.labels && i.labels.some((l) => l.toLowerCase() === 'folder' || l.toLowerCase() === 'group')) ||
    i.title.startsWith('📁 ') ||
    i.title.startsWith('[Folder]')
  );
}

function getFolderCleanName(i: Issue): string {
  const cleanTitle = i.title.replace(/^(\📁|\[Folder\])\s*/i, '').trim();
  if (cleanTitle) return cleanTitle;
  if (i.epic && i.epic !== 'General' && i.epic !== 'Platform Core') return i.epic.trim();
  return 'General';
}

function parseTimestamp(val: any, id?: string | number): number {
  if (val) {
    if (typeof val === 'number' && !isNaN(val) && val > 0) return val;
    const parsed = new Date(val).getTime();
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  if (id !== undefined && id !== null) {
    const strId = String(id);
    const match = strId.match(/(?:temp|iss|st|sub|_)*(\d{10,15})/);
    if (match && match[1]) {
      const parsed = Number(match[1]);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  }
  return 0;
}

function formatFolderDateTime(isoString?: string, id?: string | number): string {
  let timestamp = 0;
  if (isoString) {
    const t = new Date(isoString).getTime();
    if (!isNaN(t) && t > 0) timestamp = t;
  }
  if (!timestamp && id !== undefined && id !== null) {
    timestamp = parseTimestamp(null, id);
  }
  if (!timestamp) return '';
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}

export interface FolderContainer {
  id: string;
  name: string;
  createdAt?: string;
  timestamp: number;
  isGeneral: boolean;
  folderEntityId?: string;
  issues: Issue[];
}

export const TreeView: React.FC<TreeViewProps> = React.memo(({
  issues,
  projectName = 'Project Tree',
  projectKey = 'PRJ',
  onSelectIssue,
  onUpdateIssueStatus,
  onUpdateIssuePriority,
  onDeleteIssue,
  onDeleteFolder,
  onOpenNewIssue,
  onOpenNewFolder,
  onRenameIssue,
  onRenameEpic,
  onMoveTaskToFolder,
  onAddTaskToFolder,
  onReorderTaskInFolder,
  canDelete = true,
  canCompleteTasks = true,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all');
  const [expandedEpics, setExpandedEpics] = useState<Record<string, boolean>>({});
  const [expandedIssues, setExpandedIssues] = useState<Record<string, boolean>>({});
  const [activeFolderTaskInput, setActiveFolderTaskInput] = useState<string | null>(null);
  const [newTaskInFolderTitle, setNewTaskInFolderTitle] = useState('');
  const [dragOverTask, setDragOverTask] = useState<{ issueId: string; position: 'before' | 'after' } | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<{ folderName: string; taskCount: number; folderEntityId?: string } | null>(null);

  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    issue: Issue | null;
  }>({
    isOpen: false,
    position: { x: 0, y: 0 },
    issue: null,
  });

  // Mention Autocomplete state for inline folder task input
  const [inlineMentionState, setInlineMentionState] = useState<{
    active: boolean;
    query: string;
    startIndex: number;
    endIndex: number;
    selectedIndex: number;
  }>({
    active: false,
    query: '',
    startIndex: 0,
    endIndex: 0,
    selectedIndex: 0,
  });

  const mentionOptions = useMemo(() => getAvailableTaskMentions(issues), [issues]);

  const handleInlineTaskChange = (val: string, cursor: number) => {
    setNewTaskInFolderTitle(val);
    const mention = getMentionQueryAtCursor(val, cursor);
    if (mention) {
      setInlineMentionState({
        active: true,
        query: mention.query,
        startIndex: mention.startIndex,
        endIndex: mention.endIndex,
        selectedIndex: 0,
      });
    } else {
      setInlineMentionState((prev) => (prev.active ? { ...prev, active: false } : prev));
    }
  };

  const handleInlineSelectMention = (option: TaskMentionOption) => {
    const tagToAdd = `@${option.shortId}`;
    const before = newTaskInFolderTitle.slice(0, inlineMentionState.startIndex);
    const after = newTaskInFolderTitle.slice(inlineMentionState.endIndex);
    setNewTaskInFolderTitle(`${before}${tagToAdd} ${after}`);
    setInlineMentionState((prev) => ({ ...prev, active: false }));
  };

  const handleInlineTaskKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    folderId: string,
    folderName: string
  ) => {
    if (inlineMentionState.active) {
      const q = inlineMentionState.query.toLowerCase().trim();
      const filtered = mentionOptions.filter(
        (opt) =>
          opt.shortId.toLowerCase().includes(q) ||
          opt.title.toLowerCase().includes(q) ||
          opt.key.toLowerCase().includes(q)
      );

      if (filtered.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setInlineMentionState((prev) => ({
            ...prev,
            selectedIndex: (prev.selectedIndex + 1) % filtered.length,
          }));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setInlineMentionState((prev) => ({
            ...prev,
            selectedIndex: (prev.selectedIndex - 1 + filtered.length) % filtered.length,
          }));
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          const selected = filtered[inlineMentionState.selectedIndex] || filtered[0];
          handleInlineSelectMention(selected);
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setInlineMentionState((prev) => ({ ...prev, active: false }));
          return;
        }
      }
    }

    if (e.key === 'Enter') {
      if (newTaskInFolderTitle.trim() && onAddTaskToFolder) {
        onAddTaskToFolder(folderId, folderName, newTaskInFolderTitle.trim());
        setNewTaskInFolderTitle('');
        setActiveFolderTaskInput(null);
        setInlineMentionState((prev) => ({ ...prev, active: false }));
      }
    }
    if (e.key === 'Escape') {
      setActiveFolderTaskInput(null);
      setNewTaskInFolderTitle('');
      setInlineMentionState((prev) => ({ ...prev, active: false }));
    }
  };

  // Editing state for Epics & Task titles
  const [editingEpicId, setEditingEpicId] = useState<string | null>(null);
  const [editingEpicValue, setEditingEpicValue] = useState('');
  const [editingIssueId, setEditingIssueId] = useState<string | null>(null);
  const [editingIssueTitleValue, setEditingIssueTitleValue] = useState('');
  const [dragOverEpic, setDragOverEpic] = useState<string | null>(null);

  // Group issues into distinct Folder Containers (supporting duplicate names seamlessly via unique folder ID)
  const folderContainers: FolderContainer[] = useMemo(() => {
    const list: FolderContainer[] = [];

    // 1. General Folder container (always present)
    const generalContainer: FolderContainer = {
      id: 'folder_general',
      name: 'General',
      isGeneral: true,
      timestamp: 0,
      issues: [],
    };

    // 2. Register every explicit folder entity as its own unique container
    const folderEntityMap = new Map<string, FolderContainer>();
    issues.forEach((issue) => {
      if (isFolderEntity(issue)) {
        const cleanName = getFolderCleanName(issue);
        const createdIso = issue.createdAt || (issue as any).created_at;
        const createdTime = parseTimestamp(createdIso, issue.id);
        const container: FolderContainer = {
          id: issue.id,
          name: cleanName,
          createdAt: createdIso,
          timestamp: createdTime,
          isGeneral: false,
          folderEntityId: issue.id,
          issues: [],
        };

        // If folder entity has subtasks, insert them as child tasks
        if (issue.subtasks && Array.isArray(issue.subtasks)) {
          issue.subtasks.forEach((st: any) => {
            if (st.title) {
              const syntheticTask: Issue = {
                id: st.id || `st_${Date.now()}_${Math.random()}`,
                key: `${issue.key || 'TASK'}-${st.id?.slice(-3) || '1'}`,
                title: st.title,
                description: '',
                labels: [],
                subtasks: [],
                status: st.completed ? 'done' : 'todo',
                priority: 'medium',
                epic: cleanName,
                folderId: issue.id,
                project: issue.project,
                projectId: issue.projectId,
                createdAt: issue.createdAt,
                updatedAt: issue.updatedAt,
              };
              container.issues.push(syntheticTask);
            }
          });
        }

        folderEntityMap.set(issue.id, container);
        list.push(container);
      }
    });

    // 3. Register any custom epics referenced on tasks without an explicit folder entity
    issues.forEach((issue) => {
      if (!isFolderEntity(issue) && issue.epic && issue.epic.trim() && issue.epic !== 'General' && issue.epic !== 'Platform Core') {
        const epicName = issue.epic.trim();
        const existing = list.find((c) => c.id === issue.folderId || c.folderEntityId === issue.folderId || c.name.toLowerCase() === epicName.toLowerCase());
        if (!existing) {
          const createdIso = issue.createdAt || (issue as any).created_at;
          const container: FolderContainer = {
            id: issue.folderId || `epic_${epicName}`,
            name: epicName,
            createdAt: createdIso,
            timestamp: parseTimestamp(createdIso, issue.id),
            isGeneral: false,
            issues: [],
          };
          list.push(container);
        }
      }
    });

    // 4. Route tasks into their appropriate folder container strictly by folderId first!
    issues.forEach((issue) => {
      if (isFolderEntity(issue)) return; // Handled

      // Priority 1: Match by explicit folderId
      if (issue.folderId) {
        if (issue.folderId === 'folder_general' || issue.folderId.toLowerCase() === 'general') {
          generalContainer.issues.push(issue);
          return;
        }
        const matchingById = list.find((c) => c.id === issue.folderId || c.folderEntityId === issue.folderId);
        if (matchingById) {
          matchingById.issues.push(issue);
          return;
        }
      }

      // Priority 2: Match by rawEpic matching a container id
      const rawEpic = issue.epic && issue.epic.trim() && issue.epic !== 'Platform Core' ? issue.epic.trim() : 'General';
      const matchingById = list.find((c) => c.id === rawEpic || c.folderEntityId === rawEpic);
      if (matchingById) {
        matchingById.issues.push(issue);
        return;
      }

      if (rawEpic.toLowerCase() === 'general') {
        generalContainer.issues.push(issue);
        return;
      }

      // Priority 3: Fallback matching by name for legacy tasks WITHOUT folderId
      // Match the oldest/original folder container that existed when or before this task was created,
      // NEVER a newly created empty duplicate folder created after the task!
      const matchingContainers = list.filter((c) => c.name.toLowerCase() === rawEpic.toLowerCase());
      if (matchingContainers.length > 0) {
        const sortedByAge = [...matchingContainers].sort((a, b) => a.timestamp - b.timestamp);
        const taskTime = parseTimestamp(issue.createdAt || (issue as any).created_at, issue.id);
        const bestMatch = sortedByAge.find((c) => c.timestamp <= taskTime) || sortedByAge[0];
        bestMatch.issues.push(issue);
      } else {
        generalContainer.issues.push(issue);
      }
    });

    // Always include General at end
    list.push(generalContainer);

    // 5. Sort latest first (newest timestamp first, oldest last, General last)
    return list.sort((a, b) => {
      if (a.isGeneral) return 1;
      if (b.isGeneral) return -1;

      let timeA = a.timestamp;
      a.issues.forEach((i) => {
        const t = parseTimestamp(i.createdAt || (i as any).created_at, i.id);
        if (t > timeA) timeA = t;
      });

      let timeB = b.timestamp;
      b.issues.forEach((i) => {
        const t = parseTimestamp(i.createdAt || (i as any).created_at, i.id);
        if (t > timeB) timeB = t;
      });

      if (timeA !== timeB) {
        return timeB - timeA; // Latest first
      }
      return a.name.localeCompare(b.name);
    });
  }, [issues]);

  const storageKey = useMemo(() => `teader_tree_expanded_epics_${projectKey || 'default'}`, [projectKey]);
  const [isEpicsLoadedFromStorage, setIsEpicsLoadedFromStorage] = useState(false);

  // Read expanded folders from localStorage on mount (Default: all folders are COLLAPSED)
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          setExpandedEpics(parsed);
        } else {
          setExpandedEpics({});
        }
      } else {
        // By default all folders are collapsed!
        setExpandedEpics({});
      }
    } catch {
      setExpandedEpics({});
    } finally {
      setIsEpicsLoadedFromStorage(true);
    }
  }, [storageKey]);

  // Persist expanded folder state to localStorage whenever it changes
  React.useEffect(() => {
    if (!isEpicsLoadedFromStorage || typeof window === 'undefined') return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(expandedEpics));
    } catch (err) {
      console.error('Failed to persist expanded folders state:', err);
    }
  }, [expandedEpics, isEpicsLoadedFromStorage, storageKey]);

  const toggleEpic = (folderId: string) => {
    setExpandedEpics((prev) => {
      const isCurrentlyExpanded = Boolean(prev[folderId]);
      return { ...prev, [folderId]: !isCurrentlyExpanded };
    });
  };

  const toggleIssue = (issueId: string) => {
    setExpandedIssues((prev) => ({ ...prev, [issueId]: !prev[issueId] }));
  };

  const expandAll = () => {
    const allE: Record<string, boolean> = {};
    const allI: Record<string, boolean> = {};
    folderContainers.forEach((fc) => (allE[fc.id] = true));
    issues.forEach((i) => (allI[i.id] = true));
    setExpandedEpics(allE);
    setExpandedIssues(allI);
  };

  const collapseAll = () => {
    setExpandedEpics({});
    setExpandedIssues({});
  };

  const handleSaveEpicRename = (folder: FolderContainer) => {
    if (folder.isGeneral || folder.name.toLowerCase() === 'general' || folder.name.toLowerCase() === 'general tasks') {
      toast.info('The "General" folder is the common default folder and cannot be modified.');
      setEditingEpicId(null);
      return;
    }
    const trimmed = editingEpicValue.trim();
    if (!trimmed || trimmed === folder.name) {
      setEditingEpicId(null);
      return;
    }
    if (folder.folderEntityId && onRenameIssue) {
      onRenameIssue(folder.folderEntityId, `📁 ${trimmed}`);
    } else if (onRenameEpic) {
      onRenameEpic(folder.name, trimmed);
    }
    setEditingEpicId(null);
  };

  const handleSaveIssueRename = (issueId: string, currentTitle: string) => {
    const trimmed = editingIssueTitleValue.trim();
    if (trimmed && trimmed !== currentTitle && onRenameIssue) {
      onRenameIssue(issueId, trimmed);
    }
    setEditingIssueId(null);
  };

  // Filtered issues calculation
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      const matchSearch =
        searchQuery.trim() === '' ||
        issue.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        issue.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (issue.epic && issue.epic.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (issue.labels && issue.labels.some((l) => l.toLowerCase().includes(searchQuery.toLowerCase())));

      const matchStatus = statusFilter === 'all' || issue.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [issues, searchQuery, statusFilter]);

  const totalCounts = useMemo(() => {
    const total = issues.length;
    const completed = issues.filter((iss) => iss.status === 'done').length;
    return { total, completed };
  }, [issues]);

  const overallProgressPercent = totalCounts.total > 0 ? Math.round((totalCounts.completed / totalCounts.total) * 100) : 0;

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 w-full bg-[var(--bg-canvas)] overflow-hidden">
      {/* Top Toolbar */}
      <div className="h-11 px-4 bg-[var(--bg-canvas)] border-b border-[var(--border-primary)] flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
            <FolderTree size={15} className="text-white" />
            <span className="font-bold">Project Tree Explorer</span>
          </div>

          <div className="h-4 w-[1px] bg-[#222222] hidden sm:block" />

          {/* Quick Search */}
          <div className="relative w-48 sm:w-64">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search tree nodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--bg-panel)] border border-[var(--border-primary)] focus:border-[var(--border-secondary)] rounded-md pl-7 pr-2.5 py-1 text-xs text-[var(--text-secondary)] placeholder-[#666666] outline-none"
            />
          </div>

          {/* Status Filter */}
          <div className="hidden md:flex items-center gap-1 bg-[var(--bg-panel)] border border-[var(--border-primary)] rounded-md p-0.5 text-[11px]">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2 py-0.5 rounded font-medium transition-colors ${
                statusFilter === 'all' ? 'bg-[#222222] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('in_progress')}
              className={`px-2 py-0.5 rounded font-medium transition-colors ${
                statusFilter === 'in_progress' ? 'bg-[#222222] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              In Progress
            </button>
            <button
              onClick={() => setStatusFilter('needs_review')}
              className={`px-2 py-0.5 rounded font-medium transition-colors ${
                statusFilter === 'needs_review' ? 'bg-[#222222] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              Review
            </button>
            <button
              onClick={() => setStatusFilter('done')}
              className={`px-2 py-0.5 rounded font-medium transition-colors ${
                statusFilter === 'done' ? 'bg-[#222222] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              Done
            </button>
          </div>
        </div>

        {/* Right Tools: Expand/Collapse & Progress */}
        <div className="flex items-center gap-2 text-xs">
          {/* Progress metric */}
          <div className="hidden lg:flex items-center gap-2 bg-[var(--bg-panel)] border border-[var(--border-primary)] px-2.5 py-1 rounded-md text-[11px] font-mono">
            <span className="text-[var(--text-muted)]">Sub-works:</span>
            <span className="text-white font-bold">{totalCounts.completed}</span>
            <span className="text-[var(--text-muted)]">/</span>
            <span className="text-[var(--text-secondary)]">{totalCounts.total}</span>
            <div className="w-12 h-1.5 bg-[#222222] rounded-full overflow-hidden ml-1">
              <div
                className="h-full bg-[var(--ramp-3)] transition-all duration-300"
                style={{ width: `${overallProgressPercent}%` }}
              />
            </div>
            <span className="text-white font-bold">{overallProgressPercent}%</span>
          </div>

          <button
            onClick={expandAll}
            className="flex items-center gap-1 px-2 py-1 bg-[var(--bg-panel)] hover:bg-[#242424] border border-[var(--border-primary)] rounded text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            title="Expand All Nodes"
          >
            <Maximize2 size={11} />
            <span className="hidden sm:inline">Expand All</span>
          </button>

          <button
            onClick={collapseAll}
            className="flex items-center gap-1 px-2 py-1 bg-[var(--bg-panel)] hover:bg-[#242424] border border-[var(--border-primary)] rounded text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            title="Collapse All Nodes"
          >
            <Minimize2 size={11} />
            <span className="hidden sm:inline">Collapse</span>
          </button>

          {(onOpenNewIssue || onOpenNewFolder) && (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={onOpenNewFolder || onOpenNewIssue}
                className="flex items-center gap-1 px-2.5 py-1 bg-[var(--bg-card)] hover:bg-[#282828] border border-[var(--border-primary)] hover:border-[var(--border-secondary)] text-[var(--text-secondary)] hover:text-white font-bold text-xs rounded transition-all shrink-0"
                title="Create New Folder / Group"
              >
                <FolderPlus size={13} />
                <span>+ Folder</span>
              </button>
              <button
                onClick={onOpenNewIssue}
                className="flex items-center gap-1 px-2.5 py-1 bg-white text-black hover:bg-[#FFFFFF] font-bold text-xs rounded shadow-sm transition-all shrink-0"
              >
                <Plus size={13} />
                <span>New Task</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Tree Canvas */}
      <div className="flex-1 overflow-y-auto overflow-x-auto p-4 md:p-6 custom-scrollbar font-sans select-none">
        <div className="max-w-5xl mx-auto space-y-4">
          
          {/* ROOT NODE: Project Card */}
          <div className="relative flex items-center gap-3 p-3 bg-[var(--bg-panel)] border border-[var(--border-primary)] rounded-xl shadow-lg group">
            <div className="w-8 h-8 rounded-lg bg-white/15 border border-[var(--border-secondary)] flex items-center justify-center text-white shadow-inner shrink-0">
              <Layers size={18} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold px-1.5 py-0.5 bg-[var(--bg-canvas)] border border-[var(--border-primary)] text-white rounded">
                  {projectKey}
                </span>
                <h2 className="text-sm md:text-base font-bold text-white truncate">{projectName}</h2>
                <span className="text-[11px] font-mono text-[var(--text-muted)] px-2 py-0.5 bg-[var(--bg-canvas)] rounded-full border border-[var(--border-primary)]">
                  {issues.length} Tasks &bull; {folderContainers.length} Folders &bull; {totalCounts.total} Sub-items
                </span>
              </div>
            </div>

            {/* Tree Branch Anchor */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-[var(--text-muted)] font-mono">
              <span className="w-2 h-2 rounded-full bg-[var(--ramp-3)] animate-pulse" />
              <span>Active Drag & Drop Tree</span>
            </div>
          </div>

          {/* TREE LEVEL 1: Epics & Domains */}
          <div className="relative pl-4 sm:pl-6 border-l-2 border-[var(--border-primary)] ml-4 sm:ml-6 space-y-4">
            {folderContainers.map((folder) => {
              const isFiltering = searchQuery.trim() !== '' || statusFilter !== 'all';
              const folderIssues = folder.issues.filter((i) =>
                !isFiltering ? true : filteredIssues.some((fi) => fi.id === i.id)
              );

              // Only hide empty folder if user is actively searching/filtering and neither tasks nor folder name match
              if (
                isFiltering &&
                folderIssues.length === 0 &&
                !folder.name.toLowerCase().includes(searchQuery.toLowerCase())
              ) {
                return null;
              }

              const isEpicExpanded = isFiltering && folderIssues.length > 0 ? true : Boolean(expandedEpics[folder.id]);
              const epicTotal = folderIssues.length;
              const epicDone = folderIssues.filter((i) => i.status === 'done').length;
              const epicProgress = epicTotal > 0 ? Math.round((epicDone / epicTotal) * 100) : 0;
              const isEditingThisEpic = editingEpicId === folder.id;
              const isGeneralFolder = folder.isGeneral;

              // Folder completion status for dynamic highlighting
              const isNoneDone = epicTotal > 0 && epicDone === 0;
              const isPartiallyDone = epicTotal > 0 && epicDone > 0 && epicDone < epicTotal;
              const isAllDone = epicTotal > 0 && epicDone === epicTotal;

              let folderCardClasses = 'bg-[var(--bg-canvas)] hover:bg-[var(--bg-card)] border border-[var(--border-primary)] hover:border-[var(--border-secondary)]';
              let folderIconClasses = 'bg-white/10 text-white';

              if (dragOverEpic === folder.id) {
                folderCardClasses = 'bg-white/20 border-2 border-dashed border-[var(--border-secondary)] scale-[1.01]';
              } else if (isNoneDone) {
                // Highlight with Amber / Warm Orange alert when all tasks in folder are not done yet
                folderCardClasses = 'bg-[#121212] hover:bg-[#171717] border border-[#FFFFFF]/40 shadow-[inset_3px_0_0_#FFFFFF]';
                folderIconClasses = 'bg-white/15 text-white';
              } else if (isPartiallyDone) {
                // Highlight with Electric Cyan / Sky Blue progress when some tasks are completed but not all
                folderCardClasses = 'bg-[#141414] hover:bg-[#1A1A1A] border border-[#FFFFFF]/45 shadow-[inset_3px_0_0_#FFFFFF]';
                folderIconClasses = 'bg-[#FFFFFF]/15 text-white';
              } else if (isAllDone) {
                // Highlight with Emerald Green when all tasks in folder are fully done
                folderCardClasses = 'bg-[#101010] hover:bg-[#151515] border border-[var(--border-secondary)] shadow-[inset_3px_0_0_#FFFFFF]';
                folderIconClasses = 'bg-[var(--ramp-3)]/15 text-white';
              }

              return (
                <div key={folder.id} className="relative group/epic">
                  {/* Branch Connector Guide */}
                  <div className="absolute -left-4 sm:-left-6 top-4 w-4 sm:w-6 h-[2px] bg-[#222222] group-hover/epic:bg-white/60 transition-colors" />

                  {/* Epic / Folder Node Banner */}
                  <div
                    onClick={() => {
                      if (!isEditingThisEpic) toggleEpic(folder.id);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverEpic !== folder.id) setDragOverEpic(folder.id);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOverEpic(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOverEpic(null);
                      const droppedId = extractDroppedIssueId(e);
                      if (droppedId && onMoveTaskToFolder) {
                        onMoveTaskToFolder(droppedId, folder.id, folder.name);
                        setExpandedEpics((prev) => ({ ...prev, [folder.id]: true }));
                      }
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all shadow-sm group ${folderCardClasses}`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap sm:flex-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleEpic(folder.id);
                        }}
                        className="text-[var(--text-muted)] group-hover:text-white transition-colors p-0.5 cursor-pointer"
                      >
                        {isEpicExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>

                      <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${folderIconClasses}`}>
                        {isEpicExpanded ? <FolderOpen size={12} /> : <Folder size={12} />}
                      </div>

                      {/* Inline Epic Rename */}
                      {isEditingThisEpic && !isGeneralFolder ? (
                        <div
                          className="flex items-center gap-1 flex-1 max-w-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            value={editingEpicValue}
                            onChange={(e) => setEditingEpicValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEpicRename(folder);
                              if (e.key === 'Escape') setEditingEpicId(null);
                            }}
                            onBlur={() => handleSaveEpicRename(folder)}
                            autoFocus
                            className="bg-[var(--bg-panel)] border border-[var(--border-secondary)] text-xs font-bold text-white px-2 py-0.5 rounded outline-none w-full"
                          />
                          <button
                            onClick={() => handleSaveEpicRename(folder)}
                            className="p-1 hover:bg-[#222222] text-white rounded cursor-pointer"
                          >
                            <Check size={12} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              if (isGeneralFolder) {
                                toast.info('General is the default common folder and cannot be renamed.');
                                return;
                              }
                              setEditingEpicValue(folder.name);
                              setEditingEpicId(folder.id);
                            }}
                            className="font-bold text-xs md:text-sm text-[var(--text-secondary)] group-hover:text-white truncate"
                            title={isGeneralFolder ? 'General (Default Common Folder)' : 'Double click to rename folder'}
                          >
                            {folder.name}
                          </span>

                          {/* Created Date and Time Badge */}
                          {folder.createdAt && (
                            <span
                              className="text-[10px] font-mono text-[var(--text-secondary)] bg-[var(--bg-panel)] px-2 py-0.5 rounded border border-[var(--border-primary)] flex items-center gap-1 shrink-0"
                              title={`Created on ${formatFolderDateTime(folder.createdAt, folder.id)}`}
                            >
                              <Calendar size={10} className="text-white" />
                              <span>{formatFolderDateTime(folder.createdAt, folder.id)}</span>
                            </span>
                          )}

                          {isGeneralFolder ? (
                            <span className="text-[9px] font-mono text-white bg-white/10 border border-[var(--border-secondary)] px-1.5 py-0.2 rounded font-bold shrink-0">
                              DEFAULT
                            </span>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingEpicValue(folder.name);
                                setEditingEpicId(folder.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-[var(--text-muted)] hover:text-white transition-opacity cursor-pointer"
                              title="Rename Folder"
                            >
                              <Pencil size={11} />
                            </button>
                          )}
                        </div>
                      )}

                      {/* Folder Tasks Status / Completion Highlight Badge */}
                      {isNoneDone ? (
                        <span
                          className="text-[10px] font-mono font-bold text-white bg-white/15 px-2 py-0.5 rounded-full border border-[#FFFFFF]/35 flex items-center gap-1.5 shrink-0 ml-auto sm:ml-0"
                          title="All tasks in this folder are not done yet (0% completed)"
                        >
                          <Circle size={10} className="text-white" />
                          <span>0/{epicTotal} Done (Pending)</span>
                        </span>
                      ) : isPartiallyDone ? (
                        <div className="flex items-center gap-1.5 shrink-0 ml-auto sm:ml-0">
                          <span
                            className="text-[10px] font-mono font-bold text-white bg-[#FFFFFF]/15 px-2 py-0.5 rounded-full border border-[#FFFFFF]/40 flex items-center gap-1.5"
                            title={`${epicDone} of ${epicTotal} tasks completed (${epicProgress}%)`}
                          >
                            <Clock size={10} className="text-white animate-pulse" />
                            <span>{epicDone}/{epicTotal} Done ({epicProgress}%)</span>
                          </span>
                          <div className="hidden sm:block w-12 h-1.5 bg-[#242424] rounded-full overflow-hidden border border-[#FFFFFF]/30" title={`${epicProgress}% completed`}>
                            <div className="h-full bg-[var(--ramp-3)] rounded-full transition-all duration-300" style={{ width: `${epicProgress}%` }} />
                          </div>
                        </div>
                      ) : isAllDone ? (
                        <span
                          className="text-[10px] font-mono font-bold text-white bg-[var(--ramp-3)]/15 px-2 py-0.5 rounded-full border border-[var(--border-secondary)] flex items-center gap-1.5 shrink-0 ml-auto sm:ml-0"
                          title="All tasks in this folder are 100% completed!"
                        >
                          <CheckCircle2 size={10} className="text-white" />
                          <span>{epicDone}/{epicTotal} Done (100%)</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-panel)] px-2 py-0.5 rounded-full border border-[var(--border-primary)] shrink-0 ml-auto sm:ml-0">
                          0 tasks (Empty)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {dragOverEpic === folder.id ? (
                        <span className="text-[11px] font-bold text-white font-mono animate-pulse">
                          Drop to move here &darr;
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedEpics((prev) => ({ ...prev, [folder.id]: true }));
                              setActiveFolderTaskInput((prev) => (prev === folder.id ? null : folder.id));
                            }}
                            className="flex items-center gap-1 px-2 py-0.5 bg-[var(--bg-panel)] hover:bg-[#282828] border border-[var(--border-primary)] hover:border-[var(--border-secondary)] text-[var(--text-secondary)] hover:text-white text-[11px] font-medium rounded transition-colors cursor-pointer"
                            title={`Create new task inside folder "${folder.name}"`}
                          >
                            <Plus size={11} />
                            <span>Task</span>
                          </button>

                          {!isGeneralFolder && canDelete && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setFolderToDelete({
                                  folderName: folder.name,
                                  taskCount: folderIssues.length,
                                  folderEntityId: folder.folderEntityId,
                                });
                              }}
                              className="p-1 hover:bg-[var(--ramp-3)]/15 rounded text-[var(--text-muted)] hover:text-white transition-all opacity-0 group-hover/epic:opacity-100 cursor-pointer"
                              title={`Delete folder "${folder.name}"`}
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Inline + Task Input inside Folder */}
                  {activeFolderTaskInput === folder.id && (
                    <div className="relative pl-5 sm:pl-7 border-l-2 border-[var(--border-primary)] ml-3 sm:ml-4 mt-2.5">
                      <div className="flex items-center gap-2 bg-[var(--bg-panel)] border border-[var(--border-secondary)] rounded-lg p-2 shadow-sm">
                        <FileCode size={13} className="text-white shrink-0" />
                        <input
                          type="text"
                          placeholder={`Enter task title inside folder "${folder.name}" (type @ to tag)...`}
                          value={newTaskInFolderTitle}
                          onChange={(e) => handleInlineTaskChange(e.target.value, e.target.selectionStart ?? e.target.value.length)}
                          onKeyDown={(e) => handleInlineTaskKeyDown(e, folder.id, folder.name)}
                          autoFocus
                          className="flex-1 bg-transparent text-xs text-white placeholder-[#666666] outline-none"
                        />
                        <button
                          onClick={() => {
                            if (newTaskInFolderTitle.trim() && onAddTaskToFolder) {
                              onAddTaskToFolder(folder.id, folder.name, newTaskInFolderTitle.trim());
                              setNewTaskInFolderTitle('');
                              setActiveFolderTaskInput(null);
                              setInlineMentionState((prev) => ({ ...prev, active: false }));
                            }
                          }}
                          className="px-2.5 py-1 bg-white text-black hover:bg-[#FFFFFF] font-bold text-xs rounded transition-colors cursor-pointer"
                        >
                          Add Task
                        </button>
                        <button
                          onClick={() => {
                            setActiveFolderTaskInput(null);
                            setNewTaskInFolderTitle('');
                            setInlineMentionState((prev) => ({ ...prev, active: false }));
                          }}
                          className="px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>

                      {/* Mention Popover for Inline Task Creation */}
                      {inlineMentionState.active && (
                        <div className="absolute left-6 right-0 top-full mt-1.5 z-50">
                          <TaskMentionPopover
                            query={inlineMentionState.query}
                            options={mentionOptions}
                            selectedIndex={inlineMentionState.selectedIndex}
                            onSelect={handleInlineSelectMention}
                            onClose={() => setInlineMentionState((prev) => ({ ...prev, active: false }))}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* TREE LEVEL 2: Tasks within Folder */}
                  <AnimatePresence>
                    {isEpicExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (dragOverEpic !== folder.id) setDragOverEpic(folder.id);
                        }}
                        onDragLeave={() => {
                          setDragOverEpic(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDragOverEpic(null);
                          const droppedId = extractDroppedIssueId(e);
                          if (droppedId && onMoveTaskToFolder) {
                            onMoveTaskToFolder(droppedId, folder.id, folder.name);
                            setExpandedEpics((prev) => ({ ...prev, [folder.id]: true }));
                          }
                        }}
                        className="pl-5 sm:pl-7 border-l-2 border-[var(--border-primary)] ml-3 sm:ml-4 mt-2.5 space-y-2.5 min-h-[30px]"
                      >
                        {/* Empty Folder Drop Hint */}
                        {folderIssues.length === 0 && (
                          <div
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (dragOverEpic !== folder.id) setDragOverEpic(folder.id);
                            }}
                            onDragLeave={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setDragOverEpic(null);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setDragOverEpic(null);
                              const droppedId = extractDroppedIssueId(e);
                              if (droppedId && onMoveTaskToFolder) {
                                onMoveTaskToFolder(droppedId, folder.id, folder.name);
                                setExpandedEpics((prev) => ({ ...prev, [folder.id]: true }));
                              }
                            }}
                            className={`py-3 px-3 border border-dashed rounded-lg text-center text-xs font-mono transition-all ${
                              dragOverEpic === folder.id
                                ? 'border-[var(--border-secondary)] bg-white/10 text-white'
                                : 'border-[var(--border-primary)] text-[var(--text-muted)]'
                            }`}
                          >
                            <span>📁 Folder is empty. Drag and drop tasks here or </span>
                            <button
                              onClick={() => {
                                setExpandedEpics((prev) => ({ ...prev, [folder.id]: true }));
                                setActiveFolderTaskInput(folder.id);
                              }}
                              className="text-white underline ml-1 font-bold hover:text-white cursor-pointer"
                            >
                              create a new task
                            </button>
                          </div>
                        )}

                        {folderIssues.map((issue) => {
                          const statusCfg = STATUS_CONFIG[issue.status] || STATUS_CONFIG.todo;
                          const priorityCfg = PRIORITY_CONFIG[issue.priority] || PRIORITY_CONFIG.medium;
                          const isEditingThisIssue = editingIssueId === issue.id;
                          const isHoveredBefore = dragOverTask?.issueId === issue.id && dragOverTask.position === 'before';
                          const isHoveredAfter = dragOverTask?.issueId === issue.id && dragOverTask.position === 'after';

                          return (
                            <div key={issue.id} className="relative group/task">
                              {/* Top insertion line */}
                              {isHoveredBefore && (
                                <div className="absolute -top-1.5 left-0 right-0 h-1 bg-white text-black rounded-full z-20 shadow-[0_0_8px_#FFFFFF]" />
                              )}

                              {/* Branch Connector Guide */}
                              <div className="absolute -left-5 sm:-left-7 top-4 w-5 sm:w-7 h-[2px] bg-[#222222] group-hover/task:bg-white/70 transition-colors" />

                              {/* Task Card Leaf Node */}
                              <div
                                draggable={!isEditingThisIssue}
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('text/plain', issue.id);
                                  e.dataTransfer.setData(
                                    'application/json',
                                    JSON.stringify({
                                      issueId: issue.id,
                                      currentEpic: issue.epic || 'General',
                                    })
                                  );
                                  e.dataTransfer.effectAllowed = 'move';
                                }}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const midY = rect.top + rect.height / 2;
                                  const pos = e.clientY < midY ? 'before' : 'after';
                                  if (!dragOverTask || dragOverTask.issueId !== issue.id || dragOverTask.position !== pos) {
                                    setDragOverTask({ issueId: issue.id, position: pos });
                                  }
                                }}
                                onDragLeave={() => {
                                  setDragOverTask(null);
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const pos = dragOverTask?.position || 'after';
                                  setDragOverTask(null);
                                  setDragOverEpic(null);
                                  const droppedId = extractDroppedIssueId(e);
                                  if (droppedId) {
                                    if (onReorderTaskInFolder) {
                                      onReorderTaskInFolder(droppedId, issue.id, folder.id, folder.name, pos);
                                    } else if (onMoveTaskToFolder) {
                                      onMoveTaskToFolder(droppedId, folder.id, folder.name);
                                    }
                                    setExpandedEpics((prev) => ({ ...prev, [folder.id]: true }));
                                  }
                                }}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setContextMenu({
                                    isOpen: true,
                                    position: { x: e.clientX, y: e.clientY },
                                    issue,
                                  });
                                }}
                                className={`bg-[var(--bg-panel)] border transition-all shadow-sm rounded-lg p-2.5 select-none cursor-pointer ${
                                  isHoveredBefore || isHoveredAfter
                                    ? 'border-[var(--border-secondary)] bg-white/10'
                                    : 'border-[var(--border-primary)] hover:border-[var(--border-secondary)] hover:bg-[#1F1F1F]'
                                }`}
                                onClick={() => {
                                  if (!isEditingThisIssue) onSelectIssue(issue.id);
                                }}
                              >
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  {/* Left: Drag grip, File icon, Key, Title, Priority */}
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <GripVertical size={13} className="text-[var(--text-muted)] hover:text-white shrink-0 opacity-0 group-hover/task:opacity-100 transition-opacity cursor-grab" />
                                    <span className="w-4 h-4 flex items-center justify-center text-[var(--text-muted)] shrink-0">
                                      <FileCode size={12} />
                                    </span>

                                    {/* Issue Key (T1, T2, ... Tn) */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onSelectIssue(issue.id);
                                      }}
                                      className="text-xs font-mono font-bold text-white hover:underline shrink-0 bg-white/10 px-1.5 py-0.5 rounded border border-[var(--border-secondary)]"
                                      title={`Inspect Task Details (${issue.key})`}
                                    >
                                      {getTaskShortId(issue, issues)}
                                    </button>

                                    {/* Priority dot */}
                                    <div
                                      className="flex items-center gap-1 text-[10px] font-mono shrink-0"
                                      title={`Priority: ${priorityCfg.label}`}
                                    >
                                      <span className={`w-1.5 h-1.5 rounded-full ${priorityCfg.dot}`} />
                                      <span className={priorityCfg.color}>{priorityCfg.label}</span>
                                    </div>

                                    {/* Task Title (Inline Editable) */}
                                    {isEditingThisIssue ? (
                                      <div className="flex items-center gap-1 flex-1 max-w-md" onClick={(e) => e.stopPropagation()}>
                                        <input
                                          type="text"
                                          value={editingIssueTitleValue}
                                          onChange={(e) => setEditingIssueTitleValue(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleSaveIssueRename(issue.id, issue.title);
                                            if (e.key === 'Escape') setEditingIssueId(null);
                                          }}
                                          onBlur={() => handleSaveIssueRename(issue.id, issue.title)}
                                          autoFocus
                                          className="w-full bg-[var(--bg-canvas)] border border-[var(--border-secondary)] text-xs text-white px-1.5 py-0.5 rounded outline-none font-semibold"
                                        />
                                        <button
                                          onClick={() => handleSaveIssueRename(issue.id, issue.title)}
                                          className="p-1 hover:bg-[#222222] text-white rounded"
                                        >
                                          <Check size={11} />
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
                                        <span
                                          onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            setEditingIssueTitleValue(issue.title);
                                            setEditingIssueId(issue.id);
                                          }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onSelectIssue(issue.id);
                                          }}
                                          className="text-xs font-semibold text-[var(--text-secondary)] hover:text-white cursor-pointer truncate max-w-md"
                                          title="Click to inspect task details"
                                        >
                                          {issue.title}
                                        </span>

                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingIssueTitleValue(issue.title);
                                            setEditingIssueId(issue.id);
                                          }}
                                          className="opacity-0 group-hover/task:opacity-100 p-0.5 text-[var(--text-muted)] hover:text-white transition-opacity"
                                          title="Rename Task"
                                        >
                                          <Pencil size={10} />
                                        </button>

                                        {/* Tagged Task Pills on Card */}
                                        {issue.tags && issue.tags.length > 0 && (
                                          <div className="hidden sm:flex items-center gap-1 shrink-0 ml-1">
                                            {issue.tags.slice(0, 3).map((tag, tIdx) => (
                                              <span
                                                key={tIdx}
                                                className="text-[9px] font-mono text-white bg-[var(--ramp-3)]/10 border border-[var(--border-secondary)] px-1 py-0.2 rounded"
                                                title={`Related / Tagged: ${tag}`}
                                              >
                                                @{tag.replace(/^@/, '')}
                                              </span>
                                            ))}
                                            {issue.tags.length > 3 && (
                                              <span className="text-[9px] font-mono text-[var(--text-muted)]">
                                                +{issue.tags.length - 3}
                                              </span>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {/* Right: Added Timing, Status Pill, Assignee & Actions */}
                                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                                    {/* Added Timing Badge */}
                                    {issue.createdAt && (
                                      <span
                                        className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-panel)] px-1.5 py-0.5 rounded border border-[#282828] flex items-center gap-1 shrink-0"
                                        title={formatExactDateTime(issue.createdAt)}
                                      >
                                        <Clock size={10} className="text-white shrink-0" />
                                        <span>{formatAddedTiming(issue.createdAt)}</span>
                                      </span>
                                    )}

                                    {/* Status Switcher Dropdown */}
                                    <CustomDropdown<Status>
                                      value={issue.status}
                                      onChange={(val) => onUpdateIssueStatus && onUpdateIssueStatus(issue.id, val)}
                                      options={[
                                        { value: 'todo', label: 'Todo' },
                                        { value: 'in_progress', label: 'In Progress' },
                                        { value: 'needs_review', label: 'Needs Review' },
                                        { value: 'done', label: 'Done' },
                                      ]}
                                      triggerClassName={`text-[11px] font-semibold px-2 py-0.5 rounded border bg-[var(--bg-canvas)] ${statusCfg.text} ${statusCfg.border}`}
                                      size="xs"
                                      showChevron={false}
                                      align="right"
                                    />

                                    {/* Assignee Avatar */}
                                    {issue.assignee && (
                                      <div className="shrink-0" title={`Assignee: ${issue.assignee.name}`}>
                                        <Avatar user={issue.assignee} size="xs" />
                                      </div>
                                    )}

                                    {/* Delete Task Button */}
                                    {canDelete && onDeleteIssue && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onDeleteIssue(issue.id);
                                        }}
                                        className="opacity-0 group-hover/task:opacity-100 p-1 hover:bg-[var(--ramp-3)]/15 rounded text-[var(--text-muted)] hover:text-white transition-all"
                                        title="Delete Task"
                                      >
                                        <Trash2 size={11} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Bottom insertion line */}
                              {isHoveredAfter && (
                                <div className="absolute -bottom-1.5 left-0 right-0 h-1 bg-white text-black rounded-full z-20 shadow-[0_0_8px_#FFFFFF]" />
                              )}
                            </div>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          {/* Empty State */}
          {filteredIssues.length === 0 && (
            <div className="p-8 text-center bg-[var(--bg-canvas)] border border-[var(--border-primary)] rounded-xl text-[var(--text-muted)]">
              <FolderTree size={28} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold text-[var(--text-secondary)]">No tasks matched your search or filters</p>
              <p className="text-xs mt-1">Try changing your search query or status filter.</p>
            </div>
          )}
        </div>
      </div>

      {/* Task Right-Click Context Menu */}
      <TaskContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        issue={contextMenu.issue}
        onClose={() => setContextMenu((prev) => ({ ...prev, isOpen: false }))}
        onEdit={(issue) => onSelectIssue(issue.id)}
        onDelete={onDeleteIssue}
        onUpdateStatus={onUpdateIssueStatus}
        onUpdatePriority={onUpdateIssuePriority}
        canDelete={canDelete}
      />

      {/* Delete Folder Confirmation Dialog */}
      <AnimatePresence>
        {folderToDelete && (
          <div 
            role="dialog"
            aria-modal="true"
            aria-label="Delete Folder Confirmation"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-[var(--bg-panel)] border border-[var(--border-primary)] rounded-2xl shadow-2xl overflow-hidden p-5 space-y-4"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--ramp-3)]/15 border border-[var(--border-secondary)] flex items-center justify-center text-white shrink-0">
                    <Trash2 size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Delete Folder</h3>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      Folder: <span className="text-white font-semibold font-mono">📁 {folderToDelete.folderName}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setFolderToDelete(null)}
                  className="text-[var(--text-muted)] hover:text-white p-1 rounded-lg transition-colors"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Content Body */}
              {folderToDelete.taskCount > 0 ? (
                <div className="space-y-3">
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    This folder currently contains <span className="text-white font-bold">{folderToDelete.taskCount} {folderToDelete.taskCount === 1 ? 'task' : 'tasks'}</span>. What would you like to do?
                  </p>

                  <div className="grid grid-cols-1 gap-2.5">
                    {/* Option 1: Delete Folder Only (Move tasks to General) */}
                    <button
                      type="button"
                      onClick={() => {
                        const targetId = folderToDelete.folderEntityId || folderToDelete.folderName;
                        if (onDeleteFolder) {
                          onDeleteFolder(targetId, folderToDelete.folderName, false);
                        } else if (folderToDelete.folderEntityId && onDeleteIssue) {
                          onDeleteIssue(folderToDelete.folderEntityId);
                        }
                        setFolderToDelete(null);
                      }}
                      className="flex items-start gap-3 p-3 bg-[var(--bg-panel)] hover:bg-[var(--bg-card)] border border-[var(--border-primary)] hover:border-[var(--border-secondary)] rounded-xl transition-all text-left group cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-lg bg-white/10 text-white flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                        <FolderOpen size={15} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-white group-hover:text-white transition-colors flex items-center gap-1.5 flex-wrap">
                          <span>Delete Folder Only</span>
                          <span className="text-[10px] font-mono bg-white/15 text-white px-1.5 py-0.2 rounded font-bold">Recommended</span>
                        </div>
                        <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">
                          Keep all {folderToDelete.taskCount} task(s) and move them safely into the <strong className="text-[var(--text-secondary)]">General</strong> folder.
                        </p>
                      </div>
                    </button>

                    {/* Option 2: Delete Folder AND All Tasks */}
                    <button
                      type="button"
                      onClick={() => {
                        const targetId = folderToDelete.folderEntityId || folderToDelete.folderName;
                        if (onDeleteFolder) {
                          onDeleteFolder(targetId, folderToDelete.folderName, true);
                        } else if (folderToDelete.folderEntityId && onDeleteIssue) {
                          onDeleteIssue(folderToDelete.folderEntityId);
                        }
                        setFolderToDelete(null);
                      }}
                      className="flex items-start gap-3 p-3 bg-[var(--bg-panel)] hover:bg-[var(--ramp-3)]/10 border border-[var(--border-primary)] hover:border-[var(--border-secondary)] rounded-xl transition-all text-left group cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-lg bg-[var(--ramp-3)]/10 text-white flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                        <Trash2 size={15} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-white">
                          Delete Folder & All {folderToDelete.taskCount} Tasks
                        </div>
                        <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">
                          Permanently delete this folder and all tasks inside it.
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-[var(--text-secondary)]">
                    Are you sure you want to delete the empty folder <strong className="text-white">&quot;{folderToDelete.folderName}&quot;</strong>?
                  </p>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setFolderToDelete(null)}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-white bg-[var(--bg-panel)] border border-[var(--border-primary)] transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const targetId = folderToDelete.folderEntityId || folderToDelete.folderName;
                        if (onDeleteFolder) {
                          onDeleteFolder(targetId, folderToDelete.folderName, false);
                        } else if (folderToDelete.folderEntityId && onDeleteIssue) {
                          onDeleteIssue(folderToDelete.folderEntityId);
                        }
                        setFolderToDelete(null);
                      }}
                      className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-[var(--ramp-3)] hover:bg-[#FFFFFF] transition-colors shadow-sm cursor-pointer"
                    >
                      Delete Folder
                    </button>
                  </div>
                </div>
              )}

              {/* Footer cancel button if taskCount > 0 */}
              {folderToDelete.taskCount > 0 && (
                <div className="flex items-center justify-end pt-2 border-t border-[var(--border-primary)]">
                  <button
                    type="button"
                    onClick={() => setFolderToDelete(null)}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-white bg-[var(--bg-panel)] hover:bg-[#282828] border border-[var(--border-primary)] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
});

TreeView.displayName = 'TreeView';
