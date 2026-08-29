'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ProjectDoc } from '@/lib/types';
import { 
  FileText, 
  Plus, 
  Save, 
  Eye, 
  Edit3, 
  Columns, 
  Trash2, 
  Check, 
  Copy, 
  Search, 
  BookOpen, 
  FileCode,
  Heading1,
  Heading2,
  Heading3,
  Bold,
  Italic,
  Strikethrough,
  Code,
  FileCode2,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Link as LinkIcon,
  Table as TableIcon,
  Minus,
  Cloud,
  Undo2,
  Redo2,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Folder,
  FolderOpen,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  GripVertical
} from 'lucide-react';

import { toast } from 'sonner';
import { RandomLoadingText } from './ui/RandomLoadingText';
import { getLocalCache, setLocalCache, reconcileDocs } from '@/lib/client-cache';
import { useRealtimeSubscription, RealtimeEvent } from '@/lib/useRealtime';
import { RealtimeBadge } from '@/components/RealtimeBadge';
import { renderGithubMarkdown, parseInlineMarkdown, ActiveHighlightInfo, ActiveCursorInfo } from '@/components/ui/MarkdownRenderer';

interface ProjectDocsViewProps {
  projectId: string | number;
  projectName?: string;
  projectKey?: string;
}

const DEFAULT_FOLDER = 'Start';

