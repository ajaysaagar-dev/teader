'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Issue, Status, Priority } from '@/lib/types';
import { Avatar } from '@/components/ui/Avatar';
import { TaskContextMenu } from '@/components/ui/TaskContextMenu';
import { 
  Plus, 
  Search, 
  X, 
  Play, 
  CheckCircle2, 
  RotateCcw, 
  Eye, 
  CheckSquare,
  LayoutGrid,
  List,
  ChevronRight,
  GripVertical,
  Folder,
  FolderOpen,
  Clock
} from 'lucide-react';
import { getTaskShortId, formatAddedTiming, formatExactDateTime } from '@/lib/task-id';

interface KanbanBoardViewProps {
  issues: Issue[];
  onSelectIssue: (id: string) => void;
  onUpdateIssueStatus: (issueId: string, newStatus: Status) => void;
  onReorderIssues?: (reorderedIssues: Issue[]) => void;
  onUpdateIssuePriority?: (issueId: string, newPriority: Priority) => void;
  onDeleteIssue?: (issueId: string) => void;
  onOpenNewIssue: () => void;
  onAddNewTaskToColumn?: (title: string, status: Status) => void;
  canDelete?: boolean;
  canCompleteTasks?: boolean;
}

export const KanbanBoardView: React.FC<KanbanBoardViewProps> = React.memo(({
  issues,
  onSelectIssue,
  onUpdateIssueStatus,
  onReorderIssues,
  onUpdateIssuePriority,
  onDeleteIssue,
  onOpenNewIssue,
  onAddNewTaskToColumn,
  canDelete = true,
  canCompleteTasks = true,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [addingToCol, setAddingToCol] = useState<Status | null>(null);
  const [inlineTaskTitle, setInlineTaskTitle] = useState('');
  
  // Drag and drop reordering states
  const [draggedIssueId, setDraggedIssueId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<Status | null>(null);
  const [dragOverIssueId, setDragOverIssueId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null);

  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    issue: Issue | null;
  }>({
    isOpen: false,
    position: { x: 0, y: 0 },
    issue: null,
  });

  // Extract all distinct folders across issues
  const folderList = useMemo(() => {
    const set = new Set<string>();
    set.add('General');
    issues.forEach((iss) => {
      if (iss.epic && iss.epic.trim()) set.add(iss.epic.trim());
      if (iss.title.startsWith('📁 ')) {
        const clean = iss.title.replace(/^📁\s*/, '').trim();
        if (clean) set.add(clean);
      }
    });
    return Array.from(set);
  }, [issues]);

  // Memoized Filtered Issues
  const filteredIssues = useMemo(() => {
    const query = filterQuery.toLowerCase().trim();
    return issues.filter((issue) => {
      const queryMatch =
        query === '' ||
        issue.title.toLowerCase().includes(query) ||
        issue.key.toLowerCase().includes(query) ||
        (issue.epic || '').toLowerCase().includes(query) ||
        (issue.labels || []).some((l) => l.toLowerCase().includes(query));

      const priorityMatch =
        selectedPriority === 'all' || issue.priority === selectedPriority;

      const issueFolder = issue.epic || (issue.title.startsWith('📁 ') ? issue.title.replace(/^📁\s*/, '').trim() : 'General');
      const folderMatch =
        selectedFolder === 'all' || issueFolder.toLowerCase() === selectedFolder.toLowerCase();

      return queryMatch && priorityMatch && folderMatch;
    });
  }, [issues, filterQuery, selectedPriority, selectedFolder]);

  const columns: { id: Status; title: string; count: number; color: string }[] = useMemo(() => [
    {
      id: 'todo',
      title: 'Todo',
      count: filteredIssues.filter((i) => i.status === 'todo').length,
      color: 'var(--status-todo, #787C83)',
    },
    {
      id: 'in_progress',
      title: 'In Progress',
      count: filteredIssues.filter((i) => i.status === 'in_progress').length,
      color: 'var(--status-inprogress, #DCB001)',
    },
    {
      id: 'needs_review',
      title: 'Needs Review',
      count: filteredIssues.filter((i) => i.status === 'needs_review').length,
      color: 'var(--status-review, #A855F7)',
    },
    {
      id: 'done',
      title: 'Done',
      count: filteredIssues.filter((i) => i.status === 'done').length,
      color: 'var(--status-done, #22C55E)',
    },
  ], [filteredIssues]);

  const handleInlineAddSubmit = useCallback((status: Status, e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineTaskTitle.trim()) return;
    if (onAddNewTaskToColumn) {
      onAddNewTaskToColumn(inlineTaskTitle.trim(), status);
    }
    setInlineTaskTitle('');
    setAddingToCol(null);
  }, [inlineTaskTitle, onAddNewTaskToColumn]);

  // Handle Drag & Drop Reordering (Top, Down, Between Tasks, Across Columns)
  const handleReorder = useCallback((
    sourceId: string,
    targetId: string | null,
    pos: 'before' | 'after' | null,
    targetStatus: Status | null
  ) => {
    const sourceIssue = issues.find((i) => i.id === sourceId);
    if (!sourceIssue) return;

    const isStatusChanged = targetStatus && sourceIssue.status !== targetStatus;
    if (isStatusChanged && targetStatus === 'done' && !canCompleteTasks) {
      return;
    }

    const updatedSource: Issue = isStatusChanged
      ? { ...sourceIssue, status: targetStatus }
      : sourceIssue;

    const remaining = issues.filter((i) => i.id !== sourceId);
    let updatedList: Issue[];

    if (!targetId || targetId === sourceId) {
      if (targetStatus && isStatusChanged) {
        // Find the last task in that column and append after it
        let lastIdxInCol = -1;
        for (let i = remaining.length - 1; i >= 0; i--) {
          if (remaining[i].status === targetStatus) {
            lastIdxInCol = i;
            break;
          }
        }
        if (lastIdxInCol !== -1) {
          updatedList = [...remaining];
          updatedList.splice(lastIdxInCol + 1, 0, updatedSource);
        } else {
          updatedList = [...remaining, updatedSource];
        }
      } else {
        updatedList = [...remaining, updatedSource];
      }
    } else {
      const targetIndex = remaining.findIndex((i) => i.id === targetId);
      if (targetIndex === -1) {
        updatedList = [...remaining, updatedSource];
      } else {
        const insertIndex = pos === 'after' ? targetIndex + 1 : targetIndex;
        updatedList = [...remaining];
        updatedList.splice(insertIndex, 0, updatedSource);
      }
    }

    if (onReorderIssues) {
      onReorderIssues(updatedList);
    }

    if (isStatusChanged && targetStatus) {
      onUpdateIssueStatus(sourceId, targetStatus);
    }
  }, [issues, onReorderIssues, onUpdateIssueStatus]);

  return (
    <div className="flex-1 h-full min-h-0 w-full overflow-hidden bg-[var(--bg-main)] p-3 flex flex-col space-y-2.5 select-none">
      {/* Compact Top Filter & View Bar */}
      <div className="flex items-center justify-between gap-2.5 bg-[var(--bg-card)] px-3 py-2 rounded-lg border border-[var(--border-primary)] shrink-0">
        <div className="flex items-center gap-2 flex-1 max-w-lg">
          {/* Text Filter Input */}
          <div className="flex items-center gap-1.5 flex-1 bg-[var(--bg-main)] border border-[var(--border-primary)] rounded-md px-2.5 py-1">
            <Search size={13} className="text-[var(--text-muted)] shrink-0" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter tasks..."
              className="w-full bg-transparent text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none"
            />
            {filterQuery && (
              <button onClick={() => setFilterQuery('')} className="text-[var(--text-muted)] hover:text-white">
                <X size={12} />
              </button>
            )}
          </div>

          {/* Folder Filter */}
          <div className="flex items-center gap-1 bg-[var(--bg-main)] border border-[var(--border-primary)] px-2 py-0.5 rounded-md h-7 shrink-0">
            <Folder size={12} className="text-[var(--accent-yellow)]" />
            <select
              value={selectedFolder}
              onChange={(e) => setSelectedFolder(e.target.value)}
              className="bg-transparent text-xs text-[var(--text-primary)] outline-none font-medium cursor-pointer"
            >
              <option value="all" className="bg-[var(--bg-card)]">All Folders</option>
              {folderList.map((f) => (
                <option key={f} value={f} className="bg-[var(--bg-card)]">{f}</option>
              ))}
            </select>
          </div>

          {/* Priority Select */}
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="bg-[var(--bg-main)] border border-[var(--border-primary)] text-xs text-[var(--text-primary)] rounded-md px-2 py-1 outline-none font-mono cursor-pointer h-7"
          >
            <option value="all">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[var(--text-muted)] font-mono whitespace-nowrap">
            {filteredIssues.length} {filteredIssues.length === 1 ? 'task' : 'tasks'}
          </span>

          {/* + New Task Button */}
          <button
            onClick={onOpenNewIssue}
            className="flex items-center gap-1 px-2.5 py-1 bg-[var(--accent-yellow)] hover:bg-[var(--accent-yellow-hover)] text-[var(--bg-canvas)] rounded-md text-xs font-bold shadow-sm transition-all"
          >
            <Plus size={13} />
            <span>New</span>
          </button>
        </div>
      </div>

      {/* Kanban Board Columns Grid with Drag & Drop Reordering */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5 overflow-y-auto min-h-0">
          {columns.map((col) => {
            const isColumnOver = dragOverColId === col.id && !dragOverIssueId;
            const columnCards = filteredIssues.filter((i) => i.status === col.id);

            return (
              <div
                key={col.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverColId !== col.id) {
                    setDragOverColId(col.id);
                  }
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    if (dragOverColId === col.id) {
                      setDragOverColId(null);
                    }
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const droppedId = e.dataTransfer.getData('text/plain') || draggedIssueId;
                  if (droppedId) {
                    handleReorder(droppedId, null, null, col.id);
                  }
                  setDraggedIssueId(null);
                  setDragOverColId(null);
                  setDragOverIssueId(null);
                  setDropPosition(null);
                }}
                className={`bg-[var(--bg-card)] border rounded-lg flex flex-col max-h-full overflow-hidden transition-all duration-150 ${
                  isColumnOver
                    ? 'border-[var(--accent-yellow)] bg-[var(--bg-hover)] ring-2 ring-[var(--accent-yellow)]/20'
                    : 'border-[var(--border-primary)]'
                }`}
              >
                {/* Column Header */}
                <div className={`px-2.5 py-1.5 border-b border-[var(--border-primary)] flex items-center justify-between shrink-0 transition-colors ${
                  isColumnOver ? 'bg-[var(--bg-hover)]' : 'bg-[var(--bg-panel)]'
                }`}>
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: col.color }}
                    />
                    <span className="font-semibold text-[11px] text-[var(--text-primary)] uppercase tracking-wider">
                      {col.title}
                    </span>
                    <span className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-main)] px-1.5 py-0.2 rounded border border-[var(--border-primary)]">
                      {col.count}
                    </span>
                  </div>

                  {/* Quick inline add trigger */}
                  {onAddNewTaskToColumn && (
                    <button
                      onClick={() => {
                        if (addingToCol === col.id) {
                          setAddingToCol(null);
                        } else {
                          setAddingToCol(col.id);
                          setInlineTaskTitle('');
                        }
                      }}
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--accent-yellow)] hover:bg-[var(--bg-main)] rounded transition-colors"
                      title={`Add task to ${col.title}`}
                    >
                      <Plus size={13} />
                    </button>
                  )}
                </div>

                {/* Column Body / Cards List */}
                <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[120px]">
                  {/* Inline Quick Add Card */}
                  {addingToCol === col.id && (
                    <form
                      onSubmit={(e) => handleInlineAddSubmit(col.id, e)}
                      className="p-2 bg-[var(--bg-main)] border border-[var(--border-accent)] rounded-lg space-y-1.5 shadow-md"
                    >
                      <input
                        type="text"
                        autoFocus
                        value={inlineTaskTitle}
                        onChange={(e) => setInlineTaskTitle(e.target.value)}
                        placeholder="What needs to be done?"
                        className="w-full bg-transparent text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none"
                      />
                      <div className="flex items-center justify-end gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => setAddingToCol(null)}
                          className="px-2 py-0.5 text-[10px] text-[var(--text-muted)] hover:text-white"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={!inlineTaskTitle.trim()}
                          className="px-2.5 py-0.5 bg-[var(--accent-yellow)] text-[var(--bg-canvas)] rounded text-[10px] font-bold disabled:opacity-40"
                        >
                          Add
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Task Cards */}
                  {columnCards.map((issue) => {
                    const completedSubCount = (issue.subtasks || []).filter((st) => st.completed).length;
                    const issueAny = issue as any;
                    const assigneeUser = issue.assignee || {
                      id: 'usr_default',
                      name: issueAny.assigneeName || 'User',
                      avatar: issueAny.assigneeAvatar,
                      email: '',
                      role: '',
                    };
                    const isDragging = draggedIssueId === issue.id;
                    const isOverThis = dragOverIssueId === issue.id;

                    return (
                      <div
                        key={issue.id}
                        draggable={true}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', issue.id);
                          e.dataTransfer.effectAllowed = 'move';
                          setDraggedIssueId(issue.id);
                        }}
                        onDragEnd={() => {
                          setDraggedIssueId(null);
                          setDragOverColId(null);
                          setDragOverIssueId(null);
                          setDropPosition(null);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          e.dataTransfer.dropEffect = 'move';
                          if (draggedIssueId && draggedIssueId !== issue.id) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const isTopHalf = (e.clientY - rect.top) < (rect.height / 2);
                            const pos = isTopHalf ? 'before' : 'after';
                            if (dragOverIssueId !== issue.id || dropPosition !== pos) {
                              setDragOverIssueId(issue.id);
                              setDropPosition(pos);
                            }
                            if (dragOverColId !== col.id) {
                              setDragOverColId(col.id);
                            }
                          }
                        }}
                        onDragLeave={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                            if (dragOverIssueId === issue.id) {
                              setDragOverIssueId(null);
                              setDropPosition(null);
                            }
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const droppedId = e.dataTransfer.getData('text/plain') || draggedIssueId;
                          if (droppedId && droppedId !== issue.id) {
                            handleReorder(droppedId, issue.id, dropPosition || 'before', col.id);
                          }
                          setDraggedIssueId(null);
                          setDragOverColId(null);
                          setDragOverIssueId(null);
                          setDropPosition(null);
                        }}
                        onClick={() => onSelectIssue(issue.id)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setContextMenu({
                            isOpen: true,
                            position: { x: e.clientX, y: e.clientY },
                            issue,
                          });
                        }}
                        className={`relative p-2.5 bg-[var(--bg-main)] hover:bg-[var(--bg-hover-subtle)] border rounded-lg cursor-grab active:cursor-grabbing space-y-2 transition-all duration-150 shadow-sm group select-none ${
                          isDragging
                            ? 'opacity-30 border-dashed border-[var(--accent-yellow)] scale-[0.98]'
                            : 'border-[var(--border-primary)] hover:border-[var(--accent-yellow)]/40'
                        }`}
                      >
                        {/* Top Drop Indicator Line (Reorder Above) */}
                        {isOverThis && dropPosition === 'before' && (
                          <div className="absolute -top-1.5 left-0 right-0 h-1 bg-[var(--accent-yellow)] rounded-full shadow-[0_0_8px_var(--accent-yellow)] z-20 animate-pulse" />
                        )}

                        {/* Bottom Drop Indicator Line (Reorder Below) */}
                        {isOverThis && dropPosition === 'after' && (
                          <div className="absolute -bottom-1.5 left-0 right-0 h-1 bg-[var(--accent-yellow)] rounded-full shadow-[0_0_8px_var(--accent-yellow)] z-20 animate-pulse" />
                        )}

                        {/* Key, Priority & Drag Handle */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <GripVertical size={12} className="text-[var(--text-muted)] opacity-40 group-hover:opacity-100 group-hover:text-[var(--accent-yellow)] transition-all shrink-0 cursor-grab" />
                            <span className="font-mono text-[11px] font-bold text-[var(--accent-yellow)] bg-[var(--accent-yellow-subtle)] px-1.5 py-0.2 rounded border border-[var(--accent-yellow-muted)]">
                              {getTaskShortId(issue, issues)}
                            </span>
                          </div>
                          <span
                            className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded uppercase ${
                              issue.priority === 'critical'
                                ? 'bg-[var(--priority-critical-bg)] text-[var(--priority-critical)] border border-[var(--priority-critical-border)]'
                                : issue.priority === 'high'
                                ? 'bg-[var(--priority-high-bg)] text-[var(--priority-high)] border border-[var(--priority-high-border)]'
                                : 'bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border-primary)]'
                            }`}
                          >
                            {issue.priority}
                          </span>
                        </div>

                        {/* Title & Folder Tag */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 flex-wrap">
                            {(issue.epic || issue.title.startsWith('📁 ')) && (
                              <div className="inline-flex items-center gap-1 text-[9px] font-mono text-[var(--accent-yellow)] bg-[var(--accent-yellow-subtle)] px-1.5 py-0.5 rounded border border-[var(--accent-yellow-muted)] max-w-full truncate">
                                <Folder size={10} className="shrink-0" />
                                <span className="truncate">{issue.epic || issue.title.replace(/^📁\s*/, '')}</span>
                              </div>
                            )}
                            {issue.tags && issue.tags.length > 0 && (
                              <div className="flex items-center gap-1">
                                {issue.tags.slice(0, 2).map((t, idx) => (
                                  <span key={idx} className="text-[9px] font-mono text-[var(--cyan)] bg-[var(--cyan)]/10 border border-[var(--cyan)]/30 px-1 py-0.2 rounded">
                                    @{t.replace(/^@/, '')}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <h4 className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-white line-clamp-2 leading-snug">
                            {issue.title}
                          </h4>
                        </div>

                        {/* Card Footer */}
                        <div className="pt-1.5 border-t border-[var(--border-primary)]/50 flex items-center justify-between text-xs relative min-h-[22px]">
                          <div className="flex items-center gap-1.5 truncate max-w-[120px]">
                            <Avatar user={assigneeUser} size="xs" />
                            <span className="text-[10px] text-[var(--text-muted)] font-mono truncate">
                              {assigneeUser.name}
                            </span>
                          </div>

                          {/* Added Timing (Visible at rest) */}
                          {issue.createdAt && (
                            <div
                              className="flex items-center gap-1 text-[9px] font-mono text-[var(--text-muted)] group-hover:hidden transition-all shrink-0"
                              title={formatExactDateTime(issue.createdAt)}
                            >
                              <Clock size={9} className="text-[var(--text-disabled)] shrink-0" />
                              <span>{formatAddedTiming(issue.createdAt)}</span>
                            </div>
                          )}

                          {/* Quick Stage Action Buttons on Hover */}
                          <div className="hidden group-hover:flex items-center gap-1 transition-all">
                            {col.id === 'todo' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUpdateIssueStatus(issue.id, 'in_progress');
                                }}
                                className="px-1.5 py-0.5 text-[9px] font-semibold text-[var(--accent-yellow)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border border-[var(--accent-yellow-muted)] rounded flex items-center gap-0.5"
                                title="Start Progress"
                              >
                                <Play size={9} /> Start
                              </button>
                            )}

                            {col.id === 'in_progress' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUpdateIssueStatus(issue.id, 'needs_review');
                                }}
                                className="px-1.5 py-0.5 text-[9px] font-semibold text-[var(--info)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border border-[var(--info)]/40 rounded flex items-center gap-0.5"
                                title="Submit for Review"
                              >
                                <Eye size={9} /> Review
                              </button>
                            )}

                            {col.id === 'needs_review' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUpdateIssueStatus(issue.id, 'done');
                                }}
                                className="px-1.5 py-0.5 text-[9px] font-semibold text-[var(--success)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border border-[var(--success-border)] rounded flex items-center gap-0.5"
                                title="Approve & Complete"
                              >
                                <CheckCircle2 size={9} /> Approve
                              </button>
                            )}

                            {col.id === 'done' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUpdateIssueStatus(issue.id, 'todo');
                                }}
                                className="px-1.5 py-0.5 text-[9px] font-semibold text-[var(--text-muted)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border border-[var(--border-primary)] rounded flex items-center gap-0.5"
                                title="Reopen Task"
                              >
                                <RotateCcw size={9} /> Reopen
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Empty Column Drop Placeholder Slot Indicator */}
                  {columnCards.length === 0 && (
                    <div className={`p-4 border-2 border-dashed rounded-lg text-center text-[10px] font-mono transition-colors ${
                      isColumnOver
                        ? 'border-[var(--accent-yellow)] bg-[var(--accent-yellow-subtle)] text-[var(--accent-yellow)]'
                        : 'border-[var(--border-primary)] text-[var(--text-muted)]'
                    }`}>
                      {isColumnOver ? 'Drop here to add to this column' : 'No tasks in this stage'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
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
        canCompleteTasks={canCompleteTasks}
      />
    </div>
  );
});

KanbanBoardView.displayName = 'KanbanBoardView';
