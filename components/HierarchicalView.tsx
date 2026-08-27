'use client';

import React, { useState, useMemo } from 'react';
import { Issue, Status, Priority } from '@/lib/types';
import { Avatar } from '@/components/ui/Avatar';
import { 
  ChevronDown, 
  ChevronRight, 
  Layers, 
  CheckSquare, 
  Plus, 
  Search, 
  X, 
  CheckCircle2, 
  Play, 
  Eye, 
  RotateCcw,
  Sparkles,
  Folder,
  FolderOpen,
  User as UserIcon,
  ChevronsUpDown,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

interface HierarchicalViewProps {
  issues: Issue[];
  onSelectIssue: (id: string) => void;
  onUpdateIssueStatus: (issueId: string, newStatus: Status) => void;
  onOpenNewIssue: () => void;
  onToggleSubtask?: (issueId: string, subId: string, completed: boolean) => void;
  onAddSubtask?: (issueId: string, title: string) => void;
}

type GroupByMode = 'epic' | 'status' | 'assignee' | 'flat';

export const HierarchicalView: React.FC<HierarchicalViewProps> = React.memo(({
  issues,
  onSelectIssue,
  onUpdateIssueStatus,
  onOpenNewIssue,
  onToggleSubtask,
  onAddSubtask,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<GroupByMode>('epic');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [collapsedTasks, setCollapsedTasks] = useState<Record<string, boolean>>({});
  const [addingSubtaskForIssueId, setAddingSubtaskForIssueId] = useState<string | null>(null);
  const [subtaskInputTitle, setSubtaskInputTitle] = useState('');

  // Filter Issues
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      const matchSearch =
        searchQuery === '' ||
        issue.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        issue.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (issue.epic || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (issue.labels || []).some((l) => l.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (issue.subtasks || []).some((st) => st.title.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchPriority =
        selectedPriority === 'all' || issue.priority === selectedPriority;

      return matchSearch && matchPriority;
    });
  }, [issues, searchQuery, selectedPriority]);

  // Group Issues
  const groups = useMemo(() => {
    const map = new Map<string, { id: string; title: string; subtitle?: string; issues: Issue[] }>();

    if (groupBy === 'epic') {
      filteredIssues.forEach((issue) => {
        const epicName = issue.epic || 'General / Core Tasks';
        if (!map.has(epicName)) {
          map.set(epicName, { id: epicName, title: epicName, subtitle: 'Epic / Feature Group', issues: [] });
        }
        map.get(epicName)!.issues.push(issue);
      });
    } else if (groupBy === 'status') {
      const statusOrder: { id: Status; title: string }[] = [
        { id: 'todo', title: 'Todo' },
        { id: 'in_progress', title: 'In Progress' },
        { id: 'needs_review', title: 'Needs Review' },
        { id: 'done', title: 'Done' },
      ];
      statusOrder.forEach((s) => {
        map.set(s.id, { id: s.id, title: s.title, subtitle: 'Status Phase', issues: [] });
      });
      filteredIssues.forEach((issue) => {
        if (!map.has(issue.status)) {
          map.set(issue.status, { id: issue.status, title: issue.status, subtitle: 'Status Phase', issues: [] });
        }
        map.get(issue.status)!.issues.push(issue);
      });
    } else if (groupBy === 'assignee') {
      filteredIssues.forEach((issue) => {
        const issueAny = issue as any;
        const name = issue.assignee?.name || issueAny.assigneeName || 'Unassigned';
        if (!map.has(name)) {
          map.set(name, { id: name, title: name, subtitle: 'Assignee', issues: [] });
        }
        map.get(name)!.issues.push(issue);
      });
    } else {
      // Flat
      map.set('all', { id: 'all', title: 'All Tasks & Sub-works', issues: filteredIssues });
    }

    return Array.from(map.values());
  }, [filteredIssues, groupBy]);

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const toggleTaskCollapse = (issueId: string) => {
    setCollapsedTasks((prev) => ({ ...prev, [issueId]: !prev[issueId] }));
  };

  const handleExpandAll = () => {
    setCollapsedGroups({});
    setCollapsedTasks({});
  };

  const handleCollapseAll = () => {
    const newGroups: Record<string, boolean> = {};
    const newTasks: Record<string, boolean> = {};
    groups.forEach((g) => {
      newGroups[g.id] = true;
      g.issues.forEach((iss) => {
        newTasks[iss.id] = true;
      });
    });
    setCollapsedGroups(newGroups);
    setCollapsedTasks(newTasks);
  };

  const handleSubtaskToggle = async (issue: Issue, subId: string, currentCompleted: boolean) => {
    const nextCompleted = !currentCompleted;
    if (onToggleSubtask) {
      onToggleSubtask(issue.id, subId, nextCompleted);
    } else {
      try {
        await fetch('/api/subtasks', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subId, completed: nextCompleted }),
        });
        toast.success(`Subtask marked as ${nextCompleted ? 'completed' : 'incomplete'}`);
        const ENABLE_CELEBRATION = false;
        if (nextCompleted && ENABLE_CELEBRATION) {
          confetti({ particleCount: 35, spread: 40, origin: { y: 0.7 } });
        }
      } catch {

        toast.error('Failed to toggle subtask');
      }
    }
  };

  const handleAddSubtaskSubmit = async (issueId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!subtaskInputTitle.trim()) return;

    const title = subtaskInputTitle.trim();
    setSubtaskInputTitle('');
    setAddingSubtaskForIssueId(null);

    if (onAddSubtask) {
      onAddSubtask(issueId, title);
    } else {
      try {
        const res = await fetch('/api/subtasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ issueId, title }),
        });
        if (res.ok) {
          toast.success('Sub-work added to hierarchy!');
        }
      } catch {
        toast.error('Failed to add sub-work');
      }
    }
  };

  // Calculate Overall Progress
  const totalSubtasksCount = filteredIssues.reduce((acc, i) => acc + (i.subtasks?.length || 0), 0);
  const completedSubtasksCount = filteredIssues.reduce(
    (acc, i) => acc + (i.subtasks?.filter((st) => st.completed).length || 0),
    0
  );
  const completedIssuesCount = filteredIssues.filter((i) => i.status === 'done').length;
  const overallPercent = filteredIssues.length > 0
    ? Math.round((completedIssuesCount / filteredIssues.length) * 100)
    : 0;

  return (
    <div className="flex-1 h-full min-h-0 w-full overflow-hidden bg-[#131415] p-3 flex flex-col space-y-2.5 select-none font-sans text-xs">
      {/* Top Filter & Hierarchy Control Bar */}
      <div className="flex items-center justify-between gap-2.5 bg-[#1B1C1F] px-3 py-2 rounded-lg border border-[#2A2C30] shrink-0">
        {/* Left Controls: Search & Grouping */}
        <div className="flex items-center gap-2 flex-1 max-w-xl">
          {/* Search Box */}
          <div className="flex items-center gap-1.5 flex-1 bg-[#131415] border border-[#2A2C30] rounded-md px-2.5 py-1">
            <Search size={13} className="text-[#787C83] shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search epics, tasks, or sub-works..."
              className="w-full bg-transparent text-xs text-[#CFD4DD] placeholder-[#787C83] outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-[#787C83] hover:text-white">
                <X size={12} />
              </button>
            )}
          </div>

          {/* Group By Selector */}
          <div className="flex items-center gap-1 bg-[#131415] border border-[#2A2C30] rounded-md px-2 py-1 h-7">
            <span className="text-[10px] text-[#787C83] font-mono">Group:</span>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupByMode)}
              className="bg-transparent text-xs text-[#DCB001] outline-none font-semibold cursor-pointer"
            >
              <option value="epic" className="bg-[#1B1C1F] text-[#CFD4DD]">By Epic / Feature</option>
              <option value="status" className="bg-[#1B1C1F] text-[#CFD4DD]">By Status</option>
              <option value="assignee" className="bg-[#1B1C1F] text-[#CFD4DD]">By Assignee</option>
              <option value="flat" className="bg-[#1B1C1F] text-[#CFD4DD]">Flat Tree</option>
            </select>
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

        {/* Right Controls: Expand/Collapse & Summary */}
        <div className="flex items-center gap-2">
          {/* Progress Summary Pill */}
          <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 bg-[#131415] border border-[#2A2C30] rounded-md text-[11px] font-mono">
            <span className="text-[#787C83]">Progress:</span>
            <span className="font-bold text-[#DCB001]">{overallPercent}%</span>
            <span className="text-[#787C83]">({completedIssuesCount}/{filteredIssues.length} done)</span>
          </div>

          {/* Expand / Collapse All */}
          <div className="flex items-center bg-[#131415] border border-[#2A2C30] rounded-md p-0.5">
            <button
              onClick={handleExpandAll}
              className="p-1 text-[#787C83] hover:text-[#CFD4DD] hover:bg-[#2A2C30] rounded"
              title="Expand All"
            >
              <Maximize2 size={12} />
            </button>
            <button
              onClick={handleCollapseAll}
              className="p-1 text-[#787C83] hover:text-[#CFD4DD] hover:bg-[#2A2C30] rounded"
              title="Collapse All"
            >
              <Minimize2 size={12} />
            </button>
          </div>

          {/* New Task Button */}
          <button
            onClick={onOpenNewIssue}
            className="flex items-center gap-1 px-2.5 py-1 bg-[#DCB001] hover:bg-[#c49c00] text-[#0F1011] rounded-md text-xs font-bold shadow-sm transition-all"
          >
            <Plus size={13} />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Main Hierarchical Tree Content */}
      <div className="flex-1 bg-[#1B1C1F] border border-[#2A2C30] rounded-lg overflow-y-auto min-h-0 divide-y divide-[#2A2C30]/60">
        {groups.length === 0 || filteredIssues.length === 0 ? (
          <div className="p-12 text-center text-[#787C83] font-mono space-y-2">
            <Layers size={24} className="mx-auto text-[#787C83]/50" />
            <p>No tasks found in hierarchy matching current filters.</p>
          </div>
        ) : (
          groups.map((group) => {
            const isGroupCollapsed = collapsedGroups[group.id];
            const groupDoneCount = group.issues.filter((i) => i.status === 'done').length;
            const groupPercent = group.issues.length > 0
              ? Math.round((groupDoneCount / group.issues.length) * 100)
              : 0;

            const groupSubtasksCount = group.issues.reduce((acc, i) => acc + (i.subtasks?.length || 0), 0);
            const groupCompletedSubsCount = group.issues.reduce(
              (acc, i) => acc + (i.subtasks?.filter((st) => st.completed).length || 0),
              0
            );

            return (
              <div key={group.id} className="transition-colors">
                {/* Level 1: Epic / Group Header */}
                <div
                  onClick={() => toggleGroupCollapse(group.id)}
                  className="px-3.5 py-2 bg-[#17181A] hover:bg-[#1C1D21] cursor-pointer flex items-center justify-between border-b border-[#2A2C30]/40 group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <button className="text-[#787C83] group-hover:text-white transition-colors p-0.5">
                      {isGroupCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    </button>

                    <div className="flex items-center gap-1.5 min-w-0">
                      {groupBy === 'epic' && <Folder size={14} className="text-[#DCB001] shrink-0" />}
                      {groupBy === 'status' && <CheckCircle2 size={14} className="text-[#3B82F6] shrink-0" />}
                      {groupBy === 'assignee' && <UserIcon size={14} className="text-[#22C55E] shrink-0" />}
                      {groupBy === 'flat' && <Layers size={14} className="text-[#DCB001] shrink-0" />}

                      <span className="font-bold text-xs text-[#CFD4DD] group-hover:text-white truncate">
                        {group.title}
                      </span>
                    </div>

                    <span className="text-[10px] font-mono text-[#787C83] bg-[#131415] px-1.5 py-0.2 rounded border border-[#2A2C30]">
                      {group.issues.length} {group.issues.length === 1 ? 'task' : 'tasks'}
                    </span>

                    {groupSubtasksCount > 0 && (
                      <span className="hidden sm:inline-block text-[10px] font-mono text-[#787C83]">
                        ({groupCompletedSubsCount}/{groupSubtasksCount} sub-works)
                      </span>
                    )}
                  </div>

                  {/* Right: Group Progress Bar & Percentage */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="w-20 md:w-28 h-1.5 bg-[#131415] rounded-full overflow-hidden border border-[#2A2C30]">
                        <div
                          className="h-full bg-[#DCB001] transition-all duration-300"
                          style={{ width: `${groupPercent}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono font-bold text-[#DCB001] w-8 text-right">
                        {groupPercent}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Group Body: Tasks List */}
                {!isGroupCollapsed && (
                  <div className="divide-y divide-[#2A2C30]/30 pl-2 sm:pl-4">
                    {group.issues.map((issue) => {
                      const isTaskCollapsed = collapsedTasks[issue.id];
                      const subtasks = issue.subtasks || [];
                      const completedSubs = subtasks.filter((st) => st.completed).length;
                      const hasSubtasks = subtasks.length > 0;
                      const issueAny = issue as any;
                      const assigneeUser = issue.assignee || {
                        id: 'usr_default',
                        name: issueAny.assigneeName || 'User',
                        avatar: issueAny.assigneeAvatar,
                        email: '',
                        role: '',
                      };

                      return (
                        <div key={issue.id} className="relative group/task">
                          {/* Tree Vertical Guide Line */}
                          <div className="absolute left-2.5 top-0 bottom-0 w-px bg-[#2A2C30]/60 -z-0" />

                          {/* Level 2: Task Row */}
                          <div
                            onClick={() => onSelectIssue(issue.id)}
                            className="px-3 py-2 flex items-center justify-between hover:bg-[#131415] cursor-pointer transition-colors text-xs relative z-10"
                          >
                            {/* Left: Collapse icon, Key, Title, Sub-works badge */}
                            <div className="flex items-center gap-2 min-w-0 flex-1 pr-3">
                              {/* Subtask collapse toggle */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleTaskCollapse(issue.id);
                                }}
                                className={`p-0.5 rounded transition-colors ${
                                  hasSubtasks
                                    ? 'text-[#787C83] hover:text-[#DCB001] hover:bg-[#2A2C30]'
                                    : 'text-transparent cursor-default'
                                }`}
                                title={hasSubtasks ? 'Toggle Sub-works' : ''}
                              >
                                {hasSubtasks ? (
                                  isTaskCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />
                                ) : (
                                  <div className="w-3.5 h-3.5 flex items-center justify-center">
                                    <span className="w-1 h-1 rounded-full bg-[#787C83]/50" />
                                  </div>
                                )}
                              </button>

                              {/* Task Key */}
                              <span className="font-mono text-[11px] font-bold text-[#DCB001] shrink-0">
                                {issue.key}
                              </span>

                              {/* Task Title */}
                              <span className="font-medium text-[#CFD4DD] group-hover/task:text-white truncate">
                                {issue.title}
                              </span>

                              {/* Subtask Count Badge */}
                              {hasSubtasks && (
                                <span className="text-[10px] font-mono text-[#787C83] bg-[#131415] px-1.5 py-0.5 rounded border border-[#2A2C30] shrink-0 flex items-center gap-1">
                                  <CheckSquare size={10} className="text-[#DCB001]" />
                                  <span>{completedSubs}/{subtasks.length}</span>
                                </span>
                              )}
                            </div>

                            {/* Right: Status Pill, Priority, Assignee & Quick Actions */}
                            <div className="flex items-center gap-2.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                              {/* Status Pill with Inline Changer */}
                              <select
                                value={issue.status}
                                onChange={(e) => onUpdateIssueStatus(issue.id, e.target.value as Status)}
                                className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border outline-none cursor-pointer ${
                                  issue.status === 'done'
                                    ? 'bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30'
                                    : issue.status === 'in_progress'
                                    ? 'bg-[#DCB001]/15 text-[#DCB001] border-[#DCB001]/30'
                                    : issue.status === 'needs_review'
                                    ? 'bg-[#3B82F6]/15 text-[#3B82F6] border-[#3B82F6]/30'
                                    : 'bg-[#2A2C30] text-[#787C83] border-[#2A2C30]'
                                }`}
                              >
                                <option value="todo" className="bg-[#1B1C1F] text-[#CFD4DD]">Todo</option>
                                <option value="in_progress" className="bg-[#1B1C1F] text-[#DCB001]">In Progress</option>
                                <option value="needs_review" className="bg-[#1B1C1F] text-[#3B82F6]">Needs Review</option>
                                <option value="done" className="bg-[#1B1C1F] text-[#22C55E]">Done</option>
                              </select>

                              {/* Priority Badge */}
                              <span
                                className={`text-[9px] font-mono uppercase font-semibold px-1.5 py-0.5 rounded ${
                                  issue.priority === 'critical'
                                    ? 'bg-[#C0393B]/20 text-[#C0393B]'
                                    : issue.priority === 'high'
                                    ? 'bg-[#DCB001]/20 text-[#DCB001]'
                                    : 'bg-[#2A2C30] text-[#787C83]'
                                }`}
                              >
                                {issue.priority}
                              </span>

                              {/* Assignee Avatar */}
                              <div className="flex items-center gap-1.5 min-w-[70px]">
                                <Avatar user={assigneeUser} size="xs" />
                                <span className="text-[10px] text-[#787C83] font-mono truncate max-w-[65px]">
                                  {assigneeUser.name}
                                </span>
                              </div>

                              {/* Inline Add Subtask Button */}
                              <button
                                onClick={() => {
                                  if (addingSubtaskForIssueId === issue.id) {
                                    setAddingSubtaskForIssueId(null);
                                  } else {
                                    setAddingSubtaskForIssueId(issue.id);
                                    setCollapsedTasks((prev) => ({ ...prev, [issue.id]: false }));
                                    setSubtaskInputTitle('');
                                  }
                                }}
                                className="p-1 text-[#787C83] hover:text-[#DCB001] hover:bg-[#2A2C30] rounded transition-colors"
                                title="Add Sub-work item"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          </div>

                          {/* Level 3: Nested Subtasks & Sub-works Tree */}
                          {!isTaskCollapsed && (
                            <div className="pl-9 pr-3 py-1 space-y-1 bg-[#131415]/40 border-l border-[#2A2C30]/50 ml-5 my-0.5">
                              {/* Subtask Rows (Recursive) */}
                              {(() => {
                                const renderHierarchicalItem = (st: any, depth = 0): React.ReactNode => (
                                  <div key={st.id} className="space-y-1">
                                    <div
                                      className="flex items-center justify-between py-1 px-2 rounded hover:bg-[#1B1C1F] group/sub transition-colors text-xs"
                                      style={{ paddingLeft: `${depth * 14 + 8}px` }}
                                    >
                                      {/* Subtask checkbox + title */}
                                      <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                                        {st.isFolder || st.type === 'folder' ? (
                                          <Folder size={12} className="text-[#DCB001] shrink-0" />
                                        ) : (
                                          <input
                                            type="checkbox"
                                            checked={st.completed}
                                            onChange={() => handleSubtaskToggle(issue, st.id, st.completed)}
                                            className="w-3.5 h-3.5 rounded border-[#3B3D41] bg-[#1A1B1D] text-[#DCB001] focus:ring-0 cursor-pointer accent-[#DCB001]"
                                          />
                                        )}
                                        <span className={`text-[11px] truncate ${
                                          st.isFolder || st.type === 'folder'
                                            ? 'font-bold text-white'
                                            : st.completed
                                            ? 'line-through text-[#787C83]'
                                            : 'text-[#CFD4DD] group-hover/sub:text-white'
                                        }`}>
                                          {st.title}
                                        </span>
                                      </label>

                                      {/* Image attached indicator */}
                                      {st.imageUrl && (
                                        <span className="text-[10px] font-mono text-[#DCB001] bg-[#131415] px-1.5 py-0.2 rounded border border-[#2A2C30]">
                                          img 🖼️
                                        </span>
                                      )}
                                    </div>

                                    {st.subtasks && st.subtasks.length > 0 && (
                                      <div className="border-l border-[#2A2C30]/50 ml-3 space-y-1">
                                        {st.subtasks.map((child: any) => renderHierarchicalItem(child, depth + 1))}
                                      </div>
                                    )}
                                  </div>
                                );

                                return subtasks.map((st) => renderHierarchicalItem(st));
                              })()}

                              {/* Inline Add Subtask Input Form */}
                              {addingSubtaskForIssueId === issue.id && (
                                <form
                                  onSubmit={(e) => handleAddSubtaskSubmit(issue.id, e)}
                                  className="flex items-center gap-1.5 py-1 px-2 bg-[#1B1C1F] rounded border border-[#DCB001]/40"
                                >
                                  <input
                                    type="text"
                                    autoFocus
                                    value={subtaskInputTitle}
                                    onChange={(e) => setSubtaskInputTitle(e.target.value)}
                                    placeholder="Enter sub-work item & press Enter..."
                                    className="flex-1 bg-transparent text-xs text-[#CFD4DD] placeholder-[#787C83] outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setAddingSubtaskForIssueId(null)}
                                    className="px-1.5 py-0.5 text-[10px] text-[#787C83] hover:text-white"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="submit"
                                    disabled={!subtaskInputTitle.trim()}
                                    className="px-2 py-0.5 bg-[#DCB001] text-[#0F1011] rounded text-[10px] font-bold disabled:opacity-40"
                                  >
                                    Add
                                  </button>
                                </form>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});

HierarchicalView.displayName = 'HierarchicalView';
