'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
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
  Laptop
} from 'lucide-react';
import { toast } from 'sonner';
import { BUILD_NUMBER } from '@/lib/build-info';

interface AuthUser {
  name?: string;
  email?: string;
  id?: string | number;
}

export default function LandingPageClient() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [mounted, setMounted] = useState(false);
  const [previewTab, setPreviewTab] = useState<'board' | 'docs'>('board');

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
    <div className="min-h-screen bg-[#0B0C0E] text-[#D1D5DB] font-sans selection:bg-[#DCB001]/30 selection:text-[#DCB001]">
      {/* ─── Top Header Navigation ──────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#0B0C0E]/90 border-b border-[#1F2128]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#DCB001] to-[#F59E0B] flex items-center justify-center text-[#0B0C0E] font-extrabold shadow-[0_0_12px_rgba(220,176,1,0.3)]">
                T
              </div>
              <span className="font-extrabold text-xl text-white tracking-tight">
                teader
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-6 text-sm text-[#9CA3AF]">
              <a href="#features" className="hover:text-white transition-colors">
                Features
              </a>
              <a href="#how-it-works" className="hover:text-white transition-colors">
                How It Works
              </a>
              <Link href="/documentation" className="hover:text-white transition-colors">
                Docs
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://teader.vedipocketpc.online/releases/Teader-Workspace-Web-Setup.exe"
              download
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181A20] hover:bg-[#22252C] text-[#E5E7EB] border border-[#2D3139] hover:border-[#DCB001]/50 text-xs font-medium transition-all"
              title="Download Desktop App for Windows"
            >
              <Download size={13} className="text-[#DCB001]" />
              <span>Download App</span>
            </a>

            {isLoggedIn ? (
              <>
                <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#181A20] border border-[#2D3139] text-xs font-medium text-[#E5E7EB]">
                  <div className="w-4 h-4 rounded-full bg-[#DCB001] text-[#0B0C0E] flex items-center justify-center text-[10px] font-bold">
                    {(currentUser?.name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <span>{currentUser?.name}</span>
                </div>

                <Link
                  href="/dashboard"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#DCB001] hover:bg-[#F59E0B] text-[#0B0C0E] font-bold text-xs transition-all shadow-[0_0_15px_rgba(220,176,1,0.25)] hover:scale-[1.02]"
                >
                  <LayoutDashboard size={14} />
                  <span>Go to Dashboard</span>
                </Link>

                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EF4444]/15 hover:bg-[#EF4444]/25 text-[#EF4444] border border-[#EF4444]/30 text-xs font-medium transition-colors"
                >
                  <LogOut size={13} />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-3.5 py-1.5 text-xs font-medium text-[#D1D5DB] hover:text-white transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/dashboard"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#DCB001] hover:bg-[#F59E0B] text-[#0B0C0E] font-bold text-xs transition-all shadow-[0_0_15px_rgba(220,176,1,0.25)] hover:scale-[1.02]"
                >
                  <span>Launch Free</span>
                  <ArrowRight size={13} />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ─── Hero Section ────────────────────────────────────────────── */}
      <section className="pt-20 pb-16 px-6 relative overflow-hidden">
        {/* Soft Background Warm Glow */}
        <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[600px] h-[280px] bg-[#DCB001]/10 blur-[130px] pointer-events-none rounded-full" />

        <div className="max-w-4xl mx-auto text-center space-y-6 relative z-10">
          {/* Friendly Top Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#181A20] border border-[#2E323C] text-xs font-medium text-[#FBBF24]">
            <Sparkles size={13} className="text-[#DCB001]" />
            <span>Simple, friendly project tracking for modern teams</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-[1.15]">
            Organize tasks and notes together.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#DCB001] via-[#FBBF24] to-[#F59E0B]">
              Without the clutter.
            </span>
          </h1>

          {/* Friendly Subtitle */}
          <p className="text-base sm:text-lg text-[#9CA3AF] max-w-2xl mx-auto leading-relaxed">
            Teader brings your Kanban boards, task checklists, and project docs into one calm, fast, and easy-to-use workspace. No complicated setup, no learning curve.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3.5 pt-2">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#DCB001] hover:bg-[#F59E0B] text-[#0B0C0E] font-bold text-sm transition-all shadow-[0_0_20px_rgba(220,176,1,0.3)] hover:scale-105"
            >
              <span>{isLoggedIn ? 'Go to My Projects' : 'Get Started Free'}</span>
              <ArrowRight size={16} />
            </Link>

            <a
              href="https://teader.vedipocketpc.online/releases/Teader-Workspace-Web-Setup.exe"
              download
              className="flex items-center gap-2.5 px-5 py-3.5 rounded-xl bg-[#181A20] hover:bg-[#22252C] border border-[#2E323C] hover:border-[#DCB001]/60 text-white font-medium text-sm transition-all shadow-sm group hover:scale-105"
            >
              <Download size={15} className="text-[#DCB001] group-hover:-translate-y-0.5 transition-transform" />
              <span>Download for Windows</span>
            </a>

            {!isLoggedIn && (
              <Link
                href="/register"
                className="flex items-center gap-1.5 px-4 py-3.5 rounded-xl text-[#9CA3AF] hover:text-white font-medium text-sm transition-colors"
              >
                <span>Create an Account</span>
                <ChevronRight size={14} />
              </Link>
            )}
          </div>

          {/* Friendly Reassurance Pills */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-5 text-xs text-[#9CA3AF]">
            <div className="flex items-center gap-1.5">
              <Check size={14} className="text-[#22C55E]" />
              <span>Instant real-time sync</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check size={14} className="text-[#22C55E]" />
              <span>Clean Markdown docs</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check size={14} className="text-[#22C55E]" />
              <span>Free & easy to use</span>
            </div>
          </div>
        </div>

        {/* ─── Interactive Visual Mockup ─────────────────────────────── */}
        <div className="max-w-5xl mx-auto mt-12 rounded-2xl bg-[#14161B] border border-[#262932] shadow-2xl overflow-hidden">
          {/* Mockup Header Bar */}
          <div className="bg-[#181A20] px-4 py-3 border-b border-[#262932] flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#EF4444]/60" />
                <div className="w-3 h-3 rounded-full bg-[#F59E0B]/60" />
                <div className="w-3 h-3 rounded-full bg-[#22C55E]/60" />
              </div>
              <span className="ml-2 text-xs font-semibold text-[#E5E7EB]">Teader Platform Core</span>
            </div>

            {/* Toggle Tabs */}
            <div className="flex items-center bg-[#101216] p-1 rounded-lg border border-[#2D3139] text-xs">
              <button
                onClick={() => setPreviewTab('board')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all ${
                  previewTab === 'board'
                    ? 'bg-[#DCB001] text-[#0B0C0E] font-bold shadow-sm'
                    : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                <Kanban size={13} />
                <span>Kanban Board</span>
              </button>
              <button
                onClick={() => setPreviewTab('docs')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all ${
                  previewTab === 'docs'
                    ? 'bg-[#DCB001] text-[#0B0C0E] font-bold shadow-sm'
                    : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                <FileText size={13} />
                <span>Project Docs</span>
              </button>
            </div>
          </div>

          {/* Mockup Content Body */}
          <div className="p-6 bg-[#0E1014]">
            {previewTab === 'board' ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Column 1: To Do */}
                <div className="bg-[#15171D] rounded-xl p-3.5 border border-[#242731] space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-[#E5E7EB]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#6B7280]" />
                      <span>TO DO</span>
                    </div>
                    <span className="text-[#6B7280] bg-[#1F222B] px-1.5 py-0.5 rounded text-[11px]">2</span>
                  </div>

                  <div className="space-y-2.5">
                    <div className="bg-[#1C1E26] p-3 rounded-lg border border-[#2A2E3A] space-y-2 hover:border-[#DCB001]/50 transition-colors cursor-pointer">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#9CA3AF] font-mono">TDR-104</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#EF4444]/15 text-[#EF4444]">High</span>
                      </div>
                      <p className="text-xs font-semibold text-white">Setup Postgres database schemas</p>
                      <div className="flex items-center justify-between pt-1 text-[11px] text-[#6B7280]">
                        <div className="flex items-center gap-1">
                          <ListTodo size={12} />
                          <span>3 subtasks</span>
                        </div>
                        <div className="w-4 h-4 rounded-full bg-[#3B82F6] text-white text-[9px] font-bold flex items-center justify-center">
                          A
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#1C1E26] p-3 rounded-lg border border-[#2A2E3A] space-y-2 hover:border-[#DCB001]/50 transition-colors cursor-pointer">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#9CA3AF] font-mono">TDR-105</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#3B82F6]/15 text-[#60A5FA]">Medium</span>
                      </div>
                      <p className="text-xs font-semibold text-white">Design new onboarding modal</p>
                      <div className="flex items-center justify-between pt-1 text-[11px] text-[#6B7280]">
                        <div className="flex items-center gap-1">
                          <ListTodo size={12} />
                          <span>1 subtask</span>
                        </div>
                        <div className="w-4 h-4 rounded-full bg-[#10B981] text-white text-[9px] font-bold flex items-center justify-center">
                          K
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Column 2: In Progress */}
                <div className="bg-[#15171D] rounded-xl p-3.5 border border-[#242731] space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-[#E5E7EB]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#DCB001]" />
                      <span>IN PROGRESS</span>
                    </div>
                    <span className="text-[#DCB001] bg-[#1F222B] px-1.5 py-0.5 rounded text-[11px]">1</span>
                  </div>

                  <div className="space-y-2.5">
                    <div className="bg-[#1C1E26] p-3 rounded-lg border border-[#DCB001]/40 space-y-2 cursor-pointer shadow-sm">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#9CA3AF] font-mono">TDR-102</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#DCB001]/15 text-[#DCB001]">Active</span>
                      </div>
                      <p className="text-xs font-semibold text-white">Clean landing page overhaul</p>
                      <div className="w-full bg-[#272B36] rounded-full h-1.5">
                        <div className="bg-[#DCB001] h-1.5 rounded-full w-3/4" />
                      </div>
                      <div className="flex items-center justify-between pt-1 text-[11px] text-[#6B7280]">
                        <div className="flex items-center gap-1">
                          <CheckCircle2 size={12} className="text-[#DCB001]" />
                          <span>3/4 done</span>
                        </div>
                        <div className="w-4 h-4 rounded-full bg-[#DCB001] text-[#0B0C0E] text-[9px] font-bold flex items-center justify-center">
                          J
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Column 3: Done */}
                <div className="bg-[#15171D] rounded-xl p-3.5 border border-[#242731] space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-[#E5E7EB]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#22C55E]" />
                      <span>DONE</span>
                    </div>
                    <span className="text-[#22C55E] bg-[#1F222B] px-1.5 py-0.5 rounded text-[11px]">1</span>
                  </div>

                  <div className="space-y-2.5">
                    <div className="bg-[#1C1E26] p-3 rounded-lg border border-[#2A2E3A] space-y-2 opacity-80 cursor-pointer">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#6B7280] font-mono line-through">TDR-101</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#22C55E]/15 text-[#22C55E]">Done</span>
                      </div>
                      <p className="text-xs font-semibold text-[#9CA3AF] line-through">Security & authorization audits</p>
                      <div className="flex items-center justify-between pt-1 text-[11px] text-[#6B7280]">
                        <span>Completed today</span>
                        <CheckCircle2 size={13} className="text-[#22C55E]" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Doc Sidebar */}
                <div className="bg-[#15171D] rounded-xl p-3 border border-[#242731] space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-[#E5E7EB] pb-2 border-b border-[#242731]">
                    <FolderTree size={14} className="text-[#DCB001]" />
                    <span>Project Docs</span>
                  </div>
                  <div className="space-y-1 text-[#9CA3AF]">
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-[#1C1E26] text-white font-medium">
                      <FileText size={13} className="text-[#DCB001]" />
                      <span>Architecture.md</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-[#1C1E26]/50">
                      <FileText size={13} />
                      <span>API-Reference.md</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-[#1C1E26]/50">
                      <FileText size={13} />
                      <span>Release-Notes.md</span>
                    </div>
                  </div>
                </div>

                {/* Doc Editor Preview */}
                <div className="sm:col-span-2 bg-[#15171D] rounded-xl p-4 border border-[#242731] space-y-3 text-xs font-mono">
                  <div className="flex items-center justify-between pb-2 border-b border-[#242731] text-[11px] text-[#6B7280]">
                    <span className="text-white font-bold font-sans"># Architecture & Workflow</span>
                    <span className="text-[#22C55E] flex items-center gap-1">
                      <Check size={12} /> Auto-saved
                    </span>
                  </div>
                  <div className="space-y-2 text-[#D1D5DB] leading-relaxed font-sans">
                    <p className="text-sm font-bold text-white">1. Core Principles</p>
                    <p className="text-xs text-[#9CA3AF]">
                      Keep task management lightweight and fast so developers and creators can focus on building.
                    </p>
                    <div className="p-3 bg-[#1C1E26] rounded-lg border border-[#2A2E3A] font-mono text-[11px] text-[#FBBF24]">
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
      <section id="features" className="py-20 px-6 border-t border-[#1F2128] bg-[#0E1013]">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-[#DCB001]">
              Features You&apos;ll Love
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Everything you need to get things done.
            </h2>
            <p className="text-sm text-[#9CA3AF]">
              Designed to be intuitive from minute one. No complex jargon or clutter.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl bg-[#14161C] border border-[#242731] hover:border-[#DCB001]/50 transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#DCB001]/15 text-[#DCB001] flex items-center justify-center">
                <Kanban size={20} />
              </div>
              <h3 className="text-base font-bold text-white">Visual Kanban Boards</h3>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                Move tasks across To Do, In Progress, Review, and Done with smooth drag-and-drop. Easily set priorities, due dates, and assignees.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl bg-[#14161C] border border-[#242731] hover:border-[#DCB001]/50 transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#06B6D4]/15 text-[#06B6D4] flex items-center justify-center">
                <FileText size={20} />
              </div>
              <h3 className="text-base font-bold text-white">Live Markdown Notes</h3>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                Write technical specs, meeting notes, and engineering documentation in clean Markdown with real-time preview and instant auto-save.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl bg-[#14161C] border border-[#242731] hover:border-[#DCB001]/50 transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#A855F7]/15 text-[#A855F7] flex items-center justify-center">
                <Layers size={20} />
              </div>
              <h3 className="text-base font-bold text-white">Tasks & Nested Subtasks</h3>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                Break complex goals down into clear checklists and hierarchical subtasks so every step is transparent and manageable.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-2xl bg-[#14161C] border border-[#242731] hover:border-[#DCB001]/50 transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#22C55E]/15 text-[#22C55E] flex items-center justify-center">
                <Zap size={20} />
              </div>
              <h3 className="text-base font-bold text-white">Instant Real-Time Sync</h3>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                Experience zero-lag updates. When you or a team member changes a task or edits a note, everyone sees it immediately.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── How It Works Section ─────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 px-6 border-t border-[#1F2128] bg-[#0B0C0E]">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-[#DCB001]">
              Simple 3-Step Setup
            </span>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              Up and running in less than a minute.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-[#14161B] border border-[#242731] space-y-3">
              <div className="w-8 h-8 rounded-full bg-[#DCB001] text-[#0B0C0E] font-extrabold text-sm flex items-center justify-center">
                1
              </div>
              <h3 className="text-sm font-bold text-white">Create a Project</h3>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                Give your project a name and invite your team members or work solo.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#14161B] border border-[#242731] space-y-3">
              <div className="w-8 h-8 rounded-full bg-[#DCB001] text-[#0B0C0E] font-extrabold text-sm flex items-center justify-center">
                2
              </div>
              <h3 className="text-sm font-bold text-white">Add Tasks & Docs</h3>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                Populate your board with tasks, checklists, and living Markdown documentation.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#14161B] border border-[#242731] space-y-3">
              <div className="w-8 h-8 rounded-full bg-[#DCB001] text-[#0B0C0E] font-extrabold text-sm flex items-center justify-center">
                3
              </div>
              <h3 className="text-sm font-bold text-white">Track & Ship</h3>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                Move tasks to Done with instant feedback, stay organized, and deliver on time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Call to Action Banner ───────────────────────────────────── */}
      <section className="py-20 px-6 border-t border-[#1F2128] bg-gradient-to-b from-[#111318] to-[#0B0C0E] text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Ready to simplify your projects?
          </h2>
          <p className="text-sm text-[#9CA3AF] max-w-xl mx-auto leading-relaxed">
            Start organizing your tasks and documentation today with Teader. Free, fast, and friendly.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3.5">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#DCB001] hover:bg-[#F59E0B] text-[#0B0C0E] font-bold text-sm transition-all shadow-[0_0_25px_rgba(220,176,1,0.3)] hover:scale-105"
            >
              <span>{isLoggedIn ? 'Open My Workspace' : 'Get Started Now'}</span>
              <ArrowRight size={16} />
            </Link>

            <a
              href="https://teader.vedipocketpc.online/releases/Teader-Workspace-Web-Setup.exe"
              download
              className="flex items-center gap-2 px-5 py-3.5 rounded-xl bg-[#181A20] hover:bg-[#22252C] border border-[#2E323C] hover:border-[#DCB001]/60 text-white font-medium text-sm transition-all"
            >
              <Download size={15} className="text-[#DCB001]" />
              <span>Download Desktop App</span>
            </a>
          </div>
        </div>
      </section>

      {/* ─── Clean Footer ────────────────────────────────────────────── */}
      <footer className="py-8 px-6 border-t border-[#1A1C22] bg-[#090A0C] text-xs text-[#6B7280]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">Teader</span>
            <span>• Build {BUILD_NUMBER}</span>
          </div>

          <div className="flex items-center gap-5">
            <a
              href="https://teader.vedipocketpc.online/releases/Teader-Workspace-Web-Setup.exe"
              download
              className="text-[#DCB001] hover:underline flex items-center gap-1"
            >
              <Download size={12} />
              <span>Download App</span>
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
