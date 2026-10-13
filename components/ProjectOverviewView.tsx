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
  onNavigateTab: (tab: 'overview' | 'tasks' | 'docs' | 'settings', mode?: 'structure' | 'board' | 'timeline' | 'list' | 'dependencies' | 'tree') => void;
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
    { label: 'Done', count: stats.done, color: '#8400FF' },
    { label: 'In Progress', count: stats.inProgress, color: '#FF0051' },
    { label: 'Review', count: stats.needsReview, color: '#CCA5FD' },
    { label: 'Todo', count: stats.todo, color: '#444444' },
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
    <div className="flex-1 h-full min-h-0 w-full overflow-y-auto bg-[var(--bg-canvas)] text-[var(--text-secondary)] p-4 lg:p-6 space-y-6 select-none font-sans"> 

      {/* ─── Top KPI Metric Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. Overall Completion */}
        <div className="bg-[var(--bg-panel)] border border-[var(--border-primary)] rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-muted)]">Completion Rate</span>
            <div className="w-7 h-7 rounded-lg bg-[#8400FF]/15 border border-[#8400FF]/30 flex items-center justify-center text-[#8400FF]">
              <CheckCircle2 size={15} />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white font-mono">{stats.completionRate}%</span>
              <span className="text-xs text-[var(--text-muted)] font-mono">({stats.done}/{stats.total} done)</span>
            </div>
            <div className="w-full h-1.5 bg-[var(--bg-canvas)] rounded-full mt-2 overflow-hidden border border-[var(--border-primary)]">
              <div
                className="h-full bg-gradient-to-r from-[#8400FF] to-[#FF0051] transition-all duration-500 rounded-full shadow-[0_0_8px_rgba(132,0,255,0.4)]"
                style={{ width: `${stats.completionRate}%` }}
              />
            </div>
          </div>
        </div>

        {/* 2. In Progress Workload */}
        <div className="bg-[var(--bg-panel)] border border-[var(--border-primary)] rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-muted)]">In Progress</span>
            <div className="w-7 h-7 rounded-lg bg-[#FF0051]/15 border border-[#FF0051]/30 flex items-center justify-center text-[#FF0051]">
              <Clock size={15} />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white font-mono">{stats.inProgress}</span>
              <span className="text-xs text-[#FF0051] font-mono font-medium">Active Tasks</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-2">
              {stats.needsReview} tasks currently in review
            </p>
          </div>
        </div>

        {/* 3. Subtasks & Folders Tree Health */}
        <div className="bg-[var(--bg-panel)] border border-[var(--border-primary)] rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-muted)]">Sub-works & Folders</span>
            <div className="w-7 h-7 rounded-lg bg-[#CCA5FD]/15 border border-[#CCA5FD]/30 flex items-center justify-center text-[#CCA5FD]">
              <FolderTree size={15} />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white font-mono">{stats.totalSubtasks}</span>
              <span className="text-xs text-[var(--text-muted)] font-mono">({stats.folderCount} folders)</span>
            </div>
            <div className="w-full h-1.5 bg-[var(--bg-canvas)] rounded-full mt-2 overflow-hidden border border-[var(--border-primary)]">
              <div
                className="h-full bg-gradient-to-r from-[#8400FF] to-[#CCA5FD] transition-all duration-500 rounded-full"
                style={{ width: `${stats.subtaskRate}%` }}
              />
            </div>
          </div>
        </div>

        {/* 4. Critical & High Priority Risks */}
        <div className="bg-[var(--bg-panel)] border border-[var(--border-primary)] rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-muted)]">High Priority Tasks</span>
            <div className="w-7 h-7 rounded-lg bg-[#FF0051]/15 border border-[#FF0051]/30 flex items-center justify-center text-[#FF0051]">
              <Flame size={15} className="text-[#FF0051]" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white font-mono">{stats.critical + stats.high}</span>
              <span className="text-xs text-[#FF0051] font-mono font-semibold">
                ({stats.critical} Critical)
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-2">
              {stats.medium} Medium · {stats.low} Low
            </p>
          </div>
        </div>
      </div>

      {/* ─── Main Charts Row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Status Distribution Doughnut Chart (4 cols) */}
        <div className="lg:col-span-5 bg-[var(--bg-panel)] border border-[var(--border-primary)] rounded-2xl p-5 flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-primary)] mb-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <PieIcon size={14} className="text-white" />
              Status Breakdown
            </h3>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">{stats.total} Total Tasks</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 my-auto py-2">
            {/* SVG Donut */}
            <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  className="stroke-[#000000]"
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
                <span className="text-[9px] text-[var(--text-muted)] font-mono uppercase">Tasks</span>
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
                      <span className="text-[var(--text-secondary)] text-[11px] font-medium">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-mono text-[11px]">
                      <span className="text-white font-bold">{item.count}</span>
                      <span className="text-[var(--text-muted)] text-[10px]">({pct}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--border-primary)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <span>Velocity: {(stats.done * 1.5).toFixed(1)} pts</span>
            <button
              onClick={() => onNavigateTab('tasks', 'board')}
              className="text-white hover:underline font-semibold flex items-center gap-0.5"
            >
              View Board <ArrowUpRight size={12} />
            </button>
          </div>
        </div>

        {/* Right: Priority Distribution & Epic Health (7 cols) */}
        <div className="lg:col-span-7 bg-[var(--bg-panel)] border border-[var(--border-primary)] rounded-2xl p-5 flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-primary)] mb-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <BarChart3 size={14} className="text-white" />
              Priority Distribution & Risks
            </h3>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">Severity Breakdown</span>
          </div>

          {/* Bar Progress Breakdown */}
          <div className="space-y-3.5 my-auto">
            {/* Critical */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white font-semibold flex items-center gap-1.5">
                  <Flame size={12} className="text-[#FF0051]" /> Critical Priority
                </span>
                <span className="font-mono text-[#FF0051] font-bold">{stats.critical} tasks</span>
              </div>
              <div className="w-full h-2 bg-[var(--bg-canvas)] rounded-full overflow-hidden border border-[var(--border-primary)]">
                <div
                  className="h-full bg-[#FF0051] rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(255,0,81,0.5)]"
                  style={{ width: `${stats.total > 0 ? (stats.critical / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* High */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#EDEDED] font-semibold flex items-center gap-1.5">
                  <AlertCircle size={12} className="text-[#FF2D73]" /> High Priority
                </span>
                <span className="font-mono text-[#FF2D73] font-bold">{stats.high} tasks</span>
              </div>
              <div className="w-full h-2 bg-[var(--bg-canvas)] rounded-full overflow-hidden border border-[var(--border-primary)]">
                <div
                  className="h-full bg-[#FF2D73] rounded-full transition-all duration-500 shadow-[0_0_6px_rgba(255,45,115,0.4)]"
                  style={{ width: `${stats.total > 0 ? (stats.high / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Medium */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#A3A3A3] font-semibold flex items-center gap-1.5">
                  <Clock size={12} className="text-[#8400FF]" /> Medium Priority
                </span>
                <span className="font-mono text-[#8400FF] font-bold">{stats.medium} tasks</span>
              </div>
              <div className="w-full h-2 bg-[var(--bg-canvas)] rounded-full overflow-hidden border border-[var(--border-primary)]">
                <div
                  className="h-full bg-[#8400FF] rounded-full transition-all duration-500 shadow-[0_0_6px_rgba(132,0,255,0.4)]"
                  style={{ width: `${stats.total > 0 ? (stats.medium / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Low */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#737373] font-semibold flex items-center gap-1.5">
                  <Circle size={12} className="text-[#CCA5FD]" /> Low Priority
                </span>
                <span className="font-mono text-[#CCA5FD] font-bold">{stats.low} tasks</span>
              </div>
              <div className="w-full h-2 bg-[var(--bg-canvas)] rounded-full overflow-hidden border border-[var(--border-primary)]">
                <div
                  className="h-full bg-[#CCA5FD] rounded-full transition-all duration-500"
                  style={{ width: `${stats.total > 0 ? (stats.low / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--border-primary)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <span>Active blocker mitigation active</span>
            <button
              onClick={() => onNavigateTab('tasks', 'list')}
              className="text-white hover:underline font-semibold flex items-center gap-0.5"
            >
              Open List <ArrowUpRight size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* ─── Bottom Row: Epics Progress & Team Members Contribution ──────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Epics Health */}
        <div className="bg-[var(--bg-panel)] border border-[var(--border-primary)] rounded-2xl p-5 space-y-4 shadow-md">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-primary)]">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Layers size={14} className="text-white" />
              Epic & Feature Progress
            </h3>
            <button
              onClick={() => onNavigateTab('tasks', 'list')}
              className="text-xs text-white hover:underline font-semibold flex items-center gap-0.5"
            >
              Open List <ArrowUpRight size={12} />
            </button>
          </div>

          <div className="space-y-3">
            {Object.keys(stats.epics).length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] py-4 text-center">No epics created yet.</p>
            ) : (
              Object.entries(stats.epics).map(([epicName, epicData], idx) => {
                const pct = Math.round((epicData.done / epicData.total) * 100);
                return (
                  <div key={idx} className="p-3 bg-[var(--bg-canvas)] border border-[var(--border-primary)] rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[var(--text-secondary)] flex items-center gap-1.5">
                        <FolderOpen size={13} className="text-white" />
                        {epicName}
                      </span>
                      <span className="font-mono text-[11px] text-[var(--text-muted)]">
                        {epicData.done}/{epicData.total} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-[var(--bg-panel)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#FFFFFF] to-[#FFFFFF] rounded-full transition-all duration-500"
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
        <div className="bg-[var(--bg-panel)] border border-[var(--border-primary)] rounded-2xl p-5 space-y-4 shadow-md">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-primary)]">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Users size={14} className="text-white" />
              Workload by Member
            </h3>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">
              {Object.keys(stats.assignees).length} Assignees
            </span>
          </div>

          <div className="space-y-2.5">
            {Object.entries(stats.assignees).map(([name, data], idx) => {
              const pct = Math.round((data.done / data.total) * 100);
              return (
                <div key={idx} className="p-2.5 bg-[var(--bg-canvas)] border border-[var(--border-primary)] rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Avatar
                      user={{ id: String(idx), name, avatar: data.avatar, email: '', role: '' }}
                      size="sm"
                    />
                    <div>
                      <h4 className="text-xs font-bold text-white">{name}</h4>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">
                        {data.total} tasks assigned ({data.done} completed)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-[var(--bg-panel)] rounded-full overflow-hidden border border-[var(--border-primary)]">
                      <div
                        className="h-full bg-[var(--ramp-3)] rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono font-bold text-white">{pct}%</span>
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
