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
    <div className="flex-1 h-full bg-[#131415] text-[#CFD4DD] p-6 flex flex-col space-y-4 overflow-hidden select-none font-sans">
      <div className="flex items-center justify-between bg-[#1B1C1F] p-3 rounded-xl border border-[#2A2C30] shrink-0">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-[#DCB001]" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#CFD4DD]">
            Sprint Roadmap Timeline
          </h2>
        </div>
        <span className="text-xs font-mono text-[#787C83]">{issues.length} active tasks</span>
      </div>

      <div className="flex-1 bg-[#1B1C1F] border border-[#2A2C30] rounded-xl flex flex-col overflow-hidden">
        <div className="grid grid-cols-12 gap-2 p-3 border-b border-[#2A2C30] text-xs font-semibold text-[#787C83] bg-[#17181A]">
          <div className="col-span-4">Issue Key & Title</div>
          <div className="col-span-7 grid grid-cols-7 text-center">
            {days.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="col-span-1 text-right">Assignee</div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[#2A2C30]">
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
                className="grid grid-cols-12 gap-2 p-3 items-center hover:bg-[#222427] cursor-pointer text-xs transition-colors"
              >
                <div className="col-span-4 flex items-center gap-2 truncate">
                  <span className="font-mono text-[11px] font-bold text-[#DCB001] shrink-0">
                    {issue.key}
                  </span>
                  <span className="truncate text-[#CFD4DD]">{issue.title}</span>
                </div>

                <div className="col-span-7 relative flex items-center">
                  <div className="w-full grid grid-cols-7 absolute inset-0 opacity-10 border-b border-dashed border-[#787C83]" />
                  <div
                    className={`h-5 rounded-md px-2.5 flex items-center text-[10px] font-medium shadow-sm transition-all ${
                      issue.status === 'done'
                        ? 'bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/40'
                        : 'bg-[#DCB001]/20 text-[#DCB001] border border-[#DCB001]/40'
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
