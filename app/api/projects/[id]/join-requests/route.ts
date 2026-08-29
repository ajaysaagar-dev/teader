import { NextResponse } from 'next/server';
import { getProjectByIdDB, getProjectJoinRequestsDB, handleJoinRequestActionDB, cancelJoinRequestDB } from '@/lib/db';
import { getSessionFromCookie } from '@/lib/auth';
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
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const isOwner = Number(project.owner_id) === Number(session.id) || Number(project.creatorId) === Number(session.id);
    if (!isOwner) {
      return NextResponse.json({ error: 'Forbidden. Owner privileges required.' }, { status: 403 });
    }

    const requests = await getProjectJoinRequestsDB(project.id);
    return NextResponse.json(requests);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const resolvedParams = await params;
    const project = await getProjectByIdDB(resolvedParams.id);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const isOwner = Number(project.owner_id) === Number(session.id) || Number(project.creatorId) === Number(session.id);
    if (!isOwner) {
      return NextResponse.json({ error: 'Forbidden. Owner privileges required.' }, { status: 403 });
    }

    const body = await req.json();
    const { targetUserId, action } = body;
    if (!targetUserId || !action || !['accept', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'targetUserId and valid action (accept/reject) are required' }, { status: 400 });
    }

    const pendingRequests = await getProjectJoinRequestsDB(project.id);
    const requestExists = pendingRequests.some((request: { userId: string | number }) => Number(request.userId) === Number(targetUserId));
    if (!requestExists) {
      return NextResponse.json({ error: 'No pending join request exists for this user.' }, { status: 404 });
    }

    const result = await handleJoinRequestActionDB(project.id, targetUserId, action);

    broadcastRealtimeEvent({
      type: 'PROJECT_UPDATED',
      projectId: project.id,
      payload: {
        type: action === 'accept' ? 'MEMBER_JOINED' : 'JOIN_REQUEST_REJECTED',
        projectId: project.id,
        targetUserId,
      },
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
    const project = await getProjectByIdDB(resolvedParams.id);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await cancelJoinRequestDB(project.id, session.id);

    broadcastRealtimeEvent({
      type: 'PROJECT_UPDATED',
      projectId: project.id,
      payload: {
        type: 'JOIN_REQUEST_CANCELLED',
        projectId: project.id,
        userId: session.id,
      },
      senderSessionId: session.id,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
