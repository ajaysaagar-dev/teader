'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Music,
  Video as VideoIcon,
  ExternalLink,
  Play,
  Pause,
  AlertCircle,
  Layers,
  StickyNote as StickyIcon,
} from 'lucide-react';
import { BoardElement, BoardGroup, BoardViewport, BoardData } from '@/types/board';
import { isElementInViewport, getGroupBoundingBox } from '@/lib/board-snap';

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
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 1200, height: 800 });
  const [isPanning, setIsPanning] = useState(false);
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState<Record<string, { current: number; duration: number }>>({});
  const audioElementsRef = useRef<Record<string, HTMLAudioElement>>({});

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
        setElements(data.elements || []);
        setGroups(data.groups || []);
        if (data.viewport) setViewport(data.viewport);
      } catch (err: any) {
        setError(err.message || 'Failed to load shared board');
      } finally {
        setLoading(false);
      }
    };

    fetchSharedBoard();
  }, [token]);

  // ── Track Dimensions ──
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setCanvasDimensions({
          width: Math.max(300, containerRef.current.clientWidth),
          height: Math.max(300, containerRef.current.clientHeight),
        });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // ── Mouse Wheel Zoom Controller (Direct Zoom with Wheel) ──
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const nextZoom = Math.min(3.5, Math.max(0.15, viewport.zoom * zoomFactor));

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
    if (e.button === 0 || e.button === 1) {
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

  // ── Render Infinite Dot Grid on Canvas Background ──
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
    const gridSize = 20 * zoom;
    const offsetX = ((viewport.x % gridSize) + gridSize) % gridSize;
    const offsetY = ((viewport.y % gridSize) + gridSize) % gridSize;

    ctx.fillStyle = zoom > 0.4 ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.05)';
    const dotRadius = Math.max(1, 1.2 * Math.min(zoom, 1.5));

    for (let x = offsetX; x < canvasDimensions.width; x += gridSize) {
      for (let y = offsetY; y < canvasDimensions.height; y += gridSize) {
        ctx.beginPath();
        ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      }
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

  if (loading) {
    return (
      <div className="w-screen h-screen bg-[#0F0F0F] flex flex-col items-center justify-center text-white space-y-3 font-sans">
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        <div className="text-xs font-mono text-[var(--text-muted)]">Loading shared canvas board...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-screen h-screen bg-[#0F0F0F] flex flex-col items-center justify-center text-white p-6 font-sans">
        <div className="max-w-md w-full bg-[#171717] border border-white/10 rounded-xl p-6 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mx-auto text-white">
            <AlertCircle size={24} />
          </div>
          <h1 className="text-lg font-semibold text-white">Link Unavailable</h1>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{error}</p>
          <div className="pt-2 text-[11px] font-mono text-[var(--text-muted)]">Teader Spatial Canvas</div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className={`relative w-screen h-screen overflow-hidden select-none bg-[#0F0F0F] ${
        isPanning ? 'cursor-grabbing' : 'cursor-grab'
      }`}
    >
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
          <div className="px-2.5 py-1 rounded bg-white/10 text-white text-[11px] font-mono">Read-Only</div>
        </div>
      </header>

      {/* HTML5 Canvas Background */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-auto"
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
              <div className="w-full h-full rounded-lg overflow-hidden bg-[#171717] border border-white/10 flex flex-col shadow-lg group">
                <div className="flex-1 relative overflow-hidden bg-black/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={element.url}
                    alt={element.title || 'Image'}
                    className="w-full h-full object-cover select-none"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <a
                      href={element.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-full bg-black/70 hover:bg-black text-white hover:scale-105 transition-all"
                    >
                      <ExternalLink size={13} />
                    </a>
                  </div>
                </div>
                {element.title && (
                  <div className="px-2.5 py-1.5 bg-[#141414] border-t border-white/5 text-[11px] text-[var(--text-secondary)] truncate">
                    {element.title}
                  </div>
                )}
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
          onClick={() => setViewport((prev) => ({ ...prev, zoom: Math.min(3.5, prev.zoom + 0.15) }))}
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
    </div>
  );
}
