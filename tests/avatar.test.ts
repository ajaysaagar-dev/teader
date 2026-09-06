import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  getUserInitial,
  getUserColorPalette,
  getRandomProfileImage,
  resolveUserAvatar,
  TOTAL_PROFILE_IMAGES,
  USER_PALETTES,
} from '@/lib/avatar';

describe('Avatar & User Appearance Logic Tests', () => {
  it('extracts strictly the first letter of user name in uppercase', () => {
    expect(getUserInitial({ name: 'jori' })).toBe('J');
    expect(getUserInitial({ name: 'karri' })).toBe('K');
    expect(getUserInitial({ name: 'ajaysaagar' })).toBe('A');
    expect(getUserInitial({ name: 'Elena Rostova' })).toBe('E');
    expect(getUserInitial({ name: 'david' })).toBe('D');
    expect(getUserInitial('alexander')).toBe('A');
    expect(getUserInitial({ email: 'support@teader.io' })).toBe('S');
    expect(getUserInitial(null)).toBe('U');
    expect(getUserInitial(undefined)).toBe('U');
    expect(getUserInitial({ name: '' })).toBe('U');
    expect(getUserInitial({ name: '   ' })).toBe('U');
  });

  it('provides distinct, deterministic color palettes for different users', () => {
    const user1Color = getUserColorPalette({ id: 1, name: 'karri' });
    const user2Color = getUserColorPalette({ id: 2, name: 'jori' });
    const user3Color = getUserColorPalette({ id: 3, name: 'ajaysaagar' });

    expect(user1Color).toBeDefined();
    expect(user2Color).toBeDefined();
    expect(user3Color).toBeDefined();

    // Palettes contain high-contrast styling tokens
    expect(user1Color.bg).toContain('bg-');
    expect(user1Color.text).toContain('text-');
    expect(user1Color.border).toContain('border-');
    expect(user1Color.solidBg).toContain('bg-');

    // Deterministic: same user always gets the exact same palette
    const user1Again = getUserColorPalette({ id: 1, name: 'karri' });
    expect(user1Again.name).toBe(user1Color.name);

    // Color distribution across different users
    const names = ['karri', 'jori', 'ajaysaagar', 'elena', 'david', 'sarah', 'alex', 'marcus'];
    const assignedPaletteNames = new Set(names.map((n, i) => getUserColorPalette({ id: i + 1, name: n }).name));
    // Multiple distinct colors should be assigned across this sample
    expect(assignedPaletteNames.size).toBeGreaterThanOrEqual(4);
  });

  it('assigns profile images within the 1-55 range from /profiles/', () => {
    for (let i = 1; i <= 20; i++) {
      const img = getRandomProfileImage(`user_${i}`);
      expect(img).toMatch(/^\/profiles\/profile-\d+\.webp$/);
      const match = img.match(/profile-(\d+)\.webp$/);
      expect(match).not.toBeNull();
      const num = parseInt(match![1], 10);
      expect(num).toBeGreaterThanOrEqual(1);
      expect(num).toBeLessThanOrEqual(TOTAL_PROFILE_IMAGES);
    }
  });

  it('resolves user avatars to /profiles/ when no custom avatar is present', () => {
    const resolvedEmpty = resolveUserAvatar({ id: 1, name: 'karri', avatar: '' });
    expect(resolvedEmpty).toMatch(/^\/profiles\/profile-\d+\.webp$/);

    const resolvedUndefined = resolveUserAvatar({ id: 2, name: 'jori' });
    expect(resolvedUndefined).toMatch(/^\/profiles\/profile-\d+\.webp$/);

    // Replaces obsolete external Unsplash mock URLs
    const resolvedUnsplash = resolveUserAvatar({
      id: 3,
      name: 'ajaysaagar',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    });
    expect(resolvedUnsplash).toMatch(/^\/profiles\/profile-\d+\.webp$/);

    // Preserves explicit valid custom avatar uploads
    const customAvatar = '/uploads/my-custom-photo.png';
    const resolvedCustom = resolveUserAvatar({ id: 4, name: 'elena', avatar: customAvatar });
    expect(resolvedCustom).toBe(customAvatar);
  });

  it('verifies all 55 cropped 1:1 profile webp images exist in public/profiles/', () => {
    const profilesDir = path.resolve(process.cwd(), 'public', 'profiles');
    expect(fs.existsSync(profilesDir)).toBe(true);

    const files = fs.readdirSync(profilesDir);
    expect(files.length).toBe(55);

    // Verify all 55 profile-1.webp to profile-55.webp exist
    for (let i = 1; i <= 55; i++) {
      const expectedFile = `profile-${i}.webp`;
      expect(files).toContain(expectedFile);
    }

    // Verify old uncropped files are gone
    const oldFiles = files.filter((f) => f.startsWith('728px-Funniest-Cartoon-Characters'));
    expect(oldFiles.length).toBe(0);
  });

  it('enforces strict whitelist for the 55 profile portraits via isAllowedProfileImage', async () => {
    const { isAllowedProfileImage, ALL_PROFILE_IMAGES } = await import('@/lib/avatar');

    expect(ALL_PROFILE_IMAGES.length).toBe(55);

    // All 55 profile portraits must be strictly allowed
    for (const img of ALL_PROFILE_IMAGES) {
      expect(isAllowedProfileImage(img)).toBe(true);
    }

    // Arbitrary external URLs or invalid filenames must be strictly rejected
    expect(isAllowedProfileImage('https://evil.com/hack.png')).toBe(false);
    expect(isAllowedProfileImage('/profiles/profile-56.webp')).toBe(false);
    expect(isAllowedProfileImage('/profiles/profile-0.webp')).toBe(false);
    expect(isAllowedProfileImage('/uploads/avatar.png')).toBe(false);
    expect(isAllowedProfileImage('')).toBe(false);
    expect(isAllowedProfileImage(null)).toBe(false);
    expect(isAllowedProfileImage(undefined)).toBe(false);
  });

  it('ensures avatars do not change randomly on reload for the same user', () => {
    const user = { id: 42, name: 'persistentUser' };
    const firstCall = resolveUserAvatar(user);
    const secondCall = resolveUserAvatar(user);
    const thirdCall = resolveUserAvatar(user);

    expect(firstCall).toBe(secondCall);
    expect(secondCall).toBe(thirdCall);
    expect(firstCall).toMatch(/^\/profiles\/profile-\d+\.webp$/);
  });
});
