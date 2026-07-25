import { NextResponse } from 'next/server';
import { joinProjectDB } from '@/lib/db';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get('teader_user');

    if (!userCookie || !userCookie.value) {
      return NextResponse.json({ error: 'Unauthorized. Please log in first.' }, { status: 401 });
    }

    const currentUser = JSON.parse(userCookie.value);
    const body = await req.json();

    if (!body.projectKey) {
      return NextResponse.json({ error: 'Project Key is required' }, { status: 400 });
    }

    const joinedProject = await joinProjectDB(currentUser.id, body.projectKey);
    return NextResponse.json(joinedProject);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
