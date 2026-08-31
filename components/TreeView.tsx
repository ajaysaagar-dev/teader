'use client';

import React, { useState, useMemo } from 'react';
import { Issue, Status, Priority, Subtask } from '@/lib/types';
import { Avatar } from './ui/Avatar';
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
  TaskMentionOption 
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
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; icon: any }> = {
  todo: { label: 'Todo', bg: 'bg-[#787C83]/10', text: 'text-[#787C83]', border: 'border-[#787C83]/30', icon: Circle },
  in_progress: { label: 'In Progress', bg: 'bg-[#DCB001]/10', text: 'text-[#DCB001]', border: 'border-[#DCB001]/30', icon: Clock },
  needs_review: { label: 'Needs Review', bg: 'bg-[#A855F7]/10', text: 'text-[#A855F7]', border: 'border-[#A855F7]/30', icon: AlertCircle },
  done: { label: 'Done', bg: 'bg-[#22C55E]/10', text: 'text-[#22C55E]', border: 'border-[#22C55E]/30', icon: CheckCircle2 },
  blocked: { label: 'Blocked', bg: 'bg-[#EF4444]/10', text: 'text-[#EF4444]', border: 'border-[#EF4444]/30', icon: AlertCircle },
  cancelled: { label: 'Cancelled', bg: 'bg-[#787C83]/10', text: 'text-[#787C83]', border: 'border-[#787C83]/30', icon: Circle },
  merged: { label: 'Merged', bg: 'bg-[#A855F7]/10', text: 'text-[#A855F7]', border: 'border-[#A855F7]/30', icon: CheckCircle2 },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  none: { label: 'None', color: 'text-[#787C83]', dot: 'bg-[#787C83]' },
  low: { label: 'Low', color: 'text-[#787C83]', dot: 'bg-[#787C83]' },
  medium: { label: 'Medium', color: 'text-[#3B82F6]', dot: 'bg-[#3B82F6]' },
  high: { label: 'High', color: 'text-[#F97316]', dot: 'bg-[#F97316]' },
  critical: { label: 'Critical', color: 'text-[#EF4444]', dot: 'bg-[#EF4444]' },
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
    <div className="flex-1 flex flex-col h-full min-h-0 w-full bg-[#0F1011] overflow-hidden">
      {/* Top Toolbar */}
      <div className="h-11 px-4 bg-[#131415] border-b border-[#2A2C30] flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#CFD4DD]">
            <FolderTree size={15} className="text-[#DCB001]" />
            <span className="font-bold">Project Tree Explorer</span>
          </div>

          <div className="h-4 w-[1px] bg-[#2A2C30] hidden sm:block" />

          {/* Quick Search */}
          <div className="relative w-48 sm:w-64">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#787C83]" />
            <input
              type="text"
              placeholder="Search tree nodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#17181A] border border-[#2A2C30] focus:border-[#DCB001]/60 rounded-md pl-7 pr-2.5 py-1 text-xs text-[#CFD4DD] placeholder-[#787C83] outline-none"
            />
          </div>

          {/* Status Filter */}
          <div className="hidden md:flex items-center gap-1 bg-[#17181A] border border-[#2A2C30] rounded-md p-0.5 text-[11px]">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2 py-0.5 rounded font-medium transition-colors ${
                statusFilter === 'all' ? 'bg-[#2A2C30] text-[#DCB001]' : 'text-[#787C83] hover:text-[#CFD4DD]'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('in_progress')}
              className={`px-2 py-0.5 rounded font-medium transition-colors ${
                statusFilter === 'in_progress' ? 'bg-[#2A2C30] text-[#DCB001]' : 'text-[#787C83] hover:text-[#CFD4DD]'
              }`}
            >
              In Progress
            </button>
            <button
              onClick={() => setStatusFilter('needs_review')}
              className={`px-2 py-0.5 rounded font-medium transition-colors ${
                statusFilter === 'needs_review' ? 'bg-[#2A2C30] text-[#A855F7]' : 'text-[#787C83] hover:text-[#CFD4DD]'
              }`}
            >
              Review
            </button>
            <button
              onClick={() => setStatusFilter('done')}
              className={`px-2 py-0.5 rounded font-medium transition-colors ${
                statusFilter === 'done' ? 'bg-[#2A2C30] text-[#22C55E]' : 'text-[#787C83] hover:text-[#CFD4DD]'
              }`}
            >
              Done
            </button>
          </div>
        </div>

        {/* Right Tools: Expand/Collapse & Progress */}
        <div className="flex items-center gap-2 text-xs">
          {/* Progress metric */}
          <div className="hidden lg:flex items-center gap-2 bg-[#17181A] border border-[#2A2C30] px-2.5 py-1 rounded-md text-[11px] font-mono">
            <span className="text-[#787C83]">Sub-works:</span>
            <span className="text-[#22C55E] font-bold">{totalCounts.completed}</span>
            <span className="text-[#787C83]">/</span>
            <span className="text-[#CFD4DD]">{totalCounts.total}</span>
            <div className="w-12 h-1.5 bg-[#2A2C30] rounded-full overflow-hidden ml-1">
              <div
                className="h-full bg-[#22C55E] transition-all duration-300"
                style={{ width: `${overallProgressPercent}%` }}
              />
            </div>
            <span className="text-[#DCB001] font-bold">{overallProgressPercent}%</span>
          </div>

          <button
            onClick={expandAll}
            className="flex items-center gap-1 px-2 py-1 bg-[#17181A] hover:bg-[#222427] border border-[#2A2C30] rounded text-[11px] text-[#787C83] hover:text-[#CFD4DD] transition-colors"
            title="Expand All Nodes"
          >
            <Maximize2 size={11} />
            <span className="hidden sm:inline">Expand All</span>
          </button>

          <button
            onClick={collapseAll}
            className="flex items-center gap-1 px-2 py-1 bg-[#17181A] hover:bg-[#222427] border border-[#2A2C30] rounded text-[11px] text-[#787C83] hover:text-[#CFD4DD] transition-colors"
            title="Collapse All Nodes"
          >
            <Minimize2 size={11} />
            <span className="hidden sm:inline">Collapse</span>
          </button>

          {(onOpenNewIssue || onOpenNewFolder) && (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={onOpenNewFolder || onOpenNewIssue}
                className="flex items-center gap-1 px-2.5 py-1 bg-[#1A1B1D] hover:bg-[#25272B] border border-[#2A2C30] hover:border-[#DCB001]/50 text-[#CFD4DD] hover:text-[#DCB001] font-bold text-xs rounded transition-all shrink-0"
                title="Create New Folder / Group"
              >
                <FolderPlus size={13} />
                <span>+ Folder</span>
              </button>
              <button
                onClick={onOpenNewIssue}
                className="flex items-center gap-1 px-2.5 py-1 bg-[#DCB001] hover:bg-[#c49c00] text-[#0F1011] font-bold text-xs rounded shadow-sm transition-all shrink-0"
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
          <div className="relative flex items-center gap-3 p-3 bg-[#17181A] border border-[#2A2C30] rounded-xl shadow-lg group">
            <div className="w-8 h-8 rounded-lg bg-[#DCB001]/15 border border-[#DCB001]/30 flex items-center justify-center text-[#DCB001] shadow-inner shrink-0">
              <Layers size={18} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold px-1.5 py-0.5 bg-[#131415] border border-[#2A2C30] text-[#DCB001] rounded">
                  {projectKey}
                </span>
                <h2 className="text-sm md:text-base font-bold text-white truncate">{projectName}</h2>
                <span className="text-[11px] font-mono text-[#787C83] px-2 py-0.5 bg-[#131415] rounded-full border border-[#2A2C30]">
                  {issues.length} Tasks &bull; {folderContainers.length} Folders &bull; {totalCounts.total} Sub-items
                </span>
              </div>
            </div>

            {/* Tree Branch Anchor */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#787C83] font-mono">
              <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
              <span>Active Drag & Drop Tree</span>
            </div>
          </div>

          {/* TREE LEVEL 1: Epics & Domains */}
          <div className="relative pl-4 sm:pl-6 border-l-2 border-[#2A2C30] ml-4 sm:ml-6 space-y-4">
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

              let folderCardClasses = 'bg-[#131415] hover:bg-[#1A1B1E] border border-[#2A2C30] hover:border-[#DCB001]/40';
              let folderIconClasses = 'bg-[#DCB001]/10 text-[#DCB001]';

              if (dragOverEpic === folder.id) {
                folderCardClasses = 'bg-[#DCB001]/20 border-2 border-dashed border-[#DCB001] scale-[1.01]';
              } else if (isNoneDone) {
                // Highlight with Amber / Warm Orange alert when all tasks in folder are not done yet
                folderCardClasses = 'bg-[#16130D] hover:bg-[#1C1810] border border-[#F59E0B]/40 shadow-[inset_3px_0_0_#F59E0B]';
                folderIconClasses = 'bg-[#F59E0B]/15 text-[#F59E0B]';
              } else if (isPartiallyDone) {
                // Highlight with Electric Cyan / Sky Blue progress when some tasks are completed but not all
                folderCardClasses = 'bg-[#0B141D] hover:bg-[#0E1A26] border border-[#0EA5E9]/45 shadow-[inset_3px_0_0_#0EA5E9]';
                folderIconClasses = 'bg-[#0EA5E9]/15 text-[#38BDF8]';
              } else if (isAllDone) {
                // Highlight with Emerald Green when all tasks in folder are fully done
                folderCardClasses = 'bg-[#0A160F] hover:bg-[#0D1E14] border border-[#22C55E]/40 shadow-[inset_3px_0_0_#22C55E]';
                folderIconClasses = 'bg-[#22C55E]/15 text-[#22C55E]';
              }

              return (
                <div key={folder.id} className="relative group/epic">
                  {/* Branch Connector Guide */}
                  <div className="absolute -left-4 sm:-left-6 top-4 w-4 sm:w-6 h-[2px] bg-[#2A2C30] group-hover/epic:bg-[#DCB001]/60 transition-colors" />

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
                        className="text-[#787C83] group-hover:text-[#DCB001] transition-colors p-0.5 cursor-pointer"
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
                            className="bg-[#17181A] border border-[#DCB001] text-xs font-bold text-white px-2 py-0.5 rounded outline-none w-full"
                          />
                          <button
                            onClick={() => handleSaveEpicRename(folder)}
                            className="p-1 hover:bg-[#2A2C30] text-[#22C55E] rounded cursor-pointer"
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
                            className="font-bold text-xs md:text-sm text-[#CFD4DD] group-hover:text-white truncate"
                            title={isGeneralFolder ? 'General (Default Common Folder)' : 'Double click to rename folder'}
                          >
                            {folder.name}
                          </span>

                          {/* Created Date and Time Badge */}
                          {folder.createdAt && (
                            <span
                              className="text-[10px] font-mono text-[#9BA1A6] bg-[#17181A] px-2 py-0.5 rounded border border-[#2A2C30] flex items-center gap-1 shrink-0"
                              title={`Created on ${formatFolderDateTime(folder.createdAt, folder.id)}`}
                            >
                              <Calendar size={10} className="text-[#DCB001]" />
                              <span>{formatFolderDateTime(folder.createdAt, folder.id)}</span>
                            </span>
                          )}

                          {isGeneralFolder ? (
                            <span className="text-[9px] font-mono text-[#DCB001] bg-[#DCB001]/10 border border-[#DCB001]/30 px-1.5 py-0.2 rounded font-bold shrink-0">
                              DEFAULT
                            </span>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingEpicValue(folder.name);
                                setEditingEpicId(folder.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-[#787C83] hover:text-[#DCB001] transition-opacity cursor-pointer"
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
                          className="text-[10px] font-mono font-bold text-[#F59E0B] bg-[#F59E0B]/15 px-2 py-0.5 rounded-full border border-[#F59E0B]/35 flex items-center gap-1.5 shrink-0 ml-auto sm:ml-0"
                          title="All tasks in this folder are not done yet (0% completed)"
                        >
                          <Circle size={10} className="text-[#F59E0B]" />
                          <span>0/{epicTotal} Done (Pending)</span>
                        </span>
                      ) : isPartiallyDone ? (
                        <div className="flex items-center gap-1.5 shrink-0 ml-auto sm:ml-0">
                          <span
                            className="text-[10px] font-mono font-bold text-[#38BDF8] bg-[#0EA5E9]/15 px-2 py-0.5 rounded-full border border-[#0EA5E9]/40 flex items-center gap-1.5"
                            title={`${epicDone} of ${epicTotal} tasks completed (${epicProgress}%)`}
                          >
                            <Clock size={10} className="text-[#38BDF8] animate-pulse" />
                            <span>{epicDone}/{epicTotal} Done ({epicProgress}%)</span>
                          </span>
                          <div className="hidden sm:block w-12 h-1.5 bg-[#142334] rounded-full overflow-hidden border border-[#0EA5E9]/30" title={`${epicProgress}% completed`}>
                            <div className="h-full bg-[#38BDF8] rounded-full transition-all duration-300" style={{ width: `${epicProgress}%` }} />
                          </div>
                        </div>
                      ) : isAllDone ? (
                        <span
                          className="text-[10px] font-mono font-bold text-[#22C55E] bg-[#22C55E]/15 px-2 py-0.5 rounded-full border border-[#22C55E]/40 flex items-center gap-1.5 shrink-0 ml-auto sm:ml-0"
                          title="All tasks in this folder are 100% completed!"
                        >
                          <CheckCircle2 size={10} className="text-[#22C55E]" />
                          <span>{epicDone}/{epicTotal} Done (100%)</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-[#787C83] bg-[#17181A] px-2 py-0.5 rounded-full border border-[#2A2C30] shrink-0 ml-auto sm:ml-0">
                          0 tasks (Empty)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {dragOverEpic === folder.id ? (
                        <span className="text-[11px] font-bold text-[#DCB001] font-mono animate-pulse">
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
                            className="flex items-center gap-1 px-2 py-0.5 bg-[#17181A] hover:bg-[#25272B] border border-[#2A2C30] hover:border-[#DCB001]/50 text-[#CFD4DD] hover:text-[#DCB001] text-[11px] font-medium rounded transition-colors cursor-pointer"
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
                              className="p-1 hover:bg-[#EF4444]/15 rounded text-[#787C83] hover:text-[#EF4444] transition-all opacity-0 group-hover/epic:opacity-100 cursor-pointer"
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
                    <div className="relative pl-5 sm:pl-7 border-l-2 border-[#2A2C30]/70 ml-3 sm:ml-4 mt-2.5">
                      <div className="flex items-center gap-2 bg-[#17181A] border border-[#DCB001]/60 rounded-lg p-2 shadow-sm">
                        <FileCode size={13} className="text-[#DCB001] shrink-0" />
                        <input
                          type="text"
                          placeholder={`Enter task title inside folder "${folder.name}" (type @ to tag)...`}
                          value={newTaskInFolderTitle}
                          onChange={(e) => handleInlineTaskChange(e.target.value, e.target.selectionStart ?? e.target.value.length)}
                          onKeyDown={(e) => handleInlineTaskKeyDown(e, folder.id, folder.name)}
                          autoFocus
                          className="flex-1 bg-transparent text-xs text-white placeholder-[#787C83] outline-none"
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
                          className="px-2.5 py-1 bg-[#DCB001] hover:bg-[#c49c00] text-[#0F1011] font-bold text-xs rounded transition-colors cursor-pointer"
                        >
                          Add Task
                        </button>
                        <button
                          onClick={() => {
                            setActiveFolderTaskInput(null);
                            setNewTaskInFolderTitle('');
                            setInlineMentionState((prev) => ({ ...prev, active: false }));
                          }}
                          className="px-2 py-1 text-xs text-[#787C83] hover:text-[#CFD4DD] transition-colors cursor-pointer"
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
                        className="pl-5 sm:pl-7 border-l-2 border-[#2A2C30]/70 ml-3 sm:ml-4 mt-2.5 space-y-2.5 min-h-[30px]"
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
                                ? 'border-[#DCB001] bg-[#DCB001]/10 text-[#DCB001]'
                                : 'border-[#2A2C30] text-[#787C83]'
                            }`}
                          >
                            <span>📁 Folder is empty. Drag and drop tasks here or </span>
                            <button
                              onClick={() => {
                                setExpandedEpics((prev) => ({ ...prev, [folder.id]: true }));
                                setActiveFolderTaskInput(folder.id);
                              }}
                              className="text-[#DCB001] underline ml-1 font-bold hover:text-white cursor-pointer"
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
                                <div className="absolute -top-1.5 left-0 right-0 h-1 bg-[#DCB001] rounded-full z-20 shadow-[0_0_8px_#DCB001]" />
                              )}

                              {/* Branch Connector Guide */}
                              <div className="absolute -left-5 sm:-left-7 top-4 w-5 sm:w-7 h-[2px] bg-[#2A2C30] group-hover/task:bg-[#DCB001]/70 transition-colors" />

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
                                className={`bg-[#17181A] border transition-all shadow-sm rounded-lg p-2.5 select-none cursor-pointer ${
                                  isHoveredBefore || isHoveredAfter
                                    ? 'border-[#DCB001] bg-[#DCB001]/10'
                                    : 'border-[#2A2C30] hover:border-[#DCB001]/50 hover:bg-[#1C1E22]'
                                }`}
                                onClick={() => {
                                  if (!isEditingThisIssue) onSelectIssue(issue.id);
                                }}
                              >
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  {/* Left: Drag grip, File icon, Key, Title, Priority */}
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <GripVertical size={13} className="text-[#787C83] hover:text-[#DCB001] shrink-0 opacity-0 group-hover/task:opacity-100 transition-opacity cursor-grab" />
                                    <span className="w-4 h-4 flex items-center justify-center text-[#787C83] shrink-0">
                                      <FileCode size={12} />
                                    </span>

                                    {/* Issue Key (T1, T2, ... Tn) */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onSelectIssue(issue.id);
                                      }}
                                      className="text-xs font-mono font-bold text-[#DCB001] hover:underline shrink-0 bg-[#DCB001]/10 px-1.5 py-0.5 rounded border border-[#DCB001]/30"
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
                                          className="w-full bg-[#131415] border border-[#DCB001] text-xs text-white px-1.5 py-0.5 rounded outline-none font-semibold"
                                        />
                                        <button
                                          onClick={() => handleSaveIssueRename(issue.id, issue.title)}
                                          className="p-1 hover:bg-[#2A2C30] text-[#22C55E] rounded"
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
                                          className="text-xs font-semibold text-[#CFD4DD] hover:text-white cursor-pointer truncate max-w-md"
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
                                          className="opacity-0 group-hover/task:opacity-100 p-0.5 text-[#787C83] hover:text-[#DCB001] transition-opacity"
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
                                                className="text-[9px] font-mono text-[#38BDF8] bg-[#38BDF8]/10 border border-[#38BDF8]/30 px-1 py-0.2 rounded"
                                                title={`Related / Tagged: ${tag}`}
                                              >
                                                @{tag.replace(/^@/, '')}
                                              </span>
                                            ))}
                                            {issue.tags.length > 3 && (
                                              <span className="text-[9px] font-mono text-[#787C83]">
                                                +{issue.tags.length - 3}
                                              </span>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {/* Right: Status Pill, Assignee & Actions */}
                                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                                    {/* Status Switcher Dropdown */}
                                    <select
                                      value={issue.status}
                                      onChange={(e) => onUpdateIssueStatus && onUpdateIssueStatus(issue.id, e.target.value as Status)}
                                      className={`text-[11px] font-semibold px-2 py-0.5 rounded border outline-none cursor-pointer bg-[#131415] ${statusCfg.text} ${statusCfg.border}`}
                                    >
                                      <option value="todo">Todo</option>
                                      <option value="in_progress">In Progress</option>
                                      <option value="needs_review">Needs Review</option>
                                      <option value="done">Done</option>
                                    </select>

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
                                        className="opacity-0 group-hover/task:opacity-100 p-1 hover:bg-[#EF4444]/15 rounded text-[#787C83] hover:text-[#EF4444] transition-all"
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
                                <div className="absolute -bottom-1.5 left-0 right-0 h-1 bg-[#DCB001] rounded-full z-20 shadow-[0_0_8px_#DCB001]" />
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
            <div className="p-8 text-center bg-[#131415] border border-[#2A2C30] rounded-xl text-[#787C83]">
              <FolderTree size={28} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold text-[#CFD4DD]">No tasks matched your search or filters</p>
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
              className="w-full max-w-md bg-[#1B1C1F] border border-[#2A2C30] rounded-2xl shadow-2xl overflow-hidden p-5 space-y-4"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/30 flex items-center justify-center text-[#EF4444] shrink-0">
                    <Trash2 size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Delete Folder</h3>
                    <p className="text-xs text-[#787C83] mt-0.5">
                      Folder: <span className="text-[#DCB001] font-semibold font-mono">📁 {folderToDelete.folderName}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setFolderToDelete(null)}
                  className="text-[#787C83] hover:text-white p-1 rounded-lg transition-colors"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Content Body */}
              {folderToDelete.taskCount > 0 ? (
                <div className="space-y-3">
                  <p className="text-xs text-[#CFD4DD] leading-relaxed">
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
                      className="flex items-start gap-3 p-3 bg-[#17181A] hover:bg-[#222428] border border-[#2A2C30] hover:border-[#DCB001]/60 rounded-xl transition-all text-left group cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-lg bg-[#DCB001]/10 text-[#DCB001] flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                        <FolderOpen size={15} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-white group-hover:text-[#DCB001] transition-colors flex items-center gap-1.5 flex-wrap">
                          <span>Delete Folder Only</span>
                          <span className="text-[10px] font-mono bg-[#DCB001]/15 text-[#DCB001] px-1.5 py-0.2 rounded font-bold">Recommended</span>
                        </div>
                        <p className="text-[11px] text-[#787C83] mt-0.5 leading-snug">
                          Keep all {folderToDelete.taskCount} task(s) and move them safely into the <strong className="text-[#CFD4DD]">General</strong> folder.
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
                      className="flex items-start gap-3 p-3 bg-[#17181A] hover:bg-[#EF4444]/10 border border-[#2A2C30] hover:border-[#EF4444]/60 rounded-xl transition-all text-left group cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-lg bg-[#EF4444]/10 text-[#EF4444] flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                        <Trash2 size={15} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-[#EF4444]">
                          Delete Folder & All {folderToDelete.taskCount} Tasks
                        </div>
                        <p className="text-[11px] text-[#787C83] mt-0.5 leading-snug">
                          Permanently delete this folder and all tasks inside it.
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-[#CFD4DD]">
                    Are you sure you want to delete the empty folder <strong className="text-white">&quot;{folderToDelete.folderName}&quot;</strong>?
                  </p>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setFolderToDelete(null)}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#787C83] hover:text-white bg-[#17181A] border border-[#2A2C30] transition-colors cursor-pointer"
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
                      className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-[#EF4444] hover:bg-[#dc2626] transition-colors shadow-sm cursor-pointer"
                    >
                      Delete Folder
                    </button>
                  </div>
                </div>
              )}

              {/* Footer cancel button if taskCount > 0 */}
              {folderToDelete.taskCount > 0 && (
                <div className="flex items-center justify-end pt-2 border-t border-[#2A2C30]">
                  <button
                    type="button"
                    onClick={() => setFolderToDelete(null)}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#787C83] hover:text-white bg-[#17181A] hover:bg-[#25272B] border border-[#2A2C30] transition-colors"
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
