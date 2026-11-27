'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Maximize2, Crosshair, Image as ImageIcon, Sparkles } from 'lucide-react';
import { BoardElement } from '@/types/board';

interface BoardAdaptiveImageProps {
  element: BoardElement;
  currentZoom: number;
  onFocusHD: () => void;
  onFrameCanvas: () => void;
  isUploading?: boolean;
}

/**
 * Adaptive Image Component for Canvas Board
 * 
 * Performance features:
 * - Zoom-based Level-of-Detail (LOD): Automatically swaps to compact 480px WebP thumbnail
 *   when zoomed out (< 0.55), saving huge amounts of GPU memory and maintaining 60 FPS.
 * - Hysteresis threshold (0.55 / 0.65) to eliminate rapid flickering at boundaries.
 * - Progressive loading: thumbnail stays visible beneath while HD image decodes asynchronously.
 * - Master HD Focus integration: inspect needle-sharp pixels up to 500% in lightbox.
 */
export const BoardAdaptiveImage: React.FC<BoardAdaptiveImageProps> = ({
  element,
  currentZoom,
  onFocusHD,
  onFrameCanvas,
  isUploading = false,
}) => {
  const masterUrl = element.url || (element.metadata as any)?.dataUrl || '';
  const thumbUrl = element.thumbnailUrl || (element.metadata as any)?.thumbnailUrl || '';
  const hasThumbnail = Boolean(thumbUrl);

  // Initial resolution mode based on initial zoom
  const [isHdMode, setIsHdMode] = useState<boolean>(() => {
    if (!hasThumbnail) return true;
    return currentZoom >= 0.6;
  });

  const [isHdLoaded, setIsHdLoaded] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);

  // Hysteresis calculation to prevent toggle flutter
  useEffect(() => {
    if (!hasThumbnail) {
      if (!isHdMode) setIsHdMode(true);
      return;
    }

    if (isHdMode && currentZoom < 0.55) {
      setIsHdMode(false);
    } else if (!isHdMode && currentZoom >= 0.65) {
      setIsHdMode(true);
    }
  }, [currentZoom, hasThumbnail, isHdMode]);

  // Pre-decode HD image in background when switching to HD mode
  useEffect(() => {
    if (isHdMode && masterUrl && !isHdLoaded) {
      const img = new Image();
      img.src = masterUrl;
      img.decode()
        .then(() => setIsHdLoaded(true))
        .catch(() => setIsHdLoaded(true)); // Display even if decode() fails
    }
  }, [isHdMode, masterUrl, isHdLoaded]);

  // Active display image
  const displaySrc = isHdMode && isHdLoaded
    ? masterUrl
    : (hasThumbnail ? thumbUrl : masterUrl);

  const isOptimized = Boolean(element.metadata?.optimized);

  return (
    <div
      onDoubleClick={(e) => {
        e.stopPropagation();
        onFocusHD();
      }}
      className="w-full h-full rounded-lg overflow-hidden bg-[#171717] border border-white/10 flex flex-col shadow-lg relative group/img cursor-pointer select-none"
    >
      {/* Top Action Toolbar on Hover */}
      <div className="absolute top-2 left-2 z-20 flex items-center gap-1 opacity-0 group-hover/img:opacity-100 transition-opacity bg-black/85 backdrop-blur-md rounded-lg p-1 border border-white/15 shadow-xl">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onFocusHD();
          }}
          className="px-2 py-1 flex items-center gap-1 rounded text-[11px] font-medium text-white hover:bg-white/20 transition-colors"
          title="Open HD Lightbox (Inspect pixels up to 500%)"
        >
          <Maximize2 size={12} />
          <span>HD Focus</span>
        </button>
        <div className="w-[1px] h-3 bg-white/20" />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onFrameCanvas();
          }}
          className="px-2 py-1 flex items-center gap-1 rounded text-[11px] font-medium text-white hover:bg-white/20 transition-colors"
          title="Center & frame on board viewport"
        >
          <Crosshair size={12} />
          <span>Frame</span>
        </button>
      </div>

      {/* Top Right Badges: Uploading / Resolution Indicator */}
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5 pointer-events-none select-none">
        {isUploading && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/75 backdrop-blur-md border border-white/20 text-[10px] text-white shadow-lg animate-pulse">
            <span className="w-2 h-2 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            <span className="font-mono text-[9px] uppercase tracking-wider">Syncing</span>
          </div>
        )}

        {/* Adaptive LOD Resolution Pill on hover */}
        <div className="opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-md border border-white/15 text-[10px] font-mono text-white/80 shadow">
          {isHdMode ? (
            <span className="text-white font-semibold">HD</span>
          ) : (
            <span className="text-white/70 font-semibold">LOD</span>
          )}
          {isOptimized && <Sparkles size={10} className="text-white/80" />}
        </div>
      </div>

      {/* Image Container with Progressive Dual-Layer Rendering */}
      <div className="flex-1 w-full h-full relative overflow-hidden bg-black/40 flex items-center justify-center p-1">
        {/* Layer 1: Lightweight thumbnail (always present underneath to prevent white flash) */}
        {hasThumbnail && !isHdLoaded && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl}
            alt={element.title || 'Image thumbnail'}
            loading="eager"
            decoding="async"
            style={{
              imageRendering: 'auto',
              filter: isHdMode ? 'blur(2px)' : 'none',
              transform: 'scale(1.01)',
            }}
            className="w-full h-full object-contain select-none pointer-events-none absolute inset-0 transition-all duration-200"
          />
        )}

        {/* Layer 2: Active image (Master HD or active LOD) */}
        {!hasError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displaySrc}
            alt={element.title || 'Image'}
            loading="lazy"
            decoding="async"
            style={{
              imageRendering: isHdMode ? '-webkit-optimize-contrast' : 'auto',
            }}
            className="w-full h-full object-contain select-none pointer-events-none transition-opacity duration-200"
            onError={() => {
              const fallback = (element.metadata as any)?.dataUrl;
              if (fallback && displaySrc !== fallback) {
                // Try dataUrl fallback
              } else {
                setHasError(true);
              }
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-3 text-white/50 w-full h-full">
            <ImageIcon size={26} className="mb-2 text-white/40" />
            <span className="text-xs font-mono text-white/70 truncate max-w-[90%]">
              {element.title || 'Image'}
            </span>
            <span className="text-[10px] text-white/40 mt-1">Image preview unavailable</span>
          </div>
        )}
      </div>
    </div>
  );
};