export const ProjectDocsView: React.FC<ProjectDocsViewProps> = ({
  projectId,
  projectName = 'Project Workspace',
  projectKey = 'PRJ',
}) => {
  const [docs, setDocs] = useState<ProjectDoc[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [activeContent, setActiveContent] = useState<string>('');
  const [savedContent, setSavedContent] = useState<string>('');
  const [activeTitle, setActiveTitle] = useState<string>('');
  const [savedTitle, setSavedTitle] = useState<string>('');
  const [viewMode, setViewMode] = useState<'editor' | 'split' | 'preview'>('split');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [isJustSaved, setIsJustSaved] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [copiedFile, setCopiedFile] = useState(false);
  const [activeHighlight, setActiveHighlight] = useState<ActiveHighlightInfo | null>(null);
  const highlightTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Folder management state
  const [customFolders, setCustomFolders] = useState<string[]>(() => {
    return getLocalCache<string[]>(`docs_folders_${projectId}`, []);
  });
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    [DEFAULT_FOLDER]: true,
  });
  const [activeFolderForCreation, setActiveFolderForCreation] = useState<string>(DEFAULT_FOLDER);
  const [draggingDocId, setDraggingDocId] = useState<string | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);

  // Inline rename in sidebar state
  const [renamingDocId, setRenamingDocId] = useState<string | null>(null);
  const [inlineRenameTitle, setInlineRenameTitle] = useState('');

  // Refs for scrolling and autosave
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(0);
  const activeContentRef = useRef<string>(activeContent);
  const activeTitleRef = useRef<string>(activeTitle);
  const savedContentRef = useRef<string>(savedContent);
  const selectedDocIdCurrentRef = useRef<string | null>(selectedDocId);

  useEffect(() => {
    activeContentRef.current = activeContent;
  }, [activeContent]);

  useEffect(() => {
    activeTitleRef.current = activeTitle;
  }, [activeTitle]);

  useEffect(() => {
    savedContentRef.current = savedContent;
  }, [savedContent]);

  useEffect(() => {
    selectedDocIdCurrentRef.current = selectedDocId;
  }, [selectedDocId]);

  // Persist custom folders
  useEffect(() => {
    setLocalCache(`docs_folders_${projectId}`, customFolders);
  }, [customFolders, projectId]);

  // Hydrate from client cache safely on mount
  useEffect(() => {
    const cachedDocs = getLocalCache<ProjectDoc[]>(`docs_${projectId}`, []);
    if (cachedDocs && cachedDocs.length > 0) {
      setDocs(cachedDocs);
      const targetDoc = cachedDocs[0];
      if (targetDoc) {
        setSelectedDocId(String(targetDoc.id));
        const cleanTitle = (targetDoc.title || '').replace(/\.md$/i, '');
        setActiveTitle(cleanTitle);
        setSavedTitle(cleanTitle);
        const cachedContent = getLocalCache(`doc_content_${targetDoc.id}`, targetDoc.content || '');
        if (cachedContent) {
          setActiveContent(cachedContent);
          setSavedContent(cachedContent);
        }
      }
      setLoading(false);
    }
  }, [projectId]);

  // Sync docs list to cache
  useEffect(() => {
    if (docs.length > 0) {
      setLocalCache(`docs_${projectId}`, docs);
    }
  }, [docs, projectId]);

  // ─── Smooth Scrolling to Changed Spot Only ─────────────────────────────────
  const calculateChangedLineFromText = useCallback(
    (oldText: string, newText: string, cursorIndex?: number): number => {
      if (cursorIndex !== undefined && cursorIndex >= 0) {
        const textBefore = newText.slice(0, cursorIndex);
        return Math.max(0, textBefore.split('\n').length - 1);
      }

      const oldLines = oldText.split('\n');
      const newLines = newText.split('\n');
      const max = Math.max(oldLines.length, newLines.length);

      for (let i = 0; i < max; i++) {
        if (oldLines[i] !== newLines[i]) {
          return i;
        }
      }
      return 0;
    },
    []
  );

  const scrollToChangeLocation = useCallback((lineIndex: number, totalLinesCount: number) => {
    const preview = previewContainerRef.current;
    if (!preview) return;

    const totalLines = Math.max(1, totalLinesCount);
    const ratio = Math.max(0, Math.min(1, lineIndex / totalLines));
    const maxScroll = preview.scrollHeight - preview.clientHeight;

    if (maxScroll <= 0) return;

    const targetScrollTop = ratio * maxScroll;
    preview.scrollTo({
      top: targetScrollTop,
      behavior: 'smooth',
    });
  }, []);

  const triggerActiveHighlight = useCallback((lineIndex: number, word: string) => {
    if (!word || !word.trim()) return;
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }
    setActiveHighlight({
      lineIndex,
      word: word.trim(),
      timestamp: Date.now(),
    });
    highlightTimerRef.current = setTimeout(() => {
      setActiveHighlight(null);
    }, 2200);
  }, []);

  const [cursorPos, setCursorPos] = useState<ActiveCursorInfo>({
    lineIndex: 0,
    col: 1,
    offset: 0,
  });

  const updateCursorPos = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const offset = textarea.selectionStart || 0;
    const val = textarea.value || '';
    const textBefore = val.slice(0, offset);
    const lines = textBefore.split('\n');
    const lineIndex = Math.max(0, lines.length - 1);
    const col = Math.max(1, lines[lines.length - 1].length + 1);

    setCursorPos({
      lineIndex,
      col,
      offset,
    });
  }, []);

  // 1. Fetch all docs for this project
  const fetchDocsList = useCallback(async (selectNewestId?: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/docs`);
      if (res.ok) {
        const data: ProjectDoc[] = await res.json();
        if (Array.isArray(data)) {
          // Normalize folder: default to 'Start' if missing
          const normalized = data.map((d) => ({
            ...d,
            folder: d.folder && d.folder.trim() ? d.folder.trim() : DEFAULT_FOLDER,
          }));
          setDocs(normalized);
          setLocalCache(`docs_${projectId}`, normalized);

          // Discover any custom folders from docs
          const docFolders = Array.from(new Set(normalized.map((d) => d.folder || DEFAULT_FOLDER))).filter(
            (f) => f !== DEFAULT_FOLDER
          );
          if (docFolders.length > 0) {
            setCustomFolders((prev) => Array.from(new Set([...prev, ...docFolders])));
          }

          if (normalized.length > 0) {
            const curId = selectedDocIdCurrentRef.current;
            const targetDoc = (selectNewestId && normalized.find((d) => String(d.id) === String(selectNewestId))) ||
              (curId && normalized.find((d) => String(d.id) === String(curId))) ||
              normalized[0];
            if (targetDoc) {
              setSelectedDocId(String(targetDoc.id));
              const cleanTitle = (targetDoc.title || '').replace(/\.md$/i, '');
              setActiveTitle(cleanTitle);
              setSavedTitle(cleanTitle);
              if (targetDoc.content !== undefined && targetDoc.content !== '') {
                setActiveContent(targetDoc.content);
                setSavedContent(targetDoc.content);
                historyRef.current = [targetDoc.content];
                historyIndexRef.current = 0;
              }
            }
          }
        }
      }
    } catch {
      toast.error('Failed to load project documents');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchDocsList();
  }, [fetchDocsList]);

  // ─── Real-Time WebSocket Dynamic Documentation Synchronization ──────────────
  useRealtimeSubscription({
    projectId,
    onEvent: useCallback((event: RealtimeEvent) => {
      switch (event.type) {
        case 'DOC_CREATED': {
          const newDoc = event.payload;
          if (newDoc && (String(newDoc.projectId) === String(projectId) || !newDoc.projectId)) {
            const normalized = {
              ...newDoc,
              folder: newDoc.folder && newDoc.folder.trim() ? newDoc.folder.trim() : DEFAULT_FOLDER,
            };
            setDocs((prev) => {
              const exists = prev.some(
                (d) => String(d.id) === String(normalized.id) || (d.fileName && d.fileName === normalized.fileName)
              );
              if (exists) {
                return prev.map((d) =>
                  String(d.id) === String(normalized.id) || (d.fileName && d.fileName === normalized.fileName)
                    ? { ...d, ...normalized }
                    : d
                );
              }
              return [normalized, ...prev];
            });
          }
          break;
        }

        case 'DOC_UPDATED': {
          const updatedDoc = event.payload;
          if (updatedDoc && updatedDoc.id) {
            setDocs((prev) =>
              prev.map((d) =>
                String(d.id) === String(updatedDoc.id)
                  ? {
                      ...d,
                      ...updatedDoc,
                      folder: updatedDoc.folder || d.folder || DEFAULT_FOLDER,
                    }
                  : d
              )
            );

            // If the updated doc is currently open
            if (String(selectedDocIdCurrentRef.current) === String(updatedDoc.id)) {
              const cleanTitle = updatedDoc.title ? updatedDoc.title.replace(/\.md$/i, '') : '';
              setSavedTitle(cleanTitle);
              if (updatedDoc.content !== undefined) {
                const oldContent = activeContentRef.current || savedContentRef.current || '';
                const newContent = updatedDoc.content;

                setSavedContent(newContent);
                setActiveContent((prev) => {
                  if (!prev || prev === savedContentRef.current) {
                    return newContent;
                  }
                  return prev;
                });

                // Smoothly scroll preview for viewing users in realtime to the changed spot & highlight words!
                if (oldContent !== newContent) {
                  const changedLine = calculateChangedLineFromText(oldContent, newContent);
                  const totalLines = newContent.split('\n').length;
                  const oldLines = oldContent.split('\n');
                  const newLines = newContent.split('\n');
                  const diffLine = newLines[changedLine] || '';
                  const oldLine = oldLines[changedLine] || '';
                  const newWords = diffLine.split(/\s+/);
                  const oldWords = new Set<string>(oldLine.split(/\s+/));
                  const addedWord = newWords.find((w: string) => Boolean(w && !oldWords.has(w))) || newWords[newWords.length - 1] || '';

                  if (addedWord) {
                    triggerActiveHighlight(changedLine, addedWord);
                  }

                  requestAnimationFrame(() => {
                    scrollToChangeLocation(changedLine, totalLines);
                  });
                }
              }
            }
          }
          break;
        }

        case 'DOC_DELETED': {
          const { id: deletedId } = event.payload || {};
          if (deletedId) {
            setDocs((prev) => prev.filter((d) => String(d.id) !== String(deletedId)));
            if (String(selectedDocIdCurrentRef.current) === String(deletedId)) {
              setDocs((prev) => {
                const remaining = prev.filter((d) => String(d.id) !== String(deletedId));
                if (remaining.length > 0) {
                  setSelectedDocId(String(remaining[0].id));
                  const cleanTitle = (remaining[0].title || '').replace(/\.md$/i, '');
                  setActiveTitle(cleanTitle);
                  setSavedTitle(cleanTitle);
                  setActiveContent(remaining[0].content || '');
                  setSavedContent(remaining[0].content || '');
                } else {
                  setSelectedDocId(null);
                  setActiveTitle('');
                  setActiveContent('');
                }
                return remaining;
              });
            }
          }
          break;
        }
      }
    }, [projectId]),
  });

  const selectedDoc = useMemo(() => {
    return docs.find((d) => String(d.id) === String(selectedDocId)) || null;
  }, [docs, selectedDocId]);

  const hasUnsavedChanges = useMemo(() => {
    return activeContent !== savedContent || activeTitle !== savedTitle;
  }, [activeContent, savedContent, activeTitle, savedTitle]);

  const pushToHistory = (newVal: string) => {
    const curHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    curHistory.push(newVal);
    if (curHistory.length > 50) curHistory.shift();
    historyRef.current = curHistory;
    historyIndexRef.current = curHistory.length - 1;
  };

  const handleUndo = () => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      const prevVal = historyRef.current[historyIndexRef.current];
      const oldVal = activeContent;
      setActiveContent(prevVal);
      const changedLine = calculateChangedLineFromText(oldVal, prevVal);
      const totalLines = prevVal.split('\n').length;
      requestAnimationFrame(() => {
        scrollToChangeLocation(changedLine, totalLines);
      });
    }
  };

  const handleRedo = () => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++;
      const nextVal = historyRef.current[historyIndexRef.current];
      const oldVal = activeContent;
      setActiveContent(nextVal);
      const changedLine = calculateChangedLineFromText(oldVal, nextVal);
      const totalLines = nextVal.split('\n').length;
      requestAnimationFrame(() => {
        scrollToChangeLocation(changedLine, totalLines);
      });
    }
  };

  // Perform background auto-save to server & DB without interrupting user typing
  const performAutoSave = useCallback(async () => {
    const docId = selectedDocIdCurrentRef.current;
    if (!docId) return;

    const contentToSave = activeContentRef.current;
    const cleanTitle = (activeTitleRef.current || 'Untitled Document').trim().replace(/\.md$/i, '');
    const currentDoc = docs.find((d) => String(d.id) === String(docId));
    const folder = currentDoc?.folder || DEFAULT_FOLDER;

    setIsAutoSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/docs/${docId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: cleanTitle,
          content: contentToSave,
          folder,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSavedContent(contentToSave);
        setSavedTitle(cleanTitle);
        setLocalCache(`doc_content_${docId}`, contentToSave);
        setDocs((prev) =>
          prev.map((d) =>
            String(d.id) === String(docId)
              ? {
                  ...d,
                  title: cleanTitle,
                  folder: data.folder || folder,
                  updatedAt: data.updatedAt || new Date().toISOString(),
                }
              : d
          )
        );
      }
    } catch (err) {
      console.warn('Background auto-save note:', err);
    } finally {
      setIsAutoSaving(false);
    }
  }, [projectId, docs]);

  // Explicit Manual Save with visual feedback and toast
  const performManualSave = useCallback(async () => {
    const docId = selectedDocIdCurrentRef.current;
    if (!docId) return;

    const contentToSave = activeContentRef.current;
    const cleanTitle = (activeTitleRef.current || 'Untitled Document').trim().replace(/\.md$/i, '');
    const currentDoc = docs.find((d) => String(d.id) === String(docId));
    const folder = currentDoc?.folder || DEFAULT_FOLDER;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/docs/${docId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: cleanTitle,
          content: contentToSave,
          folder,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSavedContent(contentToSave);
        setSavedTitle(cleanTitle);
        setLocalCache(`doc_content_${docId}`, contentToSave);
        setDocs((prev) =>
          prev.map((d) =>
            String(d.id) === String(docId)
              ? {
                  ...d,
                  title: cleanTitle,
                  folder: data.folder || folder,
                  updatedAt: data.updatedAt || new Date().toISOString(),
                }
              : d
          )
        );
        setIsJustSaved(true);
        toast.success(`Saved: ${cleanTitle}`);
        setTimeout(() => setIsJustSaved(false), 2000);
      } else {
        toast.error('Failed to save document');
      }
    } catch {
      toast.error('Network error saving document');
    } finally {
      setIsSaving(false);
    }
  }, [projectId, docs]);

  // Debounced auto-save triggering on any content or title change
  useEffect(() => {
    if (!selectedDocId) return;
    if (activeContent === savedContent && activeTitle === savedTitle) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      performAutoSave();
    }, 500);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [activeContent, activeTitle, savedContent, savedTitle, selectedDocId, performAutoSave]);

  // Handle Textarea Change with smooth preview scroll & letter fade highlight to changed spot
  const handleContentChange = (newVal: string, e?: React.ChangeEvent<HTMLTextAreaElement>) => {
    const oldVal = activeContent;
    setActiveContent(newVal);
    pushToHistory(newVal);

    // Calculate changed line number & cursor position
    const cursorPos = e?.target?.selectionStart ?? textareaRef.current?.selectionStart;
    const changedLine = calculateChangedLineFromText(oldVal, newVal, cursorPos);
    const totalLines = newVal.split('\n').length;

    // Extract newly typed word / letters around cursor
    const textBefore = newVal.slice(0, cursorPos ?? newVal.length);
    const match = textBefore.match(/([^\s\n]+)$/);
    const typedWord = match ? match[1] : '';

    if (typedWord) {
      triggerActiveHighlight(changedLine, typedWord);
    }

    // Smoothly scroll the preview to the exact changed spot
    requestAnimationFrame(() => {
      scrollToChangeLocation(changedLine, totalLines);
    });
  };

  // Handle Title Change in Realtime
  const handleTitleChange = (newTitle: string) => {
    setActiveTitle(newTitle);
    const clean = newTitle.trim().replace(/\.md$/i, '');
    if (selectedDocId) {
      setDocs((prev) =>
        prev.map((d) => (String(d.id) === String(selectedDocId) ? { ...d, title: clean } : d))
      );
    }
  };

  // Handle Inline Sidebar Renaming
  const handleStartRename = (doc: ProjectDoc, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingDocId(doc.id);
    setInlineRenameTitle((doc.title || '').replace(/\.md$/i, ''));
  };

  const handleFinishRename = async (docId: string) => {
    const clean = inlineRenameTitle.trim().replace(/\.md$/i, '');
    setRenamingDocId(null);
    if (!clean) return;

    // Optimistic update in UI
    setDocs((prev) =>
      prev.map((d) => (String(d.id) === String(docId) ? { ...d, title: clean } : d))
    );
    if (selectedDocId === docId) {
      setActiveTitle(clean);
      setSavedTitle(clean);
    }

    try {
      await fetch(`/api/projects/${projectId}/docs/${docId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: clean }),
      });
      toast.success(`Renamed to: ${clean}`);
    } catch {
      toast.error('Failed to rename file');
    }
  };

  // Handle Move Document to Folder (Drag and Drop in Realtime)
  const handleMoveDocToFolder = async (docId: string, targetFolder: string) => {
    const cleanFolder = targetFolder.trim() || DEFAULT_FOLDER;
    setDragOverFolder(null);
    setDraggingDocId(null);

    // Optimistic UI update immediately (0ms)
    setDocs((prev) =>
      prev.map((d) => (String(d.id) === String(docId) ? { ...d, folder: cleanFolder } : d))
    );
    setOpenFolders((prev) => ({ ...prev, [cleanFolder]: true }));

    try {
      const res = await fetch(`/api/projects/${projectId}/docs/${docId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: cleanFolder }),
      });

      if (res.ok) {
        toast.success(`Moved to ${cleanFolder}`);
      } else {
        toast.error('Failed to move file');
      }
    } catch {
      toast.error('Network error moving file');
    }
  };

  // Handle Create New Custom Folder
  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newFolderName.trim();
    if (!cleanName) return;

    if (!customFolders.includes(cleanName) && cleanName !== DEFAULT_FOLDER) {
      setCustomFolders((prev) => [...prev, cleanName]);
      setOpenFolders((prev) => ({ ...prev, [cleanName]: true }));
      toast.success(`Folder created: ${cleanName}`);
    }
    setNewFolderName('');
    setIsCreatingFolder(false);
  };

  // Handle Create New Doc File inside Active Folder
  const handleCreateDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocTitle.trim()) return;

    const cleanTitle = newDocTitle.trim().replace(/\.md$/i, '');
    const targetFolder = activeFolderForCreation || DEFAULT_FOLDER;
    setNewDocTitle('');
    setIsCreatingNew(false);

    try {
      const res = await fetch(`/api/projects/${projectId}/docs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: cleanTitle,
          folder: targetFolder,
          content: `# ${cleanTitle}\n\nTechnical specification and architecture documentation for ${projectName}.\n\n## 1. Overview\n\n## 2. Architecture & Components\n- Core API routing and validation\n- State synchronization\n\n## 3. Implementation Steps\n- [ ] Initialize database migration\n- [ ] Build UI components\n- [ ] Execute automated tests\n\n\`\`\`ts\n// Example implementation\nexport const config = {\n  version: '2.0.0',\n  env: 'production'\n};\n\`\`\`\n`,
        }),
      });

      if (res.ok) {
        const created: ProjectDoc = await res.json();
        const docTitle = created.title ? created.title.replace(/\.md$/i, '') : cleanTitle;
        const docContent = created.content || '';
        const docWithFolder = { ...created, folder: targetFolder };

        setDocs((prev) => {
          if (prev.some((d) => String(d.id) === String(created.id) || (d.fileName && d.fileName === created.fileName))) {
            return prev.map((d) => (String(d.id) === String(created.id) ? docWithFolder : d));
          }
          return [docWithFolder, ...prev];
        });

        setOpenFolders((prev) => ({ ...prev, [targetFolder]: true }));
        setSelectedDocId(String(created.id));
        setActiveTitle(docTitle);
        setSavedTitle(docTitle);
        setActiveContent(docContent);
        setSavedContent(docContent);
        setLocalCache(`doc_content_${created.id}`, docContent);
        historyRef.current = [docContent];
        historyIndexRef.current = 0;
        setViewMode('split');
        toast.success(`Created in ${targetFolder}: ${docTitle}`);
      } else {
        toast.error('Failed to create doc file');
      }
    } catch {
      toast.error('Network error creating doc file');
    }
  };

  // Global Keyboard Shortcuts (Ctrl+S for save, Ctrl+Z for undo, Ctrl+Y for redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        performManualSave();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && e.shiftKey) ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y')
      ) {
        e.preventDefault();
        handleRedo();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [performManualSave, handleUndo, handleRedo]);

  // Handle Delete Doc
  const handleDeleteDoc = async (docId: string, docFileName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const cleanDocName = (docFileName || 'Document').replace(/\.md$/i, '');
    if (!confirm(`Are you sure you want to delete "${cleanDocName}" from the server?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/projects/${projectId}/docs/${docId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setDocs((prev) => prev.filter((d) => String(d.id) !== String(docId)));
        toast.success(`Deleted: ${cleanDocName}`);
        if (selectedDocId === docId) {
          const remaining = docs.filter((d) => String(d.id) !== String(docId));
          if (remaining.length > 0) {
            setSelectedDocId(String(remaining[0].id));
            const cleanTitle = (remaining[0].title || '').replace(/\.md$/i, '');
            setActiveTitle(cleanTitle);
            setSavedTitle(cleanTitle);
            setActiveContent(remaining[0].content || '');
            setSavedContent(remaining[0].content || '');
          } else {
            setSelectedDocId(null);
            setActiveTitle('');
            setActiveContent('');
          }
        }
      }
    } catch {
      toast.error('Failed to delete document');
    }
  };

  // Group docs by folder: "Start" (default) is always first
  const groupedFolders = useMemo(() => {
    const allFolderNames = Array.from(new Set([DEFAULT_FOLDER, ...customFolders]));
    const groups: { folder: string; items: ProjectDoc[] }[] = [];

    allFolderNames.forEach((folderName) => {
      const items = docs.filter((d) => {
        const docFolder = d.folder && d.folder.trim() ? d.folder.trim() : DEFAULT_FOLDER;
        if (docFolder !== folderName) return false;
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          (d.title && d.title.toLowerCase().includes(q)) ||
          (d.fileName && d.fileName.toLowerCase().includes(q))
        );
      });
      groups.push({ folder: folderName, items });
    });

    return groups;
  }, [docs, customFolders, searchQuery]);

  return (
    <div className="flex-1 h-full min-h-0 flex flex-col bg-[#0A0B0D] text-[#CFD4DD] font-sans selection:bg-[#DCB001]/30 selection:text-[#DCB001] overflow-hidden">
      {/* ─── Main Two-Column Layout ────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* ─── Left Sidebar: Folders & Markdown Files (Drag and Drop) ─────── */}
        <aside className="w-72 sm:w-80 shrink-0 border-r border-[#222428] bg-[#0F1012] flex flex-col h-full select-none z-10">
          {/* Header & Actions */}
          <div className="p-3.5 border-b border-[#222428] space-y-2.5 bg-[#121316]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen size={15} className="text-[#DCB001]" />
                <span className="font-bold text-xs text-white uppercase tracking-wider font-mono">
                  Documentation Tree
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsCreatingFolder(true)}
                  className="p-1.5 rounded-lg bg-[#181A1E] hover:bg-[#22252B] text-[#CFD4DD] hover:text-[#DCB001] border border-[#2A2C30] transition-colors"
                  title="Create New Folder"
                >
                  <FolderPlus size={13} />
                </button>
                <button
                  onClick={() => {
                    setActiveFolderForCreation(DEFAULT_FOLDER);
                    setIsCreatingNew(true);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#DCB001] hover:bg-[#E5B800] text-[#0A0B0D] font-bold text-xs transition-transform hover:scale-105 shadow-sm"
                  title="Create New Document in Start folder"
                >
                  <Plus size={13} />
                  <span>New Doc</span>
                </button>
              </div>
            </div>

            {/* Quick Search */}
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#787C83]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter documents..."
                className="w-full pl-8 pr-3 py-1.5 bg-[#17181C] border border-[#26282D] focus:border-[#DCB001]/60 rounded-lg text-xs text-white placeholder-[#787C83] outline-none"
              />
            </div>
          </div>

          {/* Inline Folder Creation Form */}
          {isCreatingFolder && (
            <form onSubmit={handleCreateFolder} className="p-3 bg-[#15171A] border-b border-[#2A2C30] space-y-2">
              <div className="flex items-center gap-2 text-xs font-mono text-[#DCB001]">
                <FolderPlus size={13} />
                <span>New Folder Name:</span>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g. Architecture, API Guides..."
                  autoFocus
                  className="flex-1 px-2.5 py-1.5 bg-[#0E1012] border border-[#2A2C30] focus:border-[#DCB001] rounded-lg text-xs text-white outline-none font-mono"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1.5 bg-[#DCB001] text-[#0A0B0D] font-bold rounded-lg text-xs hover:bg-[#E5B800]"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreatingFolder(false)}
                  className="px-2 py-1.5 bg-[#1F2126] text-[#8E939D] hover:text-white rounded-lg text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Inline New Doc Creation Form */}
          {isCreatingNew && (
            <form onSubmit={handleCreateDoc} className="p-3 bg-[#15171A] border-b border-[#2A2C30] space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-[#DCB001]">
                <div className="flex items-center gap-1.5">
                  <FileCode size={13} />
                  <span>Create in [{activeFolderForCreation}]:</span>
                </div>
                <select
                  value={activeFolderForCreation}
                  onChange={(e) => setActiveFolderForCreation(e.target.value)}
                  className="bg-[#0E1012] border border-[#2A2C30] text-[10px] text-[#CFD4DD] rounded px-1.5 py-0.5 outline-none"
                >
                  <option value={DEFAULT_FOLDER}>Start (Default)</option>
                  {customFolders.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  placeholder="Document title or filename..."
                  autoFocus
                  className="flex-1 px-2.5 py-1.5 bg-[#0E1012] border border-[#2A2C30] focus:border-[#DCB001] rounded-lg text-xs text-white outline-none font-mono"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1.5 bg-[#DCB001] text-[#0A0B0D] font-bold rounded-lg text-xs hover:bg-[#E5B800]"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="px-2 py-1.5 bg-[#1F2126] text-[#8E939D] hover:text-white rounded-lg text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Folders & Documents Tree with Real-time Drag & Drop */}
          <div className="flex-1 overflow-y-auto p-2 space-y-3 custom-scrollbar">
            {groupedFolders.map(({ folder, items }) => {
              const isOpen = openFolders[folder] !== false;
              const isDragOver = dragOverFolder === folder;

              return (
                <div
                  key={folder}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverFolder !== folder) setDragOverFolder(folder);
                  }}
                  onDragLeave={() => {
                    if (dragOverFolder === folder) setDragOverFolder(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const docId = e.dataTransfer.getData('text/plain') || draggingDocId;
                    if (docId) {
                      handleMoveDocToFolder(docId, folder);
                    }
                  }}
                  className={`rounded-xl border transition-all ${
                    isDragOver
                      ? 'border-[#DCB001] bg-[#DCB001]/10 shadow-[0_0_12px_rgba(220,176,1,0.2)]'
                      : 'border-[#222428] bg-[#121316]/50'
                  }`}
                >
                  {/* Folder Header */}
                  <div
                    onClick={() => setOpenFolders((prev) => ({ ...prev, [folder]: !isOpen }))}
                    className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-[#1A1C20] rounded-t-xl transition-colors group"
                  >
                    <div className="flex items-center gap-2 font-mono text-xs font-bold text-white">
                      {isOpen ? (
                        <ChevronDown size={13} className="text-[#DCB001]" />
                      ) : (
                        <ChevronRight size={13} className="text-[#787C83]" />
                      )}
                      {isOpen ? (
                        <FolderOpen size={14} className="text-[#DCB001]" />
                      ) : (
                        <Folder size={14} className="text-[#787C83]" />
                      )}
                      <span className="truncate">{folder}</span>
                      {folder === DEFAULT_FOLDER && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#1F2126] text-[#DCB001] border border-[#2E3138]">
                          Default
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-[#787C83] px-1.5 py-0.5 rounded bg-[#16181C]">
                        {items.length}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveFolderForCreation(folder);
                          setIsCreatingNew(true);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-[#DCB001] rounded transition-opacity"
                        title={`Add doc inside ${folder}`}
                      >
                        <Plus size={11} />
                      </button>
                    </div>
                  </div>

                  {/* Folder Items (Collapsible) */}
                  {isOpen && (
                    <div className="p-1 space-y-1">
                      {items.length === 0 ? (
                        <div
                          className={`p-3 text-center border border-dashed rounded-lg text-[11px] font-mono transition-all ${
                            isDragOver ? 'border-[#DCB001] text-[#DCB001] bg-[#DCB001]/5' : 'border-[#2A2C30] text-[#787C83]'
                          }`}
                        >
                          {isDragOver ? 'Drop file here to move' : 'Empty folder — drag .md files here'}
                        </div>
                      ) : (
                        items.map((doc) => {
                          const isSelected = selectedDocId === String(doc.id);
                          const isRenaming = renamingDocId === doc.id;
                          const cleanTitle = (doc.title || doc.fileName || 'Untitled').replace(/\.md$/i, '');

                          return (
                            <div
                              key={doc.id}
                              draggable={!isRenaming}
                              onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', doc.id);
                                setDraggingDocId(doc.id);
                              }}
                              onDragEnd={() => {
                                setDraggingDocId(null);
                                setDragOverFolder(null);
                              }}
                              onClick={() => {
                                if (isSelected) return;
                                setSelectedDocId(String(doc.id));
                                setActiveTitle(cleanTitle);
                                setSavedTitle(cleanTitle);
                                if (doc.content !== undefined) {
                                  setActiveContent(doc.content);
                                  setSavedContent(doc.content);
                                  historyRef.current = [doc.content];
                                  historyIndexRef.current = 0;
                                }
                              }}
                              className={`group relative flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer transition-all border ${
                                isSelected
                                  ? 'bg-[#1F2126] border-[#DCB001]/50 text-white shadow-sm'
                                  : 'hover:bg-[#16181D] border-transparent text-[#CFD4DD]'
                              } ${draggingDocId === doc.id ? 'opacity-40 border-dashed border-[#DCB001]' : ''}`}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <GripVertical
                                  size={11}
                                  className="text-[#787C83] opacity-40 group-hover:opacity-100 cursor-grab shrink-0"
                                />
                                <FileText
                                  size={13}
                                  className={isSelected ? 'text-[#DCB001] shrink-0' : 'text-[#787C83] shrink-0'}
                                />

                                {isRenaming ? (
                                  <input
                                    type="text"
                                    value={inlineRenameTitle}
                                    onChange={(e) => setInlineRenameTitle(e.target.value)}
                                    onBlur={() => handleFinishRename(doc.id)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleFinishRename(doc.id);
                                      if (e.key === 'Escape') setRenamingDocId(null);
                                    }}
                                    autoFocus
                                    className="px-1.5 py-0.5 bg-[#0D0E11] border border-[#DCB001] rounded text-xs text-white outline-none w-full font-mono"
                                  />
                                ) : (
                                  <div
                                    onDoubleClick={(e) => handleStartRename(doc, e)}
                                    className="truncate text-xs font-medium flex-1"
                                    title="Double-click to rename"
                                  >
                                    <span>{cleanTitle}</span>
                                    <span className="text-[10px] text-[#787C83] font-mono ml-1 opacity-60">.md</span>
                                  </div>
                                )}
                              </div>

                              {/* Hover Action Buttons */}
                              {!isRenaming && (
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={(e) => handleStartRename(doc, e)}
                                    className="p-1 hover:text-[#DCB001] text-[#787C83] transition-colors"
                                    title="Rename File"
                                  >
                                    <Edit3 size={11} />
                                  </button>
                                  <button
                                    onClick={(e) => handleDeleteDoc(doc.id, doc.fileName, e)}
                                    className="p-1 hover:text-[#EF4444] text-[#787C83] transition-colors"
                                    title="Delete File"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* ─── Right Area: Document Editor & Live Preview ─────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col h-full bg-[#0A0B0D] relative">
          {selectedDoc ? (
            <>
              {/* Document Header & Mode Controls */}
              <div className="h-14 px-6 border-b border-[#222428] bg-[#0E1012] flex items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-lg bg-[#16181D] border border-[#2A2C30] flex items-center justify-center text-[#DCB001] shrink-0">
                    <FileCode2 size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <input
                      type="text"
                      value={activeTitle}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      placeholder="Untitled Document..."
                      className="w-full bg-transparent border-b border-transparent hover:border-[#2A2C30] focus:border-[#DCB001] text-sm sm:text-base font-bold text-white outline-none font-prompt transition-colors truncate"
                      title="Click to rename document title"
                    />
                    <div className="flex items-center gap-2 text-[10px] font-mono text-[#787C83]">
                      <span>Folder: <strong className="text-[#DCB001]">{selectedDoc.folder || DEFAULT_FOLDER}</strong></span>
                      <span>•</span>
                      <span>File: {selectedDoc.fileName}</span>
                    </div>
                  </div>
                </div>

                {/* Top Action Buttons */}
                <div className="flex items-center gap-2.5">
                  {/* Autosave Status Indicator */}
                  <div className="hidden sm:flex items-center select-none font-mono text-xs">
                    {isAutoSaving ? (
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-[#131415] border border-[#DCB001]/30 rounded-lg text-[11px] text-[#DCB001]">
                        <Loader2 size={11} className="animate-spin text-[#DCB001]" />
                        <span>Saving...</span>
                      </div>
                    ) : hasUnsavedChanges ? (
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-[#131415] border border-[#2A2C30] rounded-lg text-[11px] text-[#787C83]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#DCB001] animate-pulse" />
                        <span>Unsaved</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-[#131415] border border-[#22C55E]/20 rounded-lg text-[11px] text-[#22C55E]">
                        <CheckCircle2 size={11} className="text-[#22C55E]" />
                        <span>Synced</span>
                      </div>
                    )}
                  </div>

                  <div className="hidden md:flex">
                    <RealtimeBadge />
                  </div>

                  {/* Realtime Live Cursor Position Indicator */}
                  <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-[#141518] border border-[#2A2C30] rounded-lg text-[11px] font-mono text-[#CFD4DD]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#DCB001] animate-pulse shadow-[0_0_6px_#DCB001]" />
                    <span className="text-white font-bold">Ln {cursorPos.lineIndex + 1}</span>
                    <span className="text-[#787C83]">:</span>
                    <span className="text-white font-bold">Col {cursorPos.col || 1}</span>
                    <span className="text-[#787C83] ml-1">({cursorPos.offset || 0} ch)</span>
                  </div>

                  {/* Manual Save Button */}
                  <button
                    onClick={() => performManualSave()}
                    disabled={isSaving || isAutoSaving || !hasUnsavedChanges}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#DCB001] hover:bg-[#E5B800] disabled:bg-[#1B1C1F] text-[#0A0B0D] disabled:text-[#787C83] font-bold text-xs transition-all shadow-sm cursor-pointer disabled:cursor-default"
                    title="Manual Save (Ctrl + S)"
                  >
                    <Save size={13} />
                    <span>{isSaving ? 'Saving...' : isJustSaved ? 'Saved' : 'Save'}</span>
                  </button>

                  {/* View Mode Toggle */}
                  <div className="flex items-center bg-[#131415] border border-[#2A2C30] rounded-lg p-0.5 text-xs">
                    <button
                      onClick={() => setViewMode('editor')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-all ${
                        viewMode === 'editor' ? 'bg-[#2A2C30] text-[#DCB001] shadow-sm' : 'text-[#787C83] hover:text-white'
                      }`}
                      title="Editor only"
                    >
                      <Edit3 size={12} />
                      <span className="hidden sm:inline">Editor</span>
                    </button>
                    <button
                      onClick={() => setViewMode('split')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-all ${
                        viewMode === 'split' ? 'bg-[#2A2C30] text-[#DCB001] shadow-sm' : 'text-[#787C83] hover:text-white'
                      }`}
                      title="Split view (Live synchronized preview)"
                    >
                      <Columns size={12} />
                      <span className="hidden sm:inline">Split</span>
                    </button>
                    <button
                      onClick={() => setViewMode('preview')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-all ${
                        viewMode === 'preview' ? 'bg-[#2A2C30] text-[#DCB001] shadow-sm' : 'text-[#787C83] hover:text-white'
                      }`}
                      title="Preview only"
                    >
                      <Eye size={12} />
                      <span className="hidden sm:inline">Preview</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Workspace Content: Editor + Synchronized Live Preview */}
              <div className="flex-1 min-h-0 flex overflow-hidden">
                {/* Editor Column */}
                {(viewMode === 'editor' || viewMode === 'split') && (
                  <div className={`flex-1 h-full min-h-0 flex flex-col p-4 pb-14 ${viewMode === 'split' ? 'border-r border-[#222428]' : ''}`}>
                    <textarea
                      ref={textareaRef}
                      value={activeContent}
                      onChange={(e) => {
                        handleContentChange(e.target.value, e);
                        updateCursorPos();
                      }}
                      onSelect={updateCursorPos}
                      onClick={updateCursorPos}
                      onKeyUp={updateCursorPos}
                      onFocus={updateCursorPos}
                      placeholder="Write markdown documentation and GitHub HTML tags here..."
                      className="w-full h-full flex-1 p-4 bg-[#111215] border border-[#222428] focus:border-[#DCB001]/60 rounded-xl font-mono text-xs sm:text-sm text-white leading-relaxed outline-none resize-none custom-scrollbar"
                    />
                  </div>
                )}

                {/* Synchronized Live Preview Column */}
                {(viewMode === 'preview' || viewMode === 'split') && (
                  <div
                    ref={previewContainerRef}
                    className="flex-1 h-full min-h-0 overflow-y-auto p-6 pb-20 bg-[#0E0F11] custom-scrollbar scroll-smooth"
                  >
                    <div className="max-w-4xl mx-auto space-y-2 text-[#CFD4DD] font-sans">
                      {viewMode === 'split' && (
                        <div className="flex items-center justify-between pb-2 text-[11px] font-mono text-[#787C83] border-b border-[#222428] mb-4">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse shadow-[0_0_8px_#22C55E]" />
                            <span className="text-[#CFD4DD] font-bold">SYNCHRONIZED PREVIEW</span>
                          </div>
                          <span>Ln {cursorPos.lineIndex + 1}:{cursorPos.col || 1}</span>
                        </div>
                      )}

                      <div className="p-6 sm:p-8 bg-[#141518] border border-[#222428] rounded-2xl shadow-xl">
                        {activeContent || savedContent ? (
                          renderGithubMarkdown(activeContent || savedContent, activeHighlight, cursorPos)
                        ) : (
                          <p className="text-xs text-[#787C83] italic">Start typing in the editor to see real-time preview...</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#141518] border border-[#2A2C30] flex items-center justify-center text-[#DCB001]">
                <FileText size={22} />
              </div>
              <h3 className="text-base font-bold text-white">No Document Selected</h3>
              <p className="text-xs text-[#8E939D] max-w-sm">
                Select a document from the folder tree on the left, or create a new specification file inside the <strong>Start</strong> folder.
              </p>
              <button
                onClick={() => {
                  setActiveFolderForCreation(DEFAULT_FOLDER);
                  setIsCreatingNew(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#DCB001] text-[#0A0B0D] font-bold text-xs hover:bg-[#E5B800] transition-transform hover:scale-105"
              >
                <Plus size={14} />
                <span>Create in Start Folder</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectDocsView;
