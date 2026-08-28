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
            isConnected ? 'bg-[#22C55E] shadow-[0_0_8px_#22C55E] animate-pulse' : 'bg-[#EF4444]'
          }`}
        />
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono border transition-all select-none ${
        isConnected
          ? 'bg-[#22C55E]/10 border-[#22C55E]/30 text-[#22C55E]'
          : 'bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]'
      }`}
      title={
        isConnected
          ? 'Connected to Real-time WebSocket: Data and alignments update instantly across all users'
          : 'Realtime WebSocket disconnected: Attempting auto-reconnect...'
      }
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          isConnected ? 'bg-[#22C55E] animate-pulse shadow-[0_0_6px_#22C55E]' : 'bg-[#EF4444]'
        }`}
      />
      <span>{isConnected ? 'LIVE SYNC' : 'RECONNECTING'}</span>
    </div>
  );
};
