import { NextResponse } from 'next/server';
import { loginUserDB } from '@/lib/db';
import { setSessionCookie } from '@/lib/auth';
import { isRateLimited, rateLimitKey, getClientIp } from '@/lib/ratelimit';
import { parseBody, LoginSchema } from '@/lib/validation';

export async function POST(req: Request) {
  const { data, error } = await parseBody(req, LoginSchema);
  if (error) {
    return NextResponse.json({ error: 'Validation failed', issues: error.issues }, { status: 400 });
  }

  // Rate limit by IP + email
  const key = rateLimitKey(getClientIp(req), data.email);
  if (isRateLimited(key)) {
    return NextResponse.json(
      { error: 'Too many login attempts. Please try again in 15 minutes.' },
      { status: 429 }
    );
  }

  try {
    const user = await loginUserDB(data.email, data.password);
    await setSessionCookie(user);
    return NextResponse.json(user);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
}
