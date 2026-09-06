'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Plus,
  X,
  Search,
  Trash2,
  Edit2,
  Copy,
  Download,
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Square,
  Circle as CircleIcon,
  Diamond as DiamondIcon,
  Database,
  Cloud,
  Type,
  MousePointer,
  ArrowRight,
  Check,
  Loader2,
  Workflow,
  Save,
  Layers,
  FileCode,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { getLocalCache, setLocalCache } from '@/lib/client-cache';
import { useRealtimeSubscription, RealtimeEvent, publishClientRealtimeEvent } from '@/lib/useRealtime';

export type ShapeType =
  | 'rectangle'
  | 'rounded-rectangle'
  | 'circle'
  | 'diamond'
  | 'cylinder'
  | 'cloud'
  | 'textbox'
  | 'capsule';

export type AnchorPosition = 'top' | 'right' | 'bottom' | 'left';

export interface ChartElement {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize?: number;
  textAlign?: 'left' | 'center' | 'right';
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  backgroundColor?: string;
  textColor?: string;
}

export interface ChartConnection {
  id: string;
  fromId: string;
  toId: string;
  fromAnchor?: AnchorPosition;
  toAnchor?: AnchorPosition;
  label?: string;
  color?: string;
  width?: number;
  dashed?: boolean;
  arrowEnd?: boolean;
}

export interface ChartViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface ChartFile {
  id: string;
  projectId: number | string;
  title: string;
  data: {
    elements: ChartElement[];
    connections: ChartConnection[];
    viewport?: ChartViewport;
  };
  createdAt: string;
  updatedAt: string;
}

interface ProjectChartsViewProps {
  projectId: number | string;
  projectName?: string;
  projectKey?: string;
}

const DEFAULT_SHAPES: { type: ShapeType; label: string; icon: React.ReactNode; width: number; height: number; defaultText: string }[] = [
  { type: 'rectangle', label: 'Rectangle', icon: <Square size={16} />, width: 160, height: 80, defaultText: 'Process' },
  { type: 'rounded-rectangle', label: 'Rounded Box', icon: <div className="w-3.5 h-3.5 rounded border border-current" />, width: 160, height: 80, defaultText: 'Component' },
  { type: 'circle', label: 'Circle', icon: <CircleIcon size={16} />, width: 110, height: 110, defaultText: 'Start / End' },
  { type: 'diamond', label: 'Diamond', icon: <DiamondIcon size={16} />, width: 130, height: 90, defaultText: 'Decision?' },
  { type: 'cylinder', label: 'Database', icon: <Database size={16} />, width: 140, height: 90, defaultText: 'Database' },
  { type: 'cloud', label: 'Cloud', icon: <Cloud size={16} />, width: 150, height: 90, defaultText: 'Cloud Service' },
  { type: 'capsule', label: 'Pill Capsule', icon: <div className="w-4 h-2.5 rounded-full border border-current" />, width: 150, height: 60, defaultText: 'State Node' },
  { type: 'textbox', label: 'Text Note', icon: <Type size={16} />, width: 150, height: 60, defaultText: 'Annotation Note' },
];

