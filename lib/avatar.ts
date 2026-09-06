// Centralized Avatar & User Appearance Utility for Teader
// Handles:
// 1. Session-based random profile image assignment from /profiles/profile-[1-55].webp
// 2. User-specific distinctive color palette hashing
// 3. User first-letter initials extraction

export const TOTAL_PROFILE_IMAGES = 55;

export interface UserColorPalette {
  name: string;
  bg: string;
  text: string;
  border: string;
  solidBg: string;
  solidText: string;
}

// 16 high-contrast, visually distinct palettes so different users stand out distinctly
export const USER_PALETTES: UserColorPalette[] = [
  {
    name: 'purple',
    bg: 'bg-purple-500/15',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
    solidBg: 'bg-purple-600',
    solidText: 'text-white',
  },
  {
    name: 'emerald',
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    solidBg: 'bg-emerald-600',
    solidText: 'text-white',
  },
  {
    name: 'blue',
    bg: 'bg-blue-500/15',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    solidBg: 'bg-blue-600',
    solidText: 'text-white',
  },
  {
    name: 'amber',
    bg: 'bg-amber-500/15',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    solidBg: 'bg-amber-500',
    solidText: 'text-[#0B0C0E]',
  },
  {
    name: 'pink',
    bg: 'bg-pink-500/15',
    text: 'text-pink-400',
    border: 'border-pink-500/30',
    solidBg: 'bg-pink-600',
    solidText: 'text-white',
  },
  {
    name: 'cyan',
    bg: 'bg-cyan-500/15',
    text: 'text-cyan-400',
    border: 'border-cyan-500/30',
    solidBg: 'bg-cyan-600',
    solidText: 'text-white',
  },
  {
    name: 'rose',
    bg: 'bg-rose-500/15',
    text: 'text-rose-400',
    border: 'border-rose-500/30',
    solidBg: 'bg-rose-600',
    solidText: 'text-white',
  },
  {
    name: 'orange',
    bg: 'bg-orange-500/15',
    text: 'text-orange-400',
    border: 'border-orange-500/30',
    solidBg: 'bg-orange-500',
    solidText: 'text-[#0B0C0E]',
  },
  {
    name: 'indigo',
    bg: 'bg-indigo-500/15',
    text: 'text-indigo-400',
    border: 'border-indigo-500/30',
    solidBg: 'bg-indigo-600',
    solidText: 'text-white',
  },
  {
    name: 'teal',
    bg: 'bg-teal-500/15',
    text: 'text-teal-400',
    border: 'border-teal-500/30',
    solidBg: 'bg-teal-600',
    solidText: 'text-white',
  },
  {
    name: 'violet',
    bg: 'bg-violet-500/15',
    text: 'text-violet-400',
    border: 'border-violet-500/30',
    solidBg: 'bg-violet-600',
    solidText: 'text-white',
  },
  {
    name: 'fuchsia',
    bg: 'bg-fuchsia-500/15',
    text: 'text-fuchsia-400',
    border: 'border-fuchsia-500/30',
    solidBg: 'bg-fuchsia-600',
    solidText: 'text-white',
  },
  {
    name: 'lime',
    bg: 'bg-lime-500/15',
    text: 'text-lime-400',
    border: 'border-lime-500/30',
    solidBg: 'bg-lime-500',
    solidText: 'text-[#0B0C0E]',
  },
  {
    name: 'sky',
    bg: 'bg-sky-500/15',
    text: 'text-sky-400',
    border: 'border-sky-500/30',
    solidBg: 'bg-sky-500',
    solidText: 'text-[#0B0C0E]',
  },
  {
    name: 'red',
    bg: 'bg-red-500/15',
    text: 'text-red-400',
    border: 'border-red-500/30',
    solidBg: 'bg-red-600',
    solidText: 'text-white',
  },
  {
    name: 'yellow',
    bg: 'bg-yellow-500/15',
    text: 'text-yellow-400',
    border: 'border-yellow-500/30',
    solidBg: 'bg-yellow-400',
    solidText: 'text-[#0B0C0E]',
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
 * Extracts strictly the first letter of the user's name (e.g. "J" for "jori").
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

// Memory fallback seed when sessionStorage is unavailable (e.g. SSR)
let memorySeed: number | null = null;

/**
 * Gets or initializes a random session seed so profile images change randomly
 * when users open the app in a new session.
 */
export function getAvatarSessionSeed(): number {
  if (typeof window !== 'undefined') {
    try {
      const stored = window.sessionStorage.getItem('teader_avatar_seed');
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
      const newSeed = Math.floor(Math.random() * 1000000) + 1;
      window.sessionStorage.setItem('teader_avatar_seed', String(newSeed));
      return newSeed;
    } catch {
      // Ignore sessionStorage errors (e.g. private mode)
    }
  }

  if (memorySeed === null) {
    memorySeed = Math.floor(Math.random() * 1000000) + 1;
  }
  return memorySeed;
}

/**
 * Returns a randomized profile image path from /profiles/profile-1.webp .. profile-55.webp
 * for the given user, based on the current app session.
 */
export function getRandomProfileImage(userIdentifier?: string | number | null): string {
  const seed = getAvatarSessionSeed();
  const idStr = String(userIdentifier || 'user');
  const userHash = hashString(idStr);
  const combined = Math.abs((userHash ^ (seed * 2654435761)) | 0);
  const profileIndex = (combined % TOTAL_PROFILE_IMAGES) + 1;
  return `/profiles/profile-${profileIndex}.webp`;
}

/**
 * Resolves the profile avatar image URL for a user.
 * If user has an explicit local profile image or custom avatar (not Unsplash/Dicebear default),
 * uses it. Otherwise, assigns a session-randomized profile image from /profiles/.
 */
export function resolveUserAvatar(
  user?: { id?: string | number; name?: string; email?: string; avatar?: string } | null
): string {
  if (!user) return getRandomProfileImage('anonymous');

  // If user has a valid custom non-placeholder avatar
  if (
    user.avatar &&
    !user.avatar.includes('images.unsplash.com') &&
    !user.avatar.includes('api.dicebear.com') &&
    user.avatar.trim() !== ''
  ) {
    return user.avatar;
  }

  const idKey = user.id != null ? String(user.id) : (user.name || user.email || 'user');
  return getRandomProfileImage(idKey);
}
