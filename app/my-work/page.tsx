'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Issue, Status, Priority } from '@/lib/types';
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

export default function MyWorkPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<'assigned' | 'blocked' | 'due' | 'completed'>('assigned');
  const [searchQuery, setSearchQuery] = useState('');

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
      .finally(() => setLoading(false));
  }, []);

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
      <div className="flex-1 flex flex-col h-full bg-[#131415] text-[#CFD4DD] font-sans select-none overflow-y-auto">

        {/* Top Header */}
        <div className="px-6 py-5 border-b border-[#2A2C30] bg-[#17181A] flex items-center justify-between flex-wrap gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#DCB001]/10 text-[#DCB001] border border-[#DCB001]/30 flex items-center justify-center font-bold">
                <UserCheck size={18} />
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">My Work & Focus Workspace</h1>
            </div>
            <p className="text-xs text-[#787C83]">
              Personal cross-project dashboard for {currentUser?.name || 'Engineer'}
            </p>
          </div>

          {/* Quick Metrics Header Pills */}
          <div className="flex items-center gap-2 text-xs font-mono">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#131415] border border-[#2A2C30] rounded-xl">
              <span className="text-[#DCB001] font-bold">{myAssignedIssues.length}</span>
              <span className="text-[#787C83]">Assigned Tasks</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#131415] border border-[#2A2C30] rounded-xl">
              <Flame size={13} className="text-[#F97316]" />
              <span className="text-white font-bold">{pomodoroCycles}</span>
              <span className="text-[#787C83]">Focus Sessions</span>
            </div>
          </div>
        </div>

        {/* Main Content Layout */}
        <div className="p-6 max-w-7xl w-full mx-auto grid grid-cols-12 gap-6">
          {/* Left Column: Tasks Tabs & List */}
          <div className="col-span-12 lg:col-span-8 space-y-4">
            {/* Filter Tabs & Search */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center bg-[#1B1C1F] border border-[#2A2C30] rounded-xl p-1 text-xs">
                <button
                  onClick={() => setFilterTab('assigned')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    filterTab === 'assigned' ? 'bg-[#2A2C30] text-[#DCB001] shadow-sm' : 'text-[#787C83] hover:text-[#CFD4DD]'
                  }`}
                >
                  Assigned ({myAssignedIssues.filter((i) => i.status !== 'done').length})
                </button>
                <button
                  onClick={() => setFilterTab('blocked')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    filterTab === 'blocked' ? 'bg-[#2A2C30] text-[#EF4444] shadow-sm' : 'text-[#787C83] hover:text-[#CFD4DD]'
                  }`}
                >
                  Blocked ({blockedIssues.length})
                </button>
                <button
                  onClick={() => setFilterTab('due')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    filterTab === 'due' ? 'bg-[#2A2C30] text-[#3B82F6] shadow-sm' : 'text-[#787C83] hover:text-[#CFD4DD]'
                  }`}
                >
                  Due Soon ({dueSoonIssues.length})
                </button>
                <button
                  onClick={() => setFilterTab('completed')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    filterTab === 'completed' ? 'bg-[#2A2C30] text-[#22C55E] shadow-sm' : 'text-[#787C83] hover:text-[#CFD4DD]'
                  }`}
                >
                  Completed ({completedIssues.length})
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative flex-1 max-w-xs">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#787C83]" />
                <input
                  type="text"
                  placeholder="Filter tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#1B1C1F] border border-[#2A2C30] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#787C83] outline-none"
                />
              </div>
            </div>

            {/* Issues List Cards */}
            <div className="space-y-2.5">
              {displayedIssues.length === 0 ? (
                <div className="p-12 text-center bg-[#1B1C1F] border border-[#2A2C30] rounded-2xl space-y-2">
                  <CheckCircle2 size={32} className="mx-auto text-[#22C55E]/60 mb-2" />
                  <h3 className="text-sm font-bold text-white">All clear in this section!</h3>
                  <p className="text-xs text-[#787C83]">No tasks matching this filter.</p>
                </div>
              ) : (
                displayedIssues.map((issue) => {
                  const isCurrentFocus = focusIssue?.id === issue.id;

                  return (
                    <div
                      key={issue.id}
                      className={`p-4 bg-[#1B1C1F] border rounded-2xl transition-all shadow-sm flex items-center justify-between gap-4 group ${
                        isCurrentFocus
                          ? 'border-[#DCB001] bg-[#1F2023] ring-2 ring-[#DCB001]/20'
                          : 'border-[#2A2C30] hover:border-[#DCB001]/40'
                      }`}
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          <span className="font-mono font-bold text-[#DCB001] bg-[#131415] border border-[#2A2C30] px-2 py-0.5 rounded">
                            {issue.key}
                          </span>
                          <span className="text-[#787C83] font-mono text-[11px]">
                            {issue.project}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-[#131415] text-[10px] font-mono capitalize border border-[#2A2C30]">
                            {issue.status.replace('_', ' ')}
                          </span>
                          {issue.priority === 'critical' && (
                            <span className="px-2 py-0.5 rounded bg-[#EF4444]/20 text-[#EF4444] text-[10px] font-mono font-bold border border-[#EF4444]/40">
                              Critical
                            </span>
                          )}
                        </div>

                        <Link
                          href={`/projects/${issue.projectId || 1}`}
                          className="block text-sm font-semibold text-white hover:text-[#DCB001] transition-colors truncate"
                        >
                          {issue.title}
                        </Link>
                      </div>

                      {/* Right Action: Set Focus Mode / Inspect */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => {
                            setFocusIssue(issue);
                            setPomodoroSeconds(25 * 60);
                            setIsPomodoroRunning(true);
                            toast.info(`Focus session started for ${issue.key}`);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
                            isCurrentFocus
                              ? 'bg-[#DCB001] text-[#0F1011]'
                              : 'bg-[#131415] hover:bg-[#2A2C30] text-[#CFD4DD] border border-[#2A2C30]'
                          }`}
                        >
                          <Play size={12} />
                          <span>{isCurrentFocus ? 'Focusing' : 'Focus'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Pomodoro Focus Timer (§11.2) */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            <div className="p-6 bg-[#1B1C1F] border border-[#2A2C30] rounded-2xl space-y-5 shadow-xl text-center">
              <div className="flex items-center justify-between pb-3 border-b border-[#2A2C30]">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Flame size={16} className="text-[#F97316]" />
                  <span>Pomodoro Focus Timer</span>
                </div>
                <span className="text-[10px] font-mono text-[#787C83]">25m Work / 5m Break</span>
              </div>

              {/* Active Focus Target */}
              {focusIssue ? (
                <div className="p-3 bg-[#131415] border border-[#DCB001]/40 rounded-xl text-left space-y-1">
                  <span className="text-[10px] font-mono text-[#DCB001] font-bold">Active Focus Target</span>
                  <div className="text-xs font-bold text-white truncate">{focusIssue.key}: {focusIssue.title}</div>
                </div>
              ) : (
                <div className="p-3 bg-[#131415] border border-[#2A2C30] rounded-xl text-xs text-[#787C83] italic">
                  Select a task from your list to anchor this focus session.
                </div>
              )}

              {/* Countdown Display */}
              <div className="py-4">
                <div className="text-4xl sm:text-5xl font-mono font-black text-white tracking-widest">
                  {formatPomodoro(pomodoroSeconds)}
                </div>
                <span className="text-xs font-mono text-[#787C83] mt-1 block">
                  {isPomodoroRunning ? '⚡ Deep Focus Mode Active' : 'Paused / Ready'}
                </span>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setIsPomodoroRunning((prev) => !prev)}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md ${
                    isPomodoroRunning
                      ? 'bg-[#EF4444] hover:bg-[#dc2626] text-white'
                      : 'bg-[#DCB001] hover:bg-[#c49c00] text-[#0F1011]'
                  }`}
                >
                  {isPomodoroRunning ? <Square size={13} /> : <Play size={13} />}
                  <span>{isPomodoroRunning ? 'Pause' : 'Start Focus'}</span>
                </button>

                <button
                  onClick={() => {
                    setIsPomodoroRunning(false);
                    setPomodoroSeconds(25 * 60);
                  }}
                  className="p-2.5 bg-[#131415] hover:bg-[#2A2C30] border border-[#2A2C30] rounded-xl text-[#787C83] hover:text-white transition-colors"
                  title="Reset Timer"
                >
                  <RotateCcw size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
