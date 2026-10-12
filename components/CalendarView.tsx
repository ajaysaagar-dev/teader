'use client';

import React, { useState, useMemo } from 'react';
import { Issue, Status, Priority } from '@/lib/types';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  Plus, 
  CheckCircle2, 
  AlertCircle,
  Layers,
  ChevronDown
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { formatAddedTiming, formatExactDateTime } from '@/lib/task-id';

interface CalendarViewProps {
  issues: Issue[];
  onSelectIssue: (id: string) => void;
  onOpenNewIssue?: () => void;
}

export const CalendarView: React.FC<CalendarViewProps> = React.memo(({
  issues,
  onSelectIssue,
  onOpenNewIssue,
}) => {
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Calculate days for the calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const days: { date: Date; isCurrentMonth: boolean; dayNumber: number }[] = [];

    // Prev month padding
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthDays - i),
        isCurrentMonth: false,
        dayNumber: prevMonthDays - i,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({
        date: new Date(year, month, d),
        isCurrentMonth: true,
        dayNumber: d,
      });
    }

    // Next month padding to fill complete weeks (up to 35 or 42 cells)
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      days.push({
        date: new Date(year, month + 1, d),
        isCurrentMonth: false,
        dayNumber: d,
      });
    }

    return days;
  }, [year, month]);

  // Group issues by date string (YYYY-MM-DD)
  const issuesByDate = useMemo(() => {
    const map = new Map<string, Issue[]>();

    issues.forEach((iss) => {
      // Use due date if available, or fallback to createdAt
      const dateKey = iss.dueDate
        ? iss.dueDate.split('T')[0]
        : (iss.createdAt ? iss.createdAt.split('T')[0] : null);

      if (dateKey) {
        if (!map.has(dateKey)) map.set(dateKey, []);
        map.get(dateKey)!.push(iss);
      }
    });

    return map;
  }, [issues]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 w-full bg-[var(--bg-canvas)] text-[var(--text-secondary)] font-sans select-none overflow-hidden">
      {/* Calendar Top Toolbar */}
      <div className="h-11 px-4 bg-[var(--bg-panel)] border-b border-[var(--border-primary)] flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white">
            <CalendarIcon size={15} className="text-white" />
            <span>{monthNames[month]} {year}</span>
          </div>

          <div className="flex items-center bg-[var(--bg-canvas)] border border-[var(--border-primary)] rounded-md p-0.5">
            <button
              onClick={handlePrevMonth}
              className="p-1 text-[var(--text-muted)] hover:text-white rounded transition-colors"
              title="Previous Month"
            >
              <ChevronLeft size={13} />
            </button>
            <button
              onClick={handleToday}
              className="px-2 py-0.5 text-[10px] font-mono text-[var(--text-secondary)] hover:text-white rounded transition-colors"
            >
              Today
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1 text-[var(--text-muted)] hover:text-white rounded transition-colors"
              title="Next Month"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>

        {onOpenNewIssue && (
          <button
            onClick={onOpenNewIssue}
            className="flex items-center gap-1 px-2.5 py-1 bg-white text-black hover:bg-[#FFFFFF] text-[#000000] rounded-md text-xs font-bold shadow-sm transition-all"
          >
            <Plus size={13} />
            <span>New Task</span>
          </button>
        )}
      </div>

      {/* Days Header */}
      <div className="grid grid-cols-7 border-b border-[var(--border-primary)] bg-[var(--bg-panel)] text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider py-1.5 text-center shrink-0">
        {daysOfWeek.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 grid grid-cols-7 grid-rows-5 lg:grid-rows-6 gap-[1px] bg-[#222222] overflow-y-auto">
        {calendarDays.map((cd, index) => {
          const formattedDate = `${cd.date.getFullYear()}-${String(cd.date.getMonth() + 1).padStart(2, '0')}-${String(cd.date.getDate()).padStart(2, '0')}`;
          const isToday = formattedDate === todayStr;
          const dayIssues = issuesByDate.get(formattedDate) || [];

          return (
            <div
              key={index}
              className={`min-h-[90px] p-2 flex flex-col justify-between transition-colors ${
                cd.isCurrentMonth ? 'bg-[var(--bg-canvas)] hover:bg-[#171717]' : 'bg-[#0F0F0F] opacity-40'
              }`}
            >
              {/* Date Header */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-xs font-mono font-semibold px-1.5 py-0.5 rounded-full ${
                    isToday
                      ? 'bg-white text-black text-[#000000] font-bold'
                      : 'text-[var(--text-muted)]'
                  }`}
                >
                  {cd.dayNumber}
                </span>

                {dayIssues.length > 0 && (
                  <span className="text-[9px] font-mono text-[var(--text-muted)]">
                    {dayIssues.length} {dayIssues.length === 1 ? 'task' : 'tasks'}
                  </span>
                )}
              </div>

              {/* Tasks Pill List */}
              <div className="flex-1 space-y-1 overflow-y-auto max-h-[80px] custom-scrollbar">
                {dayIssues.map((issue) => (
                  <button
                    key={issue.id}
                    onClick={() => onSelectIssue(issue.id)}
                    title={`${issue.key}: ${issue.title}${issue.createdAt ? ` • ${formatExactDateTime(issue.createdAt)} (${formatAddedTiming(issue.createdAt)})` : ''}`}
                    className="w-full text-left p-1 rounded bg-[var(--bg-panel)] hover:bg-[#242424] border border-[var(--border-primary)] hover:border-[var(--border-secondary)] text-[10px] flex items-center justify-between gap-1 group transition-all"
                  >
                    <div className="flex items-center gap-1 truncate">
                      <span className="font-mono text-white font-bold shrink-0">
                        {issue.key}
                      </span>
                      <span className="truncate text-[var(--text-secondary)] group-hover:text-white">
                        {issue.title}
                      </span>
                    </div>

                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        issue.status === 'done'
                          ? 'bg-[var(--ramp-3)]'
                          : issue.priority === 'critical'
                          ? 'bg-[var(--ramp-3)]'
                          : 'bg-white text-black'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

CalendarView.displayName = 'CalendarView';
