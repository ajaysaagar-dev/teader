'use client';

import React from 'react';
import { Issue } from '@/lib/types';
import { Avatar } from '@/components/ui/Avatar';
import { Calendar } from 'lucide-react';

interface TimelineViewProps {
  issues: Issue[];
  onSelectIssue: (id: string) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({ issues, onSelectIssue }) => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="flex-1 h-full bg-[var(--bg-canvas)] text-[var(--text-secondary)] p-6 flex flex-col space-y-4 overflow-hidden select-none font-sans">
      <div className="flex items-center justify-between bg-[var(--bg-panel)] p-3 rounded-xl border border-[var(--border-primary)] shrink-0">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-white" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            Sprint Roadmap Timeline
          </h2>
        </div>
        <span className="text-xs font-mono text-[var(--text-muted)]">{issues.length} active tasks</span>
      </div>

      <div className="flex-1 bg-[var(--bg-panel)] border border-[var(--border-primary)] rounded-xl flex flex-col overflow-hidden">
        <div className="grid grid-cols-12 gap-2 p-3 border-b border-[var(--border-primary)] text-xs font-semibold text-[var(--text-muted)] bg-[var(--bg-panel)]">
          <div className="col-span-4">Issue Key & Title</div>
          <div className="col-span-7 grid grid-cols-7 text-center">
            {days.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="col-span-1 text-right">Assignee</div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-primary)]">
          {issues.map((issue, idx) => {
            const startCol = (idx * 2) % 7;
            const spanCols = Math.min(3, 7 - startCol);
            const assigneeUser = issue.assignee || {
              id: 'usr_default',
              name: issue.assigneeName || 'User',
              avatar: issue.assigneeAvatar,
              email: '',
              role: '',
            };

            return (
              <div
                key={issue.id}
                onClick={() => onSelectIssue(issue.id)}
                className="grid grid-cols-12 gap-2 p-3 items-center hover:bg-[#242424] cursor-pointer text-xs transition-colors"
              >
                <div className="col-span-4 flex items-center gap-2 truncate">
                  <span className="font-mono text-[11px] font-bold text-white shrink-0">
                    {issue.key}
                  </span>
                  <span className="truncate text-[var(--text-secondary)]">{issue.title}</span>
                </div>

                <div className="col-span-7 relative flex items-center">
                  <div className="w-full grid grid-cols-7 absolute inset-0 opacity-10 border-b border-dashed border-[#666666]" />
                  <div
                    className={`h-5 rounded-md px-2.5 flex items-center text-[10px] font-medium shadow-sm transition-all ${
                      issue.status === 'done'
                        ? 'bg-[var(--ramp-3)]/20 text-white border border-[var(--border-secondary)]'
                        : 'bg-white/20 text-white border border-[var(--border-secondary)]'
                    }`}
                    style={{
                      marginLeft: `${(startCol / 7) * 100}%`,
                      width: `${(spanCols / 7) * 80}%`,
                    }}
                  >
                    <span className="truncate">{issue.sprint}</span>
                  </div>
                </div>

                <div className="col-span-1 flex justify-end">
                  <Avatar user={assigneeUser} size="xs" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
