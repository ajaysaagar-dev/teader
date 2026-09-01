'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Clock,
  Filter,
  Trash2,
  Edit2,
  RefreshCw,
  Search,
  CheckCircle2,
  FolderKanban,
  FileText,
  Users,
  Shield,
  Layers,
  ArrowUpDown,
  Calendar,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Info,
  CalendarClock
} from 'lucide-react';
import { toast } from 'sonner';
import { HistoryEntry } from '@/lib/types';
import { useRealtimeSubscription, RealtimeEvent } from '@/lib/useRealtime';

interface ProjectHistoryViewProps {
  projectId: number | string;
  projectKey: string;
  canEditHistory?: boolean;
  canDeleteHistory?: boolean;
  onNavigateTask?: (taskId: string) => void;
}

export function ProjectHistoryView({
  projectId,
  projectKey,
  canEditHistory = false,
  canDeleteHistory = false,
  onNavigateTask,
}: ProjectHistoryViewProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntityFilter, setSelectedEntityFilter] = useState<string>('all');
  const [selectedActionFilter, setSelectedActionFilter] = useState<string>('all');
  const [expandedDetails, setExpandedDetails] = useState<Record<number, boolean>>({});
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Fetch project history
  const fetchHistory = useCallback(async (isSilent = false) => {
    if (!projectId) return;
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const url = new URL(`/api/projects/${projectId}/history`, window.location.origin);
      url.searchParams.set('limit', '100');
      if (selectedEntityFilter !== 'all') url.searchParams.set('entityType', selectedEntityFilter);
      if (selectedActionFilter !== 'all') url.searchParams.set('action', selectedActionFilter);

      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setHistory(data);
        }
      }
    } catch (err: any) {
      console.warn('Failed to load project history:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId, selectedEntityFilter, selectedActionFilter]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Realtime subscription for instant history logs
  const handleRealtimeEvent = useCallback(
    (event: RealtimeEvent) => {
      if (
        event.type === 'PROJECT_UPDATED' &&
        event.projectId &&
        String(event.projectId) === String(projectId)
      ) {
        if (event.payload?.type === 'HISTORY_LOGGED' && event.payload.historyEntry) {
          setHistory((prev) => [event.payload.historyEntry, ...prev.filter((h) => h.id !== event.payload.historyEntry.id)]);
        } else if (event.payload?.type === 'HISTORY_DELETED' && event.payload.entryId) {
          setHistory((prev) => prev.filter((h) => String(h.id) !== String(event.payload.entryId)));
        } else {
          // General project update, silent refresh
          fetchHistory(true);
        }
      }
    },
    [projectId, fetchHistory]
  );

  useRealtimeSubscription({
    projectId,
    onEvent: handleRealtimeEvent,
  });

  // Handle delete history entry
  const handleDeleteEntry = async (entryId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canDeleteHistory) {
      toast.error('Permission Denied: You do not have permission to delete history logs.');
      return;
    }

    const confirmed = window.confirm('Are you sure you want to delete this history audit record?');
    if (!confirmed) return;

    setDeletingId(entryId);
    try {
      const res = await fetch(`/api/projects/${projectId}/history?entryId=${entryId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete entry');
      }
      setHistory((prev) => prev.filter((h) => h.id !== entryId));
      toast.success('History audit record removed.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete history record.');
    } finally {
      setDeletingId(null);
    }
  };

  const toggleDetails = (id: number) => {
    setExpandedDetails((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Filtered entries
  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      if (selectedEntityFilter !== 'all' && item.entityType !== selectedEntityFilter) {
        return false;
      }
      if (selectedActionFilter !== 'all' && item.action !== selectedActionFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = (item.entityTitle || '').toLowerCase().includes(q);
        const userMatch = (item.userName || '').toLowerCase().includes(q);
        const actionMatch = item.action.toLowerCase().includes(q);
        return titleMatch || userMatch || actionMatch;
      }
      return true;
    });
  }, [history, selectedEntityFilter, selectedActionFilter, searchQuery]);

  // Format action text and colors
  const getActionBadge = (action: string) => {
    switch (action) {
      case 'task_created':
        return { label: 'Task Created', bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
      case 'folder_created':
        return { label: 'Folder Created', bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
      case 'doc_created':
        return { label: 'Doc Created', bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
      case 'subtask_created':
        return { label: 'Subtask Added', bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
      case 'task_updated':
        return { label: 'Task Updated', bg: 'bg-blue-500/15 text-blue-400 border-blue-500/30' };
      case 'folder_updated':
        return { label: 'Folder Renamed/Moved', bg: 'bg-blue-500/15 text-blue-400 border-blue-500/30' };
      case 'doc_updated':
        return { label: 'Doc Updated', bg: 'bg-blue-500/15 text-blue-400 border-blue-500/30' };
      case 'subtask_updated':
        return { label: 'Subtask Updated', bg: 'bg-blue-500/15 text-blue-400 border-blue-500/30' };
      case 'task_deleted':
        return { label: 'Task Deleted', bg: 'bg-red-500/15 text-red-400 border-red-500/30' };
      case 'folder_deleted':
        return { label: 'Folder Deleted', bg: 'bg-red-500/15 text-red-400 border-red-500/30' };
      case 'doc_deleted':
        return { label: 'Doc Deleted', bg: 'bg-red-500/15 text-red-400 border-red-500/30' };
      case 'member_removed':
        return { label: 'Member Removed', bg: 'bg-red-500/15 text-red-400 border-red-500/30' };
      case 'date_edited':
        return { label: 'Created Date Edited', bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
      case 'member_permissions_updated':
        return { label: 'Permissions Updated', bg: 'bg-purple-500/15 text-purple-400 border-purple-500/30' };
      case 'tasks_reordered':
        return { label: 'Tasks Reordered', bg: 'bg-amber-500/15 text-yellow-400 border-yellow-500/30' };
      default:
        return { label: action.replace(/_/g, ' '), bg: 'bg-[#222428] text-[#9499A0] border-[#31343A]' };
    }
  };

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case 'task':
        return <CheckCircle2 size={14} className="text-[#38BDF8]" />;
      case 'folder':
        return <FolderKanban size={14} className="text-[#DCB001]" />;
      case 'doc':
        return <FileText size={14} className="text-[#A78BFA]" />;
      case 'member':
        return <Users size={14} className="text-[#F472B6]" />;
      case 'subtask':
        return <Layers size={14} className="text-[#34D399]" />;
      default:
        return <Clock size={14} className="text-[#9499A0]" />;
    }
  };

  return (
    <div className="flex-1 h-full min-h-0 w-full overflow-y-auto bg-[#0E0F12] text-[#CFD4DD] p-4 lg:p-8 select-none">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-[#222428] gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#17181C] border border-[#2A2C30] flex items-center justify-center text-[#DCB001]">
              <Clock size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">Project History</h2>
                <span className="text-[11px] font-mono text-[#DCB001] bg-[#DCB001]/10 px-2 py-0.5 rounded border border-[#DCB001]/25">
                  {projectKey}
                </span>
              </div>
              <p className="text-xs text-[#787C83]">
                Comprehensive audit trail tracking every task, folder, documentation, permission and team action.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchHistory(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#18191E] hover:bg-[#22242A] text-xs font-semibold text-white border border-[#2A2C30] transition-colors disabled:opacity-50"
              title="Refresh History Audit Trail"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin text-[#DCB001]' : ''} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-[#141518] border border-[#222428]">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#787C83]" />
            <input
              type="text"
              placeholder="Search history actions or entities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-[#101114] border border-[#25272D] focus:border-[#DCB001] rounded-lg text-xs text-white placeholder-[#5A5E66] outline-none transition-colors"
            />
          </div>

          {/* Entity Type Filter */}
          <div className="relative">
            <select
              value={selectedEntityFilter}
              onChange={(e) => setSelectedEntityFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-[#101114] border border-[#25272D] focus:border-[#DCB001] rounded-lg text-xs text-white outline-none transition-colors appearance-none cursor-pointer"
            >
              <option value="all">All Entity Types</option>
              <option value="task">Tasks</option>
              <option value="folder">Folders</option>
              <option value="doc">Documentation</option>
              <option value="subtask">Subtasks</option>
              <option value="member">Members & Permissions</option>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#787C83] pointer-events-none" />
          </div>

          {/* Action Filter */}
          <div className="relative">
            <select
              value={selectedActionFilter}
              onChange={(e) => setSelectedActionFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-[#101114] border border-[#25272D] focus:border-[#DCB001] rounded-lg text-xs text-white outline-none transition-colors appearance-none cursor-pointer"
            >
              <option value="all">All Action Types</option>
              <option value="task_created">Task Created</option>
              <option value="task_updated">Task Updated</option>
              <option value="task_deleted">Task Deleted</option>
              <option value="folder_created">Folder Created</option>
              <option value="folder_updated">Folder Renamed/Moved</option>
              <option value="folder_deleted">Folder Deleted</option>
              <option value="doc_created">Doc Created</option>
              <option value="doc_updated">Doc Updated</option>
              <option value="doc_deleted">Doc Deleted</option>
              <option value="date_edited">Date Edited</option>
              <option value="member_permissions_updated">Permissions Updated</option>
              <option value="tasks_reordered">Tasks Reordered</option>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#787C83] pointer-events-none" />
          </div>
        </div>

        {/* Audit Log Timeline */}
        {loading ? (
          <div className="flex flex-col items-center justify-center p-16 space-y-3">
            <RefreshCw size={24} className="animate-spin text-[#DCB001]" />
            <p className="text-xs text-[#787C83]">Loading project audit log entries...</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-[#141518] border border-[#222428] space-y-3">
            <Clock size={32} className="mx-auto text-[#555962]" />
            <h3 className="text-sm font-bold text-white">No history records found</h3>
            <p className="text-xs text-[#787C83] max-w-sm mx-auto">
              Actions such as task creation, status updates, folder management, and documentation revisions will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredHistory.map((entry) => {
              const badge = getActionBadge(entry.action);
              const isExpanded = Boolean(expandedDetails[entry.id]);
              const isDeleting = deletingId === entry.id;
              const dateObj = new Date(entry.createdAt);
              const formattedDate = dateObj.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });
              const formattedTime = dateObj.toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={entry.id}
                  className="p-4 rounded-xl bg-[#141518] border border-[#222428] hover:border-[#2F3238] transition-all space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Left: Avatar + Details */}
                    <div className="flex items-start gap-3 min-w-0">
                      <img
                        src={entry.userAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
                        alt={entry.userName}
                        className="w-8 h-8 rounded-lg object-cover ring-1 ring-[#282A30] shrink-0 mt-0.5"
                      />
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center flex-wrap gap-2">
                          <span className="text-xs font-bold text-white">{entry.userName}</span>
                          <span
                            className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md border ${badge.bg}`}
                          >
                            {badge.label}
                          </span>
                          <span className="text-[10px] text-[#787C83] font-mono">
                            {formattedDate} • {formattedTime}
                          </span>
                        </div>

                        {/* Action Description */}
                        <div className="flex items-center gap-2 text-xs text-[#CFD4DD] flex-wrap">
                          <span className="flex items-center gap-1 text-[#9499A0]">
                            {getEntityIcon(entry.entityType)}
                            <span className="capitalize font-medium">{entry.entityType}:</span>
                          </span>
                          <span className="font-semibold text-white truncate max-w-md">
                            {entry.entityTitle || entry.entityId || 'Item'}
                          </span>
                          {entry.details?.key && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#1D1F24] text-[#DCB001] border border-[#2B2D33]">
                              {entry.details.key}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {entry.details && Object.keys(entry.details).length > 0 && (
                        <button
                          onClick={() => toggleDetails(entry.id)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#18191E] hover:bg-[#202228] text-[11px] font-mono text-[#9499A0] hover:text-white border border-[#282A30] transition-colors"
                          title="View change details"
                        >
                          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          <span>Details</span>
                        </button>
                      )}

                      {canDeleteHistory && (
                        <button
                          disabled={isDeleting}
                          onClick={(e) => handleDeleteEntry(entry.id, e)}
                          className="p-1.5 rounded-lg bg-[#201414] hover:bg-[#341616] text-[#EF4444] hover:text-white border border-[#EF4444]/30 transition-colors disabled:opacity-50"
                          title="Delete history log record"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expandable JSON / Change Details */}
                  {isExpanded && entry.details && (
                    <div className="mt-2 p-3 rounded-lg bg-[#0F1013] border border-[#202227] text-xs font-mono space-y-1.5">
                      <div className="text-[10px] uppercase tracking-wider text-[#787C83]">
                        Audit Payload / Metadata:
                      </div>
                      <pre className="text-[11px] text-[#A4A9B3] overflow-x-auto whitespace-pre-wrap leading-relaxed">
                        {JSON.stringify(entry.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}