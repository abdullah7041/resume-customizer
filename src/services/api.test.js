import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { analyzeResume, optimizeResume, parseResume } from './api.js';

beforeEach(() => {
  global.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('parseResume', () => {
  it('returns trimmed text', async () => {
    await expect(parseResume('  Sample resume  ')).resolves.toBe('Sample resume');
  });

  it('throws when content empty', async () => {
    await expect(parseResume('   ')).rejects.toThrow('Unable to parse resume content.');
  });
});

describe('analyzeResume', () => {
  it('calls match-score function and adapts the response', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          score: 82,
          explanations: {
            topMissing: ['react', 'aws'],
            topHits: ['leadership'],
            coverage: 0.6,
            cosine: 0.71,
          },
        }),
    });

    const result = await analyzeResume('resume text', 'job text');

    expect(global.fetch).toHaveBeenCalledWith('/.netlify/functions/match-score', expect.objectContaining({
      method: 'POST',
    }));
    expect(result).toEqual({
      score: 82,
      missingKeywords: ['react', 'aws'],
      suggestions: [
        'Consider highlighting “react” to better reflect the role requirements.',
        'Consider highlighting “aws” to better reflect the role requirements.',
      ],
      topHits: ['leadership'],
      coverage: 0.6,
      cosine: 0.71,
    });
  });

  it('throws a timeout error when aborted', async () => {
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    global.fetch.mockRejectedValueOnce(abortError);

    await expect(analyzeResume('resume text', 'job text')).rejects.toThrow('Match analysis timed out');
  });
});

describe('optimizeResume', () => {
  it('returns cards from optimize function', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          cards: [
            {
              section: 'Summary',
              issue: 'Issue',
              suggestion: 'Fix it',
              exampleBefore: 'Before',
              exampleAfter: 'After',
            },
          ],
          keywords: { add: ['react'], remove: [], neutral: [] },
          source: 'mock',
        }),
    });

    const result = await optimizeResume({
      resumeText: 'resume',
      jobDesc: 'job',
      mode: 'auto',
    });

    expect(global.fetch).toHaveBeenCalledWith('/.netlify/functions/optimize', expect.objectContaining({
      method: 'POST',
    }));
    expect(result.cards).toHaveLength(1);
    expect(result.keywords.add).toContain('react');
  });

  it('throws when request aborted', async () => {
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    global.fetch.mockRejectedValueOnce(abortError);

    await expect(
      optimizeResume({ resumeText: 'resume', jobDesc: 'job', mode: 'auto' })
    ).rejects.toThrow('Optimization request timed out');
  });
});
