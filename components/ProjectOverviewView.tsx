'use client';

import React, { useMemo } from 'react';
import { Issue, Status, Priority } from '@/lib/types';
import { Avatar } from '@/components/ui/Avatar';
import { 
  BarChart3, 
  PieChart as PieIcon, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Circle, 
  Flame, 
  Layers, 
  FolderTree, 
  LayoutGrid, 
  Terminal, 
  Users, 
  Sparkles, 
  ArrowUpRight,
  ShieldAlert,
  ListTodo,
  FolderOpen
} from 'lucide-react';
import { motion } from 'framer-motion';

interface ProjectOverviewViewProps {
  issues: Issue[];
  project?: {
    id: string | number;
    key: string;
    name: string;
    description: string;
    ownerName?: string;
  } | null;
  members?: Array<{ id: number | string; name: string; email: string; avatar: string }>;
  onNavigateTab: (tab: 'board' | 'hierarchy' | 'tree' | 'dev') => void;
  onOpenNewIssue: () => void;
}

export const ProjectOverviewView: React.FC<ProjectOverviewViewProps> = React.memo(({
  issues,
  project,
  members = [],
  onNavigateTab,
  onOpenNewIssue,
}) => {
  // ─── Metrics Calculations ──────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = issues.length;
    const todo = issues.filter((i) => i.status === 'todo').length;
    const inProgress = issues.filter((i) => i.status === 'in_progress').length;
    const needsReview = issues.filter((i) => i.status === 'needs_review').length;
    const done = issues.filter((i) => i.status === 'done').length;

    const critical = issues.filter((i) => i.priority === 'critical').length;
    const high = issues.filter((i) => i.priority === 'high').length;
    const medium = issues.filter((i) => i.priority === 'medium').length;
    const low = issues.filter((i) => i.priority === 'low').length;

    // Subtasks & Folder stats
    let totalSubtasks = 0;
    let completedSubtasks = 0;
    let folderCount = 0;

    const countSubtree = (subs: any[]) => {
      for (const s of subs) {
        if (s.isFolder || s.type === 'folder') {
          folderCount += 1;
        } else {
          totalSubtasks += 1;
          if (s.completed) completedSubtasks += 1;
        }
        if (s.subtasks && s.subtasks.length > 0) {
          countSubtree(s.subtasks);
        }
      }
    };

    issues.forEach((iss) => {
      if (iss.subtasks) countSubtree(iss.subtasks);
    });

    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
    const subtaskRate = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

    // Epic groupings
    const epics: Record<string, { total: number; done: number }> = {};
    issues.forEach((iss) => {
      const epicName = iss.epic || 'General Tasks';
      if (!epics[epicName]) epics[epicName] = { total: 0, done: 0 };
      epics[epicName].total += 1;
      if (iss.status === 'done') epics[epicName].done += 1;
    });

    // Assignee stats
    const assignees: Record<string, { total: number; done: number; avatar?: string }> = {};
    issues.forEach((iss) => {
      const name = (iss as any).assigneeName || iss.assignee?.name || 'Unassigned';
      const avatar = (iss as any).assigneeAvatar || iss.assignee?.avatar;
      if (!assignees[name]) assignees[name] = { total: 0, done: 0, avatar };
      assignees[name].total += 1;
      if (iss.status === 'done') assignees[name].done += 1;
    });

    return {
      total,
      todo,
      inProgress,
      needsReview,
      done,
      critical,
      high,
      medium,
      low,
      completionRate,
      totalSubtasks,
      completedSubtasks,
      folderCount,
      subtaskRate,
      epics,
      assignees,
    };
  }, [issues]);

  // SVG Donut Chart Calculation for Status Breakdown
  const statusData = [
    { label: 'Done', count: stats.done, color: '#22C55E' },
    { label: 'In Progress', count: stats.inProgress, color: '#DCB001' },
    { label: 'Review', count: stats.needsReview, color: '#3B82F6' },
    { label: 'Todo', count: stats.todo, color: '#787C83' },
  ];

  const totalForDonut = stats.total || 1;
  let accumulatedAngle = 0;
  const donutSlices = statusData.map((slice) => {
    const percentage = slice.count / totalForDonut;
    const strokeDasharray = `${percentage * 283} ${283}`;
    const strokeDashoffset = -accumulatedAngle * 283;
    accumulatedAngle += percentage;
    return { ...slice, percentage: Math.round(percentage * 100), strokeDasharray, strokeDashoffset };
  });

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#131415] text-[#CFD4DD] p-4 lg:p-6 space-y-6 select-none font-sans">
      {/* ─── Hero Overview Header ─────────────────────────────────────────── */}
      <div className="bg-[#1B1C1F] border border-[#2A2C30] rounded-2xl p-5 lg:p-6 shadow-xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5 z-10">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-bold text-[#DCB001] bg-[#131415] px-2 py-0.5 rounded border border-[#2A2C30]">
              {project?.key || 'PROJECT'}
            </span>
            <span className="text-xs text-[#787C83]">Workspace Analytics & Insights</span>
          </div>
          <h2 className="text-xl lg:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            {project?.name || 'Project Overview'}
          </h2>
          <p className="text-xs text-[#9499A0] max-w-xl line-clamp-2">
            {project?.description || 'Track real-time engineering velocity, sprint health, and status breakdowns.'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 z-10">
          <button
            onClick={() => onNavigateTab('board')}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#CFD4DD] bg-[#131415] hover:bg-[#222427] border border-[#2A2C30] rounded-xl transition-all shadow-sm"
          >
            <LayoutGrid size={13} className="text-[#DCB001]" />
            <span>Open Board</span>
          </button>

          <button
            onClick={() => onNavigateTab('tree')}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#CFD4DD] bg-[#131415] hover:bg-[#222427] border border-[#2A2C30] rounded-xl transition-all shadow-sm"
          >
            <FolderTree size={13} className="text-[#3B82F6]" />
            <span>Tree Explorer</span>
          </button>

          <button
            onClick={onOpenNewIssue}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#0F1011] bg-[#DCB001] hover:bg-[#c49c00] rounded-xl transition-all shadow-md"
          >
            <Sparkles size={13} />
            <span>New Task</span>
          </button>
        </div>

        {/* Ambient Glow */}
        <div className="absolute right-0 top-0 w-80 h-80 bg-[#DCB001]/5 blur-3xl pointer-events-none rounded-full" />
      </div>

      {/* ─── Top KPI Metric Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. Overall Completion */}
        <div className="bg-[#1B1C1F] border border-[#2A2C30] rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#787C83]">Completion Rate</span>
            <div className="w-7 h-7 rounded-lg bg-[#22C55E]/10 border border-[#22C55E]/30 flex items-center justify-center text-[#22C55E]">
              <CheckCircle2 size={15} />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white font-mono">{stats.completionRate}%</span>
              <span className="text-xs text-[#787C83] font-mono">({stats.done}/{stats.total} done)</span>
            </div>
            <div className="w-full h-1.5 bg-[#131415] rounded-full mt-2 overflow-hidden border border-[#2A2C30]">
              <div
                className="h-full bg-[#22C55E] transition-all duration-500 rounded-full"
                style={{ width: `${stats.completionRate}%` }}
              />
            </div>
          </div>
        </div>

        {/* 2. In Progress Workload */}
        <div className="bg-[#1B1C1F] border border-[#2A2C30] rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#787C83]">In Progress</span>
            <div className="w-7 h-7 rounded-lg bg-[#DCB001]/10 border border-[#DCB001]/30 flex items-center justify-center text-[#DCB001]">
              <Clock size={15} />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white font-mono">{stats.inProgress}</span>
              <span className="text-xs text-[#DCB001] font-mono">Active Tasks</span>
            </div>
            <p className="text-[11px] text-[#787C83] mt-2">
              {stats.needsReview} tasks currently in review
            </p>
          </div>
        </div>

        {/* 3. Subtasks & Folders Tree Health */}
        <div className="bg-[#1B1C1F] border border-[#2A2C30] rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#787C83]">Sub-works & Folders</span>
            <div className="w-7 h-7 rounded-lg bg-[#3B82F6]/10 border border-[#3B82F6]/30 flex items-center justify-center text-[#3B82F6]">
              <FolderTree size={15} />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white font-mono">{stats.totalSubtasks}</span>
              <span className="text-xs text-[#787C83] font-mono">({stats.folderCount} folders)</span>
            </div>
            <div className="w-full h-1.5 bg-[#131415] rounded-full mt-2 overflow-hidden border border-[#2A2C30]">
              <div
                className="h-full bg-[#3B82F6] transition-all duration-500 rounded-full"
                style={{ width: `${stats.subtaskRate}%` }}
              />
            </div>
          </div>
        </div>

        {/* 4. Critical & High Priority Risks */}
        <div className="bg-[#1B1C1F] border border-[#2A2C30] rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#787C83]">High Priority Tasks</span>
            <div className="w-7 h-7 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/30 flex items-center justify-center text-[#EF4444]">
              <Flame size={15} />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white font-mono">{stats.critical + stats.high}</span>
              <span className="text-xs text-[#EF4444] font-mono font-semibold">
                ({stats.critical} Critical)
              </span>
            </div>
            <p className="text-[11px] text-[#787C83] mt-2">
              {stats.medium} Medium · {stats.low} Low
            </p>
          </div>
        </div>
      </div>

      {/* ─── Main Charts Row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Status Distribution Doughnut Chart (4 cols) */}
        <div className="lg:col-span-5 bg-[#1B1C1F] border border-[#2A2C30] rounded-2xl p-5 flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between pb-3 border-b border-[#2A2C30]/50 mb-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <PieIcon size={14} className="text-[#DCB001]" />
              Status Breakdown
            </h3>
            <span className="text-[10px] font-mono text-[#787C83]">{stats.total} Total Tasks</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 my-auto py-2">
            {/* SVG Donut */}
            <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  className="stroke-[#131415]"
                  strokeWidth="10"
                  fill="transparent"
                />
                {donutSlices.map((slice, idx) => (
                  <circle
                    key={idx}
                    cx="50"
                    cy="50"
                    r="45"
                    stroke={slice.color}
                    strokeWidth="10"
                    strokeDasharray={slice.strokeDasharray}
                    strokeDashoffset={slice.strokeDashoffset}
                    strokeLinecap="round"
                    fill="transparent"
                    className="transition-all duration-700 ease-out"
                  />
                ))}
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-xl font-bold text-white font-mono">{stats.total}</span>
                <span className="text-[9px] text-[#787C83] font-mono uppercase">Tasks</span>
              </div>
            </div>

            {/* Legend & Stats */}
            <div className="space-y-2 w-full max-w-[180px]">
              {statusData.map((item, idx) => {
                const pct = stats.total > 0 ? Math.round((item.count / stats.total) * 100) : 0;
                return (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-[#CFD4DD] text-[11px] font-medium">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-mono text-[11px]">
                      <span className="text-white font-bold">{item.count}</span>
                      <span className="text-[#787C83] text-[10px]">({pct}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-[#2A2C30]/50 flex items-center justify-between text-[11px] text-[#787C83]">
            <span>Velocity: {(stats.done * 1.5).toFixed(1)} pts</span>
            <button
              onClick={() => onNavigateTab('board')}
              className="text-[#DCB001] hover:underline font-semibold flex items-center gap-0.5"
            >
              View Board <ArrowUpRight size={12} />
            </button>
          </div>
        </div>

        {/* Right: Priority Distribution & Epic Health (7 cols) */}
        <div className="lg:col-span-7 bg-[#1B1C1F] border border-[#2A2C30] rounded-2xl p-5 flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between pb-3 border-b border-[#2A2C30]/50 mb-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <BarChart3 size={14} className="text-[#3B82F6]" />
              Priority Distribution & Risks
            </h3>
            <span className="text-[10px] font-mono text-[#787C83]">Severity Breakdown</span>
          </div>

          {/* Bar Progress Breakdown */}
          <div className="space-y-3.5 my-auto">
            {/* Critical */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#EF4444] font-semibold flex items-center gap-1.5">
                  <Flame size={12} /> Critical Priority
                </span>
                <span className="font-mono text-white font-bold">{stats.critical} tasks</span>
              </div>
              <div className="w-full h-2 bg-[#131415] rounded-full overflow-hidden border border-[#2A2C30]">
                <div
                  className="h-full bg-[#EF4444] rounded-full transition-all duration-500"
                  style={{ width: `${stats.total > 0 ? (stats.critical / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* High */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#F97316] font-semibold flex items-center gap-1.5">
                  <AlertCircle size={12} /> High Priority
                </span>
                <span className="font-mono text-white font-bold">{stats.high} tasks</span>
              </div>
              <div className="w-full h-2 bg-[#131415] rounded-full overflow-hidden border border-[#2A2C30]">
                <div
                  className="h-full bg-[#F97316] rounded-full transition-all duration-500"
                  style={{ width: `${stats.total > 0 ? (stats.high / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Medium */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#DCB001] font-semibold flex items-center gap-1.5">
                  <Clock size={12} /> Medium Priority
                </span>
                <span className="font-mono text-white font-bold">{stats.medium} tasks</span>
              </div>
              <div className="w-full h-2 bg-[#131415] rounded-full overflow-hidden border border-[#2A2C30]">
                <div
                  className="h-full bg-[#DCB001] rounded-full transition-all duration-500"
                  style={{ width: `${stats.total > 0 ? (stats.medium / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Low */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#787C83] font-semibold flex items-center gap-1.5">
                  <Circle size={12} /> Low Priority
                </span>
                <span className="font-mono text-white font-bold">{stats.low} tasks</span>
              </div>
              <div className="w-full h-2 bg-[#131415] rounded-full overflow-hidden border border-[#2A2C30]">
                <div
                  className="h-full bg-[#787C83] rounded-full transition-all duration-500"
                  style={{ width: `${stats.total > 0 ? (stats.low / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[#2A2C30]/50 flex items-center justify-between text-[11px] text-[#787C83]">
            <span>Active blocker mitigation active</span>
            <button
              onClick={() => onNavigateTab('dev')}
              className="text-[#3B82F6] hover:underline font-semibold flex items-center gap-0.5"
            >
              Open Dev Stream <ArrowUpRight size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* ─── Bottom Row: Epics Progress & Team Members Contribution ──────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Epics Health */}
        <div className="bg-[#1B1C1F] border border-[#2A2C30] rounded-2xl p-5 space-y-4 shadow-md">
          <div className="flex items-center justify-between pb-3 border-b border-[#2A2C30]/50">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Layers size={14} className="text-[#A855F7]" />
              Epic & Feature Progress
            </h3>
            <button
              onClick={() => onNavigateTab('hierarchy')}
              className="text-xs text-[#A855F7] hover:underline font-semibold flex items-center gap-0.5"
            >
              Hierarchical Tree <ArrowUpRight size={12} />
            </button>
          </div>

          <div className="space-y-3">
            {Object.keys(stats.epics).length === 0 ? (
              <p className="text-xs text-[#787C83] py-4 text-center">No epics created yet.</p>
            ) : (
              Object.entries(stats.epics).map(([epicName, epicData], idx) => {
                const pct = Math.round((epicData.done / epicData.total) * 100);
                return (
                  <div key={idx} className="p-3 bg-[#131415] border border-[#2A2C30] rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#CFD4DD] flex items-center gap-1.5">
                        <FolderOpen size={13} className="text-[#DCB001]" />
                        {epicName}
                      </span>
                      <span className="font-mono text-[11px] text-[#787C83]">
                        {epicData.done}/{epicData.total} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-[#1B1C1F] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#A855F7] to-[#DCB001] rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Team Members Contribution */}
        <div className="bg-[#1B1C1F] border border-[#2A2C30] rounded-2xl p-5 space-y-4 shadow-md">
          <div className="flex items-center justify-between pb-3 border-b border-[#2A2C30]/50">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Users size={14} className="text-[#22C55E]" />
              Workload by Member
            </h3>
            <span className="text-[10px] font-mono text-[#787C83]">
              {Object.keys(stats.assignees).length} Assignees
            </span>
          </div>

          <div className="space-y-2.5">
            {Object.entries(stats.assignees).map(([name, data], idx) => {
              const pct = Math.round((data.done / data.total) * 100);
              return (
                <div key={idx} className="p-2.5 bg-[#131415] border border-[#2A2C30] rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Avatar
                      user={{ id: String(idx), name, avatar: data.avatar, email: '', role: '' }}
                      size="sm"
                    />
                    <div>
                      <h4 className="text-xs font-bold text-white">{name}</h4>
                      <span className="text-[10px] text-[#787C83] font-mono">
                        {data.total} tasks assigned ({data.done} completed)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-[#1B1C1F] rounded-full overflow-hidden border border-[#2A2C30]">
                      <div
                        className="h-full bg-[#22C55E] rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono font-bold text-[#22C55E]">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});

ProjectOverviewView.displayName = 'ProjectOverviewView';
