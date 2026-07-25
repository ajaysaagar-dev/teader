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
    color: '#787C83',
    bg: '#1A1B1D',
    icon: Circle,
  },
  in_progress: {
    label: 'In Progress',
    color: '#DCB001',
    bg: '#222427',
    icon: Clock,
  },
  blocked: {
    label: 'Blocked',
    color: '#C0393B',
    bg: '#222427',
    icon: AlertCircle,
  },
  needs_review: {
    label: 'Needs Review',
    color: '#0391A1',
    bg: '#17181A',
    icon: Eye,
  },
  done: {
    label: 'Done',
    color: '#22C55E',
    bg: '#17181A',
    icon: CheckCircle2,
  },
  cancelled: {
    label: 'Cancelled',
    color: '#585C60',
    bg: '#131415',
    icon: XCircle,
  },
  merged: {
    label: 'Merged',
    color: '#AE8D05',
    bg: '#1A1B1D',
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
