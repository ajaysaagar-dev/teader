'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Download,
  FolderTree,
  Users,
  CheckCircle2,
  Share2,
  Code2,
  Compass,
  FileCode,
  Search,
  BookOpen,
  MousePointer,
  Keyboard,
  Clock,
  Sparkle
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
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [mounted, setMounted] = useState(false);
  const [activeDocTab, setActiveDocTab] = useState<'markdown' | 'collaboration' | 'folders' | 'sync'>('collaboration');

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



  // ─── Bidirectional Scroll Fade-In / Fade-Out Observer ──────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Incoming content: smoothly fade-in to 1
            entry.target.classList.add('opacity-100', 'translate-y-0', 'scale-100');
            entry.target.classList.remove('opacity-0', 'translate-y-10', 'scale-[0.98]', 'pointer-events-none');
          } else {
            // Outgoing content: smoothly fade-out to 0 (works in BOTH scroll directions: up and down)
            entry.target.classList.add('opacity-0', 'translate-y-10', 'scale-[0.98]', 'pointer-events-none');
            entry.target.classList.remove('opacity-100', 'translate-y-0', 'scale-100');
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: '-20px 0px -20px 0px',
      }
    );

    const elements = document.querySelectorAll('.reveal-on-scroll');
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [mounted]);

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
    <div className="min-h-screen bg-[#0A0B0D] text-[#CFD4DD] font-landing selection:bg-[#DCB001]/30 selection:text-[#DCB001] overflow-x-hidden">
      {/* ─── Sand Dissolve Canvas Intro ──────────────────────────────── */}
      <TeaderSandCanvas />

      {/* ─── Navigation Header ────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0A0B0D]/85 border-b border-[#222428]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 group" aria-label="Teader Home">
              <span className="font-extrabold text-xl text-white tracking-tight flex items-center gap-1 font-prompt">
                teader
              </span>
            </Link>

            <nav aria-label="Main Navigation" className="hidden md:flex items-center gap-6 text-xs font-medium text-[#9BA1A6]">
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#documentation-suite" className="hover:text-white transition-colors">Documentation Suite</a>
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
        <section className="relative pt-24 pb-28 px-6 overflow-hidden reveal-on-scroll opacity-100 transition-all duration-700 ease-out">
          {/* Ambient Glows */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[750px] h-[380px] bg-[#DCB001]/10 blur-[150px] pointer-events-none rounded-full" />
          <div className="absolute top-1/3 left-1/3 w-[500px] h-[280px] bg-[#06B6D4]/10 blur-[130px] pointer-events-none rounded-full" />

          <div className="max-w-5xl mx-auto text-center space-y-7 relative z-10">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#16181C] border border-[#2E3138] text-xs text-[#DCB001] shadow-inner transition-all hover:border-[#DCB001]/40">
              <Sparkles size={13} />
              <span>Universal Professional Project & Documentation Management</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-[1.08]">
              The High-Velocity Platform <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#DCB001] via-[#FBBF24] to-[#F59E0B]">
                For Projects & Technical Docs.
              </span>
            </h1>

            {/* Subheading */}
            <p className="text-base sm:text-lg text-[#8E939D] max-w-3xl mx-auto leading-relaxed">
              Engineered for high-performing software teams, product managers, and technical organizations. 
              Zero-latency 0ms optimistic UI, live multi-user collaborative documentation, timeline branch explorer graphs, 
              and hierarchical task systems.
            </p>

            {/* Hero CTAs */}
            <div className="flex flex-wrap items-center justify-center gap-4 pt-3">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[#DCB001] hover:bg-[#E5B800] text-[#0A0B0D] font-bold text-sm transition-all shadow-[0_0_30px_rgba(220,176,1,0.35)] hover:scale-105"
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
                  <span className="text-[10px] text-[#8E939D] font-mono leading-tight">Windows App • 873 KB</span>
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
            </div>

            {/* Feature Highlights Pills */}
            <div className="pt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-[#787C83] font-mono">
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-[#DCB001]" />
                <span>0ms Optimistic UI</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-[#06B6D4]" />
                <span>Real-Time Collaborative Docs</span>
              </div>
              <div className="flex items-center gap-2">
                <GitFork size={14} className="text-[#A855F7]" />
                <span>Timeline Branch Graphs</span>
              </div>
              <div className="flex items-center gap-2">
                <Database size={14} className="text-[#22C55E]" />
                <span>Enterprise Relational Sync</span>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Documentation Suite Showcase Section ────────────────────────── */}
        <section id="documentation-suite" className="py-24 px-6 border-t border-[#1C1E22] bg-[#0E0F13] reveal-on-scroll opacity-0 translate-y-8 transition-all duration-700">
          <div className="max-w-7xl mx-auto space-y-12">
            <div className="text-center space-y-3 max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DCB001]/10 text-[#DCB001] border border-[#DCB001]/30 text-xs font-mono font-semibold">
                <BookOpen size={13} />
                <span>Full-Featured Documentation Engine</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Advanced Documentation Management With Detailed Options.
              </h2>
              <p className="text-sm text-[#8E939D] leading-relaxed">
                Everything technical teams need to author, organize, collaborate, and persist living specifications, design docs, and release plans in real-time.
              </p>
            </div>

            {/* Interactive Doc Feature Tabs */}
            <div className="flex items-center justify-center gap-2 flex-wrap pb-2">
              <button
                onClick={() => setActiveDocTab('collaboration')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeDocTab === 'collaboration'
                    ? 'bg-[#DCB001] text-[#0A0B0D] shadow-[0_0_15px_rgba(220,176,1,0.3)]'
                    : 'bg-[#141518] text-[#8E939D] hover:text-white border border-[#222428]'
                }`}
              >
                <Users size={14} />
                <span>Multi-User Live Presence</span>
              </button>

              <button
                onClick={() => setActiveDocTab('markdown')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeDocTab === 'markdown'
                    ? 'bg-[#DCB001] text-[#0A0B0D] shadow-[0_0_15px_rgba(220,176,1,0.3)]'
                    : 'bg-[#141518] text-[#8E939D] hover:text-white border border-[#222428]'
                }`}
              >
                <FileCode size={14} />
                <span>GitHub Markdown & HTML</span>
              </button>

              <button
                onClick={() => setActiveDocTab('folders')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeDocTab === 'folders'
                    ? 'bg-[#DCB001] text-[#0A0B0D] shadow-[0_0_15px_rgba(220,176,1,0.3)]'
                    : 'bg-[#141518] text-[#8E939D] hover:text-white border border-[#222428]'
                }`}
              >
                <FolderTree size={14} />
                <span>Folder Trees & Drag-and-Drop</span>
              </button>

              <button
                onClick={() => setActiveDocTab('sync')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeDocTab === 'sync'
                    ? 'bg-[#DCB001] text-[#0A0B0D] shadow-[0_0_15px_rgba(220,176,1,0.3)]'
                    : 'bg-[#141518] text-[#8E939D] hover:text-white border border-[#222428]'
                }`}
              >
                <Zap size={14} />
                <span>Smart Auto-Save & Sync</span>
              </button>
            </div>

            {/* Showcase Display Card */}
            <div className="rounded-2xl bg-[#121417] border border-[#272A30] shadow-2xl p-6 sm:p-10 space-y-8">
              {activeDocTab === 'collaboration' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                  <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#06B6D4]/10 text-[#06B6D4] text-xs font-mono font-bold">
                      <MousePointer size={13} />
                      <span>Real-Time Presence</span>
                    </div>
                    <h3 className="text-2xl font-extrabold text-white">Live Multi-User Cursors & Floating Nametags</h3>
                    <p className="text-xs sm:text-sm text-[#8E939D] leading-relaxed">
                      Collaborate in documents simultaneously with team members. See exact cursor positions across paragraphs, lists, and code blocks in real time with floating custom color username nametags.
                    </p>
                    <ul className="space-y-2.5 text-xs text-[#CFD4DD]">
                      <li className="flex items-center gap-2.5">
                        <CheckCircle2 size={14} className="text-[#DCB001]" />
                        <span>Real-time cursor broadcasting with 0ms local perceived latency.</span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <CheckCircle2 size={14} className="text-[#DCB001]" />
                        <span>Zero-latency cleanup when a teammate switches files or exits the tab.</span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <CheckCircle2 size={14} className="text-[#DCB001]" />
                        <span>Smooth automated viewport scroll gliding to incoming real-time change spots.</span>
                      </li>
                    </ul>
                  </div>

                  <div className="p-6 rounded-xl bg-[#0A0B0E] border border-[#2A2C30] space-y-4 font-mono text-xs shadow-inner">
                    <div className="flex items-center justify-between pb-3 border-b border-[#222428] text-[11px] text-[#787C83]">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
                        <span className="text-[#CFD4DD] font-bold">LIVE COLLABORATION PREVIEW</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded bg-[#06B6D4]/20 text-[#06B6D4] font-bold text-[10px]">Ajay (Line 14)</span>
                        <span className="px-2 py-0.5 rounded bg-[#A855F7]/20 text-[#A855F7] font-bold text-[10px]">Karri (Line 22)</span>
                      </div>
                    </div>

                    <div className="space-y-2 text-[#9BA1A6] leading-relaxed select-none">
                      <p className="text-white font-bold"># Architecture Specifications & Endpoints</p>
                      <p>All endpoints operate with sub-millisecond local cache optimistic responses.</p>
                      <div className="p-2 rounded bg-[#16181D] border border-[#2E3138] relative">
                        <span className="text-[#06B6D4]">POST /api/projects/:id/docs</span>
                        <span className="inline-block relative ml-1 align-middle">
                          <span className="inline-block w-[3px] h-4 bg-[#06B6D4] animate-pulse rounded-full" />
                          <span className="absolute -top-6 -left-3 px-1.5 py-0.5 bg-[#0A0B0D] border border-[#06B6D4] text-[#06B6D4] text-[9px] font-bold rounded shadow">Ajay</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeDocTab === 'markdown' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                  <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#22C55E]/10 text-[#22C55E] text-xs font-mono font-bold">
                      <Code2 size={13} />
                      <span>Full Markdown Standard</span>
                    </div>
                    <h3 className="text-2xl font-extrabold text-white">Full GitHub-Flavored Markdown & HTML</h3>
                    <p className="text-xs sm:text-sm text-[#8E939D] leading-relaxed">
                      Write formatted documents with native support for tables, embedded HTML details and summary toggles, keyboard shortcut badges, alert callouts, and task checkboxes.
                    </p>
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="p-3 rounded-lg bg-[#16181C] border border-[#26282E] text-xs space-y-1">
                        <span className="font-bold text-[#DCB001]">Collapsible Sections</span>
                        <p className="text-[11px] text-[#8E939D]">&lt;details&gt; & &lt;summary&gt; tags</p>
                      </div>
                      <div className="p-3 rounded-lg bg-[#16181C] border border-[#26282E] text-xs space-y-1">
                        <span className="font-bold text-[#06B6D4]">GitHub Alert Blocks</span>
                        <p className="text-[11px] text-[#8E939D]">&gt; [!NOTE], [!TIP], [!WARNING]</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 rounded-xl bg-[#0A0B0E] border border-[#2A2C30] space-y-3 text-xs shadow-inner">
                    <div className="p-3 rounded-lg bg-[#1E293B]/40 border-l-4 border-[#3B82F6] text-[#60A5FA] font-bold">
                      <span>[!NOTE] Synchronized Live Split Preview</span>
                    </div>
                    <div className="p-3 rounded-lg bg-[#111215] border border-[#2E3138] space-y-1">
                      <span className="font-mono text-[#DCB001] font-bold">Keyboard Shortcuts</span>
                      <p className="text-[#8E939D] text-[11px]">Press <kbd className="px-1.5 py-0.5 bg-[#1C1E24] border border-[#2E3138] rounded text-white font-mono text-[10px]">Ctrl + S</kbd> for instant manual persistence.</p>
                    </div>
                  </div>
                </div>
              )}

              {activeDocTab === 'folders' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                  <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#A855F7]/10 text-[#A855F7] text-xs font-mono font-bold">
                      <FolderTree size={13} />
                      <span>Directory Hierarchy</span>
                    </div>
                    <h3 className="text-2xl font-extrabold text-white">Folder Trees & Drag-and-Drop Organization</h3>
                    <p className="text-xs sm:text-sm text-[#8E939D] leading-relaxed">
                      Group technical specs and engineering wikis into structured directories. Drag and drop documents between folders with instant real-time disk and database re-indexing.
                    </p>
                    <ul className="space-y-2.5 text-xs text-[#CFD4DD]">
                      <li className="flex items-center gap-2.5">
                        <CheckCircle2 size={14} className="text-[#DCB001]" />
                        <span>Default <strong>Start</strong> folder initialization for instant document creation.</span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <CheckCircle2 size={14} className="text-[#DCB001]" />
                        <span>Inline file renaming with real-time optimistic sidebar reflection.</span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <CheckCircle2 size={14} className="text-[#DCB001]" />
                        <span>Folder expand/collapse state remembered in fast local cache.</span>
                      </li>
                    </ul>
                  </div>

                  <div className="p-6 rounded-xl bg-[#0A0B0E] border border-[#2A2C30] space-y-2 text-xs font-mono shadow-inner">
                    <div className="flex items-center gap-2 text-[#DCB001] font-bold pb-2 border-b border-[#222428]">
                      <FolderTree size={15} />
                      <span>Start (Default Directory)</span>
                    </div>
                    <div className="pl-4 space-y-1.5 text-[#CFD4DD]">
                      <div className="flex items-center gap-2 p-1.5 rounded bg-[#16181D] border border-[#2A2C30]">
                        <FileText size={13} className="text-[#06B6D4]" />
                        <span>01-getting-started.md</span>
                      </div>
                      <div className="flex items-center gap-2 p-1.5 rounded hover:bg-[#16181D]/50 text-[#8E939D]">
                        <FileText size={13} />
                        <span>02-architecture-overview.md</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeDocTab === 'sync' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                  <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#F59E0B]/10 text-[#F59E0B] text-xs font-mono font-bold">
                      <Zap size={13} />
                      <span>Zero-Latency Sync</span>
                    </div>
                    <h3 className="text-2xl font-extrabold text-white">Smart Auto-Save & Change-Spot Tracking</h3>
                    <p className="text-xs sm:text-sm text-[#8E939D] leading-relaxed">
                      Never lose your work. Teader automatically debounces edits to the database while maintaining instant local cache responsiveness and surgical scroll synchronization.
                    </p>
                    <ul className="space-y-2.5 text-xs text-[#CFD4DD]">
                      <li className="flex items-center gap-2.5">
                        <CheckCircle2 size={14} className="text-[#DCB001]" />
                        <span>Targeted change-spot scrolling: preview glides directly to edited lines.</span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <CheckCircle2 size={14} className="text-[#DCB001]" />
                        <span>Dual auto-save + instant manual Ctrl+S hotkey triggers.</span>
                      </li>
                    </ul>
                  </div>

                  <div className="p-6 rounded-xl bg-[#0A0B0E] border border-[#2A2C30] space-y-3 text-xs shadow-inner">
                    <div className="flex items-center justify-between pb-2 border-b border-[#222428]">
                      <span className="text-[#22C55E] font-bold font-mono">STATUS: SYNCED</span>
                      <span className="text-[11px] text-[#787C83] font-mono">0ms latency</span>
                    </div>
                    <p className="text-[#8E939D] leading-relaxed">
                      Background worker dispatches incremental diffs over WebSocket hubs and in-process event buses without blocking typing input.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ─── Core Platform Features Grid ─────────────────────────────── */}
        <section id="features" className="py-24 px-6 border-t border-[#1C1E22] bg-[#0C0D10] reveal-on-scroll opacity-0 translate-y-8 transition-all duration-700">
          <div className="max-w-7xl mx-auto space-y-16">
            <div className="text-center space-y-3 max-w-3xl mx-auto">
              <h2 className="text-xs font-mono uppercase tracking-wider text-[#DCB001]">Professional Workflows</h2>
              <p className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Complete Project Management Built For Speed.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Feature 1 */}
              <div className="p-7 rounded-2xl bg-[#121417] border border-[#222428] hover:border-[#DCB001]/50 transition-all space-y-3 shadow-sm group hover:translate-y-[-2px]">
                <div className="w-10 h-10 rounded-xl bg-[#DCB001]/15 text-[#DCB001] flex items-center justify-center font-bold group-hover:scale-110 transition-transform">
                  <Zap size={20} />
                </div>
                <h3 className="text-lg font-bold text-white">0ms Optimistic UI & Local SWR</h3>
                <p className="text-xs text-[#8E939D] leading-relaxed">
                  Task creations, checklist ticking, column dragging, and document saves apply instantly on the client with zero latency while background workers sync with PostgreSQL.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="p-7 rounded-2xl bg-[#121417] border border-[#222428] hover:border-[#06B6D4]/50 transition-all space-y-3 shadow-sm group hover:translate-y-[-2px]">
                <div className="w-10 h-10 rounded-xl bg-[#06B6D4]/15 text-[#06B6D4] flex items-center justify-center font-bold group-hover:scale-110 transition-transform">
                  <GitFork size={20} />
                </div>
                <h3 className="text-lg font-bold text-white">Timeline Branch Explorer</h3>
                <p className="text-xs text-[#8E939D] leading-relaxed">
                  Interactive horizontal timeline graph with smooth cubic Bezier curved splines. Visualizes task branches, blocking dependencies, and merge convergences.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="p-7 rounded-2xl bg-[#121417] border border-[#222428] hover:border-[#A855F7]/50 transition-all space-y-3 shadow-sm group hover:translate-y-[-2px]">
                <div className="w-10 h-10 rounded-xl bg-[#A855F7]/15 text-[#A855F7] flex items-center justify-center font-bold group-hover:scale-110 transition-transform">
                  <Layers size={20} />
                </div>
                <h3 className="text-lg font-bold text-white">Hierarchical Subtasks & Trees</h3>
                <p className="text-xs text-[#8E939D] leading-relaxed">
                  Structure complex deliverables with infinitely nestable sub-work items, folder grouping, image drag-and-drop, and full keyboard navigation.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="p-7 rounded-2xl bg-[#121417] border border-[#222428] hover:border-[#22C55E]/50 transition-all space-y-3 shadow-sm group hover:translate-y-[-2px]">
                <div className="w-10 h-10 rounded-xl bg-[#22C55E]/15 text-[#22C55E] flex items-center justify-center font-bold group-hover:scale-110 transition-transform">
                  <FileText size={20} />
                </div>
                <h3 className="text-lg font-bold text-white">Live Markdown Specifications</h3>
                <p className="text-xs text-[#8E939D] leading-relaxed">
                  Write technical documentation in pure Markdown with real-time GitHub-flavored preview, instant Ctrl+S auto-saving, and multi-user live presence cursors.
                </p>
              </div>

              {/* Feature 5 */}
              <div className="p-7 rounded-2xl bg-[#121417] border border-[#222428] hover:border-[#F59E0B]/50 transition-all space-y-3 shadow-sm group hover:translate-y-[-2px]">
                <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/15 text-[#F59E0B] flex items-center justify-center font-bold group-hover:scale-110 transition-transform">
                  <Cpu size={20} />
                </div>
                <h3 className="text-lg font-bold text-white">Granular In-Place Diffing</h3>
                <p className="text-xs text-[#8E939D] leading-relaxed">
                  Surgical state reconciliation prevents full page reloads and re-renders. Only mutated DOM nodes update in memory.
                </p>
              </div>

              {/* Feature 6 */}
              <div className="p-7 rounded-2xl bg-[#121417] border border-[#222428] hover:border-[#EC4899]/50 transition-all space-y-3 shadow-sm group hover:translate-y-[-2px]">
                <div className="w-10 h-10 rounded-xl bg-[#EC4899]/15 text-[#EC4899] flex items-center justify-center font-bold group-hover:scale-110 transition-transform">
                  <Database size={20} />
                </div>
                <h3 className="text-lg font-bold text-white">Enterprise Relational Storage</h3>
                <p className="text-xs text-[#8E939D] leading-relaxed">
                  Hardened database layer with salted password hashing, JWT session cookies, WebSocket broadcasts, and rate-limiting security.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Branch Explorer Graph Showcase ──────────────────────────── */}
        <section id="branch-explorer" className="py-24 px-6 border-t border-[#1C1E22] bg-[#0A0B0D] reveal-on-scroll opacity-0 translate-y-8 transition-all duration-700">
          <div className="max-w-7xl mx-auto space-y-12">
            <div className="text-center space-y-3 max-w-3xl mx-auto">
              <h2 className="text-xs font-mono uppercase tracking-wider text-[#06B6D4]">Visual Dependency Graph</h2>
              <p className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Understand Complex Pipelines at a Glance.
              </p>
              <p className="text-xs sm:text-sm text-[#8E939D]">
                Interactive branch graphs reveal blocking dependencies, converging milestones, and developer workstreams.
              </p>
            </div>

            <div className="max-w-5xl mx-auto rounded-2xl bg-[#121417] border border-[#272A30] shadow-2xl p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#222428] text-xs font-mono">
                <div className="flex items-center gap-2">
                  <GitFork size={16} className="text-[#DCB001]" />
                  <span className="text-white font-bold">Branch Explorer Graph Stream</span>
                </div>
                <span className="text-[#22C55E]">Real-Time Active</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-[#0E0F12] border border-[#26282E] space-y-2">
                  <span className="text-xs font-bold text-[#DCB001]">Main Milestone</span>
                  <p className="text-[11px] text-[#8E939D]">Master deliverable track with automated progress rollup.</p>
                </div>
                <div className="p-4 rounded-xl bg-[#0E0F12] border border-[#26282E] space-y-2">
                  <span className="text-xs font-bold text-[#06B6D4]">Feature Branches</span>
                  <p className="text-[11px] text-[#8E939D]">Isolated parallel workflows with dedicated task checklists.</p>
                </div>
                <div className="p-4 rounded-xl bg-[#0E0F12] border border-[#26282E] space-y-2">
                  <span className="text-xs font-bold text-[#A855F7]">Dependency Blocker</span>
                  <p className="text-[11px] text-[#8E939D]">Visual blocker detection to prevent merge collisions.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Architecture Section ─────────────────────────────────────── */}
        <section id="architecture" className="py-24 px-6 border-t border-[#1C1E22] bg-[#0A0B0D] reveal-on-scroll opacity-0 translate-y-8 transition-all duration-700">
          <div className="max-w-7xl mx-auto space-y-12">
            <div className="text-center space-y-2 max-w-2xl mx-auto">
              <h2 className="text-xs font-mono uppercase tracking-wider text-[#06B6D4]">Architecture</h2>
              <p className="text-3xl font-extrabold text-white tracking-tight">
                Engineered For Scale, Resilient to Latency.
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
                <h3 className="text-sm font-bold text-white">Encrypted Workspace Dumps</h3>
                <p className="text-xs text-[#787C83]">Export whole workspaces as encrypted archives with complete SHA-256 integrity checksums.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Call To Action Section ───────────────────────────────────── */}
        <section className="py-24 px-6 border-t border-[#1C1E22] bg-[#08090B] text-center relative overflow-hidden reveal-on-scroll opacity-0 translate-y-8 transition-all duration-700">
          <div className="max-w-4xl mx-auto space-y-6 relative z-10">
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              Supercharge your organization&apos;s project velocity today.
            </h2>
            <p className="text-sm text-[#8E939D] max-w-xl mx-auto">
              Experience the speed of Teader with instant task management, collaborative documentation, and branch timeline graphs.
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
                <span>Download Desktop App</span>
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
            <Link href="/documentation" className="hover:text-[#CFD4DD] transition-colors">Documentation</Link>
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
