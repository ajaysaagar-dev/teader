import { NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth';
import { assertProjectAccess } from '@/lib/authz';
import { reorderProjectDocsDB, getProjectByIdDB } from '@/lib/db';
import { broadcastRealtimeEvent } from '@/lib/realtime';
import { ReorderDocsSchema, parseBody } from '@/lib/validation';

/**
 * POST /api/projects/[id]/docs/reorder
 * Batch update doc ordering and folders via drag-and-drop
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolvedParams = await params;
  const rawProjectId = resolvedParams.id;

  try {
    const project = await getProjectByIdDB(rawProjectId);
    const targetProjId = project ? project.id : (Number(rawProjectId) || rawProjectId);

    await assertProjectAccess(session.id, targetProjId);

    const { data, error } = await parseBody(req, ReorderDocsSchema);
    if (error) {
      return NextResponse.json({ error: 'Validation failed', issues: error.issues }, { status: 400 });
    }

    await reorderProjectDocsDB(targetProjId, data.items);

    broadcastRealtimeEvent({
      type: 'DOCS_REORDERED',
      projectId: String(targetProjId),
      payload: { items: data.items },
      senderSessionId: session.id,
    });

    return NextResponse.json({ success: true, count: data.items.length });
  } catch (err: any) {
    const status = err.status || 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
