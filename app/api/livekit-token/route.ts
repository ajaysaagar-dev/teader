// app/api/livekit-token/route.ts
import { NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';
import { getSessionFromCookie } from '@/lib/auth';
import { assertProjectAccess } from '@/lib/authz';

export async function GET(request: Request) {
  // 1. Verify user is authenticated
  const session = await getSessionFromCookie();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Get + validate projectId from query string
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }

  // 3. Verify the user has access to this specific project
  const access = await assertProjectAccess(session.id, projectId);
  if (!access) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

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
    }),
    ttl: '1h',
  });

  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,       // publish their microphone
    canSubscribe: true,     // hear others
    canPublishData: false,  // no data channel needed for audio-only
  });

  const jwt = await token.toJwt();

  return NextResponse.json({
    token: jwt,
    url: livekitUrl,
    roomName,
    identity,
  });
}
