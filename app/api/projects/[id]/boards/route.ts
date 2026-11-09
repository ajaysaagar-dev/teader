import { NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth';
import { assertProjectAccess } from '@/lib/authz';
import { getProjectBoardsDB, createProjectBoardDB, getProjectByIdDB } from '@/lib/db';
import { broadcastRealtimeEvent } from '@/lib/realtime';
import { logHistory } from '@/lib/history';
import { BoardData } from '@/types/board';
import fs from 'fs';
import path from 'path';

const BOARDS_DIR = path.join(process.cwd(), 'data', 'boards');

function ensureBoardsDir() {
  if (!fs.existsSync(BOARDS_DIR)) {
    fs.mkdirSync(BOARDS_DIR, { recursive: true });
  }
}

function getInitialDemoBoard(targetProjId: number | string, boardId: string) {
  const initialData: BoardData = {
    elements: [
      // 1. Group 1: Inspiration & Visual Assets (Contains sticky, image, link)
      {
        id: 'elem-sticky-1',
        type: 'sticky',
        x: 100,
        y: 120,
        width: 220,
        height: 180,
        groupId: 'group-assets',
        title: 'Project Vision',
        content: 'Interactive spatial collaboration canvas.\n\n• Drag & drop any media\n• Viewport culling\n• Path snapping',
        color: '#FFFFFF', // High-contrast White Note
        textColor: '#000000',
        fontSize: 13,
      },
      {
        id: 'elem-img-1',
        type: 'image',
        x: 350,
        y: 120,
        width: 300,
        height: 190,
        groupId: 'group-assets',
        title: 'Platform Architecture Mockup',
        url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
        aspectRatio: 1.57,
        metadata: {
          filename: 'architecture-abstract.jpg',
        },
      },
      {
        id: 'elem-link-1',
        type: 'link',
        x: 100,
        y: 330,
        width: 280,
        height: 110,
        groupId: 'group-assets',
        title: 'Linear App Design System',
        url: 'https://linear.app/method',
        metadata: {
          domain: 'linear.app',
          favicon: 'https://linear.app/favicon.ico',
          description: 'Principles for high performance issue tracking and calm UX.',
        },
      },
      // 2. Audio Card with interactive audio player
      {
        id: 'elem-audio-1',
        type: 'audio',
        x: 700,
        y: 120,
        width: 320,
        height: 140,
        title: 'Voice Memo / Soundscape',
        url: 'https://actions.google.com/sounds/v1/ambiences/outdoor_ambience.ogg',
        metadata: {
          filename: 'outdoor_ambience.ogg',
          duration: 32,
          author: 'Team Design Lead',
        },
      },
      // 3. Video Card with playable video player
      {
        id: 'elem-video-1',
        type: 'video',
        x: 700,
        y: 290,
        width: 340,
        height: 230,
        title: 'Interaction Prototype Showcase',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        metadata: {
          filename: 'ForBiggerBlazes.mp4',
        },
      },
      // 4. Quick Annotations & Sticky Notes
      {
        id: 'elem-sticky-2',
        type: 'sticky',
        x: 410,
        y: 340,
        width: 240,
        height: 160,
        title: 'Next Sprint Milestone',
        content: '1. Ship Canvas Board\n2. Real-time path snapping\n3. Viewport virtualization\n4. Audio/Video widgets',
        color: '#1E1E1E', // Charcoal Note
        textColor: '#FFFFFF',
        fontSize: 13,
      },
      {
        id: 'elem-text-1',
        type: 'text',
        x: 100,
        y: 40,
        width: 480,
        height: 50,
        content: '# Teader Spatial Collaboration Board\nDrag & drop any media anywhere on the canvas.',
        fontSize: 18,
        textColor: '#FFFFFF',
      },
    ],
    groups: [
      {
        id: 'group-assets',
        title: 'Concept & Visual Research',
        color: '#8400FF',
      },
    ],
    connections: [
      {
        id: 'conn-1',
        fromId: 'elem-sticky-1',
        toId: 'elem-img-1',
        label: 'specifies',
        style: 'dashed',
        arrow: true,
      },
    ],
    viewport: { x: 40, y: 30, zoom: 0.9 },
  };

  return {
    id: boardId,
    projectId: targetProjId,
    title: 'Product Brainstorm Board',
    data: initialData,
  };
}

/**
 * GET /api/projects/[id]/boards
 * Returns list of boards for this project
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolvedParams = await params;
  const rawProjectId = resolvedParams.id;

  try {
    ensureBoardsDir();
    const project = await getProjectByIdDB(rawProjectId);
    const targetProjId = project ? project.id : Number(rawProjectId) || 1;

    try {
      await assertProjectAccess(session.id, targetProjId);
    } catch (err: any) {
      const status = err.status || 403;
      return NextResponse.json({ error: err.message }, { status });
    }

    let boards = await getProjectBoardsDB(targetProjId);

    // If no boards exist, seed starter demo board
    if (!boards || boards.length === 0) {
      const defaultBoardId = `board_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const seedData = getInitialDemoBoard(targetProjId, defaultBoardId);

      const created = await createProjectBoardDB({
        id: defaultBoardId,
        projectId: targetProjId,
        userId: session.id,
        userName: session.name || 'karri',
        title: seedData.title,
        data: seedData.data,
      });

      try {
        const diskFile = path.join(BOARDS_DIR, `proj_${targetProjId}_${defaultBoardId}.json`);
        fs.writeFileSync(diskFile, JSON.stringify(created, null, 2), 'utf-8');
      } catch {}

      boards = [created];
    }

    return NextResponse.json({ boards });
  } catch (error: any) {
    console.error('[GET /api/projects/[id]/boards error]:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/projects/[id]/boards
 * Create a new board for this project
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolvedParams = await params;
  const rawProjectId = resolvedParams.id;

  try {
    ensureBoardsDir();
    const project = await getProjectByIdDB(rawProjectId);
    const targetProjId = project ? project.id : Number(rawProjectId) || 1;

    try {
      await assertProjectAccess(session.id, targetProjId);
    } catch (err: any) {
      const status = err.status || 403;
      return NextResponse.json({ error: err.message }, { status });
    }

    const body = await req.json();
    const boardId = body.id || `board_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const title = (body.title || 'Untitled Board').trim();
    const data = body.data || {
      elements: [],
      groups: [],
      connections: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    const created = await createProjectBoardDB({
      id: boardId,
      projectId: targetProjId,
      userId: session.id,
      userName: session.name || 'karri',
      title,
      data,
    });

    try {
      const diskFile = path.join(BOARDS_DIR, `proj_${targetProjId}_${boardId}.json`);
      fs.writeFileSync(diskFile, JSON.stringify(created, null, 2), 'utf-8');
    } catch {}

    broadcastRealtimeEvent({
      type: 'BOARD_CREATED',
      projectId: targetProjId,
      payload: created,
      senderSessionId: session.id,
    });

    logHistory({
      projectId: targetProjId,
      userId: session.id,
      userName: session.name || 'karri',
      userAvatar: session.avatar || '',
      action: 'create',
      entityType: 'board',
      entityId: boardId,
      entityTitle: title,
      details: { summary: `Created canvas board "${title}"` },
    }).catch(() => {});

    return NextResponse.json({ board: created }, { status: 201 });
  } catch (error: any) {
    console.error('[POST /api/projects/[id]/boards error]:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
