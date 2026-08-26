import { describe, it, expect } from 'vitest';
import { isRateLimited, rateLimitKey } from '../lib/ratelimit';

describe('isRateLimited', () => {
  it('allows requests below the limit', () => {
    const key = rateLimitKey('1.2.3.4', 'test-below-limit@example.com');
    // Should not be rate limited on first few calls
    for (let i = 0; i < 5; i++) {
      expect(isRateLimited(key)).toBe(false);
    }
  });

  it('blocks requests after exceeding MAX_ATTEMPTS', () => {
    const key = rateLimitKey('9.9.9.9', 'test-exceed-limit@example.com');
    // Exhaust the limit (10 allowed)
    for (let i = 0; i < 10; i++) {
      isRateLimited(key);
    }
    // 11th request should be blocked
    expect(isRateLimited(key)).toBe(true);
  });

  it('uses separate buckets for different keys', () => {
    const key1 = rateLimitKey('1.1.1.1', 'user1@example.com');
    const key2 = rateLimitKey('2.2.2.2', 'user2@example.com');

    // Exhaust key1
    for (let i = 0; i < 11; i++) {
      isRateLimited(key1);
    }

    // key2 should still be allowed
    expect(isRateLimited(key2)).toBe(false);
  });
});

describe('rateLimitKey', () => {
  it('includes both ip and email in the key', () => {
    const key = rateLimitKey('192.168.1.1', 'User@Example.COM');
    expect(key).toContain('192.168.1.1');
    expect(key).toContain('user@example.com'); // normalized to lowercase
  });
});
