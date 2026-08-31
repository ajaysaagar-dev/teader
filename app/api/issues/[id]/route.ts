import { NextResponse } from 'next/server';
import { updateIssueStatusDB, deleteIssueDB, getIssueByIdDB } from '@/lib/db';
import { getSessionFromCookie } from '@/lib/auth';
import { assertIssueAccess } from '@/lib/authz';
import { parseBody, UpdateIssueSchema } from '@/lib/validation';
import { broadcastRealtimeEvent } from '@/lib/realtime';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolvedParams = await params;

  // Verify the user is a member of the project that owns this issue
  try {
    await assertIssueAccess(session.id, resolvedParams.id);
  } catch (err: any) {
    const status = err.status || 403;
    return NextResponse.json({ error: err.message }, { status });
  }

  const { data, error } = await parseBody(req, UpdateIssueSchema);
  if (error) {
    return NextResponse.json({ error: 'Validation failed', issues: error.issues }, { status: 400 });
  }

  // Ensure completedByName defaults to the current session user when marking done
  if (data.status === 'done') {
    if (!data.completedByName) {
      data.completedByName = session.name || session.email || 'Current User';
    }
    if (!data.completedAt) {
      data.completedAt = new Date().toISOString();
    }
  }

  try {
    await updateIssueStatusDB(resolvedParams.id, data);
    const updated = await getIssueByIdDB(resolvedParams.id, session.id);

    broadcastRealtimeEvent({
      type: 'TASK_UPDATED',
      projectId: updated?.projectId,
      payload: updated || { id: resolvedParams.id, ...data },
      senderSessionId: session.id,
    });

    return NextResponse.json({
      success: true,
      id: resolvedParams.id,
      ...data,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolvedParams = await params;

  // Verify the user is a member of the project that owns this issue
  try {
    await assertIssueAccess(session.id, resolvedParams.id);
  } catch (err: any) {
    const status = err.status || 403;
    return NextResponse.json({ error: err.message }, { status });
  }

  try {
    const existing = await getIssueByIdDB(resolvedParams.id, session.id);
    await deleteIssueDB(resolvedParams.id);

    broadcastRealtimeEvent({
      type: 'TASK_DELETED',
      projectId: existing?.projectId,
      payload: { id: resolvedParams.id },
      senderSessionId: session.id,
    });

    return NextResponse.json({ success: true, id: resolvedParams.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
