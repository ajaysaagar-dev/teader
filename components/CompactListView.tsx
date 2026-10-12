'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Issue, Status, Priority } from '@/lib/types';
import { Avatar } from '@/components/ui/Avatar';
import { TaskContextMenu } from '@/components/ui/TaskContextMenu';
import { CustomDropdown } from '@/components/ui/CustomDropdown';
import { 
  Plus, 
  Search, 
  X, 
  ChevronRight,
  GripVertical,
  Folder,
  CheckCircle2,
  Clock,
  Play,
  RotateCcw,
  Eye,
  Trash2
} from 'lucide-react';
import { StatusIcon } from '@/components/ui/StatusIcon';
import { PriorityIcon } from '@/components/ui/PriorityIcon';
import { getTaskShortId, formatAddedTiming, formatExactDateTime } from '@/lib/task-id';

interface CompactListViewProps {
  issues: Issue[];
  onSelectIssue: (id: string) => void;
  onUpdateIssueStatus: (issueId: string, newStatus: Status) => void;
  onReorderIssues?: (reorderedIssues: Issue[]) => void;
  onUpdateIssuePriority?: (issueId: string, newPriority: Priority) => void;
  onDeleteIssue?: (issueId: string) => void;
  onOpenNewIssue: () => void;
  canDelete?: boolean;
  canCompleteTasks?: boolean;
}

