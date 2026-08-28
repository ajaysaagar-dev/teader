import { NextResponse } from 'next/server';
import { deleteProjectDB, updateProjectDB } from '@/lib/db';
import { getSessionFromCookie } from '@/lib/auth';
import { parseBody, UpdateProjectSchema } from '@/lib/validation';
import { broadcastRealtimeEvent } from '@/lib/realtime';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolvedParams = await params;
  const { data, error } = await parseBody(req, UpdateProjectSchema);
  if (error) {
    return NextResponse.json({ error: 'Validation failed', issues: error.issues }, { status: 400 });
  }

  try {
    const result = await updateProjectDB(resolvedParams.id, {
      name: data.name,
      description: data.description,
    });

    broadcastRealtimeEvent({
      type: 'PROJECT_UPDATED',
      projectId: resolvedParams.id,
      payload: { id: resolvedParams.id, ...data },
      senderSessionId: session.id,
    });

    return NextResponse.json(result);
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

  try {
    const resolvedParams = await params;
    const result = await deleteProjectDB(resolvedParams.id);

    broadcastRealtimeEvent({
      type: 'PROJECT_DELETED',
      projectId: resolvedParams.id,
      payload: { id: resolvedParams.id },
      senderSessionId: session.id,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
