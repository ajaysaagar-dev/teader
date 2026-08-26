'use client';

import React from 'react';

/** Animated shimmer placeholder block */
export function Shimmer({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-[#2A2C30] rounded ${className}`}
      aria-hidden="true"
    />
  );
}

/** Skeleton for the project page top bar */
export function ProjectPageHeaderSkeleton() {
  return (
    <div className="h-11 px-3.5 bg-[#1B1C1F] border-b border-[#2A2C30] flex items-center justify-between shrink-0">
      <div className="flex items-center gap-2.5">
        <Shimmer className="w-16 h-3" />
        <Shimmer className="w-1 h-3" />
        <Shimmer className="w-32 h-3" />
        <Shimmer className="w-20 h-5 rounded-full" />
      </div>
      <div className="flex items-center gap-1 bg-[#131415] border border-[#2A2C30] rounded-lg p-0.5">
        {[1,2,3,4].map(i => (
          <Shimmer key={i} className="w-20 h-6 rounded-md" />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Shimmer className="w-16 h-5 rounded-md" />
        <Shimmer className="w-20 h-6 rounded-md" />
      </div>
    </div>
  );
}

/** Skeleton kanban card */
function KanbanCardSkeleton() {
  return (
    <div className="bg-[#1B1C1F] border border-[#2A2C30] rounded-lg p-3 space-y-2">
      <Shimmer className="w-3/4 h-3" />
      <Shimmer className="w-1/2 h-2.5" />
      <div className="flex items-center gap-1.5 pt-1">
        <Shimmer className="w-10 h-4 rounded-full" />
        <Shimmer className="w-12 h-4 rounded-full" />
      </div>
      <div className="flex items-center justify-between pt-1">
        <Shimmer className="w-16 h-2.5" />
        <Shimmer className="w-5 h-5 rounded-full" />
      </div>
    </div>
  );
}

/** Skeleton kanban column */
function KanbanColumnSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="flex flex-col w-64 shrink-0 bg-[#1B1C1F]/50 border border-[#2A2C30] rounded-xl p-3 gap-3">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Shimmer className="w-2 h-2 rounded-full" />
          <Shimmer className="w-20 h-3" />
        </div>
        <Shimmer className="w-6 h-5 rounded-md" />
      </div>
      {Array.from({ length: cards }).map((_, i) => (
        <KanbanCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Full Kanban board skeleton */
export function KanbanBoardSkeleton() {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#131415]">
      <div className="flex-1 flex gap-4 p-4 overflow-x-auto">
        <KanbanColumnSkeleton cards={3} />
        <KanbanColumnSkeleton cards={2} />
        <KanbanColumnSkeleton cards={4} />
        <KanbanColumnSkeleton cards={1} />
      </div>
    </div>
  );
}

/** Projects page skeleton grid */
export function ProjectsGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-[#1B1C1F] border border-[#2A2C30] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Shimmer className="w-16 h-4 rounded-full" />
            <Shimmer className="w-8 h-8 rounded-lg" />
          </div>
          <Shimmer className="w-3/4 h-4" />
          <Shimmer className="w-full h-3" />
          <Shimmer className="w-2/3 h-3" />
          <div className="pt-2 border-t border-[#2A2C30] flex items-center justify-between">
            <Shimmer className="w-20 h-3" />
            <Shimmer className="w-16 h-3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Generic inline loading spinner */
export function Spinner({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <div
      className={`rounded-full border-2 border-[#DCB001] border-t-transparent animate-spin ${className}`}
      style={{ width: size, height: size }}
      aria-label="Loading…"
    />
  );
}

/** View loading fallback used inside dynamic() */
export function ViewLoadingFallback() {
  return (
    <div className="flex-1 flex items-center justify-center bg-[#131415]">
      <Spinner size={20} />
    </div>
  );
}
