import { describe, expect, it } from 'vitest';
import { buildOptimizationCards, calculateScores } from '../optimize-cards.js';

const logPrefix = '[optimize-cards:test]';

describe('optimize-cards', () => {
  it('preserves the General fallback card for an empty optimization', () => {
    expect(buildOptimizationCards({}, { logPrefix })).toEqual([
      {
        section: 'General',
        issue: 'AI optimization incomplete',
        suggestion:
          "The AI couldn't generate specific improvements. Try with a clearer job description or check resume formatting.",
        exampleBefore: 'Your current resume',
        exampleAfter: 'Consider manual review or retry',
      },
    ]);
  });

  it('builds the headline card with the existing exact copy', () => {
    expect(
      buildOptimizationCards(
        {
          original_headline: 'Software Engineer',
          suggested_headline: 'Senior Platform Engineer',
        },
        { logPrefix },
      ),
    ).toEqual([
      {
        section: 'Headline',
        issue: 'Headline could be more targeted.',
        suggestion: 'Align headline with the job title and key requirements.',
        exampleBefore: 'Software Engineer',
        exampleAfter: 'Senior Platform Engineer',
      },
    ]);
  });

  it('filters an N/A experience suggestion without removing other cards', () => {
    const cards = buildOptimizationCards(
      {
        original_headline: 'Software Engineer',
        suggested_headline: 'Senior Platform Engineer',
        bullet_improvements: [
          {
            original: 'Maintained internal tools',
            improved: 'N/A - not relevant to the target role',
          },
        ],
      },
      { logPrefix },
    );

    expect(cards).toHaveLength(1);
    expect(cards[0]?.section).toBe('Headline');
    expect(cards.some((card) => card.section === 'Experience')).toBe(false);
  });

  it('uses match_score when it is present', () => {
    expect(
      calculateScores(
        { match_score: 70, after_score: 82 },
        { cards: [], logPrefix },
      ),
    ).toEqual({ beforeScore: 70, estimatedImprovement: 12 });
  });

  it('falls back to complete category scores', () => {
    const cards = buildOptimizationCards(
      {
        original_headline: 'Software Engineer',
        suggested_headline: 'Senior Platform Engineer',
      },
      { logPrefix },
    );

    expect(
      calculateScores(
        {
          category_scores: {
            hard_skills: { score: 30 },
            experience: { score: 20 },
            education: { score: 10 },
            soft_skills: { score: 5 },
          },
        },
        { cards, logPrefix },
      ),
    ).toEqual({ beforeScore: 65, estimatedImprovement: 2 });
  });
});
