import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../lib/aiClient', () => {
  const runOptimization = vi.fn();
  return {
    runOptimization,
    USE_MOCK: false,
  };
});

import { runOptimization } from '../lib/aiClient';
import { analyzeResume, optimizeResume, parseResume, AI_DEFAULT_TEMPERATURE } from './api.js';

beforeEach(() => {
  global.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('parseResume', () => {
  it('returns trimmed text', async () => {
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

    await expect(parseResume('  Sample resume  ')).resolves.toEqual({
      plainText: 'Sample resume',
      bullets: [],
      sections: [],
    });
    expect(global.fetch).toHaveBeenCalledWith(
      '/.netlify/functions/parse-resume',
      expect.objectContaining({ method: 'POST' })
    );
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
          coverage: 0.6,
          similarity: 0.71,
          missing_keywords: ['react', 'aws'],
          matched_keywords: ['leadership'],
        }),
    });

    const result = await analyzeResume({ plainText: 'resume text' }, 'job text');

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

  it('falls back to keyword overlap scoring when API returns zeros', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          score: 0,
          coverage: 0,
          similarity: 0,
          missing_keywords: [],
          matched_keywords: [],
        }),
    });

    const resume = {
      plainText:
        'Senior data analyst skilled in SQL, Tableau dashboards, and financial reporting for Riyadh banking clients.',
    };

    const result = await analyzeResume(resume, 'Looking for a data analyst with SQL and Tableau experience.');

    expect(result.score).toBeGreaterThan(20);
    expect(result.coverage).toBeGreaterThan(0);
    expect(result.missingKeywords.length).toBeGreaterThan(0);
    expect(result.topHits).toContain('sql');
  });

  it('throws a timeout error when aborted', async () => {
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    global.fetch.mockRejectedValueOnce(abortError);

    await expect(analyzeResume({ plainText: 'resume text' }, 'job text')).rejects.toThrow('Match analysis timed out');
  });
});

describe('optimizeResume', () => {
  it('parses AI response into cards and keywords', async () => {
    runOptimization.mockResolvedValueOnce({
      text: JSON.stringify({
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
        source: 'openai',
      }),
      raw: { id: 'req_123', model: 'gpt-5-nano' },
    });

    const result = await optimizeResume({
      resumeText: 'resume',
      jobDesc: 'job',
      mode: 'auto',
    });

    expect(runOptimization).toHaveBeenCalledWith(
      expect.objectContaining({
        resumeText: 'resume',
        jobText: 'job',
        mode: 'auto',
        messages: expect.any(Array),
        temperature: AI_DEFAULT_TEMPERATURE,
      }),
      expect.objectContaining({ signal: expect.any(Object) })
    );

    const payload = runOptimization.mock.calls[0][0];
    expect(payload.messages[0]).toMatchObject({ role: 'system' });
    expect(payload.messages[1]).toMatchObject({ role: 'user' });
    expect(payload.temperature).toBe(AI_DEFAULT_TEMPERATURE);
    expect(result.cards).toHaveLength(1);
    expect(result.keywords.add).toContain('react');
    expect(result.source).toBe('openai');
  });

  it('throws when request aborted', async () => {
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    runOptimization.mockRejectedValueOnce(abortError);

    await expect(
      optimizeResume({ resumeText: 'resume', jobDesc: 'job', mode: 'auto' })
    ).rejects.toThrow('Optimization request timed out');
  });

  it('uses an extended timeout window for optimization requests', async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

    try {
      runOptimization.mockResolvedValueOnce({
        text: JSON.stringify({ cards: [], keywords: { add: [], neutral: [], remove: [] }, source: 'openai' }),
        raw: {},
      });

      await optimizeResume({ resumeText: 'resume', jobDesc: 'job', mode: 'auto' });

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 45000);
    } finally {
      setTimeoutSpy.mockRestore();
      vi.useRealTimers();
    }
  });
});
