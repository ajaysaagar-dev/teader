'use client';

import React, { useState, useEffect } from 'react';
import { Priority, Status, Issue } from '@/lib/types';
import { 
  X, 
  Trash2, 
  CheckSquare, 
  Lock, 
  Sparkles, 
  FileText, 
  Calendar, 
  Clock, 
  Layers, 
  Check,
  AlertTriangle 
} from 'lucide-react';
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

const TEMPLATES = [
  {
    id: 'blank',
    name: 'Blank Task',
    title: '',
    description: '',
    labels: 'Platform Core',
    priority: 'medium' as Priority,
    subworks: [],
  },
  {
    id: 'bug',
    name: '🐛 Bug Report',
    title: '[Bug]: ',
    description: '### Steps to Reproduce\n1. \n2. \n3. \n\n### Expected Behavior\n\n### Actual Behavior\n\n### Environment\n- OS:\n- Browser:',
    labels: 'Bug, High Priority',
    priority: 'high' as Priority,
    subworks: [
      'Reproduce issue in development',
      'Identify root cause and write fix',
      'Add regression test suite',
    ],
  },
  {
    id: 'feature',
    name: '✨ Feature Request',
    title: '[Feature]: ',
    description: '### User Story\nAs a [user], I want to [action] so that [benefit].\n\n### Acceptance Criteria\n- [ ] Given...\n- [ ] When...\n- [ ] Then...',
    labels: 'Feature, Enhancement',
    priority: 'medium' as Priority,
    subworks: [
      'Design UI mockups & token spec',
      'Implement API endpoints & validation',
      'Build React client components',
    ],
  },
  {
    id: 'refactor',
    name: '🧹 Tech Debt / Refactor',
    title: '[Refactor]: ',
    description: '### Context & Motivation\n\n### Scope of Changes\n\n### Non-breaking verification',
    labels: 'Refactor, Performance',
    priority: 'low' as Priority,
    subworks: [
      'Benchmark existing performance',
      'Refactor components and optimize memoization',
      'Verify all Vitest tests pass',
    ],
  },
];

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
  const [dueDate, setDueDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState(2);
  const [selectedTemplate, setSelectedTemplate] = useState('blank');

  const [joinedMembers, setJoinedMembers] = useState<{ id: number | string; name: string }[]>([]);
  const [existingIssues, setExistingIssues] = useState<{ id: string; key: string; title: string }[]>([]);
  const [subworks, setSubworks] = useState<{ id: string; title: string; completed: boolean }[]>([]);
  const [newSubworkTitle, setNewSubworkTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (defaultProjectKey) setProjectKey(defaultProjectKey);
  }, [defaultProjectKey]);

  // Fetch Joined Project Members & Existing Issues for Duplication Detection
  useEffect(() => {
    if (isOpen) {
      if (defaultProjectId) {
        fetch(`/api/projects/${defaultProjectId}/members`)
          .then((res) => res.json())
          .then((data) => {
            if (Array.isArray(data)) {
              setJoinedMembers(data);
            }
          })
          .catch(() => {});
      }

      fetch('/api/issues')
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setExistingIssues(data.map((i: any) => ({ id: i.id, key: i.key, title: i.title })));
          }
        })
        .catch(() => {});
    }
  }, [isOpen, defaultProjectId]);

  // Real-time Duplicate Issue Detection (§4.2)
  const detectedDuplicates = React.useMemo(() => {
    const cleanTitle = title.replace(/^\[(Bug|Feature|Refactor)\]:\s*/i, '').trim().toLowerCase();
    if (cleanTitle.length < 4) return [];
    const words = cleanTitle.split(/\s+/).filter((w) => w.length > 3);
    if (words.length === 0) return [];

    return existingIssues.filter((iss) => {
      const issTitle = iss.title.toLowerCase();
      const matchCount = words.filter((w) => issTitle.includes(w)).length;
      return matchCount >= Math.min(2, words.length) || issTitle.includes(cleanTitle);
    }).slice(0, 3);
  }, [title, existingIssues]);


  if (!isOpen) return null;

  const handleApplyTemplate = (templateId: string) => {
    setSelectedTemplate(templateId);
    const tmpl = TEMPLATES.find((t) => t.id === templateId);
    if (!tmpl) return;

    setTitle(tmpl.title);
    setDescription(tmpl.description);
    setLabels(tmpl.labels);
    setPriority(tmpl.priority);
    setSubworks(
      tmpl.subworks.map((title, i) => ({
        id: `sub_tmpl_${i}_${Date.now()}`,
        title,
        completed: false,
      }))
    );
    toast.info(`Applied "${tmpl.name}" template`);
  };

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
          dueDate: dueDate || undefined,
          estimatedHours: Number(estimatedHours) || undefined,
          project: targetProjectName,
          projectId: defaultProjectId ? Number(defaultProjectId) : undefined,
          labels: labels.split(',').map((l) => l.trim()).filter(Boolean),
          subtasks: subworks,
        }),
      });

      if (res.ok) {
        const createdIssue = await res.json();
        onCreateIssue(createdIssue);
        toast.success(`Task ${createdIssue.key || ''} created successfully!`);
        onClose();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to create task');
      }
    } catch {
      toast.error('Network error while creating task');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div 
        role="dialog"
        aria-modal="true"
        aria-label="Create New Task"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          className="w-full max-w-2xl bg-[#1B1C1F] border border-[#2A2C30] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2C30] bg-[#17181A]">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-[#DCB001] bg-[#131415] border border-[#2A2C30] px-2 py-0.5 rounded">
                {projectKey}
              </span>
              <h2 className="text-sm font-bold text-white tracking-tight">Create New Task</h2>
            </div>

            <button onClick={onClose} className="text-[#787C83] hover:text-white p-1 rounded-lg">
              <X size={16} />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1 font-sans text-xs">

            {/* Templates Selector (§1.4) */}
            <div>
              <label className="block text-[11px] font-mono text-[#787C83] uppercase tracking-wider mb-1.5">
                Issue Template
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => handleApplyTemplate(tmpl.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold text-left transition-all border ${
                      selectedTemplate === tmpl.id
                        ? 'bg-[#2A2C30] text-[#DCB001] border-[#DCB001]/50 shadow-sm'
                        : 'bg-[#131415] text-[#CFD4DD] border-[#2A2C30] hover:bg-[#1A1B1D]'
                    }`}
                  >
                    {tmpl.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Task Title */}
            <div>
              <label className="block text-[11px] font-mono text-[#787C83] uppercase tracking-wider mb-1">
                Title <span className="text-[#EF4444]">*</span>
              </label>
              <input
                type="text"
                autoFocus
                required
                placeholder="Task title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-[#131415] border border-[#2A2C30] focus:border-[#DCB001] rounded-lg px-3 py-2 text-white outline-none text-xs sm:text-sm font-medium transition-colors"
              />

              {/* Duplicate Detection Warning Banner (§4.2) */}
              {detectedDuplicates.length > 0 && (
                <div className="mt-2 p-2.5 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg text-xs space-y-1">
                  <span className="text-[#EF4444] font-bold flex items-center gap-1 text-[11px]">
                    <AlertTriangle size={12} /> Potential Duplicates Detected ({detectedDuplicates.length}):
                  </span>
                  {detectedDuplicates.map((dup) => (
                    <div key={dup.id} className="text-[#CFD4DD] text-[11px] font-mono truncate pl-1">
                      &bull; <strong className="text-[#DCB001]">{dup.key}</strong>: {dup.title}
                    </div>
                  ))}
                </div>
              )}
            </div>


            {/* Description */}
            <div>
              <label className="block text-[11px] font-mono text-[#787C83] uppercase tracking-wider mb-1">
                Description & Markdown
              </label>
              <textarea
                rows={4}
                placeholder="Provide task details, acceptance criteria, or repro steps..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-[#131415] border border-[#2A2C30] focus:border-[#DCB001] rounded-lg px-3 py-2 text-white outline-none font-mono text-xs leading-relaxed resize-y transition-colors"
              />
            </div>

            {/* Grid for Priority, Assignee, Estimate & Due Date */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {/* Priority */}
              <div>
                <label className="block text-[11px] font-mono text-[#787C83] uppercase tracking-wider mb-1">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  className="w-full bg-[#131415] border border-[#2A2C30] rounded-lg px-2.5 py-1.5 text-[#CFD4DD] outline-none capitalize cursor-pointer"
                >
                  <option value="critical">Critical (P0)</option>
                  <option value="high">High (P1)</option>
                  <option value="medium">Medium (P2)</option>
                  <option value="low">Low (P3)</option>
                </select>
              </div>

              {/* Assignee */}
              <div>
                <label className="block text-[11px] font-mono text-[#787C83] uppercase tracking-wider mb-1">
                  Assignee
                </label>
                <select
                  value={assigneeName}
                  onChange={(e) => setAssigneeName(e.target.value)}
                  className="w-full bg-[#131415] border border-[#2A2C30] rounded-lg px-2.5 py-1.5 text-[#CFD4DD] outline-none cursor-pointer"
                >
                  <option value="General (Anyone)">General (Anyone)</option>
                  {joinedMembers.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                  <option value="karri">karri</option>
                  <option value="jori">jori</option>
                </select>
              </div>

              {/* Estimate */}
              <div>
                <label className="block text-[11px] font-mono text-[#787C83] uppercase tracking-wider mb-1">
                  Estimate (hrs)
                </label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#131415] border border-[#2A2C30] rounded-lg px-2.5 py-1.5 text-white outline-none font-mono"
                />
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-[11px] font-mono text-[#787C83] uppercase tracking-wider mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-[#131415] border border-[#2A2C30] rounded-lg px-2.5 py-1.5 text-white outline-none font-mono"
                />
              </div>
            </div>

            {/* Labels */}
            <div>
              <label className="block text-[11px] font-mono text-[#787C83] uppercase tracking-wider mb-1">
                Labels (Comma-separated)
              </label>
              <input
                type="text"
                value={labels}
                onChange={(e) => setLabels(e.target.value)}
                placeholder="UI, Frontend, Security..."
                className="w-full bg-[#131415] border border-[#2A2C30] rounded-lg px-3 py-1.5 text-white outline-none font-mono"
              />
            </div>

            {/* Sub-tasks Checklist */}
            <div className="space-y-2 pt-1 border-t border-[#2A2C30]/50">
              <label className="block text-[11px] font-mono text-[#787C83] uppercase tracking-wider">
                Sub-tasks ({subworks.length})
              </label>

              {/* Subtask list */}
              {subworks.length > 0 && (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {subworks.map((sw) => (
                    <div
                      key={sw.id}
                      className="flex items-center justify-between px-2.5 py-1.5 bg-[#131415] border border-[#2A2C30] rounded-lg text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <CheckSquare size={12} className="text-[#DCB001]" />
                        <span className="text-[#CFD4DD] truncate">{sw.title}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveSubwork(sw.id)}
                        className="text-[#787C83] hover:text-[#EF4444]"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add a sub-work item..."
                  value={newSubworkTitle}
                  onChange={(e) => setNewSubworkTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSubwork();
                    }
                  }}
                  className="flex-1 bg-[#131415] border border-[#2A2C30] rounded-lg px-2.5 py-1 text-white outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddSubwork}
                  className="px-3 py-1 bg-[#222427] hover:bg-[#2A2C30] text-[#CFD4DD] rounded-lg font-semibold"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#2A2C30]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-[#17181A] hover:bg-[#222427] text-[#787C83] hover:text-white rounded-xl font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-[#DCB001] hover:bg-[#c49c00] text-[#0F1011] rounded-xl font-bold transition-all shadow-md disabled:opacity-50"
              >
                {isSubmitting ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
