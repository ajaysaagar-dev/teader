import { NextResponse } from 'next/server';
import { reorderIssuesDB } from '@/lib/db';
import { getSessionFromCookie } from '@/lib/auth';
import { parseBody, ReorderIssuesSchema } from '@/lib/validation';
import { broadcastRealtimeEvent } from '@/lib/realtime';

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

    broadcastRealtimeEvent({
      type: 'TASKS_REORDERED',
      payload: { items: payload },
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
