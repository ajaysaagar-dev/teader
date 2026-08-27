'use client';

import React, { useMemo, useState, useRef, useEffect } from 'react';

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
  Check
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
  timeSlot: number;
  trackIndex: number;
  userColor: string;
  userName: string;
  dateStr: string;
}

interface TimelineEdge {
  id: string;
  fromKey: string;
  toKey: string;
  fromNode: TimelineNode;
  toNode: TimelineNode;
  color: string;
  actionType: 'dependency' | 'branch' | 'merge' | 'sequence';
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

export const DependencyGraphView: React.FC<DependencyGraphViewProps> = React.memo(({
  issues,
  onSelectIssue,
}) => {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [selectedUserFilter, setSelectedUserFilter] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<'timeline_branches' | 'dag_pipeline'>('timeline_branches');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Smooth Horizontal Scrolling on Mouse Wheel (Up / Down -> Left / Right)
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // Don't intercept if holding Ctrl/Cmd (allow zooming)
      if (e.ctrlKey || e.metaKey) return;

      if (Math.abs(e.deltaY) > 0) {
        e.preventDefault();
        el.scrollBy({
          left: e.deltaY * 1.3,
          behavior: 'auto',
        });
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
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

  // Compute Horizontal Timeline & Smooth Branch Connections
  const { nodes, edges, timeHeaders, canvasWidth, canvasHeight, tracks } = useMemo(() => {
    if (issues.length === 0) {
      return { nodes: [], edges: [], timeHeaders: [], canvasWidth: 1000, canvasHeight: 600, tracks: [] };
    }

    const keyMap = new Map<string, Issue>();
    issues.forEach((i) => keyMap.set(i.key, i));

    // Sort issues chronologically by createdAt (or fallback to ID/index)
    const sortedIssues = [...issues].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (timeA !== timeB) return timeA - timeB;
      return String(a.key).localeCompare(String(b.key));
    });

    // Determine Tracks (Lanes) based on Assignee / User or Epics
    const trackNames: string[] = [];
    sortedIssues.forEach((iss) => {
      const lane = iss.assigneeName || iss.epic || 'Main Branch';
      if (!trackNames.includes(lane)) {
        trackNames.push(lane);
      }
    });

    // Dimensions
    const NODE_WIDTH = 220;
    const NODE_HEIGHT = 74;
    const COLUMN_WIDTH = 280;
    const ROW_HEIGHT = 120;
    const START_X = 100;
    const START_Y = 90;

    // Build timeline slots
    const computedNodes: TimelineNode[] = [];
    const nodeMap = new Map<string, TimelineNode>();
    const timeSlotsMap = new Map<number, string>();

    sortedIssues.forEach((iss, index) => {
      const lane = iss.assigneeName || iss.epic || 'Main Branch';
      let trackIndex = trackNames.indexOf(lane);
      if (trackIndex === -1) trackIndex = 0;

      // In DAG pipeline mode, slot depends on topological depth; in Timeline mode, it's chronological
      const timeSlot = index;
      const x = START_X + timeSlot * COLUMN_WIDTH;
      const y = START_Y + trackIndex * ROW_HEIGHT;

      const userName = iss.assigneeName || iss.reporterName || 'Unassigned';
      const userColor = getUserColor(userName);

      let dateLabel = `Step ${index + 1}`;
      if (iss.createdAt) {
        const d = new Date(iss.createdAt);
        dateLabel = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      }
      timeSlotsMap.set(timeSlot, dateLabel);

      const node: TimelineNode = {
        id: iss.id,
        issue: iss,
        x,
        y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        timeSlot,
        trackIndex,
        userColor,
        userName,
        dateStr: dateLabel,
      };

      computedNodes.push(node);
      nodeMap.set(iss.key, node);
    });

    // Compute Timeline Edges (Dependencies + Sequential Branch Links)
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
              color: '#EF4444', // Red for dependency blocker
              actionType: 'dependency',
              user: toNode.userName,
            });
          }
        }
      });
    });


    // 2. Sequential Branch Continuity Links (User Workflow Line)
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

    // 3. Trunk Baseline if isolated nodes exist
    if (computedNodes.length > 1 && computedEdges.length === 0) {
      for (let i = 0; i < computedNodes.length - 1; i++) {
        const fromN = computedNodes[i];
        const toN = computedNodes[i + 1];
        computedEdges.push({
          id: `trunk_${fromN.issue.key}_${toN.issue.key}`,
          fromKey: fromN.issue.key,
          toKey: toN.issue.key,
          fromNode: fromN,
          toNode: toN,
          color: fromN.userColor,
          actionType: 'branch',
          user: fromN.userName,
        });
      }
    }

    const timeHeadersList = Array.from(timeSlotsMap.entries()).map(([slot, label]) => ({
      slot,
      x: START_X + slot * COLUMN_WIDTH,
      label,
    }));

    const totalWidth = Math.max(1200, START_X + sortedIssues.length * COLUMN_WIDTH + 200);
    const totalHeight = Math.max(700, START_Y + trackNames.length * ROW_HEIGHT + 160);

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
  }, [issues, layoutMode]);

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
    <div className="flex-1 flex flex-col h-full bg-[#101113] text-[#CFD4DD] font-sans select-none overflow-hidden">
      {/* Top Toolbar (Unity Version Control / Plastic SCM Explorer Style) */}
      <div className="h-12 px-4 bg-[#161719] border-b border-[#2A2C30] flex items-center justify-between gap-3 shrink-0">
        {/* Left: Brand & Branch Explorer Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#DCB001]/15 border border-[#DCB001]/40 flex items-center justify-center text-[#DCB001]">
              <GitFork size={14} className="stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-white tracking-tight">
                <span>Branch Explorer & Timeline Graph</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-[#1B1C1F] border border-[#2A2C30] text-[#787C83] rounded">
                  Unity VCS Style
                </span>
              </div>
            </div>
          </div>

          <span className="w-px h-4 bg-[#2A2C30] mx-1 hidden sm:inline" />

          {/* User / Action Legend Pills */}
          <div className="hidden md:flex items-center gap-1.5 overflow-x-auto max-w-[45vw] custom-scrollbar py-1">
            {userList.map((u) => {
              const isSelected = selectedUserFilter === u.name;
              return (
                <button
                  key={u.name}
                  onClick={() => setSelectedUserFilter(isSelected ? null : u.name)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono transition-all shrink-0 border ${
                    isSelected
                      ? 'bg-white/10 text-white border-white/40 shadow-sm'
                      : 'bg-[#131415] hover:bg-[#1C1D20] text-[#9BA1A6] border-[#2A2C30]'
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

        {/* Right: Controls & Zoom */}
        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <div className="flex items-center bg-[#131415] border border-[#2A2C30] rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
              className="p-1 text-[#787C83] hover:text-white rounded"
              title="Zoom Out"
            >
              <ZoomOut size={13} />
            </button>
            <span className="px-1.5 text-[10px] font-mono text-[#CFD4DD]">{Math.round(scale * 100)}%</span>
            <button
              onClick={() => setScale((s) => Math.min(1.5, s + 0.1))}
              className="p-1 text-[#787C83] hover:text-white rounded"
              title="Zoom In"
            >
              <ZoomIn size={13} />
            </button>
            <button
              onClick={() => setScale(1)}
              className="p-1 text-[#787C83] hover:text-white rounded ml-1 border-l border-[#2A2C30]"
              title="Reset Zoom"
            >
              <RotateCcw size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* SVG Timeline Canvas Area */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-auto bg-[#0E0F11] relative custom-scrollbar"
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
            {/* Timeline Vertical Columns */}
            {timeHeaders.map((hdr) => (
              <g key={`grid_col_${hdr.slot}`}>
                <line
                  x1={hdr.x + 110}
                  y1={45}
                  x2={hdr.x + 110}
                  y2={canvasHeight - 20}
                  stroke="#1B1C1F"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
              </g>
            ))}

            {/* Horizontal Track Lane Guides */}
            {tracks.map((track, idx) => (
              <g key={`track_${track.name}_${idx}`}>
                <line
                  x1={40}
                  y1={track.y + 37}
                  x2={canvasWidth - 40}
                  y2={track.y + 37}
                  stroke="#1A1B1E"
                  strokeWidth={1.5}
                />
                {/* Lane Label */}
                <text
                  x={50}
                  y={track.y + 30}
                  fill={track.color}
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight="bold"
                  opacity="0.4"
                >
                  {track.name.toUpperCase()} LANE
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

              {/* Dynamic User Gradient Markers */}
              {USER_BRANCH_COLORS.map((clr, idx) => (
                <linearGradient
                  key={`grad_${idx}`}
                  id={`grad_user_${idx}`}
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%"
                >
                  <stop offset="0%" stopColor={clr} stopOpacity="0.8" />
                  <stop offset="100%" stopColor={clr} stopOpacity="1" />
                </linearGradient>
              ))}
            </defs>

            {/* Render Smooth Cubic Bezier Curves (Plastic SCM Branch Splines) */}
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

                  {/* Branch Fork / Junction Node Circle */}
                  <circle
                    cx={startX}
                    cy={startY}
                    r={3.5}
                    fill={strokeColor}
                    stroke="#101113"
                    strokeWidth={1.5}
                  />
                  <circle
                    cx={endX}
                    cy={endY}
                    r={3.5}
                    fill={strokeColor}
                    stroke="#101113"
                    strokeWidth={1.5}
                  />
                </g>
              );
            })}
          </svg>

          {/* Timeline Header Bar across top of canvas */}
          <div className="absolute top-3 left-0 right-0 h-9 flex items-center px-4 pointer-events-none">
            {timeHeaders.map((hdr) => (
              <div
                key={`hdr_${hdr.slot}`}
                style={{ position: 'absolute', left: hdr.x + 40 }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#161719] border border-[#2A2C30] text-[10px] font-mono text-[#9BA1A6] shadow-sm pointer-events-auto"
              >
                <Calendar size={10} className="text-[#DCB001]" />
                <span>{hdr.label}</span>
              </div>
            ))}
          </div>

          {/* Interactive Timeline Branch Nodes */}
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
                    ? 'bg-[#1F2023] border-[#DCB001] ring-2 ring-[#DCB001]/30 z-30 scale-105 shadow-2xl'
                    : isRelated
                    ? 'bg-[#1B1C1F] border-[#DCB001]/70 ring-1 ring-[#DCB001]/20 z-20'
                    : 'bg-[#151618] border-[#2A2C30] hover:border-[#4B4E56] z-10'
                }`}
              >
                {/* Node Top Row: Key + User + Status Indicator */}
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded border bg-[#101113] border-[#2A2C30]"
                      style={{ color: node.userColor }}
                    >
                      {node.issue.key}
                    </span>

                    {/* Assignee Avatar / Name Chip */}
                    <div
                      className="flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-mono truncate max-w-[90px] border border-white/5"
                      style={{ backgroundColor: `${node.userColor}15`, color: node.userColor }}
                      title={`Assigned to ${node.userName}`}
                    >
                      <User size={9} />
                      <span className="truncate">{node.userName}</span>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div className="flex items-center gap-1">
                    {isBlocked && (
                      <span className="flex items-center gap-0.5 text-[9px] font-mono text-[#EF4444] bg-[#EF4444]/15 px-1 py-0.2 rounded border border-[#EF4444]/30">
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

                {/* Node Task Title */}
                <div className="text-xs font-semibold text-white truncate group-hover:text-[#DCB001] transition-colors leading-tight">
                  {node.issue.title}
                </div>

                {/* Node Footer: Timeline Stage & Hours */}
                <div className="flex items-center justify-between text-[10px] font-mono text-[#787C83]">
                  <span className="capitalize">{node.issue.status.replace('_', ' ')}</span>
                  <span className="text-[#9BA1A6]">{node.dateStr}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

DependencyGraphView.displayName = 'DependencyGraphView';

export default DependencyGraphView;
