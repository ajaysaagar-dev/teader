'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[App Error Boundary]:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#131415] text-[#CFD4DD] font-sans flex flex-col justify-center items-center p-6 select-none relative overflow-hidden">
      <div className="max-w-md w-full bg-[#1B1C1F] border border-[#EF4444]/30 rounded-2xl p-8 text-center space-y-6 shadow-2xl relative z-10">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/30">
          <AlertTriangle size={28} />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white tracking-tight">Something went wrong</h2>
          <p className="text-xs text-[#787C83] leading-relaxed font-mono break-words">
            {error.message || 'An unexpected application error occurred while rendering this view.'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-[#DCB001] hover:bg-[#c49c00] text-[#0F1011] rounded-xl text-xs font-bold transition-all shadow-md"
          >
            <RefreshCw size={14} />
            <span>Try Again</span>
          </button>

          <Link
            href="/projects"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-[#131415] hover:bg-[#222427] text-[#CFD4DD] border border-[#2A2C30] rounded-xl text-xs font-semibold transition-all"
          >
            <Home size={14} />
            <span>Go to Projects</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
