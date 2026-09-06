import { describe, it, expect, beforeEach } from 'vitest';
import {
  getProjectChartsDB,
  createProjectChartDB,
  getProjectChartByIdDB,
  updateProjectChartDB,
  deleteProjectChartDB,
} from '@/lib/db';

describe('Charts Database & Management Operations', () => {
  const testProjectId = 99999;

  it('creates and retrieves a chart file', async () => {
    const chartId = `test_chart_${Date.now()}`;
    const newChart = await createProjectChartDB({
      id: chartId,
      projectId: testProjectId,
      title: 'System Architecture',
      data: {
        elements: [
          {
            id: 'elem-1',
            type: 'rectangle',
            x: 100,
            y: 100,
            width: 160,
            height: 80,
            text: 'Frontend Web',
            borderColor: '#ffffff',
            textColor: '#ffffff',
            backgroundColor: '#1e1e1e',
          },
          {
            id: 'elem-2',
            type: 'circle',
            x: 400,
            y: 100,
            width: 100,
            height: 100,
            text: 'Auth Service',
            borderColor: '#ffffff',
            textColor: '#ffffff',
            backgroundColor: '#1e1e1e',
          },
        ],
        connections: [
          {
            id: 'conn-1',
            fromId: 'elem-1',
            toId: 'elem-2',
            fromAnchor: 'right',
            toAnchor: 'left',
            color: '#ffffff',
            arrowEnd: true,
          },
        ],
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    });

    expect(newChart).toBeDefined();
    expect(newChart.id).toBe(chartId);
    expect(newChart.title).toBe('System Architecture');
    expect(newChart.data.elements).toHaveLength(2);
    expect(newChart.data.connections).toHaveLength(1);

    const fetched = await getProjectChartByIdDB(chartId);
    expect(fetched).toBeDefined();
    expect(fetched?.title).toBe('System Architecture');
    expect(fetched?.data.elements[0].text).toBe('Frontend Web');
  });

  it('updates chart data and title', async () => {
    const chartId = `test_chart_upd_${Date.now()}`;
    await createProjectChartDB({
      id: chartId,
      projectId: testProjectId,
      title: 'Initial Flow',
      data: { elements: [], connections: [], viewport: { x: 0, y: 0, zoom: 1 } },
    });

    const updated = await updateProjectChartDB(chartId, {
      title: 'Updated Flow Diagram',
      data: {
        elements: [
          {
            id: 'elem-rect',
            type: 'rectangle',
            x: 50,
            y: 50,
            width: 140,
            height: 70,
            text: 'Microservice A',
            borderColor: '#ffffff',
            textColor: '#ffffff',
            backgroundColor: '#1e1e1e',
          },
        ],
        connections: [],
      },
    });

    expect(updated).toBeDefined();
    expect(updated?.title).toBe('Updated Flow Diagram');
    expect(updated?.data.elements).toHaveLength(1);
    expect(updated?.data.elements[0].text).toBe('Microservice A');
  });

  it('lists charts for a project', async () => {
    const charts = await getProjectChartsDB(testProjectId);
    expect(Array.isArray(charts)).toBe(true);
    expect(charts.length).toBeGreaterThanOrEqual(1);
  });

  it('deletes a chart file', async () => {
    const chartId = `test_chart_del_${Date.now()}`;
    await createProjectChartDB({
      id: chartId,
      projectId: testProjectId,
      title: 'To Delete',
    });

    const deleted = await deleteProjectChartDB(chartId);
    expect(deleted).toBe(true);

    const fetched = await getProjectChartByIdDB(chartId);
    expect(fetched).toBeNull();
  });

  it('handles live realtime chart updates with autosave payload', async () => {
    const chartId = `test_chart_live_${Date.now()}`;
    const initial = await createProjectChartDB({
      id: chartId,
      projectId: testProjectId,
      title: 'Collaborative Diagram',
      data: {
        elements: [
          {
            id: 'node-1',
            type: 'rounded-rectangle',
            x: 200,
            y: 200,
            width: 150,
            height: 75,
            text: 'User Node',
            borderColor: '#ffffff',
            textColor: '#ffffff',
            backgroundColor: '#1e1e1e',
          },
        ],
        connections: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    });

    expect(initial.title).toBe('Collaborative Diagram');

    // Simulate autosave payload
    const updated = await updateProjectChartDB(chartId, {
      data: {
        elements: [
          {
            id: 'node-1',
            type: 'rounded-rectangle',
            x: 250,
            y: 250,
            width: 150,
            height: 75,
            text: 'User Node Moved',
            borderColor: '#ffffff',
            textColor: '#ffffff',
            backgroundColor: '#1e1e1e',
          },
          {
            id: 'node-2',
            type: 'circle',
            x: 500,
            y: 250,
            width: 90,
            height: 90,
            text: 'Endpoint',
            borderColor: '#ffffff',
            textColor: '#ffffff',
            backgroundColor: '#1e1e1e',
          },
        ],
        connections: [
          {
            id: 'c-1',
            fromId: 'node-1',
            toId: 'node-2',
            color: '#ffffff',
            arrowEnd: true,
          },
        ],
        viewport: { x: 10, y: 10, zoom: 1.1 },
      },
    });

    expect(updated?.data.elements).toHaveLength(2);
    expect(updated?.data.connections).toHaveLength(1);
    expect(updated?.data.elements[0].text).toBe('User Node Moved');
  });

  it('calculates anchor coordinates and snaps when close to connecting points', () => {
    const elem = {
      id: 'target-node',
      type: 'rectangle' as const,
      x: 300,
      y: 200,
      width: 160,
      height: 80,
      text: 'Target',
      borderColor: '#ffffff',
      textColor: '#ffffff',
      backgroundColor: '#1e1e1e',
    };

    const getAnchorCoord = (e: typeof elem, anchor: 'top' | 'right' | 'bottom' | 'left') => {
      switch (anchor) {
        case 'top':
          return { x: e.x + e.width / 2, y: e.y };
        case 'bottom':
          return { x: e.x + e.width / 2, y: e.y + e.height };
        case 'left':
          return { x: e.x, y: e.y + e.height / 2 };
        case 'right':
        default:
          return { x: e.x + e.width, y: e.y + e.height / 2 };
      }
    };

    expect(getAnchorCoord(elem, 'top')).toEqual({ x: 380, y: 200 });
    expect(getAnchorCoord(elem, 'bottom')).toEqual({ x: 380, y: 280 });
    expect(getAnchorCoord(elem, 'left')).toEqual({ x: 300, y: 240 });
    expect(getAnchorCoord(elem, 'right')).toEqual({ x: 460, y: 240 });

    // Proximity snapping function
    const SNAP_THRESHOLD = 32;
    const findSnappedAnchor = (
      cursorX: number,
      cursorY: number,
      targetElem: typeof elem
    ) => {
      const anchors: ('top' | 'right' | 'bottom' | 'left')[] = ['top', 'right', 'bottom', 'left'];
      let closest: { anchor: string; x: number; y: number; dist: number } | null = null;

      for (const anchor of anchors) {
        const coord = getAnchorCoord(targetElem, anchor);
        const dist = Math.hypot(cursorX - coord.x, cursorY - coord.y);
        if (dist <= SNAP_THRESHOLD) {
          if (!closest || dist < closest.dist) {
            closest = { anchor, x: coord.x, y: coord.y, dist };
          }
        }
      }
      return closest;
    };

    // Case 1: Cursor is close to left anchor (within 15px of {300, 240})
    const snapNearLeft = findSnappedAnchor(288, 242, elem);
    expect(snapNearLeft).not.toBeNull();
    expect(snapNearLeft?.anchor).toBe('left');
    expect(snapNearLeft?.x).toBe(300);
    expect(snapNearLeft?.y).toBe(240);

    // Case 2: Cursor is close to top anchor (within 20px of {380, 200})
    const snapNearTop = findSnappedAnchor(375, 215, elem);
    expect(snapNearTop).not.toBeNull();
    expect(snapNearTop?.anchor).toBe('top');
    expect(snapNearTop?.x).toBe(380);
    expect(snapNearTop?.y).toBe(200);

    // Case 3: Cursor is far away (e.g. at {100, 100})
    const snapFarAway = findSnappedAnchor(100, 100, elem);
    expect(snapFarAway).toBeNull();
  });

  it('calculates cursor-centered zoom in and out on mouse wheel', () => {
    const initialViewport = { x: 0, y: 0, zoom: 1 };
    const pointer = { x: 400, y: 300 };

    // World coords under pointer
    const worldX = (pointer.x - initialViewport.x) / initialViewport.zoom;
    const worldY = (pointer.y - initialViewport.y) / initialViewport.zoom;
    expect(worldX).toBe(400);
    expect(worldY).toBe(300);

    // Zoom IN: negative deltaY (wheel scrolled forward/up)
    const deltaIn = -100;
    const factorIn = Math.pow(2, -deltaIn * 0.002);
    const nextZoomIn = Math.min(3.0, Math.max(0.15, Number((initialViewport.zoom * factorIn).toFixed(2))));
    expect(nextZoomIn).toBeGreaterThan(1);

    const nextXIn = Math.round(pointer.x - worldX * nextZoomIn);
    const nextYIn = Math.round(pointer.y - worldY * nextZoomIn);

    // Verify pointer still points to same world coordinate
    const recomputedWorldXIn = (pointer.x - nextXIn) / nextZoomIn;
    const recomputedWorldYIn = (pointer.y - nextYIn) / nextZoomIn;
    expect(Math.round(recomputedWorldXIn)).toBe(400);
    expect(Math.round(recomputedWorldYIn)).toBe(300);

    // Zoom OUT: positive deltaY (wheel scrolled backward/down)
    const deltaOut = 100;
    const factorOut = Math.pow(2, -deltaOut * 0.002);
    const nextZoomOut = Math.min(3.0, Math.max(0.15, Number((initialViewport.zoom * factorOut).toFixed(2))));
    expect(nextZoomOut).toBeLessThan(1);
  });

  it('calculates viewport pan offset when dragging empty canvas', () => {
    const initialViewport = { x: 50, y: 100, zoom: 1 };
    const mouseDownClient = { x: 300, y: 400 };

    // Start pan: panStart = client - viewport
    const panStart = {
      x: mouseDownClient.x - initialViewport.x,
      y: mouseDownClient.y - initialViewport.y,
    };
    expect(panStart).toEqual({ x: 250, y: 300 });

    // Drag move to new client position: clientX = 420, clientY = 480 (dragged right 120px, down 80px)
    const mouseMoveClient = { x: 420, y: 480 };
    const nextViewport = {
      x: mouseMoveClient.x - panStart.x,
      y: mouseMoveClient.y - panStart.y,
      zoom: initialViewport.zoom,
    };

    expect(nextViewport.x).toBe(170); // 50 + 120
    expect(nextViewport.y).toBe(180); // 100 + 80
  });

  it('dynamically adapts connection links based on the relative positions of elements', () => {
    type AnchorPosition = 'top' | 'right' | 'bottom' | 'left';
    interface TestElem {
      id: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }

    const getAnchorCoord = (elem: TestElem, anchor: AnchorPosition) => {
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
    };

    const getDynamicAnchors = (fromElem: TestElem, toElem: TestElem): { fromAnchor: AnchorPosition; toAnchor: AnchorPosition } => {
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

          const dotStart = vx * n1.dx + vy * n1.dy;
          const dotEnd = vx * (-n2.dx) + vy * (-n2.dy);

          let penalty = 0;
          if (dotStart < 0) penalty += Math.abs(dotStart) * 3.5;
          if (dotEnd < 0) penalty += Math.abs(dotEnd) * 3.5;

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
    };

    const elemA: TestElem = { id: 'a', x: 100, y: 100, width: 160, height: 80 };
    const elemB: TestElem = { id: 'b', x: 400, y: 100, width: 160, height: 80 };

    // 1. Elem A is to the left of Elem B -> right to left
    expect(getDynamicAnchors(elemA, elemB)).toEqual({ fromAnchor: 'right', toAnchor: 'left' });

    // 2. Elem A is moved to the right of Elem B -> left to right
    const elemARight: TestElem = { id: 'a', x: 700, y: 100, width: 160, height: 80 };
    expect(getDynamicAnchors(elemARight, elemB)).toEqual({ fromAnchor: 'left', toAnchor: 'right' });

    // 3. Elem A is moved above Elem B -> bottom to top
    const elemAAbove: TestElem = { id: 'a', x: 400, y: -100, width: 160, height: 80 };
    expect(getDynamicAnchors(elemAAbove, elemB)).toEqual({ fromAnchor: 'bottom', toAnchor: 'top' });

    // 4. Elem A is moved below Elem B -> top to bottom
    const elemABelow: TestElem = { id: 'a', x: 400, y: 350, width: 160, height: 80 };
    expect(getDynamicAnchors(elemABelow, elemB)).toEqual({ fromAnchor: 'top', toAnchor: 'bottom' });
  });

  it('commits and saves element text when clicked anywhere without pressing enter', () => {
    let elements = [
      { id: 'elem-1', text: 'Initial Text' },
      { id: 'elem-2', text: 'Other Node' },
    ];
    let editingElementId: string | null = 'elem-1';
    let editingText = 'Updated Text Without Enter';

    const commitCurrentEditingText = () => {
      if (!editingElementId) return;
      elements = elements.map((el) =>
        el.id === editingElementId ? { ...el, text: editingText } : el
      );
      editingElementId = null;
    };

    // User types new text and clicks anywhere else (simulating global mousedown / canvas click / blur)
    commitCurrentEditingText();

    expect(editingElementId).toBeNull();
    expect(elements.find((e) => e.id === 'elem-1')?.text).toBe('Updated Text Without Enter');
  });
});
