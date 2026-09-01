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
  FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { MemberPermissionsWithUser, MemberPermissions, PERMISSION_LABELS } from '@/lib/types';

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
    <div className="flex-1 h-full min-h-0 w-full overflow-y-auto bg-[#0E0F12] text-[#CFD4DD] p-6 lg:p-10 select-none">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header Title */}
        <div className="flex items-center justify-between pb-5 border-b border-[#222428]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#17181C] border border-[#2A2C30] flex items-center justify-center text-[#DCB001]">
              <Settings size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Project Settings</h2>
              <p className="text-xs text-[#787C83]">
                Manage workspace configuration, access keys, team members, and danger zone actions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase px-2.5 py-1 rounded-lg bg-[#1C1D21] text-[#DCB001] border border-[#2B2D33]">
              {isCreator ? 'Owner Access' : 'Member View'}
            </span>
          </div>
        </div>

        {/* 1. General Project Information & Edit Name Card */}
        <div className="p-6 rounded-2xl bg-[#141518] border border-[#222428] space-y-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderKanban size={16} className="text-[#DCB001]" />
              <h3 className="text-sm font-bold text-white">General Information</h3>
            </div>
            {isCreator && onOpenEditModal && (
              <button
                onClick={onOpenEditModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1D1E23] hover:bg-[#25272D] text-xs font-semibold text-white border border-[#2E3138] transition-colors"
              >
                <Pencil size={13} />
                <span>Edit Project Name & Details</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-[#101114] border border-[#222428] space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#787C83]">
                Project Name
              </span>
              <p className="font-bold text-white text-sm">{project.name}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#101114] border border-[#222428] space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#787C83]">
                Project Lead / Creator
              </span>
              <p className="font-bold text-white text-sm">{project.ownerName || 'karri'}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#101114] border border-[#222428] space-y-1 md:col-span-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#787C83]">
                Description
              </span>
              <p className="text-[#A4A9B3] leading-relaxed">
                {project.description || 'No description provided for this project.'}
              </p>
            </div>
          </div>
        </div>

        {/* 2. Project Access Key & Copy Card */}
        <div className="p-6 rounded-2xl bg-[#141518] border border-[#222428] space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key size={16} className="text-[#DCB001]" />
              <h3 className="text-sm font-bold text-white">Project Access Key</h3>
            </div>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#1C1D21] text-[#DCB001] border border-[#2B2D33]">
              30-Char Key
            </span>
          </div>

          <p className="text-xs text-[#9499A0] leading-relaxed">
            Share this 30-character unique key with team members so they can join and collaborate in this project workspace.
          </p>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#101114] border border-[#25272D] max-w-xl hover:border-[#DCB001]/40 transition-colors">
            <div className="flex items-center gap-2.5 font-mono text-xs text-[#DCB001] font-bold truncate mr-3">
              <Lock size={14} className="text-[#787C83] shrink-0" />
              <span className="truncate select-all">{project.key}</span>
            </div>

            <button
              type="button"
              onClick={handleCopyKey}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1C1D22] hover:bg-[#25272E] text-xs font-mono text-white border border-[#2C2E35] transition-all shrink-0 active:scale-95 shadow-sm"
            >
              {copiedKey ? (
                <>
                  <Check size={13} className="text-emerald-400" />
                  <span className="text-emerald-400 font-bold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={13} className="text-[#DCB001]" />
                  <span>Copy Key</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 3. Join Requests (Owner Only) */}
        {isCreator && (
          <div className="p-6 rounded-2xl bg-[#141518] border border-[#222428] space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-[#DCB001]" />
                <h3 className="text-sm font-bold text-white">Pending Join Requests</h3>
              </div>
              <span className="text-xs font-mono text-[#DCB001] bg-[#DCB001]/10 px-2 py-0.5 rounded border border-[#DCB001]/30">
                {joinRequests.length} pending
              </span>
            </div>

            {loadingRequests ? (
              <div className="flex items-center justify-center p-6 text-xs text-[#787C83] gap-2">
                <Loader2 size={14} className="animate-spin text-[#DCB001]" />
                <span>Checking join requests...</span>
              </div>
            ) : joinRequests.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#101114] border border-[#222428] text-center">
                <p className="text-xs text-[#787C83]">No pending join requests for this project workspace.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {joinRequests.map((req) => {
                  const isProcessing = String(processingRequestId) === String(req.userId);
                  return (
                    <div
                      key={req.id || req.userId}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-[#101114] border border-[#2A2C30] hover:border-[#DCB001]/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={req.userAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                          alt={req.userName}
                          className="w-9 h-9 rounded-lg object-cover ring-1 ring-[#282A30] shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{req.userName}</p>
                          <p className="text-[10px] font-mono text-[#787C83] truncate">{req.userEmail}</p>
                          <p className="text-[9px] font-mono text-[#DCB001] pt-0.5">
                            Requested {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : 'recently'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {/* Accept Button */}
                        <button
                          disabled={isProcessing}
                          onClick={() => handleJoinRequestAction(req.userId, 'accept')}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#22C55E]/15 hover:bg-[#22C55E]/25 text-[#22C55E] border border-[#22C55E]/30 text-xs font-semibold transition-all disabled:opacity-50"
                          title="Accept join request"
                        >
                          <UserCheck size={12} />
                          <span>Accept</span>
                        </button>

                        {/* Reject Button */}
                        <button
                          disabled={isProcessing}
                          onClick={() => handleJoinRequestAction(req.userId, 'reject')}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-[#EF4444]/15 hover:bg-[#EF4444]/25 text-[#EF4444] border border-[#EF4444]/30 text-xs font-semibold transition-all disabled:opacity-50"
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
        <div className="p-6 rounded-2xl bg-[#141518] border border-[#222428] space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-[#DCB001]" />
              <h3 className="text-sm font-bold text-white">Collaborators & Members</h3>
            </div>
            <span className="text-xs font-mono text-[#787C83]">{members.length} joined</span>
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
                    isCurrentUser ? 'bg-[#18191E] border-[#DCB001]/40' : 'bg-[#101114] border-[#222428]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={m.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                      alt={m.name}
                      className="w-8 h-8 rounded-lg object-cover ring-1 ring-[#282A30] shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-white truncate">{m.name}</p>
                        {isCurrentUser && (
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#DCB001]/20 text-[#DCB001] border border-[#DCB001]/30">
                            You
                          </span>
                        )}
                        {isOwnerUser && (
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#3B82F6]/20 text-[#3B82F6] border border-[#3B82F6]/30">
                            Owner
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-mono text-[#787C83] truncate">{m.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {/* Kick Member Button (For Owner, except on themselves or owner) */}
                    {isCreator && !isCurrentUser && !isOwnerUser && (
                      <button
                        disabled={isKicking}
                        onClick={() => handleKickMember(m.id || m.userId, m.name)}
                        title={`Remove ${m.name} from project`}
                        className="p-1.5 rounded-lg bg-[#241512] hover:bg-[#381614] text-[#EF4444] hover:text-white border border-[#EF4444]/30 transition-colors shrink-0 disabled:opacity-50 flex items-center gap-1 text-xs"
                      >
                        <UserX size={13} />
                        <span className="text-[10px] font-semibold hidden group-hover:inline">Kick</span>
                      </button>
                    )}

                    {isCurrentUser && onOpenLeaveModal && (
                      <button
                        onClick={onOpenLeaveModal}
                        title="Leave this project"
                        className="p-1.5 rounded-lg bg-[#241512] hover:bg-[#341B17] text-[#F97316] hover:text-white border border-[#F97316]/30 transition-colors shrink-0"
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
          <div className="p-6 rounded-2xl bg-[#141518] border border-[#222428] space-y-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-[#DCB001]" />
                <div>
                  <h3 className="text-sm font-bold text-white">Member Permissions & Access Control</h3>
                  <p className="text-xs text-[#787C83]">
                    Configure granular permissions for creating, editing, deleting tasks, docs, history, and timestamps.
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#1C1D21] text-[#DCB001] border border-[#2B2D33]">
                {permissionsList.length} configured
              </span>
            </div>

            {loadingPermissions ? (
              <div className="flex items-center justify-center p-6 text-xs text-[#787C83] gap-2">
                <Loader2 size={14} className="animate-spin text-[#DCB001]" />
                <span>Loading member permissions...</span>
              </div>
            ) : permissionsList.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#101114] border border-[#222428] text-center">
                <p className="text-xs text-[#787C83]">No joined members yet to configure permissions.</p>
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
                      className="p-4 rounded-xl bg-[#101114] border border-[#222428] hover:border-[#2F3238] transition-all space-y-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={mem.userAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                            alt={mem.userName}
                            className="w-8 h-8 rounded-lg object-cover ring-1 ring-[#282A30] shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-bold text-white truncate">{mem.userName}</p>
                              <span
                                className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                                  isOwnerUser
                                    ? 'bg-[#3B82F6]/15 text-[#60A5FA] border-[#3B82F6]/30'
                                    : 'bg-[#1C1D21] text-[#9499A0] border-[#2A2C30]'
                                }`}
                              >
                                {isOwnerUser ? 'Owner' : 'Member'}
                              </span>
                            </div>
                            <p className="text-[10px] font-mono text-[#787C83] truncate">{mem.userEmail}</p>
                          </div>
                        </div>

                        {isOwnerUser ? (
                          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/25">
                            Full Workspace Access
                          </span>
                        ) : (
                          isSaving && (
                            <div className="flex items-center gap-1 text-[11px] text-[#DCB001] font-mono">
                              <Loader2 size={12} className="animate-spin" />
                              <span>Saving...</span>
                            </div>
                          )
                        )}
                      </div>

                      {/* Granular Permission Toggles */}
                      {!isOwnerUser && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1 border-t border-[#1C1D22]">
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
                                    ? 'bg-[#182618] border-emerald-500/35 text-white hover:bg-[#1f331f]'
                                    : 'bg-[#121316] border-[#222428] text-[#787C83] hover:text-[#CFD4DD] hover:border-[#2E3138]'
                                }`}
                              >
                                <div className="flex items-center gap-1.5 min-w-0 pr-2">
                                  <span className={isEnabled ? 'text-emerald-400' : 'text-[#787C83]'}>
                                    {p.icon}
                                  </span>
                                  <span className="text-[11px] font-medium truncate">{p.label}</span>
                                </div>
                                <span
                                  className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                    isEnabled
                                      ? 'bg-emerald-500/20 text-emerald-400'
                                      : 'bg-[#1C1D21] text-[#60646C]'
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
            <div className="p-6 rounded-2xl bg-[#181310] border border-[#F97316]/30 space-y-4">
              <div className="flex items-center gap-2">
                <LogOut size={18} className="text-[#F97316]" />
                <h3 className="text-sm font-bold text-[#F97316]">Leave Project Workspace</h3>
              </div>
              <p className="text-xs text-[#A89488]">
                Leave this project workspace. You will be removed from the team members list and this project will no longer appear in your dashboard unless you rejoin using the Project Key.
              </p>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] font-mono text-[#8E8078]">
                  Logged in as {currentUser?.name || 'Member'}
                </span>

                <button
                  onClick={onOpenLeaveModal}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white font-bold text-xs shadow-lg transition-all hover:scale-[1.02]"
                >
                  <LogOut size={14} />
                  <span>Leave Project</span>
                </button>
              </div>
            </div>
          )}

          {/* Delete Project Option (For Creator / Owner) */}
          {isCreator && onOpenDeleteModal && (
            <div className="p-6 rounded-2xl bg-[#181112] border border-[#EF4444]/30 space-y-4">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-[#EF4444]" />
                <h3 className="text-sm font-bold text-[#EF4444]">Danger Zone — Delete Project</h3>
              </div>
              <p className="text-xs text-[#A88B8C]">
                Permanently delete this project along with all associated Kanban tasks, subtask trees, channel messages, technical documentation, and collaborator roles. This action cannot be undone.
              </p>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] font-mono text-[#8E7879]">
                  Owner authorization verified ({currentUser?.name || 'Lead'})
                </span>

                <button
                  onClick={onOpenDeleteModal}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-white font-bold text-xs shadow-lg transition-all hover:scale-[1.02]"
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
