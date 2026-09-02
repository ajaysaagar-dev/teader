import React from 'react';
import { Status } from '@/lib/types';
import { 
  Circle, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  GitMerge 
} from 'lucide-react';

interface StatusBadgeProps {
  status: Status;
  showText?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

export const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  todo: {
    label: 'Todo',
    color: 'var(--status-todo, #787C83)',
    bg: 'var(--status-todo-bg, rgba(120, 124, 131, 0.12))',
    icon: Circle,
  },
  in_progress: {
    label: 'In Progress',
    color: 'var(--status-inprogress, #DCB001)',
    bg: 'var(--status-inprogress-bg, rgba(220, 176, 1, 0.12))',
    icon: Clock,
  },
  blocked: {
    label: 'Blocked',
    color: 'var(--status-blocked, #EF4444)',
    bg: 'var(--status-blocked-bg, rgba(239, 68, 68, 0.12))',
    icon: AlertCircle,
  },
  needs_review: {
    label: 'Needs Review',
    color: 'var(--status-review, #A855F7)',
    bg: 'var(--status-review-bg, rgba(168, 85, 247, 0.12))',
    icon: Eye,
  },
  done: {
    label: 'Done',
    color: 'var(--status-done, #22C55E)',
    bg: 'var(--status-done-bg, rgba(34, 197, 94, 0.12))',
    icon: CheckCircle2,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'var(--status-cancelled, #64748B)',
    bg: 'var(--status-cancelled-bg, rgba(100, 116, 139, 0.12))',
    icon: XCircle,
  },
  merged: {
    label: 'Merged',
    color: 'var(--accent-yellow-dark, #AE8D05)',
    bg: 'var(--bg-card, #1A1B1D)',
    icon: GitMerge,
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ 
  status, 
  showText = true, 
  className = '',
  size = 'md' 
}) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.todo;
  const Icon = config.icon;
  const iconSize = size === 'sm' ? 13 : 15;

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border transition-all duration-150 ${
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      } ${className}`}
      style={{
        color: config.color,
        backgroundColor: config.bg,
        borderColor: `${config.color}40`,
      }}
    >
      <Icon className="shrink-0" size={iconSize} />
      {showText && <span>{config.label}</span>}
    </span>
  );
};
