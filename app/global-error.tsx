'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-[var(--bg-canvas)] text-[var(--text-secondary)] font-sans antialiased min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[var(--bg-panel)] border border-[var(--border-secondary)] rounded-2xl p-8 text-center space-y-6 shadow-2xl">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--ramp-3)]/10 text-white border border-[var(--border-secondary)]">
            <AlertTriangle size={28} />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-white tracking-tight">Critical Application Error</h1>
            <p className="text-xs text-[var(--text-muted)] font-mono leading-relaxed break-words">
              {error.message || 'A fatal system error occurred. Please refresh or reload the application.'}
            </p>
          </div>
          <button
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-black hover:bg-[#FFFFFF] rounded-xl text-xs font-bold transition-all shadow-md"
          >
            <RefreshCw size={14} />
            <span>Reload Application</span>
          </button>
        </div>
      </body>
    </html>
  );
}
