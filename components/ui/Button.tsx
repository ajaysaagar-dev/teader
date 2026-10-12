'use client';

import React, { forwardRef } from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'sm', className = '', children, ...props }, ref) => {
    const baseClasses =
      'inline-flex items-center justify-center font-medium transition-colors select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white disabled:pointer-events-none disabled:opacity-50';

    const sizeClasses = {
      xs: 'h-6 px-2 text-xs rounded-md gap-1',
      sm: 'h-8 px-3 text-xs rounded-md gap-1.5',
      md: 'h-9 px-4 text-sm rounded-md gap-2',
      lg: 'h-10 px-5 text-sm rounded-md gap-2.5',
    }[size];

    const variantClasses = {
      primary: 'bg-white text-black hover:bg-[#E5E5E5] active:bg-[#D4D4D4] shadow-sm',
      secondary:
        'bg-transparent text-[var(--text-primary)] border border-[var(--border-primary)] hover:bg-[var(--bg-hover)] hover:border-[var(--border-secondary)] active:bg-[var(--bg-active)]',
      ghost:
        'bg-transparent text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)] active:bg-[var(--bg-active)]',
    }[variant];

    return (
      <button
        ref={ref}
        className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
