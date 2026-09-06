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
});
