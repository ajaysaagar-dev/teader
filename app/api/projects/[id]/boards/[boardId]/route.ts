import { NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth';
import { assertProjectAccess } from '@/lib/authz';
import { getProjectBoardByIdDB, updateProjectBoardDB, deleteProjectBoardDB, getProjectByIdDB } from '@/lib/db';
import { broadcastRealtimeEvent } from '@/lib/realtime';
import { logHistory } from '@/lib/history';
import fs from 'fs';
import path from 'path';

const BOARDS_DIR = path.join(process.cwd(), 'data', 'boards');

function ensureBoardsDir() {
  if (!fs.existsSync(BOARDS_DIR)) {
    fs.mkdirSync(BOARDS_DIR, { recursive: true });
  }
}

/**
 * GET /api/projects/[id]/boards/[boardId]
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; boardId: string }> }
) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolvedParams = await params;
  const rawProjectId = resolvedParams.id;
  const boardId = resolvedParams.boardId;

  try {
    const project = await getProjectByIdDB(rawProjectId);
    const targetProjId = project ? project.id : Number(rawProjectId) || 1;

    try {
      await assertProjectAccess(session.id, targetProjId);
    } catch (err: any) {
      const status = err.status || 403;
      return NextResponse.json({ error: err.message }, { status });
    }

    const board = await getProjectBoardByIdDB(boardId);
    if (!board) {
      // Check disk backup
      ensureBoardsDir();
      const diskFile = path.join(BOARDS_DIR, `proj_${targetProjId}_${boardId}.json`);
      if (fs.existsSync(diskFile)) {
        try {
          const raw = fs.readFileSync(diskFile, 'utf-8');
          const parsed = JSON.parse(raw);
          return NextResponse.json({ board: parsed });
        } catch {}
      }
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    return NextResponse.json({ board });
  } catch (error: any) {
    console.error('[GET /api/projects/[id]/boards/[boardId] error]:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * PUT /api/projects/[id]/boards/[boardId]
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; boardId: string }> }
) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolvedParams = await params;
  const rawProjectId = resolvedParams.id;
  const boardId = resolvedParams.boardId;

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
    const updates: { title?: string; data?: any; orderIndex?: number } = {};

    if (body.title !== undefined) updates.title = String(body.title).trim();
    if (body.data !== undefined) updates.data = body.data;
    if (body.orderIndex !== undefined) updates.orderIndex = Number(body.orderIndex);

    const updated = await updateProjectBoardDB(boardId, updates);
    if (!updated) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    // Save backup on disk
    try {
      const diskFile = path.join(BOARDS_DIR, `proj_${targetProjId}_${boardId}.json`);
      fs.writeFileSync(diskFile, JSON.stringify(updated, null, 2), 'utf-8');
    } catch {}

    broadcastRealtimeEvent({
      type: 'BOARD_UPDATED',
      projectId: targetProjId,
      payload: { boardId, board: updated },
      senderSessionId: session.id,
    });

    return NextResponse.json({ board: updated });
  } catch (error: any) {
    console.error('[PUT /api/projects/[id]/boards/[boardId] error]:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[id]/boards/[boardId]
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; boardId: string }> }
) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolvedParams = await params;
  const rawProjectId = resolvedParams.id;
  const boardId = resolvedParams.boardId;

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

    await deleteProjectBoardDB(boardId);

    // Remove disk backup
    try {
      const diskFile = path.join(BOARDS_DIR, `proj_${targetProjId}_${boardId}.json`);
      if (fs.existsSync(diskFile)) fs.unlinkSync(diskFile);
    } catch {}

    broadcastRealtimeEvent({
      type: 'BOARD_DELETED',
      projectId: targetProjId,
      payload: { boardId },
      senderSessionId: session.id,
    });

    logHistory({
      projectId: targetProjId,
      userId: session.id,
      userName: session.name || 'karri',
      userAvatar: session.avatar || '',
      action: 'delete',
      entityType: 'board',
      entityId: boardId,
      entityTitle: 'Canvas Board',
      details: { summary: `Deleted canvas board (${boardId})` },
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[DELETE /api/projects/[id]/boards/[boardId] error]:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
