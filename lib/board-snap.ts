import { BoardElement, BoardGroup, BoardViewport, SnapGuide, SnapResult } from '@/types/board';

/**
 * Axis-Aligned Bounding Box (AABB) intersection check with configurable buffer margin.
 * Ensures strict viewport culling: only elements within the visible canvas frame (+buffer) are rendered.
 */
export function isElementInViewport(
  elem: { x: number; y: number; width: number; height: number },
  viewport: BoardViewport,
  canvasWidth: number,
  canvasHeight: number,
  buffer = 150
): boolean {
  if (canvasWidth <= 0 || canvasHeight <= 0) return true;

  const zoom = Math.max(0.05, viewport.zoom);
  const vLeft = -viewport.x / zoom - buffer;
  const vTop = -viewport.y / zoom - buffer;
  const vRight = (-viewport.x + canvasWidth) / zoom + buffer;
  const vBottom = (-viewport.y + canvasHeight) / zoom + buffer;

  const eLeft = elem.x;
  const eTop = elem.y;
  const eRight = elem.x + elem.width;
  const eBottom = elem.y + elem.height;

  // If outside any of the 4 bounds, element is not in view
  return !(eRight < vLeft || eLeft > vRight || eBottom < vTop || eTop > vBottom);
}

/**
 * Calculate dynamic bounding box of a group (supporting explicit bounds and auto-expansion to contain children)
 */
export function getGroupBoundingBox(groupId: string, elements: BoardElement[], group?: BoardGroup) {
  const groupElements = elements.filter((e) => e.groupId === groupId);
  if (groupElements.length === 0 && (!group || group.x === undefined || group.width === undefined)) {
    return null;
  }

  const PADDING = 24;

  if (group && group.x !== undefined && group.y !== undefined && group.width !== undefined && group.height !== undefined) {
    let minX = group.x;
    let minY = group.y;
    let maxX = group.x + group.width;
    let maxY = group.y + group.height;

    // Expand if any child extends outside the manual boundaries
    for (const e of groupElements) {
      if (e.x - PADDING < minX) minX = e.x - PADDING;
      if (e.y - PADDING < minY) minY = e.y - PADDING;
      if (e.x + e.width + PADDING > maxX) maxX = e.x + e.width + PADDING;
      if (e.y + e.height + PADDING > maxY) maxY = e.y + e.height + PADDING;
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      elements: groupElements,
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const e of groupElements) {
    if (e.x < minX) minX = e.x;
    if (e.y < minY) minY = e.y;
    if (e.x + e.width > maxX) maxX = e.x + e.width;
    if (e.y + e.height > maxY) maxY = e.y + e.height;
  }

  return {
    x: minX - PADDING,
    y: minY - PADDING,
    width: maxX - minX + PADDING * 2,
    height: maxY - minY + PADDING * 2,
    elements: groupElements,
  };
}

/**
 * High-precision magnetic snap support for near elements and grid.
 * Aligns edges (left, right, top, bottom) and centers with nearby elements,
 * producing visual alignment guide lines spanning across the canvas.
 */
export function computeSnapAlignment(
  dragBox: { x: number; y: number; width: number; height: number },
  targetElements: { id: string; x: number; y: number; width: number; height: number }[],
  options: {
    snapThreshold?: number;
    zoom?: number;
    snapToGrid?: boolean;
    gridSize?: number;
  } = {}
): SnapResult {
  const {
    snapThreshold = 8,
    zoom = 1,
    snapToGrid = false,
    gridSize = 20,
  } = options;

  let snappedX = dragBox.x;
  let snappedY = dragBox.y;
  const guides: SnapGuide[] = [];

  const thresholdInWorld = snapThreshold / Math.max(0.1, zoom);

  // 1. Grid Snap (if enabled)
  if (snapToGrid && gridSize > 0) {
    snappedX = Math.round(snappedX / gridSize) * gridSize;
    snappedY = Math.round(snappedY / gridSize) * gridSize;
  }

  // 2. Element Magnetic Snap Alignment
  let closestDistX = thresholdInWorld;
  let closestDistY = thresholdInWorld;
  let snapXGuide: SnapGuide | null = null;
  let snapYGuide: SnapGuide | null = null;

  const dragLeft = snappedX;
  const dragCenter = snappedX + dragBox.width / 2;
  const dragRight = snappedX + dragBox.width;

  const dragTop = snappedY;
  const dragMiddle = snappedY + dragBox.height / 2;
  const dragBottom = snappedY + dragBox.height;

  for (const target of targetElements) {
    const targetLeft = target.x;
    const targetCenter = target.x + target.width / 2;
    const targetRight = target.x + target.width;

    const targetTop = target.y;
    const targetMiddle = target.y + target.height / 2;
    const targetBottom = target.y + target.height;

    // --- Vertical Alignment Guides (checks X coordinates) ---
    const xAlignments: {
      dragX: number;
      targetX: number;
      snapDelta: number;
      snapType: 'edge' | 'center';
    }[] = [
      { dragX: dragLeft, targetX: targetLeft, snapDelta: targetLeft - dragLeft, snapType: 'edge' },
      { dragX: dragLeft, targetX: targetRight, snapDelta: targetRight - dragLeft, snapType: 'edge' },
      { dragX: dragCenter, targetX: targetCenter, snapDelta: targetCenter - dragCenter, snapType: 'center' },
      { dragX: dragRight, targetX: targetLeft, snapDelta: targetLeft - dragRight, snapType: 'edge' },
      { dragX: dragRight, targetX: targetRight, snapDelta: targetRight - dragRight, snapType: 'edge' },
    ];

    for (const align of xAlignments) {
      const dist = Math.abs(align.snapDelta);
      if (dist < closestDistX) {
        closestDistX = dist;
        snappedX = dragBox.x + align.snapDelta;
        snapXGuide = {
          id: `v-${target.id}-${align.snapType}`,
          orientation: 'vertical',
          pos: align.targetX,
          start: Math.min(dragTop, targetTop) - 30,
          end: Math.max(dragBottom, targetBottom) + 30,
          snapType: align.snapType,
        };
      }
    }

    // --- Horizontal Alignment Guides (checks Y coordinates) ---
    const yAlignments: {
      dragY: number;
      targetY: number;
      snapDelta: number;
      snapType: 'edge' | 'center';
    }[] = [
      { dragY: dragTop, targetY: targetTop, snapDelta: targetTop - dragTop, snapType: 'edge' },
      { dragY: dragTop, targetY: targetBottom, snapDelta: targetBottom - dragTop, snapType: 'edge' },
      { dragY: dragMiddle, targetY: targetMiddle, snapDelta: targetMiddle - dragMiddle, snapType: 'center' },
      { dragY: dragBottom, targetY: targetTop, snapDelta: targetTop - dragBottom, snapType: 'edge' },
      { dragY: dragBottom, targetY: targetBottom, snapDelta: targetBottom - dragBottom, snapType: 'edge' },
    ];

    for (const align of yAlignments) {
      const dist = Math.abs(align.snapDelta);
      if (dist < closestDistY) {
        closestDistY = dist;
        snappedY = dragBox.y + align.snapDelta;
        snapYGuide = {
          id: `h-${target.id}-${align.snapType}`,
          orientation: 'horizontal',
          pos: align.targetY,
          start: Math.min(dragLeft, targetLeft) - 30,
          end: Math.max(dragRight, targetRight) + 30,
          snapType: align.snapType,
        };
      }
    }
  }

  if (snapXGuide) guides.push(snapXGuide);
  if (snapYGuide) guides.push(snapYGuide);

  return {
    x: snappedX,
    y: snappedY,
    guides,
  };
}
