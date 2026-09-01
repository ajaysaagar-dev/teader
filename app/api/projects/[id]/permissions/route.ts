import { NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth';
import { assertProjectAccess, assertPermission } from '@/lib/authz';
import { getAllMemberPermissionsDB, upsertMemberPermissionsDB, getProjectByIdDB, getUserByIdDB } from '@/lib/db';
import { parseBody, UpdateMemberPermissionsSchema } from '@/lib/validation';
import { logHistory } from '@/lib/history';
import { broadcastRealtimeEvent } from '@/lib/realtime';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const resolvedParams = await params;
    const projectId = resolvedParams.id;
    await assertProjectAccess(session.id, projectId);

    const memberPermissions = await getAllMemberPermissionsDB(projectId);
    return NextResponse.json(memberPermissions);
  } catch (err: any) {
    const status = err.status || 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const resolvedParams = await params;
    const projectId = resolvedParams.id;

    // Only owner, admin, or members with can_manage_members can edit permissions
    const { allowed } = await assertPermission(session.id, projectId, 'can_manage_members');
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to manage member permissions.' }, { status: 403 });
    }

    const { data, error } = await parseBody(req, UpdateMemberPermissionsSchema);
    if (error) {
      return NextResponse.json({ error: 'Validation failed', issues: error.issues }, { status: 400 });
    }

    const project = await getProjectByIdDB(projectId);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // Cannot modify creator/owner permissions
    if (Number(data.userId) === Number(project.owner_id) || Number(data.userId) === Number(project.creatorId)) {
      return NextResponse.json({ error: 'Cannot modify permissions of the project creator/owner.' }, { status: 400 });
    }

    const updated = await upsertMemberPermissionsDB(projectId, data.userId, data.permissions);

    const targetUser = await getUserByIdDB(data.userId);
    const targetName = targetUser?.name || `User ${data.userId}`;

    await logHistory({
      projectId,
      projectKey: project.key,
      userId: session.id,
      userName: session.name || session.email || 'Admin',
      userAvatar: session.avatar,
      action: 'member_permissions_updated',
      entityType: 'member',
      entityId: String(data.userId),
      entityTitle: targetName,
      details: {
        updatedPermissions: data.permissions,
        targetUserId: data.userId,
        targetUserName: targetName,
      },
      senderSessionId: session.id,
    });

    broadcastRealtimeEvent({
      type: 'PROJECT_UPDATED',
      projectId,
      payload: {
        type: 'PERMISSIONS_UPDATED',
        projectId,
        userId: data.userId,
        permissions: updated,
      },
      senderSessionId: session.id,
    });

    return NextResponse.json({ success: true, permissions: updated });
  } catch (err: any) {
    const status = err.status || 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
