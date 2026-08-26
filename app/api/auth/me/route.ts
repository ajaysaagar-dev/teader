import { NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth';
import { getUserByIdDB } from '@/lib/db';

export async function GET() {
  const session = await getSessionFromCookie();

  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  // Re-verify user still exists in DB
  const dbUser = await getUserByIdDB(session.id);
  if (!dbUser) {
    return NextResponse.json({ user: null, error: 'User no longer exists' }, { status: 401 });
  }

  return NextResponse.json({ user: dbUser });
}
