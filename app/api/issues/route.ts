import { NextResponse } from 'next/server';
import { getAllIssuesDB, createIssueDB } from '@/lib/db';
import { getSessionFromCookie } from '@/lib/auth';
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
    const created = await createIssueDB({
      title: data.title,
      description: data.description,
      status: data.status || 'todo',
      priority: data.priority || 'medium',
      project: data.project,
      projectId: data.projectId,
      labels: data.labels,
      subtasks: data.subtasks,
      assigneeName: data.assigneeName,
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
