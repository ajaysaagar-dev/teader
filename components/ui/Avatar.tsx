import React from 'react';
import { User } from '@/lib/types';

interface AvatarProps {
  user: User;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  user,
  size = 'md',
  className = '',
}) => {
  const sizeMap = {
    xs: 'w-4 h-4 text-[9px]',
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm',
  };

  return (
    <div className={`relative inline-block shrink-0 ${className}`}>
      {user.avatar ? (
        <img
          src={user.avatar}
          alt={user.name}
          className={`${sizeMap[size].split(' ')[0]} ${sizeMap[size].split(' ')[1]} rounded-full object-cover border border-[#3B3D41]`}
        />
      ) : (
        <div
          className={`${sizeMap[size]} rounded-full flex items-center justify-center font-semibold bg-[#222427] text-[#CFD4DD] border border-[#3B3D41]`}
        >
          {user.name.slice(0, 2).toUpperCase()}
        </div>
      )}
    </div>
  );
};
