'use client';

import React from 'react';
import { Issue } from '@/lib/types';
import { 
  Star, 
  ChevronLeft, 
  ChevronRight, 
  GitBranch, 
  Search, 
  LayoutList, 
  Kanban, 
  SlidersHorizontal, 
  LineChart, 
  Copy,
  Check
} from 'lucide-react';
import { toast } from 'sonner';

interface HeaderProps {
  activeIssue: Issue | null;
  activeView: 'details' | 'kanban' | 'timeline' | 'analytics';
  onSelectView: (view: 'details' | 'kanban' | 'timeline' | 'analytics') => void;
  onToggleFavorite?: () => void;
  onOpenCommandPalette: () => void;
  onPrevIssue?: () => void;
  onNextIssue?: () => void;
  onOpenDiffModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeIssue,
  activeView,
  onSelectView,
  onToggleFavorite,
  onOpenCommandPalette,
  onPrevIssue,
  onNextIssue,
  onOpenDiffModal,
}) => {
  const [copiedLink, setCopiedLink] = React.useState(false);

  const handleCopyLink = () => {
    if (activeIssue) {
      navigator.clipboard.writeText(`${window.location.origin}/task/${activeIssue.id || activeIssue.key}/details`);
      setCopiedLink(true);
      toast.success(`Copied link for ${activeIssue.key}`);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const views = [
    { id: 'details', label: 'Issue Details', icon: LayoutList },
    { id: 'kanban', label: 'Kanban Board', icon: Kanban },
    { id: 'timeline', label: 'Timeline & Sprints', icon: SlidersHorizontal },
    { id: 'analytics', label: 'Velocity Pulse', icon: LineChart },
  ];

  return (
    <header className="h-14 bg-[var(--bg-header)] border-b border-[var(--border-primary)] px-4 flex items-center justify-between select-none shrink-0">
      {/* Left: Breadcrumbs & Navigation */}
      <div className="flex items-center gap-3">
        {/* Issue prev/next controls */}
        <div className="flex items-center border border-[var(--border-primary)] rounded-lg overflow-hidden bg-[var(--bg-sidebar)]">
          <button
            onClick={onPrevIssue}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors border-r border-[var(--border-primary)]"
            title="Previous Issue"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={onNextIssue}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            title="Next Issue"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer font-medium">
            {activeIssue ? activeIssue.project : 'Teader'}
          </span>
          <span className="text-[var(--border-secondary)]">/</span>
          {activeIssue && (
            <div className="flex items-center gap-1.5 font-mono text-[var(--accent-yellow)] font-semibold bg-[var(--accent-yellow-subtle)] px-2 py-0.5 rounded border border-[var(--accent-yellow-dark)]/40">
              <span>{activeIssue.key}</span>
              <button
                onClick={onToggleFavorite}
                className="ml-1 text-[var(--accent-yellow)] hover:scale-110 transition-transform"
              >
                <Star
                  size={12}
                  className={activeIssue.isFavorite ? 'fill-[var(--accent-yellow)]' : 'text-[var(--text-muted)]'}
                />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Center: View Switcher Tabs */}
      <div className="flex items-center p-1 bg-[var(--bg-sidebar)] border border-[var(--border-primary)] rounded-lg space-x-1">
        {views.map((v) => {
          const Icon = v.icon;
          const isActive = activeView === v.id;
          return (
            <button
              key={v.id}
              onClick={() => onSelectView(v.id as any)}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
                isActive
                  ? 'bg-[var(--bg-hover)] text-[var(--accent-yellow)] border border-[var(--border-primary)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-input)]'
              }`}
            >
              <Icon size={14} />
              <span className="hidden sm:inline">{v.label}</span>
            </button>
          );
        })}
      </div>

      {/* Right: Git Branch, Search */}
      <div className="flex items-center gap-2">
        {activeIssue?.gitBranch && (
          <button
            onClick={onOpenDiffModal}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border border-[var(--border-primary)] rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
            title="View linked Git branch diff"
          >
            <GitBranch size={13} className="text-[var(--cyan)]" />
            <span className="truncate max-w-[120px]">{activeIssue.gitBranch}</span>
            <span className="text-[10px] px-1 bg-[var(--bg-panel)] text-[var(--success)] rounded">
              +{activeIssue.pullRequest?.additions || 24}
            </span>
          </button>
        )}

        {/* Copy Link */}
        <button
          onClick={handleCopyLink}
          className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] border border-[var(--border-primary)] rounded-lg transition-colors"
          title="Copy Link"
        >
          {copiedLink ? <Check size={14} className="text-[var(--success)]" /> : <Copy size={14} />}
        </button>

        {/* Search Modal Trigger */}
        <button
          onClick={onOpenCommandPalette}
          className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] border border-[var(--border-primary)] rounded-lg transition-colors"
          title="Command Palette (⌘K)"
        >
          <Search size={14} />
        </button>
      </div>
    </header>
  );
};
