// Centralized Avatar & User Appearance Utility for Teader
// Handles:
// 1. Loading user's persistent profile image from database
// 2. Strict whitelist of available profile images (/profiles/profile-1.webp .. profile-55.webp)
// 3. User-specific distinctive color palette hashing
// 4. User first-letter initials extraction

export const TOTAL_PROFILE_IMAGES = 55;

export const ALL_PROFILE_IMAGES: string[] = Array.from(
  { length: TOTAL_PROFILE_IMAGES },
  (_, i) => `/profiles/profile-${i + 1}.webp`
);

export function isAllowedProfileImage(url?: string | null): boolean {
  if (!url) return false;
  return ALL_PROFILE_IMAGES.includes(url.trim());
}

export interface UserColorPalette {
  name: string;
  bg: string;
  text: string;
  border: string;
  solidBg: string;
  solidText: string;
}

// 16 distinct monochrome palettes for initials fallback avatars
export const USER_PALETTES: UserColorPalette[] = [
  {
    name: 'mono-1',
    bg: 'bg-neutral-800',
    text: 'text-neutral-200',
    border: 'border-neutral-700',
    solidBg: 'bg-neutral-800',
    solidText: 'text-white',
  },
  {
    name: 'mono-2',
    bg: 'bg-neutral-900',
    text: 'text-neutral-100',
    border: 'border-neutral-800',
    solidBg: 'bg-neutral-900',
    solidText: 'text-white',
  },
  {
    name: 'mono-3',
    bg: 'bg-neutral-700/70',
    text: 'text-white',
    border: 'border-neutral-600',
    solidBg: 'bg-neutral-700',
    solidText: 'text-white',
  },
  {
    name: 'mono-4',
    bg: 'bg-neutral-900/90',
    text: 'text-neutral-300',
    border: 'border-neutral-700',
    solidBg: 'bg-neutral-800',
    solidText: 'text-white',
  },
  {
    name: 'mono-5',
    bg: 'bg-neutral-800/90',
    text: 'text-neutral-200',
    border: 'border-neutral-600',
    solidBg: 'bg-neutral-700',
    solidText: 'text-white',
  },
  {
    name: 'mono-6',
    bg: 'bg-neutral-700/50',
    text: 'text-white',
    border: 'border-neutral-500',
    solidBg: 'bg-neutral-600',
    solidText: 'text-white',
  },
  {
    name: 'mono-7',
    bg: 'bg-neutral-950',
    text: 'text-neutral-200',
    border: 'border-neutral-800',
    solidBg: 'bg-neutral-900',
    solidText: 'text-white',
  },
  {
    name: 'mono-8',
    bg: 'bg-neutral-800',
    text: 'text-white',
    border: 'border-neutral-700',
    solidBg: 'bg-neutral-800',
    solidText: 'text-white',
  },
  {
    name: 'mono-9',
    bg: 'bg-neutral-700/60',
    text: 'text-neutral-100',
    border: 'border-neutral-600',
    solidBg: 'bg-neutral-700',
    solidText: 'text-white',
  },
  {
    name: 'mono-10',
    bg: 'bg-neutral-900/80',
    text: 'text-white',
    border: 'border-neutral-700',
    solidBg: 'bg-neutral-800',
    solidText: 'text-white',
  },
  {
    name: 'mono-11',
    bg: 'bg-neutral-800/80',
    text: 'text-neutral-300',
    border: 'border-neutral-700',
    solidBg: 'bg-neutral-800',
    solidText: 'text-white',
  },
  {
    name: 'mono-12',
    bg: 'bg-neutral-700/80',
    text: 'text-neutral-100',
    border: 'border-neutral-600',
    solidBg: 'bg-neutral-700',
    solidText: 'text-white',
  },
  {
    name: 'mono-13',
    bg: 'bg-neutral-950/90',
    text: 'text-white',
    border: 'border-neutral-700',
    solidBg: 'bg-neutral-900',
    solidText: 'text-white',
  },
  {
    name: 'mono-14',
    bg: 'bg-neutral-900',
    text: 'text-neutral-300',
    border: 'border-neutral-800',
    solidBg: 'bg-neutral-900',
    solidText: 'text-white',
  },
  {
    name: 'mono-15',
    bg: 'bg-neutral-800',
    text: 'text-neutral-100',
    border: 'border-neutral-700',
    solidBg: 'bg-neutral-700',
    solidText: 'text-white',
  },
  {
    name: 'mono-16',
    bg: 'bg-neutral-700',
    text: 'text-white',
    border: 'border-neutral-500',
    solidBg: 'bg-neutral-600',
    solidText: 'text-white',
  },
];

export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Extracts strictly the first letter of the user's name in uppercase (e.g. "J" for "jori").
 */
export function getUserInitial(
  user?: { name?: string; email?: string } | string | null
): string {
  if (!user) return 'U';
  const name = typeof user === 'string' ? user : (user.name || user.email || 'U');
  const trimmed = name.trim();
  if (!trimmed) return 'U';
  return trimmed.charAt(0).toUpperCase();
}

/**
 * Deterministically returns a vibrant color palette keyed by user ID or name,
 * ensuring different users receive different colors.
 */
export function getUserColorPalette(
  user?: { id?: string | number; name?: string; email?: string } | string | null
): UserColorPalette {
  if (!user) return USER_PALETTES[0];
  const key =
    typeof user === 'string'
      ? user
      : String(user.id != null ? `usr_${user.id}` : (user.name || user.email || 'user'));

  const hash = hashString(key);
  const index = hash % USER_PALETTES.length;
  return USER_PALETTES[index];
}

/**
 * Returns a stable fallback profile image (/profiles/profile-1.webp .. profile-55.webp)
 * for the given user, based on user identifier. Does NOT change across sessions.
 */
export function getFallbackProfileImage(userIdentifier?: string | number | null): string {
  const idStr = String(userIdentifier || 'user');
  const userHash = hashString(idStr);
  const profileIndex = (userHash % TOTAL_PROFILE_IMAGES) + 1;
  return `/profiles/profile-${profileIndex}.webp`;
}

export const getRandomProfileImage = getFallbackProfileImage;

/**
 * Resolves the profile avatar image URL for a user.
 * 1. If user has their respective set profile image (e.g. /profiles/profile-X.webp or uploaded URL), uses it.
 * 2. If not set, returns a deterministic profile image from /profiles/ so it stays stable.
 */
export function resolveUserAvatar(
  user?: { id?: string | number; name?: string; email?: string; avatar?: string } | null
): string {
  if (!user) return '/profiles/profile-1.webp';

  // If user has a valid set avatar that is not an obsolete placeholder
  if (
    user.avatar &&
    user.avatar.trim() !== '' &&
    !user.avatar.includes('images.unsplash.com') &&
    !user.avatar.includes('api.dicebear.com')
  ) {
    return user.avatar;
  }

  const idKey = user.id != null ? String(user.id) : (user.name || user.email || 'user');
  return getFallbackProfileImage(idKey);
}
