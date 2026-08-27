import React from 'react';
import { RandomLoadingText } from '@/components/ui/RandomLoadingText';

export default function Loading() {
  return (
    <div className="flex-1 h-full min-h-screen bg-[#131415] text-[#CFD4DD] flex items-center justify-center p-6 select-none font-sans">
      <div className="flex flex-col items-center gap-4 max-w-lg text-center">
        <div className="w-9 h-9 rounded-full border-2 border-[#DCB001] border-t-transparent animate-spin" />
        <span className="text-sm text-white font-bold tracking-tight">
          Loading Teader Workspace...
        </span>
        <RandomLoadingText className="mt-1" />
      </div>
    </div>
  );
}

