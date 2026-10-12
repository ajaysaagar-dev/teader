'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Issue, Status, Priority } from '@/lib/types';
import { useRealtimeSubscription, RealtimeEvent } from '@/lib/useRealtime';
import { RealtimeBadge } from '@/components/RealtimeBadge';
import { 
  UserCheck, 
  Clock, 
  ShieldAlert, 
  CheckCircle2, 
  Calendar, 
  Play, 
  Square, 
  RotateCcw, 
  ArrowRight, 
  Search, 
  Sparkles, 
  FolderKanban,
  Flame,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function MyWorkPage() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams?.get('tab') as 'assigned' | 'blocked' | 'due' | 'completed') || 'assigned';

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTabState] = useState<'assigned' | 'blocked' | 'due' | 'completed'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');

  const setFilterTab = (tab: 'assigned' | 'blocked' | 'due' | 'completed') => {
    setFilterTabState(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState(null, '', url.pathname + url.search);
    }
  };

  // Pomodoro Focus Mode Timer State (§11.2)
  const [focusIssue, setFocusIssue] = useState<Issue | null>(null);
  const [pomodoroSeconds, setPomodoroSeconds] = useState(25 * 60);
  const [isPomodoroRunning, setIsPomodoroRunning] = useState(false);
  const [pomodoroCycles, setPomodoroCycles] = useState(0);

  useEffect(() => {
    // Fetch User Profile
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setCurrentUser(data.user);
      })
      .catch(() => {});

    // Fetch All Cross-Project Issues
    fetch('/api/issues')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setIssues(data);
      })
      .catch(() => {})
  }, []);

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

        default:
          break;
      }
    }, []),
  });

  // Pomodoro Timer Interval
  useEffect(() => {
    let interval: any = null;
    if (isPomodoroRunning && pomodoroSeconds > 0) {
      interval = setInterval(() => {
        setPomodoroSeconds((prev) => prev - 1);
      }, 1000);
    } else if (pomodoroSeconds === 0 && isPomodoroRunning) {
      setIsPomodoroRunning(false);
      setPomodoroCycles((prev) => prev + 1);
      const ENABLE_CELEBRATION = false;
      if (ENABLE_CELEBRATION) {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      }
      toast.success('Focus session completed! Take a 5-minute break. ☕');
      setPomodoroSeconds(25 * 60);

    }
    return () => clearInterval(interval);
  }, [isPomodoroRunning, pomodoroSeconds]);

  // Filter issues for logged-in user
  const myAssignedIssues = useMemo(() => {
    const userName = currentUser?.name?.toLowerCase() || 'karri';
    return issues.filter((iss) => {
      const assignee = (iss as any).assigneeName || iss.assignee?.name || '';
      return (
        assignee.toLowerCase().includes(userName) ||
        assignee.toLowerCase() === 'general (anyone)'
      );
    });
  }, [issues, currentUser]);

  const blockedIssues = useMemo(() => {
    return myAssignedIssues.filter(
      (iss) => (iss.blockedBy && iss.blockedBy.length > 0) || iss.status === 'blocked'
    );
  }, [myAssignedIssues]);

  const dueSoonIssues = useMemo(() => {
    return myAssignedIssues.filter((iss) => iss.dueDate && iss.status !== 'done');
  }, [myAssignedIssues]);

  const completedIssues = useMemo(() => {
    return myAssignedIssues.filter((iss) => iss.status === 'done');
  }, [myAssignedIssues]);

  const displayedIssues = useMemo(() => {
    let list: Issue[] = [];
    if (filterTab === 'assigned') list = myAssignedIssues.filter((i) => i.status !== 'done');
    else if (filterTab === 'blocked') list = blockedIssues;
    else if (filterTab === 'due') list = dueSoonIssues;
    else if (filterTab === 'completed') list = completedIssues;

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.key.toLowerCase().includes(q) ||
        i.project.toLowerCase().includes(q)
    );
  }, [filterTab, myAssignedIssues, blockedIssues, dueSoonIssues, completedIssues, searchQuery]);

  const formatPomodoro = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col h-full bg-[var(--bg-canvas)] text-[var(--text-secondary)] font-sans select-none overflow-y-auto">

        {/* Main Content Layout */}
        <div className="p-6 max-w-7xl w-full mx-auto grid grid-cols-12 gap-6">
          {/* Left Column: Tasks Tabs & List */}
          <div className="col-span-12 lg:col-span-8 space-y-4">
            {/* Filter Tabs & Search */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center bg-[var(--bg-panel)] border border-[var(--border-primary)] rounded-xl p-1 text-sm">
                <button
                  onClick={() => setFilterTab('assigned')}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    filterTab === 'assigned' ? 'bg-[#222222] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  Assigned ({myAssignedIssues.filter((i) => i.status !== 'done').length})
                </button>
                <button
                  onClick={() => setFilterTab('blocked')}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    filterTab === 'blocked' ? 'bg-[#222222] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  Blocked ({blockedIssues.length})
                </button>
                <button
                  onClick={() => setFilterTab('due')}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    filterTab === 'due' ? 'bg-[#222222] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  Due Soon ({dueSoonIssues.length})
                </button>
                <button
                  onClick={() => setFilterTab('completed')}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    filterTab === 'completed' ? 'bg-[#222222] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  Completed ({completedIssues.length})
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative flex-1 max-w-xs">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                <input
                  type="text"
                  placeholder="Filter tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[var(--bg-panel)] border border-[var(--border-primary)] rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-[#A0A0A0] outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-1 focus:ring-offset-black"
                />
              </div>
            </div>

            {/* Issues List Cards */}
            <div className="space-y-2.5">
              {displayedIssues.length === 0 ? (
                <div className="p-12 text-center bg-[var(--bg-panel)] border border-[var(--border-primary)] rounded-2xl space-y-2">
                  <CheckCircle2 size={32} className="mx-auto text-white/60 mb-2" />
                  <h3 className="text-base font-bold text-white">All clear in this section!</h3>
                  <p className="text-sm text-[var(--text-secondary)]">No tasks matching this filter.</p>
                </div>
              ) : (
                displayedIssues.map((issue) => {
                  const isCurrentFocus = focusIssue?.id === issue.id;

                  return (
                    <div
                      key={issue.id}
                      className={`p-4 bg-[var(--bg-panel)] border rounded-2xl transition-all shadow-sm flex items-center justify-between gap-4 group ${
                        isCurrentFocus
                          ? 'border-[var(--border-secondary)] bg-[#212121] ring-2 ring-[#FFFFFF]/20'
                          : 'border-[var(--border-primary)] hover:border-[var(--border-secondary)]'
                      }`}
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          <span className="font-mono font-bold text-white bg-[var(--bg-canvas)] border border-[var(--border-primary)] px-2.5 py-1 rounded">
                            {issue.key}
                          </span>
                          <span className="text-[var(--text-secondary)] text-xs">
                            {issue.project}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-[var(--bg-canvas)] text-xs capitalize border border-[var(--border-primary)]">
                            {issue.status.replace('_', ' ')}
                          </span>
                          {issue.priority === 'critical' && (
                            <span className="px-2 py-0.5 rounded bg-[var(--ramp-3)]/20 text-white text-xs font-bold border border-[var(--border-secondary)]">
                              Critical
                            </span>
                          )}
                        </div>

                        <Link
                          href={`/task/${issue.id}/details`}
                          className="block text-sm font-semibold text-white hover:text-white transition-colors truncate"
                        >
                          {issue.title}
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
