import React from 'react';

export default function Loading() {
  return (
    <div className="flex-1 h-full min-h-screen bg-[#131415] text-[#CFD4DD] flex items-center justify-center p-6 select-none font-sans">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[#DCB001] border-t-transparent animate-spin" />
        <span className="text-xs text-[#787C83] font-mono animate-pulse">
          Loading Teader Workspace...
        </span>
      </div>
    </div>
  );
}
