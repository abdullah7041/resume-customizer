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
    }));

    const result = await processMatchOnly('Resume text', 'React job description');

    expect(result.score).toBe(0);
    expect(result.missingKeywords).toEqual(['React']);
  });
});
