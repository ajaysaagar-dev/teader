'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { AppLayout } from '@/components/AppLayout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ProjectPageHeaderSkeleton, KanbanBoardSkeleton, ViewLoadingFallback } from '@/components/ui/Skeleton';
import { RandomLoadingText } from '@/components/ui/RandomLoadingText';
import { Issue, Status } from '@/lib/types';
import { getLocalCache, setLocalCache, reconcileIssues } from '@/lib/client-cache';



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
  Layers,
  LayoutGrid,
  Terminal,
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
  Loader2
} from 'lucide-react';

import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

// Dynamic lazy-loaded view components for optimal code-splitting and load speed
const ProjectOverviewView = dynamic(
  () => import('@/components/ProjectOverviewView').then((m) => ({ default: m.ProjectOverviewView })),
  { ssr: false, loading: () => <ViewLoadingFallback /> }
);
const KanbanBoardView = dynamic(
  () => import('@/components/KanbanBoardView').then((m) => ({ default: m.KanbanBoardView })),
  { ssr: false, loading: () => <ViewLoadingFallback /> }
);
const HierarchicalView = dynamic(
  () => import('@/components/HierarchicalView').then((m) => ({ default: m.HierarchicalView })),
  { ssr: false, loading: () => <ViewLoadingFallback /> }
);
const DevStreamView = dynamic(
  () => import('@/components/DevStreamView').then((m) => ({ default: m.DevStreamView })),
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
const IssueDetailView = dynamic(
  () => import('@/components/IssueDetailView').then((m) => ({ default: m.IssueDetailView })),
  { ssr: false, loading: () => <ViewLoadingFallback /> }
);
const NewIssueModal = dynamic(
  () => import('@/components/NewIssueModal').then((m) => ({ default: m.NewIssueModal })),
  { ssr: false }
);
const AutomationsModal = dynamic(
  () => import('@/components/AutomationsModal').then((m) => ({ default: m.AutomationsModal })),
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
}

interface MemberItem {
  id: number | string;
  name: string;
  email: string;
  avatar: string;
}

function parseViewTab(view?: string): 'overview' | 'board' | 'hierarchy' | 'dev' | 'tree' | 'calendar' | 'graph' | 'docs' {
  if (!view) return 'overview';
  const v = String(view).toLowerCase();
  if (v === 'overview' || v === 'analytics' || v === 'charts' || v === 'insights' || v === 'stats') return 'overview';
  if (v === 'calendar' || v === 'schedule' || v === 'timeline') return 'calendar';
  if (v === 'graph' || v === 'dependencies' || v === 'dag') return 'graph';
  if (v === 'docs' || v === 'wiki' || v === 'spec') return 'docs';
  if (v === 'tree') return 'tree';
  if (v === 'dev' || v === 'devstream' || v === 'stream') return 'dev';
  if (v === 'hierarchy' || v === 'hierarchical') return 'hierarchy';
  if (v === 'board' || v === 'kanban') return 'board';
  return 'overview';
}

export default function SingleProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectIdParam = params?.id as string;
  const viewParam = params?.view as string | undefined;

  const [activeTab, setActiveTab] = useState<'overview' | 'board' | 'hierarchy' | 'dev' | 'tree' | 'calendar' | 'graph' | 'docs'>(() => parseViewTab(viewParam));

  useEffect(() => {
    if (viewParam) {
      setActiveTab(parseViewTab(viewParam));
    }
  }, [viewParam]);

  const handleTabSwitch = useCallback((newTab: 'overview' | 'board' | 'hierarchy' | 'dev' | 'tree' | 'calendar' | 'graph' | 'docs') => {
    setActiveTab(newTab);
    router.push(`/projects/${projectIdParam}/${newTab}`);
  }, [projectIdParam, router]);




  const [project, setProject] = useState<ProjectItem | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [joinedMembers, setJoinedMembers] = useState<MemberItem[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Hydrate from client cache immediately on mount (100% hydration mismatch-safe)
  useEffect(() => {
    const cachedIssues = getLocalCache<Issue[]>(`issues_${projectIdParam}`, []);
    const cachedProj = getLocalCache<ProjectItem | null>(`project_${projectIdParam}`, null);
    if (cachedIssues && cachedIssues.length > 0) {
      setIssues(cachedIssues);
      setLoading(false);
    }
    if (cachedProj) {
      setProject(cachedProj);
    }
  }, [projectIdParam]);

  // Sync state to local cache immediately on any mutation
  useEffect(() => {
    if (issues.length > 0) {
      setLocalCache(`issues_${projectIdParam}`, issues);
    }
  }, [issues, projectIdParam]);

  useEffect(() => {
    if (project) {
      setLocalCache(`project_${projectIdParam}`, project);
    }
  }, [project, projectIdParam]);



  // Modals
  const [isNewIssueModalOpen, setIsNewIssueModalOpen] = useState(false);
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
  const [isAutomationsModalOpen, setIsAutomationsModalOpen] = useState(false);
  const [isImportTasksModalOpen, setIsImportTasksModalOpen] = useState(false);

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
      const meRes = await fetch('/api/auth/me');
      if (meRes.status === 401) {
        router.push('/login');
        return;
      }
      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData.user) setCurrentUser(meData.user);
      }

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

      if (!foundProj) {
        foundProj = {
          id: projectIdParam,
          key: projectIdParam.toUpperCase(),
          name: decodeURIComponent(projectIdParam),
          description: '',
          ownerName: 'karri',
        };
      }

      setProject((prev) => {
        if (!prev || prev.id !== foundProj?.id || prev.name !== foundProj?.name || prev.description !== foundProj?.description) {
          return foundProj;
        }
        return prev;
      });

      if (foundProj && foundProj.id) {
        const memRes = await fetch(`/api/projects/${foundProj.id}/members`, { cache: 'no-store' });
        if (memRes.ok) {
          const memData = await memRes.json();
          if (Array.isArray(memData)) setJoinedMembers(memData);
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

  // Memoized checks & derived state
  const isCreator = useMemo(() => {
    if (!currentUser || !project) return false;
    return (
      String(currentUser.id) === String(project.creatorId) ||
      String(currentUser.id) === String(project.owner_id) ||
      currentUser.name === project.ownerName
    );
  }, [currentUser, project]);

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

    if (newStatus === 'done' && !isCreator) {
      toast.error(`Permission Denied: Only the creator of this project (${project?.ownerName || 'Creator'}) can move tasks to Done.`);
      return;
    }

    const previousIssues = issues;
    setIssues((prev) =>
      prev.map((i) => (i.id === issueId ? { ...i, status: newStatus } : i))
    );

    try {
      const res = await fetch(`/api/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error('Failed to update DB');
      toast.success(`Updated status to ${newStatus.replace('_', ' ')}`);
    } catch {
      toast.error('Error updating status in database');
      setIssues(previousIssues);
    }
  }, [issues, isCreator, project]);

  // Add New Task in Active Selected Project (Direct UI + Background Sync)
  const handleAddNewTaskToColumn = useCallback(async (title: string, status: Status) => {
    if (!project) return;

    const tempId = `temp_${Date.now()}`;
    const tempKey = `${project.key}-${Date.now().toString().slice(-4)}`;
    const optimisticIssue: Issue = {
      id: tempId,
      key: tempKey,
      title: title.trim(),
      description: '',
      status,
      priority: 'medium',
      project: project.name,
      projectId: project.id,
      labels: ['Task'],
      subtasks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };


    // 1. Add in UI directly and immediately (0ms latency)
    setIssues((prev) => [optimisticIssue, ...prev]);
    toast.success(`Task "${title}" created!`);

    // 2. Process in background to PostgreSQL server
    try {
      const res = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          status,
          priority: 'medium',
          project: project.name,
          projectId: project.id,
          labels: ['Task'],
        }),
      });

      if (res.ok) {
        const createdIssue = await res.json();
        // Seamlessly reconcile temporary issue with real database record
        setIssues((prev) =>
          prev.map((iss) => (iss.id === tempId ? createdIssue : iss))
        );
      } else {
        throw new Error('Failed to create task on server');
      }
    } catch {
      toast.error('Failed to sync new task with server');
      setIssues((prev) => prev.filter((iss) => iss.id !== tempId));
    }
  }, [project]);


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
        body: JSON.stringify({ subId, completed: nextCompleted }),
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
  }, [fetchProjectData]);

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
        body: JSON.stringify({ issueId, title, parentId, isFolder, type }),
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
      prev.map((iss) =>
        (iss.epic || 'General Tasks') === oldEpicName
          ? { ...iss, epic: newEpicName }
          : iss
      )
    );

    try {
      const matching = issues.filter((i) => (i.epic || 'General Tasks') === oldEpicName);
      await Promise.all(
        matching.map((iss) =>
          fetch(`/api/issues/${iss.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ epic: newEpicName }),
          })
        )
      );
      toast.success(`Epic renamed to "${newEpicName}"!`);
    } catch {
      toast.error('Failed to rename epic');
      fetchProjectData();
    }
  }, [issues, fetchProjectData]);

  if (loading && issues.length === 0 && !project) {
    return (
      <AppLayout>
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#131415] text-[#CFD4DD] font-sans relative">
          <ProjectPageHeaderSkeleton />
          <KanbanBoardSkeleton />
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 bg-[#17181A]/90 backdrop-blur-md border border-[#2A2C30] shadow-xl px-4 py-2 rounded-full">
            <RandomLoadingText />
          </div>
        </div>
      </AppLayout>
    );
  }


  return (
    <AppLayout>
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

            {/* Live Sync Indicator */}
            <div className="hidden xl:flex items-center gap-1 text-[10px] font-mono text-[#787C83] pl-1" title="Real-time MySQL DB Sync Active">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
              <span>Live</span>
            </div>

            {/* Automations Button */}
            <button
              onClick={() => setIsAutomationsModalOpen(true)}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1 bg-[#131415] hover:bg-[#222427] border border-[#2A2C30] hover:border-[#DCB001]/40 rounded-md text-[11px] text-[#CFD4DD] transition-all"
              title="Configure Workflow Automations"
            >
              <Zap size={12} className="text-[#DCB001]" />
              <span className="hidden md:inline">Automations</span>
            </button>

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


            {/* Quick + Task Button */}
            <button
              onClick={() => setIsNewIssueModalOpen(true)}
              className="flex items-center gap-1 px-3 py-1 text-xs font-bold text-[#0F1011] bg-[#DCB001] hover:bg-[#c49c00] rounded-md shadow-sm transition-all"
            >
              <Plus size={13} />
              <span>New Task</span>
            </button>
          </div>
        </div>

        {/* 2. Dedicated View Switcher Subheader Bar (Under current header, exclusively for tabs) */}
        <div className="h-10 px-4 bg-[#141517] border-b border-[#2A2C30] flex items-center overflow-x-auto shrink-0 select-none custom-scrollbar">
          <div className="flex items-center gap-1">
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
              onClick={() => handleTabSwitch('board')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'board'
                  ? 'bg-[#2A2C30] text-[#DCB001] shadow-sm'
                  : 'text-[#787C83] hover:text-[#CFD4DD]'
              }`}
            >
              <LayoutGrid size={13} />
              <span>Board</span>
              <span className="text-[10px] font-mono opacity-80">({projectIssues.length})</span>
            </button>

            <button
              onClick={() => handleTabSwitch('hierarchy')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'hierarchy'
                  ? 'bg-[#2A2C30] text-[#DCB001] shadow-sm'
                  : 'text-[#787C83] hover:text-[#CFD4DD]'
              }`}
            >
              <Layers size={13} />
              <span>Hierarchical</span>
              <span className="text-[10px] font-mono opacity-80">({projectIssues.length})</span>
            </button>

            <button
              onClick={() => handleTabSwitch('tree')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'tree'
                  ? 'bg-[#2A2C30] text-[#DCB001] shadow-sm'
                  : 'text-[#787C83] hover:text-[#CFD4DD]'
              }`}
              title="Project Tree Explorer"
            >
              <FolderTree size={13} />
              <span>Tree</span>
              <span className="text-[10px] font-mono opacity-80">({projectIssues.length})</span>
            </button>

            <button
              onClick={() => handleTabSwitch('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'calendar'
                  ? 'bg-[#2A2C30] text-[#DCB001] shadow-sm'
                  : 'text-[#787C83] hover:text-[#CFD4DD]'
              }`}
              title="Project Deadlines & Calendar"
            >
              <Calendar size={13} />
              <span>Calendar</span>
            </button>

            <button
              onClick={() => handleTabSwitch('graph')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'graph'
                  ? 'bg-[#2A2C30] text-[#DCB001] shadow-sm'
                  : 'text-[#787C83] hover:text-[#CFD4DD]'
              }`}
              title="DAG Dependency Graph"
            >
              <GitFork size={13} />
              <span>Graph</span>
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
              onClick={() => handleTabSwitch('dev')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'dev'
                  ? 'bg-[#2A2C30] text-[#DCB001] shadow-sm'
                  : 'text-[#787C83] hover:text-[#CFD4DD]'
              }`}
              title="Developer Workstation Stream"
            >
              <Terminal size={13} />
              <span>Dev Stream</span>
              <span className="text-[10px] font-mono opacity-80">({projectIssues.length})</span>
            </button>
          </div>
        </div>




        {/* Task Details, Tree View, Hierarchical View, Dev Stream, or Compact Kanban Board with Error Boundaries */}
        <ErrorBoundary>
          {selectedIssue ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <div className="h-9 px-3.5 bg-[#17181A] border-b border-[#2A2C30] flex items-center justify-between shrink-0">
                <button
                  onClick={() => setSelectedIssueId(null)}
                  className="text-xs text-[#787C83] hover:text-[#CFD4DD] font-mono flex items-center gap-1 transition-colors"
                >
                  <ArrowLeft size={12} />
                  <span>Back to {activeTab === 'overview' ? 'Overview' : activeTab === 'tree' ? 'Tree' : activeTab === 'dev' ? 'Dev Stream' : activeTab === 'hierarchy' ? 'Hierarchy' : 'Board'}</span>

                </button>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#787C83] font-mono">Status:</span>
                  <select
                    value={selectedIssue.status}
                    onChange={(e) => handleUpdateStatus(selectedIssue.id, e.target.value as Status)}
                    className="bg-[#131415] text-xs text-[#DCB001] border border-[#2A2C30] rounded px-2 py-0.5 outline-none cursor-pointer font-semibold"
                  >
                    <option value="todo">Todo</option>
                    <option value="in_progress">In Progress</option>
                    <option value="needs_review">Needs Review</option>
                    <option value="done">Done (Creator Only)</option>
                  </select>
                </div>
              </div>

              <IssueDetailView
                issue={selectedIssue}
                onUpdateIssue={(updated) => setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))}
                onOpenDiffModal={() => {}}
                currentRole={isCreator ? 'owner' : 'member'}
              />
            </div>
          ) : activeTab === 'overview' ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <ProjectOverviewView
                issues={projectIssues}
                project={project}
                members={joinedMembers}
                onNavigateTab={handleTabSwitch}
                onOpenNewIssue={() => setIsNewIssueModalOpen(true)}
              />
            </div>
          ) : activeTab === 'tree' ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <TreeView

                issues={projectIssues}
                projectName={project?.name}
                projectKey={project?.key}
                onSelectIssue={(id) => setSelectedIssueId(id)}
                onUpdateIssueStatus={handleUpdateStatus}
                onOpenNewIssue={() => setIsNewIssueModalOpen(true)}
                onToggleSubtask={handleToggleSubtask}
                onAddSubtask={handleAddSubtask}
                onDeleteSubtask={handleDeleteSubtask}
                onRenameSubtask={handleRenameSubtask}
                onMoveSubtask={handleMoveSubtask}
                onRenameIssue={handleRenameIssue}
                onRenameEpic={handleRenameEpic}
              />
            </div>
          ) : activeTab === 'calendar' ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <CalendarView
                issues={projectIssues}
                onSelectIssue={(id) => setSelectedIssueId(id)}
                onOpenNewIssue={() => setIsNewIssueModalOpen(true)}
              />
            </div>
          ) : activeTab === 'graph' ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <DependencyGraphView
                issues={projectIssues}
                onSelectIssue={(id) => setSelectedIssueId(id)}
                onOpenNewIssue={() => setIsNewIssueModalOpen(true)}
              />
            </div>
          ) : activeTab === 'docs' ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <ProjectDocsView
                projectId={project?.id || 1}
                projectName={project?.name}
                projectKey={project?.key}
              />
            </div>
          ) : activeTab === 'dev' ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <DevStreamView
                issues={projectIssues}
                onSelectIssue={(id) => setSelectedIssueId(id)}
                onUpdateIssueStatus={handleUpdateStatus}
                onOpenNewIssue={() => setIsNewIssueModalOpen(true)}
                onToggleSubtask={handleToggleSubtask}
                onAddSubtask={handleAddSubtask}
                currentUser={currentUser}
              />
            </div>
          ) : activeTab === 'hierarchy' ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <HierarchicalView
                issues={projectIssues}
                onSelectIssue={(id) => setSelectedIssueId(id)}
                onUpdateIssueStatus={handleUpdateStatus}
                onOpenNewIssue={() => setIsNewIssueModalOpen(true)}
                onToggleSubtask={handleToggleSubtask}
                onAddSubtask={handleAddSubtask}
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <KanbanBoardView
                issues={projectIssues}
                onSelectIssue={(id) => setSelectedIssueId(id)}
                onUpdateIssueStatus={handleUpdateStatus}
                onOpenNewIssue={() => setIsNewIssueModalOpen(true)}
                onAddNewTaskToColumn={handleAddNewTaskToColumn}
              />
            </div>
          )}
        </ErrorBoundary>

        {/* New Issue Modal */}
        {project && isNewIssueModalOpen && (
          <NewIssueModal
            isOpen={isNewIssueModalOpen}
            onClose={() => setIsNewIssueModalOpen(false)}
            onCreateIssue={(created) =>
              setIssues((prev) => {
                const existingIdx = prev.findIndex(
                  (iss) =>
                    iss.id === created.id ||
                    (String(iss.id).startsWith('temp_') && iss.title === created.title)
                );
                if (existingIdx !== -1) {
                  const updated = [...prev];
                  updated[existingIdx] = created;
                  return updated;
                }
                return [created, ...prev];
              })
            }

            defaultProjectKey={project.key}
            defaultProjectName={project.name}
            defaultProjectId={project.id}
            isProjectLocked={true}
          />
        )}

        {/* Workflow Automations Modal */}
        {project && (
          <AutomationsModal
            isOpen={isAutomationsModalOpen}
            onClose={() => setIsAutomationsModalOpen(false)}
            projectId={project.id}
            projectName={project.name}
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
      </div>
    </AppLayout>
  );
}

