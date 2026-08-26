import { NextResponse } from 'next/server';
import { joinProjectDB } from '@/lib/db';
import { getSessionFromCookie } from '@/lib/auth';

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

    const joinedProject = await joinProjectDB(session.id, body.projectKey);
    return NextResponse.json(joinedProject);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
