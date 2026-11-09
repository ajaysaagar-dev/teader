import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSessionFromCookie } from '@/lib/auth';
import { assertProjectAccess } from '@/lib/authz';
import { getProjectByIdDB, getProjectBoardByIdDB, createBoardShareDB, getActiveBoardShareDB, revokeBoardShareDB } from '@/lib/db';

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
      return NextResponse.json({ error: err.message }, { status: err.status || 403 });
    }

    const share = await getActiveBoardShareDB(boardId);
    return NextResponse.json({ share: share || null });
  } catch (error: any) {
    console.error('[GET /api/projects/[id]/boards/[boardId]/share error]:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(
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
      return NextResponse.json({ error: err.message }, { status: err.status || 403 });
    }

    const board = await getProjectBoardByIdDB(boardId);
    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const expiry = body.expiry || 'never'; // '1h' | '24h' | '7d' | '30d' | 'never'

    let expiresAt: string | null = null;
    const now = Date.now();
    if (expiry === '1h') {
      expiresAt = new Date(now + 60 * 60 * 1000).toISOString();
    } else if (expiry === '24h') {
      expiresAt = new Date(now + 24 * 60 * 60 * 1000).toISOString();
    } else if (expiry === '7d') {
      expiresAt = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (expiry === '30d') {
      expiresAt = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    const token = crypto.randomBytes(24).toString('base64url');
    const shareId = `share_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const created = await createBoardShareDB({
      id: shareId,
      boardId,
      projectId: targetProjId,
      token,
      createdBy: session.id,
      expiresAt,
    });

    return NextResponse.json({ share: created });
  } catch (error: any) {
    console.error('[POST /api/projects/[id]/boards/[boardId]/share error]:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

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
    const project = await getProjectByIdDB(rawProjectId);
    const targetProjId = project ? project.id : Number(rawProjectId) || 1;

    try {
      await assertProjectAccess(session.id, targetProjId);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: err.status || 403 });
    }

    await revokeBoardShareDB(boardId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[DELETE /api/projects/[id]/boards/[boardId]/share error]:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
