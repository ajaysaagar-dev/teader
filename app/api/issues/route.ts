import { NextResponse } from 'next/server';
import { getAllIssuesDB, createIssueDB } from '@/lib/db';
import { getSessionFromCookie } from '@/lib/auth';
import { assertProjectAccess } from '@/lib/authz';
import { parseBody, CreateIssueSchema } from '@/lib/validation';
import { broadcastRealtimeEvent } from '@/lib/realtime';

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
    // Verify the user is a member of the target project before creating
    if (data.projectId) {
      try {
        await assertProjectAccess(session.id, data.projectId);
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
      sprint: data.sprint,
      dueDate: data.dueDate,
      estimatedHours: data.estimatedHours,
      labels: data.labels,
      subtasks: data.subtasks,
      assigneeName: data.assigneeName,
      reporterName: data.reporterName || session.name || session.email || 'Current User',
    });

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
