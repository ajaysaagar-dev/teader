import React from 'react';
import { Priority } from '@/lib/types';

interface PriorityIconProps {
  priority: Priority | string;
  size?: number;
  className?: string;
}

const priorityColorMap: Record<string, string> = {
  critical: 'text-white',
  urgent: 'text-white',
  high: 'text-[#EDEDED]',
  medium: 'text-[#A3A3A3]',
  low: 'text-[#737373]',
  none: 'text-[#525252]',
};

export const PriorityIcon: React.FC<PriorityIconProps> = ({
  priority,
  size = 14,
  className = '',
}) => {
  const normalized = (priority || 'none').toLowerCase();
  const defaultColor = priorityColorMap[normalized] || 'text-neutral-400';
  const hasTextColor = className.includes('text-');
  const iconClass = `shrink-0 ${hasTextColor ? '' : defaultColor} ${className}`.trim();

  switch (normalized) {
    case 'critical':
    case 'urgent':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={iconClass}
          aria-label="Critical Priority"
        >
          <path
            d="M8 2.2 L14.5 13.5 H1.5 Z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <line
            x1="8"
            y1="6.2"
            x2="8"
            y2="9.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <circle cx="8" cy="11.6" r="0.8" fill="currentColor" />
        </svg>
      );

    case 'high':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={iconClass}
          aria-label="High Priority"
        >
          <rect x="2.5" y="9.5" width="2.4" height="4" rx="0.8" fill="currentColor" />
          <rect x="6.8" y="6.5" width="2.4" height="7" rx="0.8" fill="currentColor" />
          <rect x="11.1" y="3" width="2.4" height="10.5" rx="0.8" fill="currentColor" />
        </svg>
      );

    case 'medium':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={iconClass}
          aria-label="Medium Priority"
        >
          <rect x="2.5" y="9.5" width="2.4" height="4" rx="0.8" fill="currentColor" />
          <rect x="6.8" y="6.5" width="2.4" height="7" rx="0.8" fill="currentColor" />
          <rect
            x="11.1"
            y="3"
            width="2.4"
            height="10.5"
            rx="0.8"
            stroke="currentColor"
            strokeWidth="1"
            strokeOpacity="0.25"
          />
        </svg>
      );

    case 'low':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={iconClass}
          aria-label="Low Priority"
        >
          <rect x="2.5" y="9.5" width="2.4" height="4" rx="0.8" fill="currentColor" />
          <rect
            x="6.8"
            y="6.5"
            width="2.4"
            height="7"
            rx="0.8"
            stroke="currentColor"
            strokeWidth="1"
            strokeOpacity="0.25"
          />
          <rect
            x="11.1"
            y="3"
            width="2.4"
            height="10.5"
            rx="0.8"
            stroke="currentColor"
            strokeWidth="1"
            strokeOpacity="0.25"
          />
        </svg>
      );

    case 'none':
    default:
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={iconClass}
          aria-label="No Priority"
        >
          <line
            x1="3"
            y1="8"
            x2="13"
            y2="8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="2.2 2.2"
          />
        </svg>
      );
  }
};
