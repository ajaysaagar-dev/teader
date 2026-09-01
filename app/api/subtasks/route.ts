import { NextResponse } from 'next/server';
import { addSubtaskDB, updateSubtaskDB, deleteSubtaskDB, getIssueByIdDB } from '@/lib/db';
import { getSessionFromCookie } from '@/lib/auth';
import { assertIssueAccess } from '@/lib/authz';
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
    // Verify the user is a member of the project that owns the parent issue
    await assertIssueAccess(session.id, data.issueId);

    const subtask = await addSubtaskDB(
      data.issueId,
      data.title,
      data.parentId || null,
      Boolean(data.isFolder),
      data.type || (data.isFolder ? 'folder' : 'subtask')
    );

    const parentIssue = await getIssueByIdDB(data.issueId, session.id);
    const resolvedProjectId = data.projectId || parentIssue?.projectId;

    broadcastRealtimeEvent({
      type: 'SUBTASK_UPDATED',
      projectId: resolvedProjectId,
      payload: { action: 'create', issueId: data.issueId, subtask, projectId: resolvedProjectId },
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
    // Verify the user is a member of the project that owns the parent issue
    if (data.issueId) {
      await assertIssueAccess(session.id, data.issueId);
    }

    await updateSubtaskDB(data.subId, {
      title: data.title,
      completed: data.completed,
      parentId: data.parentId !== undefined ? data.parentId : undefined,
      issueId: data.issueId,
    });

    const parentIssue = data.issueId ? await getIssueByIdDB(data.issueId, session.id) : null;
    const resolvedProjectId = data.projectId || parentIssue?.projectId;

    broadcastRealtimeEvent({
      type: 'SUBTASK_UPDATED',
      projectId: resolvedProjectId,
      payload: {
        action: 'update',
        subId: data.subId,
        completed: data.completed,
        title: data.title,
        parentId: data.parentId,
        issueId: data.issueId,
        projectId: resolvedProjectId,
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
