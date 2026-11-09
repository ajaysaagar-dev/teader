'use client';

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {
  Plus,
  Trash2,
  Copy,
  Download,
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  MousePointer,
  Hand,
  StickyNote as StickyIcon,
  Type,
  Image as ImageIcon,
  Music,
  Video as VideoIcon,
  Link as LinkIcon,
  Square,
  Layers,
  Magnet,
  Grid,
  ExternalLink,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Upload,
  Lock,
  Unlock,
  Check,
  X,
  Save,
  ArrowRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  BoardElement,
  BoardGroup,
  BoardConnection,
  BoardViewport,
  BoardFile,
  SnapGuide,
} from '@/types/board';
import { isElementInViewport, computeSnapAlignment, getGroupBoundingBox } from '@/lib/board-snap';
import { getLocalCache, setLocalCache } from '@/lib/client-cache';
import { useRealtimeSubscription, publishClientRealtimeEvent } from '@/lib/useRealtime';

interface ProjectBoardViewProps {
  projectId: number | string;
  projectName?: string;
  projectKey?: string;
}

const STICKY_COLORS = [
  { name: 'White', bg: '#FFFFFF', text: '#000000' },
  { name: 'Light Gray', bg: '#E5E5E5', text: '#171717' },
  { name: 'Mid Gray', bg: '#737373', text: '#FFFFFF' },
  { name: 'Slate', bg: '#262626', text: '#FFFFFF' },
  { name: 'Obsidian', bg: '#141414', text: '#FFFFFF' },
  { name: 'Violet Accent', bg: '#8400FF', text: '#FFFFFF' },
  { name: 'Pink Accent', bg: '#FF0051', text: '#FFFFFF' },
];

