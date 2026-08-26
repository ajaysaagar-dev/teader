'use client';

import React, { useState } from 'react';
import { Issue, Status } from '@/lib/types';
import { Avatar } from '@/components/ui/Avatar';
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
  ChevronRight
} from 'lucide-react';

interface KanbanBoardViewProps {
  issues: Issue[];
  onSelectIssue: (id: string) => void;
  onUpdateIssueStatus: (issueId: string, newStatus: Status) => void;
  onOpenNewIssue: () => void;
  onAddNewTaskToColumn?: (title: string, status: Status) => void;
}

export const KanbanBoardView: React.FC<KanbanBoardViewProps> = ({
  issues,
  onSelectIssue,
  onUpdateIssueStatus,
  onOpenNewIssue,
  onAddNewTaskToColumn,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [addingToCol, setAddingToCol] = useState<Status | null>(null);
  const [inlineTaskTitle, setInlineTaskTitle] = useState('');

  // Filter Issues
  const filteredIssues = issues.filter((issue) => {
    const queryMatch =
      filterQuery === '' ||
      issue.title.toLowerCase().includes(filterQuery.toLowerCase()) ||
      issue.key.toLowerCase().includes(filterQuery.toLowerCase()) ||
      (issue.labels || []).some((l) => l.toLowerCase().includes(filterQuery.toLowerCase()));

    const priorityMatch =
      selectedPriority === 'all' || issue.priority === selectedPriority;

    return queryMatch && priorityMatch;
  });

  const columns: { id: Status; title: string; count: number; color: string }[] = [
    {
      id: 'todo',
      title: 'Todo',
      count: filteredIssues.filter((i) => i.status === 'todo').length,
      color: '#787C83',
    },
    {
      id: 'in_progress',
      title: 'In Progress',
      count: filteredIssues.filter((i) => i.status === 'in_progress').length,
      color: '#DCB001',
    },
    {
      id: 'needs_review',
      title: 'Needs Review',
      count: filteredIssues.filter((i) => i.status === 'needs_review').length,
      color: '#3B82F6',
    },
    {
      id: 'done',
      title: 'Done',
      count: filteredIssues.filter((i) => i.status === 'done').length,
      color: '#22C55E',
    },
  ];

  const handleInlineAddSubmit = (status: Status, e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineTaskTitle.trim()) return;
    if (onAddNewTaskToColumn) {
      onAddNewTaskToColumn(inlineTaskTitle.trim(), status);
    }
    setInlineTaskTitle('');
    setAddingToCol(null);
  };

  return (
    <div className="flex-1 h-full overflow-hidden bg-[#131415] p-3 flex flex-col space-y-2.5 select-none">
      {/* Compact Top Filter & View Bar */}
      <div className="flex items-center justify-between gap-2.5 bg-[#1B1C1F] px-3 py-2 rounded-lg border border-[#2A2C30] shrink-0">
        <div className="flex items-center gap-2 flex-1 max-w-lg">
          {/* Text Filter Input */}
          <div className="flex items-center gap-1.5 flex-1 bg-[#131415] border border-[#2A2C30] rounded-md px-2.5 py-1">
            <Search size={13} className="text-[#787C83] shrink-0" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter tasks..."
              className="w-full bg-transparent text-xs text-[#CFD4DD] placeholder-[#787C83] outline-none"
            />
            {filterQuery && (
              <button onClick={() => setFilterQuery('')} className="text-[#787C83] hover:text-white">
                <X size={12} />
              </button>
            )}
          </div>

          {/* Priority Select */}
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="bg-[#131415] border border-[#2A2C30] text-xs text-[#CFD4DD] rounded-md px-2 py-1 outline-none font-mono cursor-pointer h-7"
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
          {/* View Mode Switcher */}
          <div className="flex items-center bg-[#131415] border border-[#2A2C30] rounded-md p-0.5">
            <button
              onClick={() => setViewMode('board')}
              className={`p-1 rounded text-xs transition-colors ${
                viewMode === 'board'
                  ? 'bg-[#2A2C30] text-[#DCB001]'
                  : 'text-[#787C83] hover:text-[#CFD4DD]'
              }`}
              title="Board View"
            >
              <LayoutGrid size={13} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1 rounded text-xs transition-colors ${
                viewMode === 'list'
                  ? 'bg-[#2A2C30] text-[#DCB001]'
                  : 'text-[#787C83] hover:text-[#CFD4DD]'
              }`}
              title="Compact List View"
            >
              <List size={13} />
            </button>
          </div>

          <span className="text-[11px] text-[#787C83] font-mono whitespace-nowrap">
            {filteredIssues.length} {filteredIssues.length === 1 ? 'task' : 'tasks'}
          </span>

          {/* + New Task Button */}
          <button
            onClick={onOpenNewIssue}
            className="flex items-center gap-1 px-2.5 py-1 bg-[#DCB001] hover:bg-[#c49c00] text-[#0F1011] rounded-md text-xs font-bold shadow-sm transition-all"
          >
            <Plus size={13} />
            <span>New</span>
          </button>
        </div>
      </div>

      {/* Main View: Kanban Board or Compact List */}
      {viewMode === 'list' ? (
        /* Compact List / Table View */
        <div className="flex-1 bg-[#1B1C1F] border border-[#2A2C30] rounded-lg overflow-hidden flex flex-col min-h-0">
          <div className="px-3 py-1.5 bg-[#17181A] border-b border-[#2A2C30] grid grid-cols-12 text-[10px] font-mono text-[#787C83] uppercase tracking-wider">
            <div className="col-span-2">Key</div>
            <div className="col-span-5">Title</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-1">Priority</div>
            <div className="col-span-2 text-right">Assignee</div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#2A2C30]/50">
            {filteredIssues.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#787C83] font-mono">
                No tasks found matching filter.
              </div>
            ) : (
              filteredIssues.map((issue) => {
                const issueAny = issue as any;
                const completedSubCount = (issue.subtasks || []).filter((st) => st.completed).length;
                const assigneeUser = issue.assignee || {
                  id: 'usr_default',
                  name: issueAny.assigneeName || 'User',
                  avatar: issueAny.assigneeAvatar,
                  email: '',
                  role: '',
                };

                return (
                  <div
                    key={issue.id}
                    onClick={() => onSelectIssue(issue.id)}
                    className="px-3 py-2 grid grid-cols-12 items-center hover:bg-[#131415] cursor-pointer transition-colors text-xs group"
                  >
                    <div className="col-span-2 flex items-center gap-1.5 font-mono font-bold text-[#DCB001] text-[11px]">
                      <span>{issue.key}</span>
                    </div>

                    <div className="col-span-5 flex items-center gap-2 pr-3 truncate">
                      <span className="text-[#CFD4DD] group-hover:text-white font-medium truncate">
                        {issue.title}
                      </span>
                      {(issue.subtasks || []).length > 0 && (
                        <span className="text-[10px] text-[#787C83] font-mono bg-[#131415] px-1.5 py-0.5 rounded border border-[#2A2C30] shrink-0">
                          {completedSubCount}/{(issue.subtasks || []).length}
                        </span>
                      )}
                    </div>

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
      ) : (
        /* High-Density Kanban Board Columns Grid */
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5 overflow-y-auto min-h-0">
          {columns.map((col) => (
            <div
              key={col.id}
              className="bg-[#1B1C1F] border border-[#2A2C30] rounded-lg flex flex-col max-h-full overflow-hidden"
            >
              {/* Column Header */}
              <div className="px-2.5 py-1.5 border-b border-[#2A2C30] flex items-center justify-between shrink-0 bg-[#17181A]">
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: col.color }}
                  />
                  <span className="font-semibold text-[11px] text-[#CFD4DD] uppercase tracking-wider">
                    {col.title}
                  </span>
                  <span className="text-[10px] font-mono text-[#787C83] bg-[#131415] px-1.5 py-0.2 rounded border border-[#2A2C30]">
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
                    className="p-1 text-[#787C83] hover:text-[#DCB001] hover:bg-[#131415] rounded transition-colors"
                    title={`Add task to ${col.title}`}
                  >
                    <Plus size={13} />
                  </button>
                )}
              </div>

              {/* Column Body / Cards List */}
              <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                {/* Inline Quick Add Card */}
                {addingToCol === col.id && (
                  <form
                    onSubmit={(e) => handleInlineAddSubmit(col.id, e)}
                    className="p-2 bg-[#131415] border border-[#DCB001]/50 rounded-lg space-y-1.5"
                  >
                    <input
                      type="text"
                      autoFocus
                      value={inlineTaskTitle}
                      onChange={(e) => setInlineTaskTitle(e.target.value)}
                      placeholder="What needs to be done?"
                      className="w-full bg-transparent text-xs text-[#CFD4DD] placeholder-[#787C83] outline-none"
                    />
                    <div className="flex items-center justify-end gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setAddingToCol(null)}
                        className="px-2 py-0.5 text-[10px] text-[#787C83] hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!inlineTaskTitle.trim()}
                        className="px-2.5 py-0.5 bg-[#DCB001] text-[#0F1011] rounded text-[10px] font-bold disabled:opacity-40"
                      >
                        Add
                      </button>
                    </div>
                  </form>
                )}

                {/* Task Cards */}
                {filteredIssues
                  .filter((i) => i.status === col.id)
                  .map((issue) => {
                    const completedSubCount = (issue.subtasks || []).filter((st) => st.completed).length;
                    const issueAny = issue as any;
                    const assigneeUser = issue.assignee || {
                      id: 'usr_default',
                      name: issueAny.assigneeName || 'User',
                      avatar: issueAny.assigneeAvatar,
                      email: '',
                      role: '',
                    };

                    return (
                      <div
                        key={issue.id}
                        onClick={() => onSelectIssue(issue.id)}
                        className="p-2.5 bg-[#131415] hover:bg-[#1A1B1E] border border-[#2A2C30] hover:border-[#DCB001]/40 rounded-lg cursor-pointer space-y-2 transition-all shadow-sm group"
                      >
                        {/* Key & Priority */}
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[11px] font-bold text-[#DCB001]">
                            {issue.key}
                          </span>
                          <span
                            className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded uppercase ${
                              issue.priority === 'critical'
                                ? 'bg-[#C0393B]/20 text-[#C0393B] border border-[#C0393B]/40'
                                : issue.priority === 'high'
                                ? 'bg-[#DCB001]/20 text-[#DCB001] border border-[#DCB001]/40'
                                : 'bg-[#2A2C30] text-[#787C83]'
                            }`}
                          >
                            {issue.priority}
                          </span>
                        </div>

                        {/* Title */}
                        <h4 className="text-xs font-semibold text-[#CFD4DD] group-hover:text-white line-clamp-2 leading-snug">
                          {issue.title}
                        </h4>

                        {/* Subtasks progress indicator */}
                        {(issue.subtasks || []).length > 0 && (
                          <div className="flex items-center gap-1.5 text-[10px] text-[#787C83] font-mono">
                            <CheckSquare size={11} className="text-[#DCB001]" />
                            <span>
                              {completedSubCount}/{(issue.subtasks || []).length} sub-works
                            </span>
                          </div>
                        )}

                        {/* Card Footer */}
                        <div className="pt-1.5 border-t border-[#2A2C30]/50 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 truncate max-w-[120px]">
                            <Avatar user={assigneeUser} size="xs" />
                            <span className="text-[10px] text-[#787C83] font-mono truncate">
                              {assigneeUser.name}
                            </span>
                          </div>

                          {/* Quick Stage Action Buttons on Hover */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {col.id === 'todo' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUpdateIssueStatus(issue.id, 'in_progress');
                                }}
                                className="px-1.5 py-0.5 text-[9px] font-semibold text-[#DCB001] bg-[#1A1B1D] hover:bg-[#2A2C30] border border-[#DCB001]/40 rounded flex items-center gap-0.5"
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
                                className="px-1.5 py-0.5 text-[9px] font-semibold text-[#3B82F6] bg-[#1A1B1D] hover:bg-[#2A2C30] border border-[#3B82F6]/40 rounded flex items-center gap-0.5"
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
                                className="px-1.5 py-0.5 text-[9px] font-semibold text-[#22C55E] bg-[#1A1B1D] hover:bg-[#2A2C30] border border-[#22C55E]/40 rounded flex items-center gap-0.5"
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
                                className="px-1.5 py-0.5 text-[9px] font-semibold text-[#787C83] bg-[#1A1B1D] hover:bg-[#2A2C30] border border-[#2A2C30] rounded flex items-center gap-0.5"
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

