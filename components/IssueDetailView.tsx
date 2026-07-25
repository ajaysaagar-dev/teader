'use client';

import React, { useState } from 'react';
import { Issue, Status } from '@/lib/types';
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
  Image as ImageIcon
} from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

interface IssueDetailViewProps {
  issue: Issue;
  onUpdateIssue: (updated: Issue) => void;
  onOpenDiffModal: () => void;
  currentRole?: string;
}

export const IssueDetailView: React.FC<IssueDetailViewProps> = ({
  issue,
  onUpdateIssue,
  currentRole = 'owner',
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [newSubworkTitle, setNewSubworkTitle] = useState('');
  const [isAddingSubwork, setIsAddingSubwork] = useState(false);
  const [uploadingSubtaskId, setUploadingSubtaskId] = useState<string | null>(null);
  const [isUploadingTaskImg, setIsUploadingTaskImg] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/issue/${issue.key}`);
    setCopiedLink(true);
    toast.success(`Copied link for ${issue.key}`);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Status transition handler with Project Owner restriction
  const handleStatusChange = async (newStatus: Status) => {
    if (issue.status === 'needs_review' && newStatus === 'done' && currentRole !== 'owner') {
      toast.error('Permission Denied: Only the project creator can approve and move tasks to Done.');
      return;
    }

    onUpdateIssue({ ...issue, status: newStatus });
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

  // Toggle Subtask Completion in DB
  const handleToggleSubtask = async (subId: string) => {
    const targetSub = issue.subtasks.find((st) => st.id === subId);
    if (!targetSub) return;

    const nextCompleted = !targetSub.completed;
    const updatedSubtasks = issue.subtasks.map((st) =>
      st.id === subId ? { ...st, completed: nextCompleted } : st
    );

    let nextStatus = issue.status;
    if (issue.status === 'done' && !nextCompleted) {
      nextStatus = 'needs_review';
      toast.info('Incomplete sub-work detected: Task status automatically moved to Needs Review');
      try {
        await fetch(`/api/issues/${issue.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'needs_review' }),
        });
      } catch {}
    }

    const allDone = updatedSubtasks.every((st) => st.completed);
    if (allDone && updatedSubtasks.length > 0 && nextStatus !== 'needs_review') {
      confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
      toast.success('All sub-works completed! 🎉');
    }

    onUpdateIssue({
      ...issue,
      status: nextStatus,
      subtasks: updatedSubtasks,
    });

    try {
      await fetch('/api/subtasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subId, completed: nextCompleted }),
      });
    } catch {}
  };

  // Add Subtask / Sub-work
  const handleAddSubworkRealtime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubworkTitle.trim()) return;

    const newTitle = newSubworkTitle.trim();
    setNewSubworkTitle('');
    setIsAddingSubwork(false);

    let nextStatus = issue.status;
    if (issue.status === 'done') {
      nextStatus = 'needs_review';
      toast.info('New incomplete sub-work added: Task status automatically moved to Needs Review');
      try {
        await fetch(`/api/issues/${issue.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'needs_review' }),
        });
      } catch {}
    }

    try {
      const res = await fetch('/api/subtasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId: issue.id, title: newTitle }),
      });

      let newSub: any;
      if (res.ok) {
        newSub = await res.json();
      } else {
        newSub = {
          id: `sub_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          title: newTitle,
          completed: false,
        };
      }

      onUpdateIssue({
        ...issue,
        status: nextStatus,
        subtasks: [...issue.subtasks, newSub],
      });
      toast.success('Sub-work added to database!');
    } catch {
      toast.error('Failed to add sub-work');
    }
  };

  // Image Upload Handler for Sub-tasks & Main Task
  const handleImageFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    subtaskId?: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (subtaskId) setUploadingSubtaskId(subtaskId);
    else setIsUploadingTaskImg(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('taskId', issue.id);
      if (subtaskId) formData.append('subtaskId', subtaskId);
      formData.append('taskName', issue.title);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const uploadedImg = await res.json();
      if (res.ok) {
        toast.success(`Image uploaded and stored in database: ${uploadedImg.fileName}`);

        if (subtaskId) {
          const updatedSubs = issue.subtasks.map((st) =>
            st.id === subtaskId ? { ...st, imageId: uploadedImg.id, imageUrl: uploadedImg.url } : st
          );
          onUpdateIssue({ ...issue, subtasks: updatedSubs });
        } else {
          const existingImages = (issue as any).images || [];
          onUpdateIssue({ ...issue, images: [...existingImages, uploadedImg] } as any);
        }
      } else {
        throw new Error(uploadedImg.error || 'Upload failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Image upload failed');
    } finally {
      setUploadingSubtaskId(null);
      setIsUploadingTaskImg(false);
    }
  };

  const completedSubtasksCount = issue.subtasks.filter((st) => st.completed).length;
  const subtasksPercent =
    issue.subtasks.length > 0
      ? Math.round((completedSubtasksCount / issue.subtasks.length) * 100)
      : 0;

  const issueImages = (issue as any).images || [];

  return (
    <div className="flex-1 h-full bg-[#131415] text-[#CFD4DD] rounded-xl border border-[#2A2C30] m-2 overflow-hidden flex flex-col relative font-sans text-xs">
      {/* Panel Top Bar */}
      <div className="h-11 border-b border-[#2A2C30] px-4 flex items-center justify-between shrink-0 bg-[#131415]">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-[#CFD4DD]">{issue.title}</span>
          <button className="text-[#DCB001] hover:scale-110 transition-transform">
            <Star size={13} className="fill-[#DCB001]" />
          </button>
          <button className="text-[#787C83] hover:text-[#CFD4DD]">
            <MoreHorizontal size={14} />
          </button>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-[#787C83] font-mono">
          <div className="flex items-center gap-0.5">
            <button className="p-0.5 hover:text-[#CFD4DD]"><ChevronUp size={13} /></button>
            <button className="p-0.5 hover:text-[#CFD4DD]"><ChevronDown size={13} /></button>
          </div>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 overflow-y-auto p-6 grid grid-cols-12 gap-8">
        {/* Left Column */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-[#CFD4DD] tracking-tight">
              {issue.title}
            </h1>
          </div>

          <div className="text-sm text-[#9499A0] leading-relaxed font-normal">
            {issue.description || 'No description provided.'}
          </div>

          {/* Sub-works Checklist & Image Attachments */}
          <div className="space-y-3 p-4 rounded-xl bg-[#1B1C1F] border border-[#2A2C30]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare size={16} className="text-[#DCB001]" />
                <h3 className="text-xs font-semibold text-[#CFD4DD]">Sub-works & Checklist</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-[#787C83]">
                  {completedSubtasksCount} of {issue.subtasks.length} completed ({subtasksPercent}%)
                </span>
                <button
                  onClick={() => setIsAddingSubwork(!isAddingSubwork)}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#CFD4DD] bg-[#1E1E1E] hover:bg-[#2A2C30] border border-[#3B3D41] rounded"
                >
                  <Plus size={12} />
                  <span>Add Sub-work</span>
                </button>
              </div>
            </div>

            {isAddingSubwork && (
              <form onSubmit={handleAddSubworkRealtime} className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  autoFocus
                  value={newSubworkTitle}
                  onChange={(e) => setNewSubworkTitle(e.target.value)}
                  placeholder="Enter sub-work item & press Enter..."
                  className="flex-1 bg-[#131415] border border-[#2A2C30] rounded px-2.5 py-1 text-xs text-[#CFD4DD] outline-none focus:border-[#DCB001]"
                />
                <button
                  type="submit"
                  disabled={!newSubworkTitle.trim()}
                  className="px-3 py-1 bg-[#1E1E1E] hover:bg-[#2A2C30] text-[#CFD4DD] border border-[#3B3D41] rounded text-xs font-semibold"
                >
                  Add
                </button>
              </form>
            )}

            <div className="w-full h-1.5 bg-[#1A1B1D] rounded-full overflow-hidden border border-[#2A2C30]">
              <div
                className="h-full bg-[#DCB001] transition-all duration-300"
                style={{ width: `${subtasksPercent}%` }}
              />
            </div>

            <div className="divide-y divide-[#2A2C30] pt-1 space-y-2">
              {issue.subtasks.map((st: any) => (
                <div key={st.id} className="py-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-3 text-xs text-[#9499A0] hover:text-[#CFD4DD] cursor-pointer group transition-colors flex-1">
                      <input
                        type="checkbox"
                        checked={st.completed}
                        onChange={() => handleToggleSubtask(st.id)}
                        className="w-4 h-4 rounded border-[#3B3D41] bg-[#1A1B1D] text-[#DCB001] focus:ring-0 cursor-pointer accent-[#DCB001]"
                      />
                      <span className={st.completed ? 'line-through text-[#787C83]' : ''}>
                        {st.title}
                      </span>
                    </label>

                    {/* Image Upload Button for Sub-task */}
                    <label className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-[#DCB001] bg-[#1A1B1D] hover:bg-[#222427] border border-[#DCB001]/30 rounded cursor-pointer transition-colors">
                      <Camera size={11} />
                      <span>{uploadingSubtaskId === st.id ? 'Uploading...' : 'Attach Image'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageFileUpload(e, st.id)}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Sub-task Image Preview */}
                  {st.imageUrl && (
                    <div className="ml-7 pt-1">
                      <img
                        src={st.imageUrl}
                        alt="Sub-task image"
                        className="w-32 h-20 object-cover rounded-lg border border-[#2A2C30] hover:scale-105 transition-transform"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Overall Task Image Attachments Section */}
          <div className="space-y-3 p-4 rounded-xl bg-[#1B1C1F] border border-[#2A2C30]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon size={16} className="text-[#DCB001]" />
                <h3 className="text-xs font-semibold text-[#CFD4DD]">Task Attachments & Images ({issueImages.length})</h3>
              </div>

              <label className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-[#0F1011] bg-[#DCB001] hover:bg-[#c49c00] rounded-lg cursor-pointer transition-all shadow-sm">
                <Camera size={13} />
                <span>{isUploadingTaskImg ? 'Uploading...' : 'Attach Task Image'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageFileUpload(e)}
                  className="hidden"
                />
              </label>
            </div>

            {issueImages.length > 0 && (
              <div className="grid grid-cols-3 gap-3 pt-2">
                {issueImages.map((img: any) => (
                  <div key={img.id} className="relative group rounded-lg overflow-hidden border border-[#2A2C30]">
                    <img
                      src={img.url}
                      alt={img.fileName}
                      className="w-full h-24 object-cover"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-end text-[10px] font-mono text-white truncate">
                      <span className="truncate">{img.fileName}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Metadata Column */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-[#2A2C30]">
            <span className="text-[11px] font-mono text-[#787C83] uppercase tracking-wider">Properties</span>
            <div className="flex items-center gap-1">
              <button
                onClick={handleCopyLink}
                className="p-1.5 text-[#787C83] hover:text-[#CFD4DD] rounded hover:bg-[#1B1C1F] transition-colors"
                title="Copy Link"
              >
                {copiedLink ? <Check size={13} className="text-[#22C55E]" /> : <Link size={13} />}
              </button>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <span className="text-[#787C83] block mb-1">Status</span>
              <select
                value={issue.status}
                onChange={(e) => handleStatusChange(e.target.value as Status)}
                className="w-full bg-[#1B1C1F] border border-[#2A2C30] text-[#DCB001] font-semibold rounded-lg p-2 outline-none cursor-pointer"
              >
                <option value="todo">Todo</option>
                <option value="in_progress">In Progress</option>
                <option value="needs_review">Needs Review</option>
                <option value="done">Done (Creator Only)</option>
              </select>
            </div>

            <div>
              <span className="text-[#787C83] block mb-1">Assigned To</span>
              <div className="flex items-center gap-2 p-2 bg-[#1B1C1F] border border-[#2A2C30] rounded-lg">
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

            <div>
              <span className="text-[#787C83] block mb-1">Project</span>
              <div className="p-2 bg-[#1B1C1F] border border-[#2A2C30] rounded-lg font-mono font-bold text-[#DCB001]">
                {issue.project} ({issue.key.split('-')[0]})
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
