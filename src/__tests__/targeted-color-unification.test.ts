import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

const sourcePath = (path: string) => resolve(__dirname, path);
const readSource = (path: string) => readFileSync(sourcePath(path), 'utf-8');

const categoryColorsPath = sourcePath('../lib/styles/categoryColors.ts');
const scoreHeaderSource = readSource('../components/sections/optimize/ScoreHeader.tsx');
const scoreBreakdownSource = readSource('../components/ScoreBreakdown.tsx');
const matchSectionSource = readSource('../components/sections/MatchSection.tsx');
const strategyBlockSource = readSource('../components/sections/optimize/StrategyBlock.tsx');
const optimizeSectionSource = readSource('../components/sections/OptimizeSection.tsx');
const summarySource = readSource('../components/sections/OptimizationResultsSummary.tsx');
const uploadCardSource = readSource('../components/ui/UploadCard.tsx');
const glassSource = readSource('../lib/styles/glass.ts');
const parsingBannerSource = readSource('../components/ui/ParsingWarningsBanner.tsx');

describe('targeted green and teal color unification', () => {
  it('uses one typed category color map with a teal hard-skills family', () => {
    expect(existsSync(categoryColorsPath)).toBe(true);

    if (!existsSync(categoryColorsPath)) return;
    const categoryColorsSource = readFileSync(categoryColorsPath, 'utf-8');

    expect(categoryColorsSource).toContain('export const CATEGORY_COLORS');
    expect(categoryColorsSource).toContain('satisfies Record<CategoryColorKey, CategoryColorClasses>');
    expect(categoryColorsSource).toContain("hard_skills: {");
    expect(categoryColorsSource).toContain("textClass: 'text-teal-700 dark:text-teal-300'");
    expect(categoryColorsSource).not.toMatch(/hard_skills:[\s\S]*?blue-/);

    for (const source of [scoreHeaderSource, scoreBreakdownSource, matchSectionSource]) {
      expect(source).toContain("import { CATEGORY_COLORS");
    }
    expect(scoreHeaderSource).not.toContain('const categoryConfig =');
    expect(scoreBreakdownSource).not.toContain('const CATEGORY_CONFIG =');
    expect(matchSectionSource).not.toContain("color: 'bg-blue-500'");
  });

  it('converts only the named point-use blue families', () => {
    expect(strategyBlockSource).toContain('text-teal-700 dark:text-teal-300');
    expect(strategyBlockSource).toContain('bg-teal-50 dark:bg-teal-500/10');

    expect(optimizeSectionSource).toContain('bg-emerald-500/10');
    expect(optimizeSectionSource).toContain('text-emerald-700 dark:text-emerald-300');

    expect(summarySource).toContain('from-emerald-500/10 via-teal-500/5 to-transparent');
    expect(summarySource).toContain('from-teal-500/10 to-transparent');
    expect(summarySource).toContain('from-emerald-500/20 to-teal-500/20');

    expect(uploadCardSource).toContain('border-emerald-600/25 bg-emerald-50/92');
    expect(uploadCardSource).toContain('text-emerald-700 dark:text-emerald-100');
    expect(uploadCardSource).not.toContain('border-blue-600/25 bg-blue-50/92');

    expect(glassSource).toContain("info: 'bg-teal-500/20 text-teal-800 dark:text-teal-300 border border-teal-500/30'");
    expect(parsingBannerSource).toContain('bg-teal-50 border-teal-200 text-teal-900 dark:bg-teal-500/10 dark:border-teal-500/20 dark:text-teal-100');

    expect(matchSectionSource).toContain('bg-emerald-500/20 opacity-60 blur-3xl');
    expect(matchSectionSource).toContain('group-hover:text-emerald-700 dark:group-hover:text-emerald-300');
  });

  it('preserves the explicitly protected Vision 2030 blue identity', () => {
    expect(summarySource).toContain('from-emerald-500/10 via-transparent to-blue-500/5');
  });
});
