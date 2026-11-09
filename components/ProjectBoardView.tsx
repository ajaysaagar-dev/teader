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
  Share2,
  Globe,
  Clock,
  Search,
  Sidebar as SidebarIcon,
  Edit2,
  MoreVertical,
  CheckCheck,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Palette,
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
  BoardShareRecord,
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

const GROUP_COLORS = [
  { name: 'Neon Purple', color: '#8400FF' },
  { name: 'Cyber Pink', color: '#FF0051' },
  { name: 'Magenta', color: '#B800D8' },
  { name: 'Soft Lilac', color: '#BB86FC' },
  { name: 'Pure White', color: '#FFFFFF' },
  { name: 'Dark Minimal', color: '#171717' },
];

const TEXT_COLORS = [
  { name: 'White', color: '#FFFFFF' },
  { name: 'Dark', color: '#000000' },
  { name: 'Purple', color: '#8400FF' },
  { name: 'Pink', color: '#FF0051' },
  { name: 'Lilac', color: '#CCA5FD' },
  { name: 'Magenta', color: '#B800D8' },
];

const isImageLink = (url: string): boolean => {
  const clean = url.trim().toLowerCase();
  if (clean.startsWith('data:image/')) return true;
  if (/\.(png|jpe?g|webp|gif|svg|avif|bmp|ico)(\?.*)?$/i.test(clean)) return true;
  if (/\/(images?|photos?|img|assets|uploads|pictures?)\/.*\.(png|jpe?g|webp|gif|svg|avif|bmp)/i.test(clean)) return true;
  if (clean.includes('images.unsplash.com') || clean.includes('imgur.com') || clean.includes('wikimedia.org/wikipedia/commons')) return true;
  if (/[?&](format|ext|type|mime)=(png|jpe?g|webp|gif|svg)/i.test(clean)) return true;
  return false;
};

const findOverlappingGroup = (
  box: { x: number; y: number; width: number; height: number },
  currentGroups: BoardGroup[],
  currentElements: BoardElement[]
): { group: BoardGroup; box: { x: number; y: number; width: number; height: number; elements: BoardElement[] } } | null => {
  for (const g of currentGroups) {
    const gBox = getGroupBoundingBox(g.id, currentElements, g);
    if (!gBox) continue;
    const intersects = !(
      box.x + box.width < gBox.x ||
      box.x > gBox.x + gBox.width ||
      box.y + box.height < gBox.y ||
      box.y > gBox.y + gBox.height
    );
    if (intersects) {
      return { group: g, box: gBox };
    }
  }
  return null;
};

