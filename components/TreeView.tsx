'use client';

import React, { useState, useMemo } from 'react';
import { Issue, Status, Priority, Subtask } from '@/lib/types';
import { Avatar } from './ui/Avatar';
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
  CornerDownRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface TreeViewProps {
  issues: Issue[];
  projectName?: string;
  projectKey?: string;
  onSelectIssue: (id: string) => void;
  onUpdateIssueStatus?: (id: string, status: Status) => void;
  onOpenNewIssue?: () => void;
  onToggleSubtask?: (issueId: string, subtaskId: string, nextCompleted: boolean) => void;
  onAddSubtask?: (
    issueId: string,
    title: string,
    parentId?: string | null,
    isFolder?: boolean,
    type?: 'folder' | 'subtask'
  ) => void;
  onDeleteSubtask?: (issueId: string, subtaskId: string) => void;
  onRenameSubtask?: (issueId: string, subtaskId: string, newTitle: string) => void;
  onMoveSubtask?: (subtaskId: string, newParentId: string | null, targetIssueId: string) => void;
  onRenameIssue?: (issueId: string, newTitle: string) => void;
  onRenameEpic?: (oldEpicName: string, newEpicName: string) => void;
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

function countNestedSubtasks(subtasks?: Subtask[]): { total: number; completed: number } {
  if (!subtasks || subtasks.length === 0) return { total: 0, completed: 0 };
  let total = 0;
  let completed = 0;
  for (const st of subtasks) {
    if (!st.isFolder) {
      total += 1;
      if (st.completed) completed += 1;
    }
    if (st.subtasks && st.subtasks.length > 0) {
      const childCounts = countNestedSubtasks(st.subtasks);
      total += childCounts.total;
      completed += childCounts.completed;
    }
  }
  return { total, completed };
}

function isDescendant(targetSubId: string, node: Subtask): boolean {
  if (node.id === targetSubId) return true;
  if (node.subtasks) {
    for (const child of node.subtasks) {
      if (isDescendant(targetSubId, child)) return true;
    }
  }
  return false;
}

// Infinite Recursive Subtask & Folder Node Component
const RecursiveSubtaskNode: React.FC<{
  node: Subtask;
  issueId: string;
  level?: number;
  onToggleSubtask?: (issueId: string, subtaskId: string, nextCompleted: boolean) => void;
  onAddSubtask?: (
    issueId: string,
    title: string,
    parentId?: string | null,
    isFolder?: boolean,
    type?: 'folder' | 'subtask'
  ) => void;
  onDeleteSubtask?: (issueId: string, subtaskId: string) => void;
  onRenameSubtask?: (issueId: string, subtaskId: string, newTitle: string) => void;
  onMoveSubtask?: (subtaskId: string, newParentId: string | null, targetIssueId: string) => void;
}> = ({
  node,
  issueId,
  level = 0,
  onToggleSubtask,
  onAddSubtask,
  onDeleteSubtask,
  onRenameSubtask,
  onMoveSubtask,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeInputType, setActiveInputType] = useState<'subtask' | 'folder' | null>(null);
  const [inputTitle, setInputTitle] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState(node.title);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const children = node.subtasks || [];
  const hasChildren = children.length > 0;
  const isFolder = Boolean(node.isFolder || node.type === 'folder');
  const counts = countNestedSubtasks(children);

  const handleCreateChild = () => {
    const text = inputTitle.trim();
    if (!text || !onAddSubtask) return;
    onAddSubtask(issueId, text, node.id, activeInputType === 'folder', activeInputType || 'subtask');
    setInputTitle('');
    setActiveInputType(null);
    setIsExpanded(true);
  };

  const handleSaveRename = () => {
    const trimmed = editTitleValue.trim();
    if (trimmed && trimmed !== node.title && onRenameSubtask) {
      onRenameSubtask(issueId, node.id, trimmed);
    } else {
      setEditTitleValue(node.title);
    }
    setIsEditingTitle(false);
  };

  // Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent) => {
    if (isEditingTitle) return;
    setIsDragging(true);
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        subId: node.id,
        isFolder,
        sourceIssueId: issueId,
      })
    );
    e.dataTransfer.effectAllowed = 'move';
    e.stopPropagation();
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setIsDragging(false);
    setIsDragOver(false);
    e.stopPropagation();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (!data || !data.subId) return;

      if (data.subId === node.id) return; // Cannot drop onto itself

      // Prevent dropping a folder into its own child/descendant
      if (isDescendant(data.subId, node)) {
        toast.error('Cannot move an item into its own child hierarchy');
        return;
      }

      if (onMoveSubtask) {
        onMoveSubtask(data.subId, node.id, issueId);
        setIsExpanded(true);
      }
    } catch {}
  };

  return (
    <div
      draggable={!isEditingTitle}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative group/node select-none transition-all ${
        isDragging ? 'opacity-40 scale-[0.98]' : 'opacity-100'
      }`}
    >
      {/* Branch Connector Line */}
      <div className="absolute -left-4 sm:-left-5 top-3.5 w-4 sm:w-5 h-[1px] bg-[#2A2C30] group-hover/node:bg-[#DCB001]/60 transition-colors" />

      <div
        className={`flex items-center justify-between gap-2 py-1 px-2 rounded transition-all ${
          isDragOver
            ? 'bg-[#DCB001]/20 border-2 border-dashed border-[#DCB001] shadow-lg'
            : isFolder
            ? 'bg-[#151618] hover:bg-[#1C1D20] border border-[#2A2C30]/80'
            : 'hover:bg-[#1F2023] border border-transparent'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {/* Drag Handle */}
          <span
            className="cursor-grab active:cursor-grabbing text-[#787C83] hover:text-[#DCB001] opacity-0 group-hover/node:opacity-100 transition-opacity p-0.5"
            title="Drag to switch parent"
          >
            <GripVertical size={11} />
          </span>

          {/* Folder / Subtask Toggle or Icon */}
          {isFolder ? (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-[#DCB001] hover:text-[#ffd633] p-0.5 transition-colors flex items-center gap-1"
            >
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {isExpanded ? <FolderOpen size={13} /> : <Folder size={13} />}
            </button>
          ) : (
            <button
              onClick={() => onToggleSubtask && onToggleSubtask(issueId, node.id, !node.completed)}
              className="text-[#787C83] hover:text-[#DCB001] p-0.5 transition-colors"
            >
              {node.completed ? (
                <CheckSquare size={13} className="text-[#22C55E]" />
              ) : (
                <Square size={13} />
              )}
            </button>
          )}

          {/* Node Title (Inline Editable) */}
          {isEditingTitle ? (
            <div className="flex items-center gap-1 flex-1">
              <input
                type="text"
                value={editTitleValue}
                onChange={(e) => setEditTitleValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveRename();
                  if (e.key === 'Escape') {
                    setEditTitleValue(node.title);
                    setIsEditingTitle(false);
                  }
                }}
                onBlur={handleSaveRename}
                autoFocus
                className="w-full bg-[#131415] border border-[#DCB001] text-xs text-white px-1.5 py-0.5 rounded outline-none font-medium"
              />
              <button
                onClick={handleSaveRename}
                className="p-1 hover:bg-[#2A2C30] text-[#22C55E] rounded"
              >
                <Check size={11} />
              </button>
              <button
                onClick={() => {
                  setEditTitleValue(node.title);
                  setIsEditingTitle(false);
                }}
                className="p-1 hover:bg-[#2A2C30] text-[#EF4444] rounded"
              >
                <X size={11} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
              <span
                onDoubleClick={() => {
                  setEditTitleValue(node.title);
                  setIsEditingTitle(true);
                }}
                onClick={() => {
                  if (isFolder) setIsExpanded(!isExpanded);
                  else if (onToggleSubtask) onToggleSubtask(issueId, node.id, !node.completed);
                }}
                className={`text-xs truncate cursor-pointer ${
                  isFolder
                    ? 'font-bold text-[#E5E7EB]'
                    : node.completed
                    ? 'line-through text-[#787C83]'
                    : 'text-[#CFD4DD] group-hover/node:text-white'
                }`}
                title="Click to toggle, double-click to rename"
              >
                {node.title}
              </span>

              {/* Quick Rename Pencil on Hover */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditTitleValue(node.title);
                  setIsEditingTitle(true);
                }}
                className="opacity-0 group-hover/node:opacity-100 p-0.5 text-[#787C83] hover:text-[#DCB001] transition-opacity"
                title="Rename Item"
              >
                <Pencil size={10} />
              </button>
            </div>
          )}

          {/* Folder Child Count Pill */}
          {isFolder && children.length > 0 && (
            <span className="text-[9px] font-mono text-[#787C83] bg-[#131415] border border-[#2A2C30] px-1.5 py-0.5 rounded shrink-0">
              {counts.completed}/{counts.total} sub-items
            </span>
          )}
        </div>

        {/* Hover Action Buttons: Add Subtask, Add Folder, Delete */}
        <div className="flex items-center gap-1 opacity-0 group-hover/node:opacity-100 transition-opacity shrink-0">
          <button
            onClick={() => {
              setActiveInputType('subtask');
              setIsExpanded(true);
            }}
            className="p-1 hover:bg-[#2A2C30] text-[#787C83] hover:text-[#DCB001] rounded transition-colors"
            title="Add Nested Subtask"
          >
            <Plus size={11} />
          </button>

          <button
            onClick={() => {
              setActiveInputType('folder');
              setIsExpanded(true);
            }}
            className="p-1 hover:bg-[#2A2C30] text-[#787C83] hover:text-[#DCB001] rounded transition-colors"
            title="Add Nested Folder"
          >
            <FolderPlus size={11} />
          </button>

          {onDeleteSubtask && (
            <button
              onClick={() => onDeleteSubtask(issueId, node.id)}
              className="p-1 hover:bg-[#2A2C30] text-[#787C83] hover:text-[#EF4444] rounded transition-colors"
              title="Delete Item & Nested Contents"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Inline Input for New Subtask / Folder inside this Node */}
      {activeInputType && (
        <div className="flex items-center gap-2 pl-4 sm:pl-5 mt-1.5">
          <div className="flex items-center gap-1 bg-[#131415] border border-[#DCB001]/60 rounded px-2 py-0.5 flex-1">
            {activeInputType === 'folder' ? (
              <Folder size={11} className="text-[#DCB001] shrink-0" />
            ) : (
              <Square size={11} className="text-[#787C83] shrink-0" />
            )}
            <input
              type="text"
              placeholder={activeInputType === 'folder' ? 'New folder name...' : 'New sub-item title...'}
              value={inputTitle}
              onChange={(e) => setInputTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateChild();
                if (e.key === 'Escape') setActiveInputType(null);
              }}
              autoFocus
              className="w-full bg-transparent text-xs text-[#CFD4DD] placeholder-[#787C83] outline-none"
            />
          </div>
          <button
            onClick={handleCreateChild}
            className="px-2 py-0.5 bg-[#DCB001] hover:bg-[#c49c00] text-[#0F1011] font-bold text-xs rounded"
          >
            Add
          </button>
          <button
            onClick={() => setActiveInputType(null)}
            className="px-1.5 py-0.5 text-xs text-[#787C83] hover:text-[#CFD4DD]"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Recursive Children Render (Infinite Nesting) */}
      <AnimatePresence>
        {isExpanded && hasChildren && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="pl-4 sm:pl-5 border-l border-[#2A2C30] ml-2.5 sm:ml-3 mt-1.5 space-y-1.5"
          >
            {children.map((child) => (
              <RecursiveSubtaskNode
                key={child.id}
                node={child}
                issueId={issueId}
                level={level + 1}
                onToggleSubtask={onToggleSubtask}
                onAddSubtask={onAddSubtask}
                onDeleteSubtask={onDeleteSubtask}
                onRenameSubtask={onRenameSubtask}
                onMoveSubtask={onMoveSubtask}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const TreeView: React.FC<TreeViewProps> = ({
  issues,
  projectName = 'Project Tree',
  projectKey = 'PRJ',
  onSelectIssue,
  onUpdateIssueStatus,
  onOpenNewIssue,
  onToggleSubtask,
  onAddSubtask,
  onDeleteSubtask,
  onRenameSubtask,
  onMoveSubtask,
  onRenameIssue,
  onRenameEpic,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all');
  const [expandedEpics, setExpandedEpics] = useState<Record<string, boolean>>({});
  const [expandedIssues, setExpandedIssues] = useState<Record<string, boolean>>({});
  const [activeNewRootSubtask, setActiveNewRootSubtask] = useState<{ issueId: string; type: 'subtask' | 'folder' } | null>(null);
  const [newRootInputTitle, setNewRootInputTitle] = useState('');

  // Editing state for Epics & Task titles
  const [editingEpicName, setEditingEpicName] = useState<string | null>(null);
  const [editingEpicValue, setEditingEpicValue] = useState('');
  const [editingIssueId, setEditingIssueId] = useState<string | null>(null);
  const [editingIssueTitleValue, setEditingIssueTitleValue] = useState('');
  const [dragOverIssueRootId, setDragOverIssueRootId] = useState<string | null>(null);

  // Group issues into Epics/Domains
  const epicGroups = useMemo(() => {
    const groups: Record<string, Issue[]> = {};

    issues.forEach((issue) => {
      const epicName = issue.epic || 'General Tasks';
      if (!groups[epicName]) {
        groups[epicName] = [];
      }
      groups[epicName].push(issue);
    });

    return groups;
  }, [issues]);

  const epicNames = useMemo(() => Object.keys(epicGroups), [epicGroups]);

  // Expand all by default initially
  React.useEffect(() => {
    const initialEpics: Record<string, boolean> = {};
    const initialIssues: Record<string, boolean> = {};

    epicNames.forEach((name) => {
      initialEpics[name] = true;
    });

    issues.forEach((i) => {
      initialIssues[i.id] = true;
    });

    setExpandedEpics(initialEpics);
    setExpandedIssues(initialIssues);
  }, [epicNames.length, issues.length]);

  const toggleEpic = (epic: string) => {
    setExpandedEpics((prev) => ({ ...prev, [epic]: !prev[epic] }));
  };

  const toggleIssue = (issueId: string) => {
    setExpandedIssues((prev) => ({ ...prev, [issueId]: !prev[issueId] }));
  };

  const expandAll = () => {
    const allE: Record<string, boolean> = {};
    const allI: Record<string, boolean> = {};
    epicNames.forEach((n) => (allE[n] = true));
    issues.forEach((i) => (allI[i.id] = true));
    setExpandedEpics(allE);
    setExpandedIssues(allI);
  };

  const collapseAll = () => {
    setExpandedEpics({});
    setExpandedIssues({});
  };

  const handleSaveEpicRename = (oldName: string) => {
    const trimmed = editingEpicValue.trim();
    if (trimmed && trimmed !== oldName && onRenameEpic) {
      onRenameEpic(oldName, trimmed);
    }
    setEditingEpicName(null);
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
    let total = 0;
    let completed = 0;
    issues.forEach((iss) => {
      const c = countNestedSubtasks(iss.subtasks);
      total += c.total;
      completed += c.completed;
    });
    return { total, completed };
  }, [issues]);

  const overallProgressPercent = totalCounts.total > 0 ? Math.round((totalCounts.completed / totalCounts.total) * 100) : 0;

  const handleRootSubtaskSubmit = (issueId: string) => {
    const text = newRootInputTitle.trim();
    if (!text || !activeNewRootSubtask || !onAddSubtask) return;
    onAddSubtask(issueId, text, null, activeNewRootSubtask.type === 'folder', activeNewRootSubtask.type);
    setNewRootInputTitle('');
    setActiveNewRootSubtask(null);
  };

  // Handle Drop onto Task Root Zone
  const handleDropToTaskRoot = (e: React.DragEvent, targetIssueId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIssueRootId(null);

    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (!data || !data.subId) return;

      if (onMoveSubtask) {
        onMoveSubtask(data.subId, null, targetIssueId);
        setExpandedIssues((prev) => ({ ...prev, [targetIssueId]: true }));
      }
    } catch {}
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0F1011] overflow-hidden">
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

          {onOpenNewIssue && (
            <button
              onClick={onOpenNewIssue}
              className="flex items-center gap-1 px-2.5 py-1 bg-[#DCB001] hover:bg-[#c49c00] text-[#0F1011] font-bold text-xs rounded shadow-sm transition-all shrink-0"
            >
              <Plus size={13} />
              <span>New Task</span>
            </button>
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
                  {issues.length} Tasks &bull; {epicNames.length} Epics &bull; {totalCounts.total} Sub-items
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
            {epicNames.map((epicName) => {
              const epicIssues = epicGroups[epicName].filter((i) =>
                filteredIssues.some((fi) => fi.id === i.id)
              );

              // Hide empty epics if filtered
              if (filteredIssues.length > 0 && epicIssues.length === 0) return null;

              const isEpicExpanded = expandedEpics[epicName] ?? true;
              let epicTotal = 0;
              let epicDone = 0;
              epicIssues.forEach((i) => {
                const c = countNestedSubtasks(i.subtasks);
                epicTotal += c.total;
                epicDone += c.completed;
              });
              const epicProgress = epicTotal > 0 ? Math.round((epicDone / epicTotal) * 100) : 0;
              const isEditingThisEpic = editingEpicName === epicName;

              return (
                <div key={epicName} className="relative group/epic">
                  {/* Branch Connector Guide */}
                  <div className="absolute -left-4 sm:-left-6 top-4 w-4 sm:w-6 h-[2px] bg-[#2A2C30] group-hover/epic:bg-[#DCB001]/60 transition-colors" />

                  {/* Epic Node Banner */}
                  <div
                    onClick={() => {
                      if (!isEditingThisEpic) toggleEpic(epicName);
                    }}
                    className="flex items-center justify-between p-2.5 bg-[#131415] hover:bg-[#1A1B1E] border border-[#2A2C30] hover:border-[#DCB001]/40 rounded-lg cursor-pointer transition-all shadow-sm group"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleEpic(epicName);
                        }}
                        className="text-[#787C83] group-hover:text-[#DCB001] transition-colors p-0.5"
                      >
                        {isEpicExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>

                      <div className="w-5 h-5 rounded bg-[#DCB001]/10 text-[#DCB001] flex items-center justify-center shrink-0">
                        {isEpicExpanded ? <FolderOpen size={12} /> : <Folder size={12} />}
                      </div>

                      {/* Inline Epic Rename */}
                      {isEditingThisEpic ? (
                        <div
                          className="flex items-center gap-1 flex-1 max-w-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            value={editingEpicValue}
                            onChange={(e) => setEditingEpicValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEpicRename(epicName);
                              if (e.key === 'Escape') setEditingEpicName(null);
                            }}
                            onBlur={() => handleSaveEpicRename(epicName)}
                            autoFocus
                            className="bg-[#17181A] border border-[#DCB001] text-xs font-bold text-white px-2 py-0.5 rounded outline-none w-full"
                          />
                          <button
                            onClick={() => handleSaveEpicRename(epicName)}
                            className="p-1 hover:bg-[#2A2C30] text-[#22C55E] rounded"
                          >
                            <Check size={12} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 truncate">
                          <span
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setEditingEpicValue(epicName);
                              setEditingEpicName(epicName);
                            }}
                            className="font-bold text-xs md:text-sm text-[#CFD4DD] group-hover:text-white truncate"
                            title="Double click to rename epic"
                          >
                            {epicName}
                          </span>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingEpicValue(epicName);
                              setEditingEpicName(epicName);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-[#787C83] hover:text-[#DCB001] transition-opacity"
                            title="Rename Epic"
                          >
                            <Pencil size={11} />
                          </button>
                        </div>
                      )}

                      <span className="text-[10px] font-mono text-[#787C83] bg-[#17181A] px-1.5 py-0.5 rounded border border-[#2A2C30] shrink-0">
                        {epicIssues.length} {epicIssues.length === 1 ? 'task' : 'tasks'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {epicTotal > 0 && (
                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#787C83] bg-[#17181A] border border-[#2A2C30] px-2 py-0.5 rounded">
                          <span>{epicDone}/{epicTotal} subtasks</span>
                          <span className="text-[#22C55E] font-bold">({epicProgress}%)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* TREE LEVEL 2: Tasks within Epic */}
                  <AnimatePresence>
                    {isEpicExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="pl-5 sm:pl-7 border-l-2 border-[#2A2C30]/70 ml-3 sm:ml-4 mt-2.5 space-y-2.5"
                      >
                        {epicIssues.map((issue) => {
                          const isIssueExpanded = expandedIssues[issue.id] ?? true;
                          const subtasks = issue.subtasks || [];
                          const issueCounts = countNestedSubtasks(subtasks);
                          const statusCfg = STATUS_CONFIG[issue.status] || STATUS_CONFIG.todo;
                          const priorityCfg = PRIORITY_CONFIG[issue.priority] || PRIORITY_CONFIG.medium;
                          const isEditingThisIssue = editingIssueId === issue.id;
                          const isRootDragOver = dragOverIssueRootId === issue.id;

                          return (
                            <div key={issue.id} className="relative group/task">
                              {/* Branch Connector Guide */}
                              <div className="absolute -left-5 sm:-left-7 top-4 w-5 sm:w-7 h-[2px] bg-[#2A2C30] group-hover/task:bg-[#DCB001]/70 transition-colors" />

                              {/* Task Card Node */}
                              <div
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  if (dragOverIssueRootId !== issue.id) setDragOverIssueRootId(issue.id);
                                }}
                                onDragLeave={() => {
                                  if (dragOverIssueRootId === issue.id) setDragOverIssueRootId(null);
                                }}
                                onDrop={(e) => handleDropToTaskRoot(e, issue.id)}
                                className={`bg-[#17181A] border transition-all shadow-sm rounded-lg p-2.5 ${
                                  isRootDragOver
                                    ? 'border-2 border-dashed border-[#DCB001] bg-[#DCB001]/10'
                                    : 'border-[#2A2C30] hover:border-[#DCB001]/50'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  {/* Left: Expand, Key, Title, Priority */}
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    {subtasks.length > 0 ? (
                                      <button
                                        onClick={() => toggleIssue(issue.id)}
                                        className="text-[#787C83] hover:text-[#DCB001] p-0.5 transition-colors"
                                      >
                                        {isIssueExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                      </button>
                                    ) : (
                                      <span className="w-4 h-4 flex items-center justify-center text-[#787C83]">
                                        <FileCode size={11} />
                                      </span>
                                    )}

                                    {/* Issue Key */}
                                    <button
                                      onClick={() => onSelectIssue(issue.id)}
                                      className="text-xs font-mono font-bold text-[#DCB001] hover:underline shrink-0"
                                      title="Inspect Task Details"
                                    >
                                      {issue.key}
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
                                      <div className="flex items-center gap-1 flex-1 max-w-md">
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
                                          onDoubleClick={() => {
                                            setEditingIssueTitleValue(issue.title);
                                            setEditingIssueId(issue.id);
                                          }}
                                          onClick={() => onSelectIssue(issue.id)}
                                          className="text-xs font-semibold text-[#CFD4DD] hover:text-white cursor-pointer truncate max-w-md"
                                          title="Click to inspect, double-click to rename"
                                        >
                                          {issue.title}
                                        </span>

                                        <button
                                          onClick={() => {
                                            setEditingIssueTitleValue(issue.title);
                                            setEditingIssueId(issue.id);
                                          }}
                                          className="opacity-0 group-hover/task:opacity-100 p-0.5 text-[#787C83] hover:text-[#DCB001] transition-opacity"
                                          title="Rename Task"
                                        >
                                          <Pencil size={10} />
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  {/* Right: Status Pill, Subtask Count & Assignee */}
                                  <div className="flex items-center gap-2 shrink-0">
                                    {/* Status Switcher Dropdown */}
                                    <div className="flex items-center gap-1">
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
                                    </div>

                                    {/* Subtasks Count Badge */}
                                    {issueCounts.total > 0 && (
                                      <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#131415] border border-[#2A2C30] rounded text-[#787C83]">
                                        {issueCounts.completed}/{issueCounts.total}
                                      </span>
                                    )}

                                    {/* Assignee Avatar */}
                                    {issue.assignee && (
                                      <div className="shrink-0" title={`Assignee: ${issue.assignee.name}`}>
                                        <Avatar user={issue.assignee} size="xs" />
                                      </div>
                                    )}

                                    {/* Quick + Subtask button */}
                                    <button
                                      onClick={() => {
                                        setExpandedIssues((prev) => ({ ...prev, [issue.id]: true }));
                                        setActiveNewRootSubtask(
                                          activeNewRootSubtask?.issueId === issue.id && activeNewRootSubtask.type === 'subtask'
                                            ? null
                                            : { issueId: issue.id, type: 'subtask' }
                                        );
                                      }}
                                      className="p-1 hover:bg-[#2A2C30] rounded text-[#787C83] hover:text-[#DCB001] transition-colors"
                                      title="Add Sub-work Item"
                                    >
                                      <Plus size={12} />
                                    </button>

                                    {/* Quick + Folder button */}
                                    <button
                                      onClick={() => {
                                        setExpandedIssues((prev) => ({ ...prev, [issue.id]: true }));
                                        setActiveNewRootSubtask(
                                          activeNewRootSubtask?.issueId === issue.id && activeNewRootSubtask.type === 'folder'
                                            ? null
                                            : { issueId: issue.id, type: 'folder' }
                                        );
                                      }}
                                      className="p-1 hover:bg-[#2A2C30] rounded text-[#787C83] hover:text-[#DCB001] transition-colors"
                                      title="Add Folder Container"
                                    >
                                      <FolderPlus size={12} />
                                    </button>
                                  </div>
                                </div>

                                {/* Drag Drop Hint Bar when hovering task */}
                                {isRootDragOver && (
                                  <div className="mt-2 py-1 px-2.5 bg-[#DCB001]/15 border border-[#DCB001]/40 rounded text-center text-xs font-mono text-[#DCB001] flex items-center justify-center gap-1.5">
                                    <CornerDownRight size={12} />
                                    <span>Drop here to move item to task root (no parent)</span>
                                  </div>
                                )}

                                {/* TREE LEVEL 3+: Infinite Recursive Nested Subtasks & Folders */}
                                <AnimatePresence>
                                  {isIssueExpanded && (subtasks.length > 0 || activeNewRootSubtask?.issueId === issue.id) && (
                                    <motion.div
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: 'auto' }}
                                      exit={{ opacity: 0, height: 0 }}
                                      className="pl-5 sm:pl-6 border-l-2 border-[#2A2C30]/50 ml-2 mt-2 pt-1 space-y-1.5"
                                    >
                                      {subtasks.map((subtask) => (
                                        <RecursiveSubtaskNode
                                          key={subtask.id}
                                          node={subtask}
                                          issueId={issue.id}
                                          level={1}
                                          onToggleSubtask={onToggleSubtask}
                                          onAddSubtask={onAddSubtask}
                                          onDeleteSubtask={onDeleteSubtask}
                                          onRenameSubtask={onRenameSubtask}
                                          onMoveSubtask={onMoveSubtask}
                                        />
                                      ))}

                                      {/* Inline New Root Subtask / Folder Input */}
                                      {activeNewRootSubtask?.issueId === issue.id && (
                                        <div className="flex items-center gap-2 pt-1">
                                          <div className="flex items-center gap-1 bg-[#131415] border border-[#DCB001]/60 rounded px-2 py-0.5 flex-1">
                                            {activeNewRootSubtask.type === 'folder' ? (
                                              <Folder size={11} className="text-[#DCB001] shrink-0" />
                                            ) : (
                                              <Square size={11} className="text-[#787C83] shrink-0" />
                                            )}
                                            <input
                                              type="text"
                                              placeholder={
                                                activeNewRootSubtask.type === 'folder'
                                                  ? 'Enter folder name...'
                                                  : 'Enter sub-work item...'
                                              }
                                              value={newRootInputTitle}
                                              onChange={(e) => setNewRootInputTitle(e.target.value)}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleRootSubtaskSubmit(issue.id);
                                                if (e.key === 'Escape') setActiveNewRootSubtask(null);
                                              }}
                                              autoFocus
                                              className="w-full bg-transparent text-xs text-[#CFD4DD] placeholder-[#787C83] outline-none"
                                            />
                                          </div>
                                          <button
                                            onClick={() => handleRootSubtaskSubmit(issue.id)}
                                            className="px-2 py-0.5 bg-[#DCB001] hover:bg-[#c49c00] text-[#0F1011] font-bold text-xs rounded"
                                          >
                                            Add
                                          </button>
                                          <button
                                            onClick={() => setActiveNewRootSubtask(null)}
                                            className="px-1.5 py-0.5 text-xs text-[#787C83] hover:text-[#CFD4DD]"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      )}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
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
    </div>
  );
};
