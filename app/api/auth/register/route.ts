import { NextResponse } from 'next/server';
import { registerUserDB } from '@/lib/db';
import { setSessionCookie } from '@/lib/auth';
import { isRateLimited, rateLimitKey, getClientIp } from '@/lib/ratelimit';
import { parseBody, RegisterSchema } from '@/lib/validation';

export async function POST(req: Request) {
  const { data, error } = await parseBody(req, RegisterSchema);
  if (error) {
    return NextResponse.json({ error: 'Validation failed', issues: error.issues }, { status: 400 });
  }

  // Rate limit registrations by IP
  const key = rateLimitKey(getClientIp(req), data.email);
  if (isRateLimited(key)) {
    return NextResponse.json(
      { error: 'Too many registration attempts. Please try again later.' },
      { status: 429 }
    );
  }

  try {
    const user = await registerUserDB({
      name: data.name,
      email: data.email,
      password: data.password,
    });

    await setSessionCookie(user);
    return NextResponse.json(user, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
