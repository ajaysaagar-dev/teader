import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function walk(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next' && file !== '.git') {
        results = results.concat(walk(full));
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(full);
    }
  }
  return results;
}

const THEME_ACCENT_HEXES = new Set([
  '#BB86FC', '#CCA5FD', '#D4B2FF',
  '#8400FF', '#FF0051', '#B800D8', '#A824FF', '#FF2D73'
]);

function isMonochromeHex(hex: string): boolean {
  if (THEME_ACCENT_HEXES.has(hex.toUpperCase())) return true;
  let clean = hex.replace(/^#/, '');
  if (clean.length === 3 || clean.length === 4) {
    clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
  } else if (clean.length >= 6) {
    clean = clean.slice(0, 6);
  } else {
    return false;
  }
  const r = clean.slice(0, 2);
  const g = clean.slice(2, 4);
  const b = clean.slice(4, 6);
  return r.toUpperCase() === g.toUpperCase() && g.toUpperCase() === b.toUpperCase();
}

function isMonochromeRgb(rgbStr: string): boolean {
  const m = rgbStr.match(/rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)/i);
  if (!m) return true;
  const r = Math.round(parseFloat(m[1]));
  const g = Math.round(parseFloat(m[2]));
  const b = Math.round(parseFloat(m[3]));
  if (r === 187 && g === 134 && b === 252) return true;
  if (r === 132 && g === 0 && b === 255) return true; // #8400FF (Logo Violet)
  if (r === 255 && g === 0 && b === 81) return true;  // #FF0051 (Logo Pink)
  if (r === 184 && g === 0 && b === 216) return true; // #B800D8
  if (r === 168 && g === 36 && b === 255) return true; // #A824FF
  if (r === 255 && g === 45 && b === 115) return true; // #FF2D73
  if (r === 204 && g === 165 && b === 253) return true; // #CCA5FD
  return r === g && g === b;
}

