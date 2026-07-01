import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AUTH_REQUIRED, analyzeResume, optimizeResume, optimizeResumeStream, parseResume, refineBullet } from './api.js';
import { supabase } from './supabase';

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
  supabase.auth.getSession.mockResolvedValue({
    data: { session: { access_token: 'test-access-token' } },
    error: null,
  });

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

  it('blocks signed-out text parsing before extract-resume-json', async () => {
    supabase.auth.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    await expect(parseResume('Sample resume')).rejects.toMatchObject({
      status: 401,
      type: AUTH_REQUIRED,
      message: 'Please sign in to securely process your resume.',
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('blocks signed-out readable client-extracted PDFs before server parsing', async () => {
    const readableText = [
      'Product Manager Riyadh Saudi Arabia',
      'Led digital transformation programs across finance and operations',
      'Managed stakeholder communication and delivery timelines',
    ].join('\n');
    mockResumeText.extractPlainTextFromArrayBuffer.mockResolvedValue(readableText);
    supabase.auth.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    const file = new File(['%PDF-readable'], 'resume.pdf', { type: 'application/pdf' });

    await expect(parseResume(file)).rejects.toMatchObject({
      status: 401,
      type: AUTH_REQUIRED,
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('blocks signed-out low-text file fallback before server parsing', async () => {
    const onOcrFallback = vi.fn();
    mockResumeText.extractPlainTextFromArrayBuffer.mockResolvedValue('too short');
    supabase.auth.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    const file = new File(['%PDF-low-text'], 'scanned.pdf', { type: 'application/pdf' });

    await expect(parseResume(file, { onOcrFallback })).rejects.toMatchObject({
      status: 401,
      type: AUTH_REQUIRED,
    });

    expect(onOcrFallback).toHaveBeenCalledTimes(1);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects oversized guest preview files before extraction or network calls', async () => {
    const file = new File(['a'], 'large.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'size', {
      value: 2 * 1024 * 1024 + 1,
      configurable: true,
    });

    await expect(parseResume(file, { guestPreview: true })).rejects.toMatchObject({
      status: 413,
      code: 'file/guest-too-large',
      message: 'Preview files are limited to 2MB. Please sign in to process larger files.',
    });

    expect(mockResumeText.extractPlainTextFromArrayBuffer).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('maps extract-resume-json 401 responses to AUTH_REQUIRED', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: new Headers(),
      json: async () => ({ error: 'Authentication required. Please sign in.' }),
    });

    await expect(parseResume('Sample resume')).rejects.toMatchObject({
      status: 401,
      type: AUTH_REQUIRED,
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('preserves guest preview limit codes for telemetry', async () => {
    supabase.auth.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 413,
      headers: new Headers(),
      json: async () => ({
        error: 'Preview text is limited to 20,000 characters. Please sign in to process longer resumes.',
        code: 'guest/text-too-large',
      }),
    });

    await expect(parseResume('Sample resume', { guestPreview: true })).rejects.toMatchObject({
      status: 413,
      code: 'guest/text-too-large',
    });
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
      sourceInputKind: 'file',
      sourceWasFile: true,
      sourceFileSizeBytes: file.size,
      guestPreview: false,
    });
  });

  it('sends readable guest preview file text with source file metadata', async () => {
    supabase.auth.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });
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

    await expect(parseResume(file, { guestPreview: true })).resolves.toEqual({
      plainText: readableText,
      bullets: [],
      sections: [],
    });

    const payload = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(payload).toEqual({
      kind: 'text',
      value: readableText,
      sourceInputKind: 'file',
      sourceWasFile: true,
      sourceFileSizeBytes: file.size,
      guestPreview: true,
    });
    expect(global.fetch.mock.calls[0][1].headers).not.toHaveProperty('Authorization');
  });
});

describe('analyzeResume', () => {
  it('blocks signed-out match analysis before ai-match', async () => {
    supabase.auth.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    await expect(analyzeResume('resume text', 'job text')).rejects.toMatchObject({
      status: 401,
      type: AUTH_REQUIRED,
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('calls ai-match endpoint', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'x-nf-request-id': 'match-request-1' }),
      json: () =>
        Promise.resolve({
          score: 82,
          coverage: 0.6,
          similarity: 0.71,
          missingKeywords: ['react', 'aws'],
          strongMatches: [],
          recommendations: [],
          overallAssessment: 'Good',
          explanation: { reason: 'Good', tips: [] },
          debug: {
            model: 'google/gemini-2.5-flash',
            latencyMs: 1234,
          },
          strategicRealityCheck: {
            riskTier: 'critical',
            recommendation: 'add_evidence_first',
            confidence: 'medium',
            riskTypes: ['missing_required_skill'],
            summary: 'Critical evidence gap.',
            strengths: [],
            confirmedRisks: [],
            unclearRisks: [{
              type: 'missing_required_skill',
              topic: 'Machine learning',
              reason: 'Evidence is unclear.',
              evidenceNeeded: 'Add verified evidence only if it exists.',
            }],
            limits: { cannotDetermine: ['Employer decisions'], assumptions: [] },
          },
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
    expect(result.debug).toEqual(expect.objectContaining({
      requestId: 'match-request-1',
      model: 'google/gemini-2.5-flash',
      latencyMs: 1234,
    }));
    expect(result.strategicRealityCheck).toEqual(expect.objectContaining({
      riskTier: 'critical',
      recommendation: 'add_evidence_first',
      confidence: 'medium',
    }));
    expect(result.strategicRealityCheck.unclearRisks).toHaveLength(1);
  });

  it('normalizes malformed Reality Check fields without dropping the match result', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          score: 76,
          coverage: 0.76,
          similarity: 0.76,
          missingKeywords: [],
          strongMatches: ['SQL'],
          recommendations: [],
          overallAssessment: 'Good',
          explanation: { reason: 'Good', tips: [] },
          strategicRealityCheck: {
            riskTier: 'unclear',
            recommendation: 'unknown',
            confidence: 'unknown',
            riskTypes: null,
            strengths: null,
            confirmedRisks: null,
            unclearRisks: null,
            limits: null,
          },
        }),
    });

    const result = await analyzeResume('resume text', 'job text');

    expect(result.score).toBe(76);
    expect(result.strategicRealityCheck).toEqual(expect.objectContaining({
      riskTier: 'medium',
      recommendation: 'answer_clarifications_first',
      confidence: 'low',
      riskTypes: [],
      confirmedRisks: [],
      unclearRisks: [],
    }));
  });
});

