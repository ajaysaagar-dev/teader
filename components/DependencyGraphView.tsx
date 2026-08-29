'use client';

import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';

import { Issue, Status, Priority } from '@/lib/types';
import { 
  GitFork, 
  GitBranch, 
  GitCommit, 
  GitMerge, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  Layers, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  Sparkles,
  ArrowRight,
  User,
  Calendar,
  Filter,
  Check,
  ChevronLeft,
  ChevronRight,
  MoveHorizontal,
  Activity,
  TrendingUp,
  Sliders,
  History,
  FileEdit,
  ArrowUpRight
} from 'lucide-react';

interface DependencyGraphViewProps {
  issues: Issue[];
  onSelectIssue: (id: string) => void;
  onOpenNewIssue?: () => void;
}

interface TimelineNode {
  id: string;
  issue: Issue;
  x: number;
  y: number;
  creationX: number;
  creationY: number;
  evolutionY: number;
  width: number;
  height: number;
  timeSlot: number;
  trackIndex: number;
  userColor: string;
  userName: string;
  dateStr: string;
  updatedDateStr: string;
  hasUpdates: boolean;
  revisionCount: number;
  mutationType: string;
  mutationDeltaLabel: string;
}

interface TimelineEdge {
  id: string;
  fromKey: string;
  toKey: string;
  fromNode: TimelineNode;
  toNode: TimelineNode;
  color: string;
  actionType: 'dependency' | 'branch' | 'merge' | 'sequence' | 'vertical_evolution';
  user: string;
}

// ─── Vibrant Palette for User Branch Colors (Plastic SCM / Unity Style) ───────
const USER_BRANCH_COLORS = [
  '#06B6D4', // Vibrant Cyan
  '#10B981', // Emerald Green
  '#A855F7', // Electric Purple
  '#F59E0B', // Golden Amber
  '#F43F5E', // Rose / Coral
  '#3B82F6', // Royal Blue
  '#84CC16', // Lime
  '#EC4899', // Pink
  '#14B8A6', // Teal
  '#EAB308', // Yellow
];

