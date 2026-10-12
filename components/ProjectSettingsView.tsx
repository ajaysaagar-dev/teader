import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  Trash2,
  AlertTriangle,
  Key,
  Shield,
  Pencil,
  Copy,
  Check,
  Users,
  Lock,
  LogOut,
  FolderKanban,
  ShieldCheck,
  UserCheck,
  UserX,
  Clock,
  Loader2,
  FileEdit,
  CalendarClock,
  Layers,
  FileText,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { MemberPermissionsWithUser, MemberPermissions, PERMISSION_LABELS } from '@/lib/types';
import { Avatar } from './ui/Avatar';

interface ProjectSettingsViewProps {
  project: {
    id: string | number;
    key: string;
    name: string;
    description?: string;
    owner_id?: number;
    creatorId?: number;
    ownerName?: string;
  } | null;
  members?: any[];
  isCreator?: boolean;
  currentUser?: any;
  onOpenDeleteModal?: () => void;
  onOpenLeaveModal?: () => void;
  onOpenEditModal?: () => void;
  onMemberKicked?: (userId: number | string) => void;
  onMembersUpdated?: (updatedMembers: any[]) => void;
}

export function ProjectSettingsView({
  project,
  members = [],
  isCreator = false,
  currentUser,
  onOpenDeleteModal,
  onOpenLeaveModal,
  onOpenEditModal,
  onMemberKicked,
  onMembersUpdated,
}: ProjectSettingsViewProps) {
  const [copiedKey, setCopiedKey] = useState(false);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [kickingUserId, setKickingUserId] = useState<string | number | null>(null);
  const [processingRequestId, setProcessingRequestId] = useState<string | number | null>(null);
  const [permissionsList, setPermissionsList] = useState<MemberPermissionsWithUser[]>([]);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [savingPermUserId, setSavingPermUserId] = useState<number | string | null>(null);

  // Fetch pending join requests for project owner
  React.useEffect(() => {
    if (!project?.id || !isCreator) return;
    let isMounted = true;
    setLoadingRequests(true);

    fetch(`/api/projects/${project.id}/join-requests`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (isMounted && Array.isArray(data)) {
          setJoinRequests(data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setLoadingRequests(false);
      });

    return () => {
      isMounted = false;
    };
  }, [project?.id, isCreator]);

  // Fetch member permissions for project
  const fetchPermissions = useCallback(async () => {
    if (!project?.id) return;
    setLoadingPermissions(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/permissions`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setPermissionsList(data);
        }
      }
    } catch {}
    finally {
      setLoadingPermissions(false);
    }
  }, [project?.id]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  // Toggle single permission for a member
  const handleTogglePermission = async (
    targetUserId: number | string,
    permKey: keyof MemberPermissions,
    currentValue: boolean
  ) => {
    if (!project?.id) return;
    const newValue = !currentValue;

    // Optimistic UI update
    setPermissionsList((prev) =>
      prev.map((m) => {
        if (String(m.userId) === String(targetUserId)) {
          return { ...m, [permKey]: newValue };
        }
        return m;
      })
    );

    setSavingPermUserId(targetUserId);
    try {
      const targetMember = permissionsList.find((m) => String(m.userId) === String(targetUserId));
      const currentPerms: any = targetMember ? { ...targetMember } : {};
      delete currentPerms.userId;
      delete currentPerms.userName;
      delete currentPerms.userEmail;
      delete currentPerms.userAvatar;
      delete currentPerms.role;

      const payload = {
        userId: targetUserId,
        permissions: {
          ...currentPerms,
          [permKey]: newValue,
        },
      };

      const res = await fetch(`/api/projects/${project.id}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update permissions');
      }

      toast.success(`Updated ${PERMISSION_LABELS[permKey]} for member.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save permission change.');
      fetchPermissions();
    } finally {
      setSavingPermUserId(null);
    }
  };

  // Accept or Reject Join Request
  const handleJoinRequestAction = async (targetUserId: number | string, action: 'accept' | 'reject') => {
    if (!project?.id) return;
    setProcessingRequestId(targetUserId);

    try {
      const res = await fetch(`/api/projects/${project.id}/join-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId, action }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed to ${action} request`);
      }

      setJoinRequests((prev) => prev.filter((r) => String(r.userId) !== String(targetUserId)));

      if (action === 'accept') {
        toast.success('Join request accepted! Member added to project.');
        // Refresh project members
        const memRes = await fetch(`/api/projects/${project.id}/members`);
        if (memRes.ok) {
          const freshMembers = await memRes.json();
          if (onMembersUpdated) onMembersUpdated(freshMembers);
        }
      } else {
        toast.info('Join request rejected.');
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred.');
    } finally {
      setProcessingRequestId(null);
    }
  };

  // Kick / Remove Member
  const handleKickMember = async (targetUserId: number | string, targetName: string) => {
    if (!project?.id) return;
    const confirmed = window.confirm(`Are you sure you want to remove "${targetName}" from this project workspace?`);
    if (!confirmed) return;

    setKickingUserId(targetUserId);
    try {
      const res = await fetch(`/api/projects/${project.id}/members?userId=${targetUserId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove member');
      }

      toast.success(`Removed ${targetName} from the project.`);
      if (onMemberKicked) {
        onMemberKicked(targetUserId);
      }
      if (onMembersUpdated) {
        onMembersUpdated(members.filter((m) => String(m.id || m.userId) !== String(targetUserId)));
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove member.');
    } finally {
      setKickingUserId(null);
    }
  };

  const handleCopyKey = async () => {
    if (!project?.key) return;

    const keyToCopy = project.key.trim();

    // 1. Standard modern Async Clipboard API (for HTTPS / secure contexts)
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(keyToCopy);
        setCopiedKey(true);
        toast.success(`Copied Project Key: ${keyToCopy}`);
        setTimeout(() => setCopiedKey(false), 2200);
        return;
      } catch (err) {
        console.warn('Clipboard API write failed, trying fallback execCommand', err);
      }
    }

    // 2. Production Fallback (works in HTTP, iframe, desktop & legacy contexts)
    try {
      const textArea = document.createElement('textarea');
      textArea.value = keyToCopy;
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.width = '2em';
      textArea.style.height = '2em';
      textArea.style.padding = '0';
      textArea.style.border = 'none';
      textArea.style.outline = 'none';
      textArea.style.boxShadow = 'none';
      textArea.style.background = 'transparent';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);

      if (successful) {
        setCopiedKey(true);
        toast.success(`Copied Project Key: ${keyToCopy}`);
        setTimeout(() => setCopiedKey(false), 2200);
      } else {
        throw new Error('execCommand returned false');
      }
    } catch {
      toast.error('Copy failed. Please manually select and copy the key.');
    }
  };

  if (!project) return null;

  return (
    <div className="flex-1 h-full min-h-0 w-full overflow-y-auto bg-[#000000] text-[var(--text-secondary)] p-6 lg:p-10 select-none">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header Title */}
        <div className="flex items-center justify-between pb-5 border-b border-[#141414]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#191919] border border-[var(--border-primary)] flex items-center justify-center text-white">
              <Settings size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Project Settings</h2>
              <p className="text-xs text-[var(--text-muted)]">
                Manage workspace configuration, access keys, team members, and danger zone actions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase px-2.5 py-1 rounded-lg bg-[#141414] text-white border border-[#2E2E2E]">
              {isCreator ? 'Owner Access' : 'Member View'}
            </span>
          </div>
        </div>

        {/* 1. General Project Information & Edit Name Card */}
        <div className="p-6 rounded-2xl bg-[var(--bg-panel)] border border-[#141414] space-y-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderKanban size={16} className="text-white" />
              <h3 className="text-sm font-bold text-white">General Information</h3>
            </div>
            {isCreator && onOpenEditModal && (
              <button
                onClick={onOpenEditModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1F1F1F] hover:bg-[#282828] text-xs font-semibold text-white border border-[#222222] transition-colors"
              >
                <Pencil size={13} />
                <span>Edit Project Name & Details</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-[#000000] border border-[#141414] space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                Project Name
              </span>
              <p className="font-bold text-white text-sm">{project.name}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#000000] border border-[#141414] space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                Project Lead / Creator
              </span>
              <p className="font-bold text-white text-sm">{project.ownerName || 'karri'}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#000000] border border-[#141414] space-y-1 md:col-span-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                Description
              </span>
              <p className="text-[#ABABAB] leading-relaxed">
                {project.description || 'No description provided for this project.'}
              </p>
            </div>
          </div>
        </div>

        {/* 2. Project Access Key & Copy Card */}
        <div className="p-6 rounded-2xl bg-[var(--bg-panel)] border border-[#141414] space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key size={16} className="text-white" />
              <h3 className="text-sm font-bold text-white">Project Access Key</h3>
            </div>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#141414] text-white border border-[#2E2E2E]">
              30-Char Key
            </span>
          </div>

          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Share this 30-character unique key with team members so they can join and collaborate in this project workspace.
          </p>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#000000] border border-[#282828] max-w-xl hover:border-[var(--border-secondary)] transition-colors">
            <div className="flex items-center gap-2.5 font-mono text-xs text-white font-bold truncate mr-3">
              <Lock size={14} className="text-[var(--text-muted)] shrink-0" />
              <span className="truncate select-all">{project.key}</span>
            </div>

            <button
              type="button"
              onClick={handleCopyKey}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1E1E1E] hover:bg-[#292929] text-xs font-mono text-white border border-[#303030] transition-all shrink-0 active:scale-95 shadow-sm"
            >
              {copiedKey ? (
                <>
                  <Check size={13} className="text-white" />
                  <span className="text-white font-bold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={13} className="text-white" />
                  <span>Copy Key</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 3. Join Requests (Owner Only) */}
        {isCreator && (
          <div className="p-6 rounded-2xl bg-[var(--bg-panel)] border border-[#141414] space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-white" />
                <h3 className="text-sm font-bold text-white">Pending Join Requests</h3>
              </div>
              <span className="text-xs font-mono text-white bg-white/10 px-2 py-0.5 rounded border border-[var(--border-secondary)]">
                {joinRequests.length} pending
              </span>
            </div>

            {loadingRequests ? (
              <div className="flex items-center justify-center p-6 text-xs text-[var(--text-muted)] gap-2">
                <Loader2 size={14} className="animate-spin text-white" />
                <span>Checking join requests...</span>
              </div>
            ) : joinRequests.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#000000] border border-[#141414] text-center">
                <p className="text-xs text-[var(--text-muted)]">No pending join requests for this project workspace.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {joinRequests.map((req) => {
                  const isProcessing = String(processingRequestId) === String(req.userId);
                  return (
                    <div
                      key={req.id || req.userId}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-[#000000] border border-[var(--border-primary)] hover:border-[var(--border-secondary)] transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          user={{ id: req.id || req.userId, name: req.userName, email: req.userEmail, avatar: req.userAvatar }}
                          size="md"
                          className="rounded-lg"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{req.userName}</p>
                          <p className="text-[10px] font-mono text-[var(--text-muted)] truncate">{req.userEmail}</p>
                          <p className="text-[9px] font-mono text-white pt-0.5">
                            Requested {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : 'recently'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {/* Accept Button */}
                        <button
                          disabled={isProcessing}
                          onClick={() => handleJoinRequestAction(req.userId, 'accept')}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--ramp-3)]/15 hover:bg-[var(--ramp-3)]/25 text-white border border-[var(--border-secondary)] text-xs font-semibold transition-all disabled:opacity-50"
                          title="Accept join request"
                        >
                          <UserCheck size={12} />
                          <span>Accept</span>
                        </button>

                        {/* Reject Button */}
                        <button
                          disabled={isProcessing}
                          onClick={() => handleJoinRequestAction(req.userId, 'reject')}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-[var(--ramp-3)]/15 hover:bg-[var(--ramp-3)]/25 text-white border border-[var(--border-secondary)] text-xs font-semibold transition-all disabled:opacity-50"
                          title="Reject join request"
                        >
                          <UserX size={12} />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 4. Collaborators & Joined Members */}
        <div className="p-6 rounded-2xl bg-[var(--bg-panel)] border border-[#141414] space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-white" />
              <h3 className="text-sm font-bold text-white">Collaborators & Members</h3>
            </div>
            <span className="text-xs font-mono text-[var(--text-muted)]">{members.length} joined</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {members.map((m) => {
              const isCurrentUser = currentUser && String(m.id || m.userId) === String(currentUser.id);
              const isOwnerUser = Number(project?.owner_id) === Number(m.id || m.userId) || Number(project?.creatorId) === Number(m.id || m.userId);
              const isKicking = String(kickingUserId) === String(m.id || m.userId);

              return (
                <div
                  key={m.id || m.userId}
                  className={`flex items-center justify-between p-3 rounded-xl border ${
                    isCurrentUser ? 'bg-[#1A1A1A] border-[var(--border-secondary)]' : 'bg-[#000000] border-[#141414]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      user={{ id: m.id || m.userId, name: m.name, email: m.email, avatar: m.avatar }}
                      size="md"
                      className="rounded-lg"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-white truncate">{m.name}</p>
                        {isCurrentUser && (
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-white/20 text-white border border-[var(--border-secondary)]">
                            You
                          </span>
                        )}
                        {isOwnerUser && (
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#FFFFFF]/20 text-white border border-[#FFFFFF]/30">
                            Owner
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-mono text-[var(--text-muted)] truncate">{m.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {/* Kick Member Button (For Owner, except on themselves or owner) */}
                    {isCreator && !isCurrentUser && !isOwnerUser && (
                      <button
                        disabled={isKicking}
                        onClick={() => handleKickMember(m.id || m.userId, m.name)}
                        title={`Remove ${m.name} from project`}
                        className="p-1.5 rounded-lg bg-[#191919] hover:bg-[#212121] text-white hover:text-white border border-[var(--border-secondary)] transition-colors shrink-0 disabled:opacity-50 flex items-center gap-1 text-xs"
                      >
                        <UserX size={13} />
                        <span className="text-[10px] font-semibold hidden group-hover:inline">Kick</span>
                      </button>
                    )}

                    {isCurrentUser && onOpenLeaveModal && (
                      <button
                        onClick={onOpenLeaveModal}
                        title="Leave this project"
                        className="p-1.5 rounded-lg bg-[#191919] hover:bg-[#222222] text-[#FFFFFF] hover:text-white border border-[#FFFFFF]/30 transition-colors shrink-0"
                      >
                        <LogOut size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Member Permissions & Access Control (Owner/Admin) */}
        {isCreator && (
          <div className="p-6 rounded-2xl bg-[var(--bg-panel)] border border-[#141414] space-y-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-white" />
                <div>
                  <h3 className="text-sm font-bold text-white">Member Permissions & Access Control</h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Configure granular permissions for creating, editing, deleting tasks, docs, history, and timestamps.
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#141414] text-white border border-[#2E2E2E]">
                {permissionsList.length} configured
              </span>
            </div>

            {loadingPermissions ? (
              <div className="flex items-center justify-center p-6 text-xs text-[var(--text-muted)] gap-2">
                <Loader2 size={14} className="animate-spin text-white" />
                <span>Loading member permissions...</span>
              </div>
            ) : permissionsList.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#000000] border border-[#141414] text-center">
                <p className="text-xs text-[var(--text-muted)]">No joined members yet to configure permissions.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {permissionsList.map((mem) => {
                  const isOwnerUser =
                    Number(project?.owner_id) === Number(mem.userId) ||
                    Number(project?.creatorId) === Number(mem.userId) ||
                    mem.role === 'owner';
                  const isSaving = savingPermUserId === mem.userId;

                  return (
                    <div
                      key={mem.userId}
                      className="p-4 rounded-xl bg-[#000000] border border-[#141414] hover:border-[#333333] transition-all space-y-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar
                            user={{ id: mem.userId, name: mem.userName, avatar: mem.userAvatar }}
                            size="md"
                            className="rounded-lg"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-bold text-white truncate">{mem.userName}</p>
                              <span
                                className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                                  isOwnerUser
                                    ? 'bg-[#FFFFFF]/15 text-[#FFFFFF] border-[#FFFFFF]/30'
                                    : 'bg-[#141414] text-[var(--text-secondary)] border-[var(--border-primary)]'
                                }`}
                              >
                                {isOwnerUser ? 'Owner' : 'Member'}
                              </span>
                            </div>
                            <p className="text-[10px] font-mono text-[var(--text-muted)] truncate">{mem.userEmail}</p>
                          </div>
                        </div>

                        {isOwnerUser ? (
                          <span className="text-[11px] font-mono text-white bg-[var(--ramp-2)] px-2 py-1 rounded-md border border-[var(--border-secondary)]">
                            Full Workspace Access
                          </span>
                        ) : (
                          isSaving && (
                            <div className="flex items-center gap-1 text-[11px] text-white font-mono">
                              <Loader2 size={12} className="animate-spin" />
                              <span>Saving...</span>
                            </div>
                          )
                        )}
                      </div>

                      {/* Granular Permission Toggles */}
                      {!isOwnerUser && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1 border-t border-[#1E1E1E]">
                          {(
                            [
                              { key: 'can_create_tasks', label: 'Create Tasks & Folders', icon: <FolderKanban size={12} /> },
                              { key: 'can_delete_tasks', label: 'Delete Tasks & Folders', icon: <Trash2 size={12} /> },
                              { key: 'can_create_docs', label: 'Create Docs', icon: <FileText size={12} /> },
                              { key: 'can_edit_docs', label: 'Edit Docs', icon: <FileEdit size={12} /> },
                              { key: 'can_delete_docs', label: 'Delete Docs', icon: <Trash2 size={12} /> },
                              { key: 'can_edit_history', label: 'Edit History', icon: <Clock size={12} /> },
                              { key: 'can_delete_history', label: 'Delete History', icon: <Trash2 size={12} /> },
                              { key: 'can_edit_dates', label: 'Edit Created Dates', icon: <CalendarClock size={12} /> },
                              { key: 'can_manage_members', label: 'Manage Members', icon: <Users size={12} /> },
                              { key: 'can_complete_tasks', label: 'Move Tasks to Done / Complete', icon: <CheckCircle2 size={12} /> },
                            ] as const
                          ).map((p) => {
                            const isEnabled = Boolean(mem[p.key]);
                            return (
                              <button
                                key={p.key}
                                type="button"
                                onClick={() => handleTogglePermission(mem.userId, p.key, isEnabled)}
                                className={`flex items-center justify-between p-2 rounded-lg border text-left text-xs transition-all ${
                                  isEnabled
                                    ? 'bg-[#1D1D1D] border-[var(--border-secondary)] text-white hover:bg-[#262626]'
                                    : 'bg-[var(--bg-panel)] border-[#141414] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-[#222222]'
                                }`}
                              >
                                <div className="flex items-center gap-1.5 min-w-0 pr-2">
                                  <span className={isEnabled ? 'text-white' : 'text-[var(--text-muted)]'}>
                                    {p.icon}
                                  </span>
                                  <span className="text-[11px] font-medium truncate">{p.label}</span>
                                </div>
                                <span
                                  className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                    isEnabled
                                      ? 'bg-[var(--ramp-2)] text-white'
                                      : 'bg-[#141414] text-[#656565]'
                                  }`}
                                >
                                  {isEnabled ? 'ON' : 'OFF'}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 5. Danger Zone */}
        <div className="space-y-4 pt-2">
          {/* Leave Project Option (For Joined Collaborators) */}
          {onOpenLeaveModal && (
            <div className="p-6 rounded-2xl bg-[#141414] border border-[#FFFFFF]/30 space-y-4">
              <div className="flex items-center gap-2">
                <LogOut size={18} className="text-[#FFFFFF]" />
                <h3 className="text-sm font-bold text-[#FFFFFF]">Leave Project Workspace</h3>
              </div>
              <p className="text-xs text-[#979797]">
                Leave this project workspace. You will be removed from the team members list and this project will no longer appear in your dashboard unless you rejoin using the Project Key.
              </p>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] font-mono text-[#828282]">
                  Logged in as {currentUser?.name || 'Member'}
                </span>

                <button
                  onClick={onOpenLeaveModal}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FFFFFF] hover:bg-[#FFFFFF] text-white font-bold text-xs shadow-lg transition-all hover:scale-[1.02]"
                >
                  <LogOut size={14} />
                  <span>Leave Project</span>
                </button>
              </div>
            </div>
          )}

          {/* Delete Project Option (For Creator / Owner) */}
          {isCreator && onOpenDeleteModal && (
            <div className="p-6 rounded-2xl bg-[#141414] border border-[var(--border-secondary)] space-y-4">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-white" />
                <h3 className="text-sm font-bold text-white">Danger Zone — Delete Project</h3>
              </div>
              <p className="text-xs text-[#959595]">
                Permanently delete this project along with all associated Kanban tasks, subtask trees, channel messages, technical documentation, and collaborator roles. This action cannot be undone.
              </p>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] font-mono text-[#808080]">
                  Owner authorization verified ({currentUser?.name || 'Lead'})
                </span>

                <button
                  onClick={onOpenDeleteModal}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--ramp-3)] hover:bg-[#FFFFFF] text-white font-bold text-xs shadow-lg transition-all hover:scale-[1.02]"
                >
                  <Trash2 size={14} />
                  <span>Delete Project</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
