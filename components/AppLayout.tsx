'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { CommandPalette } from '@/components/CommandPalette';
import { NewIssueModal } from '@/components/NewIssueModal';
import { KeyboardShortcutsModal } from '@/components/KeyboardShortcutsModal';
import { DiffViewerModal } from '@/components/DiffViewerModal';
import { MOCK_ISSUES, MOCK_PROJECTS, SAMPLE_DIFFS } from '@/lib/mock-data';
import { Issue } from '@/lib/types';
import { toast } from 'sonner';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [issues, setIssues] = useState<Issue[]>(MOCK_ISSUES);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isNewIssueModalOpen, setIsNewIssueModalOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);

  // Global Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select') return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      } else if (e.key.toLowerCase() === 'c' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setIsNewIssueModalOpen(true);
      } else if (e.key === '?') {
        e.preventDefault();
        setIsShortcutsModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCreateIssue = (newIssue: Issue) => {
    setIssues((prev) => [newIssue, ...prev]);
    toast.success(`Created issue ${newIssue.key}`);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0F1011] text-[#CFD4DD] font-sans antialiased">
      {/* Sidebar with Next.js Link routing */}
      <Sidebar
        onOpenNewIssue={() => setIsNewIssueModalOpen(true)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenShortcuts={() => setIsShortcutsModalOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          {children}
        </main>
      </div>

      {/* Command Palette Modal (⌘K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        issues={issues}
        projects={MOCK_PROJECTS}
        onSelectIssue={() => {}}
        onOpenNewIssue={() => setIsNewIssueModalOpen(true)}
        onSelectView={() => {}}
      />

      {/* New Issue Modal (C) */}
      <NewIssueModal
        isOpen={isNewIssueModalOpen}
        onClose={() => setIsNewIssueModalOpen(false)}
        onCreateIssue={handleCreateIssue}
      />

      {/* Keyboard Shortcuts Modal (?) */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />

      {/* Git Diff Preview Modal */}
      <DiffViewerModal
        isOpen={isDiffModalOpen}
        onClose={() => setIsDiffModalOpen(false)}
        diffs={SAMPLE_DIFFS}
        title="Diff Preview: TDR-2703 (master)"
        onApply={() => toast.success('Changes committed!')}
      />
    </div>
  );
};
