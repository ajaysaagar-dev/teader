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
  History,
  FileEdit,
  ArrowUpRight,
  UserCheck,
  UserPlus
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
  width: number;
  height: number;
  dateTimeSlotKey: string;
  dateTimeAssignedLabel: string;
  creatorName: string;
  creatorColor: string;
  completerName: string;
  completerColor: string;
  completedAtLabel?: string;
  isDone: boolean;
  hasUpdates: boolean;
}

interface TimelineEdge {
  id: string;
  fromKey: string;
  toKey: string;
  fromNode: TimelineNode;
  toNode: TimelineNode;
  completerName: string;
  color: string;
  isCrossCreator: boolean;
  isCompleted: boolean;
}

// ─── Vibrant Palette for User Branch & Completer Curves ──────────────────────
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

// Format Date & Time Assigned
function formatDateTimeAssigned(dateStr?: string, fallbackIndex = 0): { slotKey: string; label: string; datePart: string; timePart: string } {
  if (!dateStr) {
    const timePart = `${String(8 + (fallbackIndex % 6) * 2).padStart(2, '0')}:00`;
    return {
      slotKey: `slot_step_${fallbackIndex + 1}`,
      label: `Step ${fallbackIndex + 1} • ${timePart}`,
      datePart: `Step ${fallbackIndex + 1}`,
      timePart,
    };
  }

  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const month = d.toLocaleDateString(undefined, { month: 'short' });
    const day = d.getDate();
    const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true });
    const datePart = `${month} ${day}`;
    return {
      slotKey: `${d.toISOString()}_${fallbackIndex}`,
      label: `${datePart} • ${time}`,
      datePart,
      timePart: time,
    };
  }

  return {
    slotKey: dateStr,
    label: dateStr,
    datePart: dateStr,
    timePart: '',
  };
}

