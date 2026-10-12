'use client';

import React, { useEffect, useRef } from 'react';
import { Tag } from 'lucide-react';
import { TaskMentionOption } from '@/lib/task-id';

interface TaskMentionPopoverProps {
  query: string;
  options: TaskMentionOption[];
  selectedIndex: number;
  onSelect: (option: TaskMentionOption) => void;
  onClose: () => void;
  className?: string;
}

export const TaskMentionPopover: React.FC<TaskMentionPopoverProps> = ({
  query,
  options,
  selectedIndex,
  onSelect,
  onClose,
  className = '',
}) => {
  const listRef = useRef<HTMLDivElement>(null);

  // Filter options based on query
  const filtered = React.useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return options.slice(0, 8);
    return options
      .filter((opt) => {
        return (
          opt.shortId.toLowerCase().includes(q) ||
          opt.title.toLowerCase().includes(q) ||
          opt.key.toLowerCase().includes(q)
        );
      })
      .slice(0, 8);
  }, [query, options]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current && filtered.length > 0) {
      const activeEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, filtered.length]);

  if (filtered.length === 0) {
    return null;
  }

  return (
    <div
      className={`bg-[var(--bg-canvas)] border border-[var(--border-secondary)] rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100 ${className}`}
      onMouseDown={(e) => e.preventDefault()} // Prevent losing input focus
    >
      {/* Popover Header */}
      <div className="px-3 py-1.5 bg-[var(--bg-panel)] border-b border-[var(--border-primary)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-white font-bold">
          <Tag size={11} />
          <span>Tag Related Task</span>
        </div>
        <span className="text-[9px] font-mono text-[var(--text-muted)]">
          &uarr;&darr; Enter / Click
        </span>
      </div>

      {/* Suggestion Items List */}
      <div ref={listRef} className="max-h-48 overflow-y-auto p-1 space-y-0.5 custom-scrollbar">
        {filtered.map((item, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-[#3B82F6]/15 text-white border border-[#3B82F6]/30 shadow-sm'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)] border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="font-mono font-bold text-[#60A5FA] bg-[#3B82F6]/10 px-1.5 py-0.2 rounded text-[10px] border border-[#3B82F6]/25 shrink-0">
                  {item.shortId}
                </span>
                <span className="truncate text-xs">{item.title}</span>
              </div>
              <span className="text-[10px] font-mono text-[var(--text-muted)] shrink-0 ml-1.5 hidden sm:inline">
                {item.key}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
