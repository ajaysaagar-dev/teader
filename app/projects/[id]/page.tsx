'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { AppLayout } from '@/components/AppLayout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { WorkspaceSplashScreen } from '@/components/WorkspaceSplashScreen';
import { ProjectPageHeaderSkeleton, KanbanBoardSkeleton, ViewLoadingFallback } from '@/components/ui/Skeleton';
import { RandomLoadingText } from '@/components/ui/RandomLoadingText';
import { Issue, Status, Priority, MemberPermissions } from '@/lib/types';
import { getLocalCache, setLocalCache, reconcileIssues } from '@/lib/client-cache';
import { reconcileCreatedIssue } from '@/lib/reconcileIssue';
import { useRealtimeSubscription, RealtimeEvent } from '@/lib/useRealtime';
import { RealtimeBadge } from '@/components/RealtimeBadge';



import { Avatar } from '@/components/ui/Avatar';
import { 
  FolderKanban, 
  Key, 
  Copy, 
  Check, 
  X, 
  ArrowLeft,
  Pencil,
  Crown,
  Plus,
  LayoutGrid,
  List,
  FolderTree,
  BarChart3,
  Calendar,
  Zap,
  Download,
  GitFork,
  BookOpen,
  Upload,
  ShieldCheck,
  CheckCircle2,
  Lock,
  FileText,
  Sparkles,
  Loader2,
  Clock,
  MessageSquare,
  Trash2,
  AlertTriangle,
  Settings
} from 'lucide-react';




import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { getTaskShortId, extractTagsAndCleanText } from '@/lib/task-id';

// Dynamic lazy-loaded view components for optimal code-splitting and load speed
const ProjectOverviewView = dynamic(
  () => import('@/components/ProjectOverviewView').then((m) => ({ default: m.ProjectOverviewView })),
  { ssr: false, loading: () => <ViewLoadingFallback /> }
);
const KanbanBoardView = dynamic(
  () => import('@/components/KanbanBoardView').then((m) => ({ default: m.KanbanBoardView })),
  { ssr: false, loading: () => <ViewLoadingFallback /> }
);
const CompactListView = dynamic(
  () => import('@/components/CompactListView').then((m) => ({ default: m.CompactListView })),
  { ssr: false, loading: () => <ViewLoadingFallback /> }
);
const TreeView = dynamic(
  () => import('@/components/TreeView').then((m) => ({ default: m.TreeView })),
  { ssr: false, loading: () => <ViewLoadingFallback /> }
);
const CalendarView = dynamic(
  () => import('@/components/CalendarView').then((m) => ({ default: m.CalendarView })),
  { ssr: false, loading: () => <ViewLoadingFallback /> }
);
const DependencyGraphView = dynamic(
  () => import('@/components/DependencyGraphView').then((m) => ({ default: m.DependencyGraphView })),
  { ssr: false, loading: () => <ViewLoadingFallback /> }
);
const ProjectDocsView = dynamic(
  () => import('@/components/ProjectDocsView').then((m) => ({ default: m.ProjectDocsView })),
  { ssr: false, loading: () => <ViewLoadingFallback /> }
);
const ConversationDrawer = dynamic(
  () => import('@/components/ConversationDrawer').then((m) => ({ default: m.ConversationDrawer })),
  { ssr: false }
);
const ProjectSettingsView = dynamic(
  () => import('@/components/ProjectSettingsView').then((m) => ({ default: m.ProjectSettingsView })),
  { ssr: false, loading: () => <ViewLoadingFallback /> }
);
const ProjectHistoryView = dynamic(
  () => import('@/components/ProjectHistoryView').then((m) => ({ default: m.ProjectHistoryView })),
  { ssr: false, loading: () => <ViewLoadingFallback /> }
);
const IssueDetailView = dynamic(
  () => import('@/components/IssueDetailView').then((m) => ({ default: m.IssueDetailView })),
  { ssr: false, loading: () => <ViewLoadingFallback /> }
);


const NewIssueModal = dynamic(
  () => import('@/components/NewIssueModal').then((m) => ({ default: m.NewIssueModal })),
  { ssr: false }
);
const ImportTasksModal = dynamic(
  () => import('@/components/ImportTasksModal').then((m) => ({ default: m.ImportTasksModal })),
  { ssr: false }
);

interface ProjectItem {
  id: string | number;
  key: string;
  name: string;
  description: string;
  creatorId?: number;
  owner_id?: number;
  ownerName?: string;
  joinStatus?: 'active' | 'pending';
}

interface MemberItem {
  id: number | string;
  name: string;
  email: string;
  avatar: string;
}

export type ProjectTab = 'overview' | 'tasks' | 'docs' | 'history' | 'settings';
export type TaskViewMode = 'structure' | 'board' | 'timeline' | 'list' | 'dependencies';

function parseViewTab(view?: string): ProjectTab {
  if (!view) return 'overview';
  const v = String(view).toLowerCase();
  if (v === 'overview' || v === 'analytics' || v === 'charts' || v === 'insights' || v === 'stats') return 'overview';
  if (v === 'docs' || v === 'wiki' || v === 'spec') return 'docs';
  if (v === 'history' || v === 'audit' || v === 'log' || v === 'changelog') return 'history';
  if (v === 'settings' || v === 'config' || v === 'preferences') return 'settings';
  if (
    v === 'tasks' ||
    v === 'board' ||
    v === 'kanban' ||
    v === 'list' ||
    v === 'compact-list' ||
    v === 'tree' ||
    v === 'structure' ||
    v === 'calendar' ||
    v === 'schedule' ||
    v === 'timeline' ||
    v === 'graph' ||
    v === 'dependencies' ||
    v === 'dag'
  ) {
    return 'tasks';
  }
  return 'overview';
}

function parseTaskMode(view?: string, modeParam?: string | null): TaskViewMode {
  const m = (modeParam || view || '').toLowerCase();
  if (m === 'board' || m === 'kanban') return 'board';
  if (m === 'timeline' || m === 'calendar' || m === 'schedule') return 'timeline';
  if (m === 'list' || m === 'compact-list') return 'list';
  if (m === 'dependencies' || m === 'graph' || m === 'dag') return 'dependencies';
  if (m === 'tree' || m === 'structure' || m === 'hierarchy') return 'structure';
  return 'structure'; // Default view per DEVELOPMENT.md Section 1 & 12
}

// Module memory to prevent re-triggering splash screen on tab switches within the same project
const initializedProjects = new Set<string>();

