'use client';

import { useEffect } from 'react';
import { cleanupLegacyTheme } from '@/lib/legacy-cleanup';

export function LegacyThemeCleanup() {
  useEffect(() => {
    cleanupLegacyTheme();

    const handleStorage = (e: StorageEvent) => {
      if (
        e.key === 'teader_custom_theme_vars' ||
        e.key === 'teader_active_preset_id' ||
        e.key === 'teader_ui_density' ||
        e.key === 'teader_accent_color'
      ) {
        cleanupLegacyTheme();
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return null;
}
