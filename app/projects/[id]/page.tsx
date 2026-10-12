'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { AppLayout } from '@/components/AppLayout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ViewLoadingFallback } from '@/components/ui/Skeleton';
import { Issue, Status, Priority, MemberPermissions } from '@/lib/types';
import { getLocalCache, setLocalCache, reconcileIssues } from '@/lib/client-cache';
import { reconcileCreatedIssue } from '@/lib/reconcileIssue';
import { useRealtimeSubscription, RealtimeEvent } from '@/lib/useRealtime';
import { RealtimeBadge } from '@/components/RealtimeBadge';



import { Avatar } from '@/components/ui/Avatar';
import { CustomDropdown } from '@/components/ui/CustomDropdown';
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
  Settings,
  Workflow,
  Radio,
  AppWindow,
  Blocks,
  MoreHorizontal,
  LogOut
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
const ProjectChartsView = dynamic(
  () => import('@/components/ProjectChartsView').then((m) => ({ default: m.ProjectChartsView })),
  { ssr: false, loading: () => <ViewLoadingFallback /> }
);
const ProjectMeetingView = dynamic(
  () => import('@/components/ProjectMeetingView').then((m) => ({ default: m.ProjectMeetingView })),
  { ssr: false, loading: () => <ViewLoadingFallback /> }
);
const ConversationDrawer = dynamic(
  () => import('@/components/ConversationDrawer').then((m) => ({ default: m.ConversationDrawer })),
  { ssr: false }
);
const ProjectConversationView = dynamic(
  () => import('@/components/ProjectConversationView').then((m) => ({ default: m.ProjectConversationView })),
  { ssr: false, loading: () => <ViewLoadingFallback /> }
);
const ProjectAppsView = dynamic(
  () => import('@/components/ProjectAppsView').then((m) => ({ default: m.ProjectAppsView })),
  { ssr: false, loading: () => <ViewLoadingFallback /> }
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
const ProjectPluginsView = dynamic(
  () => import('@/components/ProjectPluginsView').then((m) => ({ default: m.ProjectPluginsView })),
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
const AutomationsModal = dynamic(
  () => import('@/components/AutomationsModal').then((m) => ({ default: m.AutomationsModal })),
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

export type ProjectTab = 'overview' | 'tasks' | 'docs' | 'charts' | 'meeting' | 'chats' | 'apps' | 'history' | 'settings' | 'plugins';
export type TaskViewMode = 'structure' | 'board' | 'timeline' | 'list' | 'dependencies';

function parseViewTab(view?: string): ProjectTab {
  if (!view) return 'overview';
  const v = String(view).toLowerCase();
  if (v === 'meeting' || v === 'call' || v === 'audio' || v === 'voice' || v === 'conference' || v === 'huddle') return 'meeting';
  if (v === 'chats' || v === 'chat' || v === 'conversation' || v === 'conversations' || v === 'messages' || v === 'discuss') return 'chats';
  if (v === 'apps' || v === 'app' || v === 'tools' || v === 'integrations' || v === 'store' || v === 'widgets') return 'apps';
  if (v === 'charts' || v === 'diagram' || v === 'diagrams' || v === 'canvas' || v === 'flow' || v === 'whiteboard') return 'charts';
  if (v === 'overview' || v === 'analytics' || v === 'insights' || v === 'stats') return 'overview';
  if (v === 'docs' || v === 'wiki' || v === 'spec') return 'docs';
  if (v === 'history' || v === 'audit' || v === 'log' || v === 'changelog') return 'history';
  if (v === 'plugins' || v === 'plugin' || v === 'addons' || v === 'extensions') return 'plugins';
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
  const [docsSubView, setDocsSubView] = useState<'docs' | 'charts'>('docs');
  const [settingsSubView, setSettingsSubView] = useState<'general' | 'apps' | 'plugins'>('general');
  const [overviewSubView, setOverviewSubView] = useState<'summary' | 'activity'>('summary');
  const [isAutomationsModalOpen, setIsAutomationsModalOpen] = useState(false);
  const [taskFilterSearch, setTaskFilterSearch] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(
    () =>
      searchParams?.get('chat') === 'open' ||
      viewParam === 'conversation' ||
      viewParam === 'chat' ||
      viewParam === 'messages'
  );
  const [isInMeeting, setIsInMeeting] = useState<boolean>(
    () => parseViewTab(viewParam) === 'meeting'
  );

  useEffect(() => {
    if (activeTab === 'meeting') {
      setIsInMeeting(true);
    }
  }, [activeTab]);

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
      setActiveTab('chats');
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

  // Keyboard shortcut V to cycle task view modes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isEditable =
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        (e.target as HTMLElement)?.isContentEditable;
      if (isEditable) return;

      if (e.key === '1' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        handleTabSwitch('overview');
      } else if (e.key === '2' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        handleTabSwitch('tasks');
      } else if (e.key === '3' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        handleTabSwitch('docs');
      } else if (e.key === '4' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        handleTabSwitch('charts');
      } else if (e.key === '5' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        handleTabSwitch('chats');
      } else if (e.key === '6' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        handleTabSwitch('meeting');
      } else if (e.key === '7' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        handleTabSwitch('history');
      } else if (e.key === '8' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        handleTabSwitch('settings');
      } else if (e.key.toLowerCase() === 'v' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (activeTab === 'tasks') {
          e.preventDefault();
          const modes: TaskViewMode[] = ['board', 'list', 'structure', 'timeline', 'dependencies'];
          const nextIdx = (modes.indexOf(taskViewMode) + 1) % modes.length;
          handleTaskModeSwitch(modes[nextIdx]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, taskViewMode, handleTaskModeSwitch, handleTabSwitch]);

  useEffect(() => {
    const handleSwitchTabEvent = (e: any) => {
      if (e.detail === 'meeting') {
        setIsInMeeting(true);
        handleTabSwitch('meeting');
      } else if (e.detail) {
        handleTabSwitch(e.detail);
      }
    };
    window.addEventListener('teader_switch_project_tab', handleSwitchTabEvent);
    return () => window.removeEventListener('teader_switch_project_tab', handleSwitchTabEvent);
  }, [handleTabSwitch]);

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

  const isFetchingRef = useRef(false);

  // Real-time Fetching & User Session
  const fetchProjectData = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const timeoutSignal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
        ? AbortSignal.timeout(6000)
        : undefined;

      // Step 1: Verify User Session
      let sessionUser: any = null;
      const meRes = await fetch('/api/auth/me', { signal: timeoutSignal }).catch(() => null);
      if (meRes && meRes.ok) {
        const meData = await meRes.json().catch(() => null);
        if (meData?.user) {
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
      const [projRes, issueRes] = await Promise.all([
        fetch('/api/projects', { cache: 'no-store', signal: timeoutSignal }).catch(() => null),
        fetch('/api/issues', { cache: 'no-store', signal: timeoutSignal }).catch(() => null),
      ]);

      if (projRes?.status === 401 || issueRes?.status === 401) {
        router.push('/login');
        return;
      }

      let foundProj: ProjectItem | null = null;
      if (projRes && projRes.ok) {
        const projData = await projRes.json().catch(() => null);
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
        setLoading(false);
        return;
      }

      // Register project in session memory
      initializedProjects.add(String(projectIdParam).toLowerCase());
      if (foundProj.key) initializedProjects.add(foundProj.key.toLowerCase());
      if (foundProj.id) initializedProjects.add(String(foundProj.id).toLowerCase());

      // Step 3: Load Architecture, Members, and Issues
      if (foundProj && foundProj.id) {
        const [memRes, permRes] = await Promise.all([
          fetch(`/api/projects/${foundProj.id}/members`, { cache: 'no-store', signal: timeoutSignal }).catch(() => null),
          fetch(`/api/projects/${foundProj.id}/permissions`, { cache: 'no-store', signal: timeoutSignal }).catch(() => null),
        ]);

        if (memRes && memRes.ok) {
          const memData = await memRes.json().catch(() => null);
          if (Array.isArray(memData)) setJoinedMembers(memData);
        }

        if (permRes && permRes.ok) {
          const permData = await permRes.json().catch(() => null);
          if (Array.isArray(permData) && sessionUser) {
            const myPerm = permData.find((p: any) => String(p.userId) === String(sessionUser.id));
            if (myPerm) setUserPermissions(myPerm);
          }
        }
      }

      if (issueRes && issueRes.ok) {
        const issueData = await issueRes.json().catch(() => null);
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

    } catch (err) {
      console.error('Error loading project:', err);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [projectIdParam, router]);

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

  const canCompleteTasks = useMemo(() => {
    if (isCreator) return true;
    if (currentUser?.role === 'admin' || currentUser?.role === 'owner') return true;
    return Boolean(userPermissions?.can_complete_tasks);
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

  const filteredProjectIssues = useMemo(() => {
    if (!taskFilterSearch.trim()) return projectIssues;
    const q = taskFilterSearch.toLowerCase();
    return projectIssues.filter(
      (i) =>
        (i.title && i.title.toLowerCase().includes(q)) ||
        (i.key && i.key.toLowerCase().includes(q))
    );
  }, [projectIssues, taskFilterSearch]);

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

    if (newStatus === 'done' && !canCompleteTasks) {
      toast.error('Permission Denied: You do not have permission to move tasks to Complete / Done.');
      return;
    }

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

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to update DB');
      }
      toast.success(
        isDone
          ? `Task marked as completed by ${currentUserName}`
          : `Updated status to ${newStatus.replace('_', ' ')}`
      );
    } catch (err: any) {
      toast.error(err.message || 'Error updating status in database');
      setIssues(previousIssues);
    }
  }, [issues, currentUser, canCompleteTasks]);

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
    <AppLayout>

      {/* If still loading initial project data, show simple centered spinner inside content */}
      {loading && !project ? (
        <div className="flex-1 flex items-center justify-center h-full p-6 bg-[var(--bg-canvas)]">
          <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        </div>
      ) : !project ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 bg-[var(--bg-canvas)] text-[var(--text-secondary)]">
          <div className="w-14 h-14 rounded-2xl bg-[var(--ramp-3)]/10 border border-[var(--border-secondary)] flex items-center justify-center text-white">
            <Lock size={28} />
          </div>
          <h2 className="text-lg font-bold text-white">Access Denied or Project Not Found</h2>
          <p className="text-xs text-[var(--text-muted)] max-w-md">
            You do not have access to this project. Only project owners and joined members can access this workspace.
          </p>
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => router.push('/projects')}
              className="px-4 py-2 bg-white text-black text-xs font-bold rounded-xl hover:bg-[#FFFFFF] transition-colors"
            >
              Back to My Projects
            </button>
          </div>
        </div>
      ) : project?.joinStatus === 'pending' ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 bg-[var(--bg-canvas)] text-[var(--text-secondary)]">
          <div className="w-14 h-14 rounded-2xl bg-white/10 border border-[var(--border-secondary)] flex items-center justify-center text-white">
            <Clock size={28} />
          </div>
          <h2 className="text-lg font-bold text-white">Joining Request Pending Approval</h2>
          <p className="text-xs text-[var(--text-muted)] max-w-md">
            Your request to join <span className="text-[var(--text-secondary)] font-semibold">{project.name}</span> has been sent to the project owner. You will get workspace access once it is approved.
          </p>
          <div className="flex items-center gap-3 pt-2">
            <button onClick={() => router.push('/projects')} className="px-4 py-2 border border-[var(--border-primary)] text-[var(--text-secondary)] text-xs font-bold rounded-xl hover:bg-[var(--bg-panel)] transition-colors cursor-pointer">Back to My Projects</button>
            <button onClick={handleCancelJoinRequest} className="px-4 py-2 bg-[#242424] hover:bg-[#2E2E2E] text-white border border-[var(--border-secondary)] text-xs font-bold rounded-xl transition-colors cursor-pointer">Cancel Request</button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden overscroll-none bg-[var(--bg-canvas)] text-[var(--text-secondary)] font-sans">

        {/* 2. 4 Primary Tabs Bar (Overview, Tasks, Docs, Settings) + Sub-views / Tasks Toolbar */}
        <div className="h-10 px-4 bg-[var(--bg-canvas)] border-b border-[var(--border-primary)] flex items-center justify-between shrink-0 select-none gap-3">
          {/* Left: 4 Primary Tabs */}
          <div className="flex items-center gap-2 h-full">
            <button
              onClick={() => handleTabSwitch('overview')}
              className={`px-3 h-full flex items-center text-xs transition-colors relative ${
                activeTab === 'overview'
                  ? 'text-white font-medium after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-white'
                  : 'text-[var(--text-secondary)] hover:text-white'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => handleTabSwitch('tasks')}
              className={`flex items-center gap-1.5 px-3 h-full text-xs transition-colors relative ${
                activeTab === 'tasks'
                  ? 'text-white font-medium after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-white'
                  : 'text-[var(--text-secondary)] hover:text-white'
              }`}
            >
              <span>Tasks</span>
              <span className="font-mono text-[10px] text-[var(--text-muted)]">({projectIssues.length})</span>
            </button>
            <button
              onClick={() => handleTabSwitch('docs')}
              className={`px-3 h-full flex items-center text-xs transition-colors relative ${
                activeTab === 'docs'
                  ? 'text-white font-medium after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-white'
                  : 'text-[var(--text-secondary)] hover:text-white'
              }`}
            >
              Docs
            </button>
            <button
              onClick={() => handleTabSwitch('charts')}
              className={`px-3 h-full flex items-center text-xs transition-colors relative ${
                activeTab === 'charts'
                  ? 'text-white font-medium after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-white'
                  : 'text-[var(--text-secondary)] hover:text-white'
              }`}
            >
              Charts
            </button>
            <button
              onClick={() => handleTabSwitch('chats')}
              className={`px-3 h-full flex items-center text-xs transition-colors relative ${
                activeTab === 'chats'
                  ? 'text-white font-medium after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-white'
                  : 'text-[var(--text-secondary)] hover:text-white'
              }`}
            >
              Conversations
            </button>
            <button
              onClick={() => handleTabSwitch('meeting')}
              className={`px-3 h-full flex items-center text-xs transition-colors relative ${
                activeTab === 'meeting'
                  ? 'text-white font-medium after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-white'
                  : 'text-[var(--text-secondary)] hover:text-white'
              }`}
            >
              Meetings
            </button>
            <button
              onClick={() => handleTabSwitch('history')}
              className={`px-3 h-full flex items-center text-xs transition-colors relative ${
                activeTab === 'history'
                  ? 'text-white font-medium after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-white'
                  : 'text-[var(--text-secondary)] hover:text-white'
              }`}
            >
              History
            </button>
            <button
              onClick={() => handleTabSwitch('settings')}
              className={`px-3 h-full flex items-center text-xs transition-colors relative ${
                activeTab === 'settings'
                  ? 'text-white font-medium after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-white'
                  : 'text-[var(--text-secondary)] hover:text-white'
              }`}
            >
              Settings
            </button>
          </div>

          {/* Right: Contextual Toolbar depending on activeTab */}
          {activeTab === 'tasks' && (
            <div className="flex items-center gap-2">
              {/* Single View Mode Dropdown Button */}
              <CustomDropdown<TaskViewMode>
                value={taskViewMode}
                onChange={(mode) => handleTaskModeSwitch(mode)}
                options={[
                  { value: 'board', label: 'Board', icon: <LayoutGrid size={13} /> },
                  { value: 'list', label: 'List', icon: <List size={13} /> },
                  { value: 'structure', label: 'Tree Structure', icon: <FolderTree size={13} /> },
                  { value: 'timeline', label: 'Timeline & Calendar', icon: <Calendar size={13} /> },
                  { value: 'dependencies', label: 'Dependency Graph', icon: <GitFork size={13} /> },
                ]}
                renderTrigger={(selected) => (
                  <button
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[var(--ramp-1)] hover:bg-[var(--ramp-2)] border border-[var(--border-primary)] text-xs text-white transition-colors"
                    title="Change Task View Mode (V)"
                  >
                    {selected?.icon}
                    <span>{selected?.label || 'Board'}</span>
                  </button>
                )}
                size="sm"
                align="right"
              />

              {/* Task Search Filter */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter tasks... (V to cycle)"
                  value={taskFilterSearch}
                  onChange={(e) => setTaskFilterSearch(e.target.value)}
                  className="w-36 sm:w-44 px-2.5 py-1 bg-[var(--ramp-1)] hover:bg-[var(--ramp-2)] focus:bg-[var(--ramp-2)] border border-[var(--border-primary)] focus:border-[var(--border-secondary)] rounded text-xs text-white placeholder-[var(--text-muted)] outline-none transition-colors"
                />
                {taskFilterSearch && (
                  <button
                    onClick={() => setTaskFilterSearch('')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-white"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setOverviewSubView('summary')}
                className={`px-2.5 py-0.5 text-xs rounded transition-colors ${
                  overviewSubView === 'summary'
                    ? 'bg-[var(--ramp-2)] text-white font-medium border border-[var(--border-primary)]'
                    : 'text-[var(--text-muted)] hover:text-white'
                }`}
              >
                Summary
              </button>
              <button
                onClick={() => setOverviewSubView('activity')}
                className={`px-2.5 py-0.5 text-xs rounded transition-colors ${
                  overviewSubView === 'activity'
                    ? 'bg-[var(--ramp-2)] text-white font-medium border border-[var(--border-primary)]'
                    : 'text-[var(--text-muted)] hover:text-white'
                }`}
              >
                Activity
              </button>
              <button
                onClick={() => handleTabSwitch('meeting')}
                className="flex items-center gap-1 px-2.5 py-0.5 text-xs text-[var(--text-muted)] hover:text-white rounded hover:bg-[var(--ramp-1)] transition-colors"
              >
                <Radio size={11} />
                <span>Meeting</span>
              </button>
              <button
                onClick={() => setIsChatOpen((prev) => !prev)}
                className="flex items-center gap-1 px-2.5 py-0.5 text-xs text-[var(--text-muted)] hover:text-white rounded hover:bg-[var(--ramp-1)] transition-colors"
              >
                <MessageSquare size={11} />
                <span>Chat</span>
              </button>
            </div>
          )}

          {activeTab === 'docs' && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setDocsSubView('docs')}
                className={`px-2.5 py-0.5 text-xs rounded transition-colors ${
                  docsSubView === 'docs'
                    ? 'bg-[var(--ramp-2)] text-white font-medium border border-[var(--border-primary)]'
                    : 'text-[var(--text-muted)] hover:text-white'
                }`}
              >
                Docs
              </button>
              <button
                onClick={() => setDocsSubView('charts')}
                className={`px-2.5 py-0.5 text-xs rounded transition-colors ${
                  docsSubView === 'charts'
                    ? 'bg-[var(--ramp-2)] text-white font-medium border border-[var(--border-primary)]'
                    : 'text-[var(--text-muted)] hover:text-white'
                }`}
              >
                Charts
              </button>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSettingsSubView('general')}
                className={`px-2.5 py-0.5 text-xs rounded transition-colors ${
                  settingsSubView === 'general'
                    ? 'bg-[var(--ramp-2)] text-white font-medium border border-[var(--border-primary)]'
                    : 'text-[var(--text-muted)] hover:text-white'
                }`}
              >
                General
              </button>
              <button
                onClick={() => setSettingsSubView('apps')}
                className={`px-2.5 py-0.5 text-xs rounded transition-colors ${
                  settingsSubView === 'apps'
                    ? 'bg-[var(--ramp-2)] text-white font-medium border border-[var(--border-primary)]'
                    : 'text-[var(--text-muted)] hover:text-white'
                }`}
              >
                Apps & Integrations
              </button>
              <button
                onClick={() => setSettingsSubView('plugins')}
                className={`px-2.5 py-0.5 text-xs rounded transition-colors ${
                  settingsSubView === 'plugins'
                    ? 'bg-[var(--ramp-2)] text-white font-medium border border-[var(--border-primary)]'
                    : 'text-[var(--text-muted)] hover:text-white'
                }`}
              >
                Plugins
              </button>
              <button
                onClick={() => setIsAutomationsModalOpen(true)}
                className="flex items-center gap-1 px-2.5 py-0.5 text-xs text-[var(--text-muted)] hover:text-white rounded hover:bg-[var(--ramp-1)] transition-colors"
              >
                <Zap size={11} />
                <span>Automations</span>
              </button>
            </div>
          )}
        </div>

        {/* Workspace Content Area */}
        <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden relative">
          <ErrorBoundary>
            {activeTab === 'overview' ? (
              overviewSubView === 'activity' ? (
                <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
                  <ProjectHistoryView
                    projectId={project?.id || projectIdParam || 1}
                    projectKey={project?.key || ''}
                    canEditHistory={isCreator || Boolean(userPermissions?.can_edit_history)}
                    canDeleteHistory={isCreator || Boolean(userPermissions?.can_delete_history)}
                    onNavigateTask={(taskId) => handleSelectIssue(taskId)}
                  />
                </div>
              ) : (
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
              )
            ) : activeTab === 'docs' ? (
              docsSubView === 'charts' ? (
                <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden overscroll-none">
                  <ProjectChartsView
                    projectId={project?.id || projectIdParam || 1}
                    projectName={project?.name}
                    projectKey={project?.key}
                  />
                </div>
              ) : (
                <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
                  <ProjectDocsView
                    projectId={project?.id || projectIdParam || 1}
                    projectName={project?.name}
                    projectKey={project?.key}
                  />
                </div>
              )
            ) : activeTab === 'charts' ? (
              <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden overscroll-none">
                <ProjectChartsView
                  projectId={project?.id || projectIdParam || 1}
                  projectName={project?.name}
                  projectKey={project?.key}
                />
              </div>
            ) : activeTab === 'meeting' ? (
              <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
                <ProjectMeetingView
                  projectId={project?.id || projectIdParam || 1}
                  projectName={project?.name || ''}
                  currentUser={currentUser}
                />
              </div>
            ) : activeTab === 'chats' ? (
              <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
                <ProjectConversationView
                  projectId={project?.id || projectIdParam || 1}
                  projectName={project?.name}
                  projectKey={project?.key}
                  currentUser={currentUser}
                />
              </div>
            ) : activeTab === 'apps' ? (
              <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
                <ProjectAppsView
                  projectId={project?.id || projectIdParam || 1}
                  projectName={project?.name}
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
                {settingsSubView === 'apps' ? (
                  <ProjectAppsView
                    projectId={project?.id || projectIdParam || 1}
                    projectName={project?.name}
                  />
                ) : settingsSubView === 'plugins' ? (
                  <ProjectPluginsView
                    projectId={project?.id || projectIdParam || 1}
                    projectName={project?.name}
                    projectKey={project?.key}
                  />
                ) : (
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
                )}
              </div>
            ) : activeTab === 'plugins' ? (
              <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
                <ProjectPluginsView
                  projectId={project?.id || projectIdParam || 1}
                  projectName={project?.name}
                  projectKey={project?.key}
                />
              </div>
            ) : (
              /* Tasks Page */
              <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">

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
                    canCompleteTasks={canCompleteTasks}
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
                    canCompleteTasks={canCompleteTasks}
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
                    canCompleteTasks={canCompleteTasks}
                  />
                )}
              </div>
            </div>
          )}
        </ErrorBoundary>

        {/* Persistent Meeting View: Full view when activeTab === 'meeting', Draggable Miniscreen PiP when on other tabs */}
        {isInMeeting && (
          <ProjectMeetingView
            projectId={project?.id || projectIdParam || 1}
            projectName={project?.name || 'Project'}
            currentUser={currentUser}
            isMini={activeTab !== 'meeting'}
            onMinimizeMeeting={() => handleTabSwitch('overview')}
            onExpandMeeting={() => handleTabSwitch('meeting')}
            onLeaveMeeting={() => {
              setIsInMeeting(false);
              if (activeTab === 'meeting') handleTabSwitch('overview');
            }}
          />
        )}
      </div>

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
                className="bg-[var(--bg-panel)] border border-[var(--border-primary)] w-full max-w-5xl h-[90vh] max-h-[880px] rounded-2xl shadow-2xl flex flex-col overflow-hidden select-none"
              >
                {/* Task Details View Header Bar */}
                <div className="h-12 px-4 bg-[var(--bg-panel)] border-b border-[var(--border-primary)] flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-sm font-mono font-bold px-2 py-0.5 rounded bg-white/15 text-white border border-[var(--border-secondary)] shrink-0">
                      {getTaskShortId(selectedIssue, issues)}
                    </span>
                    <span className="text-sm font-mono text-[var(--text-secondary)] bg-[var(--bg-canvas)] border border-[var(--border-primary)] px-1.5 py-0.5 rounded shrink-0 hidden sm:inline">
                      {selectedIssue.key}
                    </span>
                    <span className="text-sm font-semibold text-white truncate max-w-[420px]">
                      {selectedIssue.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {/* Status Dropdown */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-[var(--text-secondary)] font-mono">Status:</span>
                      <CustomDropdown<Status>
                        value={selectedIssue.status}
                        onChange={(val) => handleUpdateStatus(selectedIssue.id, val)}
                        options={[
                          { value: 'todo', label: 'Todo' },
                          { value: 'in_progress', label: 'In Progress' },
                          { value: 'needs_review', label: 'Needs Review' },
                          {
                            value: 'done',
                            label: `Done ${!canCompleteTasks ? '(No Access)' : ''}`,
                            disabled: !canCompleteTasks,
                          },
                          { value: 'blocked', label: 'Blocked' },
                          { value: 'cancelled', label: 'Cancelled' },
                        ]}
                        triggerClassName="bg-[var(--bg-canvas)] border border-[var(--border-primary)] rounded-lg px-2.5 py-1 text-xs text-white font-semibold hover:border-[var(--border-secondary)]"
                        size="xs"
                      />
                    </div>

                    {/* Close Button with X Icon */}
                    <button
                      onClick={() => handleSelectIssue(null)}
                      className="p-1.5 rounded-lg bg-[#212121] hover:bg-[#222222] text-[var(--text-secondary)] hover:text-white transition-colors border border-[var(--border-primary)] cursor-pointer flex items-center justify-center"
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
                    canCompleteTasks={canCompleteTasks}
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

        {/* Automations Modal */}
        {project && (
          <AutomationsModal
            isOpen={isAutomationsModalOpen}
            onClose={() => setIsAutomationsModalOpen(false)}
            projectId={project.id}
            projectName={project.name}
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
                className="w-full max-w-md bg-[var(--bg-panel)] border border-[var(--border-primary)] rounded-xl shadow-2xl overflow-hidden flex flex-col"
              >
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-primary)] bg-[var(--bg-canvas)]">
                  <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-2">
                    <Pencil size={15} className="text-white" />
                    Edit Project
                  </h3>
                  <button onClick={() => setIsEditProjectModalOpen(false)} className="text-[var(--text-secondary)] hover:text-white">
                    <X size={16} />
                  </button>
                </div>

                <form onSubmit={handleSaveProjectEdit} className="p-5 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-1">
                      Project Name <span className="text-[#FFFFFF]">*</span>
                    </label>
                    <input
                      type="text"
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full bg-[var(--bg-canvas)] border border-[var(--border-primary)] rounded-lg p-3 text-sm text-[var(--text-secondary)] outline-none focus:border-[var(--border-secondary)]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-1">
                      Description
                    </label>
                    <textarea
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      rows={3}
                      className="w-full bg-[var(--bg-canvas)] border border-[var(--border-primary)] rounded-lg p-3 text-sm text-[var(--text-secondary)] outline-none focus:border-[var(--border-secondary)] resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[var(--border-primary)]">
                    <span className="text-xs text-[var(--text-secondary)]">Saves to MySQL DB in real-time</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEditProjectModalOpen(false)}
                        className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-white rounded-lg hover:bg-[#242424]"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!editName.trim() || isSavingEdit}
                        className="px-4 py-2 text-sm font-semibold bg-white text-black hover:bg-[#FFFFFF] rounded-lg shadow-sm disabled:opacity-50"
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
                className="w-full max-w-md bg-[var(--bg-panel)] border border-[var(--border-secondary)] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
              >
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-primary)] bg-[#141414]">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle size={16} />
                    Delete Project Confirmation
                  </h3>
                  <button
                    onClick={() => setIsDeleteProjectModalOpen(false)}
                    className="text-[var(--text-secondary)] hover:text-white"
                  >
                    <X size={16} />
                  </button>
                </div>

                <form onSubmit={handleDeleteProjectConfirmed} className="p-5 space-y-4">
                  <div className="space-y-1.5 text-sm">
                    <p className="text-[var(--text-secondary)]">
                      Are you sure you want to permanently delete project <strong className="text-white">{project.name}</strong>?
                    </p>
                    <p className="text-xs text-white/80">
                      ⚠️ This will permanently remove all tasks, subtasks, channel conversations, docs, and member associations.
                    </p>
                  </div>

                  <div className="p-3 bg-[var(--bg-canvas)] rounded-xl border border-[var(--border-primary)] space-y-3">
                    <div>
                      <label className="block text-xs text-[var(--text-secondary)] mb-1">
                        Type Project Name to confirm: <span className="text-white font-semibold">{project.name}</span>
                      </label>
                      <input
                        type="text"
                        autoFocus
                        value={confirmDeleteName}
                        onChange={(e) => setConfirmDeleteName(e.target.value)}
                        placeholder={project.name}
                        className="w-full bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg p-3 text-sm text-[var(--text-secondary)] outline-none focus:border-[var(--border-secondary)]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-[var(--text-secondary)] mb-1">
                        Type Project Key to confirm: <span className="text-white font-mono text-[10px] font-bold block truncate">{project.key}</span>
                      </label>
                      <input
                        type="text"
                        value={confirmDeleteKey}
                        onChange={(e) => setConfirmDeleteKey(e.target.value)}
                        placeholder="Paste or type project key"
                        className="w-full bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg p-3 text-sm text-[var(--text-secondary)] outline-none focus:border-[var(--border-secondary)] font-mono uppercase"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[var(--border-primary)]">
                    <span className="text-xs text-[var(--text-secondary)]">Requires exact match</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsDeleteProjectModalOpen(false)}
                        className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-white rounded-lg hover:bg-[#242424]"
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
                        className="px-4 py-2 text-sm font-semibold text-white bg-[#242424] hover:bg-[#2E2E2E] border border-[var(--border-secondary)] rounded-lg shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
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
                className="w-full max-w-md bg-[var(--bg-panel)] border border-[#FFFFFF]/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
              >
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-primary)] bg-[#151515]">
                  <h3 className="text-sm font-bold text-[#FFFFFF] uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle size={16} />
                    Leave Project Confirmation
                  </h3>
                  <button
                    onClick={() => setIsLeaveProjectModalOpen(false)}
                    className="text-[var(--text-secondary)] hover:text-white"
                  >
                    <X size={16} />
                  </button>
                </div>

                <form onSubmit={handleLeaveProjectConfirmed} className="p-5 space-y-4">
                  <div className="space-y-2 text-sm">
                    <p className="text-[var(--text-secondary)]">
                      Are you sure you want to leave <strong className="text-white">{project.name}</strong>?
                    </p>
                    <p className="text-xs text-[#979797] leading-relaxed">
                      You will be removed as a member and this project will no longer appear in your dashboard. You can rejoin at any time using the Project Key.
                    </p>
                  </div>

                  <div className="p-3 bg-[var(--bg-canvas)] rounded-xl border border-[var(--border-primary)] flex items-center gap-2 font-mono text-sm text-white">
                    <span className="text-[var(--text-secondary)]">Project:</span>
                    <span className="font-bold truncate">{project.name} ({project.key})</span>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[var(--border-primary)]">
                    <span className="text-xs text-[var(--text-secondary)]">Rejoin anytime with key</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsLeaveProjectModalOpen(false)}
                        className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-white rounded-lg hover:bg-[#242424] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isLeavingProject}
                        className="px-4 py-2 text-sm font-semibold text-white bg-[#242424] hover:bg-[#2E2E2E] border border-[var(--border-secondary)] rounded-lg shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
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
                className="w-full max-w-lg bg-[#1A1A1A] border border-[var(--border-primary)] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)] bg-[#141414]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white/15 text-white flex items-center justify-center font-bold">
                      <Lock size={16} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white tracking-tight">Export Project Package</h3>
                      <p className="text-xs font-mono text-[var(--text-secondary)]">AES-256-GCM Military Grade Encrypted Dump</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsExportModalOpen(false)}
                    className="text-[var(--text-secondary)] hover:text-white transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Body Content */}
                <div className="p-6 space-y-5">
                  {/* File Target Info */}
                  <div className="p-3.5 rounded-xl bg-[#121212] border border-[#272727] flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-white/10 border border-[var(--border-secondary)] flex items-center justify-center text-white shrink-0">
                        <FileText size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white font-mono truncate">{exportFileName}</p>
                        <p className="text-xs text-[var(--text-secondary)] font-mono">
                          {exportFileSize ? `Size: ${exportFileSize} • ` : ''}Format: .teaderdumpfile
                        </p>
                      </div>
                    </div>

                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-[var(--ramp-3)]/15 text-white border border-[var(--border-secondary)] shrink-0">
                      Encrypted
                    </span>
                  </div>

                  {/* Progress Bar & Status Text */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-[var(--text-secondary)] flex items-center gap-1.5">
                        {exportStep !== 'ready' && <Loader2 size={13} className="animate-spin text-white" />}
                        {exportStep === 'ready' && <CheckCircle2 size={14} className="text-white" />}
                        <span>{exportStatusText}</span>
                      </span>
                      <span className="text-white font-bold">{exportProgress}%</span>
                    </div>

                    {/* Animated Progress Bar */}
                    <div className="w-full h-2 bg-[#111111] rounded-full overflow-hidden border border-[var(--border-primary)]">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${exportProgress}%` }}
                        transition={{ duration: 0.3 }}
                        className={`h-full rounded-full ${
                          exportStep === 'ready' ? 'bg-[var(--ramp-3)]' : 'bg-white text-black'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Feature Checklist inside dump */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono text-[var(--text-secondary)] pt-1">
                    <div className="flex items-center gap-1.5">
                      <Check size={12} className="text-white" />
                      <span>{projectIssues.length} Tasks & Subtasks</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check size={12} className="text-white" />
                      <span>Technical .md Docs</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check size={12} className="text-white" />
                      <span>Dependency DAG Branches</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check size={12} className="text-white" />
                      <span>SHA-256 Checksum Verified</span>
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 border-t border-[var(--border-primary)] bg-[#141414] flex items-center justify-between">
                  <button
                    onClick={() => setIsExportModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-white rounded-xl transition-colors"
                  >
                    Close
                  </button>

                  <button
                    onClick={handleTriggerDownload}
                    disabled={exportStep !== 'ready' || !exportBlobUrl}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black hover:bg-[#FFFFFF] font-bold text-sm transition-all shadow-[0_0_20px_rgba(220,176,1,0.3)] disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02]"
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
  );
}

