import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Source-file tests that verify light-mode readability.
 * Reads CSS and glass.ts source to ensure dark-only colors have light-mode alternatives.
 */

const indexCss = readFileSync(resolve(__dirname, '../index.css'), 'utf-8');
const glassTs = readFileSync(resolve(__dirname, '../lib/styles/glass.ts'), 'utf-8');

describe('Light mode contrast', () => {
  describe('index.css utility classes have dark-mode overrides', () => {
    it('.neu-inset has a .dark override', () => {
      expect(indexCss).toContain('.dark .neu-inset');
    });

    it('.neu-card has a .dark override', () => {
      expect(indexCss).toContain('.dark .neu-card');
    });

    it('.tab-embossed active has a .dark override', () => {
      expect(indexCss).toMatch(/\.dark\s+\.tab-embossed/);
    });

    it('.gauge-badge has a .dark override', () => {
      expect(indexCss).toContain('.dark .gauge-badge');
    });
  });

  describe('glass.ts uses dark: variants', () => {
    it('input classes include dark: variants', () => {
      // Should not have bare bg-white/5 without dark: prefix
      const inputLine = glassTs.match(/input:\s*'([^']+)'/)?.[1] ?? '';
      expect(inputLine).toContain('dark:bg-white/5');
      expect(inputLine).toContain('dark:border-white/10');
      expect(inputLine).toContain('var(--surface-control)');
      expect(inputLine).toContain('var(--focus-ring)');
    });

    it('button.secondary includes dark: variants', () => {
      const secondaryLine = glassTs.match(/secondary:\s*'([^']+)'/)?.[1] ?? '';
      expect(secondaryLine).toContain('dark:bg-gray-900/80');
      expect(secondaryLine).toContain('dark:text-white');
      expect(secondaryLine).toContain('var(--surface-control)');
    });

    it('badge.neutral includes dark: variants', () => {
      const neutralLine = glassTs.match(/neutral:\s*'([^']+)'/)?.[1] ?? '';
      expect(neutralLine).toContain('dark:text-gray-300');
      expect(neutralLine).toContain('dark:bg-white/10');
    });

    it('no bare bg-white/5 without light-mode alternative', () => {
      // Find all bg-white/5 occurrences that are NOT prefixed with dark: or dark:hover: etc.
      // Use regex to find standalone bg-white/5 (not preceded by dark: variant prefix)
      const lines = glassTs.split('\n');
      for (const line of lines) {
        if (line.includes('//')) continue;
        // Match bg-white/5 that is NOT preceded by "dark:" (with optional hover:/focus: etc.)
        const matches = line.match(/(?<!\bdark:[\w-:]*)\bbg-white\/5\b/g);
        if (matches && matches.length > 0) {
          // There's a bare bg-white/5 — the same line must also have dark:bg-white/5 or dark:*:bg-white/5
          expect(line).toMatch(/dark:[\w-:]*bg-white\/5/);
        }
      }
    });
  });
});
