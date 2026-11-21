import { NextResponse } from 'next/server';
import { deleteProjectDB, updateProjectDB, getProjectByIdDB, getProjectMembersDB, getProjectJoinRequestsDB } from '@/lib/db';
import { getSessionFromCookie } from '@/lib/auth';
import { parseBody, UpdateProjectSchema } from '@/lib/validation';
import { broadcastRealtimeEvent } from '@/lib/realtime';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const resolvedParams = await params;
    const project = await getProjectByIdDB(resolvedParams.id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const numUserId = Number(session.id);
    const isOwner = Number(project.owner_id) === numUserId || Number(project.creatorId) === numUserId;

    // Check membership and join requests
    const members = await getProjectMembersDB(project.id);
    // getProjectMembersDB returns rows with `id` (from users JOIN), not `userId`.
    // We check both fields to be safe against any schema variations.
    const isMember = members.some(
      (m: any) => Number(m.id) === numUserId || Number(m.userId) === numUserId
    );

    let joinStatus: 'active' | 'pending' | 'none' = isOwner || isMember ? 'active' : 'none';
    if (joinStatus === 'none') {
      const joinRequests = await getProjectJoinRequestsDB(project.id);
      const hasPending = joinRequests.some((r: any) => Number(r.userId) === numUserId && r.status === 'pending');
      if (hasPending) {
        joinStatus = 'pending';
      }
    }

    if (joinStatus === 'none') {
      return NextResponse.json(
        {
          error: 'Access denied: You are not a member of this project',
          joinStatus: 'none',
          project: { id: project.id, key: project.key, name: project.name },
        },
        { status: 403 }
      );
    }

    return NextResponse.json({ ...project, joinStatus });
  } catch (err: any) {
    console.error('[GET /api/projects/[id]] Error:', err.message);
    return NextResponse.json({ error: 'Internal server error while loading project' }, { status: 500 });
  }
}

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
