/**
 * Simple in-memory rate limiter for auth endpoints.
 * Uses a sliding-window counter keyed by IP address + email.
 * For production multi-instance deploys, swap the Map for a Redis/Upstash backend.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 10; // per window per key

/** Returns true if the request should be blocked */
export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  entry.count += 1;
  if (entry.count > MAX_ATTEMPTS) {
    return true;
  }
  return false;
}

/** Build a composite rate-limit key from IP + email */
export function rateLimitKey(ip: string, email: string): string {
  return `${ip}::${email.toLowerCase()}`;
}

/** Extract best-effort client IP from a NextRequest */
export function getClientIp(req: Request): string {
  const forwarded = (req.headers as any).get?.('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return 'unknown';
}
