import { describe, expect, it } from 'vitest';
import { scoreMatch } from '../../eval/match-score.mjs';
import * as evalGuards from '../../eval/match-eval-guards.mjs';

const { getMissingFixtureCaches } = evalGuards;

const validActual = {
  score: 70,
  categoryScores: {
    hard_skills: { score: 70, max: 100 },
    experience: { score: 70, max: 100 },
    education: { score: 70, max: 100 },
    soft_skills: { score: 70, max: 100 },
  },
  strongMatches: ['React', 'ETL'],
  missingKeywords: ['Kubernetes'],
  summary_bullets: ['Strong React evidence', 'ETL experience is relevant', 'Kubernetes is missing'],
  reasoning: 'The candidate is a partial match.',
};

describe('match eval hard gates', () => {
  it('fails when any mustCredit term is absent even if the weighted score is above threshold', () => {
    const result = scoreMatch(
      { scoreBand: [65, 85], mustCredit: ['React', 'ETL', 'SQL'] },
      validActual,
    );

    expect(result.overall).toBeGreaterThan(0.8);
    expect(result.passed).toBe(false);
    expect(result.hardFailures).toContain('required_strength_missing:SQL');
  });

  it('fails when an explicitly forbidden unevidenced skill is credited', () => {
    const result = scoreMatch(
      { scoreBand: [30, 45], mustNotCredit: ['TensorFlow'] },
      { ...validActual, score: 35, strongMatches: ['TensorFlow'] },
    );

    expect(result.passed).toBe(false);
    expect(result.hardFailures).toContain('forbidden_strength_credited:TensorFlow');
  });

  it('requires Arabic reasoning and bullets when proseLanguage is ar', () => {
    const result = scoreMatch(
      { scoreBand: [65, 85], proseLanguage: 'ar' },
      validActual,
    );

    expect(result.passed).toBe(false);
    expect(result.hardFailures).toContain('reasoning_not_arabic');
    expect(result.hardFailures).toContain('summary_bullet_not_arabic:1');
  });

  it('accepts Arabic prose with embedded Latin technical terms', () => {
    const result = scoreMatch(
      { scoreBand: [65, 85], proseLanguage: 'ar' },
      {
        ...validActual,
        reasoning: 'يمتلك المرشح خبرة قوية في Excel.',
        summary_bullets: [
          'خبرة مثبتة في Excel.',
          'يفتقر إلى خبرة Kubernetes.',
          'المرشح مناسب جزئياً للدور.',
        ],
      },
    );

    expect(result.passed).toBe(true);
    expect(result.hardFailures).toEqual([]);
  });
});

describe('match eval cache coverage', () => {
  it('reports every fixture that cannot be evaluated without an API key', () => {
    const missing = getMissingFixtureCaches(
      ['cached.json', 'missing.json'],
      false,
      (file) => file === 'cached.json',
    );

    expect(missing).toEqual(['missing.json']);
  });

  it('does not require caches when live evaluation is available', () => {
    expect(getMissingFixtureCaches(['missing.json'], true, () => false)).toEqual([]);
  });
});

describe('match eval invariance groups', () => {
  it('fails a clean/noisy pair when surrounding boilerplate moves it across a rubric band', () => {
    expect(evalGuards).toHaveProperty('getInvariantGroupFailures');

    const failures = evalGuards.getInvariantGroupFailures([
      { name: 'clean', expected: { invarianceGroup: 'bi-noise' }, actual: { score: 65 } },
      { name: 'noisy', expected: { invarianceGroup: 'bi-noise' }, actual: { score: 92 } },
    ]);

    expect(failures).toEqual([
      expect.objectContaining({ group: 'bi-noise', names: ['clean', 'noisy'] }),
    ]);
  });

  it('accepts an invariance group whose scores stay in the same rubric band', () => {
    expect(evalGuards).toHaveProperty('getInvariantGroupFailures');

    expect(evalGuards.getInvariantGroupFailures([
      { name: 'clean', expected: { invarianceGroup: 'bi-noise' }, actual: { score: 68 } },
      { name: 'noisy', expected: { invarianceGroup: 'bi-noise' }, actual: { score: 76 } },
    ])).toEqual([]);
  });
});