export const DependencyGraphView: React.FC<DependencyGraphViewProps> = React.memo(({
  issues,
  onSelectIssue,
}) => {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [selectedCompleterFilter, setSelectedCompleterFilter] = useState<string | null>(null);
  const [showCompleterCurves, setShowCompleterCurves] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isGrabbing, setIsGrabbing] = useState(false);

  // Drag-to-pan state
  const isDraggingRef = useRef(false);
  const startDragXRef = useRef(0);
  const startDragYRef = useRef(0);
  const scrollLeftStartRef = useRef(0);
  const scrollTopStartRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);

  // Programmatic Linear Scroll Animation
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

      // Pure Linear Motion
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

  // Linear Horizontal Scrolling on Mouse Wheel & Trackpad
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
      if (e.ctrlKey || e.metaKey) return;

      const rawDelta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(rawDelta) === 0) return;

      e.preventDefault();

      const maxScroll = el.scrollWidth - el.clientWidth;
      const currentScroll = el.scrollLeft;
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

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        smoothScrollBy(-320, 250);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        smoothScrollBy(320, 250);
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

  // Click & Drag Canvas to Pan
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

  // Compute Completer Users List & Summary
  const completerList = useMemo(() => {
    const usersMap = new Map<string, { name: string; color: string; count: number; completedCount: number }>();
    issues.forEach((iss) => {
      const completer = iss.completedByName || iss.assigneeName || iss.assignee?.name || 'Unassigned';
      if (!usersMap.has(completer)) {
        usersMap.set(completer, {
          name: completer,
          color: getUserColor(completer),
          count: 0,
          completedCount: 0,
        });
      }
      const entry = usersMap.get(completer)!;
      entry.count += 1;
      if (iss.status === 'done') entry.completedCount += 1;
    });
    return Array.from(usersMap.values());
  }, [issues]);

  // ─── Compute Layout: Horizontal Date & Time Assigned, Vertical All User Creators ───
  const { nodes, edges, timeSlotHeaders, userTracks, canvasWidth, canvasHeight } = useMemo(() => {
    if (issues.length === 0) {
      return { nodes: [], edges: [], timeSlotHeaders: [], userTracks: [], canvasWidth: 1200, canvasHeight: 700 };
    }

    // Sort issues chronologically by assigned date & time (createdAt / dueDate)
    const sortedIssues = [...issues].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (timeA !== timeB) return timeA - timeB;
      return String(a.key).localeCompare(String(b.key));
    });

    // 1. Determine All Unique Users (Vertical Y-Axis Tracks: shows tasks in the line of who created them)
    const allUsersSet = new Set<string>();
    sortedIssues.forEach((iss) => {
      const creator = iss.reporterName || iss.reporter?.name || 'System Admin';
      allUsersSet.add(creator);
      if (iss.assigneeName) allUsersSet.add(iss.assigneeName);
      if (iss.completedByName) allUsersSet.add(iss.completedByName);
    });
    const userTracksList = Array.from(allUsersSet);

    // Dimensions
    const NODE_WIDTH = 260;
    const NODE_HEIGHT = 88;
    const COLUMN_WIDTH = 320;
    const ROW_HEIGHT = 160;
    const START_X = 200;
    const START_Y = 110;

    const timeHeaders: { slot: number; label: string; x: number }[] = [];
    const computedNodes: TimelineNode[] = [];
    const nodeMap = new Map<string, TimelineNode>();

    sortedIssues.forEach((iss, index) => {
      const { label: dateTimeLabel } = formatDateTimeAssigned(iss.createdAt || iss.dueDate, index);
      const creator = iss.reporterName || iss.reporter?.name || 'System Admin';
      const completer = iss.completedByName || iss.assigneeName || iss.assignee?.name || 'Unassigned';

      let userIndex = userTracksList.indexOf(creator);
      if (userIndex === -1) userIndex = 0;

      // Horizontal X-Axis: Time of assignment step
      const x = START_X + index * COLUMN_WIDTH;

      // Vertical Y-Axis: Task Creator line
      const y = START_Y + userIndex * ROW_HEIGHT;

      timeHeaders.push({
        slot: index,
        label: dateTimeLabel,
        x,
      });

      const isDone = iss.status === 'done';
      const hasUpdates = Boolean(iss.updatedAt && iss.createdAt && iss.updatedAt !== iss.createdAt);

      let completedAtFormatted: string | undefined = undefined;
      if (iss.completedAt) {
        const cd = new Date(iss.completedAt);
        if (!isNaN(cd.getTime())) {
          completedAtFormatted = cd.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        }
      }

      const node: TimelineNode = {
        id: iss.id,
        issue: iss,
        x,
        y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        dateTimeSlotKey: `slot_${index}`,
        dateTimeAssignedLabel: dateTimeLabel,
        creatorName: creator,
        creatorColor: getUserColor(creator),
        completerName: completer,
        completerColor: getUserColor(completer),
        completedAtLabel: completedAtFormatted,
        isDone,
        hasUpdates,
      };

      computedNodes.push(node);
      nodeMap.set(iss.key, node);
    });

    // ─── Horizontal Smooth Curved Lines Connecting Tasks Completed by Each User ───
    const computedEdges: TimelineEdge[] = [];
    const edgeSet = new Set<string>();

    // Group tasks by completing user
    const completerTasks = new Map<string, TimelineNode[]>();
    computedNodes.forEach((node) => {
      const u = node.completerName;
      if (!completerTasks.has(u)) completerTasks.set(u, []);
      completerTasks.get(u)!.push(node);
    });

    completerTasks.forEach((tasksList, compName) => {
      const userColor = getUserColor(compName);

      // Sort horizontally from left (earlier) to right (later)
      const sortedUserTasks = [...tasksList].sort((a, b) => a.x - b.x);

      for (let i = 0; i < sortedUserTasks.length - 1; i++) {
        const fromN = sortedUserTasks[i];
        const toN = sortedUserTasks[i + 1];
        const edgeId = `user_flow_${compName}_${fromN.issue.key}_${toN.issue.key}`;

        if (!edgeSet.has(edgeId)) {
          edgeSet.add(edgeId);
          const isCrossCreator = fromN.creatorName !== toN.creatorName;
          const isCompleted = toN.isDone;

          computedEdges.push({
            id: edgeId,
            fromKey: fromN.issue.key,
            toKey: toN.issue.key,
            fromNode: fromN,
            toNode: toN,
            completerName: compName,
            color: userColor,
            isCrossCreator,
            isCompleted,
          });
        }
      }
    });

    // Dependency Blocking links
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
              completerName: toNode.completerName,
              color: '#EF4444',
              isCrossCreator: fromNode.creatorName !== toNode.creatorName,
              isCompleted: toNode.isDone,
            });
          }
        }
      });
    });

    const userTracksData = userTracksList.map((name, idx) => ({
      name,
      y: START_Y + idx * ROW_HEIGHT,
      color: getUserColor(name),
      createdCount: sortedIssues.filter((i) => (i.reporterName || i.reporter?.name || 'System Admin') === name).length,
    }));

    const totalWidth = Math.max(1400, START_X + sortedIssues.length * COLUMN_WIDTH + 260);
    const totalHeight = Math.max(800, START_Y + userTracksList.length * ROW_HEIGHT + 200);

    return {
      nodes: computedNodes,
      edges: computedEdges,
      timeSlotHeaders: timeHeaders,
      userTracks: userTracksData,
      canvasWidth: totalWidth,
      canvasHeight: totalHeight,
    };
  }, [issues]);

  // Filter nodes by selected completer if active
  const filteredNodes = useMemo(() => {
    if (!selectedCompleterFilter) return nodes;
    return nodes.filter((n) => n.completerName === selectedCompleterFilter);
  }, [nodes, selectedCompleterFilter]);

  // Filter edges
  const filteredEdges = useMemo(() => {
    if (!selectedCompleterFilter) return edges;
    return edges.filter((e) => e.completerName === selectedCompleterFilter);
  }, [edges, selectedCompleterFilter]);

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 w-full bg-[#0B0C0E] text-[#CFD4DD] font-sans select-none overflow-hidden relative">
      {/* Top Toolbar */}
      <div className="h-13 px-4 bg-[#121316] border-b border-[#222428] flex items-center justify-between gap-3 shrink-0 z-40">
        {/* Left: Brand & Axis Legend */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#DCB001]/15 border border-[#DCB001]/40 flex items-center justify-center text-[#DCB001]">
              <GitFork size={14} className="stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-white tracking-tight">
                <span>Task Execution & Creator Matrix</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-[#1B1C1F] border border-[#2A2C30] text-[#DCB001] rounded">
                  X: Date & Time Assigned • Y: Task Creators
                </span>
              </div>
            </div>
          </div>

          <span className="w-px h-4 bg-[#222428] mx-1 hidden sm:inline" />

          {/* Completer User Legend Pills (Shows who completed which tasks) */}
          <div className="hidden md:flex items-center gap-1.5 overflow-x-auto max-w-[38vw] custom-scrollbar py-1">
            <span className="text-[10px] font-mono text-[#787C83] mr-1 flex items-center gap-1">
              <UserCheck size={11} className="text-[#22C55E]" /> TICKED COMPLETED BY:
            </span>
            {completerList.map((u) => {
              const isSelected = selectedCompleterFilter === u.name;
              return (
                <button
                  key={u.name}
                  onClick={() => setSelectedCompleterFilter(isSelected ? null : u.name)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono transition-all shrink-0 border ${
                    isSelected
                      ? 'bg-white/10 text-white border-white/40 shadow-sm'
                      : 'bg-[#16171A] hover:bg-[#1E2024] text-[#9BA1A6] border-[#2A2C30]'
                  }`}
                  style={{ borderLeftColor: u.color, borderLeftWidth: 3 }}
                  title={`Completed ${u.completedCount} of ${u.count} tasks`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: u.color }}
                  />
                  <span className="truncate max-w-[85px]">{u.name}</span>
                  <span className="text-[10px] opacity-70">({u.completedCount}/{u.count})</span>
                  {isSelected && <Check size={11} className="text-white" />}
                </button>
              );
            })}
            {selectedCompleterFilter && (
              <button
                onClick={() => setSelectedCompleterFilter(null)}
                className="text-[10px] text-[#DCB001] hover:underline font-mono px-1.5 shrink-0"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Right: Controls, Completer Curves Toggle, Linear Pan & Zoom */}
        <div className="flex items-center gap-2">
          {/* Toggle Completer Workflow Curves */}
          <button
            onClick={() => setShowCompleterCurves((v) => !v)}
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono border transition-all ${
              showCompleterCurves
                ? 'bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/40'
                : 'bg-[#16171A] text-[#787C83] border-[#222428] hover:text-white'
            }`}
            title="Toggle user completion flow curves"
          >
            <Activity size={12} />
            <span>Completion Curves</span>
          </button>

          {/* Linear Horizontal Scroll Navigation */}
          <div className="flex items-center bg-[#16171A] border border-[#222428] rounded-lg p-0.5 text-xs">
            <button
              type="button"
              onClick={() => smoothScrollBy(-320, 250)}
              className="p-1 text-[#787C83] hover:text-[#DCB001] hover:bg-[#1E2024] rounded transition-colors"
              title="Pan Left"
            >
              <ChevronLeft size={13} />
            </button>
            <div className="flex items-center gap-1 px-1.5 text-[10px] font-mono text-[#787C83] border-x border-[#222428]">
              <MoveHorizontal size={11} className="text-[#DCB001]" />
              <span className="hidden sm:inline">PAN</span>
            </div>
            <button
              type="button"
              onClick={() => smoothScrollBy(320, 250)}
              className="p-1 text-[#787C83] hover:text-[#DCB001] hover:bg-[#1E2024] rounded transition-colors"
              title="Pan Right"
            >
              <ChevronRight size={13} />
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center bg-[#16171A] border border-[#222428] rounded-lg p-0.5 text-xs">
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

      {/* Main Canvas Area */}
      <div className="flex-1 relative flex min-h-0 w-full overflow-hidden">
        {/* SVG Timeline Canvas Area */}
        <div 
          ref={scrollContainerRef}
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
            {/* Background Grid & Axis Lines */}
            <svg
              className="absolute inset-0 pointer-events-none"
              width={canvasWidth}
              height={canvasHeight}
            >
              {/* Vertical Time Slot Column Guides (Horizontal Date & Time Assigned Axis) */}
              {timeSlotHeaders.map((hdr) => (
                <g key={`time_col_${hdr.slot}`}>
                  <line
                    x1={hdr.x + 130}
                    y1={65}
                    x2={hdr.x + 130}
                    y2={canvasHeight - 30}
                    stroke="#16171A"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                  />
                </g>
              ))}

              {/* Horizontal Creator Lane Guides (Vertical User Creator Axis) */}
              {userTracks.map((track, idx) => (
                <g key={`track_user_${track.name}_${idx}`}>
                  <line
                    x1={40}
                    y1={track.y + 44}
                    x2={canvasWidth - 40}
                    y2={track.y + 44}
                    stroke="#18191D"
                    strokeWidth={1.5}
                  />
                  {/* Creator Lane Header Label */}
                  <text
                    x={55}
                    y={track.y + 25}
                    fill={track.color}
                    fontSize="11"
                    fontFamily="monospace"
                    fontWeight="bold"
                    opacity="0.6"
                  >
                    CREATOR LINE: {track.name.toUpperCase()} ({track.createdCount} Created Tasks)
                  </text>
                </g>
              ))}

              {/* Arrow Markers */}
              <defs>
                <marker
                  id="arrow-completer"
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
                  id="arrow-dep-red"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 8 5 L 0 9 z" fill="#EF4444" />
                </marker>
              </defs>

              {/* ─── Horizontal Smooth Curved Lines Connecting Tasks Completed by Each User ─── */}
              {showCompleterCurves && filteredEdges.map((edge) => {
                const startX = edge.fromNode.x + edge.fromNode.width;
                const startY = edge.fromNode.y + edge.fromNode.height / 2;
                const endX = edge.toNode.x;
                const endY = edge.toNode.y + edge.toNode.height / 2;

                const dx = Math.max(40, endX - startX);
                const dy = endY - startY;

                // Smooth Horizontal Directional Bezier Curve flowing from left to right across creator lanes
                const cp1X = startX + dx * 0.5;
                const cp1Y = startY;
                const cp2X = endX - dx * 0.5;
                const cp2Y = endY;

                const midX = (startX + endX) / 2;
                const midY = (startY + endY) / 2;

                const pathData = `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;
                const isHovered = hoveredNodeId === edge.fromNode.id || hoveredNodeId === edge.toNode.id;

                const strokeColor = edge.color;

                return (
                  <g key={edge.id} className="transition-opacity duration-200">
                    {/* Glowing Backdrop on hover */}
                    {isHovered && (
                      <path
                        d={pathData}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={7}
                        strokeOpacity={0.3}
                      />
                    )}

                    {/* Main Curved Spline flowing horizontally */}
                    <path
                      d={pathData}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={isHovered ? 3.5 : edge.isCompleted ? 2.5 : 1.75}
                      strokeDasharray={edge.isCompleted ? 'none' : '4 3'}
                      strokeOpacity={isHovered ? 1 : 0.75}
                      markerEnd={edge.isCompleted ? 'url(#arrow-completer)' : undefined}
                    />

                    {/* Midpoint Ticked Badge if Completed */}
                    {edge.isCompleted && (
                      <g transform={`translate(${midX - 10}, ${midY - 10})`}>
                        <circle cx={10} cy={10} r={9} fill="#0A0B0D" stroke={strokeColor} strokeWidth={1.5} />
                        <path d="M 6 10 L 9 13 L 14 7" fill="none" stroke="#22C55E" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      </g>
                    )}

                    {/* Junction Nodes */}
                    <circle
                      cx={startX}
                      cy={startY}
                      r={3.5}
                      fill={strokeColor}
                      stroke="#0A0B0D"
                      strokeWidth={1.5}
                    />
                    <circle
                      cx={endX}
                      cy={endY}
                      r={3.5}
                      fill={strokeColor}
                      stroke="#0A0B0D"
                      strokeWidth={1.5}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Top Horizontal Axis: DATE & TIME ASSIGNED Header Bar */}
            <div className="absolute top-3 left-0 right-0 h-10 flex items-center px-4 pointer-events-none">
              {timeSlotHeaders.map((hdr) => (
                <div
                  key={`hdr_slot_${hdr.slot}`}
                  style={{ position: 'absolute', left: hdr.x + 20 }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#131417] border border-[#222428] text-xs font-mono text-white shadow-md pointer-events-auto"
                >
                  <Calendar size={12} className="text-[#DCB001]" />
                  <Clock size={11} className="text-[#787C83]" />
                  <span className="font-bold">{hdr.label}</span>
                </div>
              ))}
            </div>

            {/* Left Vertical Axis: ALL USERS / CREATORS Sticky Bar */}
            {userTracks.map((track) => (
              <div
                key={`creator_label_${track.name}`}
                style={{ position: 'absolute', left: 24, top: track.y + 36 }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#121316] border border-[#222428] text-xs font-mono shadow-md pointer-events-auto"
              >
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: track.color }}
                />
                <span className="font-bold text-white">{track.name}</span>
                <span className="text-[10px] text-[#DCB001] px-1 py-0.2 bg-[#DCB001]/10 rounded border border-[#DCB001]/20">Creator</span>
              </div>
            ))}

            {/* Task Nodes Positioned by Date & Time Assigned (X) and Creator Line (Y) */}
            {filteredNodes.map((node) => {
              const isHovered = hoveredNodeId === node.id;
              const isBlocked = parseBlockedBy(node.issue.blockedBy).length > 0;

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
                    borderLeftColor: node.isDone ? '#22C55E' : node.completerColor,
                    borderLeftWidth: 4,
                  }}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer shadow-lg flex flex-col justify-between group ${
                    isHovered
                      ? 'bg-[#1C1D21] border-[#DCB001] ring-2 ring-[#DCB001]/30 z-30 scale-105 shadow-2xl'
                      : 'bg-[#121316] border-[#222428] hover:border-[#3E4149] z-10'
                  }`}
                >
                  {/* Top Row: Key + Creator / Completer Badges */}
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded border bg-[#0C0D0F] border-[#222428]"
                        style={{ color: node.creatorColor }}
                      >
                        {node.issue.key}
                      </span>

                      {/* Who Ticked as Completed / Assignee Badge */}
                      <div
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono truncate max-w-[140px] border ${
                          node.isDone
                            ? 'bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30 font-bold'
                            : 'bg-white/5 text-[#9BA1A6] border-white/10'
                        }`}
                        title={node.isDone ? `Ticked as Completed by ${node.completerName} ${node.completedAtLabel ? `at ${node.completedAtLabel}` : ''}` : `Assigned to ${node.completerName}`}
                      >
                        {node.isDone ? (
                          <CheckCircle2 size={10} className="text-[#22C55E] shrink-0" />
                        ) : (
                          <Clock size={10} className="text-[#DCB001] shrink-0" />
                        )}
                        <span className="truncate">
                          {node.isDone ? `✓ Ticked: ${node.completerName}` : node.completerName}
                        </span>
                      </div>
                    </div>

                    {/* Status Dot */}
                    <div className="flex items-center gap-1">
                      {isBlocked && (
                        <span className="flex items-center gap-0.5 text-[8px] font-mono text-[#EF4444] bg-[#EF4444]/15 px-1 py-0.2 rounded border border-[#EF4444]/30">
                          <ShieldAlert size={8} />
                        </span>
                      )}

                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          node.isDone
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

                  {/* Footer: Date & Time Assigned + Creator Note */}
                  <div className="flex items-center justify-between text-[9px] font-mono text-[#787C83] pt-0.5 border-t border-[#1C1D20]">
                    <span className="capitalize text-[#9BA1A6] flex items-center gap-1">
                      <UserPlus size={9} className="text-[#787C83]" />
                      Created by <strong className="text-white font-normal">{node.creatorName}</strong>
                    </span>
                    <span className="text-[#DCB001]">{node.dateTimeAssignedLabel}</span>
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
