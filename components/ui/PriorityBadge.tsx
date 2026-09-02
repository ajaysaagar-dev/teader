import React from 'react';
import { Priority } from '@/lib/types';
import { Flame, ShieldAlert, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface PriorityBadgeProps {
  priority: Priority;
  showText?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

export const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  critical: {
    label: 'Critical',
    color: 'var(--priority-critical, #EF4444)',
    bg: 'var(--priority-critical-bg, rgba(239, 68, 68, 0.12))',
    icon: Flame,
  },
  high: {
    label: 'High',
    color: 'var(--priority-high, #F97316)',
    bg: 'var(--priority-high-bg, rgba(249, 115, 22, 0.12))',
    icon: ShieldAlert,
  },
  medium: {
    label: 'Medium',
    color: 'var(--priority-medium, #3B82F6)',
    bg: 'var(--priority-medium-bg, rgba(59, 130, 246, 0.12))',
    icon: ArrowUpRight,
  },
  low: {
    label: 'Low',
    color: 'var(--priority-low, #9499A0)',
    bg: 'var(--priority-low-bg, rgba(148, 153, 160, 0.12))',
    icon: ArrowDownRight,
  },
  none: {
    label: 'No Priority',
    color: 'var(--text-disabled, #585C60)',
    bg: 'var(--bg-main, #131415)',
    icon: Minus,
  },
};

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({
  priority,
  showText = true,
  className = '',
  size = 'md',
}) => {
  const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.none;
  const Icon = config.icon;
  const iconSize = size === 'sm' ? 12 : 14;

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-md border transition-colors ${
        size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-xs'
      } ${className}`}
      style={{
        color: config.color,
        backgroundColor: config.bg,
        borderColor: `${config.color}35`,
      }}
    >
      <Icon size={iconSize} className="shrink-0" />
      {showText && <span>{config.label}</span>}
    </span>
  );
};
