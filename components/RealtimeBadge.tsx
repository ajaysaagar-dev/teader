'use client';

import React from 'react';
import { useRealtimeStatus } from '@/lib/useRealtime';
import { Wifi, WifiOff } from 'lucide-react';

export const RealtimeBadge: React.FC<{ minimal?: boolean }> = ({ minimal = false }) => {
  const { isConnected } = useRealtimeStatus();

  if (minimal) {
    return (
      <div
        className="flex items-center gap-1 text-[11px]"
        title={isConnected ? 'Live' : 'Reconnecting...'}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            isConnected ? 'bg-white' : 'bg-[var(--text-muted)]'
          }`}
        />
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] select-none"
      title={
        isConnected
          ? 'Connected: Data updates in real time'
          : 'Disconnected: Attempting to reconnect...'
      }
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          isConnected ? 'bg-white' : 'bg-[var(--text-muted)]'
        }`}
      />
      <span className="text-[11px] font-sans text-[var(--text-secondary)]">{isConnected ? 'Live' : 'Reconnecting'}</span>
    </div>
  );
};
