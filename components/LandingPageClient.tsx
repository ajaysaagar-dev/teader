'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  GitFork, 
  Layers, 
  Zap, 
  ShieldCheck, 
  FolderKanban, 
  ArrowRight, 
  Sparkles, 
  FileText, 
  Cpu, 
  Database,
  LogOut,
  LayoutDashboard,
  Download
} from 'lucide-react';
import { TeaderSandCanvas } from '@/components/ui/TeaderSandCanvas';
import { toast } from 'sonner';
import { BUILD_NUMBER } from '@/lib/build-info';

interface AuthUser {
  name?: string;
  email?: string;
  id?: string | number;
}

export default function LandingPageClient() {
  const [activeTab, setActiveTab] = useState<'graph' | 'kanban' | 'docs' | 'tree'>('graph');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('teader_user');
        return cached ? JSON.parse(cached) : null;
      } catch {
        return null;
      }
    }
    return null;
  });

  // Check login state
  useEffect(() => {
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

  const isLoggedIn = Boolean(currentUser);

  return (
    <div className="min-h-screen bg-[#0A0B0D] text-[#CFD4DD] font-sans selection:bg-[#DCB001]/30 selection:text-[#DCB001] overflow-x-hidden">
      {/* ─── Sand Dissolve Canvas Intro ──────────────────────────────── */}
      <TeaderSandCanvas />

      {/* ─── Navigation Header ────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0A0B0D]/80 border-b border-[#222428]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 group" aria-label="Teader Home">
              <span className="font-extrabold text-xl text-white tracking-tight flex items-center gap-1 font-prompt">
                teader <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-[#1F2126] text-[#DCB001] rounded border border-[#2E3138]">{BUILD_NUMBER}</span>
              </span>
            </Link>

            <nav aria-label="Main Navigation" className="hidden md:flex items-center gap-6 text-xs font-medium text-[#9BA1A6]">
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#branch-explorer" className="hover:text-white transition-colors">Branch Explorer</a>
              <a href="#architecture" className="hover:text-white transition-colors">Architecture</a>
              <Link href="/documentation" className="hover:text-white transition-colors">Documentation</Link>
            </nav>
          </div>

          {/* Auth Header Buttons & Download App */}
          <div className="flex items-center gap-3">
            <a
              href="https://teader.vedipocketpc.online/releases/Teader-Workspace-Web-Setup.exe"
              download
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#16181C] hover:bg-[#1E2025] text-[#CFD4DD] hover:text-white border border-[#2A2C30] hover:border-[#DCB001]/40 text-xs font-medium transition-all shadow-sm"
              title="Download Desktop App for Windows"
            >
              <Download size={13} className="text-[#DCB001]" />
              <span>Download App</span>
            </a>

            {isLoggedIn ? (
              <>
                {/* Logged in view: User badge + Launch Dashboard + Logout button */}
                <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#16181C] border border-[#2A2C30] text-xs font-mono">
                  <div className="w-4 h-4 rounded-full bg-[#DCB001] text-[#0A0B0D] flex items-center justify-center text-[10px] font-bold">
                    {(currentUser?.name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <span className="text-white font-bold">{currentUser?.name}</span>
                </div>

                <Link
                  href="/dashboard"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#DCB001] hover:bg-[#E5B800] text-[#0A0B0D] font-bold text-xs transition-all shadow-[0_0_20px_rgba(220,176,1,0.25)] hover:scale-[1.02]"
                >
                  <LayoutDashboard size={13} />
                  <span>Go to Dashboard</span>
                </Link>

                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EF4444]/15 hover:bg-[#EF4444]/25 text-[#EF4444] border border-[#EF4444]/30 text-xs font-medium transition-colors"
                  title="Sign Out"
                >
                  <LogOut size={13} />
                  <span>Logout</span>
                </button>
              </>
            ) : (
              <>
                {/* Logged out view: Sign In + Get Started */}
                <Link
                  href="/login"
                  className="px-3.5 py-1.5 text-xs font-medium text-[#CFD4DD] hover:text-white transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/dashboard"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#DCB001] hover:bg-[#E5B800] text-[#0A0B0D] font-bold text-xs transition-all shadow-[0_0_20px_rgba(220,176,1,0.25)] hover:scale-[1.02]"
                >
                  <span>Launch App</span>
                  <ArrowRight size={13} />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ─── Semantic Main Area ───────────────────────────────────────── */}
      <main>
        {/* ─── Hero Section ────────────────────────────────────────────── */}
        <section className="relative pt-20 pb-24 px-6 overflow-hidden">
          {/* Ambient Glows */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-[#DCB001]/10 blur-[140px] pointer-events-none rounded-full" />
          <div className="absolute top-1/3 left-1/3 w-[450px] h-[250px] bg-[#06B6D4]/10 blur-[120px] pointer-events-none rounded-full" />

          <div className="max-w-5xl mx-auto text-center space-y-6 relative z-10">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#16181C] border border-[#2E3138] text-xs text-[#DCB001] shadow-inner">
              <Sparkles size={13} />
              <span>Linear Speed & Unity Version Control Style Tracking</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-[1.1]">
              The High-Velocity Project Tracker <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#DCB001] via-[#FBBF24] to-[#F59E0B]">
                Engineered for Developers.
              </span>
            </h1>

            {/* Subheading */}
            <p className="text-base sm:text-lg text-[#8E939D] max-w-2xl mx-auto leading-relaxed">
              Instant 0ms optimistic UI, Unity VCS-style branch explorer graphs, hierarchical subtasks, 
              and real-time Markdown docs. Zero latency. 100% developer focus.
            </p>

            {/* Hero CTAs */}
            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#DCB001] hover:bg-[#E5B800] text-[#0A0B0D] font-bold text-sm transition-all shadow-[0_0_30px_rgba(220,176,1,0.35)] hover:scale-105"
              >
                <span>{isLoggedIn ? 'Go to Dashboard' : 'Get Started Free'}</span>
                <ArrowRight size={16} />
              </Link>

              <a
                href="https://teader.vedipocketpc.online/releases/Teader-Workspace-Web-Setup.exe"
                download
                className="flex items-center gap-3 px-6 py-3.5 rounded-xl bg-[#16181C] hover:bg-[#1F2126] border border-[#2E3138] hover:border-[#DCB001] text-white font-semibold text-sm transition-all shadow-sm group hover:scale-105"
              >
                <Download size={16} className="text-[#DCB001] group-hover:-translate-y-0.5 transition-transform" />
                <div className="flex flex-col text-left">
                  <span className="leading-tight font-bold">Download Workspace</span>
                  <span className="text-[10px] text-[#8E939D] font-mono leading-tight">Windows (.exe) • 873 KB</span>
                </div>
              </a>

              {!isLoggedIn && (
                <Link
                  href="/register"
                  className="flex items-center gap-2 px-5 py-3.5 rounded-xl bg-[#16181C]/70 hover:bg-[#1F2126] border border-[#2E3138] hover:border-[#DCB001]/50 text-white font-medium text-sm transition-all shadow-sm"
                >
                  <span>Create Account</span>
                </Link>
              )}

              {isLoggedIn && (
                <Link
                  href="/projects"
                  className="flex items-center gap-2 px-5 py-3.5 rounded-xl bg-[#16181C]/70 hover:bg-[#1F2126] border border-[#2E3138] hover:border-[#DCB001]/50 text-white font-medium text-sm transition-all shadow-sm"
                >
                  <FolderKanban size={15} className="text-[#DCB001]" />
                  <span>View Projects</span>
                </Link>
              )}
            </div>

            {/* Feature Highlights Pills */}
            <div className="pt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-[#787C83] font-mono">
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-[#DCB001]" />
                <span>0ms Optimistic UI</span>
              </div>
              <div className="flex items-center gap-2">
                <GitFork size={14} className="text-[#06B6D4]" />
                <span>Smooth Curved Graph Splines</span>
              </div>
              <div className="flex items-center gap-2">
                <Database size={14} className="text-[#22C55E]" />
                <span>PostgreSQL Realtime Sync</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-[#A855F7]" />
                <span>In-Place Granular Diffing</span>
              </div>
            </div>
          </div>

          {/* ─── Interactive Product Preview Card ────────────────────────── */}
          <div id="branch-explorer" className="max-w-6xl mx-auto mt-14 rounded-2xl bg-[#121417] border border-[#272A30] shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden relative group">
            {/* Top Window Bar */}
            <div className="h-11 px-4 bg-[#181A1F] border-b border-[#272A30] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#EF4444]/60" />
                <span className="w-3 h-3 rounded-full bg-[#F59E0B]/60" />
                <span className="w-3 h-3 rounded-full bg-[#22C55E]/60" />
                <span className="text-xs font-mono text-[#787C83] ml-2">app.teader.io / workspace / TestProject</span>
              </div>

              {/* View Switcher Tabs */}
              <div className="flex items-center bg-[#101113] p-1 rounded-lg border border-[#272A30] text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setActiveTab('graph')}
                  className={`px-3 py-1 rounded transition-all ${
                    activeTab === 'graph' ? 'bg-[#DCB001] text-[#0A0B0D] font-bold' : 'text-[#787C83] hover:text-white'
                  }`}
                >
                  Graph Timeline
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('kanban')}
                  className={`px-3 py-1 rounded transition-all ${
                    activeTab === 'kanban' ? 'bg-[#DCB001] text-[#0A0B0D] font-bold' : 'text-[#787C83] hover:text-white'
                  }`}
                >
                  Kanban Board
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('docs')}
                  className={`px-3 py-1 rounded transition-all ${
                    activeTab === 'docs' ? 'bg-[#DCB001] text-[#0A0B0D] font-bold' : 'text-[#787C83] hover:text-white'
                  }`}
                >
                  Markdown Docs
                </button>
              </div>
            </div>

            {/* Interactive Preview Body */}
            <div className="p-6 bg-[#0E1012] min-h-[380px] flex flex-col justify-center">
              {activeTab === 'graph' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between text-xs font-mono text-[#787C83]">
                    <span className="flex items-center gap-1.5 text-[#06B6D4]">
                      <GitFork size={14} /> Branch Explorer (Unity Version Control Splines)
                    </span>
                    <span>110+ Active Nodes • Horizontal Timeline</span>
                  </div>

                  {/* SVG Visual Demo Splines */}
                  <div className="h-44 w-full bg-[#131518] rounded-xl border border-[#222428] relative overflow-hidden flex items-center px-6">
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
                      <path
                        d="M 60 70 C 140 70, 180 35, 260 35 C 340 35, 380 35, 460 35 C 540 35, 580 90, 660 90"
                        fill="none"
                        stroke="#06B6D4"
                        strokeWidth="2.5"
                      />
                      <path
                        d="M 60 70 C 140 70, 180 115, 260 115 C 340 115, 380 115, 460 115 C 540 115, 580 90, 660 90"
                        fill="none"
                        stroke="#A855F7"
                        strokeWidth="2.5"
                      />
                      <path
                        d="M 460 35 C 540 35, 580 35, 660 35 C 740 35, 780 70, 860 70"
                        fill="none"
                        stroke="#22C55E"
                        strokeWidth="2.5"
                      />
                      <path
                        d="M 260 115 C 340 115, 380 70, 460 70"
                        fill="none"
                        stroke="#EF4444"
                        strokeWidth="2"
                        strokeDasharray="4 3"
                      />
                    </svg>

                    {/* Simulated Nodes */}
                    <div className="relative z-10 flex items-center justify-between w-full">
                      <div className="p-2.5 rounded-lg bg-[#181A1F] border border-[#06B6D4] text-left text-xs shadow-lg">
                        <span className="font-mono text-[10px] text-[#06B6D4] font-bold">TEST-1</span>
                        <p className="text-white font-semibold text-xs truncate max-w-[140px]">SIMD Matrix4x4</p>
                        <span className="text-[9px] text-[#22C55E] font-mono">Done</span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-[#181A1F] border border-[#A855F7] text-left text-xs shadow-lg">
                        <span className="font-mono text-[10px] text-[#A855F7] font-bold">TEST-4</span>
                        <p className="text-white font-semibold text-xs truncate max-w-[140px]">CCD Fast Collision</p>
                        <span className="text-[9px] text-[#F59E0B] font-mono">In Progress</span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-[#181A1F] border border-[#EF4444] text-left text-xs shadow-lg">
                        <span className="font-mono text-[10px] text-[#EF4444] font-bold">TEST-8</span>
                        <p className="text-white font-semibold text-xs truncate max-w-[140px]">GPU Particle Shaders</p>
                        <span className="text-[9px] text-[#EF4444] font-mono">Blocked</span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-[#181A1F] border border-[#22C55E] text-left text-xs shadow-lg">
                        <span className="font-mono text-[10px] text-[#22C55E] font-bold">TEST-11</span>
                        <p className="text-white font-semibold text-xs truncate max-w-[140px]">Docker Turbopack CI</p>
                        <span className="text-[9px] text-[#22C55E] font-mono">Merged</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'kanban' && (
                <div className="grid grid-cols-4 gap-3 text-left">
                  {['TODO (32)', 'IN PROGRESS (24)', 'NEEDS REVIEW (8)', 'DONE (46)'].map((col, idx) => (
                    <div key={col} className="p-3 rounded-xl bg-[#14161A] border border-[#222428] space-y-2">
                      <span className="text-[11px] font-mono font-bold text-[#8E939D]">{col}</span>
                      <div className="p-2.5 rounded-lg bg-[#1B1D22] border border-[#2E3138] space-y-1">
                        <span className="text-[10px] font-mono text-[#DCB001]">TEST-{idx * 4 + 1}</span>
                        <p className="text-xs font-semibold text-white truncate">High-speed transform pipeline</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'docs' && (
                <div id="docs" className="grid grid-cols-12 gap-4 text-left">
                  <div className="col-span-4 p-3 rounded-xl bg-[#14161A] border border-[#222428] space-y-1.5 text-xs font-mono">
                    <span className="text-[10px] text-[#787C83]">PROJECT SPECS</span>
                    <div className="p-2 rounded bg-[#1C1E23] text-[#DCB001] font-bold">proj_test_engine_overview.md</div>
                    <div className="p-2 rounded text-[#9BA1A6]">proj_test_coding_guidelines.md</div>
                  </div>
                  <div className="col-span-8 p-4 rounded-xl bg-[#14161A] border border-[#222428] font-mono text-xs text-[#9BA1A6] space-y-2">
                    <p className="text-[#DCB001] font-bold"># TestProject Architecture</p>
                    <p className="text-white">## 1. Core Subsystems</p>
                    <p>- Vulkan 1.3 deferred render pass pipeline.</p>
                    <p>- Real-time continuous collision detection (CCD).</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ─── Features Grid ───────────────────────────────────────────── */}
        <section id="features" className="py-24 px-6 border-t border-[#1C1E22] bg-[#0C0D10]">
          <div className="max-w-7xl mx-auto space-y-16">
            <div className="text-center space-y-3 max-w-3xl mx-auto">
              <h2 className="text-xs font-mono uppercase tracking-wider text-[#DCB001]">Built For Speed</h2>
              <p className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Every interaction is tuned for zero-latency workflows.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Feature 1 */}
              <div className="p-7 rounded-2xl bg-[#121417] border border-[#222428] hover:border-[#DCB001]/50 transition-all space-y-3 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-[#DCB001]/15 text-[#DCB001] flex items-center justify-center font-bold">
                  <Zap size={20} />
                </div>
                <h3 className="text-lg font-bold text-white">0ms Optimistic UI & Local Cache</h3>
                <p className="text-xs text-[#8E939D] leading-relaxed">
                  Task creations, checkbox ticking, column dragging, and document saves apply instantly on the client while background jobs sync with PostgreSQL.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="p-7 rounded-2xl bg-[#121417] border border-[#222428] hover:border-[#06B6D4]/50 transition-all space-y-3 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-[#06B6D4]/15 text-[#06B6D4] flex items-center justify-center font-bold">
                  <GitFork size={20} />
                </div>
                <h3 className="text-lg font-bold text-white">Unity VCS Branch Explorer</h3>
                <p className="text-xs text-[#8E939D] leading-relaxed">
                  Horizontal timeline progression with smooth cubic Bezier curved splines. Visualizes task branches, blocking dependencies, and merge convergences.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="p-7 rounded-2xl bg-[#121417] border border-[#222428] hover:border-[#A855F7]/50 transition-all space-y-3 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-[#A855F7]/15 text-[#A855F7] flex items-center justify-center font-bold">
                  <Layers size={20} />
                </div>
                <h3 className="text-lg font-bold text-white">Hierarchical Subtasks & Folders</h3>
                <p className="text-xs text-[#8E939D] leading-relaxed">
                  Structure complex deliverables with infinitely nestable sub-work items, folder grouping, image drag-and-drop, and full keyboard navigation.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="p-7 rounded-2xl bg-[#121417] border border-[#222428] hover:border-[#22C55E]/50 transition-all space-y-3 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-[#22C55E]/15 text-[#22C55E] flex items-center justify-center font-bold">
                  <FileText size={20} />
                </div>
                <h3 className="text-lg font-bold text-white">Live Markdown Project Docs</h3>
                <p className="text-xs text-[#8E939D] leading-relaxed">
                  Write technical specifications in pure Markdown with real-time GitHub-flavored preview, instant Ctrl+S saving, and database persistence.
                </p>
              </div>

              {/* Feature 5 */}
              <div className="p-7 rounded-2xl bg-[#121417] border border-[#222428] hover:border-[#F59E0B]/50 transition-all space-y-3 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/15 text-[#F59E0B] flex items-center justify-center font-bold">
                  <Cpu size={20} />
                </div>
                <h3 className="text-lg font-bold text-white">Granular In-Place Diffing</h3>
                <p className="text-xs text-[#8E939D] leading-relaxed">
                  Surgical reconciliation prevents full page reloads and re-renders. Only the mutated node updates in DOM memory.
                </p>
              </div>

              {/* Feature 6 */}
              <div className="p-7 rounded-2xl bg-[#121417] border border-[#222428] hover:border-[#EC4899]/50 transition-all space-y-3 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-[#EC4899]/15 text-[#EC4899] flex items-center justify-center font-bold">
                  <Database size={20} />
                </div>
                <h3 className="text-lg font-bold text-white">PostgreSQL Enterprise Storage</h3>
                <p className="text-xs text-[#8E939D] leading-relaxed">
                  Hardened relational database layer with salted password hashing, JWT session cookies, and rate-limiting security.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Architecture Section ─────────────────────────────────────── */}
        <section id="architecture" className="py-20 px-6 border-t border-[#1C1E22] bg-[#0A0B0D]">
          <div className="max-w-7xl mx-auto space-y-12">
            <div className="text-center space-y-2 max-w-2xl mx-auto">
              <h2 className="text-xs font-mono uppercase tracking-wider text-[#06B6D4]">Architecture</h2>
              <p className="text-3xl font-extrabold text-white tracking-tight">
                Built for speed, resilient to network latency.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
              <div className="p-5 rounded-xl bg-[#111215] border border-[#222428] space-y-2">
                <div className="text-[#DCB001] font-mono text-xs font-bold">01 / CACHE-FIRST</div>
                <h3 className="text-sm font-bold text-white">LocalStorage SWR Layer</h3>
                <p className="text-xs text-[#787C83]">Hydrates instant cached state on client mount with zero hydration mismatch errors.</p>
              </div>

              <div className="p-5 rounded-xl bg-[#111215] border border-[#222428] space-y-2">
                <div className="text-[#06B6D4] font-mono text-xs font-bold">02 / BACKGROUND SYNC</div>
                <h3 className="text-sm font-bold text-white">Non-Blocking Persistence</h3>
                <p className="text-xs text-[#787C83]">Mutations emit 0ms UI feedback and dispatch PostgreSQL writes in background threads.</p>
              </div>

              <div className="p-5 rounded-xl bg-[#111215] border border-[#222428] space-y-2">
                <div className="text-[#22C55E] font-mono text-xs font-bold">03 / SURGICAL RECONCILER</div>
                <h3 className="text-sm font-bold text-white">Referential Memory Equality</h3>
                <p className="text-xs text-[#787C83]">Retains exact unchanged object pointers so React.memo skips re-rendering 99% of DOM nodes.</p>
              </div>

              <div className="p-5 rounded-xl bg-[#111215] border border-[#222428] space-y-2">
                <div className="text-[#A855F7] font-mono text-xs font-bold">04 / MILITARY VAULT</div>
                <h3 className="text-sm font-bold text-white">AES-256-GCM Dumps</h3>
                <p className="text-xs text-[#787C83]">Export whole workspaces as encrypted .teaderdumpfile archives with SHA-256 checksums.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Call To Action Footer ───────────────────────────────────── */}
        <section className="py-20 px-6 border-t border-[#1C1E22] bg-[#08090B] text-center relative overflow-hidden">
          <div className="max-w-4xl mx-auto space-y-6 relative z-10">
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              Supercharge your team&apos;s development velocity today.
            </h2>
            <p className="text-sm text-[#8E939D] max-w-xl mx-auto">
              Experience the speed of Teader with instant task management, branch explorer timeline graphs, and markdown docs.
            </p>

            <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[#DCB001] hover:bg-[#E5B800] text-[#0A0B0D] font-bold text-sm transition-all shadow-[0_0_30px_rgba(220,176,1,0.3)] hover:scale-105"
              >
                <span>{isLoggedIn ? 'Launch Workspace' : 'Get Started Free'}</span>
                <ArrowRight size={16} />
              </Link>

              <a
                href="https://teader.vedipocketpc.online/releases/Teader-Workspace-Web-Setup.exe"
                download
                className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#16181C] hover:bg-[#1F2126] border border-[#2E3138] hover:border-[#DCB001] text-white font-semibold text-sm transition-all shadow-sm group hover:scale-105"
              >
                <Download size={16} className="text-[#DCB001] group-hover:-translate-y-0.5 transition-transform" />
                <span>Download Workspace (873 KB)</span>
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* ─── Copyright & Links Footer ─────────────────────────────────── */}
      <footer className="py-8 px-6 border-t border-[#18191C] bg-[#070708] text-xs text-[#6B707B] font-mono">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span>Teader Platform ({BUILD_NUMBER}) © 2026. Built with Next.js & PostgreSQL.</span>
          </div>

          <div className="flex items-center gap-5">
            <a
              href="https://teader.vedipocketpc.online/releases/Teader-Workspace-Web-Setup.exe"
              download
              className="text-[#DCB001] hover:underline flex items-center gap-1"
            >
              <Download size={11} />
              <span>Download App</span>
            </a>
            <Link href="/dashboard" className="hover:text-[#CFD4DD] transition-colors">Dashboard</Link>
            <Link href="/projects" className="hover:text-[#CFD4DD] transition-colors">Projects</Link>
            <Link href="/docs" className="hover:text-[#CFD4DD] transition-colors">API Docs</Link>
            {!isLoggedIn && (
              <>
                <Link href="/login" className="hover:text-[#CFD4DD] transition-colors">Sign In</Link>
                <Link href="/register" className="hover:text-[#CFD4DD] transition-colors">Register</Link>
              </>
            )}
            {isLoggedIn && (
              <button onClick={handleLogout} className="hover:text-[#EF4444] transition-colors">
                Sign Out
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
