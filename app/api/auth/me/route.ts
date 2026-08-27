import { NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth';
import { getUserByIdDB } from '@/lib/db';

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
