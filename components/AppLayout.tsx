"use client";

import React, { useState, useEffect, Suspense, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearAllLocalCaches } from "@/lib/client-cache";
import {
  Search,
  Plus,
  HelpCircle,
  LogOut,
  ShieldCheck,
  X,
  Sparkles,
  Loader2,
  Radio,
  Mic,
  MicOff,
  PhoneOff,
  Maximize2,
  User,
} from "lucide-react";

import { Sidebar } from "@/components/Sidebar";
import { TopFrame } from "@/components/TopFrame";
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isNewIssueModalOpen, setIsNewIssueModalOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("teader_sidebar_collapsed");
      if (saved === "true") setIsSidebarCollapsed(true);
    } catch {}
  }, []);

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("teader_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  // Listen for user updates across components
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
    window.dispatchEvent(
      new CustomEvent("teader_switch_project_tab", { detail: "meeting" }),
    );
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

    const signal =
      typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
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

  // Fetch data for command palette and navigation
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

  const breadcrumbs = useMemo(() => {
    if (pathname === "/dashboard" || pathname === "/") return ["Teader", "Dashboard"];
    if (pathname === "/projects") return ["Teader", "Projects"];
    if (pathname.startsWith("/projects/")) {
      const parts = pathname.split("/");
      const pId = parts[2];
      const found = projects.find((p) => String(p.id) === String(pId));
      const pName = found?.name || "Project";
      return ["Teader", "Projects", pName];
    }
    if (pathname === "/my-work") return ["Teader", "Commitments"];
    return ["Teader"];
  }, [pathname, projects]);

  const isFullMeetingView = Boolean(
    activeMeeting &&
    pathname.startsWith(`/projects/${activeMeeting.projectId}`) &&
    !activeMeeting.isMini,
  );

  return (
    <div className="fixed inset-0 flex flex-col h-full h-[100dvh] max-h-[100dvh] w-full overflow-hidden overscroll-none bg-[black] text-[var(--text-primary)] font-sans antialiased select-none p-[10px] box-border">
      {/* ─── Top Frameless Window Header ────────────────────────────── */}
      <TopFrame className="shrink-0" />

      {/* ─── Main Content View (Including Sidebar) ───────────────────── */}
      <div className="mt-[10px] flex-1 flex flex-row min-w-0 min-h-0 h-full overflow-hidden bg-[var(--bg-surface)] rounded-[5px] border border-[var(--border-containers)] box-border">
        {/* ─── Left Sidebar Shell ──────────────────────────────────────── */}
        {currentUser && (
          <Sidebar
            collapsed={isSidebarCollapsed}
            onToggleCollapse={handleToggleSidebar}
            onOpenNewIssue={() => setIsNewIssueModalOpen(true)}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            onOpenShortcuts={() => setIsShortcutsModalOpen(true)}
            onOpenSettings={() => setIsSettingsModalOpen(true)}
          />
        )}

        {/* ─── Main Right Canvas + Header Area ─────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-hidden">
          {/* Minimal Linear-Style Top Header Bar */}
          {currentUser && (
            <header className="h-11 px-4 bg-[var(--bg-canvas)] border-b border-[var(--border-primary)] flex items-center justify-between shrink-0 z-30">
              {/* Breadcrumb Path */}
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] font-medium truncate">
                {breadcrumbs.map((crumb, idx) => (
                  <React.Fragment key={idx}>
                    {idx > 0 && <span className="text-[var(--border-secondary)]">/</span>}
                    <span
                      className={
                        idx === breadcrumbs.length - 1
                          ? "text-white font-medium truncate"
                          : "text-[var(--text-secondary)] hover:text-white transition-colors truncate"
                      }
                    >
                      {crumb}
                    </span>
                  </React.Fragment>
                ))}
              </div>

              {/* Active Meeting Widget in App Header */}
              {activeMeeting && !isFullMeetingView && (
                <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-[var(--bg-panel)] border border-[var(--border-primary)] select-none">
                  <div
                    onClick={handleOpenMeeting}
                    className="flex items-center gap-2 cursor-pointer group"
                    title="Click to open full meeting"
                  >
                    <div className="relative flex items-center justify-center">
                      <Radio size={13} className="text-white animate-pulse" />
                    </div>
                    <span className="text-xs font-semibold text-white truncate max-w-[120px]">
                      {activeMeeting.projectName}
                    </span>
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">
                      {activeMeeting.duration || "00:00"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 border-l border-[var(--border-primary)] pl-2 ml-1">
                    <button
                      type="button"
                      onClick={handleToggleMeetingMute}
                      className="p-1 rounded text-white hover:bg-[var(--bg-hover)] transition-colors"
                      title={activeMeeting.isMuted ? "Unmute" : "Mute"}
                    >
                      {activeMeeting.isMuted ? <MicOff size={13} /> : <Mic size={13} />}
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenMeeting}
                      className="p-1 rounded text-white hover:bg-[var(--bg-hover)] transition-colors"
                      title="Open Meeting"
                    >
                      <Maximize2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={handleLeaveMeeting}
                      className="p-1 rounded text-white hover:bg-[var(--bg-hover)] transition-colors"
                      title="Leave Meeting"
                    >
                      <PhoneOff size={13} />
                    </button>
                  </div>
                </div>
              )}

              {/* Top Right: Search Pill & Avatar */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsCommandPaletteOpen(true)}
                  className="flex items-center gap-2 px-2.5 py-1 bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] border border-[var(--border-primary)] text-[var(--text-muted)] hover:text-white rounded text-xs transition-colors"
                  title="Quick Search (⌘K)"
                >
                  <Search size={13} />
                  <span className="text-[11px] hidden sm:inline">Search...</span>
                  <kbd className="px-1.5 py-0.2 text-[10px] font-mono bg-white/5 border border-[var(--border-primary)] rounded text-[var(--text-secondary)]">
                    ⌘K
                  </kbd>
                </button>
              </div>
            </header>
          )}

          {/* ─── Main Content Canvas Area ──────────────────────────────── */}
          {isCheckingAuth && !currentUser ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
            </div>
          ) : !currentUser ? null : (
            <main className="flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-hidden overscroll-none p-0 bg-[var(--bg-canvas)]">
              <div className="flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-hidden bg-[var(--bg-panel)] border border-[var(--border-primary)] rounded-lg shadow-sm">
                {children}
              </div>
            </main>
          )}
        </div>
      </div>

      {/* ─── Account Modal ──────────────────────────────────────────── */}
      <AnimatePresence>
        {isAccountModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-sm bg-[var(--bg-panel)] border border-[var(--border-primary)] rounded-xl shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-primary)] bg-[var(--bg-canvas)]">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-[var(--ramp-2)] text-white flex items-center justify-center border border-[var(--border-secondary)]">
                    <User size={13} />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-white">Account Details</h3>
                    <p className="text-[10px] font-mono text-[var(--text-muted)]">Active session</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAccountModalOpen(false)}
                  className="text-[var(--text-muted)] hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Profile Body */}
              <div className="p-5 space-y-4 text-xs">
                {/* User Info Card */}
                <div className="p-3.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-primary)] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="relative group cursor-pointer"
                      onClick={() => setIsAvatarPickerOpen(true)}
                      title="Click to choose avatar portrait"
                    >
                      <Avatar user={currentUser} size="lg" />
                      <div className="absolute inset-0 rounded-full bg-black/70 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[9px] font-medium">
                        Edit
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-white truncate">
                        {currentUser?.name || "Developer User"}
                      </p>
                      <p className="text-[11px] font-mono text-[var(--text-muted)] truncate mt-0.5">
                        {currentUser?.email || "test@teader.io"}
                      </p>
                      <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.2 rounded bg-[var(--ramp-2)] text-[var(--text-secondary)] text-[10px] font-mono border border-[var(--border-primary)]">
                        <ShieldCheck size={10} /> Active
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAvatarPickerOpen(true)}
                    className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded bg-[var(--ramp-2)] hover:bg-[var(--ramp-3)] text-white border border-[var(--border-secondary)] text-[11px] font-medium transition-colors"
                  >
                    <Sparkles size={11} />
                    <span>Avatar</span>
                  </button>
                </div>

                {/* Workspace Role & Status */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between p-2 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)]">
                    <span className="text-[var(--text-muted)]">Workspace Role</span>
                    <span className="text-white font-medium capitalize">
                      {currentUser?.role || "Project Lead"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)]">
                    <span className="text-[var(--text-muted)]">Storage Engine</span>
                    <span className="text-white font-mono">PostgreSQL</span>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-3 border-t border-[var(--border-primary)] bg-[var(--bg-canvas)] flex items-center justify-between">
                <button
                  onClick={() => setIsAccountModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-white rounded transition-colors"
                >
                  Close
                </button>

                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[var(--ramp-2)] hover:bg-[var(--ramp-3)] text-white border border-[var(--border-secondary)] text-xs font-medium transition-colors"
                >
                  <LogOut size={12} />
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
            projects={projects}
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
