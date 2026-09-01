import { NextResponse } from 'next/server';
import { reorderIssuesDB } from '@/lib/db';
import { getSessionFromCookie } from '@/lib/auth';
import { parseBody, ReorderIssuesSchema } from '@/lib/validation';
import { broadcastRealtimeEvent } from '@/lib/realtime';
import { logHistory } from '@/lib/history';

export async function POST(req: Request) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await parseBody(req, ReorderIssuesSchema);
  if (error) {
    return NextResponse.json({ error: 'Validation failed', issues: error.issues }, { status: 400 });
  }

  try {
    const payload = data.items && data.items.length > 0 ? data.items : data.issueIds || [];
    const result = await reorderIssuesDB(payload);

    if (data.projectId) {
      await logHistory({
        projectId: data.projectId,
        userId: session.id,
        userName: session.name || session.email || 'User',
        userAvatar: session.avatar,
        action: 'tasks_reordered',
        entityType: 'task',
        entityTitle: 'Workspace Tasks Reordered',
        details: { reorderedCount: Array.isArray(payload) ? payload.length : 0 },
        senderSessionId: session.id,
      });
    }

    broadcastRealtimeEvent({
      type: 'TASKS_REORDERED',
      projectId: data.projectId,
      payload: { items: payload, projectId: data.projectId },
      senderSessionId: session.id,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  return POST(req);
}
