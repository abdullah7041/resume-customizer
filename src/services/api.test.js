import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeResume } from './api.js';

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    json: () => Promise.resolve({
      output_text: JSON.stringify({
        score: 75,
        missingKeywords: ['React'],
        suggestions: ['Mention React experience'],
      }),
    }),
  });
});

vi.mock('./supabase.js', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ data: null, error: null })
  }
}));

describe('analyzeResume', () => {
  it('returns analysis data', async () => {
    const result = await analyzeResume('resume', 'job');
    expect(result).toEqual({
      score: 75,
      missingKeywords: ['React'],
      suggestions: ['Mention React experience']
    });
  });
});
