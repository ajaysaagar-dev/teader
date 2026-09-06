import { NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth';
import { assertProjectAccess } from '@/lib/authz';
import { broadcastRealtimeEvent } from '@/lib/realtime';

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const projectId = params.id;
    const session = await getSessionFromCookie();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const access = await assertProjectAccess(session.id, projectId);
    if (!access) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { fromPeerId, targetPeerId, signalType, data } = body;

    if (!fromPeerId || !signalType) {
      return NextResponse.json({ error: 'fromPeerId and signalType are required' }, { status: 400 });
    }

    // Broadcast WebRTC signaling payload to all participants in project room
    await broadcastRealtimeEvent({
      type: 'MEETING_SIGNAL',
      projectId,
      payload: {
        fromPeerId,
        targetPeerId, // optional target peer ID
        signalType,   // 'offer' | 'answer' | 'candidate' | 'request-offer'
        data,
        senderUser: {
          id: session.id,
          name: session.name || session.email || 'Collaborator',
          avatar: session.avatar || '',
        },
      },
      senderSessionId: fromPeerId,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
