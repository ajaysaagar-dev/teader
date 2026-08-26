import React from 'react';
import Link from 'next/link';
import { FolderKanban, ArrowLeft, AlertCircle, Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#131415] text-[#CFD4DD] font-sans flex flex-col justify-center items-center p-6 select-none relative overflow-hidden">
      {/* Glow Effect */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#DCB001]/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-md w-full bg-[#1B1C1F] border border-[#2A2C30] rounded-2xl p-8 text-center space-y-6 shadow-2xl relative z-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#DCB001]/10 text-[#DCB001] border border-[#DCB001]/30">
          <Compass size={32} className="animate-spin" style={{ animationDuration: '12s' }} />
        </div>

        <div className="space-y-2">
          <div className="font-mono text-xs text-[#DCB001] font-bold tracking-widest uppercase">
            404 · Page Not Found
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Lost in the Workspace?
          </h1>
          <p className="text-xs text-[#787C83] leading-relaxed">
            The task, project, or view you are looking for does not exist or may have been moved.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/projects"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-[#DCB001] hover:bg-[#c49c00] text-[#0F1011] rounded-xl text-xs font-bold transition-all shadow-md"
          >
            <FolderKanban size={14} />
            <span>Go to Projects</span>
          </Link>

          <Link
            href="/dashboard"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-[#131415] hover:bg-[#222427] text-[#CFD4DD] border border-[#2A2C30] rounded-xl text-xs font-semibold transition-all"
          >
            <ArrowLeft size={14} />
            <span>Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
