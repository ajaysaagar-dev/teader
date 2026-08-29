import { NextResponse } from 'next/server';
import { createJoinRequestDB } from '@/lib/db';
import { getSessionFromCookie } from '@/lib/auth';
import { broadcastRealtimeEvent } from '@/lib/realtime';

export async function POST(req: Request) {
  const session = await getSessionFromCookie();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized. Please log in first.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    if (!body.projectKey) {
      return NextResponse.json({ error: 'Project Key is required' }, { status: 400 });
    }

    const result = await createJoinRequestDB(
      session.id,
      body.projectKey,
      session.name,
      session.email,
      session.avatar
    );

    broadcastRealtimeEvent({
      type: 'PROJECT_UPDATED',
      projectId: result.project.id,
      payload: {
        type: 'JOIN_REQUEST_SUBMITTED',
        projectId: result.project.id,
        userId: session.id,
        userName: session.name,
      },
      senderSessionId: session.id,
    });

    return NextResponse.json({
      success: true,
      project: result.project,
      status: 'pending',
      message: `Join request for "${result.project.name}" sent to project owner. Waiting for approval.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
