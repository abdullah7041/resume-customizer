import { describe, expect, it } from 'vitest';
import { buildOptimizationCards, buildEvidenceBackedOptimizationCards, calculateScores } from '../optimize-cards.js';
import { fingerprintEvidenceText } from '../optimization-evidence.js';

const logPrefix = '[optimize-cards:test]';

describe('optimize-cards', () => {
  it('keeps valid cards and rejects a mismatched repeated bullet without leaking its text', async () => {
    const sources = [
      { id: 'a', kind: 'resume' as const, targetId: 'work-a', text: 'Built reports', fingerprint: fingerprintEvidenceText('Built reports') },
      { id: 'b', kind: 'resume' as const, targetId: 'work-b', text: 'Built reports', fingerprint: fingerprintEvidenceText('Built reports') },
    ];
    const result = await buildEvidenceBackedOptimizationCards({
      bullet_improvements: [
        { target_id: 'work-a', original: 'Built reports', improved: 'Built clearer reports', evidence_references: [{ sourceId: 'a', quote: 'Built reports' }] },
        { target_id: 'work-b', original: 'Built reports', improved: 'Cut costs 40%', evidence_references: [{ sourceId: 'a', quote: 'Built reports' }] },
      ],
    }, { logPrefix, sources });
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]?.evidence).toMatchObject({ targetId: 'work-a', status: 'needs_review' });
    expect(result.diagnostics).toEqual([{ status: 422, code: 'EVIDENCE_INVALID', message: 'An optimization item lacked valid source evidence.' }]);
    expect(JSON.stringify(result.diagnostics)).not.toContain('Cut costs');
  });

  it('rejects a fresh headline rewrite without source evidence', async () => {
    const result = await buildEvidenceBackedOptimizationCards({
      original_headline: 'Analyst', suggested_headline: 'Data analyst', headline_target_id: 'basics:label', headline_evidence_references: [],
    }, { logPrefix, sources: [] });
    expect(result.cards).toHaveLength(0);
    expect(result.diagnostics[0]).toMatchObject({ code: 'EVIDENCE_INVALID' });
  });
  it('drops an invented number even when the source and target are valid', async () => {
    const sources = [{ id: 'a', kind: 'resume' as const, targetId: 'work-a', text: 'Improved service', fingerprint: fingerprintEvidenceText('Improved service') }];
    const result = await buildEvidenceBackedOptimizationCards({ bullet_improvements: [{ target_id: 'work-a', original: 'Improved service', improved: 'Improved service by 40% (verify)', evidence_references: [{ sourceId: 'a', quote: 'Improved service' }] }] }, { logPrefix, sources });
    expect(result.cards).toEqual([]);
    expect(result.diagnostics).toHaveLength(1);
  });
  it('keeps source-backed headline and summary rewrites for candidate review', async () => {
    const sources = [
      { id: 'headline', kind: 'resume' as const, targetId: 'basics:label', text: 'Analyst', fingerprint: fingerprintEvidenceText('Analyst') },
      { id: 'summary', kind: 'resume' as const, targetId: 'basics:summary', text: 'Built reports', fingerprint: fingerprintEvidenceText('Built reports') },
    ];
    const result = await buildEvidenceBackedOptimizationCards({
      original_headline: 'Analyst', suggested_headline: 'Data analyst', headline_target_id: 'basics:label', headline_evidence_references: [{ sourceId: 'headline', quote: 'Analyst' }],
      original_summary: 'Built reports', summary_rewrite: 'Developed reports', summary_target_id: 'basics:summary', summary_evidence_references: [{ sourceId: 'summary', quote: 'Built reports' }],
    }, { logPrefix, sources });
    expect(result.cards.map(card => card.section)).toEqual(['Headline', 'Summary']);
    expect(result.cards.every(card => card.evidence?.status === 'needs_review')).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });
  it('accepts an exact candidate clarification as evidence for a new number on the same target', async () => {
    const sources = [
      { id: 'resume', kind: 'resume' as const, targetId: 'work-a', text: 'Improved service', fingerprint: fingerprintEvidenceText('Improved service') },
      { id: 'clarification', kind: 'clarification' as const, targetId: 'work-a', text: 'Reduced wait time 40%', fingerprint: fingerprintEvidenceText('Reduced wait time 40%'), createdAt: '2026-09-27T00:00:00Z' },
    ];
    const result = await buildEvidenceBackedOptimizationCards({ bullet_improvements: [{
      target_id: 'work-a', original: 'Improved service', improved: 'Reduced wait time 40%', evidence_references: [{ sourceId: 'resume', quote: 'Improved service' }, { sourceId: 'clarification', quote: 'Reduced wait time 40%' }],
    }] }, { logPrefix, sources });
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]?.evidence).toMatchObject({ targetId: 'work-a', status: 'needs_review', reasons: ['semantic_review'] });
    expect(result.diagnostics).toEqual([]);
  });
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
    ).toEqual({ beforeScore: 65, estimatedImprovement: null });
  });
});
