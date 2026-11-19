'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Download,
  X,
  Crosshair,
  RotateCcw,
} from 'lucide-react';

interface BoardImageFocusModalProps {
  isOpen?: boolean;
  imageUrl: string;
  title?: string;
  onClose: () => void;
  onFocusOnCanvas?: () => void;
  onFocusInViewport?: () => void;
}

export const BoardImageFocusModal: React.FC<BoardImageFocusModalProps> = ({
  isOpen = true,
  imageUrl,
  title = 'Image',
  onClose,
  onFocusOnCanvas,
  onFocusInViewport,
}) => {
  const handleFocus = onFocusInViewport || onFocusOnCanvas;
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number } | null>(null);

  const dragStartRef = useRef<{ startX: number; startY: number; initialPanX: number; initialPanY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset zoom and pan on open
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, [isOpen, imageUrl]);

  // Load natural dimensions of image
  const handleImageLoaded = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalDimensions({
      width: img.naturalWidth,
      height: img.naturalHeight,
    });
  };

  // Zoom helpers
  const zoomIn = useCallback(() => {
    setZoom((prev) => Math.min(5.0, Number((prev + 0.25).toFixed(2))));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((prev) => Math.max(0.25, Number((prev - 0.25).toFixed(2))));
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Keyboard controls
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        zoomIn();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        zoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        resetZoom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, zoomIn, zoomOut, resetZoom]);

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.85;
    setZoom((prev) => Math.min(5.0, Math.max(0.25, Number((prev * factor).toFixed(2)))));
  };

  // Mouse drag panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialPanX: pan.x,
      initialPanY: pan.y,
    };
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;
    setPan({
      x: dragStartRef.current.initialPanX + dx,
      y: dragStartRef.current.initialPanY + dy,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    dragStartRef.current = null;
  };

  // Download high-resolution source image
  const handleDownload = () => {
    if (!imageUrl) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = title || 'high-res-image';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!isOpen || !imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/92 backdrop-blur-md select-none animate-in fade-in duration-200"
      onWheel={handleWheel}
      onMouseUp={handleMouseUp}
    >
      {/* Top Header Controls Bar */}
      <header className="h-14 px-5 border-b border-white/10 bg-[#121212]/90 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs font-semibold text-white truncate max-w-[280px] sm:max-w-[400px]">
            {title}
          </span>
          {naturalDimensions && (
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded bg-white/10 text-[10px] font-mono text-white/80">
              {naturalDimensions.width} × {naturalDimensions.height} px
            </span>
          )}
          <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded bg-white/10 text-white/90 border border-white/20 text-[10px] font-mono">
            Full HD Mode
          </span>
        </div>

        {/* Center / Right Toolbar Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Zoom Out */}
          <button
            onClick={zoomOut}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Zoom Out (-)"
          >
            <ZoomOut size={16} />
          </button>

          {/* Zoom Percentage */}
          <button
            onClick={resetZoom}
            className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium text-white/90 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer min-w-[58px] text-center"
            title="Reset to 100% (0)"
          >
            {Math.round(zoom * 100)}%
          </button>

          {/* Zoom In */}
          <button
            onClick={zoomIn}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Zoom In (+)"
          >
            <ZoomIn size={16} />
          </button>

          {/* Reset View */}
          <button
            onClick={resetZoom}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Reset Pan & Zoom (0)"
          >
            <RotateCcw size={15} />
          </button>

          <div className="h-4 w-px bg-white/15 mx-1" />

          {/* Focus On Canvas Option */}
          {handleFocus && (
            <button
              onClick={() => {
                handleFocus();
                onClose();
              }}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-medium border border-white/15 transition-all cursor-pointer"
              title="Focus and frame image on the canvas board"
            >
              <Crosshair size={13} />
              <span>Frame on Canvas</span>
            </button>
          )}

          {/* Download Original */}
          <button
            onClick={handleDownload}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Download Original High-Res Image"
          >
            <Download size={16} />
          </button>

          {/* Close Modal */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/15 transition-colors cursor-pointer ml-1"
            title="Close Focus View (Esc)"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {/* Main Pan/Zoom High-Resolution Viewport Canvas */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        className={`flex-1 relative overflow-hidden flex items-center justify-center p-4 sm:p-8 ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.12s ease-out',
          }}
          className="max-w-full max-h-full flex items-center justify-center select-none"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={title}
            onLoad={handleImageLoaded}
            draggable={false}
            loading="eager"
            decoding="sync"
            className="max-w-[90vw] max-h-[82vh] object-contain rounded-md shadow-2xl pointer-events-none select-none ring-1 ring-white/10"
            style={{
              imageRendering: '-webkit-optimize-contrast',
            }}
          />
        </div>

        {/* Floating Bottom Navigation Hint */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/75 backdrop-blur-md border border-white/15 text-[11px] font-mono text-white/70 pointer-events-none select-none shadow-xl">
          <span>Drag to Pan</span>
          <span className="text-white/30">•</span>
          <span>Scroll to Zoom</span>
          <span className="text-white/30">•</span>
          <span>Esc to Close</span>
        </div>
      </div>
    </div>
  );
};
