import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth';
import {
  getAllProjectsDB,
  getProjectMessagesDB,
  createProjectMessageDB,
  deleteProjectMessageDB,
  getProjectMembersDB,
  getUserByIdDB,
  getProjectChannelsDB,
  createProjectChannelDB,
  deleteProjectChannelDB,
} from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromCookie();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectIdStr = searchParams.get('projectId');
    const channel = searchParams.get('channel') || 'general';

    const projects: any[] = (await getAllProjectsDB(session.id)) || [];
    if (!projects || projects.length === 0) {
      return NextResponse.json({ projects: [], channels: [], messages: [], members: [], isUserAdmin: false });
    }

    let currentProjectId = projectIdStr ? Number(projectIdStr) : projects[0].id;
    const selectedProject = projects.find((p: any) => p.id === currentProjectId) || projects[0];
    currentProjectId = selectedProject.id;

    // Fetch dynamic channels for active project
    const channels = await getProjectChannelsDB(currentProjectId);

    // Fetch messages for active project and channel
    const messages = await getProjectMessagesDB(currentProjectId, channel);

    // Fetch joined members
    const members: any[] = (await getProjectMembersDB(String(currentProjectId))) || [];

    // Calculate admin permissions for current session user
    const memberEntry = members.find((m: any) => m.userId === session.id);
    const isUserAdmin =
      session.id === 1 ||
      selectedProject.owner_id === session.id ||
      selectedProject.creatorId === session.id ||
      memberEntry?.role === 'owner' ||
      memberEntry?.role === 'admin';

    const currentUserRole = isUserAdmin
      ? (selectedProject.owner_id === session.id || session.id === 1 ? 'owner' : 'admin')
      : (memberEntry?.role || 'member');

    return NextResponse.json({
      projects,
      selectedProjectId: currentProjectId,
      channels,
      messages,
      members,
      isUserAdmin,
      currentUserRole,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch conversations' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromCookie();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, content, channel = 'general' } = body;

    if (!projectId || !content || !content.trim()) {
      return NextResponse.json({ error: 'Project ID and message content are required' }, { status: 400 });
    }

    const user = (await getUserByIdDB(session.id)) || session;

    // Find member role in project
    const members: any[] = (await getProjectMembersDB(String(projectId))) || [];
    const memberEntry = members.find((m: any) => m.userId === session.id);
    const userRole = memberEntry?.role || (user.id === 1 ? 'owner' : 'member');

    // Any member in project can send messages to any channel
    const newMsg = await createProjectMessageDB(
      Number(projectId),
      user.id,
      user.name,
      user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      userRole,
      content.trim(),
      channel
    );

    return NextResponse.json({ message: newMsg });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to send message' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSessionFromCookie();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get('id');
    const projectIdStr = searchParams.get('projectId');

    if (!messageId) {
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 });
    }

    let isUserAdmin = session.id === 1;

    if (projectIdStr) {
      const projectId = Number(projectIdStr);
      const members: any[] = (await getProjectMembersDB(String(projectId))) || [];
      const memberEntry = members.find((m: any) => m.userId === session.id);
      if (memberEntry?.role === 'owner' || memberEntry?.role === 'admin') {
        isUserAdmin = true;
      }
    }

    // Admins can delete all messages; regular users can only delete their own messages
    await deleteProjectMessageDB(Number(messageId), session.id, isUserAdmin);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete message' }, { status: 500 });
  }
}
