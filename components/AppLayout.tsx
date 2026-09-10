"use client";

import React, { useState, useEffect, Suspense, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearAllLocalCaches } from "@/lib/client-cache";
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
  Settings,
  Radio,
  Mic,
  MicOff,
  PhoneOff,
  Maximize2,
} from "lucide-react";

import { CommandPalette } from "@/components/CommandPalette";
import { KeyboardShortcutsModal } from "@/components/KeyboardShortcutsModal";
import { SettingsModal } from "@/components/SettingsModal";
import { ProfileAvatarPickerModal } from "@/components/ProfileAvatarPickerModal";
import { Issue, FileDiff } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { reconcileCreatedIssue } from "@/lib/reconcileIssue";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";

const NewIssueModal = dynamic(
  () =>
    import("@/components/NewIssueModal").then((m) => ({
      default: m.NewIssueModal,
    })),
  { ssr: false },
);
const DiffViewerModal = dynamic(
  () =>
    import("@/components/DiffViewerModal").then((m) => ({
      default: m.DiffViewerModal,
    })),
  { ssr: false },
);

interface AppLayoutProps {
  children: React.ReactNode;
}

const SAMPLE_DIFFS: FileDiff[] = [
  {
    path: "src/api/workspace.ts",
    status: "modified",
    additions: 1,
    deletions: 1,
    hunks: [
      {
        header: "@@ -12,4 +12,4 @@",
        lines: [
          {
            type: "context",
            content: "  async function loadWorkspace(id: string) {",
          },
          {
            type: "delete",
            content: "    const data = await fetch('/api/workspace/' + id);",
          },
          {
            type: "add",
            content:
              "    const data = await fetch('/api/workspace/' + id, { cache: 'no-store' });",
          },
          { type: "context", content: "    return data.json();" },
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
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);

  // Listen for user updates (such as avatar change) across components
  useEffect(() => {
    const handleUserUpdate = (e: any) => {
      if (e.detail) {
        setCurrentUser(e.detail);
      }
    };
    window.addEventListener("teader_user_updated", handleUserUpdate);
    return () =>
      window.removeEventListener("teader_user_updated", handleUserUpdate);
  }, []);

  const [activeMeeting, setActiveMeeting] = useState<{
    isActive: boolean;
    projectId: number | string;
    projectName: string;
    isMuted: boolean;
    duration: string;
    isMini: boolean;
    speakerName?: string;
    isSpeaking?: boolean;
  } | null>(null);

  // Listen for active meeting updates across pages and tabs
  useEffect(() => {
    const handleActiveMeetingUpdate = (e: any) => {
      setActiveMeeting(e.detail || null);
    };
    window.addEventListener(
      "teader_active_meeting_update",
      handleActiveMeetingUpdate,
    );
    return () =>
      window.removeEventListener(
        "teader_active_meeting_update",
        handleActiveMeetingUpdate,
      );
  }, []);

  const handleOpenMeeting = () => {
    if (!activeMeeting) return;
    // Dispatch tab switch event if already on the project page
    window.dispatchEvent(
      new CustomEvent("teader_switch_project_tab", { detail: "meeting" }),
    );
    // Navigate if on another page
    if (!pathname.startsWith(`/projects/${activeMeeting.projectId}`)) {
      router.push(`/projects/${activeMeeting.projectId}?tab=meeting`);
    }
  };

  const handleLeaveMeeting = () => {
    window.dispatchEvent(
      new CustomEvent("teader_meeting_action", { detail: "leave" }),
    );
    setActiveMeeting(null);
  };

  const handleToggleMeetingMute = () => {
    window.dispatchEvent(
      new CustomEvent("teader_meeting_action", { detail: "toggle_mute" }),
    );
    setActiveMeeting((prev) =>
      prev ? { ...prev, isMuted: !prev.isMuted } : null,
    );
  };

  // Verify authentication before rendering workspace
  useEffect(() => {
    try {
      const cached = localStorage.getItem("teader_user");
      if (cached) setCurrentUser(JSON.parse(cached));
    } catch {}

    const authTimeout = setTimeout(() => {
      setIsCheckingAuth(false);
    }, 4500);

    const signal = typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
      ? AbortSignal.timeout(5000)
      : undefined;

    fetch("/api/auth/me", { signal })
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setCurrentUser(data.user);
          try {
            localStorage.setItem("teader_user", JSON.stringify(data.user));
          } catch {}
          setIsCheckingAuth(false);
        } else if (pathname !== "/login" && pathname !== "/register") {
          try {
            localStorage.removeItem("teader_user");
            localStorage.removeItem("teader_token");
          } catch {}
          router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
        }
      })
      .catch(() => {
        if (pathname !== "/login" && pathname !== "/register") {
          try {
            localStorage.removeItem("teader_user");
            localStorage.removeItem("teader_token");
          } catch {}
          router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
        }
      })
      .finally(() => {
        clearTimeout(authTimeout);
        setIsCheckingAuth(false);
      });

    return () => clearTimeout(authTimeout);
  }, [pathname, router]);

  // Fetch data for command palette
  useEffect(() => {
    Promise.all([
      fetch("/api/issues")
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
      fetch("/api/projects")
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
    ]).then(([issueData, projectData]) => {
      if (Array.isArray(issueData)) setIssues(issueData);
      if (Array.isArray(projectData)) setProjects(projectData);
    });
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isEditable =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        (e.target as HTMLElement)?.isContentEditable;
      if (isEditable) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      } else if (
        e.key.toLowerCase() === "c" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        e.preventDefault();
        setIsNewIssueModalOpen(true);
      } else if (e.key === "?") {
        e.preventDefault();
        setIsShortcutsModalOpen(true);
      } else if (e.key === "Escape") {
        setIsCommandPaletteOpen(false);
        setIsShortcutsModalOpen(false);
        setIsAccountModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleCreateIssue = (newIssue: Issue) => {
    setIssues((prev) => reconcileCreatedIssue(prev, newIssue));
    toast.success(`Created ${newIssue.key}`);
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      try {
        clearAllLocalCaches();
        localStorage.removeItem("teader_user");
        localStorage.removeItem("teader_token");
      } catch {}
      toast.success("Logged out successfully");
      setIsAccountModalOpen(false);
      router.push("/login");
    } catch {
      toast.error("Logout failed");
    }
  };

  const isDashboardActive = pathname === "/dashboard" || pathname === "/";
  const isProjectsActive = pathname.startsWith("/projects");
  const isConversationActive =
    pathname.startsWith("/conversations") ||
    pathname.startsWith("/conversation");
  const isFullMeetingView = Boolean(
    activeMeeting &&
    pathname.startsWith(`/projects/${activeMeeting.projectId}`) &&
    !activeMeeting.isMini,
  );

  return (
    <div className="fixed inset-0 flex flex-col h-full h-[100dvh] max-h-[100dvh] w-full overflow-hidden overscroll-none bg-[var(--bg-canvas)] text-[var(--text-primary)] font-sans antialiased select-none">
      {/* ─── Top Navbar Header (Replacing Sidebar with Top Tabs) ─────── */}
      <header className="h-14 px-4 bg-[var(--bg-header)] border-b border-[var(--border-primary)] flex items-center justify-between shrink-0 z-40">
        {/* Top Left: Navigation Tabs (Dashboard, Projects, Conversation, Account) */}
        <div className="flex items-center gap-3">
          {/* Top Tabs: Dashboard, Projects, Account */}
          <nav className="flex items-center gap-1 bg-[var(--bg-canvas)] p-0.5 rounded-lg border border-[var(--border-subtle)]">
            {/* Tab: Dashboard */}
            <Link
              href="/dashboard"
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                isDashboardActive
                  ? "bg-[var(--bg-hover)] text-white font-semibold shadow-sm border border-[var(--border-secondary)]"
                  : "text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-panel)]"
              }`}
            >
              <LayoutDashboard
                size={16}
                className={
                  isDashboardActive
                    ? "text-[var(--accent-yellow)]"
                    : "text-[var(--text-muted)]"
                }
              />
              <span>Dashboard</span>
            </Link>

            {/* Tab: Projects */}
            <Link
              href="/projects"
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                isProjectsActive
                  ? "bg-[var(--bg-hover)] text-white font-semibold shadow-sm border border-[var(--border-secondary)]"
                  : "text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-panel)]"
              }`}
            >
              <FolderKanban
                size={16}
                className={
                  isProjectsActive
                    ? "text-[var(--accent-yellow)]"
                    : "text-[var(--text-muted)]"
                }
              />
              <span>Projects</span>
            </Link>

            {/* Tab: Account */}
            <button
              onClick={() => setIsAccountModalOpen(true)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                isAccountModalOpen
                  ? "bg-[var(--bg-hover)] text-white font-semibold shadow-sm border border-[var(--border-secondary)]"
                  : "text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-panel)]"
              }`}
            >
              <User size={16} className="text-[var(--cyan)]" />
              <span>Account</span>
            </button>

            {/* Tab: Settings */}
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                isSettingsModalOpen
                  ? "bg-[var(--bg-hover)] text-white font-semibold shadow-sm border border-[var(--border-secondary)]"
                  : "text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-panel)]"
              }`}
            >
              <Settings
                size={16}
                className={
                  isSettingsModalOpen
                    ? "text-[var(--accent-yellow)]"
                    : "text-[var(--text-muted)]"
                }
              />
              <span>Settings</span>
            </button>
          </nav>
        </div>

        {/* Active Meeting Widget in App Header (For other pages/tabs) */}
        {activeMeeting && !isFullMeetingView && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-[#14161F] border border-[#2B2D38] shadow-sm select-none">
            <div
              onClick={handleOpenMeeting}
              className="flex items-center gap-2 cursor-pointer group"
              title="Click to open full meeting"
            >
              <div className="relative flex items-center justify-center">
                <div className="w-6 h-6 rounded-full bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30 flex items-center justify-center">
                  <Radio size={14} className="text-[#22C55E] animate-pulse" />
                </div>
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#22C55E] animate-ping" />
              </div>

              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-white group-hover:text-[var(--accent-yellow)] transition-colors truncate max-w-[110px] sm:max-w-[150px]">
                    {activeMeeting.projectName}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-[#22C55E]/15 text-[#22C55E] font-mono text-xs font-bold border border-[#22C55E]/30 shrink-0">
                    LIVE
                  </span>
                </div>
                <span className="text-xs font-mono text-[#9CA3AF] leading-none">
                  {activeMeeting.duration || "00:00"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 border-l border-[#242634] pl-2 ml-1">
              {/* Mic Toggle */}
              <button
                type="button"
                onClick={handleToggleMeetingMute}
                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                  activeMeeting.isMuted
                    ? "bg-red-500/15 text-red-400 border-red-500/35 hover:bg-red-500/25"
                    : "bg-[#181A22] text-[#22C55E] border-[#2B2D38] hover:bg-[#222430]"
                }`}
                title={
                  activeMeeting.isMuted
                    ? "Unmute Microphone"
                    : "Mute Microphone"
                }
              >
                {activeMeeting.isMuted ? (
                  <MicOff size={14} />
                ) : (
                  <Mic size={14} />
                )}
              </button>

              {/* Open Meeting Button */}
              <button
                type="button"
                onClick={handleOpenMeeting}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#DCB001]/15 hover:bg-[#DCB001]/25 text-[#DCB001] border border-[#DCB001]/35 text-xs font-semibold transition-all cursor-pointer"
                title="Open Meeting"
              >
                <Maximize2 size={14} />
                <span>Open Meeting</span>
              </button>

              {/* Leave Call Button */}
              <button
                type="button"
                onClick={handleLeaveMeeting}
                className="p-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 hover:text-red-300 border border-red-500/35 transition-colors cursor-pointer"
                title="Leave Meeting"
              >
                <PhoneOff size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Top Right: Global Controls */}
        <div className="flex items-center gap-2">
          {/* Command Palette Button */}
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            className="hidden sm:flex items-center gap-2 px-4 py-2 bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] border border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg text-sm transition-all"
            title="Search workspace (Ctrl + K)"
          >
            <Search size={16} />
            <span className="text-xs font-mono">Quick Search...</span>
            <kbd className="px-1.5 py-0.5 text-xs font-mono bg-[var(--bg-canvas)] border border-[var(--border-primary)] rounded text-[var(--text-secondary)]">
              ⌘K
            </kbd>
          </button>

          {/* Keyboard Shortcuts */}
          <button
            onClick={() => setIsShortcutsModalOpen(true)}
            className="p-2 text-[var(--text-muted)] hover:text-white rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
            title="Keyboard Shortcuts (?)"
          >
            <HelpCircle size={18} />
          </button>

          {/* User Profile Avatar / Logout Trigger */}
          <button
            onClick={() => setIsAccountModalOpen(true)}
            className="flex items-center gap-1.5 p-1 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
            title="View Account"
          >
            <Avatar user={currentUser} size="sm" />
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
        <main className="flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-hidden overscroll-none">
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
                    <h3 className="text-sm font-bold text-white tracking-tight">
                      Account & Profile
                    </h3>
                    <p className="text-[11px] font-mono text-[#787C83]">
                      Active Session Credentials
                    </p>
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
                <div className="p-4 rounded-xl bg-[#101114] border border-[#24262B] flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className="relative group cursor-pointer"
                      onClick={() => setIsAvatarPickerOpen(true)}
                      title="Click to choose avatar portrait"
                    >
                      <Avatar user={currentUser} size="xl" />
                      <div className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-bold">
                        Change
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white truncate">
                        {currentUser?.name || "Developer User"}
                      </p>
                      <p className="text-xs font-mono text-[var(--text-muted)] truncate">
                        {currentUser?.email || "test@teader.io"}
                      </p>
                      <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.2 rounded bg-[var(--success-bg)] text-[var(--success)] text-[10px] font-mono font-medium border border-[var(--success-border)]">
                        <ShieldCheck size={10} /> Authenticated
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAvatarPickerOpen(true)}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--purple)]/15 hover:bg-[var(--purple)]/25 text-[var(--purple)] border border-[var(--purple)]/30 text-xs font-medium transition-colors"
                  >
                    <Sparkles size={13} />
                    <span>Change Avatar</span>
                  </button>
                </div>

                {/* Workspace Role & Status */}
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--bg-panel)] border border-[var(--border-primary)]">
                    <span className="text-[var(--text-muted)]">
                      Workspace Role
                    </span>
                    <span className="text-[var(--accent-yellow)] font-bold capitalize">
                      {currentUser?.role || "Project Lead"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--bg-panel)] border border-[var(--border-primary)]">
                    <span className="text-[var(--text-muted)]">
                      Database Connection
                    </span>
                    <span className="text-[var(--success)] font-medium">
                      PostgreSQL localhost:5678 (teader_db)
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--bg-panel)] border border-[var(--border-primary)]">
                    <span className="text-[var(--text-muted)]">
                      Client Caching
                    </span>
                    <span className="text-[var(--cyan)] font-medium">
                      0ms Optimistic SWR Active
                    </span>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-[var(--border-primary)] bg-[var(--bg-panel)] flex items-center justify-between">
                <button
                  onClick={() => setIsAccountModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-white rounded-xl transition-colors"
                >
                  Close
                </button>

                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--danger-bg)] hover:bg-[var(--danger)]/25 text-[var(--danger)] border border-[var(--danger-border)] text-xs font-bold transition-all shadow-sm"
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
        onOpenNewIssue={() => {
          setIsCommandPaletteOpen(false);
          setIsNewIssueModalOpen(true);
        }}
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
            onApply={() => {
              toast.success("Changes applied!");
              setIsDiffModalOpen(false);
            }}
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

      {/* Profile Avatar Selection Modal */}
      <ProfileAvatarPickerModal
        isOpen={isAvatarPickerOpen}
        onClose={() => setIsAvatarPickerOpen(false)}
        currentAvatar={currentUser?.avatar}
        onAvatarUpdated={(newAvatar, updatedUser) => {
          setCurrentUser(updatedUser);
        }}
      />
    </div>
  );
};