export const CompactListView: React.FC<CompactListViewProps> = React.memo(({
  issues,
  onSelectIssue,
  onUpdateIssueStatus,
  onReorderIssues,
  onUpdateIssuePriority,
  onDeleteIssue,
  onOpenNewIssue,
  canDelete = true,
  canCompleteTasks = true,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Drag and drop reordering states
  const [draggedIssueId, setDraggedIssueId] = useState<string | null>(null);
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

  // Extract unique folders/epics
  const availableFolders = useMemo(() => {
    const folders = new Set<string>();
    issues.forEach((i) => {
      if (i.epic) folders.add(i.epic);
      if (i.title.startsWith('📁 ')) {
        folders.add(i.title.replace(/^📁\s*/, ''));
      }
    });
    return Array.from(folders);
  }, [issues]);

  // Filter issues
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      const q = filterQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        issue.title.toLowerCase().includes(q) ||
        issue.key.toLowerCase().includes(q) ||
        (issue.assignee?.name && issue.assignee.name.toLowerCase().includes(q)) ||
        ((issue as any).assigneeName && (issue as any).assigneeName.toLowerCase().includes(q));

      const matchesPriority =
        selectedPriority === 'all' || issue.priority === selectedPriority;

      const issueFolder = issue.epic || (issue.title.startsWith('📁 ') ? issue.title.replace(/^📁\s*/, '') : null);
      const matchesFolder =
        selectedFolder === 'all' || issueFolder === selectedFolder;

      const matchesStatus =
        selectedStatus === 'all' || issue.status === selectedStatus;

      return matchesQuery && matchesPriority && matchesFolder && matchesStatus;
    });
  }, [issues, filterQuery, selectedPriority, selectedFolder, selectedStatus]);

  // Handle Drag Reordering
  const handleReorder = useCallback((
    sourceId: string,
    targetId: string | null,
    position: 'before' | 'after' | null
  ) => {
    if (!onReorderIssues) return;
    const sourceIndex = issues.findIndex((i) => i.id === sourceId);
    if (sourceIndex === -1) return;

    const sourceIssue = issues[sourceIndex];
    let newIssues = [...issues];

    if (targetId && targetId !== sourceId) {
      newIssues.splice(sourceIndex, 1);
      const targetIndex = newIssues.findIndex((i) => i.id === targetId);
      if (targetIndex !== -1) {
        const insertIndex = position === 'after' ? targetIndex + 1 : targetIndex;
        newIssues.splice(insertIndex, 0, sourceIssue);
      }
    }

    onReorderIssues(newIssues);
  }, [issues, onReorderIssues]);

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-[var(--bg-canvas)] p-3 sm:p-4 gap-3 select-none">
      {/* Top Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-1">
        {/* Search and Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search Box */}
          <div className="relative flex items-center">
            <Search size={13} className="absolute left-2.5 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Filter tasks by key, title, assignee..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="bg-[var(--bg-panel)] text-xs text-[var(--text-secondary)] placeholder-[#666666] pl-8 pr-7 py-1.5 rounded-lg border border-[var(--border-primary)] focus:border-[var(--border-secondary)] outline-none w-56 sm:w-64 transition-all"
            />
            {filterQuery && (
              <button
                onClick={() => setFilterQuery('')}
                className="absolute right-2 text-[var(--text-muted)] hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <CustomDropdown<string>
            value={selectedStatus}
            onChange={(val) => setSelectedStatus(val)}
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'todo', label: 'Todo' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'needs_review', label: 'Needs Review' },
              { value: 'done', label: 'Done' },
            ]}
            triggerClassName="bg-[var(--bg-panel)] text-xs text-[var(--text-secondary)] py-1.5 px-2.5 rounded-lg border border-[var(--border-primary)] hover:border-[var(--border-secondary)]"
            size="sm"
          />

          {/* Priority Filter */}
          <CustomDropdown<string>
            value={selectedPriority}
            onChange={(val) => setSelectedPriority(val)}
            options={[
              { value: 'all', label: 'All Priorities' },
              { value: 'critical', label: 'Critical' },
              { value: 'high', label: 'High' },
              { value: 'medium', label: 'Medium' },
              { value: 'low', label: 'Low' },
            ]}
            triggerClassName="bg-[var(--bg-panel)] text-xs text-[var(--text-secondary)] py-1.5 px-2.5 rounded-lg border border-[var(--border-primary)] hover:border-[var(--border-secondary)]"
            size="sm"
          />

          {/* Folder Filter */}
          {availableFolders.length > 0 && (
            <CustomDropdown<string>
              value={selectedFolder}
              onChange={(val) => setSelectedFolder(val)}
              options={[
                { value: 'all', label: '📁 All Folders' },
                ...availableFolders.map((f) => ({
                  value: f,
                  label: `📁 ${f}`,
                })),
              ]}
              triggerClassName="bg-[var(--bg-panel)] text-xs text-white py-1.5 px-2.5 rounded-lg border border-[var(--border-primary)] hover:border-[var(--border-secondary)] font-medium"
              size="sm"
            />
          )}
        </div>

        {/* Task Count & + New Task Button */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-[var(--text-muted)] font-mono whitespace-nowrap">
            {filteredIssues.length} {filteredIssues.length === 1 ? 'task' : 'tasks'}
          </span>

          <button
            onClick={onOpenNewIssue}
            className="flex items-center gap-1 px-3 py-1.5 bg-white text-black hover:bg-[#FFFFFF] rounded-lg text-xs font-bold shadow-sm transition-all"
          >
            <Plus size={13} />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Main List Table */}
      <div className="flex-1 bg-[var(--bg-panel)] border border-[var(--border-primary)] rounded-xl overflow-hidden flex flex-col min-h-0 shadow-lg">
        {/* Table Header */}
        <div className="px-4 py-2 bg-[var(--bg-panel)] border-b border-[var(--border-primary)] grid grid-cols-12 text-xs text-[var(--text-muted)] font-medium items-center">
          <div className="col-span-1 font-mono">Key</div>
          <div className="col-span-4">Title</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-1">Priority</div>
          <div className="col-span-2">Updated</div>
          <div className="col-span-2 text-right">Assignee</div>
        </div>

        {/* Table Rows */}
        <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-primary)] custom-scrollbar">
          {filteredIssues.length === 0 ? (
            <div className="p-12 text-center text-xs text-[var(--text-muted)] font-mono">
              No tasks found matching filter.
            </div>
          ) : (
            filteredIssues.map((issue) => {
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
                      handleReorder(droppedId, issue.id, dropPosition || 'before');
                    }
                    setDraggedIssueId(null);
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
                  className={`relative px-4 h-10 min-h-[40px] grid grid-cols-12 items-center hover:bg-[var(--bg-hover)] cursor-pointer transition-colors text-xs group select-none ${
                    isDragging ? 'opacity-30 bg-[var(--bg-canvas)]' : ''
                  }`}
                >
                  {/* Top Drop Indicator Line */}
                  {isOverThis && dropPosition === 'before' && (
                    <div className="absolute -top-0.5 left-0 right-0 h-0.5 bg-white rounded-full z-20" />
                  )}

                  {/* Bottom Drop Indicator Line */}
                  {isOverThis && dropPosition === 'after' && (
                    <div className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-white rounded-full z-20" />
                  )}

                  {/* Key (T1, T2... Tn) */}
                  <div className="col-span-1 flex items-center gap-1.5 font-mono text-xs text-[var(--text-muted)]">
                    <GripVertical size={12} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-80 transition-opacity shrink-0 cursor-grab" />
                    <span>{getTaskShortId(issue, issues)}</span>
                  </div>

                  {/* Title & Folder Tag */}
                  <div className="col-span-4 flex items-center gap-2 pr-3 truncate">
                    {(issue.epic || issue.title.startsWith('📁 ')) && (
                      <span className="text-xs text-[var(--text-muted)] truncate shrink-0">
                        📁 {issue.epic || issue.title.replace(/^📁\s*/, '')}
                      </span>
                    )}
                    <span className="text-[var(--text-primary)] group-hover:text-white font-medium truncate text-xs">
                      {issue.title}
                    </span>
                  </div>

                  {/* Status Icon & Label */}
                  <div className="col-span-2 flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                    <StatusIcon status={issue.status} size={14} className="shrink-0" />
                    <span className="capitalize">{issue.status.replace('_', ' ')}</span>
                  </div>

                  {/* Priority Icon */}
                  <div className="col-span-1 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                    <PriorityIcon priority={issue.priority} size={14} className="shrink-0" />
                  </div>

                  {/* Added / Updated Timing */}
                  <div className="col-span-2 flex items-center gap-1 font-mono text-xs text-[var(--text-muted)]" title={formatExactDateTime(issue.createdAt)}>
                    <Clock size={11} className="text-[var(--text-muted)] shrink-0" />
                    <span>{formatAddedTiming(issue.createdAt)}</span>
                  </div>

                  {/* Assignee & Hover Actions */}
                  <div className="col-span-2 flex items-center justify-end gap-2">
                    {canDelete && onDeleteIssue && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteIssue(issue.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-[var(--text-muted)] hover:text-white rounded transition-opacity"
                        title="Delete task"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                    <Avatar user={assigneeUser} size="xs" />
                    <span className="text-xs text-[var(--text-muted)] font-mono truncate max-w-[80px]">
                      {assigneeUser.name}
                    </span>
                    <ChevronRight size={13} className="text-[var(--text-muted)] group-hover:text-white shrink-0" />
                  </div>
                </div>
              );
            })
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
        canCompleteTasks={canCompleteTasks}
      />
    </div>
  );
});

CompactListView.displayName = 'CompactListView';
