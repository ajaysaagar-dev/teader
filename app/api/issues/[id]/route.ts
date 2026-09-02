import { NextResponse } from 'next/server';
import { updateIssueStatusDB, deleteIssueDB, getIssueByIdDB } from '@/lib/db';
import { getSessionFromCookie } from '@/lib/auth';
import { assertIssueAccess, assertPermission } from '@/lib/authz';
import { parseBody, UpdateIssueSchema } from '@/lib/validation';
import { broadcastRealtimeEvent } from '@/lib/realtime';
import { logHistory } from '@/lib/history';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolvedParams = await params;

  // Verify the user is a member of the project that owns this issue
  let projectId: number;
  try {
    const access = await assertIssueAccess(session.id, resolvedParams.id);
    projectId = access.projectId;
  } catch (err: any) {
    const status = err.status || 403;
    return NextResponse.json({ error: err.message }, { status });
  }

  const { data, error } = await parseBody(req, UpdateIssueSchema);
  if (error) {
    return NextResponse.json({ error: 'Validation failed', issues: error.issues }, { status: 400 });
  }

  // If attempting to edit createdAt date, verify can_edit_dates permission
  if (data.createdAt !== undefined) {
    const { allowed } = await assertPermission(session.id, projectId, 'can_edit_dates');
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden: Admin privilege required to edit created date.' }, { status: 403 });
    }
  }

  // Ensure completedByName defaults to the current session user when marking done, and verify can_complete_tasks permission
  if (data.status === 'done') {
    const { allowed } = await assertPermission(session.id, projectId, 'can_complete_tasks');
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to move tasks to Complete / Done.' }, { status: 403 });
    }
    if (!data.completedByName) {
      data.completedByName = session.name || session.email || 'Current User';
    }
    if (!data.completedAt) {
      data.completedAt = new Date().toISOString();
    }
  }

  try {
    const existing = await getIssueByIdDB(resolvedParams.id, session.id);
    await updateIssueStatusDB(resolvedParams.id, data);
    const updated = await getIssueByIdDB(resolvedParams.id, session.id);

    const isFolder = (updated?.title || existing?.title || '').startsWith('📁 ');
    const entityType = isFolder ? 'folder' : 'task';

    // Log history for date change specifically or general update
    if (data.createdAt !== undefined && existing?.createdAt !== data.createdAt) {
      await logHistory({
        projectId: updated?.projectId || projectId,
        userId: session.id,
        userName: session.name || session.email || 'Admin',
        userAvatar: session.avatar,
        action: 'date_edited',
        entityType,
        entityId: resolvedParams.id,
        entityTitle: updated?.title || existing?.title,
        details: {
          key: updated?.key || existing?.key,
          oldCreatedAt: existing?.createdAt,
          newCreatedAt: data.createdAt,
        },
        senderSessionId: session.id,
      });
    } else {
      await logHistory({
        projectId: updated?.projectId || projectId,
        userId: session.id,
        userName: session.name || session.email || 'User',
        userAvatar: session.avatar,
        action: isFolder ? 'folder_updated' : 'task_updated',
        entityType,
        entityId: resolvedParams.id,
        entityTitle: updated?.title || existing?.title,
        details: {
          key: updated?.key || existing?.key,
          updatedFields: Object.keys(data),
          changes: data,
        },
        senderSessionId: session.id,
      });
    }

    broadcastRealtimeEvent({
      type: 'TASK_UPDATED',
      projectId: updated?.projectId || projectId,
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

  // Verify the user has can_delete_tasks permission
  let projectId: number;
  try {
    const access = await assertIssueAccess(session.id, resolvedParams.id);
    projectId = access.projectId;
    const { allowed } = await assertPermission(session.id, projectId, 'can_delete_tasks');
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to delete tasks in this project.' }, { status: 403 });
    }
  } catch (err: any) {
    const status = err.status || 403;
    return NextResponse.json({ error: err.message }, { status });
  }

  try {
    const existing = await getIssueByIdDB(resolvedParams.id, session.id);
    await deleteIssueDB(resolvedParams.id);

    const isFolder = (existing?.title || '').startsWith('📁 ');
    await logHistory({
      projectId: existing?.projectId || projectId,
      userId: session.id,
      userName: session.name || session.email || 'User',
      userAvatar: session.avatar,
      action: isFolder ? 'folder_deleted' : 'task_deleted',
      entityType: isFolder ? 'folder' : 'task',
      entityId: resolvedParams.id,
      entityTitle: existing?.title,
      details: {
        key: existing?.key,
        status: existing?.status,
        epic: existing?.epic,
      },
      senderSessionId: session.id,
    });

    broadcastRealtimeEvent({
      type: 'TASK_DELETED',
      projectId: existing?.projectId || projectId,
      payload: { id: resolvedParams.id },
      senderSessionId: session.id,
    });

    return NextResponse.json({ success: true, id: resolvedParams.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
