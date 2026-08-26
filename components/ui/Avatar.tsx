'use client';

import React, { useState } from 'react';
import { User } from '@/lib/types';

interface AvatarProps {
  user?: User | { id?: string | number; name?: string; avatar?: string; email?: string };
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

// GitHub-tier deterministic gradient palettes for avatars
const PALETTES = [
  { bg: 'bg-[#DCB001]/15 text-[#DCB001] border-[#DCB001]/30' },
  { bg: 'bg-[#3B82F6]/15 text-[#3B82F6] border-[#3B82F6]/30' },
  { bg: 'bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30' },
  { bg: 'bg-[#A855F7]/15 text-[#A855F7] border-[#A855F7]/30' },
  { bg: 'bg-[#EC4899]/15 text-[#EC4899] border-[#EC4899]/30' },
  { bg: 'bg-[#F97316]/15 text-[#F97316] border-[#F97316]/30' },
  { bg: 'bg-[#06B6D4]/15 text-[#06B6D4] border-[#06B6D4]/30' },
];

function getPalette(name: string = 'User') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PALETTES.length;
  return PALETTES[index];
}

export const Avatar: React.FC<AvatarProps> = React.memo(({
  user,
  size = 'md',
  className = '',
}) => {
  const [imgError, setImgError] = useState(false);
  const name = user?.name || 'User';
  const palette = getPalette(name);

  const sizeMap = {
    xs: 'w-4 h-4 text-[9px]',
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm',
    xl: 'w-12 h-12 text-base',
  };

  const initials = name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  const avatarUrl = !imgError ? user?.avatar : undefined;

  return (
    <div
      role="img"
      aria-label={`${name}'s avatar`}
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${className}`}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          onError={() => setImgError(true)}
          className={`${sizeMap[size].split(' ')[0]} ${sizeMap[size].split(' ')[1]} rounded-full object-cover border border-[#2A2C30]`}
        />
      ) : (
        <div
          className={`${sizeMap[size]} rounded-full flex items-center justify-center font-bold font-mono border ${palette.bg}`}
        >
          {initials}
        </div>
      )}
    </div>
  );
});

Avatar.displayName = 'Avatar';
