import { describe, expect, it } from 'vitest';
import { scoreMatch } from '../../eval/match-score.mjs';
import { getMissingFixtureCaches } from '../../eval/match-eval-guards.mjs';

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