export const ProjectBoardView: React.FC<ProjectBoardViewProps> = ({
  projectId,
  projectName = 'Project',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Client Session ID for real-time broadcast filtering
  const clientSessionIdRef = useRef(`board_client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

  // ── Multi-Board Files state ──
  const [boards, setBoards] = useState<BoardFile[]>(() => {
    return getLocalCache<BoardFile[]>(`boards_${projectId}`, []);
  });
  const [activeBoardId, setActiveBoardId] = useState<string | null>(() => {
    return getLocalCache<string | null>(`boards_active_${projectId}`, null);
  });

  // ── Active Board Data ──
  const [elements, setElements] = useState<BoardElement[]>([]);
  const [groups, setGroups] = useState<BoardGroup[]>([]);
  const [connections, setConnections] = useState<BoardConnection[]>([]);
  const [viewport, setViewport] = useState<BoardViewport>({ x: 40, y: 30, zoom: 0.9 });

  // ── Selection & Tools ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTool, setActiveTool] = useState<'pointer' | 'hand'>('pointer');
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const [snapSettings, setSnapSettings] = useState({
    enabled: true,
    snapToGrid: false,
    gridSize: 20,
    snapThreshold: 8,
  });

  // ── UI States ──
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 1200, height: 800 });
  const [marqueeBox, setMarqueeBox] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState<Record<string, { current: number; duration: number }>>({});
  const audioElementsRef = useRef<Record<string, HTMLAudioElement>>({});

  // ── Undo / Redo History ──
  const historyRef = useRef<BoardElement[][]>([]);
  const historyIndexRef = useRef<number>(-1);

  const pushHistory = useCallback((newElements: BoardElement[]) => {
    const nextHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    nextHistory.push(JSON.parse(JSON.stringify(newElements)));
    if (nextHistory.length > 30) nextHistory.shift();
    historyRef.current = nextHistory;
    historyIndexRef.current = nextHistory.length - 1;
  }, []);

  // ── Load Boards from API ──
  const loadBoards = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/boards`);
      if (res.ok) {
        const json = await res.json();
        const serverBoards: BoardFile[] = json.boards || [];
        setBoards(serverBoards);
        setLocalCache(`boards_${projectId}`, serverBoards);

        const currentActive = activeBoardId || getLocalCache<string | null>(`boards_active_${projectId}`, null);
        const target = serverBoards.find((b) => b.id === currentActive) || serverBoards[0];
        if (target) {
          setActiveBoardId(target.id);
          setLocalCache(`boards_active_${projectId}`, target.id);
          setElements(target.data.elements || []);
          setGroups(target.data.groups || []);
          setConnections(target.data.connections || []);
          if (target.data.viewport) setViewport(target.data.viewport);
          historyRef.current = [JSON.parse(JSON.stringify(target.data.elements || []))];
          historyIndexRef.current = 0;
        }
      }
    } catch (err) {
      console.warn('[ProjectBoardView] Could not load boards from server, using local cache:', err);
    }
  }, [projectId, activeBoardId]);

  useEffect(() => {
    loadBoards();
  }, [loadBoards]);

  // ── Auto-save Board Data ──
  const saveCurrentBoard = useCallback(async (newElements?: BoardElement[], newGroups?: BoardGroup[], newViewport?: BoardViewport) => {
    if (!activeBoardId) return;
    const elems = newElements ?? elements;
    const grps = newGroups ?? groups;
    const vport = newViewport ?? viewport;

    const boardData = {
      elements: elems,
      groups: grps,
      connections,
      viewport: vport,
    };

    // Update in-memory & local cache
    setBoards((prev) =>
      prev.map((b) => (b.id === activeBoardId ? { ...b, data: boardData, updatedAt: new Date().toISOString() } : b))
    );

    try {
      setIsSaving(true);
      await fetch(`/api/projects/${projectId}/boards/${activeBoardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: boardData }),
      });
    } catch (err) {
      console.warn('[ProjectBoardView] Auto-save error:', err);
    } finally {
      setIsSaving(false);
    }
  }, [activeBoardId, elements, groups, connections, viewport, projectId]);

  // Real-time remote board sync
  useRealtimeSubscription({
    projectId,
    onEvent: useCallback((event: any) => {
      if (
        event.type === 'BOARD_UPDATED' &&
        (event.boardId === activeBoardId || event.payload?.boardId === activeBoardId)
      ) {
        if (event.clientSessionId === clientSessionIdRef.current) return;
        const b = event.board || event.payload?.board;
        if (b?.data?.elements) {
          setElements(b.data.elements);
          if (b.data.groups) setGroups(b.data.groups);
        }
      }
    }, [activeBoardId]),
  });

  // ── Track Container Dimensions ──
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setCanvasDimensions({
          width: Math.max(300, clientWidth),
          height: Math.max(300, clientHeight),
        });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // ── Viewport Culling Calculation (Optimization) ──
  // Only elements intersecting the current visible viewport frame are rendered!
  const visibleElements = useMemo(() => {
    return elements.filter((elem) => {
      // Always render selected elements or elements in an active group to preserve seamless drag handles
      if (selectedIds.has(elem.id)) return true;
      return isElementInViewport(elem, viewport, canvasDimensions.width, canvasDimensions.height, 120);
    });
  }, [elements, viewport, canvasDimensions, selectedIds]);

  const culledCount = elements.length - visibleElements.length;

  // ── Render Canvas Background & Dynamic Snap Alignment Lines ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasDimensions.width * dpr;
    canvas.height = canvasDimensions.height * dpr;
    ctx.scale(dpr, dpr);

    // Clear background
    ctx.fillStyle = '#0F0F0F';
    ctx.fillRect(0, 0, canvasDimensions.width, canvasDimensions.height);

    // Draw infinite Miro dot grid
    const zoom = viewport.zoom;
    const gridSize = (snapSettings.gridSize || 20) * zoom;
    const offsetX = (viewport.x % gridSize + gridSize) % gridSize;
    const offsetY = (viewport.y % gridSize + gridSize) % gridSize;

    ctx.fillStyle = zoom > 0.4 ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.05)';
    const dotRadius = Math.max(1, 1.2 * Math.min(zoom, 1.5));

    for (let x = offsetX; x < canvasDimensions.width; x += gridSize) {
      for (let y = offsetY; y < canvasDimensions.height; y += gridSize) {
        ctx.beginPath();
        ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw Connector Arrows
    if (connections.length > 0) {
      ctx.save();
      for (const conn of connections) {
        const fromElem = elements.find((e) => e.id === conn.fromId);
        const toElem = elements.find((e) => e.id === conn.toId);
        if (!fromElem || !toElem) continue;

        const x1 = (fromElem.x + fromElem.width / 2) * zoom + viewport.x;
        const y1 = (fromElem.y + fromElem.height / 2) * zoom + viewport.y;
        const x2 = (toElem.x + toElem.width / 2) * zoom + viewport.x;
        const y2 = (toElem.y + toElem.height / 2) * zoom + viewport.y;

        ctx.strokeStyle = conn.color || 'rgba(132, 0, 255, 0.7)';
        ctx.lineWidth = 2 * Math.min(zoom, 1.2);
        if (conn.style === 'dashed') ctx.setLineDash([6, 4]);
        else ctx.setLineDash([]);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Arrow head
        if (conn.arrow) {
          const angle = Math.atan2(y2 - y1, x2 - x1);
          const headLen = 10 * zoom;
          ctx.setLineDash([]);
          ctx.fillStyle = conn.color || 'rgba(132, 0, 255, 0.9)';
          ctx.beginPath();
          ctx.moveTo(x2, y2);
          ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
          ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // Draw Magnetic Alignment Snap Path Guides
    if (snapGuides.length > 0) {
      ctx.save();
      for (const guide of snapGuides) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);

        if (guide.orientation === 'vertical') {
          const screenX = guide.pos * zoom + viewport.x;
          const screenY1 = guide.start * zoom + viewport.y;
          const screenY2 = guide.end * zoom + viewport.y;

          ctx.beginPath();
          ctx.moveTo(screenX, screenY1);
          ctx.lineTo(screenX, screenY2);
          ctx.stroke();

          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(screenX - 5, screenY1);
          ctx.lineTo(screenX + 5, screenY1);
          ctx.moveTo(screenX - 5, screenY2);
          ctx.lineTo(screenX + 5, screenY2);
          ctx.stroke();
        } else {
          const screenY = guide.pos * zoom + viewport.y;
          const screenX1 = guide.start * zoom + viewport.x;
          const screenX2 = guide.end * zoom + viewport.y;

          ctx.beginPath();
          ctx.moveTo(screenX1, screenY);
          ctx.lineTo(screenX2, screenY);
          ctx.stroke();

          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(screenX1, screenY - 5);
          ctx.lineTo(screenX1, screenY + 5);
          ctx.moveTo(screenX2, screenY - 5);
          ctx.lineTo(screenX2, screenY + 5);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // Draw Marquee Selection Box
    if (marqueeBox) {
      const x = Math.min(marqueeBox.startX, marqueeBox.currentX);
      const y = Math.min(marqueeBox.startY, marqueeBox.currentY);
      const w = Math.abs(marqueeBox.currentX - marqueeBox.startX);
      const h = Math.abs(marqueeBox.currentY - marqueeBox.startY);

      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 3]);
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
    }
  }, [canvasDimensions, viewport, snapGuides, snapSettings, connections, elements, marqueeBox]);

  // ── Pan and Zoom Interaction Handlers ──
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Zoom centered at mouse position
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      const nextZoom = Math.min(3.5, Math.max(0.15, viewport.zoom * zoomFactor));

      const rect = containerRef.current?.getBoundingClientRect();
      const mouseX = rect ? e.clientX - rect.left : canvasDimensions.width / 2;
      const mouseY = rect ? e.clientY - rect.top : canvasDimensions.height / 2;

      const nextX = mouseX - (mouseX - viewport.x) * (nextZoom / viewport.zoom);
      const nextY = mouseY - (mouseY - viewport.y) * (nextZoom / viewport.zoom);

      const nextViewport = { x: nextX, y: nextY, zoom: nextZoom };
      setViewport(nextViewport);
    } else {
      // Two-finger pan
      setViewport((prev) => ({
        ...prev,
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  };

  // Convert Screen Coordinates to Board World Coordinates
  const screenToWorld = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - viewport.x) / viewport.zoom,
      y: (clientY - rect.top - viewport.y) / viewport.zoom,
    };
  }, [viewport]);

  // ── Mouse & Pan Interaction Handlers on Container ──
  const panStartRef = useRef<{ startX: number; startY: number; vX: number; vY: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Middle click or hand tool or space pressed triggers canvas panning
    if (e.button === 1 || activeTool === 'hand' || e.altKey) {
      panStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        vX: viewport.x,
        vY: viewport.y,
      };
      setIsPanning(true);
      return;
    }

    // Left click on empty canvas starts Marquee Box Selection
    if (e.button === 0 && e.target === canvasRef.current) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;

      setMarqueeBox({
        startX: localX,
        startY: localY,
        currentX: localX,
        currentY: localY,
      });

      if (!e.shiftKey) {
        setSelectedIds(new Set());
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (panStartRef.current) {
      const dx = e.clientX - panStartRef.current.startX;
      const dy = e.clientY - panStartRef.current.startY;
      setViewport((prev) => ({
        ...prev,
        x: panStartRef.current!.vX + dx,
        y: panStartRef.current!.vY + dy,
      }));
      return;
    }

    if (marqueeBox) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      setMarqueeBox((prev) => (prev ? { ...prev, currentX, currentY } : null));

      const boxLeft = Math.min(marqueeBox.startX, currentX);
      const boxTop = Math.min(marqueeBox.startY, currentY);
      const boxRight = Math.max(marqueeBox.startX, currentX);
      const boxBottom = Math.max(marqueeBox.startY, currentY);

      const nextSelected = new Set(e.shiftKey ? selectedIds : []);
      for (const elem of elements) {
        const elemScreenX = elem.x * viewport.zoom + viewport.x;
        const elemScreenY = elem.y * viewport.zoom + viewport.y;
        const elemScreenW = elem.width * viewport.zoom;
        const elemScreenH = elem.height * viewport.zoom;

        const intersects = !(
          elemScreenX + elemScreenW < boxLeft ||
          elemScreenX > boxRight ||
          elemScreenY + elemScreenH < boxTop ||
          elemScreenY > boxBottom
        );

        if (intersects) nextSelected.add(elem.id);
      }
      setSelectedIds(nextSelected);
    }
  };

  const handleMouseUp = () => {
    if (panStartRef.current) {
      panStartRef.current = null;
      setIsPanning(false);
      saveCurrentBoard();
    }
    if (marqueeBox) {
      setMarqueeBox(null);
    }
  };

  // ── Drag & Drop Engine (Images, Audio, Video, Links, Text) ──
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const worldPos = screenToWorld(e.clientX, e.clientY);

    // 1. Check for OS file drops (images, audio, video)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const offsetPos = {
          x: worldPos.x + i * 40,
          y: worldPos.y + i * 40,
        };

        const toastId = toast.loading(`Uploading media "${file.name}"...`);
        try {
          const formData = new FormData();
          formData.append('file', file);

          const res = await fetch(`/api/projects/${projectId}/boards/upload`, {
            method: 'POST',
            body: formData,
          });

          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Upload failed');
          }

          const uploaded = await res.json();
          toast.success(`Uploaded ${file.name}`, { id: toastId });

          let elemType: BoardElement['type'] = 'image';
          let width = 320;
          let height = 220;

          if (file.type.startsWith('audio/')) {
            elemType = 'audio';
            width = 320;
            height = 140;
          } else if (file.type.startsWith('video/')) {
            elemType = 'video';
            width = 360;
            height = 240;
          }

          const newElem: BoardElement = {
            id: `elem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            type: elemType,
            x: offsetPos.x,
            y: offsetPos.y,
            width,
            height,
            title: file.name,
            url: uploaded.url,
            metadata: {
              filename: file.name,
              filesize: file.size,
              mimeType: file.type,
            },
          };

          setElements((prev) => {
            const updated = [...prev, newElem];
            pushHistory(updated);
            saveCurrentBoard(updated);
            return updated;
          });
          setSelectedIds(new Set([newElem.id]));
        } catch (err: any) {
          toast.error(err.message || 'File drop failed', { id: toastId });
        }
      }
      return;
    }

    // 2. Check for URL / Web Link drop or Plain Text drop
    const textData = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (textData) {
      const isUrl = /^https?:\/\//i.test(textData.trim());
      if (isUrl) {
        try {
          const urlObj = new URL(textData.trim());
          const newElem: BoardElement = {
            id: `elem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            type: 'link',
            x: worldPos.x,
            y: worldPos.y,
            width: 280,
            height: 110,
            title: urlObj.hostname,
            url: textData.trim(),
            metadata: {
              domain: urlObj.hostname,
              favicon: `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`,
            },
          };
          setElements((prev) => {
            const updated = [...prev, newElem];
            pushHistory(updated);
            saveCurrentBoard(updated);
            return updated;
          });
          setSelectedIds(new Set([newElem.id]));
          toast.success('Added link bookmark to board');
        } catch {}
      } else {
        // Plain text drop -> Sticky note
        const newElem: BoardElement = {
          id: `elem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          type: 'sticky',
          x: worldPos.x,
          y: worldPos.y,
          width: 220,
          height: 160,
          title: 'Note',
          content: textData.trim(),
          color: STICKY_COLORS[0].bg,
          textColor: STICKY_COLORS[0].text,
        };
        setElements((prev) => {
          const updated = [...prev, newElem];
          pushHistory(updated);
          saveCurrentBoard(updated);
          return updated;
        });
        setSelectedIds(new Set([newElem.id]));
      }
    }
  };

  // ── Element Dragging & Magnetic Snap Alignment ──
  const activeDragRef = useRef<{
    elementId: string;
    startX: number;
    startY: number;
    initialElems: Map<string, { x: number; y: number }>;
  } | null>(null);

  const handleElementMouseDown = (e: React.MouseEvent, element: BoardElement) => {
    e.stopPropagation();
    if (activeTool === 'hand') return;

    let nextSelected = new Set(selectedIds);
    if (e.shiftKey) {
      if (nextSelected.has(element.id)) nextSelected.delete(element.id);
      else nextSelected.add(element.id);
    } else {
      if (!nextSelected.has(element.id)) {
        nextSelected = new Set([element.id]);
      }
    }

    if (element.groupId) {
      const groupElems = elements.filter((el) => el.groupId === element.groupId);
      for (const el of groupElems) nextSelected.add(el.id);
    }

    setSelectedIds(nextSelected);

    const initialMap = new Map<string, { x: number; y: number }>();
    for (const id of nextSelected) {
      const found = elements.find((el) => el.id === id);
      if (found) initialMap.set(id, { x: found.x, y: found.y });
    }

    activeDragRef.current = {
      elementId: element.id,
      startX: e.clientX,
      startY: e.clientY,
      initialElems: initialMap,
    };

    const handleWindowMouseMove = (moveEvent: MouseEvent) => {
      if (!activeDragRef.current) return;
      const dx = (moveEvent.clientX - activeDragRef.current.startX) / viewport.zoom;
      const dy = (moveEvent.clientY - activeDragRef.current.startY) / viewport.zoom;

      const primaryInitial = activeDragRef.current.initialElems.get(element.id);
      if (!primaryInitial) return;

      const rawX = primaryInitial.x + dx;
      const rawY = primaryInitial.y + dy;

      let finalX = rawX;
      let finalY = rawY;
      let calculatedGuides: SnapGuide[] = [];

      if (snapSettings.enabled) {
        const otherElements = elements.filter((el) => !activeDragRef.current!.initialElems.has(el.id));
        const snap = computeSnapAlignment(
          { x: rawX, y: rawY, width: element.width, height: element.height },
          otherElements,
          {
            snapThreshold: snapSettings.snapThreshold,
            zoom: viewport.zoom,
            snapToGrid: snapSettings.snapToGrid,
            gridSize: snapSettings.gridSize,
          }
        );
        finalX = snap.x;
        finalY = snap.y;
        calculatedGuides = snap.guides;
      }

      setSnapGuides(calculatedGuides);

      const snapDeltaX = finalX - primaryInitial.x;
      const snapDeltaY = finalY - primaryInitial.y;

      setElements((prev) =>
        prev.map((el) => {
          const init = activeDragRef.current?.initialElems.get(el.id);
          if (init) {
            return {
              ...el,
              x: Math.round(init.x + snapDeltaX),
              y: Math.round(init.y + snapDeltaY),
            };
          }
          return el;
        })
      );
    };

    const handleWindowMouseUp = () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      setSnapGuides([]);
      activeDragRef.current = null;
      pushHistory(elements);
      saveCurrentBoard();
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
  };

  // ── Element Resizing Engine ──
  const handleResizeMouseDown = (e: React.MouseEvent, element: BoardElement, handle: string) => {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const initW = element.width;
    const initH = element.height;
    const initX = element.x;
    const initY = element.y;

    const handleWindowMouseMove = (moveEvent: MouseEvent) => {
      const dx = (moveEvent.clientX - startX) / viewport.zoom;
      const dy = (moveEvent.clientY - startY) / viewport.zoom;

      let nextW = initW;
      let nextH = initH;
      let nextX = initX;
      let nextY = initY;

      if (handle.includes('e')) nextW = Math.max(100, initW + dx);
      if (handle.includes('s')) nextH = Math.max(60, initH + dy);
      if (handle.includes('w')) {
        const potentialW = Math.max(100, initW - dx);
        nextX = initX + (initW - potentialW);
        nextW = potentialW;
      }
      if (handle.includes('n')) {
        const potentialH = Math.max(60, initH - dy);
        nextY = initY + (initH - potentialH);
        nextH = potentialH;
      }

      setElements((prev) =>
        prev.map((el) => (el.id === element.id ? { ...el, x: nextX, y: nextY, width: nextW, height: nextH } : el))
      );
    };

    const handleWindowMouseUp = () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      pushHistory(elements);
      saveCurrentBoard();
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
  };

  // ── Grouping & Ungrouping Actions ──
  const handleGroupSelected = () => {
    if (selectedIds.size < 2) {
      toast.info('Select 2 or more elements to create a group (Shift+Click or drag box)');
      return;
    }

    const newGroupId = `group_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newGroup: BoardGroup = {
      id: newGroupId,
      title: `Group ${groups.length + 1}`,
      color: '#8400FF',
    };

    const updatedGroups = [...groups, newGroup];
    const updatedElements = elements.map((el) => (selectedIds.has(el.id) ? { ...el, groupId: newGroupId } : el));

    setGroups(updatedGroups);
    setElements(updatedElements);
    pushHistory(updatedElements);
    saveCurrentBoard(updatedElements, updatedGroups);
    toast.success('Elements grouped together');
  };

  const handleUngroupSelected = () => {
    const selectedGroupIds = new Set<string>();
    for (const id of selectedIds) {
      const el = elements.find((e) => e.id === id);
      if (el?.groupId) selectedGroupIds.add(el.groupId);
    }

    if (selectedGroupIds.size === 0) return;

    const updatedGroups = groups.filter((g) => !selectedGroupIds.has(g.id));
    const updatedElements = elements.map((el) =>
      el.groupId && selectedGroupIds.has(el.groupId) ? { ...el, groupId: undefined } : el
    );

    setGroups(updatedGroups);
    setElements(updatedElements);
    pushHistory(updatedElements);
    saveCurrentBoard(updatedElements, updatedGroups);
    toast.success('Elements ungrouped');
  };

  // ── Quick Add Items ──
  const addStickyNote = (colorObj = STICKY_COLORS[0]) => {
    const worldCenter = screenToWorld(
      (containerRef.current?.clientWidth || 1000) / 2,
      (containerRef.current?.clientHeight || 700) / 2
    );
    const newElem: BoardElement = {
      id: `elem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'sticky',
      x: worldCenter.x - 100,
      y: worldCenter.y - 80,
      width: 220,
      height: 170,
      title: 'Idea Note',
      content: 'Write your thoughts here...',
      color: colorObj.bg,
      textColor: colorObj.text,
      fontSize: 14,
    };
    setElements((prev) => {
      const next = [...prev, newElem];
      pushHistory(next);
      saveCurrentBoard(next);
      return next;
    });
    setSelectedIds(new Set([newElem.id]));
  };

  const addTextElement = () => {
    const worldCenter = screenToWorld(
      (containerRef.current?.clientWidth || 1000) / 2,
      (containerRef.current?.clientHeight || 700) / 2
    );
    const newElem: BoardElement = {
      id: `elem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'text',
      x: worldCenter.x - 120,
      y: worldCenter.y - 30,
      width: 260,
      height: 60,
      content: 'Heading Text',
      fontSize: 18,
      textColor: '#FFFFFF',
    };
    setElements((prev) => {
      const next = [...prev, newElem];
      pushHistory(next);
      saveCurrentBoard(next);
      return next;
    });
    setSelectedIds(new Set([newElem.id]));
  };

  const handleMediaUploadClick = (type: 'image' | 'audio' | 'video') => {
    if (fileInputRef.current) {
      if (type === 'image') fileInputRef.current.accept = 'image/*';
      else if (type === 'audio') fileInputRef.current.accept = 'audio/*';
      else if (type === 'video') fileInputRef.current.accept = 'video/*';
      fileInputRef.current.click();
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const toastId = toast.loading(`Uploading "${file.name}"...`);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/projects/${projectId}/boards/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      toast.success('Media added to board', { id: toastId });

      const worldCenter = screenToWorld(
        (containerRef.current?.clientWidth || 1000) / 2,
        (containerRef.current?.clientHeight || 700) / 2
      );

      let elemType: BoardElement['type'] = 'image';
      let w = 320;
      let h = 220;
      if (file.type.startsWith('audio/')) {
        elemType = 'audio';
        w = 320;
        h = 140;
      } else if (file.type.startsWith('video/')) {
        elemType = 'video';
        w = 360;
        h = 240;
      }

      const newElem: BoardElement = {
        id: `elem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: elemType,
        x: worldCenter.x - w / 2,
        y: worldCenter.y - h / 2,
        width: w,
        height: h,
        title: file.name,
        url: data.url,
        metadata: {
          filename: file.name,
          filesize: file.size,
          mimeType: file.type,
        },
      };

      setElements((prev) => {
        const next = [...prev, newElem];
        pushHistory(next);
        saveCurrentBoard(next);
        return next;
      });
      setSelectedIds(new Set([newElem.id]));
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload media', { id: toastId });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Audio Playback Controller ──
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

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable) {
        return;
      }

      // Delete selected
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.size > 0) {
        e.preventDefault();
        const next = elements.filter((el) => !selectedIds.has(el.id));
        setElements(next);
        setSelectedIds(new Set());
        pushHistory(next);
        saveCurrentBoard(next);
        toast.info('Deleted selected items');
      }

      // Group (Ctrl+G)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g' && !e.shiftKey) {
        e.preventDefault();
        handleGroupSelected();
      }

      // Ungroup (Ctrl+Shift+G)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g' && e.shiftKey) {
        e.preventDefault();
        handleUngroupSelected();
      }

      // Undo (Ctrl+Z)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (historyIndexRef.current > 0) {
          historyIndexRef.current -= 1;
          const prevElements = historyRef.current[historyIndexRef.current];
          setElements(prevElements);
          saveCurrentBoard(prevElements);
        }
      }

      // Redo (Ctrl+Y or Ctrl+Shift+Z)
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        if (historyIndexRef.current < historyRef.current.length - 1) {
          historyIndexRef.current += 1;
          const nextElements = historyRef.current[historyIndexRef.current];
          setElements(nextElements);
          saveCurrentBoard(nextElements);
        }
      }

      // Fit View (Shift+1)
      if (e.shiftKey && e.key === '1') {
        e.preventDefault();
        handleFitView();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, elements, groups, pushHistory, saveCurrentBoard]);

  // Fit to Content
  const handleFitView = () => {
    if (elements.length === 0) {
      setViewport({ x: 40, y: 30, zoom: 1 });
      return;
    }
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
      const box = getGroupBoundingBox(g.id, elements);
      if (box) map.set(g.id, box);
    }
    return map;
  }, [groups, elements]);

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`relative w-full h-full overflow-hidden select-none bg-[var(--bg-canvas)] ${
        isPanning ? 'cursor-grabbing' : activeTool === 'hand' ? 'cursor-grab' : 'cursor-default'
      }`}
    >
      {/* Hidden File Input for Image/Audio/Video Uploads */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* HTML5 Canvas Background (Infinite Dot Grid + Snap Path Guide Lines) */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-auto"
        style={{ width: canvasDimensions.width, height: canvasDimensions.height }}
      />

      {/* Group Bounding Containers Layer */}
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
          return (
            <div
              key={group.id}
              className="absolute rounded-xl border-2 border-dashed border-[#8400FF]/40 bg-[#8400FF]/[0.02] transition-colors pointer-events-none"
              style={{
                left: box.x,
                top: box.y,
                width: box.width,
                height: box.height,
              }}
            >
              <div className="absolute -top-7 left-3 flex items-center gap-1.5 px-2.5 py-0.5 rounded-t-md bg-[#8400FF]/20 border border-[#8400FF]/40 text-[11px] font-mono text-white pointer-events-auto shadow-sm">
                <Layers size={11} className="text-[#8400FF]" />
                <span>{group.title}</span>
                <span className="text-[10px] text-white/50">({box.elements.length})</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Optimized Elements Layer (Only in-view elements rendered!) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {visibleElements.map((element) => {
          const isSelected = selectedIds.has(element.id);
          return (
            <div
              key={element.id}
              onMouseDown={(e) => handleElementMouseDown(e, element)}
              style={{
                left: element.x,
                top: element.y,
                width: element.width,
                height: element.height,
                zIndex: isSelected ? 50 : element.zIndex || 10,
              }}
              className={`absolute pointer-events-auto group rounded-lg transition-shadow cursor-move ${
                isSelected
                  ? 'ring-2 ring-white shadow-[0_0_20px_rgba(255,255,255,0.25)]'
                  : 'hover:ring-1 hover:ring-white/20'
              }`}
            >
              {/* 1. STICKY NOTE */}
              {element.type === 'sticky' && (
                <div
                  style={{
                    backgroundColor: element.color || '#FFFFFF',
                    color: element.textColor || '#000000',
                  }}
                  className="w-full h-full p-3.5 rounded-lg shadow-lg flex flex-col justify-between overflow-hidden relative"
                >
                  <div className="flex items-center justify-between gap-1 pb-1 border-b border-black/10">
                    <span className="font-medium text-xs truncate select-none opacity-80">
                      {element.title || 'Note'}
                    </span>
                    <StickyIcon size={12} className="opacity-40 shrink-0" />
                  </div>
                  <textarea
                    value={element.content || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setElements((prev) =>
                        prev.map((el) => (el.id === element.id ? { ...el, content: val } : el))
                      );
                    }}
                    onBlur={() => saveCurrentBoard()}
                    placeholder="Type notes..."
                    style={{ color: element.textColor || '#000000' }}
                    className="flex-1 w-full bg-transparent resize-none outline-none text-xs leading-relaxed mt-2 placeholder-black/30 font-sans"
                  />
                </div>
              )}

              {/* 2. PLAIN TEXT */}
              {element.type === 'text' && (
                <div className="w-full h-full p-2 flex items-center">
                  <textarea
                    value={element.content || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setElements((prev) =>
                        prev.map((el) => (el.id === element.id ? { ...el, content: val } : el))
                      );
                    }}
                    onBlur={() => saveCurrentBoard()}
                    style={{ fontSize: element.fontSize || 16, color: element.textColor || '#FFFFFF' }}
                    className="w-full h-full bg-transparent resize-none outline-none leading-snug font-medium font-sans"
                  />
                </div>
              )}

              {/* 3. IMAGE CARD */}
              {element.type === 'image' && (
                <div className="w-full h-full rounded-lg overflow-hidden bg-[var(--ramp-1)] border border-white/10 flex flex-col shadow-lg relative group/img">
                  <div className="flex-1 relative overflow-hidden bg-black/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={element.url}
                      alt={element.title || 'Image'}
                      className="w-full h-full object-cover select-none pointer-events-none"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <a
                        href={element.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-full bg-black/70 hover:bg-black text-white hover:scale-105 transition-all"
                        title="Open image in new tab"
                      >
                        <ExternalLink size={13} />
                      </a>
                    </div>
                  </div>
                  {element.title && (
                    <div className="px-2.5 py-1.5 bg-[var(--ramp-2)] border-t border-white/5 text-[11px] text-[var(--text-secondary)] truncate">
                      {element.title}
                    </div>
                  )}
                </div>
              )}

              {/* 4. AUDIO PLAYER CARD */}
              {element.type === 'audio' && (
                <div className="w-full h-full rounded-lg bg-[var(--ramp-1)] border border-white/10 p-3.5 flex flex-col justify-between shadow-xl relative overflow-hidden">
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

                  {/* Audio waveform visualization bars */}
                  <div className="flex items-center gap-0.5 h-6 my-1">
                    {[12, 20, 8, 24, 16, 28, 14, 22, 10, 26, 18, 12, 24, 16, 20, 8, 26, 14, 22, 12, 18, 24, 10, 16, 20].map(
                      (h, i) => (
                        <div
                          key={i}
                          style={{ height: `${h}px` }}
                          className={`flex-1 rounded-full transition-all ${
                            activeAudioId === element.id
                              ? 'bg-white animate-pulse'
                              : 'bg-white/20'
                          }`}
                        />
                      )
                    )}
                  </div>

                  {/* Scrubber & Duration */}
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

              {/* 5. VIDEO PLAYER CARD */}
              {element.type === 'video' && (
                <div className="w-full h-full rounded-lg overflow-hidden bg-[var(--ramp-1)] border border-white/10 flex flex-col shadow-xl">
                  <div className="flex items-center justify-between px-2.5 py-1.5 bg-[var(--ramp-2)] border-b border-white/5">
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

              {/* 6. LINK BOOKMARK CARD */}
              {element.type === 'link' && (
                <a
                  href={element.url}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full h-full rounded-lg bg-[var(--ramp-1)] border border-white/10 hover:border-white/30 p-3 flex flex-col justify-between shadow-lg transition-colors group/link"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        {element.metadata?.favicon && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={element.metadata.favicon}
                            alt=""
                            className="w-3.5 h-3.5 rounded shrink-0"
                          />
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

              {/* 8-Point Resize Handles (Visible when selected) */}
              {isSelected && (
                <>
                  <div
                    onMouseDown={(e) => handleResizeMouseDown(e, element, 'nw')}
                    className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-white rounded-sm cursor-nwse-resize z-50 shadow"
                  />
                  <div
                    onMouseDown={(e) => handleResizeMouseDown(e, element, 'ne')}
                    className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-white rounded-sm cursor-nesw-resize z-50 shadow"
                  />
                  <div
                    onMouseDown={(e) => handleResizeMouseDown(e, element, 'se')}
                    className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-white rounded-sm cursor-nwse-resize z-50 shadow"
                  />
                  <div
                    onMouseDown={(e) => handleResizeMouseDown(e, element, 'sw')}
                    className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-white rounded-sm cursor-nesw-resize z-50 shadow"
                  />
                  <div
                    onMouseDown={(e) => handleResizeMouseDown(e, element, 'e')}
                    className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-2 h-4 bg-white border border-white rounded-xs cursor-ew-resize z-50 shadow"
                  />
                  <div
                    onMouseDown={(e) => handleResizeMouseDown(e, element, 's')}
                    className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-2 bg-white border border-white rounded-xs cursor-ns-resize z-50 shadow"
                  />
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Miro Top Tools Bar */}
      <div className="absolute top-3 left-4 z-40 flex items-center gap-1 p-1 bg-[var(--ramp-1)]/90 backdrop-blur-md border border-white/10 rounded-lg shadow-2xl">
        <button
          onClick={() => setActiveTool('pointer')}
          className={`p-2 rounded-md transition-colors ${
            activeTool === 'pointer' ? 'bg-white/15 text-white' : 'text-[var(--text-muted)] hover:text-white'
          }`}
          title="Select / Move tool (V)"
        >
          <MousePointer size={15} />
        </button>
        <button
          onClick={() => setActiveTool('hand')}
          className={`p-2 rounded-md transition-colors ${
            activeTool === 'hand' ? 'bg-white/15 text-white' : 'text-[var(--text-muted)] hover:text-white'
          }`}
          title="Hand Pan tool (H or Space+Drag)"
        >
          <Hand size={15} />
        </button>

        <div className="w-[1px] h-5 bg-white/10 mx-1" />

        {/* Add Sticky Note */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => addStickyNote(STICKY_COLORS[0])}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-white/10 text-xs text-white transition-colors cursor-pointer"
            title="Add Sticky Note"
          >
            <StickyIcon size={14} className="text-white" />
            <span>Sticky</span>
          </button>
        </div>

        {/* Add Text */}
        <button
          onClick={addTextElement}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-white/10 text-xs text-white transition-colors cursor-pointer"
          title="Add Text Card"
        >
          <Type size={14} className="text-white" />
          <span>Text</span>
        </button>

        {/* Add Image */}
        <button
          onClick={() => handleMediaUploadClick('image')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-white/10 text-xs text-white transition-colors cursor-pointer"
          title="Upload or Drag & Drop Image"
        >
          <ImageIcon size={14} className="text-white" />
          <span>Image</span>
        </button>

        {/* Add Audio */}
        <button
          onClick={() => handleMediaUploadClick('audio')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-white/10 text-xs text-white transition-colors cursor-pointer"
          title="Upload or Drag & Drop Audio File"
        >
          <Music size={14} className="text-[#8400FF]" />
          <span>Audio</span>
        </button>

        {/* Add Video */}
        <button
          onClick={() => handleMediaUploadClick('video')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-white/10 text-xs text-white transition-colors cursor-pointer"
          title="Upload or Drag & Drop Video File"
        >
          <VideoIcon size={14} className="text-[#FF0051]" />
          <span>Video</span>
        </button>

        <div className="w-[1px] h-5 bg-white/10 mx-1" />

        {/* Magnetic Snapping Toggle */}
        <button
          onClick={() => setSnapSettings((prev) => ({ ...prev, enabled: !prev.enabled }))}
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
            snapSettings.enabled ? 'bg-white/20 text-white font-medium' : 'text-[var(--text-muted)] hover:text-white'
          }`}
          title="Toggle Magnetic Snap Alignment"
        >
          <Magnet size={14} />
          <span>Snap</span>
        </button>
      </div>

      {/* Floating Selection Actions Bar (Group, Ungroup, Delete) */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute top-16 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 px-3 py-1.5 bg-[var(--ramp-1)]/95 backdrop-blur-md border border-white/15 rounded-lg shadow-2xl text-xs text-white"
          >
            <span className="font-mono text-[11px] text-[var(--text-muted)] mr-1">
              {selectedIds.size} selected
            </span>

            {selectedIds.size >= 2 && (
              <button
                onClick={handleGroupSelected}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded hover:bg-white/10 text-white transition-colors cursor-pointer"
                title="Group selected elements (Ctrl+G)"
              >
                <Layers size={13} className="text-[#8400FF]" />
                <span>Group (Ctrl+G)</span>
              </button>
            )}

            <button
              onClick={handleUngroupSelected}
              className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/10 text-[var(--text-muted)] hover:text-white transition-colors cursor-pointer"
              title="Ungroup selected elements (Ctrl+Shift+G)"
            >
              <span>Ungroup</span>
            </button>

            <div className="w-[1px] h-4 bg-white/15 mx-1" />

            {/* Sticky Color picker if single sticky note selected */}
            {selectedIds.size === 1 &&
              elements.find((el) => selectedIds.has(el.id))?.type === 'sticky' && (
                <div className="flex items-center gap-1 mr-1">
                  {STICKY_COLORS.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => {
                        const targetId = Array.from(selectedIds)[0];
                        setElements((prev) =>
                          prev.map((el) => (el.id === targetId ? { ...el, color: c.bg, textColor: c.text } : el))
                        );
                        saveCurrentBoard();
                      }}
                      style={{ backgroundColor: c.bg }}
                      className="w-4 h-4 rounded-full border border-black/20 hover:scale-110 transition-transform"
                    />
                  ))}
                </div>
              )}

            <button
              onClick={() => {
                const next = elements.filter((el) => !selectedIds.has(el.id));
                setElements(next);
                setSelectedIds(new Set());
                pushHistory(next);
                saveCurrentBoard(next);
              }}
              className="p-1.5 rounded hover:bg-white/15 text-white/80 hover:text-white transition-colors"
              title="Delete selected (Del)"
            >
              <Trash2 size={13} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Bottom Left: Optimization & Culling Telemetry */}
      <div className="absolute bottom-4 left-4 z-40 flex items-center gap-2">
        <div className="px-2.5 py-1 rounded-md bg-[var(--ramp-1)]/85 backdrop-blur-md border border-white/10 text-[11px] font-mono text-[var(--text-muted)] flex items-center gap-2 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span>
            Canvas: <strong className="text-white">{visibleElements.length}</strong> / {elements.length} in view
          </span>
          {culledCount > 0 && (
            <span className="text-[10px] text-white/90 font-medium bg-white/10 px-1 rounded">
              ⚡ {culledCount} culled (off-screen)
            </span>
          )}
        </div>
      </div>

      {/* Floating Bottom Right: Zoom & Navigation Controls */}
      <div className="absolute bottom-4 right-4 z-40 flex items-center gap-1 p-1 bg-[var(--ramp-1)]/90 backdrop-blur-md border border-white/10 rounded-lg shadow-2xl">
        <button
          onClick={() => setViewport((prev) => ({ ...prev, zoom: Math.max(0.15, prev.zoom - 0.15) }))}
          className="p-1.5 rounded hover:bg-white/10 text-white transition-colors"
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
          className="p-1.5 rounded hover:bg-white/10 text-white transition-colors"
          title="Zoom In"
        >
          <ZoomIn size={14} />
        </button>
        <div className="w-[1px] h-4 bg-white/10 mx-0.5" />
        <button
          onClick={handleFitView}
          className="p-1.5 rounded hover:bg-white/10 text-white transition-colors"
          title="Fit to Content (Shift+1)"
        >
          <Maximize2 size={14} />
        </button>
      </div>
    </div>
  );
};

export default ProjectBoardView;
