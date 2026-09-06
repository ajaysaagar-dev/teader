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

    // Re-verify user still exists in DB
    const dbUser = await getUserByIdDB(session.id);
    if (!dbUser) {
      return NextResponse.json({ user: null, authenticated: false, error: 'User no longer exists' }, { status: 200 });
    }

    return NextResponse.json({ user: dbUser, authenticated: true }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ user: null, authenticated: false, error: err.message }, { status: 200 });
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

