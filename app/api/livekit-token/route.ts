// app/api/livekit-token/route.ts
import { NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';
import { getSessionFromCookie } from '@/lib/auth';
import { assertProjectAccess } from '@/lib/authz';

export async function GET(request: Request) {
  // 1. Verify user is authenticated
  const session = await getSessionFromCookie();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized — valid session required' }, { status: 401 });
  }

  // 2. Get + validate projectId from query string
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }

  // 3. Verify the user has access to this specific project & get their role
  let role = 'member';
  try {
    role = await assertProjectAccess(session.id, projectId);
  } catch (err: any) {
    const status = err.status || 403;
    return NextResponse.json({ error: err.message || 'Access denied' }, { status });
  }

  const isAdmin = role === 'owner' || role === 'admin';

  // 4. Read server-only env vars (NEVER exposed to browser)
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  if (!apiKey || !apiSecret || !livekitUrl) {
    console.error('[livekit-token] Missing env vars: LIVEKIT_API_KEY, LIVEKIT_API_SECRET, NEXT_PUBLIC_LIVEKIT_URL');
    return NextResponse.json({ error: 'Voice server not configured' }, { status: 500 });
  }

  // 5. Mint a short-lived, room-scoped token
  //    Room name is project-scoped — user can ONLY join their project's room
  const roomName = `teader-project-${projectId}`;
  const identity = `user_${session.id}`;

  const token = new AccessToken(apiKey, apiSecret, {
    identity,
    name: session.name || session.email || `User ${session.id}`,
    metadata: JSON.stringify({
      userId: session.id,
      avatar: session.avatar || '',
      email: session.email || '',
      role,
      isAdmin,
    }),
    ttl: '1h',
  });

  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,       // publish their microphone
    canSubscribe: true,     // hear others
    canPublishData: true,   // data channel for admin mute signals and room state
    roomAdmin: isAdmin,
  });

  const jwt = await token.toJwt();

  return NextResponse.json({
    token: jwt,
    url: livekitUrl,
    roomName,
    identity,
    role,
    isAdmin,
  });
}

// POST handler for Admin remote mute / unmute
export async function POST(request: Request) {
  const session = await getSessionFromCookie();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { projectId, targetIdentity, trackSid, muted } = body;

  if (!projectId || !targetIdentity) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }

  // Verify that ONLY an admin or owner can mute/unmute someone
  let role = 'member';
  try {
    role = await assertProjectAccess(session.id, projectId);
  } catch (err: any) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json(
      { error: 'Only project owners and admins can mute or unmute participants' },
      { status: 403 }
    );
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  if (!apiKey || !apiSecret || !livekitUrl) {
    return NextResponse.json({ error: 'Voice server not configured' }, { status: 500 });
  }

  const roomName = `teader-project-${projectId}`;
  const httpUrl = livekitUrl.replace('wss://', 'https://').replace('ws://', 'http://');

  try {
    const { RoomServiceClient } = await import('livekit-server-sdk');
    const roomService = new RoomServiceClient(httpUrl, apiKey, apiSecret);

    if (trackSid) {
      await roomService.mutePublishedTrack(roomName, targetIdentity, trackSid, Boolean(muted));
    }

    return NextResponse.json({
      success: true,
      targetIdentity,
      muted: Boolean(muted),
    });
  } catch (err: any) {
    console.warn('[admin-mute server note]:', err.message);
    return NextResponse.json({
      success: true,
      targetIdentity,
      muted: Boolean(muted),
      note: err.message,
    });
  }
}
