'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, BookOpen, LayoutDashboard, Terminal } from 'lucide-react';
import 'swagger-ui-react/swagger-ui.css';
import { swaggerSpec } from '@/lib/swagger-spec';
import { BUILD_NUMBER } from '@/lib/build-info';

const SwaggerUI = dynamic(() => import('swagger-ui-react'), { 
  ssr: false,
  loading: () => (
    <div className="p-12 text-center text-gray-500 font-mono text-sm flex items-center justify-center gap-3">
      <div className="w-5 h-5 border-2 border-[#DCB001] border-t-transparent rounded-full animate-spin" />
      <span>Loading OpenAPI Specification...</span>
    </div>
  )
});

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-[#0A0B0D] text-[#CFD4DD] flex flex-col font-sans">
      {/* Docs Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0A0B0D]/90 border-b border-[#222428]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 group" aria-label="Teader Home">
              <span className="font-extrabold text-xl text-white tracking-tight flex items-center gap-1 font-prompt">
                teader <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-[#1F2126] text-[#DCB001] rounded border border-[#2E3138]">{BUILD_NUMBER}</span>
              </span>
            </Link>
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-[#787C83] border-l border-[#222428] pl-4">
              <BookOpen size={14} className="text-[#DCB001]" />
              <span>API Reference & OpenAPI Specification</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#16181C] hover:bg-[#1E2025] text-[#CFD4DD] hover:text-white border border-[#2A2C30] text-xs font-medium transition-all"
            >
              <ArrowLeft size={13} />
              <span>Back to Home</span>
            </Link>

            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#DCB001] hover:bg-[#E5B800] text-[#0A0B0D] font-bold text-xs transition-all shadow-sm"
            >
              <LayoutDashboard size={13} />
              <span>Dashboard</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <div className="bg-[#121417] border border-[#222428] rounded-2xl p-6 mb-6 shadow-sm">
          <div className="flex items-center gap-2.5 text-[#DCB001] font-mono text-xs font-semibold mb-2">
            <Terminal size={14} />
            <span>OPENAPI 3.0 SPECIFICATION</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-2">
            Teader API Interactive Documentation
          </h1>
          <p className="text-sm text-[#8E939D] leading-relaxed max-w-3xl">
            Interactive OpenAPI 3.0 specification for Teader endpoints, projects, task management, realtime events, and automations.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-[#222428] p-4 sm:p-6 overflow-hidden">
          <SwaggerUI spec={swaggerSpec} />
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 px-6 border-t border-[#18191C] bg-[#070708] text-xs text-[#6B707B] font-mono text-center">
        <p>Teader API Specification ({BUILD_NUMBER}) © 2026. All rights reserved.</p>
      </footer>
    </div>
  );
}
