'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Issue, Status, Priority, TimeEntry } from '@/lib/types';
import { Avatar } from '@/components/ui/Avatar';
import { 
  Star, 
  MoreHorizontal, 
  ChevronUp, 
  ChevronDown, 
  Link, 
  Check,
  CheckSquare,
  Plus,
  Camera,
  Image as ImageIcon,
  Folder,
  FolderPlus,
  Sparkles,
  Clock,
  Play,
  Square,
  AlertTriangle,
  ShieldAlert,
  Calendar,
  Layers,
  MessageSquare,
  Send,
  Trash2,
  Tag,
  Hash,
  Pencil
} from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';

interface IssueDetailViewProps {

  issue: Issue;
  onUpdateIssue: (updated: Issue) => void;
  onOpenDiffModal: () => void;
  currentRole?: string;
}

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
  onUpdateIssue,
  currentRole = 'owner',
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [isUploadingTaskImg, setIsUploadingTaskImg] = useState(false);

  // Description markdown edit state
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState(issue.description || '');
  const [isSavingDesc, setIsSavingDesc] = useState(false);

  useEffect(() => {
    setDescValue(issue.description || '');
  }, [issue.description]);

  // Time tracking & live timer state

  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [newCommentText, setNewCommentText] = useState('');


  // Timer interval effect
  useEffect(() => {
    let interval: any;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

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

    const updated = { ...issue, status: newStatus };
    onUpdateIssue(updated);
    try {
      await fetch(`/api/issues/${issue.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      toast.success(`Status updated to ${newStatus.replace('_', ' ')}`);
    } catch {
      toast.error('Failed to update status');
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

  // Estimate handler
  const handleEstimateChange = async (hours: number) => {
    const updated = { ...issue, estimatedHours: hours };
    onUpdateIssue(updated);
    try {
      await fetch(`/api/issues/${issue.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimatedHours: hours }),
      });
      toast.success('Estimate updated');
    } catch {}
  };

  // Toggle Live Timer
  const handleToggleTimer = async () => {
    if (isTimerRunning) {
      // Stopping timer: Log minutes
      const minutesSpent = Math.max(1, Math.round(timerSeconds / 60));
      const newEntry: TimeEntry = {
        id: `time_${Date.now()}`,
        durationMinutes: minutesSpent,
        note: `Work session on ${issue.key}`,
        createdAt: new Date().toISOString(),
        userName: 'Current User',
      };

      const updatedEntries = [...(issue.timeEntries || []), newEntry];
      const newLoggedHours = Number(((issue.loggedHours || 0) + minutesSpent / 60).toFixed(2));

      const updated = {
        ...issue,
        timeEntries: updatedEntries,
        loggedHours: newLoggedHours,
      };

      onUpdateIssue(updated);
      setIsTimerRunning(false);
      setTimerSeconds(0);
      toast.success(`Logged ${minutesSpent} min to ${issue.key}`);

      try {
        await fetch(`/api/issues/${issue.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            timeEntries: updatedEntries,
            loggedHours: newLoggedHours,
          }),
        });
      } catch {}
    } else {
      setIsTimerRunning(true);
      toast.info('Live time tracker started');
    }
  };

  // Image Upload Handler
  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingTaskImg(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('taskId', issue.id);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const imageRecord = await res.json();
        toast.success('Image uploaded successfully');

        onUpdateIssue({
          ...issue,
          images: [...(issue.images || []), imageRecord],
        });
      } else {
        toast.error('Failed to upload image');
      }
    } catch {
      toast.error('Upload failed');
    } finally {
      setIsUploadingTaskImg(false);
    }
  };

  const issueImages = issue.images || [];

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const activeBlockers = parseBlockedBy(issue.blockedBy);
  const isBlocked = activeBlockers.length > 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#131415] text-[#CFD4DD] overflow-y-auto font-sans select-none">
      {/* Top Warning Banner if Task is Blocked */}
      {isBlocked && (
        <div className="bg-[#EF4444]/15 border-b border-[#EF4444]/30 px-4 py-2 flex items-center justify-between text-xs text-[#EF4444] font-medium">
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
      <div className="p-4 sm:p-6 max-w-6xl w-full mx-auto grid grid-cols-12 gap-6">
        {/* Left / Center Content Column */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* Header Row */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-[#DCB001] bg-[#1B1C1F] border border-[#2A2C30] px-2 py-0.5 rounded">
                  {issue.key}
                </span>
                {issue.epic && (
                  <span className="font-mono text-[11px] text-[#A855F7] bg-[#A855F7]/10 border border-[#A855F7]/30 px-2 py-0.5 rounded flex items-center gap-1">
                    <Layers size={10} /> {issue.epic}
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {/* Copy Link Button */}
                <button
                  onClick={handleCopyLink}
                  className="p-1.5 bg-[#1B1C1F] hover:bg-[#2A2C30] border border-[#2A2C30] rounded-lg text-xs text-[#787C83] hover:text-[#CFD4DD] transition-colors"
                  title="Copy Task Link"
                >
                  {copiedLink ? <Check size={14} className="text-[#22C55E]" /> : <Link size={14} />}
                </button>
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
                  className="flex items-center gap-1 text-[11px] font-mono text-[#787C83] hover:text-[#DCB001] transition-colors opacity-80 group-hover/desc:opacity-100"
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
                    className="text-[11px] text-[#787C83] hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      // 1. Immediately update UI and exit edit mode (0ms)
                      const updatedDescription = descValue;
                      onUpdateIssue({ ...issue, description: updatedDescription });
                      setIsEditingDesc(false);
                      toast.success('Description saved!');

                      // 2. Process in background to database
                      try {
                        const res = await fetch(`/api/issues/${issue.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ description: updatedDescription }),
                        });
                        if (!res.ok) {
                          toast.error('Failed to sync description with database');
                        }
                      } catch {
                        toast.error('Network error syncing description');
                      }
                    }}
                    className="px-2.5 py-0.5 bg-[#DCB001] text-[#0F1011] font-bold text-xs rounded transition-all"
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
                  placeholder="Write task description in Markdown (e.g. ## Overview, **bold**, - list)..."
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


          {/* Task Attachments Section */}
          <div className="space-y-3 p-4 rounded-xl bg-[#1B1C1F] border border-[#2A2C30]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon size={16} className="text-[#DCB001]" />
                <h3 className="text-xs font-semibold text-[#CFD4DD]">Attachments & Screenshots ({issueImages.length})</h3>
              </div>

              <label className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-[#0F1011] bg-[#DCB001] hover:bg-[#c49c00] rounded-lg cursor-pointer transition-all shadow-sm">
                <Camera size={13} />
                <span>{isUploadingTaskImg ? 'Uploading...' : 'Upload Image'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageFileUpload(e)}
                  className="hidden"
                />
              </label>
            </div>

            {issueImages.length > 0 ? (
              <div className="grid grid-cols-3 gap-3 pt-2">
                {issueImages.map((img: any) => (
                  <div key={img.id} className="relative group rounded-lg overflow-hidden border border-[#2A2C30]">
                    <img src={img.url} alt={img.fileName} className="w-full h-24 object-cover" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-end text-[10px] font-mono text-white truncate">
                      <span className="truncate">{img.fileName}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#787C83] italic pt-1">No attachments uploaded yet.</p>
            )}
          </div>
        </div>

        {/* Right Properties & Time Tracking Sidebar */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          {/* Time Tracking Card (§1.5) */}
          <div className="p-4 rounded-xl bg-[#1B1C1F] border border-[#2A2C30] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#2A2C30]">
              <div className="flex items-center gap-2">
                <Clock size={15} className="text-[#DCB001]" />
                <span className="text-xs font-bold text-white">Time Tracking</span>
              </div>
              <span className="text-[11px] font-mono text-[#DCB001] font-bold">
                {issue.loggedHours || 0}h logged
              </span>
            </div>

            {/* Live Timer Widget */}
            <div className="p-3 bg-[#131415] border border-[#2A2C30] rounded-xl flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[10px] font-mono text-[#787C83] uppercase tracking-wider block">Live Session</span>
                <span className="text-base font-mono font-bold text-white">
                  {isTimerRunning ? formatTimer(timerSeconds) : '00:00'}
                </span>
              </div>

              <button
                onClick={handleToggleTimer}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-md transition-all ${
                  isTimerRunning
                    ? 'bg-[#EF4444] hover:bg-[#dc2626] text-white animate-pulse'
                    : 'bg-[#DCB001] hover:bg-[#c49c00] text-[#0F1011]'
                }`}
              >
                {isTimerRunning ? <Square size={12} /> : <Play size={12} />}
                <span>{isTimerRunning ? 'Stop Timer' : 'Start Timer'}</span>
              </button>
            </div>

            {/* Estimate & Progress */}
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#787C83]">Estimate:</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={issue.estimatedHours || 0}
                    onChange={(e) => handleEstimateChange(parseFloat(e.target.value) || 0)}
                    className="w-14 bg-[#131415] border border-[#2A2C30] text-right text-xs text-[#DCB001] font-mono rounded px-1.5 py-0.5 outline-none"
                  />
                  <span className="text-[#787C83] font-mono">hrs</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-[#131415] h-2 rounded-full overflow-hidden border border-[#2A2C30]">
                <div
                  className="bg-[#DCB001] h-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, issue.estimatedHours ? ((issue.loggedHours || 0) / issue.estimatedHours) * 100 : 0)}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Properties Card */}
          <div className="p-4 rounded-xl bg-[#1B1C1F] border border-[#2A2C30] space-y-4 text-xs">
            <span className="text-[11px] font-mono text-[#787C83] uppercase tracking-wider block pb-2 border-b border-[#2A2C30]">
              Task Properties
            </span>

            {/* Status Selector */}
            <div>
              <span className="text-[#787C83] block mb-1">Status</span>
              <select
                value={issue.status}
                onChange={(e) => handleStatusChange(e.target.value as Status)}
                className="w-full bg-[#131415] border border-[#2A2C30] text-[#DCB001] font-semibold rounded-lg p-2 outline-none cursor-pointer"
              >
                <option value="todo">Todo</option>
                <option value="in_progress">In Progress</option>
                <option value="needs_review">Needs Review</option>
                <option value="done">Done (Creator Only)</option>
              </select>
            </div>

            {/* Priority Selector */}
            <div>
              <span className="text-[#787C83] block mb-1">Priority</span>
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
              <span className="text-[#787C83] block mb-1 flex items-center gap-1">
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
              <span className="text-[#787C83] block mb-1">Assigned To</span>
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
              <span className="text-[#787C83] block mb-1">Project Workspace</span>
              <div className="p-2 bg-[#131415] border border-[#2A2C30] rounded-lg font-mono font-bold text-[#DCB001]">
                {issue.project} ({issue.key.split('-')[0]})
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

