import { NextResponse } from 'next/server';
import { getAllIssuesDB, createIssueDB } from '@/lib/db';
import { getSessionFromCookie } from '@/lib/auth';
import { assertProjectAccess, assertPermission } from '@/lib/authz';
import { parseBody, CreateIssueSchema } from '@/lib/validation';
import { broadcastRealtimeEvent } from '@/lib/realtime';
import { logHistory } from '@/lib/history';

export async function GET() {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const issues = await getAllIssuesDB(session.id);
    return NextResponse.json(issues);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await parseBody(req, CreateIssueSchema);
  if (error) {
    return NextResponse.json({ error: 'Validation failed', issues: error.issues }, { status: 400 });
  }

  try {
    // Verify the user is a member of the target project and has create permission
    if (data.projectId) {
      try {
        const { allowed } = await assertPermission(session.id, data.projectId, 'can_create_tasks');
        if (!allowed) {
          return NextResponse.json({ error: 'Forbidden: You do not have permission to create tasks or folders in this project.' }, { status: 403 });
        }
      } catch (err: any) {
        const status = err.status || 403;
        return NextResponse.json({ error: err.message }, { status });
      }
    }

    const created = await createIssueDB({
      title: data.title,
      description: data.description,
      status: data.status || 'todo',
      priority: data.priority || 'medium',
      project: data.project,
      projectId: data.projectId,
      epic: data.epic,
      folderId: data.folderId,
      sprint: data.sprint,
      dueDate: data.dueDate,
      estimatedHours: data.estimatedHours,
      labels: data.labels,
      tags: data.tags,
      subtasks: data.subtasks,
      assigneeName: data.assigneeName,
      reporterName: data.reporterName || session.name || session.email || 'Current User',
    });

    const isFolder = created.title.startsWith('📁 ');
    if (created.projectId) {
      await logHistory({
        projectId: created.projectId,
        userId: session.id,
        userName: session.name || session.email || 'User',
        userAvatar: session.avatar,
        action: isFolder ? 'folder_created' : 'task_created',
        entityType: isFolder ? 'folder' : 'task',
        entityId: created.id,
        entityTitle: created.title,
        details: {
          key: created.key,
          status: created.status,
          priority: created.priority,
          epic: created.epic,
          folderId: created.folderId,
        },
        senderSessionId: session.id,
      });
    }

    broadcastRealtimeEvent({
      type: 'TASK_CREATED',
      projectId: created.projectId,
      payload: created,
      senderSessionId: session.id,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
