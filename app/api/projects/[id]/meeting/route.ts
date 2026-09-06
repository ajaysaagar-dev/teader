import { NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth';
import { assertProjectAccess } from '@/lib/authz';
import { broadcastRealtimeEvent } from '@/lib/realtime';

export interface MeetingParticipant {
  peerId: string;
  userId: number | string;
  userName: string;
  userAvatar?: string;
  userEmail?: string;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  joinedAt: number;
  lastSeen: number;
}

// Global in-memory storage for active project meetings
const globalForMeeting = global as unknown as {
  __teaderProjectMeetings?: Map<string, Map<string, MeetingParticipant>>;
};

if (!globalForMeeting.__teaderProjectMeetings) {
  globalForMeeting.__teaderProjectMeetings = new Map();
}

const projectMeetingRooms = globalForMeeting.__teaderProjectMeetings;

function getRoom(projectId: string | number): Map<string, MeetingParticipant> {
  const key = String(projectId);
  if (!projectMeetingRooms.has(key)) {
    projectMeetingRooms.set(key, new Map());
  }
  return projectMeetingRooms.get(key)!;
}

function pruneInactive(room: Map<string, MeetingParticipant>): MeetingParticipant[] {
  const cutoff = Date.now() - 35000;
  for (const [peerId, p] of room.entries()) {
    if (p.lastSeen < cutoff) {
      room.delete(peerId);
    }
  }
  return Array.from(room.values());
}

export async function GET(
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

    const room = getRoom(projectId);
    const participants = pruneInactive(room);

    return NextResponse.json({
      success: true,
      projectId,
      participants,
      count: participants.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

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
    const { action, peerId, isMuted, isDeafened, isSpeaking } = body;

    if (!peerId) {
      return NextResponse.json({ error: 'peerId is required' }, { status: 400 });
    }

    const room = getRoom(projectId);

    if (action === 'join') {
      const participant: MeetingParticipant = {
        peerId,
        userId: session.id,
        userName: session.name || session.email || 'Collaborator',
        userAvatar: session.avatar || '',
        userEmail: session.email || '',
        isMuted: isMuted ?? false,
        isDeafened: isDeafened ?? false,
        isSpeaking: false,
        joinedAt: Date.now(),
        lastSeen: Date.now(),
      };

      room.set(peerId, participant);
      const participants = pruneInactive(room);

      // Broadcast join to project
      await broadcastRealtimeEvent({
        type: 'MEETING_JOINED',
        projectId,
        payload: {
          participant,
          participants,
        },
        senderSessionId: peerId,
      });

      return NextResponse.json({
        success: true,
        participant,
        participants,
      });
    }

    if (action === 'leave') {
      const removed = room.get(peerId);
      room.delete(peerId);
      const participants = pruneInactive(room);

      if (removed) {
        await broadcastRealtimeEvent({
          type: 'MEETING_LEFT',
          projectId,
          payload: {
            peerId,
            userId: session.id,
            participants,
          },
          senderSessionId: peerId,
        });
      }

      return NextResponse.json({
        success: true,
        left: true,
        participants,
      });
    }

    if (action === 'state' || action === 'heartbeat') {
      const existing = room.get(peerId);
      if (existing) {
        existing.lastSeen = Date.now();
        if (typeof isMuted === 'boolean') existing.isMuted = isMuted;
        if (typeof isDeafened === 'boolean') existing.isDeafened = isDeafened;
        if (typeof isSpeaking === 'boolean') existing.isSpeaking = isSpeaking;

        room.set(peerId, existing);

        if (action === 'state') {
          await broadcastRealtimeEvent({
            type: 'MEETING_STATE',
            projectId,
            payload: {
              peerId,
              userId: session.id,
              isMuted: existing.isMuted,
              isDeafened: existing.isDeafened,
              isSpeaking: existing.isSpeaking,
            },
            senderSessionId: peerId,
          });
        }
      }

      const participants = pruneInactive(room);
      return NextResponse.json({
        success: true,
        participant: existing || null,
        participants,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
