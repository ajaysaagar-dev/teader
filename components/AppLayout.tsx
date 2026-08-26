'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { CommandPalette } from '@/components/CommandPalette';
import { KeyboardShortcutsModal } from '@/components/KeyboardShortcutsModal';
import { Issue, FileDiff } from '@/lib/types';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';

const NewIssueModal = dynamic(() => import('@/components/NewIssueModal').then(m => ({ default: m.NewIssueModal })), { ssr: false });
const DiffViewerModal = dynamic(() => import('@/components/DiffViewerModal').then(m => ({ default: m.DiffViewerModal })), { ssr: false });

interface AppLayoutProps {
  children: React.ReactNode;
}

const SAMPLE_DIFFS: FileDiff[] = [
  {
    path: 'src/api/workspace.ts',
    status: 'modified',
    additions: 1,
    deletions: 1,
    hunks: [
      {
        header: '@@ -12,4 +12,4 @@',
        lines: [
          { type: 'context', content: '  async function loadWorkspace(id: string) {' },
          { type: 'delete', content: "    const data = await fetch('/api/workspace/' + id);" },
          { type: 'add', content: "    const data = await fetch('/api/workspace/' + id, { cache: 'no-store' });" },
          { type: 'context', content: '    return data.json();' },
        ],
      },
    ],
  },
];


export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isNewIssueModalOpen, setIsNewIssueModalOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);

  // Fetch real data for Command Palette
  useEffect(() => {
    Promise.all([
      fetch('/api/issues').then(r => r.ok ? r.json() : []).catch(() => []),
      fetch('/api/projects').then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([issueData, projectData]) => {
      if (Array.isArray(issueData)) setIssues(issueData);
      if (Array.isArray(projectData)) setProjects(projectData);
    });
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isEditable = tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target as HTMLElement)?.isContentEditable;
      if (isEditable) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      } else if (e.key.toLowerCase() === 'c' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setIsNewIssueModalOpen(true);
      } else if (e.key === '?') {
        e.preventDefault();
        setIsShortcutsModalOpen(true);
      } else if (e.key === 'Escape') {
        setIsCommandPaletteOpen(false);
        setIsShortcutsModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCreateIssue = (newIssue: Issue) => {
    setIssues(prev => [newIssue, ...prev]);
    toast.success(`Created ${newIssue.key}`);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0F1011] text-[#CFD4DD] font-sans antialiased">
      <Sidebar
        onOpenNewIssue={() => setIsNewIssueModalOpen(true)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenShortcuts={() => setIsShortcutsModalOpen(true)}
      />

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          {children}
        </main>
      </div>

      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        issues={issues}
        projects={projects}
        onSelectIssue={() => setIsCommandPaletteOpen(false)}
        onOpenNewIssue={() => { setIsCommandPaletteOpen(false); setIsNewIssueModalOpen(true); }}
        onSelectView={() => setIsCommandPaletteOpen(false)}
      />

      {/* New Issue Modal */}
      {isNewIssueModalOpen && (
        <Suspense fallback={null}>
          <NewIssueModal
            isOpen={isNewIssueModalOpen}
            onClose={() => setIsNewIssueModalOpen(false)}
            onCreateIssue={handleCreateIssue}
          />
        </Suspense>
      )}

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />

      {/* Git Diff Preview Modal */}
      {isDiffModalOpen && (
        <Suspense fallback={null}>
          <DiffViewerModal
            isOpen={isDiffModalOpen}
            onClose={() => setIsDiffModalOpen(false)}
            diffs={SAMPLE_DIFFS}
            title="Diff Preview"
            onApply={() => { toast.success('Changes applied!'); setIsDiffModalOpen(false); }}
          />
        </Suspense>
      )}
    </div>
  );
};
