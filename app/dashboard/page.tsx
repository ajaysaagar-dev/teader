'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/AppLayout';
import { Issue, Status, Priority } from '@/lib/types';
import { getLocalCache, setLocalCache } from '@/lib/client-cache';
import { RandomLoadingText } from '@/components/ui/RandomLoadingText';
import { 
  FolderKanban, 
  CheckCircle2, 
  Clock, 
  ShieldAlert, 
  Layers, 
  TrendingUp, 
  ArrowUpRight, 
  User, 
  Sparkles,
  BarChart3,
  Calendar,
  AlertTriangle,
  Flame,
  ArrowRight,
  Activity,
  Check
} from 'lucide-react';

interface ProjectSummary {
  id: string | number;
  key: string;
  name: string;
  description?: string;
  ownerName?: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  blockedTasks: number;
  progressPercent: number;
  totalEstimatedHours: number;
  assignees: string[];
}

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'in_progress' | 'blocked' | 'done'>('all');

  // Hydrate from cache on mount for 0ms initial render
  useEffect(() => {
    const cachedProjects = getLocalCache<any[]>('dashboard_projects', []);
    const cachedIssues = getLocalCache<Issue[]>('dashboard_issues', []);
    if (cachedProjects.length > 0 || cachedIssues.length > 0) {
      setProjects(cachedProjects);
      setIssues(cachedIssues);
      setLoading(false);
    }
  }, []);

  // Fetch live global projects and issues from database
  const fetchDashboardData = useCallback(async () => {
    try {
      const [projRes, issueRes] = await Promise.all([
        fetch('/api/projects', { cache: 'no-store' }),
        fetch('/api/issues', { cache: 'no-store' }),
      ]);

      if (projRes.status === 401 || issueRes.status === 401) {
        router.push('/login');
        return;
      }

      if (projRes.ok && issueRes.ok) {
        const projData = await projRes.json();
        const issueData = await issueRes.json();

        if (Array.isArray(projData)) {
          setProjects(projData);
          setLocalCache('dashboard_projects', projData);
        }
        if (Array.isArray(issueData)) {
          setIssues(issueData);
          setLocalCache('dashboard_issues', issueData);
        }
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Aggregate Cross-Project Metrics
  const projectSummaries: ProjectSummary[] = useMemo(() => {
    return projects.map((p) => {
      const pId = String(p.id);
      const pKey = String(p.key).toLowerCase();
      const pName = String(p.name).toLowerCase();

      // Match issues belonging to this project
      const projIssues = issues.filter((iss: any) => {
        const issProjId = String(iss.projectId || '');
        const issProjName = String(iss.project || '').toLowerCase();
        const issKey = String(iss.key || '').toLowerCase();
        return (
          issProjId === pId ||
          issProjName === pName ||
          issKey.startsWith(`${pKey}-`)
        );
      });

      const total = projIssues.length;
      const completed = projIssues.filter((i) => i.status === 'done' || i.status === 'merged').length;
      const inProgress = projIssues.filter((i) => i.status === 'in_progress').length;
      const blocked = projIssues.filter((i) => {
        const b = Array.isArray(i.blockedBy) ? i.blockedBy : [];
        return i.status === 'blocked' || b.length > 0;
      }).length;

      const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
      const totalHours = projIssues.reduce((acc, curr) => acc + (Number(curr.estimatedHours) || 0), 0);

      const assigneesSet = new Set<string>();
      projIssues.forEach((iss) => {
        if (iss.assigneeName) assigneesSet.add(iss.assigneeName);
      });

      return {
        id: p.id,
        key: p.key,
        name: p.name,
        description: p.description || '',
        ownerName: p.ownerName || 'karri',
        totalTasks: total,
        completedTasks: completed,
        inProgressTasks: inProgress,
        blockedTasks: blocked,
        progressPercent,
        totalEstimatedHours: totalHours,
        assignees: Array.from(assigneesSet),
      };
    });
  }, [projects, issues]);

  // Global KPIs
  const globalMetrics = useMemo(() => {
    const total = issues.length;
    const completed = issues.filter((i) => i.status === 'done' || i.status === 'merged').length;
    const inProgress = issues.filter((i) => i.status === 'in_progress').length;
    const blocked = issues.filter((i) => {
      const b = Array.isArray(i.blockedBy) ? i.blockedBy : [];
      return i.status === 'blocked' || b.length > 0;
    }).length;
    const needsReview = issues.filter((i) => i.status === 'needs_review').length;
    const todo = issues.filter((i) => i.status === 'todo').length;
    const totalEstHours = issues.reduce((acc, curr) => acc + (Number(curr.estimatedHours) || 0), 0);
    const overallPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Critical and high priority
    const criticalCount = issues.filter((i) => i.priority === 'critical').length;
    const highCount = issues.filter((i) => i.priority === 'high').length;

    return {
      totalProjects: projects.length,
      totalTasks: total,
      completed,
      inProgress,
      blocked,
      needsReview,
      todo,
      totalEstHours,
      overallPercent,
      criticalCount,
      highCount,
    };
  }, [projects, issues]);

  // Filtered Issues for Recent Activity
  const filteredIssues = useMemo(() => {
    if (activeFilter === 'in_progress') return issues.filter((i) => i.status === 'in_progress');
    if (activeFilter === 'blocked') {
      return issues.filter((i) => {
        const b = Array.isArray(i.blockedBy) ? i.blockedBy : [];
        return i.status === 'blocked' || b.length > 0;
      });
    }
    if (activeFilter === 'done') return issues.filter((i) => i.status === 'done');
    return issues;
  }, [issues, activeFilter]);

  if (loading && issues.length === 0) {
    return (
      <AppLayout>
        <div className="flex-1 flex flex-col items-center justify-center h-full bg-[#101112] text-[#CFD4DD] p-6 space-y-4">
          <div className="w-10 h-10 border-2 border-[#DCB001] border-t-transparent rounded-full animate-spin" />
          <RandomLoadingText />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col h-full min-h-0 bg-[#0E0F11] text-[#CFD4DD] font-sans overflow-y-auto custom-scrollbar select-none">
        {/* Top Header Banner */}
        <div className="px-6 py-6 border-b border-[#2A2C30] bg-[#141517]/80 backdrop-blur-md shrink-0">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-[#DCB001] mb-1">
                <Sparkles size={13} />
                <span>WORKSPACE OVERVIEW & ANALYTICS</span>
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Executive Dashboard</h1>
              <p className="text-xs text-[#787C83] mt-0.5">
                Real-time aggregated health, task velocity, and project graphs across all repositories.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2.5">
              <Link
                href="/projects"
                className="flex items-center gap-2 px-3.5 py-2 bg-[#1C1D20] hover:bg-[#25272B] border border-[#2A2C30] hover:border-[#DCB001]/50 text-white rounded-lg text-xs font-medium transition-all shadow-sm"
              >
                <FolderKanban size={14} className="text-[#DCB001]" />
                <span>Explore All Projects ({projects.length})</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Dashboard Main Content Grid */}
        <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
          {/* 1. Global Stat KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {/* Card: Total Projects */}
            <div className="p-4 rounded-xl bg-[#141517] border border-[#2A2C30] flex flex-col justify-between hover:border-[#DCB001]/50 transition-all shadow-sm">
              <div className="flex items-center justify-between text-[#787C83]">
                <span className="text-[11px] font-mono font-medium">PROJECTS</span>
                <FolderKanban size={15} className="text-[#DCB001]" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white font-mono">{globalMetrics.totalProjects}</span>
                <span className="text-[10px] text-[#22C55E] font-mono">Active</span>
              </div>
            </div>

            {/* Card: Total Tasks */}
            <div className="p-4 rounded-xl bg-[#141517] border border-[#2A2C30] flex flex-col justify-between hover:border-[#DCB001]/50 transition-all shadow-sm">
              <div className="flex items-center justify-between text-[#787C83]">
                <span className="text-[11px] font-mono font-medium">TOTAL TASKS</span>
                <Layers size={15} className="text-[#06B6D4]" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white font-mono">{globalMetrics.totalTasks}</span>
                <span className="text-[10px] text-[#787C83] font-mono">Global</span>
              </div>
            </div>

            {/* Card: In Progress */}
            <div className="p-4 rounded-xl bg-[#141517] border border-[#2A2C30] flex flex-col justify-between hover:border-[#F59E0B]/50 transition-all shadow-sm">
              <div className="flex items-center justify-between text-[#787C83]">
                <span className="text-[11px] font-mono font-medium">IN PROGRESS</span>
                <Flame size={15} className="text-[#F59E0B]" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[#F59E0B] font-mono">{globalMetrics.inProgress}</span>
                <span className="text-[10px] text-[#787C83] font-mono">Active</span>
              </div>
            </div>

            {/* Card: Blocked */}
            <div className="p-4 rounded-xl bg-[#141517] border border-[#2A2C30] flex flex-col justify-between hover:border-[#EF4444]/50 transition-all shadow-sm">
              <div className="flex items-center justify-between text-[#787C83]">
                <span className="text-[11px] font-mono font-medium">BLOCKED</span>
                <ShieldAlert size={15} className="text-[#EF4444]" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[#EF4444] font-mono">{globalMetrics.blocked}</span>
                <span className="text-[10px] text-[#EF4444] font-mono">Needs Lead</span>
              </div>
            </div>

            {/* Card: Done */}
            <div className="p-4 rounded-xl bg-[#141517] border border-[#2A2C30] flex flex-col justify-between hover:border-[#22C55E]/50 transition-all shadow-sm">
              <div className="flex items-center justify-between text-[#787C83]">
                <span className="text-[11px] font-mono font-medium">COMPLETED</span>
                <CheckCircle2 size={15} className="text-[#22C55E]" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[#22C55E] font-mono">{globalMetrics.completed}</span>
                <span className="text-[10px] text-[#22C55E] font-mono">Shipped</span>
              </div>
            </div>

            {/* Card: Completion Velocity */}
            <div className="p-4 rounded-xl bg-[#141517] border border-[#2A2C30] flex flex-col justify-between hover:border-[#A855F7]/50 transition-all shadow-sm">
              <div className="flex items-center justify-between text-[#787C83]">
                <span className="text-[11px] font-mono font-medium">VELOCITY</span>
                <TrendingUp size={15} className="text-[#A855F7]" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white font-mono">{globalMetrics.overallPercent}%</span>
                <span className="text-[10px] text-[#787C83] font-mono">{globalMetrics.totalEstHours}h est</span>
              </div>
            </div>
          </div>

          {/* 2. Visual Task Pipeline & Distribution Graph */}
          <div className="p-5 rounded-2xl bg-[#141517] border border-[#2A2C30] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-[#DCB001]" />
                <h2 className="text-sm font-bold text-white tracking-tight">Global Task Status Spectrum</h2>
              </div>
              <span className="text-xs font-mono text-[#787C83]">{globalMetrics.totalTasks} Tasks Tracked</span>
            </div>

            {/* Visual Segmented Progress Bar */}
            <div className="w-full h-3.5 bg-[#1B1C1F] rounded-full overflow-hidden flex p-0.5 gap-0.5 border border-[#2A2C30]">
              {globalMetrics.completed > 0 && (
                <div
                  style={{ width: `${(globalMetrics.completed / globalMetrics.totalTasks) * 100}%` }}
                  className="bg-[#22C55E] rounded-full transition-all duration-500"
                  title={`Done: ${globalMetrics.completed} tasks`}
                />
              )}
              {globalMetrics.inProgress > 0 && (
                <div
                  style={{ width: `${(globalMetrics.inProgress / globalMetrics.totalTasks) * 100}%` }}
                  className="bg-[#F59E0B] rounded-full transition-all duration-500"
                  title={`In Progress: ${globalMetrics.inProgress} tasks`}
                />
              )}
              {globalMetrics.needsReview > 0 && (
                <div
                  style={{ width: `${(globalMetrics.needsReview / globalMetrics.totalTasks) * 100}%` }}
                  className="bg-[#A855F7] rounded-full transition-all duration-500"
                  title={`Needs Review: ${globalMetrics.needsReview} tasks`}
                />
              )}
              {globalMetrics.blocked > 0 && (
                <div
                  style={{ width: `${(globalMetrics.blocked / globalMetrics.totalTasks) * 100}%` }}
                  className="bg-[#EF4444] rounded-full transition-all duration-500"
                  title={`Blocked: ${globalMetrics.blocked} tasks`}
                />
              )}
              {globalMetrics.todo > 0 && (
                <div
                  style={{ width: `${(globalMetrics.todo / globalMetrics.totalTasks) * 100}%` }}
                  className="bg-[#4B4E56] rounded-full transition-all duration-500"
                  title={`Todo: ${globalMetrics.todo} tasks`}
                />
              )}
            </div>

            {/* Legend & Breakdown Chips */}
            <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
              <div className="flex items-center gap-1.5 font-mono">
                <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E]" />
                <span className="text-[#CFD4DD]">Done:</span>
                <span className="font-bold text-white">{globalMetrics.completed}</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
                <span className="text-[#CFD4DD]">In Progress:</span>
                <span className="font-bold text-white">{globalMetrics.inProgress}</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="w-2.5 h-2.5 rounded-full bg-[#A855F7]" />
                <span className="text-[#CFD4DD]">Needs Review:</span>
                <span className="font-bold text-white">{globalMetrics.needsReview}</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
                <span className="text-[#CFD4DD]">Blocked:</span>
                <span className="font-bold text-white">{globalMetrics.blocked}</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="w-2.5 h-2.5 rounded-full bg-[#4B4E56]" />
                <span className="text-[#CFD4DD]">Todo:</span>
                <span className="font-bold text-white">{globalMetrics.todo}</span>
              </div>
            </div>
          </div>

          {/* 3. Projects Overview Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderKanban size={16} className="text-[#DCB001]" />
                <h2 className="text-base font-bold text-white tracking-tight">Active Projects Overview</h2>
              </div>
              <Link
                href="/projects"
                className="text-xs font-mono text-[#DCB001] hover:underline flex items-center gap-1"
              >
                <span>View all projects</span>
                <ArrowRight size={12} />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projectSummaries.map((proj) => (
                <div
                  key={proj.id}
                  onClick={() => router.push(`/projects/${proj.id}`)}
                  className="p-5 rounded-2xl bg-[#141517] border border-[#2A2C30] hover:border-[#DCB001]/60 transition-all cursor-pointer shadow-md flex flex-col justify-between space-y-4 group hover:scale-[1.01]"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 bg-[#1B1C1F] border border-[#2A2C30] text-[#DCB001] font-mono text-xs font-bold rounded">
                        {proj.key}
                      </span>
                      <span className="text-[11px] font-mono text-[#787C83]">
                        Owner: <span className="text-[#CFD4DD]">{proj.ownerName}</span>
                      </span>
                    </div>

                    <h3 className="text-base font-semibold text-white group-hover:text-[#DCB001] transition-colors line-clamp-1">
                      {proj.name}
                    </h3>
                    <p className="text-xs text-[#787C83] line-clamp-2 leading-relaxed">
                      {proj.description || 'Enterprise project repository with full task lifecycle and branch explorer graph.'}
                    </p>
                  </div>

                  {/* Progress & Metrics */}
                  <div className="space-y-2 pt-2 border-t border-[#2A2C30]/50">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-[#787C83]">Progress</span>
                      <span className="text-white font-bold">{proj.progressPercent}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#1B1C1F] rounded-full overflow-hidden">
                      <div
                        style={{ width: `${proj.progressPercent}%` }}
                        className="h-full bg-[#DCB001] rounded-full transition-all duration-300"
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-[#787C83] pt-1">
                      <span>{proj.totalTasks} Tasks</span>
                      <span className="text-[#22C55E]">{proj.completedTasks} Done</span>
                      {proj.blockedTasks > 0 ? (
                        <span className="text-[#EF4444] font-bold">{proj.blockedTasks} Blocked</span>
                      ) : (
                        <span>{proj.totalEstimatedHours}h est</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Recent Tasks Activity Feed with Quick Filters */}
          <div className="p-5 rounded-2xl bg-[#141517] border border-[#2A2C30] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BarChart3 size={16} className="text-[#DCB001]" />
                <h2 className="text-base font-bold text-white tracking-tight">Cross-Project Task Feed</h2>
              </div>

              {/* Status Filter Chips */}
              <div className="flex items-center gap-1 bg-[#101113] p-1 rounded-lg border border-[#2A2C30] text-xs">
                <button
                  onClick={() => setActiveFilter('all')}
                  className={`px-2.5 py-1 rounded font-medium transition-all ${
                    activeFilter === 'all'
                      ? 'bg-[#222427] text-white'
                      : 'text-[#787C83] hover:text-[#CFD4DD]'
                  }`}
                >
                  All ({issues.length})
                </button>
                <button
                  onClick={() => setActiveFilter('in_progress')}
                  className={`px-2.5 py-1 rounded font-medium transition-all ${
                    activeFilter === 'in_progress'
                      ? 'bg-[#F59E0B]/20 text-[#F59E0B]'
                      : 'text-[#787C83] hover:text-[#CFD4DD]'
                  }`}
                >
                  In Progress ({globalMetrics.inProgress})
                </button>
                <button
                  onClick={() => setActiveFilter('blocked')}
                  className={`px-2.5 py-1 rounded font-medium transition-all ${
                    activeFilter === 'blocked'
                      ? 'bg-[#EF4444]/20 text-[#EF4444]'
                      : 'text-[#787C83] hover:text-[#CFD4DD]'
                  }`}
                >
                  Blocked ({globalMetrics.blocked})
                </button>
                <button
                  onClick={() => setActiveFilter('done')}
                  className={`px-2.5 py-1 rounded font-medium transition-all ${
                    activeFilter === 'done'
                      ? 'bg-[#22C55E]/20 text-[#22C55E]'
                      : 'text-[#787C83] hover:text-[#CFD4DD]'
                  }`}
                >
                  Done ({globalMetrics.completed})
                </button>
              </div>
            </div>

            {/* Tasks Table / List */}
            <div className="divide-y divide-[#2A2C30]/40 overflow-hidden">
              {filteredIssues.slice(0, 15).map((iss) => {
                const isBlocked = iss.status === 'blocked' || (iss.blockedBy && iss.blockedBy.length > 0);
                const isDone = iss.status === 'done' || iss.status === 'merged';

                return (
                  <div
                    key={iss.id}
                    onClick={() => router.push(`/projects/${iss.projectId || 1}`)}
                    className="py-3 px-2 flex items-center justify-between gap-4 hover:bg-[#1B1C1F]/60 rounded-lg transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs font-bold text-[#DCB001] bg-[#101113] border border-[#2A2C30] px-2 py-0.5 rounded shrink-0">
                        {iss.key}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white group-hover:text-[#DCB001] transition-colors truncate">
                          {iss.title}
                        </p>
                        <p className="text-[10px] text-[#787C83] font-mono truncate">
                          {iss.epic || iss.project || 'General'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Priority */}
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded capitalize ${
                          iss.priority === 'critical'
                            ? 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30'
                            : iss.priority === 'high'
                            ? 'bg-[#F59E0B]/20 text-[#F59E0B]'
                            : 'bg-[#1F2023] text-[#787C83]'
                        }`}
                      >
                        {iss.priority}
                      </span>

                      {/* Status */}
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded capitalize ${
                          isDone
                            ? 'bg-[#22C55E]/15 text-[#22C55E]'
                            : isBlocked
                            ? 'bg-[#EF4444]/15 text-[#EF4444]'
                            : iss.status === 'in_progress'
                            ? 'bg-[#F59E0B]/15 text-[#F59E0B]'
                            : 'bg-[#1B1C1F] text-[#9BA1A6]'
                        }`}
                      >
                        {iss.status.replace('_', ' ')}
                      </span>

                      {/* Assignee */}
                      <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-[#9BA1A6]">
                        <User size={11} className="text-[#787C83]" />
                        <span>{iss.assigneeName || 'Unassigned'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
