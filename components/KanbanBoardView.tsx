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
  CheckSquare
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
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');

  // Filter Issues
  const filteredIssues = issues.filter((issue) => {
    const queryMatch =
      filterQuery === '' ||
      issue.title.toLowerCase().includes(filterQuery.toLowerCase()) ||
      issue.key.toLowerCase().includes(filterQuery.toLowerCase()) ||
      issue.labels.some((l) => l.toLowerCase().includes(filterQuery.toLowerCase()));

    const priorityMatch =
      selectedPriority === 'all' || issue.priority === selectedPriority;

    return queryMatch && priorityMatch;
  });

  const columns: { id: Status; title: string; count: number }[] = [
    {
      id: 'todo',
      title: 'Todo',
      count: filteredIssues.filter((i) => i.status === 'todo').length,
    },
    {
      id: 'in_progress',
      title: 'In Progress',
      count: filteredIssues.filter((i) => i.status === 'in_progress').length,
    },
    {
      id: 'needs_review',
      title: 'Needs Review',
      count: filteredIssues.filter((i) => i.status === 'needs_review').length,
    },
    {
      id: 'done',
      title: 'Done',
      count: filteredIssues.filter((i) => i.status === 'done').length,
    },
  ];

  return (
    <div className="flex-1 h-full overflow-x-auto bg-[#131415] p-6 flex flex-col space-y-4 select-none">
      {/* Top Filter Bar */}
      <div className="flex items-center justify-between gap-4 bg-[#1B1C1F] p-3 rounded-xl border border-[#2A2C30] shrink-0">
        <div className="flex items-center gap-3 flex-1 max-w-xl">
          {/* Text Filter Input */}
          <div className="flex items-center gap-2 flex-1 bg-[#131415] border border-[#2A2C30] rounded-lg px-2.5 py-1">
            <Search size={15} className="text-[#787C83]" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter tasks by key, label, title..."
              className="w-full bg-transparent text-xs text-[#CFD4DD] placeholder-[#787C83] outline-none"
            />
            {filterQuery && (
              <button onClick={() => setFilterQuery('')} className="text-[#787C83] hover:text-white">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Priority Select */}
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="bg-[#131415] border border-[#2A2C30] text-xs text-[#CFD4DD] rounded-lg px-2 py-1 outline-none font-mono cursor-pointer"
          >
            <option value="all">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#787C83] font-mono">{filteredIssues.length} tasks</span>
          {/* + New Task Button */}
          <button
            onClick={onOpenNewIssue}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#DCB001] hover:bg-[#c49c00] text-[#0F1011] rounded-lg text-xs font-bold shadow-md transition-all"
          >
            <Plus size={14} />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Kanban Board Columns Grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-y-auto min-h-0 pb-4">
        {columns.map((col) => (
          <div
            key={col.id}
            className="bg-[#1B1C1F] border border-[#2A2C30] rounded-xl flex flex-col max-h-full overflow-hidden"
          >
            {/* Column Header (Clean Header without + add button) */}
            <div className="p-3 border-b border-[#2A2C30] flex items-center justify-between shrink-0 bg-[#17181A]">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-[#CFD4DD] uppercase tracking-wider">
                  {col.title}
                </span>
                <span className="text-[11px] font-mono text-[#787C83] bg-[#131415] px-2 py-0.5 rounded border border-[#2A2C30]">
                  {col.count}
                </span>
              </div>
            </div>

            {/* Column Body / Cards List */}
            <div className="flex-1 p-3 space-y-3 overflow-y-auto">
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
                      className="p-3.5 bg-[#131415] hover:bg-[#1A1B1E] border border-[#2A2C30] hover:border-[#DCB001]/40 rounded-xl cursor-pointer space-y-3 transition-all shadow-sm group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] font-bold text-[#DCB001]">
                          {issue.key}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded uppercase ${
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
                      </div>

                      <h4 className="text-xs font-semibold text-[#CFD4DD] group-hover:text-white line-clamp-2 leading-relaxed">
                        {issue.title}
                      </h4>

                      {/* Sub-works progress indicator */}
                      {(issue.subtasks || []).length > 0 && (
                        <div className="flex items-center gap-1.5 text-[11px] text-[#787C83] font-mono pt-1">
                          <CheckSquare size={12} className="text-[#DCB001]" />
                          <span>
                            {completedSubCount} / {(issue.subtasks || []).length} sub-works
                          </span>
                        </div>
                      )}

                      {/* Card Footer */}
                      <div className="pt-2 border-t border-[#2A2C30]/60 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <Avatar user={assigneeUser} size="xs" />
                          <span className="text-[11px] text-[#787C83] font-mono">
                            {assigneeUser.name}
                          </span>
                        </div>

                        {/* Stage Action Buttons */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {col.id === 'todo' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateIssueStatus(issue.id, 'in_progress');
                              }}
                              className="px-2 py-0.5 text-[10px] font-semibold text-[#DCB001] bg-[#1A1B1D] hover:bg-[#2A2C30] border border-[#DCB001]/40 rounded flex items-center gap-1"
                              title="Start Progress"
                            >
                              <Play size={10} /> Start
                            </button>
                          )}

                          {col.id === 'in_progress' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateIssueStatus(issue.id, 'needs_review');
                              }}
                              className="px-2 py-0.5 text-[10px] font-semibold text-[#3B82F6] bg-[#1A1B1D] hover:bg-[#2A2C30] border border-[#3B82F6]/40 rounded flex items-center gap-1"
                              title="Submit for Review"
                            >
                              <Eye size={10} /> Review
                            </button>
                          )}

                          {col.id === 'needs_review' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateIssueStatus(issue.id, 'done');
                              }}
                              className="px-2 py-0.5 text-[10px] font-semibold text-[#22C55E] bg-[#1A1B1D] hover:bg-[#2A2C30] border border-[#22C55E]/40 rounded flex items-center gap-1"
                              title="Approve & Complete"
                            >
                              <CheckCircle2 size={10} /> Approve
                            </button>
                          )}

                          {col.id === 'done' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateIssueStatus(issue.id, 'todo');
                              }}
                              className="px-2 py-0.5 text-[10px] font-semibold text-[#787C83] bg-[#1A1B1D] hover:bg-[#2A2C30] border border-[#2A2C30] rounded flex items-center gap-1"
                              title="Reopen Task"
                            >
                              <RotateCcw size={10} /> Reopen
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
    </div>
  );
};
