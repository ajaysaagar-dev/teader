import { NextResponse } from 'next/server';
import { updateIssueStatusDB, deleteIssueDB, getIssueByIdDB } from '@/lib/db';
import { getSessionFromCookie } from '@/lib/auth';
import { parseBody, UpdateIssueSchema } from '@/lib/validation';
import { broadcastRealtimeEvent } from '@/lib/realtime';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolvedParams = await params;
  const { data, error } = await parseBody(req, UpdateIssueSchema);
  if (error) {
    return NextResponse.json({ error: 'Validation failed', issues: error.issues }, { status: 400 });
  }

  try {
    await updateIssueStatusDB(resolvedParams.id, data);
    const updated = await getIssueByIdDB(resolvedParams.id);

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
  try {
    const existing = await getIssueByIdDB(resolvedParams.id);
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
