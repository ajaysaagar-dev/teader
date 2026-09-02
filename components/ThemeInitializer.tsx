'use client';

import React, { useEffect } from 'react';
import { getSavedCustomTheme, applyThemeVariablesToDOM, THEME_STORAGE_KEY } from '@/lib/theme-manager';

/**
 * ThemeInitializer
 * Ensures custom :root CSS variables saved in localStorage are applied
 * instantly when the application loads on client side.
 */
export const ThemeInitializer: React.FC = () => {
  useEffect(() => {
    // Initial application of saved theme colors to :root
    const savedTheme = getSavedCustomTheme();
    if (Object.keys(savedTheme).length > 0) {
      applyThemeVariablesToDOM(savedTheme);
    }

    // Storage listener to synchronize theme changes across open tabs/windows
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY) {
        if (e.newValue) {
          try {
            const newTheme = JSON.parse(e.newValue);
            applyThemeVariablesToDOM(newTheme);
          } catch {}
        } else {
          // Cleared / Reset
          const root = document.documentElement;
          root.removeAttribute('style');
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return null;
};
