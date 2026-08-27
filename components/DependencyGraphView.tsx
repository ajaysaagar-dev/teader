'use client';

import React, { useMemo, useState } from 'react';
import { Issue, Status, Priority } from '@/lib/types';
import { 
  GitFork, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  Layers, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface DependencyGraphViewProps {
  issues: Issue[];
  onSelectIssue: (id: string) => void;
  onOpenNewIssue?: () => void;
}

interface Node {
  id: string;
  issue: Issue;
  x: number;
  y: number;
  width: number;
  height: number;
  layer: number;
}

interface Edge {
  id: string;
  fromKey: string;
  toKey: string;
  fromNode: Node;
  toNode: Node;
}

export const DependencyGraphView: React.FC<DependencyGraphViewProps> = React.memo(({
  issues,
  onSelectIssue,
}) => {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);

  // Build DAG Node Layout
  const { nodes, edges, maxLayer, maxPerLayer } = useMemo(() => {
    const keyMap = new Map<string, Issue>();
    issues.forEach((i) => keyMap.set(i.key, i));

    // Calculate topological depth/layer for each issue
    const layers = new Map<string, number>();

    const getDepth = (iss: Issue, visited = new Set<string>()): number => {
      if (visited.has(iss.key)) return 0; // prevent circular recursion
      visited.add(iss.key);

      const blockers = (iss.blockedBy || []).filter((k) => keyMap.has(k));
      if (blockers.length === 0) return 0;

      let maxBlockerDepth = 0;
      for (const bKey of blockers) {
        const blockerIssue = keyMap.get(bKey);
        if (blockerIssue) {
          maxBlockerDepth = Math.max(maxBlockerDepth, getDepth(blockerIssue, new Set(visited)) + 1);
        }
      }
      return maxBlockerDepth;
    };

    issues.forEach((iss) => {
      layers.set(iss.key, getDepth(iss));
    });

    // Group issues by layer
    const layerGroups = new Map<number, Issue[]>();
    let maxL = 0;
    layers.forEach((layer, key) => {
      maxL = Math.max(maxL, layer);
      if (!layerGroups.has(layer)) layerGroups.set(layer, []);
      const iss = keyMap.get(key);
      if (iss) layerGroups.get(layer)!.push(iss);
    });

    const NODE_WIDTH = 220;
    const NODE_HEIGHT = 80;
    const HORIZONTAL_GAP = 140;
    const VERTICAL_GAP = 30;

    const computedNodes: Node[] = [];
    const nodeMap = new Map<string, Node>();
    let maxCountInLayer = 1;

    layerGroups.forEach((group, layer) => {
      maxCountInLayer = Math.max(maxCountInLayer, group.length);
      group.forEach((iss, index) => {
        const node: Node = {
          id: iss.id,
          issue: iss,
          x: 60 + layer * (NODE_WIDTH + HORIZONTAL_GAP),
          y: 60 + index * (NODE_HEIGHT + VERTICAL_GAP),
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          layer,
        };
        computedNodes.push(node);
        nodeMap.set(iss.key, node);
      });
    });

    // Compute Edges
    const computedEdges: Edge[] = [];
    issues.forEach((iss) => {
      const toNode = nodeMap.get(iss.key);
      if (!toNode) return;

      (iss.blockedBy || []).forEach((fromKey) => {
        const fromNode = nodeMap.get(fromKey);
        if (fromNode) {
          computedEdges.push({
            id: `edge_${fromKey}_${iss.key}`,
            fromKey,
            toKey: iss.key,
            fromNode,
            toNode,
          });
        }
      });
    });

    return {
      nodes: computedNodes,
      edges: computedEdges,
      maxLayer: maxL,
      maxPerLayer: maxCountInLayer,
    };
  }, [issues]);

  const svgWidth = Math.max(900, (maxLayer + 1) * 360 + 120);
  const svgHeight = Math.max(600, maxPerLayer * 110 + 140);

  // Determine active dependencies to highlight on hover
  const activeHighlightedKeys = useMemo(() => {
    if (!hoveredNodeId) return new Set<string>();
    const activeKeys = new Set<string>();

    const hoveredNode = nodes.find((n) => n.id === hoveredNodeId);
    if (hoveredNode) {
      activeKeys.add(hoveredNode.issue.key);
      // Add its blockers
      (hoveredNode.issue.blockedBy || []).forEach((k) => activeKeys.add(k));
      // Add issues it blocks
      edges
        .filter((e) => e.fromKey === hoveredNode.issue.key)
        .forEach((e) => activeKeys.add(e.toKey));
    }

    return activeKeys;
  }, [hoveredNodeId, nodes, edges]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#131415] text-[#CFD4DD] font-sans select-none overflow-hidden">
      {/* Top Toolbar */}
      <div className="h-11 px-4 bg-[#17181A] border-b border-[#2A2C30] flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white">
            <GitFork size={15} className="text-[#DCB001]" />
            <span>Dependency Graph & DAG Pipeline</span>
          </div>

          <div className="hidden sm:flex items-center gap-1 text-[11px] font-mono text-[#787C83] bg-[#131415] border border-[#2A2C30] px-2 py-0.5 rounded">
            <span>{edges.length} Active Blocking Relations</span>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center bg-[#131415] border border-[#2A2C30] rounded-lg p-0.5 text-xs">
          <button
            onClick={() => setScale((s) => Math.max(0.6, s - 0.1))}
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

      {/* SVG Canvas Area */}
      <div className="flex-1 overflow-auto bg-[#101112] relative custom-scrollbar">
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            width: svgWidth,
            height: svgHeight,
          }}
          className="relative transition-transform duration-100"
        >
          {/* SVG Arrows for Edges */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width={svgWidth}
            height={svgHeight}
          >
            <defs>
              <marker
                id="arrow-default"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 8 5 L 0 9 z" fill="#DCB001" opacity="0.7" />
              </marker>
              <marker
                id="arrow-highlight"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 8 5 L 0 9 z" fill="#EF4444" />
              </marker>
            </defs>

            {edges.map((edge) => {
              const startX = edge.fromNode.x + edge.fromNode.width;
              const startY = edge.fromNode.y + edge.fromNode.height / 2;
              const endX = edge.toNode.x;
              const endY = edge.toNode.y + edge.toNode.height / 2;

              const dx = endX - startX;
              const cp1X = startX + dx * 0.5;
              const cp1Y = startY;
              const cp2X = startX + dx * 0.5;
              const cp2Y = endY;

              const pathData = `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;
              const isHighlighted =
                activeHighlightedKeys.has(edge.fromKey) &&
                activeHighlightedKeys.has(edge.toKey);

              return (
                <path
                  key={edge.id}
                  d={pathData}
                  fill="none"
                  stroke={isHighlighted ? '#EF4444' : '#DCB001'}
                  strokeWidth={isHighlighted ? 2.5 : 1.5}
                  strokeDasharray={isHighlighted ? 'none' : '4 3'}
                  opacity={isHighlighted ? 1 : 0.4}
                  markerEnd={isHighlighted ? 'url(#arrow-highlight)' : 'url(#arrow-default)'}
                />
              );
            })}
          </svg>

          {/* Interactive Node Cards */}
          {nodes.map((node) => {
            const isHovered = hoveredNodeId === node.id;
            const isRelated = activeHighlightedKeys.has(node.issue.key);
            const isBlocked = (node.issue.blockedBy || []).length > 0;
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
                }}
                className={`p-3 rounded-xl border transition-all cursor-pointer shadow-md flex flex-col justify-between ${
                  isHovered
                    ? 'bg-[#1F2023] border-[#DCB001] ring-2 ring-[#DCB001]/30 z-20 scale-105'
                    : isRelated
                    ? 'bg-[#1B1C1F] border-[#EF4444] ring-1 ring-[#EF4444]/20 z-10'
                    : 'bg-[#17181A] border-[#2A2C30] hover:border-[#DCB001]/60 z-0'
                }`}
              >
                {/* Node Top Row */}
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono text-[11px] font-bold text-[#DCB001] bg-[#131415] border border-[#2A2C30] px-1.5 py-0.2 rounded">
                      {node.issue.key}
                    </span>
                    {isBlocked && (
                      <span className="flex items-center gap-0.5 text-[9px] font-mono text-[#EF4444] bg-[#EF4444]/15 px-1 py-0.2 rounded border border-[#EF4444]/30">
                        <ShieldAlert size={9} /> Blocked
                      </span>
                    )}
                  </div>

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

                {/* Node Title */}
                <div className="text-xs font-semibold text-white truncate group-hover:text-[#DCB001]">
                  {node.issue.title}
                </div>

                {/* Node Footer */}
                <div className="flex items-center justify-between text-[10px] font-mono text-[#787C83]">
                  <span className="capitalize">{node.issue.status.replace('_', ' ')}</span>
                  {node.issue.estimatedHours ? (
                    <span>{node.issue.estimatedHours}h est</span>
                  ) : null}
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
