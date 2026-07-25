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
    color: '#C0393B',
    bg: '#1F1718',
    icon: Flame,
  },
  high: {
    label: 'High',
    color: '#DCB001',
    bg: '#1F1E19',
    icon: ShieldAlert,
  },
  medium: {
    label: 'Medium',
    color: '#0391A1',
    bg: '#141C1E',
    icon: ArrowUpRight,
  },
  low: {
    label: 'Low',
    color: '#9499A0',
    bg: '#1A1B1D',
    icon: ArrowDownRight,
  },
  none: {
    label: 'No Priority',
    color: '#585C60',
    bg: '#131415',
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