const attachAndExpandGroup = (
  newElem: BoardElement,
  currentGroups: BoardGroup[],
  currentElements: BoardElement[]
): { updatedElem: BoardElement; updatedGroups: BoardGroup[] } => {
  const overlap = findOverlappingGroup(
    { x: newElem.x, y: newElem.y, width: newElem.width, height: newElem.height },
    currentGroups,
    currentElements
  );
  if (!overlap) {
    return { updatedElem: newElem, updatedGroups: currentGroups };
  }

  const updatedElem = { ...newElem, groupId: overlap.group.id };
  const pad = 24;
  const minX = Math.min(overlap.box.x, newElem.x - pad);
  const minY = Math.min(overlap.box.y, newElem.y - pad);
  const maxX = Math.max(overlap.box.x + overlap.box.width, newElem.x + newElem.width + pad);
  const maxY = Math.max(overlap.box.y + overlap.box.height, newElem.y + newElem.height + pad);

  const updatedGroups = currentGroups.map((g) =>
    g.id === overlap.group.id ? { ...g, x: minX, y: minY, width: maxX - minX, height: maxY - minY } : g
  );

  return { updatedElem, updatedGroups };
};

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
  const [openBoardIds, setOpenBoardIds] = useState<string[]>(() => {
    return getLocalCache<string[]>(`boards_open_${projectId}`, []);
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
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<'pointer' | 'hand'>('pointer');
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const [snapSettings, setSnapSettings] = useState({
    enabled: true,
    snapToGrid: false,
    gridSize: 20,
    snapThreshold: 8,
  });

  // ── UI States ──
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTitleBoardId, setEditingTitleBoardId] = useState<string | null>(null);
  const [renamingTitle, setRenamingTitle] = useState('');
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 1200, height: 800 });
  const [marqueeBox, setMarqueeBox] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState<Record<string, { current: number; duration: number }>>({});
  const audioElementsRef = useRef<Record<string, HTMLAudioElement>>({});

  // ── Share Modal States ──
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareExpiry, setShareExpiry] = useState<'never' | '1h' | '24h' | '7d' | '30d'>('never');
  const [activeShare, setActiveShare] = useState<BoardShareRecord | null>(null);
  const [isGeneratingShare, setIsGeneratingShare] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // ── Undo / Redo History ──
  const historyRef = useRef<BoardElement[][]>([]);
  const historyIndexRef = useRef<number>(-1);

  const pushHistory = useCallback((newElements: BoardElement[]) => {
    const nextHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    nextHistory.push(JSON.parse(JSON.stringify(newElements)));
    if (nextHistory.length > 30) nextHistory.shift();
    historyRef.current = nextHistory;
    historyIndexRef.current = nextHistory.length - 1;
    setHasUnsavedChanges(true);
  }, []);

  // ── Switch Active Board ──
  const handleSelectBoard = useCallback((boardId: string) => {
    const target = boards.find((b) => b.id === boardId);
    if (!target) return;

    setActiveBoardId(boardId);
    setLocalCache(`boards_active_${projectId}`, boardId);

    if (!openBoardIds.includes(boardId)) {
      const nextOpen = [...openBoardIds, boardId];
      setOpenBoardIds(nextOpen);
      setLocalCache(`boards_open_${projectId}`, nextOpen);
    }

    setElements(target.data.elements || []);
    setGroups(target.data.groups || []);
    setConnections(target.data.connections || []);
    if (target.data.viewport) setViewport(target.data.viewport);

    historyRef.current = [JSON.parse(JSON.stringify(target.data.elements || []))];
    historyIndexRef.current = 0;
    setHasUnsavedChanges(false);
    setSelectedIds(new Set());
    setSelectedGroupId(null);
    setSnapGuides([]);
  }, [boards, openBoardIds, projectId]);

  // ── Close Board Tab ──
  const handleCloseTab = (tabId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const nextOpen = openBoardIds.filter((id) => id !== tabId);
    setOpenBoardIds(nextOpen);
    setLocalCache(`boards_open_${projectId}`, nextOpen);

    if (activeBoardId === tabId) {
      if (nextOpen.length > 0) {
        handleSelectBoard(nextOpen[nextOpen.length - 1]);
      } else {
        setActiveBoardId(null);
        setLocalCache(`boards_active_${projectId}`, null);
      }
    }
  };

  // ── Create New Board File ──
  const handleCreateBoard = async (customTitle?: string) => {
    const title = (customTitle || '').trim() || `Board ${boards.length + 1}`;
    const newId = `board_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const newBoard: BoardFile = {
      id: newId,
      projectId,
      title,
      data: {
        elements: [
          {
            id: `elem_welcome`,
            type: 'sticky',
            x: 200,
            y: 150,
            width: 240,
            height: 180,
            title: title,
            content: 'Welcome to your new canvas board!\n\n• Drag and drop images, audio & video\n• Zoom in/out with mouse wheel\n• Snap alignments and grouping',
            color: '#FFFFFF',
            textColor: '#000000',
          },
        ],
        groups: [],
        connections: [],
        viewport: { x: 40, y: 30, zoom: 0.9 },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const nextBoards = [newBoard, ...boards];
    setBoards(nextBoards);
    setLocalCache(`boards_${projectId}`, nextBoards);

    const nextOpen = [...openBoardIds, newId];
    setOpenBoardIds(nextOpen);
    setLocalCache(`boards_open_${projectId}`, nextOpen);

    handleSelectBoard(newId);
    toast.success(`Created board "${title}"`);

    try {
      await fetch(`/api/projects/${projectId}/boards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: newId, title, data: newBoard.data }),
      });
    } catch (err) {
      console.warn('[ProjectBoardView] Could not persist new board to server:', err);
    }
  };

  // ── Delete Board ──
  const handleDeleteBoard = async (boardId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const target = boards.find((b) => b.id === boardId);
    if (!target) return;

    if (!confirm(`Are you sure you want to delete board "${target.title}"?`)) return;

    const nextBoards = boards.filter((b) => b.id !== boardId);
    setBoards(nextBoards);
    setLocalCache(`boards_${projectId}`, nextBoards);
    handleCloseTab(boardId);
    toast.info(`Deleted board "${target.title}"`);

    try {
      await fetch(`/api/projects/${projectId}/boards/${boardId}`, { method: 'DELETE' });
    } catch {}
  };

  // ── Duplicate Board ──
  const handleDuplicateBoard = async (boardId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const target = boards.find((b) => b.id === boardId);
    if (!target) return;

    const dupId = `board_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const duplicate: BoardFile = {
      ...JSON.parse(JSON.stringify(target)),
      id: dupId,
      title: `${target.title} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const nextBoards = [duplicate, ...boards];
    setBoards(nextBoards);
    setLocalCache(`boards_${projectId}`, nextBoards);

    const nextOpen = [...openBoardIds, dupId];
    setOpenBoardIds(nextOpen);
    setLocalCache(`boards_open_${projectId}`, nextOpen);

    handleSelectBoard(dupId);
    toast.success(`Duplicated "${target.title}"`);

    try {
      await fetch(`/api/projects/${projectId}/boards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: dupId, title: duplicate.title, data: duplicate.data }),
      });
    } catch {}
  };

  // ── Rename Board ──
  const handleSaveRename = async (boardId: string) => {
    const trimmed = renamingTitle.trim();
    setEditingTitleBoardId(null);
    if (!trimmed) return;

    const nextBoards = boards.map((b) => (b.id === boardId ? { ...b, title: trimmed } : b));
    setBoards(nextBoards);
    setLocalCache(`boards_${projectId}`, nextBoards);

    try {
      await fetch(`/api/projects/${projectId}/boards/${boardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      });
    } catch {}
  };

  // ── Load Boards from API ──
  const loadBoards = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/boards`);
      if (res.ok) {
        const json = await res.json();
        const serverBoards: BoardFile[] = json.boards || [];
        setBoards(serverBoards);
        setLocalCache(`boards_${projectId}`, serverBoards);

        const cachedOpen = getLocalCache<string[]>(`boards_open_${projectId}`, []);
        const nextOpen = cachedOpen.length > 0
          ? cachedOpen.filter((id) => serverBoards.some((b) => b.id === id))
          : [serverBoards[0]?.id].filter(Boolean);

        setOpenBoardIds(nextOpen);
        setLocalCache(`boards_open_${projectId}`, nextOpen);

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
      setHasUnsavedChanges(false);
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

  // ── Share Link Management ──
  const fetchActiveShare = useCallback(async () => {
    if (!activeBoardId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/boards/${activeBoardId}/share`);
      if (res.ok) {
        const json = await res.json();
        setActiveShare(json.share);
      }
    } catch {}
  }, [activeBoardId, projectId]);

  const handleOpenShareModal = () => {
    setIsShareModalOpen(true);
    setCopiedLink(false);
    fetchActiveShare();
  };

  const handleGenerateShare = async () => {
    if (!activeBoardId) return;
    try {
      setIsGeneratingShare(true);
      const res = await fetch(`/api/projects/${projectId}/boards/${activeBoardId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiry: shareExpiry }),
      });
      if (res.ok) {
        const json = await res.json();
        setActiveShare(json.share);
        toast.success('Public share link generated');
      }
    } catch (err) {
      toast.error('Failed to generate public link');
    } finally {
      setIsGeneratingShare(false);
    }
  };

  const handleRevokeShare = async () => {
    if (!activeBoardId) return;
    try {
      await fetch(`/api/projects/${projectId}/boards/${activeBoardId}/share`, { method: 'DELETE' });
      setActiveShare(null);
      toast.info('Public link revoked');
    } catch {}
  };

  const handleCopyShareLink = () => {
    if (!activeShare) return;
    const shareUrl = `${window.location.origin}/share/board/${activeShare.token}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    toast.success('Copied share link to clipboard');
    setTimeout(() => setCopiedLink(false), 2500);
  };

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
  const visibleElements = useMemo(() => {
    return elements.filter((elem) => {
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

    ctx.fillStyle = '#0F0F0F';
    ctx.fillRect(0, 0, canvasDimensions.width, canvasDimensions.height);

    const zoom = viewport.zoom;
    const gridSize = (snapSettings.gridSize || 20) * zoom;
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

  // ── DIRECT MOUSE WHEEL ZOOM CONTROLLER ──
  // User explicitly asked: "can zoom in and out using mouse wheel on the board view"
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    // Direct mouse wheel zooms into cursor location
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
    const nextZoom = Math.min(4.0, Math.max(0.15, viewport.zoom * zoomFactor));

    const rect = containerRef.current?.getBoundingClientRect();
    const mouseX = rect ? e.clientX - rect.left : canvasDimensions.width / 2;
    const mouseY = rect ? e.clientY - rect.top : canvasDimensions.height / 2;

    const nextX = mouseX - (mouseX - viewport.x) * (nextZoom / viewport.zoom);
    const nextY = mouseY - (mouseY - viewport.y) * (nextZoom / viewport.zoom);

    setViewport({ x: nextX, y: nextY, zoom: nextZoom });
  };

  const screenToWorld = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - viewport.x) / viewport.zoom,
      y: (clientY - rect.top - viewport.y) / viewport.zoom,
    };
  }, [viewport]);

  // ── Pan Interaction ──
  const isSpacePressedRef = useRef(false);
  const panStartRef = useRef<{ startX: number; startY: number; vX: number; vY: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || activeTool === 'hand' || e.altKey || isSpacePressedRef.current) {
      panStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        vX: viewport.x,
        vY: viewport.y,
      };
      setIsPanning(true);
      return;
    }

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
        setSelectedGroupId(null);
      }
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

  // Global mouseup listener to guarantee pan cancellation even if pointer leaves canvas
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (panStartRef.current) {
        panStartRef.current = null;
        setIsPanning(false);
        saveCurrentBoard();
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [saveCurrentBoard]);

  // ── Drag & Drop Engine (Images, Audio, Video, Links, Text) ──
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const worldPos = screenToWorld(e.clientX, e.clientY);

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

          let newElem: BoardElement = {
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

          const { updatedElem, updatedGroups } = attachAndExpandGroup(newElem, groups, elements);
          newElem = updatedElem;
          if (updatedGroups !== groups) setGroups(updatedGroups);

          setElements((prev) => {
            const updated = [...prev, newElem];
            pushHistory(updated);
            saveCurrentBoard(updated, updatedGroups);
            return updated;
          });
          setSelectedIds(new Set([newElem.id]));
        } catch (err: any) {
          toast.error(err.message || 'File drop failed', { id: toastId });
        }
      }
      return;
    }

    const textData = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (textData) {
      const trimmed = textData.trim();
      const isUrl = /^https?:\/\//i.test(trimmed);

      if (isImageLink(trimmed)) {
        let newElem: BoardElement = {
          id: `elem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          type: 'image',
          x: worldPos.x,
          y: worldPos.y,
          width: 320,
          height: 220,
          url: trimmed,
        };

        const { updatedElem, updatedGroups } = attachAndExpandGroup(newElem, groups, elements);
        newElem = updatedElem;
        if (updatedGroups !== groups) setGroups(updatedGroups);

        setElements((prev) => {
          const updated = [...prev, newElem];
          pushHistory(updated);
          saveCurrentBoard(updated, updatedGroups);
          return updated;
        });
        setSelectedIds(new Set([newElem.id]));
        toast.success(newElem.groupId ? 'Image added & group expanded' : 'Image added to canvas');
      } else if (isUrl) {
        try {
          const urlObj = new URL(trimmed);
          let newElem: BoardElement = {
            id: `elem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            type: 'link',
            x: worldPos.x,
            y: worldPos.y,
            width: 280,
            height: 110,
            title: urlObj.hostname,
            url: trimmed,
            metadata: {
              domain: urlObj.hostname,
              favicon: `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`,
            },
          };

          const { updatedElem, updatedGroups } = attachAndExpandGroup(newElem, groups, elements);
          newElem = updatedElem;
          if (updatedGroups !== groups) setGroups(updatedGroups);

          setElements((prev) => {
            const updated = [...prev, newElem];
            pushHistory(updated);
            saveCurrentBoard(updated, updatedGroups);
            return updated;
          });
          setSelectedIds(new Set([newElem.id]));
          toast.success('Added link bookmark to board');
        } catch {}
      } else {
        let newElem: BoardElement = {
          id: `elem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          type: 'sticky',
          x: worldPos.x,
          y: worldPos.y,
          width: 220,
          height: 160,
          title: 'Note',
          content: trimmed,
          color: STICKY_COLORS[0].bg,
          textColor: STICKY_COLORS[0].text,
        };

        const { updatedElem, updatedGroups } = attachAndExpandGroup(newElem, groups, elements);
        newElem = updatedElem;
        if (updatedGroups !== groups) setGroups(updatedGroups);

        setElements((prev) => {
          const updated = [...prev, newElem];
          pushHistory(updated);
          saveCurrentBoard(updated, updatedGroups);
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

    setSelectedGroupId(null);

    let nextSelected = new Set(selectedIds);
    if (e.shiftKey) {
      if (nextSelected.has(element.id)) nextSelected.delete(element.id);
      else nextSelected.add(element.id);
    } else {
      if (!nextSelected.has(element.id)) {
        nextSelected = new Set([element.id]);
      }
    }

    // Do NOT force-select all elements in the group:
    // Allows freely selecting and dragging individual child elements
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
      const currentDrag = activeDragRef.current;
      if (!currentDrag) return;
      const dx = (moveEvent.clientX - currentDrag.startX) / viewport.zoom;
      const dy = (moveEvent.clientY - currentDrag.startY) / viewport.zoom;

      const primaryInitial = currentDrag.initialElems.get(element.id);
      if (!primaryInitial) return;

      const rawX = primaryInitial.x + dx;
      const rawY = primaryInitial.y + dy;

      let finalX = rawX;
      let finalY = rawY;
      let calculatedGuides: SnapGuide[] = [];

      if (snapSettings.enabled) {
        const otherElements = elements.filter((el) => !currentDrag.initialElems.has(el.id));
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
      const initialMap = currentDrag.initialElems;

      setElements((prev) =>
        prev.map((el) => {
          const init = initialMap.get(el.id);
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

      // Auto-join group and auto-expand group bounds if element touches/overlaps group
      setElements((currentElems) => {
        const movedEl = currentElems.find((el) => el.id === element.id);
        if (!movedEl) {
          pushHistory(currentElems);
          saveCurrentBoard(currentElems);
          return currentElems;
        }

        const overlap = findOverlappingGroup(
          { x: movedEl.x, y: movedEl.y, width: movedEl.width, height: movedEl.height },
          groups,
          currentElems.filter((el) => el.id !== movedEl.id)
        );

        let nextGroups = groups;
        let nextElems = currentElems;

        if (overlap) {
          const targetGrp = overlap.group;
          const pad = 24;
          const minX = Math.min(overlap.box.x, movedEl.x - pad);
          const minY = Math.min(overlap.box.y, movedEl.y - pad);
          const maxX = Math.max(overlap.box.x + overlap.box.width, movedEl.x + movedEl.width + pad);
          const maxY = Math.max(overlap.box.y + overlap.box.height, movedEl.y + movedEl.height + pad);

          nextGroups = groups.map((g) =>
            g.id === targetGrp.id ? { ...g, x: minX, y: minY, width: maxX - minX, height: maxY - minY } : g
          );
          nextElems = currentElems.map((el) =>
            el.id === movedEl.id ? { ...el, groupId: targetGrp.id } : el
          );
          setGroups(nextGroups);
          if (movedEl.groupId !== targetGrp.id) {
            toast.success('Joined group & group expanded');
          }
        } else if (element.groupId) {
          const formerGrp = groups.find((g) => g.id === element.groupId);
          if (formerGrp) {
            const formerBox = getGroupBoundingBox(formerGrp.id, currentElems, formerGrp);
            if (formerBox) {
              const stillOverlaps = !(
                movedEl.x + movedEl.width < formerBox.x ||
                movedEl.x > formerBox.x + formerBox.width ||
                movedEl.y + movedEl.height < formerBox.y ||
                movedEl.y > formerBox.y + formerBox.height
              );
              if (!stillOverlaps) {
                nextElems = currentElems.map((el) =>
                  el.id === movedEl.id ? { ...el, groupId: undefined } : el
                );
                toast.info('Detached from group');
              }
            }
          }
        }

        pushHistory(nextElems);
        saveCurrentBoard(nextElems, nextGroups);
        return nextElems;
      });
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

  // ── Group Dragging & Resizing Engines ──
  const groupDragRef = useRef<{
    groupId: string;
    startX: number;
    startY: number;
    initialGroupX: number;
    initialGroupY: number;
    initialChildPos: Map<string, { x: number; y: number }>;
  } | null>(null);

  const handleGroupMouseDown = (
    e: React.MouseEvent,
    group: BoardGroup,
    box: { x: number; y: number; width: number; height: number; elements: BoardElement[] }
  ) => {
    e.stopPropagation();
    if (activeTool === 'hand') return;

    setSelectedGroupId(group.id);
    setSelectedIds(new Set());

    const childMap = new Map<string, { x: number; y: number }>();
    const groupChildren = elements.filter((el) => el.groupId === group.id);
    for (const ch of groupChildren) {
      childMap.set(ch.id, { x: ch.x, y: ch.y });
    }

    groupDragRef.current = {
      groupId: group.id,
      startX: e.clientX,
      startY: e.clientY,
      initialGroupX: box.x,
      initialGroupY: box.y,
      initialChildPos: childMap,
    };

    const handleWindowMouseMove = (moveEvent: MouseEvent) => {
      const drag = groupDragRef.current;
      if (!drag) return;
      const dx = (moveEvent.clientX - drag.startX) / viewport.zoom;
      const dy = (moveEvent.clientY - drag.startY) / viewport.zoom;

      const nextGroupX = Math.round(drag.initialGroupX + dx);
      const nextGroupY = Math.round(drag.initialGroupY + dy);

      setGroups((prev) =>
        prev.map((g) => (g.id === group.id ? { ...g, x: nextGroupX, y: nextGroupY } : g))
      );

      setElements((prev) =>
        prev.map((el) => {
          const init = drag.initialChildPos.get(el.id);
          if (init) {
            return {
              ...el,
              x: Math.round(init.x + dx),
              y: Math.round(init.y + dy),
            };
          }
          return el;
        })
      );
    };

    const handleWindowMouseUp = () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      groupDragRef.current = null;
      pushHistory(elements);
      saveCurrentBoard();
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
  };

  const groupResizeRef = useRef<{
    groupId: string;
    handle: string;
    startX: number;
    startY: number;
    initX: number;
    initY: number;
    initW: number;
    initH: number;
  } | null>(null);

  const handleGroupResizeMouseDown = (
    e: React.MouseEvent,
    group: BoardGroup,
    handle: string,
    box: { x: number; y: number; width: number; height: number }
  ) => {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const initX = box.x;
    const initY = box.y;
    const initW = box.width;
    const initH = box.height;

    groupResizeRef.current = {
      groupId: group.id,
      handle,
      startX,
      startY,
      initX,
      initY,
      initW,
      initH,
    };

    const handleWindowMouseMove = (moveEvent: MouseEvent) => {
      const resize = groupResizeRef.current;
      if (!resize) return;
      const dx = (moveEvent.clientX - resize.startX) / viewport.zoom;
      const dy = (moveEvent.clientY - resize.startY) / viewport.zoom;

      let nextW = resize.initW;
      let nextH = resize.initH;
      let nextX = resize.initX;
      let nextY = resize.initY;

      if (handle.includes('e')) nextW = Math.max(120, resize.initW + dx);
      if (handle.includes('s')) nextH = Math.max(80, resize.initH + dy);
      if (handle.includes('w')) {
        const potentialW = Math.max(120, resize.initW - dx);
        nextX = resize.initX + (resize.initW - potentialW);
        nextW = potentialW;
      }
      if (handle.includes('n')) {
        const potentialH = Math.max(80, resize.initH - dy);
        nextY = resize.initY + (resize.initH - potentialH);
        nextH = potentialH;
      }

      setGroups((prev) =>
        prev.map((g) => (g.id === group.id ? { ...g, x: nextX, y: nextY, width: nextW, height: nextH } : g))
      );
    };

    const handleWindowMouseUp = () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      groupResizeRef.current = null;
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
    const updatedElements = elements.map((el) => (selectedIds.has(el.id) ? { ...el, groupId: newGroupId } : el));
    const box = getGroupBoundingBox(newGroupId, updatedElements);

    const newGroup: BoardGroup = {
      id: newGroupId,
      title: '',
      color: '#8400FF',
      x: box ? box.x : undefined,
      y: box ? box.y : undefined,
      width: box ? box.width : undefined,
      height: box ? box.height : undefined,
    };

    const updatedGroups = [...groups, newGroup];
    setGroups(updatedGroups);
    setElements(updatedElements);
    setSelectedGroupId(newGroupId);
    setSelectedIds(new Set());
    pushHistory(updatedElements);
    saveCurrentBoard(updatedElements, updatedGroups);
    toast.success('Elements grouped');
  };

  const handleUngroupSelected = (specificGroupId?: string) => {
    const targetGroupIds = new Set<string>();
    if (specificGroupId) {
      targetGroupIds.add(specificGroupId);
    } else {
      for (const id of selectedIds) {
        const el = elements.find((e) => e.id === id);
        if (el?.groupId) targetGroupIds.add(el.groupId);
      }
      if (selectedGroupId) targetGroupIds.add(selectedGroupId);
    }

    if (targetGroupIds.size === 0) return;

    const updatedGroups = groups.filter((g) => !targetGroupIds.has(g.id));
    const updatedElements = elements.map((el) =>
      el.groupId && targetGroupIds.has(el.groupId) ? { ...el, groupId: undefined } : el
    );

    setGroups(updatedGroups);
    setElements(updatedElements);
    setSelectedGroupId(null);
    pushHistory(updatedElements);
    saveCurrentBoard(updatedElements, updatedGroups);
    toast.success('Elements ungrouped');
  };

  const handleDeleteGroup = (groupId: string) => {
    const updatedGroups = groups.filter((g) => g.id !== groupId);
    const updatedElements = elements.map((el) =>
      el.groupId === groupId ? { ...el, groupId: undefined } : el
    );
    setGroups(updatedGroups);
    setElements(updatedElements);
    setSelectedGroupId(null);
    pushHistory(updatedElements);
    saveCurrentBoard(updatedElements, updatedGroups);
    toast.info('Group removed');
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
      const isInput = activeTag === 'input' || activeTag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable;

      if (e.code === 'Space' && !isInput && !e.repeat) {
        isSpacePressedRef.current = true;
      }

      if (isInput) {
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedGroupId) {
        e.preventDefault();
        handleDeleteGroup(selectedGroupId);
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.size > 0) {
        e.preventDefault();
        const next = elements.filter((el) => !selectedIds.has(el.id));
        setElements(next);
        setSelectedIds(new Set());
        pushHistory(next);
        saveCurrentBoard(next);
        toast.info('Deleted selected items');
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g' && !e.shiftKey) {
        e.preventDefault();
        handleGroupSelected();
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g' && e.shiftKey) {
        e.preventDefault();
        handleUngroupSelected(selectedGroupId || undefined);
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (historyIndexRef.current > 0) {
          historyIndexRef.current -= 1;
          const prevElements = historyRef.current[historyIndexRef.current];
          setElements(prevElements);
          saveCurrentBoard(prevElements);
        }
      }

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

      if (e.shiftKey && e.key === '1') {
        e.preventDefault();
        handleFitView();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
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
      const box = getGroupBoundingBox(g.id, elements, g);
      if (box) map.set(g.id, box);
    }
    return map;
  }, [groups, elements]);

  // Filtered boards for sidebar
  const filteredBoards = useMemo(() => {
    if (!searchQuery.trim()) return boards;
    return boards.filter((b) => b.title.toLowerCase().includes(searchQuery.toLowerCase().trim()));
  }, [boards, searchQuery]);

  const activeBoard = boards.find((b) => b.id === activeBoardId);

  return (
    <div className="flex flex-col w-full h-full overflow-hidden select-none bg-[var(--bg-canvas)]">
      {/* ── Top Bar: Multi-Board Tabs & Share Button ── */}
      <div className="h-9 px-3 bg-[var(--bg-canvas)] border-b border-white/10 flex items-center justify-between shrink-0 gap-2 z-30">
        {/* Left: Sidebar Toggle + Open Board Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar h-full">
          {/* File Explorer Toggle */}
          <button
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            className={`p-1.5 rounded text-xs transition-colors shrink-0 cursor-pointer ${
              isSidebarOpen ? 'bg-white/20 text-white' : 'text-[var(--text-muted)] hover:text-white hover:bg-white/5'
            }`}
            title="Toggle Boards Explorer"
          >
            <SidebarIcon size={14} />
          </button>

          <div className="w-[1px] h-4 bg-white/10 mx-0.5 shrink-0" />

          {/* Open Board Tabs (like Charts View) */}
          {openBoardIds.map((tabId) => {
            const b = boards.find((item) => item.id === tabId);
            const isActive = tabId === activeBoardId;
            const title = b?.title || 'Untitled Board';

            return (
              <div
                key={tabId}
                onClick={() => handleSelectBoard(tabId)}
                onAuxClick={(e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    handleCloseTab(tabId, e);
                  }
                }}
                className={`group relative flex items-center gap-2 px-3 h-7 rounded-t-md text-xs font-mono cursor-pointer transition-all border-t-2 shrink-0 max-w-[190px] ${
                  isActive
                    ? 'bg-[#181818] text-white border-t-white font-medium shadow-sm'
                    : 'bg-transparent text-[var(--text-muted)] hover:text-white hover:bg-white/5 border-t-transparent'
                }`}
                title={`${title}\nMiddle-click to close`}
              >
                <Layers size={11} className={`shrink-0 ${isActive ? 'text-white' : 'text-[var(--text-muted)]'}`} />
                <span className="truncate flex-1 text-[11px]">{title}</span>

                {/* Unsaved changes dot */}
                {isActive && hasUnsavedChanges && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0 animate-pulse" />
                )}

                {/* Close Tab button */}
                <button
                  onClick={(e) => handleCloseTab(tabId, e)}
                  className="opacity-0 group-hover:opacity-100 hover:bg-white/20 text-[var(--text-muted)] hover:text-white rounded p-0.5 transition-all"
                  title="Close Tab"
                >
                  <X size={10} />
                </button>
              </div>
            );
          })}

          {/* New Board Tab Button */}
          <button
            onClick={() => handleCreateBoard()}
            className="flex items-center justify-center w-6 h-6 rounded hover:bg-white/10 text-[var(--text-muted)] hover:text-white transition-colors shrink-0 cursor-pointer"
            title="Create New Canvas Board"
          >
            <Plus size={13} />
          </button>
        </div>

        {/* Right: Public Link Share Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleOpenShareModal}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white text-black hover:bg-white/90 text-xs font-semibold shadow-sm transition-all cursor-pointer"
            title="Generate & Manage Public Shareable Link"
          >
            <Share2 size={12} />
            <span>Share</span>
          </button>
        </div>
      </div>

      {/* ── Workspace Body: Optional File Explorer Sidebar + Canvas ── */}
      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        {/* Left Sidebar: Boards File Explorer */}
        <AnimatePresence initial={false}>
          {isSidebarOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 250, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="h-full bg-[#141414] border-r border-white/10 flex flex-col shrink-0 overflow-hidden z-20"
            >
              <div className="p-3 border-b border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                    Boards ({boards.length})
                  </span>
                  <button
                    onClick={() => handleCreateBoard()}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-white text-black hover:bg-white/90 text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    <Plus size={11} />
                    <span>New Board</span>
                  </button>
                </div>

                <div className="relative">
                  <Search size={11} className="absolute left-2.5 top-2.5 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    placeholder="Search boards..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-7 pr-2.5 py-1 bg-[#1A1A1A] border border-white/10 rounded text-xs text-white placeholder-white/40 outline-none focus:border-white/30"
                  />
                </div>
              </div>

              {/* Board Files List */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {filteredBoards.map((b) => {
                  const isActive = b.id === activeBoardId;
                  const isRenaming = editingTitleBoardId === b.id;

                  return (
                    <div
                      key={b.id}
                      onClick={() => handleSelectBoard(b.id)}
                      className={`group flex items-center justify-between p-2 rounded text-xs cursor-pointer transition-colors ${
                        isActive ? 'bg-white/15 text-white font-medium' : 'text-[var(--text-secondary)] hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Layers size={13} className={isActive ? 'text-white' : 'text-[var(--text-muted)]'} />
                        {isRenaming ? (
                          <input
                            type="text"
                            autoFocus
                            value={renamingTitle}
                            onChange={(e) => setRenamingTitle(e.target.value)}
                            onBlur={() => handleSaveRename(b.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename(b.id);
                              if (e.key === 'Escape') setEditingTitleBoardId(null);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-black/60 border border-white/30 rounded px-1.5 py-0.5 text-xs text-white outline-none w-full"
                          />
                        ) : (
                          <span className="truncate flex-1 text-[11px]">{b.title}</span>
                        )}
                      </div>

                      {/* Hover Actions: Rename, Duplicate, Delete */}
                      {!isRenaming && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTitleBoardId(b.id);
                              setRenamingTitle(b.title);
                            }}
                            className="p-1 rounded hover:bg-white/15 text-[var(--text-muted)] hover:text-white"
                            title="Rename Board"
                          >
                            <Edit2 size={11} />
                          </button>
                          <button
                            onClick={(e) => handleDuplicateBoard(b.id, e)}
                            className="p-1 rounded hover:bg-white/15 text-[var(--text-muted)] hover:text-white"
                            title="Duplicate Board"
                          >
                            <Copy size={11} />
                          </button>
                          <button
                            onClick={(e) => handleDeleteBoard(b.id, e)}
                            className="p-1 rounded hover:bg-white/15 text-[var(--text-muted)] hover:text-white"
                            title="Delete Board"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* ── Main Canvas Viewport ── */}
        <div
          ref={containerRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`flex-1 relative w-full h-full overflow-hidden select-none bg-[#0F0F0F] ${
            isPanning ? 'cursor-grabbing' : activeTool === 'hand' ? 'cursor-grab' : 'cursor-default'
          }`}
        >
          {/* Hidden File Input */}
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
              const isGroupSelected = selectedGroupId === group.id;
              const groupColor = group.color || '#8400FF';

              return (
                <div
                  key={group.id}
                  onMouseDown={(e) => handleGroupMouseDown(e, group, box)}
                  className={`absolute rounded-xl transition-all cursor-move ${
                    isGroupSelected
                      ? 'ring-2 ring-white/80 shadow-[0_0_25px_rgba(132,0,255,0.25)]'
                      : 'hover:ring-1 hover:ring-white/30'
                  }`}
                  style={{
                    left: box.x,
                    top: box.y,
                    width: box.width,
                    height: box.height,
                    borderColor: groupColor,
                    borderWidth: '2px',
                    borderStyle: 'dashed',
                    backgroundColor: `${groupColor}08`,
                    zIndex: isGroupSelected ? 20 : 5,
                    pointerEvents: 'auto',
                  }}
                >
                  {/* Minimalist group indicator handle (NO "Group 2" title) */}
                  <div
                    className="absolute -top-3 left-4 flex items-center gap-1.5 px-2 py-0.5 rounded-full backdrop-blur-md border text-[10px] select-none cursor-move transition-transform hover:scale-105"
                    style={{
                      borderColor: `${groupColor}60`,
                      backgroundColor: '#171717',
                      color: groupColor,
                    }}
                    title="Drag group"
                  >
                    <Layers size={11} />
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: groupColor }} />
                  </div>

                  {/* 8 Resize Handles when group is selected */}
                  {isGroupSelected && (
                    <>
                      {(['nw', 'ne', 'se', 'sw', 'n', 's', 'e', 'w'] as const).map((handle) => {
                        let posStyle: React.CSSProperties = {};
                        if (handle === 'nw') posStyle = { top: -5, left: -5, cursor: 'nwse-resize' };
                        if (handle === 'ne') posStyle = { top: -5, right: -5, cursor: 'nesw-resize' };
                        if (handle === 'se') posStyle = { bottom: -5, right: -5, cursor: 'nwse-resize' };
                        if (handle === 'sw') posStyle = { bottom: -5, left: -5, cursor: 'nesw-resize' };
                        if (handle === 'n') posStyle = { top: -5, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' };
                        if (handle === 's') posStyle = { bottom: -5, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' };
                        if (handle === 'w') posStyle = { top: '50%', left: -5, transform: 'translateY(-50%)', cursor: 'ew-resize' };
                        if (handle === 'e') posStyle = { top: '50%', right: -5, transform: 'translateY(-50%)', cursor: 'ew-resize' };

                        return (
                          <div
                            key={handle}
                            onMouseDown={(e) => handleGroupResizeMouseDown(e, group, handle, box)}
                            style={{
                              ...posStyle,
                              backgroundColor: groupColor,
                            }}
                            className="absolute w-2.5 h-2.5 rounded-full border border-white z-30 shadow-md hover:scale-125 transition-transform"
                          />
                        );
                      })}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Interactive Optimized Elements Layer */}
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
                        style={{
                          color: element.textColor || '#000000',
                          fontSize: element.fontSize ? `${element.fontSize}px` : '12px',
                          fontWeight: element.fontWeight || 'normal',
                          fontStyle: element.fontStyle || 'normal',
                          textAlign: element.textAlign || 'left',
                        }}
                        className="flex-1 w-full bg-transparent resize-none outline-none leading-relaxed mt-2 placeholder-black/30 font-sans"
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
                        style={{
                          fontSize: element.fontSize ? `${element.fontSize}px` : '16px',
                          color: element.textColor || '#FFFFFF',
                          fontWeight: element.fontWeight || 'normal',
                          fontStyle: element.fontStyle || 'normal',
                          textAlign: element.textAlign || 'left',
                        }}
                        className="w-full h-full bg-transparent resize-none outline-none leading-snug font-sans"
                      />
                    </div>
                  )}

                  {/* 3. IMAGE CARD */}
                  {element.type === 'image' && (
                    <div className="w-full h-full rounded-lg overflow-hidden bg-[#171717] border border-white/10 flex flex-col shadow-lg relative group/img">
                      <div className="flex-1 w-full h-full relative overflow-hidden bg-black/40">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={element.url}
                          alt={element.title || 'Image'}
                          className="w-full h-full object-cover select-none pointer-events-none"
                        />
                      </div>
                      {element.title && (
                        <div className="px-2.5 py-1.5 bg-[#141414] border-t border-white/5 text-[11px] text-[var(--text-secondary)] truncate">
                          {element.title}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 4. AUDIO PLAYER CARD */}
                  {element.type === 'audio' && (
                    <div className="w-full h-full rounded-lg bg-[#171717] border border-white/10 p-3.5 flex flex-col justify-between shadow-xl relative overflow-hidden">
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
                                activeAudioId === element.id
                                  ? 'bg-white animate-pulse'
                                  : 'bg-white/20'
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

                  {/* 5. VIDEO PLAYER CARD */}
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

                  {/* 6. LINK BOOKMARK CARD */}
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

                  {/* 8-Point Resize Handles */}
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
          <div className="absolute top-3 left-4 z-40 flex items-center gap-1 p-1 bg-[#171717]/90 backdrop-blur-md border border-white/10 rounded-lg shadow-2xl">
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

            <button
              onClick={() => addStickyNote(STICKY_COLORS[0])}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-white/10 text-xs text-white transition-colors cursor-pointer"
              title="Add Sticky Note"
            >
              <StickyIcon size={14} className="text-white" />
              <span>Sticky</span>
            </button>

            <button
              onClick={addTextElement}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-white/10 text-xs text-white transition-colors cursor-pointer"
              title="Add Text Card"
            >
              <Type size={14} className="text-white" />
              <span>Text</span>
            </button>

            <button
              onClick={() => handleMediaUploadClick('image')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-white/10 text-xs text-white transition-colors cursor-pointer"
              title="Upload Image"
            >
              <ImageIcon size={14} className="text-white" />
              <span>Image</span>
            </button>

            <button
              onClick={() => handleMediaUploadClick('audio')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-white/10 text-xs text-white transition-colors cursor-pointer"
              title="Upload Audio"
            >
              <Music size={14} className="text-[#8400FF]" />
              <span>Audio</span>
            </button>

            <button
              onClick={() => handleMediaUploadClick('video')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-white/10 text-xs text-white transition-colors cursor-pointer"
              title="Upload Video"
            >
              <VideoIcon size={14} className="text-[#FF0051]" />
              <span>Video</span>
            </button>

            <div className="w-[1px] h-5 bg-white/10 mx-1" />

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

          {/* Floating Selection Actions Bar */}
          <AnimatePresence>
            {/* Group Selected Toolbar */}
            {selectedGroupId && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-16 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-3 py-1.5 bg-[#171717]/95 backdrop-blur-md border border-white/15 rounded-lg shadow-2xl text-xs text-white"
              >
                <div className="flex items-center gap-1.5 mr-2">
                  <Layers size={13} className="text-[#8400FF]" />
                  <span className="text-[11px] font-mono text-[var(--text-muted)]">Group Color:</span>
                </div>

                <div className="flex items-center gap-1.5 mr-2">
                  {GROUP_COLORS.map((gc) => (
                    <button
                      key={gc.name}
                      onClick={() => {
                        setGroups((prev) =>
                          prev.map((g) => (g.id === selectedGroupId ? { ...g, color: gc.color } : g))
                        );
                        saveCurrentBoard();
                      }}
                      style={{ backgroundColor: gc.color }}
                      className="w-4 h-4 rounded-full border border-white/30 hover:scale-125 transition-transform cursor-pointer"
                      title={gc.name}
                    />
                  ))}
                </div>

                <div className="w-[1px] h-4 bg-white/15 mx-1" />

                <button
                  onClick={() => handleUngroupSelected(selectedGroupId)}
                  className="flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10 text-white transition-colors cursor-pointer"
                  title="Ungroup (Ctrl+Shift+G)"
                >
                  <span>Ungroup</span>
                </button>

                <button
                  onClick={() => handleDeleteGroup(selectedGroupId)}
                  className="p-1.5 rounded hover:bg-white/15 text-white/80 hover:text-white transition-colors cursor-pointer"
                  title="Delete group frame"
                >
                  <Trash2 size={13} />
                </button>
              </motion.div>
            )}

            {/* Elements Selected Toolbar */}
            {selectedIds.size > 0 && !selectedGroupId && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-16 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-3 py-1.5 bg-[#171717]/95 backdrop-blur-md border border-white/15 rounded-lg shadow-2xl text-xs text-white"
              >
                <span className="font-mono text-[11px] text-[var(--text-muted)] mr-1">
                  {selectedIds.size} selected
                </span>

                {/* Text Formatting Controls when 1 element selected */}
                {selectedIds.size === 1 && (() => {
                  const targetId = Array.from(selectedIds)[0];
                  const selectedEl = elements.find((el) => el.id === targetId);
                  if (!selectedEl) return null;

                  return (
                    <div className="flex items-center gap-1.5 mr-1">
                      {/* Boldness toggle */}
                      <button
                        onClick={() => {
                          const nextWeight = selectedEl.fontWeight === 'bold' ? 'normal' : 'bold';
                          setElements((prev) =>
                            prev.map((el) => (el.id === selectedEl.id ? { ...el, fontWeight: nextWeight } : el))
                          );
                          saveCurrentBoard();
                        }}
                        className={`p-1.5 rounded transition-colors cursor-pointer ${
                          selectedEl.fontWeight === 'bold' ? 'bg-white/25 text-white font-bold' : 'hover:bg-white/10 text-white/70'
                        }`}
                        title="Toggle Bold (B)"
                      >
                        <Bold size={13} />
                      </button>

                      {/* Italic toggle */}
                      <button
                        onClick={() => {
                          const nextStyle = selectedEl.fontStyle === 'italic' ? 'normal' : 'italic';
                          setElements((prev) =>
                            prev.map((el) => (el.id === selectedEl.id ? { ...el, fontStyle: nextStyle } : el))
                          );
                          saveCurrentBoard();
                        }}
                        className={`p-1.5 rounded transition-colors cursor-pointer ${
                          selectedEl.fontStyle === 'italic' ? 'bg-white/25 text-white' : 'hover:bg-white/10 text-white/70'
                        }`}
                        title="Toggle Italic (I)"
                      >
                        <Italic size={13} />
                      </button>

                      {/* Font Size decrease / indicator / increase */}
                      <div className="flex items-center bg-black/40 rounded border border-white/10 px-1 py-0.5 text-[11px] gap-1">
                        <button
                          onClick={() => {
                            const cur = selectedEl.fontSize || (selectedEl.type === 'text' ? 16 : 12);
                            const nextSize = Math.max(10, cur - 2);
                            setElements((prev) =>
                              prev.map((el) => (el.id === selectedEl.id ? { ...el, fontSize: nextSize } : el))
                            );
                            saveCurrentBoard();
                          }}
                          className="px-1 hover:text-white text-white/70 cursor-pointer"
                          title="Decrease Font Size"
                        >
                          -
                        </button>
                        <span className="font-mono px-0.5 text-white/90">
                          {selectedEl.fontSize || (selectedEl.type === 'text' ? 16 : 12)}
                        </span>
                        <button
                          onClick={() => {
                            const cur = selectedEl.fontSize || (selectedEl.type === 'text' ? 16 : 12);
                            const nextSize = Math.min(64, cur + 2);
                            setElements((prev) =>
                              prev.map((el) => (el.id === selectedEl.id ? { ...el, fontSize: nextSize } : el))
                            );
                            saveCurrentBoard();
                          }}
                          className="px-1 hover:text-white text-white/70 cursor-pointer"
                          title="Increase Font Size"
                        >
                          +
                        </button>
                      </div>

                      {/* Text Color Swatches */}
                      <div className="flex items-center gap-1 mx-1">
                        {TEXT_COLORS.map((tc) => (
                          <button
                            key={tc.name}
                            onClick={() => {
                              setElements((prev) =>
                                prev.map((el) => (el.id === selectedEl.id ? { ...el, textColor: tc.color } : el))
                              );
                              saveCurrentBoard();
                            }}
                            style={{ backgroundColor: tc.color }}
                            className="w-3.5 h-3.5 rounded-full border border-white/30 hover:scale-125 transition-transform cursor-pointer"
                            title={`Text Color: ${tc.name}`}
                          />
                        ))}
                      </div>

                      {/* Text Alignment */}
                      <div className="flex items-center bg-black/40 rounded border border-white/10">
                        <button
                          onClick={() => {
                            setElements((prev) =>
                              prev.map((el) => (el.id === selectedEl.id ? { ...el, textAlign: 'left' } : el))
                            );
                            saveCurrentBoard();
                          }}
                          className={`p-1 rounded-l transition-colors cursor-pointer ${
                            (selectedEl.textAlign || 'left') === 'left' ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'
                          }`}
                          title="Align Left"
                        >
                          <AlignLeft size={11} />
                        </button>
                        <button
                          onClick={() => {
                            setElements((prev) =>
                              prev.map((el) => (el.id === selectedEl.id ? { ...el, textAlign: 'center' } : el))
                            );
                            saveCurrentBoard();
                          }}
                          className={`p-1 transition-colors cursor-pointer ${
                            selectedEl.textAlign === 'center' ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'
                          }`}
                          title="Align Center"
                        >
                          <AlignCenter size={11} />
                        </button>
                        <button
                          onClick={() => {
                            setElements((prev) =>
                              prev.map((el) => (el.id === selectedEl.id ? { ...el, textAlign: 'right' } : el))
                            );
                            saveCurrentBoard();
                          }}
                          className={`p-1 rounded-r transition-colors cursor-pointer ${
                            selectedEl.textAlign === 'right' ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'
                          }`}
                          title="Align Right"
                        >
                          <AlignRight size={11} />
                        </button>
                      </div>

                      {/* Note Background Color (for sticky notes) */}
                      {selectedEl.type === 'sticky' && (
                        <div className="flex items-center gap-1 ml-1 pl-1 border-l border-white/15">
                          {STICKY_COLORS.map((c) => (
                            <button
                              key={c.name}
                              onClick={() => {
                                setElements((prev) =>
                                  prev.map((el) => (el.id === selectedEl.id ? { ...el, color: c.bg, textColor: c.text } : el))
                                );
                                saveCurrentBoard();
                              }}
                              style={{ backgroundColor: c.bg }}
                              className="w-3.5 h-3.5 rounded-full border border-black/30 hover:scale-125 transition-transform cursor-pointer"
                              title={`Note: ${c.name}`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Multi-selection Group button */}
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

                {/* Ungroup if element in a group */}
                {Array.from(selectedIds).some((id) => elements.find((el) => el.id === id)?.groupId) && (
                  <button
                    onClick={() => handleUngroupSelected()}
                    className="flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10 text-[var(--text-muted)] hover:text-white transition-colors cursor-pointer"
                    title="Detach from group"
                  >
                    <span>Ungroup</span>
                  </button>
                )}

                <div className="w-[1px] h-4 bg-white/15 mx-1" />

                <button
                  onClick={() => {
                    const next = elements.filter((el) => !selectedIds.has(el.id));
                    setElements(next);
                    setSelectedIds(new Set());
                    pushHistory(next);
                    saveCurrentBoard(next);
                  }}
                  className="p-1.5 rounded hover:bg-white/15 text-white/80 hover:text-white transition-colors cursor-pointer"
                  title="Delete selected (Del)"
                >
                  <Trash2 size={13} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Floating Bottom Left: Optimization & Culling Telemetry */}
          <div className="absolute bottom-4 left-4 z-40 flex items-center gap-2">
            <div className="px-2.5 py-1 rounded-md bg-[#171717]/85 backdrop-blur-md border border-white/10 text-[11px] font-mono text-[var(--text-muted)] flex items-center gap-2 shadow-lg">
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
              onClick={() => setViewport((prev) => ({ ...prev, zoom: Math.min(4.0, prev.zoom + 0.15) }))}
              className="p-1.5 rounded hover:bg-white/10 text-white transition-colors cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </button>
            <div className="w-[1px] h-4 bg-white/10 mx-0.5" />
            <button
              onClick={handleFitView}
              className="p-1.5 rounded hover:bg-white/10 text-white transition-colors cursor-pointer"
              title="Fit to Content (Shift+1)"
            >
              <Maximize2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Public Share Modal / Popover ── */}
      <AnimatePresence>
        {isShareModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-[#141414] border border-white/15 rounded-xl shadow-2xl p-5 space-y-4 font-sans text-white"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white">
                    <Globe size={14} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Share Board via Public Link</h3>
                    <p className="text-[11px] text-[var(--text-muted)] font-mono">{activeBoard?.title}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsShareModalOpen(false)}
                  className="p-1 rounded hover:bg-white/10 text-[var(--text-muted)] hover:text-white"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Expiry Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-secondary)]">Link Expiration</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'never', label: 'No Expiry' },
                    { id: '1h', label: '1 Hour' },
                    { id: '24h', label: '24 Hours' },
                    { id: '7d', label: '7 Days' },
                    { id: '30d', label: '30 Days' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setShareExpiry(opt.id as any)}
                      className={`px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer text-center ${
                        shareExpiry === opt.id
                          ? 'bg-white text-black font-semibold'
                          : 'bg-[#1F1F1F] text-[var(--text-secondary)] hover:text-white hover:bg-[#2A2A2A]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Share Link Display */}
              {activeShare ? (
                <div className="space-y-3 pt-2">
                  <div className="p-3 bg-[#1A1A1A] rounded-lg border border-white/10 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)]">
                      <span>Public Link Ready</span>
                      <span className="text-white/80">
                        {activeShare.expiresAt
                          ? `Expires: ${new Date(activeShare.expiresAt).toLocaleDateString()} ${new Date(
                              activeShare.expiresAt
                            ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                          : 'Never expires'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        readOnly
                        value={
                          typeof window !== 'undefined'
                            ? `${window.location.origin}/share/board/${activeShare.token}`
                            : ''
                        }
                        className="flex-1 px-2.5 py-1.5 bg-black/60 border border-white/15 rounded text-xs text-white font-mono outline-none truncate"
                      />
                      <button
                        onClick={handleCopyShareLink}
                        className="flex items-center gap-1 px-3 py-1.5 rounded bg-white text-black hover:bg-white/90 text-xs font-semibold shrink-0 cursor-pointer"
                      >
                        {copiedLink ? <CheckCheck size={13} /> : <Copy size={13} />}
                        <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <a
                      href={`/share/board/${activeShare.token}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-white/70 hover:text-white underline"
                    >
                      <span>Open preview</span>
                      <ExternalLink size={11} />
                    </a>

                    <button
                      onClick={handleRevokeShare}
                      className="text-xs text-white/60 hover:text-white hover:underline cursor-pointer"
                    >
                      Revoke Link
                    </button>
                  </div>
                </div>
              ) : (
                <div className="pt-2">
                  <button
                    onClick={handleGenerateShare}
                    disabled={isGeneratingShare}
                    className="w-full py-2 rounded-lg bg-white text-black hover:bg-white/90 text-xs font-semibold transition-all cursor-pointer shadow-md disabled:opacity-50"
                  >
                    {isGeneratingShare ? 'Generating Link...' : 'Generate Public Link'}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProjectBoardView;
