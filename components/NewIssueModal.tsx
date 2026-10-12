'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Priority, Status, Issue } from '@/lib/types';
import { 
  X, 
  Trash2, 
  CheckSquare, 
  Calendar, 
  Clock, 
  Check,
  AlertTriangle,
  User as UserIcon,
  Tag,
  Eye,
  ListTodo,
  Folder,
  FolderPlus,
  Plus,
  Zap,
  Sliders
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { CustomDropdown } from '@/components/ui/CustomDropdown';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { 
  getTaskShortId, 
  extractTagsAndCleanText, 
  getAvailableTaskMentions, 
  getMentionQueryAtCursor, 
  TaskMentionOption 
} from '@/lib/task-id';
import { TaskMentionPopover } from '@/components/ui/TaskMentionPopover';

interface NewIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateIssue: (issue: Issue) => void;
  defaultProjectKey?: string;
  defaultProjectName?: string;
  defaultProjectId?: number | string;
  isProjectLocked?: boolean;
  initialMode?: 'task' | 'folder';
  allowFolderCreation?: boolean;
  currentUser?: { id: number | string; name: string; username?: string; email?: string } | null;
}

export const NewIssueModal: React.FC<NewIssueModalProps> = ({
  isOpen,
  onClose,
  onCreateIssue,
  defaultProjectKey = 'PRJ',
  defaultProjectName,
  defaultProjectId,
  isProjectLocked = false,
  initialMode = 'task',
  allowFolderCreation = true,
  currentUser,
}) => {
  // Primary Switch: Task (default) or Folder
  const [creationMode, setCreationMode] = useState<'task' | 'folder'>(
    allowFolderCreation ? initialMode : 'task'
  );

  // Complexity Mode: Quick (default) or Advanced
  const [formView, setFormView] = useState<'quick' | 'advanced'>('quick');

  // Task Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectKey, setProjectKey] = useState(defaultProjectKey);
  const [priority, setPriority] = useState<Priority>('medium');
  const [assigneeName, setAssigneeName] = useState('General (Anyone)');
  const [targetFolderId, setTargetFolderId] = useState('folder_general');
  const [targetFolder, setTargetFolder] = useState('General');
  const [labels, setLabels] = useState<string>('General, Feature');
  const [dueDate, setDueDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState(2);
  const [taggedTasks, setTaggedTasks] = useState<string[]>([]);
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [taskPickerSearch, setTaskPickerSearch] = useState('');

  // Mention Autocomplete state
  const [mentionState, setMentionState] = useState<{
    active: boolean;
    target: 'title' | 'desc' | 'folder';
    query: string;
    startIndex: number;
    endIndex: number;
    selectedIndex: number;
  }>({
    active: false,
    target: 'title',
    query: '',
    startIndex: 0,
    endIndex: 0,
    selectedIndex: 0,
  });

  // Folder Form State
  const [folderName, setFolderName] = useState('');
  const [folderDescription, setFolderDescription] = useState('');
  const [folderColor, setFolderColor] = useState('#FFFFFF');
  const [folderTasks, setFolderTasks] = useState<{ id: string; title: string; completed: boolean; isFolder?: boolean }[]>([]);
  const [newFolderTaskTitle, setNewFolderTaskTitle] = useState('');

  const [joinedMembers, setJoinedMembers] = useState<{ id: number | string; name: string }[]>([]);
  const [existingIssues, setExistingIssues] = useState<Issue[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const mentionOptions = useMemo(() => getAvailableTaskMentions(existingIssues), [existingIssues]);

  // Extract available folder options with unique IDs
  const availableFolderOptions = React.useMemo(() => {
    const list: Array<{ id: string; name: string; createdAt?: string }> = [
      { id: 'folder_general', name: 'General' },
    ];
    const registeredIds = new Set<string>(['folder_general']);

    existingIssues.forEach((i: any) => {
      const isFolder = 
        (i.title && (i.title.startsWith('📁 ') || i.title.startsWith('[Folder]'))) ||
        (i.labels && Array.isArray(i.labels) && i.labels.some((l: string) => l.toLowerCase() === 'folder' || l.toLowerCase() === 'group'));

      if (isFolder) {
        const cleanName = i.title.replace(/^(\📁|\[Folder\])\s*/i, '').trim() || 'Untitled Folder';
        if (!registeredIds.has(i.id)) {
          registeredIds.add(i.id);
          list.push({
            id: i.id,
            name: cleanName,
            createdAt: i.createdAt || i.created_at,
          });
        }
      } else if (i.epic && i.epic.trim() && i.epic !== 'General' && i.epic !== 'Platform Core') {
        const epicName = i.epic.trim();
        const fakeId = i.folderId || `epic_${epicName}`;
        if (!registeredIds.has(fakeId) && !list.some((f) => f.name.toLowerCase() === epicName.toLowerCase())) {
          registeredIds.add(fakeId);
          list.push({
            id: fakeId,
            name: epicName,
            createdAt: i.createdAt,
          });
        }
      }
    });

    return list;
  }, [existingIssues]);

  useEffect(() => {
    if (defaultProjectKey) setProjectKey(defaultProjectKey);
  }, [defaultProjectKey]);

  useEffect(() => {
    if (isOpen) {
      setCreationMode(allowFolderCreation ? initialMode : 'task');
      setTaggedTasks([]);
      setShowTaskPicker(false);
      setMentionState({
        active: false,
        target: 'title',
        query: '',
        startIndex: 0,
        endIndex: 0,
        selectedIndex: 0,
      });
    }
  }, [isOpen, initialMode, allowFolderCreation]);

  const handleSelectMention = (option: TaskMentionOption) => {
    const tagToAdd = `@${option.shortId}`;
    if (!taggedTasks.includes(option.shortId) && !taggedTasks.includes(tagToAdd)) {
      setTaggedTasks((prev) => [...prev, tagToAdd]);
    }

    if (mentionState.target === 'title') {
      const before = title.slice(0, mentionState.startIndex);
      const after = title.slice(mentionState.endIndex);
      setTitle(`${before}${tagToAdd} ${after}`);
    } else if (mentionState.target === 'desc') {
      const before = description.slice(0, mentionState.startIndex);
      const after = description.slice(mentionState.endIndex);
      setDescription(`${before}${tagToAdd} ${after}`);
    } else if (mentionState.target === 'folder') {
      const before = folderName.slice(0, mentionState.startIndex);
      const after = folderName.slice(mentionState.endIndex);
      setFolderName(`${before}${tagToAdd} ${after}`);
    }

    setMentionState((prev) => ({ ...prev, active: false }));
  };

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
            setExistingIssues(data);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, defaultProjectId]);

  // Extract available folder names
  const availableFolders = React.useMemo(() => {
    const set = new Set<string>(['General']);
    existingIssues.forEach((i: any) => {
      if (i.title && (i.title.startsWith('📁 ') || i.title.startsWith('[Folder]'))) {
        set.add(i.title.replace(/^(\📁|\[Folder\])\s*/i, '').trim());
      }
      if (i.labels && Array.isArray(i.labels) && i.labels.some((l: string) => l.toLowerCase() === 'folder')) {
        set.add(i.title.replace(/^(\📁|\[Folder\])\s*/i, '').trim());
      }
      if (i.epic && i.epic.trim() && i.epic !== 'General' && i.epic !== 'Platform Core') {
        set.add(i.epic.trim());
      }
    });
    return Array.from(set);
  }, [existingIssues]);

  const isFolderDuplicate = React.useMemo(() => {
    if (creationMode !== 'folder' || !folderName.trim()) return false;
    const clean = folderName.trim().toLowerCase();
    return availableFolders.some((f) => f.toLowerCase().trim() === clean);
  }, [creationMode, folderName, availableFolders]);

  // Real-time Duplicate Issue Detection
  const detectedDuplicates = React.useMemo(() => {
    const activeTitle = creationMode === 'task' ? title : folderName;
    const cleanTitle = activeTitle.replace(/^\[(Bug|Feature|Refactor|Folder)\]:\s*/i, '').trim().toLowerCase();
    if (cleanTitle.length < 4) return [];
    const words = cleanTitle.split(/\s+/).filter((w) => w.length > 3);
    if (words.length === 0) return [];

    return existingIssues.filter((iss) => {
      const issTitle = iss.title.toLowerCase();
      const matchCount = words.filter((w) => issTitle.includes(w)).length;
      return matchCount >= Math.min(2, words.length) || issTitle.includes(cleanTitle);
    }).slice(0, 3);
  }, [title, folderName, creationMode, existingIssues]);

  if (!isOpen) return null;

  const handleInputChangeWithMention = (
    val: string,
    cursor: number,
    target: 'title' | 'desc' | 'folder'
  ) => {
    if (target === 'title') setTitle(val);
    else if (target === 'desc') setDescription(val);
    else if (target === 'folder') setFolderName(val);

    const mention = getMentionQueryAtCursor(val, cursor);
    if (mention) {
      setMentionState({
        active: true,
        target,
        query: mention.query,
        startIndex: mention.startIndex,
        endIndex: mention.endIndex,
        selectedIndex: 0,
      });
    } else {
      setMentionState((prev) => (prev.active && prev.target === target ? { ...prev, active: false } : prev));
    }
  };

  const handleInputKeyDownWithMention = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    target: 'title' | 'desc' | 'folder'
  ) => {
    if (mentionState.active && mentionState.target === target) {
      const q = mentionState.query.toLowerCase().trim();
      const filtered = mentionOptions.filter(
        (opt: TaskMentionOption) =>
          opt.shortId.toLowerCase().includes(q) ||
          opt.title.toLowerCase().includes(q) ||
          opt.key.toLowerCase().includes(q)
      );

      if (filtered.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setMentionState((prev) => ({
            ...prev,
            selectedIndex: (prev.selectedIndex + 1) % filtered.length,
          }));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setMentionState((prev) => ({
            ...prev,
            selectedIndex: (prev.selectedIndex - 1 + filtered.length) % filtered.length,
          }));
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          const selected = filtered[mentionState.selectedIndex] || filtered[0];
          handleSelectMention(selected);
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setMentionState((prev) => ({ ...prev, active: false }));
          return;
        }
      }
    }
  };

  const handleAddFolderTask = () => {
    if (!newFolderTaskTitle.trim()) return;
    const extracted = extractTagsAndCleanText(newFolderTaskTitle);
    setFolderTasks((prev) => [
      ...prev,
      {
        id: `ft_new_${Date.now()}_${Math.random()}`,
        title: extracted.cleanText || newFolderTaskTitle.trim(),
        completed: false,
        isFolder: false,
      },
    ]);
    if (extracted.tags.length > 0) {
      setTaggedTasks((prev) => Array.from(new Set([...prev, ...extracted.tags])));
    }
    setNewFolderTaskTitle('');
  };

  const handleRemoveFolderTask = (id: string) => {
    setFolderTasks((prev) => prev.filter((ft) => ft.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (creationMode === 'task' && !title.trim()) {
      toast.error('Please enter a task title');
      return;
    }

    if (creationMode === 'folder' && !folderName.trim()) {
      toast.error('Please enter a folder name');
      return;
    }

    setIsSubmitting(true);
    const targetProjectName = defaultProjectName || 'Project';
    const tempId = `temp_${Date.now()}`;
    const tempKey = `${projectKey}-${Date.now().toString().slice(-4)}`;

    let finalTitle = '';
    let finalDescription = '';
    const autoExtractedTags: string[] = [];

    if (creationMode === 'task') {
      const extracted = extractTagsAndCleanText(title);
      finalTitle = extracted.cleanText || title.trim();
      autoExtractedTags.push(...extracted.tags);
      finalDescription = description.trim() || 'No description provided.';
    } else {
      const extracted = extractTagsAndCleanText(folderName);
      finalTitle = `📁 ${extracted.cleanText || folderName.trim()}`;
      autoExtractedTags.push(...extracted.tags);
      finalDescription = folderDescription.trim() || `Folder workspace group: ${extracted.cleanText || folderName.trim()}`;
    }

    const descExtracted = extractTagsAndCleanText(finalDescription);
    autoExtractedTags.push(...descExtracted.tags);

    const combinedTags = Array.from(
      new Set([
        ...taggedTasks.map((t) => (t.startsWith('@') ? t : `@${t}`)),
        ...autoExtractedTags.map((t) => (t.startsWith('@') ? t : `@${t}`)),
      ])
    );

    const finalLabels = creationMode === 'task' 
      ? (labels.trim() ? labels.split(',').map((l) => l.trim()).filter(Boolean) : ['General'])
      : ['Folder', 'Group', ...(labels.trim() ? labels.split(',').map((l) => l.trim()).filter(Boolean) : [])];
    const finalSubtasks = creationMode === 'folder' ? folderTasks : [];

    const currentUserName = currentUser?.name || currentUser?.username || 'Current User';
    const selectedFolderId = creationMode === 'task' 
      ? (targetFolderId === 'folder_general' ? undefined : targetFolderId)
      : undefined;
    const selectedEpic = creationMode === 'task' 
      ? (targetFolder || 'General') 
      : (extractTagsAndCleanText(folderName).cleanText || folderName.trim());

    const optimisticIssue: Issue = {
      id: tempId,
      key: tempKey,
      title: finalTitle,
      description: finalDescription,
      status: 'todo',
      priority: creationMode === 'task' ? priority : 'medium',
      assigneeName: creationMode === 'task' ? assigneeName : 'General (Anyone)',
      reporterName: currentUserName,
      dueDate: dueDate ? dueDate : undefined,
      estimatedHours: creationMode === 'task' ? (Number(estimatedHours) || undefined) : (creationMode === 'folder' ? folderTasks.length * 2 : 2),
      project: targetProjectName,
      projectId: defaultProjectId ? Number(defaultProjectId) : undefined,
      epic: selectedEpic,
      folderId: selectedFolderId,
      labels: finalLabels,
      tags: combinedTags,
      subtasks: finalSubtasks as any,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1. Immediately inject into UI and close modal (0ms latency)
    onCreateIssue(optimisticIssue);
    toast.success(creationMode === 'task' ? `Task ${tempKey} created in "${targetFolder || 'General'}"!` : `Folder "${finalTitle.replace(/^📁\s*/, '')}" created!`);
    onClose();

    // 2. Process in background to database
    try {
      const res = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: finalTitle,
          description: finalDescription,
          status: 'todo',
          priority: creationMode === 'task' ? priority : 'medium',
          assigneeName: creationMode === 'task' ? assigneeName : 'General (Anyone)',
          reporterName: currentUserName,
          dueDate: dueDate ? dueDate : undefined,
          estimatedHours: creationMode === 'task' ? (Number(estimatedHours) || undefined) : (creationMode === 'folder' ? folderTasks.length * 2 : 2),
          project: targetProjectName,
          projectId: defaultProjectId ? Number(defaultProjectId) : undefined,
          epic: selectedEpic,
          folderId: selectedFolderId,
          labels: finalLabels,
          tags: combinedTags,
          subtasks: finalSubtasks,
        }),
      });

      if (res.ok) {
        const createdIssue = await res.json();
        onCreateIssue(createdIssue);
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to persist item to server');
      }
    } catch {
      toast.error('Network error syncing item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const priorityColor: Record<Priority, string> = {
    critical: 'bg-[var(--ramp-3)]/20 text-white border-[var(--border-secondary)]',
    high: 'bg-[#FFFFFF]/20 text-[#FFFFFF] border-[#FFFFFF]/40',
    medium: 'bg-white/20 text-white border-[var(--border-secondary)]',
    low: 'bg-[#FFFFFF]/20 text-white border-[#FFFFFF]/40',
    none: 'bg-[#222222] text-[var(--text-muted)] border-[var(--border-primary)]',
  };

  const parsedLabels = labels.split(',').map((l) => l.trim()).filter(Boolean);

  return (
    <AnimatePresence>
      <div 
        role="dialog"
        aria-modal="true"
        aria-label="Create New Item"
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm select-none"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          className="w-full max-w-5xl bg-[var(--bg-panel)] border border-[var(--border-primary)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-primary)] bg-[var(--bg-panel)]">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xs font-bold text-white bg-[var(--bg-canvas)] border border-[var(--border-primary)] px-2 py-0.5 rounded">
                {projectKey}
              </span>
              <h2 className="text-sm font-bold text-white tracking-tight">
                {creationMode === 'task' ? 'Create Task' : 'Create Folder / Group'}
              </h2>
            </div>

            <button onClick={onClose} className="text-[var(--text-muted)] hover:text-white p-1 rounded-lg transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Mode Switcher Bars: 1) Task vs Folder & 2) Quick vs Advanced */}
          <div className="flex items-center justify-between px-5 py-2 bg-[var(--bg-canvas)] border-b border-[var(--border-primary)] flex-wrap gap-2">
            {/* Folder creation is intentionally exposed only from the Tree page. */}
            {allowFolderCreation && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCreationMode('task')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    creationMode === 'task'
                      ? 'bg-[#222222] text-white shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  <ListTodo size={13} />
                  <span>Task</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCreationMode('folder')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    creationMode === 'folder'
                      ? 'bg-[#222222] text-white shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  <Folder size={13} />
                  <span>Folder / Group</span>
                </button>
              </div>
            )}

            {/* Complexity Switch: Quick vs Advanced */}
            <div className="flex items-center bg-[var(--bg-card)] border border-[var(--border-primary)] p-0.5 rounded-lg">
              <button
                type="button"
                onClick={() => setFormView('quick')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-bold transition-all ${
                  formView === 'quick'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                <Zap size={11} />
                <span>Quick</span>
              </button>
              <button
                type="button"
                onClick={() => setFormView('advanced')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-bold transition-all ${
                  formView === 'advanced'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                <Sliders size={11} />
                <span>Advanced</span>
              </button>
            </div>
          </div>

          {/* Form Body - 2 Columns (Left: Form Inputs, Right: Live Real-Time Preview) */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col font-sans text-xs">
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-y-auto divide-y lg:divide-y-0 lg:divide-x divide-[var(--border-primary)]">
              
              {/* Left Column: Inputs */}
              <div className="lg:col-span-6 xl:col-span-7 p-5 space-y-4 overflow-y-auto">
                
                {/* ─── TAB 1: TASK CREATION FORM ─────────────────────────── */}
                {creationMode === 'task' ? (
                  <>
                    {/* Task Title */}
                    <div className="relative">
                      <label className="block text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider mb-1">
                        Task Title <span className="text-white">*</span>
                      </label>
                      <input
                        type="text"
                        autoFocus
                        required
                        placeholder="e.g. Implement real-time document synchronization (type @ to tag tasks)..."
                        value={title}
                        onChange={(e) => handleInputChangeWithMention(e.target.value, e.target.selectionStart ?? e.target.value.length, 'title')}
                        onKeyDown={(e) => handleInputKeyDownWithMention(e, 'title')}
                        className="w-full bg-[var(--bg-canvas)] border border-[var(--border-primary)] focus:border-[var(--border-secondary)] rounded-lg px-3 py-2 text-white outline-none text-xs sm:text-sm font-medium transition-colors"
                      />

                      {/* Mention Popover for Title */}
                      {mentionState.active && mentionState.target === 'title' && (
                        <div className="absolute left-0 right-0 top-full mt-1.5 z-50">
                          <TaskMentionPopover
                            query={mentionState.query}
                            options={mentionOptions}
                            selectedIndex={mentionState.selectedIndex}
                            onSelect={handleSelectMention}
                            onClose={() => setMentionState((prev) => ({ ...prev, active: false }))}
                          />
                        </div>
                      )}

                      {/* Duplicate Detection Warning Banner */}
                      {detectedDuplicates.length > 0 && (
                        <div className="mt-2 p-2.5 bg-[var(--ramp-3)]/10 border border-[var(--border-secondary)] rounded-lg text-xs space-y-1">
                          <span className="text-white font-bold flex items-center gap-1 text-[11px]">
                            <AlertTriangle size={12} /> Potential Duplicates Detected ({detectedDuplicates.length}):
                          </span>
                          {detectedDuplicates.map((dup) => (
                            <div key={dup.id} className="text-[var(--text-secondary)] text-[11px] font-mono truncate pl-1">
                              &bull; <strong className="text-white">{dup.key}</strong>: {dup.title}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Description & Markdown */}
                    <div className="relative">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider">
                          Description (Markdown Supported)
                        </label>
                        <span className="text-[10px] text-[var(--text-muted)] font-mono">Real-time preview on right &rarr;</span>
                      </div>
                      <textarea
                        rows={formView === 'quick' ? 6 : 4}
                        placeholder="Write detailed task specifications, markdown notes, code snippets, or acceptance criteria (use @T1, @T2 to tag other tasks)..."
                        value={description}
                        onChange={(e) => handleInputChangeWithMention(e.target.value, e.target.selectionStart ?? e.target.value.length, 'desc')}
                        onKeyDown={(e) => handleInputKeyDownWithMention(e, 'desc')}
                        className="w-full bg-[var(--bg-canvas)] border border-[var(--border-primary)] focus:border-[var(--border-secondary)] rounded-lg px-3 py-2 text-white outline-none font-mono text-xs leading-relaxed resize-y transition-colors"
                      />

                      {/* Mention Popover for Description */}
                      {mentionState.active && mentionState.target === 'desc' && (
                        <div className="absolute left-0 right-0 top-full mt-1.5 z-50">
                          <TaskMentionPopover
                            query={mentionState.query}
                            options={mentionOptions}
                            selectedIndex={mentionState.selectedIndex}
                            onSelect={handleSelectMention}
                            onClose={() => setMentionState((prev) => ({ ...prev, active: false }))}
                          />
                        </div>
                      )}
                    </div>

                    {/* Property Chips Row (Basic-First: Priority, Assignee, Due Date, Folder) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-[var(--border-primary)]">
                      {/* Priority */}
                      <div>
                        <label className="block text-[10px] font-mono text-[var(--text-muted)] mb-1">
                          Priority
                        </label>
                        <CustomDropdown<Priority>
                          value={priority}
                          onChange={(val) => setPriority(val)}
                          options={[
                            { value: 'critical', label: 'Critical (P0)' },
                            { value: 'high', label: 'High (P1)' },
                            { value: 'medium', label: 'Medium (P2)' },
                            { value: 'low', label: 'Low (P3)' },
                          ]}
                          className="w-full"
                          triggerClassName="w-full bg-[var(--bg-canvas)] border border-[var(--border-primary)] rounded-md px-2 py-1 text-xs text-[var(--text-primary)] capitalize hover:border-[var(--border-secondary)]"
                          size="xs"
                        />
                      </div>

                      {/* Assignee */}
                      <div>
                        <label className="block text-[10px] font-mono text-[var(--text-muted)] mb-1">
                          Assignee
                        </label>
                        <CustomDropdown<string>
                          value={assigneeName}
                          onChange={(val) => setAssigneeName(val)}
                          options={[
                            { value: 'General (Anyone)', label: 'General' },
                            ...joinedMembers.map((m) => ({
                              value: m.name,
                              label: m.name,
                            })),
                            { value: 'karri', label: 'karri' },
                            { value: 'jori', label: 'jori' },
                          ]}
                          className="w-full"
                          triggerClassName="w-full bg-[var(--bg-canvas)] border border-[var(--border-primary)] rounded-md px-2 py-1 text-xs text-[var(--text-primary)] hover:border-[var(--border-secondary)]"
                          size="xs"
                        />
                      </div>

                      {/* Due Date */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[10px] font-mono text-[var(--text-muted)]">
                            Due Date
                          </label>
                          {dueDate && (
                            <button
                              type="button"
                              onClick={() => setDueDate('')}
                              className="text-[9px] text-[var(--text-muted)] hover:text-white"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <input
                          type="date"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          className="w-full bg-[var(--bg-canvas)] border border-[var(--border-primary)] focus:border-[var(--border-secondary)] rounded-md px-2 py-1 text-xs text-[var(--text-primary)] outline-none font-mono cursor-pointer [color-scheme:dark]"
                        />
                      </div>

                      {/* Destination Folder */}
                      <div>
                        <label className="block text-[10px] font-mono text-[var(--text-muted)] mb-1">
                          Folder
                        </label>
                        <CustomDropdown<string>
                          value={targetFolderId}
                          onChange={(selectedId) => {
                            setTargetFolderId(selectedId);
                            const found = availableFolderOptions.find((f) => f.id === selectedId);
                            setTargetFolder(found ? found.name : selectedId);
                          }}
                          options={availableFolderOptions.map((f) => ({
                            value: f.id,
                            label: `📁 ${f.name}`,
                          }))}
                          className="w-full"
                          triggerClassName="w-full bg-[var(--bg-canvas)] border border-[var(--border-primary)] rounded-md px-2 py-1 text-xs text-[var(--text-primary)] hover:border-[var(--border-secondary)]"
                          size="xs"
                        />
                      </div>
                    </div>

                    {/* More Options Disclosure */}
                    <div className="pt-2 border-t border-[var(--border-primary)]">
                      <button
                        type="button"
                        onClick={() => setFormView((prev) => (prev === 'advanced' ? 'quick' : 'advanced'))}
                        className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-white transition-colors"
                      >
                        <Sliders size={12} />
                        <span>{formView === 'advanced' ? 'Hide additional options' : 'More options (labels, tagging, estimate)...'}</span>
                      </button>

                      {formView === 'advanced' && (
                        <div className="mt-3 space-y-3.5 animate-in fade-in">
                          {/* Estimate */}
                          <div>
                            <label className="block text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider mb-1">
                              Estimate (Hours)
                            </label>
                            <input
                              type="number"
                              min="0.5"
                              step="0.5"
                              value={estimatedHours}
                              onChange={(e) => setEstimatedHours(parseFloat(e.target.value) || 0)}
                              className="w-full bg-[var(--bg-canvas)] border border-[var(--border-primary)] focus:border-[var(--border-secondary)] rounded-lg px-2.5 py-1.5 text-white outline-none font-mono text-xs"
                            />
                          </div>

                          {/* Labels */}
                          <div>
                            <label className="block text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider mb-1">
                              Labels (Comma-separated)
                            </label>
                            <input
                              type="text"
                              value={labels}
                              onChange={(e) => setLabels(e.target.value)}
                              placeholder="UI, Frontend, Security..."
                              className="w-full bg-[var(--bg-canvas)] border border-[var(--border-primary)] focus:border-[var(--border-secondary)] rounded-lg px-3 py-1.5 text-white outline-none font-mono text-xs"
                            />
                          </div>

                          {/* @ Tag Related Tasks */}
                          <div className="space-y-2 pt-1 border-t border-[var(--border-primary)]">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider">
                                <Tag size={12} className="text-white" />
                                <span>Tagged & Related Tasks (@)</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setShowTaskPicker((prev) => !prev)}
                                className="flex items-center gap-1 text-[11px] font-mono text-white hover:text-white bg-[var(--bg-canvas)] hover:bg-[#141414] border border-[var(--border-primary)] hover:border-[var(--border-secondary)] px-2 py-0.5 rounded transition-all cursor-pointer"
                              >
                                <Plus size={11} />
                                <span>Tag Task (@)</span>
                              </button>
                            </div>

                            {/* Active Tagged Task Pills */}
                            {taggedTasks.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {taggedTasks.map((tKey) => {
                                  const matchingTask = existingIssues.find(
                                    (i) => getTaskShortId(i, existingIssues).toUpperCase() === tKey.toUpperCase() || i.key.toUpperCase() === tKey.toUpperCase()
                                  );
                                  return (
                                    <span
                                      key={tKey}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--fill-quaternary)] border border-[var(--border-secondary)] text-xs font-mono text-white"
                                    >
                                      <span>@{tKey}</span>
                                      {matchingTask && (
                                        <span className="text-[var(--text-secondary)] truncate max-w-[120px] font-sans">
                                          {matchingTask.title}
                                        </span>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => setTaggedTasks((prev) => prev.filter((k) => k !== tKey))}
                                        className="hover:text-white transition-colors ml-0.5 cursor-pointer"
                                      >
                                        <X size={11} />
                                      </button>
                                    </span>
                                  );
                                })}
                              </div>
                            )}

                            {/* Task Picker Dropdown */}
                            {showTaskPicker && (
                              <div className="p-2.5 bg-[var(--bg-canvas)] border border-[var(--border-secondary)] rounded-xl space-y-2 shadow-xl animate-in fade-in">
                                <input
                                  type="text"
                                  placeholder="Search tasks to tag (e.g. T1, auth, UI)..."
                                  value={taskPickerSearch}
                                  onChange={(e) => setTaskPickerSearch(e.target.value)}
                                  className="w-full bg-[var(--bg-panel)] border border-[var(--border-primary)] focus:border-[var(--border-secondary)] rounded-lg px-2.5 py-1 text-xs text-white outline-none"
                                  autoFocus
                                />
                                <div className="max-h-36 overflow-y-auto space-y-1 custom-scrollbar">
                                  {existingIssues
                                    .filter((i) => !i.title.startsWith('📁 ') && !i.title.startsWith('[Folder]'))
                                    .filter((i) => {
                                      const shortId = getTaskShortId(i, existingIssues);
                                      const q = taskPickerSearch.toLowerCase();
                                      return (
                                        shortId.toLowerCase().includes(q) ||
                                        i.title.toLowerCase().includes(q) ||
                                        i.key.toLowerCase().includes(q)
                                      );
                                    })
                                    .map((task) => {
                                      const shortId = getTaskShortId(task, existingIssues);
                                      const isSelected = taggedTasks.includes(shortId);
                                      return (
                                        <button
                                          key={task.id}
                                          type="button"
                                          onClick={() => {
                                            if (isSelected) {
                                              setTaggedTasks((prev) => prev.filter((k) => k !== shortId));
                                            } else {
                                              setTaggedTasks((prev) => [...prev, shortId]);
                                            }
                                          }}
                                          className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs text-left transition-colors cursor-pointer ${
                                            isSelected
                                              ? 'bg-[var(--fill-quaternary)] text-white border border-[var(--border-secondary)]'
                                              : 'bg-[var(--bg-panel)] hover:bg-[#141414] text-[var(--text-secondary)] border border-[var(--border-primary)]'
                                          }`}
                                        >
                                          <div className="flex items-center gap-2 truncate">
                                            <span className="font-mono font-bold text-white bg-[var(--fill-quaternary)] px-1 py-0.2 rounded text-[10px]">
                                              {shortId}
                                            </span>
                                            <span className="truncate">{task.title}</span>
                                          </div>
                                          {isSelected && <Check size={12} className="text-white shrink-0 ml-1" />}
                                        </button>
                                      );
                                    })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  /* ─── TAB 2: FOLDER CREATION FORM ─────────────────────────── */
                  <>
                    {/* Folder Name */}
                    <div className="relative">
                      <label className="block text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider mb-1">
                        Folder / Group Name <span className="text-white">*</span>
                      </label>
                      <div className="relative flex items-center">
                        <Folder size={15} className="absolute left-3 text-white" />
                        <input
                          type="text"
                          autoFocus
                          required
                          placeholder="e.g. Authentication & Security, Database Layer (type @ to tag)..."
                          value={folderName}
                          onChange={(e) => handleInputChangeWithMention(e.target.value, e.target.selectionStart ?? e.target.value.length, 'folder')}
                          onKeyDown={(e) => handleInputKeyDownWithMention(e, 'folder')}
                          className="w-full bg-[var(--bg-canvas)] border border-[var(--border-primary)] focus:border-[var(--border-secondary)] rounded-lg pl-9 pr-3 py-2 text-white outline-none text-xs sm:text-sm font-medium transition-colors"
                        />
                      </div>

                      {/* Mention Popover for Folder Name */}
                      {mentionState.active && mentionState.target === 'folder' && (
                        <div className="absolute left-0 right-0 top-full mt-1.5 z-50">
                          <TaskMentionPopover
                            query={mentionState.query}
                            options={mentionOptions}
                            selectedIndex={mentionState.selectedIndex}
                            onSelect={handleSelectMention}
                            onClose={() => setMentionState((prev) => ({ ...prev, active: false }))}
                          />
                        </div>
                      )}
                    </div>

                    {/* Folder Description */}
                    <div>
                      <label className="block text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider mb-1">
                        Folder Scope & Documentation
                      </label>
                      <textarea
                        rows={formView === 'quick' ? 8 : 4}
                        placeholder="Describe the purpose of this folder group, related architectural components, or milestones..."
                        value={folderDescription}
                        onChange={(e) => setFolderDescription(e.target.value)}
                        className="w-full bg-[var(--bg-canvas)] border border-[var(--border-primary)] focus:border-[var(--border-secondary)] rounded-lg px-3 py-2 text-white outline-none font-mono text-xs leading-relaxed resize-y transition-colors"
                      />
                    </div>

                    {/* Advanced Folder Options (Only shown in Advanced Mode) */}
                    {formView === 'advanced' && (
                      <div className="space-y-3.5 pt-2 border-t border-[var(--border-primary)]">
                        {/* Folder Color Badge */}
                        <div>
                          <label className="block text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                            Folder Accent Color
                          </label>
                          <div className="flex items-center gap-2">
                            {['#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF'].map((col) => (
                              <button
                                key={col}
                                type="button"
                                onClick={() => setFolderColor(col)}
                                style={{ backgroundColor: col }}
                                className={`w-6 h-6 rounded-full transition-transform flex items-center justify-center ${
                                  folderColor === col ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-[#141414]' : 'opacity-70 hover:opacity-100'
                                }`}
                              >
                                {folderColor === col && <Check size={12} className=" stroke-[3]" />}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Folder Tasks Checklist Builder */}
                        <div className="space-y-2 pt-2 border-t border-[var(--border-primary)]">
                          <div className="flex items-center justify-between">
                            <label className="block text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider">
                              Initial Tasks Inside Folder ({folderTasks.length})
                            </label>
                            <span className="text-[10px] font-mono text-[var(--text-muted)]">Can add more tasks anytime</span>
                          </div>

                          {/* Folder task list */}
                          {folderTasks.length > 0 && (
                            <div className="space-y-1 max-h-36 overflow-y-auto">
                              {folderTasks.map((ft, idx) => (
                                <div
                                  key={ft.id}
                                  className="flex items-center justify-between px-2.5 py-1.5 bg-[var(--bg-canvas)] border border-[var(--border-primary)] rounded-lg text-xs"
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <span className="font-mono text-[9px] text-[var(--text-muted)]">0{idx + 1}.</span>
                                    <CheckSquare size={12} className="text-white" shrink-0 />
                                    <span className="text-[var(--text-secondary)] truncate">{ft.title}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveFolderTask(ft.id)}
                                    className="text-[var(--text-muted)] hover:text-white"
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
                              placeholder="Add task to place inside this folder..."
                              value={newFolderTaskTitle}
                              onChange={(e) => setNewFolderTaskTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddFolderTask();
                                }
                              }}
                              className="flex-1 bg-[var(--bg-canvas)] border border-[var(--border-primary)] focus:border-[var(--border-secondary)] rounded-lg px-2.5 py-1.5 text-white outline-none"
                            />
                            <button
                              type="button"
                              onClick={handleAddFolderTask}
                              className="flex items-center gap-1 px-3 py-1.5 bg-white text-black hover:bg-[#FFFFFF] rounded-lg font-bold"
                            >
                              <Plus size={13} />
                              <span>Add Task</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

              </div>

              {/* Right Column: Real-time Live Preview */}
              <div className="lg:col-span-6 xl:col-span-5 bg-[#161616] p-5 flex flex-col overflow-y-auto space-y-4">
                <div className="flex items-center justify-between pb-2.5 border-b border-[var(--border-primary)]">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <Eye size={14} className="text-white" />
                    <span>Real-time Preview</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono uppercase bg-[#222222] text-white px-2 py-0.5 rounded-full font-semibold">
                      {creationMode === 'task' ? 'Task Card' : 'Folder Node'}
                    </span>
                    <span className="text-[9px] font-mono text-[var(--text-muted)] bg-[var(--bg-canvas)] border border-[var(--border-primary)] px-1.5 py-0.5 rounded">
                      {formView.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* ─── PREVIEW: TASK CARD ─────────────────────────────────── */}
                {creationMode === 'task' ? (
                  <div className="bg-[var(--bg-panel)] border border-[var(--border-primary)] rounded-xl p-4 space-y-3.5 shadow-md">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-white bg-[var(--bg-canvas)] border border-[var(--border-primary)] px-2 py-0.5 rounded">
                        {projectKey}-PREVIEW
                      </span>
                      <div className="flex items-center gap-1.5">
                        {formView === 'advanced' && (
                          <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${priorityColor[priority] || priorityColor.medium}`}>
                            {priority}
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-canvas)] border border-[var(--border-primary)] px-2 py-0.5 rounded">
                          TODO
                        </span>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-white leading-snug break-words">
                        {title.trim() || <span className="text-[var(--text-muted)] italic">Untitled Task</span>}
                      </h3>
                    </div>

                    {/* Metadata Chips (in Advanced view) */}
                    {formView === 'advanced' && (
                      <div className="flex flex-wrap gap-2 text-[11px] text-[var(--text-secondary)]">
                        <div className="flex items-center gap-1 bg-[var(--bg-canvas)] border border-[var(--border-primary)] px-2 py-0.5 rounded">
                          <UserIcon size={11} className="text-white" />
                          <span>{assigneeName}</span>
                        </div>
                        {estimatedHours > 0 && (
                          <div className="flex items-center gap-1 bg-[var(--bg-canvas)] border border-[var(--border-primary)] px-2 py-0.5 rounded font-mono">
                            <Clock size={11} className="text-white" />
                            <span>{estimatedHours}h</span>
                          </div>
                        )}
                        {dueDate && (
                          <div className="flex items-center gap-1 bg-[var(--bg-canvas)] border border-[var(--border-primary)] px-2 py-0.5 rounded font-mono">
                            <Calendar size={11} className="text-white" />
                            <span>{dueDate}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Labels Preview */}
                    {formView === 'advanced' && parsedLabels.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {parsedLabels.map((tag, idx) => (
                          <span
                            key={idx}
                            className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-[#141414] border border-[#343434] text-[var(--text-secondary)]"
                          >
                            <Tag size={9} className="text-white" />
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Live Description Render */}
                    <div className="pt-2 border-t border-[var(--border-primary)] space-y-1.5">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] block">
                        Description Preview
                      </span>
                      <div className="p-3 bg-[var(--bg-canvas)] border border-[var(--border-primary)] rounded-xl text-xs text-[var(--text-secondary)] leading-relaxed max-h-60 overflow-y-auto">
                        {description.trim() ? (
                          <MarkdownRenderer content={description} />
                        ) : (
                          <p className="text-[var(--text-muted)] italic text-xs">
                            Task description and markdown formatting will render here in real-time as you type...
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ─── PREVIEW: FOLDER NODE CARD ──────────────────────────── */
                  <div className="bg-[var(--bg-panel)] border border-[var(--border-primary)] rounded-xl p-4 space-y-3.5 shadow-md">
                    {/* Folder Header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div 
                          style={{ backgroundColor: `${folderColor}20`, borderColor: `${folderColor}60` }}
                          className="w-7 h-7 rounded-lg border flex items-center justify-center text-white"
                        >
                          <Folder size={15} style={{ color: folderColor }} />
                        </div>
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-primary)] text-white">
                          FOLDER GROUP
                        </span>
                      </div>
                      {formView === 'advanced' && (
                        <span className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-canvas)] border border-[var(--border-primary)] px-2 py-0.5 rounded">
                          {folderTasks.length} Tasks
                        </span>
                      )}
                    </div>

                    {/* Folder Name */}
                    <div>
                      <h3 className="text-base font-bold text-white leading-snug break-words">
                        {folderName.trim() || <span className="text-[var(--text-muted)] italic">Untitled Folder</span>}
                      </h3>
                    </div>

                    {/* Folder Description Preview */}
                    <div className="pt-2 border-t border-[var(--border-primary)] space-y-1.5">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] block">
                        Folder Scope
                      </span>
                      <div className="p-3 bg-[var(--bg-canvas)] border border-[var(--border-primary)] rounded-xl text-xs text-[var(--text-secondary)] leading-relaxed max-h-40 overflow-y-auto">
                        {folderDescription.trim() ? (
                          <MarkdownRenderer content={folderDescription} />
                        ) : (
                          <p className="text-[var(--text-muted)] italic text-xs">
                            Folder documentation and group overview will appear here...
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Tasks inside this folder preview (Advanced mode) */}
                    {formView === 'advanced' && (
                      <div className="pt-2 border-t border-[var(--border-primary)] space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider">
                          <span className="flex items-center gap-1">
                            <FolderPlus size={11} style={{ color: folderColor }} />
                            Folder Tasks ({folderTasks.length})
                          </span>
                        </div>
                        {folderTasks.length > 0 ? (
                          <div className="space-y-1 max-h-36 overflow-y-auto">
                            {folderTasks.map((ft, idx) => (
                              <div
                                key={ft.id}
                                className="flex items-center gap-2 px-2.5 py-1.5 bg-[var(--bg-canvas)] border border-[var(--border-primary)] rounded-lg text-[11px] text-[var(--text-secondary)]"
                              >
                                <span className="font-mono text-[9px] text-[var(--text-muted)]">0{idx + 1}</span>
                                <div className="w-3 h-3 rounded border border-[var(--border-primary)] bg-[var(--bg-panel)]" />
                                <span className="truncate">{ft.title}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-[var(--text-muted)] italic p-2 bg-[var(--bg-canvas)] border border-[var(--border-primary)] rounded-lg">
                            No initial tasks specified. You can drag and drop tasks into this folder anytime!
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

              </div>

            </div>

            {/* Bottom Modal Actions Bar */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border-primary)] bg-[var(--bg-panel)]">
              <span className="text-[11px] text-[var(--text-muted)]">
                Press <kbd className="px-1.5 py-0.5 bg-[var(--bg-canvas)] border border-[var(--border-primary)] rounded font-mono text-[10px] text-white">Esc</kbd> to exit
              </span>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 bg-[var(--bg-panel)] hover:bg-[#242424] text-[var(--text-muted)] hover:text-white rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-1.5 bg-white text-black hover:bg-[#E5E5E5] active:bg-[#D4D4D4] rounded-lg font-bold transition-all shadow-md disabled:opacity-50 flex items-center gap-1.5"
                >
                  {creationMode === 'task' ? (
                    <>
                      <ListTodo size={14} />
                      <span>{isSubmitting ? 'Creating Task...' : 'Create Task'}</span>
                    </>
                  ) : (
                    <>
                      <Folder size={14} />
                      <span>{isSubmitting ? 'Creating Folder...' : 'Create Folder'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
