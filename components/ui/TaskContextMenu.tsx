'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Issue, Status, Priority } from '@/lib/types';
import { 
  Pencil, 
  Trash2, 
  Copy, 
  Link as LinkIcon, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ChevronRight,
  ExternalLink,
  Tag,
  Flame,
  ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';

export interface TaskContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  issue: Issue | null;
  onClose: () => void;
  onEdit?: (issue: Issue) => void;
  onDelete?: (issueId: string) => void;
  onUpdateStatus?: (issueId: string, status: Status) => void;
  onUpdatePriority?: (issueId: string, priority: Priority) => void;
  canDelete?: boolean;
}

export const TaskContextMenu: React.FC<TaskContextMenuProps> = ({
  isOpen,
  position,
  issue,
  onClose,
  onEdit,
  onDelete,
  onUpdateStatus,
  onUpdatePriority,
  canDelete = true,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showStatusSubmenu, setShowStatusSubmenu] = useState(false);
  const [showPrioritySubmenu, setShowPrioritySubmenu] = useState(false);

  // Close on outside click or escape
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

  if (!isOpen || !issue) return null;

  // Viewport bounding adjustments
  const menuWidth = 200;
  const menuHeight = 260;
  const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

  const left = Math.min(position.x, screenWidth - menuWidth - 10);
  const top = Math.min(position.y, screenHeight - menuHeight - 10);

  const statuses: { id: Status; label: string; color: string }[] = [
    { id: 'todo', label: 'Todo', color: '#787C83' },
    { id: 'in_progress', label: 'In Progress', color: '#DCB001' },
    { id: 'needs_review', label: 'Needs Review', color: '#3B82F6' },
    { id: 'done', label: 'Done', color: '#22C55E' },
  ];

  const priorities: { id: Priority; label: string; color: string }[] = [
    { id: 'critical', label: 'Critical (P0)', color: '#EF4444' },
    { id: 'high', label: 'High (P1)', color: '#F97316' },
    { id: 'medium', label: 'Medium (P2)', color: '#DCB001' },
    { id: 'low', label: 'Low (P3)', color: '#3B82F6' },
  ];

  const handleCopyKey = () => {
    navigator.clipboard.writeText(issue.key);
    toast.success(`Copied task key ${issue.key}`);
    onClose();
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/task/${issue.id}/details`;
    navigator.clipboard.writeText(url);
    toast.success('Copied task link');
    onClose();
  };

  return (
    <div
      ref={menuRef}
      style={{ left: `${left}px`, top: `${top}px` }}
      className="fixed z-50 min-w-[200px] bg-[#17181A] border border-[#2A2C30] rounded-xl shadow-2xl p-1.5 font-sans text-xs text-[#CFD4DD] select-none animate-in fade-in zoom-in-95 duration-100"
    >
      {/* Header with Task Identifier */}
      <div className="px-2.5 py-1.5 border-b border-[#2A2C30] flex items-center justify-between mb-1 text-[11px]">
        <span className="font-mono font-bold text-[#DCB001]">{issue.key}</span>
        <span className="text-[10px] text-[#787C83] uppercase font-mono">{issue.status}</span>
      </div>

      {/* 1. Edit / Open Task */}
      <button
        onClick={() => {
          onEdit?.(issue);
          onClose();
        }}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#222427] hover:text-white transition-colors text-left font-medium"
      >
        <Pencil size={13} className="text-[#DCB001]" />
        <span>Open / Edit Task</span>
      </button>

      {/* 2. Change Status Submenu */}
      <div
        className="relative"
        onMouseEnter={() => {
          setShowStatusSubmenu(true);
          setShowPrioritySubmenu(false);
        }}
        onMouseLeave={() => setShowStatusSubmenu(false)}
      >
        <button className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#222427] hover:text-white transition-colors text-left font-medium">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={13} className="text-[#3B82F6]" />
            <span>Change Status</span>
          </div>
          <ChevronRight size={12} className="text-[#787C83]" />
        </button>

        {showStatusSubmenu && (
          <div className="absolute left-full top-0 ml-1 min-w-[150px] bg-[#17181A] border border-[#2A2C30] rounded-xl shadow-2xl p-1.5 z-50">
            {statuses.map((st) => (
              <button
                key={st.id}
                onClick={() => {
                  onUpdateStatus?.(issue.id, st.id);
                  onClose();
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#222427] transition-colors text-left text-xs ${
                  issue.status === st.id ? 'text-white font-bold bg-[#222427]' : 'text-[#CFD4DD]'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: st.color }} />
                <span>{st.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 3. Change Priority Submenu */}
      <div
        className="relative"
        onMouseEnter={() => {
          setShowPrioritySubmenu(true);
          setShowStatusSubmenu(false);
        }}
        onMouseLeave={() => setShowPrioritySubmenu(false)}
      >
        <button className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#222427] hover:text-white transition-colors text-left font-medium">
          <div className="flex items-center gap-2">
            <Flame size={13} className="text-[#F97316]" />
            <span>Change Priority</span>
          </div>
          <ChevronRight size={12} className="text-[#787C83]" />
        </button>

        {showPrioritySubmenu && (
          <div className="absolute left-full top-0 ml-1 min-w-[150px] bg-[#17181A] border border-[#2A2C30] rounded-xl shadow-2xl p-1.5 z-50">
            {priorities.map((pr) => (
              <button
                key={pr.id}
                onClick={() => {
                  onUpdatePriority?.(issue.id, pr.id);
                  onClose();
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#222427] transition-colors text-left text-xs ${
                  issue.priority === pr.id ? 'text-white font-bold bg-[#222427]' : 'text-[#CFD4DD]'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: pr.color }} />
                <span>{pr.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="my-1 border-t border-[#2A2C30]" />

      {/* 4. Copy Key */}
      <button
        onClick={handleCopyKey}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#222427] hover:text-white transition-colors text-left"
      >
        <Copy size={13} className="text-[#787C83]" />
        <span>Copy Task ID</span>
      </button>

      {/* 5. Copy Link */}
      <button
        onClick={handleCopyLink}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#222427] hover:text-white transition-colors text-left"
      >
        <LinkIcon size={13} className="text-[#787C83]" />
        <span>Copy Link</span>
      </button>

      {/* 6. Delete Task */}
      {canDelete && (
        <>
          <div className="my-1 border-t border-[#2A2C30]" />
          <button
            onClick={() => {
              onDelete?.(issue.id);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#EF4444]/15 text-[#EF4444] transition-colors text-left font-semibold"
          >
            <Trash2 size={13} />
            <span>Delete Task</span>
          </button>
        </>
      )}
    </div>
  );
};
