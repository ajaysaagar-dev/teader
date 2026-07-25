'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/AppLayout';
import { KanbanBoardView } from '@/components/KanbanBoardView';
import { IssueDetailView } from '@/components/IssueDetailView';
import { NewIssueModal } from '@/components/NewIssueModal';
import { Issue, Status } from '@/lib/types';
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
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface ProjectItem {
  id: string | number;
  key: string;
  name: string;
  description: string;
  creatorId?: number;
  ownerName?: string;
}

interface MemberItem {
  id: number | string;
  name: string;
  email: string;
  avatar: string;
}

export default function SingleProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectIdParam = params?.id as string;

  const [project, setProject] = useState<ProjectItem | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [joinedMembers, setJoinedMembers] = useState<MemberItem[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isNewIssueModalOpen, setIsNewIssueModalOpen] = useState(false);
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);

  // Edit Project Form
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [showProjectKey, setShowProjectKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Real-time Fetching & User Session
  const fetchProjectData = useCallback(async () => {
    try {
      const meRes = await fetch('/api/auth/me');
      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData.user) setCurrentUser(meData.user);
      }

      const [projRes, issueRes] = await Promise.all([
        fetch('/api/projects', { cache: 'no-store' }),
        fetch('/api/issues', { cache: 'no-store' }),
      ]);

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
        if (JSON.stringify(prev) !== JSON.stringify(foundProj)) {
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
          setIssues(issueData);
        }
      }
    } catch (err) {
      console.error('Error loading project:', err);
    } finally {
      setLoading(false);
    }
  }, [projectIdParam]);

  useEffect(() => {
    fetchProjectData();
    const interval = setInterval(() => {
      fetchProjectData();
    }, 2500);
    return () => clearInterval(interval);
  }, [fetchProjectData]);

  // Check if current user is the Project Creator
  const isCreator = currentUser && project && (
    String(currentUser.id) === String(project.creatorId) ||
    currentUser.name === project.ownerName
  );

  const handleCopyProjectKey = () => {
    if (!project) return;
    navigator.clipboard.writeText(project.key);
    setCopiedKey(true);
    toast.success(`Copied Project Key: ${project.key}`);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // Real-time Edit Project Handler
  const handleSaveProjectEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !editName.trim() || isSavingEdit) return;

    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDesc.trim(),
        }),
      });

      if (res.ok) {
        setProject({ ...project, name: editName.trim(), description: editDesc.trim() });
        toast.success('Project details updated in real-time in MySQL DB!');
        setIsEditProjectModalOpen(false);
        fetchProjectData();
      } else {
        throw new Error('Failed to update project');
      }
    } catch {
      toast.error('Failed to update project details');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Status Switch Handler with Strict Creator Check
  const handleUpdateStatus = async (issueId: string, newStatus: Status) => {
    const targetIssue = issues.find((i) => i.id === issueId);
    if (!targetIssue) return;

    if (newStatus === 'done' && !isCreator) {
      toast.error(`Permission Denied: Only the creator of this project (${project?.ownerName || 'Creator'}) can approve and move tasks to Done.`);
      return;
    }

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
      toast.error('Error updating MySQL database');
      fetchProjectData();
    }
  };

  // Add New Task in Active Selected Project
  const handleAddNewTaskToColumn = async (title: string, status: Status) => {
    if (!project) return;

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
        setIssues((prev) => [createdIssue, ...prev]);
        toast.success(`Created task ${createdIssue.key} in ${project.name}!`);
      } else {
        throw new Error('Failed to create task');
      }
    } catch {
      toast.error('Failed to save task to MySQL DB');
    }
  };

  const projectIssues = project
    ? issues.filter(
        (i: any) =>
          String(i.projectId) === String(project.id) ||
          i.project === project.name ||
          (i.project || '').toLowerCase() === project.name.toLowerCase()
      )
    : [];

  const selectedIssue = issues.find((i) => i.id === selectedIssueId);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center bg-[#131415] text-[#787C83] font-mono text-xs">
          Loading project workspace...
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#131415] text-[#CFD4DD] font-sans">
        {/* Workspace Top Bar */}
        <div className="px-6 py-3 bg-[#1B1C1F] border-b border-[#2A2C30] flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/projects')}
              className="text-xs text-[#787C83] hover:text-[#CFD4DD] font-mono flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft size={13} />
              Projects Directory
            </button>
            <span className="text-[#787C83]">/</span>
            <span className="text-xs font-bold text-[#CFD4DD] flex items-center gap-2">
              <FolderKanban size={15} className="text-[#DCB001]" />
              {project?.name}
            </span>

            {isCreator && (
              <button
                onClick={() => {
                  setEditName(project.name);
                  setEditDesc(project.description || '');
                  setIsEditProjectModalOpen(true);
                }}
                className="p-1 text-[#787C83] hover:text-[#DCB001] hover:bg-[#1A1B1D] rounded transition-colors"
                title="Edit Project Details (Creator Only)"
              >
                <Pencil size={13} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs">
            {/* Project Creator Badge */}
            <div className="flex items-center gap-1.5 bg-[#131415] border border-[#2A2C30] rounded-lg px-2.5 py-1 text-xs">
              <Crown size={13} className={isCreator ? 'text-[#22C55E]' : 'text-[#787C83]'} />
              <span className="text-[11px] text-[#787C83]">Created by:</span>
              <span className="font-bold text-[#CFD4DD]">{project?.ownerName || 'karri'}</span>
            </div>

            {/* Top Right Show Key Button */}
            {project && (
              <div className="flex items-center gap-2">
                {showProjectKey ? (
                  <div className="flex items-center gap-2 bg-[#131415] border border-[#DCB001]/50 rounded-lg px-2.5 py-1">
                    <span className="text-[11px] text-[#787C83]">Project Key:</span>
                    <span className="font-mono font-bold text-[#DCB001] text-[10px] truncate max-w-[200px]">{project.key}</span>
                    <button
                      onClick={handleCopyProjectKey}
                      className="p-1 text-[#787C83] hover:text-white transition-colors"
                      title="Copy Key"
                    >
                      {copiedKey ? <Check size={13} className="text-[#22C55E]" /> : <Copy size={13} />}
                    </button>
                    <button
                      onClick={() => setShowProjectKey(false)}
                      className="p-0.5 text-[#787C83] hover:text-white"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setShowProjectKey(true);
                      toast.info(`Project Key is: ${project.key}`);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#DCB001] bg-[#1E1E1E] hover:bg-[#2A2C30] border border-[#3B3D41] rounded-lg shadow-sm transition-all"
                  >
                    <Key size={13} />
                    <span>Show Key</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Task Details or Kanban Board */}
        {selectedIssue ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <div className="px-4 py-2 bg-[#131415] border-b border-[#2A2C30] flex items-center justify-between shrink-0">
              <button
                onClick={() => setSelectedIssueId(null)}
                className="text-xs text-[#787C83] hover:text-[#CFD4DD] font-mono flex items-center gap-1"
              >
                ← Back to {project?.name} Board
              </button>

              <div className="flex items-center gap-2">
                <span className="text-xs text-[#787C83]">Status:</span>
                <select
                  value={selectedIssue.status}
                  onChange={(e) => handleUpdateStatus(selectedIssue.id, e.target.value as Status)}
                  className="bg-[#1A1B1D] text-xs text-[#DCB001] border border-[#2A2C30] rounded px-2.5 py-1 outline-none cursor-pointer font-semibold"
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

        {/* Opened Project Footer Bar showing Joined Members */}
        <div className="px-6 py-2.5 bg-[#0F1011] border-t border-[#2A2C30] flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-[#787C83] font-semibold">
              <Users size={14} className="text-[#DCB001]" />
              <span>Joined Project Members ({joinedMembers.length}):</span>
            </div>

            <div className="flex items-center gap-2">
              {joinedMembers.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1B1C1F] border border-[#2A2C30] rounded-lg text-xs"
                >
                  <Avatar user={{ id: String(m.id), name: m.name, avatar: m.avatar, email: m.email, role: '' }} size="xs" />
                  <span className="font-mono text-[11px] text-[#CFD4DD]">{m.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="text-[11px] font-mono text-[#787C83]">
            Real-time MySQL Sync Active 🟢
          </div>
        </div>

        {/* New Issue Modal */}
        {project && (
          <NewIssueModal
            isOpen={isNewIssueModalOpen}
            onClose={() => setIsNewIssueModalOpen(false)}
            onCreateIssue={(created) => setIssues((prev) => [created, ...prev])}
            defaultProjectKey={project.key}
            defaultProjectName={project.name}
            defaultProjectId={project.id}
            isProjectLocked={true}
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
                        className="px-4 py-1.5 text-xs font-semibold text-[#0F1011] bg-[#DCB001] hover:bg-[#c49c00] rounded-lg shadow-sm"
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
