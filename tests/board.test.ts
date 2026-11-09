import { describe, it, expect } from 'vitest';
import { isElementInViewport, computeSnapAlignment, getGroupBoundingBox } from '@/lib/board-snap';
import { BoardElement, BoardViewport } from '@/types/board';
import {
  createProjectBoardDB,
  getProjectBoardsDB,
  getProjectBoardByIdDB,
  updateProjectBoardDB,
  deleteProjectBoardDB,
  createBoardShareDB,
  getBoardShareByTokenDB,
  getActiveBoardShareDB,
  revokeBoardShareDB,
} from '@/lib/db';

describe('Miro Board Viewport Culling & Optimization Engine', () => {
  const viewport: BoardViewport = { x: 0, y: 0, zoom: 1 };
  const canvasWidth = 1000;
  const canvasHeight = 800;

  it('correctly includes elements clearly inside the canvas viewport', () => {
    const elem = { x: 200, y: 200, width: 200, height: 150 };
    expect(isElementInViewport(elem, viewport, canvasWidth, canvasHeight, 50)).toBe(true);
  });

  it('strictly culls elements located completely off-screen beyond the buffer', () => {
    // Far to the right
    const elemFarRight = { x: 2000, y: 200, width: 200, height: 150 };
    expect(isElementInViewport(elemFarRight, viewport, canvasWidth, canvasHeight, 50)).toBe(false);

    // Far to the bottom
    const elemFarBottom = { x: 200, y: 3000, width: 200, height: 150 };
    expect(isElementInViewport(elemFarBottom, viewport, canvasWidth, canvasHeight, 50)).toBe(false);

    // Far to the left (negative coordinates)
    const elemFarLeft = { x: -800, y: 200, width: 200, height: 150 };
    expect(isElementInViewport(elemFarLeft, viewport, canvasWidth, canvasHeight, 50)).toBe(false);
  });

  it('includes elements intersecting the buffer zone for seamless panning', () => {
    // 30px to the right of canvas edge (inside 100px buffer)
    const elemInBuffer = { x: 1030, y: 200, width: 100, height: 100 };
    expect(isElementInViewport(elemInBuffer, viewport, canvasWidth, canvasHeight, 100)).toBe(true);
  });

  it('dynamically adapts culling when board viewport is panned or zoomed', () => {
    const elem = { x: 2500, y: 1500, width: 300, height: 200 };
    // At origin, it is off-screen
    expect(isElementInViewport(elem, { x: 0, y: 0, zoom: 1 }, canvasWidth, canvasHeight)).toBe(false);

    // After panning camera to center on element (e.g. x: -2200, y: -1200)
    const pannedViewport = { x: -2200, y: -1200, zoom: 1 };
    expect(isElementInViewport(elem, pannedViewport, canvasWidth, canvasHeight)).toBe(true);

    // After zooming out to 0.2x zoom
    const zoomedOutViewport = { x: 0, y: 0, zoom: 0.2 };
    expect(isElementInViewport(elem, zoomedOutViewport, canvasWidth, canvasHeight)).toBe(true);
  });
});

describe('Miro Board Magnetic Snap & Alignment Guide Engine', () => {
  const targetElement = { id: 'target-1', x: 200, y: 300, width: 150, height: 100 };

  it('magnetically snaps left edge to target left edge within threshold', () => {
    // Drag box left edge is at 203 (delta = -3, within threshold of 8)
    const dragBox = { x: 203, y: 50, width: 120, height: 80 };
    const result = computeSnapAlignment(dragBox, [targetElement], { snapThreshold: 8, zoom: 1 });

    expect(result.x).toBe(200);
    expect(result.guides.length).toBeGreaterThan(0);
    const vGuide = result.guides.find((g) => g.orientation === 'vertical');
    expect(vGuide).toBeDefined();
    expect(vGuide?.pos).toBe(200);
  });

  it('magnetically snaps center to center alignment', () => {
    // Target center is 200 + 75 = 275
    // Drag box width 100 -> center at x + 50. If x = 227 -> center = 277 (delta = -2)
    const dragBox = { x: 227, y: 50, width: 100, height: 80 };
    const result = computeSnapAlignment(dragBox, [targetElement], { snapThreshold: 8, zoom: 1 });

    expect(result.x).toBe(225); // 225 + 50 = 275 (exact center match)
    const vGuide = result.guides.find((g) => g.orientation === 'vertical');
    expect(vGuide?.snapType).toBe('center');
  });

  it('magnetically snaps top edge to target top edge within threshold', () => {
    // Target top is 300. Drag top is at 304 (within threshold)
    const dragBox = { x: 500, y: 304, width: 120, height: 80 };
    const result = computeSnapAlignment(dragBox, [targetElement], { snapThreshold: 8, zoom: 1 });

    expect(result.y).toBe(300);
    const hGuide = result.guides.find((g) => g.orientation === 'horizontal');
    expect(hGuide).toBeDefined();
    expect(hGuide?.pos).toBe(300);
  });

  it('does not snap when distance exceeds threshold', () => {
    const dragBox = { x: 450, y: 500, width: 100, height: 80 };
    const result = computeSnapAlignment(dragBox, [targetElement], { snapThreshold: 8, zoom: 1 });

    expect(result.x).toBe(450);
    expect(result.y).toBe(500);
    expect(result.guides.length).toBe(0);
  });
});

