import { NextResponse } from 'next/server';
import { registerUserDB } from '@/lib/db';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.name || !body.email || !body.password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
    }

    const user = await registerUserDB({
      name: body.name,
      email: body.email,
      password: body.password,
    });

    const cookieStore = await cookies();
    cookieStore.set('teader_user', JSON.stringify(user), {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return NextResponse.json(user, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
