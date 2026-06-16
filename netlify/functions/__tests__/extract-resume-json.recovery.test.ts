import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HandlerEvent, HandlerContext, HandlerResponse } from '@netlify/functions';

const mockContext: HandlerContext = {
  callbackWaitsForEmptyEventLoop: true,
  functionName: 'extract-resume-json',
  functionVersion: '$LATEST',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:extract-resume-json',
  memoryLimitInMB: '1024',
  awsRequestId: 'test-request-id',
  logGroupName: '/aws/lambda/extract-resume-json',
  logStreamName: '2024/01/01/[$LATEST]test',
  getRemainingTimeInMillis: () => 30000,
  done: () => { },
  fail: () => { },
  succeed: () => { },
};

const mockGeminiClient = {
  parseResumeOnly: vi.fn(),
};

const mockResumeText = {
  extractPlainTextFromArrayBuffer: vi.fn(),
  inferMimeType: vi.fn(),
  // Identity normalizer — keeps the raw fixture intact for signal/segmentation.
  normalizeResumeText: vi.fn((t: string) => (typeof t === 'string' ? t : '')),
  classifyExtraction: vi.fn(() => 'readable'),
};

const mockRateLimiter = {
  withRateLimit: (_name: string, handler: Function) => handler,
  checkGuestPreviewRateLimit: vi.fn(
    (): Promise<{ allowed: boolean; response?: HandlerResponse }> => Promise.resolve({ allowed: true }),
  ),
};

const mockSupabaseClient = {
  auth: { getUser: vi.fn() },
};

const mockSupabaseClientModule = {
  getSupabaseClient: vi.fn(() => mockSupabaseClient),
};

const mockSentry = {
  initSentry: vi.fn(),
  captureError: vi.fn(),
  summarizeErrorForLog: vi.fn((error: unknown) =>
    error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) },
  ),
};

vi.mock('../../lib/gemini-client', () => mockGeminiClient);
vi.mock('../../lib/resumeText.js', () => mockResumeText);
vi.mock('../../lib/rate-limiter', () => mockRateLimiter);
vi.mock('../../lib/supabase-client.js', () => mockSupabaseClientModule);
vi.mock('../../lib/sentry', () => mockSentry);

const { handler } = await import('../extract-resume-json.js');

// Raw resume text containing email/phone + EDUCATION + CERTIFICATIONS that the
// (mocked) AI parser drops entirely on BOTH the first call and the focused retry.
const RAW_RESUME = [
  'ABDULLAH BIN AHMED',
  'abdullah@example.com | +966 50 123 4567 | Dammam, Saudi Arabia',
  '',
  'SUMMARY',
  'Saudi Enterprise IT Analyst bridging digital transformation and industrial operations across teams.',
  '',
  'EXPERIENCE',
  'Lead IT Systems Builder and Data Architect at Watheq Mar 2020 to Present',
  'Delivered measurable enterprise outcomes across many cloud workflows and teams.',
  '',
  'EDUCATION',
  'BSc Computer Science',
  'King Fahd University of Petroleum and Minerals 2018',
  '',
  'CERTIFICATIONS',
  'AWS Certified Solutions Architect',
  'PMP Project Management Professional',
  '',
  'PROJECTS',
  'Enterprise Resume Optimization Platform',
  '',
  'LANGUAGES',
  'Arabic (Native), English (Fluent)',
].join('\n');

describe('extract-resume-json — deterministic section recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENROUTER_API_KEY = 'test-key';
    mockSupabaseClientModule.getSupabaseClient.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'user@example.com' } },
      error: null,
    });
  });

  it('preserves education/certs/projects/languages when the AI parser returns only basics/work', async () => {
    // AI returns ONLY basics + work on both the first parse and the focused retry.
    const droppedAnalysis = {
      basics: { name: 'Abdullah Bin Ahmed', summary: 'Saudi Enterprise IT Analyst bridging digital transformation.' },
      work: [{ position: 'Lead IT', name: 'Watheq' }],
      education: [],
      certificates: [],
      projects: [],
      languages: [],
      meta: { raw_text: RAW_RESUME },
    };
    mockGeminiClient.parseResumeOnly.mockResolvedValue(droppedAnalysis);

    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({ kind: 'text', value: RAW_RESUME }),
      headers: { Authorization: 'Bearer test-token' },
    } as Partial<HandlerEvent>;

    const result = (await handler(event as any, mockContext)) as HandlerResponse;
    expect(result.statusCode).toBe(200);

    const doc = JSON.parse(result.body).document;

    // Contact recovered from raw text.
    expect(doc.basics.email).toBe('abdullah@example.com');
    expect(doc.basics.phone).toBeTruthy();

    // All visible sections survive the AI omission.
    expect(doc.education.length).toBeGreaterThan(0);
    expect(doc.certificates.length).toBeGreaterThan(0);
    expect(doc.projects.length).toBeGreaterThan(0);
    expect(doc.languages.length).toBeGreaterThan(0);
    expect(doc.languages.map((l: { language: string }) => l.language)).toEqual(
      expect.arrayContaining(['Arabic', 'English']),
    );

    // Recovery metadata records source + recovered sections.
    expect(doc.meta.parseQuality.extractionSource).toBe('ai+recovery');
    expect(doc.meta.parseQuality.fallbackSections).toEqual(
      expect.arrayContaining(['education', 'certificates', 'projects', 'languages']),
    );
    // incompleteSections must EXCLUDE everything recovery filled.
    const incomplete = doc.meta.parseQuality.incompleteSections ?? [];
    expect(incomplete).not.toEqual(
      expect.arrayContaining(['education', 'certificates', 'projects', 'languages']),
    );
  });

  it('returns 422 resume/unreadable-file for CID-glyph / unreadable text (never 500)', async () => {
    // Garbage that defeats word-level readability (isolated glyphs between symbols).
    const garbage = 'ö#ü~ã|ÿ@ø^þ`ð*æ%œ$ß ' + 'ö#ü~ã|ÿ@ø^þ`ð'.repeat(20);
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({ kind: 'text', value: garbage }),
      headers: { Authorization: 'Bearer test-token' },
    } as Partial<HandlerEvent>;

    const result = (await handler(event as any, mockContext)) as HandlerResponse;
    expect(result.statusCode).toBe(422);
    expect(JSON.parse(result.body).code).toBe('resume/unreadable-file');
    // AI parser must NOT be invoked on unreadable input.
    expect(mockGeminiClient.parseResumeOnly).not.toHaveBeenCalled();
  });
});
