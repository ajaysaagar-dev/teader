'use client';

import { useEffect } from 'react';

export const UI_SCALE_KEY = 'teader_ui_scale';
export const DEFAULT_UI_SCALE = 1.0;

export function applyUIScale(scale: number) {
  if (typeof document === 'undefined') return;
  const clampedScale = Math.min(Math.max(scale, 0.7), 1.6);

  // Apply zoom to document.documentElement
  (document.documentElement.style as any).zoom = `${clampedScale}`;
  document.documentElement.style.setProperty('--ui-scale', `${clampedScale}`);
  document.documentElement.style.setProperty('--ui-scale-percent', `${Math.round(clampedScale * 100)}%`);

  // Ensure full height & alignment resilience across all scaling levels
  document.documentElement.style.height = '100%';
  document.documentElement.style.minHeight = '100%';
  document.documentElement.style.width = '100%';
  if (document.body) {
    document.body.style.height = '100%';
    document.body.style.minHeight = '100%';
    document.body.style.width = '100%';
  }

  try {
    localStorage.setItem(UI_SCALE_KEY, clampedScale.toString());
  } catch {}
}

export function resetUIScale() {
  applyUIScale(DEFAULT_UI_SCALE);
}

export function getSavedUIScale(): number {
  if (typeof window === 'undefined') return DEFAULT_UI_SCALE;
  try {
    const saved = localStorage.getItem(UI_SCALE_KEY);
    if (saved) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed >= 0.7 && parsed <= 1.6) {
        return parsed;
      }
    }
  } catch {}
  return DEFAULT_UI_SCALE;
}

export const UIScaleInitializer: React.FC = () => {
  useEffect(() => {
    const scale = getSavedUIScale();
    applyUIScale(scale);

    // Sync scaling across windows/tabs
    const handleStorage = (e: StorageEvent) => {
      if (e.key === UI_SCALE_KEY && e.newValue) {
        const parsed = parseFloat(e.newValue);
        if (!isNaN(parsed)) {
          applyUIScale(parsed);
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return null;
};
