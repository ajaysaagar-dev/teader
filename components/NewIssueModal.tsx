'use client';

import React, { useState, useEffect } from 'react';
import { Priority, Status, Issue } from '@/lib/types';
import { X, Trash2, CheckSquare, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface NewIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateIssue: (issue: Issue) => void;
  defaultProjectKey?: string;
  defaultProjectName?: string;
  defaultProjectId?: number | string;
  isProjectLocked?: boolean;
}

export const NewIssueModal: React.FC<NewIssueModalProps> = ({
  isOpen,
  onClose,
  onCreateIssue,
  defaultProjectKey = 'TDR',
  defaultProjectName,
  defaultProjectId,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectKey, setProjectKey] = useState(defaultProjectKey);
  const [priority, setPriority] = useState<Priority>('medium');
  const [assigneeName, setAssigneeName] = useState('General (Anyone)');
  const [labels, setLabels] = useState<string>('Platform Core, Backend');

  const [joinedMembers, setJoinedMembers] = useState<{ id: number | string; name: string }[]>([]);
  const [subworks, setSubworks] = useState<{ id: string; title: string; completed: boolean }[]>([]);
  const [newSubworkTitle, setNewSubworkTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (defaultProjectKey) setProjectKey(defaultProjectKey);
  }, [defaultProjectKey]);

  // Fetch Joined Project Members for Assignee Dropdown
  useEffect(() => {
    if (isOpen && defaultProjectId) {
      fetch(`/api/projects/${defaultProjectId}/members`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setJoinedMembers(data);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, defaultProjectId]);

  if (!isOpen) return null;

  const handleAddSubwork = () => {
    if (!newSubworkTitle.trim()) return;
    setSubworks((prev) => [
      ...prev,
      { id: `sub_new_${Date.now()}_${Math.random()}`, title: newSubworkTitle.trim(), completed: false },
    ]);
    setNewSubworkTitle('');
  };

  const handleRemoveSubwork = (id: string) => {
    setSubworks((prev) => prev.filter((sw) => sw.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Please enter a task title');
      return;
    }

    setIsSubmitting(true);
    const targetProjectName = defaultProjectName || 'Teader Platform Core';

    try {
      const res = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || 'No description provided.',
          status: 'todo',
          priority,
          assigneeName,
          project: targetProjectName,
          projectId: defaultProjectId ? Number(defaultProjectId) : undefined,
          labels: labels.split(',').map((l) => l.trim()).filter(Boolean),
          subtasks: subworks,
        }),
      });

      if (res.ok) {
        const createdIssue = await res.json();
        onCreateIssue(createdIssue);
        toast.success(`Task ${createdIssue.key} created in ${targetProjectName}!`);
      } else {
        throw new Error('Failed to create in DB');
      }
    } catch {
      toast.error('Error saving task');
    } finally {
      setIsSubmitting(false);
    }

    setTitle('');
    setDescription('');
    setSubworks([]);
    setAssigneeName('General (Anyone)');
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-xl bg-[#1B1C1F] border border-[#2A2C30] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#2A2C30] bg-[#0F1011]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#787C83]">
                Create Task in
              </span>
              <span className="text-xs font-bold text-[#DCB001] bg-[#1A1B1D] px-2 py-0.5 rounded border border-[#2A2C30]">
                ToDo Section
              </span>

              <div className="flex items-center gap-1.5 bg-[#1A1B1D] border border-[#DCB001]/40 rounded px-2.5 py-0.5 text-xs text-[#DCB001] font-bold">
                <Lock size={12} className="text-[#DCB001]" />
                <span>{projectKey} {defaultProjectName ? `(${defaultProjectName})` : ''}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-[#787C83] hover:text-white rounded hover:bg-[#222427] transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
            {/* Title Field */}
            <div>
              <label className="block text-xs font-semibold text-[#CFD4DD] mb-1">
                Task Title <span className="text-[#C0393B]">*</span>
              </label>
              <input
                type="text"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Implement user authentication pipeline"
                className="w-full bg-[#131415] border border-[#2A2C30] rounded-lg p-2.5 text-xs text-[#CFD4DD] placeholder-[#787C83] outline-none focus:border-[#DCB001] transition-colors"
              />
            </div>

            {/* Description Field */}
            <div>
              <label className="block text-xs font-semibold text-[#CFD4DD] mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Add detailed task description..."
                className="w-full bg-[#131415] border border-[#2A2C30] rounded-lg p-2.5 text-xs text-[#CFD4DD] placeholder-[#787C83] outline-none focus:border-[#DCB001] transition-colors resize-none"
              />
            </div>

            {/* Sub-works Checklist Section */}
            <div className="p-3.5 bg-[#131415] rounded-xl border border-[#2A2C30] space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#CFD4DD]">
                  <CheckSquare size={14} className="text-[#DCB001]" />
                  <span>Sub-works / Subtasks ({subworks.length})</span>
                </div>
                <span className="text-[10px] text-[#787C83]">Addable before creating task</span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newSubworkTitle}
                  onChange={(e) => setNewSubworkTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSubwork();
                    }
                  }}
                  placeholder="Enter a sub-work item & press Add..."
                  className="flex-1 bg-[#1B1C1F] border border-[#2A2C30] rounded px-2.5 py-1 text-xs text-[#CFD4DD] outline-none focus:border-[#DCB001]"
                />
                <button
                  type="button"
                  onClick={handleAddSubwork}
                  className="px-3 py-1 bg-[#1E1E1E] hover:bg-[#2A2C30] text-[#CFD4DD] border border-[#3B3D41] rounded text-xs font-semibold"
                >
                  + Add
                </button>
              </div>

              {subworks.length > 0 && (
                <div className="divide-y divide-[#2A2C30] pt-1">
                  {subworks.map((sw) => (
                    <div key={sw.id} className="flex items-center justify-between py-1.5 text-xs text-[#CFD4DD]">
                      <span className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#DCB001]" />
                        {sw.title}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSubwork(sw.id)}
                        className="text-[#787C83] hover:text-[#C0393B] p-0.5 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Metadata Fields */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-[#787C83] mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  className="w-full bg-[#131415] border border-[#2A2C30] rounded-lg px-2.5 py-1.5 text-[#CFD4DD] outline-none font-semibold cursor-pointer"
                >
                  <option value="critical" className="bg-[#1B1C1F]">🔥 Critical</option>
                  <option value="high" className="bg-[#1B1C1F]">⚡ High</option>
                  <option value="medium" className="bg-[#1B1C1F]">↗ Medium</option>
                  <option value="low" className="bg-[#1B1C1F]">↘ Low</option>
                </select>
              </div>

              {/* Assignee Dropdown showing Joined Members (Default: General (Anyone)) */}
              <div>
                <label className="block text-[11px] font-medium text-[#787C83] mb-1">Assign Task To</label>
                <select
                  value={assigneeName}
                  onChange={(e) => setAssigneeName(e.target.value)}
                  className="w-full bg-[#131415] border border-[#DCB001]/40 rounded-lg px-2.5 py-1.5 text-[#DCB001] outline-none font-semibold cursor-pointer"
                >
                  <option value="General (Anyone)" className="bg-[#1B1C1F] text-[#DCB001]">
                    🌐 General (Anyone)
                  </option>
                  {joinedMembers.map((m) => (
                    <option key={m.id} value={m.name} className="bg-[#1B1C1F] text-[#CFD4DD]">
                      👤 {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-[#2A2C30]">
              <span className="text-[11px] text-[#787C83]">Task will be added to ToDo section</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-1.5 text-xs text-[#787C83] hover:text-white rounded-lg hover:bg-[#222427] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!title.trim() || isSubmitting}
                  className="px-4 py-1.5 text-xs font-semibold text-[#0F1011] bg-[#DCB001] hover:bg-[#c49c00] rounded-lg shadow-sm disabled:opacity-50 transition-all"
                >
                  Create Task
                </button>
              </div>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
