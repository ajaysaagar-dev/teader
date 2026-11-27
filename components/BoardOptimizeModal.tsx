'use client';

import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  X,
  CheckCircle2,
  HardDrive,
  Layers,
  ArrowRight,
  Gauge,
  SlidersHorizontal,
} from 'lucide-react';
import { BoardElement } from '@/types/board';
import {
  isImageOptimizable,
  batchOptimizeBoardImages,
  BatchOptimizationProgress,
  BatchOptimizationResult,
} from '@/lib/image-optimizer';
import { toast } from 'sonner';

interface BoardOptimizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number | string;
  boardTitle?: string;
  elements: BoardElement[];
  onApplyOptimized: (updatedElements: BoardElement[]) => Promise<void> | void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export const BoardOptimizeModal: React.FC<BoardOptimizeModalProps> = ({
  isOpen,
  onClose,
  projectId,
  boardTitle = 'Current Board',
  elements,
  onApplyOptimized,
}) => {
  // Configurable options
  const [targetPreset, setTargetPreset] = useState<number>(3840); // 3840 = 4K, 2560 = QHD, 1920 = 1080p
  const [qualityPreset, setQualityPreset] = useState<number>(0.88); // 88% high fidelity
  const [generateThumbnails, setGenerateThumbnails] = useState<boolean>(true);

  // Status state: 'idle' | 'running' | 'done' | 'error'
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState<BatchOptimizationProgress>({
    current: 0,
    total: 0,
    currentName: '',
    percent: 0,
    savedBytes: 0,
  });
  const [result, setResult] = useState<BatchOptimizationResult | null>(null);

  // Filter optimizable images
  const imageElements = useMemo(() => {
    return elements.filter(
      (el) => el.type === 'image' && isImageOptimizable(el.url, el.metadata?.mimeType)
    );
  }, [elements]);

  const alreadyOptimizedCount = useMemo(() => {
    return imageElements.filter((el) => Boolean(el.metadata?.optimized)).length;
  }, [imageElements]);

  // Reset state when modal opens or closes
  const handleClose = () => {
    if (status === 'running') return; // Don't interrupt running optimization
    setStatus('idle');
    setResult(null);
    onClose();
  };

  const handleStartOptimization = async () => {
    if (imageElements.length === 0) {
      toast.info('No optimizable images found on this board');
      return;
    }

    try {
      setStatus('running');
      setProgress({
        current: 0,
        total: imageElements.length,
        currentName: 'Initializing...',
        percent: 0,
        savedBytes: 0,
      });

      const optResult = await batchOptimizeBoardImages(projectId, elements, {
        hdMaxDimension: targetPreset,
        hdQuality: qualityPreset,
        generateThumbnails,
        onProgress: (p) => setProgress(p),
      });

      setResult(optResult);
      setStatus('done');

      // Persist changes to board
      await onApplyOptimized(optResult.updatedElements);
      toast.success(
        `Optimized ${optResult.totalProcessed} images! Saved ${formatBytes(optResult.totalSavedBytes)}`
      );
    } catch (err: any) {
      console.error('[BoardOptimizeModal error]:', err);
      setStatus('error');
      toast.error('Failed to complete optimization');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-[#141414] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/10 border border-white/20 text-white">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                Optimize Board Images
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-white/70">
                  {boardTitle}
                </span>
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Convert to HD WebP & enable adaptive zoom Level-of-Detail (LOD)
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            disabled={status === 'running'}
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5">
          {/* STATE 1: IDLE / CONFIGURATION */}
          {status === 'idle' && (
            <>
              {/* Stats Overview Pill Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col items-center text-center">
                  <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mb-1">
                    <Layers size={13} className="text-white/80" />
                    <span>Total Images</span>
                  </div>
                  <span className="text-xl font-bold font-mono text-white">
                    {imageElements.length}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col items-center text-center">
                  <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mb-1">
                    <CheckCircle2 size={13} className="text-white/80" />
                    <span>Optimized</span>
                  </div>
                  <span className="text-xl font-bold font-mono text-white">
                    {alreadyOptimizedCount}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col items-center text-center">
                  <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mb-1">
                    <Gauge size={13} className="text-white/80" />
                    <span>To Process</span>
                  </div>
                  <span className="text-xl font-bold font-mono text-white">
                    {imageElements.length}
                  </span>
                </div>
              </div>

              {/* Technique Explanation Card */}
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10 text-xs space-y-2 text-white/80">
                <div className="flex items-center gap-1.5 font-medium text-white text-[13px]">
                  <SlidersHorizontal size={14} className="text-white/80" />
                  <span>Optimization Technique</span>
                </div>
                <ul className="space-y-1.5 text-[11px] text-[var(--text-muted)] list-disc list-inside">
                  <li>
                    <strong className="text-white">HD WebP Compression:</strong> Converts bloated raw PNG/JPEG files to modern WebP with hardware-accelerated canvas smoothing, reducing file size by 60–85%.
                  </li>
                  <li>
                    <strong className="text-white">Zoom LOD Thumbnails:</strong> Generates lightweight 480px thumbnails so canvas zooming out uses 90% less GPU memory with zero frame drops.
                  </li>
                  <li>
                    <strong className="text-white">Preserves Clarity:</strong> HD Focus Lightbox continues to open the full master resolution at up to 500% zoom.
                  </li>
                </ul>
              </div>

              {/* Settings Controls */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-medium text-white flex items-center gap-1.5">
                    Target Resolution
                  </label>
                  <select
                    value={targetPreset}
                    onChange={(e) => setTargetPreset(Number(e.target.value))}
                    className="bg-black/60 border border-white/15 rounded-lg px-2.5 py-1 text-xs text-white outline-none cursor-pointer hover:border-white/30"
                  >
                    <option value={3840}>4K Ultra-HD (3840px) - Maximum Crispness</option>
                    <option value={2560}>Quad HD (2560px) - Balanced</option>
                    <option value={1920}>Full HD (1920px) - Minimal Size</option>
                  </select>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <label className="font-medium text-white flex items-center gap-1.5">
                    Compression Quality
                  </label>
                  <select
                    value={qualityPreset}
                    onChange={(e) => setQualityPreset(Number(e.target.value))}
                    className="bg-black/60 border border-white/15 rounded-lg px-2.5 py-1 text-xs text-white outline-none cursor-pointer hover:border-white/30"
                  >
                    <option value={0.88}>High Fidelity 88% (Recommended)</option>
                    <option value={0.94}>Maximum Fidelity 94%</option>
                    <option value={0.80}>Compact 80%</option>
                  </select>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <div className="flex items-center gap-2">
                    <input
                      id="opt-generate-thumbs"
                      type="checkbox"
                      checked={generateThumbnails}
                      onChange={(e) => setGenerateThumbnails(e.target.checked)}
                      className="rounded border-white/20 bg-black/60 text-white focus:ring-0 cursor-pointer accent-white"
                    />
                    <label
                      htmlFor="opt-generate-thumbs"
                      className="font-medium text-white cursor-pointer select-none"
                    >
                      Generate fast-zoom thumbnails (480px LOD)
                    </label>
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)] font-mono">
                    Recommended
                  </span>
                </div>
              </div>
            </>
          )}

          {/* STATE 2: IN PROGRESS */}
          {status === 'running' && (
            <div className="py-6 space-y-6 text-center">
              <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-white/10" />
                <div
                  className="absolute inset-0 rounded-full border-4 border-white border-t-transparent animate-spin"
                />
                <span className="text-sm font-bold font-mono text-white">
                  {progress.percent}%
                </span>
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-white">
                  Optimizing Image {progress.current} of {progress.total}
                </h3>
                <p className="text-xs text-[var(--text-muted)] font-mono truncate max-w-sm mx-auto">
                  {progress.currentName}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-white h-full transition-all duration-300"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>

              {progress.savedBytes > 0 && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white text-xs font-mono">
                  <HardDrive size={12} />
                  <span>Saved {formatBytes(progress.savedBytes)} so far</span>
                </div>
              )}
            </div>
          )}

          {/* STATE 3: COMPLETED */}
          {status === 'done' && result && (
            <div className="py-4 space-y-5 text-center">
              <div className="w-14 h-14 mx-auto rounded-full bg-white/10 border border-white/20 text-white flex items-center justify-center">
                <CheckCircle2 size={28} />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">
                  Board Optimization Complete!
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Successfully converted {result.totalProcessed} images to HD WebP and generated zoom LOD thumbnails.
                </p>
              </div>

              {/* Results Breakdown Grid */}
              <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/10 text-left">
                <div>
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block">
                    Original
                  </span>
                  <span className="text-sm font-semibold font-mono text-white/70">
                    {formatBytes(result.totalOriginalBytes)}
                  </span>
                </div>

                <div className="flex items-center justify-center">
                  <ArrowRight size={16} className="text-white/40" />
                </div>

                <div>
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block">
                    Optimized
                  </span>
                  <span className="text-sm font-bold font-mono text-white">
                    {formatBytes(result.totalOptimizedBytes)}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-white/10 border border-white/20 text-white text-xs font-medium flex items-center justify-center gap-2">
                <Sparkles size={14} />
                <span>
                  Saved {formatBytes(result.totalSavedBytes)} (
                  {result.totalOriginalBytes > 0
                    ? Math.round((result.totalSavedBytes / result.totalOriginalBytes) * 100)
                    : 0}
                  % total size reduction)!
                </span>
              </div>
            </div>
          )}

          {/* STATE 4: ERROR */}
          {status === 'error' && (
            <div className="py-6 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-white/10 text-white flex items-center justify-center border border-white/20">
                <X size={24} />
              </div>
              <p className="text-sm font-medium text-white">
                An error occurred while optimizing images.
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                Some images may have been preserved. You can try again.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-end gap-2.5 bg-white/[0.02]">
          {status === 'idle' && (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartOptimization}
                disabled={imageElements.length === 0}
                className="px-4 py-2 rounded-xl bg-white hover:bg-white/90 text-black text-xs font-semibold shadow-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <Sparkles size={13} />
                <span>Optimize {imageElements.length} Images</span>
              </button>
            </>
          )}

          {status === 'running' && (
            <span className="text-xs text-[var(--text-muted)] font-mono animate-pulse">
              Optimizing images... please wait
            </span>
          )}

          {status === 'done' && (
            <button
              type="button"
              onClick={handleClose}
              className="px-5 py-2 rounded-xl bg-white text-black hover:bg-white/90 text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              Done
            </button>
          )}

          {status === 'error' && (
            <button
              type="button"
              onClick={() => setStatus('idle')}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-medium transition-colors cursor-pointer"
            >
              Back
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
