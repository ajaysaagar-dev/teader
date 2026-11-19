import { NextResponse } from 'next/server';
import { getSessionFromCookie, setSessionCookie } from '@/lib/auth';
import { getUserByIdDB, updateUserAvatarDB } from '@/lib/db';
import { isAllowedProfileImage } from '@/lib/avatar';

export async function GET() {
  try {
    const session = await getSessionFromCookie();

    if (!session) {
      return NextResponse.json({ user: null, authenticated: false }, { status: 200 });
    }

    // Try fetching latest user profile from DB, but fall back gracefully to verified JWT session if DB is reconnecting
    let dbUser: any = null;
    try {
      dbUser = await getUserByIdDB(session.id);
    } catch (err: any) {
      console.warn('[auth/me] Database query transient failure, using session payload:', err?.message);
    }

    const effectiveUser = dbUser || {
      id: session.id,
      name: session.name,
      email: session.email,
      avatar: session.avatar,
    };

    // Refresh and ensure teader_session cookie is set for browser navigations
    let token = '';
    try {
      token = await setSessionCookie({
        id: effectiveUser.id,
        name: effectiveUser.name,
        email: effectiveUser.email,
        avatar: effectiveUser.avatar,
      });
    } catch {}

    return NextResponse.json({
      user: effectiveUser,
      token,
      authenticated: true,
    }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSessionFromCookie();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { avatar } = body;

    if (!avatar || typeof avatar !== 'string' || !isAllowedProfileImage(avatar)) {
      return NextResponse.json(
        { error: 'Invalid profile image selected. Please select one of the allowed avatar profiles.' },
        { status: 400 }
      );
    }

    const updatedUser = await updateUserAvatarDB(session.id, avatar);
    if (!updatedUser) {
      return NextResponse.json({ error: 'Failed to update user avatar' }, { status: 500 });
    }

    // Refresh session cookie with updated avatar
    await setSessionCookie({
      id: session.id,
      name: session.name,
      email: session.email,
      avatar: updatedUser.avatar,
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

