'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/AppLayout';
import { Issue, Status, Priority } from '@/lib/types';
import { getLocalCache, setLocalCache } from '@/lib/client-cache';
import { RandomLoadingText } from '@/components/ui/RandomLoadingText';
import { useRealtimeSubscription, RealtimeEvent } from '@/lib/useRealtime';
import { RealtimeBadge } from '@/components/RealtimeBadge';
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
        }
        if (Array.isArray(issueData)) {
          setIssues(issueData);
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

  // ─── Real-Time WebSocket Dynamic Synchronization ────────────────────────────
  useRealtimeSubscription({
    onEvent: useCallback((event: RealtimeEvent) => {
      switch (event.type) {
        case 'TASK_CREATED': {
          const newTask = event.payload;
          if (newTask) {
            setIssues((prev) => {
              const existingIdx = prev.findIndex(
                (i) => i.id === newTask.id || (String(i.id).startsWith('temp_') && (i.title === newTask.title || i.key === newTask.key))
              );
              if (existingIdx !== -1) {
                const next = [...prev];
                next[existingIdx] = newTask;
                return next;
              }
              return [newTask, ...prev];
            });
          }
          break;
        }

        case 'TASK_UPDATED': {
          const updated = event.payload;
          if (updated && updated.id) {
            setIssues((prev) =>
              prev.map((i) => (i.id === updated.id ? { ...i, ...updated } : i))
            );
          }
          break;
        }

        case 'TASKS_REORDERED': {
          const items: Array<{ id: string; orderIndex: number; status?: Status }> = event.payload?.items || [];
          if (items.length > 0) {
            const map = new Map(items.map((it) => [it.id, it]));
            setIssues((prev) =>
              prev.map((iss) => {
                const update = map.get(iss.id);
                if (update) {
                  return {
                    ...iss,
                    orderIndex: update.orderIndex,
                    status: update.status || iss.status,
                  };
                }
                return iss;
              })
            );
          }
          break;
        }

        case 'TASK_DELETED': {
          const deletedId = event.payload?.id;
          if (deletedId) {
            setIssues((prev) => prev.filter((i) => i.id !== deletedId));
          }
          break;
        }

        case 'PROJECT_CREATED':
        case 'PROJECT_UPDATED':
        case 'PROJECT_DELETED': {
          fetchDashboardData();
          break;
        }

        default:
          break;
      }
    }, [fetchDashboardData]),
  });

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
        <div className="flex-1 flex items-center justify-center h-full p-6">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col h-full min-h-0 bg-[#000000] text-[var(--text-secondary)] font-sans overflow-y-auto custom-scrollbar select-none">
        {/* Top Header Banner */}
        <div className="px-6 py-6 border-b border-[var(--border-primary)] bg-[var(--bg-panel)]/80 backdrop-blur-md shrink-0">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium tracking-wider text-white mb-1">
                <Sparkles size={13} />
                <span>WORKSPACE OVERVIEW & ANALYTICS</span>
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Executive Dashboard</h1>
              <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                Real-time aggregated health, task velocity, and project graphs across all repositories.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2.5">
              <RealtimeBadge />
              <Link
                href="/projects"
                className="flex items-center gap-2 px-5 py-2.5 bg-[#1E1E1E] hover:bg-[#282828] border border-[var(--border-primary)] hover:border-[var(--border-secondary)] text-white rounded-lg text-sm font-medium transition-all shadow-sm"
              >
                <FolderKanban size={14} className="text-white" />
                <span>Explore All Projects ({projects.length})</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Dashboard Main Content Grid */}
        <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
          {/* 1. Global Stat KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* Card: Total Projects */}
            <div className="p-5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-primary)] flex flex-col justify-between hover:border-[var(--border-secondary)] transition-all shadow-sm">
              <div className="flex items-center justify-between text-[var(--text-muted)]">
                <span className="text-xs font-semibold tracking-wide">PROJECTS</span>
                <FolderKanban size={15} className="text-white" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white font-mono">{globalMetrics.totalProjects}</span>
                <span className="text-xs text-white font-mono">Active</span>
              </div>
            </div>

            {/* Card: Total Tasks */}
            <div className="p-5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-primary)] flex flex-col justify-between hover:border-[var(--border-secondary)] transition-all shadow-sm">
              <div className="flex items-center justify-between text-[var(--text-muted)]">
                <span className="text-xs font-semibold tracking-wide">TOTAL TASKS</span>
                <Layers size={15} className="text-white" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white font-mono">{globalMetrics.totalTasks}</span>
                <span className="text-xs text-[var(--text-secondary)] font-mono">Global</span>
              </div>
            </div>

            {/* Card: In Progress */}
            <div className="p-5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-primary)] flex flex-col justify-between hover:border-[#FFFFFF]/50 transition-all shadow-sm">
              <div className="flex items-center justify-between text-[var(--text-muted)]">
                <span className="text-xs font-semibold tracking-wide">IN PROGRESS</span>
                <Flame size={15} className="text-white" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white font-mono">{globalMetrics.inProgress}</span>
                <span className="text-xs text-[var(--text-secondary)] font-mono">Active</span>
              </div>
            </div>

            {/* Card: Blocked */}
            <div className="p-5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-primary)] flex flex-col justify-between hover:border-[var(--border-secondary)] transition-all shadow-sm">
              <div className="flex items-center justify-between text-[var(--text-muted)]">
                <span className="text-xs font-semibold tracking-wide">BLOCKED</span>
                <ShieldAlert size={15} className="text-white" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white font-mono">{globalMetrics.blocked}</span>
                <span className="text-xs text-white font-mono">Needs Lead</span>
              </div>
            </div>

            {/* Card: Done */}
            <div className="p-5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-primary)] flex flex-col justify-between hover:border-[var(--border-secondary)] transition-all shadow-sm">
              <div className="flex items-center justify-between text-[var(--text-muted)]">
                <span className="text-xs font-semibold tracking-wide">COMPLETED</span>
                <CheckCircle2 size={15} className="text-white" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white font-mono">{globalMetrics.completed}</span>
                <span className="text-xs text-white font-mono">Shipped</span>
              </div>
            </div>

            {/* Card: Completion Velocity */}
            <div className="p-5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-primary)] flex flex-col justify-between hover:border-[var(--border-secondary)] transition-all shadow-sm">
              <div className="flex items-center justify-between text-[var(--text-muted)]">
                <span className="text-xs font-semibold tracking-wide">VELOCITY</span>
                <TrendingUp size={15} className="text-white" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white font-mono">{globalMetrics.overallPercent}%</span>
                <span className="text-xs text-[var(--text-secondary)] font-mono">{globalMetrics.totalEstHours}h est</span>
              </div>
            </div>
          </div>

          {/* 2. Visual Task Pipeline & Distribution Graph */}
          <div className="p-5 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border-primary)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-white" />
                <h2 className="text-base font-bold text-white tracking-tight">Global Task Status Spectrum</h2>
              </div>
              <span className="text-sm text-[var(--text-secondary)]">{globalMetrics.totalTasks} Tasks Tracked</span>
            </div>

            {/* Visual Segmented Progress Bar */}
            <div className="w-full h-3.5 bg-[var(--bg-panel)] rounded-full overflow-hidden flex p-0.5 gap-0.5 border border-[var(--border-primary)]">
              {globalMetrics.completed > 0 && (
                <div
                  style={{ width: `${(globalMetrics.completed / globalMetrics.totalTasks) * 100}%` }}
                  className="bg-[var(--ramp-3)] rounded-full transition-all duration-500"
                  title={`Done: ${globalMetrics.completed} tasks`}
                />
              )}
              {globalMetrics.inProgress > 0 && (
                <div
                  style={{ width: `${(globalMetrics.inProgress / globalMetrics.totalTasks) * 100}%` }}
                  className="bg-white text-black rounded-full transition-all duration-500"
                  title={`In Progress: ${globalMetrics.inProgress} tasks`}
                />
              )}
              {globalMetrics.needsReview > 0 && (
                <div
                  style={{ width: `${(globalMetrics.needsReview / globalMetrics.totalTasks) * 100}%` }}
                  className="bg-[var(--ramp-3)] rounded-full transition-all duration-500"
                  title={`Needs Review: ${globalMetrics.needsReview} tasks`}
                />
              )}
              {globalMetrics.blocked > 0 && (
                <div
                  style={{ width: `${(globalMetrics.blocked / globalMetrics.totalTasks) * 100}%` }}
                  className="bg-[var(--ramp-3)] rounded-full transition-all duration-500"
                  title={`Blocked: ${globalMetrics.blocked} tasks`}
                />
              )}
              {globalMetrics.todo > 0 && (
                <div
                  style={{ width: `${(globalMetrics.todo / globalMetrics.totalTasks) * 100}%` }}
                  className="bg-[#505050] rounded-full transition-all duration-500"
                  title={`Todo: ${globalMetrics.todo} tasks`}
                />
              )}
            </div>

            {/* Legend & Breakdown Chips */}
            <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--ramp-3)]" />
                <span className="text-[var(--text-secondary)]">Done:</span>
                <span className="font-bold text-white font-mono">{globalMetrics.completed}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-white text-black" />
                <span className="text-[var(--text-secondary)]">In Progress:</span>
                <span className="font-bold text-white font-mono">{globalMetrics.inProgress}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--ramp-3)]" />
                <span className="text-[var(--text-secondary)]">Needs Review:</span>
                <span className="font-bold text-white font-mono">{globalMetrics.needsReview}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--ramp-3)]" />
                <span className="text-[var(--text-secondary)]">Blocked:</span>
                <span className="font-bold text-white font-mono">{globalMetrics.blocked}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#505050]" />
                <span className="text-[var(--text-secondary)]">Todo:</span>
                <span className="font-bold text-white font-mono">{globalMetrics.todo}</span>
              </div>
            </div>
          </div>

          {/* 3. Projects Overview Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderKanban size={16} className="text-white" />
                <h2 className="text-base font-bold text-white tracking-tight">Active Projects Overview</h2>
              </div>
              <Link
                href="/projects"
                className="text-xs font-mono text-white hover:underline flex items-center gap-1"
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
                  className="p-5 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border-primary)] hover:border-[var(--border-secondary)] transition-all cursor-pointer shadow-md flex flex-col justify-between space-y-4 group hover:scale-[1.01]"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 bg-[var(--bg-panel)] border border-[var(--border-primary)] text-white font-mono text-xs font-bold rounded">
                        {proj.key}
                      </span>
                      <span className="text-xs text-[var(--text-secondary)]">
                        Owner: <span className="text-[var(--text-secondary)]">{proj.ownerName}</span>
                      </span>
                    </div>

                    <h3 className="text-base font-semibold text-white group-hover:text-white transition-colors line-clamp-1">
                      {proj.name}
                    </h3>
                    <p className="text-sm text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                      {proj.description || 'Enterprise project repository with full task lifecycle and branch explorer graph.'}
                    </p>
                  </div>

                  {/* Progress & Metrics */}
                  <div className="space-y-2 pt-2 border-t border-[var(--border-primary)]">
                    <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                      <span>Progress</span>
                      <span className="text-white font-bold">{proj.progressPercent}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-[var(--bg-panel)] rounded-full overflow-hidden">
                      <div
                        style={{ width: `${proj.progressPercent}%` }}
                        className="h-full bg-white text-black rounded-full transition-all duration-300"
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] pt-1">
                      <span>{proj.totalTasks} Tasks</span>
                      <span className="text-white">{proj.completedTasks} Done</span>
                      {proj.blockedTasks > 0 ? (
                        <span className="text-white font-bold">{proj.blockedTasks} Blocked</span>
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
          <div className="p-5 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border-primary)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BarChart3 size={16} className="text-white" />
                <h2 className="text-base font-bold text-white tracking-tight">Cross-Project Task Feed</h2>
              </div>

              {/* Status Filter Chips */}
              <div className="flex items-center gap-1 bg-[#111111] p-1 rounded-lg border border-[var(--border-primary)] text-xs">
                <button
                  onClick={() => setActiveFilter('all')}
                  className={`px-3 py-1.5 rounded font-medium transition-all ${
                    activeFilter === 'all'
                      ? 'bg-[#242424] text-white'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  All ({issues.length})
                </button>
                <button
                  onClick={() => setActiveFilter('in_progress')}
                  className={`px-3 py-1.5 rounded font-medium transition-all ${
                    activeFilter === 'in_progress'
                      ? 'bg-white/20 text-white'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  In Progress ({globalMetrics.inProgress})
                </button>
                <button
                  onClick={() => setActiveFilter('blocked')}
                  className={`px-3 py-1.5 rounded font-medium transition-all ${
                    activeFilter === 'blocked'
                      ? 'bg-[var(--ramp-3)]/20 text-white'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  Blocked ({globalMetrics.blocked})
                </button>
                <button
                  onClick={() => setActiveFilter('done')}
                  className={`px-3 py-1.5 rounded font-medium transition-all ${
                    activeFilter === 'done'
                      ? 'bg-[var(--ramp-3)]/20 text-white'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  Done ({globalMetrics.completed})
                </button>
              </div>
            </div>

            {/* Tasks Table / List */}
            <div className="divide-y divide-[var(--border-primary)] overflow-hidden">
              {filteredIssues.slice(0, 15).map((iss) => {
                const isBlocked = iss.status === 'blocked' || (iss.blockedBy && iss.blockedBy.length > 0);
                const isDone = iss.status === 'done' || iss.status === 'merged';

                return (
                  <div
                    key={iss.id}
                    onClick={() => router.push(`/task/${iss.id}/details`)}
                    className="py-3.5 px-3 flex items-center justify-between gap-4 hover:bg-[var(--bg-panel)]/60 rounded-lg transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs font-bold text-white bg-[#111111] border border-[var(--border-primary)] px-2 py-0.5 rounded shrink-0">
                        {iss.key}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white group-hover:text-white transition-colors truncate">
                          {iss.title}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)] font-mono truncate">
                          {iss.epic || iss.project || 'General'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Priority */}
                      <span
                        className={`text-xs font-mono px-2 py-0.5 rounded capitalize ${
                          iss.priority === 'critical'
                            ? 'bg-[var(--ramp-3)]/20 text-white border border-[var(--border-secondary)]'
                            : iss.priority === 'high'
                            ? 'bg-white/20 text-white'
                            : 'bg-[#212121] text-[var(--text-secondary)]'
                        }`}
                      >
                        {iss.priority}
                      </span>

                      {/* Status */}
                      <span
                        className={`text-xs font-mono px-2 py-0.5 rounded capitalize ${
                          isDone
                            ? 'bg-[var(--ramp-3)]/15 text-white'
                            : isBlocked
                            ? 'bg-[var(--ramp-3)]/15 text-white'
                            : iss.status === 'in_progress'
                            ? 'bg-white/15 text-white'
                            : 'bg-[var(--bg-panel)] text-[var(--text-secondary)]'
                        }`}
                      >
                        {iss.status.replace('_', ' ')}
                      </span>

                      {/* Assignee */}
                      <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-[var(--text-secondary)]">
                        <User size={12} className="text-[var(--text-secondary)]" />
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
