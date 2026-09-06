'use client';

import React, { useState } from 'react';
import { User } from '@/lib/types';
import {
  getUserInitial,
  getUserColorPalette,
  resolveUserAvatar,
  UserColorPalette,
  USER_PALETTES,
} from '@/lib/avatar';

export { getUserInitial, getUserColorPalette, resolveUserAvatar, USER_PALETTES };
export type { UserColorPalette };

export interface AvatarProps {
  user?: User | { id?: string | number; name?: string; avatar?: string; email?: string; role?: string } | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showLetterOnly?: boolean;
  solidLetter?: boolean;
}

export const Avatar: React.FC<AvatarProps> = React.memo(({
  user,
  size = 'md',
  className = '',
  showLetterOnly = false,
  solidLetter = false,
}) => {
  const [imgError, setImgError] = useState(false);
  const name = user?.name || 'User';
  const initial = getUserInitial(user);
  const palette = getUserColorPalette(user);

  const sizeMap = {
    xs: 'w-4 h-4 text-[9px]',
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm',
    xl: 'w-12 h-12 text-base font-semibold',
  };

  const roundedClass = className.includes('rounded-') ? '' : 'rounded-full';
  const resolvedUrl = !showLetterOnly && !imgError ? resolveUserAvatar(user) : undefined;

  return (
    <div
      role="img"
      aria-label={`${name}'s avatar`}
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${className}`}
    >
      {resolvedUrl ? (
        <img
          src={resolvedUrl}
          alt={name}
          onError={() => setImgError(true)}
          className={`${sizeMap[size].split(' ')[0]} ${sizeMap[size].split(' ')[1]} ${roundedClass} object-cover border border-[var(--border-primary)] shadow-sm`}
        />
      ) : (
        <div
          className={`${sizeMap[size]} ${roundedClass} flex items-center justify-center font-bold font-mono border ${
            solidLetter
              ? `${palette.solidBg} ${palette.solidText} border-transparent shadow-sm`
              : `${palette.bg} ${palette.text} ${palette.border}`
          }`}
        >
          {initial}
        </div>
      )}
    </div>
  );
});

Avatar.displayName = 'Avatar';