export default function SingleProjectPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdParam = params?.id as string;
  const viewParam = params?.view as string | undefined;
  const taskQuery = searchParams?.get('task');

  const [activeTab, setActiveTab] = useState<ProjectTab>(() => parseViewTab(viewParam));
  const [taskViewMode, setTaskViewMode] = useState<TaskViewMode>(() =>
    parseTaskMode(viewParam, searchParams?.get('mode'))
  );
  const [isChatOpen, setIsChatOpen] = useState(
    () =>
      searchParams?.get('chat') === 'open' ||
      viewParam === 'conversation' ||
      viewParam === 'chat' ||
      viewParam === 'messages'
  );

  useEffect(() => {
    if (viewParam) {
      const v = String(viewParam).toLowerCase();
      if (v === 'conversation' || v === 'chat' || v === 'messages' || v === 'discuss') {
        setIsChatOpen(true);
      }
      const tab = parseViewTab(viewParam);
      setActiveTab(tab);
      if (tab === 'tasks') {
        setTaskViewMode(parseTaskMode(viewParam, searchParams?.get('mode')));
      }
    }
  }, [viewParam, searchParams]);

  useEffect(() => {
    if (searchParams?.get('chat') === 'open') {
      setIsChatOpen(true);
    }
  }, [searchParams]);

  // Handle browser back/forward buttons smoothly without page reload
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== 'undefined') {
        const segments = window.location.pathname.split('/');
        const lastSegment = segments[segments.length - 1];
        if (lastSegment && lastSegment !== projectIdParam) {
          const tab = parseViewTab(lastSegment);
          setActiveTab(tab);
          if (tab === 'tasks') {
            const urlParams = new URLSearchParams(window.location.search);
            setTaskViewMode(parseTaskMode(lastSegment, urlParams.get('mode')));
          }
        } else {
          setActiveTab('overview');
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [projectIdParam]);

  const handleTabSwitch = useCallback(
    (newTab: ProjectTab, mode?: TaskViewMode) => {
      setActiveTab(newTab);
      if (mode) setTaskViewMode(mode);
      if (typeof window !== 'undefined') {
        const search = new URLSearchParams(window.location.search);
        if (newTab === 'tasks') {
          search.set('mode', mode || taskViewMode);
        } else {
          search.delete('mode');
        }
        const searchStr = search.toString() ? `?${search.toString()}` : '';
        const path = newTab === 'overview' ? `/projects/${projectIdParam}` : `/projects/${projectIdParam}/${newTab}`;
        window.history.pushState(null, '', `${path}${searchStr}`);
      }
    },
    [projectIdParam, taskViewMode]
  );

  const handleTaskModeSwitch = useCallback(
    (newMode: TaskViewMode) => {
      setTaskViewMode(newMode);
      if (typeof window !== 'undefined') {
        const search = new URLSearchParams(window.location.search);
        search.set('mode', newMode);
        const searchStr = search.toString() ? `?${search.toString()}` : '';
        window.history.pushState(null, '', `/projects/${projectIdParam}/tasks${searchStr}`);
      }
    },
    [projectIdParam]
  );

  const [project, setProject] = useState<ProjectItem | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [joinedMembers, setJoinedMembers] = useState<MemberItem[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userPermissions, setUserPermissions] = useState<MemberPermissions | null>(null);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(taskQuery || null);
  const [loading, setLoading] = useState(true);

  // Sync selected task from URL query param
  useEffect(() => {
    if (taskQuery && taskQuery !== selectedIssueId) {
      setSelectedIssueId(taskQuery);
    } else if (!taskQuery && selectedIssueId && !searchParams?.has('task')) {
      // Keep state in sync
    }
  }, [taskQuery, selectedIssueId, searchParams]);

  const handleSelectIssue = useCallback((id: string | null) => {
    setSelectedIssueId(id);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (id) {
        url.searchParams.set('task', id);
      } else {
        url.searchParams.delete('task');
      }
      window.history.replaceState(null, '', url.toString());
    }
  }, []);

  // Modals
  const [isNewIssueModalOpen, setIsNewIssueModalOpen] = useState(false);
  const [newIssueModalInitialMode, setNewIssueModalInitialMode] = useState<'task' | 'folder'>('task');
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
  const [isDeleteProjectModalOpen, setIsDeleteProjectModalOpen] = useState(false);
  const [confirmDeleteName, setConfirmDeleteName] = useState('');
  const [confirmDeleteKey, setConfirmDeleteKey] = useState('');
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [isLeaveProjectModalOpen, setIsLeaveProjectModalOpen] = useState(false);
  const [isLeavingProject, setIsLeavingProject] = useState(false);
  const [isImportTasksModalOpen, setIsImportTasksModalOpen] = useState(false);

  // Delete Project Handler
  const handleDeleteProjectConfirmed = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || isDeletingProject) return;

    if (
      confirmDeleteName.trim() !== project.name ||
      confirmDeleteKey.trim().toUpperCase() !== project.key.toUpperCase()
    ) {
      toast.error('Project Name and Key do not match exact details!');
      return;
    }

    setIsDeletingProject(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success(`Project ${project.name} deleted successfully.`);
        setIsDeleteProjectModalOpen(false);
        router.push('/projects');
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete project');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete project');
    } finally {
      setIsDeletingProject(false);
    }
  }, [project, confirmDeleteName, confirmDeleteKey, isDeletingProject, router]);

  // Leave Project Handler (For Joined Members)
  const handleLeaveProjectConfirmed = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || isLeavingProject) return;

    setIsLeavingProject(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/leave`, {
        method: 'POST',
      });

      if (res.ok) {
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem(`project_${project.id}`);
            localStorage.removeItem(`issues_${project.id}`);
            localStorage.removeItem('projects_list');
            localStorage.removeItem('dashboard_projects');
            localStorage.removeItem('dashboard_issues');
          } catch {}
        }
        toast.success(`You have left project "${project.name}".`);
        setIsLeaveProjectModalOpen(false);
        router.push('/projects');
      } else {

        const data = await res.json();
        throw new Error(data.error || 'Failed to leave project');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to leave project');
    } finally {
      setIsLeavingProject(false);
    }
  }, [project, isLeavingProject, router]);

  const handleCancelJoinRequest = useCallback(async () => {
    if (!project) return;
    try {
      const res = await fetch(`/api/projects/${project.id}/join-requests`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Unable to cancel the join request.');
      }
      toast.success('Join request cancelled.');
      router.push('/projects');
    } catch (err: any) {
      toast.error(err.message || 'Unable to cancel the join request.');
    }
  }, [project, router]);


  // In-UI Export Project Dump Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const [exportStep, setExportStep] = useState<'packaging' | 'encrypting' | 'ready' | 'error'>('packaging');
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatusText, setExportStatusText] = useState('Gathering project data...');
  const [exportBlobUrl, setExportBlobUrl] = useState<string | null>(null);
  const [exportFileName, setExportFileName] = useState('');
  const [exportFileSize, setExportFileSize] = useState('');

  const handleExportProject = useCallback(async () => {
    const rawName = String(project?.name || projectIdParam);
    const cleanName = rawName.replace(/\s+/g, '').replace(/[^a-zA-Z0-9_\-]/g, '') || 'Project';
    const fileName = `${cleanName}.teaderdumpfile`;
    setExportFileName(fileName);
    setIsExportModalOpen(true);
    setExportStep('packaging');
    setExportProgress(20);
    setExportStatusText('Aggregating tasks, subtask trees, and dependency branches...');
    setExportBlobUrl(null);

    try {
      setTimeout(() => {
        setExportProgress(55);
        setExportStatusText('Bundling Markdown technical documentation & member roles...');
      }, 350);

      setTimeout(() => {
        setExportStep('encrypting');
        setExportProgress(85);
        setExportStatusText('Applying AES-256-GCM cipher & computing SHA-256 checksum...');
      }, 700);

      const res = await fetch(`/api/projects/${projectIdParam}/export`);
      if (!res.ok) throw new Error('Failed to generate project dump');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const sizeKb = (blob.size / 1024).toFixed(1);

      setExportBlobUrl(url);
      setExportFileSize(`${sizeKb} KB`);
      setExportProgress(100);
      setExportStep('ready');
      setExportStatusText('Encrypted bundle ready for download.');
      toast.success(`Ready: ${fileName}`);
    } catch (err) {
      setExportStep('error');
      setExportStatusText('Export failed. Please check network connection.');
      toast.error('Export failed');
    }
  }, [projectIdParam, project]);

  const handleTriggerDownload = useCallback(() => {
    if (!exportBlobUrl || !exportFileName) return;
    const a = document.createElement('a');
    a.href = exportBlobUrl;
    a.download = exportFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success(`Downloaded ${exportFileName}`);
  }, [exportBlobUrl, exportFileName]);




  // Edit Project Form
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Splash Screen States: only show on initial opening of project, never when switching tabs
  const isAlreadyLoaded = initializedProjects.has(String(projectIdParam).toLowerCase());
  const [isInitialLoading, setIsInitialLoading] = useState(!isAlreadyLoaded);
  const [splashStep, setSplashStep] = useState(1);
  const [splashMessage, setSplashMessage] = useState('Verifying user authentication...');

  const isFetchingRef = useRef(false);

  // Real-time Fetching & User Session with Splash Steps
  const fetchProjectData = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      // Step 1: Verify User Session
      setSplashStep(1);
      setSplashMessage('Verifying user authentication...');
      let sessionUser: any = null;
      const meRes = await fetch('/api/auth/me');
      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData.user) {
          sessionUser = meData.user;
          setCurrentUser(meData.user);
        } else {
          router.push('/login');
          return;
        }
      } else {
        router.push('/login');
        return;
      }

      // Step 2: Verify Project Permissions & Membership
      setSplashStep(2);
      setSplashMessage('Verifying project permissions & membership...');
      const [projRes, issueRes] = await Promise.all([
        fetch('/api/projects', { cache: 'no-store' }),
        fetch('/api/issues', { cache: 'no-store' }),
      ]);

      if (projRes.status === 401 || issueRes.status === 401) {
        router.push('/login');
        return;
      }

      let foundProj: ProjectItem | null = null;
      if (projRes.ok) {
        const projData = await projRes.json();
        if (Array.isArray(projData)) {
          foundProj =
            projData.find(
              (p: ProjectItem) =>
                String(p.id) === String(projectIdParam) ||
                p.key.toLowerCase() === projectIdParam.toLowerCase()
            ) || null;
        }
      }

      setProject(foundProj);

      if (!foundProj) {
        // Project not found or user lacks access
        setIsInitialLoading(false);
        setLoading(false);
        return;
      }

      // Register project in session memory so switching tabs never shows splash screen
      initializedProjects.add(String(projectIdParam).toLowerCase());
      if (foundProj.key) initializedProjects.add(foundProj.key.toLowerCase());
      if (foundProj.id) initializedProjects.add(String(foundProj.id).toLowerCase());

      // Step 3: Load Architecture, Members, and Issues
      setSplashStep(3);
      setSplashMessage('Loading workspace issues & architecture...');
      if (foundProj && foundProj.id) {
        const [memRes, permRes] = await Promise.all([
          fetch(`/api/projects/${foundProj.id}/members`, { cache: 'no-store' }),
          fetch(`/api/projects/${foundProj.id}/permissions`, { cache: 'no-store' }).catch(() => null),
        ]);

        if (memRes.ok) {
          const memData = await memRes.json();
          if (Array.isArray(memData)) setJoinedMembers(memData);
        }

        if (permRes && permRes.ok) {
          const permData = await permRes.json();
          if (Array.isArray(permData) && sessionUser) {
            const myPerm = permData.find((p: any) => String(p.userId) === String(sessionUser.id));
            if (myPerm) setUserPermissions(myPerm);
          }
        }
      }

      if (issueRes.ok) {
        const issueData = await issueRes.json();
        if (Array.isArray(issueData)) {
          setIssues((prev) => {
            const next = reconcileIssues(prev, issueData);
            if (next !== prev && next.length > 0) {
              setLocalCache(`issues_${projectIdParam}`, next);
            }
            return next;
          });
        }
      }

      // Step 4: Finalize and Open Workspace
      setSplashStep(4);
      setSplashMessage('Initializing workspace views...');
      if (!isAlreadyLoaded) {
        await new Promise((r) => setTimeout(r, 180));
      }

    } catch (err) {
      console.error('Error loading project:', err);
    } finally {
      setIsInitialLoading(false);
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [projectIdParam, router, isAlreadyLoaded]);

  // Smart polling: every 30s only when tab is visible
  useEffect(() => {
    fetchProjectData();
    const POLL_INTERVAL = 30_000;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (!intervalId) {
        intervalId = setInterval(fetchProjectData, POLL_INTERVAL);
      }
    };
    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        fetchProjectData();
        startPolling();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchProjectData]);

  // Global Escape key listener to close detail view or modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditProjectModalOpen) {
          setIsEditProjectModalOpen(false);
        } else if (isNewIssueModalOpen) {
          setIsNewIssueModalOpen(false);
        } else if (selectedIssueId) {
          setSelectedIssueId(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIssueId, isEditProjectModalOpen, isNewIssueModalOpen]);



  // ─── Real-Time WebSocket Dynamic Synchronization ────────────────────────────
  useRealtimeSubscription({
    projectId: project?.id || projectIdParam,
    onEvent: useCallback((event: RealtimeEvent) => {
      switch (event.type) {
        case 'TASK_CREATED': {
          const newTask = event.payload;
          if (newTask) {
            const isForThisProj =
              !newTask.projectId ||
              String(newTask.projectId) === String(projectIdParam) ||
              (project &&
                (String(newTask.projectId) === String(project.id) ||
                  (newTask.project && newTask.project.toLowerCase() === project.name.toLowerCase())));
            if (isForThisProj) {
              setIssues((prev) => reconcileCreatedIssue(prev, newTask));
            }
          }
          break;
        }

        case 'TASK_UPDATED': {
          const updated = event.payload;
          if (Array.isArray(updated)) {
            const updateMap = new Map(updated.map((u: any) => [u.id, u]));
            setIssues((prev) =>
              prev.map((i) => (updateMap.has(i.id) ? { ...i, ...updateMap.get(i.id) } : i))
            );
          } else if (updated && updated.id) {
            setIssues((prev) =>
              prev.map((i) => (i.id === updated.id ? { ...i, ...updated } : i))
            );
          }
          break;
        }

        case 'TASKS_REORDERED': {
          const items: Array<{ id: string; orderIndex: number; status?: Status }> =
            event.payload?.items || (Array.isArray(event.payload) ? event.payload : []);
          if (items.length > 0) {
            const map = new Map(items.map((it) => [it.id, it]));
            setIssues((prev) => {
              const updated = prev.map((iss) => {
                const update = map.get(iss.id);
                if (update) {
                  return {
                    ...iss,
                    orderIndex: update.orderIndex !== undefined ? update.orderIndex : iss.orderIndex,
                    status: update.status || iss.status,
                  };
                }
                return iss;
              });
              return [...updated].sort((a, b) => (Number(a.orderIndex) || 0) - (Number(b.orderIndex) || 0));
            });
          }
          break;
        }

        case 'TASK_DELETED': {
          const deletedId = event.payload?.id || (typeof event.payload === 'string' ? event.payload : null);
          if (deletedId) {
            setIssues((prev) => prev.filter((i) => i.id !== deletedId));
            setSelectedIssueId((prev) => (prev === deletedId ? null : prev));
          }
          break;
        }

        case 'SUBTASK_UPDATED': {
          const payload = event.payload;
          if (payload) {
            const { action, issueId, subtask, subId, completed, title, parentId } = payload;
            setIssues((prev) =>
              prev.map((iss) => {
                if (issueId && iss.id !== issueId) return iss;
                let nextSubtasks = [...(iss.subtasks || [])];
                if (action === 'create' && subtask) {
                  if (!nextSubtasks.some((s) => s.id === subtask.id)) {
                    nextSubtasks.push(subtask);
                  }
                } else if (action === 'update' && subId) {
                  nextSubtasks = nextSubtasks.map((s) =>
                    s.id === subId
                      ? {
                          ...s,
                          ...(title !== undefined ? { title } : {}),
                          ...(completed !== undefined ? { completed } : {}),
                          ...(parentId !== undefined ? { parentId } : {}),
                        }
                      : s
                  );
                } else if (action === 'delete' && subId) {
                  nextSubtasks = nextSubtasks.filter((s) => s.id !== subId);
                }
                return { ...iss, subtasks: nextSubtasks };
              })
            );
          }
          fetchProjectData();
          break;
        }

        case 'PROJECT_UPDATED': {
          const updatedProj = event.payload;
          if (updatedProj && (String(updatedProj.id) === String(projectIdParam) || (project && String(updatedProj.id) === String(project.id)))) {
            setProject((prev) => (prev ? { ...prev, ...updatedProj } : prev));
          }
          break;
        }

        default:
          break;
      }
    }, [projectIdParam, project, fetchProjectData]),
  });

  // Memoized checks & derived state
  const isCreator = useMemo(() => {
    if (!currentUser || !project) return false;
    return (
      String(currentUser.id) === String(project.creatorId) ||
      String(currentUser.id) === String(project.owner_id) ||
      currentUser.name === project.ownerName
    );
  }, [currentUser, project]);

  const canDelete = useMemo(() => {
    if (isCreator) return true;
    if (currentUser?.role === 'admin' || currentUser?.role === 'owner') return true;
    return Boolean(userPermissions?.can_delete_tasks);
  }, [isCreator, currentUser, userPermissions]);

  const canEditDates = useMemo(() => {
    if (isCreator) return true;
    if (currentUser?.role === 'admin' || currentUser?.role === 'owner') return true;
    return Boolean(userPermissions?.can_edit_dates);
  }, [isCreator, currentUser, userPermissions]);

  const projectIssues = useMemo(() => {
    if (!project) return [];
    return issues.filter(
      (i: any) =>
        String(i.projectId) === String(project.id) ||
        i.project === project.name ||
        (i.project || '').toLowerCase() === project.name.toLowerCase()
    );
  }, [issues, project]);

  const selectedIssue = useMemo(() => {
    return issues.find((i) => i.id === selectedIssueId) || null;
  }, [issues, selectedIssueId]);

  const handleCopyProjectKey = useCallback(() => {
    if (!project) return;
    navigator.clipboard.writeText(project.key);
    setCopiedKey(true);
    toast.success(`Copied Project Key: ${project.key}`);
    setTimeout(() => setCopiedKey(false), 2000);
  }, [project]);

  // Real-time Edit Project Handler (Instant UI Feedback + Background Server Sync)
  const handleSaveProjectEdit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !editName.trim()) return;

    const newName = editName.trim();
    const newDesc = editDesc.trim();

    // 1. Immediately update UI and close modal (0ms latency)
    setProject((prev) => prev ? { ...prev, name: newName, description: newDesc } : null);
    setIsEditProjectModalOpen(false);
    toast.success('Project details updated!');

    // 2. Process in background to database
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          description: newDesc,
        }),
      });

      if (!res.ok) {
        toast.error('Failed to sync project details with server');
      }
    } catch {
      toast.error('Failed to sync project details to database');
    }
  }, [project, editName, editDesc]);


  // Status Switch Handler with Optimistic Update
  const handleUpdateStatus = useCallback(async (issueId: string, newStatus: Status) => {
    const targetIssue = issues.find((i) => i.id === issueId);
    if (!targetIssue) return;

    const previousIssues = issues;
    const currentUserName = currentUser?.name || currentUser?.username || 'Current User';
    const isDone = newStatus === 'done';
    const completedAt = isDone ? new Date().toISOString() : undefined;
    const completedByName = isDone ? currentUserName : undefined;

    setIssues((prev) =>
      prev.map((i) =>
        i.id === issueId
          ? {
              ...i,
              status: newStatus,
              completedByName: isDone ? currentUserName : undefined,
              completedAt: isDone ? completedAt : undefined,
            }
          : i
      )
    );

    try {
      const res = await fetch(`/api/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          completedByName: isDone ? currentUserName : null,
          completedAt: isDone ? completedAt : null,
        }),
      });

      if (!res.ok) throw new Error('Failed to update DB');
      toast.success(
        isDone
          ? `Task marked as completed by ${currentUserName}`
          : `Updated status to ${newStatus.replace('_', ' ')}`
      );
    } catch {
      toast.error('Error updating status in database');
      setIssues(previousIssues);
    }
  }, [issues, currentUser]);

  // Reorder Issues Handler for Board / List View Drag & Drop with Database Persistence
  const handleReorderIssues = useCallback(async (reorderedProjectIssues: Issue[]) => {
    // 1. Optimistic state update
    setIssues((prev) => {
      const nonProjectIssues = prev.filter(
        (i: any) =>
          project &&
          String(i.projectId) !== String(project.id) &&
          i.project !== project.name &&
          (i.project || '').toLowerCase() !== project.name.toLowerCase()
      );
      return [...reorderedProjectIssues, ...nonProjectIssues];
    });

    // 2. Persist updated orderIndex & status in database
    try {
      const payload = reorderedProjectIssues.map((iss, idx) => ({
        id: iss.id,
        orderIndex: idx,
        status: iss.status,
      }));

      await fetch('/api/issues/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payload, projectId: project?.id }),
      });
    } catch (err) {
      console.error('Error saving reordered tasks to DB:', err);
    }
  }, [project]);

  // Delete Task Handler (Admin / Owner privilege)
  const handleDeleteIssue = useCallback(async (issueId: string) => {
    const targetIssue = issues.find((i) => i.id === issueId);
    const issueKey = targetIssue?.key || issueId;

    if (!canDelete) {
      toast.error('Permission Denied: You do not have permission to delete tasks in this project.');
      return;
    }

    // Optimistically remove from state
    setIssues((prev) => prev.filter((i) => i.id !== issueId));
    if (selectedIssueId === issueId) {
      setSelectedIssueId(null);
    }
    toast.success(`Deleted task ${issueKey}`);

    try {
      const res = await fetch(`/api/issues/${issueId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        toast.error('Failed to delete task from server');
      }
    } catch {
      toast.error('Network error while deleting task');
    }
  }, [issues, selectedIssueId, isCreator, currentUser]);

  // Update Task Priority Handler
  const handleUpdateIssuePriority = useCallback(async (issueId: string, nextPriority: Priority) => {
    setIssues((prev) =>
      prev.map((i) => (i.id === issueId ? { ...i, priority: nextPriority } : i))
    );
    toast.success(`Priority updated to ${nextPriority}`);

    try {
      await fetch(`/api/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: nextPriority }),
      });
    } catch {
      toast.error('Failed to update priority on server');
    }
  }, []);

  // Add New Task in Active Selected Project (Direct UI + Background Sync)
  const handleAddNewTaskToColumn = useCallback(async (title: string, status: Status) => {
    if (!project) return;

    const extracted = extractTagsAndCleanText(title);
    const cleanTitle = extracted.cleanText || title.trim();
    const tags = extracted.tags;

    const tempId = `temp_${Date.now()}`;
    const tempKey = `${project.key}-${Date.now().toString().slice(-4)}`;
    const currentUserName = currentUser?.name || currentUser?.username || 'Current User';
    const optimisticIssue: Issue = {
      id: tempId,
      key: tempKey,
      title: cleanTitle,
      description: '',
      status,
      priority: 'medium',
      project: project.name,
      projectId: project.id,
      reporterName: currentUserName,
      assigneeName: currentUserName,
      labels: ['Task'],
      tags,
      subtasks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };


    // 1. Add in UI directly and immediately (0ms latency)
    setIssues((prev) => reconcileCreatedIssue(prev, optimisticIssue));
    toast.success(`Task "${cleanTitle}" created!`);

    // 2. Process in background to PostgreSQL server
    try {
      const res = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: cleanTitle,
          status,
          priority: 'medium',
          project: project.name,
          projectId: project.id,
          reporterName: currentUserName,
          assigneeName: currentUserName,
          labels: ['Task'],
          tags,
        }),
      });

      if (res.ok) {
        const createdIssue = await res.json();
        setIssues((prev) => reconcileCreatedIssue(prev, createdIssue));
      } else {
        throw new Error('Failed to create task on server');
      }
    } catch {
      toast.error('Failed to sync new task with server');
      setIssues((prev) => prev.filter((iss) => iss.id !== tempId));
    }
  }, [project, reconcileCreatedIssue]);


  // Handle Subtask Toggle (Recursive Optimistic Update)
  const handleToggleSubtask = useCallback(async (issueId: string, subId: string, nextCompleted: boolean) => {
    const toggleRecursive = (items: any[]): any[] =>
      items.map((st) => {
        if (st.id === subId) {
          const setChild = (children: any[]): any[] =>
            children.map((c) => ({
              ...c,
              completed: nextCompleted,
              subtasks: c.subtasks ? setChild(c.subtasks) : [],
            }));
          return {
            ...st,
            completed: nextCompleted,
            subtasks: st.subtasks ? setChild(st.subtasks) : [],
          };
        }
        if (st.subtasks && st.subtasks.length > 0) {
          return { ...st, subtasks: toggleRecursive(st.subtasks) };
        }
        return st;
      });

    setIssues((prev) =>
      prev.map((iss) => {
        if (iss.id !== issueId) return iss;
        return { ...iss, subtasks: toggleRecursive(iss.subtasks || []) };
      })
    );

    try {
      await fetch('/api/subtasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subId, completed: nextCompleted, issueId, projectId: project?.id }),
      });
      toast.success(`Marked as ${nextCompleted ? 'completed' : 'incomplete'}`);
      const ENABLE_CELEBRATION = false;
      if (nextCompleted && ENABLE_CELEBRATION) {
        confetti({ particleCount: 35, spread: 40, origin: { y: 0.7 } });
      }

    } catch {
      toast.error('Failed to update subtask');
      fetchProjectData();
    }
  }, [fetchProjectData, project]);

  // Handle Add Subtask or Nested Folder (Optimistic Update)
  const handleAddSubtask = useCallback(async (
    issueId: string,
    title: string,
    parentId: string | null = null,
    isFolder: boolean = false,
    type: 'folder' | 'subtask' = 'subtask'
  ) => {
    try {
      const res = await fetch('/api/subtasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId, title, parentId, isFolder, type, projectId: project?.id }),
      });

      if (res.ok) {
        const createdSub = await res.json();
        setIssues((prev) =>
          prev.map((iss) => {
            if (iss.id !== issueId) return iss;
            const currentSubtasks = iss.subtasks || [];
            
            const insertInTree = (nodes: any[]): any[] => {
              if (!parentId) return [...nodes, { ...createdSub, subtasks: [] }];
              return nodes.map((node) => {
                if (node.id === parentId) {
                  return {
                    ...node,
                    subtasks: [...(node.subtasks || []), { ...createdSub, subtasks: [] }],
                  };
                }
                if (node.subtasks && node.subtasks.length > 0) {
                  return { ...node, subtasks: insertInTree(node.subtasks) };
                }
                return node;
              });
            };

            return {
              ...iss,
              subtasks: insertInTree(currentSubtasks),
            };
          })
        );
        toast.success(isFolder ? 'Folder created!' : 'Subtask added!');
      } else {
        throw new Error('Failed to create subtask');
      }
    } catch {
      toast.error('Failed to save to database');
    }
  }, []);

  // Handle Delete Subtask / Folder (Optimistic Update)
  const handleDeleteSubtask = useCallback(async (issueId: string, subId: string) => {
    const removeFromTree = (nodes: any[]): any[] =>
      nodes
        .filter((n) => n.id !== subId)
        .map((n) => ({
          ...n,
          subtasks: n.subtasks ? removeFromTree(n.subtasks) : [],
        }));

    setIssues((prev) =>
      prev.map((iss) => {
        if (iss.id !== issueId) return iss;
        return {
          ...iss,
          subtasks: removeFromTree(iss.subtasks || []),
        };
      })
    );

    try {
      const res = await fetch(`/api/subtasks?id=${subId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Item deleted');
      } else {
        throw new Error('Failed to delete');
      }
    } catch {
      toast.error('Failed to delete item');
      fetchProjectData();
    }
  }, [fetchProjectData]);

  // Handle Rename Subtask / Folder (Optimistic Update)
  const handleRenameSubtask = useCallback(async (issueId: string, subId: string, newTitle: string) => {
    const renameInTree = (nodes: any[]): any[] =>
      nodes.map((n) => {
        if (n.id === subId) return { ...n, title: newTitle };
        if (n.subtasks && n.subtasks.length > 0) {
          return { ...n, subtasks: renameInTree(n.subtasks) };
        }
        return n;
      });

    setIssues((prev) =>
      prev.map((iss) => {
        if (iss.id !== issueId) return iss;
        return { ...iss, subtasks: renameInTree(iss.subtasks || []) };
      })
    );

    try {
      const res = await fetch('/api/subtasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subId, title: newTitle }),
      });
      if (res.ok) {
        toast.success('Renamed successfully!');
      } else {
        throw new Error('Failed');
      }
    } catch {
      toast.error('Failed to rename item');
      fetchProjectData();
    }
  }, [fetchProjectData]);

  // Pure helper to move a node (subtask or folder) to a new parent folder or task root
  const moveNodeInIssues = (
    currentIssues: Issue[],
    subId: string,
    newParentId: string | null,
    targetIssueId: string
  ): Issue[] => {
    let extractedNode: any = null;

    // 1. Remove the node from wherever it currently lives
    const removeRecursive = (items: any[]): any[] => {
      const result: any[] = [];
      for (const item of items) {
        if (item.id === subId) {
          extractedNode = { ...item };
        } else {
          const copy = { ...item };
          if (copy.subtasks && copy.subtasks.length > 0) {
            copy.subtasks = removeRecursive(copy.subtasks);
          }
          result.push(copy);
        }
      }
      return result;
    };

    const strippedIssues = currentIssues.map((iss) => ({
      ...iss,
      subtasks: removeRecursive(iss.subtasks || []),
    }));

    if (!extractedNode) {
      return currentIssues;
    }

    // 2. Update node's parent and target issue attributes
    extractedNode.parentId = newParentId;
    extractedNode.issueId = targetIssueId;

    // 3. Insert the node into target issue (at root or inside newParentId parent)
    const insertRecursive = (items: any[]): any[] => {
      return items.map((item) => {
        if (item.id === newParentId) {
          return {
            ...item,
            subtasks: [...(item.subtasks || []), extractedNode],
          };
        }
        if (item.subtasks && item.subtasks.length > 0) {
          return {
            ...item,
            subtasks: insertRecursive(item.subtasks),
          };
        }
        return item;
      });
    };


    return strippedIssues.map((iss) => {
      if (iss.id !== targetIssueId) return iss;

      if (!newParentId) {
        return {
          ...iss,
          subtasks: [...(iss.subtasks || []), extractedNode],
        };
      } else {
        return {
          ...iss,
          subtasks: insertRecursive(iss.subtasks || []),
        };
      }
    });
  };

  // Handle Drag & Drop to Move Subtask / Folder (Switch Parent)
  const handleMoveSubtask = useCallback(async (subId: string, newParentId: string | null, targetIssueId: string) => {
    // 1. Optimistic UI update immediately
    setIssues((prev) => moveNodeInIssues(prev, subId, newParentId, targetIssueId));

    try {
      const res = await fetch('/api/subtasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subId, parentId: newParentId, issueId: targetIssueId }),
      });
      if (res.ok) {
        toast.success(newParentId ? 'Moved into folder!' : 'Moved to task root!');
      } else {
        toast.error('Failed to move item');
        fetchProjectData();
      }
    } catch {
      toast.error('Failed to move item');
      fetchProjectData();
    }
  }, [fetchProjectData]);


  // Handle Rename Issue / Task (Optimistic Update)
  const handleRenameIssue = useCallback(async (issueId: string, newTitle: string) => {
    setIssues((prev) =>
      prev.map((iss) => (iss.id === issueId ? { ...iss, title: newTitle } : iss))
    );

    try {
      const res = await fetch(`/api/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });
      if (res.ok) {
        toast.success('Task renamed!');
      } else {
        throw new Error('Failed');
      }
    } catch {
      toast.error('Failed to rename task');
      fetchProjectData();
    }
  }, [fetchProjectData]);

  // Handle Rename Epic (Optimistic Update)
  const handleRenameEpic = useCallback(async (oldEpicName: string, newEpicName: string) => {
    setIssues((prev) =>
      prev.map((iss) => {
        const isFolderEntity =
          iss.title === `📁 ${oldEpicName}` ||
          iss.title === `[Folder] ${oldEpicName}` ||
          (iss.labels && iss.labels.some((l) => l.toLowerCase() === 'folder') && (iss.title.replace(/^(\📁|\[Folder\])\s*/i, '').trim() === oldEpicName));
        const matchesEpic = (iss.epic || 'General Tasks') === oldEpicName || iss.epic === oldEpicName;

        if (isFolderEntity || matchesEpic) {
          return {
            ...iss,
            epic: newEpicName,
            ...(isFolderEntity ? { title: `📁 ${newEpicName}` } : {}),
          };
        }
        return iss;
      })
    );

    try {
      const matching = issues.filter((iss) => {
        const isFolderEntity =
          iss.title === `📁 ${oldEpicName}` ||
          iss.title === `[Folder] ${oldEpicName}` ||
          (iss.labels && iss.labels.some((l) => l.toLowerCase() === 'folder') && (iss.title.replace(/^(\📁|\[Folder\])\s*/i, '').trim() === oldEpicName));
        return (iss.epic || 'General Tasks') === oldEpicName || iss.epic === oldEpicName || isFolderEntity;
      });

      await Promise.all(
        matching.map((iss) => {
          const isFolderEntity =
            iss.title === `📁 ${oldEpicName}` ||
            iss.title === `[Folder] ${oldEpicName}` ||
            (iss.labels && iss.labels.some((l) => l.toLowerCase() === 'folder') && (iss.title.replace(/^(\📁|\[Folder\])\s*/i, '').trim() === oldEpicName));
          return fetch(`/api/issues/${iss.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              epic: newEpicName,
              ...(isFolderEntity ? { title: `📁 ${newEpicName}` } : {}),
            }),
          });
        })
      );
    } catch {
      toast.error('Failed to rename folder');
      fetchProjectData();
    }
  }, [issues, fetchProjectData]);

  // Handle Delete Folder (Option: Delete folder only -> tasks moved to General, OR delete folder & all tasks)
  const handleDeleteFolder = useCallback(async (folderId: string, folderName: string, deleteTasks: boolean) => {
    if (!folderName || folderName.toLowerCase() === 'general' || folderName.toLowerCase() === 'general tasks') {
      toast.info('The "General" folder is the default workspace folder and cannot be deleted.');
      return;
    }

    const isThisFolderEntity = (i: Issue) => {
      if (folderId && i.id === folderId) return true;
      const isFolder =
        (i.labels && i.labels.some((l) => l.toLowerCase() === 'folder' || l.toLowerCase() === 'group')) ||
        i.title.startsWith('📁 ') ||
        i.title.startsWith('[Folder]');
      return isFolder && i.id === folderId;
    };

    const isTaskInThisFolder = (i: Issue) => {
      if (isThisFolderEntity(i)) return false;
      if (i.folderId && folderId) {
        return i.folderId === folderId;
      }
      return (i.epic || '').trim() === folderName;
    };

    if (deleteTasks) {
      // Option B: Delete Folder AND All Tasks
      const allMatching = issues.filter((i) => isThisFolderEntity(i) || isTaskInThisFolder(i));
      setIssues((prev) => prev.filter((i) => !isThisFolderEntity(i) && !isTaskInThisFolder(i)));
      toast.success(`Folder "${folderName}" and all tasks deleted.`);

      try {
        await Promise.all(
          allMatching.map((iss) =>
            fetch(`/api/issues/${iss.id}`, {
              method: 'DELETE',
            })
          )
        );
      } catch {
        toast.error('Failed to sync deletion with server');
        fetchProjectData();
      }
    } else {
      // Option A: Delete Folder Only -> move tasks inside it to General
      const folderEntities = issues.filter(isThisFolderEntity);
      const childTasks = issues.filter(isTaskInThisFolder);

      setIssues((prev) =>
        prev
          .filter((i) => !isThisFolderEntity(i))
          .map((i) => (isTaskInThisFolder(i) ? { ...i, folderId: 'folder_general', epic: 'General' } : i))
      );
      toast.success(
        childTasks.length > 0
          ? `Folder "${folderName}" deleted. ${childTasks.length} task(s) moved to General.`
          : `Folder "${folderName}" deleted.`
      );

      try {
        await Promise.all(
          folderEntities.map((iss) =>
            fetch(`/api/issues/${iss.id}`, {
              method: 'DELETE',
            })
          )
        );

        await Promise.all(
          childTasks.map((iss) =>
            fetch(`/api/issues/${iss.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ folderId: 'folder_general', epic: 'General' }),
            })
          )
        );
      } catch {
        toast.error('Failed to update tasks on server');
        fetchProjectData();
      }
    }
  }, [issues, fetchProjectData]);

  // Handle Drag & Drop to Move Task between Folders/Epics
  const handleMoveTaskToFolder = useCallback(async (issueId: string, targetFolderId: string, targetFolderName?: string) => {
    let nextAllIssues: Issue[] = [];
    const finalEpic = targetFolderName || (targetFolderId === 'folder_general' ? 'General' : targetFolderId);

    // 1. Optimistic UI update
    setIssues((prev) => {
      const dragged = prev.find((i) => i.id === issueId);
      if (!dragged) return prev;
      const updated = { ...dragged, folderId: targetFolderId, epic: finalEpic };
      const remaining = prev.filter((i) => i.id !== issueId);
      nextAllIssues = [...remaining, updated];
      return nextAllIssues;
    });
    toast.success(`Task moved into "${finalEpic}" folder!`);

    // 2. Background Sync
    try {
      await fetch(`/api/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: targetFolderId, epic: finalEpic }),
      });

      const projIssues = nextAllIssues.filter(
        (i: any) =>
          project &&
          (String(i.projectId) === String(project.id) ||
            i.project === project.name ||
            (i.project || '').toLowerCase() === project.name.toLowerCase())
      );

      if (projIssues.length > 0) {
        const payload = projIssues.map((iss, idx) => ({
          id: iss.id,
          orderIndex: idx,
          status: iss.status,
        }));

        await fetch('/api/issues/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: payload, projectId: project?.id }),
        });
      }
    } catch {
      toast.error('Network error moving task');
      fetchProjectData();
    }
  }, [project, fetchProjectData]);

  // Handle Add Task directly into Folder (from Tree Explorer inline button)
  const handleAddTaskToFolder = useCallback(async (folderId: string, folderName: string, taskTitle: string) => {
    if (!project || !taskTitle.trim()) return;

    const extracted = extractTagsAndCleanText(taskTitle);
    const cleanTitle = extracted.cleanText || taskTitle.trim();
    const tags = extracted.tags;

    const tempId = `temp_${Date.now()}`;
    const tempKey = `${project.key}-${Date.now().toString().slice(-4)}`;
    const currentUserName = currentUser?.name || currentUser?.username || 'Current User';
    const optimisticIssue: Issue = {
      id: tempId,
      key: tempKey,
      title: cleanTitle,
      description: '',
      status: 'todo',
      priority: 'medium',
      project: project.name,
      projectId: project.id,
      reporterName: currentUserName,
      assigneeName: currentUserName,
      epic: folderName || 'General',
      folderId: folderId || (folderName === 'General' ? 'folder_general' : undefined),
      labels: ['General'],
      tags,
      subtasks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setIssues((prev) => reconcileCreatedIssue(prev, optimisticIssue));
    toast.success(`Task created in folder "${folderName}"!`);

    try {
      const res = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: cleanTitle,
          status: 'todo',
          priority: 'medium',
          project: project.name,
          projectId: project.id,
          reporterName: currentUserName,
          assigneeName: currentUserName,
          epic: folderName || 'General',
          folderId: folderId || (folderName === 'General' ? 'folder_general' : undefined),
          labels: ['General'],
          tags,
        }),
      });
      if (res.ok) {
        const createdIssue = await res.json();
        setIssues((prev) => reconcileCreatedIssue(prev, createdIssue));
      }
    } catch {
      toast.error('Failed to sync task to server');
      setIssues((prev) => prev.filter((iss) => iss.id !== tempId));
    }
  }, [project, reconcileCreatedIssue]);

  // Handle Drag & Drop to Reorder Task inside Folder or between Folders
  const handleReorderTaskInFolder = useCallback(async (
    draggedIssueId: string,
    targetIssueId: string,
    targetFolderId: string,
    targetFolderName: string,
    position: 'before' | 'after'
  ) => {
    let nextAllIssues: Issue[] = [];

    setIssues((prev) => {
      const dragged = prev.find((i) => i.id === draggedIssueId);
      if (!dragged) return prev;

      const updatedDragged = { ...dragged, folderId: targetFolderId, epic: targetFolderName };
      const remaining = prev.filter((i) => i.id !== draggedIssueId);
      const targetIndex = remaining.findIndex((i) => i.id === targetIssueId);

      if (targetIndex === -1) {
        nextAllIssues = [updatedDragged, ...remaining];
      } else {
        const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
        const next = [...remaining];
        next.splice(insertIndex, 0, updatedDragged);
        nextAllIssues = next;
      }
      return nextAllIssues;
    });

    try {
      await fetch(`/api/issues/${draggedIssueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: targetFolderId, epic: targetFolderName }),
      });

      const projIssues = nextAllIssues.filter(
        (i: any) =>
          project &&
          (String(i.projectId) === String(project.id) ||
            i.project === project.name ||
            (i.project || '').toLowerCase() === project.name.toLowerCase())
      );

      if (projIssues.length > 0) {
        const payload = projIssues.map((iss, idx) => ({
          id: iss.id,
          orderIndex: idx,
          status: iss.status,
        }));

        await fetch('/api/issues/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: payload, projectId: project?.id }),
        });
      }
    } catch {
      toast.error('Failed to sync task reordering');
      fetchProjectData();
    }
  }, [project, fetchProjectData]);

  return (
    <>
      {/* Upper Layer Splash Screen (Fades out when background loading completes) */}
      <AnimatePresence>
        {isInitialLoading && <WorkspaceSplashScreen />}
      </AnimatePresence>

      <AppLayout>

      {/* Access Denied Guard if user does not own and is not joined in this project */}
      {!isInitialLoading && !project ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 bg-[#131415] text-[#CFD4DD]">
          <div className="w-14 h-14 rounded-2xl bg-[#EF4444]/10 border border-[#EF4444]/30 flex items-center justify-center text-[#EF4444]">
            <Lock size={28} />
          </div>
          <h2 className="text-lg font-bold text-white">Access Denied or Project Not Found</h2>
          <p className="text-xs text-[#787C83] max-w-md">
            You do not have access to this project. Only project owners and joined members can access this workspace.
          </p>
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => router.push('/projects')}
              className="px-4 py-2 bg-[#DCB001] text-[#0F1011] text-xs font-bold rounded-xl hover:bg-[#c49c00] transition-colors"
            >
              Back to My Projects
            </button>
          </div>
        </div>
      ) : project?.joinStatus === 'pending' ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 bg-[#131415] text-[#CFD4DD]">
          <div className="w-14 h-14 rounded-2xl bg-[#DCB001]/10 border border-[#DCB001]/30 flex items-center justify-center text-[#DCB001]">
            <Clock size={28} />
          </div>
          <h2 className="text-lg font-bold text-white">Joining Request Pending Approval</h2>
          <p className="text-xs text-[#787C83] max-w-md">
            Your request to join <span className="text-[#CFD4DD] font-semibold">{project.name}</span> has been sent to the project owner. You will get workspace access once it is approved.
          </p>
          <div className="flex items-center gap-3 pt-2">
            <button onClick={() => router.push('/projects')} className="px-4 py-2 border border-[#2A2C30] text-[#CFD4DD] text-xs font-bold rounded-xl hover:bg-[#1B1C1F] transition-colors">Back to My Projects</button>
            <button onClick={handleCancelJoinRequest} className="px-4 py-2 bg-[#C0393B] text-white text-xs font-bold rounded-xl hover:bg-[#A32D2F] transition-colors">Cancel Request</button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#131415] text-[#CFD4DD] font-sans">
        {/* 1. Main Workspace Top Header: Project Identity, Info & Global Actions */}
        <div className="h-11 px-4 bg-[#1B1C1F] border-b border-[#2A2C30] flex items-center justify-between shrink-0 select-none">
          {/* Left: Breadcrumbs & Project Identity */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => router.push('/projects')}
              className="text-xs text-[#787C83] hover:text-[#CFD4DD] font-mono flex items-center gap-1 transition-colors shrink-0"
              title="Back to Projects"
            >
              <ArrowLeft size={13} />
              <span>Projects</span>
            </button>
            <span className="text-[#3B3D41]">/</span>

            <div className="flex items-center gap-1.5 min-w-0">
              <FolderKanban size={14} className="text-[#DCB001] shrink-0" />
              <span className="text-xs font-bold text-[#CFD4DD] truncate max-w-[160px] md:max-w-[240px]" title={project?.name}>
                {project?.name}
              </span>

              {isCreator && (
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => {
                      if (project) {
                        setEditName(project.name);
                        setEditDesc(project.description || '');
                        setIsEditProjectModalOpen(true);
                      }
                    }}
                    className="p-1 text-[#787C83] hover:text-[#DCB001] hover:bg-[#131415] rounded transition-colors"
                    title="Edit Project Details (Creator Only)"
                  >
                    <Pencil size={12} />
                  </button>

                  <button
                    onClick={() => {
                      if (project) {
                        setConfirmDeleteName('');
                        setConfirmDeleteKey('');
                        setIsDeleteProjectModalOpen(true);
                      }
                    }}
                    className="p-1 text-[#787C83] hover:text-[#EF4444] hover:bg-[#131415] rounded transition-colors"
                    title="Delete Project (Creator Only)"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>


            {/* Compact Copyable Project Key Pill */}
            {project && (
              <button
                onClick={handleCopyProjectKey}
                className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 bg-[#131415] hover:bg-[#222427] border border-[#2A2C30] hover:border-[#DCB001]/40 rounded text-[10px] font-mono text-[#DCB001] transition-all group shrink-0"
                title={`Click to copy Project Key: ${project.key}`}
              >
                <Key size={10} className="text-[#787C83] group-hover:text-[#DCB001]" />
                <span className="font-bold truncate max-w-[90px] md:max-w-[120px]">{project.key}</span>
                {copiedKey ? (
                  <Check size={11} className="text-[#22C55E]" />
                ) : (
                  <Copy size={10} className="text-[#787C83] group-hover:text-white" />
                )}
              </button>
            )}
          </div>

          {/* Right: Creator, Stacked Members, Sync Pulse & Action Buttons */}
          <div className="flex items-center gap-2 text-xs shrink-0">
            {/* Project Creator Pill */}
            <div className="hidden lg:flex items-center gap-1 bg-[#131415] border border-[#2A2C30] rounded-md px-2 py-0.5 text-[11px]">
              <Crown size={11} className={isCreator ? 'text-[#22C55E]' : 'text-[#787C83]'} />
              <span className="text-[#787C83]">by</span>
              <span className="font-semibold text-[#CFD4DD] truncate max-w-[70px]">{project?.ownerName || 'karri'}</span>
            </div>

            {/* Stacked Project Members */}
            {joinedMembers.length > 0 && (
              <div
                className="hidden md:flex items-center -space-x-1.5 pl-1"
                title={`Joined Members (${joinedMembers.length}): ${joinedMembers.map((m) => m.name).join(', ')}`}
              >
                {joinedMembers.slice(0, 3).map((m) => (
                  <div key={m.id} className="ring-1 ring-[#1B1C1F] rounded-full">
                    <Avatar user={{ id: String(m.id), name: m.name, avatar: m.avatar, email: m.email, role: '' }} size="xs" />
                  </div>
                ))}
                {joinedMembers.length > 3 && (
                  <div className="w-5 h-5 rounded-full bg-[#2A2C30] border border-[#1B1C1F] flex items-center justify-center text-[9px] font-mono text-[#CFD4DD]">
                    +{joinedMembers.length - 3}
                  </div>
                )}
              </div>
            )}

            {/* Live Sync WebSocket Indicator */}
            <div className="hidden xl:flex items-center pl-1">
              <RealtimeBadge />
            </div>

            {/* Import Tasks Button */}
            <button
              onClick={() => setIsImportTasksModalOpen(true)}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1 bg-[#131415] hover:bg-[#222427] border border-[#2A2C30] hover:border-[#DCB001]/40 rounded-md text-[11px] text-[#787C83] hover:text-[#CFD4DD] transition-all"
              title="Import Tasks from CSV / JSON"
            >
              <Upload size={12} />
              <span className="hidden md:inline">Import</span>
            </button>

            {/* Export Project Button */}
            <button
              onClick={handleExportProject}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1 bg-[#131415] hover:bg-[#222427] border border-[#2A2C30] hover:border-[#DCB001]/40 rounded-md text-[11px] text-[#787C83] hover:text-[#CFD4DD] transition-all"
              title="Export Encrypted Project Dump (.teaderdumpfile)"
            >
              <Download size={12} />
              <span className="hidden md:inline">Export</span>
            </button>
          </div>
        </div>

        {/* 2. 4-Page Primary Navigation Bar (Overview | Tasks | Docs | Settings + Chat Drawer Toggle) */}
        <div className="h-11 px-4 bg-[#141517] border-b border-[#2A2C30] flex items-center justify-between overflow-x-auto shrink-0 select-none custom-scrollbar gap-3">
          <div className="flex items-center gap-1 bg-[#101113] p-1 rounded-xl border border-[#222428]">
            <button
              onClick={() => handleTabSwitch('overview')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'overview'
                  ? 'bg-[#2A2C30] text-[#DCB001] shadow-sm'
                  : 'text-[#787C83] hover:text-[#CFD4DD]'
              }`}
              title="Project Overview & Analytics"
            >
              <BarChart3 size={13} />
              <span>Overview</span>
            </button>

            <button
              onClick={() => handleTabSwitch('tasks')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'tasks'
                  ? 'bg-[#2A2C30] text-[#DCB001] shadow-sm'
                  : 'text-[#787C83] hover:text-[#CFD4DD]'
              }`}
              title="Project Tasks & Views (Board, List, Tree, Timeline, Dependencies)"
            >
              <LayoutGrid size={13} />
              <span>Tasks</span>
              <span className="text-[10px] font-mono opacity-80">({projectIssues.length})</span>
            </button>

            <button
              onClick={() => handleTabSwitch('docs')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'docs'
                  ? 'bg-[#2A2C30] text-[#DCB001] shadow-sm'
                  : 'text-[#787C83] hover:text-[#CFD4DD]'
              }`}
              title="Project Wiki & Specs"
            >
              <BookOpen size={13} />
              <span>Docs</span>
            </button>

            <button
              onClick={() => handleTabSwitch('history')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'history'
                  ? 'bg-[#2A2C30] text-[#DCB001] shadow-sm'
                  : 'text-[#787C83] hover:text-[#CFD4DD]'
              }`}
              title="Project Activity History & Audit Log"
            >
              <Clock size={13} />
              <span>History</span>
            </button>

            <button
              onClick={() => handleTabSwitch('settings')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'settings'
                  ? 'bg-[#2A2C30] text-[#DCB001] shadow-sm'
                  : 'text-[#787C83] hover:text-[#CFD4DD]'
              }`}
              title="Project Settings & Danger Zone"
            >
              <Settings size={13} />
              <span>Settings</span>
            </button>
          </div>

          {/* Quick Chat Drawer Toggle Button */}
          <button
            onClick={() => setIsChatOpen((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-xl border transition-all ${
              isChatOpen
                ? 'bg-[#DCB001]/15 text-[#DCB001] border-[#DCB001]/40 shadow-sm'
                : 'bg-[#101113] text-[#787C83] hover:text-[#CFD4DD] border-[#222428]'
            }`}
            title="Toggle Team Conversation Drawer"
          >
            <MessageSquare size={13} className={isChatOpen ? 'text-[#DCB001]' : ''} />
            <span>Chat</span>
          </button>
        </div>

        {/* 4-Page Workspace Content Area */}
        <ErrorBoundary>
          {activeTab === 'overview' ? (
            <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
              <ProjectOverviewView
                issues={projectIssues}
                project={project}
                members={joinedMembers}
                onNavigateTab={(tab, mode) =>
                  handleTabSwitch(tab, mode === 'tree' ? 'structure' : (mode as TaskViewMode))
                }
                onOpenNewIssue={() => setIsNewIssueModalOpen(true)}
              />
            </div>
          ) : activeTab === 'docs' ? (
            <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
              <ProjectDocsView
                projectId={project?.id || projectIdParam || 1}
                projectName={project?.name}
                projectKey={project?.key}
              />
            </div>
          ) : activeTab === 'history' ? (
            <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
              <ProjectHistoryView
                projectId={project?.id || projectIdParam || 1}
                projectKey={project?.key || ''}
                canEditHistory={isCreator || Boolean(userPermissions?.can_edit_history)}
                canDeleteHistory={isCreator || Boolean(userPermissions?.can_delete_history)}
                onNavigateTask={(taskId) => handleSelectIssue(taskId)}
              />
            </div>
          ) : activeTab === 'settings' ? (
            <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
              <ProjectSettingsView
                project={project}
                members={joinedMembers}
                isCreator={isCreator}
                currentUser={currentUser}
                onOpenDeleteModal={() => {
                  setConfirmDeleteName('');
                  setConfirmDeleteKey('');
                  setIsDeleteProjectModalOpen(true);
                }}
                onOpenLeaveModal={() => {
                  setIsLeaveProjectModalOpen(true);
                }}
                onOpenEditModal={() => {
                  if (project) {
                    setEditName(project.name);
                    setEditDesc(project.description || '');
                    setIsEditProjectModalOpen(true);
                  }
                }}
                onMemberKicked={(userId) => setJoinedMembers((members) => members.filter((member) => String(member.id) !== String(userId)))}
                onMembersUpdated={setJoinedMembers}
              />
            </div>
          ) : (
            /* Tasks Page (5 View Modes: Structure | Board | Timeline | List | Dependencies) */
            <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
              {/* Secondary Task View Mode Segmented Switcher (Structure | Board | Timeline | List | Dependencies) */}
              <div className="px-4 py-2 border-b border-[#222428] bg-[#121316] flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center bg-[#181A1F] p-0.5 rounded-lg border border-[#2A2C30] text-xs">
                  <button
                    onClick={() => handleTaskModeSwitch('structure')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold transition-all ${
                      taskViewMode === 'structure'
                        ? 'bg-[#2A2C30] text-[#DCB001] shadow-sm'
                        : 'text-[#787C83] hover:text-[#CFD4DD]'
                    }`}
                    title="Hierarchical Project Structure & Tree Explorer"
                  >
                    <FolderTree size={12} />
                    <span>Structure</span>
                  </button>

                  <button
                    onClick={() => handleTaskModeSwitch('board')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold transition-all ${
                      taskViewMode === 'board'
                        ? 'bg-[#2A2C30] text-[#DCB001] shadow-sm'
                        : 'text-[#787C83] hover:text-[#CFD4DD]'
                    }`}
                    title="Kanban Board View"
                  >
                    <LayoutGrid size={12} />
                    <span>Board</span>
                  </button>

                  <button
                    onClick={() => handleTaskModeSwitch('timeline')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold transition-all ${
                      taskViewMode === 'timeline'
                        ? 'bg-[#2A2C30] text-[#DCB001] shadow-sm'
                        : 'text-[#787C83] hover:text-[#CFD4DD]'
                    }`}
                    title="Timeline & Calendar View"
                  >
                    <Calendar size={12} />
                    <span>Timeline</span>
                  </button>

                  <button
                    onClick={() => handleTaskModeSwitch('list')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold transition-all ${
                      taskViewMode === 'list'
                        ? 'bg-[#2A2C30] text-[#DCB001] shadow-sm'
                        : 'text-[#787C83] hover:text-[#CFD4DD]'
                    }`}
                    title="Compact List View"
                  >
                    <List size={12} />
                    <span>List</span>
                  </button>

                  <button
                    onClick={() => handleTaskModeSwitch('dependencies')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold transition-all ${
                      taskViewMode === 'dependencies'
                        ? 'bg-[#2A2C30] text-[#DCB001] shadow-sm'
                        : 'text-[#787C83] hover:text-[#CFD4DD]'
                    }`}
                    title="DAG Dependency Graph View"
                  >
                    <GitFork size={12} />
                    <span>Dependencies</span>
                  </button>
                </div>

                <div className="hidden sm:flex items-center gap-2 text-[11px] text-[#787C83] font-mono">
                  <span>{projectIssues.length} tasks</span>
                </div>
              </div>

              {/* Render Active Task View Component */}
              <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
                {taskViewMode === 'board' ? (
                  <KanbanBoardView
                    issues={projectIssues}
                    onSelectIssue={(id) => handleSelectIssue(id)}
                    onUpdateIssueStatus={handleUpdateStatus}
                    onReorderIssues={handleReorderIssues}
                    onUpdateIssuePriority={handleUpdateIssuePriority}
                    onDeleteIssue={handleDeleteIssue}
                    onOpenNewIssue={() => setIsNewIssueModalOpen(true)}
                    onAddNewTaskToColumn={handleAddNewTaskToColumn}
                    canDelete={canDelete}
                  />
                ) : taskViewMode === 'timeline' ? (
                  <CalendarView
                    issues={projectIssues}
                    onSelectIssue={(id) => handleSelectIssue(id)}
                    onOpenNewIssue={() => setIsNewIssueModalOpen(true)}
                  />
                ) : taskViewMode === 'list' ? (
                  <CompactListView
                    issues={projectIssues}
                    onSelectIssue={(id) => handleSelectIssue(id)}
                    onUpdateIssueStatus={handleUpdateStatus}
                    onReorderIssues={handleReorderIssues}
                    onUpdateIssuePriority={handleUpdateIssuePriority}
                    onDeleteIssue={handleDeleteIssue}
                    onOpenNewIssue={() => setIsNewIssueModalOpen(true)}
                    canDelete={canDelete}
                  />
                ) : taskViewMode === 'dependencies' ? (
                  <DependencyGraphView
                    issues={projectIssues}
                    onSelectIssue={(id) => handleSelectIssue(id)}
                    onOpenNewIssue={() => setIsNewIssueModalOpen(true)}
                  />
                ) : (
                  <TreeView
                    issues={projectIssues}
                    projectName={project?.name}
                    projectKey={project?.key}
                    onSelectIssue={(id) => handleSelectIssue(id)}
                    onUpdateIssueStatus={handleUpdateStatus}
                    onUpdateIssuePriority={handleUpdateIssuePriority}
                    onDeleteIssue={handleDeleteIssue}
                    onDeleteFolder={handleDeleteFolder}
                    onOpenNewIssue={() => {
                      setNewIssueModalInitialMode('task');
                      setIsNewIssueModalOpen(true);
                    }}
                    onOpenNewFolder={() => {
                      setNewIssueModalInitialMode('folder');
                      setIsNewIssueModalOpen(true);
                    }}
                    onRenameIssue={handleRenameIssue}
                    onRenameEpic={handleRenameEpic}
                    onMoveTaskToFolder={handleMoveTaskToFolder}
                    onAddTaskToFolder={handleAddTaskToFolder}
                    onReorderTaskInFolder={handleReorderTaskInFolder}
                    canDelete={canDelete}
                  />
                )}
              </div>
            </div>
          )}
        </ErrorBoundary>

        {/* Task Details Modal View Overlay with Close Icon */}
        <AnimatePresence>
          {selectedIssue && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Task Details"
              className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/65 backdrop-blur-sm animate-in fade-in duration-150"
              onClick={(e) => {
                if (e.target === e.currentTarget) handleSelectIssue(null);
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 10 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="bg-[#121316] border border-[#2A2C30] w-full max-w-5xl h-[90vh] max-h-[880px] rounded-2xl shadow-2xl flex flex-col overflow-hidden select-none"
              >
                {/* Task Details View Header Bar */}
                <div className="h-12 px-4 bg-[#17181A] border-b border-[#2A2C30] flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#DCB001]/15 text-[#DCB001] border border-[#DCB001]/30 shrink-0">
                      {getTaskShortId(selectedIssue, issues)}
                    </span>
                    <span className="text-xs font-mono text-[#787C83] bg-[#131415] border border-[#2A2C30] px-1.5 py-0.5 rounded shrink-0 hidden sm:inline">
                      {selectedIssue.key}
                    </span>
                    <span className="text-sm font-semibold text-white truncate max-w-[420px]">
                      {selectedIssue.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {/* Status Dropdown */}
                    <div className="flex items-center gap-1.5 bg-[#131415] border border-[#2A2C30] rounded-lg px-2 py-1">
                      <span className="text-[11px] text-[#787C83] font-mono">Status:</span>
                      <select
                        value={selectedIssue.status}
                        onChange={(e) => handleUpdateStatus(selectedIssue.id, e.target.value as Status)}
                        className="bg-transparent text-xs text-[#DCB001] outline-none cursor-pointer font-semibold capitalize"
                      >
                        <option value="todo" className="bg-[#131415] text-white">Todo</option>
                        <option value="in_progress" className="bg-[#131415] text-white">In Progress</option>
                        <option value="needs_review" className="bg-[#131415] text-white">Needs Review</option>
                        <option value="done" className="bg-[#131415] text-white">Done</option>
                        <option value="blocked" className="bg-[#131415] text-white">Blocked</option>
                        <option value="cancelled" className="bg-[#131415] text-white">Cancelled</option>
                      </select>
                    </div>

                    {/* Close Button with X Icon */}
                    <button
                      onClick={() => handleSelectIssue(null)}
                      className="p-1.5 rounded-lg bg-[#1F2023] hover:bg-[#2A2C30] text-[#9BA1A6] hover:text-white transition-colors border border-[#2A2C30] cursor-pointer flex items-center justify-center"
                      title="Close Task View (Esc)"
                      aria-label="Close Task View"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* Modal Scrollable Body with IssueDetailView */}
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                  <IssueDetailView
                    issue={selectedIssue}
                    allIssues={issues}
                    onSelectIssue={(id) => handleSelectIssue(id)}
                    onUpdateIssue={(updated) =>
                      setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
                    }
                    onOpenDiffModal={() => {}}
                    currentRole={isCreator ? 'owner' : (currentUser?.role || 'member')}
                    canEditDates={canEditDates}
                  />
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* New Issue Modal */}
        {project && isNewIssueModalOpen && (
          <NewIssueModal
            isOpen={isNewIssueModalOpen}
            onClose={() => setIsNewIssueModalOpen(false)}
            onCreateIssue={(created) =>
              setIssues((prev) => reconcileCreatedIssue(prev, created))
            }
            defaultProjectKey={project.key}
            defaultProjectName={project.name}
            defaultProjectId={project.id}
            initialMode={newIssueModalInitialMode}
            allowFolderCreation={activeTab === 'tasks' && taskViewMode === 'structure'}
            isProjectLocked={true}
            currentUser={currentUser}
          />
        )}

        {/* Import Tasks Modal */}
        {project && (
          <ImportTasksModal
            isOpen={isImportTasksModalOpen}
            onClose={() => setIsImportTasksModalOpen(false)}
            projectId={project.id}
            projectName={project.name}
            onImportSuccess={(newlyImported) => setIssues((prev) => [...newlyImported, ...prev])}
          />
        )}



        {/* Real-time Edit Project Modal */}
        <AnimatePresence>
          {isEditProjectModalOpen && project && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md select-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="w-full max-w-md bg-[#1B1C1F] border border-[#2A2C30] rounded-xl shadow-2xl overflow-hidden flex flex-col"
              >
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#2A2C30] bg-[#0F1011]">
                  <h3 className="text-xs font-bold text-[#CFD4DD] uppercase tracking-wider flex items-center gap-2">
                    <Pencil size={15} className="text-[#DCB001]" />
                    Edit Project
                  </h3>
                  <button onClick={() => setIsEditProjectModalOpen(false)} className="text-[#787C83] hover:text-white">
                    <X size={16} />
                  </button>
                </div>

                <form onSubmit={handleSaveProjectEdit} className="p-5 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#CFD4DD] mb-1">
                      Project Name <span className="text-[#C0393B]">*</span>
                    </label>
                    <input
                      type="text"
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full bg-[#131415] border border-[#2A2C30] rounded-lg p-2.5 text-xs text-[#CFD4DD] outline-none focus:border-[#DCB001]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#CFD4DD] mb-1">
                      Description
                    </label>
                    <textarea
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      rows={3}
                      className="w-full bg-[#131415] border border-[#2A2C30] rounded-lg p-2.5 text-xs text-[#CFD4DD] outline-none focus:border-[#DCB001] resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#2A2C30]">
                    <span className="text-[11px] text-[#787C83]">Saves to MySQL DB in real-time</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEditProjectModalOpen(false)}
                        className="px-3.5 py-1.5 text-xs text-[#9499A0] hover:text-white rounded-lg hover:bg-[#222427]"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!editName.trim() || isSavingEdit}
                        className="px-4 py-1.5 text-xs font-semibold text-[#0F1011] bg-[#DCB001] hover:bg-[#c49c00] rounded-lg shadow-sm disabled:opacity-50"
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                </form>
              </motion.div>
            </div>
          )}

          {/* Delete Project Confirmation Modal */}
          {isDeleteProjectModalOpen && project && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="w-full max-w-md bg-[#1B1C1F] border border-[#EF4444]/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
              >
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#2A2C30] bg-[#1A1112]">
                  <h3 className="text-xs font-bold text-[#EF4444] uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle size={16} />
                    Delete Project Confirmation
                  </h3>
                  <button
                    onClick={() => setIsDeleteProjectModalOpen(false)}
                    className="text-[#787C83] hover:text-white"
                  >
                    <X size={16} />
                  </button>
                </div>

                <form onSubmit={handleDeleteProjectConfirmed} className="p-5 space-y-4">
                  <div className="space-y-1.5 text-xs">
                    <p className="text-[#CFD4DD]">
                      Are you sure you want to permanently delete project <strong className="text-white">{project.name}</strong>?
                    </p>
                    <p className="text-[11px] text-[#EF4444]/80">
                      ⚠️ This will permanently remove all tasks, subtasks, channel conversations, docs, and member associations.
                    </p>
                  </div>

                  <div className="p-3 bg-[#131415] rounded-xl border border-[#2A2C30] space-y-3">
                    <div>
                      <label className="block text-[11px] text-[#787C83] mb-1">
                        Type Project Name to confirm: <span className="text-white font-semibold">{project.name}</span>
                      </label>
                      <input
                        type="text"
                        autoFocus
                        value={confirmDeleteName}
                        onChange={(e) => setConfirmDeleteName(e.target.value)}
                        placeholder={project.name}
                        className="w-full bg-[#1A1B1D] border border-[#2A2C30] rounded-lg p-2 text-xs text-[#CFD4DD] outline-none focus:border-[#EF4444]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-[#787C83] mb-1">
                        Type Project Key to confirm: <span className="text-[#DCB001] font-mono text-[10px] font-bold block truncate">{project.key}</span>
                      </label>
                      <input
                        type="text"
                        value={confirmDeleteKey}
                        onChange={(e) => setConfirmDeleteKey(e.target.value)}
                        placeholder="Paste or type project key"
                        className="w-full bg-[#1A1B1D] border border-[#2A2C30] rounded-lg p-2 text-xs text-[#CFD4DD] outline-none focus:border-[#EF4444] font-mono uppercase"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#2A2C30]">
                    <span className="text-[11px] text-[#787C83]">Requires exact match</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsDeleteProjectModalOpen(false)}
                        className="px-3.5 py-1.5 text-xs text-[#9499A0] hover:text-white rounded-lg hover:bg-[#222427]"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={
                          confirmDeleteName.trim() !== project.name ||
                          confirmDeleteKey.trim().toUpperCase() !== project.key.toUpperCase() ||
                          isDeletingProject
                        }
                        className="px-4 py-1.5 text-xs font-semibold text-white bg-[#EF4444] hover:bg-[#DC2626] rounded-lg shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        {isDeletingProject ? 'Deleting...' : 'Permanently Delete'}
                      </button>
                    </div>
                  </div>
                </form>
              </motion.div>
            </div>
          )}

          {/* Leave Project Confirmation Modal (For Joined Members) */}
          {isLeaveProjectModalOpen && project && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="w-full max-w-md bg-[#1B1C1F] border border-[#F97316]/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
              >
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#2A2C30] bg-[#1A1412]">
                  <h3 className="text-xs font-bold text-[#F97316] uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle size={16} />
                    Leave Project Confirmation
                  </h3>
                  <button
                    onClick={() => setIsLeaveProjectModalOpen(false)}
                    className="text-[#787C83] hover:text-white"
                  >
                    <X size={16} />
                  </button>
                </div>

                <form onSubmit={handleLeaveProjectConfirmed} className="p-5 space-y-4">
                  <div className="space-y-2 text-xs">
                    <p className="text-[#CFD4DD]">
                      Are you sure you want to leave <strong className="text-white">{project.name}</strong>?
                    </p>
                    <p className="text-[11px] text-[#A89488] leading-relaxed">
                      You will be removed as a member and this project will no longer appear in your dashboard. You can rejoin at any time using the Project Key.
                    </p>
                  </div>

                  <div className="p-3 bg-[#131415] rounded-xl border border-[#2A2C30] flex items-center gap-2 font-mono text-xs text-[#DCB001]">
                    <span className="text-[#787C83]">Project:</span>
                    <span className="font-bold truncate">{project.name} ({project.key})</span>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#2A2C30]">
                    <span className="text-[11px] text-[#787C83]">Rejoin anytime with key</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsLeaveProjectModalOpen(false)}
                        className="px-3.5 py-1.5 text-xs text-[#9499A0] hover:text-white rounded-lg hover:bg-[#222427]"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isLeavingProject}
                        className="px-4 py-1.5 text-xs font-semibold text-white bg-[#F97316] hover:bg-[#EA580C] rounded-lg shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        {isLeavingProject ? 'Leaving...' : 'Confirm & Leave'}
                      </button>
                    </div>
                  </div>
                </form>
              </motion.div>
            </div>
          )}

          {/* Encrypted Project Export Modal (With Loading Progress & Download Button) */}
          {isExportModalOpen && (



            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="w-full max-w-lg bg-[#181A1D] border border-[#2A2C30] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#2A2C30] bg-[#111215]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#DCB001]/15 text-[#DCB001] flex items-center justify-center font-bold">
                      <Lock size={16} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white tracking-tight">Export Project Package</h3>
                      <p className="text-[11px] font-mono text-[#787C83]">AES-256-GCM Military Grade Encrypted Dump</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsExportModalOpen(false)}
                    className="text-[#787C83] hover:text-white transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Body Content */}
                <div className="p-6 space-y-5">
                  {/* File Target Info */}
                  <div className="p-3.5 rounded-xl bg-[#111214] border border-[#24262B] flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-[#DCB001]/10 border border-[#DCB001]/30 flex items-center justify-center text-[#DCB001] shrink-0">
                        <FileText size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white font-mono truncate">{exportFileName}</p>
                        <p className="text-[10px] text-[#787C83] font-mono">
                          {exportFileSize ? `Size: ${exportFileSize} • ` : ''}Format: .teaderdumpfile
                        </p>
                      </div>
                    </div>

                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30 shrink-0">
                      Encrypted
                    </span>
                  </div>

                  {/* Progress Bar & Status Text */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-[#9BA1A6] flex items-center gap-1.5">
                        {exportStep !== 'ready' && <Loader2 size={13} className="animate-spin text-[#DCB001]" />}
                        {exportStep === 'ready' && <CheckCircle2 size={14} className="text-[#22C55E]" />}
                        <span>{exportStatusText}</span>
                      </span>
                      <span className="text-[#DCB001] font-bold">{exportProgress}%</span>
                    </div>

                    {/* Animated Progress Bar */}
                    <div className="w-full h-2 bg-[#101113] rounded-full overflow-hidden border border-[#2A2C30]">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${exportProgress}%` }}
                        transition={{ duration: 0.3 }}
                        className={`h-full rounded-full ${
                          exportStep === 'ready' ? 'bg-[#22C55E]' : 'bg-[#DCB001]'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Feature Checklist inside dump */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-[#8E939D] pt-1">
                    <div className="flex items-center gap-1.5">
                      <Check size={12} className="text-[#22C55E]" />
                      <span>{projectIssues.length} Tasks & Subtasks</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check size={12} className="text-[#22C55E]" />
                      <span>Technical .md Docs</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check size={12} className="text-[#22C55E]" />
                      <span>Dependency DAG Branches</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check size={12} className="text-[#22C55E]" />
                      <span>SHA-256 Checksum Verified</span>
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 border-t border-[#2A2C30] bg-[#111215] flex items-center justify-between">
                  <button
                    onClick={() => setIsExportModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-[#9BA1A6] hover:text-white rounded-xl transition-colors"
                  >
                    Close
                  </button>

                  <button
                    onClick={handleTriggerDownload}
                    disabled={exportStep !== 'ready' || !exportBlobUrl}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#DCB001] hover:bg-[#E5B800] text-[#0A0B0D] font-bold text-xs transition-all shadow-[0_0_20px_rgba(220,176,1,0.3)] disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02]"
                  >
                    <Download size={15} className="stroke-[2.5]" />
                    <span>Download Teader Dump File</span>
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Global Slide-Over Conversation Drawer (Available across all 4 project pages) */}
        <ConversationDrawer
          projectId={project?.id || projectIdParam || 1}
          projectName={project?.name}
          projectKey={project?.key}
          currentUser={currentUser}
          isOpen={isChatOpen}
          onOpenChange={setIsChatOpen}
        />
      </div>
      )}
    </AppLayout>
    </>
  );
}

