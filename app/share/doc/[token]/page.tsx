'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Minus, Plus, AlertCircle, FileText } from 'lucide-react';
import { renderGithubMarkdown } from '@/components/ui/MarkdownRenderer';

interface SharedDocData {
  id: string;
  title: string;
  fileName: string;
  folder?: string;
  content: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function PublicDocSharePage() {
  const params = useParams();
  const token = params?.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [doc, setDoc] = useState<SharedDocData | null>(null);
  const [previewZoom, setPreviewZoom] = useState<number>(1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize zoom from localStorage if available
  useEffect(() => {
    try {
      const saved = localStorage.getItem('teader_public_doc_zoom');
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 0.5 && parsed <= 2.5) {
          setPreviewZoom(parsed);
        }
      }
    } catch {}
  }, []);

  // Fetch shared document data
  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    const fetchSharedDoc = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/share/doc/${token}`);
        if (!res.ok) {
          if (res.status === 410) {
            throw new Error('This public document link has expired.');
          }
          if (res.status === 404) {
            throw new Error('Shared document link not found or has been revoked.');
          }
          throw new Error('Unable to load document.');
        }

        const data = await res.json();
        if (isMounted) {
          setDoc(data.doc);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to load document');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchSharedDoc();

    return () => {
      isMounted = false;
    };
  }, [token]);

  // Handle zoom changes
  const updatePreviewZoom = useCallback((updater: number | ((prev: number) => number)) => {
    setPreviewZoom((prev) => {
      const target = typeof updater === 'function' ? updater(prev) : updater;
      const clamped = Math.min(2.5, Math.max(0.5, Number(target.toFixed(2))));
      try {
        localStorage.setItem('teader_public_doc_zoom', String(clamped));
      } catch {}
      return clamped;
    });
  }, []);

  // Control + Mouse Wheel Zoom In / Out and Keyboard Shortcuts
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        // Negative deltaY: wheel up (zoom in); Positive deltaY: wheel down (zoom out)
        const step = e.deltaY < 0 ? 0.08 : -0.08;
        updatePreviewZoom((prev) => prev + step);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          updatePreviewZoom((prev) => prev + 0.1);
        } else if (e.key === '-' || e.key === '_') {
          e.preventDefault();
          updatePreviewZoom((prev) => prev - 0.1);
        } else if (e.key === '0') {
          e.preventDefault();
          updatePreviewZoom(1);
        }
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [updatePreviewZoom]);

  // Render markdown content
  const renderedContent = useMemo(() => {
    if (!doc?.content) return null;
    return renderGithubMarkdown(doc.content);
  }, [doc?.content]);

  return (
    <div
      ref={containerRef}
      className="min-h-screen w-full bg-[#0E0E0E] text-[var(--text-primary)] flex flex-col font-sans select-text relative overflow-x-hidden"
    >
      {loading ? (
        <div className="min-h-screen w-full flex flex-col items-center justify-center p-8 space-y-4 bg-[#0E0E0E]">
          <div className="w-10 h-10 rounded-xl bg-white/10 animate-pulse flex items-center justify-center text-white">
            <FileText size={20} />
          </div>
          <div className="space-y-2 w-full max-w-md">
            <div className="h-4 bg-white/10 rounded-md animate-pulse w-3/4 mx-auto" />
            <div className="h-3 bg-white/5 rounded-md animate-pulse w-1/2 mx-auto" />
          </div>
        </div>
      ) : error ? (
        <div className="min-h-screen w-full flex items-center justify-center p-6 bg-[#0E0E0E]">
          <div className="max-w-md w-full bg-[#161616] border border-white/15 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mx-auto text-white">
              <AlertCircle size={24} />
            </div>
            <h2 className="text-base font-semibold text-white">Document Unavailable</h2>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{error}</p>
            <div className="pt-2 text-[10px] font-mono text-[var(--text-muted)]">
              Teader Shared Documentation
            </div>
          </div>
        </div>
      ) : doc ? (
        <main className="flex-1 w-full overflow-y-auto px-6 py-12 sm:px-12 custom-scrollbar">
          <div
            className="max-w-3xl mx-auto space-y-4 text-[var(--text-secondary)] font-sans origin-top transition-all duration-75"
            style={{ zoom: previewZoom }}
          >
            <div className="py-2 text-[16px] leading-[1.7] text-[var(--text-secondary)]">
              {renderedContent}
            </div>
          </div>

          {/* Floating Zoom Indicator & Controls Pill */}
          <div className="fixed bottom-6 right-6 flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#181818]/90 backdrop-blur-md border border-[var(--border-primary)] shadow-2xl text-xs font-mono select-none z-30">
            <button
              onClick={() => updatePreviewZoom((z) => z - 0.1)}
              className="p-1 rounded text-[var(--text-muted)] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Zoom Out (Ctrl + Wheel Down or Ctrl + -)"
            >
              <Minus size={11} />
            </button>
            <button
              onClick={() => updatePreviewZoom(1)}
              className={`px-1.5 py-0.5 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                previewZoom !== 1 ? 'text-white hover:bg-white/5' : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
              title="Reset Zoom to 100% (Click or Ctrl + 0)"
            >
              {Math.round(previewZoom * 100)}%
            </button>
            <button
              onClick={() => updatePreviewZoom((z) => z + 0.1)}
              className="p-1 rounded text-[var(--text-muted)] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Zoom In (Ctrl + Wheel Up or Ctrl + +)"
            >
              <Plus size={11} />
            </button>
          </div>
        </main>
      ) : null}
    </div>
  );
}
