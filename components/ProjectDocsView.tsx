'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Clock, 
  FolderKanban,
  FileCode,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

interface ProjectDocsViewProps {
  projectId: string | number;
  projectName?: string;
  projectKey?: string;
}

export const ProjectDocsView: React.FC<ProjectDocsViewProps> = ({
  projectId,
  projectName = 'Project Workspace',
  projectKey = 'PRJ',
}) => {
  const [docs, setDocs] = useState<ProjectDoc[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [activeContent, setActiveContent] = useState<string>('');
  const [activeTitle, setActiveTitle] = useState<string>('');
  const [viewMode, setViewMode] = useState<'editor' | 'split' | 'preview'>('split');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [copiedFile, setCopiedFile] = useState(false);

  // 1. Fetch all docs for this project
  const fetchDocsList = useCallback(async (selectNewestId?: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/docs`);
      if (res.ok) {
        const data: ProjectDoc[] = await res.json();
        setDocs(data);
        if (data.length > 0) {
          const targetId = selectNewestId || selectedDocId || data[0].id;
          const targetDoc = data.find((d) => d.id === targetId) || data[0];
          setSelectedDocId(targetDoc.id);
          setActiveTitle(targetDoc.title);
        }
      }
    } catch {
      toast.error('Failed to load project documents');
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedDocId]);

  useEffect(() => {
    fetchDocsList();
  }, [fetchDocsList]);

  // 2. Fetch selected document content from server .md file
  useEffect(() => {
    if (!selectedDocId) return;

    let isMounted = true;
    fetch(`/api/projects/${projectId}/docs/${selectedDocId}`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.content !== undefined) {
          setActiveContent(data.content);
          setActiveTitle(data.title);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [selectedDocId, projectId]);

  // Active Doc Object
  const activeDoc = useMemo(() => {
    return docs.find((d) => d.id === selectedDocId) || null;
  }, [docs, selectedDocId]);

  // Filtered Docs List
  const filteredDocs = useMemo(() => {
    if (!searchQuery.trim()) return docs;
    const q = searchQuery.toLowerCase().trim();
    return docs.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.fileName.toLowerCase().includes(q)
    );
  }, [docs, searchQuery]);

  // Handle Create New Doc File
  const handleCreateDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocTitle.trim()) return;

    const title = newDocTitle.trim();
    setNewDocTitle('');
    setIsCreatingNew(false);

    try {
      const res = await fetch(`/api/projects/${projectId}/docs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content: `# ${title}\n\nTechnical specification and architecture documentation for ${projectName}.\n\n## 1. Overview\n\n## 2. Requirements\n\n## 3. Implementation Details\n`,
        }),
      });

      if (res.ok) {
        const created: ProjectDoc = await res.json();
        setDocs((prev) => [created, ...prev]);
        setSelectedDocId(created.id);
        setActiveTitle(created.title);
        setActiveContent(created.content || '');
        toast.success(`Created unique .md file: ${created.fileName}`);
      } else {
        toast.error('Failed to create doc file');
      }
    } catch {
      toast.error('Network error creating doc file');
    }
  };

  // Handle Save Doc Content to Server .md File
  const handleSaveDoc = async () => {
    if (!selectedDocId) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/docs/${selectedDocId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: activeTitle.trim(),
          content: activeContent,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setDocs((prev) =>
          prev.map((d) => (d.id === selectedDocId ? { ...d, title: activeTitle.trim(), updatedAt: data.updatedAt } : d))
        );
        toast.success(`Saved to server file: ${activeDoc?.fileName || '.md'}`);
      } else {
        toast.error('Failed to save document to server');
      }
    } catch {
      toast.error('Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Delete Doc
  const handleDeleteDoc = async (docId: string, docFileName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete the file "${docFileName}" from the server?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/projects/${projectId}/docs/${docId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        const remaining = docs.filter((d) => d.id !== docId);
        setDocs(remaining);
        if (selectedDocId === docId) {
          if (remaining.length > 0) {
            setSelectedDocId(remaining[0].id);
          } else {
            setSelectedDocId(null);
            setActiveContent('');
            setActiveTitle('');
          }
        }
        toast.success(`Deleted file ${docFileName}`);
      }
    } catch {
      toast.error('Failed to delete document');
    }
  };

  const handleCopyFileName = () => {
    if (activeDoc?.fileName && typeof window !== 'undefined') {
      navigator.clipboard.writeText(`data/docs/${activeDoc.fileName}`);
      setCopiedFile(true);
      toast.success('Copied server file path');
      setTimeout(() => setCopiedFile(false), 2000);
    }
  };

  return (
    <div className="flex-1 flex h-full bg-[#131415] text-[#CFD4DD] font-sans select-none overflow-hidden">
      {/* Left Sidebar: Document List & Switcher */}
      <div className="w-64 sm:w-72 bg-[#17181A] border-r border-[#2A2C30] flex flex-col shrink-0 h-full">
        {/* Sidebar Header */}
        <div className="p-3.5 border-b border-[#2A2C30] space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <BookOpen size={15} className="text-[#DCB001]" />
              <span>Project Docs ({docs.length})</span>
            </div>

            <button
              onClick={() => setIsCreatingNew(true)}
              className="flex items-center gap-1 px-2 py-1 bg-[#DCB001] hover:bg-[#c49c00] text-[#0F1011] rounded-lg text-xs font-bold transition-all shadow-sm"
              title="Create New Markdown File"
            >
              <Plus size={12} />
              <span>New .md</span>
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
              placeholder="Document title (e.g. API Spec)..."
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
                className="px-3 py-1 bg-[#DCB001] text-[#0F1011] text-xs font-bold rounded-lg"
              >
                Create
              </button>
            </div>
          </form>
        )}

        {/* Documents Switcher List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {filteredDocs.length === 0 ? (
            <div className="p-4 text-center text-xs text-[#787C83] italic">
              No docs found.
            </div>
          ) : (
            filteredDocs.map((doc) => {
              const isSelected = selectedDocId === doc.id;

              return (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDocId(doc.id)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer group flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-[#1F2023] border-[#DCB001]/60 text-white shadow-sm'
                      : 'bg-[#131415] border-[#2A2C30]/60 hover:bg-[#1A1B1D] text-[#CFD4DD]'
                  }`}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <FileCode size={13} className={isSelected ? 'text-[#DCB001]' : 'text-[#787C83]'} />
                      <span className="font-semibold text-xs truncate block">{doc.title}</span>
                    </div>

                    <div className="flex items-center gap-1 text-[10px] font-mono text-[#787C83] truncate">
                      <span className="bg-[#0E0F10] px-1.5 py-0.2 rounded border border-[#2A2C30] truncate max-w-[140px]">
                        {doc.fileName}
                      </span>
                    </div>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={(e) => handleDeleteDoc(doc.id, doc.fileName, e)}
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
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#131415]">
        {activeDoc ? (
          <>
            {/* Main Top Header */}
            <div className="h-12 px-5 bg-[#17181A] border-b border-[#2A2C30] flex items-center justify-between gap-3 shrink-0">
              {/* Document Title Input */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <FileText size={16} className="text-[#DCB001] shrink-0" />
                <input
                  type="text"
                  value={activeTitle}
                  onChange={(e) => setActiveTitle(e.target.value)}
                  className="bg-transparent text-sm sm:text-base font-bold text-white outline-none flex-1 truncate hover:border-b hover:border-[#DCB001] focus:border-b focus:border-[#DCB001] transition-all"
                  title="Click to edit document title"
                />

                {/* Server Filename Badge */}
                <button
                  onClick={handleCopyFileName}
                  className="hidden md:flex items-center gap-1 px-2 py-0.5 bg-[#131415] hover:bg-[#1F2023] border border-[#2A2C30] rounded text-[10px] font-mono text-[#787C83] hover:text-[#DCB001] transition-all shrink-0"
                  title="Click to copy server .md path"
                >
                  <FileCode size={11} />
                  <span className="truncate max-w-[160px]">{activeDoc.fileName}</span>
                  {copiedFile ? <Check size={11} className="text-[#22C55E]" /> : <Copy size={10} />}
                </button>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2 shrink-0">
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

                {/* Save Button */}
                <button
                  onClick={handleSaveDoc}
                  disabled={isSaving}
                  className="flex items-center gap-1 px-3 py-1.5 bg-[#DCB001] hover:bg-[#c49c00] text-[#0F1011] rounded-lg text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                >
                  <Save size={13} />
                  <span>{isSaving ? 'Saving...' : 'Save .md'}</span>
                </button>
              </div>
            </div>

            {/* Document Content Workspace */}
            <div className="flex-1 flex overflow-hidden">
              {/* Markdown Editor Column */}
              {(viewMode === 'editor' || viewMode === 'split') && (
                <div className={`flex-1 h-full flex flex-col p-4 ${viewMode === 'split' ? 'border-r border-[#2A2C30]' : ''}`}>
                  <textarea
                    value={activeContent}
                    onChange={(e) => setActiveContent(e.target.value)}
                    placeholder="Write markdown documentation here..."
                    className="w-full h-full p-4 bg-[#17181A] border border-[#2A2C30] focus:border-[#DCB001] rounded-xl font-mono text-xs sm:text-sm text-white leading-relaxed outline-none resize-none custom-scrollbar"
                  />
                </div>
              )}

              {/* Formatted Markdown Preview Column */}
              {(viewMode === 'preview' || viewMode === 'split') && (
                <div className="flex-1 h-full overflow-y-auto p-6 bg-[#101112] custom-scrollbar">
                  <div className="max-w-3xl mx-auto space-y-4 text-xs sm:text-sm text-[#CFD4DD] leading-relaxed">
                    <div className="p-6 bg-[#17181A] border border-[#2A2C30] rounded-2xl shadow-md whitespace-pre-wrap font-sans">
                      {activeContent}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-3">
            <BookOpen size={36} className="text-[#DCB001]/40" />
            <h3 className="text-base font-bold text-white">No Document Selected</h3>
            <p className="text-xs text-[#787C83] max-w-sm">
              Select an existing document from the left sidebar or click "+ New .md" to create a new markdown file.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
