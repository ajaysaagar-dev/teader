'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Issue, Status, Priority } from '@/lib/types';
import { Avatar } from '@/components/ui/Avatar';
import { TaskContextMenu } from '@/components/ui/TaskContextMenu';
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
  Eye
} from 'lucide-react';

interface CompactListViewProps {
  issues: Issue[];
  onSelectIssue: (id: string) => void;
  onUpdateIssueStatus: (issueId: string, newStatus: Status) => void;
  onReorderIssues?: (reorderedIssues: Issue[]) => void;
  onUpdateIssuePriority?: (issueId: string, newPriority: Priority) => void;
  onDeleteIssue?: (issueId: string) => void;
  onOpenNewIssue: () => void;
  canDelete?: boolean;
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
    <div className="flex-1 flex flex-col h-full min-h-0 bg-[#0F1011] p-3 sm:p-4 gap-3 select-none">
      {/* Top Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-1">
        {/* Search and Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search Box */}
          <div className="relative flex items-center">
            <Search size={13} className="absolute left-2.5 text-[#787C83]" />
            <input
              type="text"
              placeholder="Filter tasks by key, title, assignee..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="bg-[#17181A] text-xs text-[#CFD4DD] placeholder-[#787C83] pl-8 pr-7 py-1.5 rounded-lg border border-[#2A2C30] focus:border-[#DCB001] outline-none w-56 sm:w-64 transition-all"
            />
            {filterQuery && (
              <button
                onClick={() => setFilterQuery('')}
                className="absolute right-2 text-[#787C83] hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-[#17181A] text-xs text-[#CFD4DD] py-1.5 px-2.5 rounded-lg border border-[#2A2C30] focus:border-[#DCB001] outline-none cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="todo">Todo</option>
            <option value="in_progress">In Progress</option>
            <option value="needs_review">Needs Review</option>
            <option value="done">Done</option>
          </select>

          {/* Priority Filter */}
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="bg-[#17181A] text-xs text-[#CFD4DD] py-1.5 px-2.5 rounded-lg border border-[#2A2C30] focus:border-[#DCB001] outline-none cursor-pointer"
          >
            <option value="all">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Folder Filter */}
          {availableFolders.length > 0 && (
            <select
              value={selectedFolder}
              onChange={(e) => setSelectedFolder(e.target.value)}
              className="bg-[#17181A] text-xs text-[#DCB001] py-1.5 px-2.5 rounded-lg border border-[#2A2C30] focus:border-[#DCB001] outline-none cursor-pointer font-medium"
            >
              <option value="all">📁 All Folders</option>
              {availableFolders.map((f) => (
                <option key={f} value={f}>
                  📁 {f}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Task Count & + New Task Button */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-[#787C83] font-mono whitespace-nowrap">
            {filteredIssues.length} {filteredIssues.length === 1 ? 'task' : 'tasks'}
          </span>

          <button
            onClick={onOpenNewIssue}
            className="flex items-center gap-1 px-3 py-1.5 bg-[#DCB001] hover:bg-[#c49c00] text-[#0F1011] rounded-lg text-xs font-bold shadow-sm transition-all"
          >
            <Plus size={13} />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Main List Table */}
      <div className="flex-1 bg-[#1B1C1F] border border-[#2A2C30] rounded-xl overflow-hidden flex flex-col min-h-0 shadow-lg">
        {/* Table Header */}
        <div className="px-4 py-2 bg-[#17181A] border-b border-[#2A2C30] grid grid-cols-12 text-[10px] font-mono text-[#787C83] uppercase tracking-wider items-center">
          <div className="col-span-2 sm:col-span-2">Key</div>
          <div className="col-span-5 sm:col-span-5">Title</div>
          <div className="col-span-2 sm:col-span-2">Status</div>
          <div className="col-span-1 sm:col-span-1">Priority</div>
          <div className="col-span-2 sm:col-span-2 text-right">Assignee</div>
        </div>

        {/* Table Rows */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#2A2C30]/50 custom-scrollbar">
          {filteredIssues.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#787C83] font-mono">
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
                  className={`relative px-4 py-2.5 grid grid-cols-12 items-center hover:bg-[#131415] cursor-grab active:cursor-grabbing transition-all text-xs group select-none ${
                    isDragging ? 'opacity-30 bg-[#131415]' : ''
                  }`}
                >
                  {/* Top Drop Indicator Line */}
                  {isOverThis && dropPosition === 'before' && (
                    <div className="absolute -top-0.5 left-0 right-0 h-1 bg-[#DCB001] rounded-full shadow-[0_0_8px_#DCB001] z-20" />
                  )}

                  {/* Bottom Drop Indicator Line */}
                  {isOverThis && dropPosition === 'after' && (
                    <div className="absolute -bottom-0.5 left-0 right-0 h-1 bg-[#DCB001] rounded-full shadow-[0_0_8px_#DCB001] z-20" />
                  )}

                  {/* Key */}
                  <div className="col-span-2 flex items-center gap-2 font-mono font-bold text-[#DCB001] text-[11px]">
                    <GripVertical size={12} className="text-[#787C83] opacity-0 group-hover:opacity-80 transition-opacity shrink-0 cursor-grab" />
                    <span>{issue.key}</span>
                  </div>

                  {/* Title & Folder Tag */}
                  <div className="col-span-5 flex items-center gap-2 pr-3 truncate">
                    {(issue.epic || issue.title.startsWith('📁 ')) && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#DCB001] bg-[#DCB001]/10 px-1.5 py-0.5 rounded border border-[#DCB001]/25 shrink-0">
                        <Folder size={10} className="shrink-0" />
                        <span className="truncate max-w-[80px]">{issue.epic || issue.title.replace(/^📁\s*/, '')}</span>
                      </span>
                    )}
                    <span className="text-[#CFD4DD] group-hover:text-white font-medium truncate">
                      {issue.title}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="col-span-2 flex items-center">
                    <span
                      className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full capitalize ${
                        issue.status === 'done'
                          ? 'bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30'
                          : issue.status === 'in_progress'
                          ? 'bg-[#DCB001]/15 text-[#DCB001] border border-[#DCB001]/30'
                          : issue.status === 'needs_review'
                          ? 'bg-[#3B82F6]/15 text-[#3B82F6] border border-[#3B82F6]/30'
                          : 'bg-[#2A2C30] text-[#787C83]'
                      }`}
                    >
                      {issue.status.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Priority */}
                  <div className="col-span-1">
                    <span
                      className={`text-[10px] font-mono uppercase font-semibold ${
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

                  {/* Assignee */}
                  <div className="col-span-2 flex items-center justify-end gap-2">
                    <Avatar user={assigneeUser} size="xs" />
                    <span className="text-[11px] text-[#787C83] font-mono truncate max-w-[80px]">
                      {assigneeUser.name}
                    </span>
                    <ChevronRight size={13} className="text-[#787C83] group-hover:text-white shrink-0" />
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
      />
    </div>
  );
});

CompactListView.displayName = 'CompactListView';
