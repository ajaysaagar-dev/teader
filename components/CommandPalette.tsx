'use client';

import React, { useState, useEffect } from 'react';
import { Issue, Project } from '@/lib/types';
import { 
  Search,
  PlusCircle, 
  ArrowRight,
  Kanban,
  LineChart,
  SlidersHorizontal,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  issues: Issue[];
  projects: Project[];
  onSelectIssue: (issueId: string) => void;
  onOpenNewIssue: () => void;
  onSelectView: (view: 'details' | 'kanban' | 'timeline' | 'analytics') => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  issues,
  projects,
  onSelectIssue,
  onOpenNewIssue,
  onSelectView,
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else setQuery('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredIssues = issues.filter(
    (i) =>
      i.title.toLowerCase().includes(query.toLowerCase()) ||
      i.key.toLowerCase().includes(query.toLowerCase()) ||
      i.labels.some((l) => l.toLowerCase().includes(query.toLowerCase()))
  );

  const filteredProjects = projects.filter(
    (p) => p.name.toLowerCase().includes(query.toLowerCase()) || p.key.toLowerCase().includes(query.toLowerCase())
  );

  const actions = [
    {
      id: 'act_new',
      label: 'Create New Issue',
      icon: PlusCircle,
      action: () => {
        onOpenNewIssue();
        onClose();
      },
    },
    {
      id: 'act_kanban',
      label: 'Switch to Kanban Board View',
      icon: Kanban,
      action: () => {
        onSelectView('kanban');
        onClose();
      },
    },
    {
      id: 'act_timeline',
      label: 'Switch to Timeline / Gantt Roadmap',
      icon: SlidersHorizontal,
      action: () => {
        onSelectView('timeline');
        onClose();
      },
    },
    {
      id: 'act_analytics',
      label: 'Open Team Velocity & Metrics',
      icon: LineChart,
      action: () => {
        onSelectView('analytics');
        onClose();
      },
    },
  ].filter((a) => a.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/75 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          className="w-full max-w-2xl bg-[#1B1C1F] border border-[#2A2C30] rounded-xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Search Input Bar */}
          <div className="flex items-center px-4 py-3 border-b border-[#2A2C30] bg-[#0F1011]">
            <Search size={18} className="text-[#787C83] mr-3" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a command, search issues, or projects... (ESC to exit)"
              className="w-full bg-transparent text-sm text-[#CFD4DD] placeholder-[#787C83] outline-none"
            />
            {query && (
              <button onClick={() => setQuery('')} className="p-1 text-[#787C83] hover:text-white">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Results Container */}
          <div className="max-h-[60vh] overflow-y-auto p-2 divide-y divide-[#2A2C30]">
            {/* Quick Actions */}
            {actions.length > 0 && (
              <div className="py-2">
                <div className="px-3 py-1 text-[11px] font-semibold text-[#787C83] uppercase tracking-wider">
                  Quick Actions
                </div>
                {actions.map((act) => {
                  const Icon = act.icon;
                  return (
                    <button
                      key={act.id}
                      onClick={act.action}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg hover:bg-[#222427] text-[#CFD4DD] group transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon size={15} className="text-[#DCB001] group-hover:scale-110 transition-transform" />
                        <span>{act.label}</span>
                      </div>
                      <ArrowRight size={13} className="text-[#787C83] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  );
                })}
              </div>
            )}

            {/* Issues */}
            {filteredIssues.length > 0 && (
              <div className="py-2">
                <div className="px-3 py-1 text-[11px] font-semibold text-[#787C83] uppercase tracking-wider">
                  Issues ({filteredIssues.length})
                </div>
                {filteredIssues.map((issue) => (
                  <button
                    key={issue.id}
                    onClick={() => {
                      onSelectIssue(issue.id);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg hover:bg-[#222427] text-[#CFD4DD] transition-colors"
                  >
                    <div className="flex items-center gap-2 overflow-hidden mr-2">
                      <span className="font-mono text-[11px] text-[#DCB001] shrink-0 font-medium">{issue.key}</span>
                      <span className="truncate text-[#9499A0] hover:text-white">{issue.title}</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-[#1A1B1D] text-[#787C83] shrink-0 font-mono border border-[#2A2C30]">
                      {issue.status.replace('_', ' ')}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Projects */}
            {filteredProjects.length > 0 && (
              <div className="py-2">
                <div className="px-3 py-1 text-[11px] font-semibold text-[#787C83] uppercase tracking-wider">
                  Projects ({filteredProjects.length})
                </div>
                {filteredProjects.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-3 py-2 text-xs rounded-lg hover:bg-[#222427] text-[#CFD4DD]"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="font-semibold">{p.key}</span>
                      <span className="text-[#787C83]">{p.name}</span>
                    </div>
                    <span className="text-[11px] text-[#787C83]">{p.issueCount} issues</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Shortcuts */}
          <div className="flex items-center justify-between px-4 py-2 bg-[#0F1011] border-t border-[#2A2C30] text-[11px] text-[#787C83]">
            <div className="flex items-center gap-3">
              <span><kbd className="px-1.5 py-0.5 bg-[#2A2C30] rounded text-[10px] text-[#CFD4DD]">↑↓</kbd> Navigate</span>
              <span><kbd className="px-1.5 py-0.5 bg-[#2A2C30] rounded text-[10px] text-[#CFD4DD]">↵</kbd> Select</span>
              <span><kbd className="px-1.5 py-0.5 bg-[#2A2C30] rounded text-[10px] text-[#CFD4DD]">ESC</kbd> Close</span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
