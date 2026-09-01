import { NextResponse } from 'next/server';
import { getProjectMembersDB } from '@/lib/db';
import { getSessionFromCookie } from '@/lib/auth';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const resolvedParams = await params;
    const members = await getProjectMembersDB(resolvedParams.id);
    return NextResponse.json(members);
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
    const { searchParams } = new URL(req.url);
    const userIdToKick = searchParams.get('userId');

    if (!userIdToKick) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const { kickProjectMemberDB, getProjectByIdDB, getUserByIdDB } = await import('@/lib/db');
    const { broadcastRealtimeEvent } = await import('@/lib/realtime');
    const { assertPermission } = await import('@/lib/authz');
    const { logHistory } = await import('@/lib/history');

    const project = await getProjectByIdDB(resolvedParams.id);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const isOwner = Number(project.owner_id) === Number(session.id) || Number(project.creatorId) === Number(session.id);
    if (!isOwner) {
      const { allowed } = await assertPermission(session.id, project.id, 'can_manage_members');
      if (!allowed) {
        return NextResponse.json({ error: 'Forbidden. Member management privileges required to remove members.' }, { status: 403 });
      }
    }

    if (Number(userIdToKick) === Number(project.owner_id) || Number(userIdToKick) === Number(project.creatorId)) {
      return NextResponse.json({ error: 'Cannot remove the project creator/owner.' }, { status: 400 });
    }

    const targetUser = await getUserByIdDB(userIdToKick);
    const targetName = targetUser?.name || `User ${userIdToKick}`;

    await kickProjectMemberDB(project.id, userIdToKick);

    await logHistory({
      projectId: project.id,
      projectKey: project.key,
      userId: session.id,
      userName: session.name || session.email || 'Admin',
      userAvatar: session.avatar,
      action: 'member_removed',
      entityType: 'member',
      entityId: String(userIdToKick),
      entityTitle: targetName,
      details: { kickedUserId: userIdToKick, kickedUserName: targetName },
      senderSessionId: session.id,
    });

    broadcastRealtimeEvent({
      type: 'PROJECT_UPDATED',
      projectId: project.id,
      payload: {
        type: 'MEMBER_REMOVED',
        projectId: project.id,
        kickedUserId: userIdToKick,
      },
      senderSessionId: session.id,
    });

    return NextResponse.json({ success: true, message: 'Member removed from project.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
