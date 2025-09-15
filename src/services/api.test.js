import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeResume, parseResume } from './api.js';

beforeEach(() => {
  process.env.VITE_OPENAI_KEY = 'test-key';
  global.fetch = vi.fn();
});

vi.mock('./supabase.js', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ data: null, error: null })
  }
}));

describe('analyzeResume', () => {
  it('returns analysis data', async () => {
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({
        output_text: JSON.stringify({
          score: 75,
          missingKeywords: ['React'],
          suggestions: ['Mention React experience'],
        }),
      }),
    });
    const result = await analyzeResume('resume', 'job');
    expect(result).toEqual({
      score: 75,
      missingKeywords: ['React'],
      suggestions: ['Mention React experience'],
    });
  });
});

describe('parseResume', () => {
  it('returns parsed text', async () => {
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({
        output_text: JSON.stringify({ text: 'parsed resume' }),
      }),
    });
    const result = await parseResume('resume');
    expect(result).toBe('parsed resume');
  });
});