describe('Miro Board Grouping Engine', () => {
  const elements: BoardElement[] = [
    { id: '1', type: 'sticky', x: 100, y: 150, width: 200, height: 100, groupId: 'grp-1' },
    { id: '2', type: 'image', x: 350, y: 200, width: 300, height: 250, groupId: 'grp-1' },
    { id: '3', type: 'text', x: 800, y: 50, width: 100, height: 50 }, // outside group
  ];

  it('calculates the enclosing bounding box of grouped elements with padding', () => {
    const box = getGroupBoundingBox('grp-1', elements);
    expect(box).not.toBeNull();
    // Min X: 100 - 24 = 76
    // Min Y: 150 - 24 = 126
    // Max X: 350 + 300 = 650. Width = 650 - 100 + 48 = 598
    // Max Y: 200 + 250 = 450. Height = 450 - 150 + 48 = 348
    expect(box?.x).toBe(76);
    expect(box?.y).toBe(126);
    expect(box?.width).toBe(598);
    expect(box?.height).toBe(348);
    expect(box?.elements.length).toBe(2);
  });

  it('returns null for empty or non-existent group id', () => {
    expect(getGroupBoundingBox('grp-non-existent', elements)).toBeNull();
  });

  it('supports explicit group bounds and auto-expands when child exceeds bounds', () => {
    const group = { id: 'grp-1', title: '', x: 50, y: 50, width: 300, height: 200, color: '#8400FF' };
    const box = getGroupBoundingBox('grp-1', elements, group);
    expect(box).not.toBeNull();
    expect(box!.x).toBeLessThanOrEqual(50);
    expect(box!.width).toBeGreaterThanOrEqual(600);
  });
});

describe('Miro Board Database Operations', () => {
  const testBoardId = `test_board_${Date.now()}`;

  it('creates and retrieves a new board in database', async () => {
    const created = await createProjectBoardDB({
      id: testBoardId,
      projectId: 1,
      title: 'Sprint Planning Canvas',
      data: {
        elements: [
          { id: 'el-1', type: 'sticky', x: 50, y: 50, width: 200, height: 150, title: 'Epic 1' },
          { id: 'el-2', type: 'audio', x: 300, y: 50, width: 300, height: 120, title: 'Voice Spec' },
        ],
        groups: [{ id: 'grp-1', title: 'Sprint 4' }],
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    });

    expect(created.id).toBe(testBoardId);
    expect(created.title).toBe('Sprint Planning Canvas');
    expect(created.data.elements.length).toBe(2);

    const fetched = await getProjectBoardByIdDB(testBoardId);
    expect(fetched).not.toBeNull();
    expect(fetched?.title).toBe('Sprint Planning Canvas');
    expect(fetched?.data.elements.length).toBe(2);
  });

  it('updates board data and title', async () => {
    const updated = await updateProjectBoardDB(testBoardId, {
      title: 'Updated Planning Canvas',
      data: {
        elements: [
          { id: 'el-1', type: 'sticky', x: 100, y: 100, width: 200, height: 150, title: 'Updated Epic' },
        ],
        groups: [],
        viewport: { x: 20, y: 20, zoom: 1.2 },
      },
    });

    expect(updated).not.toBeNull();
    expect(updated?.title).toBe('Updated Planning Canvas');
    expect(updated?.data.elements.length).toBe(1);
    expect(updated?.data.viewport.zoom).toBe(1.2);
  });

  it('deletes board cleanly', async () => {
    const success = await deleteProjectBoardDB(testBoardId);
    expect(success).toBe(true);

    const check = await getProjectBoardByIdDB(testBoardId);
    expect(check).toBeNull();
  });
});

describe('Miro Board Public Share Links', () => {
  const shareBoardId = `share_test_board_${Date.now()}`;

  it('creates and retrieves a public share link without expiry', async () => {
    // First create a board to share
    await createProjectBoardDB({
      id: shareBoardId,
      projectId: 1,
      title: 'Public Architecture Diagram',
      data: {
        elements: [
          { id: 'el-1', type: 'text', x: 100, y: 100, width: 250, height: 60, title: 'Architecture V1' },
        ],
        groups: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    });

    const share = await createBoardShareDB({
      boardId: shareBoardId,
      projectId: 1,
      expiresAt: null,
      createdBy: 'user_1',
    });

    expect(share).not.toBeNull();
    expect(share.boardId).toBe(shareBoardId);
    expect(share.expiresAt).toBeNull();
    expect(typeof share.token).toBe('string');
    expect(share.token.length).toBeGreaterThan(10);

    const activeShare = await getActiveBoardShareDB(shareBoardId);
    expect(activeShare).not.toBeNull();
    expect(activeShare?.token).toBe(share.token);

    const lookedUp = await getBoardShareByTokenDB(share.token);
    expect(lookedUp).not.toBeNull();
    expect(lookedUp?.share.token).toBe(share.token);
    expect(lookedUp?.board.title).toBe('Public Architecture Diagram');
  });

  it('updates share link with an expiration date', async () => {
    const oneHourLater = new Date(Date.now() + 3600000).toISOString();
    const updatedShare = await createBoardShareDB({
      boardId: shareBoardId,
      projectId: 1,
      expiresAt: oneHourLater,
      createdBy: 'user_1',
    });

    expect(updatedShare.expiresAt).toBe(oneHourLater);

    const activeShare = await getActiveBoardShareDB(shareBoardId);
    expect(activeShare?.expiresAt).toBe(oneHourLater);
  });

  it('revokes public share link cleanly', async () => {
    const revoked = await revokeBoardShareDB(shareBoardId);
    expect(revoked).toBe(true);

    const activeShare = await getActiveBoardShareDB(shareBoardId);
    expect(activeShare).toBeNull();

    // Clean up test board
    await deleteProjectBoardDB(shareBoardId);
  });
});

