import { NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth';
import { assertProjectAccess, assertPermission } from '@/lib/authz';
import { getProjectHistoryDB, deleteProjectHistoryEntryDB, updateProjectHistoryEntryDB } from '@/lib/db';
import { parseBody, UpdateHistoryEntrySchema } from '@/lib/validation';
import { broadcastRealtimeEvent } from '@/lib/realtime';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const resolvedParams = await params;
    const projectId = resolvedParams.id;
    await assertProjectAccess(session.id, projectId);

    const { searchParams } = new URL(req.url);
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 50;
    const offset = searchParams.get('offset') ? Number(searchParams.get('offset')) : 0;
    const entityType = searchParams.get('entityType') || undefined;
    const action = searchParams.get('action') || undefined;

    const history = await getProjectHistoryDB(projectId, { limit, offset, entityType, action });
    return NextResponse.json(history);
  } catch (err: any) {
    const status = err.status || 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const resolvedParams = await params;
    const projectId = resolvedParams.id;

    const { allowed } = await assertPermission(session.id, projectId, 'can_delete_history');
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to delete history logs.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const entryId = searchParams.get('entryId');
    if (!entryId) {
      return NextResponse.json({ error: 'entryId is required' }, { status: 400 });
    }

    await deleteProjectHistoryEntryDB(entryId);

    broadcastRealtimeEvent({
      type: 'PROJECT_UPDATED',
      projectId,
      payload: {
        type: 'HISTORY_DELETED',
        projectId,
        entryId,
      },
      senderSessionId: session.id,
    });

    return NextResponse.json({ success: true, entryId });
  } catch (err: any) {
    const status = err.status || 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const resolvedParams = await params;
    const projectId = resolvedParams.id;

    const { allowed } = await assertPermission(session.id, projectId, 'can_edit_history');
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to edit history logs.' }, { status: 403 });
    }

    const { data, error } = await parseBody(req, UpdateHistoryEntrySchema);
    if (error) {
      return NextResponse.json({ error: 'Validation failed', issues: error.issues }, { status: 400 });
    }

    await updateProjectHistoryEntryDB(data.entryId, {
      details: data.details,
      createdAt: data.createdAt,
      action: data.action,
      entityTitle: data.entityTitle,
    });

    broadcastRealtimeEvent({
      type: 'PROJECT_UPDATED',
      projectId,
      payload: {
        type: 'HISTORY_UPDATED',
        projectId,
        entryId: data.entryId,
        updates: data,
      },
      senderSessionId: session.id,
    });

    return NextResponse.json({ success: true, entryId: data.entryId });
  } catch (err: any) {
    const status = err.status || 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}