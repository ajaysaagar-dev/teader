/**
 * One-time cleanup for legacy theme customization storage keys and inline style overrides.
 * Removes user custom theme variables, preset selections, and unneeded density keys,
 * while strictly preserving UI scale properties (--ui-scale, --ui-scale-percent, zoom).
 */
export function cleanupLegacyTheme(
  storage?: Storage | null,
  rootStyle?: CSSStyleDeclaration | null
): void {
  try {
    const s = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (s) {
      s.removeItem('teader_custom_theme_vars');
      s.removeItem('teader_active_preset_id');
      s.removeItem('teader_ui_density');
      s.removeItem('teader_accent_color');
    }

    const style =
      rootStyle ??
      (typeof document !== 'undefined' && document.documentElement
        ? document.documentElement.style
        : null);

    if (style) {
      const preserved = new Set(['zoom', '--ui-scale', '--ui-scale-percent']);
      const toRemove: string[] = [];
      for (let i = 0; i < style.length; i++) {
        const prop = style[i];
        if (prop && !preserved.has(prop)) {
          toRemove.push(prop);
        }
      }
      toRemove.forEach((p) => style.removeProperty(p));
    }
  } catch {}
}
