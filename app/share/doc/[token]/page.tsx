'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
  FileText,
  Copy,
  Check,
  AlertCircle,
  ExternalLink,
  Printer,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Calendar,
  Folder,
  Eye,
  CheckCheck,
  Share2,
} from 'lucide-react';
import { renderGithubMarkdown } from '@/components/ui/MarkdownRenderer';
import { toast } from 'sonner';

interface SharedDocData {
  id: string;
  title: string;
  fileName: string;
  folder?: string;
  content: string;
  createdAt?: string;
  updatedAt?: string;
}

interface SharedDocMeta {
  expiresAt: string | null;
  createdAt: string;
}

export default function PublicDocSharePage() {
  const params = useParams();
  const token = params?.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [doc, setDoc] = useState<SharedDocData | null>(null);
  const [shareMeta, setShareMeta] = useState<SharedDocMeta | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedContent, setCopiedContent] = useState(false);
  const [previewZoom, setPreviewZoom] = useState<number>(1);

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
          setShareMeta(data.share);
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
  const updateZoom = useCallback((delta: number | ((prev: number) => number)) => {
    setPreviewZoom((prev) => {
      const next = typeof delta === 'function' ? delta(prev) : prev + delta;
      return Math.min(2.0, Math.max(0.6, Number(next.toFixed(2))));
    });
  }, []);

  // Copy share link
  const handleCopyLink = useCallback(() => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    toast.success('Link copied to clipboard');
    setTimeout(() => setCopiedLink(false), 2000);
  }, []);

  // Copy raw markdown
  const handleCopyMarkdown = useCallback(() => {
    if (!doc?.content) return;
    navigator.clipboard.writeText(doc.content);
    setCopiedContent(true);
    toast.success('Document markdown copied');
    setTimeout(() => setCopiedContent(false), 2000);
  }, [doc]);

  // Print document
  const handlePrint = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.print();
  }, []);

  // Formatted date string
  const formattedUpdated = useMemo(() => {
    if (!doc?.updatedAt) return null;
    try {
      return new Date(doc.updatedAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return null;
    }
  }, [doc?.updatedAt]);

  // Render markdown content
  const renderedContent = useMemo(() => {
    if (!doc?.content) return null;
    return renderGithubMarkdown(doc.content);
  }, [doc?.content]);

  return (
    <div className="min-h-screen w-full bg-[#0E0E0E] text-[var(--text-primary)] flex flex-col font-sans select-text">
      {/* ── Top Header Navigation Bar ─────────────────────────────── */}
      <header className="sticky top-0 left-0 right-0 h-13 px-4 sm:px-6 bg-[#141414]/95 backdrop-blur-md border-b border-white/10 z-30 flex items-center justify-between shrink-0">
        {/* Left: Teader Logo + Document Title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-6 h-6 rounded bg-white text-black font-mono font-bold text-xs flex items-center justify-center shadow shrink-0">
            T
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-xs sm:text-sm font-semibold text-white truncate max-w-[220px] sm:max-w-md">
              {doc?.title || 'Shared Document'}
            </h1>
            {doc?.folder && (
              <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 text-[var(--text-muted)] border border-white/5">
                <Folder size={10} />
                <span>{doc.folder}</span>
              </span>
            )}
          </div>
        </div>

        {/* Right: Actions & Read-Only Badge */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Zoom Controls */}
          <div className="hidden sm:flex items-center gap-0.5 bg-[#1F1F1F] border border-white/10 rounded-lg p-0.5 text-xs font-mono">
            <button
              onClick={() => updateZoom((z) => z - 0.1)}
              className="p-1.5 rounded hover:bg-white/10 text-[var(--text-muted)] hover:text-white transition-colors cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut size={12} />
            </button>
            <button
              onClick={() => setPreviewZoom(1)}
              className="px-1.5 py-0.5 rounded text-[11px] font-semibold text-white hover:bg-white/5 transition-colors cursor-pointer"
              title="Reset Zoom (100%)"
            >
              {Math.round(previewZoom * 100)}%
            </button>
            <button
              onClick={() => updateZoom((z) => z + 0.1)}
              className="p-1.5 rounded hover:bg-white/10 text-[var(--text-muted)] hover:text-white transition-colors cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn size={12} />
            </button>
          </div>

          {/* Copy Markdown */}
          {doc && (
            <button
              onClick={handleCopyMarkdown}
              className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-[var(--text-secondary)] hover:text-white transition-colors border border-white/10 cursor-pointer"
              title="Copy Raw Markdown"
            >
              {copiedContent ? <Check size={13} className="text-white" /> : <Copy size={13} />}
              <span className="text-[11px] font-medium">{copiedContent ? 'Copied' : 'Raw'}</span>
            </button>
          )}

          {/* Print Document */}
          {doc && (
            <button
              onClick={handlePrint}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[var(--text-muted)] hover:text-white transition-colors border border-white/10 cursor-pointer"
              title="Print / Save to PDF"
            >
              <Printer size={14} />
            </button>
          )}

          {/* Copy Link */}
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black hover:bg-white/90 text-xs font-semibold shadow-sm transition-all cursor-pointer"
            title="Copy Share Link"
          >
            {copiedLink ? <CheckCheck size={13} /> : <Share2 size={13} />}
            <span>{copiedLink ? 'Copied Link' : 'Copy Link'}</span>
          </button>

          {/* Read Only Pill */}
          <div className="px-2.5 py-1 rounded-md bg-white/10 text-white text-[11px] font-mono border border-white/10">
            Read-Only
          </div>
        </div>
      </header>

      {/* ── Main View Area ────────────────────────────────────────── */}
      <main className="flex-1 min-h-0 flex flex-col overflow-y-auto">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-white/10 animate-pulse flex items-center justify-center text-white">
              <FileText size={20} />
            </div>
            <div className="space-y-2 w-full max-w-md">
              <div className="h-4 bg-white/10 rounded-md animate-pulse w-3/4 mx-auto" />
              <div className="h-3 bg-white/5 rounded-md animate-pulse w-1/2 mx-auto" />
            </div>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center p-6">
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
          <div className="flex-1 flex flex-col items-center w-full py-8 px-4 sm:px-8">
            <article
              className="w-full max-w-4xl bg-[#121212] border border-white/10 rounded-2xl p-6 sm:p-12 shadow-2xl transition-transform origin-top"
              style={{
                transform: previewZoom !== 1 ? `scale(${previewZoom})` : undefined,
              }}
            >
              {/* Document Metadata Header */}
              <header className="border-b border-white/10 pb-6 mb-8 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-[var(--text-muted)]">
                  {doc.folder && (
                    <span className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded text-white/80">
                      <Folder size={11} />
                      <span>{doc.folder}</span>
                    </span>
                  )}
                  {formattedUpdated && (
                    <span className="flex items-center gap-1">
                      <Calendar size={11} />
                      <span>Updated {formattedUpdated}</span>
                    </span>
                  )}
                  <span className="text-white/40">•</span>
                  <span className="text-white/60">Public Document</span>
                  {shareMeta?.expiresAt && (
                    <>
                      <span className="text-white/40">•</span>
                      <span className="text-white/80">
                        Expires {new Date(shareMeta.expiresAt).toLocaleDateString()}
                      </span>
                    </>
                  )}
                </div>

                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight pt-1">
                  {doc.title}
                </h1>
              </header>

              {/* Rendered Markdown Body */}
              <div className="markdown-body text-sm leading-relaxed text-[var(--text-primary)]">
                {renderedContent}
              </div>

              {/* Document Footer */}
              <footer className="mt-16 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] font-mono text-[var(--text-muted)] select-none">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-white text-black font-mono font-bold text-[9px] flex items-center justify-center">
                    T
                  </div>
                  <span>Published with Teader Documentation</span>
                </div>
                <div>{doc.fileName}</div>
              </footer>
            </article>
          </div>
        ) : null}
      </main>
    </div>
  );
}
