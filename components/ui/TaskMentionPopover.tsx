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
      className={`bg-[#131415] border border-[#38BDF8]/50 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100 ${className}`}
      onMouseDown={(e) => e.preventDefault()} // Prevent losing input focus
    >
      {/* Popover Header */}
      <div className="px-3 py-1.5 bg-[#17181A] border-b border-[#2A2C30] flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#38BDF8] font-bold">
          <Tag size={11} />
          <span>Tag Related Task</span>
        </div>
        <span className="text-[9px] font-mono text-[#787C83]">
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
                  ? 'bg-[#38BDF8]/20 text-white border border-[#38BDF8]/40 shadow-sm'
                  : 'text-[#CFD4DD] hover:bg-[#1A1B1E] border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="font-mono font-bold text-[#DCB001] bg-[#DCB001]/10 px-1.5 py-0.2 rounded text-[10px] border border-[#DCB001]/30 shrink-0">
                  {item.shortId}
                </span>
                <span className="truncate text-xs">{item.title}</span>
              </div>
              <span className="text-[10px] font-mono text-[#787C83] shrink-0 ml-1.5 hidden sm:inline">
                {item.key}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
