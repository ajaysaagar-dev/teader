import React from 'react';
import { Status } from '@/lib/types';
import { StatusIcon } from './StatusIcon';

interface StatusBadgeProps {
  status: Status;
  showText?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

export const STATUS_CONFIG: Record<
  Status,
  { label: string; color: string; bg: string; icon: React.FC<{ size?: number; className?: string }> }
> = {
  todo: {
    label: 'Todo',
    color: 'var(--text-secondary)',
    bg: 'var(--ramp-1)',
    icon: (props) => <StatusIcon status="todo" {...props} />,
  },
  in_progress: {
    label: 'In Progress',
    color: 'var(--text-primary)',
    bg: 'var(--ramp-1)',
    icon: (props) => <StatusIcon status="in_progress" {...props} />,
  },
  blocked: {
    label: 'Blocked',
    color: 'var(--text-primary)',
    bg: 'var(--ramp-1)',
    icon: (props) => <StatusIcon status="blocked" {...props} />,
  },
  needs_review: {
    label: 'Needs Review',
    color: 'var(--text-primary)',
    bg: 'var(--ramp-1)',
    icon: (props) => <StatusIcon status="needs_review" {...props} />,
  },
  done: {
    label: 'Done',
    color: 'var(--text-primary)',
    bg: 'var(--ramp-1)',
    icon: (props) => <StatusIcon status="done" {...props} />,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'var(--text-muted)',
    bg: 'var(--ramp-1)',
    icon: (props) => <StatusIcon status="cancelled" {...props} />,
  },
  merged: {
    label: 'Merged',
    color: 'var(--text-primary)',
    bg: 'var(--ramp-1)',
    icon: (props) => <StatusIcon status="merged" {...props} />,
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ 
  status, 
  showText = true, 
  className = '',
  size = 'md' 
}) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.todo;
  const iconSize = size === 'sm' ? 12 : 13;

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded border border-[var(--border-primary)] bg-[var(--ramp-1)] text-[var(--text-secondary)] transition-colors select-none ${
        size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-xs'
      } ${className}`}
    >
      <StatusIcon status={status} size={iconSize} className="text-[var(--text-primary)] shrink-0" />
      {showText && <span>{config.label}</span>}
    </span>
  );
};
