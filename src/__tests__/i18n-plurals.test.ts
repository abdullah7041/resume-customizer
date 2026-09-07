import { describe, expect, it } from 'vitest';
import i18next from 'i18next';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { validateI18n, splitPluralKey } from '../../scripts/i18n-validate-lib.mjs';

/**
 * i18next appends a CLDR plural category to the base key, and locales do not agree on
 * how many categories there are: English resolves `one` and `other`, Arabic resolves
 * all six. The validator used to demand an identical key set across locales, which
 * forced one of two bad outcomes — English carrying four forms it can never select,
 * or Arabic capped at English's two, losing its dual and its 3-10 form.
 *
 * Arabic was in fact capped: `itemCount` and `appliedCount` shipped with only
 * one/other, so i18next fell back to the "other" form and rendered "2 عناصر" (should
 * be عنصران) and "11 عناصر" (should be عنصرًا). The validator reported nothing.
 */

const deepMerge = (target: Record<string, unknown>, source: Record<string, unknown>) => {
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      target[key] = deepMerge((target[key] as Record<string, unknown>) ?? {}, value as Record<string, unknown>);
    } else {
      target[key] = value;
    }
  }
  return target;
};

const loadLocaleTree = (dir: string): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      deepMerge(out, loadLocaleTree(full));
    } else if (entry.endsWith('.json')) {
      deepMerge(out, JSON.parse(readFileSync(full, 'utf8')));
    }
  }
  return out;
};

const i18n = i18next.createInstance();
await i18n.init({
  lng: 'en',
  resources: {
    en: { translation: loadLocaleTree('src/locales/en') },
    ar: { translation: loadLocaleTree('src/locales/ar') },
  },
  interpolation: { escapeValue: false },
});

const render = async (lng: string, key: string, options: Record<string, unknown>) => {
  await i18n.changeLanguage(lng);
  return i18n.t(key, options) as string;
};

describe('splitPluralKey', () => {
  it('separates a CLDR suffix from its base', () => {
    expect(splitPluralKey('a.b.itemCount_one')).toEqual({ base: 'a.b.itemCount', form: 'one' });
    expect(splitPluralKey('a.b.itemCount_other')).toEqual({ base: 'a.b.itemCount', form: 'other' });
  });

  it('leaves a plain key alone', () => {
    expect(splitPluralKey('jobFeed.actions.saving')).toBeNull();
    // A trailing word that merely looks like a category must not be stripped.
    expect(splitPluralKey('sections.match.another')).toBeNull();
  });
});

describe('every locale carries the plural forms its own language needs', () => {
  it('reports no issues across the shipped locales', () => {
    const { issues } = validateI18n('src/locales/en', 'src/locales/ar');
    expect(issues).toEqual([]);
  });

  it('would flag an Arabic set capped at English two forms', () => {
    // The exact shape that shipped for months without complaint.
    const arCategories = new Intl.PluralRules('ar').resolvedOptions().pluralCategories;
    expect(arCategories).toEqual(expect.arrayContaining(['zero', 'two', 'few', 'many']));
    expect(new Intl.PluralRules('en').resolvedOptions().pluralCategories).toEqual(['one', 'other']);
  });
});

describe('the job-feed title-match sentence is grammatical at every count', () => {
  const opts = (count: number) => ({ count, matched: 1, role: 'Accountant', terms: 'accountant' });

  it('says "1 of 1 word", not "1 of 1 words", for a single-word target role', async () => {
    // Single-word roles — Accountant, Nurse, Developer — are common in this market,
    // so the plural-blind string was visibly wrong on real rows.
    expect(await render('en', 'jobFeed.why.titleMatch', opts(1))).toContain('1 of 1 word from');
    expect(await render('en', 'jobFeed.why.titleMatch', opts(1))).not.toContain('1 words');
  });

  it('pluralises normally above one', async () => {
    expect(await render('en', 'jobFeed.why.titleMatch', opts(3))).toContain('1 of 3 words');
  });

  it('uses the Arabic dual for two and the 11+ form above ten', async () => {
    expect(await render('ar', 'jobFeed.why.titleMatch', opts(2))).toContain('كلمتين');
    expect(await render('ar', 'jobFeed.why.titleMatch', opts(3))).toContain('كلمات');
    expect(await render('ar', 'jobFeed.why.titleMatch', opts(11))).toContain('كلمة');
  });

  it('resolves a real form in both languages rather than echoing the key', async () => {
    for (const lng of ['en', 'ar']) {
      for (const count of [1, 2, 3, 11, 100]) {
        const out = await render(lng, 'jobFeed.why.titleMatch', opts(count));
        expect(out.startsWith('jobFeed.')).toBe(false);
      }
    }
  });
});

describe('the Arabic counts that used to fall through to the "other" form', () => {
  it('gives itemCount its dual and its 11+ form', async () => {
    expect(await render('ar', 'sections.explainability.itemCount', { count: 2 })).toBe('عنصران');
    expect(await render('ar', 'sections.explainability.itemCount', { count: 11 })).toBe('11 عنصرًا');
    expect(await render('ar', 'sections.explainability.itemCount', { count: 5 })).toBe('5 عناصر');
  });

  it('gives appliedCount the same treatment', async () => {
    expect(await render('ar', 'sections.optimize.diff.appliedCount', { count: 2 })).toBe('تحسينان مطبّقان');
    expect(await render('ar', 'sections.optimize.diff.appliedCount', { count: 11 })).toBe('11 تحسينًا مطبّقًا');
  });

  it('leaves English untouched', async () => {
    expect(await render('en', 'sections.explainability.itemCount', { count: 1 })).toBe('1 item');
    expect(await render('en', 'sections.explainability.itemCount', { count: 2 })).toBe('2 items');
  });
});
