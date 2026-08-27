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
  CheckCircle2,
  Users,
  Lock,
  Database,
  RefreshCw,
  FolderKanban
} from 'lucide-react';
import { toast } from 'sonner';

interface ProjectSettingsViewProps {
  project: {
    id: string | number;
    key: string;
    name: string;
    description: string;
    owner_id?: number;
    creatorId?: number;
    ownerName?: string;
  } | null;
  members: any[];
  isCreator: boolean;
  currentUser: any;
  onOpenDeleteModal: () => void;
  onOpenEditModal: () => void;
}

export function ProjectSettingsView({
  project,
  members,
  isCreator,
  currentUser,
  onOpenDeleteModal,
  onOpenEditModal,
}: ProjectSettingsViewProps) {
  const [copiedKey, setCopiedKey] = useState(false);

  const handleCopyKey = () => {
    if (project?.key) {
      navigator.clipboard.writeText(project.key);
      setCopiedKey(true);
      toast.success(`Copied Project Key: ${project.key}`);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  if (!project) return null;

  return (
    <div className="flex-1 overflow-y-auto bg-[#0E0F12] text-[#CFD4DD] p-6 lg:p-10 select-none">
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
                Manage workspace configuration, keys, team members, and danger zone actions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#1C1D21] text-[#DCB001] border border-[#2B2D33]">
              {isCreator ? 'Owner Access' : 'Member View'}
            </span>
          </div>
        </div>

        {/* 1. General Project Information Card */}
        <div className="p-6 rounded-2xl bg-[#141518] border border-[#222428] space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderKanban size={16} className="text-[#DCB001]" />
              <h3 className="text-sm font-bold text-white">General Information</h3>
            </div>
            {isCreator && (
              <button
                onClick={onOpenEditModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1D1E23] hover:bg-[#25272D] text-xs font-semibold text-white border border-[#2E3138] transition-colors"
              >
                <Pencil size={13} />
                <span>Edit Details</span>
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

        {/* 2. Project Key & Collaboration Card */}
        <div className="p-6 rounded-2xl bg-[#141518] border border-[#222428] space-y-4">
          <div className="flex items-center gap-2">
            <Key size={16} className="text-[#DCB001]" />
            <h3 className="text-sm font-bold text-white">Project Access Key</h3>
          </div>
          <p className="text-xs text-[#787C83]">
            Share this 30-character unique key with team members so they can join and collaborate in this project.
          </p>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#101114] border border-[#25272D] max-w-xl">
            <div className="flex items-center gap-2 font-mono text-xs text-[#DCB001] font-bold truncate mr-3">
              <Lock size={14} className="text-[#787C83] shrink-0" />
              <span className="truncate">{project.key}</span>
            </div>

            <button
              onClick={handleCopyKey}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1C1D22] hover:bg-[#25272E] text-xs font-mono text-white border border-[#2C2E35] transition-colors shrink-0"
            >
              {copiedKey ? (
                <>
                  <Check size={13} className="text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span>Copy Key</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 3. Team & Joined Members */}
        <div className="p-6 rounded-2xl bg-[#141518] border border-[#222428] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-[#DCB001]" />
              <h3 className="text-sm font-bold text-white">Collaborators & Members</h3>
            </div>
            <span className="text-xs font-mono text-[#787C83]">{members.length} joined</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {members.map((m) => (
              <div
                key={m.id || m.userId}
                className="flex items-center gap-3 p-3 rounded-xl bg-[#101114] border border-[#222428]"
              >
                <img
                  src={m.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                  alt={m.name}
                  className="w-8 h-8 rounded-lg object-cover ring-1 ring-[#282A30]"
                />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">{m.name}</p>
                  <p className="text-[10px] font-mono text-[#787C83] truncate">{m.email}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Danger Zone: Delete Project Button */}
        <div className="p-6 rounded-2xl bg-[#181112] border border-[#EF4444]/30 space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-[#EF4444]" />
            <h3 className="text-sm font-bold text-[#EF4444]">Danger Zone</h3>
          </div>
          <p className="text-xs text-[#A88B8C]">
            Permanently delete this project along with all associated Kanban tasks, subtask trees, channel messages, technical documentation, and collaborator roles. This action cannot be undone.
          </p>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] font-mono text-[#8E7879]">
              {isCreator ? 'Owner authorization verified' : 'Only the project creator can delete this project'}
            </span>

            {isCreator ? (
              <button
                onClick={onOpenDeleteModal}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-white font-bold text-xs shadow-lg transition-all hover:scale-[1.02]"
              >
                <Trash2 size={14} />
                <span>Delete Project</span>
              </button>
            ) : (
              <button
                disabled
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#28181A] text-[#7A5B5D] font-bold text-xs cursor-not-allowed border border-[#3A2225]"
              >
                <Lock size={14} />
                <span>Delete Disabled</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
