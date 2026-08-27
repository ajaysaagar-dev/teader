import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth';
import {
  getProjectChannelsDB,
  createProjectChannelDB,
  deleteProjectChannelDB,
  getProjectMembersDB,
  getProjectByIdDB,
} from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromCookie();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectIdStr = searchParams.get('projectId');

    if (!projectIdStr) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const projectId = Number(projectIdStr);
    const channels = await getProjectChannelsDB(projectId);
    return NextResponse.json({ channels });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch channels' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromCookie();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, name, description } = body;

    if (!projectId || !name || !name.trim()) {
      return NextResponse.json({ error: 'Project ID and channel name are required' }, { status: 400 });
    }

    const numProjectId = Number(projectId);

    // Verify admin/owner permissions
    const project = await getProjectByIdDB(String(numProjectId));
    const members: any[] = (await getProjectMembersDB(String(numProjectId))) || [];
    const memberEntry = members.find((m: any) => m.userId === session.id);

    const isUserAdmin =
      session.id === 1 ||
      project?.owner_id === session.id ||
      project?.creatorId === session.id ||
      memberEntry?.role === 'owner' ||
      memberEntry?.role === 'admin';

    if (!isUserAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Only project admins and creators can create channels' },
        { status: 403 }
      );
    }

    const channel = await createProjectChannelDB(
      numProjectId,
      name.trim(),
      description ? description.trim() : '',
      session.id
    );

    return NextResponse.json({ channel });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create channel' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSessionFromCookie();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectIdStr = searchParams.get('projectId');
    const channelName = searchParams.get('name');

    if (!projectIdStr || !channelName) {
      return NextResponse.json({ error: 'Project ID and channel name are required' }, { status: 400 });
    }

    const numProjectId = Number(projectIdStr);
    const cleanName = channelName.toLowerCase().trim();

    if (cleanName === 'general') {
      return NextResponse.json({ error: 'The default #general channel cannot be deleted' }, { status: 400 });
    }

    // Verify admin/owner permissions
    const project = await getProjectByIdDB(String(numProjectId));
    const members: any[] = (await getProjectMembersDB(String(numProjectId))) || [];
    const memberEntry = members.find((m: any) => m.userId === session.id);

    const isUserAdmin =
      session.id === 1 ||
      project?.owner_id === session.id ||
      project?.creatorId === session.id ||
      memberEntry?.role === 'owner' ||
      memberEntry?.role === 'admin';

    if (!isUserAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Only project admins and creators can delete channels' },
        { status: 403 }
      );
    }

    await deleteProjectChannelDB(numProjectId, cleanName);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete channel' }, { status: 500 });
  }
}
