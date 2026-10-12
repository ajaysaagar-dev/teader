'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Kanban,
  FileText,
  CheckCircle2,
  ArrowRight,
  Download,
  Sparkles,
  Layers,
  Zap,
  Users,
  LogOut,
  LayoutDashboard,
  Shield,
  Clock,
  ChevronRight,
  FolderTree,
  ListTodo,
  Check,
  Smartphone,
  Laptop,
  Globe
} from 'lucide-react';
import { toast } from 'sonner';
import { BUILD_NUMBER } from '@/lib/build-info';
import { Avatar } from '@/components/ui/Avatar';
import { TopFrame } from '@/components/TopFrame';
import { getDesktopInfo } from '@/lib/desktop';

interface AuthUser {
  name?: string;
  email?: string;
  id?: string | number;
}

export default function LandingPageClient() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [mounted, setMounted] = useState(false);
  const [previewTab, setPreviewTab] = useState<'board' | 'docs'>('board');

  // If opened via Desktop app, strictly redirect straight to workspace dashboard
  useEffect(() => {
    const desktop = getDesktopInfo();
    if (desktop.isDesktop) {
      router.replace('/dashboard');
    }
  }, [router]);

  // Check login state on mount
  useEffect(() => {
    setMounted(true);
    try {
      const cached = localStorage.getItem('teader_user');
      if (cached) {
        setCurrentUser(JSON.parse(cached));
      }
    } catch {}

    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setCurrentUser(data.user);
          try {
            localStorage.setItem('teader_user', JSON.stringify(data.user));
          } catch {}
        } else {
          setCurrentUser(null);
          try {
            localStorage.removeItem('teader_user');
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      try {
        localStorage.removeItem('teader_user');
        localStorage.removeItem('teader_token');
      } catch {}
      setCurrentUser(null);
      toast.success('Logged out successfully');
    } catch {
      toast.error('Logout failed');
    }
  };

  const isLoggedIn = mounted && Boolean(currentUser);

  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-secondary)] font-sans selection:bg-[var(--accent)] selection:text-[var(--text-inverse)]">
      {/* ─── Top Window Frame & Navigation Header ──────────────────── */}
      <div className="sticky top-0 z-50 bg-[var(--bg-main)]">
        <div className="border-b border-[var(--border-primary)] px-5 py-2">
          <TopFrame />
        </div>

        {/* ─── Top Header Navigation ──────────────────────────────────── */}
        <header className="backdrop-blur-md bg-[var(--bg-main)]/90 border-b border-[var(--border-primary)]">
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center gap-2.5 group">
                <img src="/logo.svg" alt="Teader" className="w-6 h-6 object-contain" />
                <span className="font-extrabold text-xl text-[var(--text-primary)] tracking-tight">
                  teader
                </span>
              </Link>

              <nav className="hidden md:flex items-center gap-6 text-sm text-[var(--text-secondary)]">
                <Link href="/documentation" className="hover:text-[var(--text-primary)] transition-colors">
                  documentation
                </Link>
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <a
                href="/releases/Teader-Workspace-Web-Setup.exe"
                download
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border-primary)] hover:border-[var(--border-secondary)] text-xs font-medium transition-all"
                title="Download Teader Cloud Web Setup for Windows"
              >
                <Download size={13} className="text-[var(--text-primary)]" />
                <span>Web Setup</span>
              </a>

              {isLoggedIn ? (
                <>
                  <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-primary)] text-xs font-medium text-[var(--text-primary)]">
                    <Avatar user={currentUser} size="xs" />
                    <span>{currentUser?.name}</span>
                  </div>

                  <Link
                    href="/dashboard"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-[var(--text-inverse)] hover:brightness-110 font-bold text-xs transition-all shadow-[0_0_12px_rgba(187,134,252,0.3)] hover:scale-[1.02]"
                  >
                    <LayoutDashboard size={13} />
                    <span>Dashboard</span>
                  </Link>

                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--ramp-3)]/15 hover:bg-[var(--ramp-3)]/25 text-[var(--text-primary)] border border-[var(--border-secondary)] text-xs font-medium transition-colors"
                  >
                    <LogOut size={13} />
                    <span className="hidden sm:inline">Logout</span>
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="px-3.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--text-inverse)] hover:brightness-110 font-bold text-xs transition-all shadow-[0_0_15px_rgba(187,134,252,0.35)] hover:scale-[1.02]"
                  >
                    <span>Launch Free</span>
                    <ArrowRight size={13} />
                  </Link>
                </>
              )}
            </div>
          </div>
        </header>
      </div>

      {/* ─── Hero Section ────────────────────────────────────────────── */}
      <section className="pt-20 pb-16 px-6 relative overflow-hidden">
        {/* Soft Background Warm Glow */}
        <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[600px] h-[280px] bg-white/10 blur-[130px] pointer-events-none rounded-full" />

        <div className="max-w-4xl mx-auto text-center space-y-6 relative z-10">
          {/* Friendly Top Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1B1B1B] border border-[#343434] text-xs font-medium text-[#FFFFFF]">
            <span>Simple, friendly project tracking for modern teams</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-[1.15]">
            Organize tasks and notes together.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FFFFFF] via-[#FFFFFF] to-[#FFFFFF]">
              Without the clutter.
            </span>
          </h1>

          {/* Friendly Subtitle */}
          <p className="text-base sm:text-lg text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed">
            Teader brings your Kanban boards, task checklists, and project docs into one calm, fast, and easy-to-use workspace. No complicated setup, no learning curve.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3.5 pt-2">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[var(--accent)] text-[var(--text-inverse)] hover:brightness-110 font-bold text-sm transition-all shadow-[0_0_20px_rgba(187,134,252,0.35)] hover:scale-105"
            >
              <span>{isLoggedIn ? 'Go to Dashboard' : 'Get Started Free'}</span>
              <ArrowRight size={16} />
            </Link>

            <a
              href="/releases/Teader-Workspace-Web-Setup.exe"
              download
              className="flex items-center gap-2.5 px-5 py-3.5 rounded-xl bg-[#1B1B1B] hover:bg-[#262626] border border-[#343434] hover:border-[var(--border-secondary)] text-white font-medium text-sm transition-all shadow-sm group hover:scale-105"
              title="Lightweight cloud web installer (fast, downloads from cloud)"
            >
              <Globe size={15} className="text-[var(--accent)] group-hover:-translate-y-0.5 transition-transform" />
              <span>Download Web Setup</span>
            </a>

            <a
              href="/releases/Teader-Workspace-Setup.exe"
              download
              className="flex items-center gap-2 px-4 py-3.5 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-white font-medium text-xs transition-colors"
              title="Full offline installer"
            >
              <Download size={13} />
              <span>Offline Setup</span>
            </a>

            {!isLoggedIn && (
              <Link
                href="/register"
                className="flex items-center gap-1.5 px-4 py-3.5 rounded-xl text-[var(--text-secondary)] hover:text-white font-medium text-sm transition-colors"
              >
                <span>Create an Account</span>
                <ChevronRight size={14} />
              </Link>
            )}
          </div>

          {/* Friendly Reassurance Pills */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-5 text-xs text-[var(--text-secondary)]">
            <div className="flex items-center gap-1.5">
              <Check size={14} className="text-white" />
              <span>Instant real-time sync</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check size={14} className="text-white" />
              <span>Clean Markdown docs</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check size={14} className="text-white" />
              <span>Free & easy to use</span>
            </div>
          </div>
        </div>

        {/* ─── Interactive Visual Mockup ─────────────────────────────── */}
        <div className="max-w-5xl mx-auto mt-12 rounded-2xl bg-[#171717] border border-[#2B2B2B] shadow-2xl overflow-hidden">
          {/* Mockup Header Bar */}
          <div className="bg-[#1B1B1B] px-4 py-3 border-b border-[#2B2B2B] flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[var(--ramp-3)]/60" />
                <div className="w-3 h-3 rounded-full bg-white/60" />
                <div className="w-3 h-3 rounded-full bg-[var(--ramp-3)]/60" />
              </div>
              <span className="ml-2 text-xs font-semibold text-[#EDEDED]">Teader Platform Core</span>
            </div>

            {/* Toggle Tabs */}
            <div className="flex items-center bg-[var(--bg-main)] p-1 rounded-lg border border-[var(--border-primary)] text-xs">
              <button
                onClick={() => setPreviewTab('board')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all ${
                  previewTab === 'board'
                    ? 'bg-[var(--accent)] text-[var(--text-inverse)] font-bold shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Kanban size={13} />
                <span>Kanban Board</span>
              </button>
              <button
                onClick={() => setPreviewTab('docs')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all ${
                  previewTab === 'docs'
                    ? 'bg-[var(--accent)] text-[var(--text-inverse)] font-bold shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <FileText size={13} />
                <span>Project Docs</span>
              </button>
            </div>
          </div>

          {/* Mockup Content Body */}
          <div className="p-6 bg-[#111111]">
            {previewTab === 'board' ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Column 1: To Do */}
                <div className="bg-[#181818] rounded-xl p-3.5 border border-[#292929] space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-[#EDEDED]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#666666]" />
                      <span>TO DO</span>
                    </div>
                    <span className="text-[var(--text-muted)] bg-[#242424] px-1.5 py-0.5 rounded text-[11px]">2</span>
                  </div>

                  <div className="space-y-2.5">
                    <div className="bg-[#202020] p-3 rounded-lg border border-[#313131] space-y-2 hover:border-[var(--border-secondary)] transition-colors cursor-pointer">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[var(--text-secondary)] font-mono">TDR-104</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--ramp-3)]/15 text-white">High</span>
                      </div>
                      <p className="text-xs font-semibold text-white">Setup Postgres database schemas</p>
                      <div className="flex items-center justify-between pt-1 text-[11px] text-[var(--text-muted)]">
                        <div className="flex items-center gap-1">
                          <ListTodo size={12} />
                          <span>3 subtasks</span>
                        </div>
                        <div className="w-4 h-4 rounded-full bg-[var(--accent)] text-black text-[9px] font-bold flex items-center justify-center">
                          A
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#202020] p-3 rounded-lg border border-[#313131] space-y-2 hover:border-[var(--border-secondary)] transition-colors cursor-pointer">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[var(--text-secondary)] font-mono">TDR-105</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#FFFFFF]/15 text-[#FFFFFF]">Medium</span>
                      </div>
                      <p className="text-xs font-semibold text-white">Design new onboarding modal</p>
                      <div className="flex items-center justify-between pt-1 text-[11px] text-[var(--text-muted)]">
                        <div className="flex items-center gap-1">
                          <ListTodo size={12} />
                          <span>1 subtask</span>
                        </div>
                        <div className="w-4 h-4 rounded-full bg-[var(--accent)] text-black text-[9px] font-bold flex items-center justify-center">
                          K
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Column 2: In Progress */}
                <div className="bg-[#181818] rounded-xl p-3.5 border border-[#292929] space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-[#EDEDED]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-white text-black" />
                      <span>IN PROGRESS</span>
                    </div>
                    <span className="text-white bg-[#242424] px-1.5 py-0.5 rounded text-[11px]">1</span>
                  </div>

                  <div className="space-y-2.5">
                    <div className="bg-[#202020] p-3 rounded-lg border border-[var(--border-secondary)] space-y-2 cursor-pointer shadow-sm">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[var(--text-secondary)] font-mono">TDR-102</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/15 text-white">Active</span>
                      </div>
                      <p className="text-xs font-semibold text-white">Clean landing page overhaul</p>
                      <div className="w-full bg-[#2D2D2D] rounded-full h-1.5">
                        <div className="bg-white text-black h-1.5 rounded-full w-3/4" />
                      </div>
                      <div className="flex items-center justify-between pt-1 text-[11px] text-[var(--text-muted)]">
                        <div className="flex items-center gap-1">
                          <CheckCircle2 size={12} className="text-white" />
                          <span>3/4 done</span>
                        </div>
                        <div className="w-4 h-4 rounded-full bg-white text-black text-[9px] font-bold flex items-center justify-center">
                          J
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Column 3: Done */}
                <div className="bg-[#181818] rounded-xl p-3.5 border border-[#292929] space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-[#EDEDED]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[var(--ramp-3)]" />
                      <span>DONE</span>
                    </div>
                    <span className="text-white bg-[#242424] px-1.5 py-0.5 rounded text-[11px]">1</span>
                  </div>

                  <div className="space-y-2.5">
                    <div className="bg-[#202020] p-3 rounded-lg border border-[#313131] space-y-2 opacity-80 cursor-pointer">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[var(--text-muted)] font-mono line-through">TDR-101</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--ramp-3)]/15 text-white">Done</span>
                      </div>
                      <p className="text-xs font-semibold text-[var(--text-secondary)] line-through">Security & authorization audits</p>
                      <div className="flex items-center justify-between pt-1 text-[11px] text-[var(--text-muted)]">
                        <span>Completed today</span>
                        <CheckCircle2 size={13} className="text-white" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Doc Sidebar */}
                <div className="bg-[#181818] rounded-xl p-3 border border-[#292929] space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-[#EDEDED] pb-2 border-b border-[#292929]">
                    <FolderTree size={14} className="text-white" />
                    <span>Project Docs</span>
                  </div>
                  <div className="space-y-1 text-[var(--text-secondary)]">
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-[#202020] text-white font-medium">
                      <FileText size={13} className="text-white" />
                      <span>Architecture.md</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-[#202020]/50">
                      <FileText size={13} />
                      <span>API-Reference.md</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-[#202020]/50">
                      <FileText size={13} />
                      <span>Release-Notes.md</span>
                    </div>
                  </div>
                </div>

                {/* Doc Editor Preview */}
                <div className="sm:col-span-2 bg-[#181818] rounded-xl p-4 border border-[#292929] space-y-3 text-xs font-mono">
                  <div className="flex items-center justify-between pb-2 border-b border-[#292929] text-[11px] text-[var(--text-muted)]">
                    <span className="text-white font-bold font-sans"># Architecture & Workflow</span>
                    <span className="text-white flex items-center gap-1">
                      <Check size={12} /> Auto-saved
                    </span>
                  </div>
                  <div className="space-y-2 text-[var(--text-secondary)] leading-relaxed font-sans">
                    <p className="text-sm font-bold text-white">1. Core Principles</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Keep task management lightweight and fast so developers and creators can focus on building.
                    </p>
                    <div className="p-3 bg-[#202020] rounded-lg border border-[#313131] font-mono text-[11px] text-[#FFFFFF]">
                      {`// Instant synchronization\nconst task = await createTask({ title: "Ship product", priority: "high" });`}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─── 4 Friendly Core Features ─────────────────────────────────── */}
      <section id="features" className="py-20 px-6 border-t border-[#232323] bg-[#000000]">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-white">
              Features You&apos;ll Love
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Everything you need to get things done.
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Designed to be intuitive from minute one. No complex jargon or clutter.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl bg-[#171717] border border-[#292929] hover:border-[var(--border-secondary)] transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-white/15 text-white flex items-center justify-center">
                <Kanban size={20} />
              </div>
              <h3 className="text-base font-bold text-white">Visual Kanban Boards</h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Move tasks across To Do, In Progress, Review, and Done with smooth drag-and-drop. Easily set priorities, due dates, and assignees.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl bg-[#171717] border border-[#292929] hover:border-[var(--border-secondary)] transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--ramp-3)]/15 text-white flex items-center justify-center">
                <FileText size={20} />
              </div>
              <h3 className="text-base font-bold text-white">Live Markdown Notes</h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Write technical specs, meeting notes, and engineering documentation in clean Markdown with real-time preview and instant auto-save.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl bg-[#171717] border border-[#292929] hover:border-[var(--border-secondary)] transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--ramp-3)]/15 text-white flex items-center justify-center">
                <Layers size={20} />
              </div>
              <h3 className="text-base font-bold text-white">Tasks & Nested Subtasks</h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Break complex goals down into clear checklists and hierarchical subtasks so every step is transparent and manageable.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-2xl bg-[#171717] border border-[#292929] hover:border-[var(--border-secondary)] transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--ramp-3)]/15 text-white flex items-center justify-center">
                <Zap size={20} />
              </div>
              <h3 className="text-base font-bold text-white">Instant Real-Time Sync</h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Experience zero-lag updates. When you or a team member changes a task or edits a note, everyone sees it immediately.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── How It Works Section ─────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 px-6 border-t border-[#232323] bg-[#000000]">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-white">
              Simple 3-Step Setup
            </span>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              Up and running in less than a minute.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-[#171717] border border-[#292929] space-y-3">
              <div className="w-8 h-8 rounded-full bg-white text-black font-extrabold text-sm flex items-center justify-center">
                1
              </div>
              <h3 className="text-sm font-bold text-white">Create a Project</h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Give your project a name and invite your team members or work solo.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#171717] border border-[#292929] space-y-3">
              <div className="w-8 h-8 rounded-full bg-white text-black font-extrabold text-sm flex items-center justify-center">
                2
              </div>
              <h3 className="text-sm font-bold text-white">Add Tasks & Docs</h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Populate your board with tasks, checklists, and living Markdown documentation.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#171717] border border-[#292929] space-y-3">
              <div className="w-8 h-8 rounded-full bg-white text-black font-extrabold text-sm flex items-center justify-center">
                3
              </div>
              <h3 className="text-sm font-bold text-white">Track & Ship</h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Move tasks to Done with instant feedback, stay organized, and deliver on time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Call to Action Banner ───────────────────────────────────── */}
      <section className="py-20 px-6 border-t border-[#232323] bg-gradient-to-b from-[#141414] to-[#000000] text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Ready to simplify your projects?
          </h2>
          <p className="text-sm text-[var(--text-secondary)] max-w-xl mx-auto leading-relaxed">
            Start organizing your tasks and documentation today with Teader. Free, fast, and friendly.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3.5">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[var(--accent)] text-[var(--text-inverse)] hover:brightness-110 font-bold text-sm transition-all shadow-[0_0_25px_rgba(187,134,252,0.4)] hover:scale-105"
            >
              <span>{isLoggedIn ? 'Open My Workspace' : 'Get Started Now'}</span>
              <ArrowRight size={16} />
            </Link>

            <a
              href="/releases/Teader-Workspace-Web-Setup.exe"
              download
              className="flex items-center gap-2 px-5 py-3.5 rounded-xl bg-[#1B1B1B] hover:bg-[#262626] border border-[#343434] text-white font-medium text-sm transition-all hover:scale-105"
              title="Lightweight cloud web installer"
            >
              <Globe size={15} className="text-[var(--accent)]" />
              <span>Download Web Setup</span>
            </a>

            <a
              href="/releases/Teader-Workspace-Setup.exe"
              download
              className="flex items-center gap-2 px-4 py-3.5 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-[var(--border-primary)] hover:border-[var(--border-secondary)] text-[var(--text-secondary)] hover:text-white font-medium text-xs transition-all"
              title="Standalone offline installer"
            >
              <Download size={13} />
              <span>Offline Setup</span>
            </a>
          </div>
        </div>
      </section>

      {/* ─── Clean Footer ────────────────────────────────────────────── */}
      <footer className="py-8 px-6 border-t border-[var(--border-primary)] bg-[var(--bg-main)] text-xs text-[var(--text-muted)]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="Teader" className="w-4 h-4 object-contain" />
            <span className="font-bold text-white">Teader</span>
            <span>• Build {BUILD_NUMBER}</span>
          </div>

          <div className="flex items-center gap-5">
            <a
              href="/releases/Teader-Workspace-Web-Setup.exe"
              download
              className="text-white hover:underline flex items-center gap-1"
            >
              <Globe size={12} className="text-[var(--accent)]" />
              <span>Web Setup</span>
            </a>
            <a
              href="/releases/Teader-Workspace-Setup.exe"
              download
              className="text-[var(--text-secondary)] hover:underline flex items-center gap-1"
            >
              <Download size={12} />
              <span>Offline Setup</span>
            </a>
            <Link href="/dashboard" className="hover:text-white transition-colors">
              Dashboard
            </Link>
            <Link href="/projects" className="hover:text-white transition-colors">
              Projects
            </Link>
            <Link href="/documentation" className="hover:text-white transition-colors">
              Docs
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
