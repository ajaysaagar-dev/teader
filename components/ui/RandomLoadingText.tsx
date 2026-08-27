'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, Lightbulb, Terminal, Cpu } from 'lucide-react';

const LOADING_ITEMS: { text: string; category: 'fact' | 'tip' | 'status' | 'dev' }[] = [
  { text: 'Fact: The first computer bug was an actual moth found in the Harvard Mark II in 1947.', category: 'fact' },
  { text: 'Fact: Git was originally created by Linus Torvalds in just 10 days.', category: 'fact' },
  { text: 'Fact: Apollo 11 guidance computer had only 4KB of physical RAM.', category: 'fact' },
  { text: 'Fact: PostgreSQL was created at UC Berkeley in 1986 under the name Postgres.', category: 'fact' },
  { text: 'Fact: TypeScript was first released to the public in October 2012.', category: 'fact' },
  { text: 'Fact: The QWERTY keyboard layout was designed in 1873 to prevent mechanical typewriter jams.', category: 'fact' },
  
  { text: 'Tip: Press Ctrl + S (or Cmd + S) to instantly save docs directly to the cloud.', category: 'tip' },
  { text: 'Tip: Press Ctrl + Z in docs to undo any change or symbol insertion.', category: 'tip' },
  { text: 'Tip: Drag & drop any subtask onto another task to re-parent it hierarchically.', category: 'tip' },
  { text: 'Tip: Switch between Kanban, Tree, and Hierarchy views from the subheader bar.', category: 'tip' },
  { text: 'Tip: Double-click any task title in Tree view to quickly edit it inline.', category: 'tip' },

  { text: 'Aligning pixels with quantum precision...', category: 'status' },
  { text: 'Syncing with PostgreSQL cloud database...', category: 'status' },
  { text: 'Brewing fresh coffee and resolving dependency trees...', category: 'status' },
  { text: 'Reticulating splines and balancing kanban columns...', category: 'status' },
  { text: 'Warming up caches and calibrating recursive tree nodes...', category: 'status' },
  { text: 'Converting caffeine into high-velocity pull requests...', category: 'status' },
  { text: 'Refactoring the universe, one commit at a time...', category: 'status' },
  { text: 'Checking for race conditions in parallel universes...', category: 'status' },
  { text: 'Polishing dark-mode hex codes and glassmorphic panels...', category: 'status' },
  { text: 'Parsing markdown AST and compiling real-time previews...', category: 'status' },
];

interface RandomLoadingTextProps {
  className?: string;
  intervalMs?: number;
  showBadge?: boolean;
}

export function RandomLoadingText({
  className = '',
  intervalMs = 2800,
  showBadge = true,
}: RandomLoadingTextProps) {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * LOADING_ITEMS.length));
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setIsFading(true);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % LOADING_ITEMS.length);
        setIsFading(false);
      }, 200);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs]);

  const current = LOADING_ITEMS[index];

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'fact':
        return <Lightbulb size={11} className="text-[#DCB001]" />;
      case 'tip':
        return <Sparkles size={11} className="text-[#3B82F6]" />;
      case 'dev':
        return <Terminal size={11} className="text-[#A855F7]" />;
      default:
        return <Cpu size={11} className="text-[#22C55E]" />;
    }
  };

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'fact':
        return 'bg-[#DCB001]/10 text-[#DCB001] border-[#DCB001]/30';
      case 'tip':
        return 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/30';
      case 'dev':
        return 'bg-[#A855F7]/10 text-[#A855F7] border-[#A855F7]/30';
      default:
        return 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/30';
    }
  };

  return (
    <div
      className={`flex items-center justify-center gap-2 text-xs font-mono select-none transition-opacity duration-200 ${
        isFading ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
      } ${className}`}
    >
      {showBadge && (
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] uppercase font-bold tracking-wider shrink-0 ${getCategoryBadgeClass(
            current.category
          )}`}
        >
          {getCategoryIcon(current.category)}
          <span>{current.category}</span>
        </span>
      )}
      <span className="text-[#9BA1A6] font-medium tracking-tight truncate max-w-[85vw] sm:max-w-[480px]">
        {current.text}
      </span>
    </div>
  );
}

export default RandomLoadingText;