function getUserColor(userName: string): string {
  if (!userName || userName === 'Unassigned') return '#787C83';
  let hash = 0;
  for (let i = 0; i < userName.length; i++) {
    hash = (hash << 5) - hash + userName.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % USER_BRANCH_COLORS.length;
  return USER_BRANCH_COLORS[index];
}

function parseBlockedBy(blockedBy: any): string[] {
  if (!blockedBy) return [];
  if (Array.isArray(blockedBy)) return blockedBy.map(String);
  if (typeof blockedBy === 'string') {
    const trimmed = blockedBy.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

// Calculate status evolution tier (0 = Todo, 1 = In Progress, 2 = In Review, 3 = Done)
function getStatusTier(status: string): number {
  switch (status?.toLowerCase()) {
    case 'done':
    case 'completed':
      return 3;
    case 'in_review':
    case 'needs_review':
      return 2;
    case 'in_progress':
      return 1;
    case 'todo':
    default:
      return 0;
  }
}

export const DependencyGraphView: React.FC<DependencyGraphViewProps> = React.memo(({
  issues,
  onSelectIssue,
}) => {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [selectedUserFilter, setSelectedUserFilter] = useState<string | null>(null);
  const [showVerticalCurves, setShowVerticalCurves] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isGrabbing, setIsGrabbing] = useState(false);
  const isDraggingRef = useRef(false);
  const startDragXRef = useRef(0);
  const startDragYRef = useRef(0);
  const scrollLeftStartRef = useRef(0);
  const scrollTopStartRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);

  // Dynamic live scroll tracking state
  const [scrollBounds, setScrollBounds] = useState({
    scrollLeft: 0,
    scrollTop: 0,
    clientWidth: 1200,
    clientHeight: 700,
  });

  // Programmatic Linear Scroll Animation (NO Ease-In-Ease-Out)
  const smoothScrollBy = useCallback((deltaX: number, customDuration = 300) => {
    const el = scrollContainerRef.current;
    if (!el) return;

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    const startX = el.scrollLeft;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const targetX = Math.max(0, Math.min(maxScroll, startX + deltaX));
    const distance = targetX - startX;

    if (Math.abs(distance) < 1) return;

    const startTime = performance.now();
    const duration = Math.min(450, Math.max(200, customDuration));

    const step = (currentTime: number) => {
      if (!el) return;
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);

      // Pure Linear Motion: constant velocity, 0 ease-in / ease-out
      el.scrollLeft = startX + distance * progress;

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        el.scrollLeft = targetX;
        animFrameRef.current = null;
      }
    };

    animFrameRef.current = requestAnimationFrame(step);
  }, []);

  // Linear Horizontal Scrolling on Mouse Wheel & Trackpad (NO Ease-In-Ease-Out)
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    let targetScrollLeft = el.scrollLeft;
    let startScrollLeft = el.scrollLeft;
    let animStartTime = 0;
    let animDuration = 280;
    let isAnimating = false;
    let animFrame: number | null = null;

    const animateLoop = (now: number) => {
      if (!el) return;
      const elapsed = now - animStartTime;
      const progress = Math.min(1, elapsed / animDuration);

      // Pure Linear Motion without S-curve ease-in/ease-out
      el.scrollLeft = startScrollLeft + (targetScrollLeft - startScrollLeft) * progress;

      if (progress < 1) {
        animFrame = requestAnimationFrame(animateLoop);
      } else {
        el.scrollLeft = targetScrollLeft;
        isAnimating = false;
        animFrame = null;
      }
    };

    const handleWheel = (e: WheelEvent) => {
      // Don't intercept if holding Ctrl/Cmd (allow zooming)
      if (e.ctrlKey || e.metaKey) return;

      const rawDelta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(rawDelta) === 0) return;

      e.preventDefault();

      const maxScroll = el.scrollWidth - el.clientWidth;
      const currentScroll = el.scrollLeft;

      // Linear step delta
      const stepDelta = rawDelta * 1.4;
      const newTarget = Math.max(0, Math.min(maxScroll, (isAnimating ? targetScrollLeft : currentScroll) + stepDelta));

      startScrollLeft = currentScroll;
      targetScrollLeft = newTarget;
      animStartTime = performance.now();

      const distance = Math.abs(targetScrollLeft - startScrollLeft);
      animDuration = Math.min(350, Math.max(180, distance * 0.5));

      if (!isAnimating) {
        isAnimating = true;
        animFrame = requestAnimationFrame(animateLoop);
      }
    };

    // Keyboard Arrow navigation with Linear Motion
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        smoothScrollBy(-300, 250);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        smoothScrollBy(300, 250);
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      el.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
      if (animFrame) cancelAnimationFrame(animFrame);
    };
  }, [smoothScrollBy]);

  // Click & Drag Canvas to Pan smoothly
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, a, input, [role="button"]')) {
      return;
    }
    const el = scrollContainerRef.current;
    if (!el) return;

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    isDraggingRef.current = true;
    setIsGrabbing(true);
    startDragXRef.current = e.pageX - el.offsetLeft;
    startDragYRef.current = e.pageY - el.offsetTop;
    scrollLeftStartRef.current = el.scrollLeft;
    scrollTopStartRef.current = el.scrollTop;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const el = scrollContainerRef.current;
    if (!el) return;

    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const y = e.pageY - el.offsetTop;
    const walkX = (x - startDragXRef.current) * 1.5;
    const walkY = (y - startDragYRef.current) * 1.5;
    el.scrollLeft = scrollLeftStartRef.current - walkX;
    el.scrollTop = scrollTopStartRef.current - walkY;
  };

  const handleMouseUpOrLeave = () => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsGrabbing(false);
    }
  };

  // Track live container scroll position to update dynamic vertical metrics
  const handleContainerScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setScrollBounds({
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
      clientWidth: el.clientWidth,
      clientHeight: el.clientHeight,
    });
  };

  // Initial scroll container bounds measurement
  useEffect(() => {
    handleContainerScroll();
  }, []);

  // Compute User List & Summary
  const userList = useMemo(() => {
    const usersMap = new Map<string, { name: string; color: string; count: number }>();
    issues.forEach((iss) => {
      const uName = iss.assigneeName || iss.reporterName || 'Unassigned';
      if (!usersMap.has(uName)) {
        usersMap.set(uName, {
          name: uName,
          color: getUserColor(uName),
          count: 0,
        });
      }
      usersMap.get(uName)!.count += 1;
    });
    return Array.from(usersMap.values());
  }, [issues]);

  // ─── Compute Horizontal Time Slots, Tracks & Vertical Mutation Curves ───────
  const { nodes, edges, timeHeaders, canvasWidth, canvasHeight, tracks } = useMemo(() => {
    if (issues.length === 0) {
      return { nodes: [], edges: [], timeHeaders: [], canvasWidth: 1000, canvasHeight: 600, tracks: [] };
    }

    // Sort issues chronologically by createdAt (horizontal axis represents creation timeline)
    const sortedIssues = [...issues].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (timeA !== timeB) return timeA - timeB;
      return String(a.key).localeCompare(String(b.key));
    });

    // Determine Tracks (Lanes)
    const trackNames: string[] = [];
    sortedIssues.forEach((iss) => {
      const lane = iss.assigneeName || iss.epic || 'Main Branch';
      if (!trackNames.includes(lane)) {
        trackNames.push(lane);
      }
    });

    // Dimensions
    const NODE_WIDTH = 230;
    const NODE_HEIGHT = 80;
    const COLUMN_WIDTH = 290;
    const ROW_HEIGHT = 140;
    const START_X = 140;
    const START_Y = 100;

    const computedNodes: TimelineNode[] = [];
    const nodeMap = new Map<string, TimelineNode>();
    const timeSlotsMap = new Map<number, string>();

    sortedIssues.forEach((iss, index) => {
      const lane = iss.assigneeName || iss.epic || 'Main Branch';
      let trackIndex = trackNames.indexOf(lane);
      if (trackIndex === -1) trackIndex = 0;

      // Horizontal X-Axis: Time of creation
      const timeSlot = index;
      const x = START_X + timeSlot * COLUMN_WIDTH;

      // Base creation Y
      const creationY = START_Y + trackIndex * ROW_HEIGHT;

      // Vertical Y-Axis: Task updates, revisions & status changes displacement
      const statusTier = getStatusTier(iss.status);
      const isDone = iss.status === 'done';
      
      // Calculate update / change characteristics
      const createdTime = iss.createdAt ? new Date(iss.createdAt).getTime() : 0;
      const updatedTime = iss.updatedAt ? new Date(iss.updatedAt).getTime() : 0;
      const hasTimeUpdate = updatedTime > 0 && createdTime > 0 && Math.abs(updatedTime - createdTime) > 60000;
      const hasStatusProgression = statusTier > 0;
      const hasUpdates = hasTimeUpdate || hasStatusProgression || isDone;

      // Vertical curve offset based on mutation severity / status tier
      // Status tier 3 (Done) pulls vertically upwards by -18px, Tier 0 stays at 0px
      const verticalMutationOffset = (statusTier - 1.5) * 12;
      const evolutionY = creationY + verticalMutationOffset;
      const y = evolutionY;

      const userName = iss.assigneeName || iss.reporterName || 'Unassigned';
      const userColor = getUserColor(userName);

      let dateLabel = `Step ${index + 1}`;
      if (iss.createdAt) {
        const d = new Date(iss.createdAt);
        dateLabel = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      }
      timeSlotsMap.set(timeSlot, dateLabel);

      let updatedLabel = dateLabel;
      if (iss.updatedAt) {
        const ud = new Date(iss.updatedAt);
        updatedLabel = ud.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      }

      let mutationType = 'Initial Draft';
      let deltaLabel = 'No changes';
      if (isDone) {
        mutationType = 'Completed & Merged';
        deltaLabel = 'Final Status';
      } else if (iss.status === 'needs_review') {
        mutationType = 'In Review & Refinement';
        deltaLabel = 'Review Wave';
      } else if (iss.status === 'in_progress') {
        mutationType = 'Active Iteration';
        deltaLabel = 'Work In Progress';
      }

      const node: TimelineNode = {
        id: iss.id,
        issue: iss,
        x,
        y,
        creationX: x,
        creationY,
        evolutionY,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        timeSlot,
        trackIndex,
        userColor,
        userName,
        dateStr: dateLabel,
        updatedDateStr: updatedLabel,
        hasUpdates,
        revisionCount: statusTier + 1,
        mutationType,
        mutationDeltaLabel: deltaLabel,
      };

      computedNodes.push(node);
      nodeMap.set(iss.key, node);
    });

    // ─── Compute Edges (Blocking Dependencies, Sequential Workflows & Evolution Arcs)
    const computedEdges: TimelineEdge[] = [];
    const edgeSet = new Set<string>();

    // 1. Dependency Blocking Links
    sortedIssues.forEach((iss) => {
      const toNode = nodeMap.get(iss.key);
      if (!toNode) return;

      parseBlockedBy(iss.blockedBy).forEach((fromKey) => {
        const fromNode = nodeMap.get(fromKey);
        if (fromNode) {
          const edgeId = `dep_${fromKey}_${iss.key}`;
          if (!edgeSet.has(edgeId)) {
            edgeSet.add(edgeId);
            computedEdges.push({
              id: edgeId,
              fromKey,
              toKey: iss.key,
              fromNode,
              toNode,
              color: '#EF4444',
              actionType: 'dependency',
              user: toNode.userName,
            });
          }
        }
      });
    });

    // 2. Sequential User Workflow Continuity
    const userNodes = new Map<string, TimelineNode[]>();
    computedNodes.forEach((node) => {
      const u = node.userName;
      if (!userNodes.has(u)) userNodes.set(u, []);
      userNodes.get(u)!.push(node);
    });

    userNodes.forEach((nodesList, uName) => {
      const uColor = getUserColor(uName);
      for (let i = 0; i < nodesList.length - 1; i++) {
        const fromN = nodesList[i];
        const toN = nodesList[i + 1];
        const edgeId = `seq_${fromN.issue.key}_${toN.issue.key}`;
        if (!edgeSet.has(edgeId)) {
          edgeSet.add(edgeId);
          computedEdges.push({
            id: edgeId,
            fromKey: fromN.issue.key,
            toKey: toN.issue.key,
            fromNode: fromN,
            toNode: toN,
            color: uColor,
            actionType: toN.issue.status === 'done' ? 'merge' : 'branch',
            user: uName,
          });
        }
      }
    });

    const timeHeadersList = Array.from(timeSlotsMap.entries()).map(([slot, label]) => ({
      slot,
      x: START_X + slot * COLUMN_WIDTH,
      label,
    }));

    const totalWidth = Math.max(1400, START_X + sortedIssues.length * COLUMN_WIDTH + 260);
    const totalHeight = Math.max(760, START_Y + trackNames.length * ROW_HEIGHT + 180);

    return {
      nodes: computedNodes,
      edges: computedEdges,
      timeHeaders: timeHeadersList,
      canvasWidth: totalWidth,
      canvasHeight: totalHeight,
      tracks: trackNames.map((name, idx) => ({
        name,
        y: START_Y + idx * ROW_HEIGHT,
        color: getUserColor(name),
      })),
    };
  }, [issues]);

  // ─── Dynamic Live Scroll Viewport Metrics ─────────────────────────────────
  const dynamicScrollMetrics = useMemo(() => {
    if (nodes.length === 0) {
      return {
        visibleCount: 0,
        updatedCount: 0,
        completedCount: 0,
        velocityPercent: 0,
        activeTrackName: 'None',
        visibleTimeRange: 'No Data',
        laneDensities: [] as { name: string; count: number; color: string }[],
      };
    }

    const minX = (scrollBounds.scrollLeft / scale) - 100;
    const maxX = ((scrollBounds.scrollLeft + scrollBounds.clientWidth) / scale) + 100;

    const visibleNodes = nodes.filter((n) => n.x + n.width >= minX && n.x <= maxX);
    const visibleCount = visibleNodes.length;
    const updatedCount = visibleNodes.filter((n) => n.hasUpdates).length;
    const completedCount = visibleNodes.filter((n) => n.issue.status === 'done').length;
    const velocityPercent = visibleCount > 0 ? Math.round((completedCount / visibleCount) * 100) : 0;

    // Track density in visible window
    const laneMap = new Map<string, number>();
    visibleNodes.forEach((n) => {
      laneMap.set(n.userName, (laneMap.get(n.userName) || 0) + 1);
    });

    let topTrack = 'Main Branch';
    let topCount = 0;
    laneMap.forEach((count, name) => {
      if (count > topCount) {
        topCount = count;
        topTrack = name;
      }
    });

    const firstVisible = visibleNodes[0];
    const lastVisible = visibleNodes[visibleNodes.length - 1];
    const visibleTimeRange = firstVisible && lastVisible
      ? `${firstVisible.dateStr} → ${lastVisible.dateStr}`
      : 'All Steps';

    const laneDensities = tracks.map((tr) => ({
      name: tr.name,
      count: laneMap.get(tr.name) || 0,
      color: tr.color,
    }));

    return {
      visibleCount,
      updatedCount,
      completedCount,
      velocityPercent,
      activeTrackName: topTrack,
      visibleTimeRange,
      laneDensities,
    };
  }, [nodes, scrollBounds, scale, tracks]);

  // Determine active highlights on hover
  const activeHighlightedKeys = useMemo(() => {
    if (!hoveredNodeId) return new Set<string>();
    const activeKeys = new Set<string>();

    const hoveredNode = nodes.find((n) => n.id === hoveredNodeId);
    if (hoveredNode) {
      activeKeys.add(hoveredNode.issue.key);
      parseBlockedBy(hoveredNode.issue.blockedBy).forEach((k) => activeKeys.add(k));
      edges
        .filter((e) => e.fromKey === hoveredNode.issue.key)
        .forEach((e) => activeKeys.add(e.toKey));
    }

    return activeKeys;
  }, [hoveredNodeId, nodes, edges]);

  // Filter nodes based on user filter if active
  const filteredNodes = useMemo(() => {
    if (!selectedUserFilter) return nodes;
    return nodes.filter((n) => n.userName === selectedUserFilter);
  }, [nodes, selectedUserFilter]);

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 w-full bg-[#0E0F12] text-[#CFD4DD] font-sans select-none overflow-hidden relative">
      {/* Top Toolbar */}
      <div className="h-12 px-4 bg-[#141518] border-b border-[#222428] flex items-center justify-between gap-3 shrink-0 z-40">
        {/* Left: Brand & Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#DCB001]/15 border border-[#DCB001]/40 flex items-center justify-center text-[#DCB001]">
              <GitFork size={14} className="stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-white tracking-tight">
                <span>Branch Explorer & Mutation Graph</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-[#1B1C1F] border border-[#2A2C30] text-[#DCB001] rounded">
                  Vertical Curves Active
                </span>
              </div>
            </div>
          </div>

          <span className="w-px h-4 bg-[#2A2C30] mx-1 hidden sm:inline" />

          {/* User / Action Legend Pills */}
          <div className="hidden md:flex items-center gap-1.5 overflow-x-auto max-w-[35vw] custom-scrollbar py-1">
            {userList.map((u) => {
              const isSelected = selectedUserFilter === u.name;
              return (
                <button
                  key={u.name}
                  onClick={() => setSelectedUserFilter(isSelected ? null : u.name)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono transition-all shrink-0 border ${
                    isSelected
                      ? 'bg-white/10 text-white border-white/40 shadow-sm'
                      : 'bg-[#101114] hover:bg-[#18191D] text-[#9BA1A6] border-[#222428]'
                  }`}
                  style={{ borderLeftColor: u.color, borderLeftWidth: 3 }}
                  title={`Filter by ${u.name} (${u.count} tasks)`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: u.color }}
                  />
                  <span className="truncate max-w-[80px]">{u.name}</span>
                  <span className="text-[10px] opacity-70">({u.count})</span>
                  {isSelected && <Check size={11} className="text-white" />}
                </button>
              );
            })}
            {selectedUserFilter && (
              <button
                onClick={() => setSelectedUserFilter(null)}
                className="text-[10px] text-[#DCB001] hover:underline font-mono px-1.5 shrink-0"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Right: Controls, Vertical Spline Toggle, Linear Pan & Zoom */}
        <div className="flex items-center gap-2">
          {/* Vertical Curves Toggle */}
          <button
            onClick={() => setShowVerticalCurves((v) => !v)}
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono border transition-all ${
              showVerticalCurves
                ? 'bg-[#DCB001]/15 text-[#DCB001] border-[#DCB001]/40'
                : 'bg-[#101114] text-[#787C83] border-[#222428] hover:text-white'
            }`}
            title="Toggle Vertical Mutation Bezier Curves"
          >
            <Activity size={12} />
            <span>Vertical Curves</span>
          </button>

          {/* Linear Horizontal Scroll Navigation */}
          <div className="flex items-center bg-[#101114] border border-[#222428] rounded-lg p-0.5 text-xs">
            <button
              type="button"
              onClick={() => smoothScrollBy(-300, 250)}
              className="p-1 text-[#787C83] hover:text-[#DCB001] hover:bg-[#18191D] rounded transition-colors"
              title="Pan Left (Linear)"
            >
              <ChevronLeft size={13} />
            </button>
            <div className="flex items-center gap-1 px-1.5 text-[10px] font-mono text-[#787C83] border-x border-[#222428]">
              <MoveHorizontal size={11} className="text-[#DCB001]" />
              <span className="hidden sm:inline">PAN</span>
            </div>
            <button
              type="button"
              onClick={() => smoothScrollBy(300, 250)}
              className="p-1 text-[#787C83] hover:text-[#DCB001] hover:bg-[#18191D] rounded transition-colors"
              title="Pan Right (Linear)"
            >
              <ChevronRight size={13} />
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center bg-[#101114] border border-[#222428] rounded-lg p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
              className="p-1 text-[#787C83] hover:text-white rounded"
              title="Zoom Out"
            >
              <ZoomOut size={13} />
            </button>
            <span className="px-1.5 text-[10px] font-mono text-[#CFD4DD]">{Math.round(scale * 100)}%</span>
            <button
              type="button"
              onClick={() => setScale((s) => Math.min(1.5, s + 0.1))}
              className="p-1 text-[#787C83] hover:text-white rounded"
              title="Zoom In"
            >
              <ZoomIn size={13} />
            </button>
            <button
              type="button"
              onClick={() => setScale(1)}
              className="p-1 text-[#787C83] hover:text-white rounded ml-1 border-l border-[#222428]"
              title="Reset Zoom"
            >
              <RotateCcw size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Container Area with Dynamic Y-Axis HUD & SVG Canvas */}
      <div className="flex-1 relative flex min-h-0 w-full overflow-hidden">
        {/* Dynamic Vertical Values Gauge HUD (Sticky Overlay on Left) */}
        <div className="absolute top-4 left-4 z-30 pointer-events-none flex flex-col gap-2">
          <div className="p-3 rounded-xl bg-[#0D0E11]/90 backdrop-blur-md border border-[#222428] shadow-2xl space-y-2 pointer-events-auto w-56">
            <div className="flex items-center justify-between pb-1.5 border-b border-[#1E2024] text-[10px] font-mono text-[#787C83]">
              <span className="flex items-center gap-1 text-[#DCB001] font-bold">
                <Sliders size={11} /> DYNAMIC Y-METRICS
              </span>
              <span className="text-[#22C55E]">LIVE</span>
            </div>

            {/* Live Values Based on Currently Scrolled Viewport */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-1.5 rounded bg-[#131417] border border-[#222428]">
                <div className="text-[9px] text-[#787C83]">IN VIEW</div>
                <div className="font-bold text-white text-sm">{dynamicScrollMetrics.visibleCount} Tasks</div>
              </div>
              <div className="p-1.5 rounded bg-[#131417] border border-[#222428]">
                <div className="text-[9px] text-[#DCB001]">MUTATIONS</div>
                <div className="font-bold text-[#DCB001] text-sm">{dynamicScrollMetrics.updatedCount} Updates</div>
              </div>
            </div>

            <div className="space-y-1 text-[10px] font-mono pt-1">
              <div className="flex items-center justify-between text-[#8E939D]">
                <span>Scope Velocity:</span>
                <span className="text-[#22C55E] font-bold">{dynamicScrollMetrics.velocityPercent}% Complete</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[#181A1E] overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[#DCB001] to-[#22C55E] transition-all duration-300"
                  style={{ width: `${dynamicScrollMetrics.velocityPercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[9px] text-[#787C83] pt-0.5">
                <span>Active Track:</span>
                <span className="text-white truncate max-w-[100px]">{dynamicScrollMetrics.activeTrackName}</span>
              </div>
            </div>
          </div>
        </div>

        {/* SVG Timeline Canvas Area */}
        <div 
          ref={scrollContainerRef}
          onScroll={handleContainerScroll}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          className={`flex-1 overflow-auto bg-[#0A0B0D] relative graph-scrollbar custom-scrollbar select-none ${
            isGrabbing ? 'cursor-grabbing' : 'cursor-grab'
          }`}
        >
          <div
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              width: canvasWidth,
              height: canvasHeight,
            }}
            className="relative transition-transform duration-100 min-h-full"
          >
            {/* Background Timeline Grid & Track Lanes */}
            <svg
              className="absolute inset-0 pointer-events-none"
              width={canvasWidth}
              height={canvasHeight}
            >
              {/* Timeline Vertical Columns (Time of creation sequence) */}
              {timeHeaders.map((hdr) => (
                <g key={`grid_col_${hdr.slot}`}>
                  <line
                    x1={hdr.x + 115}
                    y1={55}
                    x2={hdr.x + 115}
                    y2={canvasHeight - 30}
                    stroke="#16171A"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                  />
                </g>
              ))}

              {/* Horizontal Track Lane Guides with Dynamic Vertical Value Labels */}
              {tracks.map((track, idx) => (
                <g key={`track_${track.name}_${idx}`}>
                  <line
                    x1={50}
                    y1={track.y + 40}
                    x2={canvasWidth - 50}
                    y2={track.y + 40}
                    stroke="#141518"
                    strokeWidth={1.5}
                  />
                  {/* Dynamic Vertical Lane Label */}
                  <text
                    x={60}
                    y={track.y + 28}
                    fill={track.color}
                    fontSize="10"
                    fontFamily="monospace"
                    fontWeight="bold"
                    opacity="0.5"
                  >
                    {track.name.toUpperCase()} LANE • REVISION TIER {idx + 1}
                  </text>
                </g>
              ))}

              {/* Arrow & Marker Definitions */}
              <defs>
                <marker
                  id="arrow-dep"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 8 5 L 0 9 z" fill="#EF4444" />
                </marker>

                <marker
                  id="arrow-merge"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 8 5 L 0 9 z" fill="#22C55E" />
                </marker>

                <marker
                  id="arrow-evolution"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 8 5 L 0 9 z" fill="#DCB001" />
                </marker>
              </defs>

              {/* ─── Render Smooth Vertical Evolution Curves for Task Updates ─── */}
              {showVerticalCurves && filteredNodes.map((node) => {
                if (!node.hasUpdates) return null;

                const startX = node.creationX + 30;
                const startY = node.creationY + 40;
                const endX = node.x + 30;
                const endY = node.y + 40;

                const dy = endY - startY;
                if (Math.abs(dy) < 2) return null;

                // Vertical Cubic Bezier Curve (S-Curve for state/update transition)
                const cp1X = startX;
                const cp1Y = startY + dy * 0.5;
                const cp2X = endX;
                const cp2Y = endY - dy * 0.5;

                const curvePath = `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;
                const isHovered = hoveredNodeId === node.id;

                return (
                  <g key={`vert_curve_${node.id}`} className="transition-opacity duration-200">
                    <path
                      d={curvePath}
                      fill="none"
                      stroke={isHovered ? '#DCB001' : node.userColor}
                      strokeWidth={isHovered ? 3 : 1.75}
                      strokeDasharray="3 3"
                      strokeOpacity={isHovered ? 0.9 : 0.45}
                    />
                    {/* Anchor dots */}
                    <circle
                      cx={startX}
                      cy={startY}
                      r={3}
                      fill="#101114"
                      stroke={node.userColor}
                      strokeWidth={1.5}
                    />
                  </g>
                );
              })}

              {/* ─── Render Horizontal Workflow Edges & Dependency Splines ────── */}
              {edges.map((edge) => {
                const startX = edge.fromNode.x + edge.fromNode.width;
                const startY = edge.fromNode.y + edge.fromNode.height / 2;
                const endX = edge.toNode.x;
                const endY = edge.toNode.y + edge.toNode.height / 2;

                const dx = Math.max(40, endX - startX);
                const cp1X = startX + dx * 0.5;
                const cp1Y = startY;
                const cp2X = endX - dx * 0.5;
                const cp2Y = endY;

                const pathData = `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;

                const isHighlighted =
                  activeHighlightedKeys.has(edge.fromKey) &&
                  activeHighlightedKeys.has(edge.toKey);

                const isDependency = edge.actionType === 'dependency';
                const isMerge = edge.actionType === 'merge';

                const strokeColor = isHighlighted
                  ? '#DCB001'
                  : isDependency
                  ? '#EF4444'
                  : isMerge
                  ? '#22C55E'
                  : edge.color;

                return (
                  <g key={edge.id} className="transition-opacity duration-200">
                    {/* Subtle Glow Backdrop for active paths */}
                    {(isHighlighted || isMerge) && (
                      <path
                        d={pathData}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={6}
                        strokeOpacity={0.25}
                      />
                    )}

                    {/* Main Spline Curve */}
                    <path
                      d={pathData}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={isHighlighted ? 3 : isDependency ? 1.75 : 2}
                      strokeDasharray={isDependency ? '4 3' : 'none'}
                      strokeOpacity={isHighlighted ? 1 : 0.65}
                      markerEnd={isDependency ? 'url(#arrow-dep)' : isMerge ? 'url(#arrow-merge)' : undefined}
                    />

                    {/* Branch Fork / Junction Node Circles */}
                    <circle
                      cx={startX}
                      cy={startY}
                      r={3.5}
                      fill={strokeColor}
                      stroke="#0E0F12"
                      strokeWidth={1.5}
                    />
                    <circle
                      cx={endX}
                      cy={endY}
                      r={3.5}
                      fill={strokeColor}
                      stroke="#0E0F12"
                      strokeWidth={1.5}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Timeline Header Bar across top of canvas (Horizontal Creation Sequence) */}
            <div className="absolute top-4 left-0 right-0 h-9 flex items-center px-4 pointer-events-none">
              {timeHeaders.map((hdr) => (
                <div
                  key={`hdr_${hdr.slot}`}
                  style={{ position: 'absolute', left: hdr.x + 40 }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#131417] border border-[#222428] text-[10px] font-mono text-[#9BA1A6] shadow-sm pointer-events-auto"
                >
                  <Calendar size={10} className="text-[#DCB001]" />
                  <span>{hdr.label}</span>
                </div>
              ))}
            </div>

            {/* Interactive Timeline Branch Nodes with Vertical Evolution State */}
            {filteredNodes.map((node) => {
              const isHovered = hoveredNodeId === node.id;
              const isRelated = activeHighlightedKeys.has(node.issue.key);
              const isBlocked = parseBlockedBy(node.issue.blockedBy).length > 0;
              const isDone = node.issue.status === 'done';

              return (
                <div
                  key={node.id}
                  onClick={() => onSelectIssue(node.id)}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  style={{
                    position: 'absolute',
                    left: node.x,
                    top: node.y,
                    width: node.width,
                    height: node.height,
                    borderLeftColor: node.userColor,
                    borderLeftWidth: 4,
                  }}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer shadow-lg flex flex-col justify-between group ${
                    isHovered
                      ? 'bg-[#1C1D21] border-[#DCB001] ring-2 ring-[#DCB001]/30 z-30 scale-105 shadow-2xl'
                      : isRelated
                      ? 'bg-[#16181B] border-[#DCB001]/70 ring-1 ring-[#DCB001]/20 z-20'
                      : 'bg-[#121316] border-[#222428] hover:border-[#3E4149] z-10'
                  }`}
                >
                  {/* Top Row: Key + User + Mutation Indicator */}
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded border bg-[#0C0D0F] border-[#222428]"
                        style={{ color: node.userColor }}
                      >
                        {node.issue.key}
                      </span>

                      {/* Assignee Pill */}
                      <div
                        className="flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-mono truncate max-w-[85px] border border-white/5"
                        style={{ backgroundColor: `${node.userColor}15`, color: node.userColor }}
                        title={`Assigned to ${node.userName}`}
                      >
                        <User size={9} />
                        <span className="truncate">{node.userName}</span>
                      </div>
                    </div>

                    {/* Change / Status Badge */}
                    <div className="flex items-center gap-1">
                      {node.hasUpdates && (
                        <span className="flex items-center gap-0.5 text-[8px] font-mono text-[#DCB001] bg-[#DCB001]/10 px-1 py-0.2 rounded border border-[#DCB001]/30">
                          <History size={8} /> Rev {node.revisionCount}
                        </span>
                      )}

                      {isBlocked && (
                        <span className="flex items-center gap-0.5 text-[8px] font-mono text-[#EF4444] bg-[#EF4444]/15 px-1 py-0.2 rounded border border-[#EF4444]/30">
                          <ShieldAlert size={8} /> Blocked
                        </span>
                      )}

                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isDone
                            ? 'bg-[#22C55E]'
                            : node.issue.priority === 'critical'
                            ? 'bg-[#EF4444] animate-pulse'
                            : 'bg-[#DCB001]'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Task Title */}
                  <div className="text-xs font-semibold text-white truncate group-hover:text-[#DCB001] transition-colors leading-tight">
                    {node.issue.title}
                  </div>

                  {/* Footer: Timeline Date & Evolution Status */}
                  <div className="flex items-center justify-between text-[9px] font-mono text-[#787C83]">
                    <span className="capitalize text-[#9BA1A6]">{node.issue.status.replace('_', ' ')}</span>
                    <span className="text-[#DCB001]/80">{node.dateStr}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});

DependencyGraphView.displayName = 'DependencyGraphView';

export default DependencyGraphView;