function isMonochromeHsl(hslStr: string): boolean {
  const m = hslStr.match(/hsla?\(\s*([0-9.]+)\s*,\s*([0-9.]+)%?\s*,\s*([0-9.]+)%?/i);
  if (!m) return true;
  const s = parseFloat(m[2]);
  return s === 0;
}

describe('Monochrome UI Guard', () => {
  const dirs = ['app', 'components'];
  const allFiles: string[] = [];
  for (const d of dirs) {
    const full = path.resolve(process.cwd(), d);
    if (fs.existsSync(full)) {
      allFiles.push(...walk(full));
    }
  }

  // 1. Hex codes check
  const hexRegex = /#([0-9a-fA-F]{3,8})\b/g;

  it('contains zero non-monochrome hex codes in UI', () => {
    const violations: string[] = [];

    for (const file of allFiles) {
      const rel = path.relative(process.cwd(), file).replace(/\\/g, '/');
      const content = fs.readFileSync(file, 'utf8');
      let m: RegExpExecArray | null;
      while ((m = hexRegex.exec(content)) !== null) {
        const hex = m[0];
        if (!isMonochromeHex(hex)) {
          violations.push(`${rel}: ${hex}`);
        }
      }
    }

    expect(violations, `Found ${violations.length} non-monochrome hex values in UI components`).toEqual([]);
  });

  // 2. Tailwind standard color utility classes
  const tailwindColorRegex = /\b(?:bg|text|border|ring|stroke|fill|from|to|via)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}(?:\/[0-9]+)?\b/g;

  it('contains zero standard Tailwind color utility classes', () => {
    const violations: string[] = [];

    for (const file of allFiles) {
      const rel = path.relative(process.cwd(), file).replace(/\\/g, '/');
      const content = fs.readFileSync(file, 'utf8');
      let m: RegExpExecArray | null;
      while ((m = tailwindColorRegex.exec(content)) !== null) {
        violations.push(`${rel}: ${m[0]}`);
      }
    }

    expect(violations, `Found ${violations.length} Tailwind color utility classes`).toEqual([]);
  });

  // 3. Arbitrary Tailwind color values (bg-[#...], text-[rgb(...)], hsl(), etc.)
  const arbitraryColorRegex = /\b(?:bg|text|border|ring|stroke|fill|from|to|via)-\[(#[0-9a-fA-F]+|rgba?\([^\]]+\)|hsla?\([^\]]+\))\]/g;

  it('catches arbitrary Tailwind color values (bg-[#...], text-[rgb(...)], hsl())', () => {
    const violations: string[] = [];

    for (const file of allFiles) {
      const rel = path.relative(process.cwd(), file).replace(/\\/g, '/');
      const content = fs.readFileSync(file, 'utf8');
      let m: RegExpExecArray | null;
      while ((m = arbitraryColorRegex.exec(content)) !== null) {
        const fullMatch = m[0];
        const inner = m[1];
        if (inner.startsWith('#')) {
          if (!isMonochromeHex(inner)) violations.push(`${rel}: ${fullMatch}`);
        } else if (inner.toLowerCase().startsWith('rgb')) {
          if (!isMonochromeRgb(inner)) violations.push(`${rel}: ${fullMatch}`);
        } else if (inner.toLowerCase().startsWith('hsl')) {
          if (!isMonochromeHsl(inner)) violations.push(`${rel}: ${fullMatch}`);
        }
      }
    }

    expect(violations, `Found ${violations.length} non-monochrome arbitrary Tailwind values`).toEqual([]);
  });

  // 4. Inline style={{ ... }} colors
  const inlineStyleRegex = /style=\{\{[^}]*\b(color|backgroundColor|borderColor|fill|stroke)\s*:\s*['"`]([^'"`]+)['"`]/g;

  it('catches non-monochrome inline style colors', () => {
    const violations: string[] = [];

    for (const file of allFiles) {
      const rel = path.relative(process.cwd(), file).replace(/\\/g, '/');
      const content = fs.readFileSync(file, 'utf8');
      let m: RegExpExecArray | null;
      while ((m = inlineStyleRegex.exec(content)) !== null) {
        const prop = m[1];
        const val = m[2].trim();
        if (val.startsWith('#') && !isMonochromeHex(val)) {
          violations.push(`${rel}: inline ${prop}="${val}"`);
        } else if (val.toLowerCase().startsWith('rgb') && !isMonochromeRgb(val)) {
          violations.push(`${rel}: inline ${prop}="${val}"`);
        } else if (val.toLowerCase().startsWith('hsl') && !isMonochromeHsl(val)) {
          violations.push(`${rel}: inline ${prop}="${val}"`);
        }
      }
    }

    expect(violations, `Found ${violations.length} non-monochrome inline styles`).toEqual([]);
  });

  // 5. Gradients with non-monochrome stops
  const gradientStopsRegex = /\b(?:from|to|via)-(?:\[#([0-9a-fA-F]+)\]|\[(rgba?\([^\]]+\))\]|\[(hsla?\([^\]]+\))\])/g;

  it('catches non-monochrome gradient stops', () => {
    const violations: string[] = [];

    for (const file of allFiles) {
      const rel = path.relative(process.cwd(), file).replace(/\\/g, '/');
      const content = fs.readFileSync(file, 'utf8');
      let m: RegExpExecArray | null;
      while ((m = gradientStopsRegex.exec(content)) !== null) {
        const hex = m[1];
        const rgb = m[2];
        const hsl = m[3];
        if (hex && !isMonochromeHex('#' + hex)) violations.push(`${rel}: gradient ${m[0]}`);
        if (rgb && !isMonochromeRgb(rgb)) violations.push(`${rel}: gradient ${m[0]}`);
        if (hsl && !isMonochromeHsl(hsl)) violations.push(`${rel}: gradient ${m[0]}`);
      }
    }

    expect(violations, `Found ${violations.length} non-monochrome gradient stops`).toEqual([]);
  });
});
