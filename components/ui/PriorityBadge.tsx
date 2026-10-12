import React from 'react';
import { Priority } from '@/lib/types';
import { PriorityIcon } from './PriorityIcon';

interface PriorityBadgeProps {
  priority: Priority;
  showText?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

export const PRIORITY_CONFIG: Record<
  Priority,
  { label: string; color: string; bg: string; icon: React.FC<{ size?: number; className?: string }> }
> = {
  critical: {
    label: 'Critical',
    color: 'var(--text-primary)',
    bg: 'var(--ramp-1)',
    icon: (props) => <PriorityIcon priority="critical" {...props} />,
  },
  high: {
    label: 'High',
    color: 'var(--text-primary)',
    bg: 'var(--ramp-1)',
    icon: (props) => <PriorityIcon priority="high" {...props} />,
  },
  medium: {
    label: 'Medium',
    color: 'var(--text-secondary)',
    bg: 'var(--ramp-1)',
    icon: (props) => <PriorityIcon priority="medium" {...props} />,
  },
  low: {
    label: 'Low',
    color: 'var(--text-muted)',
    bg: 'var(--ramp-1)',
    icon: (props) => <PriorityIcon priority="low" {...props} />,
  },
  none: {
    label: 'No Priority',
    color: 'var(--text-muted)',
    bg: 'var(--ramp-1)',
    icon: (props) => <PriorityIcon priority="none" {...props} />,
  },
};

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({
  priority,
  showText = true,
  className = '',
  size = 'md',
}) => {
  const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.none;
  const iconSize = size === 'sm' ? 12 : 13;

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded border border-[var(--border-primary)] bg-[var(--ramp-1)] text-[var(--text-secondary)] transition-colors select-none ${
        size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-xs'
      } ${className}`}
    >
      <PriorityIcon priority={priority} size={iconSize} className="text-[var(--text-primary)] shrink-0" />
      {showText && <span>{config.label}</span>}
    </span>
  );
};
