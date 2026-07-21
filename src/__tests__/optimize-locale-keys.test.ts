import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import arOptimize from '@/locales/ar/sections/optimize.json';
import enOptimize from '@/locales/en/sections/optimize.json';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('OptimizeSection locale lookups', () => {
  it('uses the locale namespace that contains the Arabic Unapply All copy', () => {
    expect(arOptimize.sections.optimize.results.unapplyAll).toContain('التراجع');
    expect(enOptimize.sections.optimize.results.unapplyAll).toBe('Unapply All ({{count}} applied)');

    const source = readFileSync(join(root, 'components', 'sections', 'OptimizeSection.tsx'), 'utf8');
    expect(source).toContain("sections.optimize.results.unapplyAll");
  });
});
