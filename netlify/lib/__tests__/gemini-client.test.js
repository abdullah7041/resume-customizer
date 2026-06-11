import { beforeEach, describe, expect, it, vi } from 'vitest';

const { callOpenRouterMock } = vi.hoisted(() => ({
  callOpenRouterMock: vi.fn(),
}));

vi.mock('../openrouter-client.js', () => ({
  callOpenRouter: callOpenRouterMock,
  MODELS: {
    lite: 'google/gemini-2.5-flash-lite',
    flash: 'google/gemini-2.5-flash',
  },
}));

const { processMatchOnly } = await import('../gemini-client.js');

describe('processMatchOnly score handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preserves a valid zero match score from the AI response', async () => {
    callOpenRouterMock.mockResolvedValue(JSON.stringify({
      score: 0,
      categoryScores: {
        hard_skills: { score: 0, max: 40, reasoning: 'No required skills found' },
        experience: { score: 0, max: 30, reasoning: 'No relevant experience found' },
        education: { score: 0, max: 15, reasoning: 'No relevant education found' },
        soft_skills: { score: 0, max: 15, reasoning: 'No soft skills evidence found' },
      },
      strongMatches: [],
      missingKeywords: ['React'],
      reasoning: 'No meaningful match evidence.',
      strategicRealityCheck: {
        riskTier: 'medium',
        recommendation: 'answer_clarifications_first',
        confidence: 'low',
        riskTypes: ['evidence_quality'],
        summary: 'More evidence is needed before optimization.',
        strengths: [],
        confirmedRisks: [],
        unclearRisks: [{
          type: 'evidence_quality',
          topic: 'React evidence',
          reason: 'React is not visible in the resume.',
          evidenceNeeded: 'Add React only if the candidate has real experience.',
        }],
        limits: {
          cannotDetermine: ['Employer decisions'],
          assumptions: [],
        },
      },
    }));

    const result = await processMatchOnly('Resume text', 'React job description');

    expect(result.score).toBe(0);
    expect(result.missingKeywords).toEqual(['React']);
    expect(result.strategicRealityCheck.riskTier).toBe('medium');
  });

  it('falls back to match-only with a safe Reality Check object when combined validation fails', async () => {
    callOpenRouterMock
      .mockResolvedValueOnce(JSON.stringify({
        score: 75,
        categoryScores: {
          hard_skills: { score: 30, max: 40, reasoning: 'Good' },
          experience: { score: 20, max: 30, reasoning: 'Good' },
          education: { score: 10, max: 15, reasoning: 'Good' },
          soft_skills: { score: 15, max: 15, reasoning: 'Good' },
        },
        strongMatches: ['SQL'],
        missingKeywords: [],
        reasoning: 'Missing strategicRealityCheck.',
      }))
      .mockResolvedValueOnce(JSON.stringify({
        score: 75,
        categoryScores: {
          hard_skills: { score: 30, max: 40, reasoning: 'Good' },
          experience: { score: 20, max: 30, reasoning: 'Good' },
          education: { score: 10, max: 15, reasoning: 'Good' },
          soft_skills: { score: 15, max: 15, reasoning: 'Good' },
        },
        strongMatches: ['SQL'],
        missingKeywords: [],
        reasoning: 'Good match.',
      }));

    const result = await processMatchOnly('SQL resume text', 'SQL job description');

    expect(result.score).toBe(75);
    expect(result.strategicRealityCheck.confidence).toBe('low');
    expect(result.strategicRealityCheck.unclearRisks[0].topic).toBe('Reality Check needs clearer evidence');
    expect(callOpenRouterMock).toHaveBeenCalledTimes(2);
  });
});
