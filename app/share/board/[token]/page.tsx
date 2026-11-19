'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Crosshair,
  Music,
  Video as VideoIcon,
  ExternalLink,
  Play,
  Pause,
  AlertCircle,
  Layers,
  StickyNote as StickyIcon,
  Image as ImageIcon,
} from 'lucide-react';
import { BoardElement, BoardGroup, BoardViewport, BoardData } from '@/types/board';
import { isElementInViewport, getGroupBoundingBox } from '@/lib/board-snap';
import { BoardImageFocusModal } from '@/components/BoardImageFocusModal';

export default function PublicBoardSharePage() {
  const params = useParams();
  const token = params?.token as string;

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [boardTitle, setBoardTitle] = useState('Shared Canvas Board');
  const [elements, setElements] = useState<BoardElement[]>([]);
  const [groups, setGroups] = useState<BoardGroup[]>([]);
  const [viewport, setViewport] = useState<BoardViewport>({ x: 40, y: 30, zoom: 0.9 });
  const [canvasDimensions, setCanvasDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1920,
    height: typeof window !== 'undefined' ? window.innerHeight : 1080,
  });
  const [isPanning, setIsPanning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState<Record<string, { current: number; duration: number }>>({});
  const audioElementsRef = useRef<Record<string, HTMLAudioElement>>({});
  const [focusedImage, setFocusedImage] = useState<{ url: string; title: string; element?: BoardElement } | null>(null);

  // Smooth animated viewport transition
  const animateViewportTo = useCallback((target: BoardViewport, duration = 280) => {
    const startX = viewport.x;
    const startY = viewport.y;
    const startZoom = viewport.zoom;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - progress, 3); // ease-out cubic

      const curX = startX + (target.x - startX) * ease;
      const curY = startY + (target.y - startY) * ease;
      const curZoom = startZoom + (target.zoom - startZoom) * ease;

      setViewport({ x: curX, y: curY, zoom: curZoom });

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  }, [viewport]);

  // Focus and center on element in crisp high resolution
  const handleFocusElement = useCallback((element: BoardElement) => {
    const screenW = containerRef.current?.clientWidth || canvasDimensions.width;
    const screenH = containerRef.current?.clientHeight || canvasDimensions.height;

    const pad = 80;
    const availW = Math.max(100, screenW - pad * 2);
    const availH = Math.max(100, screenH - pad * 2);

    const fitZoom = Math.min(availW / Math.max(10, element.width), availH / Math.max(10, element.height));
    const targetZoom = Math.min(2.5, Math.max(0.35, Number(fitZoom.toFixed(2))));

    const targetX = Math.round((screenW - element.width * targetZoom) / 2 - element.x * targetZoom);
    const targetY = Math.round((screenH - element.height * targetZoom) / 2 - element.y * targetZoom);

    animateViewportTo({ x: targetX, y: targetY, zoom: targetZoom });
  }, [canvasDimensions, animateViewportTo]);

  const fitElementsToScreen = useCallback((elems: BoardElement[], grps: BoardGroup[], width: number, height: number) => {
    if ((!elems || elems.length === 0) && (!grps || grps.length === 0)) {
      setViewport({ x: width / 2, y: height / 2, zoom: 1 });
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const el of elems || []) {
      if (el.x < minX) minX = el.x;
      if (el.y < minY) minY = el.y;
      if (el.x + el.width > maxX) maxX = el.x + el.width;
      if (el.y + el.height > maxY) maxY = el.y + el.height;
    }

    for (const g of grps || []) {
      if (g.x !== undefined && g.y !== undefined) {
        if (g.x < minX) minX = g.x;
        if (g.y < minY) minY = g.y;
        if (g.width && g.x + g.width > maxX) maxX = g.x + g.width;
        if (g.height && g.y + g.height > maxY) maxY = g.y + g.height;
      }
    }

    if (!isFinite(minX) || !isFinite(maxX)) {
      setViewport({ x: width / 2, y: height / 2, zoom: 1 });
      return;
    }

    const contentW = Math.max(maxX - minX, 100);
    const contentH = Math.max(maxY - minY, 100);
    const padding = 80;
    const headerHeight = 52;

    const availW = Math.max(width - padding * 2, 200);
    const availH = Math.max(height - padding * 2 - headerHeight, 200);

    const scaleX = availW / contentW;
    const scaleY = availH / contentH;
    const nextZoom = Math.min(1.4, Math.max(0.2, Math.min(scaleX, scaleY)));

    const nextX = (width - contentW * nextZoom) / 2 - minX * nextZoom;
    const nextY = (height + headerHeight - contentH * nextZoom) / 2 - minY * nextZoom;

    setViewport({ x: nextX, y: nextY, zoom: nextZoom });
  }, []);

  // ── Fetch Shared Board Data ──
  useEffect(() => {
    if (!token) return;
    const fetchSharedBoard = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/share/board/${token}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          if (res.status === 410) {
            setError('This shared board link has expired.');
          } else {
            setError(err.error || 'Shared board not found or link has expired.');
          }
          return;
        }

        const json = await res.json();
        const b = json.board;
        setBoardTitle(b.title || 'Shared Canvas Board');
        const data: BoardData = b.data || { elements: [], groups: [], viewport: { x: 40, y: 30, zoom: 0.9 } };
        const boardElems = data.elements || [];
        const boardGroups = data.groups || [];
        setElements(boardElems);
        setGroups(boardGroups);

        const w = typeof window !== 'undefined' ? window.innerWidth : 1920;
        const h = typeof window !== 'undefined' ? window.innerHeight : 1080;
        setCanvasDimensions({ width: w, height: h });

        // Auto-fit board elements into full screen view on open
        if (boardElems.length > 0 || boardGroups.length > 0) {
          fitElementsToScreen(boardElems, boardGroups, w, h);
        } else if (data.viewport && data.viewport.zoom >= 0.25) {
          setViewport(data.viewport);
        } else {
          setViewport({ x: w / 2, y: h / 2, zoom: 1 });
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load shared board');
      } finally {
        setLoading(false);
      }
    };

    fetchSharedBoard();
  }, [token, fitElementsToScreen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleBrowserFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  // ── Track Dimensions ──
  useEffect(() => {
    const updateDimensions = () => {
      const w = containerRef.current?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1920);
      const h = containerRef.current?.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 1080);
      setCanvasDimensions({
        width: Math.max(300, w),
        height: Math.max(300, h),
      });
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // ── Mouse Wheel Zoom Controller (Direct Zoom with Wheel) ──
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const nextZoom = Math.min(5.0, Math.max(0.15, viewport.zoom * zoomFactor));

    const rect = containerRef.current?.getBoundingClientRect();
    const mouseX = rect ? e.clientX - rect.left : canvasDimensions.width / 2;
    const mouseY = rect ? e.clientY - rect.top : canvasDimensions.height / 2;

    const nextX = mouseX - (mouseX - viewport.x) * (nextZoom / viewport.zoom);
    const nextY = mouseY - (mouseY - viewport.y) * (nextZoom / viewport.zoom);

    setViewport({ x: nextX, y: nextY, zoom: nextZoom });
  };

  // ── Canvas Pan Interaction ──
  const panStartRef = useRef<{ startX: number; startY: number; vX: number; vY: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Left click (0), middle click (1), or right click (2) all pan in presentation read-only view
    if (e.button === 0 || e.button === 1 || e.button === 2) {
      panStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        vX: viewport.x,
        vY: viewport.y,
      };
      setIsPanning(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const pan = panStartRef.current;
    if (pan) {
      const dx = e.clientX - pan.startX;
      const dy = e.clientY - pan.startY;
      const targetX = pan.vX + dx;
      const targetY = pan.vY + dy;
      setViewport((prev) => ({
        ...prev,
        x: targetX,
        y: targetY,
      }));
    }
  };

  const handleMouseUp = () => {
    panStartRef.current = null;
    setIsPanning(false);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      panStartRef.current = null;
      setIsPanning(false);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // ── Viewport Culling Optimization ──
  const visibleElements = useMemo(() => {
    return elements.filter((elem) =>
      isElementInViewport(elem, viewport, canvasDimensions.width, canvasDimensions.height, 120)
    );
  }, [elements, viewport, canvasDimensions]);

  // ── Render Infinite Dot Grid on Canvas Background (Ultra-optimized) ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasDimensions.width * dpr;
    canvas.height = canvasDimensions.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#0F0F0F';
    ctx.fillRect(0, 0, canvasDimensions.width, canvasDimensions.height);

    const zoom = viewport.zoom;
    if (zoom > 0.18) {
      ctx.fillStyle = zoom > 0.4 ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.05)';
      const dotRadius = Math.max(1, 1.2 * Math.min(zoom, 1.5));

      // Adaptive grid spacing (Miro style): dots never closer than 22px
      let worldStep = 20;
      while (worldStep * zoom < 22) {
        worldStep *= 2;
      }
      const step = worldStep * zoom;
      const offsetX = ((viewport.x % step) + step) % step;
      const offsetY = ((viewport.y % step) + step) % step;

      // Single beginPath + single fill for 60fps rendering
      ctx.beginPath();
      for (let x = offsetX; x < canvasDimensions.width; x += step) {
        for (let y = offsetY; y < canvasDimensions.height; y += step) {
          ctx.moveTo(x + dotRadius, y);
          ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
        }
      }
      ctx.fill();
    }
  }, [canvasDimensions, viewport]);

  // ── Audio Playback ──
  const toggleAudioPlay = (elementId: string, url?: string) => {
    if (!url) return;
    let audio = audioElementsRef.current[elementId];
    if (!audio) {
      audio = new Audio(url);
      audioElementsRef.current[elementId] = audio;

      audio.ontimeupdate = () => {
        setAudioProgress((prev) => ({
          ...prev,
          [elementId]: { current: audio.currentTime, duration: audio.duration || 1 },
        }));
      };

      audio.onended = () => {
        setActiveAudioId(null);
      };
    }

    if (activeAudioId === elementId) {
      audio.pause();
      setActiveAudioId(null);
    } else {
      if (activeAudioId && audioElementsRef.current[activeAudioId]) {
        audioElementsRef.current[activeAudioId].pause();
      }
      audio.play().catch(() => {});
      setActiveAudioId(elementId);
    }
  };

  // Fit to Content
  const handleFitView = () => {
    if (elements.length === 0) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const el of elements) {
      if (el.x < minX) minX = el.x;
      if (el.y < minY) minY = el.y;
      if (el.x + el.width > maxX) maxX = el.x + el.width;
      if (el.y + el.height > maxY) maxY = el.y + el.height;
    }

    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const padding = 100;

    const scaleX = (canvasDimensions.width - padding * 2) / Math.max(contentW, 100);
    const scaleY = (canvasDimensions.height - padding * 2) / Math.max(contentH, 100);
    const nextZoom = Math.min(1.8, Math.max(0.2, Math.min(scaleX, scaleY)));

    const nextX = (canvasDimensions.width - contentW * nextZoom) / 2 - minX * nextZoom;
    const nextY = (canvasDimensions.height - contentH * nextZoom) / 2 - minY * nextZoom;

    setViewport({ x: nextX, y: nextY, zoom: nextZoom });
  };

  // Group Bounding Boxes Map
  const groupBoxes = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getGroupBoundingBox>>();
    for (const g of groups) {
      const box = getGroupBoundingBox(g.id, elements, g);
      if (box) map.set(g.id, box);
    }
    return map;
  }, [groups, elements]);

  return (
    <div
      ref={containerRef}
      onContextMenu={(e) => e.preventDefault()}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className={`fixed inset-0 w-screen h-screen overflow-hidden select-none bg-[#0F0F0F] ${
        isPanning ? 'cursor-grabbing' : 'cursor-grab'
      }`}
    >
      {loading ? (
        <div className="absolute inset-0 z-50 bg-[#0F0F0F] flex flex-col items-center justify-center text-white space-y-3 font-sans">
          <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          <div className="text-xs font-mono text-[var(--text-muted)]">Loading shared canvas board...</div>
        </div>
      ) : error ? (
        <div className="absolute inset-0 z-50 bg-[#0F0F0F] flex flex-col items-center justify-center text-white p-6 font-sans">
          <div className="max-w-md w-full bg-[#171717] border border-white/10 rounded-xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mx-auto text-white">
              <AlertCircle size={24} />
            </div>
            <h1 className="text-lg font-semibold text-white">Link Unavailable</h1>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{error}</p>
            <div className="pt-2 text-[11px] font-mono text-[var(--text-muted)]">Teader Spatial Canvas</div>
          </div>
        </div>
      ) : (
        <>
          {/* Top Header Bar */}
      <header className="absolute top-0 left-0 right-0 h-12 px-4 bg-[#141414]/90 backdrop-blur-md border-b border-white/10 z-30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded bg-white text-black font-mono font-bold text-xs flex items-center justify-center shadow">
            T
          </div>
          <div className="min-w-0">
            <h1 className="text-xs font-semibold text-white truncate">{boardTitle}</h1>
            <div className="text-[10px] text-[var(--text-muted)] font-mono">Public Presentation View</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleBrowserFullscreen}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-white text-black hover:bg-white/90 text-xs font-semibold shadow-sm transition-all cursor-pointer"
            title="Toggle Fullscreen"
          >
            <Maximize2 size={12} />
            <span>{isFullscreen ? 'Exit Fullscreen' : 'Full Screen'}</span>
          </button>
          <div className="px-2.5 py-1 rounded bg-white/10 text-white text-[11px] font-mono">Read-Only</div>
        </div>
      </header>

      {/* HTML5 Canvas Background */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-auto"
        style={{ width: canvasDimensions.width, height: canvasDimensions.height }}
      />

      {/* Group Bounding Containers */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {groups.map((group) => {
          const box = groupBoxes.get(group.id);
          if (!box) return null;
          const groupColor = group.color || '#8400FF';
          return (
            <div
              key={group.id}
              className="absolute rounded-xl transition-colors"
              style={{
                left: box.x,
                top: box.y,
                width: box.width,
                height: box.height,
                borderColor: groupColor,
                borderWidth: '2px',
                borderStyle: 'dashed',
                backgroundColor: `${groupColor}08`,
              }}
            >
              <div
                className="absolute -top-3 left-4 flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] select-none"
                style={{
                  borderColor: `${groupColor}60`,
                  backgroundColor: '#171717',
                  color: groupColor,
                }}
              >
                <Layers size={11} />
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: groupColor }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Rendered Elements (Culled Off-Screen) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
          willChange: isPanning ? 'transform' : 'auto',
        }}
      >
        {visibleElements.map((element) => (
          <div
            key={element.id}
            style={{
              left: element.x,
              top: element.y,
              width: element.width,
              height: element.height,
              zIndex: element.zIndex || 10,
              transform: 'translateZ(0)',
            }}
            className="absolute pointer-events-auto rounded-lg shadow-lg"
          >
            {/* Sticky Note */}
            {element.type === 'sticky' && (
              <div
                style={{
                  backgroundColor: element.color || '#FFFFFF',
                  color: element.textColor || '#000000',
                  fontSize: element.fontSize ? `${element.fontSize}px` : '12px',
                  fontWeight: element.fontWeight || 'normal',
                  fontStyle: element.fontStyle || 'normal',
                  textAlign: element.textAlign || 'left',
                }}
                className="w-full h-full p-3.5 rounded-lg shadow-lg flex flex-col justify-between overflow-hidden"
              >
                <div className="flex items-center justify-between gap-1 pb-1 border-b border-black/10">
                  <span className="font-medium text-xs truncate select-none opacity-80">
                    {element.title || 'Note'}
                  </span>
                  <StickyIcon size={12} className="opacity-40 shrink-0" />
                </div>
                <div className="flex-1 w-full text-xs leading-relaxed mt-2 font-sans whitespace-pre-wrap select-text">
                  {element.content}
                </div>
              </div>
            )}

            {/* Text Card */}
            {element.type === 'text' && (
              <div
                style={{
                  fontSize: element.fontSize ? `${element.fontSize}px` : '16px',
                  color: element.textColor || '#FFFFFF',
                  fontWeight: element.fontWeight || 'normal',
                  fontStyle: element.fontStyle || 'normal',
                  textAlign: element.textAlign || 'left',
                }}
                className="w-full h-full p-2 font-sans whitespace-pre-wrap select-text leading-snug"
              >
                {element.content}
              </div>
            )}

            {/* Image Card */}
            {element.type === 'image' && (
              <div
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  handleFocusElement(element);
                }}
                className="w-full h-full rounded-lg overflow-hidden bg-[#171717] border border-white/10 flex flex-col shadow-lg group/img relative cursor-pointer"
              >
                {/* Action buttons on hover: HD Focus (lightbox) & Frame camera */}
                <div className="absolute top-2 left-2 z-20 flex items-center gap-1 opacity-0 group-hover/img:opacity-100 transition-opacity bg-black/85 backdrop-blur-md rounded-lg p-1 border border-white/15 shadow-xl">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFocusedImage({
                        url: element.url || (element.metadata as any)?.dataUrl || '',
                        title: element.title || 'Image',
                        element,
                      });
                    }}
                    className="px-2 py-1 flex items-center gap-1 rounded text-[11px] font-medium text-white hover:bg-white/20 transition-colors"
                    title="Open HD Lightbox (inspect pixels up to 500%)"
                  >
                    <Maximize2 size={12} />
                    <span>HD Focus</span>
                  </button>
                  <div className="w-[1px] h-3 bg-white/20" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFocusElement(element);
                    }}
                    className="px-2 py-1 flex items-center gap-1 rounded text-[11px] font-medium text-white hover:bg-white/20 transition-colors"
                    title="Center & frame on board viewport"
                  >
                    <Crosshair size={12} />
                    <span>Frame</span>
                  </button>
                </div>

                <div className="flex-1 w-full h-full relative overflow-hidden bg-black/40 flex items-center justify-center p-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={element.url || (element.metadata as any)?.dataUrl || ''}
                    alt={element.title || 'Image'}
                    loading="eager"
                    style={{
                      imageRendering: '-webkit-optimize-contrast',
                    }}
                    className="w-full h-full object-contain select-none pointer-events-none"
                    onError={(e) => {
                      const fallback = (element.metadata as any)?.dataUrl;
                      if (fallback && e.currentTarget.src !== fallback) {
                        e.currentTarget.src = fallback;
                      } else {
                        e.currentTarget.style.display = 'none';
                        const placeholder = e.currentTarget.parentElement?.querySelector('.img-error-placeholder');
                        if (placeholder) (placeholder as HTMLElement).style.display = 'flex';
                      }
                    }}
                  />
                  <div className="img-error-placeholder hidden flex-col items-center justify-center text-center p-3 text-white/50 w-full h-full">
                    <ImageIcon size={26} className="mb-2 text-white/40" />
                    <span className="text-xs font-mono text-white/70 truncate max-w-[90%]">{element.title || 'Image'}</span>
                    <span className="text-[10px] text-white/40 mt-1">Image unavailable</span>
                  </div>
                </div>
              </div>
            )}

            {/* Audio Card */}
            {element.type === 'audio' && (
              <div className="w-full h-full rounded-lg bg-[#171717] border border-white/10 p-3.5 flex flex-col justify-between shadow-xl">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white shrink-0">
                      <Music size={14} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-white truncate">
                        {element.title || 'Audio Clip'}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] font-mono">
                        {element.metadata?.author || 'Voice Recording'}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleAudioPlay(element.id, element.url)}
                    className="w-8 h-8 rounded-full bg-white hover:bg-white/90 text-black flex items-center justify-center transition-transform hover:scale-105 shadow-md shrink-0 cursor-pointer"
                  >
                    {activeAudioId === element.id ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                  </button>
                </div>

                <div className="flex items-center gap-0.5 h-6 my-1">
                  {[12, 20, 8, 24, 16, 28, 14, 22, 10, 26, 18, 12, 24, 16, 20, 8, 26, 14, 22, 12, 18, 24, 10, 16, 20].map(
                    (h, i) => (
                      <div
                        key={i}
                        style={{ height: `${h}px` }}
                        className={`flex-1 rounded-full transition-all ${
                          activeAudioId === element.id ? 'bg-white animate-pulse' : 'bg-white/20'
                        }`}
                      />
                    )
                  )}
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)]">
                  <span>
                    {Math.floor((audioProgress[element.id]?.current || 0) / 60)}:
                    {String(Math.floor((audioProgress[element.id]?.current || 0) % 60)).padStart(2, '0')}
                  </span>
                  <span className="text-[9px] text-white/70">MP3 • HI-FI</span>
                  <span>
                    {Math.floor((audioProgress[element.id]?.duration || element.metadata?.duration || 30) / 60)}:
                    {String(
                      Math.floor((audioProgress[element.id]?.duration || element.metadata?.duration || 30) % 60)
                    ).padStart(2, '0')}
                  </span>
                </div>
              </div>
            )}

            {/* Video Card */}
            {element.type === 'video' && (
              <div className="w-full h-full rounded-lg overflow-hidden bg-[#171717] border border-white/10 flex flex-col shadow-xl">
                <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#141414] border-b border-white/5">
                  <div className="flex items-center gap-1.5 text-xs text-white truncate">
                    <VideoIcon size={12} className="text-[#FF0051]" />
                    <span className="truncate">{element.title || 'Video Player'}</span>
                  </div>
                </div>
                <div className="flex-1 bg-black relative">
                  <video
                    src={element.url}
                    controls
                    playsInline
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}

            {/* Link Bookmark Card */}
            {element.type === 'link' && (
              <a
                href={element.url}
                target="_blank"
                rel="noreferrer"
                className="w-full h-full rounded-lg bg-[#171717] border border-white/10 hover:border-white/30 p-3 flex flex-col justify-between shadow-lg transition-colors group/link"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      {element.metadata?.favicon && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={element.metadata.favicon} alt="" className="w-3.5 h-3.5 rounded shrink-0" />
                      )}
                      <span className="text-[10px] font-mono text-[var(--text-muted)] truncate">
                        {element.metadata?.domain || 'web link'}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-white group-hover/link:underline transition-colors truncate">
                      {element.title || element.url}
                    </div>
                  </div>
                  <div className="p-1 rounded bg-white/5 group-hover/link:bg-white/15 text-[var(--text-muted)] group-hover/link:text-white transition-colors">
                    <ExternalLink size={12} />
                  </div>
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] line-clamp-2">
                  {element.metadata?.description || element.url}
                </div>
              </a>
            )}
          </div>
        ))}
      </div>

      {/* Floating Bottom Right Controls */}
      <div className="absolute bottom-4 right-4 z-40 flex items-center gap-1 p-1 bg-[#171717]/90 backdrop-blur-md border border-white/10 rounded-lg shadow-2xl">
        <button
          onClick={() => setViewport((prev) => ({ ...prev, zoom: Math.max(0.15, prev.zoom - 0.15) }))}
          className="p-1.5 rounded hover:bg-white/10 text-white transition-colors cursor-pointer"
          title="Zoom Out"
        >
          <ZoomOut size={14} />
        </button>
        <span
          onClick={() => setViewport((prev) => ({ ...prev, zoom: 1 }))}
          className="px-2 py-0.5 text-[11px] font-mono text-white cursor-pointer hover:bg-white/10 rounded"
          title="Reset to 100%"
        >
          {Math.round(viewport.zoom * 100)}%
        </span>
        <button
          onClick={() => setViewport((prev) => ({ ...prev, zoom: Math.min(5.0, prev.zoom + 0.15) }))}
          className="p-1.5 rounded hover:bg-white/10 text-white transition-colors cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn size={14} />
        </button>
        <div className="w-[1px] h-4 bg-white/10 mx-0.5" />
        <button
          onClick={handleFitView}
          className="p-1.5 rounded hover:bg-white/10 text-white transition-colors cursor-pointer"
          title="Fit to Content"
        >
          <Maximize2 size={14} />
        </button>
      </div>

      {/* High-Resolution HD Focus Modal */}
      {focusedImage && (
        <BoardImageFocusModal
          imageUrl={focusedImage.url}
          title={focusedImage.title}
          onClose={() => setFocusedImage(null)}
          onFocusInViewport={() => {
            if (focusedImage.element) {
              handleFocusElement(focusedImage.element);
            }
          }}
        />
      )}
      </>
      )}
    </div>
  );
}
