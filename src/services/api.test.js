import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { analyzeResume, optimizeResume, parseResume } from './api.js';

const mockResumeText = vi.hoisted(() => ({
  extractPlainTextFromArrayBuffer: vi.fn(),
  inferMimeType: vi.fn(),
}));

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

vi.mock('../lib/utils/resumeText', () => mockResumeText);

beforeEach(() => {
  global.fetch = vi.fn();
  mockResumeText.extractPlainTextFromArrayBuffer.mockReset();
  mockResumeText.inferMimeType.mockReset();
  mockResumeText.inferMimeType.mockReturnValue('application/pdf');

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

  it('sends low-text PDFs as files with auth headers and surfaces 422 without OCR claims', async () => {
    const onOcrFallback = vi.fn();
    mockResumeText.extractPlainTextFromArrayBuffer.mockResolvedValue('too short');

    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      headers: new Headers(),
      json: async () => ({
        error: 'This file appears to be scanned or image-only. Upload a text-based PDF, DOCX, TXT, or paste text.',
      }),
    });

    const { supabase } = await import('./supabase');
    supabase.auth.getSession.mockResolvedValueOnce({
      data: { session: { access_token: 'test-access-token' } },
      error: null,
    });

    const file = new File(['%PDF-low-text'], 'scanned.pdf', { type: 'application/pdf' });

    await expect(parseResume(file, { onOcrFallback })).rejects.toThrow(
      'This file appears to be scanned or image-only'
    );

    expect(onOcrFallback).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const [_url, request] = global.fetch.mock.calls[0];
    expect(request.headers).toEqual(expect.objectContaining({
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-access-token',
    }));

    const payload = JSON.parse(request.body);
    expect(payload).toEqual(expect.objectContaining({
      kind: 'file',
      name: 'scanned.pdf',
      mime: 'application/pdf',
    }));
    expect(payload.data).toBeTruthy();

    const errorMessage = global.fetch.mock.calls[0][1].body;
    expect(errorMessage).not.toMatch(/OCR/i);
  });

  it('sends readable client-extracted PDF text as text without fallback callback', async () => {
    const onOcrFallback = vi.fn();
    const readableText = [
      'Product Manager Riyadh Saudi Arabia',
      'Led digital transformation programs across finance and operations',
      'Managed stakeholder communication and delivery timelines',
    ].join('\n');
    mockResumeText.extractPlainTextFromArrayBuffer.mockResolvedValue(readableText);

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          document: {
            plainText: readableText,
            bullets: [],
            sections: [],
          },
        }),
    });

    const file = new File(['%PDF-readable'], 'resume.pdf', { type: 'application/pdf' });

    await expect(parseResume(file, { onOcrFallback })).resolves.toEqual({
      plainText: readableText,
      bullets: [],
      sections: [],
    });

    expect(onOcrFallback).not.toHaveBeenCalled();
    const payload = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(payload).toEqual({
      kind: 'text',
      value: readableText,
    });
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