describe('optimizeResume', () => {
  it('calls optimize endpoint', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'x-request-id': 'optimize-request-1' }),
      json: () =>
        Promise.resolve({
          cards: [],
          keywords: { add: [], neutral: [], remove: [] },
          source: 'gemini',
          debug: {
            model: 'google/gemini-2.5-flash',
            latencyMs: 4567,
          },
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
        body: JSON.stringify({ resumeText: 'resume', jobText: 'job', language: 'en', searchIntent: null })
      })
    );
    expect(result.source).toBe('gemini');
    expect(result.debug).toEqual(expect.objectContaining({
      requestId: 'optimize-request-1',
      model: 'google/gemini-2.5-flash',
      latencyMs: 4567,
    }));
  });

  it('sends hard-stop suppressions through the legacy optimize request', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers(),
      json: async () => ({ cards: [], keywords: { add: [], neutral: [], remove: [] } }),
    });

    await optimizeResume({
      resumeText: 'resume',
      jobDesc: 'job',
      userHardStops: ['Excel'],
    });

    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toMatchObject({
      userHardStops: ['Excel'],
    });
  });

  it('sends hard-stop suppressions through the streaming optimize request', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ cards: [], keywords: { add: [], neutral: [], remove: [] } }),
    });

    await optimizeResumeStream({
      resumeText: 'resume',
      jobDesc: 'job',
      userHardStops: ['Excel'],
    }, vi.fn());

    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toMatchObject({
      userHardStops: ['Excel'],
    });
  });

  it('preserves safe optimize error metadata for debug panels', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      headers: new Headers({ 'x-nf-request-id': 'timeout-request-1' }),
      json: async () => ({
        error: 'Optimization timed out.',
        code: 'ai/timeout',
        troubleshooting: 'AI service timeout.',
      }),
    });

    await expect(optimizeResume({
      resumeText: 'resume',
      jobDesc: 'job',
    })).rejects.toMatchObject({
      status: 400,
      statusCode: 400,
      errorCode: 'ai/timeout',
      errorDetail: 'AI service timeout.',
      debug: {
        requestId: 'timeout-request-1',
      },
    });
  });
});

describe('refineBullet', () => {
  it('calls refine-bullet with auth and preserves the structured response', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'x-request-id': 'refine-request-1' }),
      json: () => Promise.resolve({
        improved: 'Led a team of 4 engineers, shipping billing 2 weeks early.',
        issue: '',
        rationale: 'Tightened the wording while preserving the supported metric.',
      }),
    });

    const result = await refineBullet({
      original: 'Led a team',
      currentImproved: 'Led a team of 4 engineers',
      userInstruction: 'Make it more concise',
      jobContext: 'Backend engineer role',
      resumeText: 'Led a team of 4 engineers, shipping billing 2 weeks early.',
      language: 'en',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/.netlify/functions/refine-bullet',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-access-token',
        }),
        body: JSON.stringify({
          original: 'Led a team',
          currentImproved: 'Led a team of 4 engineers',
          userInstruction: 'Make it more concise',
          jobContext: 'Backend engineer role',
          resumeText: 'Led a team of 4 engineers, shipping billing 2 weeks early.',
          language: 'en',
        }),
      })
    );
    expect(result).toEqual({
      improved: 'Led a team of 4 engineers, shipping billing 2 weeks early.',
      issue: '',
      rationale: 'Tightened the wording while preserving the supported metric.',
    });
  });

  it('blocks signed-out refinement before refine-bullet', async () => {
    supabase.auth.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    await expect(refineBullet({
      original: 'Led a team',
      currentImproved: 'Led a team of 4 engineers',
      userInstruction: 'Make it more concise',
      resumeText: 'Led a team of 4 engineers.',
    })).rejects.toMatchObject({
      status: 401,
      type: AUTH_REQUIRED,
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
