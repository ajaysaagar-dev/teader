'use client';

import React, { useState, useMemo } from 'react';
import { Issue, Status, Priority } from '@/lib/types';
import { Avatar } from '@/components/ui/Avatar';
import { 
  ChevronDown, 
  ChevronRight, 
  Layers, 
  Plus, 
  Search, 
  X, 
  CheckCircle2, 
  Folder,
  FolderOpen,
  User as UserIcon,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { toast } from 'sonner';

interface HierarchicalViewProps {
  issues: Issue[];
  onSelectIssue: (id: string) => void;
  onUpdateIssueStatus: (issueId: string, newStatus: Status) => void;
  onOpenNewIssue: () => void;
}

type GroupByMode = 'epic' | 'status' | 'assignee' | 'flat';

export const HierarchicalView: React.FC<HierarchicalViewProps> = React.memo(({
  issues,
  onSelectIssue,
  onUpdateIssueStatus,
  onOpenNewIssue,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<GroupByMode>('epic');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Filter Issues
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      const matchSearch =
        searchQuery === '' ||
        issue.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        issue.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (issue.epic || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (issue.labels || []).some((l) => l.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchPriority =
        selectedPriority === 'all' || issue.priority === selectedPriority;

      return matchSearch && matchPriority;
    });
  }, [issues, searchQuery, selectedPriority]);

  // Group Issues
  const groups = useMemo(() => {
    const map = new Map<string, { id: string; title: string; subtitle?: string; issues: Issue[] }>();

    if (groupBy === 'epic') {
      map.set('General', { id: 'General', title: 'General', subtitle: 'Default Common Folder', issues: [] });
      filteredIssues.forEach((issue) => {
        const folderName = issue.epic || 'General';
        if (!map.has(folderName)) {
          map.set(folderName, { id: folderName, title: folderName, subtitle: 'Folder / Epic', issues: [] });
        }
        map.get(folderName)!.issues.push(issue);
      });
    } else if (groupBy === 'status') {
      const statusOrder: { id: Status; title: string }[] = [
        { id: 'todo', title: 'Todo' },
        { id: 'in_progress', title: 'In Progress' },
        { id: 'needs_review', title: 'Needs Review' },
        { id: 'done', title: 'Done' },
      ];
      statusOrder.forEach((s) => {
        map.set(s.id, { id: s.id, title: s.title, subtitle: 'Workflow Column', issues: [] });
      });
      filteredIssues.forEach((issue) => {
        if (map.has(issue.status)) {
          map.get(issue.status)!.issues.push(issue);
        } else {
          if (!map.has('other')) map.set('other', { id: 'other', title: 'Other Statuses', issues: [] });
          map.get('other')!.issues.push(issue);
        }
      });
    } else if (groupBy === 'assignee') {
      map.set('Unassigned', { id: 'Unassigned', title: 'Unassigned', subtitle: 'Awaiting Member', issues: [] });
      filteredIssues.forEach((issue) => {
        const issueAny = issue as any;
        const name = issue.assignee?.name || issueAny.assigneeName || 'Unassigned';
        if (!map.has(name)) {
          map.set(name, { id: name, title: name, subtitle: 'Assigned Member', issues: [] });
        }
        map.get(name)!.issues.push(issue);
      });
    } else {
      map.set('all', { id: 'all', title: 'All Tasks (Flat List)', subtitle: 'Single Stream', issues: filteredIssues });
    }

    return Array.from(map.values()).filter((g) => g.issues.length > 0 || g.id === 'General');
  }, [filteredIssues, groupBy]);

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const handleExpandAll = () => {
    setCollapsedGroups({});
  };

  const handleCollapseAll = () => {
    const newGroups: Record<string, boolean> = {};
    groups.forEach((g) => {
      newGroups[g.id] = true;
    });
    setCollapsedGroups(newGroups);
  };

  // Calculate Overall Progress
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
          <div className="relative flex-1 min-w-[140px]">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#787C83]" />
            <input
              type="text"
              placeholder="Filter tasks or folders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-7 py-1 bg-[#131415] border border-[#2A2C30] rounded-md text-xs text-[#CFD4DD] placeholder-[#787C83] focus:border-[#DCB001] outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#787C83] hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Group By Selector */}
          <div className="flex items-center gap-1.5 bg-[#131415] border border-[#2A2C30] px-2 py-0.5 rounded-md shrink-0">
            <Layers size={12} className="text-[#DCB001]" />
            <span className="text-[10px] text-[#787C83] uppercase font-mono font-bold">Group:</span>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupByMode)}
              className="bg-transparent text-xs text-[#CFD4DD] outline-none cursor-pointer font-medium"
            >
              <option value="epic" className="bg-[#1B1C1F] text-[#CFD4DD]">Folder / Epic</option>
              <option value="status" className="bg-[#1B1C1F] text-[#CFD4DD]">Status</option>
              <option value="assignee" className="bg-[#1B1C1F] text-[#CFD4DD]">Assignee</option>
              <option value="flat" className="bg-[#1B1C1F] text-[#CFD4DD]">Flat List</option>
            </select>
          </div>

          {/* Priority Filter */}
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="bg-[#131415] border border-[#2A2C30] text-xs text-[#CFD4DD] px-2 py-1 rounded-md outline-none cursor-pointer shrink-0"
          >
            <option value="all" className="bg-[#1B1C1F]">All Priorities</option>
            <option value="critical" className="bg-[#1B1C1F]">Critical</option>
            <option value="high" className="bg-[#1B1C1F]">High</option>
            <option value="medium" className="bg-[#1B1C1F]">Medium</option>
            <option value="low" className="bg-[#1B1C1F]">Low</option>
          </select>
        </div>

        {/* Right Controls: Expand / Collapse All & New Task Button */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 bg-[#131415] border border-[#2A2C30] rounded-md p-0.5 text-xs text-[#787C83]">
            <button
              onClick={handleExpandAll}
              className="px-2 py-0.5 hover:text-white hover:bg-[#1B1C1F] rounded transition-colors flex items-center gap-1"
              title="Expand All"
            >
              <Maximize2 size={11} />
              <span className="text-[10px]">Expand</span>
            </button>
            <button
              onClick={handleCollapseAll}
              className="px-2 py-0.5 hover:text-white hover:bg-[#1B1C1F] rounded transition-colors flex items-center gap-1"
              title="Collapse All"
            >
              <Minimize2 size={11} />
              <span className="text-[10px]">Collapse</span>
            </button>
          </div>

          {/* New Task Button */}
          <button
            onClick={onOpenNewIssue}
            className="flex items-center gap-1.5 px-3 py-1 bg-[#DCB001] hover:bg-[#c49c00] text-[#0F1011] rounded-md font-bold text-xs transition-colors shadow-sm"
          >
            <Plus size={13} className="stroke-[2.5]" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Main Hierarchical Tree Body */}
      <div className="flex-1 min-h-0 w-full overflow-y-auto space-y-2 pr-0.5 custom-scrollbar">
        {groups.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center p-6 bg-[#1B1C1F] rounded-xl border border-[#2A2C30]">
            <Layers size={28} className="text-[#787C83] mb-2 stroke-[1.5]" />
            <p className="text-sm font-semibold text-white">No tasks match your search filter</p>
            <p className="text-xs text-[#787C83] mt-1">Try changing the search keyword or priority filters.</p>
          </div>
        ) : (
          groups.map((group) => {
            const isGroupCollapsed = collapsedGroups[group.id];
            const completedCount = group.issues.filter((i) => i.status === 'done').length;
            const progress = group.issues.length > 0 ? Math.round((completedCount / group.issues.length) * 100) : 0;

            const isNoneDone = group.issues.length > 0 && completedCount === 0;
            const isPartiallyDone = group.issues.length > 0 && completedCount > 0 && completedCount < group.issues.length;
            const isAllDone = group.issues.length > 0 && completedCount === group.issues.length;

            let headerBg = 'bg-[#16171A] hover:bg-[#1C1D21] border-[#2A2C30]/70';
            let iconBox = 'bg-[#DCB001]/10 border-[#DCB001]/30 text-[#DCB001]';

            if (isNoneDone) {
              headerBg = 'bg-[#16130D] hover:bg-[#1C1810] border-[#F59E0B]/40 shadow-[inset_3px_0_0_#F59E0B]';
              iconBox = 'bg-[#F59E0B]/15 border-[#F59E0B]/35 text-[#F59E0B]';
            } else if (isPartiallyDone) {
              headerBg = 'bg-[#0B141D] hover:bg-[#0E1A26] border-[#0EA5E9]/45 shadow-[inset_3px_0_0_#0EA5E9]';
              iconBox = 'bg-[#0EA5E9]/15 border-[#0EA5E9]/40 text-[#38BDF8]';
            } else if (isAllDone) {
              headerBg = 'bg-[#0A160F] hover:bg-[#0D1E14] border-[#22C55E]/40 shadow-[inset_3px_0_0_#22C55E]';
              iconBox = 'bg-[#22C55E]/15 border-[#22C55E]/40 text-[#22C55E]';
            }

            return (
              <div
                key={group.id}
                className="bg-[#1B1C1F] border border-[#2A2C30] rounded-xl overflow-hidden shadow-sm transition-all"
              >
                {/* Level 1: Folder / Group Header */}
                <div
                  onClick={() => toggleGroupCollapse(group.id)}
                  className={`px-3.5 py-2.5 flex items-center justify-between cursor-pointer border-b select-none transition-colors ${headerBg}`}
                >
                  {/* Left: Folder Chevron, Icon & Title */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleGroupCollapse(group.id);
                      }}
                      className="text-[#787C83] hover:text-white p-0.5"
                    >
                      {isGroupCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    </button>

                    <div className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 ${iconBox}`}>
                      {isGroupCollapsed ? <Folder size={13} /> : <FolderOpen size={13} />}
                    </div>

                    <div className="truncate">
                      <span className="font-semibold text-white text-xs truncate">
                        {group.title}
                      </span>
                      {group.subtitle && (
                        <span className="ml-2 text-[10px] font-mono text-[#787C83] hidden sm:inline">
                          ({group.subtitle})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Progress Meter & Stats */}
                  <div className="flex items-center gap-3 shrink-0">
                    {isNoneDone ? (
                      <span className="text-[10px] font-mono font-bold text-[#F59E0B] bg-[#F59E0B]/15 px-2 py-0.5 rounded-full border border-[#F59E0B]/35 flex items-center gap-1">
                        0/{group.issues.length} Done (Pending)
                      </span>
                    ) : isPartiallyDone ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold text-[#38BDF8] bg-[#0EA5E9]/15 px-2 py-0.5 rounded-full border border-[#0EA5E9]/40 flex items-center gap-1">
                          {completedCount}/{group.issues.length} Done ({progress}%)
                        </span>
                        <div className="w-16 h-1.5 rounded-full bg-[#142334] overflow-hidden hidden sm:block border border-[#0EA5E9]/30">
                          <div
                            className="h-full bg-[#38BDF8] transition-all duration-300 rounded-full"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    ) : isAllDone ? (
                      <span className="text-[10px] font-mono font-bold text-[#22C55E] bg-[#22C55E]/15 px-2 py-0.5 rounded-full border border-[#22C55E]/40 flex items-center gap-1">
                        {completedCount}/{group.issues.length} Done (100%)
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-[#787C83] bg-[#111214] px-2 py-0.5 rounded-full border border-[#2A2C30]">
                        0 tasks (Empty)
                      </span>
                    )}
                  </div>
                </div>

                {/* Level 2: Tasks List Inside Folder */}
                {!isGroupCollapsed && (
                  <div className="divide-y divide-[#2A2C30]/40">
                    {group.issues.length === 0 && (
                      <div className="px-6 py-4 text-center text-xs text-[#787C83] italic">
                        No tasks inside this folder.
                      </div>
                    )}

                    {group.issues.map((issue) => {
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
                          {/* Level 2: Task Row */}
                          <div
                            onClick={() => onSelectIssue(issue.id)}
                            className="px-4 py-2.5 flex items-center justify-between hover:bg-[#131415] cursor-pointer transition-colors text-xs relative z-10"
                          >
                            {/* Left: Key, Title */}
                            <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-3">
                              {/* Task Key */}
                              <span className="font-mono text-[11px] font-bold text-[#DCB001] shrink-0">
                                {issue.key}
                              </span>

                              {/* Task Title */}
                              <span className="font-medium text-[#CFD4DD] group-hover/task:text-white truncate">
                                {issue.title}
                              </span>
                            </div>

                            {/* Right: Status Pill, Priority, Assignee */}
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
                            </div>
                          </div>
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
