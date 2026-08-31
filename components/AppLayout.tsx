'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearAllLocalCaches } from '@/lib/client-cache';
import { 
  LayoutDashboard, 
  FolderKanban, 
  User, 
  Search, 
  Plus, 
  HelpCircle, 
  LogOut, 
  ShieldCheck, 
  Check, 
  X, 
  Sparkles,
  Command,
  ChevronDown,
  Loader2,
  MessageSquare,
  Settings
} from 'lucide-react';


import { CommandPalette } from '@/components/CommandPalette';
import { KeyboardShortcutsModal } from '@/components/KeyboardShortcutsModal';
import { SettingsModal } from '@/components/SettingsModal';
import { Issue, FileDiff } from '@/lib/types';
import { reconcileCreatedIssue } from '@/lib/reconcileIssue';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';

const NewIssueModal = dynamic(() => import('@/components/NewIssueModal').then(m => ({ default: m.NewIssueModal })), { ssr: false });
const DiffViewerModal = dynamic(() => import('@/components/DiffViewerModal').then(m => ({ default: m.DiffViewerModal })), { ssr: false });

interface AppLayoutProps {
  children: React.ReactNode;
}

const SAMPLE_DIFFS: FileDiff[] = [
  {
    path: 'src/api/workspace.ts',
    status: 'modified',
    additions: 1,
    deletions: 1,
    hunks: [
      {
        header: '@@ -12,4 +12,4 @@',
        lines: [
          { type: 'context', content: '  async function loadWorkspace(id: string) {' },
          { type: 'delete', content: "    const data = await fetch('/api/workspace/' + id);" },
          { type: 'add', content: "    const data = await fetch('/api/workspace/' + id, { cache: 'no-store' });" },
          { type: 'context', content: '    return data.json();' },
        ],
      },
    ],
  },
];

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isNewIssueModalOpen, setIsNewIssueModalOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Verify authentication before rendering workspace
  useEffect(() => {
    try {
      const cached = localStorage.getItem('teader_user');
      if (cached) setCurrentUser(JSON.parse(cached));
    } catch {}

    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setCurrentUser(data.user);
          try {
            localStorage.setItem('teader_user', JSON.stringify(data.user));
          } catch {}
          setIsCheckingAuth(false);
        } else if (pathname !== '/login' && pathname !== '/register') {
          try {
            localStorage.removeItem('teader_user');
            localStorage.removeItem('teader_token');
          } catch {}
          router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
        }
      })
      .catch(() => {
        if (pathname !== '/login' && pathname !== '/register') {
          try {
            localStorage.removeItem('teader_user');
            localStorage.removeItem('teader_token');
          } catch {}
          router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
        }
      })
      .finally(() => {
        setIsCheckingAuth(false);
      });
  }, [pathname, router]);


  // Fetch data for command palette
  useEffect(() => {
    Promise.all([
      fetch('/api/issues').then(r => r.ok ? r.json() : []).catch(() => []),
      fetch('/api/projects').then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([issueData, projectData]) => {
      if (Array.isArray(issueData)) setIssues(issueData);
      if (Array.isArray(projectData)) setProjects(projectData);
    });
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isEditable = tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target as HTMLElement)?.isContentEditable;
      if (isEditable) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      } else if (e.key.toLowerCase() === 'c' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setIsNewIssueModalOpen(true);
      } else if (e.key === '?') {
        e.preventDefault();
        setIsShortcutsModalOpen(true);
      } else if (e.key === 'Escape') {
        setIsCommandPaletteOpen(false);
        setIsShortcutsModalOpen(false);
        setIsAccountModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCreateIssue = (newIssue: Issue) => {
    setIssues(prev => reconcileCreatedIssue(prev, newIssue));
    toast.success(`Created ${newIssue.key}`);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      try {
        clearAllLocalCaches();
        localStorage.removeItem('teader_user');
        localStorage.removeItem('teader_token');
      } catch {}
      toast.success('Logged out successfully');
      setIsAccountModalOpen(false);
      router.push('/login');
    } catch {
      toast.error('Logout failed');
    }
  };

  const isDashboardActive = pathname === '/dashboard' || pathname === '/';
  const isProjectsActive = pathname.startsWith('/projects');
  const isConversationActive = pathname.startsWith('/conversations') || pathname.startsWith('/conversation');

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-[#0F1011] text-[#CFD4DD] font-sans antialiased select-none">
      {/* ─── Top Navbar Header (Replacing Sidebar with Top Tabs) ─────── */}
      <header className="h-12 px-4 bg-[#111215] border-b border-[#24262B] flex items-center justify-between shrink-0 z-40">
        {/* Top Left: Navigation Tabs (Dashboard, Projects, Conversation, Account) */}
        <div className="flex items-center gap-3">
          {/* Top Tabs: Dashboard, Projects, Account */}
          <nav className="flex items-center gap-1 bg-[#0B0C0E] p-0.5 rounded-lg border border-[#222428]">
            {/* Tab: Dashboard */}
            <Link
              href="/dashboard"
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                isDashboardActive
                  ? 'bg-[#222428] text-white font-semibold shadow-sm border border-[#2E3138]'
                  : 'text-[#8E939D] hover:text-white hover:bg-[#16171A]'
              }`}
            >
              <LayoutDashboard size={13} className={isDashboardActive ? 'text-[#DCB001]' : 'text-[#787C83]'} />
              <span>Dashboard</span>
            </Link>

            {/* Tab: Projects */}
            <Link
              href="/projects"
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                isProjectsActive
                  ? 'bg-[#222428] text-white font-semibold shadow-sm border border-[#2E3138]'
                  : 'text-[#8E939D] hover:text-white hover:bg-[#16171A]'
              }`}
            >
              <FolderKanban size={13} className={isProjectsActive ? 'text-[#DCB001]' : 'text-[#787C83]'} />
              <span>Projects</span>
            </Link>

            {/* Tab: Account */}
            <button
              onClick={() => setIsAccountModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                isAccountModalOpen
                  ? 'bg-[#222428] text-white font-semibold shadow-sm border border-[#2E3138]'
                  : 'text-[#8E939D] hover:text-white hover:bg-[#16171A]'
              }`}
            >
              <User size={13} className="text-[#06B6D4]" />
              <span>Account</span>
            </button>

            {/* Tab: Settings */}
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                isSettingsModalOpen
                  ? 'bg-[#222428] text-white font-semibold shadow-sm border border-[#2E3138]'
                  : 'text-[#8E939D] hover:text-white hover:bg-[#16171A]'
              }`}
            >
              <Settings size={13} className={isSettingsModalOpen ? 'text-[#DCB001]' : 'text-[#787C83]'} />
              <span>Settings</span>
            </button>
          </nav>

        </div>


        {/* Top Right: Global Controls */}
        <div className="flex items-center gap-2">
          {/* Command Palette Button */}
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            className="hidden sm:flex items-center gap-2 px-2.5 py-1 bg-[#16171A] hover:bg-[#202226] border border-[#2A2C30] text-[#787C83] hover:text-[#CFD4DD] rounded-lg text-xs transition-all"
            title="Search workspace (Ctrl + K)"
          >
            <Search size={12} />
            <span className="text-[11px] font-mono">Quick Search...</span>
            <kbd className="px-1.5 py-0.2 text-[9px] font-mono bg-[#0B0C0E] border border-[#2A2C30] rounded text-[#8E939D]">
              ⌘K
            </kbd>
          </button>

          {/* Keyboard Shortcuts */}
          <button
            onClick={() => setIsShortcutsModalOpen(true)}
            className="p-1.5 text-[#787C83] hover:text-white rounded-lg hover:bg-[#1C1D21] transition-colors"
            title="Keyboard Shortcuts (?)"
          >
            <HelpCircle size={15} />
          </button>

          {/* User Profile Avatar / Logout Trigger */}
          <button
            onClick={() => setIsAccountModalOpen(true)}
            className="flex items-center gap-1.5 p-1 rounded-lg hover:bg-[#1C1D21] transition-colors"
            title="View Account"
          >
            <div className="w-6 h-6 rounded-full bg-[#DCB001]/20 border border-[#DCB001]/40 flex items-center justify-center text-[#DCB001] font-mono font-bold text-[11px]">
              {(currentUser?.name || 'U').charAt(0).toUpperCase()}
            </div>
          </button>
        </div>
      </header>

      {/* ─── Main Content Canvas Area (Only shown if logged in) ──────── */}
      {isCheckingAuth && !currentUser ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-[#0A0B0D] space-y-4 select-none">
          <div className="text-center space-y-2">
            <h1 className="text-7xl sm:text-8xl md:text-9xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#DCB001] via-[#FDE047] to-[#F59E0B] font-prompt tracking-tight drop-shadow-[0_0_35px_rgba(220,176,1,0.35)]">
              teader
            </h1>
            <p className="text-sm sm:text-base font-semibold text-[#8E939D] tracking-[0.4em] uppercase font-prompt">
              workspace
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-[#787C83] pt-2">
            <Loader2 size={14} className="animate-spin text-[#DCB001]" />
            <span>Verifying workspace session...</span>
          </div>
        </div>

      ) : !currentUser ? null : (
        <main className="flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-hidden">
          {children}
        </main>
      )}


      {/* ─── Account Settings Modal (Top Tab 'Account') ─────────────── */}
      <AnimatePresence>
        {isAccountModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-[#16181B] border border-[#2A2C30] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#2A2C30] bg-[#111215]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#06B6D4]/15 text-[#06B6D4] flex items-center justify-center font-bold">
                    <User size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-tight">Account & Profile</h3>
                    <p className="text-[11px] font-mono text-[#787C83]">Active Session Credentials</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAccountModalOpen(false)}
                  className="text-[#787C83] hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Profile Body */}
              <div className="p-6 space-y-4">
                {/* User Info Card */}
                <div className="p-4 rounded-xl bg-[#101114] border border-[#24262B] flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#DCB001] text-[#0A0B0D] font-bold text-lg flex items-center justify-center font-mono shadow-md">
                    {(currentUser?.name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white truncate">{currentUser?.name || 'Developer User'}</p>
                    <p className="text-xs font-mono text-[#787C83] truncate">{currentUser?.email || 'test@teader.io'}</p>
                    <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.2 rounded bg-[#22C55E]/15 text-[#22C55E] text-[10px] font-mono font-medium border border-[#22C55E]/30">
                      <ShieldCheck size={10} /> Authenticated
                    </div>
                  </div>
                </div>

                {/* Workspace Role & Status */}
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#111215] border border-[#222428]">
                    <span className="text-[#787C83]">Workspace Role</span>
                    <span className="text-[#DCB001] font-bold capitalize">{currentUser?.role || 'Project Lead'}</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#111215] border border-[#222428]">
                    <span className="text-[#787C83]">Database Connection</span>
                    <span className="text-[#22C55E] font-medium">PostgreSQL localhost:5678 (teader_db)</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#111215] border border-[#222428]">
                    <span className="text-[#787C83]">Client Caching</span>
                    <span className="text-[#06B6D4] font-medium">0ms Optimistic SWR Active</span>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-[#2A2C30] bg-[#111215] flex items-center justify-between">
                <button
                  onClick={() => setIsAccountModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-[#9BA1A6] hover:text-white rounded-xl transition-colors"
                >
                  Close
                </button>

                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#EF4444]/15 hover:bg-[#EF4444]/25 text-[#EF4444] border border-[#EF4444]/30 text-xs font-bold transition-all shadow-sm"
                >
                  <LogOut size={13} />
                  <span>Sign Out</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Command Palette Modal */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        issues={issues}
        projects={projects}
        onSelectIssue={(issueId) => {
          setIsCommandPaletteOpen(false);
          if (issueId) router.push(`/task/${issueId}/details`);
        }}
        onOpenNewIssue={() => { setIsCommandPaletteOpen(false); setIsNewIssueModalOpen(true); }}
        onSelectView={() => setIsCommandPaletteOpen(false)}
      />

      {/* New Issue Modal */}
      {isNewIssueModalOpen && (
        <Suspense fallback={null}>
          <NewIssueModal
            isOpen={isNewIssueModalOpen}
            onClose={() => setIsNewIssueModalOpen(false)}
            onCreateIssue={handleCreateIssue}
          />
        </Suspense>
      )}

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />

      {/* Git Diff Preview Modal */}
      {isDiffModalOpen && (
        <Suspense fallback={null}>
          <DiffViewerModal
            isOpen={isDiffModalOpen}
            onClose={() => setIsDiffModalOpen(false)}
            diffs={SAMPLE_DIFFS}
            title="Diff Preview"
            onApply={() => { toast.success('Changes applied!'); setIsDiffModalOpen(false); }}
          />
        </Suspense>
      )}

      {/* Workspace Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        currentUser={currentUser}
        onLogout={handleLogout}
      />
    </div>
  );
};
