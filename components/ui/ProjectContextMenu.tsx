'use client';

import React, { useEffect, useRef } from 'react';
import { 
  FolderKanban, 
  Pencil, 
  Trash2, 
  Copy, 
  Link as LinkIcon, 
  ExternalLink,
  ArrowRight,
  Settings
} from 'lucide-react';
import { toast } from 'sonner';

export interface ProjectContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  project: { id: number | string; name: string; key: string; description?: string } | null;
  onClose: () => void;
  onOpen?: (projectId: number | string) => void;
  onEdit?: (project: any) => void;
  onDelete?: (project: any) => void;
  isOwner?: boolean;
}

export const ProjectContextMenu: React.FC<ProjectContextMenuProps> = ({
  isOpen,
  position,
  project,
  onClose,
  onOpen,
  onEdit,
  onDelete,
  isOwner = true,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !project) return null;

  const menuWidth = 190;
  const menuHeight = 200;
  const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

  const left = Math.min(position.x, screenWidth - menuWidth - 10);
  const top = Math.min(position.y, screenHeight - menuHeight - 10);

  const handleCopyKey = () => {
    navigator.clipboard.writeText(project.key);
    toast.success(`Copied project key ${project.key}`);
    onClose();
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/projects/${project.id}`;
    navigator.clipboard.writeText(url);
    toast.success('Copied project link');
    onClose();
  };

  return (
    <div
      ref={menuRef}
      style={{ left: `${left}px`, top: `${top}px` }}
      className="fixed z-50 min-w-[190px] bg-[var(--bg-panel)] border border-[var(--border-primary)] rounded-xl shadow-2xl p-1.5 font-sans text-xs text-[var(--text-primary)] select-none animate-in fade-in zoom-in-95 duration-100"
    >
      {/* Header */}
      <div className="px-2.5 py-1.5 border-b border-[var(--border-primary)] flex items-center justify-between mb-1 text-[11px]">
        <span className="font-bold text-white truncate max-w-[120px]">{project.name}</span>
        <span className="font-mono text-[var(--accent-yellow)] font-bold text-[10px]">{project.key}</span>
      </div>

      {/* 1. Open Board */}
      <button
        onClick={() => {
          onOpen?.(project.id);
          onClose();
        }}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[var(--bg-hover)] hover:text-white transition-colors text-left font-medium"
      >
        <FolderKanban size={13} className="text-[var(--accent-yellow)]" />
        <span>Open Project Board</span>
      </button>

      {/* 2. Edit Project */}
      {isOwner && (
        <button
          onClick={() => {
            onEdit?.(project);
            onClose();
          }}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[var(--bg-hover)] hover:text-white transition-colors text-left"
        >
          <Pencil size={13} className="text-[var(--cyan)]" />
          <span>Edit Project</span>
        </button>
      )}

      <div className="my-1 border-t border-[var(--border-primary)]" />

      {/* 3. Copy Key */}
      <button
        onClick={handleCopyKey}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[var(--bg-hover)] hover:text-white transition-colors text-left"
      >
        <Copy size={13} className="text-[var(--text-muted)]" />
        <span>Copy Project Key</span>
      </button>

      {/* 4. Copy Link */}
      <button
        onClick={handleCopyLink}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[var(--bg-hover)] hover:text-white transition-colors text-left"
      >
        <LinkIcon size={13} className="text-[var(--text-muted)]" />
        <span>Copy Link</span>
      </button>

      {/* 5. Delete Project */}
      {isOwner && (
        <>
          <div className="my-1 border-t border-[var(--border-primary)]" />
          <button
            onClick={() => {
              onDelete?.(project);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[var(--danger-bg)] text-[var(--danger)] transition-colors text-left font-semibold"
          >
            <Trash2 size={13} />
            <span>Delete Project</span>
          </button>
        </>
      )}
    </div>
  );
};