export const ProjectChartsView: React.FC<ProjectChartsViewProps> = ({
  projectId,
  projectName = 'Project',
  projectKey = 'PRJ',
}) => {
  // Client instance ID to prevent echo loops in real-time collaboration
  const clientSessionIdRef = useRef(`chart_client_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`);

  // ── Files & Tabs state ──
  const [charts, setCharts] = useState<ChartFile[]>(() => {
    return getLocalCache<ChartFile[]>(`charts_${projectId}`, []);
  });
  const [openChartIds, setOpenChartIds] = useState<string[]>(() => {
    return getLocalCache<string[]>(`charts_open_tabs_${projectId}`, []);
  });
  const [activeChartId, setActiveChartId] = useState<string | null>(() => {
    return getLocalCache<string | null>(`charts_active_tab_${projectId}`, null);
  });
  const activeChartIdRef = useRef<string | null>(activeChartId);
  useEffect(() => {
    activeChartIdRef.current = activeChartId;
  }, [activeChartId]);

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [isJustSaved, setIsJustSaved] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [newChartTitle, setNewChartTitle] = useState('');
  const [renamingChartId, setRenamingChartId] = useState<string | null>(null);
  const [renamingTitle, setRenamingTitle] = useState('');

  // ── Canvas state ──
  const [elements, setElements] = useState<ChartElement[]>([]);
  const [connections, setConnections] = useState<ChartConnection[]>([]);
  const [viewport, setViewport] = useState<ChartViewport>({ x: 0, y: 0, zoom: 1 });

  // Baseline saved state for tracking dirty changes / autosave
  const [savedElements, setSavedElements] = useState<ChartElement[]>([]);
  const [savedConnections, setSavedConnections] = useState<ChartConnection[]>([]);

  const elementsRef = useRef<ChartElement[]>(elements);
  const connectionsRef = useRef<ChartConnection[]>(connections);
  const viewportRef = useRef<ChartViewport>(viewport);

  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);
  useEffect(() => {
    connectionsRef.current = connections;
  }, [connections]);
  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [editingElementId, setEditingElementId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const editingElementIdRef = useRef<string | null>(null);
  const editingTextRef = useRef<string>('');

  useEffect(() => {
    editingElementIdRef.current = editingElementId;
  }, [editingElementId]);

  useEffect(() => {
    editingTextRef.current = editingText;
  }, [editingText]);

  const [activeTool, setActiveTool] = useState<'select' | 'link' | 'pan'>('select');

  // Interactive interaction refs and state
  const canvasRef = useRef<HTMLDivElement>(null);
  const isDraggingElementRef = useRef(false);
  const isPanningRef = useRef(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const isTouchPanningRef = useRef(false);
  const touchPanStartRef = useRef({ x: 0, y: 0 });
  const touchPinchDistRef = useRef<number | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; initialPositions: Record<string, { x: number; y: number }> }>({
    x: 0,
    y: 0,
    initialPositions: {},
  });
  const [resizingInfo, setResizingInfo] = useState<{
    elementId: string;
    handle: 'nw' | 'ne' | 'se' | 'sw';
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    initialElemX: number;
    initialElemY: number;
  } | null>(null);

  // Dynamic link dragging state with magnetic snapping
  const [linkingState, setLinkingState] = useState<{
    fromId: string;
    fromAnchor: AnchorPosition;
    currentX: number;
    currentY: number;
    snappedTarget?: {
      elemId: string;
      anchor: AnchorPosition;
      x: number;
      y: number;
    } | null;
  } | null>(null);
  const linkingStateRef = useRef(linkingState);
  useEffect(() => {
    linkingStateRef.current = linkingState;
  }, [linkingState]);

  // Undo / Redo history
  const historyRef = useRef<{ elements: ChartElement[]; connections: ChartConnection[] }[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const isHistoryActionRef = useRef(false);

  // Auto-save timer reference
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Check if current active chart has unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!activeChartId) return false;
    return (
      JSON.stringify(elements) !== JSON.stringify(savedElements) ||
      JSON.stringify(connections) !== JSON.stringify(savedConnections)
    );
  }, [activeChartId, elements, savedElements, connections, savedConnections]);

  // Push history snapshot
  const pushHistory = useCallback(
    (newElements: ChartElement[], newConnections: ChartConnection[]) => {
      if (isHistoryActionRef.current) return;
      const nextHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
      nextHistory.push({
        elements: JSON.parse(JSON.stringify(newElements)),
        connections: JSON.parse(JSON.stringify(newConnections)),
      });
      if (nextHistory.length > 30) nextHistory.shift();
      historyRef.current = nextHistory;
      historyIndexRef.current = nextHistory.length - 1;
    },
    []
  );

  // ── Manual Save (Ctrl+S / Save button) ──
  const performManualSave = useCallback(async () => {
    const chartId = activeChartIdRef.current;
    if (!chartId) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    const currentElems = elementsRef.current;
    const currentConns = connectionsRef.current;
    const currentVp = viewportRef.current;

    setIsSaving(true);
    try {
      const activeChart = charts.find((c) => c.id === chartId);
      const res = await fetch(`/api/projects/${projectId}/charts/${chartId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: activeChart?.title,
          data: {
            elements: currentElems,
            connections: currentConns,
            viewport: currentVp,
          },
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const updatedChart = json.chart;

        setSavedElements(JSON.parse(JSON.stringify(currentElems)));
        setSavedConnections(JSON.parse(JSON.stringify(currentConns)));
        setIsJustSaved(true);
        toast.success(`Saved: ${activeChart?.title || 'Diagram'}`);
        setTimeout(() => setIsJustSaved(false), 2200);

        // Instant real-time broadcast to all peers & other browser tabs
        publishClientRealtimeEvent({
          type: 'CHART_UPDATED',
          projectId: String(projectId),
          payload: updatedChart || {
            id: chartId,
            title: activeChart?.title,
            data: { elements: currentElems, connections: currentConns, viewport: currentVp },
            updatedAt: new Date().toISOString(),
          },
          senderSessionId: clientSessionIdRef.current,
        });
      } else {
        toast.error('Failed to save diagram to server');
      }
    } catch {
      toast.error('Network error saving diagram');
    } finally {
      setIsSaving(false);
    }
  }, [charts, projectId]);

  // ── Debounced Auto-Save ──
  const performAutoSave = useCallback(async () => {
    const chartId = activeChartIdRef.current;
    if (!chartId) return;

    const currentElems = elementsRef.current;
    const currentConns = connectionsRef.current;
    const currentVp = viewportRef.current;

    setIsAutoSaving(true);
    try {
      const activeChart = charts.find((c) => c.id === chartId);
      const res = await fetch(`/api/projects/${projectId}/charts/${chartId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: activeChart?.title,
          data: {
            elements: currentElems,
            connections: currentConns,
            viewport: currentVp,
          },
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const updatedChart = json.chart;

        setSavedElements(JSON.parse(JSON.stringify(currentElems)));
        setSavedConnections(JSON.parse(JSON.stringify(currentConns)));

        // Real-time live synchronization broadcast to other users
        publishClientRealtimeEvent({
          type: 'CHART_UPDATED',
          projectId: String(projectId),
          payload: updatedChart || {
            id: chartId,
            title: activeChart?.title,
            data: { elements: currentElems, connections: currentConns, viewport: currentVp },
            updatedAt: new Date().toISOString(),
          },
          senderSessionId: clientSessionIdRef.current,
        });
      }
    } catch (e) {
      console.warn('[AutoSave error]:', e);
    } finally {
      setIsAutoSaving(false);
    }
  }, [charts, projectId]);

  // Trigger debounced autosave whenever unsaved changes exist
  useEffect(() => {
    if (!activeChartId) return;
    if (!hasUnsavedChanges) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      performAutoSave();
    }, 900);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [activeChartId, hasUnsavedChanges, performAutoSave]);

  // ── Load charts from API ──
  const fetchCharts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${projectId}/charts`);
      if (res.ok) {
        const json = await res.json();
        const serverCharts: ChartFile[] = json.charts || [];
        setCharts(serverCharts);
        setLocalCache(`charts_${projectId}`, serverCharts);

        if (serverCharts.length > 0) {
          const cachedTabs = getLocalCache<string[]>(`charts_open_tabs_${projectId}`, []);
          const validTabs = cachedTabs.filter((id) => serverCharts.some((c) => c.id === id));
          const nextTabs = validTabs.length > 0 ? validTabs : [serverCharts[0].id];
          setOpenChartIds(nextTabs);
          setLocalCache(`charts_open_tabs_${projectId}`, nextTabs);

          const cachedActive = getLocalCache<string | null>(`charts_active_tab_${projectId}`, null);
          const nextActive = cachedActive && serverCharts.some((c) => c.id === cachedActive)
            ? cachedActive
            : nextTabs[0];
          setActiveChartId(nextActive);
          setLocalCache(`charts_active_tab_${projectId}`, nextActive);

          const currentChart = serverCharts.find((c) => c.id === nextActive);
          if (currentChart && currentChart.data) {
            const initialElems = currentChart.data.elements || [];
            const initialConns = currentChart.data.connections || [];
            setElements(initialElems);
            setConnections(initialConns);
            setSavedElements(JSON.parse(JSON.stringify(initialElems)));
            setSavedConnections(JSON.parse(JSON.stringify(initialConns)));
            if (currentChart.data.viewport) setViewport(currentChart.data.viewport);

            historyRef.current = [{ elements: initialElems, connections: initialConns }];
            historyIndexRef.current = 0;
          }
        }
      }
    } catch (err) {
      console.warn('Could not fetch charts from server, using cached charts:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchCharts();
  }, [fetchCharts]);

  // ── Real-Time Live Subscription ──
  useRealtimeSubscription({
    projectId,
    onEvent: useCallback(
      (event: RealtimeEvent) => {
        // Skip events dispatched by this client instance to avoid state loops
        if (event.senderSessionId && event.senderSessionId === clientSessionIdRef.current) {
          return;
        }

        switch (event.type) {
          case 'CHART_CREATED': {
            const newChart = event.payload as ChartFile;
            if (newChart && String(newChart.projectId) === String(projectId)) {
              setCharts((prev) => {
                if (prev.some((c) => c.id === newChart.id)) return prev;
                const next = [newChart, ...prev];
                setLocalCache(`charts_${projectId}`, next);
                return next;
              });
              toast.info(`New diagram created: ${newChart.title}`);
            }
            break;
          }

          case 'CHART_UPDATED': {
            const updated = event.payload as ChartFile;
            if (updated && updated.id) {
              setCharts((prev) => {
                const next = prev.map((c) =>
                  c.id === updated.id
                    ? {
                        ...c,
                        ...updated,
                        title: updated.title || c.title,
                        data: updated.data || c.data,
                        updatedAt: updated.updatedAt || new Date().toISOString(),
                      }
                    : c
                );
                setLocalCache(`charts_${projectId}`, next);
                return next;
              });

              // If the updated chart is currently being viewed, apply live changes
              if (updated.id === activeChartIdRef.current) {
                if (updated.data) {
                  // Only update if not actively dragging to preserve smooth interaction
                  if (!isDraggingElementRef.current) {
                    const incomingElems = updated.data.elements || [];
                    const incomingConns = updated.data.connections || [];
                    setElements(incomingElems);
                    setConnections(incomingConns);
                    setSavedElements(JSON.parse(JSON.stringify(incomingElems)));
                    setSavedConnections(JSON.parse(JSON.stringify(incomingConns)));
                    if (updated.data.viewport) {
                      setViewport(updated.data.viewport);
                    }
                  }
                }
              }
            }
            break;
          }

          case 'CHART_DELETED': {
            const { id: deletedId } = (event.payload || {}) as { id: string };
            if (deletedId) {
              setCharts((prev) => {
                const next = prev.filter((c) => c.id !== deletedId);
                setLocalCache(`charts_${projectId}`, next);
                return next;
              });

              setOpenChartIds((prev) => {
                const next = prev.filter((id) => id !== deletedId);
                setLocalCache(`charts_open_tabs_${projectId}`, next);
                return next;
              });

              if (activeChartIdRef.current === deletedId) {
                setActiveChartId(null);
                setLocalCache(`charts_active_tab_${projectId}`, null);
                setElements([]);
                setConnections([]);
              }
              toast.info('Diagram was deleted by a team member');
            }
            break;
          }
        }
      },
      [projectId]
    ),
  });

  // Undo / Redo actions
  const handleUndo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1;
      const snap = historyRef.current[historyIndexRef.current];
      isHistoryActionRef.current = true;
      setElements(snap.elements);
      setConnections(snap.connections);
      setTimeout(() => {
        isHistoryActionRef.current = false;
      }, 50);
    }
  }, []);

  const handleRedo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current += 1;
      const snap = historyRef.current[historyIndexRef.current];
      isHistoryActionRef.current = true;
      setElements(snap.elements);
      setConnections(snap.connections);
      setTimeout(() => {
        isHistoryActionRef.current = false;
      }, 50);
    }
  }, []);

  // Update in-memory and local cache on edits
  const syncLocalChanges = useCallback(
    (nextElements: ChartElement[], nextConnections: ChartConnection[], nextViewport = viewport) => {
      if (!activeChartId) return;

      setCharts((prev) => {
        const updated = prev.map((c) => {
          if (c.id === activeChartId) {
            return {
              ...c,
              data: {
                elements: nextElements,
                connections: nextConnections,
                viewport: nextViewport,
              },
              updatedAt: new Date().toISOString(),
            };
          }
          return c;
        });
        setLocalCache(`charts_${projectId}`, updated);
        return updated;
      });
    },
    [activeChartId, projectId, viewport]
  );

  // Commit text to element (triggered on click anywhere, blur, Set Text click, or keyboard Enter)
  const commitCurrentEditingText = useCallback(() => {
    const currentId = editingElementIdRef.current;
    if (!currentId) return;

    const textToSave = editingTextRef.current;
    const currentElements = elementsRef.current;
    const currentConnections = connectionsRef.current;

    const targetElem = currentElements.find((el) => el.id === currentId);
    const nextElements = currentElements.map((el) =>
      el.id === currentId ? { ...el, text: textToSave } : el
    );

    elementsRef.current = nextElements;
    setElements(nextElements);
    editingElementIdRef.current = null;
    setEditingElementId(null);

    // Save and push history if changed
    if (!targetElem || targetElem.text !== textToSave) {
      pushHistory(nextElements, currentConnections);
      syncLocalChanges(nextElements, currentConnections);
      toast.success('Text saved to element');
    }
  }, [pushHistory, syncLocalChanges]);

  const handleCommitElementText = useCallback(
    (elemId?: string, textToCommit?: string) => {
      if (textToCommit !== undefined) {
        editingTextRef.current = textToCommit;
      }
      if (elemId && editingElementIdRef.current !== elemId) {
        editingElementIdRef.current = elemId;
      }
      commitCurrentEditingText();
    },
    [commitCurrentEditingText]
  );

  // Global listener: clicking anywhere outside the active editing textarea automatically commits and saves the text
  useEffect(() => {
    const handleGlobalPointerDown = (e: MouseEvent | TouchEvent) => {
      if (!editingElementIdRef.current) return;

      const target = e.target as HTMLElement | null;
      if (target && target.closest('[data-chart-editing-box="true"]')) {
        return;
      }

      commitCurrentEditingText();
    };

    window.addEventListener('mousedown', handleGlobalPointerDown, true);
    window.addEventListener('touchstart', handleGlobalPointerDown, true);
    return () => {
      window.removeEventListener('mousedown', handleGlobalPointerDown, true);
      window.removeEventListener('touchstart', handleGlobalPointerDown, true);
    };
  }, [commitCurrentEditingText]);

  // Switch to a chart tab
  const handleSelectChart = useCallback(
    (chartId: string) => {
      if (editingElementIdRef.current) {
        commitCurrentEditingText();
      }
      if (chartId === activeChartId) return;

      setOpenChartIds((prev) => {
        if (!prev.includes(chartId)) {
          const next = [...prev, chartId];
          setLocalCache(`charts_open_tabs_${projectId}`, next);
          return next;
        }
        return prev;
      });

      setActiveChartId(chartId);
      setLocalCache(`charts_active_tab_${projectId}`, chartId);

      const target = charts.find((c) => c.id === chartId);
      if (target && target.data) {
        const targetElems = target.data.elements || [];
        const targetConns = target.data.connections || [];
        setElements(targetElems);
        setConnections(targetConns);
        setSavedElements(JSON.parse(JSON.stringify(targetElems)));
        setSavedConnections(JSON.parse(JSON.stringify(targetConns)));
        if (target.data.viewport) setViewport(target.data.viewport);

        historyRef.current = [
          {
            elements: JSON.parse(JSON.stringify(targetElems)),
            connections: JSON.parse(JSON.stringify(targetConns)),
          },
        ];
        historyIndexRef.current = 0;
      } else {
        setElements([]);
        setConnections([]);
        setSavedElements([]);
        setSavedConnections([]);
      }
      setSelectedElementIds([]);
      setSelectedConnectionId(null);
      setEditingElementId(null);
    },
    [activeChartId, charts, projectId]
  );

  // Close tab
  const handleCloseTab = useCallback(
    (tabId: string, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();

      const nextTabs = openChartIds.filter((id) => id !== tabId);
      setOpenChartIds(nextTabs);
      setLocalCache(`charts_open_tabs_${projectId}`, nextTabs);

      if (activeChartId === tabId) {
        if (nextTabs.length > 0) {
          const nextActive = nextTabs[nextTabs.length - 1];
          handleSelectChart(nextActive);
        } else {
          setActiveChartId(null);
          setLocalCache(`charts_active_tab_${projectId}`, null);
          setElements([]);
          setConnections([]);
          setSavedElements([]);
          setSavedConnections([]);
        }
      }
    },
    [activeChartId, handleSelectChart, openChartIds, projectId]
  );

  // Create new chart file on server and in table
  const handleCreateChart = async (customTitle?: string) => {
    const title = (customTitle || newChartTitle).trim() || `Chart ${charts.length + 1}`;
    const newId = `chart_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newChart: ChartFile = {
      id: newId,
      projectId,
      title,
      data: {
        elements: [],
        connections: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const nextCharts = [newChart, ...charts];
    setCharts(nextCharts);
    setLocalCache(`charts_${projectId}`, nextCharts);

    const nextTabs = [...openChartIds, newId];
    setOpenChartIds(nextTabs);
    setLocalCache(`charts_open_tabs_${projectId}`, nextTabs);

    setActiveChartId(newId);
    setLocalCache(`charts_active_tab_${projectId}`, newId);
    setElements([]);
    setConnections([]);
    setSavedElements([]);
    setSavedConnections([]);
    setViewport({ x: 0, y: 0, zoom: 1 });
    setSelectedElementIds([]);
    setNewChartTitle('');

    toast.success(`Created "${title}"`);

    try {
      const res = await fetch(`/api/projects/${projectId}/charts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: newId, title, data: newChart.data }),
      });
      if (res.ok) {
        const json = await res.json();
        publishClientRealtimeEvent({
          type: 'CHART_CREATED',
          projectId: String(projectId),
          payload: json.chart || newChart,
          senderSessionId: clientSessionIdRef.current,
        });
      }
    } catch (e) {
      console.error('Failed to create chart on server:', e);
    }
  };

  // Delete chart file on server and database
  const handleDeleteChart = async (chartId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const target = charts.find((c) => c.id === chartId);
    const title = target?.title || 'Chart';

    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;

    const nextCharts = charts.filter((c) => c.id !== chartId);
    setCharts(nextCharts);
    setLocalCache(`charts_${projectId}`, nextCharts);

    handleCloseTab(chartId);
    toast.info(`Deleted "${title}"`);

    try {
      await fetch(`/api/projects/${projectId}/charts/${chartId}`, {
        method: 'DELETE',
      });
      publishClientRealtimeEvent({
        type: 'CHART_DELETED',
        projectId: String(projectId),
        payload: { id: chartId },
        senderSessionId: clientSessionIdRef.current,
      });
    } catch (e) {
      console.error('Failed to delete chart on server:', e);
    }
  };

  // Rename chart file
  const handleSaveRename = async (chartId: string) => {
    const title = renamingTitle.trim();
    if (!title) {
      setRenamingChartId(null);
      return;
    }

    setCharts((prev) =>
      prev.map((c) => (c.id === chartId ? { ...c, title, updatedAt: new Date().toISOString() } : c))
    );
    setRenamingChartId(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/charts/${chartId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (res.ok) {
        const json = await res.json();
        publishClientRealtimeEvent({
          type: 'CHART_UPDATED',
          projectId: String(projectId),
          payload: json.chart,
          senderSessionId: clientSessionIdRef.current,
        });
      }
      toast.success('Diagram renamed');
    } catch (e) {
      console.error('Failed to rename chart:', e);
    }
  };

  // Duplicate chart
  const handleDuplicateChart = async (chartId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const original = charts.find((c) => c.id === chartId);
    if (!original) return;

    const newId = `chart_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const duplicate: ChartFile = {
      id: newId,
      projectId,
      title: `${original.title} (Copy)`,
      data: JSON.parse(JSON.stringify(original.data)),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const nextCharts = [duplicate, ...charts];
    setCharts(nextCharts);
    setLocalCache(`charts_${projectId}`, nextCharts);
    toast.success(`Duplicated "${original.title}"`);

    try {
      const res = await fetch(`/api/projects/${projectId}/charts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: newId, title: duplicate.title, data: duplicate.data }),
      });
      if (res.ok) {
        const json = await res.json();
        publishClientRealtimeEvent({
          type: 'CHART_CREATED',
          projectId: String(projectId),
          payload: json.chart || duplicate,
          senderSessionId: clientSessionIdRef.current,
        });
      }
    } catch (e) {
      console.error('Failed to duplicate chart to API:', e);
    }
  };

  // ── Drag and drop shape onto canvas ──
  const handleAddShape = (type: ShapeType, x?: number, y?: number) => {
    const shapeDef = DEFAULT_SHAPES.find((s) => s.type === type) || DEFAULT_SHAPES[0];

    let posX = x;
    let posY = y;

    if (posX === undefined || posY === undefined) {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        posX = (rect.width / 2 - viewport.x) / viewport.zoom - shapeDef.width / 2;
        posY = (rect.height / 2 - viewport.y) / viewport.zoom - shapeDef.height / 2;
      } else {
        posX = 150;
        posY = 150;
      }
    }

    const newElement: ChartElement = {
      id: `elem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      x: Math.round(posX),
      y: Math.round(posY),
      width: shapeDef.width,
      height: shapeDef.height,
      text: shapeDef.defaultText,
      fontSize: 14,
      textAlign: 'center',
      borderColor: '#ffffff',
      borderWidth: 2,
      borderStyle: 'solid',
      backgroundColor: '#1e1e1e',
      textColor: '#ffffff',
    };

    const nextElements = [...elements, newElement];
    setElements(nextElements);
    setSelectedElementIds([newElement.id]);
    pushHistory(nextElements, connections);
    syncLocalChanges(nextElements, connections);
  };

  // Drop on canvas container
  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const shapeType = e.dataTransfer.getData('chart/shape-type') as ShapeType;
    if (!shapeType || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const dropX = (e.clientX - rect.left - viewport.x) / viewport.zoom;
    const dropY = (e.clientY - rect.top - viewport.y) / viewport.zoom;

    const shapeDef = DEFAULT_SHAPES.find((s) => s.type === shapeType) || DEFAULT_SHAPES[0];
    handleAddShape(shapeType, dropX - shapeDef.width / 2, dropY - shapeDef.height / 2);
  };

  // ── Calculate Anchor Coordinates ──
  const getAnchorCoord = useCallback((elem: ChartElement, anchor: AnchorPosition = 'right') => {
    switch (anchor) {
      case 'top':
        return { x: elem.x + elem.width / 2, y: elem.y };
      case 'bottom':
        return { x: elem.x + elem.width / 2, y: elem.y + elem.height };
      case 'left':
        return { x: elem.x, y: elem.y + elem.height / 2 };
      case 'right':
      default:
        return { x: elem.x + elem.width, y: elem.y + elem.height / 2 };
    }
  }, []);

  // ── Compute best anchors dynamically based on relative positions of both linked elements ──
  const getDynamicAnchors = useCallback((fromElem: ChartElement, toElem: ChartElement): { fromAnchor: AnchorPosition; toAnchor: AnchorPosition } => {
    if (!fromElem || !toElem) {
      return { fromAnchor: 'right', toAnchor: 'left' };
    }

    if (fromElem.id === toElem.id) {
      return { fromAnchor: 'top', toAnchor: 'right' };
    }

    const ANCHORS: AnchorPosition[] = ['top', 'right', 'bottom', 'left'];
    const ANCHOR_NORMALS: Record<AnchorPosition, { dx: number; dy: number }> = {
      top: { dx: 0, dy: -1 },
      bottom: { dx: 0, dy: 1 },
      left: { dx: -1, dy: 0 },
      right: { dx: 1, dy: 0 },
    };

    let bestScore = Infinity;
    let bestPair: { fromAnchor: AnchorPosition; toAnchor: AnchorPosition } = {
      fromAnchor: 'right',
      toAnchor: 'left',
    };

    for (const a1 of ANCHORS) {
      const p1 = getAnchorCoord(fromElem, a1);
      const n1 = ANCHOR_NORMALS[a1];

      for (const a2 of ANCHORS) {
        const p2 = getAnchorCoord(toElem, a2);
        const n2 = ANCHOR_NORMALS[a2];

        const vx = p2.x - p1.x;
        const vy = p2.y - p1.y;
        const dist = Math.hypot(vx, vy);

        // Target must lie in front of the exit anchor (n1)
        const dotStart = vx * n1.dx + vy * n1.dy;
        // Source must lie in front of the entry anchor (-n2)
        const dotEnd = vx * (-n2.dx) + vy * (-n2.dy);

        let penalty = 0;
        if (dotStart < 0) {
          penalty += Math.abs(dotStart) * 3.5;
        }
        if (dotEnd < 0) {
          penalty += Math.abs(dotEnd) * 3.5;
        }

        // Collinear alignment preferences for clean axis-aligned connections
        if ((a1 === 'right' && a2 === 'left') || (a1 === 'left' && a2 === 'right')) {
          if (Math.abs(vy) < 40) penalty -= 35;
        }
        if ((a1 === 'bottom' && a2 === 'top') || (a1 === 'top' && a2 === 'bottom')) {
          if (Math.abs(vx) < 40) penalty -= 35;
        }

        const score = dist + penalty;
        if (score < bestScore) {
          bestScore = score;
          bestPair = { fromAnchor: a1, toAnchor: a2 };
        }
      }
    }

    return bestPair;
  }, [getAnchorCoord]);

  const getAutoAnchors = getDynamicAnchors;

  // ── Keyboard shortcuts (Ctrl+S for save, Undo, Redo, Duplicate, Delete) ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Save: Ctrl+S or Cmd+S
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        performManualSave();
        return;
      }

      // Ignore other keys if typing inside text input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      // Undo: Ctrl+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }
      // Redo: Ctrl+Y or Ctrl+Shift+Z
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Delete selected elements or connection
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedElementIds.length > 0) {
          e.preventDefault();
          const nextElements = elements.filter((elem) => !selectedElementIds.includes(elem.id));
          const nextConnections = connections.filter(
            (c) => !selectedElementIds.includes(c.fromId) && !selectedElementIds.includes(c.toId)
          );
          setElements(nextElements);
          setConnections(nextConnections);
          setSelectedElementIds([]);
          pushHistory(nextElements, nextConnections);
          syncLocalChanges(nextElements, nextConnections);
          toast.info('Deleted selected element(s)');
        } else if (selectedConnectionId) {
          e.preventDefault();
          const nextConnections = connections.filter((c) => c.id !== selectedConnectionId);
          setConnections(nextConnections);
          setSelectedConnectionId(null);
          pushHistory(elements, nextConnections);
          syncLocalChanges(elements, nextConnections);
          toast.info('Deleted connection');
        }
      }

      // Duplicate: Ctrl+D
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        if (selectedElementIds.length > 0) {
          e.preventDefault();
          const newElems: ChartElement[] = [];
          const newIds: string[] = [];

          elements.forEach((elem) => {
            if (selectedElementIds.includes(elem.id)) {
              const duplicated: ChartElement = {
                ...elem,
                id: `elem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                x: elem.x + 30,
                y: elem.y + 30,
              };
              newElems.push(duplicated);
              newIds.push(duplicated.id);
            }
          });

          const nextElements = [...elements, ...newElems];
          setElements(nextElements);
          setSelectedElementIds(newIds);
          pushHistory(nextElements, connections);
          syncLocalChanges(nextElements, connections);
        }
      }

      // Deselect on Escape
      if (e.key === 'Escape') {
        setSelectedElementIds([]);
        setSelectedConnectionId(null);
        setEditingElementId(null);
        linkingStateRef.current = null;
        setLinkingState(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    connections,
    elements,
    handleRedo,
    handleUndo,
    performManualSave,
    pushHistory,
    selectedConnectionId,
    selectedElementIds,
    syncLocalChanges,
  ]);

  // ── Complete Arrow Connection ──
  const completeLink = useCallback(
    (toElemId: string, toAnchor: AnchorPosition) => {
      const currentLinking = linkingStateRef.current;
      if (!currentLinking || currentLinking.fromId === toElemId) {
        linkingStateRef.current = null;
        setLinkingState(null);
        return;
      }

      const newConnection: ChartConnection = {
        id: `conn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        fromId: currentLinking.fromId,
        toId: toElemId,
        fromAnchor: currentLinking.fromAnchor,
        toAnchor,
        color: '#ffffff',
        width: 2,
        arrowEnd: true,
      };

      const nextConnections = [...connectionsRef.current, newConnection];
      setConnections(nextConnections);
      pushHistory(elementsRef.current, nextConnections);
      syncLocalChanges(elementsRef.current, nextConnections);
      linkingStateRef.current = null;
      setLinkingState(null);
      toast.success('Connected shapes');
    },
    [pushHistory, syncLocalChanges]
  );

  // Global mouseup listener to ensure connection snapping and pan release complete reliably
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        setIsPanning(false);
      }
      if (linkingStateRef.current) {
        if (linkingStateRef.current.snappedTarget) {
          completeLink(
            linkingStateRef.current.snappedTarget.elemId,
            linkingStateRef.current.snappedTarget.anchor
          );
        } else {
          linkingStateRef.current = null;
          setLinkingState(null);
        }
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [completeLink]);

  // ── Canvas Mouse Down (Selection, Pan on Empty Canvas, Deselect) ──
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Left-click (0) or middle-click (1) on empty canvas area initiates drag-to-pan
    if (e.button !== 0 && e.button !== 1) return;

    if (editingElementIdRef.current) {
      commitCurrentEditingText();
    }

    setSelectedElementIds([]);
    setSelectedConnectionId(null);

    // Click & hold on any empty area of the canvas allows drag to pan
    isPanningRef.current = true;
    setIsPanning(true);
    panStartRef.current = { x: e.clientX - viewport.x, y: e.clientY - viewport.y };
  };

  // ── Canvas Mouse Move (Dragging elements, panning, linking preview, resizing) ──
  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    // 1. Panning
    if (isPanningRef.current) {
      const nextX = e.clientX - panStartRef.current.x;
      const nextY = e.clientY - panStartRef.current.y;
      setViewport((prev) => {
        const next = { ...prev, x: nextX, y: nextY };
        syncLocalChanges(elementsRef.current, connectionsRef.current, next);
        return next;
      });
      return;
    }

    // 2. Resizing
    if (resizingInfo) {
      const dx = (e.clientX - resizingInfo.startX) / viewport.zoom;
      const dy = (e.clientY - resizingInfo.startY) / viewport.zoom;

      setElements((prev) =>
        prev.map((elem) => {
          if (elem.id !== resizingInfo.elementId) return elem;

          let newW = resizingInfo.startW;
          let newH = resizingInfo.startH;
          let newX = resizingInfo.initialElemX;
          let newY = resizingInfo.initialElemY;

          if (resizingInfo.handle.includes('e')) newW = Math.max(50, resizingInfo.startW + dx);
          if (resizingInfo.handle.includes('s')) newH = Math.max(30, resizingInfo.startH + dy);
          if (resizingInfo.handle.includes('w')) {
            const potentialW = Math.max(50, resizingInfo.startW - dx);
            newX = resizingInfo.initialElemX + (resizingInfo.startW - potentialW);
            newW = potentialW;
          }
          if (resizingInfo.handle.includes('n')) {
            const potentialH = Math.max(30, resizingInfo.startH - dy);
            newY = resizingInfo.initialElemY + (resizingInfo.startH - potentialH);
            newH = potentialH;
          }

          return { ...elem, width: Math.round(newW), height: Math.round(newH), x: Math.round(newX), y: Math.round(newY) };
        })
      );
      return;
    }

    // 3. Linking preview with magnetic proximity snap
    if (linkingState && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left - viewport.x) / viewport.zoom;
      const mouseY = (e.clientY - rect.top - viewport.y) / viewport.zoom;

      // Find nearest anchor on any element other than the source
      const SNAP_SCREEN_THRESHOLD = 32; // In screen pixels
      let closestAnchor: {
        elemId: string;
        anchor: AnchorPosition;
        x: number;
        y: number;
        dist: number;
      } | null = null;

      for (const elem of elements) {
        if (elem.id === linkingState.fromId) continue;
        const anchors: AnchorPosition[] = ['top', 'right', 'bottom', 'left'];
        for (const anchor of anchors) {
          const coord = getAnchorCoord(elem, anchor);
          const screenDist = Math.hypot(mouseX - coord.x, mouseY - coord.y) * viewport.zoom;
          if (screenDist <= SNAP_SCREEN_THRESHOLD) {
            if (!closestAnchor || screenDist < closestAnchor.dist) {
              closestAnchor = {
                elemId: elem.id,
                anchor,
                x: coord.x,
                y: coord.y,
                dist: screenDist,
              };
            }
          }
        }
      }

      if (closestAnchor) {
        setLinkingState({
          ...linkingState,
          currentX: closestAnchor.x,
          currentY: closestAnchor.y,
          snappedTarget: {
            elemId: closestAnchor.elemId,
            anchor: closestAnchor.anchor,
            x: closestAnchor.x,
            y: closestAnchor.y,
          },
        });
      } else {
        setLinkingState({
          ...linkingState,
          currentX: mouseX,
          currentY: mouseY,
          snappedTarget: null,
        });
      }
      return;
    }

    // 4. Dragging elements
    if (isDraggingElementRef.current) {
      const dx = (e.clientX - dragStartRef.current.x) / viewport.zoom;
      const dy = (e.clientY - dragStartRef.current.y) / viewport.zoom;

      setElements((prev) =>
        prev.map((elem) => {
          const init = dragStartRef.current.initialPositions[elem.id];
          if (init) {
            return {
              ...elem,
              x: Math.round(init.x + dx),
              y: Math.round(init.y + dy),
            };
          }
          return elem;
        })
      );
    }
  };

  // ── Canvas Mouse Up ──
  const handleCanvasMouseUp = () => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      setIsPanning(false);
    }

    if (resizingInfo) {
      setResizingInfo(null);
      const updatedConns = connectionsRef.current.map((conn) => {
        const fromElem = elementsRef.current.find((e) => e.id === conn.fromId);
        const toElem = elementsRef.current.find((e) => e.id === conn.toId);
        if (!fromElem || !toElem) return conn;
        const { fromAnchor, toAnchor } = getDynamicAnchors(fromElem, toElem);
        return { ...conn, fromAnchor, toAnchor };
      });
      setConnections(updatedConns);
      pushHistory(elements, updatedConns);
      syncLocalChanges(elements, updatedConns);
    }

    if (isDraggingElementRef.current) {
      isDraggingElementRef.current = false;
      const updatedConns = connectionsRef.current.map((conn) => {
        const fromElem = elementsRef.current.find((e) => e.id === conn.fromId);
        const toElem = elementsRef.current.find((e) => e.id === conn.toId);
        if (!fromElem || !toElem) return conn;
        const { fromAnchor, toAnchor } = getDynamicAnchors(fromElem, toElem);
        return { ...conn, fromAnchor, toAnchor };
      });
      setConnections(updatedConns);
      pushHistory(elements, updatedConns);
      syncLocalChanges(elements, updatedConns);
    }

    if (linkingStateRef.current) {
      if (linkingStateRef.current.snappedTarget) {
        completeLink(
          linkingStateRef.current.snappedTarget.elemId,
          linkingStateRef.current.snappedTarget.anchor
        );
      } else {
        linkingStateRef.current = null;
        setLinkingState(null);
      }
    }
  };

  // ── Canvas Touch Handlers (Mobile Panning & Pinch-to-Zoom without Document Overscroll) ──
  const handleCanvasTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      touchPanStartRef.current = {
        x: touch.clientX - viewport.x,
        y: touch.clientY - viewport.y,
      };
      isTouchPanningRef.current = true;
    } else if (e.touches.length === 2) {
      isTouchPanningRef.current = false;
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchPinchDistRef.current = dist;
    }
  };

  const handleCanvasTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isTouchPanningRef.current) {
      const touch = e.touches[0];
      const nextX = touch.clientX - touchPanStartRef.current.x;
      const nextY = touch.clientY - touchPanStartRef.current.y;
      setViewport((prev) => {
        const next = { ...prev, x: nextX, y: nextY };
        syncLocalChanges(elements, connections, next);
        return next;
      });
    } else if (e.touches.length === 2 && touchPinchDistRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = (dist - touchPinchDistRef.current) * 0.005;
      touchPinchDistRef.current = dist;
      setViewport((prev) => {
        const nextZoom = Math.min(3, Math.max(0.2, prev.zoom + delta));
        return { ...prev, zoom: nextZoom };
      });
    }
  };

  const handleCanvasTouchEnd = () => {
    isTouchPanningRef.current = false;
    touchPinchDistRef.current = null;
  };

  // ── Element Drag Start ──
  const handleElementMouseDown = (e: React.MouseEvent, elemId: string) => {
    if (editingElementIdRef.current && editingElementIdRef.current !== elemId) {
      commitCurrentEditingText();
    }
    e.stopPropagation();

    // If linking mode is active and we clicked another element, create connection
    if (activeTool === 'link' && selectedElementIds.length > 0 && !selectedElementIds.includes(elemId)) {
      const fromId = selectedElementIds[0];
      const fromElem = elements.find((el) => el.id === fromId);
      const toElem = elements.find((el) => el.id === elemId);

      if (fromElem && toElem) {
        const { fromAnchor, toAnchor } = getAutoAnchors(fromElem, toElem);
        const newConn: ChartConnection = {
          id: `conn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          fromId,
          toId: elemId,
          fromAnchor,
          toAnchor,
          color: '#ffffff',
          width: 2,
          arrowEnd: true,
        };
        const nextConnections = [...connections, newConn];
        setConnections(nextConnections);
        pushHistory(elements, nextConnections);
        syncLocalChanges(elements, nextConnections);
        setSelectedElementIds([elemId]);
        toast.success('Linked elements');
        return;
      }
    }

    // Selection
    if (e.shiftKey) {
      setSelectedElementIds((prev) =>
        prev.includes(elemId) ? prev.filter((id) => id !== elemId) : [...prev, elemId]
      );
    } else {
      if (!selectedElementIds.includes(elemId)) {
        setSelectedElementIds([elemId]);
      }
    }
    setSelectedConnectionId(null);

    // Prepare drag movement
    isDraggingElementRef.current = true;
    dragStartRef.current.x = e.clientX;
    dragStartRef.current.y = e.clientY;
    const initialPositions: Record<string, { x: number; y: number }> = {};
    const idsToMove = selectedElementIds.includes(elemId) ? selectedElementIds : [elemId];
    elements.forEach((el) => {
      if (idsToMove.includes(el.id)) {
        initialPositions[el.id] = { x: el.x, y: el.y };
      }
    });
    dragStartRef.current.initialPositions = initialPositions;
  };

  // ── Anchor Click / Drag to Link ──
  const handleAnchorMouseDown = (e: React.MouseEvent, elemId: string, anchor: AnchorPosition) => {
    e.stopPropagation();
    const elem = elements.find((el) => el.id === elemId);
    if (!elem) return;

    const coord = getAnchorCoord(elem, anchor);
    setLinkingState({
      fromId: elemId,
      fromAnchor: anchor,
      currentX: coord.x,
      currentY: coord.y,
      snappedTarget: null,
    });
  };

  const handleAnchorMouseUp = (e: React.MouseEvent, toElemId: string, toAnchor: AnchorPosition) => {
    e.stopPropagation();
    completeLink(toElemId, toAnchor);
  };

  // ── Zoom controls ──
  const handleZoom = (delta: number) => {
    setViewport((prev) => {
      const nextZoom = Math.min(3, Math.max(0.2, Number((prev.zoom + delta).toFixed(2))));
      const next = { ...prev, zoom: nextZoom };
      syncLocalChanges(elements, connections, next);
      return next;
    });
  };

  const handleResetZoom = () => {
    setViewport({ x: 0, y: 0, zoom: 1 });
    syncLocalChanges(elements, connections, { x: 0, y: 0, zoom: 1 });
  };

  // Fit view to content
  const handleFitView = () => {
    if (elements.length === 0 || !canvasRef.current) return;
    const minX = Math.min(...elements.map((e) => e.x));
    const minY = Math.min(...elements.map((e) => e.y));
    const maxX = Math.max(...elements.map((e) => e.x + e.width));
    const maxY = Math.max(...elements.map((e) => e.y + e.height));

    const contentW = maxX - minX + 160;
    const contentH = maxY - minY + 160;
    const rect = canvasRef.current.getBoundingClientRect();

    const zoomW = rect.width / contentW;
    const zoomH = rect.height / contentH;
    const nextZoom = Math.min(1.5, Math.max(0.3, Math.min(zoomW, zoomH)));

    const nextX = (rect.width - contentW * nextZoom) / 2 - (minX - 80) * nextZoom;
    const nextY = (rect.height - contentH * nextZoom) / 2 - (minY - 80) * nextZoom;

    const next = { x: Math.round(nextX), y: Math.round(nextY), zoom: Number(nextZoom.toFixed(2)) };
    setViewport(next);
    syncLocalChanges(elements, connections, next);
  };

  // ── Mouse Wheel Zoom (Cursor-Centered Zoom In & Out) ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (isDraggingElementRef.current || resizingInfo) return;

      const rect = canvas.getBoundingClientRect();
      const pointerX = e.clientX - rect.left;
      const pointerY = e.clientY - rect.top;

      const currentVp = viewportRef.current;
      const worldX = (pointerX - currentVp.x) / currentVp.zoom;
      const worldY = (pointerY - currentVp.y) / currentVp.zoom;

      // Multiplicative zoom scaling: wheel up (negative deltaY) zooms in, wheel down (positive deltaY) zooms out
      const zoomFactor = Math.pow(2, -e.deltaY * 0.002);
      const nextZoom = Math.min(3.0, Math.max(0.15, Number((currentVp.zoom * zoomFactor).toFixed(2))));

      if (nextZoom === currentVp.zoom) return;

      // Cursor-centered zoom: keep the world point fixed directly under the mouse pointer
      const nextX = Math.round(pointerX - worldX * nextZoom);
      const nextY = Math.round(pointerY - worldY * nextZoom);

      const nextVp = {
        x: nextX,
        y: nextY,
        zoom: nextZoom,
      };

      setViewport(nextVp);
      syncLocalChanges(elementsRef.current, connectionsRef.current, nextVp);
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [resizingInfo, syncLocalChanges]);

  // ── Export options ──
  const handleExportJSON = () => {
    const activeChart = charts.find((c) => c.id === activeChartId);
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(activeChart || { elements, connections }, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `${(activeChart?.title || 'diagram').replace(/\s+/g, '_')}.json`;
    a.click();
    toast.success('Diagram exported as JSON');
  };

  const handleExportSVG = () => {
    if (!canvasRef.current) return;
    const svgElem = canvasRef.current.querySelector('#chart-svg-layer');
    if (!svgElem) return;

    const activeChart = charts.find((c) => c.id === activeChartId);
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgElem);
    source = '<?xml version="1.0" standalone="no"?>\r\n' + source;
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${(activeChart?.title || 'diagram').replace(/\s+/g, '_')}.svg`;
    a.click();
    toast.success('Diagram exported as SVG');
  };

  // Filter charts in sidebar
  const filteredCharts = useMemo(() => {
    if (!searchQuery.trim()) return charts;
    return charts.filter((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [charts, searchQuery]);

  return (
    <div className="flex flex-col h-full max-h-full w-full bg-[#101114] text-[#E0E2E7] overflow-hidden overscroll-none select-none">
      {/* ── Top Bar: Tabs & Canvas Action Controls ── */}
      <div className="h-10 bg-[#0E0F12] border-b border-[#202226] flex items-center justify-between px-2 shrink-0 z-20 overflow-x-auto overflow-y-hidden overscroll-x-contain touch-pan-x">
        {/* Tab Switcher */}
        <div className="flex items-center gap-1 min-w-0 overflow-x-auto no-scrollbar">
          {openChartIds.length === 0 ? (
            <div className="text-xs text-[#787C83] px-2 flex items-center gap-2">
              <span>No open diagram tabs</span>
              <button
                onClick={() => {
                  setIsSidebarOpen(true);
                  handleCreateChart();
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#1A1C21] hover:bg-[#252830] text-[#DCB001] text-[11px] transition-colors"
              >
                <Plus size={11} />
                <span>New Diagram</span>
              </button>
            </div>
          ) : (
            openChartIds.map((tabId) => {
              const chart = charts.find((c) => c.id === tabId);
              const isActive = tabId === activeChartId;
              const title = chart?.title || 'Untitled Diagram';
              const tabIsDirty = isActive && hasUnsavedChanges;

              return (
                <div
                  key={tabId}
                  onClick={() => handleSelectChart(tabId)}
                  onAuxClick={(e) => {
                    if (e.button === 1) {
                      e.preventDefault();
                      handleCloseTab(tabId, e);
                    }
                  }}
                  className={`group relative flex items-center gap-2 px-3 h-8 rounded-t-lg text-xs font-mono cursor-pointer transition-all border-t-2 shrink-0 max-w-[200px] sm:max-w-[240px] ${
                    isActive
                      ? 'bg-[#15171C] text-white border-t-[#DCB001] border-x border-x-[#252830] border-b border-b-[#15171C] font-semibold shadow-sm'
                      : 'bg-[#0E0F12] text-[#8E939D] hover:text-[#CFD4DD] hover:bg-[#131519] border-t-transparent border-x border-x-transparent'
                  }`}
                  title={`${title}\nClick to view • Middle-click to close`}
                >
                  <Workflow
                    size={12}
                    className={`shrink-0 ${isActive ? 'text-[#DCB001]' : 'text-[#787C83] group-hover:text-[#A0A5B0]'}`}
                  />
                  <span className="truncate flex-1 text-[11px] sm:text-xs">{title}</span>

                  {/* Dirty Unsaved Dot */}
                  {tabIsDirty && (
                    <span
                      className="w-2 h-2 rounded-full bg-[#DCB001] shrink-0 animate-pulse"
                      title="Unsaved changes (Press Ctrl+S to save)"
                    />
                  )}

                  {/* Close tab button */}
                  <button
                    onClick={(e) => handleCloseTab(tabId, e)}
                    className="opacity-0 group-hover:opacity-100 hover:bg-[#2A2D35] text-[#787C83] hover:text-white rounded p-0.5 transition-all"
                    title="Close Tab"
                  >
                    <X size={11} />
                  </button>
                </div>
              );
            })
          )}

          {/* New Tab Button */}
          <button
            onClick={() => handleCreateChart()}
            className="flex items-center justify-center w-7 h-7 rounded hover:bg-[#1B1D23] text-[#787C83] hover:text-[#DCB001] transition-colors ml-1"
            title="Create New Diagram File"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Right side canvas tools & file actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Manual Save Button with Ctrl+S badge */}
          <button
            onClick={() => performManualSave()}
            disabled={isSaving || (!hasUnsavedChanges && !isJustSaved)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all ${
              hasUnsavedChanges
                ? 'bg-[#DCB001] text-black border-[#DCB001] shadow-sm hover:bg-[#c9a102] cursor-pointer'
                : 'bg-[#16181D] text-[#787C83] border-[#252830] opacity-80 cursor-default'
            }`}
            title="Save Diagram to Server (Ctrl+S)"
          >
            {isSaving ? (
              <Loader2 size={12} className="animate-spin" />
            ) : isJustSaved ? (
              <Check size={12} className="text-emerald-400" />
            ) : (
              <Save size={12} />
            )}
            <span>{isSaving ? 'Saving...' : isJustSaved ? 'Saved' : 'Save'}</span>
            <kbd className="hidden sm:inline-block text-[10px] font-mono opacity-80 px-1 py-0.2 rounded bg-black/20">
              Ctrl+S
            </kbd>
          </button>

          {/* Auto save status indicator */}
          <div className="flex items-center gap-1.5 text-[11px] text-[#787C83] px-1 font-mono">
            {isSaving || isAutoSaving ? (
              <div className="flex items-center gap-1 text-[#DCB001]">
                <Loader2 size={11} className="animate-spin" />
                <span>Auto-saving...</span>
              </div>
            ) : isJustSaved ? (
              <div className="flex items-center gap-1 text-emerald-400">
                <Check size={11} />
                <span>Saved</span>
              </div>
            ) : hasUnsavedChanges ? (
              <div className="flex items-center gap-1 text-[#DCB001]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#DCB001] animate-pulse" />
                <span>Unsaved</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-[#60646D]">
                <Check size={11} />
                <span>All saved</span>
              </div>
            )}
          </div>

          <div className="w-[1px] h-4 bg-[#26282E]" />

          {/* Export Menu */}
          <div className="flex items-center gap-1 bg-[#16181D] border border-[#26282E] rounded-lg p-0.5">
            <button
              onClick={handleExportSVG}
              className="px-2 py-1 text-[11px] font-medium text-[#CFD4DD] hover:text-[#DCB001] hover:bg-[#20232A] rounded transition-colors flex items-center gap-1"
              title="Download as SVG Vector"
            >
              <FileCode size={12} />
              <span>SVG</span>
            </button>
            <button
              onClick={handleExportJSON}
              className="px-2 py-1 text-[11px] font-medium text-[#CFD4DD] hover:text-[#DCB001] hover:bg-[#20232A] rounded transition-colors flex items-center gap-1"
              title="Download JSON Project"
            >
              <Download size={12} />
              <span>JSON</span>
            </button>
          </div>

          {/* Sidebar toggle */}
          <button
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            className={`p-1.5 rounded-lg border transition-colors ${
              isSidebarOpen
                ? 'bg-[#20232A] text-[#DCB001] border-[#30333D]'
                : 'bg-[#16181D] text-[#787C83] hover:text-[#CFD4DD] border-[#26282E]'
            }`}
            title={isSidebarOpen ? 'Hide Files Sidebar' : 'Show Files Sidebar'}
          >
            <Layers size={13} />
          </button>
        </div>
      </div>

      {/* ── Main Workspace Body ── */}
      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        {/* ── Left Sidebar: File Explorer ── */}
        <AnimatePresence initial={false}>
          {isSidebarOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 260, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="h-full bg-[#131418] border-r border-[#202228] flex flex-col shrink-0 overflow-hidden z-10"
            >
              {/* Sidebar Header & New Chart Button */}
              <div className="p-3 border-b border-[#202228] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#787C83]">
                    Diagram Files ({charts.length})
                  </span>
                  <button
                    onClick={() => handleCreateChart()}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-[#DCB001] hover:bg-[#b89401] text-black font-semibold text-xs shadow-sm transition-colors"
                  >
                    <Plus size={12} />
                    <span>New Chart</span>
                  </button>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-2.5 text-[#60646D]" />
                  <input
                    type="text"
                    placeholder="Search diagrams..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-7 pr-2.5 py-1.5 bg-[#0E0F12] border border-[#22252C] rounded-lg text-xs text-white placeholder-[#555963] focus:outline-none focus:border-[#DCB001]/60"
                  />
                </div>
              </div>

              {/* Diagram File List */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {filteredCharts.length === 0 ? (
                  <div className="text-center py-8 text-xs text-[#60646D]">
                    {searchQuery ? 'No matching diagrams' : 'No diagram files yet'}
                  </div>
                ) : (
                  filteredCharts.map((chart) => {
                    const isActive = chart.id === activeChartId;
                    const isRenaming = renamingChartId === chart.id;

                    return (
                      <div
                        key={chart.id}
                        onClick={() => handleSelectChart(chart.id)}
                        className={`group relative flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${
                          isActive
                            ? 'bg-[#1D1F25] text-[#DCB001] font-medium border border-[#2F323C]'
                            : 'text-[#9A9FA9] hover:bg-[#16181D] hover:text-[#CFD4DD]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Workflow size={14} className={isActive ? 'text-[#DCB001]' : 'text-[#60646D]'} />

                          {isRenaming ? (
                            <input
                              type="text"
                              autoFocus
                              value={renamingTitle}
                              onChange={(e) => setRenamingTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRename(chart.id);
                                if (e.key === 'Escape') setRenamingChartId(null);
                              }}
                              onBlur={() => handleSaveRename(chart.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full bg-[#0E0F12] border border-[#DCB001] text-xs text-white px-1.5 py-0.5 rounded focus:outline-none"
                            />
                          ) : (
                            <div className="min-w-0 flex-1">
                              <p className="text-xs truncate">{chart.title}</p>
                              <p className="text-[10px] text-[#555963] font-mono truncate">
                                {chart.data?.elements?.length || 0} elements
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenamingChartId(chart.id);
                              setRenamingTitle(chart.title);
                            }}
                            className="p-1 rounded hover:bg-[#252830] text-[#787C83] hover:text-white"
                            title="Rename"
                          >
                            <Edit2 size={11} />
                          </button>
                          <button
                            onClick={(e) => handleDuplicateChart(chart.id, e)}
                            className="p-1 rounded hover:bg-[#252830] text-[#787C83] hover:text-white"
                            title="Duplicate"
                          >
                            <Copy size={11} />
                          </button>
                          <button
                            onClick={(e) => handleDeleteChart(chart.id, e)}
                            className="p-1 rounded hover:bg-[#252830] text-[#787C83] hover:text-rose-400"
                            title="Delete"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* ── Canvas Central Area ── */}
        <div className="flex-1 flex flex-col h-full min-h-0 relative overflow-hidden bg-[#1e1e1e]">
          {/* Floating Shape Palette / Draggable Toolbar */}
          <div className="absolute top-3 left-3 sm:left-4 z-30 max-w-[calc(100vw-1.5rem)] flex items-center gap-1 bg-[#16171B]/95 backdrop-blur border border-[#2B2D33] p-1 rounded-xl shadow-2xl overflow-x-auto custom-scrollbar no-scrollbar overscroll-x-contain touch-pan-x">
            {/* Mode tools: Select / Link / Pan */}
            <button
              onClick={() => setActiveTool('select')}
              className={`p-2 rounded-lg transition-colors ${
                activeTool === 'select'
                  ? 'bg-[#DCB001] text-black shadow-sm font-semibold'
                  : 'text-[#8E939D] hover:text-white hover:bg-[#22242B]'
              }`}
              title="Select & Move Tool (V)"
            >
              <MousePointer size={15} />
            </button>

            <button
              onClick={() => {
                setActiveTool('link');
                toast.info('Click an element then click target element to link them');
              }}
              className={`p-2 rounded-lg transition-colors ${
                activeTool === 'link'
                  ? 'bg-[#DCB001] text-black shadow-sm font-semibold'
                  : 'text-[#8E939D] hover:text-white hover:bg-[#22242B]'
              }`}
              title="Connector Link Tool (L) - Link shapes together"
            >
              <ArrowRight size={15} />
            </button>

            <button
              onClick={() => setActiveTool('pan')}
              className={`p-2 rounded-lg transition-colors ${
                activeTool === 'pan'
                  ? 'bg-[#DCB001] text-black shadow-sm font-semibold'
                  : 'text-[#8E939D] hover:text-white hover:bg-[#22242B]'
              }`}
              title="Pan Tool (Hand / Middle click)"
            >
              <div className="text-xs font-bold uppercase">Pan</div>
            </button>

            <div className="w-[1px] h-6 bg-[#2B2D33] mx-1" />

            {/* Draggable Shape Items */}
            {DEFAULT_SHAPES.map((shape) => (
              <div
                key={shape.type}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('chart/shape-type', shape.type);
                }}
                onClick={() => handleAddShape(shape.type)}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-white hover:text-[#DCB001] hover:bg-[#22242B] cursor-grab active:cursor-grabbing transition-all border border-transparent hover:border-[#383B44]"
                title={`Drag & drop or click to add ${shape.label}`}
              >
                {shape.icon}
              </div>
            ))}
          </div>

          {/* Bottom Zoom & History Bar */}
          <div className="absolute bottom-4 right-4 z-30 flex items-center gap-1.5 bg-[#16171B]/95 backdrop-blur border border-[#2B2D33] p-1 rounded-xl shadow-2xl">
            <button
              onClick={handleUndo}
              className="p-1.5 rounded-lg text-[#8E939D] hover:text-white hover:bg-[#22242B] transition-colors"
              title="Undo (Ctrl+Z)"
            >
              <RotateCcw size={14} />
            </button>
            <button
              onClick={handleRedo}
              className="p-1.5 rounded-lg text-[#8E939D] hover:text-white hover:bg-[#22242B] transition-colors"
              title="Redo (Ctrl+Y)"
            >
              <RotateCw size={14} />
            </button>

            <div className="w-[1px] h-4 bg-[#2B2D33] mx-0.5" />

            <button
              onClick={() => handleZoom(-0.15)}
              className="p-1.5 rounded-lg text-[#8E939D] hover:text-white hover:bg-[#22242B] transition-colors"
              title="Zoom Out (-)"
            >
              <ZoomOut size={14} />
            </button>

            <button
              onClick={handleResetZoom}
              className="px-2 py-1 text-xs font-mono text-white hover:text-[#DCB001] rounded transition-colors"
              title="Reset Zoom to 100%"
            >
              {Math.round(viewport.zoom * 100)}%
            </button>

            <button
              onClick={() => handleZoom(0.15)}
              className="p-1.5 rounded-lg text-[#8E939D] hover:text-white hover:bg-[#22242B] transition-colors"
              title="Zoom In (+)"
            >
              <ZoomIn size={14} />
            </button>

            <button
              onClick={handleFitView}
              className="p-1.5 rounded-lg text-[#8E939D] hover:text-white hover:bg-[#22242B] transition-colors"
              title="Fit View to Content"
            >
              <Maximize2 size={14} />
            </button>
          </div>

          {/* ── Interactive Canvas Container ── */}
          <div
            ref={canvasRef}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onTouchStart={handleCanvasTouchStart}
            onTouchMove={handleCanvasTouchMove}
            onTouchEnd={handleCanvasTouchEnd}
            onTouchCancel={handleCanvasTouchEnd}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleCanvasDrop}
            className={`flex-1 w-full h-full relative overflow-hidden bg-[#1e1e1e] touch-none overscroll-none select-none ${
              isPanning ? 'cursor-grabbing' : 'cursor-grab'
            }`}
            style={{
              touchAction: 'none',
              overscrollBehavior: 'none',
              backgroundImage: 'radial-gradient(circle, rgba(255, 255, 255, 0.12) 1px, transparent 1px)',
              backgroundSize: `${24 * viewport.zoom}px ${24 * viewport.zoom}px`,
              backgroundPosition: `${viewport.x}px ${viewport.y}px`,
            }}
          >
            {/* World Container transformed by Pan & Zoom */}
            <div
              style={{
                transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
                transformOrigin: '0 0',
                width: '100%',
                height: '100%',
                position: 'absolute',
                top: 0,
                left: 0,
                pointerEvents: 'none',
              }}
            >
              {/* ── SVG Connection Layer ── */}
              <svg
                id="chart-svg-layer"
                className="overflow-visible absolute top-0 left-0 w-full h-full pointer-events-none"
              >
                <defs>
                  <marker
                    id="arrowhead-white"
                    markerWidth="10"
                    markerHeight="7"
                    refX="9"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 3.5, 0 7" fill="#ffffff" />
                  </marker>
                  <marker
                    id="arrowhead-gold"
                    markerWidth="10"
                    markerHeight="7"
                    refX="9"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 3.5, 0 7" fill="#DCB001" />
                  </marker>
                </defs>

                {/* Render Links / Connections */}
                {connections.map((conn) => {
                  const fromElem = elements.find((e) => e.id === conn.fromId);
                  const toElem = elements.find((e) => e.id === conn.toId);
                  if (!fromElem || !toElem) return null;

                  // Dynamically resolve anchors based on current positions of fromElem and toElem
                  const { fromAnchor, toAnchor } = getDynamicAnchors(fromElem, toElem);
                  const start = getAnchorCoord(fromElem, fromAnchor);
                  const end = getAnchorCoord(toElem, toAnchor);
                  const isSelected = selectedConnectionId === conn.id;

                  const dx = end.x - start.x;
                  const dy = end.y - start.y;
                  const dist = Math.hypot(dx, dy);
                  const offset = Math.max(30, Math.min(140, dist * 0.4));

                  let cp1x = start.x;
                  let cp1y = start.y;
                  let cp2x = end.x;
                  let cp2y = end.y;

                  switch (fromAnchor) {
                    case 'right':
                      cp1x = start.x + offset;
                      break;
                    case 'left':
                      cp1x = start.x - offset;
                      break;
                    case 'top':
                      cp1y = start.y - offset;
                      break;
                    case 'bottom':
                      cp1y = start.y + offset;
                      break;
                  }

                  switch (toAnchor) {
                    case 'right':
                      cp2x = end.x + offset;
                      break;
                    case 'left':
                      cp2x = end.x - offset;
                      break;
                    case 'top':
                      cp2y = end.y - offset;
                      break;
                    case 'bottom':
                      cp2y = end.y + offset;
                      break;
                  }

                  const pathD = `M ${start.x} ${start.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${end.x} ${end.y}`;
                  const midX = (start.x + end.x) / 2;
                  const midY = (start.y + end.y) / 2;

                  return (
                    <g
                      key={conn.id}
                      className="pointer-events-auto cursor-pointer"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <path
                        d={pathD}
                        fill="none"
                        stroke="transparent"
                        strokeWidth="16"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedConnectionId(conn.id);
                          setSelectedElementIds([]);
                        }}
                      />

                      <path
                        d={pathD}
                        fill="none"
                        stroke={isSelected ? '#DCB001' : conn.color || '#ffffff'}
                        strokeWidth={isSelected ? 3 : conn.width || 2}
                        strokeDasharray={conn.dashed ? '6,4' : undefined}
                        markerEnd={isSelected ? 'url(#arrowhead-gold)' : 'url(#arrowhead-white)'}
                        className="transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedConnectionId(conn.id);
                          setSelectedElementIds([]);
                        }}
                      />

                      {conn.label && (
                        <g
                          transform={`translate(${midX}, ${midY})`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedConnectionId(conn.id);
                          }}
                        >
                          <rect
                            x={-(conn.label.length * 4.5) - 6}
                            y="-10"
                            width={conn.label.length * 9 + 12}
                            height="20"
                            rx="4"
                            fill="#1e1e1e"
                            stroke={isSelected ? '#DCB001' : '#ffffff'}
                            strokeWidth="1"
                          />
                          <text
                            x="0"
                            y="4"
                            textAnchor="middle"
                            fill="#ffffff"
                            fontSize="11"
                            fontFamily="monospace"
                          >
                            {conn.label}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* Dragging Link Preview Line with magnetic snap visualization */}
                {linkingState && (() => {
                  const fromElem = elements.find((el) => el.id === linkingState.fromId);
                  if (!fromElem) return null;
                  const start = getAnchorCoord(fromElem, linkingState.fromAnchor);
                  const end = { x: linkingState.currentX, y: linkingState.currentY };

                  if (linkingState.snappedTarget) {
                    const dx = end.x - start.x;
                    const dy = end.y - start.y;
                    const offset = Math.max(40, Math.min(120, Math.abs(dx) * 0.45));
                    let cp1x = start.x + offset;
                    let cp1y = start.y;
                    let cp2x = end.x - offset;
                    let cp2y = end.y;

                    if (linkingState.fromAnchor === 'top') {
                      cp1x = start.x;
                      cp1y = start.y - offset;
                    } else if (linkingState.fromAnchor === 'bottom') {
                      cp1x = start.x;
                      cp1y = start.y + offset;
                    } else if (linkingState.fromAnchor === 'left') {
                      cp1x = start.x - offset;
                      cp1y = start.y;
                    }

                    if (linkingState.snappedTarget.anchor === 'top') {
                      cp2x = end.x;
                      cp2y = end.y - offset;
                    } else if (linkingState.snappedTarget.anchor === 'bottom') {
                      cp2x = end.x;
                      cp2y = end.y + offset;
                    } else if (linkingState.snappedTarget.anchor === 'right') {
                      cp2x = end.x + offset;
                      cp2y = end.y;
                    }

                    const pathD = `M ${start.x} ${start.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${end.x} ${end.y}`;

                    return (
                      <g className="pointer-events-none">
                        <path
                          d={pathD}
                          fill="none"
                          stroke="#DCB001"
                          strokeWidth="2.5"
                          markerEnd="url(#arrowhead-gold)"
                        />
                        {/* Glowing magnetic snap ring & center dot */}
                        <circle
                          cx={end.x}
                          cy={end.y}
                          r="14"
                          fill="rgba(220, 176, 1, 0.25)"
                          stroke="#DCB001"
                          strokeWidth="2"
                          strokeDasharray="3,3"
                        />
                        <circle
                          cx={end.x}
                          cy={end.y}
                          r="5"
                          fill="#DCB001"
                        />
                      </g>
                    );
                  }

                  return (
                    <line
                      x1={start.x}
                      y1={start.y}
                      x2={end.x}
                      y2={end.y}
                      stroke="#DCB001"
                      strokeWidth="2"
                      strokeDasharray="4,4"
                      markerEnd="url(#arrowhead-gold)"
                    />
                  );
                })()}
              </svg>

              {/* ── Elements Layer ── */}
              {elements.map((elem) => {
                const isSelected = selectedElementIds.includes(elem.id);
                const isEditing = editingElementId === elem.id;

                return (
                  <div
                    key={elem.id}
                    onMouseDown={(e) => handleElementMouseDown(e, elem.id)}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      setSelectedElementIds([elem.id]);
                      setSelectedConnectionId(null);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingElementId(elem.id);
                      setEditingText(elem.text);
                    }}
                    style={{
                      position: 'absolute',
                      left: `${elem.x}px`,
                      top: `${elem.y}px`,
                      width: `${elem.width}px`,
                      height: `${elem.height}px`,
                      pointerEvents: 'auto',
                      touchAction: 'none',
                    }}
                    className={`group cursor-move transition-shadow touch-none select-none ${
                      isSelected ? 'ring-2 ring-[#DCB001] ring-offset-2 ring-offset-[#1e1e1e]' : ''
                    }`}
                  >
                    {/* Element Shape Body: Background is #1e1e1e, border is white #ffffff, text is white #ffffff */}
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        backgroundColor: elem.backgroundColor || '#1e1e1e',
                        borderWidth: `${elem.borderWidth || 2}px`,
                        borderColor: isSelected ? '#DCB001' : elem.borderColor || '#ffffff',
                        borderStyle: elem.borderStyle || 'solid',
                        borderRadius:
                          elem.type === 'circle'
                            ? '50%'
                            : elem.type === 'rounded-rectangle'
                            ? '12px'
                            : elem.type === 'capsule'
                            ? '9999px'
                            : elem.type === 'textbox'
                            ? '6px'
                            : '4px',
                        transform: elem.type === 'diamond' ? 'scale(0.85) rotate(45deg)' : undefined,
                      }}
                      className="w-full h-full relative flex items-center justify-center p-2 shadow-lg transition-colors overflow-hidden"
                    >
                      {/* Database Cylinder Top Oval Effect */}
                      {elem.type === 'cylinder' && (
                        <div
                          className="absolute top-0 left-0 right-0 h-4 border-b-2 border-white rounded-full bg-[#1e1e1e]"
                          style={{ borderColor: isSelected ? '#DCB001' : '#ffffff' }}
                        />
                      )}

                      {/* Text content inside the element */}
                      <div
                        style={{
                          transform: elem.type === 'diamond' ? 'rotate(-45deg)' : undefined,
                          color: elem.textColor || '#ffffff',
                          fontSize: `${elem.fontSize || 14}px`,
                          textAlign: elem.textAlign || 'center',
                        }}
                        className="w-full h-full flex items-center justify-center z-10 select-none pointer-events-auto"
                      >
                        {isEditing ? (
                          <div
                            data-chart-editing-box="true"
                            className="w-full h-full relative flex items-center justify-center pointer-events-auto"
                          >
                            <textarea
                              autoFocus
                              value={editingText}
                              onChange={(e) => {
                                setEditingText(e.target.value);
                                editingTextRef.current = e.target.value;
                              }}
                              onFocus={(e) => e.currentTarget.select()}
                              onBlur={() => {
                                commitCurrentEditingText();
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  commitCurrentEditingText();
                                  return;
                                }
                                if (e.key === 'Escape') {
                                  commitCurrentEditingText();
                                }
                              }}
                              className="w-full h-full bg-black/70 text-white text-center focus:outline-none resize-none overflow-hidden font-sans border-2 border-[#DCB001] rounded px-1 py-0.5 shadow-lg"
                              style={{ fontSize: `${elem.fontSize || 14}px` }}
                            />

                            {/* Floating Enter / Set button */}
                            <div
                              data-chart-editing-box="true"
                              style={{
                                position: 'absolute',
                                bottom: '-30px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                zIndex: 60,
                              }}
                              className="flex items-center gap-1.5 bg-[#0E0F12] border border-[#DCB001] rounded-md px-2 py-0.5 shadow-2xl text-[10px] text-white font-sans pointer-events-auto whitespace-nowrap select-none"
                            >
                              <span className="text-[#A0A5B0]">Press</span>
                              <kbd className="px-1 py-0.2 bg-[#252830] text-[#DCB001] font-mono text-[9px] rounded font-bold border border-[#3A3E48]">
                                Enter
                              </kbd>
                              <span className="text-[#A0A5B0]">or</span>
                              <button
                                type="button"
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  commitCurrentEditingText();
                                }}
                                className="flex items-center gap-1 px-1.5 py-0.2 bg-[#DCB001] hover:bg-[#c9a102] text-black font-bold text-[10px] rounded transition-colors cursor-pointer"
                                title="Click to set text to element"
                              >
                                <Check size={10} className="stroke-[3]" />
                                <span>Set Text</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span className="whitespace-pre-wrap leading-tight break-words font-sans font-medium px-1">
                            {elem.text}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 4 Connection Anchor Handles (Top, Right, Bottom, Left) */}
                    {(['top', 'right', 'bottom', 'left'] as AnchorPosition[]).map((anchor) => {
                      const isTop = anchor === 'top';
                      const isBottom = anchor === 'bottom';
                      const isLeft = anchor === 'left';
                      const isRight = anchor === 'right';

                      const isSnapped =
                        linkingState?.snappedTarget?.elemId === elem.id &&
                        linkingState?.snappedTarget?.anchor === anchor;

                      const isAvailableTarget = Boolean(linkingState && elem.id !== linkingState.fromId);

                      return (
                        <div
                          key={anchor}
                          onMouseDown={(e) => handleAnchorMouseDown(e, elem.id, anchor)}
                          onMouseUp={(e) => handleAnchorMouseUp(e, elem.id, anchor)}
                          style={{
                            top: isTop ? '-6px' : isBottom ? 'calc(100% - 6px)' : 'calc(50% - 6px)',
                            left: isLeft ? '-6px' : isRight ? 'calc(100% - 6px)' : 'calc(50% - 6px)',
                          }}
                          className={`absolute w-3.5 h-3.5 rounded-full cursor-crosshair z-20 transition-all flex items-center justify-center shadow-md ${
                            isSnapped
                              ? 'bg-[#DCB001] border-2 border-white scale-150 ring-4 ring-[#DCB001]/40 opacity-100'
                              : isAvailableTarget
                              ? 'bg-[#1e1e1e] border-2 border-[#DCB001] opacity-75 hover:opacity-100 hover:scale-125'
                              : 'bg-[#1e1e1e] border-2 border-white hover:border-[#DCB001] hover:scale-125 opacity-0 group-hover:opacity-100'
                          }`}
                          title={`Link ${isAvailableTarget ? 'to' : 'from'} ${anchor}`}
                        >
                          <div
                            className={`w-1 h-1 rounded-full ${
                              isSnapped ? 'bg-black' : isAvailableTarget ? 'bg-[#DCB001]' : 'bg-white group-hover:bg-[#DCB001]'
                            }`}
                          />
                        </div>
                      );
                    })}

                    {/* Resize Handles (when selected) */}
                    {isSelected && (
                      <>
                        {(['nw', 'ne', 'se', 'sw'] as const).map((handle) => {
                          const isNorth = handle.includes('n');
                          const isWest = handle.includes('w');

                          return (
                            <div
                              key={handle}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                setResizingInfo({
                                  elementId: elem.id,
                                  handle,
                                  startX: e.clientX,
                                  startY: e.clientY,
                                  startW: elem.width,
                                  startH: elem.height,
                                  initialElemX: elem.x,
                                  initialElemY: elem.y,
                                });
                              }}
                              style={{
                                top: isNorth ? '-5px' : 'calc(100% - 5px)',
                                left: isWest ? '-5px' : 'calc(100% - 5px)',
                              }}
                              className={`absolute w-2.5 h-2.5 bg-[#DCB001] border border-black z-30 ${
                                handle === 'nw' || handle === 'se' ? 'cursor-nwse-resize' : 'cursor-nesw-resize'
                              }`}
                            />
                          );
                        })}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectChartsView;
