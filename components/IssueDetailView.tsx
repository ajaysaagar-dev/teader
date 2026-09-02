'use client';

import React, { useState, useEffect } from 'react';
import { Issue, Status, Priority } from '@/lib/types';
import { Avatar } from '@/components/ui/Avatar';
import { 
  Check,
  Plus,
  Calendar,
  Layers,
  Trash2,
  Tag,
  Pencil,
  Link,
  X,
  ExternalLink,
  ArrowLeft,
  Circle,
  Clock,
  CheckCircle2,
  AlertCircle,
  ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { getTaskShortId, findIssueByTag, getAvailableTaskMentions, TaskMentionOption, formatAddedTiming, formatExactDateTime } from '@/lib/task-id';
import { TaskMentionPopover } from '@/components/ui/TaskMentionPopover';

interface IssueDetailViewProps {
  issue: Issue;
  allIssues?: Issue[];
  onSelectIssue?: (issueId: string) => void;
  onUpdateIssue: (updated: Issue) => void;
  onOpenDiffModal?: () => void;
  currentRole?: string;
  canEditDates?: boolean;
  canCompleteTasks?: boolean;
  onClose?: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  todo: { label: 'Todo', bg: 'bg-[#787C83]/10', text: 'text-[#787C83]', border: 'border-[#787C83]/30' },
  in_progress: { label: 'In Progress', bg: 'bg-[#DCB001]/10', text: 'text-[#DCB001]', border: 'border-[#DCB001]/30' },
  needs_review: { label: 'Needs Review', bg: 'bg-[#A855F7]/10', text: 'text-[#A855F7]', border: 'border-[#A855F7]/30' },
  done: { label: 'Done', bg: 'bg-[#22C55E]/10', text: 'text-[#22C55E]', border: 'border-[#22C55E]/30' },
};

function parseBlockedBy(blockedBy: any): string[] {
  if (!blockedBy) return [];
  if (Array.isArray(blockedBy)) return blockedBy.map(String);
  if (typeof blockedBy === 'string') {
    const trimmed = blockedBy.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

export const IssueDetailView: React.FC<IssueDetailViewProps> = ({
  issue,
  allIssues = [],
  onSelectIssue,
  onUpdateIssue,
  currentRole = 'owner',
  canEditDates = false,
  canCompleteTasks = true,
  onClose,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [isEditingCreatedAt, setIsEditingCreatedAt] = useState(false);

  // Description markdown edit state
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState(issue.description || '');

  // Tag picker state
  const [showAddTagPicker, setShowAddTagPicker] = useState(false);
  const [tagPickerSearch, setTagPickerSearch] = useState('');
  const [tagPickerIndex, setTagPickerIndex] = useState(0);

  // Top / Stacked Task Overlay state (opens clicked tagged task on top of current task)
  const [overlayIssueId, setOverlayIssueId] = useState<string | null>(null);

  const overlayIssue = React.useMemo(() => {
    if (!overlayIssueId || !allIssues) return null;
    return allIssues.find((i) => String(i.id) === String(overlayIssueId)) || null;
  }, [overlayIssueId, allIssues]);

  const currentTaskTags = React.useMemo(() => {
    const t = issue.tags || [];
    return Array.isArray(t) ? t : [];
  }, [issue.tags]);

  const mentionOptions = React.useMemo(() => getAvailableTaskMentions(allIssues), [allIssues]);

  const filteredTagCandidates = React.useMemo(() => {
    const q = tagPickerSearch.toLowerCase().trim();
    return allIssues
      .filter((i) => String(i.id) !== String(issue.id) && !i.title.startsWith('📁 ') && !i.title.startsWith('[Folder]'))
      .filter((i) => {
        const shortId = getTaskShortId(i, allIssues);
        if (!q) return true;
        return (
          shortId.toLowerCase().includes(q) ||
          i.title.toLowerCase().includes(q) ||
          i.key.toLowerCase().includes(q)
        );
      })
      .slice(0, 10);
  }, [allIssues, issue.id, tagPickerSearch]);

  const handleToggleTaskTag = async (shortId: string) => {
    const clean = shortId.replace(/^@/, '');
    const exists = currentTaskTags.some((t) => t.replace(/^@/, '').toUpperCase() === clean.toUpperCase());
    let newTags: string[];
    if (exists) {
      newTags = currentTaskTags.filter((t) => t.replace(/^@/, '').toUpperCase() !== clean.toUpperCase());
    } else {
      newTags = [...currentTaskTags, `@${clean}`];
    }

    onUpdateIssue({ ...issue, tags: newTags });
    toast.success(exists ? `Removed tag @${clean}` : `Tagged task @${clean}`);

    try {
      await fetch(`/api/issues/${issue.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: newTags }),
      });
    } catch {}
  };

  const handleRemoveTaskTag = async (tagStr: string) => {
    const newTags = currentTaskTags.filter((t) => t !== tagStr);
    onUpdateIssue({ ...issue, tags: newTags });
    toast.success(`Removed tag ${tagStr}`);

    try {
      await fetch(`/api/issues/${issue.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: newTags }),
      });
    } catch {}
  };

  useEffect(() => {
    setDescValue(issue.description || '');
  }, [issue.description]);

  const handleCopyLink = () => {
    const url = `${window.location.origin}/task/${issue.id}/details`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    toast.success('Task details link copied to clipboard');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Status transition handler with Project Owner restriction
  const handleStatusChange = async (newStatus: Status) => {
    if (issue.status === 'needs_review' && newStatus === 'done' && currentRole !== 'owner') {
      toast.error('Permission Denied: Only the project creator can approve and move tasks to Done.');
      return;
    }

    const blockers = parseBlockedBy(issue.blockedBy);
    if (blockers.length > 0 && newStatus === 'in_progress') {
      toast.warning(`Notice: This task is currently blocked by: ${blockers.join(', ')}`);
    }

    if (newStatus === 'done' && !canCompleteTasks) {
      toast.error('Permission Denied: You do not have permission to move tasks to Complete / Done.');
      return;
    }

    const updated = { ...issue, status: newStatus };
    onUpdateIssue(updated);
    try {
      const res = await fetch(`/api/issues/${issue.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to update status');
      }

      toast.success(`Status updated to ${newStatus.replace('_', ' ')}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    }
  };

  // Priority transition handler
  const handlePriorityChange = async (newPriority: Priority) => {
    const updated = { ...issue, priority: newPriority };
    onUpdateIssue(updated);
    try {
      await fetch(`/api/issues/${issue.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: newPriority }),
      });
      toast.success(`Priority set to ${newPriority}`);
    } catch {
      toast.error('Failed to update priority');
    }
  };

  // Due Date handler
  const handleDueDateChange = async (dateStr: string) => {
    const updated = { ...issue, dueDate: dateStr };
    onUpdateIssue(updated);
    try {
      await fetch(`/api/issues/${issue.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dueDate: dateStr }),
      });
      toast.success('Due date updated');
    } catch {}
  };

  // Created Date handler (Admin / Owner permission)
  const handleCreatedAtChange = async (dateStr: string) => {
    if (!dateStr) return;
    const isoDate = new Date(dateStr).toISOString();
    const updated = { ...issue, createdAt: isoDate };
    onUpdateIssue(updated);
    try {
      const res = await fetch(`/api/issues/${issue.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ createdAt: isoDate }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update creation date');
      }
      toast.success('Creation timestamp updated');
      setIsEditingCreatedAt(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update creation date');
    }
  };

  const activeBlockers = parseBlockedBy(issue.blockedBy);
  const isBlocked = activeBlockers.length > 0;

  return (
    <div className="relative flex-1 flex flex-col h-full bg-[#131415] text-[#CFD4DD] overflow-y-auto font-sans select-none">
      {/* Top Warning Banner if Task is Blocked */}
      {isBlocked && (
        <div className="bg-[#EF4444]/15 border-b border-[#EF4444]/30 px-4 py-2 flex items-center justify-between text-xs text-[#EF4444] font-medium shrink-0">
          <div className="flex items-center gap-2">
            <ShieldAlert size={15} />
            <span>This task has active blocking dependencies: <strong>{activeBlockers.join(', ')}</strong></span>
          </div>
          <span className="text-[10px] font-mono uppercase bg-[#EF4444]/20 px-2 py-0.5 rounded border border-[#EF4444]/40">
            Blocked
          </span>
        </div>
      )}

      {/* Main Container */}
      <div className="p-4 sm:p-6 max-w-6xl w-full mx-auto grid grid-cols-12 gap-6 flex-1">
        {/* Left / Center Content Column */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* Header Row */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold text-[#DCB001] bg-[#DCB001]/10 border border-[#DCB001]/30 px-2 py-0.5 rounded">
                  {getTaskShortId(issue, allIssues)}
                </span>
                <span className="font-mono text-[11px] text-[#787C83] bg-[#1B1C1F] border border-[#2A2C30] px-2 py-0.5 rounded">
                  {issue.key}
                </span>
                {issue.epic && (
                  <span className="font-mono text-[11px] text-[#A855F7] bg-[#A855F7]/10 border border-[#A855F7]/30 px-2 py-0.5 rounded flex items-center gap-1">
                    <Layers size={10} /> {issue.epic}
                  </span>
                )}
                {issue.createdAt && (
                  <span
                    className="font-mono text-[11px] text-[#787C83] bg-[#1B1C1F] border border-[#2A2C30] px-2 py-0.5 rounded flex items-center gap-1"
                    title={formatExactDateTime(issue.createdAt)}
                  >
                    <Clock size={11} className="text-[#DCB001]" />
                    <span>Added {formatAddedTiming(issue.createdAt)}</span>
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {/* Copy Link Button */}
                <button
                  onClick={handleCopyLink}
                  className="p-1.5 bg-[#1B1C1F] hover:bg-[#2A2C30] border border-[#2A2C30] rounded-lg text-xs text-[#787C83] hover:text-[#CFD4DD] transition-colors cursor-pointer"
                  title="Copy Task Link"
                >
                  {copiedLink ? <Check size={14} className="text-[#22C55E]" /> : <Link size={14} />}
                </button>
                {onClose && (
                  <button
                    onClick={onClose}
                    className="p-1.5 bg-[#1B1C1F] hover:bg-[#2A2C30] border border-[#2A2C30] rounded-lg text-xs text-[#787C83] hover:text-white transition-colors cursor-pointer"
                    title="Close Details"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Task Title */}
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug">
              {issue.title}
            </h1>
          </div>

          {/* Description Block with Markdown Rendering */}
          <div className="p-4 rounded-xl bg-[#1B1C1F] border border-[#2A2C30] space-y-2 group/desc">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-[#787C83] uppercase tracking-wider block">
                Description (Markdown)
              </span>
              {!isEditingDesc ? (
                <button
                  type="button"
                  onClick={() => setIsEditingDesc(true)}
                  className="flex items-center gap-1 text-[11px] font-mono text-[#787C83] hover:text-[#DCB001] transition-colors opacity-80 group-hover/desc:opacity-100 cursor-pointer"
                >
                  <Pencil size={11} />
                  <span>Edit</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDescValue(issue.description || '');
                      setIsEditingDesc(false);
                    }}
                    className="text-[11px] text-[#787C83] hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const updatedDescription = descValue;
                      onUpdateIssue({ ...issue, description: updatedDescription });
                      setIsEditingDesc(false);
                      toast.success('Description saved!');

                      try {
                        await fetch(`/api/issues/${issue.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ description: updatedDescription }),
                        });
                      } catch {
                        toast.error('Network error syncing description');
                      }
                    }}
                    className="px-2.5 py-0.5 bg-[#DCB001] text-[#0F1011] font-bold text-xs rounded transition-all cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              )}
            </div>

            {isEditingDesc ? (
              <div className="space-y-2 pt-1">
                <textarea
                  value={descValue}
                  onChange={(e) => setDescValue(e.target.value)}
                  placeholder="Write task description in Markdown (use @T1, @T2 to tag other tasks)..."
                  rows={6}
                  className="w-full p-3 bg-[#131415] border border-[#DCB001]/60 focus:border-[#DCB001] rounded-xl font-mono text-xs text-white outline-none resize-y leading-relaxed"
                />
                <div className="p-3 bg-[#131415]/70 border border-[#2A2C30] rounded-xl space-y-1">
                  <span className="text-[10px] font-mono text-[#787C83] uppercase tracking-wider block">Live Preview</span>
                  <MarkdownRenderer content={descValue} />
                </div>
              </div>
            ) : (
              <div className="pt-1">
                <MarkdownRenderer content={issue.description} />
              </div>
            )}
          </div>

          {/* ─── TAGGED & RELATED TASKS SECTION (Interactive Cards & Separate Stack View) ─── */}
          <div className="p-4 rounded-xl bg-[#1B1C1F] border border-[#2A2C30] space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag size={15} className="text-[#38BDF8]" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  Tagged & Related Tasks ({currentTaskTags.length})
                </h3>
              </div>

              {allIssues && allIssues.length > 1 && (
                <button
                  type="button"
                  onClick={() => setShowAddTagPicker((prev) => !prev)}
                  className="flex items-center gap-1.5 px-3 py-1 bg-[#131415] hover:bg-[#202226] border border-[#38BDF8]/40 hover:border-[#38BDF8] text-[#38BDF8] text-xs font-bold rounded-lg transition-all cursor-pointer shadow-sm"
                >
                  <Plus size={13} />
                  <span>Tag Task (@)</span>
                </button>
              )}
            </div>

            {/* Tagged Tasks Cards Grid */}
            {currentTaskTags.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {currentTaskTags.map((tagStr) => {
                  const found = allIssues ? findIssueByTag(tagStr, allIssues) : undefined;
                  const displayTag = tagStr.startsWith('@') ? tagStr : `@${tagStr}`;
                  const shortId = found ? getTaskShortId(found, allIssues) : displayTag.replace(/^@/, '');
                  const statusCfg = found ? (STATUS_CONFIG[found.status] || STATUS_CONFIG.todo) : STATUS_CONFIG.todo;

                  return (
                    <div
                      key={tagStr}
                      className="group/card relative flex flex-col justify-between p-3.5 rounded-xl bg-[#17181A] hover:bg-[#1C1E22] border border-[#2A2C30] hover:border-[#38BDF8]/70 transition-all shadow-md"
                    >
                      <div>
                        {/* Card Header: Tag Badge & Status & Remove button */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-[#DCB001] bg-[#DCB001]/15 border border-[#DCB001]/30 px-2 py-0.5 rounded">
                              {shortId}
                            </span>
                            {found?.key && (
                              <span className="font-mono text-[10px] text-[#787C83]">
                                {found.key}
                              </span>
                            )}
                            {found && (
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                                {statusCfg.label}
                              </span>
                            )}
                          </div>

                          {/* Remove Tag Button */}
                          <button
                            type="button"
                            onClick={() => handleRemoveTaskTag(tagStr)}
                            className="p-1 rounded-md text-[#787C83] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors cursor-pointer"
                            title={`Remove tag ${displayTag}`}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>

                        {/* Card Title */}
                        <h4 className="text-xs font-bold text-white group-hover/card:text-[#38BDF8] transition-colors line-clamp-2 leading-relaxed">
                          {found ? found.title : displayTag}
                        </h4>

                        {/* Folder / Epic Tag */}
                        {found?.epic && (
                          <div className="flex items-center gap-1 mt-2 text-[10px] font-mono text-[#A855F7]">
                            <Layers size={10} />
                            <span className="truncate">{found.epic}</span>
                          </div>
                        )}
                      </div>

                      {/* Click to Open Tagged Task Button (Opens on top in separate view) */}
                      <div className="pt-3 mt-2 border-t border-[#2A2C30]/70 flex items-center justify-between">
                        <span className="text-[10px] text-[#787C83]">
                          {found?.assigneeName ? `Assignee: ${found.assigneeName}` : 'Click to inspect'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (found) {
                              setOverlayIssueId(found.id);
                            } else {
                              toast.info(`Tagged task ${displayTag}`);
                            }
                          }}
                          className="flex items-center gap-1 text-xs font-bold text-[#38BDF8] hover:text-white bg-[#38BDF8]/10 hover:bg-[#38BDF8] hover:text-[#0F1011] px-2.5 py-1 rounded-md transition-all cursor-pointer"
                        >
                          <span>Open Task</span>
                          <ExternalLink size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-[#787C83] italic pt-1">
                No other tasks tagged yet. Click &quot;Tag Task (@)&quot; above to relate previous tasks.
              </p>
            )}

            {/* Add Task Tag Dropdown / Picker Modal */}
            {showAddTagPicker && allIssues && (
              <div className="p-3.5 bg-[#131415] border border-[#38BDF8]/60 rounded-xl space-y-3 shadow-2xl animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-[#38BDF8] flex items-center gap-1.5">
                    <Tag size={13} />
                    <span>Select or Type Task to Tag (@)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddTagPicker(false)}
                    className="text-[#787C83] hover:text-white p-0.5 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="Search tasks by ID or name (e.g. T1, database, or write @T...)..."
                  value={tagPickerSearch}
                  onChange={(e) => {
                    setTagPickerSearch(e.target.value);
                    setTagPickerIndex(0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setTagPickerIndex((prev) => (prev + 1) % (filteredTagCandidates.length || 1));
                      return;
                    }
                    if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setTagPickerIndex((prev) => (prev - 1 + filteredTagCandidates.length) % (filteredTagCandidates.length || 1));
                      return;
                    }
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (filteredTagCandidates.length > 0) {
                        const targetShortId = getTaskShortId(filteredTagCandidates[tagPickerIndex] || filteredTagCandidates[0], allIssues);
                        handleToggleTaskTag(targetShortId);
                        setTagPickerSearch('');
                        setShowAddTagPicker(false);
                      } else if (tagPickerSearch.trim()) {
                        const manualTag = tagPickerSearch.trim().replace(/^@/, '');
                        handleToggleTaskTag(manualTag);
                        setTagPickerSearch('');
                        setShowAddTagPicker(false);
                      }
                      return;
                    }
                    if (e.key === 'Escape') {
                      setShowAddTagPicker(false);
                    }
                  }}
                  className="w-full bg-[#1B1C1F] border border-[#38BDF8]/50 focus:border-[#38BDF8] rounded-lg px-3 py-2 text-xs text-white outline-none font-mono"
                  autoFocus
                />

                <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
                  {filteredTagCandidates.map((t, idx) => {
                    const shortId = getTaskShortId(t, allIssues);
                    const isTagActive = currentTaskTags.some(
                      (ct) => ct.toUpperCase() === shortId.toUpperCase() || ct.toUpperCase() === `@${shortId.toUpperCase()}`
                    );
                    const isSelected = idx === tagPickerIndex;

                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          handleToggleTaskTag(shortId);
                          setShowAddTagPicker(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#38BDF8]/20 text-white border border-[#38BDF8]/50'
                            : isTagActive
                            ? 'bg-[#38BDF8]/15 text-[#38BDF8] border border-[#38BDF8]/40'
                            : 'bg-[#17181A] hover:bg-[#202226] text-[#CFD4DD] border border-[#2A2C30]'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-mono font-bold text-[#DCB001] bg-[#DCB001]/10 px-1.5 py-0.5 rounded text-[11px] border border-[#DCB001]/25 shrink-0">
                            {shortId}
                          </span>
                          <span className="truncate text-xs">{t.title}</span>
                        </div>
                        {isTagActive && <Check size={13} className="text-[#38BDF8] shrink-0 ml-1.5" />}
                      </button>
                    );
                  })}

                  {filteredTagCandidates.length === 0 && tagPickerSearch.trim() && (
                    <div className="p-2 text-center text-xs text-[#787C83]">
                      Press Enter to add tag <strong className="text-[#38BDF8]">@{tagPickerSearch.trim().replace(/^@/, '')}</strong>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Properties Sidebar */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          {/* Properties Card */}
          <div className="p-4 rounded-xl bg-[#1B1C1F] border border-[#2A2C30] space-y-4 text-xs">
            <span className="text-[11px] font-mono text-[#787C83] uppercase tracking-wider block pb-2 border-b border-[#2A2C30]">
              Task Properties
            </span>

            {/* Status Selector */}
            <div>
              <span className="text-[#787C83] block mb-1 font-medium">Status</span>
              <select
                value={issue.status}
                onChange={(e) => handleStatusChange(e.target.value as Status)}
                className="w-full bg-[#131415] border border-[#2A2C30] text-[#DCB001] font-semibold rounded-lg p-2 outline-none cursor-pointer"
              >
                <option value="todo">Todo</option>
                <option value="in_progress">In Progress</option>
                <option value="needs_review">Needs Review</option>
                <option value="done" disabled={!canCompleteTasks}>
                  Done {!canCompleteTasks ? '(No Access)' : ''}
                </option>
              </select>
            </div>

            {/* Priority Selector */}
            <div>
              <span className="text-[#787C83] block mb-1 font-medium">Priority</span>
              <select
                value={issue.priority}
                onChange={(e) => handlePriorityChange(e.target.value as Priority)}
                className="w-full bg-[#131415] border border-[#2A2C30] text-white font-medium rounded-lg p-2 outline-none cursor-pointer capitalize"
              >
                <option value="critical">Critical (P0)</option>
                <option value="high">High (P1)</option>
                <option value="medium">Medium (P2)</option>
                <option value="low">Low (P3)</option>
              </select>
            </div>

            {/* Due Date */}
            <div>
              <span className="text-[#787C83] block mb-1 flex items-center gap-1 font-medium">
                <Calendar size={12} /> Due Date
              </span>
              <input
                type="date"
                value={issue.dueDate ? issue.dueDate.split('T')[0] : ''}
                onChange={(e) => handleDueDateChange(e.target.value)}
                className="w-full bg-[#131415] border border-[#2A2C30] text-white font-mono rounded-lg p-2 outline-none cursor-pointer"
              />
            </div>

            {/* Assigned User */}
            <div>
              <span className="text-[#787C83] block mb-1 font-medium">Assigned To</span>
              <div className="flex items-center gap-2 p-2 bg-[#131415] border border-[#2A2C30] rounded-lg">
                <Avatar
                  user={{
                    id: 'usr_assigned',
                    name: (issue as any).assigneeName || issue.assignee?.name || 'General (Anyone)',
                    avatar: issue.assignee?.avatar || (issue as any).assigneeAvatar,
                    email: '',
                    role: '',
                  }}
                  size="xs"
                />
                <span className="font-semibold text-[#CFD4DD]">
                  {(issue as any).assigneeName || issue.assignee?.name || 'General (Anyone)'}
                </span>
              </div>
            </div>

            {/* Project */}
            <div>
              <span className="text-[#787C83] block mb-1 font-medium">Project Workspace</span>
              <div className="p-2 bg-[#131415] border border-[#2A2C30] rounded-lg font-mono font-bold text-[#DCB001]">
                {issue.project} ({issue.key.split('-')[0]})
              </div>
            </div>

            {/* Created Date (Editable by Admin/Owner) */}
            <div className="pt-2 border-t border-[#2A2C30]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[#787C83] flex items-center gap-1 font-medium">
                  <Clock size={12} /> Created Date
                </span>
                {(canEditDates || currentRole === 'owner') && !isEditingCreatedAt && (
                  <button
                    type="button"
                    onClick={() => setIsEditingCreatedAt(true)}
                    className="flex items-center gap-1 text-[10px] font-mono text-[#DCB001] hover:underline"
                    title="Edit creation timestamp (Admin privilege)"
                  >
                    <Pencil size={10} />
                    <span>Edit</span>
                  </button>
                )}
              </div>

              {isEditingCreatedAt ? (
                <div className="space-y-1.5 pt-1">
                  <input
                    type="datetime-local"
                    defaultValue={
                      issue.createdAt
                        ? new Date(new Date(issue.createdAt).getTime() - new Date().getTimezoneOffset() * 60000)
                            .toISOString()
                            .slice(0, 16)
                        : ''
                    }
                    id="created-at-picker-input"
                    className="w-full bg-[#131415] border border-[#DCB001]/50 text-white font-mono text-[11px] rounded-lg p-1.5 outline-none"
                  />
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsEditingCreatedAt(false)}
                      className="px-2 py-1 rounded bg-[#1F2024] hover:bg-[#2A2C32] text-[10px] font-semibold text-[#9499A0]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.getElementById('created-at-picker-input') as HTMLInputElement;
                        if (input && input.value) {
                          handleCreatedAtChange(input.value);
                        }
                      }}
                      className="px-2.5 py-1 rounded bg-[#DCB001] hover:bg-[#c49d01] text-[10px] font-bold text-black"
                    >
                      Save Date
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-2 bg-[#131415] border border-[#2A2C30] rounded-lg font-mono text-[11px] text-[#A4A9B3]">
                  {issue.createdAt ? new Date(issue.createdAt).toLocaleString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  }) : 'Not recorded'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── STACKED / TOP TASK OVERLAY MODAL ─── */}
      {overlayIssue && (
        <div 
          role="dialog"
          aria-modal="true"
          aria-label={`Inspecting Tagged Task ${overlayIssue.key}`}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in"
        >
          <div className="relative w-full max-w-5xl h-[90vh] bg-[#131415] border border-[#38BDF8]/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            {/* Overlay Top Bar */}
            <div className="px-5 py-3 bg-[#17181A] border-b border-[#2A2C30] flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setOverlayIssueId(null)}
                  className="flex items-center gap-1.5 px-3 py-1 bg-[#131415] hover:bg-[#202226] border border-[#2A2C30] hover:border-white text-xs font-bold text-[#CFD4DD] hover:text-white rounded-lg transition-all cursor-pointer"
                >
                  <ArrowLeft size={13} />
                  <span>Back to {getTaskShortId(issue, allIssues)}</span>
                </button>
                <div className="h-4 w-[1px] bg-[#2A2C30]" />
                <div className="flex items-center gap-2">
                  <Tag size={14} className="text-[#38BDF8]" />
                  <span className="text-xs font-mono text-[#38BDF8] font-bold">Tagged Task View:</span>
                  <span className="font-mono text-xs font-bold text-[#DCB001] bg-[#DCB001]/10 px-2 py-0.5 rounded border border-[#DCB001]/30">
                    {getTaskShortId(overlayIssue, allIssues)}
                  </span>
                  <span className="font-bold text-white text-xs truncate max-w-[200px] sm:max-w-[320px]">
                    {overlayIssue.title}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOverlayIssueId(null)}
                className="p-1.5 text-[#787C83] hover:text-white bg-[#131415] hover:bg-[#202226] border border-[#2A2C30] rounded-lg transition-colors cursor-pointer"
                title="Close overlay"
              >
                <X size={15} />
              </button>
            </div>

            {/* Render nested task details */}
            <div className="flex-1 overflow-hidden">
              <IssueDetailView
                issue={overlayIssue}
                allIssues={allIssues}
                onSelectIssue={onSelectIssue}
                onUpdateIssue={onUpdateIssue}
                currentRole={currentRole}
                onClose={() => setOverlayIssueId(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
