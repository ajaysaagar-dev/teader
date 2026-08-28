import { NextResponse } from 'next/server';
import { addSubtaskDB, updateSubtaskDB, deleteSubtaskDB } from '@/lib/db';
import { getSessionFromCookie } from '@/lib/auth';
import { parseBody, AddSubtaskSchema, UpdateSubtaskSchema } from '@/lib/validation';
import { broadcastRealtimeEvent } from '@/lib/realtime';

export async function POST(req: Request) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await parseBody(req, AddSubtaskSchema);
  if (error) {
    return NextResponse.json({ error: 'Validation failed', issues: error.issues }, { status: 400 });
  }

  try {
    const subtask = await addSubtaskDB(
      data.issueId,
      data.title,
      data.parentId || null,
      Boolean(data.isFolder),
      data.type || (data.isFolder ? 'folder' : 'subtask')
    );

    broadcastRealtimeEvent({
      type: 'SUBTASK_UPDATED',
      payload: { action: 'create', issueId: data.issueId, subtask },
      senderSessionId: session.id,
    });

    return NextResponse.json(subtask, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await parseBody(req, UpdateSubtaskSchema);
  if (error) {
    return NextResponse.json({ error: 'Validation failed', issues: error.issues }, { status: 400 });
  }

  try {
    await updateSubtaskDB(data.subId, {
      title: data.title,
      completed: data.completed,
      parentId: data.parentId !== undefined ? data.parentId : undefined,
      issueId: data.issueId,
    });

    broadcastRealtimeEvent({
      type: 'SUBTASK_UPDATED',
      payload: {
        action: 'update',
        subId: data.subId,
        completed: data.completed,
        title: data.title,
        parentId: data.parentId,
        issueId: data.issueId,
      },
      senderSessionId: session.id,
    });

    return NextResponse.json({
      success: true,
      subId: data.subId,
      completed: data.completed,
      title: data.title,
      parentId: data.parentId,
      issueId: data.issueId,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const subId = searchParams.get('id') || (await req.json().catch(() => ({})))?.subId;
    if (!subId) {
      return NextResponse.json({ error: 'subId or id is required' }, { status: 400 });
    }

    await deleteSubtaskDB(subId);

    broadcastRealtimeEvent({
      type: 'SUBTASK_UPDATED',
      payload: { action: 'delete', subId },
      senderSessionId: session.id,
    });

    return NextResponse.json({ success: true, subId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
