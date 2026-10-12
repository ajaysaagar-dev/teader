import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import allowlist from './mono-allowlist.json';

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

describe('Monochrome UI Guard', () => {
  const dirs = ['app', 'components', 'lib'];
  const allFiles: string[] = [];
  for (const d of dirs) {
    const full = path.resolve(process.cwd(), d);
    if (fs.existsSync(full)) {
      allFiles.push(...walk(full));
    }
  }

  const hexRegex = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;
  const tailwindRegex = /\b(bg|text|border|ring|stroke|fill)-(yellow|amber|red|rose|orange|green|emerald|lime|blue|sky|cyan|indigo|violet|purple|fuchsia|pink)-[0-9]{2,3}(\/[0-9]+)?\b/g;

  it('contains zero non-monochrome hex codes', () => {
    const violations: string[] = [];
    const allowlisted = new Set((allowlist.allowlistedHexes || []).map((h: string) => h.toUpperCase()));

    for (const file of allFiles) {
      const rel = path.relative(process.cwd(), file).replace(/\\/g, '/');
      if (((allowlist.allowlistFiles || []) as string[]).includes(rel)) continue;

      const content = fs.readFileSync(file, 'utf8');
      let m: RegExpExecArray | null;
      while ((m = hexRegex.exec(content)) !== null) {
        const hex = m[0].toUpperCase();
        if (allowlisted.has(hex)) continue;

        let r: string, g: string, b: string;
        if (hex.length === 4) {
          r = hex[1] + hex[1];
          g = hex[2] + hex[2];
          b = hex[3] + hex[3];
        } else {
          r = hex.slice(1, 3);
          g = hex.slice(3, 5);
          b = hex.slice(5, 7);
        }

        if (r !== g || g !== b) {
          violations.push(`${rel}: ${hex}`);
        }
      }
    }

    expect(violations, `Found ${violations.length} non-monochrome hex values`).toEqual([]);
  });

  it('contains zero colored Tailwind utility classes', () => {
    const violations: string[] = [];

    for (const file of allFiles) {
      const rel = path.relative(process.cwd(), file).replace(/\\/g, '/');
      if (((allowlist.allowlistFiles || []) as string[]).includes(rel)) continue;

      const content = fs.readFileSync(file, 'utf8');
      let m: RegExpExecArray | null;
      while ((m = tailwindRegex.exec(content)) !== null) {
        violations.push(`${rel}: ${m[0]}`);
      }
    }

    expect(violations, `Found ${violations.length} Tailwind color classes`).toEqual([]);
  });
});
