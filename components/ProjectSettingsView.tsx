'use client';

import React, { useState } from 'react';
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
  ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';

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
}

export function ProjectSettingsView({
  project,
  members = [],
  isCreator = false,
  currentUser,
  onOpenDeleteModal,
  onOpenLeaveModal,
  onOpenEditModal,
}: ProjectSettingsViewProps) {
  const [copiedKey, setCopiedKey] = useState(false);

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

        {/* 3. Collaborators & Joined Members */}
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
                      </div>
                      <p className="text-[10px] font-mono text-[#787C83] truncate">{m.email}</p>
                    </div>
                  </div>

                  {isCurrentUser && onOpenLeaveModal && (
                    <button
                      onClick={onOpenLeaveModal}
                      title="Leave this project"
                      className="ml-2 p-1.5 rounded-lg bg-[#241512] hover:bg-[#341B17] text-[#F97316] hover:text-white border border-[#F97316]/30 transition-colors shrink-0"
                    >
                      <LogOut size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Danger Zone */}
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
