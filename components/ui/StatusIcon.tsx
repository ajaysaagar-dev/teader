import React from 'react';
import { Status } from '@/lib/types';

interface StatusIconProps {
  status: Status | string;
  size?: number;
  className?: string;
}

const statusColorMap: Record<string, string> = {
  backlog: 'text-neutral-400',
  todo: 'text-neutral-400',
  in_progress: 'text-amber-500',
  inprogress: 'text-amber-500',
  needs_review: 'text-violet-400',
  review: 'text-violet-400',
  in_review: 'text-violet-400',
  done: 'text-emerald-400',
  blocked: 'text-rose-500',
  cancelled: 'text-neutral-500',
  canceled: 'text-neutral-500',
  merged: 'text-blue-500',
};

export const StatusIcon: React.FC<StatusIconProps> = ({
  status,
  size = 14,
  className = '',
}) => {
  const normalized = (status || 'todo').toLowerCase();
  const defaultColor = statusColorMap[normalized] || 'text-neutral-400';
  const hasTextColor = className.includes('text-');
  const iconClass = `shrink-0 ${hasTextColor ? '' : defaultColor} ${className}`.trim();

  switch (normalized) {
    case 'backlog':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={iconClass}
          aria-label="Backlog"
        >
          <circle
            cx="8"
            cy="8"
            r="6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="2.2 2"
          />
        </svg>
      );

    case 'todo':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={iconClass}
          aria-label="Todo"
        >
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );

    case 'in_progress':
    case 'inprogress':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={iconClass}
          aria-label="In Progress"
        >
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
          <path d="M 8 2 A 6 6 0 0 1 8 14 Z" fill="currentColor" />
        </svg>
      );

    case 'blocked':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={iconClass}
          aria-label="Blocked"
        >
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M 8 4.8 v 3.8 M 8 11.2 v 0.4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'needs_review':
    case 'review':
    case 'in_review':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={iconClass}
          aria-label="Needs Review"
        >
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="8" cy="8" r="3.2" fill="currentColor" />
        </svg>
      );

    case 'done':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={iconClass}
          aria-label="Done"
        >
          <circle cx="8" cy="8" r="6.5" fill="currentColor" />
          <path
            d="M5.5 8.2 L7.2 9.9 L10.8 6.1"
            stroke="var(--bg-canvas, #000000)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'cancelled':
    case 'canceled':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={iconClass}
          aria-label="Cancelled"
        >
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
          <line
            x1="5.5"
            y1="5.5"
            x2="10.5"
            y2="10.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'merged':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={iconClass}
          aria-label="Merged"
        >
          <circle cx="5" cy="5" r="1.8" stroke="currentColor" strokeWidth="1.3" />
          <circle cx="5" cy="11" r="1.8" stroke="currentColor" strokeWidth="1.3" />
          <circle cx="11" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.3" />
          <path
            d="M5 6.8 v 2.4 M5 6.8 C 5 9.5 8 9.5 9.2 8.4"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      );

    default:
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={iconClass}
        >
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
  }
};
