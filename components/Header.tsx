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
    <header className="h-14 bg-[#131415] border-b border-[#2A2C30] px-4 flex items-center justify-between select-none shrink-0">
      {/* Left: Breadcrumbs & Navigation */}
      <div className="flex items-center gap-3">
        {/* Issue prev/next controls */}
        <div className="flex items-center border border-[#2A2C30] rounded-lg overflow-hidden bg-[#0F1011]">
          <button
            onClick={onPrevIssue}
            className="p-1.5 text-[#787C83] hover:text-[#CFD4DD] hover:bg-[#222427] transition-colors border-r border-[#2A2C30]"
            title="Previous Issue"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={onNextIssue}
            className="p-1.5 text-[#787C83] hover:text-[#CFD4DD] hover:bg-[#222427] transition-colors"
            title="Next Issue"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#787C83] hover:text-[#CFD4DD] transition-colors cursor-pointer font-medium">
            {activeIssue ? activeIssue.project : 'Teader'}
          </span>
          <span className="text-[#3B3D41]">/</span>
          {activeIssue && (
            <div className="flex items-center gap-1.5 font-mono text-[#DCB001] font-semibold bg-[#1F1E19] px-2 py-0.5 rounded border border-[#AE8D05]/40">
              <span>{activeIssue.key}</span>
              <button
                onClick={onToggleFavorite}
                className="ml-1 text-[#DCB001] hover:scale-110 transition-transform"
              >
                <Star
                  size={12}
                  className={activeIssue.isFavorite ? 'fill-[#DCB001]' : 'text-[#787C83]'}
                />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Center: View Switcher Tabs */}
      <div className="flex items-center p-1 bg-[#0F1011] border border-[#2A2C30] rounded-lg space-x-1">
        {views.map((v) => {
          const Icon = v.icon;
          const isActive = activeView === v.id;
          return (
            <button
              key={v.id}
              onClick={() => onSelectView(v.id as any)}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
                isActive
                  ? 'bg-[#222427] text-[#DCB001] border border-[#2A2C30] shadow-sm'
                  : 'text-[#787C83] hover:text-[#CFD4DD] hover:bg-[#1A1B1D]'
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
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono bg-[#1B1C1F] hover:bg-[#222427] border border-[#2A2C30] rounded-lg text-[#9499A0] hover:text-[#CFD4DD] transition-all"
            title="View linked Git branch diff"
          >
            <GitBranch size={13} className="text-[#0391A1]" />
            <span className="truncate max-w-[120px]">{activeIssue.gitBranch}</span>
            <span className="text-[10px] px-1 bg-[#17181A] text-[#22C55E] rounded">
              +{activeIssue.pullRequest?.additions || 24}
            </span>
          </button>
        )}

        {/* Copy Link */}
        <button
          onClick={handleCopyLink}
          className="p-1.5 text-[#787C83] hover:text-[#CFD4DD] hover:bg-[#222427] border border-[#2A2C30] rounded-lg transition-colors"
          title="Copy Link"
        >
          {copiedLink ? <Check size={14} className="text-[#22C55E]" /> : <Copy size={14} />}
        </button>

        {/* Search Modal Trigger */}
        <button
          onClick={onOpenCommandPalette}
          className="p-1.5 text-[#787C83] hover:text-[#CFD4DD] hover:bg-[#222427] border border-[#2A2C30] rounded-lg transition-colors"
          title="Command Palette (⌘K)"
        >
          <Search size={14} />
        </button>
      </div>
    </header>
  );
};
