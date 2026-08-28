import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { verifyPassword, hashPassword } from '../lib/auth';

describe('hashPassword + verifyPassword', () => {
  it('hashes a plain text password and verifies it', async () => {
    const plain = 'my-secure-password-123';
    const hashed = await hashPassword(plain);

    expect(hashed).not.toBe(plain);
    expect(hashed.startsWith('$2b$') || hashed.startsWith('$2a$')).toBe(true);

    const isValid = await verifyPassword(plain, hashed);
    expect(isValid).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hashed = await hashPassword('correct-password');
    const isValid = await verifyPassword('wrong-password', hashed);
    expect(isValid).toBe(false);
  });

  it('migrates old sha256 hashes transparently', async () => {
    const crypto = await import('crypto');
    const plain = 'password123';
    const sha256Hash = crypto.createHash('sha256').update(plain).digest('hex');

    // sha256 hashes are 64 hex chars
    expect(sha256Hash).toHaveLength(64);

    // verifyPassword should accept the sha256 hash during migration window
    const isValid = await verifyPassword(plain, sha256Hash);
    expect(isValid).toBe(true);
  });
});

describe('signSession + verifySession', () => {
  // Set JWT_SECRET for test environment
  const originalSecret = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-jwt-secret-for-unit-tests-must-be-long-enough-to-be-valid-32b';
  });

  afterAll(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  it('signs and verifies a session payload', async () => {
    const { signSession, verifySession } = await import('../lib/auth');

    const user = { id: 1, name: 'karri', email: 'karri@teader.io', avatar: undefined };
    const token = await signSession(user);

    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3); // JWT has 3 parts

    const verified = await verifySession(token);
    expect(verified).not.toBeNull();
    expect(verified?.id).toBe(1);
    expect(verified?.email).toBe('karri@teader.io');
  });

  it('rejects tampered tokens', async () => {
    const { signSession, verifySession } = await import('../lib/auth');

    const token = await signSession({ id: 1, name: 'karri', email: 'karri@teader.io' });
    const parts = token.split('.');
    parts[1] = Buffer.from(JSON.stringify({ id: 99, email: 'hacker@evil.com' })).toString('base64url');
    const tampered = parts.join('.');

    const result = await verifySession(tampered);
    expect(result).toBeNull();
  });
});

describe('loginUserDB', () => {
  it('logs in seeded default user successfully by email', async () => {
    const { loginUserDB } = await import('../lib/db');
    const user = await loginUserDB('karri@teader.io', 'password123');
    expect(user).toBeDefined();
    expect(user.email).toBe('karri@teader.io');
    expect(user.name).toBe('karri');
  });

  it('logs in seeded default user successfully by username', async () => {
    const { loginUserDB } = await import('../lib/db');
    const user = await loginUserDB('karri', 'password123');
    expect(user).toBeDefined();
    expect(user.email).toBe('karri@teader.io');
    expect(user.name).toBe('karri');
  });

  it('rejects wrong password', async () => {
    const { loginUserDB } = await import('../lib/db');
    await expect(loginUserDB('karri@teader.io', 'wrongpassword')).rejects.toThrow('Invalid email or password');
    await expect(loginUserDB('karri', 'wrongpassword')).rejects.toThrow('Invalid email or password');
  });
});

