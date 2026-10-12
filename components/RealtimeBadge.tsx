'use client';

import React from 'react';
import { useRealtimeStatus } from '@/lib/useRealtime';
import { Wifi, WifiOff } from 'lucide-react';

export const RealtimeBadge: React.FC<{ minimal?: boolean }> = ({ minimal = false }) => {
  const { isConnected } = useRealtimeStatus();

  if (minimal) {
    return (
      <div
        className="flex items-center gap-1 text-[10px] font-mono"
        title={isConnected ? 'Real-time WebSocket Live' : 'Real-time Reconnecting...'}
      >
        <span
          className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-[var(--ramp-3)] shadow-[0_0_8px_#FFFFFF] animate-pulse' : 'bg-[var(--ramp-3)]'
          }`}
        />
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono border transition-all select-none ${
        isConnected
          ? 'bg-[var(--ramp-3)]/10 border-[var(--border-secondary)] text-white'
          : 'bg-[var(--ramp-3)]/10 border-[var(--border-secondary)] text-white'
      }`}
      title={
        isConnected
          ? 'Connected to Real-time WebSocket: Data and alignments update instantly across all users'
          : 'Realtime WebSocket disconnected: Attempting auto-reconnect...'
      }
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          isConnected ? 'bg-[var(--ramp-3)] animate-pulse shadow-[0_0_6px_#FFFFFF]' : 'bg-[var(--ramp-3)]'
        }`}
      />
      <span>{isConnected ? 'LIVE SYNC' : 'RECONNECTING'}</span>
    </div>
  );
};
