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

  const identifier = (data.email || data.username || '').trim();

  // Rate limit by IP + identifier
  const key = rateLimitKey(getClientIp(req), identifier);
  if (isRateLimited(key)) {
    return NextResponse.json(
      { error: 'Too many login attempts. Please try again in 15 minutes.' },
      { status: 429 }
    );
  }

  try {
    const user = await loginUserDB(identifier, data.password);
    const token = await setSessionCookie(user, data.remember !== false);
    return NextResponse.json({ ...user, token });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }

}
