import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUserByIdDB } from '@/lib/db';

export async function GET() {
  const cookieStore = await cookies();
  const userCookie = cookieStore.get('teader_user');

  if (!userCookie || !userCookie.value) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  try {
    const sessionUser = JSON.parse(userCookie.value);
    if (!sessionUser || !sessionUser.id) {
      cookieStore.delete('teader_user');
      return NextResponse.json({ user: null }, { status: 401 });
    }

    // Verify against MySQL DB users table
    const dbUser = await getUserByIdDB(sessionUser.id);
    if (!dbUser) {
      // User is not found in database -> invalidate cookie & send 401 to redirect to login
      cookieStore.delete('teader_user');
      return NextResponse.json({ user: null, error: 'User no longer exists in database' }, { status: 401 });
    }

    return NextResponse.json({ user: dbUser });
  } catch {
    cookieStore.delete('teader_user');
    return NextResponse.json({ user: null }, { status: 401 });
  }
}
