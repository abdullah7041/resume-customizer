import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { analyzeResume, optimizeResume, parseResume } from './api.js';

// Mock supabase
vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: null
      })
    }
  }
}));

beforeEach(() => {
  global.fetch = vi.fn();

  // Mock localStorage with beta code
  const localStorageMock = {
    getItem: vi.fn((key) => {
      if (key === 'watheq:beta_access') return 'WATHEQ01';
      return null;
    }),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  global.localStorage = localStorageMock;
});

afterEach(() => {
  vi.restoreAllMocks();
  delete global.localStorage;
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
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        })
      })
    );
  });

  it('throws when parse fails', async () => {
    // Use 400 (client error) to avoid retries
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Parse failed' }),
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
      headers: expect.objectContaining({
        'Content-Type': 'application/json'
      }),
      body: JSON.stringify({ resumeText: 'resume text', jobText: 'job text', language: 'en' })
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
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify({ resumeText: 'resume', jobText: 'job', language: 'en' })
      })
    );
    expect(result.source).toBe('gemini');
  });
});



