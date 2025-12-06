import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { analyzeResume, optimizeResume, parseResume } from './api.js';

beforeEach(() => {
  global.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('parseResume', () => {
  it('returns parsed document', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          document: {
            plainText: 'Sample resume',
            bullets: [],
            sections: [],
          },
        }),
    });

    await expect(parseResume('Sample resume')).resolves.toEqual({
      plainText: 'Sample resume',
      bullets: [],
      sections: [],
    });
    expect(global.fetch).toHaveBeenCalledWith(
      '/.netlify/functions/extract-resume-json',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('throws when parse fails', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Parse failed' }),
    });
    await expect(parseResume('   ')).rejects.toThrow('Parse failed');
  });
});

describe('analyzeResume', () => {
  it('calls ai-match endpoint', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          score: 82,
          coverage: 0.6,
          similarity: 0.71,
          missingKeywords: ['react', 'aws'],
          strongMatches: [],
          recommendations: [],
          overallAssessment: 'Good',
          explanation: { reason: 'Good', tips: [] }
        }),
    });

    const result = await analyzeResume('resume text', 'job text');

    expect(global.fetch).toHaveBeenCalledWith('/.netlify/functions/ai-match', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ resumeText: 'resume text', jobDesc: 'job text' })
    }));
    expect(result.score).toBe(82);
  });
});

describe('optimizeResume', () => {
  it('calls optimize endpoint', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          cards: [],
          keywords: { add: [], neutral: [], remove: [] },
          source: 'gemini',
        }),
    });

    const result = await optimizeResume({
      resumeText: 'resume',
      jobDesc: 'job',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/.netlify/functions/optimize',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ resumeText: 'resume', jobText: 'job' })
      })
    );
    expect(result.source).toBe('gemini');
  });
});
