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
  Loader2
} from 'lucide-react';

import { toast } from 'sonner';
import { RandomLoadingText } from './ui/RandomLoadingText';
import { getLocalCache, setLocalCache, reconcileDocs } from '@/lib/client-cache';
import { useRealtimeSubscription, RealtimeEvent } from '@/lib/useRealtime';
import { RealtimeBadge } from '@/components/RealtimeBadge';




interface ProjectDocsViewProps {
  projectId: string | number;
  projectName?: string;
  projectKey?: string;
}

// ─── GitHub-Style Markdown Renderer ──────────────────────────────────────────

function parseInlineMarkdown(text: string): React.ReactNode[] {
  // Regex for inline code, bold, italic, strikethrough, link
  const tokens: React.ReactNode[] = [];
  let remaining = text;
  let keyIdx = 0;

  while (remaining.length > 0) {
    // 1. Inline code: `code`
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      tokens.push(
        <code
          key={`code_${keyIdx++}`}
          className="px-1.5 py-0.5 mx-0.5 bg-[#202226] border border-[#2F333A] text-[#DCB001] font-mono text-[11px] rounded-md font-medium"
        >
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // 2. Bold + Italic: ***text*** or ___text___
    const boldItalicMatch = remaining.match(/^(\*\*\*|___)(.+?)\1/);
    if (boldItalicMatch) {
      tokens.push(
        <strong key={`bi_${keyIdx++}`} className="font-bold italic text-white">
          {boldItalicMatch[2]}
        </strong>
      );
      remaining = remaining.slice(boldItalicMatch[0].length);
      continue;
    }

    // 3. Bold: **text** or __text__
    const boldMatch = remaining.match(/^(\*\*|__)(.+?)\1/);
    if (boldMatch) {
      tokens.push(
        <strong key={`b_${keyIdx++}`} className="font-bold text-white">
          {boldMatch[2]}
        </strong>
      );
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // 4. Strikethrough: ~~text~~
    const strikeMatch = remaining.match(/^~~(.+?)~~/);
    if (strikeMatch) {
      tokens.push(
        <del key={`s_${keyIdx++}`} className="line-through text-[#787C83]">
          {strikeMatch[1]}
        </del>
      );
      remaining = remaining.slice(strikeMatch[0].length);
      continue;
    }

    // 5. Italic: *text* or _text_
    const italicMatch = remaining.match(/^(\*|_)([^*_]+)\1/);
    if (italicMatch) {
      tokens.push(
        <em key={`i_${keyIdx++}`} className="italic text-[#E6EDF3]">
          {italicMatch[2]}
        </em>
      );
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // 6. Link: [title](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      tokens.push(
        <a
          key={`a_${keyIdx++}`}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#58A6FF] hover:underline inline-flex items-center gap-0.5 font-medium"
        >
          <span>{linkMatch[1]}</span>
          <ExternalLink size={10} className="opacity-70" />
        </a>
      );
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // Regular plain text slice until next special token
    const nextSpecial = remaining.search(/[`*_~\[]/);
    if (nextSpecial === -1) {
      tokens.push(remaining);
      break;
    } else if (nextSpecial === 0) {
      // Unmatched marker character
      tokens.push(remaining[0]);
      remaining = remaining.slice(1);
    } else {
      tokens.push(remaining.slice(0, nextSpecial));
      remaining = remaining.slice(nextSpecial);
    }
  }

  return tokens;
}

function renderGithubMarkdown(markdown: string) {
  if (!markdown) return null;
  const lines = markdown.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Code Block: ```lang
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim() || 'text';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // Skip closing ```
      const codeString = codeLines.join('\n');

      elements.push(
        <div key={`codeblock_${i}`} className="my-4 rounded-xl bg-[#0E1012] border border-[#2A2C30] overflow-hidden shadow-md">
          <div className="px-3.5 py-1.5 bg-[#17181A] border-b border-[#2A2C30] flex items-center justify-between text-[11px] font-mono text-[#787C83]">
            <span className="font-semibold uppercase tracking-wider text-[#DCB001]">{lang}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(codeString);
                toast.success('Code copied to clipboard');
              }}
              className="flex items-center gap-1 hover:text-white transition-colors"
            >
              <Copy size={11} />
              <span>Copy</span>
            </button>
          </div>
          <pre className="p-4 text-xs font-mono text-[#E6EDF3] overflow-x-auto leading-relaxed selection:bg-[#DCB001]/30">
            <code>{codeString}</code>
          </pre>
        </div>
      );
      continue;
    }

    // 2. Table: | Col 1 | Col 2 |
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        const headerCols = tableLines[0].split('|').slice(1, -1).map((c) => c.trim());
        const bodyLines = tableLines.slice(2); // Skip separator row

        elements.push(
          <div key={`table_${i}`} className="my-4 overflow-x-auto rounded-xl border border-[#2A2C30] shadow-sm">
            <table className="w-full text-xs text-left border-collapse bg-[#131415]">
              <thead>
                <tr className="bg-[#1B1C1F] border-b border-[#2A2C30]">
                  {headerCols.map((h, colIdx) => (
                    <th key={colIdx} className="px-4 py-2.5 font-bold text-white border-r last:border-r-0 border-[#2A2C30]">
                      {parseInlineMarkdown(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2C30]">
                {bodyLines.map((bRow, rIdx) => {
                  const cells = bRow.split('|').slice(1, -1).map((c) => c.trim());
                  return (
                    <tr key={rIdx} className="hover:bg-[#1A1B1E] transition-colors">
                      {cells.map((cell, cIdx) => (
                        <td key={cIdx} className="px-4 py-2 text-[#CFD4DD] border-r last:border-r-0 border-[#2A2C30]">
                          {parseInlineMarkdown(cell)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // 3. Horizontal Rule
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      elements.push(<hr key={`hr_${i}`} className="my-6 border-t border-[#2A2C30]" />);
      i++;
      continue;
    }

    // 4. Headings (GitHub Style with bottom border for H1/H2)
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h1 key={`h1_${i}`} className="text-2xl sm:text-3xl font-extrabold text-white pb-2.5 mb-4 mt-7 border-b border-[#2A2C30] tracking-tight">
          {parseInlineMarkdown(trimmed.slice(2))}
        </h1>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={`h2_${i}`} className="text-xl sm:text-2xl font-bold text-white pb-2 mb-3 mt-6 border-b border-[#2A2C30]/60 tracking-tight">
          {parseInlineMarkdown(trimmed.slice(3))}
        </h2>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={`h3_${i}`} className="text-base sm:text-lg font-bold text-[#DCB001] mb-2 mt-5 tracking-tight">
          {parseInlineMarkdown(trimmed.slice(4))}
        </h3>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith('#### ')) {
      elements.push(
        <h4 key={`h4_${i}`} className="text-sm sm:text-base font-semibold text-[#CFD4DD] mb-1.5 mt-4">
          {parseInlineMarkdown(trimmed.slice(5))}
        </h4>
      );
      i++;
      continue;
    }

    // 5. Blockquote (> )
    if (trimmed.startsWith('>')) {
      const quoteText = trimmed.replace(/^>\s*/, '');
      elements.push(
        <blockquote
          key={`quote_${i}`}
          className="my-3 pl-4 py-2 border-l-4 border-[#DCB001] bg-[#1B1C1F]/60 rounded-r-xl text-xs sm:text-sm text-[#CFD4DD] italic leading-relaxed"
        >
          {parseInlineMarkdown(quoteText)}
        </blockquote>
      );
      i++;
      continue;
    }

    // 6. Task List (- [ ] or - [x])
    if (/^[-*]\s+\[([ xX])\]/.test(trimmed)) {
      const isChecked = /^[-*]\s+\[([xX])\]/.test(trimmed);
      const taskText = trimmed.replace(/^[-*]\s+\[([ xX])\]\s*/, '');
      elements.push(
        <div key={`task_${i}`} className="flex items-start gap-2.5 my-1.5 pl-1 text-xs sm:text-sm">
          <input
            type="checkbox"
            checked={isChecked}
            readOnly
            className="mt-1 w-3.5 h-3.5 rounded accent-[#DCB001] bg-[#1B1C1F] border-[#2A2C30] cursor-default"
          />
          <span className={isChecked ? 'line-through text-[#787C83]' : 'text-[#CFD4DD]'}>
            {parseInlineMarkdown(taskText)}
          </span>
        </div>
      );
      i++;
      continue;
    }

    // 7. Unordered List (- or *)
    if (/^[-*]\s+/.test(trimmed)) {
      const listText = trimmed.replace(/^[-*]\s+/, '');
      elements.push(
        <div key={`ul_${i}`} className="flex items-start gap-2 my-1 pl-3 text-xs sm:text-sm text-[#CFD4DD]">
          <span className="text-[#DCB001] font-bold text-sm leading-none mt-1.5">•</span>
          <span className="flex-1 leading-relaxed">{parseInlineMarkdown(listText)}</span>
        </div>
      );
      i++;
      continue;
    }

    // 8. Ordered List (1. 2. etc)
    const numMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
    if (numMatch) {
      elements.push(
        <div key={`ol_${i}`} className="flex items-start gap-2 my-1 pl-3 text-xs sm:text-sm text-[#CFD4DD]">
          <span className="font-mono text-[11px] font-bold text-[#DCB001] shrink-0 mt-0.5">{numMatch[1]}.</span>
          <span className="flex-1 leading-relaxed">{parseInlineMarkdown(numMatch[2])}</span>
        </div>
      );
      i++;
      continue;
    }

    // 9. Blank line
    if (trimmed === '') {
      elements.push(<div key={`blank_${i}`} className="h-2" />);
      i++;
      continue;
    }

    // 10. Paragraph
    elements.push(
      <p key={`p_${i}`} className="my-1.5 text-xs sm:text-sm text-[#CFD4DD] leading-relaxed">
        {parseInlineMarkdown(line)}
      </p>
    );
    i++;
  }

  return elements;
}

// ─── Main Component ─────────────────────────────────────────────────────────

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
  const [viewMode, setViewMode] = useState<'editor' | 'split' | 'preview'>('preview');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isJustSaved, setIsJustSaved] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [copiedFile, setCopiedFile] = useState(false);


  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Hydrate from client cache safely on mount (0ms hydration-safe)
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

  const selectedDocIdRef = useRef<string | null>(selectedDocId);
  useEffect(() => {
    selectedDocIdRef.current = selectedDocId;
  }, [selectedDocId]);

  const savedContentRef = useRef<string>(savedContent);
  useEffect(() => {
    savedContentRef.current = savedContent;
  }, [savedContent]);

  // 1. Fetch all docs for this project once on projectId change
  const fetchDocsList = useCallback(async (selectNewestId?: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/docs`);
      if (res.ok) {
        const data: ProjectDoc[] = await res.json();
        if (Array.isArray(data)) {
          setDocs(data);
          setLocalCache(`docs_${projectId}`, data);
          if (data.length > 0) {
            const curId = selectedDocIdRef.current;
            const targetDoc = (selectNewestId && data.find((d) => String(d.id) === String(selectNewestId))) ||
              (curId && data.find((d) => String(d.id) === String(curId))) ||
              data[0];
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
            setDocs((prev) => {
              const exists = prev.some(
                (d) => String(d.id) === String(newDoc.id) || (d.fileName && d.fileName === newDoc.fileName)
              );
              if (exists) {
                return prev.map((d) =>
                  String(d.id) === String(newDoc.id) || (d.fileName && d.fileName === newDoc.fileName)
                    ? { ...d, ...newDoc }
                    : d
                );
              }
              return [newDoc, ...prev];
            });
          }
          break;
        }

        case 'DOC_UPDATED': {
          const updatedDoc = event.payload;
          if (updatedDoc && updatedDoc.id) {
            setDocs((prev) =>
              prev.map((d) => (String(d.id) === String(updatedDoc.id) ? { ...d, ...updatedDoc } : d))
            );

            // If the updated doc is currently open, and current user has no uncommitted local edits
            if (String(selectedDocIdRef.current) === String(updatedDoc.id)) {
              const cleanTitle = updatedDoc.title ? updatedDoc.title.replace(/\.md$/i, '') : '';
              setSavedTitle(cleanTitle);
              if (updatedDoc.content !== undefined) {
                setSavedContent(updatedDoc.content);
                setActiveContent((prev) => {
                  if (!prev || prev === savedContentRef.current) {
                    return updatedDoc.content;
                  }
                  return prev;
                });
              }
            }
          }
          break;
        }

        case 'DOC_DELETED': {
          const deletedId = event.payload?.id;
          if (deletedId) {
            setDocs((prev) => {
              const remaining = prev.filter((d) => String(d.id) !== String(deletedId));
              if (String(selectedDocIdRef.current) === String(deletedId)) {
                if (remaining.length > 0) {
                  setSelectedDocId(String(remaining[0].id));
                  const nextDoc = remaining[0];
                  const cleanTitle = nextDoc.title ? nextDoc.title.replace(/\.md$/i, '') : '';
                  setActiveTitle(cleanTitle);
                  setSavedTitle(cleanTitle);
                  if (nextDoc.content !== undefined) {
                    setActiveContent(nextDoc.content);
                    setSavedContent(nextDoc.content);
                  }
                } else {
                  setSelectedDocId(null);
                  setActiveContent('');
                  setSavedContent('');
                  setActiveTitle('');
                  setSavedTitle('');
                }
              }
              return remaining;
            });
            toast.info('A document was deleted');
          }
          break;
        }

        default:
          break;
      }
    }, [projectId]),
  });

  // Undo / Redo History Stack
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const isUndoRedoRef = useRef<boolean>(false);

  const pushToHistory = useCallback((content: string) => {
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
      return;
    }
    const curIdx = historyIndexRef.current;
    const history = historyRef.current;

    if (curIdx >= 0 && history[curIdx] === content) return;

    const nextHistory = history.slice(0, curIdx + 1);
    nextHistory.push(content);
    if (nextHistory.length > 80) nextHistory.shift();

    historyRef.current = nextHistory;
    historyIndexRef.current = nextHistory.length - 1;
  }, []);

  const handleUndo = useCallback(() => {
    const curIdx = historyIndexRef.current;
    if (curIdx > 0) {
      const prevContent = historyRef.current[curIdx - 1];
      historyIndexRef.current = curIdx - 1;
      isUndoRedoRef.current = true;
      setActiveContent(prevContent);
      toast.info('Undo (Ctrl+Z)');
    }
  }, []);

  const handleRedo = useCallback(() => {
    const curIdx = historyIndexRef.current;
    if (curIdx < historyRef.current.length - 1) {
      const nextContent = historyRef.current[curIdx + 1];
      historyIndexRef.current = curIdx + 1;
      isUndoRedoRef.current = true;
      setActiveContent(nextContent);
      toast.info('Redo (Ctrl+Y)');
    }
  }, []);

  // 2. Fetch selected document content from server .md file / DB
  useEffect(() => {
    if (!selectedDocId) return;

    let isMounted = true;
    fetch(`/api/projects/${projectId}/docs/${selectedDocId}`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data && data.content !== undefined) {
          setActiveContent(data.content);
          setSavedContent(data.content);
          const cleanTitle = data.title ? data.title.replace(/\.md$/i, '') : '';
          setActiveTitle(cleanTitle);
          setSavedTitle(cleanTitle);
          historyRef.current = [data.content];
          historyIndexRef.current = 0;
          setDocs((prev) =>
            prev.map((d) =>
              String(d.id) === String(selectedDocId) ? { ...d, content: data.content, title: data.title } : d
            )
          );
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [selectedDocId, projectId]);

  // Active Doc Object
  const activeDoc = useMemo(() => {
    return docs.find((d) => String(d.id) === String(selectedDocId)) || null;
  }, [docs, selectedDocId]);

  // Filtered Docs List with strict key deduplication and safe string lookups
  const filteredDocs = useMemo(() => {
    const seen = new Set<string>();
    const uniqueDocs: ProjectDoc[] = [];
    for (const d of docs) {
      if (!d) continue;
      const docKey = String(d.id || d.fileName || '');
      if (docKey && !seen.has(docKey)) {
        seen.add(docKey);
        uniqueDocs.push(d);
      }
    }

    if (!searchQuery.trim()) return uniqueDocs;
    const q = searchQuery.toLowerCase().trim();
    return uniqueDocs.filter(
      (d) =>
        (d.title && d.title.toLowerCase().includes(q)) ||
        (d.fileName && d.fileName.toLowerCase().includes(q))
    );
  }, [docs, searchQuery]);

  // Handle Markdown Symbol Insert at Cursor / Selection
  const handleInsertSymbol = (prefix: string, suffix: string = '', defaultPlaceholder: string = 'text') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = textarea.value;

    const selectedText = currentVal.substring(start, end) || defaultPlaceholder;
    const replacement = `${prefix}${selectedText}${suffix}`;

    const updated = currentVal.substring(0, start) + replacement + currentVal.substring(end);
    setActiveContent(updated);
    pushToHistory(updated);

    // Restore focus and cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);
    }, 20);
  };

  // Auto-Save State & Refs
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeContentRef = useRef(activeContent);
  const activeTitleRef = useRef(activeTitle);
  const selectedDocIdCurrentRef = useRef(selectedDocId);

  useEffect(() => {
    activeContentRef.current = activeContent;
  }, [activeContent]);

  useEffect(() => {
    activeTitleRef.current = activeTitle;
  }, [activeTitle]);

  useEffect(() => {
    selectedDocIdCurrentRef.current = selectedDocId;
  }, [selectedDocId]);

  // Perform background auto-save to server & DB without interrupting user typing
  const performAutoSave = useCallback(async () => {
    const docId = selectedDocIdCurrentRef.current;
    if (!docId) return;

    const contentToSave = activeContentRef.current;
    const cleanTitle = (activeTitleRef.current || 'Untitled Document').trim().replace(/\.md$/i, '');

    setIsAutoSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/docs/${docId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: cleanTitle,
          content: contentToSave,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSavedContent(contentToSave);
        setSavedTitle(cleanTitle);
        setLocalCache(`doc_content_${docId}`, contentToSave);
        setDocs((prev) =>
          prev.map((d) => (String(d.id) === String(docId) ? { ...d, title: cleanTitle, updatedAt: data.updatedAt || new Date().toISOString() } : d))
        );
      }
    } catch (err) {
      console.warn('Background auto-save note:', err);
    } finally {
      setIsAutoSaving(false);
    }
  }, [projectId]);

  // Explicit Manual Save with visual feedback and toast
  const performManualSave = useCallback(async () => {
    const docId = selectedDocIdCurrentRef.current;
    if (!docId) return;

    const contentToSave = activeContentRef.current;
    const cleanTitle = (activeTitleRef.current || 'Untitled Document').trim().replace(/\.md$/i, '');

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
              ? { ...d, title: cleanTitle, updatedAt: data.updatedAt || new Date().toISOString() }
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
  }, [projectId]);

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

  // Handle Textarea Change with History Debounce
  const handleContentChange = (newVal: string) => {
    setActiveContent(newVal);
    pushToHistory(newVal);
  };

  // Handle Title Change
  const handleTitleChange = (newTitle: string) => {
    setActiveTitle(newTitle);
    const clean = newTitle.trim().replace(/\.md$/i, '');
    if (selectedDocId) {
      setDocs((prev) =>
        prev.map((d) => (String(d.id) === String(selectedDocId) ? { ...d, title: clean } : d))
      );
    }
  };

  // Handle Create New Doc File
  const handleCreateDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocTitle.trim()) return;

    const cleanTitle = newDocTitle.trim().replace(/\.md$/i, '');
    setNewDocTitle('');
    setIsCreatingNew(false);

    try {
      const res = await fetch(`/api/projects/${projectId}/docs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: cleanTitle,
          content: `# ${cleanTitle}\n\nTechnical specification and architecture documentation for ${projectName}.\n\n## 1. Overview\n\n## 2. Architecture & Components\n- Core API routing and validation\n- State synchronization\n\n## 3. Implementation Steps\n- [ ] Initialize database migration\n- [ ] Build UI components\n- [ ] Execute automated tests\n\n\`\`\`ts\n// Example implementation\nexport const config = {\n  version: '2.0.0',\n  env: 'production'\n};\n\`\`\`\n`,
        }),
      });

      if (res.ok) {
        const created: ProjectDoc = await res.json();
        const docTitle = created.title ? created.title.replace(/\.md$/i, '') : cleanTitle;
        const docContent = created.content || '';
        setDocs((prev) => {
          if (prev.some((d) => String(d.id) === String(created.id) || (d.fileName && d.fileName === created.fileName))) {
            return prev.map((d) => (String(d.id) === String(created.id) ? created : d));
          }
          return [created, ...prev];
        });
        setSelectedDocId(String(created.id));
        setActiveTitle(docTitle);
        setSavedTitle(docTitle);
        setActiveContent(docContent);
        setSavedContent(docContent);
        setLocalCache(`doc_content_${created.id}`, docContent);
        historyRef.current = [docContent];
        historyIndexRef.current = 0;
        setViewMode('split');
        toast.success(`Created: ${docTitle}`);
      } else {
        toast.error('Failed to create doc file');
      }
    } catch {
      toast.error('Network error creating doc file');
    }
  };

  // Global Keyboard Shortcuts (Ctrl+Z for Undo, Ctrl+Y for Redo, Ctrl+S for instant manual save)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S / Cmd+S => Instant Manual Save
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        performManualSave();
        return;
      }

      // Ctrl+Z / Cmd+Z => Undo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Ctrl+Shift+Z or Ctrl+Y => Redo
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
        const remaining = docs.filter((d) => String(d.id) !== String(docId));
        setDocs(remaining);
        if (String(selectedDocId) === String(docId)) {
          if (remaining.length > 0) {
            setSelectedDocId(String(remaining[0].id));
            setViewMode('preview');
          } else {
            setSelectedDocId(null);
            setActiveContent('');
            setSavedContent('');
            setActiveTitle('');
            setSavedTitle('');
          }
        }
        toast.success(`Deleted file: ${cleanDocName}`);
      }
    } catch {
      toast.error('Failed to delete document');
    }
  };

  const handleCopyFileName = () => {
    if (activeDoc?.fileName && typeof window !== 'undefined') {
      const cleanName = activeDoc.fileName.replace(/\.md$/i, '');
      navigator.clipboard.writeText(cleanName);
      setCopiedFile(true);
      toast.success('Copied document identifier');
      setTimeout(() => setCopiedFile(false), 2000);
    }
  };

  const handleSelectDoc = (docId: string) => {
    setSelectedDocId(docId);
    setViewMode('preview'); // Opening already created file defaults to preview mode
    const doc = docs.find((d) => String(d.id) === String(docId));
    if (doc) {
      const cleanTitle = doc.title ? doc.title.replace(/\.md$/i, '') : '';
      setActiveTitle(cleanTitle);
      setSavedTitle(cleanTitle);
      if (doc.content !== undefined && doc.content !== '') {
        setActiveContent(doc.content);
        setSavedContent(doc.content);
        historyRef.current = [doc.content];
        historyIndexRef.current = 0;
      }
    }
  };

  const hasUnsavedChanges = activeContent !== savedContent || activeTitle !== savedTitle;

  return (
    <div className="flex-1 flex h-full min-h-0 w-full bg-[#131415] text-[#CFD4DD] font-sans select-none overflow-hidden relative">
      {/* Left Sidebar: Document List & Switcher */}
      <div className="w-64 sm:w-72 bg-[#17181A] border-r border-[#2A2C30] flex flex-col shrink-0 h-full min-h-0">
        {/* Sidebar Header */}
        <div className="p-3.5 border-b border-[#2A2C30] space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <BookOpen size={15} className="text-[#DCB001]" />
              <span>Project Docs ({docs.length})</span>
            </div>

            <button
              onClick={() => setIsCreatingNew(true)}
              className="flex items-center gap-1 px-2.5 py-1 bg-[#DCB001] hover:bg-[#c49c00] text-[#0F1011] rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
              title="Create New Document"
            >
              <Plus size={12} />
              <span>New Doc</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#787C83]" />
            <input
              type="text"
              placeholder="Search docs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#131415] border border-[#2A2C30] rounded-lg pl-7 pr-2.5 py-1 text-xs text-white placeholder-[#787C83] outline-none"
            />
          </div>
        </div>

        {/* Inline Create Form */}
        {isCreatingNew && (
          <form onSubmit={handleCreateDoc} className="p-3 bg-[#131415] border-b border-[#DCB001]/40 space-y-2">
            <input
              type="text"
              required
              autoFocus
              placeholder="Document title (e.g. Architecture & Overview)..."
              value={newDocTitle}
              onChange={(e) => setNewDocTitle(e.target.value)}
              className="w-full bg-[#1B1C1F] border border-[#2A2C30] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
            />
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setIsCreatingNew(false)}
                className="px-2.5 py-1 text-xs text-[#787C83] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 bg-[#DCB001] text-[#0F1011] text-xs font-bold rounded-lg cursor-pointer"
              >
                Create
              </button>
            </div>
          </form>
        )}

        {/* Documents Switcher List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {loading ? (
            <div className="p-4 flex flex-col items-center justify-center gap-2 text-center">
              <div className="w-5 h-5 rounded-full border-2 border-[#DCB001] border-t-transparent animate-spin" />
              <RandomLoadingText showBadge={false} className="text-[11px]" />
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="p-4 text-center text-xs text-[#787C83] italic">
              No docs found.
            </div>
          ) : (
            filteredDocs.map((doc) => {
              const isSelected = String(selectedDocId) === String(doc.id);
              const docTitle = doc?.title ? doc.title.replace(/\.md$/i, '') : 'Untitled Document';
              const docFileName = doc?.fileName ? doc.fileName.replace(/\.md$/i, '') : String(doc.id);

              return (
                <div
                  key={doc.id}
                  onClick={() => handleSelectDoc(String(doc.id))}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer group flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-[#1F2023] border-[#DCB001]/60 text-white shadow-sm'
                      : 'bg-[#131415] border-[#2A2C30]/60 hover:bg-[#1A1B1D] text-[#CFD4DD]'
                  }`}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <FileCode size={13} className={isSelected ? 'text-[#DCB001]' : 'text-[#787C83]'} />
                      <span className="font-semibold text-xs truncate block">{docTitle}</span>
                    </div>

                    <div className="flex items-center gap-1 text-[10px] font-mono text-[#787C83] truncate">
                      <span className="bg-[#0E0F10] px-1.5 py-0.2 rounded border border-[#2A2C30] truncate max-w-[140px]">
                        {docFileName}
                      </span>
                    </div>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={(e) => handleDeleteDoc(String(doc.id), doc.fileName || 'Document', e)}
                    className="text-[#787C83] hover:text-[#EF4444] p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete document"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Workspace Area: Markdown Editor / Split / Preview */}
      <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-[#131415] relative">
        {activeDoc ? (
          <>
            {/* Main Top Header */}
            <div className="h-12 px-4 sm:px-5 bg-[#17181A] border-b border-[#2A2C30] flex items-center justify-between gap-3 shrink-0">
              {/* Document Title Input */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <FileText size={16} className="text-[#DCB001] shrink-0" />
                <input
                  type="text"
                  value={activeTitle}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="bg-transparent text-sm sm:text-base font-bold text-white outline-none flex-1 truncate hover:border-b hover:border-[#DCB001] focus:border-b focus:border-[#DCB001] transition-all"
                  title="Click to edit document title"
                />

                {/* Server Filename Badge */}
                <button
                  onClick={handleCopyFileName}
                  className="hidden md:flex items-center gap-1 px-2 py-0.5 bg-[#131415] hover:bg-[#1F2023] border border-[#2A2C30] rounded text-[10px] font-mono text-[#787C83] hover:text-[#DCB001] transition-all shrink-0"
                  title="Click to copy identifier"
                >
                  <FileCode size={11} />
                  <span className="truncate max-w-[160px]">{(activeDoc.fileName || '').replace(/\.md$/i, '')}</span>
                  {copiedFile ? <Check size={11} className="text-[#22C55E]" /> : <Copy size={10} />}
                </button>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2 shrink-0">
                {/* 1. Explicit Save Button */}
                <button
                  type="button"
                  onClick={() => performManualSave()}
                  disabled={isSaving || isAutoSaving || !hasUnsavedChanges}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                    hasUnsavedChanges
                      ? 'bg-[#DCB001] hover:bg-[#c49c00] text-[#0F1011] cursor-pointer'
                      : isJustSaved
                      ? 'bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/40 cursor-default'
                      : 'bg-[#202226] text-[#787C83] border border-[#2A2C30] opacity-75 cursor-default'
                  }`}
                  title="Save document (Ctrl + S)"
                >
                  {isSaving || isAutoSaving ? (
                    <Loader2 size={13} className="animate-spin text-current" />
                  ) : isJustSaved ? (
                    <Check size={13} className="text-[#22C55E]" />
                  ) : (
                    <Save size={13} />
                  )}
                  <span>{isSaving || isAutoSaving ? 'Saving...' : isJustSaved ? 'Saved' : 'Save'}</span>
                </button>

                {/* Autosave Status Indicator */}
                <div className="hidden sm:flex items-center select-none">
                  {isAutoSaving ? (
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-[#131415] border border-[#DCB001]/30 rounded-lg text-[11px] font-mono text-[#DCB001]" title="Autosaving to server...">
                      <Loader2 size={11} className="animate-spin text-[#DCB001]" />
                      <span>Saving...</span>
                    </div>
                  ) : hasUnsavedChanges ? (
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-[#131415] border border-[#2A2C30] rounded-lg text-[11px] font-mono text-[#787C83]" title="Unsaved changes pending...">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#DCB001] animate-pulse" />
                      <span>Unsaved</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-[#131415] border border-[#22C55E]/20 rounded-lg text-[11px] font-mono text-[#22C55E]" title="All changes saved">
                      <CheckCircle2 size={11} className="text-[#22C55E]" />
                      <span>Synced</span>
                    </div>
                  )}
                </div>

                {/* Realtime Live Sync Badge */}
                <div className="hidden lg:flex items-center">
                  <RealtimeBadge />
                </div>

                {/* View Mode Switcher */}
                <div className="flex items-center bg-[#131415] border border-[#2A2C30] rounded-lg p-0.5 text-xs">
                  <button
                    onClick={() => setViewMode('editor')}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md font-semibold transition-all ${
                      viewMode === 'editor' ? 'bg-[#2A2C30] text-[#DCB001] shadow-sm' : 'text-[#787C83] hover:text-white'
                    }`}
                    title="Editor only"
                  >
                    <Edit3 size={12} />
                    <span className="hidden sm:inline">Editor</span>
                  </button>

                  <button
                    onClick={() => setViewMode('split')}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md font-semibold transition-all ${
                      viewMode === 'split' ? 'bg-[#2A2C30] text-[#DCB001] shadow-sm' : 'text-[#787C83] hover:text-white'
                    }`}
                    title="Split view"
                  >
                    <Columns size={12} />
                    <span className="hidden sm:inline">Split</span>
                  </button>

                  <button
                    onClick={() => setViewMode('preview')}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md font-semibold transition-all ${
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

            {/* Document Content Workspace */}
            <div className="flex-1 min-h-0 flex overflow-hidden">
              {/* Markdown Editor Column */}
              {(viewMode === 'editor' || viewMode === 'split') && (
                <div className={`flex-1 h-full min-h-0 flex flex-col p-4 pb-14 ${viewMode === 'split' ? 'border-r border-[#2A2C30]' : ''}`}>
                  <textarea
                    ref={textareaRef}
                    value={activeContent}
                    onChange={(e) => handleContentChange(e.target.value)}
                    placeholder="Write markdown documentation here..."
                    className="w-full h-full flex-1 p-4 bg-[#17181A] border border-[#2A2C30] focus:border-[#DCB001] rounded-xl font-mono text-xs sm:text-sm text-white leading-relaxed outline-none resize-none custom-scrollbar"
                  />
                </div>
              )}

              {/* GitHub-Flavored Markdown Preview Column (Real-time Live Preview while editing) */}
              {(viewMode === 'preview' || viewMode === 'split') && (
                <div className="flex-1 h-full min-h-0 overflow-y-auto p-6 pb-16 bg-[#0E0F11] custom-scrollbar">
                  <div className="max-w-4xl mx-auto space-y-1 text-[#CFD4DD] font-sans">
                    {viewMode === 'split' && (
                      <div className="flex items-center justify-between pb-3 text-[11px] font-mono text-[#787C83]">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse shadow-[0_0_6px_#22C55E]" />
                          <span className="text-[#CFD4DD] font-bold">REALTIME PREVIEW</span>
                        </div>
                        {isAutoSaving || isSaving ? (
                          <span className="text-[#DCB001] flex items-center gap-1 text-[10px]">
                            <Loader2 size={10} className="animate-spin text-[#DCB001]" />
                            Saving to server...
                          </span>
                        ) : hasUnsavedChanges ? (
                          <span className="text-[#787C83] flex items-center gap-1 text-[10px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#DCB001] animate-pulse" />
                            Unsaved changes
                          </span>
                        ) : (
                          <span className="text-[#22C55E] text-[10px]">✓ All changes saved</span>
                        )}
                      </div>
                    )}
                    <div className="p-6 sm:p-8 bg-[#161719] border border-[#2A2C30] rounded-2xl shadow-xl">
                      {activeContent || savedContent ? (
                        renderGithubMarkdown(activeContent || savedContent)
                      ) : (
                        <p className="text-xs text-[#787C83] italic">Start typing in the editor on the left to see real-time preview...</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Literal Markdown Symbols Formatting Bar at Bottom Middle */}
            {(viewMode === 'editor' || viewMode === 'split') && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 bg-[#17181A]/95 backdrop-blur-md border border-[#2A2C30] hover:border-[#DCB001]/50 shadow-2xl rounded-xl px-3 py-1.5 flex flex-row flex-nowrap items-center gap-1.5 text-xs text-[#CFD4DD] overflow-x-auto max-w-[95vw] whitespace-nowrap select-none custom-scrollbar">
                {/* Save Button */}
                <button
                  type="button"
                  onClick={() => performManualSave()}
                  disabled={isSaving || isAutoSaving || !hasUnsavedChanges}
                  className="inline-flex items-center justify-center gap-1 shrink-0 h-7 px-2.5 bg-[#DCB001] hover:bg-[#c49c00] disabled:bg-[#1B1C1F] text-[#0F1011] disabled:text-[#787C83] disabled:border-[#2A2C30] border border-[#DCB001]/60 rounded-lg font-mono text-xs font-bold transition-all leading-none cursor-pointer disabled:cursor-default"
                  title="Save Document (Ctrl + S)"
                >
                  <Save size={12} />
                  <span>Save</span>
                </button>

                <span className="w-px h-4 bg-[#2A2C30] mx-0.5 shrink-0" />

                {/* Undo Button */}
                <button
                  type="button"
                  onClick={handleUndo}
                  className="inline-flex items-center justify-center gap-1 shrink-0 h-7 px-2 bg-[#131415] hover:bg-[#222427] hover:border-[#DCB001]/50 border border-[#2A2C30] rounded-lg font-mono text-xs text-[#CFD4DD] hover:text-[#DCB001] transition-all leading-none cursor-pointer"
                  title="Undo (Ctrl + Z)"
                >
                  <Undo2 size={12} />
                  <span>Undo</span>
                </button>

                {/* Redo Button */}
                <button
                  type="button"
                  onClick={handleRedo}
                  className="inline-flex items-center justify-center gap-1 shrink-0 h-7 px-2 bg-[#131415] hover:bg-[#222427] hover:border-[#DCB001]/50 border border-[#2A2C30] rounded-lg font-mono text-xs text-[#CFD4DD] hover:text-[#DCB001] transition-all leading-none cursor-pointer"
                  title="Redo (Ctrl + Y / Ctrl + Shift + Z)"
                >
                  <Redo2 size={12} />
                  <span>Redo</span>
                </button>

                <span className="w-px h-4 bg-[#2A2C30] mx-0.5 shrink-0" />

                <span className="text-[10px] font-mono text-[#787C83] uppercase px-1 shrink-0 hidden xl:inline">Symbols:</span>

                {/* # Heading 1 */}
                <button
                  type="button"
                  onClick={() => handleInsertSymbol('# ', '', 'Heading 1')}
                  className="inline-flex items-center justify-center shrink-0 h-7 px-2.5 bg-[#131415] hover:bg-[#222427] hover:border-[#DCB001]/50 border border-[#2A2C30] rounded-lg font-mono font-bold text-xs text-[#DCB001] transition-all leading-none cursor-pointer"
                  title="Heading 1: # Heading"
                >
                  #
                </button>

                {/* ## Heading 2 */}
                <button
                  type="button"
                  onClick={() => handleInsertSymbol('## ', '', 'Heading 2')}
                  className="inline-flex items-center justify-center shrink-0 h-7 px-2.5 bg-[#131415] hover:bg-[#222427] hover:border-[#DCB001]/50 border border-[#2A2C30] rounded-lg font-mono font-bold text-xs text-[#DCB001] transition-all leading-none cursor-pointer"
                  title="Heading 2: ## Heading"
                >
                  ##
                </button>

                {/* ### Heading 3 */}
                <button
                  type="button"
                  onClick={() => handleInsertSymbol('### ', '', 'Heading 3')}
                  className="inline-flex items-center justify-center shrink-0 h-7 px-2.5 bg-[#131415] hover:bg-[#222427] hover:border-[#DCB001]/50 border border-[#2A2C30] rounded-lg font-mono font-bold text-xs text-[#DCB001] transition-all leading-none cursor-pointer"
                  title="Heading 3: ### Heading"
                >
                  ###
                </button>

                <span className="w-px h-4 bg-[#2A2C30] mx-0.5 shrink-0" />

                {/* **bold** */}
                <button
                  type="button"
                  onClick={() => handleInsertSymbol('**', '**', 'bold')}
                  className="inline-flex items-center justify-center shrink-0 h-7 px-2.5 bg-[#131415] hover:bg-[#222427] hover:border-[#DCB001]/50 border border-[#2A2C30] rounded-lg font-mono font-bold text-xs text-white transition-all leading-none cursor-pointer"
                  title="Bold: **bold**"
                >
                  **bold**
                </button>

                {/* *italic* */}
                <button
                  type="button"
                  onClick={() => handleInsertSymbol('*', '*', 'italic')}
                  className="inline-flex items-center justify-center shrink-0 h-7 px-2.5 bg-[#131415] hover:bg-[#222427] hover:border-[#DCB001]/50 border border-[#2A2C30] rounded-lg font-mono italic text-xs text-[#CFD4DD] transition-all leading-none cursor-pointer"
                  title="Italic: *italic*"
                >
                  *italic*
                </button>

                {/* ~~strike~~ */}
                <button
                  type="button"
                  onClick={() => handleInsertSymbol('~~', '~~', 'strike')}
                  className="inline-flex items-center justify-center shrink-0 h-7 px-2.5 bg-[#131415] hover:bg-[#222427] hover:border-[#DCB001]/50 border border-[#2A2C30] rounded-lg font-mono line-through text-xs text-[#787C83] transition-all leading-none cursor-pointer"
                  title="Strikethrough: ~~strike~~"
                >
                  ~~strike~~
                </button>

                <span className="w-px h-4 bg-[#2A2C30] mx-0.5 shrink-0" />

                {/* `code` */}
                <button
                  type="button"
                  onClick={() => handleInsertSymbol('`', '`', 'code')}
                  className="inline-flex items-center justify-center shrink-0 h-7 px-2.5 bg-[#131415] hover:bg-[#222427] hover:border-[#DCB001]/50 border border-[#2A2C30] rounded-lg font-mono text-xs text-[#DCB001] transition-all leading-none cursor-pointer"
                  title="Inline Code: `code`"
                >
                  `code`
                </button>

                {/* ```block``` */}
                <button
                  type="button"
                  onClick={() => handleInsertSymbol('```ts\n', '\n```', '// code')}
                  className="inline-flex items-center justify-center shrink-0 h-7 px-2.5 bg-[#131415] hover:bg-[#222427] hover:border-[#DCB001]/50 border border-[#2A2C30] rounded-lg font-mono text-xs text-[#787C83] hover:text-white transition-all leading-none cursor-pointer"
                  title="Code Block: ```lang\ncode\n```"
                >
                  ```{` `}```
                </button>

                {/* - list */}
                <button
                  type="button"
                  onClick={() => handleInsertSymbol('- ', '', 'item')}
                  className="inline-flex items-center justify-center shrink-0 h-7 px-2.5 bg-[#131415] hover:bg-[#222427] hover:border-[#DCB001]/50 border border-[#2A2C30] rounded-lg font-mono text-xs text-[#CFD4DD] transition-all leading-none cursor-pointer"
                  title="Bullet List: - item"
                >
                  - list
                </button>

                {/* 1. list */}
                <button
                  type="button"
                  onClick={() => handleInsertSymbol('1. ', '', 'item')}
                  className="inline-flex items-center justify-center shrink-0 h-7 px-2.5 bg-[#131415] hover:bg-[#222427] hover:border-[#DCB001]/50 border border-[#2A2C30] rounded-lg font-mono text-xs text-[#CFD4DD] transition-all leading-none cursor-pointer"
                  title="Numbered List: 1. item"
                >
                  1. list
                </button>

                {/* - [ ] task */}
                <button
                  type="button"
                  onClick={() => handleInsertSymbol('- [ ] ', '', 'task')}
                  className="inline-flex items-center justify-center shrink-0 h-7 px-2.5 bg-[#131415] hover:bg-[#222427] hover:border-[#DCB001]/50 border border-[#2A2C30] rounded-lg font-mono text-xs text-[#DCB001] transition-all leading-none cursor-pointer"
                  title="Task Checkbox: - [ ] task"
                >
                  - [ ]
                </button>

                <span className="w-px h-4 bg-[#2A2C30] mx-0.5 shrink-0" />

                {/* > quote */}
                <button
                  type="button"
                  onClick={() => handleInsertSymbol('> ', '', 'quote')}
                  className="inline-flex items-center justify-center shrink-0 h-7 px-2.5 bg-[#131415] hover:bg-[#222427] hover:border-[#DCB001]/50 border border-[#2A2C30] rounded-lg font-mono text-xs text-[#CFD4DD] transition-all leading-none cursor-pointer"
                  title="Blockquote: > quote"
                >
                  {`> quote`}
                </button>

                {/* [link] */}
                <button
                  type="button"
                  onClick={() => handleInsertSymbol('[', '](https://example.com)', 'title')}
                  className="inline-flex items-center justify-center shrink-0 h-7 px-2.5 bg-[#131415] hover:bg-[#222427] hover:border-[#DCB001]/50 border border-[#2A2C30] rounded-lg font-mono text-xs text-[#58A6FF] transition-all leading-none cursor-pointer"
                  title="Link: [title](url)"
                >
                  [link]
                </button>

                {/* | table | */}
                <button
                  type="button"
                  onClick={() =>
                    handleInsertSymbol(
                      '\n| Col 1 | Col 2 |\n|---|---|\n| Val 1 | Val 2 |\n',
                      '',
                      ''
                    )
                  }
                  className="inline-flex items-center justify-center shrink-0 h-7 px-2.5 bg-[#131415] hover:bg-[#222427] hover:border-[#DCB001]/50 border border-[#2A2C30] rounded-lg font-mono text-xs text-[#CFD4DD] transition-all leading-none cursor-pointer"
                  title="Table: | Col 1 | Col 2 |"
                >
                  | table |
                </button>

                {/* --- */}
                <button
                  type="button"
                  onClick={() => handleInsertSymbol('\n---\n', '', '')}
                  className="inline-flex items-center justify-center shrink-0 h-7 px-2.5 bg-[#131415] hover:bg-[#222427] hover:border-[#DCB001]/50 border border-[#2A2C30] rounded-lg font-mono text-xs text-[#787C83] hover:text-white transition-all leading-none cursor-pointer"
                  title="Horizontal Divider: ---"
                >
                  ---
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-3">
            <BookOpen size={36} className="text-[#DCB001]/40" />
            <h3 className="text-base font-bold text-white">No Document Selected</h3>
            <p className="text-xs text-[#787C83] max-w-sm">
              Select an existing document from the left sidebar or click "+ New Doc" to create a new document.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
